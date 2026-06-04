/**
 * CMMS Integrator — HTTP client for the oee-trigger Edge Function.
 *
 * Pattern: Service / Adapter
 * Why:
 * - Isolates HTTP communication with cmms-ibero's oee-trigger Edge Function.
 * - Single responsibility: POST { equipment_id, sintoma } with Bearer auth.
 * - Returns typed result (success/error with optional workOrderId).
 *
 * The oee-trigger is a Supabase Edge Function deployed in the cmms-ibero project.
 * It receives equipment_id + sintoma and creates a corrective work order.
 *
 * @see https://github.com/chocolate-ibarra/cmms-ibero/tree/main/supabase/functions/oee-trigger
 */

import { getAuthToken } from '../graphql/nhostClient';

// ─── Configuration ─────────────────────────────────────────────────────────────

/**
 * URL of the oee-trigger Edge Function.
 * Configure via EXPO_PUBLIC env vars.
 * Default points to the staging cmms-ibero project.
 */
export function getOeeTriggerUrl(): string {
  return (
    process.env.EXPO_PUBLIC_OEE_TRIGGER_URL ??
    'https://cmms-ibero-staging.supabase.co/functions/v1/oee-trigger'
  );
}

/**
 * Secret key for authenticating with the oee-trigger Edge Function.
 * This is NOT the user's Nhost token — it's a shared secret between
 * the two Supabase projects.
 */
export function getOeeTriggerSecret(): string {
  return process.env.EXPO_PUBLIC_OEE_TRIGGER_SECRET ?? '';
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CmmsTriggerPayload {
  equipment_id: string;
  sintoma: string;
}

export interface CmmsTriggerResult {
  success: boolean;
  workOrderId?: string;
  error?: string;
}

// ─── Service ───────────────────────────────────────────────────────────────────

/**
 * Sends a trigger to the oee-trigger Edge Function to create a corrective work order.
 *
 * @param payload - The equipment_id and sintoma (description of the issue)
 * @returns CmmsTriggerResult — success with optional workOrderId, or error details
 *
 * @example
 * ```typescript
 * const result = await triggerCorrectiveOT({
 *   equipment_id: 'MC-001',
 *   sintoma: 'FC - Falla de Cavemil - Línea 3',
 * });
 * if (result.success) {
 *   console.log('OT creada:', result.workOrderId);
 * }
 * ```
 */
export async function triggerCorrectiveOT(
  payload: CmmsTriggerPayload,
): Promise<CmmsTriggerResult> {
  const url = getOeeTriggerUrl();
  const secret = getOeeTriggerSecret();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => ({}));

    if (response.ok) {
      return {
        success: true,
        workOrderId: body.id as string | undefined,
      };
    }

    // Non-2xx response
    return {
      success: false,
      error: body.error ?? `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (err: any) {
    // Network failure or timeout
    return {
      success: false,
      error: err?.message ?? 'Error de conexión con el servicio de mantenimiento',
    };
  }
}
