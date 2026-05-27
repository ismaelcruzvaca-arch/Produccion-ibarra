/**
 * SettingsSystem — System information section.
 *
 * Pattern: Atomic Design — Organism (SS-4)
 * Why:
 * - One organism per settings section (AD-2).
 * - Shows app version, Nhost subdomain, environment, and sync status.
 * - Uses List.Accordion wrapper for consistent expandable section.
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { List, Text, Divider } from 'react-native-paper';
import Constants from 'expo-constants';
import { useUIStore, selectSyncStatus } from '../../../store/useUIStore';
import { colors, spacing, typography } from '../../../theme/tokens';

const NHOST_SUBDOMAIN = process.env.EXPO_PUBLIC_NHOST_SUBDOMAIN ?? 'No configurado';
const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

function getEnvironment(): string {
  if (__DEV__) return 'Local (desarrollo)';
  return 'Producción';
}

export function SettingsSystem() {
  const [expanded, setExpanded] = useState(false);
  const { lastSyncTimestamp, pendingCount, syncStatus } = useUIStore(selectSyncStatus);

  const syncStatusLabel = () => {
    switch (syncStatus) {
      case 'idle':
        return 'Sincronizado';
      case 'syncing':
        return 'Sincronizando...';
      case 'error':
        return 'Error de sincronización';
      case 'offline':
        return 'Sin conexión';
      default:
        return 'Desconocido';
    }
  };

  const lastSyncLabel = lastSyncTimestamp
    ? lastSyncTimestamp.toLocaleString()
    : '—';

  return (
    <List.Accordion
      title="Sistema"
      titleStyle={styles.accordionTitle}
      left={(props) => <List.Icon {...props} icon="cog" color={colors.primary} />}
      expanded={expanded}
      onPress={() => setExpanded(!expanded)}
    >
      <View style={styles.content}>
        {/* App version */}
        <View style={styles.infoRow}>
          <Text variant="bodySmall" style={styles.infoLabel}>
            Versión de la app
          </Text>
          <Text variant="bodyMedium" style={styles.infoValue}>
            {APP_VERSION}
          </Text>
        </View>

        <Divider style={styles.divider} />

        {/* Nhost subdomain */}
        <View style={styles.infoRow}>
          <Text variant="bodySmall" style={styles.infoLabel}>
            Subdominio Nhost
          </Text>
          <Text variant="bodyMedium" style={styles.infoValue}>
            {NHOST_SUBDOMAIN}
          </Text>
        </View>

        <Divider style={styles.divider} />

        {/* Environment */}
        <View style={styles.infoRow}>
          <Text variant="bodySmall" style={styles.infoLabel}>
            Entorno
          </Text>
          <Text variant="bodyMedium" style={styles.infoValue}>
            {getEnvironment()}
          </Text>
        </View>

        <Divider style={styles.divider} />

        {/* Sync status */}
        <View style={styles.infoRow}>
          <Text variant="bodySmall" style={styles.infoLabel}>
            Estado de sincronización
          </Text>
          <Text variant="bodyMedium" style={styles.infoValue}>
            {syncStatusLabel()}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text variant="bodySmall" style={styles.infoLabel}>
            Última sincronización
          </Text>
          <Text variant="bodyMedium" style={styles.infoValue}>
            {lastSyncLabel}
          </Text>
        </View>

        {pendingCount > 0 && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Text variant="bodySmall" style={[styles.infoLabel, { color: colors.caution }]}>
                Pendientes por sincronizar
              </Text>
              <Text variant="bodyMedium" style={[styles.infoValue, { color: colors.caution }]}>
                {pendingCount}
              </Text>
            </View>
          </>
        )}
      </View>
    </List.Accordion>
  );
}

const styles = StyleSheet.create({
  accordionTitle: {
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  divider: {
    marginVertical: spacing.sm,
  },
  infoRow: {
    flexDirection: 'column',
    gap: spacing.xxs,
  },
  infoLabel: {
    color: colors.textSecondary,
  },
  infoValue: {
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
});
