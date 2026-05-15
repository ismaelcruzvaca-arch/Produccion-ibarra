/**
 * Pending Count Service — bridges RxDB oee_events collection with Zustand UI store.
 *
 * Pattern: Service / Observer
 * Why:
 * - The OEE Dashboard needs to display the count of unsynced OEE events.
 * - This service subscribes to the oee_events RxDB collection and counts
 *   documents that have been modified locally AFTER the last successful sync.
 * - The count is written to useUIStore.setPendingOeeCount() so the UI can react.
 * - Optionally subscribes to the replication state's active$ to detect when
 *   sync completes and reset the counter.
 *
 * Business rule: count ONLY unsynced documents (updated_at > lastSyncTimestamp).
 * Using lastSyncTimestamp from the UI store is more reliable than _rev heuristics,
 * which vary across RxDB versions and server responses.
 */

import { map, distinctUntilChanged } from 'rxjs/operators';
import type { Subscription } from 'rxjs';
import type { RxGraphQLReplicationState } from 'rxdb/plugins/replication-graphql';

import type { ChocolateIbarraDatabase } from '../data/database';
import type { IOeeEvent } from '../core/types';
import { useUIStore } from '../ui/store/useUIStore';

/**
 * Starts the pending-count subscription.
 *
 * Subscribes to oee_events collection and counts non-deleted docs whose
 * internal revision suggests they are local-only (not yet server-confirmed).
 *
 * Optionally listens to the replication state's active$ to reset the counter
 * when a sync cycle completes without errors.
 *
 * @param db - The RxDB database instance
 * @param replicationState - Optional OEE replication state for active$ detection
 * @returns Cleanup function to unsubscribe
 */
export function startPendingCountService(
  db: ChocolateIbarraDatabase,
  replicationState?: RxGraphQLReplicationState<IOeeEvent, unknown>
): () => void {
  const subscriptions: Subscription[] = [];

  // ── Subscribe to oee_events collection ───────────────────────────────────

  const countSub = db.collections.oee_events
    .find({ selector: { deleted: { $eq: false } } })
    .$.pipe(
      map((docs) => {
        // Count ONLY documents that haven't been synced yet.
        // Business rule: a document is "pending" if its updated_at is newer
        // than the last successful sync timestamp. If we have never synced,
        // all local documents are considered pending.
        const lastSync = useUIStore.getState().lastSyncTimestamp;
        return docs.filter((doc) => {
          try {
            const updatedAt = (doc as any).updated_at ?? (doc as any).client_updated_at;
            if (typeof updatedAt !== 'number') return false;
            if (!lastSync) return true; // never synced → everything is pending
            return updatedAt > lastSync.getTime();
          } catch {
            return false;
          }
        }).length;
      }),
      distinctUntilChanged()
    )
    .subscribe((count) => {
      useUIStore.getState().setPendingOeeCount(count);
    });

  subscriptions.push(countSub);

  // ── Optionally listen to replication active$ to detect sync completion ───

  if (replicationState) {
    const activeSub = replicationState.active$
      .pipe(distinctUntilChanged())
      .subscribe((active) => {
        if (!active) {
          // Replication just finished a cycle — check if there are still errors
          // If no current error, assume sync succeeded and reset the pending count.
          // We check this on the next tick to let error$ propagate first.
          setTimeout(() => {
            const currentError = useUIStore.getState().syncError;
            if (!currentError) {
              // Sync cycle completed successfully — reset to 0
              // The count subscription above will immediately re-count any
              // docs that are still local-only
              useUIStore.getState().setPendingOeeCount(0);
            }
          }, 100);
        }
      });

    subscriptions.push(activeSub as Subscription);
  }

  // ── Return cleanup ───────────────────────────────────────────────────────

  return () => {
    subscriptions.forEach((sub) => sub.unsubscribe());
    useUIStore.getState().setPendingOeeCount(0);
  };
}
