/**
 * MetricsDisplay — OEE metric cards showing disponibilidad, rendimiento, calidad, and OEE.
 *
 * Pattern: Atomic Design — Organism (sub-component of NormalOperationState)
 * Why:
 * - Keeps NormalOperationState under 150 lines.
 * - Encapsulates the OEE metrics layout with inline metric display.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import type { OeeMetrics } from '../../../../core/oeeCalculator';

interface MetricsDisplayProps {
  metrics: OeeMetrics;
}

export function MetricsDisplay({ metrics }: MetricsDisplayProps) {
  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleLarge" style={styles.cardTitle}>
          Métricas OEE
        </Text>
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text variant="titleMedium" style={styles.metricValue}>
              {metrics.disponibilidad.toFixed(1)}%
            </Text>
            <Text variant="bodySmall" style={styles.metricLabel}>
              Disponibilidad
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text variant="titleMedium" style={styles.metricValue}>
              {metrics.rendimiento.toFixed(1)}%
            </Text>
            <Text variant="bodySmall" style={styles.metricLabel}>
              Rendimiento
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text variant="titleMedium" style={styles.metricValue}>
              {metrics.calidad.toFixed(1)}%
            </Text>
            <Text variant="bodySmall" style={styles.metricLabel}>
              Calidad
            </Text>
          </View>
        </View>
        <View style={styles.oeeContainer}>
          <Text variant="headlineMedium" style={styles.oeeValue}>
            {metrics.oee.toFixed(1)}%
          </Text>
          <Text variant="bodySmall" style={styles.oeeLabel}>
            OEE
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  cardTitle: {
    fontWeight: 'bold',
    color: '#5D4037',
    marginBottom: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    marginBottom: 8,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontWeight: 'bold',
    color: '#5D4037',
  },
  metricLabel: {
    color: '#757575',
    marginTop: 4,
  },
  oeeContainer: {
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  oeeValue: {
    fontWeight: 'bold',
    color: '#388E3C',
  },
  oeeLabel: {
    color: '#757575',
  },
});
