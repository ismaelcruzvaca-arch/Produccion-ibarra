/**
 * ShiftCard — Card displaying a shift session summary.
 *
 * Pattern: Atomic Design — Molecule
 * Why:
 * - Displays time range, operator, planned boxes, and status badge.
 * - Used in the shift list screen for both active and closed shifts.
 *
 * Props:
 * - session: IShiftSession — the shift session data
 * - onPress: () => void — called when the card is tapped
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { colors, spacing, typography, borderRadius } from '../../theme/tokens';
import type { IShiftSession } from '../../../core/types';

interface ShiftCardProps {
  session: IShiftSession;
  onPress: () => void;
  testID?: string;
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function ShiftCard({ session, onPress, testID }: ShiftCardProps) {
  const isActive = session.status === 'active';
  const timeRange = isActive
    ? `Iniciado: ${formatTime(session.started_at)}`
    : `${formatDate(session.started_at)} ${formatTime(session.started_at)} — ${session.ended_at ? formatTime(session.ended_at) : ''}`;

  return (
    <TouchableOpacity onPress={onPress} testID={testID} activeOpacity={0.7}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              Turno
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: isActive ? colors.bgGreen : colors.bgGray },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color: isActive ? colors.darkGreen : colors.textSecondary,
                  },
                ]}
              >
                {isActive ? 'Activo' : 'Cerrado'}
              </Text>
            </View>
          </View>

          <Text style={styles.timeRange}>{timeRange}</Text>

          <View style={styles.details}>
            <Text style={styles.detailLabel}>Operador:</Text>
            <Text style={styles.detailValue}>{session.operator_id}</Text>
          </View>

          <View style={styles.details}>
            <Text style={styles.detailLabel}>Cajas planeadas:</Text>
            <Text style={styles.detailValue}>
              {session.planned_boxes?.toLocaleString('es-MX') ?? '—'}
            </Text>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.titleSmall,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.round,
  },
  statusText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: typography.weights.semibold,
  },
  timeRange: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxs,
  },
  detailLabel: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
    width: 110,
  },
  detailValue: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
    flex: 1,
  },
});
