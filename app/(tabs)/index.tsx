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
 * TimeFilter support (design decision for PT/OEE):
 *   - The dashboard includes a chip selector for 'all', 'shift', or '24h' views.
 *   - This filter is stored in useUIStore and consumed by downstream OEE/PT hooks.
 *   - Weekly is a future extension.
 *
 * Tablet-optimised: touch targets >= 48 dp, responsive layout via useResponsive.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { Text, Card, IconButton, Button, Dialog, Portal } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/auth/useAuthStore';
import { useCatalogStore } from '../../src/ui/store/catalogStore';
import { useUIStore } from '../../src/ui/store/useUIStore';
import type { DashboardTimeFilter } from '../../src/ui/store/useUIStore';
import { ProductionLineCard } from '../../src/ui/components/molecules/ProductionLineCard';
import { ProductionDashboardSupervisor } from '../../src/ui/components/organisms/ProductionDashboardSupervisor';
import { ConnectionBadge } from '../../src/ui/components/ConnectionBadge';
import { SyncMonitor } from '../../src/ui/components/SyncMonitor';
import { useReportsRepository, getReportSyncStatus } from '../../src/repositories/useReportsRepository';
import { useOeeEventsRepository } from '../../src/repositories/useOeeEventsRepository';
import { useReplication } from '../../src/data/DatabaseContext';
import type { IReport, IOeeEvent } from '../../src/core/types';
import { useDashboardData } from '../../src/ui/hooks/useDashboardData';
import { useAlertSnackbar } from '../../src/ui/components/molecules/AlertSnackbar';
import { KpiCards } from '../../src/ui/components/KpiCards';
import { ProductionBarChart } from '../../src/ui/components/ProductionBarChart';
import { LiveOeeSummary } from '../../src/ui/components/organisms/LiveOeeSummary';

function formatCaptureTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Observes the reports replication state to derive per-item sync status.
 */
function useReportsReplicationState() {
  const replication = useReplication();
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!replication) return;
    const { oeeEvents } = replication;
    const subs: Array<() => void> = [];

    if (oeeEvents) {
      const subActive = oeeEvents.active$.subscribe((active: boolean) => {
        if (active) {
          setHasError(false);
        } else {
          setLastSyncTime(Date.now());
        }
      });
      subs.push(() => subActive.unsubscribe());

      const subError = oeeEvents.error$.subscribe((err: Error | undefined) => {
        if (err) {
          setHasError(true);
        }
      });
      subs.push(() => subError.unsubscribe());
    }

    return () => subs.forEach((unsub) => unsub());
  }, [replication]);

  return { lastSyncTime, hasError };
}

export default function DashboardHub() {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const assignedLines = useAuthStore((s) => s.assignedLines);
  const lines = useCatalogStore((s) => s.lines);
  const getMachinesByLine = useCatalogStore((s) => s.getMachinesByLine);
  const dashboardTimeFilter = useUIStore((s) => s.dashboardTimeFilter);
  const setDashboardTimeFilter = useUIStore((s) => s.setDashboardTimeFilter);

  const isSupervisor = role === 'supervisor' || role === 'admin';

  const TIME_FILTER_OPTIONS: { value: DashboardTimeFilter; label: string }[] = [
    { value: 'all', label: 'Todo' },
    { value: 'shift', label: 'Turno' },
    { value: '24h', label: '24h' },
  ];

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

  // ── Analytics: reports + OEE events ──────────────────────────────────────
  const { docs$, remove } = useReportsRepository();
  const { lastSyncTime, hasError } = useReportsReplicationState();
  const { showAlert } = useAlertSnackbar();

  const [reports, setReports] = useState<IReport[]>([]);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<IReport | null>(null);

  const { docs$: oeeDocs$ } = useOeeEventsRepository();
  const [oeeEvents, setOeeEvents] = useState<IOeeEvent[]>([]);

  useEffect(() => {
    const subscription = docs$.subscribe((docs) => {
      setReports(docs.map((doc) => doc.toJSON() as IReport));
    });
    return () => subscription.unsubscribe();
  }, [docs$]);

  useEffect(() => {
    const subscription = oeeDocs$.subscribe((docs) => {
      setOeeEvents(docs.map((doc) => doc.toJSON() as IOeeEvent));
    });
    return () => subscription.unsubscribe();
  }, [oeeDocs$]);

  const { kpis, barChartData, filteredReports } = useDashboardData(
    reports,
    dashboardTimeFilter,
  );

  const handleDeletePress = useCallback((report: IReport) => {
    setReportToDelete(report);
    setDeleteDialogVisible(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!reportToDelete) return;
    try {
      await remove(reportToDelete.id);
      showAlert({ message: 'Reporte eliminado correctamente', type: 'success' });
    } catch {
      showAlert({ message: 'Error al eliminar el reporte', type: 'error' });
    } finally {
      setDeleteDialogVisible(false);
      setReportToDelete(null);
    }
  }, [reportToDelete, remove, showAlert]);

  const renderReportItem = useCallback(
    ({ item }: { item: IReport }) => {
      const syncStatus = getReportSyncStatus(
        item,
        hasError ? 'error' : 'idle',
        lastSyncTime,
      );
      const syncIcon =
        syncStatus === 'synced'
          ? { name: 'cloud-check' as const, color: '#4CAF50' }
          : syncStatus === 'pending'
          ? { name: 'clock-outline' as const, color: '#FF9800' }
          : { name: 'cloud-off-outline' as const, color: '#F44336' };

      return (
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Text variant="titleMedium" style={styles.lineName}>
                {item.data.line_id}
              </Text>
              <IconButton
                icon={syncIcon.name}
                iconColor={syncIcon.color}
                size={20}
                onPress={() => {}}
                style={styles.syncIcon}
              />
            </View>
            <Text variant="bodyMedium">
              Total piezas: {item.data.total_pieces}
            </Text>
            <Text variant="bodySmall" style={styles.timestamp}>
              {formatCaptureTime(item.updated_at)}
            </Text>
          </Card.Content>
          <Card.Actions>
            <Button
              mode="outlined"
              onPress={() => handleDeletePress(item)}
              style={styles.deleteButton}
              contentStyle={styles.deleteButtonContent}
              textColor="#F44336"
            >
              Eliminar
            </Button>
          </Card.Actions>
        </Card>
      );
    },
    [lastSyncTime, hasError, handleDeletePress],
  );

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyReportContainer}>
        <Text variant="headlineSmall" style={styles.emptyReportTitle}>
          No hay reportes aún
        </Text>
        <Text variant="bodyMedium" style={styles.emptyReportSubtitle}>
          Complete un turno de producción para ver los reportes
        </Text>
      </View>
    ),
    [],
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
              timeFilter={dashboardTimeFilter}
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

      {/* ── Analytics: KPI Cards ────────────────────────────────────────────── */}
      <KpiCards kpis={kpis} />

      {/* ── Analytics: Production Bar Chart ─────────────────────────────────── */}
      <ProductionBarChart data={barChartData} />

      {/* ── Analytics: Live OEE Summary ──────────────────────────────────────── */}
      {oeeEvents.length > 0 && (
        <LiveOeeSummary events={oeeEvents} />
      )}

      {/* ── Reports List ────────────────────────────────────────────────────── */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Reportes Recientes
      </Text>

      <FlatList
        scrollEnabled={false}
        data={filteredReports}
        keyExtractor={(item) => item.id}
        renderItem={renderReportItem}
        contentContainerStyle={
          filteredReports.length === 0
            ? styles.emptyListContent
            : styles.listContent
        }
        ListEmptyComponent={renderEmptyState}
      />

      {/* ── Delete Dialog ─────────────────────────────────────────────────────── */}
      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => setDeleteDialogVisible(false)}
        >
          <Dialog.Title>Confirmar eliminación</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              ¿Está seguro de que desea eliminar el reporte de la línea{' '}
              <Text style={styles.dialogBold}>
                {reportToDelete?.data.line_id}
              </Text>
              ?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>
              Cancelar
            </Button>
            <Button onPress={confirmDelete} textColor="#F44336">
              Eliminar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#757575',
    textAlign: 'center',
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 12,
    color: '#5D4037',
  },
  listContent: {
    paddingBottom: 16,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lineName: {
    fontWeight: 'bold',
    color: '#5D4037',
    flex: 1,
  },
  syncIcon: {
    margin: 0,
  },
  timestamp: {
    color: '#757575',
    marginTop: 4,
  },
  deleteButton: {
    minHeight: 48,
    borderColor: '#F44336',
  },
  deleteButtonContent: {
    minHeight: 48,
    paddingHorizontal: 16,
  },
  emptyReportContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyReportTitle: {
    fontWeight: 'bold',
    color: '#5D4037',
    marginBottom: 8,
  },
  emptyReportSubtitle: {
    color: '#757575',
    textAlign: 'center',
    marginBottom: 24,
  },
  dialogBold: {
    fontWeight: 'bold',
  },
});
