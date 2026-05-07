import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export default function AssetsScreen() {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium">Activos</Text>
      <Text variant="bodyMedium">Inventario de equipos y maquinaria</Text>
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
