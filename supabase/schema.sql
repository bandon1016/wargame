-- 1. 建立角色存檔表
create table public.profiles (
  id uuid references auth.users not null primary key,
  level integer default 1,
  exp integer default 0,
  max_exp integer default 100,
  hp integer default 100,
  max_hp integer default 100,
  attack integer default 12,
  defense integer default 4,
  gold double precision default 500,
  base_materials double precision default 120,
  
  -- 地圖位置
  current_location_lat double precision default 25.0330,
  current_location_lng double precision default 121.5654,
  
  -- 複雜的陣列物件資料，採用 JSONB 格式簡單儲存
  buildings jsonb default '[]'::jsonb,
  equipment jsonb default '[]'::jsonb,
  equipped_weapon jsonb,
  equipped_armor jsonb,
  equipped_helmet jsonb,
  equipped_boots jsonb,
  equipped_accessory jsonb,
  items jsonb default '[]'::jsonb,
  skills jsonb default '[]'::jsonb,
  partners jsonb default '[]'::jsonb,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. 開啟資料列等級安全控制 (RLS)
alter table public.profiles enable row level security;

-- 3. 新增存取政策：使用者只能讀取和修改自己的存檔
create policy "使用者可以檢視自己的資料" on profiles for select using ( auth.uid() = id );
create policy "使用者可以更新自己的資料" on profiles for update using ( auth.uid() = id );
create policy "使用者可以建立自己的資料" on profiles for insert with check ( auth.uid() = id );

-- 4. 自動建立 Profile 的觸發器 (當新會員註冊時，自動給予初始資源與裝備)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, buildings, equipment, equipped_weapon, equipped_armor, items, skills, partners)
  values (
    new.id,
    -- 初始建築 (資源工坊, 淘金礦場)
    '[{"id": "b1", "name": "資源工坊", "type": "material_camp", "level": 1, "baseProduction": 60, "upgradeCost": 50, "description": "自動產出家園建材", "icon": "🧱"}, {"id": "b2", "name": "淘金礦場", "type": "gold_mine", "level": 1, "baseProduction": 30, "upgradeCost": 100, "description": "自動產出金幣", "icon": "⛏️"}]'::jsonb,
    -- 背包初始裝備
    '[{"id":"wp_01","name":"木劍","slot":"weapon","rarity":1,"attack":5,"defense":0,"hp":0,"icon":"🗡️","description":"新手冒險者必備的簡陋武器。"},{"id":"ar_01","name":"皮甲","slot":"armor","rarity":1,"attack":0,"defense":5,"hp":20,"icon":"🧥","description":"簡單的皮製護甲，提供微薄保護。"}]'::jsonb,
    -- 初始裝上的武器
    '{"id":"wp_01","name":"木劍","slot":"weapon","rarity":1,"attack":5,"defense":0,"hp":0,"icon":"🗡️","description":"新手冒險者必備的簡陋武器。"}'::jsonb,
    -- 初始裝上的護甲
    '{"id":"ar_01","name":"皮甲","slot":"armor","rarity":1,"attack":0,"defense":5,"hp":20,"icon":"🧥","description":"簡單的皮製護甲，提供微薄保護。"}'::jsonb,
    -- 初始消耗道具
    '[{"id":"it_01","name":"小型生命藥水","type":"potion","rarity":1,"icon":"🧪","description":"恢復 50 點生命值。","quantity":5},{"id":"it_05","name":"普通的藥草","type":"material","rarity":1,"icon":"🌿","description":"散發淡淡清香的藥草，可作為合成材料。","quantity":3}]'::jsonb,
    -- 技能
    '[]'::jsonb,
    -- 夥伴
    '[]'::jsonb
  );
  return new;
end;
$$ language plpgsql security definer;

-- 綁定觸發器到 auth.users 表格
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
