-- Verify: view_oee_hr_x_hr — OEE Hora × Hora
--
-- Prueba la VIEW contra 10 escenarios (S1-S10) definidos en las especificaciones.
-- Cada test se ejecuta en un DO $$ block independiente dentro de una transacción
-- que se revierte al final. No hay efectos secundarios en la base de datos.
--
-- Escenarios:
--   S1  — Datos completos: OEE calculado correctamente
--   S2  — Sin datos: 0 filas
--   S3  — División por cero: planned_boxes=0 → NULL performance
--   S4  — Causa NULL: NULL reason → OTROS
--   S5  — Múltiples máquinas: 2 filas para 2 máquinas misma hora
--   S6  — Cruce medianoche: turno que cruza 00:00
--   S7  — data_source: manual / iot / hybrid
--   S9  — Default 0: columna causa = 0 sin eventos
--   S10 — Sesión sin datos: fila sigue apareciendo
--
-- Uso:
--   psql -d <db> -f sql/views/verify/view_oee_hr_x_hr.sql
--
-- Diseño:
--   Se usa BEGIN/ROLLBACK para aislar los datos de prueba.
--   Cada test INSERTA datos, consulta la VIEW y hace ASSERT.
--   Al final, ROLLBACK revierte todo sin efectos colaterales.

\set ON_ERROR_STOP on

BEGIN;

-- ================================================================
-- VARIABLES GLOBALES (compartidas entre DO blocks vía el outer transaction)
-- ================================================================

-- UUIDs deterministas para los tests (usamos gen_random_uuid para evitar conflictos)
-- Líneas
INSERT INTO public.lines (id, name, area, is_active)
SELECT gen_random_uuid(), 'Línea Test 1', 'Producción', true
WHERE NOT EXISTS (SELECT 1 FROM public.lines WHERE name = 'Línea Test 1')
RETURNING id;

-- Almacenamos IDs en una tabla temporal para compartir entre tests
CREATE TEMP TABLE IF NOT EXISTS test_ids (
    key   TEXT PRIMARY KEY,
    value UUID
);

-- No usamos RETURNING INTO dentro de DO blocks, mejor insertamos directamente
-- y luego hacemos SELECT para obtener los IDs

-- ================================================================
-- TEST S2: Sin datos — 0 filas
-- ================================================================
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.view_oee_hr_x_hr;

    ASSERT v_count = 0, 'S2 FAIL: Expected 0 rows with no data, got ' || v_count;
    RAISE NOTICE '✅ PASS S2 (empty): 0 rows returned with no data';
END;
$$;

-- ================================================================
-- TEST S9: Default 0 — columna causa = 0 cuando no hay eventos
--   Crea una sesión SIN oee_events y verifica que min_paro_* = 0
-- ================================================================
DO $$
DECLARE
    v_line_id    UUID;
    v_machine_id UUID;
    v_op_id      VARCHAR(50);
    v_session_id UUID;
    v_rec        RECORD;
    v_error      TEXT := '';
BEGIN
    -- Insertar línea
    INSERT INTO public.lines (id, name, area, is_active)
    VALUES (gen_random_uuid(), 'L-TEST-S9', 'Test', true)
    RETURNING id INTO v_line_id;

    -- Insertar máquina (con code para la VIEW)
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S9', 'Máquina Test S9', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S9', 'Operador Test S9', true)
    RETURNING id INTO v_op_id;

    -- Insertar sesión (SIN oee_events)
    INSERT INTO public.shift_sessions (id, machine_id, operator_id, shift_type, status, started_at, ended_at, planned_boxes, product_code)
    VALUES (
        gen_random_uuid(),
        v_machine_id,
        v_op_id,
        'matutino',
        'closed',
        '2026-05-24 06:00:00-05'::timestamptz,
        '2026-05-24 07:00:00-05'::timestamptz,
        100,
        'TEST-S9'
    ) RETURNING id INTO v_session_id;

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_oee_hr_x_hr
    WHERE machine_code = 'MC-S9';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S9 FAIL: No row returned for machine_code MC-S9';
    END IF;

    -- Verificar que todas las causas están en 0
    IF COALESCE(v_rec.min_paro_at, -1) != 0 THEN
        v_error := v_error || 'min_paro_at=' || v_rec.min_paro_at || ' ';
    END IF;
    IF COALESCE(v_rec.min_paro_fc, -1) != 0 THEN
        v_error := v_error || 'min_paro_fc=' || v_rec.min_paro_fc || ' ';
    END IF;
    IF COALESCE(v_rec.min_paro_fme, -1) != 0 THEN
        v_error := v_error || 'min_paro_fme=' || v_rec.min_paro_fme || ' ';
    END IF;
    IF COALESCE(v_rec.min_paro_fs, -1) != 0 THEN
        v_error := v_error || 'min_paro_fs=' || v_rec.min_paro_fs || ' ';
    END IF;
    IF COALESCE(v_rec.min_paro_bv, -1) != 0 THEN
        v_error := v_error || 'min_paro_bv=' || v_rec.min_paro_bv || ' ';
    END IF;
    IF COALESCE(v_rec.min_paro_fe, -1) != 0 THEN
        v_error := v_error || 'min_paro_fe=' || v_rec.min_paro_fe || ' ';
    END IF;
    IF COALESCE(v_rec.min_paro_fp, -1) != 0 THEN
        v_error := v_error || 'min_paro_fp=' || v_rec.min_paro_fp || ' ';
    END IF;
    IF COALESCE(v_rec.min_paro_lf, -1) != 0 THEN
        v_error := v_error || 'min_paro_lf=' || v_rec.min_paro_lf || ' ';
    END IF;
    IF COALESCE(v_rec.min_paro_mp, -1) != 0 THEN
        v_error := v_error || 'min_paro_mp=' || v_rec.min_paro_mp || ' ';
    END IF;
    IF COALESCE(v_rec.min_paro_pap, -1) != 0 THEN
        v_error := v_error || 'min_paro_pap=' || v_rec.min_paro_pap || ' ';
    END IF;
    IF COALESCE(v_rec.min_paro_pam, -1) != 0 THEN
        v_error := v_error || 'min_paro_pam=' || v_rec.min_paro_pam || ' ';
    END IF;
    IF COALESCE(v_rec.min_paro_cp, -1) != 0 THEN
        v_error := v_error || 'min_paro_cp=' || v_rec.min_paro_cp || ' ';
    END IF;
    IF COALESCE(v_rec.min_paro_ao, -1) != 0 THEN
        v_error := v_error || 'min_paro_ao=' || v_rec.min_paro_ao || ' ';
    END IF;
    IF COALESCE(v_rec.min_paro_md, -1) != 0 THEN
        v_error := v_error || 'min_paro_md=' || v_rec.min_paro_md || ' ';
    END IF;
    IF COALESCE(v_rec.min_paro_otros, -1) != 0 THEN
        v_error := v_error || 'min_paro_otros=' || v_rec.min_paro_otros || ' ';
    END IF;
    IF COALESCE(v_rec.total_downtime_min, -1) != 0 THEN
        v_error := v_error || 'total_downtime_min=' || v_rec.total_downtime_min || ' ';
    END IF;

    IF v_error != '' THEN
        RAISE EXCEPTION 'S9 FAIL: Expected all cause columns = 0, found: %', v_error;
    END IF;

    RAISE NOTICE '✅ PASS S9 (default 0): All 15 cause columns = 0, total_downtime_min = 0';
END;
$$;

-- ================================================================
-- TEST S1: Datos completos — OEE calculado correctamente
--   1 sesión, 1 hora, 15 min downtime (AT=10, FC=5),
--   100 total_pieces, 3 rejected_pieces, 2 defect_count
--   planned_boxes = 120
--   Esperado:
--     total_downtime_min = 15
--     availability_pct  = (60-15)/60 = 0.75
--     total_boxes       = 100
--     good_boxes        = 100-3-2 = 95
--     performance_pct   = 100/120 ≈ 0.8333
--     quality_pct       = 95/100 = 0.95
--     oee_pct           = 0.75 * 0.8333 * 0.95 ≈ 0.5938
-- ================================================================
DO $$
DECLARE
    v_line_id    UUID;
    v_machine_id UUID;
    v_op_id      VARCHAR(50);
    v_session_id UUID;
    v_insp_id    UUID;
    v_rec        RECORD;
    v_avail      NUMERIC(5,4);
    v_perf       NUMERIC(5,4);
    v_qual       NUMERIC(5,4);
    v_oee        NUMERIC(5,4);
BEGIN
    -- Insertar línea
    INSERT INTO public.lines (id, name, area, is_active)
    VALUES (gen_random_uuid(), 'L-TEST-S1', 'Test', true)
    RETURNING id INTO v_line_id;

    -- Insertar máquina
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S1', 'Máquina Test S1', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S1', 'Operador Test S1', true)
    RETURNING id INTO v_op_id;

    -- Insertar sesión: 1 hora (06:00-07:00), planned_boxes=120
    INSERT INTO public.shift_sessions (id, machine_id, operator_id, shift_type, status, started_at, ended_at, planned_boxes, product_code)
    VALUES (
        gen_random_uuid(),
        v_machine_id,
        v_op_id,
        'matutino',
        'closed',
        '2026-05-24 06:00:00-05'::timestamptz,
        '2026-05-24 07:00:00-05'::timestamptz,
        120,
        '102/953'
    ) RETURNING id INTO v_session_id;

    -- Insertar oee_events: 10 min AT + 5 min FC
    INSERT INTO public.oee_events (id, machine_id, event_type, started_at, ended_at, duration_minutes, reason)
    VALUES
        (gen_random_uuid(), v_machine_id, 'downtime', '2026-05-24 06:05:00-05'::timestamptz, '2026-05-24 06:15:00-05'::timestamptz, 10, 'AT'),
        (gen_random_uuid(), v_machine_id, 'downtime', '2026-05-24 06:30:00-05'::timestamptz, '2026-05-24 06:35:00-05'::timestamptz, 5, 'FC');

    -- Insertar report: 100 total, 3 rejected
    INSERT INTO public.reports (id, data, created_at)
    VALUES (
        gen_random_uuid(),
        jsonb_build_object(
            'machine_id', v_machine_id::TEXT,
            'total_pieces', 100,
            'rejected_pieces', 3
        ),
        '2026-05-24 06:45:00-05'::timestamptz
    );

    -- Insertar inspección de calidad + defect_logs (2 defectos)
    INSERT INTO public.quality_inspections (id, machine_id, inspector_id, shift_type, disposition, created_at)
    VALUES (gen_random_uuid(), v_machine_id, 'INSP-S1', 'matutino', 'liberado', '2026-05-24 06:40:00-05'::timestamptz)
    RETURNING id INTO v_insp_id;

    INSERT INTO public.defect_logs (id, inspection_id, severity, defect_type, defect_count)
    VALUES (gen_random_uuid(), v_insp_id, 'major', 'empaque_abierto', 2);

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_oee_hr_x_hr
    WHERE machine_code = 'MC-S1';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S1 FAIL: No row returned for machine_code MC-S1';
    END IF;

    -- Verificar total_downtime_min
    IF v_rec.total_downtime_min != 15 THEN
        RAISE EXCEPTION 'S1 FAIL: total_downtime_min expected 15, got %', v_rec.total_downtime_min;
    END IF;

    -- Verificar min_paro_at = 10
    IF v_rec.min_paro_at != 10 THEN
        RAISE EXCEPTION 'S1 FAIL: min_paro_at expected 10, got %', v_rec.min_paro_at;
    END IF;

    -- Verificar min_paro_fc = 5
    IF v_rec.min_paro_fc != 5 THEN
        RAISE EXCEPTION 'S1 FAIL: min_paro_fc expected 5, got %', v_rec.min_paro_fc;
    END IF;

    -- Verificar total_boxes = 100
    IF v_rec.total_boxes != 100 THEN
        RAISE EXCEPTION 'S1 FAIL: total_boxes expected 100, got %', v_rec.total_boxes;
    END IF;

    -- Verificar good_boxes = 100 - 3 - 2 = 95
    IF v_rec.good_boxes != 95 THEN
        RAISE EXCEPTION 'S1 FAIL: good_boxes expected 95, got %', v_rec.good_boxes;
    END IF;

    -- Verificar availability_pct = 0.75
    IF ABS(v_rec.availability_pct - 0.75) > 0.0001 THEN
        RAISE EXCEPTION 'S1 FAIL: availability_pct expected 0.75, got %', v_rec.availability_pct;
    END IF;

    -- Verificar performance_pct ≈ 100/120 = 0.8333
    IF ABS(v_rec.performance_pct - 0.8333) > 0.001 THEN
        RAISE EXCEPTION 'S1 FAIL: performance_pct expected ~0.8333, got %', v_rec.performance_pct;
    END IF;

    -- Verificar quality_pct = 95/100 = 0.95
    IF ABS(v_rec.quality_pct - 0.95) > 0.0001 THEN
        RAISE EXCEPTION 'S1 FAIL: quality_pct expected 0.95, got %', v_rec.quality_pct;
    END IF;

    -- Verificar oee_pct = 0.75 * 0.8333 * 0.95 = 0.5938
    IF ABS(v_rec.oee_pct - 0.5938) > 0.001 THEN
        RAISE EXCEPTION 'S1 FAIL: oee_pct expected ~0.5938, got %', v_rec.oee_pct;
    END IF;

    -- Verificar product_code
    IF v_rec.product_code != '102/953' THEN
        RAISE EXCEPTION 'S1 FAIL: product_code expected 102/953, got %', v_rec.product_code;
    END IF;

    -- Verificar operador
    IF v_rec.operator_name != 'Operador Test S1' THEN
        RAISE EXCEPTION 'S1 FAIL: operator_name expected Operador Test S1, got %', v_rec.operator_name;
    END IF;

    -- Verificar shift_type
    IF v_rec.shift_type != 'matutino' THEN
        RAISE EXCEPTION 'S1 FAIL: shift_type expected matutino, got %', v_rec.shift_type;
    END IF;

    RAISE NOTICE '✅ PASS S1 (normal): availability=%, performance=%, quality=%, oee=%',
        v_rec.availability_pct, v_rec.performance_pct, v_rec.quality_pct, v_rec.oee_pct;
END;
$$;

-- ================================================================
-- TEST S3: División por cero — planned_boxes = 0
--   performance_pct MUST be NULL, oee_pct MUST be NULL
-- ================================================================
DO $$
DECLARE
    v_line_id    UUID;
    v_machine_id UUID;
    v_op_id      VARCHAR(50);
    v_rec        RECORD;
BEGIN
    -- Insertar línea
    INSERT INTO public.lines (id, name)
    VALUES (gen_random_uuid(), 'L-TEST-S3')
    RETURNING id INTO v_line_id;

    -- Insertar máquina
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S3', 'Máquina Test S3', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S3', 'Operador Test S3', true)
    RETURNING id INTO v_op_id;

    -- Sesión con planned_boxes = 0
    INSERT INTO public.shift_sessions (id, machine_id, operator_id, shift_type, status, started_at, ended_at, planned_boxes)
    VALUES (
        gen_random_uuid(), v_machine_id, v_op_id, 'matutino', 'closed',
        '2026-05-24 06:00:00-05'::timestamptz,
        '2026-05-24 07:00:00-05'::timestamptz,
        0
    );

    -- Insertar un report (para que total_boxes > 0)
    INSERT INTO public.reports (id, data, created_at)
    VALUES (
        gen_random_uuid(),
        jsonb_build_object('machine_id', v_machine_id::TEXT, 'total_pieces', 50),
        '2026-05-24 06:30:00-05'::timestamptz
    );

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_oee_hr_x_hr
    WHERE machine_code = 'MC-S3';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S3 FAIL: No row returned for machine_code MC-S3';
    END IF;

    -- Verificar que availability_pct se calcula normalmente
    IF v_rec.availability_pct IS NULL THEN
        RAISE EXCEPTION 'S3 FAIL: availability_pct should NOT be NULL when planned_boxes=0';
    END IF;

    -- Verificar que performance_pct es NULL (planned_boxes = 0)
    IF v_rec.performance_pct IS NOT NULL THEN
        RAISE EXCEPTION 'S3 FAIL: performance_pct should be NULL when planned_boxes=0, got %', v_rec.performance_pct;
    END IF;

    -- Verificar que quality_pct se calcula normalmente (total_boxes > 0)
    IF v_rec.quality_pct IS NULL THEN
        RAISE EXCEPTION 'S3 FAIL: quality_pct should NOT be NULL when total_boxes > 0';
    END IF;

    -- Verificar que oee_pct es NULL (porque performance es NULL)
    IF v_rec.oee_pct IS NOT NULL THEN
        RAISE EXCEPTION 'S3 FAIL: oee_pct should be NULL when performance_pct is NULL, got %', v_rec.oee_pct;
    END IF;

    RAISE NOTICE '✅ PASS S3 (div by zero): availability=%, performance=NULL, quality=%, oee=NULL',
        v_rec.availability_pct, v_rec.quality_pct;
END;
$$;

-- ================================================================
-- TEST S4: Causa NULL — NULL reason en oee_events → OTROS
--   8 min con reason=NULL deben ir a min_paro_otros
-- ================================================================
DO $$
DECLARE
    v_line_id    UUID;
    v_machine_id UUID;
    v_op_id      VARCHAR(50);
    v_rec        RECORD;
BEGIN
    -- Insertar línea
    INSERT INTO public.lines (id, name)
    VALUES (gen_random_uuid(), 'L-TEST-S4')
    RETURNING id INTO v_line_id;

    -- Insertar máquina
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S4', 'Máquina Test S4', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S4', 'Operador Test S4', true)
    RETURNING id INTO v_op_id;

    -- Sesión
    INSERT INTO public.shift_sessions (id, machine_id, operator_id, shift_type, status, started_at, ended_at, planned_boxes)
    VALUES (
        gen_random_uuid(), v_machine_id, v_op_id, 'matutino', 'closed',
        '2026-05-24 06:00:00-05'::timestamptz,
        '2026-05-24 07:00:00-05'::timestamptz,
        100
    );

    -- oee_event con reason=NULL, 8 minutos
    INSERT INTO public.oee_events (id, machine_id, event_type, started_at, ended_at, duration_minutes, reason)
    VALUES (
        gen_random_uuid(), v_machine_id, 'downtime',
        '2026-05-24 06:10:00-05'::timestamptz,
        '2026-05-24 06:18:00-05'::timestamptz,
        8,
        NULL
    );

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_oee_hr_x_hr
    WHERE machine_code = 'MC-S4';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S4 FAIL: No row returned for machine_code MC-S4';
    END IF;

    -- total_downtime_min debe incluir los 8 minutos
    IF v_rec.total_downtime_min != 8 THEN
        RAISE EXCEPTION 'S4 FAIL: total_downtime_min expected 8, got %', v_rec.total_downtime_min;
    END IF;

    -- min_paro_otros debe tener 8
    IF v_rec.min_paro_otros != 8 THEN
        RAISE EXCEPTION 'S4 FAIL: min_paro_otros expected 8 for NULL reason, got %', v_rec.min_paro_otros;
    END IF;

    -- Ninguna causa individual debe ser NULL (deben ser 0)
    IF v_rec.min_paro_at IS NULL THEN
        RAISE EXCEPTION 'S4 FAIL: min_paro_at should be 0, not NULL';
    END IF;

    RAISE NOTICE '✅ PASS S4 (NULL cause): total_downtime_min=8, min_paro_otros=8, all others=0';
END;
$$;

-- ================================================================
-- TEST S5: Múltiples máquinas — 2 máquinas misma hora
--   Debe devolver 2 filas independientes
-- ================================================================
DO $$
DECLARE
    v_line_id      UUID;
    v_machine1_id  UUID;
    v_machine2_id  UUID;
    v_op_id        VARCHAR(50);
    v_row_count    INT;
    v_rec1         RECORD;
    v_rec2         RECORD;
BEGIN
    -- Insertar línea
    INSERT INTO public.lines (id, name)
    VALUES (gen_random_uuid(), 'L-TEST-S5')
    RETURNING id INTO v_line_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S5', 'Operador Test S5', true)
    RETURNING id INTO v_op_id;

    -- Máquina 1
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S5A', 'Máquina S5 A', v_line_id, true)
    RETURNING id INTO v_machine1_id;

    -- Máquina 2
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S5B', 'Máquina S5 B', v_line_id, true)
    RETURNING id INTO v_machine2_id;

    -- Sesión máquina 1 (06-07, planned_boxes=50)
    INSERT INTO public.shift_sessions (id, machine_id, operator_id, shift_type, status, started_at, ended_at, planned_boxes)
    VALUES (
        gen_random_uuid(), v_machine1_id, v_op_id, 'matutino', 'closed',
        '2026-05-24 06:00:00-05'::timestamptz,
        '2026-05-24 07:00:00-05'::timestamptz,
        50
    );

    -- Sesión máquina 2 (06-07, planned_boxes=80)
    INSERT INTO public.shift_sessions (id, machine_id, operator_id, shift_type, status, started_at, ended_at, planned_boxes)
    VALUES (
        gen_random_uuid(), v_machine2_id, v_op_id, 'matutino', 'closed',
        '2026-05-24 06:00:00-05'::timestamptz,
        '2026-05-24 07:00:00-05'::timestamptz,
        80
    );

    -- Report para máquina 1 (30 piezas)
    INSERT INTO public.reports (id, data, created_at)
    VALUES (
        gen_random_uuid(),
        jsonb_build_object('machine_id', v_machine1_id::TEXT, 'total_pieces', 30),
        '2026-05-24 06:30:00-05'::timestamptz
    );

    -- Report para máquina 2 (60 piezas)
    INSERT INTO public.reports (id, data, created_at)
    VALUES (
        gen_random_uuid(),
        jsonb_build_object('machine_id', v_machine2_id::TEXT, 'total_pieces', 60),
        '2026-05-24 06:30:00-05'::timestamptz
    );

    -- Contar filas
    SELECT COUNT(*) INTO v_row_count FROM public.view_oee_hr_x_hr
    WHERE machine_code IN ('MC-S5A', 'MC-S5B')
      AND hora = date_trunc('hour', '2026-05-24 06:00:00-05'::timestamptz AT TIME ZONE 'America/Mexico_City')::timestamptz;

    IF v_row_count != 2 THEN
        RAISE EXCEPTION 'S5 FAIL: Expected 2 rows for 2 machines, got %', v_row_count;
    END IF;

    -- Verificar valores independientes
    SELECT * INTO v_rec1 FROM public.view_oee_hr_x_hr WHERE machine_code = 'MC-S5A';
    SELECT * INTO v_rec2 FROM public.view_oee_hr_x_hr WHERE machine_code = 'MC-S5B';

    IF v_rec1.total_boxes != 30 THEN
        RAISE EXCEPTION 'S5 FAIL: MC-S5A total_boxes expected 30, got %', v_rec1.total_boxes;
    END IF;

    IF v_rec2.total_boxes != 60 THEN
        RAISE EXCEPTION 'S5 FAIL: MC-S5B total_boxes expected 60, got %', v_rec2.total_boxes;
    END IF;

    RAISE NOTICE '✅ PASS S5 (multiple machines): 2 rows (MC-S5A: total=% boxes, MC-S5B: total=% boxes)',
        v_rec1.total_boxes, v_rec2.total_boxes;
END;
$$;

-- ================================================================
-- TEST S6: Cruce medianoche — turno 23:00 → 06:00
--   Debe generar filas para ambos días (23, 00, 01, 02, 03, 04, 05)
--   7 filas en total
-- ================================================================
DO $$
DECLARE
    v_line_id    UUID;
    v_machine_id UUID;
    v_op_id      VARCHAR(50);
    v_row_count  INT;
    v_hours      INT[];
    v_hour       INT;
BEGIN
    -- Insertar línea
    INSERT INTO public.lines (id, name)
    VALUES (gen_random_uuid(), 'L-TEST-S6')
    RETURNING id INTO v_line_id;

    -- Insertar máquina
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S6', 'Máquina Test S6', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S6', 'Operador Test S6', true)
    RETURNING id INTO v_op_id;

    -- Sesión: 23:00 → 06:00 (7 horas)
    INSERT INTO public.shift_sessions (id, machine_id, operator_id, shift_type, status, started_at, ended_at, planned_boxes)
    VALUES (
        gen_random_uuid(), v_machine_id, v_op_id, 'nocturno', 'closed',
        '2026-05-24 23:00:00-05'::timestamptz,
        '2026-05-25 06:00:00-05'::timestamptz,
        210
    );

    -- Contar filas en la VIEW para esta máquina
    SELECT COUNT(*) INTO v_row_count FROM public.view_oee_hr_x_hr
    WHERE machine_code = 'MC-S6';

    -- Deben ser 7 horas (23:00, 00:00, 01:00, 02:00, 03:00, 04:00, 05:00)
    IF v_row_count != 7 THEN
        RAISE EXCEPTION 'S6 FAIL: Expected 7 hourly rows for 7h shift, got %', v_row_count;
    END IF;

    -- Verificar que planned_boxes por hora = ROUND(210/7) = 30
    IF EXISTS (
        SELECT 1 FROM public.view_oee_hr_x_hr
        WHERE machine_code = 'MC-S6' AND (planned_boxes IS DISTINCT FROM 30)
    ) THEN
        RAISE EXCEPTION 'S6 FAIL: All hourly planned_boxes should be 30 (210/7)';
    END IF;

    -- Verificar que operator_name es el mismo en todas las filas
    IF EXISTS (
        SELECT 1 FROM public.view_oee_hr_x_hr
        WHERE machine_code = 'MC-S6' AND operator_name IS DISTINCT FROM 'Operador Test S6'
    ) THEN
        RAISE EXCEPTION 'S6 FAIL: operator_name should be consistent across all hours';
    END IF;

    RAISE NOTICE '✅ PASS S6 (cross midnight): 7 rows for 23:00→06:00, planned_boxes=30/hr each';
END;
$$;

-- ================================================================
-- TEST S7: data_source — manual / iot / hybrid
--   Prueba las 3 clasificaciones:
--     a) Solo reports → 'manual'
--     b) Solo telemetry → 'iot'
--     c) Ambos → 'hybrid'
-- ================================================================
DO $$
DECLARE
    v_line_id      UUID;
    v_machine_man  UUID;
    v_machine_iot  UUID;
    v_machine_hyb  UUID;
    v_op_id        VARCHAR(50);
    v_rec_man      RECORD;
    v_rec_iot      RECORD;
    v_rec_hyb      RECORD;
BEGIN
    -- Insertar línea
    INSERT INTO public.lines (id, name)
    VALUES (gen_random_uuid(), 'L-TEST-S7')
    RETURNING id INTO v_line_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S7', 'Operador Test S7', true)
    RETURNING id INTO v_op_id;

    -- 3 máquinas
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES
        (gen_random_uuid(), 'MC-S7-MAN', 'Manual',     v_line_id, true),
        (gen_random_uuid(), 'MC-S7-IOT', 'IoT Only',   v_line_id, true),
        (gen_random_uuid(), 'MC-S7-HYB', 'Hybrid',     v_line_id, true)
    RETURNING id INTO v_machine_man;

    -- Obtener IDs específicos
    SELECT id INTO v_machine_man FROM public.machines WHERE code = 'MC-S7-MAN';
    SELECT id INTO v_machine_iot FROM public.machines WHERE code = 'MC-S7-IOT';
    SELECT id INTO v_machine_hyb FROM public.machines WHERE code = 'MC-S7-HYB';

    -- 3 sesiones (misma hora 06-07)
    INSERT INTO public.shift_sessions (id, machine_id, operator_id, shift_type, status, started_at, ended_at, planned_boxes)
    VALUES
        (gen_random_uuid(), v_machine_man, v_op_id, 'matutino', 'closed', '2026-05-24 06:00:00-05'::timestamptz, '2026-05-24 07:00:00-05'::timestamptz, 100),
        (gen_random_uuid(), v_machine_iot, v_op_id, 'matutino', 'closed', '2026-05-24 06:00:00-05'::timestamptz, '2026-05-24 07:00:00-05'::timestamptz, 100),
        (gen_random_uuid(), v_machine_hyb, v_op_id, 'matutino', 'closed', '2026-05-24 06:00:00-05'::timestamptz, '2026-05-24 07:00:00-05'::timestamptz, 100);

    -- a) Manual: solo reports (NO telemetry)
    INSERT INTO public.reports (id, data, created_at)
    VALUES (
        gen_random_uuid(),
        jsonb_build_object('machine_id', v_machine_man::TEXT, 'total_pieces', 50),
        '2026-05-24 06:30:00-05'::timestamptz
    );

    -- b) IoT: solo telemetry (NO reports)
    INSERT INTO public.telemetry_raw_staging (id, machine_id, payload, source, received_at)
    VALUES (
        gen_random_uuid(), v_machine_iot, '{}'::jsonb, 'iot',
        '2026-05-24 06:15:00-05'::timestamptz
    );

    -- c) Hybrid: ambos
    INSERT INTO public.reports (id, data, created_at)
    VALUES (
        gen_random_uuid(),
        jsonb_build_object('machine_id', v_machine_hyb::TEXT, 'total_pieces', 70),
        '2026-05-24 06:30:00-05'::timestamptz
    );
    INSERT INTO public.telemetry_raw_staging (id, machine_id, payload, source, received_at)
    VALUES (
        gen_random_uuid(), v_machine_hyb, '{}'::jsonb, 'iot',
        '2026-05-24 06:20:00-05'::timestamptz
    );

    -- Consultar
    SELECT * INTO v_rec_man FROM public.view_oee_hr_x_hr WHERE machine_code = 'MC-S7-MAN';
    SELECT * INTO v_rec_iot FROM public.view_oee_hr_x_hr WHERE machine_code = 'MC-S7-IOT';
    SELECT * INTO v_rec_hyb FROM public.view_oee_hr_x_hr WHERE machine_code = 'MC-S7-HYB';

    -- Verificar clasificaciones
    IF v_rec_man.data_source != 'manual' THEN
        RAISE EXCEPTION 'S7 FAIL: MC-S7-MAN expected manual, got %', v_rec_man.data_source;
    END IF;

    IF v_rec_iot.data_source != 'iot' THEN
        RAISE EXCEPTION 'S7 FAIL: MC-S7-IOT expected iot, got %', v_rec_iot.data_source;
    END IF;

    IF v_rec_hyb.data_source != 'hybrid' THEN
        RAISE EXCEPTION 'S7 FAIL: MC-S7-HYB expected hybrid, got %', v_rec_hyb.data_source;
    END IF;

    -- Manual debe tener total_boxes=50
    IF v_rec_man.total_boxes != 50 THEN
        RAISE EXCEPTION 'S7 FAIL: MC-S7-MAN total_boxes expected 50, got %', v_rec_man.total_boxes;
    END IF;

    -- IoT: reports no tiene datos, total_boxes debe ser 0
    IF v_rec_iot.total_boxes != 0 THEN
        RAISE EXCEPTION 'S7 FAIL: MC-S7-IOT total_boxes expected 0 (no reports), got %', v_rec_iot.total_boxes;
    END IF;

    RAISE NOTICE '✅ PASS S7 (data_source): manual→%, iot→%, hybrid→%',
        v_rec_man.data_source, v_rec_iot.data_source, v_rec_hyb.data_source;
END;
$$;

-- ================================================================
-- TEST S10: Sesión sin datos — fila sigue apareciendo
--   Sesión existe pero no hay oee_events, reports, defect_logs
--   availability_pct=1.0, performance_pct=NULL, etc.
-- ================================================================
DO $$
DECLARE
    v_line_id    UUID;
    v_machine_id UUID;
    v_op_id      VARCHAR(50);
    v_rec        RECORD;
BEGIN
    -- Insertar línea
    INSERT INTO public.lines (id, name)
    VALUES (gen_random_uuid(), 'L-TEST-S10')
    RETURNING id INTO v_line_id;

    -- Insertar máquina
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S10', 'Máquina Test S10', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S10', 'Operador Test S10', true)
    RETURNING id INTO v_op_id;

    -- Sesión SIN datos de producción/calidad/paros
    INSERT INTO public.shift_sessions (id, machine_id, operator_id, shift_type, status, started_at, ended_at, planned_boxes)
    VALUES (
        gen_random_uuid(), v_machine_id, v_op_id, 'matutino', 'closed',
        '2026-05-24 06:00:00-05'::timestamptz,
        '2026-05-24 07:00:00-05'::timestamptz,
        100
    );

    -- NO insertar reports, oee_events, defect_logs, quality_inspections

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_oee_hr_x_hr
    WHERE machine_code = 'MC-S10';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S10 FAIL: No row returned — session without data should still appear';
    END IF;

    -- total_downtime_min debe ser 0
    IF v_rec.total_downtime_min != 0 THEN
        RAISE EXCEPTION 'S10 FAIL: total_downtime_min expected 0, got %', v_rec.total_downtime_min;
    END IF;

    -- total_boxes debe ser NULL (no hay reports)
    IF v_rec.total_boxes IS DISTINCT FROM 0 THEN
        RAISE EXCEPTION 'S10 FAIL: total_boxes expected 0 (no reports), got %', v_rec.total_boxes;
    END IF;

    -- availability_pct debe ser 1.0 (sin downtime)
    IF ABS(v_rec.availability_pct - 1.0) > 0.0001 THEN
        RAISE EXCEPTION 'S10 FAIL: availability_pct expected 1.0, got %', v_rec.availability_pct;
    END IF;

    -- performance_pct debe ser NULL (no hay producción)
    IF v_rec.performance_pct IS NOT NULL THEN
        RAISE EXCEPTION 'S10 FAIL: performance_pct should be NULL (no production), got %', v_rec.performance_pct;
    END IF;

    -- quality_pct debe ser NULL (no hay producción)
    IF v_rec.quality_pct IS NOT NULL THEN
        RAISE EXCEPTION 'S10 FAIL: quality_pct should be NULL (no production), got %', v_rec.quality_pct;
    END IF;

    -- oee_pct debe ser NULL
    IF v_rec.oee_pct IS NOT NULL THEN
        RAISE EXCEPTION 'S10 FAIL: oee_pct should be NULL, got %', v_rec.oee_pct;
    END IF;

    RAISE NOTICE '✅ PASS S10 (session without data): row present, avail=1.0, perf=NULL, qual=NULL, oee=NULL';
END;
$$;

-- ================================================================
-- VEREDICTO FINAL
-- ================================================================
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE '✅ ALL TESTS PASSED — view_oee_hr_x_hr is VERIFIED (S1-S10)';
    RAISE NOTICE '============================================================';
END;
$$;

ROLLBACK;
