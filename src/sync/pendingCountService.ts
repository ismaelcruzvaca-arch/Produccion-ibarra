import { Subscription } from 'rxjs';
import { useUIStore } from '../ui/store/useUIStore';
import type { ChocolateIbarraDatabase } from '../data/database';

/**
 * Service to monitor unsynced events and update the UI store.
 * Subscribes to the RxDB oee_events collection.
 */
export function startPendingCountService(db: ChocolateIbarraDatabase): Subscription {
  // Count documents that have NOT been synced yet by checking for absence of
  // the internal RxDB replication field _lastSyncAt. This is an approximation:
  // documents that exist locally but haven't been pushed to the server yet
  // will lack this field. If the field isn't present in the RxDB data at all,
  // the query returns all documents (current behavior preserved as fallback).
  return db.collections.oee_events
    .find({ selector: { _lastSyncAt: { $exists: false } } as any })
    .$.subscribe((events) => {
      useUIStore.getState().setPendingCount(events.length);
    });
}
