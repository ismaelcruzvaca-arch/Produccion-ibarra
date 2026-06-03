/**
 * Nhost Function: admin-manage-user
 * ===================================
 *
 * Admin-only endpoint to create auth users via the Management API.
 * Follows the same pattern as sync-role-metadata.ts.
 *
 * Accepts POST with:
 *   { email, password, displayName, role, allowedRoles }
 *
 * Validates that the caller has the admin role, then calls the
 * Nhost Auth Management API to create the user with metadata.
 *
 * Environment variables (set via nhost secrets):
 *   NHOST_ADMIN_SECRET   — Management API admin secret
 *   NHOST_BACKEND_URL    — Base URL of the Nhost backend
 *
 * Response on success:
 *   { success: true, userId, email }
 *
 * Response on failure:
 *   { success: false, error, status, elapsed }
 */

// ─── Error helpers ────────────────────────────────────────────────────────────

const ERR_UNAUTHORIZED = 'Unauthorized';
const ERR_VALIDATION = 'Validation';
const ERR_CONFIG = 'Config';
const ERR_UPSTREAM = 'Upstream';

class HttpError extends Error {
  status: number;
  constructor(message: string, status: number, category: string) {
    super(`[${category}] ${message}`);
    this.status = status;
    this.name = 'HttpError';
  }
}

function getErrorStatus(err: unknown): number {
  if (err instanceof HttpError) return err.status;
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes(ERR_UPSTREAM)) return 502;
  if (msg.includes(ERR_UNAUTHORIZED)) return 401;
  if (msg.includes(ERR_VALIDATION)) return 400;
  if (msg.includes(ERR_CONFIG)) return 500;
  return 500;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateUserPayload {
  email: string;
  password: string;
  displayName: string;
  role: string;
  allowedRoles: string[];
}

interface CreateUserResponse {
  id: string;
  email: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts and validates the payload from the inbound POST request.
 */
async function extractPayload(req: Request): Promise<CreateUserPayload> {
  if (req.method !== 'POST') {
    throw new HttpError(
      `Method ${req.method} not allowed. Use POST.`,
      405,
      ERR_VALIDATION,
    );
  }

  const body = await req.json();

  const { email, password, displayName, role, allowedRoles } = body;

  if (!email || typeof email !== 'string') {
    throw new HttpError(
      'Missing or invalid field: email (string required)',
      400,
      ERR_VALIDATION,
    );
  }

  if (!password || typeof password !== 'string') {
    throw new HttpError(
      'Missing or invalid field: password (string required)',
      400,
      ERR_VALIDATION,
    );
  }

  if (!displayName || typeof displayName !== 'string') {
    throw new HttpError(
      'Missing or invalid field: displayName (string required)',
      400,
      ERR_VALIDATION,
    );
  }

  if (!role || typeof role !== 'string') {
    throw new HttpError(
      'Missing or invalid field: role (string required)',
      400,
      ERR_VALIDATION,
    );
  }

  const roles = allowedRoles ?? [role];
  if (!Array.isArray(roles) || roles.length === 0) {
    throw new HttpError(
      'Missing or invalid field: allowedRoles (non-empty array required)',
      400,
      ERR_VALIDATION,
    );
  }

  return { email, password, displayName, role, allowedRoles: roles };
}

/**
 * Validates that the caller has the admin role.
 *
 * Uses request.user.defaultRole (set by Nhost from the JWT claims).
 * Falls back to x-hasura-role header if defaultRole is not available.
 */
function validateAdminRole(req: Request): void {
  // Nhost sets request.user on authenticated requests
  const user = (req as Record<string, unknown>).user as
    | { defaultRole?: string }
    | undefined;

  if (user?.defaultRole === 'admin') {
    return;
  }

  // Fallback: check x-hasura-role header (useful when called via Hasura proxy)
  const hasuraRole = req.headers.get('x-hasura-role');
  if (hasuraRole === 'admin') {
    return;
  }

  throw new HttpError(
    'Admin role required. Only admins can create users.',
    403,
    ERR_UNAUTHORIZED,
  );
}

/**
 * Calls the Nhost Auth Management API to create a user.
 * Retries on failure with exponential backoff (2^attempt seconds).
 */
async function createAuthUser(
  payload: CreateUserPayload,
  adminSecret: string,
  backendUrl: string,
  maxRetries = 3,
): Promise<CreateUserResponse> {
  const url = `${backendUrl}/auth/users`;

  const body = JSON.stringify({
    email: payload.email,
    password: payload.password,
    display_name: payload.displayName,
    metadata: {
      role: payload.role,
      allowedRoles: payload.allowedRoles,
    },
  });

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hasura-admin-secret': adminSecret,
        },
        body,
      });

      if (response.ok) {
        const result = await response.json();
        const userId = result.id ?? result.user?.id;
        const email = result.email ?? result.user?.email ?? payload.email;

        if (!userId) {
          throw new HttpError(
            `Management API returned success but no user ID: ${JSON.stringify(result)}`,
            502,
            ERR_UPSTREAM,
          );
        }

        console.log(
          `[admin-manage-user] Created user ${userId} (${email}) with role=${payload.role}`,
        );

        return { id: userId, email };
      }

      const errorText = await response.text();
      lastError = new Error(
        `Management API returned ${response.status}: ${errorText}`,
      );

      // 409 Conflict = user already exists — no point retrying
      if (response.status === 409) {
        console.warn(
          `[admin-manage-user] User ${payload.email} already exists.`,
        );
        throw new HttpError(
          `User already exists: ${payload.email}`,
          409,
          ERR_VALIDATION,
        );
      }

      // 4xx client errors — no point retrying (except 409 handled above)
      if (response.status >= 400 && response.status < 500) {
        throw new HttpError(
          `Management API rejected request: ${response.status} ${errorText}`,
          response.status,
          ERR_UPSTREAM,
        );
      }
    } catch (err) {
      if (err instanceof HttpError) throw err; // re-throw known errors
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    if (attempt < maxRetries) {
      const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      console.warn(
        `[admin-manage-user] Attempt ${attempt}/${maxRetries} failed. Retrying in ${delayMs}ms...`,
        lastError?.message,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new HttpError(
    lastError?.message ?? `Failed to create user after ${maxRetries} attempts`,
    502,
    ERR_UPSTREAM,
  );
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async (req: Request): Promise<Response> => {
  const startTime = Date.now();

  try {
    // Only accept POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          error: `Method ${req.method} not allowed. Use POST.`,
        }),
        { status: 405, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Validate admin role
    validateAdminRole(req);

    // Parse and validate the payload
    const payload = await extractPayload(req);

    // Resolve env vars
    const adminSecret = Deno.env.get('NHOST_ADMIN_SECRET');
    if (!adminSecret) {
      throw new HttpError('NHOST_ADMIN_SECRET not set', 500, ERR_CONFIG);
    }

    const backendUrl = Deno.env.get('NHOST_BACKEND_URL');
    if (!backendUrl) {
      throw new HttpError('NHOST_BACKEND_URL not set', 500, ERR_CONFIG);
    }

    // Create the auth user via Management API
    const created = await createAuthUser(payload, adminSecret, backendUrl);

    const elapsed = Date.now() - startTime;
    console.log(
      `[admin-manage-user] Completed in ${elapsed}ms: userId=${created.id}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        userId: created.id,
        email: created.email,
        elapsed,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const elapsed = Date.now() - startTime;
    const status = getErrorStatus(err);

    console.error(`[admin-manage-user] ${status} Error after ${elapsed}ms: ${message}`);

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        elapsed,
        status,
      }),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};
