/**
 * WeightInput — SmartNumpad wrapper with weight validation against product standards.
 *
 * Pattern: Atomic Design — Molecule
 * Why:
 * - Post-reconciliation: uses findBySku (natural key) instead of findByProduct.
 * - Shows weight standard range and validation.
 *
 * Touch targets ≥56 dp for industrial tablet with gloves.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, spacing, typography, borderRadius } from '../../theme/tokens';
import { SmartNumpad } from '../atoms/SmartNumpad';
import { useProductWeightStandardsRepository } from '../../../repositories/useProductWeightStandardsRepository';

interface WeightInputProps {
  visible: boolean;
  sku: string;
  onDismiss: () => void;
  onValidated: (result: { value: number; valid: boolean; message?: string }) => void;
  testID?: string;
}

export function WeightInput({
  visible,
  sku,
  onDismiss,
  onValidated,
  testID,
}: WeightInputProps) {
  const standardsRepo = useProductWeightStandardsRepository();
  const [standard, setStandard] = useState<{
    lower_limit: number;
    upper_limit: number;
  } | null>(null);

  // Load weight standard when modal opens
  useEffect(() => {
    if (visible && sku) {
      standardsRepo.findBySku(sku).then((s) => {
        if (s) {
          setStandard({ lower_limit: s.lower_limit, upper_limit: s.upper_limit });
        } else {
          setStandard(null);
        }
      });
    }
  }, [visible, sku, standardsRepo]);

  const handleConfirm = async (value: number) => {
    const result = await standardsRepo.validateWeight(sku, value);
    onValidated({ value, ...result });
  };

  return (
    <View testID={testID ?? 'weight-input'}>
      {/* Standard range header — shown when available */}
      {visible && standard && (
        <View style={styles.header}>
          <Text style={styles.headerText}>
            Rango válido: {standard.lower_limit}g – {standard.upper_limit}g
          </Text>
        </View>
      )}

      {visible && !standard && (
        <View style={styles.header}>
          <Text style={styles.headerWarning}>
            Sin estándar de peso configurado
          </Text>
        </View>
      )}

      <SmartNumpad
        visible={visible}
        title="Registrar Peso"
        onDismiss={onDismiss}
        onConfirm={handleConfirm}
        min={1}
        max={99999}
        precision={0}
        unit=" g"
        label="peso"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  headerText: {
    fontSize: typography.sizes.bodyMedium,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  headerWarning: {
    fontSize: typography.sizes.bodySmall,
    color: colors.caution,
    fontStyle: 'italic',
  },
});
