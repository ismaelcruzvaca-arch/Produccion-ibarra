/**
 * Nhost client singleton for authentication and GraphQL requests.
 *
 * Pattern: Singleton Service
 * Why:
 * - NhostClient manages auth state, token refresh, and GraphQL requests globally.
 * - A single shared instance avoids duplicate client initialization.
 * - The client auto-injects the Authorization header (Bearer token) on authenticated requests.
 *
 * Configuration:
 * - subdomain: Your Nhost project subdomain (found in Nhost dashboard)
 * - region: The region where your Nhost project is hosted (e.g., 'us-east-1')
 *
 * Usage:
 *   import { nhost, getAuthToken } from './nhostClient';
 *   const session = nhost.auth.getSession(); // access current user
 *   const token = getAuthToken();             // for manual header injection
 */

import { NhostClient } from '@nhost/nhost-js';

/**
 * Nhost client singleton.
 * Replace subdomain and region with your actual Nhost project values.
 *
 * The client handles:
 * - Authentication (sign in/up/out, token refresh)
 * - GraphQL requests (auto-injects Authorization header when authenticated)
 * - Storage operations (file uploads/downloads)
 */
export const nhost = new NhostClient({
  subdomain: 'your-nhost-subdomain', // TODO: replace with actual subdomain from Nhost dashboard
  region: 'us-east-1',               // TODO: replace with actual region from Nhost dashboard
});

/**
 * Gets the current auth token from the Nhost client.
 * Used to inject Authorization header into replication requests (which use raw fetch).
 *
 * The replication layer in sync.ts uses native fetch rather than nhost.graphql.client
 * so we need to extract and manually inject the token.
 *
 * @returns {string | null} The Bearer token, or null if not authenticated
 */
export function getAuthToken(): string | null {
  const session = nhost.auth.getSession();
  return session?.accessToken ?? null;
}