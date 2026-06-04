/**
 * ShiftSetupForm — Form for configuring a new shift session.
 *
 * Pattern: Atomic Design — Molecule
 * Why:
 * - Post-reconciliation: shift_type selector, planned_boxes, product_code.
 * - No more notes, supervisor_id.
 * - All state lives in the parent orchestrator hook (useShiftSetupOrchestration).
 *
 * Props:
 * - operators, operatorId, setOperator, shiftType, setShiftType
 * - plannedBoxes, setPlannedBoxes, productCode, setProductCode
 * - save, isValid, error, saving
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, TextInput, Chip, HelperText } from 'react-native-paper';
import { colors, spacing, typography, borderRadius } from '../../theme/tokens';
import { CatalogSelector } from '../atoms/CatalogSelector';
import type { IOperator, ShiftType } from '../../../core/types';

const SHIFT_OPTIONS: { value: ShiftType; label: string }[] = [
  { value: 'matutino', label: 'Matutino' },
  { value: 'vespertino', label: 'Vespertino' },
  { value: 'nocturno', label: 'Nocturno' },
];

interface ShiftSetupFormProps {
  operators: IOperator[];
  operatorId: string | null;
  setOperator: (id: string | null) => void;
  shiftType: ShiftType;
  setShiftType: (st: ShiftType) => void;
  plannedBoxes: number;
  setPlannedBoxes: (value: number) => void;
  productCode: string;
  setProductCode: (code: string) => void;
  save: () => void;
  isValid: boolean;
  error: string | null;
  saving: boolean;
}

export function ShiftSetupForm({
  operators,
  operatorId,
  setOperator,
  shiftType,
  setShiftType,
  plannedBoxes,
  setPlannedBoxes,
  productCode,
  setProductCode,
  save,
  isValid,
  error,
  saving,
}: ShiftSetupFormProps) {
  const handlePlannedBoxesChange = (text: string) => {
    const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num)) {
      setPlannedBoxes(num);
    } else if (text === '') {
      setPlannedBoxes(0);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Shift type selector */}
      <View style={styles.field}>
        <Text style={styles.label}>Tipo de Turno</Text>
        <View style={styles.chipRow}>
          {SHIFT_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              selected={shiftType === opt.value}
              onPress={() => setShiftType(opt.value)}
              style={styles.chip}
              selectedColor={colors.primary}
              showSelectedCheck={false}
              mode={shiftType === opt.value ? 'flat' : 'outlined'}
              testID={`shift-setup-shift-type-${opt.value}`}
            >
              {opt.label}
            </Chip>
          ))}
        </View>
      </View>

      {/* Operator selector */}
      <View style={styles.field}>
        <Text style={styles.label}>Operador</Text>
        <CatalogSelector<IOperator>
          data={operators}
          selected={operatorId}
          onSelect={setOperator}
          labelExtractor={(op) => op.full_name}
          placeholder="Seleccionar operador..."
          testID="shift-setup-operator"
        />
      </View>

      {/* Planned boxes */}
      <View style={styles.field}>
        <Text style={styles.label}>Cajas Planeadas</Text>
        <TextInput
          mode="outlined"
          value={plannedBoxes > 0 ? plannedBoxes.toString() : ''}
          onChangeText={handlePlannedBoxesChange}
          placeholder="Ej: 480"
          keyboardType="numeric"
          style={styles.input}
          outlineStyle={styles.inputOutline}
          testID="shift-setup-planned-boxes"
        />
      </View>

      {/* Product code */}
      <View style={styles.field}>
        <Text style={styles.label}>Código de Producto</Text>
        <TextInput
          mode="outlined"
          value={productCode}
          onChangeText={setProductCode}
          placeholder="Ej: CHO-123 (opcional)"
          style={styles.input}
          outlineStyle={styles.inputOutline}
          testID="shift-setup-product-code"
        />
      </View>

      {/* Error */}
      {error ? (
        <HelperText type="error" visible={true} style={styles.errorText}>
          {error}
        </HelperText>
      ) : null}

      {/* Save button */}
      <Button
        mode="contained"
        onPress={save}
        disabled={!isValid || saving}
        loading={saving}
        style={styles.saveButton}
        contentStyle={styles.saveButtonContent}
        labelStyle={styles.saveButtonLabel}
        buttonColor={colors.primary}
        testID="shift-setup-save"
      >
        {saving ? 'Guardando...' : 'Configurar Turno'}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  field: {
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: typography.sizes.bodyMedium,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  chip: {
    marginBottom: spacing.xxs,
  },
  input: {
    backgroundColor: colors.surface,
  },
  inputOutline: {
    borderRadius: borderRadius.sm,
  },
  errorText: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textError,
  },
  saveButton: {
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  saveButtonContent: {
    minHeight: 48,
  },
  saveButtonLabel: {
    fontSize: typography.sizes.button,
    fontWeight: typography.weights.bold,
  },
});
