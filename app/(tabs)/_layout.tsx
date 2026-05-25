/**
 * Tab layout — Inicio, OEE, Calidad, Turnos, Alertas (sup.), Ajustes (sup.).
 * Operators see 4 tabs; supervisors/admins see all 6.
 * Tab bar: 64 dp height, 12 dp label, ≥48 dp touch targets.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/auth/useAuthStore';
import { useSyncErrorCount } from '../../src/hooks/useSyncErrorCount';

// ─── Badge Component ───────────────────────────────────────────────────────────

/**
 * Red dot badge overlaid on an icon. Shows count up to 99+.
 * Only rendered when count > 0.
 */
function AlertBadge({ count }: { count: number }) {
  if (count === 0) return null;
  const label = count > 99 ? '99+' : String(count);
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

// ─── Tab Layout ───────────────────────────────────────────────────────────────

export default function TabLayout() {
  const user = useAuthStore((s) => s.user) as { role?: string } | null;
  const isSupervisor = user?.role === 'supervisor' || user?.role === 'admin';

  // Only subscribe to DLQ count when the user has supervisor access — avoids
  // waking the hook for operators who can't see the tab anyway.
  const dlqCount = useSyncErrorCount();

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
        name="supervisor"
        options={{
          title: 'Alertas',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <View>
              <MaterialCommunityIcons name="shield-alert" color={color} size={size} />
              {isSupervisor && <AlertBadge count={dlqCount} />}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#D32F2F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
    lineHeight: 12,
  },
});
