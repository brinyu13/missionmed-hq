import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const missionId = "Y2-3100-3101-3102";
const root = "/Users/brianb/MissionMed_worktrees/Y2-3100-3101";
const outputDir = path.join(root, missionId);

const roots = {
  cie5000: "/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/Y1-CIE-5000",
  cie5000a: "/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/Y1-CIE-5000A",
  cie9000: "/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/Y1-CIE-9000",
  c0Canonical: "/Users/brianb/MissionMed_worktrees/Y1-CIE-C0-0001/Y1-CIE-C0-0001",
  c0Mirror: "/Users/brianb/MissionMed_worktrees/Y1-CIE-C0-0001/_AI_HANDOFFS/from_codex/Y1_CIE_C0_0001",
  y23100: "/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/outputs/Y2-3100",
};

const fixedSources = [
  "/Users/brianb/.codex/attachments/13bc2e3f-94b6-4a67-b2c1-1cfd9afe84fc/pasted-text.txt",
  "/Users/brianb/MissionMed_OS/BOOT.md",
  "/Users/brianb/MissionMed_OS/CURRENT.md",
  "/Users/brianb/MissionMed_OS/missions.json",
  "/Users/brianb/MissionMed_OS/products_index.json",
  "/Users/brianb/MissionMed_OS/authority_index.json",
  "/Users/brianb/MissionMed_OS/PRODUCT_PASSPORTS/cie.md",
  "/Users/brianb/MissionMed_worktrees/Y2-3100-3101-os/handoffs/from_codex/Y2_3100_3101_REGISTRATION_RECEIPT.md",
  "/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/Y1-CAM-3023/Y1-CAM-3023_COMPLETE_COMBINED_HANDOFF.md",
  "/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/Y1-CAM-3024/Y1-CAM-3024_COMPLETE_COMBINED_HANDOFF.md",
  "/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/Y1-CAM-4008/4008_COMPLETE_COMBINED_HANDOFF.md",
  "/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/4008A_COMPLETE_COMBINED_HANDOFF.md",
  "/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/4008A_FINAL_RELEASE_STATUS.md",
  "/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008/4008_EDUCATIONAL_VALIDITY.md",
  "/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/server.mjs",
  "/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/auth/verifyJwt.mjs",
  "/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/auth/requireCamSession.mjs",
  "/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/routes/contracts.mjs",
  "/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/routes/entitlements.mjs",
  "/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/routes/media.mjs",
  "/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/routes/reviews.mjs",
  "/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/config.mjs",
  "/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/lib/cloudflareStreamProvider.mjs",
  "/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/lib/r2Provider.mjs",
  "/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/lib/deletionOrchestrator.mjs",
  "/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/migrations/20260713120000_y1_cam_4004_runtime_closure.sql",
  "/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/migrations/20260714203000_y1_cam_4005r_auth_session_enforcement.sql",
  "/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/migrations/20260715190000_y1_cam_4008a_integrity_expand.sql",
  "/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-hq/public/cam/index.html",
  "/Users/brianb/MissionMed_worktrees/Y1-CIE-C0-0001/cie/src/apiAdapter.mjs",
  "/Users/brianb/MissionMed_worktrees/Y1-CIE-C0-0001/cie/src/service.mjs",
  "/Users/brianb/MissionMed_worktrees/Y1-CIE-C0-0001/cie/src/contracts.mjs",
  "/Users/brianb/MissionMed_worktrees/Y1-CIE-C0-0001/cie/src/capabilities.mjs",
  "/Users/brianb/MissionMed_worktrees/Y1-CIE-C0-0001/cie/src/replaySync.mjs",
];

const precedence = [
  "Ratified MissionMed Engineering OS and current runtime authority",
  "Founder execution authorization in the Y2-3100-3101-3102 ticket",
  "Exact Y2-3100 decision and errata documents",
  "Y1-CIE-5000A where it explicitly amends Y1-CIE-5000",
  "Y1-CIE-5000",
  "Certified Y1-CIE-C0-0001 executable contracts",
  "Y1-CIE-9000 living registry and planning atlas",
  "Accepted Y1 CAM runtime and integration contracts",
  "Proposed strategy and research documents",
  "Competitive references",
];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function markdownFiles(directory) {
  const names = await readdir(directory);
  return names.filter((name) => name.endsWith(".md")).sort().map((name) => path.join(directory, name));
}

function classify(file) {
  const combined = /COMPLETE_COMBINED_HANDOFF\.md$/.test(file);
  if (file.includes("/Y1-CIE-5000A/")) return { authority_class: "constitutional amendment", status: "ready for ratification; founder-ticket constraints apply", form: combined ? "combined" : "individual", source_role: "canonical" };
  if (file.includes("/Y1-CIE-5000/")) return { authority_class: "product constitution", status: "proposed; founder-ticket constraints apply", form: combined ? "combined" : "individual", source_role: "canonical" };
  if (file.includes("/Y1-CIE-9000/")) return { authority_class: "evolution atlas", status: "living registry", form: combined ? "combined" : "individual", source_role: "canonical" };
  if (file.includes("/_AI_HANDOFFS/from_codex/Y1_CIE_C0_0001/")) return { authority_class: "certified C0 evidence", status: "certified isolated foundation", form: combined ? "combined" : "individual", source_role: "mirror" };
  if (file.includes("/Y1-CIE-C0-0001/Y1-CIE-C0-0001/")) return { authority_class: "certified C0 evidence", status: "certified isolated foundation; not production", form: combined ? "combined" : "individual", source_role: "canonical" };
  if (file.includes("/outputs/Y2-3100/")) return { authority_class: /AI_INTERVIEWER_DECISION|CONVERSATION_AND_SYSTEM_BLUEPRINT/.test(file) ? "founder-ratified Y2 decision input" : "Y2 decision package", status: /COMPLETE_COMBINED/.test(file) ? "continuation synopsis; incomplete as concatenation" : "canonical package sibling", form: combined ? "combined" : "individual", source_role: "canonical" };
  if (file.includes("Y1-CAM-4008A")) return { authority_class: "accepted CAM runtime evidence", status: "certified scoped runtime; release limitations remain", form: combined ? "combined" : "source", source_role: "accepted current candidate" };
  if (file.includes("Y1-CAM-4008")) return { authority_class: "CAM research/governance", status: "accepted predecessor", form: combined ? "combined" : "source", source_role: "canonical predecessor" };
  if (file.includes("Y1-CAM-3023") || file.includes("Y1-CAM-3024")) return { authority_class: "CAM runtime lineage", status: "accepted predecessor lineage", form: "combined", source_role: "canonical predecessor" };
  if (file.includes("MissionMed_OS")) return { authority_class: "Engineering OS", status: "current control-plane authority", form: path.extname(file).slice(1) || "source", source_role: file.includes("Y2-3100-3101-os") ? "isolated registration branch" : "canonical" };
  if (file.includes(".codex/attachments")) return { authority_class: "founder execution authorization", status: "active ticket", form: "ticket", source_role: "canonical for this mission" };
  return { authority_class: "accepted integration source", status: "read-only donor", form: path.extname(file).slice(1) || "source", source_role: "canonical donor" };
}

async function sourceRecord(file) {
  const [content, metadata] = await Promise.all([readFile(file), stat(file)]);
  return {
    path: file,
    sha256: sha256(content),
    bytes: metadata.size,
    modified_at: metadata.mtime.toISOString(),
    ...classify(file),
  };
}

function countOccurrences(haystack, needle) {
  if (needle.length === 0) return 0;
  let count = 0;
  let offset = 0;
  while ((offset = haystack.indexOf(needle, offset)) !== -1) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

async function combinedCheck(directory, combinedName) {
  const combinedPath = path.join(directory, combinedName);
  const individualPaths = (await markdownFiles(directory)).filter((file) => file !== combinedPath);
  const combined = await readFile(combinedPath, "utf8");
  const children = [];
  for (const file of individualPaths) {
    const body = await readFile(file, "utf8");
    children.push({ path: file, occurrences_unabridged: countOccurrences(combined, body) });
  }
  return { combined_path: combinedPath, children, complete_unabridged_once: children.every((item) => item.occurrences_unabridged === 1) };
}

async function main() {
  const dynamicSources = (
    await Promise.all(Object.values(roots).map((directory) => markdownFiles(directory)))
  ).flat();
  const paths = [...new Set([...dynamicSources, ...fixedSources])].sort();
  const sources = [];
  for (const file of paths) sources.push(await sourceRecord(file));

  const c0CanonicalCombined = path.join(roots.c0Canonical, "Y1_CIE_C0_0001_COMPLETE_COMBINED_HANDOFF.md");
  const c0MirrorCombined = path.join(roots.c0Mirror, "Y1_CIE_C0_0001_COMPLETE_COMBINED_HANDOFF.md");
  const c0Hashes = await Promise.all([c0CanonicalCombined, c0MirrorCombined].map(async (file) => sha256(await readFile(file))));
  const packageChecks = {
    cie_5000: await combinedCheck(roots.cie5000, "Y1-CIE-5000_COMPLETE_COMBINED_HANDOFF.md"),
    cie_5000a: await combinedCheck(roots.cie5000a, "Y1-CIE-5000A_COMPLETE_COMBINED_HANDOFF.md"),
    cie_9000: await combinedCheck(roots.cie9000, "Y1-CIE-9000_COMPLETE_COMBINED_HANDOFF.md"),
    c0: await combinedCheck(roots.c0Canonical, "Y1_CIE_C0_0001_COMPLETE_COMBINED_HANDOFF.md"),
    c0_mirror: { canonical_path: c0CanonicalCombined, mirror_path: c0MirrorCombined, byte_identical: c0Hashes[0] === c0Hashes[1], sha256: c0Hashes[0] },
    y2_3100: await combinedCheck(roots.y23100, "Y2-3100_COMPLETE_COMBINED_HANDOFF.md"),
  };

  const inventory = {
    contract_version: "missionmed.y2.context-source-inventory.v1",
    mission_id: missionId,
    generated_at: new Date().toISOString(),
    read_count: sources.length,
    precedence,
    sources,
    package_checks: packageChecks,
    conflicts: [
      "Y2-3100_COMPLETE_COMBINED_HANDOFF.md is a continuation synopsis and embeds none of its five sibling documents unabridged; the exact decision and blueprint siblings control.",
      "Y1-CIE-5000 is proposed and Y1-CIE-5000A is ready for ratification, not independently ratified; this founder ticket authorizes only the isolated synthetic Phase 0 implementation and does not activate C10.",
      "Y1-CIE-5000A resolves taxonomy, schema, roadmap, and count conflicts through E7-E9; explicit errata control.",
      "Skill semantic version and publication sequence use ambiguous source vocabulary; implementation must use distinct field names.",
      "Y1 CAM has no product passport in the current MissionMed OS index; current runtime handoffs and exact source govern this read-only integration map.",
      "CAM purpose-specific AI consent and long-session voice media are absent; Phase 0 remains synthetic text-only and cannot claim these boundaries exist.",
      "CIE C0 is certified only as an isolated local foundation; its production PostgreSQL command adapter remains absent.",
      "Y2 blueprint permits up to three probes while accepted IVOC law is stricter; the Brain applies the stricter one-probe cap at pressure rungs 0-1 and two at rung 2+.",
    ],
    missing_authority: [
      "No CAM/IV Prep On-Call product passport is present in /Users/brianb/MissionMed_OS/PRODUCT_PASSPORTS.",
      "No production CIE adapter is authorized or present; this is a recorded future integration prerequisite, not a Phase 0 blocker.",
    ],
  };

  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "Y2_3100_3101_CONTEXT_SOURCE_INVENTORY.json");
  const mdPath = path.join(outputDir, "Y2_3100_3101_CONTEXT_SOURCE_INVENTORY.md");
  await writeFile(jsonPath, `${JSON.stringify(inventory, null, 2)}\n`, { mode: 0o644 });

  const rows = sources.map((source) => `| \`${source.path}\` | \`${source.sha256}\` | ${source.bytes} | ${source.authority_class} | ${source.status} | ${source.form} | ${source.source_role} |`);
  const conflictRows = inventory.conflicts.map((item) => `- ${item}`);
  const packageRows = Object.entries(packageChecks).map(([name, check]) => {
    if (name === "c0_mirror") return `| ${name} | byte-identical mirror | ${check.byte_identical ? "PASS" : "FAIL"} | \`${check.sha256}\` |`;
    const embedded = check.children.filter((item) => item.occurrences_unabridged === 1).length;
    return `| ${name} | ${embedded}/${check.children.length} siblings embedded unabridged exactly once | ${check.complete_unabridged_once ? "PASS" : "CONTRADICTED"} | \`${check.combined_path}\` |`;
  });
  const md = `# Y2-3100-3101 Context Source Inventory\n\n- Mission: \`${missionId}\`\n- Generated: \`${inventory.generated_at}\`\n- Sources opened and hashed: \`${sources.length}\`\n- Contract: \`${inventory.contract_version}\`\n\n## Precedence Applied\n\n${precedence.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n## Package Integrity\n\n| Package | Check | Result | Source |\n|---|---|---|---|\n${packageRows.join("\n")}\n\n## Conflicts And Resolutions\n\n${conflictRows.join("\n")}\n\n## Missing Authority\n\n${inventory.missing_authority.map((item) => `- ${item}`).join("\n")}\n\n## Source Ledger\n\n| Absolute path | SHA-256 | Bytes | Authority class | Status | Form | Role |\n|---|---|---:|---|---|---|---|\n${rows.join("\n")}\n`;
  await writeFile(mdPath, md, { mode: 0o644 });
  process.stdout.write(`${JSON.stringify({ jsonPath, mdPath, sourceCount: sources.length, packageChecks }, null, 2)}\n`);
}

await main();
