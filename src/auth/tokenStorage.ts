/**
 * Secure token storage with platform-aware fallback.
 *
 * Pattern: Adapter + Fallback
 * Why:
 * - expo-secure-store works on iOS/Android but throws on web.
 * - @react-native-async-storage/async-storage works everywhere (including web PWA).
 * - We use SecureStore on native and AsyncStorage on web for maximum compatibility.
 *
 * All tokens survive app restarts and offline periods (days without internet).
 * A memory cache is also kept so getAuthToken() can remain synchronous
 * (required by the replication layer in sync.ts).
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const AUTH_ACCESS_TOKEN_KEY = 'nhost_access_token';
const AUTH_REFRESH_TOKEN_KEY = 'nhost_refresh_token';
const AUTH_USER_KEY = 'nhost_user';

// ─── Memory cache for synchronous token retrieval ──────────────────────────────

let _memoryAccessToken: string | null = null;

export function setMemoryAccessToken(token: string | null): void {
  _memoryAccessToken = token;
}

export function getMemoryAccessToken(): string | null {
  return _memoryAccessToken;
}

// ─── Platform storage helpers ──────────────────────────────────────────────────

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

// ─── Session DTO ───────────────────────────────────────────────────────────────

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: unknown;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function saveSession(session: StoredSession): Promise<void> {
  await setItem(AUTH_ACCESS_TOKEN_KEY, session.accessToken);
  await setItem(AUTH_REFRESH_TOKEN_KEY, session.refreshToken);
  await setItem(AUTH_USER_KEY, JSON.stringify(session.user));
  setMemoryAccessToken(session.accessToken);
}

export async function getStoredSession(): Promise<StoredSession | null> {
  const accessToken = await getItem(AUTH_ACCESS_TOKEN_KEY);
  const refreshToken = await getItem(AUTH_REFRESH_TOKEN_KEY);
  const userJson = await getItem(AUTH_USER_KEY);

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    user: userJson ? JSON.parse(userJson) : null,
  };
}

export async function clearSession(): Promise<void> {
  await deleteItem(AUTH_ACCESS_TOKEN_KEY);
  await deleteItem(AUTH_REFRESH_TOKEN_KEY);
  await deleteItem(AUTH_USER_KEY);
  setMemoryAccessToken(null);
}

export async function getStoredAccessToken(): Promise<string | null> {
  return getItem(AUTH_ACCESS_TOKEN_KEY);
}
