-- Verify: 022_plant_config
-- Verifica existencia de tabla plant_config, columnas, trigger y seed

DO $$
DECLARE
    v_table_exists   BOOLEAN;
    v_columns_ok     INT;
    v_trigger_exists BOOLEAN;
    v_seed_value     TEXT;
    v_check_passed   BOOLEAN := TRUE;
    v_error_msg      TEXT := '';
BEGIN

    -- ============================================================
    -- TEST 1: Tabla existe
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'plant_config'
    ) INTO v_table_exists;

    IF NOT v_table_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R1]: Table public.plant_config does not exist. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R1]: Table public.plant_config exists';
    END IF;

    -- ============================================================
    -- TEST 2: Columnas correctas
    -- ============================================================
    SELECT COUNT(*) INTO v_columns_ok
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'plant_config'
      AND column_name IN ('key', 'value', 'description', 'updated_at');

    IF v_columns_ok != 4 THEN
        v_error_msg := v_error_msg || 'FAIL[R2]: Expected 4 columns (key, value, description, updated_at), found ' || v_columns_ok || '. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R2]: All 4 columns exist (key, value, description, updated_at)';
    END IF;

    -- ============================================================
    -- TEST 3: key es PRIMARY KEY
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'plant_config'
          AND tc.constraint_type = 'PRIMARY KEY'
          AND kcu.column_name = 'key'
    ) INTO v_table_exists;

    IF NOT v_table_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R3]: key is not PRIMARY KEY. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R3]: key is PRIMARY KEY';
    END IF;

    -- ============================================================
    -- TEST 4: Trigger de updated_at existe
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE event_object_table = 'plant_config'
          AND trigger_name = 'trg_plant_config_updated_at'
    ) INTO v_trigger_exists;

    IF NOT v_trigger_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R4]: Trigger trg_plant_config_updated_at missing. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R4]: Trigger trg_plant_config_updated_at exists';
    END IF;

    -- ============================================================
    -- TEST 5: Seed existe
    -- ============================================================
    SELECT value INTO v_seed_value
    FROM public.plant_config
    WHERE key = 'micro_stop_threshold_min';

    IF v_seed_value IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[R5]: Seed micro_stop_threshold_min not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R5]: Seed micro_stop_threshold_min = %', v_seed_value;
    END IF;

    -- ============================================================
    -- VEREDICTO FINAL
    -- ============================================================
    IF v_check_passed THEN
        RAISE NOTICE '============================================================';
        RAISE NOTICE '✅ ALL TESTS PASSED — Migration 022_plant_config VERIFIED';
        RAISE NOTICE '   Table: plant_config ✓';
        RAISE NOTICE '   Columns: 4/4 ✓';
        RAISE NOTICE '   PK: key ✓';
        RAISE NOTICE '   Trigger: trg_plant_config_updated_at ✓';
        RAISE NOTICE '   Seed: micro_stop_threshold_min = % ✓', v_seed_value;
        RAISE NOTICE '============================================================';
    ELSE
        RAISE EXCEPTION '❌ VERIFICATION FAILED: %', v_error_msg;
    END IF;
END;
$$;
