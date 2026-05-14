-- Migration: 003_operator_profiles
-- Operator profile extensions

CREATE TABLE IF NOT EXISTS public.operator_profiles (
    id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name  text,
    role       text NOT NULL DEFAULT 'operator'
        CHECK (role IN ('operator', 'supervisor', 'admin')),
    created_at timestamptz DEFAULT now(),
    updated_at bigint NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.operator_profiles IS 'Extended profile for production operators';
