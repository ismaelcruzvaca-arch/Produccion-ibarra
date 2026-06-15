/**
 * Shift Setup Screen — Transformed from create-form to assign-operator screen.
 *
 * Post-turno-automatico:
 * - Sessions are auto-created by the scheduler (useAutoShiftDetector).
 * - This screen handles operator assignment post-creation.
 *
 * States:
 * 1. Loading → ActivityIndicator
 * 2. Active session with operator_id set → "Ya asignado" + redirect to detail
 * 3. Active session with operator_id = null → operator picker + assign button
 * 4. No active session → "No hay turno activo" + "Forzar inicio" (supervisor)
 */

import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text, Button, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';

import { useShiftSetupOrchestration } from '../../../src/ui/hooks/useShiftSetupOrchestration';
import { CatalogSelector } from '../../../src/ui/components/atoms/CatalogSelector';
import { colors, spacing, typography, borderRadius } from '../../../src/ui/theme/tokens';
import type { IOperator } from '../../../src/core/types';

export default function ShiftSetupScreen() {
  const router = useRouter();
  const {
    operators,
    operatorId,
    setOperator,
    assignOperator,
    forceStart,
    activeSession,
    loading,
    error,
    assigning,
    forcing,
    isSupervisor,
  } = useShiftSetupOrchestration();

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  const handleAssign = useCallback(async () => {
    if (!activeSession || !operatorId) return;
    await assignOperator(activeSession.id, operatorId);
    // On success, navigate back to shift list
    router.back();
  }, [activeSession, operatorId, assignOperator, router]);

  const handleForceStart = useCallback(async () => {
    await forceStart();
    // After force start, activeSession state updates — user can now assign
  }, [forceStart]);

  const handleViewDetail = useCallback(() => {
    if (activeSession) {
      router.push(`/shifts/${activeSession.id}`);
    }
  }, [activeSession, router]);

  // ─── Loading state ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ─── Already assigned — session has operator ──────────────────────────────────

  if (activeSession?.operator_id) {
    return (
      <View style={styles.container}>
        <View style={styles.messageContainer}>
          <Text style={styles.messageIcon}>person-check</Text>
          <Text style={styles.messageTitle}>
            Este turno ya tiene un operador asignado
          </Text>
          <Text style={styles.messageSubtitle}>
            El turno activo para esta línea ya fue asignado a un operador.
            Consulte los detalles del turno para más información.
          </Text>
          <Button
            mode="contained"
            onPress={handleViewDetail}
            style={styles.actionButton}
            icon="clipboard-text-outline"
          >
            Ver Detalle del Turno
          </Button>
        </View>
      </View>
    );
  }

  // ─── Active session, no operator — show assignment picker ─────────────────────

  if (activeSession && !activeSession.operator_id) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Asignar Operador al Turno</Text>
          <Text style={styles.subtitle}>
            Seleccione el operador que va a trabajar en esta línea durante el
            turno activo.
          </Text>

          {/* Error message */}
          {error ? (
            <HelperText type="error" visible style={styles.errorText}>
              {error}
            </HelperText>
          ) : null}

          {/* Operator selector */}
          <View style={styles.field}>
            <Text style={styles.label}>Operador</Text>
            <CatalogSelector<IOperator>
              data={operators}
              selected={operatorId}
              onSelect={setOperator}
              labelExtractor={(op) => op.full_name}
              placeholder="Seleccionar operador..."
              testID="shift-assign-operator"
            />
          </View>

          {/* Assign button */}
          <Button
            mode="contained"
            onPress={handleAssign}
            disabled={!operatorId || assigning}
            loading={assigning}
            style={styles.actionButton}
            icon="account-check-outline"
          >
            {assigning ? 'Asignando...' : 'Asignar Operador'}
          </Button>
        </View>
      </View>
    );
  }

  // ─── No active session — fallback ─────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.messageContainer}>
        <Text style={styles.noShiftIcon}>calendar-remove</Text>
        <Text style={styles.noShiftTitle}>No hay turno activo</Text>
        <Text style={styles.noShiftSubtitle}>
          No se ha iniciado un turno para esta línea. El calendario no tiene un
          slot programado para el día y hora actuales.
        </Text>
        <Text style={styles.noShiftHint}>
          Contacte al supervisor para iniciar el turno manualmente.
        </Text>

        {/* Error message */}
        {error ? (
          <HelperText type="error" visible style={styles.errorText}>
            {error}
          </HelperText>
        ) : null}

        {/* Force start — supervisor only (AD-5) */}
        {isSupervisor && (
          <Button
            mode="contained"
            onPress={handleForceStart}
            loading={forcing}
            disabled={forcing}
            style={styles.actionButton}
            buttonColor={colors.caution}
            icon="play-circle-outline"
          >
            {forcing ? 'Iniciando...' : 'Forzar Inicio de Turno'}
          </Button>
        )}
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGray,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgGray,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.titleMedium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  field: {
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: typography.sizes.bodyMedium,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  messageIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  messageTitle: {
    fontSize: typography.sizes.titleMedium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  messageSubtitle: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  noShiftIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  noShiftTitle: {
    fontSize: typography.sizes.titleMedium,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  noShiftSubtitle: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  noShiftHint: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textWarning,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textError,
    textAlign: 'center',
  },
  actionButton: {
    borderRadius: borderRadius.sm,
    marginTop: spacing.md,
    minWidth: 200,
  },
});
