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
    v_partners jsonb; v_partner jsonb; v_new_partners jsonb := '[]'::jsonb;
    v_p_lv int; v_p_ex int; v_p_mx int; v_p_power int;
BEGIN
    SELECT * INTO v_p FROM public.profiles WHERE id = v_u;
    IF NOT FOUND THEN RAISE EXCEPTION 'No profile'; END IF;
    
    -- 1. 獎勵計算
    v_e := floor(p_base_exp * (CASE WHEN p_is_elite OR p_is_boss THEN 2.5 ELSE 1 END));
    v_g := floor(p_base_gold * (CASE WHEN p_is_elite OR p_is_boss THEN 2.5 ELSE 1 END));
    IF p_is_weather_special THEN v_e := v_e * 3; v_g := v_g * 3; END IF;

    -- 2. 主角成長與升級 (平滑曲線)
    v_lv := v_p.level; v_ex := v_p.exp + v_e; v_mhp := v_p.max_hp; v_mmp := v_p.max_mp;
    v_mx := floor(100 + (v_lv - 1) * 50 * v_lv);
    WHILE v_ex >= v_mx LOOP
        v_ex := v_ex - v_mx; v_lv := v_lv + 1; 
        v_mx := floor(100 + (v_lv - 1) * 50 * v_lv);
        v_mhp := v_mhp + 20; v_mmp := v_mmp + 10; v_up := true;
    END LOOP;

    -- 2.5. 夥伴成長與升級
    v_partners := COALESCE(v_p.partners, '[]'::jsonb);
    IF jsonb_array_length(v_partners) > 0 THEN
        FOR v_partner IN SELECT * FROM jsonb_array_elements(v_partners)
        LOOP
            IF (v_partner->>'isDeployed')::boolean = true THEN
                v_p_lv := (v_partner->>'level')::int;
                v_p_ex := (v_partner->>'exp')::int + v_e;
                v_p_mx := (v_partner->>'maxExp')::int;
                v_p_power := (v_partner->>'power')::int;

                WHILE v_p_ex >= v_p_mx LOOP
                    v_p_ex := v_p_ex - v_p_mx;
                    v_p_lv := v_p_lv + 1;
                    v_p_mx := floor(v_p_mx * 1.5 + 50);
                    v_p_power := floor(v_p_power * 1.1 + 2);
                END LOOP;

                v_new_partners := v_new_partners || jsonb_build_object(
                    'id', v_partner->>'id',
                    'name', v_partner->>'name',
                    'role', v_partner->>'role',
                    'rarity', (v_partner->>'rarity')::int,
                    'power', v_p_power,
                    'avatar', v_partner->>'avatar',
                    'level', v_p_lv,
                    'exp', v_p_ex,
                    'maxExp', v_p_mx,
                    'isDeployed', true
                );
            ELSE
                v_new_partners := v_new_partners || v_partner;
            END IF;
        END LOOP;
    END IF;

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

    -- 5. 區域掉落材料 (一般 20%, 菁英 100%)
    DECLARE
        v_reg text; v_reg_sid text; v_reg_sn text; v_reg_sic text; v_reg_sd text; v_reg_q int := 1;
    BEGIN
        IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
            IF (p_lng > 121.0 AND p_lat <= 24.5) THEN v_reg := 'east'; ELSIF (p_lat > 24.5) THEN v_reg := 'north'; ELSIF (p_lat > 23.5) THEN v_reg := 'central'; ELSIF (p_lat > 21.8) THEN v_reg := 'south'; ELSE v_reg := 'unknown'; END IF;
            IF v_reg != 'unknown' AND (random() < 0.2 OR p_is_elite OR p_is_boss) THEN
                IF (p_is_elite OR p_is_boss) THEN v_reg_q := floor(random() * 2 + 1); END IF;
                CASE v_reg
                    WHEN 'north' THEN v_reg_sid := (ARRAY['mat_north_tech', 'mat_north_glass'])[floor(random() * 2 + 1)]; v_reg_sn := CASE v_reg_sid WHEN 'mat_north_tech' THEN '科技廢料' ELSE '魔法玻璃' END; v_reg_sic := CASE v_reg_sid WHEN 'mat_north_tech' THEN '⚙️' ELSE '🪷' END; v_reg_sd := CASE v_reg_sid WHEN 'mat_north_tech' THEN '北部特產：沾染微弱魔力的報廢電路板。' ELSE '北部特產：折射著奇幻光芒的玻璃碎片。' END;
                    WHEN 'central' THEN v_reg_sid := (ARRAY['mat_central_iron', 'mat_central_wood', 'mat_ancient_wood'])[floor(random() * 3 + 1)]; v_reg_sn := CASE v_reg_sid WHEN 'mat_central_iron' THEN '高山鐵礦' WHEN 'mat_central_wood' THEN '神木枝枒' ELSE '太古神木' END; v_reg_sic := CASE v_reg_sid WHEN 'mat_central_iron' THEN '⛰️' WHEN 'mat_central_wood' THEN '🍃' ELSE '🌲' END; v_reg_sd := CASE v_reg_sid WHEN 'mat_central_iron' THEN '中部特產：中央山脈深處才挖得到的極堅硬礦石。' WHEN 'mat_central_wood' THEN '中部特產：受到古老森林魔力滋養的樹枝。' ELSE '台中稀有：高品質的千年神木原木。' END;
                    WHEN 'south' THEN v_reg_sid := (ARRAY['mat_south_sand', 'mat_south_pearl', 'mat_lava_sand', 'mat_coral'])[floor(random() * 4 + 1)]; v_reg_sn := CASE v_reg_sid WHEN 'mat_south_sand' THEN '炎漠紅砂' WHEN 'mat_south_pearl' THEN '海淵珍珠' WHEN 'mat_lava_sand' THEN '熔岩紅砂' ELSE '珊瑚碎片' END; v_reg_sic := CASE v_reg_sid WHEN 'mat_south_sand' THEN '🏜️' WHEN 'mat_south_pearl' THEN '🦪' WHEN 'mat_lava_sand' THEN '🌋' ELSE '🌺' END; v_reg_sd := CASE v_reg_sid WHEN 'mat_south_sand' THEN '南部特產：蘊含濃烈火屬性魔力的紅色砂礫。' WHEN 'mat_south_pearl' THEN '南部特產：凝聚大洋水屬性精華的璀璨珍珠。' WHEN 'mat_lava_sand' THEN '台南稀有：極品火屬性砂礫。' ELSE '屏東特產：沾著濃厚海洋魔力的礁石碎片。' END;
                    WHEN 'east' THEN v_reg_sid := (ARRAY['mat_east_crystal', 'mat_basalt'])[floor(random() * 2 + 1)]; v_reg_sn := CASE v_reg_sid WHEN 'mat_east_crystal' THEN '花東水晶' ELSE '玄武岩礦石' END; v_reg_sic := CASE v_reg_sid WHEN 'mat_east_crystal' THEN '💠' ELSE '🌑' END; v_reg_sd := CASE v_reg_sid WHEN 'mat_east_crystal' THEN '東部特產：純淨無瑕的天然水晶。' ELSE '台東特產：花東縱谷出產的堅硬黑色岩石。' END;
                END CASE;
                v_loots := v_loots || jsonb_build_array(jsonb_build_object('id', v_reg_sid, 'name', v_reg_sn, 'icon', v_reg_sic, 'type', 'material', 'description', v_reg_sd, 'quantity', v_reg_q));
            END IF;
        END IF;
    END;

    -- 6. 更新玩家資料
    UPDATE public.profiles SET 
        level=v_lv, exp=v_ex, max_exp=v_mx, hp=v_hp, max_hp=v_mhp, mp=v_mp, max_mp=v_mmp, gold=gold+v_g, updated_at=now(),
        partners = v_new_partners,
        items = (
            SELECT jsonb_agg(row_to_json(m)) FROM (
                SELECT id, name, icon, type, description, SUM(quantity)::int as quantity FROM (
                    SELECT (elem->>'id') as id, (elem->>'name') as name, (elem->>'icon') as icon, (elem->>'type') as type, (elem->>'description') as description, (elem->>'quantity')::int as quantity
                    FROM jsonb_array_elements(COALESCE(v_p.items, '[]'::jsonb) || v_loots) AS elem
                ) t GROUP BY id, name, icon, type, description
            ) m
        )
    WHERE id = v_u;

    -- 7. 同步任務進度
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
