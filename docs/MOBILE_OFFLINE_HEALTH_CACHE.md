# Mobile Offline Health Cache

Last inspected: 2026-06-21.

This document inventories persistent local offline health, wellness, tracking,
HealthKit, workout, sleep, meal, mood, weight, hydration, menstrual, and
derived-insight cache storage in `delta-mobile`. It must not include raw cache
payloads, tokens, secrets, health values, transcripts, or generated insight
text.

## Summary

Phase 117 found one remaining generic offline health cache layer:

- `src/services/offlineCache.ts` using `delta_cache_${resource}_${userId}`.

Other adjacent storage had already been handled or belongs to a narrower
finding:

- Phase 78: chat transcript TTL/minimization and generated insight/dashboard
  cache envelopes.
- Phase 115: pending sync queue TTL/minimization.
- Phase 116: avatar/body-scan metadata TTL/minimization.
- Finding `009`: weather/location cache TTL remains separate.
- Finding `011`: notification preference storage remains separate.

Phase 117 adds:

- `src/services/storage/offlineHealthCacheStorage.ts`,
- schema-versioned TTL envelope for generic `delta_cache_*` resources,
- resource-level sensitivity policy for high-risk health cache resources,
- recursive token-like field stripping,
- raw image/blob-like field stripping,
- conservative array caps for list-like payloads,
- valid legacy `CachedData` handling and rewrite into the current envelope,
- malformed and expired cache cleanup,
- generated daily greeting TTL envelope and legacy raw string handling,
- explicit prefetch analytics array minimization before writing the 5-minute
  cache.

No backend, site, Supabase, auth, schema, notification, mic, TTS, or product
memory behavior changed.

## Storage Inventory

| Location | Key or storage | Payload type | Sensitive contents | Retention after Phase 117 | Cleanup behavior | Classification | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `src/services/offlineCache.ts` | `delta_cache_${resource}_${userId}` | Generic offline API response cache | Resource-dependent; known resources include `insights`, `workout`, `calendar`, `derivatives`, `profile`, and `menstrual` | Schema-versioned TTL envelope; known high-risk resources keep existing TTLs: 30 minutes for insights, 1 hour for workout/derivatives, 24 hours for calendar/profile/menstrual | Expired or malformed entries are removed on read; valid legacy entries are rewritten into the envelope | `ttl_needed`, `minimization_needed` | Remediated |
| `src/hooks/useOffline.ts` | Uses `offlineCache` public API | Hook-level generic offline cache access | Same as selected resource | Inherits `offlineHealthCacheStorage` behavior | Inherits helper cleanup | `ttl_needed`, `minimization_needed` | Remediated through service |
| `src/services/prefetch.ts` | `@delta_insights_analytics_${userId}` | Dashboard, targets, health state, causal chains, modules, insights | Derived insights, targets, causal-chain and module metadata | 5-minute TTL envelope from Phase 78; Phase 117 trims cards, weekly summaries, causal chains, and modules before writing | Read/expiry cleanup happens through `useInsightsData` cache reader | `ttl_needed`, `minimization_needed` | Remediated |
| `src/services/prefetch.ts` | `@delta_insights_workout_${userId}` | Workout payload | Workout plan data | 5-minute TTL envelope | Read/expiry cleanup happens through `useInsightsData` cache reader | `ttl_needed` | Remediated |
| `src/hooks/useInsightsData.ts` | `@delta_insights_${tab}_${userId}` | Analytics, workout, calendar, menstrual calendar/settings/cycle phase | Derived insight, workout, calendar, menstrual, target, sleep/mood/hydration/weight summaries | 5-minute TTL envelope from Phase 78 | Expired envelope removed on read; legacy timestamp object still read if fresh | `ttl_needed`, `minimization_needed` | Remediated before this phase; included in inventory |
| `src/screens/DailyInsightsScreen.tsx` | `delta-greeting-${userId}-${date}` | Generated daily greeting/health insight fallback text | Free-text generated health/wellness message | 24-hour TTL envelope; same key pattern retained | Expired or malformed entries are removed; valid legacy raw strings are rewritten | `ttl_needed`, `minimization_needed` | Remediated |
| `src/services/menstrualTracking.ts` | `menstrual_settings_${userId}` legacy, `delta_sensitive_menstrual_settings_${userId}` current | Menstrual settings | Cycle settings, last period start, notification preference | SecureStore with legacy AsyncStorage fallback from Phase 71 | Legacy value removed after verified secure write | `securestore_small_sensitive_setting_needed` | Remediated before this phase; included in inventory |
| `src/services/menstrualTracking.ts` | No persistent local log cache found | Menstrual logs fetched from Supabase and used in memory | Period events, symptoms, notes | Not locally persisted by this service | Not applicable | `safe_no_change_needed` for local cache | No persistent cache found |
| `src/services/healthSync.ts` | `@delta_health_last_sync` legacy, `delta_sensitive_health_last_sync` current | HealthKit last sync timestamp | HealthKit usage metadata | SecureStore with legacy AsyncStorage fallback from Phase 71 | Legacy value removed after verified secure write | `securestore_small_sensitive_setting_needed` | Remediated before this phase; included in inventory |
| `src/context/HealthKitContext.tsx` | `@delta_healthkit_enabled` legacy/current helper path | HealthKit enabled flag | HealthKit usage metadata | SecureStore helper path from Phase 71 | Legacy value handled by sensitive storage helpers | `securestore_small_sensitive_setting_needed` | Remediated before this phase; included in inventory |
| `src/services/offlineCache.ts` | `delta_pending_sync` | Pending replay queue | Tracking endpoint/body payloads | 14-day TTL envelope from Phase 115 | Expired/malformed entries removed on read; synced entries pruned | `clear_on_success_needed`, `ttl_needed`, `minimization_needed` | Resolved in finding `008`; no duplicate work |
| `src/services/avatarService.ts` | `@delta_user_avatar_${userId}` | Avatar/body-scan metadata | Scan method/date, URI metadata, body-scan provenance | 30-day TTL envelope from Phase 116 | Expired/malformed entries removed on read | `ttl_needed`, `minimization_needed` | Resolved in finding `010`; no duplicate work |
| `src/services/weather.ts` | `@delta_weather_cache` | Weather/location-adjacent context | City/location label, weather, air quality | Existing short TTL cache | Separate finding covers weather/location cache details | `manual_review_needed` | Deferred to finding `009` |
| `src/services/notifications.ts` | `notification_settings` | Notification toggles and reminder times | Health routine/reminder metadata | Existing AsyncStorage settings | Separate finding covers notification preference storage | `manual_review_needed` | Deferred to finding `011` |
| `src/services/api.ts` | In-memory `Map` | Intelligence request cache | Derived intelligence responses during runtime | Process memory only, 5-minute TTL | Cleared in memory | `safe_no_change_needed` | No persistent cache |

## Resource Policy

The generic offline cache helper treats these resources as high sensitivity:

- `insights`
- `workout`
- `calendar`
- `derivatives`
- `profile`
- `menstrual`

Known TTLs are preserved:

- `insights`: 30 minutes
- `workout`: 1 hour
- `derivatives`: 1 hour
- `calendar`: 24 hours
- `profile`: 24 hours
- `menstrual`: 24 hours

Unknown resources receive a 24-hour default TTL and medium sensitivity label.
They are still wrapped in the envelope and stripped of token-like/raw blob-like
fields.

## Implementation Details

New helper:

```text
src/services/storage/offlineHealthCacheStorage.ts
```

Policy:

- storage prefix: `delta_cache_`
- schema version: `1`
- payload kind: `offline_health_cache`
- known high-risk resources get explicit TTL and sensitivity metadata
- token-like keys are stripped recursively
- raw image/blob/base64-like keys are stripped recursively
- arrays are conservatively capped by resource policy
- valid legacy `CachedData` objects are read and rewritten into the envelope
- raw legacy object/array values are tolerated and rewritten when valid
- expired or malformed values are removed on read

The `offlineCache.ts` public API is unchanged:

- `cacheData`
- `getCachedData`
- `clearCache`
- `clearAllCache`
- `fetchWithCache`
- pending sync functions

Pending sync still delegates to the Phase 115 helper and was not reworked.

## Generated Greeting Cache

`src/screens/DailyInsightsScreen.tsx` previously wrote the generated fallback
message directly as a raw string under `delta-greeting-${userId}-${date}`.
Phase 117 keeps the same key pattern but stores the message in a 24-hour TTL
envelope through:

```text
src/services/storage/dailyGreetingCache.ts
```

The helper reads valid legacy raw strings and rewrites them into the envelope
on the next successful screen path. Oversized, malformed, or expired values are
ignored and removed.

## Why Not SecureStore

Generic offline health cache payloads can include lists of logs, summaries,
derived insight payloads, workout plans, and profile-like API responses. They
are too large and variable for blind SecureStore migration. Phase 117 uses
TTL/minimization and cleanup, while leaving encrypted large-cache storage as a
future product/storage decision.

Small settings already use SecureStore where appropriate:

- menstrual settings,
- HealthKit enabled flag,
- HealthKit last sync timestamp,
- body scan enabled flag.

## Remaining Deferred Work

- Weather/location cache remains in finding `009`.
- Notification preference storage remains in finding `011`.
- Encrypted large-cache storage remains a broader storage-strategy decision.
- User-visible local cache clearing controls are not added in this phase.
- This phase does not remove or redesign offline functionality.

## Verification

Added or updated tests:

- `src/services/storage/offlineHealthCacheStorage.test.ts`
- `src/services/storage/dailyGreetingCache.test.ts`
- `src/services/offlineCache.test.ts`
- `src/services/prefetch.test.ts`

Coverage includes:

- TTL envelope creation,
- valid cache reads,
- expired cache cleanup,
- legacy `CachedData` rewrite,
- legacy raw object/array handling,
- malformed storage cleanup,
- token-like field minimization,
- raw image/blob-like field stripping,
- conservative array caps,
- generated greeting TTL/legacy behavior,
- pending sync regression coverage,
- avatar/body-scan regression coverage through the existing test suite.
