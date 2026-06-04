/**
 * useSettingsPermissions — Permission model for settings sections.
 *
 * Pattern: Atomic Design — Hook
 * Why:
 * - Centralizes role-based section visibility (AD-1).
 * - Single TS config object maps sections to allowed roles.
 * - Returns visibleSections[] and a canAccess() helper.
 *
 * Roles: 'operator', 'supervisor', 'admin'
 *
 * Sections:
 * - profile:   All roles (name, role, line, sync, sign out)
 * - powerbi:   Supervisor + Admin (Power BI deep-link)
 * - catalogs:  Admin only (CRUD on stop_reasons, lines, machines)
 * - system:    All roles (version, Nhost info, sync status)
 */

import { useAuthStore } from '../../auth/useAuthStore';

// ─── Permission Config ─────────────────────────────────────────────────────────────

const SETTINGS_PERMISSIONS: Record<string, string[]> = {
  profile: ['operator', 'supervisor', 'admin'],
  powerbi: ['supervisor', 'admin'],
  plant_config: ['supervisor', 'admin'],
  catalogs: ['admin'],
  system: ['operator', 'supervisor', 'admin'],
} as const;

// ─── Ordered sections for rendering ────────────────────────────────────────────────

const SECTION_ORDER = ['profile', 'powerbi', 'plant_config', 'catalogs', 'system'] as const;

// ─── Hook ──────────────────────────────────────────────────────────────────────────

export function useSettingsPermissions() {
  const userRole = useAuthStore((s) => s.role) ?? 'operator';

  const visibleSections = SECTION_ORDER.filter((section) =>
    SETTINGS_PERMISSIONS[section]?.includes(userRole),
  );

  const canAccess = (section: string): boolean => {
    const allowedRoles = SETTINGS_PERMISSIONS[section];
    if (!allowedRoles) return false;
    return allowedRoles.includes(userRole);
  };

  return {
    visibleSections,
    canAccess,
    userRole,
  };
}
