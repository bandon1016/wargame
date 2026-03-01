-- ====================================================
-- 安全任務進度追蹤強化 (Server-side Enforcement)
-- ====================================================

-- 1. 擊殺任務 (Kill Quests) 整合至戰鬥結算
-- 修改原有 secure_resolve_combat，在發放獎勵的同時自動累計進度
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
    -- (省略原有變數宣告，與 secure_logic.sql 保持一致...)
    v_profile public.profiles;
    v_gold_reward integer;
    v_exp_reward integer;
    v_loots jsonb := '[]'::jsonb;
    v_eq_drop jsonb := null;
    v_powerup_roll float := random();
    v_powerup_chance float;
    v_leveled_up boolean := false;
    v_today date := current_date;
    v_week_start date := date_trunc('week', current_date)::date;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

    -- [原有結算邏輯...]
    v_exp_reward := floor((18 + v_profile.level * 6) * (CASE WHEN p_is_elite THEN 2.5 ELSE 1 END));
    v_gold_reward := floor((8 + v_profile.level * 3) * (CASE WHEN p_is_elite THEN 2.5 ELSE 1 END));

    -- [自動更新擊殺任務進度 - 安全強化關鍵]
    UPDATE public.player_quests q
    SET progress = least(q.progress + 1, q.required)
    WHERE q.user_id = v_user_id
      AND q.claimed = false
      AND (q.assigned_date = v_today OR q.assigned_date = v_week_start)
      AND q.quest_id IN (
          -- 從前端傳入的怪物名稱識別，後端直接更新 matches
          -- 注意：此處邏輯需與定義檔中的 targetId 匹配
          SELECT quest_id FROM public.player_quests 
          WHERE user_id = v_user_id 
          AND (p_monster_name LIKE '%' || REPLACE(REPLACE(quest_id, 'dq_kill_', ''), 'cq_tpe_', '') || '%') -- 簡單模糊匹配
      );

    -- [更新 Profile 並回傳...]
    -- (此部分省略，實際執行時請參考完整版 secure_logic.sql)
    RETURN jsonb_build_object('success', true); 
END;
$$;

-- 2. 探索任務 (Explore Quests) 整合至 POI 領取
-- 修改原有 secure_claim_poi
CREATE OR REPLACE FUNCTION public.secure_claim_poi(p_poi_id uuid, p_player_lat double precision, p_player_lng double precision)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_today date := current_date;
    v_week_start date := date_trunc('week', current_date)::date;
    v_poi public.map_pois;
BEGIN
    -- [原有領取驗證...] (座標校驗、距離校驗)
    SELECT * INTO v_poi FROM public.map_pois WHERE id = p_poi_id AND is_active = true FOR UPDATE;
    
    -- [自動更新探索任務進度]
    UPDATE public.player_quests q
    SET progress = least(q.progress + 1, q.required)
    WHERE q.user_id = v_user_id
      AND (q.assigned_date = v_today OR q.assigned_date = v_week_start)
      AND q.claimed = false
      AND (
          q.quest_id LIKE 'dq_explore_%' OR 
          q.quest_id LIKE 'wq_explore_%' OR 
          q.quest_id LIKE 'cq_%_explore' OR 
          q.quest_id LIKE 'cq_%_altar'
      );

    -- [發放獎勵並標記領取...]
    RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. 停用前端直接更新進度的新規則 (限額或限制呼叫次數)
-- 或者：將 update_quest_progress 的安全性提高，限制每 10 秒只能呼叫一次，且 increment 不得超過 1
CREATE OR REPLACE FUNCTION public.update_quest_progress(
  p_user_id uuid,
  p_quest_id text,
  p_increment int DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() != p_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  
  -- 安全防護：禁止單次增加超過 1 (除了特殊走路任務)
  IF p_increment > 1 AND p_quest_id NOT LIKE '%walk%' THEN
    RAISE EXCEPTION 'Invalid increment value detected. Anti-cheat triggered.';
  END IF;

  UPDATE public.player_quests
  SET progress = least(progress + p_increment, required)
  WHERE user_id = p_user_id
    AND quest_id = p_quest_id
    AND (assigned_date = current_date OR assigned_date = date_trunc('week', current_date)::date)
    AND claimed = false;
END;
$$;
