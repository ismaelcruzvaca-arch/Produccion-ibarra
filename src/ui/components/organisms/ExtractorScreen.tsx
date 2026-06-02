/**
 * ExtractorScreen organism — Extractor Check form (F-PD-18).
 *
 * Spec compliance:
 * - EF-1: SHALL present 8 extractors as on/off toggles
 * - EF-2: SHALL record last cleaning date of Cedazo TT
 * - EF-3: SHALL require Operador, Jefe Turno signatures
 * - S1: Operator checks 8 extractors + cleaning date → Jefe Turno signs.
 *
 * Signature chain: operator → supervisor (Jefe Turno)
 * - document_type: 'extractor_check'
 * - Uses useSignatures hook for chain orchestration
 * - Uses SignaturePrompt for the tap-to-confirm dialog
 */

import React, { useState, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, Switch } from 'react-native';
import {
  Text,
  Button,
  Card,
  TextInput,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import type { RxDocument } from 'rxdb';

import { useExtractorRepository } from '../../../repositories/useExtractorRepository';
import { useSignatures, DEFAULT_CHAINS } from '../../../hooks/useSignatures';
import { useAuthStore } from '../../../auth/useAuthStore';
import { useCatalogStore } from '../../store/catalogStore';
import { SignaturePrompt } from '../molecules/SignaturePrompt';
import { nowMs } from '../../../utils/timestamp';
import type { IExtractorCheck } from '../../../core/types';

// ─── Constants ──────────────────────────────────────────────────────────────────

const EXTRACTOR_LABELS = [
  'Extractor 1',
  'Extractor 2',
  'Extractor 3',
  'Extractor 4',
  'Extractor 5',
  'Extractor 6',
  'Extractor 7',
  'Extractor 8',
] as const;

const CHAIN_CONFIG = DEFAULT_CHAINS.extractor_check;

// ─── Component ──────────────────────────────────────────────────────────────────

export default function ExtractorScreen() {
  const repository = useExtractorRepository();
  const { selectedLine, selectedMachine, selectedShift } = useCatalogStore();
  const { operatorId, fullName, role: currentRole } = useAuthStore();

  // Form state
  const [extractors, setExtractors] = useState<boolean[]>([
    true, true, true, true,
    true, true, true, true,
  ]);
  const [cleaningDate, setCleaningDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);

  // Signature dialog state
  const [showSignature, setShowSignature] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Refs for SignaturePrompt
  const docIdRef = useRef<string | null>(null);

  // Signature hook — active only after we have a saved document
  const {
    status: sigStatus,
    isLoading: sigLoading,
    error: sigError,
    sign: doSign,
    refresh: refreshSigs,
  } = useSignatures({
    documentType: 'extractor_check',
    documentId: savedDocId ?? '',
    chainConfig: CHAIN_CONFIG,
  });

  // ─── Toggle handler ─────────────────────────────────────────────────────────

  const toggleExtractor = useCallback((index: number) => {
    setExtractors((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  // ─── Save & start signature chain ──────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!selectedShift || !operatorId || !savedDocId) return;

    setSaving(true);
    try {
      await repository.update(savedDocId, {
        extractor_1_on: extractors[0],
        extractor_2_on: extractors[1],
        extractor_3_on: extractors[2],
        extractor_4_on: extractors[3],
        extractor_5_on: extractors[4],
        extractor_6_on: extractors[5],
        extractor_7_on: extractors[6],
        extractor_8_on: extractors[7],
        cedazo_tt_last_cleaning: new Date(cleaningDate).getTime(),
      });
      await refreshSigs();
      setShowSignature(true);
    } catch (err: any) {
      console.warn('[ExtractorScreen] Save failed:', err?.message ?? err);
    } finally {
      setSaving(false);
    }
  }, [
    selectedShift,
    operatorId,
    savedDocId,
    extractors,
    cleaningDate,
    repository,
    refreshSigs,
  ]);

  // ─── Initial save (creates document, then opens signature chain) ────────────

  const startSignatureChain = useCallback(async () => {
    if (!selectedLine || !selectedMachine || !selectedShift || !operatorId) return;

    setSaving(true);
    try {
      const doc = await repository.create({
        line_id: selectedLine,
        machine_id: selectedMachine,
        shift_id: selectedShift,
        operator_id: operatorId,
        extractor_1_on: extractors[0],
        extractor_2_on: extractors[1],
        extractor_3_on: extractors[2],
        extractor_4_on: extractors[3],
        extractor_5_on: extractors[4],
        extractor_6_on: extractors[5],
        extractor_7_on: extractors[6],
        extractor_8_on: extractors[7],
        cedazo_tt_last_cleaning: new Date(cleaningDate).getTime(),
      });
      docIdRef.current = doc.get('id');
      setSavedDocId(doc.get('id'));
      setCurrentStep(0);
      setShowSignature(true);
    } catch (err: any) {
      console.warn('[ExtractorScreen] Create failed:', err?.message ?? err);
    } finally {
      setSaving(false);
    }
  }, [
    selectedLine,
    selectedMachine,
    selectedShift,
    operatorId,
    extractors,
    cleaningDate,
    repository,
  ]);

  // ─── Signature handlers ─────────────────────────────────────────────────────

  const handleSign = useCallback(async () => {
    const success = await doSign();
    if (success) {
      // Auto-advance to next step or close
      if (sigStatus.nextRole === null) {
        // Chain complete
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

  const currentStepConfig = CHAIN_CONFIG;
  const isLastStep = currentStep >= currentStepConfig.roles.length - 1;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text variant="headlineSmall" style={styles.title}>
          Control de Extractores (F-PD-18)
        </Text>

        {savedDocId && (
          <Text variant="bodySmall" style={styles.statusHint}>
            Guardado — firmas pendientes
          </Text>
        )}

        {/* Extractor toggles — EF-1 */}
        <Card style={styles.card}>
          <Card.Title title="Estado de Extractores" />
          <Card.Content>
            {EXTRACTOR_LABELS.map((label, index) => (
              <View key={index} style={styles.toggleRow}>
                <Text variant="bodyMedium" style={styles.toggleLabel}>
                  {label}
                </Text>
                <Switch
                  value={extractors[index]}
                  onValueChange={() => toggleExtractor(index)}
                  disabled={!!savedDocId}
                />
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Cleaning date — EF-2 */}
        <Card style={styles.card}>
          <Card.Title title="Limpieza Cedazo TT" />
          <Card.Content>
            <TextInput
              mode="outlined"
              label="Fecha de última limpieza"
              value={cleaningDate}
              onChangeText={setCleaningDate}
              placeholder="YYYY-MM-DD"
              disabled={!!savedDocId}
              style={styles.input}
            />
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

      {/* Action button */}
      <View style={styles.footer}>
        <Button
          mode="contained"
          onPress={savedDocId ? handleSave : startSignatureChain}
          loading={saving}
          disabled={saving || !selectedShift || !operatorId}
          style={styles.saveButton}
        >
          {savedDocId ? 'Guardar Cambios' : 'Iniciar Control'}
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

      {/* Signature Prompt — EF-3 */}
      {savedDocId && (
        <SignaturePrompt
          visible={showSignature}
          signature={{
            documentType: 'extractor_check',
            documentId: savedDocId,
            requiredRoles: [currentStepConfig.roles[currentStep]],
            sequence: currentStep + 1,
            stepLabel: currentStepConfig.labels[currentStep],
          }}
          currentRole={currentRole}
          currentUserName={fullName ?? ''}
          existingSignatures={sigStatus.steps
            .filter((s) => s.status === 'signed')
            .map((s) => ({
              signer_name: s.signerName ?? '',
              signer_role: s.role,
              signed_at: s.signedAt ?? 0,
              sequence: sigStatus.steps.findIndex(
                (step) => step.role === s.role
              ) + 1,
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
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  toggleLabel: {
    flex: 1,
  },
  input: {
    backgroundColor: '#FFFFFF',
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
