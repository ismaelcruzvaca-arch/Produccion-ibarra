/**
 * useQualityListOrchestration — orchestrates the quality inspections list screen.
 *
 * Spec compliance:
 * - QC-1: MUST display inspections for active shift, timestamp DESC
 * - QC-5: MUST read-only detail with all fields
 * - QC-10: MUST pass/fail chip per inspection card
 * - QC-11: SHOULD pull-to-refresh offline resilient
 * - QC-12: SHALL empty state CTA when no inspections
 */
import { useState, useEffect, useCallback } from 'react';
import type { RxDocument } from 'rxdb';

import { useQualityInspectionsRepository } from '../repositories/useQualityInspectionsRepository';
import type { IQualityInspection } from '../core/types';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface QualityListState {
  /** List of inspections for the active shift session. */
  inspections: IQualityInspection[];

  /** Whether data is currently being loaded. */
  isLoading: boolean;

  /** Whether a refresh is in progress. */
  isRefreshing: boolean;

  /** Error message, if any. */
  error: string | null;

  /** Last time data was fetched (epoch ms). */
  lastUpdated: number | null;
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export interface QualityListOrchestration {
  /** Current list state. */
  state: QualityListState;

  /** Loads inspections for the given shift session (QC-1). */
  loadInspections: (shiftSessionId: string) => Promise<void>;

  /** Pull-to-refresh handler — reloads inspections for the current shift (QC-11). */
  refreshInspections: (shiftSessionId: string) => Promise<void>;
}

export function useQualityListOrchestration(): QualityListOrchestration {
  const repository = useQualityInspectionsRepository();

  const [state, setState] = useState<QualityListState>({
    inspections: [],
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastUpdated: null,
  });

  const loadInspections = useCallback(
    async (shiftSessionId: string) => {
      if (!shiftSessionId) {
        setState((prev) => ({
          ...prev,
          inspections: [],
          isLoading: false,
          error: 'No hay sesión de turno activa',
        }));
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const docs = await repository.findByShiftSession(shiftSessionId);
        const inspections = docs.map((doc: RxDocument<IQualityInspection>) =>
          doc.toJSON()
        ) as IQualityInspection[];

        setState({
          inspections,
          isLoading: false,
          isRefreshing: false,
          error: null,
          lastUpdated: Date.now(),
        });
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isRefreshing: false,
          error: err?.message ?? 'Error al cargar inspecciones',
        }));
      }
    },
    [repository]
  );

  const refreshInspections = useCallback(
    async (shiftSessionId: string) => {
      setState((prev) => ({ ...prev, isRefreshing: true }));

      try {
        const docs = await repository.findByShiftSession(shiftSessionId);
        const inspections = docs.map((doc: RxDocument<IQualityInspection>) =>
          doc.toJSON()
        ) as IQualityInspection[];

        setState({
          inspections,
          isLoading: false,
          isRefreshing: false,
          error: null,
          lastUpdated: Date.now(),
        });
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          isRefreshing: false,
          error: err?.message ?? 'Error al refrescar inspecciones',
        }));
      }
    },
    [repository]
  );

  return {
    state,
    loadInspections,
    refreshInspections,
  };
}
