/**
 * Home screen — Production dashboard for Chocolate Ibarra PRODUCCIÓN.
 *
 * Displays:
 * - OEE overview cards
 * - Connection and sync status
 * - Quick actions to production reports
 *
 * Optimised for industrial tablets with large touch targets (≥48 dp).
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { ConnectionBadge } from '../../src/ui/components/ConnectionBadge';
import { SyncMonitor } from '../../src/ui/components/SyncMonitor';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          Chocolate Ibarra
        </Text>
        <ConnectionBadge />
      </View>

      <Text variant="titleMedium" style={styles.subtitle}>
        PRODUCCIÓN — Panel de Control
      </Text>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge">OEE General</Text>
          <Text variant="bodyMedium">
            Disponibilidad · Rendimiento · Calidad
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge">Reportes de Producción</Text>
          <Text variant="bodyMedium">
            Registro de paros, tonelaje y eficiencia
          </Text>
        </Card.Content>
      </Card>

      <View style={styles.actions}>
        <Button
          mode="contained"
          style={styles.button}
          contentStyle={styles.buttonContent}
          onPress={() => {
            /* TODO: Navigate to reports */
          }}
        >
          Ver Reportes
        </Button>
        <Button
          mode="outlined"
          style={styles.button}
          contentStyle={styles.buttonContent}
          onPress={() => {
            /* TODO: Navigate to OEE detail */
          }}
        >
          Detalle OEE
        </Button>
      </View>

      <SyncMonitor />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 8,
  },
  title: {
    fontWeight: 'bold',
    color: '#5D4037',
  },
  subtitle: {
    marginBottom: 24,
    color: '#757575',
  },
  card: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  actions: {
    gap: 12,
    marginBottom: 24,
  },
  button: {
    minHeight: 48,
  },
  buttonContent: {
    paddingVertical: 8,
    minHeight: 48,
  },
});
