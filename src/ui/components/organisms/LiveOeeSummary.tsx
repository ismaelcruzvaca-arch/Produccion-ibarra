/**
 * LiveOeeSummary — Card that shows a live summary of OEE events.
 *
 * Pattern: Atomic Design — Organism
 * Why:
 * - Extracted from `app/(tabs)/index.tsx` to reduce monolith size.
 * - Calculates totals from raw events (box_count, reject_count, downtime)
 *   so the dashboard shows live data without waiting for a shift report.
 *
 * Props:
 * - events: IOeeEvent[] — list of all OEE events to summarise
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import type { IOeeEvent } from '../../../core/types';

interface LiveOeeSummaryProps {
  events: IOeeEvent[];
}

export function LiveOeeSummary({ events }: LiveOeeSummaryProps) {
  const totalBoxes = events
    .filter((e) => e.event_type === 'box_count')
    .reduce((sum, e) => sum + (e.quantity ?? 0), 0);

  const totalRejects = events
    .filter((e) => e.event_type === 'reject_count')
    .reduce((sum, e) => sum + (e.quantity ?? 0), 0);

  const downtimes = events.filter((e) => e.event_type === 'downtime_start');
  const closedDowntimes = new Set(
    events
      .filter((e) => e.event_type === 'downtime_end' && e.related_event_id)
      .map((e) => e.related_event_id)
  );
  const activeDowntimes = downtimes.filter((e) => !closedDowntimes.has(e.id));

  const hasShiftStart = events.some((e) => e.event_type === 'shift_start');
  const hasShiftEnd = events.some((e) => e.event_type === 'shift_end');
  const shiftActive = hasShiftStart && !hasShiftEnd;

  return (
    <Card style={styles.liveCard}>
      <Card.Content>
        <View style={styles.liveHeader}>
          <Text variant="titleMedium" style={styles.liveTitle}>
            Producción en Vivo
          </Text>
          <View
            style={[
              styles.liveDot,
              { backgroundColor: shiftActive ? '#4CAF50' : '#9E9E9E' },
            ]}
          />
        </View>

        <View style={styles.liveMetricsRow}>
          <View style={styles.liveMetric}>
            <Text variant="titleLarge" style={styles.liveValue}>
              {totalBoxes}
            </Text>
            <Text variant="bodySmall" style={styles.liveLabel}>
              Cajas
            </Text>
          </View>
          <View style={styles.liveMetric}>
            <Text variant="titleLarge" style={styles.liveValue}>
              {totalRejects}
            </Text>
            <Text variant="bodySmall" style={styles.liveLabel}>
              Rechazo
            </Text>
          </View>
          <View style={styles.liveMetric}>
            <Text variant="titleLarge" style={styles.liveValue}>
              {downtimes.length}
            </Text>
            <Text variant="bodySmall" style={styles.liveLabel}>
              Paros
            </Text>
          </View>
          <View style={styles.liveMetric}>
            <Text
              variant="titleLarge"
              style={[
                styles.liveValue,
                {
                  color: activeDowntimes.length > 0 ? '#D32F2F' : '#4CAF50',
                },
              ]}
            >
              {activeDowntimes.length}
            </Text>
            <Text variant="bodySmall" style={styles.liveLabel}>
              Paro Activo
            </Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  liveCard: {
    marginBottom: 16,
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
    borderWidth: 1,
  },
  liveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  liveTitle: {
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  liveMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  liveMetric: {
    alignItems: 'center',
    flex: 1,
  },
  liveValue: {
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  liveLabel: {
    color: '#558B2F',
    marginTop: 2,
  },
});
