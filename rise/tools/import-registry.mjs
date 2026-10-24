#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importRegistry } from "../src/importer.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultCombinedConfig = path.resolve(here, "../config/combined-specialties.v1.json");
const defaultSourceResolutions = path.resolve(here, "../config/source-resolutions.v1.json");
const defaultDatasetConfig = path.resolve(here, "../config/dataset.v1.json");

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    args[key] = value;
    index += 1;
  }
  return args;
}

function usage() {
  return [
    "Usage:",
    "  node rise/tools/import-registry.mjs --inspect <inspection.ndjson> --out <release-parent>",
    "",
    "Optional:",
    "  --freida-authorization <reviewed-authorization.json>",
    "  --freida-grant <source-owner-grant-file>",
    "  --residency-explorer-authorization <reviewed-authorization.json>",
    "  --residency-explorer-grant <source-owner-grant-file>",
  ].join("\n");
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (!args.inspect || !args.out) throw new Error(usage());
  for (const prohibited of ["combined-config", "source-resolutions", "dataset-config"]) {
    if (args[prohibited]) {
      const error = new Error(`Runtime governance override is prohibited: --${prohibited}`);
      error.code = "RISE_GOVERNANCE_OVERRIDE_PROHIBITED";
      throw error;
    }
  }
  const combinedConfig = JSON.parse(await fs.readFile(defaultCombinedConfig, "utf8"));
  const sourceResolutions = JSON.parse(await fs.readFile(defaultSourceResolutions, "utf8"));
  const datasetConfig = JSON.parse(await fs.readFile(defaultDatasetConfig, "utf8"));
  const result = await importRegistry({
    inspectPath: path.resolve(args.inspect),
    outputDirectory: path.resolve(args.out),
    combinedConfig,
    sourceResolutions,
    expectedSourceContentSha256: datasetConfig.canonicalContentSha256,
    datasetConfig,
    freidaAuthorizationPath: args["freida-authorization"]
      ? path.resolve(args["freida-authorization"])
      : undefined,
    residencyExplorerAuthorizationPath: args["residency-explorer-authorization"]
      ? path.resolve(args["residency-explorer-authorization"])
      : undefined,
    freidaGrantPath: args["freida-grant"] ? path.resolve(args["freida-grant"]) : undefined,
    residencyExplorerGrantPath: args["residency-explorer-grant"]
      ? path.resolve(args["residency-explorer-grant"])
      : undefined,
  });
  process.stdout.write(`${JSON.stringify({
    releaseDirectory: result.releaseDirectory,
    releaseId: result.manifest.releaseId,
    counts: result.manifest.counts,
    releaseGate: result.manifest.releaseGate,
  }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    error: error.message,
    code: error.code ?? "RISE_IMPORT_FAILED",
    details: error.details,
  }, null, 2)}\n`);
  process.exitCode = 1;
}
