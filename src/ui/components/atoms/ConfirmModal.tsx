/**
 * ConfirmModal — Reusable confirmation dialog with icon, title, message, confirm/cancel.
 *
 * Pattern: Atomic Design — Atom
 * Why:
 * - Better than the current ConfirmEventModal — adds icon customization and testIDs.
 * - Consumes design tokens for consistent theming.
 *
 * Usage:
 *   <ConfirmModal
 *     visible={showConfirm}
 *     icon="alert-circle"
 *     title="Cerrar Turno"
 *     message="¿Está seguro de cerrar el turno actual?"
 *     confirmLabel="Cerrar"
 *     cancelLabel="Cancelar"
 *     onConfirm={handleEndShift}
 *     onDismiss={() => setShowConfirm(false)}
 *   />
 */

import React from 'react';
import { Portal, Dialog, Button, Text } from 'react-native-paper';
import { colors, spacing, typography, borderRadius } from '../../theme/tokens';

interface ConfirmModalProps {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  icon?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  testID?: string;
}

export function ConfirmModal({
  visible,
  onDismiss,
  onConfirm,
  title,
  message,
  icon,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmColor = colors.primary,
  testID,
}: ConfirmModalProps) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} testID={testID}>
        {icon && <Dialog.Icon icon={icon} size={40} />}
        <Dialog.Title style={{ color: colors.textPrimary }}>
          {title}
        </Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
            {message}
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} testID={testID ? `${testID}-cancel` : undefined}>
            {cancelLabel}
          </Button>
          <Button
            onPress={onConfirm}
            mode="contained"
            buttonColor={confirmColor}
            testID={testID ? `${testID}-confirm` : undefined}
          >
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
