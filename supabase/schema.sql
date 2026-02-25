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
  session_id uuid,
  
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
    '[{"id":"item_hp_pot","name":"小型生命藥水","type":"potion","icon":"🧪","description":"微微泛紅的初級藥水，能恢復 50 點生命值。","quantity":5},{"id":"item_herb","name":"藥草","type":"material","icon":"🌿","description":"生長在野外的普通草本植物，是煉製各類藥水的基本材料。","quantity":3}]'::jsonb,
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

-- 5. 建立野外動態事件 POI 資料表
create table public.map_pois (
  id uuid default gen_random_uuid() primary key,
  type text not null, -- 'chest', 'merchant', 'elite', 'altar'
  lat double precision not null,
  lng double precision not null,
  is_active boolean default true,
  respawn_at timestamp with time zone,
  expires_at timestamp with time zone
);

create table public.poi_claims (
  poi_id uuid not null,
  user_id uuid references auth.users not null,
  claimed_at timestamp with time zone default now(),
  primary key (poi_id, user_id)
);

-- 6. RPC: 同步並產生 POI
create or replace function public.sync_pois(center_lat double precision, center_lng double precision)
returns setof public.map_pois
language plpgsql
security definer
as $$
declare
  v_count integer;
  v_type text;
  v_lat double precision;
  v_lng double precision;
begin
  -- 刪除過期的商或祭壇，及已屆重生時間的寶箱怪
  delete from public.map_pois 
  where (is_active = true and expires_at < now()) 
     or (is_active = false and respawn_at < now());

  -- 計算玩家附近大約 3km 內的 POI 總數
  select count(*) into v_count 
  from public.map_pois 
  where lat between center_lat - 0.03 and center_lat + 0.03
    and lng between center_lng - 0.03 and center_lng + 0.03;

  -- 如果不夠 6 個，則隨機生成補滿
  while v_count < 6 loop
    v_type := (array['chest', 'merchant', 'elite', 'altar'])[floor(random() * 4 + 1)];
    v_lat := center_lat + (random() - 0.5) * 0.05;
    v_lng := center_lng + (random() - 0.5) * 0.05;
    
    insert into public.map_pois (type, lat, lng, is_active, expires_at)
    values (
      v_type, 
      v_lat, 
      v_lng, 
      true, 
      now() + interval '30 minutes'
    );
    v_count := v_count + 1;
  end loop;
  
  -- 回傳所有活躍的 POI
  return query 
  select * from public.map_pois 
  where is_active = true
    and lat between center_lat - 0.03 and center_lat + 0.03
    and lng between center_lng - 0.03 and center_lng + 0.03;
end;
$$;

-- 7. RPC: 互動並鎖定 POI
create or replace function public.interact_poi(p_poi_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_poi public.map_pois;
begin
  -- 取得目標 POI 並鎖定資料列
  select * into v_poi from public.map_pois where id = p_poi_id and is_active = true for update;
  
  if not found then
    return false;
  end if;

  -- 檢查該玩家是否已經互動過這個 POI
  if exists (select 1 from public.poi_claims where poi_id = p_poi_id and user_id = auth.uid()) then
    return false;
  end if;

  -- 記錄玩家互動
  insert into public.poi_claims (poi_id, user_id) values (p_poi_id, auth.uid());

  -- 如果是寶箱或菁英怪，則讓它立馬消失並進入 30 分鐘重生冷卻
  if v_poi.type in ('chest', 'elite') then
    update public.map_pois 
    set is_active = false, respawn_at = now() + interval '30 minutes'
    where id = p_poi_id;
  end if;

  return true;
end;
$$;
