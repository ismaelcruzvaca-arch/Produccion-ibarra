/**
 * Tab layout — Dashboard, OEE, Calidad, Turnos, Alertas, Ajustes.
 *
 * All roles see the same 6 tabs (no role-based reordering — design decision 3).
 * Role-based content is handled inside each screen.
 *
 * The "Alertas" tab is visible for all roles. If role=operator enters alerts,
 * a redirect to dashboard is handled inside the alerts screen.
 *
 * Forms tab is hidden (tabBarButton: () => null), reachable via router.navigate('/forms').
 *
 * Changes from previous layout:
 * - Dashboard (view-dashboard) added as first tab
 * - Forms tab added as hidden tab
 * - supervisor.tsx deleted (replaced by alerts/dlq.tsx)
 * - Alertas tab now visible for all roles (no tabBarButton conditional)
 */

import React from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAlertBadge } from '../../src/hooks/useAlertBadge';
import { useAlertBadgeStore } from '../../src/store/alertBadgeStore';
import { AlertBadge } from '../../src/ui/components/alertEngine/AlertBadge';
import { AlertSnackbarProvider } from '../../src/ui/components/molecules/AlertSnackbar';

// ─── Tab Layout ───────────────────────────────────────────────────────────────

export default function TabLayout() {
  // Feed the shared badge store (mount polling ONCE here)
  useAlertBadge();
  // Read badge count from the shared store
  const badgeCount = useAlertBadgeStore((s) => s.badgeCount);

  return (
    <AlertSnackbarProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            height: 64,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <MaterialCommunityIcons name="view-dashboard" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="oee"
          options={{
            title: 'OEE',
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <MaterialCommunityIcons name="chart-line" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="quality"
          options={{
            title: 'Calidad',
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <MaterialCommunityIcons name="quality" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="shifts"
          options={{
            title: 'Turnos',
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <MaterialCommunityIcons name="calendar-clock" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="alerts"
          options={{
            title: 'Alertas',
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <View>
                <MaterialCommunityIcons name="bell-ring" color={color} size={size} />
                <AlertBadge count={badgeCount} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Ajustes',
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <MaterialCommunityIcons name="cog" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="forms"
          options={{
            title: 'Formularios',
            tabBarButton: () => null,
          }}
        />
      </Tabs>
    </AlertSnackbarProvider>
  );
}
