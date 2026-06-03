-- Migration: 014_user_plants_admin_rls
-- Admin/supervisor RLS bypass for user_plants
--
-- The existing user_plants_self policy scopes every user to their own rows.
-- Admins and supervisors need read/write access to ALL user_plants rows
-- to manage plant assignments from the admin UI.
--
-- This policy uses auth.uid() → operator_profiles JOIN to check the caller's
-- role, bypassing the self-scoped policy for elevated roles.
--
-- Dependencies: migration 010_user_plants.sql (creates the table + self policy)
--               migration 006_operator_profiles.sql (creates operator_profiles)

-- Allow admins and supervisors full access to all user_plants rows
CREATE POLICY user_plants_admin ON public.user_plants
    FOR ALL
    USING (auth.uid() IN (
        SELECT id FROM public.operator_profiles WHERE role IN ('admin', 'supervisor')
    ));

COMMENT ON POLICY user_plants_admin ON public.user_plants IS
    'Admin/supervisor bypass — full access to all user_plants rows via operator_profiles role check';
