-- 1. 建立角色存檔表
create table public.profiles (
  id uuid references auth.users not null primary key,
  level integer default 1,
  exp integer default 0,
  max_exp integer default 100,
  hp integer default 100,
  max_hp integer default 100,
  mp double precision default 50,
  max_mp integer default 50,
  attack integer default 12,
  defense integer default 4,
  gold double precision default 500,
  base_materials double precision default 5000, -- 配合建築花費調整起點
  
  -- 新增多元幣值 (符合台灣故事背景)
  ling_qi integer default 0,
  tech_fragments integer default 0,
  incense integer default 0,
  salt_crystals integer default 0,
  premium_gems integer default 0,
  gods jsonb default '[]'::jsonb,
  active_god_id text default null,
  
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
  
  -- 火車旅行狀態 (時間倒數方案 - 可跨裝置同步)
  travel_path jsonb default null,
  travel_started_at timestamp with time zone default null,
  travel_duration_seconds double precision default null,
  
  -- 徒步旅行狀態 (時間倒數方案 - 可跨裝置同步)
  walk_target_lat double precision default null,
  walk_target_lng double precision default null,
  walk_start_lat double precision default null,
  walk_start_lng double precision default null,
  walk_started_at timestamp with time zone default null,
  walk_duration_seconds double precision default null,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- 安全性約束：防止負數資源
  constraint gold_positive check (gold >= 0),
  constraint mp_positive check (mp >= 0),
  constraint base_materials_positive check (base_materials >= 0),
  constraint incense_positive check (incense >= 0)
);

-- 2. 開啟資料列等級安全控制 (RLS)
alter table public.profiles enable row level security;

-- 3. 新增存取政策
create policy "使用者可以檢視自己的資料" on profiles for select using ( auth.uid() = id );
create policy "使用者可以更新自己的基本資料" on profiles for update 
  using ( auth.uid() = id )
  with check ( auth.uid() = id );
create policy "使用者可以建立自己的資料" on profiles for insert with check ( auth.uid() = id );

-- 4. 自動建立 Profile 的觸發器 (當新會員註冊時，自動給予初始資源與裝備)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id, 
    nickname, 
    gold,
    base_materials,
    ling_qi,
    tech_fragments,
    incense,
    salt_crystals,
    premium_gems,
    gods,
    active_god_id,
    buildings, 
    equipment, 
    equipped_weapon, 
    equipped_armor, 
    items, 
    skills, 
    partners
  )
  values (
    new.id,
    new.raw_user_meta_data->>'nickname',
    5000, -- gold
    2000, -- base_materials
    0, 0, 0, 0, 0, -- ling_qi, tech_fragments, incense, salt_crystals, premium_gems
    '[]'::jsonb, -- gods
    null,        -- active_god_id
    -- 初始建築 (資源工坊, 淘金礦場)
    '[{"id": "b1", "name": "資源工坊", "type": "material_camp", "level": 1, "baseProduction": 60, "upgradeCost": 50, "description": "自動產出家園建材", "icon": "🧱"}, {"id": "b2", "name": "淘金礦場", "type": "gold_mine", "level": 1, "baseProduction": 30, "upgradeCost": 100, "description": "自動產出金幣", "icon": "⛏️"}]'::jsonb,
    -- 背包初始裝備
    '[{"id":"wp_01","name":"木劍","slot":"weapon","rarity":1,"attack":5,"defense":0,"hp":0,"icon":"🗡️","description":"新手冒險者必備的簡陋武器。"},{"id":"ar_01","name":"皮甲","slot":"armor","rarity":1,"attack":0,"defense":5,"hp":20,"icon":"🧥","description":"簡單的皮製護甲，提供微薄保護。"}]'::jsonb,
    NULL::jsonb, -- equipped_weapon
    NULL::jsonb, -- equipped_armor
    -- 初始消耗道具
    '[{"id":"item_hp_pot","name":"小型生命藥水","type":"potion","icon":"🧪","description":"微微泛紅的初級藥水，能恢復 50 點生命值。","quantity":5},{"id":"item_herb","name":"藥草","type":"material","icon":"🌿","description":"生長在野外的普通草本植物，是煉製各類藥水的基本材料。","quantity":3}]'::jsonb,
    '[]'::jsonb, -- skills
    '[]'::jsonb  -- partners
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
  expires_at timestamp with time zone,
  uid_12_code text -- 增加 UID 支援
);

-- 開啟 POI RLS
alter table public.map_pois enable row level security;
create policy "所有人都可以檢視活躍的 POI" on map_pois for select using ( is_active = true );

create table public.poi_claims (
  poi_id uuid not null,
  user_id uuid references auth.users not null,
  claimed_at timestamp with time zone default now(),
  primary key (poi_id, user_id)
);

-- 開啟 Claims RLS
alter table public.poi_claims enable row level security;
create policy "使用者只能檢視自己的領取紀錄" on poi_claims for select using ( auth.uid() = user_id );

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

-- 7. RPC: 高安全性同步玩家狀態 (取代直接 Update)
-- 此函數會驗證座標有效性，並限制敏感欄位修改
create or replace function public.secure_sync_profile(
  p_lat double precision,
  p_lng double precision,
  p_hp integer,
  p_mp double precision,
  p_travel_data jsonb default null,
  p_walk_data jsonb default null,
  p_active_god_id text default null,
  p_partners jsonb default null,
  p_buildings jsonb default null,
  p_gold double precision default null,
  p_base_materials double precision default null,
  p_equipment jsonb default null,
  p_items jsonb default null,
  p_skills jsonb default null,
  p_gods jsonb default null,
  p_equipped_weapon jsonb default null,
  p_equipped_armor jsonb default null,
  p_equipped_helmet jsonb default null,
  p_equipped_boots jsonb default null,
  p_equipped_accessory jsonb default null,
  p_ling_qi integer default null,
  p_tech_fragments integer default null,
  p_incense integer default null,
  p_salt_crystals integer default null,
  p_premium_gems integer default null,
  p_last_updated_at bigint default null
)
returns public.profiles
language plpgsql
security definer
as $$
declare
  v_profile public.profiles;
  v_db_updated_at_ms bigint;
begin
  -- 1. 取得現有資料
  select * into v_profile from public.profiles where id = auth.uid();
  
  -- 2. 基本地理校驗
  if p_lat < 21.0 or p_lat > 26.0 or p_lng < 119.0 or p_lng > 123.0 then
    raise exception '非法地理位置';
  end if;

  -- 3. 版本檢核 (Optimistic Locking)
  -- 使用 floor 確保毫秒精度對齊
  v_db_updated_at_ms := floor(extract(epoch from v_profile.updated_at) * 1000);
  
  -- 允許 5050ms 的緩衝空間以應對前端 5s 自動存檔延遲 + 網路延遲
  if p_last_updated_at is not null and v_db_updated_at_ms > (p_last_updated_at + 5050) then
    -- 版本衝突：只更新位置、HP/MP 與步行路徑，保護夥伴、建築與金幣不被舊版本覆寫
    update public.profiles
    set 
        current_location_lat = p_lat,
        current_location_lng = p_lng,
        hp = p_hp,
        mp = p_mp,
        -- 同步步行路徑，避免玩家抵達目的地後位置被回滾
        walk_target_lat = COALESCE((p_walk_data->>'target_lat')::double precision, walk_target_lat),
        walk_target_lng = COALESCE((p_walk_data->>'target_lng')::double precision, walk_target_lng),
        walk_start_lat = COALESCE((p_walk_data->>'start_lat')::double precision, walk_start_lat),
        walk_start_lng = COALESCE((p_walk_data->>'start_lng')::double precision, walk_start_lng),
        walk_started_at = COALESCE((p_walk_data->>'started_at')::timestamp with time zone, walk_started_at),
        walk_duration_seconds = COALESCE((p_walk_data->>'duration')::double precision, walk_duration_seconds),
        updated_at = now()
    where id = auth.uid()
    returning * into v_profile;
    
    return v_profile;
  end if;

  -- 4. 正常更新資料
  update public.profiles
  set 
    current_location_lat = p_lat,
    current_location_lng = p_lng,
    hp = p_hp,
    mp = p_mp,
    travel_path = COALESCE(p_travel_data->'path', travel_path),
    travel_started_at = COALESCE((p_travel_data->>'started_at')::timestamp with time zone, travel_started_at),
    travel_duration_seconds = COALESCE((p_travel_data->>'duration')::double precision, travel_duration_seconds),
    walk_target_lat = COALESCE((p_walk_data->>'target_lat')::double precision, walk_target_lat),
    walk_target_lng = COALESCE((p_walk_data->>'target_lng')::double precision, walk_target_lng),
    walk_start_lat = COALESCE((p_walk_data->>'start_lat')::double precision, walk_start_lat),
    walk_start_lng = COALESCE((p_walk_data->>'start_lng')::double precision, walk_start_lng),
    walk_started_at = COALESCE((p_walk_data->>'started_at')::timestamp with time zone, walk_started_at),
    walk_duration_seconds = COALESCE((p_walk_data->>'duration')::double precision, walk_duration_seconds),
    active_god_id = p_active_god_id,
    partners = COALESCE(p_partners, partners),
    buildings = COALESCE(p_buildings, buildings),
    gold = COALESCE(p_gold, gold),
    base_materials = COALESCE(p_base_materials, base_materials),
    equipment = COALESCE(p_equipment, equipment),
    items = COALESCE(p_items, items),
    skills = COALESCE(p_skills, skills),
    gods = COALESCE(p_gods, gods),
    equipped_weapon = COALESCE(p_equipped_weapon, equipped_weapon),
    equipped_armor = COALESCE(p_equipped_armor, equipped_armor),
    equipped_helmet = COALESCE(p_equipped_helmet, equipped_helmet),
    equipped_boots = COALESCE(p_equipped_boots, equipped_boots),
    equipped_accessory = COALESCE(p_equipped_accessory, equipped_accessory),
    ling_qi = COALESCE(p_ling_qi, ling_qi),
    tech_fragments = COALESCE(p_tech_fragments, tech_fragments),
    incense = COALESCE(p_incense, incense),
    salt_crystals = COALESCE(p_salt_crystals, salt_crystals),
    premium_gems = COALESCE(p_premium_gems, premium_gems),
    updated_at = now()
  where id = auth.uid()
  returning * into v_profile;

  return v_profile;
end;
$$;

-- 8. RPC: 高安全性領取 POI 獎勵
create or replace function public.secure_claim_poi(p_poi_id uuid, p_player_lat double precision, p_player_lng double precision)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_poi public.map_pois;
  v_dist double precision;
  v_reward_gold integer;
  v_reward_incense integer;
begin
  -- 1. 取得並鎖定 POI
  select * into v_poi from public.map_pois where id = p_poi_id and is_active = true for update;
  if not found then
    return jsonb_build_object('success', false, 'message', '事件已消失');
  end if;

  -- 2. 位置驗證 (距離玩家座標不可超過 0.005 度)
  v_dist := sqrt(pow(v_poi.lat - p_player_lat, 2) + pow(v_poi.lng - p_player_lng, 2));
  if v_dist > 0.005 then
    return jsonb_build_object('success', false, 'message', '距離目標太遠');
  end if;

  -- 3. 重複領取檢查
  if exists (select 1 from public.poi_claims where poi_id = p_poi_id and user_id = auth.uid()) then
    return jsonb_build_object('success', false, 'message', '已領取過此獎勵');
  end if;

  -- 4. 計算隨機獎勵
  v_reward_gold := floor(random() * 100 + 50);
  v_reward_incense := 0;
  if v_poi.type = 'altar' then
     v_reward_incense := floor(random() * 10 + 5);
  end if;

  -- 5. 發放獎勵
  update public.profiles
  set 
    gold = gold + v_reward_gold,
    incense = incense + v_reward_incense
  where id = auth.uid();

  -- 6. 標記領取
  insert into public.poi_claims (poi_id, user_id) values (p_poi_id, auth.uid());

  -- 7. 關閉 POI
  if v_poi.type in ('chest', 'elite') then
    update public.map_pois set is_active = false, respawn_at = now() + interval '30 minutes' where id = p_poi_id;
  end if;

  return jsonb_build_object(
    'success', true, 
    'gold', v_reward_gold, 
    'incense', v_reward_incense,
    'message', '領取成功'
  );
end;
$$;
