/**
 * QualityCaptureScreen — multi-step quality inspection capture flow.
 *
 * Multi-step (QC-2): product → type → value → (fail?) defect → confirm
 *
 * Spec compliance:
 * - QC-2: SHALL multi-step: product → type → value → (fail?) defect → confirm
 * - QC-3: MUST validate weight against cached product_weight_standards
 * - QC-6: SHALL type selector: visual, weight, temp, metal_detector
 * - QC-8: SHALL pass with warning when standard missing
 * - QC-9: SHALL defect selector from quality_defects collection
 */
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, SegmentedButtons, TextInput, Portal, Dialog } from 'react-native-paper';

import { useQualityCaptureOrchestration } from '../../../hooks/useQualityCaptureOrchestration';
import { InspectionTypeSelector } from '../molecules/InspectionTypeSelector';
import { WeightInput } from '../molecules/WeightInput';
import { DefectSelector } from '../molecules/DefectSelector';
import type { IQualityInspection } from '../../../core/types';

/** Local type for defect options used by the capture flow. */
export interface DefectOption {
  id: string;
  label: string;
  severity?: string;
}

// ─── Props ──────────────────────────────────────────────────────────────────────

interface QualityCaptureScreenProps {
  /** Whether the capture wizard is visible/open. */
  visible: boolean;
  /** Called to dismiss/close the capture wizard. */
  onDismiss: () => void;
  /** Called when the inspection is confirmed and ready to save. */
  onSave: (payload: Omit<IQualityInspection, 'id' | 'created_at' | 'updated_at' | 'is_deleted' | 'device_id' | 'inspector_id' | 'shift_type' | 'disposition' | 'data_source'>) => Promise<void>;
  /** Available products for selection. */
  products: Array<{ id: string; name: string; code: string }>;
  /** Available defects from quality_defects catalog (QC-9). */
  defects: DefectOption[];
  /** Product weight standards for weight validation (QC-3). Keyed by product_id. */
  weightStandards?: Record<string, { min: number; max: number }>;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function QualityCaptureScreen({
  visible,
  onDismiss,
  onSave,
  products,
  defects,
  weightStandards = {},
}: QualityCaptureScreenProps) {
  const {
    state,
    selectProduct,
    selectInspectionType,
    setValue,
    selectDefect,
    setNotes,
    cancelCapture,
    getInspectionPayload,
    canHaveDefect,
  } = useQualityCaptureOrchestration();

  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = getInspectionPayload();
      await onSave(payload);
      cancelCapture();
    } catch (err: any) {
      console.warn('[QualityCaptureScreen] Save failed:', err?.message ?? err);
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = () => {
    cancelCapture();
    onDismiss();
  };

  const standards = state.productId
    ? weightStandards[state.productId]
    : undefined;

  // ─── Render Step Content ───────────────────────────────────────────────────

  const renderStepContent = () => {
    switch (state.step) {
      // Step 1: Product selection
      case 'product':
        return (
          <View style={styles.stepContainer}>
            <Text variant="titleMedium" style={styles.stepTitle}>
              Seleccionar Producto
            </Text>
            <SegmentedButtons
              value={state.productId ?? ''}
              onValueChange={(value) => {
                const product = products.find((p) => p.id === value);
                if (product) selectProduct(product.id);
              }}
              buttons={products.map((p) => ({
                value: p.id,
                label: p.code || p.name,
              }))}
            />
          </View>
        );

      // Step 2: Inspection type
      case 'inspection_type':
        return (
          <View style={styles.stepContainer}>
            <InspectionTypeSelector
              selected={state.inspectionType}
              onSelect={selectInspectionType}
            />
          </View>
        );

      // Step 3: Value input
      case 'value':
        return (
          <View style={styles.stepContainer}>
            <Text variant="titleMedium" style={styles.stepTitle}>
              Ingresar Valor
            </Text>

            {state.inspectionType === 'weight' ? (
              <View>
                {standards && (
                  <Text variant="bodySmall" style={styles.hint}>
                    Rango válido: {standards.min}g – {standards.max}g
                  </Text>
                )}
                <TextInput
                  mode="outlined"
                  label="Peso (kg)"
                  keyboardType="decimal-pad"
                  onChangeText={(text: string) => {
                    const parsed = parseFloat(text.replace(/[^0-9.]/g, ''));
                    if (!isNaN(parsed)) {
                      setValue(parsed, standards?.min, standards?.max);
                    }
                  }}
                  style={styles.input}
                />
              </View>
            ) : (
              <View>
                <TextInput
                  mode="outlined"
                  label={
                    state.inspectionType === 'temp'
                      ? 'Temperatura (°C)'
                      : state.inspectionType === 'metal_detector'
                      ? 'Resultado'
                      : 'Valor'
                  }
                  keyboardType="decimal-pad"
                  onChangeText={(text: string) => {
                    const parsed = parseFloat(text.replace(/[^0-9.]/g, ''));
                    if (!isNaN(parsed)) {
                      setValue(parsed);
                    }
                  }}
                  style={styles.input}
                />
                {state.inspectionType === 'temp' && (
                  <Text variant="bodySmall" style={styles.hint}>
                    Ingrese la temperatura medida en °C
                  </Text>
                )}
                {state.inspectionType === 'metal_detector' && (
                  <Text variant="bodySmall" style={styles.hint}>
                    Ingrese 1 para pasa, 0 para falla
                  </Text>
                )}
              </View>
            )}

            {/* Notes field */}
            <TextInput
              mode="outlined"
              label="Notas (opcional)"
              value={state.notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              style={styles.notesInput}
            />
          </View>
        );

      // Step 4: Defect selection (only when failed + defect-capable)
      case 'defect':
        return (
          <View style={styles.stepContainer}>
            <DefectSelector
              visible
              defects={defects as unknown[]}
              selected={state.defectId}
              onSelect={selectDefect as (value: string) => void}
            />
          </View>
        );

      // Step 5: Confirmation
      case 'confirm':
        return (
          <View style={styles.stepContainer}>
            <Text variant="titleMedium" style={styles.stepTitle}>
              Confirmar Inspección
            </Text>

            <View style={styles.confirmRow}>
              <Text variant="bodySmall" style={styles.confirmLabel}>Tipo:</Text>
              <Text variant="bodyMedium">{state.inspectionType}</Text>
            </View>
            <View style={styles.confirmRow}>
              <Text variant="bodySmall" style={styles.confirmLabel}>Valor:</Text>
              <Text variant="bodyMedium">
                {state.value} {state.inspectionType === 'weight' ? 'kg' : state.inspectionType === 'temp' ? '°C' : ''}
              </Text>
            </View>
            <View style={styles.confirmRow}>
              <Text variant="bodySmall" style={styles.confirmLabel}>Resultado:</Text>
              <Text
                variant="bodyMedium"
                style={{
                  color: state.hasFailed ? '#C62828' : '#2E7D32',
                  fontWeight: '700',
                }}
              >
                {state.hasFailed ? 'FALLA' : 'PASA'}
              </Text>
            </View>
            {state.standardWarning && (
              <Text variant="bodySmall" style={styles.warningText}>
                ⚠️ Sin estándar de peso configurado — pase con advertencia
              </Text>
            )}
            {state.defectId && (
              <View style={styles.confirmRow}>
                <Text variant="bodySmall" style={styles.confirmLabel}>Defecto:</Text>
                <Text variant="bodyMedium">
                  {defects.find((d) => d.id === state.defectId)?.label ?? state.defectId}
                </Text>
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  // ─── Render Navigation Buttons ─────────────────────────────────────────────

  const renderNavigation = () => {
    if (!visible) return null;

    return (
      <View style={styles.navigation}>
        {state.step !== 'product' && (
          <Button
            mode="outlined"
            onPress={cancelCapture}
            disabled={saving}
          >
            Cancelar
          </Button>
        )}

        {state.step === 'confirm' && (
          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={styles.saveButton}
          >
            Guardar Inspección
          </Button>
        )}
      </View>
    );
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleDismiss} style={styles.dialog}>
        <Dialog.Title>
          {state.step === 'product'
            ? 'Nueva Inspección'
            : state.step === 'inspection_type'
            ? 'Tipo de Inspección'
            : state.step === 'value'
            ? 'Ingresar Valor'
            : state.step === 'defect'
            ? 'Seleccionar Defecto'
            : 'Confirmar'}
        </Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {renderStepContent()}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          {renderNavigation()}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '80%',
  },
  scrollArea: {
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  stepContainer: {
    minHeight: 150,
  },
  stepTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
  },
  hint: {
    opacity: 0.6,
    marginTop: 4,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  confirmLabel: {
    opacity: 0.6,
    fontWeight: '500',
  },
  warningText: {
    color: '#E65100',
    marginTop: 12,
    fontStyle: 'italic',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  saveButton: {
    marginLeft: 8,
  },
});
