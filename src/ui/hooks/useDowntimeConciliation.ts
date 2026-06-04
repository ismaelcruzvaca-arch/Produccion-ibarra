/**
 * useDowntimeConciliation — Orchestration hook for the ConciliationScreen.
 *
 * Pattern: Hook Extraction (Container/Presentational)
 * Why:
 * - Extracts all state, effects, and callbacks from ConciliationScreen into a single hook.
 * - ConciliationScreen becomes a thin component that calls the hook and passes
 *   everything to child components.
 *
 * Two-step workflow:
 *   1. Production diagnosis: supervisor selects root cause code → updates diagnosed_code
 *   2. Finalization: supervisor reviews mechanic diagnosis, finalizes as reconciled or disputed
 *
 * Micro-stop filter:
 *   Events with duration_min < threshold (from plant_config) are excluded at read time.
 *   This preserves raw data and allows threshold changes to apply retroactively.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { RxDocument } from 'rxdb';

import { useDowntimeConciliationRepository } from '../../repositories/useDowntimeConciliationRepository';
import { useOeeEventsRepository } from '../../repositories/useOeeEventsRepository';
import { usePlantConfigRepository } from '../../repositories/usePlantConfigRepository';
import { useShiftSummaryRepository } from '../../repositories/useShiftSummaryRepository';
import { useDatabase } from '../../data/DatabaseContext';
import type { IDowntimeConciliation, ConciliationStatus, IOeeEvent, IShiftSummary, IWorkOrder, IDepartmentVerdict, ICorrectiveAction } from '../../core/types';
import { nowMs } from '../../utils/timestamp';

// ─── Micro-stop filter ─────────────────────────────────────────────────────────
// Pure function: given events + threshold (minutes), return events with duration >= threshold.
// Events without duration_min are always included.

export function filterByMicroStopThreshold(
  events: IDowntimeConciliation[],
  thresholdMin: number,
): IDowntimeConciliation[] {
  return events.filter(
    (e) => e.duration_min === undefined || e.duration_min >= thresholdMin,
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export type WorkflowStep = 'list' | 'diagnose' | 'rca' | 'verdicts' | 'corrective_action' | 'finalize' | 'summary';

/**
 * An OEE event enriched with its conciliation status (if applicable).
 */
export interface EnrichedOeeEvent {
  /** The raw oee_event */
  event: IOeeEvent;
  /** Conciliation info if this event is linked to a downtime_conciliation record */
  conciliation?: {
    id: string;
    status: ConciliationStatus;
    diagnosed_code?: string;
    conciliated_code?: string;
    conciliated_macro?: string;
  };
}

/**
 * A downtime conciliation record enriched with work order lifecycle data.
 * The wo_* fields come from the IWorkOrder whose cmms_wo_id matches this
 * record's ot_response (the cmms-ibero WO ID from oee-trigger).
 */
export interface EnrichedPendingRecord extends IDowntimeConciliation {
  /** Lifecycle phase from the associated work order in cmms-ibero */
  wo_lifecycle_phase?: string;
  /** cmms-ibero work order ID (copied from IWorkOrder.cmms_wo_id for convenience) */
  wo_cmms_wo_id?: string;
  /** Symptom note recorded in the associated work order */
  wo_symptom_note?: string;
}

export interface ConciliationScreenState {
  /** All pending records after micro-stop filter, enriched with WO lifecycle data */
  pendingRecords: EnrichedPendingRecord[];

  /** Current workflow step */
  step: WorkflowStep;

  /** Selected record for diagnosis/finalization (includes WO enrichment) */
  selectedRecord: EnrichedPendingRecord | null;

  /** Production diagnosis code */
  diagnosedCode: string;

  /** Maintenance diagnosis code */
  conciliatedCode: string;

  /** Maintenance diagnosis macro */
  conciliatedMacro: string;

  /** Conciliation notes */
  notes: string;

  /** Loading state */
  loading: boolean;

  /** Saving state */
  saving: boolean;

  /** Error message */
  error: string | null;

  /** Success message */
  success: string | null;

  // ── Wave 5: RCA fields (R8) ───────────────────────────────────────────

  /** RCA method: 5 Whys or Ishikawa */
  analysisMethod: '5whys' | 'ishikawa' | null;
  /** 5 Whys individual entries */
  why_1: string;
  why_2: string;
  why_3: string;
  why_4: string;
  why_5: string;
  /** Final root cause summary */
  rootCause: string;

  // ── Wave 5: Verdicts (R9) ─────────────────────────────────────────────

  /** Per-department verdicts for current conciliation */
  verdicts: IDepartmentVerdict[];

  // ── Wave 5: Corrective Action (R10) ────────────────────────────────────

  /** Current corrective action being drafted */
  correctiveAction: ICorrectiveAction | null;

  // ── Wave 5: Escalation ─────────────────────────────────────────────────

  /** Whether the escalation deadline has passed */
  escalationOverdue: boolean;
  /** Formatted countdown text */
  escalationCountdown: string;

  // ── Summary view fields (R7) ──────────────────────────────────────────

  /** All OEE events for the shift, enriched with conciliation status */
  summaryEvents: EnrichedOeeEvent[];

  /** The shift_summary record for the shift */
  shiftSummary: IShiftSummary | null;

  /** Loading state for summary view */
  summaryLoading: boolean;
}

export interface ConciliationScreenActions {
  /** Load pending records for a shift */
  loadPendingByShift: (shiftSessionId?: string) => Promise<void>;

  /** Select a record for diagnosis */
  selectForDiagnosis: (record: EnrichedPendingRecord) => void;

  /** Set the production diagnosis code */
  setDiagnosedCode: (code: string) => void;

  /** Submit production diagnosis */
  submitDiagnosis: () => Promise<void>;

  /** Select a record for finalization */
  selectForFinalization: (record: EnrichedPendingRecord) => void;

  /** Set the maintenance diagnosis code */
  setConciliatedCode: (code: string) => void;

  /** Set the maintenance diagnosis macro */
  setConciliatedMacro: (macro: string) => void;

  /** Set conciliation notes */
  setNotes: (notes: string) => void;

  /** Reconcile (approve) the record */
  reconcile: () => Promise<void>;

  /** Dispute the record */
  dispute: () => Promise<void>;

  /** Go back to list */
  backToList: () => void;

  /** Clear messages */
  clearMessages: () => void;

  // ── Wave 5: RCA actions (R8) ──────────────────────────────────────────

  /** Set RCA analysis method */
  setAnalysisMethod: (method: '5whys' | 'ishikawa' | null) => void;
  /** Set a specific "why" entry (1-5) */
  setWhy: (index: 1 | 2 | 3 | 4 | 5, value: string) => void;
  /** Set root cause summary */
  setRootCause: (cause: string) => void;

  // ── Wave 5: Verdict actions (R9) ──────────────────────────────────────

  /** Add a department verdict */
  addVerdict: (verdict: IDepartmentVerdict) => void;
  /** Remove a department verdict */
  removeVerdict: (department: string) => void;
  /** Update an existing verdict */
  updateVerdict: (department: string, patch: Partial<IDepartmentVerdict>) => void;

  // ── Wave 5: Corrective action actions (R10) ───────────────────────────

  /** Set the corrective action plan */
  setCorrectiveAction: (action: ICorrectiveAction | null) => void;

  // ── Wave 5: Escalation actions ────────────────────────────────────────

  /** Escalate the conciliation */
  escalateConciliation: () => Promise<void>;

  // ── Wave 5: Submit ────────────────────────────────────────────────────

  /** Submit the full conciliation (validates all steps) */
  submitConciliation: () => Promise<void>;

  /** Select a record for RCA analysis */
  selectForRca: (record: EnrichedPendingRecord) => void;

  /** Start the verdicts step */
  proceedToVerdicts: () => void;

  /** Start the corrective action step */
  proceedToCorrectiveAction: () => void;

  // ── Summary view actions (R7) ─────────────────────────────────────────

  /** Load shift summary data (events + conciliations + shift_summary) */
  loadShiftSummary: (shiftId: string, shiftSessionId?: string) => Promise<void>;

  /** Switch to summary view */
  showSummaryView: () => void;
}

// ─── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_STATE: ConciliationScreenState = {
  pendingRecords: [],
  step: 'list',
  selectedRecord: null,
  diagnosedCode: '',
  conciliatedCode: '',
  conciliatedMacro: '',
  notes: '',
  loading: false,
  saving: false,
  error: null,
  success: null,
  analysisMethod: null,
  why_1: '',
  why_2: '',
  why_3: '',
  why_4: '',
  why_5: '',
  rootCause: '',
  verdicts: [],
  correctiveAction: null,
  escalationOverdue: false,
  escalationCountdown: '',
  summaryEvents: [],
  shiftSummary: null,
  summaryLoading: false,
};

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useDowntimeConciliation() {
  const db = useDatabase();
  const conciliationRepo = useDowntimeConciliationRepository();
  const oeeEventsRepo = useOeeEventsRepository();
  const plantConfigRepo = usePlantConfigRepository();
  const shiftSummaryRepo = useShiftSummaryRepository();

  const [state, setState] = useState<ConciliationScreenState>(INITIAL_STATE);

  // ─── Derived: grouped by machine ─────────────────────────────────────────────
  const groupedByMachine = useMemo(() => {
    const groups: Record<string, EnrichedPendingRecord[]> = {};
    for (const record of state.pendingRecords) {
      const key = record.machine_id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(record);
    }
    return groups;
  }, [state.pendingRecords]);

  // ─── Load pending by shift ───────────────────────────────────────────────────
  const loadPendingByShift = useCallback(
    async (shiftSessionId?: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        let records: RxDocument<IDowntimeConciliation>[];

        if (shiftSessionId) {
          records = await conciliationRepo.findPendingByShift(shiftSessionId);
        } else {
          records = await conciliationRepo.findByStatus('pending');
        }

        const rawEvents = records.map((doc) => doc.toJSON() as IDowntimeConciliation);

        // Apply micro-stop threshold filter
        const threshold = await plantConfigRepo.getMicroStopThreshold();
        const filtered = filterByMicroStopThreshold(rawEvents, threshold);

        // ── Enrich with work order lifecycle data ──────────────────────────────
        // Load all non-deleted work orders and build a lookup by cmms_wo_id
        // so we can attach lifecycle_phase / symptom_note to matching conciliations.
        const woDocs = await db.collections.work_orders
          .find({ selector: { is_deleted: { $eq: false } } })
          .exec();
        const woMap = new Map<string, IWorkOrder>();
        for (const doc of woDocs) {
          const wo = doc.toJSON() as IWorkOrder;
          if (wo.cmms_wo_id) {
            woMap.set(wo.cmms_wo_id, wo);
          }
        }

        const enriched: EnrichedPendingRecord[] = filtered.map((record) => {
          // Match via ot_response → cmms_wo_id
          const cmmsId = record.ot_response;
          const wo = cmmsId ? woMap.get(cmmsId) : undefined;
          return {
            ...record,
            wo_lifecycle_phase: wo?.lifecycle_phase,
            wo_cmms_wo_id: wo?.cmms_wo_id,
            wo_symptom_note: wo?.symptom_note,
          };
        });

        setState((prev) => ({
          ...prev,
          pendingRecords: enriched,
          loading: false,
        }));
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err?.message ?? 'Error al cargar registros de conciliación',
        }));
      }
    },
    [conciliationRepo, plantConfigRepo, db],
  );

  // ─── Select for diagnosis ────────────────────────────────────────────────────
  const selectForDiagnosis = useCallback((record: EnrichedPendingRecord) => {
    setState((prev) => ({
      ...prev,
      step: 'diagnose',
      selectedRecord: record,
      diagnosedCode: record.diagnosed_code ?? '',
      notes: record.conciliation_notes ?? '',
    }));
  }, []);

  const setDiagnosedCode = useCallback((code: string) => {
    setState((prev) => ({ ...prev, diagnosedCode: code }));
  }, []);

  // ─── Submit diagnosis ────────────────────────────────────────────────────────
  const submitDiagnosis = useCallback(async () => {
    const record = state.selectedRecord;
    if (!record) return;

    setState((prev) => ({ ...prev, saving: true, error: null }));
    try {
      const userId = 'supervisor'; // TODO: get actual user ID from auth

      await conciliationRepo.update(record.id, {
        diagnosed_code: state.diagnosedCode || undefined,
        diagnosed_by: userId,
        diagnosed_at: nowMs(),
        conciliation_notes: state.notes || undefined,
      });

      setState((prev) => ({
        ...prev,
        saving: false,
        step: 'list',
        selectedRecord: null,
        success: 'Diagnóstico guardado correctamente',
      }));

      // Refresh list
      await loadPendingByShift(record.shift_session_id);
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        saving: false,
        error: err?.message ?? 'Error al guardar diagnóstico',
      }));
    }
  }, [state.selectedRecord, state.diagnosedCode, state.notes, conciliationRepo, loadPendingByShift]);

  // ─── Select for finalization ─────────────────────────────────────────────────
  const selectForFinalization = useCallback((record: EnrichedPendingRecord) => {
    setState((prev) => ({
      ...prev,
      step: 'finalize',
      selectedRecord: record,
      conciliatedCode: record.conciliated_code ?? '',
      conciliatedMacro: record.conciliated_macro ?? '',
      notes: record.conciliation_notes ?? '',
    }));
  }, []);

  const setConciliatedCode = useCallback((code: string) => {
    setState((prev) => ({ ...prev, conciliatedCode: code }));
  }, []);

  const setConciliatedMacro = useCallback((macro: string) => {
    setState((prev) => ({ ...prev, conciliatedMacro: macro }));
  }, []);

  const setNotes = useCallback((notes: string) => {
    setState((prev) => ({ ...prev, notes }));
  }, []);

  // ─── Reconcile ──────────────────────────────────────────────────────────────
  const reconcile = useCallback(async () => {
    const record = state.selectedRecord;
    if (!record) return;

    setState((prev) => ({ ...prev, saving: true, error: null }));
    try {
      await conciliationRepo.update(record.id, {
        status: 'reconciled',
        conciliated: true,
        conciliated_code: state.conciliatedCode || undefined,
        conciliated_macro: state.conciliatedMacro || undefined,
        conciliated_at: nowMs(),
        conciliation_notes: state.notes || undefined,
      });

      setState((prev) => ({
        ...prev,
        saving: false,
        step: 'list',
        selectedRecord: null,
        success: 'Paro reconciliado correctamente',
      }));

      // Refresh list
      await loadPendingByShift(record.shift_session_id);
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        saving: false,
        error: err?.message ?? 'Error al reconciliar paro',
      }));
    }
  }, [state.selectedRecord, state.conciliatedCode, state.conciliatedMacro, state.notes, conciliationRepo, loadPendingByShift]);

  // ─── Dispute ─────────────────────────────────────────────────────────────────
  const dispute = useCallback(async () => {
    const record = state.selectedRecord;
    if (!record) return;

    setState((prev) => ({ ...prev, saving: true, error: null }));
    try {
      await conciliationRepo.update(record.id, {
        status: 'disputed',
        conciliated: true,
        conciliated_code: state.conciliatedCode || undefined,
        conciliated_macro: state.conciliatedMacro || undefined,
        conciliated_at: nowMs(),
        conciliation_notes: state.notes || 'Disputado - sin acuerdo en causa raíz',
      });

      setState((prev) => ({
        ...prev,
        saving: false,
        step: 'list',
        selectedRecord: null,
        success: 'Paro disputado — será escalado a gerencia',
      }));

      // Refresh list
      await loadPendingByShift(record.shift_session_id);
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        saving: false,
        error: err?.message ?? 'Error al disputar paro',
      }));
    }
  }, [state.selectedRecord, state.conciliatedCode, state.conciliatedMacro, state.notes, conciliationRepo, loadPendingByShift]);

  // ─── Wave 5: RCA actions ────────────────────────────────────────────────────
  const selectForRca = useCallback((record: EnrichedPendingRecord) => {
    setState((prev) => ({
      ...prev,
      step: 'rca',
      selectedRecord: record,
      analysisMethod: record.analysis_method ?? null,
      why_1: record.why_1 ?? '',
      why_2: record.why_2 ?? '',
      why_3: record.why_3 ?? '',
      why_4: record.why_4 ?? '',
      why_5: record.why_5 ?? '',
      rootCause: record.root_cause ?? '',
      verdicts: record.verdicts ?? [],
      correctiveAction: record.corrective_action ?? null,
    }));
  }, []);

  const setAnalysisMethod = useCallback((method: '5whys' | 'ishikawa' | null) => {
    setState((prev) => ({ ...prev, analysisMethod: method }));
  }, []);

  const setWhy = useCallback((index: 1 | 2 | 3 | 4 | 5, value: string) => {
    setState((prev) => {
      const key = `why_${index}` as const;
      return { ...prev, [key]: value };
    });
  }, []);

  const setRootCause = useCallback((cause: string) => {
    setState((prev) => ({ ...prev, rootCause: cause }));
  }, []);

  // ─── Wave 5: Verdict actions ────────────────────────────────────────────────
  const addVerdict = useCallback((verdict: IDepartmentVerdict) => {
    setState((prev) => ({
      ...prev,
      verdicts: [...prev.verdicts.filter((v) => v.department !== verdict.department), verdict],
    }));
  }, []);

  const removeVerdict = useCallback((department: string) => {
    setState((prev) => ({
      ...prev,
      verdicts: prev.verdicts.filter((v) => v.department !== department),
    }));
  }, []);

  const updateVerdict = useCallback((department: string, patch: Partial<IDepartmentVerdict>) => {
    setState((prev) => ({
      ...prev,
      verdicts: prev.verdicts.map((v) =>
        v.department === department ? { ...v, ...patch } : v,
      ),
    }));
  }, []);

  // ─── Wave 5: Corrective action ──────────────────────────────────────────────
  const setCorrectiveAction = useCallback((action: ICorrectiveAction | null) => {
    setState((prev) => ({ ...prev, correctiveAction: action }));
  }, []);

  // ─── Wave 5: Navigation ────────────────────────────────────────────────────
  const proceedToVerdicts = useCallback(() => {
    setState((prev) => ({ ...prev, step: 'verdicts' }));
  }, []);

  const proceedToCorrectiveAction = useCallback(() => {
    setState((prev) => ({ ...prev, step: 'corrective_action' }));
  }, []);

  // ─── Wave 5: Escalation ───────────────────────────────────────────────────
  const escalateConciliation = useCallback(async () => {
    const record = state.selectedRecord;
    if (!record) return;

    setState((prev) => ({ ...prev, saving: true, error: null }));
    try {
      await conciliationRepo.update(record.id, {
        status: 'escalated',
        escalated_at: nowMs(),
        escalated_to: 'manager', // TODO: support dynamic escalation target
        conciliation_notes: state.notes || 'Escalado - sin acuerdo en conciliación',
      });

      setState((prev) => ({
        ...prev,
        saving: false,
        step: 'list',
        selectedRecord: null,
        success: 'Conciliación escalada a gerencia',
      }));

      await loadPendingByShift(record.shift_session_id);
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        saving: false,
        error: err?.message ?? 'Error al escalar conciliación',
      }));
    }
  }, [state.selectedRecord, state.notes, conciliationRepo, loadPendingByShift]);

  // ─── Wave 5: Submit conciliation ───────────────────────────────────────────
  const submitConciliation = useCallback(async () => {
    const record = state.selectedRecord;
    if (!record) return;

    // Validation
    const errors: string[] = [];

    // Check all required departments have signed
    const requiredDepts = record.involved_departments ?? [];
    const signedDepts = state.verdicts.map((v) => v.department);
    const missingDepts = requiredDepts.filter((d) => !signedDepts.includes(d));
    if (missingDepts.length > 0) {
      errors.push(`Faltan firmas de: ${missingDepts.join(', ')}`);
    }

    // If 5 Whys, check all fields filled
    if (state.analysisMethod === '5whys') {
      const whys = [state.why_1, state.why_2, state.why_3, state.why_4, state.why_5];
      const emptyWhys = whys.some((w) => !w.trim());
      if (emptyWhys) {
        errors.push('Debe completar todos los 5 Porqués');
      }
      if (!state.rootCause.trim()) {
        errors.push('Debe ingresar la causa raíz');
      }
    }

    // If disputed, at least one note
    const hasDisputedVerdict = state.verdicts.some((v) => !v.agreed);
    if (hasDisputedVerdict && !state.notes.trim()) {
      errors.push('Debe agregar notas cuando hay un veredicto en disputa');
    }

    if (errors.length > 0) {
      setState((prev) => ({ ...prev, error: errors.join('. ') }));
      return;
    }

    setState((prev) => ({ ...prev, saving: true, error: null }));
    try {
      await conciliationRepo.update(record.id, {
        analysis_method: state.analysisMethod ?? undefined,
        why_1: state.why_1 || undefined,
        why_2: state.why_2 || undefined,
        why_3: state.why_3 || undefined,
        why_4: state.why_4 || undefined,
        why_5: state.why_5 || undefined,
        root_cause: state.rootCause || undefined,
        verdicts: state.verdicts,
        corrective_action: state.correctiveAction ?? undefined,
        status: hasDisputedVerdict ? 'disputed' : 'reconciled',
        conciliated: true,
        conciliated_at: nowMs(),
        conciliation_notes: state.notes || undefined,
      });

      setState((prev) => ({
        ...prev,
        saving: false,
        step: 'list',
        selectedRecord: null,
        success: hasDisputedVerdict
          ? 'Conciliación finalizada con disputa — será escalada'
          : 'Conciliación finalizada correctamente',
      }));

      await loadPendingByShift(record.shift_session_id);
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        saving: false,
        error: err?.message ?? 'Error al finalizar conciliación',
      }));
    }
  }, [
    state.selectedRecord, state.analysisMethod, state.why_1, state.why_2,
    state.why_3, state.why_4, state.why_5, state.rootCause,
    state.verdicts, state.correctiveAction, state.notes,
    conciliationRepo, loadPendingByShift,
  ]);

  // ─── Navigation ──────────────────────────────────────────────────────────────
  const backToList = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: 'list',
      selectedRecord: null,
      diagnosedCode: '',
      conciliatedCode: '',
      conciliatedMacro: '',
      notes: '',
    }));
  }, []);

  const clearMessages = useCallback(() => {
    setState((prev) => ({ ...prev, error: null, success: null }));
  }, []);

  // ─── Summary view (R7) ─────────────────────────────────────────────────────
  const loadShiftSummary = useCallback(
    async (shiftId: string, shiftSessionId?: string) => {
      setState((prev) => ({ ...prev, summaryLoading: true, error: null }));
      try {
        // Load all oee_events for the shift
        const oeeDocs = await oeeEventsRepo.findByShift(shiftId);
        const allEvents = oeeDocs.map((doc) => doc.toJSON() as IOeeEvent);

        // Load all conciliations for the shift session
        let conciliations: IDowntimeConciliation[] = [];
        if (shiftSessionId) {
          const concilDocs = await conciliationRepo.findByShift(shiftSessionId);
          conciliations = concilDocs.map((doc) => doc.toJSON() as IDowntimeConciliation);
        }

        // Build a map: oee_event_id → conciliation info
        const concilMap = new Map<string, IDowntimeConciliation>();
        for (const c of conciliations) {
          concilMap.set(c.oee_event_id, c);
        }

        // Enrich events with conciliation status (in chronological order)
        const enriched: EnrichedOeeEvent[] = [...allEvents]
          .filter((e) => e.event_type !== 'shift_start' && e.event_type !== 'shift_end')
          .sort((a, b) => a.timestamp - b.timestamp)
          .map((evt) => {
            const concil = concilMap.get(evt.id);
            if (concil) {
              return {
                event: evt,
                conciliation: {
                  id: concil.id,
                  status: concil.status,
                  diagnosed_code: concil.diagnosed_code,
                  conciliated_code: concil.conciliated_code,
                  conciliated_macro: concil.conciliated_macro,
                },
              };
            }
            return { event: evt };
          });

        // Load shift_summary if session is known
        let summary: IShiftSummary | null = null;
        if (shiftSessionId) {
          const summaryDoc = await shiftSummaryRepo.findBySession(shiftSessionId);
          if (summaryDoc) {
            summary = summaryDoc.toJSON() as IShiftSummary;
          }
        }

        setState((prev) => ({
          ...prev,
          step: 'summary',
          summaryEvents: enriched,
          shiftSummary: summary,
          summaryLoading: false,
        }));
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          summaryLoading: false,
          error: err?.message ?? 'Error al cargar resumen del turno',
        }));
      }
    },
    [oeeEventsRepo, conciliationRepo, shiftSummaryRepo],
  );

  const showSummaryView = useCallback(() => {
    setState((prev) => ({ ...prev, step: 'summary' }));
  }, []);

  // ─── Return ─────────────────────────────────────────────────────────────────
  const actions: ConciliationScreenActions = useMemo(
    () => ({
      loadPendingByShift,
      selectForDiagnosis,
      setDiagnosedCode,
      submitDiagnosis,
      selectForFinalization,
      setConciliatedCode,
      setConciliatedMacro,
      setNotes,
      reconcile,
      dispute,
      backToList,
      clearMessages,
      selectForRca,
      setAnalysisMethod,
      setWhy,
      setRootCause,
      addVerdict,
      removeVerdict,
      updateVerdict,
      setCorrectiveAction,
      escalateConciliation,
      submitConciliation,
      proceedToVerdicts,
      proceedToCorrectiveAction,
      loadShiftSummary,
      showSummaryView,
    }),
    [
      loadPendingByShift,
      selectForDiagnosis,
      setDiagnosedCode,
      submitDiagnosis,
      selectForFinalization,
      setConciliatedCode,
      setConciliatedMacro,
      setNotes,
      reconcile,
      dispute,
      backToList,
      clearMessages,
      selectForRca,
      setAnalysisMethod,
      setWhy,
      setRootCause,
      addVerdict,
      removeVerdict,
      updateVerdict,
      setCorrectiveAction,
      escalateConciliation,
      submitConciliation,
      proceedToVerdicts,
      proceedToCorrectiveAction,
      loadShiftSummary,
      showSummaryView,
    ],
  );

  return {
    ...state,
    groupedByMachine,
    actions,
  };
}
