-- Verify: 026_work_orders_cmms_unique_constraint
-- Verifica que la restricción UNIQUE exista sobre cmms_wo_id

DO $$
DECLARE
    v_constraint_exists BOOLEAN;
    v_columns           TEXT;
    v_check_passed      BOOLEAN := TRUE;
    v_error_msg         TEXT := '';
BEGIN

    -- ============================================================
    -- TEST 1: Restricción UNIQUE existe
    -- ============================================================

    SELECT EXISTS (
        SELECT 1
        FROM pg_constraint pc
        JOIN pg_class tc ON pc.conrelid = tc.oid
        WHERE tc.relname = 'work_orders'
          AND pc.conname = 'work_orders_cmms_wo_id_key'
          AND pc.contype = 'u'
    ) INTO v_constraint_exists;

    IF NOT v_constraint_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R1]: UNIQUE constraint work_orders_cmms_wo_id_key does not exist. ';
        v_check_passed := FALSE;
    ELSE
        -- Verificar que la restricción está sobre cmms_wo_id
        SELECT string_agg(a.attname, ', ' ORDER BY a.attnum)
        INTO v_columns
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'work_orders'::regclass
          AND i.indisunique
          AND i.indisprimary = FALSE
          AND EXISTS (
              SELECT 1 FROM pg_constraint pc
              WHERE pc.conrelid = i.indrelid
                AND pc.conname = 'work_orders_cmms_wo_id_key'
                AND pc.contype = 'u'
                AND pc.conindid = i.indexrelid
          );

        IF v_columns = 'cmms_wo_id' THEN
            RAISE NOTICE 'PASS[R1]: UNIQUE constraint work_orders_cmms_wo_id_key on (cmms_wo_id) ✓';
        ELSE
            v_error_msg := v_error_msg || 'FAIL[R1a]: Constraint is not on cmms_wo_id (found: ' || COALESCE(v_columns, 'NULL') || '). ';
            v_check_passed := FALSE;
        END IF;
    END IF;

    -- ============================================================
    -- VEREDICTO FINAL
    -- ============================================================

    IF v_check_passed THEN
        RAISE NOTICE '============================================================';
        RAISE NOTICE '✅ ALL TESTS PASSED — Migration 026_work_orders_cmms_unique_constraint VERIFIED';
        RAISE NOTICE '   UNIQUE constraint on (cmms_wo_id) ✓';
        RAISE NOTICE '============================================================';
    ELSE
        RAISE EXCEPTION '❌ VERIFICATION FAILED: %', v_error_msg;
    END IF;
END;
$$;
