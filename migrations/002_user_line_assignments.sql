-- Migration: 002_user_line_assignments
-- Junction table for multi-line operator assignments

CREATE TABLE IF NOT EXISTS public.user_line_assignments (
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    line_id text NOT NULL,
    assigned_at timestamptz DEFAULT now(),
    assigned_by uuid REFERENCES auth.users(id),
    PRIMARY KEY (user_id, line_id)
);

CREATE INDEX IF NOT EXISTS idx_user_line_assignments_line ON public.user_line_assignments(line_id);

COMMENT ON TABLE public.user_line_assignments IS 'Links operators to their assigned production lines (1:N)';
