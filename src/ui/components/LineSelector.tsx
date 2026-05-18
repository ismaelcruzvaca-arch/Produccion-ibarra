import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Menu, Button } from 'react-native-paper';
import { useCatalogStore } from '../store/catalogStore';

export function LineSelector() {
  const lines = useCatalogStore((state) => state.lines);
  const selectedLine = useCatalogStore((state) => state.selectedLine);
  const setSelectedLine = useCatalogStore((state) => state.setSelectedLine);

  const [visible, setVisible] = useState(false);

  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);

  const selectedObj = lines.find((l) => l.id === selectedLine);
  const label = selectedObj ? selectedObj.name : 'Seleccionar Línea...';

  return (
    <View style={styles.container}>
      <Menu
        visible={visible}
        onDismiss={closeMenu}
        anchor={<Button mode="outlined" onPress={openMenu}>{label}</Button>}
      >
        {lines.filter((l) => l.is_active).map((line) => (
          <Menu.Item
            key={line.id}
            onPress={() => {
              setSelectedLine(line.id);
              closeMenu();
            }}
            title={line.name}
          />
        ))}
      </Menu>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 8, flex: 1 },
});
