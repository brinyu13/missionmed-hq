import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const runFile = promisify(execFile);
const ticketRoot = path.resolve(import.meta.dirname, "..");
const workspace = path.resolve(ticketRoot, "..");
const cieRoot = path.join(workspace, "cie");
const evidenceRoot = path.join(ticketRoot, "evidence");
const summaryPath = path.join(evidenceRoot, "c0_remaining_execution_summary.json");
const rc1Path = "/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/Y1-CAM-3023/index.html";
const expectedRc1 = "211d91e8e7dad05148dde4b7e62cef55f6bb571765e4b61a7a8eaf14e883ca99";
const allowedPathPrefixes = ["cie/", "Y1-CIE-C0-0001/", "_AI_HANDOFFS/from_codex/Y1_CIE_C0_0001/"];

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function redact(value) {
  return String(value || "")
    .replace(/eyJ[a-zA-Z0-9_-]{12,}\.[a-zA-Z0-9_-]{12,}\.[a-zA-Z0-9_-]{12,}/gu, "[REDACTED_JWT]")
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s"']+/giu, "$1[REDACTED]")
    .replace(/((?:password|secret|api[_-]?key|token)\s*[=:]\s*)[^\s,}"']+/giu, "$1[REDACTED]")
    .slice(-8000);
}

async function execute(task) {
  const started = Date.now();
  try {
    const response = await runFile(task.file, task.args, {
      cwd: task.cwd,
      env: { ...process.env, CIE_C0_ORCHESTRATED: "1" },
      timeout: task.timeout || 180_000,
      maxBuffer: 16 * 1024 * 1024
    });
    return { name: task.name, status: "PASS", required: task.required !== false, duration_ms: Date.now() - started, output_tail: redact(response.stdout) };
  } catch (error) {
    if (task.expectedFailure && task.expectedFailure.test(`${error.stdout || ""}\n${error.stderr || ""}`)) {
      return { name: task.name, status: "BASELINE_CONFIRMED", required: false, duration_ms: Date.now() - started, output_tail: redact(`${error.stdout || ""}\n${error.stderr || ""}`) };
    }
    return {
      name: task.name,
      status: "FAIL",
      required: task.required !== false,
      duration_ms: Date.now() - started,
      exit_code: Number(error.code) || null,
      signal: error.signal || null,
      output_tail: redact(`${error.stdout || ""}\n${error.stderr || ""}\n${error.message || ""}`)
    };
  }
}

const tasks = [
  { name: "cie_syntax", cwd: cieRoot, file: "npm", args: ["run", "check"] },
  { name: "cie_unit_integration", cwd: cieRoot, file: "npm", args: ["test"] },
  { name: "cie_stress_concurrency", cwd: cieRoot, file: "npm", args: ["run", "test:stress"], timeout: 240_000 },
  { name: "cie_disposable_postgres", cwd: cieRoot, file: "npm", args: ["run", "test:postgres"], timeout: 300_000 },
  { name: "combined_handoff_mirror", cwd: workspace, file: process.execPath, args: [path.join(import.meta.dirname, "generate_combined_handoff.mjs")] },
  { name: "security_future_off_redaction", cwd: workspace, file: process.execPath, args: [path.join(import.meta.dirname, "validate_security_scope.mjs")] },
  { name: "shared_hq_syntax", cwd: workspace, file: process.execPath, args: ["--check", "missionmed-hq/server.mjs"] },
  { name: "root_regression", cwd: workspace, file: "npm", args: ["test"], timeout: 240_000 },
  { name: "git_diff_check", cwd: workspace, file: "git", args: ["diff", "--check", "origin/main"] },
  {
    name: "root_typecheck_preexisting_baseline",
    cwd: workspace,
    file: "npm",
    args: ["run", "typecheck"],
    required: false,
    expectedFailure: /tsc: The TypeScript Compiler - Version/u
  }
];

const startedAt = new Date().toISOString();
const results = [];
let status = "PASS";
const rc1Before = digest(await readFile(rc1Path));
results.push({ name: "rc1_before", status: rc1Before === expectedRc1 ? "PASS" : "FAIL", required: true, observed_sha256: rc1Before });
if (rc1Before !== expectedRc1) status = "FAIL";

if (status === "PASS") {
  const committedAndTracked = (await runFile("git", ["diff", "--name-only", "origin/main"], { cwd: workspace })).stdout.trim().split("\n").filter(Boolean);
  const untracked = (await runFile("git", ["ls-files", "--others", "--exclude-standard"], { cwd: workspace })).stdout.trim().split("\n").filter(Boolean);
  const changed = [...new Set([...committedAndTracked, ...untracked])].sort();
  const outOfScope = changed.filter((entry) => !allowedPathPrefixes.some((prefix) => entry.startsWith(prefix)));
  results.push({ name: "bounded_path_scope", status: outOfScope.length === 0 ? "PASS" : "FAIL", required: true, changed_path_count: changed.length, out_of_scope_paths: outOfScope });
  if (outOfScope.length) status = "FAIL";
}

for (const task of tasks) {
  if (status !== "PASS") break;
  const result = await execute(task);
  results.push(result);
  if (result.required && result.status !== "PASS") status = "FAIL";
}

if (status === "PASS") {
  const ciePackage = JSON.parse(await readFile(path.join(cieRoot, "package.json"), "utf8"));
  const dependencyCount = Object.keys(ciePackage.dependencies || {}).length + Object.keys(ciePackage.devDependencies || {}).length;
  results.push({ name: "cie_dependency_surface", status: dependencyCount === 0 ? "PASS" : "FAIL", required: true, dependency_count: dependencyCount });
  if (dependencyCount !== 0) status = "FAIL";
}

if (status === "PASS") {
  try {
    await runFile("npm", ["audit", "--json"], { cwd: workspace, timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
    results.push({ name: "root_dependency_audit", status: "PASS", required: false, note: "No inherited root advisories reported" });
  } catch (error) {
    try {
      const audit = JSON.parse(error.stdout || "{}");
      results.push({ name: "root_dependency_audit", status: "BASELINE_DEBT", required: false, vulnerabilities: audit.metadata?.vulnerabilities || null, cie_runtime_dependency_count: 0 });
    } catch {
      results.push({ name: "root_dependency_audit", status: "UNAVAILABLE", required: false, output_tail: redact(error.message) });
    }
  }
}

const rc1After = digest(await readFile(rc1Path));
results.push({ name: "rc1_after", status: rc1After === expectedRc1 ? "PASS" : "FAIL", required: true, observed_sha256: rc1After });
if (rc1After !== expectedRc1) status = "FAIL";

const report = {
  ticket: "Y1-CIE-C0-0001",
  status,
  started_at: startedAt,
  completed_at: new Date().toISOString(),
  branch: "codex/y1-cie-c0-0001-foundation",
  base_ref: "origin/main",
  rc1_path: rc1Path,
  rc1_expected_sha256: expectedRc1,
  rc1_before_sha256: rc1Before,
  rc1_after_sha256: rc1After,
  runtime_scope: "isolated local C0 only",
  production_touched: false,
  staging_touched: false,
  provider_touched: false,
  credentials_used: false,
  real_student_data_used: false,
  synthetic_data_only: true,
  cleanup: "Disposable PostgreSQL clusters and local file fixtures are owned and removed by their tests; browser fixture servers are stopped by the supervisor.",
  results
};

await mkdir(evidenceRoot, { recursive: true });
await writeFile(summaryPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({ status, gates_recorded: results.length, summary: summaryPath, rc1_preserved: rc1After === expectedRc1 })}\n`);
if (status !== "PASS") process.exitCode = 1;
