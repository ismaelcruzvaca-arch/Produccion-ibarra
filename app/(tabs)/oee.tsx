/**
 * OEE tab — delegates to the OeeScreen organism.
 *
 * Tablet-optimized for industrial use:
 * - Touch targets ≥56 dp
 * - Context-aware dashboard (Operando vs Paro Activo)
 * - Two-step stop reason selection
 * - Shift end blocker when downtime is active
 *
 * Architecture: Thin Container (Hook + Presentational)
 * All state orchestration delegated to useOeeScreenOrchestration().
 * This file only wires the hook return values to child components.
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Portal, Dialog, Snackbar } from 'react-native-paper';

import { useOeeScreenOrchestration } from '../../src/ui/hooks/useOeeScreenOrchestration';
import { OeeDashboard } from '../../src/ui/components/OeeDashboard';
import { StopReasonModal } from '../../src/ui/components/modals/StopReasonModal';
import { ConfirmEventModal } from '../../src/ui/components/ConfirmEventModal';
import { NumpadModal } from '../../src/ui/components/NumpadModal';
import { OeeSelectorBar } from '../../src/ui/components/OeeSelectorBar';

export default function OeeScreen() {
  const {
    shiftStarted,
    activeDowntime,
    metrics,
    showStopModal,
    showConfirmModal,
    confirmTitle,
    confirmMessage,
    confirmLabel,
    showShiftBlocker,
    showProductionModal,
    snackbarVisible,
    snackbarMessage,
    isIotMachine,
    handleStartShift,
    handleEndShift,
    handleStartDowntime,
    handleSelectStopReason,
    handleEndDowntime,
    handleRegisterProduction,
    handleNumpadSubmit,
    handleConfirm,
    setShowStopModal,
    setShowConfirmModal,
    setShowShiftBlocker,
    setShowProductionModal,
    setSnackbarVisible,
  } = useOeeScreenOrchestration();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <OeeSelectorBar />
        {/* Validation gate — blocks interactions when selectors are invalid */}
        <View pointerEvents="auto" style={{ flex: 1 }}>
          <OeeDashboard
            isActiveDowntime={!!activeDowntime}
            activeDowntimeEvent={activeDowntime}
            metrics={metrics}
            onRegisterProduction={handleRegisterProduction}
            onStartDowntime={handleStartDowntime}
            onEndDowntime={handleEndDowntime}
            onStartShift={handleStartShift}
            onEndShift={handleEndShift}
            shiftStarted={shiftStarted}
            isIotMachine={isIotMachine}
          />
        </View>
      </ScrollView>

      <StopReasonModal
        visible={showStopModal}
        onDismiss={() => setShowStopModal(false)}
        onSelectReason={handleSelectStopReason}
      />

      <ConfirmEventModal
        visible={showConfirmModal}
        onDismiss={() => {
          setShowConfirmModal(false);
        }}
        onConfirm={handleConfirm}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmLabel}
      />

      <NumpadModal
        visible={showProductionModal}
        title="Registrar Producción"
        onDismiss={() => setShowProductionModal(false)}
        onSubmit={handleNumpadSubmit}
      />

      <Portal>
        <Dialog visible={showShiftBlocker} onDismiss={() => setShowShiftBlocker(false)}>
          <Dialog.Icon icon="alert" />
          <Dialog.Title>Paro Activo</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              No puede cerrar turno con un paro activo. Cierre el paro primero.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowShiftBlocker(false)}>Entendido</Button>
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
  scrollContent: {
    padding: 16,
    flexGrow: 1,
  },
  snackbar: {
    marginBottom: 16,
    marginHorizontal: 16,
  },
});
