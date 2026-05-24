-- Verify: 013_shift_sessions_planned_boxes
-- Verifica que las columnas planned_boxes y product_code existan en shift_sessions
-- con los tipos correctos, y que los 3 índices analíticos estén presentes.

DO $$
DECLARE
    v_col_planned_type TEXT;
    v_col_product_type TEXT;
    v_idx_oee BOOLEAN;
    v_idx_reports BOOLEAN;
    v_idx_telemetry BOOLEAN;
    v_check_passed BOOLEAN := TRUE;
    v_error_msg TEXT := '';
BEGIN
    -- ============================================================
    -- TEST 1: La columna planned_boxes existe y es INTEGER
    -- ============================================================
    SELECT data_type INTO v_col_planned_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shift_sessions'
      AND column_name = 'planned_boxes';

    IF v_col_planned_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1]: Column planned_boxes does not exist on public.shift_sessions. ';
        v_check_passed := FALSE;
    ELSIF v_col_planned_type NOT IN ('integer', 'int4', 'int') THEN
        v_error_msg := v_error_msg || 'FAIL[1]: planned_boxes has type ' || v_col_planned_type || ' (expected INTEGER). ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1]: planned_boxes exists with type %', v_col_planned_type;
    END IF;

    -- ============================================================
    -- TEST 2: La columna product_code existe y es VARCHAR(50)
    -- ============================================================
    SELECT data_type, COALESCE(character_maximum_length::TEXT, 'none')
    INTO v_col_product_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shift_sessions'
      AND column_name = 'product_code';

    IF v_col_product_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[2]: Column product_code does not exist on public.shift_sessions. ';
        v_check_passed := FALSE;
    ELSIF v_col_product_type NOT LIKE 'character varying%' AND v_col_product_type NOT LIKE 'varchar%' THEN
        v_error_msg := v_error_msg || 'FAIL[2]: product_code has type ' || v_col_product_type || ' (expected VARCHAR). ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[2]: product_code exists with type character varying';
    END IF;

    -- ============================================================
    -- TEST 3: Índice idx_oee_events_started_at existe
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'oee_events'
          AND indexname = 'idx_oee_events_started_at'
    ) INTO v_idx_oee;

    IF NOT v_idx_oee THEN
        v_error_msg := v_error_msg || 'FAIL[3]: Index idx_oee_events_started_at not found on oee_events. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[3]: Index idx_oee_events_started_at exists on oee_events';
    END IF;

    -- ============================================================
    -- TEST 4: Índice idx_reports_created_at existe
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'reports'
          AND indexname = 'idx_reports_created_at'
    ) INTO v_idx_reports;

    IF NOT v_idx_reports THEN
        v_error_msg := v_error_msg || 'FAIL[4]: Index idx_reports_created_at not found on reports. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[4]: Index idx_reports_created_at exists on reports';
    END IF;

    -- ============================================================
    -- TEST 5: Índice idx_telemetry_raw_received_at existe
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'telemetry_raw_staging'
          AND indexname = 'idx_telemetry_raw_received_at'
    ) INTO v_idx_telemetry;

    IF NOT v_idx_telemetry THEN
        v_error_msg := v_error_msg || 'FAIL[5]: Index idx_telemetry_raw_received_at not found on telemetry_raw_staging. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[5]: Index idx_telemetry_raw_received_at exists on telemetry_raw_staging';
    END IF;

    -- ============================================================
    -- TEST 6: planned_boxes es NULLable (opcional)
    -- ============================================================
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'shift_sessions'
          AND column_name = 'planned_boxes'
          AND is_nullable = 'NO'
    ) THEN
        v_error_msg := v_error_msg || 'FAIL[6]: planned_boxes should be NULLABLE. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[6]: planned_boxes is NULLABLE (opcional hasta que Epicor alimente el dato)';
    END IF;

    -- ============================================================
    -- VEREDICTO FINAL
    -- ============================================================
    IF v_check_passed THEN
        RAISE NOTICE '============================================================';
        RAISE NOTICE '✅ ALL TESTS PASSED — Migration 013_shift_sessions_planned_boxes is VERIFIED';
        RAISE NOTICE '============================================================';
    ELSE
        RAISE EXCEPTION '❌ VERIFICATION FAILED: %', v_error_msg;
    END IF;
END;
$$;
