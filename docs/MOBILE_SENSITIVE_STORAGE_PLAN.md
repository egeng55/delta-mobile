# Mobile Sensitive Storage Remediation Plan

Last inspected: 2026-06-21.

This document tracks the mobile sensitive storage plan and the implementation
steps completed so far. It does not contain secrets and should not include raw
cached payload values, tokens, health data, or transcript content.

## 1. Executive Summary

`delta-mobile` already stores Supabase auth session tokens through
`expo-secure-store` in `src/services/supabase.ts`. The remaining storage issue
is non-auth data in `AsyncStorage`.

Phase 71 added a SecureStore-backed helper for small sensitive values and moved
menstrual settings plus HealthKit enabled/last-sync metadata. Large local
payloads remain intentionally deferred. See
`docs/MOBILE_SENSITIVE_CACHE_STRATEGY.md` for the cache-specific strategy.

Phase 78 added a small TTL envelope helper for larger sensitive or
health-adjacent caches where `SecureStore` is not appropriate. Chat transcript
persistence now uses a 14-day TTL, keeps at most 10 conversations, and keeps at
most 50 messages per conversation. Legacy raw transcript arrays are still read
and are rewritten into the TTL format on the next successful load/save path;
expired transcript caches are ignored and removed.

Phase 78 also moved the generated insights/dashboard cache writers onto the
shared TTL envelope. The existing 5-minute insights TTL is preserved, analytics
cache payloads are trimmed to conservative array limits, and prefetch writes use
the same envelope format. This is minimization and expiry only; large
transcripts, generated insights, offline caches, and pending sync payloads were
not moved to `SecureStore`.

Phase 115 hardened pending sync payload persistence for `delta_pending_sync`.
The queue remains in `AsyncStorage` because high-volume replay queues are not a
good fit for `SecureStore`, but it now uses a schema-versioned TTL envelope,
per-item expiry metadata, token-like field minimization, legacy array handling,
malformed queue cleanup, and synced item pruning. See
`docs/MOBILE_PENDING_SYNC_STORAGE.md`.

Phase 117 hardened generic offline health cache persistence for
`delta_cache_${resource}_${userId}`. Known health-derived resources now use a
schema-versioned TTL envelope with resource-level sensitivity metadata,
token-like field stripping, raw image/blob-like field stripping, conservative
array caps, legacy cache handling, and malformed/expired cleanup. Phase 117
also added a TTL envelope for generated daily greetings and explicit
minimization for prefetch analytics arrays. See
`docs/MOBILE_OFFLINE_HEALTH_CACHE.md`.

Phase 133 hardened the weather/location cache at `@delta_weather_cache`.
Weather remains in `AsyncStorage` because it is a short-lived display cache
rather than a small preference for `SecureStore`, but it now uses a
schema-versioned 30-minute TTL envelope, malformed/expired cleanup, fresh
legacy `{ data, timestamp }` handling, token-like field stripping, and
defensive coordinate rounding if coordinate fields are ever present. The
current payload stores city-level location and weather conditions, not precise
coordinates or location history. See `docs/MOBILE_WEATHER_LOCATION_CACHE.md`.

The highest-risk current uses are:

- menstrual settings cache in `src/services/menstrualTracking.ts`
- local chat transcripts in `src/components/Chat/ChatBottomSheet.tsx`
- insights/dashboard/workout/calendar caches in `src/services/prefetch.ts` and
  `src/hooks/useInsightsData.ts`
- HealthKit sync timestamps and enablement flags adjacent to biometric data

Low-sensitivity UI preferences can remain in `AsyncStorage`. High-sensitivity
health, chat, insight, and pending-sync data should move to an encrypted storage
strategy or be minimized/expired instead of persisted.

## 2. Current Storage Map

| Storage mechanism | Current use | Sensitivity | Notes |
| --- | --- | --- | --- |
| `expo-secure-store` | Supabase auth session via `src/services/supabase.ts` | high | Appropriate for auth tokens. |
| `AsyncStorage` | Theme, units, onboarding, design preferences | low | Acceptable if values stay non-health and non-sensitive. |
| `AsyncStorage` | Notification preferences, TTL-bound/minimized avatar config, TTL-bound/minimized weather cache | medium | May reveal preferences, city-level location, or body-related metadata. |
| `SecureStore` | Body scan enabled flag | medium | Phase 116 moved the small body-scan capability flag behind the sensitive storage helper with legacy fallback. |
| `AsyncStorage` | TTL-bound/minimized chat transcripts, insights, dashboard/cache payloads, generic offline cache, pending sync | high | Large/high-volume payloads remain in AsyncStorage only with TTL/minimization until encrypted large-cache storage is explicitly approved. |
| Component state only | transient HealthKit readings in `HealthKitContext` | high | Not persisted directly, but sync timestamps are persisted. |

## 3. AsyncStorage Usage Inventory

| File | Key or pattern | Data stored | Sensitivity |
| --- | --- | --- | --- |
| `src/services/menstrualTracking.ts` | `menstrual_settings_${userId}` | menstrual tracking settings, last period start, notification preference | high |
| `src/services/offlineCache.ts` | `delta_cache_${resource}_${userId}` | generic API cache for insights, workout, calendar, derivatives, profile, menstrual | high for health/profile/menstrual resources; Phase 117 adds a schema-versioned TTL envelope, resource policy, token/blob stripping, array caps, and malformed cleanup |
| `src/services/offlineCache.ts` | `delta_pending_sync` | queued payloads for replay, including tracking data and endpoint/body content | high; Phase 115 adds 14-day TTL envelope and token-like field minimization |
| `src/services/prefetch.ts` | `@delta_insights_analytics_${userId}` | dashboard, targets, health state, causal chains, modules, insights | high; Phase 117 adds explicit prefetch array minimization before writing the existing TTL envelope |
| `src/services/prefetch.ts` | `@delta_insights_workout_${userId}` | workout payload | medium to high |
| `src/hooks/useInsightsData.ts` | `@delta_insights_${tab}_${userId}` | analytics, workout, calendar, menstrual calendar/settings/cycle phase | high |
| `src/components/Chat/ChatBottomSheet.tsx` | `@delta_conversations_${userId}` | local chat transcripts and conversation titles | high |
| `src/components/Chat/ChatBottomSheet.tsx` | `@delta_current_conversation_${userId}` | selected conversation id | medium |
| `src/services/weather.ts` | `@delta_weather_cache` | city-level location name, weather, air quality, timestamp | medium; Phase 133 adds a 30-minute TTL envelope, token-like field stripping, legacy handling, malformed/expired cleanup, and defensive coordinate rounding |
| `src/services/avatarService.ts` | `@delta_user_avatar_${userId}` | avatar configuration and possible scan/body metadata fields | medium to high; Phase 116 adds a 30-day TTL envelope and minimization |
| `src/components/Dashboard/PullDownDashboard.tsx` | `@delta_user_avatar_${userId}` | reads same avatar payload | medium to high; Phase 116 reads through the avatar/body-scan storage helper |
| `src/screens/AvatarCustomizeScreen.tsx` | `@delta:bodyScanEnabled` legacy, `delta_sensitive_body_scan_enabled` current | body scan feature flag | medium; Phase 116 migrates the small flag to SecureStore |
| `src/screens/SettingsScreen.tsx` | `@delta:bodyScanEnabled` legacy, `delta_sensitive_body_scan_enabled` current | body scan feature flag | medium; Phase 116 writes the small flag through SecureStore |
| `src/services/notifications.ts` | `notification_settings` | reminder toggles, daily reminder time, period reminder setting | medium |
| `src/services/healthSync.ts` | `@delta_health_last_sync` | HealthKit sync timestamp | medium |
| `src/context/HealthKitContext.tsx` | `@delta_healthkit_enabled` | HealthKit enabled flag | medium |
| `src/screens/DailyInsightsScreen.tsx` | `delta-greeting-${userId}-${date}` | generated health greeting/insight fallback text | high; Phase 117 adds a 24-hour TTL envelope and legacy raw string handling |
| `src/context/DeltaUIContext.tsx` | `delta-ui-prefs-${userId}` | behavioral UI preferences derived from taps/dismissals | medium |
| `src/context/ThemeContext.tsx` | `@delta_theme_preference` | theme preference | low |
| `src/context/ThemeContext.tsx` | `@delta_fitness_goal` | goal tint preference | medium because it can imply health goal |
| `src/context/UnitsContext.tsx` | `@delta_unit_system` | unit preference | low |
| `src/screens/OnboardingScreen.tsx` | `onboarding_complete` key | onboarding completion flag | low |

## 4. Sensitivity Classification

Low sensitivity:

- theme preference
- onboarding complete flag
- unit system
- non-health UI display preferences

Medium sensitivity:

- notification settings and reminder times
- weather/location cache
- HealthKit enabled and last-sync timestamps
- avatar configuration and body-scan feature flag
- fitness goal if used only for display tinting
- behavioral UI preferences derived from taps/dismissals

High sensitivity:

- menstrual settings and cycle-related values
- chat transcripts and health conversations
- generated insights and greeting fallback messages
- dashboard, health state, causal chain, workout, calendar, and menstrual caches
- pending sync payloads
- avatar/body metadata if scan-derived or health-revealing

## 5. Recommended Storage Target Per Usage

| Usage | Recommendation |
| --- | --- |
| Supabase auth session | Keep in `SecureStore`; already correct. |
| Theme, onboarding, units | Keep in `AsyncStorage`. |
| Notification settings | Keep in `AsyncStorage` only if limited to generic toggles; move period-reminder preference to secure storage if it implies cycle tracking. |
| Weather cache | Phase 133 keeps the 30-minute TTL, stores city-level weather only, strips token-like fields, and rounds accidental coordinate fields. Broader location strategy remains deferred. |
| HealthKit enabled and last sync | Move to `SecureStore` or encrypted preferences because it reveals health integration usage. |
| Menstrual settings | Move to `SecureStore` if small; otherwise encrypted storage. Remove old AsyncStorage key after verified migration. |
| Chat transcripts | Do not blindly move to `SecureStore`; use encrypted database/file storage or reduce to server-backed history with local TTL. |
| Offline cache / pending sync | Phase 117 adds resource sensitivity classification plus TTL/minimization for generic offline cache entries. Phase 115 adds TTL/minimization for pending sync. Use encrypted large storage only after a separate approved strategy phase. |
| Insights and dashboard caches | Phase 78 added TTL envelopes. Phase 117 adds explicit prefetch array minimization and generic offline cache resource policy. Encrypted large-cache storage remains deferred. |
| Avatar config | Audit schema first. Keep abstract non-body config in `AsyncStorage`; move scan-derived/body metadata or mesh/file URIs to encrypted storage or delete local copy. |
| Daily generated greeting | Phase 117 adds a 24-hour TTL envelope and legacy raw string fallback. |
| Delta UI preferences | Keep non-health display preferences in `AsyncStorage`; avoid storing behavioral inferences that reveal health context. |

## 6. Migration Risk Analysis

Main risks:

- Data loss if old keys are removed before secure writes are verified.
- App startup regressions if large caches are moved into `SecureStore`.
- SecureStore size/performance limits for chat transcripts and large dashboard
  payloads.
- Double-source bugs if screens read old and new locations inconsistently.
- Privacy regression if migration logs raw values.
- Pending sync loss if queued offline writes are deleted before replay or secure
  migration.

Mitigations:

- Introduce a small storage abstraction before migrating call sites.
- Migrate one storage category at a time.
- Read old AsyncStorage key, validate parse, write secure target, read back,
  then remove old key only after success.
- Never log migrated values.
- Add tests for missing old key, malformed old value, successful migration, and
  failed secure write.
- Use TTL/deletion for caches where stale data is less valuable than local
  persistence.

## 7. Proposed Phased Implementation Plan

Phase 71A: Storage policy and abstraction.

- Add a local storage policy document or constants map.
- Add wrappers for `lowSensitivityStorage`, `securePreferencesStorage`, and
  `sensitiveCacheStorage`.
- Do not migrate data yet.

Phase 71B: Small high-sensitivity settings.

- Migrate menstrual settings and HealthKit flags/timestamps first.
- Use `SecureStore` only for small payloads.
- Add migration tests.

Phase 71C: Chat and generated insight persistence.

- Phase 78 added TTL/minimization for local chat transcripts and generated
  insights cache writes.
- A later phase should decide whether encrypted large storage, server-backed
  history, explicit user controls, or stricter deletion is required.
- Continue avoiding SecureStore for large transcripts unless payload size is
  proven small.

Phase 71D: Generic cache and pending sync hardening.

- Phase 115 added TTL envelope, token-like field minimization, legacy handling,
  malformed cleanup, and synced item pruning for `delta_pending_sync`.
- Phase 117 added resource classification, TTL envelope, token-like field
  minimization, raw blob-like field stripping, array caps, legacy handling, and
  malformed cleanup to generic `offlineCache` caches.
- Encrypt high-risk resource caches later only if encrypted large storage is
  explicitly approved.

Phase 71D.1: Weather/location cache hardening.

- Phase 133 added a schema-versioned TTL envelope and cleanup behavior for
  `@delta_weather_cache`.
- Provider tokens are stripped if accidentally present.
- Precise coordinates are not intentionally cached; accidental coordinate
  fields are rounded to two decimal places before storage or return.
- No location permission behavior, provider behavior, or location history was
  added.

Phase 71E: Avatar/body-scan review.

- Audit `UserAvatar` fields and scan-derived payloads.
- Keep abstract style fields in AsyncStorage if needed.
- Move scan/body metadata and file URIs to encrypted storage or delete local
  copies after sync.

## 8. Files Likely Touched

Likely implementation files:

- `src/services/secureStorage.ts` or similar new abstraction
- `src/services/menstrualTracking.ts`
- `src/services/offlineCache.ts`
- `src/services/storage/offlineHealthCacheStorage.ts`
- `src/services/storage/dailyGreetingCache.ts`
- `src/services/storage/weatherLocationCache.ts`
- `src/components/Chat/ChatBottomSheet.tsx`
- `src/services/prefetch.ts`
- `src/hooks/useInsightsData.ts`
- `src/services/healthSync.ts`
- `src/context/HealthKitContext.tsx`
- `src/services/avatarService.ts`
- `src/screens/DailyInsightsScreen.tsx`
- tests/mocks for AsyncStorage and SecureStore

Possibly touched later:

- `package.json` only if adding a large encrypted storage dependency.
- Expo config only if the chosen storage mechanism requires native setup.

## 9. Tests Needed

- Storage policy tests that classify keys/resources correctly.
- Migration tests for menstrual settings:
  - no old value
  - malformed old value
  - successful migration
  - secure write failure leaves old key intact
- HealthKit flag/timestamp migration tests.
- Offline cache resource-classification tests; Phase 117 added these for the
  generic `delta_cache_*` layer.
- Pending sync encryption/drop behavior tests.
- Chat transcript cap/TTL tests once large encrypted storage is chosen.
- Regression test confirming Supabase auth still uses SecureStore.

## 10. Data-Loss Risks and Mitigations

Risks:

- Losing unsynced pending sync payloads after expiry or malformed queue cleanup.
- Losing local chat conversations.
- Losing menstrual tracking preferences when offline.
- Losing cached insights users expect to see on cold start.

Mitigations:

- Preserve old AsyncStorage values until secure write and read-back succeed.
- Keep migration idempotent.
- Avoid deleting pending sync payloads unless they are expired under policy,
  malformed, successfully synced, or impossible for the existing replay logic to
  handle.
- Add a one-time migration status marker that does not include sensitive data.
- Keep user-facing fallbacks for missing cache data.

## 11. What Should Remain In AsyncStorage

- Theme preference.
- Onboarding completion flag.
- Unit system.
- Non-health display preferences.
- Possibly generic notification toggles if not tied to reproductive or health
  status.

## 12. What Should Move To SecureStore Or Encrypted Storage

Move to `SecureStore` or encrypted small-preference storage:

- menstrual settings if payload remains small
- HealthKit enabled flag
- HealthKit last sync timestamp
- period reminder preference if it reveals menstrual tracking
- body scan enabled flag; Phase 116 stores this in SecureStore with legacy
  fallback

Move to encrypted large storage, not raw `SecureStore`:

- chat transcripts
- generated insights/greetings
- dashboard/analytics/calendar caches
- offline high-risk resource caches
- pending sync payloads if a future encrypted large-queue storage strategy is
  explicitly approved; Phase 115 currently uses TTL/minimization instead
- scan-derived avatar/body metadata if encrypted large storage is later
  approved; Phase 116 currently uses TTL/minimization for local metadata

## 13. What Requires A Migration Fallback

- `menstrual_settings_${userId}`
- `@delta_conversations_${userId}`
- `@delta_current_conversation_${userId}`
- `delta_pending_sync`
- `@delta_insights_*`
- `delta-greeting-${userId}-${date}`; Phase 117 reads valid legacy raw strings
  and rewrites them into a 24-hour TTL envelope
- `@delta_healthkit_enabled`
- `@delta_health_last_sync`
- `@delta_user_avatar_${userId}` if schema includes body or scan metadata;
  Phase 116 reads legacy raw avatar objects and rewrites valid metadata into a
  TTL envelope
- `@delta:bodyScanEnabled`; Phase 116 migrates this small flag to
  `delta_sensitive_body_scan_enabled`

Migration fallback should keep reading legacy AsyncStorage until secure storage
is populated and verified.

## 14. What Should Be Deleted Or Expired Instead Of Migrated

- Expired generic cache entries.
- Stale weather cache older than 30 minutes.
- Expired insights/dashboard cache older than its TTL.
- Malformed cache entries.
- Expired or malformed pending sync entries under the Phase 115 TTL envelope.
- Expired or malformed avatar/body-scan metadata under the Phase 116 TTL
  envelope.
- Expired or malformed generic offline health cache entries under the Phase 117
  TTL envelope.
- Expired or malformed generated daily greeting cache entries under the Phase
  117 TTL envelope.
- Unknown pending sync types that cannot be safely replayed by the existing
  sync logic.
- Generated greeting cache after its daily usefulness expires.

Do not delete unsynced user-entered payloads without a migration or explicit
recovery strategy.

## 15. Exact Phase 71 Implementation Prompt

Delta Phase 71 — Mobile Sensitive Storage Abstraction and First Migration

Current state:

- Phase 70 produced `docs/MOBILE_SENSITIVE_STORAGE_PLAN.md`.
- `delta-mobile` auth tokens already use `expo-secure-store`.
- High-risk non-auth data remains in `AsyncStorage`.

Goal:

Implement the first safe storage remediation step without changing backend,
site, schema, auth, billing, privacy, terms, deployment behavior, or product
capabilities.

Scope:

1. Add a small storage abstraction for sensitivity-aware local storage.
2. Keep low-sensitivity UI preferences in `AsyncStorage`.
3. Use `SecureStore` for small sensitive preferences only.
4. Migrate menstrual settings and HealthKit enabled/last-sync values with a
   read-old, write-new, verify, then remove-old flow.
5. Do not migrate chat transcripts or large insight caches yet.
6. Do not add a new encrypted large-storage dependency in this phase unless
   explicitly approved.

Hard constraints:

- Do not mutate Supabase.
- Do not run live mic, TTS, notifications, memory writes, migrations, or
  deployment.
- Do not delete legacy AsyncStorage values until secure write and read-back
  succeed.
- Do not log secret or health values.
- Do not touch backend or site.

Expected files:

- new storage abstraction under `src/services/`
- `src/services/menstrualTracking.ts`
- `src/context/HealthKitContext.tsx`
- `src/services/healthSync.ts`
- tests/mocks for AsyncStorage and SecureStore

Verification:

- `npm test -- --runInBand`
- Any available typecheck/lint script if present.

Final report:

- migrated keys
- legacy fallback behavior
- tests run
- data-loss safeguards
- files changed
- confirmation no backend/site/Supabase/mic/TTS/notification/write actions
