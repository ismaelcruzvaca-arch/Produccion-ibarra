-- Migration: 019_epicor_outbox_align
-- Epicor Outbox Unificado — alineación con cmms-ibero
--
-- Dependencias: public.epicor_sync_queue (migración 008), public.shift_sessions (012),
--               public.quality_inspections (010, 014)
--
-- Propósito:
--   Unifica el patrón outbox entre produccion-ibarra y cmms-ibero agregando
--   next_retry_at (backoff exponencial) y event_type (identificación de evento)
--   a epicor_sync_queue. Además, instala triggers que encolan eventos de
--   cierre de turno (SHIFT_CLOSED) y disposición de calidad (QUALITY_DISPOSITION).
--
-- Flujo:
--   1. Shift Session se cierra (active → closed) → trigger encola SHIFT_CLOSED
--   2. Quality Inspection se dispone (pending → liberado|rechazado) → trigger encola QUALITY_DISPOSITION
--   3. Worker unificado (compartido con cmms-ibero) polla epicor_sync_queue por status='pending'
--      y usa source_table para identificar el dominio (shift_sessions vs quality_inspections)
--
-- Micro-stops (oee_events) NO pasan por este outbox — van a CMMS via Hasura Event Triggers.
--
-- ================================================================
-- SECTION 1: ALTER TABLE — Nuevas columnas
-- ================================================================

ALTER TABLE public.epicor_sync_queue
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS event_type TEXT;

COMMENT ON COLUMN public.epicor_sync_queue.next_retry_at IS
  'Próximo momento para reintentar — soporta backoff exponencial';
COMMENT ON COLUMN public.epicor_sync_queue.event_type IS
  'Tipo de evento: SHIFT_CLOSED | QUALITY_DISPOSITION — identifica el caso de uso';

-- ================================================================
-- SECTION 2: Índices de polling
-- ================================================================

-- Índice principal de polling: el worker busca status='pending' ordenado por next_retry_at
CREATE INDEX IF NOT EXISTS idx_epicor_sync_poll
  ON public.epicor_sync_queue(status, next_retry_at);

-- Índice de identificación: el worker filtra por source_table para enrutar al handler correcto
CREATE INDEX IF NOT EXISTS idx_epicor_sync_source
  ON public.epicor_sync_queue(source_table, status);

-- ================================================================
-- SECTION 3: Función + Trigger — SHIFT_CLOSED
-- ================================================================
-- Trigger: AFTER UPDATE ON shift_sessions
-- WHEN: OLD.status != 'closed' AND NEW.status = 'closed'
-- Evento: SHIFT_CLOSED
-- Payload: session_id, machine_id, operator_id, shift_type, started_at, ended_at,
--          planned_boxes, product_code

CREATE OR REPLACE FUNCTION public.enqueue_shift_closed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.epicor_sync_queue (source_table, source_row_id, event_type, payload)
  VALUES (
    'shift_sessions',
    NEW.id,
    'SHIFT_CLOSED',
    jsonb_build_object(
      'session_id',   NEW.id,
      'machine_id',   NEW.machine_id,
      'operator_id',  NEW.operator_id,
      'shift_type',   NEW.shift_type,
      'started_at',   NEW.started_at,
      'ended_at',     NEW.ended_at,
      'planned_boxes', NEW.planned_boxes,
      'product_code', NEW.product_code
    )
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enqueue_shift_closed() IS
  'Encola un evento SHIFT_CLOSED en epicor_sync_queue cuando se cierra una sesión de turno';

DROP TRIGGER IF EXISTS trg_shift_closed_to_epicor ON public.shift_sessions;
CREATE TRIGGER trg_shift_closed_to_epicor
  AFTER UPDATE ON public.shift_sessions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM 'closed' AND NEW.status = 'closed')
  EXECUTE FUNCTION public.enqueue_shift_closed();

-- ================================================================
-- SECTION 4: Función + Trigger — QUALITY_DISPOSITION
-- ================================================================
-- Trigger: AFTER UPDATE ON quality_inspections
-- WHEN: OLD.disposition = 'pending' AND NEW.disposition IN ('liberado', 'rechazado')
-- Evento: QUALITY_DISPOSITION
-- Payload: inspection_id, machine_id, inspector_id, shift_type, disposition,
--          data_source, inspector_type, created_at

CREATE OR REPLACE FUNCTION public.enqueue_quality_disposition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.epicor_sync_queue (source_table, source_row_id, event_type, payload)
  VALUES (
    'quality_inspections',
    NEW.id,
    'QUALITY_DISPOSITION',
    jsonb_build_object(
      'inspection_id',  NEW.id,
      'machine_id',     NEW.machine_id,
      'inspector_id',   NEW.inspector_id,
      'shift_type',     NEW.shift_type,
      'disposition',    NEW.disposition,
      'data_source',    NEW.data_source,
      'inspector_type', NEW.inspector_type,
      'created_at',     NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enqueue_quality_disposition() IS
  'Encola un evento QUALITY_DISPOSITION en epicor_sync_queue cuando se dispone una inspección';

DROP TRIGGER IF EXISTS trg_quality_disposition_to_epicor ON public.quality_inspections;
CREATE TRIGGER trg_quality_disposition_to_epicor
  AFTER UPDATE ON public.quality_inspections
  FOR EACH ROW
  WHEN (OLD.disposition = 'pending' AND NEW.disposition IN ('liberado', 'rechazado'))
  EXECUTE FUNCTION public.enqueue_quality_disposition();
