/**
 * ProductionLineCard — Card component for a production line in the dashboard hub.
 *
 * Pattern: Molecule (Atomic Design)
 * Why: Composed of existing atoms (Card, Text, Chip) into a reusable line-status
 *      card used in both operator and supervisor dashboards.
 *
 * Props:
 *   id          — line identifier
 *   name        — human-readable line name (e.g. "Tostador 1")
 *   currentProduct — optional product description
 *   status      — 'running' | 'stopped' | 'idle'
 *   oee         — optional OEE percentage (0–100)
 *   lastUpdated — optional epoch ms timestamp
 *   activeAlerts — optional count of active alerts (0 = none)
 *   onPress     — callback with line id when card is pressed
 *
 * Design: spec RL-compliant, touch target >= 48dp, no emoji characters.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Chip, TouchableRipple } from 'react-native-paper';

export type LineStatus = 'running' | 'stopped' | 'idle';

export interface ProductionLineCardProps {
  id: string;
  name: string;
  currentProduct?: string;
  status: LineStatus;
  oee?: number;
  lastUpdated?: number;
  activeAlerts?: number;
  onPress: (lineId: string) => void;
}

const STATUS_COLORS: Record<LineStatus, string> = {
  running: '#4CAF50',
  stopped: '#F44336',
  idle: '#FF9800',
};

const STATUS_LABELS: Record<LineStatus, string> = {
  running: 'Operando',
  stopped: 'Detenido',
  idle: 'Sin actividad',
};

function formatTimestamp(epochMs?: number): string {
  if (!epochMs) return '';
  const d = new Date(epochMs);
  return d.toLocaleString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function oeeColor(value?: number): string {
  if (value == null) return '#9E9E9E';
  if (value >= 85) return '#4CAF50';
  if (value >= 60) return '#FF9800';
  return '#F44336';
}

export function ProductionLineCard({
  id,
  name,
  currentProduct,
  status,
  oee,
  lastUpdated,
  activeAlerts,
  onPress,
}: ProductionLineCardProps) {
  return (
    <TouchableRipple
      onPress={() => onPress(id)}
      style={styles.touchable}
      borderless
    >
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <Text variant="titleMedium" style={styles.lineName} numberOfLines={1}>
              {name}
            </Text>
            <Chip
              style={[styles.statusChip, { backgroundColor: STATUS_COLORS[status] + '20' }]}
              textStyle={{ color: STATUS_COLORS[status], fontSize: 12 }}
            >
              {STATUS_LABELS[status]}
            </Chip>
          </View>

          {currentProduct ? (
            <Text variant="bodySmall" style={styles.product} numberOfLines={1}>
              {currentProduct}
            </Text>
          ) : null}

          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text variant="labelSmall" style={styles.metricLabel}>OEE</Text>
              <Text style={[styles.metricValue, { color: oeeColor(oee) }]}>
                {oee != null ? `${oee.toFixed(1)}%` : '--'}
              </Text>
            </View>

            <View style={styles.metric}>
              <Text variant="labelSmall" style={styles.metricLabel}>Alertas</Text>
              <Text style={styles.metricValue}>
                {activeAlerts != null && activeAlerts > 0 ? activeAlerts : '0'}
              </Text>
            </View>

            <View style={styles.metric}>
              <Text variant="labelSmall" style={styles.metricLabel}>Actualizado</Text>
              <Text style={styles.metricValue}>
                {lastUpdated ? formatTimestamp(lastUpdated) : '--'}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  touchable: {
    marginBottom: 12,
    borderRadius: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  lineName: {
    fontWeight: 'bold',
    color: '#5D4037',
    flex: 1,
    marginRight: 8,
  },
  statusChip: {
    height: 28,
  },
  product: {
    color: '#757575',
    marginBottom: 12,
  },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  metric: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    color: '#9E9E9E',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#424242',
  },
});
