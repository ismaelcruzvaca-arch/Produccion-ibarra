/**
 * useSignatures — high-level hook for digital signature operations.
 *
 * Wraps useSignaturesRepository with business logic:
 * - Role validation (FS-5)
 * - Signature chain sequencing (FS-2, FS-9)
 * - Status tracking per document (FS-7)
 *
 * Spec compliance:
 * - FS-1: SHALL tap-to-confirm with signer identity
 * - FS-2: SHALL multiple signer roles in sequence
 * - FS-3: SHALL confirmation dialog before commit
 * - FS-4: SHALL store in shared RxDB signatures collection
 * - FS-5: SHALL validate current role matches required
 * - FS-7: SHALL display signature status per role
 * - FS-8: SHALL register signatures RxDB schema (already done in Phase 1)
 * - FS-9: SHALL 4-signer chains with sequential validation
 * - DS-1: SHALL discriminate document_type
 * - DS-2: SHALL vary signature chain length by document_type
 * - DS-3: SHALL track status: pending, signed, rejected
 */
import { useState, useEffect, useCallback } from 'react';
import { useSignaturesRepository } from '../repositories/useSignaturesRepository';
import { useAuthStore } from '../auth/useAuthStore';
import { nowMs } from '../utils/timestamp';
import type { ISignature } from '../core/types';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type SignatureStatus = 'pending' | 'signed' | 'rejected';

export interface SignatureChainConfig {
  /** Ordered list of roles that must sign in sequence. */
  roles: string[];
  /** Labels for each step in the signature chain. */
  labels: string[];
}

export interface SignatureChainStatus {
  /** Status of each role in the chain. */
  steps: Array<{
    role: string;
    label: string;
    status: SignatureStatus;
    signerName?: string;
    signedAt?: number;
  }>;
  /** Whether the entire chain is complete. */
  isComplete: boolean;
  /** The next role that needs to sign (null if complete). */
  nextRole: string | null;
}

export interface UseSignaturesOptions {
  /** The type of document being signed (e.g., 'quality_inspection', 'oee_report'). */
  documentType: string;
  /** UUID of the document being signed. */
  documentId: string;
  /** Ordered signature chain configuration. */
  chainConfig: SignatureChainConfig;
}

export interface UseSignaturesReturn {
  /** Current signature chain status. */
  status: SignatureChainStatus;
  /** Whether data is loading. */
  isLoading: boolean;
  /** Error message, if any. */
  error: string | null;
  /** Sign the document with the current user's credentials. */
  sign: () => Promise<boolean>;
  /** Refresh signature status from the repository. */
  refresh: () => Promise<void>;
}

// ─── Default Chain Configs ──────────────────────────────────────────────────────

/** Default signature chain configurations per document type. */
export const DEFAULT_CHAINS: Record<string, SignatureChainConfig> = {
  quality_inspection: {
    roles: ['supervisor', 'admin'],
    labels: ['Firma del Supervisor', 'Firma del Admin'],
  },
  oee_report: {
    roles: ['operator', 'programador', 'calidad'],
    labels: ['Firma Operador', 'Firma Programador', 'Firma Calidad'],
  },
  toaster_log: {
    roles: ['operator', 'auxiliar', 'supervisor'],
    labels: ['Firma Operador', 'Firma Auxiliar', 'Firma Jefe Turno'],
  },
  mixing_batch: {
    roles: ['operator', 'supervisor', 'auxiliar', 'admin'],
    labels: ['Firma Operador', 'Firma Jefe Turno', 'Firma Auxiliar', 'Firma Entrega/Recibe'],
  },
  extractor_check: {
    roles: ['operator', 'supervisor'],
    labels: ['Firma Operador', 'Firma Jefe Turno'],
  },
  vitamin_kit: {
    roles: ['operator', 'supervisor', 'verif_produccion', 'verif_calidad'],
    labels: ['Firma Operador', 'Firma Jefe Turno', 'Verif. Producción', 'Verif. Calidad'],
  },
};

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useSignatures({
  documentType,
  documentId,
  chainConfig,
}: UseSignaturesOptions): UseSignaturesReturn {
  const repository = useSignaturesRepository();
  const { role: currentRole, fullName: currentUserName, operatorId } =
    useAuthStore();

  const [existingSignatures, setExistingSignatures] = useState<ISignature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSignatures = useCallback(async () => {
    try {
      const docs = await repository.findByDocument(documentId);
      setExistingSignatures(
        docs.map((doc) => doc.toJSON() as ISignature)
      );
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar firmas');
    } finally {
      setIsLoading(false);
    }
  }, [repository, documentId]);

  useEffect(() => {
    loadSignatures();
  }, [loadSignatures]);

  // Build chain status
  const status: SignatureChainStatus = (() => {
    const steps = chainConfig.roles.map((role, index) => {
      const signed = existingSignatures.find(
        (s) => s.signer_role === role && s.sequence === index + 1
      );
      return {
        role,
        label: chainConfig.labels[index] ?? role,
        status: (signed ? 'signed' : 'pending') as SignatureStatus,
        signerName: signed?.signer_name,
        signedAt: signed?.signed_at,
      };
    });

    const firstPendingIndex = steps.findIndex((s) => s.status === 'pending');
    const isComplete = firstPendingIndex === -1;
    const nextRole = isComplete ? null : steps[firstPendingIndex].role;

    return { steps, isComplete, nextRole };
  })();

  const sign = useCallback(async (): Promise<boolean> => {
    if (!currentRole || !operatorId || !currentUserName) {
      setError('Debe iniciar sesión para firmar');
      return false;
    }

    // Validate role (FS-5)
    const currentStepIndex = chainConfig.roles.findIndex(
      (r) => r === currentRole
    );
    if (currentStepIndex === -1) {
      setError(`Su rol (${currentRole}) no está autorizado para firmar este documento`);
      return false;
    }

    // Validate sequence (FS-9)
    const expectedSequence = currentStepIndex + 1;
    const previousSignatures = existingSignatures.filter(
      (s) => s.sequence < expectedSequence
    );
    const allPreviousSigned =
      previousSignatures.length === currentStepIndex;

    if (!allPreviousSigned) {
      setError('Deben firmar primero los roles anteriores en la cadena');
      return false;
    }

    // Check if already signed
    const alreadySigned = existingSignatures.some(
      (s) => s.signer_role === currentRole && s.sequence === expectedSequence
    );
    if (alreadySigned) {
      setError('Ya ha firmado este documento');
      return false;
    }

    try {
      await repository.create({
        document_type: documentType,
        document_id: documentId,
        signer_id: operatorId,
        signer_name: currentUserName,
        signer_role: currentRole,
        sequence: expectedSequence,
      });

      // Reload signatures
      await loadSignatures();
      setError(null);
      return true;
    } catch (err: any) {
      setError(err?.message ?? 'Error al registrar firma');
      return false;
    }
  }, [
    currentRole,
    operatorId,
    currentUserName,
    chainConfig,
    existingSignatures,
    repository,
    documentType,
    documentId,
    loadSignatures,
  ]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await loadSignatures();
  }, [loadSignatures]);

  return {
    status,
    isLoading,
    error,
    sign,
    refresh,
  };
}
