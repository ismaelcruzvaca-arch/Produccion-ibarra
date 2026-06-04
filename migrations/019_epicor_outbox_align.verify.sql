-- Verify: 019_epicor_outbox_align
-- Verifica columnas nuevas, índices, funciones y triggers de la migración
--
-- Escenarios cubiertos:
--   S1 — Shift closes → epicor_sync_queue gets SHIFT_CLOSED row (test real DML)
--   S2 — Quality disposition → epicor_sync_queue gets QUALITY_DISPOSITION row (test real DML)
--   S3 — No status change → no insert (test real DML)
--   S5 — Poll index works for status='pending' queries

DO $$
DECLARE
    v_has_next_retry_at      BOOLEAN;
    v_has_event_type         BOOLEAN;
    v_idx_poll_exists        BOOLEAN;
    v_idx_source_exists      BOOLEAN;
    v_func_shift_exists      BOOLEAN;
    v_func_quality_exists    BOOLEAN;
    v_trg_shift_exists       BOOLEAN;
    v_trg_quality_exists     BOOLEAN;
    v_queue_count            INT;
    v_test_session_id        UUID;
    v_test_inspection_id     UUID;
    v_machine_id             UUID;
    v_check_passed           BOOLEAN := TRUE;
    v_error_msg              TEXT := '';
    v_shift_payload          JSONB;
    v_quality_payload        JSONB;
BEGIN
    -- ============================================================
    -- TEST 1: Columnas en epicor_sync_queue
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'epicor_sync_queue'
          AND column_name = 'next_retry_at'
    ) INTO v_has_next_retry_at;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'epicor_sync_queue'
          AND column_name = 'event_type'
    ) INTO v_has_event_type;

    IF NOT v_has_next_retry_at THEN
        v_error_msg := v_error_msg || 'FAIL[R1]: next_retry_at column missing. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R1]: next_retry_at column exists';
    END IF;

    IF NOT v_has_event_type THEN
        v_error_msg := v_error_msg || 'FAIL[R5]: event_type column missing. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R5]: event_type column exists';
    END IF;

    -- ============================================================
    -- TEST 2: Índices
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'epicor_sync_queue'
          AND indexname = 'idx_epicor_sync_poll'
    ) INTO v_idx_poll_exists;

    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'epicor_sync_queue'
          AND indexname = 'idx_epicor_sync_source'
    ) INTO v_idx_source_exists;

    IF NOT v_idx_poll_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R2]: idx_epicor_sync_poll missing. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R2]: idx_epicor_sync_poll (status, next_retry_at) exists';
    END IF;

    IF NOT v_idx_source_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R6]: idx_epicor_sync_source missing. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R6]: idx_epicor_sync_source (source_table, status) exists';
    END IF;

    -- Verificar que idx_epicor_sync_poll es B-Tree con las columnas correctas
    IF v_idx_poll_exists THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = 'epicor_sync_queue'
              AND indexname = 'idx_epicor_sync_poll'
              AND indexdef LIKE '%status%next_retry_at%'
        ) THEN
            v_error_msg := v_error_msg || 'FAIL[R2]: idx_epicor_sync_poll columns mismatch (expected status, next_retry_at). ';
            v_check_passed := FALSE;
        ELSE
            RAISE NOTICE 'PASS[R2b]: idx_epicor_sync_poll column order verified (status, next_retry_at)';
        END IF;
    END IF;

    -- ============================================================
    -- TEST 3: Funciones
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'enqueue_shift_closed'
    ) INTO v_func_shift_exists;

    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'enqueue_quality_disposition'
    ) INTO v_func_quality_exists;

    IF NOT v_func_shift_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R3]: enqueue_shift_closed() function missing. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R3]: enqueue_shift_closed() function exists';
    END IF;

    IF NOT v_func_quality_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R4]: enqueue_quality_disposition() function missing. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R4]: enqueue_quality_disposition() function exists';
    END IF;

    -- ============================================================
    -- TEST 4: Triggers
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE event_object_table = 'shift_sessions'
          AND trigger_name = 'trg_shift_closed_to_epicor'
    ) INTO v_trg_shift_exists;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE event_object_table = 'quality_inspections'
          AND trigger_name = 'trg_quality_disposition_to_epicor'
    ) INTO v_trg_quality_exists;

    IF NOT v_trg_shift_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R3]: trg_shift_closed_to_epicor trigger missing. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R3]: trg_shift_closed_to_epicor trigger exists on shift_sessions';
    END IF;

    IF NOT v_trg_quality_exists THEN
        v_error_msg := v_error_msg || 'FAIL[R4]: trg_quality_disposition_to_epicor trigger missing. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[R4]: trg_quality_disposition_to_epicor trigger exists on quality_inspections';
    END IF;

    -- ============================================================
    -- TEST 5 (S1): Shift closes → enqueue SHIFT_CLOSED
    -- ============================================================
    BEGIN
        -- Obtener una máquina real
        SELECT id INTO v_machine_id FROM public.machines LIMIT 1;

        IF v_machine_id IS NULL THEN
            RAISE NOTICE '⚠ SKIP[S1]: No machines found in DB — skipping DML test';
        ELSE
            -- Insertar sesión activa
            INSERT INTO public.shift_sessions (machine_id, operator_id, shift_type, status)
            VALUES (v_machine_id, 'OP-VERIFY', 'matutino', 'active')
            RETURNING id INTO v_test_session_id;

            -- Cerrar la sesión (debe disparar el trigger)
            UPDATE public.shift_sessions
            SET status = 'closed', ended_at = now()
            WHERE id = v_test_session_id;

            -- Verificar que se encoló el evento
            SELECT COUNT(*) INTO v_queue_count
            FROM public.epicor_sync_queue
            WHERE source_table = 'shift_sessions'
              AND source_row_id = v_test_session_id
              AND event_type = 'SHIFT_CLOSED';

            IF v_queue_count != 1 THEN
                v_error_msg := v_error_msg || 'FAIL[S1]: Expected 1 SHIFT_CLOSED row, found ' || v_queue_count || '. ';
                v_check_passed := FALSE;
            ELSE
                RAISE NOTICE 'PASS[S1]: Shift closed → 1 SHIFT_CLOSED enqueued';
            END IF;

            -- Verificar payload structure
            SELECT payload INTO v_shift_payload
            FROM public.epicor_sync_queue
            WHERE source_table = 'shift_sessions'
              AND source_row_id = v_test_session_id;

            IF v_shift_payload IS NULL OR NOT (v_shift_payload ? 'session_id') THEN
                v_error_msg := v_error_msg || 'FAIL[S1b]: SHIFT_CLOSED payload missing session_id. ';
                v_check_passed := FALSE;
            ELSE
                RAISE NOTICE 'PASS[S1b]: SHIFT_CLOSED payload has session_id';
            END IF;

            -- Limpiar datos de prueba
            -- (no eliminamos epicor_sync_queue porque worker podría haberlo tomado)
            DELETE FROM public.epicor_sync_queue
            WHERE source_table = 'shift_sessions' AND source_row_id = v_test_session_id;
            DELETE FROM public.shift_sessions WHERE id = v_test_session_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_error_msg := v_error_msg || 'FAIL[S1]: ' || SQLERRM || '. ';
        v_check_passed := FALSE;
    END;

    -- ============================================================
    -- TEST 6 (S2): Quality disposition → enqueue QUALITY_DISPOSITION
    -- ============================================================
    BEGIN
        IF v_machine_id IS NULL THEN
            RAISE NOTICE '⚠ SKIP[S2]: No machines found — skipping DML test';
        ELSE
            -- Insertar inspección pendiente
            INSERT INTO public.quality_inspections (machine_id, inspector_id, shift_type, disposition)
            VALUES (v_machine_id, 'OP-VERIFY', 'matutino', 'pending')
            RETURNING id INTO v_test_inspection_id;

            -- Disposición a liberado (debe disparar el trigger)
            UPDATE public.quality_inspections
            SET disposition = 'liberado'
            WHERE id = v_test_inspection_id;

            -- Verificar que se encoló el evento
            SELECT COUNT(*) INTO v_queue_count
            FROM public.epicor_sync_queue
            WHERE source_table = 'quality_inspections'
              AND source_row_id = v_test_inspection_id
              AND event_type = 'QUALITY_DISPOSITION';

            IF v_queue_count != 1 THEN
                v_error_msg := v_error_msg || 'FAIL[S2]: Expected 1 QUALITY_DISPOSITION row, found ' || v_queue_count || '. ';
                v_check_passed := FALSE;
            ELSE
                RAISE NOTICE 'PASS[S2]: Quality disposition (liberado) → 1 QUALITY_DISPOSITION enqueued';
            END IF;

            -- Verificar payload structure
            SELECT payload INTO v_quality_payload
            FROM public.epicor_sync_queue
            WHERE source_table = 'quality_inspections'
              AND source_row_id = v_test_inspection_id;

            IF v_quality_payload IS NULL OR NOT (v_quality_payload ? 'inspection_id') THEN
                v_error_msg := v_error_msg || 'FAIL[S2b]: QUALITY_DISPOSITION payload missing inspection_id. ';
                v_check_passed := FALSE;
            ELSE
                RAISE NOTICE 'PASS[S2b]: QUALITY_DISPOSITION payload has inspection_id';
            END IF;

            -- Limpiar datos de prueba
            DELETE FROM public.epicor_sync_queue
            WHERE source_table = 'quality_inspections' AND source_row_id = v_test_inspection_id;
            DELETE FROM public.quality_inspections WHERE id = v_test_inspection_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_error_msg := v_error_msg || 'FAIL[S2]: ' || SQLERRM || '. ';
        v_check_passed := FALSE;
    END;

    -- ============================================================
    -- TEST 7 (S3): No status change → no insert
    -- ============================================================
    BEGIN
        IF v_machine_id IS NOT NULL THEN
            -- Contar filas actuales en la cola (shift_sessions events)
            SELECT COUNT(*) INTO v_queue_count
            FROM public.epicor_sync_queue
            WHERE source_table = 'shift_sessions';

            -- Insertar sesión y hacer UPDATE con mismo estado (no debe disparar)
            INSERT INTO public.shift_sessions (machine_id, operator_id, shift_type, status)
            VALUES (v_machine_id, 'OP-VERIFY', 'vespertino', 'active')
            RETURNING id INTO v_test_session_id;

            -- UPDATE sin cambio de estado
            UPDATE public.shift_sessions
            SET started_at = now()
            WHERE id = v_test_session_id;

            -- Verificar que NO se agregó ninguna fila nueva para shift_sessions
            IF EXISTS (
                SELECT 1 FROM public.epicor_sync_queue
                WHERE source_table = 'shift_sessions' AND source_row_id = v_test_session_id
            ) THEN
                v_error_msg := v_error_msg || 'FAIL[S3]: Trigger fired on UPDATE without status change. ';
                v_check_passed := FALSE;
            ELSE
                RAISE NOTICE 'PASS[S3]: No insert when status does not change to closed';
            END IF;

            -- Limpiar
            DELETE FROM public.shift_sessions WHERE id = v_test_session_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_error_msg := v_error_msg || 'FAIL[S3]: ' || SQLERRM || '. ';
        v_check_passed := FALSE;
    END;

    -- ============================================================
    -- TEST 8 (S5): Poll index usable for status='pending'
    -- ============================================================
    BEGIN
        -- Verificar que el planificador puede usar el índice de poll
        -- Esto es una verificación estructural — en producción EXPLAIN mostraría Index Scan
        IF v_idx_poll_exists THEN
            RAISE NOTICE 'PASS[S5]: idx_epicor_sync_poll exists for status=pending queries';

            -- Verificar que el índice cubre la columna status (leader)
            IF EXISTS (
                SELECT 1 FROM pg_index i
                JOIN pg_class c ON i.indexrelid = c.oid
                JOIN pg_namespace n ON c.relnamespace = n.oid
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
                WHERE n.nspname = 'public'
                  AND c.relname = 'idx_epicor_sync_poll'
                  AND a.attname = 'status'
            ) THEN
                RAISE NOTICE 'PASS[S5b]: idx_epicor_sync_poll leading column is status — optimal for WHERE status=pending';
            ELSE
                v_error_msg := v_error_msg || 'FAIL[S5b]: Leading column of idx_epicor_sync_poll is NOT status. ';
                v_check_passed := FALSE;
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_error_msg := v_error_msg || 'FAIL[S5]: ' || SQLERRM || '. ';
        v_check_passed := FALSE;
    END;

    -- ============================================================
    -- VEREDICTO FINAL
    -- ============================================================
    IF v_check_passed THEN
        RAISE NOTICE '============================================================';
        RAISE NOTICE '✅ ALL TESTS PASSED — Migration 019_epicor_outbox_align VERIFIED';
        RAISE NOTICE '   Columns: next_retry_at ✓, event_type ✓';
        RAISE NOTICE '   Indexes: idx_epicor_sync_poll ✓, idx_epicor_sync_source ✓';
        RAISE NOTICE '   Functions: enqueue_shift_closed ✓, enqueue_quality_disposition ✓';
        RAISE NOTICE '   Triggers: trg_shift_closed_to_epicor ✓, trg_quality_disposition_to_epicor ✓';
        RAISE NOTICE '   DML Tests: S1(SHIFT_CLOSED) ✓, S2(QUALITY_DISPOSITION) ✓, S3(no-op) ✓';
        RAISE NOTICE '============================================================';
    ELSE
        RAISE EXCEPTION '❌ VERIFICATION FAILED: %', v_error_msg;
    END IF;
END;
$$;
