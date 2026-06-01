-- Rollback: 007_backfill_operator_metadata
-- Removes role and allowedRoles from auth.users.metadata for users who
-- have an operator_profiles row. Restores metadata to its pre-backfill state
-- by stripping the 'role' and 'allowedRoles' keys.
--
-- WARNING: This removes the role/allowedRoles metadata set by the backfill.
-- If the Event Trigger webhook is active, it will re-sync on the next
-- INSERT/UPDATE to operator_profiles, but existing sessions will be stale
-- until the user re-logs in (JWT retains old claims until TTL expiry).

DO $$
DECLARE
  profile RECORD;
  current_meta jsonb;
  cleaned_meta jsonb;
BEGIN
  FOR profile IN SELECT id FROM public.operator_profiles LOOP
    SELECT metadata INTO current_meta FROM auth.users WHERE id = profile.id;

    IF current_meta IS NOT NULL THEN
      -- Remove 'role' and 'allowedRoles' keys
      cleaned_meta := current_meta - 'role' - 'allowedRoles';

      UPDATE auth.users
      SET metadata = cleaned_meta
      WHERE id = profile.id;
    END IF;
  END LOOP;
END $$;
