/**
 * Quality Capture Screen — Post-reconciliation inspection capture.
 *
 * Architecture: Thin Container (Hook + Presentational)
 * Flow:
 *   Set inspector_id (from auth) + shift_type
 *   Select disposition (🟢 liberado / 🔴 rechazado / 🟡 reproceso)
 *   If liberado: add weight_logs[] entries
 *   If rechazado/reproceso: add defect_logs[] entries
 *   Confirm → saves inspection + children
 *
 * No more inspection_type selector, pass/fail buttons, defect catalog lookup.
 */

import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Button,
  Portal,
  Snackbar,
  Dialog,
  TextInput,
  Chip,
} from 'react-native-paper';
import { useRouter } from 'expo-router';

import { useQualityCaptureOrchestration } from '../../../src/ui/hooks/useQualityCaptureOrchestration';
import { SignaturePrompt } from '../../../src/ui/components/molecules/SignaturePrompt';
import { SmartNumpad } from '../../../src/ui/components/atoms/SmartNumpad';
import { AppButton } from '../../../src/ui/components/atoms/AppButton';
import { AppBadge } from '../../../src/ui/components/atoms/AppBadge';
import { useAuthStore } from '../../../src/auth/useAuthStore';
import { colors, spacing, typography, borderRadius } from '../../../src/ui/theme/tokens';
import type { DispositionType, ShiftType, IDefectLog } from '../../../src/core/types';

const SHIFT_OPTIONS: { value: ShiftType; label: string }[] = [
  { value: 'matutino', label: 'Matutino' },
  { value: 'vespertino', label: 'Vespertino' },
  { value: 'nocturno', label: 'Nocturno' },
];

const DISPOSITION_OPTIONS: { value: DispositionType; label: string; color: string }[] = [
  { value: 'liberado', label: '🟢 Liberado', color: colors.success },
  { value: 'rechazado', label: '🔴 Rechazado', color: colors.error },
  { value: 'reproceso', label: '🟡 Reproceso', color: colors.caution },
];

export default function QualityCaptureScreen() {
  const router = useRouter();
  const authRole = useAuthStore((s) => s.role);
  const authName = useAuthStore((s) => s.fullName);
  const {
    inspectorId,
    shiftType,
    disposition,
    notes,
    selectedSku,
    defectLogs,
    weightLogs,
    productList,
    weightValidation,
    validationMessage,
    saving,
    savedInspection,
    pendingNcSignature,
    setInspectorId,
    setShiftType,
    setDisposition,
    setNotes,
    setSelectedSku,
    addDefectLog,
    removeDefectLog,
    addWeightLog,
    removeWeightLog,
    validateWeight,
    confirm,
    reset,
    signNcInspection,
    resetSavedInspection,
  } = useQualityCaptureOrchestration();

  // ─── Local UI state ─────────────────────────────────────────────────────────
  const [weightNumpadVisible, setWeightNumpadVisible] = useState(false);
  const [defectTypeInput, setDefectTypeInput] = useState('');
  const [defectSeverity, setDefectSeverity] = useState<IDefectLog['severity']>('minor');
  const [defectCount, setDefectCount] = useState(1);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [errorDialogVisible, setErrorDialogVisible] = useState(false);
  const [errorDialogMessage, setErrorDialogMessage] = useState('');
  const [signaturePromptVisible, setSignaturePromptVisible] = useState(false);

  // ─── Show SignaturePrompt after NC inspection is saved (F-AC-46) ─────────────
  useEffect(() => {
    if (pendingNcSignature && savedInspection) {
      setSignaturePromptVisible(true);
    }
  }, [pendingNcSignature, savedInspection]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleWeightConfirm = useCallback(
    async (value: number) => {
      setWeightNumpadVisible(false);
      await validateWeight(value);
      addWeightLog({ measured_weight: value });
    },
    [validateWeight, addWeightLog],
  );

  const handleAddDefect = useCallback(() => {
    if (!defectTypeInput.trim()) return;
    addDefectLog({
      severity: defectSeverity,
      defect_type: defectTypeInput.trim(),
      defect_count: defectCount,
    });
    setDefectTypeInput('');
    setDefectSeverity('minor');
    setDefectCount(1);
  }, [defectTypeInput, defectSeverity, defectCount, addDefectLog]);

  const handleConfirmSave = useCallback(async () => {
    // Capture disposition BEFORE confirm() resets it
    const currentDisposition = disposition;
    try {
      await confirm();
      // NC dispositions (rechazado/reproceso) trigger signature prompt.
      // The useEffect above shows the dialog when pendingNcSignature is set.
      if (currentDisposition === 'rechazado' || currentDisposition === 'reproceso') {
        // Signature prompt will show — do NOT navigate away yet
      } else {
        setSnackbarMessage('Inspección guardada correctamente');
        setSnackbarVisible(true);
        setTimeout(() => {
          router.back();
        }, 1500);
      }
    } catch (e: any) {
      setErrorDialogMessage(e?.message ?? 'Error al guardar la inspección');
      setErrorDialogVisible(true);
    }
  }, [confirm, disposition, router]);

  const handleNcSign = useCallback(async () => {
    const success = await signNcInspection();
    if (success) {
      setSignaturePromptVisible(false);
      resetSavedInspection();
      setSnackbarMessage('Inspección guardada con firma NC');
      setSnackbarVisible(true);
      setTimeout(() => {
        router.back();
      }, 1500);
    }
  }, [signNcInspection, resetSavedInspection, router]);

  // Signature info for the prompt
  const ncSignatureInfo = savedInspection
    ? {
        documentType: 'quality_inspection' as const,
        documentId: savedInspection.id,
        requiredRoles: ['supervisor', 'admin'] as string[],
        sequence: 1,
        stepLabel: 'Firma de Calidad — No Conformidad',
      }
    : null;

  // ─── Selected product name ──────────────────────────────────────────────────
  const selectedProductName = productList.find((p) => p.sku === selectedSku)?.name ?? '';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="quality-capture-screen"
      keyboardShouldPersistTaps="handled"
    >
      {/* Inspector ID display */}
      <View style={styles.field}>
        <Text style={styles.label}>Inspector</Text>
        <TextInput
          mode="outlined"
          value={inspectorId}
          onChangeText={setInspectorId}
          placeholder="ID del inspector"
          style={styles.input}
          outlineStyle={styles.inputOutline}
          testID="capture-inspector-id"
        />
      </View>

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
              testID={`capture-shift-${opt.value}`}
            >
              {opt.label}
            </Chip>
          ))}
        </View>
      </View>

      {/* Product/SKU selector */}
      <View style={styles.field}>
        <Text style={styles.label}>Producto (SKU)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productRow}>
          {productList.map((p) => (
            <Chip
              key={p.sku}
              selected={selectedSku === p.sku}
              onPress={() => setSelectedSku(p.sku)}
              style={styles.chip}
              selectedColor={colors.primary}
              showSelectedCheck={false}
              mode={selectedSku === p.sku ? 'flat' : 'outlined'}
              testID={`capture-sku-${p.sku}`}
            >
              {p.name}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Disposition selector */}
      <View style={styles.field}>
        <Text style={styles.label}>Disposición</Text>
        <View style={styles.dispositionRow}>
          {DISPOSITION_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.dispositionCard,
                disposition === opt.value && { borderColor: opt.color, backgroundColor: opt.color + '15' },
              ]}
              onPress={() => setDisposition(opt.value)}
              activeOpacity={0.7}
              testID={`capture-disposition-${opt.value}`}
            >
              <Text style={[styles.dispositionLabel, disposition === opt.value && { color: opt.color }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Weight logs section — shown when disposition is liberado */}
      {disposition === 'liberado' && (
        <View style={styles.field}>
          <Text style={styles.label}>Registros de Peso</Text>

          {weightLogs.map((wl, idx) => (
            <View key={idx} style={styles.entryCard}>
              <Text style={styles.entryText}>{wl.measured_weight} g</Text>
              <Button
                compact
                onPress={() => removeWeightLog(idx)}
                textColor={colors.error}
                testID={`capture-remove-weight-${idx}`}
              >
                Quitar
              </Button>
            </View>
          ))}

          {weightLogs.length > 0 && weightValidation && !weightValidation.valid && (
            <Text style={styles.warningText}>{weightValidation.message}</Text>
          )}

          <AppButton
            onPress={() => setWeightNumpadVisible(true)}
            mode="outlined"
            style={styles.addButton}
          >
            Agregar peso
          </AppButton>
        </View>
      )}

      {/* Defect logs section — shown when disposition is rechazado or reproceso */}
      {(disposition === 'rechazado' || disposition === 'reproceso') && (
        <View style={styles.field}>
          <Text style={styles.label}>Registros de Defecto</Text>

          {defectLogs.map((dl, idx) => (
            <View key={idx} style={styles.entryCard}>
              <View style={styles.defectEntryInfo}>
                <AppBadge
                  variant={
                    dl.severity === 'critical' ? 'error' :
                    dl.severity === 'major' ? 'warning' : 'info'
                  }
                  label={dl.severity}
                />
                <Text style={styles.entryText}>{dl.defect_type} (x{dl.defect_count})</Text>
              </View>
              <Button
                compact
                onPress={() => removeDefectLog(idx)}
                textColor={colors.error}
                testID={`capture-remove-defect-${idx}`}
              >
                Quitar
              </Button>
            </View>
          ))}

          {/* Add defect form */}
          <View style={styles.addDefectForm}>
            <TextInput
              mode="outlined"
              value={defectTypeInput}
              onChangeText={setDefectTypeInput}
              placeholder="Tipo de defecto (texto libre)"
              style={styles.defectInput}
              outlineStyle={styles.inputOutline}
              testID="capture-defect-type"
            />
            <View style={styles.defectFormRow}>
              {/* Severity selector */}
              <View style={styles.severityRow}>
                {(['critical', 'major', 'minor'] as const).map((sev) => (
                  <Chip
                    key={sev}
                    selected={defectSeverity === sev}
                    onPress={() => setDefectSeverity(sev)}
                    style={styles.chip}
                    selectedColor={
                      sev === 'critical' ? colors.error :
                      sev === 'major' ? colors.caution : colors.primary
                    }
                    showSelectedCheck={false}
                    mode={defectSeverity === sev ? 'flat' : 'outlined'}
                    testID={`capture-severity-${sev}`}
                  >
                    {sev}
                  </Chip>
                ))}
              </View>
              <TextInput
                mode="outlined"
                value={defectCount.toString()}
                onChangeText={(t) => setDefectCount(parseInt(t) || 1)}
                keyboardType="numeric"
                style={styles.countInput}
                outlineStyle={styles.inputOutline}
                testID="capture-defect-count"
              />
            </View>
            <AppButton
              onPress={handleAddDefect}
              mode="contained"
              disabled={!defectTypeInput.trim()}
              style={styles.addButton}
            >
              Agregar defecto
            </AppButton>
          </View>
        </View>
      )}

      {/* Notes */}
      <View style={styles.field}>
        <Text style={styles.label}>Notas</Text>
        <TextInput
          mode="outlined"
          value={notes}
          onChangeText={setNotes}
          placeholder="Notas opcionales..."
          multiline
          numberOfLines={3}
          style={styles.textArea}
          outlineStyle={styles.inputOutline}
          testID="capture-notes"
        />
      </View>

      {/* Validation error */}
      {validationMessage && (
        <Text style={styles.validationError}>{validationMessage}</Text>
      )}

      {/* Confirm button */}
      <AppButton
        onPress={handleConfirmSave}
        mode="contained"
        loading={saving}
        disabled={saving}
        style={styles.saveButton}
        testID="capture-confirm-save"
      >
        Guardar Inspección
      </AppButton>

      {/* Weight SmartNumpad modal */}
      <SmartNumpad
        visible={weightNumpadVisible}
        title="Registrar Peso"
        onDismiss={() => setWeightNumpadVisible(false)}
        onConfirm={handleWeightConfirm}
        min={1}
        max={99999}
        precision={0}
        unit=" g"
        label="peso"
      />

      {/* Success Snackbar */}
      <Portal>
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
          style={styles.snackbar}
          testID="capture-snackbar"
        >
          {snackbarMessage}
        </Snackbar>

        {/* Error dialog */}
        <Dialog
          visible={errorDialogVisible}
          onDismiss={() => setErrorDialogVisible(false)}
        >
          <Dialog.Icon icon="alert-circle" />
          <Dialog.Title>Error</Dialog.Title>
          <Dialog.Content>
            <Text>{errorDialogMessage}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setErrorDialogVisible(false)}>Entendido</Button>
          </Dialog.Actions>
        </Dialog>

        {/* NC Signature Prompt (F-AC-46) — shown after saving NC inspection */}
        {ncSignatureInfo && savedInspection && (
          <SignaturePrompt
            visible={signaturePromptVisible}
            signature={ncSignatureInfo}
            currentRole={authRole}
            currentUserName={authName ?? 'Inspector'}
            existingSignatures={[]}
            onSign={handleNcSign}
            onSkip={() => {
              setSignaturePromptVisible(false);
              resetSavedInspection();
              router.back();
            }}
            onDismiss={() => {
              setSignaturePromptVisible(false);
              resetSavedInspection();
              router.back();
            }}
          />
        )}
      </Portal>
    </ScrollView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGray,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.bodyMedium,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.white,
  },
  inputOutline: {
    borderRadius: borderRadius.sm,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  chip: {
    marginBottom: spacing.xxs,
  },
  productRow: {
    flexDirection: 'row',
    maxHeight: 40,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  dispositionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dispositionCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  dispositionLabel: {
    fontSize: typography.sizes.bodyMedium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  defectEntryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  entryText: {
    fontSize: typography.sizes.bodyMedium,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  warningText: {
    fontSize: typography.sizes.bodySmall,
    color: colors.error,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  addButton: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  addDefectForm: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  defectInput: {
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  defectFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  severityRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flex: 1,
  },
  countInput: {
    width: 60,
    backgroundColor: colors.surface,
    textAlign: 'center',
  },
  textArea: {
    backgroundColor: colors.white,
    minHeight: 80,
  },
  validationError: {
    color: colors.error,
    fontSize: typography.sizes.bodyMedium,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  saveButton: {
    borderRadius: borderRadius.sm,
    marginTop: spacing.md,
  },
  snackbar: {
    marginBottom: spacing.md,
  },
});
