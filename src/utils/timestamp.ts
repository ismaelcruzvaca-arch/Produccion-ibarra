/**
 * Timestamp utilities for sync operations.
 *
 * Pattern: Utility Module
 * Why: Provides a single source of truth for generating timestamps used in
 * client_updated_at fields. The sync protocol uses millisecond-precision
 * timestamps for Last-Write-Wins conflict resolution (BIGINT in Postgres).
 */

/**
 * Returns the current Unix timestamp in milliseconds (BIGINT-compatible).
 * Used for client_updated_at field in sync operations.
 *
 * This is a thin wrapper around Date.now() for consistent naming across
 * the codebase and to allow future changes to the timestamp source
 * without updating multiple call sites.
 */
export function nowMs(): number {
  return Date.now();
}