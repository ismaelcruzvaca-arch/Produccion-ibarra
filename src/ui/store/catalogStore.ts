/**
 * Zustand store for catalog data with AsyncStorage persistence.
 *
 * Pattern: Zustand + persist middleware
 * Why:
 * - Catalog data (lines, machines, shifts, products, stop_reasons) is small
 *   and mostly static — no need for RxDB replication.
 * - AsyncStorage provides offline persistence with a 1h TTL.
 * - Zustand gives reactive selectors for UI components.
 *
 * Offline-first guarantees:
 * - On app start, loadCatalogs() fetches from Hasura and updates the cache.
 * - If the fetch fails (offline), cached data is returned transparently.
 * - selectedLine is persisted so the line selector doesn't re-appear on restart.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nhost } from '../../graphql/nhostClient';
import type {
  ICatalogLine,
  ICatalogMachine,
  ICatalogShift,
  ICatalogProduct,
  ICatalogStopReason,
} from '../../core/types';

// ─── TTL: 1 hour in ms ──────────────────────────────────────────────────────────

const CATALOG_TTL_MS = 60 * 60 * 1000;

// ─── GraphQL Queries ─────────────────────────────────────────────────────────────

const GET_LINES = `
  query GetLines {
    lines(where: { is_active: { _eq: true } }, order_by: { name: asc }) {
      id name description is_active
    }
  }
`;

const GET_MACHINES = `
  query GetMachines {
    machines(where: { is_active: { _eq: true } }, order_by: { name: asc }) {
      id line_id name description is_active
    }
  }
`;

const GET_SHIFTS = `
  query GetShifts {
    shifts(where: { is_active: { _eq: true } }, order_by: { start_hour: asc }) {
      id label start_hour end_hour is_active
    }
  }
`;

const GET_PRODUCTS = `
  query GetProducts {
    products(where: { is_active: { _eq: true } }, order_by: { name: asc }) {
      id code name theoretical_ppm is_active
    }
  }
`;

const GET_STOP_REASONS = `
  query GetStopReasons {
    stop_reasons(where: { is_active: { _eq: true } }, order_by: { sort_order: asc }) {
      id code label category macro stops_line sort_order is_active
    }
  }
`;

// ─── Store Interface ─────────────────────────────────────────────────────────────

interface CatalogState {
  // Data
  lines: ICatalogLine[];
  machines: ICatalogMachine[];
  shifts: ICatalogShift[];
  products: ICatalogProduct[];
  stopReasons: ICatalogStopReason[];

  // Persisted line selection
  selectedLine: string | null;

  // Cache metadata
  lastFetchedAt: number | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadCatalogs: () => Promise<void>;
  setSelectedLine: (lineId: string | null) => void;

  // Selectors (called as functions, not hooks)
  getStopReasons: () => ICatalogStopReason[];
  getProducts: () => ICatalogProduct[];
  getShifts: () => ICatalogShift[];
  getLines: () => ICatalogLine[];
  getMachines: () => ICatalogMachine[];
  getLineById: (id: string) => ICatalogLine | undefined;
  getMachineById: (id: string) => ICatalogMachine | undefined;
  getMachinesByLine: (lineId: string) => ICatalogMachine[];
}

// ─── Store ───────────────────────────────────────────────────────────────────────

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set, get) => ({
      // Initial state
      lines: [],
      machines: [],
      shifts: [],
      products: [],
      stopReasons: [],
      selectedLine: null,
      lastFetchedAt: null,
      isLoading: false,
      error: null,

      /**
       * Fetches all catalog data from Hasura GraphQL.
       * Updates the store and persists to AsyncStorage.
       * If the fetch fails (offline), cached data remains intact.
       */
      loadCatalogs: async () => {
        const { lastFetchedAt } = get();

        // Skip if cache is still fresh
        if (lastFetchedAt && Date.now() - lastFetchedAt < CATALOG_TTL_MS) {
          return;
        }

        set({ isLoading: true, error: null });

        try {
          // Fetch all catalogs in parallel
          const [linesRes, machinesRes, shiftsRes, productsRes, stopReasonsRes] =
            await Promise.all([
              nhost.graphql.request<{ lines: ICatalogLine[] }>(GET_LINES),
              nhost.graphql.request<{ machines: ICatalogMachine[] }>(GET_MACHINES),
              nhost.graphql.request<{ shifts: ICatalogShift[] }>(GET_SHIFTS),
              nhost.graphql.request<{ products: ICatalogProduct[] }>(GET_PRODUCTS),
              nhost.graphql.request<{ stop_reasons: ICatalogStopReason[] }>(GET_STOP_REASONS),
            ]);

          // Check for GraphQL errors
          const errors = [linesRes, machinesRes, shiftsRes, productsRes, stopReasonsRes]
            .map((res: any) => res.error)
            .filter(Boolean);

          if (errors.length > 0) {
            console.warn('[catalogStore] GraphQL errors:', errors);
            // Don't update cache if there were errors — keep stale data
            set({ isLoading: false, error: 'Error al cargar catálogos' });
            return;
          }

          // Extract data (nhost.graphql.request returns { data, error })
          const extract = <T>(res: any, key: string): T[] => {
            return res?.data?.[key] ?? [];
          };

          set({
            lines: extract<ICatalogLine>(linesRes, 'lines'),
            machines: extract<ICatalogMachine>(machinesRes, 'machines'),
            shifts: extract<ICatalogShift>(shiftsRes, 'shifts'),
            products: extract<ICatalogProduct>(productsRes, 'products'),
            stopReasons: extract<ICatalogStopReason>(stopReasonsRes, 'stop_reasons'),
            lastFetchedAt: Date.now(),
            isLoading: false,
            error: null,
          });
        } catch (err: any) {
          console.warn('[catalogStore] Fetch failed (offline?):', err?.message);
          // Keep cached data — don't clear the store
          set({ isLoading: false, error: 'Sin conexión — usando datos en caché' });
        }
      },

      setSelectedLine: (lineId: string | null) => {
        set({ selectedLine: lineId });
      },

      // ── Selectors ────────────────────────────────────────────────────────────

      getStopReasons: () => get().stopReasons,
      getProducts: () => get().products,
      getShifts: () => get().shifts,
      getLines: () => get().lines,
      getMachines: () => get().machines,

      getLineById: (id: string) => get().lines.find((l) => l.id === id),
      getMachineById: (id: string) => get().machines.find((m) => m.id === id),
      getMachinesByLine: (lineId: string) =>
        get().machines.filter((m) => m.line_id === lineId),
    }),
    {
      name: 'catalog-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist data fields, not loading/error states
      partialize: (state) => ({
        lines: state.lines,
        machines: state.machines,
        shifts: state.shifts,
        products: state.products,
        stopReasons: state.stopReasons,
        selectedLine: state.selectedLine,
        lastFetchedAt: state.lastFetchedAt,
      }),
    },
  ),
);
