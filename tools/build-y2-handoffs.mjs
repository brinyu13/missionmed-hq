import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = "/Users/brianb/MissionMed_worktrees/Y2-3100-3101";
const mission = path.join(root, "Y2-3100-3101-3102");
const mirror = path.join(root, "_AI_HANDOFFS/from_codex/Y2_3100_3101_3102");

const workstreamA = [
  "Y2_3100_DISCOVERY_EXECUTIVE_SUMMARY.md",
  "Y2_3100_SOURCE_AND_AUTHORITY_MAP.md",
  "Y2_3100_SESSION_API_AUTH_AND_RLS.md",
  "Y2_3100_MEDIA_CONSENT_DELETION_AND_PROVENANCE.md",
  "Y2_3100_REVIEW_UI_FLAGS_AND_ATTACHMENT_POINTS.md",
  "Y2_3100_REUSABLE_AND_PROHIBITED_COMPONENTS.md",
  "Y2_3100_BLUEPRINT_SOURCE_CONTRADICTIONS.md",
  "Y2_3100_SMALLEST_SAFE_INTEGRATION_SEQUENCE.md",
  "Y2_3100_D3_D9_RATIFICATION_NOTE.md",
  "Y2_3100_UNKNOWN_AND_BLOCKER_REGISTER.md",
];

const workstreamB = [
  "Y2_3101_EXECUTION_LEDGER.md",
  "Y2_3101_BRAIN_ARCHITECTURE.md",
  "Y2_3101_CONTRACTS_AND_SCHEMAS.md",
  "Y2_3101_PERSONA_PACKS_AND_INTERVIEW_PLANS.md",
  "Y2_3101_LEDGER_MEMORY_AND_RECONNECTION.md",
  "Y2_3101_FOLLOWUP_POLICY_AND_GUARDRAILS.md",
  "Y2_3101_MODEL_VOICE_AND_AVATAR_ADAPTERS.md",
  "Y2_3101_SYNTHETIC_FIXTURES.md",
  "Y2_3101_TEST_AND_EVALUATION_REPORT.md",
  "Y2_3101_POLICY_ITERATION_REPORT.md",
  "Y2_3101_HOLDOUT_EVALUATION.md",
  "Y2_3101_INSTRUCTOR_VISIBILITY_REVIEW.md",
  "Y2_3101_SECURITY_PRIVACY_AND_PROVENANCE.md",
  "Y2_3101_SPECIALIST_BOARD.md",
  "Y2_3101_FRESH_CONTEXT_VERIFICATION.md",
  "Y2_3101_FINAL_STATUS_AND_NEXT_ACTION.md",
];

const workstreamC = [
  "Y2_3102_TEN_STUDENT_PILOT_PROTOCOL.md",
  "Y2_3102_CONSENT_DRAFT.md",
  "Y2_3102_INSTRUCTOR_REVIEW_WORKFLOW.md",
  "Y2_3102_STUDENT_FEEDBACK_INSTRUMENT.md",
  "Y2_3102_INSTRUCTOR_FEEDBACK_INSTRUMENT.md",
  "Y2_3102_DEMAND_AND_WTP_TEST.md",
  "Y2_3102_USAGE_METERING_AND_ENTITLEMENT.md",
  "Y2_3102_COST_DASHBOARD_AND_CIRCUIT_BREAKERS.md",
  "Y2_3102_SUCCESS_PAUSE_AND_KILL_CRITERIA.md",
  "Y2_3102_PILOT_OPERATIONS_CHECKLIST.md",
];

const definitions = {
  A: { title: "Y2-3100 Complete Combined Handoff", output: "Y2_3100_COMPLETE_COMBINED_HANDOFF.md", files: workstreamA },
  B: { title: "Y2-3101 Complete Combined Handoff", output: "Y2_3101_COMPLETE_COMBINED_HANDOFF.md", files: workstreamB },
  C: { title: "Y2-3102 Complete Combined Handoff", output: "Y2_3102_COMPLETE_COMBINED_HANDOFF.md", files: workstreamC },
  master: {
    title: "Y2-3100-3101-3102 Master Complete Combined Handoff",
    output: "Y2_3100_3101_3102_MASTER_COMPLETE_COMBINED_HANDOFF.md",
    files: ["Y2_3100_3101_CONTEXT_SOURCE_INVENTORY.md", ...workstreamA, ...workstreamB, ...workstreamC],
  },
};

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function countOccurrences(haystack, needle) {
  let count = 0;
  let offset = 0;
  while ((offset = haystack.indexOf(needle, offset)) !== -1) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

async function build(key) {
  const definition = definitions[key];
  if (!definition) throw new Error(`Unknown group: ${key}`);
  const sections = [];
  const bodies = [];
  for (const filename of definition.files) {
    const body = await readFile(path.join(mission, filename), "utf8");
    bodies.push({ filename, body });
    sections.push(`<!-- BEGIN ${filename} -->\n${body.trimEnd()}\n<!-- END ${filename} -->`);
  }
  const header = `# ${definition.title}\n\n- Contract: \`missionmed.y2.combined-handoff.v1\`\n- Source files: \`${definition.files.length}\`\n- Inclusion law: every primary source report below is unabridged exactly once.\n- Derived subgroup combined handoffs are not nested into the master because nesting would duplicate primary report contents.\n`;
  const output = `${header}\n${sections.join("\n\n")}\n`;
  for (const { filename, body } of bodies) {
    if (countOccurrences(output, body.trimEnd()) !== 1) throw new Error(`${filename} is not embedded exactly once`);
  }
  const outputPath = path.join(mission, definition.output);
  await writeFile(outputPath, output);
  return { key, outputPath, sha256: sha256(output), bytes: Buffer.byteLength(output), source_count: bodies.length };
}

const requested = process.argv.slice(2);
if (requested.length === 0) throw new Error("Specify one or more groups: A B C master");
const results = [];
for (const key of requested) results.push(await build(key));

if (requested.includes("master")) {
  await mkdir(mirror, { recursive: true });
  const masterName = definitions.master.output;
  const masterBody = await readFile(path.join(mission, masterName));
  await writeFile(path.join(mirror, masterName), masterBody);
  const mirrored = await readFile(path.join(mirror, masterName));
  if (!masterBody.equals(mirrored)) throw new Error("Master mirror is not byte-identical");
}

process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
