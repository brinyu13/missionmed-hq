import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const server = read('missionmed-hq/server.mjs');
const legacyRoute = read('missionmed-hq/routes/mmc-coaching-pipeline.mjs');
const v2Route = read('missionmed-hq/routes/mmc/index.mjs');
const security = read('missionmed-hq/lib/mmc/trust/security.mjs');
const commands = read('missionmed-hq/lib/mmc/commands/command-kernel.mjs');
const jobs = read('missionmed-hq/lib/mmc/jobs/durable-job-kernel.mjs');
const assets = read('missionmed-hq/lib/mmc/assets/opaque-asset-broker.mjs');
const identity = read('missionmed-hq/lib/mmc/identity/attested-identity-kernel.mjs');
const evidence = read('missionmed-hq/lib/mmc/evidence/evidence-kernel.mjs');
const publication = read('missionmed-hq/lib/mmc/publication/publication-contract.mjs');
const cutover = read('missionmed-hq/lib/mmc/cutover/single-writer-cutover.mjs');
const webex = read('missionmed-hq/lib/mmc-webex-triggered-pull.mjs');

assert.match(server, /isMmcCoachingPipelinePath\(pathname\)/u);
assert.match(server, /buildMmcPrincipal,/u, 'The v2 route must receive only the server-derived principal.');
assert.match(server, /getExactMmcSupabaseProjectRef/u, 'MMC persistence must use exact Supabase origin parsing.');
assert.match(server, /mmc_v1_whole_state_writer_sealed/u, 'The v1 whole-state writer must be sealed.');
assert.doesNotMatch(server.slice(server.indexOf('async function handleMmcPersistenceRoute'), server.indexOf('function isSpaRoute')),
  /saveMmcPersistenceState/u, 'The reachable v1 persistence handler must be read-only.');

assert.match(legacyRoute, /mmc_legacy_pipeline_sealed/u);
assert.match(legacyRoute, /assertMmcCsrf\(request, deps\.session\)/u);
const reachableLegacy = legacyRoute.slice(legacyRoute.indexOf('export async function handleMmcCoachingPipelineRoute'),
  legacyRoute.indexOf('const MMC_V2_PREFIX_FOR_STATUS'));
for (const unsafe of ['getMmcPersistenceConfig', 'readJsonBody', 'scanCoachingDropZone', 'pullTriggeredWebexRecordings', 'runAiAnalysis']) {
  assert.doesNotMatch(reachableLegacy, new RegExp(unsafe, 'u'), `Reachable legacy route must not invoke ${unsafe}.`);
}

assert.match(v2Route, /MMC_V2_GATEWAY_DISABLED/u);
assert.match(v2Route, /MMC_V2_DURABLE_PERSISTENCE_REQUIRED/u);
assert.match(v2Route, /assertMmcCsrf/u);
assert.match(v2Route, /assertExactRequestOrigin/u);
assert.match(v2Route, /readBoundedJsonBody/u);
assert.match(v2Route, /principal\.role !== 'admin'/u, 'Mentor commands must fail closed until assignment authz is wired.');
assert.match(security, /new TextDecoder\('utf-8', \{ fatal: true \}\)/u);
assert.match(security, /Content-Security-Policy/u);
assert.match(commands, /IDEMPOTENCY_PAYLOAD_MISMATCH/u);
assert.match(commands, /VERSION_CONFLICT/u);
assert.match(commands, /after_outbox/u);
assert.match(jobs, /STALE_LEASE_GENERATION/u);
assert.match(jobs, /OUTCOME_UNKNOWN_REQUIRES_RECONCILIATION/u);
assert.match(jobs, /INBOX_EVENT_MISMATCH/u);
assert.match(assets, /NATIVE_PATH_ADAPTER_DISABLED/u);
assert.match(identity, /VERIFIED_LOCAL_LINK/u);
assert.match(identity, /independent/u);
assert.match(evidence, /AI_PROPOSAL/u);
assert.match(evidence, /publicationEligible: false/u);
assert.match(publication, /MMC_PUBLICATION_SOURCE_PRIVATE/u);
assert.match(cutover, /V2_FORWARD_REPAIR_REQUIRED/u);

assert.match(webex, /MMHQ_MMC_WEBEX_ENABLED/u);
assert.match(webex, /redirect:\s*'manual'/u);
assert.doesNotMatch(webex, /process\.env\.(?:MMHQ_WEBEX|WEBEX|MMHQ_SCHEDULER|MMED_WEBEX)/u,
  'The MMC Webex adapter must not inherit shared credentials or configuration.');
assert.doesNotMatch(webex, /method:\s*['"`](?:POST|PUT|PATCH|DELETE)['"`]/u, 'Webex integration must remain read-only.');

console.log('MMC-400 CAM v2 coaching pipeline contract validation passed.');
