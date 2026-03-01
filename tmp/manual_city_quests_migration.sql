-- ====================================================
-- 城市任務改為「手動接取制」及「安全強化」修正板
-- ====================================================

-- 1. 修正：移除 get_or_reset_daily_quests 中的自動分配城市任務邏輯
CREATE OR REPLACE FUNCTION public.get_or_reset_daily_quests(p_user_id uuid, p_city_id text DEFAULT NULL)
RETURNS TABLE (
  quest_id      text,
  period        text,
  progress      int,
  required      int,
  claimed       boolean,
  assigned_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today       date := current_date;
  v_week_start  date := date_trunc('week', current_date)::date;
  v_daily_count int;
  v_weekly_count int;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 只保留全局每日任務的自動分派
  SELECT count(*) INTO v_daily_count
  FROM public.player_quests q
  WHERE q.user_id = p_user_id
    AND q.period = 'daily'
    AND q.assigned_date = v_today
    AND q.quest_id LIKE 'dq_%';

  IF v_daily_count = 0 THEN
    INSERT INTO public.player_quests (user_id, quest_id, period, required, assigned_date)
    SELECT p_user_id, pool.id, 'daily', pool.req, v_today
    FROM (
      VALUES
        ('dq_kill_slime',    5),
        ('dq_kill_goblin',   3),
        ('dq_walk_500',    500),
        ('dq_walk_1000',  1000),
        ('dq_explore_poi',   2),
        ('dq_collect_mat',   3)
    ) AS pool(id, req)
    ORDER BY random() LIMIT 3
    ON CONFLICT DO NOTHING;
  END IF;

  -- 每週任務自動分派
  SELECT count(*) INTO v_weekly_count
  FROM public.player_quests q
  WHERE q.user_id = p_user_id
    AND q.period = 'weekly'
    AND q.assigned_date = v_week_start;

  IF v_weekly_count = 0 THEN
    INSERT INTO public.player_quests (user_id, quest_id, period, required, assigned_date)
    SELECT p_user_id, pool.id, 'weekly', pool.req, v_week_start
    FROM (
      VALUES
        ('wq_kill_boss',     3),
        ('wq_walk_5000',  5000),
        ('wq_collect_rare',  5)
    ) AS pool(id, req)
    ORDER BY random() LIMIT 1
    ON CONFLICT DO NOTHING;
  END IF;

  -- 回傳所有已接取的任務 (不再自動插入城市任務)
  RETURN QUERY
    SELECT q.quest_id, q.period, q.progress, q.required, q.claimed, q.assigned_date
    FROM public.player_quests q
    WHERE q.user_id = p_user_id
      AND (
        (q.period = 'daily'  AND q.assigned_date = v_today)
        OR
        (q.period = 'weekly' AND q.assigned_date = v_week_start)
      )
    ORDER BY q.period DESC, q.quest_id;
END;
$$;

-- 2. 新增：手動接取城市任務函數
CREATE OR REPLACE FUNCTION public.accept_city_quest(p_quest_id text, p_city_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_today date := current_date;
    v_exists boolean;
    v_required int;
BEGIN
    -- 1. 基本驗證
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

    -- 2. 檢查今天是否已經接過
    SELECT EXISTS (
        SELECT 1 FROM public.player_quests 
        WHERE user_id = v_user_id AND quest_id = p_quest_id AND assigned_date = v_today
    ) INTO v_exists;

    IF v_exists THEN
        RETURN jsonb_build_object('success', false, 'message', '今天已經接取過此項委託了。');
    END IF;

    -- 3. 獲取任務需求量 (從硬編碼的池中獲取，或根據 quest_id 判斷)
    -- 注意：這裡我們需要確保 quest_id 與前端 CITY_QUEST_POOL 的定義一致
    CASE 
        WHEN p_quest_id LIKE '%_walk' THEN v_required := 1500;
        WHEN p_quest_id LIKE '%_kill' THEN v_required := 5;
        WHEN p_quest_id LIKE '%_collect' THEN v_required := 3;
        WHEN p_quest_id LIKE '%_altar' THEN v_required := 2;
        WHEN p_quest_id LIKE '%_crystal' THEN v_required := 3;
        WHEN p_quest_id = 'cq_tpe_101' THEN v_required := 5;
        ELSE v_required := 5; -- 預設
    END CASE;

    -- 4. 插入任務
    INSERT INTO public.player_quests (user_id, quest_id, period, required, assigned_date)
    VALUES (v_user_id, p_quest_id, 'daily', v_required, v_today);

    RETURN jsonb_build_object('success', true, 'message', '委託接取成功！祝武運昌隆。');
END;
$$;
