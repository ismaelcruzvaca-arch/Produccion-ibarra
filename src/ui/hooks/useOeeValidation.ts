/**
 * useOeeValidation — centralizes business rules for OEE action availability.
 *
 * Why:
 * - Keeps validation logic in one place instead of scattered across oee.tsx.
 * - Returns both boolean flags and a human-readable message for UI feedback.
 * - Pure computation: no side effects, easy to test.
 */

import { useMemo } from 'react';

export interface OeeValidationResult {
  canStartShift: boolean;
  canStartDowntime: boolean;
  canEndShift: boolean;
  canRegisterProduction: boolean;
  validationMessage: string | null;
}

export interface UseOeeValidationInput {
  lineId: string | null;
  machineId: string | null;
  shiftId: string | null;
  shiftStarted: boolean;
  activeDowntime: boolean;
}

export function useOeeValidation(input: UseOeeValidationInput): OeeValidationResult {
  const { lineId, machineId, shiftId, shiftStarted, activeDowntime } = input;

  const allSelected = !!lineId && !!machineId && !!shiftId;

  return useMemo(() => {
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
    };
  }, [allSelected, shiftStarted, activeDowntime]);
}
