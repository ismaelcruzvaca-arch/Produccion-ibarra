-- Verify: 007_backfill_operator_metadata
-- Checks that every operator_profiles row has matching metadata in auth.users
-- Returns rows where the backfill is MISSING or MISMATCHED

WITH profile_check AS (
  SELECT
    op.id,
    op.role AS expected_role,
    CASE op.role
      WHEN 'admin' THEN '["admin","supervisor","operator"]'::jsonb
      WHEN 'supervisor' THEN '["supervisor","operator"]'::jsonb
      ELSE '["operator"]'::jsonb
    END AS expected_allowed_roles,
    au.metadata->>'role' AS actual_role,
    au.metadata->'allowedRoles' AS actual_allowed_roles
  FROM public.operator_profiles op
  LEFT JOIN auth.users au ON au.id = op.id
)
SELECT
  id,
  expected_role,
  expected_allowed_roles,
  actual_role,
  actual_allowed_roles,
  CASE
    WHEN actual_role IS NULL THEN 'missing_metadata'
    WHEN actual_role <> expected_role THEN 'role_mismatch'
    WHEN actual_allowed_roles IS NULL THEN 'missing_allowed_roles'
    WHEN actual_allowed_roles <> expected_allowed_roles THEN 'allowed_roles_mismatch'
    ELSE 'ok'
  END AS status
FROM profile_check
WHERE
  actual_role IS NULL
  OR actual_role <> expected_role
  OR actual_allowed_roles IS NULL
  OR actual_allowed_roles <> expected_allowed_roles;

-- If no rows returned, all profiles are correctly synced.
-- If rows returned, investigate each id and re-run the migration.
