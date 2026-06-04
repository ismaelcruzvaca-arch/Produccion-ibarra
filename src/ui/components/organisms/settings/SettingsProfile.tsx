/**
 * SettingsProfile — User profile section with role badge, line assignment, sync status, and sign out.
 *
 * Pattern: Atomic Design — Organism (SS-1)
 * Why:
 * - One organism per settings section (AD-2).
 * - Consumes authStore for user identity and catalogStore for line name resolution.
 * - Uses List.Accordion wrapper for consistent expandable section across settings.
 *
 * Props:
 * - onSignOut: callback triggered after user confirms sign out
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { List, Text, Chip, Button, Divider } from 'react-native-paper';
import { useAuthStore } from '../../../../auth/useAuthStore';
import { useCatalogStore } from '../../../store/catalogStore';
import { SyncIndicator } from '../../molecules/SyncIndicator';
import { ConfirmModal } from '../../atoms/ConfirmModal';
import { colors, spacing, typography, borderRadius } from '../../../theme/tokens';

interface SettingsProfileProps {
  onSignOut: () => void;
}

const ROLE_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  operator: { label: 'Operador', color: colors.textOnPrimary, bgColor: '#1976D2' },
  supervisor: { label: 'Supervisor', color: '#000000', bgColor: '#F9A825' },
  admin: { label: 'Administrador', color: colors.textOnPrimary, bgColor: '#D32F2F' },
};

export function SettingsProfile({ onSignOut }: SettingsProfileProps) {
  const [expanded, setExpanded] = useState(true);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const fullName = useAuthStore((s) => s.fullName);
  const role = useAuthStore((s) => s.role);
  const selectedLineId = useAuthStore((s) => s.selectedLine);

  const getLineById = useCatalogStore((s) => s.getLineById);
  const selectedLine = selectedLineId ? getLineById(selectedLineId) : null;

  const roleConfig = ROLE_CONFIG[role ?? ''] ?? ROLE_CONFIG.operator;

  return (
    <>
      <List.Accordion
        title="Perfil"
        titleStyle={styles.accordionTitle}
        left={(props) => <List.Icon {...props} icon="account-circle" color={colors.primary} />}
        expanded={expanded}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.content}>
          {/* User name */}
          <Text variant="titleMedium" style={styles.name}>
            {fullName ?? 'Usuario'}
          </Text>

          {/* Role badge */}
          <Chip
            mode="flat"
            style={[styles.roleChip, { backgroundColor: roleConfig.bgColor }]}
            textStyle={[styles.roleLabel, { color: roleConfig.color }]}
          >
            {roleConfig.label}
          </Chip>

          <Divider style={styles.divider} />

          {/* Assigned line */}
          <View style={styles.infoRow}>
            <Text variant="bodySmall" style={styles.infoLabel}>
              Línea asignada
            </Text>
            <Text variant="bodyMedium" style={styles.infoValue}>
              {selectedLine?.name ?? (selectedLineId ? 'Línea no encontrada' : 'Sin asignar')}
            </Text>
          </View>

          <Divider style={styles.divider} />

          {/* Connection status */}
          <Text variant="bodySmall" style={styles.sectionLabel}>
            Estado de conexión
          </Text>
          <SyncIndicator compact />

          <Divider style={styles.divider} />

          {/* Sign out button */}
          <Button
            mode="contained"
            buttonColor={colors.error}
            textColor={colors.textOnPrimary}
            icon="logout"
            style={styles.signOutButton}
            contentStyle={styles.signOutContent}
            onPress={() => setShowSignOutConfirm(true)}
          >
            Cerrar sesión
          </Button>
        </View>
      </List.Accordion>

      <ConfirmModal
        visible={showSignOutConfirm}
        title="Cerrar sesión"
        message="¿Está seguro de que desea cerrar la sesión? Todos los datos no sincronizados se perderán."
        icon="logout"
        confirmLabel="Cerrar sesión"
        cancelLabel="Cancelar"
        confirmColor={colors.error}
        onConfirm={() => {
          setShowSignOutConfirm(false);
          onSignOut();
        }}
        onDismiss={() => setShowSignOutConfirm(false)}
      />
    </>
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
  name: {
    color: colors.textPrimary,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xs,
  },
  roleChip: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  roleLabel: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: typography.weights.semibold,
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
  sectionLabel: {
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  signOutButton: {
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  signOutContent: {
    minHeight: 48,
  },
});
