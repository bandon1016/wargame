-- ====================================================
-- 每日任務系統 - Supabase Migration
-- 請在 Supabase SQL Editor 中執行此腳本
-- ====================================================

-- 1. 建立 player_quests 資料表
create table if not exists public.player_quests (
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  quest_id      text        not null,
  period        text        not null check (period in ('daily', 'weekly')),
  progress      int         not null default 0,
  required      int         not null,
  claimed       boolean     not null default false,
  assigned_date date        not null,
  primary key (user_id, quest_id, assigned_date)
);

-- 2. 啟用 RLS
alter table public.player_quests enable row level security;

-- 3. RLS Policy: 只允許玩家讀寫自己的任務
create policy "player_quests_own_rw" on public.player_quests
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ====================================================
-- 4. RPC: get_or_reset_daily_quests
--    自動判斷今日/本週是否需要新增任務，並回傳當前任務清單
-- ====================================================
create or replace function public.get_or_reset_daily_quests(p_user_id uuid)
returns table (
  quest_id      text,
  period        text,
  progress      int,
  required      int,
  claimed       boolean,
  assigned_date date
)
language plpgsql
security definer
as $$
declare
  v_today       date := current_date;
  v_week_start  date := date_trunc('week', current_date)::date;
  v_daily_count int;
  v_weekly_count int;
begin
  -- 確保 user_id 是本人
  if auth.uid() != p_user_id then
    raise exception 'Unauthorized';
  end if;

  -- 檢查今日每日任務數量
  select count(*) into v_daily_count
  from public.player_quests
  where user_id = p_user_id
    and period = 'daily'
    and assigned_date = v_today;

  -- 如果今日沒有每日任務，隨機從任務 ID 池中抽取 3 個
  if v_daily_count = 0 then
    -- 任務池：從前端定義的 ID 中固定抽取（前端同步）
    -- 這裡插入佔位 ID，前端會用 quest_id 對應任務定義
    with daily_pool(id, req) as (
      values
        ('dq_kill_slime',    5),
        ('dq_kill_goblin',   3),
        ('dq_walk_500',    500),
        ('dq_walk_1000',  1000),
        ('dq_explore_poi',   2),
        ('dq_collect_mat',   3)
    ),
    shuffled as (
      select id, req from daily_pool order by random() limit 3
    )
    insert into public.player_quests (user_id, quest_id, period, required, assigned_date)
    select p_user_id, id, 'daily', req, v_today
    from shuffled
    on conflict do nothing;
  end if;

  -- 檢查本週每週任務
  select count(*) into v_weekly_count
  from public.player_quests
  where user_id = p_user_id
    and period = 'weekly'
    and assigned_date = v_week_start;

  if v_weekly_count = 0 then
    with weekly_pool(id, req) as (
      values
        ('wq_kill_boss',     3),
        ('wq_walk_5000',  5000),
        ('wq_collect_rare',  5)
    ),
    picked as (
      select id, req from weekly_pool order by random() limit 1
    )
    insert into public.player_quests (user_id, quest_id, period, required, assigned_date)
    select p_user_id, id, 'weekly', req, v_week_start
    from picked
    on conflict do nothing;
  end if;

  -- 回傳今日每日任務 + 本週每週任務
  return query
    select q.quest_id, q.period, q.progress, q.required, q.claimed, q.assigned_date
    from public.player_quests q
    where q.user_id = p_user_id
      and (
        (q.period = 'daily'  and q.assigned_date = v_today)
        or
        (q.period = 'weekly' and q.assigned_date = v_week_start)
      )
    order by q.period desc, q.quest_id;
end;
$$;

-- 5. RPC: update_quest_progress (更新進度)
create or replace function public.update_quest_progress(
  p_user_id uuid,
  p_quest_id text,
  p_assigned_date date,
  p_increment int default 1
)
returns void
language plpgsql
security definer
as $$
begin
  if auth.uid() != p_user_id then
    raise exception 'Unauthorized';
  end if;

  update public.player_quests
  set progress = least(progress + p_increment, required)
  where user_id = p_user_id
    and quest_id = p_quest_id
    and assigned_date = p_assigned_date
    and claimed = false;
end;
$$;

-- 6. RPC: claim_quest_reward (領取獎勵，標記為已領)
create or replace function public.claim_quest_reward(
  p_user_id uuid,
  p_quest_id text,
  p_assigned_date date
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_quest public.player_quests;
begin
  if auth.uid() != p_user_id then
    raise exception 'Unauthorized';
  end if;

  select * into v_quest
  from public.player_quests
  where user_id = p_user_id
    and quest_id = p_quest_id
    and assigned_date = p_assigned_date;

  if not found then
    raise exception 'Quest not found';
  end if;

  if v_quest.claimed then
    raise exception 'Already claimed';
  end if;

  if v_quest.progress < v_quest.required then
    raise exception 'Quest not completed';
  end if;

  update public.player_quests
  set claimed = true
  where user_id = p_user_id
    and quest_id = p_quest_id
    and assigned_date = p_assigned_date;

  return jsonb_build_object('success', true, 'quest_id', p_quest_id);
end;
$$;
