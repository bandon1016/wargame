-- 1. 安全確保: 為 profiles 增加缺失欄位
DO  
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
END ;

-- 2. 建立缺失存檔資料表 (使用 IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.player_quests (
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    quest_id text NOT NULL,
    category text NOT NULL,
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

CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
    id bigserial PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    nickname text,
    level integer,
    gold double precision,
    power_score integer,
    rank_type text NOT NULL,
    rank_position integer NOT NULL,
    snapshot_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. 建立及修復缺失的索引
CREATE INDEX IF NOT EXISTS idx_leaderboard_date_type ON public.leaderboard_snapshots(snapshot_date, rank_type);

-- 安全性權限設定 (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "使用者可以檢視自己的資料" ON public.profiles;
CREATE POLICY "使用者可以檢視自己的資料" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "使用者可以更新自己的基本屬性資料" ON public.profiles;
CREATE POLICY "使用者可以更新自己的基本屬性資料" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "使用者可以建立自己的玩家資料" ON public.profiles;
CREATE POLICY "使用者可以建立自己的玩家資料" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

ALTER TABLE public.player_quests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own quests" ON public.player_quests;
CREATE POLICY "Users can view their own quests" ON public.player_quests FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own quests (for progress)" ON public.player_quests;
CREATE POLICY "Users can update their own quests (for progress)" ON public.player_quests FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.leaderboard_snapshots;
CREATE POLICY "Enable read access for all users" ON public.leaderboard_snapshots FOR SELECT USING (true);

-- 4. 更新 secure_sync_profile 核心同步函式
CREATE OR REPLACE FUNCTION public.secure_sync_profile(
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
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS 
DECLARE
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
BEGIN
  -- 1. 讀取現有資料
  select * into v_profile from public.profiles where id = auth.uid();
  
  -- 2. 範圍座標檢查
  if p_lat < 21.0 or p_lat > 26.0 or p_lng < 119.0 or p_lng > 123.0 then
    raise exception '非法地理座標位置';
  end if;

  -- 3. 衝突檢測 (Optimistic Locking)
  v_db_updated_at_ms := floor(extract(epoch from v_profile.updated_at) * 1000);
  
  if p_last_updated_at is not null and v_db_updated_at_ms > (p_last_updated_at + 5050) then
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
        updated_at = now()
    where id = auth.uid()
    returning * into v_profile;
    
    return v_profile;
  end if;

  -- 3.5 走路任務里程增加
  v_dist_deg := sqrt(pow(p_lat - v_profile.current_location_lat, 2) + pow(p_lng - v_profile.current_location_lng, 2));
  v_meters := floor(v_dist_deg * 111000);

  IF v_meters > 2 AND v_meters < 5000 THEN
    BEGIN
        PERFORM public.increment_walk_quests(auth.uid(), v_meters, p_lat, p_lng);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- 4. 正常更新玩家資料
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
    push_settings = COALESCE(p_push_settings, push_settings),
    updated_at = now()
  where id = auth.uid()
  returning * into v_profile;

  return v_profile;
END;
;

-- ==========================================
-- 5. 裝備管理 RPC (原子性操作，防止重複或消失)
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
AS 
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
;

GRANT EXECUTE ON FUNCTION public.secure_equip_item(text, jsonb, text) TO authenticated;

-- ==========================================
-- 6. POI 互動相關 RPC
-- ==========================================
DROP FUNCTION IF EXISTS public.interact_poi(uuid);
CREATE OR REPLACE FUNCTION public.interact_poi(p_poi_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS 
BEGIN
  UPDATE public.map_pois SET is_active = false, respawn_at = now() + interval '30 minutes' WHERE id = p_poi_id AND is_active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', '該聖地已消失或已被領取'); END IF;
  INSERT INTO public.poi_claims (poi_id, user_id, claimed_at) VALUES (p_poi_id, auth.uid(), now()) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('success', true);
END;
;

GRANT EXECUTE ON FUNCTION public.interact_poi(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.resolve_poi_combat(uuid, boolean);
CREATE OR REPLACE FUNCTION public.resolve_poi_combat(p_poi_id uuid, p_win boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS 
BEGIN
  IF p_win THEN UPDATE public.map_pois SET is_active = false, respawn_at = now() + interval '1 hour' WHERE id = p_poi_id; END IF;
END;
;

GRANT EXECUTE ON FUNCTION public.resolve_poi_combat(uuid, boolean) TO authenticated;

-- ==========================================
-- 7. 任務進度擴充 RPC
-- ==========================================
DROP FUNCTION IF EXISTS public.increment_craft_quests(uuid, int);
CREATE OR REPLACE FUNCTION public.increment_craft_quests(p_user_id uuid, p_increment int DEFAULT 1) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS 
BEGIN
  IF auth.uid() != p_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.player_quests SET progress = LEAST(progress + p_increment, required) WHERE user_id = p_user_id AND (assigned_date = current_date OR assigned_date = date_trunc('week', current_date)::date) AND claimed = false AND (quest_id LIKE 'dq_craft_%' OR quest_id LIKE 'wq_craft_%' OR quest_id LIKE 'cq_%_craft');
END;
;

GRANT EXECUTE ON FUNCTION public.increment_craft_quests(uuid, int) TO authenticated;

DROP FUNCTION IF EXISTS public.increment_travel_quests(uuid, int);
CREATE OR REPLACE FUNCTION public.increment_travel_quests(p_user_id uuid, p_increment int DEFAULT 1) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS 
BEGIN
  IF auth.uid() != p_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.player_quests SET progress = LEAST(progress + p_increment, required) WHERE user_id = p_user_id AND (assigned_date = current_date OR assigned_date = date_trunc('week', current_date)::date) AND claimed = false AND (quest_id LIKE 'dq_travel_%' OR quest_id LIKE 'wq_travel_%' OR quest_id LIKE 'cq_%_travel');
END;
;

GRANT EXECUTE ON FUNCTION public.increment_travel_quests(uuid, int) TO authenticated;

-- ==========================================
-- 8. SECURE ENCOUNTER CHECK (修復歧義與編碼)
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
AS 
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
END; ;

GRANT EXECUTE ON FUNCTION public.secure_check_encounter(text, boolean, float8, float8) TO authenticated;
GRANT EXECUTE ON FUNCTION public.secure_check_encounter(text, boolean, float8, float8) TO anon;