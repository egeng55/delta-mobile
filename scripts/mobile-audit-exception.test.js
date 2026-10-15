const { readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync, execFileSync } = require('node:child_process');

const root = join(__dirname, '..');
const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures/mobile-reviewed-audit.json')));
const policy = JSON.parse(readFileSync(join(__dirname, 'mobile-audit-exception.json')));
const reviewedTime = Date.parse('2026-10-15T12:00:00.000Z');

function evaluate(mutate = () => {}) {
  const input = {
    audit: JSON.parse(JSON.stringify(fixture)), policy: { ...policy },
    lockDigest: policy.lockfileSha256, inputDigest: policy.projectSha256, now: reviewedTime,
  };
  mutate(input);
  return spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { readFileSync } from 'node:fs';
    import { acceptReviewedToolingRisk } from './scripts/mobile-audit-exception.mjs';
    try { console.log(JSON.stringify(acceptReviewedToolingRisk(JSON.parse(readFileSync(0, 'utf8'))))); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  `], { cwd: root, input: JSON.stringify(input), encoding: 'utf8', timeout: 10000 });
}

test('accepts only the reviewed risk, explicitly not a clean audit', () => {
  const result = evaluate();
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({
    exception: 'mobile-build-tooling-20261015', expiresAt: policy.expiresAt, acceptedPackageEntries: 21,
  });
});

test.each([
  ['expiry boundary', i => { i.now = Date.parse(policy.expiresAt); }],
  ['before review', i => { i.now = Date.parse(policy.reviewedAt) - 1; }],
  ['invalid date', i => { i.policy.expiresAt = 'invalid'; }],
  ['longer than 14 days', i => { i.policy.expiresAt = '2026-11-01T00:00:00Z'; }],
  ['wrong scope', i => { i.policy.scope = 'all'; }],
  ['changed lock', i => { i.lockDigest = '0'.repeat(64); }],
  ['changed application', i => { i.inputDigest = '0'.repeat(64); }],
  ['critical', i => { i.audit.metadata.vulnerabilities.critical = 1; }],
  ['audit unavailable', i => { i.audit.error = { code: 'ENETUNREACH' }; }],
  ['unknown audit format', i => { i.audit.auditReportVersion = 3; }],
  ['new advisory', i => { i.audit.vulnerabilities.braces.via[0].url += '-new'; }],
  ['changed severity', i => { i.audit.vulnerabilities.braces.via[0].severity = 'critical'; }],
  ['changed affected range', i => { i.audit.vulnerabilities.braces.via[0].range = '*'; }],
  ['new dependency path', i => { i.audit.vulnerabilities.braces.nodes.push('node_modules/new/braces'); }],
  ['new direct consumer', i => { i.audit.vulnerabilities.braces.isDirect = true; }],
  ['extra issue', i => { i.audit.vulnerabilities.extra = { isDirect: true, name: 'extra' }; }],
  ['hidden metadata change', i => { i.audit.metadata.vulnerabilities.high = 20; }],
])('fails closed for %s', (_name, mutate) => {
  const result = evaluate(mutate);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
});

test('JSON ordering does not invalidate equivalent advisory evidence', () => {
  expect(evaluate(i => {
    i.audit.vulnerabilities = Object.fromEntries(Object.entries(i.audit.vulnerabilities).reverse());
    for (const finding of Object.values(i.audit.vulnerabilities)) {
      finding.via.reverse(); finding.nodes.reverse(); finding.effects.reverse();
    }
  }).status).toBe(0);
});

test('the real guard accepts the bound report only within its fixed validity window', () => {
  const result = spawnSync(process.execPath, ['scripts/ci-production-audit-guard.mjs',
    'scripts/fixtures/mobile-reviewed-audit.json'], { cwd: root, encoding: 'utf8', timeout: 10000 });
  const valid = Date.now() >= Date.parse(policy.reviewedAt) && Date.now() < Date.parse(policy.expiresAt);
  expect(result.status).toBe(valid ? 0 : 1);
  if (valid) expect(result.stdout).toContain('TEMPORARY RISK ACCEPTANCE (not a clean audit)');
});

test.each([
  ['unreviewed issue below the old baseline', { high: 1, critical: 0, total: 1 }, { other: { name: 'other', isDirect: false } }],
  ['zero counts hiding a finding', { high: 0, critical: 0, total: 0 }, { other: { name: 'other', isDirect: false } }],
])('CLI rejects %s', (_name, counts, vulnerabilities) => {
  const dir = mkdtempSync(join(tmpdir(), 'delta-exception-negative-'));
  try {
    const path = join(dir, 'audit.json');
    writeFileSync(path, JSON.stringify({ metadata: { vulnerabilities: { moderate: 0, low: 0, ...counts } }, vulnerabilities }));
    const result = spawnSync(process.execPath, ['scripts/ci-production-audit-guard.mjs', path], {
      cwd: root, encoding: 'utf8', timeout: 10000,
    });
    expect(result.status).toBe(1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('project binding detects modified, new and deleted application inputs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'delta-input-binding-'));
  try {
    execFileSync('git', ['init', '-q', dir]);
    const digest = () => execFileSync(process.execPath, ['--input-type=module', '-e', `
      import { projectDigest } from './scripts/mobile-audit-exception.mjs';
      console.log(projectDigest(process.argv[1]));
    `, dir], { cwd: root, encoding: 'utf8', timeout: 10000 }).trim();
    writeFileSync(join(dir, 'App.tsx'), 'original');
    const original = digest();
    writeFileSync(join(dir, 'App.tsx'), 'changed');
    expect(digest()).not.toBe(original);
    writeFileSync(join(dir, 'App.tsx'), 'original');
    writeFileSync(join(dir, 'new.ts'), 'new dependency');
    expect(digest()).not.toBe(original);
    rmSync(join(dir, 'new.ts'));
    expect(digest()).toBe(original);
    mkdirSync(join(dir, 'docs'));
    writeFileSync(join(dir, 'docs/review.md'), 'documentation only');
    expect(digest()).toBe(original);
    rmSync(join(dir, 'App.tsx'));
    expect(digest()).not.toBe(original);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('repository glob matching does not execute braces recursive expansion', () => {
  const result = spawnSync(process.execPath, ['-e', `
    const bracesPath = require.resolve('braces');
    require(bracesPath);
    require.cache[bracesPath].exports = () => { throw new Error('Unexpected recursive expansion'); };
    const mm = require('micromatch');
    if (!mm.isMatch('src/example.ts', '**/*.{js,ts}')) throw new Error('Mismatch');
    if (mm(['src/example.ts', 'image.png'], ['**/*.{js,ts}']).length !== 1) throw new Error('Mismatch');
  `], { cwd: root, encoding: 'utf8', timeout: 10000 });
  expect(result.status).toBe(0);
});

test('Expo signing is not configured and no-signature requests do not load certificate tooling', () => {
  const result = spawnSync(process.execPath, ['-e', `
    const fs = require('node:fs'), path = require('node:path');
    const app = JSON.parse(fs.readFileSync('app.json')).expo;
    if (app.updates?.codeSigningCertificate || app.updates?.codeSigningMetadata) throw new Error('Signing enabled');
    const certificates = require.resolve('@expo/code-signing-certificates');
    require.cache[certificates] = { exports: new Proxy({}, { get() { throw new Error('Certificate access'); } }) };
    const cli = path.join(path.dirname(require.resolve('expo/package.json')), 'node_modules/@expo/cli/build/src/utils/codesigning.js');
    require(cli).getCodeSigningInfoAsync(app, undefined, undefined).then(result => {
      if (result !== null) throw new Error('Unexpected signing');
    }).catch(() => { process.exitCode = 1; });
  `], { cwd: root, encoding: 'utf8', timeout: 10000 });
  expect(result.status).toBe(0);
});
