import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ENVIRONMENT,
  EVIDENCE_ORIGIN,
  FRESHNESS,
  IDENTITY,
  JOB,
  PERSISTENCE,
  PUBLICATION,
  REVIEW,
  SECTION_STATE,
  SENSITIVITY,
  VISIBILITY,
} from '../../../lib/mmc/contracts/state-contract.mjs';
import {
  MMC_COMMAND_KINDS,
  MMC_STUDENT_RESPONSE_KINDS,
} from '../../../lib/mmc/contracts/command-contract.mjs';
import {
  MENTOR_ATTENTION_CATEGORY,
  MENTOR_CAPTURE_KINDS,
  MENTOR_COMMITMENT_STATE,
  MENTOR_CONNECTIVITY,
  MENTOR_PLAN_STATE,
  MENTOR_QUERY_KIND,
  MENTOR_REVIEW_COMPLEXITY,
  MENTOR_REVIEW_DECISION,
  MENTOR_SAVE_STATE,
  MENTOR_SESSION_STATE,
  MENTOR_TASK_STATE,
  MENTOR_WORK_OWNER,
  MMC_MENTOR_COMMAND_KINDS,
} from '../../../lib/mmc/contracts/mentor-query-contract.mjs';
import { MMC_FEATURE_PLANES } from '../../../lib/mmc/cutover/single-writer-cutover.mjs';
import { MMC_JOB_KINDS } from '../../../lib/mmc/jobs/durable-job-kernel.mjs';
import { MMC_POLICY_KINDS } from '../../../lib/mmc/policy/policy-registry.mjs';
import { PUBLICATION_ITEM_KIND } from '../../../lib/mmc/publication/publication-contract.mjs';
import { MMC_CAPABILITIES } from '../../../lib/mmc/trust/security.mjs';

const root = process.cwd();
const scriptRelative = path.relative(root, fileURLToPath(import.meta.url));
const migrationRelative = 'supabase/migrations/20260715155243_a1_mmc_006_trust_data_worker_kernel.sql';
const manifestRelative = 'missionmed-hq/lib/mmc/contracts/cam-v2-parity-manifest.json';
const migration = await readFile(path.join(root, migrationRelative), 'utf8');

const authorityGrantKinds = Object.freeze(['ACQUISITION', 'TRANSCRIPT_PROCESSING', 'AI_TRANSFER', 'PUBLICATION']);
const capabilityMappings = Object.freeze([
  ...Object.values(MMC_CAPABILITIES).map((js) => ({
    js,
    sql: defaultSqlCapability(js),
    disposition: 'DIRECT_OR_NORMALIZED',
  })),
].map((mapping) => {
  if (mapping.js === MMC_CAPABILITIES.IDENTITY_REVIEW) {
    return { js: mapping.js, sql: 'mmc.operator.trust_write', disposition: 'EXPLICIT_SQL_ALIAS' };
  }
  if (mapping.js === MMC_CAPABILITIES.PROMPT_MANAGE) {
    return { js: mapping.js, sql: null, disposition: 'DEFERRED_TO_009_DURABLE_ADAPTER' };
  }
  if (mapping.js === MMC_CAPABILITIES.AI_QUEUE) {
    return { js: mapping.js, sql: 'mmc.command.execute', disposition: 'EXPLICIT_SQL_ALIAS' };
  }
  if (mapping.js === MMC_CAPABILITIES.STUDENT_SELF_AUTHOR) {
    return { js: mapping.js, sql: 'mmc.student.self_author', disposition: 'NORMALIZED_SQL_ALIAS' };
  }
  return mapping;
}));

assertSqlCheckList('environment', values(ENVIRONMENT));
assertSqlCheckList('command_kind', MMC_COMMAND_KINDS);
assertSqlCheckList('job_kind', MMC_JOB_KINDS);
assertSqlCheckList('response_kind', MMC_STUDENT_RESPONSE_KINDS);
assertSqlCheckList('item_kind', values(PUBLICATION_ITEM_KIND));
assertSqlCheckList('policy_kind', MMC_POLICY_KINDS);
assertSqlCheckList('grant_kind', authorityGrantKinds);

const featurePlaneSql = Object.freeze(Object.fromEntries(MMC_FEATURE_PLANES.map((plane) => [
  plane,
  camelToSnake(plane),
])));
for (const sqlPlane of Object.values(featurePlaneSql)) {
  assert.match(migration, new RegExp(`\\b${escapeRegExp(sqlPlane)}_enabled\\b`, 'u'),
    `Missing SQL feature-plane column for ${sqlPlane}`);
  assert.match(migration, new RegExp(`WHEN '${escapeRegExp(sqlPlane)}' THEN`, 'u'),
    `Missing SQL feature-plane dispatch for ${sqlPlane}`);
}

for (const mapping of capabilityMappings) {
  if (!mapping.sql) continue;
  assert.equal(migration.includes(`'${mapping.sql}'`), true,
    `Missing SQL capability or alias target for ${mapping.js} -> ${mapping.sql}`);
}

const rpcNames = [...migration.matchAll(/CREATE OR REPLACE FUNCTION\s+(mmc\.cam_v2_[a-z0-9_]+)/giu)]
  .map((match) => match[1].toLowerCase())
  .filter((value, index, list) => list.indexOf(value) === index)
  .sort();
assert.ok(rpcNames.length >= 70, 'The durable CAM v2 RPC/function inventory unexpectedly shrank.');

const errorCodes = await collectErrorCodes([
  'missionmed-hq/lib/mmc',
  'missionmed-hq/routes/mmc',
]);
assert.ok(errorCodes.length >= 50, 'The safe error-code inventory unexpectedly shrank.');

const sourceFiles = [
  migrationRelative,
  'missionmed-hq/lib/mmc/contracts/state-contract.mjs',
  'missionmed-hq/lib/mmc/contracts/command-contract.mjs',
  'missionmed-hq/lib/mmc/contracts/mentor-query-contract.mjs',
  'missionmed-hq/lib/mmc/commands/mentor-owner-handlers.mjs',
  'missionmed-hq/lib/mmc/queries/mentor-query-service.mjs',
  'missionmed-hq/lib/mmc/cutover/single-writer-cutover.mjs',
  'missionmed-hq/lib/mmc/jobs/durable-job-kernel.mjs',
  'missionmed-hq/lib/mmc/policy/policy-registry.mjs',
  'missionmed-hq/lib/mmc/publication/publication-contract.mjs',
  'missionmed-hq/lib/mmc/trust/security.mjs',
  'missionmed-hq/routes/mmc/mentor.mjs',
];
const sourceSha256 = {};
for (const relative of sourceFiles) {
  sourceSha256[relative] = sha256(await readFile(path.join(root, relative)));
}

const manifest = {
  schemaVersion: 1,
  authority: 'CAM_V2_ARCHITECTURE_005',
  implementationRun: 'A1_MMC_CAM_MENTOR_EXPERIENCE_007',
  migrationState: 'UNAPPLIED_TO_CONFIGURED_ENVIRONMENTS',
  environments: values(ENVIRONMENT),
  capabilities: {
    javascript: Object.values(MMC_CAPABILITIES),
    sqlMappings: capabilityMappings,
  },
  commands: {
    durableKinds: MMC_COMMAND_KINDS,
    localMentor007Kinds: MMC_MENTOR_COMMAND_KINDS,
  },
  mentorQueries: Object.values(MENTOR_QUERY_KIND),
  mentorCaptureKinds: MENTOR_CAPTURE_KINDS,
  mentorLocalStates: {
    attentionCategory: values(MENTOR_ATTENTION_CATEGORY),
    session: values(MENTOR_SESSION_STATE),
    reviewDecision: values(MENTOR_REVIEW_DECISION),
    reviewComplexity: values(MENTOR_REVIEW_COMPLEXITY),
    plan: values(MENTOR_PLAN_STATE),
    workOwner: values(MENTOR_WORK_OWNER),
    task: values(MENTOR_TASK_STATE),
    commitment: values(MENTOR_COMMITMENT_STATE),
    save: values(MENTOR_SAVE_STATE),
    connectivity: values(MENTOR_CONNECTIVITY),
  },
  jobs: {
    kinds: MMC_JOB_KINDS,
    states: values(JOB),
  },
  publication: {
    itemKinds: values(PUBLICATION_ITEM_KIND),
    states: values(PUBLICATION),
    studentResponseKinds: MMC_STUDENT_RESPONSE_KINDS,
  },
  policyKinds: [...MMC_POLICY_KINDS],
  authorityGrantKinds,
  featurePlanes: {
    javascript: [...MMC_FEATURE_PLANES],
    sqlColumns: featurePlaneSql,
  },
  stateVocabularies: {
    persistence: values(PERSISTENCE),
    freshness: values(FRESHNESS),
    review: values(REVIEW),
    identity: values(IDENTITY),
    sensitivity: values(SENSITIVITY),
    visibility: values(VISIBILITY),
    evidenceOrigin: values(EVIDENCE_ORIGIN),
    section: values(SECTION_STATE),
  },
  durableSqlFunctions: rpcNames,
  safeErrorCodes: errorCodes,
  sourceSha256,
};

const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
if (process.argv.includes('--write')) {
  await writeFile(path.join(root, manifestRelative), serialized, 'utf8');
  console.log(`WROTE ${manifestRelative}`);
} else {
  const current = await readFile(path.join(root, manifestRelative), 'utf8');
  assert.equal(current, serialized,
    `Contract parity manifest drifted. Regenerate with: node ${scriptRelative} --write`);
  console.log(JSON.stringify({
    result: 'MMC CAM v2 JS/SQL contract parity manifest passed',
    manifest: manifestRelative,
    sqlFunctions: rpcNames.length,
    safeErrorCodes: errorCodes.length,
    migrationState: manifest.migrationState,
  }, null, 2));
}

function values(enumObject) {
  return Object.values(enumObject);
}

function defaultSqlCapability(value) {
  return String(value).toLowerCase().replaceAll(':', '.');
}

function camelToSnake(value) {
  return String(value).replace(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`);
}

function assertSqlCheckList(column, expected) {
  const pattern = new RegExp(`CHECK\\s*\\(\\s*${escapeRegExp(column)}\\s+IN\\s*\\(([^)]*)\\)`, 'giu');
  const actualLists = [...migration.matchAll(pattern)].map((match) => (
    [...match[1].matchAll(/'([^']+)'/gu)].map((entry) => entry[1])
  ));
  assert.equal(actualLists.some((actual) => sameSet(actual, expected)), true,
    `SQL ${column} vocabulary does not exactly match the JavaScript authority.`);
}

function sameSet(left, right) {
  return JSON.stringify([...new Set(left)].sort()) === JSON.stringify([...new Set(right)].sort());
}

async function collectErrorCodes(relativeRoots) {
  const files = [];
  for (const relativeRoot of relativeRoots) {
    await walk(path.join(root, relativeRoot), files);
  }
  const codes = new Set();
  const pattern = /(?:new\s+MmcHttpError|\b(?:invalid|conflict|forbidden|queryInvalid|commandInvalid|commandResultInvalid)\s*)\s*\([^)]*?['"]([A-Z][A-Z0-9_]{2,63})['"]/gsu;
  for (const file of files.filter((value) => value.endsWith('.mjs'))) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(pattern)) codes.add(match[1]);
  }
  return [...codes].sort();
}

async function walk(directory, output) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute, output);
    else if (entry.isFile()) output.push(absolute);
  }
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
