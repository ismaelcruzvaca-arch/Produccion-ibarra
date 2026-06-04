/**
 * Design Tokens — single source of truth for colors, spacing, typography, radii, shadows.
 *
 * Pattern: Design Token File
 * Why:
 * - Every hardcoded color, spacing, or radius is an accident waiting to happen.
 * - Centralizing all visual primitives in one file ensures consistency across the UI.
 * - Components NEVER import tokens directly; they consume them via `useTheme()` from Paper.
 *   The `theme/index.ts` file merges these tokens into the Paper MD3 theme.
 *
 * Color palette extracted from existing components:
 * - Primary:    #5D4037 (brown, text/headers)
 * - Secondary:  #757575 (gray, subtitles)
 * - Error:      #D32F2F (red, errors/downtime)
 * - Success:    #388E3C (green, OEE values)
 * - Warning:    #F9A825 (amber, end downtime button)
 * - Online:     #4CAF50 (green, sync)
 * - Offline:    #F44336 (red, connection)
 * - Caution:    #FF9800 (amber, warning)
 * - DarkGreen:  #2E7D32
 * - LightGreen: #558B2F
 * - BgGreen:    #E8F5E9
 * - BgRed:      #FFEBEE
 * - BgGray:     #FAFAFA
 * - White:      #FFFFFF
 */

// ─── Colors ───────────────────────────────────────────────────────────────────

export const colors = {
  // Primary palette
  primary: '#5D4037' as const,
  secondary: '#757575' as const,

  // Semantic
  error: '#D32F2F' as const,
  success: '#388E3C' as const,
  warning: '#F9A825' as const,
  caution: '#FF9800' as const,

  // Status
  online: '#4CAF50' as const,
  offline: '#F44336' as const,

  // Extended greens
  darkGreen: '#2E7D32' as const,
  lightGreen: '#558B2F' as const,

  // Backgrounds
  bgGreen: '#E8F5E9' as const,
  bgRed: '#FFEBEE' as const,
  bgGray: '#FAFAFA' as const,
  white: '#FFFFFF' as const,

  // Text
  textPrimary: '#5D4037' as const,
  textSecondary: '#757575' as const,
  textOnPrimary: '#FFFFFF' as const,
  textError: '#B71C1C' as const,
  textWarning: '#E65100' as const,

  // Borders
  border: '#E0E0E0' as const,
  borderError: '#EF9A9A' as const,
  borderRed: '#EF9A9A' as const,

  // Surfaces
  surface: '#FFFFFF' as const,
  surfaceWarning: '#FFF3E0' as const,
  displayBg: '#F5F5F5' as const,
} as const;

// ─── Spacing (4px base unit) ──────────────────────────────────────────────────

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const typography = {
  sizes: {
    xs: 10,
    sm: 11,
    bodySmall: 12,
    bodyMedium: 14,
    bodyLarge: 15,
    button: 16,
    titleSmall: 16,
    titleMedium: 18,
    titleLarge: 20,
    headlineMedium: 22,
    displayValue: 32,
    kpiValue: 28,
  },
  weights: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

// ─── Border Radii ─────────────────────────────────────────────────────────────

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  round: 999,
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
} as const;

// ─── Touch Target ─────────────────────────────────────────────────────────────

export const touchTarget = {
  minHeight: 56,
  minWidth: 100,
  largeHeight: 64,
  largeWidth: 120,
  giantHeight: 72,
} as const;

// ─── OEE Limits ───────────────────────────────────────────────────────────────

export const oeeLimits = {
  hardLimit: 99999,
  softLimit: 50000,
} as const;
