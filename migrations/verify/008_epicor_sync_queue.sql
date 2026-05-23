-- Verify: 008_epicor_sync_queue
-- Checks columns, types, nullability, defaults, constraints, and indexes

DO $$
DECLARE
    v_errors text[] := '{}';
    v_count  integer;
    v_actual text;
    v_expected text;
BEGIN

    ---- Column count ----------------------------------------------------------
    SELECT COUNT(*) INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'epicor_sync_queue';

    IF v_count != 12 THEN
        v_errors := array_append(v_errors, 'Column count: expected 12, found ' || v_count);
    END IF;

    ---- id : uuid PK DEFAULT gen_random_uuid() -------------------------------
    SELECT data_type, is_nullable INTO v_actual, v_expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'id';

    IF v_actual IS DISTINCT FROM 'uuid' THEN
        v_errors := array_append(v_errors, 'Column id data_type: expected uuid, got ' || COALESCE(v_actual, 'MISSING'));
    END IF;
    IF v_expected IS DISTINCT FROM 'NO' THEN
        v_errors := array_append(v_errors, 'Column id is_nullable: expected NO, got ' || COALESCE(v_expected, 'MISSING'));
    END IF;

    SELECT COALESCE(column_default, '') INTO v_actual
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'id';
    IF v_actual NOT LIKE '%gen_random_uuid%' THEN
        v_errors := array_append(v_errors, 'Column id default: expected gen_random_uuid(), got ' || COALESCE(NULLIF(v_actual, ''), 'NULL'));
    END IF;

    ---- source_table : text NOT NULL -----------------------------------------
    SELECT data_type, is_nullable INTO v_actual, v_expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'source_table';

    IF v_actual IS DISTINCT FROM 'text' THEN
        v_errors := array_append(v_errors, 'Column source_table data_type: expected text, got ' || COALESCE(v_actual, 'MISSING'));
    END IF;
    IF v_expected IS DISTINCT FROM 'NO' THEN
        v_errors := array_append(v_errors, 'Column source_table is_nullable: expected NO, got ' || COALESCE(v_expected, 'MISSING'));
    END IF;

    SELECT column_default INTO v_actual
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'source_table';
    IF v_actual IS NOT NULL THEN
        v_errors := array_append(v_errors, 'Column source_table default: expected NULL, got ' || v_actual);
    END IF;

    ---- source_row_id : uuid NOT NULL ----------------------------------------
    SELECT data_type, is_nullable INTO v_actual, v_expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'source_row_id';

    IF v_actual IS DISTINCT FROM 'uuid' THEN
        v_errors := array_append(v_errors, 'Column source_row_id data_type: expected uuid, got ' || COALESCE(v_actual, 'MISSING'));
    END IF;
    IF v_expected IS DISTINCT FROM 'NO' THEN
        v_errors := array_append(v_errors, 'Column source_row_id is_nullable: expected NO, got ' || COALESCE(v_expected, 'MISSING'));
    END IF;

    SELECT column_default INTO v_actual
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'source_row_id';
    IF v_actual IS NOT NULL THEN
        v_errors := array_append(v_errors, 'Column source_row_id default: expected NULL, got ' || v_actual);
    END IF;

    ---- status : text NOT NULL DEFAULT 'pending' (CHECK) --------------------
    SELECT data_type, is_nullable INTO v_actual, v_expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'status';

    IF v_actual IS DISTINCT FROM 'text' THEN
        v_errors := array_append(v_errors, 'Column status data_type: expected text, got ' || COALESCE(v_actual, 'MISSING'));
    END IF;
    IF v_expected IS DISTINCT FROM 'NO' THEN
        v_errors := array_append(v_errors, 'Column status is_nullable: expected NO, got ' || COALESCE(v_expected, 'MISSING'));
    END IF;

    SELECT COALESCE(column_default, '') INTO v_actual
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'status';
    IF v_actual NOT LIKE '%pending%' THEN
        v_errors := array_append(v_errors, 'Column status default: expected pending default, got ' || COALESCE(NULLIF(v_actual, ''), 'NULL'));
    END IF;

    ---- payload : jsonb NOT NULL ---------------------------------------------
    SELECT data_type, is_nullable INTO v_actual, v_expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'payload';

    IF v_actual IS DISTINCT FROM 'jsonb' THEN
        v_errors := array_append(v_errors, 'Column payload data_type: expected jsonb, got ' || COALESCE(v_actual, 'MISSING'));
    END IF;
    IF v_expected IS DISTINCT FROM 'NO' THEN
        v_errors := array_append(v_errors, 'Column payload is_nullable: expected NO, got ' || COALESCE(v_expected, 'MISSING'));
    END IF;

    SELECT column_default INTO v_actual
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'payload';
    IF v_actual IS NOT NULL THEN
        v_errors := array_append(v_errors, 'Column payload default: expected NULL, got ' || v_actual);
    END IF;

    ---- retry_count : int NOT NULL DEFAULT 0 ---------------------------------
    SELECT data_type, is_nullable INTO v_actual, v_expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'retry_count';

    IF v_actual IS DISTINCT FROM 'integer' THEN
        v_errors := array_append(v_errors, 'Column retry_count data_type: expected integer, got ' || COALESCE(v_actual, 'MISSING'));
    END IF;
    IF v_expected IS DISTINCT FROM 'NO' THEN
        v_errors := array_append(v_errors, 'Column retry_count is_nullable: expected NO, got ' || COALESCE(v_expected, 'MISSING'));
    END IF;

    SELECT COALESCE(column_default, '') INTO v_actual
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'retry_count';
    IF v_actual IS DISTINCT FROM '0' THEN
        v_errors := array_append(v_errors, 'Column retry_count default: expected 0, got ' || COALESCE(NULLIF(v_actual, ''), 'NULL'));
    END IF;

    ---- max_retries : int NOT NULL DEFAULT 3 ---------------------------------
    SELECT data_type, is_nullable INTO v_actual, v_expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'max_retries';

    IF v_actual IS DISTINCT FROM 'integer' THEN
        v_errors := array_append(v_errors, 'Column max_retries data_type: expected integer, got ' || COALESCE(v_actual, 'MISSING'));
    END IF;
    IF v_expected IS DISTINCT FROM 'NO' THEN
        v_errors := array_append(v_errors, 'Column max_retries is_nullable: expected NO, got ' || COALESCE(v_expected, 'MISSING'));
    END IF;

    SELECT COALESCE(column_default, '') INTO v_actual
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'max_retries';
    IF v_actual IS DISTINCT FROM '3' THEN
        v_errors := array_append(v_errors, 'Column max_retries default: expected 3, got ' || COALESCE(NULLIF(v_actual, ''), 'NULL'));
    END IF;

    ---- error_info : jsonb (nullable) ----------------------------------------
    SELECT data_type, is_nullable INTO v_actual, v_expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'error_info';

    IF v_actual IS DISTINCT FROM 'jsonb' THEN
        v_errors := array_append(v_errors, 'Column error_info data_type: expected jsonb, got ' || COALESCE(v_actual, 'MISSING'));
    END IF;
    IF v_expected IS DISTINCT FROM 'YES' THEN
        v_errors := array_append(v_errors, 'Column error_info is_nullable: expected YES, got ' || COALESCE(v_expected, 'MISSING'));
    END IF;

    SELECT column_default INTO v_actual
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'error_info';
    IF v_actual IS NOT NULL THEN
        v_errors := array_append(v_errors, 'Column error_info default: expected NULL, got ' || v_actual);
    END IF;

    ---- created_at : timestamptz NOT NULL DEFAULT now() ----------------------
    SELECT data_type, is_nullable INTO v_actual, v_expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'created_at';

    IF v_actual IS DISTINCT FROM 'timestamp with time zone' THEN
        v_errors := array_append(v_errors, 'Column created_at data_type: expected timestamp with time zone, got ' || COALESCE(v_actual, 'MISSING'));
    END IF;
    IF v_expected IS DISTINCT FROM 'NO' THEN
        v_errors := array_append(v_errors, 'Column created_at is_nullable: expected NO, got ' || COALESCE(v_expected, 'MISSING'));
    END IF;

    SELECT COALESCE(column_default, '') INTO v_actual
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'created_at';
    IF v_actual NOT LIKE '%now%' THEN
        v_errors := array_append(v_errors, 'Column created_at default: expected now(), got ' || COALESCE(NULLIF(v_actual, ''), 'NULL'));
    END IF;

    ---- updated_at : timestamptz (nullable) -----------------------------------
    SELECT data_type, is_nullable INTO v_actual, v_expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'updated_at';

    IF v_actual IS DISTINCT FROM 'timestamp with time zone' THEN
        v_errors := array_append(v_errors, 'Column updated_at data_type: expected timestamp with time zone, got ' || COALESCE(v_actual, 'MISSING'));
    END IF;
    IF v_expected IS DISTINCT FROM 'YES' THEN
        v_errors := array_append(v_errors, 'Column updated_at is_nullable: expected YES, got ' || COALESCE(v_expected, 'MISSING'));
    END IF;

    SELECT column_default INTO v_actual
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'updated_at';
    IF v_actual IS NOT NULL THEN
        v_errors := array_append(v_errors, 'Column updated_at default: expected NULL, got ' || v_actual);
    END IF;

    ---- started_at : timestamptz (nullable) -----------------------------------
    SELECT data_type, is_nullable INTO v_actual, v_expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'started_at';

    IF v_actual IS DISTINCT FROM 'timestamp with time zone' THEN
        v_errors := array_append(v_errors, 'Column started_at data_type: expected timestamp with time zone, got ' || COALESCE(v_actual, 'MISSING'));
    END IF;
    IF v_expected IS DISTINCT FROM 'YES' THEN
        v_errors := array_append(v_errors, 'Column started_at is_nullable: expected YES, got ' || COALESCE(v_expected, 'MISSING'));
    END IF;

    SELECT column_default INTO v_actual
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'started_at';
    IF v_actual IS NOT NULL THEN
        v_errors := array_append(v_errors, 'Column started_at default: expected NULL, got ' || v_actual);
    END IF;

    ---- completed_at : timestamptz (nullable) ---------------------------------
    SELECT data_type, is_nullable INTO v_actual, v_expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'completed_at';

    IF v_actual IS DISTINCT FROM 'timestamp with time zone' THEN
        v_errors := array_append(v_errors, 'Column completed_at data_type: expected timestamp with time zone, got ' || COALESCE(v_actual, 'MISSING'));
    END IF;
    IF v_expected IS DISTINCT FROM 'YES' THEN
        v_errors := array_append(v_errors, 'Column completed_at is_nullable: expected YES, got ' || COALESCE(v_expected, 'MISSING'));
    END IF;

    SELECT column_default INTO v_actual
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND column_name = 'completed_at';
    IF v_actual IS NOT NULL THEN
        v_errors := array_append(v_errors, 'Column completed_at default: expected NULL, got ' || v_actual);
    END IF;

    ---- CHECK constraint: chk_epicor_sync_status -----------------------------
    SELECT COUNT(*) INTO v_count
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'epicor_sync_queue'
      AND constraint_name = 'chk_epicor_sync_status'
      AND constraint_type = 'CHECK';

    IF v_count != 1 THEN
        v_errors := array_append(v_errors, 'CHECK constraint chk_epicor_sync_status: not found');
    END IF;

    ---- Index: idx_epicor_sync_status ----------------------------------------
    SELECT COUNT(*) INTO v_count
    FROM pg_indexes
    WHERE tablename = 'epicor_sync_queue'
      AND indexname = 'idx_epicor_sync_status';

    IF v_count != 1 THEN
        v_errors := array_append(v_errors, 'Index idx_epicor_sync_status: not found');
    END IF;

    ---- Report results -------------------------------------------------------
    IF array_length(v_errors, 1) > 0 THEN
        RAISE EXCEPTION 'Verification failed for epicor_sync_queue: %', array_to_string(v_errors, E'\n  - ');
    ELSE
        RAISE NOTICE '✅ Verify 008_epicor_sync_queue: all checks passed';
    END IF;
END
$$;
