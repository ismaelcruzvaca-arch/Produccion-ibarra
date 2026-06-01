/**
 * Alert Events History — paginated timeline with filters.
 *
 * FlatList in reverse chronological order with:
 * - Pull-to-refresh
 * - Pagination ("Cargar más" at bottom)
 * - Filters: node, date range, event type
 * - Expandable rows with full details + acknowledge action
 *
 * Pattern: Screen / Template (Atomic Design)
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { Text, Button, Chip, Portal, Dialog, Checkbox } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  fetchAlertEvents,
  fetchNodeCatalog,
  acknowledgeEvent,
} from '../../../src/services/alertEngine';
import type { AlertEvent, NodeCatalog, AlertEventFilters } from '../../../src/types/alertEngine';
import { colors, spacing, typography } from '../../../src/ui/theme/tokens';

const PAGE_SIZE = 20;

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days}d`;
  } catch {
    return iso;
  }
}

function formatFullDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function eventTypeColor(tipo: string): string {
  const map: Record<string, string> = {
    SILENCE_TIMEOUT: '#F57C00',
    TEMP_EXCEEDED: '#D32F2F',
    UMBRAL: '#1976D2',
    ERROR: '#C62828',
    WARNING: '#F9A825',
  };
  return map[tipo] ?? '#757575';
}

function dispatchIcon(event: AlertEvent): { icon: string; color: string } {
  if (!event.dispatched) return { icon: 'minus-circle-outline', color: '#BDBDBD' };
  if (!event.dispatch_result) return { icon: 'check-circle', color: '#388E3C' };
  // dispatch_result exists — means it failed (gateway sets result only on error)
  return { icon: 'close-circle', color: '#D32F2F' };
}

// ─── Event Row ──────────────────────────────────────────────────────────────────

interface EventRowProps {
  event: AlertEvent;
  nodeName: string;
  onAcknowledge: (id: string) => Promise<void>;
}

function EventRow({ event, nodeName, onAcknowledge }: EventRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const disp = dispatchIcon(event);

  const handleAcknowledge = useCallback(async () => {
    setAcknowledging(true);
    try {
      await onAcknowledge(event.id);
    } catch {
      // Silent — error handling is caller's responsibility
    } finally {
      setAcknowledging(false);
    }
  }, [event.id, onAcknowledge]);

  return (
    <TouchableOpacity
      style={styles.eventRow}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      {/* Main row content */}
      <View style={styles.eventHeader}>
        <View style={styles.eventTime}>
          <Text style={styles.eventTimestamp}>{formatRelativeTime(event.detected_at)}</Text>
          <MaterialCommunityIcons
            name={disp.icon}
            size={14}
            color={disp.color}
          />
        </View>
        <Chip
          style={[styles.eventTypeChip, { backgroundColor: eventTypeColor(event.tipo_evento) + '20' }]}
          textStyle={[styles.eventTypeChipText, { color: eventTypeColor(event.tipo_evento) }]}
        >
          {event.tipo_evento}
        </Chip>
      </View>

      <Text style={styles.eventNode}>{nodeName}</Text>
      <Text style={styles.eventMessage} numberOfLines={expanded ? undefined : 2}>
        {event.mensaje}
      </Text>

      {/* Expandable details */}
      {expanded && (
        <View style={styles.eventDetails}>
          <Text style={styles.detailLabel}>Fecha completa</Text>
          <Text style={styles.detailValue}>{formatFullDate(event.detected_at)}</Text>

          {event.dispatch_result && (
            <>
              <Text style={[styles.detailLabel, { marginTop: 8 }]}>Resultado del envío</Text>
              <Text style={styles.detailValue}>{event.dispatch_result}</Text>
            </>
          )}

          {!event.acknowledged && (
            <Button
              mode="outlined"
              onPress={handleAcknowledge}
              loading={acknowledging}
              disabled={acknowledging}
              style={styles.acknowledgeButton}
              textColor={colors.primary}
              icon="check"
            >
              {acknowledging ? 'Confirmando...' : 'Revisado'}
            </Button>
          )}

          {event.acknowledged && (
            <Chip icon="check-circle" style={styles.acknowledgedChip}>
              Revisado
            </Chip>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────────

export default function AlertEventsScreen() {
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [nodeCatalog, setNodeCatalog] = useState<Map<string, NodeCatalog>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<AlertEventFilters>({});
  const [filterNode, setFilterNode] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');

  // Pagination
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Track latest request to debounce rapid filter changes
  const latestRequestRef = useRef(0);

  // ── Load initial data ─────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      loadEvents(true);
      loadNodeCatalog();
    }, []),
  );

  const loadNodeCatalog = useCallback(async () => {
    try {
      const nodes = await fetchNodeCatalog();
      const map = new Map<string, NodeCatalog>();
      nodes.forEach((n) => map.set(n.id, n));
      setNodeCatalog(map);
    } catch {
      // Non-critical — events still load without names
    }
  }, []);

  const loadEvents = useCallback(
    async (reset: boolean) => {
      const requestId = Date.now();
      latestRequestRef.current = requestId;

      if (reset) {
        setLoading(true);
        setOffset(0);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const activeFilters: AlertEventFilters = {};
        if (filterNode) activeFilters.node_id = filterNode;
        if (filterDateFrom) activeFilters.date_from = filterDateFrom;
        if (filterDateTo) activeFilters.date_to = filterDateTo;
        if (filterType) activeFilters.tipo_evento = filterType;

        const newOffset = reset ? 0 : offset;
        const result = await fetchAlertEvents(undefined, activeFilters, PAGE_SIZE, newOffset);

        // Stale response guard — only apply latest
        if (latestRequestRef.current !== requestId) return;

        if (reset) {
          setEvents(result);
        } else {
          setEvents((prev) => [...prev, ...result]);
        }

        setHasMore(result.length >= PAGE_SIZE);
        if (!reset) {
          setOffset((prev) => prev + result.length);
        } else {
          setOffset(result.length);
        }
      } catch (err: any) {
        if (latestRequestRef.current !== requestId) return;
        setError(err?.message ?? 'No se pudieron cargar los eventos');
      } finally {
        if (latestRequestRef.current === requestId) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [filterNode, filterDateFrom, filterDateTo, filterType, offset],
  );

  // ── Filter apply / clear ──────────────────────────────────────────────

  const applyFilters = useCallback(() => {
    const activeFilters: AlertEventFilters = {};
    if (filterNode) activeFilters.node_id = filterNode;
    if (filterDateFrom) activeFilters.date_from = filterDateFrom;
    if (filterDateTo) activeFilters.date_to = filterDateTo;
    if (filterType) activeFilters.tipo_evento = filterType;
    setFilters(activeFilters);
    loadEvents(true);
  }, [filterNode, filterDateFrom, filterDateTo, filterType, loadEvents]);

  const clearFilters = useCallback(() => {
    setFilterNode('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterType('');
    setFilters({});
    loadEvents(true);
  }, [loadEvents]);

  // ── Acknowledge handler ───────────────────────────────────────────────

  const handleAcknowledge = useCallback(async (id: string) => {
    await acknowledgeEvent(id);
    // Refresh the list to update acknowledgment state
    loadEvents(true);
  }, [loadEvents]);

  // ── Node name resolver ────────────────────────────────────────────────

  const getNodeName = useCallback(
    (nodeId: string): string => {
      const node = nodeCatalog.get(nodeId);
      return node ? `${node.machine.name} / ${node.node_ident}` : nodeId.slice(0, 8);
    },
    [nodeCatalog],
  );

  // ── Distinct event types from loaded events ───────────────────────────

  const distinctTypes = useMemo(() => {
    const types = new Set(events.map((e) => e.tipo_evento));
    return Array.from(types).sort();
  }, [events]);

  // ── Render helpers ────────────────────────────────────────────────────

  const renderHeader = () => (
    <View style={styles.filtersContainer}>
      {/* Filter by node */}
      <Text style={styles.filterLabel}>Nodo</Text>
      <TextInput
        style={styles.filterInput}
        value={filterNode}
        onChangeText={setFilterNode}
        placeholder="Filtrar por ID de nodo"
        placeholderTextColor={colors.textSecondary}
      />

      {/* Date range */}
      <View style={styles.dateRow}>
        <View style={styles.dateField}>
          <Text style={styles.filterLabel}>Desde</Text>
          <TextInput
            style={styles.filterInput}
            value={filterDateFrom}
            onChangeText={setFilterDateFrom}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
        <View style={styles.dateField}>
          <Text style={styles.filterLabel}>Hasta</Text>
          <TextInput
            style={styles.filterInput}
            value={filterDateTo}
            onChangeText={setFilterDateTo}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      </View>

      {/* Event type */}
      <Text style={styles.filterLabel}>Tipo de evento</Text>
      <TextInput
        style={styles.filterInput}
        value={filterType}
        onChangeText={setFilterType}
        placeholder="Ej: SILENCE_TIMEOUT"
        placeholderTextColor={colors.textSecondary}
      />

      {/* Filter actions */}
      <View style={styles.filterActions}>
        <Button
          mode="contained"
          onPress={applyFilters}
          buttonColor={colors.primary}
          compact
          style={styles.filterActionBtn}
        >
          Aplicar filtros
        </Button>
        <Button
          mode="outlined"
          onPress={clearFilters}
          textColor={colors.textSecondary}
          compact
          style={styles.filterActionBtn}
        >
          Limpiar filtros
        </Button>
      </View>

      <Text style={styles.sectionTitle}>
        {Object.keys(filters).length > 0 ? 'Resultados filtrados' : 'Eventos recientes'}
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoading}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.footerText}>Cargando más...</Text>
        </View>
      );
    }

    if (hasMore && events.length > 0) {
      return (
        <Button
          mode="outlined"
          onPress={() => loadEvents(false)}
          style={styles.loadMoreButton}
          textColor={colors.primary}
        >
          Cargar más
        </Button>
      );
    }

    return null;
  };

  const renderEmpty = () => {
    if (loading) return null;

    const hasActiveFilters = Object.keys(filters).length > 0;

    return (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons
          name={hasActiveFilters ? 'filter-remove-outline' : 'bell-off-outline'}
          size={48}
          color="#BDBDBD"
        />
        <Text style={styles.emptyTitle}>
          {hasActiveFilters
            ? 'No se encontraron eventos con los filtros seleccionados'
            : 'No hay eventos de alerta registrados'}
        </Text>
        {hasActiveFilters && (
          <Button
            mode="outlined"
            onPress={clearFilters}
            style={{ marginTop: spacing.md }}
            textColor={colors.primary}
          >
            Limpiar filtros
          </Button>
        )}
      </View>
    );
  };

  const renderError = () => (
    <View style={styles.errorState}>
      <MaterialCommunityIcons name="cloud-alert" size={48} color="#D32F2F" />
      <Text style={styles.errorTitle}>No se pudieron cargar los eventos</Text>
      <Button
        mode="outlined"
        onPress={() => loadEvents(true)}
        style={{ marginTop: spacing.md }}
        textColor={colors.primary}
      >
        Reintentar
      </Button>
    </View>
  );

  // ── Loading state ─────────────────────────────────────────────────────

  if (loading && events.length === 0) {
    return (
      <View style={styles.centered}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  // ── Error state (no data loaded) ──────────────────────────────────────

  if (error && events.length === 0) {
    return (
      <View style={styles.centered}>
        {renderHeader()}
        {renderError()}
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <EventRow
            event={item}
            nodeName={getNodeName(item.node_id)}
            onAcknowledge={handleAcknowledge}
          />
        )}
        onRefresh={() => loadEvents(true)}
        refreshing={loading}
      />
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
    paddingBottom: 24,
  },
  // ── Filters ───────────────────────────────────────────────────────────
  filtersContainer: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.xs,
  },
  filterLabel: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginTop: spacing.xs,
    marginBottom: 2,
  },
  filterInput: {
    backgroundColor: colors.bgGray,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    fontSize: typography.sizes.bodySmall,
    color: colors.textPrimary,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateField: {
    flex: 1,
  },
  filterActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  filterActionBtn: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // ── Event row ─────────────────────────────────────────────────────────
  eventRow: {
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
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xxs,
  },
  eventTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventTimestamp: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
  },
  eventTypeChip: {
    height: 24,
  },
  eventTypeChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  eventNode: {
    fontSize: typography.sizes.bodyMedium,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  eventMessage: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  eventDetails: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailLabel: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailValue: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textPrimary,
    marginTop: 2,
  },
  acknowledgeButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  acknowledgedChip: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.bgGreen,
  },
  // ── Load more ─────────────────────────────────────────────────────────
  footerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  footerText: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
  },
  loadMoreButton: {
    margin: spacing.md,
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
});
