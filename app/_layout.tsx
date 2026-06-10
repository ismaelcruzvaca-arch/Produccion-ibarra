/**
 * Root layout for Expo Router.
 *
 * Pattern: Composition Root
 * Why:
 * - Expo Router uses file-system routing; _layout.tsx wraps all routes.
 * - PaperProvider provides react-native-paper theme to the entire app.
 * - AuthProvider restores session from secure storage on mount.
 * - DatabaseProvider initializes RxDB before rendering child screens.
 * - AuthGuard redirects unauthenticated users to /login and authenticated
 *   users away from /login.
 *
 * Provider order (outer → inner):
 * 1. PaperProvider — UI theme and components
 * 2. AuthProvider — session restoration and auth state
 * 3. DatabaseProvider — RxDB singleton initialization
 * 4. AuthGuard — route protection based on auth state
 * 5. Slot — renders the current route
 */

import React, { useEffect, useRef } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { DatabaseProvider } from '../src/data/DatabaseContext';
import { AuthProvider, useAuthContext } from '../src/auth/AuthContext';
import { SentryErrorBoundary, SentryFallback } from '../src/lib/sentry';
import { ResponsiveLayoutProvider } from '../src/ui/layouts/ResponsiveLayoutProvider';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#5D4037',
    secondary: '#8D6E63',
    surface: '#F5F5F5',
  },
};

/**
 * AuthGuard — redirects based on authentication state.
 *
 * Rules:
 * - Loading: render nothing (auth check in progress)
 * - Not authenticated + not on login: redirect to /login
 * - Authenticated + on login: redirect to / (tabs)
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();

  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    if (isLoading) return;

    const isLoginRoute = segments[0] === 'login';
    const shouldRedirectToLogin = !isAuthenticated && !isLoginRoute;
    const shouldRedirectToHome = isAuthenticated && isLoginRoute;

    if (!shouldRedirectToLogin && !shouldRedirectToHome) return;

    // Defer navigation to the next tick so Slot has time to mount first.
    // Without this, Expo Router throws "Attempted to navigate before mounting
    // the Root Layout component" because DatabaseProvider returns null while
    // the DB is initialising, delaying Slot's first render.
    const id = setTimeout(() => {
      if (!mountedRef.current) return;
      if (shouldRedirectToLogin) {
        router.replace('/login');
      } else {
        router.replace('/');
      }
    }, 0);

    return () => {
      clearTimeout(id);
    };
  }, [isAuthenticated, isLoading, segments, router]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Show nothing while checking session to avoid flash of unauthorised content.
  if (isLoading) {
    return null;
  }

  // Always render children — the Slot MUST mount for Expo Router to work.
  // Navigation is handled asynchronously in the useEffect above.
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SentryErrorBoundary fallback={({ error, resetError }) => <SentryFallback error={error} resetError={resetError} />}>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <DatabaseProvider>
            <AuthGuard>
              <ResponsiveLayoutProvider>
                <Slot />
              </ResponsiveLayoutProvider>
            </AuthGuard>
          </DatabaseProvider>
        </AuthProvider>
      </PaperProvider>
    </SentryErrorBoundary>
  );
}
