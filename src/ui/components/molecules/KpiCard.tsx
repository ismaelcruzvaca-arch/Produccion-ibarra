/**
 * KpiCard — Token-based metric display card.
 *
 * Pattern: Atomic Design — Molecule
 * Why:
 * - Better version of KpiCards.tsx with single card responsibility.
 * - Each card displays one metric with optional color coding.
 * - Consumes design tokens.
 *
 * Usage:
 *   <KpiCard
 *     title="Total Piezas"
 *     value={kpis.totalPiezas}
 *     color="#4CAF50"
 *   />
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { colors, spacing, typography, borderRadius } from '../../theme/tokens';

interface KpiCardProps {
  title: string;
  value: number | string;
  /** Color for the value text. Defaults to textPrimary */
  color?: string;
  /** Optional suffix (e.g., '%', 'min') */
  suffix?: string;
  /** Optional testID */
  testID?: string;
}

export function KpiCard({ title, value, color = colors.textPrimary, suffix, testID }: KpiCardProps) {
  return (
    <Card style={styles.card} testID={testID}>
      <Card.Content>
        <Text variant="bodySmall" style={styles.title}>
          {title}
        </Text>
        <Text
          variant="headlineMedium"
          style={[styles.value, { color }]}
          testID={testID ? `${testID}-value` : undefined}
        >
          {value}{suffix ?? ''}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
  },
  title: {
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  value: {
    fontWeight: typography.weights.bold,
    marginTop: spacing.xxs,
    fontSize: typography.sizes.kpiValue,
  },
});
