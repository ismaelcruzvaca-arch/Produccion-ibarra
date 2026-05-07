/**
 * Home screen — initial route of the application.
 *
 * Displays the main dashboard for the Chocolate Ibarra production app.
 * Optimized for industrial tablets with large touch targets (≥48dp).
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { ConnectionBadge } from '../src/ui/components/ConnectionBadge';
import { SyncMonitor } from '../src/ui/components/SyncMonitor';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          Chocolate Ibarra
        </Text>
        <ConnectionBadge />
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge">Producción</Text>
          <Text variant="bodyMedium">Panel de control de órdenes de trabajo</Text>
        </Card.Content>
      </Card>

      <View style={styles.actions}>
        <Button
          mode="contained"
          style={styles.button}
          contentStyle={styles.buttonContent}
          onPress={() => { /* TODO: Navigate to orders */ }}
        >
          Ver Órdenes
        </Button>
        <Button
          mode="outlined"
          style={styles.button}
          contentStyle={styles.buttonContent}
          onPress={() => { /* TODO: Navigate to assets */ }}
        >
          Activos
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
    marginBottom: 24,
    marginTop: 8,
  },
  title: {
    fontWeight: 'bold',
    color: '#5D4037',
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
