import { computeOee } from '../oeeCalculator';
import { DEFAULT_PPM } from '../../config/catalogs';
import type { IOeeEvent } from '../../core/types';

const FIXED_NOW = 1715000000000;

function makeEvent(overrides: Partial<IOeeEvent> = {}): IOeeEvent {
  return {
    created_at: FIXED_NOW,
    updated_at: FIXED_NOW,
    is_deleted: false,
    line_id: 'LINEA-1',
    machine_id: 'CAVEMIL-03',
    shift_id: 'shift-1',
    device_id: 'device-1',
    ...overrides,
  } as IOeeEvent;
}

describe('computeOee', () => {
  const shiftStart = (timestamp: number, shiftId = 'shift-1'): IOeeEvent =>
    makeEvent({ id: 'ev-1', updated_at: timestamp, event_type: 'shift_start', timestamp, planned_boxes: 480, shift_id: shiftId });

  const shiftEnd = (timestamp: number, shiftId = 'shift-1'): IOeeEvent =>
    makeEvent({ id: 'ev-2', updated_at: timestamp, event_type: 'shift_end', timestamp, shift_id: shiftId });

  const downtimeStart = (timestamp: number, reason: string, id: string): IOeeEvent =>
    makeEvent({ id, updated_at: timestamp, event_type: 'downtime_start', timestamp, reason_code: reason });

  const downtimeEnd = (timestamp: number, relatedId: string): IOeeEvent =>
    makeEvent({ id: `end-${relatedId}`, updated_at: timestamp, event_type: 'downtime_end', timestamp, related_event_id: relatedId });

  const boxCount = (timestamp: number, qty: number): IOeeEvent =>
    makeEvent({ id: `box-${timestamp}`, updated_at: timestamp, event_type: 'box_count', timestamp, quantity: qty });

  const rejectCount = (timestamp: number, qty: number): IOeeEvent =>
    makeEvent({ id: `rej-${timestamp}`, updated_at: timestamp, event_type: 'reject_count', timestamp, quantity: qty });

  // Test 1: Empty events → all zeros
  it('returns zero metrics for empty events', () => {
    const result = computeOee([], 2.5);
    expect(result.disponibilidad).toBe(0);
    expect(result.rendimiento).toBe(0);
    expect(result.calidad).toBe(0);
    expect(result.oee).toBe(0);
    expect(result.tiempoPlanificadoMin).toBe(0);
  });

  // Test 2: Perfect shift (no downtime, no rejects)
  it('calculates 100% OEE for perfect shift', () => {
    const start = FIXED_NOW;
    const events = [
      shiftStart(start),
      boxCount(start + 1000, 120), // 120 boxes in ~1 min
      shiftEnd(start + 60 * 60 * 1000), // 1 hour shift
    ];
    const result = computeOee(events, 2.0); // 2 boxes/min = 120/hour
    expect(result.disponibilidad).toBe(100);
    expect(result.rendimiento).toBeCloseTo(100, 0);
    expect(result.calidad).toBe(100);
    expect(result.oee).toBeCloseTo(100, 0);
  });

  // Test 3: Shift with production downtime (PROD macro)
  it('calculates reduced availability with PROD downtime', () => {
    const start = FIXED_NOW;
    const events = [
      shiftStart(start),
      downtimeStart(start + 10 * 60 * 1000, 'FMP', 'dt-1'),
      downtimeEnd(start + 25 * 60 * 1000, 'dt-1'), // 15 min downtime
      boxCount(start + 30 * 60 * 1000, 90),
      shiftEnd(start + 60 * 60 * 1000),
    ];
    const result = computeOee(events, 2.0);
    expect(result.tiempoPlanificadoMin).toBe(60);
    expect(result.tiempoParoProdMin).toBe(15);
    expect(result.tiempoOperandoMin).toBe(45);
    expect(result.disponibilidad).toBe(75); // 45/60 = 75%
  });

  // Test 4: Shift with maintenance downtime (MTTO macro)
  it('classifies MTTO downtime separately from PROD', () => {
    const start = FIXED_NOW;
    const events = [
      shiftStart(start),
      downtimeStart(start + 5 * 60 * 1000, 'FC', 'dt-1'),
      downtimeEnd(start + 20 * 60 * 1000, 'dt-1'), // 15 min MTTO
      boxCount(start + 25 * 60 * 1000, 90),
      shiftEnd(start + 60 * 60 * 1000),
    ];
    const result = computeOee(events, 2.0);
    expect(result.tiempoParoMttoMin).toBe(15);
    expect(result.tiempoParoProdMin).toBe(0);
    expect(result.disponibilidad).toBe(75);
  });

  // Test 5: Open downtime (no end) — should handle gracefully
  it('handles open downtime without crashing', () => {
    const start = FIXED_NOW - 60 * 60 * 1000; // 1 hour in the past
    const events = [
      shiftStart(start),
      downtimeStart(start + 10 * 60 * 1000, 'FMP', 'dt-1'),
      // No downtime_end!
      shiftEnd(start + 60 * 60 * 1000),
    ];
    const result = computeOee(events, 2.0);
    // Should not crash, should account for open downtime
    expect(result.tiempoParoProdMin).toBeGreaterThan(0);
    expect(result.disponibilidad).toBeLessThan(100);
  });

  // Test 6: Quality impact (rejects)
  it('reduces quality with rejects', () => {
    const start = FIXED_NOW;
    const events = [
      shiftStart(start),
      boxCount(start + 10 * 60 * 1000, 100),
      rejectCount(start + 15 * 60 * 1000, 5),
      shiftEnd(start + 60 * 60 * 1000),
    ];
    const result = computeOee(events, 2.0);
    expect(result.totalCajas).toBe(100);
    expect(result.totalRechazos).toBe(5);
    expect(result.cajasBuenas).toBe(95);
    expect(result.calidad).toBe(95);
  });

  // Test 7: Fallback PPM detection
  it('sets usandoFallbackPpm when using DEFAULT_PPM', () => {
    const events = [shiftStart(Date.now())];
    const result = computeOee(events, DEFAULT_PPM);
    expect(result.usandoFallbackPpm).toBe(true);
    expect(result.ppmUtilizado).toBe(1.0);
  });

  it('does not set usandoFallbackPpm with custom PPM', () => {
    const events = [shiftStart(Date.now())];
    const result = computeOee(events, 2.5);
    expect(result.usandoFallbackPpm).toBe(false);
    expect(result.ppmUtilizado).toBe(2.5);
  });

  // Test 8: Deleted events are ignored
  it('ignores deleted events', () => {
    const start = FIXED_NOW;
    const events = [
      shiftStart(start),
      { ...boxCount(start + 1000, 50), is_deleted: true },
      boxCount(start + 2000, 100),
      shiftEnd(start + 60 * 60 * 1000),
    ];
    const result = computeOee(events, 2.0);
    expect(result.totalCajas).toBe(100); // Only 100, not 150
  });

  // Test 9: Events out of order
  it('handles events in random order', () => {
    const start = FIXED_NOW;
    const events = [
      boxCount(start + 2000, 100),
      shiftEnd(start + 60 * 60 * 1000),
      shiftStart(start),
    ];
    const result = computeOee(events, 2.0);
    expect(result.tiempoPlanificadoMin).toBe(60);
    expect(result.totalCajas).toBe(100);
  });

  // Test 10: Zero PPM (edge case)
  it('handles zero PPM gracefully', () => {
    const start = FIXED_NOW;
    const events = [
      shiftStart(start),
      boxCount(start + 1000, 100),
      shiftEnd(start + 60 * 60 * 1000),
    ];
    const result = computeOee(events, 0);
    expect(result.rendimiento).toBe(0);
    expect(result.oee).toBe(0);
  });

  // Test 11: Multiple downtime events
  it('accumulates multiple downtimes', () => {
    const start = FIXED_NOW;
    const events = [
      shiftStart(start),
      downtimeStart(start + 5 * 60 * 1000, 'FMP', 'dt-1'),
      downtimeEnd(start + 10 * 60 * 1000, 'dt-1'), // 5 min
      downtimeStart(start + 20 * 60 * 1000, 'FC', 'dt-2'),
      downtimeEnd(start + 35 * 60 * 1000, 'dt-2'), // 15 min
      boxCount(start + 40 * 60 * 1000, 80),
      shiftEnd(start + 60 * 60 * 1000),
    ];
    const result = computeOee(events, 2.0);
    expect(result.tiempoParoProdMin).toBe(5);
    expect(result.tiempoParoMttoMin).toBe(15);
    expect(result.tiempoOperandoMin).toBe(40);
  });

  // Test 12: Metrics bounded 0-100
  it('bounds all metrics between 0 and 100', () => {
    const start = FIXED_NOW;
    const events = [
      shiftStart(start),
      shiftEnd(start + 1000), // Very short shift
    ];
    const result = computeOee(events, 2.0);
    expect(result.disponibilidad).toBeGreaterThanOrEqual(0);
    expect(result.disponibilidad).toBeLessThanOrEqual(100);
    expect(result.rendimiento).toBeGreaterThanOrEqual(0);
    expect(result.rendimiento).toBeLessThanOrEqual(100);
    expect(result.calidad).toBeGreaterThanOrEqual(0);
    expect(result.calidad).toBeLessThanOrEqual(100);
    expect(result.oee).toBeGreaterThanOrEqual(0);
    expect(result.oee).toBeLessThanOrEqual(100);
  });

  // Test 13: Anomaly detection
  it('detects anomalies and sets hasAnomalies flag when metrics exceed 100%', () => {
    const start = FIXED_NOW;
    const events = [
      shiftStart(start),
      boxCount(start + 1000, 300), // 300 boxes in ~1 min
      shiftEnd(start + 60 * 60 * 1000), // 1 hour shift
    ];
    const result = computeOee(events, 1.0); // Expected 60 boxes, got 300 (500% yield)
    expect(result.rendimiento).toBe(100); // Clamped
    expect(result.hasAnomalies).toBe(true);
  });
});
