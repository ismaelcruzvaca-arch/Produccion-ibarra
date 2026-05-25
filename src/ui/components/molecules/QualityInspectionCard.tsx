/**
 * QualityInspectionCard — Card displaying a quality inspection summary.
 *
 * Pattern: Atomic Design — Molecule
 * Why:
 * - Shows disposition badge (🟢 liberado / 🔴 rechazado / 🟡 reproceso) instead of pass/fail.
 * - Shows shift_type and inspector_id instead of inspection_type and operator_id.
 * - Post-reconciliation: no more value, defect_code, inspection_type fields.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme/tokens';
import type { IQualityInspection, DispositionType } from '../../../core/types';
import { AppBadge } from '../atoms/AppBadge';

const DISPOSITION_CONFIG: Record<DispositionType, { label: string; variant: 'success' | 'error' | 'warning' | 'info' }> = {
  liberado: { label: '🟢 Liberado', variant: 'success' },
  rechazado: { label: '🔴 Rechazado', variant: 'error' },
  reproceso: { label: '🟡 Reproceso', variant: 'warning' },
};

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

interface QualityInspectionCardProps {
  inspection: IQualityInspection;
  onPress: () => void;
  testID?: string;
}

export function QualityInspectionCard({
  inspection,
  onPress,
  testID,
}: QualityInspectionCardProps) {
  const dispCfg = DISPOSITION_CONFIG[inspection.disposition] ?? DISPOSITION_CONFIG.liberado;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      testID={testID ?? `quality-card-${inspection.id}`}
    >
      <View style={styles.row}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📋</Text>
        </View>

        {/* Info column */}
        <View style={styles.info}>
          <Text style={styles.inspectorLabel}>Inspector: {inspection.inspector_id}</Text>
          <Text style={styles.timestamp}>{formatTimestamp(inspection.updated_at)}</Text>

          <Text style={styles.shiftLabel}>
            Turno: {inspection.shift_type} | Máquina: {inspection.machine_id}
          </Text>
        </View>

        {/* Disposition badge */}
        <View style={styles.badgeContainer}>
          <AppBadge
            variant={dispCfg.variant}
            label={dispCfg.label}
          />
        </View>
      </View>

      {/* Notes if present */}
      {inspection.notes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesText} numberOfLines={2}>
            {inspection.notes}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xxs,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bgGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  icon: {
    fontSize: 24,
  },
  info: {
    flex: 1,
    marginRight: spacing.sm,
  },
  inspectorLabel: {
    fontSize: typography.sizes.titleSmall,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  timestamp: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  shiftLabel: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
    marginTop: 4,
  },
  badgeContainer: {
    justifyContent: 'flex-start',
  },
  notesContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notesText: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});
