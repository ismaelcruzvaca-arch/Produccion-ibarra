/**
 * QualityListScreen — main list of quality inspections for the active shift.
 *
 * Spec compliance:
 * - QC-1: MUST display inspections for active shift, timestamp DESC
 * - QC-4: SHALL use active shift_session.id, NOT catalog shift
 * - QC-7: SHALL block capture when no active shift session
 * - QC-10: MUST pass/fail chip per inspection card (via QualityInspectionCard)
 * - QC-11: SHOULD pull-to-refresh offline resilient
 * - QC-12: SHALL empty state CTA when no inspections
 */
import React, { useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Text, Button, ActivityIndicator } from 'react-native-paper';

import { useQualityListOrchestration } from '../../../hooks/useQualityListOrchestration';
import { QualityInspectionCard } from '../molecules/QualityInspectionCard';
import { EmptyInspectionList } from '../atoms/EmptyInspectionList';
import type { IQualityInspection } from '../../../core/types';

interface QualityListScreenProps {
  /** Active shift session ID. If null, capture is blocked (QC-7). */
  shiftSessionId: string | null;
  /** Called when the user taps "Nueva Inspección". */
  onNewInspection: () => void;
  /** Called when the user taps an inspection card to view details. */
  onInspectionPress: (inspection: IQualityInspection) => void;
}

export function QualityListScreen({
  shiftSessionId,
  onNewInspection,
  onInspectionPress,
}: QualityListScreenProps) {
  const { state, loadInspections, refreshInspections } =
    useQualityListOrchestration();

  // Load inspections when shift session changes
  useEffect(() => {
    if (shiftSessionId) {
      loadInspections(shiftSessionId);
    }
  }, [shiftSessionId, loadInspections]);

  const handleRefresh = useCallback(() => {
    if (shiftSessionId) {
      refreshInspections(shiftSessionId);
    }
  }, [shiftSessionId, refreshInspections]);

  const renderItem = useCallback(
    ({ item }: { item: IQualityInspection }) => (
      <QualityInspectionCard
        inspection={item}
        defectLabel={item.defect_label}
        defectSeverity={item.defect_severity}
        onPress={() => onInspectionPress(item)}
      />
    ),
    [onInspectionPress]
  );

  const keyExtractor = useCallback(
    (item: IQualityInspection) => item.id,
    []
  );

  // QC-7: Block capture when no active shift session
  if (!shiftSessionId) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.blockedIcon}>🔒</Text>
        <Text variant="titleMedium" style={styles.blockedText}>
          No hay sesión de turno activa
        </Text>
        <Text variant="bodyMedium" style={styles.blockedSubtext}>
          Inicie un turno primero para capturar inspecciones de calidad
        </Text>
      </View>
    );
  }

  if (state.isLoading && state.inspections.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Cargando inspecciones...
        </Text>
      </View>
    );
  }

  if (state.inspections.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyInspectionList
          message="No hay inspecciones de calidad registradas para este turno"
          ctaLabel="Nueva Inspección"
          showCta
          onCtaPress={onNewInspection}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleMedium" style={styles.headerTitle}>
          Inspecciones de Calidad
        </Text>
        <Button
          mode="contained"
          icon="plus"
          onPress={onNewInspection}
          compact
        >
          Nueva
        </Button>
      </View>

      <FlatList
        data={state.inspections}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={state.isRefreshing}
            onRefresh={handleRefresh}
            colors={['#1976D2']}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontWeight: '700',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  blockedIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  blockedText: {
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  blockedSubtext: {
    opacity: 0.6,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 16,
    opacity: 0.6,
  },
});
