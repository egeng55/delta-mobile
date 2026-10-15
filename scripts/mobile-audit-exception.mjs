import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';

const reviewFiles = new Set([
  'scripts/ci-production-audit-guard.mjs',
  'scripts/mobile-audit-exception.mjs',
  'scripts/mobile-audit-exception.test.js',
  'scripts/mobile-audit-exception.json',
  'scripts/fixtures/mobile-reviewed-audit.json',
]);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical).sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function auditDigest(audit) {
  return sha256(JSON.stringify(canonical({
    counts: audit.metadata?.vulnerabilities,
    findings: audit.vulnerabilities,
  })));
}

// Bind the exception to reviewed build/application inputs, not to a mutable
// severity allowance. Added non-ignored files also invalidate the review.
export function projectDigest(root) {
  const files = [...new Set(execFileSync('git', [
    'ls-files', '--cached', '--others', '--exclude-standard', '-z',
  ], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }).split('\0').filter(Boolean))]
    .filter(file => !file.startsWith('docs/') && !reviewFiles.has(file)).sort();
  return sha256(JSON.stringify(files.map(file => {
    const path = join(root, file);
    const stat = lstatSync(path);
    const content = stat.isSymbolicLink() ? readlinkSync(path) : readFileSync(path);
    return [file, stat.isSymbolicLink() ? 'link' : 'file', sha256(content)];
  })));
}

export function acceptReviewedToolingRisk({ audit, policy, lockDigest, inputDigest, now = Date.now() }) {
  if (policy?.version !== 1 || policy.scope !== 'reviewed-mobile-build-tooling') {
    throw new Error('Invalid mobile audit exception policy');
  }
  const start = Date.parse(policy.reviewedAt);
  const end = Date.parse(policy.expiresAt);
  if (![now, start, end].every(Number.isFinite) || now < start || now >= end ||
      end <= start || end - start > 14 * 24 * 60 * 60 * 1000) {
    throw new Error('Mobile audit exception expired or outside its reviewed time window');
  }
  if (audit.error || audit.auditReportVersion !== 2 ||
      audit.metadata?.vulnerabilities?.critical !== 0 ||
      !audit.vulnerabilities || Object.keys(audit.vulnerabilities).length !== 21) {
    throw new Error('Mobile audit is not the reviewed non-critical report');
  }
  const roots = Object.values(audit.vulnerabilities).flatMap(finding =>
    Array.isArray(finding.via) ? finding.via.filter(via => typeof via === 'object') : []);
  const expected = [
    'https://github.com/advisories/GHSA-86w9-cpqp-85rv',
    'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
  ];
  if (roots.length !== 2 || roots.some(root => root.severity !== 'high') ||
      JSON.stringify(roots.map(root => root.url).sort()) !== JSON.stringify(expected)) {
    throw new Error('Unreviewed advisory present; no exception applies');
  }
  if (lockDigest !== policy.lockfileSha256 || inputDigest !== policy.projectSha256 ||
      auditDigest(audit) !== policy.auditSha256) {
    throw new Error('Mobile audit exception bindings changed; re-review required');
  }
  return { exception: policy.id, expiresAt: policy.expiresAt, acceptedPackageEntries: 21 };
}
