/**
 * QualityDetailScreen — read-only detail view of a quality inspection (QC-5).
 *
 * Spec compliance:
 * - QC-5: MUST read-only detail: all fields + defect label/severity
 * - QC-10: MUST pass/fail chip per inspection card
 */
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Chip, Card, Divider, useTheme } from 'react-native-paper';
import type { IQualityInspection } from '../../../core/types';

// ─── Type Labels ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  visual: 'Visual',
  weight: 'Peso',
  temp: 'Temperatura',
  metal_detector: 'Detector de Metales',
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Crítico',
  major: 'Mayor',
  minor: 'Menor',
};

// ─── Props ──────────────────────────────────────────────────────────────────────

interface QualityDetailScreenProps {
  /** The quality inspection to display. */
  inspection: IQualityInspection;
  /** Defect label to display (denormalized). */
  defectLabel?: string;
  /** Defect severity to display (denormalized). */
  defectSeverity?: string;
  /** Called to close/dismiss the detail screen. */
  onClose: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function QualityDetailScreen({
  inspection,
  defectLabel,
  defectSeverity,
  onClose,
}: QualityDetailScreenProps) {
  const theme = useTheme();

  const formattedDate = new Date(inspection.updated_at).toLocaleString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header with pass/fail */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text variant="headlineSmall" style={styles.title}>
            {TYPE_LABELS[inspection.inspection_type] ?? inspection.inspection_type}
          </Text>
          <Text variant="bodySmall" style={styles.date}>
            {formattedDate}
          </Text>
        </View>
        <Chip
          style={[
            styles.statusChip,
            {
              backgroundColor: inspection.passed ? '#E8F5E9' : '#FFEBEE',
            },
          ]}
          textStyle={{
            color: inspection.passed ? '#2E7D32' : '#C62828',
            fontWeight: '700',
            fontSize: 14,
          }}
        >
          {inspection.passed ? 'PASA' : 'FALLA'}
        </Chip>
      </View>

      <Divider style={styles.divider} />

      {/* Value section */}
      <Card style={styles.card} mode="outlined">
        <Card.Content>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Valor Medido
          </Text>
          <Text variant="headlineMedium" style={styles.valueText}>
            {inspection.value} {inspection.unit}
          </Text>
        </Card.Content>
      </Card>

      {/* Standards section (weight inspections) */}
      {(inspection.standard_min !== undefined ||
        inspection.standard_max !== undefined) && (
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <Text variant="titleSmall" style={styles.sectionTitle}>
              Estándar de Peso
            </Text>
            <View style={styles.standardRow}>
              <Text variant="bodyLarge">
                {inspection.standard_min ?? '?'} – {inspection.standard_max ?? '?'} kg
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
          </Card.Content>
        </Card>
      )}

      {/* Defect section */}
      {defectLabel && (
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <Text variant="titleSmall" style={styles.sectionTitle}>
              Defecto
            </Text>
            <Text variant="bodyLarge">{defectLabel}</Text>
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
                textStyle={{ color: '#333', fontSize: 12 }}
                compact
              >
                {SEVERITY_LABELS[defectSeverity] ?? defectSeverity}
              </Chip>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Notes section */}
      {inspection.notes && (
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <Text variant="titleSmall" style={styles.sectionTitle}>
              Notas
            </Text>
            <Text variant="bodyMedium">{inspection.notes}</Text>
          </Card.Content>
        </Card>
      )}

      {/* Metadata section */}
      <Card style={styles.card} mode="outlined">
        <Card.Content>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Metadatos
          </Text>
          <DetailRow label="Producto" value={inspection.product_id} />
          <DetailRow label="Línea" value={inspection.line_id} />
          <DetailRow label="Máquina" value={inspection.machine_id} />
          <DetailRow label="Sesión de Turno" value={inspection.shift_session_id} />
          <DetailRow label="Operador" value={inspection.operator_id} />
        </Card.Content>
      </Card>

      {/* Close button */}
      <Button
        mode="contained"
        onPress={onClose}
        style={styles.closeButton}
      >
        Cerrar
      </Button>
    </ScrollView>
  );
}

// ─── Detail Row Sub-component ────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text variant="bodySmall" style={styles.detailLabel}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={styles.detailValue}>
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontWeight: '700',
    marginBottom: 4,
  },
  date: {
    opacity: 0.5,
  },
  statusChip: {
    height: 32,
  },
  divider: {
    marginBottom: 16,
  },
  card: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.7,
  },
  valueText: {
    fontWeight: '700',
  },
  standardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningChip: {
    backgroundColor: '#FFF3E0',
    height: 24,
  },
  warningChipText: {
    fontSize: 11,
    color: '#E65100',
  },
  severityChip: {
    marginTop: 8,
    height: 26,
    alignSelf: 'flex-start',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailLabel: {
    opacity: 0.6,
    flex: 1,
  },
  detailValue: {
    flex: 2,
    textAlign: 'right',
  },
  closeButton: {
    marginTop: 16,
  },
});
