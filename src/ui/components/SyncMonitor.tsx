/**
 * SyncMonitor — Reactive visual indicator of RxDB GraphQL replication status.
 *
 * Pattern: Thin Presentational Component
 * Why:
 * - Replication subscription logic extracted to useReplicationStatus hook.
 * - This component only renders UI based on the hook's return values.
 *
 * States:
 * - idle    → cloud-check (green)     — all caught up
 * - syncing → cloud-sync (amber)      — actively sending/receiving
 * - error   → cloud-off-outline (red) — replication failed
 * - offline → wifi-off (gray)         — no network detected
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface, IconButton } from 'react-native-paper';
import { useReplicationStatus } from '../hooks/useReplicationStatus';
import { colors, spacing, typography, borderRadius } from '../theme/tokens';

export function SyncMonitor() {
  const { isSyncing, syncStatus, lastSyncTime, syncError } = useReplicationStatus();

  const getIcon = (): { name: string; color: string } => {
    switch (syncStatus) {
      case 'syncing':
        return { name: 'cloud-sync', color: colors.caution };
      case 'error':
        return { name: 'cloud-off-outline', color: colors.offline };
      case 'offline':
        return { name: 'wifi-off', color: colors.secondary };
      case 'idle':
      default:
        return { name: 'cloud-check', color: colors.online };
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
  const dlqCount = replication?.resilientOeeController?.getState()?.dlqCount ?? 0;

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
        {dlqCount > 0 && (
          <View style={styles.dlqBadge}>
            <Text variant="bodySmall" style={styles.dlqBadgeText}>
              {'\u26A0\uFE0F'} {dlqCount}
            </Text>
          </View>
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
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.white,
    marginTop: 'auto',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  icon: {
    margin: 0,
    marginRight: spacing.xxs,
  },
  text: {
    flex: 1,
    fontWeight: typography.weights.semibold,
  },
  syncingIndicator: {
    color: colors.caution,
    fontSize: 10,
    marginLeft: spacing.xs,
  },
  timestamp: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    marginLeft: 32,
  },
  dlqBadge: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 6,
  },
  dlqBadgeText: {
    color: '#C62828',
    fontSize: 11,
    fontWeight: '700',
  },
});
