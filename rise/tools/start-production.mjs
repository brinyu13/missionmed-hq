#!/usr/bin/env node
import { prepareRuntimeArtifacts } from "./prepare-runtime.mjs";
import { startFromEnvironment } from "../server.mjs";

await prepareRuntimeArtifacts();
await startFromEnvironment();
