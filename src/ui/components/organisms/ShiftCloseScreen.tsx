/**
 * ShiftCloseScreen — Shift close screen for supervisors.
 *
 * Pattern: Atomic Design — Organism (Screen)
 * Why:
 * - Displays production summary, stop classification table, and confirm button.
 * - Orchestrates the shift close workflow via useShiftClose hook.
 * - Creates conciliations for unplanned stops that require them.
 *
 * Visibility: Supervisor/Admin only (enforced by parent route).
 *
 * Workflow:
 *   1. Load shift data (session + OEE events + plant config)
 *   2. Review production summary metrics
 *   3. Classify each stop as Planned or Unplanned
 *   4. Explain missing boxes in performance loss section
 *   5. Press "Cerrar Turno" to persist all changes
 */

import React, { useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, ScrollView } from 'react-native';
import {
  Text,
  Card,
  Button,
  Chip,
  TextInput,
  Snackbar,
  ActivityIndicator,
  Divider,
  List,
  IconButton,
  SegmentedButtons,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useShiftClose } from '../../hooks/useShiftClose';
import { colors, spacing, typography, borderRadius } from '../../theme/tokens';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ShiftCloseScreenProps {
  /** The shift_session UUID */
  shiftSessionId: string;
}

// ─── Duration formatting ───────────────────────────────────────────────────────

function formatDuration(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const hours = Math.floor(min / 60);
  const mins = Math.round(min % 60);
  return `${hours}h ${mins}m`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ShiftCloseScreen({ shiftSessionId }: ShiftCloseScreenProps) {
  const router = useRouter();
  const {
    shiftSession,
    stops,
    productionSummary,
    classifiedStops,
    loading,
    saving,
    error,
    success,
    validationErrors,
    actions,
  } = useShiftClose();

  // ─── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    actions.loadShift(shiftSessionId);
  }, [actions, shiftSessionId]);

  // ─── Handle success → navigate back ─────────────────────────────────────────
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        router.back();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  // ─── Progress tracking ──────────────────────────────────────────────────────
  const classifiedCount = classifiedStops.filter(
    (cs) => cs.classification !== null,
  ).length;
  const totalStops = classifiedStops.length;
  const allClassified = classifiedCount === totalStops && totalStops > 0;

  // ─── RCA threshold info ─────────────────────────────────────────────────────
  const rcaStops = classifiedStops.filter((cs) => cs.requiresRca);

  // ─── Department label ────────────────────────────────────────────────────────
  const departmentLabel = (depts: string[]): string => {
    if (depts.length === 0) return '';
    return depts.join(', ');
  };

  // ─── Render stop item ────────────────────────────────────────────────────────
  const renderStopItem = useCallback(
    ({ item, index }: { item: typeof classifiedStops[0]; index: number }) => {
      const stopInfo = stops.find((s) => s.start.id === item.oee_event_id);
      const startTime = stopInfo?.start.timestamp ?? 0;
      const isOtherDept = item.involvedDepartments.length > 0 &&
        !item.involvedDepartments.includes('PRODUCCION');

      return (
        <Card
          key={item.oee_event_id}
          style={[
            styles.stopCard,
            item.requiresRca && styles.stopCardRca,
          ]}
          mode="outlined"
        >
          <Card.Content>
            {/* Header: time + duration + reason */}
            <View style={styles.stopHeader}>
              <View style={styles.stopInfo}>
                <Text variant="bodyMedium" style={styles.stopTime}>
                  {formatTime(startTime)}
                </Text>
                <Text variant="bodySmall" style={styles.stopDuration}>
                  {formatDuration(item.durationMin)}
                </Text>
              </View>
              <Chip
                mode="flat"
                compact
                textStyle={styles.reasonChipText}
                style={styles.reasonChip}
              >
                {item.reasonCode}
              </Chip>
            </View>

            {/* Department info */}
            {item.involvedDepartments.length > 0 && (
              <Text variant="bodySmall" style={styles.deptHint}>
                Departamentos: {departmentLabel(item.involvedDepartments)}
              </Text>
            )}

            {/* Other department indicator */}
            {isOtherDept && item.classification === 'unplanned' && (
              <View style={styles.conciliationBadge}>
                <List.Icon icon="handshake" size={14} color={colors.caution} />
                <Text variant="bodySmall" style={styles.conciliationBadgeText}>
                  Irá a conciliación con {departmentLabel(item.involvedDepartments)}
                </Text>
              </View>
            )}

            {/* RCA indicator */}
            {item.requiresRca && (
              <View style={styles.rcaBadge}>
                <List.Icon icon="alert-decagram" size={14} color={colors.error} />
                <Text variant="bodySmall" style={styles.rcaBadgeText}>
                  Requiere análisis RCA
                  {item.durationMin >= 30 ? ' (duración)' : ' (recurrencia)'}
                </Text>
              </View>
            )}

            {/* Classification toggle */}
            <View style={styles.classificationRow}>
              <Text variant="bodySmall" style={styles.classificationLabel}>
                Clasificación:
              </Text>
              <SegmentedButtons
                value={item.classification ?? ''}
                onValueChange={(val) =>
                  actions.setClassification(
                    item.oee_event_id,
                    val as 'planned' | 'unplanned',
                  )
                }
                buttons={[
                  { value: 'planned', label: 'Planificado' },
                  { value: 'unplanned', label: 'No Planificado' },
                ]}
                style={styles.segmentedButtons}
                density="small"
              />
            </View>

            {/* Notes input for unplanned stops */}
            {item.classification === 'unplanned' && (
              <TextInput
                label="Notas"
                value={item.notes ?? ''}
                onChangeText={(val) => actions.setStopNotes(item.oee_event_id, val)}
                mode="outlined"
                dense
                multiline
                numberOfLines={2}
                style={styles.notesInput}
                placeholder="Observaciones del supervisor..."
              />
            )}
          </Card.Content>
        </Card>
      );
    },
    [stops, classifiedStops, actions],
  );

  // ─── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Cargando datos del turno...
        </Text>
      </View>
    );
  }

  // ─── Error state (no session) ───────────────────────────────────────────────
  if (!shiftSession) {
    return (
      <View style={styles.centerContainer}>
        <List.Icon icon="alert-circle-outline" color={colors.error} />
        <Text variant="bodyLarge" style={styles.errorText}>
          {error ?? 'No se pudo cargar el turno'}
        </Text>
      </View>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContent}>
        {/* Progress header */}
        <View style={styles.progressHeader}>
          <Text variant="bodySmall" style={styles.progressText}>
            {classifiedCount} de {totalStops} paros clasificados
          </Text>
          <View
            style={[
              styles.progressBar,
              { width: totalStops > 0 ? `${(classifiedCount / totalStops) * 100}%` : '0%' },
            ]}
          />
        </View>

        {/* ── Production Summary Card ───────────────────────────────────────── */}
        <Card style={styles.sectionCard} mode="outlined">
          <Card.Content>
            <View style={styles.sectionHeader}>
              <List.Icon icon="chart-box-outline" color={colors.primary} />
              <Text variant="titleSmall" style={styles.sectionTitle}>
                Resumen de Producción
              </Text>
            </View>
            <Divider style={styles.sectionDivider} />
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text variant="bodySmall" style={styles.metricLabel}>Planeado</Text>
                <Text variant="bodyMedium" style={styles.metricValue}>
                  {productionSummary.plannedBoxes} cajas
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="bodySmall" style={styles.metricLabel}>Real</Text>
                <Text variant="bodyMedium" style={styles.metricValue}>
                  {productionSummary.actualBoxes} cajas
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="bodySmall" style={styles.metricLabel}>Rechazos</Text>
                <Text variant="bodyMedium" style={[styles.metricValue, { color: colors.error }]}>
                  {productionSummary.totalRejects} cajas
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="bodySmall" style={styles.metricLabel}>Tiempo planeado</Text>
                <Text variant="bodyMedium" style={styles.metricValue}>
                  {formatDuration(productionSummary.totalPlannedMin)}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text variant="bodySmall" style={styles.metricLabel}>Tiempo paros</Text>
                <Text variant="bodyMedium" style={[styles.metricValue, { color: colors.caution }]}>
                  {formatDuration(productionSummary.totalDowntimeMin)}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* ── Performance Loss Section ──────────────────────────────────────── */}
        {productionSummary.unexplainedBoxes > 0 && (
          <Card style={styles.sectionCard} mode="outlined">
            <Card.Content>
              <View style={styles.sectionHeader}>
                <List.Icon icon="alert-box-outline" color={colors.caution} />
                <Text variant="titleSmall" style={styles.sectionTitle}>
                  Pérdida de Rendimiento
                </Text>
              </View>
              <Divider style={styles.sectionDivider} />
              <Text variant="bodySmall" style={styles.lossHint}>
                {productionSummary.unexplainedBoxes} cajas no explicadas
              </Text>
              <Text variant="bodySmall" style={styles.lossDescription}>
                La diferencia entre cajas planeadas ({productionSummary.plannedBoxes}) y
                producidas ({productionSummary.actualBoxes} cajas + {productionSummary.totalRejects} rechazos)
                debe ser explicada por el supervisor.
              </Text>
              {/* Per-stop explained_boxes for unplanned stops */}
              {classifiedStops
                .filter((cs) => cs.classification === 'unplanned')
                .map((cs) => {
                  const stopInfo = stops.find((s) => s.start.id === cs.oee_event_id);
                  return (
                    <View key={cs.oee_event_id} style={styles.explainedRow}>
                      <Text variant="bodySmall" style={styles.explainedLabel}>
                        Paro {stopInfo?.start.reason_code ?? ''} ({formatDuration(cs.durationMin)})
                      </Text>
                      <TextInput
                        label="Cajas no producidas"
                        value={cs.explained_missing_boxes?.toString() ?? ''}
                        onChangeText={(val) => {
                          const num = parseInt(val, 10);
                          actions.setExplainedBoxes(cs.oee_event_id, Number.isNaN(num) ? 0 : num);
                        }}
                        mode="outlined"
                        keyboardType="numeric"
                        dense
                        style={styles.explainedInput}
                      />
                    </View>
                  );
                })}
            </Card.Content>
          </Card>
        )}

        {/* ── Stop Classification Table ─────────────────────────────────────── */}
        <Card style={styles.sectionCard} mode="outlined">
          <Card.Content>
            <View style={styles.sectionHeader}>
              <List.Icon icon="pause-circle-outline" color={colors.primary} />
              <Text variant="titleSmall" style={styles.sectionTitle}>
                Clasificación de Paros
              </Text>
            </View>
            <Divider style={styles.sectionDivider} />

            {totalStops === 0 ? (
              <View style={styles.emptyContainer}>
                <List.Icon icon="check-circle-outline" color={colors.success} />
                <Text variant="bodyMedium" style={styles.emptyText}>
                  No hay paros registrados en este turno
                </Text>
              </View>
            ) : (
              classifiedStops.map((item, index) => renderStopItem({ item, index }))
            )}
          </Card.Content>
        </Card>

        {/* ── Confirm Button ────────────────────────────────────────────────── */}
        <Button
          mode="contained"
          onPress={actions.submitShiftClose}
          loading={saving}
          disabled={saving || !allClassified}
          icon="check-circle"
          style={styles.confirmButton}
          contentStyle={styles.confirmButtonContent}
        >
          {saving ? 'Cerrando turno...' : 'Cerrar Turno'}
        </Button>

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <View style={styles.validationContainer}>
            {validationErrors.map((ve, idx) => (
              <Text key={idx} variant="bodySmall" style={styles.validationError}>
                {ve}
              </Text>
            ))}
          </View>
        )}

        {/* Spacer for bottom nav */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Snackbar feedback */}
      <Snackbar
        visible={!!error || !!success}
        onDismiss={actions.clearMessages}
        duration={4000}
        action={{
          label: 'Cerrar',
          onPress: actions.clearMessages,
        }}
        style={[
          styles.snackbar,
          { backgroundColor: error ? colors.error : colors.success },
        ]}
      >
        {error || success}
      </Snackbar>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGray,
  },
  scrollContent: {
    padding: spacing.md,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgGray,
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  // Progress
  progressHeader: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
  },
  progressText: {
    color: colors.textSecondary,
    marginBottom: spacing.xxs,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: 2,
    minWidth: 4,
  },
  // Section cards
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontWeight: typography.weights.bold,
    marginLeft: spacing.xs,
    flex: 1,
  },
  sectionDivider: {
    marginBottom: spacing.sm,
  },
  // Metrics
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricItem: {
    width: '46%',
    marginBottom: spacing.xs,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  metricValue: {
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
    marginTop: 2,
  },
  // Performance loss
  lossHint: {
    color: colors.caution,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xxs,
  },
  lossDescription: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  explainedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  explainedLabel: {
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  explainedInput: {
    width: 100,
    backgroundColor: colors.white,
  },
  // Stop table
  stopCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  stopCardRca: {
    borderColor: colors.error,
    borderWidth: 1.5,
  },
  stopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  stopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stopTime: {
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  stopDuration: {
    color: colors.textSecondary,
  },
  reasonChip: {
    height: 24,
  },
  reasonChipText: {
    fontSize: 11,
  },
  deptHint: {
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: spacing.xxs,
  },
  // Badges
  conciliationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceWarning,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xxs,
  },
  conciliationBadgeText: {
    color: colors.textWarning,
    fontWeight: typography.weights.medium,
    marginLeft: 2,
  },
  rcaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgRed,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xxs,
  },
  rcaBadgeText: {
    color: colors.textError,
    fontWeight: typography.weights.medium,
    marginLeft: 2,
  },
  // Classification
  classificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxs,
    marginBottom: spacing.xxs,
  },
  classificationLabel: {
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  segmentedButtons: {
    flex: 1,
    maxWidth: 260,
  },
  notesInput: {
    backgroundColor: colors.white,
    marginTop: spacing.xxs,
  },
  // Empty
  emptyContainer: {
    alignItems: 'center',
    padding: spacing.md,
  },
  emptyText: {
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  // Confirm
  confirmButton: {
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  confirmButtonContent: {
    minHeight: 48,
  },
  // Validation
  validationContainer: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.bgRed,
    borderRadius: borderRadius.sm,
  },
  validationError: {
    color: colors.error,
    marginBottom: spacing.xxs,
  },
  // Bottom spacer
  bottomSpacer: {
    height: 32,
  },
  snackbar: {
    borderRadius: borderRadius.sm,
  },
});
