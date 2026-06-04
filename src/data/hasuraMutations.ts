/**
 * hasuraMutations — Standalone helper functions for catalog CRUD mutations.
 *
 * Pattern: Standalone helper functions (AD-3)
 * Why:
 * - Not hooks — plain async functions that call nhost.graphql.request() directly.
 * - catalogStore re-fetches after mutation via loadCatalogs().
 * - Each mutation includes updated_at and updated_by for audit trail.
 *
 * Usage:
 *   import { createStopReason } from '../../data/hasuraMutations';
 *   await createStopReason(userId, { code: 'F001', label: 'Falla mecánica' });
 */

import { nhost } from '../graphql/nhostClient';
import { useCatalogStore } from '../ui/store/catalogStore';

// ─── Helpers ───────────────────────────────────────────────────────────────────────

function now(): number {
  return Date.now();
}

function refreshCatalogs(): Promise<void> {
  return useCatalogStore.getState().loadCatalogs();
}

// ═════════════════════════════════════════════════════════════════════════════════
// Stop Reasons
// ═════════════════════════════════════════════════════════════════════════════════

const CREATE_STOP_REASON = `
  mutation CreateStopReason($objects: [stop_reasons_insert_input!]!) {
    insert_stop_reasons(objects: $objects) {
      affected_rows
    }
  }
`;

const UPDATE_STOP_REASON = `
  mutation UpdateStopReason($id: String!, $set: stop_reasons_set_input!) {
    update_stop_reasons(where: { id: { _eq: $id } }, _set: $set) {
      affected_rows
    }
  }
`;

const DEACTIVATE_STOP_REASON = `
  mutation DeactivateStopReason($id: String!, $updatedAt: bigint!, $updatedBy: String!) {
    update_stop_reasons(
      where: { id: { _eq: $id } }
      _set: { is_active: false, updated_at: $updatedAt, updated_by: $updatedBy }
    ) {
      affected_rows
    }
  }
`;

interface StopReasonInput {
  code: string;
  label: string;
  category: string;
  macro: string;
  stops_line: boolean;
  sort_order: number;
}

async function execMutation(query: string, variables: Record<string, unknown>): Promise<void> {
  const res: any = await nhost.graphql.request(query, variables);
  if (res.error) throw new Error(res.error.message);
}

export async function createStopReason(
  userId: string,
  input: StopReasonInput,
): Promise<void> {
  const ts = now();
  await execMutation(CREATE_STOP_REASON, {
    objects: [
      {
        code: input.code,
        label: input.label,
        category: input.category,
        macro: input.macro,
        stops_line: input.stops_line,
        sort_order: input.sort_order,
        is_active: true,
        updated_at: ts,
        updated_by: userId,
      },
    ],
  });
  await refreshCatalogs();
}

export async function updateStopReason(
  userId: string,
  id: string,
  input: Partial<StopReasonInput> & { is_active?: boolean },
): Promise<void> {
  const ts = now();
  await execMutation(UPDATE_STOP_REASON, {
    id,
    set: {
      ...input,
      updated_at: ts,
      updated_by: userId,
    },
  });
  await refreshCatalogs();
}

export async function deactivateStopReason(
  userId: string,
  id: string,
): Promise<void> {
  const ts = now();
  await execMutation(DEACTIVATE_STOP_REASON, {
    id,
    updatedAt: ts,
    updatedBy: userId,
  });
  await refreshCatalogs();
}

// ═════════════════════════════════════════════════════════════════════════════════
// Lines
// ═════════════════════════════════════════════════════════════════════════════════

const CREATE_LINE = `
  mutation CreateLine($objects: [lines_insert_input!]!) {
    insert_lines(objects: $objects) {
      affected_rows
    }
  }
`;

const UPDATE_LINE = `
  mutation UpdateLine($id: String!, $set: lines_set_input!) {
    update_lines(where: { id: { _eq: $id } }, _set: $set) {
      affected_rows
    }
  }
`;

const DEACTIVATE_LINE = `
  mutation DeactivateLine($id: String!, $updatedAt: bigint!, $updatedBy: String!) {
    update_lines(
      where: { id: { _eq: $id } }
      _set: { is_active: false, updated_at: $updatedAt, updated_by: $updatedBy }
    ) {
      affected_rows
    }
  }
`;

interface LineInput {
  name: string;
  description?: string;
}

export async function createLine(
  userId: string,
  input: LineInput,
): Promise<void> {
  const ts = now();
  await execMutation(CREATE_LINE, {
    objects: [
      {
        name: input.name,
        description: input.description ?? null,
        is_active: true,
        updated_at: ts,
        updated_by: userId,
      },
    ],
  });
  await refreshCatalogs();
}

export async function updateLine(
  userId: string,
  id: string,
  input: Partial<LineInput> & { is_active?: boolean },
): Promise<void> {
  const ts = now();
  await execMutation(UPDATE_LINE, {
    id,
    set: {
      ...input,
      updated_at: ts,
      updated_by: userId,
    },
  });
  await refreshCatalogs();
}

export async function deactivateLine(
  userId: string,
  id: string,
): Promise<void> {
  const ts = now();
  await execMutation(DEACTIVATE_LINE, {
    id,
    updatedAt: ts,
    updatedBy: userId,
  });
  await refreshCatalogs();
}

// ═════════════════════════════════════════════════════════════════════════════════
// Machines
// ═════════════════════════════════════════════════════════════════════════════════

const CREATE_MACHINE = `
  mutation CreateMachine($objects: [machines_insert_input!]!) {
    insert_machines(objects: $objects) {
      affected_rows
    }
  }
`;

const UPDATE_MACHINE = `
  mutation UpdateMachine($id: String!, $set: machines_set_input!) {
    update_machines(where: { id: { _eq: $id } }, _set: $set) {
      affected_rows
    }
  }
`;

const DEACTIVATE_MACHINE = `
  mutation DeactivateMachine($id: String!, $updatedAt: bigint!, $updatedBy: String!) {
    update_machines(
      where: { id: { _eq: $id } }
      _set: { is_active: false, updated_at: $updatedAt, updated_by: $updatedBy }
    ) {
      affected_rows
    }
  }
`;

interface MachineInput {
  line_id: string;
  name: string;
  description?: string;
  is_iot_enabled?: boolean;
}

export async function createMachine(
  userId: string,
  input: MachineInput,
): Promise<void> {
  const ts = now();
  await execMutation(CREATE_MACHINE, {
    objects: [
      {
        line_id: input.line_id,
        name: input.name,
        description: input.description ?? null,
        is_iot_enabled: input.is_iot_enabled ?? false,
        is_active: true,
        updated_at: ts,
        updated_by: userId,
      },
    ],
  });
  await refreshCatalogs();
}

export async function updateMachine(
  userId: string,
  id: string,
  input: Partial<MachineInput> & { is_active?: boolean },
): Promise<void> {
  const ts = now();
  await execMutation(UPDATE_MACHINE, {
    id,
    set: {
      ...input,
      updated_at: ts,
      updated_by: userId,
    },
  });
  await refreshCatalogs();
}

export async function deactivateMachine(
  userId: string,
  id: string,
): Promise<void> {
  const ts = now();
  await execMutation(DEACTIVATE_MACHINE, {
    id,
    updatedAt: ts,
    updatedBy: userId,
  });
  await refreshCatalogs();
}
