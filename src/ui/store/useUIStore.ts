/**
 * Zustand store for UI-only state.
 *
 * Pattern: Actions-Only (AD-5)
 * Why:
 * - Components must NOT call direct setters (setIsSyncing, setIsOnline, etc.).
 * - Instead, they call semantic actions (startSyncing, completeSyncing, goOffline, etc.).
 * - Prevents ad-hoc state mutations spread across screens.
 *
 * Migration:
 * - All internal logic uses the same state fields.
 * - Only the public API changes: components call actions, not setters.
 */

import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';
export type DashboardTimeFilter = 'all' | 'shift' | '24h';

interface UIState {
  // ── State fields (read-only from components) ──
  isDarkMode: boolean;
  dashboardTimeFilter: DashboardTimeFilter;
  showSyncMonitor: boolean;
  isOnline: boolean;
  isLoading: boolean;

  // Sync state
  isSyncing: boolean;
  syncStatus: SyncStatus;
  lastSyncTimestamp: Date | null;
  syncError: string | null;
  pendingCount: number;

  // ── Actions (semantic, no direct setters) ──

  // Theme
  toggleDarkMode: () => void;

  // Dashboard
  setDashboardTimeFilter: (filter: DashboardTimeFilter) => void;

  // Sync monitor
  showSyncMonitorToggle: () => void;

  // Connection (called by network listener, NOT by individual components)
  goOnline: () => void;
  goOffline: () => void;

  // Loading (called by repositories, NOT by individual components)
  startLoading: () => void;
  stopLoading: () => void;

  // Sync lifecycle (called by useReplicationStatus hook, NOT by components)
  startSyncing: () => void;
  completeSyncing: () => void;
  syncFailed: (error: string) => void;
  setIdle: () => void;
  setPendingCount: (count: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // ── Initial state ──
  isDarkMode: false,
  dashboardTimeFilter: 'all',
  showSyncMonitor: true,
  isOnline: true,
  isLoading: false,
  isSyncing: false,
  syncStatus: 'idle',
  lastSyncTimestamp: null,
  syncError: null,
  pendingCount: 0,

  // ── Actions ──

  // Theme
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),

  // Dashboard
  setDashboardTimeFilter: (filter) => set({ dashboardTimeFilter: filter }),

  // Sync monitor
  showSyncMonitorToggle: () => set((state) => ({ showSyncMonitor: !state.showSyncMonitor })),

  // Connection
  goOnline: () => set({ isOnline: true }),
  goOffline: () => set({ isOnline: false, syncStatus: 'offline' }),

  // Loading
  startLoading: () => set({ isLoading: true }),
  stopLoading: () => set({ isLoading: false }),

  // Sync lifecycle
  startSyncing: () => set({ isSyncing: true, syncStatus: 'syncing', syncError: null }),
  completeSyncing: () => set((state) => ({
    isSyncing: false,
    syncStatus: 'idle',
    lastSyncTimestamp: new Date(),
  })),
  syncFailed: (error) => set({
    isSyncing: false,
    syncStatus: 'error',
    syncError: error,
  }),
  setIdle: () => set({ syncStatus: 'idle', syncError: null }),
  setPendingCount: (count) => set({ pendingCount: count }),
}));

// Selector helpers — components use these instead of raw state access
export const selectSyncStatus = (state: UIState) => ({
  isOnline: state.isOnline,
  isSyncing: state.isSyncing,
  syncStatus: state.syncStatus,
  lastSyncTimestamp: state.lastSyncTimestamp,
  syncError: state.syncError,
  pendingCount: state.pendingCount,
});
