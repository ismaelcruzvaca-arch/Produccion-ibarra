# Design: Wave 4 — OEE Event Sync & Replication Resilience

## Technical Approach

Wrap the existing `replicateGraphQL()` call for `oee_events` with a **custom replication plugin layer** that intercepts push responses, classifies errors, and manages backoff/circuit breaker state. This preserves the existing pull/push query builders while adding resilience without forking RxDB internals.

A new `sync_errors` RxDB collection acts as a local dead-letter queue. A lightweight **PendingCountService** subscribes to `oee_events` and writes the delta into Zustand, keeping the UI decoupled from RxDB per the existing architecture.

## Architecture Decisions

| Decision | Options | Tradeoffs | Choice |
|----------|---------|-----------|--------|
| Error interception | Wrap `replicateGraphQL` vs. fork RxDB plugin | Wrapping keeps upgrade path; forking is fragile | Wrap via custom `push.handler` that delegates to original mutation builder |
| Backoff implementation | RxDB `retryTime` vs. custom scheduler | RxDB retryTime is fixed; custom wrapper enables exponential backoff + circuit breaker | Custom wrapper with `setTimeout` managed state |
| Pending count source | RxDB query subscription vs. replication checkpoint | Subscription is reactive and accurate; checkpoint is fragile | RxDB query on `oee_events` where `_rev` indicates unsynced |
| `device_id` storage | `expo-secure-store` vs. `AsyncStorage` | SecureStore is device-bound and survives reinstalls; AsyncStorage can be cleared | `expo-secure-store` with fallback generation |

## Data Flow

```
┌─────────────┐     createEvent()     ┌──────────────────┐
│  OeeScreen  │ ──────────────────────→│ oee_events (RxDB) │
└─────────────┘                        └────────┬───────────┘
                                                │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    │                             │                             │
                    ▼                             ▼                             ▼
           ┌─────────────┐            ┌─────────────────┐           ┌─────────────────┐
           │useUIStore   │            │ replicateGraphQL │           │PendingCountSvc  │
           │pendingOee   │←───────────│  push handler   │           │ .subscribe()    │
           │Count        │  Zustand   │  (wrapped)       │           │                │
           └─────────────┘            └────────┬────────┘           └───────┬────────┘
                                              │                            │
                    ┌─────────────────────────┼────────────────────────────┘
                    │                         │
                    ▼                         ▼
           ┌─────────────┐          ┌─────────────────┐
           │ sync_errors │←─────────│ classifyError()  │
           │  (DLQ)      │ quarantine│ constraint?      │
           └─────────────┘           └─────────────────┘
                                      transient? → backoff / circuit breaker
```

1. **Create**: `useOeeEventsRepository.createEvent()` inserts into `oee_events` with `device_id`.
2. **Replication**: The wrapped push handler sends batches to Hasura.
3. **On error**: `classifyError()` inspects GraphQL response. Constraint errors move the doc to `sync_errors`. Transient errors trigger backoff.
4. **Pending count**: `PendingCountService` subscribes to `oee_events` and writes to `useUIStore.setPendingOeeCount()`.
5. **UI**: `OeeDashboard` header reads `pendingOeeCount` from Zustand.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/data/database.ts` | Modify | Register `sync_errors` collection; bump RxDB version for `oee_events` additive migration |
| `src/data/schemas.ts` | Modify | Add `syncErrorSchema`; add `device_id` to `oeeEventSchema` required array |
| `src/core/types.ts` | Modify | Add `ISyncError` interface; add `device_id` to `IOeeEvent` |
| `src/graphql/dto.ts` | Modify | Add `device_id` to `GraphQLOeeEvent`, `toGraphQLOeeEvent`, `fromGraphQLOeeEvent`; map to/from string |
| `src/graphql/sync.ts` | Modify | Wrap `oeeEvents` replication with `createResilientReplication()`; add `device_id` to push/pull |
| `src/sync/resilientReplication.ts` | Create | Backoff/circuit breaker wrapper; `classifyError()`; DLQ routing |
| `src/sync/pendingCountService.ts` | Create | RxDB query subscription → Zustand bridge for pending count |
| `src/sync/deviceId.ts` | Create | Stable `device_id` getter using `expo-secure-store` |
| `src/ui/store/useUIStore.ts` | Modify | Add `pendingOeeCount`, `setPendingOeeCount` |
| `src/ui/components/SyncMonitor.tsx` | Modify | Subscribe to `oeeEvents` `active$`/`error$` |
| `app/(tabs)/oee.tsx` | Modify | Render pending sync badge in header using `useUIStore.pendingOeeCount` |
| `src/repositories/useOeeEventsRepository.ts` | Modify | Inject `device_id` on `createEvent` |
| `migrations/004_oee_events.sql` | Modify | Add `device_id text` column |
| `src/sync/__tests__/classifyError.test.ts` | Create | Unit tests for error classification logic |
| `src/sync/__tests__/resilientReplication.test.ts` | Create | Integration tests for backoff and DLQ routing |

## Interfaces / Contracts

```typescript
// src/sync/resilientReplication.ts
interface ResilientReplicationOptions {
  baseRetryTime: number;
  maxRetryTime: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetMs: number;
}

function createResilientReplication<T, G>(
  replicationState: ReplicationState<T, G>,
  db: ChocolateIbarraDatabase,
  options: ResilientReplicationOptions
): ResilientReplicationState;

// Error classification result
type ClassifiedError =
  | { type: 'constraint'; message: string; docId: string }
  | { type: 'transient'; message: string }
  | { type: 'unknown'; message: string };

// Zustand extension (useUIStore)
pendingOeeCount: number;
setPendingOeeCount: (count: number) => void;
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `classifyError()` — FK violations, network errors, unknowns | Jest, mock GraphQL responses |
| Unit | `pendingCountService` — RxDB→Zustand subscription | Jest, mock RxDB collection + Zustand store |
| Unit | `deviceId` — generation, persistence, fallback | Jest, mock `expo-secure-store` |
| Integration | `resilientReplication` — backoff cap, circuit breaker open/close | Jest, mock `ReplicationState` with controlled `error$` |
| Integration | DLQ flow — bad doc quarantined, good doc continues | Jest, mock `sync_errors` collection |
| E2E | Offline event survives failures, syncs on recovery | Playwright (web) or manual (native) |

## Migration / Rollout

1. **Server first**: Deploy migration `004_oee_events.sql` adding `device_id`.
2. **App release**: New app version includes schema bump (RxDB `version: 1` for `oee_events`) so additive `device_id` is accepted locally.
3. **Rollback**: Revert `sync.ts` to fixed `retryTime: 5000`, remove `sync_errors` registration, hide dashboard badge.

## Open Questions

- [ ] Should `sync_errors` be exposed in an admin screen in Wave 5, or only via debugging?
- [ ] Is the circuit breaker reset best done by a periodic `setInterval` or by a user-triggered "retry now" button?

