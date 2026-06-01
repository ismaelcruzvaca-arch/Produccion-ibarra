-- Migration: 009_catalog_audit_columns
-- Add created_at, updated_at, updated_by to catalog tables
--
-- These columns enable audit tracking for the Settings CRUD (stop_reasons,
-- lines, machines, products, shifts). The hasuraMutations already write
-- updated_by/updated_at, but the columns don't exist yet.
--
-- Pattern: new tables in this project use updated_at (not client_updated_at)
-- for server-owned timestamps. Catalog tables are server-authoritative.

-- ─── stop_reasons ─────────────────────────────────────────────────────────────

ALTER TABLE public.stop_reasons
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.stop_reasons
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.stop_reasons
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- ─── products ─────────────────────────────────────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- ─── shifts ───────────────────────────────────────────────────────────────────

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- ─── lines ────────────────────────────────────────────────────────────────────

ALTER TABLE public.lines
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.lines
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.lines
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- ─── machines ─────────────────────────────────────────────────────────────────

ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- ─── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.stop_reasons.created_at  IS 'Row creation timestamp';
COMMENT ON COLUMN public.stop_reasons.updated_at  IS 'Last modification timestamp';
COMMENT ON COLUMN public.stop_reasons.updated_by  IS 'User who last modified the row (auth.users.id)';
COMMENT ON COLUMN public.products.created_at      IS 'Row creation timestamp';
COMMENT ON COLUMN public.products.updated_at      IS 'Last modification timestamp';
COMMENT ON COLUMN public.products.updated_by      IS 'User who last modified the row (auth.users.id)';
COMMENT ON COLUMN public.shifts.created_at        IS 'Row creation timestamp';
COMMENT ON COLUMN public.shifts.updated_at        IS 'Last modification timestamp';
COMMENT ON COLUMN public.shifts.updated_by        IS 'User who last modified the row (auth.users.id)';
COMMENT ON COLUMN public.lines.created_at         IS 'Row creation timestamp';
COMMENT ON COLUMN public.lines.updated_at         IS 'Last modification timestamp';
COMMENT ON COLUMN public.lines.updated_by         IS 'User who last modified the row (auth.users.id)';
COMMENT ON COLUMN public.machines.created_at      IS 'Row creation timestamp';
COMMENT ON COLUMN public.machines.updated_at      IS 'Last modification timestamp';
COMMENT ON COLUMN public.machines.updated_by      IS 'User who last modified the row (auth.users.id)';
