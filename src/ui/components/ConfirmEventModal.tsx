/**
 * Confirm Event Modal — generic confirmation dialog before creating any OEE event.
 *
 * Used for:
 * - Confirming downtime_start with selected reason
 * - Confirming downtime_end (with active downtime info)
 * - Confirming shift_end (when no blocker)
 */

import React from 'react';
import { Portal, Dialog, Button, Text } from 'react-native-paper';

interface ConfirmEventModalProps {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: string;
}

export function ConfirmEventModal({
  visible,
  onDismiss,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  icon,
}: ConfirmEventModalProps) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        {icon && <Dialog.Icon icon={icon} />}
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium">{message}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{cancelLabel}</Button>
          <Button onPress={onConfirm} mode="contained">
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
