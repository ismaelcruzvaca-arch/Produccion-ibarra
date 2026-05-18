/**
 * Authentication Context — React dependency injection for auth state.
 *
 * Pattern: Context + Hook (DI Container)
 * Why:
 * - The auth store needs to be initialized once on app mount (checkSession).
 * - Layout components (AuthGuard) need reactive access to isAuthenticated
 *   without subscribing directly to the Zustand store.
 * - Keeps auth initialization logic centralized and decoupled from routing.
 *
 * Post-login flow:
 * - After successful login/session restore, fetchOperatorProfile() populates
 *   assignedLines and operatorId from Hasura.
 * - Then catalogStore.loadCatalogs() fetches all catalog data.
 * - If user has only 1 assigned line, auto-select it.
 * - If user has 0 assigned lines, the UI shows a warning.
 * - If user has 2+ lines, the line selector modal appears.
 */

import React, { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useAuthStore } from './useAuthStore';
import { useCatalogStore } from '../ui/store/catalogStore';

export interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    checkSession,
    fetchOperatorProfile,
    isAuthenticated,
    isLoading,
    assignedLines,
    selectedLine,
    setSelectedLine,
  } = useAuthStore();

  const loadCatalogs = useCatalogStore((s) => s.loadCatalogs);
  const setCatalogSelectedLine = useCatalogStore((s) => s.setSelectedLine);

  // Track whether we've already run the post-login bootstrap
  const hasBootstrapped = useRef(false);

  // ── Step 1: Check session on mount ──────────────────────────────────────────
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // ── Step 2: After authenticated, fetch profile + catalogs ───────────────────
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    if (hasBootstrapped.current) return;
    hasBootstrapped.current = true;

    const bootstrap = async () => {
      // Fetch operator profile (populates assignedLines + operatorId)
      await fetchOperatorProfile();

      // Load catalog data from Hasura (with offline cache)
      await loadCatalogs();

      // Auto-select line if user has only 1 assignment
      const currentAssignedLines = useAuthStore.getState().assignedLines;
      const currentSelectedLine = useAuthStore.getState().selectedLine;

      if (currentAssignedLines.length === 1 && !currentSelectedLine) {
        setSelectedLine(currentAssignedLines[0]);
        setCatalogSelectedLine(currentAssignedLines[0]);
      }
    };

    bootstrap().catch((err) => {
      console.warn('[AuthContext] Bootstrap falló — continuando con datos locales:', err?.message ?? err);
    });
  }, [isAuthenticated, isLoading, fetchOperatorProfile, loadCatalogs, setSelectedLine, setCatalogSelectedLine]);

  // ── Sync selectedLine to catalogStore when it changes ──────────────────────
  useEffect(() => {
    if (selectedLine) {
      setCatalogSelectedLine(selectedLine);
    }
  }, [selectedLine, setCatalogSelectedLine]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  return useContext(AuthContext);
}
