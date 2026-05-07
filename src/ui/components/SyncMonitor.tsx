/**
 * SyncMonitor — reactive visual indicator of RxDB GraphQL replication status.
 *
 * Subscribes to RxDB replication observables (active$, error$) and reflects
 * sync state in the UI using react-native-paper icons.
 *
 * States:
 * - idle    → cloud-check (green)     — all caught up
 * - syncing → cloud-sync (amber)      — actively sending/receiving
 * - error   → cloud-off-outline (red) — replication failed
 * - offline → wifi-off (gray)         — no network detected
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface, IconButton } from 'react-native-paper';
import { useReplication } from '../../data/DatabaseContext';
import { useUIStore } from '../store/useUIStore';
import type { SyncStatus } from '../store/useUIStore';

export function SyncMonitor() {
  const replication = useReplication();
  const {
    isOnline,
    isSyncing,
    syncStatus,
    lastSyncTimestamp,
    syncError,
    setIsSyncing,
    setSyncStatus,
    setLastSyncTimestamp,
    setSyncError,
  } = useUIStore();

  const prevStatusRef = useRef<SyncStatus>('idle');

  useEffect(() => {
    if (!replication) return;

    const { assets, workOrders } = replication;
    const subs: Array<() => void> = [];

    // ── Subscribe to active$ (is replication currently running?) ──
    const handleActive = (active: boolean) => {
      setIsSyncing(active);
      if (active) {
        setSyncStatus('syncing');
        setSyncError(null);
      } else {
        // If we were syncing and now stopped without error → idle
        if (prevStatusRef.current === 'syncing') {
          setSyncStatus('idle');
          setLastSyncTimestamp(new Date());
        }
      }
      prevStatusRef.current = active ? 'syncing' : syncStatus;
    };

    const subAssetsActive = assets.active$.subscribe(handleActive);
    const subWorkOrdersActive = workOrders.active$.subscribe(handleActive);
    subs.push(() => subAssetsActive.unsubscribe(), () => subWorkOrdersActive.unsubscribe());

    // ── Subscribe to error$ (did the last sync fail?) ──
    const handleError = (err: Error | undefined) => {
      if (err) {
        setSyncStatus('error');
        setSyncError(err.message);
      }
    };

    const subAssetsError = assets.error$.subscribe(handleError);
    const subWorkOrdersError = workOrders.error$.subscribe(handleError);
    subs.push(() => subAssetsError.unsubscribe(), () => subWorkOrdersError.unsubscribe());

    return () => {
      subs.forEach((unsub) => unsub());
    };
  }, [replication, setIsSyncing, setSyncStatus, setLastSyncTimestamp, setSyncError, syncStatus]);

  // ── Render helpers ──
  const getIcon = (): { name: string; color: string } => {
    switch (syncStatus) {
      case 'syncing':
        return { name: 'cloud-sync', color: '#FF9800' }; // amber
      case 'error':
        return { name: 'cloud-off-outline', color: '#F44336' }; // red
      case 'offline':
        return { name: 'wifi-off', color: '#9E9E9E' }; // gray
      case 'idle':
      default:
        return { name: 'cloud-check', color: '#4CAF50' }; // green
    }
  };

  const getStatusText = (): string => {
    switch (syncStatus) {
      case 'syncing':
        return 'Sincronizando...';
      case 'error':
        return syncError ? `Error: ${syncError}` : 'Error de sincronización';
      case 'offline':
        return 'Sin conexión';
      case 'idle':
      default:
        return 'Sincronizado';
    }
  };

  const icon = getIcon();
  const timestampText = lastSyncTimestamp
    ? `Última sinc: ${lastSyncTimestamp.toLocaleTimeString()}`
    : 'Última sinc: —';

  return (
    <Surface style={styles.container} elevation={1}>
      <View style={styles.row}>
        <IconButton
          icon={icon.name}
          iconColor={icon.color}
          size={24}
          style={styles.icon}
        />
        <Text variant="bodySmall" style={[styles.text, { color: icon.color }]}>
          {getStatusText()}
        </Text>
        {isSyncing && (
          <Text variant="bodySmall" style={styles.syncingIndicator}>
            ●
          </Text>
        )}
      </View>
      <Text variant="bodySmall" style={styles.timestamp}>
        {timestampText}
      </Text>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginTop: 'auto',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  icon: {
    margin: 0,
    marginRight: 4,
  },
  text: {
    flex: 1,
    fontWeight: '600',
  },
  syncingIndicator: {
    color: '#FF9800',
    fontSize: 10,
    marginLeft: 8,
  },
  timestamp: {
    color: '#9E9E9E',
    fontSize: 11,
    marginLeft: 32,
  },
});
