/**
 * Reports screen — placeholder for OEE and Production reports.
 *
 * This screen will host:
 * - OEE dashboards (Availability, Performance, Quality)
 * - Production reports (output, waste, downtime)
 * - Shift summaries and historical trends
 *
 * Optimised for industrial tablets with touch targets ≥48 dp.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card } from 'react-native-paper';

export default function ReportsScreen() {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Reportes de Producción
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        OEE y métricas de línea
      </Text>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge">OEE</Text>
          <Text variant="bodyMedium">
            Overall Equipment Effectiveness por línea y turno
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge">Producción</Text>
          <Text variant="bodyMedium">
            Tonelaje, paros y eficiencia
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge">Calidad</Text>
          <Text variant="bodyMedium">
            Rechazos, retrabajo y análisis de causa raíz
          </Text>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FAFAFA',
  },
  title: {
    fontWeight: 'bold',
    color: '#5D4037',
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 24,
    color: '#757575',
  },
  card: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
});
