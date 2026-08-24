import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const defaultBinary = join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "expo-doctor.cmd" : "expo-doctor"
);
const doctorBinary = process.env.EXPO_DOCTOR_BIN ?? defaultBinary;
const passingSummary = "18/18 checks passed";
const allowedFailureSummary = "17/18 checks passed";
const allowedDiagnostic = "Check for app config fields that may not be synced in a non-CNG project";

function fail(message) {
  throw new Error(message);
}

function runDoctor(args) {
  return spawnSync(doctorBinary, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
  });
}

function combinedOutput(result) {
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

if (!existsSync(doctorBinary)) {
  fail(`pinned Expo Doctor binary is unavailable at ${doctorBinary}`);
}

const version = runDoctor(["--version"]);
process.stdout.write(combinedOutput(version));
if (version.error) fail(`could not execute Expo Doctor: ${version.error.message}`);
if (version.status !== 0) fail(`Expo Doctor --version failed with status ${version.status}`);

const result = runDoctor([]);
const output = combinedOutput(result);
process.stdout.write(output);
if (result.error) fail(`could not execute Expo Doctor: ${result.error.message}`);
if (result.status === 0) {
  if (output.includes("✖ ")) fail("Expo Doctor passed while reporting failed diagnostics");
  if (output.includes(passingSummary) || !output.includes("checks failed")) process.exit(0);
  fail("Expo Doctor passed with malformed output");
}

if (!output.includes(allowedFailureSummary)) {
  fail(`Expo Doctor failed without the documented ${allowedFailureSummary} result`);
}
const failedDiagnostics = output
  .split(/\r?\n/)
  .filter((line) => line.startsWith("✖ "))
  .map((line) => line.slice("✖ ".length).trim());
if (failedDiagnostics.length !== 1) {
  fail(`Unexpected Expo Doctor failure count: ${failedDiagnostics.length}`);
}
if (failedDiagnostics[0] !== allowedDiagnostic) {
  fail(`Unexpected Expo Doctor failed diagnostic: ${failedDiagnostics[0]}`);
}

console.log("Expo Doctor reported only the documented Expo 54 non-CNG native-folder advisory.");
