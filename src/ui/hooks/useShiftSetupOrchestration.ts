/**
 * useShiftSetupOrchestration — Form state, validation, and save for shift setup.
 *
 * Pattern: Hook Extraction (Container/Presentational)
 * Why:
 * - Post-reconciliation: shift_type dropdown, planned_boxes, product_code.
 * - No more supervisor_id, notes, shift_id picker, line_id.
 * - On mount: loads active operators from repository.
 * - save() validates SM-3 (findActiveByMachine) then creates session.
 *
 * Returns:
 * - operators: IOperator[] — active operators for selection
 * - operatorId, shiftType, plannedBoxes, productCode — form state
 * - setOperator, setShiftType, setPlannedBoxes, setProductCode — setters
 * - save: () => Promise<void> — validates and creates session
 * - isValid: boolean — all required fields filled
 * - error: string | null — validation or save error
 * - saving: boolean — true while save is in progress
 */

import { useState, useEffect, useCallback } from 'react';

import { useOperatorsRepository } from '../../repositories/useOperatorsRepository';
import { useShiftSessionsRepository } from '../../repositories/useShiftSessionsRepository';
import { useCatalogStore } from '../store/catalogStore';
import { nowMs } from '../../utils/timestamp';
import type { IOperator, ShiftType } from '../../core/types';

export function useShiftSetupOrchestration() {
  const operatorsRepo = useOperatorsRepository();
  const shiftSessionsRepo = useShiftSessionsRepository();

  // ─── Global context ─────────────────────────────────────────────────────────
  const selectedMachine = useCatalogStore((s) => s.selectedMachine);

  // ─── Operators list ─────────────────────────────────────────────────────────
  const [operators, setOperators] = useState<IOperator[]>([]);

  useEffect(() => {
    let isMounted = true;
    operatorsRepo.findActive().then((docs) => {
      if (isMounted) {
        setOperators(docs.map((d) => d.toJSON() as IOperator));
      }
    });
    return () => {
      isMounted = false;
    };
  }, [operatorsRepo]);

  // ─── Form state ─────────────────────────────────────────────────────────────
  const [operatorId, setOperatorId] = useState<string | null>(null);
  const [shiftType, setShiftType] = useState<ShiftType>('matutino');
  const [plannedBoxes, setPlannedBoxes] = useState(480);
  const [productCode, setProductCode] = useState('');

  // ─── Validation ─────────────────────────────────────────────────────────────
  const isValid =
    !!selectedMachine &&
    !!operatorId &&
    plannedBoxes > 0;

  // ─── Error / saving ─────────────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Save ───────────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (!isValid) {
      setError('Complete todos los campos requeridos');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // SM-3: Check if there's already an active session for this machine
      const activeSession = await shiftSessionsRepo.findActiveByMachine(
        selectedMachine!,
      );
      if (activeSession) {
        setError('Ya hay un turno activo para esta máquina');
        setSaving(false);
        return;
      }

      await shiftSessionsRepo.create({
        created_at: nowMs(),
        machine_id: selectedMachine!,
        operator_id: operatorId!,
        shift_type: shiftType,
        planned_boxes: plannedBoxes,
        product_code: productCode || undefined,
        started_at: nowMs(),
        status: 'active',
      });
    } catch (e: any) {
      setError(e?.message ?? 'Error al crear el turno');
    } finally {
      setSaving(false);
    }
  }, [
    isValid,
    selectedMachine,
    operatorId,
    shiftType,
    plannedBoxes,
    productCode,
    shiftSessionsRepo,
  ]);

  // ─── Setters ────────────────────────────────────────────────────────────────
  const setOperator = useCallback((id: string | null) => {
    setOperatorId(id);
  }, []);

  const setShiftTypeValue = useCallback((st: ShiftType) => {
    setShiftType(st);
  }, []);

  const setPlannedBoxesValue = useCallback((value: number) => {
    setPlannedBoxes(value);
  }, []);

  const setProductCodeValue = useCallback((code: string) => {
    setProductCode(code);
  }, []);

  return {
    operators,
    operatorId,
    shiftType,
    plannedBoxes,
    productCode,
    setOperator,
    setShiftType: setShiftTypeValue,
    setPlannedBoxes: setPlannedBoxesValue,
    setProductCode: setProductCodeValue,
    save,
    isValid,
    error,
    saving,
  } as const;
}
