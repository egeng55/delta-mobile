# Mobile release security repair

## Release decision

Blocked. Do not publish a store build or increase the audit baseline to pass.
The application tests and JS/Hermes exports pass, but the existing production
audit gate still fails. Exports are not signed native builds or device tests.

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

## Audit readback

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
