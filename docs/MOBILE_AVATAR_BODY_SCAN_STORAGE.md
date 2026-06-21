# Mobile Avatar Body-Scan Storage

Last inspected: 2026-06-21.

This document inventories local avatar, body-scan, body-measurement, and
image-adjacent metadata storage in `delta-mobile`. It does not document or
change camera capture, image processing, avatar rendering, Ready Player Me
creation, uploads, backend storage, Supabase storage, or ML behavior.

## Summary

Phase 116 found two local persistence surfaces in scope:

- `@delta_user_avatar_${userId}` in `src/services/avatarService.ts`, read
  directly by `src/components/Dashboard/PullDownDashboard.tsx`.
- `@delta:bodyScanEnabled` in `src/screens/AvatarCustomizeScreen.tsx` and
  `src/screens/SettingsScreen.tsx`.

The body scanner service processes camera poses on-device and does not persist
captured frames. The avatar scan screen persists only avatar configuration and
metadata through `avatarService`; raw images, frame blobs, and scan capture
payloads were not found in AsyncStorage. Profile image upload paths are
server/storage behavior and are outside this finding.

Phase 116 adds:

- a schema-versioned TTL envelope for local avatar/body-scan metadata,
- metadata minimization before local persistence,
- recursive stripping of token-like and raw image/blob-like fields,
- legacy raw avatar object handling,
- expired and malformed local metadata cleanup,
- SecureStore-backed storage for the small body-scan enabled flag with legacy
  AsyncStorage fallback.

## Storage Inventory

| Location | Key or storage | Payload type | Sensitive contents | Current retention after Phase 116 | Cleanup behavior | Classification | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `src/services/avatarService.ts` | `@delta_user_avatar_${userId}` | `UserAvatar` display config plus optional scan metadata | Abstract style preferences, scan method/date, scan confidence, custom proportions, local mesh URI, mesh thumbnail URI, Ready Player Me model/render URLs and ID | 30-day TTL envelope in AsyncStorage | Expired or malformed local metadata is ignored and removed on read | `ttl_needed`, `minimization_needed` | Remediated |
| `src/components/Dashboard/PullDownDashboard.tsx` | `@delta_user_avatar_${userId}` | Direct read of avatar payload for dashboard avatar display | Same as avatar service payload | Reads through `avatarBodyScanStorage` helper | Expired/malformed local metadata is ignored through helper | `ttl_needed`, `minimization_needed` | Remediated |
| `src/screens/AvatarCustomizeScreen.tsx` | `@delta:bodyScanEnabled` legacy fallback, `delta_sensitive_body_scan_enabled` current | Body-scan feature enabled flag | Indicates the user enabled body-scan capability | Stored in SecureStore as a small sensitive preference | Legacy AsyncStorage value migrates after verified secure write | `securestore_small_secret_needed` | Remediated |
| `src/screens/SettingsScreen.tsx` | `@delta:bodyScanEnabled` legacy fallback, `delta_sensitive_body_scan_enabled` current | Body-scan feature enabled flag | Indicates the user enabled body-scan capability | Stored in SecureStore as a small sensitive preference | Legacy AsyncStorage value is removed after secure write | `securestore_small_secret_needed` | Remediated |
| `src/services/bodyScanner.ts` | Component/service memory only | Pose-derived proportions during scan | Pose keypoint ratios while processing | Not persisted directly | Reset by scanner service flow | `safe_no_change_needed` | No local persistence found |
| `src/screens/AvatarScanScreen.tsx` | Saves through `avatarService` | 3D scan URI metadata, Ready Player Me URL metadata, scan method/date | Image/model URI metadata and body-scan provenance | Governed by avatar service TTL/minimization helper | Governed by avatar service helper | `ttl_needed`, `minimization_needed` | Remediated through service |
| `src/screens/ProfileScreen.tsx` and profile image upload paths | Supabase Storage/API, not local avatar body-scan storage | Profile image upload result | User profile image | Outside local storage scope | Outside this phase | `manual_review_needed` for storage/backend privacy work | No change |

## Key Names

- `@delta_user_avatar_${userId}`: local avatar/body-scan metadata cache.
- `@delta:bodyScanEnabled`: legacy body-scan enabled flag.
- `delta_sensitive_body_scan_enabled`: SecureStore key for the body-scan enabled
  flag.

## Payload Classification

Abstract avatar preferences are lower sensitivity:

- template id
- style
- skin tone
- accent color
- outfit and achievement ids
- animation preference

Scan-derived and body-adjacent metadata is higher sensitivity:

- scan method
- scan date
- scan confidence
- custom proportions
- local mesh file URI
- local mesh thumbnail URI
- Ready Player Me avatar/render URLs and avatar id

Phase 116 keeps these in AsyncStorage because this payload can include URI
metadata and may grow beyond the small-value use case for SecureStore. The
local payload is now TTL-bound, schema-versioned, and minimized. Large raw
images, blobs, base64 image data, captured frames, request headers, tokens,
passwords, cookies, and secret-like values are stripped before local
persistence.

## Implementation Details

New helper:

```text
src/services/storage/avatarBodyScanStorage.ts
```

Policy:

- storage key prefix: `@delta_user_avatar`
- schema version: `1`
- payload kind: `avatar_body_scan_metadata`
- TTL: 30 days
- body-scan flag storage: `delta_sensitive_body_scan_enabled` in SecureStore
- legacy avatar format: raw `UserAvatar` object is read and rewritten into the
  TTL envelope if valid
- malformed avatar storage: removed on read
- expired avatar storage: removed on read
- legacy body-scan flag: migrated from `@delta:bodyScanEnabled` after verified
  SecureStore write

The helper preserves display metadata required by the current UI:

- template/style/skin/accent fields,
- outfit and animation ids,
- scan method/date/confidence,
- custom proportions,
- mesh URI and thumbnail URI references,
- Ready Player Me model/render URL metadata and avatar id.

The helper strips:

- token-like keys such as `authorization`, `access_token`, `refresh_token`,
  `password`, `cookie`, and `headers`,
- raw image/blob-like fields such as `imageBase64`, `photoBase64`, `rawImage`,
  `rawPhoto`, `blob`, `bytes`, `frames`, and `captureData`,
- `data:image/...` strings and large base64-looking strings,
- unknown fields not required by `UserAvatar` display.

## Why Not SecureStore For Avatar Metadata

SecureStore is appropriate for small sensitive values and secrets. Avatar
metadata can include URI references, scan provenance, and future display
metadata; it is not a good fit for blind SecureStore migration. Phase 116 uses
TTL/minimization for avatar metadata and SecureStore only for the small
body-scan enabled flag.

## Remaining Deferred Work

- Supabase `profiles.avatar_config` storage behavior is unchanged and remains
  outside this local-storage phase.
- Profile image upload/storage is outside this local avatar/body-scan local
  cache finding.
- Broad encrypted large-cache storage is still a separate product/storage
  decision.
- A user-visible "clear local avatar/body-scan cache" control is not added in
  this phase.

## Verification

Added tests:

- `src/services/storage/avatarBodyScanStorage.test.ts`
- `src/services/avatarService.test.ts`

Coverage includes:

- TTL envelope creation,
- valid metadata reads,
- expired metadata removal,
- legacy raw avatar migration,
- malformed storage cleanup,
- token-like field stripping,
- raw image/blob-like field stripping,
- preservation of safe display metadata,
- SecureStore migration for the body-scan enabled flag,
- avatar service use of the storage helper.
