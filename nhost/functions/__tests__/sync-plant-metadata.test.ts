// Integration test: sync-plant-metadata Nhost Function
//
// Tests the webhook/trigger flow:
// 1. Valid webhook call with plant_id → 200, sets metadata.plant_id correctly
// 2. Invalid webhook secret → returns 401
// 3. Missing user_id in payload → returns 400
// 4. Missing plant_id in payload → returns 400
// 5. Management API returns 5xx → function returns 502 and retries
//
// This test imports the handler from ../sync-plant-metadata.ts
// and mocks fetch to avoid calling the real Management API.
//
// Run with: deno test --allow-env --allow-net nhost/functions/__tests__/

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import handler from "../sync-plant-metadata.ts";

// ─── Test Infrastructure ──────────────────────────────────────

interface FetchCall {
  url: string;
  method: string;
  body: Record<string, unknown>;
}

/** Resets env vars before each test to avoid cross-test pollution. */
function setEnv(env: Record<string, string>): void {
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
function installMockFetch(responseStatus = 200, responseBody = "OK"): () => void {
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

/** Creates a Hasura Event Trigger payload for user_plants. */
function createEventPayload(overrides: {
  userId?: string;
  plantId?: string;
  role?: string;
  isPrimary?: boolean;
  op?: "INSERT" | "UPDATE";
} = {}): unknown {
  return {
    event: {
      session_variables: { "x-hasura-role": "admin" },
      op: overrides.op ?? "INSERT",
      data: {
        new: {
          user_id: overrides.userId ?? "00000000-0000-0000-0000-000000000001",
          plant_id: overrides.plantId ?? "00000000-0000-0000-0000-00000000000a",
          role: overrides.role ?? "operator",
          is_primary: overrides.isPrimary ?? true,
        },
        old: null,
      },
    },
    created_at: "2026-06-01T00:00:00Z",
    id: "evt-plant-001",
    delivery_info: { current_retry: 1, max_retries: 3 },
    trigger: { name: "sync_plant_to_metadata" },
    table: { schema: "public", name: "user_plants" },
  };
}

/** Creates a mock Request calling the Nhost Function endpoint. */
function postEvent(body: unknown, extraHeaders: Record<string, string> = {}): Request {
  return new Request("http://localhost/v1/functions/sync-plant-metadata", {
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
  expectedPlantId: string,
): void {
  assertEquals(call.method, "PATCH");
  assertEquals(call.url, `https://admin.nhost.dev/v1/auth/users/${expectedUserId}`);
  const meta = call.body.metadata as Record<string, unknown>;
  assertEquals(meta.plant_id, expectedPlantId);
}

// ─── Test Cases ───────────────────────────────────────────────

Deno.test({
  name: "1. Valid webhook with plant_id → returns 200 and sets metadata.plant_id",
  async fn() {
    setEnv({
      NHOST_WEBHOOK_SECRET: "test-webhook-secret",
      NHOST_BACKEND_URL: "https://admin.nhost.dev/v1",
      NHOST_ADMIN_SECRET: "test-admin-secret",
    });
    const restore = installMockFetch();

    try {
      const req = postEvent(createEventPayload({
        userId: "user-plant-001",
        plantId: "plant-alpha-001",
      }));
      const response = await handler(req);

      assertEquals(response.status, 200);
      const body = await response.json();
      assertEquals(body.success, true);
      assertEquals(body.plantId, "plant-alpha-001");

      assertEquals(fetchCalls.length, 1, "should call Management API exactly once");
      assertMetadataPatchCall(fetchCalls[0], "user-plant-001", "plant-alpha-001");
    } finally {
      restore();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "2. Invalid webhook secret → returns 401",
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
  name: "3. Missing webhook secret header → returns 401",
  async fn() {
    setEnv({
      NHOST_WEBHOOK_SECRET: "test-webhook-secret",
      NHOST_BACKEND_URL: "https://admin.nhost.dev/v1",
      NHOST_ADMIN_SECRET: "test-admin-secret",
    });
    const restore = installMockFetch();

    try {
      // No x-webhook-secret header at all
      const req = new Request("http://localhost/v1/functions/sync-plant-metadata", {
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
  name: "4. Missing user_id in payload → returns 400",
  async fn() {
    setEnv({
      NHOST_WEBHOOK_SECRET: "test-webhook-secret",
      NHOST_BACKEND_URL: "https://admin.nhost.dev/v1",
      NHOST_ADMIN_SECRET: "test-admin-secret",
    });
    const restore = installMockFetch();

    try {
      // Payload without event.data.new.user_id
      const badPayload = {
        event: {
          op: "INSERT",
          data: {
            new: { plant_id: "plant-001" }, // no user_id
            old: null,
          },
        },
        trigger: { name: "sync_plant_to_metadata" },
        table: { schema: "public", name: "user_plants" },
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
  name: "5. Missing plant_id in payload → returns 400",
  async fn() {
    setEnv({
      NHOST_WEBHOOK_SECRET: "test-webhook-secret",
      NHOST_BACKEND_URL: "https://admin.nhost.dev/v1",
      NHOST_ADMIN_SECRET: "test-admin-secret",
    });
    const restore = installMockFetch();

    try {
      // Payload without event.data.new.plant_id
      const badPayload = {
        event: {
          op: "INSERT",
          data: {
            new: { user_id: "user-001" }, // no plant_id
            old: null,
          },
        },
        trigger: { name: "sync_plant_to_metadata" },
        table: { schema: "public", name: "user_plants" },
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
  name: "6. Management API returns 5xx → function returns 502 and retries",
  async fn() {
    setEnv({
      NHOST_WEBHOOK_SECRET: "test-webhook-secret",
      NHOST_BACKEND_URL: "https://admin.nhost.dev/v1",
      NHOST_ADMIN_SECRET: "test-admin-secret",
    });
    // Mock fetch to return 500 (simulate Management API failure)
    const restore = installMockFetch(500, "Internal Server Error");

    try {
      const req = postEvent(createEventPayload({
        userId: "user-retry-001",
        plantId: "plant-retry-001",
      }));
      const response = await handler(req);

      // Function should retry and eventually return 502
      assertEquals(response.status, 502);

      // Should have attempted 3 retries (1 initial + 2 retries)
      assertEquals(fetchCalls.length, 3, "should retry 3 times on Management API failure");

      // All calls should be PATCH to the same user
      for (const call of fetchCalls) {
        assertEquals(call.url, "https://admin.nhost.dev/v1/auth/users/user-retry-001");
        assertEquals(call.method, "PATCH");
        const meta = call.body.metadata as Record<string, unknown>;
        assertEquals(meta.plant_id, "plant-retry-001");
      }
    } finally {
      restore();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
