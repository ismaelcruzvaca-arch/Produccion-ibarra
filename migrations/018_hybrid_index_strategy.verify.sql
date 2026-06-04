-- Verify: 018_hybrid_index_strategy
-- Verifica que todos los índices de la estrategia híbrida existen

DO $$
DECLARE
    v_total INT;
    v_errors TEXT := '';
BEGIN
    -- 1. BRIN indexes (3)
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_telemetry_raw_received_at_brin') THEN
        v_errors := v_errors || 'MISSING: idx_telemetry_raw_received_at_brin (BRIN). ';
    ELSE
        RAISE NOTICE '✅ BRIN idx_telemetry_raw_received_at_brin OK';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_oee_events_timestamp_brin') THEN
        v_errors := v_errors || 'MISSING: idx_oee_events_timestamp_brin (BRIN). ';
    ELSE
        RAISE NOTICE '✅ BRIN idx_oee_events_timestamp_brin OK';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tostado_hourly_hora_brin') THEN
        v_errors := v_errors || 'MISSING: idx_tostado_hourly_hora_brin (BRIN). ';
    ELSE
        RAISE NOTICE '✅ BRIN idx_tostado_hourly_hora_brin OK';
    END IF;

    -- 2. B-Tree composite indexes (12)
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_quality_inspections_group') THEN
        v_errors := v_errors || 'MISSING: idx_quality_inspections_group. ';
    ELSE
        RAISE NOTICE '✅ BTREE idx_quality_inspections_group OK';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_defect_logs_inspection_group') THEN
        v_errors := v_errors || 'MISSING: idx_defect_logs_inspection_group. ';
    ELSE
        RAISE NOTICE '✅ BTREE idx_defect_logs_inspection_group OK';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_weight_logs_inspection_id') THEN
        v_errors := v_errors || 'MISSING: idx_weight_logs_inspection_id. ';
    ELSE
        RAISE NOTICE '✅ BTREE idx_weight_logs_inspection_id OK';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_mezclado_batches_group') THEN
        v_errors := v_errors || 'MISSING: idx_mezclado_batches_group. ';
    ELSE
        RAISE NOTICE '✅ BTREE idx_mezclado_batches_group OK';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_mezclado_ingredients_batch_group') THEN
        v_errors := v_errors || 'MISSING: idx_mezclado_ingredients_batch_group. ';
    ELSE
        RAISE NOTICE '✅ BTREE idx_mezclado_ingredients_batch_group OK';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_mezclado_shift_totals_group') THEN
        v_errors := v_errors || 'MISSING: idx_mezclado_shift_totals_group. ';
    ELSE
        RAISE NOTICE '✅ BTREE idx_mezclado_shift_totals_group OK';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tostado_hourly_group') THEN
        v_errors := v_errors || 'MISSING: idx_tostado_hourly_group. ';
    ELSE
        RAISE NOTICE '✅ BTREE idx_tostado_hourly_group OK';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tostado_shift_totals_group') THEN
        v_errors := v_errors || 'MISSING: idx_tostado_shift_totals_group. ';
    ELSE
        RAISE NOTICE '✅ BTREE idx_tostado_shift_totals_group OK';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_vitaminas_batches_group') THEN
        v_errors := v_errors || 'MISSING: idx_vitaminas_batches_group. ';
    ELSE
        RAISE NOTICE '✅ BTREE idx_vitaminas_batches_group OK';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_vitaminas_ingredients_batch_group') THEN
        v_errors := v_errors || 'MISSING: idx_vitaminas_ingredients_batch_group. ';
    ELSE
        RAISE NOTICE '✅ BTREE idx_vitaminas_ingredients_batch_group OK';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_shift_sessions_group') THEN
        v_errors := v_errors || 'MISSING: idx_shift_sessions_group. ';
    ELSE
        RAISE NOTICE '✅ BTREE idx_shift_sessions_group OK';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_reports_group') THEN
        v_errors := v_errors || 'MISSING: idx_reports_group. ';
    ELSE
        RAISE NOTICE '✅ BTREE idx_reports_group OK';
    END IF;

    -- Ver resumen
    SELECT COUNT(*) INTO v_total FROM pg_indexes
    WHERE indexname IN (
        'idx_telemetry_raw_received_at_brin',
        'idx_oee_events_timestamp_brin',
        'idx_tostado_hourly_hora_brin',
        'idx_quality_inspections_group',
        'idx_defect_logs_inspection_group',
        'idx_weight_logs_inspection_id',
        'idx_mezclado_batches_group',
        'idx_mezclado_ingredients_batch_group',
        'idx_mezclado_shift_totals_group',
        'idx_tostado_hourly_group',
        'idx_tostado_shift_totals_group',
        'idx_vitaminas_batches_group',
        'idx_vitaminas_ingredients_batch_group',
        'idx_shift_sessions_group',
        'idx_reports_group'
    );

    IF v_errors != '' THEN
        RAISE EXCEPTION '❌ VERIFICATION FAILED — Missing indexes: %', v_errors;
    ELSE
        RAISE NOTICE '==========================================================';
        RAISE NOTICE '✅ ALL %/15 INDEXES VERIFIED — Estrategia híbrida B-Tree + BRIN lista', v_total;
        RAISE NOTICE '   BRIN: 3 (telemetría/series de tiempo)';
        RAISE NOTICE '   BTREE: 12 (tablas transaccionales)';
        RAISE NOTICE '==========================================================';
    END IF;
END;
$$;
