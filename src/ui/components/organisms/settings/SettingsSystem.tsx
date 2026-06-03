/**
 * SettingsSystem — system information section for the settings screen.
 *
 * Displays app version (from expo-constants), Nhost connection status,
 * and last sync timestamp from useUIStore.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import Constants from 'expo-constants';

import { useUIStore } from '../../../store/useUIStore';
import { nhost } from '../../../../graphql/nhostClient';

export function SettingsSystem() {
  const { isOnline, lastSyncTimestamp } = useUIStore();

  // App version from expo-constants
  const appVersion = Constants.expoConfig?.version ?? Constants.manifest?.version ?? '—';

  // Nhost status: is auth available?
  const nhostSession = nhost.getUserSession();
  const nhostConnected = !!(nhostSession?.accessToken);

  const statusLabel = isOnline
    ? nhostConnected
      ? 'Conectado'
      : 'No autenticado'
    : 'Desconectado';

  const statusColor = isOnline && nhostConnected ? '#2E7D32' : '#C62828';

  const syncTimeText = lastSyncTimestamp
    ? lastSyncTimestamp.toLocaleString()
    : '—';

  return (
    <Surface style={styles.container} elevation={1}>
      <Text variant="titleMedium" style={styles.title}>Sistema</Text>

      {/* App version */}
      <View style={styles.row}>
        <Text variant="bodyMedium" style={styles.label}>Versión App</Text>
        <Text variant="bodyMedium" style={styles.value}>{appVersion}</Text>
      </View>

      {/* Nhost status */}
      <View style={styles.row}>
        <Text variant="bodyMedium" style={styles.label}>Nhost</Text>
        <Text variant="bodyMedium" style={[styles.value, { color: statusColor }]}>
          {statusLabel}
        </Text>
      </View>

      {/* Last sync */}
      <View style={styles.row}>
        <Text variant="bodyMedium" style={styles.label}>Última Sinc.</Text>
        <Text variant="bodyMedium" style={styles.value}>{syncTimeText}</Text>
      </View>

      {/* RxDB database name / scheme info */}
      <View style={styles.row}>
        <Text variant="bodyMedium" style={styles.label}>Base de Datos</Text>
        <Text variant="bodyMedium" style={styles.value}>chocolate-ibarra</Text>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
    color: '#212121',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEEEEE',
  },
  label: {
    color: '#616161',
    flex: 1,
  },
  value: {
    color: '#212121',
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
  },
});
