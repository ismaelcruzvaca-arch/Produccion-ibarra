/**
 * InspectionTypeSelector — allows the operator to choose the type of quality inspection.
 *
 * Spec compliance:
 * - QC-6: SHALL type selector: visual, weight, temp, metal_detector
 * - QC-2: First step after product selection in the multi-step flow
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import type { IQualityInspection } from '../../../core/types';

export type InspectionType = IQualityInspection['inspection_type'];

interface InspectionTypeOption {
  type: InspectionType;
  label: string;
  icon: string;
  description: string;
}

const INSPECTION_TYPES: InspectionTypeOption[] = [
  {
    type: 'visual',
    label: 'Visual',
    icon: 'eye',
    description: 'Inspección visual del producto',
  },
  {
    type: 'weight',
    label: 'Peso',
    icon: 'scale-balance',
    description: 'Verificación de peso',
  },
  {
    type: 'temp',
    label: 'Temperatura',
    icon: 'thermometer',
    description: 'Medición de temperatura',
  },
  {
    type: 'metal_detector',
    label: 'Detector de Metales',
    icon: 'magnet',
    description: 'Prueba de detector de metales',
  },
];

interface InspectionTypeSelectorProps {
  selectedType: InspectionType | null;
  onSelect: (type: InspectionType) => void;
  disabled?: boolean;
}

export function InspectionTypeSelector({
  selectedType,
  onSelect,
  disabled = false,
}: InspectionTypeSelectorProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.title}>
        Tipo de Inspección
      </Text>
      <View style={styles.grid}>
        {INSPECTION_TYPES.map((option) => {
          const isSelected = selectedType === option.type;
          return (
            <Button
              key={option.type}
              mode={isSelected ? 'contained' : 'outlined'}
              icon={option.icon}
              onPress={() => onSelect(option.type)}
              disabled={disabled}
              style={[
                styles.button,
                isSelected && { backgroundColor: theme.colors.primary },
              ]}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
            >
              {option.label}
            </Button>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  title: {
    marginBottom: 12,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    flex: 1,
    minWidth: '45%',
  },
  buttonContent: {
    flexDirection: 'column',
    paddingVertical: 12,
  },
  buttonLabel: {
    fontSize: 13,
    textAlign: 'center',
  },
});
