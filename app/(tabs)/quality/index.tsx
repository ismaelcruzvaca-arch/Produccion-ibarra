/**
 * Quality Inspections List — Displays inspections for the selected machine.
 *
 * Architecture: Thin Container (Hook + Presentational)
 * All state orchestration delegated to useQualityListOrchestration().
 * Shows disposition badges (liberado / rechazado / reproceso) instead of pass/fail.
 * No more inspection_type filter chips.
 */

import React from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { FAB, IconButton, Text, Portal, Snackbar } from 'react-native-paper';
import { useRouter, useNavigation } from 'expo-router';

import { useQualityListOrchestration } from '../../../src/ui/hooks/useQualityListOrchestration';
import { QualityInspectionCard } from '../../../src/ui/components/molecules/QualityInspectionCard';
import { EmptyInspectionList } from '../../../src/ui/components/atoms/EmptyInspectionList';
import { StateWrapper } from '../../../src/ui/components/atoms/StateWrapper';
import { colors, spacing } from '../../../src/ui/theme/tokens';

export default function QualityListScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const {
    inspections,
    loading,
    error,
    refresh,
  } = useQualityListOrchestration();

  // Set headerRight chart icon for navigation to trends screen
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon="chart-line"
          iconColor={colors.textOnPrimary}
          size={24}
          onPress={() => router.push('/quality/trends')}
          testID="quality-trends-button"
        />
      ),
    });
  }, [navigation, router]);

  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleCreatePress = () => {
    router.push('/quality/capture');
  };

  const handleCardPress = (id: string) => {
    router.push(`/quality/${id}`);
  };

  // Determine state
  const state = loading ? 'loading' : error ? 'error' : 'success';

  return (
    <View style={styles.container} testID="quality-list-screen">
      <StateWrapper state={state} message={error ?? undefined} onRetry={handleRefresh}>
        {/* Empty state */}
        {inspections.length === 0 && (
          <EmptyInspectionList onCreatePress={handleCreatePress} />
        )}

        {/* Inspection list */}
        {inspections.length > 0 && (
          <FlatList
            data={inspections}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <QualityInspectionCard
                inspection={item}
                onPress={() => handleCardPress(item.id)}
                testID={`quality-card-${item.id}`}
              />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
                testID="quality-list-refresh"
              />
            }
          />
        )}
      </StateWrapper>

      {/* FAB */}
      <FAB
        icon="plus"
        label="Nueva"
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={handleCreatePress}
        color={colors.textOnPrimary}
        testID="quality-fab-new"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGray,
  },
  listContent: {
    paddingVertical: spacing.xs,
    paddingBottom: 80,
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    borderRadius: 28,
  },
});
