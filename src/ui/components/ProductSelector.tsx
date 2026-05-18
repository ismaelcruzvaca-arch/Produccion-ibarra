/**
 * ProductSelector — Dropdown for selecting the active product/SKU.
 *
 * Wave 8: Allows operators to declare what product they are running so that
 * OEE Rendimiento uses the real theoretical_ppm instead of the DEFAULT_PPM fallback.
 *
 * Design decision: selectedProduct is NOT persisted in AsyncStorage.
 * Operators must select a product each session to prevent PPM drift after changeovers.
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Menu, Button } from 'react-native-paper';
import { useCatalogStore } from '../store/catalogStore';

export function ProductSelector() {
  const products = useCatalogStore((state) => state.products);
  const selectedProduct = useCatalogStore((state) => state.selectedProduct);
  const setSelectedProduct = useCatalogStore((state) => state.setSelectedProduct);

  const [visible, setVisible] = useState(false);

  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);

  const activeProducts = products.filter((p) => p.is_active);
  const selectedObj = activeProducts.find((p) => p.id === selectedProduct);
  const label = selectedObj ? `${selectedObj.code}` : 'Producto...';

  return (
    <View style={styles.container}>
      <Menu
        visible={visible}
        onDismiss={closeMenu}
        anchor={
          <Button
            mode="outlined"
            onPress={openMenu}
            testID="product-selector-button"
          >
            {label}
          </Button>
        }
      >
        {/* First item: deselect / fallback PPM */}
        <Menu.Item
          key="none"
          testID="product-selector-item-none"
          onPress={() => {
            setSelectedProduct(null);
            closeMenu();
          }}
          title="Sin producto"
        />
        {activeProducts.map((product) => (
          <Menu.Item
            key={product.id}
            testID={`product-selector-item-${product.id}`}
            onPress={() => {
              setSelectedProduct(product.id);
              closeMenu();
            }}
            title={`${product.code} · ${product.name}`}
          />
        ))}
      </Menu>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 8, flex: 1 },
});
