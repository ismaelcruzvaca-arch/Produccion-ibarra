import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export default function OrdersScreen() {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium">Órdenes de Trabajo</Text>
      <Text variant="bodyMedium">Listado de órdenes de producción</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
});
