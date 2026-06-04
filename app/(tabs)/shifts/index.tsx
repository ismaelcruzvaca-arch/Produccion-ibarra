/**
 * Shift Selection — Reactive list of all shift sessions.
 *
 * Uses useShiftListOrchestration for reactive data.
 * Shows ActiveShiftBanner at top when a shift is active.
 * FlatList of ShiftCard for closed shifts.
 * FAB to navigate to setup.
 */

import React, { useCallback } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Text, FAB, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';

import { useShiftListOrchestration } from '../../../src/ui/hooks/useShiftListOrchestration';
import { ShiftCard } from '../../../src/ui/components/molecules/ShiftCard';
import { ActiveShiftBanner } from '../../../src/ui/components/molecules/ActiveShiftBanner';
import { colors, spacing, typography } from '../../../src/ui/theme/tokens';
import type { IShiftSession } from '../../../src/core/types';

export default function ShiftListScreen() {
  const router = useRouter();
  const { loading, activeShift, closedShifts } = useShiftListOrchestration();

  const handleShiftPress = useCallback(
    (session: IShiftSession) => {
      router.push(`/shifts/${session.id}`);
    },
    [router],
  );

  const handleGoToOEE = useCallback(() => {
    router.push('/oee');
  }, [router]);

  const handleSetup = useCallback(() => {
    router.push('/shifts/setup');
  }, [router]);

  const renderItem = useCallback(
    ({ item }: { item: IShiftSession }) => (
      <ShiftCard session={item} onPress={() => handleShiftPress(item)} />
    ),
    [handleShiftPress],
  );

  const keyExtractor = useCallback((item: IShiftSession) => item.id, []);

  // ─── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ─── Empty state ────────────────────────────────────────────────────────
  const hasShifts = activeShift || closedShifts.length > 0;

  if (!hasShifts) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No hay turnos registrados</Text>
          <Text style={styles.emptySubtitle}>
            Configure un nuevo turno para comenzar el registro de producción.
          </Text>
        </View>
        <FAB
          icon="plus"
          label="Configurar Nuevo Turno"
          onPress={handleSetup}
          style={styles.fab}
          color={colors.textOnPrimary}
        />
      </View>
    );
  }

  // ─── List ───────────────────────────────────────────────────────────────
  const ListHeader = activeShift ? (
    <ActiveShiftBanner session={activeShift} onGoToOEE={handleGoToOEE} />
  ) : null;

  return (
    <View style={styles.container}>
      <FlatList
        data={closedShifts}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
      <FAB
        icon="plus"
        label="Configurar Nuevo Turno"
        onPress={handleSetup}
        style={styles.fab}
        color={colors.textOnPrimary}
      />
    </View>
  );
}

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
  listContent: {
    padding: spacing.md,
    paddingBottom: 96, // Space for FAB
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 28,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.sizes.titleMedium,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
