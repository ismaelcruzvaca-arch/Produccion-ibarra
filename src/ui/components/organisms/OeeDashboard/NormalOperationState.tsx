/**
 * NormalOperationState — Renders when shift is active and no downtime.
 *
 * Shows production registration, downtime start, OEE metrics, and end shift.
 * Touch targets ≥56 dp for industrial tablet with gloves.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';
import type { OeeMetrics } from '../../../../core/oeeCalculator';
import { MetricsDisplay } from './MetricsDisplay';
import { CardActionButton } from './CardActionButton';

interface NormalOperationStateProps {
  metrics: OeeMetrics;
  onRegisterProduction: () => void;
  onStartDowntime: () => void;
  onEndShift: () => void;
  isIotMachine?: boolean;
}

export function NormalOperationState({
  metrics,
  onRegisterProduction,
  onStartDowntime,
  onEndShift,
  isIotMachine,
}: NormalOperationStateProps) {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        OEE Dashboard
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Turno activo · CAVEMIL-03
      </Text>

      {!isIotMachine && (
        <CardActionButton
          title="Registrar Producción"
          subtitle={`Cajas: ${metrics.totalCajas}`}
          buttonLabel="Registrar Producción"
          icon="package-variant-closed"
          onPress={onRegisterProduction}
        />
      )}

      <CardActionButton
        title="Iniciar Paro"
        subtitle="Registrar paro de línea"
        buttonLabel="Iniciar Paro"
        icon="alert-circle"
        buttonColor="#D32F2F"
        onPress={onStartDowntime}
      />

      <MetricsDisplay metrics={metrics} />

      <Button
        mode="outlined"
        onPress={onEndShift}
        style={styles.endShiftButton}
        contentStyle={styles.endShiftButtonContent}
        labelStyle={styles.endShiftButtonLabel}
        icon="stop"
      >
        Cerrar Turno
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingVertical: 8 },
  title: { fontWeight: 'bold', color: '#5D4037', marginBottom: 4 },
  subtitle: { marginBottom: 16, color: '#757575' },
  endShiftButton: { marginTop: 8, borderRadius: 8 },
  endShiftButtonContent: { minHeight: 48 },
  endShiftButtonLabel: { fontSize: 14, fontWeight: '600' },
});
