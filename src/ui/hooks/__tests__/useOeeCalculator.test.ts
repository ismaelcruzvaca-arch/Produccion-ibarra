/**
 * Tests for useOeeCalculator hook.
 *
 * Wave 8: Refactored from productoId to ppm numeric parameter.
 * Core math is pure — inject ppm directly, no store dependencies.
 *
 * Wave conectar-calidad-oee: Hook is now async (useEffect + useState)
 * to support optional QualityDataProvider. Tests use waitFor to ensure
 * async computation resolves before assertions.
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { useOeeCalculator } from '../useOeeCalculator';
import type { IOeeEvent } from '../../../core/types';

const BASE_TS = 1715000000000;

const makeEvent = (overrides: Partial<IOeeEvent>): IOeeEvent => ({
  id: 'ev-test',
  created_at: BASE_TS,
  updated_at: BASE_TS,
  is_deleted: false,
  line_id: 'LINE-1',
  machine_id: 'MACH-1',
  shift_id: 'SHIFT-1',
  device_id: 'DEVICE-1',
  event_type: 'box_count',
  timestamp: BASE_TS,
  ...overrides,
});

describe('useOeeCalculator', () => {
  it('returns empty metrics when no events provided', async () => {
    const { result } = renderHook(() => useOeeCalculator([], undefined));
    await waitFor(() => {
      expect(result.current.metrics.totalCajas).toBe(0);
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('uses DEFAULT_PPM when ppm is undefined — flags usandoFallbackPpm', async () => {
    const { result } = renderHook(() => useOeeCalculator([], undefined));
    // Wait for async computeOee to resolve with DEFAULT_PPM
    await waitFor(() => {
      expect(result.current.isUsingFallbackPpm).toBe(true);
    });
  });

  it('does NOT flag usandoFallbackPpm when ppm is explicitly provided', async () => {
    const events: IOeeEvent[] = [
      makeEvent({ event_type: 'shift_start', timestamp: BASE_TS, planned_boxes: 480 }),
      makeEvent({ id: 'ev-2', event_type: 'box_count', quantity: 100 }),
      makeEvent({ id: 'ev-3', event_type: 'shift_end', timestamp: BASE_TS + 3600000 }),
    ];
    const { result } = renderHook(() => useOeeCalculator(events, 2.5));
    await waitFor(() => {
      expect(result.current.isUsingFallbackPpm).toBe(false);
    });
  });

  it('computes totalCajas from box_count events', async () => {
    const events: IOeeEvent[] = [
      makeEvent({ event_type: 'shift_start', timestamp: BASE_TS }),
      makeEvent({ id: 'ev-box1', event_type: 'box_count', quantity: 100 }),
      makeEvent({ id: 'ev-box2', event_type: 'box_count', quantity: 50 }),
      makeEvent({ id: 'ev-end', event_type: 'shift_end', timestamp: BASE_TS + 3600000 }),
    ];
    const { result } = renderHook(() => useOeeCalculator(events, 2.5));
    await waitFor(() => {
      expect(result.current.metrics.totalCajas).toBe(150);
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('recalculates when ppm changes — higher ppm yields lower rendimiento', async () => {
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

    // Wait for first render's async computation
    await waitFor(() => {
      expect(result.current.metrics.totalCajas).toBe(60);
    });
    const metricsWith25 = result.current.metrics.rendimiento;

    rerender({ p: 5.0 });

    // Wait for rerender's async computation
    await waitFor(() => {
      const metricsWith50 = result.current.metrics.rendimiento;
      // Higher ppm → more boxes expected → lower rendimiento for the same output
      expect(metricsWith50).toBeLessThan(metricsWith25);
      // Both should be > 0 since we have actual production
      expect(metricsWith25).toBeGreaterThan(0);
    });
  });
});
