/**
 * useOeeScreenOrchestration — Orchestrates ALL state, effects, and callbacks for the OEE screen.
 *
 * Pattern: Hook Extraction (Container/Presentational)
 * Why:
 * - Applies AD-6: extracts 12+ useState + effects + callbacks from oee.tsx
 *   into a single orchestrator hook.
 * - oee.tsx becomes a thin component that calls the hook and passes
 *   everything to child components.
 * - No render logic here — pure state orchestration.
 *
 * Returns:
 * - shiftStarted, events, activeDowntime, metrics
 * - All modal states (showStopModal, showConfirmModal, etc.)
 * - All handlers (handleStartShift, handleEndShift, etc.)
 * - Snackbar state
 * - Setter functions for modal dismiss
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RxDocument } from 'rxdb';

import { useOeeEventsRepository } from '../../repositories/useOeeEventsRepository';
import { useReportsRepository } from '../../repositories/useReportsRepository';
import { useShiftSessionsRepository } from '../../repositories/useShiftSessionsRepository';
import { useOeeCalculator } from './useOeeCalculator';
import { OEE_LIMITS } from '../../config/oeeLimits';
import type { IOeeEvent, IShiftSession } from '../../core/types';
import type { ParoReason } from '../../config/catalogs';
import { PARO_BY_CODE } from '../../config/catalogs';
import { nowMs } from '../../utils/timestamp';
import { generateShiftReport } from '../../core/shiftReportGenerator';
import { useCatalogStore } from '../store/catalogStore';
import { useAuthStore } from '../../auth/useAuthStore';
import { useOeeValidation } from './useOeeValidation';

export function useOeeScreenOrchestration() {
  const repository = useOeeEventsRepository();
  const reportsRepository = useReportsRepository();
  const shiftSessionsRepo = useShiftSessionsRepository();
  const user = useAuthStore((s) => s.user) as { id?: string } | null;
  const repositoryRef = useRef(repository);
  repositoryRef.current = repository;

  // ─── Global state from CatalogStore ──────────────────────────────────────────
  const { selectedLine, selectedMachine, selectedShift } = useCatalogStore();
  const getMachineById = useCatalogStore((s) => s.getMachineById);
  const getProductById = useCatalogStore((s) => s.getProductById);
  const getShiftById = useCatalogStore((s) => s.getShiftById);
  const selectedProduct = useCatalogStore((s) => s.selectedProduct);
  const setSelectedProduct = useCatalogStore((s) => s.setSelectedProduct);
  const isIotMachine = selectedMachine
    ? !!getMachineById(selectedMachine)?.is_iot_enabled
    : false;
  const selectedPpm = selectedProduct
    ? getProductById(selectedProduct)?.theoretical_ppm
    : undefined;
  const { isValid } = useOeeValidation();

  // ─── Shift state ────────────────────────────────────────────────────────────
  const [shiftStarted, setShiftStarted] = useState(false);

  // ─── Events ─────────────────────────────────────────────────────────────────
  const [events, setEvents] = useState<IOeeEvent[]>([]);
  const [activeDowntime, setActiveDowntime] = useState<RxDocument<IOeeEvent> | null>(null);

  // ─── Modal states ───────────────────────────────────────────────────────────
  const [showStopModal, setShowStopModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmLabel, setConfirmLabel] = useState('Confirmar');
  const [pendingEvent, setPendingEvent] = useState<Partial<IOeeEvent> | null>(null);
  const [showShiftBlocker, setShowShiftBlocker] = useState(false);

  // ─── Production counter modal ───────────────────────────────────────────────
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [pendingAnomalousProduction, setPendingAnomalousProduction] = useState<number | null>(null);

  // ─── Snackbar ───────────────────────────────────────────────────────────────
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // ─── Subscribe to events ────────────────────────────────────────────────────
  const { docs$: oeeDocs$ } = repository;

  useEffect(() => {
    const subscription = oeeDocs$.subscribe((docs) => {
      setEvents(docs.map((doc) => doc.toJSON() as IOeeEvent));
    });
    return () => subscription.unsubscribe();
  }, [oeeDocs$]);

  // ─── Poll active downtime ──────────────────────────────────────────────────
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

  // ─── OEE Calculator ────────────────────────────────────────────────────────
  const { metrics } = useOeeCalculator(events, selectedPpm);

  // ─── Shift Start ───────────────────────────────────────────────────────────
  const handleStartShift = useCallback(async () => {
    if (!isValid || !selectedShift || !selectedMachine) return;

    // SM-3: Guard against already active session for this machine
    const activeSession = await shiftSessionsRepo.findActiveByMachine(selectedMachine);
    if (activeSession) {
      setShowShiftBlocker(true);
      return;
    }

    // Resolve shift_type from selected shift catalog entry
    const shift = selectedShift ? getShiftById(selectedShift) : undefined;
    const shiftType = (shift?.label?.toLowerCase() ?? 'matutino') as IShiftSession['shift_type'];

    // Create session first (AD-1: session before event for transactional ordering)
    await shiftSessionsRepo.create({
      machine_id: selectedMachine,
      operator_id: user?.id ?? '',
      shift_type: shiftType,
      started_at: nowMs(),
      planned_boxes: 480,
      status: 'active',
    });

    await repository.createEvent({
      event_type: 'shift_start',
      timestamp: nowMs(),
      planned_boxes: 480,
    });
    setShiftStarted(true);
    setSnackbarMessage('Turno iniciado');
    setSnackbarVisible(true);
  }, [repository, shiftSessionsRepo, isValid, selectedShift, selectedMachine, selectedLine, user?.id]);

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
    if (!selectedShift || !selectedLine || !selectedMachine) return;

    // Close the active session before creating shift_end event
    const activeSession = await shiftSessionsRepo.findActiveByMachine(selectedMachine);
    if (activeSession) {
      await shiftSessionsRepo.update(activeSession.get('id'), {
        status: 'closed',
        ended_at: nowMs(),
      });
    }

    await repository.createEvent({
      event_type: 'shift_end',
      timestamp: nowMs(),
    });

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
    setShowConfirmModal(false);
    setPendingEvent(null);
    setSnackbarMessage('Turno cerrado y reporte generado');
    setSnackbarVisible(true);
  }, [selectedShift, selectedLine, selectedMachine, selectedPpm, repository, shiftSessionsRepo, reportsRepository, setSelectedProduct]);

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  return {
    // State
    shiftStarted,
    events,
    activeDowntime,
    metrics,

    // Modal states
    showStopModal,
    showConfirmModal,
    confirmTitle,
    confirmMessage,
    confirmLabel,
    showShiftBlocker,
    showProductionModal,

    // Snackbar
    snackbarVisible,
    snackbarMessage,

    // Helper flags
    isIotMachine,

    // Handlers
    handleStartShift,
    handleEndShift,
    handleStartDowntime,
    handleSelectStopReason,
    handleEndDowntime,
    handleRegisterProduction,
    handleNumpadSubmit,
    handleConfirm,

    // Setters for dismiss
    setShowStopModal,
    setShowConfirmModal,
    setShowShiftBlocker,
    setShowProductionModal,
    setSnackbarVisible,
  } as const;
}
