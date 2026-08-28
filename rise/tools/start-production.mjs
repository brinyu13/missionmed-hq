#!/usr/bin/env node
import { prepareRuntimeArtifacts } from "./prepare-runtime.mjs";
import { isProductionEnvironment, startFromEnvironment, validateProductionEnvironment } from "../server.mjs";

if (isProductionEnvironment()) validateProductionEnvironment();
if (process.env.RISE_ARTIFACT_MODE !== "bundled") await prepareRuntimeArtifacts();
await startFromEnvironment();
