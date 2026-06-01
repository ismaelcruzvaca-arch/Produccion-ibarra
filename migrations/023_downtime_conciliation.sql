-- Migration: 023_downtime_conciliation
-- Downtime Conciliation — bridge between Production downtime events and Maintenance action.
--
-- Dependencias: public.oee_events (004), public.shift_sessions (012),
--               public.epicor_sync_queue (008/019)
--
-- Propósito:
--   Almacena registros de conciliación de paros con causa MTTO.
--   Cuando un operador registra un paro con razón de mantenimiento, se crea
--   automáticamente un registro de conciliación (pendiente).
--   El supervisor revisa al cierre de turno, diagnostica la causa raíz y
--   dispara una OT en cmms-ibero vía epicor_sync_queue.
--
-- Flujo:
--   1. Operator flags paro con reason_code MTTO → trigger crea conciliación (pending)
--   2. Supervisor abre pantalla de conciliación → ve paros MTTO >= threshold
--   3. Supervisor diagnostica → actualiza diagnosed_code, diagnosed_by
--   4. Mecánico diagnóstica → actualiza conciliated_code, conciliated_by_mtto
--   5. Supervisor reconcilia → status = 'reconciled', si es MTTO → encola OEE_MTTO_TRIGGER
--   6. Si no hay acuerdo → status = 'disputed'
--
-- ================================================================
-- SECTION 1: CREATE TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.downtime_conciliation (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oee_event_id        UUID NOT NULL REFERENCES public.oee_events(id),
    shift_session_id    UUID REFERENCES public.shift_sessions(id),
    machine_id          TEXT NOT NULL,
    reason_code         TEXT NOT NULL,
    duration_min        NUMERIC(6,1),

    -- Production diagnosis (supervisor)
    diagnosed_code      TEXT,
    diagnosed_by        TEXT,
    diagnosed_at        TIMESTAMPTZ,

    -- Maintenance diagnosis (mechanic)
    conciliated         BOOLEAN NOT NULL DEFAULT false,
    conciliated_code    TEXT,
    conciliated_macro   TEXT,
    conciliated_by_prod TEXT,
    conciliated_by_mtto TEXT,
    conciliated_at      TIMESTAMPTZ,

    -- Notes
    conciliation_notes  TEXT,

    -- Status: pending → reconciled | disputed
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'reconciled', 'disputed')),

    -- OT tracking
    ot_sent             BOOLEAN NOT NULL DEFAULT false,
    ot_response         TEXT,
    ot_sent_at          TIMESTAMPTZ,

    -- Classification
    is_mtto             BOOLEAN NOT NULL DEFAULT false,

    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ
);

COMMENT ON TABLE public.downtime_conciliation IS
  'Conciliación de paros — vincula eventos de producción con acción de mantenimiento';

COMMENT ON COLUMN public.downtime_conciliation.oee_event_id IS
  'FK → oee_events.id — evento de downtime_start que originó este registro';
COMMENT ON COLUMN public.downtime_conciliation.shift_session_id IS
  'FK → shift_sessions.id — turno en que ocurrió el paro';
COMMENT ON COLUMN public.downtime_conciliation.machine_id IS
  'Denormalizado — ID de la máquina para queries rápidas';
COMMENT ON COLUMN public.downtime_conciliation.reason_code IS
  'Código de paro original que el operador seleccionó';
COMMENT ON COLUMN public.downtime_conciliation.duration_min IS
  'Duración del paro en minutos (computado de oee_events)';
COMMENT ON COLUMN public.downtime_conciliation.diagnosed_code IS
  'Código de causa raíz diagnosticado por el supervisor';
COMMENT ON COLUMN public.downtime_conciliation.conciliated_code IS
  'Código final de causa raíz después de diagnóstico de mantenimiento';
COMMENT ON COLUMN public.downtime_conciliation.conciliated_macro IS
  'Macro-categoría final (MTTO, PROD, OTROS)';
COMMENT ON COLUMN public.downtime_conciliation.status IS
  'Estado: pending → reconciled | disputed';
COMMENT ON COLUMN public.downtime_conciliation.ot_sent IS
  'Indica si ya se disparó la OT a cmms-ibero vía oee-trigger';
COMMENT ON COLUMN public.downtime_conciliation.is_mtto IS
  'True si el reason_code original pertenece a macro MTTO';

-- ================================================================
-- SECTION 2: Indexes
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_dt_conciliation_status
    ON public.downtime_conciliation(status);

CREATE INDEX IF NOT EXISTS idx_dt_conciliation_machine
    ON public.downtime_conciliation(machine_id, status);

CREATE INDEX IF NOT EXISTS idx_dt_conciliation_shift
    ON public.downtime_conciliation(shift_session_id, status);

CREATE INDEX IF NOT EXISTS idx_dt_conciliation_oee_event
    ON public.downtime_conciliation(oee_event_id);

CREATE INDEX IF NOT EXISTS idx_dt_conciliation_updated_at
    ON public.downtime_conciliation(updated_at);

-- ================================================================
-- SECTION 3: Trigger function para auto-update updated_at
-- ================================================================

CREATE OR REPLACE FUNCTION public.update_dt_conciliation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dt_conciliation_updated_at ON public.downtime_conciliation;
CREATE TRIGGER trg_dt_conciliation_updated_at
    BEFORE UPDATE ON public.downtime_conciliation
    FOR EACH ROW
    EXECUTE FUNCTION public.update_dt_conciliation_timestamp();

-- ================================================================
-- SECTION 4: Trigger function — enqueue OEE_MTTO_TRIGGER a epicor_sync_queue
-- ================================================================
-- Se encola cuando:
--   (a) Se INSERTA un registro con is_mtto = true (paro MTTO detectado)
--   (b) Se UPDATE a status = 'reconciled' Y conciliated_macro = 'MTTO'
--
-- Esto sigue el patrón de migration 019 (SHIFT_CLOSED / QUALITY_DISPOSITION).

CREATE OR REPLACE FUNCTION public.enqueue_oee_mtto_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_equipment_id TEXT;
    v_sintoma      TEXT;
BEGIN
    -- Determinar equipment_id desde machines catalog
    SELECT COALESCE(m.equipment_code, m.name) INTO v_equipment_id
    FROM public.machines m
    WHERE m.id = NEW.machine_id::uuid;

    -- Si no se encuentra la máquina, usar el machine_id como fallback
    IF v_equipment_id IS NULL THEN
        v_equipment_id := NEW.machine_id;
    END IF;

    -- Construir sintoma descriptivo
    v_sintoma := NEW.reason_code || ' - ' || COALESCE(NEW.conciliation_notes, 'Paro reportado por operador')
                 || ' - Máquina: ' || NEW.machine_id;

    INSERT INTO public.epicor_sync_queue (source_table, source_row_id, event_type, payload)
    VALUES (
        'downtime_conciliation',
        NEW.id,
        'OEE_MTTO_TRIGGER',
        jsonb_build_object(
            'equipment_id',  v_equipment_id,
            'sintoma',       v_sintoma,
            'oee_event_id',  NEW.oee_event_id,
            'machine_id',    NEW.machine_id,
            'reason_code',   NEW.reason_code,
            'duration_min',  NEW.duration_min,
            'conciliated_code', NEW.conciliated_code,
            'conciliated_macro', NEW.conciliated_macro
        )
    );

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enqueue_oee_mtto_trigger() IS
  'Encola un evento OEE_MTTO_TRIGGER en epicor_sync_queue cuando se crea o reconcilia un paro MTTO';

-- ================================================================
-- SECTION 5: Trigger — INSERT (is_mtto = true)
-- ================================================================
-- Cuando se crea un registro de conciliación con is_mtto = true,
-- se encola el trigger para procesamiento asíncrono.

DROP TRIGGER IF EXISTS trg_dt_conciliation_insert_mtto ON public.downtime_conciliation;
CREATE TRIGGER trg_dt_conciliation_insert_mtto
    AFTER INSERT ON public.downtime_conciliation
    FOR EACH ROW
    WHEN (NEW.is_mtto = true)
    EXECUTE FUNCTION public.enqueue_oee_mtto_trigger();

-- ================================================================
-- SECTION 6: Trigger — UPDATE (reconciled + MTTO macro)
-- ================================================================
-- Cuando el supervisor reconcilia y la causa final es MTTO,
-- se encola un segundo evento para disparar la OT.

DROP TRIGGER IF EXISTS trg_dt_conciliation_reconciled_mtto ON public.downtime_conciliation;
CREATE TRIGGER trg_dt_conciliation_reconciled_mtto
    AFTER UPDATE ON public.downtime_conciliation
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM 'reconciled'
          AND NEW.status = 'reconciled'
          AND NEW.conciliated_macro = 'MTTO'
          AND NEW.ot_sent = false)
    EXECUTE FUNCTION public.enqueue_oee_mtto_trigger();

-- ================================================================
-- SECTION 7: Notificación
-- ================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 023_downtime_conciliation aplicada:';
    RAISE NOTICE '   - Tabla downtime_conciliation creada (14+ columnas + FK)';
    RAISE NOTICE '   - 5 índices de performance';
    RAISE NOTICE '   - Trigger auto-update updated_at';
    RAISE NOTICE '   - Función enqueue_oee_mtto_trigger() - encola OEE_MTTO_TRIGGER';
    RAISE NOTICE '   - Trigger INSERT (is_mtto=true) → epicor_sync_queue';
    RAISE NOTICE '   - Trigger UPDATE (reconciled + MTTO macro) → epicor_sync_queue';
    RAISE NOTICE '';
    RAISE NOTICE '⚠ Agregar en Hasura: trackear tabla downtime_conciliation con RLS';
    RAISE NOTICE '  - Rol supervisor/admin: ALL';
    RAISE NOTICE '  - Rol operator: SELECT (solo sus máquinas)';
    RAISE NOTICE '  - Actualizar event_type COMMENT en epicor_sync_queue';
END;
$$;
