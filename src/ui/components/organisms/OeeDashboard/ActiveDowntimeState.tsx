/**
 * ActiveDowntimeState — Renders when a downtime is active.
 *
 * Pattern: Atomic Design — Organism (state sub-component of OeeDashboard)
 * Why:
 * - Extracted from OeeDashboard monolith to keep each file <150 lines.
 * - Shows PARO ACTIVO alert card with reason, timer, and "FIN DE PARO" CTA.
 *
 * Uses DurationTimer from molecules for the live countdown.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Button, Text, IconButton } from 'react-native-paper';
import type { RxDocument } from 'rxdb';
import type { IOeeEvent } from '../../../../core/types';
import { PARO_BY_CODE } from '../../../../config/catalogs';
import { DurationTimer } from '../../molecules/DurationTimer';

interface ActiveDowntimeStateProps {
  activeDowntimeEvent: RxDocument<IOeeEvent> | null;
  onEndDowntime: () => void;
}

export function ActiveDowntimeState({
  activeDowntimeEvent,
  onEndDowntime,
}: ActiveDowntimeStateProps) {
  const reasonCode = activeDowntimeEvent?.get('reason_code') as string | undefined;
  const reason = reasonCode ? PARO_BY_CODE[reasonCode] : undefined;
  const startTime = activeDowntimeEvent?.get('timestamp') as number | undefined;

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
          <Text variant="bodyLarge" style={styles.downtimeDurationLabel}>
            Duración:
          </Text>
          {startTime && (
            <DurationTimer
              startTime={startTime}
              isActive={true}
              color="#D32F2F"
            />
          )}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 8,
  },
  downtimeContainer: {
    backgroundColor: '#FFEBEE',
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
  downtimeDurationLabel: {
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
});
