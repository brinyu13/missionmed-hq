import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = "/Users/brianb/MissionMed_worktrees/Y2-3100-3101";
const mission = path.join(root, "Y2-3100-3101-3102");
const mirror = path.join(root, "_AI_HANDOFFS/from_codex/Y2_3100_3101_3102");

const combined = [
  "Y2_3100_COMPLETE_COMBINED_HANDOFF.md",
  "Y2_3101_COMPLETE_COMBINED_HANDOFF.md",
  "Y2_3102_COMPLETE_COMBINED_HANDOFF.md",
  "Y2_3100_3101_3102_MASTER_COMPLETE_COMBINED_HANDOFF.md",
];

const discovery = [
  "Y2_3100_DISC_01_API_AND_SESSION_AUTHORITY.md",
  "Y2_3100_DISC_02_DATA_MODEL_AND_MIGRATIONS.md",
  "Y2_3100_DISC_03_DELETION_CLOSURE.md",
  "Y2_3100_DISC_04_MEDIA_AND_STORAGE.md",
  "Y2_3100_DISC_05_FRONTEND_RUNTIME.md",
  "Y2_3100_DISC_06_EVENTS_IDEMPOTENCY_AND_AUDIT.md",
  "Y2_3100_DISC_07_REVIEW_SURFACES.md",
  "Y2_3100_DISC_08_DEPLOYMENT_AND_ENVIRONMENT.md",
  "Y2_3100_DISC_09_PRIVACY_AND_RETENTION.md",
  "Y2_3100_DISC_10_REUSE_AND_DEAD_ENDS.md",
  "Y2_3100_DISCOVERY_SYNTHESIS.md",
];

const tGateStarts = [
  "**T1 Answer-specific follow-up |** For >= 90%",
  "**T2 Memory of earlier detail |** A detail planted in minute 2",
  "**T3 Probing incomplete/vague answers |** STAR-gap fixtures",
  "**T4 Contradiction handling |** Planted inconsistencies",
  "**T5 Persona and context discipline |** 30-minute adversarial persona test",
  "**T6 Graceful recovery |** Injected silence, ASR garble",
  "**T7 Transcript + instructor summary |** Every run yields a usable timestamped transcript",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function count(value, needle) {
  return value.split(needle).length - 1;
}

const files = (await readdir(mission)).filter((name) => name.endsWith(".md")).sort();
const primary = files.filter((name) => !combined.includes(name) && name !== "Y2_3100_3101_CONTEXT_SOURCE_INVENTORY.md");
const master = await readFile(path.join(mission, combined[3]), "utf8");

for (const filename of discovery) {
  if (!files.includes(filename)) throw new Error(`Missing discovery report: ${filename}`);
  const body = await readFile(path.join(mission, filename), "utf8");
  if (!/\*\*(VERIFIED|UNKNOWN|INFERENCE|ASSUMPTION):\*\*/.test(body)) {
    throw new Error(`Discovery report has no evidence labels: ${filename}`);
  }
  const declaredLabels = [...body.matchAll(/^\s*-\s+\*\*([A-Z]+):\*\*/gmu)].map((match) => match[1]);
  const invalidLabels = declaredLabels.filter((label) => !["VERIFIED", "UNKNOWN", "INFERENCE", "ASSUMPTION"].includes(label));
  if (invalidLabels.length > 0) {
    throw new Error(`Discovery report has invalid evidence labels: ${filename}: ${[...new Set(invalidLabels)].join(", ")}`);
  }
}

for (const filename of primary) {
  const marker = `<!-- BEGIN ${filename} -->`;
  if (count(master, marker) !== 1) throw new Error(`${filename} is not represented exactly once in master`);
}

for (const filename of combined.slice(0, 3)) {
  if (count(master, `<!-- BEGIN ${filename} -->`) !== 1) {
    throw new Error(`${filename} is not nested exactly once in master`);
  }
}

if (count(master, "<!-- BEGIN Y2_3100_3101_CONTEXT_SOURCE_INVENTORY.md -->") !== 1) {
  throw new Error("Context inventory is not nested exactly once in master");
}

for (const filename of combined) {
  const canonical = await readFile(path.join(mission, filename));
  const mirrored = await readFile(path.join(mirror, filename));
  if (!canonical.equals(mirrored)) throw new Error(`${filename} mirror differs`);
}

const tests = await readFile(path.join(mission, "Y2_3101_TEST_AND_EVALUATION_REPORT.md"), "utf8");
for (const start of tGateStarts) {
  if (!tests.includes(start)) throw new Error(`Missing exact gate prefix: ${start}`);
}

const inventory = await readFile(path.join(mission, "Y2_3100_3101_CONTEXT_SOURCE_INVENTORY.json"), "utf8");
if (!inventory.includes("50d7e2d6ac8d18306698fc647e7ac62f1de3eb23cb71e0eef79732b3c6ef8ddc")) {
  throw new Error("Amended prompt digest is absent from context inventory");
}

const finalStatus = await readFile(path.join(mission, "Y2_3101_FINAL_STATUS_AND_NEXT_ACTION.md"), "utf8");
if (!finalStatus.includes("KILL_RULE_TRIGGERED") || !finalStatus.includes("Y2-3103")) {
  throw new Error("Final status does not preserve the kill result and next ticket");
}

process.stdout.write(`${JSON.stringify({
  status: "PASS",
  markdown_files: files.length,
  primary_reports: primary.length,
  discovery_reports: discovery.length,
  master_sha256: sha256(master),
  mirrored_combined_handoffs: combined.length,
  t_gates_preserved: tGateStarts.length,
}, null, 2)}\n`);
