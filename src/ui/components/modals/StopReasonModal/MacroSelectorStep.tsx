/**
 * MacroSelectorStep — Step 1 of StopReasonModal: select macro category.
 *
 * Displays three large buttons for PROD, MTTO, OTROS categories.
 * Touch targets ≥56 dp for industrial tablet use.
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Dialog, Text } from 'react-native-paper';
import type { ParoMacro } from '../../../../config/catalogs';
import { colors, spacing, typography, borderRadius, touchTarget } from '../../../theme/tokens';

interface MacroSelectorStepProps {
  onSelectMacro: (macro: ParoMacro) => void;
  onDismiss: () => void;
  testID?: string;
}

export const MACRO_CONFIG: { key: ParoMacro; label: string; icon: string; color: string }[] = [
  { key: 'PROD', label: 'Producción', icon: 'factory', color: colors.error },
  { key: 'MTTO', label: 'Mantenimiento', icon: 'wrench', color: colors.caution },
  { key: 'OTROS', label: 'Otros', icon: 'clipboard-text', color: '#7B1FA2' },
];

export function MacroSelectorStep({ onSelectMacro, onDismiss, testID }: MacroSelectorStepProps) {
  return (
    <View testID={testID}>
      <Dialog.Title style={styles.title}>Categoría de Paro</Dialog.Title>
      <Dialog.Content>
        <ScrollView>
          <View style={styles.macroContainer}>
            {MACRO_CONFIG.map((macro) => (
              <Button
                key={macro.key}
                mode="contained"
                onPress={() => onSelectMacro(macro.key)}
                style={styles.macroButton}
                contentStyle={styles.macroButtonContent}
                labelStyle={styles.macroButtonLabel}
                icon={macro.icon}
                buttonColor={macro.color}
                testID={testID ? `${testID}-${macro.key}` : undefined}
              >
                {macro.label}
              </Button>
            ))}
          </View>
        </ScrollView>
      </Dialog.Content>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
  },
  macroContainer: {
    gap: spacing.sm,
  },
  macroButton: {
    marginBottom: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  macroButtonContent: {
    minHeight: touchTarget.largeHeight,
  },
  macroButtonLabel: {
    fontSize: typography.sizes.titleMedium,
    fontWeight: typography.weights.semibold,
  },
});
