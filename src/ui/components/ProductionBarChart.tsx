/**
 * ProductionBarChart — Native View-based bar chart for Web-safe rendering.
 *
 * Pattern: Pure UI Component
 * Why replaced:
 * - react-native-chart-kit depende de react-native-svg, que tiene
 *   problemas de compatibilidad con Expo Web.
 * - Esta implementación usa solo View nativas de React Native,
 *   100% compatible con Web, iOS y Android.
 *
 * Features:
 * - Barras horizontales con etiqueta + valor
 * - Color dinámico basado en el valor (verde ≥ promedio, ámbar < promedio)
 * - Estado vacío cuando no hay datos
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

interface ProductionBarChartProps {
  data: {
    labels: string[];
    datasets: [{ data: number[] }];
  };
}

export function ProductionBarChart({ data }: ProductionBarChartProps) {
  if (data.labels.length === 0 || data.datasets[0].data.length === 0) {
    return (
      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderText}>Sin datos para graficar</Text>
        <Text style={styles.placeholderSubtext}>
          Complete un turno de producción para ver las gráficas
        </Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.datasets[0].data, 1);

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.chartTitle}>
        Producción por Línea
      </Text>
      {data.labels.map((label, index) => {
        const value = data.datasets[0].data[index];
        const barWidth = (value / maxValue) * 100;
        const isAboveAverage = value >= maxValue * 0.5;

        return (
          <View key={label} style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={1}>
              {label}
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.max(barWidth, 4)}%`,
                    backgroundColor: isAboveAverage ? '#388E3C' : '#F9A825',
                  },
                ]}
              />
            </View>
            <Text style={styles.barValue}>{value}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  chartTitle: {
    fontWeight: 'bold',
    color: '#5D4037',
    marginBottom: 16,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  barLabel: {
    width: 80,
    fontSize: 12,
    color: '#5D4037',
    fontWeight: '600',
  },
  barTrack: {
    flex: 1,
    height: 24,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 8,
  },
  barValue: {
    width: 50,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#5D4037',
  },
  placeholderContainer: {
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 160,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  placeholderText: {
    color: '#757575',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  placeholderSubtext: {
    color: '#9E9E9E',
    fontSize: 13,
    textAlign: 'center',
  },
});
