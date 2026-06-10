/**
 * useProductionFlow — Simplified Zustand store for active shift context.
 *
 * Pattern: Zustand store (singleton)
 * Why:
 * - shift_session_id is the backbone connector between modules (design decision 3).
 * - No wizard steps — just active shift + selected machine context.
 * - selectedMachineId already lives in catalogStore; this store only holds
 *   shift-related state to avoid duplication.
 *
 * Interface:
 *   ProductionFlowState:
 *     shiftSessionId  — UUID of the active shift session (null if none)
 *     isShiftActive   — derived boolean (shiftSessionId !== null)
 *     isLoading       — true while checking for active session on mount
 *
 * Actions:
 *   startShift(sessionId) — sets shiftSessionId
 *   endShift()            — clears shiftSessionId
 *   reset()               — clears all state (sign-out, error recovery)
 *   checkActiveSession()  — queries RxDB for any active session on mount
 */

import { create } from 'zustand';

export interface ProductionFlowState {
  shiftSessionId: string | null;
  isShiftActive: boolean;
  isLoading: boolean;
}

export interface ProductionFlowActions {
  startShift: (sessionId: string) => void;
  endShift: () => void;
  reset: () => void;
}

type ProductionFlowStore = ProductionFlowState & ProductionFlowActions;

export const useProductionFlow = create<ProductionFlowStore>((set) => ({
  shiftSessionId: null,
  isShiftActive: false,
  isLoading: true,

  startShift: (sessionId: string) => {
    set({ shiftSessionId: sessionId, isShiftActive: true, isLoading: false });
  },

  endShift: () => {
    set({ shiftSessionId: null, isShiftActive: false, isLoading: false });
  },

  reset: () => {
    set({ shiftSessionId: null, isShiftActive: false, isLoading: false });
  },
}));
