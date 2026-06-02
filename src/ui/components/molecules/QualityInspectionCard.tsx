/**
 * QualityInspectionCard — card displaying a single quality inspection with pass/fail chip.
 *
 * Spec compliance:
 * - QC-10: MUST pass/fail chip per inspection card
 * - QC-5: MUST read-only detail showing all fields
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Chip, useTheme } from 'react-native-paper';
import type { IQualityInspection } from '../../../core/types';

// ─── Type Labels ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<IQualityInspection['inspection_type'], string> = {
  visual: 'Visual',
  weight: 'Peso',
  temp: 'Temperatura',
  metal_detector: 'Detector de Metales',
};

const TYPE_ICONS: Record<IQualityInspection['inspection_type'], string> = {
  visual: 'eye',
  weight: 'scale-balance',
  temp: 'thermometer',
  metal_detector: 'magnet',
};

// ─── Component ──────────────────────────────────────────────────────────────────

interface QualityInspectionCardProps {
  inspection: IQualityInspection;
  defectLabel?: string;
  defectSeverity?: string;
  onPress?: () => void;
}

export function QualityInspectionCard({
  inspection,
  defectLabel,
  defectSeverity,
  onPress,
}: QualityInspectionCardProps) {
  const theme = useTheme();

  const formattedDate = new Date(inspection.updated_at).toLocaleString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });

  return (
    <Card
      style={styles.card}
      onPress={onPress}
      mode="elevated"
    >
      <Card.Content>
        {/* Header row: type icon + label + pass/fail chip */}
        <View style={styles.header}>
          <View style={styles.typeRow}>
            <Text style={styles.typeIcon}>{getTypeIcon(inspection.inspection_type)}</Text>
            <Text variant="titleSmall" style={styles.typeLabel}>
              {TYPE_LABELS[inspection.inspection_type]}
            </Text>
          </View>
          <Chip
            style={[
              styles.statusChip,
              {
                backgroundColor: inspection.passed
                  ? '#E8F5E9'
                  : '#FFEBEE',
              },
            ]}
            textStyle={{
              color: inspection.passed ? '#2E7D32' : '#C62828',
              fontWeight: '600',
              fontSize: 12,
            }}
            compact
          >
            {inspection.passed ? 'PASA' : 'FALLA'}
          </Chip>
        </View>

        {/* Value row */}
        <View style={styles.valueRow}>
          <Text variant="bodyLarge" style={styles.value}>
            {inspection.value} {inspection.unit}
          </Text>
        </View>

        {/* Standards row (weight inspections) */}
        {(inspection.standard_min !== undefined ||
          inspection.standard_max !== undefined) && (
          <View style={styles.standardRow}>
            <Text variant="bodySmall" style={styles.standardText}>
              Estándar: {inspection.standard_min ?? '?'} – {inspection.standard_max ?? '?'}{' '}
              {inspection.unit}
            </Text>
            {inspection.standard_warning && (
              <Chip
                style={styles.warningChip}
                textStyle={styles.warningChipText}
                compact
              >
                Sin estándar
              </Chip>
            )}
          </View>
        )}

        {/* Defect info */}
        {defectLabel && (
          <View style={styles.defectRow}>
            <Text variant="bodySmall" style={styles.defectLabel}>
              Defecto: {defectLabel}
            </Text>
            {defectSeverity && (
              <Chip
                style={[
                  styles.severityChip,
                  {
                    backgroundColor:
                      defectSeverity === 'critical'
                        ? '#FFEBEE'
                        : defectSeverity === 'major'
                        ? '#FFF3E0'
                        : '#E3F2FD',
                  },
                ]}
                textStyle={{ fontSize: 11 }}
                compact
              >
                {defectSeverity === 'critical'
                  ? 'Crítico'
                  : defectSeverity === 'major'
                  ? 'Mayor'
                  : 'Menor'}
              </Chip>
            )}
          </View>
        )}

        {/* Timestamp */}
        <Text variant="bodySmall" style={styles.timestamp}>
          {formattedDate}
        </Text>
      </Card.Content>
    </Card>
  );
}

function getTypeIcon(type: IQualityInspection['inspection_type']): string {
  const icons: Record<string, string> = {
    visual: '👁️',
    weight: '⚖️',
    temp: '🌡️',
    metal_detector: '🧲',
  };
  return icons[type] ?? '📋';
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 4,
    marginHorizontal: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeIcon: {
    fontSize: 20,
  },
  typeLabel: {
    fontWeight: '600',
  },
  statusChip: {
    height: 28,
  },
  valueRow: {
    marginBottom: 4,
  },
  value: {
    fontWeight: '700',
  },
  standardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  standardText: {
    opacity: 0.6,
  },
  warningChip: {
    backgroundColor: '#FFF3E0',
    height: 22,
  },
  warningChipText: {
    fontSize: 10,
    color: '#E65100',
  },
  defectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  defectLabel: {
    color: '#C62828',
    flex: 1,
  },
  severityChip: {
    height: 24,
  },
  timestamp: {
    opacity: 0.5,
    marginTop: 4,
  },
});
