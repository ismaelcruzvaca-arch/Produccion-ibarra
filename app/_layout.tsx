/**
 * Root layout for Expo Router.
 *
 * Pattern: Composition Root
 * Why:
 * - Expo Router uses file-system routing; _layout.tsx wraps all routes.
 * - PaperProvider provides react-native-paper theme to the entire app.
 * - DatabaseProvider initializes RxDB before rendering child screens.
 *
 * Provider order (outer → inner):
 * 1. PaperProvider — UI theme and components
 * 2. DatabaseProvider — RxDB singleton initialization
 * 3. Slot — renders the current route
 */

import React from 'react';
import { Slot } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { DatabaseProvider } from '../src/data/DatabaseContext';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#5D4037',
    secondary: '#8D6E63',
    surface: '#F5F5F5',
  },
};

export default function RootLayout() {
  return (
    <PaperProvider theme={theme}>
      <DatabaseProvider>
        <Slot />
      </DatabaseProvider>
    </PaperProvider>
  );
}
