/**
 * ToasterScreen organism — Toaster Log form (F-PD-16).
 *
 * Spec compliance:
 * - TF-1: SHALL capture temp (superior/media/inferior), RPM, vapor pressure per toaster
 * - TF-2: SHALL record cacao crudo + tostado humidity %
 * - TF-3: SHALL track pesadas/batch, silo, lotes
 * - TF-4: SHALL record tiempo muerto with cause
 * - TF-5: SHALL capture initial/final inventories: cascarilla, polvillo, granilla, cacao crudo, azucar
 * - TF-6: SHALL require Operador, Auxiliar, Jefe Turno signatures
 * - S1: Hourly readings → shift end → operator signs → Auxiliar → Jefe Turno.
 *
 * Signature chain: operator → auxiliar → supervisor (Jefe Turno)
 * - document_type: 'toaster_log'
 * - Uses useSignatures hook for chain orchestration
 * - Uses SignaturePrompt for the tap-to-confirm dialog
 */

import React, { useState, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Text,
  Button,
  Card,
  TextInput,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';

import { useToasterRepository } from '../../../repositories/useToasterRepository';
import { useSignatures, DEFAULT_CHAINS } from '../../../hooks/useSignatures';
import { useAuthStore } from '../../../auth/useAuthStore';
import { useCatalogStore } from '../../store/catalogStore';
import { SignaturePrompt } from '../molecules/SignaturePrompt';
import type { IToasterLog } from '../../../core/types';

// ─── Constants ──────────────────────────────────────────────────────────────────

const CHAIN_CONFIG = DEFAULT_CHAINS.toaster_log;

const INVENTORY_FIELDS: Array<{
  key: keyof Pick<
    IToasterLog,
    | 'inv_ini_cascarilla'
    | 'inv_ini_polvillo'
    | 'inv_ini_granilla'
    | 'inv_ini_cacao_crudo'
    | 'inv_ini_azucar'
    | 'inv_fin_cascarilla'
    | 'inv_fin_polvillo'
    | 'inv_fin_granilla'
    | 'inv_fin_cacao_crudo'
    | 'inv_fin_azucar'
  >;
  label: string;
  isInitial: boolean;
}> = [
  { key: 'inv_ini_cascarilla', label: 'Cascarilla', isInitial: true },
  { key: 'inv_ini_polvillo', label: 'Polvillo', isInitial: true },
  { key: 'inv_ini_granilla', label: 'Granilla', isInitial: true },
  { key: 'inv_ini_cacao_crudo', label: 'Cacao Crudo', isInitial: true },
  { key: 'inv_ini_azucar', label: 'Azúcar', isInitial: true },
  { key: 'inv_fin_cascarilla', label: 'Cascarilla', isInitial: false },
  { key: 'inv_fin_polvillo', label: 'Polvillo', isInitial: false },
  { key: 'inv_fin_granilla', label: 'Granilla', isInitial: false },
  { key: 'inv_fin_cacao_crudo', label: 'Cacao Crudo', isInitial: false },
  { key: 'inv_fin_azucar', label: 'Azúcar', isInitial: false },
];

// ─── Numeric input helper ───────────────────────────────────────────────────────

function parseNumeric(text: string): number {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function ToasterScreen() {
  const repository = useToasterRepository();
  const { selectedLine, selectedMachine, selectedShift } = useCatalogStore();
  const { operatorId, fullName, role: currentRole } = useAuthStore();

  // ─── Form state ────────────────────────────────────────────────────────────

  const [batchNumber, setBatchNumber] = useState('');
  const [tempSuperior, setTempSuperior] = useState('');
  const [tempMedia, setTempMedia] = useState('');
  const [tempInferior, setTempInferior] = useState('');
  const [rpm, setRpm] = useState('');
  const [vaporPressure, setVaporPressure] = useState('');
  const [cacaoCrudoHumidity, setCacaoCrudoHumidity] = useState('');
  const [cacaoTostadoHumidity, setCacaoTostadoHumidity] = useState('');
  const [pesadas, setPesadas] = useState('');
  const [silo, setSilo] = useState('');
  const [lotes, setLotes] = useState('');
  const [tiempoMuertoMin, setTiempoMuertoMin] = useState('');
  const [tiempoMuertoCause, setTiempoMuertoCause] = useState('');

  // Inventory state
  const [inv, setInv] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);

  // Signature dialog state
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
    documentType: 'toaster_log',
    documentId: savedDocId ?? '',
    chainConfig: CHAIN_CONFIG,
  });

  // ─── Inventory setter ──────────────────────────────────────────────────────

  const setInventoryField = useCallback(
    (key: string, value: string) => {
      setInv((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // ─── Build payload ─────────────────────────────────────────────────────────

  const buildPayload = useCallback(
    (
      overrides: Partial<IToasterLog> = {}
    ): Omit<IToasterLog, 'id' | 'created_at' | 'updated_at' | 'is_deleted'> => {
      if (!selectedLine || !selectedMachine || !selectedShift || !operatorId) {
        throw new Error('Faltan datos de contexto (línea, máquina, turno u operador)');
      }

      return {
        line_id: selectedLine,
        machine_id: selectedMachine,
        shift_id: selectedShift,
        operator_id: operatorId,
        batch_number: batchNumber,
        temp_superior: parseNumeric(tempSuperior),
        temp_media: parseNumeric(tempMedia),
        temp_inferior: parseNumeric(tempInferior),
        rpm: parseNumeric(rpm),
        vapor_pressure: parseNumeric(vaporPressure),
        cacao_crudo_humidity: parseNumeric(cacaoCrudoHumidity),
        cacao_tostado_humidity: parseNumeric(cacaoTostadoHumidity),
        pesadas: parseNumeric(pesadas),
        silo,
        lotes,
        tiempo_muerto_min: parseNumeric(tiempoMuertoMin),
        tiempo_muerto_cause: tiempoMuertoCause,
        inv_ini_cascarilla: parseNumeric(inv.inv_ini_cascarilla ?? ''),
        inv_ini_polvillo: parseNumeric(inv.inv_ini_polvillo ?? ''),
        inv_ini_granilla: parseNumeric(inv.inv_ini_granilla ?? ''),
        inv_ini_cacao_crudo: parseNumeric(inv.inv_ini_cacao_crudo ?? ''),
        inv_ini_azucar: parseNumeric(inv.inv_ini_azucar ?? ''),
        inv_fin_cascarilla: parseNumeric(inv.inv_fin_cascarilla ?? ''),
        inv_fin_polvillo: parseNumeric(inv.inv_fin_polvillo ?? ''),
        inv_fin_granilla: parseNumeric(inv.inv_fin_granilla ?? ''),
        inv_fin_cacao_crudo: parseNumeric(inv.inv_fin_cacao_crudo ?? ''),
        inv_fin_azucar: parseNumeric(inv.inv_fin_azucar ?? ''),
        ...overrides,
      };
    },
    [
      selectedLine,
      selectedMachine,
      selectedShift,
      operatorId,
      batchNumber,
      tempSuperior,
      tempMedia,
      tempInferior,
      rpm,
      vaporPressure,
      cacaoCrudoHumidity,
      cacaoTostadoHumidity,
      pesadas,
      silo,
      lotes,
      tiempoMuertoMin,
      tiempoMuertoCause,
      inv,
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
      console.warn('[ToasterScreen] Create failed:', err?.message ?? err);
    } finally {
      setSaving(false);
    }
  }, [
    selectedLine,
    selectedMachine,
    selectedShift,
    operatorId,
    buildPayload,
    repository,
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
      console.warn('[ToasterScreen] Save failed:', err?.message ?? err);
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

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text variant="headlineSmall" style={styles.title}>
          Registro Tostador (F-PD-16)
        </Text>

        {savedDocId && (
          <Text variant="bodySmall" style={styles.statusHint}>
            Guardado — firmas pendientes
          </Text>
        )}

        {/* Batch info — TF-3 */}
        <Card style={styles.card}>
          <Card.Title title="Información del Lote" />
          <Card.Content>
            {renderNumericInput('Número de Batch', batchNumber, setBatchNumber, {
              placeholder: 'Ej: 001',
            })}
            <View style={styles.row}>
              <View style={styles.halfInput}>
                {renderNumericInput('Pesadas', pesadas, setPesadas)}
              </View>
              <View style={styles.halfInput}>
                <TextInput
                  mode="outlined"
                  label="Silo"
                  value={silo}
                  onChangeText={setSilo}
                  disabled={!!savedDocId}
                  style={styles.input}
                />
              </View>
            </View>
            <TextInput
              mode="outlined"
              label="Lotes"
              value={lotes}
              onChangeText={setLotes}
              disabled={!!savedDocId}
              style={styles.input}
            />
          </Card.Content>
        </Card>

        {/* Temperature readings — TF-1 */}
        <Card style={styles.card}>
          <Card.Title title="Temperaturas" />
          <Card.Content>
            {renderNumericInput('Temp. Superior', tempSuperior, setTempSuperior, {
              suffix: '°C',
            })}
            {renderNumericInput('Temp. Media', tempMedia, setTempMedia, {
              suffix: '°C',
            })}
            {renderNumericInput('Temp. Inferior', tempInferior, setTempInferior, {
              suffix: '°C',
            })}
          </Card.Content>
        </Card>

        {/* Process parameters — TF-1 */}
        <Card style={styles.card}>
          <Card.Title title="Parámetros de Proceso" />
          <Card.Content>
            {renderNumericInput('RPM', rpm, setRpm)}
            {renderNumericInput('Presión de Vapor', vaporPressure, setVaporPressure, {
              suffix: 'bar',
            })}
          </Card.Content>
        </Card>

        {/* Humidity — TF-2 */}
        <Card style={styles.card}>
          <Card.Title title="Humedad" />
          <Card.Content>
            <View style={styles.row}>
              <View style={styles.halfInput}>
                {renderNumericInput('Cacao Crudo', cacaoCrudoHumidity, setCacaoCrudoHumidity, {
                  suffix: '%',
                })}
              </View>
              <View style={styles.halfInput}>
                {renderNumericInput('Cacao Tostado', cacaoTostadoHumidity, setCacaoTostadoHumidity, {
                  suffix: '%',
                })}
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Dead time — TF-4 */}
        <Card style={styles.card}>
          <Card.Title title="Tiempo Muerto" />
          <Card.Content>
            <View style={styles.row}>
              <View style={styles.halfInput}>
                {renderNumericInput('Minutos', tiempoMuertoMin, setTiempoMuertoMin)}
              </View>
              <View style={styles.halfInput}>
                <TextInput
                  mode="outlined"
                  label="Causa"
                  value={tiempoMuertoCause}
                  onChangeText={setTiempoMuertoCause}
                  disabled={!!savedDocId}
                  style={styles.input}
                />
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Inventories — TF-5 */}
        <Card style={styles.card}>
          <Card.Title title="Inventarios" />
          <Card.Content>
            <Text variant="titleSmall" style={styles.sectionSubtitle}>
              Inventario Inicial
            </Text>
            {INVENTORY_FIELDS.filter((f) => f.isInitial).map((field) => (
              <View key={field.key}>
                {renderNumericInput(
                  field.label,
                  inv[field.key] ?? '',
                  (v) => setInventoryField(field.key, v),
                  { suffix: 'kg' }
                )}
              </View>
            ))}

            <Divider style={styles.invDivider} />

            <Text variant="titleSmall" style={styles.sectionSubtitle}>
              Inventario Final
            </Text>
            {INVENTORY_FIELDS.filter((f) => !f.isInitial).map((field) => (
              <View key={field.key}>
                {renderNumericInput(
                  field.label,
                  inv[field.key] ?? '',
                  (v) => setInventoryField(field.key, v),
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

      {/* Signature Prompt — TF-6 */}
      {savedDocId && (
        <SignaturePrompt
          visible={showSignature}
          signature={{
            documentType: 'toaster_log',
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
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
