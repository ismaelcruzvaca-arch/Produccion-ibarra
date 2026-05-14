# Spec: Wave 4 — OEE Event Sync & Replication Resilience

## Purpose
Define resilient offline-first sync for OEE events: exponential backoff, circuit breaker, dead-letter quarantine, device audit, and reactive pending count.

## Functional Requirements

### FR-1: Exponential Backoff & Circuit Breaker
The OEE event replication SHALL use exponential backoff capped at 60s. After 5 consecutive errors, a circuit breaker SHALL pause replication until manually or periodically resumed.

### FR-2: Dead-Letter Queue (`sync_errors`)
The system SHALL maintain a local RxDB `sync_errors` collection. Each record MUST contain `id_evento`, `payload_original`, `mensaje_error`, `fecha`.

### FR-3: Error Classification & Routing
On push failure, the wrapper SHALL classify errors:
- **Constraint/validation errors** (e.g., FK violation): move the document to `sync_errors` and remove from the replication queue.
- **Transient errors** (network, timeout): follow backoff retry.
The next document in the queue SHALL proceed without blocking.

### FR-4: `device_id` Audit Field
All new OEE events MUST include `device_id` (stable device UUID). The field SHALL exist in local schema, DTO, GraphQL mutation, and server schema.

### FR-5: Pending Sync Counter
The `OeeDashboard` header SHALL display the count of unsynced OEE events. The component SHALL read this from Zustand (`useUIStore.pendingOeeCount`), updated by an RxDB query subscription on `oee_events`.

### FR-6: SyncMonitor Extension
`SyncMonitor` SHALL subscribe to `oeeEvents` replication `active$` and `error$` alongside existing collections.

## Non-Functional Requirements

- **NFR-1 (Battery)**: Backoff SHALL reduce retry frequency under sustained errors.
- **NFR-2 (Integrity)**: Quarantined payloads SHALL be immutable.
- **NFR-3 (Performance)**: Pending-count computation SHALL not block the UI thread.

## Scenarios

### SC-1: Event syncs after recovery
- GIVEN the device is offline with 1 OEE event
- WHEN connectivity recovers
- THEN the event pushes to the server
- AND the pending count drops to 0

### SC-2: FK violation quarantines event
- GIVEN a push returns a GraphQL FK constraint error for event E1
- WHEN the wrapper classifies the error
- THEN E1 is inserted into `sync_errors`
- AND E1 is skipped on subsequent pushes
- AND E2 (next in queue) continues normally

### SC-3: Backoff reaches cap
- GIVEN 5 consecutive transient errors
- WHEN the 6th retry triggers
- THEN the interval is 60s
- AND the circuit breaker pauses replication

### SC-4: New event carries `device_id`
- GIVEN a user creates an OEE event
- THEN `device_id` equals the stable device identifier
- AND the push mutation includes it

### SC-5: Dashboard reflects pending count
- GIVEN 3 OEE events are not yet synced
- WHEN the user opens the dashboard
- THEN the header shows a count of 3
- AND the count updates automatically as events sync

## Data Model Changes

### `sync_errors` RxDB Schema
```typescript
{
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'id_evento', 'payload_original', 'mensaje_error', 'fecha'],
  properties: {
    id:               { type: 'string', maxLength: 100 },
    id_evento:        { type: 'string', maxLength: 100 },
    payload_original: { type: 'object' },
    mensaje_error:    { type: 'string' },
    fecha:            { type: 'number' },
  },
  indexes: ['id_evento', 'fecha'],
}
```

### `oee_events` Schema Change
Add `device_id: { type: 'string' }` to `properties`. Add `device_id` to `required`.

### Server Migration
```sql
ALTER TABLE public.oee_events ADD COLUMN device_id text;
```

## Interface Definitions

### Zustand Store Extension
```typescript
// useUIStore
pendingOeeCount: number;
setPendingOeeCount: (count: number) => void;
```

### GraphQL Mutation Signature (updated)
```graphql
mutation UpsertOeeEvents($objects: [oee_events_insert_input!]!) {
  insert_oee_events(
    objects: $objects,
    on_conflict: {
      constraint: oee_events_pkey,
      update_columns: [
        updated_at, deleted, line_id, machine_id, operator_id,
        shift_id, event_type, timestamp, reason_code, quantity,
        planned_boxes, notes, is_retroactive, related_event_id, device_id
      ]
    }
  ) { affected_rows }
}
```

### Error Types
```typescript
type ClassifiedError =
  | { type: 'constraint'; message: string; docId: string }
  | { type: 'transient'; message: string }
  | { type: 'unknown'; message: string };
```

## Acceptance Criteria

1. An offline-created event survives 5+ simulated failures and syncs on recovery.
2. Retry interval reaches exactly 60s after repeated transient errors.
3. An invalid event (bad FK) quarantines to `sync_errors` within 2 replication cycles.
4. The `OeeDashboard` header shows the accurate unsynced count and updates on sync completion.
5. All newly created `oee_events` contain a non-empty `device_id`.
