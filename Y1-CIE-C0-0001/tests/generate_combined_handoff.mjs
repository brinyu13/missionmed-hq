import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ticketRoot = path.resolve(import.meta.dirname, "..");
const workspace = path.resolve(ticketRoot, "..");
const combinedName = "Y1_CIE_C0_0001_COMPLETE_COMBINED_HANDOFF.md";
const mirrorRoot = path.join(workspace, "_AI_HANDOFFS", "from_codex", "Y1_CIE_C0_0001");
const orderedReports = Object.freeze([
  "C0_EXECUTION_LEDGER.md",
  "C0_AUTHORITY_AND_OWNERSHIP.md",
  "C0_ARCHITECTURE_AND_ADOPTION.md",
  "C0_CONTRACTS_AND_SCHEMA.md",
  "C0_RUNTIME_IMPLEMENTATION.md",
  "C0_AUTHORIZATION_CONSENT_AND_PRIVACY.md",
  "C0_TIMELINE_MOMENT_REPLAY.md",
  "C0_OPPORTUNITY_AND_PRIORITY.md",
  "C0_TEST_AND_STRESS_REPORT.md",
  "C0_SECURITY_RED_TEAM.md",
  "C0_ACCESSIBILITY_AND_UX.md",
  "C0_ROLLBACK_AND_RELEASE_PLAN.md",
  "C0_SPECIALIST_BOARD.md",
  "C0_FINAL_RELEASE_STATUS.md",
  "C0_EXACT_NEXT_ACTION.md"
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const present = (await readdir(ticketRoot)).filter((name) => name.endsWith(".md") && name !== combinedName).sort();
const expected = [...orderedReports].sort();
if (JSON.stringify(present) !== JSON.stringify(expected)) {
  throw new Error(`Markdown inventory mismatch: expected ${expected.join(", ")}; found ${present.join(", ")}`);
}

const sections = [];
for (const name of orderedReports) {
  const contents = await readFile(path.join(ticketRoot, name), "utf8");
  sections.push(`<!-- BEGIN ${name} -->\n${contents}${contents.endsWith("\n") ? "" : "\n"}<!-- END ${name} -->`);
}

const combined = `# Y1-CIE-C0-0001 Complete Combined Handoff\n\n${sections.join("\n\n")}\n`;
const canonicalPath = path.join(ticketRoot, combinedName);
const mirrorPath = path.join(mirrorRoot, combinedName);
await mkdir(mirrorRoot, { recursive: true });
await writeFile(canonicalPath, combined, { mode: 0o600 });
await writeFile(mirrorPath, combined, { mode: 0o600 });

const canonical = await readFile(canonicalPath);
const mirror = await readFile(mirrorPath);
if (!canonical.equals(mirror)) throw new Error("Combined handoff mirror is not byte-identical");

process.stdout.write(`${JSON.stringify({
  status: "PASS",
  report_count: orderedReports.length,
  canonical_path: canonicalPath,
  mirror_path: mirrorPath,
  sha256: sha256(canonical),
  byte_identical: true
})}\n`);
