-- ====================================================
-- 城市任務系統擴充 - Supabase Migration
-- ====================================================

-- 修改 player_quests 支援 cityId (非必要，因為可以用 quest_id 前綴識別，但加了方便管理)
-- 不過我們保持 table 結構簡單，直接用 quest_id 即可。

-- 修改 get_or_reset_daily_quests 以支援自動分配城市任務
create or replace function public.get_or_reset_daily_quests(p_user_id uuid, p_city_id text default null)
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
  v_city_count int;
begin
  if auth.uid() != p_user_id then
    raise exception 'Unauthorized';
  end if;

  -- 1. 原有的每日任務邏輯
  select count(*) into v_daily_count
  from public.player_quests q
  where q.user_id = p_user_id
    and q.period = 'daily'
    and q.assigned_date = v_today
    and q.quest_id like 'dq_%';

  if v_daily_count = 0 then
    insert into public.player_quests (user_id, quest_id, period, required, assigned_date)
    select p_user_id, pool.id, 'daily', pool.req, v_today
    from (
      values
        ('dq_kill_slime',    5),
        ('dq_kill_goblin',   3),
        ('dq_walk_500',    500),
        ('dq_walk_1000',  1000),
        ('dq_explore_poi',   2),
        ('dq_collect_mat',   3)
    ) as pool(id, req)
    order by random() limit 3
    on conflict do nothing;
  end if;

  -- 2. 每週任務邏輯
  select count(*) into v_weekly_count
  from public.player_quests q
  where q.user_id = p_user_id
    and q.period = 'weekly'
    and q.assigned_date = v_week_start;

  if v_weekly_count = 0 then
    insert into public.player_quests (user_id, quest_id, period, required, assigned_date)
    select p_user_id, pool.id, 'weekly', pool.req, v_week_start
    from (
      values
        ('wq_kill_boss',     3),
        ('wq_walk_5000',  5000),
        ('wq_collect_rare',  5)
    ) as pool(id, req)
    order by random() limit 1
    on conflict do nothing;
  end if;

  -- 3. 城市專屬任務邏輯
  if p_city_id is not null then
    select count(*) into v_city_count
    from public.player_quests q
    where q.user_id = p_user_id
      and q.assigned_date = v_today
      and (q.quest_id like 'cq_' || substr(p_city_id, 6) || '_%' or q.quest_id like 'cq_' || p_city_id || '_%');

    if v_city_count = 0 then
        insert into public.player_quests (user_id, quest_id, period, required, assigned_date)
        select p_user_id, pool.id, 'daily', pool.req, v_today
        from (
            values
                ('town_tpe', 'cq_tpe_101', 5),
                ('town_tpe', 'cq_tpe_walk', 1500),
                ('town_ntpc', 'cq_ntpc_kill', 5),
                ('town_ntpc', 'cq_ntpc_collect', 3),
                ('town_tyn', 'cq_tyn_train', 1),
                ('town_tyn', 'cq_tyn_slime', 5),
                ('town_txg', 'cq_txg_iron', 5),
                ('town_txg', 'cq_txg_altar', 1),
                ('town_tnn', 'cq_tnn_altar', 2),
                ('town_tnn', 'cq_tnn_ghost', 3),
                ('town_khh', 'cq_khh_kill', 5),
                ('town_khh', 'cq_khh_collect', 3),
                ('town_pif', 'cq_pif_slime', 5),
                ('town_pif', 'cq_pif_walk', 2000),
                ('town_hun', 'cq_hun_crystal', 3),
                ('town_hun', 'cq_hun_walk', 2000),
                ('town_ttu', 'cq_ttu_crystal', 3)
        ) as pool(city, id, req)
        where pool.city = p_city_id
        on conflict do nothing;
    end if;
  end if;

  -- 回傳今日所有活躍任務
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

-- 4. 修正進度更新 RPC 以支援城市任務 (cq_ 前綴)

-- 走路進度
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
    and (quest_id like 'dq_walk_%' or quest_id like 'wq_walk_%' or quest_id like 'cq_%_walk' or quest_id like 'cq_%_weekly');
end;
$$;

-- 探索進度
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
    and (quest_id like 'dq_explore_%' or quest_id like 'wq_explore_%' or quest_id like 'cq_%_explore' or quest_id like 'cq_%_altar' or quest_id like 'cq_%_weekly');
end;
$$;

-- 採集進度
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
    and (quest_id like 'dq_collect_%' or quest_id like 'wq_collect_%' or quest_id like 'cq_%_collect' or quest_id like 'cq_%_weekly');
end;
$$;
