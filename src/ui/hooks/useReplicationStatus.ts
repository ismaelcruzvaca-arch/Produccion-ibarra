/**
 * useReplicationStatus — Extracted replication subscription logic from SyncMonitor.
 *
 * Pattern: Hook Extraction (Container/Presentational)
 * Why:
 * - Moves replication subscription logic OUT of the SyncMonitor component.
 * - SyncMonitor becomes a thin presentational component.
 * - Uses the actions-only API from useUIStore.
 *
 * Returns:
 * - lastSyncTime: Date | null — when the last successful sync completed
 * - hasError: boolean — whether the last sync had an error
 * - isSyncing: boolean — whether replication is currently active
 * - syncStatus: SyncStatus — 'idle' | 'syncing' | 'error' | 'offline'
 */

import { useEffect, useRef } from 'react';
import { useReplication } from '../../data/DatabaseContext';
import { useUIStore, selectSyncStatus } from '../store/useUIStore';
import type { SyncStatus } from '../store/useUIStore';

export function useReplicationStatus() {
  const replication = useReplication();
  const syncInfo = useUIStore(selectSyncStatus);
  const { syncStatus } = syncInfo;
  const { startSyncing, completeSyncing, syncFailed, setIdle } = useUIStore();

  const prevStatusRef = useRef<SyncStatus>('idle');

  useEffect(() => {
    if (!replication) return;

    const { assets, workOrders, oeeEvents } = replication;
    const subs: Array<() => void> = [];

    const handleActive = (active: boolean) => {
      if (active) {
        startSyncing();
      } else {
        if (prevStatusRef.current === 'syncing') {
          completeSyncing();
        }
      }
      prevStatusRef.current = active ? 'syncing' : syncStatus;
    };

    const subAssetsActive = assets.active$.subscribe(handleActive);
    const subWorkOrdersActive = workOrders.active$.subscribe(handleActive);
    subs.push(() => subAssetsActive.unsubscribe(), () => subWorkOrdersActive.unsubscribe());

    if (oeeEvents) {
      const subOeeActive = oeeEvents.active$.subscribe(handleActive);
      subs.push(() => subOeeActive.unsubscribe());
    }

    const handleError = (err: Error | undefined) => {
      if (err) {
        syncFailed(err.message);
      }
    };

    const subAssetsError = assets.error$.subscribe(handleError);
    const subWorkOrdersError = workOrders.error$.subscribe(handleError);
    subs.push(() => subAssetsError.unsubscribe(), () => subWorkOrdersError.unsubscribe());

    if (oeeEvents) {
      const subOeeError = oeeEvents.error$.subscribe(handleError);
      subs.push(() => subOeeError.unsubscribe());
    }

    return () => {
      subs.forEach((unsub) => unsub());
    };
  }, [replication, startSyncing, completeSyncing, syncFailed, setIdle, syncStatus]);

  return {
    lastSyncTime: syncInfo.lastSyncTimestamp,
    hasError: syncInfo.syncStatus === 'error',
    isSyncing: syncInfo.isSyncing,
    syncStatus: syncInfo.syncStatus,
    syncError: syncInfo.syncError,
  };
}
