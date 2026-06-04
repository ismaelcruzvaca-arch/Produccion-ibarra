/**
 * Shift Setup Screen — Configures a new shift session.
 *
 * Uses useShiftSetupOrchestration for form state and save logic.
 * Renders ShiftSetupForm with shift_type selector, planned_boxes, product_code.
 * On success: navigates back to shifts list.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { useShiftSetupOrchestration } from '../../../src/ui/hooks/useShiftSetupOrchestration';
import { ShiftSetupForm } from '../../../src/ui/components/molecules/ShiftSetupForm';
import { colors, spacing } from '../../../src/ui/theme/tokens';

export default function ShiftSetupScreen() {
  const router = useRouter();
  const orchestration = useShiftSetupOrchestration();

  const prevSaving = useRef(orchestration.saving);

  // Navigate back on successful save
  useEffect(() => {
    if (prevSaving.current && !orchestration.saving && !orchestration.error) {
      // Save completed successfully (was saving, now not saving, no error)
      router.back();
    }
    prevSaving.current = orchestration.saving;
  }, [orchestration.saving, orchestration.error, router]);

  return (
    <View style={styles.container}>
      <ShiftSetupForm
        operators={orchestration.operators}
        operatorId={orchestration.operatorId}
        setOperator={orchestration.setOperator}
        shiftType={orchestration.shiftType}
        setShiftType={orchestration.setShiftType}
        plannedBoxes={orchestration.plannedBoxes}
        setPlannedBoxes={orchestration.setPlannedBoxes}
        productCode={orchestration.productCode}
        setProductCode={orchestration.setProductCode}
        save={orchestration.save}
        isValid={orchestration.isValid}
        error={orchestration.error}
        saving={orchestration.saving}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGray,
    padding: spacing.md,
  },
});
