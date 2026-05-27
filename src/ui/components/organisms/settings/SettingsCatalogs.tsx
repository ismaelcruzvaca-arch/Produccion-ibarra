/**
 * SettingsCatalogs — Catalog CRUD management section.
 *
 * Pattern: Atomic Design — Organism (SS-3)
 * Why:
 * - One organism per settings section (AD-2).
 * - Three expandable subsections: stop_reasons, lines, machines.
 * - Each subsection lists active items, allows editing via Dialog, creation via FAB/button,
 *   and deactivation with confirmation.
 * - Uses standalone mutation helpers from hasuraMutations.ts (AD-3).
 * - catalogStore re-fetches after each mutation.
 *
 * Props:
 * - userId: the current user's ID for audit trail (updated_by)
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  List,
  Text,
  Button,
  Dialog,
  Portal,
  TextInput,
  Snackbar,
  Divider,
  IconButton,
} from 'react-native-paper';
import { useCatalogStore } from '../../../store/catalogStore';
import { ConfirmModal } from '../../atoms/ConfirmModal';
import { AppBadge } from '../../atoms/AppBadge';
import {
  createStopReason,
  updateStopReason,
  deactivateStopReason,
  createLine,
  updateLine,
  deactivateLine,
  createMachine,
  updateMachine,
  deactivateMachine,
} from '../../../../data/hasuraMutations';
import { colors, spacing, typography, borderRadius } from '../../../theme/tokens';
import type { ICatalogStopReason, ICatalogLine, ICatalogMachine } from '../../../../core/types';

interface SettingsCatalogsProps {
  userId: string;
}

// ─── Subsection Types ──────────────────────────────────────────────────────────────

type CatalogType = 'stop_reasons' | 'lines' | 'machines';

interface DialogState {
  visible: boolean;
  catalogType: CatalogType;
  editingItem: Record<string, any> | null; // null = creating new
}

const EMPTY_DIALOG: DialogState = {
  visible: false,
  catalogType: 'stop_reasons',
  editingItem: null,
};

// ─── Component ─────────────────────────────────────────────────────────────────────

export function SettingsCatalogs({ userId }: SettingsCatalogsProps) {
  const [expanded, setExpanded] = useState(false);
  const [catalogExpanded, setCatalogExpanded] = useState<CatalogType | null>(null);

  // Dialog state
  const [dialog, setDialog] = useState<DialogState>(EMPTY_DIALOG);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Deactivation confirmation
  const [deactivateTarget, setDeactivateTarget] = useState<{
    type: CatalogType;
    id: string;
    label: string;
  } | null>(null);

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ visible: boolean; message: string; isError: boolean }>({
    visible: false,
    message: '',
    isError: false,
  });

  // Store data
  const stopReasons = useCatalogStore((s) => s.stopReasons);
  const lines = useCatalogStore((s) => s.lines);
  const machines = useCatalogStore((s) => s.machines);

  const showSnackbar = useCallback((message: string, isError = false) => {
    setSnackbar({ visible: true, message, isError });
  }, []);

  const hideSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, visible: false }));
  }, []);

  // ── Dialog handlers ──────────────────────────────────────────────────────────────

  const openCreateDialog = useCallback((type: CatalogType) => {
    setDialog({ visible: true, catalogType: type, editingItem: null });
    setFormValues({});
  }, []);

  const openEditDialog = useCallback(
    (type: CatalogType, item: Record<string, any>) => {
      const values: Record<string, string> = {};
      if (type === 'stop_reasons') {
        values.code = item.code ?? '';
        values.label = item.label ?? '';
        values.category = item.category ?? '';
        values.macro = item.macro ?? '';
      } else if (type === 'lines') {
        values.name = item.name ?? '';
        values.description = item.description ?? '';
      } else if (type === 'machines') {
        values.name = item.name ?? '';
        values.description = item.description ?? '';
        values.line_id = item.line_id ?? '';
      }
      setDialog({ visible: true, catalogType: type, editingItem: item });
      setFormValues(values);
    },
    [],
  );

  const closeDialog = useCallback(() => {
    setDialog(EMPTY_DIALOG);
    setFormValues({});
  }, []);

  const handleFieldChange = useCallback((field: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ── Save handler ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!dialog.visible) return;

    const editingItem = dialog.editingItem;
    const isNew = editingItem === null;
    const type = dialog.catalogType;

    setSaving(true);
    try {
      if (type === 'stop_reasons') {
        if (isNew) {
          await createStopReason(userId, {
            code: formValues.code ?? '',
            label: formValues.label ?? '',
            category: formValues.category ?? '',
            macro: formValues.macro ?? '',
            stops_line: false,
            sort_order: 0,
          });
          showSnackbar('Falla creada correctamente');
        } else {
          await updateStopReason(userId, editingItem.id, {
            code: formValues.code,
            label: formValues.label,
            category: formValues.category,
            macro: formValues.macro,
          });
          showSnackbar('Falla actualizada correctamente');
        }
      } else if (type === 'lines') {
        if (isNew) {
          await createLine(userId, {
            name: formValues.name ?? '',
            description: formValues.description ?? '',
          });
          showSnackbar('Línea creada correctamente');
        } else {
          await updateLine(userId, editingItem.id, {
            name: formValues.name,
            description: formValues.description,
          });
          showSnackbar('Línea actualizada correctamente');
        }
      } else if (type === 'machines') {
        if (isNew) {
          await createMachine(userId, {
            line_id: formValues.line_id ?? '',
            name: formValues.name ?? '',
            description: formValues.description ?? '',
          });
          showSnackbar('Equipo creado correctamente');
        } else {
          await updateMachine(userId, editingItem.id, {
            name: formValues.name,
            description: formValues.description,
            line_id: formValues.line_id,
          });
          showSnackbar('Equipo actualizado correctamente');
        }
      }

      closeDialog();
    } catch (err: any) {
      showSnackbar(err?.message ?? 'Error al guardar', true);
    } finally {
      setSaving(false);
    }
  }, [dialog, formValues, userId, showSnackbar, closeDialog]);

  // ── Deactivate handler ────────────────────────────────────────────────────────────

  const handleDeactivate = useCallback(async () => {
    if (!deactivateTarget) return;

    try {
      const { type, id } = deactivateTarget;
      if (type === 'stop_reasons') {
        await deactivateStopReason(userId, id);
      } else if (type === 'lines') {
        await deactivateLine(userId, id);
      } else if (type === 'machines') {
        await deactivateMachine(userId, id);
      }
      showSnackbar('Elemento desactivado correctamente');
    } catch (err: any) {
      showSnackbar(err?.message ?? 'Error al desactivar', true);
    } finally {
      setDeactivateTarget(null);
    }
  }, [deactivateTarget, userId, showSnackbar]);

  // ── Render item list ──────────────────────────────────────────────────────────────

  const renderItem = useCallback(
    (type: CatalogType, item: Record<string, any>) => {
      const title = type === 'stop_reasons'
        ? `${item.code} — ${item.label}`
        : item.name;
      const description = type === 'machines' ? `Línea: ${item.line_id}` : item.description;

      return (
        <List.Item
          key={item.id}
          title={title}
          titleStyle={styles.itemTitle}
          description={description}
          descriptionStyle={styles.itemDescription}
          descriptionNumberOfLines={1}
          left={(props) => <List.Icon {...props} icon="circle-small" color={colors.secondary} />}
          right={(props) => (
            <View style={styles.itemRight}>
              {!item.is_active && (
                <AppBadge variant="error" label="Inactivo" />
              )}
              <IconButton
                icon="pencil"
                size={18}
                iconColor={colors.primary}
                onPress={() => openEditDialog(type, item)}
              />
              {item.is_active && (
                <IconButton
                  icon="close-circle"
                  size={18}
                  iconColor={colors.error}
                  onPress={() =>
                    setDeactivateTarget({
                      type,
                      id: item.id,
                      label: title,
                    })
                  }
                />
              )}
            </View>
          )}
        />
      );
    },
    [openEditDialog],
  );

  // ── Render dialog fields ──────────────────────────────────────────────────────────

  const renderDialogFields = () => {
    const type = dialog.catalogType;
    const isNew = dialog.editingItem === null;

    if (type === 'stop_reasons') {
      return (
        <>
          <TextInput
            label="Código"
            value={formValues.code ?? ''}
            onChangeText={(v) => handleFieldChange('code', v)}
            mode="outlined"
            style={styles.dialogInput}
            disabled={!isNew}
          />
          <TextInput
            label="Nombre / Descripción"
            value={formValues.label ?? ''}
            onChangeText={(v) => handleFieldChange('label', v)}
            mode="outlined"
            style={styles.dialogInput}
          />
          <TextInput
            label="Categoría"
            value={formValues.category ?? ''}
            onChangeText={(v) => handleFieldChange('category', v)}
            mode="outlined"
            style={styles.dialogInput}
          />
          <TextInput
            label="Macro"
            value={formValues.macro ?? ''}
            onChangeText={(v) => handleFieldChange('macro', v)}
            mode="outlined"
            style={styles.dialogInput}
          />
        </>
      );
    }

    if (type === 'lines') {
      return (
        <>
          <TextInput
            label="Nombre"
            value={formValues.name ?? ''}
            onChangeText={(v) => handleFieldChange('name', v)}
            mode="outlined"
            style={styles.dialogInput}
          />
          <TextInput
            label="Descripción"
            value={formValues.description ?? ''}
            onChangeText={(v) => handleFieldChange('description', v)}
            mode="outlined"
            style={styles.dialogInput}
            multiline
            numberOfLines={2}
          />
        </>
      );
    }

    if (type === 'machines') {
      return (
        <>
          <TextInput
            label="Nombre"
            value={formValues.name ?? ''}
            onChangeText={(v) => handleFieldChange('name', v)}
            mode="outlined"
            style={styles.dialogInput}
          />
          <TextInput
            label="Descripción"
            value={formValues.description ?? ''}
            onChangeText={(v) => handleFieldChange('description', v)}
            mode="outlined"
            style={styles.dialogInput}
            multiline
            numberOfLines={2}
          />
          <TextInput
            label="ID de Línea"
            value={formValues.line_id ?? ''}
            onChangeText={(v) => handleFieldChange('line_id', v)}
            mode="outlined"
            style={styles.dialogInput}
            disabled={!isNew}
          />
        </>
      );
    }

    return null;
  };

  const getDialogTitle = () => {
    const isNew = dialog.editingItem === null;
    const labels: Record<CatalogType, string> = {
      stop_reasons: 'Falla',
      lines: 'Línea',
      machines: 'Equipo',
    };
    return isNew ? `Agregar ${labels[dialog.catalogType]}` : `Editar ${labels[dialog.catalogType]}`;
  };

  // ── Subsection renderers ──────────────────────────────────────────────────────────

  const renderSubsection = (
    type: CatalogType,
    title: string,
    icon: string,
    items: Record<string, any>[],
  ) => {
    const isExpanded = catalogExpanded === type;

    return (
      <List.Accordion
        title={title}
        titleStyle={styles.subAccordionTitle}
        left={(props) => <List.Icon {...props} icon={icon} color={colors.secondary} />}
        expanded={isExpanded}
        onPress={() => setCatalogExpanded(isExpanded ? null : type)}
      >
        <View style={styles.subContent}>
          {items.length === 0 ? (
            <Text variant="bodySmall" style={styles.emptyText}>
              No hay elementos registrados
            </Text>
          ) : (
            items.map((item) => renderItem(type, item))
          )}

          <Divider style={styles.divider} />

          <Button
            mode="outlined"
            icon="plus"
            style={styles.addButton}
            contentStyle={styles.addButtonContent}
            onPress={() => openCreateDialog(type)}
          >
            Agregar
          </Button>
        </View>
      </List.Accordion>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <List.Accordion
        title="Catálogos"
        titleStyle={styles.accordionTitle}
        left={(props) => <List.Icon {...props} icon="database" color={colors.primary} />}
        expanded={expanded}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.content}>
          <Text variant="bodySmall" style={styles.description}>
            Gestione los catálogos del sistema: fallas, líneas de producción y equipos.
          </Text>

          <Divider style={styles.divider} />

          {renderSubsection('stop_reasons', 'Fallas', 'alert-circle', stopReasons.filter((r) => r.is_active))}
          {renderSubsection('lines', 'Líneas', 'floor-plan', lines.filter((l) => l.is_active))}
          {renderSubsection('machines', 'Equipos', 'factory', machines.filter((m) => m.is_active))}
        </View>
      </List.Accordion>

      {/* Create/Edit Dialog */}
      <Portal>
        <Dialog visible={dialog.visible} onDismiss={closeDialog} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>{getDialogTitle()}</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={styles.dialogScroll}>
              {renderDialogFields()}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeDialog} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onPress={handleSave}
              mode="contained"
              loading={saving}
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Deactivation Confirmation */}
      <ConfirmModal
        visible={deactivateTarget !== null}
        title="Desactivar elemento"
        message={
          deactivateTarget
            ? `¿Está seguro de desactivar "${deactivateTarget.label}"? El elemento quedará oculto pero los datos históricos se conservarán.`
            : ''
        }
        icon="alert-circle"
        confirmLabel="Desactivar"
        cancelLabel="Cancelar"
        confirmColor={colors.error}
        onConfirm={handleDeactivate}
        onDismiss={() => setDeactivateTarget(null)}
      />

      {/* Snackbar feedback */}
      <Snackbar
        visible={snackbar.visible}
        onDismiss={hideSnackbar}
        duration={4000}
        action={{
          label: 'Cerrar',
          onPress: hideSnackbar,
        }}
        style={[
          styles.snackbar,
          { backgroundColor: snackbar.isError ? colors.error : colors.success },
        ]}
      >
        {snackbar.message}
      </Snackbar>
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  accordionTitle: {
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
  },
  subAccordionTitle: {
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
    fontSize: typography.sizes.bodyMedium,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  subContent: {
    paddingLeft: spacing.md,
  },
  description: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  divider: {
    marginVertical: spacing.sm,
  },
  itemTitle: {
    fontSize: typography.sizes.bodyMedium,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  itemDescription: {
    fontSize: typography.sizes.bodySmall,
    color: colors.textSecondary,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontStyle: 'italic',
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
  },
  addButton: {
    borderRadius: borderRadius.sm,
    borderColor: colors.primary,
  },
  addButtonContent: {
    minHeight: 40,
  },
  dialog: {
    maxHeight: '80%',
  },
  dialogTitle: {
    color: colors.textPrimary,
  },
  dialogInput: {
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
  },
  dialogScroll: {
    maxHeight: 400,
  },
  snackbar: {
    borderRadius: borderRadius.sm,
  },
});
