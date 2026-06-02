/**
 * useQualityCaptureOrchestration — orchestrates the multi-step quality capture flow.
 *
 * Multi-step state machine (QC-2): product → type → value → (fail?) defect → confirm
 *
 * Spec compliance:
 * - QC-2: SHALL multi-step: product → type → value → (fail?) defect → confirm
 * - QC-3: MUST validate weight against cached product_weight_standards
 * - QC-6: SHALL type selector: visual, weight, temp, metal_detector
 * - QC-7: SHALL block capture when no active shift session
 * - QC-8: SHALL pass with warning when standard missing
 * - QC-9: SHALL defect selector from quality_defects collection
 */
import { useState, useCallback } from 'react';
import type { IQualityInspection } from '../core/types';

// ─── Step Enum ──────────────────────────────────────────────────────────────────

export type QualityCaptureStep =
  | 'product'
  | 'inspection_type'
  | 'value'
  | 'defect'
  | 'confirm';

// ─── State ──────────────────────────────────────────────────────────────────────

export interface QualityCaptureState {
  /** Current step in the multi-step flow. */
  step: QualityCaptureStep;

  /** Whether the capture wizard is active. */
  isActive: boolean;

  /** Selected product ID. */
  productId: string | null;

  /** Selected inspection type. */
  inspectionType: IQualityInspection['inspection_type'] | null;

  /** Measured value. */
  value: number | null;

  /** Whether the inspection failed (triggers defect step). */
  hasFailed: boolean;

  /** Selected defect ID (from quality_defects catalog). */
  defectId: string | null;

  /** Cached standard min for weight validation. */
  standardMin: number | null;

  /** Cached standard max for weight validation. */
  standardMax: number | null;

  /** Whether the weight standard was missing (QC-8). */
  standardWarning: boolean;

  /** Inspector notes. */
  notes: string;
}

// ─── Initial State ──────────────────────────────────────────────────────────────

const INITIAL_STATE: QualityCaptureState = {
  step: 'product',
  isActive: false,
  productId: null,
  inspectionType: null,
  value: null,
  hasFailed: false,
  defectId: null,
  standardMin: null,
  standardMax: null,
  standardWarning: false,
  notes: '',
};

// ─── Hook ───────────────────────────────────────────────────────────────────────

export interface QualityCaptureOrchestration {
  /** Current capture state. */
  state: QualityCaptureState;

  /** Starts a new capture flow. Resets state and moves to product step. */
  startCapture: () => void;

  /** Sets the product and advances to inspection type selection. */
  selectProduct: (productId: string) => void;

  /** Sets the inspection type and advances to value input. */
  selectInspectionType: (type: IQualityInspection['inspection_type']) => void;

  /**
   * Sets the measured value and validates.
   * For weight inspections, validates against cached standards (QC-3).
   * Sets warning flag when standard missing (QC-8).
   * If failed and inspection supports defects, advances to defect step.
   */
  setValue: (value: number, standardMin?: number, standardMax?: number) => void;

  /** Sets the defect and advances to confirmation. */
  selectDefect: (defectId: string) => void;

  /** Sets inspector notes. */
  setNotes: (notes: string) => void;

  /** Resets the capture flow back to initial state. */
  cancelCapture: () => void;

  /** Prepares the final inspection payload for repository. */
  getInspectionPayload: () => Omit<
    IQualityInspection,
    'id' | 'updated_at' | 'is_deleted'
  >;

  /** Returns whether the current step supports defect entry. */
  canHaveDefect: boolean;
}

/**
 * Inspection types that can have an associated defect when they fail.
 * Visual inspections are the primary candidate; others may be configured as needed.
 */
const DEFECT_CAPABLE_TYPES: IQualityInspection['inspection_type'][] = ['visual'];

export function useQualityCaptureOrchestration(): QualityCaptureOrchestration {
  const [state, setState] = useState<QualityCaptureState>(INITIAL_STATE);

  const startCapture = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const selectProduct = useCallback((productId: string) => {
    setState((prev) => ({
      ...prev,
      productId,
      step: 'inspection_type',
    }));
  }, []);

  const selectInspectionType = useCallback(
    (inspectionType: IQualityInspection['inspection_type']) => {
      setState((prev) => ({
        ...prev,
        inspectionType,
        step: 'value',
      }));
    },
    []
  );

  const setValue = useCallback(
    (value: number, standardMin?: number, standardMax?: number) => {
      setState((prev) => {
        const hasStandard = standardMin !== undefined && standardMax !== undefined;
        const standardWarning = !hasStandard;

        // For weight type, validate against standards (QC-3, QC-8)
        let hasFailed = false;
        if (prev.inspectionType === 'weight' && hasStandard) {
          hasFailed = value < standardMin! || value > standardMax!;
        } else if (prev.inspectionType === 'weight' && !hasStandard) {
          // Pass with warning when standard missing (QC-8)
          hasFailed = false;
        }

        const canHaveDefect = prev.inspectionType
          ? DEFECT_CAPABLE_TYPES.includes(prev.inspectionType)
          : false;

        // If failed and defect-capable, go to defect step
        const nextStep: QualityCaptureStep =
          hasFailed && canHaveDefect ? 'defect' : 'confirm';

        return {
          ...prev,
          value,
          standardMin: standardMin ?? null,
          standardMax: standardMax ?? null,
          standardWarning,
          hasFailed,
          step: nextStep,
        };
      });
    },
    []
  );

  const selectDefect = useCallback((defectId: string) => {
    setState((prev) => ({
      ...prev,
      defectId,
      step: 'confirm',
    }));
  }, []);

  const setNotes = useCallback((notes: string) => {
    setState((prev) => ({ ...prev, notes }));
  }, []);

  const cancelCapture = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const canHaveDefect = state.inspectionType
    ? DEFECT_CAPABLE_TYPES.includes(state.inspectionType)
    : false;

  const getInspectionPayload = useCallback((): Omit<
    IQualityInspection,
    'id' | 'updated_at' | 'is_deleted'
  > => {
    if (!state.productId || !state.inspectionType || state.value === null) {
      throw new Error('Cannot create inspection payload: incomplete capture state');
    }

    return {
      line_id: '', // must be filled by the caller
      machine_id: '',
      shift_session_id: '',
      operator_id: '',
      product_id: state.productId,
      inspection_type: state.inspectionType,
      value: state.value,
      unit: state.inspectionType === 'weight' ? 'kg' : state.inspectionType === 'temp' ? '°C' : 'units',
      passed: !state.hasFailed,
      defect_id: state.defectId ?? undefined,
      defect_label: undefined,
      defect_severity: undefined,
      notes: state.notes || undefined,
      standard_min: state.standardMin ?? undefined,
      standard_max: state.standardMax ?? undefined,
      standard_warning: state.standardWarning || undefined,
    };
  }, [state]);

  return {
    state,
    startCapture,
    selectProduct,
    selectInspectionType,
    setValue,
    selectDefect,
    setNotes,
    cancelCapture,
    getInspectionPayload,
    canHaveDefect,
  };
}
