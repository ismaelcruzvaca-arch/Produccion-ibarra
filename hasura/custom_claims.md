# Custom Claims for RBAC in OEE

## Overview

The OEE app injects `operator_profiles.role` into the JWT as Nhost custom claims so Hasura RLS receives the correct `x-hasura-default-role` (`operator`, `supervisor`, or `admin`).

The system WORKS as follows:

```
operator_profiles.role
         │
         ▼
  Hasura Event Trigger (INSERT/UPDATE on role)
         │
         ▼
  Nhost Function: sync-role-metadata
    → PATCH /auth/users/{id} { metadata: { role, allowedRoles } }
         │
         ▼
  auth.users.metadata.role + .allowedRoles updated
         │
         ▼
  Nhost Custom Claims on next JWT issue
    → x-hasura-default-role: metadata.role
    → x-hasura-allowed-roles: metadata.allowedRoles
         │
         ▼
  Frontend reads role from useAuthStore (via fetchOperatorProfile)
```

## JWT Claims

The Nhost JWT includes these Hasura claims after configuration:

| Claim | Source | Example |
|-------|--------|---------|
| `x-hasura-user-id` | Nhost standard (auto-injected) | `74e5f533-...` |
| `x-hasura-default-role` | `user.metadata.role` (custom claim) | `operator` |
| `x-hasura-allowed-roles` | `user.metadata.allowedRoles` (custom claim) | `["operator"]` |

### Token Payload (operator)

```json
{
  "sub": "74e5f533-661f-4e4e-9545-61dc4b4fe76b",
  "https://hasura.io/jwt/claims": {
    "x-hasura-user-id": "74e5f533-661f-4e4e-9545-61dc4b4fe76b",
    "x-hasura-default-role": "operator",
    "x-hasura-allowed-roles": ["operator"]
  }
}
```

### Token Payload (supervisor)

```json
{
  "sub": "uuid-supervisor",
  "https://hasura.io/jwt/claims": {
    "x-hasura-user-id": "uuid-supervisor",
    "x-hasura-default-role": "supervisor",
    "x-hasura-allowed-roles": ["supervisor", "operator"]
  }
}
```

### Token Payload (admin)

```json
{
  "sub": "uuid-admin",
  "https://hasura.io/jwt/claims": {
    "x-hasura-user-id": "uuid-admin",
    "x-hasura-default-role": "admin",
    "x-hasura-allowed-roles": ["admin", "supervisor", "operator"]
  }
}
```

## Configuration

### `nhost.toml` — Custom Claims

The custom claims mapping is configured in `nhost.toml` (version-controlled, deployable):

```toml
[[auth.session.accessToken.customClaims]]
key = 'x-hasura-default-role'
value = 'user.metadata.role'
default = 'operator'

[[auth.session.accessToken.customClaims]]
key = 'x-hasura-allowed-roles'
value = 'user.metadata.allowedRoles'
default = '["operator"]'
```

**Behaviour:**
- `key`: The claim name sent in the JWT `https://hasura.io/jwt/claims` namespace
- `value`: The path inside `auth.users.metadata` to read the role from
- `default`: Fallback value when `metadata.role` is null or undefined (defaults to `operator` for safe access)

**File location:** `nhost.toml` (project root, alongside Nhost config)

## Event Trigger — Role Sync

### Trigger Definition

File: `hasura/triggers/sync-operator-role.json`

```json
{
  "type": "create_event_trigger",
  "args": {
    "name": "sync_operator_role_to_metadata",
    "source": "default",
    "table": {
      "schema": "public",
      "name": "operator_profiles"
    },
    "insert": { "columns": "*" },
    "update": { "columns": ["role"] },
    "webhook": "{{NHOST_BACKEND_URL}}/v1/functions/sync-role-metadata",
    "headers": [
      { "name": "x-nhost-admin-secret", "value_from_env": "NHOST_ADMIN_SECRET" },
      { "name": "x-webhook-secret", "value_from_env": "NHOST_WEBHOOK_SECRET" }
    ]
  }
}
```

**Behaviour:**
- Fires on INSERT of any `operator_profiles` row
- Fires on UPDATE of the `role` column specifically
- Sends the full event payload to the Nhost Function
- Does NOT fire on DELETE (role no longer matters)

### Webhook Function

File: `nhost/functions/sync-role-metadata.ts`

The function:
1. Validates the `x-webhook-secret` header (defense-in-depth)
2. Parses `event.data.new` from the Hasura event payload to get `{ id, role }`
3. Resolves `allowedRoles` based on the role:
   | `role` | `allowedRoles` |
   |---|---|
   | `operator` | `["operator"]` |
   | `supervisor` | `["supervisor", "operator"]` |
   | `admin` | `["admin", "supervisor", "operator"]` |
4. Calls `PATCH /auth/users/{id}` with `{ metadata: { role, allowedRoles } }` using the Nhost Admin Secret
5. Retries up to 3 times with exponential backoff on transient failures
6. Returns 200 on success, 502 on permanent failure

**Env vars required (set via `nhost/secrets.example.yaml`):**
- `NHOST_ADMIN_SECRET` — Nhost Admin Secret for Management API calls
- `NHOST_WEBHOOK_SECRET` — Shared secret to validate incoming webhooks
- `NHOST_BACKEND_URL` — Base URL for the Nhost backend

## Backfill Migration

File: `migrations/007_backfill_operator_metadata.sql`

Run this migration ONCE to sync ALL existing `operator_profiles.role` values into `auth.users.metadata`:

```sql
DO $$
DECLARE
  op record;
BEGIN
  FOR op IN SELECT id, role FROM operator_profiles WHERE role IS NOT NULL LOOP
    UPDATE auth.users
    SET metadata = jsonb_set(
      jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{role}',
        to_jsonb(op.role)
      ),
      '{allowedRoles}',
      to_jsonb(
        CASE op.role
          WHEN 'admin' THEN '["admin","supervisor","operator"]'::jsonb
          WHEN 'supervisor' THEN '["supervisor","operator"]'::jsonb
          ELSE '["operator"]'::jsonb
        END
      )
    )
    WHERE id = op.id;
  END LOOP;
END $$;
```

**Supported files:**
- `migrations/007_backfill_operator_metadata.sql` — Main migration (idempotent, re-runnable)
- `migrations/007_backfill_operator_metadata.verify.sql` — Reports any users with mismatched/missing metadata
- `migrations/007_backfill_operator_metadata.rollback.sql` — Strips `role` and `allowedRoles` keys from metadata

## Frontend Role Resolution

The frontend derives the user's role from `operator_profiles.role` (fetched via `fetchOperatorProfile()`), NOT from the JWT.

- **Store:** `src/auth/useAuthStore.ts` → `role: string | null` in `AuthState`
- **Populated:** In `fetchOperatorProfile()`, after the profile query resolves: `role: profile?.role ?? 'operator'`
- **Fallback:** When offline or profile fetch fails, defaults to `'operator'`
- **Layout guard:** `app/(tabs)/_layout.tsx` uses `useAuthStore((s) => s.role)` to conditionally show the "Alertas" (supervisor) tab

## Troubleshooting

### JWT still has wrong role

If the JWT still shows an unexpected `x-hasura-default-role`, check these in order:

1. **Is `auth.users.metadata.role` set correctly?**
   ```sql
   SELECT id, metadata->>'role' AS role, metadata->>'allowedRoles' AS allowed_roles
   FROM auth.users
   WHERE id = '<user-uuid>';
   ```
   If `metadata->>'role'` is null or wrong → the Event Trigger/Function didn't sync. Check step 2.

2. **Has the Event Trigger fired?**
   - Check Hasura Console → Events → `sync_operator_role_to_metadata` for recent invocations
   - Look for error logs: redeliveries, 5xx responses, or timeouts
   - If `x-webhook-secret` is mismatched between `hasura/triggers/sync-operator-role.json` and the function, the function returns 401

3. **Is the Nhost Function deployed and responding?**
   - Hit the webhook URL directly with a mock event payload:
     ```bash
     curl -X POST https://<NHOST_BACKEND_URL>/v1/functions/sync-role-metadata \
       -H 'x-nhost-admin-secret: <SECRET>' \
       -H 'x-webhook-secret: <SECRET>' \
       -H 'Content-Type: application/json' \
       -d '{"event": {"data": {"new": {"id": "<user-uuid>", "role": "supervisor"}}}}'
     ```
   - Expected response: `200 OK`
   - If 404 → the function is not deployed or the URL path is wrong

4. **Is `nhost.toml` deployed to Nhost?**
   - Custom claims only take effect after `nhost.toml` is pushed
   - Verify in Nhost Dashboard → Auth → Settings → JWT Custom Claims
   - The `x-hasura-default-role` and `x-hasura-allowed-roles` entries must be present

5. **Has the user re-logged in?**
   - JWT custom claims are only applied on NEW token issuance
   - Existing sessions keep the old JWT until:
     - Token expires (default 15 min TTL)
     - User logs out and back in
     - Nhost auto-refresh fires (every 5 min)

6. **Backfill not run?**
   - New users with existing `operator_profiles` rows need the backfill migration (see above)
   - Run `migrations/007_backfill_operator_metadata.sql` if metadata is empty

## Rollback

To undo the custom claims system:

1. **Frontend:** Revert `useAuthStore.ts` and `_layout.tsx` to the pre-PR#3 state
2. **Event Trigger:** Delete via Hasura Console or metadata API
3. **Nhost Function:** Delete `nhost/functions/sync-role-metadata.ts` from the Nhost deployment
4. **Custom Claims:** Remove `[[auth.session.accessToken.customClaims]]` blocks from `nhost.toml`
5. **Backfill:** Run `migrations/007_backfill_operator_metadata.rollback.sql` to strip metadata keys
6. **Docs:** Revert `hasura/custom_claims.md` to the pre-change state

## Related Files

| File | Purpose |
|------|---------|
| `nhost.toml` | Custom claims configuration (version-controlled) |
| `nhost/functions/sync-role-metadata.ts` | Nhost Function: syncs role to auth.users.metadata |
| `hasura/triggers/sync-operator-role.json` | Hasura Event Trigger definition |
| `nhost/secrets.example.yaml` | Required env vars documentation |
| `migrations/007_backfill_operator_metadata.sql` | Backfill migration for existing profiles |
| `migrations/007_backfill_operator_metadata.verify.sql` | Verify script for backfill |
| `migrations/007_backfill_operator_metadata.rollback.sql` | Rollback script for backfill |
| `src/auth/useAuthStore.ts` | Frontend store with role field |
| `app/(tabs)/_layout.tsx` | Tab layout with supervisor role guard |
| `nhost/functions/__tests__/sync-role-metadata.test.ts` | Integration tests for the webhook |
| `src/auth/__tests__/useAuthStore.test.ts` | Unit tests for store role resolution |
| `app/__tests__/tabs-layout.test.ts` | Unit tests for supervisor tab guard |
