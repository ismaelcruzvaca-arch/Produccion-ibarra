/**
 * useShiftSetupOrchestration — Operator assignment flow for auto-created shifts.
 *
 * Pattern: Hook Extraction (Container/Presentational)
 * Why:
 * - Post-turno-automatico: sessions are created by the scheduler, not this form.
 * - On mount: loads active operators AND detects active session for selected machine.
 * - assignOperator(sessionId, operatorId) updates the session's operator.
 * - forceStart() creates a session bypassing the calendar (supervisor override).
 *
 * Returns:
 * - operators: IOperator[] — active operators for selection
 * - operatorId, setOperator — selection state
 * - assignOperator: (sessionId: string, operatorId: string) => Promise<void>
 * - forceStart: () => Promise<void> — supervisor override (AD-5)
 * - activeSession: IShiftSession | null — detected active session
 * - loading: boolean — initial data load
 * - error: string | null — error state
 * - assigning: boolean — true while assign is in progress
 * - forcing: boolean — true while force start is in progress
 * - isSupervisor: boolean — whether current user can force-start
 */

import { useState, useEffect, useCallback } from 'react';

import { useAuthStore } from '../../auth/useAuthStore';
import { useOperatorsRepository } from '../../repositories/useOperatorsRepository';
import { useShiftSessionsRepository } from '../../repositories/useShiftSessionsRepository';
import { useCatalogStore } from '../store/catalogStore';
import { nowMs } from '../../utils/timestamp';
import type { IOperator, IShiftSession } from '../../core/types';

export function useShiftSetupOrchestration() {
  const operatorsRepo = useOperatorsRepository();
  const shiftSessionsRepo = useShiftSessionsRepository();

  // ─── Global context ─────────────────────────────────────────────────────────
  const selectedMachine = useCatalogStore((s) => s.selectedMachine);
  const userRole = useAuthStore((s) => s.role);

  const isSupervisor = userRole === 'supervisor' || userRole === 'admin';

  // ─── Operators list ─────────────────────────────────────────────────────────
  const [operators, setOperators] = useState<IOperator[]>([]);

  // ─── Active session state ───────────────────────────────────────────────────
  const [activeSession, setActiveSession] = useState<IShiftSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Assignment state ───────────────────────────────────────────────────────
  const [operatorId, setOperatorId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [forcing, setForcing] = useState(false);

  // ─── Load operators + detect active session on mount ────────────────────────
  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const [opDocs, activeSesh] = await Promise.all([
          operatorsRepo.findActive(),
          selectedMachine
            ? shiftSessionsRepo.findActiveByMachine(selectedMachine)
            : Promise.resolve(null),
        ]);

        if (!isMounted) return;

        setOperators(opDocs.map((d) => d.toJSON() as IOperator));
        setActiveSession(
          activeSesh ? (activeSesh.toJSON() as IShiftSession) : null,
        );
      } catch (e: any) {
        if (isMounted) {
          setError(e?.message ?? 'Error al cargar datos del turno');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [operatorsRepo, shiftSessionsRepo, selectedMachine]);

  // ─── Assign operator to active session ──────────────────────────────────────
  const assignOperator = useCallback(
    async (sessionId: string, opId: string) => {
      setAssigning(true);
      setError(null);

      try {
        await shiftSessionsRepo.update(sessionId, { operator_id: opId });

        // Update local state so UI reflects immediately
        setActiveSession((prev) =>
          prev ? { ...prev, operator_id: opId } : prev,
        );
      } catch (e: any) {
        setError(e?.message ?? 'Error al asignar operador');
      } finally {
        setAssigning(false);
      }
    },
    [shiftSessionsRepo],
  );

  // ─── Force start — supervisor override (AD-5) ────────────────────────────────
  const forceStart = useCallback(async () => {
    if (!selectedMachine) return;

    setForcing(true);
    setError(null);

    try {
      const newSession = await shiftSessionsRepo.create({
        machine_id: selectedMachine,
        shift_type: 'matutino',
        started_at: nowMs(),
        status: 'active',
        created_at: nowMs(),
        // operator_id defaults to null — operator assigns after creation
      });

      setActiveSession(newSession.toJSON() as IShiftSession);
    } catch (e: any) {
      setError(e?.message ?? 'Error al forzar inicio del turno');
    } finally {
      setForcing(false);
    }
  }, [selectedMachine, shiftSessionsRepo]);

  // ─── Setters ────────────────────────────────────────────────────────────────
  const setOperator = useCallback((id: string | null) => {
    setOperatorId(id);
  }, []);

  return {
    operators,
    operatorId,
    setOperator,
    assignOperator,
    forceStart,
    activeSession,
    loading,
    error,
    assigning,
    forcing,
    isSupervisor,
  } as const;
}
