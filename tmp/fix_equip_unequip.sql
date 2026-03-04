-- Fix for Equipment Duplication Bug
-- Root Cause: COALESCE(p_equipped_weapon, equipped_weapon) silently ignores NULL requests from the client
-- when unequipping. The server keeps the old equipped item, but the client also adds it back to inventory.
-- Solution: Create a dedicated atomic RPC that handles equip/unequip in a single transaction.

create or replace function public.secure_equip_item(
  p_equip_id text default null,       -- null means UNEQUIP
  p_slot text default null,            -- 'weapon', 'armor', 'helmet', 'boots', 'accessory'
  p_equipment_inventory jsonb default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_profile public.profiles;
  v_current_equipped jsonb;
  v_new_inventory jsonb;
  v_eq_to_equip jsonb;
begin
  -- 1. Lock and read
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if not found then
    return jsonb_build_object('success', false, 'message', '找不到玩家資料');
  end if;

  -- 2. Get current equipped in the specified slot
  if p_slot = 'weapon' then v_current_equipped := v_profile.equipped_weapon;
  elsif p_slot = 'armor' then v_current_equipped := v_profile.equipped_armor;
  elsif p_slot = 'helmet' then v_current_equipped := v_profile.equipped_helmet;
  elsif p_slot = 'boots' then v_current_equipped := v_profile.equipped_boots;
  elsif p_slot = 'accessory' then v_current_equipped := v_profile.equipped_accessory;
  else
    return jsonb_build_object('success', false, 'message', '無效的裝備槽位');
  end if;

  -- 3. Start from the provided inventory (or current)
  v_new_inventory := COALESCE(p_equipment_inventory, v_profile.equipment);

  if p_equip_id is null then
    -- === UNEQUIP MODE ===
    -- Add current equipped back to inventory
    if v_current_equipped is not null then
      v_new_inventory := v_new_inventory || jsonb_build_array(v_current_equipped);
    end if;

    -- Clear the slot (explicit NULL, not COALESCE)
    if p_slot = 'weapon' then
      update public.profiles set equipped_weapon = null, equipment = v_new_inventory, updated_at = now() where id = auth.uid() returning * into v_profile;
    elsif p_slot = 'armor' then
      update public.profiles set equipped_armor = null, equipment = v_new_inventory, updated_at = now() where id = auth.uid() returning * into v_profile;
    elsif p_slot = 'helmet' then
      update public.profiles set equipped_helmet = null, equipment = v_new_inventory, updated_at = now() where id = auth.uid() returning * into v_profile;
    elsif p_slot = 'boots' then
      update public.profiles set equipped_boots = null, equipment = v_new_inventory, updated_at = now() where id = auth.uid() returning * into v_profile;
    elsif p_slot = 'accessory' then
      update public.profiles set equipped_accessory = null, equipment = v_new_inventory, updated_at = now() where id = auth.uid() returning * into v_profile;
    end if;

  else
    -- === EQUIP MODE ===
    -- Find the item to equip in the inventory
    select elem into v_eq_to_equip
    from jsonb_array_elements(v_new_inventory) as elem
    where (elem->>'id') = p_equip_id
    limit 1;

    if v_eq_to_equip is null then
      return jsonb_build_object('success', false, 'message', '找不到指定裝備於背包中');
    end if;

    -- Remove the item from inventory (first occurrence only)
    with removed as (
      select idx, elem
      from jsonb_array_elements(v_new_inventory) with ordinality as t(elem, idx)
      where (elem->>'id') = p_equip_id
      order by idx
      limit 1
    )
    select jsonb_agg(elem order by idx)
    into v_new_inventory
    from (
      select idx, elem
      from jsonb_array_elements(v_new_inventory) with ordinality as t(elem, idx)
      where idx not in (select idx from removed)
    ) s;

    -- If there was a previously equipped item, add it back
    if v_current_equipped is not null then
      v_new_inventory := COALESCE(v_new_inventory, '[]'::jsonb) || jsonb_build_array(v_current_equipped);
    end if;

    -- Set the new item in the slot (explicit value, not COALESCE)
    if p_slot = 'weapon' then
      update public.profiles set equipped_weapon = v_eq_to_equip, equipment = v_new_inventory, updated_at = now() where id = auth.uid() returning * into v_profile;
    elsif p_slot = 'armor' then
      update public.profiles set equipped_armor = v_eq_to_equip, equipment = v_new_inventory, updated_at = now() where id = auth.uid() returning * into v_profile;
    elsif p_slot = 'helmet' then
      update public.profiles set equipped_helmet = v_eq_to_equip, equipment = v_new_inventory, updated_at = now() where id = auth.uid() returning * into v_profile;
    elsif p_slot = 'boots' then
      update public.profiles set equipped_boots = v_eq_to_equip, equipment = v_new_inventory, updated_at = now() where id = auth.uid() returning * into v_profile;
    elsif p_slot = 'accessory' then
      update public.profiles set equipped_accessory = v_eq_to_equip, equipment = v_new_inventory, updated_at = now() where id = auth.uid() returning * into v_profile;
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'updated_profile', row_to_json(v_profile)::jsonb
  );
end;
$$;
