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
const allowedSummary = "17/18 checks passed";
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
if (result.status === 0) process.exit(0);

if (!output.includes(allowedSummary)) {
  fail(`Expo Doctor failed without the documented ${allowedSummary} result`);
}
if (!output.includes(allowedDiagnostic)) {
  fail("Expo Doctor failed without the documented non-CNG native-folder diagnostic");
}

const failedChecks = output.match(/^✖ /gm)?.length ?? 0;
if (failedChecks !== 1) {
  fail(`Unexpected Expo Doctor failure count: ${failedChecks}`);
}

console.log("Expo Doctor reported only the documented Expo 54 non-CNG native-folder advisory.");
