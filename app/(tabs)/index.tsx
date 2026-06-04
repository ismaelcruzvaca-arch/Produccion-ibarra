/**
 * Home screen — Production dashboard and Reports History for Chocolate Ibarra PRODUCCIÓN.
 *
 * Displays:
 * - Reactive list of production reports from RxDB
 * - Sync status indicator per report
 * - Quick delete action with confirmation
 * - Empty state with CTA to capture form
 * - Dashboard KPIs and production bar chart
 *
 * Optimised for industrial tablets with large touch targets (≥48 dp).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, ScrollView } from 'react-native';
import {
  Text,
  Card,
  IconButton,
  Button,
  Dialog,
  Portal,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import {
  useReportsRepository,
  getReportSyncStatus,
} from '../../src/repositories/useReportsRepository';
import { useOeeEventsRepository } from '../../src/repositories/useOeeEventsRepository';
import { useReplication } from '../../src/data/DatabaseContext';
import type { IReport, IOeeEvent } from '../../src/core/types';
import { ConnectionBadge } from '../../src/ui/components/ConnectionBadge';
import { SyncMonitor } from '../../src/ui/components/SyncMonitor';
import { useUIStore } from '../../src/ui/store/useUIStore';
import { useDashboardData } from '../../src/ui/hooks/useDashboardData';
import { useAlertSnackbar } from '../../src/ui/components/molecules/AlertSnackbar';
import { TimeFilter } from '../../src/ui/components/TimeFilter';
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

export default function DashboardScreen() {
  const router = useRouter();
  const { docs$, remove } = useReportsRepository();
  const { lastSyncTime, hasError } = useReportsReplicationState();
  const { dashboardTimeFilter, setDashboardTimeFilter } = useUIStore();

  const [reports, setReports] = useState<IReport[]>([]);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<IReport | null>(null);
  // Snackbar — centralized via AlertSnackbar
  const { showAlert } = useAlertSnackbar();

  // Wave 8: OEE event data for live dashboard preview
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
    dashboardTimeFilter
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

  const renderItem = useCallback(
    ({ item }: { item: IReport }) => {
      const syncStatus = getReportSyncStatus(
        item,
        hasError ? 'error' : 'idle',
        lastSyncTime
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
    [lastSyncTime, hasError, handleDeletePress]
  );

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Text variant="headlineSmall" style={styles.emptyTitle}>
          No hay reportes aún
        </Text>
        <Text variant="bodyMedium" style={styles.emptySubtitle}>
          Comience capturando su primer reporte de producción
        </Text>
        <Button
          mode="contained"
          onPress={() => router.push('/(tabs)/oee')}
          style={styles.emptyButton}
          contentStyle={styles.emptyButtonContent}
        >
          Ir a Captura OEE
        </Button>
      </View>
    ),
    [router]
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
        PRODUCCIÓN — Dashboard
      </Text>

      <TimeFilter
        value={dashboardTimeFilter}
        onValueChange={setDashboardTimeFilter}
      />

      <KpiCards kpis={kpis} />

      <ProductionBarChart data={barChartData} />

      {/* Vista Rápida: Producción en Vivo desde OEE events */}
      {oeeEvents.length > 0 && (
        <LiveOeeSummary events={oeeEvents} />
      )}

      <Text variant="titleMedium" style={styles.sectionTitle}>
        Reportes Recientes
      </Text>

      <FlatList
        scrollEnabled={false}
        data={filteredReports}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          filteredReports.length === 0
            ? styles.emptyListContent
            : styles.listContent
        }
        ListEmptyComponent={renderEmptyState}
      />

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
    marginBottom: 16,
    color: '#757575',
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
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontWeight: 'bold',
    color: '#5D4037',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#757575',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    minHeight: 48,
  },
  emptyButtonContent: {
    minHeight: 48,
    paddingVertical: 8,
  },
  dialogBold: {
    fontWeight: 'bold',
  },
  snackbar: {
    marginBottom: 16,
    marginHorizontal: 16,
  },
});
