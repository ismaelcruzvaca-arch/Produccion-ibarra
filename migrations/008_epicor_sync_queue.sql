-- Migration: 008_epicor_sync_queue
-- Queue table for tracking Epicor ERP sync operations

CREATE TABLE IF NOT EXISTS public.epicor_sync_queue (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_table   text NOT NULL,
    source_row_id  uuid NOT NULL,
    status         text NOT NULL DEFAULT 'pending',
    payload        jsonb NOT NULL,
    retry_count    int NOT NULL DEFAULT 0,
    max_retries    int NOT NULL DEFAULT 3,
    error_info     jsonb,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz,
    started_at     timestamptz,
    completed_at   timestamptz,

    CONSTRAINT chk_epicor_sync_status
        CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_epicor_sync_status
    ON public.epicor_sync_queue(status);

COMMENT ON TABLE public.epicor_sync_queue
    IS 'Queue entries for tracking and retrying Epicor ERP sync operations';
