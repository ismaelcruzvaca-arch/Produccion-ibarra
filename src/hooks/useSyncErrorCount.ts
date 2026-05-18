/**
 * useSyncErrorCount — reactive hook that returns the count of pending sync errors.
 *
 * Used by _layout.tsx to render the badge on the "Alertas" supervisor tab.
 * Subscribes to the sync_errors RxDB collection so the count updates in real time.
 *
 * Returns 0 when:
 *  - The database is not yet initialized
 *  - There are no sync errors
 */

import { useState, useEffect } from 'react';
import { useDatabase } from '../data/DatabaseContext';

export function useSyncErrorCount(): number {
  const db = useDatabase();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!db) return;
    const subscription = db.sync_errors
      .count()
      .$.subscribe((n: number) => setCount(n));
    return () => subscription.unsubscribe();
  }, [db]);

  return count;
}
