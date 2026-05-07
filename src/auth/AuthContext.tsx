/**
 * Authentication Context — React dependency injection for auth state.
 *
 * Pattern: Context + Hook (DI Container)
 * Why:
 * - The auth store needs to be initialized once on app mount (checkSession).
 * - Layout components (AuthGuard) need reactive access to isAuthenticated
 *   without subscribing directly to the Zustand store.
 * - Keeps auth initialization logic centralized and decoupled from routing.
 */

import React, { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useAuthStore } from './useAuthStore';

export interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { checkSession, isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  return useContext(AuthContext);
}
