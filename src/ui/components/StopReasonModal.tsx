/**
 * StopReasonModal — modal para seleccionar motivo de paro.
 *
 * Componente separado del OeeScreen para mantener el organismo cohesivo.
 * Los paros de catálogo se renderizan como lista seleccionable.
 */
import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Modal, Text, Button, Portal, Divider } from 'react-native-paper';
import { colors, spacing, typography, borderRadius } from '../theme/tokens';

interface StopReasonModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSelectReason: (reason: string) => void;
}

export function StopReasonModal({ visible, onDismiss, onSelectReason }: StopReasonModalProps) {
  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <Text variant="titleLarge" style={styles.title}>Seleccionar Motivo de Paro</Text>
        <Divider style={styles.divider} />
        <ScrollView style={styles.list}>
          <TouchableOpacity
            style={styles.item}
            onPress={() => { onSelectReason('paro_operativo'); onDismiss(); }}
          >
            <Text variant="bodyLarge" style={styles.itemText}>Paro Operativo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() => { onSelectReason('paro_mecanico'); onDismiss(); }}
          >
            <Text variant="bodyLarge" style={styles.itemText}>Paro Mecánico</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() => { onSelectReason('paro_electrico'); onDismiss(); }}
          >
            <Text variant="bodyLarge" style={styles.itemText}>Paro Eléctrico</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() => { onSelectReason('falta_material'); onDismiss(); }}
          >
            <Text variant="bodyLarge" style={styles.itemText}>Falta de Material</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.item}
            onPress={() => { onSelectReason('calidad'); onDismiss(); }}
          >
            <Text variant="bodyLarge" style={styles.itemText}>Calidad</Text>
          </TouchableOpacity>
        </ScrollView>
        <Button mode="outlined" onPress={onDismiss} style={styles.cancelButton}>
          Cancelar
        </Button>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    margin: spacing.md,
    borderRadius: borderRadius.md,
    maxHeight: '80%',
  },
  title: {
    color: colors.textPrimary,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
  },
  divider: {
    marginBottom: spacing.sm,
  },
  list: {
    maxHeight: 400,
  },
  item: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
  },
  itemText: {
    color: colors.textPrimary,
  },
  cancelButton: {
    marginTop: spacing.md,
  },
});
