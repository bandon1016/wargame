
$path = "c:\Users\werbo\Desktop\gravity\github\war-game\supabase\secure_logic.sql"
$content = Get-Content $path -Raw -Encoding UTF8

# 1. Update secure_batch_use_item recovery
$oldUse = 'IF p_item_id = ''item_hp_pot'' OR p_item_id = ''it_01'' THEN v_hp_recover := 50 \* v_count;(\s+)ELSIF p_item_id = ''item_hp_pot_m'' THEN v_hp_recover := 150 \* v_count;(\s+)ELSIF p_item_id = ''item_mp_pot'' THEN v_mp_recover := 50 \* v_count;'
$newUse = 'IF p_item_id = ''item_hp_pot'' OR p_item_id = ''it_01'' THEN v_hp_recover := 50 * v_count;$1ELSIF p_item_id = ''item_hp_pot_m'' THEN v_hp_recover := 200 * v_count;$2ELSIF p_item_id = ''item_hp_pot_l'' THEN v_hp_recover := 500 * v_count;$2ELSIF p_item_id = ''item_mp_pot'' THEN v_mp_recover := 50 * v_count;'
$content = $content -replace $oldUse, $newUse

# 2. Update recipes in secure_craft_alchemy
$oldRecipe = 'WHEN ''rec_hp_pot_m'' THEN ''{"id": "rec_hp_pot_m", "target": "item_hp_pot_m", "cost": 50, "mats": \[{"id": "item_herb", "q": 4}, {"id": "item_hp_pot", "q": 1}\]}''::jsonb(\s+)WHEN ''rec_revive_pot'''
$newRecipe = 'WHEN ''rec_hp_pot_m'' THEN ''{"id": "rec_hp_pot_m", "target": "item_hp_pot_m", "cost": 50, "mats": [{"id": "item_herb", "q": 4}, {"id": "item_hp_pot", "q": 1}]}''::jsonb$1WHEN ''rec_hp_pot_l'' THEN ''{"id": "rec_hp_pot_l", "target": "item_hp_pot_l", "cost": 200, "mats": [{"id": "item_herb", "q": 8}, {"id": "item_hp_pot_m", "q": 1}, {"id": "item_magic_gem", "q": 1}]}''::jsonb$1WHEN ''rec_revive_pot'''
$content = $content -replace $oldRecipe, $newRecipe

# 3. Add daily limit check in secure_craft_alchemy
$oldLimitPlace = 'IF v_recipe IS NULL THEN RAISE EXCEPTION ''Invalid recipe ID''; END IF;'
$newLimitCheck = 'IF v_recipe IS NULL THEN RAISE EXCEPTION ''Invalid recipe ID''; END IF;

    -- Daily limit check for seeds
    IF v_recipe->>''target'' IN (''item_str_seed'', ''item_def_seed'') THEN
        INSERT INTO public.daily_craft_limits (user_id, item_id, craft_date, craft_count)
        VALUES (v_profile.id, v_recipe->>''target'', CURRENT_DATE, 0)
        ON CONFLICT (user_id, item_id, craft_date) DO NOTHING;

        IF (SELECT craft_count FROM public.daily_craft_limits WHERE user_id = v_profile.id AND item_id = v_recipe->>''target'' AND craft_date = CURRENT_DATE) >= 2 THEN
            RAISE EXCEPTION ''該種子每日製作上限已達 (2個)'';
        END IF;
    END IF;'
$content = $content -replace $oldLimitPlace, $newLimitCheck

# 4. Increment daily limit in secure_craft_alchemy
$oldIncPlace = 'updated_at = now\(\)(\s+)WHERE id = v_user_id;(\s+)-- Fetch final state'
$newIncPlace = 'updated_at = now()$1WHERE id = v_user_id;$2-- Increment daily craft count if applicable$2IF v_recipe->>''target'' IN (''item_str_seed'', ''item_def_seed'') THEN$2    UPDATE public.daily_craft_limits $2    SET craft_count = craft_count + 1 $2    WHERE user_id = v_user_id AND item_id = v_recipe->>''target'' AND craft_date = CURRENT_DATE;$2END IF;$2-- Fetch final state'
$content = $content -replace $oldIncPlace, $newIncPlace

# 5. Remove garbage at end
$content = $content -replace 'END;(\s+)c:\\Users\\werbo\\Desktop\\gravity\\github\\war-game;', 'END;$1'

Set-Content $path $content -Encoding UTF8
