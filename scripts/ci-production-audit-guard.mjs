import { readFileSync } from "node:fs";

const auditPath = process.argv[2] ?? "/tmp/mobile-audit.json";
const baseline = { critical: 0, high: 9, moderate: 11, low: 0 };
const requiredCountFields = ["critical", "high", "moderate", "low", "total"];
const baselineDirectRuntimeChains = new Set([
  "expo",
  "expo-dev-client",
  "expo-notifications",
]);

function fail(message) {
  throw new Error(message);
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function readAuditJson(path) {
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    fail(`could not read valid npm audit JSON from ${path}: ${error.message}`);
  }
}

function integerCount(value, label) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    fail(`${label} must be a finite non-negative integer`);
  }
  return value;
}

function validateCounts(audit) {
  if (!isPlainObject(audit)) fail("audit payload must be a plain object");
  if (!isPlainObject(audit.metadata)) fail("audit.metadata must be a plain object");
  if (!isPlainObject(audit.metadata.vulnerabilities)) {
    fail("audit.metadata.vulnerabilities must be a plain object");
  }

  const counts = audit.metadata.vulnerabilities;
  const normalized = {};
  for (const field of requiredCountFields) {
    if (!Object.hasOwn(counts, field)) {
      fail(`audit.metadata.vulnerabilities.${field} is required`);
    }
    normalized[field] = integerCount(counts[field], `audit.metadata.vulnerabilities.${field}`);
  }

  if (Object.hasOwn(counts, "info")) {
    normalized.info = integerCount(counts.info, "audit.metadata.vulnerabilities.info");
  }

  const expectedTotal =
    normalized.critical +
    normalized.high +
    normalized.moderate +
    normalized.low +
    (normalized.info ?? 0);
  if (normalized.total !== expectedTotal) {
    fail(
      `audit.metadata.vulnerabilities.total=${normalized.total} does not match severity sum ${expectedTotal}`
    );
  }

  return normalized;
}

function validateDirectRuntimeChains(audit) {
  if (!isPlainObject(audit.vulnerabilities)) {
    fail("audit.vulnerabilities must be a plain object");
  }

  const directRuntimeFindings = [];
  for (const [name, finding] of Object.entries(audit.vulnerabilities)) {
    if (!isPlainObject(finding)) {
      fail(`audit.vulnerabilities.${name} must be a plain object`);
    }
    if (finding.isDirect === true) {
      if (typeof finding.name !== "string" || finding.name.length === 0) {
        fail(`audit.vulnerabilities.${name}.name must be a non-empty string`);
      }
      directRuntimeFindings.push(finding);
    }
  }

  return directRuntimeFindings.filter(
    (finding) => !baselineDirectRuntimeChains.has(finding.name)
  );
}

const audit = readAuditJson(auditPath);
const normalized = validateCounts(audit);
const newDirectRuntimeFindings = validateDirectRuntimeChains(audit);
const failures = [];

for (const [severity, limit] of Object.entries(baseline)) {
  if (normalized[severity] > limit) {
    failures.push(`${severity} findings increased from ${limit} to ${normalized[severity]}`);
  }
}

if (normalized.critical > 0) {
  failures.push("critical production vulnerability findings are not allowed");
}

if (newDirectRuntimeFindings.length > 0) {
  failures.push(
    `new direct runtime vulnerable chains detected: ${newDirectRuntimeFindings
      .map((item) => item.name)
      .join(", ")}`
  );
}

console.log(
  `production audit baseline: critical=${baseline.critical}, high=${baseline.high}, moderate=${baseline.moderate}, low=${baseline.low}`
);
console.log(
  `production audit current: critical=${normalized.critical}, high=${normalized.high}, moderate=${normalized.moderate}, low=${normalized.low}, total=${normalized.total}`
);
console.log(`documented direct runtime chains: ${[...baselineDirectRuntimeChains].join(", ")}`);

if (failures.length > 0) {
  fail(failures.join("; "));
}
