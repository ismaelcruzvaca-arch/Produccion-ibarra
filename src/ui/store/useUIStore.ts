/**
 * Zustand store for UI-only state.
 *
 * Why Zustand:
 * - RxDB handles all domain/data state (sync, collections, queries).
 * - Zustand handles purely visual/UI state (theme, modals, loading spinners, sync status).
 * - Keeps UI concerns separate from data layer.
 */

import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';
export type DashboardTimeFilter = 'all' | 'shift' | '24h';

interface UIState {
  // Theme
  isDarkMode: boolean;
  toggleDarkMode: () => void;

  // Dashboard time filter
  dashboardTimeFilter: DashboardTimeFilter;
  setDashboardTimeFilter: (filter: DashboardTimeFilter) => void;

  // Sync monitor visibility
  showSyncMonitor: boolean;
  setShowSyncMonitor: (show: boolean) => void;

  // Connection status (for UI feedback only)
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;

  // Global loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // ── Sync state (updated by SyncMonitor from RxDB replication observables) ──
  isSyncing: boolean;
  syncStatus: SyncStatus;
  lastSyncTimestamp: Date | null;
  syncError: string | null;

  setIsSyncing: (syncing: boolean) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncTimestamp: (timestamp: Date | null) => void;
  setSyncError: (error: string | null) => void;
  
  // Pending sync count
  pendingCount: number;
  setPendingCount: (count: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Theme
  isDarkMode: false,
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),

  // Dashboard time filter
  dashboardTimeFilter: 'all',
  setDashboardTimeFilter: (filter) => set({ dashboardTimeFilter: filter }),

  // Sync monitor visibility
  showSyncMonitor: true,
  setShowSyncMonitor: (show) => set({ showSyncMonitor: show }),

  // Connection
  isOnline: true,
  setIsOnline: (online) => set({ isOnline: online }),

  // Loading
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  // Sync state
  isSyncing: false,
  syncStatus: 'idle',
  lastSyncTimestamp: null,
  syncError: null,

  setIsSyncing: (syncing) => set({ isSyncing: syncing }),
  setSyncStatus: (status) => set({ syncStatus: status }),
  setLastSyncTimestamp: (timestamp) => set({ lastSyncTimestamp: timestamp }),
  setSyncError: (error) => set({ syncError: error }),
  
  // Pending count
  pendingCount: 0,
  setPendingCount: (count) => set({ pendingCount: count }),
}));
