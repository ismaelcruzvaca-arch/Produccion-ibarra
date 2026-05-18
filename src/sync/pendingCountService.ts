import { Subscription } from 'rxjs';
import { useUIStore } from '../ui/store/useUIStore';
import type { ChocolateIbarraDatabase } from '../data/database';

/**
 * Service to monitor unsynced events and update the UI store.
 * Subscribes to the RxDB oee_events collection.
 */
export function startPendingCountService(db: ChocolateIbarraDatabase): Subscription {
  return db.collections.oee_events.find().$.subscribe((events) => {
    // In a real replication scenario we might check for docs not yet pushed.
    // For now, we update the pending count based on local events.
    useUIStore.getState().setPendingCount(events.length);
  });
}
