-- Verify: 007_telemetry_raw_staging
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
    WHERE table_schema = 'public' AND table_name = 'telemetry_raw_staging';

    IF v_count != 8 THEN
        v_errors := array_append(v_errors, 'Column count: expected 8, found ' || v_count);
    END IF;

    ---- id : uuid PK DEFAULT gen_random_uuid() -------------------------------
    SELECT data_type, is_nullable
    INTO v_actual, v_expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'telemetry_raw_staging'
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
      AND table_name = 'telemetry_raw_staging'
      AND column_name = 'id';
    IF v_actual NOT LIKE '%gen_random_uuid%' THEN
        v_errors := array_append(v_errors, 'Column id default: expected gen_random_uuid(), got ' || COALESCE(NULLIF(v_actual, ''), 'NULL'));
    END IF;

    ---- machine_id : uuid NOT NULL (FK) --------------------------------------
    SELECT data_type, is_nullable INTO v_actual, v_expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'telemetry_raw_staging'
      AND column_name = 'machine_id';

    IF v_actual IS DISTINCT FROM 'uuid' THEN
        v_errors := array_append(v_errors, 'Column machine_id data_type: expected uuid, got ' || COALESCE(v_actual, 'MISSING'));
    END IF;
    IF v_expected IS DISTINCT FROM 'NO' THEN
        v_errors := array_append(v_errors, 'Column machine_id is_nullable: expected NO, got ' || COALESCE(v_expected, 'MISSING'));
    END IF;

    ---- payload : jsonb NOT NULL ---------------------------------------------
    SELECT data_type, is_nullable INTO v_actual, v_expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'telemetry_raw_staging'
      AND column_name = 'payload';

    IF v_actual IS DISTINCT FROM 'jsonb' THEN
        v_errors := array_append(v_errors, 'Column payload data_type: expected jsonb, got ' || COALESCE(v_actual, 'MISSING'));
    END IF;
    IF v_expected IS DISTINCT FROM 'NO' THEN
        v_errors := array_append(v_errors, 'Column payload is_nullable: expected NO, got ' || COALESCE(v_expected, 'MISSING'));
    END IF;

    ---- received_at : timestamptz NOT NULL DEFAULT now() ----------------------
    SELECT data_type, is_nullable INTO v_actual, v_expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'telemetry_raw_staging'
      AND column_name = 'received_at';

    IF v_actual IS DISTINCT FROM 'timestamp with time zone' THEN
        v_errors := array_append(v_errors, 'Column received_at data_type: expected timestamp with time zone, got ' || COALESCE(v_actual, 'MISSING'));
    END IF;
    IF v_expected IS DISTINCT FROM 'NO' THEN
        v_errors := array_append(v_errors, 'Column received_at is_nullable: expected NO, got ' || COALESCE(v_expected, 'MISSING'));
    END IF;

    SELECT COALESCE(column_default, '') INTO v_actual
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'telemetry_raw_staging'
      AND column_name = 'received_at';
    IF v_actual NOT LIKE '%now%' THEN
        v_errors := array_append(v_errors, 'Column received_at default: expected now(), got ' || COALESCE(NULLIF(v_actual, ''), 'NULL'));
    END IF;

    ---- processed_at : timestamptz (nullable) ---------------------------------
    SELECT data_type, is_nullable INTO v_actual, v_expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'telemetry_raw_staging'
      AND column_name = 'processed_at';

    IF v_actual IS DISTINCT FROM 'timestamp with time zone' THEN
        v_errors := array_append(v_errors, 'Column processed_at data_type: expected timestamp with time zone, got ' || COALESCE(v_actual, 'MISSING'));
    END IF;
    IF v_expected IS DISTINCT FROM 'YES' THEN
        v_errors := array_append(v_errors, 'Column processed_at is_nullable: expected YES, got ' || COALESCE(v_expected, 'MISSING'));
    END IF;

    SELECT column_default INTO v_actual
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'telemetry_raw_staging'
      AND column_name = 'processed_at';
    IF v_actual IS NOT NULL THEN
        v_errors := array_append(v_errors, 'Column processed_at default: expected NULL, got ' || v_actual);
    END IF;

    ---- status : text NOT NULL DEFAULT 'pending' (CHECK) --------------------
    SELECT data_type, is_nullable INTO v_actual, v_expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'telemetry_raw_staging'
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
      AND table_name = 'telemetry_raw_staging'
      AND column_name = 'status';
    IF v_actual NOT LIKE '%pending%' THEN
        v_errors := array_append(v_errors, 'Column status default: expected pending default, got ' || COALESCE(NULLIF(v_actual, ''), 'NULL'));
    END IF;

    ---- error_info : jsonb (nullable) ----------------------------------------
    SELECT data_type, is_nullable INTO v_actual, v_expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'telemetry_raw_staging'
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
      AND table_name = 'telemetry_raw_staging'
      AND column_name = 'error_info';
    IF v_actual IS NOT NULL THEN
        v_errors := array_append(v_errors, 'Column error_info default: expected NULL, got ' || v_actual);
    END IF;

    ---- gateway_msg_id : text (nullable) -------------------------------------
    SELECT data_type, is_nullable INTO v_actual, v_expected
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'telemetry_raw_staging'
      AND column_name = 'gateway_msg_id';

    IF v_actual IS DISTINCT FROM 'text' THEN
        v_errors := array_append(v_errors, 'Column gateway_msg_id data_type: expected text, got ' || COALESCE(v_actual, 'MISSING'));
    END IF;
    IF v_expected IS DISTINCT FROM 'YES' THEN
        v_errors := array_append(v_errors, 'Column gateway_msg_id is_nullable: expected YES, got ' || COALESCE(v_expected, 'MISSING'));
    END IF;

    SELECT column_default INTO v_actual
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'telemetry_raw_staging'
      AND column_name = 'gateway_msg_id';
    IF v_actual IS NOT NULL THEN
        v_errors := array_append(v_errors, 'Column gateway_msg_id default: expected NULL, got ' || v_actual);
    END IF;

    ---- FK constraint: fk_telemetry_raw_machine -----------------------------
    SELECT COUNT(*) INTO v_count
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'telemetry_raw_staging'
      AND constraint_name = 'fk_telemetry_raw_machine'
      AND constraint_type = 'FOREIGN KEY';

    IF v_count != 1 THEN
        v_errors := array_append(v_errors, 'FK constraint fk_telemetry_raw_machine: not found');
    END IF;

    ---- CHECK constraint: chk_telemetry_raw_status ---------------------------
    SELECT COUNT(*) INTO v_count
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'telemetry_raw_staging'
      AND constraint_name = 'chk_telemetry_raw_status'
      AND constraint_type = 'CHECK';

    IF v_count != 1 THEN
        v_errors := array_append(v_errors, 'CHECK constraint chk_telemetry_raw_status: not found');
    END IF;

    ---- Index: idx_telemetry_raw_status --------------------------------------
    SELECT COUNT(*) INTO v_count
    FROM pg_indexes
    WHERE tablename = 'telemetry_raw_staging'
      AND indexname = 'idx_telemetry_raw_status';

    IF v_count != 1 THEN
        v_errors := array_append(v_errors, 'Index idx_telemetry_raw_status: not found');
    END IF;

    ---- Index: idx_telemetry_raw_machine -------------------------------------
    SELECT COUNT(*) INTO v_count
    FROM pg_indexes
    WHERE tablename = 'telemetry_raw_staging'
      AND indexname = 'idx_telemetry_raw_machine';

    IF v_count != 1 THEN
        v_errors := array_append(v_errors, 'Index idx_telemetry_raw_machine: not found');
    END IF;

    ---- Report results -------------------------------------------------------
    IF array_length(v_errors, 1) > 0 THEN
        RAISE EXCEPTION 'Verification failed for telemetry_raw_staging: %', array_to_string(v_errors, E'\n  - ');
    ELSE
        RAISE NOTICE '✅ Verify 007_telemetry_raw_staging: all checks passed';
    END IF;
END
$$;
