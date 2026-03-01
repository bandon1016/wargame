-- Fix for missing God system fields in secure_sync_profile
-- This allows gods array and active_god_id to be correctly persisted.

CREATE OR REPLACE FUNCTION public.secure_sync_profile(
    p_lat double precision,
    p_lng double precision,
    p_hp integer,
    p_mp double precision,
    p_exp integer,
    p_gold double precision default null,
    p_base_materials double precision default null,
    p_buildings jsonb default null,
    p_items jsonb default null,
    p_partners jsonb default null,
    p_equipment jsonb default null,
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
    p_gods jsonb default null,
    p_active_god_id text default null,
    p_travel_data jsonb default null,
    p_walk_data jsonb default null
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  -- 1.地理校驗範疇
  IF p_lat < 21.0 OR p_lat > 26.0 OR p_lng < 119.0 OR p_lng > 123.0 THEN
    RAISE EXCEPTION '非法地理位置';
  END IF;

  -- 2. 更新資料 (使用 coalesce 避免將未傳入的欄位清空)
  UPDATE public.profiles
  SET 
    current_location_lat = p_lat,
    current_location_lng = p_lng,
    hp = p_hp,
    mp = p_mp,
    exp = p_exp,
    gold = coalesce(p_gold, gold),
    base_materials = coalesce(p_base_materials, base_materials),
    buildings = coalesce(p_buildings, buildings),
    items = coalesce(p_items, items),
    partners = coalesce(p_partners, partners),
    equipment = coalesce(p_equipment, equipment),
    equipped_weapon = coalesce(p_equipped_weapon, equipped_weapon),
    equipped_armor = coalesce(p_equipped_armor, equipped_armor),
    equipped_helmet = coalesce(p_equipped_helmet, equipped_helmet),
    equipped_boots = coalesce(p_equipped_boots, equipped_boots),
    equipped_accessory = coalesce(p_equipped_accessory, equipped_accessory),
    ling_qi = coalesce(p_ling_qi, ling_qi),
    tech_fragments = coalesce(p_tech_fragments, tech_fragments),
    incense = coalesce(p_incense, incense),
    salt_crystals = coalesce(p_salt_crystals, salt_crystals),
    premium_gems = coalesce(p_premium_gems, premium_gems),
    -- 神明系統欄位：如果傳入了 gods (不為 null)，則同時更新 gods 與 active_god_id
    -- (這可以解決 active_god_id 被傳入為 null 時代表「取消派遣」的需求)
    gods = coalesce(p_gods, gods),
    active_god_id = CASE WHEN p_gods IS NOT NULL THEN p_active_god_id ELSE active_god_id END,
    travel_path = p_travel_data->'path',
    travel_started_at = (p_travel_data->>'started_at')::timestamp with time zone,
    travel_duration_seconds = (p_travel_data->>'duration')::double precision,
    walk_target_lat = (p_walk_data->>'target_lat')::double precision,
    walk_target_lng = (p_walk_data->>'target_lng')::double precision,
    walk_start_lat = (p_walk_data->>'start_lat')::double precision,
    walk_start_lng = (p_walk_data->>'start_lng')::double precision,
    walk_started_at = (p_walk_data->>'started_at')::timestamp with time zone,
    updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;
