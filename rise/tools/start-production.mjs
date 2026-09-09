#!/usr/bin/env node
import { prepareRuntimeArtifacts } from "./prepare-runtime.mjs";
import { isProductionEnvironment, startFromEnvironment, validateProductionEnvironment } from "../server.mjs";

if (process.env.RISE_PROCESS_ROLE === "research-worker") {
  const { startResearchWorker } = await import("./start-research-worker.mjs");
  await startResearchWorker();
  process.exit(0);
}

if (isProductionEnvironment()) validateProductionEnvironment();
if (process.env.RISE_ARTIFACT_MODE !== "bundled") await prepareRuntimeArtifacts();
await startFromEnvironment();
