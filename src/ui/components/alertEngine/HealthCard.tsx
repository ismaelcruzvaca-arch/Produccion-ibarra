/**
 * HealthCard — compact card showing Alert Engine health status.
 *
 * Displays:
 * - Last evaluation timestamp
 * - Rules evaluated count
 * - Active alerts count
 * - Health status indicator (green/yellow/red)
 *
 * Used in the Alerts tab header and potentially dashboard/settings in the future.
 *
 * Pattern: Molecule Component
 * Why:
 * - Self-contained: it manages its own data fetching via useFocusEffect.
 * - Reusable: can be embedded in any screen that needs engine health.
 * - Handles all states: loading, error, empty (no record), stale data, and happy.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchAlertEngineHealth } from '../../../services/alertEngine';
import type { AlertEngineHealth } from '../../../types/alertEngine';

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function isStale(lastEvaluationAt: string): boolean {
  try {
    const elapsed = Date.now() - new Date(lastEvaluationAt).getTime();
    return elapsed > STALE_THRESHOLD_MS;
  } catch {
    return false;
  }
}

function statusColor(status: AlertEngineHealth['status']): string {
  switch (status) {
    case 'healthy':
      return '#388E3C';
    case 'degraded':
      return '#F9A825';
    case 'down':
      return '#D32F2F';
    default:
      return '#757575';
  }
}

function statusIcon(status: AlertEngineHealth['status']): string {
  switch (status) {
    case 'healthy':
      return 'check-circle';
    case 'degraded':
      return 'alert-circle';
    case 'down':
      return 'close-circle';
    default:
      return 'help-circle';
  }
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function HealthCard() {
  const [health, setHealth] = useState<AlertEngineHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStaleTooltip, setShowStaleTooltip] = useState(false);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAlertEngineHealth();
      setHealth(result);
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar estado del motor');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch on every screen focus
  useFocusEffect(
    useCallback(() => {
      loadHealth();
    }, [loadHealth]),
  );

  // ── Loading state ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.card, styles.cardMuted]}>
        <ActivityIndicator size="small" color="#5D4037" />
        <Text style={styles.mutedText}>Cargando estado del motor...</Text>
      </View>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────

  if (error) {
    return (
      <View style={[styles.card, styles.cardMuted]}>
        <View style={styles.row}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#757575" />
          <Text style={styles.mutedText}>Estado del motor no disponible</Text>
          <TouchableOpacity onPress={loadHealth} style={styles.retryButton}>
            <MaterialCommunityIcons name="refresh" size={18} color="#5D4037" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Empty state (no health record) ──────────────────────────────────────

  if (!health) {
    return (
      <View style={[styles.card, styles.cardMuted]}>
        <MaterialCommunityIcons name="engine-outline" size={20} color="#BDBDBD" />
        <Text style={styles.mutedText}>Motor de alertas sin ejecuciones registradas</Text>
      </View>
    );
  }

  // ── Happy state ─────────────────────────────────────────────────────────

  const stale = isStale(health.last_evaluation_at);

  return (
    <View style={[styles.card, stale ? styles.cardWarning : styles.cardNormal]}>
      {/* Header row */}
      <View style={styles.row}>
        <MaterialCommunityIcons
          name={statusIcon(health.status)}
          size={18}
          color={statusColor(health.status)}
        />
        <Text style={styles.cardTitle}>Motor de Alertas</Text>
      </View>

      {/* Last evaluation */}
      <TouchableOpacity
        style={styles.row}
        onPress={() => stale && setShowStaleTooltip(!showStaleTooltip)}
        activeOpacity={stale ? 0.7 : 1}
      >
        <Text style={styles.label}>Última ejecución:</Text>
        <Text style={styles.value}>{formatTimestamp(health.last_evaluation_at)}</Text>
        {stale && (
          <MaterialCommunityIcons
            name="clock-alert-outline"
            size={14}
            color="#F9A825"
            style={styles.staleIcon}
          />
        )}
      </TouchableOpacity>

      {showStaleTooltip && stale && (
        <Text style={styles.tooltip}>Última actualización hace más de 10 min</Text>
      )}

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{health.rules_evaluated}</Text>
          <Text style={styles.statLabel}>Reglas evaluadas</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{health.alerts_triggered}</Text>
          <Text style={styles.statLabel}>Alertas activas</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  cardNormal: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#388E3C',
  },
  cardWarning: {
    backgroundColor: '#FFF8E1',
    borderLeftWidth: 4,
    borderLeftColor: '#F9A825',
  },
  cardMuted: {
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5D4037',
  },
  label: {
    fontSize: 12,
    color: '#757575',
  },
  value: {
    fontSize: 12,
    color: '#424242',
    fontWeight: '500',
  },
  staleIcon: {
    marginLeft: 4,
  },
  tooltip: {
    fontSize: 11,
    color: '#E65100',
    marginTop: 4,
    marginLeft: 24,
    fontStyle: 'italic',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 24,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#5D4037',
  },
  statLabel: {
    fontSize: 10,
    color: '#757575',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  mutedText: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  retryButton: {
    padding: 4,
    marginLeft: 8,
  },
});
