#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const configIndex = process.argv.indexOf("--config");
if (configIndex < 0 || !process.argv[configIndex + 1]) {
  console.error("CONFIG_PATH_REQUIRED");
  process.exitCode = 2;
} else {
  const configPath = resolve(process.argv[configIndex + 1]);
  const config = JSON.parse(await readFile(configPath, "utf8"));
  if (config.mode !== "LOCAL_WORKER_SIMULATOR_NOT_CONNECTED" || config.connected !== false) {
    console.error("CONNECTED_WORKER_CONFIGURATION_REFUSED");
    process.exitCode = 3;
  } else {
    console.log(JSON.stringify({
      status: "CONFIG_VALIDATED_NO_WORK_STARTED",
      mode: config.mode,
      connected: config.connected,
      workerId: config.workerId,
      warning: "LOCAL_CONTRACT_FIXTURE_ONLY",
    }));
  }
}

