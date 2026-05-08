import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import type { TimeFilter } from '../hooks/useDashboardData';

interface TimeFilterProps {
  value: TimeFilter;
  onValueChange: (v: TimeFilter) => void;
}

export function TimeFilter({ value, onValueChange }: TimeFilterProps) {
  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={value}
        onValueChange={(v) => onValueChange(v as TimeFilter)}
        buttons={[
          { value: 'all', label: 'Todos' },
          { value: 'shift', label: 'Turno Actual' },
          { value: '24h', label: 'Últimas 24h' },
        ]}
        style={styles.buttons}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    alignItems: 'center',
  },
  buttons: {
    width: '100%',
  },
});
