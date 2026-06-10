/**
 * useResponsive — Hook that exposes responsive breakpoint info.
 *
 * Pattern: Hook + Constants
 * Why:
 * - Centralises breakpoint logic so layouts and components query the same source.
 * - Uses useWindowDimensions to react to orientation/split-screen changes.
 *
 * Breakpoints (from spec RL-4):
 *   phone:       <600dp   — full-width stacked
 *   tablet:      ≥600dp   — max-width 840dp centred
 *   largeTablet: ≥840dp   — max-width capped at 840dp
 */

import { useWindowDimensions } from 'react-native';

export const BREAKPOINTS = {
  phone: 600,
  tablet: 600,
  largeTablet: 840,
} as const;

export interface ResponsiveInfo {
  isTablet: boolean;       // width >= 600
  isPhone: boolean;        // width < 600
  isLargeTablet: boolean;  // width >= 840
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
}

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();

  return {
    isTablet: width >= BREAKPOINTS.tablet,
    isPhone: width < BREAKPOINTS.phone,
    isLargeTablet: width >= BREAKPOINTS.largeTablet,
    width,
    height,
    orientation: width >= height ? 'landscape' : 'portrait',
  };
}
