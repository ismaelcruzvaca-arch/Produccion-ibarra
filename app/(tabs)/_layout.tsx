/**
 * Tab layout — Inicio, OEE, Calidad, Turnos, Alertas, Ajustes.
 * Operators see 4 tabs; supervisors/admins see all 6.
 * Tab bar: 64 dp height, 12 dp label, ≥48 dp touch targets.
 *
 * The "Alertas" tab replaces the old supervisor tab. The supervisor DLQ screen
 * now lives at `app/(tabs)/alerts/dlq.tsx` inside the alerts group.
 */

import React from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/auth/useAuthStore';
import { useAlertBadge } from '../../src/hooks/useAlertBadge';
import { useAlertBadgeStore } from '../../src/store/alertBadgeStore';
import { AlertBadge } from '../../src/ui/components/alertEngine/AlertBadge';

// ─── Tab Layout ───────────────────────────────────────────────────────────────

export default function TabLayout() {
  const user = useAuthStore((s) => s.user) as { role?: string } | null;
  const isSupervisor = user?.role === 'supervisor' || user?.role === 'admin';

  // Feed the shared badge store (mount polling ONCE here)
  useAlertBadge();
  // Read badge count from the shared store
  const badgeCount = useAlertBadgeStore((s) => s.badgeCount);

  return (
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
          title: 'Inicio',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialCommunityIcons name="home" color={color} size={size} />
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
              {isSupervisor && <AlertBadge count={badgeCount} />}
            </View>
          ),
          tabBarButton: isSupervisor ? undefined : () => null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialCommunityIcons name="cog" color={color} size={size} />
          ),
          tabBarButton: isSupervisor ? undefined : () => null,
        }}
      />
    </Tabs>
  );
}
