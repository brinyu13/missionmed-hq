#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const riseRoot = path.resolve(here, "..");
const require = createRequire(import.meta.url);
const lucideUmdPath = require.resolve("lucide/dist/umd/lucide.min.js");
const sourceDirectory = path.join(riseRoot, "web");
const defaultOutput = path.join(riseRoot, "dist");
const requiredFiles = ["index.html", "styles.css", "app.js"];

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) throw new Error("Arguments must be --key value pairs");
    result[key.slice(2)] = value;
  }
  return result;
}

async function sha256(filePath) {
  const content = await fs.readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

async function build(outputDirectory) {
  const resolvedOutput = path.resolve(outputDirectory);
  const stagingDirectory = `${resolvedOutput}.staging-${process.pid}`;
  await fs.rm(stagingDirectory, { recursive: true, force: true });
  await fs.mkdir(path.join(stagingDirectory, "vendor"), { recursive: true });
  for (const file of requiredFiles) {
    await fs.copyFile(path.join(sourceDirectory, file), path.join(stagingDirectory, file));
  }
  await fs.copyFile(
    lucideUmdPath,
    path.join(stagingDirectory, "vendor/lucide.js"),
  );
  const outputFiles = [...requiredFiles, "vendor/lucide.js"];
  const hashes = {};
  for (const file of outputFiles) hashes[file] = await sha256(path.join(stagingDirectory, file));
  const buildSeed = JSON.stringify(hashes);
  const buildId = `rise_web_${createHash("sha256").update(buildSeed).digest("hex").slice(0, 12)}`;
  const manifest = {
    schemaVersion: 1,
    buildId,
    activationStatus: "offline_shadow_only",
    files: hashes,
  };
  await fs.writeFile(path.join(stagingDirectory, "asset-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  await fs.rm(resolvedOutput, { recursive: true, force: true });
  await fs.rename(stagingDirectory, resolvedOutput);
  return { outputDirectory: resolvedOutput, manifest };
}

const args = parseArgs(process.argv.slice(2));
build(args.out ?? defaultOutput)
  .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
  .catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
    process.exitCode = 1;
  });
