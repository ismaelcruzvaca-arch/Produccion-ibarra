/**
 * LineSelector — compact chip selector for production lines.
 *
 * Rules:
 * - 0 assigned lines → disabled with warning text
 * - 1 assigned line → auto-select without modal
 * - 2+ lines → modal on tap
 * - Changing line resets machine selection (handled by catalogStore cascade)
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Portal, Dialog, Text } from 'react-native-paper';

interface LineSelectorProps {
  lines: { id: string; name: string }[];
  assignedLines: string[];
  selectedLineId: string | null;
  onSelectLine: (lineId: string) => void;
  disabled?: boolean;
}

export function LineSelector({
  lines,
  assignedLines,
  selectedLineId,
  onSelectLine,
  disabled,
}: LineSelectorProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const assignedLineObjects = lines.filter((l) => assignedLines.includes(l.id));
  const selectedLine = lines.find((l) => l.id === selectedLineId);

  // Auto-select if exactly one assigned line and none selected
  useEffect(() => {
    if (assignedLineObjects.length === 1 && !selectedLineId) {
      onSelectLine(assignedLineObjects[0].id);
    }
  }, [assignedLineObjects.length, selectedLineId, onSelectLine]);

  const handlePress = () => {
    if (disabled || assignedLineObjects.length === 0) return;
    if (assignedLineObjects.length === 1) {
      // Already auto-selected; tapping does nothing
      return;
    }
    setModalVisible(true);
  };

  const handleSelect = (id: string) => {
    setModalVisible(false);
    onSelectLine(id);
  };

  const label = selectedLine?.name ?? 'Seleccione línea';
  const hasNoLines = assignedLines.length === 0;
  const isDisabled = disabled || hasNoLines || assignedLineObjects.length <= 1;

  return (
    <View style={styles.container}>
      <Button
        mode="outlined"
        onPress={handlePress}
        disabled={isDisabled}
        style={styles.chip}
        contentStyle={styles.chipContent}
        labelStyle={styles.chipLabel}
        icon="factory"
        accessibilityLabel={`Línea seleccionada: ${label}`}
        accessibilityRole="button"
      >
        {hasNoLines ? 'No tiene líneas asignadas' : label}
      </Button>

      <Portal>
        <Dialog visible={modalVisible} onDismiss={() => setModalVisible(false)}>
          <Dialog.Title>Seleccione Línea</Dialog.Title>
          <Dialog.Content>
            {assignedLineObjects.map((line) => (
              <Button
                key={line.id}
                mode={selectedLineId === line.id ? 'contained' : 'outlined'}
                onPress={() => handleSelect(line.id)}
                style={styles.optionButton}
                contentStyle={styles.optionButtonContent}
              >
                {line.name}
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
