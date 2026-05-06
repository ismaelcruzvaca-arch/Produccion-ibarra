/**
 * UUID generation utilities.
 *
 * Pattern: Utility Module
 * Why: Centralizes platform-specific UUID generation behind a simple API.
 * UUIDs serve as primary keys (id field) for all RxDB documents.
 * Using the `uuid` package ensures cross-platform compatibility (web + mobile).
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a UUID v4 string.
 * Uses the uuid package for cross-platform compatibility (web + mobile).
 */
export function generateUuid(): string {
  return uuidv4();
}