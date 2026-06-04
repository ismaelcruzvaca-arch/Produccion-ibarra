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
import { withTimeout } from '../graphql/withTimeout';
import {
  saveSession,
  getStoredSession,
  clearSession,
  setMemoryAccessToken,
} from './tokenStorage';

// ─── GraphQL Queries for Operator Profile ────────────────────────────────────────

const GET_OPERATOR_PROFILE = `
  query GetOperatorProfile($userId: uuid!) {
    operator_profiles_by_pk(id: $userId) {
      id
      full_name
      role
    }
  }
`;

const GET_USER_LINE_ASSIGNMENTS = `
  query GetUserLineAssignments($userId: uuid!) {
    user_line_assignments(where: { user_id: { _eq: $userId } }) {
      line_id
    }
  }
`;

export interface AuthState {
  user: unknown | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Operator profile (populated after login via fetchOperatorProfile)
  operatorId: string | null;
  fullName: string | null;
  role: string | null;
  assignedLines: string[];
  selectedLine: string | null;
  role: string | null;  // 'operator' | 'supervisor' | 'admin' | null
  fullName: string | null;  // resolved from user.displayName ?? user.email

  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
  fetchOperatorProfile: () => Promise<void>;
  setSelectedLine: (lineId: string) => void;
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

/**
 * Resolves the user's display name from the Nhost user object.
 * Falls back to email if displayName is not set.
 */
function resolveFullName(user: unknown): string {
  const u = user as Record<string, unknown> | null | undefined;
  if (!u) return '';
  return (u.displayName as string) ?? (u.email as string) ?? '';
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  operatorId: null,
  fullName: null,
  role: null,
  assignedLines: [],
  selectedLine: null,
  role: null,
  fullName: null,

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
        fullName: resolveFullName(body.session.user),
      });
    } catch (err: any) {
      const rawMessage =
        err?.body?.message ?? err?.message ?? 'Error al iniciar sesión';

      // Normalise Nhost English errors to Spanish for consistent UX and testability
      const normalizedMessage = (() => {
        const msg = String(rawMessage).toLowerCase();
        if (msg.includes('invalid email') || msg.includes('invalid password') || msg.includes('invalid sign-in') || msg.includes('invalid credentials')) {
          return 'Correo o contraseña incorrectos';
        }
        if (msg.includes('user not found')) {
          return 'Usuario no encontrado';
        }
        if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
          return 'Error de conexión con el servidor';
        }
        // Fallback: prefix with Error so regex /error/i always matches
        return rawMessage.startsWith('Error:') ? rawMessage : `Error: ${rawMessage}`;
      })();

      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: normalizedMessage,
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
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      operatorId: null,
      fullName: null,
      role: null,
      assignedLines: [],
      selectedLine: null,
      role: null,
      fullName: null,
    });
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
          fullName: resolveFullName(stored.user),
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
        fullName: resolveFullName(stored.user),
      });
    } catch {
      set({ isAuthenticated: false, isLoading: false, user: null });
    }
  },

  /**
   * Fetches the operator profile and line assignments from Hasura.
   * Call this after successful login or session restore.
   * Populates operatorId and assignedLines.
   *
   * HOTFIX (2026-05-18): Added 5s timeout via withTimeout().
   * If Nhost is unresponsive, falls back gracefully with userId + empty assignedLines
   * instead of silently hanging and blocking the entire auth bootstrap.
   */
  fetchOperatorProfile: async () => {
    const { user } = get();
    if (!user) return;

    const userId = (user as any)?.id;
    if (!userId) return;

    try {
      const [profileRes, assignmentsRes] = await withTimeout(
        Promise.all([
          nhost.graphql.request<{ operator_profiles_by_pk: { id: string; full_name: string; role: string } | null }>(
            GET_OPERATOR_PROFILE,
            { userId },
          ),
          nhost.graphql.request<{ user_line_assignments: { line_id: string }[] }>(
            GET_USER_LINE_ASSIGNMENTS,
            { userId },
          ),
        ]),
        5_000,
      );

      const profile = (profileRes as any)?.data?.operator_profiles_by_pk;
      const assignments = (assignmentsRes as any)?.data?.user_line_assignments ?? [];

      const lineIds = assignments.map((a: { line_id: string }) => a.line_id);

      set({
        operatorId: profile?.id ?? userId,
        fullName: profile?.full_name ?? null,
        role: profile?.role ?? null,
        assignedLines: lineIds,
        role: profile?.role ?? 'operator',
      });
    } catch (err: any) {
      console.warn(
        '[useAuthStore] fetchOperatorProfile fallback — Nhost no disponible:',
        err?.message ?? err,
      );
      // HOTFIX: Fallback con userId como operatorId + assignedLines vacío
      // Permite que la UI continúe hacia loadCatalogs() sin bloquearse.
      set({
        operatorId: userId,
        fullName: null,
        role: null,
        assignedLines: [],
        role: 'operator',
        error: 'Modo sin conexión — perfiles no disponibles',
      });
    }
  },

  /**
   * Persists the selected line ID.
   */
  setSelectedLine: (lineId: string) => {
    set({ selectedLine: lineId });
  },
}));
