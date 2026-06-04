-- Verify: 020_quality_rls
-- Verifica que RLS esté activo en las 3 tablas de calidad con las políticas correctas

DO $$
DECLARE
    v_rls_enabled        BOOLEAN;
    v_col_count          INT;
    v_idx_count          INT;
    v_trg_count          INT;
    v_func_line_access   BOOLEAN;
    v_func_insp_access   BOOLEAN;
    v_func_sync_qi       BOOLEAN;
    v_func_sync_dl       BOOLEAN;
    v_func_sync_wl       BOOLEAN;
    v_policy_count       INT;
    v_check_passed       BOOLEAN := TRUE;
    v_error_msg          TEXT := '';
BEGIN

    -- ============================================================
    -- TEST 1: line_id column exists in all 3 tables (NOT NULL)
    -- ============================================================
    SELECT COUNT(*) INTO v_col_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('quality_inspections', 'defect_logs', 'weight_logs')
      AND column_name = 'line_id'
      AND is_nullable = 'NO';

    IF v_col_count != 3 THEN
        v_error_msg := v_error_msg || 'FAIL[R1]: Expected 3 NOT NULL line_id columns, found ' || v_col_count || '. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R1]: line_id column exists (NOT NULL) in all 3 quality tables';
    END IF;

    -- ============================================================
    -- TEST 2: Indexes on line_id
    -- ============================================================
    SELECT COUNT(*) INTO v_idx_count
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN ('quality_inspections', 'defect_logs', 'weight_logs')
      AND indexname IN ('idx_quality_inspections_line_id', 'idx_defect_logs_line_id', 'idx_weight_logs_line_id');

    IF v_idx_count != 3 THEN
        v_error_msg := v_error_msg || 'FAIL[R2]: Expected 3 line_id indexes, found ' || v_idx_count || '. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R2]: All 3 line_id indexes exist';
    END IF;

    -- ============================================================
    -- TEST 3: Triggers
    -- ============================================================
    SELECT COUNT(*) INTO v_trg_count
    FROM information_schema.triggers
    WHERE event_object_table IN ('quality_inspections', 'defect_logs', 'weight_logs')
      AND trigger_name IN (
        'trg_quality_inspections_sync_line_id',
        'trg_defect_logs_sync_line_id',
        'trg_weight_logs_sync_line_id'
      );

    IF v_trg_count != 3 THEN
        v_error_msg := v_error_msg || 'FAIL[R3]: Expected 3 sync triggers, found ' || v_trg_count || '. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R3]: All 3 sync triggers exist';
    END IF;

    -- ============================================================
    -- TEST 4: Functions
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'user_has_line_access'
    ) INTO v_func_line_access;

    SELECT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'user_has_inspection_access'
    ) INTO v_func_insp_access;

    SELECT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname IN ('sync_quality_inspections_line_id', 'sync_defect_logs_line_id', 'sync_weight_logs_line_id')
    ) INTO v_func_sync_qi;
    -- Note: the above is incorrect for counting, let me do it properly

    IF NOT v_func_line_access THEN
        v_error_msg := v_error_msg || 'FAIL[R4a]: user_has_line_access() missing. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R4a]: user_has_line_access() exists';
    END IF;

    IF NOT v_func_insp_access THEN
        v_error_msg := v_error_msg || 'FAIL[R4b]: user_has_inspection_access() missing. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R4b]: user_has_inspection_access() exists';
    END IF;

    -- Verificar 3 funciones de sync
    SELECT COUNT(*) = 3 INTO v_func_sync_qi
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN ('sync_quality_inspections_line_id', 'sync_defect_logs_line_id', 'sync_weight_logs_line_id');

    IF NOT v_func_sync_qi THEN
        v_error_msg := v_error_msg || 'FAIL[R4c]: Expected 3 sync functions, missing one or more. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R4c]: All 3 sync functions exist';
    END IF;

    -- ============================================================
    -- TEST 5: RLS enabled on all 3 tables
    -- ============================================================
    SELECT COUNT(*) INTO v_col_count
    FROM pg_class
    WHERE relname IN ('quality_inspections', 'defect_logs', 'weight_logs')
      AND relnamespace = 'public'::regnamespace
      AND relrowse = true;

    IF v_col_count != 3 THEN
        v_error_msg := v_error_msg || 'FAIL[R5]: RLS not enabled on all 3 tables (found ' || v_col_count || '). ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R5]: RLS enabled on quality_inspections, defect_logs, weight_logs';
    END IF;

    -- ============================================================
    -- TEST 6: Policies exist (minimum 6: 3 select + 3 insert)
    -- ============================================================
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('quality_inspections', 'defect_logs', 'weight_logs');

    IF v_policy_count < 6 THEN
        v_error_msg := v_error_msg || 'FAIL[R6]: Expected >= 6 policies, found ' || v_policy_count || '. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R6]: % total policies across quality tables', v_policy_count;
    END IF;

    -- ============================================================
    -- VEREDICTO FINAL
    -- ============================================================
    IF v_check_passed THEN
        RAISE NOTICE '============================================================';
        RAISE NOTICE '✅ ALL TESTS PASSED — Migration 020_quality_rls VERIFIED';
        RAISE NOTICE '   Columns: line_id (3/3) ✓';
        RAISE NOTICE '   Indexes: 3/3 ✓';
        RAISE NOTICE '   Triggers: 3/3 ✓';
        RAISE NOTICE '   Functions: user_has_line_access ✓, user_has_inspection_access ✓, 3 sync ✓';
        RAISE NOTICE '   RLS: 3/3 tables ✓';
        RAISE NOTICE '   Policies: % total ✓', v_policy_count;
        RAISE NOTICE '============================================================';
    ELSE
        RAISE EXCEPTION '❌ VERIFICATION FAILED: %', v_error_msg;
    END IF;
END;
$$;
