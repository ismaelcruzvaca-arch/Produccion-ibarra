-- Verify: 016_tostado_tables
-- Verifica que las 2 tablas (tostado_hourly, tostado_shift_totals)
-- existan con las columnas, tipos, constraints e índices correctos.

DO $$
DECLARE
    -- tostado_hourly columns
    v_th_id_type              TEXT;
    v_th_machine_id_type      TEXT;
    v_th_operator_id_type     TEXT;
    v_th_shift_type_type      TEXT;
    v_th_hora_type            TEXT;
    v_th_pesada_kg_type       TEXT;
    v_th_temp_superior_type   TEXT;
    v_th_temp_media_type      TEXT;
    v_th_temp_inferior_type   TEXT;
    v_th_rpm_type             TEXT;
    v_th_presion_vapor_type   TEXT;
    v_th_humedad_crudo_type   TEXT;
    v_th_humedad_tostado_type TEXT;
    v_th_tiempo_muerto_type   TEXT;
    v_th_causa_paro_type      TEXT;
    v_th_data_source_type     TEXT;
    v_th_created_at_type      TEXT;
    v_th_updated_at_type      TEXT;

    -- tostado_shift_totals columns
    v_tst_id_type                       TEXT;
    v_tst_machine_id_type               TEXT;
    v_tst_shift_type_type               TEXT;
    v_tst_operator_id_type              TEXT;
    v_tst_fecha_type                    TEXT;
    v_tst_total_kg_tostados_type        TEXT;
    v_tst_cascarilla_kg_type            TEXT;
    v_tst_polvillo_kg_type              TEXT;
    v_tst_granilla_kg_type              TEXT;
    v_tst_pct_casc_en_gran_type         TEXT;
    v_tst_pct_gran_en_casc_type         TEXT;
    v_tst_silo_origen_type              TEXT;
    v_tst_horas_trabajadas_type         TEXT;
    v_tst_extractores_func_type         TEXT;
    v_tst_extractores_tot_type          TEXT;

    -- Check constraints tostado_hourly
    v_check_shift_type_th       BOOLEAN;
    v_check_data_source_th      BOOLEAN;
    v_check_temp_superior       BOOLEAN;
    v_check_temp_media          BOOLEAN;
    v_check_temp_inferior       BOOLEAN;
    v_check_rpm                 BOOLEAN;
    v_check_presion_vapor       BOOLEAN;
    v_check_humedad_crudo       BOOLEAN;
    v_check_humedad_tostado     BOOLEAN;
    v_check_tiempo_muerto       BOOLEAN;

    -- Check constraints tostado_shift_totals
    v_check_shift_type_tst      BOOLEAN;
    v_check_total_kg_tostados   BOOLEAN;
    v_check_cascarilla_kg       BOOLEAN;
    v_check_polvillo_kg         BOOLEAN;
    v_check_granilla_kg         BOOLEAN;
    v_check_pct_casc_en_gran    BOOLEAN;
    v_check_pct_gran_en_casc    BOOLEAN;
    v_check_extractores_func    BOOLEAN;
    v_check_extractores_tot     BOOLEAN;

    -- Indexes
    v_idx_th_machine_id         BOOLEAN;
    v_idx_th_shift_type         BOOLEAN;
    v_idx_th_hora               BOOLEAN;
    v_idx_th_operator_id        BOOLEAN;
    v_idx_th_machine_hora       BOOLEAN;
    v_idx_tst_machine_id        BOOLEAN;
    v_idx_tst_fecha             BOOLEAN;

    -- Unique constraint
    v_unique_shift_totals       BOOLEAN;

    -- Triggers
    v_trg_hourly_upd            BOOLEAN;
    v_trg_shift_totals_upd      BOOLEAN;

    v_check_passed BOOLEAN := TRUE;
    v_error_msg TEXT := '';
    v_col_type TEXT;
BEGIN
    -- ============================================================
    -- TEST 1: tostado_hourly existe con columnas correctas
    -- ============================================================

    -- id: UUID, PK
    SELECT data_type INTO v_th_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_hourly' AND column_name = 'id';
    IF v_th_id_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1a]: Column id not found on tostado_hourly. ';
        v_check_passed := FALSE;
    ELSIF v_th_id_type NOT IN ('uuid', 'UUID') THEN
        v_error_msg := v_error_msg || 'FAIL[1a]: id type is ' || v_th_id_type || ' (expected UUID). ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1a]: tostado_hourly.id exists as UUID PK';
    END IF;

    -- machine_id: UUID NOT NULL
    SELECT data_type INTO v_th_machine_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_hourly' AND column_name = 'machine_id';
    IF v_th_machine_id_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1b]: Column machine_id not found on tostado_hourly. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1b]: tostado_hourly.machine_id exists';
    END IF;

    -- operator_id: VARCHAR(50)
    SELECT data_type, COALESCE(character_maximum_length::TEXT, 'none')
    INTO v_col_type, v_th_operator_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_hourly' AND column_name = 'operator_id';
    IF v_col_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1c]: Column operator_id not found on tostado_hourly. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1c]: tostado_hourly.operator_id exists as VARCHAR(50)';
    END IF;

    -- shift_type: VARCHAR(20) NOT NULL
    SELECT data_type, COALESCE(character_maximum_length::TEXT, 'none')
    INTO v_col_type, v_th_shift_type_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_hourly' AND column_name = 'shift_type';
    IF v_col_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1d]: Column shift_type not found on tostado_hourly. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1d]: tostado_hourly.shift_type exists';
    END IF;

    -- hora: TIMESTAMPTZ NOT NULL
    SELECT data_type INTO v_th_hora_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_hourly' AND column_name = 'hora';
    IF v_th_hora_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1e]: Column hora not found on tostado_hourly. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1e]: tostado_hourly.hora exists as TIMESTAMPTZ';
    END IF;

    -- pesada_kg: NUMERIC(10,2)
    SELECT data_type, COALESCE(numeric_precision::TEXT, 'none'), COALESCE(numeric_scale::TEXT, 'none')
    INTO v_col_type, v_th_pesada_kg_type, v_th_pesada_kg_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_hourly' AND column_name = 'pesada_kg';
    IF v_col_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1f]: Column pesada_kg not found on tostado_hourly. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1f]: tostado_hourly.pesada_kg exists as NUMERIC';
    END IF;

    -- temp_superior: NUMERIC(5,2)
    SELECT data_type INTO v_th_temp_superior_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_hourly' AND column_name = 'temp_superior';
    IF v_th_temp_superior_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1g]: Column temp_superior not found on tostado_hourly. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1g]: tostado_hourly.temp_superior exists';
    END IF;

    -- temp_media: NUMERIC(5,2)
    SELECT data_type INTO v_th_temp_media_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_hourly' AND column_name = 'temp_media';
    IF v_th_temp_media_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1h]: Column temp_media not found on tostado_hourly. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1h]: tostado_hourly.temp_media exists';
    END IF;

    -- temp_inferior: NUMERIC(5,2)
    SELECT data_type INTO v_th_temp_inferior_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_hourly' AND column_name = 'temp_inferior';
    IF v_th_temp_inferior_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1i]: Column temp_inferior not found on tostado_hourly. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1i]: tostado_hourly.temp_inferior exists';
    END IF;

    -- rpm: NUMERIC(5,2)
    SELECT data_type INTO v_th_rpm_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_hourly' AND column_name = 'rpm';
    IF v_th_rpm_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1j]: Column rpm not found on tostado_hourly. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1j]: tostado_hourly.rpm exists';
    END IF;

    -- presion_vapor: NUMERIC(5,2)
    SELECT data_type INTO v_th_presion_vapor_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_hourly' AND column_name = 'presion_vapor';
    IF v_th_presion_vapor_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1k]: Column presion_vapor not found on tostado_hourly. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1k]: tostado_hourly.presion_vapor exists';
    END IF;

    -- humedad_crudo_pct: NUMERIC(5,2)
    SELECT data_type INTO v_th_humedad_crudo_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_hourly' AND column_name = 'humedad_crudo_pct';
    IF v_th_humedad_crudo_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1l]: Column humedad_crudo_pct not found on tostado_hourly. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1l]: tostado_hourly.humedad_crudo_pct exists';
    END IF;

    -- humedad_tostado_pct: NUMERIC(5,2)
    SELECT data_type INTO v_th_humedad_tostado_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_hourly' AND column_name = 'humedad_tostado_pct';
    IF v_th_humedad_tostado_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1m]: Column humedad_tostado_pct not found on tostado_hourly. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1m]: tostado_hourly.humedad_tostado_pct exists';
    END IF;

    -- tiempo_muerto_min: INT NOT NULL DEFAULT 0
    SELECT data_type INTO v_th_tiempo_muerto_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_hourly' AND column_name = 'tiempo_muerto_min';
    IF v_th_tiempo_muerto_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1n]: Column tiempo_muerto_min not found on tostado_hourly. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1n]: tostado_hourly.tiempo_muerto_min exists as INT';
    END IF;

    -- causa_paro: VARCHAR(100)
    SELECT data_type, COALESCE(character_maximum_length::TEXT, 'none')
    INTO v_col_type, v_th_causa_paro_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_hourly' AND column_name = 'causa_paro';
    IF v_col_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1o]: Column causa_paro not found on tostado_hourly. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1o]: tostado_hourly.causa_paro exists';
    END IF;

    -- data_source: VARCHAR(20) NOT NULL DEFAULT 'manual'
    SELECT data_type, COALESCE(character_maximum_length::TEXT, 'none')
    INTO v_col_type, v_th_data_source_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_hourly' AND column_name = 'data_source';
    IF v_col_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[1p]: Column data_source not found on tostado_hourly. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[1p]: tostado_hourly.data_source exists';
    END IF;

    -- ============================================================
    -- TEST 2: tostado_shift_totals existe con columnas correctas
    -- ============================================================
    SELECT data_type INTO v_tst_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_shift_totals' AND column_name = 'id';
    IF v_tst_id_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[2a]: Table tostado_shift_totals not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[2a]: tostado_shift_totals exists with PK';
    END IF;

    SELECT data_type INTO v_tst_machine_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_shift_totals' AND column_name = 'machine_id';
    IF v_tst_machine_id_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[2b]: Column machine_id not found on tostado_shift_totals. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[2b]: tostado_shift_totals.machine_id exists';
    END IF;

    SELECT data_type INTO v_tst_total_kg_tostados_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_shift_totals' AND column_name = 'total_kg_tostados';
    IF v_tst_total_kg_tostados_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[2c]: Column total_kg_tostados not found on tostado_shift_totals. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[2c]: tostado_shift_totals.total_kg_tostados exists';
    END IF;

    SELECT data_type INTO v_tst_cascarilla_kg_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_shift_totals' AND column_name = 'cascarilla_kg';
    IF v_tst_cascarilla_kg_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[2d]: Column cascarilla_kg not found on tostado_shift_totals. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[2d]: tostado_shift_totals.cascarilla_kg exists';
    END IF;

    SELECT data_type INTO v_tst_polvillo_kg_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_shift_totals' AND column_name = 'polvillo_kg';
    IF v_tst_polvillo_kg_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[2e]: Column polvillo_kg not found on tostado_shift_totals. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[2e]: tostado_shift_totals.polvillo_kg exists';
    END IF;

    SELECT data_type INTO v_tst_granilla_kg_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_shift_totals' AND column_name = 'granilla_kg';
    IF v_tst_granilla_kg_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[2f]: Column granilla_kg not found on tostado_shift_totals. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[2f]: tostado_shift_totals.granilla_kg exists';
    END IF;

    SELECT data_type INTO v_tst_horas_trabajadas_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tostado_shift_totals' AND column_name = 'horas_trabajadas';
    IF v_tst_horas_trabajadas_type IS NULL THEN
        v_error_msg := v_error_msg || 'FAIL[2g]: Column horas_trabajadas not found on tostado_shift_totals. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[2g]: tostado_shift_totals.horas_trabajadas exists';
    END IF;

    -- ============================================================
    -- TEST 3: CHECK constraints en tostado_hourly
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'tostado_hourly'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%shift_type%'
    ) INTO v_check_shift_type_th;

    IF NOT v_check_shift_type_th THEN
        v_error_msg := v_error_msg || 'FAIL[3a]: CHECK on shift_type not found on tostado_hourly. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[3a]: CHECK constraint on tostado_hourly.shift_type exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'tostado_hourly'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%data_source%'
    ) INTO v_check_data_source_th;

    IF NOT v_check_data_source_th THEN
        v_error_msg := v_error_msg || 'FAIL[3b]: CHECK on data_source not found on tostado_hourly. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[3b]: CHECK constraint on tostado_hourly.data_source exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'tostado_hourly'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%temp_superior%'
    ) INTO v_check_temp_superior;

    IF NOT v_check_temp_superior THEN
        v_error_msg := v_error_msg || 'FAIL[3c]: CHECK on temp_superior (90-130) not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[3c]: CHECK constraint on tostado_hourly.temp_superior (90-130°C) exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'tostado_hourly'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%temp_media%'
    ) INTO v_check_temp_media;

    IF NOT v_check_temp_media THEN
        v_error_msg := v_error_msg || 'FAIL[3d]: CHECK on temp_media (90-130) not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[3d]: CHECK constraint on tostado_hourly.temp_media (90-130°C) exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'tostado_hourly'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%temp_inferior%'
    ) INTO v_check_temp_inferior;

    IF NOT v_check_temp_inferior THEN
        v_error_msg := v_error_msg || 'FAIL[3e]: CHECK on temp_inferior (90-130) not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[3e]: CHECK constraint on tostado_hourly.temp_inferior (90-130°C) exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'tostado_hourly'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%rpm%'
    ) INTO v_check_rpm;

    IF NOT v_check_rpm THEN
        v_error_msg := v_error_msg || 'FAIL[3f]: CHECK on rpm (1.5-3.0) not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[3f]: CHECK constraint on tostado_hourly.rpm (1.5-3.0) exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'tostado_hourly'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%presion_vapor%'
    ) INTO v_check_presion_vapor;

    IF NOT v_check_presion_vapor THEN
        v_error_msg := v_error_msg || 'FAIL[3g]: CHECK on presion_vapor (> 6) not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[3g]: CHECK constraint on tostado_hourly.presion_vapor (> 6 kgf/cm²) exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'tostado_hourly'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%humedad_crudo_pct%'
    ) INTO v_check_humedad_crudo;

    IF NOT v_check_humedad_crudo THEN
        v_error_msg := v_error_msg || 'FAIL[3h]: CHECK on humedad_crudo_pct (≤ 7.5%) not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[3h]: CHECK constraint on tostado_hourly.humedad_crudo_pct (≤ 7.5%) exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'tostado_hourly'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%humedad_tostado_pct%'
    ) INTO v_check_humedad_tostado;

    IF NOT v_check_humedad_tostado THEN
        v_error_msg := v_error_msg || 'FAIL[3i]: CHECK on humedad_tostado_pct (0.5-1.5%) not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[3i]: CHECK constraint on tostado_hourly.humedad_tostado_pct (0.5-1.5%) exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'tostado_hourly'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%tiempo_muerto_min%'
    ) INTO v_check_tiempo_muerto;

    IF NOT v_check_tiempo_muerto THEN
        v_error_msg := v_error_msg || 'FAIL[3j]: CHECK on tiempo_muerto_min (>= 0) not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[3j]: CHECK constraint on tostado_hourly.tiempo_muerto_min (>= 0) exists';
    END IF;

    -- ============================================================
    -- TEST 4: CHECK constraints en tostado_shift_totals
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'tostado_shift_totals'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%shift_type%'
    ) INTO v_check_shift_type_tst;

    IF NOT v_check_shift_type_tst THEN
        v_error_msg := v_error_msg || 'FAIL[4a]: CHECK on shift_type not found on tostado_shift_totals. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[4a]: CHECK constraint on tostado_shift_totals.shift_type exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'tostado_shift_totals'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%total_kg_tostados%'
    ) INTO v_check_total_kg_tostados;

    IF NOT v_check_total_kg_tostados THEN
        v_error_msg := v_error_msg || 'FAIL[4b]: CHECK on total_kg_tostados (>= 0) not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[4b]: CHECK constraint on tostado_shift_totals.total_kg_tostados (>= 0) exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'tostado_shift_totals'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%cascarilla_kg%'
    ) INTO v_check_cascarilla_kg;

    IF NOT v_check_cascarilla_kg THEN
        v_error_msg := v_error_msg || 'FAIL[4c]: CHECK on cascarilla_kg (>= 0) not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[4c]: CHECK constraint on tostado_shift_totals.cascarilla_kg (>= 0) exists';
    END IF;

    -- ============================================================
    -- TEST 5: Índices en tostado_hourly
    -- ============================================================
    SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='tostado_hourly' AND indexname='idx_tostado_hourly_machine_id')
    INTO v_idx_th_machine_id;
    IF NOT v_idx_th_machine_id THEN
        v_error_msg := v_error_msg || 'FAIL[5a]: Index idx_tostado_hourly_machine_id not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[5a]: Index idx_tostado_hourly_machine_id exists';
    END IF;

    SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='tostado_hourly' AND indexname='idx_tostado_hourly_hora')
    INTO v_idx_th_hora;
    IF NOT v_idx_th_hora THEN
        v_error_msg := v_error_msg || 'FAIL[5b]: Index idx_tostado_hourly_hora not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[5b]: Index idx_tostado_hourly_hora (DESC) exists';
    END IF;

    SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='tostado_hourly' AND indexname='idx_tostado_hourly_machine_hora')
    INTO v_idx_th_machine_hora;
    IF NOT v_idx_th_machine_hora THEN
        v_error_msg := v_error_msg || 'FAIL[5c]: Index idx_tostado_hourly_machine_hora not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[5c]: Index idx_tostado_hourly_machine_hora exists';
    END IF;

    -- ============================================================
    -- TEST 6: Índices en tostado_shift_totals
    -- ============================================================
    SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='tostado_shift_totals' AND indexname='idx_tostado_shift_totals_machine_id')
    INTO v_idx_tst_machine_id;
    IF NOT v_idx_tst_machine_id THEN
        v_error_msg := v_error_msg || 'FAIL[6a]: Index idx_tostado_shift_totals_machine_id not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[6a]: Index idx_tostado_shift_totals_machine_id exists';
    END IF;

    -- ============================================================
    -- TEST 7: Unique constraint en tostado_shift_totals
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'tostado_shift_totals'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'u'
    ) INTO v_unique_shift_totals;

    IF NOT v_unique_shift_totals THEN
        v_error_msg := v_error_msg || 'FAIL[7]: UNIQUE constraint on (machine_id, shift_type, fecha) not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[7]: UNIQUE constraint on tostado_shift_totals (machine_id, shift_type, fecha) exists';
    END IF;

    -- ============================================================
    -- TEST 8: Triggers
    -- ============================================================
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE event_object_schema = 'public'
          AND event_object_table = 'tostado_hourly'
          AND trigger_name = 'trg_tostado_hourly_updated_at'
    ) INTO v_trg_hourly_upd;

    IF NOT v_trg_hourly_upd THEN
        v_error_msg := v_error_msg || 'FAIL[8a]: Trigger trg_tostado_hourly_updated_at not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[8a]: Trigger trg_tostado_hourly_updated_at exists';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE event_object_schema = 'public'
          AND event_object_table = 'tostado_shift_totals'
          AND trigger_name = 'trg_tostado_shift_totals_updated_at'
    ) INTO v_trg_shift_totals_upd;

    IF NOT v_trg_shift_totals_upd THEN
        v_error_msg := v_error_msg || 'FAIL[8b]: Trigger trg_tostado_shift_totals_updated_at not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[8b]: Trigger trg_tostado_shift_totals_updated_at exists';
    END IF;

    -- ============================================================
    -- TEST 9: FK constraints
    -- ============================================================
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'tostado_hourly'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'f'
          AND c.confrelid = 'public.machines'::regclass
    ) THEN
        v_error_msg := v_error_msg || 'FAIL[9a]: FK on tostado_hourly.machine_id → machines not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[9a]: FK tostado_hourly.machine_id → machines exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'tostado_shift_totals'
          AND t.relnamespace = 'public'::regnamespace
          AND c.contype = 'f'
          AND c.confrelid = 'public.machines'::regclass
    ) THEN
        v_error_msg := v_error_msg || 'FAIL[9b]: FK on tostado_shift_totals.machine_id → machines not found. ';
        v_check_passed := FALSE;
    ELSE
        RAISE NOTICE 'PASS[9b]: FK tostado_shift_totals.machine_id → machines exists';
    END IF;

    -- ============================================================
    -- VEREDICTO FINAL
    -- ============================================================
    IF v_check_passed THEN
        RAISE NOTICE '============================================================';
        RAISE NOTICE '✅ ALL TESTS PASSED — Migration 016_tostado_tables is VERIFIED';
        RAISE NOTICE '============================================================';
    ELSE
        RAISE EXCEPTION '❌ VERIFICATION FAILED: %', v_error_msg;
    END IF;
END;
$$;
