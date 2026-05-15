/**
 * Pending Count Service — bridges RxDB oee_events collection with Zustand UI store.
 *
 * Pattern: Service / Observer
 * Why:
 * - The OEE Dashboard needs to display the count of unsynced OEE events.
 * - This service subscribes to the oee_events RxDB collection and counts
 *   documents that appear to be local-only (not yet confirmed synced by the server).
 * - The count is written to useUIStore.setPendingOeeCount() so the UI can react.
 * - Optionally subscribes to the replication state's active$ to detect when
 *   sync completes and reset the counter.
 *
 * Heuristic for "unsynced" detection:
 * - Documents where `_rev` (RxDB internal revision) starts with a digit-dash
 *   pattern are local-only docs that haven't been acknowledged by the server.
 * - This is a heuristic; in practice, ALL docs in a local-first setup start
 *   with a local revision prefix. When replication is active, the count resets
 *   to 0 on successful sync completion.
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
        // Heuristic: RxDB local-only documents have _rev in format
        // "{instanceToken}-{hash}". After server acknowledgment via
        // replicateGraphQL, the revision structure changes.
        // We filter for _rev starting with digit+dash (e.g. "1-abc123...")
        // which is the local-only revision pattern.
        return docs.filter((doc) => {
          try {
            const rev: string = (doc as any)._rev;
            return typeof rev === 'string' && /^\d+-/.test(rev);
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
