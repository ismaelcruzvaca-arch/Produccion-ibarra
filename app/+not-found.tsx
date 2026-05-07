import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { Link } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Página no encontrada
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        La ruta solicitada no existe.
      </Text>
      <Link href="/" asChild>
        <Button mode="contained" style={styles.button}>
          Volver al inicio
        </Button>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FAFAFA',
  },
  title: {
    marginBottom: 12,
    color: '#5D4037',
  },
  subtitle: {
    marginBottom: 24,
    color: '#757575',
  },
  button: {
    minHeight: 48,
  },
});
