import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  getCoachingImportWorkerStatus,
  scanCoachingDropZone,
} from '../lib/mmc-coaching-import-worker.mjs';
import {
  DEFAULT_WEBEX_TRIGGER_DROP_ZONE_PATH,
  getWebexTriggerPullConfig,
  listWebexRecordings,
  normalizeTriggerList,
  pullTriggeredWebexRecordings,
} from '../lib/mmc-webex-triggered-pull.mjs';
import {
  dbStatusFromResolutionStatus,
  formatResolutionForReview,
  resolveStudentForSourceAsset,
  STUDENT_RESOLUTION_STATUS,
} from '../lib/mmc-student-resolution-engine.mjs';
import {
  listRosterVerificationSources,
  rosterStudentIdFromName,
  summarizeRosterVerificationForReview,
  verifyRosterCandidate,
  ROSTER_VERIFICATION_STATUS,
} from '../lib/mmc-roster-verification-lane.mjs';

const PIPELINE_PREFIX = '/api/mmc/coaching-pipeline';
const DEFAULT_VIDEO_REGISTRY_PATH = '/Users/brianb/MissionMed/VIDEO_SYSTEM/video_registry.json';
const DEFAULT_PROMPT_KEY = 'meeting_analysis';
const DEFAULT_OPENAI_MODEL = 'gpt-5.5';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_TRANSCRIPT_MAX_CHARS = 200_000;
const DEFAULT_OPENAI_TIMEOUT_MS = 90_000;

const ANALYSIS_EVIDENCE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['quote', 'location', 'relevance', 'confidence'],
  properties: {
    quote: { type: 'string' },
    location: { type: 'string' },
    relevance: { type: 'string' },
    confidence: { type: 'number' },
  },
});

const ANALYSIS_ITEM_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['title', 'detail', 'confidence', 'evidence'],
  properties: {
    title: { type: 'string' },
    detail: { type: 'string' },
    confidence: { type: 'number' },
    evidence: { type: 'array', items: ANALYSIS_EVIDENCE_SCHEMA },
  },
});

const ACTION_ITEM_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['title', 'details', 'owner_type', 'due_signal', 'sensitive', 'confidence', 'evidence'],
  properties: {
    title: { type: 'string' },
    details: { type: 'string' },
    owner_type: { type: 'string', enum: ['mentor', 'student', 'shared', 'system'] },
    due_signal: { type: 'string' },
    sensitive: { type: 'boolean' },
    confidence: { type: 'number' },
    evidence: { type: 'array', items: ANALYSIS_EVIDENCE_SCHEMA },
  },
});

const SENSITIVE_TOPIC_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['topic', 'detail', 'mentor_only', 'confidence', 'evidence'],
  properties: {
    topic: { type: 'string' },
    detail: { type: 'string' },
    mentor_only: { type: 'boolean' },
    confidence: { type: 'number' },
    evidence: { type: 'array', items: ANALYSIS_EVIDENCE_SCHEMA },
  },
});

const RELATIONSHIP_SIGNAL_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['signal', 'detail', 'trend', 'confidence', 'evidence'],
  properties: {
    signal: { type: 'string' },
    detail: { type: 'string' },
    trend: { type: 'string' },
    confidence: { type: 'number' },
    evidence: { type: 'array', items: ANALYSIS_EVIDENCE_SCHEMA },
  },
});

const TIMELINE_EVENT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['event', 'when', 'detail', 'evidence'],
  properties: {
    event: { type: 'string' },
    when: { type: 'string' },
    detail: { type: 'string' },
    evidence: { type: 'array', items: ANALYSIS_EVIDENCE_SCHEMA },
  },
});

const RISK_READINESS_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['level', 'reasons', 'confidence'],
  properties: {
    level: { type: 'string' },
    reasons: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number' },
  },
});

const DEFAULT_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: [
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
  ],
  properties: {
    summary: { type: 'string' },
    action_items: { type: 'array', items: ACTION_ITEM_SCHEMA },
    story_insights: { type: 'array', items: ANALYSIS_ITEM_SCHEMA },
    mentor_note_draft: { type: 'string' },
    sensitive_topics: { type: 'array', items: SENSITIVE_TOPIC_SCHEMA },
    relationship_signals: { type: 'array', items: RELATIONSHIP_SIGNAL_SCHEMA },
    timeline_events: { type: 'array', items: TIMELINE_EVENT_SCHEMA },
    risk: RISK_READINESS_SCHEMA,
    readiness: RISK_READINESS_SCHEMA,
    next_best_move: { type: 'string' },
    confidence: { type: 'number' },
    evidence: { type: 'array', items: ANALYSIS_EVIDENCE_SCHEMA },
  },
});

export function isMmcCoachingPipelinePath(pathname = '') {
  const normalized = String(pathname || '').replace(/\/+$/u, '') || '/';
  return normalized === PIPELINE_PREFIX || normalized.startsWith(`${PIPELINE_PREFIX}/`);
}

export async function handleMmcCoachingPipelineRoute(request, response, url, deps = {}) {
  const pathname = url.pathname.replace(/\/+$/u, '') || PIPELINE_PREFIX;
  const route = pathname.slice(PIPELINE_PREFIX.length) || '/';
  const method = String(request.method || 'GET').toUpperCase();

  if (!deps.isAuthorizedMmcPrivateSession?.(deps.session)) {
    deps.sendJson(response, 403, {
      ok: false,
      error: 'mmc_private_forbidden',
      message: 'MMC coaching pipeline requires the private MMC route-specific authorization model.',
    }, deps.authHeaders || {});
    return;
  }

  const configStatus = deps.getMmcPersistenceConfig();
  if (!configStatus.ok) {
    deps.sendJson(response, configStatus.status || 503, {
      ok: false,
      error: configStatus.code,
      message: configStatus.message,
      status: 'UNVERIFIED',
    }, deps.authHeaders || {});
    return;
  }

  const context = deps.buildMmcPersistenceContext(deps.session, configStatus);

  try {
    if ((route === '/' || route === '/status') && method === 'GET') {
      deps.sendJson(response, 200, buildStatusPayload(context, configStatus), deps.authHeaders || {});
      return;
    }

    if (route === '/inventory' && method === 'GET') {
      deps.sendJson(response, 200, buildInventoryPayload(url.searchParams), deps.authHeaders || {});
      return;
    }

    if (route === '/worker/status' && method === 'GET') {
      requirePipelineAdmin(context);
      const result = await buildWorkerStatusPayload(context, deps);
      deps.sendJson(response, 200, result, deps.authHeaders || {});
      return;
    }

    if (route === '/worker/scan' && method === 'GET') {
      requirePipelineAdmin(context);
      deps.sendJson(response, 200, buildWorkerScanPayload(url.searchParams), deps.authHeaders || {});
      return;
    }

    if (route === '/worker/import' && method === 'POST') {
      requirePipelineAdmin(context);
      const payload = await deps.readJsonBody(request);
      const result = await importWorkerCandidates(context, deps, payload || {});
      deps.sendJson(response, 200, result, deps.authHeaders || {});
      return;
    }

    if (route === '/worker/process' && method === 'POST') {
      requirePipelineAdmin(context);
      const payload = await deps.readJsonBody(request);
      const result = await processWorkerCandidates(context, deps, payload || {});
      deps.sendJson(response, 200, result, deps.authHeaders || {});
      return;
    }

    if (route === '/webex/status' && method === 'GET') {
      requirePipelineAdmin(context);
      deps.sendJson(response, 200, buildWebexStatusPayload(context), deps.authHeaders || {});
      return;
    }

    if (route === '/webex/recordings' && method === 'GET') {
      requirePipelineAdmin(context);
      const result = await buildWebexInventoryPayload(url.searchParams, deps);
      deps.sendJson(response, 200, result, deps.authHeaders || {});
      return;
    }

    if (route === '/webex/pull' && method === 'POST') {
      requirePipelineAdmin(context);
      const payload = await deps.readJsonBody(request);
      const result = await pullWebexTriggeredRecordings(context, deps, payload || {});
      deps.sendJson(response, 200, result, deps.authHeaders || {});
      return;
    }

    if (route === '/source-assets' && method === 'GET') {
      requirePipelineAdmin(context);
      const rows = await deps.selectMmcRows(context, 'coaching_source_assets', 'select=*&order=created_at.desc&limit=200');
      deps.sendJson(response, 200, { ok: true, status: 'VERIFIED', data: rows }, deps.authHeaders || {});
      return;
    }

    if (route === '/source-assets/import' && method === 'POST') {
      requirePipelineAdmin(context);
      const payload = await deps.readJsonBody(request);
      const result = await importSourceAssets(context, deps, payload || {});
      deps.sendJson(response, 200, result, deps.authHeaders || {});
      return;
    }

    if (route === '/student-resolution/review-queue' && method === 'GET') {
      requirePipelineAdmin(context);
      const result = await buildStudentResolutionReviewQueue(context, deps);
      deps.sendJson(response, 200, result, deps.authHeaders || {});
      return;
    }

    if (route === '/student-resolution/resolve' && method === 'POST') {
      requirePipelineAdmin(context);
      const payload = await deps.readJsonBody(request);
      const result = await resolveSourceAssetStudent(context, deps, payload || {});
      deps.sendJson(response, 200, result, deps.authHeaders || {});
      return;
    }

    if (route === '/student-resolution/approve' && method === 'POST') {
      requirePipelineAdmin(context);
      const payload = await deps.readJsonBody(request);
      const result = await approveStudentResolution(context, deps, payload || {});
      deps.sendJson(response, 200, result, deps.authHeaders || {});
      return;
    }

    if (route === '/roster-verification/sources' && method === 'GET') {
      requirePipelineAdmin(context);
      deps.sendJson(response, 200, buildRosterVerificationSourcesPayload(configStatus), deps.authHeaders || {});
      return;
    }

    if (route === '/roster-verification/resolve' && method === 'POST') {
      requirePipelineAdmin(context);
      const payload = await deps.readJsonBody(request);
      const result = await resolveRosterVerification(context, deps, payload || {});
      deps.sendJson(response, 200, result, deps.authHeaders || {});
      return;
    }

    if (route === '/roster-verification/approve' && method === 'POST') {
      requirePipelineAdmin(context);
      const payload = await deps.readJsonBody(request);
      const result = await approveRosterVerification(context, deps, payload || {});
      deps.sendJson(response, 200, result, deps.authHeaders || {});
      return;
    }

    if (route === '/prompts' && method === 'GET') {
      const rows = await deps.selectMmcRows(context, 'ai_prompt_versions', 'select=*&order=prompt_key.asc,prompt_version.desc&limit=200');
      deps.sendJson(response, 200, { ok: true, status: 'VERIFIED', data: rows }, deps.authHeaders || {});
      return;
    }

    if (route === '/prompts' && method === 'POST') {
      requirePipelineAdmin(context);
      const payload = await deps.readJsonBody(request);
      const result = await createPromptDraft(context, deps, payload || {});
      deps.sendJson(response, 200, result, deps.authHeaders || {});
      return;
    }

    if (route === '/prompts/activate' && method === 'POST') {
      requirePipelineAdmin(context);
      const payload = await deps.readJsonBody(request);
      const result = await activatePromptVersion(context, deps, payload || {});
      deps.sendJson(response, 200, result, deps.authHeaders || {});
      return;
    }

    if (route === '/prompts/rollback' && method === 'POST') {
      requirePipelineAdmin(context);
      const payload = await deps.readJsonBody(request);
      const result = await rollbackPromptVersion(context, deps, payload || {});
      deps.sendJson(response, 200, result, deps.authHeaders || {});
      return;
    }

    if (route === '/prompts/test' && method === 'POST') {
      const payload = await deps.readJsonBody(request);
      deps.sendJson(response, 200, testPromptPayload(payload || {}), deps.authHeaders || {});
      return;
    }

    if (route === '/analysis-runs' && method === 'POST') {
      const payload = await deps.readJsonBody(request);
      const result = await createAnalysisRun(context, deps, payload || {});
      deps.sendJson(response, 200, result, deps.authHeaders || {});
      return;
    }

    if (route === '/analysis-runs/attach' && method === 'POST') {
      requirePipelineAdmin(context);
      const payload = await deps.readJsonBody(request);
      const result = await attachSourceAssetForStudent(context, deps, payload || {});
      deps.sendJson(response, 200, result, deps.authHeaders || {});
      return;
    }

    if (route === '/analysis-runs/mock-analyze' && method === 'POST') {
      const payload = await deps.readJsonBody(request);
      const result = await runMockAnalysis(context, deps, payload || {});
      deps.sendJson(response, 200, result, deps.authHeaders || {});
      return;
    }

    if (route === '/analysis-runs/analyze' && method === 'POST') {
      const payload = await deps.readJsonBody(request);
      const result = await runAiAnalysis(context, deps, payload || {});
      deps.sendJson(response, 200, result, deps.authHeaders || {});
      return;
    }

    deps.sendJson(response, 404, {
      ok: false,
      error: 'mmc_pipeline_route_not_found',
      message: 'Unknown MMC coaching pipeline route.',
    }, deps.authHeaders || {});
  } catch (error) {
    const status = error?.statusCode || 502;
    deps.sendJson(response, status, {
      ok: false,
      status: status >= 500 ? 'CONFLICT' : 'UNVERIFIED',
      error: error?.code || 'mmc_pipeline_failed',
      message: error instanceof Error ? error.message : 'MMC coaching pipeline request failed.',
    }, deps.authHeaders || {});
  }
}

function buildStatusPayload(context, configStatus) {
  const providerConfig = getAiProviderConfig();
  return {
    ok: true,
    status: 'VERIFIED',
    mode: 'mmc-coaching-pipeline',
    projectRef: configStatus.projectRef,
    principalRole: context.principal.role,
    aiProvider: {
      provider: providerConfig.provider,
      model: providerConfig.model,
      enabled: providerConfig.enabled,
      configured: providerConfig.configured,
      structuredOutputs: true,
      apiKeyPresent: providerConfig.apiKeyPresent,
    },
    webexTriggerPull: {
      ...getWebexTriggerPullConfig(),
      tokenConfigured: getWebexTriggerPullConfig().tokenConfigured,
    },
    boundaries: {
      writes: 'mmc-owned pipeline tables and existing mmc intelligence tables only',
      protected: ['VIDEO_SYSTEM watcher', 'Daily Drills ingestion', 'R2', 'Cloudflare Stream', 'Scheduler', 'Calendar', 'Webex mutations', 'File Vault'],
      serviceRoleRuntime: false,
    },
    routes: [
      'GET /api/mmc/coaching-pipeline/inventory',
      'GET /api/mmc/coaching-pipeline/source-assets',
      'POST /api/mmc/coaching-pipeline/source-assets/import',
      'GET /api/mmc/coaching-pipeline/worker/status',
      'GET /api/mmc/coaching-pipeline/worker/scan',
      'POST /api/mmc/coaching-pipeline/worker/import',
      'POST /api/mmc/coaching-pipeline/worker/process',
      'GET /api/mmc/coaching-pipeline/webex/status',
      'GET /api/mmc/coaching-pipeline/webex/recordings',
      'POST /api/mmc/coaching-pipeline/webex/pull',
      'GET /api/mmc/coaching-pipeline/student-resolution/review-queue',
      'POST /api/mmc/coaching-pipeline/student-resolution/resolve',
      'POST /api/mmc/coaching-pipeline/student-resolution/approve',
      'GET /api/mmc/coaching-pipeline/roster-verification/sources',
      'POST /api/mmc/coaching-pipeline/roster-verification/resolve',
      'POST /api/mmc/coaching-pipeline/roster-verification/approve',
      'GET /api/mmc/coaching-pipeline/prompts',
      'POST /api/mmc/coaching-pipeline/prompts',
      'POST /api/mmc/coaching-pipeline/prompts/activate',
      'POST /api/mmc/coaching-pipeline/prompts/rollback',
      'POST /api/mmc/coaching-pipeline/prompts/test',
      'POST /api/mmc/coaching-pipeline/analysis-runs',
      'POST /api/mmc/coaching-pipeline/analysis-runs/attach',
      'POST /api/mmc/coaching-pipeline/analysis-runs/mock-analyze',
      'POST /api/mmc/coaching-pipeline/analysis-runs/analyze',
    ],
  };
}

function buildInventoryPayload(searchParams) {
  const entries = readVideoRegistryEntries();
  const category = String(searchParams.get('category') || '').trim();
  const eventType = String(searchParams.get('event_type') || '').trim();
  const filtered = entries.filter((entry) => {
    if (category && String(entry.category || '') !== category) return false;
    if (eventType && String(entry.event_type || '') !== eventType) return false;
    return true;
  });
  const candidates = filtered.map(normalizeRegistryEntry).filter(Boolean);
  const stats = candidates.reduce((acc, item) => {
    acc.total += 1;
    if (item.media_url) acc.withMediaUrl += 1;
    if (item.transcript_pointer) acc.withTranscriptPointer += 1;
    acc.byCategory[item.category || 'unknown'] = (acc.byCategory[item.category || 'unknown'] || 0) + 1;
    acc.byEventType[item.event_type || 'unknown'] = (acc.byEventType[item.event_type || 'unknown'] || 0) + 1;
    return acc;
  }, {
    total: 0,
    withMediaUrl: 0,
    withTranscriptPointer: 0,
    byCategory: {},
    byEventType: {},
  });

  return {
    ok: true,
    status: 'VERIFIED',
    source: 'VIDEO_SYSTEM/video_registry.json read-only',
    registryPath: resolveVideoRegistryPath(),
    stats,
    candidates: candidates.slice(0, clampInteger(searchParams.get('limit'), 25, 1, 200)),
    protections: {
      watcherStarted: false,
      registryWritten: false,
      r2Touched: false,
      streamTouched: false,
    },
  };
}

function buildWebexStatusPayload(context) {
  const config = getWebexTriggerPullConfig();
  return {
    ...config,
    principalRole: context.principal.role,
    triggerPolicy: {
      defaultAllowed: '[MM-ADV]',
      explicitDeny: '[MM-IGNORE]',
      futureSupported: ['[MM-GRP]', '[MM-MOCK]', '[MM-PS]'],
      rule: 'Only recordings with an allowed title trigger are eligible for local staging; all untriggered recordings are ignored.',
    },
  };
}

async function buildWebexInventoryPayload(searchParams, deps) {
  const allowedTriggers = normalizeTriggerList(searchParams.get('allowed_triggers') || searchParams.get('allowedTriggers') || undefined);
  return listWebexRecordings({
    env: process.env,
    fetchImpl: deps.fetch || globalThis.fetch,
    allowedTriggers,
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
    hostEmail: searchParams.get('host_email') || searchParams.get('hostEmail') || undefined,
    meetingId: searchParams.get('meeting_id') || searchParams.get('meetingId') || undefined,
    limit: clampInteger(searchParams.get('limit'), 50, 1, 200),
  });
}

async function pullWebexTriggeredRecordings(context, deps, payload) {
  const allowedTriggers = normalizeTriggerList(payload.allowedTriggers || payload.allowed_triggers || undefined);
  const dropZonePath = String(payload.dropZonePath || payload.drop_zone_path || DEFAULT_WEBEX_TRIGGER_DROP_ZONE_PATH).trim();
  const result = await pullTriggeredWebexRecordings({
    env: process.env,
    fetchImpl: deps.fetch || globalThis.fetch,
    allowedTriggers,
    dropZonePath,
    from: payload.from,
    to: payload.to,
    hostEmail: payload.hostEmail || payload.host_email,
    meetingId: payload.meetingId || payload.meeting_id,
    limit: clampInteger(payload.limit, 5, 1, 25),
    force: payload.force === true,
  });

  let importResult = null;
  if (result.ok && result.staged?.some((item) => item.completePair)) {
    importResult = await importWorkerCandidates(context, deps, {
      dropZonePath: result.dropZonePath,
      minStableAgeMs: 0,
      limit: clampInteger(payload.importLimit || payload.import_limit, Math.max(result.staged.length + 5, 10), 1, 100),
    });
  }

  await insertPipelineAudit(context, deps, 'mmc507_webex_trigger_pull_completed', {
    status: result.status,
    allowed_triggers: allowedTriggers,
    staged: result.staged?.length || 0,
    ignored: result.ignored?.length || 0,
    skipped: result.skipped?.length || 0,
    drop_zone_path: result.dropZonePath,
    worker_imported: importResult?.imported?.length || 0,
    worker_updated: importResult?.updated?.length || 0,
    protections: result.protections,
  });

  return {
    ...result,
    workerImport: importResult,
  };
}

async function buildWorkerStatusPayload(context, deps, options = {}) {
  const status = getCoachingImportWorkerStatus(options);
  const workerRows = await deps.selectMmcRows(
    context,
    'coaching_source_assets',
    'source_system=eq.coaching_drop_zone&deleted_at=is.null&select=id,asset_status,review_status,meeting_match_status,subject_match_status,created_at,metadata&limit=500',
  );
  const reviewQueue = workerRows.filter((row) => {
    const subjectStatus = String(row.subject_match_status || '').toLowerCase();
    const meetingStatus = String(row.meeting_match_status || '').toLowerCase();
    const resolutionStatus = String(row.metadata?.student_resolution?.overall?.status || row.metadata?.student_resolution?.status || '').toUpperCase();
    return row.review_status === 'unreviewed'
      || subjectStatus === 'manual_review'
      || subjectStatus === 'unverified'
      || subjectStatus === 'conflict'
      || meetingStatus === 'manual_review'
      || meetingStatus === 'conflict'
      || ['MANUAL_REVIEW', 'CONFLICT', 'UNVERIFIED'].includes(resolutionStatus);
  });

  return {
    ...status,
    status: status.status === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED',
    dbQueue: {
      totalWorkerAssets: workerRows.length,
      reviewRequired: reviewQueue.length,
      analysisReady: workerRows.filter((row) => row.asset_status === 'analysis_ready').length,
      analyzed: workerRows.filter((row) => row.asset_status === 'analyzed').length,
    },
    principalRole: context.principal.role,
  };
}

function buildWorkerScanPayload(searchParams) {
  const scan = scanCoachingDropZone({
    limit: clampInteger(searchParams.get('limit'), 25, 1, 100),
    includeIncomplete: searchParams.get('include_incomplete') !== '0',
    minStableAgeMs: clampInteger(searchParams.get('min_stable_age_ms'), 0, 0, 86_400_000),
    dropZonePath: searchParams.get('drop_zone_path') || searchParams.get('dropZonePath') || undefined,
  });
  return {
    ...scan,
    mode: 'dry-run-scan',
    databaseWritten: false,
  };
}

async function importWorkerCandidates(context, deps, payload) {
  const scan = scanCoachingDropZone({
    limit: clampInteger(payload.limit, 25, 1, 100),
    includeIncomplete: true,
    minStableAgeMs: clampInteger(payload.minStableAgeMs ?? payload.min_stable_age_ms, 0, 0, 86_400_000),
    dropZonePath: payload.dropZonePath || payload.drop_zone_path || undefined,
  });
  const imported = [];
  const updated = [];
  const skipped = [];
  const reviewQueue = [];

  for (const candidate of scan.candidates) {
    if (!candidate.complete) {
      skipped.push({ source_id: candidate.sourceId, reason: 'incomplete_pair' });
      continue;
    }
    const rowPayload = buildWorkerSourceAssetRow(context, candidate);
    const existing = await deps.selectMmcRows(
      context,
      'coaching_source_assets',
      `source_system=eq.coaching_drop_zone&source_id=eq.${encodeURIComponent(candidate.sourceId)}&deleted_at=is.null&select=*&limit=1`,
    );
    if (existing[0]) {
      let row = await deps.updateMmcRow(context, 'coaching_source_assets', existing[0].id, {
        asset_title: rowPayload.asset_title,
        asset_date: rowPayload.asset_date,
        media_url: rowPayload.media_url,
        transcript_pointer: rowPayload.transcript_pointer,
        transcript_hash: rowPayload.transcript_hash,
        asset_status: existing[0].asset_status === 'analyzed' ? 'analyzed' : rowPayload.asset_status,
        meeting_match_status: rowPayload.meeting_match_status,
        meeting_match_confidence: rowPayload.meeting_match_confidence,
        subject_match_status: rowPayload.subject_match_status,
        subject_match_confidence: rowPayload.subject_match_confidence,
        review_status: existing[0].review_status === 'verified' ? 'verified' : rowPayload.review_status,
        source_refs: rowPayload.source_refs,
        provenance: rowPayload.provenance,
        metadata: {
          ...(existing[0].metadata || {}),
          ...rowPayload.metadata,
          worker_last_seen_at: new Date().toISOString(),
        },
        updated_by_principal_id: context.principal.id,
      });
      row = (await resolveAndPatchSourceAsset(context, deps, row, { reason: 'worker_import_update' })).row;
      updated.push(row);
      if (sourceAssetRequiresResolutionReview(row)) reviewQueue.push(row);
    } else {
      let row = await deps.insertMmcRow(context, 'coaching_source_assets', rowPayload);
      row = (await resolveAndPatchSourceAsset(context, deps, row, { reason: 'worker_import_insert' })).row;
      imported.push(row);
      if (sourceAssetRequiresResolutionReview(row)) reviewQueue.push(row);
    }
  }

  await insertPipelineAudit(context, deps, 'mmc502_worker_import_completed', {
    drop_zone_status: scan.status,
    candidates: scan.candidates.length,
    imported: imported.length,
    updated: updated.length,
    review_required: reviewQueue.length,
    incomplete: scan.incomplete.length,
  });

  return {
    ok: true,
    status: scan.status === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED',
    mode: 'coaching-import-worker',
    imported,
    updated,
    skipped,
    reviewQueue,
    scan: {
      dropZonePath: scan.dropZonePath,
      candidates: scan.candidates.length,
      incomplete: scan.incomplete.length,
      warnings: scan.warnings,
    },
    protections: scan.protections,
  };
}

async function processWorkerCandidates(context, deps, payload) {
  const importResult = await importWorkerCandidates(context, deps, payload);
  const analysisMode = String(payload.analysisMode || payload.analysis_mode || 'none').trim().toLowerCase();
  const processable = [...(importResult.imported || []), ...(importResult.updated || [])]
    .filter((row) => workerRowCanAutoProcess(row, payload));
  const processed = [];
  const blocked = [];

  for (const sourceAsset of processable.slice(0, clampInteger(payload.processLimit || payload.process_limit, 3, 1, 10))) {
    const resolved = await resolveAndPatchSourceAsset(context, deps, sourceAsset, { reason: 'worker_process' });
    const resolvedSourceAsset = resolved.row || sourceAsset;
    const resolution = resolved.result || {};
    const suggestedStudent = resolution.student?.suggested || {};
    const studentId = String(
      payload.studentId ||
      payload.student_id ||
      resolvedSourceAsset.metadata?.worker?.student_id ||
      (resolution.autoAttach ? suggestedStudent.studentId : '') ||
      '',
    ).trim();
    if (!studentId) {
      blocked.push({
        source_asset_id: sourceAsset.id,
        reason: 'student_resolution_requires_review',
        resolution: formatResolutionForReview(resolution),
      });
      continue;
    }
    try {
      const attach = await attachSourceAssetForStudent(context, deps, {
        sourceAssetId: resolvedSourceAsset.id,
        studentId,
        studentName: suggestedStudent.studentName || resolvedSourceAsset.metadata?.worker?.parsed_name?.studentName || studentId,
        sessionLocalId: resolvedSourceAsset.metadata?.worker?.session_local_id || '',
        sessionTitle: resolvedSourceAsset.asset_title,
        resolution,
      });
      let analysis = null;
      if (analysisMode === 'mock') {
        analysis = await runMockAnalysis(context, deps, { analysisRunId: attach.data.analysisRun.id });
      } else if (analysisMode === 'real') {
        analysis = await runAiAnalysis(context, deps, { analysisRunId: attach.data.analysisRun.id });
      }
      processed.push({
        source_asset_id: resolvedSourceAsset.id,
        analysis_run_id: attach.data.analysisRun.id,
        student_id: studentId,
        resolution: formatResolutionForReview(resolution),
        analysis_mode: analysisMode,
        persisted: analysis?.persisted || null,
      });
    } catch (error) {
      blocked.push({
        source_asset_id: sourceAsset.id,
        reason: error?.code || 'worker_process_failed',
        message: error instanceof Error ? error.message : 'Worker process failed.',
      });
    }
  }

  await insertPipelineAudit(context, deps, 'mmc502_worker_process_completed', {
    analysis_mode: analysisMode,
    processable: processable.length,
    processed: processed.length,
    blocked: blocked.length,
  });

  return {
    ok: true,
    status: blocked.length ? 'UNVERIFIED' : 'VERIFIED',
    mode: 'coaching-import-worker-process',
    importResult,
    processed,
    blocked,
    protections: {
      dailyDrillsWatcherStarted: false,
      videoRegistryWritten: false,
      r2Touched: false,
      streamTouched: false,
    },
  };
}

function buildWorkerSourceAssetRow(context, candidate) {
  const analysisReady = (
    candidate.complete &&
    ['verified', 'probable'].includes(candidate.meetingMatchStatus) &&
    ['verified', 'probable'].includes(candidate.subjectMatchStatus)
  );
  return {
    source_system: 'coaching_drop_zone',
    source_id: candidate.sourceId,
    asset_title: candidate.assetTitle,
    asset_date: candidate.assetDate,
    media_url: candidate.mediaPath || null,
    thumbnail_url: null,
    transcript_pointer: candidate.transcriptPath || null,
    transcript_hash: candidate.transcript?.sha256 || null,
    asset_status: analysisReady ? 'analysis_ready' : 'candidate',
    meeting_match_status: candidate.meetingMatchStatus,
    meeting_match_confidence: candidate.meetingMatchConfidence,
    subject_match_status: candidate.subjectMatchStatus,
    subject_match_confidence: candidate.subjectMatchConfidence,
    visibility: 'mentor_admin',
    sensitivity: 'sensitive',
    review_status: candidate.reviewRequired ? 'unreviewed' : 'verified',
    source_refs: [{
      system: 'coaching_import_worker',
      drop_zone_path: candidate.video?.relativePath ? path.dirname(candidate.mediaPath || '') : null,
      video_path: candidate.mediaPath || null,
      transcript_path: candidate.transcriptPath || null,
      metadata_path: candidate.metadataPath || null,
      idempotency_key: candidate.idempotencyKey,
    }],
    provenance: {
      source: 'MMC-502 dedicated Coaching Import Worker',
      copied_media: false,
      copied_transcript: false,
      daily_drills_watcher_started: false,
      video_registry_written: false,
      r2_touched: false,
      stream_touched: false,
    },
    metadata: {
      worker: {
        runtime: 'MMC-502',
        idempotency_key: candidate.idempotencyKey,
        student_id: candidate.studentId || null,
        session_local_id: candidate.sessionLocalId || null,
        auto_analyze: candidate.autoAnalyze,
        parsed_name: candidate.parsedName,
        review_required: candidate.reviewRequired,
        review_reasons: candidate.reviewReasons,
        video: summarizeWorkerFile(candidate.video),
        transcript: summarizeWorkerFile(candidate.transcript),
        metadata_file: summarizeWorkerFile(candidate.metadataFile),
      },
      original_metadata: candidate.metadata || {},
    },
    created_by_principal_id: context.principal.id,
    updated_by_principal_id: context.principal.id,
  };
}

function summarizeWorkerFile(file) {
  if (!file) return null;
  return {
    relative_path: file.relativePath,
    size_bytes: file.sizeBytes,
    sha256: file.sha256,
    stable: file.stable,
    mtime: file.mtime,
  };
}

function workerRowCanAutoProcess(row, payload = {}) {
  const requestedStudent = String(payload.studentId || payload.student_id || '').trim();
  const metadataStudent = String(row.metadata?.worker?.student_id || '').trim();
  const resolution = row.metadata?.student_resolution || {};
  const resolutionOverall = resolution.overall || resolution;
  const resolutionSuggested = resolution.student?.suggested || {};
  const resolutionAutoAttach = resolutionOverall.autoAttach === true
    && String(resolutionOverall.status || resolution.status || '').toUpperCase() === STUDENT_RESOLUTION_STATUS.VERIFIED
    && Boolean(resolutionSuggested.studentId);
  const subjectStatus = String(row.subject_match_status || '').toLowerCase();
  const meetingStatus = String(row.meeting_match_status || '').toLowerCase();
  const subjectAllowed = ['verified', 'probable'].includes(subjectStatus);
  const meetingAllowed = ['verified', 'probable'].includes(meetingStatus);
  const adminManualStudentOverride = Boolean(requestedStudent);
  return meetingAllowed && (subjectAllowed || adminManualStudentOverride || resolutionAutoAttach) && Boolean(requestedStudent || metadataStudent || resolutionAutoAttach);
}

async function buildStudentResolutionReviewQueue(context, deps) {
  const rows = await deps.selectMmcRows(
    context,
    'coaching_source_assets',
    'deleted_at=is.null&select=*&order=created_at.desc&limit=200',
  );
  const resolutionContext = await collectStudentResolutionContext(context, deps);
  const reviewItems = rows
    .map((row) => {
      const result = row.metadata?.student_resolution || resolveStudentForSourceAsset(row, resolutionContext);
      return {
        sourceAsset: row,
        resolution: formatResolutionForReview(result),
        reviewRequired: sourceAssetRequiresResolutionReview({ ...row, metadata: { ...(row.metadata || {}), student_resolution: result } }),
      };
    })
    .filter((item) => item.reviewRequired);

  return {
    ok: true,
    status: 'VERIFIED',
    mode: 'student-resolution-review-queue',
    count: reviewItems.length,
    data: reviewItems,
    protections: {
      databaseWritten: false,
      productionHydration: false,
      noCanonicalStudentDeclared: true,
    },
  };
}

async function resolveSourceAssetStudent(context, deps, payload) {
  const sourceAsset = await findRowById(context, deps, 'coaching_source_assets', payload.sourceAssetId || payload.source_asset_id);
  const resolved = await resolveAndPatchSourceAsset(context, deps, sourceAsset, { reason: 'manual_resolution_request' });
  await insertPipelineAudit(context, deps, 'mmc504_student_resolution_run', {
    source_asset_id: sourceAsset.id,
    status: resolved.result.status,
    confidence: resolved.result.confidence,
    auto_attach: resolved.result.autoAttach,
    suggested_student_id: resolved.result.student?.suggested?.studentId || null,
  });
  return {
    ok: true,
    status: resolved.result.status === STUDENT_RESOLUTION_STATUS.CONFLICT ? 'CONFLICT' : 'VERIFIED',
    mode: 'student-resolution',
    data: resolved.row,
    resolution: resolved.result,
    review: formatResolutionForReview(resolved.result),
  };
}

async function approveStudentResolution(context, deps, payload) {
  const decision = String(payload.decision || '').trim().toLowerCase();
  const sourceAsset = await findRowById(context, deps, 'coaching_source_assets', payload.sourceAssetId || payload.source_asset_id);
  const resolved = await resolveAndPatchSourceAsset(context, deps, sourceAsset, { reason: 'manual_resolution_approval' });
  const resolution = resolved.result;

  if (decision === 'reject') {
    const rejected = await deps.updateMmcRow(context, 'coaching_source_assets', sourceAsset.id, {
      asset_status: 'rejected',
      review_status: 'rejected',
      metadata: {
        ...(resolved.row.metadata || {}),
        student_resolution_rejected_at: new Date().toISOString(),
        student_resolution_rejected_by_principal_id: context.principal.id,
        student_resolution_rejection_reason: String(payload.reason || payload.rejection_reason || '').trim() || 'manual_review_rejected',
      },
      updated_by_principal_id: context.principal.id,
    });
    await insertPipelineAudit(context, deps, 'mmc504_student_resolution_rejected', {
      source_asset_id: sourceAsset.id,
      resolution_status: resolution.status,
    });
    return {
      ok: true,
      status: 'VERIFIED',
      mode: 'student-resolution-reject',
      data: rejected,
      resolution,
    };
  }

  const suggested = resolution.student?.suggested || {};
  const studentId = sanitizeLocalId(payload.studentId || payload.student_id || suggested.studentId || '');
  if (!studentId) {
    throw badRequest('student_resolution_student_id_required', 'A reviewed studentId is required before approving a source asset link.');
  }
  const studentName = String(payload.studentName || payload.student_name || suggested.studentName || titleFromLocalId(studentId)).trim();
  const attach = await attachSourceAssetForStudent(context, deps, {
    sourceAssetId: sourceAsset.id,
    studentId,
    studentName,
    sessionLocalId: payload.sessionLocalId || payload.session_local_id || resolved.row.metadata?.worker?.session_local_id || '',
    sessionTitle: payload.sessionTitle || payload.session_title || sourceAsset.asset_title,
    resolution,
    manualReviewApproved: true,
  });
  const approvedResolution = {
    ...resolution,
    status: STUDENT_RESOLUTION_STATUS.VERIFIED,
    autoAttach: true,
    overall: {
      ...(resolution.overall || {}),
      status: STUDENT_RESOLUTION_STATUS.VERIFIED,
      confidence: Math.max(Number(resolution.confidence || 0), 0.9),
      autoAttach: true,
      reviewRequired: false,
      reasons: ['manual_review_approved'],
    },
    review: {
      required: false,
      queue: 'manual_review_approved',
      reasons: ['manual_review_approved'],
    },
  };
  const approved = await deps.updateMmcRow(context, 'coaching_source_assets', sourceAsset.id, {
    asset_status: 'attached',
    meeting_match_status: dbStatusFromResolutionStatus(resolution.meeting?.status || STUDENT_RESOLUTION_STATUS.VERIFIED),
    meeting_match_confidence: Math.max(Number(resolution.meeting?.confidence || 0), 0.9),
    subject_match_status: 'verified',
    subject_match_confidence: 1,
    review_status: 'verified',
    metadata: {
      ...(resolved.row.metadata || {}),
      student_resolution: approvedResolution,
      student_resolution_manual_review: {
        approved_at: new Date().toISOString(),
        approved_by_principal_id: context.principal.id,
        student_id: studentId,
        student_name: studentName,
        subject_ref_id: attach.data.subject.subjectRefId,
        assignment_id: attach.data.subject.assignmentId,
      },
      last_analysis_run_id: attach.data.analysisRun.id,
    },
    updated_by_principal_id: context.principal.id,
  });
  await insertPipelineAudit(context, deps, 'mmc504_student_resolution_approved', {
    source_asset_id: sourceAsset.id,
    analysis_run_id: attach.data.analysisRun.id,
    student_id: studentId,
    subject_ref_id: attach.data.subject.subjectRefId,
    assignment_id: attach.data.subject.assignmentId,
    prior_resolution_status: resolution.status,
  });

  return {
    ok: true,
    status: 'VERIFIED',
    mode: 'student-resolution-approve',
    data: {
      sourceAsset: approved,
      analysisRun: attach.data.analysisRun,
      session: attach.data.session,
      subject: attach.data.subject,
    },
    resolution: approvedResolution,
    review: formatResolutionForReview(approvedResolution),
  };
}

function buildRosterVerificationSourcesPayload(configStatus) {
  return {
    ok: true,
    status: 'VERIFIED',
    mode: 'production-safe-roster-verification-lane',
    projectRef: configStatus.projectRef,
    sources: listRosterVerificationSources(),
    rules: {
      automaticPromotion: 'requires two independent strong source anchors and no conflict',
      adminPromotion: 'requires explicit admin approval and at least one strong source anchor',
      weakEvidence: 'name, email, Calendar title/date, and Webex title/date remain supporting only',
      writes: 'only verified MMC-owned identity_references and mentor_assignments; no production source writes',
    },
    protections: {
      serviceRoleRuntime: false,
      productionSourceWrites: false,
      fixturePromotion: false,
      nameOnlyPromotion: false,
      calendarWebexStandalonePromotion: false,
    },
  };
}

async function resolveRosterVerification(context, deps, payload) {
  const sourceAsset = payload.sourceAssetId || payload.source_asset_id
    ? await findRowById(context, deps, 'coaching_source_assets', payload.sourceAssetId || payload.source_asset_id)
    : null;
  const candidate = await buildRosterVerificationCandidate(context, deps, payload, sourceAsset);
  const verification = verifyRosterCandidate(candidate, { adminApproval: false });
  const review = summarizeRosterVerificationForReview(verification);

  let updatedSourceAsset = sourceAsset;
  if (sourceAsset) {
    updatedSourceAsset = await deps.updateMmcRow(context, 'coaching_source_assets', sourceAsset.id, {
      metadata: {
        ...(sourceAsset.metadata || {}),
        roster_verification: verification,
        roster_verification_review: review,
        roster_verification_last_checked_at: new Date().toISOString(),
      },
      updated_by_principal_id: context.principal.id,
    });
  }

  await insertPipelineAudit(context, deps, 'mmc506_roster_verification_resolved', {
    source_asset_id: sourceAsset?.id || null,
    student_id: verification.studentId || null,
    status: verification.status,
    confidence: verification.confidence,
    strong_anchors: verification.strongAnchors.length,
    independent_strong_anchors: verification.independentStrongAnchors,
    auto_promote: verification.autoPromote,
    wrote_bridge: false,
  });

  return {
    ok: true,
    status: verification.status === ROSTER_VERIFICATION_STATUS.CONFLICT ? 'CONFLICT' : 'VERIFIED',
    mode: 'roster-verification-resolve',
    data: updatedSourceAsset,
    verification,
    review,
    protections: {
      databaseWritten: Boolean(sourceAsset),
      bridgeWritten: false,
      productionSourceWrites: false,
    },
  };
}

async function approveRosterVerification(context, deps, payload) {
  const sourceAsset = payload.sourceAssetId || payload.source_asset_id
    ? await findRowById(context, deps, 'coaching_source_assets', payload.sourceAssetId || payload.source_asset_id)
    : null;
  const candidate = await buildRosterVerificationCandidate(context, deps, payload, sourceAsset);
  const verification = verifyRosterCandidate(candidate, { adminApproval: true });
  if (verification.status !== ROSTER_VERIFICATION_STATUS.VERIFIED) {
    throw conflict(
      'roster_verification_not_verified',
      `Roster verification cannot be promoted: ${verification.reasons.join(', ') || verification.status}.`,
    );
  }

  const bridge = await ensureVerifiedRosterBridge(context, deps, verification, sourceAsset, payload);
  const review = summarizeRosterVerificationForReview(verification);
  let updatedSourceAsset = sourceAsset;
  if (sourceAsset) {
    updatedSourceAsset = await deps.updateMmcRow(context, 'coaching_source_assets', sourceAsset.id, {
      subject_match_status: 'verified',
      subject_match_confidence: Math.max(Number(verification.confidence || 0), 0.9),
      review_status: 'verified',
      metadata: {
        ...(sourceAsset.metadata || {}),
        roster_verification: verification,
        roster_verification_review: review,
        roster_verification_bridge: {
          verified_at: new Date().toISOString(),
          verified_by_principal_id: context.principal.id,
          subject_ref_id: bridge.subjectRef.id,
          assignment_id: bridge.assignment.id,
          student_id: verification.studentId,
          student_name: verification.studentName,
        },
      },
      updated_by_principal_id: context.principal.id,
    });
  }

  await insertPipelineAudit(context, deps, 'mmc506_roster_verification_approved', {
    source_asset_id: sourceAsset?.id || null,
    student_id: verification.studentId,
    subject_ref_id: bridge.subjectRef.id,
    assignment_id: bridge.assignment.id,
    confidence: verification.confidence,
    admin_approved: verification.adminApproved,
    strong_anchors: verification.strongAnchors.length,
    independent_strong_anchors: verification.independentStrongAnchors,
  });

  return {
    ok: true,
    status: 'VERIFIED',
    mode: 'roster-verification-approve',
    data: {
      sourceAsset: updatedSourceAsset,
      subject: {
        studentId: verification.studentId,
        studentName: verification.studentName,
        subjectRefId: bridge.subjectRef.id,
        assignmentId: bridge.assignment.id,
      },
      identityReference: bridge.subjectRef,
      assignment: bridge.assignment,
    },
    verification,
    review,
    protections: {
      productionSourceWrites: false,
      bridgeWritten: true,
      anchorType: 'missionmed_roster_student',
      serviceRoleRuntime: false,
    },
  };
}

async function buildRosterVerificationCandidate(context, deps, payload, sourceAsset = null) {
  const resolutionContext = await collectStudentResolutionContext(context, deps);
  const suggested = sourceAsset?.metadata?.student_resolution?.student?.suggested || {};
  const studentId = rosterStudentIdFromName(
    payload.studentId ||
    payload.student_id ||
    suggested.studentId ||
    sourceAsset?.metadata?.worker?.student_id ||
    '',
  );
  const studentName = String(
    payload.studentName ||
    payload.student_name ||
    suggested.studentName ||
    sourceAsset?.metadata?.worker?.parsed_name?.studentName ||
    titleFromLocalId(studentId),
  ).trim();
  const evidence = [
    ...buildRosterEvidenceFromSourceAsset(sourceAsset, studentId, studentName),
    ...buildExistingMmcRosterEvidence(resolutionContext, studentId, studentName),
    ...normalizePayloadEvidence(payload.sourceEvidence || payload.source_evidence || payload.evidence),
  ];
  return {
    studentId,
    studentName,
    evidence,
    sourceAssetId: sourceAsset?.id || null,
  };
}

function buildRosterEvidenceFromSourceAsset(sourceAsset, studentId, studentName) {
  if (!sourceAsset || !studentId) return [];
  const evidence = [];
  const worker = sourceAsset.metadata?.worker || {};
  const parsed = worker.parsed_name || {};
  if (parsed.studentName || sourceAsset.asset_title) {
    evidence.push({
      sourceSystem: 'drop_zone_filename',
      anchorType: 'display_name',
      anchorValue: parsed.studentName || sourceAsset.asset_title,
      studentId,
      studentName,
      confidence: parsed.preferredPattern ? 0.64 : 0.42,
      readPath: 'local coaching drop-zone filename evidence only',
      status: 'LIKELY',
    });
  }
  if (sourceAsset.asset_date) {
    evidence.push({
      sourceSystem: 'calendar_title_date',
      anchorType: 'title_date',
      anchorValue: `${sourceAsset.asset_title || sourceAsset.source_id || sourceAsset.id}|${sourceAsset.asset_date}`,
      studentId,
      studentName,
      confidence: 0.36,
      readPath: 'supporting source asset date/title evidence',
      status: 'LIKELY',
    });
  }
  return evidence;
}

function buildExistingMmcRosterEvidence(resolutionContext, studentId, studentName) {
  if (!studentId) return [];
  const identityReferences = Array.isArray(resolutionContext.identityReferences) ? resolutionContext.identityReferences : [];
  const assignments = Array.isArray(resolutionContext.mentorAssignments) ? resolutionContext.mentorAssignments : [];
  const refs = identityReferences.filter((reference) => {
    const metadataId = rosterStudentIdFromName(reference.metadata?.student_id || reference.metadata?.roster_student_id || '');
    const hashId = String(reference.primary_anchor_hash || '').replace(/^missionmed-roster:/u, '');
    return metadataId === studentId || hashId === studentId;
  });
  return refs.flatMap((reference) => {
    const assigned = assignments.some((assignment) => assignment.subject_ref_id === reference.id && String(assignment.status || '').toLowerCase() === 'active');
    if (!assigned) return [];
    return [{
      sourceSystem: 'mmc_identity_reference',
      anchorType: reference.primary_anchor_type || 'missionmed_roster_student',
      anchorValue: reference.primary_anchor_hash || reference.id,
      studentId,
      studentName: studentName || reference.metadata?.student_name || titleFromLocalId(studentId),
      confidence: Math.max(Number(reference.confidence || 0), 0.88),
      readPath: 'RLS-scoped mmc.identity_references + mmc.mentor_assignments',
      status: reference.reference_status || 'verified',
    }];
  });
}

function normalizePayloadEvidence(value) {
  return (Array.isArray(value) ? value : []).map((item) => ({
    sourceSystem: item.sourceSystem || item.source_system || item.system,
    anchorType: item.anchorType || item.anchor_type || item.type,
    anchorValue: item.anchorValue || item.anchor_value || item.value,
    studentId: item.studentId || item.student_id,
    studentName: item.studentName || item.student_name,
    confidence: item.confidence,
    readPath: item.readPath || item.read_path,
    status: item.status,
    provenance: item.provenance,
  }));
}

async function ensureVerifiedRosterBridge(context, deps, verification, sourceAsset = null, payload = {}) {
  const mentor = await findCurrentMentor(context, deps);
  const studentId = rosterStudentIdFromName(verification.studentId);
  const studentName = String(verification.studentName || titleFromLocalId(studentId)).trim();
  const anchorHash = `missionmed-roster:${studentId}`;
  const existingRefs = await deps.selectMmcRows(
    context,
    'identity_references',
    `primary_anchor_type=eq.missionmed_roster_student&primary_anchor_hash=eq.${encodeURIComponent(anchorHash)}&deleted_at=is.null&select=*&limit=1`,
  );
  const now = new Date().toISOString();
  const subjectPatch = {
    reference_status: 'verified',
    primary_anchor_type: 'missionmed_roster_student',
    primary_anchor_hash: anchorHash,
    verification_method: 'MMC-506 production-safe roster verification lane',
    verified_by_principal_id: context.principal.id,
    verified_at: now,
    confidence: Math.max(Number(verification.confidence || 0), 0.9),
    visibility: 'mentor_admin',
    sensitivity: sourceAsset?.sensitivity || payload.sensitivity || 'standard',
    review_status: 'verified',
    source_refs: buildRosterBridgeSourceRefs(verification, sourceAsset),
    provenance: {
      source: 'MMC-506 production-safe roster verification lane',
      production_source_writes: false,
      canonical_student_identity: true,
      admin_approved: verification.adminApproved,
      auto_promoted: verification.autoPromote,
    },
    metadata: {
      ...(existingRefs[0]?.metadata || {}),
      student_id: studentId,
      student_name: studentName,
      canonical_student_identity: true,
      school: payload.school || payload.rosterSchool || existingRefs[0]?.metadata?.school || 'Roster school pending',
      specialty: payload.specialty || existingRefs[0]?.metadata?.specialty || 'MissionMed Coaching',
      status: payload.status || existingRefs[0]?.metadata?.status || 'Active',
      last_meeting: payload.lastMeeting || payload.last_meeting || existingRefs[0]?.metadata?.last_meeting || null,
      roster_verification: summarizeRosterVerificationForReview(verification),
      roster_verification_evidence: verification.evidence,
      mmc_runtime: 'MMC-506',
    },
    updated_by_principal_id: context.principal.id,
  };
  const subjectRef = existingRefs[0]
    ? await deps.updateMmcRow(context, 'identity_references', existingRefs[0].id, subjectPatch)
    : await deps.insertMmcRow(context, 'identity_references', {
      ...subjectPatch,
      created_by_principal_id: context.principal.id,
    });

  const existingAssignments = await deps.selectMmcRows(
    context,
    'mentor_assignments',
    `mentor_id=eq.${encodeURIComponent(mentor.id)}&subject_ref_id=eq.${encodeURIComponent(subjectRef.id)}&status=eq.active&revoked_at=is.null&deleted_at=is.null&select=*&limit=1`,
  );
  const assignmentPatch = {
    mentor_id: mentor.id,
    subject_ref_id: subjectRef.id,
    assignment_scope: 'coaching',
    status: 'active',
    granted_by_principal_id: context.principal.id,
    grant_reason: 'MMC-506 verified roster identity bridge',
    visibility: 'mentor_admin',
    sensitivity: sourceAsset?.sensitivity || payload.sensitivity || 'standard',
    review_status: 'verified',
    source_refs: buildRosterBridgeSourceRefs(verification, sourceAsset),
    provenance: {
      source: 'MMC-506 verified roster assignment',
      production_source_writes: false,
      canonical_student_identity: true,
    },
    metadata: {
      ...(existingAssignments[0]?.metadata || {}),
      student_id: studentId,
      student_name: studentName,
      canonical_student_identity: true,
      roster_verification: summarizeRosterVerificationForReview(verification),
      mmc_runtime: 'MMC-506',
    },
    updated_by_principal_id: context.principal.id,
  };
  const assignment = existingAssignments[0]
    ? await deps.updateMmcRow(context, 'mentor_assignments', existingAssignments[0].id, assignmentPatch)
    : await deps.insertMmcRow(context, 'mentor_assignments', {
      ...assignmentPatch,
      created_by_principal_id: context.principal.id,
    });

  return { mentor, subjectRef, assignment };
}

function buildRosterBridgeSourceRefs(verification, sourceAsset = null) {
  const refs = verification.evidence.map((item) => ({
    system: item.sourceSystem,
    anchor_type: item.anchorType,
    anchor_value: item.anchorValue,
    status: item.evidenceStatus,
    confidence: item.confidence,
    supporting_only: item.supportingOnly,
  }));
  if (sourceAsset) {
    refs.push({
      system: 'mmc.coaching_source_assets',
      source_asset_id: sourceAsset.id,
      source_system: sourceAsset.source_system,
      source_id: sourceAsset.source_id,
    });
  }
  return refs;
}

async function resolveAndPatchSourceAsset(context, deps, sourceAsset, options = {}) {
  const resolutionContext = await collectStudentResolutionContext(context, deps);
  const result = resolveStudentForSourceAsset(sourceAsset, resolutionContext);
  const patch = buildSourceAssetResolutionPatch(context, sourceAsset, result, options);
  const row = await deps.updateMmcRow(context, 'coaching_source_assets', sourceAsset.id, patch);
  return { row, result };
}

async function collectStudentResolutionContext(context, deps) {
  let mentor = null;
  try {
    mentor = await findCurrentMentor(context, deps);
  } catch {
    mentor = null;
  }
  const [
    identityReferences,
    mentorAssignments,
    coachingSessions,
    sourceAssets,
  ] = await Promise.all([
    deps.selectMmcRows(context, 'identity_references', 'deleted_at=is.null&select=*&limit=1000'),
    deps.selectMmcRows(context, 'mentor_assignments', 'deleted_at=is.null&select=*&limit=1000'),
    deps.selectMmcRows(context, 'coaching_sessions', 'deleted_at=is.null&select=*&limit=1000'),
    deps.selectMmcRows(context, 'coaching_source_assets', 'deleted_at=is.null&select=*&limit=1000'),
  ]);
  return {
    principal: context.principal,
    mentor,
    identityReferences,
    mentorAssignments: mentor
      ? mentorAssignments.filter((assignment) => assignment.mentor_id === mentor.id)
      : mentorAssignments,
    coachingSessions,
    sourceAssets,
  };
}

function buildSourceAssetResolutionPatch(context, sourceAsset, result, options = {}) {
  const meetingStatus = dbStatusFromResolutionStatus(result.meeting?.status || result.status);
  const subjectStatus = dbStatusFromResolutionStatus(result.student?.status || result.status);
  const existingAssetStatus = String(sourceAsset.asset_status || 'candidate');
  const assetStatusLocked = ['analyzed', 'attached', 'rejected', 'archived'].includes(existingAssetStatus);
  const analysisReady = ['verified', 'probable'].includes(meetingStatus) && ['verified', 'probable'].includes(subjectStatus);
  const assetStatus = assetStatusLocked
    ? existingAssetStatus
    : analysisReady
      ? 'analysis_ready'
      : 'candidate';
  const reviewStatus = result.autoAttach
    ? 'verified'
    : sourceAsset.review_status === 'rejected'
      ? 'rejected'
      : 'unreviewed';

  return {
    asset_status: assetStatus,
    meeting_match_status: meetingStatus,
    meeting_match_confidence: Number(result.meeting?.confidence || 0),
    subject_match_status: subjectStatus,
    subject_match_confidence: Number(result.student?.confidence || 0),
    review_status: reviewStatus,
    metadata: {
      ...(sourceAsset.metadata || {}),
      student_resolution: result,
      student_resolution_review: formatResolutionForReview(result),
      student_resolution_updated_at: new Date().toISOString(),
      student_resolution_reason: options.reason || 'student_resolution',
      student_resolution_runtime: 'MMC-504',
    },
    updated_by_principal_id: context.principal.id,
  };
}

function sourceAssetRequiresResolutionReview(row = {}) {
  const resolutionStatus = String(row.metadata?.student_resolution?.overall?.status || row.metadata?.student_resolution?.status || '').toUpperCase();
  const meetingStatus = String(row.meeting_match_status || '').toLowerCase();
  const subjectStatus = String(row.subject_match_status || '').toLowerCase();
  if (row.review_status === 'rejected') return false;
  if (row.review_status === 'verified' && resolutionStatus === STUDENT_RESOLUTION_STATUS.VERIFIED) return false;
  return row.review_status === 'unreviewed'
    || ['manual_review', 'unverified', 'conflict'].includes(meetingStatus)
    || ['manual_review', 'unverified', 'conflict'].includes(subjectStatus)
    || ['MANUAL_REVIEW', 'CONFLICT', 'UNVERIFIED'].includes(resolutionStatus);
}

async function importSourceAssets(context, deps, payload) {
  const category = String(payload.category || 'Live Session').trim();
  const limit = clampInteger(payload.limit, 25, 1, 200);
  const entries = readVideoRegistryEntries()
    .map(normalizeRegistryEntry)
    .filter(Boolean)
    .filter((entry) => !category || entry.category === category)
    .slice(0, limit);

  const imported = [];
  const skipped = [];
  for (const entry of entries) {
    const existing = await deps.selectMmcRows(
      context,
      'coaching_source_assets',
      `source_system=eq.${encodeURIComponent(entry.source_system)}&source_id=eq.${encodeURIComponent(entry.source_id)}&deleted_at=is.null&select=*&limit=1`,
    );
    if (existing[0]) {
      skipped.push({ source_system: entry.source_system, source_id: entry.source_id, reason: 'already_exists' });
      continue;
    }
    const row = await deps.insertMmcRow(context, 'coaching_source_assets', {
      source_system: entry.source_system,
      source_id: entry.source_id,
      asset_title: entry.asset_title,
      asset_date: entry.asset_date,
      media_url: entry.media_url || null,
      thumbnail_url: entry.thumbnail_url || null,
      transcript_pointer: entry.transcript_pointer || null,
      transcript_hash: entry.transcript_hash || null,
      asset_status: 'candidate',
      meeting_match_status: 'manual_review',
      subject_match_status: 'manual_review',
      meeting_match_confidence: 0,
      subject_match_confidence: 0,
      visibility: 'mentor_admin',
      sensitivity: 'sensitive',
      review_status: 'unreviewed',
      source_refs: [{
        system: entry.source_system,
        source_id: entry.source_id,
        registry_path: resolveVideoRegistryPath(),
      }],
      provenance: {
        source: 'MMC-400 read-only VIDEO_SYSTEM registry import',
        copied_media: false,
        copied_transcript: false,
        touched_video_system: false,
      },
      metadata: {
        category: entry.category,
        event_type: entry.event_type,
        division: entry.division,
        original: entry.original,
      },
      created_by_principal_id: context.principal.id,
    });
    imported.push(row);
  }

  await insertPipelineAudit(context, deps, 'mmc400_source_assets_import', {
    imported: imported.length,
    skipped: skipped.length,
    category,
    limit,
  });

  return {
    ok: true,
    status: 'VERIFIED',
    imported,
    skipped,
    protections: {
      videoSystemReadOnly: true,
      registryWritten: false,
      r2Touched: false,
      streamTouched: false,
    },
  };
}

async function createPromptDraft(context, deps, payload) {
  const promptKey = normalizePromptKey(payload.promptKey || payload.prompt_key || DEFAULT_PROMPT_KEY);
  const promptBody = String(payload.promptBody || payload.prompt_body || '').trim();
  if (!promptBody) {
    throw badRequest('prompt_body_required', 'promptBody is required.');
  }
  const existing = await deps.selectMmcRows(
    context,
    'ai_prompt_versions',
    `prompt_key=eq.${encodeURIComponent(promptKey)}&deleted_at=is.null&select=prompt_version&order=prompt_version.desc&limit=1`,
  );
  const nextVersion = Number(payload.promptVersion || payload.prompt_version || (Number(existing[0]?.prompt_version || 0) + 1));
  const row = await deps.insertMmcRow(context, 'ai_prompt_versions', {
    prompt_key: promptKey,
    prompt_version: nextVersion,
    prompt_title: String(payload.promptTitle || payload.prompt_title || 'Meeting Analysis Prompt').trim(),
    prompt_body: promptBody,
    output_schema_json: normalizeOutputSchema(payload.outputSchema || payload.output_schema_json),
    status: 'draft',
    provider: String(payload.provider || 'openai').trim() || 'openai',
    model_name: String(payload.modelName || payload.model_name || '').trim() || null,
    visibility: 'mentor_admin',
    sensitivity: 'sensitive',
    review_status: 'unreviewed',
    provenance: {
      source: 'MMC-400 prompt management',
      railway_contains_prompt_text: false,
    },
    metadata: {
      created_via: 'mmc-coaching-pipeline',
    },
    created_by_principal_id: context.principal.id,
  });
  await insertPipelineAudit(context, deps, 'mmc400_prompt_draft_created', {
    prompt_key: promptKey,
    prompt_version: nextVersion,
    prompt_id: row?.id || null,
  });
  return { ok: true, status: 'VERIFIED', data: row };
}

async function activatePromptVersion(context, deps, payload) {
  const target = await findPromptTarget(context, deps, payload);
  const activeRows = await deps.selectMmcRows(
    context,
    'ai_prompt_versions',
    `prompt_key=eq.${encodeURIComponent(target.prompt_key)}&status=eq.active&deleted_at=is.null&select=*&limit=20`,
  );
  for (const row of activeRows) {
    if (row.id === target.id) continue;
    await deps.updateMmcRow(context, 'ai_prompt_versions', row.id, {
      status: 'archived',
      archived_at: new Date().toISOString(),
      archived_by_principal_id: context.principal.id,
      updated_by_principal_id: context.principal.id,
      metadata: {
        ...(row.metadata || {}),
        archived_reason: 'superseded_by_prompt_activation',
        superseded_by_prompt_id: target.id,
      },
    });
  }
  const updated = await deps.updateMmcRow(context, 'ai_prompt_versions', target.id, {
    status: 'active',
    activated_at: new Date().toISOString(),
    activated_by_principal_id: context.principal.id,
    activation_notes: String(payload.activationNotes || payload.activation_notes || '').trim() || null,
    review_status: 'verified',
    updated_by_principal_id: context.principal.id,
  });
  await insertPipelineAudit(context, deps, 'mmc400_prompt_activated', {
    prompt_key: target.prompt_key,
    prompt_version: target.prompt_version,
    prompt_id: target.id,
    archived_previous_count: activeRows.filter((row) => row.id !== target.id).length,
  });
  return { ok: true, status: 'VERIFIED', data: updated };
}

async function rollbackPromptVersion(context, deps, payload) {
  const target = await findPromptTarget(context, deps, payload);
  const activeRows = await deps.selectMmcRows(
    context,
    'ai_prompt_versions',
    `prompt_key=eq.${encodeURIComponent(target.prompt_key)}&status=eq.active&deleted_at=is.null&select=*&limit=20`,
  );
  for (const row of activeRows) {
    if (row.id === target.id) continue;
    await deps.updateMmcRow(context, 'ai_prompt_versions', row.id, {
      status: 'archived',
      archived_at: new Date().toISOString(),
      archived_by_principal_id: context.principal.id,
      updated_by_principal_id: context.principal.id,
      metadata: {
        ...(row.metadata || {}),
        archived_reason: 'prompt_rollback',
      },
    });
  }
  const updated = await deps.updateMmcRow(context, 'ai_prompt_versions', target.id, {
    status: 'active',
    activated_at: new Date().toISOString(),
    activated_by_principal_id: context.principal.id,
    rolled_back_from_prompt_id: activeRows.find((row) => row.id !== target.id)?.id || null,
    activation_notes: String(payload.rollbackReason || payload.rollback_reason || 'Prompt rollback').trim(),
    review_status: 'verified',
    updated_by_principal_id: context.principal.id,
  });
  await insertPipelineAudit(context, deps, 'mmc400_prompt_rollback', {
    prompt_key: target.prompt_key,
    prompt_version: target.prompt_version,
    prompt_id: target.id,
  });
  return { ok: true, status: 'VERIFIED', data: updated };
}

function testPromptPayload(payload) {
  const promptBody = String(payload.promptBody || payload.prompt_body || '').trim();
  const outputSchema = normalizeOutputSchema(payload.outputSchema || payload.output_schema_json);
  return {
    ok: true,
    status: promptBody ? 'VERIFIED' : 'UNVERIFIED',
    mode: 'prompt-contract-test',
    valid: Boolean(promptBody),
    message: promptBody
      ? 'Prompt contract is syntactically ready for an analysis run.'
      : 'Prompt body is empty.',
    outputSchema,
    sampleStructuredOutput: buildEmptyStructuredAnalysis({
      source_system: 'prompt_test',
      source_id: 'prompt-test',
      asset_title: 'Prompt contract test',
    }, null),
    providerCalled: false,
  };
}

async function createAnalysisRun(context, deps, payload) {
  const sourceAsset = await findRowById(context, deps, 'coaching_source_assets', payload.sourceAssetId || payload.source_asset_id);
  const subjectRefId = requireUuidish(payload.subjectRefId || payload.subject_ref_id, 'subject_ref_id');
  const assignmentId = requireUuidish(payload.assignmentId || payload.assignment_id, 'assignment_id');
  const sessionId = optionalUuidish(payload.sessionId || payload.session_id);
  const sessionLocalId = sanitizeLocalId(payload.sessionLocalId || payload.session_local_id || '');
  const localStudentId = sanitizeLocalId(payload.studentId || payload.student_id || '');
  const resolution = payload.resolution && typeof payload.resolution === 'object' ? payload.resolution : null;
  const mentor = await findCurrentMentor(context, deps);
  const assignment = await findAssignment(context, deps, assignmentId, subjectRefId, mentor.id);
  const prompt = payload.promptVersionId || payload.prompt_version_id
    ? await findRowById(context, deps, 'ai_prompt_versions', payload.promptVersionId || payload.prompt_version_id)
    : await findActivePrompt(context, deps, DEFAULT_PROMPT_KEY);

  const row = await deps.insertMmcRow(context, 'coaching_analysis_runs', {
    source_asset_id: sourceAsset.id,
    mentor_id: assignment.mentor_id,
    assignment_id: assignment.id,
    subject_ref_id: assignment.subject_ref_id,
    session_id: sessionId,
    prompt_version_id: prompt?.id || null,
    provider: prompt?.provider || 'mock',
    model_name: prompt?.model_name || null,
    run_status: 'review_required',
    confidence: 0,
    structured_output: {},
    evidence_refs: [{
      type: 'source_asset',
      source_asset_id: sourceAsset.id,
      source_system: sourceAsset.source_system,
      source_id: sourceAsset.source_id,
    }],
    visibility: 'mentor_admin',
    sensitivity: sourceAsset.sensitivity || 'sensitive',
    review_status: 'unreviewed',
    source_refs: [{
      system: 'mmc400',
      source_asset_id: sourceAsset.id,
      source_system: sourceAsset.source_system,
      source_id: sourceAsset.source_id,
    }],
    provenance: {
      source: payload.manualReviewApproved ? 'MMC-504 reviewed student resolution' : 'MMC-400 manual attachment',
      meeting_identity: resolution?.meeting?.status || 'manual_attachment_required',
      student_identity: resolution?.student?.status || 'assignment_subject_ref_required',
      student_resolution_auto_attach: Boolean(resolution?.autoAttach),
      student_resolution_manual_review: Boolean(payload.manualReviewApproved),
    },
    metadata: {
      source_asset_title: sourceAsset.asset_title,
      prompt_key: prompt?.prompt_key || null,
      prompt_version: prompt?.prompt_version || null,
      session_local_id: sessionLocalId || null,
      student_id: localStudentId || null,
      student_resolution_status: resolution?.status || null,
      student_resolution_confidence: resolution?.confidence || null,
      student_resolution_runtime: resolution?.version || null,
    },
    created_by_principal_id: context.principal.id,
  });
  await deps.updateMmcRow(context, 'coaching_source_assets', sourceAsset.id, {
    asset_status: 'attached',
    updated_by_principal_id: context.principal.id,
  });
  await insertPipelineAudit(context, deps, 'mmc400_analysis_run_created', {
    analysis_run_id: row?.id || null,
    source_asset_id: sourceAsset.id,
    assignment_id: assignment.id,
    subject_ref_id: assignment.subject_ref_id,
  });
  return { ok: true, status: 'VERIFIED', data: row };
}

async function attachSourceAssetForStudent(context, deps, payload) {
  const sourceAsset = await findRowById(context, deps, 'coaching_source_assets', payload.sourceAssetId || payload.source_asset_id);
  const reference = await resolveLocalStudentReference(context, deps, payload);
  const session = await ensurePipelineSession(context, deps, reference, sourceAsset, payload);
  const run = await createAnalysisRun(context, deps, {
    sourceAssetId: sourceAsset.id,
    subjectRefId: reference.subjectRef.id,
    assignmentId: reference.assignment.id,
    sessionId: session.id,
    sessionLocalId: session.localId,
    studentId: reference.studentId,
    promptVersionId: payload.promptVersionId || payload.prompt_version_id || null,
  });

  await insertPipelineAudit(context, deps, 'mmc402_source_asset_attached_from_private_ui', {
    analysis_run_id: run?.data?.id || null,
    source_asset_id: sourceAsset.id,
    student_id: reference.studentId,
    session_id: session.id,
    session_local_id: session.localId,
  });

  return {
    ok: true,
    status: 'VERIFIED',
    data: {
      analysisRun: run.data,
      sourceAsset,
      session,
      subject: {
        studentId: reference.studentId,
        subjectRefId: reference.subjectRef.id,
        assignmentId: reference.assignment.id,
      },
    },
  };
}

async function runMockAnalysis(context, deps, payload) {
  const run = await findRowById(context, deps, 'coaching_analysis_runs', payload.analysisRunId || payload.analysis_run_id);
  const sourceAsset = await findRowById(context, deps, 'coaching_source_assets', run.source_asset_id);
  const prompt = run.prompt_version_id
    ? await findRowById(context, deps, 'ai_prompt_versions', run.prompt_version_id)
    : null;
  const now = new Date().toISOString();
  const structured = buildEmptyStructuredAnalysis(sourceAsset, prompt);

  await deps.updateMmcRow(context, 'coaching_analysis_runs', run.id, {
    run_status: 'succeeded',
    provider: 'mock',
    model_name: 'mmc400-contract-validator',
    confidence: structured.confidence,
    structured_output: structured,
    attempt_count: Number(run.attempt_count || 0) + 1,
    started_at: run.started_at || now,
    completed_at: now,
    review_status: 'reviewed',
    updated_by_principal_id: context.principal.id,
  });

  const persisted = await persistStructuredOutput(context, deps, run, sourceAsset, structured);
  await deps.updateMmcRow(context, 'coaching_source_assets', sourceAsset.id, {
    asset_status: 'analyzed',
    updated_by_principal_id: context.principal.id,
  });
  await insertPipelineAudit(context, deps, 'mmc400_mock_analysis_completed', {
    analysis_run_id: run.id,
    source_asset_id: sourceAsset.id,
    persisted,
    provider_called: false,
  });
  return {
    ok: true,
    status: 'VERIFIED',
    mode: 'mock-analysis-validation',
    providerCalled: false,
    structuredOutput: structured,
    persisted,
  };
}

async function runAiAnalysis(context, deps, payload) {
  const run = await findRowById(context, deps, 'coaching_analysis_runs', payload.analysisRunId || payload.analysis_run_id);
  const sourceAsset = await findRowById(context, deps, 'coaching_source_assets', run.source_asset_id);
  const prompt = run.prompt_version_id
    ? await findRowById(context, deps, 'ai_prompt_versions', run.prompt_version_id)
    : await findActivePrompt(context, deps, DEFAULT_PROMPT_KEY);
  const providerConfig = getAiProviderConfig(prompt);
  if (!providerConfig.enabled) {
    throw serviceUnavailable(
      'mmc_ai_provider_not_configured',
      'OpenAI analysis requires an approved OpenAI API key and an enabled OpenAI provider configuration.',
    );
  }
  if (providerConfig.provider !== 'openai') {
    throw serviceUnavailable(
      'mmc_ai_provider_unsupported',
      'MMC-403 supports OpenAI as the only live analysis provider.',
    );
  }

  const transcript = loadTranscriptText(sourceAsset.transcript_pointer);
  if (!transcript.text) {
    throw badRequest(
      'transcript_required',
      'A readable transcript pointer is required before MMC can run real AI meeting analysis.',
    );
  }

  const startedAt = new Date().toISOString();
  await deps.updateMmcRow(context, 'coaching_analysis_runs', run.id, {
    run_status: 'running',
    provider: 'openai',
    model_name: providerConfig.model,
    attempt_count: Number(run.attempt_count || 0) + 1,
    started_at: run.started_at || startedAt,
    updated_by_principal_id: context.principal.id,
    metadata: {
      ...(run.metadata || {}),
      transcript_source: transcript.source,
      transcript_chars: transcript.originalLength,
      transcript_truncated: transcript.truncated,
      real_analysis_runtime: 'MMC-403',
    },
  });

  try {
    const structured = await callOpenAiStructuredAnalysis({
      providerConfig,
      prompt,
      transcriptText: transcript.text,
    });
    assertStructuredAnalysis(structured);
    const now = new Date().toISOString();
    const updatedRun = await deps.updateMmcRow(context, 'coaching_analysis_runs', run.id, {
      run_status: 'succeeded',
      provider: 'openai',
      model_name: providerConfig.model,
      confidence: structured.confidence,
      structured_output: structured,
      completed_at: now,
      review_status: 'unreviewed',
      error_message: null,
      updated_by_principal_id: context.principal.id,
      metadata: {
        ...(run.metadata || {}),
        transcript_source: transcript.source,
        transcript_chars: transcript.originalLength,
        transcript_truncated: transcript.truncated,
        prompt_key: prompt?.prompt_key || DEFAULT_PROMPT_KEY,
        prompt_version: prompt?.prompt_version || null,
        real_analysis_runtime: 'MMC-403',
      },
    });
    const persisted = await persistStructuredOutput(context, deps, updatedRun || run, sourceAsset, structured, {
      providerCalled: true,
      reviewStatus: 'unreviewed',
    });
    await deps.updateMmcRow(context, 'coaching_source_assets', sourceAsset.id, {
      asset_status: 'analyzed',
      updated_by_principal_id: context.principal.id,
      metadata: {
        ...(sourceAsset.metadata || {}),
        last_real_analysis_at: now,
        last_analysis_run_id: run.id,
        real_analysis_runtime: 'MMC-403',
      },
    });
    await insertPipelineAudit(context, deps, 'mmc403_real_analysis_completed', {
      analysis_run_id: run.id,
      source_asset_id: sourceAsset.id,
      provider: 'openai',
      model: providerConfig.model,
      prompt_id: prompt?.id || null,
      prompt_version: prompt?.prompt_version || null,
      output_schema_validated: true,
      transcript_source: transcript.source,
      transcript_chars: transcript.originalLength,
      transcript_truncated: transcript.truncated,
      persisted,
    });
    return {
      ok: true,
      status: 'VERIFIED',
      mode: 'real-ai-analysis',
      providerCalled: true,
      provider: 'openai',
      model: providerConfig.model,
      structuredOutput: structured,
      persisted,
      transcript: {
        source: transcript.source,
        chars: transcript.originalLength,
        truncated: transcript.truncated,
      },
    };
  } catch (error) {
    await deps.updateMmcRow(context, 'coaching_analysis_runs', run.id, {
      run_status: 'failed',
      error_message: error instanceof Error ? error.message.slice(0, 1000) : 'OpenAI analysis failed.',
      updated_by_principal_id: context.principal.id,
      metadata: {
        ...(run.metadata || {}),
        real_analysis_runtime: 'MMC-403',
        failed_provider: 'openai',
      },
    });
    await insertPipelineAudit(context, deps, 'mmc403_real_analysis_failed', {
      analysis_run_id: run.id,
      source_asset_id: sourceAsset.id,
      provider: 'openai',
      model: providerConfig.model,
      error_code: error?.code || 'openai_analysis_failed',
    });
    throw error;
  }
}

async function persistStructuredOutput(context, deps, run, sourceAsset, structured, options = {}) {
  const localStudentId = sanitizeLocalId(run.metadata?.student_id || '') || run.subject_ref_id;
  const common = {
    mentor_id: run.mentor_id,
    assignment_id: run.assignment_id,
    subject_ref_id: run.subject_ref_id,
    session_id: run.session_id || null,
    visibility: 'mentor_admin',
    sensitivity: 'sensitive',
    review_status: options.reviewStatus || 'reviewed',
    source_refs: [{
      system: 'mmc400_analysis',
      analysis_run_id: run.id,
      source_asset_id: sourceAsset.id,
      source_system: sourceAsset.source_system,
      source_id: sourceAsset.source_id,
    }],
    provenance: {
      source: 'MMC-400 coaching intelligence pipeline',
      provider_called: Boolean(options.providerCalled),
      raw_transcript_copied: false,
    },
    created_by_principal_id: context.principal.id,
  };
  const persisted = {
    sessionArtifacts: 0,
    intelligenceSnapshots: 0,
    actionItems: 0,
    mentorMemory: 0,
    openLoops: 0,
  };

  await deps.insertMmcRow(context, 'session_artifacts', {
    ...common,
    artifact_type: 'recording_reference',
    title: `Recording reference: ${sourceAsset.asset_title}`,
    content_body: null,
    content_pointer: sourceAsset.media_url || null,
    metadata: {
      student_id: localStudentId,
      session_local_id: run.metadata?.session_local_id || null,
      localSessionId: run.metadata?.session_local_id || null,
      analysis_run_id: run.id,
      source_asset_id: sourceAsset.id,
      source_asset_title: sourceAsset.asset_title,
      local_domain: 'pipeline_recording_reference',
    },
  });
  persisted.sessionArtifacts += 1;

  if (sourceAsset.transcript_pointer) {
    await deps.insertMmcRow(context, 'session_artifacts', {
      ...common,
      artifact_type: 'transcript_reference',
      title: `Transcript reference: ${sourceAsset.asset_title}`,
      content_body: null,
      content_pointer: sourceAsset.transcript_pointer,
      metadata: {
        student_id: localStudentId,
        session_local_id: run.metadata?.session_local_id || null,
        localSessionId: run.metadata?.session_local_id || null,
        analysis_run_id: run.id,
        source_asset_id: sourceAsset.id,
        source_asset_title: sourceAsset.asset_title,
        transcript_hash: sourceAsset.transcript_hash || null,
        local_domain: 'pipeline_transcript_reference',
      },
    });
    persisted.sessionArtifacts += 1;
  }

  await deps.insertMmcRow(context, 'session_artifacts', {
    ...common,
    artifact_type: 'ai_meeting_summary',
    title: `Meeting analysis summary: ${sourceAsset.asset_title}`,
    content_body: structured.summary,
    metadata: {
      student_id: localStudentId,
      session_local_id: run.metadata?.session_local_id || null,
      localSessionId: run.metadata?.session_local_id || null,
      analysis_run_id: run.id,
      source_asset_id: sourceAsset.id,
      source_asset_title: sourceAsset.asset_title,
      local_domain: 'pipeline_ai_summary',
    },
  });
  persisted.sessionArtifacts += 1;

  await deps.insertMmcRow(context, 'intelligence_snapshots', {
    mentor_id: run.mentor_id,
    assignment_id: run.assignment_id,
    subject_ref_id: run.subject_ref_id,
    snapshot_type: 'meeting_intelligence',
    summary_json: structured,
    confidence: structured.confidence,
    evidence_refs: structured.evidence,
    generated_at: new Date().toISOString(),
    visibility: 'mentor_admin',
    sensitivity: 'sensitive',
    review_status: 'reviewed',
    source_refs: common.source_refs,
    provenance: common.provenance,
    metadata: {
      student_id: localStudentId,
      session_local_id: run.metadata?.session_local_id || null,
      localSessionId: run.metadata?.session_local_id || null,
      analysis_run_id: run.id,
      source_asset_id: sourceAsset.id,
      source_asset_title: sourceAsset.asset_title,
      local_domain: 'pipeline_meeting_intelligence',
    },
    created_by_principal_id: context.principal.id,
  });
  persisted.intelligenceSnapshots += 1;

  for (const item of Array.isArray(structured.action_items) ? structured.action_items : []) {
    if (!item?.title) continue;
    await deps.insertMmcRow(context, 'action_items', {
      mentor_id: run.mentor_id,
      assignment_id: run.assignment_id,
      subject_ref_id: run.subject_ref_id,
      owner_type: normalizeOwnerType(item.owner_type || item.owner || 'mentor'),
      action_type: 'task',
      title: String(item.title).trim(),
      details: String(item.details || '').trim() || null,
      related_session_id: run.session_id || null,
      visibility: 'mentor_admin',
      sensitivity: item.sensitive ? 'sensitive' : 'standard',
      review_status: 'unreviewed',
      source_refs: common.source_refs,
      provenance: common.provenance,
      metadata: {
        student_id: localStudentId,
        session_local_id: run.metadata?.session_local_id || null,
        localSessionId: run.metadata?.session_local_id || null,
        analysis_run_id: run.id,
        source_asset_id: sourceAsset.id,
        source_asset_title: sourceAsset.asset_title,
        extracted_by: 'mmc400',
      },
      created_by_principal_id: context.principal.id,
    });
    persisted.actionItems += 1;
  }

  for (const item of buildMentorMemoryItems(structured)) {
    await deps.insertMmcRow(context, 'mentor_memory', {
      mentor_id: run.mentor_id,
      assignment_id: run.assignment_id,
      subject_ref_id: run.subject_ref_id,
      memory_type: item.memory_type,
      memory_text: item.memory_text,
      confidence: item.confidence,
      evidence_refs: item.evidence_refs,
      last_confirmed_at: new Date().toISOString(),
      visibility: 'mentor_admin',
      sensitivity: item.sensitivity,
      review_status: options.reviewStatus || 'unreviewed',
      source_refs: common.source_refs,
      provenance: common.provenance,
      metadata: {
        student_id: localStudentId,
        session_local_id: run.metadata?.session_local_id || null,
        localSessionId: run.metadata?.session_local_id || null,
        analysis_run_id: run.id,
        source_asset_id: sourceAsset.id,
        source_asset_title: sourceAsset.asset_title,
        extracted_by: 'mmc403_real_ai',
        source_field: item.source_field,
      },
      created_by_principal_id: context.principal.id,
    });
    persisted.mentorMemory += 1;
  }

  for (const loop of buildOpenLoopItems(structured)) {
    await deps.insertMmcRow(context, 'open_loops', {
      mentor_id: run.mentor_id,
      assignment_id: run.assignment_id,
      subject_ref_id: run.subject_ref_id,
      loop_type: loop.loop_type,
      summary: loop.summary,
      severity: loop.severity,
      status: 'open',
      evidence_refs: loop.evidence_refs,
      visibility: 'mentor_admin',
      sensitivity: loop.sensitivity,
      review_status: options.reviewStatus || 'unreviewed',
      source_refs: common.source_refs,
      provenance: common.provenance,
      metadata: {
        student_id: localStudentId,
        session_local_id: run.metadata?.session_local_id || null,
        localSessionId: run.metadata?.session_local_id || null,
        analysis_run_id: run.id,
        source_asset_id: sourceAsset.id,
        source_asset_title: sourceAsset.asset_title,
        extracted_by: 'mmc403_real_ai',
        source_field: loop.source_field,
      },
      created_by_principal_id: context.principal.id,
    });
    persisted.openLoops += 1;
  }

  return persisted;
}

function buildEmptyStructuredAnalysis(sourceAsset, prompt) {
  const title = sourceAsset.asset_title || sourceAsset.title || 'Attached coaching asset';
  return {
    summary: `Analysis placeholder for "${title}". No AI provider was called; this run validates the MMC-400 persistence contract only.`,
    action_items: [],
    story_insights: [],
    mentor_note_draft: '',
    sensitive_topics: [],
    relationship_signals: [],
    timeline_events: [],
    risk: {
      level: 'unverified',
      reasons: [],
      confidence: 0,
    },
    readiness: {
      level: 'unverified',
      reasons: [],
      confidence: 0,
    },
    next_best_move: 'Review the attached recording/transcript reference and run a reviewed AI analysis before using this as coaching guidance.',
    confidence: 0,
    evidence: [{
      quote: '',
      location: sourceAsset.source_id || sourceAsset.id || 'unknown',
      relevance: `source_asset:${sourceAsset.source_system || 'unknown'} prompt:${prompt?.prompt_key || 'none'}:${prompt?.prompt_version || 'none'} ${title}`,
      confidence: 0,
    }],
  };
}

function buildMentorMemoryItems(structured) {
  const items = [];
  if (structured.mentor_note_draft) {
    items.push({
      memory_type: 'mentor_note_draft',
      memory_text: structured.mentor_note_draft,
      confidence: structured.confidence,
      evidence_refs: structured.evidence || [],
      sensitivity: 'sensitive',
      source_field: 'mentor_note_draft',
    });
  }
  for (const item of Array.isArray(structured.story_insights) ? structured.story_insights : []) {
    if (!item?.title && !item?.detail) continue;
    items.push({
      memory_type: 'story_insight',
      memory_text: [item.title, item.detail].filter(Boolean).join(': '),
      confidence: clampConfidence(item.confidence),
      evidence_refs: item.evidence || [],
      sensitivity: 'sensitive',
      source_field: 'story_insights',
    });
  }
  for (const item of Array.isArray(structured.relationship_signals) ? structured.relationship_signals : []) {
    if (!item?.signal && !item?.detail) continue;
    items.push({
      memory_type: 'relationship_signal',
      memory_text: [item.signal, item.detail].filter(Boolean).join(': '),
      confidence: clampConfidence(item.confidence),
      evidence_refs: item.evidence || [],
      sensitivity: 'sensitive',
      source_field: 'relationship_signals',
    });
  }
  for (const item of Array.isArray(structured.sensitive_topics) ? structured.sensitive_topics : []) {
    if (!item?.topic && !item?.detail) continue;
    items.push({
      memory_type: 'sensitive_topic',
      memory_text: [item.topic, item.detail].filter(Boolean).join(': '),
      confidence: clampConfidence(item.confidence),
      evidence_refs: item.evidence || [],
      sensitivity: 'highly_sensitive',
      source_field: 'sensitive_topics',
    });
  }
  return items.slice(0, 24);
}

function buildOpenLoopItems(structured) {
  const loops = [];
  for (const item of Array.isArray(structured.action_items) ? structured.action_items : []) {
    if (!item?.title) continue;
    loops.push({
      loop_type: 'action_item',
      summary: item.title,
      severity: item.sensitive ? 'high' : 'medium',
      sensitivity: item.sensitive ? 'sensitive' : 'standard',
      evidence_refs: item.evidence || [],
      source_field: 'action_items',
    });
  }
  if (structured.next_best_move) {
    loops.push({
      loop_type: 'next_best_move',
      summary: structured.next_best_move,
      severity: riskLevelToSeverity(structured.risk?.level),
      sensitivity: 'sensitive',
      evidence_refs: structured.evidence || [],
      source_field: 'next_best_move',
    });
  }
  return loops.slice(0, 12);
}

function getAiProviderConfig(prompt = null) {
  const provider = String(process.env.MMHQ_MMC_AI_PROVIDER || process.env.MMHQ_AI_PROVIDER || prompt?.provider || 'openai').trim().toLowerCase();
  const apiKey = String(
    process.env.MMHQ_MMC_OPENAI_API_KEY ||
    process.env.MMHQ_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    '',
  ).trim();
  const envEnabled = String(process.env.MMHQ_MMC_AI_ENABLED || '').trim().toLowerCase();
  const explicitlyDisabled = ['0', 'false', 'off', 'no'].includes(envEnabled);
  const model = String(
    prompt?.model_name ||
    process.env.MMHQ_MMC_AI_MODEL ||
    process.env.MMHQ_OPENAI_MODEL ||
    process.env.OPENAI_MODEL ||
    DEFAULT_OPENAI_MODEL,
  ).trim() || DEFAULT_OPENAI_MODEL;
  return {
    provider,
    model,
    apiKey,
    apiKeyPresent: Boolean(apiKey),
    configured: provider === 'openai' && Boolean(apiKey),
    enabled: provider === 'openai' && Boolean(apiKey) && !explicitlyDisabled,
    timeoutMs: clampInteger(process.env.MMHQ_MMC_AI_TIMEOUT_MS, DEFAULT_OPENAI_TIMEOUT_MS, 10_000, 180_000),
  };
}

async function callOpenAiStructuredAnalysis({ providerConfig, prompt, transcriptText }) {
  const promptBody = String(prompt?.prompt_body || readDefaultPromptBody() || '').trim();
  if (!promptBody) {
    throw conflict('prompt_body_missing', 'No active prompt body or repository default prompt is available for MMC meeting analysis.');
  }
  const outputSchema = normalizeOutputSchema(prompt?.output_schema_json || prompt?.outputSchema);
  const response = await fetchWithTimeout(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${providerConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: providerConfig.model,
      input: [
        {
          role: 'system',
          content: [
            promptBody,
            'Use only the transcript in the user message. Do not infer from title, filename, source id, prior knowledge, or external context.',
            'Return only the structured JSON object required by the supplied schema.',
          ].join('\n\n'),
        },
        {
          role: 'user',
          content: `TRANSCRIPT ONLY:\n${transcriptText}`,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'mmc_meeting_analysis',
          strict: true,
          schema: outputSchema,
        },
      },
    }),
    timeoutMs: providerConfig.timeoutMs,
  });

  if (!response.ok) {
    throw serviceUnavailable(
      'openai_structured_analysis_failed',
      `OpenAI structured analysis failed with status ${response.status}: ${extractRemoteError(response.data).slice(0, 260)}`,
    );
  }
  const refusal = extractOpenAiRefusal(response.data);
  if (refusal) {
    throw serviceUnavailable('openai_structured_analysis_refused', `OpenAI refused the structured analysis request: ${refusal.slice(0, 260)}`);
  }
  const text = extractOpenAiOutputText(response.data);
  if (!text) {
    throw serviceUnavailable('openai_structured_analysis_empty', 'OpenAI did not return structured output text.');
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw serviceUnavailable('openai_structured_analysis_invalid_json', 'OpenAI returned output that could not be parsed as JSON.');
  }
}

async function fetchWithTimeout(target, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_OPENAI_TIMEOUT_MS);
  try {
    const response = await fetch(target, {
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body,
      signal: controller.signal,
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return {
      ok: false,
      status: error?.name === 'AbortError' ? 408 : 502,
      data: { error: { message: error instanceof Error ? error.message : 'OpenAI request failed.' } },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractOpenAiOutputText(data) {
  if (typeof data?.output_text === 'string') {
    return data.output_text.trim();
  }
  const pieces = [];
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    if (typeof item?.content === 'string') {
      pieces.push(item.content);
    }
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === 'string') {
        pieces.push(content.text);
      } else if (typeof content?.output_text === 'string') {
        pieces.push(content.output_text);
      }
    }
  }
  const chatContent = data?.choices?.[0]?.message?.content;
  if (typeof chatContent === 'string') {
    pieces.push(chatContent);
  }
  return pieces.join('\n').trim();
}

function extractOpenAiRefusal(data) {
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.refusal === 'string' && content.refusal.trim()) {
        return content.refusal.trim();
      }
    }
  }
  const refusal = data?.choices?.[0]?.message?.refusal;
  return typeof refusal === 'string' && refusal.trim() ? refusal.trim() : '';
}

function extractRemoteError(data) {
  if (typeof data?.error?.message === 'string') return data.error.message;
  if (typeof data?.message === 'string') return data.message;
  if (typeof data?.raw === 'string') return data.raw;
  return 'remote_provider_error';
}

function loadTranscriptText(pointer) {
  const transcriptPath = resolveTranscriptPath(pointer);
  if (!transcriptPath) {
    return { text: '', source: '', originalLength: 0, truncated: false };
  }
  const raw = readFileSync(transcriptPath, 'utf8');
  const text = extractTranscriptText(raw);
  const maxChars = clampInteger(process.env.MMHQ_MMC_AI_TRANSCRIPT_MAX_CHARS, DEFAULT_TRANSCRIPT_MAX_CHARS, 8_000, 300_000);
  return {
    text: text.slice(0, maxChars),
    source: transcriptPath,
    originalLength: text.length,
    truncated: text.length > maxChars,
  };
}

function resolveTranscriptPath(pointer) {
  const raw = String(pointer || '').trim();
  if (!raw || /^https?:\/\//iu.test(raw)) {
    return '';
  }
  const allowedRoots = [
    '/Users/brianb/MissionMed/VIDEO_SYSTEM',
    '/Users/brianb/MissionMed',
    process.cwd(),
  ].map((root) => path.resolve(root));
  const candidates = [];
  if (path.isAbsolute(raw)) {
    candidates.push(path.resolve(raw));
  } else {
    for (const root of allowedRoots) {
      candidates.push(path.resolve(root, raw));
    }
  }
  for (const candidate of candidates) {
    if (!allowedRoots.some((root) => candidate === root || candidate.startsWith(`${root}${path.sep}`))) {
      continue;
    }
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return '';
}

function extractTranscriptText(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed.full_text === 'string' && parsed.full_text.trim()) return parsed.full_text.trim();
    if (typeof parsed.transcript === 'string' && parsed.transcript.trim()) return parsed.transcript.trim();
    if (Array.isArray(parsed.segments)) {
      return parsed.segments
        .map((segment) => [formatTranscriptTime(segment.start_time), segment.speaker || '', segment.text || ''].filter(Boolean).join(' '))
        .filter(Boolean)
        .join('\n')
        .trim();
    }
    if (Array.isArray(parsed.transcript_chunks)) {
      return parsed.transcript_chunks.map((chunk) => chunk.text || chunk.content || '').filter(Boolean).join('\n').trim();
    }
  } catch {
    // Non-JSON transcript formats such as VTT/TXT are allowed as transcript text.
  }
  return trimmed;
}

function formatTranscriptTime(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return '';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `[${minutes}:${String(remainder).padStart(2, '0')}]`;
}

function assertStructuredAnalysis(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest('structured_output_invalid', 'AI output must be a JSON object.');
  }
  const requiredKeys = DEFAULT_OUTPUT_SCHEMA.required;
  for (const key of requiredKeys) {
    if (!Object.hasOwn(value, key)) {
      throw badRequest('structured_output_missing_key', `AI output is missing required key: ${key}`);
    }
  }
  assertString(value.summary, 'summary');
  assertString(value.mentor_note_draft, 'mentor_note_draft');
  assertString(value.next_best_move, 'next_best_move');
  assertNumber01(value.confidence, 'confidence');
  assertArray(value.action_items, 'action_items').forEach((item, index) => assertActionItem(item, `action_items[${index}]`));
  assertArray(value.story_insights, 'story_insights').forEach((item, index) => assertAnalysisItem(item, `story_insights[${index}]`));
  assertArray(value.sensitive_topics, 'sensitive_topics').forEach((item, index) => assertSensitiveTopic(item, `sensitive_topics[${index}]`));
  assertArray(value.relationship_signals, 'relationship_signals').forEach((item, index) => assertRelationshipSignal(item, `relationship_signals[${index}]`));
  assertArray(value.timeline_events, 'timeline_events').forEach((item, index) => assertTimelineEvent(item, `timeline_events[${index}]`));
  assertRiskReadiness(value.risk, 'risk');
  assertRiskReadiness(value.readiness, 'readiness');
  assertArray(value.evidence, 'evidence').forEach((item, index) => assertEvidence(item, `evidence[${index}]`));
  return true;
}

function assertActionItem(item, label) {
  assertPlainObject(item, label);
  assertString(item.title, `${label}.title`);
  assertString(item.details, `${label}.details`);
  assertString(item.owner_type, `${label}.owner_type`);
  if (!['mentor', 'student', 'shared', 'system'].includes(item.owner_type)) {
    throw badRequest('structured_output_invalid_owner', `${label}.owner_type is invalid.`);
  }
  assertString(item.due_signal, `${label}.due_signal`);
  if (typeof item.sensitive !== 'boolean') {
    throw badRequest('structured_output_invalid_boolean', `${label}.sensitive must be boolean.`);
  }
  assertNumber01(item.confidence, `${label}.confidence`);
  assertArray(item.evidence, `${label}.evidence`).forEach((entry, index) => assertEvidence(entry, `${label}.evidence[${index}]`));
}

function assertAnalysisItem(item, label) {
  assertPlainObject(item, label);
  assertString(item.title, `${label}.title`);
  assertString(item.detail, `${label}.detail`);
  assertNumber01(item.confidence, `${label}.confidence`);
  assertArray(item.evidence, `${label}.evidence`).forEach((entry, index) => assertEvidence(entry, `${label}.evidence[${index}]`));
}

function assertSensitiveTopic(item, label) {
  assertPlainObject(item, label);
  assertString(item.topic, `${label}.topic`);
  assertString(item.detail, `${label}.detail`);
  if (typeof item.mentor_only !== 'boolean') {
    throw badRequest('structured_output_invalid_boolean', `${label}.mentor_only must be boolean.`);
  }
  assertNumber01(item.confidence, `${label}.confidence`);
  assertArray(item.evidence, `${label}.evidence`).forEach((entry, index) => assertEvidence(entry, `${label}.evidence[${index}]`));
}

function assertRelationshipSignal(item, label) {
  assertPlainObject(item, label);
  assertString(item.signal, `${label}.signal`);
  assertString(item.detail, `${label}.detail`);
  assertString(item.trend, `${label}.trend`);
  assertNumber01(item.confidence, `${label}.confidence`);
  assertArray(item.evidence, `${label}.evidence`).forEach((entry, index) => assertEvidence(entry, `${label}.evidence[${index}]`));
}

function assertTimelineEvent(item, label) {
  assertPlainObject(item, label);
  assertString(item.event, `${label}.event`);
  assertString(item.when, `${label}.when`);
  assertString(item.detail, `${label}.detail`);
  assertArray(item.evidence, `${label}.evidence`).forEach((entry, index) => assertEvidence(entry, `${label}.evidence[${index}]`));
}

function assertRiskReadiness(item, label) {
  assertPlainObject(item, label);
  assertString(item.level, `${label}.level`);
  assertArray(item.reasons, `${label}.reasons`).forEach((reason, index) => assertString(reason, `${label}.reasons[${index}]`));
  assertNumber01(item.confidence, `${label}.confidence`);
}

function assertEvidence(item, label) {
  assertPlainObject(item, label);
  assertString(item.quote, `${label}.quote`);
  assertString(item.location, `${label}.location`);
  assertString(item.relevance, `${label}.relevance`);
  assertNumber01(item.confidence, `${label}.confidence`);
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest('structured_output_invalid_object', `${label} must be an object.`);
  }
}

function assertString(value, label) {
  if (typeof value !== 'string') {
    throw badRequest('structured_output_invalid_string', `${label} must be a string.`);
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw badRequest('structured_output_invalid_array', `${label} must be an array.`);
  }
  return value;
}

function assertNumber01(value, label) {
  if (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 1) {
    throw badRequest('structured_output_invalid_confidence', `${label} must be a number between 0 and 1.`);
  }
}

function clampConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function riskLevelToSeverity(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.includes('critical')) return 'critical';
  if (normalized.includes('high')) return 'high';
  if (normalized.includes('low')) return 'low';
  return 'medium';
}

function readDefaultPromptBody() {
  const promptPath = path.resolve(process.cwd(), 'missionmed-hq/prompts/mmc-meeting-analysis-default.md');
  if (!existsSync(promptPath)) return '';
  return readFileSync(promptPath, 'utf8');
}

async function findPromptTarget(context, deps, payload) {
  if (payload.promptId || payload.prompt_id) {
    return findRowById(context, deps, 'ai_prompt_versions', payload.promptId || payload.prompt_id);
  }
  const promptKey = normalizePromptKey(payload.promptKey || payload.prompt_key || DEFAULT_PROMPT_KEY);
  const promptVersion = Number(payload.promptVersion || payload.prompt_version || 0);
  if (!promptVersion) {
    throw badRequest('prompt_version_required', 'promptVersion is required when promptId is not provided.');
  }
  const rows = await deps.selectMmcRows(
    context,
    'ai_prompt_versions',
    `prompt_key=eq.${encodeURIComponent(promptKey)}&prompt_version=eq.${encodeURIComponent(promptVersion)}&deleted_at=is.null&select=*&limit=1`,
  );
  if (!rows[0]) {
    throw notFound('prompt_not_found', 'Prompt version was not found.');
  }
  return rows[0];
}

async function findActivePrompt(context, deps, promptKey) {
  const rows = await deps.selectMmcRows(
    context,
    'ai_prompt_versions',
    `prompt_key=eq.${encodeURIComponent(promptKey)}&status=eq.active&deleted_at=is.null&select=*&limit=1`,
  );
  return rows[0] || null;
}

async function findRowById(context, deps, table, id) {
  const safeId = requireUuidish(id, `${table}_id`);
  const rows = await deps.selectMmcRows(
    context,
    table,
    `id=eq.${encodeURIComponent(safeId)}&deleted_at=is.null&select=*&limit=1`,
  );
  if (!rows[0]) {
    throw notFound(`${table}_not_found`, `${table} row was not found.`);
  }
  return rows[0];
}

async function findCurrentMentor(context, deps) {
  const rows = await deps.selectMmcRows(
    context,
    'mentors',
    `auth_subject_id=eq.${encodeURIComponent(context.principal.authSubjectId)}&status=eq.active&deleted_at=is.null&select=*&limit=1`,
  );
  if (!rows[0]) {
    throw conflict('mmc_mentor_not_seeded', 'MMC mentor principal is not seeded. Open/save MMC persistence once or seed the mentor in staging.');
  }
  return rows[0];
}

async function resolveLocalStudentReference(context, deps, payload) {
  const studentId = sanitizeLocalId(payload.studentId || payload.student_id || '');
  if (!studentId) {
    throw badRequest('student_id_required', 'studentId is required for MMC private UI attachment.');
  }
  const student = {
    name: String(payload.studentName || payload.student_name || studentId).trim(),
  };

  const verifiedRosterReference = await findVerifiedRosterStudentReference(context, deps, studentId);
  if (verifiedRosterReference) {
    return verifiedRosterReference;
  }

  if (deps.ensureMmcMentor && deps.ensureMmcSubjectRef && deps.ensureMmcAssignment) {
    const mentor = await deps.ensureMmcMentor(context);
    const subjectRef = await deps.ensureMmcSubjectRef(context, studentId, student);
    const assignment = await deps.ensureMmcAssignment(context, mentor, subjectRef, studentId);
    return { mentor, subjectRef, assignment, studentId };
  }

  const mentor = await findCurrentMentor(context, deps);
  const subjectRows = await deps.selectMmcRows(
    context,
    'identity_references',
    `primary_anchor_type=eq.mmc_fixture_student&primary_anchor_hash=eq.${encodeURIComponent(studentId)}&deleted_at=is.null&select=*&limit=1`,
  );
  if (!subjectRows[0]) {
    throw conflict('mmc_subject_not_seeded', `MMC subject reference is not seeded for ${studentId}.`);
  }
  const assignmentRows = await deps.selectMmcRows(
    context,
    'mentor_assignments',
    `mentor_id=eq.${encodeURIComponent(mentor.id)}&subject_ref_id=eq.${encodeURIComponent(subjectRows[0].id)}&status=eq.active&revoked_at=is.null&deleted_at=is.null&select=*&limit=1`,
  );
  if (!assignmentRows[0]) {
    throw forbidden('assignment_not_accessible', 'The selected MMC student assignment is not accessible to this principal.');
  }
  return { mentor, subjectRef: subjectRows[0], assignment: assignmentRows[0], studentId };
}

async function findVerifiedRosterStudentReference(context, deps, studentId) {
  const localId = rosterStudentIdFromName(studentId);
  if (!localId) return null;
  const mentor = await findCurrentMentor(context, deps);
  const subjectRows = await deps.selectMmcRows(
    context,
    'identity_references',
    `primary_anchor_type=eq.missionmed_roster_student&primary_anchor_hash=eq.${encodeURIComponent(`missionmed-roster:${localId}`)}&reference_status=eq.verified&deleted_at=is.null&select=*&limit=1`,
  );
  if (!subjectRows[0]) return null;
  const assignmentRows = await deps.selectMmcRows(
    context,
    'mentor_assignments',
    `mentor_id=eq.${encodeURIComponent(mentor.id)}&subject_ref_id=eq.${encodeURIComponent(subjectRows[0].id)}&status=eq.active&revoked_at=is.null&deleted_at=is.null&select=*&limit=1`,
  );
  if (!assignmentRows[0]) return null;
  return { mentor, subjectRef: subjectRows[0], assignment: assignmentRows[0], studentId: localId };
}

async function findAssignment(context, deps, assignmentId, subjectRefId, mentorId) {
  const rows = await deps.selectMmcRows(
    context,
    'mentor_assignments',
    `id=eq.${encodeURIComponent(assignmentId)}&subject_ref_id=eq.${encodeURIComponent(subjectRefId)}&mentor_id=eq.${encodeURIComponent(mentorId)}&status=eq.active&deleted_at=is.null&select=*&limit=1`,
  );
  if (!rows[0]) {
    throw forbidden('assignment_not_accessible', 'The selected assignment is not accessible to this MMC principal.');
  }
  return rows[0];
}

async function ensurePipelineSession(context, deps, reference, sourceAsset, payload = {}) {
  const providedSessionId = optionalUuidish(payload.sessionId || payload.session_id);
  const sourceHash = sha256(`${sourceAsset.source_system}|${sourceAsset.source_id || sourceAsset.id}`).slice(0, 12);
  const localId = sanitizeLocalId(payload.sessionLocalId || payload.session_local_id || `pipeline-${reference.studentId}-${sourceHash}`);
  const title = String(payload.sessionTitle || payload.session_title || sourceAsset.asset_title || 'Pipeline-attached coaching asset').trim();

  if (providedSessionId) {
    return { id: providedSessionId, localId, title, reused: true };
  }

  const existing = await deps.selectMmcRows(
    context,
    'coaching_sessions',
    `mentor_id=eq.${encodeURIComponent(reference.mentor.id)}&assignment_id=eq.${encodeURIComponent(reference.assignment.id)}&deleted_at=is.null&select=*&order=created_at.desc&limit=100`,
  );
  const match = existing.find((row) => String(row.metadata?.local_id || '') === localId);
  if (match) {
    return { id: match.id, localId, title: match.session_focus || title, reused: true };
  }

  const startedAt = sourceAsset.asset_date || new Date().toISOString();
  const row = await deps.insertMmcRow(context, 'coaching_sessions', {
    mentor_id: reference.mentor.id,
    assignment_id: reference.assignment.id,
    subject_ref_id: reference.subjectRef.id,
    session_status: 'completed',
    started_at: startedAt,
    ended_at: null,
    prep_summary: 'Pipeline attached source asset for mentor review.',
    session_focus: title,
    post_session_summary: 'Source asset attached through the MMC Coaching Intelligence Pipeline.',
    source_type: 'manual_mmc',
    visibility: 'mentor_admin',
    sensitivity: sourceAsset.sensitivity || 'sensitive',
    review_status: 'reviewed',
    source_refs: [{
      system: 'mmc402_private_ui',
      source_asset_id: sourceAsset.id,
      source_system: sourceAsset.source_system,
      source_id: sourceAsset.source_id,
    }],
    provenance: {
      source: 'MMC-402 private Pipeline Admin',
      copied_media: false,
      copied_transcript: false,
    },
    metadata: {
      local_id: localId,
      local_domain: 'pipeline_session',
      student_id: reference.studentId,
      source_asset_id: sourceAsset.id,
      source_asset_title: sourceAsset.asset_title,
      mmc_runtime: 'MMC-402',
    },
    created_by_principal_id: context.principal.id,
    updated_by_principal_id: context.principal.id,
  });

  return { id: row.id, localId, title: row.session_focus || title, reused: false };
}

async function insertPipelineAudit(context, deps, action, metadata = {}) {
  return deps.insertMmcRow(context, 'audit_events', {
    actor_principal_id: context.principal.id,
    actor_role: context.principal.role,
    action,
    object_schema: 'mmc',
    object_table: 'coaching_pipeline',
    reason: 'MMC-400 coaching intelligence pipeline',
    metadata: {
      ...metadata,
      runtime: 'MMC-400',
    },
  });
}

function readVideoRegistryEntries() {
  const registryPath = resolveVideoRegistryPath();
  if (!existsSync(registryPath)) {
    return [];
  }
  const parsed = JSON.parse(readFileSync(registryPath, 'utf8'));
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (Array.isArray(parsed?.items)) {
    return parsed.items;
  }
  if (Array.isArray(parsed?.videos)) {
    return parsed.videos;
  }
  return [];
}

function resolveVideoRegistryPath() {
  return String(process.env.MMHQ_MMC_VIDEO_REGISTRY_PATH || process.env.MMHQ_VIDEO_REGISTRY_PATH || DEFAULT_VIDEO_REGISTRY_PATH).trim();
}

function normalizeRegistryEntry(entry = {}) {
  const sourceId = String(entry.id || entry.video_id || entry.mmvc_id || '').trim();
  if (!sourceId) return null;
  const transcriptPointer = String(entry.transcript_path || entry.transcript_url || '').trim();
  return {
    source_system: 'video_system_registry',
    source_id: sourceId,
    asset_title: String(entry.title || sourceId).trim(),
    asset_date: normalizeAssetDate(entry.date || entry.created_at || entry.updated_at),
    media_url: String(entry.playback_url || entry.cloud_video_path || entry.video_url || '').trim(),
    thumbnail_url: String(entry.thumbnail_url || entry.preview_image || '').trim(),
    transcript_pointer: transcriptPointer,
    transcript_hash: transcriptPointer ? sha256(`${sourceId}|${transcriptPointer}`) : null,
    category: String(entry.category || '').trim(),
    event_type: String(entry.event_type || '').trim(),
    division: String(entry.division || '').trim(),
    original: {
      id: sourceId,
      category: entry.category || null,
      event_type: entry.event_type || null,
      division: entry.division || null,
      transcript_path: entry.transcript_path || null,
      cloud_video_path: entry.cloud_video_path || null,
      playback_url: entry.playback_url || null,
    },
  };
}

function normalizeAssetDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizePromptKey(value) {
  return String(value || DEFAULT_PROMPT_KEY).trim().toLowerCase().replace(/[^a-z0-9_.:-]+/gu, '_').slice(0, 120) || DEFAULT_PROMPT_KEY;
}

function normalizeOutputSchema(value) {
  if (isStrictAnalysisSchema(value)) {
    return value;
  }
  return DEFAULT_OUTPUT_SCHEMA;
}

function isStrictAnalysisSchema(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (value.type !== 'object' || value.additionalProperties !== false) return false;
  const required = Array.isArray(value.required) ? value.required : [];
  return DEFAULT_OUTPUT_SCHEMA.required.every((key) => required.includes(key));
}

function normalizeOwnerType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['mentor', 'student', 'shared', 'system'].includes(normalized)) {
    return normalized;
  }
  return 'mentor';
}

function sanitizeLocalId(value = '') {
  return String(value || '').trim().replace(/[^\w:.-]/gu, '-').slice(0, 120);
}

function titleFromLocalId(value = '') {
  return String(value || '')
    .trim()
    .replace(/[_:.-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ') || 'Reviewed Student';
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function requirePipelineAdmin(context) {
  if (context.principal.role !== 'admin') {
    throw forbidden('mmc_pipeline_admin_required', 'This MMC coaching pipeline operation requires an MMC admin/HQ operator.');
  }
}

function requireUuidish(value, label) {
  const raw = String(value || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(raw)) {
    throw badRequest('invalid_uuid', `${label} must be a UUID.`);
  }
  return raw;
}

function optionalUuidish(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return requireUuidish(raw, 'optional_uuid');
}

function badRequest(code, message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
}

function serviceUnavailable(code, message) {
  const error = new Error(message);
  error.statusCode = 503;
  error.code = code;
  return error;
}

function forbidden(code, message) {
  const error = new Error(message);
  error.statusCode = 403;
  error.code = code;
  return error;
}

function notFound(code, message) {
  const error = new Error(message);
  error.statusCode = 404;
  error.code = code;
  return error;
}

function conflict(code, message) {
  const error = new Error(message);
  error.statusCode = 409;
  error.code = code;
  return error;
}
