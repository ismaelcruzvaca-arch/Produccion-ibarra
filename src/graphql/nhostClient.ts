/**
 * Nhost client singleton for authentication and GraphQL requests.
 *
 * Pattern: Singleton Service + Token Adapter
 * Why:
 * - NhostClient manages auth state, token refresh, and GraphQL requests globally.
 * - A single shared instance avoids duplicate client initialization.
 * - The client auto-injects the Authorization header (Bearer token) on authenticated requests.
 * - For raw fetch (replication layer), getAuthToken() provides the current token.
 *
 * Offline-first token handling:
 * - On module load, we attempt to restore the stored session into the Nhost client.
 * - getAuthToken() first checks the Nhost in-memory session, then falls back to
 *   the memory-cached token from secure storage (set during checkSession or signIn).
 * - This ensures replication requests carry the token even if the Nhost internal
 *   session hasn't been fully restored yet.
 *
 * Configuration:
 * - subdomain: Your Nhost project subdomain (found in Nhost dashboard)
 * - region: The region where your Nhost project is hosted (e.g., 'us-east-1')
 */

import { createNhostClient } from '@nhost/nhost-js';
import {
  getMemoryAccessToken,
  getStoredSession,
  setMemoryAccessToken,
} from '../auth/tokenStorage';

export const nhost = createNhostClient({
  subdomain: 'your-nhost-subdomain', // TODO: replace with actual subdomain from Nhost dashboard
  region: 'us-east-1',               // TODO: replace with actual region from Nhost dashboard
});

// ─── Restore session from secure storage on app start ──────────────────────────

(async function restoreSession() {
  try {
    const stored = await getStoredSession();
    if (!stored) return;

    // Seed the memory cache so getAuthToken() works synchronously
    // before any React component mounts.
    setMemoryAccessToken(stored.accessToken);

    // Attempt to refresh the session with Nhost to obtain a fresh access token.
    // This silently fails when offline; the stale cached token remains usable
    // for local replication until connectivity returns.
    try {
      const refreshed = await nhost.refreshSession(0);
      if (refreshed?.accessToken) {
        setMemoryAccessToken(refreshed.accessToken);
      }
    } catch {
      // Offline or invalid refresh token — silent fail.
    }
  } catch {
    // Offline or invalid refresh token — silent fail.
    // AuthGuard will redirect to login if the token is truly unusable.
  }
})();

// ─── Auto-refresh interval ─────────────────────────────────────────────────────

/**
 * Periodically check if the access token is about to expire and refresh it.
 * Runs only when online. If offline, the existing token remains cached.
 */
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
  const session = nhost.getUserSession();
  if (!session?.accessToken) return;

  try {
    const base64Payload = session.accessToken.split('.')[1];
    if (!base64Payload) return;
    const payload = JSON.parse(atob(base64Payload));
    const expiresIn = payload.exp * 1000 - Date.now();
    // Refresh if token expires in the next 10 minutes
    if (expiresIn < 10 * 60 * 1000) {
      nhost.refreshSession(0).catch(() => {
        // Silent fail — will retry on next interval
      });
    }
  } catch {
    // Malformed token — ignore
  }
}, REFRESH_INTERVAL_MS);

// ─── Token accessors ───────────────────────────────────────────────────────────

/**
 * Gets the current auth token for raw fetch requests (replication layer).
 *
 * Returns the Nhost in-memory session token first; falls back to the
 * memory-cached token from secure storage. This is synchronous because
 * the replication query builders call it inline.
 */
export function getAuthToken(): string | null {
  const session = nhost.getUserSession();
  if (session?.accessToken) {
    return session.accessToken;
  }
  return getMemoryAccessToken();
}

/**
 * Async variant for contexts where awaiting is acceptable.
 * Ensures the latest token is returned, including after a fresh restore.
 */
export async function getAuthTokenAsync(): Promise<string | null> {
  const session = nhost.getUserSession();
  if (session?.accessToken) {
    return session.accessToken;
  }
  return getMemoryAccessToken();
}
