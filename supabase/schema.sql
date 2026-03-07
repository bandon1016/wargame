-- 1. 建立角色存檔資料表
create table if not exists public.profiles (
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
  base_materials double precision default 5000, -- ??撱箇??梯祥隤踵韏琿?
  nickname text,
  uid text,
  
  -- ?啣?憭?撟??(蝚血??啁???)
  ling_qi integer default 0,
  tech_fragments integer default 0,
  incense integer default 0,
  salt_crystals integer default 0,
  premium_gems integer default 0,
  gods jsonb default '[]'::jsonb,
  active_god_id text default null,
  
  -- ?啣?雿蔭
  current_location_lat double precision default 25.0330,
  current_location_lng double precision default 121.5654,
  
  -- 銴???隞嗉????∠ JSONB ?澆?蝪∪?脣?
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
  push_settings jsonb default '{"onBattle": true, "onExplore": true, "onQuest": true, "onDeath": true}'::jsonb,
  
  -- ?怨??????(????寞? - ?航楊鋆蔭?郊)
  travel_path jsonb default null,
  travel_started_at timestamp with time zone default null,
  travel_duration_seconds double precision default null,
  
  -- 敺郊?????(????寞? - ?航楊鋆蔭?郊)
  walk_target_lat double precision default null,
  walk_target_lng double precision default null,
  walk_start_lat double precision default null,
  walk_start_lng double precision default null,
  walk_started_at timestamp with time zone default null,
  walk_duration_seconds double precision default null,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- 摰?抒????脫迫鞎鞈?
  constraint gold_positive check (gold >= 0),
  constraint mp_positive check (mp >= 0),
  constraint base_materials_positive check (base_materials >= 0),
  constraint incense_positive check (incense >= 0)
);

-- 摰鋆?甈? (?亥”撌脣??典?鋆?)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='nickname') THEN
        ALTER TABLE public.profiles ADD COLUMN nickname text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='uid') THEN
        ALTER TABLE public.profiles ADD COLUMN uid text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='push_settings') THEN
        ALTER TABLE public.profiles ADD COLUMN push_settings jsonb DEFAULT '{"onBattle": true, "onExplore": true, "onQuest": true, "onDeath": true}'::jsonb;
    END IF;
END $$;

-- 2. ??鞈???蝝??冽??(RLS)
alter table public.profiles enable row level security;

-- 3. ?啣?摮??輻?
DROP POLICY IF EXISTS "雿輻?隞交炎閬撌梁?鞈?" ON public.profiles;
create policy "雿輻?隞交炎閬撌梁?鞈?" on profiles for select using ( auth.uid() = id );

DROP POLICY IF EXISTS "雿輻?隞交?啗撌梁??箸鞈?" ON public.profiles;
create policy "雿輻?隞交?啗撌梁??箸鞈?" on profiles for update 
  using ( auth.uid() = id )
  with check ( auth.uid() = id );

DROP POLICY IF EXISTS "雿輻?隞亙遣蝡撌梁?鞈?" ON public.profiles;
create policy "雿輻?隞亙遣蝡撌梁?鞈?" on profiles for insert with check ( auth.uid() = id );

-- 4. ?芸?撱箇? Profile ?孛?澆 (?嗆?閮餃????芸?蝯虫???鞈?????
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
    -- ??撱箇? (鞈?撌亙?, 瘛?蝷血)
    '[{"id": "b1", "name": "鞈?撌亙?", "type": "material_camp", "level": 1, "baseProduction": 60, "upgradeCost": 50, "description": "?芸??Ｗ摰嗅?撱箸?", "icon": "?妤"}, {"id": "b2", "name": "瘛?蝷血", "type": "gold_mine", "level": 1, "baseProduction": 30, "upgradeCost": 100, "description": "?芸??Ｗ?馳", "icon": "??"}]'::jsonb,
    -- ????鋆?
    '[{"id":"wp_01","name":"?典?","slot":"weapon","rarity":1,"attack":5,"defense":0,"hp":0,"icon":"?儭?,"description":"?唳??????蝪⊿?甇血??},{"id":"ar_01","name":"?桃","slot":"armor","rarity":1,"attack":0,"defense":5,"hp":20,"icon":"?坏","description":"蝪∪?鋆質風?莎???敺株?靽風??}]'::jsonb,
    NULL::jsonb, -- equipped_weapon
    NULL::jsonb, -- equipped_armor
    -- ??瘨???
    '[{"id":"item_hp_pot","name":"撠???交偌","type":"potion","icon":"?妒","description":"敺桀凝瘜???蝝瘞湛??賣敺?50 暺??賢潦?,"quantity":5},{"id":"item_herb","name":"?亥?","type":"material","icon":"?","description":"??券?憭??桅??祆??抬??舐?鋆賢?憿瘞渡??箸????,"quantity":3}]'::jsonb,
    '[]'::jsonb, -- skills
    '[]'::jsonb  -- partners
  );
  return new;
end;
$$ language plpgsql security definer;

-- 蝬?閫貊?典 auth.users 銵冽
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. 撱箇?????鈭辣 POI 鞈?銵?
create table if not exists public.map_pois (
  id uuid default gen_random_uuid() primary key,
  type text not null, -- 'chest', 'merchant', 'elite', 'altar'
  lat double precision not null,
  lng double precision not null,
  is_active boolean default true,
  respawn_at timestamp with time zone,
  expires_at timestamp with time zone,
  uid_12_code text -- 憓? UID ?舀
);

-- ?? POI RLS
alter table public.map_pois enable row level security;
-- ??犖?賢隞交炎閬暑頨? POI" on map_pois for select using ( is_active = true );
DROP POLICY IF EXISTS "雿輻??賣炎閬撌梁???蝝?? ON public.poi_claims;
create table if not exists public.poi_claims (
  poi_id uuid not null,
  user_id uuid references auth.users not null,
  claimed_at timestamp with time zone default now(),
  primary key (poi_id, user_id)
);

-- ?? Claims RLS
alter table public.poi_claims enable row level security;
DROP POLICY IF EXISTS "雿輻??賣炎閬撌梁???蝝?? ON public.poi_claims;
create policy "雿輻??賣炎閬撌梁???蝝?? on poi_claims for select using ( auth.uid() = user_id );

-- 5.1 撱箇?隞餃??脣漲鞈?銵?
CREATE TABLE IF NOT EXISTS public.player_quests (
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    quest_id text NOT NULL,
    category text NOT NULL, -- 'daily', 'weekly', 'city'
    title text NOT NULL,
    description text,
    progress integer DEFAULT 0 NOT NULL,
    required integer NOT NULL,
    reward_gold integer DEFAULT 0,
    reward_exp integer DEFAULT 0,
    reward_currency_type text,
    reward_currency_amount integer DEFAULT 0,
    claimed boolean DEFAULT false NOT NULL,
    assigned_date date DEFAULT current_date NOT NULL,
    expires_at timestamp with time zone,
    PRIMARY KEY (user_id, quest_id, assigned_date)
);

ALTER TABLE public.player_quests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own quests" ON public.player_quests;
CREATE POLICY "Users can view their own quests" ON public.player_quests FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own quests (for progress)" ON public.player_quests;
CREATE POLICY "Users can update their own quests (for progress)" ON public.player_quests FOR UPDATE USING (auth.uid() = user_id);

-- 5.2 撱箇???璁翰?扯??”
CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
    id bigserial PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    nickname text,
    level integer,
    gold double precision,
    power_score integer,
    rank_type text NOT NULL, -- 'level', 'gold', 'power'
    rank_position integer NOT NULL,
    snapshot_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_date_type ON public.leaderboard_snapshots(snapshot_date, rank_type);
ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.leaderboard_snapshots;
CREATE POLICY "Enable read access for all users" ON public.leaderboard_snapshots FOR SELECT USING (true);

-- 5.3 撱箇?蝟餌絞閮剖?鞈?銵?
CREATE TABLE IF NOT EXISTS public.app_settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.app_settings;
CREATE POLICY "Enable read access for all users" ON public.app_settings FOR SELECT USING (true);

-- 6. RPC: ?郊銝衣??POI
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
  -- ?芷?????平憯??歇撅?????撖嗥拳??
  delete from public.map_pois 
  where (is_active = true and expires_at < now()) 
     or (is_active = false and respawn_at < now());

  -- 閮??拙振??憭抒? 3km ?抒? POI 蝮賣
  select count(*) into v_count 
  from public.map_pois 
  where lat between center_lat - 0.03 and center_lat + 0.03
    and lng between center_lng - 0.03 and center_lng + 0.03;

  -- 憒?銝? 6 ???璈???皛?
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
  
  -- ???暑頨? POI
  return query 
  select * from public.map_pois 
  where is_active = true
    and lat between center_lat - 0.03 and center_lat + 0.03
    and lng between center_lng - 0.03 and center_lng + 0.03;
end;
$$;

-- 7. RPC: 擃??冽批?甇亦摰嗥???(?誨?湔 Update)
-- 甇文?豢?撽?摨扳????改?銝阡??嗆???雿耨??
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
  p_push_settings jsonb default null,
  p_last_updated_at bigint default null
)
returns public.profiles
language plpgsql
security definer
as $$
declare
  v_profile public.profiles;
  v_db_updated_at_ms bigint;
  v_dist_deg double precision;
  v_meters int;
  v_gold_produced float8 := 0;
  v_mat_produced float8 := 0;
  v_b jsonb;
  v_p_id text;
  v_p jsonb;
  v_g_pm float8 := 0;
  v_m_pm float8 := 0;
  v_min float8;
begin
  -- 1. ???暹?鞈?
  select * into v_profile from public.profiles where id = auth.uid();
  
  -- 2. ?箸?啁??⊿?
  if p_lat < 21.0 or p_lat > 26.0 or p_lng < 119.0 or p_lng > 123.0 then
    raise exception '???啁?雿蔭';
  end if;

  -- 3. ?瑼Ｘ (Optimistic Locking)
  -- 雿輻 floor 蝣箔?瘥怎?蝎曉漲撠?
  v_db_updated_at_ms := floor(extract(epoch from v_profile.updated_at) * 1000);
  
  -- ?迂 5050ms ?楨銵征?誑???垢 5s ?芸?摮?撱園 + 蝬脰楝撱園
  if p_last_updated_at is not null and v_db_updated_at_ms > (p_last_updated_at + 5050) then
    -- ?銵?嚗?湔雿蔭?P/MP?頠?甇亥?頝臬?嚗?霅瑕丰隡氬遣蝭??馳銝◤???祈?撖?
    update public.profiles
    set 
        current_location_lat = p_lat,
        current_location_lng = p_lng,
        hp = p_hp,
        mp = p_mp,
        -- ?郊?怨?鞈?嚗??皞?
        travel_path = CASE WHEN p_travel_data ? 'path' THEN p_travel_data->'path' ELSE travel_path END,
        travel_started_at = CASE WHEN p_travel_data ? 'started_at' THEN (p_travel_data->>'started_at')::timestamp with time zone ELSE travel_started_at END,
        travel_duration_seconds = CASE WHEN p_travel_data ? 'duration' THEN (p_travel_data->>'duration')::double precision ELSE travel_duration_seconds END,
        -- ?郊甇亥?頝臬?嚗?摰嗆??敺?蝵株◤?遝
        walk_target_lat = CASE WHEN p_walk_data ? 'target_lat' THEN (p_walk_data->>'target_lat')::double precision ELSE walk_target_lat END,
        walk_target_lng = CASE WHEN p_walk_data ? 'target_lng' THEN (p_walk_data->>'target_lng')::double precision ELSE walk_target_lng END,
        walk_start_lat = CASE WHEN p_walk_data ? 'start_lat' THEN (p_walk_data->>'start_lat')::double precision ELSE walk_start_lat END,
        walk_start_lng = CASE WHEN p_walk_data ? 'start_lng' THEN (p_walk_data->>'start_lng')::double precision ELSE walk_start_lng END,
        walk_started_at = CASE WHEN p_walk_data ? 'started_at' THEN (p_walk_data->>'started_at')::timestamp with time zone ELSE walk_started_at END,
        walk_duration_seconds = CASE WHEN p_walk_data ? 'duration' THEN (p_walk_data->>'duration')::double precision ELSE walk_duration_seconds END,
        updated_at = now()
    where id = auth.uid()
    returning * into v_profile;
    
    return v_profile;
  end if;

  -- 3.5 ?芸?閮?蝘餃?頝 (Walk Quest)
  v_dist_deg := sqrt(pow(p_lat - v_profile.current_location_lat, 2) + pow(p_lng - v_profile.current_location_lng, 2));
  v_meters := floor(v_dist_deg * 111000);

  IF v_meters > 2 AND v_meters < 5000 THEN
    PERFORM public.increment_walk_quests(auth.uid(), v_meters, p_lat, p_lng);
  END IF;

  -- 3.6 ?芸?閮?撱箇??Ｚ (?Ｙ???蝬脫??
  -- 隞亙???桐?閮?蝬???嚗?憭折???24 撠? (1440 ??)
  v_min := EXTRACT(EPOCH FROM (now() - v_profile.updated_at)) / 60.0;
  IF v_min > 1440 THEN v_min := 1440; END IF;

  IF v_min > 0.001 THEN
    FOR v_b IN SELECT * FROM jsonb_array_elements(v_profile.buildings)
    LOOP
      DECLARE
        v_gb float8 := 0; v_mb float8 := 0;
        v_bt text := v_b->>'type'; v_bn text := v_b->>'name';
        v_bp float8 := (v_b->>'baseProduction')::float8;
      BEGIN
        FOR v_p_id IN SELECT * FROM jsonb_array_elements_text(COALESCE(v_b->'assignedPartners', '[]'::jsonb))
        LOOP
          -- 敺?丰隡?JSON 銝剖??暸?蝵桃?憭乩撈?豢?隞亥?蝞璆剖???
          SELECT pt INTO v_p FROM jsonb_array_elements(v_profile.partners) pt WHERE pt->>'id' = v_p_id;
          IF v_p IS NOT NULL THEN
            DECLARE
              v_rar int := (v_p->>'rarity')::int;
              v_rol text := v_p->>'role';
              v_m float8 := CASE WHEN v_rar = 5 THEN 0.05 WHEN v_rar = 4 THEN 0.03 ELSE 0.02 END;
            BEGIN
              IF v_rol = 'tank' AND (v_bt = 'material_camp' OR v_bn LIKE '%?%' OR v_bn LIKE '%撌亙?%') THEN
                v_mb := v_mb + v_m;
              ELSIF v_rol = 'healer' AND v_bt = 'gold_mine' THEN
                v_gb := v_gb + v_m;
              END IF;
            END;
          END IF;
        END LOOP;
        
        IF v_bt = 'gold_mine' THEN 
            v_g_pm := v_g_pm + (v_bp * (1 + v_gb));
        ELSIF v_bt = 'material_camp' THEN 
            v_m_pm := v_m_pm + (v_bp * (1 + v_mb));
        END IF;
      END;
    END LOOP;
    
    v_gold_produced := v_min * v_g_pm;
    v_mat_produced := v_min * v_m_pm;
  END IF;

  -- 4. 甇?虜?湔鞈?
  update public.profiles
  set 
    current_location_lat = p_lat,
    current_location_lng = p_lng,
    hp = p_hp,
    mp = p_mp,
    travel_path = CASE WHEN p_travel_data ? 'path' THEN p_travel_data->'path' ELSE travel_path END,
    travel_started_at = CASE WHEN p_travel_data ? 'started_at' THEN (p_travel_data->>'started_at')::timestamp with time zone ELSE travel_started_at END,
    travel_duration_seconds = CASE WHEN p_travel_data ? 'duration' THEN (p_travel_data->>'duration')::double precision ELSE travel_duration_seconds END,
    walk_target_lat = CASE WHEN p_walk_data ? 'target_lat' THEN (p_walk_data->>'target_lat')::double precision ELSE walk_target_lat END,
    walk_target_lng = CASE WHEN p_walk_data ? 'target_lng' THEN (p_walk_data->>'target_lng')::double precision ELSE walk_target_lng END,
    walk_start_lat = CASE WHEN p_walk_data ? 'start_lat' THEN (p_walk_data->>'start_lat')::double precision ELSE walk_start_lat END,
    walk_start_lng = CASE WHEN p_walk_data ? 'start_lng' THEN (p_walk_data->>'start_lng')::double precision ELSE walk_start_lng END,
    walk_started_at = CASE WHEN p_walk_data ? 'started_at' THEN (p_walk_data->>'started_at')::timestamp with time zone ELSE walk_started_at END,
    walk_duration_seconds = CASE WHEN p_walk_data ? 'duration' THEN (p_walk_data->>'duration')::double precision ELSE walk_duration_seconds END,
    active_god_id = COALESCE(p_active_god_id, active_god_id),
    partners = COALESCE(p_partners, partners),
    buildings = COALESCE(p_buildings, buildings),
    gold = COALESCE(p_gold, gold + v_gold_produced),
    base_materials = COALESCE(p_base_materials, base_materials + v_mat_produced),
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
    push_settings = COALESCE(p_push_settings, push_settings),
    updated_at = now()
  where id = auth.uid()
  returning * into v_profile;

  return v_profile;
end;
$$;

-- 8. RPC: 擃??冽折???POI ?
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
  -- 1. ??銝阡?摰?POI
  select * into v_poi from public.map_pois where id = p_poi_id and is_active = true for update;
  if not found then
    return jsonb_build_object('success', false, 'message', '鈭辣撌脫?憭?);
  end if;

  -- 2. 雿蔭撽? (頝?拙振摨扳?銝頞? 0.005 摨?
  v_dist := sqrt(pow(v_poi.lat - p_player_lat, 2) + pow(v_poi.lng - p_player_lng, 2));
  if v_dist > 0.005 then
    return jsonb_build_object('success', false, 'message', '頝?格?憭芷?');
  end if;

  -- 3. ????瑼Ｘ
  if exists (select 1 from public.poi_claims where poi_id = p_poi_id and user_id = auth.uid()) then
    return jsonb_build_object('success', false, 'message', '撌脤???甇斤???);
  end if;

  -- 4. 閮??冽??
  v_reward_gold := floor(random() * 100 + 50);
  v_reward_incense := 0;
  if v_poi.type = 'altar' then
     v_reward_incense := floor(random() * 10 + 5);
  end if;

  -- 5. ?潭?
  update public.profiles
  set 
    gold = gold + v_reward_gold,
    incense = incense + v_reward_incense
  where id = auth.uid();

  -- 6. 璅???
  insert into public.poi_claims (poi_id, user_id) values (p_poi_id, auth.uid());

  -- 7. ?? POI
  if v_poi.type in ('chest', 'elite') then
    update public.map_pois set is_active = false, respawn_at = now() + interval '30 minutes' where id = p_poi_id;
  end if;

  return jsonb_build_object(
    'success', true, 
    'gold', v_reward_gold, 
    'incense', v_reward_incense,
    'message', '????'
  );
end;
$$;

-- 8. RPC: 璆萇陛雿蔭?郊 (???桃?雿宏?芸? Payload)
create or replace function public.secure_sync_location(
  p_lat double precision,
  p_lng double precision,
  p_hp integer,
  p_mp double precision,
  p_last_updated_at bigint default null
)
returns public.profiles
language plpgsql
security definer
as $$
declare
  v_profile public.profiles;
  v_db_updated_at_ms bigint;
  v_dist_deg double precision;
  v_meters int;
begin
  -- 1. ???暹?鞈?
  select * into v_profile from public.profiles where id = auth.uid();
  
  -- 2. ?箸?啁??⊿?
  if p_lat < 21.0 or p_lat > 26.0 or p_lng < 119.0 or p_lng > 123.0 then
    raise exception '???啁?雿蔭';
  end if;

  -- 3. ?瑼Ｘ (Optimistic Locking)
  v_db_updated_at_ms := floor(extract(epoch from v_profile.updated_at) * 1000);
  
  if p_last_updated_at is not null and v_db_updated_at_ms > (p_last_updated_at + 5050) then
    update public.profiles
    set 
        current_location_lat = p_lat,
        current_location_lng = p_lng,
        hp = p_hp,
        mp = p_mp,
        updated_at = now()
    where id = auth.uid()
    returning * into v_profile;
    
    return v_profile;
  end if;

  -- 4. ?芸?閮?蝘餃?頝 (Walk Quest)
  v_dist_deg := sqrt(pow(p_lat - v_profile.current_location_lat, 2) + pow(p_lng - v_profile.current_location_lng, 2));
  v_meters := floor(v_dist_deg * 111000);

  IF v_meters > 2 AND v_meters < 5000 THEN
    PERFORM public.increment_walk_quests(auth.uid(), v_meters, p_lat, p_lng);
  END IF;

  -- 5. ?瑁??湔
  update public.profiles
  set 
    current_location_lat = p_lat,
    current_location_lng = p_lng,
    hp = p_hp,
    mp = p_mp,
    updated_at = now()
  where id = auth.uid()
  returning * into v_profile;

  return v_profile;
end;
$$;
-- ==========================================
-- 8. 裝備管理 RPC (原子性操作，防止重複或消失)
-- ==========================================
DROP FUNCTION IF EXISTS public.secure_equip_item(text, jsonb, text);
CREATE OR REPLACE FUNCTION public.secure_equip_item(
  p_equip_id text DEFAULT NULL,
  p_equipment_inventory jsonb DEFAULT NULL,
  p_slot text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_current_equipped jsonb;
  v_new_inventory jsonb;
  v_eq_to_equip jsonb;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', '找不到玩家資料'); END IF;

  IF p_slot = 'weapon' THEN v_current_equipped := v_profile.equipped_weapon;
  ELSIF p_slot = 'armor' THEN v_current_equipped := v_profile.equipped_armor;
  ELSIF p_slot = 'helmet' THEN v_current_equipped := v_profile.equipped_helmet;
  ELSIF p_slot = 'boots' THEN v_current_equipped := v_profile.equipped_boots;
  ELSIF p_slot = 'accessory' THEN v_current_equipped := v_profile.equipped_accessory;
  ELSE RETURN jsonb_build_object('success', false, 'message', '無效的裝備槽位'); END IF;

  v_new_inventory := COALESCE(p_equipment_inventory, v_profile.equipment);

  IF p_equip_id IS NULL THEN
    IF v_current_equipped IS NOT NULL THEN v_new_inventory := v_new_inventory || jsonb_build_array(v_current_equipped); END IF;
    UPDATE public.profiles SET 
      equipped_weapon = CASE WHEN p_slot = 'weapon' THEN NULL ELSE equipped_weapon END,
      equipped_armor = CASE WHEN p_slot = 'armor' THEN NULL ELSE equipped_armor END,
      equipped_helmet = CASE WHEN p_slot = 'helmet' THEN NULL ELSE equipped_helmet END,
      equipped_boots = CASE WHEN p_slot = 'boots' THEN NULL ELSE equipped_boots END,
      equipped_accessory = CASE WHEN p_slot = 'accessory' THEN NULL ELSE equipped_accessory END,
      equipment = v_new_inventory, updated_at = now()
    WHERE id = auth.uid() RETURNING * INTO v_profile;
  ELSE
    SELECT elem INTO v_eq_to_equip FROM jsonb_array_elements(v_new_inventory) AS elem WHERE (elem->>'id') = p_equip_id LIMIT 1;
    IF v_eq_to_equip IS NULL THEN RETURN jsonb_build_object('success', false, 'message', '找不到指定裝備於背包中'); END IF;
    WITH removed AS (SELECT idx FROM jsonb_array_elements(v_new_inventory) WITH ORDINALITY AS t(elem, idx) WHERE (elem->>'id') = p_equip_id ORDER BY idx LIMIT 1)
    SELECT jsonb_agg(elem ORDER BY idx) INTO v_new_inventory FROM (SELECT idx, elem FROM jsonb_array_elements(v_new_inventory) WITH ORDINALITY AS t(elem, idx) WHERE idx NOT IN (SELECT idx FROM removed)) s;
    IF v_current_equipped IS NOT NULL THEN v_new_inventory := COALESCE(v_new_inventory, '[]'::jsonb) || jsonb_build_array(v_current_equipped); END IF;
    UPDATE public.profiles SET 
      equipped_weapon = CASE WHEN p_slot = 'weapon' THEN v_eq_to_equip ELSE equipped_weapon END,
      equipped_armor = CASE WHEN p_slot = 'armor' THEN v_eq_to_equip ELSE equipped_armor END,
      equipped_helmet = CASE WHEN p_slot = 'helmet' THEN v_eq_to_equip ELSE equipped_helmet END,
      equipped_boots = CASE WHEN p_slot = 'boots' THEN v_eq_to_equip ELSE equipped_boots END,
      equipped_accessory = CASE WHEN p_slot = 'accessory' THEN v_eq_to_equip ELSE equipped_accessory END,
      equipment = v_new_inventory, updated_at = now()
    WHERE id = auth.uid() RETURNING * INTO v_profile;
  END IF;
  RETURN jsonb_build_object('success', true, 'updated_profile', row_to_json(v_profile)::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.secure_equip_item(text, jsonb, text) TO authenticated;

-- ==========================================
-- 9. POI 互動相關 RPC
-- ==========================================
DROP FUNCTION IF EXISTS public.interact_poi(uuid);
CREATE OR REPLACE FUNCTION public.interact_poi(p_poi_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.map_pois SET is_active = false, respawn_at = now() + interval '30 minutes' WHERE id = p_poi_id AND is_active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', '該聖地已消失或已被領取'); END IF;
  INSERT INTO public.poi_claims (poi_id, user_id, claimed_at) VALUES (p_poi_id, auth.uid(), now()) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.interact_poi(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.resolve_poi_combat(uuid, boolean);
CREATE OR REPLACE FUNCTION public.resolve_poi_combat(p_poi_id uuid, p_win boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_win THEN UPDATE public.map_pois SET is_active = false, respawn_at = now() + interval '1 hour' WHERE id = p_poi_id; END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_poi_combat(uuid, boolean) TO authenticated;

-- ==========================================
-- 10. 任務進度擴充 RPC
-- ==========================================
DROP FUNCTION IF EXISTS public.increment_craft_quests(uuid, int);
CREATE OR REPLACE FUNCTION public.increment_craft_quests(p_user_id uuid, p_increment int DEFAULT 1) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() != p_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.player_quests SET progress = LEAST(progress + p_increment, required) WHERE user_id = p_user_id AND (assigned_date = current_date OR assigned_date = date_trunc('week', current_date)::date) AND claimed = false AND (quest_id LIKE 'dq_craft_%' OR quest_id LIKE 'wq_craft_%' OR quest_id LIKE 'cq_%_craft');
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_craft_quests(uuid, int) TO authenticated;

DROP FUNCTION IF EXISTS public.increment_travel_quests(uuid, int);
CREATE OR REPLACE FUNCTION public.increment_travel_quests(p_user_id uuid, p_increment int DEFAULT 1) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() != p_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.player_quests SET progress = LEAST(progress + p_increment, required) WHERE user_id = p_user_id AND (assigned_date = current_date OR assigned_date = date_trunc('week', current_date)::date) AND claimed = false AND (quest_id LIKE 'dq_travel_%' OR quest_id LIKE 'wq_travel_%' OR quest_id LIKE 'cq_%_travel');
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_travel_quests(uuid, int) TO authenticated;

-- ==========================================
-- 11. SECURE ENCOUNTER CHECK (修復歧義與編碼)
-- ==========================================
DROP FUNCTION IF EXISTS public.secure_check_encounter(text, boolean);
DROP FUNCTION IF EXISTS public.secure_check_encounter(boolean, text, double precision, double precision);
DROP FUNCTION IF EXISTS public.secure_check_encounter(text, boolean, double precision, double precision);

CREATE OR REPLACE FUNCTION public.secure_check_encounter(
    p_weather text, 
    p_force boolean DEFAULT false,
    p_lat float8 DEFAULT NULL,
    p_lng float8 DEFAULT NULL
)
RETURNS jsonb 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE 
    v_roll float := random(); 
    v_threshold float; 
    v_res text := 'none';
BEGIN
    v_threshold := CASE 
        WHEN p_weather IN ('sunny', 'clear') THEN 0.08 
        WHEN p_weather = 'rainy' THEN 0.10 
        WHEN p_weather IN ('stormy', 'foggy') THEN 0.15 
        ELSE 0.10 
    END;

    IF p_force OR v_roll < v_threshold THEN
        v_res := 'normal';
        IF p_weather IN ('stormy', 'foggy') AND random() < 0.05 THEN v_res := 'weather_special'; END IF;
    END IF;
    RETURN jsonb_build_object('result', v_res, 'weather', p_weather);
END; $$;

GRANT EXECUTE ON FUNCTION public.secure_check_encounter(text, boolean, float8, float8) TO authenticated;
GRANT EXECUTE ON FUNCTION public.secure_check_encounter(text, boolean, float8, float8) TO anon;