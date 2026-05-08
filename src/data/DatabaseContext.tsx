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

    getDatabase()
      .then((database) => {
        if (!mounted) return;

        // Bypass replication in CI — RxDB WebSocket crashes without a live Nhost backend
        if (process.env.CI === 'true') {
          console.warn(
            'CI environment detected: skipping RxDB GraphQL replication to prevent WS crash.'
          );
          if (mounted) {
            setDb(database);
            setReplication(undefined);
          }
          return;
        }

        // Start replication after database is ready
        const replicationStates = startReplication(database);

        if (mounted) {
          setDb(database);
          setReplication(replicationStates);
        }
      })
      .catch((err) => {
        if (mounted) setError(err);
      });

    return () => {
      mounted = false;
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
