import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { LineSelector } from './LineSelector';
import { MachineSelector } from './MachineSelector';
import { ShiftSelector } from './ShiftSelector';
import { ProductSelector } from './ProductSelector';
import { useOeeValidation } from '../../hooks/useOeeValidation';

export function OeeSelectorBar() {
  const { isValid, message } = useOeeValidation();

  return (
    <View style={styles.container}>
      <View style={styles.selectorsRow}>
        <LineSelector />
        <View style={styles.spacing} />
        <MachineSelector />
        <View style={styles.spacing} />
        <ShiftSelector />
        <View style={styles.spacing} />
        <ProductSelector />
      </View>
      {!isValid && message && (
        <Text style={styles.warningText}>{message}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectorsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spacing: {
    width: 16,
  },
  warningText: {
    color: '#d32f2f', // error color
    marginTop: 8,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
