-- Verify: 025_work_orders_cmms_integration
-- Verifica existencia de las nuevas columnas, índice y nulabilidad

DO $$
DECLARE
    v_column_exists   BOOLEAN;
    v_is_nullable     BOOLEAN;
    v_index_exists    BOOLEAN;
    v_columns_found   INT := 0;
    v_check_passed    BOOLEAN := TRUE;
    v_error_msg       TEXT := '';
BEGIN

    -- ============================================================
    -- TEST 1-7: Cada columna existe y es NULLable
    -- ============================================================

    -- lifecycle_phase
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'work_orders'
          AND column_name = 'lifecycle_phase'
    ) INTO v_column_exists;

    IF NOT v_column_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R1]: Column lifecycle_phase does not exist. ';
        v_check_passed := FALSE;
    ELSE
        SELECT is_nullable = 'YES' INTO v_is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'work_orders'
          AND column_name = 'lifecycle_phase';

        IF NOT v_is_nullable THEN
            v_error_msg := v_error_msg || 'FAIL[R1a]: lifecycle_phase is NOT NULL. ';
            v_check_passed := FALSE;
        ELSE
            v_columns_found := v_columns_found + 1;
            RAISE NOTICE 'PASS[R1]: lifecycle_phase TEXT NULL ✓';
        END IF;
    END IF;

    -- symptom_note
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'work_orders'
          AND column_name = 'symptom_note'
    ) INTO v_column_exists;

    IF NOT v_column_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R2]: Column symptom_note does not exist. ';
        v_check_passed := FALSE;
    ELSE
        SELECT is_nullable = 'YES' INTO v_is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'work_orders'
          AND column_name = 'symptom_note';

        IF NOT v_is_nullable THEN
            v_error_msg := v_error_msg || 'FAIL[R2a]: symptom_note is NOT NULL. ';
            v_check_passed := FALSE;
        ELSE
            v_columns_found := v_columns_found + 1;
            RAISE NOTICE 'PASS[R2]: symptom_note TEXT NULL ✓';
        END IF;
    END IF;

    -- cause_note
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'work_orders'
          AND column_name = 'cause_note'
    ) INTO v_column_exists;

    IF NOT v_column_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R3]: Column cause_note does not exist. ';
        v_check_passed := FALSE;
    ELSE
        SELECT is_nullable = 'YES' INTO v_is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'work_orders'
          AND column_name = 'cause_note';

        IF NOT v_is_nullable THEN
            v_error_msg := v_error_msg || 'FAIL[R3a]: cause_note is NOT NULL. ';
            v_check_passed := FALSE;
        ELSE
            v_columns_found := v_columns_found + 1;
            RAISE NOTICE 'PASS[R3]: cause_note TEXT NULL ✓';
        END IF;
    END IF;

    -- action_note
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'work_orders'
          AND column_name = 'action_note'
    ) INTO v_column_exists;

    IF NOT v_column_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R4]: Column action_note does not exist. ';
        v_check_passed := FALSE;
    ELSE
        SELECT is_nullable = 'YES' INTO v_is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'work_orders'
          AND column_name = 'action_note';

        IF NOT v_is_nullable THEN
            v_error_msg := v_error_msg || 'FAIL[R4a]: action_note is NOT NULL. ';
            v_check_passed := FALSE;
        ELSE
            v_columns_found := v_columns_found + 1;
            RAISE NOTICE 'PASS[R4]: action_note TEXT NULL ✓';
        END IF;
    END IF;

    -- actual_start_at
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'work_orders'
          AND column_name = 'actual_start_at'
    ) INTO v_column_exists;

    IF NOT v_column_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R5]: Column actual_start_at does not exist. ';
        v_check_passed := FALSE;
    ELSE
        SELECT is_nullable = 'YES' INTO v_is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'work_orders'
          AND column_name = 'actual_start_at';

        IF NOT v_is_nullable THEN
            v_error_msg := v_error_msg || 'FAIL[R5a]: actual_start_at is NOT NULL. ';
            v_check_passed := FALSE;
        ELSE
            v_columns_found := v_columns_found + 1;
            RAISE NOTICE 'PASS[R5]: actual_start_at TIMESTAMPTZ NULL ✓';
        END IF;
    END IF;

    -- completed_at
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'work_orders'
          AND column_name = 'completed_at'
    ) INTO v_column_exists;

    IF NOT v_column_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R6]: Column completed_at does not exist. ';
        v_check_passed := FALSE;
    ELSE
        SELECT is_nullable = 'YES' INTO v_is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'work_orders'
          AND column_name = 'completed_at';

        IF NOT v_is_nullable THEN
            v_error_msg := v_error_msg || 'FAIL[R6a]: completed_at is NOT NULL. ';
            v_check_passed := FALSE;
        ELSE
            v_columns_found := v_columns_found + 1;
            RAISE NOTICE 'PASS[R6]: completed_at TIMESTAMPTZ NULL ✓';
        END IF;
    END IF;

    -- cmms_wo_id
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'work_orders'
          AND column_name = 'cmms_wo_id'
    ) INTO v_column_exists;

    IF NOT v_column_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R7]: Column cmms_wo_id does not exist. ';
        v_check_passed := FALSE;
    ELSE
        SELECT is_nullable = 'YES' INTO v_is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'work_orders'
          AND column_name = 'cmms_wo_id';

        IF NOT v_is_nullable THEN
            v_error_msg := v_error_msg || 'FAIL[R7a]: cmms_wo_id is NOT NULL. ';
            v_check_passed := FALSE;
        ELSE
            v_columns_found := v_columns_found + 1;
            RAISE NOTICE 'PASS[R7]: cmms_wo_id TEXT NULL ✓';
        END IF;
    END IF;

    -- ============================================================
    -- TEST 8: Índice idx_work_orders_cmms_wo_id existe
    -- ============================================================

    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'work_orders'
          AND indexname = 'idx_work_orders_cmms_wo_id'
    ) INTO v_index_exists;

    IF NOT v_index_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R8]: Index idx_work_orders_cmms_wo_id does not exist. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R8]: Index idx_work_orders_cmms_wo_id ✓';
    END IF;

    -- ============================================================
    -- VEREDICTO FINAL
    -- ============================================================

    IF v_check_passed THEN
        RAISE NOTICE '============================================================';
        RAISE NOTICE '✅ ALL TESTS PASSED — Migration 025_work_orders_cmms_integration VERIFIED';
        RAISE NOTICE '   Columns added: %/7 ✓', v_columns_found;
        RAISE NOTICE '   All columns NULLable ✓';
        RAISE NOTICE '   Index idx_work_orders_cmms_wo_id ✓';
        RAISE NOTICE '============================================================';
    ELSE
        RAISE EXCEPTION '❌ VERIFICATION FAILED: %', v_error_msg;
    END IF;
END;
$$;
