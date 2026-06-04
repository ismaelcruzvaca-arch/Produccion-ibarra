-- Verify: 023_downtime_conciliation
-- Verifica existencia de tabla, columnas, índices, funciones y triggers

DO $$
DECLARE
    v_table_exists     BOOLEAN;
    v_column_count     INT;
    v_pk_exists        BOOLEAN;
    v_index_count      INT;
    v_trigger_count    INT;
    v_func_exists      BOOLEAN;
    v_check_passed     BOOLEAN := TRUE;
    v_error_msg        TEXT := '';
BEGIN

    -- ============================================================
    -- TEST 1: Tabla existe
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'downtime_conciliation'
    ) INTO v_table_exists;

    IF NOT v_table_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R1]: Table public.downtime_conciliation does not exist. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R1]: Table public.downtime_conciliation exists';
    END IF;

    -- ============================================================
    -- TEST 2: Columnas esperadas (mínimo 18)
    -- ============================================================
    SELECT COUNT(*) INTO v_column_count
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'downtime_conciliation';

    IF v_column_count < 18 THEN
        v_error_msg := v_error_msg || 'FAIL[R2]: Expected >= 18 columns, found ' || v_column_count || '. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R2]: % columns found (>= 18 required)', v_column_count;
    END IF;

    -- ============================================================
    -- TEST 3: PRIMARY KEY exists
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'downtime_conciliation'
          AND tc.constraint_type = 'PRIMARY KEY'
    ) INTO v_pk_exists;

    IF NOT v_pk_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R3]: PRIMARY KEY missing. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R3]: PRIMARY KEY exists';
    END IF;

    -- ============================================================
    -- TEST 4: Al menos 3 índices
    -- ============================================================
    SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes
    WHERE tablename = 'downtime_conciliation'
      AND schemaname = 'public';

    IF v_index_count < 3 THEN
        v_error_msg := v_error_msg || 'FAIL[R4]: Expected >= 3 indexes, found ' || v_index_count || '. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R4]: % indexes found', v_index_count;
    END IF;

    -- ============================================================
    -- TEST 5: enqueue_oee_mtto_trigger function exists
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'enqueue_oee_mtto_trigger'
    ) INTO v_func_exists;

    IF NOT v_func_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R5]: enqueue_oee_mtto_trigger() function missing. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R5]: enqueue_oee_mtto_trigger() function exists';
    END IF;

    -- ============================================================
    -- TEST 6: Triggers (updated_at + insert_mtto + reconciled_mtto)
    -- ============================================================
    SELECT COUNT(*) INTO v_trigger_count
    FROM information_schema.triggers
    WHERE event_object_table = 'downtime_conciliation';

    IF v_trigger_count < 3 THEN
        v_error_msg := v_error_msg || 'FAIL[R6]: Expected >= 3 triggers, found ' || v_trigger_count || '. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R6]: % triggers found', v_trigger_count;
    END IF;

    -- ============================================================
    -- VEREDICTO FINAL
    -- ============================================================
    IF v_check_passed THEN
        RAISE NOTICE '============================================================';
        RAISE NOTICE '✅ ALL TESTS PASSED — Migration 023_downtime_conciliation VERIFIED';
        RAISE NOTICE '   Table: downtime_conciliation ✓';
        RAISE NOTICE '   Columns: % ✓', v_column_count;
        RAISE NOTICE '   PK: ✓';
        RAISE NOTICE '   Indexes: % ✓', v_index_count;
        RAISE NOTICE '   Function: enqueue_oee_mtto_trigger ✓';
        RAISE NOTICE '   Triggers: % ✓', v_trigger_count;
        RAISE NOTICE '============================================================';
    ELSE
        RAISE EXCEPTION '❌ VERIFICATION FAILED: %', v_error_msg;
    END IF;
END;
$$;
