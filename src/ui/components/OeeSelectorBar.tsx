/**
 * OeeSelectorBar — container wiring catalog/auth stores to selector components.
 *
 * Responsibilities:
 * - Reads authStore (assignedLines) and catalogStore (lines, machines, shifts, selections)
 * - Renders LineSelector + MachineSelector + ShiftSelector in a compact row
 * - Responsive: stacks vertically on narrow screens, flows horizontally on wide
 * - Delegates selection changes back to the stores
 */

import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';

import { useAuthStore } from '../../auth/useAuthStore';
import { useCatalogStore } from '../store/catalogStore';
import { LineSelector } from './LineSelector';
import { MachineSelector } from './MachineSelector';
import { ShiftSelector } from './ShiftSelector';

interface OeeSelectorBarProps {
  onLineChangeAttempt?: () => boolean; // return false to block change
  disabled?: boolean;
}

export function OeeSelectorBar({ onLineChangeAttempt, disabled }: OeeSelectorBarProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 600;

  // Auth store
  const assignedLines = useAuthStore((s) => s.assignedLines);

  // Catalog store — selectors
  const lines = useCatalogStore((s) => s.getLines());
  const machines = useCatalogStore((s) => s.getMachines());
  const shifts = useCatalogStore((s) => s.getShifts());
  const selectedLine = useCatalogStore((s) => s.selectedLine);
  const selectedMachine = useCatalogStore((s) => s.selectedMachine);
  const selectedShift = useCatalogStore((s) => s.selectedShift);

  // Auth store — actions
  const setAuthSelectedLine = useAuthStore((s) => s.setSelectedLine);

  // Catalog store — actions
  const setSelectedLine = useCatalogStore((s) => s.setSelectedLine);
  const setSelectedMachine = useCatalogStore((s) => s.setSelectedMachine);
  const setSelectedShift = useCatalogStore((s) => s.setSelectedShift);

  // Derive machines for selected line
  const machinesForLine = selectedLine
    ? machines.filter((m) => m.line_id === selectedLine)
    : [];

  const handleSelectLine = (lineId: string) => {
    if (onLineChangeAttempt && !onLineChangeAttempt()) {
      return;
    }
    setAuthSelectedLine(lineId);
    setSelectedLine(lineId);
  };

  return (
    <View style={[styles.container, isWide ? styles.row : styles.column]}>
      <LineSelector
        lines={lines}
        assignedLines={assignedLines}
        selectedLineId={selectedLine}
        onSelectLine={handleSelectLine}
        disabled={disabled}
      />
      <MachineSelector
        machines={machinesForLine}
        selectedMachineId={selectedMachine}
        onSelectMachine={setSelectedMachine}
        disabled={disabled || !selectedLine}
      />
      <ShiftSelector
        shifts={shifts}
        selectedShiftId={selectedShift}
        onSelectShift={setSelectedShift}
        disabled={disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    maxHeight: 160,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  column: {
    flexDirection: 'column',
  },
});
