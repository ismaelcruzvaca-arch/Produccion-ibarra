/**
 * SettingsCatalogs — catalog management section for the settings screen.
 *
 * Renders three CatalogSection components (stop_reasons, lines, machines)
 * for admin users. Operators and supervisors see a read-only message.
 *
 * Uses the mutation functions from catalogMutations.ts (created in PR 1)
 * and the catalog store for data access.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { useAuthStore } from '../../../../auth/useAuthStore';
import { CatalogSection, type CatalogTableConfig } from './CatalogSection';
import {
  insertStopReason,
  updateStopReason,
  deleteStopReason,
  insertLine,
  updateLine,
  deleteLine,
  insertMachine,
  updateMachine,
  deleteMachine,
  type InsertStopReasonInput,
  type UpdateStopReasonInput,
  type InsertLineInput,
  type UpdateLineInput,
  type InsertMachineInput,
  type UpdateMachineInput,
} from '../../../../graphql/catalogMutations';

const STOP_REASONS_CONFIG: CatalogTableConfig = {
  title: 'Razones de Paro',
  dataKey: 'stopReasons',
  displayField: 'label',
  fields: [
    { name: 'code', label: 'Código', type: 'text', required: true },
    { name: 'label', label: 'Etiqueta', type: 'text', required: true },
    { name: 'category', label: 'Categoría', type: 'text' },
    { name: 'macro', label: 'Macro', type: 'text' },
    { name: 'stops_line', label: 'Detiene línea', type: 'boolean' },
    { name: 'sort_order', label: 'Orden', type: 'number' },
  ],
  insert: (vars) => insertStopReason(vars as unknown as InsertStopReasonInput),
  update: (id, vars) => updateStopReason(id, vars as unknown as UpdateStopReasonInput),
  delete: (id) => deleteStopReason(id),
};

const LINES_CONFIG: CatalogTableConfig = {
  title: 'Líneas',
  dataKey: 'lines',
  displayField: 'name',
  fields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true },
    { name: 'description', label: 'Descripción', type: 'text' },
  ],
  insert: (vars) => insertLine(vars as unknown as InsertLineInput),
  update: (id, vars) => updateLine(id, vars as unknown as UpdateLineInput),
  delete: (id) => deleteLine(id),
};

const MACHINES_CONFIG: CatalogTableConfig = {
  title: 'Máquinas',
  dataKey: 'machines',
  displayField: 'name',
  fields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true },
    { name: 'description', label: 'Descripción', type: 'text' },
    { name: 'line_id', label: 'ID de Línea', type: 'text', required: true },
  ],
  insert: (vars) => insertMachine(vars as unknown as InsertMachineInput),
  update: (id, vars) => updateMachine(id, vars as unknown as UpdateMachineInput),
  delete: (id) => deleteMachine(id),
};

export function SettingsCatalogs() {
  const role = useAuthStore((s) => s.role);

  if (role !== 'admin') {
    return (
      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>Catálogos</Text>
        <Text variant="bodyMedium" style={styles.readOnlyText}>
          Los catálogos son solo de lectura para su rol.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <CatalogSection config={STOP_REASONS_CONFIG} />
      <CatalogSection config={LINES_CONFIG} />
      <CatalogSection config={MACHINES_CONFIG} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '700',
    color: '#212121',
    marginBottom: 12,
  },
  readOnlyText: {
    color: '#757575',
    fontStyle: 'italic',
  },
});
