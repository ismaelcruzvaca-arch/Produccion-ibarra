import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';

function triggerSentryTestError() {
  throw new Error('Simulacro de falla en Producción Ibarra - Sentry Test');
}

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium">Ajustes</Text>
      <Text variant="bodyMedium">Configuración de la aplicación</Text>

      <View style={styles.spacer} />

      <Button
        mode="contained"
        buttonColor="#D32F2F"
        textColor="#FFFFFF"
        icon="alert-circle"
        onPress={triggerSentryTestError}
        style={styles.dangerButton}
      >
        ⚠️ Simular Error Crítico
      </Button>
      <Text variant="bodySmall" style={styles.hint}>
        Solo para pruebas de monitoreo. Se eliminará en la siguiente versión.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    padding: 24,
  },
  spacer: {
    height: 32,
  },
  dangerButton: {
    width: '100%',
    maxWidth: 360,
  },
  hint: {
    marginTop: 8,
    textAlign: 'center',
    color: '#9E9E9E',
  },
});
