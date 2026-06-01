-- Rollback: 009_catalog_audit_columns
-- Drops the 3 audit columns from all 5 catalog tables.
--
-- WARNING: Destructive — any data in these columns is lost.
-- Only rollback if the migration hasn't been propagated to production
-- or if a schema conflict forces a re-apply.

ALTER TABLE public.stop_reasons DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.stop_reasons DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.stop_reasons DROP COLUMN IF EXISTS updated_by;

ALTER TABLE public.products DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.products DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.products DROP COLUMN IF EXISTS updated_by;

ALTER TABLE public.shifts DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.shifts DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.shifts DROP COLUMN IF EXISTS updated_by;

ALTER TABLE public.lines DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.lines DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.lines DROP COLUMN IF EXISTS updated_by;

ALTER TABLE public.machines DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.machines DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.machines DROP COLUMN IF EXISTS updated_by;
