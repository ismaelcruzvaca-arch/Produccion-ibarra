import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Menu, Button } from 'react-native-paper';
import { useCatalogStore } from '../store/catalogStore';

export function MachineSelector() {
  const machines = useCatalogStore((state) => state.machines);
  const selectedLine = useCatalogStore((state) => state.selectedLine);
  const selectedMachine = useCatalogStore((state) => state.selectedMachine);
  const setSelectedMachine = useCatalogStore((state) => state.setSelectedMachine);

  const [visible, setVisible] = useState(false);

  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);

  const filteredMachines = machines.filter((m) => m.is_active && m.line_id === selectedLine);
  const selectedObj = filteredMachines.find((m) => m.id === selectedMachine);
  const label = selectedObj ? selectedObj.name : 'Seleccionar Máquina...';

  return (
    <View style={styles.container}>
      <Menu
        visible={visible}
        onDismiss={closeMenu}
        anchor={<Button mode="outlined" onPress={openMenu} disabled={!selectedLine}>{label}</Button>}
      >
        {filteredMachines.map((machine) => (
          <Menu.Item
            key={machine.id}
            onPress={() => {
              setSelectedMachine(machine.id);
              closeMenu();
            }}
            title={machine.name}
          />
        ))}
      </Menu>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 8, flex: 1 },
});
