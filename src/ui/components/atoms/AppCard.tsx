/**
 * AppCard — Token-based wrapper around react-native-paper Card.
 *
 * Pattern: Atomic Design — Atom
 * Why:
 * - Consistent card styling across the app.
 * - All colors/spacing from design tokens.
 */

import React from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { Card } from 'react-native-paper';
import { colors, borderRadius, spacing } from '../../theme/tokens';

interface AppCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  mode?: 'elevated' | 'outlined' | 'contained';
  onPress?: () => void;
  testID?: string;
}

export function AppCard({ children, style, mode = 'elevated', onPress, testID }: AppCardProps) {
  return (
    <Card mode={mode} style={[styles.card, style]} onPress={onPress} testID={testID}>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
  },
});
