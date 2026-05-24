-- Verify: 009_quality_weight_standards
-- Verifica que la tabla product_weight_standards exista con la estructura correcta

DO $$
DECLARE
    col_count INT;
    seed_count INT;
    trigger_exists BOOLEAN;
BEGIN
    -- 1. Verificar que la tabla existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'product_weight_standards'
    ) THEN
        RAISE EXCEPTION 'FAIL: table public.product_weight_standards does not exist';
    END IF;

    -- 2. Verificar columnas y tipos
    SELECT COUNT(*) INTO col_count FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_weight_standards';

    IF col_count < 6 THEN
        RAISE EXCEPTION 'FAIL: product_weight_standards has % columns (expected >= 6)', col_count;
    END IF;

    -- 3. Verificar PK (sku)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'product_weight_standards'
          AND tc.constraint_type = 'PRIMARY KEY'
          AND ccu.column_name = 'sku'
    ) THEN
        RAISE EXCEPTION 'FAIL: product_weight_standards PK is not on column sku';
    END IF;

    -- 4. Verificar CHECK constraints
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name ~ 'product_weight_standards.*lower_limit'
           OR constraint_name ~ 'product_weight_standards.*upper_limit'
    ) THEN
        RAISE EXCEPTION 'FAIL: product_weight_standards missing CHECK constraints on lower_limit/upper_limit';
    END IF;

    -- 5. Verificar seed data
    SELECT COUNT(*) INTO seed_count FROM public.product_weight_standards;
    IF seed_count < 1 THEN
        RAISE EXCEPTION 'FAIL: product_weight_standards has no seed data (expected >= 1)';
    END IF;

    -- 6. Verificar trigger
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE event_object_table = 'product_weight_standards'
          AND trigger_name = 'trg_weight_standards_updated_at'
    ) INTO trigger_exists;

    IF NOT trigger_exists THEN
        RAISE EXCEPTION 'FAIL: trigger trg_weight_standards_updated_at not found';
    END IF;

    -- 7. Mostrar resumen
    RAISE NOTICE 'PASS: product_weight_standards — % columns, % seed rows, trigger present', col_count, seed_count;
END;
$$;
