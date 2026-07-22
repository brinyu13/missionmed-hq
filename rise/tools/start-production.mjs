#!/usr/bin/env node
import { prepareRuntimeArtifacts } from "./prepare-runtime.mjs";
import { isProductionEnvironment, startFromEnvironment, validateProductionEnvironment } from "../server.mjs";

if (isProductionEnvironment()) validateProductionEnvironment();
await prepareRuntimeArtifacts();
await startFromEnvironment();
