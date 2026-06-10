/**
 * ProductionDashboardSupervisor — Supervisor/Admin overview of all production lines.
 *
 * Pattern: Organism (Atomic Design)
 * Why: Composes ProductionLineCard molecules into a full supervisor dashboard.
 *      Uses catalogStore to list all lines and renders a card per line.
 *      Quick-access buttons for Shift Close, Conciliation, and Alertas/DLQ.
 *
 * Design: spec RL-compliant, touch target >= 48dp, no emoji characters.
 */

import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useCatalogStore } from '../../store/catalogStore';
import { ProductionLineCard } from '../molecules/ProductionLineCard';
import type { LineStatus } from '../molecules/ProductionLineCard';

export function ProductionDashboardSupervisor() {
  const router = useRouter();
  const lines = useCatalogStore((s) => s.lines);
  const getMachinesByLine = useCatalogStore((s) => s.getMachinesByLine);

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
      <Text variant="headlineSmall" style={styles.title}>
        Panel de Supervision
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Panorama general de todas las lineas de produccion
      </Text>

      <View style={styles.cardsContainer}>
        {lines.map((line) => {
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

      <View style={styles.actions}>
        <Button
          mode="outlined"
          icon="calendar-clock"
          onPress={() => router.push('/(tabs)/shifts')}
          style={styles.actionButton}
          contentStyle={styles.actionButtonContent}
        >
          Cierre de Turno
        </Button>
        <Button
          mode="outlined"
          icon="bell-ring"
          onPress={() => router.push('/(tabs)/alerts')}
          style={styles.actionButton}
          contentStyle={styles.actionButtonContent}
        >
          Alertas / DLQ
        </Button>
      </View>
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
  title: {
    fontWeight: 'bold',
    color: '#5D4037',
    marginBottom: 4,
  },
  subtitle: {
    color: '#757575',
    marginBottom: 20,
  },
  cardsContainer: {
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  actionButton: {
    flex: 1,
    minWidth: 160,
  },
  actionButtonContent: {
    minHeight: 48,
  },
});
