/**
 * OEE screen — Main OEE capture interface.
 *
 * Tablet-optimized for industrial use:
 * - Touch targets ≥56 dp
 * - Context-aware dashboard (Operando vs Paro Activo)
 * - Two-step stop reason selection
 * - Shift end blocker when downtime is active
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Portal, Dialog, IconButton, Snackbar } from 'react-native-paper';
import type { RxDocument } from 'rxdb';

import { useOeeEventsRepository } from '../../src/repositories/useOeeEventsRepository';
import { useReportsRepository } from '../../src/repositories/useReportsRepository';
import { useOeeCalculator } from '../../src/ui/hooks/useOeeCalculator';
import { OeeDashboard } from '../../src/ui/components/OeeDashboard';
import { StopReasonModal } from '../../src/ui/components/StopReasonModal';
import { ConfirmEventModal } from '../../src/ui/components/ConfirmEventModal';
import { NumpadModal } from '../../src/ui/components/NumpadModal';
import { OEE_LIMITS } from '../../src/config/oeeLimits';
import type { IOeeEvent } from '../../src/core/types';
import type { ParoReason } from '../../src/config/catalogs';
import { PARO_BY_CODE } from '../../src/config/catalogs';
import { generateUuid } from '../../src/utils/uuid';
import { nowMs } from '../../src/utils/timestamp';
import { generateShiftReport } from '../../src/core/shiftReportGenerator';
import { useCatalogStore } from '../../src/ui/store/catalogStore';
import { OeeSelectorBar } from '../../src/ui/components/OeeSelectorBar';
import { useOeeValidation } from '../../src/hooks/useOeeValidation';

export default function OeeScreen() {
  const repository = useOeeEventsRepository();
  const reportsRepository = useReportsRepository();
  const repositoryRef = useRef(repository);
  repositoryRef.current = repository;

  // Use global state from CatalogStore instead of local UUIDs
  const { selectedLine, selectedMachine, selectedShift } = useCatalogStore();
  const getMachineById = useCatalogStore((s) => s.getMachineById);
  const getProductById = useCatalogStore((s) => s.getProductById);
  const selectedProduct = useCatalogStore((s) => s.selectedProduct);
  const setSelectedProduct = useCatalogStore((s) => s.setSelectedProduct);
  const isIotMachine = selectedMachine ? !!getMachineById(selectedMachine)?.is_iot_enabled : false;
  // Wave 8: resolve ppm from selected product; undefined triggers DEFAULT_PPM fallback
  const selectedPpm = selectedProduct ? getProductById(selectedProduct)?.theoretical_ppm : undefined;
  const { isValid } = useOeeValidation();

  // Shift state
  const [shiftStarted, setShiftStarted] = useState(false);

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
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

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
      // We explicitly pass them or let the repository pull them. Both work.
      event_type: 'shift_start',
      timestamp: nowMs(),
      planned_boxes: 480,
    });
    setShiftStarted(true);
    setSnackbarMessage('Turno iniciado');
    setSnackbarVisible(true);
  }, [repository, isValid, selectedShift]);

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

  const executeShiftEnd = useCallback(async () => {
    if (!selectedShift || !selectedLine) return;
    await repository.createEvent({
      event_type: 'shift_end',
      timestamp: nowMs(),
    });

    const shiftEvents = await repository.findByShift(selectedShift);
    const report = generateShiftReport({
      events: shiftEvents.map((e) => e.toJSON() as IOeeEvent),
      shiftId: selectedShift,
      lineId: selectedLine,
      ppm: selectedPpm, // Wave 8: inject real product PPM into the report
    });
    await reportsRepository.createReport(report.data, report.template_id);

    setSelectedProduct(null); // Wave 8: clear product selection on shift end
    setShiftStarted(false);
    setShowConfirmModal(false);
    setPendingEvent(null);
    setSnackbarMessage('Turno cerrado y reporte generado');
    setSnackbarVisible(true);
  }, [selectedShift, selectedLine, selectedPpm, repository, reportsRepository, setSelectedProduct]);

  // ─── Downtime Start ────────────────────────────────────────────────────────
  const handleStartDowntime = useCallback(() => {
    setShowStopModal(true);
  }, []);

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
    if (!pendingEvent || !selectedShift) return;
    await repository.createEvent({
      event_type: 'downtime_start',
      timestamp: nowMs(),
      reason_code: pendingEvent.reason_code,
    });
    setShowConfirmModal(false);
    setPendingEvent(null);
    setSnackbarMessage('Paro registrado');
    setSnackbarVisible(true);
  }, [pendingEvent, selectedShift, repository]);

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
    setSnackbarMessage('Paro cerrado');
    setSnackbarVisible(true);
  }, [pendingEvent, selectedShift, repository]);

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
    setSnackbarMessage(`Producción registrada: ${value} cajas`);
    setSnackbarVisible(true);
  }, [selectedShift, repository]);

  // ─── Generic Confirm ───────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    const type = pendingEvent?.event_type;
    if (type === 'shift_end') {
      executeShiftEnd();
    } else if (type === 'downtime_start') {
      executeDowntimeStart();
    } else if (type === 'downtime_end') {
      executeDowntimeEnd();
    } else if (type === 'box_count' && pendingAnomalousProduction !== null) {
      executeProduction(pendingAnomalousProduction);
      setShowConfirmModal(false);
      setPendingEvent(null);
    }
  }, [pendingEvent, executeShiftEnd, executeDowntimeStart, executeDowntimeEnd, executeProduction, pendingAnomalousProduction]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <OeeSelectorBar />
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
