/**
 * Alerts Stack Navigator — Alert Rules, Editor, Events History, and DLQ.
 *
 * Pattern: Stack Navigator (expo-router)
 * Why:
 * - The alerts group has multiple screens (list, editor, events, DLQ) that need
 *   push navigation within the tab. A Stack navigator provides this.
 * - Replaces the old single-screen supervisor tab.
 */

import React from 'react';
import { Stack } from 'expo-router';
import { colors, typography } from '../../../src/ui/theme/tokens';

export default function AlertsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          fontWeight: typography.weights.semibold,
          fontSize: typography.sizes.titleMedium,
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: colors.bgGray,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Alertas',
        }}
      />
      <Stack.Screen
        name="editor"
        options={{
          title: 'Regla de alerta',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="events"
        options={{
          title: 'Historial de eventos',
        }}
      />
      <Stack.Screen
        name="dlq"
        options={{
          title: 'Errores de sincronización',
        }}
      />
    </Stack>
  );
}
