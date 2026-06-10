/**
 * PackagingScreen organism — F-PD-21 Línea de Empaque (Hora x Hora).
 *
 * Pattern: Atomic Design — Organism
 * Why:
 * - Consistent with ToasterScreen, MixingScreen, etc.
 * - Packaging lines operate on hourly cadence (hora x hora).
 * - Cadence reminders prompt operator to enter data periodically.
 * - Basic downtime lifecycle: start/stop with reason selection.
 * - Full quality/signature integration comes in PR3.
 *
 * Design: Decision 5 (F-PD-21 Screen as new organism), Design Step 7.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Portal, Dialog, Divider, Snackbar, DataTable } from 'react-native-paper';
import type { RxDocument } from 'rxdb';

import { useOeeEventsRepository } from '../../../repositories/useOeeEventsRepository';
import { usePlantConfigRepository } from '../../../repositories/usePlantConfigRepository';
import { useShiftSessionsRepository } from '../../../repositories/useShiftSessionsRepository';
import { useCatalogStore } from '../../store/catalogStore';
import { useProductionFlow } from '../../hooks/useProductionFlow';
import { StopReasonModal } from '../modals/StopReasonModal';
import { ConfirmEventModal } from '../ConfirmEventModal';
import { NumpadModal } from '../NumpadModal';
import { colors, spacing, typography, borderRadius, touchTarget } from '../../theme/tokens';
import type { IOeeEvent } from '../../../core/types';
import type { ParoReason } from '../../../config/catalogs';
import { PARO_BY_CODE } from '../../../config/catalogs';
import { nowMs } from '../../../utils/timestamp';
import { OEE_LIMITS } from '../../../config/oeeLimits';

// ─── Hourly record ────────────────────────────────────────────────────────────

interface HourlyRecord {
  hour: string;            // HH:00
  cajasReales: number;
  tiempoMuertoMin: number;
  tiempoMuertoCausa: string;
  paroActivo: boolean;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PackagingScreen() {
  const repository = useOeeEventsRepository();
  const plantConfigRepo = usePlantConfigRepository();
  const shiftSessionsRepo = useShiftSessionsRepository();
  const repositoryRef = useRef(repository);
  repositoryRef.current = repository;

  const { selectedMachine, selectedShift } = useCatalogStore();
  const getMachineById = useCatalogStore((s) => s.getMachineById);
  const { shiftSessionId, isShiftActive } = useProductionFlow();

  // ─── Shift state ──────────────────────────────────────────────────────────────
  const [shiftStarted, setShiftStarted] = useState(false);

  // ─── Events ──────────────────────────────────────────────────────────────────
  const [events, setEvents] = useState<IOeeEvent[]>([]);
  const [activeDowntime, setActiveDowntime] = useState<RxDocument<IOeeEvent> | null>(null);

  // ─── Hourly records ───────────────────────────────────────────────────────────
  const [records, setRecords] = useState<HourlyRecord[]>([]);

  // ─── Cadence ─────────────────────────────────────────────────────────────────
  const [cadenceIntervalMin, setCadenceIntervalMin] = useState(30);
  const [cadenceDue, setCadenceDue] = useState(false);
  const [cadenceElapsedMin, setCadenceElapsedMin] = useState(0);

  // ─── Modal states ────────────────────────────────────────────────────────────
  const [showStopModal, setShowStopModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmLabel, setConfirmLabel] = useState('Confirmar');
  const [pendingEvent, setPendingEvent] = useState<Partial<IOeeEvent> | null>(null);
  const [showProductionModal, setShowProductionModal] = useState(false);

  // ─── Snackbar ────────────────────────────────────────────────────────────────
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // ─── Subscribe to events ────────────────────────────────────────────────────
  const { docs$: oeeDocs$ } = repository;

  useEffect(() => {
    const subscription = oeeDocs$.subscribe((docs) => {
      setEvents(docs.map((doc) => doc.toJSON() as IOeeEvent));
    });
    return () => subscription.unsubscribe();
  }, [oeeDocs$]);

  // ─── Poll active downtime ───────────────────────────────────────────────────
  useEffect(() => {
    if (!shiftStarted || !selectedMachine) {
      setActiveDowntime(null);
      return;
    }
    let isMounted = true;
    const check = async () => {
      const dt = await repositoryRef.current.findActiveDowntime(selectedMachine);
      if (isMounted) setActiveDowntime(dt);
    };
    check();
    const interval = setInterval(check, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [shiftStarted, selectedMachine]);

  // ─── Load cadence config ───────────────────────────────────────────────────
  useEffect(() => {
    plantConfigRepo.getCadenceIntervalMin().then(setCadenceIntervalMin);
  }, [plantConfigRepo]);

  // ─── Build hourly records from events ──────────────────────────────────────
  useEffect(() => {
    const hourBuckets = new Map<string, HourlyRecord>();

    // Initialize buckets for current shift hours (max 12h)
    const now = new Date();
    const shiftStartHour = now.getHours() - 8; // reasonable window
    for (let h = 0; h < 12; h++) {
      const hour = (shiftStartHour + h) % 24;
      const key = `${String(hour).padStart(2, '0')}:00`;
      hourBuckets.set(key, { hour: key, cajasReales: 0, tiempoMuertoMin: 0, tiempoMuertoCausa: '', paroActivo: false });
    }

    // Current open downtimes
    const openDowntimes = new Map<string, { start: number; reason: string }>();

    for (const evt of events.sort((a, b) => a.timestamp - b.timestamp)) {
      const d = new Date(evt.timestamp);
      const hourKey = `${String(d.getHours()).padStart(2, '0')}:00`;

      let bucket = hourBuckets.get(hourKey);
      if (!bucket) {
        bucket = { hour: hourKey, cajasReales: 0, tiempoMuertoMin: 0, tiempoMuertoCausa: '', paroActivo: false };
        hourBuckets.set(hourKey, bucket);
      }

      if (evt.event_type === 'box_count') {
        bucket.cajasReales += evt.quantity ?? 0;
      } else if (evt.event_type === 'downtime_start') {
        openDowntimes.set(evt.id, { start: evt.timestamp, reason: evt.reason_code ?? '' });
        bucket.paroActivo = true;
      } else if (evt.event_type === 'downtime_end' && evt.related_event_id) {
        const startInfo = openDowntimes.get(evt.related_event_id);
        if (startInfo) {
          const durMin = Math.round((evt.timestamp - startInfo.start) / 60000);
          bucket.tiempoMuertoMin += durMin;
          bucket.tiempoMuertoCausa = startInfo.reason;
          openDowntimes.delete(evt.related_event_id);
        }
      }
    }

    setRecords(
      Array.from(hourBuckets.values())
        .filter((r) => r.cajasReales > 0 || r.tiempoMuertoMin > 0)
        .sort((a, b) => a.hour.localeCompare(b.hour)),
    );
  }, [events]);

  // ─── Cadence timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!shiftStarted) {
      setCadenceDue(false);
      setCadenceElapsedMin(0);
      return;
    }

    const lastEventTime = events.length > 0
      ? Math.max(...events.map((e) => e.timestamp))
      : 0;

    const tick = () => {
      if (lastEventTime > 0) {
        const elapsed = (nowMs() - lastEventTime) / 60000;
        setCadenceElapsedMin(Math.round(elapsed * 10) / 10);
        setCadenceDue(elapsed >= cadenceIntervalMin);
      }
    };

    tick();
    const interval = setInterval(tick, 15000);
    return () => clearInterval(interval);
  }, [shiftStarted, events, cadenceIntervalMin]);

  // ─── Shift Start ────────────────────────────────────────────────────────────
  const handleStartShift = useCallback(async () => {
    if (!selectedMachine || !selectedShift) return;

    // Check for active session
    const active = await shiftSessionsRepo.findActiveByMachine(selectedMachine);
    if (active) {
      setSnackbarMessage('Ya hay un turno activo en esta máquina');
      setSnackbarVisible(true);
      return;
    }

    await repository.createEvent({
      event_type: 'shift_start',
      timestamp: nowMs(),
      planned_boxes: 480,
    });
    setShiftStarted(true);
    setSnackbarMessage('Turno iniciado — Línea de Empaque');
    setSnackbarVisible(true);
  }, [selectedMachine, selectedShift, shiftSessionsRepo, repository]);

  // ─── Shift End ──────────────────────────────────────────────────────────────
  const handleEndShift = useCallback(async () => {
    if (!selectedMachine) return;
    const dt = await repository.findActiveDowntime(selectedMachine);
    if (dt) {
      setSnackbarMessage('Cierre el paro activo antes de terminar el turno');
      setSnackbarVisible(true);
      return;
    }
    setConfirmTitle('Cerrar Turno — Empaque');
    setConfirmMessage('¿Finalizar el turno actual de la línea de empaque?');
    setConfirmLabel('Cerrar Turno');
    setPendingEvent({ event_type: 'shift_end' });
    setShowConfirmModal(true);
  }, [selectedMachine, repository]);

  const executeShiftEnd = useCallback(async () => {
    if (!selectedMachine) return;
    await repository.createEvent({
      event_type: 'shift_end',
      timestamp: nowMs(),
    });
    setShiftStarted(false);
    setShowConfirmModal(false);
    setPendingEvent(null);
    setSnackbarMessage('Turno cerrado');
    setSnackbarVisible(true);
  }, [selectedMachine, repository]);

  // ─── Production ──────────────────────────────────────────────────────────────
  const handleRegisterProduction = useCallback(() => {
    setShowProductionModal(true);
  }, []);

  const handleProductionSubmit = useCallback((value: number) => {
    setShowProductionModal(false);
    if (value <= 0) return;

    repository.createEvent({
      event_type: 'box_count',
      timestamp: nowMs(),
      quantity: value,
    });
    setSnackbarMessage(`Producción registrada: ${value} cajas`);
    setSnackbarVisible(true);
  }, [repository]);

  // ─── Downtime Start ─────────────────────────────────────────────────────────
  const handleStartDowntime = useCallback(() => {
    setShowStopModal(true);
  }, []);

  const handleSelectStopReason = useCallback((reason: ParoReason) => {
    setShowStopModal(false);
    setConfirmTitle('Confirmar Paro');
    setConfirmMessage(`¿Registrar paro en empaque por: ${reason.label} (${reason.code})?`);
    setConfirmLabel('Iniciar Paro');
    setPendingEvent({
      event_type: 'downtime_start',
      reason_code: reason.code,
    });
    setShowConfirmModal(true);
  }, []);

  const executeDowntimeStart = useCallback(async () => {
    if (!pendingEvent || !selectedMachine) return;
    await repository.createEvent({
      event_type: 'downtime_start',
      timestamp: nowMs(),
      reason_code: pendingEvent.reason_code,
    });
    setShowConfirmModal(false);
    setPendingEvent(null);
    setSnackbarMessage('Paro registrado');
    setSnackbarVisible(true);
  }, [pendingEvent, selectedMachine, repository]);

  // ─── Downtime End ───────────────────────────────────────────────────────────
  const handleEndDowntime = useCallback(() => {
    if (!activeDowntime) return;
    const reasonCode = activeDowntime.get('reason_code') as string | undefined;
    const reasonLabel = reasonCode ? PARO_BY_CODE[reasonCode]?.label : 'Desconocido';

    setConfirmTitle('Fin de Paro');
    setConfirmMessage(`¿Cerrar paro activo: ${reasonLabel}?`);
    setConfirmLabel('Cerrar Paro');
    setPendingEvent({
      event_type: 'downtime_end',
      related_event_id: activeDowntime.get('id'),
    });
    setShowConfirmModal(true);
  }, [activeDowntime]);

  const executeDowntimeEnd = useCallback(async () => {
    if (!pendingEvent || !selectedMachine) return;
    await repository.createEvent({
      event_type: 'downtime_end',
      timestamp: nowMs(),
      related_event_id: pendingEvent.related_event_id,
    });
    setShowConfirmModal(false);
    setPendingEvent(null);
    setSnackbarMessage('Paro cerrado');
    setSnackbarVisible(true);
  }, [pendingEvent, selectedMachine, repository]);

  // ─── Generic Confirm ─────────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    const type = pendingEvent?.event_type;
    if (type === 'shift_end') {
      executeShiftEnd();
    } else if (type === 'downtime_start') {
      executeDowntimeStart();
    } else if (type === 'downtime_end') {
      executeDowntimeEnd();
    }
  }, [pendingEvent, executeShiftEnd, executeDowntimeStart, executeDowntimeEnd]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  const currentHour = records.length > 0 ? records[records.length - 1] : null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            Línea de Empaque
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {shiftStarted ? 'Turno Activo' : 'Sin turno activo'}
          </Text>
        </View>

        <Divider style={styles.divider} />

        {/* Cadence Banner */}
        {cadenceDue && (
          <View style={styles.cadenceBanner}>
            <Text variant="bodyMedium" style={styles.cadenceBannerText}>
              ⏰ {cadenceElapsedMin.toFixed(0)} min sin registro — ingrese producción de la hora actual
            </Text>
          </View>
        )}

        {/* Hourly Summary */}
        {records.length > 0 && (
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Resumen por Hora</Text>
            <DataTable style={styles.table}>
              <DataTable.Header>
                <DataTable.Title>Hora</DataTable.Title>
                <DataTable.Title numeric>Cajas</DataTable.Title>
                <DataTable.Title numeric>Paro (min)</DataTable.Title>
              </DataTable.Header>
              {records.map((rec) => (
                <DataTable.Row key={rec.hour}>
                  <DataTable.Cell>{rec.hour}</DataTable.Cell>
                  <DataTable.Cell numeric>{rec.cajasReales}</DataTable.Cell>
                  <DataTable.Cell numeric>{rec.tiempoMuertoMin > 0 ? rec.tiempoMuertoMin : '-'}</DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          </View>
        )}

        {/* Action Buttons */}
        {!shiftStarted ? (
          <Button
            mode="contained"
            onPress={handleStartShift}
            style={styles.actionButton}
            contentStyle={styles.actionButtonContent}
            icon="play-circle"
          >
            Iniciar Turno
          </Button>
        ) : (
          <View style={styles.actionRow}>
            <Button
              mode="contained"
              onPress={handleRegisterProduction}
              style={[styles.actionButton, styles.actionButtonWide]}
              contentStyle={styles.actionButtonContent}
              icon="package-variant-closed"
            >
              Registrar Producción
            </Button>

            {activeDowntime ? (
              <Button
                mode="contained"
                onPress={handleEndDowntime}
                style={[styles.actionButton, styles.actionButtonWide, { backgroundColor: colors.success }]}
                contentStyle={styles.actionButtonContent}
                icon="stop-circle"
              >
                Cerrar Paro
              </Button>
            ) : (
              <Button
                mode="contained"
                onPress={handleStartDowntime}
                style={[styles.actionButton, styles.actionButtonWide, { backgroundColor: colors.error }]}
                contentStyle={styles.actionButtonContent}
                icon="pause-circle"
              >
                Registrar Paro
              </Button>
            )}

            <Button
              mode="outlined"
              onPress={handleEndShift}
              style={styles.actionButton}
              contentStyle={styles.actionButtonContent}
              icon="flag-checkered"
            >
              Cerrar Turno
            </Button>
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      <StopReasonModal
        visible={showStopModal}
        onDismiss={() => setShowStopModal(false)}
        onSelectReason={handleSelectStopReason}
      />

      <ConfirmEventModal
        visible={showConfirmModal}
        onDismiss={() => { setShowConfirmModal(false); setPendingEvent(null); }}
        onConfirm={handleConfirm}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmLabel}
      />

      <NumpadModal
        visible={showProductionModal}
        title="Registrar Cajas"
        onDismiss={() => setShowProductionModal(false)}
        onSubmit={handleProductionSubmit}
      />

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

// ─── Styles ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGray,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontWeight: typography.weights.bold,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  divider: {
    marginVertical: spacing.sm,
  },
  cadenceBanner: {
    backgroundColor: colors.surfaceWarning,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  cadenceBannerText: {
    color: colors.textWarning,
    textAlign: 'center',
    fontWeight: typography.weights.medium,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  table: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
  },
  actionRow: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  actionButtonWide: {
    minWidth: '100%',
  },
  actionButtonContent: {
    minHeight: touchTarget.minHeight,
  },
  snackbar: {
    marginBottom: spacing.md,
    marginHorizontal: spacing.md,
  },
});
