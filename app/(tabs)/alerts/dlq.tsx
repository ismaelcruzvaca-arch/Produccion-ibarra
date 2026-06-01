/**
 * DLQ Screen — Dead Letter Queue management for sync errors.
 *
 * Moved from `app/(tabs)/supervisor.tsx` as part of the gateway-alerts change.
 * Now lives inside the alerts group at `app/(tabs)/alerts/dlq.tsx`.
 *
 * Lists all failed sync events from the local `sync_errors` RxDB collection.
 * Actions:
 *  - Descartar: permanently removes the error record without touching the original event.
 *  - Reintentar: bumps the `updated_at` timestamp on the original `oee_events` document
 *    so the RxDB replication engine re-queues it for push to Hasura, then removes the error.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import {
  Text,
  Card,
  Button,
  Portal,
  Dialog,
  Snackbar,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import { useDatabase } from '../../../src/data/DatabaseContext';
import { nowMs } from '../../../src/utils/timestamp';
import type { ISyncError } from '../../../src/core/types';
import type { RxDocument } from 'rxdb';

type SyncErrorDoc = RxDocument<ISyncError>;

export default function DlqScreen() {
  const db = useDatabase();
  const [errors, setErrors] = useState<SyncErrorDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  // Snackbar
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Reactive subscription to sync_errors collection
  useEffect(() => {
    if (!db) return;
    const subscription = db.sync_errors.find().$
      .subscribe((docs: SyncErrorDoc[]) => {
        setErrors(docs);
        setLoading(false);
      });
    return () => subscription.unsubscribe();
  }, [db]);

  const showConfirm = useCallback((title: string, message: string, action: () => Promise<void>) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setPendingAction(() => action);
    setConfirmVisible(true);
  }, []);

  const executeConfirm = useCallback(async () => {
    if (!pendingAction) return;
    setConfirmVisible(false);
    try {
      await pendingAction();
    } catch (e: any) {
      setSnackbarMessage(`Error: ${e?.message ?? 'Operación fallida'}`);
      setSnackbarVisible(true);
    }
    setPendingAction(null);
  }, [pendingAction]);

  const handleDiscard = useCallback((errorDoc: SyncErrorDoc) => {
    showConfirm(
      'Descartar error',
      `¿Descartar este error de sincronización?\n\nEvento: ${errorDoc.id_evento}\n\nEl evento original NO será modificado.`,
      async () => {
        await errorDoc.remove();
        setSnackbarMessage('Error descartado correctamente');
        setSnackbarVisible(true);
      }
    );
  }, [showConfirm]);

  const handleRetry = useCallback((errorDoc: SyncErrorDoc) => {
    showConfirm(
      'Reintentar sincronización',
      `¿Reintentar el envío de este evento a Hasura?\n\nEvento: ${errorDoc.id_evento}\n\nSi el servidor vuelve a rechazarlo, el error reaparecerá en esta lista.`,
      async () => {
        if (!db) return;
        const originalEvent = await db.oee_events.findOne(errorDoc.id_evento).exec();
        if (originalEvent) {
          await originalEvent.patch({ updated_at: nowMs() });
        }
        await errorDoc.remove();
        setSnackbarMessage('Reintento encolado — el motor de sync tomará el evento');
        setSnackbarVisible(true);
      }
    );
  }, [showConfirm, db]);

  const formatDate = (epochMs: number) => {
    return new Date(epochMs).toLocaleString('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>Panel de Supervisor</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Errores de sincronización pendientes
        </Text>
      </View>

      {errors.length === 0 ? (
        <View style={styles.center}>
          <Text variant="displaySmall">✅</Text>
          <Text variant="bodyLarge" style={styles.emptyText}>Sin errores pendientes</Text>
          <Text variant="bodySmall" style={styles.emptySubtext}>
            Todos los eventos se sincronizaron correctamente con el servidor.
          </Text>
        </View>
      ) : (
        <>
          <Chip icon="alert-circle" style={styles.badge}>
            {errors.length} {errors.length === 1 ? 'error pendiente' : 'errores pendientes'}
          </Chip>
          <FlatList
            data={errors}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Card style={styles.card} testID={`dlq-error-card-${item.id}`}>
                <Card.Content>
                  <Text variant="labelSmall" style={styles.label}>ID Evento</Text>
                  <Text variant="bodySmall" style={styles.mono} numberOfLines={1}>
                    {item.id_evento}
                  </Text>
                  <Text variant="labelSmall" style={[styles.label, { marginTop: 8 }]}>Error</Text>
                  <Text variant="bodySmall" style={styles.errorText} numberOfLines={3}>
                    {item.mensaje_error}
                  </Text>
                  <Text variant="labelSmall" style={[styles.label, { marginTop: 8 }]}>Fecha</Text>
                  <Text variant="bodySmall">{formatDate(item.fecha)}</Text>
                </Card.Content>
                <Card.Actions>
                  <Button
                    mode="outlined"
                    onPress={() => handleDiscard(item)}
                    testID={`dlq-discard-${item.id}`}
                  >
                    Descartar
                  </Button>
                  <Button
                    mode="contained"
                    onPress={() => handleRetry(item)}
                    testID={`dlq-retry-${item.id}`}
                  >
                    Reintentar
                  </Button>
                </Card.Actions>
              </Card>
            )}
          />
        </>
      )}

      <Portal>
        <Dialog visible={confirmVisible} onDismiss={() => setConfirmVisible(false)}>
          <Dialog.Icon icon="alert" />
          <Dialog.Title>{confirmTitle}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{confirmMessage}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmVisible(false)}>Cancelar</Button>
            <Button onPress={executeConfirm} testID="dlq-confirm-action">Confirmar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  title: {
    fontWeight: 'bold',
    color: '#3E2723',
  },
  subtitle: {
    color: '#757575',
    marginTop: 4,
  },
  badge: {
    margin: 16,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3E0',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
  },
  label: {
    color: '#9E9E9E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mono: {
    fontFamily: 'monospace',
    color: '#424242',
  },
  errorText: {
    color: '#B71C1C',
  },
  emptyText: {
    marginTop: 16,
    fontWeight: 'bold',
    color: '#388E3C',
  },
  emptySubtext: {
    marginTop: 8,
    color: '#757575',
    textAlign: 'center',
  },
  snackbar: {
    marginBottom: 16,
    marginHorizontal: 16,
  },
});
