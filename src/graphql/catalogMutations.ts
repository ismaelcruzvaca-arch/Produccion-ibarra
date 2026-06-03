/**
 * Typed GraphQL mutation documents and fetch helpers for catalog CRUD.
 *
 * Pattern: Mutation Constants + Async Fetch Functions (mirrors gateway/queries.ts)
 * Why:
 * - Mutation strings are defined as constants (template literals) for reuse by
 *   both direct fetch calls and UI event handlers.
 * - Async helpers wrap nhost.graphql.request() with timeout and error handling,
 *   returning a simple boolean so callers don't need to parse GraphQL responses.
 * - Each mutation sets `updated_by` to the current user ID for audit tracking.
 *   The column exists on all catalog tables (see migration 009_catalog_audit_columns.sql).
 *
 * Usage:
 *   const ok = await insertStopReason({ code: 'SR-01', label: '...', ... });
 *   if (!ok) { /* handle error *\/ }
 *
 * @see design.md for the mutation contract
 */

import { nhost } from './nhostClient';
import { withTimeout } from './withTimeout';

// ─── Timeout ───────────────────────────────────────────────────────────────────

/** Default timeout for catalog mutations. */
const CATALOG_TIMEOUT_MS = 8_000;

// ─── Helper ─────────────────────────────────────────────────────────────────────

/**
 * Returns the current user ID from the Nhost session, or null if not available.
 * Used to populate `updated_by` on every insert/update mutation for audit tracking.
 */
function getCurrentUserId(): string | null {
  const session = nhost.getUserSession();
  if (!session?.user) return null;
  return (session.user as Record<string, unknown>).id as string ?? null;
}

// ─── Stop Reason Mutations ──────────────────────────────────────────────────────

/** Insert a new stop reason. */
export const INSERT_STOP_REASON = `
  mutation InsertStopReason($object: stop_reasons_insert_input!) {
    insert_stop_reasons_one(object: $object) { id }
  }
` as const;

/** Update an existing stop reason by primary key. */
export const UPDATE_STOP_REASON = `
  mutation UpdateStopReason($id: uuid!, $set: stop_reasons_set_input!) {
    update_stop_reasons_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
` as const;

/** Delete a stop reason by primary key. */
export const DELETE_STOP_REASON = `
  mutation DeleteStopReason($id: uuid!) {
    delete_stop_reasons_by_pk(id: $id) { id }
  }
` as const;

/** Input shape for inserting a stop reason. */
export interface InsertStopReasonInput {
  code: string;
  label: string;
  category: string;
  macro: string;
  stops_line: boolean;
  sort_order: number;
}

/**
 * Inserts a stop reason with the current user set as `updated_by`.
 * Returns `true` if the mutation succeeded, `false` on error.
 */
export async function insertStopReason(vars: InsertStopReasonInput): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    const res = await withTimeout(
      nhost.graphql.request<{ insert_stop_reasons_one: { id: string } }>(
        INSERT_STOP_REASON,
        { object: { ...vars, updated_by: userId } },
      ),
      CATALOG_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[catalogMutations] insertStopReason GraphQL error:', res.error.message);
      return false;
    }
    return !!res.data?.insert_stop_reasons_one;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[catalogMutations] insertStopReason failed:', message);
    return false;
  }
}

/** Input shape for updating a stop reason (all fields optional except id). */
export interface UpdateStopReasonInput {
  code?: string;
  label?: string;
  category?: string;
  macro?: string;
  stops_line?: boolean;
  sort_order?: number;
}

/**
 * Updates a stop reason by ID with the current user set as `updated_by`.
 * Returns `true` if a row was updated, `false` on error or if no row matched.
 */
export async function updateStopReason(
  id: string,
  vars: UpdateStopReasonInput,
): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    const res = await withTimeout(
      nhost.graphql.request<{ update_stop_reasons_by_pk: { id: string } | null }>(
        UPDATE_STOP_REASON,
        { id, set: { ...vars, updated_by: userId } },
      ),
      CATALOG_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[catalogMutations] updateStopReason GraphQL error:', res.error.message);
      return false;
    }
    return !!res.data?.update_stop_reasons_by_pk;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[catalogMutations] updateStopReason failed:', message);
    return false;
  }
}

/**
 * Deletes a stop reason by ID.
 * Returns `true` if a row was deleted, `false` on error or if no row matched.
 */
export async function deleteStopReason(id: string): Promise<boolean> {
  try {
    const res = await withTimeout(
      nhost.graphql.request<{ delete_stop_reasons_by_pk: { id: string } | null }>(
        DELETE_STOP_REASON,
        { id },
      ),
      CATALOG_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[catalogMutations] deleteStopReason GraphQL error:', res.error.message);
      return false;
    }
    return !!res.data?.delete_stop_reasons_by_pk;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[catalogMutations] deleteStopReason failed:', message);
    return false;
  }
}

// ─── Line Mutations ─────────────────────────────────────────────────────────────

/** Insert a new production line. */
export const INSERT_LINE = `
  mutation InsertLine($object: lines_insert_input!) {
    insert_lines_one(object: $object) { id }
  }
` as const;

/** Update an existing line by primary key. */
export const UPDATE_LINE = `
  mutation UpdateLine($id: uuid!, $set: lines_set_input!) {
    update_lines_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
` as const;

/** Delete a line by primary key. */
export const DELETE_LINE = `
  mutation DeleteLine($id: uuid!) {
    delete_lines_by_pk(id: $id) { id }
  }
` as const;

/** Input shape for inserting a line. */
export interface InsertLineInput {
  name: string;
  description?: string;
}

/**
 * Inserts a line with the current user set as `updated_by`.
 * Returns `true` if the mutation succeeded, `false` on error.
 */
export async function insertLine(vars: InsertLineInput): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    const res = await withTimeout(
      nhost.graphql.request<{ insert_lines_one: { id: string } }>(
        INSERT_LINE,
        { object: { ...vars, updated_by: userId } },
      ),
      CATALOG_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[catalogMutations] insertLine GraphQL error:', res.error.message);
      return false;
    }
    return !!res.data?.insert_lines_one;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[catalogMutations] insertLine failed:', message);
    return false;
  }
}

/** Input shape for updating a line (all fields optional). */
export interface UpdateLineInput {
  name?: string;
  description?: string;
}

/**
 * Updates a line by ID with the current user set as `updated_by`.
 * Returns `true` if a row was updated, `false` on error or if no row matched.
 */
export async function updateLine(id: string, vars: UpdateLineInput): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    const res = await withTimeout(
      nhost.graphql.request<{ update_lines_by_pk: { id: string } | null }>(
        UPDATE_LINE,
        { id, set: { ...vars, updated_by: userId } },
      ),
      CATALOG_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[catalogMutations] updateLine GraphQL error:', res.error.message);
      return false;
    }
    return !!res.data?.update_lines_by_pk;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[catalogMutations] updateLine failed:', message);
    return false;
  }
}

/**
 * Deletes a line by ID.
 * Returns `true` if a row was deleted, `false` on error or if no row matched.
 */
export async function deleteLine(id: string): Promise<boolean> {
  try {
    const res = await withTimeout(
      nhost.graphql.request<{ delete_lines_by_pk: { id: string } | null }>(
        DELETE_LINE,
        { id },
      ),
      CATALOG_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[catalogMutations] deleteLine GraphQL error:', res.error.message);
      return false;
    }
    return !!res.data?.delete_lines_by_pk;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[catalogMutations] deleteLine failed:', message);
    return false;
  }
}

// ─── Machine Mutations ──────────────────────────────────────────────────────────

/** Insert a new machine. */
export const INSERT_MACHINE = `
  mutation InsertMachine($object: machines_insert_input!) {
    insert_machines_one(object: $object) { id }
  }
` as const;

/** Update an existing machine by primary key. */
export const UPDATE_MACHINE = `
  mutation UpdateMachine($id: uuid!, $set: machines_set_input!) {
    update_machines_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
` as const;

/** Delete a machine by primary key. */
export const DELETE_MACHINE = `
  mutation DeleteMachine($id: uuid!) {
    delete_machines_by_pk(id: $id) { id }
  }
` as const;

/** Input shape for inserting a machine. */
export interface InsertMachineInput {
  line_id: string;
  name: string;
  description?: string;
}

/**
 * Inserts a machine with the current user set as `updated_by`.
 * Returns `true` if the mutation succeeded, `false` on error.
 */
export async function insertMachine(vars: InsertMachineInput): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    const res = await withTimeout(
      nhost.graphql.request<{ insert_machines_one: { id: string } }>(
        INSERT_MACHINE,
        { object: { ...vars, updated_by: userId } },
      ),
      CATALOG_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[catalogMutations] insertMachine GraphQL error:', res.error.message);
      return false;
    }
    return !!res.data?.insert_machines_one;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[catalogMutations] insertMachine failed:', message);
    return false;
  }
}

/** Input shape for updating a machine (all fields optional except id). */
export interface UpdateMachineInput {
  line_id?: string;
  name?: string;
  description?: string;
}

/**
 * Updates a machine by ID with the current user set as `updated_by`.
 * Returns `true` if a row was updated, `false` on error or if no row matched.
 */
export async function updateMachine(
  id: string,
  vars: UpdateMachineInput,
): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    const res = await withTimeout(
      nhost.graphql.request<{ update_machines_by_pk: { id: string } | null }>(
        UPDATE_MACHINE,
        { id, set: { ...vars, updated_by: userId } },
      ),
      CATALOG_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[catalogMutations] updateMachine GraphQL error:', res.error.message);
      return false;
    }
    return !!res.data?.update_machines_by_pk;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[catalogMutations] updateMachine failed:', message);
    return false;
  }
}

/**
 * Deletes a machine by ID.
 * Returns `true` if a row was deleted, `false` on error or if no row matched.
 */
export async function deleteMachine(id: string): Promise<boolean> {
  try {
    const res = await withTimeout(
      nhost.graphql.request<{ delete_machines_by_pk: { id: string } | null }>(
        DELETE_MACHINE,
        { id },
      ),
      CATALOG_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[catalogMutations] deleteMachine GraphQL error:', res.error.message);
      return false;
    }
    return !!res.data?.delete_machines_by_pk;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[catalogMutations] deleteMachine failed:', message);
    return false;
  }
}

// ─── Product Mutations ──────────────────────────────────────────────────────────

/** Insert a new product. */
export const INSERT_PRODUCT = `
  mutation InsertProduct($object: products_insert_input!) {
    insert_products_one(object: $object) { id }
  }
` as const;

/** Update an existing product by primary key. */
export const UPDATE_PRODUCT = `
  mutation UpdateProduct($id: uuid!, $set: products_set_input!) {
    update_products_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
` as const;

/** Delete a product by primary key. */
export const DELETE_PRODUCT = `
  mutation DeleteProduct($id: uuid!) {
    delete_products_by_pk(id: $id) { id }
  }
` as const;

/** Input shape for inserting a product. */
export interface InsertProductInput {
  code: string;
  name: string;
  theoretical_ppm?: number;
}

/**
 * Inserts a product with the current user set as `updated_by`.
 * Returns `true` if the mutation succeeded, `false` on error.
 */
export async function insertProduct(vars: InsertProductInput): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    const res = await withTimeout(
      nhost.graphql.request<{ insert_products_one: { id: string } }>(
        INSERT_PRODUCT,
        { object: { ...vars, updated_by: userId } },
      ),
      CATALOG_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[catalogMutations] insertProduct GraphQL error:', res.error.message);
      return false;
    }
    return !!res.data?.insert_products_one;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[catalogMutations] insertProduct failed:', message);
    return false;
  }
}

/** Input shape for updating a product (all fields optional). */
export interface UpdateProductInput {
  code?: string;
  name?: string;
  theoretical_ppm?: number;
}

/**
 * Updates a product by ID with the current user set as `updated_by`.
 * Returns `true` if a row was updated, `false` on error or if no row matched.
 */
export async function updateProduct(
  id: string,
  vars: UpdateProductInput,
): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    const res = await withTimeout(
      nhost.graphql.request<{ update_products_by_pk: { id: string } | null }>(
        UPDATE_PRODUCT,
        { id, set: { ...vars, updated_by: userId } },
      ),
      CATALOG_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[catalogMutations] updateProduct GraphQL error:', res.error.message);
      return false;
    }
    return !!res.data?.update_products_by_pk;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[catalogMutations] updateProduct failed:', message);
    return false;
  }
}

/**
 * Deletes a product by ID.
 * Returns `true` if a row was deleted, `false` on error or if no row matched.
 */
export async function deleteProduct(id: string): Promise<boolean> {
  try {
    const res = await withTimeout(
      nhost.graphql.request<{ delete_products_by_pk: { id: string } | null }>(
        DELETE_PRODUCT,
        { id },
      ),
      CATALOG_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[catalogMutations] deleteProduct GraphQL error:', res.error.message);
      return false;
    }
    return !!res.data?.delete_products_by_pk;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[catalogMutations] deleteProduct failed:', message);
    return false;
  }
}

// ─── Shift Mutations ────────────────────────────────────────────────────────────

/** Insert a new shift. */
export const INSERT_SHIFT = `
  mutation InsertShift($object: shifts_insert_input!) {
    insert_shifts_one(object: $object) { id }
  }
` as const;

/** Update an existing shift by primary key. */
export const UPDATE_SHIFT = `
  mutation UpdateShift($id: uuid!, $set: shifts_set_input!) {
    update_shifts_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
` as const;

/** Delete a shift by primary key. */
export const DELETE_SHIFT = `
  mutation DeleteShift($id: uuid!) {
    delete_shifts_by_pk(id: $id) { id }
  }
` as const;

/** Input shape for inserting a shift. */
export interface InsertShiftInput {
  label: string;
  start_hour: number;
  end_hour: number;
}

/**
 * Inserts a shift with the current user set as `updated_by`.
 * Returns `true` if the mutation succeeded, `false` on error.
 */
export async function insertShift(vars: InsertShiftInput): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    const res = await withTimeout(
      nhost.graphql.request<{ insert_shifts_one: { id: string } }>(
        INSERT_SHIFT,
        { object: { ...vars, updated_by: userId } },
      ),
      CATALOG_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[catalogMutations] insertShift GraphQL error:', res.error.message);
      return false;
    }
    return !!res.data?.insert_shifts_one;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[catalogMutations] insertShift failed:', message);
    return false;
  }
}

/** Input shape for updating a shift (all fields optional). */
export interface UpdateShiftInput {
  label?: string;
  start_hour?: number;
  end_hour?: number;
}

/**
 * Updates a shift by ID with the current user set as `updated_by`.
 * Returns `true` if a row was updated, `false` on error or if no row matched.
 */
export async function updateShift(
  id: string,
  vars: UpdateShiftInput,
): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    const res = await withTimeout(
      nhost.graphql.request<{ update_shifts_by_pk: { id: string } | null }>(
        UPDATE_SHIFT,
        { id, set: { ...vars, updated_by: userId } },
      ),
      CATALOG_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[catalogMutations] updateShift GraphQL error:', res.error.message);
      return false;
    }
    return !!res.data?.update_shifts_by_pk;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[catalogMutations] updateShift failed:', message);
    return false;
  }
}

/**
 * Deletes a shift by ID.
 * Returns `true` if a row was deleted, `false` on error or if no row matched.
 */
export async function deleteShift(id: string): Promise<boolean> {
  try {
    const res = await withTimeout(
      nhost.graphql.request<{ delete_shifts_by_pk: { id: string } | null }>(
        DELETE_SHIFT,
        { id },
      ),
      CATALOG_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[catalogMutations] deleteShift GraphQL error:', res.error.message);
      return false;
    }
    return !!res.data?.delete_shifts_by_pk;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[catalogMutations] deleteShift failed:', message);
    return false;
  }
}
