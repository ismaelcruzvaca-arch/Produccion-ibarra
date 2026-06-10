/**
 * StateWrapper — Unified loading/empty/error state container.
 *
 * Pattern: State Component / Adapter
 * Why:
 * - Every screen needs loading, empty, and error states.
 * - Wrapping them in a single component ensures consistency.
 * - Child content only renders when state === 'success'.
 *
 * States:
 * - 'loading' → ActivityIndicator spinner
 * - 'empty' → Icon + message (optional action)
 * - 'error' → Error message + retry button
 * - 'success' → Renders children
 */

import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../../theme/tokens';

interface StateWrapperProps {
  state: 'loading' | 'empty' | 'error' | 'success';
  message?: string;
  onRetry?: () => void;
  emptyAction?: { label: string; onPress: () => void };
  children?: React.ReactNode;
  testID?: string;
}

export function StateWrapper({
  state,
  message,
  onRetry,
  emptyAction,
  children,
  testID,
}: StateWrapperProps) {
  if (state === 'success') {
    return <>{children}</>;
  }

  return (
    <View style={styles.container} testID={testID}>
      {state === 'loading' && (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.message}>{message ?? 'Cargando...'}</Text>
        </>
      )}

      {state === 'empty' && (
        <>
          <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.message}>{message ?? 'Sin datos disponibles'}</Text>
          {emptyAction && (
            <Button
              mode="contained"
              onPress={emptyAction.onPress}
              style={styles.actionButton}
              labelStyle={styles.actionLabel}
            >
              {emptyAction.label}
            </Button>
          )}
        </>
      )}

      {state === 'error' && (
        <>
          <MaterialCommunityIcons name="alert-circle" size={48} color={colors.error} />
          <Text style={[styles.message, styles.errorMessage]}>
            {message ?? 'Ocurrió un error'}
          </Text>
          {onRetry && (
            <Button
              mode="contained"
              onPress={onRetry}
              style={styles.retryButton}
              labelStyle={styles.retryLabel}
              buttonColor={colors.error}
              testID="state-wrapper-retry"
            >
              Reintentar
            </Button>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  message: {
    marginTop: spacing.md,
    fontSize: typography.sizes.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyIcon: {
    marginBottom: spacing.sm,
  },
  errorIcon: {
    marginBottom: spacing.sm,
  },
  errorMessage: {
    color: colors.textError,
  },
  actionButton: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.sm,
  },
  actionLabel: {
    fontSize: typography.sizes.button,
    fontWeight: typography.weights.semibold,
  },
  retryButton: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.sm,
  },
  retryLabel: {
    fontSize: typography.sizes.button,
    fontWeight: typography.weights.semibold,
  },
});
