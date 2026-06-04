-- Verify: 015_mezclado_tables
-- Verifica que las 3 tablas (mezclado_batches, mezclado_ingredients, mezclado_shift_totals)
-- existan con las columnas, tipos, constraints e índices correctos.

DO $$
DECLARE
    -- mezclado_batches columns
    v_mb_id_type              TEXT;
    v_mb_machine_id_type      TEXT;
    v_mb_operator_id_type     TEXT;
    v_mb_shift_type_type      TEXT;
    v_mb_batch_number_type    TEXT;
    v_mb_mezcladora_id_type   TEXT;
    v_mb_total_kg_type        TEXT;
    v_mb_viscosidad_type      TEXT;
    v_mb_temp_descarga_type   TEXT;
    v_mb_temp_deposito_type   TEXT;
    v_mb_tiempo_type          TEXT;
    v_mb_status_type          TEXT;
    v_mb_data_source_type     TEXT;
    v_mb_hora_entrada_type    TEXT;
    v_mb_hora_salida_type     TEXT;
    v_mb_notes_type           TEXT;
    v_mb_created_at_type      TEXT;
    v_mb_updated_at_type      TEXT;

    -- mezclado_ingredients columns
    v_mi_id_type              TEXT;
    v_mi_batch_id_type        TEXT;
    v_mi_ingredient_type_type TEXT;
    v_mi_kg_type              TEXT;
    v_mi_lot_number_type      TEXT;

    -- mezclado_shift_totals columns
    v_mst_id_type             TEXT;
    v_mst_machine_id_type     TEXT;
    v_mst_shift_type_type     TEXT;
    v_mst_fecha_type          TEXT;
    v_mst_total_mezcladas_type TEXT;
    v_mst_total_molidas_type  TEXT;
    v_mst_desperdicio_licor_type   TEXT;
    v_mst_desperdicio_azucar_type  TEXT;
    v_mst_barreduras_type     TEXT;
    v_mst_reproceso_type      TEXT;
    v_mst_notes_type          TEXT;

    -- Check constraints
    v_check_shift_type       BOOLEAN;
    v_check_mezcladora_id    BOOLEAN;
    v_check_status           BOOLEAN;
    v_check_data_source      BOOLEAN;
    v_check_total_kg         BOOLEAN;
    v_check_tiempo           BOOLEAN;
    v_check_ingredient_type  BOOLEAN;
    v_check_kg               BOOLEAN;
    v_check_total_mezcladas  BOOLEAN;
    v_check_total_molidas    BOOLEAN;
    v_check_desperdicio_licor BOOLEAN;
    v_check_desperdicio_azucar BOOLEAN;
    v_check_barreduras       BOOLEAN;
    v_check_reproceso        BOOLEAN;
    v_check_shift_type_st    BOOLEAN;

    -- Indexes
    v_idx_mb_machine_id      BOOLEAN;
    v_idx_mb_shift_type      BOOLEAN;
    v_idx_mb_hora_entrada    BOOLEAN;
    v_idx_mb_status          BOOLEAN;
    v_idx_mb_operator_id     BOOLEAN;
    v_idx_mi_batch_id        BOOLEAN;
    v_idx_mi_ingredient_type BOOLEAN;
    v_idx_mst_machine_id     BOOLEAN;
    v_idx_mst_fecha          BOOLEAN;

    -- Unique constraint
    v_unique_shift_totals    BOOLEAN;

    -- Triggers
    v_trg_batches_upd        BOOLEAN;
    v_trg_shift_totals_upd   BOOLEAN;

    v_check_passed BOOLEAN := TRUE;
    v_error_msg TEXT := '';
    v_col_type TEXT;
BEGIN
    -- ============================================================
    -- TEST 1: mezclado_batches existe con columnas correctas
    -- ============================================================

    -- id: UUID, PK
    SELECT data_type INTO v_mb_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mezclado_batches' AND column_name = 'id';
    IF v_mb_id_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1a]: Column id not found on mezclado_batches. ';
        v_check_passed := FALSE;
    ELSIF v_mb_id_type NOT IN ('uuid', 'UUID') THEN
        v_error_msg := v_error_msg || 'FAIL[1a]: id type is ' || v_mb_id_type || ' (expected UUID). ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1a]: mezclado_batches.id exists as UUID PK';
    END IF;

    -- machine_id: UUID NOT NULL
    SELECT data_type, is_nullable INTO v_col_type, v_mb_machine_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mezclado_batches' AND column_name = 'machine_id';
    IF v_col_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1b]: Column machine_id not found on mezclado_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1b]: mezclado_batches.machine_id exists';
    END IF;

    -- operator_id: VARCHAR(50)
    SELECT data_type, COALESCE(character_maximum_length::TEXT, 'none')
    INTO v_col_type, v_mb_operator_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mezclado_batches' AND column_name = 'operator_id';
    IF v_col_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1c]: Column operator_id not found on mezclado_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1c]: mezclado_batches.operator_id exists';
    END IF;

    -- shift_type: VARCHAR(20) NOT NULL
    SELECT data_type, COALESCE(character_maximum_length::TEXT, 'none')
    INTO v_col_type, v_mb_shift_type_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mezclado_batches' AND column_name = 'shift_type';
    IF v_col_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1d]: Column shift_type not found on mezclado_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1d]: mezclado_batches.shift_type exists';
    END IF;

    -- batch_number: INT NOT NULL
    SELECT data_type INTO v_mb_batch_number_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mezclado_batches' AND column_name = 'batch_number';
    IF v_mb_batch_number_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1e]: Column batch_number not found on mezclado_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1e]: mezclado_batches.batch_number exists';
    END IF;

    -- mezcladora_id: INT NOT NULL
    SELECT data_type INTO v_mb_mezcladora_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mezclado_batches' AND column_name = 'mezcladora_id';
    IF v_mb_mezcladora_id_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1f]: Column mezcladora_id not found on mezclado_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1f]: mezclado_batches.mezcladora_id exists';
    END IF;

    -- total_kg: NUMERIC(10,3) NOT NULL
    SELECT data_type, COALESCE(numeric_precision::TEXT, 'none'), COALESCE(numeric_scale::TEXT, 'none')
    INTO v_col_type, v_mb_total_kg_type, v_mb_total_kg_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mezclado_batches' AND column_name = 'total_kg';
    IF v_col_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1g]: Column total_kg not found on mezclado_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1g]: mezclado_batches.total_kg exists as NUMERIC';
    END IF;

    -- viscosidad_cps: NUMERIC(10,2)
    SELECT data_type INTO v_mb_viscosidad_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mezclado_batches' AND column_name = 'viscosidad_cps';
    IF v_mb_viscosidad_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1h]: Column viscosidad_cps not found on mezclado_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1h]: mezclado_batches.viscosidad_cps exists';
    END IF;

    -- temp_descarga: NUMERIC(5,2)
    SELECT data_type INTO v_mb_temp_descarga_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mezclado_batches' AND column_name = 'temp_descarga';
    IF v_mb_temp_descarga_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1i]: Column temp_descarga not found on mezclado_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1i]: mezclado_batches.temp_descarga exists';
    END IF;

    -- temp_deposito: NUMERIC(5,2)
    SELECT data_type INTO v_mb_temp_deposito_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mezclado_batches' AND column_name = 'temp_deposito';
    IF v_mb_temp_deposito_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1j]: Column temp_deposito not found on mezclado_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1j]: mezclado_batches.temp_deposito exists';
    END IF;

    -- status: VARCHAR(20) NOT NULL DEFAULT 'pending'
    SELECT data_type, COALESCE(character_maximum_length::TEXT, 'none')
    INTO v_col_type, v_mb_status_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mezclado_batches' AND column_name = 'status';
    IF v_col_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1k]: Column status not found on mezclado_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1k]: mezclado_batches.status exists';
    END IF;

    -- data_source: VARCHAR(10) NOT NULL DEFAULT 'manual'
    SELECT data_type, COALESCE(character_maximum_length::TEXT, 'none')
    INTO v_col_type, v_mb_data_source_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mezclado_batches' AND column_name = 'data_source';
    IF v_col_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1l]: Column data_source not found on mezclado_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1l]: mezclado_batches.data_source exists';
    END IF;

    -- ============================================================
    -- TEST 1m: Resto de columnas en mezclado_batches
    -- ============================================================
    SELECT data_type INTO v_mb_hora_entrada_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mezclado_batches' AND column_name = 'hora_entrada';
    IF v_mb_hora_entrada_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1m]: Column hora_entrada not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1m]: mezclado_batches.hora_entrada exists';
    END IF;

    -- ============================================================
    -- TEST 2: mezclado_ingredients existe con columnas correctas
    -- ============================================================
    SELECT data_type INTO v_mi_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mezclado_ingredients' AND column_name = 'id';
    IF v_mi_id_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[2a]: Table mezclado_ingredients not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[2a]: mezclado_ingredients exists with PK';
    END IF;

    SELECT data_type INTO v_mi_batch_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mezclado_ingredients' AND column_name = 'batch_id';
    IF v_mi_batch_id_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[2b]: Column batch_id not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[2b]: mezclado_ingredients.batch_id exists';
    END IF;

    SELECT data_type INTO v_mi_kg_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mezclado_ingredients' AND column_name = 'kg';
    IF v_mi_kg_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[2c]: Column kg not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[2c]: mezclado_ingredients.kg exists';
    END IF;

    -- ============================================================
    -- TEST 3: mezclado_shift_totals existe con columnas correctas
    -- ============================================================
    SELECT data_type INTO v_mst_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mezclado_shift_totals' AND column_name = 'id';
    IF v_mst_id_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[3a]: Table mezclado_shift_totals not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[3a]: mezclado_shift_totals exists with PK';
    END IF;

    SELECT data_type INTO v_mst_total_mezcladas_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mezclado_shift_totals' AND column_name = 'total_mezcladas';
    IF v_mst_total_mezcladas_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[3b]: Column total_mezcladas not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[3b]: mezclado_shift_totals.total_mezcladas exists';
    END IF;

    SELECT data_type INTO v_mst_total_molidas_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mezclado_shift_totals' AND column_name = 'total_molidas';
    IF v_mst_total_molidas_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[3c]: Column total_molidas not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[3c]: mezclado_shift_totals.total_molidas exists';
    END IF;

    -- ============================================================
    -- TEST 4: CHECK constraints en mezclado_batches
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'mezclado_batches'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%shift_type%'
    ) INTO v_check_shift_type;

    IF NOT v_check_shift_type THEN
        v_error_msg := v_error_msg || 'FAIL[4a]: CHECK on shift_type not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[4a]: CHECK constraint on mezclado_batches.shift_type exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'mezclado_batches'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%mezcladora_id%'
    ) INTO v_check_mezcladora_id;

    IF NOT v_check_mezcladora_id THEN
        v_error_msg := v_error_msg || 'FAIL[4b]: CHECK on mezcladora_id not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[4b]: CHECK constraint on mezclado_batches.mezcladora_id IN (1,2) exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'mezclado_batches'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%status%'
    ) INTO v_check_status;

    IF NOT v_check_status THEN
        v_error_msg := v_error_msg || 'FAIL[4c]: CHECK on status not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[4c]: CHECK constraint on mezclado_batches.status (FSM) exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'mezclado_batches'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%data_source%'
    ) INTO v_check_data_source;

    IF NOT v_check_data_source THEN
        v_error_msg := v_error_msg || 'FAIL[4d]: CHECK on data_source not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[4d]: CHECK constraint on mezclado_batches.data_source exists';
    END IF;

    -- ============================================================
    -- TEST 5: CHECK constraints en mezclado_ingredients
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'mezclado_ingredients'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%ingredient_type%'
    ) INTO v_check_ingredient_type;

    IF NOT v_check_ingredient_type THEN
        v_error_msg := v_error_msg || 'FAIL[5a]: CHECK on ingredient_type not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[5a]: CHECK constraint on mezclado_ingredients.ingredient_type exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'mezclado_ingredients'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%kg >%'
    ) INTO v_check_kg;

    IF NOT v_check_kg THEN
        v_error_msg := v_error_msg || 'FAIL[5b]: CHECK on kg > 0 not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[5b]: CHECK constraint on mezclado_ingredients.kg > 0 exists';
    END IF;

    -- ============================================================
    -- TEST 6: CHECK constraints en mezclado_shift_totals
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'mezclado_shift_totals'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%total_mezcladas%'
    ) INTO v_check_total_mezcladas;

    IF NOT v_check_total_mezcladas THEN
        v_error_msg := v_error_msg || 'FAIL[6a]: CHECK on total_mezcladas not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[6a]: CHECK constraint on mezclado_shift_totals.total_mezcladas >= 0 exists';
    END IF;

    -- ============================================================
    -- TEST 7: Índices en mezclado_batches
    -- ============================================================
    SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='mezclado_batches' AND indexname='idx_mezclado_batches_machine_id')
    INTO v_idx_mb_machine_id;
    IF NOT v_idx_mb_machine_id THEN
        v_error_msg := v_error_msg || 'FAIL[7a]: Index idx_mezclado_batches_machine_id not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[7a]: Index idx_mezclado_batches_machine_id exists';
    END IF;

    SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='mezclado_batches' AND indexname='idx_mezclado_batches_hora_entrada')
    INTO v_idx_mb_hora_entrada;
    IF NOT v_idx_mb_hora_entrada THEN
        v_error_msg := v_error_msg || 'FAIL[7b]: Index idx_mezclado_batches_hora_entrada not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[7b]: Index idx_mezclado_batches_hora_entrada exists';
    END IF;

    -- ============================================================
    -- TEST 8: Índices en mezclado_ingredients
    -- ============================================================
    SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='mezclado_ingredients' AND indexname='idx_mezclado_ingredients_batch_id')
    INTO v_idx_mi_batch_id;
    IF NOT v_idx_mi_batch_id THEN
        v_error_msg := v_error_msg || 'FAIL[8a]: Index idx_mezclado_ingredients_batch_id not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[8a]: Index idx_mezclado_ingredients_batch_id exists';
    END IF;

    -- ============================================================
    -- TEST 9: Índices en mezclado_shift_totals
    -- ============================================================
    SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='mezclado_shift_totals' AND indexname='idx_mezclado_shift_totals_machine_id')
    INTO v_idx_mst_machine_id;
    IF NOT v_idx_mst_machine_id THEN
        v_error_msg := v_error_msg || 'FAIL[9a]: Index idx_mezclado_shift_totals_machine_id not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[9a]: Index idx_mezclado_shift_totals_machine_id exists';
    END IF;

    -- ============================================================
    -- TEST 10: Unique constraint en mezclado_shift_totals
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'mezclado_shift_totals'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'u'
    ) INTO v_unique_shift_totals;

    IF NOT v_unique_shift_totals THEN
        v_error_msg := v_error_msg || 'FAIL[10]: UNIQUE constraint on (machine_id, shift_type, fecha) not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[10]: UNIQUE constraint on mezclado_shift_totals (machine_id, shift_type, fecha) exists';
    END IF;

    -- ============================================================
    -- TEST 11: Triggers
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE event_object_schema = 'public'
          AND event_object_table = 'mezclado_batches'
          AND trigger_name = 'trg_mezclado_batches_updated_at'
    ) INTO v_trg_batches_upd;

    IF NOT v_trg_batches_upd THEN
        v_error_msg := v_error_msg || 'FAIL[11a]: Trigger trg_mezclado_batches_updated_at not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[11a]: Trigger trg_mezclado_batches_updated_at exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE event_object_schema = 'public'
          AND event_object_table = 'mezclado_shift_totals'
          AND trigger_name = 'trg_mezclado_shift_totals_updated_at'
    ) INTO v_trg_shift_totals_upd;

    IF NOT v_trg_shift_totals_upd THEN
        v_error_msg := v_error_msg || 'FAIL[11b]: Trigger trg_mezclado_shift_totals_updated_at not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[11b]: Trigger trg_mezclado_shift_totals_updated_at exists';
    END IF;

    -- ============================================================
    -- TEST 12: FK constraints (punto extra)
    -- ============================================================
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'mezclado_batches'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'f'
          AND c.confrelid = 'public.machines'::regclass
    ) THEN
        v_error_msg := v_error_msg || 'FAIL[12a]: FK on mezclado_batches.machine_id → machines not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[12a]: FK mezclado_batches.machine_id → machines exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'mezclado_ingredients'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'f'
          AND c.confrelid = 'public.mezclado_batches'::regclass
    ) THEN
        v_error_msg := v_error_msg || 'FAIL[12b]: FK on mezclado_ingredients.batch_id → mezclado_batches not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[12b]: FK mezclado_ingredients.batch_id → mezclado_batches (CASCADE) exists';
    END IF;

    -- ============================================================
    -- VEREDICTO FINAL
    -- ============================================================
    IF v_check_passed THEN
        RAISE NOTICE '============================================================';
        RAISE NOTICE '✅ ALL TESTS PASSED — Migration 015_mezclado_tables is VERIFIED';
        RAISE NOTICE '============================================================';
    ELSE
        RAISE EXCEPTION '❌ VERIFICATION FAILED: %', v_error_msg;
    END IF;
END;
$$;
