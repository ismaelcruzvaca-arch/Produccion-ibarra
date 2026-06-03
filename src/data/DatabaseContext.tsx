/**
 * Database Context — React dependency injection for the RxDB singleton and replication states.
 *
 * Pattern: Context + Hook (DI Container)
 * Why:
 * - The database needs to be shared across many components without prop drilling.
 * - The database is async and lazy-initialized — the context handles the loading state.
 * - Replication states are also shared to allow UI components (SyncMonitor) to observe sync status.
 * - This follows the standard React pattern for framework-level singletons (like Redux Provider).
 *
 * Usage:
 *   <DatabaseProvider>
 *     <App />
 *   </DatabaseProvider>
 *
 * Inside any child component:
 *   const db = useDatabase();
 *   const replication = useReplication();
 *   const assets = await db.collections.assets.find().exec();
 */

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { getDatabase, type ChocolateIbarraDatabase } from './database';
import { startReplication, type ReplicationStates } from '../graphql/sync';
import { startPendingCountService } from '../sync/pendingCountService';
import type { Subscription } from 'rxjs';

// ─── Database Context ──────────────────────────────────────────────────────────

const DatabaseContext = createContext<ChocolateIbarraDatabase | undefined>(undefined);

// ─── Replication Context ───────────────────────────────────────────────────────

const ReplicationContext = createContext<ReplicationStates | undefined>(undefined);

// ─── Provider Props ────────────────────────────────────────────────────────────

interface DatabaseProviderProps {
  children: ReactNode;
}

// ─── DatabaseProvider ──────────────────────────────────────────────────────────

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [db, setDb] = useState<ChocolateIbarraDatabase | undefined>(undefined);
  const [replication, setReplication] = useState<ReplicationStates | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);

  useEffect(() => {
    let mounted = true;
    let pendingCountSub: Subscription | undefined;
    const resilientControllers: Array<{ cleanup: () => void }> = [];

    getDatabase()
      .then((database) => {
        if (!mounted) return;

        // Bypass replication on Web/E2E — RxDB GraphQL replication requires the Node.js 'ws'
        // (WebSocket) module which does NOT exist in the browser. This causes a fatal bundle
        // crash that cannot be caught with try/catch because it happens inside the RxDB
        // replication-graphql plugin during module resolution.
        //
        // On native (iOS/Android) 'ws' is available, so replication will work there.
        // On web we run 100% offline-first (Dexie/IndexedDB) with manual sync later.
        const isWeb = typeof window !== 'undefined' && typeof window.document !== 'undefined';
        if (isWeb || process.env.EXPO_PUBLIC_SKIP_SYNC === 'true') {
          console.warn(
            'Web/E2E mode: skipping RxDB GraphQL replication. App runs offline-first.'
          );
          if (mounted) {
            setDb(database);
            setReplication(undefined);
          }
          return;
        }

        // Start replication after database is ready
        // Wrap in try/catch so a replication error (e.g. missing ws module in browser)
        // does NOT crash the entire React tree. The app must render even if sync fails.
        let replicationStates: ReplicationStates | undefined = undefined;
        try {
          replicationStates = startReplication(database);
        } catch (syncErr) {
          console.warn('RxDB replication failed to start — app will run offline:', syncErr);
        }

        if (replicationStates) {
          // Collect resilient replication controllers for cleanup on unmount
          const oeeCtrl = replicationStates.resilientOeeController;
          if (oeeCtrl) resilientControllers.push(oeeCtrl);
          const sigCtrl = replicationStates.resilientSignaturesController;
          if (sigCtrl) resilientControllers.push(sigCtrl);
          const qiCtrl = replicationStates.resilientQualityInspectionsController;
          if (qiCtrl) resilientControllers.push(qiCtrl);
          const dlCtrl = replicationStates.resilientDefectLogsController;
          if (dlCtrl) resilientControllers.push(dlCtrl);
          const wlCtrl = replicationStates.resilientWeightLogsController;
          if (wlCtrl) resilientControllers.push(wlCtrl);
        }

        if (mounted) {
          setDb(database);
          setReplication(replicationStates);
          pendingCountSub = startPendingCountService(database);
        }
      })
      .catch((err) => {
        if (mounted) setError(err);
      });

    return () => {
      mounted = false;
      pendingCountSub?.unsubscribe();
      resilientControllers.forEach((ctrl) => ctrl.cleanup());
    };
  }, []);

  // Propagate initialization errors to the nearest error boundary
  if (error) {
    throw error;
  }

  // Loading state — could be replaced with a SplashScreen component
  if (!db) {
    return null;
  }

  return (
    <DatabaseContext.Provider value={db}>
      <ReplicationContext.Provider value={replication}>
        {children}
      </ReplicationContext.Provider>
    </DatabaseContext.Provider>
  );
}

// ─── useDatabase Hook ──────────────────────────────────────────────────────────

export function useDatabase(): ChocolateIbarraDatabase {
  const db = useContext(DatabaseContext);
  if (db === undefined) {
    throw new Error(
      'useDatabase must be used inside a <DatabaseProvider>. ' +
      'Wrap your root component with <DatabaseProvider> first.'
    );
  }
  return db;
}

// ─── useReplication Hook ───────────────────────────────────────────────────────

export function useReplication(): ReplicationStates | undefined {
  return useContext(ReplicationContext);
}
