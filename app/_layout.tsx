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

import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { DatabaseProvider } from '../src/data/DatabaseContext';
import { AuthProvider, useAuthContext } from '../src/auth/AuthContext';

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

  useEffect(() => {
    if (isLoading) return;

    const isLoginRoute = segments[0] === 'login';

    if (!isAuthenticated && !isLoginRoute) {
      router.replace('/login');
    } else if (isAuthenticated && isLoginRoute) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  // Show nothing while checking session or during redirect to avoid flash
  // of unauthorised content.
  if (isLoading) {
    return null;
  }

  const isLoginRoute = segments[0] === 'login';
  const needsRedirect = (!isAuthenticated && !isLoginRoute) || (isAuthenticated && isLoginRoute);
  if (needsRedirect) {
    return null;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <PaperProvider theme={theme}>
      <AuthProvider>
        <DatabaseProvider>
          <AuthGuard>
            <Slot />
          </AuthGuard>
        </DatabaseProvider>
      </AuthProvider>
    </PaperProvider>
  );
}
