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

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { RxDocument } from 'rxdb';

import { useOeeEventsRepository } from '../../repositories/useOeeEventsRepository';
import { useReportsRepository } from '../../repositories/useReportsRepository';
import { useShiftSessionsRepository } from '../../repositories/useShiftSessionsRepository';
import { useDowntimeConciliationRepository } from '../../repositories/useDowntimeConciliationRepository';
import { usePlantConfigRepository } from '../../repositories/usePlantConfigRepository';
import { useShiftSummaryRepository } from '../../repositories/useShiftSummaryRepository';
import { useOeeCalculator } from './useOeeCalculator';
import { computeOee } from '../../core/oeeCalculator';
import { OEE_LIMITS } from '../../config/oeeLimits';
import type { IOeeEvent, IShiftSession } from '../../core/types';
import type { ParoReason } from '../../config/catalogs';
import { PARO_BY_CODE, PARO_REASONS, DEFAULT_PPM } from '../../config/catalogs';
import { nowMs } from '../../utils/timestamp';
import { generateShiftReport } from '../../core/shiftReportGenerator';
import { useCatalogStore } from '../store/catalogStore';
import { useAuthStore } from '../../auth/useAuthStore';
import { useOeeValidation } from './useOeeValidation';

export function useOeeScreenOrchestration() {
  const repository = useOeeEventsRepository();
  const reportsRepository = useReportsRepository();
  const shiftSessionsRepo = useShiftSessionsRepository();
  const conciliationRepo = useDowntimeConciliationRepository();
  const plantConfigRepo = usePlantConfigRepository();
  const shiftSummaryRepo = useShiftSummaryRepository();
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
  const machineSourceType = selectedMachine
    ? (getMachineById(selectedMachine)?.source_type ?? 'manual')
    : 'manual';
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

  // ─── Telemetry stop classification ───────────────────────────────────────
  const [showTelemetryClassify, setShowTelemetryClassify] = useState(false);
  const [telemetryClassifyTarget, setTelemetryClassifyTarget] = useState<string | null>(null);
  const prevActiveDowntimeRef = useRef<string | null>(null);

  // ─── Production counter modal ───────────────────────────────────────────────
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [pendingAnomalousProduction, setPendingAnomalousProduction] = useState<number | null>(null);

  // ─── Cadence tracking ─────────────────────────────────────────────────────
  const [cadenceIntervalMin, setCadenceIntervalMin] = useState(30);
  const [cadenceElapsedMinutes, setCadenceElapsedMinutes] = useState(0);
  const [cadenceDue, setCadenceDue] = useState(false);
  const cadenceDismissedRef = useRef(false);

  // Load cadence config on mount
  useEffect(() => {
    plantConfigRepo.getCadenceIntervalMin().then(setCadenceIntervalMin);
  }, [plantConfigRepo]);

  // Compute last event time from events array
  const lastEventTime = useMemo(() => {
    const userEventTypes = new Set(['box_count', 'downtime_start', 'downtime_end', 'reject_count']);
    let latest = 0;
    for (const evt of events) {
      if (userEventTypes.has(evt.event_type) && evt.timestamp > latest) {
        latest = evt.timestamp;
      }
    }
    return latest;
  }, [events]);

  // Poll cadence every 15 seconds for manual stations
  useEffect(() => {
    if (!shiftStarted || machineSourceType !== 'manual' || !selectedMachine) {
      setCadenceDue(false);
      setCadenceElapsedMinutes(0);
      return;
    }

    const tick = () => {
      // Reset dismiss if a new event came in
      if (lastEventTime > 0) {
        const elapsed = (nowMs() - lastEventTime) / 60000;
        setCadenceElapsedMinutes(Math.round(elapsed * 10) / 10);

        if (elapsed >= cadenceIntervalMin && !cadenceDismissedRef.current) {
          setCadenceDue(true);
        } else {
          setCadenceDue(false);
        }
      }
    };

    tick();
    const interval = setInterval(tick, 15000);
    return () => clearInterval(interval);
  }, [shiftStarted, machineSourceType, selectedMachine, lastEventTime, cadenceIntervalMin]);

  // Reset cadence dismissed when a new event arrives
  useEffect(() => {
    if (lastEventTime > 0) {
      cadenceDismissedRef.current = false;
    }
  }, [lastEventTime]);

  const handleDismissCadence = useCallback(() => {
    cadenceDismissedRef.current = true;
    setCadenceDue(false);
  }, []);

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

  // ─── Telemetry stop classification detection ──────────────────────────────
  useEffect(() => {
    if (!shiftStarted || !selectedMachine || machineSourceType !== 'telemetry') {
      setShowTelemetryClassify(false);
      setTelemetryClassifyTarget(null);
      prevActiveDowntimeRef.current = null;
      return;
    }

    const currentId = activeDowntime?.get('id') ?? null;
    const prevId = prevActiveDowntimeRef.current;
    prevActiveDowntimeRef.current = currentId;

    // Detect a NEW active downtime (not previously seen) on a telemetry machine
    if (currentId && currentId !== prevId) {
      const reasonCode = activeDowntime?.get('reason_code') as string | undefined;
      // If telemetry-detected stop has no reason_code, operator must classify it
      if (!reasonCode) {
        setTelemetryClassifyTarget(currentId);
        setShowTelemetryClassify(true);
      }
    }
  }, [shiftStarted, selectedMachine, machineSourceType, activeDowntime]);

  // ─── Telemetry classification handler ─────────────────────────────────────
  const handleTelemetryClassify = useCallback(async (reason: ParoReason) => {
    const targetId = telemetryClassifyTarget;
    if (!targetId) return;

    setShowTelemetryClassify(false);
    setTelemetryClassifyTarget(null);

    // Update the existing telemetry event with the operator's classification
    await repository.update(targetId, { reason_code: reason.code });
    setSnackbarMessage(`Paro clasificado: ${reason.label}`);
    setSnackbarVisible(true);
  }, [telemetryClassifyTarget, repository]);

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
      created_at: nowMs(),
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
    const report = await generateShiftReport({
      events: shiftEvents.map((e) => e.toJSON() as IOeeEvent),
      shiftId: selectedShift,
      lineId: selectedLine,
      ppm: selectedPpm,
      shiftSessionId: activeSession?.get('id'),
    });
    await reportsRepository.createReport(report.data, report.template_id);

    // ── Shift Summary (R6) ─────────────────────────────────────────────────
    try {
      const events = shiftEvents.map((e) => e.toJSON() as IOeeEvent);
      const oeeMetrics = await computeOee(events, selectedPpm ?? DEFAULT_PPM, undefined, activeSession?.get('id'));

      // Compute micro-stop total: downtimes with duration < threshold
      const threshold = await plantConfigRepo.getMicroStopThreshold();
      const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
      const openDts: IOeeEvent[] = [];
      let microStopTotalMin = 0;
      for (const evt of sorted) {
        if (evt.event_type === 'downtime_start') {
          openDts.push(evt);
        } else if (evt.event_type === 'downtime_end' && evt.related_event_id) {
          const idx = openDts.findIndex((d) => d.id === evt.related_event_id);
          if (idx !== -1) {
            const start = openDts.splice(idx, 1)[0];
            const durMin = (evt.timestamp - start.timestamp) / 60000;
            if (durMin < threshold) {
              microStopTotalMin += durMin;
            }
          }
        }
      }

      // Check for pending conciliations
      let hasPending = false;
      if (activeSession) {
        const pending = await conciliationRepo.findPendingByShift(activeSession.get('id'));
        hasPending = pending.length > 0;
      }

      await shiftSummaryRepo.create({
        shift_session_id: activeSession?.get('id') ?? selectedShift,
        total_planned_min: Math.round(oeeMetrics.tiempoPlanificadoMin),
        total_downtime_min: Math.round(oeeMetrics.tiempoParoProdMin + oeeMetrics.tiempoParoMttoMin),
        total_micro_stop_min: Math.round(microStopTotalMin),
        total_mtto_min: Math.round(oeeMetrics.tiempoParoMttoMin),
        total_prod_min: Math.round(oeeMetrics.tiempoParoProdMin),
        total_boxes: oeeMetrics.totalCajas,
        total_rejects: oeeMetrics.totalRechazos,
        performance_pct: Math.round(oeeMetrics.rendimiento * 100) / 100,
        has_pending_conciliation: hasPending,
        created_at: nowMs(),
      });
    } catch (err) {
      // Non-blocking — shift_summary is a cached aggregate, failure shouldn't block shift close
      console.warn('Failed to create shift_summary:', err);
    }
    // ── End Shift Summary ──────────────────────────────────────────────────

    setSelectedProduct(null);
    setShiftStarted(false);
    setShowConfirmModal(false);
    setPendingEvent(null);
    setSnackbarMessage('Turno cerrado y reporte generado');
    setSnackbarVisible(true);
  }, [selectedShift, selectedLine, selectedMachine, selectedPpm, repository, shiftSessionsRepo, reportsRepository, setSelectedProduct, plantConfigRepo, conciliationRepo, shiftSummaryRepo]);

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

    setConfirmTitle(isAtypical ? 'Paro Atípico' : 'Fin de Paro');
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
    if (!pendingEvent || !selectedShift || !selectedMachine) return;

    const relatedEventId = pendingEvent.related_event_id;
    await repository.createEvent({
      event_type: 'downtime_end',
      timestamp: nowMs(),
      related_event_id: relatedEventId,
    });

    // ── Fire-and-forget: create pending conciliation if MTTO reason ─────
    if (relatedEventId) {
      try {
        // Look up the original downtime_start event to get reason_code
        const startEvent = await repository.findById(relatedEventId);
        if (startEvent) {
          const reasonCode = startEvent.get('reason_code') as string | undefined;
          const startTimestamp = startEvent.get('timestamp') as number;

          if (reasonCode) {
            // Check if the reason is MTTO category
            const reasonCatalogEntry = PARO_REASONS.find((r) => r.code === reasonCode);
            const isMtto = reasonCatalogEntry?.macro === 'MTTO';

            if (isMtto) {
              // Calculate duration in minutes
              const durationMs = nowMs() - startTimestamp;
              const durationMin = Math.round((durationMs / 60000) * 10) / 10;

              // Check threshold
              const threshold = await plantConfigRepo.getMicroStopThreshold();
              if (durationMin >= threshold) {
                // Get active shift session for the machine
                const activeSession = await shiftSessionsRepo.findActiveByMachine(selectedMachine);

                await conciliationRepo.create({
                  oee_event_id: relatedEventId,
                  shift_session_id: activeSession?.get('id') ?? selectedShift,
                  machine_id: selectedMachine,
                  reason_code: reasonCode,
                  duration_min: durationMin,
                  conciliated: false,
                  ot_sent: false,
                  is_mtto: true,
                  status: 'pending',
                  created_at: nowMs(),
                  involved_departments: [],
                  verdicts: [],
                  escalation_deadline: 0,
                });
              }
            }
          }
        }
      } catch (err) {
        // Fire-and-forget — don't block the UI if conciliation creation fails
        console.warn('Failed to create pending conciliation:', err);
      }
    }

    setShowConfirmModal(false);
    setPendingEvent(null);
    setSnackbarMessage('Paro cerrado');
    setSnackbarVisible(true);
  }, [pendingEvent, selectedShift, selectedMachine, repository, plantConfigRepo, shiftSessionsRepo, conciliationRepo]);

  // ─── Production ────────────────────────────────────────────────────────────
  const handleRegisterProduction = useCallback(() => {
    setShowProductionModal(true);
  }, []);

  const handleNumpadSubmit = useCallback((value: number) => {
    setShowProductionModal(false);
    if (value > OEE_LIMITS.DEFAULT_SOFT_LIMIT) {
      setConfirmTitle('Producción Anómala');
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

    // Cadence state
    cadenceDue,
    cadenceElapsedMinutes,
    cadenceIntervalMin,

    // Modal states
    showStopModal,
    showConfirmModal,
    confirmTitle,
    confirmMessage,
    confirmLabel,
    showShiftBlocker,
    showProductionModal,
    showTelemetryClassify,

    // Snackbar
    snackbarVisible,
    snackbarMessage,

    // Helper flags
    isIotMachine,
    machineSourceType,

    // Handlers
    handleStartShift,
    handleEndShift,
    handleStartDowntime,
    handleSelectStopReason,
    handleEndDowntime,
    handleRegisterProduction,
    handleNumpadSubmit,
    handleConfirm,
    handleDismissCadence,
    handleTelemetryClassify,

    // Setters for dismiss
    setShowStopModal,
    setShowConfirmModal,
    setShowShiftBlocker,
    setShowProductionModal,
    setShowTelemetryClassify,
    setSnackbarVisible,
  } as const;
}
