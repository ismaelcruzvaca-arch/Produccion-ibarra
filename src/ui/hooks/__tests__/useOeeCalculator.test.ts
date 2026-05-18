/**
 * Tests for useOeeCalculator hook.
 *
 * Wave 8: Refactored from productoId to ppm numeric parameter.
 * Core math is pure — inject ppm directly, no store dependencies.
 */

import { renderHook } from '@testing-library/react-native';
import { useOeeCalculator } from '../useOeeCalculator';
import type { IOeeEvent } from '../../../core/types';

const BASE_TS = 1715000000000;

const makeEvent = (overrides: Partial<IOeeEvent>): IOeeEvent => ({
  id: 'ev-test',
  updated_at: BASE_TS,
  deleted: false,
  line_id: 'LINE-1',
  machine_id: 'MACH-1',
  shift_id: 'SHIFT-1',
  device_id: 'DEVICE-1',
  event_type: 'box_count',
  timestamp: BASE_TS,
  ...overrides,
});

describe('useOeeCalculator', () => {
  it('returns empty metrics when no events provided', () => {
    const { result } = renderHook(() => useOeeCalculator([], undefined));
    expect(result.current.metrics.totalCajas).toBe(0);
    expect(result.current.isLoading).toBe(true);
  });

  it('uses DEFAULT_PPM when ppm is undefined — flags usandoFallbackPpm', () => {
    const { result } = renderHook(() => useOeeCalculator([], undefined));
    // No events means usandoFallbackPpm follows DEFAULT_PPM logic
    expect(result.current.isUsingFallbackPpm).toBe(true);
  });

  it('does NOT flag usandoFallbackPpm when ppm is explicitly provided', () => {
    const events: IOeeEvent[] = [
      makeEvent({ event_type: 'shift_start', timestamp: BASE_TS, planned_boxes: 480 }),
      makeEvent({ id: 'ev-2', event_type: 'box_count', quantity: 100 }),
      makeEvent({ id: 'ev-3', event_type: 'shift_end', timestamp: BASE_TS + 3600000 }),
    ];
    const { result } = renderHook(() => useOeeCalculator(events, 2.5));
    expect(result.current.isUsingFallbackPpm).toBe(false);
  });

  it('computes totalCajas from box_count events', () => {
    const events: IOeeEvent[] = [
      makeEvent({ event_type: 'shift_start', timestamp: BASE_TS }),
      makeEvent({ id: 'ev-box1', event_type: 'box_count', quantity: 100 }),
      makeEvent({ id: 'ev-box2', event_type: 'box_count', quantity: 50 }),
      makeEvent({ id: 'ev-end', event_type: 'shift_end', timestamp: BASE_TS + 3600000 }),
    ];
    const { result } = renderHook(() => useOeeCalculator(events, 2.5));
    expect(result.current.metrics.totalCajas).toBe(150);
    expect(result.current.isLoading).toBe(false);
  });

  it('recalculates when ppm changes — higher ppm yields lower rendimiento', () => {
    // 1h shift with 60 boxes. At 2.5 ppm target → 150 boxes planned → rendimiento < 1.0
    // At 5.0 ppm target → 300 boxes planned → rendimiento even lower
    const events: IOeeEvent[] = [
      makeEvent({ event_type: 'shift_start', timestamp: BASE_TS }),
      makeEvent({ id: 'ev-box', event_type: 'box_count', quantity: 60 }),
      makeEvent({ id: 'ev-end', event_type: 'shift_end', timestamp: BASE_TS + 3600000 }),
    ];
    const { result, rerender } = renderHook(({ p }) => useOeeCalculator(events, p), {
      initialProps: { p: 2.5 },
    });
    const metricsWith25 = result.current.metrics.rendimiento;

    rerender({ p: 5.0 });
    const metricsWith50 = result.current.metrics.rendimiento;

    // Higher ppm → more boxes expected → lower rendimiento for the same output
    expect(metricsWith50).toBeLessThan(metricsWith25);
    // Both should be > 0 since we have actual production
    expect(metricsWith25).toBeGreaterThan(0);
  });
});
