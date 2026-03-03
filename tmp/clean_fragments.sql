-- ==========================================
-- Migration: Clean Up Phantom Skill Fragments
-- ==========================================
-- This script removes any item from the player's 'items' jsonb array 
-- where the 'id' starts with 'frag_' or 'skill_'.
-- These were added erroneously by the combat resolution function.

UPDATE public.profiles
SET items = (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements(items) AS elem
    WHERE (elem->>'id') NOT LIKE 'frag_%' AND (elem->>'id') NOT LIKE 'skill_%'
)
WHERE items IS NOT NULL AND jsonb_typeof(items) = 'array';

-- In cases where the array might become empty, set it back to '[]'::jsonb instead of NULL
UPDATE public.profiles
SET items = '[]'::jsonb
WHERE items IS NULL;
