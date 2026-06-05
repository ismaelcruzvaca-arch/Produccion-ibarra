/**
 * Unit tests for qualityTrendsCalculator — pure aggregation functions.
 *
 * Pattern: Pure function tests (matches oeeCalculator.test.ts)
 * - Factory functions for mock data
 * - No external mocks — plain data in, plain data out
 * - it('describes scenario') naming style
 */

import {
  aggregateWeightTrend,
  aggregateDefectsBySeverity,
  computeLiveQuality,
} from '../qualityTrendsCalculator';
import type { IWeightLog, IDefectLog, IQualityInspection, IProductWeightStandard } from '../types';

// ─── Factory Functions ───────────────────────────────────────────────────────────

const weightLog = (
  timestamp: number,
  measured_weight: number,
  overrides: Partial<IWeightLog> = {},
): IWeightLog => ({
  id: `wl-${timestamp}`,
  inspection_id: 'insp-1',
  measured_weight,
  created_at: timestamp,
  updated_at: timestamp,
  device_id: 'device-1',
  is_deleted: false,
  ...overrides,
} as IWeightLog);

const defectLog = (
  severity: 'critical' | 'major' | 'minor',
  overrides: Partial<IDefectLog> = {},
): IDefectLog => ({
  id: `dl-${severity}-${Math.random()}`,
  inspection_id: 'insp-1',
  severity,
  defect_type: 'grieta',
  defect_count: 1,
  created_at: 1000,
  updated_at: 1000,
  device_id: 'device-1',
  is_deleted: false,
  ...overrides,
} as IDefectLog);

const inspection = (
  disposition: 'liberado' | 'rechazado' | 'reproceso',
  overrides: Partial<IQualityInspection> = {},
): IQualityInspection => ({
  id: `insp-${Math.random()}`,
  machine_id: 'MACH-DEMO-01',
  inspector_id: 'inspector-1',
  shift_type: 'matutino',
  disposition,
  data_source: 'manual',
  created_at: 1000,
  updated_at: 1000,
  device_id: 'device-1',
  is_deleted: false,
  inspection_type: 'visual',
  passed: disposition === 'liberado',
  value: 0,
  unit: '',
  product_id: '',
  line_id: '',
  shift_session_id: '',
  operator_id: 'inspector-1',
  ...overrides,
} as IQualityInspection);

const weightStandard = (
  overrides: Partial<IProductWeightStandard> = {},
): IProductWeightStandard => ({
  sku: 'SKU-001',
  name: 'Chocolate Ibarra 250g',
  lower_limit: 245,
  upper_limit: 255,
  requires_tare: false,
  created_at: 1000,
  updated_at: 1000,
  device_id: 'device-1',
  is_deleted: false,
  ...overrides,
} as IProductWeightStandard);

// ═══════════════════════════════════════════════════════════════════════════════
// aggregateWeightTrend
// ═══════════════════════════════════════════════════════════════════════════════

describe('aggregateWeightTrend', () => {
  it('returns correct labels and data points for 20 weight logs', () => {
    const now = Date.now();
    const logs = Array.from({ length: 20 }, (_, i) =>
      weightLog(now + i * 60_000, 250 + i),
    );
    const standards = [weightStandard()];

    const result = aggregateWeightTrend(logs, standards);

    expect(result.labels).toHaveLength(20);
    expect(result.datasets[0].data).toHaveLength(20);
    // Data should be sorted ascending by timestamp
    expect(result.datasets[0].data[0]).toBe(250);
    expect(result.datasets[0].data[19]).toBe(269);
  });

  it('sets reference lines from product weight standard', () => {
    const logs = [weightLog(1000, 250)];
    const standards = [weightStandard({ lower_limit: 240, upper_limit: 260 })];

    const result = aggregateWeightTrend(logs, standards);

    expect(result.referenceLines.min).toBe(240);
    expect(result.referenceLines.max).toBe(260);
  });

  it('truncates to last 20 when more logs are provided', () => {
    const now = Date.now();
    const logs = Array.from({ length: 25 }, (_, i) =>
      weightLog(now + i * 60_000, 250),
    );
    const standards = [weightStandard()];

    const result = aggregateWeightTrend(logs, standards);

    // Should only have 20 data points (last 20 of 25)
    expect(result.labels).toHaveLength(20);
    expect(result.datasets[0].data).toHaveLength(20);
  });

  it('returns empty labels/datasets when no weight logs', () => {
    const result = aggregateWeightTrend([], [weightStandard()]);

    expect(result.labels).toHaveLength(0);
    expect(result.datasets[0].data).toHaveLength(0);
    expect(result.referenceLines).toEqual({ min: 0, max: 0 });
  });

  it('handles single weight log', () => {
    const logs = [weightLog(1000, 252)];
    const standards = [weightStandard()];

    const result = aggregateWeightTrend(logs, standards);

    expect(result.labels).toHaveLength(1);
    expect(result.datasets[0].data).toEqual([252]);
    expect(result.referenceLines.min).toBe(245);
    expect(result.referenceLines.max).toBe(255);
  });

  it('handles missing product standard (no reference lines / zero fallback)', () => {
    const logs = [weightLog(1000, 250)];

    const result = aggregateWeightTrend(logs, []);

    expect(result.datasets[0].data).toEqual([250]);
    expect(result.referenceLines).toEqual({ min: 0, max: 0 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// aggregateDefectsBySeverity
// ═══════════════════════════════════════════════════════════════════════════════

describe('aggregateDefectsBySeverity', () => {
  it('counts critical/major/minor correctly with mixed data', () => {
    const logs = [
      defectLog('critical'),
      defectLog('critical'),
      defectLog('major'),
      defectLog('minor'),
      defectLog('minor'),
      defectLog('minor'),
    ];

    const result = aggregateDefectsBySeverity(logs);

    expect(result.critical).toBe(2);
    expect(result.major).toBe(1);
    expect(result.minor).toBe(3);
  });

  it('returns all zeros for empty array', () => {
    const result = aggregateDefectsBySeverity([]);

    expect(result.critical).toBe(0);
    expect(result.major).toBe(0);
    expect(result.minor).toBe(0);
  });

  it('handles only one severity present', () => {
    const logs = [
      defectLog('major'),
      defectLog('major'),
      defectLog('major'),
    ];

    const result = aggregateDefectsBySeverity(logs);

    expect(result.critical).toBe(0);
    expect(result.major).toBe(3);
    expect(result.minor).toBe(0);
  });

  it('handles zero counts for all severities (should return 0s)', () => {
    // Empty array — all zeros
    const result = aggregateDefectsBySeverity([]);

    expect(result.critical).toBe(0);
    expect(result.major).toBe(0);
    expect(result.minor).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// computeLiveQuality
// ═══════════════════════════════════════════════════════════════════════════════

describe('computeLiveQuality', () => {
  it('mixed dispositions → 80% quality (8 liberado, 2 rechazado)', () => {
    const inspections = [
      ...Array.from({ length: 8 }, () => inspection('liberado')),
      ...Array.from({ length: 2 }, () => inspection('rechazado')),
    ];

    const result = computeLiveQuality(inspections);

    expect(result.passed).toBe(8);
    expect(result.failed).toBe(2);
    expect(result.rework).toBe(0);
    expect(result.total).toBe(10);
    expect(result.qualityPct).toBe(80);
  });

  it('all liberado → 100%', () => {
    const inspections = Array.from({ length: 5 }, () => inspection('liberado'));

    const result = computeLiveQuality(inspections);

    expect(result.passed).toBe(5);
    expect(result.failed).toBe(0);
    expect(result.total).toBe(5);
    expect(result.qualityPct).toBe(100);
  });

  it('all rechazado → 0%', () => {
    const inspections = Array.from({ length: 3 }, () => inspection('rechazado'));

    const result = computeLiveQuality(inspections);

    expect(result.passed).toBe(0);
    expect(result.failed).toBe(3);
    expect(result.total).toBe(3);
    expect(result.qualityPct).toBe(0);
  });

  it('empty inspections → qualityPct = 0', () => {
    const result = computeLiveQuality([]);

    expect(result.passed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.rework).toBe(0);
    expect(result.total).toBe(0);
    expect(result.qualityPct).toBe(0);
  });

  it('includes reproceso in total but not in passed count', () => {
    const inspections = [
      inspection('liberado'),
      inspection('liberado'),
      inspection('reproceso'),
      inspection('rechazado'),
    ];

    const result = computeLiveQuality(inspections);

    expect(result.passed).toBe(2);
    expect(result.rework).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.total).toBe(4);
    expect(result.qualityPct).toBe(50);
  });

  it('zero total → qualityPct = 0 (avoid division by zero)', () => {
    const result = computeLiveQuality([]);

    expect(result.qualityPct).toBe(0);
  });
});
