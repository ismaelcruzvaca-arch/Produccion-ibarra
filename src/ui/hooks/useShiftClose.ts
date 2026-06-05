/**
 * useShiftClose — Orchestration hook for the ShiftCloseScreen.
 *
 * Pattern: Hook Extraction (Container/Presentational)
 * Why:
 * - Extracts all state, effects, and callbacks from ShiftCloseScreen into a single hook.
 * - ShiftCloseScreen becomes a thin component that calls the hook and passes
 *   everything to child components.
 *
 * Responsibilities:
 * - Load shift_session + oee_events for the shift
 * - Build stop list from oee_events (downtime_start/end pairs)
 * - Calculate production summary: planned vs actual vs rejects vs unexplained
 * - Auto-detect which stops need conciliation (based on plant_config + department mapping)
 * - Auto-detect recurrence (same reason_code N times)
 * - State for supervisor classification: planned/unplanned per stop
 * - submitShiftClose() orchestrates the full close flow
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { RxDocument } from 'rxdb';

import { useShiftSessionsRepository } from '../../repositories/useShiftSessionsRepository';
import { useOeeEventsRepository } from '../../repositories/useOeeEventsRepository';
import { usePlantConfigRepository } from '../../repositories/usePlantConfigRepository';
import { useShiftSummaryRepository } from '../../repositories/useShiftSummaryRepository';
import { useDowntimeConciliationRepository } from '../../repositories/useDowntimeConciliationRepository';
import type {
  IOeeEvent, IShiftSession, IShiftSummary, IDowntimeConciliation,
} from '../../core/types';
import { nowMs } from '../../utils/timestamp';
import { generateUuid } from '../../utils/uuid';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface StopPair {
  /** The downtime_start event */
  start: IOeeEvent;
  /** The corresponding downtime_end event (if found) */
  end?: IOeeEvent;
  /** Computed duration in minutes */
  durationMin: number;
  /** Whether this stop requires conciliation (based on threshold + department mapping) */
  requiresConciliation: boolean;
  /** Whether this stop requires RCA (duration >= rcaThresholdMin or recurrent) */
  requiresRca: boolean;
  /** Departments that need to be involved in conciliation (derived from reason_code) */
  involvedDepartments: string[];
}

export interface ProductionSummary {
  /** Total planned boxes */
  plannedBoxes: number;
  /** Actual boxes counted */
  actualBoxes: number;
  /** Total rejects */
  totalRejects: number;
  /** Unaccounted boxes (planned - actual - rejects) */
  unexplainedBoxes: number;
  /** Total planned minutes */
  totalPlannedMin: number;
  /** Total downtime minutes (sum of all stop durations) */
  totalDowntimeMin: number;
}

export interface ClassifiedStop {
  oee_event_id: string;
  reasonCode: string;
  durationMin: number;
  classification: 'planned' | 'unplanned' | null;
  explained_missing_boxes?: number;
  notes?: string;
  requiresConciliation: boolean;
  requiresRca: boolean;
  involvedDepartments: string[];
}

export interface ShiftCloseState {
  /** The shift session being closed */
  shiftSession: IShiftSession | null;
  /** All OEE events for the shift (raw) */
  oeeEvents: IOeeEvent[];
  /** Stop pairs (matched downtime_start + downtime_end) */
  stops: StopPair[];
  /** Production metrics summary */
  productionSummary: ProductionSummary;
  /** Supervisor classification for each stop */
  classifiedStops: ClassifiedStop[];
  /** Loading state */
  loading: boolean;
  /** Saving state */
  saving: boolean;
  /** Error message */
  error: string | null;
  /** Success message */
  success: string | null;
  /** Validation errors */
  validationErrors: string[];
}

export interface ShiftCloseActions {
  /** Load shift data by session ID */
  loadShift: (sessionId: string) => Promise<void>;
  /** Set classification for a stop */
  setClassification: (oeeEventId: string, classification: 'planned' | 'unplanned') => void;
  /** Set explained missing boxes for a stop */
  setExplainedBoxes: (oeeEventId: string, boxes: number) => void;
  /** Set notes for a stop */
  setStopNotes: (oeeEventId: string, notes: string) => void;
  /** Submit shift close — validates + creates summary + conciliations + closes session */
  submitShiftClose: () => Promise<void>;
  /** Clear messages */
  clearMessages: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build stop pairs from OEE events.
 * Matches downtime_start with downtime_end events via related_event_id.
 */
function buildStopPairs(events: IOeeEvent[]): StopPair[] {
  const startEvents = events.filter((e) => e.event_type === 'downtime_start');
  const endEvents = events.filter((e) => e.event_type === 'downtime_end');

  // Build end-by-related-event lookup
  const endByRelated = new Map<string, IOeeEvent>();
  for (const end of endEvents) {
    if (end.related_event_id) {
      endByRelated.set(end.related_event_id, end);
    }
  }

  return startEvents
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((start) => {
      const end = endByRelated.get(start.id);
      const durationMin = end
        ? Math.round((end.timestamp - start.timestamp) / 60000)
        : 0;
      return { start, end, durationMin, requiresConciliation: false, requiresRca: false, involvedDepartments: [] };
    });
}

/**
 * Calculate production summary from OEE events.
 */
function calculateSummary(
  events: IOeeEvent[],
  session: IShiftSession | null,
): ProductionSummary {
  let actualBoxes = 0;
  let totalRejects = 0;
  let totalDowntimeMin = 0;

  for (const evt of events) {
    if (evt.event_type === 'box_count') {
      actualBoxes += evt.quantity ?? 0;
    } else if (evt.event_type === 'reject_count') {
      totalRejects += evt.quantity ?? 0;
    }
  }

  // Compute total downtime from start/end pairs
  const stops = buildStopPairs(events);
  for (const stop of stops) {
    totalDowntimeMin += stop.durationMin;
  }

  const plannedBoxes = session?.planned_boxes ?? 0;
  const unexplainedBoxes = Math.max(0, plannedBoxes - actualBoxes - totalRejects);

  // Total planned minutes: use session duration if ended_at set, otherwise real elapsed
  const totalPlannedMin = session
    ? Math.round(((session.ended_at ?? nowMs()) - session.started_at) / 60000)
    : 0;

  return {
    plannedBoxes,
    actualBoxes,
    totalRejects,
    unexplainedBoxes,
    totalPlannedMin,
    totalDowntimeMin,
  };
}

/**
 * Determine which departments are involved for a given reason_code.
 */
function getInvolvedDepartments(
  reasonCode: string,
  deptReasonCodes: Record<string, string[]>,
): string[] {
  const depts: string[] = [];
  for (const [dept, codes] of Object.entries(deptReasonCodes)) {
    if (codes.includes(reasonCode)) {
      depts.push(dept);
    }
  }
  return depts;
}

/**
 * Count reason_code occurrences across stops for recurrence detection.
 */
function countReasonCodes(stops: StopPair[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const stop of stops) {
    const code = stop.start.reason_code;
    if (code) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  return counts;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useShiftClose() {
  const shiftSessionsRepo = useShiftSessionsRepository();
  const oeeEventsRepo = useOeeEventsRepository();
  const plantConfigRepo = usePlantConfigRepository();
  const shiftSummaryRepo = useShiftSummaryRepository();
  const conciliationRepo = useDowntimeConciliationRepository();

  const [state, setState] = useState<ShiftCloseState>({
    shiftSession: null,
    oeeEvents: [],
    stops: [],
    productionSummary: { plannedBoxes: 0, actualBoxes: 0, totalRejects: 0, unexplainedBoxes: 0, totalPlannedMin: 0, totalDowntimeMin: 0 },
    classifiedStops: [],
    loading: false,
    saving: false,
    error: null,
    success: null,
    validationErrors: [],
  });

  // ─── Load shift ──────────────────────────────────────────────────────────────
  const loadShift = useCallback(
    async (sessionId: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const sessionDoc = await shiftSessionsRepo.findById(sessionId);
        if (!sessionDoc) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: 'Turno no encontrado',
          }));
          return;
        }
        const session = sessionDoc.toJSON() as IShiftSession;

        if (session.status === 'closed') {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: 'Este turno ya está cerrado',
          }));
          return;
        }

        const oeeDocs = await oeeEventsRepo.findByShift(sessionId);
        const events = oeeDocs.map((doc) => doc.toJSON() as IOeeEvent);

        // Build raw stops
        const rawStops = buildStopPairs(events);

        // Load plant config for analysis
        const [
          conciliationThresholdMin,
          rcaThresholdMin,
          rcaRecurrenceCount,
          deptReasonCodes,
        ] = await Promise.all([
          plantConfigRepo.getConciliationThresholdMin(),
          plantConfigRepo.getRcaThresholdMin(),
          plantConfigRepo.getRcaRecurrenceCount(),
          plantConfigRepo.getDepartmentReasonCodes(),
        ]);

        // Reason code recurrence counts
        const reasonCounts = countReasonCodes(rawStops);

        // Annotate stops with conciliation/RCA requirements
        const annotatedStops: StopPair[] = rawStops.map((stop) => {
          const reasonCode = stop.start.reason_code ?? '';
          const involved = getInvolvedDepartments(reasonCode, deptReasonCodes);
          const needsConciliation =
            involved.length > 0 && stop.durationMin >= conciliationThresholdMin;
          const isLongRca = stop.durationMin >= rcaThresholdMin;
          const isRecurrent =
            reasonCode !== '' && (reasonCounts.get(reasonCode) ?? 0) >= rcaRecurrenceCount;
          const needsRca = isLongRca || isRecurrent;

          return {
            ...stop,
            requiresConciliation: needsConciliation,
            requiresRca: needsRca,
            involvedDepartments: involved,
          };
        });

        // Build production summary
        const summary = calculateSummary(events, session);

        // Build initial classified stops (all null classification)
        const classified: ClassifiedStop[] = annotatedStops.map((stop) => ({
          oee_event_id: stop.start.id,
          reasonCode: stop.start.reason_code ?? '',
          durationMin: stop.durationMin,
          classification: null,
          requiresConciliation: stop.requiresConciliation,
          requiresRca: stop.requiresRca,
          involvedDepartments: stop.involvedDepartments,
        }));

        setState((prev) => ({
          ...prev,
          shiftSession: session,
          oeeEvents: events,
          stops: annotatedStops,
          productionSummary: summary,
          classifiedStops: classified,
          loading: false,
        }));
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err?.message ?? 'Error al cargar datos del turno',
        }));
      }
    },
    [shiftSessionsRepo, oeeEventsRepo, plantConfigRepo],
  );

  // ─── Classification actions ─────────────────────────────────────────────────
  const setClassification = useCallback(
    (oeeEventId: string, classification: 'planned' | 'unplanned') => {
      setState((prev) => ({
        ...prev,
        classifiedStops: prev.classifiedStops.map((cs) =>
          cs.oee_event_id === oeeEventId ? { ...cs, classification } : cs,
        ),
      }));
    },
    [],
  );

  const setExplainedBoxes = useCallback(
    (oeeEventId: string, boxes: number) => {
      setState((prev) => ({
        ...prev,
        classifiedStops: prev.classifiedStops.map((cs) =>
          cs.oee_event_id === oeeEventId ? { ...cs, explained_missing_boxes: boxes } : cs,
        ),
      }));
    },
    [],
  );

  const setStopNotes = useCallback(
    (oeeEventId: string, notes: string) => {
      setState((prev) => ({
        ...prev,
        classifiedStops: prev.classifiedStops.map((cs) =>
          cs.oee_event_id === oeeEventId ? { ...cs, notes } : cs,
        ),
      }));
    },
    [],
  );

  // ─── Validation ─────────────────────────────────────────────────────────────
  const validate = useCallback((): string[] => {
    const errors: string[] = [];
    const unclassified = state.classifiedStops.filter(
      (cs) => cs.classification === null,
    );
    if (unclassified.length > 0) {
      errors.push(
        `Faltan clasificar ${unclassified.length} paro(s) — debe marcar cada paro como Planificado o No Planificado`,
      );
    }
    // Check each stop needing conciliation has been classified
    const unclassifiedForConciliation = state.classifiedStops.filter(
      (cs) => cs.requiresConciliation && cs.classification !== 'unplanned',
    );
    // Only unplanned stops go to conciliation
    // Planned stops are expected and don't need conciliation
    return errors;
  }, [state.classifiedStops]);

  // ─── Submit shift close ─────────────────────────────────────────────────────
  const submitShiftClose = useCallback(async () => {
    const session = state.shiftSession;
    if (!session) return;

    const errors = validate();
    if (errors.length > 0) {
      setState((prev) => ({ ...prev, validationErrors: errors }));
      return;
    }

    setState((prev) => ({ ...prev, saving: true, error: null, validationErrors: [] }));
    try {
      // 1. Upsert shift_summary with classified_stops
      const conciliationThresholdMin = await plantConfigRepo.getConciliationThresholdMin();
      const deptReasonCodes = await plantConfigRepo.getDepartmentReasonCodes();
      const escalationHours = await plantConfigRepo.getEscalationHours();

      const existingSummary = await shiftSummaryRepo.findBySession(session.id);

      const summaryPayload: Omit<IShiftSummary, 'id' | 'updated_at' | 'is_deleted' | 'device_id'> & { device_id?: string } = {
        shift_session_id: session.id,
        total_planned_min: state.productionSummary.totalPlannedMin,
        total_downtime_min: state.productionSummary.totalDowntimeMin,
        total_micro_stop_min: 0, // TODO: compute if micro-stop data is available
        total_mtto_min: state.productionSummary.totalDowntimeMin, // simplified
        total_prod_min: 0,
        total_boxes: state.productionSummary.actualBoxes,
        total_rejects: state.productionSummary.totalRejects,
        has_pending_conciliation: state.classifiedStops.some(
          (cs) => cs.requiresConciliation && cs.classification === 'unplanned',
        ),
        classified_stops: state.classifiedStops.map((cs) => ({
          oee_event_id: cs.oee_event_id,
          classification: cs.classification ?? 'unplanned',
          explained_missing_boxes: cs.explained_missing_boxes,
          notes: cs.notes,
        })),
        created_at: nowMs(),
      };

      if (existingSummary) {
        await shiftSummaryRepo.update(existingSummary.get('id'), summaryPayload);
      } else {
        await shiftSummaryRepo.create(summaryPayload as any);
      }

      // 2. Create pending conciliations for unplanned stops that require them
      const unplannedStops = state.classifiedStops.filter(
        (cs) => cs.classification === 'unplanned' && cs.requiresConciliation,
      );

      for (const cs of unplannedStops) {
        const stopInfo = state.stops.find((s) => s.start.id === cs.oee_event_id);
        if (!stopInfo) continue;

        const now = nowMs();
        const escalationDeadlineMs = now + escalationHours * 3600 * 1000;

        const concilPayload: Omit<IDowntimeConciliation, 'id' | 'updated_at' | 'is_deleted' | 'device_id'> & { device_id?: string } = {
          oee_event_id: cs.oee_event_id,
          shift_session_id: session.id,
          machine_id: stopInfo.start.machine_id,
          reason_code: cs.reasonCode,
          duration_min: cs.durationMin,
          status: 'pending',
          is_mtto: cs.involvedDepartments.includes('MTTO'),
          ot_sent: false,
          involved_departments: cs.involvedDepartments,
          verdicts: [],
          analysis_method: undefined,
          why_1: undefined,
          why_2: undefined,
          why_3: undefined,
          why_4: undefined,
          why_5: undefined,
          root_cause: undefined,
          corrective_action: undefined,
          escalation_deadline: escalationDeadlineMs,
          escalated_at: undefined,
          escalated_to: undefined,
          // Legacy fields — keep defaults
          conciliated: false,
          device_id: undefined,
          created_at: nowMs(),
        };

        await conciliationRepo.create(concilPayload as any);
      }

      // 3. Close shift session
      await shiftSessionsRepo.update(session.id, {
        status: 'closed',
        ended_at: nowMs(),
      });

      setState((prev) => ({
        ...prev,
        saving: false,
        success: `Turno cerrado correctamente — ${unplannedStops.length} conciliaciones creadas`,
      }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        saving: false,
        error: err?.message ?? 'Error al cerrar el turno',
      }));
    }
  }, [
    state.shiftSession,
    state.classifiedStops,
    state.stops,
    state.productionSummary,
    validate,
    shiftSummaryRepo,
    shiftSessionsRepo,
    conciliationRepo,
    plantConfigRepo,
  ]);

  const clearMessages = useCallback(() => {
    setState((prev) => ({ ...prev, error: null, success: null, validationErrors: [] }));
  }, []);

  // ─── Return ─────────────────────────────────────────────────────────────────
  const actions: ShiftCloseActions = useMemo(
    () => ({
      loadShift,
      setClassification,
      setExplainedBoxes,
      setStopNotes,
      submitShiftClose,
      clearMessages,
    }),
    [loadShift, setClassification, setExplainedBoxes, setStopNotes, submitShiftClose, clearMessages],
  );

  return {
    ...state,
    actions,
  };
}
