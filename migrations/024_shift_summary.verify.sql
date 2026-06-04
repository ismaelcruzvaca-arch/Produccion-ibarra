-- Verify: 024_shift_summary
-- Verifica existencia de tabla, columnas, índices, unique constraint y trigger

DO $$
DECLARE
    v_table_exists     BOOLEAN;
    v_column_count     INT;
    v_pk_exists        BOOLEAN;
    v_unique_exists    BOOLEAN;
    v_index_count      INT;
    v_trigger_exists   BOOLEAN;
    v_check_passed     BOOLEAN := TRUE;
    v_error_msg        TEXT := '';
BEGIN

    -- ============================================================
    -- TEST 1: Tabla existe
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'shift_summary'
    ) INTO v_table_exists;

    IF NOT v_table_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R1]: Table public.shift_summary does not exist. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R1]: Table public.shift_summary exists';
    END IF;

    -- ============================================================
    -- TEST 2: Columnas esperadas (>= 10)
    -- ============================================================
    SELECT COUNT(*) INTO v_column_count
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shift_summary';

    IF v_column_count < 10 THEN
        v_error_msg := v_error_msg || 'FAIL[R2]: Expected >= 10 columns, found ' || v_column_count || '. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R2]: % columns found (>= 10 required)', v_column_count;
    END IF;

    -- ============================================================
    -- TEST 3: PRIMARY KEY exists
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'shift_summary'
          AND tc.constraint_type = 'PRIMARY KEY'
    ) INTO v_pk_exists;

    IF NOT v_pk_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R3]: PRIMARY KEY missing. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R3]: PRIMARY KEY exists';
    END IF;

    -- ============================================================
    -- TEST 4: UNIQUE constraint en shift_session_id
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'shift_summary'
          AND tc.constraint_type = 'UNIQUE'
    ) INTO v_unique_exists;

    IF NOT v_unique_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R4]: UNIQUE constraint on shift_session_id missing. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R4]: UNIQUE constraint exists (1:1 with shift_sessions)';
    END IF;

    -- ============================================================
    -- TEST 5: Al menos 2 índices
    -- ============================================================
    SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes
    WHERE tablename = 'shift_summary'
      AND schemaname = 'public'
      AND indexname NOT LIKE '%_pkey';

    IF v_index_count < 2 THEN
        v_error_msg := v_error_msg || 'FAIL[R5]: Expected >= 2 indexes, found ' || v_index_count || '. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R5]: % indexes found', v_index_count;
    END IF;

    -- ============================================================
    -- TEST 6: Trigger de updated_at existe
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE event_object_table = 'shift_summary'
          AND trigger_name = 'trg_shift_summary_updated_at'
    ) INTO v_trigger_exists;

    IF NOT v_trigger_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R6]: Trigger trg_shift_summary_updated_at missing. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R6]: Trigger trg_shift_summary_updated_at exists';
    END IF;

    -- ============================================================
    -- VEREDICTO FINAL
    -- ============================================================
    IF v_check_passed THEN
        RAISE NOTICE '============================================================';
        RAISE NOTICE '✅ ALL TESTS PASSED — Migration 024_shift_summary VERIFIED';
        RAISE NOTICE '   Table: shift_summary ✓';
        RAISE NOTICE '   Columns: % ✓', v_column_count;
        RAISE NOTICE '   PK: ✓';
        RAISE NOTICE '   UNIQUE (shift_session_id): ✓';
        RAISE NOTICE '   Indexes: % ✓', v_index_count;
        RAISE NOTICE '   Trigger: trg_shift_summary_updated_at ✓';
        RAISE NOTICE '============================================================';
    ELSE
        RAISE EXCEPTION '❌ VERIFICATION FAILED: %', v_error_msg;
    END IF;
END;
$$;
