import * as Sentry from '@sentry/react';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button, Surface } from 'react-native-paper';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    integrations: [],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
} else if (process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line no-console
  console.warn('[Sentry] EXPO_PUBLIC_SENTRY_DSN no está configurado. Los errores no se reportarán.');
}

/**
 * Fallback UI cuando Sentry Error Boundary atrapa un crash.
 * Muestra un mensaje amigable y un botón para recargar la app.
 */
export function SentryFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <View style={styles.container}>
      <Surface style={styles.card}>
        <Text style={styles.title}>Algo salió mal</Text>
        <Text style={styles.subtitle}>
          El equipo ha sido notificado automáticamente. Por favor, recarga la aplicación.
        </Text>
        {__DEV__ && (
          <Text style={styles.details}>{error.message}</Text>
        )}
        <Button mode="contained" onPress={resetError} style={styles.button}>
          Recargar aplicación
        </Button>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F5F5F5',
  },
  card: {
    padding: 24,
    borderRadius: 12,
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#5D4037',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    color: '#616161',
  },
  details: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    color: '#D32F2F',
    fontFamily: 'monospace',
  },
  button: {
    marginTop: 8,
  },
});

export const SentryErrorBoundary = Sentry.ErrorBoundary;
export default Sentry;
