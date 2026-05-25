/**
 * CardActionButton — Reusable card with title, subtitle, and action button.
 *
 * Used by NormalOperationState to eliminate duplicated card patterns.
 * Preserves exact original rendering: Text variant="titleLarge" + "bodyMedium".
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, Button, Text } from 'react-native-paper';

interface CardActionButtonProps {
  title: string;
  subtitle: string;
  buttonLabel: string;
  icon: string;
  onPress: () => void;
  buttonColor?: string;
}

export function CardActionButton({
  title,
  subtitle,
  buttonLabel,
  icon,
  onPress,
  buttonColor,
}: CardActionButtonProps) {
  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleLarge" style={styles.title}>
          {title}
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {subtitle}
        </Text>
      </Card.Content>
      <Card.Actions style={styles.actions}>
        <Button
          mode="contained"
          onPress={onPress}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          icon={icon}
          buttonColor={buttonColor}
        >
          {buttonLabel}
        </Button>
      </Card.Actions>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12, backgroundColor: '#FFFFFF' },
  title: { fontWeight: 'bold', color: '#5D4037', marginBottom: 4 },
  subtitle: { color: '#757575' },
  actions: { justifyContent: 'flex-start', paddingHorizontal: 16, paddingBottom: 12 },
  button: { flex: 1, borderRadius: 8 },
  buttonContent: { minHeight: 56 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});
