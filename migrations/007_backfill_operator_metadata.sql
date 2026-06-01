-- Migration: 007_backfill_operator_metadata
-- Idempotent backfill: sync operator_profiles.role → auth.users.metadata.{role, allowedRoles}
-- 
-- For each existing operator_profiles row, this migration sets:
--   auth.users.metadata.role          = operator_profiles.role
--   auth.users.metadata.allowedRoles  = resolved role hierarchy array
--
-- The migration is IDEMPOTENT — re-running produces the same result.
-- It only affects users who already have an operator_profiles row.
--
-- allowedRoles mapping:
--   operator   → ["operator"]
--   supervisor → ["supervisor", "operator"]
--   admin      → ["admin", "supervisor", "operator"]

DO $$
DECLARE
  profile RECORD;
  allowed_roles jsonb;
BEGIN
  FOR profile IN SELECT id, role FROM public.operator_profiles LOOP
    -- Resolve allowedRoles based on role hierarchy
    allowed_roles := CASE profile.role
      WHEN 'admin' THEN '["admin","supervisor","operator"]'::jsonb
      WHEN 'supervisor' THEN '["supervisor","operator"]'::jsonb
      ELSE '["operator"]'::jsonb
    END;

    -- Use jsonb_set twice: first set role, then set allowedRoles
    -- COALESCE ensures we don't overwrite existing non-role/allowedRoles metadata
    UPDATE auth.users
    SET metadata = jsonb_set(
      jsonb_set(
        COALESCE(metadata, '{}'),
        '{role}',
        to_jsonb(profile.role)
      ),
      '{allowedRoles}',
      allowed_roles
    )
    WHERE id = profile.id;

    -- If the auth.users row doesn't exist (orphaned profile), skip silently
  END LOOP;
END $$;
