/**
 * Shift Detail Screen — Read-only view of a single shift session.
 *
 * Uses useShiftDetailOrchestration to load session, OEE events, and quality inspections.
 * Displays session info with new field names: shift_type, started_at, ended_at, product_code.
 * No more supervisor_id, notes, shift_id display.
 * Read-only per SM-10.
 */

import React from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';

import { useShiftDetailOrchestration } from '../../../src/ui/hooks/useShiftDetailOrchestration';
import { ShiftDetailMetrics } from '../../../src/ui/components/molecules/ShiftDetailMetrics';
import { colors, spacing, typography, borderRadius } from '../../../src/ui/theme/tokens';

export default function ShiftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, oeeMetrics, qualityInspections, loading } =
    useShiftDetailOrchestration(id ?? '');

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ─── Not found ──────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.notFoundText}>Turno no encontrado</Text>
      </View>
    );
  }

  const isActive = session.status === 'active';

  function formatDateTime(ms: number): string {
    const d = new Date(ms);
    return d.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Session info card */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Detalle del Turno</Text>
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

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Inicio</Text>
            <Text style={styles.detailValue}>
              {formatDateTime(session.started_at)}
            </Text>
          </View>

          {session.ended_at ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Fin</Text>
              <Text style={styles.detailValue}>
                {formatDateTime(session.ended_at)}
              </Text>
            </View>
          ) : null}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Tipo de Turno</Text>
            <Text style={styles.detailValue}>{session.shift_type}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Operador</Text>
            <Text style={styles.detailValue}>{session.operator_id}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Cajas Planeadas</Text>
            <Text style={styles.detailValue}>
              {session.planned_boxes?.toLocaleString('es-MX') ?? '—'}
            </Text>
          </View>

          {session.product_code ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Código de Producto</Text>
              <Text style={styles.detailValue}>{session.product_code}</Text>
            </View>
          ) : null}
        </Card.Content>
      </Card>

      {/* OEE Metrics + Quality */}
      <ShiftDetailMetrics
        oeeMetrics={oeeMetrics}
        qualityInspections={qualityInspections}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGray,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgGray,
  },
  notFoundText: {
    fontSize: typography.sizes.titleMedium,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.titleSmall,
    fontWeight: typography.weights.bold,
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
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textSecondary,
    flex: 1,
  },
  detailValue: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
    flex: 2,
    textAlign: 'right',
  },
});
