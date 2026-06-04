/**
 * useOeeValidation — centralizes business rules for OEE action availability.
 *
 * Why:
 * - Keeps validation logic in one place instead of scattered across oee.tsx.
 * - Returns both boolean flags and a human-readable message for UI feedback.
 * - Pure computation: no side effects, easy to test.
 *
 * Two APIs:
 * 1. Explicit input: useOeeValidation({ lineId, machineId, shiftId, shiftStarted, activeDowntime })
 * 2. Convenience (reads from catalogStore): useOeeValidation()
 */

import { useMemo } from 'react';
import { useCatalogStore } from '../store/catalogStore';

export interface OeeValidationResult {
  canStartShift: boolean;
  canStartDowntime: boolean;
  canEndShift: boolean;
  canRegisterProduction: boolean;
  validationMessage: string | null;
  /** Backward-compatible: true when all selections made */
  isValid: boolean;
  /** Backward-compatible: message when not valid */
  message: string | null;
}

export interface UseOeeValidationInput {
  lineId: string | null;
  machineId: string | null;
  shiftId: string | null;
  shiftStarted: boolean;
  activeDowntime: boolean;
}

function computeValidation(input: UseOeeValidationInput): OeeValidationResult {
  const { lineId, machineId, shiftId, shiftStarted, activeDowntime } = input;
  const allSelected = !!lineId && !!machineId && !!shiftId;

  const canStartShift = allSelected && !shiftStarted;
  const canStartDowntime = shiftStarted && !activeDowntime;
  const canEndShift = shiftStarted && !activeDowntime;
  const canRegisterProduction = shiftStarted && !activeDowntime && allSelected;

  let validationMessage: string | null = null;
  if (!shiftStarted) {
    if (!allSelected) {
      validationMessage = 'Seleccione línea, máquina y turno para iniciar';
    }
  } else if (activeDowntime) {
    validationMessage = 'Cierre el paro activo antes de continuar';
  }

  return {
    canStartShift,
    canStartDowntime,
    canEndShift,
    canRegisterProduction,
    validationMessage,
    isValid: canStartShift || canEndShift || canRegisterProduction,
    message: validationMessage,
  };
}

/**
 * Explicit input version — pure computation, no store dependency.
 * Use this when validation depends on external state (e.g., from a hook).
 */
export function useOeeValidation(input: UseOeeValidationInput): OeeValidationResult;
/**
 * Convenience version — reads selections from catalogStore automatically.
 * Use this in simple selector bars and screen components.
 */
export function useOeeValidation(): OeeValidationResult;
export function useOeeValidation(input?: UseOeeValidationInput): OeeValidationResult {
  const lineId = useCatalogStore((state) => state.selectedLine);
  const machineId = useCatalogStore((state) => state.selectedMachine);
  const shiftId = useCatalogStore((state) => state.selectedShift);

  const effectiveInput: UseOeeValidationInput = input ?? {
    lineId,
    machineId,
    shiftId,
    shiftStarted: false,
    activeDowntime: false,
  };

  return useMemo(() => computeValidation(effectiveInput), [
    effectiveInput.lineId,
    effectiveInput.machineId,
    effectiveInput.shiftId,
    effectiveInput.shiftStarted,
    effectiveInput.activeDowntime,
  ]);
}
