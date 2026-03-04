-- 修復神明「取消派遣」功能的 SQL 補丁
-- 執行此腳本後即可修復無法取消神明派遣的問題

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
  v_db_updated_at_ms := floor(extract(epoch from v_profile.updated_at) * 1000);
  
  if p_last_updated_at is not null and v_db_updated_at_ms > (p_last_updated_at + 5050) then
    update public.profiles
    set 
        current_location_lat = p_lat,
        current_location_lng = p_lng,
        hp = p_hp,
        mp = p_mp,
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
    -- [關鍵修改]: 移除 COALESCE，允許 p_active_god_id 為 null 以支持取消派遣
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
