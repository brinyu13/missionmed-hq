import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const serverSource = readFileSync(path.join(rootDir, 'missionmed-hq/server.mjs'), 'utf8');
const routeSource = readFileSync(path.join(rootDir, 'missionmed-hq/routes/mmc-coaching-pipeline.mjs'), 'utf8');
const workerSource = readFileSync(path.join(rootDir, 'missionmed-hq/lib/mmc-coaching-import-worker.mjs'), 'utf8');
const resolverSource = readFileSync(path.join(rootDir, 'missionmed-hq/lib/mmc-student-resolution-engine.mjs'), 'utf8');
const webexPullSource = readFileSync(path.join(rootDir, 'missionmed-hq/lib/mmc-webex-triggered-pull.mjs'), 'utf8');
const migrationSource = readFileSync(path.join(rootDir, 'supabase/migrations/20260626040000_mmc_coaching_intelligence_pipeline.sql'), 'utf8');
const defaultPrompt = readFileSync(path.join(rootDir, 'missionmed-hq/prompts/mmc-meeting-analysis-default.md'), 'utf8');

const requiredTables = [
  'mmc.ai_prompt_versions',
  'mmc.coaching_source_assets',
  'mmc.coaching_analysis_runs',
];

const requiredOutputKeys = [
  'summary',
  'action_items',
  'story_insights',
  'mentor_note_draft',
  'sensitive_topics',
  'relationship_signals',
  'timeline_events',
  'risk',
  'readiness',
  'next_best_move',
  'confidence',
  'evidence',
];

for (const table of requiredTables) {
  assert.match(migrationSource, new RegExp(`CREATE TABLE IF NOT EXISTS ${table.replace('.', '\\.')}`, 'u'), `Missing ${table}`);
  assert.match(migrationSource, new RegExp(`ALTER TABLE ${table.replace('.', '\\.')} ENABLE ROW LEVEL SECURITY`, 'u'), `Missing RLS enable for ${table}`);
  assert.match(migrationSource, new RegExp(`ALTER TABLE ${table.replace('.', '\\.')} FORCE ROW LEVEL SECURITY`, 'u'), `Missing RLS force for ${table}`);
}

assert.match(migrationSource, /current_setting\('mmc\.schema_build_target'/u, 'Migration must require explicit staging/local target.');
assert.match(migrationSource, /v_target NOT IN \('local', 'staging', 'ci'\)/u, 'Migration must remain staging/local/ci only.');
assert.doesNotMatch(migrationSource, /service_role/iu, 'MMC-400 migration must not introduce service_role runtime dependency.');
assert.match(migrationSource, /ai_prompt_versions_one_active_key_uk/u, 'Prompt table must enforce one active prompt per key.');
assert.match(migrationSource, /coaching_analysis_runs_assigned_mentor_select/u, 'Analysis runs need assigned mentor read policy.');
assert.match(migrationSource, /coaching_analysis_runs_assigned_mentor_insert/u, 'Analysis runs need assigned mentor insert policy.');

assert.match(serverSource, /mmc-coaching-pipeline\.mjs/u, 'server.mjs must import MMC coaching pipeline route module.');
assert.match(serverSource, /isMmcCoachingPipelinePath\(pathname\)/u, 'server.mjs must route MMC coaching pipeline paths.');
assert.match(serverSource, /isAuthorizedMmcPrivateSession/u, 'MMC coaching pipeline must receive private-route authorization guard.');
assert.match(serverSource, /getMmcPersistenceConfig/u, 'MMC coaching pipeline must use existing MMC persistence config.');
assert.match(serverSource, /buildMmcPersistenceContext/u, 'MMC coaching pipeline must use existing RLS-scoped MMC context.');

assert.match(routeSource, /PIPELINE_PREFIX = '\/api\/mmc\/coaching-pipeline'/u, 'Pipeline route prefix is missing.');
assert.match(routeSource, /isAuthorizedMmcPrivateSession/u, 'Route must enforce MMC private authorization.');
assert.match(routeSource, /getMmcPersistenceConfig/u, 'Route must use MMC persistence config.');
assert.match(routeSource, /readVideoRegistryEntries/u, 'Route must read existing VIDEO_SYSTEM registry as data.');
assert.match(routeSource, /runMockAnalysis/u, 'Route must support mocked analysis validation.');
assert.match(routeSource, /runAiAnalysis/u, 'Route must support real AI analysis execution.');
assert.match(routeSource, /OPENAI_RESPONSES_URL/u, 'Route must use OpenAI Responses for structured analysis.');
assert.match(routeSource, /text:\s*\{\s*format:\s*\{/u, 'Route must request Structured Outputs through text.format.');
assert.match(routeSource, /strict:\s*true/u, 'Route must request strict structured outputs.');
assert.match(routeSource, /analysis-runs\/attach/u, 'Route must support private UI source-asset attachment.');
assert.match(routeSource, /analysis-runs\/analyze/u, 'Route must support real analysis execution.');
assert.match(routeSource, /ensurePipelineSession/u, 'Route must attach source assets to MMC-owned coaching sessions.');
assert.match(routeSource, /providerCalled: false/u, 'Mock analysis must not call external AI provider.');
assert.match(routeSource, /assertStructuredAnalysis/u, 'Route must validate structured analysis before persistence.');
assert.match(routeSource, /loadTranscriptText/u, 'Route must load transcript content before provider analysis.');
assert.match(routeSource, /mentor_memory/u, 'Route must persist analysis-derived mentor memory.');
assert.match(routeSource, /open_loops/u, 'Route must persist analysis-derived open loops.');
assert.match(routeSource, /additionalProperties:\s*false/u, 'Structured output schema must reject unspecified keys.');
assert.match(routeSource, /worker\/status/u, 'Route must expose dedicated worker status.');
assert.match(routeSource, /worker\/scan/u, 'Route must expose dedicated worker dry-run scan.');
assert.match(routeSource, /worker\/import/u, 'Route must expose dedicated worker import.');
assert.match(routeSource, /worker\/process/u, 'Route must expose dedicated worker process.');
assert.match(routeSource, /scanCoachingDropZone/u, 'Route must use the dedicated coaching import worker module.');
assert.match(routeSource, /student-resolution\/review-queue/u, 'Route must expose student resolution review queue.');
assert.match(routeSource, /student-resolution\/resolve/u, 'Route must expose student resolution execution.');
assert.match(routeSource, /student-resolution\/approve/u, 'Route must expose reviewed student resolution approval.');
assert.match(routeSource, /resolveStudentForSourceAsset/u, 'Route must use the MMC-504 student resolution engine.');
assert.match(routeSource, /roster-verification\/sources/u, 'Route must expose MMC-506 roster verification source inventory.');
assert.match(routeSource, /roster-verification\/resolve/u, 'Route must expose MMC-506 roster verification scoring.');
assert.match(routeSource, /roster-verification\/approve/u, 'Route must expose MMC-506 verified roster bridge approval.');
assert.match(routeSource, /verifyRosterCandidate/u, 'Route must use the MMC-506 roster verification lane.');
assert.match(routeSource, /ensureVerifiedRosterBridge/u, 'Route must persist only verified roster bridge rows.');
assert.match(routeSource, /webex\/status/u, 'Route must expose MMC-507 Webex trigger status.');
assert.match(routeSource, /webex\/recordings/u, 'Route must expose MMC-507 read-only Webex inventory.');
assert.match(routeSource, /webex\/pull/u, 'Route must expose MMC-507 trigger-gated Webex pull.');
assert.match(routeSource, /pullTriggeredWebexRecordings/u, 'Route must use the MMC-507 Webex triggered pull adapter.');
assert.match(webexPullSource, /DEFAULT_WEBEX_TRIGGER_DROP_ZONE_PATH/u, 'Webex pull adapter must define the MMC-507 staging path.');
assert.match(webexPullSource, /classifyWebexRecordingTitle/u, 'Webex pull adapter must classify title trigger codes.');
assert.match(webexPullSource, /\[MM-ADV\]/u, 'Webex pull adapter must default to [MM-ADV].');
assert.match(webexPullSource, /\[MM-IGNORE\]/u, 'Webex pull adapter must support explicit ignore trigger.');
assert.match(webexPullSource, /method:\s*'GET'/u, 'Webex adapter must use GET for Webex inventory/detail/download.');
assert.doesNotMatch(webexPullSource, /method:\s*['"`](POST|PATCH|PUT|DELETE)['"`]/u, 'Webex adapter must not mutate Webex.');
assert.match(resolverSource, /STUDENT_RESOLUTION_STATUS/u, 'Resolver must define explicit resolution statuses.');
assert.match(resolverSource, /noNameOnlyAutoAttach/u, 'Resolver must explicitly prevent name-only auto-attachment.');
assert.match(resolverSource, /DEMO_FIXTURE_STUDENT_IDS/u, 'Resolver must explicitly protect demo fixture students.');
assert.match(workerSource, /MissionWebexVideos/u, 'Worker must target the canonical MissionWebexVideos drop zone.');
assert.match(workerSource, /mp4/u, 'Worker must accept MP4-class coaching videos.');
assert.match(workerSource, /vtt/u, 'Worker must accept VTT transcripts.');
assert.match(workerSource, /idempotencyKey/u, 'Worker must compute idempotency keys.');
assert.match(workerSource, /dailyDrillsWatcherStarted:\s*false/u, 'Worker must explicitly prove Daily Drills watcher is not started.');

const forbiddenRoutePatterns = [
  /backend\/watcher/u,
  /execute_drop_zone_pipeline/u,
  /upload_to_r2/u,
  /upload_to_stream/u,
  /delete_r2_object/u,
  /writeFileSync/u,
  /appendFileSync/u,
  /\/api\/scheduler/u,
  /service_role/iu,
];

for (const pattern of forbiddenRoutePatterns) {
  assert.doesNotMatch(routeSource, pattern, `Route must not include forbidden pattern ${pattern}.`);
  assert.doesNotMatch(workerSource, pattern, `Worker must not include forbidden pattern ${pattern}.`);
  assert.doesNotMatch(resolverSource, pattern, `Resolver must not include forbidden pattern ${pattern}.`);
}

const forbiddenWorkerPatterns = [
  /video_registry\.json.*write/iu,
  /createWriteStream/iu,
  /renameSync/iu,
  /unlinkSync/iu,
  /mkdirSync/iu,
  /rmSync/iu,
  /fetch\(/u,
];

for (const pattern of forbiddenWorkerPatterns) {
  assert.doesNotMatch(workerSource, pattern, `Worker must not include forbidden mutation/network pattern ${pattern}.`);
}

for (const key of requiredOutputKeys) {
  assert.match(routeSource, new RegExp(key, 'u'), `Route output schema missing ${key}`);
  assert.match(defaultPrompt, new RegExp(key, 'u'), `Default prompt missing ${key}`);
}

console.log('MMC-400 coaching pipeline contract validation passed.');
