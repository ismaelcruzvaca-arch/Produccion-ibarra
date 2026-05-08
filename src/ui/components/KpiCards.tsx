import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import type { DashboardKPIs } from '../hooks/useDashboardData';

interface KpiCardsProps {
  kpis: DashboardKPIs;
}

function getCalidadColor(percent: number): string {
  if (percent >= 95) return '#4CAF50';
  if (percent < 80) return '#F44336';
  if (percent < 90) return '#FF9800';
  return '#5D4037';
}

const KPI_CONFIG: Array<{
  key: keyof DashboardKPIs;
  title: string;
  isCalidad: boolean;
}> = [
  { key: 'totalPiezas', title: 'Total Piezas', isCalidad: false },
  { key: 'calidadPercent', title: 'Calidad (%)', isCalidad: true },
  { key: 'tiempoParoMin', title: 'Tiempo de Paro (min)', isCalidad: false },
  { key: 'piezasBuenas', title: 'Piezas Buenas', isCalidad: false },
];

export function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <View style={styles.container}>
      {KPI_CONFIG.map(({ key, title, isCalidad }) => {
        const value = kpis[key];
        const color = isCalidad ? getCalidadColor(value) : '#5D4037';
        return (
          <Card key={key} style={styles.card}>
            <Card.Content>
              <Text variant="bodySmall" style={styles.title}>
                {title}
              </Text>
              <Text
                variant="headlineMedium"
                style={[styles.value, { color }]}
              >
                {value}
              </Text>
            </Card.Content>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  title: {
    color: '#757575',
  },
  value: {
    fontWeight: 'bold',
    marginTop: 4,
  },
});
