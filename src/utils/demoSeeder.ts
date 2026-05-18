/**
 * Demo Seeder — inserts realistic OEE event history into RxDB for demo/presentation.
 *
 * Usage: Call `seedDemoData(db, options)` from a dev screen or a long-press gesture.
 * This is a DEMO-ONLY utility — never call in production flows.
 *
 * Generates a realistic 8-hour shift with:
 *  - 1 shift_start
 *  - ~10 box_count checkpoints (normal production rhythm)
 *  - 2 reject_count events (typical merma ~2%)
 *  - 3 downtime events with their matching downtime_end (FMP, MANT, CAM)
 *  - 1 shift_end
 *  - 2 sync_error entries (to illuminate the DLQ supervisor tab)
 */

import type { ChocolateIbarraDatabase } from '../data/database';
import { generateUuid } from './uuid';

export interface DemoSeederOptions {
  lineId?: string;
  machineId?: string;
  shiftId?: string;
  deviceId?: string;
  /** Offset from now in hours. Default -8 (shift started 8h ago). */
  shiftOffsetHours?: number;
}

const DEFAULT_OPTS: Required<DemoSeederOptions> = {
  lineId: 'LINEA-DEMO-1',
  machineId: 'MACH-DEMO-01',
  shiftId: 'SHIFT-DEMO-MANANA',
  deviceId: 'TABLET-DEMO',
  shiftOffsetHours: -8,
};

/**
 * Inserts demo OEE event history + 2 fake sync errors.
 * Returns a summary of what was inserted.
 */
export async function seedDemoData(
  db: ChocolateIbarraDatabase,
  opts: DemoSeederOptions = {}
): Promise<{ eventsInserted: number; errorsInserted: number }> {
  const o = { ...DEFAULT_OPTS, ...opts };
  const shiftStartMs = Date.now() + o.shiftOffsetHours * 60 * 60 * 1000;
  const MIN = 60_000;
  const HR = 60 * MIN;

  // ── Helper: create an OEE event doc ─────────────────────────────────────────
  const ev = (type: string, timestamp: number, extra: Record<string, unknown> = {}) => ({
    id: generateUuid(),
    updated_at: Date.now(),
    is_deleted: false,
    line_id: o.lineId,
    machine_id: o.machineId,
    shift_id: o.shiftId,
    device_id: o.deviceId,
    event_type: type,
    timestamp,
    ...extra,
  });

  // ── Build the timeline ───────────────────────────────────────────────────────
  const events = [];

  // T+0 → shift_start
  events.push(ev('shift_start', shiftStartMs, { planned_boxes: 480 }));

  // T+30min → box_count #1 (normal pace)
  events.push(ev('box_count', shiftStartMs + 30 * MIN, { quantity: 60 }));

  // T+1h → box_count #2
  events.push(ev('box_count', shiftStartMs + 1 * HR, { quantity: 65 }));

  // T+1.5h → reject_count (merma leve)
  events.push(ev('reject_count', shiftStartMs + 1.5 * HR, { quantity: 3 }));

  // T+2h → downtime_start (FMP — Falla Mecánica Producción)
  const dt1Id = generateUuid();
  events.push(ev('downtime_start', shiftStartMs + 2 * HR, {
    id: dt1Id,
    reason_code: 'FMP',
  }));

  // T+2h25min → downtime_end #1 (25min paro)
  events.push(ev('downtime_end', shiftStartMs + 2 * HR + 25 * MIN, {
    related_event_id: dt1Id,
  }));

  // T+3h → box_count #3 (post-paro)
  events.push(ev('box_count', shiftStartMs + 3 * HR, { quantity: 55 }));

  // T+3.5h → box_count #4
  events.push(ev('box_count', shiftStartMs + 3.5 * HR, { quantity: 62 }));

  // T+4h → downtime_start (MANT — Mantenimiento Preventivo)
  const dt2Id = generateUuid();
  events.push(ev('downtime_start', shiftStartMs + 4 * HR, {
    id: dt2Id,
    reason_code: 'MANT',
  }));

  // T+4h10min → downtime_end #2 (10min paro rápido)
  events.push(ev('downtime_end', shiftStartMs + 4 * HR + 10 * MIN, {
    related_event_id: dt2Id,
  }));

  // T+4.5h → box_count #5
  events.push(ev('box_count', shiftStartMs + 4.5 * HR, { quantity: 70 }));

  // T+5h → reject_count (merma moderada)
  events.push(ev('reject_count', shiftStartMs + 5 * HR, { quantity: 5 }));

  // T+5.5h → box_count #6
  events.push(ev('box_count', shiftStartMs + 5.5 * HR, { quantity: 68 }));

  // T+6h → downtime_start (CAM — Cambio de Formato)
  const dt3Id = generateUuid();
  events.push(ev('downtime_start', shiftStartMs + 6 * HR, {
    id: dt3Id,
    reason_code: 'CAM',
  }));

  // T+6h45min → downtime_end #3 (45min changeover)
  events.push(ev('downtime_end', shiftStartMs + 6 * HR + 45 * MIN, {
    related_event_id: dt3Id,
  }));

  // T+7h → box_count #7 (post-changeover)
  events.push(ev('box_count', shiftStartMs + 7 * HR, { quantity: 45 }));

  // T+7.5h → box_count #8 (cierre de turno)
  events.push(ev('box_count', shiftStartMs + 7.5 * HR, { quantity: 50 }));

  // T+8h → shift_end
  events.push(ev('shift_end', shiftStartMs + 8 * HR));

  // ── Insert all OEE events ────────────────────────────────────────────────────
  await db.oee_events.bulkInsert(events as any);

  // ── Insert fake sync errors for DLQ demo ────────────────────────────────────
  // These simulate events that were rejected by Hasura (e.g. foreign key violation)
  const refEventId = events[3].id; // reject_count event — plausible failure
  const refEventId2 = events[0].id; // shift_start with unknown shift_id on server

  const syncErrors = [
    {
      id: generateUuid(),
      id_evento: refEventId,
      payload_original: { event_type: 'reject_count', quantity: 3 },
      mensaje_error: 'Foreign key violation: machine_id "MACH-DEMO-01" not found in server catalog. Verify the machine is registered in Hasura before syncing.',
      fecha: shiftStartMs + 1.5 * HR + 5000,
    },
    {
      id: generateUuid(),
      id_evento: refEventId2,
      payload_original: { event_type: 'shift_start', shift_id: 'SHIFT-DEMO-MANANA' },
      mensaje_error: 'Validation error: shift_id "SHIFT-DEMO-MANANA" does not exist in remote shifts table. Create or sync the shift catalog first.',
      fecha: shiftStartMs + 2000,
    },
  ];

  await db.sync_errors.bulkInsert(syncErrors as any);

  console.log(
    `[demoSeeder] ✅ Inserted ${events.length} OEE events + ${syncErrors.length} sync errors`
  );

  return {
    eventsInserted: events.length,
    errorsInserted: syncErrors.length,
  };
}

/**
 * Clears all demo data from OEE events and sync_errors collections.
 * Useful for resetting between demo runs.
 */
export async function clearDemoData(db: ChocolateIbarraDatabase): Promise<void> {
  await db.oee_events.find().remove();
  await db.sync_errors.find().remove();
  console.log('[demoSeeder] 🧹 Cleared all OEE events and sync errors.');
}
