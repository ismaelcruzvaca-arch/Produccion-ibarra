/**
 * Stop Reason Modal — two-step selection for downtime reasons.
 *
 * Step 1: Select macro category (PROD, MTTO, OTROS)
 * Step 2: Select specific reason from catalog
 *
 * All data imported from src/config/catalogs.ts — no hardcoded values.
 * Touch targets ≥56 dp for industrial tablet use.
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Portal, Dialog, Button, Text } from 'react-native-paper';

import type { ParoReason, ParoMacro } from '../../config/catalogs';
import { PARO_BY_MACRO } from '../../config/catalogs';

interface StopReasonModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSelectReason: (reason: ParoReason) => void;
}

const MACRO_CONFIG: { key: ParoMacro; label: string; icon: string; color: string }[] = [
  { key: 'PROD', label: 'Producción', icon: 'factory', color: '#D32F2F' },
  { key: 'MTTO', label: 'Mantenimiento', icon: 'wrench', color: '#F57C00' },
  { key: 'OTROS', label: 'Otros', icon: 'clipboard-text', color: '#7B1FA2' },
];

export function StopReasonModal({ visible, onDismiss, onSelectReason }: StopReasonModalProps) {
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

  const reasons = selectedMacro ? PARO_BY_MACRO[selectedMacro] ?? [] : [];

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleDismiss} style={styles.dialog}>
        <Dialog.Title>
          {selectedMacro ? 'Seleccione Motivo' : 'Categoría de Paro'}
        </Dialog.Title>
        <Dialog.Content>
          {!selectedMacro ? (
            <View style={styles.macroContainer}>
              {MACRO_CONFIG.map((macro) => (
                <Button
                  key={macro.key}
                  mode="contained"
                  onPress={() => handleSelectMacro(macro.key)}
                  style={styles.macroButton}
                  contentStyle={styles.macroButtonContent}
                  labelStyle={styles.macroButtonLabel}
                  icon={macro.icon}
                  buttonColor={macro.color}
                >
                  {macro.label}
                </Button>
              ))}
            </View>
          ) : (
            <ScrollView style={styles.reasonsList}>
              {reasons.map((reason) => (
                <View key={reason.code} style={styles.reasonRow}>
                  <Button
                    mode="outlined"
                    onPress={() => handleSelectReason(reason)}
                    style={styles.reasonButton}
                    contentStyle={styles.reasonButtonContent}
                    labelStyle={styles.reasonButtonLabel}
                  >
                    {reason.code} — {reason.label}
                  </Button>
                </View>
              ))}
              <Button
                mode="text"
                onPress={() => setSelectedMacro(null)}
                style={styles.backButton}
                contentStyle={styles.backButtonContent}
              >
                ← Volver a categorías
              </Button>
            </ScrollView>
          )}
        </Dialog.Content>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '80%',
  },
  macroContainer: {
    gap: 12,
  },
  macroButton: {
    marginBottom: 12,
    borderRadius: 8,
  },
  macroButtonContent: {
    minHeight: 64,
  },
  macroButtonLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  reasonsList: {
    maxHeight: 400,
  },
  reasonRow: {
    marginBottom: 8,
  },
  reasonButton: {
    borderRadius: 8,
  },
  reasonButtonContent: {
    minHeight: 56,
    justifyContent: 'flex-start',
  },
  reasonButtonLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  backButton: {
    marginTop: 8,
  },
  backButtonContent: {
    minHeight: 48,
  },
});
