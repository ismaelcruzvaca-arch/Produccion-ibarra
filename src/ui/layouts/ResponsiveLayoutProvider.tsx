/**
 * ResponsiveLayoutProvider — Auto-selects TabletLayout or PhoneLayout based on
 * useResponsive(). Wraps children to provide consistent responsive layout.
 *
 * Pattern: Context-free Provider (pure composition)
 * Why:
 * - No context needed — just a layout switch based on useWindowDimensions.
 * - Uses useResponsive hook which re-renders on dimension changes.
 * - PhoneLayout for < 600dp, TabletLayout for >= 600dp.
 */

import React from 'react';
import { useResponsive } from '../hooks/useResponsive';
import { TabletLayout } from './TabletLayout';
import { PhoneLayout } from './PhoneLayout';

interface ResponsiveLayoutProviderProps {
  children: React.ReactNode;
}

export function ResponsiveLayoutProvider({ children }: ResponsiveLayoutProviderProps) {
  const { isTablet } = useResponsive();

  if (isTablet) {
    return <TabletLayout>{children}</TabletLayout>;
  }

  return <PhoneLayout>{children}</PhoneLayout>;
}
