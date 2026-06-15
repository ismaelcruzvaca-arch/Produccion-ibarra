/**
 * Shift stack navigator — shift management screens.
 *
 * Routes:
 * - index → Shift list / selection
 * - setup → Operator assignment (post-turno-automatico)
 * - calendar → Admin calendar management (slots + exceptions)
 * - [id] → Shift detail
 * - close/[id] → Shift close
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
        options={{ title: 'Asignar Operador' }}
      />
      <Stack.Screen
        name="calendar"
        options={{ title: 'Calendario de Turnos' }}
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
