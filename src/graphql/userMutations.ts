/**
 * Typed GraphQL mutation documents and fetch helpers for user management.
 *
 * Pattern: Mutation Constants + Async Fetch Functions (mirrors catalogMutations.ts)
 * Why:
 * - Mutation strings are defined as constants (template literals) for reuse by
 *   both direct fetch calls and UI event handlers.
 * - Async helpers wrap nhost.graphql.request() with timeout and error handling.
 * - User management spans 3 tables: operator_profiles, user_line_assignments,
 *   and user_plants.
 *
 * Usage:
 *   const users = await getAllUsers();
 *   const id = await insertOperatorProfile({ id: userId, full_name: '...', role: 'operator' });
 *
 * @see catalogMutations.ts for the established pattern
 * @see design.md for the mutation contract
 */

import { nhost } from './nhostClient';
import { withTimeout } from './withTimeout';

// ─── Timeout ───────────────────────────────────────────────────────────────────

/** Default timeout for user management mutations. */
const USER_MGMT_TIMEOUT_MS = 8_000;

// ─── Helper ─────────────────────────────────────────────────────────────────────

/**
 * Returns the current user ID from the Nhost session, or null if not available.
 * Used to populate `assigned_by` on assignment insert mutations.
 */
function getCurrentUserId(): string | null {
  const session = nhost.getUserSession();
  if (!session?.user) return null;
  return (session.user as Record<string, unknown>).id as string ?? null;
}

// ─── Queries ───────────────────────────────────────────────────────────────────

/** Fetch all operator profiles with their line and plant assignments. */
export const GET_ALL_USERS = `
  query GetAllUsers {
    operator_profiles(order_by: { full_name: asc }) {
      id
      full_name
      role
      user_line_assignments {
        line_id
      }
      user_plants {
        plant_id
        role
        is_primary
      }
    }
  }
` as const;

export interface UserLineAssignment {
  line_id: string;
}

export interface UserPlant {
  plant_id: string;
  role: string;
  is_primary: boolean;
}

export interface OperatorProfileWithAssignments {
  id: string;
  full_name: string | null;
  role: string;
  user_line_assignments: UserLineAssignment[];
  user_plants: UserPlant[];
}

export interface GetAllUsersResponse {
  operator_profiles: OperatorProfileWithAssignments[];
}

/**
 * Fetches all operator profiles with their line and plant assignments.
 * Returns the full list or null on error.
 */
export async function getAllUsers(): Promise<OperatorProfileWithAssignments[] | null> {
  try {
    const res = await withTimeout(
      nhost.graphql.request<GetAllUsersResponse>(GET_ALL_USERS),
      USER_MGMT_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[userMutations] getAllUsers GraphQL error:', res.error.message);
      return null;
    }
    return res.data?.operator_profiles ?? null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[userMutations] getAllUsers failed:', message);
    return null;
  }
}

// ─── Operator Profile Mutations ──────────────────────────────────────────────

/** Insert a new operator profile. */
export const INSERT_OPERATOR_PROFILE = `
  mutation InsertOperatorProfile($object: operator_profiles_insert_input!) {
    insert_operator_profiles_one(object: $object) { id }
  }
` as const;

/** Update an existing operator profile by primary key. */
export const UPDATE_OPERATOR_PROFILE = `
  mutation UpdateOperatorProfile($id: uuid!, $set: operator_profiles_set_input!) {
    update_operator_profiles_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
` as const;

/** Input shape for inserting an operator profile. */
export interface InsertOperatorProfileInput {
  id: string;        // auth.users.id (same as userId from Nhost Function)
  full_name: string;
  role: string;
}

/**
 * Inserts an operator profile row with the given user ID, full name, and role.
 * Returns the inserted record's ID or null on error.
 */
export async function insertOperatorProfile(vars: InsertOperatorProfileInput): Promise<string | null> {
  try {
    const res = await withTimeout(
      nhost.graphql.request<{ insert_operator_profiles_one: { id: string } }>(
        INSERT_OPERATOR_PROFILE,
        { object: { ...vars } },
      ),
      USER_MGMT_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[userMutations] insertOperatorProfile GraphQL error:', res.error.message);
      return null;
    }
    return res.data?.insert_operator_profiles_one?.id ?? null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[userMutations] insertOperatorProfile failed:', message);
    return null;
  }
}

/** Input shape for updating an operator profile (all fields optional). */
export interface UpdateOperatorProfileInput {
  full_name?: string;
  role?: string;
}

/**
 * Updates an operator profile by ID.
 * Returns `true` if a row was updated, `false` on error or if no row matched.
 */
export async function updateOperatorProfile(
  id: string,
  vars: UpdateOperatorProfileInput,
): Promise<boolean> {
  try {
    const res = await withTimeout(
      nhost.graphql.request<{ update_operator_profiles_by_pk: { id: string } | null }>(
        UPDATE_OPERATOR_PROFILE,
        { id, set: { ...vars } },
      ),
      USER_MGMT_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[userMutations] updateOperatorProfile GraphQL error:', res.error.message);
      return false;
    }
    return !!res.data?.update_operator_profiles_by_pk;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[userMutations] updateOperatorProfile failed:', message);
    return false;
  }
}

// ─── User Line Assignment Mutations ──────────────────────────────────────────

/** Insert a new user line assignment. */
export const INSERT_USER_LINE_ASSIGNMENT = `
  mutation InsertUserLineAssignment($object: user_line_assignments_insert_input!) {
    insert_user_line_assignments_one(object: $object) { user_id line_id }
  }
` as const;

/** Delete a user line assignment by composite primary key. */
export const DELETE_USER_LINE_ASSIGNMENT = `
  mutation DeleteUserLineAssignment($user_id: uuid!, $line_id: uuid!) {
    delete_user_line_assignments_by_pk(user_id: $user_id, line_id: $line_id) { user_id line_id }
  }
` as const;

/** Input shape for inserting a user line assignment. */
export interface InsertUserLineAssignmentInput {
  user_id: string;
  line_id: string;
  assigned_by?: string;
}

/**
 * Inserts a user line assignment.
 * Returns `true` if successful, `false` on error.
 */
export async function insertUserLineAssignment(vars: InsertUserLineAssignmentInput): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    const res = await withTimeout(
      nhost.graphql.request<{ insert_user_line_assignments_one: { user_id: string; line_id: string } }>(
        INSERT_USER_LINE_ASSIGNMENT,
        { object: { ...vars, assigned_by: vars.assigned_by ?? userId } },
      ),
      USER_MGMT_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[userMutations] insertUserLineAssignment GraphQL error:', res.error.message);
      return false;
    }
    return !!res.data?.insert_user_line_assignments_one;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[userMutations] insertUserLineAssignment failed:', message);
    return false;
  }
}

/**
 * Deletes a user line assignment by user_id and line_id.
 * Returns `true` if deleted, `false` on error or if no row matched.
 */
export async function deleteUserLineAssignment(userId: string, lineId: string): Promise<boolean> {
  try {
    const res = await withTimeout(
      nhost.graphql.request<{ delete_user_line_assignments_by_pk: { user_id: string; line_id: string } | null }>(
        DELETE_USER_LINE_ASSIGNMENT,
        { user_id: userId, line_id: lineId },
      ),
      USER_MGMT_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[userMutations] deleteUserLineAssignment GraphQL error:', res.error.message);
      return false;
    }
    return !!res.data?.delete_user_line_assignments_by_pk;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[userMutations] deleteUserLineAssignment failed:', message);
    return false;
  }
}

// ─── User Plant Mutations ────────────────────────────────────────────────────

/** Insert a new user plant assignment. */
export const INSERT_USER_PLANT = `
  mutation InsertUserPlant($object: user_plants_insert_input!) {
    insert_user_plants_one(object: $object) { user_id plant_id }
  }
` as const;

/** Update a user plant assignment by composite primary key. */
export const UPDATE_USER_PLANT = `
  mutation UpdateUserPlant($user_id: uuid!, $plant_id: uuid!, $set: user_plants_set_input!) {
    update_user_plants_by_pk(pk_columns: { user_id: $user_id, plant_id: $plant_id }, _set: $set) { user_id plant_id }
  }
` as const;

/** Input shape for inserting a user plant. */
export interface InsertUserPlantInput {
  user_id: string;
  plant_id: string;
  role?: string;
  is_primary?: boolean;
  assigned_by?: string;
}

/**
 * Inserts a user plant assignment.
 * Returns `true` if successful, `false` on error.
 */
export async function insertUserPlant(vars: InsertUserPlantInput): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    const res = await withTimeout(
      nhost.graphql.request<{ insert_user_plants_one: { user_id: string; plant_id: string } }>(
        INSERT_USER_PLANT,
        { object: { ...vars, assigned_by: vars.assigned_by ?? userId } },
      ),
      USER_MGMT_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[userMutations] insertUserPlant GraphQL error:', res.error.message);
      return false;
    }
    return !!res.data?.insert_user_plants_one;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[userMutations] insertUserPlant failed:', message);
    return false;
  }
}

/** Input shape for updating a user plant (all fields optional). */
export interface UpdateUserPlantInput {
  role?: string;
  is_primary?: boolean;
}

/**
 * Updates a user plant assignment by composite key.
 * Returns `true` if a row was updated, `false` on error.
 */
export async function updateUserPlant(
  userId: string,
  plantId: string,
  vars: UpdateUserPlantInput,
): Promise<boolean> {
  try {
    const res = await withTimeout(
      nhost.graphql.request<{ update_user_plants_by_pk: { user_id: string; plant_id: string } | null }>(
        UPDATE_USER_PLANT,
        { user_id: userId, plant_id: plantId, set: { ...vars } },
      ),
      USER_MGMT_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[userMutations] updateUserPlant GraphQL error:', res.error.message);
      return false;
    }
    return !!res.data?.update_user_plants_by_pk;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[userMutations] updateUserPlant failed:', message);
    return false;
  }
}

// ─── Nhost Function Helper ───────────────────────────────────────────────────

/**
 * Result returned by the admin-manage-user Nhost Function.
 */
export interface AdminManageUserResult {
  success: boolean;
  userId?: string;
  email?: string;
  error?: string;
  status?: number;
  elapsed?: number;
}

/**
 * Calls the admin-manage-user Nhost Function to create an auth user.
 *
 * Uses `nhost.functions.call()` which automatically includes auth headers.
 * The function is deployed as a serverless Deno endpoint that calls the
 * Nhost Auth Management API (POST `/auth/users`) with the admin secret.
 *
 * @see nhost/functions/admin-manage-user.ts
 */
export async function adminManageUser(payload: {
  email: string;
  password?: string;
  displayName: string;
  role: string;
  allowedRoles?: string[];
}): Promise<AdminManageUserResult> {
  try {
    const res = await withTimeout(
      nhost.functions.call<AdminManageUserResult>('admin-manage-user', payload),
      USER_MGMT_TIMEOUT_MS,
    ) as { data?: AdminManageUserResult; error?: { message: string } };

    if (res.error) {
      return { success: false, error: res.error.message };
    }

    return res.data ?? { success: false, error: 'No response data' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[userMutations] adminManageUser failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Generates a dummy email for operators without corporate email.
 * Pattern: operario-{shortId}@ibarra.local
 * The server-side function will reject duplicates (409 Conflict)
 * if the email already exists.
 */
export function generateOperatorDummyEmail(): string {
  const shortId = Math.random().toString(36).substring(2, 8);
  return `operario-${shortId}@ibarra.local`;
}

/**
 * Helper: creates a complete user (auth + profile + assignments) in one flow.
 *
 * Steps:
 * 1. Call admin-manage-user Nhost Function to create the auth user
 * 2. Insert operator_profiles row
 * 3. Insert user_line_assignments rows
 * 4. Insert user_plants row (if plantId provided)
 *
 * Returns the new userId on success, or null on failure.
 */
export async function createFullUser(params: {
  email?: string;
  fullName: string;
  role: string;
  lineIds?: string[];
  plantId?: string;
}): Promise<string | null> {
  const { fullName, role, lineIds, plantId } = params;
  const email = params.email || generateOperatorDummyEmail();
  const password = 'Ibarra2026$';
  const allowedRoles = [role];

  // Step 1: Create auth user via Nhost Function
  const funcResult = await adminManageUser({
    email,
    password,
    displayName: fullName,
    role,
    allowedRoles,
  });

  if (!funcResult.success || !funcResult.userId) {
    console.warn('[userMutations] createFullUser: admin-manage-user failed:', funcResult.error);
    return null;
  }

  const userId = funcResult.userId;

  // Step 2: Insert operator profile
  const profileId = await insertOperatorProfile({
    id: userId,
    full_name: fullName,
    role,
  });

  if (!profileId) {
    console.warn('[userMutations] createFullUser: insertOperatorProfile failed');
    return null;
  }

  // Step 3: Insert line assignments
  if (lineIds && lineIds.length > 0) {
    for (const lineId of lineIds) {
      const ok = await insertUserLineAssignment({
        user_id: userId,
        line_id: lineId,
      });
      if (!ok) {
        console.warn(`[userMutations] createFullUser: insertUserLineAssignment(${lineId}) failed`);
      }
    }
  }

  // Step 4: Insert plant assignment
  if (plantId) {
    await insertUserPlant({
      user_id: userId,
      plant_id: plantId,
      role,
      is_primary: true,
    });
  }

  return userId;
}
