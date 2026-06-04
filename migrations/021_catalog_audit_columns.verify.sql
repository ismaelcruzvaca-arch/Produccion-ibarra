-- Verify: 021_catalog_audit_columns
-- Verifica que existan las columnas de auditoría y triggers en las 5 tablas

DO $$
DECLARE
    v_col_count       INT;
    v_trg_count       INT;
    v_func_exists     BOOLEAN;
    v_check_passed    BOOLEAN := TRUE;
    v_error_msg       TEXT := '';
BEGIN

    -- ============================================================
    -- TEST 1: Columnas en todas las tablas (5 tablas x 3 columnas = 15)
    -- ============================================================
    SELECT COUNT(*) INTO v_col_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('stop_reasons', 'lines', 'machines', 'products', 'shifts')
      AND column_name IN ('created_at', 'updated_at', 'updated_by');

    IF v_col_count != 15 THEN
        v_error_msg := v_error_msg || 'FAIL[R1]: Expected 15 audit columns (5x3), found ' || v_col_count || '. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R1]: All 15 audit columns exist (5 tables x 3 columns)';
    END IF;

    -- ============================================================
    -- TEST 2: created_at NOT NULL
    -- ============================================================
    SELECT COUNT(*) INTO v_col_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('stop_reasons', 'lines', 'machines', 'products', 'shifts')
      AND column_name = 'created_at'
      AND is_nullable = 'NO';

    IF v_col_count != 5 THEN
        v_error_msg := v_error_msg || 'FAIL[R2]: Expected 5 NOT NULL created_at, found ' || v_col_count || '. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R2]: created_at NOT NULL in all 5 tables';
    END IF;

    -- ============================================================
    -- TEST 3: updated_at NOT NULL
    -- ============================================================
    SELECT COUNT(*) INTO v_col_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('stop_reasons', 'lines', 'machines', 'products', 'shifts')
      AND column_name = 'updated_at'
      AND is_nullable = 'NO';

    IF v_col_count != 5 THEN
        v_error_msg := v_error_msg || 'FAIL[R3]: Expected 5 NOT NULL updated_at, found ' || v_col_count || '. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R3]: updated_at NOT NULL in all 5 tables';
    END IF;

    -- ============================================================
    -- TEST 4: updated_by nullable (puede ser NULL hasta que alguien modifique)
    -- ============================================================
    SELECT COUNT(*) INTO v_col_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('stop_reasons', 'lines', 'machines', 'products', 'shifts')
      AND column_name = 'updated_by'
      AND is_nullable = 'YES';

    IF v_col_count != 5 THEN
        v_error_msg := v_error_msg || 'FAIL[R4]: Expected 5 nullable updated_by, found ' || v_col_count || '. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R4]: updated_by nullable in all 5 tables';
    END IF;

    -- ============================================================
    -- TEST 5: Trigger function exists
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'update_catalog_timestamp'
    ) INTO v_func_exists;

    IF NOT v_func_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R5]: update_catalog_timestamp() function missing. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R5]: update_catalog_timestamp() function exists';
    END IF;

    -- ============================================================
    -- TEST 6: Triggers en las 5 tablas
    -- ============================================================
    SELECT COUNT(*) INTO v_trg_count
    FROM information_schema.triggers
    WHERE event_object_table IN ('stop_reasons', 'lines', 'machines', 'products', 'shifts')
      AND trigger_name IN (
        'trg_stop_reasons_updated_at', 'trg_lines_updated_at', 'trg_machines_updated_at',
        'trg_products_updated_at', 'trg_shifts_updated_at'
      );

    IF v_trg_count != 5 THEN
        v_error_msg := v_error_msg || 'FAIL[R6]: Expected 5 triggers, found ' || v_trg_count || '. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R6]: All 5 auto-update triggers exist';
    END IF;

    -- ============================================================
    -- VEREDICTO FINAL
    -- ============================================================
    IF v_check_passed THEN
        RAISE NOTICE '============================================================';
        RAISE NOTICE '✅ ALL TESTS PASSED — Migration 021_catalog_audit_columns VERIFIED';
        RAISE NOTICE '   Columns: 15/15 ✓';
        RAISE NOTICE '   Function: update_catalog_timestamp ✓';
        RAISE NOTICE '   Triggers: 5/5 ✓';
        RAISE NOTICE '============================================================';
    ELSE
        RAISE EXCEPTION '❌ VERIFICATION FAILED: %', v_error_msg;
    END IF;
END;
$$;
