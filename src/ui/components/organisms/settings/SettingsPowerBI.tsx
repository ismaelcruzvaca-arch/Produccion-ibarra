/**
 * SettingsPowerBI — Power BI deep-link button section.
 *
 * Pattern: Atomic Design — Organism (SS-2)
 * Why:
 * - One organism per settings section (AD-2).
 * - Uses EXPO_PUBLIC_POWERBI_URL env var (AD-4).
 * - Disabled state with helper text if URL is not configured.
 * - Uses List.Accordion wrapper for consistent expandable section.
 */

import React, { useState } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { List, Text, Button, Snackbar, Divider } from 'react-native-paper';
import { colors, spacing, typography, borderRadius } from '../../../theme/tokens';

const POWERBI_URL = process.env.EXPO_PUBLIC_POWERBI_URL;
const isConfigured = Boolean(POWERBI_URL && POWERBI_URL.length > 0);

export function SettingsPowerBI() {
  const [expanded, setExpanded] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const handleOpenPowerBI = async () => {
    if (!POWERBI_URL) return;

    try {
      const supported = await Linking.canOpenURL(POWERBI_URL);
      if (supported) {
        await Linking.openURL(POWERBI_URL);
      } else {
        setSnackbarMessage('No se puede abrir el enlace en este dispositivo');
        setSnackbarVisible(true);
      }
    } catch {
      setSnackbarMessage('Error al intentar abrir el dashboard de Power BI');
      setSnackbarVisible(true);
    }
  };

  return (
    <>
      <List.Accordion
        title="Power BI"
        titleStyle={styles.accordionTitle}
        left={(props) => <List.Icon {...props} icon="chart-box" color={colors.primary} />}
        expanded={expanded}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.content}>
          <Text variant="bodySmall" style={styles.description}>
            Acceda al dashboard de reportes y visualizaciones en Power BI.
          </Text>

          <Divider style={styles.divider} />

          <Button
            mode="contained"
            icon="chart-box"
            style={styles.button}
            contentStyle={styles.buttonContent}
            onPress={handleOpenPowerBI}
            disabled={!isConfigured}
          >
            Abrir Power BI
          </Button>

          {!isConfigured && (
            <Text variant="bodySmall" style={styles.helperText}>
              Power BI no está configurado. Contacte al administrador para configurar la URL
              en la variable de entorno EXPO_PUBLIC_POWERBI_URL.
            </Text>
          )}
        </View>
      </List.Accordion>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={4000}
        action={{
          label: 'Cerrar',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  accordionTitle: {
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  description: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  divider: {
    marginVertical: spacing.sm,
  },
  button: {
    borderRadius: borderRadius.sm,
  },
  buttonContent: {
    minHeight: 48,
  },
  helperText: {
    color: colors.textWarning,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
});
