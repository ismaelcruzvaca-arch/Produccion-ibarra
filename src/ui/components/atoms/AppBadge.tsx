/**
 * AppBadge — Small colored indicator for status/sync labels.
 *
 * Pattern: Atomic Design — Atom
 * Why:
 * - Replaces inline Chip/Surface components with a consistent badge.
 * - Color-coded: success/green, warning/amber, error/red, info/gray.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, borderRadius, spacing, typography } from '../../theme/tokens';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'offline';

interface AppBadgeProps {
  variant?: BadgeVariant;
  label: string;
  icon?: string;
}

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: colors.bgGreen, text: colors.darkGreen },
  warning: { bg: '#FFF3E0', text: colors.caution },
  error: { bg: colors.bgRed, text: colors.error },
  info: { bg: colors.bgGray, text: colors.secondary },
  offline: { bg: colors.bgRed, text: colors.offline },
};

export function AppBadge({ variant = 'info', label }: AppBadgeProps) {
  const variantStyle = VARIANT_STYLES[variant];

  return (
    <View style={[styles.container, { backgroundColor: variantStyle.bg }]}>
      <Text style={[styles.label, { color: variantStyle.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: typography.weights.semibold,
  },
});
