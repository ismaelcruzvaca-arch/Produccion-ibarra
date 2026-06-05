/**
 * OeeScreen organism — Main OEE capture interface, extracted from app/(tabs)/oee.tsx.
 *
 * This organism is the full OEE screen component, moved to the organisms layer
 * so it can be rendered from both the legacy oee.tsx route and the new forms.tsx
 * FormRouter entry screen.
 *
 * Tablet-optimized for industrial use:
 * - Touch targets ≥56 dp
 * - Context-aware dashboard (Operando vs Paro Activo)
 * - Two-step stop reason selection
 * - Shift end blocker when downtime is active
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Portal, Dialog, Divider, ActivityIndicator, Chip } from 'react-native-paper';
import type { RxDocument } from 'rxdb';

import { useOeeEventsRepository } from '../../../repositories/useOeeEventsRepository';
import { useReportsRepository } from '../../../repositories/useReportsRepository';
import { useOeeCalculator } from '../../hooks/useOeeCalculator';
import { OeeDashboard } from '../OeeDashboard';
import { StopReasonModal } from '../StopReasonModal';
import { ConfirmEventModal } from '../ConfirmEventModal';
import { NumpadModal } from '../NumpadModal';
import { OEE_LIMITS } from '../../../config/oeeLimits';
import type { IOeeEvent } from '../../../core/types';
import { PARO_BY_CODE } from '../../../config/catalogs';
import { nowMs } from '../../../utils/timestamp';
import { generateShiftReport } from '../../../core/shiftReportGenerator';
import { useCatalogStore } from '../../store/catalogStore';
import { useAuthStore } from '../../../auth/useAuthStore';
import { useSignatures, DEFAULT_CHAINS } from '../../../hooks/useSignatures';
import { SignaturePrompt } from '../molecules/SignaturePrompt';
import { OeeSelectorBar } from '../OeeSelectorBar';
import { useOeeValidation } from '../../hooks/useOeeValidation';
import { useAlertSnackbar } from '../molecules/AlertSnackbar';
import { useUIStore } from '../../store/useUIStore';

export default function OeeScreen() {
  const repository = useOeeEventsRepository();
  const reportsRepository = useReportsRepository();
  const repositoryRef = useRef(repository);
  repositoryRef.current = repository;

  const { selectedLine, selectedMachine, selectedShift } = useCatalogStore();
  const getMachineById = useCatalogStore((s) => s.getMachineById);
  const getProductById = useCatalogStore((s) => s.getProductById);
  const selectedProduct = useCatalogStore((s) => s.selectedProduct);
  const setSelectedProduct = useCatalogStore((s) => s.setSelectedProduct);
  const isIotMachine = selectedMachine ? !!getMachineById(selectedMachine)?.is_iot_enabled : false;
  const selectedPpm = selectedProduct ? getProductById(selectedProduct)?.theoretical_ppm : undefined;
  const { isValid } = useOeeValidation();

  // Pending sync count (updated by PendingCountService)
  const pendingCount = useUIStore((s) => s.pendingCount);

  const { operatorId, fullName, role: currentRole } = useAuthStore();

  // Shift state
  const [shiftStarted, setShiftStarted] = useState(false);

  // Signature state (Phase 9)
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [currentSigStep, setCurrentSigStep] = useState(0);

  // Signature chain (Phase 9.2)
  const OEE_CHAIN_CONFIG = DEFAULT_CHAINS.oee_report;
  const {
    status: sigStatus,
    isLoading: sigLoading,
    error: sigError,
    sign: doSign,
    refresh: refreshSigs,
  } = useSignatures({
    documentType: 'oee_report',
    documentId: savedDocId ?? '',
    chainConfig: OEE_CHAIN_CONFIG,
  });

  // Events
  const [events, setEvents] = useState<IOeeEvent[]>([]);
  const [activeDowntime, setActiveDowntime] = useState<RxDocument<IOeeEvent> | null>(null);

  // Modal states
  const [showStopModal, setShowStopModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmLabel, setConfirmLabel] = useState('Confirmar');
  const [pendingEvent, setPendingEvent] = useState<Partial<IOeeEvent> | null>(null);
  const [showShiftBlocker, setShowShiftBlocker] = useState(false);

  // Production counter modal
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [pendingAnomalousProduction, setPendingAnomalousProduction] = useState<number | null>(null);

  // Snackbar
  const { showAlert } = useAlertSnackbar();

  // Subscribe to events
  const { docs$: oeeDocs$ } = repository;

  useEffect(() => {
    const subscription = oeeDocs$.subscribe((docs) => {
      setEvents(docs.map((doc) => doc.toJSON() as IOeeEvent));
    });
    return () => subscription.unsubscribe();
  }, [oeeDocs$]);

  // Poll active downtime
  useEffect(() => {
    if (!shiftStarted || !selectedMachine) {
      setActiveDowntime(null);
      return;
    }
    let isMounted = true;
    const check = async () => {
      const dt = await repositoryRef.current.findActiveDowntime(selectedMachine);
      if (isMounted) setActiveDowntime(dt);
    };
    check();
    const interval = setInterval(check, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [shiftStarted, selectedMachine]);

  const { metrics } = useOeeCalculator(events, selectedPpm);

  // ─── Shift Start ───────────────────────────────────────────────────────────
  const handleStartShift = useCallback(async () => {
    if (!isValid || !selectedShift) return;
    
    await repository.createEvent({
      event_type: 'shift_start',
      timestamp: nowMs(),
      planned_boxes: 480,
    });
    setShiftStarted(true);
    showAlert({ message: 'Turno iniciado', type: 'success' });
  }, [repository, isValid, selectedShift, showAlert]);

  // ─── Shift End ─────────────────────────────────────────────────────────────
  const handleEndShift = useCallback(async () => {
    if (!selectedMachine) return;
    const dt = await repository.findActiveDowntime(selectedMachine);
    if (dt) {
      setShowShiftBlocker(true);
      return;
    }
    setConfirmTitle('Cerrar Turno');
    setConfirmMessage('¿Está seguro de que desea cerrar el turno actual?');
    setConfirmLabel('Cerrar Turno');
    setPendingEvent({ event_type: 'shift_end' });
    setShowConfirmModal(true);
  }, [repository, selectedMachine]);

  // ─── Phase A: Save Shift-End Event (9.1) ─────────────────────────────────────
  const executeShiftEndPhaseA = useCallback(async () => {
    if (!selectedShift || !selectedLine) return;

    const doc = await repository.createEvent({
      event_type: 'shift_end',
      timestamp: nowMs(),
    });
    const docId = doc.get('id');
    setSavedDocId(docId);
    setCurrentSigStep(0);

    // Show signature prompt after event saved
    setShowConfirmModal(false);
    setPendingEvent(null);
    setShowSignature(true);
  }, [selectedShift, selectedLine, repository]);

  // ─── Phase C: Generate Report After All Signatures (9.1) ────────────────────
  const executeShiftEndPhaseC = useCallback(async () => {
    if (!selectedShift || !selectedLine) return;

    const shiftEvents = await repository.findByShift(selectedShift);
    const report = generateShiftReport({
      events: shiftEvents.map((e) => e.toJSON() as IOeeEvent),
      shiftId: selectedShift,
      lineId: selectedLine,
      ppm: selectedPpm,
    });
    await reportsRepository.createReport(report.data, report.template_id);

    setSelectedProduct(null);
    setShiftStarted(false);
    setSavedDocId(null);
    setShowSignature(false);
    showAlert({ message: 'Turno cerrado y reporte generado', type: 'success' });
  }, [selectedShift, selectedLine, selectedPpm, repository, reportsRepository, setSelectedProduct, showAlert]);

  // ─── Signature Handlers (9.2) ───────────────────────────────────────────────
  const handleSigSign = useCallback(async () => {
    const success = await doSign();
    if (success) {
      // Chain complete → generate report
      if (sigStatus.nextRole === null) {
        setShowSignature(false);
        setCurrentSigStep(0);
        await executeShiftEndPhaseC();
      } else {
        setCurrentSigStep((prev) => prev + 1);
      }
    }
  }, [doSign, sigStatus.nextRole, executeShiftEndPhaseC]);

  const handleSigSkip = useCallback(() => {
    setShowSignature(false);
  }, []);

  // ─── Downtime Start ────────────────────────────────────────────────────────
  const handleStartDowntime = useCallback(() => {
    setShowStopModal(true);
  }, []);

  const handleSelectStopReason = useCallback((reasonCode: string) => {
    const reason = PARO_BY_CODE[reasonCode] ?? { code: reasonCode, label: reasonCode, macro: 'OTROS' as const, stops_line: true, sort_order: 0 };
    setShowStopModal(false);
    setConfirmTitle('Confirmar Paro');
    setConfirmMessage(`¿Registrar paro por: ${reason.label} (${reason.code})?`);
    setConfirmLabel('Iniciar Paro');
    setPendingEvent({
      event_type: 'downtime_start',
      reason_code: reason.code,
    });
    setShowConfirmModal(true);
  }, []);

  const executeDowntimeStart = useCallback(async () => {
    if (!pendingEvent || !selectedShift) return;
    await repository.createEvent({
      event_type: 'downtime_start',
      timestamp: nowMs(),
      reason_code: pendingEvent.reason_code,
    });
    setShowConfirmModal(false);
    setPendingEvent(null);
    showAlert({ message: 'Paro registrado', type: 'success' });
  }, [pendingEvent, selectedShift, repository, showAlert]);

  // ─── Downtime End ──────────────────────────────────────────────────────────
  const handleEndDowntime = useCallback(() => {
    if (!activeDowntime) return;
    const reasonCode = activeDowntime.get('reason_code') as string | undefined;
    const reasonLabel = reasonCode ? PARO_BY_CODE[reasonCode]?.label : 'Desconocido';
    const durationHours = (nowMs() - (activeDowntime.get('timestamp') as number)) / 3600000;
    const isAtypical = durationHours > OEE_LIMITS.MAX_DOWNTIME_HOURS;

    setConfirmTitle(isAtypical ? '⚠️ Paro Atípico' : 'Fin de Paro');
    setConfirmMessage(
      isAtypical
        ? `Este paro duró más de ${OEE_LIMITS.MAX_DOWNTIME_HOURS}h. ¿Cerrar paro: ${reasonLabel}?`
        : `¿Cerrar paro activo: ${reasonLabel}?`
    );
    setConfirmLabel('Cerrar Paro');
    setPendingEvent({
      event_type: 'downtime_end',
      related_event_id: activeDowntime.get('id'),
    });
    setShowConfirmModal(true);
  }, [activeDowntime]);

  const executeDowntimeEnd = useCallback(async () => {
    if (!pendingEvent || !selectedShift) return;
    await repository.createEvent({
      event_type: 'downtime_end',
      timestamp: nowMs(),
      related_event_id: pendingEvent.related_event_id,
    });
    setShowConfirmModal(false);
    setPendingEvent(null);
    showAlert({ message: 'Paro cerrado', type: 'success' });
  }, [pendingEvent, selectedShift, repository, showAlert]);

  // ─── Production ────────────────────────────────────────────────────────────
  const handleRegisterProduction = useCallback(() => {
    setShowProductionModal(true);
  }, []);

  const handleNumpadSubmit = useCallback((value: number) => {
    setShowProductionModal(false);
    if (value > OEE_LIMITS.DEFAULT_SOFT_LIMIT) {
      setConfirmTitle('⚠️ Producción Anómala');
      setConfirmMessage(
        `¿Confirma registrar ${value.toLocaleString('es-MX')} cajas?\nEsta cantidad supera el límite de precaución de ${OEE_LIMITS.DEFAULT_SOFT_LIMIT.toLocaleString('es-MX')}.`
      );
      setConfirmLabel('Confirmar');
      setPendingEvent({ event_type: 'box_count' });
      setPendingAnomalousProduction(value);
      setShowConfirmModal(true);
    } else {
      executeProduction(value);
    }
  }, []);

  const executeProduction = useCallback(async (value: number) => {
    if (!selectedShift || value <= 0) return;
    await repository.createEvent({
      event_type: 'box_count',
      timestamp: nowMs(),
      quantity: value,
    });
    setPendingAnomalousProduction(null);
    showAlert({ message: `Producción registrada: ${value} cajas`, type: 'success' });
  }, [selectedShift, repository, showAlert]);

  // ─── Generic Confirm ───────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    const type = pendingEvent?.event_type;
    if (type === 'shift_end') {
      executeShiftEndPhaseA();
    } else if (type === 'downtime_start') {
      executeDowntimeStart();
    } else if (type === 'downtime_end') {
      executeDowntimeEnd();
    } else if (type === 'box_count' && pendingAnomalousProduction !== null) {
      executeProduction(pendingAnomalousProduction);
      setShowConfirmModal(false);
      setPendingEvent(null);
    }
  }, [pendingEvent, executeShiftEndPhaseA, executeDowntimeStart, executeDowntimeEnd, executeProduction, pendingAnomalousProduction]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <OeeSelectorBar />
        {pendingCount > 0 && (
          <View style={styles.pendingSyncRow}>
            <Chip compact style={styles.pendingSyncChip} textStyle={styles.pendingSyncChipText}>
              {`${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''} por sincronizar`}
            </Chip>
          </View>
        )}
        {pendingCount === 0 && (
          <View style={styles.pendingSyncRow}>
            <Chip compact style={styles.syncedChip} textStyle={styles.syncedChipText}>
              {'\u2705'} Sincronizado
            </Chip>
          </View>
        )}
        <View pointerEvents={isValid ? 'auto' : 'none'} style={{ opacity: isValid ? 1 : 0.5, flex: 1 }}>
          <OeeDashboard
            isActiveDowntime={!!activeDowntime}
            activeDowntimeEvent={activeDowntime}
            metrics={metrics}
            onRegisterProduction={handleRegisterProduction}
            onStartDowntime={handleStartDowntime}
            onEndDowntime={handleEndDowntime}
            onStartShift={handleStartShift}
            onEndShift={handleEndShift}
            shiftStarted={shiftStarted}
            isIotMachine={isIotMachine}
          />
        </View>
      </ScrollView>

      <StopReasonModal
        visible={showStopModal}
        onDismiss={() => setShowStopModal(false)}
        onSelectReason={handleSelectStopReason}
      />

      <ConfirmEventModal
        visible={showConfirmModal}
        onDismiss={() => {
          setShowConfirmModal(false);
          setPendingEvent(null);
        }}
        onConfirm={handleConfirm}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmLabel}
      />

      <NumpadModal
        visible={showProductionModal}
        title="Registrar Producción"
        onDismiss={() => setShowProductionModal(false)}
        onSubmit={handleNumpadSubmit}
      />

      <Portal>
        <Dialog visible={showShiftBlocker} onDismiss={() => setShowShiftBlocker(false)}>
          <Dialog.Icon icon="alert" />
          <Dialog.Title>Paro Activo</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              No puede cerrar turno con un paro activo. Cierre el paro primero.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowShiftBlocker(false)}>Entendido</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Signature status card — Phase 9.3 */}
      {savedDocId && (
        <View style={styles.sigStatusContainer}>
          <View style={styles.sigStatusCard}>
            <Text variant="titleSmall" style={styles.sigStatusTitle}>
              Firmas del Turno
            </Text>
            <Divider style={styles.sigDivider} />
            {sigLoading ? (
              <ActivityIndicator />
            ) : (
              OEE_CHAIN_CONFIG.roles.map((role, index) => {
                const step = sigStatus.steps[index];
                const isSigned = step?.status === 'signed';
                return (
                  <View key={role} style={styles.sigRow}>
                    <Text
                      variant="bodyMedium"
                      style={[styles.sigLabel, isSigned && styles.sigLabelSigned]}
                    >
                      {OEE_CHAIN_CONFIG.labels[index]}
                    </Text>
                    {isSigned ? (
                      <Chip compact style={styles.sigSignedChip} textStyle={styles.sigSignedChipText}>
                        {'\u2705'} Firmado
                      </Chip>
                    ) : (
                      <Chip compact style={styles.sigPendingChip} textStyle={styles.sigPendingChipText}>
                        {'\u25CB'} Pendiente
                      </Chip>
                    )}
                  </View>
                );
              })
            )}
            {sigError && (
              <Text variant="bodySmall" style={styles.sigError}>
                {sigError}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Signature Prompt dialog — Phase 9.2 */}
      {savedDocId && (
        <SignaturePrompt
          visible={showSignature}
          signature={{
            documentType: 'oee_report',
            documentId: savedDocId,
            requiredRoles: [OEE_CHAIN_CONFIG.roles[currentSigStep]],
            sequence: currentSigStep + 1,
            stepLabel: OEE_CHAIN_CONFIG.labels[currentSigStep],
          }}
          currentRole={currentRole}
          currentUserName={fullName ?? ''}
          existingSignatures={sigStatus.steps
            .filter((s) => s.status === 'signed')
            .map((s) => ({
              signer_name: s.signerName ?? '',
              signer_role: s.role,
              signed_at: s.signedAt ?? 0,
              sequence: OEE_CHAIN_CONFIG.roles.findIndex((r) => r === s.role) + 1,
            }))}
          onSign={handleSigSign}
          onSkip={handleSigSkip}
          onDismiss={handleSigSkip}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    padding: 16,
    flexGrow: 1,
  },

  // Signature status (Phase 9.3)
  sigStatusContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  sigStatusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    minWidth: 180,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  sigStatusTitle: {
    fontWeight: '700',
    color: '#5D4037',
    marginBottom: 4,
  },
  sigDivider: {
    marginVertical: 8,
  },
  sigRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  sigLabel: {
    flex: 1,
    fontSize: 13,
  },
  sigLabelSigned: {
    fontWeight: '600',
  },
  sigSignedChip: {
    backgroundColor: '#E8F5E9',
    height: 24,
  },
  sigSignedChipText: {
    fontSize: 11,
    color: '#2E7D32',
  },
  sigPendingChip: {
    backgroundColor: '#FFF3E0',
    height: 24,
  },
  sigPendingChipText: {
    fontSize: 11,
    color: '#E65100',
  },
  sigError: {
    color: '#C62828',
    marginTop: 8,
    fontSize: 12,
  },

  // Pending sync badge (Phase 4)
  pendingSyncRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  pendingSyncChip: {
    backgroundColor: '#FFF3E0',
    height: 28,
  },
  pendingSyncChipText: {
    fontSize: 12,
    color: '#E65100',
  },
  syncedChip: {
    backgroundColor: '#E8F5E9',
    height: 28,
  },
  syncedChipText: {
    fontSize: 12,
    color: '#2E7D32',
  },
});
