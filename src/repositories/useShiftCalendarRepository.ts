/**
 * Shift Calendar Repository Hook — CRUD operations on shift_calendar_slots and
 * shift_calendar_exceptions collections, plus active-slot resolution for
 * auto-shift-detection.
 *
 * Pattern: Repository + Hook (Anti-Corruption Layer)
 * Why:
 * - UI components must NOT interact with RxDB directly.
 * - Encapsulates overlap validation, exception resolution, and date logic.
 *
 * Uses `updated_at` (not `client_updated_at`) matching the newer data contract.
 */

import { useCallback, useMemo } from 'react';
import type { Observable } from 'rxjs';
import type { RxDocument } from 'rxdb';

import { generateUuid } from '../utils/uuid';
import { nowMs } from '../utils/timestamp';
import type {
  IShiftCalendarSlot,
  IShiftCalendarException,
  ShiftType,
} from '../core/types';
import { useDatabase } from '../data/DatabaseContext';
import { getDeviceId } from '../sync/deviceId';

// ─── Domain Types ───────────────────────────────────────────────────────────────

export type CreateSlotPayload = Omit<
  IShiftCalendarSlot,
  'id' | 'created_at' | 'updated_at' | 'is_deleted' | 'device_id'
> & { device_id?: string };

export type UpdateSlotPayload = Partial<Omit<IShiftCalendarSlot, 'id'>>;

export type CreateExceptionPayload = Omit<
  IShiftCalendarException,
  'id' | 'created_at' | 'updated_at' | 'is_deleted' | 'device_id'
> & { device_id?: string };

export type UpdateExceptionPayload = Partial<Omit<IShiftCalendarException, 'id'>>;

/**
 * Result of resolving which slot is active at a given time for a line.
 * Returns null if no slot is active (holiday, Sunday, no match).
 */
export interface ActiveSlotInfo {
  line_id: string;
  shift_type: ShiftType;
  start_time: string;     // HH:mm
  end_time: string;       // HH:mm
  source: 'slot' | 'override' | 'extraordinary';
  slot_id?: string;
  exception_id?: string;
}

// ─── Helper: Time / Date formatting ─────────────────────────────────────────────

/**
 * Formats an epoch-ms timestamp to YYYY-MM-DD in local time.
 */
function formatDate(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Formats an epoch-ms timestamp to HH:mm in local time.
 */
function formatHHmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── Overlap Detection ───────────────────────────────────────────────────────────

/**
 * Checks whether two HH:mm intervals overlap.
 * Uses lexicographic string comparison (valid for 24h HH:mm format).
 */
function intervalsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return startA < endB && startB < endA;
}

// ─── Repository Interface ────────────────────────────────────────────────────────

export interface ShiftCalendarRepository {
  /** Emits all non-deleted slots on change */
  slots$: Observable<RxDocument<IShiftCalendarSlot>[]>;
  /** Emits all non-deleted exceptions on change */
  exceptions$: Observable<RxDocument<IShiftCalendarException>[]>;

  // ── Slot CRUD ──────────────────────────────────────────────────────────────

  createSlot: (payload: CreateSlotPayload) => Promise<RxDocument<IShiftCalendarSlot>>;
  updateSlot: (id: string, patch: UpdateSlotPayload) => Promise<RxDocument<IShiftCalendarSlot> | null>;
  removeSlot: (id: string) => Promise<void>;
  findSlotById: (id: string) => Promise<RxDocument<IShiftCalendarSlot> | null>;
  findAllSlots: () => Promise<RxDocument<IShiftCalendarSlot>[]>;

  /**
   * Finds slots for a specific line and day of week.
   * Used internally by getActiveSlot.
   */
  findSlotsByLineAndDay: (
    lineId: string,
    dayOfWeek: number,
  ) => Promise<RxDocument<IShiftCalendarSlot>[]>;

  /**
   * Validates that a new/updated slot does not overlap existing slots
   * for the same line + day_of_week.
   * @returns error message or null if valid
   */
  validateSlotOverlap: (
    lineId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    excludeSlotId?: string,
  ) => Promise<string | null>;

  // ── Exception CRUD ────────────────────────────────────────────────────────

  createException: (payload: CreateExceptionPayload) => Promise<RxDocument<IShiftCalendarException>>;
  updateException: (id: string, patch: UpdateExceptionPayload) => Promise<RxDocument<IShiftCalendarException> | null>;
  removeException: (id: string) => Promise<void>;
  findExceptionById: (id: string) => Promise<RxDocument<IShiftCalendarException> | null>;
  findAllExceptions: () => Promise<RxDocument<IShiftCalendarException>[]>;
  findExceptionsByDate: (date: string) => Promise<RxDocument<IShiftCalendarException>[]>;
  findExceptionsByDateAndLine: (
    date: string,
    lineId: string,
  ) => Promise<RxDocument<IShiftCalendarException>[]>;

  // ── Active Slot Resolution ────────────────────────────────────────────────

  /**
   * Resolves the active slot for a given line at a given time.
   *
   * Resolution order:
   * 1. Holiday exception → null
   * 2. Override exception → use override hours (shift_type falls back to slot)
   * 3. Extraordinary exception → ad-hoc slot
   * 4. Sunday (day_of_week === 0) → null
   * 5. Weekly recurring slots → match by day_of_week + time range
   *
   * @param lineId - production line ID
   * @param time - epoch ms timestamp
   * @returns ActiveSlotInfo or null if no slot is active
   */
  getActiveSlot: (lineId: string, time: number) => Promise<ActiveSlotInfo | null>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────────

export function useShiftCalendarRepository(): ShiftCalendarRepository {
  const db = useDatabase();

  // ── Observables ──────────────────────────────────────────────────────────────

  const slots$: Observable<RxDocument<IShiftCalendarSlot>[]> = useMemo(
    () =>
      db.collections.shift_calendar_slots
        .find({ selector: { is_deleted: { $eq: false } } })
        .$,
    [db],
  );

  const exceptions$: Observable<RxDocument<IShiftCalendarException>[]> = useMemo(
    () =>
      db.collections.shift_calendar_exceptions
        .find({ selector: { is_deleted: { $eq: false } } })
        .$,
    [db],
  );

  // ── Slot CRUD ────────────────────────────────────────────────────────────────

  const createSlot = useCallback(
    async (payload: CreateSlotPayload) => {
      // Validate overlap before creating
      const overlapError = await checkOverlap(
        db,
        payload.line_id,
        payload.day_of_week,
        payload.start_time,
        payload.end_time,
      );
      if (overlapError) {
        throw new Error(overlapError);
      }

      const deviceId = payload.device_id ?? await getDeviceId();
      const newDoc: IShiftCalendarSlot = {
        id: generateUuid(),
        created_at: nowMs(),
        updated_at: nowMs(),
        is_deleted: false,
        device_id: deviceId,
        day_of_week: payload.day_of_week,
        start_time: payload.start_time,
        end_time: payload.end_time,
        line_id: payload.line_id,
        shift_type: payload.shift_type,
      };
      const result = await db.collections.shift_calendar_slots.insert(newDoc);
      return result as RxDocument<IShiftCalendarSlot>;
    },
    [db],
  );

  const updateSlot = useCallback(
    async (id: string, patch: UpdateSlotPayload) => {
      const doc = await db.collections.shift_calendar_slots.findOne(id).exec();
      if (!doc) return null;

      // If time or day changed, validate overlap (exclude self)
      if (patch.start_time || patch.end_time || patch.day_of_week !== undefined || patch.line_id) {
        const current = doc.toJSON() as IShiftCalendarSlot;
        const lineId = patch.line_id ?? current.line_id;
        const dayOfWeek = patch.day_of_week ?? current.day_of_week;
        const startTime = patch.start_time ?? current.start_time;
        const endTime = patch.end_time ?? current.end_time;

        const overlapError = await checkOverlap(db, lineId, dayOfWeek, startTime, endTime, id);
        if (overlapError) {
          throw new Error(overlapError);
        }
      }

      await doc.patch({ ...patch, updated_at: nowMs() });
      return doc as RxDocument<IShiftCalendarSlot>;
    },
    [db],
  );

  const removeSlot = useCallback(
    async (id: string) => {
      const doc = await db.collections.shift_calendar_slots.findOne(id).exec();
      if (!doc) return;
      await doc.patch({ is_deleted: true, updated_at: nowMs() });
    },
    [db],
  );

  const findSlotById = useCallback(
    async (id: string) => {
      const doc = await db.collections.shift_calendar_slots.findOne(id).exec();
      return doc as RxDocument<IShiftCalendarSlot> | null;
    },
    [db],
  );

  const findAllSlots = useCallback(
    async () => {
      const docs = await db.collections.shift_calendar_slots
        .find({ selector: { is_deleted: { $eq: false } } })
        .exec();
      return docs as RxDocument<IShiftCalendarSlot>[];
    },
    [db],
  );

  const findSlotsByLineAndDay = useCallback(
    async (lineId: string, dayOfWeek: number) => {
      const docs = await db.collections.shift_calendar_slots
        .find({
          selector: {
            line_id: { $eq: lineId },
            day_of_week: { $eq: dayOfWeek },
            is_deleted: { $eq: false },
          },
          sort: [{ start_time: 'asc' }],
        })
        .exec();
      return docs as RxDocument<IShiftCalendarSlot>[];
    },
    [db],
  );

  // ── Overlap Validation ───────────────────────────────────────────────────────

  const validateSlotOverlap = useCallback(
    async (
      lineId: string,
      dayOfWeek: number,
      startTime: string,
      endTime: string,
      excludeSlotId?: string,
    ) => {
      return checkOverlap(db, lineId, dayOfWeek, startTime, endTime, excludeSlotId);
    },
    [db],
  );

  // ── Exception CRUD ───────────────────────────────────────────────────────────

  const createException = useCallback(
    async (payload: CreateExceptionPayload) => {
      const deviceId = payload.device_id ?? await getDeviceId();
      const newDoc: IShiftCalendarException = {
        id: generateUuid(),
        created_at: nowMs(),
        updated_at: nowMs(),
        is_deleted: false,
        device_id: deviceId,
        date: payload.date,
        type: payload.type,
        line_id: payload.line_id,
        slot_id: payload.slot_id,
        start_time: payload.start_time,
        end_time: payload.end_time,
        shift_type: payload.shift_type,
        description: payload.description,
      };
      const result = await db.collections.shift_calendar_exceptions.insert(newDoc);
      return result as RxDocument<IShiftCalendarException>;
    },
    [db],
  );

  const updateException = useCallback(
    async (id: string, patch: UpdateExceptionPayload) => {
      const doc = await db.collections.shift_calendar_exceptions.findOne(id).exec();
      if (!doc) return null;
      await doc.patch({ ...patch, updated_at: nowMs() });
      return doc as RxDocument<IShiftCalendarException>;
    },
    [db],
  );

  const removeException = useCallback(
    async (id: string) => {
      const doc = await db.collections.shift_calendar_exceptions.findOne(id).exec();
      if (!doc) return;
      await doc.patch({ is_deleted: true, updated_at: nowMs() });
    },
    [db],
  );

  const findExceptionById = useCallback(
    async (id: string) => {
      const doc = await db.collections.shift_calendar_exceptions.findOne(id).exec();
      return doc as RxDocument<IShiftCalendarException> | null;
    },
    [db],
  );

  const findAllExceptions = useCallback(
    async () => {
      const docs = await db.collections.shift_calendar_exceptions
        .find({ selector: { is_deleted: { $eq: false } } })
        .exec();
      return docs as RxDocument<IShiftCalendarException>[];
    },
    [db],
  );

  const findExceptionsByDate = useCallback(
    async (date: string) => {
      const docs = await db.collections.shift_calendar_exceptions
        .find({
          selector: {
            date: { $eq: date },
            is_deleted: { $eq: false },
          },
        })
        .exec();
      return docs as RxDocument<IShiftCalendarException>[];
    },
    [db],
  );

  const findExceptionsByDateAndLine = useCallback(
    async (date: string, lineId: string) => {
      const docs = await db.collections.shift_calendar_exceptions
        .find({
          selector: {
            date: { $eq: date },
            line_id: { $eq: lineId },
            is_deleted: { $eq: false },
          },
        })
        .exec();
      return docs as RxDocument<IShiftCalendarException>[];
    },
    [db],
  );

  // ── Active Slot Resolution ──────────────────────────────────────────────────

  const getActiveSlot = useCallback(
    async (lineId: string, time: number): Promise<ActiveSlotInfo | null> => {
      const dateStr = formatDate(time);
      const dayOfWeek = new Date(time).getDay(); // 0=Sun, 6=Sat
      const timeStr = formatHHmm(time);

      // 1. Fetch exceptions for this date + line
      const exceptions = await db.collections.shift_calendar_exceptions
        .find({
          selector: {
            date: { $eq: dateStr },
            line_id: { $eq: lineId },
            is_deleted: { $eq: false },
          },
        })
        .exec();

      const exceptionDocs = exceptions.map((d) => d.toJSON() as IShiftCalendarException);

      // 2. Holiday cancels everything
      const holiday = exceptionDocs.find((e) => e.type === 'holiday');
      if (holiday) return null;

      // Helper to check if current time falls within a time range
      const isTimeInRange = (start: string, end: string): boolean =>
        timeStr >= start && timeStr < end;

      // 3. Override — replaces recurring slot hours for this date
      const override = exceptionDocs.find((e) => e.type === 'override');
      if (override && override.start_time && override.end_time) {
        if (isTimeInRange(override.start_time, override.end_time)) {
          // Resolve shift_type: use override's value, or fall back to the
          // original slot if slot_id is provided
          let shiftType = override.shift_type;
          if (!shiftType && override.slot_id) {
            const slotDoc = await db.collections.shift_calendar_slots
              .findOne(override.slot_id)
              .exec();
            if (slotDoc) {
              shiftType = (slotDoc.toJSON() as IShiftCalendarSlot).shift_type;
            }
          }

          return {
            line_id: lineId,
            shift_type: shiftType ?? 'matutino',
            start_time: override.start_time,
            end_time: override.end_time,
            source: 'override',
            slot_id: override.slot_id,
            exception_id: override.id,
          };
        }
      }

      // 4. Extraordinary — ad-hoc slot for this date
      const extraordinary = exceptionDocs.find((e) => e.type === 'extraordinary');
      if (extraordinary && extraordinary.start_time && extraordinary.end_time) {
        if (isTimeInRange(extraordinary.start_time, extraordinary.end_time)) {
          return {
            line_id: lineId,
            shift_type: extraordinary.shift_type ?? 'matutino',
            start_time: extraordinary.start_time,
            end_time: extraordinary.end_time,
            source: 'extraordinary',
            exception_id: extraordinary.id,
          };
        }
      }

      // 5. Sunday default rule — no production
      if (dayOfWeek === 0) return null;

      // 6. Fallback to weekly recurring slots
      const slots = await db.collections.shift_calendar_slots
        .find({
          selector: {
            line_id: { $eq: lineId },
            day_of_week: { $eq: dayOfWeek },
            is_deleted: { $eq: false },
          },
        })
        .exec();

      const slotDocs = slots.map((d) => d.toJSON() as IShiftCalendarSlot);
      const activeSlot = slotDocs.find((s) => isTimeInRange(s.start_time, s.end_time));

      if (!activeSlot) return null;

      return {
        line_id: lineId,
        shift_type: activeSlot.shift_type,
        start_time: activeSlot.start_time,
        end_time: activeSlot.end_time,
        source: 'slot',
        slot_id: activeSlot.id,
      };
    },
    [db],
  );

  // ── Return ────────────────────────────────────────────────────────────────────

  return useMemo(
    () => ({
      slots$,
      exceptions$,
      createSlot,
      updateSlot,
      removeSlot,
      findSlotById,
      findAllSlots,
      findSlotsByLineAndDay,
      validateSlotOverlap,
      createException,
      updateException,
      removeException,
      findExceptionById,
      findAllExceptions,
      findExceptionsByDate,
      findExceptionsByDateAndLine,
      getActiveSlot,
    }),
    [
      slots$,
      exceptions$,
      createSlot,
      updateSlot,
      removeSlot,
      findSlotById,
      findAllSlots,
      findSlotsByLineAndDay,
      validateSlotOverlap,
      createException,
      updateException,
      removeException,
      findExceptionById,
      findAllExceptions,
      findExceptionsByDate,
      findExceptionsByDateAndLine,
      getActiveSlot,
    ],
  );
}

// ─── Module-Level Helper ─────────────────────────────────────────────────────────

/**
 * Checks if a new/updated slot would overlap existing slots for the same
 * line + day_of_week. Used both by createSlot and updateSlot.
 */
async function checkOverlap(
  db: ReturnType<typeof useDatabase>,
  lineId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  excludeSlotId?: string,
): Promise<string | null> {
  const existing = await db.collections.shift_calendar_slots
    .find({
      selector: {
        line_id: { $eq: lineId },
        day_of_week: { $eq: dayOfWeek },
        is_deleted: { $eq: false },
      },
    })
    .exec();

  for (const doc of existing) {
    const slot = doc.toJSON() as IShiftCalendarSlot;
    if (excludeSlotId && slot.id === excludeSlotId) continue;
    if (intervalsOverlap(startTime, endTime, slot.start_time, slot.end_time)) {
      return `El horario ${startTime}-${endTime} se sobrepone con el slot existente ${slot.start_time}-${slot.end_time} para esta línea y día`;
    }
  }

  return null;
}
