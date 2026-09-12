#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createRiseCanonicalEvidenceStore, createRiseEvidenceReviewStore } from "../adapters/postgres-runtime.mjs";
import {
  normalizeStoredStructuredDossierIngest,
  normalizeStructuredResearchDossier,
  structuredDossierSummary,
  STRUCTURED_DOSSIER_CONTRACT,
} from "../adapters/structured-research-dossier-ingest.mjs";
import { reviewResearchCorpus } from "../src/research-review.mjs";

const DEFAULT_ROOTS = Object.freeze([
  "/Users/brianb/MissionMed/_AI_HANDOFFS/from_claude_code/P1_RISE_ALEJANDRA_NEURO_TX_OPUS5_BENCH_006A/dossiers",
  "/Users/brianb/MissionMed/_AI_HANDOFFS/from_claude_code/P1_RISE_ALEJANDRA_NEURO_TX_OPUS5_STAGEB_007/dossiers",
]);
const DEFAULT_BUNDLE = fileURLToPath(new URL("../config/research-dossiers/texas-adult-neurology-2026-09-12.v1.json", import.meta.url));
const DEFAULT_REGISTRY = fileURLToPath(new URL("../releases/student-rights-safe/api-index.json", import.meta.url));
const TICKET = "P1-RISE-5012I";
const PROMOTION_SOURCE_ID = "rise_src_p1_rise_5012i_review";

function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function args(argv) {
  const result = { roots: DEFAULT_ROOTS, bundle: null, bundleOut: null, registry: DEFAULT_REGISTRY, apply: false, reviewedAt: null };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, "");
    const value = argv[index + 1];
    if (!key || value === undefined) throw new Error("Arguments must be --key value pairs");
    if (key === "root") result.roots = [...(result._customRoots ?? []), value], result._customRoots = result.roots;
    else if (key === "bundle-out") result.bundleOut = value;
    else if (key === "reviewed-at") result.reviewedAt = value;
    else if (key === "apply") result.apply = String(value) === "true";
    else if (key === "bundle" || key === "registry") result[key] = value;
    else throw new Error(`Unknown argument: --${key}`);
  }
  delete result._customRoots;
  return result;
}

async function stableSnapshot(filePath) {
  const before = await fs.stat(filePath);
  const bytes = await fs.readFile(filePath);
  const after = await fs.stat(filePath);
  if (!before.isFile() || before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
    throw new Error(`Structured dossier changed while being read: ${filePath}`);
  }
  return { bytes, record: JSON.parse(bytes.toString("utf8")) };
}

export async function loadStructuredDossierRoots(roots = DEFAULT_ROOTS) {
  const ingests = [];
  for (const root of roots) {
    const names = (await fs.readdir(root)).filter((name) => /^\d{10}_dossier\.json$/.test(name)).sort();
    for (const name of names) {
      const filePath = path.join(root, name);
      const snapshot = await stableSnapshot(filePath);
      ingests.push(normalizeStructuredResearchDossier({
        record: snapshot.record,
        sourceBytes: snapshot.bytes,
        sourceFile: `${path.basename(path.dirname(root))}/dossiers/${name}`,
      }));
    }
  }
  return validateCorpus([...new Map(ingests.map((item) => [item.acgmeId, item])).values()]);
}

function validateCorpus(ingests) {
  const ordered = [...ingests].sort((left, right) => left.acgmeId.localeCompare(right.acgmeId));
  const summary = structuredDossierSummary(ordered);
  if (summary.programs !== 16 || summary.domainsAttempted !== 416 || summary.notYetResearchedDomains !== 0) {
    throw new Error(`Texas Adult Neurology dossier contract drifted: ${JSON.stringify(summary)}`);
  }
  if (summary.acgmeIds.some((id) => id.startsWith("185"))) throw new Error("Child Neurology contamination detected");
  return ordered;
}

export async function writeStructuredDossierBundle(ingests, outputPath) {
  const bundle = {
    schemaVersion: 1,
    contractId: STRUCTURED_DOSSIER_CONTRACT,
    ticket: TICKET,
    generatedAt: "2026-09-12T00:00:00.000Z",
    summary: structuredDossierSummary(ingests),
    ingests,
  };
  bundle.contentSha256 = sha256(bundle);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(bundle)}\n`, { flag: "w" });
  return { outputPath, bytes: Buffer.byteLength(JSON.stringify(bundle)) + 1, contentSha256: bundle.contentSha256 };
}

export async function loadStructuredDossierBundle(bundlePath = DEFAULT_BUNDLE) {
  const bundle = JSON.parse(await fs.readFile(bundlePath, "utf8"));
  const expected = bundle.contentSha256;
  const unsigned = { ...bundle };
  delete unsigned.contentSha256;
  if (bundle.contractId !== STRUCTURED_DOSSIER_CONTRACT || expected !== sha256(unsigned)) {
    throw new Error("Structured dossier bundle contract or checksum is invalid");
  }
  return validateCorpus(bundle.ingests.map(normalizeStoredStructuredDossierIngest));
}

function registryIdentity(program) {
  const acgmeId = program.identifiers?.find((item) => item.namespace === "ACGME_PROGRAM")?.value;
  const record = {
    programIdentityId: program.id,
    acgmeId,
    programSpecialtyId: program.programSpecialtyId,
    programName: program.display?.programName,
    institution: program.display?.institution,
    city: program.display?.city || null,
    state: program.display?.state,
    specialty: program.designation,
    sourceId: PROMOTION_SOURCE_ID,
  };
  if (!/^180\d{7}$/.test(String(acgmeId ?? "")) || record.state !== "TX" || record.specialty !== "Neurology") {
    throw new Error(`Texas Adult Neurology registry identity mismatch: ${acgmeId}`);
  }
  return { ...record, contentSha256: sha256(record) };
}

async function applyCorpus(ingests, options) {
  if (!options.reviewedAt || !Number.isFinite(Date.parse(options.reviewedAt))) {
    throw new Error("Production import requires an explicit --reviewed-at ISO timestamp");
  }
  const evidenceStore = await createRiseCanonicalEvidenceStore();
  const reviewStore = await createRiseEvidenceReviewStore();
  const targetClaimIds = ingests.flatMap((item) => item.claims.map((claim) => claim.id));
  const existing = await reviewStore.existingClaimIds(targetClaimIds);
  const ingestResults = [];
  for (const ingest of ingests.filter((item) => item.claims.some((claim) => !existing.has(claim.id)))) {
    ingestResults.push(await evidenceStore.ingestProviderRecord({ ingest }));
  }
  const afterIngest = await reviewStore.existingClaimIds(targetClaimIds);
  if (afterIngest.size !== targetClaimIds.length) throw new Error(`Canonical claim ingestion incomplete: ${afterIngest.size}/${targetClaimIds.length}`);
  const acgmeIds = ingests.map((item) => item.acgmeId);
  let resolved = await reviewStore.resolvedAcgmeIds(acgmeIds);
  let identityBackfill = { requested: 0, upserted: 0 };
  if (resolved.size !== acgmeIds.length) {
    await evidenceStore.ensureReviewIdentitySource({
      retrievedAt: options.reviewedAt,
      sourceId: PROMOTION_SOURCE_ID,
      ticket: TICKET,
      sourceLocator: `${TICKET}/texas-adult-neurology-identity-reconciliation`,
    });
    const registry = JSON.parse(await fs.readFile(options.registry, "utf8"));
    if (registry?.counts?.uniquePrograms !== 6139 || registry?.counts?.specialtyTabs !== 31) throw new Error("Full registry contract drifted");
    const unresolved = new Set(acgmeIds.filter((id) => !resolved.has(id)));
    const identities = registry.programs.map((program) => {
      const id = program.identifiers?.find((item) => item.namespace === "ACGME_PROGRAM")?.value;
      return unresolved.has(id) ? registryIdentity(program) : null;
    }).filter(Boolean);
    if (identities.length !== unresolved.size) throw new Error(`Registry identity reconciliation incomplete: ${identities.length}/${unresolved.size}`);
    identityBackfill = { requested: unresolved.size, ...await evidenceStore.upsertProgramIdentities(identities) };
    resolved = await reviewStore.resolvedAcgmeIds(acgmeIds);
  }
  if (resolved.size !== acgmeIds.length) throw new Error("All 16 canonical identities must resolve before review");
  const review = reviewResearchCorpus(ingests, { resolvedAcgmeIds: resolved });
  const applied = await reviewStore.applyCorpus({
    review, actorSubject: TICKET, reviewedAt: options.reviewedAt,
    ticket: TICKET, promotionSourceId: PROMOTION_SOURCE_ID,
  });
  return {
    insertedRuns: ingestResults.filter((item) => item.insertedRun).length,
    replayedRuns: ingestResults.filter((item) => !item.insertedRun).length,
    insertedClaims: ingestResults.reduce((sum, item) => sum + item.insertedClaims, 0),
    identityBackfill, dispositions: review.dispositions,
    promotions: review.promotions.length, applied, readback: await reviewStore.stats(),
  };
}

export async function importStructuredDossiers(options = args([])) {
  const ingests = options.bundle ? await loadStructuredDossierBundle(options.bundle) : await loadStructuredDossierRoots(options.roots);
  const summary = { ...structuredDossierSummary(ingests), input: options.bundle ?? options.roots, apply: options.apply };
  const bundleReceipt = options.bundleOut ? await writeStructuredDossierBundle(ingests, options.bundleOut) : null;
  if (!options.apply) return { ...summary, bundleReceipt };
  return { ...summary, bundleReceipt, ...await applyCorpus(ingests, options) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  importStructuredDossiers(args(process.argv.slice(2))).then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
    process.exitCode = 1;
  });
}
