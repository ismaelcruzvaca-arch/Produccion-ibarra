/**
 * EmptyInspectionList — Empty state for the quality inspections list.
 *
 * Pattern: Atomic Design — Atom
 * Why:
 * - Consistent empty state with icon, message, and CTA button.
 * - Follows the StateWrapper pattern for composability.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { colors, spacing, typography, borderRadius } from '../../theme/tokens';

interface EmptyInspectionListProps {
  onCreatePress: () => void;
  testID?: string;
}

export function EmptyInspectionList({ onCreatePress, testID }: EmptyInspectionListProps) {
  return (
    <View style={styles.container} testID={testID ?? 'empty-inspection-list'}>
      <Text style={styles.icon}>🔍</Text>
      <Text style={styles.title}>No hay inspecciones de calidad</Text>
      <Text style={styles.subtitle}>
        Registre la primera inspección de calidad para el turno activo.
      </Text>
      <Button
        mode="contained"
        onPress={onCreatePress}
        style={styles.button}
        labelStyle={styles.buttonLabel}
        contentStyle={styles.buttonContent}
        testID="empty-inspection-create"
      >
        Crear primera inspección
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  icon: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.titleMedium,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  button: {
    borderRadius: borderRadius.sm,
  },
  buttonContent: {
    minHeight: 48,
  },
  buttonLabel: {
    fontSize: typography.sizes.button,
    fontWeight: typography.weights.semibold,
  },
});
