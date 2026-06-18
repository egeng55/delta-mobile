# Mobile Sensitive Cache Strategy

Last inspected: 2026-06-18.

This is a planning document only. It does not change runtime behavior, add
dependencies, migrate data, delete local data, mutate Supabase, or touch
backend/site code.

## 1. Remaining Local Cache Inventory

Phase 71 moved only small sensitive preference-style values to SecureStore:

- `menstrual_settings_${userId}`
- `@delta_healthkit_enabled`
- `@delta_health_last_sync`

The remaining local cache/storage surfaces are larger, more operationally
risky, or require a product decision before migration:

| Area | File | Current key or pattern | Data held locally |
| --- | --- | --- | --- |
| Chat transcripts | `src/components/Chat/ChatBottomSheet.tsx` | `@delta_conversations_${userId}` | message text, titles, timestamps, optional image URI metadata |
| Current chat selection | `src/components/Chat/ChatBottomSheet.tsx` | `@delta_current_conversation_${userId}` | selected conversation id |
| Generic offline cache | `src/services/offlineCache.ts` | `delta_cache_${resource}_${userId}` | cached API resource payloads |
| Pending sync queue | `src/services/offlineCache.ts` | `delta_pending_sync` | queued write/replay payloads and endpoint metadata |
| Prefetch cache | `src/services/prefetch.ts` | `@delta_insights_analytics_${userId}` | insights, derivatives, cards, weekly data, dashboard targets, health state, causal chains, modules |
| Prefetch workout cache | `src/services/prefetch.ts` | `@delta_insights_workout_${userId}` | workout payload |
| Hook cache | `src/hooks/useInsightsData.ts` | `@delta_insights_${tab}_${userId}` | analytics, workout, calendar, menstrual calendar/settings, cycle phase |
| Generated greeting | `src/screens/DailyInsightsScreen.tsx` | `delta-greeting-${userId}-${date}` | generated health/insight message |
| Weather cache | `src/services/weather.ts` | `@delta_weather_cache` | city/location label, weather, air quality, timestamp |
| Avatar cache | `src/services/avatarService.ts` | `@delta_user_avatar_${userId}` | avatar configuration and any present scan/body metadata |
| Avatar dashboard read | `src/components/Dashboard/PullDownDashboard.tsx` | `@delta_user_avatar_${userId}` | reads avatar payload |
| Body scan flag | `src/screens/AvatarCustomizeScreen.tsx`, `src/screens/SettingsScreen.tsx` | `@delta:bodyScanEnabled` | feature enabled flag |
| Notification preferences | `src/services/notifications.ts` | `notification_settings` | reminder toggles and daily reminder time |

## 2. Sensitivity And Size Classification

| Category | Sensitivity | Expected size | Why it matters |
| --- | --- | --- | --- |
| Chat transcripts | high | medium to large and unbounded | User messages can include health notes, symptoms, images, and private context. |
| Generated insights/greetings | high | small to medium | Text can reveal inferred health status or behavior. |
| Dashboard/health/analytics caches | high | medium to large | Includes health state, targets, causal chains, modules, weekly summaries, and menstrual calendar data. |
| Pending sync payloads | high | variable | May contain unsynced user-entered health/tracking payloads and replay endpoint metadata. |
| Offline resource caches | mixed | variable | Risk depends on resource; menstrual/profile/insights are high, generic display resources may be lower. |
| Avatar/body-scan metadata | medium to high | small to medium | Abstract avatar style is lower risk; scan-derived fields, mesh/file URIs, and body metadata are high risk. |
| Weather/location cache | medium | small | Stores location label plus environmental context; not health data alone, but location-adjacent. |
| Notification preferences | medium | small | Period reminders and daily health reminders can imply health status or routines. |
| Current conversation id | medium | small | Identifier only, but links to sensitive chat history. |
| Body scan enabled flag | medium | small | Reveals use of body-scanning capability. |

## 3. Recommended Handling Per Category

| Category | Recommended handling |
| --- | --- |
| Chat transcripts | Do not move to SecureStore. Add history cap and TTL first; then choose encrypted large storage or server-backed history with minimal local cache. |
| Generated insights/greetings | Minimize payload and add short TTL. Prefer not persisting full generated text unless encrypted. |
| Dashboard/health/analytics caches | Add TTL enforcement and payload minimization. Move high-risk data to encrypted large storage only after dependency/storage decision. |
| Menstrual calendar/cache data | Keep Phase 71 settings in SecureStore. Calendar/log cache should use encrypted large storage or be fetched on demand with TTL. |
| Pending sync queue | Highest reliability risk. Use encrypted large storage or encrypted file-backed queue; never drop valid unsynced payloads during migration. |
| Generic offline cache | Classify by resource before writing. Low-risk resource caches may remain in AsyncStorage; high-risk resources need encryption or no persistence. |
| Weather/location cache | Keep in AsyncStorage with 30-minute TTL if minimized to coarse location/weather. Avoid storing raw coordinates. |
| Avatar config | Keep abstract template/style/skin-tone fields in AsyncStorage if schema is verified. Move or delete scan/body/file URI metadata. |
| Body scan flag | Move to SecureStore if paired with body-scan metadata work; acceptable to leave until that phase if no scan payload is cached. |
| Notification preferences | Keep generic toggles in AsyncStorage; move period/reminder preferences to SecureStore if they encode menstrual tracking. |
| Current conversation id | Keep only if transcript strategy keeps local history; otherwise remove with chat history migration. |

Storage target definitions:

- `AsyncStorage`: low sensitivity, small or medium, non-health UI state.
- `SecureStore`: small sensitive values only, not transcripts or large caches.
- Encrypted large storage: chat transcripts, pending sync, dashboard/health
  caches, and scan/body metadata if local persistence is required.
- Minimize/TTL: generated insight text, weather/location, dashboard summaries.
- Server-only: data that can be fetched reliably and does not need offline use.
- Do not persist: stale generated copy, malformed cache entries, raw coordinates,
  unknown cache resources, and scan artifacts that are already synced.

## 4. Migration Strategy

Use a phased approach instead of one broad cache rewrite.

1. Define a storage classification map.
   - Resource names such as `insights`, `calendar`, `menstrual`, `profile`,
     `derivatives`, `workout`, and `tracking` should be explicitly classified.
   - Unknown resources should default to no persistence or short TTL until
     classified.

2. Add cache policy helpers.
   - `shouldPersist(resource)`
   - `storageTargetForResource(resource)`
   - `ttlForResource(resource)`
   - `sanitizePayloadForResource(resource, payload)`

3. Start with minimization and TTL.
   - This avoids adding an encrypted-storage dependency before the product
     requirements are clear.
   - Generated greetings should expire daily.
   - Weather should remain 30 minutes or shorter and store coarse labels only.
   - Dashboard caches should store display-ready summaries rather than raw
     health state when possible.

4. Choose encrypted large storage before moving chat or pending sync.
   - SecureStore is not appropriate for unbounded chat history or large API
     response caches.
   - Candidate approaches should be evaluated separately for Expo support,
     native build impact, backup behavior, size/performance, and migration
     testability.

5. Migrate each category with legacy fallback.
   - Read new target first.
   - Read old AsyncStorage key if new target is missing.
   - Validate and sanitize the old payload.
   - Write to new target.
   - Read back or otherwise verify.
   - Remove old key only after verified success.
   - If write/verification fails, keep old key and do not print payload values.

6. Add user-visible privacy controls after storage mechanics are stable.
   - Clear local chat history.
   - Clear cached insights.
   - Clear offline pending data only with explicit explanation.
   - Disable local history where feasible.

## 5. Data-Loss Risks

Chat transcripts:

- Risk: deleting user-visible history during migration.
- Mitigation: cap or encrypt first; only remove legacy key after verified
  migration.

Pending sync:

- Risk: losing unsynced tracking payloads or replaying duplicates.
- Mitigation: each item needs stable id, attempt count, migration marker, and
  post-migration dedupe behavior.

Dashboard and insights cache:

- Risk: slower startup or blank states if cache is removed too aggressively.
- Mitigation: keep UI fallbacks and background refresh; minimize before
  removing.

Weather/location:

- Risk: lower personalization if cache is shortened.
- Mitigation: keep short TTL and refetch with permission; avoid storing raw
  coordinates.

Avatar/body scan:

- Risk: user avatar appears reset or scan assets disappear.
- Mitigation: separate abstract avatar preferences from body/scan artifacts.

## 6. User Privacy Controls Needed Later

Add controls after storage mechanics are defined:

- Clear local chat history.
- Disable local chat transcript persistence.
- Clear cached insights and dashboard data.
- Clear weather/location cache.
- Clear avatar/body-scan local artifacts.
- Show last local cache clear timestamp.
- Explain that clearing local cache does not delete server-side account data.
- Separate "clear pending sync" from normal cache clearing because it can drop
  unsynced user-entered data.

## 7. Exact Phase 73 Implementation Recommendation

Delta Phase 73 — Mobile Cache Policy And TTL Minimization

Goal:

Implement a storage policy layer for large/sensitive mobile caches without
adding encrypted-storage dependencies yet.

Scope:

1. Add a cache policy helper that classifies resources by sensitivity and TTL.
2. Update `offlineCache.ts` to refuse or shorten persistence for unknown and
   high-risk resources unless explicitly allowed.
3. Add TTL/minimization for generated greetings in `DailyInsightsScreen`.
4. Keep weather in AsyncStorage but verify it stores no raw coordinates and
   keeps a short TTL.
5. Add tests for resource classification, TTL behavior, and unknown-resource
   handling.

Do not:

- migrate chat transcripts
- migrate pending sync payloads
- add encrypted-storage dependencies
- delete valid pending sync data
- mutate Supabase
- touch backend/site
- run live mic, TTS, notifications, memory writes, deployment, schema, auth,
  billing, privacy, or terms changes

Verification:

- `npm test -- --runInBand`

Expected output:

- cache policy file
- offline cache classification tests
- generated greeting TTL/minimization tests if practical
- final report listing what remains deferred to encrypted large-storage phase
