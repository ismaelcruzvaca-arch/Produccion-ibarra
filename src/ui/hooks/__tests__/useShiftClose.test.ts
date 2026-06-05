/**
 * Pure function unit tests for useShiftClose helpers.
 *
 * Pattern: pure functions, plain data, no mocks.
 * Functions are defined inline (same logic as useShiftClose.ts)
 * to avoid pulling in the hook's React/RxDB dependency chain.
 *
 * Tests:
 * - buildStopPairs: matching start/end pairs, unmatched starts, orphaned ends
 * - calculateSummary: planned vs actual vs rejects vs unexplained
 * - getInvolvedDepartments: reason codes → departments
 * - countReasonCodes: recurrence detection
 */

import type { IOeeEvent } from '../../../core/types';

// ─── Types (mirrored from useShiftClose.ts for test independence) ──────────────

interface StopPair {
  start: IOeeEvent;
  end?: IOeeEvent;
  durationMin: number;
  requiresConciliation: boolean;
  requiresRca: boolean;
  involvedDepartments: string[];
}

interface ProductionSummary {
  plannedBoxes: number;
  actualBoxes: number;
  totalRejects: number;
  unexplainedBoxes: number;
  totalPlannedMin: number;
  totalDowntimeMin: number;
}

// ─── Helper Functions (inlined from useShiftClose.ts) ─────────────────────────

function buildStopPairs(events: IOeeEvent[]): StopPair[] {
  const startEvents = events.filter((e) => e.event_type === 'downtime_start');
  const endEvents = events.filter((e) => e.event_type === 'downtime_end');

  const endByRelated = new Map<string, IOeeEvent>();
  for (const end of endEvents) {
    if (end.related_event_id) {
      endByRelated.set(end.related_event_id, end);
    }
  }

  return startEvents
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((start) => {
      const end = endByRelated.get(start.id);
      const durationMin = end
        ? Math.round((end.timestamp - start.timestamp) / 60000)
        : 0;
      return { start, end, durationMin, requiresConciliation: false, requiresRca: false, involvedDepartments: [] };
    });
}

function calculateSummary(
  events: IOeeEvent[],
  session: { planned_boxes?: number; started_at: number; ended_at?: number } | null,
): ProductionSummary {
  let actualBoxes = 0;
  let totalRejects = 0;
  let totalDowntimeMin = 0;

  for (const evt of events) {
    if (evt.event_type === 'box_count') {
      actualBoxes += evt.quantity ?? 0;
    } else if (evt.event_type === 'reject_count') {
      totalRejects += evt.quantity ?? 0;
    }
  }

  const stops = buildStopPairs(events);
  for (const stop of stops) {
    totalDowntimeMin += stop.durationMin;
  }

  const plannedBoxes = session?.planned_boxes ?? 0;
  const unexplainedBoxes = Math.max(0, plannedBoxes - actualBoxes - totalRejects);

  const totalPlannedMin = session
    ? Math.round(((session.ended_at ?? Date.now()) - session.started_at) / 60000)
    : 0;

  return {
    plannedBoxes,
    actualBoxes,
    totalRejects,
    unexplainedBoxes,
    totalPlannedMin,
    totalDowntimeMin,
  };
}

function getInvolvedDepartments(
  reasonCode: string,
  deptReasonCodes: Record<string, string[]>,
): string[] {
  const depts: string[] = [];
  for (const [dept, codes] of Object.entries(deptReasonCodes)) {
    if (codes.includes(reasonCode)) {
      depts.push(dept);
    }
  }
  return depts;
}

function countReasonCodes(stops: StopPair[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const stop of stops) {
    const code = stop.start.reason_code;
    if (code) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  return counts;
}

// ─── Factory helpers ───────────────────────────────────────────────────────────

function mockEvent(overrides: Partial<IOeeEvent> & { id: string; event_type: string; timestamp: number }): IOeeEvent {
  return {
    line_id: 'L1',
    machine_id: 'MC-001',
    shift_id: 'shift-1',
    reason_code: overrides.reason_code,
    quantity: overrides.quantity,
    related_event_id: overrides.related_event_id,
    created_at: 1000000,
    updated_at: 1000000,
    is_deleted: false,
    ...overrides,
  };
}

function mockStartEvent(id: string, timestamp: number, reasonCode?: string, relatedEventId?: string): IOeeEvent {
  return mockEvent({ id, event_type: 'downtime_start', timestamp, reason_code: reasonCode, related_event_id: relatedEventId });
}

function mockEndEvent(id: string, timestamp: number, relatedEventId: string): IOeeEvent {
  return mockEvent({ id, event_type: 'downtime_end', timestamp, related_event_id: relatedEventId });
}

// ═══════════════════════════════════════════════════════════════════════════════
// buildStopPairs
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildStopPairs', () => {
  it('matches start/end pairs and computes duration', () => {
    const events = [
      mockStartEvent('start-1', 1000000),
      mockEndEvent('end-1', 1060000, 'start-1'), // 1 minute later
    ];

    const result = buildStopPairs(events);

    expect(result).toHaveLength(1);
    expect(result[0].start.id).toBe('start-1');
    expect(result[0].end?.id).toBe('end-1');
    expect(result[0].durationMin).toBe(1);
  });

  it('returns duration 0 for start without matching end (unmatched start)', () => {
    const events = [
      mockStartEvent('start-1', 1000000),
    ];

    const result = buildStopPairs(events);

    expect(result).toHaveLength(1);
    expect(result[0].end).toBeUndefined();
    expect(result[0].durationMin).toBe(0);
  });

  it('ignores end events without matching start (orphaned ends)', () => {
    const events = [
      mockStartEvent('start-1', 1000000),
      mockEndEvent('end-1', 1060000, 'nonexistent-start'),
    ];

    const result = buildStopPairs(events);

    expect(result).toHaveLength(1);
    expect(result[0].start.id).toBe('start-1');
    expect(result[0].end).toBeUndefined();
    expect(result[0].durationMin).toBe(0);
  });

  it('sorts start events by timestamp ascending', () => {
    const events = [
      mockStartEvent('start-3', 3000000),
      mockStartEvent('start-1', 1000000),
      mockStartEvent('start-2', 2000000),
    ];

    const result = buildStopPairs(events);

    expect(result).toHaveLength(3);
    expect(result[0].start.id).toBe('start-1');
    expect(result[1].start.id).toBe('start-2');
    expect(result[2].start.id).toBe('start-3');
  });

  it('computes duration as whole minutes (rounded)', () => {
    const events = [
      mockStartEvent('start-1', 1000000),
      mockEndEvent('end-1', 1005000, 'start-1'), // 5 seconds → should round to 0
    ];

    const result = buildStopPairs(events);

    expect(result[0].durationMin).toBe(0);
  });

  it('computes duration correctly for multi-minute gaps', () => {
    const events = [
      mockStartEvent('start-1', 1000000),
      mockEndEvent('end-1', 1600000, 'start-1'), // 10 minutes
    ];

    const result = buildStopPairs(events);

    expect(result[0].durationMin).toBe(10);
  });

  it('returns empty array when no events', () => {
    const result = buildStopPairs([]);

    expect(result).toHaveLength(0);
  });

  it('returns empty array when no start events (only ends)', () => {
    const events = [
      mockEndEvent('end-1', 1060000, 'start-1'),
    ];

    const result = buildStopPairs(events);

    expect(result).toHaveLength(0);
  });

  it('handles multiple start/end pairs correctly', () => {
    const events = [
      mockStartEvent('start-1', 1000000, 'FC'),
      mockEndEvent('end-1', 1060000, 'start-1'),
      mockStartEvent('start-2', 1100000, 'MC'),
      mockEndEvent('end-2', 1160000, 'start-2'),
      mockStartEvent('start-3', 1200000, 'FS'),
      // start-3 has no end
    ];

    const result = buildStopPairs(events);

    expect(result).toHaveLength(3);
    expect(result[0].durationMin).toBe(1);
    expect(result[0].start.id).toBe('start-1');
    expect(result[1].durationMin).toBe(1);
    expect(result[1].start.id).toBe('start-2');
    expect(result[2].durationMin).toBe(0);
    expect(result[2].start.id).toBe('start-3');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// calculateSummary
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculateSummary', () => {
  it('computes planned vs actual vs rejects vs unexplained', () => {
    const events = [
      mockEvent({ id: 'e1', event_type: 'box_count', timestamp: 1000000, quantity: 100 }),
      mockEvent({ id: 'e2', event_type: 'box_count', timestamp: 1100000, quantity: 200 }),
      mockEvent({ id: 'e3', event_type: 'reject_count', timestamp: 1200000, quantity: 5 }),
    ];
    const session = { planned_boxes: 350, started_at: 0, ended_at: 3600000 };

    const result = calculateSummary(events, session);

    expect(result.plannedBoxes).toBe(350);
    expect(result.actualBoxes).toBe(300);
    expect(result.totalRejects).toBe(5);
    expect(result.unexplainedBoxes).toBe(45); // 350 - 300 - 5
    expect(result.totalPlannedMin).toBe(60);  // (3600000 - 0) / 60000
    expect(result.totalDowntimeMin).toBe(0);  // no stops
  });

  it('includes stop durations in totalDowntimeMin', () => {
    const events = [
      mockEvent({ id: 'e1', event_type: 'box_count', timestamp: 1000000, quantity: 100 }),
      mockStartEvent('start-1', 2000000),
      mockEndEvent('end-1', 2600000, 'start-1'), // 10 min
    ];
    const session = { planned_boxes: 200, started_at: 0, ended_at: 3600000 };

    const result = calculateSummary(events, session);

    expect(result.actualBoxes).toBe(100);
    expect(result.totalDowntimeMin).toBe(10);
    expect(result.unexplainedBoxes).toBe(100); // 200 - 100 - 0
  });

  it('returns zeroes when session is null', () => {
    const events = [
      mockEvent({ id: 'e1', event_type: 'box_count', timestamp: 1000000, quantity: 50 }),
    ];

    const result = calculateSummary(events, null);

    expect(result.plannedBoxes).toBe(0);
    expect(result.actualBoxes).toBe(50);
    expect(result.totalRejects).toBe(0);
    expect(result.unexplainedBoxes).toBe(0); // max(0, 0 - 50 - 0) = 0
    expect(result.totalPlannedMin).toBe(0);
    expect(result.totalDowntimeMin).toBe(0);
  });

  it('clamps unexplainedBoxes to 0 when negative', () => {
    const events = [
      mockEvent({ id: 'e1', event_type: 'box_count', timestamp: 1000000, quantity: 500 }),
    ];
    const session = { planned_boxes: 100, started_at: 0, ended_at: 3600000 };

    const result = calculateSummary(events, session);

    expect(result.unexplainedBoxes).toBe(0); // max(0, 100 - 500 - 0) = 0
  });

  it('handles events with undefined quantity gracefully', () => {
    const events = [
      mockEvent({ id: 'e1', event_type: 'box_count', timestamp: 1000000, quantity: undefined }),
      mockEvent({ id: 'e2', event_type: 'reject_count', timestamp: 1100000, quantity: undefined }),
    ];
    const session = { planned_boxes: 100, started_at: 0, ended_at: 3600000 };

    const result = calculateSummary(events, session);

    expect(result.actualBoxes).toBe(0);
    expect(result.totalRejects).toBe(0);
    expect(result.unexplainedBoxes).toBe(100);
  });

  it('uses ended_at from session when available', () => {
    const events: IOeeEvent[] = [];
    const session = { planned_boxes: 0, started_at: 0, ended_at: 3600000 };

    const result = calculateSummary(events, session);

    expect(result.totalPlannedMin).toBe(60);
  });

  it('handles empty events array', () => {
    const session = { planned_boxes: 100, started_at: 0, ended_at: 3600000 };

    const result = calculateSummary([], session);

    expect(result.actualBoxes).toBe(0);
    expect(result.totalRejects).toBe(0);
    expect(result.totalDowntimeMin).toBe(0);
    expect(result.unexplainedBoxes).toBe(100);
  });

  it('ignores non-box/reject events', () => {
    const events = [
      mockEvent({ id: 'e1', event_type: 'downtime_start', timestamp: 1000000 }),
      mockEvent({ id: 'e2', event_type: 'shift_start', timestamp: 1000000 }),
    ];
    const session = { planned_boxes: 100, started_at: 0, ended_at: 3600000 };

    const result = calculateSummary(events, session);

    expect(result.actualBoxes).toBe(0);
    expect(result.totalRejects).toBe(0);
    expect(result.unexplainedBoxes).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getInvolvedDepartments
// ═══════════════════════════════════════════════════════════════════════════════

describe('getInvolvedDepartments', () => {
  const deptReasonCodes: Record<string, string[]> = {
    MTTO: ['MC', 'FC', 'FS'],
    CALIDAD: ['CA', 'FS'],
    LOGISTICA: ['LO'],
  };

  it('returns department when reason code matches', () => {
    const result = getInvolvedDepartments('MC', deptReasonCodes);

    expect(result).toEqual(['MTTO']);
  });

  it('returns multiple departments when reason code matches multiple', () => {
    const result = getInvolvedDepartments('FS', deptReasonCodes);

    expect(result).toEqual(['MTTO', 'CALIDAD']);
  });

  it('returns empty array when reason code matches no department', () => {
    const result = getInvolvedDepartments('UNKNOWN', deptReasonCodes);

    expect(result).toEqual([]);
  });

  it('returns empty array when deptReasonCodes is empty', () => {
    const result = getInvolvedDepartments('MC', {});

    expect(result).toEqual([]);
  });

  it('case-sensitive: does not match different case', () => {
    const result = getInvolvedDepartments('mc', deptReasonCodes);

    expect(result).toEqual([]);
  });

  it('returns departments in insertion order', () => {
    const result = getInvolvedDepartments('LO', deptReasonCodes);

    expect(result).toEqual(['LOGISTICA']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// countReasonCodes
// ═══════════════════════════════════════════════════════════════════════════════

describe('countReasonCodes', () => {
  function makeStop(startId: string, reasonCode?: string): StopPair {
    return {
      start: mockEvent({ id: startId, event_type: 'downtime_start', timestamp: 1000000, reason_code: reasonCode }),
      durationMin: 0,
      requiresConciliation: false,
      requiresRca: false,
      involvedDepartments: [],
    };
  }

  it('counts occurrences of each reason code', () => {
    const stops = [
      makeStop('s1', 'FC'),
      makeStop('s2', 'FC'),
      makeStop('s3', 'MC'),
    ];

    const result = countReasonCodes(stops);

    expect(result.get('FC')).toBe(2);
    expect(result.get('MC')).toBe(1);
    expect(result.get('FS')).toBeUndefined();
  });

  it('skips stops with null/undefined reason_code', () => {
    const stops = [
      makeStop('s1', 'FC'),
      makeStop('s2', undefined),
      makeStop('s3', ''),
    ];

    const result = countReasonCodes(stops);

    expect(result.size).toBe(1); // only 'FC' is counted
    expect(result.get('FC')).toBe(1);
  });

  it('returns empty map for empty stops array', () => {
    const result = countReasonCodes([]);

    expect(result.size).toBe(0);
  });

  it('returns empty map when all stops have no reason_code', () => {
    const stops = [
      makeStop('s1'),
      makeStop('s2'),
    ];

    const result = countReasonCodes(stops);

    expect(result.size).toBe(0);
  });

  it('counts correctly when all stops have same code', () => {
    const stops = [
      makeStop('s1', 'FC'),
      makeStop('s2', 'FC'),
      makeStop('s3', 'FC'),
      makeStop('s4', 'FC'),
    ];

    const result = countReasonCodes(stops);

    expect(result.get('FC')).toBe(4);
    expect(result.size).toBe(1);
  });

  it('returns a Map instance', () => {
    const stops = [makeStop('s1', 'FC')];
    const result = countReasonCodes(stops);

    expect(result).toBeInstanceOf(Map);
  });
});
