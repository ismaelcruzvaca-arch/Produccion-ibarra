/**
 * CatalogSection — displays a list of catalog items with CRUD controls.
 *
 * Fetches data from catalogStore, renders items with edit/delete buttons,
 * and provides an "Agregar" button to open CatalogDialog.
 *
 * CRUD controls are only shown for admin role as per spec.
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, IconButton, Dialog, Portal } from 'react-native-paper';

import { useAuthStore } from '../../../../auth/useAuthStore';
import { useCatalogStore } from '../../../store/catalogStore';
import { CatalogDialog, type CatalogTableConfig } from './CatalogDialog';

interface CatalogSectionProps {
  config: CatalogTableConfig;
}

export function CatalogSection({ config }: CatalogSectionProps) {
  const role = useAuthStore((s) => s.role);
  const isAdmin = role === 'admin';

  // Subscribe to the correct catalog data array from catalogStore
  const items = useCatalogStore((s) => {
    const data = (s as any)[config.dataKey];
    return Array.isArray(data) ? data : [];
  });

  // Dialog state
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, any> | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Record<string, any> | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = useCallback(() => {
    setEditItem(null);
    setDialogVisible(true);
  }, []);

  const openEdit = useCallback((item: Record<string, any>) => {
    setEditItem(item);
    setDialogVisible(true);
  }, []);

  const handleSaved = useCallback(() => {
    // Invalidate cache so catalogStore re-fetches on next loadCatalogs()
    useCatalogStore.getState().invalidateCache();
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const ok = await config.delete(deleteTarget.id);
      if (ok) {
        handleSaved();
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, config, handleSaved]);

  // Raw items for rendering
  const rawItems = items as Record<string, any>[];

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.header}>
        <Text variant="titleMedium" style={styles.title}>{config.title}</Text>
        {isAdmin && (
          <Button
            mode="contained"
            compact
            icon="plus"
            onPress={openCreate}
            style={styles.addButton}
            labelStyle={styles.addButtonLabel}
          >
            Agregar
          </Button>
        )}
      </View>

      {/* List */}
      {rawItems.length === 0 ? (
        <Text variant="bodyMedium" style={styles.emptyText}>
          Sin registros
        </Text>
      ) : (
        <View style={styles.list}>
          {rawItems.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text variant="bodyMedium" style={styles.itemLabel}>
                {item[config.displayField] ?? item.name ?? item.label ?? item.code}
              </Text>
              {isAdmin && (
                <View style={styles.itemActions}>
                  <IconButton
                    icon="pencil"
                    size={20}
                    onPress={() => openEdit(item)}
                  />
                  <IconButton
                    icon="delete"
                    size={20}
                    iconColor="#C62828"
                    onPress={() => setDeleteTarget(item)}
                  />
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Create / Edit Dialog */}
      <CatalogDialog
        visible={dialogVisible}
        config={config}
        editItem={editItem}
        onDismiss={() => {
          setDialogVisible(false);
          setEditItem(null);
        }}
        onSaved={handleSaved}
      />

      {/* Delete confirmation Dialog */}
      <Portal>
        <Dialog visible={!!deleteTarget} onDismiss={() => setDeleteTarget(null)}>
          <Dialog.Icon icon="alert" />
          <Dialog.Title>Eliminar {config.title}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              ¿Está seguro de eliminar "{deleteTarget?.[config.displayField] ?? deleteTarget?.name ?? ''}"?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button onPress={confirmDelete} loading={deleting} textColor="#C62828">
              Eliminar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontWeight: '600',
    color: '#212121',
  },
  addButton: {
    borderRadius: 6,
  },
  addButtonLabel: {
    fontSize: 12,
  },
  emptyText: {
    color: '#9E9E9E',
    textAlign: 'center',
    paddingVertical: 16,
  },
  list: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  itemLabel: {
    flex: 1,
    color: '#424242',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
