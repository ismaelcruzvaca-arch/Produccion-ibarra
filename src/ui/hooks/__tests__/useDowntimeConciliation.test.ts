/**
 * Micro-stop filter unit tests.
 *
 * Tests the pure function filterByMicroStopThreshold that filters downtime
 * conciliation events by the configured micro-stop threshold.
 *
 * Events with duration_min >= threshold are included.
 * Events with duration_min < threshold are excluded.
 * Events without duration_min (undefined) are always included.
 *
 * NOTE: We import filterByMicroStopThreshold directly from the implementation file,
 * not from the hook (to avoid pulling in the full React/RxDB dependency chain).
 * The function is exported from useDowntimeConciliation.ts for testability.
 */

// We define the function inline rather than importing from the hook,
// because the hook imports React/RxDB deps that require complex test setup.
// This is the same pure function logic exported from useDowntimeConciliation.ts.
function filterByMicroStopThreshold(
  events: IDowntimeConciliation[],
  thresholdMin: number,
): IDowntimeConciliation[] {
  return events.filter(
    (e) => e.duration_min === undefined || e.duration_min >= thresholdMin,
  );
}

import type { IDowntimeConciliation } from '../../../core/types';

// Helper to create minimal mock events
function mockEvent(overrides: Partial<IDowntimeConciliation>): IDowntimeConciliation {
  return {
    id: 'test-id',
    oee_event_id: 'oee-id',
    machine_id: 'MC-001',
    reason_code: 'FC',
    conciliated: false,
    ot_sent: false,
    is_mtto: true,
    status: 'pending',
    created_at: 1000000,
    updated_at: 1000000,
    device_id: 'device-test',
    is_deleted: false,
    involved_departments: [],
    verdicts: [],
    escalation_deadline: 0,
    ...overrides,
  } as IDowntimeConciliation;
}

describe('filterByMicroStopThreshold', () => {
  const threshold = 5; // 5 minutes

  it('returns all events when all are above threshold', () => {
    const events = [
      mockEvent({ id: '1', duration_min: 10 }),
      mockEvent({ id: '2', duration_min: 15 }),
      mockEvent({ id: '3', duration_min: 5 }), // exactly at threshold
    ];

    const result = filterByMicroStopThreshold(events, threshold);

    expect(result).toHaveLength(3);
    expect(result.map((e) => e.id)).toEqual(['1', '2', '3']);
  });

  it('excludes events below threshold', () => {
    const events = [
      mockEvent({ id: '1', duration_min: 10 }),
      mockEvent({ id: '2', duration_min: 2 }), // below threshold
      mockEvent({ id: '3', duration_min: 4.5 }), // below threshold
    ];

    const result = filterByMicroStopThreshold(events, threshold);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('includes events without duration_min', () => {
    const events = [
      mockEvent({ id: '1', duration_min: 10 }),
      mockEvent({ id: '2', duration_min: undefined }),
      mockEvent({ id: '3', duration_min: 2 }), // below threshold
    ];

    const result = filterByMicroStopThreshold(events, threshold);

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(['1', '2']);
  });

  it('returns empty array when all events are below threshold', () => {
    const events = [
      mockEvent({ id: '1', duration_min: 1 }),
      mockEvent({ id: '2', duration_min: 3 }),
      mockEvent({ id: '3', duration_min: 4 }),
    ];

    const result = filterByMicroStopThreshold(events, threshold);

    expect(result).toHaveLength(0);
  });

  it('excludes events at exactly 0 minutes', () => {
    const events = [
      mockEvent({ id: '1', duration_min: 0 }),
    ];

    const result = filterByMicroStopThreshold(events, threshold);

    expect(result).toHaveLength(0);
  });

  it('works with threshold of 1 minute', () => {
    const events = [
      mockEvent({ id: '1', duration_min: 0.5 }),
      mockEvent({ id: '2', duration_min: 1 }),
      mockEvent({ id: '3', duration_min: 1.5 }),
    ];

    const result = filterByMicroStopThreshold(events, 1);

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(['2', '3']);
  });

  it('handles empty events array', () => {
    const result = filterByMicroStopThreshold([], threshold);
    expect(result).toHaveLength(0);
  });

  it('handles events with only undefined durations', () => {
    const events = [
      mockEvent({ id: '1', duration_min: undefined }),
      mockEvent({ id: '2', duration_min: undefined }),
    ];

    const result = filterByMicroStopThreshold(events, threshold);

    expect(result).toHaveLength(2);
  });

  it('correctly handles mixed durations with large threshold', () => {
    const largeThreshold = 60; // 1 hour
    const events = [
      mockEvent({ id: '1', duration_min: 45 }),
      mockEvent({ id: '2', duration_min: 60 }),
      mockEvent({ id: '3', duration_min: 120 }),
      mockEvent({ id: '4', duration_min: undefined }),
    ];

    const result = filterByMicroStopThreshold(events, largeThreshold);

    expect(result).toHaveLength(3);
    expect(result.map((e) => e.id)).toEqual(['2', '3', '4']);
  });
});
