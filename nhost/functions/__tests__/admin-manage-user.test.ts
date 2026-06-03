// Integration test: admin-manage-user Nhost Function
//
// Tests the admin user creation flow:
// 1. Valid admin creates operator → 200, returns userId + email
// 2. Valid admin creates supervisor → sets allowedRoles correctly
// 3. Non-admin caller → returns 403
// 4. Missing email → returns 400
// 5. Missing password → returns 400
// 6. Duplicate email → returns 409
// 7. Management API 5xx → function retries and returns 502
//
// Run with: deno test --allow-env --allow-net nhost/functions/__tests__/

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import handler from "../admin-manage-user.ts";

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
function installMockFetch(responseStatus = 200, responseBody = "{}"): () => void {
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

  return function restore() {
    globalThis.fetch = original;
    fetchCalls.length = 0;
  };
}

/** Creates a POST request to admin-manage-user with a realistic user context. */
function postAsAdmin(
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): Request {
  // Simulate the request.user object Nhost sets for authenticated calls
  const user = { defaultRole: "admin", id: "admin-001" };
  const req = new Request("http://localhost/v1/functions/admin-manage-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  // Nhost sets request.user — this simulates that
  Object.defineProperty(req, "user", { value: user, writable: false });
  return req;
}

function postAsRole(
  role: string,
  body: Record<string, unknown>,
): Request {
  const user = { defaultRole: role, id: "user-001" };
  const req = new Request("http://localhost/v1/functions/admin-manage-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  Object.defineProperty(req, "user", { value: user, writable: false });
  return req;
}

function createOperatorPayload(): Record<string, unknown> {
  return {
    email: "operario001@ibarra.local",
    password: "TempPass123!",
    displayName: "Operario 001",
    role: "operator",
    allowedRoles: ["operator"],
  };
}

function assertCreateUserApiCall(
  call: FetchCall,
  expectedEmail: string,
  expectedRole: string,
  expectedDisplayName: string,
): void {
  assertEquals(call.method, "POST");
  assertEquals(call.url, "https://admin.nhost.dev/v1/auth/users");
  assertEquals(call.body.email, expectedEmail);
  assertEquals(call.body.password, "TempPass123!");
  assertEquals(call.body.display_name, expectedDisplayName);
  const meta = call.body.metadata as Record<string, unknown>;
  assertEquals(meta.role, expectedRole);
}

// ─── Test Cases ───────────────────────────────────────────────

Deno.test({
  name: "1. Admin creates operator → returns 200 with userId and email",
  async fn() {
    setEnv({
      NHOST_BACKEND_URL: "https://admin.nhost.dev/v1",
      NHOST_ADMIN_SECRET: "test-admin-secret",
    });
    const restore = installMockFetch(200, JSON.stringify({
      id: "new-user-uuid-001",
      email: "operario001@ibarra.local",
    }));

    try {
      const req = postAsAdmin(createOperatorPayload());
      const response = await handler(req);

      assertEquals(response.status, 200);
      const body = await response.json();
      assertEquals(body.success, true);
      assertEquals(body.userId, "new-user-uuid-001");
      assertEquals(body.email, "operario001@ibarra.local");

      assertEquals(fetchCalls.length, 1, "should call Management API exactly once");
      assertCreateUserApiCall(fetchCalls[0], "operario001@ibarra.local", "operator", "Operario 001");
    } finally {
      restore();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "2. Admin creates supervisor → sets allowedRoles correctly",
  async fn() {
    setEnv({
      NHOST_BACKEND_URL: "https://admin.nhost.dev/v1",
      NHOST_ADMIN_SECRET: "test-admin-secret",
    });
    const restore = installMockFetch(200, JSON.stringify({
      id: "new-user-uuid-002",
      email: "supervisor@ibarra.com",
    }));

    try {
      const req = postAsAdmin({
        email: "supervisor@ibarra.com",
        password: "SecurePass456!",
        displayName: "Supervisor Uno",
        role: "supervisor",
        allowedRoles: ["supervisor", "operator"],
      });
      const response = await handler(req);

      assertEquals(response.status, 200);
      const body = await response.json();
      assertEquals(body.success, true);
      assertEquals(body.userId, "new-user-uuid-002");

      assertEquals(fetchCalls.length, 1);
      assertCreateUserApiCall(fetchCalls[0], "supervisor@ibarra.com", "supervisor", "Supervisor Uno");
      const meta = fetchCalls[0].body.metadata as Record<string, unknown>;
      assertEquals(meta.allowedRoles, ["supervisor", "operator"]);
    } finally {
      restore();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "3. Non-admin caller (operator) → returns 403",
  async fn() {
    setEnv({
      NHOST_BACKEND_URL: "https://admin.nhost.dev/v1",
      NHOST_ADMIN_SECRET: "test-admin-secret",
    });
    const restore = installMockFetch();

    try {
      const req = postAsRole("operator", createOperatorPayload());
      const response = await handler(req);

      assertEquals(response.status, 403);
      const body = await response.json();
      assertEquals(body.success, false);
      assertEquals(fetchCalls.length, 0, "should NOT call Management API");
    } finally {
      restore();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "4. Missing email → returns 400",
  async fn() {
    setEnv({
      NHOST_BACKEND_URL: "https://admin.nhost.dev/v1",
      NHOST_ADMIN_SECRET: "test-admin-secret",
    });
    const restore = installMockFetch();

    try {
      const req = postAsAdmin({
        password: "TempPass123!",
        displayName: "No Email",
        role: "operator",
        allowedRoles: ["operator"],
      });
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
  name: "5. Missing password → returns 400",
  async fn() {
    setEnv({
      NHOST_BACKEND_URL: "https://admin.nhost.dev/v1",
      NHOST_ADMIN_SECRET: "test-admin-secret",
    });
    const restore = installMockFetch();

    try {
      const req = postAsAdmin({
        email: "test@ibarra.local",
        displayName: "No Password",
        role: "operator",
        allowedRoles: ["operator"],
      });
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
  name: "6. Duplicate email → returns 409",
  async fn() {
    setEnv({
      NHOST_BACKEND_URL: "https://admin.nhost.dev/v1",
      NHOST_ADMIN_SECRET: "test-admin-secret",
    });
    const restore = installMockFetch(409, JSON.stringify({
      error: "user-already-exists",
      message: "User with this email already exists",
    }));

    try {
      const req = postAsAdmin(createOperatorPayload());
      const response = await handler(req);

      assertEquals(response.status, 409);
      const body = await response.json();
      assertEquals(body.success, false);
      // Should have only attempted once — no retry on 409
      assertEquals(fetchCalls.length, 1, "should attempt one call then fail");
    } finally {
      restore();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "7. Management API returns 5xx → function retries and returns 502",
  async fn() {
    setEnv({
      NHOST_BACKEND_URL: "https://admin.nhost.dev/v1",
      NHOST_ADMIN_SECRET: "test-admin-secret",
    });
    const restore = installMockFetch(500, "Internal Server Error");

    try {
      const req = postAsAdmin(createOperatorPayload());
      const response = await handler(req);

      assertEquals(response.status, 502);
      // Should have attempted 3 times
      assertEquals(fetchCalls.length, 3, "should retry 3 times on Management API failure");

      for (const call of fetchCalls) {
        assertEquals(call.url, "https://admin.nhost.dev/v1/auth/users");
        assertEquals(call.method, "POST");
        assertEquals(call.body.email, "operario001@ibarra.local");
      }
    } finally {
      restore();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
