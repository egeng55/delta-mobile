# Temporary mobile build-tool risk acceptance

## Decision and authority

The operator approved a narrow build-tool review and, where justified, a
temporary exception in this task on October 15, 2026. Accept the residual risk
of the two advisories below for the reviewed native application build inputs.
This is not a patched/clean audit or a store release approval.

Reviewed application/dependencies: `6c1b2c746d9c77435672f6eccfeae8b97820a796`.
Exception: `mobile-build-tooling-20261015`.
Valid from October 15 00:00 UTC until October 29 00:00 UTC (exclusive).
No automatic renewal. Delete the exception after maintained fixes remove the
findings; a clean audit needs no exception. Changes require a fresh review,
not automatic digest regeneration.

## Findings and reachability

### braces 3.0.3 / GHSA-vfj7-8cjw-p6xm

Deep untrusted brace patterns can exhaust recursive AST walkers. The advisory
remains active and unpatched; the upstream dispute is not relied on as a fix.
It is reached in this dependency graph through micromatch in Metro/Jest
tooling. The tested matching APIs delegate to picomatch rather than recursive
brace expansion. A test replaces braces' export with a throwing sentinel and
verifies the ordinary list/isMatch calls still work. Build/test patterns are
repository controlled. No application import or exported JS source-map entry
for braces or micromatch was found.

Residual risk: hostile build configuration/plugins or attacker-supplied glob
patterns could still reach affected tooling. This acceptance does not permit
accepting those inputs or exposing a development server to untrusted users.

Source: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm

### node-forge 1.4.0 / GHSA-86w9-cpqp-85rv

RSA PKCS#1 v1.5 verification accepts malformed nested DigestAlgorithm content,
with signature-forgery risk under the advisory's low-exponent-key conditions.
There is no published patched version. This is a real unresolved cryptographic
risk, not an advisory to dismiss because unit tests pass.

Installed consumers are Expo CLI and @expo/code-signing-certificates.
The latter verifies certificates/CSRs and verifies locally generated signatures
in signBufferRSASHA256AndVerify. Expo's getCodeSigningInfoAsync returns null
before certificate access when no signature is requested; a provider-free
sentinel test proves that early return. app.json contains no update-signing
certificate or metadata; the bound app.config.ts does not add either. No
node-forge module occurs in either mobile JS source-map inventory.

Residual risk: a different CLI development/signing flow can use the vulnerable
verifier. Do not enable Expo update signing, accept third-party certificates,
CSRs or keys, or treat this review as proof of safe arbitrary certificate
verification. Native OS/store signing is a separate flow and was not exercised.
No live signing credentials, user account, or remote certificate was accessed.

Source: https://github.com/advisories/GHSA-86w9-cpqp-85rv

## Enforcement

- The raw production audit remains visible: 21 high package entries, two root
  advisories, zero critical/moderate. No package is removed from audit output.
- The guard accepts only this exact reviewed graph (including dependent paths,
  advisory ranges/severities, counts and direct-consumer flags), exact lockfile,
  and bound build/application file inventory. A new unrelated finding fails
  even if its count fits the old baseline. Critical findings cannot qualify.
- The binding includes tracked and non-ignored untracked files. Only docs and
  the explicitly named exception implementation/policy/test/evidence files are
  excluded to avoid a circular hash. The existing dependency regression test,
  CI workflow, native projects, app code, assets, manifests and configurations
  remain bound. Symlinks bind link targets without reading external contents.
- npm audit errors, missing/invalid policy, expiry, changed bindings and extra
  findings fail closed. JSON ordering alone does not invalidate the graph.
- Audit policy and review code are trusted repository code requiring review,
  not a security boundary against someone who can rewrite the gate. Clock,
  installed-package integrity and CI environment are also trusted. Ignored
  secrets/environment are not hashed or read. The existing CI must continue
  installing from the lockfile before validation.
- This acceptance does not authorize a development server, update-signing
  feature, untrusted build input, native signing action, or cloud submission.

## Verification

On October 15, 2026, Node 26.7.0 locally (not a claimed Node 24 CI run):

- Focused dependency and exception tests: 45/45.
- Full Jest suite: 20 suites, 170/170 tests.
- TypeScript, Expo dependency compatibility, syntax and diff checks passed.
- Pinned Expo Doctor: 17/18; only the previously reviewed non-CNG native-folder
  advisory; unchanged doctor guard passed.
- Fresh iOS and Android Hermes exports passed with the normal Metro config,
  a scrubbed environment, dotenv disabled and external sockets blocked.
- Source maps: 1,702 iOS / 1,703 Android source entries; zero braces,
  micromatch or node-forge entries. Maps and bundles remain outside Git under
  `/tmp/delta-mobile-reviewed-risk-export-20261015`.
- iOS map SHA-256:
  `17505ec26db47fecc172c88a2d24c06e3964edd03dafc839264e8b2330387e1d`.
- Android map SHA-256:
  `45590d4916090266f82cadf77140ed65920ff477a9df40d065e70a65c900fd0d`.
- Fresh npm production audit passed the guard with an explicit TEMPORARY RISK
  ACCEPTANCE message; raw npm audit still exits nonzero, as expected.
- Negative tests cover expiry, modified source/lock/graph, new consumers,
  advisory/severity changes, errors, critical findings, inconsistent zero
  counts, added/deleted files and formerly baseline-allowed unknown findings.

No inference/provider, account login, Keychain, signing, app-data write, push,
merge, EAS build, store submission or deployment occurred. External reads were
limited to public advisory/dependency/Expo compatibility information.
