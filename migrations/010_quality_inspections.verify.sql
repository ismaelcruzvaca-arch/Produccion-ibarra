-- Verify: 010_quality_inspections
-- Verifica que existan las 3 tablas transaccionales con su estructura e índices

DO $$
DECLARE
    idx_count INT;
    trigger_exists BOOLEAN;
BEGIN
    -- ============================================================
    -- 1. quality_inspections
    -- ============================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'quality_inspections'
    ) THEN
        RAISE EXCEPTION 'FAIL: table public.quality_inspections does not exist';
    END IF;

    -- Verificar CHECK constraints
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%quality_inspections%shift_type%'
    ) THEN
        RAISE EXCEPTION 'FAIL: quality_inspections missing shift_type CHECK constraint';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%quality_inspections%disposition%'
    ) THEN
        RAISE EXCEPTION 'FAIL: quality_inspections missing disposition CHECK constraint';
    END IF;

    -- Verificar FK a machines
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'quality_inspections'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'machines'
    ) THEN
        RAISE EXCEPTION 'FAIL: quality_inspections missing FK to machines';
    END IF;

    -- Verificar trigger
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE event_object_table = 'quality_inspections'
          AND trigger_name = 'trg_quality_inspections_updated_at'
    ) INTO trigger_exists;
    IF NOT trigger_exists THEN
        RAISE EXCEPTION 'FAIL: trigger trg_quality_inspections_updated_at not found';
    END IF;

    RAISE NOTICE 'PASS: quality_inspections — table OK, constraints OK, trigger OK';

    -- ============================================================
    -- 2. defect_logs
    -- ============================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'defect_logs'
    ) THEN
        RAISE EXCEPTION 'FAIL: table public.defect_logs does not exist';
    END IF;

    -- Verificar CHECK (severity, defect_count > 0)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%defect_logs%severity%'
    ) THEN
        RAISE EXCEPTION 'FAIL: defect_logs missing severity CHECK constraint';
    END IF;

    -- Verificar FK con CASCADE
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'defect_logs'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND rc.delete_rule = 'CASCADE'
    ) THEN
        RAISE EXCEPTION 'FAIL: defect_logs FK missing ON DELETE CASCADE';
    END IF;

    RAISE NOTICE 'PASS: defect_logs — table OK, constraints OK, CASCADE OK';

    -- ============================================================
    -- 3. weight_logs
    -- ============================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'weight_logs'
    ) THEN
        RAISE EXCEPTION 'FAIL: table public.weight_logs does not exist';
    END IF;

    -- Verificar CHECK (measured_weight > 0)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%weight_logs%measured_weight%'
    ) THEN
        RAISE EXCEPTION 'FAIL: weight_logs missing measured_weight CHECK constraint';
    END IF;

    -- Verificar FK con CASCADE
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'weight_logs'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND rc.delete_rule = 'CASCADE'
    ) THEN
        RAISE EXCEPTION 'FAIL: weight_logs FK missing ON DELETE CASCADE';
    END IF;

    RAISE NOTICE 'PASS: weight_logs — table OK, constraints OK, CASCADE OK';

    -- ============================================================
    -- 4. Índices
    -- ============================================================
    SELECT COUNT(*) INTO idx_count FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN ('quality_inspections', 'defect_logs', 'weight_logs')
      AND indexname NOT LIKE '%_pkey';

    IF idx_count < 5 THEN
        RAISE EXCEPTION 'FAIL: expected >= 5 non-PK indexes, found %', idx_count;
    END IF;

    RAISE NOTICE 'PASS: indexes — % non-PK indexes found', idx_count;
    RAISE NOTICE 'PASS: ALL 010_quality_inspections checks passed';
END;
$$;
