/**
 * Nhost Function: sync-role-metadata
 * ====================================
 *
 * Syncs operator_profiles.role → auth.users.metadata on INSERT/UPDATE.
 *
 * Called by:
 *   - Hasura Event Trigger (POST): standard Hasura event payload
 *   - Direct admin (PATCH): body { userId, role }
 *
 * Flow:
 *   1. Parse the inbound request (POST = Hasura event | PATCH = direct)
 *   2. Validate x-webhook-secret header
 *   3. Determine allowedRoles from the new role
 *   4. PATCH the Nhost Auth Management API to update user metadata
 *   5. Retry up to 3 times with exponential backoff on failure
 *
 * Environment variables (set via nhost secrets):
 *   NHOST_ADMIN_SECRET   — Management API admin secret
 *   NHOST_WEBHOOK_SECRET — Shared secret for webhook validation
 *   NHOST_BACKEND_URL    — Base URL of the Nhost backend
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface SyncPayload {
  userId: string;
  role: string;
}

/**
 * Maps a role to its allowed roles array for x-hasura-allowed-roles.
 * Higher roles inherit lower roles so users can scope down if needed.
 */
function getAllowedRoles(role: string): string[] {
  switch (role) {
    case 'admin':
      return ['admin', 'supervisor', 'operator'];
    case 'supervisor':
      return ['supervisor', 'operator'];
    case 'operator':
    default:
      return ['operator'];
  }
}

/**
 * Extracts { userId, role } from the inbound request.
 * Supports two formats:
 *   - Hasura Event Trigger POST:  { event: { data: { new: { id, role } } } }
 *   - Direct PATCH:              { userId, role }
 */
async function extractPayload(req: Request): Promise<SyncPayload> {
  const body = await req.json();

  // Direct PATCH format: { userId, role }
  if (req.method === 'PATCH' && body.userId && body.role) {
    return { userId: body.userId, role: body.role };
  }

  // Hasura Event Trigger format
  const event = body.event;
  if (!event || !event.data || !event.data.new) {
    throw new Error(
      'Unrecognized payload format. Expected Hasura event { event: { data: { new: { id, role } } } } ' +
      'or direct PATCH { userId, role }',
    );
  }

  const { id, role } = event.data.new;
  if (!id || !role) {
    throw new Error(
      `Missing fields in event.data.new: id=${id}, role=${role}`,
    );
  }

  return { userId: id, role };
}

/**
 * Calls the Nhost Auth Management API to update user metadata.
 * Retries on failure with exponential backoff (2^attempt seconds).
 */
async function syncRoleToMetadata(
  userId: string,
  role: string,
  allowedRoles: string[],
  adminSecret: string,
  backendUrl: string,
  maxRetries = 3,
): Promise<void> {
  const url = `${backendUrl}/auth/users/${userId}`;
  const body = JSON.stringify({
    metadata: {
      role,
      allowedRoles,
    },
  });

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-hasura-admin-secret': adminSecret,
        },
        body,
      });

      if (response.ok) {
        console.log(
          `[sync-role-metadata] Updated metadata for user ${userId}: role=${role}, allowedRoles=${JSON.stringify(allowedRoles)}`,
        );
        return;
      }

      const errorText = await response.text();
      lastError = new Error(
        `Management API returned ${response.status}: ${errorText}`,
      );

      if (response.status === 404) {
        // User not found — no point retrying
        console.error(
          `[sync-role-metadata] User ${userId} not found in auth.users. Skipping retry.`,
        );
        return;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    if (attempt < maxRetries) {
      const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      console.warn(
        `[sync-role-metadata] Attempt ${attempt}/${maxRetries} failed. Retrying in ${delayMs}ms...`,
        lastError?.message,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError ?? new Error(`Failed to sync role after ${maxRetries} attempts`);
}

/**
 * Validates the webhook secret from the request header.
 */
function validateWebhookSecret(req: Request, expectedSecret: string): void {
  if (!expectedSecret) {
    // No secret configured — skip validation (graceful fallback)
    console.warn(
      '[sync-role-metadata] NHOST_WEBHOOK_SECRET not set — skipping validation',
    );
    return;
  }

  const provided = req.headers.get('x-webhook-secret');
  if (provided !== expectedSecret) {
    console.error(
      `[sync-role-metadata] Invalid webhook secret (provided: ${provided ? '***' : 'none'})`,
    );
    throw new Error('Unauthorized: invalid webhook secret');
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async (req: Request): Promise<Response> => {
  const startTime = Date.now();

  try {
    // Only accept POST (Hasura Event Trigger) or PATCH (direct call)
    if (req.method !== 'POST' && req.method !== 'PATCH') {
      return new Response(
        JSON.stringify({
          error: `Method ${req.method} not allowed. Use POST (Event Trigger) or PATCH (direct).`,
        }),
        { status: 405, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Validate webhook secret (optional — skipped if env var not set)
    const webhookSecret = Deno.env.get('NHOST_WEBHOOK_SECRET') ?? '';
    validateWebhookSecret(req, webhookSecret);

    // Parse the payload
    const { userId, role } = await extractPayload(req);

    // Resolve allowed roles
    const allowedRoles = getAllowedRoles(role);

    // Sync to auth.users metadata via Management API
    const adminSecret = Deno.env.get('NHOST_ADMIN_SECRET');
    if (!adminSecret) {
      throw new Error('NHOST_ADMIN_SECRET environment variable is not set');
    }

    const backendUrl = Deno.env.get('NHOST_BACKEND_URL');
    if (!backendUrl) {
      throw new Error('NHOST_BACKEND_URL environment variable is not set');
    }

    await syncRoleToMetadata(userId, role, allowedRoles, adminSecret, backendUrl);

    const elapsed = Date.now() - startTime;
    console.log(
      `[sync-role-metadata] Completed in ${elapsed}ms for user ${userId}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        role,
        allowedRoles,
        elapsed,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const elapsed = Date.now() - startTime;

    console.error(`[sync-role-metadata] Error after ${elapsed}ms: ${message}`);

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        elapsed,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};
