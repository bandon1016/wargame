-- 將神明招募機率更新為 10% 的 SQL 補丁

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

    -- [關鍵修改]: 機率由 0.02 (2%) 提升至 0.10 (10%)
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

        -- Fallback to random if all owned
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
