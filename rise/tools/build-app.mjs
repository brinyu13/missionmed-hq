#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { icons as lucideIcons } from "lucide";

const here = path.dirname(fileURLToPath(import.meta.url));
const riseRoot = path.resolve(here, "..");
const sourceDirectory = path.join(riseRoot, "web");
const defaultOutput = path.join(riseRoot, "dist");
const requiredFiles = ["index.html", "styles.css", "app.js"];
const requiredLucideIcons = [
  "activity",
  "arrow-left",
  "building-2",
  "check",
  "chevron-left",
  "chevron-right",
  "circle-alert",
  "columns-3",
  "layout-dashboard",
  "list-checks",
  "list-filter",
  "messages-square",
  "move-horizontal",
  "network",
  "plus",
  "rotate-ccw",
  "search",
  "search-x",
  "sliders-horizontal",
  "sparkles",
  "table-properties",
  "trash-2",
  "x",
];

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

function toPascalCase(value) {
  return value
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
}

function buildLucideBundle() {
  const icons = Object.fromEntries(requiredLucideIcons.map((name) => {
    const icon = lucideIcons[toPascalCase(name)];
    if (!icon) throw new Error(`Lucide icon is unavailable: ${name}`);
    return [name, icon];
  }));
  return `/**\n * @license lucide v1.24.0 - ISC\n * Selected official icon nodes bundled for MissionMed RISE.\n */\n(() => {\n  "use strict";\n  const icons = ${JSON.stringify(icons)};\n  const defaults = { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" };\n  const namespace = "http://www.w3.org/2000/svg";\n  function createNode([tag, attributes, children]) {\n    const node = document.createElementNS(namespace, tag);\n    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));\n    for (const child of children || []) node.appendChild(createNode(child));\n    return node;\n  }\n  function attributesOf(element) {\n    return Object.fromEntries(Array.from(element.attributes, ({ name, value }) => [name, value]));\n  }\n  function classesOf(value) {\n    if (!value) return [];\n    const candidate = typeof value === "string" ? value : value.class;\n    return Array.isArray(candidate) ? candidate : String(candidate || "").split(" ").filter(Boolean);\n  }\n  function createIcons({ attrs = {}, root = document } = {}) {\n    if (!root) throw new Error("createIcons requires a document root");\n    for (const element of root.querySelectorAll("[data-lucide]")) {\n      const name = element.getAttribute("data-lucide");\n      const icon = icons[name];\n      if (!icon) {\n        console.warn("[Lucide] Icon not present in the RISE bundle: " + name);\n        continue;\n      }\n      const original = attributesOf(element);\n      const hasAccessibilityName = Object.keys(original).some((key) => key.startsWith("aria-") || key === "role" || key === "title");\n      const svgAttributes = { ...defaults, "data-lucide": name, ...(hasAccessibilityName ? {} : { "aria-hidden": "true" }), ...attrs, ...original };\n      svgAttributes.class = Array.from(new Set(["lucide", "lucide-" + name, ...classesOf(original), ...classesOf(attrs)])).join(" ");\n      element.parentNode?.replaceChild(createNode(["svg", svgAttributes, icon]), element);\n    }\n  }\n  globalThis.lucide = { createIcons };\n})();\n`;
}

async function build(outputDirectory) {
  const resolvedOutput = path.resolve(outputDirectory);
  const stagingDirectory = `${resolvedOutput}.staging-${process.pid}`;
  await fs.rm(stagingDirectory, { recursive: true, force: true });
  await fs.mkdir(path.join(stagingDirectory, "vendor"), { recursive: true });
  for (const file of requiredFiles) {
    await fs.copyFile(path.join(sourceDirectory, file), path.join(stagingDirectory, file));
  }
  await fs.writeFile(path.join(stagingDirectory, "vendor/lucide.js"), buildLucideBundle(), { flag: "wx" });
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
