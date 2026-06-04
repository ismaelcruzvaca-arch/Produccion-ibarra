/**
 * Pure quality trend calculator — aggregation functions for weight trends, defect severity,
 * and live quality percentage.
 *
 * Pattern: Pure Exported Functions (matches computeOee in oeeCalculator.ts)
 * Why: Separated from React lifecycle — testable, portable, no RxDB/RxJS imports.
 */

import type { IWeightLog, IDefectLog, IQualityInspection, IProductWeightStandard } from './types';
import { TREND_SAMPLE_COUNT } from '../config/qualityLimits';

// ─── Interfaces ──────────────────────────────────────────────────────────────────

export interface WeightTrendData {
  labels: string[];          // e.g. ["10:15", "10:20", ...]
  datasets: [{ data: number[] }];
  referenceLines: { min: number; max: number };
}

export interface DefectsBySeverity {
  critical: number;
  major: number;
  minor: number;
}

export interface LiveQuality {
  passed: number;     // liberado count
  failed: number;     // rechazado count
  rework: number;     // reproceso count
  total: number;
  qualityPct: number; // (passed / total) * 100, 0 if total === 0
}

// ─── Pure Functions ──────────────────────────────────────────────────────────────

/**
 * Aggregates weight logs into a line chart data format.
 * Sorts by updated_at ascending, takes the last TREND_SAMPLE_COUNT logs,
 * formats timestamps as HH:mm labels, and extracts reference lines from
 * the first product weight standard.
 */
export function aggregateWeightTrend(
  weightLogs: IWeightLog[],
  standards: IProductWeightStandard[],
): WeightTrendData {
  const active = weightLogs.filter((w) => !w.is_deleted);

  if (active.length === 0) {
    return {
      labels: [],
      datasets: [{ data: [] }],
      referenceLines: { min: 0, max: 0 },
    };
  }

  // Sort by updated_at ascending, take last TREND_SAMPLE_COUNT
  const sorted = [...active]
    .sort((a, b) => a.updated_at - b.updated_at)
    .slice(-TREND_SAMPLE_COUNT);

  const labels = sorted.map((w) => {
    const d = new Date(w.updated_at);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  const data = sorted.map((w) => w.measured_weight);

  // Extract reference lines from the first available standard
  const firstStd = standards.find((s) => !s.is_deleted);
  const referenceLines = firstStd
    ? { min: firstStd.lower_limit, max: firstStd.upper_limit }
    : { min: 0, max: 0 };

  return {
    labels,
    datasets: [{ data }],
    referenceLines,
  };
}

/**
 * Aggregates defect logs by severity (critical / major / minor).
 * Returns counts per severity, all 0 if array is empty.
 */
export function aggregateDefectsBySeverity(defectLogs: IDefectLog[]): DefectsBySeverity {
  const active = defectLogs.filter((d) => !d.is_deleted);

  return {
    critical: active.filter((d) => d.severity === 'critical').length,
    major: active.filter((d) => d.severity === 'major').length,
    minor: active.filter((d) => d.severity === 'minor').length,
  };
}

/**
 * Computes live quality percentage from inspections.
 *   qualityPct = (liberado / total) * 100
 * Returns 0 if total is 0 (avoids division by zero).
 * 'pending' dispositions count toward total but not passed/failed/rework.
 */
export function computeLiveQuality(inspections: IQualityInspection[]): LiveQuality {
  const active = inspections.filter((i) => !i.is_deleted);

  const passed = active.filter((i) => i.disposition === 'liberado').length;
  const failed = active.filter((i) => i.disposition === 'rechazado').length;
  const rework = active.filter((i) => i.disposition === 'reproceso').length;
  const total = active.length;
  const qualityPct = total > 0 ? (passed / total) * 100 : 0;

  return { passed, failed, rework, total, qualityPct };
}
