import React from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { BarChart } from 'react-native-chart-kit';

interface ProductionBarChartProps {
  data: {
    labels: string[];
    datasets: [{ data: number[] }];
  };
}

export function ProductionBarChart({ data }: ProductionBarChartProps) {
  if (data.labels.length === 0) {
    return (
      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderText}>Sin datos para graficar</Text>
      </View>
    );
  }

  const screenWidth = Dimensions.get('window').width - 32;

  return (
    <View style={styles.container}>
      <BarChart
        data={data}
        width={screenWidth}
        height={220}
        yAxisLabel=""
        yAxisSuffix=""
        fromZero
        showValuesOnTopOfBars
        chartConfig={{
          backgroundColor: '#FFFFFF',
          backgroundGradientFrom: '#FFFFFF',
          backgroundGradientTo: '#FFFFFF',
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(93, 64, 55, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(141, 110, 99, ${opacity})`,
          style: {
            borderRadius: 8,
          },
          barPercentage: 0.6,
        }}
        style={styles.chart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 8,
    marginBottom: 16,
  },
  chart: {
    borderRadius: 8,
  },
  placeholderContainer: {
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 220,
  },
  placeholderText: {
    color: '#757575',
    fontSize: 16,
  },
});
