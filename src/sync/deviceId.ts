/**
 * Stable device identifier for audit trail.
 *
 * Pattern: Stable Device ID
 * Why: Every OEE event must carry a device_id for conflict audit and
 *      traceability. The ID is generated once per device and persisted
 *      across app restarts using expo-secure-store (survives reinstalls
 *      on iOS; on Android it falls back to AsyncStorage behavior).
 *
 * Fallback: If expo-secure-store is unavailable (web PWA), uses AsyncStorage.
 * If neither is available, generates a new UUID per session (not ideal but
 * prevents crashes).
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

const DEVICE_ID_KEY = 'chocolate_ibarra_device_id';

let cachedDeviceId: string | null = null;

/**
 * Returns a stable device identifier.
 * - First call: attempts to read from SecureStore, then AsyncStorage, then generates new UUID
 * - Subsequent calls: returns cached value
 *
 * @returns {Promise<string>} Stable device UUID
 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  try {
    // Try SecureStore first (best option: survives reinstalls on iOS)
    const fromSecure = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (fromSecure) {
      cachedDeviceId = fromSecure;
      return fromSecure;
    }
  } catch {
    // SecureStore may fail on web or if not configured
  }

  try {
    // Fallback to AsyncStorage
    const fromAsync = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (fromAsync) {
      cachedDeviceId = fromAsync;
      // Also save to SecureStore for next time
      try {
        await SecureStore.setItemAsync(DEVICE_ID_KEY, fromAsync);
      } catch {
        // Ignore SecureStore errors
      }
      return fromAsync;
    }
  } catch {
    // AsyncStorage may also fail in edge cases
  }

  // Generate new UUID and persist everywhere possible
  const newId = uuidv4();
  cachedDeviceId = newId;

  try {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, newId);
  } catch {
    // Ignore
  }

  try {
    await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
  } catch {
    // Ignore
  }

  return newId;
}

/**
 * Synchronous version for contexts where async is not available.
 * Returns the cached ID or a session-only UUID.
 * Prefer getDeviceId() whenever possible.
 *
 * @returns {string} Device UUID (may be session-only if not yet cached)
 */
export function getDeviceIdSync(): string {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }
  // Return a session-only UUID — not stable, but prevents crashes
  return uuidv4();
}
