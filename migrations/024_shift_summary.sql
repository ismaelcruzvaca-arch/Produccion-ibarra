-- Migration: 024_shift_summary
-- Shift Summary — cached aggregates for shift-end reporting.
--
-- Dependencias: public.shift_sessions (012)
--
-- Propósito:
--   Almacena agregados por turno para acelerar la pantalla de conciliación.
--   Se materializa al cierre de turno (cuando el operador cierra el turno).
--   No es autoritativa — siempre derivable de oee_events.
--   Si no hay target alcanzado (actual >= theoretical), no se crea registro.
--
-- Columnas:
--   - total_planned_min: minutos planificados del turno
--   - total_downtime_min: minutos totales de paro (todos los motivos)
--   - total_micro_stop_min: minutos de micro-paros (< threshold)
--   - total_mtto_min: minutos de paro MTTO
--   - total_prod_min: minutos de paro PROD
--   - total_boxes: cajas producidas
--   - total_rejects: cajas rechazadas
--   - performance_pct: porcentaje de rendimiento
--   - has_pending_conciliation: si hay conciliaciones pendientes en este turno
--
-- ================================================================
-- SECTION 1: CREATE TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.shift_summary (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_session_id        UUID NOT NULL UNIQUE REFERENCES public.shift_sessions(id),

    -- Time metrics
    total_planned_min       INT NOT NULL DEFAULT 0,
    total_downtime_min      INT NOT NULL DEFAULT 0,
    total_micro_stop_min    INT NOT NULL DEFAULT 0,
    total_mtto_min          INT NOT NULL DEFAULT 0,
    total_prod_min          INT NOT NULL DEFAULT 0,

    -- Production metrics
    total_boxes             INT NOT NULL DEFAULT 0,
    total_rejects           INT NOT NULL DEFAULT 0,

    -- Performance
    performance_pct         NUMERIC(5,2),

    -- Status flags
    has_pending_conciliation BOOLEAN NOT NULL DEFAULT false,

    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ
);

COMMENT ON TABLE public.shift_summary IS
  'Resumen de turno — agregados cacheados para consulta rápida en conciliación';

COMMENT ON COLUMN public.shift_summary.shift_session_id IS
  'FK → shift_sessions.id — identificador único del turno';
COMMENT ON COLUMN public.shift_summary.total_planned_min IS
  'Minutos planificados del turno (duración estimada)';
COMMENT ON COLUMN public.shift_summary.total_downtime_min IS
  'Minutos totales de paro (todos los motivos)';
COMMENT ON COLUMN public.shift_summary.total_micro_stop_min IS
  'Minutos de micro-paros (duración < threshold de plant_config)';
COMMENT ON COLUMN public.shift_summary.total_mtto_min IS
  'Minutos de paro por mantenimiento';
COMMENT ON COLUMN public.shift_summary.total_prod_min IS
  'Minutos de paro por producción';
COMMENT ON COLUMN public.shift_summary.total_boxes IS
  'Total de cajas producidas en el turno';
COMMENT ON COLUMN public.shift_summary.total_rejects IS
  'Total de cajas rechazadas';
COMMENT ON COLUMN public.shift_summary.performance_pct IS
  'Porcentaje de rendimiento (velocidad real / velocidad teórica)';
COMMENT ON COLUMN public.shift_summary.has_pending_conciliation IS
  'Indica si hay registros de conciliación pendientes en este turno';

-- ================================================================
-- SECTION 2: Indexes
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_shift_summary_session
    ON public.shift_summary(shift_session_id);

CREATE INDEX IF NOT EXISTS idx_shift_summary_created
    ON public.shift_summary(created_at);

-- ================================================================
-- SECTION 3: Trigger function para auto-update updated_at
-- ================================================================

CREATE OR REPLACE FUNCTION public.update_shift_summary_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shift_summary_updated_at ON public.shift_summary;
CREATE TRIGGER trg_shift_summary_updated_at
    BEFORE UPDATE ON public.shift_summary
    FOR EACH ROW
    EXECUTE FUNCTION public.update_shift_summary_timestamp();

-- ================================================================
-- SECTION 4: Notificación
-- ================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 024_shift_summary aplicada:';
    RAISE NOTICE '   - Tabla shift_summary creada (12 columnas)';
    RAISE NOTICE '   - UNIQUE constraint en shift_session_id (1:1 con shift_sessions)';
    RAISE NOTICE '   - 2 índices de performance';
    RAISE NOTICE '   - Trigger auto-update updated_at';
    RAISE NOTICE '';
    RAISE NOTICE '⚠ Agregar en Hasura: trackear tabla shift_summary con RLS';
    RAISE NOTICE '  - Rol supervisor/admin: ALL';
    RAISE NOTICE '  - Rol operator: SELECT (solo sus máquinas)';
END;
$$;
