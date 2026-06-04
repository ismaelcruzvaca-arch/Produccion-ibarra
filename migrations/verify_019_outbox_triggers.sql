-- ============================================================================
-- Script de Validación: Migration 019 — Epicor Outbox Triggers
-- ============================================================================
-- Propósito: Verificar que los triggers SHIFT_CLOSED y QUALITY_DISPOSITION
--            encolan correctamente los eventos en epicor_sync_queue.
--
-- Uso:
--   psql -U <user> -d <database> -f migrations/verify_019_outbox_triggers.sql
--
-- Expectativa: AMBAS verificaciones deben retornar '✅ PASS'
-- ============================================================================

BEGIN;

-- ============================================================================
-- PRERREQUISITOS
-- ============================================================================

-- Asegurar que existen las funciones trigger
DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'enqueue_shift_closed'
  ), 'Función enqueue_shift_closed() NO EXISTE → aplicar migration 019 primero';
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'enqueue_quality_disposition'
  ), 'Función enqueue_quality_disposition() NO EXISTE → aplicar migration 019 primero';
END $$;

-- Asegurar que existen los triggers
DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_shift_closed_to_epicor'
    AND tgrelid = 'shift_sessions'::regclass
  ), 'Trigger trg_shift_closed_to_epicor NO EXISTE';
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_quality_disposition_to_epicor'
    AND tgrelid = 'quality_inspections'::regclass
  ), 'Trigger trg_quality_disposition_to_epicor NO EXISTE';
END $$;

RAISE NOTICE '✅ PRERREQUISITOS: OK';

-- ============================================================================
-- TEST 1: SHIFT_CLOSED
-- ============================================================================

-- 1a. Insertar sesión de turno activa
INSERT INTO public.shift_sessions (id, machine_id, operator_id, shift_type, status, started_at, planned_boxes, product_code)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  (SELECT id FROM public.machines LIMIT 1),
  'OP-001',
  'matutino',
  'active',
  NOW(),
  480,
  '102/953'
);

-- 1b. Cerrar la sesión (debería disparar el trigger)
UPDATE public.shift_sessions
SET status = 'closed', ended_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 1c. Verificar que se encoló el evento SHIFT_CLOSED
DO $$
DECLARE
  v_count INT;
  v_event VARCHAR;
  v_payload JSONB;
BEGIN
  SELECT COUNT(*), event_type, payload
  INTO v_count, v_event, v_payload
  FROM public.epicor_sync_queue
  WHERE source_table = 'shift_sessions'
    AND source_row_id = '00000000-0000-0000-0000-000000000001'
  GROUP BY event_type, payload;

  ASSERT v_count = 1, 'SHIFT_CLOSED: Se esperaba 1 fila en epicor_sync_queue, se encontraron ' || v_count;
  ASSERT v_event = 'SHIFT_CLOSED', 'SHIFT_CLOSED: event_type incorrecto: ' || COALESCE(v_event, 'NULL');
  ASSERT v_payload ? 'session_id', 'SHIFT_CLOSED: payload no contiene session_id';
  ASSERT v_payload ? 'machine_id', 'SHIFT_CLOSED: payload no contiene machine_id';
  ASSERT v_payload ? 'planned_boxes', 'SHIFT_CLOSED: payload no contiene planned_boxes';
  ASSERT v_payload ? 'product_code', 'SHIFT_CLOSED: payload no contiene product_code';

  RAISE NOTICE '✅ TEST 1 (SHIFT_CLOSED): PASS — event_type=%, payload tiene session_id, machine_id, planned_boxes, product_code', v_event;
END $$;

-- ============================================================================
-- TEST 2: QUALITY_DISPOSITION
-- ============================================================================

-- 2a. Insertar inspección de calidad con disposition = 'pending'
INSERT INTO public.quality_inspections (id, machine_id, inspector_id, shift_type, disposition, data_source)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  (SELECT id FROM public.machines LIMIT 1),
  'OP-001',
  'matutino',
  'pending',
  'manual'
);

-- 2b. Disponer la inspección como 'liberado' (debería disparar el trigger)
UPDATE public.quality_inspections
SET disposition = 'liberado'
WHERE id = '00000000-0000-0000-0000-000000000002';

-- 2c. Verificar que se encoló el evento QUALITY_DISPOSITION
DO $$
DECLARE
  v_count INT;
  v_event VARCHAR;
  v_payload JSONB;
BEGIN
  SELECT COUNT(*), event_type, payload
  INTO v_count, v_event, v_payload
  FROM public.epicor_sync_queue
  WHERE source_table = 'quality_inspections'
    AND source_row_id = '00000000-0000-0000-0000-000000000002'
  GROUP BY event_type, payload;

  ASSERT v_count = 1, 'QUALITY_DISPOSITION: Se esperaba 1 fila en epicor_sync_queue, se encontraron ' || v_count;
  ASSERT v_event = 'QUALITY_DISPOSITION', 'QUALITY_DISPOSITION: event_type incorrecto: ' || COALESCE(v_event, 'NULL');
  ASSERT v_payload ? 'disposition', 'QUALITY_DISPOSITION: payload no contiene disposition';
  ASSERT v_payload ? 'data_source', 'QUALITY_DISPOSITION: payload no contiene data_source';
  ASSERT v_payload ->> 'disposition' = 'liberado', 'QUALITY_DISPOSITION: disposition debería ser liberado';

  RAISE NOTICE '✅ TEST 2 (QUALITY_DISPOSITION): PASS — event_type=%, disposition=%', v_event, v_payload ->> 'disposition';
END $$;

-- ============================================================================
-- TEST 3: EDGE CASE — QUALITY_DISPOSITION no debe dispararse si ya estaba disposada
-- ============================================================================

-- 3a. Insertar inspección ya disposada como 'rechazado'
INSERT INTO public.quality_inspections (id, machine_id, inspector_id, shift_type, disposition, data_source)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  (SELECT id FROM public.machines LIMIT 1),
  'OP-002',
  'vespertino',
  'rechazado',
  'manual'
);

-- 3b. Actualizar notes (NO debería insertar en epicor_sync_queue porque disposition no cambia)
UPDATE public.quality_inspections
SET notes = 'Nota de prueba — no debe generar evento'
WHERE id = '00000000-0000-0000-0000-000000000003';

-- 3c. Verificar que NO se insertó nada
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.epicor_sync_queue
  WHERE source_table = 'quality_inspections'
    AND source_row_id = '00000000-0000-0000-0000-000000000003';

  ASSERT v_count = 0, 'EDGE CASE: Se insertó evento para inspección ya disposada — el trigger WHEN no funciona';
  RAISE NOTICE '✅ TEST 3 (EDGE CASE — sin re-dispone): PASS — 0 eventos creados (trigger WHEN ok)';
END $$;

-- ============================================================================
-- LIMPIEZA
-- ============================================================================

DELETE FROM public.epicor_sync_queue
WHERE source_row_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
);

DELETE FROM public.quality_inspections
WHERE id IN (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
);

DELETE FROM public.shift_sessions
WHERE id = '00000000-0000-0000-0000-000000000001';

-- ============================================================================
-- REPORTE FINAL
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '╔═══════════════════════════════════════════════════════════╗';
RAISE NOTICE '║     VALIDACIÓN MIGRATION 019 — COMPLETA                 ║';
RAISE NOTICE '╠═══════════════════════════════════════════════════════════╣';
RAISE NOTICE '║  TEST 1: SHIFT_CLOSED         ✅ PASS                    ║';
RAISE NOTICE '║  TEST 2: QUALITY_DISPOSITION  ✅ PASS                    ║';
RAISE NOTICE '║  TEST 3: EDGE CASE (no re-fire) ✅ PASS                  ║';
RAISE NOTICE '╚═══════════════════════════════════════════════════════════╝';

COMMIT;
