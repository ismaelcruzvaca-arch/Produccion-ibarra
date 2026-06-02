/**
 * DefectSelector — selects a defect from the quality_defects collection (QC-9).
 *
 * Spec compliance:
 * - QC-9: SHALL defect selector from quality_defects collection
 * - QC-2: Appears in the multi-step flow when an inspection fails
 */
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, RadioButton, Chip, TouchableRipple } from 'react-native-paper';

/**
 * Simplified defect type representing entries from the quality_defects catalog.
 * In production, this data would be fetched from the catalog store.
 */
export interface DefectOption {
  id: string;
  label: string;
  severity: 'critical' | 'major' | 'minor';
}

interface DefectSelectorProps {
  defects: DefectOption[];
  selectedDefectId: string | null;
  onSelect: (defectId: string) => void;
  disabled?: boolean;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#D32F2F',
  major: '#F57C00',
  minor: '#1976D2',
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Crítico',
  major: 'Mayor',
  minor: 'Menor',
};

export function DefectSelector({
  defects,
  selectedDefectId,
  onSelect,
  disabled = false,
}: DefectSelectorProps) {
  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.title}>
        Seleccionar Defecto
      </Text>
      <Text variant="bodySmall" style={styles.subtitle}>
        La inspección no pasó. Seleccione el defecto encontrado:
      </Text>

      <ScrollView style={styles.list} nestedScrollEnabled>
        <RadioButton.Group
          onValueChange={onSelect}
          value={selectedDefectId ?? ''}
        >
          {defects.map((defect) => {
            const isSelected = selectedDefectId === defect.id;
            return (
              <TouchableRipple
                key={defect.id}
                onPress={() => !disabled && onSelect(defect.id)}
                disabled={disabled}
                style={styles.radioItem}
              >
                <View style={styles.row}>
                  <RadioButton
                    value={defect.id}
                    status={isSelected ? 'checked' : 'unchecked'}
                    disabled={disabled}
                  />
                  <View style={styles.labelContainer}>
                    <Text variant="bodyLarge" style={styles.radioLabel}>
                      {defect.label}
                    </Text>
                    <Chip
                      style={[
                        styles.severityChip,
                        { backgroundColor: SEVERITY_COLORS[defect.severity] + '20' },
                      ]}
                      textStyle={{ color: SEVERITY_COLORS[defect.severity], fontSize: 11 }}
                      compact
                    >
                      {SEVERITY_LABELS[defect.severity] ?? defect.severity}
                    </Chip>
                  </View>
                </View>
              </TouchableRipple>
            );
          })}
        </RadioButton.Group>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  title: {
    marginBottom: 4,
    fontWeight: '600',
  },
  subtitle: {
    marginBottom: 12,
    opacity: 0.7,
  },
  list: {
    maxHeight: 300,
  },
  radioItem: {
    borderRadius: 8,
    marginVertical: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  labelContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 8,
  },
  radioLabel: {
    fontSize: 15,
    flex: 1,
  },
  severityChip: {
    height: 24,
    marginLeft: 8,
  },
});
