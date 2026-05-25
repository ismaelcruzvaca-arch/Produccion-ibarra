/**
 * InspectionTypeSelector — DEPRECATED.
 *
 * Post-reconciliation: inspection_type is removed from IQualityInspection.
 * The capture flow now uses disposition (liberado/rechazado/reproceso) directly.
 * Kept as a no-op stub to avoid breaking imports — will be removed in future cleanup.
 *
 * @deprecated Use disposition selector in QualityCaptureScreen instead.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, spacing } from '../../theme/tokens';

interface InspectionTypeSelectorProps {
  selected?: string | null;
  onSelect?: (value: string) => void;
  testID?: string;
}

export function InspectionTypeSelector({
  testID,
}: InspectionTypeSelectorProps) {
  return (
    <View style={styles.container} testID={testID ?? 'inspection-type-selector-deprecated'}>
      <Text style={styles.text}>
        InspectionTypeSelector está deprecado.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.bgGray,
    borderRadius: 8,
  },
  text: {
    color: colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
});
