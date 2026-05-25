/**
 * DefectSelector — DEPRECATED.
 *
 * Post-reconciliation: defect_type is free-text entered inline in the capture form.
 * This component previously used IQualityDefect catalog, which no longer exists.
 * Kept as a no-op stub to avoid breaking imports — will be removed in future cleanup.
 *
 * @deprecated Use inline defect entry in QualityCaptureScreen instead.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, spacing } from '../../theme/tokens';

interface DefectSelectorProps {
  visible: boolean;
  defects?: unknown[];
  selected?: string | null;
  onSelect?: (value: string) => void;
  onDismiss?: () => void;
  variant?: 'overlay' | 'inline';
  testID?: string;
}

export function DefectSelector({
  visible,
  testID,
}: DefectSelectorProps) {
  if (!visible) return null;

  return (
    <View style={styles.container} testID={testID ?? 'defect-selector-deprecated'}>
      <Text style={styles.text}>
        DefectSelector está deprecado. Use entrada de texto libre en el formulario.
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
