/**
 * OEE Events Repository Hook — encapsulates all CRUD operations on the oee_events collection.
 *
 * Pattern: Repository + Hook (Anti-Corruption Layer)
 * Why:
 * - UI components must NEVER interact with RxDB directly.
 * - A repository wraps RxDB collections and exposes a clean API:
 *     createEvent(), update(), remove(), findById(), findByShift(), findActiveDowntime(), docs$
 * - The hook form integrates with React's lifecycle and provides the database
 *   instance from Context.
 *
 * Observable pattern:
 * - docs$ is an RxJS Observable<RxDocument<IOeeEvent>[]> that emits
 *   the current list of non-deleted events on every change.
 *
 * Soft delete:
 * - remove(id) does NOT purge the document.
 * - It sets deleted=true and updated_at=nowMs(), then syncs to server.
 */

import { useCallback, useMemo } from 'react';
import type { Observable } from 'rxjs';
import type { RxDocument } from 'rxdb';

import { generateUuid } from '../utils/uuid';
import { nowMs } from '../utils/timestamp';
import type { IOeeEvent } from '../core/types';
import { useDatabase } from '../data/DatabaseContext';
import { getDeviceId } from '../sync/deviceId';
import { useCatalogStore } from '../ui/store/catalogStore';
import { useAuthStore } from '../auth/useAuthStore';

export type CreateEventPayload = Omit<IOeeEvent, 'id' | 'updated_at' | 'is_deleted' | 'device_id' | 'line_id' | 'machine_id' | 'shift_id'> & Partial<Pick<IOeeEvent, 'line_id' | 'machine_id' | 'shift_id'>> & { device_id?: string };

export interface OeeEventsRepository {
  /** Emits the current list of non-deleted OEE events on every change. */
  docs$: Observable<RxDocument<IOeeEvent>[]>;

  /**
   * Creates a new OEE event with auto-generated fields.
   * Sets id (UUID v4), updated_at, deleted=false automatically.
   *
   * @param event - Event payload (omit id, updated_at, deleted)
   * @returns Promise<RxDocument<IOeeEvent>> the newly created document
   */
  createEvent: (event: CreateEventPayload) => Promise<RxDocument<IOeeEvent>>;

  /**
   * Updates an existing OEE event in place.
   * Sets updated_at to trigger sync.
   *
   * @param id - The event UUID
   * @param patch - Partial event fields to merge
   * @returns Promise<RxDocument<IOeeEvent> | null> the updated document, or null if not found
   */
  update: (id: string, patch: Partial<Omit<IOeeEvent, 'id'>>) => Promise<RxDocument<IOeeEvent> | null>;

  /**
   * Soft-deletes an OEE event (sets deleted=true, updated_at=now).
   *
   * @param id - The event UUID
   */
  remove: (id: string) => Promise<void>;

  /**
   * Finds a single OEE event by UUID.
   *
   * @param id - The event UUID
   * @returns Promise<RxDocument<IOeeEvent> | null>
   */
  findById: (id: string) => Promise<RxDocument<IOeeEvent> | null>;

  /**
   * Returns all non-deleted OEE events for a given shift (one-shot, not observable).
   *
   * @param shiftId - The shift UUID
   * @returns Promise<RxDocument<IOeeEvent>[]>
   */
  findByShift: (shiftId: string) => Promise<RxDocument<IOeeEvent>[]>;

  /**
   * Finds the most recent active downtime_start event for a machine
   * that does NOT have a corresponding downtime_end.
   * This is critical for the UI blocker.
   *
   * @param machineId - The machine UUID
   * @returns Promise<RxDocument<IOeeEvent> | null>
   */
  findActiveDowntime: (machineId: string) => Promise<RxDocument<IOeeEvent> | null>;
}

export function useOeeEventsRepository(): OeeEventsRepository {
  const db = useDatabase();
  const { selectedLine, selectedMachine, selectedShift } = useCatalogStore();
  const user = useAuthStore((state) => state.user) as { id?: string } | null;

  const docs$: Observable<RxDocument<IOeeEvent>[]> = useMemo(
    () =>
      db.collections.oee_events
        .find({ selector: { is_deleted: { $eq: false } } })
        .$,
    [db]
  );

  const createEvent = useCallback(
    async (event: CreateEventPayload) => {
      const deviceId = event.device_id ?? await getDeviceId();
      const evt = event as unknown as Partial<IOeeEvent>;
      const newDoc: IOeeEvent = {
        id: generateUuid(),
        updated_at: nowMs(),
        is_deleted: false,
        device_id: deviceId,
        line_id: evt.line_id ?? selectedLine ?? '',
        machine_id: evt.machine_id ?? selectedMachine ?? '',
        shift_id: evt.shift_id ?? selectedShift ?? '',
        operator_id: evt.operator_id ?? user?.id ?? null,
        event_type: evt.event_type ?? 'box_count',
        timestamp: evt.timestamp ?? nowMs(),
        reason_code: evt.reason_code,
        quantity: evt.quantity,
        planned_boxes: evt.planned_boxes,
        notes: evt.notes,
        is_retroactive: evt.is_retroactive,
        related_event_id: evt.related_event_id,
      } as IOeeEvent;
      const result = await db.collections.oee_events.insert(newDoc);
      return result as RxDocument<IOeeEvent>;
    },
    [db, selectedLine, selectedMachine, selectedShift, user?.id]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<IOeeEvent, 'id'>>) => {
      const doc = await db.collections.oee_events.findOne(id).exec();
      if (!doc) return null;

      await doc.patch({
        ...patch,
        updated_at: nowMs(),
      });
      return doc as RxDocument<IOeeEvent>;
    },
    [db]
  );

  const remove = useCallback(
    async (id: string) => {
      const doc = await db.collections.oee_events.findOne(id).exec();
      if (!doc) return;

      await doc.patch({
        is_deleted: true,
        updated_at: nowMs(),
      });
    },
    [db]
  );

  const findById = useCallback(
    async (id: string) => {
      const doc = await db.collections.oee_events.findOne(id).exec();
      return doc as RxDocument<IOeeEvent> | null;
    },
    [db]
  );

  const findByShift = useCallback(
    async (shiftId: string) => {
      const docs = await db.collections.oee_events
        .find({
          selector: {
            shift_id: { $eq: shiftId },
            is_deleted: { $eq: false },
          },
        })
        .exec();
      return docs as RxDocument<IOeeEvent>[];
    },
    [db]
  );

  const findActiveDowntime = useCallback(
    async (machineId: string) => {
      // Find all non-deleted downtime_start events for this machine
      const startEvents = await db.collections.oee_events
        .find({
          selector: {
            machine_id: { $eq: machineId },
            event_type: { $eq: 'downtime_start' },
            is_deleted: { $eq: false },
          },
          sort: [{ timestamp: 'desc' }],
        })
        .exec();

      // Find all non-deleted downtime_end events that have a related_event_id
      const endEvents = await db.collections.oee_events
        .find({
          selector: {
            machine_id: { $eq: machineId },
            event_type: { $eq: 'downtime_end' },
            is_deleted: { $eq: false },
          },
        })
        .exec();

      const closedStartIds = new Set(
        endEvents.map((e: unknown) => (e as RxDocument<IOeeEvent>).get('related_event_id')).filter(Boolean)
      );

      // Return the most recent downtime_start that is not closed
      for (const event of startEvents) {
        if (!closedStartIds.has((event as RxDocument<IOeeEvent>).get('id'))) {
          return event as RxDocument<IOeeEvent>;
        }
      }

      return null;
    },
    [db]
  );

  return useMemo(
    () => ({ docs$, createEvent, update, remove, findById, findByShift, findActiveDowntime }),
    [docs$, createEvent, update, remove, findById, findByShift, findActiveDowntime]
  );
}
