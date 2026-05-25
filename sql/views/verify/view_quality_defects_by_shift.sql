-- Verify: view_quality_defects_by_shift — Defectos de Calidad por Turno
--
-- Prueba la VIEW contra 8 escenarios (S1-S8) definidos en las especificaciones.
-- Cada test se ejecuta en un DO $$ block independiente dentro de una transacción
-- que se revierte al final. No hay efectos secundarios en la base de datos.
--
-- Escenarios:
--   S1 — Mixed AI + human: 2 inspecciones (vision_edge + OP) → inspector_type_summary='both'
--   S2 — Sin datos: 0 filas
--   S3 — División por cero: todas las disposiciones 'pending' → calidad_pct=0 (no error)
--   S4 — AI-only: data_source='vision', inspector_type='ai'
--   S5 — Human-only: data_source='manual', inspector_type='human'
--   S6 — Hybrid: 2 inspecciones mismo turno (vision + manual) → data_source='hybrid'
--   S7 — 3 severidades: critical=5, major=3, minor=2
--   S8 — Sin defectos: quality_inspection existe, 0 defect_logs → defect columns = 0
--
-- Uso:
--   psql -d <db> -f sql/views/verify/view_quality_defects_by_shift.sql
--
-- Diseño:
--   Se usa BEGIN/ROLLBACK para aislar los datos de prueba.
--   Cada test INSERTA datos, consulta la VIEW y hace ASSERT.
--   Al final, ROLLBACK revierte todo sin efectos colaterales.

\set ON_ERROR_STOP on

BEGIN;

-- ================================================================
-- TEST S2: Sin datos — 0 filas
-- ================================================================
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.view_quality_defects_by_shift;

    ASSERT v_count = 0, 'S2 FAIL: Expected 0 rows with no data, got ' || v_count;
    RAISE NOTICE '✅ PASS S2 (empty): 0 rows returned with no data';
END;
$$;

-- ================================================================
-- TEST S1: Mixed AI + human — 2 inspecciones mismo turno/máquina
--   Inspection 1: inspector_id='vision_edge_001' → inspector_type='ai',  disposition='liberado'
--   Inspection 2: inspector_id='OP001'           → inspector_type='human', disposition='rechazado'
--   Esperado:
--     total_inspections=2, total_passed=1, total_failed=1
--     inspector_type_summary='both'
--     calidad_pct=0.5
-- ================================================================
DO $$
DECLARE
    v_line_id    UUID;
    v_machine_id UUID;
    v_rec        RECORD;
BEGIN
    -- Insertar línea
    INSERT INTO public.lines (id, name, area, is_active)
    VALUES (gen_random_uuid(), 'L-TEST-S1', 'Test', true)
    RETURNING id INTO v_line_id;

    -- Insertar máquina
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S1', 'Máquina Test S1', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Inspection 1: AI (vision_edge)
    INSERT INTO public.quality_inspections (id, machine_id, inspector_id, shift_type, disposition, created_at)
    VALUES (gen_random_uuid(), v_machine_id, 'vision_edge_001', 'matutino', 'liberado', '2026-05-24 06:30:00-05'::timestamptz);

    -- Inspection 2: Human (OP)
    INSERT INTO public.quality_inspections (id, machine_id, inspector_id, shift_type, disposition, created_at)
    VALUES (gen_random_uuid(), v_machine_id, 'OP001', 'matutino', 'rechazado', '2026-05-24 07:15:00-05'::timestamptz);

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_quality_defects_by_shift
    WHERE machine_code = 'MC-S1';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S1 FAIL: No row returned for machine_code MC-S1';
    END IF;

    IF v_rec.total_inspections != 2 THEN
        RAISE EXCEPTION 'S1 FAIL: total_inspections expected 2, got %', v_rec.total_inspections;
    END IF;

    IF v_rec.total_passed != 1 THEN
        RAISE EXCEPTION 'S1 FAIL: total_passed expected 1, got %', v_rec.total_passed;
    END IF;

    IF v_rec.total_failed != 1 THEN
        RAISE EXCEPTION 'S1 FAIL: total_failed expected 1, got %', v_rec.total_failed;
    END IF;

    IF v_rec.inspector_type_summary != 'both' THEN
        RAISE EXCEPTION 'S1 FAIL: inspector_type_summary expected ''both'', got %', v_rec.inspector_type_summary;
    END IF;

    IF ABS(v_rec.calidad_pct - 0.5) > 0.0001 THEN
        RAISE EXCEPTION 'S1 FAIL: calidad_pct expected 0.5, got %', v_rec.calidad_pct;
    END IF;

    RAISE NOTICE '✅ PASS S1 (mixed AI+human): inspections=2, passed=1, failed=1, calidad=0.5, inspector_summary=%', v_rec.inspector_type_summary;
END;
$$;

-- ================================================================
-- TEST S3: División por cero — todas las disposiciones 'pending'
--   Una inspección con disposition='pending'.
--   total_passed=0, calidad_pct DEBE ser 0 (no error, no NULL)
-- ================================================================
DO $$
DECLARE
    v_line_id    UUID;
    v_machine_id UUID;
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

    -- Inspection con disposition='pending'
    INSERT INTO public.quality_inspections (id, machine_id, inspector_id, shift_type, disposition, created_at)
    VALUES (gen_random_uuid(), v_machine_id, 'OP003', 'matutino', 'pending', '2026-05-24 06:30:00-05'::timestamptz);

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_quality_defects_by_shift
    WHERE machine_code = 'MC-S3';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S3 FAIL: No row returned for machine_code MC-S3';
    END IF;

    IF v_rec.total_inspections != 1 THEN
        RAISE EXCEPTION 'S3 FAIL: total_inspections expected 1, got %', v_rec.total_inspections;
    END IF;

    IF v_rec.total_passed != 0 THEN
        RAISE EXCEPTION 'S3 FAIL: total_passed expected 0 (pending), got %', v_rec.total_passed;
    END IF;

    IF v_rec.calidad_pct IS NULL THEN
        RAISE EXCEPTION 'S3 FAIL: calidad_pct should be 0 (not NULL) when pending';
    END IF;

    IF v_rec.calidad_pct != 0 THEN
        RAISE EXCEPTION 'S3 FAIL: calidad_pct expected 0, got %', v_rec.calidad_pct;
    END IF;

    RAISE NOTICE '✅ PASS S3 (div by zero): inspections=1, passed=0, calidad_pct=0';
END;
$$;

-- ================================================================
-- TEST S4: AI-only — data_source='vision', inspector_type='ai'
--   Una inspección con data_source='vision' e inspector_id='vision_edge_002'
--   Esperado: data_source='vision', inspector_type_summary='ai'
-- ================================================================
DO $$
DECLARE
    v_line_id    UUID;
    v_machine_id UUID;
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

    -- Inspection AI con data_source='vision'
    INSERT INTO public.quality_inspections (id, machine_id, inspector_id, shift_type, disposition, data_source, created_at)
    VALUES (gen_random_uuid(), v_machine_id, 'vision_edge_002', 'matutino', 'liberado', 'vision', '2026-05-24 06:30:00-05'::timestamptz);

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_quality_defects_by_shift
    WHERE machine_code = 'MC-S4';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S4 FAIL: No row returned for machine_code MC-S4';
    END IF;

    IF v_rec.data_source != 'vision' THEN
        RAISE EXCEPTION 'S4 FAIL: data_source expected ''vision'', got %', v_rec.data_source;
    END IF;

    IF v_rec.inspector_type_summary != 'ai' THEN
        RAISE EXCEPTION 'S4 FAIL: inspector_type_summary expected ''ai'', got %', v_rec.inspector_type_summary;
    END IF;

    RAISE NOTICE '✅ PASS S4 (AI-only): data_source=%, inspector_summary=%', v_rec.data_source, v_rec.inspector_type_summary;
END;
$$;

-- ================================================================
-- TEST S5: Human-only — data_source='manual', inspector_type='human'
--   Una inspección con data_source por defecto ('manual') e inspector_id='OP005'
--   Esperado: data_source='manual', inspector_type_summary='human'
-- ================================================================
DO $$
DECLARE
    v_line_id    UUID;
    v_machine_id UUID;
    v_rec        RECORD;
BEGIN
    -- Insertar línea
    INSERT INTO public.lines (id, name)
    VALUES (gen_random_uuid(), 'L-TEST-S5')
    RETURNING id INTO v_line_id;

    -- Insertar máquina
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S5', 'Máquina Test S5', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Inspection manual (default data_source='manual')
    INSERT INTO public.quality_inspections (id, machine_id, inspector_id, shift_type, disposition, created_at)
    VALUES (gen_random_uuid(), v_machine_id, 'OP005', 'matutino', 'liberado', '2026-05-24 06:30:00-05'::timestamptz);

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_quality_defects_by_shift
    WHERE machine_code = 'MC-S5';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S5 FAIL: No row returned for machine_code MC-S5';
    END IF;

    IF v_rec.data_source != 'manual' THEN
        RAISE EXCEPTION 'S5 FAIL: data_source expected ''manual'', got %', v_rec.data_source;
    END IF;

    IF v_rec.inspector_type_summary != 'human' THEN
        RAISE EXCEPTION 'S5 FAIL: inspector_type_summary expected ''human'', got %', v_rec.inspector_type_summary;
    END IF;

    RAISE NOTICE '✅ PASS S5 (human-only): data_source=%, inspector_summary=%', v_rec.data_source, v_rec.inspector_type_summary;
END;
$$;

-- ================================================================
-- TEST S6: Hybrid — 2 inspecciones mismo turno/máquina/día
--   Inspection 1: data_source='vision',   inspector_id='vision_edge_006'
--   Inspection 2: data_source='manual',   inspector_id='OP006'
--   Esperado: data_source='hybrid', inspector_type_summary='both'
-- ================================================================
DO $$
DECLARE
    v_line_id    UUID;
    v_machine_id UUID;
    v_rec        RECORD;
BEGIN
    -- Insertar línea
    INSERT INTO public.lines (id, name)
    VALUES (gen_random_uuid(), 'L-TEST-S6')
    RETURNING id INTO v_line_id;

    -- Insertar máquina
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S6', 'Máquina Test S6', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Inspection 1: vision
    INSERT INTO public.quality_inspections (id, machine_id, inspector_id, shift_type, disposition, data_source, created_at)
    VALUES (gen_random_uuid(), v_machine_id, 'vision_edge_006', 'matutino', 'liberado', 'vision', '2026-05-24 06:30:00-05'::timestamptz);

    -- Inspection 2: manual (default)
    INSERT INTO public.quality_inspections (id, machine_id, inspector_id, shift_type, disposition, created_at)
    VALUES (gen_random_uuid(), v_machine_id, 'OP006', 'matutino', 'liberado', '2026-05-24 07:15:00-05'::timestamptz);

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_quality_defects_by_shift
    WHERE machine_code = 'MC-S6';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S6 FAIL: No row returned for machine_code MC-S6';
    END IF;

    IF v_rec.data_source != 'hybrid' THEN
        RAISE EXCEPTION 'S6 FAIL: data_source expected ''hybrid'', got %', v_rec.data_source;
    END IF;

    IF v_rec.inspector_type_summary != 'both' THEN
        RAISE EXCEPTION 'S6 FAIL: inspector_type_summary expected ''both'', got %', v_rec.inspector_type_summary;
    END IF;

    RAISE NOTICE '✅ PASS S6 (hybrid): data_source=%, inspector_summary=%', v_rec.data_source, v_rec.inspector_type_summary;
END;
$$;

-- ================================================================
-- TEST S7: 3 severidades — critical=5, major=3, minor=2
--   Una inspección con 3 defect_logs:
--     severity='critical', defect_count=5
--     severity='major',    defect_count=3
--     severity='minor',    defect_count=2
--   Esperado: critical_defects=5, major_defects=3, minor_defects=2
--   top_defect_type_1 DEBE ser el tipo con mayor defect_count
-- ================================================================
DO $$
DECLARE
    v_line_id    UUID;
    v_machine_id UUID;
    v_insp_id    UUID;
    v_rec        RECORD;
BEGIN
    -- Insertar línea
    INSERT INTO public.lines (id, name)
    VALUES (gen_random_uuid(), 'L-TEST-S7')
    RETURNING id INTO v_line_id;

    -- Insertar máquina
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S7', 'Máquina Test S7', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Insertar inspección
    INSERT INTO public.quality_inspections (id, machine_id, inspector_id, shift_type, disposition, created_at)
    VALUES (gen_random_uuid(), v_machine_id, 'OP007', 'matutino', 'liberado', '2026-05-24 06:30:00-05'::timestamptz)
    RETURNING id INTO v_insp_id;

    -- Insertar 3 defect_logs (critical=5, major=3, minor=2)
    INSERT INTO public.defect_logs (id, inspection_id, severity, defect_type, defect_count)
    VALUES
        (gen_random_uuid(), v_insp_id, 'critical', 'materia_extraña',       5),
        (gen_random_uuid(), v_insp_id, 'major',    'empaque_abierto',       3),
        (gen_random_uuid(), v_insp_id, 'minor',    'codificacion_incorrecta', 2);

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_quality_defects_by_shift
    WHERE machine_code = 'MC-S7';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S7 FAIL: No row returned for machine_code MC-S7';
    END IF;

    IF v_rec.critical_defects != 5 THEN
        RAISE EXCEPTION 'S7 FAIL: critical_defects expected 5, got %', v_rec.critical_defects;
    END IF;

    IF v_rec.major_defects != 3 THEN
        RAISE EXCEPTION 'S7 FAIL: major_defects expected 3, got %', v_rec.major_defects;
    END IF;

    IF v_rec.minor_defects != 2 THEN
        RAISE EXCEPTION 'S7 FAIL: minor_defects expected 2, got %', v_rec.minor_defects;
    END IF;

    IF v_rec.top_defect_type_1 IS DISTINCT FROM 'materia_extraña' THEN
        RAISE EXCEPTION 'S7 FAIL: top_defect_type_1 expected ''materia_extraña'', got %', v_rec.top_defect_type_1;
    END IF;

    IF v_rec.top_defect_type_2 IS DISTINCT FROM 'empaque_abierto' THEN
        RAISE EXCEPTION 'S7 FAIL: top_defect_type_2 expected ''empaque_abierto'', got %', v_rec.top_defect_type_2;
    END IF;

    IF v_rec.top_defect_type_3 IS DISTINCT FROM 'codificacion_incorrecta' THEN
        RAISE EXCEPTION 'S7 FAIL: top_defect_type_3 expected ''codificacion_incorrecta'', got %', v_rec.top_defect_type_3;
    END IF;

    RAISE NOTICE '✅ PASS S7 (3 severities): critical=5, major=3, minor=2, top1=%, top2=%, top3=%',
        v_rec.top_defect_type_1, v_rec.top_defect_type_2, v_rec.top_defect_type_3;
END;
$$;

-- ================================================================
-- TEST S8: Sin defectos — quality_inspection existe, 0 defect_logs
--   Una inspección SIN defect_logs asociados.
--   Esperado: la fila existe, critical=0, major=0, minor=0
--   top_defect_type_1/2/3 DEBEN ser NULL (no hay defectos)
-- ================================================================
DO $$
DECLARE
    v_line_id    UUID;
    v_machine_id UUID;
    v_insp_id    UUID;
    v_rec        RECORD;
BEGIN
    -- Insertar línea
    INSERT INTO public.lines (id, name)
    VALUES (gen_random_uuid(), 'L-TEST-S8')
    RETURNING id INTO v_line_id;

    -- Insertar máquina
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S8', 'Máquina Test S8', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Insertar inspección SIN defect_logs
    INSERT INTO public.quality_inspections (id, machine_id, inspector_id, shift_type, disposition, created_at)
    VALUES (gen_random_uuid(), v_machine_id, 'OP008', 'matutino', 'liberado', '2026-05-24 06:30:00-05'::timestamptz)
    RETURNING id INTO v_insp_id;

    -- NO insertar defect_logs

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_quality_defects_by_shift
    WHERE machine_code = 'MC-S8';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S8 FAIL: No row returned for machine_code MC-S8';
    END IF;

    IF v_rec.total_inspections != 1 THEN
        RAISE EXCEPTION 'S8 FAIL: total_inspections expected 1, got %', v_rec.total_inspections;
    END IF;

    IF v_rec.critical_defects != 0 THEN
        RAISE EXCEPTION 'S8 FAIL: critical_defects expected 0 (no defects), got %', v_rec.critical_defects;
    END IF;

    IF v_rec.major_defects != 0 THEN
        RAISE EXCEPTION 'S8 FAIL: major_defects expected 0 (no defects), got %', v_rec.major_defects;
    END IF;

    IF v_rec.minor_defects != 0 THEN
        RAISE EXCEPTION 'S8 FAIL: minor_defects expected 0 (no defects), got %', v_rec.minor_defects;
    END IF;

    IF v_rec.top_defect_type_1 IS NOT NULL THEN
        RAISE EXCEPTION 'S8 FAIL: top_defect_type_1 should be NULL (no defects), got %', v_rec.top_defect_type_1;
    END IF;

    IF v_rec.top_defect_type_2 IS NOT NULL THEN
        RAISE EXCEPTION 'S8 FAIL: top_defect_type_2 should be NULL (no defects), got %', v_rec.top_defect_type_2;
    END IF;

    IF v_rec.top_defect_type_3 IS NOT NULL THEN
        RAISE EXCEPTION 'S8 FAIL: top_defect_type_3 should be NULL (no defects), got %', v_rec.top_defect_type_3;
    END IF;

    RAISE NOTICE '✅ PASS S8 (no defects): inspections=1, critical=0, major=0, minor=0, top_defects=NULL';
END;
$$;

-- ================================================================
-- VEREDICTO FINAL
-- ================================================================
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE '✅ ALL TESTS PASSED — view_quality_defects_by_shift is VERIFIED (S1-S8)';
    RAISE NOTICE '============================================================';
END;
$$;

ROLLBACK;
