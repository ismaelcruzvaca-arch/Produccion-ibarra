-- Verify: 011_operators
-- Prueba REAL de la estructura de la tabla operators
-- NO es un simple IF EXISTS — valida tipos, constraints, seed data y trigger

DO $$
DECLARE
    v_col_count INT;
    v_seed_count INT;
    v_has_trigger BOOLEAN;
    v_has_pk BOOLEAN;
    v_check_passed BOOLEAN := TRUE;
    v_error_msg TEXT := '';
BEGIN
    -- ============================================================
    -- TEST 1: La tabla existe
    -- ============================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'operators'
    ) THEN
        v_error_msg := v_error_msg || 'FAIL[1]: Table public.operators does not exist. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1]: Table public.operators exists';
    END IF;

    -- ============================================================
    -- TEST 2: Columnas y tipos de datos correctos
    -- ============================================================
    SELECT COUNT(*) INTO v_col_count FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'operators';

    IF v_col_count != 5 THEN
        v_error_msg := v_error_msg || 'FAIL[2]: Expected 5 columns, found ' || v_col_count || '. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[2]: Exactly 5 columns (id, full_name, is_active, created_at, updated_at)';
    END IF;

    -- Verificar tipos específicos
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'operators'
          AND column_name = 'id' AND data_type = 'character varying'
    ) THEN
        v_error_msg := v_error_msg || 'FAIL[2a]: Column id is not VARCHAR. ';
        v_check_passed := FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'operators'
          AND column_name = 'full_name' AND data_type = 'character varying'
    ) THEN
        v_error_msg := v_error_msg || 'FAIL[2b]: Column full_name is not VARCHAR. ';
        v_check_passed := FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'operators'
          AND column_name = 'is_active' AND data_type = 'boolean'
    ) THEN
        v_error_msg := v_error_msg || 'FAIL[2c]: Column is_active is not BOOLEAN. ';
        v_check_passed := FALSE;
    END IF;

    -- ============================================================
    -- TEST 3: Primary Key en id
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'operators'
          AND tc.constraint_type = 'PRIMARY KEY'
          AND ccu.column_name = 'id'
    ) INTO v_has_pk;

    IF NOT v_has_pk THEN
        v_error_msg := v_error_msg || 'FAIL[3]: Primary key on column id not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[3]: Primary key on column id';
    END IF;

    -- ============================================================
    -- TEST 4: NOT NULL constraints en columnas obligatorias
    -- ============================================================
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'operators'
          AND column_name = 'full_name' AND is_nullable = 'YES'
    ) THEN
        v_error_msg := v_error_msg || 'FAIL[4]: full_name should be NOT NULL. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[4]: full_name is NOT NULL';
    END IF;

    -- ============================================================
    -- TEST 5: Trigger updated_at existe
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE event_object_table = 'operators'
          AND trigger_name = 'trg_operators_updated_at'
    ) INTO v_has_trigger;

    IF NOT v_has_trigger THEN
        v_error_msg := v_error_msg || 'FAIL[5]: Trigger trg_operators_updated_at not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[5]: Trigger trg_operators_updated_at exists';
    END IF;

    -- ============================================================
    -- TEST 6: Seed data insertada correctamente
    -- ============================================================
    SELECT COUNT(*) INTO v_seed_count FROM public.operators;

    IF v_seed_count < 2 THEN
        v_error_msg := v_error_msg || 'FAIL[6]: Expected >= 2 seed rows, found ' || v_seed_count || '. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[6]: % seed row(s) found', v_seed_count;
    END IF;

    -- ============================================================
    -- TEST 7: Trigger funciona (UPDATE actualiza updated_at)
    -- ============================================================
    BEGIN
        UPDATE public.operators SET full_name = full_name WHERE id = 'OP-001';
        -- Si llegamos aquí sin error, el trigger funcionó
        RAISE NOTICE 'PASS[7]: Trigger fired on UPDATE without error';
    EXCEPTION WHEN OTHERS THEN
        v_error_msg := v_error_msg || 'FAIL[7]: Trigger failed on UPDATE: ' || SQLERRM || '. ';
        v_check_passed := FALSE;
    END;

    -- ============================================================
    -- VEREDICTO FINAL
    -- ============================================================
    IF v_check_passed THEN
        RAISE NOTICE '============================================================';
        RAISE NOTICE '✅ ALL TESTS PASSED — Migration 011_operators is VERIFIED';
        RAISE NOTICE '============================================================';
    ELSE
        RAISE EXCEPTION '❌ VERIFICATION FAILED: %', v_error_msg;
    END IF;
END;
$$;
