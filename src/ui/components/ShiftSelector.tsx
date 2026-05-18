import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Menu, Button } from 'react-native-paper';
import { useCatalogStore } from '../store/catalogStore';

export function ShiftSelector() {
  const shifts = useCatalogStore((state) => state.shifts);
  const selectedShift = useCatalogStore((state) => state.selectedShift);
  const setSelectedShift = useCatalogStore((state) => state.setSelectedShift);

  const [visible, setVisible] = useState(false);

  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);

  const activeShifts = shifts.filter((s) => s.is_active);
  const selectedObj = activeShifts.find((s) => s.id === selectedShift);
  const label = selectedObj ? selectedObj.label : 'Seleccionar Turno...';

  return (
    <View style={styles.container}>
      <Menu
        visible={visible}
        onDismiss={closeMenu}
        anchor={<Button mode="outlined" onPress={openMenu}>{label}</Button>}
      >
        {activeShifts.map((shift) => (
          <Menu.Item
            key={shift.id}
            onPress={() => {
              setSelectedShift(shift.id);
              closeMenu();
            }}
            title={shift.label}
          />
        ))}
      </Menu>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 8, flex: 1 },
});
