# Proposal: Wave 4 — OEE Event Sync & Replication Resilience

## Intent

Fix critical gaps in RxDB GraphQL replication for OEE events: invisible sync errors, fixed 5s retry wasting battery, missing dead-letter queue for validation failures, and lack of device audit for conflicts.

## Scope

### In Scope
- Exponential backoff + circuit breaker for OEE event replication
- Local `sync_errors` dead-letter collection for server-validation failures
- `device_id` field on OEE events (local + server) for LWW audit
- Subtle sync status UI in OeeDashboard header (unsynced count + connection state)
- Extend `SyncMonitor` to watch `oeeEvents` replication state

### Out of Scope
- Automatic resolution of dead-letter events (manual, deferred to future admin wave)
- Multi-master conflict resolution beyond LWW audit
- Real-time WebSocket subscriptions
- Admin UI for `sync_errors`

## Capabilities

### New Capabilities
- `oee-event-sync-replication`: Resilient offline-first sync with backoff, circuit breaker, and dead-letter quarantine.

### Modified Capabilities
- None

## Approach

Evolve existing `replicateGraphQL()` in `src/graphql/sync.ts`:
1. Wrap replication with exponential backoff (cap 60s) and a circuit breaker that pauses on repeated errors.
2. In push response handling, classify validation/constraint errors and move offending docs to a local `sync_errors` RxDB collection, preventing infinite retry.
3. Add `device_id` to local and server `oee_events` schemas.
4. Expose pending-sync count to UI; render a subtle sync icon/badge in the OeeDashboard header.
5. Subscribe `SyncMonitor` to `oeeEvents` replication `active$` and `error$`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/graphql/sync.ts` | Modified | Backoff/circuit breaker; error classification |
| `src/data/database.ts` | Modified | New `sync_errors` collection |
| `src/data/schemas.ts` | Modified | `device_id` on `oeeEventSchema` |
| `src/repositories/useOeeEventsRepository.ts` | Modified | Pending count; `device_id` on create |
| `src/ui/components/SyncMonitor.tsx` | Modified | Subscribe to `oeeEvents` state |
| `app/(tabs)/oee.tsx` | Modified | Header sync icon with count + state |
| `migrations/004_oee_events.sql` | Modified | Add `device_id` column |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| RxDB error hook rigidity | Medium | Wrap in custom boundary; fallback fetch if needed |
| Large backlog timeout | Medium | Keep `pullBatchSize: 100`; show batch progress |
| Schema migration needed | Low | Bump RxDB version with additive migration |

## Rollback Plan

- Revert `src/graphql/sync.ts` to fixed `retryTime: 5000`.
- Remove `sync_errors` collection registration.
- Hide dashboard sync icon via revert or feature flag.

## Dependencies

- Wave 3 (frontend stores) stable in production.
- Server migration adding `device_id` to `public.oee_events` deployed before app release.

## Success Criteria

- [ ] Offline event survives 5+ simulated failures and syncs on recovery
- [ ] Retry interval reaches 60s cap after repeated errors
- [ ] Invalid event (bad FK) quarantines to `sync_errors` within 2 cycles
- [ ] Dashboard header shows accurate unsynced count and updates on completion
- [ ] All new OEE events include `device_id`
