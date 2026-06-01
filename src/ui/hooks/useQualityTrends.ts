/**
 * useQualityTrends — Orchestration hook for the quality trends screen.
 *
 * Pattern: Hook Extraction (same as useQualityListOrchestration)
 * Why:
 * - Subscribes to 4 RxDB collections via docs$ observables.
 * - Filters in-memory by machine_id + shift_type (weight/defect logs join via inspection_id FK).
 * - Runs pure aggregation functions from qualityTrendsCalculator in useMemo.
 * - Returns { weightTrend, defectsBySeverity, liveQuality, loading, empty }.
 *
 * Data flow:
 *   useQualityTrends(machineId, shiftType)
 *     ├─ useQualityInspectionsRepository → docs$ → filter → computeLiveQuality()
 *     ├─ useWeightLogsRepository → docs$ → filter → aggregateWeightTrend()
 *     ├─ useDefectLogsRepository → docs$ → filter → aggregateDefectsBySeverity()
 *     └─ useProductWeightStandardsRepository → docs$ → reference lines
 */

import { useState, useEffect, useMemo } from 'react';
import type { ShiftType } from '../../core/types';
import type { IQualityInspection, IWeightLog, IDefectLog, IProductWeightStandard } from '../../core/types';
import { useQualityInspectionsRepository } from '../../repositories/useQualityInspectionsRepository';
import { useWeightLogsRepository } from '../../repositories/useWeightLogsRepository';
import { useDefectLogsRepository } from '../../repositories/useDefectLogsRepository';
import { useProductWeightStandardsRepository } from '../../repositories/useProductWeightStandardsRepository';
import {
  aggregateWeightTrend,
  aggregateDefectsBySeverity,
  computeLiveQuality,
} from '../../core/qualityTrendsCalculator';
import type { WeightTrendData, DefectsBySeverity, LiveQuality } from '../../core/qualityTrendsCalculator';

// ─── Public Interface ─────────────────────────────────────────────────────────────

export interface UseQualityTrendsResult {
  weightTrend: WeightTrendData;
  defectsBySeverity: DefectsBySeverity;
  liveQuality: LiveQuality;
  loading: boolean;
  empty: {
    weight: boolean;
    defects: boolean;
    inspections: boolean;
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────────

export function useQualityTrends(
  machineId: string,
  shiftType: ShiftType,
): UseQualityTrendsResult {
  // Repositories
  const inspectionsRepo = useQualityInspectionsRepository();
  const weightLogsRepo = useWeightLogsRepository();
  const defectLogsRepo = useDefectLogsRepository();
  const standardsRepo = useProductWeightStandardsRepository();

  // ─── Raw state from subscriptions ──────────────────────────────────────────────
  const [inspections, setInspections] = useState<IQualityInspection[]>([]);
  const [weightLogs, setWeightLogs] = useState<IWeightLog[]>([]);
  const [defectLogs, setDefectLogs] = useState<IDefectLog[]>([]);
  const [standards, setStandards] = useState<IProductWeightStandard[]>([]);

  // ─── Loading flags per subscription ──────────────────────────────────────────
  const [inspectionsLoaded, setInspectionsLoaded] = useState(false);
  const [weightLogsLoaded, setWeightLogsLoaded] = useState(false);
  const [defectLogsLoaded, setDefectLogsLoaded] = useState(false);
  const [standardsLoaded, setStandardsLoaded] = useState(false);

  // ─── Subscribe to quality_inspections ──────────────────────────────────────────
  const { docs$: inspectionsDocs$ } = inspectionsRepo;
  useEffect(() => {
    const sub = inspectionsDocs$.subscribe((docs) => {
      setInspections(docs.map((d) => d.toJSON() as IQualityInspection));
      setInspectionsLoaded(true);
    });
    return () => sub.unsubscribe();
  }, [inspectionsDocs$]);

  // ─── Subscribe to weight_logs ──────────────────────────────────────────────────
  const { docs$: weightDocs$ } = weightLogsRepo;
  useEffect(() => {
    const sub = weightDocs$.subscribe((docs) => {
      setWeightLogs(docs.map((d) => d.toJSON() as IWeightLog));
      setWeightLogsLoaded(true);
    });
    return () => sub.unsubscribe();
  }, [weightDocs$]);

  // ─── Subscribe to defect_logs ──────────────────────────────────────────────────
  const { docs$: defectDocs$ } = defectLogsRepo;
  useEffect(() => {
    const sub = defectDocs$.subscribe((docs) => {
      setDefectLogs(docs.map((d) => d.toJSON() as IDefectLog));
      setDefectLogsLoaded(true);
    });
    return () => sub.unsubscribe();
  }, [defectDocs$]);

  // ─── Subscribe to product_weight_standards ─────────────────────────────────────
  const { docs$: standardsDocs$ } = standardsRepo;
  useEffect(() => {
    const sub = standardsDocs$.subscribe((docs) => {
      setStandards(docs.map((d) => d.toJSON() as IProductWeightStandard));
      setStandardsLoaded(true);
    });
    return () => sub.unsubscribe();
  }, [standardsDocs$]);

  // ─── Filter inspections by machine + shift ─────────────────────────────────────
  const filteredInspections = useMemo(() => {
    return inspections.filter(
      (i) => i.machine_id === machineId && i.shift_type === shiftType,
    );
  }, [inspections, machineId, shiftType]);

  // ─── Extract inspection IDs for join ───────────────────────────────────────────
  const inspectionIds = useMemo(() => {
    return new Set(filteredInspections.map((i) => i.id));
  }, [filteredInspections]);

  // ─── Filter weight logs by inspection IDs ──────────────────────────────────────
  const filteredWeightLogs = useMemo(() => {
    return weightLogs.filter((w) => inspectionIds.has(w.inspection_id));
  }, [weightLogs, inspectionIds]);

  // ─── Filter defect logs by inspection IDs ──────────────────────────────────────
  const filteredDefectLogs = useMemo(() => {
    return defectLogs.filter((d) => inspectionIds.has(d.inspection_id));
  }, [defectLogs, inspectionIds]);

  // ─── Pure aggregations (useMemo) ───────────────────────────────────────────────
  const weightTrend = useMemo(
    () => aggregateWeightTrend(filteredWeightLogs, standards),
    [filteredWeightLogs, standards],
  );

  const defectsBySeverity = useMemo(
    () => aggregateDefectsBySeverity(filteredDefectLogs),
    [filteredDefectLogs],
  );

  const liveQuality = useMemo(
    () => computeLiveQuality(filteredInspections),
    [filteredInspections],
  );

  // ─── Derived state ─────────────────────────────────────────────────────────────
  const loading = !(
    inspectionsLoaded &&
    weightLogsLoaded &&
    defectLogsLoaded &&
    standardsLoaded
  );

  const empty = {
    weight: filteredWeightLogs.length === 0,
    defects: filteredDefectLogs.length === 0,
    inspections: filteredInspections.length === 0,
  };

  return {
    weightTrend,
    defectsBySeverity,
    liveQuality,
    loading,
    empty,
  };
}
