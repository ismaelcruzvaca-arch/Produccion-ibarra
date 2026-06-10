/**
 * ProductionDashboardSupervisor — Supervisor/Admin overview of all production lines.
 *
 * Pattern: Organism (Atomic Design)
 * Why: Composes ProductionLineCard molecules into a full supervisor dashboard.
 *      Uses catalogStore to list all lines and renders a card per line.
 *      Quick-access buttons for Shift Close, Conciliation, and Alertas/DLQ.
 *
 * TimeFilter: Reads dashboardTimeFilter from useUIStore and passes it to each
 * ProductionLineCard so OEE display reflects the selected scope (PT/OEE cards).
 *
 * Design: spec RL-compliant, touch target >= 48dp, no emoji characters.
 */

import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useCatalogStore } from '../../store/catalogStore';
import { useUIStore } from '../../store/useUIStore';
import type { DashboardTimeFilter } from '../../store/useUIStore';
import { ProductionLineCard } from '../molecules/ProductionLineCard';
import type { LineStatus } from '../molecules/ProductionLineCard';

export function ProductionDashboardSupervisor() {
  const router = useRouter();
  const lines = useCatalogStore((s) => s.lines);
  const getMachinesByLine = useCatalogStore((s) => s.getMachinesByLine);
  const dashboardTimeFilter = useUIStore((s) => s.dashboardTimeFilter);
  const setDashboardTimeFilter = useUIStore((s) => s.setDashboardTimeFilter);

  const TIME_FILTER_OPTIONS: { value: DashboardTimeFilter; label: string }[] = [
    { value: 'all', label: 'Todo' },
    { value: 'shift', label: 'Turno' },
    { value: '24h', label: '24h' },
  ];

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

      {/* TimeFilter chip bar (PT/OEE scope selector) */}
      <View style={styles.filterRow}>
        {TIME_FILTER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.filterChip,
              dashboardTimeFilter === opt.value && styles.filterChipActive,
            ]}
            onPress={() => setDashboardTimeFilter(opt.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                dashboardTimeFilter === opt.value && styles.filterChipTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
              timeFilter={dashboardTimeFilter}
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
  filterRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterChipActive: {
    backgroundColor: '#5D4037',
    borderColor: '#5D4037',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#757575',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
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
