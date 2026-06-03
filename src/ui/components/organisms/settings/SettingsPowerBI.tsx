/**
 * SettingsPowerBI — PowerBI deep link button for admin/supervisor roles.
 *
 * Opens EXPO_PUBLIC_POWERBI_URL via expo-linking when tapped.
 * Hidden for operator role. Shows loading state while opening and
 * error state if the URL is not configured.
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text, Button, Surface } from 'react-native-paper';
import * as Linking from 'expo-linking';

import { useAuthStore } from '../../../../auth/useAuthStore';

export function SettingsPowerBI() {
  const role = useAuthStore((s) => s.role);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const powerBiUrl = process.env.EXPO_PUBLIC_POWERBI_URL;

  // Hidden for operator role
  if (role === 'operator') {
    return null;
  }

  const handleOpen = useCallback(async () => {
    if (!powerBiUrl) {
      setError('URL de Power BI no configurada');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supported = await Linking.canOpenURL(powerBiUrl);
      if (supported) {
        await Linking.openURL(powerBiUrl);
      } else {
        setError('No se puede abrir el enlace de Power BI en este dispositivo');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error al abrir Power BI');
    } finally {
      setLoading(false);
    }
  }, [powerBiUrl]);

  // If URL is not set, show disabled state
  const isDisabled = !powerBiUrl;

  return (
    <Surface style={styles.container} elevation={1}>
      <Text variant="titleMedium" style={styles.title}>Power BI</Text>
      <Text variant="bodyMedium" style={styles.description}>
        Abrir el dashboard de Power BI para visualizar reportes y métricas.
      </Text>
      <Button
        mode="contained"
        icon="chart-bar"
        onPress={handleOpen}
        loading={loading}
        disabled={loading || isDisabled}
        style={[styles.openButton, isDisabled && styles.disabledButton]}
      >
        Abrir Power BI
      </Button>
      {error && (
        <Text variant="bodySmall" style={styles.errorText}>
          {error}
        </Text>
      )}
      {isDisabled && !error && (
        <Text variant="bodySmall" style={styles.infoText}>
          Power BI no está configurado. Contacte al administrador.
        </Text>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
    color: '#212121',
    marginBottom: 4,
  },
  description: {
    color: '#616161',
    marginBottom: 12,
  },
  openButton: {
    borderRadius: 6,
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorText: {
    color: '#C62828',
    marginTop: 8,
  },
  infoText: {
    color: '#9E9E9E',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
