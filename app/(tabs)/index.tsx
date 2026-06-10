/**
 * Dashboard Hub — Production dashboard unified by role.
 *
 * Design decision 5: Dashboard unified by role.
 *   - Operator: sees their assigned line(s) with ProductionLineCard(s)
 *   - Supervisor/Admin: sees ALL lines via ProductionDashboardSupervisor
 *
 * This is the first tab in the tab bar (view-dashboard icon).
 * No sequential wizard — each station is independent (design decision 1 & 2).
 *
 * When a line card is pressed, the machine selector auto-selects the first
 * machine of that line and navigates to OEE (or the FormRouter for the station).
 *
 * Tablet-optimised: touch targets >= 48 dp, responsive layout via useResponsive.
 */

import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/auth/useAuthStore';
import { useCatalogStore } from '../../src/ui/store/catalogStore';
import { ProductionLineCard } from '../../src/ui/components/molecules/ProductionLineCard';
import { ProductionDashboardSupervisor } from '../../src/ui/components/organisms/ProductionDashboardSupervisor';
import { ConnectionBadge } from '../../src/ui/components/ConnectionBadge';
import { SyncMonitor } from '../../src/ui/components/SyncMonitor';

export default function DashboardHub() {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const assignedLines = useAuthStore((s) => s.assignedLines);
  const lines = useCatalogStore((s) => s.lines);
  const getMachinesByLine = useCatalogStore((s) => s.getMachinesByLine);

  const isSupervisor = role === 'supervisor' || role === 'admin';

  // ── Supervisor view: full dashboard ─────────────────────────────────────
  if (isSupervisor) {
    return <ProductionDashboardSupervisor />;
  }

  // ── Operator view: assigned line(s) only ────────────────────────────────
  const visibleLines = lines.filter(
    (l) => assignedLines.length === 0 || assignedLines.includes(l.id),
  );

  const handleLinePress = useCallback(
    (lineId: string) => {
      const machines = getMachinesByLine(lineId);
      if (machines.length > 0) {
        useCatalogStore.getState().setSelectedLine(lineId);
        useCatalogStore.getState().setSelectedMachine(machines[0].id);
        router.push('/(tabs)/oee');
      }
    },
    [getMachinesByLine, router],
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          Chocolate Ibarra
        </Text>
        <ConnectionBadge />
      </View>

      <Text variant="titleMedium" style={styles.subtitle}>
        Produccion — Dashboard
      </Text>

      <View style={styles.cardsContainer}>
        {visibleLines.map((line) => {
          const machines = getMachinesByLine(line.id);
          const machineCount = machines.length;

          return (
            <ProductionLineCard
              key={line.id}
              id={line.id}
              name={line.name}
              status={machineCount > 0 ? 'running' : 'idle'}
              currentProduct={undefined}
              onPress={handleLinePress}
              activeAlerts={0}
            />
          );
        })}
      </View>

      {visibleLines.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text variant="bodyLarge" style={styles.emptyText}>
            No hay lineas asignadas. Contacte a su supervisor.
          </Text>
        </View>
      )}

      <SyncMonitor />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 8,
  },
  title: {
    fontWeight: 'bold',
    color: '#5D4037',
  },
  subtitle: {
    marginBottom: 20,
    color: '#757575',
  },
  cardsContainer: {
    marginBottom: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#757575',
    textAlign: 'center',
  },
});
