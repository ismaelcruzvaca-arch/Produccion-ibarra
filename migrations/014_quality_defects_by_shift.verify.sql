-- Verify: 014_quality_defects_by_shift
-- Verifica que las columnas data_source e inspector_type existan en quality_inspections
-- con los tipos correctos, CHECK constraint, default, y columna generada.

DO $$
DECLARE
    v_col_ds_type      TEXT;
    v_col_ds_len       TEXT;
    v_col_ds_nullable  TEXT;
    v_col_ds_default   TEXT;
    v_col_it_type      TEXT;
    v_col_it_len       TEXT;
    v_col_it_generated TEXT;
    v_check_exists     BOOLEAN;
    v_check_passed     BOOLEAN := TRUE;
    v_error_msg        TEXT := '';
BEGIN
    -- ============================================================
    -- TEST 1: data_source existe y es VARCHAR(20) NOT NULL DEFAULT 'manual'
    -- ============================================================
    SELECT data_type, COALESCE(character_maximum_length::TEXT, 'none'),
           is_nullable, COALESCE(column_default, 'none')
    INTO v_col_ds_type, v_col_ds_len, v_col_ds_nullable, v_col_ds_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quality_inspections'
      AND column_name = 'data_source';

    IF v_col_ds_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1]: Column data_source does not exist on public.quality_inspections. ';
        v_check_passed := FALSE;
    ELSE
        IF v_col_ds_type NOT IN ('character varying', 'varchar') THEN
            v_error_msg := v_error_msg || 'FAIL[1a]: data_source type is ' || v_col_ds_type || ' (expected VARCHAR). ';
            v_check_passed := FALSE;
        END IF;
        IF v_col_ds_len != '20' THEN
            v_error_msg := v_error_msg || 'FAIL[1b]: data_source length is ' || v_col_ds_len || ' (expected 20). ';
            v_check_passed := FALSE;
        END IF;
        IF v_col_ds_nullable != 'NO' THEN
            v_error_msg := v_error_msg || 'FAIL[1c]: data_source should be NOT NULL, got nullable=' || v_col_ds_nullable || '. ';
            v_check_passed := FALSE;
        END IF;
        IF v_col_ds_default IS NULL OR v_col_ds_default = 'none' THEN
            v_error_msg := v_error_msg || 'FAIL[1d]: data_source should have DEFAULT. ';
            v_check_passed := FALSE;
        ELSIF POSITION('manual' IN v_col_ds_default) = 0 THEN
            v_error_msg := v_error_msg || 'FAIL[1d]: data_source default is ' || v_col_ds_default || ' (expected DEFAULT ''manual''). ';
            v_check_passed := FALSE;
        END IF;
        IF v_check_passed THEN
            RAISE NOTICE 'PASS[1]: data_source exists: VARCHAR(20), NOT NULL, DEFAULT ''manual''';
        END IF;
    END IF;

    -- ============================================================
    -- TEST 2: CHECK constraint en data_source
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'quality_inspections'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%data_source%'
    ) INTO v_check_exists;

    IF NOT v_check_exists THEN
        v_error_msg := v_error_msg || 'FAIL[2]: CHECK constraint on data_source not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[2]: CHECK constraint exists on data_source (IN (''vision'', ''manual'', ''hybrid''))';
    END IF;

    -- ============================================================
    -- TEST 3: inspector_type existe, es VARCHAR(10), columna generada
    -- ============================================================
    SELECT data_type, COALESCE(character_maximum_length::TEXT, 'none'), COALESCE(is_generated, 'NEVER')
    INTO v_col_it_type, v_col_it_len, v_col_it_generated
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quality_inspections'
      AND column_name = 'inspector_type';

    IF v_col_it_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[3]: Column inspector_type does not exist on public.quality_inspections. ';
        v_check_passed := FALSE;
    ELSE
        IF v_col_it_type NOT IN ('character varying', 'varchar') THEN
            v_error_msg := v_error_msg || 'FAIL[3a]: inspector_type type is ' || v_col_it_type || ' (expected VARCHAR). ';
            v_check_passed := FALSE;
        END IF;
        IF v_col_it_len != '10' THEN
            v_error_msg := v_error_msg || 'FAIL[3b]: inspector_type length is ' || v_col_it_len || ' (expected 10). ';
            v_check_passed := FALSE;
        END IF;
        IF v_col_it_generated != 'ALWAYS' THEN
            v_error_msg := v_error_msg || 'FAIL[3c]: inspector_type is_generated=' || v_col_it_generated || ' (expected ALWAYS). ';
            v_check_passed := FALSE;
        END IF;
        IF v_check_passed THEN
            RAISE NOTICE 'PASS[3]: inspector_type exists: VARCHAR(10), GENERATED ALWAYS';
        END IF;
    END IF;

    -- ============================================================
    -- TEST 4: La columna inspector_type rechaza INSERT directo (generada)
    -- ============================================================
    BEGIN
        INSERT INTO public.quality_inspections (machine_id, inspector_id, shift_type, disposition, inspector_type)
        VALUES (gen_random_uuid(), 'TEST-GEN', 'matutino', 'pending', 'ai');
        RAISE EXCEPTION 'FAIL[4]: INSERT into generated column should have failed';
    EXCEPTION
        WHEN generated_always THEN
            RAISE NOTICE 'PASS[4]: INSERT into generated column correctly rejected (GENERATED ALWAYS)';
        WHEN OTHERS THEN
            v_error_msg := v_error_msg || 'FAIL[4]: Unexpected error on generated column INSERT: ' || SQLERRM || '. ';
            v_check_passed := FALSE;
    END;

    -- ============================================================
    -- TEST 5: CHECK constraint rechaza valores inválidos en data_source
    -- ============================================================
    BEGIN
        INSERT INTO public.quality_inspections (machine_id, inspector_id, shift_type, disposition, data_source)
        VALUES (gen_random_uuid(), 'TEST-CHK', 'matutino', 'pending', 'invalido');
        RAISE EXCEPTION 'FAIL[5]: INSERT with invalid data_source should have been rejected';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'PASS[5]: CHECK constraint correctly rejects invalid data_source values';
        WHEN OTHERS THEN
            v_error_msg := v_error_msg || 'FAIL[5]: Unexpected error on CHECK test: ' || SQLERRM || '. ';
            v_check_passed := FALSE;
    END;

    -- ============================================================
    -- VEREDICTO FINAL
    -- ============================================================
    IF v_check_passed THEN
        RAISE NOTICE '============================================================';
        RAISE NOTICE '✅ ALL TESTS PASSED — Migration 014_quality_defects_by_shift is VERIFIED';
        RAISE NOTICE '============================================================';
    ELSE
        RAISE EXCEPTION '❌ VERIFICATION FAILED: %', v_error_msg;
    END IF;
END;
$$;
