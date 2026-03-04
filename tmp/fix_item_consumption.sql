-- 修復 secure_batch_use_item 函式
-- 1. 移除未定義變數 v_recipe 導致的 400 錯誤
-- 2. 優化道具數量扣除邏輯，保留所有道具屬性

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
    ELSIF p_item_id = 'item_revive_pot' THEN v_hp_recover := 9999; v_count := 1; -- Revive is single use
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
