-- ==========================================
-- SECURITY MIGRATION: MOVING GAME LOGIC TO BACKEND
-- ==========================================

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


-- 3. SECURE COMBAT RESOLVE (LOOT DROP & PROGRESSION)
-- 3. SECURE COMBAT RESOLVE (COMPLETE)
CREATE OR REPLACE FUNCTION public.secure_resolve_combat(
    p_monster_name text, p_is_elite boolean, p_is_boss boolean,
    p_lv_at_combat int, p_player_hp int, p_player_mp float8,
    p_base_exp int DEFAULT 20, p_base_gold int DEFAULT 10,
    p_skill_reward_id text DEFAULT null, p_lat float8 DEFAULT null,
    p_lng float8 DEFAULT null, p_is_weather_special boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_u uuid := auth.uid(); v_p public.profiles;
    v_g int; v_e int; v_lv int; v_ex int; v_mx int; v_hp int; v_mhp int; v_mp float8; v_mmp int; 
    v_up bool := false; v_t date := current_date; v_ws date := date_trunc('week', current_date)::date;
    v_loots jsonb := '[]'::jsonb; v_sid text; v_sn text; v_sic text; v_sd text;
BEGIN
    SELECT * INTO v_p FROM public.profiles WHERE id = v_u;
    IF NOT FOUND THEN RAISE EXCEPTION 'No profile'; END IF;
    
    -- 1. 獎勵計算
    v_e := floor(p_base_exp * (CASE WHEN p_is_elite OR p_is_boss THEN 2.5 ELSE 1 END));
    v_g := floor(p_base_gold * (CASE WHEN p_is_elite OR p_is_boss THEN 2.5 ELSE 1 END));
    IF p_is_weather_special THEN v_e := v_e * 3; v_g := v_g * 3; END IF;

    -- 2. 成長與升級 (平滑曲線)
    v_lv := v_p.level; v_ex := v_p.exp + v_e; v_mhp := v_p.max_hp; v_mmp := v_p.max_mp;
    v_mx := floor(100 + (v_lv - 1) * 50 * v_lv);
    WHILE v_ex >= v_mx LOOP
        v_ex := v_ex - v_mx; v_lv := v_lv + 1; 
        v_mx := floor(100 + (v_lv - 1) * 50 * v_lv);
        v_mhp := v_mhp + 20; v_mmp := v_mmp + 10; v_up := true;
    END LOOP;

    -- 3. 恢復與屬性校正
    v_hp := CASE WHEN v_up THEN v_mhp WHEN (p_is_elite OR p_is_boss OR p_is_weather_special) THEN LEAST(v_mhp, p_player_hp + floor(v_mhp * 0.3)) ELSE p_player_hp END;
    v_mp := CASE WHEN v_up THEN v_mmp WHEN (p_is_elite OR p_is_boss OR p_is_weather_special) THEN LEAST(v_mmp, p_player_mp + (v_mmp * 0.3)) ELSE LEAST(v_mmp, p_player_mp + (v_mmp * 0.1)) END;

    -- 4. 氣候強敵稀有掉落 (1% 機率)
    IF p_is_weather_special AND random() < 0.01 THEN
        v_sid := (ARRAY['item_str_seed', 'item_def_seed', 'item_hp_seed'])[floor(random() * 3 + 1)];
        v_sn := CASE v_sid WHEN 'item_str_seed' THEN '力量種子' WHEN 'item_def_seed' THEN '鐵壁種子' ELSE '生命之果' END;
        v_sic := CASE v_sid WHEN 'item_str_seed' THEN '💪' WHEN 'item_def_seed' THEN '🛡️' ELSE '🍎' END;
        v_sd := CASE v_sid WHEN 'item_str_seed' THEN '服用後永久提升 2 點攻擊力。' WHEN 'item_def_seed' THEN '服用後永久提升 2 點防禦力。' ELSE '服用後永久提升 10 點最大生命值。' END;
        v_loots := v_loots || jsonb_build_array(jsonb_build_object('id', v_sid, 'name', v_sn, 'icon', v_sic, 'type', 'consumable', 'description', v_sd, 'quantity', 1));
    END IF;

    -- 5. 更新玩家資料
    UPDATE public.profiles SET 
        level=v_lv, exp=v_ex, max_exp=v_mx, hp=v_hp, max_hp=v_mhp, mp=v_mp, max_mp=v_mmp, gold=gold+v_g, updated_at=now(),
        items = (
            SELECT jsonb_agg(row_to_json(m)) FROM (
                SELECT id, name, icon, type, description, SUM(quantity)::int as quantity FROM (
                    SELECT (elem->>'id') as id, (elem->>'name') as name, (elem->>'icon') as icon, (elem->>'type') as type, (elem->>'description') as description, (elem->>'quantity')::int as quantity
                    FROM jsonb_array_elements(COALESCE(v_p.items, '[]'::jsonb) || v_loots) AS elem
                ) t GROUP BY id, name, icon, type, description
            ) m
        )
    WHERE id = v_u;

    -- 6. 同步任務進度
    IF (p_is_elite OR p_is_weather_special OR p_is_boss) THEN
        UPDATE public.player_quests SET progress = LEAST(progress + 1, required) WHERE user_id = v_u AND quest_id = 'wq_kill_boss' AND assigned_date = v_ws AND claimed = false;
    END IF;
    IF p_monster_name LIKE '%史萊姆%' THEN
        UPDATE public.player_quests SET progress = LEAST(progress + 1, required) WHERE user_id = v_u AND (quest_id = 'dq_kill_slime' OR quest_id = 'cq_tyn_slime') AND assigned_date = v_t AND claimed = false;
    END IF;
    IF p_monster_name LIKE '%哥布林%' THEN
        UPDATE public.player_quests SET progress = LEAST(progress + 1, required) WHERE user_id = v_u AND quest_id = 'dq_kill_goblin' AND assigned_date = v_t AND claimed = false;
    END IF;

    SELECT * INTO v_p FROM public.profiles WHERE id = v_u;
RETURN jsonb_build_object('gold',v_g,'exp',v_e,'leveled_up',v_up,'new_level',v_lv,'loots',v_loots,'updated_profile',row_to_json(v_p));
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
-- Logic: 100 incense cost, 2% chance success.
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

    IF v_roll < 0.02 THEN
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
        WHEN 'rec_hp_pot' THEN '{"id": "rec_hp_pot", "target": "item_hp_pot", "cost": 20, "mats": [{"id": "item_herb", "q": 2}]}'::jsonb
        WHEN 'rec_mp_pot' THEN '{"id": "rec_mp_pot", "target": "item_mp_pot", "cost": 50, "mats": [{"id": "item_herb", "q": 2}, {"id": "item_magic_gem", "q": 1}]}'::jsonb
        WHEN 'rec_hp_pot_m' THEN '{"id": "rec_hp_pot_m", "target": "item_hp_pot_m", "cost": 50, "mats": [{"id": "item_herb", "q": 4}, {"id": "item_hp_pot", "q": 1}]}'::jsonb
        WHEN 'rec_revive_pot' THEN '{"id": "rec_revive_pot", "target": "item_revive_pot", "cost": 500, "mats": [{"id": "item_magic_gem", "q": 1}, {"id": "mat_north_glass", "q": 1}, {"id": "mat_south_pearl", "q": 1}]}'::jsonb
        WHEN 'rec_tech_boost' THEN '{"id": "rec_tech_boost", "target": "item_str_seed", "cost": 80, "mats": [{"id": "mat_north_tech", "q": 3}, {"id": "mat_north_glass", "q": 1}]}'::jsonb
        WHEN 'rec_optic_def' THEN '{"id": "rec_optic_def", "target": "item_def_seed", "cost": 120, "mats": [{"id": "mat_north_glass", "q": 3}, {"id": "item_herb", "q": 2}]}'::jsonb
        WHEN 'rec_lava_boost' THEN '{"id": "rec_lava_boost", "target": "item_str_seed", "cost": 200, "mats": [{"id": "mat_lava_sand", "q": 2}, {"id": "mat_south_sand", "q": 3}]}'::jsonb
        WHEN 'rec_sea_heal' THEN '{"id": "rec_sea_heal", "target": "item_hp_pot_m", "cost": 80, "mats": [{"id": "mat_south_pearl", "q": 1}, {"id": "item_herb", "q": 3}]}'::jsonb
        WHEN 'rec_crystal_life' THEN '{"id": "rec_crystal_life", "target": "item_hp_seed", "cost": 150, "mats": [{"id": "mat_east_crystal", "q": 2}, {"id": "item_herb", "q": 2}]}'::jsonb
        ELSE NULL
    END;

    IF v_recipe IS NULL THEN RAISE EXCEPTION 'Invalid recipe ID'; END IF;

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
                    v_recipe->>'target', 'Crafted Item', '🧪', 'potion', 1
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
                    SELECT v_recipe->>'target', '製作道具', '🧪', 'potion', '煉金產出的道具', 1
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
        WHEN 'forge_wood_sword' THEN '{"cost": 200, "target": "eq_wood_sword", "mats": [{"id": "item_iron_ore", "q": 12}, {"id": "item_herb", "q": 5}]}'::jsonb
        WHEN 'forge_iron_sword' THEN '{"cost": 1500, "target": "eq_iron_sword", "mats": [{"id": "item_iron_ore", "q": 35}, {"id": "mat_north_tech", "q": 12}]}'::jsonb
        -- Add others as needed
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
        'name', '製作裝備',
        'slot', 'weapon',
        'rarity', 1,
        'attack', 5,
        'defense', 0,
        'hp', 0,
        'icon', '🗡️',
        'description', '經由鍛造產出的裝備'
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
    ELSIF p_item_id = 'item_hp_pot_m' THEN v_hp_recover := 150 * v_count;
    ELSIF p_item_id = 'item_mp_pot' THEN v_mp_recover := 50 * v_count;
    ELSIF p_item_id = 'item_revive_pot' THEN v_hp_recover := 9999; v_count := 1; -- Revive is usually single use
    ELSIF p_item_id = 'item_str_seed' THEN v_str_increase := 2 * v_count;
    ELSIF p_item_id = 'item_def_seed' THEN v_def_increase := 2 * v_count;
    ELSIF p_item_id = 'item_hp_seed' THEN v_hp_increase := 20 * v_count;
    ELSE RAISE EXCEPTION 'Item not consumable';
    END IF;

    -- Update stats
    v_cur_hp := (v_profile.hp + v_hp_recover);
    IF v_cur_hp > v_profile.max_hp + v_hp_increase THEN v_cur_hp := v_profile.max_hp + v_hp_increase; END IF;
    
    v_cur_mp := (v_profile.mp + v_mp_recover);
    IF v_cur_mp > (v_profile.max_mp + (v_hp_increase/2)) THEN v_cur_mp := (v_profile.max_mp + (v_hp_increase/2)); END IF;

    -- Update Profile
    UPDATE public.profiles
    SET 
        hp = v_cur_hp,
        mp = v_cur_mp,
        attack = attack + v_str_increase,
        defense = defense + v_def_increase,
        max_hp = max_hp + v_hp_increase,
        items = (
            SELECT jsonb_agg(row_to_json(m))
            FROM (
                SELECT 
                    (e->>'id') as id, 
                    (e->>'name') as name, 
                    (e->>'icon') as icon, 
                    (e->>'type') as type, 
                    (e->>'description') as description, 
                    ((e->>'quantity')::int - (CASE WHEN e->>'id' = p_item_id THEN v_count ELSE 0 END))::int as quantity 
                FROM jsonb_array_elements(v_profile.items) AS e
            ) m
            WHERE m.quantity > 0
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
    -- 晴天 5%, 雨天 10%, 雷暴/濃霧 15%
    v_threshold := CASE 
        WHEN p_weather IN ('sunny', 'clear') THEN 0.05 
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
