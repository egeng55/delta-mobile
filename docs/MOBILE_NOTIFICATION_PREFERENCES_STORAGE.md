# Mobile Notification Preference Storage

Last reviewed: 2026-06-23.

This document inventories mobile notification preference persistence and the
Phase 135 storage hardening. It should not include device push tokens,
provider credentials, notification payload history, or real user schedules.

## Summary

The only persistent notification preference storage found in `src/` was
`notification_settings` in `src/services/notifications.ts`. The payload is a
small settings object that can reveal health routines and reproductive health
preferences:

- global notifications enabled flag
- daily reminder enabled flag
- daily reminder time
- workout reminder enabled flag
- period reminder enabled flag

Phase 135 moves this small sensitive preference payload to `SecureStore` under
`delta_sensitive_notification_settings`, with legacy AsyncStorage fallback and
cleanup. The phase does not request notification permissions, send
notifications, enable notifications, change notification delivery behavior, or
store push/provider tokens.

## Storage Inventory

| Location | Key | Payload | Sensitivity | Handling | Implementation status |
| --- | --- | --- | --- | --- | --- |
| `src/services/notifications.ts` | `notification_settings` legacy | notification toggles, daily reminder time, workout reminder flag, period reminder flag | medium; can reveal routines, habit timing, and reproductive-health reminder preference | `securestore_needed`, `minimization_needed` | Migrated to SecureStore with legacy fallback |
| `src/services/notifications.ts` | `delta_sensitive_notification_settings` current | normalized notification settings only | medium | `securestore_needed` | Phase 135 complete |
| `src/services/menstrualTracking.ts` | `delta_sensitive_menstrual_settings_${userId}` | menstrual settings including notification preference | high | `safe_no_change_needed` for this finding | Already SecureStore-backed before Phase 135 |
| Scheduled Expo notifications | Expo scheduled notification store | active local notification schedules and content managed by the OS/Expo runtime | medium | `defer_notification_runtime_strategy` | Runtime scheduling behavior unchanged |

No persistent push token storage was found in the current notification service.
The legacy `expo_push_token` constant was not used for reads or writes, and
Phase 135 does not add token storage.

## Payload Policy

The current stored `NotificationSettings` payload is:

```text
enabled
dailyReminder
dailyReminderTime
workoutReminders
periodReminders
```

The persisted value should not include:

- push tokens
- provider tokens
- authorization headers
- notification delivery history
- scheduled notification ids
- raw notification payload history
- free-text content

Phase 135 normalizes the object before persistence. Missing or malformed
fields fall back to defaults, and unknown extra fields are dropped.

## Retention And Cleanup

Notification preferences are long-lived settings. They do not use a TTL because
expiry would silently reset user preferences. Instead:

- malformed SecureStore JSON is deleted and defaults are returned
- malformed legacy AsyncStorage JSON is deleted and defaults are returned
- valid legacy AsyncStorage settings are migrated to SecureStore
- the legacy `notification_settings` value is removed only after SecureStore
  write/read-back verification succeeds
- if SecureStore migration fails, the legacy value is kept and read for that
  session

## SecureStore Decision

`SecureStore` is appropriate here because the notification settings payload is
small and preference-like. It can reveal health routines and the period
reminder flag can imply menstrual tracking. This is different from high-volume
notification history, queues, or local cache payloads, which should not be
blindly moved to `SecureStore`.

## Runtime Boundary

Phase 135 does not change notification permission prompts or delivery behavior.
`getSettings()` performs storage reads and migration only. It does not request
permissions, schedule notifications, send notifications, or call providers.

`saveSettings()` preserves the existing scheduling behavior: after saving
settings it updates the daily reminder schedule according to the stored daily
reminder preference. It does not add new notification types, permission flows,
provider calls, or token storage.

## Verification

Phase 135 adds `src/services/notifications.test.ts` covering:

- default settings reads
- legacy AsyncStorage migration to SecureStore
- legacy value preservation when SecureStore migration fails
- SecureStore writes and legacy cleanup
- malformed SecureStore cleanup
- malformed legacy AsyncStorage cleanup
- preference normalization and extra-field minimization
- no permission request or notification scheduling during settings read
