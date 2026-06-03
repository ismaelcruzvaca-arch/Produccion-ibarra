-- Migration: 012_rls_remaining_tables
-- Enables RLS on tables that don't have it yet and tightens signatures policy
--
-- Phase 3 of Wave 4: Enables RLS on 5 catalog tables + operator_profiles,
-- then drops the wide-open signatures_self policy and creates a tightened
-- one that scopes operators to their own signatures while supervisor/admin
-- see all.

-- Enable RLS on catalog tables + operator_profiles
ALTER TABLE public.stop_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_profiles ENABLE ROW LEVEL SECURITY;

-- Grant base table access (Hasura enforces per-role RLS on top)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stop_reasons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_profiles TO authenticated;

-- Signatures: drop old wide-open policy, create role-aware tightened one
DROP POLICY IF EXISTS signatures_self ON public.signatures;

CREATE POLICY signatures_tightened ON public.signatures
    FOR ALL
    USING (
        current_setting('hasura.allowed_roles', true) LIKE '%supervisor%'
        OR current_setting('hasura.allowed_roles', true) LIKE '%admin%'
        OR signer_id = current_setting('hasura.user', true)
    )
    WITH CHECK (
        current_setting('hasura.allowed_roles', true) LIKE '%supervisor%'
        OR current_setting('hasura.allowed_roles', true) LIKE '%admin%'
        OR signer_id = current_setting('hasura.user', true)
    );

COMMENT ON POLICY signatures_tightened ON public.signatures IS
    'Operator sees own signatures (signer_id), supervisor/admin sees all via hasura.allowed_roles';
