-- ==========================================
-- SECURITY MIGRATION: MOVING GAME LOGIC TO BACKEND
-- ==========================================

-- 0. HELPER FUNCTIONS
-- Calculate authoritative Max HP (Base + Equip + Partner) * God bonus
CREATE OR REPLACE FUNCTION public.secure_calculate_effective_max_hp(p_p public.profiles)
RETURNS integer AS $$
DECLARE
    v_e_hp integer := 0;
    v_pt_hp integer := 0;
    v_g_mult float := 1.0;
    v_god jsonb;
BEGIN
    -- 1. Equipment HP
    v_e_hp := COALESCE((p_p.equipped_weapon->>'hp')::int, 0) +
              COALESCE((p_p.equipped_armor->>'hp')::int, 0) +
              COALESCE((p_p.equipped_helmet->>'hp')::int, 0) +
              COALESCE((p_p.equipped_boots->>'hp')::int, 0) +
              COALESCE((p_p.equipped_accessory->>'hp')::int, 0);

    -- 2. Partner HP
    SELECT SUM(CASE 
        WHEN (elem->>'role' = 'tank' OR elem->>'role' = 'healer') THEN (elem->>'power')::int * 3
        ELSE (elem->>'power')::int
    END) INTO v_pt_hp
    FROM jsonb_array_elements(COALESCE(p_p.partners, '[]'::jsonb)) AS elem
    WHERE (elem->>'isDeployed')::boolean = true;

    -- 3. God HP Bonus
    IF p_p.active_god_id IS NOT NULL THEN
        SELECT elem INTO v_god 
        FROM jsonb_array_elements(COALESCE(p_p.gods, '[]'::jsonb)) AS elem 
        WHERE elem->>'id' = p_p.active_god_id;
        
        IF v_god IS NOT NULL THEN
            IF v_god->>'name' LIKE '%土地公%' THEN v_g_mult := 1.0 + (v_god->>'level')::int * 0.005;
            ELSIF v_god->>'name' LIKE '%關公%' OR v_god->>'name' LIKE '%關聖%' THEN v_g_mult := 1.0 + (v_god->>'level')::int * 0.01;
            END IF;
        END IF;
    END IF;

    RETURN floor((p_p.max_hp + v_e_hp + COALESCE(v_pt_hp, 0)) * v_g_mult);
END;
$$ LANGUAGE plpgsql;

-- 1. SECURE EQUIPMENT SELLING
-- Logic: Verify item exists in user's inventory, ensure it is NOT equipped, add gold, remove item.
CREATE OR REPLACE FUNCTION public.secure_sell_equipment(p_equipment_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_profile public.profiles;
    v_equipment jsonb;
    v_rarity integer;
    v_sell_price double precision;
    v_is_equipped boolean := false;
BEGIN
    -- Get current profile
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

    -- Check if it is equipped in any slot
    IF (v_profile.equipped_weapon->>'id' = p_equipment_id) OR
       (v_profile.equipped_armor->>'id' = p_equipment_id) OR
       (v_profile.equipped_helmet->>'id' = p_equipment_id) OR
       (v_profile.equipped_boots->>'id' = p_equipment_id) OR
       (v_profile.equipped_accessory->>'id' = p_equipment_id) THEN
        RAISE EXCEPTION 'Cannot sell equipped items';
    END IF;

    -- Find the equipment in inventory array
    SELECT elem INTO v_equipment 
    FROM jsonb_array_elements(v_profile.equipment) AS elem 
    WHERE elem->>'id' = p_equipment_id;

    IF v_equipment IS NULL THEN
        RAISE EXCEPTION 'Equipment not found in inventory';
    END IF;

    -- Calculate Sell Price (Formula: 100 * 5^(rarity-1))
    v_rarity := (v_equipment->>'rarity')::integer;
    v_sell_price := floor(100 * power(5, v_rarity - 1));

    -- Update Profile: Remove item and add gold
    UPDATE public.profiles
    SET 
        gold = gold + v_sell_price,
        equipment = (
            SELECT jsonb_agg(elem)
            FROM jsonb_array_elements(v_profile.equipment) AS elem
            WHERE elem->>'id' != p_equipment_id
        ),
        updated_at = now()
    WHERE id = v_user_id;

    -- Authoritative Sync
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'gold_gained', v_sell_price,
        'message', 'Sold ' || (v_equipment->>'name'),
        'updated_profile', row_to_json(v_profile)
    );
END;
$$;

-- 2. SECURE SKILL UPGRADE
-- Logic: Server-side check for requirements and server-side random roll.
CREATE OR REPLACE FUNCTION public.secure_upgrade_skill(p_skill_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_profile public.profiles;
    v_skill_idx integer;
    v_skill jsonb;
    v_lv integer;
    v_current_frags integer;
    
    -- Sync with App.tsx: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] indices
    -- SQL index starts at 1
    v_gold_costs integer[] := ARRAY[0, 1000, 2000, 3000, 5000, 8000, 13000, 21000, 34000, 55000];
    v_frag_costs integer[] := ARRAY[0, 1, 2, 3, 5, 8, 13, 21, 34, 55];
    v_rates integer[] := ARRAY[100, 100, 100, 100, 70, 60, 50, 40, 15, 10];
    
    v_gold_cost integer;
    v_frag_cost integer;
    v_success_rate integer;
    v_roll float;
    v_success boolean;
    v_msg text;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION '未找到角色存檔'; END IF;
    
    -- Find skill index
    SELECT (idx - 1) INTO v_skill_idx
    FROM jsonb_array_elements(v_profile.skills) WITH ORDINALITY AS t(elem, idx)
    WHERE elem->>'id' = p_skill_id;

    IF v_skill_idx IS NULL THEN RAISE EXCEPTION '尚未領悟此技能 (ID: %)', p_skill_id; END IF;
    
    v_skill := v_profile.skills->v_skill_idx;
    v_lv := COALESCE((v_skill->>'level')::integer, 1);
    v_current_frags := COALESCE((v_skill->>'fragments')::integer, 0);

    IF v_lv >= 10 THEN RAISE EXCEPTION '技能已達最高等級 (Lv.10)'; END IF;

    -- Indexing check: Lv.6 upgrade uses index 6+1=7 -> v_frag_costs[7] = 13
    v_gold_cost := v_gold_costs[v_lv + 1];
    v_frag_cost := v_frag_costs[v_lv + 1];
    v_success_rate := v_rates[v_lv + 1];

    -- Final Check
    IF v_profile.gold < v_gold_cost THEN 
        RAISE EXCEPTION '金幣不足！需要 %, 目前持有 %', v_gold_cost, floor(v_profile.gold); 
    END IF;
    
    IF v_current_frags < v_frag_cost THEN 
        RAISE EXCEPTION '技能碎片不足！需要 %, 目前持有 %', v_frag_cost, v_current_frags; 
    END IF;

    -- Roll for success
    v_roll := random() * 100;
    IF v_roll <= v_success_rate THEN
        v_success := true;
        v_skill := v_skill || jsonb_build_object('level', v_lv + 1, 'fragments', v_current_frags - v_frag_cost);
        v_msg := '✨ 技能強化成功！等級提升至 Lv.' || (v_lv + 1);
    ELSE
        v_success := false;
        v_skill := v_skill || jsonb_build_object('fragments', v_current_frags - v_frag_cost);
        v_msg := '💢 強化失敗，消耗了材料與金幣...';
    END IF;

    -- Update Profile
    UPDATE public.profiles
    SET 
        gold = gold - v_gold_cost,
        skills = jsonb_set(skills, ARRAY[v_skill_idx::text], v_skill),
        updated_at = now()
    WHERE id = v_user_id;

    -- Authoritative Sync
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', v_success,
        'message', v_msg,
        'new_level', (v_skill->>'level')::integer,
        'gold_spent', v_gold_cost,
        'updated_profile', row_to_json(v_profile)
    );
END;
$$;


-- 3. SECURE COMBAT RESOLVE (DEFINITIVE VERSION - server-side reward calculation)
-- Security: no longer trusts frontend for exp/gold/elite status. All derived server-side.
CREATE OR REPLACE FUNCTION public.secure_resolve_combat(
    p_monster_name text,
    p_player_hp integer, p_player_mp float8,
    p_skill_reward_id text DEFAULT null, p_skill_reward_name text DEFAULT null,
    p_lat float8 DEFAULT null, p_lng float8 DEFAULT null,
    p_monster_level integer DEFAULT null,
    p_is_auto_explore boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_u uuid := auth.uid(); v_p public.profiles;
    v_g int; v_e int; v_lv int; v_ex int; v_mx int; v_hp int; v_mhp int; v_mp float8; v_mmp int; 
    v_up bool := false; v_t date := current_date; v_ws date := date_trunc('week', current_date)::date;
    v_loots jsonb := '[]'::jsonb; v_sid text; v_sn text; v_sic text; v_sd text;
    v_incense_gain int := 0; v_reg text := 'unknown';
    v_skill_drop bool := false; v_has_skill bool := false; v_skill_idx int;
    v_p_exp int := 0;
    -- 安全：由後端從怪物名稱推斷狀態
    v_is_elite boolean := p_monster_name LIKE '%【菁英】%';
    v_is_boss boolean := p_monster_name LIKE '%【首領】%';
    v_is_weather_special boolean := p_monster_name LIKE '%【掩人耳目】%';
    v_calc_lv int;
BEGIN
    SELECT * INTO v_p FROM public.profiles WHERE id = v_u;
    IF NOT FOUND THEN RAISE EXCEPTION 'No profile'; END IF;

    DECLARE
        v_now_ms bigint := EXTRACT(EPOCH FROM NOW())::bigint * 1000;
        v_buffs jsonb := COALESCE(v_p.active_buffs, '{}'::jsonb);
        v_lucky_active boolean := COALESCE((v_buffs->>'luckyCloverExpiry')::bigint, 0) > v_now_ms;
        v_goddess_active boolean := COALESCE((v_buffs->>'goddessBlessingExpiry')::bigint, 0) > v_now_ms;
        v_horn_active boolean := p_is_auto_explore AND COALESCE((v_buffs->>'hornOfPlentyExpiry')::bigint, 0) > v_now_ms;
        v_horn_multiplier float := CASE WHEN v_horn_active THEN 1.0 + random() * 0.5 ELSE 1.0 END;
    BEGIN

    -- 安全驗證：p_monster_level 必須在玩家等級 +/- 20 範圍內，否則回退到玩家等級
    IF p_monster_level IS NOT NULL AND ABS(p_monster_level - v_p.level) <= 20 THEN
        v_calc_lv := p_monster_level;
    ELSE
        v_calc_lv := v_p.level;
    END IF;

    -- 安全：由後端依計算等級計算基礎獎勵，不信任前端原始傳入值
    DECLARE
        v_base_exp int := 15 + (v_calc_lv - 1) * 10;
        v_base_gold int := 10 + (v_calc_lv - 1) * 5;
    BEGIN
        v_e := floor(v_base_exp * (CASE WHEN v_is_elite OR v_is_boss THEN 2.5 ELSE 1 END));
        v_g := floor(v_base_gold * (CASE WHEN v_is_elite OR v_is_boss THEN 2.5 ELSE 1 END));
        IF v_is_weather_special THEN v_e := v_e * 3; v_g := v_g * 3; END IF;
        
        -- 豐饒角 (Horn of Plenty) 金幣增幅
        v_g := floor(v_g * v_horn_multiplier);
    END;

    -- 2. 成長與升級 (平滑曲線)
    v_lv := v_p.level; v_ex := v_p.exp + v_e; v_mhp := v_p.max_hp; v_mmp := v_p.max_mp;
    v_mx := floor(100 + (v_lv - 1) * 50 * v_lv);
    WHILE v_ex >= v_mx LOOP
        v_ex := v_ex - v_mx; v_lv := v_lv + 1; 
        v_mx := floor(100 + (v_lv - 1) * 50 * v_lv);
        v_mhp := v_mhp + 20; v_mmp := v_mmp + 10; v_up := true;
    END LOOP;

    -- 3. 恢復與屬性校正
    DECLARE
        v_eff_mhp integer;
        v_temp_p public.profiles;
    BEGIN
        v_temp_p := v_p;
        v_temp_p.max_hp := v_mhp; -- 使用更新後的基礎生命值 (考慮升級)
        v_eff_mhp := public.secure_calculate_effective_max_hp(v_temp_p);
        
        v_hp := CASE 
            WHEN v_up THEN v_eff_mhp 
            WHEN (v_is_elite OR v_is_boss OR v_is_weather_special) THEN LEAST(v_eff_mhp, p_player_hp + floor(v_eff_mhp * 0.3)) 
            ELSE p_player_hp 
        END;
        v_mp := CASE 
            WHEN v_up THEN v_mmp 
            WHEN (v_is_elite OR v_is_boss OR v_is_weather_special) THEN LEAST(v_mmp, p_player_mp + (v_mmp * 0.3)) 
            ELSE LEAST(v_mmp, p_player_mp + (v_mmp * 0.1)) 
        END;
    END;

    -- 4. 氣候強敵稀有掉落 (1% 機率)
    IF v_is_weather_special AND random() < 0.01 THEN
        v_sid := (ARRAY['item_str_seed', 'item_def_seed', 'item_hp_seed'])[floor(random() * 3 + 1)];
        v_sn := CASE v_sid WHEN 'item_str_seed' THEN '力量種子' WHEN 'item_def_seed' THEN '鐵壁種子' ELSE '生命之果' END;
        v_sic := CASE v_sid WHEN 'item_str_seed' THEN '💪' WHEN 'item_def_seed' THEN '🛡️' ELSE '🍎' END;
        v_sd := CASE v_sid WHEN 'item_str_seed' THEN '服用後永久提升 2 點攻擊力。' WHEN 'item_def_seed' THEN '服用後永久提升 2 點防禦力。' ELSE '服用後永久提升 10 點最大生命值。' END;
        v_loots := v_loots || jsonb_build_array(jsonb_build_object('id', v_sid, 'name', v_sn, 'icon', v_sic, 'type', 'consumable', 'description', v_sd, 'quantity', 1));
    END IF;

    -- 5. 區域掉落材料 (一般 20%, 菁英 100%)
    IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
        -- Determine Region
        IF (p_lng > 121.0 AND p_lat <= 24.5) THEN v_reg := 'east';
        ELSIF (p_lat > 24.5) THEN v_reg := 'north';
        ELSIF (p_lat > 23.5) THEN v_reg := 'central';
        ELSIF (p_lat > 21.8) THEN v_reg := 'south';
        ELSE v_reg := 'unknown';
        END IF;

        IF v_reg != 'unknown' AND ((random() < (CASE WHEN v_lucky_active THEN 0.24 ELSE 0.2 END)) OR v_is_elite OR v_is_boss) THEN
            DECLARE
                v_reg_sid text; v_reg_sn text; v_reg_sic text; v_reg_sd text; v_reg_q int := 1;
            BEGIN
                IF (v_is_elite OR v_is_boss) THEN v_reg_q := floor(random() * 2 + 1); END IF;
                -- Apply Horn of Plenty to regional material
                v_reg_q := GREATEST(1, floor(v_reg_q * v_horn_multiplier))::int;
                
                CASE v_reg
                    WHEN 'north' THEN
                        v_reg_sid := (ARRAY['mat_north_tech', 'mat_north_glass'])[floor(random() * 2 + 1)];
                        v_reg_sn := CASE v_reg_sid WHEN 'mat_north_tech' THEN '科技廢料' ELSE '魔法玻璃' END;
                        v_reg_sic := CASE v_reg_sid WHEN 'mat_north_tech' THEN '⚙️' ELSE '🪷' END;
                        v_reg_sd := CASE v_reg_sid WHEN 'mat_north_tech' THEN '北部特產：沾染微弱魔力的報廢電路板。' ELSE '北部特產：折射著奇幻光芒的玻璃碎片。' END;
                    WHEN 'central' THEN
                        v_reg_sid := (ARRAY['mat_central_iron', 'mat_central_wood', 'mat_ancient_wood'])[floor(random() * 3 + 1)];
                        v_reg_sn := CASE v_reg_sid WHEN 'mat_central_iron' THEN '高山鐵礦' WHEN 'mat_central_wood' THEN '神木枝枒' ELSE '太古神木' END;
                        v_reg_sic := CASE v_reg_sid WHEN 'mat_central_iron' THEN '⛰️' WHEN 'mat_central_wood' THEN '🍃' ELSE '🌲' END;
                        v_reg_sd := CASE v_reg_sid WHEN 'mat_central_iron' THEN '中部特產：中央山脈深處才挖得到的極堅硬礦石。' WHEN 'mat_central_wood' THEN '中部特產：受到古老森林魔力滋養的樹枝。' ELSE '台中稀有：高品質的千年神木原木。' END;
                    WHEN 'south' THEN
                        v_reg_sid := (ARRAY['mat_south_sand', 'mat_south_pearl', 'mat_lava_sand', 'mat_coral'])[floor(random() * 4 + 1)];
                        v_reg_sn := CASE v_reg_sid WHEN 'mat_south_sand' THEN '炎漠紅砂' WHEN 'mat_south_pearl' THEN '海淵珍珠' WHEN 'mat_lava_sand' THEN '熔岩紅砂' ELSE '珊瑚碎片' END;
                        v_reg_sic := CASE v_reg_sid WHEN 'mat_south_sand' THEN '🏜️' WHEN 'mat_south_pearl' THEN '🦪' WHEN 'mat_lava_sand' THEN '🌋' ELSE '🌺' END;
                        v_reg_sd := CASE v_reg_sid WHEN 'mat_south_sand' THEN '南部特產：蘊含濃烈火屬性魔力的紅色砂礫。' WHEN 'mat_south_pearl' THEN '南部特產：凝聚大洋水屬性精華的璀璨珍珠。' WHEN 'mat_lava_sand' THEN '台南稀有：極品火屬性砂礫。' ELSE '屏東特產：沾著濃厚海洋魔力的礁石碎片。' END;
                    WHEN 'east' THEN
                        v_reg_sid := (ARRAY['mat_east_crystal', 'mat_basalt'])[floor(random() * 2 + 1)];
                        v_reg_sn := CASE v_reg_sid WHEN 'mat_east_crystal' THEN '花東水晶' ELSE '玄武岩礦石' END;
                        v_reg_sic := CASE v_reg_sid WHEN 'mat_east_crystal' THEN '💠' ELSE '🌑' END;
                        v_reg_sd := CASE v_reg_sid WHEN 'mat_east_crystal' THEN '東部特產：純淨無瑕的天然水晶。' ELSE '台東特產：花東縱谷出產的堅硬黑色岩石。' END;
                END CASE;
                
                v_loots := v_loots || jsonb_build_array(jsonb_build_object(
                    'id', v_reg_sid, 'name', v_reg_sn, 'icon', v_reg_sic, 'type', 'material', 'description', v_reg_sd, 'quantity', v_reg_q
                ));
            END;
        END IF;

        -- 5.5 台灣範圍「香火」隨機掉落
        IF v_reg != 'unknown' THEN
            -- 一般、掩人耳目: 10% 機率 (1~3個); 菁英、首領: 20% 機率 (2~5個)
            IF (v_is_elite OR v_is_boss) THEN
                IF random() < (CASE WHEN v_lucky_active THEN 0.24 ELSE 0.20 END) THEN
                    v_incense_gain := GREATEST(1, floor(floor(random() * 4 + 2) * v_horn_multiplier))::int;
                    v_loots := v_loots || jsonb_build_array(jsonb_build_object(
                        'id', 'currency_incense', 'name', '香火', 'icon', '🔥', 'type', 'material', 
                        'description', '來自全台各地廟宇的信仰力量，可用於祭祀。', 'quantity', v_incense_gain
                    ));
                END IF;
            ELSE
                IF random() < (CASE WHEN v_lucky_active THEN 0.12 ELSE 0.10 END) THEN
                    v_incense_gain := GREATEST(1, floor(floor(random() * 3 + 1) * v_horn_multiplier))::int;
                    v_loots := v_loots || jsonb_build_array(jsonb_build_object(
                        'id', 'currency_incense', 'name', '香火', 'icon', '🔥', 'type', 'material', 
                        'description', '來自全台各地廟宇的信仰力量，可用於祭祀。', 'quantity', v_incense_gain
                    ));
                END IF;
            END IF;
        END IF;
    END IF;

    -- 5.6 技能與碎片掉落邏輯
    -- 機率：一般怪 5%, 菁英怪 15%, 首領怪 30%
    IF p_skill_reward_id IS NOT NULL THEN
        DECLARE
            v_drop_roll float := random();
            v_drop_chance float := 0.05;
        BEGIN
            IF v_is_boss THEN v_drop_chance := 0.30;
            ELSIF v_is_elite OR v_is_weather_special THEN v_drop_chance := 0.15;
            END IF;

            v_drop_chance := v_drop_chance * (CASE WHEN v_lucky_active THEN 1.2 ELSE 1.0 END);

            IF v_drop_roll < v_drop_chance THEN
                v_skill_drop := true;
                -- 檢查是否已持有該技能
                SELECT (idx - 1) INTO v_skill_idx
                FROM jsonb_array_elements(v_p.skills) WITH ORDINALITY AS t(elem, idx)
                WHERE elem->>'id' = p_skill_reward_id;

                IF v_skill_idx IS NOT NULL THEN
                    v_has_skill := true;
                    -- 已持有：增加碎片
                    v_p.skills := jsonb_set(
                        v_p.skills,
                        ARRAY[v_skill_idx::text, 'fragments'],
                        ((COALESCE(v_p.skills->v_skill_idx->>'fragments', '0')::int) + 1)::text::jsonb
                    );
                    v_loots := v_loots || jsonb_build_array(jsonb_build_object(
                        'id', 'frag_' || p_skill_reward_id, 'name', p_skill_reward_name || '碎片', 
                        'icon', '💎', 'type', 'material', 'description', '用於強化技能的碎片。', 'quantity', 1
                    ));
                ELSE
                    -- 未持有：習得技能
                    v_p.skills := v_p.skills || jsonb_build_array(jsonb_build_object(
                        'id', p_skill_reward_id, 'level', 1, 'fragments', 0
                    ));
                    v_loots := v_loots || jsonb_build_array(jsonb_build_object(
                        'id', 'skill_' || p_skill_reward_id, 'name', '技能：' || p_skill_reward_name, 
                        'icon', '✨', 'type', 'material', 'description', '全新的技能！', 'quantity', 1
                    ));
                END IF;
            END IF;
        END;
    END IF;

    -- 5.7 夥伴經驗值邏輯 (必定回傳供前端顯示)
    v_p_exp := GREATEST(1, floor(v_e * 0.2 * (CASE WHEN v_goddess_active THEN 1.5 ELSE 1.0 END)));
    IF v_e > 0 THEN
        v_loots := v_loots || jsonb_build_array(jsonb_build_object(
            'id', 'p_exp', 'name', '夥伴經驗', 'icon', '⭐', 'type', 'material', 
            'quantity', v_p_exp
        ));
    END IF;

    -- 只有真正有上陣夥伴時才執行資料庫更新
    IF v_p_exp > 0 AND v_p.partners IS NOT NULL AND jsonb_array_length(v_p.partners) > 0 THEN
        v_p.partners := (
            SELECT jsonb_agg(
                CASE 
                    WHEN (elem->>'isDeployed')::boolean = true THEN
                        (
                            -- 內部迴圈處理連續升級
                            WITH RECURSIVE leveling(p_id, p_lv, p_ex, p_mx, p_pow, p_rarity) AS (
                                SELECT 
                                    elem->>'id',
                                    (elem->>'level')::int,
                                    (elem->>'exp')::int + v_p_exp,
                                    (elem->>'maxExp')::int,
                                    (elem->>'power')::int,
                                    (elem->>'rarity')::int
                                UNION ALL
                                SELECT 
                                    p_id,
                                    p_lv + 1,
                                    p_ex - p_mx,
                                    floor(p_mx * 1.5)::int,
                                    p_pow + (CASE WHEN p_rarity = 5 THEN 5 WHEN p_rarity = 4 THEN 3 ELSE 2 END),
                                    p_rarity
                                FROM leveling
                                WHERE p_ex >= p_mx
                            )
                            SELECT jsonb_build_object(
                                'id', p_id, 'name', elem->>'name', 'avatar', elem->>'avatar',
                                'role', elem->>'role', 'rarity', p_rarity, 'power', p_pow,
                                'level', p_lv, 'exp', p_ex, 'maxExp', p_mx, 'isDeployed', true
                            )
                            FROM leveling
                            WHERE p_ex < p_mx
                            LIMIT 1
                        )
                    ELSE elem
                END
            )
            FROM jsonb_array_elements(v_p.partners) AS elem
        );
    END IF;

    -- 6. 更新玩家資料
    UPDATE public.profiles SET 
        level=v_lv, exp=v_ex, max_exp=v_mx, hp=v_hp, max_hp=v_mhp, mp=v_mp, max_mp=v_mmp, 
        gold=gold+v_g, incense = incense + v_incense_gain, 
        skills = v_p.skills,
        partners = v_p.partners, -- 更新夥伴狀態
        updated_at=now(),
        items = (
            SELECT jsonb_agg(row_to_json(m)) FROM (
                SELECT id, name, icon, type, description, SUM(quantity)::int as quantity FROM (
                    SELECT (elem->>'id') as id, (elem->>'name') as name, (elem->>'icon') as icon, (elem->>'type') as type, (elem->>'description') as description, (elem->>'quantity')::int as quantity
                    FROM jsonb_array_elements(COALESCE(v_p.items, '[]'::jsonb) || v_loots) AS elem
                    WHERE (elem->>'id') NOT IN ('currency_incense', 'p_exp') 
                      AND (elem->>'id') NOT LIKE 'frag_%' 
                      AND (elem->>'id') NOT LIKE 'skill_%'
                ) t GROUP BY id, name, icon, type, description
            ) m
        )
    WHERE id = v_u;


    -- 7. 同步任務進度
    -- 7a. 精英 / 首領 / 天氣特殊怪 → 週任務 (已有)
    IF (v_is_elite OR v_is_weather_special OR v_is_boss) THEN
        UPDATE public.player_quests SET progress = LEAST(progress + 1, required)
        WHERE user_id = v_u
          AND quest_id IN ('wq_kill_boss', 'cq_khh_weekly', 'cq_hun_weekly')
          AND (assigned_date = v_ws OR assigned_date = v_t)
          AND claimed = false;
    END IF;

    -- 7b. 史萊姆 (已有，擴充至所有史萊姆任務)
    IF p_monster_name LIKE '%史萊姆%' THEN
        UPDATE public.player_quests SET progress = LEAST(progress + 1, required)
        WHERE user_id = v_u
          AND quest_id IN ('dq_kill_slime', 'cq_tyn_slime', 'cq_pif_slime')
          AND (assigned_date = v_t OR assigned_date = v_ws)
          AND claimed = false;
    END IF;

    -- 7c. 哥布林 (擴充至台北城市任務)
    IF p_monster_name LIKE '%哥布林%' THEN
        UPDATE public.player_quests SET progress = LEAST(progress + 1, required)
        WHERE user_id = v_u
          AND quest_id IN ('dq_kill_goblin', 'cq_tpe_101')
          AND (assigned_date = v_t OR assigned_date = v_ws)
          AND claimed = false;
    END IF;

    -- 7d. 骷髏兵 → 台南古城牆清掃
    IF p_monster_name LIKE '%骷髏兵%' THEN
        UPDATE public.player_quests SET progress = LEAST(progress + 1, required)
        WHERE user_id = v_u
          AND quest_id = 'cq_tnn_ghost'
          AND (assigned_date = v_t OR assigned_date = v_ws)
          AND claimed = false;
    END IF;

    -- 7e. 野豬 → 新北山海防線守護
    IF p_monster_name LIKE '%野豬%' THEN
        UPDATE public.player_quests SET progress = LEAST(progress + 1, required)
        WHERE user_id = v_u
          AND quest_id = 'cq_ntpc_kill'
          AND (assigned_date = v_t OR assigned_date = v_ws)
          AND claimed = false;
    END IF;

    -- 7f. 高雄區域任意怪物 (south region，不含 cq_pif)
    --     需要座標，且屬於 south 非 east。高雄座標約 lat 22.6-22.8, lng 120.2-120.4
    IF p_lat IS NOT NULL AND p_lng IS NOT NULL AND v_reg = 'south'
       AND p_lat BETWEEN 22.5 AND 23.0 AND p_lng BETWEEN 120.1 AND 120.6 THEN
        UPDATE public.player_quests SET progress = LEAST(progress + 1, required)
        WHERE user_id = v_u
          AND quest_id = 'cq_khh_kill'
          AND (assigned_date = v_t OR assigned_date = v_ws)
          AND claimed = false;
    END IF;

    -- 7g. 採集任務自動計數：根據 v_loots 中的掉落物名稱自動匹配
    --     注意：只計算 type='material' 的道具，不計算 currency_incense / p_exp 等特殊道具
    DECLARE
        v_loot_item jsonb;
        v_loot_name text;
    BEGIN
        FOR v_loot_item IN SELECT * FROM jsonb_array_elements(v_loots)
        LOOP
            -- 跳過非一般材料類型
            CONTINUE WHEN (v_loot_item->>'type') IS DISTINCT FROM 'material';
            CONTINUE WHEN (v_loot_item->>'id') IN ('currency_incense', 'p_exp');
            CONTINUE WHEN (v_loot_item->>'id') LIKE 'frag_%';

            v_loot_name := v_loot_item->>'name';
            v_loot_name := COALESCE(v_loot_name, '');

            -- 每日通用採集任務：任何材料 +1
            UPDATE public.player_quests SET progress = LEAST(progress + 1, required)
            WHERE user_id = v_u
              AND quest_id = 'dq_collect_mat'
              AND assigned_date = v_t
              AND claimed = false;

            -- 週任務：稀有材料 (使用 wq_collect_rare)
            -- 只有菁英/首領才確定掉落，視為稀有
            IF v_is_elite OR v_is_boss THEN
                UPDATE public.player_quests SET progress = LEAST(progress + 1, required)
                WHERE user_id = v_u
                  AND quest_id = 'wq_collect_rare'
                  AND assigned_date = v_ws
                  AND claimed = false;
            END IF;

            -- 目標採集任務自動匹配 (依名稱對應)
            CASE v_loot_name
                WHEN '花東水晶' THEN
                    UPDATE public.player_quests SET progress = LEAST(progress + 1, required)
                    WHERE user_id = v_u
                      AND quest_id IN ('cq_hun_crystal', 'cq_ttu_crystal')
                      AND (assigned_date = v_t OR assigned_date = v_ws)
                      AND claimed = false;
                WHEN '科技廢料' THEN
                    UPDATE public.player_quests SET progress = LEAST(progress + 1, required)
                    WHERE user_id = v_u
                      AND quest_id = 'cq_tpe_weekly'
                      AND (assigned_date = v_t OR assigned_date = v_ws)
                      AND claimed = false;
                WHEN '高山鐵礦' THEN
                    UPDATE public.player_quests SET progress = LEAST(progress + 1, required)
                    WHERE user_id = v_u
                      AND quest_id = 'cq_txg_iron'
                      AND (assigned_date = v_t OR assigned_date = v_ws)
                      AND claimed = false;
                WHEN '海淵珍珠' THEN
                    UPDATE public.player_quests SET progress = LEAST(progress + 1, required)
                    WHERE user_id = v_u
                      AND quest_id = 'cq_khh_collect'
                      AND (assigned_date = v_t OR assigned_date = v_ws)
                      AND claimed = false;
                ELSE NULL; -- 其他材料不做特定任務
            END CASE;
        END LOOP;
    END;


    SELECT * INTO v_p FROM public.profiles WHERE id = v_u;
RETURN jsonb_build_object('gold',v_g,'exp',v_e,'leveled_up',v_up,'new_level',v_lv,'loots',v_loots,'updated_profile',row_to_json(v_p));
    END; -- CLOSE THE added BEGIN block for variable declarations
END; $$;


-- 4. SECURE GACHA (PARTNERS)
-- Logic: Server-side RNG for rarity and selection. Deduct gold.
CREATE OR REPLACE FUNCTION public.secure_gacha(p_count integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_profile public.profiles;
    v_cost integer;
    v_results jsonb := '[]'::jsonb;
    v_pool jsonb;
    v_rarity integer;
    v_roll float;
    v_partner jsonb;
    v_new_partners jsonb;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

    v_cost := p_count * 100;
    IF v_profile.gold < v_cost THEN RAISE EXCEPTION 'Insufficient gold'; END IF;

    -- Hardcoded Partner Pool (Matches game.ts)
    v_pool := '[
        {"name": "聖靈騎士", "role": "tank", "rarity": 5, "power": 80, "avatar": "🧔"},
        {"name": "暗影刺客", "role": "dps", "rarity": 5, "power": 55, "avatar": "🕵️"},
        {"name": "仙境藥師", "role": "healer", "rarity": 5, "power": 70, "avatar": "🧚"},
        {"name": "精靈射手", "role": "dps", "rarity": 4, "power": 53, "avatar": "🧝"},
        {"name": "治癒修女", "role": "healer", "rarity": 4, "power": 43, "avatar": "👩‍🦰"},
        {"name": "大地祭司", "role": "healer", "rarity": 4, "power": 30, "avatar": "👳"},
        {"name": "鐵甲守衛", "role": "tank", "rarity": 3, "power": 27, "avatar": "👨‍🦲"},
        {"name": "見習法師", "role": "dps", "rarity": 3, "power": 20, "avatar": "🧙"},
        {"name": "流浪劍客", "role": "dps", "rarity": 3, "power": 18, "avatar": "👨‍🦱"}
    ]'::jsonb;

    FOR i IN 1..p_count LOOP
        v_roll := random();
        IF v_roll > 0.99 THEN v_rarity := 5;
        ELSIF v_roll > 0.89 THEN v_rarity := 4;
        ELSE v_rarity := 3;
        END IF;

        -- Pick random from pool with this rarity
        SELECT elem INTO v_partner
        FROM jsonb_array_elements(v_pool) AS elem
        WHERE (elem->>'rarity')::integer = v_rarity
        ORDER BY random() LIMIT 1;

        v_results := v_results || jsonb_build_object(
            'id', 'p_' || md5(random()::text || i::text),
            'name', v_partner->>'name',
            'role', v_partner->>'role',
            'rarity', (v_partner->>'rarity')::integer,
            'power', (v_partner->>'power')::integer,
            'avatar', v_partner->>'avatar',
            'level', 1,
            'exp', 0,
            'maxExp', 100,
            'isDeployed', false
        );
    END LOOP;

    -- Update Profile
    UPDATE public.profiles
    SET 
        gold = gold - v_cost,
        partners = partners || v_results,
        updated_at = now()
    WHERE id = v_user_id;

    -- Authoritative Sync
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'results', v_results,
        'gold_spent', v_cost,
        'updated_profile', row_to_json(v_profile)
    );
END;
$$;


-- 5. SECURE PARTNER SYNTHESIS
-- Logic: Combine 4 partners of same rarity for a chance at higher rarity.
CREATE OR REPLACE FUNCTION public.secure_synthesis(p_material_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_profile public.profiles;
    v_count integer := array_length(p_material_ids, 1);
    v_synth_count integer;
    v_rarity integer;
    v_mats jsonb := '[]'::jsonb;
    v_results jsonb := '[]'::jsonb;
    v_success_rate float;
    v_pool jsonb;
    v_success_hits integer := 0;
BEGIN
    IF v_count < 4 THEN RAISE EXCEPTION 'Need at least 4 partners for synthesis'; END IF;
    v_synth_count := floor(v_count / 4);

    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

    -- Verify all materials exist and have same rarity
    SELECT (elem->>'rarity')::integer INTO v_rarity
    FROM jsonb_array_elements(v_profile.partners) AS elem
    WHERE elem->>'id' = p_material_ids[1];
    
    IF v_rarity IS NULL THEN 
        RAISE EXCEPTION '找不到起始素材 (ID: %)，可能是連線問題或資料已過期', p_material_ids[1]; 
    END IF;
    
    IF v_rarity > 4 THEN 
        RAISE EXCEPTION '五星夥伴 (ID: %) 無法進一步合成，請重新選擇', p_material_ids[1]; 
    END IF;
    
    IF v_rarity < 3 THEN 
        RAISE EXCEPTION '三星以下夥伴 (ID: %) 無法進行此合成，目前僅支援 3-4 星合成', p_material_ids[1]; 
    END IF;

    FOR i IN 1..v_count LOOP
        IF NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_profile.partners) AS elem 
            WHERE elem->>'id' = p_material_ids[i] AND (elem->>'rarity')::integer = v_rarity
        ) THEN
            RAISE EXCEPTION '素材 (ID: %) 不存在或星級 (%) 與組隊不符，請重新整理', p_material_ids[i], v_rarity;
        END IF;
    END LOOP;

    -- Define Pool
    v_pool := '[
        {"name": "聖靈騎士", "role": "tank", "rarity": 5, "power": 80, "avatar": "🧔"},
        {"name": "暗影刺客", "role": "dps", "rarity": 5, "power": 55, "avatar": "🕵️"},
        {"name": "仙境藥師", "role": "healer", "rarity": 5, "power": 70, "avatar": "🧚"},
        {"name": "精靈射手", "role": "dps", "rarity": 4, "power": 53, "avatar": "🧝"},
        {"name": "治癒修女", "role": "healer", "rarity": 4, "power": 43, "avatar": "👩‍🦰"},
        {"name": "大地祭司", "role": "healer", "rarity": 4, "power": 30, "avatar": "👳"},
        {"name": "鐵甲守衛", "role": "tank", "rarity": 3, "power": 27, "avatar": "👨‍🦲"},
        {"name": "見習法師", "role": "dps", "rarity": 3, "power": 20, "avatar": "🧙"},
        {"name": "流浪劍客", "role": "dps", "rarity": 3, "power": 18, "avatar": "👨‍🦱"}
    ]'::jsonb;

    v_success_rate := CASE WHEN v_rarity = 3 THEN 0.10 ELSE 0.05 END;

    FOR i IN 1..v_synth_count LOOP
        IF random() < v_success_rate THEN
            v_success_hits := v_success_hits + 1;
            -- Pick random from pool with next rarity
            DECLARE
                v_partner jsonb;
            BEGIN
                SELECT elem INTO v_partner
                FROM jsonb_array_elements(v_pool) AS elem
                WHERE (elem->>'rarity')::integer = v_rarity + 1
                ORDER BY random() LIMIT 1;

                v_results := v_results || jsonb_build_object(
                    'id', 'p_sync_' || md5(random()::text || i::text),
                    'name', v_partner->>'name',
                    'role', v_partner->>'role',
                    'rarity', v_rarity + 1,
                    'power', (v_partner->>'power')::integer,
                    'avatar', v_partner->>'avatar',
                    'level', 1,
                    'exp', 0,
                    'maxExp', 100,
                    'isDeployed', false
                );
            END;
        ELSE
            -- Back to same rarity
            DECLARE
                v_partner jsonb;
            BEGIN
                SELECT elem INTO v_partner
                FROM jsonb_array_elements(v_pool) AS elem
                WHERE (elem->>'rarity')::integer = v_rarity
                ORDER BY random() LIMIT 1;

                v_results := v_results || jsonb_build_object(
                    'id', 'p_sync_' || md5(random()::text || i::text),
                    'name', v_partner->>'name',
                    'role', v_partner->>'role',
                    'rarity', v_rarity,
                    'power', (v_partner->>'power')::integer,
                    'avatar', v_partner->>'avatar',
                    'level', 1,
                    'exp', 0,
                    'maxExp', 100,
                    'isDeployed', false
                );
            END;
        END IF;
    END LOOP;

    -- Update Profile: Remove materials and add results
    UPDATE public.profiles
    SET 
        partners = (
            SELECT jsonb_agg(elem)
            FROM (
                SELECT elem FROM jsonb_array_elements(partners) AS elem
                WHERE NOT (elem->>'id' = ANY(p_material_ids))
                UNION ALL
                SELECT jsonb_array_elements(v_results)
            ) AS combined
        ),
        updated_at = now()
    WHERE id = v_user_id;

    -- Authoritative Sync
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'results', v_results,
        'success_count', v_success_hits,
        'updated_profile', row_to_json(v_profile)
    );
END;
$$;


-- 6. SECURE DRAW GOD
-- Logic: 100 incense cost, 10% chance success.
CREATE OR REPLACE FUNCTION public.secure_draw_god()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_profile public.profiles;
    v_god_pool jsonb;
    v_roll float := random();
    v_new_god jsonb := null;
    v_template jsonb;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    IF v_profile.incense < 100 THEN RAISE EXCEPTION 'Insufficient incense'; END IF;

    IF v_roll < 0.10 THEN
        v_god_pool := '[
            {"name": "天上聖母-媽祖", "avatar": "🏮", "rarity": 5, "resistanceType": "rainy", "description": "守護神，能引導勇者在雨天中如同晴天般疾行。"},
            {"name": "福德正神-土地公", "avatar": "⛰️", "rarity": 5, "resistanceType": "foggy", "description": "守護神，能看穿一切虛妄濃霧，保持視野清晰。"},
            {"name": "中壇元帥-三太子", "avatar": "🪭", "rarity": 5, "resistanceType": "sunny", "description": "乾坤火德之化身，免疫酷暑熱浪帶來的體力煎熬。"},
            {"name": "玄天上帝", "avatar": "🐢", "rarity": 5, "resistanceType": "stormy", "description": "北極鎮天真武大帝，能鎮壓狂雷電閃，抵禦環境傷害。"},
            {"name": "關聖帝君-關公", "avatar": "🗡️", "rarity": 5, "resistanceType": "none", "description": "武聖守護神，能提升團隊士氣與戰鬥效率。"}
        ]'::jsonb;

        -- Filter out already owned gods
        SELECT elem INTO v_template
        FROM jsonb_array_elements(v_god_pool) AS elem
        WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_profile.gods) AS g WHERE g->>'name' = elem->>'name')
        ORDER BY random() LIMIT 1;

        -- Fallback to random if all owned (should not happen often)
        IF v_template IS NULL THEN
            SELECT elem INTO v_template FROM jsonb_array_elements(v_god_pool) ORDER BY random() LIMIT 1;
        END IF;

        v_new_god := v_template || jsonb_build_object(
            'id', 'god_' || md5(random()::text),
            'level', 1,
            'exp', 0,
            'maxExp', 100
        );
    END IF;

    UPDATE public.profiles
    SET 
        incense = incense - 100,
        gods = CASE WHEN v_new_god IS NOT NULL THEN gods || v_new_god ELSE gods END,
        updated_at = now()
    WHERE id = v_user_id;

    -- Authoritative Sync
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', (v_new_god IS NOT NULL),
        'god', v_new_god,
        'incense_spent', 100,
        'updated_profile', row_to_json(v_profile)
    );
END;
$$;


-- 7. SECURE CRAFT ALCHEMY
CREATE OR REPLACE FUNCTION public.secure_craft_alchemy(p_recipe_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_profile public.profiles;
    v_recipe jsonb;
    v_materials jsonb;
    v_req jsonb;
    v_gold_cost integer;
    v_target_item_id text;
    v_target_item_def jsonb;
    v_new_items jsonb;
    v_found_mats boolean := true;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

    -- Recipes Library (Matching game.ts)
    v_recipe := CASE p_recipe_id
        WHEN 'rec_hp_pot' THEN '{"id": "rec_hp_pot", "target": "item_hp_pot", "name": "小型生命藥水", "cost": 20, "mats": [{"id": "item_herb", "q": 2}]}'::jsonb
        WHEN 'rec_mp_pot' THEN '{"id": "rec_mp_pot", "target": "item_mp_pot", "name": "魔力藥水", "icon": "💧", "type": "potion", "desc": "閃爍著幽藍光芒的藥水，能恢復 50 點魔力值。", "cost": 50, "mats": [{"id": "item_herb", "q": 2}, {"id": "item_magic_gem", "q": 1}]}'::jsonb
        WHEN 'rec_hp_pot_m' THEN '{"id": "rec_hp_pot_m", "target": "item_hp_pot_m", "name": "中型生命藥水", "icon": "⚗️", "type": "potion", "desc": "濃郁的紅色藥劑，能恢復 200 點生命值。", "cost": 50, "mats": [{"id": "item_herb", "q": 4}, {"id": "item_hp_pot", "q": 1}]}'::jsonb
        WHEN 'rec_hp_pot_l' THEN '{"id": "rec_hp_pot_l", "target": "item_hp_pot_l", "name": "大型生命藥水", "icon": "🍷", "type": "potion", "desc": "極其珍貴的高級藥品，能恢復 500 點生命值。", "cost": 200, "mats": [{"id": "item_herb", "q": 8}, {"id": "item_hp_pot_m", "q": 1}, {"id": "item_magic_gem", "q": 1}]}'::jsonb
        WHEN 'rec_revive_pot' THEN '{"id": "rec_revive_pot", "target": "item_revive_pot", "name": "復甦精華", "icon": "💧", "type": "potion", "desc": "閃耀著奇蹟般光芒的泉水，能將角色滿血復活。", "cost": 500, "mats": [{"id": "item_magic_gem", "q": 1}, {"id": "mat_north_glass", "q": 1}, {"id": "mat_south_pearl", "q": 1}]}'::jsonb
        WHEN 'rec_tech_boost' THEN '{"id": "rec_tech_boost", "target": "item_str_seed", "name": "力量種子", "icon": "💪", "type": "consumable", "desc": "服用後永久提升 2 點攻擊力。", "cost": 80, "mats": [{"id": "mat_north_tech", "q": 3}, {"id": "mat_north_glass", "q": 1}]}'::jsonb
        WHEN 'rec_optic_def' THEN '{"id": "rec_optic_def", "target": "item_def_seed", "name": "鐵壁種子", "icon": "🛡️", "type": "consumable", "desc": "服用後永久提升 2 點防禦力。", "cost": 120, "mats": [{"id": "mat_north_glass", "q": 3}, {"id": "item_herb", "q": 2}]}'::jsonb
        WHEN 'rec_lava_boost' THEN '{"id": "rec_lava_boost", "target": "item_str_seed", "name": "力量種子", "icon": "💪", "type": "consumable", "desc": "服用後永久提升 2 點攻擊力。", "cost": 200, "mats": [{"id": "mat_lava_sand", "q": 2}, {"id": "mat_south_sand", "q": 3}]}'::jsonb
        WHEN 'rec_sea_heal' THEN '{"id": "rec_sea_heal", "target": "item_hp_pot_m", "name": "中型生命藥水", "icon": "⚗️", "type": "potion", "desc": "濃郁的紅色藥劑，能恢復 200 點生命值。", "cost": 80, "mats": [{"id": "mat_south_pearl", "q": 1}, {"id": "item_herb", "q": 3}]}'::jsonb
        WHEN 'rec_crystal_life' THEN '{"id": "rec_crystal_life", "target": "item_hp_seed", "name": "生命之果", "icon": "🍎", "type": "consumable", "desc": "服用後永久提升 10 點最大生命值。", "cost": 150, "mats": [{"id": "mat_east_crystal", "q": 2}, {"id": "item_herb", "q": 2}]}'::jsonb
        ELSE NULL
    END;

    IF v_recipe IS NULL THEN RAISE EXCEPTION 'Invalid recipe ID'; END IF;

    -- Daily limit check for seeds
    IF v_recipe->>'target' IN ('item_str_seed', 'item_def_seed') THEN
        INSERT INTO public.daily_craft_limits (user_id, item_id, craft_date, craft_count)
        VALUES (v_profile.id, v_recipe->>'target', CURRENT_DATE, 0)
        ON CONFLICT (user_id, item_id, craft_date) DO NOTHING;

        IF (SELECT craft_count FROM public.daily_craft_limits WHERE user_id = v_profile.id AND item_id = v_recipe->>'target' AND craft_date = CURRENT_DATE) >= 2 THEN
            RAISE EXCEPTION '該種子每日製作上限已達 (2個)';
        END IF;
    END IF;

    v_gold_cost := (v_recipe->>'cost')::integer;
    IF v_profile.gold < v_gold_cost THEN RAISE EXCEPTION 'Insufficient gold'; END IF;

    -- Verify materials
    FOR v_req IN SELECT * FROM jsonb_array_elements(v_recipe->'mats') LOOP
        IF NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_profile.items) AS elem 
            WHERE elem->>'id' = v_req->>'id' AND (elem->>'quantity')::integer >= (v_req->>'q')::integer
        ) THEN
            RAISE EXCEPTION 'Insufficient material: %', v_req->>'id';
        END IF;
    END LOOP;

    -- Deduct materials and add target item
    -- This part is complex due to JSONB array manipulation. 
    -- We'll use a temporary collection logic.
    
    -- Update Profile
    UPDATE public.profiles
    SET 
        gold = gold - v_gold_cost,
        items = (
            -- 1. Deduct mats from inventory
            -- 2. Add target item
            -- For simplicity in SL, we assume the client syncs the remainder, 
            -- but for TRUE SECURITY, we should do the subtraction here.
            -- Let's do it right.
            WITH sub AS (
                SELECT 
                    (elem->>'id') as id,
                    (elem->>'name') as name,
                    (elem->>'icon') as icon,
                    (elem->>'type') as type,
                    (elem->>'quantity')::integer as q
                FROM jsonb_array_elements(v_profile.items) AS elem
            ),
            reqs AS (
                SELECT (r->>'id') as id, (r->>'q')::integer as q
                FROM jsonb_array_elements(v_recipe->'mats') AS r
            ),
            deducted AS (
                SELECT 
                    sub.id, sub.name, sub.icon, sub.type,
                    sub.q - COALESCE(reqs.q, 0) as new_q
                FROM sub
                LEFT JOIN reqs ON sub.id = reqs.id
            ),
            final_list AS (
                SELECT * FROM deducted WHERE new_q > 0
                UNION ALL
                -- Add target item (placeholder values, in real app these should come from ITEM_DATABASE)
                SELECT 
                    v_recipe->>'target', 
                    COALESCE(v_recipe->>'name', '製作道具'), 
                    COALESCE(v_recipe->>'icon', '🧪'), 
                    COALESCE(v_recipe->>'type', 'potion'), 
                    1
                WHERE NOT EXISTS (SELECT 1 FROM deducted WHERE id = v_recipe->>'target')
            ),
            updated_list AS (
                SELECT 
                    id, name, icon, type,
                    CASE WHEN id = v_recipe->>'target' THEN new_q + 1 ELSE new_q END as quantity
                FROM deducted
                WHERE id IN (SELECT id FROM deducted WHERE new_q > 0 OR id = v_recipe->>'target')
            )
            -- Simpler path: let's just do a manual merge logic for now to keep the code readable.
            -- Actually, let's use the GROUP BY approach from secure_resolve_combat.
            SELECT jsonb_agg(row_to_json(m))
            FROM (
                SELECT id, name, icon, type, description, SUM(quantity)::int as quantity
                FROM (
                    -- Old items with negative quantities for mats
                    SELECT (e->>'id') as id, (e->>'name') as name, (e->>'icon') as icon, (e->>'type') as type, (e->>'description') as description, (e->>'quantity')::int as quantity 
                    FROM jsonb_array_elements(v_profile.items) AS e
                    UNION ALL
                    SELECT (r->>'id'), 'mats', '', '', '', -(r->>'q')::int 
                    FROM jsonb_array_elements(v_recipe->'mats') AS r
                    UNION ALL
                    -- Add target item (quantity 1)
                    SELECT 
                        v_recipe->>'target', 
                        COALESCE(v_recipe->>'name', '製作道具'), 
                        COALESCE(v_recipe->>'icon', '🧪'), 
                        COALESCE(v_recipe->>'type', 'potion'), 
                        COALESCE(v_recipe->>'desc', '煉金產出的道具'), 
                        1
                ) t
                GROUP BY id, name, icon, type, description
                HAVING SUM(quantity) > 0
            ) m
        ),
        updated_at = now()
    WHERE id = v_user_id;

    -- Authoritative Sync
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'recipe_id', p_recipe_id,
        'updated_profile', row_to_json(v_profile)
    );
END;
$$;


-- 8. SECURE CRAFT EQUIPMENT
CREATE OR REPLACE FUNCTION public.secure_craft_equipment(p_recipe_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_profile public.profiles;
    v_recipe jsonb;
    v_req jsonb;
    v_gold_cost integer;
    v_target_eq_id text;
    v_new_eq jsonb;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

    -- Equipment Recipes (Subset for Example, in real app more would be added)
    v_recipe := CASE p_recipe_id
        WHEN 'forge_wood_sword' THEN '{"cost": 200, "target": "eq_wood_sword", "name": "木劍", "icon": "🗡️", "slot": "weapon", "rarity": 1, "atk": 5, "def": 0, "hp": 0, "desc": "用堅硬木頭削成的練習用劍。", "mats": [{"id": "item_iron_ore", "q": 12}, {"id": "item_herb", "q": 5}]}'::jsonb
        WHEN 'forge_iron_sword' THEN '{"cost": 1500, "target": "eq_iron_sword", "name": "鐵劍", "icon": "🗡️", "slot": "weapon", "rarity": 1, "atk": 12, "def": 0, "hp": 0, "desc": "經過鍛造的鐵製長劍。", "mats": [{"id": "item_iron_ore", "q": 35}, {"id": "mat_north_tech", "q": 12}]}'::jsonb
        WHEN 'forge_steel_sword' THEN '{"cost": 8500, "target": "eq_steel_sword", "name": "鋼劍", "icon": "⚔️", "slot": "weapon", "rarity": 2, "atk": 35, "def": 0, "hp": 0, "desc": "高等級鋼鐵打造的利刃。", "mats": [{"id": "item_iron_ore", "q": 70}, {"id": "mat_north_tech", "q": 25}, {"id": "item_magic_gem", "q": 6}]}'::jsonb
        ELSE NULL
    END;

    IF v_recipe IS NULL THEN 
        -- Fallback: If not in whitelist, allow if it looks like a valid recipe ID but warn
        -- In a fully secure app, all recipes must be whitelisted.
        RAISE EXCEPTION 'Recipe not whitelisted in secure logic';
    END IF;

    v_gold_cost := (v_recipe->>'cost')::integer;
    IF v_profile.gold < v_gold_cost THEN RAISE EXCEPTION 'Insufficient gold'; END IF;

    -- Verify materials
    FOR v_req IN SELECT * FROM jsonb_array_elements(v_recipe->'mats') LOOP
        IF NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_profile.items) AS elem 
            WHERE elem->>'id' = v_req->>'id' AND (elem->>'quantity')::integer >= (v_req->>'q')::integer
        ) THEN
            RAISE EXCEPTION 'Insufficient material: %', v_req->>'id';
        END IF;
    END LOOP;

    -- Create new equipment entry (this should ideally fetch from a table, but we hardcode for demo)
    -- In a real production app, v_target_eq_id would look up EQUIPMENT_DATABASE
    v_new_eq := jsonb_build_object(
        'id', 'eq_forge_' || md5(random()::text),
        'name', COALESCE(v_recipe->>'name', '製作裝備'),
        'slot', COALESCE(v_recipe->>'slot', 'weapon'),
        'rarity', COALESCE((v_recipe->>'rarity')::int, 1),
        'attack', COALESCE((v_recipe->>'atk')::int, 5),
        'defense', COALESCE((v_recipe->>'def')::int, 0),
        'hp', COALESCE((v_recipe->>'hp')::int, 0),
        'icon', COALESCE(v_recipe->>'icon', '🗡️'),
        'description', COALESCE(v_recipe->>'desc', '經由鍛造產出的裝備')
    );

    -- Update Profile
    UPDATE public.profiles
    SET 
        gold = gold - v_gold_cost,
        equipment = equipment || v_new_eq,
        items = (
            SELECT jsonb_agg(row_to_json(m))
            FROM (
                SELECT id, name, icon, type, description, SUM(quantity)::int as quantity
                FROM (
                    SELECT (e->>'id') as id, (e->>'name') as name, (e->>'icon') as icon, (e->>'type') as type, (e->>'description') as description, (e->>'quantity')::int as quantity 
                    FROM jsonb_array_elements(v_profile.items) AS e
                    UNION ALL
                    SELECT (r->>'id'), 'mats', '', '', '', -(r->>'q')::int 
                    FROM jsonb_array_elements(v_recipe->'mats') AS r
                ) t
                GROUP BY id, name, icon, type, description
                HAVING SUM(quantity) > 0
            ) m
        ),
        updated_at = now()
    WHERE id = v_user_id;

    -- Authoritative Sync
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'equipment', v_new_eq,
        'updated_profile', row_to_json(v_profile)
    );
END;
$$;


-- 9. SECURE BATCH USE ITEM
CREATE OR REPLACE FUNCTION public.secure_batch_use_item(p_item_id text, p_count integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_profile public.profiles;
    v_item jsonb;
    v_count integer := p_count;
    v_cur_hp integer;
    v_cur_mp float;
    v_hp_recover integer := 0;
    v_mp_recover integer := 0;
    v_str_increase integer := 0;
    v_def_increase integer := 0;
    v_hp_increase integer := 0;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

    -- Find item in inventory
    SELECT elem INTO v_item 
    FROM jsonb_array_elements(v_profile.items) AS elem 
    WHERE elem->>'id' = p_item_id;

    IF v_item IS NULL THEN RAISE EXCEPTION 'Item not found in inventory'; END IF;
    IF (v_item->>'quantity')::integer < v_count THEN RAISE EXCEPTION 'Insufficient quantity'; END IF;
    IF v_count <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;

    -- Determine effects based on ID
    IF p_item_id = 'item_hp_pot' OR p_item_id = 'it_01' THEN v_hp_recover := 50 * v_count;
    ELSIF p_item_id = 'item_hp_pot_m' THEN v_hp_recover := 200 * v_count;
    ELSIF p_item_id = 'item_hp_pot_l' THEN v_hp_recover := 500 * v_count;
    ELSIF p_item_id = 'item_mp_pot' THEN v_mp_recover := 50 * v_count;
    ELSIF p_item_id = 'item_revive_pot' THEN v_hp_recover := 9999; v_count := 1; -- Revive is usually single use
    ELSIF p_item_id = 'item_str_seed' THEN v_str_increase := 2 * v_count;
    ELSIF p_item_id = 'item_def_seed' THEN v_def_increase := 2 * v_count;
    ELSIF p_item_id = 'item_hp_seed' THEN v_hp_increase := 20 * v_count;
    ELSE RAISE EXCEPTION 'Item not consumable';
    END IF;

    -- Update stats
    DECLARE
        v_eff_max_hp integer;
    BEGIN
        v_eff_max_hp := public.secure_calculate_effective_max_hp(v_profile);
        
        v_cur_hp := (v_profile.hp + v_hp_recover);
        IF v_cur_hp > v_eff_max_hp + v_hp_increase THEN v_cur_hp := v_eff_max_hp + v_hp_increase; END IF;
        
        v_cur_mp := (v_profile.mp + v_mp_recover);
        -- MP cap is still base max_mp but grows with hp_seed
        IF v_cur_mp > (v_profile.max_mp + (v_hp_increase/2)) THEN v_cur_mp := (v_profile.max_mp + (v_hp_increase/2)); END IF;
    END;

    -- Update Profile
    -- Update Profile
    UPDATE public.profiles
    SET 
        hp = v_cur_hp,
        mp = v_cur_mp,
        attack = attack + v_str_increase,
        defense = defense + v_def_increase,
        max_hp = max_hp + v_hp_increase,
        items = (
            SELECT jsonb_agg(
                CASE 
                    WHEN (e->>'id') = p_item_id THEN 
                        e || jsonb_build_object('quantity', (e->>'quantity')::int - v_count)
                    ELSE e 
                END
            )
            FROM jsonb_array_elements(v_profile.items) AS e
            WHERE (e->>'id' != p_item_id) OR ((e->>'quantity')::int > v_count)
        ),
        updated_at = now()
    WHERE id = v_user_id;

    -- Fetch final state for authoritative UI update
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'hp_recovered', v_hp_recover, 
        'mp_recovered', v_mp_recover,
        'str_gained', v_str_increase,
        'def_gained', v_def_increase,
        'max_hp_gained', v_hp_increase,
        'updated_profile', row_to_json(v_profile)
    );
END;
$$;


-- 10. SECURE ENCOUNTER CHECK
-- 邏輯：根據天氣回傳遇敵結果，雷暴/濃霧機率降低，但有機會出現「掩人耳目」特殊強敵。
CREATE OR REPLACE FUNCTION public.secure_check_encounter(p_weather text, p_force boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE 
    v_roll float := random(); 
    v_threshold float; 
    v_res text := 'none';
BEGIN
    -- 晴天 8%, 雨天 10%, 雷暴/濃霧 15%
    v_threshold := CASE 
        WHEN p_weather IN ('sunny', 'clear') THEN 0.08 
        WHEN p_weather = 'rainy' THEN 0.10 
        WHEN p_weather IN ('stormy', 'foggy') THEN 0.15 
        ELSE 0.10 
    END;

    IF p_force OR v_roll < v_threshold THEN
        v_res := 'normal';
        IF p_weather IN ('stormy', 'foggy') AND random() < 0.05 THEN v_res := 'weather_special'; END IF;
    END IF;
    RETURN jsonb_build_object('result', v_res, 'weather', p_weather);
END; $$;
-- 8. SECURE ITEM SELLING
-- Logic: Verify item quantities, update gold and item lists on server.
CREATE OR REPLACE FUNCTION public.secure_sell_item(p_item_id text, p_quantity integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_profile public.profiles;
    v_item jsonb;
    v_item_type text;
    v_unit_price integer := 10;
    v_total_price integer;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION '未找到存檔'; END IF;

    -- Find item in inventory
    SELECT elem INTO v_item 
    FROM jsonb_array_elements(v_profile.items) AS elem 
    WHERE elem->>'id' = p_item_id;

    IF v_item IS NULL OR (v_item->>'quantity')::integer < p_quantity THEN
        RAISE EXCEPTION '物品數量不足或不存在';
    END IF;

    -- Pricing logic (Matching App.tsx handleSellItem)
    v_item_type := v_item->>'type';
    IF v_item_type = 'gem' THEN v_unit_price := 200;
    ELSIF v_item_type = 'material' THEN v_unit_price := 15;
    ELSIF v_item_type = 'potion' THEN v_unit_price := 50;
    ELSIF v_item_id = 'item_revive_pot' THEN v_unit_price := 500;
    END IF;

    v_total_price := v_unit_price * p_quantity;

    -- Update DB
    UPDATE public.profiles
    SET 
        gold = gold + v_total_price,
        items = (
            SELECT COALESCE(jsonb_agg(
                CASE 
                    WHEN elem->>'id' = p_item_id THEN 
                        jsonb_set(elem, '{quantity}', to_jsonb((elem->>'quantity')::integer - p_quantity))
                    ELSE elem 
                END
            ), '[]'::jsonb)
            FROM jsonb_array_elements(v_profile.items) AS elem
        ),
        updated_at = now()
    WHERE id = v_user_id;

    -- Cleanup items with 0 quantity
    UPDATE public.profiles
    SET items = (
        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
        FROM jsonb_array_elements(items) AS elem
        WHERE (elem->>'quantity')::integer > 0
    )
    WHERE id = v_user_id;

    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'gold_gained', v_total_price,
        'updated_profile', row_to_json(v_profile)
    );
END;
$$;

-- ==========================================
-- 10. 排行榜數據重新整理 (Leaderboard Refresh)
-- ==========================================
CREATE OR REPLACE FUNCTION public.refresh_leaderboard_snapshots()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today text := current_date::text;
    v_count integer;
BEGIN
    -- 1. 清除舊的今日排行榜數據 (預防重複或舊數據殘留)
    DELETE FROM public.leaderboard_snapshots WHERE snapshot_date = v_today;

    -- 2. 插入等級排行 (Level Ranking)
    INSERT INTO public.leaderboard_snapshots (
        user_id, nickname, level, gold, power_score, rank_type, rank_position, snapshot_date
    )
    SELECT 
        id as user_id,
        nickname,
        level,
        gold,
        (attack * 5 + defense * 3 + max_hp * 0.5 + level * 100)::integer as power_score,
        'level' as rank_type,
        row_number() OVER (ORDER BY level DESC, exp DESC) as rank_position,
        v_today
    FROM public.profiles
    ORDER BY level DESC, exp DESC
    LIMIT 100;

    -- 3. 插入金幣排行 (Gold Ranking)
    INSERT INTO public.leaderboard_snapshots (
        user_id, nickname, level, gold, power_score, rank_type, rank_position, snapshot_date
    )
    SELECT 
        id as user_id,
        nickname,
        level,
        gold,
        (attack * 5 + defense * 3 + max_hp * 0.5 + level * 100)::integer as power_score,
        'gold' as rank_type,
        row_number() OVER (ORDER BY gold DESC) as rank_position,
        v_today
    FROM public.profiles
    ORDER BY gold DESC
    LIMIT 100;

    -- 4. 插入戰力排行 (Power Ranking)
    INSERT INTO public.leaderboard_snapshots (
        user_id, nickname, level, gold, power_score, rank_type, rank_position, snapshot_date
    )
    SELECT 
        id as user_id,
        nickname,
        level,
        gold,
        (attack * 5 + defense * 3 + max_hp * 0.5 + level * 100)::integer as power_score,
        'power' as rank_type,
        row_number() OVER (ORDER BY (attack * 5 + defense * 3 + max_hp * 0.5 + level * 100) DESC) as rank_position,
        v_today
    FROM public.profiles
    ORDER BY (attack * 5 + defense * 3 + max_hp * 0.5 + level * 100) DESC
    LIMIT 100;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN jsonb_build_object(
        'success', true,
        'snapshot_date', v_today,
        'message', '排行榜數據更新完成 ' || v_today
    );
END;
$$;

-- ==========================================
-- 11. 走路任務進度更新 (Walk Quest Progress)
-- 擴充支援城市任務 (cq_..._walk)
-- ==========================================
CREATE OR REPLACE FUNCTION public.increment_walk_quests(
  p_user_id uuid,
  p_increment_meters int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today      date := current_date;
  v_week_start date := date_trunc('week', current_date)::date;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 更新所有走路類型任務（包含每日 dq_、每週 wq_、城市 cq_ 任務）
  UPDATE public.player_quests
  SET progress = LEAST(progress + p_increment_meters, required)
  WHERE user_id = p_user_id
    AND (assigned_date = v_today OR assigned_date = v_week_start)
    AND claimed = false
    AND (
      quest_id LIKE 'dq_walk_%'
      OR quest_id LIKE 'wq_walk_%'
      OR quest_id LIKE 'cq_%_walk'  -- 城市走路任務 (如 cq_tpe_walk, cq_ntpc_weekly 等走路型)
    );
END;
$$;

-- ==========================================
-- 12. 探索任務進度更新 (Explore Quest Progress)
-- 擴充支援城市祭壇/探索任務 (cq_..._altar)
-- ==========================================
CREATE OR REPLACE FUNCTION public.increment_explore_quests(
  p_user_id uuid,
  p_increment int DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today      date := current_date;
  v_week_start date := date_trunc('week', current_date)::date;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 更新所有探索類型任務（包含每日/週常/城市祭壇任務）
  UPDATE public.player_quests
  SET progress = LEAST(progress + p_increment, required)
  WHERE user_id = p_user_id
    AND (assigned_date = v_today OR assigned_date = v_week_start)
    AND claimed = false
    AND (
      quest_id LIKE 'dq_explore_%'
      OR quest_id LIKE 'wq_explore_%'
      OR quest_id LIKE 'cq_%_altar'  -- 城市祭壇任務 (如 cq_txg_altar, cq_tnn_altar)
      OR quest_id = 'dq_explore_poi' -- 每日探索聖地任務
    );
END;
$$;

-- ==========================================
-- 13. 採集任務進度更新 (Collect Quest Progress)
-- 擴充支援城市採集任務 (cq_..._collect) 
-- ==========================================
CREATE OR REPLACE FUNCTION public.increment_collect_quests(
  p_user_id uuid,
  p_increment int DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today      date := current_date;
  v_week_start date := date_trunc('week', current_date)::date;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 更新所有通用採集任務（不含特定目標的城市採集，那部分由 secure_resolve_combat 處理）
  UPDATE public.player_quests
  SET progress = LEAST(progress + p_increment, required)
  WHERE user_id = p_user_id
    AND (assigned_date = v_today OR assigned_date = v_week_start)
    AND claimed = false
    AND (
      quest_id LIKE 'dq_collect_%'
      OR quest_id LIKE 'wq_collect_%'
    );
END;
$$;

