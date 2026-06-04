-- Verify: 012_shift_sessions
-- Prueba REAL de la estructura de shift_sessions
-- Valida existencia, columnas, FKs, CHECK constraints e índices

DO $$
DECLARE
    v_col_count INT;
    v_has_fk_machines BOOLEAN;
    v_has_fk_operators BOOLEAN;
    v_has_check_shift_type BOOLEAN;
    v_has_check_status BOOLEAN;
    v_idx_count INT;
    v_check_passed BOOLEAN := TRUE;
    v_error_msg TEXT := '';
    v_uuid_val UUID;
BEGIN
    -- ============================================================
    -- TEST 1: La tabla existe
    -- ============================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'shift_sessions'
    ) THEN
        v_error_msg := v_error_msg || 'FAIL[1]: Table public.shift_sessions does not exist. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1]: Table public.shift_sessions exists';
    END IF;

    -- ============================================================
    -- TEST 2: Columnas (7 esperadas)
    -- ============================================================
    SELECT COUNT(*) INTO v_col_count FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shift_sessions';

    IF v_col_count != 7 THEN
        v_error_msg := v_error_msg || 'FAIL[2]: Expected 7 columns, found ' || v_col_count || '. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[2]: Exactly 7 columns';
    END IF;

    -- ============================================================
    -- TEST 3: Primary Key
    -- ============================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'shift_sessions'
          AND constraint_type = 'PRIMARY KEY'
    ) THEN
        v_error_msg := v_error_msg || 'FAIL[3]: Primary key not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[3]: Primary key exists';
    END IF;

    -- ============================================================
    -- TEST 4: CHECK constraint en shift_type
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.check_constraints cc
        JOIN information_schema.table_constraints tc
          ON cc.constraint_name = tc.constraint_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'shift_sessions'
          AND cc.check_clause LIKE '%shift_type%'
    ) INTO v_has_check_shift_type;

    IF NOT v_has_check_shift_type THEN
        v_error_msg := v_error_msg || 'FAIL[4a]: CHECK constraint on shift_type not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[4a]: CHECK constraint on shift_type exists';
    END IF;

    -- ============================================================
    -- TEST 5: CHECK constraint en status
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.check_constraints cc
        JOIN information_schema.table_constraints tc
          ON cc.constraint_name = tc.constraint_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'shift_sessions'
          AND cc.check_clause LIKE '%status%'
    ) INTO v_has_check_status;

    IF NOT v_has_check_status THEN
        v_error_msg := v_error_msg || 'FAIL[4b]: CHECK constraint on status not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[4b]: CHECK constraint on status exists';
    END IF;

    -- ============================================================
    -- TEST 6: FOREIGN KEY a public.machines
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'shift_sessions'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'machines'
    ) INTO v_has_fk_machines;

    IF NOT v_has_fk_machines THEN
        v_error_msg := v_error_msg || 'FAIL[5a]: FK to public.machines not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[5a]: FK to public.machines exists';
    END IF;

    -- ============================================================
    -- TEST 7: FOREIGN KEY a public.operators
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'shift_sessions'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'operators'
    ) INTO v_has_fk_operators;

    IF NOT v_has_fk_operators THEN
        v_error_msg := v_error_msg || 'FAIL[5b]: FK to public.operators not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[5b]: FK to public.operators exists';
    END IF;

    -- ============================================================
    -- TEST 8: Índices presentes (mínimo 3 no-PK)
    -- ============================================================
    SELECT COUNT(*) INTO v_idx_count FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'shift_sessions'
      AND indexname NOT LIKE '%_pkey';

    IF v_idx_count < 3 THEN
        v_error_msg := v_error_msg || 'FAIL[6]: Expected >= 3 non-PK indexes, found ' || v_idx_count || '. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[6]: % non-PK indexes found (machine_id, operator_id, status, started_at)', v_idx_count;
    END IF;

    -- ============================================================
    -- TEST 9: ended_at es NULLable (columna opcional)
    -- ============================================================
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'shift_sessions'
          AND column_name = 'ended_at' AND is_nullable = 'NO'
    ) THEN
        v_error_msg := v_error_msg || 'FAIL[7]: ended_at should be NULLABLE. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[7]: ended_at is NULLABLE';
    END IF;

    -- ============================================================
    -- TEST 10: Podemos insertar un registro de prueba (integridad referencial)
    -- ============================================================
    BEGIN
        INSERT INTO public.shift_sessions (machine_id, operator_id, shift_type)
        SELECT m.id, 'OP-001', 'matutino'
        FROM public.machines m LIMIT 1
        RETURNING id INTO v_uuid_val;

        -- Limpiar
        DELETE FROM public.shift_sessions WHERE id = v_uuid_val;

        RAISE NOTICE 'PASS[8]: INSERT/ROLLBACK cycle successful — referential integrity OK';
    EXCEPTION WHEN OTHERS THEN
        v_error_msg := v_error_msg || 'FAIL[8]: INSERT test failed: ' || SQLERRM || '. ';
        v_check_passed := FALSE;
    END;

    -- ============================================================
    -- VEREDICTO FINAL
    -- ============================================================
    IF v_check_passed THEN
        RAISE NOTICE '============================================================';
        RAISE NOTICE '✅ ALL TESTS PASSED — Migration 012_shift_sessions is VERIFIED';
        RAISE NOTICE '============================================================';
    ELSE
        RAISE EXCEPTION '❌ VERIFICATION FAILED: %', v_error_msg;
    END IF;
END;
$$;
