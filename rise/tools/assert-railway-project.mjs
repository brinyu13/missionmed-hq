#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const REQUIRED_RAILWAY_TARGET = Object.freeze({
  projectId: "c0113625-951e-46ab-939b-dd57acc0e87c",
  projectName: "missionmed-rise-production",
  environmentId: "549d6597-1962-44cb-b0f5-7d88bd025e31",
  environmentName: "production",
  serviceId: "9bce2090-ce45-4572-8291-e8da5d42acb6",
  serviceName: "missionmed-rise",
});

function fail(message) {
  throw new Error(`RISE Railway target guard failed: ${message}`);
}

export function assertRailwayProjectBinding({ config, status, cwd }) {
  const binding = config?.projects?.[cwd];
  if (!binding) fail(`no exact Railway link exists for ${cwd}`);
  for (const [key, expected] of [
    ["project", REQUIRED_RAILWAY_TARGET.projectId],
    ["environment", REQUIRED_RAILWAY_TARGET.environmentId],
    ["service", REQUIRED_RAILWAY_TARGET.serviceId],
    ["name", REQUIRED_RAILWAY_TARGET.projectName],
  ]) {
    if (binding[key] !== expected) fail(`${key} is not pinned to ${expected}`);
  }
  if (path.resolve(binding.projectPath ?? "") !== cwd) fail("projectPath is not the exact current RISE directory");
  if (status?.id !== REQUIRED_RAILWAY_TARGET.projectId || status?.name !== REQUIRED_RAILWAY_TARGET.projectName) {
    fail("provider readback is not the isolated RISE project");
  }
  const environments = (status?.environments?.edges ?? []).map((edge) => edge?.node);
  const services = (status?.services?.edges ?? []).map((edge) => edge?.node);
  if (!environments.some((entry) => entry?.id === REQUIRED_RAILWAY_TARGET.environmentId && entry?.name === REQUIRED_RAILWAY_TARGET.environmentName)) {
    fail("production environment pin is absent from provider readback");
  }
  if (!services.some((entry) => entry?.id === REQUIRED_RAILWAY_TARGET.serviceId && entry?.name === REQUIRED_RAILWAY_TARGET.serviceName)) {
    fail("application service pin is absent from provider readback");
  }
  return { ...REQUIRED_RAILWAY_TARGET, cwd };
}

export function readAndAssertRailwayProjectBinding({ cwd = process.cwd() } = {}) {
  const exactCwd = fs.realpathSync(cwd);
  const configPath = path.join(os.homedir(), ".railway", "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const result = spawnSync("railway", ["status", "--json"], {
    cwd: exactCwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15_000,
  });
  if (result.status !== 0) fail("provider status readback failed");
  let status;
  try { status = JSON.parse(result.stdout); } catch { fail("provider status readback was not JSON"); }
  return assertRailwayProjectBinding({ config, status, cwd: exactCwd });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const receipt = readAndAssertRailwayProjectBinding();
    process.stdout.write(`${JSON.stringify({ ok: true, ...receipt })}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
