-- 1. 新增 push_settings 和 push_subscription 欄位到 profiles 表
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS push_settings jsonb DEFAULT '{"enabled": false, "notifyDeath": true, "notifyBuilding": true, "notifyElite": true, "notifyTransport": true, "notifyWeather": true}'::jsonb,
ADD COLUMN IF NOT EXISTS push_subscription jsonb DEFAULT NULL;

-- 2. 修改 secure_sync_profile 支援 push_settings (但不覆寫 subscription)
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
  p_last_updated_at bigint default null,
  p_push_settings jsonb default null
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile public.profiles;
  v_db_updated_at_ms bigint;
BEGIN
  -- 1. 取得現有資料
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  
  -- 2. 基本地理校驗
  IF p_lat < 21.0 OR p_lat > 26.0 OR p_lng < 119.0 OR p_lng > 123.0 THEN
    RAISE EXCEPTION '非法地理位置';
  END IF;

  -- 3. 版本檢核 (Optimistic Locking)
  -- 使用 floor 確保毫秒精度對齊
  v_db_updated_at_ms := floor(extract(epoch from v_profile.updated_at) * 1000);
  
  -- 恢復短緩衝時間 (100ms)
  IF p_last_updated_at IS NOT NULL AND v_db_updated_at_ms > (p_last_updated_at + 100) THEN
    -- 只更新位置、HP/MP、移動記錄與設定
    UPDATE public.profiles
    SET 
        current_location_lat = p_lat,
        current_location_lng = p_lng,
        hp = p_hp,
        mp = p_mp,
        travel_path = CASE WHEN p_travel_data IS NOT NULL THEN p_travel_data->'path' ELSE travel_path END,
        travel_started_at = CASE WHEN p_travel_data IS NOT NULL THEN (p_travel_data->>'started_at')::timestamp with time zone ELSE travel_started_at END,
        travel_duration_seconds = CASE WHEN p_travel_data IS NOT NULL THEN (p_travel_data->>'duration')::double precision ELSE travel_duration_seconds END,
        walk_target_lat = CASE WHEN p_walk_data IS NOT NULL THEN (p_walk_data->>'target_lat')::double precision ELSE walk_target_lat END,
        walk_target_lng = CASE WHEN p_walk_data IS NOT NULL THEN (p_walk_data->>'target_lng')::double precision ELSE walk_target_lng END,
        walk_start_lat = CASE WHEN p_walk_data IS NOT NULL THEN (p_walk_data->>'start_lat')::double precision ELSE walk_start_lat END,
        walk_start_lng = CASE WHEN p_walk_data IS NOT NULL THEN (p_walk_data->>'start_lng')::double precision ELSE walk_start_lng END,
        walk_started_at = CASE WHEN p_walk_data IS NOT NULL THEN (p_walk_data->>'started_at')::timestamp with time zone ELSE walk_started_at END,
        walk_duration_seconds = CASE WHEN p_walk_data IS NOT NULL THEN (p_walk_data->>'duration')::double precision ELSE walk_duration_seconds END,
        push_settings = COALESCE(p_push_settings, push_settings),
        updated_at = now()
    WHERE id = auth.uid()
    RETURNING * INTO v_profile;
    
    RETURN v_profile;
  END IF;

  -- 4. 正常更新資料
  UPDATE public.profiles
  SET 
    current_location_lat = p_lat,
    current_location_lng = p_lng,
    hp = p_hp,
    mp = p_mp,
    travel_path = CASE WHEN p_travel_data IS NOT NULL THEN p_travel_data->'path' ELSE travel_path END,
    travel_started_at = CASE WHEN p_travel_data IS NOT NULL THEN (p_travel_data->>'started_at')::timestamp with time zone ELSE travel_started_at END,
    travel_duration_seconds = CASE WHEN p_travel_data IS NOT NULL THEN (p_travel_data->>'duration')::double precision ELSE travel_duration_seconds END,
    walk_target_lat = CASE WHEN p_walk_data IS NOT NULL THEN (p_walk_data->>'target_lat')::double precision ELSE walk_target_lat END,
    walk_target_lng = CASE WHEN p_walk_data IS NOT NULL THEN (p_walk_data->>'target_lng')::double precision ELSE walk_target_lng END,
    walk_start_lat = CASE WHEN p_walk_data IS NOT NULL THEN (p_walk_data->>'start_lat')::double precision ELSE walk_start_lat END,
    walk_start_lng = CASE WHEN p_walk_data IS NOT NULL THEN (p_walk_data->>'start_lng')::double precision ELSE walk_start_lng END,
    walk_started_at = CASE WHEN p_walk_data IS NOT NULL THEN (p_walk_data->>'started_at')::timestamp with time zone ELSE walk_started_at END,
    walk_duration_seconds = CASE WHEN p_walk_data IS NOT NULL THEN (p_walk_data->>'duration')::double precision ELSE walk_duration_seconds END,
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
  WHERE id = auth.uid()
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;
