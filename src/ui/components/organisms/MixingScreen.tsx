/**
 * MixingScreen organism — Mixing Batch form (F-PD-17).
 *
 * Spec compliance:
 * - MF-1: SHALL record mezcladora, agitador, batch sequence
 * - MF-2: SHALL capture azucar, licor, cocoa, grasa vegetal, lecitina, reproceso per batch
 * - MF-3: SHALL record viscosity (cps) + discharge temp
 * - MF-4: SHALL track inicial/final/consumo inventory per component
 * - MF-5: SHALL auto-sum mezcladas, molidas, reproceso, desperdicio
 * - MF-6: SHALL require Operador, Jefe Turno, Auxiliar, Firma Entrega/Recibe signatures
 * - S1: Operator enters ingredients → auto-calc totals → signs → Jefe Turno + Auxiliar sign.
 *
 * Signature chain: operator → supervisor → auxiliar → admin (Firma Entrega/Recibe)
 * - document_type: 'mixing_batch'
 * - Uses useSignatures hook for chain orchestration
 * - Uses SignaturePrompt for the tap-to-confirm dialog
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Text,
  Button,
  Card,
  TextInput,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';

import { useMixingRepository } from '../../../repositories/useMixingRepository';
import { useSignatures, DEFAULT_CHAINS } from '../../../hooks/useSignatures';
import { useAuthStore } from '../../../auth/useAuthStore';
import { useCatalogStore } from '../../store/catalogStore';
import { SignaturePrompt } from '../molecules/SignaturePrompt';
import type { IMixingBatch } from '../../../core/types';

// ─── Constants ──────────────────────────────────────────────────────────────────

const CHAIN_CONFIG = DEFAULT_CHAINS.mixing_batch;

const INGREDIENT_FIELDS: Array<{
  key: keyof Pick<IMixingBatch, 'azucar_kg' | 'licor_kg' | 'cocoa_kg' | 'grasa_vegetal_kg' | 'lecitina_kg' | 'reproceso_kg'>;
  label: string;
}> = [
  { key: 'azucar_kg', label: 'Azúcar' },
  { key: 'licor_kg', label: 'Licor' },
  { key: 'cocoa_kg', label: 'Cocoa' },
  { key: 'grasa_vegetal_kg', label: 'Grasa Vegetal' },
  { key: 'lecitina_kg', label: 'Lecitina' },
  { key: 'reproceso_kg', label: 'Reproceso' },
];

const INVENTORY_COMPONENTS = [
  'azucar',
  'licor',
  'cocoa',
  'grasa_vegetal',
  'lecitina',
  'reproceso',
] as const;

// ─── Numeric input helper ───────────────────────────────────────────────────────

function parseNumeric(text: string): number {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function MixingScreen() {
  const repository = useMixingRepository();
  const { selectedLine, selectedMachine, selectedShift } = useCatalogStore();
  const { operatorId, fullName, role: currentRole } = useAuthStore();

  // ─── Form state: MF-1 ──────────────────────────────────────────────────────

  const [mezcladora, setMezcladora] = useState('');
  const [agitador, setAgitador] = useState('');
  const [batchSequence, setBatchSequence] = useState('');

  // ─── Ingredients: MF-2 ────────────────────────────────────────────────────

  const [ingredients, setIngredients] = useState<Record<string, string>>({});

  // ─── Process: MF-3 ─────────────────────────────────────────────────────────

  const [viscosityCps, setViscosityCps] = useState('');
  const [dischargeTemp, setDischargeTemp] = useState('');

  // ─── Inventories: MF-4 ─────────────────────────────────────────────────────

  const [invInitial, setInvInitial] = useState<Record<string, string>>({});
  const [invFinal, setInvFinal] = useState<Record<string, string>>({});
  const [consumo, setConsumo] = useState<Record<string, string>>({});

  // ─── UI state ──────────────────────────────────────────────────────────────

  const [saving, setSaving] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const docIdRef = useRef<string | null>(null);

  // Signature hook
  const {
    status: sigStatus,
    isLoading: sigLoading,
    error: sigError,
    sign: doSign,
    refresh: refreshSigs,
  } = useSignatures({
    documentType: 'mixing_batch',
    documentId: savedDocId ?? '',
    chainConfig: CHAIN_CONFIG,
  });

  // ─── Auto-calc totals: MF-5 ────────────────────────────────────────────────

  const totals = useMemo(() => {
    const azucar = parseNumeric(ingredients.azucar_kg ?? '');
    const licor = parseNumeric(ingredients.licor_kg ?? '');
    const cocoa = parseNumeric(ingredients.cocoa_kg ?? '');
    const grasa = parseNumeric(ingredients.grasa_vegetal_kg ?? '');
    const lecitina = parseNumeric(ingredients.lecitina_kg ?? '');
    const reproceso = parseNumeric(ingredients.reproceso_kg ?? '');

    const total = azucar + licor + cocoa + grasa + lecitina + reproceso;
    return {
      mezcladas: total,
      molidas: total * 0.85, // estimated 85% mill yield
      reproceso_total: reproceso,
      desperdicio: total * 0.02, // estimated 2% waste
    };
  }, [ingredients]);

  // ─── Input setters ─────────────────────────────────────────────────────────

  const setIngredient = useCallback((key: string, value: string) => {
    setIngredients((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setInvInitialField = useCallback((key: string, value: string) => {
    setInvInitial((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setInvFinalField = useCallback((key: string, value: string) => {
    setInvFinal((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setConsumoField = useCallback((key: string, value: string) => {
    setConsumo((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ─── Build payload ─────────────────────────────────────────────────────────

  const buildPayload = useCallback(
    (overrides: Partial<IMixingBatch> = {}): Omit<IMixingBatch, 'id' | 'updated_at' | 'is_deleted'> => {
      if (!selectedLine || !selectedMachine || !selectedShift || !operatorId) {
        throw new Error('Faltan datos de contexto (línea, máquina, turno u operador)');
      }

      return {
        line_id: selectedLine,
        machine_id: selectedMachine,
        shift_id: selectedShift,
        operator_id: operatorId,
        batch_sequence: parseNumeric(batchSequence),
        mezcladora,
        agitador,
        azucar_kg: parseNumeric(ingredients.azucar_kg ?? ''),
        licor_kg: parseNumeric(ingredients.licor_kg ?? ''),
        cocoa_kg: parseNumeric(ingredients.cocoa_kg ?? ''),
        grasa_vegetal_kg: parseNumeric(ingredients.grasa_vegetal_kg ?? ''),
        lecitina_kg: parseNumeric(ingredients.lecitina_kg ?? ''),
        reproceso_kg: parseNumeric(ingredients.reproceso_kg ?? ''),
        viscosity_cps: parseNumeric(viscosityCps),
        discharge_temp: parseNumeric(dischargeTemp),
        mezcladas: totals.mezcladas,
        molidas: totals.molidas,
        reproceso_total: totals.reproceso_total,
        desperdicio: totals.desperdicio,
        inv_ini_azucar: parseNumeric(invInitial.azucar ?? ''),
        inv_ini_licor: parseNumeric(invInitial.licor ?? ''),
        inv_ini_cocoa: parseNumeric(invInitial.cocoa ?? ''),
        inv_ini_grasa_vegetal: parseNumeric(invInitial.grasa_vegetal ?? ''),
        inv_ini_lecitina: parseNumeric(invInitial.lecitina ?? ''),
        inv_ini_reproceso: parseNumeric(invInitial.reproceso ?? ''),
        inv_fin_azucar: parseNumeric(invFinal.azucar ?? ''),
        inv_fin_licor: parseNumeric(invFinal.licor ?? ''),
        inv_fin_cocoa: parseNumeric(invFinal.cocoa ?? ''),
        inv_fin_grasa_vegetal: parseNumeric(invFinal.grasa_vegetal ?? ''),
        inv_fin_lecitina: parseNumeric(invFinal.lecitina ?? ''),
        inv_fin_reproceso: parseNumeric(invFinal.reproceso ?? ''),
        consumo_azucar: parseNumeric(consumo.azucar ?? ''),
        consumo_licor: parseNumeric(consumo.licor ?? ''),
        consumo_cocoa: parseNumeric(consumo.cocoa ?? ''),
        consumo_grasa_vegetal: parseNumeric(consumo.grasa_vegetal ?? ''),
        consumo_lecitina: parseNumeric(consumo.lecitina ?? ''),
        consumo_reproceso: parseNumeric(consumo.reproceso ?? ''),
        ...overrides,
      };
    },
    [
      selectedLine, selectedMachine, selectedShift, operatorId,
      batchSequence, mezcladora, agitador, ingredients,
      viscosityCps, dischargeTemp, totals,
      invInitial, invFinal, consumo,
    ]
  );

  // ─── Create document + start signature chain ───────────────────────────────

  const startSignatureChain = useCallback(async () => {
    if (!selectedLine || !selectedMachine || !selectedShift || !operatorId) return;

    setSaving(true);
    try {
      const payload = buildPayload();
      const doc = await repository.create(payload);
      docIdRef.current = doc.get('id');
      setSavedDocId(doc.get('id'));
      setCurrentStep(0);
      setShowSignature(true);
    } catch (err: any) {
      console.warn('[MixingScreen] Create failed:', err?.message ?? err);
    } finally {
      setSaving(false);
    }
  }, [
    selectedLine, selectedMachine, selectedShift, operatorId,
    buildPayload, repository,
  ]);

  // ─── Update existing document ──────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!savedDocId) return;

    setSaving(true);
    try {
      const payload = buildPayload();
      await repository.update(savedDocId, payload);
      await refreshSigs();
      setShowSignature(true);
    } catch (err: any) {
      console.warn('[MixingScreen] Save failed:', err?.message ?? err);
    } finally {
      setSaving(false);
    }
  }, [savedDocId, buildPayload, repository, refreshSigs]);

  // ─── Signature handlers ────────────────────────────────────────────────────

  const handleSign = useCallback(async () => {
    const success = await doSign();
    if (success) {
      if (sigStatus.nextRole === null) {
        setShowSignature(false);
        setCurrentStep(0);
      } else {
        setCurrentStep((prev) => prev + 1);
      }
    }
  }, [doSign, sigStatus.nextRole]);

  const handleSkipSignature = useCallback(() => {
    setShowSignature(false);
  }, []);

  // ─── Render numeric input helper ───────────────────────────────────────────

  const renderNumericInput = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options?: { disabled?: boolean; suffix?: string; placeholder?: string }
  ) => (
    <TextInput
      mode="outlined"
      label={options?.suffix ? `${label} (${options.suffix})` : label}
      value={value}
      onChangeText={(text) => onChange(parseNumeric(text).toString())}
      keyboardType="decimal-pad"
      disabled={options?.disabled ?? !!savedDocId}
      placeholder={options?.placeholder}
      style={styles.input}
    />
  );

  const renderTextInput = (
    label: string,
    value: string,
    onChange: (v: string) => void,
  ) => (
    <TextInput
      mode="outlined"
      label={label}
      value={value}
      onChangeText={onChange}
      disabled={!!savedDocId}
      style={styles.input}
    />
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text variant="headlineSmall" style={styles.title}>
          Mezcladora (F-PD-17)
        </Text>

        {savedDocId && (
          <Text variant="bodySmall" style={styles.statusHint}>
            Guardado — firmas pendientes
          </Text>
        )}

        {/* Batch info — MF-1 */}
        <Card style={styles.card}>
          <Card.Title title="Información del Batch" />
          <Card.Content>
            {renderTextInput('Mezcladora', mezcladora, setMezcladora)}
            {renderTextInput('Agitador', agitador, setAgitador)}
            {renderNumericInput('Secuencia de Batch', batchSequence, setBatchSequence, {
              placeholder: 'Ej: 1',
            })}
          </Card.Content>
        </Card>

        {/* Ingredients — MF-2 */}
        <Card style={styles.card}>
          <Card.Title title="Ingredientes por Batch" />
          <Card.Content>
            {INGREDIENT_FIELDS.map((field) => (
              <View key={field.key}>
                {renderNumericInput(
                  field.label,
                  ingredients[field.key] ?? '',
                  (v) => setIngredient(field.key, v),
                  { suffix: 'kg' }
                )}
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Process parameters — MF-3 */}
        <Card style={styles.card}>
          <Card.Title title="Parámetros de Proceso" />
          <Card.Content>
            {renderNumericInput('Viscosidad', viscosityCps, setViscosityCps, {
              suffix: 'cps',
            })}
            {renderNumericInput('Temp. Descarga', dischargeTemp, setDischargeTemp, {
              suffix: '°C',
            })}
          </Card.Content>
        </Card>

        {/* Auto-calc totals — MF-5 */}
        <Card style={styles.card}>
          <Card.Title title="Totales Calculados" />
          <Card.Content>
            <View style={styles.totalRow}>
              <Text variant="bodyMedium" style={styles.totalLabel}>Mezcladas</Text>
              <Text variant="bodyMedium" style={styles.totalValue}>{totals.mezcladas.toFixed(2)} kg</Text>
            </View>
            <View style={styles.totalRow}>
              <Text variant="bodyMedium" style={styles.totalLabel}>Molidas</Text>
              <Text variant="bodyMedium" style={styles.totalValue}>{totals.molidas.toFixed(2)} kg</Text>
            </View>
            <View style={styles.totalRow}>
              <Text variant="bodyMedium" style={styles.totalLabel}>Reproceso</Text>
              <Text variant="bodyMedium" style={styles.totalValue}>{totals.reproceso_total.toFixed(2)} kg</Text>
            </View>
            <View style={styles.totalRow}>
              <Text variant="bodyMedium" style={styles.totalLabel}>Desperdicio</Text>
              <Text variant="bodyMedium" style={styles.totalValue}>{totals.desperdicio.toFixed(2)} kg</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Inventories — MF-4 */}
        <Card style={styles.card}>
          <Card.Title title="Inventarios" />
          <Card.Content>
            <Text variant="titleSmall" style={styles.sectionSubtitle}>
              Inventario Inicial
            </Text>
            {INVENTORY_COMPONENTS.map((comp) => (
              <View key={`ini-${comp}`}>
                {renderNumericInput(
                  comp.charAt(0).toUpperCase() + comp.slice(1).replace(/_/g, ' '),
                  invInitial[comp] ?? '',
                  (v) => setInvInitialField(comp, v),
                  { suffix: 'kg' }
                )}
              </View>
            ))}

            <Divider style={styles.invDivider} />

            <Text variant="titleSmall" style={styles.sectionSubtitle}>
              Inventario Final
            </Text>
            {INVENTORY_COMPONENTS.map((comp) => (
              <View key={`fin-${comp}`}>
                {renderNumericInput(
                  comp.charAt(0).toUpperCase() + comp.slice(1).replace(/_/g, ' '),
                  invFinal[comp] ?? '',
                  (v) => setInvFinalField(comp, v),
                  { suffix: 'kg' }
                )}
              </View>
            ))}

            <Divider style={styles.invDivider} />

            <Text variant="titleSmall" style={styles.sectionSubtitle}>
              Consumo
            </Text>
            {INVENTORY_COMPONENTS.map((comp) => (
              <View key={`con-${comp}`}>
                {renderNumericInput(
                  comp.charAt(0).toUpperCase() + comp.slice(1).replace(/_/g, ' '),
                  consumo[comp] ?? '',
                  (v) => setConsumoField(comp, v),
                  { suffix: 'kg' }
                )}
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Signature status — FS-7 */}
        {savedDocId && (
          <Card style={styles.card}>
            <Card.Title title="Estado de Firmas" />
            <Card.Content>
              {sigLoading ? (
                <ActivityIndicator />
              ) : (
                sigStatus.steps.map((step, index) => (
                  <View key={index} style={styles.sigStepRow}>
                    <Text
                      variant="bodyMedium"
                      style={[
                        styles.sigStepLabel,
                        step.status === 'signed' && styles.sigStepSigned,
                      ]}
                    >
                      {step.label}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={[
                        styles.sigStepStatus,
                        step.status === 'signed'
                          ? styles.sigStepComplete
                          : styles.sigStepPending,
                      ]}
                    >
                      {step.status === 'signed'
                        ? '✓ Firmado'
                        : '— Pendiente'}
                    </Text>
                  </View>
                ))
              )}
              {sigError && (
                <Text variant="bodySmall" style={styles.errorText}>
                  {sigError}
                </Text>
              )}
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Action buttons */}
      <View style={styles.footer}>
        <Button
          mode="contained"
          onPress={savedDocId ? handleSave : startSignatureChain}
          loading={saving}
          disabled={saving || !selectedShift || !operatorId}
          style={styles.saveButton}
        >
          {savedDocId ? 'Guardar Cambios' : 'Guardar y Firmar'}
        </Button>

        {savedDocId && !sigStatus.isComplete && (
          <Button
            mode="outlined"
            onPress={() => setShowSignature(true)}
            disabled={sigLoading}
            style={styles.signButton}
          >
            Firmar
          </Button>
        )}
      </View>

      {/* Signature Prompt — MF-6 */}
      {savedDocId && (
        <SignaturePrompt
          visible={showSignature}
          signature={{
            documentType: 'mixing_batch',
            documentId: savedDocId,
            requiredRoles: [CHAIN_CONFIG.roles[currentStep]],
            sequence: currentStep + 1,
            stepLabel: CHAIN_CONFIG.labels[currentStep],
          }}
          currentRole={currentRole}
          currentUserName={fullName ?? ''}
          existingSignatures={sigStatus.steps
            .filter((s) => s.status === 'signed')
            .map((s) => ({
              signer_name: s.signerName ?? '',
              signer_role: s.role,
              signed_at: s.signedAt ?? 0,
              sequence:
                sigStatus.steps.findIndex((step) => step.role === s.role) + 1,
            }))}
          onSign={handleSign}
          onSkip={handleSkipSignature}
          onDismiss={handleSkipSignature}
        />
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    flexGrow: 1,
  },
  title: {
    fontWeight: '700',
    color: '#5D4037',
    marginBottom: 16,
  },
  statusHint: {
    color: '#F57F17',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  card: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  input: {
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
    color: '#5D4037',
  },
  invDivider: {
    marginVertical: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  totalLabel: {
    fontWeight: '600',
    color: '#5D4037',
  },
  totalValue: {
    fontWeight: '700',
    color: '#2E7D32',
  },
  sigStepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  sigStepLabel: {
    flex: 1,
  },
  sigStepSigned: {
    fontWeight: '600',
  },
  sigStepStatus: {
    fontWeight: '600',
  },
  sigStepPending: {
    color: '#9E9E9E',
  },
  sigStepComplete: {
    color: '#2E7D32',
  },
  errorText: {
    color: '#C62828',
    marginTop: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  saveButton: {
    flex: 1,
  },
  signButton: {
    flex: 1,
  },
});
