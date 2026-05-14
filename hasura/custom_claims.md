# Custom Claims Setup for OEE RLS

## Overview

The OEE app uses only the **standard** Hasura JWT claim:

| Claim | Type | Purpose |
|-------|------|---------|
| `X-Hasura-User-Id` | UUID string | Standard Hasura claim — the user's `auth.users.id` |

**No custom claims needed.** The RLS policies use `_exists` subqueries against `user_line_assignments` to enforce line-level access control.

## How It Works

```
Operator queries oee_events
         │
         ▼
Hasura checks RLS policy
         │
         ▼
_exists subquery:
  SELECT 1 FROM user_line_assignments
  WHERE user_id = X-Hasura-User-Id
    AND line_id = oee_events.line_id
         │
    ┌────┴────┐
    │ found   │ not found
    ▼         ▼
  ALLOW     DENY
```

## Nhost Dashboard Configuration

### Step 1: Verify Standard Claim

Nhost automatically injects `X-Hasura-User-Id` from the JWT. No configuration needed.

In Hasura Console → **Settings → Permission Variables**, verify:

| Variable | Source | Default |
|----------|--------|---------|
| `X-Hasura-User-Id` | From JWT | — |

### Step 2: Roles

Configure these roles in Hasura:

| Role | Access Level | Use Case |
|------|-------------|----------|
| `operator` | Line-scoped (via `_exists` subquery) | Plant operators capturing OEE events |
| `supervisor` | Full read/write, no operator_id injection | Production supervisors |
| `admin` | Full access, unrestricted | System administrators |

### Step 3: JWT Structure

A minimal operator JWT:

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

A supervisor JWT:

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

## Testing

### Operator should see only their line's events

```bash
TOKEN="eyJ..." # Operator JWT
curl -X POST https://bbvfhqclotduzclfdiyd.graphql.us-west-2.nhost.run/v1/graphql \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ oee_events { id line_id event_type } }"}'
```

### Operator should NOT see events from unassigned lines

Insert a test event for a line the operator is NOT assigned to, then query — it should not appear.

### Supervisor should see all events

```bash
TOKEN="eyJ..." # Supervisor JWT
curl -X POST https://bbvfhqclotduzclfdiyd.graphql.us-west-2.nhost.run/v1/graphql \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ oee_events { id line_id event_type operator_id } }"}'
```

## Related Files

- `hasura/rls_oee_events.json` — RLS policies using `_exists` subquery
- `hasura/permissions_user_line_assignments.json` — User-line assignment permissions
- `migrations/005_user_line_assignments.sql` — The junction table schema
