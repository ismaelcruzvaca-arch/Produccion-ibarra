/**
 * StopReasonModal — Two-step selection for downtime reasons.
 *
 * Step 1: Select macro category (PROD, MTTO, OTROS)
 * Step 2: Select specific reason from catalog
 *
 * Composes MacroSelectorStep + ReasonListStep.
 * All data imported from src/config/catalogs.ts — no hardcoded values.
 * Touch targets ≥56 dp for industrial tablet use.
 */

import React, { useState } from 'react';
import { Portal, Dialog } from 'react-native-paper';
import { StyleSheet } from 'react-native';

import type { ParoReason, ParoMacro } from '../../../../config/catalogs';
import { PARO_BY_MACRO } from '../../../../config/catalogs';
import { MacroSelectorStep, MACRO_CONFIG } from './MacroSelectorStep';
import { ReasonListStep } from './ReasonListStep';

interface StopReasonModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSelectReason: (reason: ParoReason) => void;
  testID?: string;
}

export { MacroSelectorStep } from './MacroSelectorStep';
export { ReasonListStep } from './ReasonListStep';

export function StopReasonModal({ visible, onDismiss, onSelectReason, testID }: StopReasonModalProps) {
  const [selectedMacro, setSelectedMacro] = useState<ParoMacro | null>(null);

  const handleSelectMacro = (macro: ParoMacro) => {
    setSelectedMacro(macro);
  };

  const handleSelectReason = (reason: ParoReason) => {
    setSelectedMacro(null);
    onSelectReason(reason);
  };

  const handleDismiss = () => {
    setSelectedMacro(null);
    onDismiss();
  };

  const handleBack = () => {
    setSelectedMacro(null);
  };

  const reasons = selectedMacro ? PARO_BY_MACRO[selectedMacro] ?? [] : [];
  const macroLabel = selectedMacro
    ? MACRO_CONFIG.find((m) => m.key === selectedMacro)?.label ?? selectedMacro
    : '';

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleDismiss} style={styles.dialog} testID={testID}>
        {!selectedMacro ? (
          <MacroSelectorStep
            onSelectMacro={handleSelectMacro}
            onDismiss={handleDismiss}
            testID={testID ? `${testID}-macro` : undefined}
          />
        ) : (
          <ReasonListStep
            macroLabel={macroLabel}
            reasons={reasons}
            onSelectReason={handleSelectReason}
            onBack={handleBack}
            testID={testID ? `${testID}-reasons` : undefined}
          />
        )}
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '80%',
  },
});
