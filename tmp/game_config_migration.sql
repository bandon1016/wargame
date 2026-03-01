-- ====================================================
-- 全域遊戲配置系統 (伺服器統一天氣)
-- ====================================================

-- 1. 建立遊戲配置表
create table if not exists public.game_config (
  key   text primary key,
  value jsonb not null
);

-- 2. 插入初始天氣
insert into public.game_config (key, value)
values ('weather', '"sunny"'::jsonb)
on conflict (key) do nothing;

-- 3. 啟用 RLS
alter table public.game_config enable row level security;

-- 4. 讀取權限：所有人都可以讀取配置
create policy "Anyone can read game config" on public.game_config
  for select using (true);

-- 5. 修改權限：此處暫不設定特定人員修改，若有需要可限制特定 UUID
-- 目前先允許所有「已登入使用者」更新天氣，實現分散式更新 (無須後端 Worker)
create policy "Authenticated users can update game config" on public.game_config
  for update using (auth.uid() is not null);
