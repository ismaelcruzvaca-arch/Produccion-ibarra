-- Migration: 007_telemetry_raw_staging
-- Raw telemetry payloads from MQTT gateway, staged before Epicor sync

CREATE TABLE IF NOT EXISTS public.telemetry_raw_staging (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id     uuid NOT NULL,
    payload        jsonb NOT NULL,
    received_at    timestamptz NOT NULL DEFAULT now(),
    processed_at   timestamptz,
    status         text NOT NULL DEFAULT 'pending',
    error_info     jsonb,
    gateway_msg_id text,

    CONSTRAINT fk_telemetry_raw_machine
        FOREIGN KEY (machine_id)
        REFERENCES public.machines(id),

    CONSTRAINT chk_telemetry_raw_status
        CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_telemetry_raw_status
    ON public.telemetry_raw_staging(status);

CREATE INDEX IF NOT EXISTS idx_telemetry_raw_machine
    ON public.telemetry_raw_staging(machine_id);

COMMENT ON TABLE public.telemetry_raw_staging
    IS 'Raw telemetry payloads from MQTT gateway, staged before Epicor sync';
