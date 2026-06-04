/**
 * SettingsConfig — Plant configuration section.
 *
 * Pattern: Atomic Design — Organism (SS-3)
 * Why:
 * - One organism per settings section.
 * - Editable micro_stop_threshold_min parameter with integer validation.
 * - Conciliation config section with editable fields for thresholds and departments.
 * - Reads/writes via usePlantConfigRepository, syncs via GraphQL replication.
 *
 * Visibility: Admin/Supervisor only (hidden for operator via useSettingsPermissions).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { List, Text, TextInput, Button, Snackbar, Divider } from 'react-native-paper';
import { usePlantConfigRepository } from '../../../../repositories/usePlantConfigRepository';
import { colors, spacing, typography, borderRadius } from '../../../theme/tokens';

// ─── Reusable field row component ─────────────────────────────────────────────

function FieldRow({
  label,
  hint,
  value,
  onChangeText,
  disabled,
  error,
  keyboardType = 'default',
}: {
  label: string;
  hint: string;
  value: string;
  onChangeText: (val: string) => void;
  disabled?: boolean;
  error?: boolean;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldLabel}>
        <Text variant="bodyMedium" style={styles.fieldTitle}>
          {label}
        </Text>
        <Text variant="bodySmall" style={styles.fieldHint}>
          {hint}
        </Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        mode="outlined"
        keyboardType={keyboardType}
        style={styles.input}
        error={error}
        disabled={disabled}
      />
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SettingsConfig() {
  const {
    getMicroStopThreshold, setMicroStopThreshold,
    getConciliationThresholdMin, setConciliationThresholdMin,
    getRcaThresholdMin, setRcaThresholdMin,
    getEscalationHours, setEscalationHours,
    getRcaRecurrenceCount, setRcaRecurrenceCount,
    getConciliationRequiredDepartments, setConciliationRequiredDepartments,
    getDepartmentReasonCodes, setDepartmentReasonCodes,
  } = usePlantConfigRepository();

  // ─── Shared state ────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [conciliationExpanded, setConciliationExpanded] = useState(false);
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; isError: boolean }>({
    visible: false,
    message: '',
    isError: false,
  });

  // ─── Micro-stop state ────────────────────────────────────────────────────────
  const [threshold, setThreshold] = useState<string>('5');
  const [originalThreshold, setOriginalThreshold] = useState<string>('5');
  const [validationError, setValidationError] = useState<string | null>(null);

  // ─── Conciliation state ─────────────────────────────────────────────────────
  const [conciliationThreshold, setConciliationThreshold] = useState<string>('15');
  const [originalConciliationThreshold, setOriginalConciliationThreshold] = useState<string>('15');

  const [rcaThreshold, setRcaThreshold] = useState<string>('30');
  const [originalRcaThreshold, setOriginalRcaThreshold] = useState<string>('30');

  const [escalationHours, setEscalationHoursLocal] = useState<string>('24');
  const [originalEscalationHours, setOriginalEscalationHours] = useState<string>('24');

  const [rcaRecurrenceCount, setRcaRecurrenceCountLocal] = useState<string>('3');
  const [originalRcaRecurrenceCount, setOriginalRcaRecurrenceCount] = useState<string>('3');

  const [requiredDepartments, setRequiredDepartments] = useState<string>('MTTO,CALIDAD,LOGISTICA');
  const [originalRequiredDepartments, setOriginalRequiredDepartments] = useState<string>('MTTO,CALIDAD,LOGISTICA');

  const [deptReasonCodes, setDeptReasonCodes] = useState<string>('');
  const [originalDeptReasonCodes, setOriginalDeptReasonCodes] = useState<string>('');

  // ─── Snackbar helpers ──────────────────────────────────────────────────────
  const showSnackbar = useCallback((message: string, isError = false) => {
    setSnackbar({ visible: true, message, isError });
  }, []);

  const hideSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, visible: false }));
  }, []);

  // ─── Load all values on mount ─────────────────────────────────────────────
  useEffect(() => {
    getMicroStopThreshold().then((val) => {
      const strVal = String(val);
      setThreshold(strVal);
      setOriginalThreshold(strVal);
    });
    getConciliationThresholdMin().then((val) => {
      const strVal = String(val);
      setConciliationThreshold(strVal);
      setOriginalConciliationThreshold(strVal);
    });
    getRcaThresholdMin().then((val) => {
      const strVal = String(val);
      setRcaThreshold(strVal);
      setOriginalRcaThreshold(strVal);
    });
    getEscalationHours().then((val) => {
      const strVal = String(val);
      setEscalationHoursLocal(strVal);
      setOriginalEscalationHours(strVal);
    });
    getRcaRecurrenceCount().then((val) => {
      const strVal = String(val);
      setRcaRecurrenceCountLocal(strVal);
      setOriginalRcaRecurrenceCount(strVal);
    });
    getConciliationRequiredDepartments().then((val) => {
      const strVal = val.join(',');
      setRequiredDepartments(strVal);
      setOriginalRequiredDepartments(strVal);
    });
    getDepartmentReasonCodes().then((val) => {
      const strVal = JSON.stringify(val, null, 2);
      setDeptReasonCodes(strVal);
      setOriginalDeptReasonCodes(strVal);
    });
  }, [
    getMicroStopThreshold, getConciliationThresholdMin, getRcaThresholdMin,
    getEscalationHours, getRcaRecurrenceCount,
    getConciliationRequiredDepartments, getDepartmentReasonCodes,
  ]);

  // ─── Micro-stop validation ───────────────────────────────────────────────
  const validate = useCallback((value: string): boolean => {
    if (!value.trim()) {
      setValidationError('El valor es requerido');
      return false;
    }
    const num = parseInt(value, 10);
    if (Number.isNaN(num)) {
      setValidationError('Debe ser un número entero');
      return false;
    }
    if (num < 1) {
      setValidationError('El valor mínimo es 1 minuto');
      return false;
    }
    if (num > 120) {
      setValidationError('El valor máximo es 120 minutos');
      return false;
    }
    setValidationError(null);
    return true;
  }, []);

  const handleChange = useCallback(
    (value: string) => {
      setThreshold(value);
      if (validationError) {
        validate(value);
      }
    },
    [validate, validationError],
  );

  // ─── Generic numeric validate ───────────────────────────────────────────────
  const validateNumeric = useCallback((value: string, min: number, max: number): string | null => {
    if (!value.trim()) return 'El valor es requerido';
    const num = parseInt(value, 10);
    if (Number.isNaN(num)) return 'Debe ser un número entero';
    if (num < min) return `El valor mínimo es ${min}`;
    if (num > max) return `El valor máximo es ${max}`;
    return null;
  }, []);

  // ─── Micro-stop save ──────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!validate(threshold)) return;

    setSaving(true);
    try {
      const numValue = parseInt(threshold, 10);
      await setMicroStopThreshold(numValue);
      setOriginalThreshold(threshold);
      showSnackbar(`Umbral de micro-paro actualizado a ${numValue} min`);
    } catch (err: any) {
      showSnackbar(err?.message ?? 'Error al guardar la configuración', true);
    } finally {
      setSaving(false);
    }
  }, [threshold, validate, setMicroStopThreshold, showSnackbar]);

  const hasChanges = threshold !== originalThreshold;

  // ─── Conciliation save ────────────────────────────────────────────────────
  const handleConciliationSave = useCallback(async () => {
    const errors: string[] = [];

    const ctErr = validateNumeric(conciliationThreshold, 1, 999);
    if (ctErr) errors.push(`Umbral conciliación: ${ctErr}`);

    const rtErr = validateNumeric(rcaThreshold, 1, 999);
    if (rtErr) errors.push(`Umbral RCA: ${rtErr}`);

    const ehErr = validateNumeric(escalationHours, 1, 720);
    if (ehErr) errors.push(`Horas escalación: ${ehErr}`);

    const rcErr = validateNumeric(rcaRecurrenceCount, 1, 99);
    if (rcErr) errors.push(`Recurrencia RCA: ${rcErr}`);

    if (!requiredDepartments.trim()) {
      errors.push('Departamentos requeridos: el valor es requerido');
    }

    let parsedCodes: Record<string, string[]> | null = null;
    if (deptReasonCodes.trim()) {
      try {
        parsedCodes = JSON.parse(deptReasonCodes.trim()) as Record<string, string[]>;
      } catch {
        errors.push('Códigos por departamento: JSON inválido');
      }
    }

    if (errors.length > 0) {
      showSnackbar(errors.join('. '), true);
      return;
    }

    setSaving(true);
    try {
      await setConciliationThresholdMin(parseInt(conciliationThreshold, 10));
      await setRcaThresholdMin(parseInt(rcaThreshold, 10));
      await setEscalationHours(parseInt(escalationHours, 10));
      await setRcaRecurrenceCount(parseInt(rcaRecurrenceCount, 10));
      await setConciliationRequiredDepartments(
        requiredDepartments.split(',').map((d) => d.trim()).filter(Boolean),
      );
      if (parsedCodes) {
        await setDepartmentReasonCodes(parsedCodes);
      }

      setOriginalConciliationThreshold(conciliationThreshold);
      setOriginalRcaThreshold(rcaThreshold);
      setOriginalEscalationHours(escalationHours);
      setOriginalRcaRecurrenceCount(rcaRecurrenceCount);
      setOriginalRequiredDepartments(requiredDepartments);
      if (deptReasonCodes.trim()) {
        setOriginalDeptReasonCodes(deptReasonCodes);
      }

      showSnackbar('Configuración de conciliación actualizada');
    } catch (err: any) {
      showSnackbar(err?.message ?? 'Error al guardar configuración', true);
    } finally {
      setSaving(false);
    }
  }, [
    conciliationThreshold, rcaThreshold, escalationHours, rcaRecurrenceCount,
    requiredDepartments, deptReasonCodes, validateNumeric,
    setConciliationThresholdMin, setRcaThresholdMin, setEscalationHours,
    setRcaRecurrenceCount, setConciliationRequiredDepartments, setDepartmentReasonCodes,
    showSnackbar,
  ]);

  const hasConciliationChanges =
    conciliationThreshold !== originalConciliationThreshold ||
    rcaThreshold !== originalRcaThreshold ||
    escalationHours !== originalEscalationHours ||
    rcaRecurrenceCount !== originalRcaRecurrenceCount ||
    requiredDepartments !== originalRequiredDepartments ||
    deptReasonCodes !== originalDeptReasonCodes;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Plant Config Accordion ───────────────────────────────────────── */}
      <List.Accordion
        title="Configuración de Planta"
        titleStyle={styles.accordionTitle}
        left={(props) => <List.Icon {...props} icon="factory-settings" color={colors.primary} />}
        expanded={expanded}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.content}>
          <Text variant="bodySmall" style={styles.description}>
            Parámetros operativos de la planta. Los cambios se aplican sin necesidad de reiniciar la aplicación.
          </Text>

          <Divider style={styles.divider} />

          <View style={styles.fieldRow}>
            <View style={styles.fieldLabel}>
              <Text variant="bodyMedium" style={styles.fieldTitle}>
                Umbral micro-paro (min)
              </Text>
              <Text variant="bodySmall" style={styles.fieldHint}>
                Paros con duración menor a este valor se consideran micro-paros y se excluyen de conciliación.
              </Text>
            </View>
            <TextInput
              value={threshold}
              onChangeText={handleChange}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
              error={validationError !== null}
              disabled={saving}
              maxLength={3}
            />
          </View>

          {validationError && (
            <Text variant="bodySmall" style={styles.errorText}>
              {validationError}
            </Text>
          )}

          {hasChanges && (
            <Button
              mode="contained"
              onPress={handleSave}
              loading={saving}
              disabled={saving || validationError !== null}
              style={styles.saveButton}
              contentStyle={styles.saveButtonContent}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          )}
        </View>
      </List.Accordion>

      {/* ── Conciliación Accordion ───────────────────────────────────────── */}
      <List.Accordion
        title="Configuración de Conciliación"
        titleStyle={styles.accordionTitle}
        left={(props) => <List.Icon {...props} icon="handshake" color={colors.primary} />}
        expanded={conciliationExpanded}
        onPress={() => setConciliationExpanded(!conciliationExpanded)}
      >
        <View style={styles.content}>
          <Text variant="bodySmall" style={styles.description}>
            Parámetros para el flujo de conciliación de paros, análisis RCA y escalación.
          </Text>

          <Divider style={styles.divider} />

          <FieldRow
            label="Umbral conciliación (min)"
            hint="Duración mínima para que un paro requiera conciliación inter-departamental"
            value={conciliationThreshold}
            onChangeText={setConciliationThreshold}
            disabled={saving}
            error={false}
            keyboardType="numeric"
          />

          <FieldRow
            label="Umbral RCA (min)"
            hint="Duración mínima para activar análisis de Causa Raíz"
            value={rcaThreshold}
            onChangeText={setRcaThreshold}
            disabled={saving}
            error={false}
            keyboardType="numeric"
          />

          <FieldRow
            label="Horas para escalación"
            hint="Plazo en horas antes de que una conciliación se considere vencida"
            value={escalationHours}
            onChangeText={setEscalationHoursLocal}
            disabled={saving}
            error={false}
            keyboardType="numeric"
          />

          <FieldRow
            label="Conteo recurrencia RCA"
            hint="Número de veces que un mismo código de paro activa RCA automático"
            value={rcaRecurrenceCount}
            onChangeText={setRcaRecurrenceCountLocal}
            disabled={saving}
            error={false}
            keyboardType="numeric"
          />

          <FieldRow
            label="Departamentos requeridos"
            hint="Separados por coma: MTTO,CALIDAD,LOGISTICA"
            value={requiredDepartments}
            onChangeText={setRequiredDepartments}
            disabled={saving}
            error={false}
          />

          <View style={styles.jsonFieldRow}>
            <View style={styles.fieldLabel}>
              <Text variant="bodyMedium" style={styles.fieldTitle}>
                Códigos por departamento
              </Text>
              <Text variant="bodySmall" style={styles.fieldHint}>
                JSON: {"{\"MTTO\":[\"FC\",\"FS\"],\"CALIDAD\":[\"RCC\"]}"}
              </Text>
            </View>
            <TextInput
              value={deptReasonCodes}
              onChangeText={setDeptReasonCodes}
              mode="outlined"
              multiline
              numberOfLines={5}
              style={styles.jsonInput}
              disabled={saving}
            />
          </View>

          {hasConciliationChanges && (
            <Button
              mode="contained"
              onPress={handleConciliationSave}
              loading={saving}
              disabled={saving}
              style={styles.saveButton}
              contentStyle={styles.saveButtonContent}
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          )}
        </View>
      </List.Accordion>

      {/* Snackbar feedback */}
      <Snackbar
        visible={snackbar.visible}
        onDismiss={hideSnackbar}
        duration={4000}
        action={{
          label: 'Cerrar',
          onPress: hideSnackbar,
        }}
        style={[
          styles.snackbar,
          { backgroundColor: snackbar.isError ? colors.error : colors.success },
        ]}
      >
        {snackbar.message}
      </Snackbar>
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  accordionTitle: {
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  description: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  divider: {
    marginVertical: spacing.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    flex: 1,
    marginRight: spacing.md,
  },
  fieldTitle: {
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  fieldHint: {
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  input: {
    width: 80,
    backgroundColor: colors.white,
    height: 48,
  },
  jsonFieldRow: {
    marginBottom: spacing.xs,
  },
  jsonInput: {
    backgroundColor: colors.white,
    marginTop: spacing.xxs,
    fontFamily: 'monospace',
    fontSize: 11,
  },
  errorText: {
    color: colors.error,
    marginTop: spacing.xs,
  },
  saveButton: {
    marginTop: spacing.md,
    borderRadius: borderRadius.sm,
  },
  saveButtonContent: {
    minHeight: 40,
  },
  snackbar: {
    borderRadius: borderRadius.sm,
  },
});
