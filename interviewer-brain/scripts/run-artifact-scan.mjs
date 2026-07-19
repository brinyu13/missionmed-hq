import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

import { scanText } from "../tests/helpers/scanners.mjs";

const PACKAGE_ROOT = resolve(new URL("..", import.meta.url).pathname);
const REPOSITORY_ROOT = resolve(PACKAGE_ROOT, "..");
const ROOTS = [
  PACKAGE_ROOT,
  resolve(REPOSITORY_ROOT, "Y2-3100-3101-3102"),
  resolve(REPOSITORY_ROOT, "_AI_HANDOFFS/from_codex/Y2_3100_3101_3102"),
];
const OUTPUT = resolve(REPOSITORY_ROOT, "Y2-3100-3101-3102/evidence/Y2_3101_ARTIFACT_PRIVACY_SCAN.json");
const TEXT_EXTENSIONS = new Set([".js", ".json", ".md", ".mjs", ".txt"]);

async function filesUnder(path) {
  let entries;
  try { entries = await readdir(path, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
  const files = [];
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(child));
    else if (entry.isFile() && TEXT_EXTENSIONS.has(child.slice(child.lastIndexOf(".")))) files.push(child);
  }
  return files;
}

const files = [...new Set((await Promise.all(ROOTS.map(filesUnder))).flat())]
  .filter((path) => path !== OUTPUT)
  .sort();
const findings = [];
for (const path of files) {
  const scan = scanText(await readFile(path, "utf8"));
  if (scan.credentials.length || scan.real_data.length) {
    findings.push({ path: relative(REPOSITORY_ROOT, path), credential_patterns: scan.credentials, real_data_patterns: scan.real_data });
  }
}
const report = {
  contract_version: "missionmed.y2.artifact-privacy-scan.v1",
  roots: ROOTS,
  scanned_files: files.length,
  credential_or_real_data_findings: findings,
  pass: findings.length === 0,
};
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ output: OUTPUT, scanned_files: files.length, findings: findings.length, pass: report.pass }));
if (!report.pass) process.exitCode = 1;
