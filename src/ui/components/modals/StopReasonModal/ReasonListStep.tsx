/**
 * ReasonListStep — Step 2 of StopReasonModal: select specific reason from catalog.
 *
 * Shows all reasons for the selected macro category with a back button.
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Dialog, Text } from 'react-native-paper';
import type { ParoReason } from '../../../../config/catalogs';
import { colors, spacing, typography, borderRadius, touchTarget } from '../../../theme/tokens';

interface ReasonListStepProps {
  macroLabel: string;
  reasons: ParoReason[];
  onSelectReason: (reason: ParoReason) => void;
  onBack: () => void;
  testID?: string;
}

export function ReasonListStep({
  macroLabel,
  reasons,
  onSelectReason,
  onBack,
  testID,
}: ReasonListStepProps) {
  return (
    <View testID={testID}>
      <Dialog.Title style={styles.title}>Seleccione Motivo — {macroLabel}</Dialog.Title>
      <Dialog.Content>
        <ScrollView style={styles.reasonsList}>
          {reasons.map((reason) => (
            <View key={reason.code} style={styles.reasonRow}>
              <Button
                mode="outlined"
                onPress={() => onSelectReason(reason)}
                style={styles.reasonButton}
                contentStyle={styles.reasonButtonContent}
                labelStyle={styles.reasonButtonLabel}
                testID={testID ? `${testID}-${reason.code}` : undefined}
              >
                {reason.code} — {reason.label}
              </Button>
            </View>
          ))}
          <Button
            mode="text"
            onPress={onBack}
            style={styles.backButton}
            contentStyle={styles.backButtonContent}
            labelStyle={styles.backButtonLabel}
            icon="arrow-left"
          >
            Volver a categorías
          </Button>
        </ScrollView>
      </Dialog.Content>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
  },
  reasonsList: {
    maxHeight: 400,
  },
  reasonRow: {
    marginBottom: spacing.xs,
  },
  reasonButton: {
    borderRadius: borderRadius.sm,
  },
  reasonButtonContent: {
    minHeight: touchTarget.minHeight,
    justifyContent: 'flex-start',
  },
  reasonButtonLabel: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.medium,
  },
  backButton: {
    marginTop: spacing.xs,
  },
  backButtonContent: {
    minHeight: 48,
  },
  backButtonLabel: {
    fontSize: typography.sizes.bodyMedium,
  },
});
