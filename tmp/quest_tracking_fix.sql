-- ====================================================
-- 任務進度追蹤修復 - 在 Supabase SQL Editor 執行
-- 修正：移除 p_assigned_date 參數依賴，由伺服器端自動判斷
-- ====================================================

-- 覆寫 update_quest_progress（移除 p_assigned_date，由後端自動判斷日期）
create or replace function public.update_quest_progress(
  p_user_id uuid,
  p_quest_id text,
  p_increment int default 1
)
returns void
language plpgsql
security definer
as $$
declare
  v_today      date := current_date;
  v_week_start date := date_trunc('week', current_date)::date;
begin
  if auth.uid() != p_user_id then
    raise exception 'Unauthorized';
  end if;

  update public.player_quests
  set progress = least(progress + p_increment, required)
  where user_id = p_user_id
    and quest_id = p_quest_id
    and (assigned_date = v_today or assigned_date = v_week_start)
    and claimed = false;
end;
$$;

-- 走路進度：更新所有 walk 類型任務
create or replace function public.increment_walk_quests(
  p_user_id uuid,
  p_increment_meters int
)
returns void
language plpgsql
security definer
as $$
declare
  v_today      date := current_date;
  v_week_start date := date_trunc('week', current_date)::date;
begin
  if auth.uid() != p_user_id then
    raise exception 'Unauthorized';
  end if;

  update public.player_quests
  set progress = least(progress + p_increment_meters, required)
  where user_id = p_user_id
    and (assigned_date = v_today or assigned_date = v_week_start)
    and claimed = false
    and (quest_id like 'dq_walk_%' or quest_id like 'wq_walk_%');
end;
$$;

-- 探索進度：更新所有 explore 類型任務
create or replace function public.increment_explore_quests(
  p_user_id uuid,
  p_increment int default 1
)
returns void
language plpgsql
security definer
as $$
declare
  v_today      date := current_date;
  v_week_start date := date_trunc('week', current_date)::date;
begin
  if auth.uid() != p_user_id then
    raise exception 'Unauthorized';
  end if;

  update public.player_quests
  set progress = least(progress + p_increment, required)
  where user_id = p_user_id
    and (assigned_date = v_today or assigned_date = v_week_start)
    and claimed = false
    and (quest_id like 'dq_explore_%' or quest_id like 'wq_explore_%');
end;
$$;

-- 採集進度：更新所有 collect 類型任務
create or replace function public.increment_collect_quests(
  p_user_id uuid,
  p_increment int default 1
)
returns void
language plpgsql
security definer
as $$
declare
  v_today      date := current_date;
  v_week_start date := date_trunc('week', current_date)::date;
begin
  if auth.uid() != p_user_id then
    raise exception 'Unauthorized';
  end if;

  update public.player_quests
  set progress = least(progress + p_increment, required)
  where user_id = p_user_id
    and (assigned_date = v_today or assigned_date = v_week_start)
    and claimed = false
    and (quest_id like 'dq_collect_%' or quest_id like 'wq_collect_%');
end;
$$;
