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

    RETURN jsonb_build_object(
        'success', true,
        'gold_gained', v_sell_price,
        'message', 'Sold ' || (v_equipment->>'name')
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
    v_gold_cost integer;
    v_frag_cost integer;
    v_success_rate integer;
    v_roll float;
    v_success boolean;
    v_msg text;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    
    -- Find skill index in the array
    SELECT (idx - 1) INTO v_skill_idx
    FROM jsonb_array_elements(v_profile.skills) WITH ORDINALITY AS t(elem, idx)
    WHERE elem->>'id' = p_skill_id;

    IF v_skill_idx IS NULL THEN RAISE EXCEPTION 'Skill not found in player profile'; END IF;
    
    v_skill := v_profile.skills->v_skill_idx;
    v_lv := (v_skill->>'level')::integer;

    -- Hardcoded upgrade logic for security (Must match game.ts logic)
    -- level 1->2: cost 500 gold, 10 frag, rate 90%
    -- level 2->3: cost 1500 gold, 25 frag, rate 75%
    -- level 3->4: cost 4500 gold, 60 frag, rate 50%
    -- level 4->5: cost 12000 gold, 150 frag, rate 30%
    IF v_lv = 1 THEN v_gold_cost := 500; v_frag_cost := 10; v_success_rate := 90;
    ELSIF v_lv = 2 THEN v_gold_cost := 1500; v_frag_cost := 25; v_success_rate := 75;
    ELSIF v_lv = 3 THEN v_gold_cost := 4500; v_frag_cost := 60; v_success_rate := 50;
    ELSIF v_lv = 4 THEN v_gold_cost := 12000; v_frag_cost := 150; v_success_rate := 30;
    ELSE RAISE EXCEPTION 'Skill already at max level or invalid level';
    END IF;

    -- Check costs
    IF v_profile.gold < v_gold_cost THEN RAISE EXCEPTION 'Insufficient gold'; END IF;
    IF (v_skill->>'fragments')::integer < v_frag_cost THEN RAISE EXCEPTION 'Insufficient fragments'; END IF;

    -- Deduct costs first (always consumed)
    v_skill := v_skill || jsonb_build_object('fragments', (v_skill->>'fragments')::integer - v_frag_cost);
    
    -- Roll for success
    v_roll := random() * 100;
    IF v_roll <= v_success_rate THEN
        v_success := true;
        v_skill := v_skill || jsonb_build_object('level', v_lv + 1);
        v_msg := 'Upgrade Success!';
    ELSE
        v_success := false;
        v_msg := 'Upgrade Failed...';
    END IF;

    -- Update the array
    UPDATE public.profiles
    SET 
        gold = gold - v_gold_cost,
        skills = jsonb_set(skills, ARRAY[v_skill_idx::text], v_skill),
        updated_at = now()
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', v_success,
        'message', v_msg,
        'new_level', (v_skill->>'level')::integer,
        'gold_cost', v_gold_cost
    );
END;
$$;


-- 3. SECURE COMBAT RESOLVE (LOOT DROP & PROGRESSION)
-- 3. SECURE COMBAT RESOLVE (COMPLETE)
CREATE OR REPLACE FUNCTION public.secure_resolve_combat(
    p_monster_name text,
    p_is_elite boolean,
    p_is_boss boolean,
    p_lv_at_combat integer,
    p_player_hp integer,
    p_player_mp double precision,
    p_skill_reward_id text default null,
    p_lat double precision default null,
    p_lng double precision default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_profile public.profiles;
    v_gold_reward integer;
    v_exp_reward integer;
    v_loots jsonb := '[]'::jsonb;
    v_eq_drop jsonb := null;
    v_powerup_roll float := random();
    v_powerup_chance float;
    
    -- Level up vars
    v_next_lv integer;
    v_next_exp integer;
    v_next_max_exp integer;
    v_next_hp integer;
    v_next_max_hp integer;
    v_next_mp float;
    v_next_max_mp integer;
    v_next_atk integer;
    v_next_def integer;
    v_leveled_up boolean := false;

    -- Skill vars
    v_skill_idx integer;
    v_skill jsonb;

    -- Region vars
    v_region text;
    v_reg_mats text[];
    v_reg_mat_id text;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

    -- 1. Base Rewards
    v_exp_reward := floor((18 + v_profile.level * 6) * (CASE WHEN p_is_elite THEN 2.5 ELSE 1 END));
    v_gold_reward := floor((8 + v_profile.level * 3) * (CASE WHEN p_is_elite THEN 2.5 ELSE 1 END));

    -- 2. Power-up / Equipment Drop
    v_powerup_chance := CASE WHEN p_is_boss THEN 0.10 WHEN p_is_elite THEN 0.05 ELSE 0.001 END;
    IF v_powerup_roll < v_powerup_chance THEN
        IF random() < 0.5 THEN
             v_loots := v_loots || jsonb_build_object('id', 'item_str_seed', 'name', '力量種子', 'quantity', 1, 'type', 'consumable', 'icon', '💪');
        ELSE
             v_eq_drop := jsonb_build_object('id', 'eq_node_' || floor(random()*999999), 'name', '受祝福的戰物', 'rarity', floor(random()*2)+1, 'slot', 'weapon', 'attack', 5, 'defense', 0, 'hp', 0, 'icon', '🗡️', 'description', '戰後掉落');
        END IF;
    END IF;

    -- 3. Regional Drops (地理位置判定)
    IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
        -- Simplified Region Check (must match game.ts)
        IF p_lng > 121.0 AND p_lat <= 24.5 THEN v_region := 'east';
        ELSIF p_lat > 24.5 THEN v_region := 'north';
        ELSIF p_lat > 23.5 THEN v_region := 'central';
        ELSE v_region := 'south';
        END IF;

        IF random() < (CASE WHEN p_is_boss THEN 1.0 WHEN p_is_elite THEN 0.3 ELSE 0.1 END) THEN
            CASE 
                WHEN v_region = 'north' THEN 
                    IF random() < 0.5 THEN v_reg_mat_id := 'mat_north_tech'; v_reg_mats := ARRAY['科技廢料', '⚙️'];
                    ELSE v_reg_mat_id := 'mat_north_glass'; v_reg_mats := ARRAY['魔法玻璃', '🪷'];
                    END IF;
                WHEN v_region = 'central' THEN 
                    IF random() < 0.5 THEN v_reg_mat_id := 'mat_central_iron'; v_reg_mats := ARRAY['高山鐵礦', '⛰️'];
                    ELSE v_reg_mat_id := 'mat_central_wood'; v_reg_mats := ARRAY['神木枝枒', '🍃'];
                    END IF;
                WHEN v_region = 'south' THEN 
                    IF random() < 0.5 THEN v_reg_mat_id := 'mat_south_sand'; v_reg_mats := ARRAY['炎漠紅砂', '🏜️'];
                    ELSE v_reg_mat_id := 'mat_south_pearl'; v_reg_mats := ARRAY['海淵珍珠', '🦪'];
                    END IF;
                WHEN v_region = 'east' THEN 
                    IF random() < 0.5 THEN v_reg_mat_id := 'mat_east_crystal'; v_reg_mats := ARRAY['花東水晶', '💠'];
                    ELSE v_reg_mat_id := 'mat_basalt'; v_reg_mats := ARRAY['玄武岩礦石', '🌑'];
                    END IF;
                ELSE v_reg_mat_id := NULL;
            END CASE;

            IF v_reg_mat_id IS NOT NULL THEN
                v_loots := v_loots || jsonb_build_object('id', v_reg_mat_id, 'name', v_reg_mats[1], 'quantity', 1, 'type', 'material', 'icon', v_reg_mats[2]);
            END IF;
        END IF;
    END IF;

    -- 4. Progression Logic (Level Up)
    v_next_lv := v_profile.level;
    v_next_exp := v_profile.exp + v_exp_reward;
    v_next_max_exp := v_profile.max_exp;
    v_next_max_hp := v_profile.max_hp;
    v_next_max_mp := v_profile.max_mp;
    v_next_atk := v_profile.attack;
    v_next_def := v_profile.defense;

    WHILE v_next_exp >= v_next_max_exp LOOP
        v_next_exp := v_next_exp - v_next_max_exp;
        v_next_lv := v_next_lv + 1;
        v_next_max_exp := floor(v_next_max_exp * 1.5);
        v_next_max_hp := v_next_max_hp + 20;
        v_next_max_mp := v_next_max_mp + 10;
        v_next_atk := v_next_atk + 3;
        v_next_def := v_next_def + 2;
        v_leveled_up := true;
    END LOOP;

    v_next_hp := CASE WHEN v_leveled_up THEN v_next_max_hp ELSE p_player_hp END;
    v_next_mp := CASE WHEN v_leveled_up THEN v_next_max_mp ELSE p_player_mp + (v_next_max_mp * 0.1) END;
    IF v_next_mp > v_next_max_mp THEN v_next_mp := v_next_max_mp; END IF;

    -- 5. Handle Skill fragments if applicable
    IF p_skill_reward_id IS NOT NULL AND random() < 0.3 THEN
        SELECT (idx - 1) INTO v_skill_idx FROM jsonb_array_elements(v_profile.skills) WITH ORDINALITY AS t(elem, idx) WHERE elem->>'id' = p_skill_reward_id;
        IF v_skill_idx IS NOT NULL THEN
            UPDATE public.profiles SET skills = jsonb_set(skills, ARRAY[v_skill_idx::text, 'fragments'], ((skills->v_skill_idx->>'fragments')::integer + 1)::text::jsonb) WHERE id = v_user_id;
        ELSE
            UPDATE public.profiles SET skills = skills || jsonb_build_object('id', p_skill_reward_id, 'level', 1, 'fragments', 0) WHERE id = v_user_id;
        END IF;
    END IF;

    -- 6. Update Profile
    UPDATE public.profiles
    SET 
        level = v_next_lv,
        exp = v_next_exp,
        max_exp = v_next_max_exp,
        hp = v_next_hp,
        max_hp = v_next_max_hp,
        mp = v_next_mp,
        max_mp = v_next_max_mp,
        attack = v_next_atk,
        defense = v_next_def,
        gold = gold + v_gold_reward,
        equipment = CASE WHEN v_eq_drop IS NOT NULL THEN equipment || v_eq_drop ELSE equipment END,
        items = (
            SELECT jsonb_agg(row_to_json(m))
            FROM (
                SELECT 
                    id, name, icon, type, SUM(quantity)::int as quantity
                FROM (
                    SELECT 
                        (elem->>'id') as id, 
                        (elem->>'name') as name, 
                        (elem->>'icon') as icon, 
                        (elem->>'type') as type, 
                        (elem->>'quantity')::int as quantity
                    FROM jsonb_array_elements(v_profile.items || v_loots) AS elem
                ) t
                GROUP BY id, name, icon, type
            ) m
        ),
        updated_at = now()
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'gold', v_gold_reward,
        'exp', v_exp_reward,
        'loots', v_loots,
        'equipment', v_eq_drop,
        'leveled_up', v_leveled_up,
        'new_level', v_next_lv
    );
END;
$$;
