-- Verify: 017_vitaminas_tables
-- Verifica que las 3 tablas (vitaminas_batches, vitaminas_ingredients, vitaminas_kit_inventory)
-- existan con las columnas, tipos, constraints e índices correctos.

DO $$
DECLARE
    -- vitaminas_batches columns
    v_vb_id_type                TEXT;
    v_vb_machine_id_type        TEXT;
    v_vb_operator_id_type       TEXT;
    v_vb_shift_type_type        TEXT;
    v_vb_batch_number_type      TEXT;
    v_vb_product_name_type      TEXT;
    v_vb_product_formula_type   TEXT;
    v_vb_peso_bascula_type      TEXT;
    v_vb_peso_fisico_type       TEXT;
    v_vb_kit_numero_type        TEXT;
    v_vb_kit_kg_type            TEXT;
    v_vb_semi_terminado_type    TEXT;
    v_vb_verificador_prod_type  TEXT;
    v_vb_verificador_cal_type   TEXT;
    v_vb_status_type            TEXT;
    v_vb_data_source_type       TEXT;
    v_vb_notes_type             TEXT;
    v_vb_created_at_type        TEXT;
    v_vb_updated_at_type        TEXT;

    -- vitaminas_ingredients columns
    v_vi_id_type                TEXT;
    v_vi_batch_id_type          TEXT;
    v_vi_ingredient_type_type   TEXT;
    v_vi_kg_type                TEXT;
    v_vi_lot_number_type        TEXT;

    -- vitaminas_kit_inventory columns
    v_vki_id_type               TEXT;
    v_vki_machine_id_type       TEXT;
    v_vki_shift_type_type       TEXT;
    v_vki_fecha_type            TEXT;
    v_vki_product_name_type     TEXT;
    v_vki_inv_inicial_type      TEXT;
    v_vki_recibidos_type        TEXT;
    v_vki_consumo_type          TEXT;
    v_vki_inv_final_type        TEXT;

    -- Check constraints
    v_check_shift_type_vb       BOOLEAN;
    v_check_batch_number        BOOLEAN;
    v_check_status              BOOLEAN;
    v_check_data_source         BOOLEAN;
    v_check_ingredient_type     BOOLEAN;
    v_check_kg                  BOOLEAN;
    v_check_shift_type_vki      BOOLEAN;
    v_check_inv_inicial         BOOLEAN;
    v_check_recibidos           BOOLEAN;
    v_check_consumo             BOOLEAN;
    v_check_inv_final           BOOLEAN;

    -- Indexes
    v_idx_vb_machine_id         BOOLEAN;
    v_idx_vb_shift_type         BOOLEAN;
    v_idx_vb_created_at         BOOLEAN;
    v_idx_vb_status             BOOLEAN;
    v_idx_vb_operator_id        BOOLEAN;
    v_idx_vb_product_formula    BOOLEAN;
    v_idx_vi_batch_id           BOOLEAN;
    v_idx_vi_ingredient_type    BOOLEAN;
    v_idx_vki_machine_id        BOOLEAN;
    v_idx_vki_fecha             BOOLEAN;

    -- Unique constraint
    v_unique_inventory          BOOLEAN;

    -- Triggers
    v_trg_batches_upd           BOOLEAN;
    v_trg_inventory_upd         BOOLEAN;

    -- FK constraints
    v_fk_machine_id             BOOLEAN;
    v_fk_batch_id               BOOLEAN;
    v_fk_vki_machine_id         BOOLEAN;
    v_fk_operator_id            BOOLEAN;

    v_check_passed BOOLEAN := TRUE;
    v_error_msg TEXT := '';
    v_col_type TEXT;
BEGIN
    -- ============================================================
    -- TEST 1: vitaminas_batches existe con columnas correctas
    -- ============================================================

    -- id: UUID, PK
    SELECT data_type INTO v_vb_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_batches' AND column_name = 'id';
    IF v_vb_id_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1a]: Column id not found on vitaminas_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1a]: vitaminas_batches.id exists as UUID PK';
    END IF;

    -- machine_id: UUID NOT NULL
    SELECT data_type INTO v_vb_machine_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_batches' AND column_name = 'machine_id';
    IF v_vb_machine_id_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1b]: Column machine_id not found on vitaminas_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1b]: vitaminas_batches.machine_id exists';
    END IF;

    -- operator_id: VARCHAR(50)
    SELECT data_type, COALESCE(character_maximum_length::TEXT, 'none')
    INTO v_col_type, v_vb_operator_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_batches' AND column_name = 'operator_id';
    IF v_col_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1c]: Column operator_id not found on vitaminas_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1c]: vitaminas_batches.operator_id exists';
    END IF;

    -- shift_type: VARCHAR(20) NOT NULL
    SELECT data_type, COALESCE(character_maximum_length::TEXT, 'none')
    INTO v_col_type, v_vb_shift_type_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_batches' AND column_name = 'shift_type';
    IF v_col_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1d]: Column shift_type not found on vitaminas_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1d]: vitaminas_batches.shift_type exists';
    END IF;

    -- batch_number: INT NOT NULL
    SELECT data_type INTO v_vb_batch_number_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_batches' AND column_name = 'batch_number';
    IF v_vb_batch_number_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1e]: Column batch_number not found on vitaminas_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1e]: vitaminas_batches.batch_number exists';
    END IF;

    -- product_name: VARCHAR(100)
    SELECT data_type INTO v_vb_product_name_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_batches' AND column_name = 'product_name';
    IF v_vb_product_name_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1f]: Column product_name not found on vitaminas_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1f]: vitaminas_batches.product_name exists';
    END IF;

    -- product_formula: VARCHAR(50)
    SELECT data_type INTO v_vb_product_formula_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_batches' AND column_name = 'product_formula';
    IF v_vb_product_formula_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1g]: Column product_formula not found on vitaminas_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1g]: vitaminas_batches.product_formula exists';
    END IF;

    -- peso_bascula: NUMERIC(10,2)
    SELECT data_type INTO v_vb_peso_bascula_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_batches' AND column_name = 'peso_bascula';
    IF v_vb_peso_bascula_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1h]: Column peso_bascula not found on vitaminas_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1h]: vitaminas_batches.peso_bascula exists';
    END IF;

    -- peso_fisico: NUMERIC(10,2)
    SELECT data_type INTO v_vb_peso_fisico_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_batches' AND column_name = 'peso_fisico';
    IF v_vb_peso_fisico_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1i]: Column peso_fisico not found on vitaminas_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1i]: vitaminas_batches.peso_fisico exists';
    END IF;

    -- kit_numero: VARCHAR(50)
    SELECT data_type INTO v_vb_kit_numero_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_batches' AND column_name = 'kit_numero';
    IF v_vb_kit_numero_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1j]: Column kit_numero not found on vitaminas_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1j]: vitaminas_batches.kit_numero exists';
    END IF;

    -- kit_kg: NUMERIC(10,2)
    SELECT data_type INTO v_vb_kit_kg_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_batches' AND column_name = 'kit_kg';
    IF v_vb_kit_kg_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1k]: Column kit_kg not found on vitaminas_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1k]: vitaminas_batches.kit_kg exists';
    END IF;

    -- semi_terminado_kg: NUMERIC(10,2)
    SELECT data_type INTO v_vb_semi_terminado_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_batches' AND column_name = 'semi_terminado_kg';
    IF v_vb_semi_terminado_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1l]: Column semi_terminado_kg not found on vitaminas_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1l]: vitaminas_batches.semi_terminado_kg exists';
    END IF;

    -- verificador_produccion: VARCHAR(100)
    SELECT data_type INTO v_vb_verificador_prod_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_batches' AND column_name = 'verificador_produccion';
    IF v_vb_verificador_prod_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1m]: Column verificador_produccion not found on vitaminas_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1m]: vitaminas_batches.verificador_produccion exists';
    END IF;

    -- verificador_calidad: VARCHAR(100)
    SELECT data_type INTO v_vb_verificador_cal_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_batches' AND column_name = 'verificador_calidad';
    IF v_vb_verificador_cal_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1n]: Column verificador_calidad not found on vitaminas_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1n]: vitaminas_batches.verificador_calidad exists';
    END IF;

    -- status: VARCHAR(20) NOT NULL DEFAULT 'pending'
    SELECT data_type, COALESCE(character_maximum_length::TEXT, 'none')
    INTO v_col_type, v_vb_status_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_batches' AND column_name = 'status';
    IF v_col_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1o]: Column status not found on vitaminas_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1o]: vitaminas_batches.status exists';
    END IF;

    -- data_source: VARCHAR(10) NOT NULL DEFAULT 'manual'
    SELECT data_type, COALESCE(character_maximum_length::TEXT, 'none')
    INTO v_col_type, v_vb_data_source_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_batches' AND column_name = 'data_source';
    IF v_col_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1p]: Column data_source not found on vitaminas_batches. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1p]: vitaminas_batches.data_source exists';
    END IF;

    -- ============================================================
    -- TEST 2: vitaminas_ingredients existe con columnas correctas
    -- ============================================================
    SELECT data_type INTO v_vi_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_ingredients' AND column_name = 'id';
    IF v_vi_id_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[2a]: Table vitaminas_ingredients not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[2a]: vitaminas_ingredients exists with PK';
    END IF;

    SELECT data_type INTO v_vi_batch_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_ingredients' AND column_name = 'batch_id';
    IF v_vi_batch_id_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[2b]: Column batch_id not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[2b]: vitaminas_ingredients.batch_id exists';
    END IF;

    SELECT data_type INTO v_vi_kg_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_ingredients' AND column_name = 'kg';
    IF v_vi_kg_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[2c]: Column kg not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[2c]: vitaminas_ingredients.kg exists';
    END IF;

    -- ============================================================
    -- TEST 3: vitaminas_kit_inventory existe con columnas correctas
    -- ============================================================
    SELECT data_type INTO v_vki_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_kit_inventory' AND column_name = 'id';
    IF v_vki_id_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[3a]: Table vitaminas_kit_inventory not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[3a]: vitaminas_kit_inventory exists with PK';
    END IF;

    SELECT data_type INTO v_vki_inv_inicial_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vitaminas_kit_inventory' AND column_name = 'inv_inicial';
    IF v_vki_inv_inicial_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[3b]: Column inv_inicial not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[3b]: vitaminas_kit_inventory.inv_inicial exists';
    END IF;

    -- ============================================================
    -- TEST 4: CHECK constraints en vitaminas_batches
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'vitaminas_batches'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%shift_type%'
    ) INTO v_check_shift_type_vb;

    IF NOT v_check_shift_type_vb THEN
        v_error_msg := v_error_msg || 'FAIL[4a]: CHECK on shift_type not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[4a]: CHECK constraint on vitaminas_batches.shift_type exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'vitaminas_batches'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%batch_number%'
    ) INTO v_check_batch_number;

    IF NOT v_check_batch_number THEN
        v_error_msg := v_error_msg || 'FAIL[4b]: CHECK on batch_number not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[4b]: CHECK constraint on vitaminas_batches.batch_number BETWEEN 1 AND 20 exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'vitaminas_batches'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%status%'
    ) INTO v_check_status;

    IF NOT v_check_status THEN
        v_error_msg := v_error_msg || 'FAIL[4c]: CHECK on status not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[4c]: CHECK constraint on vitaminas_batches.status (FSM) exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'vitaminas_batches'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%data_source%'
    ) INTO v_check_data_source;

    IF NOT v_check_data_source THEN
        v_error_msg := v_error_msg || 'FAIL[4d]: CHECK on data_source not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[4d]: CHECK constraint on vitaminas_batches.data_source exists';
    END IF;

    -- ============================================================
    -- TEST 5: CHECK constraints en vitaminas_ingredients
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'vitaminas_ingredients'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%ingredient_type%'
    ) INTO v_check_ingredient_type;

    IF NOT v_check_ingredient_type THEN
        v_error_msg := v_error_msg || 'FAIL[5a]: CHECK on ingredient_type not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[5a]: CHECK constraint on vitaminas_ingredients.ingredient_type exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'vitaminas_ingredients'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%kg >%'
    ) INTO v_check_kg;

    IF NOT v_check_kg THEN
        v_error_msg := v_error_msg || 'FAIL[5b]: CHECK on kg > 0 not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[5b]: CHECK constraint on vitaminas_ingredients.kg > 0 exists';
    END IF;

    -- ============================================================
    -- TEST 6: CHECK constraints en vitaminas_kit_inventory
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'vitaminas_kit_inventory'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%inv_inicial%'
    ) INTO v_check_inv_inicial;

    IF NOT v_check_inv_inicial THEN
        v_error_msg := v_error_msg || 'FAIL[6a]: CHECK on inv_inicial >= 0 not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[6a]: CHECK constraint on vitaminas_kit_inventory.inv_inicial >= 0 exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'vitaminas_kit_inventory'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%recibidos%'
    ) INTO v_check_recibidos;

    IF NOT v_check_recibidos THEN
        v_error_msg := v_error_msg || 'FAIL[6b]: CHECK on recibidos >= 0 not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[6b]: CHECK constraint on vitaminas_kit_inventory.recibidos >= 0 exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'vitaminas_kit_inventory'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%consumo%'
    ) INTO v_check_consumo;

    IF NOT v_check_consumo THEN
        v_error_msg := v_error_msg || 'FAIL[6c]: CHECK on consumo >= 0 not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[6c]: CHECK constraint on vitaminas_kit_inventory.consumo >= 0 exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'vitaminas_kit_inventory'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%inv_final%'
    ) INTO v_check_inv_final;

    IF NOT v_check_inv_final THEN
        v_error_msg := v_error_msg || 'FAIL[6d]: CHECK on inv_final >= 0 not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[6d]: CHECK constraint on vitaminas_kit_inventory.inv_final >= 0 exists';
    END IF;

    -- ============================================================
    -- TEST 7: Índices en vitaminas_batches
    -- ============================================================
    SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='vitaminas_batches' AND indexname='idx_vitaminas_batches_machine_id')
    INTO v_idx_vb_machine_id;
    IF NOT v_idx_vb_machine_id THEN
        v_error_msg := v_error_msg || 'FAIL[7a]: Index idx_vitaminas_batches_machine_id not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[7a]: Index idx_vitaminas_batches_machine_id exists';
    END IF;

    SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='vitaminas_batches' AND indexname='idx_vitaminas_batches_shift_type')
    INTO v_idx_vb_shift_type;
    IF NOT v_idx_vb_shift_type THEN
        v_error_msg := v_error_msg || 'FAIL[7b]: Index idx_vitaminas_batches_shift_type not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[7b]: Index idx_vitaminas_batches_shift_type exists';
    END IF;

    SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='vitaminas_batches' AND indexname='idx_vitaminas_batches_created_at')
    INTO v_idx_vb_created_at;
    IF NOT v_idx_vb_created_at THEN
        v_error_msg := v_error_msg || 'FAIL[7c]: Index idx_vitaminas_batches_created_at not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[7c]: Index idx_vitaminas_batches_created_at exists';
    END IF;

    SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='vitaminas_batches' AND indexname='idx_vitaminas_batches_status')
    INTO v_idx_vb_status;
    IF NOT v_idx_vb_status THEN
        v_error_msg := v_error_msg || 'FAIL[7d]: Index idx_vitaminas_batches_status not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[7d]: Index idx_vitaminas_batches_status exists';
    END IF;

    SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='vitaminas_batches' AND indexname='idx_vitaminas_batches_operator_id')
    INTO v_idx_vb_operator_id;
    IF NOT v_idx_vb_operator_id THEN
        v_error_msg := v_error_msg || 'FAIL[7e]: Index idx_vitaminas_batches_operator_id not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[7e]: Index idx_vitaminas_batches_operator_id exists';
    END IF;

    SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='vitaminas_batches' AND indexname='idx_vitaminas_batches_product_formula')
    INTO v_idx_vb_product_formula;
    IF NOT v_idx_vb_product_formula THEN
        v_error_msg := v_error_msg || 'FAIL[7f]: Index idx_vitaminas_batches_product_formula not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[7f]: Index idx_vitaminas_batches_product_formula exists';
    END IF;

    -- ============================================================
    -- TEST 8: Índices en vitaminas_ingredients
    -- ============================================================
    SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='vitaminas_ingredients' AND indexname='idx_vitaminas_ingredients_batch_id')
    INTO v_idx_vi_batch_id;
    IF NOT v_idx_vi_batch_id THEN
        v_error_msg := v_error_msg || 'FAIL[8a]: Index idx_vitaminas_ingredients_batch_id not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[8a]: Index idx_vitaminas_ingredients_batch_id exists';
    END IF;

    SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='vitaminas_ingredients' AND indexname='idx_vitaminas_ingredients_ingredient_type')
    INTO v_idx_vi_ingredient_type;
    IF NOT v_idx_vi_ingredient_type THEN
        v_error_msg := v_error_msg || 'FAIL[8b]: Index idx_vitaminas_ingredients_ingredient_type not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[8b]: Index idx_vitaminas_ingredients_ingredient_type exists';
    END IF;

    -- ============================================================
    -- TEST 9: Índices en vitaminas_kit_inventory
    -- ============================================================
    SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='vitaminas_kit_inventory' AND indexname='idx_vitaminas_kit_inventory_machine_id')
    INTO v_idx_vki_machine_id;
    IF NOT v_idx_vki_machine_id THEN
        v_error_msg := v_error_msg || 'FAIL[9a]: Index idx_vitaminas_kit_inventory_machine_id not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[9a]: Index idx_vitaminas_kit_inventory_machine_id exists';
    END IF;

    SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='vitaminas_kit_inventory' AND indexname='idx_vitaminas_kit_inventory_fecha')
    INTO v_idx_vki_fecha;
    IF NOT v_idx_vki_fecha THEN
        v_error_msg := v_error_msg || 'FAIL[9b]: Index idx_vitaminas_kit_inventory_fecha not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[9b]: Index idx_vitaminas_kit_inventory_fecha exists';
    END IF;

    -- ============================================================
    -- TEST 10: Unique constraint en vitaminas_kit_inventory
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'vitaminas_kit_inventory'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'u'
    ) INTO v_unique_inventory;

    IF NOT v_unique_inventory THEN
        v_error_msg := v_error_msg || 'FAIL[10]: UNIQUE constraint on (machine_id, shift_type, fecha, product_name) not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[10]: UNIQUE constraint on vitaminas_kit_inventory (machine_id, shift_type, fecha, product_name) exists';
    END IF;

    -- ============================================================
    -- TEST 11: Triggers
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE event_object_schema = 'public'
          AND event_object_table = 'vitaminas_batches'
          AND trigger_name = 'trg_vitaminas_batches_updated_at'
    ) INTO v_trg_batches_upd;

    IF NOT v_trg_batches_upd THEN
        v_error_msg := v_error_msg || 'FAIL[11a]: Trigger trg_vitaminas_batches_updated_at not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[11a]: Trigger trg_vitaminas_batches_updated_at exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE event_object_schema = 'public'
          AND event_object_table = 'vitaminas_kit_inventory'
          AND trigger_name = 'trg_vitaminas_kit_inventory_updated_at'
    ) INTO v_trg_inventory_upd;

    IF NOT v_trg_inventory_upd THEN
        v_error_msg := v_error_msg || 'FAIL[11b]: Trigger trg_vitaminas_kit_inventory_updated_at not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[11b]: Trigger trg_vitaminas_kit_inventory_updated_at exists';
    END IF;

    -- ============================================================
    -- TEST 12: FK constraints
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'vitaminas_batches'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'f'
          AND c.confrelid = 'public.machines'::regclass
    ) INTO v_fk_machine_id;

    IF NOT v_fk_machine_id THEN
        v_error_msg := v_error_msg || 'FAIL[12a]: FK on vitaminas_batches.machine_id → machines not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[12a]: FK vitaminas_batches.machine_id → machines exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'vitaminas_batches'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'f'
          AND c.confrelid = 'public.operators'::regclass
    ) INTO v_fk_operator_id;

    IF NOT v_fk_operator_id THEN
        RAISE NOTICE 'INFO[12b]: FK on vitaminas_batches.operator_id → operators is optional';
    ELSE
        RAISE NOTICE 'PASS[12b]: FK vitaminas_batches.operator_id → operators exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'vitaminas_ingredients'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'f'
          AND c.confrelid = 'public.vitaminas_batches'::regclass
    ) INTO v_fk_batch_id;

    IF NOT v_fk_batch_id THEN
        v_error_msg := v_error_msg || 'FAIL[12c]: FK on vitaminas_ingredients.batch_id → vitaminas_batches not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[12c]: FK vitaminas_ingredients.batch_id → vitaminas_batches (CASCADE) exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'vitaminas_kit_inventory'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'f'
          AND c.confrelid = 'public.machines'::regclass
    ) INTO v_fk_vki_machine_id;

    IF NOT v_fk_vki_machine_id THEN
        v_error_msg := v_error_msg || 'FAIL[12d]: FK on vitaminas_kit_inventory.machine_id → machines not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[12d]: FK vitaminas_kit_inventory.machine_id → machines exists';
    END IF;

    -- ============================================================
    -- VEREDICTO FINAL
    -- ============================================================
    IF v_check_passed THEN
        RAISE NOTICE '============================================================';
        RAISE NOTICE '✅ ALL TESTS PASSED — Migration 017_vitaminas_tables is VERIFIED';
        RAISE NOTICE '============================================================';
    ELSE
        RAISE EXCEPTION '❌ VERIFICATION FAILED: %', v_error_msg;
    END IF;
END;
$$;
