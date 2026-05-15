/**
 * MachineSelector — compact chip selector for machines.
 *
 * Rules:
 * - No line selected → disabled "Seleccione línea primero"
 * - 0 machines for line → disabled "Sin máquinas en esta línea"
 * - 1 machine → auto-select without modal
 * - 2+ machines → modal on tap
 * - On select: persists to store (AsyncStorage via Zustand persist)
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Portal, Dialog } from 'react-native-paper';

interface MachineSelectorProps {
  machines: { id: string; name: string }[];
  selectedMachineId: string | null;
  onSelectMachine: (machineId: string) => void;
  disabled?: boolean;
}

export function MachineSelector({
  machines,
  selectedMachineId,
  onSelectMachine,
  disabled,
}: MachineSelectorProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const selectedMachine = machines.find((m) => m.id === selectedMachineId);

  // Auto-select if exactly one machine and none selected
  useEffect(() => {
    if (machines.length === 1 && !selectedMachineId) {
      onSelectMachine(machines[0].id);
    }
  }, [machines.length, selectedMachineId, onSelectMachine]);

  const handlePress = () => {
    if (disabled || machines.length === 0) return;
    if (machines.length === 1) {
      // Already auto-selected
      return;
    }
    setModalVisible(true);
  };

  const handleSelect = (id: string) => {
    setModalVisible(false);
    onSelectMachine(id);
  };

  let label = selectedMachine?.name ?? 'Seleccione máquina';
  let isDisabled = disabled;

  if (disabled) {
    label = 'Seleccione línea primero';
  } else if (machines.length === 0) {
    label = 'Sin máquinas en esta línea';
    isDisabled = true;
  }

  return (
    <View style={styles.container}>
      <Button
        mode="outlined"
        onPress={handlePress}
        disabled={isDisabled}
        style={styles.chip}
        contentStyle={styles.chipContent}
        labelStyle={styles.chipLabel}
        icon="cog"
        accessibilityLabel={`Máquina seleccionada: ${label}`}
        accessibilityRole="button"
      >
        {label}
      </Button>

      <Portal>
        <Dialog visible={modalVisible} onDismiss={() => setModalVisible(false)}>
          <Dialog.Title>Seleccione Máquina</Dialog.Title>
          <Dialog.Content>
            {machines.map((machine) => (
              <Button
                key={machine.id}
                mode={selectedMachineId === machine.id ? 'contained' : 'outlined'}
                onPress={() => handleSelect(machine.id)}
                style={styles.optionButton}
                contentStyle={styles.optionButtonContent}
              >
                {machine.name}
              </Button>
            ))}
          </Dialog.Content>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 160,
    marginHorizontal: 4,
  },
  chip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  chipContent: {
    minHeight: 56,
    justifyContent: 'flex-start',
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  optionButton: {
    marginVertical: 4,
    borderRadius: 8,
  },
  optionButtonContent: {
    minHeight: 56,
    justifyContent: 'flex-start',
  },
});
