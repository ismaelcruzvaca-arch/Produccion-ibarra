/**
 * SettingsProfile — user profile section for the settings screen.
 *
 * Displays the user's full name, role badge (color-coded), assigned line name,
 * sync status indicator (SyncMonitor), and a logout button.
 *
 * Pattern: Surface-based card layout matching other setting sections.
 */

import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Surface, Chip } from 'react-native-paper';

import { useAuthStore } from '../../../../auth/useAuthStore';
import { useCatalogStore } from '../../../store/catalogStore';
import { SyncMonitor } from '../../SyncMonitor';

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin: { bg: '#E3F2FD', text: '#1565C0' },
  supervisor: { bg: '#FFF3E0', text: '#E65100' },
  operator: { bg: '#E8F5E9', text: '#2E7D32' },
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  operator: 'Operador',
};

export function SettingsProfile() {
  const { fullName, role, signOut } = useAuthStore();
  const selectedLine = useCatalogStore((s) => s.selectedLine);
  const getLineById = useCatalogStore((s) => s.getLineById);
  const [loggingOut, setLoggingOut] = useState(false);

  const roleColor = ROLE_COLORS[role ?? 'operator'] ?? ROLE_COLORS.operator;
  const roleLabel = ROLE_LABELS[role ?? 'operator'] ?? role ?? 'Desconocido';
  const lineName = selectedLine ? getLineById(selectedLine)?.name : null;

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await signOut();
    } catch {
      // signOut already handles errors silently
    } finally {
      setLoggingOut(false);
    }
  }, [signOut]);

  return (
    <Surface style={styles.container} elevation={1}>
      {/* Name */}
      <Text variant="titleLarge" style={styles.name}>
        {fullName ?? 'Usuario'}
      </Text>

      {/* Role badge */}
      <View style={styles.badgeRow}>
        <Chip
          compact
          style={[styles.roleBadge, { backgroundColor: roleColor.bg }]}
          textStyle={[styles.roleBadgeText, { color: roleColor.text }]}
        >
          {roleLabel}
        </Chip>
      </View>

      {/* Assigned line */}
      {lineName && (
        <Text variant="bodyMedium" style={styles.lineInfo}>
          Línea: {lineName}
        </Text>
      )}

      {/* Sync monitor */}
      <View style={styles.syncRow}>
        <SyncMonitor />
      </View>

      {/* Logout button */}
      <Button
        mode="outlined"
        icon="logout"
        onPress={handleLogout}
        loading={loggingOut}
        disabled={loggingOut}
        textColor="#C62828"
        style={styles.logoutButton}
      >
        Cerrar Sesión
      </Button>
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
  name: {
    fontWeight: '700',
    color: '#212121',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  roleBadge: {
    height: 26,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  lineInfo: {
    color: '#616161',
    marginBottom: 12,
  },
  syncRow: {
    marginBottom: 12,
  },
  logoutButton: {
    borderColor: '#C62828',
    borderRadius: 6,
  },
});
