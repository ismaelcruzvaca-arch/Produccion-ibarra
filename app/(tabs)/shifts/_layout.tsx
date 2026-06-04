/**
 * Shift Setup stack navigator — shift selection → setup flow.
 *
 * Routes:
 * - index → Shift calendar / selection
 * - setup → Shift setup flow (operator assignment, planned boxes, etc.)
 */

import React from 'react';
import { Stack } from 'expo-router';
import { colors } from '../../../src/ui/theme/tokens';

export default function ShiftsLayout() {
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
        options={{ title: 'Gestión de Turnos' }}
      />
      <Stack.Screen
        name="setup"
        options={{ title: 'Configurar Turno' }}
      />
      <Stack.Screen
        name="[id]"
        options={{ title: 'Detalle del Turno' }}
      />
      <Stack.Screen
        name="close/[id]"
        options={{ title: 'Cerrar Turno' }}
      />
    </Stack>
  );
}
