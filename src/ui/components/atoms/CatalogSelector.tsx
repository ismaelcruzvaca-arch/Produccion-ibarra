/**
 * CatalogSelector — Generic dropdown selector for catalog data (lines, machines, shifts, products).
 *
 * Pattern: Atomic Design — Generic Molecule / Factory (AD-3)
 * Why:
 * - Replaces 4 duplicated selectors (LineSelector, MachineSelector, ShiftSelector, ProductSelector)
 *   with a single generic component.
 * - New selectors (operator, defect) become one-liners.
 *
 * Usage:
 *   <CatalogSelector<ICatalogLine>
 *     data={lines}
 *     selected={selectedLine}
 *     onSelect={setSelectedLine}
 *     labelExtractor={(l) => l.name}
 *     placeholder="Seleccionar Línea..."
 *     testID="line-selector"
 *   />
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Menu, Button } from 'react-native-paper';
import { colors, spacing, typography, borderRadius } from '../../theme/tokens';

interface CatalogSelectorProps<T extends { id: string }> {
  /** Array of items to display */
  data: T[];
  /** Currently selected item ID */
  selected: string | null;
  /** Called when an item is selected */
  onSelect: (id: string | null) => void;
  /** Extracts display label from an item */
  labelExtractor: (item: T) => string;
  /** Placeholder text when nothing is selected */
  placeholder?: string;
  /** Optional filter function */
  filterFn?: (item: T) => boolean;
  /** Whether selection can be cleared */
  allowDeselect?: boolean;
  /** Disable the selector */
  disabled?: boolean;
  /** Test ID prefix */
  testID?: string;
}

export function CatalogSelector<T extends { id: string }>({
  data,
  selected,
  onSelect,
  labelExtractor,
  placeholder = 'Seleccionar...',
  filterFn,
  allowDeselect = false,
  disabled = false,
  testID,
}: CatalogSelectorProps<T>) {
  const [visible, setVisible] = useState(false);

  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);

  const filtered = filterFn ? data.filter(filterFn) : data;
  const selectedItem = data.find((item) => item.id === selected);
  const label = selectedItem ? labelExtractor(selectedItem) : placeholder;

  return (
    <View style={styles.container}>
      <Menu
        visible={visible}
        onDismiss={closeMenu}
        anchor={
          <Button
            mode="outlined"
            onPress={openMenu}
            disabled={disabled}
            testID={testID}
            style={styles.button}
            labelStyle={styles.buttonLabel}
            contentStyle={styles.buttonContent}
          >
            {label}
          </Button>
        }
      >
        {allowDeselect && (
          <Menu.Item
            key="none"
            onPress={() => {
              onSelect(null);
              closeMenu();
            }}
            title="Sin selección"
            titleStyle={styles.deselectItem}
            testID={testID ? `${testID}-item-none` : undefined}
          />
        )}
        {filtered.map((item) => (
          <Menu.Item
            key={item.id}
            onPress={() => {
              onSelect(item.id);
              closeMenu();
            }}
            title={labelExtractor(item)}
            testID={testID ? `${testID}-item-${item.id}` : undefined}
          />
        ))}
      </Menu>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
    flex: 1,
  },
  button: {
    borderRadius: borderRadius.sm,
  },
  buttonContent: {
    minHeight: 48,
  },
  buttonLabel: {
    fontSize: typography.sizes.bodyMedium,
    fontWeight: typography.weights.medium,
  },
  deselectItem: {
    color: colors.secondary,
    fontStyle: 'italic',
  },
});
