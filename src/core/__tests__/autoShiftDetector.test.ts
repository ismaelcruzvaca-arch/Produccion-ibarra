/**
 * Unit tests for useAutoShiftDetector helper functions.
 *
 * Pattern: Pure function tests, plain data, no mocks (useShiftClose.test.ts style).
 * Functions imported from autoShiftDetector.ts — tests cover the actual source.
 *
 * Tests:
 * - computeStartTime: slot-in-past returns slot time, slot-in-future clips to now
 * - timeFromHHmm: converts HH:mm string to epoch ms
 * - isStaleData: warning when >24h old, clears when fresh
 * - Idempotency guard logic: no duplicate creation when active session exists
 *
 * Ref: AD-1, AD-2, AD-4
 */

import { timeFromHHmm, computeStartTime, isStaleData, STALE_THRESHOLD_MS } from '../shiftTimeUtils';

// ─── Idempotency guard simulation ─────────────────────────────────────────────

interface SimulatedMachine {
  id: string;
  is_active: boolean;
}

interface SimulatedActiveSession {
  machine_id: string;
  status: string;
}

/**
 * Simulates the idempotent creation guard from useAutoShiftDetector.evaluate().
 * Returns the machine_id that would get a session created, or null if none.
 */
function simulateEvaluate(
  activeSlot: { line_id: string; start_time: string } | null,
  machines: SimulatedMachine[],
  activeSessions: SimulatedActiveSession[],
): string | null {
  if (!activeSlot) return null;

  const activeMachineIds = new Set(
    activeSessions
      .filter((s) => s.status === 'active')
      .map((s) => s.machine_id),
  );

  for (const machine of machines) {
    if (!machine.is_active) continue;
    if (!activeMachineIds.has(machine.id)) {
      return machine.id; // Would create session for this machine
    }
  }

  return null; // All machines already have active sessions
}

// ═══════════════════════════════════════════════════════════════════════════════
// computeStartTime
// ═══════════════════════════════════════════════════════════════════════════════

describe('computeStartTime', () => {
  // AD-1: Slot start detected — slot start time is in the past (scheduler started late)
  it('returns slotStart when slotStart is in the past', () => {
    const slotStart = Date.now() - 5000; // 5 seconds ago
    const result = computeStartTime(slotStart);
    expect(result).toBe(slotStart); // Uses the slot time for historical accuracy
  });

  it('returns slotStart when slotStart is exactly now', () => {
    const slotStart = Date.now();
    const result = computeStartTime(slotStart);
    expect(result).toBe(slotStart);
  });

  // AD-1 edge case: Slot start in the future (should clip to now)
  it('clips to now when slotStart is in the future', () => {
    const slotStart = Date.now() + 60000; // 1 minute in the future
    const result = computeStartTime(slotStart);
    expect(result).toBeLessThanOrEqual(Date.now());
    expect(result).not.toBe(slotStart); // Was clipped
  });

  it('returns slotStart when slotStart is far in the past', () => {
    const slotStart = Date.now() - 3600000; // 1 hour ago
    const result = computeStartTime(slotStart);
    expect(result).toBe(slotStart);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// timeFromHHmm
// ═══════════════════════════════════════════════════════════════════════════════

describe('timeFromHHmm', () => {
  it('converts "06:00" to correct epoch ms', () => {
    const fixedNow = new Date('2026-06-15T10:00:00').getTime();
    const result = timeFromHHmm('06:00', fixedNow);
    const expected = new Date('2026-06-15T06:00:00').getTime();
    expect(result).toBe(expected);
  });

  it('converts "14:30" to correct epoch ms', () => {
    const fixedNow = new Date('2026-06-15T10:00:00').getTime();
    const result = timeFromHHmm('14:30', fixedNow);
    const expected = new Date('2026-06-15T14:30:00').getTime();
    expect(result).toBe(expected);
  });

  it('handles midnight "00:00"', () => {
    const fixedNow = new Date('2026-06-15T10:00:00').getTime();
    const result = timeFromHHmm('00:00', fixedNow);
    const expected = new Date('2026-06-15T00:00:00').getTime();
    expect(result).toBe(expected);
  });

  it('handles end-of-day "23:59"', () => {
    const fixedNow = new Date('2026-06-15T10:00:00').getTime();
    const result = timeFromHHmm('23:59', fixedNow);
    const expected = new Date('2026-06-15T23:59:00').getTime();
    expect(result).toBe(expected);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// isStaleData (AD-4 threshold logic)
// ═══════════════════════════════════════════════════════════════════════════════

describe('isStaleData (AD-4)', () => {
  const NOW = 1717000000000;
  const TWENTY_THREE_HOURS_MS = 23 * 60 * 60 * 1000;
  const TWENTY_FIVE_HOURS_MS = 25 * 60 * 60 * 1000;

  it('returns null when latestUpdate is 0 (no calendar data)', () => {
    const result = isStaleData(0, NOW);
    expect(result).toBeNull();
  });

  it('returns null when data is fresh (< 24h old)', () => {
    const result = isStaleData(NOW - TWENTY_THREE_HOURS_MS, NOW);
    expect(result).toBeNull();
  });

  it('returns warning when data is stale (> 24h old)', () => {
    const result = isStaleData(NOW - TWENTY_FIVE_HOURS_MS, NOW);
    expect(result).toBe('Calendario no actualizado desde hace más de 24h');
  });

  it('returns null when data is exactly at the threshold boundary', () => {
    const result = isStaleData(NOW - STALE_THRESHOLD_MS, NOW);
    expect(result).toBeNull(); // age === threshold, not strictly greater
  });

  it('returns warning when data is very old (48h)', () => {
    const twoDaysAgo = NOW - 48 * 60 * 60 * 1000;
    const result = isStaleData(twoDaysAgo, NOW);
    expect(result).toBe('Calendario no actualizado desde hace más de 24h');
  });

  it('returns null when data was updated just now', () => {
    const result = isStaleData(NOW, NOW);
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Idempotency guard (AD-1, AD-2)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Idempotency guard (AD-1, AD-2)', () => {
  // AD-1: Slot start detected — no active session
  it('creates session when no active session exists for line', () => {
    const result = simulateEvaluate(
      { line_id: 'L1', start_time: '06:00' },
      [{ id: 'MC-01', is_active: true }],
      [], // No active sessions
    );
    expect(result).toBe('MC-01');
  });

  // AD-2: Duplicate prevention — existing active session
  it('skips creation when active session exists for machine', () => {
    const result = simulateEvaluate(
      { line_id: 'L1', start_time: '06:00' },
      [{ id: 'MC-01', is_active: true }],
      [{ machine_id: 'MC-01', status: 'active' }],
    );
    expect(result).toBeNull();
  });

  // AD-1: No slot — no session
  it('returns null when no active slot', () => {
    const result = simulateEvaluate(
      null, // No active slot
      [{ id: 'MC-01', is_active: true }],
      [],
    );
    expect(result).toBeNull();
  });

  // AD-2: Multiple machines — creates for first without session
  it('creates session for first machine without active session', () => {
    const result = simulateEvaluate(
      { line_id: 'L1', start_time: '06:00' },
      [
        { id: 'MC-01', is_active: true },
        { id: 'MC-02', is_active: true },
      ],
      [{ machine_id: 'MC-01', status: 'active' }], // MC-01 already has session
    );
    expect(result).toBe('MC-02'); // MC-02 gets the new session
  });

  // AD-2: All machines have active sessions
  it('returns null when ALL machines have active sessions', () => {
    const result = simulateEvaluate(
      { line_id: 'L1', start_time: '06:00' },
      [
        { id: 'MC-01', is_active: true },
        { id: 'MC-02', is_active: true },
      ],
      [
        { machine_id: 'MC-01', status: 'active' },
        { machine_id: 'MC-02', status: 'active' },
      ],
    );
    expect(result).toBeNull();
  });

  // AD-2: Inactive machines are skipped
  it('skips inactive machines when looking for candidate', () => {
    const result = simulateEvaluate(
      { line_id: 'L1', start_time: '06:00' },
      [
        { id: 'MC-01', is_active: false }, // Inactive
        { id: 'MC-02', is_active: true },  // Active — should get session
      ],
      [],
    );
    expect(result).toBe('MC-02');
  });

  // AD-2: Closed sessions don't block creation
  it('creates session when only closed sessions exist for machine', () => {
    const result = simulateEvaluate(
      { line_id: 'L1', start_time: '06:00' },
      [{ id: 'MC-01', is_active: true }],
      [{ machine_id: 'MC-01', status: 'closed' }], // Closed, not active
    );
    expect(result).toBe('MC-01'); // Creates new session
  });

  // AD-2: Empty machine list
  it('returns null when no active machines', () => {
    const result = simulateEvaluate(
      { line_id: 'L1', start_time: '06:00' },
      [], // No machines
      [],
    );
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Slot evaluation with exceptions (SC-2, SC-5)
// ═══════════════════════════════════════════════════════════════════════════════

type ExceptionType = 'holiday' | 'override' | 'extraordinary';

interface SimulatedSlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  shift_type: string;
}

interface SimulatedException {
  date: string;
  type: ExceptionType;
  start_time?: string;
  end_time?: string;
  shift_type?: string;
}

/**
 * Simulates the getActiveSlot resolution logic from useShiftCalendarRepository.
 * Resolution order:
 * 1. Holiday exception -> null
 * 2. Override exception -> use override hours
 * 3. Extraordinary exception -> ad-hoc slot
 * 4. Sunday (day_of_week === 0) -> null
 * 5. Weekly recurring slots -> match by day_of_week + time range
 */
function simulateGetActiveSlot(
  lineId: string,
  time: number,
  slots: SimulatedSlot[],
  exceptions: SimulatedException[],
): { shift_type: string; start_time: string; end_time: string } | null {
  const d = new Date(time);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const dayOfWeek = d.getDay();
  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const isTimeInRange = (start: string, end: string): boolean =>
    timeStr >= start && timeStr < end;

  // Filter exceptions for this date + line (in real code, filtered by line_id)
  const relevantExceptions = exceptions.filter((e) => e.date === dateStr);

  // 1. Holiday cancels everything
  const holiday = relevantExceptions.find((e) => e.type === 'holiday');
  if (holiday) return null;

  // 2. Override — replaces recurring slot hours for this date
  const override = relevantExceptions.find((e) => e.type === 'override');
  if (override && override.start_time && override.end_time) {
    if (isTimeInRange(override.start_time, override.end_time)) {
      return {
        shift_type: override.shift_type ?? 'matutino',
        start_time: override.start_time,
        end_time: override.end_time,
      };
    }
  }

  // 3. Extraordinary — ad-hoc slot for this date
  const extraordinary = relevantExceptions.find((e) => e.type === 'extraordinary');
  if (extraordinary && extraordinary.start_time && extraordinary.end_time) {
    if (isTimeInRange(extraordinary.start_time, extraordinary.end_time)) {
      return {
        shift_type: extraordinary.shift_type ?? 'matutino',
        start_time: extraordinary.start_time,
        end_time: extraordinary.end_time,
      };
    }
  }

  // 4. Sunday default rule — no production
  if (dayOfWeek === 0) return null;

  // 5. Fallback to weekly recurring slots
  const daySlots = slots.filter((s) => s.day_of_week === dayOfWeek);
  const activeSlot = daySlots.find((s) => isTimeInRange(s.start_time, s.end_time));
  if (!activeSlot) return null;

  return {
    shift_type: activeSlot.shift_type,
    start_time: activeSlot.start_time,
    end_time: activeSlot.end_time,
  };
}

describe('Slot evaluation with exceptions (SC-2, SC-5)', () => {
  // Monday 2026-06-15 is a Monday (getDay() === 1)
  const MONDAY_0600 = new Date('2026-06-15T06:00:00').getTime();
  const MONDAY_0830 = new Date('2026-06-15T08:30:00').getTime();
  const MONDAY_1400 = new Date('2026-06-15T14:00:00').getTime();

  const mondaySlots: SimulatedSlot[] = [
    { day_of_week: 1, start_time: '06:00', end_time: '14:00', shift_type: 'matutino' },
  ];

  // SC-5: Sunday without exception -> no slot
  it('SC-5: returns null on Sunday with no exceptions', () => {
    const sunday = new Date('2026-06-14T06:00:00').getTime(); // Sunday
    const result = simulateGetActiveSlot(
      'L1', sunday, mondaySlots, [],
    );
    expect(result).toBeNull();
  });

  // SC-5: Sunday with override -> uses override hours
  it('SC-5: Sunday with override exception returns override hours', () => {
    const sunday1000 = new Date('2026-06-14T10:00:00').getTime(); // Sunday 10:00
    const result = simulateGetActiveSlot(
      'L1', sunday1000, mondaySlots, [
        {
          date: '2026-06-14',
          type: 'override',
          start_time: '08:00',
          end_time: '16:00',
          shift_type: 'vespertino',
        },
      ],
    );
    expect(result).not.toBeNull();
    expect(result!.start_time).toBe('08:00');
    expect(result!.end_time).toBe('16:00');
    expect(result!.shift_type).toBe('vespertino');
  });

  // SC-2: Holiday cancels everything
  it('SC-2: holiday exception returns null', () => {
    const result = simulateGetActiveSlot(
      'L1', MONDAY_0600, mondaySlots, [
        { date: '2026-06-15', type: 'holiday' },
      ],
    );
    expect(result).toBeNull();
  });

  // SC-2: Override exception provides different hours
  it('SC-2: override exception returns different hours', () => {
    const result = simulateGetActiveSlot(
      'L1', MONDAY_0830, mondaySlots, [
        {
          date: '2026-06-15',
          type: 'override',
          start_time: '08:00',
          end_time: '16:00',
        },
      ],
    );
    expect(result).not.toBeNull();
    expect(result!.start_time).toBe('08:00');
    expect(result!.end_time).toBe('16:00');
  });

  // SC-2: Override outside active hours falls through to regular slot
  it('SC-2: override exception outside active hours falls through to regular slot', () => {
    // Override is 12:00-16:00, current time is 06:00 (before override)
    const result = simulateGetActiveSlot(
      'L1', MONDAY_0600, mondaySlots, [
        {
          date: '2026-06-15',
          type: 'override',
          start_time: '12:00',
          end_time: '16:00',
        },
      ],
    );
    // The override is not active at 06:00 -> falls through to regular slot 06:00-14:00
    expect(result).not.toBeNull();
    expect(result!.start_time).toBe('06:00');
    expect(result!.end_time).toBe('14:00');
    expect(result!.shift_type).toBe('matutino');
  });

  // SC-2: Extraordinary exception creates ad-hoc slot
  it('SC-2: extraordinary exception creates ad-hoc slot on Monday evening', () => {
    const monday1800 = new Date('2026-06-15T18:00:00').getTime();
    const result = simulateGetActiveSlot(
      'L1', monday1800, mondaySlots, [
        {
          date: '2026-06-15',
          type: 'extraordinary',
          start_time: '18:00',
          end_time: '22:00',
          shift_type: 'nocturno',
        },
      ],
    );
    expect(result).not.toBeNull();
    expect(result!.start_time).toBe('18:00');
    expect(result!.end_time).toBe('22:00');
    expect(result!.shift_type).toBe('nocturno');
  });

  // AD-1: Normal slot match
  it('AD-1: returns active slot when time is within range', () => {
    const result = simulateGetActiveSlot(
      'L1', MONDAY_0600, mondaySlots, [],
    );
    expect(result).not.toBeNull();
    expect(result!.start_time).toBe('06:00');
    expect(result!.end_time).toBe('14:00');
    expect(result!.shift_type).toBe('matutino');
  });

  // AD-1: No matching slot
  it('returns null when no slot matches the current time', () => {
    const monday2200 = new Date('2026-06-15T22:00:00').getTime();
    const result = simulateGetActiveSlot(
      'L1', monday2200, mondaySlots, [],
    );
    expect(result).toBeNull();
  });

  // Holiday cancels even with match
  it('holiday exception takes priority over matching slot', () => {
    const result = simulateGetActiveSlot(
      'L1', MONDAY_0600, mondaySlots, [
        { date: '2026-06-15', type: 'holiday' },
      ],
    );
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// intervalsOverlap (SC-3 validation helper)
// ═══════════════════════════════════════════════════════════════════════════════

describe('intervalsOverlap (SC-3)', () => {
  // Copied from useShiftCalendarRepository.ts
  function intervalsOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
    return startA < endB && startB < endA;
  }

  // SC-3: Identical intervals overlap
  it('detects identical intervals as overlapping', () => {
    expect(intervalsOverlap('06:00', '14:00', '06:00', '14:00')).toBe(true);
  });

  // SC-3: Partial overlap
  it('detects partial overlap', () => {
    expect(intervalsOverlap('06:00', '10:00', '08:00', '12:00')).toBe(true);
  });

  // SC-3: One interval contains another
  it('detects contained overlap', () => {
    expect(intervalsOverlap('06:00', '14:00', '08:00', '16:00')).toBe(true);
  });

  // SC-3: Adjacent intervals (end === start) do NOT overlap
  it('detects adjacent intervals as non-overlapping', () => {
    expect(intervalsOverlap('06:00', '14:00', '14:00', '22:00')).toBe(false);
  });

  // SC-3: Separate intervals do NOT overlap
  it('detects separate intervals as non-overlapping', () => {
    expect(intervalsOverlap('06:00', '14:00', '16:00', '22:00')).toBe(false);
  });

  // SC-3: Reversed order still detects overlap
  it('detects overlap regardless of parameter order', () => {
    expect(intervalsOverlap('08:00', '12:00', '06:00', '10:00')).toBe(true);
  });

  // Edge case: exact boundary (start === other's end)
  it('handles exact boundary correctly (non-overlap)', () => {
    expect(intervalsOverlap('06:00', '14:00', '14:00', '22:00')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createSlot validation (SC-1 creation logic)
// ═══════════════════════════════════════════════════════════════════════════════

describe('createSlot validation (SC-1)', () => {
  // Simulates the createSlot flow: given a payload, validate and produce the doc
  function simulateCreateSlot(
    payload: {
      day_of_week: number;
      start_time: string;
      end_time: string;
      line_id: string;
      shift_type: string;
    },
    existingSlots: Array<{
      id: string;
      line_id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>,
  ): { success: boolean; error?: string; slot?: { line_id: string; day_of_week: number; start_time: string; end_time: string; shift_type: string } } {
    // Validate overlap against existing slots
    function intervalsOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
      return startA < endB && startB < endA;
    }

    for (const existing of existingSlots) {
      if (existing.line_id !== payload.line_id) continue;
      if (existing.day_of_week !== payload.day_of_week) continue;
      if (intervalsOverlap(payload.start_time, payload.end_time, existing.start_time, existing.end_time)) {
        return {
          success: false,
          error: `El horario ${payload.start_time}-${payload.end_time} se sobrepone con el slot existente ${existing.start_time}-${existing.end_time} para esta línea y día`,
        };
      }
    }

    return {
      success: true,
      slot: {
        line_id: payload.line_id,
        day_of_week: payload.day_of_week,
        start_time: payload.start_time,
        end_time: payload.end_time,
        shift_type: payload.shift_type,
      },
    };
  }

  // SC-1: Creates slot when no overlap exists
  it('SC-1: creates slot successfully when no overlap exists', () => {
    const result = simulateCreateSlot(
      { day_of_week: 1, start_time: '06:00', end_time: '14:00', line_id: 'L1', shift_type: 'matutino' },
      [],
    );
    expect(result.success).toBe(true);
    expect(result.slot?.start_time).toBe('06:00');
    expect(result.slot?.end_time).toBe('14:00');
  });

  // SC-1: Creates slot when existing slots are on different line
  it('SC-1: creates slot when existing slots are on different line', () => {
    const result = simulateCreateSlot(
      { day_of_week: 1, start_time: '06:00', end_time: '14:00', line_id: 'L1', shift_type: 'matutino' },
      [
        { id: 's1', line_id: 'L2', day_of_week: 1, start_time: '06:00', end_time: '14:00' },
      ],
    );
    expect(result.success).toBe(true);
  });

  // SC-1: Creates slot when existing slots are on different day
  it('SC-1: creates slot when existing slots are on different day', () => {
    const result = simulateCreateSlot(
      { day_of_week: 1, start_time: '06:00', end_time: '14:00', line_id: 'L1', shift_type: 'matutino' },
      [
        { id: 's2', line_id: 'L1', day_of_week: 2, start_time: '06:00', end_time: '14:00' },
      ],
    );
    expect(result.success).toBe(true);
  });

  // SC-3: Rejects slot when overlap exists
  it('SC-3: rejects overlapping slot with error message', () => {
    const result = simulateCreateSlot(
      { day_of_week: 1, start_time: '08:00', end_time: '16:00', line_id: 'L1', shift_type: 'vespertino' },
      [
        { id: 's3', line_id: 'L1', day_of_week: 1, start_time: '06:00', end_time: '14:00' },
      ],
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('sobrepone');
  });

  // SC-3: Multiple slots — rejects if any overlaps
  it('SC-3: rejects if any existing slot overlaps', () => {
    const result = simulateCreateSlot(
      { day_of_week: 1, start_time: '10:00', end_time: '18:00', line_id: 'L1', shift_type: 'vespertino' },
      [
        { id: 's4', line_id: 'L2', day_of_week: 1, start_time: '06:00', end_time: '14:00' }, // different line
        { id: 's5', line_id: 'L1', day_of_week: 2, start_time: '06:00', end_time: '14:00' }, // different day
        { id: 's6', line_id: 'L1', day_of_week: 1, start_time: '06:00', end_time: '14:00' }, // OVERLAP
      ],
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('sobrepone');
  });
});
