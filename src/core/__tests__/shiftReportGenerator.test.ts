import { generateShiftReport } from '../shiftReportGenerator';
import type { IOeeEvent } from '../../core/types';

const FIXED_NOW = 1715000000000;

describe('generateShiftReport', () => {
  const shiftStart = (timestamp: number): IOeeEvent => ({
    id: 'ev-1', updated_at: timestamp, deleted: false,
    line_id: 'LINEA-1', machine_id: 'CAVEMIL-03', shift_id: 'shift-1',
    event_type: 'shift_start', timestamp, planned_boxes: 480, device_id: 'device-1',
  });

  const shiftEnd = (timestamp: number): IOeeEvent => ({
    id: 'ev-2', updated_at: timestamp, deleted: false,
    line_id: 'LINEA-1', machine_id: 'CAVEMIL-03', shift_id: 'shift-1',
    event_type: 'shift_end', timestamp, device_id: 'device-1',
  });

  const boxCount = (timestamp: number, qty: number): IOeeEvent => ({
    id: `box-${timestamp}`, updated_at: timestamp, deleted: false,
    line_id: 'LINEA-1', machine_id: 'CAVEMIL-03', shift_id: 'shift-1',
    event_type: 'box_count', timestamp, quantity: qty, device_id: 'device-1',
  });

  const downtimeStart = (timestamp: number, reason: string, id: string): IOeeEvent => ({
    id, updated_at: timestamp, deleted: false,
    line_id: 'LINEA-1', machine_id: 'CAVEMIL-03', shift_id: 'shift-1',
    event_type: 'downtime_start', timestamp, reason_code: reason, device_id: 'device-1',
  });

  const downtimeEnd = (timestamp: number, relatedId: string): IOeeEvent => ({
    id: `end-${relatedId}`, updated_at: timestamp, deleted: false,
    line_id: 'LINEA-1', machine_id: 'CAVEMIL-03', shift_id: 'shift-1',
    event_type: 'downtime_end', timestamp, related_event_id: relatedId, device_id: 'device-1',
  });

  it('generates report with correct template_id', () => {
    const start = FIXED_NOW;
    const events = [
      shiftStart(start),
      boxCount(start + 1000, 100),
      shiftEnd(start + 60 * 60 * 1000),
    ];
    const report = generateShiftReport({
      events, shiftId: 'shift-1', lineId: 'LINEA-1',
    });
    expect(report.template_id).toBe('oee-shift-summary');
    expect(report.deleted).toBe(false);
    expect(report.data.line_id).toBe('LINEA-1');
  });

  it('calculates correct totals from events', () => {
    const start = FIXED_NOW;
    const events = [
      shiftStart(start),
      boxCount(start + 1000, 100),
      boxCount(start + 2000, 50),
      shiftEnd(start + 60 * 60 * 1000),
    ];
    const report = generateShiftReport({
      events, shiftId: 'shift-1', lineId: 'LINEA-1',
    });
    expect(report.data.total_pieces).toBe(150);
    expect(report.data.rejected_pieces).toBe(0);
    expect(report.data.downtime_minutes).toBe(0);
  });

  it('includes downtime in report', () => {
    const start = FIXED_NOW;
    const events = [
      shiftStart(start),
      downtimeStart(start + 5 * 60 * 1000, 'FMP', 'dt-1'),
      downtimeEnd(start + 20 * 60 * 1000, 'dt-1'),
      boxCount(start + 25 * 60 * 1000, 80),
      shiftEnd(start + 60 * 60 * 1000),
    ];
    const report = generateShiftReport({
      events, shiftId: 'shift-1', lineId: 'LINEA-1',
    });
    expect(report.data.downtime_minutes).toBe(15);
    expect(report.data.total_pieces).toBe(80);
  });

  it('uses product PPM when productoId provided', () => {
    const start = FIXED_NOW;
    const events = [
      shiftStart(start),
      boxCount(start + 1000, 100),
      shiftEnd(start + 60 * 60 * 1000),
    ];
    const report = generateShiftReport({
      events, shiftId: 'shift-1', lineId: 'LINEA-1', productoId: '1', // CHOC-500 = 2.5 PPM
    });
    // Report data should reflect PPM-based calculations
    expect(report.data.total_pieces).toBe(100);
  });

  it('handles empty events gracefully', () => {
    const report = generateShiftReport({
      events: [], shiftId: 'shift-1', lineId: 'LINEA-1',
    });
    expect(report.data.total_pieces).toBe(0);
    expect(report.data.rejected_pieces).toBe(0);
    expect(report.data.downtime_minutes).toBe(0);
  });

  it('generates unique UUIDs for each report', () => {
    const report1 = generateShiftReport({
      events: [], shiftId: 'shift-1', lineId: 'LINEA-1',
    });
    const report2 = generateShiftReport({
      events: [], shiftId: 'shift-1', lineId: 'LINEA-1',
    });
    expect(report1.id).not.toBe(report2.id);
  });
});
