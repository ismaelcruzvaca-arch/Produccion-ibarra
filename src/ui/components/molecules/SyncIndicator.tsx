/**
 * SyncIndicator — Online/offline sync status indicator.
 *
 * Pattern: Atomic Design — Molecule
 * Why:
 * - Consumes useUIStore's isOnline state and syncStatus.
 * - Provides a compact visual indicator for sync status.
 * - Colored indicator: green = synced, amber = syncing, red = error, gray = offline.
 *
 * Usage:
 *   <SyncIndicator compact />
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface, IconButton } from 'react-native-paper';
import { useUIStore } from '../../store/useUIStore';
import type { SyncStatus as SyncStatusType } from '../../store/useUIStore';
import { colors, spacing, typography, borderRadius } from '../../theme/tokens';

interface SyncIndicatorProps {
  /** Compact mode (no timestamp) */
  compact?: boolean;
  testID?: string;
}

const STATUS_CONFIG: Record<SyncStatusType, { icon: string; color: string; label: string }> = {
  syncing: { icon: 'cloud-sync', color: colors.caution, label: 'Sincronizando...' },
  error: { icon: 'cloud-off-outline', color: colors.offline, label: 'Error de sincronización' },
  offline: { icon: 'wifi-off', color: colors.secondary, label: 'Sin conexión' },
  idle: { icon: 'cloud-check', color: colors.online, label: 'Sincronizado' },
};

export function SyncIndicator({ compact = false, testID }: SyncIndicatorProps) {
  const { isOnline, isSyncing, syncStatus, lastSyncTimestamp, pendingCount } = useUIStore();

  // Determine effective status
  const effectiveStatus: SyncStatusType = !isOnline
    ? 'offline'
    : isSyncing
      ? 'syncing'
      : syncStatus;

  const config = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.idle;

  const timestampText = lastSyncTimestamp
    ? `Última sinc: ${lastSyncTimestamp.toLocaleTimeString()}`
    : 'Última sinc: —';

  return (
    <Surface style={[styles.container, compact && styles.compact]} elevation={1} testID={testID}>
      <View style={styles.row}>
        <IconButton
          icon={config.icon}
          iconColor={config.color}
          size={compact ? 18 : 24}
          style={styles.icon}
        />
        <Text style={[styles.label, { color: config.color }]}>
          {config.label}
        </Text>
        {isSyncing && <View style={[styles.pulse, { backgroundColor: config.color }]} />}
      </View>
      {!compact && (
        <Text style={styles.timestamp}>
          {timestampText}
          {pendingCount > 0 ? ` · ${pendingCount} pendientes` : ''}
        </Text>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.white,
  },
  compact: {
    padding: spacing.xs,
    width: 'auto',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    margin: 0,
    marginRight: spacing.xxs,
  },
  label: {
    flex: 1,
    fontSize: typography.sizes.bodySmall,
    fontWeight: typography.weights.semibold,
  },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: spacing.xs,
  },
  timestamp: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    marginLeft: 28,
    marginTop: spacing.xxs,
  },
});
