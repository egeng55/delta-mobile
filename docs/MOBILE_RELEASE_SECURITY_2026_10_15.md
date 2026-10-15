# Mobile release security repair

## Release decision

Blocked. Do not publish a store build or increase the audit baseline to pass.
The application tests and JS/Hermes exports pass, but the existing production
audit gate still fails. Exports are not signed native builds or device tests.
Latest follow-up: 145 tests pass; production audit is 0 critical, 21 high,
0 moderate. The two remaining root advisories are braces and node-forge.
See the follow-up section below for the superseding dependency state.

Base: `a4040b7f5f0edb77327281b73dc57f3c74ac8032`.
Expo remains 54.0.37 and React Native remains 0.81.5 in the lockfile.
No app behavior, credentials, permissions, native projects, signing settings,
CI thresholds, or store configuration changed.

## Changes

- Updated shell-quote 1.10.0 to 1.12.0, removing the critical command-injection
  finding (GHSA-pqg4-j6r4-53mv).
- Updated brace-expansion on its existing 1.x, 2.x, and 5.x release lines,
  compression to 1.8.2, source-map-js to 1.2.2, and undici to 6.29.1.
- Scoped the Expo Metro PostCSS dependency to 8.5.30. Expo SDK 54 pins the old
  8.4 release line, so an ordinary lockfile refresh cannot pick up its fixes.
  This is a same-major API override, tested through the actual Expo Metro CSS
  transformer. PostCSS also resolves nanoid to 3.3.20.
- Added 11 regressions for patched dependency floors, Expo's CSS transform,
  and continued rejection of critical findings, high-count regressions, and
  newly vulnerable direct runtime chains.

## Initial repair audit readback

These are npm package-chain counts, not counts of independently exploitable
mobile runtime defects. A single advisory propagates to its dependents.

| Severity | Before | After |
| --- | ---: | ---: |
| Critical | 1 | 0 |
| High | 27 | 22 |
| Moderate | 16 | 16 |
| Total | 44 | 38 |

The existing limits remain critical=0, high=9, moderate=11, low=0. The gate
also continues to reject react-native as a newly affected direct chain.
Nothing is suppressed or newly allowlisted.

Remaining root advisories, checked against npm and the advisory database on
October 15, 2026:

| Package | Blocker |
| --- | --- |
| braces 3.0.3 | No published patched version; propagates through micromatch, Metro, and Jest. |
| node-forge 1.4.0 | No published patched version; Expo CLI/code-signing chain. |
| sprintf-js 1.0.3 | No published patched version, including latest 1.1.3; argparse/js-yaml chain. |
| image-size 1.2.1 | Fixes exist in 2.x, outside Metro's declared 1.x range; requires an independently tested compatibility change. |
| uuid 7.0.3 | Fix exists in 11.1.1+, outside xcode's declared 7.x range; requires an independently tested compatibility change. |

Sources:

- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-86w9-cpqp-85rv
- https://github.com/advisories/GHSA-hp3w-g68c-fv3c
- https://github.com/advisories/GHSA-5p2g-fcmc-qvqq
- https://github.com/advisories/GHSA-w3rx-r6r6-pgpr
- https://github.com/advisories/GHSA-w5hq-g745-h8pq
- https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/

A major Expo upgrade is not proven to eliminate these advisories. Do not
describe it as a guaranteed fix. Next work must choose and verify a maintained
replacement or reviewed upstream/backport fix for the unpatched dependencies,
and test the two incompatible dependency upgrades separately. Any acceptance
of residual risk is a release-policy decision, not a silent baseline refresh.

## Verification

- Clean `npm ci` from the updated lockfile succeeded.
- TypeScript passed.
- Jest: 19 suites, 136 tests passed, including the 11 new regressions.
- `expo install --check`: dependencies up to date.
- Pinned Expo Doctor: 17/18 checks; only the already documented non-CNG
  native-folder advisory. The existing doctor guard passed unchanged.
- iOS export: 1,729 modules, Hermes bundle generated.
- Android export: 1,719 modules, Hermes bundle generated.
- Exported 43 assets. Output stayed under
  `/tmp/delta-mobile-readiness-export-20261015`, outside Git.
- Tests/exports used a scrubbed environment, disabled dotenv loading, and a
  local-only network guard. Package/advisory/Expo compatibility requests were
  used for dependency verification, not application/provider calls.
- `npm run ci:audit:guard -- /tmp/delta-mobile-audit-final-20261015.json`:
  failed as intended on the remaining findings.

No EAS build, TestFlight/App Store/Play submission, cloud deployment, application
data write, provider inference, or live account login was performed.

## Follow-up: remaining dependency chains

Follow-up base: `77c1ad77b2a8a0b59ebef45c6dfb6e7b45aea0a0`.
Expo and React Native remain unchanged. No native, application, audit-guard,
signing, or CI configuration changes were made.

- Pin the Metro package family to 0.83.8, the official patch release replacing
  image-size with maintained parsers. Keep all 14 Expo-pinned Metro components
  aligned; this is an explicit override of Expo's 0.83.3 toolchain pin.
- Pin xcode's uuid dependency to 11.1.1, retaining CommonJS and v4 support.
  Tests parse the existing native project and generate 100 unique Xcode IDs
  in memory without modifying the project.
- Pin @istanbuljs/load-nyc-config's js-yaml dependency to 4.3.2. Its used load()
  interface remains compatible. This removes argparse 1.x and sprintf-js,
  rather than patching or suppressing the vulnerable formatter.
- Add nine regression cases (20 dependency/security cases in total), including
  real Metro buffer and file-path asset APIs, YAML inheritance, Xcode ID
  generation, aligned Metro versions, and absence of removed dependencies.

An initial direct image-size 2.0.4 override was rejected by full export testing:
Metro 0.83.3 also uses the removed synchronous file-path API. That override is
not retained. The official Metro patch avoids a custom compatibility shim.

Official Metro patch:
https://github.com/facebook/metro/releases/tag/v0.83.8

| Severity | Initial repair | Follow-up |
| --- | ---: | ---: |
| Critical | 0 | 0 |
| High | 22 | 21 |
| Moderate | 16 | 0 |
| Total | 38 | 21 |

These are production dependency-chain counts. They are not 21 distinct bugs.
All remaining entries originate in braces 3.0.3 or node-forge 1.4.0; both are
still the latest registry releases and neither has a published patched release
for its remaining advisory as checked on October 15, 2026. The braces advisory
is disputed upstream, but it remains active in npm audit. A dispute is not a
withdrawal or authorization to suppress it.

- https://github.com/github/advisory-database/pull/10132
- https://github.com/micromatch/braces/issues/73
- https://github.com/advisories/GHSA-86w9-cpqp-85rv

Lockfile reachability: braces is pulled through micromatch by Metro's file map
and Jest tooling. node-forge is pulled by Expo CLI and its code-signing package.
Neither library, nor micromatch, image-size or sprintf-js, appears in either
exported mobile JavaScript source map. This is bundle-specific evidence, not
proof that build-time certificate verification is safe. No signing credentials
were loaded and no signing flow was exercised. The dev-only ngrok dependency's
older uuid is outside this production-audit scope and remains unchanged.

### Follow-up verification

- Clean npm ci succeeded from the new lockfile.
- TypeScript passed; Jest passed 19 suites / 145 tests.
- expo install --check passed. Pinned Expo Doctor remained 17/18; the unchanged
  guard accepted only the documented non-CNG native-folder advisory.
- iOS and Android Hermes exports with source maps succeeded, including the
  normal repository Metro configuration. Export output is under
  `/tmp/delta-mobile-followup-default-export-20261015`.
- Source-map inventories: 1,702 iOS / 1,703 Android source entries in the
  initial successful follow-up exports; zero remaining-advisory package hits.
- An existing Watchman crawl initially misreported react/jsx-runtime.js as
  absent after npm ci, despite fs.stat and require.resolve succeeding. A
  temporary Node-crawler-only export isolated it. Resetting only this worktree's
  Watchman watch fixed the normal-config export. No Metro source/config change
  or other worktree watch reset was needed.
- Validation used Node 26.7.0 locally, not the CI Node 24 runner. Network-blocked
  tests/exports used a scrubbed environment with dotenv disabled. Registry,
  advisory, and Expo compatibility reads were the only external activity.
- Production audit guard still fails: high=21 exceeds the unchanged high=9
  baseline, and react-native remains a newly flagged direct chain. No audit
  exception or threshold change was introduced.

Release remains blocked. Further work must address the two upstream tooling
advisories through a maintained fix/replacement or separately reviewed,
specific risk acceptance. Do not present these follow-up changes as a clean
audit or a signed/device-tested mobile release.
