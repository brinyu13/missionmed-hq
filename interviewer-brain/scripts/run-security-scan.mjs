import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

import { InactiveAvatarAdapter, InactiveVoiceRailAdapter, loadPersona, loadPlan } from "../src/index.mjs";
import { scanText } from "../tests/helpers/scanners.mjs";

const ROOT = resolve(new URL("..", import.meta.url).pathname);

async function filesUnder(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

const outputArg = process.argv.indexOf("--output");
const output = resolve(outputArg >= 0 ? process.argv[outputArg + 1] : "../Y2-3100-3101-3102/evidence/Y2_3101_SECURITY_SCAN.json");
const sourceFiles = await filesUnder(join(ROOT, "src"));
const sourceFindings = [];
for (const path of sourceFiles) {
  const text = await readFile(path, "utf8");
  const scan = scanText(text);
  const networkImports = [...text.matchAll(/(?:from\s+|import\s*\()["'](?:node:)?(?:http|https|net|tls|dgram|dns)|\bfetch\s*\(/g)].map((match) => match[0]);
  if (scan.credentials.length || scan.real_data.length || networkImports.length) sourceFindings.push({ path: relative(ROOT, path), credentials: scan.credentials, real_data: scan.real_data, network_imports_or_fetch: networkImports });
}
const packageJson = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
const fixtures = JSON.parse(await readFile(join(ROOT, "fixtures/development/cases.json"), "utf8"));
const personas = await Promise.all([
  loadPersona(join(ROOT, "personas/warm-structured.v1.json")),
  loadPersona(join(ROOT, "personas/direct-program-director.v1.json")),
]);
const plan = await loadPlan(join(ROOT, "plans/core-img-interview.v1.json"));
const voice = new InactiveVoiceRailAdapter().descriptor;
const avatar = new InactiveAvatarAdapter().descriptor;
const report = {
  contract_version: "missionmed.y2.security-scan.v1",
  scanned_source_files: sourceFiles.length,
  source_findings: sourceFindings,
  zero_runtime_dependencies: Object.keys(packageJson.dependencies ?? {}).length === 0 && Object.keys(packageJson.devDependencies ?? {}).length === 0,
  synthetic_fixture_package: fixtures.synthetic_only === true && fixtures.cases.length > 0,
  synthetic_personas: personas.every((persona) => persona.provenance.simulated === true && persona.voice_reference === null),
  synthetic_plan: plan.synthetic_only === true,
  voice_inactive: voice.activation_state === "INACTIVE" && voice.provider === null && voice.accepted_writes === false,
  avatar_inactive: avatar.activation_state === "INACTIVE" && avatar.provider === null && avatar.accepted_writes === false,
};
report.pass = report.source_findings.length === 0 && report.zero_runtime_dependencies && report.synthetic_fixture_package && report.synthetic_personas && report.synthetic_plan && report.voice_inactive && report.avatar_inactive;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ output, scanned_source_files: report.scanned_source_files, findings: report.source_findings.length, zero_runtime_dependencies: report.zero_runtime_dependencies, pass: report.pass }));
if (!report.pass) process.exitCode = 1;
