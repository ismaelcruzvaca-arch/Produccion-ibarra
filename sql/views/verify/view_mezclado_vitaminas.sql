-- Verify: view_mezclado_vitaminas — Mezclado de Vitaminas (F-PD-06)
--
-- Prueba la VIEW contra 7 escenarios (S1-S7) definidos en las especificaciones.
-- Cada test se ejecuta en un DO $$ block independiente dentro de una transacción
-- que se revierte al final. No hay efectos secundarios en la base de datos.
--
-- Escenarios:
--   S1 — Normal: batch + 6 micro-ingredientes + kit + doble firma → todas las columnas
--   S2 — Sin datos: 0 filas
--   S3 — Batch sin ingredientes: batch existe, columnas ingredientes = NULL
--   S4 — Batch sin kit: batch con datos, inventario NULL
--   S5 — Múltiples máquinas mismo turno: 2 batches, 2 máquinas → 2 filas
--   S6 — data_source manual/iot/hybrid: 3 batches, 3 fuentes distintas
--   S7 — Kit inventory: batch + inventario → columnas de inventario pobladas
--
-- Uso:
--   psql -d <db> -f sql/views/verify/view_mezclado_vitaminas.sql
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
    SELECT COUNT(*) INTO v_count FROM public.view_mezclado_vitaminas;

    ASSERT v_count = 0, 'S2 FAIL: Expected 0 rows with no data, got ' || v_count;
    RAISE NOTICE '✅ PASS S2 (empty): 0 rows returned with no data';
END;
$$;

-- ================================================================
-- TEST S1: Normal batch + 6 micro-ingredientes + kit + doble firma
--   Batch con todos los micro-ingredientes, kit info y doble firma.
--   Verifica:
--     - Las 6 columnas de micro-ingredientes NO son NULL
--     - kit_numero, kit_kg, semi_terminado_kg están poblados
--     - verificador_produccion y verificador_calidad están poblados
--     - lot_number refleja el ingrediente de mayor prioridad (azúcar > cocoa > ...)
--     - data_source refleja el valor del batch
--     - batch_number dentro de rango (1-20)
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
    VALUES (gen_random_uuid(), 'MC-S1', 'Vitaminas Test S1', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S1', 'Operador Test S1', true)
    RETURNING id INTO v_op_id;

    -- Insertar batch completo
    INSERT INTO public.vitaminas_batches (id, machine_id, operator_id, shift_type, batch_number,
                                          product_name, product_formula,
                                          peso_bascula, peso_fisico,
                                          kit_numero, kit_kg, semi_terminado_kg,
                                          verificador_produccion, verificador_calidad,
                                          status, data_source, created_at)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'matutino', 1,
            'Choco choco', 'R1',
            500.00, 498.50,
            'ORD-001-KIT-01', 25.00, 475.00,
            'Juan Pérez', 'María García',
            'completed', 'hybrid', '2026-05-24 06:30:00-05'::timestamptz)
    RETURNING id INTO v_batch_id;

    -- Insertar 6 micro-ingredientes
    INSERT INTO public.vitaminas_ingredients (id, batch_id, ingredient_type, kg, lot_number)
    VALUES
        (gen_random_uuid(), v_batch_id, 'azucar',        300.00, 'A-2024-001'),
        (gen_random_uuid(), v_batch_id, 'cocoa',          80.00, 'C-2024-001'),
        (gen_random_uuid(), v_batch_id, 'lecitina',       10.00, 'LEC-2024-001'),
        (gen_random_uuid(), v_batch_id, 'fecula',         40.00, 'F-2024-001'),
        (gen_random_uuid(), v_batch_id, 'maltodextrina',  30.00, 'M-2024-001'),
        (gen_random_uuid(), v_batch_id, 'reproceso',      40.00, 'RP-2024-001');

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_mezclado_vitaminas
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

    IF v_rec.product_name != 'Choco choco' THEN
        RAISE EXCEPTION 'S1 FAIL: product_name expected Choco choco, got %', v_rec.product_name;
    END IF;

    IF v_rec.product_formula != 'R1' THEN
        RAISE EXCEPTION 'S1 FAIL: product_formula expected R1, got %', v_rec.product_formula;
    END IF;

    -- Verificar pesos
    IF v_rec.peso_bascula != 500.00 THEN
        RAISE EXCEPTION 'S1 FAIL: peso_bascula expected 500.00, got %', v_rec.peso_bascula;
    END IF;

    IF v_rec.peso_fisico != 498.50 THEN
        RAISE EXCEPTION 'S1 FAIL: peso_fisico expected 498.50, got %', v_rec.peso_fisico;
    END IF;

    -- Verificar kit
    IF v_rec.kit_numero != 'ORD-001-KIT-01' THEN
        RAISE EXCEPTION 'S1 FAIL: kit_numero expected ORD-001-KIT-01, got %', v_rec.kit_numero;
    END IF;

    IF v_rec.kit_kg != 25.00 THEN
        RAISE EXCEPTION 'S1 FAIL: kit_kg expected 25.00, got %', v_rec.kit_kg;
    END IF;

    IF v_rec.semi_terminado_kg != 475.00 THEN
        RAISE EXCEPTION 'S1 FAIL: semi_terminado_kg expected 475.00, got %', v_rec.semi_terminado_kg;
    END IF;

    -- Verificar doble firma
    IF v_rec.verificador_produccion != 'Juan Pérez' THEN
        RAISE EXCEPTION 'S1 FAIL: verificador_produccion expected Juan Pérez, got %', v_rec.verificador_produccion;
    END IF;

    IF v_rec.verificador_calidad != 'María García' THEN
        RAISE EXCEPTION 'S1 FAIL: verificador_calidad expected María García, got %', v_rec.verificador_calidad;
    END IF;

    -- Verificar que los 6 ingredientes NO son NULL
    IF v_rec.azucar_kg IS NULL THEN
        RAISE EXCEPTION 'S1 FAIL: azucar_kg is NULL, expected 300.00';
    END IF;
    IF v_rec.cocoa_kg IS NULL THEN
        RAISE EXCEPTION 'S1 FAIL: cocoa_kg is NULL, expected 80.00';
    END IF;
    IF v_rec.lecitina_kg IS NULL THEN
        RAISE EXCEPTION 'S1 FAIL: lecitina_kg is NULL, expected 10.00';
    END IF;
    IF v_rec.fecula_kg IS NULL THEN
        RAISE EXCEPTION 'S1 FAIL: fecula_kg is NULL, expected 40.00';
    END IF;
    IF v_rec.maltodextrina_kg IS NULL THEN
        RAISE EXCEPTION 'S1 FAIL: maltodextrina_kg is NULL, expected 30.00';
    END IF;
    IF v_rec.reproceso_kg IS NULL THEN
        RAISE EXCEPTION 'S1 FAIL: reproceso_kg is NULL, expected 40.00';
    END IF;

    -- Verificar valores exactos
    IF v_rec.azucar_kg != 300.00 THEN
        RAISE EXCEPTION 'S1 FAIL: azucar_kg expected 300.00, got %', v_rec.azucar_kg;
    END IF;
    IF v_rec.cocoa_kg != 80.00 THEN
        RAISE EXCEPTION 'S1 FAIL: cocoa_kg expected 80.00, got %', v_rec.cocoa_kg;
    END IF;

    -- Verificar lot_number: debe ser del azúcar (mayor prioridad)
    IF v_rec.lot_number IS DISTINCT FROM 'A-2024-001' THEN
        RAISE EXCEPTION 'S1 FAIL: lot_number expected A-2024-001 (azúcar priority), got %', v_rec.lot_number;
    END IF;

    -- Verificar data_source
    IF v_rec.data_source != 'hybrid' THEN
        RAISE EXCEPTION 'S1 FAIL: data_source expected hybrid, got %', v_rec.data_source;
    END IF;

    -- Verificar fecha
    IF v_rec.fecha IS DISTINCT FROM '2026-05-24'::date THEN
        RAISE EXCEPTION 'S1 FAIL: fecha expected 2026-05-24, got %', v_rec.fecha;
    END IF;

    RAISE NOTICE '✅ PASS S1 (normal): batch=1, 6 ingredients, kit=ORD-001-KIT-01, firma=Juan/María, lot=%', v_rec.lot_number;
END;
$$;

-- ================================================================
-- TEST S3: Batch sin ingredientes — kg=NULL
--   Un batch existe pero NO tiene registros en vitaminas_ingredients.
--   Todas las columnas de micro-ingredientes DEBEN ser NULL.
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
    VALUES (gen_random_uuid(), 'MC-S3', 'Vitaminas Test S3', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S3', 'Operador Test S3', true)
    RETURNING id INTO v_op_id;

    -- Insertar batch (SIN ingredientes)
    INSERT INTO public.vitaminas_batches (id, machine_id, operator_id, shift_type, batch_number,
                                          product_name, product_formula,
                                          peso_bascula, status, data_source, created_at)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'vespertino', 5,
            'Aurrera', 'R2',
            250.00, 'completed', 'manual', '2026-05-24 14:00:00-05'::timestamptz)
    RETURNING id INTO v_batch_id;

    -- NO insertar ingredientes

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_mezclado_vitaminas
    WHERE machine_code = 'MC-S3';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S3 FAIL: No row returned for machine_code MC-S3';
    END IF;

    -- Verificar que el batch aparece con datos correctos
    IF v_rec.peso_bascula != 250.00 THEN
        RAISE EXCEPTION 'S3 FAIL: peso_bascula expected 250.00, got %', v_rec.peso_bascula;
    END IF;

    IF v_rec.batch_number != 5 THEN
        RAISE EXCEPTION 'S3 FAIL: batch_number expected 5, got %', v_rec.batch_number;
    END IF;

    IF v_rec.product_name != 'Aurrera' THEN
        RAISE EXCEPTION 'S3 FAIL: product_name expected Aurrera, got %', v_rec.product_name;
    END IF;

    -- Verificar que TODOS los ingredientes son NULL (LEFT JOIN sin match)
    IF v_rec.azucar_kg IS NOT NULL THEN
        RAISE EXCEPTION 'S3 FAIL: azucar_kg should be NULL (no ingredients), got %', v_rec.azucar_kg;
    END IF;
    IF v_rec.cocoa_kg IS NOT NULL THEN
        RAISE EXCEPTION 'S3 FAIL: cocoa_kg should be NULL (no ingredients), got %', v_rec.cocoa_kg;
    END IF;
    IF v_rec.lecitina_kg IS NOT NULL THEN
        RAISE EXCEPTION 'S3 FAIL: lecitina_kg should be NULL (no ingredients), got %', v_rec.lecitina_kg;
    END IF;
    IF v_rec.fecula_kg IS NOT NULL THEN
        RAISE EXCEPTION 'S3 FAIL: fecula_kg should be NULL (no ingredients), got %', v_rec.fecula_kg;
    END IF;
    IF v_rec.maltodextrina_kg IS NOT NULL THEN
        RAISE EXCEPTION 'S3 FAIL: maltodextrina_kg should be NULL (no ingredients), got %', v_rec.maltodextrina_kg;
    END IF;
    IF v_rec.reproceso_kg IS NOT NULL THEN
        RAISE EXCEPTION 'S3 FAIL: reproceso_kg should be NULL (no ingredients), got %', v_rec.reproceso_kg;
    END IF;

    -- lot_number también debe ser NULL
    IF v_rec.lot_number IS NOT NULL THEN
        RAISE EXCEPTION 'S3 FAIL: lot_number should be NULL (no ingredients), got %', v_rec.lot_number;
    END IF;

    RAISE NOTICE '✅ PASS S3 (no ingredients): peso=250, Aurrera, all ingredient columns=NULL';
END;
$$;

-- ================================================================
-- TEST S4: Batch sin kit — columnas kit NULL
--   Batch con datos completos de ingredientes pero SIN kit_numero,
--   kit_kg, semi_terminado_kg, verificadores.
--   VIEW debe mostrar esos campos como NULL (LEFT JOIN no aplica aquí
--   porque son columnas del batch mismo, no de un JOIN).
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
    VALUES (gen_random_uuid(), 'MC-S4', 'Vitaminas Test S4', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S4', 'Operador Test S4', true)
    RETURNING id INTO v_op_id;

    -- Insertar batch sin kit info (solo peso e ingredientes)
    INSERT INTO public.vitaminas_batches (id, machine_id, operator_id, shift_type, batch_number,
                                          product_name,
                                          peso_bascula, peso_fisico,
                                          status, data_source, created_at)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'matutino', 1,
            'Canelate',
            300.00, 298.00,
            'completed', 'manual', '2026-05-24 08:00:00-05'::timestamptz)
    RETURNING id INTO v_batch_id;

    -- Insertar un ingrediente
    INSERT INTO public.vitaminas_ingredients (id, batch_id, ingredient_type, kg)
    VALUES (gen_random_uuid(), v_batch_id, 'cocoa', 300.00);

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_mezclado_vitaminas
    WHERE machine_code = 'MC-S4';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S4 FAIL: No row returned for machine_code MC-S4';
    END IF;

    -- Verificar datos del batch disponibles
    IF v_rec.peso_bascula != 300.00 THEN
        RAISE EXCEPTION 'S4 FAIL: peso_bascula expected 300.00, got %', v_rec.peso_bascula;
    END IF;

    IF v_rec.product_name != 'Canelate' THEN
        RAISE EXCEPTION 'S4 FAIL: product_name expected Canelate, got %', v_rec.product_name;
    END IF;

    -- Verificar que los campos opcionales son NULL (no se proporcionaron)
    IF v_rec.kit_numero IS NOT NULL THEN
        RAISE EXCEPTION 'S4 FAIL: kit_numero should be NULL (not provided), got %', v_rec.kit_numero;
    END IF;

    IF v_rec.kit_kg IS NOT NULL THEN
        RAISE EXCEPTION 'S4 FAIL: kit_kg should be NULL (not provided), got %', v_rec.kit_kg;
    END IF;

    IF v_rec.semi_terminado_kg IS NOT NULL THEN
        RAISE EXCEPTION 'S4 FAIL: semi_terminado_kg should be NULL (not provided), got %', v_rec.semi_terminado_kg;
    END IF;

    IF v_rec.verificador_produccion IS NOT NULL THEN
        RAISE EXCEPTION 'S4 FAIL: verificador_produccion should be NULL (not provided), got %', v_rec.verificador_produccion;
    END IF;

    IF v_rec.verificador_calidad IS NOT NULL THEN
        RAISE EXCEPTION 'S4 FAIL: verificador_calidad should be NULL (not provided), got %', v_rec.verificador_calidad;
    END IF;

    -- Verificar que cocoa_kg sí está (el ingrediente que insertamos)
    IF v_rec.cocoa_kg IS NULL THEN
        RAISE EXCEPTION 'S4 FAIL: cocoa_kg should NOT be NULL (we inserted cocoa)';
    END IF;

    RAISE NOTICE '✅ PASS S4 (no kit): kit/verificador columns=NULL, cocoa_kg=300';
END;
$$;

-- ================================================================
-- TEST S5: Múltiples máquinas mismo turno — 2 batches, 2 máquinas
--   Una línea, 2 máquinas, mismo shift_type, misma fecha.
--   La VIEW debe devolver 2 filas independientes.
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
    VALUES (gen_random_uuid(), 'MC-S5A', 'Vitaminas S5 A', v_line_id, true)
    RETURNING id INTO v_machine1_id;

    -- Máquina 2
    INSERT INTO public.machines (id, code, name, line_id, is_active)
    VALUES (gen_random_uuid(), 'MC-S5B', 'Vitaminas S5 B', v_line_id, true)
    RETURNING id INTO v_machine2_id;

    -- Batch 1 en máquina 1 (500 kg, Choco choco R1)
    INSERT INTO public.vitaminas_batches (id, machine_id, operator_id, shift_type, batch_number,
                                          product_name, product_formula,
                                          peso_bascula, status, data_source, created_at)
    VALUES (gen_random_uuid(), v_machine1_id, v_op_id, 'matutino', 1,
            'Choco choco', 'R1',
            500.00, 'completed', 'manual', '2026-05-24 06:00:00-05'::timestamptz)
    RETURNING id INTO v_batch1_id;

    -- Batch 2 en máquina 2 (750 kg, Aurrera R2)
    INSERT INTO public.vitaminas_batches (id, machine_id, operator_id, shift_type, batch_number,
                                          product_name, product_formula,
                                          peso_bascula, status, data_source, created_at)
    VALUES (gen_random_uuid(), v_machine2_id, v_op_id, 'matutino', 1,
            'Aurrera', 'R2',
            750.00, 'completed', 'manual', '2026-05-24 06:00:00-05'::timestamptz)
    RETURNING id INTO v_batch2_id;

    -- Insertar ingredientes
    INSERT INTO public.vitaminas_ingredients (id, batch_id, ingredient_type, kg)
    VALUES
        (gen_random_uuid(), v_batch1_id, 'azucar', 500.00),
        (gen_random_uuid(), v_batch2_id, 'azucar', 750.00);

    -- Contar filas
    SELECT COUNT(*) INTO v_row_count FROM public.view_mezclado_vitaminas
    WHERE machine_code IN ('MC-S5A', 'MC-S5B');

    IF v_row_count != 2 THEN
        RAISE EXCEPTION 'S5 FAIL: Expected 2 rows for 2 machines, got %', v_row_count;
    END IF;

    -- Verificar valores independientes
    SELECT * INTO v_rec1 FROM public.view_mezclado_vitaminas WHERE machine_code = 'MC-S5A';
    SELECT * INTO v_rec2 FROM public.view_mezclado_vitaminas WHERE machine_code = 'MC-S5B';

    IF v_rec1.machine_code IS NULL THEN
        RAISE EXCEPTION 'S5 FAIL: No row for MC-S5A';
    END IF;

    IF v_rec2.machine_code IS NULL THEN
        RAISE EXCEPTION 'S5 FAIL: No row for MC-S5B';
    END IF;

    IF v_rec1.peso_bascula != 500.00 THEN
        RAISE EXCEPTION 'S5 FAIL: MC-S5A peso_bascula expected 500, got %', v_rec1.peso_bascula;
    END IF;

    IF v_rec2.peso_bascula != 750.00 THEN
        RAISE EXCEPTION 'S5 FAIL: MC-S5B peso_bascula expected 750, got %', v_rec2.peso_bascula;
    END IF;

    IF v_rec1.product_formula != 'R1' THEN
        RAISE EXCEPTION 'S5 FAIL: MC-S5A product_formula expected R1, got %', v_rec1.product_formula;
    END IF;

    IF v_rec2.product_formula != 'R2' THEN
        RAISE EXCEPTION 'S5 FAIL: MC-S5B product_formula expected R2, got %', v_rec2.product_formula;
    END IF;

    RAISE NOTICE '✅ PASS S5 (multiple machines): 2 rows (MC-S5A: peso=%, R1 | MC-S5B: peso=%, R2)',
        v_rec1.peso_bascula, v_rec2.peso_bascula;
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
    VALUES (gen_random_uuid(), 'MC-S6', 'Vitaminas Test S6', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S6', 'Operador Test S6', true)
    RETURNING id INTO v_op_id;

    -- Batch manual
    INSERT INTO public.vitaminas_batches (id, machine_id, operator_id, shift_type, batch_number,
                                          product_name, peso_bascula, status, data_source, created_at)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'matutino', 1,
            'Choco choco', 500.00, 'completed', 'manual', '2026-05-24 06:00:00-05'::timestamptz)
    RETURNING id INTO v_batch_man_id;

    -- Batch IoT
    INSERT INTO public.vitaminas_batches (id, machine_id, operator_id, shift_type, batch_number,
                                          product_name, peso_bascula, status, data_source, created_at)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'matutino', 2,
            'Choco choco', 600.00, 'completed', 'iot', '2026-05-24 07:00:00-05'::timestamptz)
    RETURNING id INTO v_batch_iot_id;

    -- Batch hybrid
    INSERT INTO public.vitaminas_batches (id, machine_id, operator_id, shift_type, batch_number,
                                          product_name, peso_bascula, status, data_source, created_at)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'matutino', 3,
            'Choco choco', 700.00, 'completed', 'hybrid', '2026-05-24 08:00:00-05'::timestamptz)
    RETURNING id INTO v_batch_hyb_id;

    -- Insertar ingredientes para cada batch
    INSERT INTO public.vitaminas_ingredients (id, batch_id, ingredient_type, kg)
    VALUES
        (gen_random_uuid(), v_batch_man_id, 'azucar', 500.00),
        (gen_random_uuid(), v_batch_iot_id, 'azucar', 600.00),
        (gen_random_uuid(), v_batch_hyb_id, 'azucar', 700.00);

    -- Consultar VIEW
    SELECT * INTO v_rec_man FROM public.view_mezclado_vitaminas
    WHERE machine_code = 'MC-S6' AND batch_number = 1;

    SELECT * INTO v_rec_iot FROM public.view_mezclado_vitaminas
    WHERE machine_code = 'MC-S6' AND batch_number = 2;

    SELECT * INTO v_rec_hyb FROM public.view_mezclado_vitaminas
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

    RAISE NOTICE '✅ PASS S6 (data_source): manual→%, iot→%, hybrid→%',
        v_rec_man.data_source, v_rec_iot.data_source, v_rec_hyb.data_source;
END;
$$;

-- ================================================================
-- TEST S7: Kit inventory aparece con batch data
--   Batch con vitaminas_kit_inventory para el mismo machine/shift/fecha/product.
--   Verifica que las columnas de inventario se muestren en la fila del batch.
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
    VALUES (gen_random_uuid(), 'MC-S7', 'Vitaminas Test S7', v_line_id, true)
    RETURNING id INTO v_machine_id;

    -- Insertar operador
    INSERT INTO public.operators (id, full_name, is_active)
    VALUES ('OP-S7', 'Operador Test S7', true)
    RETURNING id INTO v_op_id;

    -- Insertar batch
    INSERT INTO public.vitaminas_batches (id, machine_id, operator_id, shift_type, batch_number,
                                          product_name, product_formula,
                                          peso_bascula, status, data_source, created_at)
    VALUES (gen_random_uuid(), v_machine_id, v_op_id, 'matutino', 1,
            'Choco choco', 'R1',
            500.00, 'completed', 'manual', '2026-05-24 06:00:00-05'::timestamptz)
    RETURNING id INTO v_batch_id;

    -- Insertar ingrediente
    INSERT INTO public.vitaminas_ingredients (id, batch_id, ingredient_type, kg)
    VALUES (gen_random_uuid(), v_batch_id, 'azucar', 500.00);

    -- Insertar kit_inventory para el mismo machine/shift/fecha/product
    INSERT INTO public.vitaminas_kit_inventory (id, machine_id, shift_type, fecha, product_name,
                                                 inv_inicial, recibidos, consumo, inv_final)
    VALUES (gen_random_uuid(), v_machine_id, 'matutino', '2026-05-24'::date, 'Choco choco',
            10, 5, 3, 12);

    -- Consultar VIEW
    SELECT * INTO v_rec FROM public.view_mezclado_vitaminas
    WHERE machine_code = 'MC-S7';

    IF v_rec.machine_code IS NULL THEN
        RAISE EXCEPTION 'S7 FAIL: No row returned for machine_code MC-S7';
    END IF;

    -- Verificar inventario
    IF v_rec.inv_inicial != 10 THEN
        RAISE EXCEPTION 'S7 FAIL: inv_inicial expected 10, got %', v_rec.inv_inicial;
    END IF;

    IF v_rec.recibidos != 5 THEN
        RAISE EXCEPTION 'S7 FAIL: recibidos expected 5, got %', v_rec.recibidos;
    END IF;

    IF v_rec.consumo != 3 THEN
        RAISE EXCEPTION 'S7 FAIL: consumo expected 3, got %', v_rec.consumo;
    END IF;

    IF v_rec.inv_final != 12 THEN
        RAISE EXCEPTION 'S7 FAIL: inv_final expected 12, got %', v_rec.inv_final;
    END IF;

    -- Verificar que el batch data también se muestra correctamente
    IF v_rec.peso_bascula != 500.00 THEN
        RAISE EXCEPTION 'S7 FAIL: batch peso_bascula expected 500.00, got %', v_rec.peso_bascula;
    END IF;

    IF v_rec.product_formula != 'R1' THEN
        RAISE EXCEPTION 'S7 FAIL: batch product_formula expected R1, got %', v_rec.product_formula;
    END IF;

    RAISE NOTICE '✅ PASS S7 (kit inventory): inv_inicial=10, recibidos=5, consumo=3, inv_final=12';
END;
$$;

-- ================================================================
-- VEREDICTO FINAL
-- ================================================================
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE '✅ ALL TESTS PASSED — view_mezclado_vitaminas is VERIFIED (S1-S7)';
    RAISE NOTICE '============================================================';
END;
$$;

ROLLBACK;
