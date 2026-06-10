/**
 * Alert Rules List — main screen for the Alerts tab.
 *
 * Displays:
 * - HealthCard at the top (alert engine status)
 * - Segmented filter (Activas / Todas)
 * - FlatList of alert rules with toggle switches
 * - Empty, error, and loading states
 *
 * Pattern: Screen / Template (Atomic Design)
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { Text, Button, Chip } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAlertBadgeStore } from '../../../src/store/alertBadgeStore';
import { fetchAlertRules, fetchNodeCatalog, toggleRule } from '../../../src/services/alertEngine';
import { HealthCard } from '../../../src/ui/components/alertEngine/HealthCard';
import type { AlertRule, NodeCatalog } from '../../../src/types/alertEngine';
import { colors, spacing, typography } from '../../../src/ui/theme/tokens';

type FilterMode = 'active' | 'all';

// ─── Rule Row ───────────────────────────────────────────────────────────────────

interface RuleRowProps {
  rule: AlertRule;
  nodeCatalog: Map<string, NodeCatalog>;
  onToggle: (id: string, currentEnabled: boolean) => Promise<void>;
}

function RuleRow({ rule, nodeCatalog, onToggle }: RuleRowProps) {
  const [toggling, setToggling] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(rule.enabled);

  const nodeInfo = nodeCatalog.get(rule.node_id);
  const nodeName = nodeInfo
    ? `${nodeInfo.machine.name} / ${nodeInfo.node_ident}`
    : rule.node_id.slice(0, 8);

  const handleToggle = useCallback(async () => {
    // Optimistic update
    const newValue = !localEnabled;
    setLocalEnabled(newValue);
    setToggling(true);

    try {
      await onToggle(rule.id, newValue);
    } catch {
      // Revert on failure
      setLocalEnabled(!newValue);
    } finally {
      setToggling(false);
    }
  }, [rule.id, localEnabled, onToggle]);

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7}>
      <View style={styles.rowHeader}>
        <Text style={styles.nodeName} numberOfLines={1}>
          {nodeName}
        </Text>
        <Switch
          value={localEnabled}
          onValueChange={handleToggle}
          disabled={toggling}
          trackColor={{ false: '#E0E0E0', true: '#A5D6A7' }}
          thumbColor={localEnabled ? '#388E3C' : '#BDBDBD'}
        />
      </View>

      <View style={styles.rowDetails}>
        <Chip style={styles.conditionChip} textStyle={styles.conditionChipText}>
          {rule.tipo_condicion}
        </Chip>
        <Text style={styles.thresholdText}>Umbral: {rule.valor_umbral}</Text>
        <View style={styles.channelsRow}>
          {rule.canales.map((ch) => (
            <MaterialCommunityIcons
              key={ch}
              name={ch === 'EMAIL' ? 'email' : ch === 'SNACKBAR' ? 'bell' : 'cellphone'}
              size={16}
              color={colors.textSecondary}
            />
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────────

export default function AlertsIndexScreen() {
  const router = useRouter();

  const [rules, setRules] = useState<AlertRule[]>([]);
  const [nodeCatalog, setNodeCatalog] = useState<Map<string, NodeCatalog>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>('active');

  // Clear badge when user visits the Alerts tab (shared store)
  const clearBadge = useAlertBadgeStore((s) => s.clearBadge);
  useFocusEffect(
    useCallback(() => {
      clearBadge();
    }, [clearBadge]),
  );

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [fetchedRules, fetchedNodes] = await Promise.all([
        fetchAlertRules(),
        fetchNodeCatalog(),
      ]);

      setRules(fetchedRules);

      // Build node catalog map for quick lookup
      const nodeMap = new Map<string, NodeCatalog>();
      fetchedNodes.forEach((node) => {
        nodeMap.set(node.id, node);
      });
      setNodeCatalog(nodeMap);
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo conectar con el motor de alertas');
    } finally {
      setLoading(false);
    }
  }, []);

  // Toggle handler with optimistic update + revert
  const handleToggle = useCallback(async (id: string, enabled: boolean) => {
    try {
      await toggleRule(id, enabled);
    } catch {
      throw new Error('Toggle failed');
    }
  }, []);

  // ── Filtered rules ──────────────────────────────────────────────────────

  const filteredRules = useMemo(() => {
    if (filter === 'active') {
      return rules.filter((r) => r.enabled);
    }
    return rules;
  }, [rules, filter]);

  // ── Render helpers ──────────────────────────────────────────────────────

  const renderHeader = () => (
    <View>
      <HealthCard />

      {/* Filter chips */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'active' && styles.filterChipActive]}
          onPress={() => setFilter('active')}
        >
          <Text
            style={[styles.filterChipText, filter === 'active' && styles.filterChipTextActive]}
          >
            Activas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => setFilter('all')}
        >
          <Text
            style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}
          >
            Todas
          </Text>
        </TouchableOpacity>
      </View>

      {/* Section title */}
      <Text style={styles.sectionTitle}>
        {filter === 'active' ? 'Reglas activas' : 'Todas las reglas'}
      </Text>
    </View>
  );

  const renderEmpty = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons name="bell-off-outline" size={48} color="#BDBDBD" />
        <Text style={styles.emptyTitle}>No hay reglas de alerta configuradas</Text>
        <Button
          mode="contained"
          onPress={() => router.push('/(tabs)/alerts/editor')}
          style={styles.createButton}
          buttonColor={colors.primary}
        >
          Crear regla
        </Button>
      </View>
    );
  };

  const renderError = () => (
    <View style={styles.errorState}>
      <MaterialCommunityIcons name="cloud-alert" size={48} color="#D32F2F" />
      <Text style={styles.errorTitle}>No se pudo conectar con el motor de alertas</Text>
      <Button
        mode="outlined"
        onPress={loadData}
        style={styles.retryButton}
        textColor={colors.primary}
      >
        Reintentar
      </Button>
    </View>
  );

  // ── Loading state ───────────────────────────────────────────────────────

  if (loading && rules.length === 0) {
    return (
      <View style={styles.centered}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  // ── Error state (no data loaded at all) ─────────────────────────────────

  if (error && rules.length === 0) {
    return (
      <View style={styles.centered}>
        {renderHeader()}
        {renderError()}
      </View>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredRules}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <RuleRow
            rule={item}
            nodeCatalog={nodeCatalog}
            onToggle={handleToggle}
          />
        )}
        onRefresh={loadData}
        refreshing={loading}
      />

      {/* FAB for creating new rules */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/alerts/editor')}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGray,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bgGray,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  listContent: {
    paddingBottom: 80, // Space for FAB
  },
  // ── Filter row ────────────────────────────────────────────────────────
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.textOnPrimary,
  },
  sectionTitle: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // ── Rule row ──────────────────────────────────────────────────────────
  row: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: 12,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nodeName: {
    fontSize: typography.sizes.bodyMedium,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  rowDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  conditionChip: {
    backgroundColor: colors.bgGreen,
    height: 24,
  },
  conditionChipText: {
    fontSize: 10,
    color: colors.darkGreen,
  },
  thresholdText: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
  },
  channelsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  // ── Empty state ───────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  createButton: {
    marginTop: spacing.md,
  },
  // ── Error state ───────────────────────────────────────────────────────
  errorState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: spacing.lg,
  },
  errorTitle: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textError,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.md,
  },
  // ── FAB ───────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});
