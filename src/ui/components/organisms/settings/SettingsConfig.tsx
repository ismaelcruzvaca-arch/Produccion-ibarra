/**
 * SettingsConfig — Plant configuration section.
 *
 * Pattern: Atomic Design — Organism (SS-3)
 * Why:
 * - One organism per settings section.
 * - Editable micro_stop_threshold_min parameter with integer validation.
 * - Reads/writes via usePlantConfigRepository, syncs via GraphQL replication.
 *
 * Visibility: Admin/Supervisor only (hidden for operator via useSettingsPermissions).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { List, Text, TextInput, Button, Snackbar, Divider } from 'react-native-paper';
import { usePlantConfigRepository } from '../../../../repositories/usePlantConfigRepository';
import { colors, spacing, typography, borderRadius } from '../../../theme/tokens';

export function SettingsConfig() {
  const { getMicroStopThreshold, setMicroStopThreshold } = usePlantConfigRepository();

  // ─── State ──────────────────────────────────────────────────────────────────
  const [threshold, setThreshold] = useState<string>('5');
  const [originalThreshold, setOriginalThreshold] = useState<string>('5');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; isError: boolean }>({
    visible: false,
    message: '',
    isError: false,
  });

  // ─── Load current value ────────────────────────────────────────────────────
  useEffect(() => {
    getMicroStopThreshold().then((val) => {
      const strVal = String(val);
      setThreshold(strVal);
      setOriginalThreshold(strVal);
    });
  }, [getMicroStopThreshold]);

  // ─── Snackbar helpers ──────────────────────────────────────────────────────
  const showSnackbar = useCallback((message: string, isError = false) => {
    setSnackbar({ visible: true, message, isError });
  }, []);

  const hideSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, visible: false }));
  }, []);

  // ─── Validation ────────────────────────────────────────────────────────────
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

  // ─── Save ──────────────────────────────────────────────────────────────────
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

  // ─── Has changes? ──────────────────────────────────────────────────────────
  const hasChanges = threshold !== originalThreshold;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
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
