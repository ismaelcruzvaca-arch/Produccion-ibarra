/**
 * CatalogDialog — generic create/edit dialog for catalog items.
 *
 * Renders a react-native-paper Dialog with fields defined by CatalogTableConfig.
 * Used by CatalogSection for Add / Edit operations across stop_reasons, lines, and machines.
 *
 * Pattern: Generic Config-Driven Dialog
 * Why: All three catalogs (stop_reasons, lines, machines) need the same CRUD pattern
 * with different field sets. A single generic dialog avoids duplicating dialog state
 * and field rendering three times.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Dialog, Portal, TextInput, Button, Text, Switch } from 'react-native-paper';

export interface CatalogField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'boolean';
  required?: boolean;
}

export interface CatalogTableConfig {
  title: string;
  dataKey: string;
  displayField: string;
  fields: CatalogField[];
  insert: (vars: Record<string, any>) => Promise<boolean>;
  update: (id: string, vars: Record<string, any>) => Promise<boolean>;
  delete: (id: string) => Promise<boolean>;
}

interface CatalogDialogProps {
  visible: boolean;
  config: CatalogTableConfig;
  editItem?: Record<string, any> | null; // null = create mode
  onDismiss: () => void;
  onSaved: () => void;
}

export function CatalogDialog({ visible, config, editItem, onDismiss, onSaved }: CatalogDialogProps) {
  const [values, setValues] = useState<Record<string, string | boolean | number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!editItem;

  // Reset form when dialog opens
  useEffect(() => {
    if (visible) {
      if (editItem) {
        const initial: Record<string, any> = {};
        for (const field of config.fields) {
          initial[field.name] = editItem[field.name] ?? (field.type === 'boolean' ? false : '');
        }
        setValues(initial);
      } else {
        const initial: Record<string, any> = {};
        for (const field of config.fields) {
          initial[field.name] = field.type === 'boolean' ? false : '';
        }
        setValues(initial);
      }
      setError(null);
      setSaving(false);
    }
  }, [visible, editItem, config.fields]);

  const handleChange = useCallback((name: string, value: string | boolean | number) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    // Validate required fields
    for (const field of config.fields) {
      if (field.required) {
        const val = values[field.name];
        if (val === '' || val === undefined || val === null) {
          setError(`"${field.label}" es requerido`);
          return;
        }
      }
    }

    setSaving(true);
    setError(null);

    try {
      // Build mutation vars — convert types as needed
      const vars: Record<string, any> = {};
      for (const field of config.fields) {
        let val = values[field.name];
        if (field.type === 'number') {
          val = typeof val === 'string' ? parseFloat(val) : val;
        }
        if (val !== '' && val !== undefined && val !== null) {
          vars[field.name] = val;
        }
      }

      let ok: boolean;
      if (isEditing && editItem?.id) {
        ok = await config.update(editItem.id, vars);
      } else {
        ok = await config.insert(vars);
      }

      if (ok) {
        onSaved();
        onDismiss();
      } else {
        setError('Error al guardar. Intente de nuevo.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error inesperado');
    } finally {
      setSaving(false);
    }
  }, [config, values, isEditing, editItem, onSaved, onDismiss]);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{isEditing ? `Editar ${config.title}` : `Agregar ${config.title}`}</Dialog.Title>
        <Dialog.Content>
          {config.fields.map((field) => (
            <View key={field.name} style={styles.fieldRow}>
              {field.type === 'boolean' ? (
                <View style={styles.switchRow}>
                  <Text variant="bodyMedium" style={styles.switchLabel}>
                    {field.label}
                  </Text>
                  <Switch
                    value={!!values[field.name]}
                    onValueChange={(val) => handleChange(field.name, val)}
                  />
                </View>
              ) : (
                <TextInput
                  mode="outlined"
                  label={field.label}
                  value={String(values[field.name] ?? '')}
                  onChangeText={(val) => handleChange(field.name, val)}
                  keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                  style={styles.input}
                />
              )}
            </View>
          ))}
          {error && (
            <Text variant="bodySmall" style={styles.errorText}>
              {error}
            </Text>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={saving}>
            Cancelar
          </Button>
          <Button onPress={handleSave} loading={saving} mode="contained">
            {isEditing ? 'Guardar' : 'Agregar'}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxWidth: 400,
    alignSelf: 'center',
  },
  fieldRow: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    flex: 1,
  },
  errorText: {
    color: '#C62828',
    marginTop: 8,
  },
});
