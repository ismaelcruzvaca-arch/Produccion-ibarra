/**
 * Root application component for Chocolate Ibarra.
 *
 * Pattern: Composition Root
 * Why:
 * - The app root is the natural place to wire up global providers.
 * - DatabaseProvider initializes RxDB before rendering child screens.
 * - Future providers (AuthProvider, ThemeProvider, etc.) would also be
 *   composed here at the top level.
 *
 * Note on testing (Phase 6 deferred):
 * - The DatabaseProvider uses lazy initialization.
 * - For testing, wrap with a mock provider that injects a test database.
 * - Phase 6 will add Jest + React Testing Library setup.
 */

import React from 'react';
import { DatabaseProvider } from './data/DatabaseContext';

export default function App() {
  return (
    <DatabaseProvider>
      {/* App screens, navigation, and other providers go here. */}
      {/* e.g., <NavigationContainer>...</NavigationContainer> */}
    </DatabaseProvider>
  );
}