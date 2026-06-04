/**
 * Paper Theme — merges design tokens into react-native-paper MD3 theme.
 *
 * Pattern: Theme Adapter
 * Why:
 * - Components consume design tokens via `useTheme()` from react-native-paper.
 * - This file acts as the bridge between raw `tokens.ts` and Paper's MD3 theme.
 * - Components NEVER import `tokens.ts` directly — they call `useTheme()`.
 *
 * Usage:
 *   import { MD3LightTheme, PaperProvider } from 'react-native-paper';
 *   import { paperTheme } from './src/ui/theme';
 *
 *   <PaperProvider theme={paperTheme}>
 *     <App />
 *   </PaperProvider>
 */

import { MD3LightTheme, configureFonts } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { colors, borderRadius, spacing } from './tokens';

/**
 * Font configuration matching our typography tokens.
 * Uses the default system font but with our weight/size scale.
 */
const fontConfig = {
  displayLarge: { fontFamily: 'System', fontWeight: '700' as const, fontSize: 32 },
  displayMedium: { fontFamily: 'System', fontWeight: '700' as const, fontSize: 28 },
  displaySmall: { fontFamily: 'System', fontWeight: '600' as const, fontSize: 24 },
  headlineLarge: { fontFamily: 'System', fontWeight: '600' as const, fontSize: 22 },
  headlineMedium: { fontFamily: 'System', fontWeight: '700' as const, fontSize: 20 },
  headlineSmall: { fontFamily: 'System', fontWeight: '600' as const, fontSize: 18 },
  titleLarge: { fontFamily: 'System', fontWeight: '700' as const, fontSize: 20 },
  titleMedium: { fontFamily: 'System', fontWeight: '600' as const, fontSize: 16 },
  titleSmall: { fontFamily: 'System', fontWeight: '600' as const, fontSize: 14 },
  bodyLarge: { fontFamily: 'System', fontWeight: '400' as const, fontSize: 16 },
  bodyMedium: { fontFamily: 'System', fontWeight: '400' as const, fontSize: 14 },
  bodySmall: { fontFamily: 'System', fontWeight: '400' as const, fontSize: 12 },
  labelLarge: { fontFamily: 'System', fontWeight: '600' as const, fontSize: 14 },
  labelMedium: { fontFamily: 'System', fontWeight: '500' as const, fontSize: 12 },
  labelSmall: { fontFamily: 'System', fontWeight: '500' as const, fontSize: 10 },
};

export const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    error: colors.error,
    secondary: colors.secondary,
    surface: colors.white,
    background: colors.bgGray,
    onPrimary: colors.textOnPrimary,
    onSecondary: colors.textOnPrimary,
    onSurface: colors.textPrimary,
    onBackground: colors.textPrimary,
    onError: colors.textOnPrimary,
    outline: colors.border,
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level0: 'transparent',
      level1: colors.white,
      level2: colors.bgGray,
    },
  },
  roundness: borderRadius.sm,
  spacing: {
    xs: spacing.xs,
    sm: spacing.sm,
    md: spacing.md,
    lg: spacing.lg,
    xl: spacing.xl,
  },
  // Custom properties accessible via theme.extended in custom components
  ...({
    customTokens: {
      colors,
      spacing,
      borderRadius,
      oeeLimits: { hardLimit: 99999, softLimit: 50000 },
    },
  } as any),
};

export type AppTheme = typeof paperTheme;
