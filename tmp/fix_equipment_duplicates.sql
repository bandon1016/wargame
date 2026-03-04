-- Cleanup SQL: Remove duplicate equipment items from player inventory
-- This fixes the state for players who experienced the equipment duplication bug.
-- Run this in Supabase SQL Editor.

UPDATE profiles
SET equipment = (
  SELECT jsonb_agg(DISTINCT elem ORDER BY elem)
  FROM jsonb_array_elements(equipment) AS elem
)
WHERE id IN (
  SELECT id
  FROM profiles
  WHERE (
    SELECT COUNT(*)
    FROM (
      SELECT elem->>'id' AS eq_id
      FROM jsonb_array_elements(equipment) AS elem
    ) sub
    GROUP BY eq_id
    HAVING COUNT(*) > 1
    LIMIT 1
  ) > 0
);

-- A more robust approach: for each profile, keep only one copy of each unique equipment by id
UPDATE profiles p
SET equipment = cleaned.equip
FROM (
  SELECT 
    id,
    (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT DISTINCT ON ((elem->>'id')) elem
        FROM jsonb_array_elements(equipment) AS elem
        ORDER BY (elem->>'id'), elem
      ) unique_equip
    ) AS equip
  FROM profiles
  WHERE jsonb_array_length(equipment) > 0
) cleaned
WHERE p.id = cleaned.id;
