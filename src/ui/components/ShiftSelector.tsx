/**
 * ShiftSelector — compact chip selector for shifts.
 *
 * Rules:
 * - Shows selected shift or time-based default from getCurrentTurno()
 * - Modal lists active shifts ordered by start_hour
 * - On select: stores override
 * - On clear: restores time-based default
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Portal, Dialog } from 'react-native-paper';

import { getCurrentTurno } from '../../config/catalogs';

interface Shift {
  id: string;
  label: string;
  start_hour: number;
  end_hour: number;
}

interface ShiftSelectorProps {
  shifts: Shift[];
  selectedShiftId: string | null;
  onSelectShift: (shiftId: string | null) => void;
  disabled?: boolean;
}

export function ShiftSelector({
  shifts,
  selectedShiftId,
  onSelectShift,
  disabled,
}: ShiftSelectorProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const defaultShift = getCurrentTurno();
  const effectiveShiftId = selectedShiftId ?? defaultShift.id;
  const selectedShift = shifts.find((s) => s.id === effectiveShiftId);

  // If no override is set, default to time-based turno
  useEffect(() => {
    if (!selectedShiftId) {
      const turno = getCurrentTurno();
      onSelectShift(turno.id);
    }
  }, [selectedShiftId, onSelectShift]);

  const handlePress = () => {
    if (disabled) return;
    setModalVisible(true);
  };

  const handleSelect = (id: string) => {
    setModalVisible(false);
    onSelectShift(id);
  };

  const handleClear = () => {
    setModalVisible(false);
    onSelectShift(null); // null triggers fallback to time-based default
  };

  const label = selectedShift?.label ?? 'Seleccione turno';

  return (
    <View style={styles.container}>
      <Button
        mode="outlined"
        onPress={handlePress}
        disabled={disabled}
        style={styles.chip}
        contentStyle={styles.chipContent}
        labelStyle={styles.chipLabel}
        icon="clock-outline"
        accessibilityLabel={`Turno seleccionado: ${label}`}
        accessibilityRole="button"
      >
        {label}
      </Button>

      <Portal>
        <Dialog visible={modalVisible} onDismiss={() => setModalVisible(false)}>
          <Dialog.Title>Seleccione Turno</Dialog.Title>
          <Dialog.Content>
            {shifts.map((shift) => (
              <Button
                key={shift.id}
                mode={effectiveShiftId === shift.id ? 'contained' : 'outlined'}
                onPress={() => handleSelect(shift.id)}
                style={styles.optionButton}
                contentStyle={styles.optionButtonContent}
              >
                {shift.label}
              </Button>
            ))}
            <Button
              mode="text"
              onPress={handleClear}
              style={styles.clearButton}
              contentStyle={styles.clearButtonContent}
            >
              Restablecer (automático)
            </Button>
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
  clearButton: {
    marginTop: 8,
  },
  clearButtonContent: {
    minHeight: 48,
  },
});
