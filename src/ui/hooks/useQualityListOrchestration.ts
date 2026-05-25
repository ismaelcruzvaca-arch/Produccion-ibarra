/**
 * useQualityListOrchestration — Orchestrates state for the Quality Inspections list screen.
 *
 * Pattern: Hook Extraction (Container/Presentational)
 * Why:
 * - Subscribes to docs$ for reactive list updates.
 * - Filters by selected machine, shows disposition badges.
 * - Post-reconciliation: no more inspection_type filter chips.
 *
 * Returns:
 * - inspections: IQualityInspection[] — filtered by machine, sorted DESC by updated_at
 * - loading: boolean — initial load state
 * - error: string | null
 * - refresh: () => Promise<void> — reloads inspections
 */

import { useState, useEffect, useCallback } from 'react';

import { useQualityInspectionsRepository } from '../../repositories/useQualityInspectionsRepository';
import { useCatalogStore } from '../store/catalogStore';
import type { IQualityInspection } from '../../core/types';

export function useQualityListOrchestration() {
  const inspectionsRepo = useQualityInspectionsRepository();

  const selectedMachine = useCatalogStore((s) => s.selectedMachine);

  // ─── Data state ─────────────────────────────────────────────────────────────
  const [inspections, setInspections] = useState<IQualityInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Subscribe to inspections ───────────────────────────────────────────────
  const { docs$ } = inspectionsRepo;

  useEffect(() => {
    const subscription = docs$.subscribe((docs) => {
      const raw = docs.map((doc) => doc.toJSON() as IQualityInspection);
      setInspections(raw);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [docs$]);

  // ─── Filtered inspections ───────────────────────────────────────────────────
  const filteredInspections = inspections
    .filter((i) => {
      // Only show inspections for the current machine
      if (selectedMachine && i.machine_id !== selectedMachine) return false;
      return true;
    })
    .sort((a, b) => b.updated_at - a.updated_at);

  // ─── Refresh ────────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    // docs$ subscription will re-emit on next change
    setTimeout(() => setLoading(false), 500);
  }, []);

  return {
    inspections: filteredInspections,
    loading,
    error,
    refresh,
  } as const;
}
