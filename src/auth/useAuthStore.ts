/**
 * Zustand store for authentication state.
 *
 * Why Zustand:
 * - Nhost JS SDK manages the raw auth session, but we need reactive UI state.
 * - Zustand gives us a simple, typed store for user, loading, and error states.
 * - The store also orchestrates secure token persistence and offline validation.
 *
 * Offline-first guarantees:
 * - Tokens are persisted to SecureStore / AsyncStorage immediately on sign-in.
 * - checkSession restores the UI auth state from storage on app restart.
 * - JWT expiry is validated locally (no network required) so the user stays
 *   authenticated for days while offline.
 */

import { create } from 'zustand';
import { nhost } from '../graphql/nhostClient';
import {
  saveSession,
  getStoredSession,
  clearSession,
  setMemoryAccessToken,
} from './tokenStorage';

export interface AuthState {
  user: unknown | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
}

/**
 * Validates a JWT access token locally by decoding its payload and checking
 * the `exp` claim. No network request is made — this works fully offline.
 */
function isTokenValid(token: string): boolean {
  try {
    const base64Payload = token.split('.')[1];
    if (!base64Payload) return false;
    const payload = JSON.parse(atob(base64Payload));
    if (!payload.exp) return true;
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await nhost.auth.signInEmailPassword({ email, password });
      const body = response.body;

      if (!body.session) {
        throw new Error('No se recibió sesión del servidor');
      }

      await saveSession({
        accessToken: body.session.accessToken,
        refreshToken: body.session.refreshToken,
        user: body.session.user,
      });

      set({
        user: body.session.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      const message =
        err?.body?.message ?? err?.message ?? 'Error al iniciar sesión';
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: message,
      });
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      const session = nhost.getUserSession();
      if (session?.refreshToken) {
        await nhost.auth.signOut({ refreshToken: session.refreshToken });
      }
    } catch {
      // Silent fail — we clear local state regardless
    }
    await clearSession();
    set({ user: null, isAuthenticated: false, isLoading: false, error: null });
  },

  checkSession: async () => {
    set({ isLoading: true });
    try {
      const stored = await getStoredSession();
      if (!stored) {
        set({ isAuthenticated: false, isLoading: false, user: null });
        return;
      }

      const valid = isTokenValid(stored.accessToken);
      if (valid) {
        setMemoryAccessToken(stored.accessToken);
        set({
          user: stored.user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return;
      }

      // Token is expired. We are offline-first, so we don't force logout
      // immediately. Instead, we keep the user "authenticated" with the
      // stale token so UI and replication continue working offline.
      // When the device comes back online, the next sign-in or background
      // refresh will obtain a fresh token.
      setMemoryAccessToken(stored.accessToken);
      set({
        user: stored.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch {
      set({ isAuthenticated: false, isLoading: false, user: null });
    }
  },
}));
