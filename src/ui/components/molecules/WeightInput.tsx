/**
 * WeightInput — weight measurement input with validation against product_weight_standards.
 *
 * Spec compliance:
 * - QC-3: MUST validate weight against cached product_weight_standards
 * - QC-8: SHALL pass with warning when standard missing
 */
import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, HelperText, Chip } from 'react-native-paper';

interface WeightInputProps {
  value: number | null;
  onChangeValue: (value: number, standardMin?: number, standardMax?: number) => void;
  standardMin?: number;
  standardMax?: number;
  disabled?: boolean;
}

export function WeightInput({
  value,
  onChangeValue,
  standardMin,
  standardMax,
  disabled = false,
}: WeightInputProps) {
  const [inputText, setInputText] = useState(value !== null ? String(value) : '');
  const [hasInteracted, setHasInteracted] = useState(false);

  const hasStandard =
    standardMin !== undefined && standardMax !== undefined;
  const numericValue = parseFloat(inputText);

  const isWithinRange =
    hasStandard && !isNaN(numericValue)
      ? numericValue >= standardMin! && numericValue <= standardMax!
      : true;

  const showWarning = hasInteracted && hasStandard && !isNaN(numericValue) && !isWithinRange;

  const handleChangeText = useCallback(
    (text: string) => {
      // Allow only numbers and decimal point
      const cleaned = text.replace(/[^0-9.]/g, '');
      setInputText(cleaned);
      setHasInteracted(true);

      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) {
        onChangeValue(parsed, standardMin, standardMax);
      }
    },
    [onChangeValue, standardMin, standardMax]
  );

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.title}>
        Peso (kg)
      </Text>

      {hasStandard && (
        <View style={styles.standardRow}>
          <Chip icon="information" style={styles.chip}>
            Estándar: {standardMin} – {standardMax} kg
          </Chip>
        </View>
      )}

      {!hasStandard && (
        <View style={styles.standardRow}>
          <Chip icon="alert" style={styles.warningChip}>
            Sin estándar configurado — pase con advertencia
          </Chip>
        </View>
      )}

      <TextInput
        mode="outlined"
        value={inputText}
        onChangeText={handleChangeText}
        keyboardType="decimal-pad"
        disabled={disabled}
        placeholder="0.00"
        error={showWarning}
        style={styles.input}
      />

      {showWarning && (
        <HelperText type="error" visible={showWarning}>
          El peso está fuera del rango estándar ({standardMin} – {standardMax} kg)
        </HelperText>
      )}

      {!hasStandard && hasInteracted && (
        <HelperText type="info" visible={true}>
          Peso registrado sin verificación de estándar
        </HelperText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  title: {
    marginBottom: 8,
    fontWeight: '600',
  },
  standardRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  chip: {
    backgroundColor: '#E3F2FD',
  },
  warningChip: {
    backgroundColor: '#FFF3E0',
  },
  input: {
    backgroundColor: '#FFFFFF',
  },
});
