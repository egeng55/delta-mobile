# Mobile Pending Sync Storage

Last inspected: 2026-06-21.

This document inventories pending/offline/sync queue storage in `delta-mobile`
and records the Phase 115 hardening decision. It must not include raw queued
payload values, tokens, secrets, health data, or request bodies.

## Summary

The only persistent pending sync queue found in this phase is
`delta_pending_sync` in `src/services/offlineCache.ts`.

Phase 115 keeps that queue in `AsyncStorage` because pending queues can become
larger than `SecureStore` is suited for. The hardening strategy is:

- wrap the queue in a schema-versioned TTL envelope,
- add per-item `createdAt`, `expiresAt`, `schemaVersion`, and `payloadKind`
  metadata,
- strip token-like fields before persistence,
- drop expired entries on read,
- clear malformed storage safely,
- keep reading legacy raw arrays and rewrite valid entries into the envelope,
- prune synced entries after successful replay.

No backend, site, Supabase, auth, schema, notification, mic, TTS, or product
memory behavior changed.

## Storage Inventory

| Location | Key or storage | Payload type | Sensitivity | Current retention after Phase 115 | Cleanup behavior | Classification | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `src/services/offlineCache.ts` | `delta_pending_sync` | Pending replay queue, currently `tracking` payloads with `_endpoint` plus request body | High; can include health/tracking/free-text adjacent data | 14-day item TTL in `AsyncStorage` envelope | Expired/malformed entries removed on read; successful sync removes item; unknown sync types are removed by existing replay logic | `ttl_needed`, `minimization_needed`, `clear_on_success_needed` | Remediated in Phase 115 |
| `src/services/offlineCache.ts` | `delta_cache_${resource}_${userId}` | Generic offline API cache | High for health/profile/menstrual resources | Existing resource TTL cache | Existing expiry removal | `defer_broad_storage_strategy` | Deferred to offline health cache finding |
| `src/services/healthSync.ts` | Secure metadata helpers for last sync | HealthKit sync timestamp, not a pending queue | Medium | Uses SecureStore helper from Phase 71 | Not a pending queue | `safe_no_change_needed` for this phase | No change |
| `src/services/watchSync.ts` | Watch connectivity queue flag from watch API result | No local persisted queue found | Unknown/low in this phase | Not persisted in AsyncStorage by this code | Not applicable | `safe_no_change_needed` for this phase | No change |
| `src/services/deltaDecisionLog.ts` | File append queue for local decision log writes | Local log lines, not pending API sync | Medium | File-based diagnostic log queue, not AsyncStorage pending replay | Not part of pending sync storage | `manual_review_needed` outside this finding | No change |

## Key Names Found

- `delta_pending_sync`: persistent pending sync replay queue.
- `delta_cache_*`: generic offline cache keys; not modified in this phase.
- `@delta_health_last_sync`: HealthKit last-sync metadata; already handled by
  sensitive storage helpers.

No other AsyncStorage-backed pending API replay queue was found.

## Payload Classification

`delta_pending_sync` is high sensitivity because queued replay payloads may
include:

- tracking endpoint names,
- health-adjacent request bodies,
- user-entered values,
- body/mood/sleep/workout/meal/water/weight data depending on the future caller.

The queue should not persist authorization headers, access tokens, refresh
tokens, passwords, cookies, or session values. Phase 115 strips token-like keys
recursively before storage. Replay fetches the current auth token at sync time
instead of storing one in the queue.

## Implementation Details

New helper:

```text
src/services/storage/pendingSyncStorage.ts
```

Policy:

- storage key: `delta_pending_sync`
- schema version: `1`
- queue kind: `pending_sync_queue`
- item TTL: 14 days
- token-like fields stripped recursively
- valid legacy arrays rewritten into the current envelope
- expired legacy/current entries dropped on read
- malformed queue storage cleared safely

`src/services/offlineCache.ts` now delegates pending queue operations to this
helper while preserving its public functions:

- `addToPendingSync`
- `getPendingSync`
- `removeFromPendingSync`

The existing replay behavior is preserved: valid pending items can still retry,
successful sync removes the synced item, failed known items keep attempt count,
and unknown types are removed by the existing replay logic.

## Why Not SecureStore

`SecureStore` is appropriate for small secrets and preferences, not high-volume
or potentially large replay queues. Moving pending payloads there blindly could
create size/performance problems and does not solve replay retention. This
phase uses TTL/minimization instead of encrypted large-queue storage.

## Remaining Deferred Work

- Generic offline health cache resource classification remains deferred to the
  offline health cache strategy finding.
- Encrypted large-cache storage remains a broader storage-strategy decision.
- Pending sync replay currently only knows how to replay `tracking` items; this
  phase does not expand sync behavior.
- User-visible recovery for expired or malformed unsynced items is not added in
  this phase.

## Verification

Added tests:

- `src/services/storage/pendingSyncStorage.test.ts`
- `src/services/offlineCache.test.ts`

Coverage includes:

- TTL envelope creation,
- valid queue reads,
- expired entry removal,
- legacy raw array migration,
- malformed storage cleanup,
- synced item pruning,
- token-like field minimization,
- queue order preservation.
