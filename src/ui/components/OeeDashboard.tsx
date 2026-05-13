/**
 * OEE Dashboard — context-aware main dashboard component.
 *
 * Renders different layouts based on machine state:
 * - No shift active    → "Iniciar Turno" button
 * - Operando (normal)  → Production + Downtime buttons + metrics
 * - Paro Activo        → Giant "Fin de Paro" button + downtime info
 *
 * Touch targets ≥56 dp for industrial tablet with gloves.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Button, Text, IconButton } from 'react-native-paper';
import type { RxDocument } from 'rxdb';

import type { IOeeEvent } from '../../core/types';
import type { OeeMetrics } from '../../core/oeeCalculator';
import { PARO_BY_CODE } from '../../config/catalogs';

interface OeeDashboardProps {
  isActiveDowntime: boolean;
  activeDowntimeEvent?: RxDocument<IOeeEvent> | null;
  metrics: OeeMetrics;
  isUsingFallbackPpm: boolean;
  onRegisterProduction: () => void;
  onStartDowntime: () => void;
  onEndDowntime: () => void;
  onStartShift: () => void;
  onEndShift: () => void;
  shiftStarted: boolean;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.floor((minutes * 60) % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function OeeDashboard({
  isActiveDowntime,
  activeDowntimeEvent,
  metrics,
  isUsingFallbackPpm,
  onRegisterProduction,
  onStartDowntime,
  onEndDowntime,
  onStartShift,
  onEndShift,
  shiftStarted,
}: OeeDashboardProps) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!isActiveDowntime || !activeDowntimeEvent) {
      setDuration(0);
      return;
    }
    const startTime = activeDowntimeEvent.get('timestamp') as number;
    const update = () => {
      const elapsed = (Date.now() - startTime) / 60000;
      setDuration(elapsed);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isActiveDowntime, activeDowntimeEvent]);

  const reasonCode = activeDowntimeEvent?.get('reason_code') as string | undefined;
  const reason = reasonCode ? PARO_BY_CODE[reasonCode] : undefined;

  if (!shiftStarted) {
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

  if (isActiveDowntime) {
    return (
      <View style={[styles.container, styles.downtimeContainer]}>
        <Card style={styles.downtimeCard}>
          <Card.Content>
            <View style={styles.downtimeHeader}>
              <IconButton icon="alert-circle" size={32} iconColor="#D32F2F" />
              <Text variant="titleLarge" style={styles.downtimeTitle}>
                PARO ACTIVO
              </Text>
            </View>
            <Text variant="titleMedium" style={styles.downtimeReason}>
              {reason?.code ?? '???'} · {reason?.label ?? 'Desconocido'}
            </Text>
            <Text variant="bodyLarge" style={styles.downtimeDuration}>
              Duración: {formatDuration(duration)}
            </Text>
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          onPress={onEndDowntime}
          style={styles.endDowntimeButton}
          contentStyle={styles.endDowntimeButtonContent}
          labelStyle={styles.endDowntimeButtonLabel}
          icon="stop-circle"
          buttonColor="#F9A825"
          textColor="#000000"
        >
          FIN DE PARO
        </Button>
        <Text variant="bodySmall" style={styles.downtimeHint}>
          Cierra el paro activo para continuar
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        OEE Dashboard
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Turno activo · CAVEMIL-03
      </Text>

      {isUsingFallbackPpm && (
        <Card style={styles.warningCard}>
          <Card.Content style={styles.warningContent}>
            <IconButton icon="alert" size={24} iconColor="#F57C00" />
            <Text variant="bodyMedium" style={styles.warningText}>
              PPM por defecto
            </Text>
          </Card.Content>
        </Card>
      )}

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.cardTitle}>
            Registrar Producción
          </Text>
          <Text variant="bodyMedium" style={styles.cardSubtitle}>
            Cajas: {metrics.totalCajas}
          </Text>
        </Card.Content>
        <Card.Actions style={styles.cardActions}>
          <Button
            mode="contained"
            onPress={onRegisterProduction}
            style={styles.actionButton}
            contentStyle={styles.actionButtonContent}
            labelStyle={styles.actionButtonLabel}
            icon="package-variant-closed"
          >
            Registrar Producción
          </Button>
        </Card.Actions>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.cardTitle}>
            Iniciar Paro
          </Text>
          <Text variant="bodyMedium" style={styles.cardSubtitle}>
            Registrar paro de línea
          </Text>
        </Card.Content>
        <Card.Actions style={styles.cardActions}>
          <Button
            mode="contained"
            onPress={onStartDowntime}
            style={[styles.actionButton, styles.downtimeButton]}
            contentStyle={styles.actionButtonContent}
            labelStyle={styles.actionButtonLabel}
            icon="alert-circle"
            buttonColor="#D32F2F"
          >
            Iniciar Paro
          </Button>
        </Card.Actions>
      </Card>

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
  container: {
    flex: 1,
    paddingVertical: 8,
  },
  downtimeContainer: {
    backgroundColor: '#FFEBEE',
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
  warningCard: {
    marginBottom: 12,
    backgroundColor: '#FFF3E0',
  },
  warningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  warningText: {
    color: '#E65100',
    fontWeight: '600',
  },
  card: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  cardTitle: {
    fontWeight: 'bold',
    color: '#5D4037',
    marginBottom: 4,
  },
  cardSubtitle: {
    color: '#757575',
  },
  cardActions: {
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
  },
  actionButtonContent: {
    minHeight: 56,
  },
  actionButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  downtimeButton: {
    backgroundColor: '#D32F2F',
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
  downtimeCard: {
    marginBottom: 16,
    backgroundColor: '#FFEBEE',
    borderColor: '#EF9A9A',
    borderWidth: 1,
  },
  downtimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downtimeTitle: {
    fontWeight: 'bold',
    color: '#D32F2F',
  },
  downtimeReason: {
    color: '#B71C1C',
    marginTop: 8,
  },
  downtimeDuration: {
    color: '#757575',
    marginTop: 4,
  },
  endDowntimeButton: {
    marginTop: 8,
    borderRadius: 8,
  },
  endDowntimeButtonContent: {
    minHeight: 72,
  },
  endDowntimeButtonLabel: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  downtimeHint: {
    textAlign: 'center',
    color: '#757575',
    marginTop: 8,
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
  endShiftButton: {
    marginTop: 8,
    borderRadius: 8,
  },
  endShiftButtonContent: {
    minHeight: 48,
  },
  endShiftButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
