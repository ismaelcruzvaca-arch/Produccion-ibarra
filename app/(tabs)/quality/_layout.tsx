/**
 * Quality stack navigator — quality inspections list → detail screens.
 *
 * Routes:
 * - index → Quality inspections list (placeholders for Phase 6+)
 * - [id]  → Quality inspection detail
 */

import React from 'react';
import { Stack } from 'expo-router';
import { colors } from '../../../src/ui/theme/tokens';

export default function QualityLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.textOnPrimary,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Control de Calidad' }}
      />
      <Stack.Screen
        name="[id]"
        options={{ title: 'Detalle de Inspección' }}
      />
      <Stack.Screen
        name="capture"
        options={{ title: 'Nueva Inspección', presentation: 'modal' }}
      />
    </Stack>
  );
}
