# Mobile build 3 release review

The operator explicitly approved a bounded re-review and rebind on October 20,
2026. This is temporary risk acceptance, not a clean security audit. The original
October 29 expiry, exact advisory graph, dependency lock, and enforcement rules
are unchanged. No new exception or general severity allowance was introduced.

Reviewed application commit: bfe4535520955f5b89a0a4a28e9b19b86fb52d2b.
Project digest: 908dec78eb845d41af8dab45f1ffd749fa624d2272db5e312da2fd82092059b4.

## Fresh evidence

- npm production audit: 21 high entries, zero critical/moderate; its canonical
  digest exactly matches the October 15 reviewed report. The lock digest also
  matches. Current registry versions remain braces 3.0.3 and node-forge 1.4.0;
  both advisories still report no patched version.
- Existing sentinel tests continue to prove repository glob matching avoids
  recursive brace expansion and no-signature Expo requests avoid certificate
  tooling. Update signing remains disabled; no affected library is imported by
  the application changes.
- iOS and Android Hermes exports succeeded with external network denied. The
  one-shot exporter used Metro's node crawler because local Watchman stalled;
  no tracked Metro configuration was changed.
- iOS source map: 1,707 sources, zero braces/micromatch/node-forge entries;
  SHA-256 88831fc7a8fac808acc1d1ed65255676a9fd2053e6858bcccdc8756e7c7450ab.
- Android source map: 1,708 sources, zero affected entries;
  SHA-256 de717ff9bd96a69ee49e830134e45f61a07797ff1f948a02270a82ffca3576a0.
- TypeScript and all 214 tests across 28 suites passed. Expo compatibility
  passed. Pinned Expo Doctor reported only the previously documented non-CNG
  native-folder advisory (17/18), accepted by the unchanged narrow guard.
- `pod install --deployment` reconciled the ignored local Pods without changing
  Podfile.lock. The ignored local Node path now uses `command -v node`.

## Release boundaries

Version remains 1.0.0; native and Expo iOS build numbers are now 3. The backend
image-history change must be live before this build is distributed. Tests and
bundle exports do not establish signed native or on-device success; verify the
EAS build, submission, and Apple processing independently. No historical build
or audit evidence was rewritten.

Original reachability analysis and residual risks remain in
MOBILE_BUILD_TOOL_RISK_ACCEPTANCE_2026_10_15.md. Hostile build inputs and Expo
update-signing certificate workflows remain outside this exception.

Sources:
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-86w9-cpqp-85rv
