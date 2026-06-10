/**
 * Quality Inspection Detail — Read-only view of a quality inspection.
 *
 * Architecture: Thin Container (Hook + Presentational)
 * Loads inspection by ID, then loads child defect_logs and weight_logs.
 * Displays disposition badge, inspector_id, shift_type, children entries.
 * No more defect catalog lookup — free-text defect_type on logs.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useQualityInspectionsRepository } from '../../../src/repositories/useQualityInspectionsRepository';
import { useDefectLogsRepository } from '../../../src/repositories/useDefectLogsRepository';
import { useWeightLogsRepository } from '../../../src/repositories/useWeightLogsRepository';
import { AppBadge } from '../../../src/ui/components/atoms/AppBadge';
import { AppButton } from '../../../src/ui/components/atoms/AppButton';
import { colors, spacing, typography, borderRadius, shadows } from '../../../src/ui/theme/tokens';
import type { IQualityInspection, IDefectLog, IWeightLog, DispositionType } from '../../../src/core/types';

const DISPOSITION_CONFIG: Record<DispositionType, { label: string; variant: 'success' | 'error' | 'warning' | 'info' }> = {
  liberado: { label: 'Liberado', variant: 'success' },
  rechazado: { label: 'Rechazado', variant: 'error' },
  reproceso: { label: 'Reproceso', variant: 'warning' },
};

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function QualityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const inspectionsRepo = useQualityInspectionsRepository();
  const defectLogsRepo = useDefectLogsRepository();
  const weightLogsRepo = useWeightLogsRepository();

  const [inspection, setInspection] = useState<IQualityInspection | null>(null);
  const [defectLogs, setDefectLogs] = useState<IDefectLog[]>([]);
  const [weightLogs, setWeightLogs] = useState<IWeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;
    const load = async () => {
      try {
        const doc = await inspectionsRepo.findById(id);
        if (!isMounted) return;

        if (!doc) {
          setError('Inspección no encontrada');
          setLoading(false);
          return;
        }

        const insp = doc.toJSON() as IQualityInspection;
        setInspection(insp);

        // Load children
        const [defectDocs, weightDocs] = await Promise.all([
          defectLogsRepo.findByInspection(id),
          weightLogsRepo.findByInspection(id),
        ]);

        if (isMounted) {
          setDefectLogs(defectDocs.map((d) => d.toJSON() as IDefectLog));
          setWeightLogs(weightDocs.map((d) => d.toJSON() as IWeightLog));
          setLoading(false);
        }
      } catch (e: any) {
        if (isMounted) {
          setError(e?.message ?? 'Error al cargar inspección');
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [id, inspectionsRepo, defectLogsRepo, weightLogsRepo]);

  // ─── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando inspección...</Text>
      </View>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────────────
  if (error || !inspection) {
    return (
      <View style={styles.centered}>
        <MaterialCommunityIcons name="alert-circle" size={48} color={colors.error} />
        <Text style={styles.errorText}>{error ?? 'Inspección no encontrada'}</Text>
        <AppButton onPress={() => router.back()} style={styles.retryButton}>
          Volver
        </AppButton>
      </View>
    );
  }

  const dispositionCfg = DISPOSITION_CONFIG[inspection.disposition] ?? DISPOSITION_CONFIG.liberado;

  return (
    <ScrollView style={styles.container} testID="quality-detail-screen">
      {/* Header card */}
      <Card style={styles.headerCard}>
        <Card.Content style={styles.headerContent}>
          <MaterialCommunityIcons name="clipboard-text" size={36} color={colors.primary} style={{ marginRight: spacing.md }} />
          <View style={styles.headerInfo}>
            <Text style={styles.typeLabel}>Inspección de Calidad</Text>
            <Text style={styles.timestamp}>
              {formatTimestamp(inspection.updated_at)}
            </Text>
          </View>
          <AppBadge
            variant={dispositionCfg.variant}
            label={dispositionCfg.label}
          />
        </Card.Content>
      </Card>

      {/* Detail fields */}
      <Card style={styles.detailCard}>
        <Card.Content>
          <DetailRow label="ID" value={inspection.id} />
          <DetailRow label="Máquina" value={inspection.machine_id} />
          <DetailRow label="Inspector" value={inspection.inspector_id} />
          <DetailRow label="Turno" value={inspection.shift_type} />
          <DetailRow label="Fuente" value={inspection.data_source} />
          <DetailRow
            label="Disposición"
            value={dispositionCfg.label}
            valueColor={
              inspection.disposition === 'liberado' ? colors.success :
              inspection.disposition === 'rechazado' ? colors.error :
              inspection.disposition === 'reproceso' ? colors.caution :
              undefined
            }
          />
          {inspection.notes && (
            <DetailRow label="Notas" value={inspection.notes} multiline />
          )}
          <DetailRow label="Dispositivo" value={inspection.device_id} />
        </Card.Content>
      </Card>

      {/* Defect logs section */}
      {defectLogs.length > 0 && (
        <Card style={styles.detailCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Registros de Defecto</Text>
            {defectLogs.map((dl) => (
              <View key={dl.id} style={styles.childRow}>
                <AppBadge
                  variant={
                    dl.severity === 'critical' ? 'error' :
                    dl.severity === 'major' ? 'warning' : 'info'
                  }
                  label={dl.severity}
                />
                <Text style={styles.childText}>
                  {dl.defect_type} (x{dl.defect_count})
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Weight logs section */}
      {weightLogs.length > 0 && (
        <Card style={styles.detailCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Registros de Peso</Text>
            {weightLogs.map((wl) => (
              <View key={wl.id} style={styles.childRow}>
                <Text style={styles.childText}>{wl.measured_weight} g</Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Back button */}
      <AppButton
        onPress={() => router.back()}
        mode="outlined"
        style={styles.backButton}
      >
        Volver
      </AppButton>
    </ScrollView>
  );
}

// ─── DetailRow helper ──────────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  valueColor,
  multiline,
}: {
  label: string;
  value: string;
  valueColor?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[
          styles.detailValue,
          valueColor ? { color: valueColor } : undefined,
          multiline ? styles.detailValueMultiline : undefined,
        ]}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGray,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bgGray,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.bodyMedium,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textError,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  retryButton: {
    borderRadius: borderRadius.sm,
  },
  headerCard: {
    margin: spacing.md,
    marginBottom: 0,
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  typeLabel: {
    fontSize: typography.sizes.titleMedium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  timestamp: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  detailCard: {
    margin: spacing.md,
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
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
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    textAlign: 'right',
    flex: 2,
  },
  detailValueMultiline: {
    textAlign: 'left',
    marginTop: spacing.xxs,
  },
  sectionTitle: {
    fontSize: typography.sizes.titleSmall,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  childText: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  backButton: {
    margin: spacing.md,
    borderRadius: borderRadius.sm,
  },
});
