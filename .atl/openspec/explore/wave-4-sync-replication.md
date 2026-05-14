# Exploration: Sync & Replication Strategy for OEE Events

## Change
`wave-4-sync-replication`

## Context
- React Native + Hasura/Nhost + PostgreSQL
- Factory-floor environment with unreliable WiFi
- Offline-first is critical
- Previous waves: schema, RLS/auth, frontend stores

---

## Current State

### Data Model (OEE Events)
- **Table**: `public.oee_events`
- **Primary key**: `uuid` (client-generated via `uuidv4`)
- **Event types**: `shift_start`, `shift_end`, `downtime_start`, `downtime_end`, `box_count`, `reject_count`
- **Key fields**: `line_id`, `machine_id`, `operator_id`, `shift_id`, `timestamp`, `reason_code`, `quantity`, `planned_boxes`, `notes`, `is_retroactive`, `related_event_id`
- **Soft delete**: `deleted boolean NOT NULL DEFAULT false`
- **Sync timestamp**: `updated_at bigint NOT NULL` (drives LWW conflict resolution)
- **Indexes**: `timestamp`, `[line_id, timestamp]`, `[shift_id, timestamp]`, `updated_at`, `operator_id`

### Local Storage
- **RxDB** with Dexie.js (IndexedDB) storage engine
- **Collections**: `assets`, `asset_types`, `work_orders`, `reports`, `oee_events`
- **Schema version**: 0, no migrations yet
- **Primary keys**: UUID strings, maxLength 100

### Existing Sync Layer
- **Technology**: RxDB `replicateGraphQL()` plugin (`src/graphql/sync.ts`)
- **Pattern**: Checkpoint-based delta pull + upsert push
- **Pull**: `WHERE updated_at > $lastCheckpoint ORDER BY updated_at ASC`
- **Push**: `insert_oee_events(objects, on_conflict: {constraint: oee_events_pkey, update_columns: [...]})`
- **Conflict resolution**: Last-Write-Wins on `updated_at`
- **Polling**: `live: false` (WebSocket disabled due to `ws` module crash on web); `liveInterval: 10000` (10s) for OEE events, `30000` (30s) for others
- **Retry**: Fixed `retryTime: 5000`
- **Auth**: Bearer token injected manually via `getAuthToken()`

### Frontend Stores
- **Catalogs**: Zustand + AsyncStorage, 1h TTL, offline-safe fallback
- **Auth**: Zustand + SecureStore/AsyncStorage, offline JWT validation
- **UI state**: Zustand (`useUIStore`) — sync status, online/offline, loading

### UI Components
- `SyncMonitor`: subscribes to replication `active$` and `error$` — **BUT currently only watches `assets` and `workOrders`, NOT `oeeEvents`**
- `ConnectionBadge`: online/offline chip

### Repositories
- `useOeeEventsRepository`: RxDB wrapper with `createEvent`, `update`, `remove` (soft delete), `findByShift`, `findActiveDowntime`
- Events are created with `generateUuid()` and `nowMs()` locally

### Known Gaps
1. `SyncMonitor` does **not** subscribe to `oeeEvents` replication state — sync errors for OEE data are invisible.
2. **Fixed 5s retry** — on spotty factory WiFi this hammers the network and drains battery.
3. **No dead-letter queue** — if server validation fails (FK constraint, bad enum), RxDB retries forever with no quarantine mechanism.
4. **No queue visibility** — operators cannot see how many events are pending sync.
5. **Web/PWA is 100% offline** — replication is disabled on web (`ws` module crash); no manual sync path.
6. **Naive LWW** — two tablets editing the same event can lose data silently.
7. **No idempotency guarantees on push** — network timeouts during upsert could theoretically cause duplicate processing (though `on_conflict` mitigates this for existing rows, new inserts with lost responses are a gray area).

---

## Affected Areas

| Path | Why Affected |
|------|-------------|
| `src/graphql/sync.ts` | Core replication logic needs retry/backoff and error handling enhancements |
| `src/ui/components/SyncMonitor.tsx` | Must subscribe to `oeeEvents` replication state |
| `src/repositories/useOeeEventsRepository.ts` | May need to expose pending-sync count or outbox state |
| `src/data/schemas.ts` | May need `sync_status` or `sync_error` fields on `oeeEventSchema` |
| `src/data/database.ts` | May need new `sync_errors` or `outbox` collection |
| `src/ui/store/useUIStore.ts` | May need queue count, backoff state |
| `migrations/004_oee_events.sql` | May need server-side validation/trigger or `sync_status` column if moving to server-queue pattern |
| `app/(tabs)/oee.tsx` | May need UI for "X events pending sync" |

---

## Approaches

### 1. Enhanced RxDB GraphQL Replication (Evolution)

Keep the existing RxDB `replicateGraphQL()` backbone and layer resilience around it.

**What changes:**
- Wrap the replication state in an **exponential backoff + circuit breaker** manager. Instead of RxDB's fixed `retryTime`, pause replication on repeated errors and back off (2s → 4s → 8s → 30s → 60s cap).
- Add a **custom push modifier** that inspects GraphQL error responses. On validation errors (FK violation, check constraint, bad enum), move the offending doc to a local `sync_errors` collection instead of retrying forever.
- Extend `SyncMonitor` to subscribe to `replication.oeeEvents.active$` and `error$`.
- Add an **offline queue counter**: RxDB exposes `pendingChanges$` (or we can query `find({selector: {updated_at: {$gt: lastPushCheckpoint}}})`) to show "N events pending" in the UI.
- For web/PWA: provide a **manual sync button** that triggers a one-shot replication cycle (avoids the `ws` crash because we never enable `live: true`).
- For conflicts: add an `edited_by_device_id` field to OEE events for audit. Keep LWW but log to Sentry when `updated_at` conflicts occur.

**Pros:**
- Minimal rewrite — leverages existing DTOs, queries, and replication setup
- RxDB handles the heavy lifting of checkpoint tracking and batching
- Familiar pattern for the team (already used for assets/work_orders)

**Cons:**
- RxDB replication-graphql is somewhat rigid — deep custom error handling requires monkey-patching or wrapping
- Still relies on LWW which can silently lose concurrent edits
- No true "outbox" semantics — pushes are doc-based, not operation-based

**Effort**: Medium

---

### 2. Event-Sourced Outbox with Custom Reconciler

Treat OEE events as immutable facts. Build a local `outbox` queue and a background worker that processes it.

**What changes:**
- **Local writes**: When the operator creates an event, insert it into `oee_events` (as today) AND append a record to an `outbox` collection: `{id, event_id, operation: 'INSERT', payload, status: 'pending', retry_count, last_error, created_at}`.
- **Pull**: Same delta query (`updated_at > checkpoint`) from Hasura → RxDB upsert.
- **Push**: A background worker (`SyncWorker`) reads `outbox` where `status = 'pending'`, batches them, and sends a custom GraphQL mutation. On success, marks `status = 'synced'`. On **validation error**, marks `status = 'failed'` with `last_error` and stops retrying that item. On **network error**, increments `retry_count` and applies exponential backoff.
- **Conflict resolution**: Since OEE events are mostly append-only facts (you don't edit a `box_count` after the fact; you create a new one), conflicts are rare. For the few editable fields (`notes`, `is_retroactive`), use **server-side merge** or append a `correction_event` rather than overwriting.
- **Queue visibility**: UI queries `outbox.find({selector: {status: 'pending'}}).count()` to show "12 eventos pendientes".
- **Dead letter queue**: `outbox.find({selector: {status: 'failed'}})` shows events that need supervisor attention.
- **Web/PWA**: The worker runs the same code; no WebSocket needed.

**Pros:**
- Full control over retry, backoff, batching, and error classification
- Natural fit for OEE domain — events are facts, not mutable state
- Dead-letter queue is first-class; no silent infinite retries
- Queue count and sync status are trivial to query and display
- Works identically on native and web (no `ws` dependency)

**Cons:**
- More code to write and maintain (queue processor, worker lifecycle, batching logic)
- Need to keep `outbox` and `oee_events` in sync (transaction-like semantics)
- Testing is more complex (need to mock worker, network failures, backoff timers)
- Slight increase in local storage usage (duplicated event data in outbox)

**Effort**: High

---

### 3. Hasura Subscriptions + Custom Sync Queue (Rejected)

Use Hasura GraphQL subscriptions over WebSocket for real-time push, plus a local queue for offline writes.

**Why rejected:**
- The codebase **already disables WebSocket** (`live: false`) because the `ws` module crashes in browser/PWA environments
- Factory WiFi is unreliable — maintaining a persistent WebSocket is fragile
- Adds significant complexity for marginal benefit (10s polling is sufficient for OEE reporting)

---

## Recommendation

**Adopt Approach 1 (Enhanced RxDB Replication) as the immediate path, with Approach 2 patterns layered selectively for critical resilience.**

### Justification

1. **Time to value**: Approach 1 builds on existing working code. We can ship improvements in days, not weeks.
2. **Good enough for the domain**: OEE events are **append-heavy, edit-light**. The naive LWW conflict in RxDB is acceptable because concurrent edits to the same event are extremely rare in practice (an operator edits their own event on their own tablet).
3. **Risk mitigation**: The biggest real-world risk is not conflict resolution — it is **infinite retry on validation errors** and **no visibility into sync health**. Approach 1 fixes both with modest effort.
4. **Future path to Approach 2**: If we later discover that outbox semantics are critical (e.g., audit requirements, complex offline workflows), we can migrate incrementally. The `outbox` collection can be added later without rewriting the replication layer.

### Specific Implementation Plan

1. **Retry/Backoff**: Replace fixed `retryTime: 5000` with a custom wrapper that pauses replication on `error$` and resumes with exponential backoff (cap at 60s). Use `replicationState.pause()` / `resume()` APIs.
2. **Dead-letter / Validation errors**: In the push `queryBuilder`, parse the GraphQL response. If Hasura returns a `constraint-violation` or `validation-failed` error, catch it in a `push.modifier` or post-push hook and write the doc ID + error to a new `sync_errors` RxDB collection. Do NOT let RxDB retry it.
3. **SyncMonitor fix**: Add `replication.oeeEvents.active$` and `error$` subscriptions immediately. This is a **bug-level gap**.
4. **Queue visibility**: Expose `db.collections.oee_events.getUnsyncedDocuments()` (or equivalent RxDB API) through the repository to the UI. Show a subtle badge: "X eventos sin sincronizar".
5. **Web manual sync**: Add a "Sincronizar ahora" button in settings that calls `replicationOeeEvents.reSync()` when online.
6. **Conflict audit**: Add `device_id` (or `edited_by`) to the `oee_events` schema (both local and server) so that when LWW overwrites data, we know which tablet made the final change.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| RxDB replication-graphql plugin is deprecated or has edge-case bugs in error handling | High | Wrap replication in our own error boundary; maintain fork or migrate to custom fetch if needed |
| Two tablets create events for the same machine during offline period; when they sync, server state may not reflect true chronological order | Medium | Ensure `timestamp` (not just `updated_at`) is used for OEE calculations; `updated_at` is only for sync |
| Operator edits an event on Tablet A while offline; Tablet B edits the same event online. When A comes back, LWW may silently discard A's edit | Medium | Add `device_id` for audit; consider server-side `oee_event_edits` append-only log for retroactive corrections |
| Large backlog after long outage (>1000 events) may cause memory or timeout issues during pull | Medium | `pullBatchSize: 100` is already set; ensure UI shows "Sincronizando lote X de Y" |
| Server-side FK constraints (e.g., `machine_id` references `machines`) fail because catalog was updated while tablet was offline | High | Pre-validate `machine_id`/`line_id`/`shift_id` against local catalog before push; if invalid, quarantine to `sync_errors` |
| Web/PWA users never get sync because replication is disabled | High | Implement manual one-shot sync button for web; detect `typeof window` and offer alternative UI |
| Battery drain from 10s polling on native when offline | Medium | Increase `liveInterval` to 30s when offline for >5 minutes; use NetInfo to detect connectivity |

---

## Open Questions

1. **Do we need true multi-master conflict resolution?** In practice, does the same operator log into two tablets simultaneously and edit the same event? If yes, LWW is insufficient and we need an append-only edit log.
2. **What is the maximum acceptable sync latency?** 10s polling is good for dashboards, but is 30s acceptable during offline periods to save battery?
3. **Should `reject_count` events be treated differently?** They may require supervisor approval before appearing in reports — should they have a `pending_approval` status?
4. **How do we handle schema evolution?** RxDB schema version is 0. If we add `device_id`, we need a migration strategy (or drop and rebuild, which is acceptable if we seed from server).
5. **Do we need an admin UI to view and retry `sync_errors`?** A supervisor might need to fix a bad `machine_id` and re-push.
6. **Is 10s polling too aggressive for the Hasura free tier?** We should verify rate limits and consider backing off to 30s during low-activity hours.

---

## Ready for Proposal

**Yes.**

The orchestrator should tell the user:
- The existing RxDB replication layer is a solid foundation but has **critical gaps** (invisible OEE sync errors, fixed retry, no dead-letter queue).
- We recommend **evolution over revolution**: enhance RxDB replication with exponential backoff, validation-error quarantine, SyncMonitor fixes, and queue visibility.
- The next phase (`sdd-propose`) should define the exact scope: backoff logic, `sync_errors` collection schema, SyncMonitor extension, and web manual sync.
- Effort estimate: **Medium** (roughly 2-3 focused implementation sessions).
