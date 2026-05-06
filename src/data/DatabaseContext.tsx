/**
 * Database Context — React dependency injection for the RxDB singleton.
 *
 * Pattern: Context + Hook (DI Container)
 * Why:
 * - The database needs to be shared across many components without prop drilling.
 * - The database is async and lazy-initialized — the context handles the loading state.
 * - This follows the standard React pattern for framework-level singletons (like Redux Provider).
 *
 * Usage:
 *   <DatabaseProvider>
 *     <App />
 *   </DatabaseProvider>
 *
 * Inside any child component:
 *   const db = useDatabase();
 *   const assets = await db.collections.assets.find().exec();
 *
 * The provider renders null during initialization — replace with a SplashScreen
 * if you need a branded loading state.
 */

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { getDatabase, type ChocolateIbarraDatabase } from './database';

/**
 * The shape of what DatabaseContext provides to consumers.
 * We cast to the actual database type at the useDatabase() call site.
 */
const DatabaseContext = createContext<ChocolateIbarraDatabase | undefined>(undefined);

interface DatabaseProviderProps {
  children: ReactNode;
}

/**
 * DatabaseProvider — wraps the app and initializes the RxDB singleton.
 *
 * Responsibilities:
 * - Call getDatabase() on mount (triggers lazy init)
 * - Manage loading/error states
 * - Provide the database instance to all children via Context
 */
export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [db, setDb] = useState<ChocolateIbarraDatabase | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);

  useEffect(() => {
    let mounted = true;

    getDatabase()
      .then((database) => {
        if (mounted) setDb(database);
      })
      .catch((err) => {
        if (mounted) setError(err);
      });

    // Cleanup: prevent state updates after unmount
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
      {children}
    </DatabaseContext.Provider>
  );
}

/**
 * Hook to access the RxDB database instance.
 *
 * REQUIREMENT: Must be called within a <DatabaseProvider> tree.
 * Throws a descriptive error otherwise — fail-fast prevents subtle bugs.
 *
 * @returns {ChocolateIbarraDatabase} The RxDB database instance
 */
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