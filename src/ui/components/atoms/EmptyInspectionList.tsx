/**
 * EmptyInspectionList — empty state placeholder for when no inspections exist (QC-12).
 *
 * Spec compliance:
 * - QC-12: SHALL empty state CTA when no inspections
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';

interface EmptyInspectionListProps {
  /** Message to display when there are no inspections. */
  message?: string;
  /** Label for the call-to-action button. */
  ctaLabel?: string;
  /** Callback when the CTA button is pressed. */
  onCtaPress?: () => void;
  /** Whether to show the CTA button. Only shown if onCtaPress is provided. */
  showCta?: boolean;
}

export function EmptyInspectionList({
  message = 'No hay inspecciones de calidad registradas',
  ctaLabel = 'Nueva Inspección',
  onCtaPress,
  showCta = false,
}: EmptyInspectionListProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>📋</Text>
      <Text variant="titleMedium" style={styles.message}>
        {message}
      </Text>
      {showCta && onCtaPress && (
        <Button
          mode="contained"
          onPress={onCtaPress}
          icon="plus"
          style={styles.cta}
          contentStyle={styles.ctaContent}
        >
          {ctaLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 200,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  message: {
    textAlign: 'center',
    opacity: 0.6,
    marginBottom: 16,
  },
  cta: {
    marginTop: 8,
  },
  ctaContent: {
    paddingHorizontal: 24,
  },
});
