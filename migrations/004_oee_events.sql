-- Migration: 001_oee_events
-- Creates the oee_events table for OEE event capture

CREATE TABLE IF NOT EXISTS public.oee_events (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    updated_at       bigint NOT NULL,
    deleted          boolean NOT NULL DEFAULT false,
    line_id          uuid NOT NULL REFERENCES public.lines(id),
    machine_id       uuid NOT NULL REFERENCES public.machines(id),
    operator_id      uuid REFERENCES auth.users(id),
    shift_id         uuid NOT NULL REFERENCES public.shifts(id),
    event_type       text NOT NULL CHECK (event_type IN (
        'shift_start', 'shift_end', 'downtime_start',
        'downtime_end', 'box_count', 'reject_count'
    )),
    timestamp        bigint NOT NULL,
    reason_code      text,
    quantity         integer,
    planned_boxes    integer,
    notes            text,
    is_retroactive   boolean DEFAULT false,
    related_event_id uuid
);

-- Indexes for performance (matching RxDB indexes)
CREATE INDEX IF NOT EXISTS idx_oee_events_timestamp ON public.oee_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_oee_events_line_timestamp ON public.oee_events(line_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_oee_events_shift_timestamp ON public.oee_events(shift_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_oee_events_updated_at ON public.oee_events(updated_at);
CREATE INDEX IF NOT EXISTS idx_oee_events_operator ON public.oee_events(operator_id);

-- Note: Primary key constraint is named automatically as "oee_events_pkey"
-- If you need to rename it explicitly, use:
-- ALTER TABLE public.oee_events ADD CONSTRAINT IF NOT EXISTS oee_events_pkey PRIMARY KEY (id);
-- But this conflicts with the PRIMARY KEY clause above. Just ensure the PK exists.

COMMENT ON TABLE public.oee_events IS 'OEE atomic events for production tracking';
