/**
 * NoShiftState — Renders when no shift is active.
 *
 * Pattern: Atomic Design — Organism (state sub-component of OeeDashboard)
 * Why:
 * - Extracted from OeeDashboard monolith to keep each file <150 lines.
 * - Shows "Iniciar Turno" CTA with clear visual hierarchy.
 *
 * Touch targets ≥56 dp for industrial tablet with gloves.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';

interface NoShiftStateProps {
  onStartShift: () => void;
}

export function NoShiftState({ onStartShift }: NoShiftStateProps) {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        OEE Dashboard
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        No hay turno activo
      </Text>
      <Button
        mode="contained"
        onPress={onStartShift}
        style={styles.mainButton}
        contentStyle={styles.mainButtonContent}
        labelStyle={styles.mainButtonLabel}
        icon="play"
      >
        Iniciar Turno
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 8,
  },
  title: {
    fontWeight: 'bold',
    color: '#5D4037',
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 16,
    color: '#757575',
  },
  mainButton: {
    marginTop: 24,
    borderRadius: 8,
  },
  mainButtonContent: {
    minHeight: 64,
  },
  mainButtonLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
});
