-- Migration 015: Production form backend tables
-- Creates backend storage for 4 RxDB-only production forms:
--   toaster_logs   (F-PD-16) — toaster/roasting station logs
--   mixing_batches (F-PD-17) — mixing batch records with ingredients & inventory
--   extractor_checks (F-PD-18) — extractor on/off toggles & cleaning
--   vitamin_kits   (F-PD-06) — vitamin kit composition & verification
--
-- All 4 tables share the same base columns and use the same RLS pattern
-- as signatures_tightened (migration 012): operator_id scoped to self,
-- supervisor/admin sees all via hasura.allowed_roles.
--
-- Reference IDs (line_id, machine_id, shift_id) are text — no FK constraints
-- per offline-first design (IDs are string references, not relational).

-- ─── Toaster Logs (F-PD-16) ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.toaster_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  line_id text NOT NULL,
  machine_id text NOT NULL,
  shift_id text NOT NULL,
  operator_id uuid NOT NULL,
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  is_deleted boolean NOT NULL DEFAULT false,
  -- Form-specific fields (F-PD-16)
  batch_number text NOT NULL,
  temp_superior double precision,
  temp_media double precision,
  temp_inferior double precision,
  rpm double precision,
  vapor_pressure double precision,
  cacao_crudo_humidity double precision,
  cacao_tostado_humidity double precision,
  pesadas double precision,
  silo text,
  lotes text,
  tiempo_muerto_min double precision,
  tiempo_muerto_cause text,
  inv_ini_cascarilla double precision,
  inv_ini_polvillo double precision,
  inv_ini_granilla double precision,
  inv_ini_cacao_crudo double precision,
  inv_ini_azucar double precision,
  inv_fin_cascarilla double precision,
  inv_fin_polvillo double precision,
  inv_fin_granilla double precision,
  inv_fin_cacao_crudo double precision,
  inv_fin_azucar double precision
);

CREATE INDEX IF NOT EXISTS idx_toaster_logs_updated_at ON public.toaster_logs(updated_at);

COMMENT ON TABLE public.toaster_logs IS 'Toaster/roasting station production log (F-PD-16)';

-- ─── Mixing Batches (F-PD-17) ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mixing_batches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  line_id text NOT NULL,
  machine_id text NOT NULL,
  shift_id text NOT NULL,
  operator_id uuid NOT NULL,
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  is_deleted boolean NOT NULL DEFAULT false,
  -- Form-specific fields (F-PD-17)
  batch_sequence double precision NOT NULL,
  mezcladora text,
  agitador text,
  azucar_kg double precision,
  licor_kg double precision,
  cocoa_kg double precision,
  grasa_vegetal_kg double precision,
  lecitina_kg double precision,
  reproceso_kg double precision,
  viscosity_cps double precision,
  discharge_temp double precision,
  mezcladas double precision,
  molidas double precision,
  reproceso_total double precision,
  desperdicio double precision,
  inv_ini_azucar double precision,
  inv_ini_licor double precision,
  inv_ini_cocoa double precision,
  inv_ini_grasa_vegetal double precision,
  inv_ini_lecitina double precision,
  inv_ini_reproceso double precision,
  inv_fin_azucar double precision,
  inv_fin_licor double precision,
  inv_fin_cocoa double precision,
  inv_fin_grasa_vegetal double precision,
  inv_fin_lecitina double precision,
  inv_fin_reproceso double precision,
  consumo_azucar double precision,
  consumo_licor double precision,
  consumo_cocoa double precision,
  consumo_grasa_vegetal double precision,
  consumo_lecitina double precision,
  consumo_reproceso double precision
);

CREATE INDEX IF NOT EXISTS idx_mixing_batches_updated_at ON public.mixing_batches(updated_at);

COMMENT ON TABLE public.mixing_batches IS 'Mixing batch production record with ingredients and inventory (F-PD-17)';

-- ─── Extractor Checks (F-PD-18) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.extractor_checks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  line_id text NOT NULL,
  machine_id text NOT NULL,
  shift_id text NOT NULL,
  operator_id uuid NOT NULL,
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  is_deleted boolean NOT NULL DEFAULT false,
  -- Form-specific fields (F-PD-18)
  extractor_1_on boolean NOT NULL DEFAULT false,
  extractor_2_on boolean NOT NULL DEFAULT false,
  extractor_3_on boolean NOT NULL DEFAULT false,
  extractor_4_on boolean NOT NULL DEFAULT false,
  extractor_5_on boolean NOT NULL DEFAULT false,
  extractor_6_on boolean NOT NULL DEFAULT false,
  extractor_7_on boolean NOT NULL DEFAULT false,
  extractor_8_on boolean NOT NULL DEFAULT false,
  cedazo_tt_last_cleaning bigint
);

CREATE INDEX IF NOT EXISTS idx_extractor_checks_updated_at ON public.extractor_checks(updated_at);

COMMENT ON TABLE public.extractor_checks IS 'Extractor station on/off checks and cedazo cleaning (F-PD-18)';

-- ─── Vitamin Kits (F-PD-06) ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vitamin_kits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  line_id text NOT NULL,
  machine_id text NOT NULL,
  shift_id text NOT NULL,
  operator_id uuid NOT NULL,
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  is_deleted boolean NOT NULL DEFAULT false,
  -- Form-specific fields (F-PD-06)
  orden text NOT NULL,
  kit text NOT NULL,
  semi_terminado text NOT NULL,
  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  verif_produccion boolean NOT NULL DEFAULT false,
  verif_calidad boolean NOT NULL DEFAULT false,
  peso_bascula_kg double precision,
  peso_fisico_kg double precision
);

CREATE INDEX IF NOT EXISTS idx_vitamin_kits_updated_at ON public.vitamin_kits(updated_at);

COMMENT ON TABLE public.vitamin_kits IS 'Vitamin kit composition, ingredients, and verification (F-PD-06)';

-- ─── Row-Level Security ─────────────────────────────────────────────────────────

-- Enable RLS on all 4 tables
ALTER TABLE public.toaster_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mixing_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extractor_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vitamin_kits ENABLE ROW LEVEL SECURITY;

-- Tightened RLS policy (same pattern as signatures_tightened in migration 012):
--   Operator: sees own records (operator_id = hasura.user)
--   Supervisor: sees all (hasura.allowed_roles contains supervisor)
--   Admin: sees all (hasura.allowed_roles contains admin)
--
-- Single FOR ALL policy covers SELECT, INSERT, UPDATE, DELETE.
-- USING clause covers existing rows (SELECT/UPDATE/DELETE).
-- WITH CHECK clause covers new rows (INSERT/UPDATE).

CREATE POLICY toaster_logs_tightened ON public.toaster_logs
    FOR ALL
    USING (
        current_setting('hasura.allowed_roles', true) LIKE '%supervisor%'
        OR current_setting('hasura.allowed_roles', true) LIKE '%admin%'
        OR operator_id::text = current_setting('hasura.user', true)
    )
    WITH CHECK (
        current_setting('hasura.allowed_roles', true) LIKE '%supervisor%'
        OR current_setting('hasura.allowed_roles', true) LIKE '%admin%'
        OR operator_id::text = current_setting('hasura.user', true)
    );

COMMENT ON POLICY toaster_logs_tightened ON public.toaster_logs IS
    'Operator sees own records (operator_id), supervisor/admin sees all via hasura.allowed_roles';

CREATE POLICY mixing_batches_tightened ON public.mixing_batches
    FOR ALL
    USING (
        current_setting('hasura.allowed_roles', true) LIKE '%supervisor%'
        OR current_setting('hasura.allowed_roles', true) LIKE '%admin%'
        OR operator_id::text = current_setting('hasura.user', true)
    )
    WITH CHECK (
        current_setting('hasura.allowed_roles', true) LIKE '%supervisor%'
        OR current_setting('hasura.allowed_roles', true) LIKE '%admin%'
        OR operator_id::text = current_setting('hasura.user', true)
    );

COMMENT ON POLICY mixing_batches_tightened ON public.mixing_batches IS
    'Operator sees own records (operator_id), supervisor/admin sees all via hasura.allowed_roles';

CREATE POLICY extractor_checks_tightened ON public.extractor_checks
    FOR ALL
    USING (
        current_setting('hasura.allowed_roles', true) LIKE '%supervisor%'
        OR current_setting('hasura.allowed_roles', true) LIKE '%admin%'
        OR operator_id::text = current_setting('hasura.user', true)
    )
    WITH CHECK (
        current_setting('hasura.allowed_roles', true) LIKE '%supervisor%'
        OR current_setting('hasura.allowed_roles', true) LIKE '%admin%'
        OR operator_id::text = current_setting('hasura.user', true)
    );

COMMENT ON POLICY extractor_checks_tightened ON public.extractor_checks IS
    'Operator sees own records (operator_id), supervisor/admin sees all via hasura.allowed_roles';

CREATE POLICY vitamin_kits_tightened ON public.vitamin_kits
    FOR ALL
    USING (
        current_setting('hasura.allowed_roles', true) LIKE '%supervisor%'
        OR current_setting('hasura.allowed_roles', true) LIKE '%admin%'
        OR operator_id::text = current_setting('hasura.user', true)
    )
    WITH CHECK (
        current_setting('hasura.allowed_roles', true) LIKE '%supervisor%'
        OR current_setting('hasura.allowed_roles', true) LIKE '%admin%'
        OR operator_id::text = current_setting('hasura.user', true)
    );

COMMENT ON POLICY vitamin_kits_tightened ON public.vitamin_kits IS
    'Operator sees own records (operator_id), supervisor/admin sees all via hasura.allowed_roles';

-- ─── Grant Base Table Access ─────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.toaster_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mixing_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extractor_checks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vitamin_kits TO authenticated;
