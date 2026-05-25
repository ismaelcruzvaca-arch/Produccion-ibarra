/**
 * ShiftDetailMetrics — Aggregated OEE metrics + quality inspection summary for a shift.
 *
 * Pattern: Atomic Design — Molecule
 * Why:
 * - Displays computed OEE%, total boxes, downtime minutes, quality pass/fail.
 * - Used in the shift detail screen ([id].tsx).
 *
 * Props:
 * - oeeMetrics: OeeMetrics | null — computed OEE metrics from oeeCalculator
 * - qualityInspections: IQualityInspection[] — quality checks for this shift
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { colors, spacing, typography, borderRadius } from '../../theme/tokens';
import type { OeeMetrics } from '../../../core/oeeCalculator';
import type { IQualityInspection } from '../../../core/types';

interface ShiftDetailMetricsProps {
  oeeMetrics: OeeMetrics | null;
  qualityInspections: IQualityInspection[];
  testID?: string;
}

export function ShiftDetailMetrics({
  oeeMetrics,
  qualityInspections,
  testID,
}: ShiftDetailMetricsProps) {
  const totalInspections = qualityInspections.length;
  const passedInspections = qualityInspections.filter(
    (i) => i.disposition === 'liberado',
  ).length;
  const failedInspections = qualityInspections.filter(
    (i) => i.disposition === 'rechazado' || i.disposition === 'reproceso',
  ).length;

  return (
    <View style={styles.container} testID={testID}>
      {/* OEE Section */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Métricas OEE</Text>

          {oeeMetrics ? (
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text
                  style={[
                    styles.metricValue,
                    {
                      color:
                        oeeMetrics.oee >= 85
                          ? colors.success
                          : oeeMetrics.oee >= 60
                            ? colors.caution
                            : colors.error,
                    },
                  ]}
                >
                  {oeeMetrics.oee.toFixed(1)}%
                </Text>
                <Text style={styles.metricLabel}>OEE</Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>
                  {oeeMetrics.totalCajas.toLocaleString('es-MX')}
                </Text>
                <Text style={styles.metricLabel}>Total Cajas</Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>
                  {Math.round(
                    oeeMetrics.tiempoParoProdMin +
                      oeeMetrics.tiempoParoMttoMin,
                  )}{' '}
                  min
                </Text>
                <Text style={styles.metricLabel}>Tiempo Muerto</Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>
                  {(oeeMetrics.tiempoPlanificadoMin / 60).toFixed(1)}h
                </Text>
                <Text style={styles.metricLabel}>Planificado</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyText}>
              No hay eventos OEE para este turno
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* Quality Section */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Inspecciones de Calidad</Text>

          {totalInspections > 0 ? (
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{totalInspections}</Text>
                <Text style={styles.metricLabel}>Total</Text>
              </View>

              <View style={styles.metricItem}>
                <Text
                  style={[styles.metricValue, { color: colors.success }]}
                >
                  {passedInspections}
                </Text>
                <Text style={styles.metricLabel}>Aprobadas</Text>
              </View>

              <View style={styles.metricItem}>
                <Text
                  style={[styles.metricValue, { color: colors.error }]}
                >
                  {failedInspections}
                </Text>
                <Text style={styles.metricLabel}>Rechazadas</Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>
                  {totalInspections > 0
                    ? `${((passedInspections / totalInspections) * 100).toFixed(0)}%`
                    : '—'}
                </Text>
                <Text style={styles.metricLabel}>Tasa de Éxito</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyText}>
              No hay inspecciones de calidad registradas
            </Text>
          )}
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.titleSmall,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricItem: {
    width: '45%',
    marginBottom: spacing.sm,
  },
  metricValue: {
    fontSize: typography.sizes.kpiValue,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  emptyText: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});
