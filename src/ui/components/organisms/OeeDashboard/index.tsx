/**
 * OeeDashboard — context-aware main dashboard component.
 *
 * Renders different layouts based on machine state:
 * - No shift active    → NoShiftState (Iniciar Turno)
 * - Paro Activo        → ActiveDowntimeState (timer + Fin de Paro)
 * - Operando (normal)  → NormalOperationState (production + metrics)
 *
 * Pattern: Atomic Design — Organism (state composition pattern)
 * Why:
 * - Splits the original 402-line monolith into focused state components.
 * - Each state component is <150 lines.
 *
 * Touch targets ≥56 dp for industrial tablet with gloves.
 */

import React from 'react';
import type { RxDocument } from 'rxdb';
import type { IOeeEvent } from '../../../../core/types';
import type { OeeMetrics } from '../../../../core/oeeCalculator';
import { NoShiftState } from './NoShiftState';
import { ActiveDowntimeState } from './ActiveDowntimeState';
import { NormalOperationState } from './NormalOperationState';

export interface OeeDashboardProps {
  isActiveDowntime: boolean;
  activeDowntimeEvent?: RxDocument<IOeeEvent> | null;
  metrics: OeeMetrics;
  onRegisterProduction: () => void;
  onStartDowntime: () => void;
  onEndDowntime: () => void;
  onStartShift: () => void;
  onEndShift: () => void;
  shiftStarted: boolean;
  isIotMachine?: boolean;
}

export function OeeDashboard({
  isActiveDowntime,
  activeDowntimeEvent,
  metrics,
  onRegisterProduction,
  onStartDowntime,
  onEndDowntime,
  onStartShift,
  onEndShift,
  shiftStarted,
  isIotMachine,
}: OeeDashboardProps) {
  if (!shiftStarted) {
    return <NoShiftState onStartShift={onStartShift} />;
  }

  if (isActiveDowntime) {
    return (
      <ActiveDowntimeState
        activeDowntimeEvent={activeDowntimeEvent ?? null}
        onEndDowntime={onEndDowntime}
      />
    );
  }

  return (
    <NormalOperationState
      metrics={metrics}
      onRegisterProduction={onRegisterProduction}
      onStartDowntime={onStartDowntime}
      onEndShift={onEndShift}
      isIotMachine={isIotMachine}
    />
  );
}
