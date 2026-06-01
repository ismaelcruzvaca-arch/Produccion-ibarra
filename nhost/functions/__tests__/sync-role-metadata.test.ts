// Integration test: sync-role-metadata Nhost Function
//
// Tests the webhook/trigger flow:
// 1. Valid webhook call with operator role → 200, sets metadata correctly
// 2. Valid webhook call with admin role → includes all roles in allowedRoles
// 3. Invalid webhook secret → returns 401
// 4. Missing userId/role → returns 400
//
// This test imports the handler from ../sync-role-metadata.ts (PR #1)
// and mocks fetch to avoid calling the real Management API.
//
// Run with: deno test --allow-env --allow-net nhost/functions/__tests__/

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import handler from "../sync-role-metadata.ts";

// ─── Test Infrastructure ──────────────────────────────────────

interface FetchCall {
  url: string;
  method: string;
  body: Record<string, unknown>;
}

/** Resets env vars before each test to avoid cross-test pollution. */
function setEnv(env: Record<string, string>): void {
  // Deno.env.set may throw if the env var is read-only in restricted mode.
  // We wrap in try/catch to keep tests running in constrained environments.
  for (const [key, value] of Object.entries(env)) {
    try {
      Deno.env.set(key, value);
    } catch {
      // ignore — env var may be read-only in this context
    }
  }
}

const fetchCalls: FetchCall[] = [];

/** Installs a mock fetch that captures calls and returns a controlled response. */
function installMockFetch(responseStatus = 200, responseBody = "OK"): void {
  fetchCalls.length = 0;
  const original = globalThis.fetch;

  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.href
      : input.url;
    const bodyStr = typeof init?.body === "string" ? init.body : "{}";
    fetchCalls.push({
      url,
      method: (init?.method as string) ?? "GET",
      body: JSON.parse(bodyStr),
    });
    return Promise.resolve(new Response(responseBody, { status: responseStatus }));
  }) as typeof globalThis.fetch;

  // Return teardown function
  return function restore() {
    globalThis.fetch = original;
    fetchCalls.length = 0;
  };
}

/** Creates a Hasura Event Trigger payload. */
function createEventPayload(overrides: {
  userId?: string;
  role?: string;
  fullName?: string;
  op?: "INSERT" | "UPDATE";
} = {}): unknown {
  return {
    event: {
      session_variables: { "x-hasura-role": "admin" },
      op: overrides.op ?? "INSERT",
      data: {
        new: {
          id: overrides.userId ?? "00000000-0000-0000-0000-000000000001",
          role: overrides.role ?? "operator",
          full_name: overrides.fullName ?? "Test User",
        },
        old: null,
      },
    },
    created_at: "2026-06-01T00:00:00Z",
    id: "evt-001",
    delivery_info: { current_retry: 1, max_retries: 3 },
    trigger: { name: "sync_operator_role_to_metadata" },
    table: { schema: "public", name: "operator_profiles" },
  };
}

/** Creates a mock Request calling the Nhost Function endpoint. */
function postEvent(body: unknown, extraHeaders: Record<string, string> = {}): Request {
  return new Request("http://localhost/v1/functions/sync-role-metadata", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": "test-webhook-secret",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

function assertMetadataPatchCall(
  call: FetchCall,
  expectedUserId: string,
  expectedRole: string,
  expectedAllowedRoles: string[],
): void {
  assertEquals(call.method, "PATCH");
  assertEquals(call.url, `https://admin.nhost.dev/v1/auth/users/${expectedUserId}`);
  const meta = call.body.metadata as Record<string, unknown>;
  assertEquals(meta.role, expectedRole);
  assertEquals(meta.allowedRoles, expectedAllowedRoles);
}

// ─── Test Cases ───────────────────────────────────────────────

Deno.test({
  name: "1. Valid webhook with operator role → returns 200 and sets role + allowedRoles metadata",
  async fn() {
    setEnv({
      NHOST_WEBHOOK_SECRET: "test-webhook-secret",
      NHOST_BACKEND_URL: "https://admin.nhost.dev/v1",
      NHOST_ADMIN_SECRET: "test-admin-secret",
    });
    const restore = installMockFetch();

    try {
      const req = postEvent(createEventPayload({ role: "operator", userId: "user-op-001" }));
      const response = await handler(req);

      assertEquals(response.status, 200);
      const body = await response.json();
      assertEquals(body.success, true);
      assertEquals(body.role, "operator");

      assertEquals(fetchCalls.length, 1, "should call Management API exactly once");
      assertMetadataPatchCall(fetchCalls[0], "user-op-001", "operator", ["operator"]);
    } finally {
      restore();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "2. Valid webhook with admin role → includes all roles in allowedRoles",
  async fn() {
    setEnv({
      NHOST_WEBHOOK_SECRET: "test-webhook-secret",
      NHOST_BACKEND_URL: "https://admin.nhost.dev/v1",
      NHOST_ADMIN_SECRET: "test-admin-secret",
    });
    const restore = installMockFetch();

    try {
      const req = postEvent(createEventPayload({ role: "admin", userId: "user-adm-001" }));
      const response = await handler(req);

      assertEquals(response.status, 200);
      const body = await response.json();
      assertEquals(body.success, true);
      assertEquals(body.role, "admin");

      assertEquals(fetchCalls.length, 1, "should call Management API exactly once");
      assertMetadataPatchCall(fetchCalls[0], "user-adm-001", "admin", ["admin", "supervisor", "operator"]);
    } finally {
      restore();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "3. Invalid webhook secret → returns 401",
  async fn() {
    setEnv({
      NHOST_WEBHOOK_SECRET: "test-webhook-secret",
      NHOST_BACKEND_URL: "https://admin.nhost.dev/v1",
      NHOST_ADMIN_SECRET: "test-admin-secret",
    });
    const restore = installMockFetch();

    try {
      const req = postEvent(
        createEventPayload(),
        // Override with WRONG secret
        { "x-webhook-secret": "wrong-secret" },
      );
      const response = await handler(req);

      assertEquals(response.status, 401);
      // No Management API call should have been made
      assertEquals(fetchCalls.length, 0, "should NOT call Management API with bad secret");
    } finally {
      restore();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "4. Missing webhook secret header → returns 401",
  async fn() {
    setEnv({
      NHOST_WEBHOOK_SECRET: "test-webhook-secret",
      NHOST_BACKEND_URL: "https://admin.nhost.dev/v1",
      NHOST_ADMIN_SECRET: "test-admin-secret",
    });
    const restore = installMockFetch();

    try {
      // No x-webhook-secret header at all
      const req = new Request("http://localhost/v1/functions/sync-role-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createEventPayload()),
      });
      const response = await handler(req);

      assertEquals(response.status, 401);
      assertEquals(fetchCalls.length, 0, "should NOT call Management API");
    } finally {
      restore();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "5. Missing userId in payload → returns 400",
  async fn() {
    setEnv({
      NHOST_WEBHOOK_SECRET: "test-webhook-secret",
      NHOST_BACKEND_URL: "https://admin.nhost.dev/v1",
      NHOST_ADMIN_SECRET: "test-admin-secret",
    });
    const restore = installMockFetch();

    try {
      // Payload without event.data.new.id
      const badPayload = {
        event: {
          op: "INSERT",
          data: {
            new: { role: "operator" }, // no id
            old: null,
          },
        },
        trigger: { name: "sync_operator_role_to_metadata" },
        table: { schema: "public", name: "operator_profiles" },
      };

      const req = postEvent(badPayload);
      const response = await handler(req);

      assertEquals(response.status, 400);
      assertEquals(fetchCalls.length, 0, "should NOT call Management API");
    } finally {
      restore();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "6. Missing role in payload → returns 400",
  async fn() {
    setEnv({
      NHOST_WEBHOOK_SECRET: "test-webhook-secret",
      NHOST_BACKEND_URL: "https://admin.nhost.dev/v1",
      NHOST_ADMIN_SECRET: "test-admin-secret",
    });
    const restore = installMockFetch();

    try {
      // Payload without event.data.new.role
      const badPayload = {
        event: {
          op: "INSERT",
          data: {
            new: { id: "user-001" }, // no role
            old: null,
          },
        },
        trigger: { name: "sync_operator_role_to_metadata" },
        table: { schema: "public", name: "operator_profiles" },
      };

      const req = postEvent(badPayload);
      const response = await handler(req);

      assertEquals(response.status, 400);
      assertEquals(fetchCalls.length, 0, "should NOT call Management API");
    } finally {
      restore();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "7. Management API returns 5xx → function returns 502 and retries",
  async fn() {
    setEnv({
      NHOST_WEBHOOK_SECRET: "test-webhook-secret",
      NHOST_BACKEND_URL: "https://admin.nhost.dev/v1",
      NHOST_ADMIN_SECRET: "test-admin-secret",
    });
    // Mock fetch to return 500 (simulate Management API failure)
    const restore = installMockFetch(500, "Internal Server Error");

    try {
      const req = postEvent(createEventPayload({ role: "operator", userId: "user-retry-001" }));
      const response = await handler(req);

      // Function should retry and eventually return 502
      assertEquals(response.status, 502);

      // Should have attempted 3 retries (1 initial + 2 retries based on retry config)
      // The function should try 3 times with exponential backoff
      assertEquals(fetchCalls.length, 3, "should retry 3 times on Management API failure");

      // All calls should be PATCH to the same user
      for (const call of fetchCalls) {
        assertEquals(call.url, "https://admin.nhost.dev/v1/auth/users/user-retry-001");
        assertEquals(call.method, "PATCH");
        const meta = call.body.metadata as Record<string, unknown>;
        assertEquals(meta.role, "operator");
        assertEquals(meta.allowedRoles, ["operator"]);
      }
    } finally {
      restore();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
