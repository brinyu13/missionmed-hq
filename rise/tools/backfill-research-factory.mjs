#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeParallelRawResearchRecord, normalizeResearchFactoryRecord } from "../adapters/research-factory-ingest.mjs";
import { createRiseCanonicalEvidenceStore } from "../adapters/postgres-runtime.mjs";

const DEFAULT_PARALLEL = "/Users/brianb/MissionMed/_AI_HANDOFFS/from_claude_code/P1_RISE_PARALLEL_CONTINUOUS_FACTORY_003/raw_results";
const DEFAULT_OPUS = "/Users/brianb/MissionMed/_AI_HANDOFFS/from_claude_code/P1_RISE_OPUS_IM_EXPIRING_TOKEN_SPRINT_009/ingest_staging";
const DEFAULT_SONNET = "/Users/brianb/MissionMed/_AI_HANDOFFS/from_claude_code/P1_RISE_CLAUDE_SUBSTITUTE_RESEARCH_009/ingest_staging";

function args(argv) {
  const result = { dryRun: false, parallel: DEFAULT_PARALLEL, opus: DEFAULT_OPUS, sonnet: DEFAULT_SONNET, provider: "all" };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, "");
    const value = argv[index + 1];
    if (!key || value === undefined) throw new Error("Arguments must be --key value pairs");
    result[key] = value;
  }
  result.dryRun = String(result["dry-run"] ?? result.dryRun) === "true";
  if (!new Set(["all", "both", "parallel", "opus", "sonnet"]).has(result.provider)) {
    throw new Error("provider must be all, both, parallel, opus, or sonnet");
  }
  return result;
}

async function stableJsonSnapshot(filePath) {
  const before = await fs.stat(filePath);
  if (!before.isFile()) throw new Error(`Not a completed file: ${filePath}`);
  const bytes = await fs.readFile(filePath);
  const after = await fs.stat(filePath);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
    throw new Error(`Concurrent producer changed completed input: ${filePath}`);
  }
  return { bytes, record: JSON.parse(bytes.toString("utf8")) };
}

async function inputs(directory, label) {
  const names = (await fs.readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  const records = [];
  for (const name of names) {
    const filePath = path.join(directory, name);
    const snapshot = await stableJsonSnapshot(filePath);
    let sourceResearch = null;
    const sourceResult = snapshot.record?.source_result;
    if (typeof sourceResult === "string") {
      try {
        const sourceSnapshot = await stableJsonSnapshot(sourceResult);
        sourceResearch = sourceSnapshot.record?.research ?? null;
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    records.push(normalizeResearchFactoryRecord({
      record: snapshot.record,
      sourceBytes: snapshot.bytes,
      sourceFile: `${label}/${name}`,
      sourceResearch,
    }));
  }
  return records;
}

async function parallelInputs(directory, label) {
  const names = (await fs.readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  const records = [];
  for (const name of names) {
    const filePath = path.join(directory, name);
    const snapshot = await stableJsonSnapshot(filePath);
    if (snapshot.record?.output?.content) {
      records.push(normalizeParallelRawResearchRecord({
        record: snapshot.record,
        sourceBytes: snapshot.bytes,
        sourceFile: `${label}/${name}`,
      }));
    } else {
      let sourceResearch = null;
      if (typeof snapshot.record?.source_result === "string") {
        try {
          const sourceSnapshot = await stableJsonSnapshot(snapshot.record.source_result);
          sourceResearch = sourceSnapshot.record?.research ?? null;
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
      }
      records.push(normalizeResearchFactoryRecord({
        record: snapshot.record,
        sourceBytes: snapshot.bytes,
        sourceFile: `${label}/${name}`,
        sourceResearch,
      }));
    }
  }
  return records;
}

export async function loadResearchFactoryInputs(options = args([])) {
  const selected = [];
  if (["all", "both", "parallel"].includes(options.provider)) selected.push(...await parallelInputs(options.parallel, "parallel-raw"));
  if (["all", "both", "opus"].includes(options.provider)) selected.push(...await inputs(options.opus, "claude-opus"));
  if (["all", "sonnet"].includes(options.provider)) selected.push(...await inputs(options.sonnet, "claude-sonnet"));
  const deduped = [...new Map(selected.map((item) => [item.idempotencyKey, item])).values()]
    .sort((left, right) => left.idempotencyKey.localeCompare(right.idempotencyKey));
  return { selected, deduped };
}

export async function backfillResearchFactory(options = args([])) {
  const { selected, deduped } = await loadResearchFactoryInputs(options);
  const summary = {
    completedInputFiles: selected.length,
    duplicateCompletedInputs: selected.length - deduped.length,
    uniqueIngests: deduped.length,
    uniquePrograms: new Set(deduped.map((item) => item.acgmeId)).size,
    providers: Object.fromEntries([...new Set(deduped.map((item) => item.provider))].sort()
      .map((provider) => [provider, deduped.filter((item) => item.provider === provider).length])),
    claims: deduped.reduce((sum, item) => sum + item.claims.length, 0),
    publicationStates: Object.fromEntries(deduped.flatMap((item) => item.claims)
      .reduce((map, claim) => map.set(claim.publicationState, (map.get(claim.publicationState) ?? 0) + 1), new Map())),
    newParallelSpendUsd: 0,
    dryRun: options.dryRun,
  };
  if (options.dryRun) return summary;
  const store = await createRiseCanonicalEvidenceStore();
  const results = [];
  for (const ingest of deduped) results.push(await store.ingestProviderRecord({ ingest }));
  return {
    ...summary,
    insertedRuns: results.filter((result) => result.insertedRun).length,
    replayedRuns: results.filter((result) => !result.insertedRun).length,
    insertedClaims: results.reduce((sum, result) => sum + result.insertedClaims, 0),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  backfillResearchFactory(args(process.argv.slice(2))).then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
    process.exitCode = 1;
  });
}
