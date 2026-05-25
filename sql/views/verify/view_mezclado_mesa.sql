-- Verify: view_mezclado_mesa — Mezclado Mesa (F-PD-17)
--
-- Prueba la VIEW contra 7 escenarios (S1-S7) definidos en las especificaciones.
-- Cada test se ejecuta en un DO $$ block independiente dentro de una transacción
-- que se revierte al final. No hay efectos secundarios en la base de datos.
--
-- Escenarios:
--   S1 — Normal: batch + 7 ingredientes + IoT telemetry → todas las columnas pobladas
--   S2 — Sin datos: 0 filas
--   S3 — Batch sin ingredientes: batch existe, columnas ingredientes = NULL
--   S4 — Batch sin IoT: batch con valores manuales, sin telemetría → manual values
--   S5 — Múltiples máquinas mismo turno: 2 batches, 2 máquinas → 2 filas
--   S6 — data_source manual/iot/hybrid: 3 batches, 3 fuentes distintas
--   S7 — Shift totals: batch + shift_totals → totales aparecen en la fila
--
-- Uso:
--   psql -d <db> -f sql/views/verify/view_mezclado_mesa.sql
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
    SELECT COUNT(*) INTO v_count FROM public.view_mezclado_mesa;

    ASSERT v_count = 0, 'S2 FAIL: Expected 0 rows with no data, got ' || v_count;
    RAISE NOTICE '✅ PASS S2 (empty): 0 rows returned with no data';
END;
$$;

-- ================================================================
-- TEST S1: Normal batch + all 7 ingredients + IoT telemetry
--   Batch con todos los ingredientes y datos IoT.
--   Verifica:
--     - Las 7 columnas de ingredientes NO son NULL
--     - viscosidad_cps, temp_descarga, temp_deposito vienen de IoT
--     - lot_number refleja el ingrediente de mayor prioridad (licor > azúcar > ...)
--     - data_source refleja el valor del batch
-- ================================================================
DO $$
DECLARE
    v_line_id       UUID;
    v_machine_id    UUID;
    v_op_id         VARCHAR(50);
    v_batch_id      UUID;
    v_rec           RECORD;
BEGIN
    -- Insertar línea
    INSERT INTO public.lines (id, name, is_active)
    VALUES (gen_random_uuid(), 'L-TEST-S1', true)
    RETURNING id INTO v_line_id;

    -- Insertar máquina
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S1', 'Mezcladora Test S1', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S1', 'Operador Test S1', true)
    RETURNING id INTO v_op_id;

    -- Insertar batch (data_source='hybrid' porque tendremos IoT + manual)
    INSERT INTO public.mezclado_batches (id, machine_id, operator_id, shift_type, batch_number, mezcladora_id,
                                         total_kg, viscosidad_cps, temp_descarga, temp_deposito,
                                         tiempo_mezclado_min, status, data_source, hora_entrada)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'matutino', 1, 1,
            1500.000, NULL, NULL, NULL,   -- valores manuales NULL para forzar IoT
            45, 'completed', 'hybrid', '2026-05-24 06:30:00-05'::timestamptz)
    RETURNING id INTO v_batch_id;

    -- Insertar 7 ingredientes (con lot_numbers para probar prioridad)
    INSERT INTO public.mezclado_ingredients (id, batch_id, ingredient_type, kg, lot_number)
    VALUES
        (gen_random_uuid(), v_batch_id, 'licor',         400.000, 'L-2024-001'),
        (gen_random_uuid(), v_batch_id, 'azucar',        500.000, 'A-2024-001'),
        (gen_random_uuid(), v_batch_id, 'cocoa',          80.000, 'C-2024-001'),
        (gen_random_uuid(), v_batch_id, 'grasa_vegetal', 120.000, 'G-2024-001'),
        (gen_random_uuid(), v_batch_id, 'formula',       300.000, 'F-2024-001'),
        (gen_random_uuid(), v_batch_id, 'lecitina',       10.000, 'LEC-2024-001'),
        (gen_random_uuid(), v_batch_id, 'reproceso',      90.000, 'RP-2024-001');

    -- Insertar telemetría IoT (en la misma ventana horaria que hora_entrada)
    INSERT INTO public.telemetry_raw_staging (id, machine_id, payload, source, received_at)
    VALUES (
        gen_random_uuid(), v_machine_id,
        '{"viscosidad_cps": 54321, "temp_descarga": 82.5, "temp_deposito": 55.3}'::jsonb,
        'iot',
        '2026-05-24 06:45:00-05'::timestamptz
    );

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_mezclado_mesa
    WHERE machine_code = 'MC-S1';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S1 FAIL: No row returned for machine_code MC-S1';
    END IF;

    -- Verificar dimensiones
    IF v_rec.shift_type != 'matutino' THEN
        RAISE EXCEPTION 'S1 FAIL: shift_type expected matutino, got %', v_rec.shift_type;
    END IF;

    IF v_rec.batch_number != 1 THEN
        RAISE EXCEPTION 'S1 FAIL: batch_number expected 1, got %', v_rec.batch_number;
    END IF;

    IF v_rec.mezcladora_id != 1 THEN
        RAISE EXCEPTION 'S1 FAIL: mezcladora_id expected 1, got %', v_rec.mezcladora_id;
    END IF;

    IF v_rec.total_kg != 1500.000 THEN
        RAISE EXCEPTION 'S1 FAIL: total_kg expected 1500.000, got %', v_rec.total_kg;
    END IF;

    IF v_rec.operator_name != 'Operador Test S1' THEN
        RAISE EXCEPTION 'S1 FAIL: operator_name expected Operador Test S1, got %', v_rec.operator_name;
    END IF;

    -- Verificar que los 7 ingredientes NO son NULL
    IF v_rec.azucar_kg IS NULL THEN
        RAISE EXCEPTION 'S1 FAIL: azucar_kg is NULL, expected 500.000';
    END IF;
    IF v_rec.licor_kg IS NULL THEN
        RAISE EXCEPTION 'S1 FAIL: licor_kg is NULL, expected 400.000';
    END IF;
    IF v_rec.cocoa_kg IS NULL THEN
        RAISE EXCEPTION 'S1 FAIL: cocoa_kg is NULL, expected 80.000';
    END IF;
    IF v_rec.grasa_kg IS NULL THEN
        RAISE EXCEPTION 'S1 FAIL: grasa_kg is NULL, expected 120.000';
    END IF;
    IF v_rec.formula_kg IS NULL THEN
        RAISE EXCEPTION 'S1 FAIL: formula_kg is NULL, expected 300.000';
    END IF;
    IF v_rec.lecitina_kg IS NULL THEN
        RAISE EXCEPTION 'S1 FAIL: lecitina_kg is NULL, expected 10.000';
    END IF;
    IF v_rec.reproceso_kg IS NULL THEN
        RAISE EXCEPTION 'S1 FAIL: reproceso_kg is NULL, expected 90.000';
    END IF;

    -- Verificar valores de ingredientes
    IF v_rec.licor_kg != 400.000 THEN
        RAISE EXCEPTION 'S1 FAIL: licor_kg expected 400.000, got %', v_rec.licor_kg;
    END IF;

    IF v_rec.azucar_kg != 500.000 THEN
        RAISE EXCEPTION 'S1 FAIL: azucar_kg expected 500.000, got %', v_rec.azucar_kg;
    END IF;

    -- Verificar IoT override (batch tiene NULL, IoT tiene valores)
    IF v_rec.temp_descarga IS DISTINCT FROM 82.5 THEN
        RAISE EXCEPTION 'S1 FAIL: temp_descarga expected 82.5 (IoT), got %', v_rec.temp_descarga;
    END IF;

    IF v_rec.viscosidad_cps IS DISTINCT FROM 54321 THEN
        RAISE EXCEPTION 'S1 FAIL: viscosidad_cps expected 54321 (IoT), got %', v_rec.viscosidad_cps;
    END IF;

    IF v_rec.temp_deposito IS DISTINCT FROM 55.3 THEN
        RAISE EXCEPTION 'S1 FAIL: temp_deposito expected 55.3 (IoT), got %', v_rec.temp_deposito;
    END IF;

    -- Verificar lot_number: debe ser del licor (mayor prioridad)
    IF v_rec.lot_number IS DISTINCT FROM 'L-2024-001' THEN
        RAISE EXCEPTION 'S1 FAIL: lot_number expected L-2024-001 (licor priority), got %', v_rec.lot_number;
    END IF;

    -- Verificar data_source
    IF v_rec.data_source != 'hybrid' THEN
        RAISE EXCEPTION 'S1 FAIL: data_source expected hybrid, got %', v_rec.data_source;
    END IF;

    -- Verificar fecha
    IF v_rec.fecha IS DISTINCT FROM '2026-05-24'::date THEN
        RAISE EXCEPTION 'S1 FAIL: fecha expected 2026-05-24, got %', v_rec.fecha;
    END IF;

    RAISE NOTICE '✅ PASS S1 (normal): batch=1, 7 ingredients, IoT=82.5°C/54321cps, lot=%', v_rec.lot_number;
END;
$$;

-- ================================================================
-- TEST S3: Batch sin ingredientes — kg=NULL
--   Un batch existe pero NO tiene registros en mezclado_ingredients.
--   Todas las columnas de ingredientes DEBEN ser NULL.
--   El batch debe seguir apareciendo (LEFT JOIN).
-- ================================================================
DO $$
DECLARE
    v_line_id       UUID;
    v_machine_id    UUID;
    v_op_id         VARCHAR(50);
    v_batch_id      UUID;
    v_rec           RECORD;
BEGIN
    -- Insertar línea
    INSERT INTO public.lines (id, name, is_active)
    VALUES (gen_random_uuid(), 'L-TEST-S3', true)
    RETURNING id INTO v_line_id;

    -- Insertar máquina
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S3', 'Mezcladora Test S3', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S3', 'Operador Test S3', true)
    RETURNING id INTO v_op_id;

    -- Insertar batch (SIN ingredientes)
    INSERT INTO public.mezclado_batches (id, machine_id, operator_id, shift_type, batch_number, mezcladora_id,
                                         total_kg, status, data_source, hora_entrada)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'matutino', 1, 2,
            800.000, 'completed', 'manual', '2026-05-24 08:00:00-05'::timestamptz)
    RETURNING id INTO v_batch_id;

    -- NO insertar ingredientes

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_mezclado_mesa
    WHERE machine_code = 'MC-S3';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S3 FAIL: No row returned for machine_code MC-S3';
    END IF;

    -- Verificar que el batch aparece con datos correctos
    IF v_rec.total_kg != 800.000 THEN
        RAISE EXCEPTION 'S3 FAIL: total_kg expected 800.000, got %', v_rec.total_kg;
    END IF;

    IF v_rec.mezcladora_id != 2 THEN
        RAISE EXCEPTION 'S3 FAIL: mezcladora_id expected 2, got %', v_rec.mezcladora_id;
    END IF;

    -- Verificar que TODOS los ingredientes son NULL (LEFT JOIN sin match)
    IF v_rec.azucar_kg IS NOT NULL THEN
        RAISE EXCEPTION 'S3 FAIL: azucar_kg should be NULL (no ingredients), got %', v_rec.azucar_kg;
    END IF;
    IF v_rec.licor_kg IS NOT NULL THEN
        RAISE EXCEPTION 'S3 FAIL: licor_kg should be NULL (no ingredients), got %', v_rec.licor_kg;
    END IF;
    IF v_rec.cocoa_kg IS NOT NULL THEN
        RAISE EXCEPTION 'S3 FAIL: cocoa_kg should be NULL (no ingredients), got %', v_rec.cocoa_kg;
    END IF;
    IF v_rec.grasa_kg IS NOT NULL THEN
        RAISE EXCEPTION 'S3 FAIL: grasa_kg should be NULL (no ingredients), got %', v_rec.grasa_kg;
    END IF;
    IF v_rec.formula_kg IS NOT NULL THEN
        RAISE EXCEPTION 'S3 FAIL: formula_kg should be NULL (no ingredients), got %', v_rec.formula_kg;
    END IF;
    IF v_rec.lecitina_kg IS NOT NULL THEN
        RAISE EXCEPTION 'S3 FAIL: lecitina_kg should be NULL (no ingredients), got %', v_rec.lecitina_kg;
    END IF;
    IF v_rec.reproceso_kg IS NOT NULL THEN
        RAISE EXCEPTION 'S3 FAIL: reproceso_kg should be NULL (no ingredients), got %', v_rec.reproceso_kg;
    END IF;

    -- lot_number también debe ser NULL
    IF v_rec.lot_number IS NOT NULL THEN
        RAISE EXCEPTION 'S3 FAIL: lot_number should be NULL (no ingredients), got %', v_rec.lot_number;
    END IF;

    RAISE NOTICE '✅ PASS S3 (no ingredients): total_kg=800, all ingredient columns=NULL';
END;
$$;

-- ================================================================
-- TEST S4: Batch sin IoT — valores manuales del batch
--   Batch con viscosidad_cps=60000, temp_descarga=75.0, temp_deposito=52.0
--   SIN telemetry_raw_staging.
--   La VIEW debe mostrar los valores manuales del batch.
-- ================================================================
DO $$
DECLARE
    v_line_id       UUID;
    v_machine_id    UUID;
    v_op_id         VARCHAR(50);
    v_batch_id      UUID;
    v_rec           RECORD;
BEGIN
    -- Insertar línea
    INSERT INTO public.lines (id, name, is_active)
    VALUES (gen_random_uuid(), 'L-TEST-S4', true)
    RETURNING id INTO v_line_id;

    -- Insertar máquina
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S4', 'Mezcladora Test S4', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S4', 'Operador Test S4', true)
    RETURNING id INTO v_op_id;

    -- Insertar batch con valores manuales de temperatura/viscosidad
    INSERT INTO public.mezclado_batches (id, machine_id, operator_id, shift_type, batch_number, mezcladora_id,
                                         total_kg, viscosidad_cps, temp_descarga, temp_deposito,
                                         tiempo_mezclado_min, status, data_source, hora_entrada)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'vespertino', 1, 1,
            1200.000, 60000, 75.0, 52.0,
            40, 'completed', 'manual', '2026-05-24 14:00:00-05'::timestamptz)
    RETURNING id INTO v_batch_id;

    -- Insertar un ingrediente para que haya datos
    INSERT INTO public.mezclado_ingredients (id, batch_id, ingredient_type, kg, lot_number)
    VALUES (gen_random_uuid(), v_batch_id, 'azucar', 1200.000, 'A-S4-001');

    -- NO insertar telemetry_raw_staging

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_mezclado_mesa
    WHERE machine_code = 'MC-S4';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S4 FAIL: No row returned for machine_code MC-S4';
    END IF;

    -- Verificar que los valores manuales del batch se muestran (no hay IoT)
    IF v_rec.viscosidad_cps IS DISTINCT FROM 60000 THEN
        RAISE EXCEPTION 'S4 FAIL: viscosidad_cps expected 60000 (manual), got %', v_rec.viscosidad_cps;
    END IF;

    IF v_rec.temp_descarga IS DISTINCT FROM 75.0 THEN
        RAISE EXCEPTION 'S4 FAIL: temp_descarga expected 75.0 (manual), got %', v_rec.temp_descarga;
    END IF;

    IF v_rec.temp_deposito IS DISTINCT FROM 52.0 THEN
        RAISE EXCEPTION 'S4 FAIL: temp_deposito expected 52.0 (manual), got %', v_rec.temp_deposito;
    END IF;

    IF v_rec.tiempo_mezclado != 40 THEN
        RAISE EXCEPTION 'S4 FAIL: tiempo_mezclado expected 40, got %', v_rec.tiempo_mezclado;
    END IF;

    -- Verificar data_source = 'manual'
    IF v_rec.data_source != 'manual' THEN
        RAISE EXCEPTION 'S4 FAIL: data_source expected manual, got %', v_rec.data_source;
    END IF;

    -- Verificar shift_type
    IF v_rec.shift_type != 'vespertino' THEN
        RAISE EXCEPTION 'S4 FAIL: shift_type expected vespertino, got %', v_rec.shift_type;
    END IF;

    RAISE NOTICE '✅ PASS S4 (no IoT): manual values viscosity=60000, temp_descarga=75.0, temp_deposito=52.0';
END;
$$;

-- ================================================================
-- TEST S5: Múltiples máquinas mismo turno — 2 batches, 2 máquinas
--   Una línea, 2 máquinas, mismo shift_type, misma fecha.
--   La VIEW debe devolver 2 filas independientes, cada una con su
--   machine_code y total_kg.
-- ================================================================
DO $$
DECLARE
    v_line_id       UUID;
    v_machine1_id   UUID;
    v_machine2_id   UUID;
    v_op_id         VARCHAR(50);
    v_batch1_id     UUID;
    v_batch2_id     UUID;
    v_row_count     INT;
    v_rec1          RECORD;
    v_rec2          RECORD;
BEGIN
    -- Insertar línea
    INSERT INTO public.lines (id, name, is_active)
    VALUES (gen_random_uuid(), 'L-TEST-S5', true)
    RETURNING id INTO v_line_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S5', 'Operador Test S5', true)
    RETURNING id INTO v_op_id;

    -- Máquina 1
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S5A', 'Mezcladora S5 A', v_line_id, true)
    RETURNING id INTO v_machine1_id;

    -- Máquina 2
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S5B', 'Mezcladora S5 B', v_line_id, true)
    RETURNING id INTO v_machine2_id;

    -- Batch 1 en máquina 1 (500 kg)
    INSERT INTO public.mezclado_batches (id, machine_id, operator_id, shift_type, batch_number, mezcladora_id,
                                         total_kg, status, data_source, hora_entrada)
    VALUES (gen_random_uuid(), v_machine1_id, v_op_id, 'matutino', 1, 1,
            500.000, 'completed', 'manual', '2026-05-24 06:00:00-05'::timestamptz)
    RETURNING id INTO v_batch1_id;

    -- Batch 2 en máquina 2 (750 kg)
    INSERT INTO public.mezclado_batches (id, machine_id, operator_id, shift_type, batch_number, mezcladora_id,
                                         total_kg, status, data_source, hora_entrada)
    VALUES (gen_random_uuid(), v_machine2_id, v_op_id, 'matutino', 1, 2,
            750.000, 'completed', 'manual', '2026-05-24 06:00:00-05'::timestamptz)
    RETURNING id INTO v_batch2_id;

    -- Contar filas
    SELECT COUNT(*) INTO v_row_count FROM public.view_mezclado_mesa
    WHERE machine_code IN ('MC-S5A', 'MC-S5B');

    IF v_row_count != 2 THEN
        RAISE EXCEPTION 'S5 FAIL: Expected 2 rows for 2 machines, got %', v_row_count;
    END IF;

    -- Verificar valores independientes
    SELECT * INTO v_rec1 FROM public.view_mezclado_mesa WHERE machine_code = 'MC-S5A';
    SELECT * INTO v_rec2 FROM public.view_mezclado_mesa WHERE machine_code = 'MC-S5B';

    IF v_rec1.machine_code IS NULL THEN
        RAISE EXCEPTION 'S5 FAIL: No row for MC-S5A';
    END IF;

    IF v_rec2.machine_code IS NULL THEN
        RAISE EXCEPTION 'S5 FAIL: No row for MC-S5B';
    END IF;

    IF v_rec1.total_kg != 500.000 THEN
        RAISE EXCEPTION 'S5 FAIL: MC-S5A total_kg expected 500, got %', v_rec1.total_kg;
    END IF;

    IF v_rec2.total_kg != 750.000 THEN
        RAISE EXCEPTION 'S5 FAIL: MC-S5B total_kg expected 750, got %', v_rec2.total_kg;
    END IF;

    IF v_rec1.mezcladora_id != 1 THEN
        RAISE EXCEPTION 'S5 FAIL: MC-S5A mezcladora_id expected 1, got %', v_rec1.mezcladora_id;
    END IF;

    IF v_rec2.mezcladora_id != 2 THEN
        RAISE EXCEPTION 'S5 FAIL: MC-S5B mezcladora_id expected 2, got %', v_rec2.mezcladora_id;
    END IF;

    RAISE NOTICE '✅ PASS S5 (multiple machines): 2 rows (MC-S5A: total_kg=%, MC-S5B: total_kg=%)',
        v_rec1.total_kg, v_rec2.total_kg;
END;
$$;

-- ================================================================
-- TEST S6: data_source manual / iot / hybrid
--   3 batches con diferentes data_source.
--   Verifica que cada batch muestre su data_source correctamente.
-- ================================================================
DO $$
DECLARE
    v_line_id       UUID;
    v_machine_id    UUID;
    v_op_id         VARCHAR(50);
    v_batch_man_id  UUID;
    v_batch_iot_id  UUID;
    v_batch_hyb_id  UUID;
    v_rec_man       RECORD;
    v_rec_iot       RECORD;
    v_rec_hyb       RECORD;
BEGIN
    -- Insertar línea
    INSERT INTO public.lines (id, name, is_active)
    VALUES (gen_random_uuid(), 'L-TEST-S6', true)
    RETURNING id INTO v_line_id;

    -- Insertar máquina
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S6', 'Mezcladora Test S6', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S6', 'Operador Test S6', true)
    RETURNING id INTO v_op_id;

    -- Batch manual (data_source = 'manual')
    INSERT INTO public.mezclado_batches (id, machine_id, operator_id, shift_type, batch_number, mezcladora_id,
                                         total_kg, status, data_source, hora_entrada)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'matutino', 1, 1,
            500.000, 'completed', 'manual', '2026-05-24 06:00:00-05'::timestamptz)
    RETURNING id INTO v_batch_man_id;

    -- Batch IoT (data_source = 'iot')
    INSERT INTO public.mezclado_batches (id, machine_id, operator_id, shift_type, batch_number, mezcladora_id,
                                         total_kg, status, data_source, hora_entrada)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'matutino', 2, 1,
            600.000, 'completed', 'iot', '2026-05-24 07:00:00-05'::timestamptz)
    RETURNING id INTO v_batch_iot_id;

    -- Batch hybrid (data_source = 'hybrid')
    INSERT INTO public.mezclado_batches (id, machine_id, operator_id, shift_type, batch_number, mezcladora_id,
                                         total_kg, status, data_source, hora_entrada)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'matutino', 3, 2,
            700.000, 'completed', 'hybrid', '2026-05-24 08:00:00-05'::timestamptz)
    RETURNING id INTO v_batch_hyb_id;

    -- Insertar ingredientes para cada batch (mínimo 1 para que tengan datos)
    INSERT INTO public.mezclado_ingredients (id, batch_id, ingredient_type, kg)
    VALUES
        (gen_random_uuid(), v_batch_man_id, 'azucar', 500.000),
        (gen_random_uuid(), v_batch_iot_id, 'azucar', 600.000),
        (gen_random_uuid(), v_batch_hyb_id, 'azucar', 700.000);

    -- Consultar VIEW (3 batches en mismo día y máquina, mismo shift)
    SELECT * INTO v_rec_man FROM public.view_mezclado_mesa
    WHERE machine_code = 'MC-S6' AND batch_number = 1;

    SELECT * INTO v_rec_iot FROM public.view_mezclado_mesa
    WHERE machine_code = 'MC-S6' AND batch_number = 2;

    SELECT * INTO v_rec_hyb FROM public.view_mezclado_mesa
    WHERE machine_code = 'MC-S6' AND batch_number = 3;

    -- Verificar clasificaciones
    IF v_rec_man.data_source != 'manual' THEN
        RAISE EXCEPTION 'S6 FAIL: batch 1 expected manual, got %', v_rec_man.data_source;
    END IF;

    IF v_rec_iot.data_source != 'iot' THEN
        RAISE EXCEPTION 'S6 FAIL: batch 2 expected iot, got %', v_rec_iot.data_source;
    END IF;

    IF v_rec_hyb.data_source != 'hybrid' THEN
        RAISE EXCEPTION 'S6 FAIL: batch 3 expected hybrid, got %', v_rec_hyb.data_source;
    END IF;

    -- Verificar total_kg correctos
    IF v_rec_man.total_kg != 500.000 THEN
        RAISE EXCEPTION 'S6 FAIL: batch 1 total_kg expected 500, got %', v_rec_man.total_kg;
    END IF;

    IF v_rec_iot.total_kg != 600.000 THEN
        RAISE EXCEPTION 'S6 FAIL: batch 2 total_kg expected 600, got %', v_rec_iot.total_kg;
    END IF;

    IF v_rec_hyb.total_kg != 700.000 THEN
        RAISE EXCEPTION 'S6 FAIL: batch 3 total_kg expected 700, got %', v_rec_hyb.total_kg;
    END IF;

    RAISE NOTICE '✅ PASS S6 (data_source): manual→%, iot→%, hybrid→%',
        v_rec_man.data_source, v_rec_iot.data_source, v_rec_hyb.data_source;
END;
$$;

-- ================================================================
-- TEST S7: Shift totals aparecen con batch data
--   Batch con shift_totals para el mismo machine/shift/fecha.
--   Verifica que los totales del turno se muestren en la fila del batch.
-- ================================================================
DO $$
DECLARE
    v_line_id       UUID;
    v_machine_id    UUID;
    v_op_id         VARCHAR(50);
    v_batch_id      UUID;
    v_rec           RECORD;
BEGIN
    -- Insertar línea
    INSERT INTO public.lines (id, name, is_active)
    VALUES (gen_random_uuid(), 'L-TEST-S7', true)
    RETURNING id INTO v_line_id;

    -- Insertar máquina
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S7', 'Mezcladora Test S7', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S7', 'Operador Test S7', true)
    RETURNING id INTO v_op_id;

    -- Insertar batch
    INSERT INTO public.mezclado_batches (id, machine_id, operator_id, shift_type, batch_number, mezcladora_id,
                                         total_kg, status, data_source, hora_entrada)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'matutino', 1, 1,
            1500.000, 'completed', 'manual', '2026-05-24 06:00:00-05'::timestamptz)
    RETURNING id INTO v_batch_id;

    -- Insertar ingrediente
    INSERT INTO public.mezclado_ingredients (id, batch_id, ingredient_type, kg)
    VALUES (gen_random_uuid(), v_batch_id, 'azucar', 1500.000);

    -- Insertar shift_totals para el mismo machine/shift/fecha
    INSERT INTO public.mezclado_shift_totals (id, machine_id, shift_type, fecha,
                                              total_mezcladas, total_molidas,
                                              desperdicio_licor_kg, desperdicio_azucar_kg,
                                              barreduras_kg, reproceso_total_kg)
    VALUES (gen_random_uuid(), v_machine_id, 'matutino', '2026-05-24'::date,
            5, 3,   -- 5 mezcladas, 3 molidas
            12.500, 8.200,   -- desperdicios
            2.100, 15.000);  -- barreduras y reproceso

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_mezclado_mesa
    WHERE machine_code = 'MC-S7';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S7 FAIL: No row returned for machine_code MC-S7';
    END IF;

    -- Verificar totales del turno
    IF v_rec.total_mezcladas != 5 THEN
        RAISE EXCEPTION 'S7 FAIL: total_mezcladas expected 5, got %', v_rec.total_mezcladas;
    END IF;

    IF v_rec.total_molidas != 3 THEN
        RAISE EXCEPTION 'S7 FAIL: total_molidas expected 3, got %', v_rec.total_molidas;
    END IF;

    IF v_rec.desperdicio_licor_kg != 12.500 THEN
        RAISE EXCEPTION 'S7 FAIL: desperdicio_licor_kg expected 12.500, got %', v_rec.desperdicio_licor_kg;
    END IF;

    IF v_rec.desperdicio_azucar_kg != 8.200 THEN
        RAISE EXCEPTION 'S7 FAIL: desperdicio_azucar_kg expected 8.200, got %', v_rec.desperdicio_azucar_kg;
    END IF;

    IF v_rec.barreduras_kg != 2.100 THEN
        RAISE EXCEPTION 'S7 FAIL: barreduras_kg expected 2.100, got %', v_rec.barreduras_kg;
    END IF;

    IF v_rec.reproceso_total_kg != 15.000 THEN
        RAISE EXCEPTION 'S7 FAIL: reproceso_total_kg expected 15.000, got %', v_rec.reproceso_total_kg;
    END IF;

    -- Verificar que el batch data también se muestra correctamente
    IF v_rec.total_kg != 1500.000 THEN
        RAISE EXCEPTION 'S7 FAIL: batch total_kg expected 1500.000, got %', v_rec.total_kg;
    END IF;

    RAISE NOTICE '✅ PASS S7 (shift totals): mezcladas=5, molidas=3, desperdicio_licor=12.5, desperdicio_azucar=8.2, barreduras=2.1, reproceso=15.0';
END;
$$;

-- ================================================================
-- VEREDICTO FINAL
-- ================================================================
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE '✅ ALL TESTS PASSED — view_mezclado_mesa is VERIFIED (S1-S7)';
    RAISE NOTICE '============================================================';
END;
$$;

ROLLBACK;
