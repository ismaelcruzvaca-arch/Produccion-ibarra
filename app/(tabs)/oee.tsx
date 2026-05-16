/**
 * OEE screen — Main OEE capture interface.
 *
 * Tablet-optimized for industrial use:
 * - Touch targets ≥56 dp
 * - Context-aware dashboard (Operando vs Paro Activo)
 * - Two-step stop reason selection
 * - Shift end blocker when downtime is active
 *
 * Wave 5: Replaced hardcoded line/machine/shift IDs with store-driven selectors.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Portal, Dialog, IconButton, Snackbar, Badge } from 'react-native-paper';
import type { RxDocument } from 'rxdb';

import { useOeeEventsRepository } from '../../src/repositories/useOeeEventsRepository';
import { useReportsRepository } from '../../src/repositories/useReportsRepository';
import { useOeeCalculator } from '../../src/ui/hooks/useOeeCalculator';
import { useOeeValidation } from '../../src/ui/hooks/useOeeValidation';
import { OeeDashboard } from '../../src/ui/components/OeeDashboard';
import { OeeSelectorBar } from '../../src/ui/components/OeeSelectorBar';
import { StopReasonModal } from '../../src/ui/components/StopReasonModal';
import { ConfirmEventModal } from '../../src/ui/components/ConfirmEventModal';
import { useCatalogStore } from '../../src/ui/store/catalogStore';
import { useUIStore } from '../../src/ui/store/useUIStore';
import type { IOeeEvent } from '../../src/core/types';
import type { ParoReason } from '../../src/config/catalogs';
import { getCurrentTurno, PARO_BY_CODE } from '../../src/config/catalogs';
import { nowMs } from '../../src/utils/timestamp';
import { generateShiftReport } from '../../src/core/shiftReportGenerator';

export default function OeeScreen() {
  const repository = useOeeEventsRepository();
  const reportsRepository = useReportsRepository();
  const repositoryRef = useRef(repository);
  repositoryRef.current = repository;

  // Pending sync count from Zustand (Wave 4)
  const pendingOeeCount = useUIStore((s) => s.pendingOeeCount);

  // ── Store-driven context (Wave 5) ───────────────────────────────────────
  const lineId = useCatalogStore((s) => s.selectedLine);
  const machineId = useCatalogStore((s) => s.selectedMachine);
  const selectedShiftId = useCatalogStore((s) => s.selectedShift);
  const effectiveShiftId = selectedShiftId ?? getCurrentTurno().id;

  // Shift runtime state
  const [shiftId, setShiftId] = useState<string>('');
  const [shiftStarted, setShiftStarted] = useState(false);

  // Events
  const [events, setEvents] = useState<IOeeEvent[]>([]);
  const [activeDowntime, setActiveDowntime] = useState<RxDocument<IOeeEvent> | null>(null);

  // Validation (Wave 5)
  const validation = useOeeValidation({
    lineId,
    machineId,
    shiftId: effectiveShiftId,
    shiftStarted,
    activeDowntime: !!activeDowntime,
  });

  // Modal states
  const [showStopModal, setShowStopModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmLabel, setConfirmLabel] = useState('Confirmar');
  const [pendingEvent, setPendingEvent] = useState<Partial<IOeeEvent> | null>(null);
  const [showShiftBlocker, setShowShiftBlocker] = useState(false);
  const [showLineChangeBlocker, setShowLineChangeBlocker] = useState(false);

  // Production counter modal
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [boxCount, setBoxCount] = useState(0);

  // Snackbar
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Subscribe to events
  useEffect(() => {
    const subscription = repository.docs$.subscribe((docs) => {
      setEvents(docs.map((doc) => doc.toJSON() as IOeeEvent));
    });
    return () => subscription.unsubscribe();
  }, [repository]);

  // Poll active downtime
  useEffect(() => {
    if (!shiftStarted || !machineId) {
      setActiveDowntime(null);
      return;
    }
    let isMounted = true;
    const check = async () => {
      const dt = await repositoryRef.current.findActiveDowntime(machineId);
      if (isMounted) setActiveDowntime(dt);
    };
    check();
    const interval = setInterval(check, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [shiftStarted, machineId]);

  const { metrics, isUsingFallbackPpm } = useOeeCalculator(events, undefined);

  // ─── Shift Start ───────────────────────────────────────────────────────────
  const handleStartShift = useCallback(async () => {
    if (!validation.canStartShift) {
      setSnackbarMessage(validation.validationMessage ?? 'Seleccione línea, máquina y turno');
      setSnackbarVisible(true);
      return;
    }
    if (!lineId || !machineId || !effectiveShiftId) return;

    await repository.createEvent({
      line_id: lineId,
      machine_id: machineId,
      shift_id: effectiveShiftId,
      event_type: 'shift_start',
      timestamp: nowMs(),
      planned_boxes: 480,
    });
    setShiftId(effectiveShiftId);
    setShiftStarted(true);
    const shiftLabel = useCatalogStore.getState().shifts.find((s) => s.id === effectiveShiftId)?.label ?? getCurrentTurno().label;
    setSnackbarMessage(`Turno iniciado: ${shiftLabel}`);
    setSnackbarVisible(true);
  }, [repository, lineId, machineId, effectiveShiftId, validation]);

  // ─── Shift End ─────────────────────────────────────────────────────────────
  const handleEndShift = useCallback(async () => {
    if (!validation.canEndShift) {
      setSnackbarMessage(validation.validationMessage ?? 'No puede cerrar turno en este momento');
      setSnackbarVisible(true);
      return;
    }
    if (!machineId) return;
    const dt = await repository.findActiveDowntime(machineId);
    if (dt) {
      setShowShiftBlocker(true);
      return;
    }
    setConfirmTitle('Cerrar Turno');
    setConfirmMessage('¿Está seguro de que desea cerrar el turno actual?');
    setConfirmLabel('Cerrar Turno');
    setPendingEvent({ event_type: 'shift_end' });
    setShowConfirmModal(true);
  }, [repository, machineId, validation]);

  const executeShiftEnd = useCallback(async () => {
    if (!shiftId || !lineId || !machineId) return;
    await repository.createEvent({
      line_id: lineId,
      machine_id: machineId,
      shift_id: shiftId,
      event_type: 'shift_end',
      timestamp: nowMs(),
    });

    const shiftEvents = await repository.findByShift(shiftId);
    const report = generateShiftReport({
      events: shiftEvents.map((e) => e.toJSON() as IOeeEvent),
      shiftId,
      lineId,
    });
    await reportsRepository.createReport(report.data, report.template_id);

    setShiftStarted(false);
    setShiftId('');
    setShowConfirmModal(false);
    setPendingEvent(null);
    setSnackbarMessage('Turno cerrado y reporte generado');
    setSnackbarVisible(true);
  }, [shiftId, repository, lineId, machineId, reportsRepository]);

  // ─── Downtime Start ────────────────────────────────────────────────────────
  const handleStartDowntime = useCallback(() => {
    if (!validation.canStartDowntime) {
      setSnackbarMessage(validation.validationMessage ?? 'No puede iniciar paro en este momento');
      setSnackbarVisible(true);
      return;
    }
    setShowStopModal(true);
  }, [validation]);

  const handleSelectStopReason = useCallback((reason: ParoReason) => {
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
    if (!pendingEvent || !shiftId || !lineId || !machineId) return;
    await repository.createEvent({
      line_id: lineId,
      machine_id: machineId,
      shift_id: shiftId,
      event_type: 'downtime_start',
      timestamp: nowMs(),
      reason_code: pendingEvent.reason_code,
    });
    setShowConfirmModal(false);
    setPendingEvent(null);
    setSnackbarMessage('Paro registrado');
    setSnackbarVisible(true);
  }, [pendingEvent, shiftId, repository, lineId, machineId]);

  // ─── Downtime End ──────────────────────────────────────────────────────────
  const handleEndDowntime = useCallback(() => {
    if (!activeDowntime) return;
    const reasonCode = activeDowntime.get('reason_code') as string | undefined;
    const reasonLabel = reasonCode ? PARO_BY_CODE[reasonCode]?.label : 'Desconocido';
    setConfirmTitle('Fin de Paro');
    setConfirmMessage(`¿Cerrar paro activo: ${reasonLabel}?`);
    setConfirmLabel('Cerrar Paro');
    setPendingEvent({
      event_type: 'downtime_end',
      related_event_id: activeDowntime.get('id'),
    });
    setShowConfirmModal(true);
  }, [activeDowntime]);

  const executeDowntimeEnd = useCallback(async () => {
    if (!pendingEvent || !shiftId || !lineId || !machineId) return;
    await repository.createEvent({
      line_id: lineId,
      machine_id: machineId,
      shift_id: shiftId,
      event_type: 'downtime_end',
      timestamp: nowMs(),
      related_event_id: pendingEvent.related_event_id,
    });
    setShowConfirmModal(false);
    setPendingEvent(null);
    setSnackbarMessage('Paro cerrado');
    setSnackbarVisible(true);
  }, [pendingEvent, shiftId, repository, lineId, machineId]);

  // ─── Production ────────────────────────────────────────────────────────────
  const handleRegisterProduction = useCallback(() => {
    if (!validation.canRegisterProduction) {
      setSnackbarMessage(validation.validationMessage ?? 'No puede registrar producción en este momento');
      setSnackbarVisible(true);
      return;
    }
    setBoxCount(0);
    setShowProductionModal(true);
  }, [validation]);

  const executeProduction = useCallback(async () => {
    if (!shiftId || !lineId || !machineId || boxCount <= 0) return;
    await repository.createEvent({
      line_id: lineId,
      machine_id: machineId,
      shift_id: shiftId,
      event_type: 'box_count',
      timestamp: nowMs(),
      quantity: boxCount,
    });
    setShowProductionModal(false);
    setBoxCount(0);
    setSnackbarMessage(`Producción registrada: ${boxCount} cajas`);
    setSnackbarVisible(true);
  }, [shiftId, boxCount, repository, lineId, machineId]);

  // ─── Generic Confirm ───────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    const type = pendingEvent?.event_type;
    if (type === 'shift_end') {
      executeShiftEnd();
    } else if (type === 'downtime_start') {
      executeDowntimeStart();
    } else if (type === 'downtime_end') {
      executeDowntimeEnd();
    }
  }, [pendingEvent, executeShiftEnd, executeDowntimeStart, executeDowntimeEnd]);

  return (
    <View style={styles.container}>
      {/* Sync badge header (Wave 4) — shows pending OEE events count or synced status */}
      <View style={pendingOeeCount > 0 ? styles.syncBadgeHeader : styles.syncBadgeHeaderSynced}>
        <IconButton
          icon={pendingOeeCount > 0 ? 'cloud-upload-outline' : 'check-circle'}
          size={20}
          iconColor={pendingOeeCount > 0 ? '#FF9800' : '#4CAF50'}
        />
        <Text
          variant="bodyMedium"
          style={pendingOeeCount > 0 ? styles.syncBadgeText : styles.syncBadgeTextSynced}
        >
          {pendingOeeCount > 0
            ? `${pendingOeeCount} evento${pendingOeeCount !== 1 ? 's' : ''} pendiente${pendingOeeCount !== 1 ? 's' : ''} de sincronización`
            : 'Sincronizado'}
        </Text>
        {pendingOeeCount > 0 && (
          <Badge size={22} style={styles.syncBadgeCount}>
            {pendingOeeCount}
          </Badge>
        )}
      </View>

      {/* Wave 5: Store-driven selectors */}
      <OeeSelectorBar
        onLineChangeAttempt={() => {
          if (shiftStarted) {
            setShowLineChangeBlocker(true);
            return false;
          }
          return true;
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <OeeDashboard
          isActiveDowntime={!!activeDowntime}
          activeDowntimeEvent={activeDowntime}
          metrics={metrics}
          isUsingFallbackPpm={isUsingFallbackPpm}
          onRegisterProduction={handleRegisterProduction}
          onStartDowntime={handleStartDowntime}
          onEndDowntime={handleEndDowntime}
          onStartShift={handleStartShift}
          onEndShift={handleEndShift}
          shiftStarted={shiftStarted}
        />
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

      <Portal>
        <Dialog visible={showProductionModal} onDismiss={() => setShowProductionModal(false)}>
          <Dialog.Title>Registrar Producción</Dialog.Title>
          <Dialog.Content>
            <View style={styles.counterContainer}>
              <IconButton
                icon="minus-circle"
                size={48}
                onPress={() => setBoxCount((c) => Math.max(0, c - 1))}
                style={styles.counterButton}
                iconColor="#5D4037"
              />
              <Text variant="headlineLarge" style={styles.counterText}>
                {boxCount}
              </Text>
              <IconButton
                icon="plus-circle"
                size={48}
                onPress={() => setBoxCount((c) => c + 1)}
                style={styles.counterButton}
                iconColor="#5D4037"
              />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowProductionModal(false)}>Cancelar</Button>
            <Button onPress={executeProduction} disabled={boxCount <= 0} mode="contained">
              Registrar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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

      <Portal>
        <Dialog visible={showLineChangeBlocker} onDismiss={() => setShowLineChangeBlocker(false)}>
          <Dialog.Icon icon="alert" />
          <Dialog.Title>Cambio de Línea Bloqueado</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Cierre el turno antes de cambiar de línea.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowLineChangeBlocker(false)}>Entendido</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  syncBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  syncBadgeHeaderSynced: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#C8E6C9',
  },
  syncBadgeText: {
    color: '#E65100',
    fontWeight: '600',
    marginHorizontal: 4,
  },
  syncBadgeTextSynced: {
    color: '#2E7D32',
    fontWeight: '600',
    marginHorizontal: 4,
  },
  syncBadgeCount: {
    backgroundColor: '#FF9800',
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    flexGrow: 1,
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  counterButton: {
    marginHorizontal: 16,
  },
  counterText: {
    minWidth: 100,
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#5D4037',
  },
  snackbar: {
    marginBottom: 16,
    marginHorizontal: 16,
  },
});
