/**
 * useQualityCaptureOrchestration — State machine for quality inspection capture.
 *
 * Pattern: Hook Extraction (Container/Presentational)
 * Why:
 * - Post-reconciliation capture flow:
 *   1. Set inspector_id from auth + shift_type
 *   2. Select disposition (liberado/rechazado/reproceso)
 *   3. If liberado: record weight_logs[]
 *   4. If rechazado/reproceso: record defect_logs[]
 *   5. Confirm and save
 *   6. If NC (rechazado/reproceso): trigger signature capture for traceability
 * - Weight validation against product_weight_standards via sku
 * - Free-text defect_type (no catalog lookup)
 *
 * NC Signature flow (F-AC-46):
 *   After confirm() saves a NC inspection, pendingNcSignature is set to true.
 *   The UI should show SignaturePrompt, then call signNcInspection() to create
 *   the signature in the signatures collection before navigating away.
 *
 * Returns:
 * - inspector_id, shift_type, disposition
 * - defectLogs: IDefectLog[] — inline defect entries
 * - weightLogs: IWeightLog[] — inline weight entries
 * - addDefectLog, removeDefectLog, addWeightLog, removeWeightLog
 * - confirm: saves inspection + children
 * - productList for product selection
 * - weightValidation for inline weight checking
 * - pendingNcSignature: true when NC inspection saved and needs signature
 * - signNcInspection: creates the signature in signatures collection
 * - resetSavedInspection: clears the saved state after signing
 */

import { useState, useEffect, useCallback } from 'react';

import { useQualityInspectionsRepository } from '../../repositories/useQualityInspectionsRepository';
import { useDefectLogsRepository } from '../../repositories/useDefectLogsRepository';
import { useWeightLogsRepository } from '../../repositories/useWeightLogsRepository';
import { useProductWeightStandardsRepository } from '../../repositories/useProductWeightStandardsRepository';
import { useShiftSessionsRepository } from '../../repositories/useShiftSessionsRepository';
import { useSignaturesRepository } from '../../repositories/useSignaturesRepository';
import { useCatalogStore } from '../store/catalogStore';
import { useProductionFlow } from './useProductionFlow';
import { useAuthStore } from '../../auth/useAuthStore';
import { nowMs } from '../../utils/timestamp';
import { generateUuid } from '../../utils/uuid';
import type {
  IQualityInspection,
  IDefectLog,
  IWeightLog,
  DispositionType,
  ShiftType,
} from '../../core/types';

export function useQualityCaptureOrchestration() {
  const inspectionsRepo = useQualityInspectionsRepository();
  const defectLogsRepo = useDefectLogsRepository();
  const weightLogsRepo = useWeightLogsRepository();
  const weightStandardsRepo = useProductWeightStandardsRepository();
  const shiftSessionsRepo = useShiftSessionsRepository();
  const signaturesRepo = useSignaturesRepository();

  const selectedMachine = useCatalogStore((s) => s.selectedMachine);
  const { shiftSessionId: productionFlowShiftSessionId } = useProductionFlow();
  const user = useAuthStore((s) => s.user) as { id?: string } | null;
  const authRole = useAuthStore((s) => s.role);
  const authName = useAuthStore((s) => s.fullName);
  const operatorId = useAuthStore((s) => s.operatorId);

  // ─── Core form state ────────────────────────────────────────────────────────
  const [inspectorId, setInspectorId] = useState<string>('');
  const [shiftType, setShiftType] = useState<ShiftType>('matutino');
  const [disposition, setDisposition] = useState<DispositionType | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedSku, setSelectedSku] = useState<string | null>(null);

  // ─── Inline children ────────────────────────────────────────────────────────
  const [defectLogs, setDefectLogs] = useState<Omit<IDefectLog, 'id' | 'updated_at' | 'is_deleted' | 'device_id' | 'inspection_id'>[]>([]);
  const [weightLogs, setWeightLogs] = useState<Omit<IWeightLog, 'id' | 'updated_at' | 'is_deleted' | 'device_id' | 'inspection_id'>[]>([]);

  // ─── Loading state for products ─────────────────────────────────────────────
  const [productList, setProductList] = useState<{ sku: string; name: string }[]>([]);

  useEffect(() => {
    // Load product weight standards as the product selector
    weightStandardsRepo.findAllActive().then((standards) => {
      setProductList(standards.map((s) => ({ sku: s.sku, name: s.name })));
    });
  }, [weightStandardsRepo]);

  // ─── Weight validation ──────────────────────────────────────────────────────
  const [weightValidation, setWeightValidation] = useState<{
    valid: boolean;
    message?: string;
  } | null>(null);

  const validateWeight = useCallback(
    async (weight: number) => {
      if (!selectedSku) {
        setWeightValidation(null);
        return;
      }
      const result = await weightStandardsRepo.validateWeight(selectedSku, weight);
      setWeightValidation(result);
    },
    [selectedSku, weightStandardsRepo],
  );

  // ─── Loading / error ────────────────────────────────────────────────────────
  const [loading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Inspector ID from auth on mount ────────────────────────────────────────
  useEffect(() => {
    if (user?.id) {
      setInspectorId(user.id);
    }
  }, [user]);

  // ─── Defect log helpers ─────────────────────────────────────────────────────
  const addDefectLog = useCallback(
    (entry: { severity: IDefectLog['severity']; defect_type: string; defect_count: number }) => {
      setDefectLogs((prev) => [...prev, { ...entry, created_at: nowMs() }]);
    },
    [],
  );

  const removeDefectLog = useCallback((index: number) => {
    setDefectLogs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ─── Weight log helpers ─────────────────────────────────────────────────────
  const addWeightLog = useCallback(
    (entry: { measured_weight: number }) => {
      setWeightLogs((prev) => [...prev, { ...entry, created_at: nowMs() }]);
    },
    [],
  );

  const removeWeightLog = useCallback((index: number) => {
    setWeightLogs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ─── Validation ─────────────────────────────────────────────────────────────
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const isValid = useCallback((): boolean => {
    setValidationMessage(null);

    if (!inspectorId) {
      setValidationMessage('Falta el ID del inspector');
      return false;
    }
    if (!shiftType) {
      setValidationMessage('Seleccione el tipo de turno');
      return false;
    }
    if (!disposition) {
      setValidationMessage('Seleccione una disposición');
      return false;
    }
    if (disposition === 'liberado' && weightLogs.length === 0) {
      setValidationMessage('Agregue al menos un registro de peso');
      return false;
    }
    if ((disposition === 'rechazado' || disposition === 'reproceso') && defectLogs.length === 0) {
      setValidationMessage('Agregue al menos un registro de defecto');
      return false;
    }
    return true;
  }, [inspectorId, shiftType, disposition, weightLogs, defectLogs]);

  // ─── Confirm (save inspection + children) ───────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [savedInspection, setSavedInspection] = useState<IQualityInspection | null>(null);
  const [dataSource] = useState<'vision' | 'manual' | 'hybrid'>('manual');

  // ─── NC Signature state (F-AC-46) ───────────────────────────────────────────
  const [pendingNcSignature, setPendingNcSignature] = useState(false);

  const confirm = useCallback(async (): Promise<IQualityInspection> => {
    if (!isValid()) {
      throw new Error(validationMessage ?? 'Datos incompletos');
    }

    setSaving(true);
    try {
      // 1. Resolve shift session: prefer useProductionFlow (canonical), fallback to DB lookup
      const shiftSessionId = productionFlowShiftSessionId
        ?? (selectedMachine
          ? (await shiftSessionsRepo.findActiveByMachine(selectedMachine))?.get('id') ?? ''
          : '');

      // 2. Create the inspection
      const inspectionDoc = await inspectionsRepo.create({
        created_at: nowMs(),
        machine_id: selectedMachine ?? '',
        inspector_id: inspectorId,
        shift_type: shiftType,
        disposition: disposition!,
        notes: notes || undefined,
        data_source: dataSource,
        inspection_type: '',
        passed: false,
        value: 0,
        unit: '',
        product_id: '',
        line_id: '',
        shift_session_id: shiftSessionId,
        operator_id: '',
      });
      const inspection = inspectionDoc.toJSON() as IQualityInspection;

      // 2. Create child defect_logs
      for (const dl of defectLogs) {
        await defectLogsRepo.create({
          created_at: nowMs(),
          inspection_id: inspection.id,
          severity: dl.severity,
          defect_type: dl.defect_type,
          defect_count: dl.defect_count,
        });
      }

      // 3. Create child weight_logs
      for (const wl of weightLogs) {
        await weightLogsRepo.create({
          created_at: nowMs(),
          inspection_id: inspection.id,
          measured_weight: wl.measured_weight,
        });
      }

      // Reset form
      setDisposition(null);
      setNotes('');
      setSelectedSku(null);
      setDefectLogs([]);
      setWeightLogs([]);
      setWeightValidation(null);
      setValidationMessage(null);
      setSavedInspection(inspection);

      // 4. If NC disposition (rechazado/reproceso), set pending signature flag
      // so the UI shows SignaturePrompt before navigating away (F-AC-46).
      const ncDispositions: DispositionType[] = ['rechazado', 'reproceso'];
      setPendingNcSignature(ncDispositions.includes(disposition!));

      return inspection;
    } finally {
      setSaving(false);
    }
  }, [
    isValid, validationMessage, inspectionsRepo, selectedMachine,
    inspectorId, shiftType, disposition, notes, dataSource,
    defectLogs, weightLogs, defectLogsRepo, weightLogsRepo,
    shiftSessionsRepo,
  ]);

  // ─── Sign NC inspection (creates signature in signatures collection) ─────────

  const signNcInspection = useCallback(async (): Promise<boolean> => {
    if (!savedInspection) return false;
    if (!authRole || !operatorId || !authName) return false;

    try {
      await signaturesRepo.create({
        document_type: 'quality_inspection',
        document_id: savedInspection.id,
        signer_id: operatorId,
        signer_name: authName,
        signer_role: authRole,
        sequence: 1,
      });
      return true;
    } catch (err) {
      console.warn('[QualityCapture] Failed to create NC signature:', err);
      return false;
    }
  }, [savedInspection, authRole, operatorId, authName, signaturesRepo]);

  // ─── Reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setDisposition(null);
    setNotes('');
    setSelectedSku(null);
    setDefectLogs([]);
    setWeightLogs([]);
    setWeightValidation(null);
    setValidationMessage(null);
    setSavedInspection(null);
    setPendingNcSignature(false);
  }, []);

  const resetSavedInspection = useCallback(() => {
    setSavedInspection(null);
    setPendingNcSignature(false);
  }, []);

  // ─── Context exposed for UI display ─────────────────────────────────────────
  const machineId = selectedMachine;
  const shiftSessionId = productionFlowShiftSessionId;

  return {
    // Context
    machineId,
    shiftSessionId,

    // Form state
    inspectorId,
    shiftType,
    disposition,
    notes,
    selectedSku,

    // Children
    defectLogs,
    weightLogs,

    // Data sources
    productList,

    // Validation
    weightValidation,
    validationMessage,
    saving,
    loading,
    error,
    savedInspection,

    // Setters
    setInspectorId,
    setShiftType,
    setDisposition,
    setNotes,
    setSelectedSku,

    // Child actions
    addDefectLog,
    removeDefectLog,
    addWeightLog,
    removeWeightLog,
    validateWeight,

    // Actions
    confirm,
    reset,
    signNcInspection,
    resetSavedInspection,

    // NC signature state
    pendingNcSignature,
  } as const;
}
