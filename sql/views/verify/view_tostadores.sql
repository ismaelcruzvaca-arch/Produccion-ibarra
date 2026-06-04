-- Verify: view_tostadores — Tostadores (F-PD-16)
--
-- Prueba la VIEW contra 7 escenarios (S1-S7) definidos en las especificaciones.
-- Cada test se ejecuta en un DO $$ block independiente dentro de una transacción
-- que se revierte al final. No hay efectos secundarios en la base de datos.
--
-- Escenarios:
--   S1 — Normal: hora + operador + IoT telemetry → todas las columnas pobladas
--   S2 — Sin datos: 0 filas
--   S3 — IoT temperature overrides NULL manual: temp_superior=NULL en hourly,
--        IoT a 115.5°C en misma hora → temp_superior=115.5, data_source='hybrid'
--   S4 — Sin IoT: hourly con valores manuales, sin telemetría → manual values
--   S5 — Dos tostadores mismo turno: 2 hourly rows, 2 máquinas, 1 con paro → 2 filas
--   S6 — data_source manual/iot/hybrid: 3 hourly rows, 3 fuentes distintas
--   S7 — Shift totals: hourly + shift_totals → totales aparecen en cada fila horaria
--
-- Uso:
--   psql -d <db> -f sql/views/verify/view_tostadores.sql
--
-- Diseño:
--   Se usa BEGIN/ROLLBACK para aislar los datos de prueba.
--   Cada test INSERTA datos, consulta la VIEW y hace ASSERT con RAISE EXCEPTION.
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
    SELECT COUNT(*) INTO v_count FROM public.view_tostadores;

    ASSERT v_count = 0, 'S2 FAIL: Expected 0 rows with no data, got ' || v_count;
    RAISE NOTICE '✅ PASS S2 (empty): 0 rows returned with no data';
END;
$$;

-- ================================================================
-- TEST S1: Normal hour + operator + IoT telemetry
--   Una lectura horaria con todos los parámetros y datos IoT.
--   Verifica:
--     - Todas las columnas NO son NULL
--     - temp_superior, temp_media, temp_inferior, rpm, presion_vapor vienen de IoT
--     - data_source refleja 'hybrid' (hourly manual + IoT)
--     - fecha y hora local correctos en CDMX
-- ================================================================
DO $$
DECLARE
    v_machine_id    UUID;
    v_op_id         VARCHAR(50);
    v_hourly_id     UUID;
    v_rec           RECORD;
BEGIN
    -- Insertar máquina (necesitamos una línea primero)
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'TST-S1', 'Tostador Test S1',
            (SELECT id FROM public.lines LIMIT 1), true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S1', 'Operador Test S1', true)
    RETURNING id INTO v_op_id;

    -- Insertar hourly row (data_source='manual', temps=NULL para forzar IoT)
    INSERT INTO public.tostado_hourly (id, machine_id, operator_id, shift_type, hora,
                                       pesada_kg, temp_superior, temp_media, temp_inferior,
                                       rpm, presion_vapor, humedad_crudo_pct, humedad_tostado_pct,
                                       tiempo_muerto_min, causa_paro, data_source)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'matutino',
            '2026-05-24 08:00:00-05'::timestamptz,
            500.00, NULL, NULL, NULL,   -- temps NULL para forzar IoT
            NULL, NULL,                  -- rpm, presion_vapor NULL para forzar IoT
            7.2, 1.1,                    -- humedad crudo y tostado
            0, NULL, 'manual')
    RETURNING id INTO v_hourly_id;

    -- Insertar telemetría IoT (en la misma ventana horaria)
    INSERT INTO public.telemetry_raw_staging (id, machine_id, payload, source, received_at)
    VALUES (
        gen_random_uuid(), v_machine_id,
        '{"temp_superior": 115.5, "temp_media": 112.0, "temp_inferior": 108.3, "rpm": 2.5, "presion_vapor": 7.2}'::jsonb,
        'iot',
        '2026-05-24 08:15:00-05'::timestamptz
    );

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_tostadores
    WHERE machine_code = 'TST-S1';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S1 FAIL: No row returned for machine_code TST-S1';
    END IF;

    -- Verificar dimensiones
    IF v_rec.shift_type != 'matutino' THEN
        RAISE EXCEPTION 'S1 FAIL: shift_type expected matutino, got %', v_rec.shift_type;
    END IF;

    IF v_rec.pesada_kg != 500.00 THEN
        RAISE EXCEPTION 'S1 FAIL: pesada_kg expected 500.00, got %', v_rec.pesada_kg;
    END IF;

    IF v_rec.operator_name != 'Operador Test S1' THEN
        RAISE EXCEPTION 'S1 FAIL: operator_name expected Operador Test S1, got %', v_rec.operator_name;
    END IF;

    -- Verificar IoT override (hourly tiene NULL, IoT tiene valores)
    IF v_rec.temp_superior IS DISTINCT FROM 115.5 THEN
        RAISE EXCEPTION 'S1 FAIL: temp_superior expected 115.5 (IoT), got %', v_rec.temp_superior;
    END IF;

    IF v_rec.temp_media IS DISTINCT FROM 112.0 THEN
        RAISE EXCEPTION 'S1 FAIL: temp_media expected 112.0 (IoT), got %', v_rec.temp_media;
    END IF;

    IF v_rec.temp_inferior IS DISTINCT FROM 108.3 THEN
        RAISE EXCEPTION 'S1 FAIL: temp_inferior expected 108.3 (IoT), got %', v_rec.temp_inferior;
    END IF;

    IF v_rec.rpm IS DISTINCT FROM 2.5 THEN
        RAISE EXCEPTION 'S1 FAIL: rpm expected 2.5 (IoT), got %', v_rec.rpm;
    END IF;

    IF v_rec.presion_vapor IS DISTINCT FROM 7.2 THEN
        RAISE EXCEPTION 'S1 FAIL: presion_vapor expected 7.2 (IoT), got %', v_rec.presion_vapor;
    END IF;

    -- Verificar humedad (manual, no IoT)
    IF v_rec.humedad_crudo_pct IS DISTINCT FROM 7.2 THEN
        RAISE EXCEPTION 'S1 FAIL: humedad_crudo_pct expected 7.2, got %', v_rec.humedad_crudo_pct;
    END IF;

    IF v_rec.humedad_tostado_pct IS DISTINCT FROM 1.1 THEN
        RAISE EXCEPTION 'S1 FAIL: humedad_tostado_pct expected 1.1, got %', v_rec.humedad_tostado_pct;
    END IF;

    -- Verificar paros (tiempo_muerto = 0, causa_paro = NULL)
    IF v_rec.tiempo_muerto_min != 0 THEN
        RAISE EXCEPTION 'S1 FAIL: tiempo_muerto_min expected 0, got %', v_rec.tiempo_muerto_min;
    END IF;

    IF v_rec.causa_paro IS NOT NULL THEN
        RAISE EXCEPTION 'S1 FAIL: causa_paro expected NULL, got %', v_rec.causa_paro;
    END IF;

    -- Verificar data_source: hourly='manual' + IoT → 'hybrid'
    IF v_rec.data_source != 'hybrid' THEN
        RAISE EXCEPTION 'S1 FAIL: data_source expected hybrid, got %', v_rec.data_source;
    END IF;

    -- Verificar fecha y hora local
    IF v_rec.fecha IS DISTINCT FROM '2026-05-24'::date THEN
        RAISE EXCEPTION 'S1 FAIL: fecha expected 2026-05-24, got %', v_rec.fecha;
    END IF;

    RAISE NOTICE '✅ PASS S1 (normal): machine=%, IoT temp=115.5°C/112.0°C/108.3°C, RPM=2.5, data_source=%',
        v_rec.machine_code, v_rec.data_source;
END;
$$;

-- ================================================================
-- TEST S3: IoT temperature overrides NULL manual
--   hourly con temp_superior=NULL, IoT a 115.5°C en misma hora.
--   La VIEW debe mostrar temp_superior=115.5 (IoT) y data_source='hybrid'.
-- ================================================================
DO $$
DECLARE
    v_machine_id    UUID;
    v_op_id         VARCHAR(50);
    v_hourly_id     UUID;
    v_rec           RECORD;
BEGIN
    -- Insertar máquina
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'TST-S3', 'Tostador Test S3',
            (SELECT id FROM public.lines LIMIT 1), true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S3', 'Operador Test S3', true)
    RETURNING id INTO v_op_id;

    -- Insertar hourly con temp_superior=NULL, otras temps con valores manuales
    INSERT INTO public.tostado_hourly (id, machine_id, operator_id, shift_type, hora,
                                       pesada_kg, temp_superior, temp_media, temp_inferior,
                                       rpm, presion_vapor, humedad_crudo_pct, humedad_tostado_pct,
                                       tiempo_muerto_min, causa_paro, data_source)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'matutino',
            '2026-05-24 09:00:00-05'::timestamptz,
            450.00, NULL, 110.0, 105.0,   -- temp_superior NULL, otras manuales
            2.2, 7.5,                      -- rpm y presión manuales
            7.0, 1.2,
            0, NULL, 'manual')
    RETURNING id INTO v_hourly_id;

    -- Insertar telemetría IoT SOLO para temp_superior
    INSERT INTO public.telemetry_raw_staging (id, machine_id, payload, source, received_at)
    VALUES (
        gen_random_uuid(), v_machine_id,
        '{"temp_superior": 115.5}'::jsonb,
        'iot',
        '2026-05-24 09:30:00-05'::timestamptz
    );

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_tostadores
    WHERE machine_code = 'TST-S3';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S3 FAIL: No row returned for machine_code TST-S3';
    END IF;

    -- temp_superior debe venir de IoT (115.5)
    IF v_rec.temp_superior IS DISTINCT FROM 115.5 THEN
        RAISE EXCEPTION 'S3 FAIL: temp_superior expected 115.5 (IoT override), got %', v_rec.temp_superior;
    END IF;

    -- temp_media debe seguir siendo manual (110.0) porque IoT no tiene ese valor
    IF v_rec.temp_media IS DISTINCT FROM 110.0 THEN
        RAISE EXCEPTION 'S3 FAIL: temp_media expected 110.0 (manual), got %', v_rec.temp_media;
    END IF;

    -- temp_inferior debe seguir siendo manual (105.0)
    IF v_rec.temp_inferior IS DISTINCT FROM 105.0 THEN
        RAISE EXCEPTION 'S3 FAIL: temp_inferior expected 105.0 (manual), got %', v_rec.temp_inferior;
    END IF;

    -- rpm debe ser manual (2.2)
    IF v_rec.rpm IS DISTINCT FROM 2.2 THEN
        RAISE EXCEPTION 'S3 FAIL: rpm expected 2.2 (manual), got %', v_rec.rpm;
    END IF;

    -- data_source debe ser 'hybrid' (IoT presente + datos manuales)
    IF v_rec.data_source != 'hybrid' THEN
        RAISE EXCEPTION 'S3 FAIL: data_source expected hybrid (IoT present), got %', v_rec.data_source;
    END IF;

    RAISE NOTICE '✅ PASS S3 (IoT override): temp_superior=115.5 (IoT), temp_media=110.0 (manual), data_source=%', v_rec.data_source;
END;
$$;

-- ================================================================
-- TEST S4: Sin IoT — valores manuales del hourly
--   hourly con todos los parámetros manuales, SIN telemetry_raw_staging.
--   La VIEW debe mostrar los valores manuales del hourly.
-- ================================================================
DO $$
DECLARE
    v_machine_id    UUID;
    v_op_id         VARCHAR(50);
    v_hourly_id     UUID;
    v_rec           RECORD;
BEGIN
    -- Insertar máquina
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'TST-S4', 'Tostador Test S4',
            (SELECT id FROM public.lines LIMIT 1), true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S4', 'Operador Test S4', true)
    RETURNING id INTO v_op_id;

    -- Insertar hourly con valores manuales completos
    INSERT INTO public.tostado_hourly (id, machine_id, operator_id, shift_type, hora,
                                       pesada_kg, temp_superior, temp_media, temp_inferior,
                                       rpm, presion_vapor, humedad_crudo_pct, humedad_tostado_pct,
                                       tiempo_muerto_min, causa_paro, data_source)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'vespertino',
            '2026-05-24 14:00:00-05'::timestamptz,
            380.00, 110.0, 108.0, 105.0,
            2.0, 6.5,
            7.0, 1.0,
            15, 'FP', 'manual')
    RETURNING id INTO v_hourly_id;

    -- NO insertar telemetry_raw_staging

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_tostadores
    WHERE machine_code = 'TST-S4';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S4 FAIL: No row returned for machine_code TST-S4';
    END IF;

    -- Verificar que los valores manuales del hourly se muestran (no hay IoT)
    IF v_rec.temp_superior IS DISTINCT FROM 110.0 THEN
        RAISE EXCEPTION 'S4 FAIL: temp_superior expected 110.0 (manual), got %', v_rec.temp_superior;
    END IF;

    IF v_rec.temp_media IS DISTINCT FROM 108.0 THEN
        RAISE EXCEPTION 'S4 FAIL: temp_media expected 108.0 (manual), got %', v_rec.temp_media;
    END IF;

    IF v_rec.temp_inferior IS DISTINCT FROM 105.0 THEN
        RAISE EXCEPTION 'S4 FAIL: temp_inferior expected 105.0 (manual), got %', v_rec.temp_inferior;
    END IF;

    IF v_rec.rpm IS DISTINCT FROM 2.0 THEN
        RAISE EXCEPTION 'S4 FAIL: rpm expected 2.0 (manual), got %', v_rec.rpm;
    END IF;

    IF v_rec.presion_vapor IS DISTINCT FROM 6.5 THEN
        RAISE EXCEPTION 'S4 FAIL: presion_vapor expected 6.5 (manual), got %', v_rec.presion_vapor;
    END IF;

    IF v_rec.tiempo_muerto_min != 15 THEN
        RAISE EXCEPTION 'S4 FAIL: tiempo_muerto_min expected 15, got %', v_rec.tiempo_muerto_min;
    END IF;

    IF v_rec.causa_paro IS DISTINCT FROM 'FP' THEN
        RAISE EXCEPTION 'S4 FAIL: causa_paro expected FP, got %', v_rec.causa_paro;
    END IF;

    -- Verificar data_source = 'manual'
    IF v_rec.data_source != 'manual' THEN
        RAISE EXCEPTION 'S4 FAIL: data_source expected manual, got %', v_rec.data_source;
    END IF;

    -- Verificar shift_type
    IF v_rec.shift_type != 'vespertino' THEN
        RAISE EXCEPTION 'S4 FAIL: shift_type expected vespertino, got %', v_rec.shift_type;
    END IF;

    RAISE NOTICE '✅ PASS S4 (no IoT): manual values temp=110.0/108.0/105.0°C, RPM=2.0, paro=15min(FP), data_source=manual';
END;
$$;

-- ================================================================
-- TEST S5: Dos tostadores mismo turno — 2 hourly rows, 2 máquinas
--   Tostador-1 con paro de 15 min (causa 'FP'), Tostador-2 sin paro.
--   La VIEW debe devolver 2 filas independientes, cada una con su
--   pesada_kg, tiempo_muerto_min y causa_paro.
-- ================================================================
DO $$
DECLARE
    v_machine1_id   UUID;
    v_machine2_id   UUID;
    v_op_id         VARCHAR(50);
    v_hourly1_id    UUID;
    v_hourly2_id    UUID;
    v_row_count     INT;
    v_rec1          RECORD;
    v_rec2          RECORD;
BEGIN
    -- Insertar máquinas
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'TST-S5A', 'Tostador S5 A',
            (SELECT id FROM public.lines LIMIT 1), true)
    RETURNING id INTO v_machine1_id;

    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'TST-S5B', 'Tostador S5 B',
            (SELECT id FROM public.lines LIMIT 1), true)
    RETURNING id INTO v_machine2_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S5', 'Operador Test S5', true)
    RETURNING id INTO v_op_id;

    -- Tostador 1: con paro (15 min, causa 'FP')
    INSERT INTO public.tostado_hourly (id, machine_id, operator_id, shift_type, hora,
                                       pesada_kg, temp_superior, humedad_crudo_pct, humedad_tostado_pct,
                                       tiempo_muerto_min, causa_paro, data_source)
    VALUES (gen_random_uuid(), v_machine1_id, v_op_id, 'matutino',
            '2026-05-24 08:00:00-05'::timestamptz,
            500.00, 112.0, 7.2, 1.1,
            15, 'FP', 'manual')
    RETURNING id INTO v_hourly1_id;

    -- Tostador 2: sin paro
    INSERT INTO public.tostado_hourly (id, machine_id, operator_id, shift_type, hora,
                                       pesada_kg, temp_superior, humedad_crudo_pct, humedad_tostado_pct,
                                       tiempo_muerto_min, causa_paro, data_source)
    VALUES (gen_random_uuid(), v_machine2_id, v_op_id, 'matutino',
            '2026-05-24 08:00:00-05'::timestamptz,
            450.00, 115.0, 7.0, 1.2,
            0, NULL, 'manual')
    RETURNING id INTO v_hourly2_id;

    -- Contar filas
    SELECT COUNT(*) INTO v_row_count FROM public.view_tostadores
    WHERE machine_code IN ('TST-S5A', 'TST-S5B');

    IF v_row_count != 2 THEN
        RAISE EXCEPTION 'S5 FAIL: Expected 2 rows for 2 tostadores, got %', v_row_count;
    END IF;

    -- Verificar valores independientes
    SELECT * INTO v_rec1 FROM public.view_tostadores WHERE machine_code = 'TST-S5A';
    SELECT * INTO v_rec2 FROM public.view_tostadores WHERE machine_code = 'TST-S5B';

    IF v_rec1.machine_code IS NULL THEN
        RAISE EXCEPTION 'S5 FAIL: No row for TST-S5A';
    END IF;

    IF v_rec2.machine_code IS NULL THEN
        RAISE EXCEPTION 'S5 FAIL: No row for TST-S5B';
    END IF;

    -- Verificar Tostador 1 (con paro)
    IF v_rec1.pesada_kg != 500.00 THEN
        RAISE EXCEPTION 'S5 FAIL: TST-S5A pesada_kg expected 500.00, got %', v_rec1.pesada_kg;
    END IF;

    IF v_rec1.tiempo_muerto_min != 15 THEN
        RAISE EXCEPTION 'S5 FAIL: TST-S5A tiempo_muerto_min expected 15, got %', v_rec1.tiempo_muerto_min;
    END IF;

    IF v_rec1.causa_paro IS DISTINCT FROM 'FP' THEN
        RAISE EXCEPTION 'S5 FAIL: TST-S5A causa_paro expected FP, got %', v_rec1.causa_paro;
    END IF;

    -- Verificar Tostador 2 (sin paro)
    IF v_rec2.pesada_kg != 450.00 THEN
        RAISE EXCEPTION 'S5 FAIL: TST-S5B pesada_kg expected 450.00, got %', v_rec2.pesada_kg;
    END IF;

    IF v_rec2.tiempo_muerto_min != 0 THEN
        RAISE EXCEPTION 'S5 FAIL: TST-S5B tiempo_muerto_min expected 0, got %', v_rec2.tiempo_muerto_min;
    END IF;

    IF v_rec2.causa_paro IS NOT NULL THEN
        RAISE EXCEPTION 'S5 FAIL: TST-S5B causa_paro expected NULL, got %', v_rec2.causa_paro;
    END IF;

    RAISE NOTICE '✅ PASS S5 (multiple tostadores): 2 rows (A: pesada=%, paro=%min; B: pesada=%, paro=%min)',
        v_rec1.pesada_kg, v_rec1.tiempo_muerto_min, v_rec2.pesada_kg, v_rec2.tiempo_muerto_min;
END;
$$;

-- ================================================================
-- TEST S6: data_source manual / iot / hybrid
--   3 hourly rows con diferentes data_source y presencia de IoT.
--   Verifica que cada row muestre su data_source correctamente.
-- ================================================================
DO $$
DECLARE
    v_machine_id    UUID;
    v_op_id         VARCHAR(50);
    v_hourly_man_id UUID;
    v_hourly_iot_id UUID;
    v_hourly_hyb_id UUID;
    v_rec_man       RECORD;
    v_rec_iot       RECORD;
    v_rec_hyb       RECORD;
BEGIN
    -- Insertar máquina
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'TST-S6', 'Tostador Test S6',
            (SELECT id FROM public.lines LIMIT 1), true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S6', 'Operador Test S6', true)
    RETURNING id INTO v_op_id;

    -- Hourly manual (data_source = 'manual', sin IoT)
    INSERT INTO public.tostado_hourly (id, machine_id, operator_id, shift_type, hora,
                                       pesada_kg, temp_superior, humedad_crudo_pct, humedad_tostado_pct,
                                       tiempo_muerto_min, causa_paro, data_source)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'matutino',
            '2026-05-24 06:00:00-05'::timestamptz,
            400.00, 110.0, 7.0, 1.0,
            0, NULL, 'manual')
    RETURNING id INTO v_hourly_man_id;

    -- Hourly IoT (data_source = 'iot', sin telemetry_raw_staging para este test)
    -- En este escenario, 'iot' significa que la fuente declarada es IoT
    INSERT INTO public.tostado_hourly (id, machine_id, operator_id, shift_type, hora,
                                       pesada_kg, temp_superior, humedad_crudo_pct, humedad_tostado_pct,
                                       tiempo_muerto_min, causa_paro, data_source)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'matutino',
            '2026-05-24 07:00:00-05'::timestamptz,
            500.00, 112.0, 7.1, 1.1,
            0, NULL, 'iot')
    RETURNING id INTO v_hourly_iot_id;

    -- Hourly hybrid (data_source = 'hybrid', con telemetría IoT)
    INSERT INTO public.tostado_hourly (id, machine_id, operator_id, shift_type, hora,
                                       pesada_kg, temp_superior, humedad_crudo_pct, humedad_tostado_pct,
                                       tiempo_muerto_min, causa_paro, data_source)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'matutino',
            '2026-05-24 08:00:00-05'::timestamptz,
            600.00, NULL, 7.2, 1.2,   -- temp_superior NULL para que IoT lo llene
            0, NULL, 'hybrid')
    RETURNING id INTO v_hourly_hyb_id;

    -- Insertar telemetría IoT para la hora 08:00 (hybrid) y también para 07:00 (iot)
    INSERT INTO public.telemetry_raw_staging (id, machine_id, payload, source, received_at)
    VALUES
        (gen_random_uuid(), v_machine_id,
         '{"temp_superior": 115.0}'::jsonb,
         'iot',
         '2026-05-24 07:30:00-05'::timestamptz),
        (gen_random_uuid(), v_machine_id,
         '{"temp_superior": 118.0}'::jsonb,
         'iot',
         '2026-05-24 08:30:00-05'::timestamptz);

    -- NO hay telemetría para la hora 06:00 (manual)

    -- Consultar VIEW
    SELECT * INTO v_rec_man FROM public.view_tostadores
    WHERE machine_code = 'TST-S6' AND hora = '06:00:00'::time;

    SELECT * INTO v_rec_iot FROM public.view_tostadores
    WHERE machine_code = 'TST-S6' AND hora = '07:00:00'::time;

    SELECT * INTO v_rec_hyb FROM public.view_tostadores
    WHERE machine_code = 'TST-S6' AND hora = '08:00:00'::time;

    -- Verificar clasificaciones
    IF v_rec_man.data_source != 'manual' THEN
        RAISE EXCEPTION 'S6 FAIL: hour 06:00 expected manual, got %', v_rec_man.data_source;
    END IF;

    IF v_rec_iot.data_source != 'iot' THEN
        RAISE EXCEPTION 'S6 FAIL: hour 07:00 expected iot, got %', v_rec_iot.data_source;
    END IF;

    -- Hybrid: hourly.data_source = 'hybrid' AND IoT exists → stays 'hybrid'
    IF v_rec_hyb.data_source != 'hybrid' THEN
        RAISE EXCEPTION 'S6 FAIL: hour 08:00 expected hybrid, got %', v_rec_hyb.data_source;
    END IF;

    -- Verificar pesada_kg correctos
    IF v_rec_man.pesada_kg != 400.00 THEN
        RAISE EXCEPTION 'S6 FAIL: hour 06:00 pesada_kg expected 400.00, got %', v_rec_man.pesada_kg;
    END IF;

    IF v_rec_iot.pesada_kg != 500.00 THEN
        RAISE EXCEPTION 'S6 FAIL: hour 07:00 pesada_kg expected 500.00, got %', v_rec_iot.pesada_kg;
    END IF;

    IF v_rec_hyb.pesada_kg != 600.00 THEN
        RAISE EXCEPTION 'S6 FAIL: hour 08:00 pesada_kg expected 600.00, got %', v_rec_hyb.pesada_kg;
    END IF;

    -- Verificar IoT override en hybrid: temp_superior debe ser 118.0 (IoT)
    IF v_rec_hyb.temp_superior IS DISTINCT FROM 118.0 THEN
        RAISE EXCEPTION 'S6 FAIL: hybrid temp_superior expected 118.0 (IoT), got %', v_rec_hyb.temp_superior;
    END IF;

    RAISE NOTICE '✅ PASS S6 (data_source): 06:00→%, 07:00→%, 08:00→%',
        v_rec_man.data_source, v_rec_iot.data_source, v_rec_hyb.data_source;
END;
$$;

-- ================================================================
-- TEST S7: Shift totals aparecen con hourly data
--   Hourly row + shift_totals para el mismo machine/shift/fecha.
--   Verifica que los totales del turno se muestren en cada fila horaria.
-- ================================================================
DO $$
DECLARE
    v_machine_id    UUID;
    v_op_id         VARCHAR(50);
    v_hourly1_id    UUID;
    v_hourly2_id    UUID;
    v_rec1          RECORD;
    v_rec2          RECORD;
    v_row_count     INT;
BEGIN
    -- Insertar máquina
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'TST-S7', 'Tostador Test S7',
            (SELECT id FROM public.lines LIMIT 1), true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S7', 'Operador Test S7', true)
    RETURNING id INTO v_op_id;

    -- Insertar 2 hourly rows para el mismo turno (diferentes horas)
    INSERT INTO public.tostado_hourly (id, machine_id, operator_id, shift_type, hora,
                                       pesada_kg, temp_superior, humedad_crudo_pct, humedad_tostado_pct,
                                       tiempo_muerto_min, causa_paro, data_source)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'matutino',
            '2026-05-24 06:00:00-05'::timestamptz,
            500.00, 110.0, 7.0, 1.0,
            0, NULL, 'manual')
    RETURNING id INTO v_hourly1_id;

    INSERT INTO public.tostado_hourly (id, machine_id, operator_id, shift_type, hora,
                                       pesada_kg, temp_superior, humedad_crudo_pct, humedad_tostado_pct,
                                       tiempo_muerto_min, causa_paro, data_source)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'matutino',
            '2026-05-24 07:00:00-05'::timestamptz,
            550.00, 112.0, 7.1, 1.1,
            10, 'FT', 'manual')
    RETURNING id INTO v_hourly2_id;

    -- Insertar shift_totals para el mismo machine/shift/fecha
    INSERT INTO public.tostado_shift_totals (id, machine_id, shift_type, operator_id, fecha,
                                             total_kg_tostados, cascarilla_kg, polvillo_kg, granilla_kg,
                                             pct_cascarilla_en_granilla, pct_granilla_en_cascarilla,
                                             silo_origen, horas_trabajadas,
                                             extractores_funcionando, extractores_totales)
    VALUES (gen_random_uuid(), v_machine_id, 'matutino', v_op_id, '2026-05-24'::date,
            1050.00, 150.00, 75.00, 25.00,
            2.5, 1.8,
            'SILO-01', 7.5,
            6, 8);

    -- Contar filas (deben ser 2 para este machine)
    SELECT COUNT(*) INTO v_row_count FROM public.view_tostadores
    WHERE machine_code = 'TST-S7';

    IF v_row_count != 2 THEN
        RAISE EXCEPTION 'S7 FAIL: Expected 2 hourly rows for TST-S7, got %', v_row_count;
    END IF;

    -- Verificar ambas filas
    SELECT * INTO v_rec1 FROM public.view_tostadores
    WHERE machine_code = 'TST-S7' AND hora = '06:00:00'::time;

    SELECT * INTO v_rec2 FROM public.view_tostadores
    WHERE machine_code = 'TST-S7' AND hora = '07:00:00'::time;

    IF v_rec1.machine_code IS NULL THEN
        RAISE EXCEPTION 'S7 FAIL: No row for 06:00';
    END IF;

    IF v_rec2.machine_code IS NULL THEN
        RAISE EXCEPTION 'S7 FAIL: No row for 07:00';
    END IF;

    -- Verificar totales del turno en fila 1
    IF v_rec1.total_kg_tostados != 1050.00 THEN
        RAISE EXCEPTION 'S7 FAIL: hourly 06:00 total_kg_tostados expected 1050.00, got %', v_rec1.total_kg_tostados;
    END IF;

    IF v_rec1.cascarilla_kg != 150.00 THEN
        RAISE EXCEPTION 'S7 FAIL: hourly 06:00 cascarilla_kg expected 150.00, got %', v_rec1.cascarilla_kg;
    END IF;

    IF v_rec1.polvillo_kg != 75.00 THEN
        RAISE EXCEPTION 'S7 FAIL: hourly 06:00 polvillo_kg expected 75.00, got %', v_rec1.polvillo_kg;
    END IF;

    IF v_rec1.granilla_kg != 25.00 THEN
        RAISE EXCEPTION 'S7 FAIL: hourly 06:00 granilla_kg expected 25.00, got %', v_rec1.granilla_kg;
    END IF;

    IF v_rec1.pct_cascarilla_en_granilla IS DISTINCT FROM 2.5 THEN
        RAISE EXCEPTION 'S7 FAIL: pct_cascarilla_en_granilla expected 2.5, got %', v_rec1.pct_cascarilla_en_granilla;
    END IF;

    IF v_rec1.pct_granilla_en_cascarilla IS DISTINCT FROM 1.8 THEN
        RAISE EXCEPTION 'S7 FAIL: pct_granilla_en_cascarilla expected 1.8, got %', v_rec1.pct_granilla_en_cascarilla;
    END IF;

    IF v_rec1.silo_origen IS DISTINCT FROM 'SILO-01' THEN
        RAISE EXCEPTION 'S7 FAIL: silo_origen expected SILO-01, got %', v_rec1.silo_origen;
    END IF;

    IF v_rec1.horas_trabajadas IS DISTINCT FROM 7.5 THEN
        RAISE EXCEPTION 'S7 FAIL: horas_trabajadas expected 7.5, got %', v_rec1.horas_trabajadas;
    END IF;

    IF v_rec1.extractores_funcionando != 6 THEN
        RAISE EXCEPTION 'S7 FAIL: extractores_funcionando expected 6, got %', v_rec1.extractores_funcionando;
    END IF;

    IF v_rec1.extractores_totales != 8 THEN
        RAISE EXCEPTION 'S7 FAIL: extractores_totales expected 8, got %', v_rec1.extractores_totales;
    END IF;

    -- Verificar totales del turno también en fila 2
    IF v_rec2.total_kg_tostados != 1050.00 THEN
        RAISE EXCEPTION 'S7 FAIL: hourly 07:00 total_kg_tostados expected 1050.00, got %', v_rec2.total_kg_tostados;
    END IF;

    -- Verificar que hourly data también se muestra correctamente en cada fila
    IF v_rec1.pesada_kg != 500.00 THEN
        RAISE EXCEPTION 'S7 FAIL: hourly 06:00 pesada_kg expected 500.00, got %', v_rec1.pesada_kg;
    END IF;

    IF v_rec2.pesada_kg != 550.00 THEN
        RAISE EXCEPTION 'S7 FAIL: hourly 07:00 pesada_kg expected 550.00, got %', v_rec2.pesada_kg;
    END IF;

    IF v_rec2.tiempo_muerto_min != 10 THEN
        RAISE EXCEPTION 'S7 FAIL: hourly 07:00 tiempo_muerto_min expected 10, got %', v_rec2.tiempo_muerto_min;
    END IF;

    IF v_rec2.causa_paro IS DISTINCT FROM 'FT' THEN
        RAISE EXCEPTION 'S7 FAIL: hourly 07:00 causa_paro expected FT, got %', v_rec2.causa_paro;
    END IF;

    RAISE NOTICE '✅ PASS S7 (shift totals): 2 hourly rows, total_kg=1050, cascarilla=150, polvillo=75, granilla=25, silo=SILO-01';
END;
$$;

-- ================================================================
-- VEREDICTO FINAL
-- ================================================================
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE '✅ ALL TESTS PASSED — view_tostadores is VERIFIED (S1-S7)';
    RAISE NOTICE '============================================================';
END;
$$;

ROLLBACK;
