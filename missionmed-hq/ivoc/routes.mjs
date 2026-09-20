import { createReadStream, existsSync, statSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, extname, isAbsolute, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { admissionRegistry } from '../../ivprep-v6/server/admission-registry.mjs';
import { strictProjectHqSession, validateIvPrepMutation } from '../../ivprep-v6/server/admission-contract.mjs';
import { createContextIntelligenceProvider } from './context-provider.mjs';
import { createIvocApplicationIntelligence, readSessionContextReceipts } from './application-intelligence.mjs';
import { createIvocRepository } from './repository.mjs';
import { createIvocStorage } from './storage.mjs';
import {
  assertAnswerSegment,
  assertAnswerAssetOwner,
  assertCoachingEvidence,
  assertConversationTurn,
  assertSession,
  assertTimelineEvent,
  EMBODIMENT_SCHEMA,
  normalizeAnswerAssetWrite,
  publicEmbodimentConfig,
} from '../../ivoc/contracts/index.mjs';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const STATIC_ROOT = normalize(join(MODULE_DIR, '..', '..', 'ivprep-v6', 'public', 'ivoc-standalone'));
const ANALYTICS_ROOT = normalize(join(MODULE_DIR, '..', '..', 'ivprep-v6', 'public', 'analytics'));
const UI_PREFIX = '/iv-prep-analytics';
const ANALYTICS_PREFIX = '/iv-prep-on-call/analytics';
const API_PREFIX = '/api/ivoc/v1';
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_MEDIA_CHUNK_BYTES = 5 * 1024 * 1024;
const MAX_CONTEXT_AUDIO_BYTES = 25 * 1024 * 1024;
const MIME = Object.freeze({
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.woff2': 'font/woff2',
});

function bool(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return String(value).trim().toLowerCase() === 'true';
}

function safeText(value, max = 400) { return String(value || '').trim().slice(0, max); }
function optionalDurationMs(value) {
  return value != null && Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : null;
}
function rolesOf(session) { return Array.isArray(session?.user?.roles) ? session.user.roles.map((r) => String(r).toLowerCase()) : []; }
function isAdmin(session, admission) { return admission?.entitlement?.founder === true || rolesOf(session).some((r) => ['administrator', 'admin'].includes(r)); }
function isMentor(session) { return rolesOf(session).some((r) => ['mentor', 'coach', 'faculty', 'teacher'].includes(r)); }
function displayName(session) { return safeText(session?.user?.displayName || session?.user?.login || 'MissionMed student', 120); }
function boundedArray(value, label, maximum) {
  if (!Array.isArray(value) || value.length > maximum) {
    throw Object.assign(new TypeError(`${label}_invalid`), { status: 400 });
  }
  return value;
}

function contractTimestamp(value, label) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw Object.assign(new TypeError(`${label}_invalid`), { status: 400 });
  return new Date(parsed).toISOString();
}

function contractInteger(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw Object.assign(new TypeError(`${label}_invalid`), { status: 400 });
  }
  return value;
}

function securityHeaders(mediaBase, extra = {}) {
  let mediaOrigin = '';
  try { mediaOrigin = new URL(mediaBase).origin; } catch {}
  const connect = [`'self'`, mediaOrigin].filter(Boolean).join(' ');
  return {
    'Cache-Control': 'no-store',
    'Content-Security-Policy': `default-src 'self'; connect-src ${connect}; img-src 'self' data: blob:; media-src 'self' blob: ${mediaOrigin}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(self), microphone=(self)',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY', 'X-Robots-Tag': 'noindex, nofollow, noarchive',
    ...extra,
  };
}

function sendJson(response, status, payload, mediaBase) {
  response.writeHead(status, securityHeaders(mediaBase, { 'Content-Type': 'application/json; charset=utf-8' }));
  response.end(JSON.stringify(payload));
}

function sendError(response, status, code, mediaBase) { sendJson(response, status, { error: code }, mediaBase); }

async function readJson(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw Object.assign(new Error('request_too_large'), { status: 413 });
    chunks.push(chunk);
  }
  if (!bytes) return {};
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new Error('invalid_json'), { status: 400 });
  return value;
}

async function readMediaChunk(request) {
  const chunks = [];
  let bytes = 0;
  try {
    for await (const source of request) {
      const chunk = Buffer.isBuffer(source) ? source : Buffer.from(source);
      bytes += chunk.length;
      if (bytes > MAX_MEDIA_CHUNK_BYTES) throw Object.assign(new Error('recording_chunk_too_large'), { status: 413 });
      chunks.push(chunk);
    }
    if (!bytes) throw Object.assign(new Error('recording_chunk_empty'), { status: 400 });
    return Buffer.concat(chunks, bytes);
  } finally {
    for (const chunk of chunks) chunk.fill(0);
  }
}

function staticPath(pathname, root = STATIC_ROOT, prefix = UI_PREFIX) {
  let name = pathname === prefix || pathname === `${prefix}/`
    ? 'index.html' : pathname.slice(`${prefix}/`.length);
  try { name = decodeURIComponent(name); } catch { return null; }
  if (!name || name.includes('\0') || isAbsolute(name)) return null;
  const file = normalize(join(root, name));
  const rel = relative(root, file);
  if (rel.startsWith('..') || isAbsolute(rel) || !existsSync(file) || !statSync(file).isFile()) return null;
  return file;
}

function publicRecording(row) {
  if (!row) return null;
  return {
    id: row.id, sessionId: row.session_id, status: row.status, mime: row.mime_type,
    sizeBytes: row.size_bytes, durationMs: row.duration_ms, sealedAt: row.sealed_at,
    pausedSpans: Array.isArray(row.paused_spans) ? row.paused_spans : [],
    createdAt: row.created_at,
  };
}

function publicSession(row, recording = null, result = null, review = null, spine = null) {
  return {
    id: row.id, title: row.title, sessionType: row.session_type, questionId: row.question_id,
    questionText: row.question_text, state: row.state, startedAt: row.started_at,
    endedAt: row.ended_at, durationMs: row.duration_ms,
    ownerDisplayName: safeText(row.owner_display_name, 200) || null,
    interviewerProvider: row.interviewer_provider, recording: publicRecording(recording),
    results: result ? { schema: result.schema_name, schemaVersion: result.schema_version, payload: result.payload, summary: result.summary } : null,
    reviewStatus: review?.status || null,
    review: review ? { status: review.status || null, reviewedAt: review.reviewed_at || null } : null,
    spine,
  };
}

function publicQuestion(row) {
  return {
    questionId: row.question_id,
    status: row.status,
    version: row.current_version,
    canonicalText: row.canonical_text,
    category: row.category,
    tags: Array.isArray(row.tags) ? row.tags : [],
    source: row.source,
    changeReason: row.change_reason,
    changedBy: row.changed_by,
    updatedAt: row.updated_at,
  };
}

function questionWrite(input, questionId = input?.questionId) {
  const id = safeText(questionId, 120).toUpperCase();
  const status = safeText(input?.status, 20).toLowerCase();
  const expectedVersion = Number(input?.expectedVersion);
  const canonicalText = safeText(input?.canonicalText, 1000);
  const category = safeText(input?.category, 120);
  const source = safeText(input?.source, 80).toLowerCase();
  const changeReason = safeText(input?.changeReason, 400);
  const tags = boundedArray(input?.tags, 'question_tags', 24).map((tag) => safeText(tag, 80)).filter(Boolean);
  if (!/^[A-Z0-9][A-Z0-9._:-]{1,119}$/u.test(id)
      || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0
      || !['active', 'hidden', 'retired'].includes(status)
      || canonicalText.length < 3 || !category
      || !/^[a-z0-9][a-z0-9_-]{0,79}$/u.test(source)
      || changeReason.length < 3) {
    throw Object.assign(new TypeError('ivoc_question_input_invalid'), { status: 400 });
  }
  return { id, expectedVersion, status, canonicalText, category, tags, source, changeReason };
}

function mentorPriorityWrite(input) {
  const subjectId = safeText(input?.subjectId, 32);
  const expectedVersion = Number(input?.expectedVersion);
  const priorities = boundedArray(input?.priorities, 'mentor_priorities', 3).map((item, index) => ({
    id: safeText(item?.id, 80) || `priority-${index + 1}`,
    text: safeText(item?.text, 500),
    rank: index + 1,
  }));
  const mentorNotes = boundedArray(input?.mentorNotes || [], 'mentor_notes', 12).map((item, index) => ({
    id: safeText(item?.id, 80) || `note-${index + 1}`,
    text: safeText(item?.text, 500),
    visibility: safeText(item?.visibility, 20) || 'mentor_only',
  }));
  if (!/^wp:[1-9][0-9]{0,19}$/u.test(subjectId)
      || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0
      || priorities.some((item) => !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/u.test(item.id) || item.text.length < 3)
      || mentorNotes.some((item) => !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/u.test(item.id)
        || item.text.length < 3 || !['shared', 'mentor_only'].includes(item.visibility))) {
    throw Object.assign(new TypeError('ivoc_mentor_priorities_input_invalid'), { status: 400 });
  }
  return { subjectId, expectedVersion, priorities, mentorNotes };
}

function publicMentorPriorities(row, { includeMentorNotes = false } = {}) {
  const priorities = Array.isArray(row?.priorities) ? row.priorities : [];
  const notes = Array.isArray(row?.mentor_notes) ? row.mentor_notes : [];
  return {
    subjectId: row?.subject_id || null,
    version: Number(row?.version || 0),
    priorities,
    mentorNotes: includeMentorNotes ? notes : notes.filter((note) => note.visibility === 'shared'),
    setBy: row?.set_by || null,
    setAt: row?.created_at || null,
  };
}

function adminConfigWrite(input) {
  const expectedVersion = Number(input?.expectedVersion);
  const analyticsConfigVersion = safeText(input?.analyticsConfigVersion, 80);
  const brainPackVersion = safeText(input?.brainPackVersion, 80);
  const aisRulesVersion = safeText(input?.aisRulesVersion, 80);
  const changeReason = safeText(input?.changeReason, 400);
  const pressure = input?.pressureDefaults;
  const budgets = input?.proactiveBudgetOverrides;
  const credits = input?.credits;
  const safeVersion = (value) => /^[A-Za-z0-9._:-]{1,80}$/u.test(value);
  const pressureValid = pressure && typeof pressure === 'object' && !Array.isArray(pressure)
    && Number.isSafeInteger(pressure.defaultFollowUpIntensity)
    && pressure.defaultFollowUpIntensity >= 0 && pressure.defaultFollowUpIntensity <= 3
    && typeof pressure.defaultPressureEnabled === 'boolean'
    && Number.isSafeInteger(pressure.maxFollowUpsPerAnswer)
    && pressure.maxFollowUpsPerAnswer >= 0 && pressure.maxFollowUpsPerAnswer <= 5;
  const budgetsValid = budgets && typeof budgets === 'object' && !Array.isArray(budgets)
    && Number.isSafeInteger(budgets.maxProactivePerSession)
    && budgets.maxProactivePerSession >= 0 && budgets.maxProactivePerSession <= 20
    && Number.isSafeInteger(budgets.maxReactivePerAnswer)
    && budgets.maxReactivePerAnswer >= 0 && budgets.maxReactivePerAnswer <= 5
    && Number.isSafeInteger(budgets.maxApplicationProbesPerAnswer)
    && budgets.maxApplicationProbesPerAnswer >= 0 && budgets.maxApplicationProbesPerAnswer <= 1;
  const creditsValid = credits && typeof credits === 'object' && !Array.isArray(credits)
    && Number.isSafeInteger(credits.defaultAllowanceSeconds)
    && credits.defaultAllowanceSeconds >= 0 && credits.defaultAllowanceSeconds <= 10_000_000
    && Number.isSafeInteger(credits.maxOverrideSeconds)
    && credits.maxOverrideSeconds >= 0 && credits.maxOverrideSeconds <= 10_000_000
    && Number.isSafeInteger(credits.resetPeriodDays)
    && credits.resetPeriodDays >= 1 && credits.resetPeriodDays <= 366;
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1
      || !safeVersion(analyticsConfigVersion) || !safeVersion(brainPackVersion)
      || !safeVersion(aisRulesVersion) || changeReason.length < 3
      || !pressureValid || !budgetsValid || !creditsValid) {
    throw Object.assign(new TypeError('ivoc_admin_config_input_invalid'), { status: 400 });
  }
  return {
    expectedVersion, analyticsConfigVersion, brainPackVersion, aisRulesVersion,
    pressureDefaults: {
      default_follow_up_intensity: pressure.defaultFollowUpIntensity,
      default_pressure_enabled: pressure.defaultPressureEnabled,
      max_follow_ups_per_answer: pressure.maxFollowUpsPerAnswer,
    },
    proactiveBudgetOverrides: {
      max_proactive_per_session: budgets.maxProactivePerSession,
      max_reactive_per_answer: budgets.maxReactivePerAnswer,
      max_application_probes_per_answer: budgets.maxApplicationProbesPerAnswer,
    },
    credits: {
      default_allowance_seconds: credits.defaultAllowanceSeconds,
      max_override_seconds: credits.maxOverrideSeconds,
      reset_period_days: credits.resetPeriodDays,
    },
    changeReason,
  };
}

function publicAdminConfig(row) {
  if (!row) return null;
  return {
    schema: row.schema_name,
    version: row.version,
    analyticsConfigVersion: row.analytics_config_version,
    brainPackVersion: row.brain_pack_version,
    aisRulesVersion: row.ais_rules_version,
    pressureDefaults: {
      defaultFollowUpIntensity: row.pressure_defaults?.default_follow_up_intensity,
      defaultPressureEnabled: row.pressure_defaults?.default_pressure_enabled,
      maxFollowUpsPerAnswer: row.pressure_defaults?.max_follow_ups_per_answer,
    },
    proactiveBudgetOverrides: {
      maxProactivePerSession: row.proactive_budget_overrides?.max_proactive_per_session,
      maxReactivePerAnswer: row.proactive_budget_overrides?.max_reactive_per_answer,
      maxApplicationProbesPerAnswer: row.proactive_budget_overrides?.max_application_probes_per_answer,
    },
    credits: {
      defaultAllowanceSeconds: row.credits?.default_allowance_seconds,
      maxOverrideSeconds: row.credits?.max_override_seconds,
      resetPeriodDays: row.credits?.reset_period_days,
    },
    changeReason: row.change_reason,
    changedBy: row.changed_by,
    createdAt: row.created_at,
  };
}

function creditWrite(input) {
  const subjectId = safeText(input?.subjectId, 32);
  const expectedVersion = Number(input?.expectedVersion);
  const action = safeText(input?.action, 24).toLowerCase();
  const amountSeconds = Number(input?.amountSeconds);
  const idempotencyKey = safeText(input?.idempotencyKey, 40).toLowerCase();
  const reason = safeText(input?.reason, 400);
  if (!/^wp:[1-9][0-9]{0,19}$/u.test(subjectId)
      || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0
      || !['set_allowance', 'set_override', 'reset'].includes(action)
      || !Number.isSafeInteger(amountSeconds) || amountSeconds < 0 || amountSeconds > 10_000_000
      || (action === 'reset' && amountSeconds !== 0)
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(idempotencyKey)
      || reason.length < 3) {
    throw Object.assign(new TypeError('ivoc_credit_input_invalid'), { status: 400 });
  }
  return { subjectId, expectedVersion, action, amountSeconds, idempotencyKey, reason };
}

function publicCreditAccount(row, subjectId = row?.subject_id) {
  const allowance = Number(row?.allowance_seconds || 0);
  const override = Number(row?.override_seconds || 0);
  const consumed = Number(row?.consumed_seconds || 0);
  return {
    subjectId: subjectId || null,
    version: Number(row?.version || 0),
    allowanceSeconds: allowance,
    overrideSeconds: override,
    consumedSeconds: consumed,
    balanceSeconds: Number(row?.balance_seconds ?? Math.max(0, allowance + override - consumed)),
    periodStartedAt: row?.period_started_at || null,
    periodEndsAt: row?.period_ends_at || null,
    updatedBy: row?.updated_by || null,
    updatedAt: row?.updated_at || null,
    eventId: row?.event_id || null,
    eventAction: row?.event_action || null,
  };
}

function publicCreditEvent(row) {
  return {
    eventId: row.event_id,
    accountVersion: row.account_version,
    action: row.action,
    amountSeconds: Number(row.amount_seconds),
    allowanceAfter: Number(row.allowance_after),
    overrideAfter: Number(row.override_after),
    consumedAfter: Number(row.consumed_after),
    balanceAfter: Number(row.balance_after),
    periodStartedAt: row.period_started_at,
    periodEndsAt: row.period_ends_at,
    reason: row.reason,
    actorSubject: row.actor_subject,
    createdAt: row.created_at,
  };
}

async function currentCreditAccount(db, subjectId) {
  const row = await db.single(`ivoc_credit_accounts?subject_id=eq.${encodeURIComponent(subjectId)}&select=*&limit=1`);
  if (row) return row;
  const config = await db.single('ivoc_admin_config_versions?select=credits&order=version.desc&limit=1');
  const allowance = Number(config?.credits?.default_allowance_seconds || 0);
  return {
    subject_id: subjectId, version: 0, allowance_seconds: allowance,
    override_seconds: 0, consumed_seconds: 0, balance_seconds: allowance,
  };
}

function publicAnswerAsset(row) {
  return {
    schema: row.schema_name,
    assetId: row.asset_id,
    version: row.version,
    ownerSubject: row.owner_subject,
    sessionId: row.session_id,
    recordingId: row.recording_id,
    answerSegmentId: row.answer_segment_id,
    questionId: row.question_id,
    title: row.title,
    startMs: Number(row.start_ms),
    endMs: Number(row.end_ms),
    status: row.status,
    audiences: Array.isArray(row.audiences) ? row.audiences : [],
    consent: {
      granted: row.consent?.granted === true,
      scope: row.consent?.scope || 'bounded_clip',
      grantedAt: row.consent?.granted_at || null,
    },
    strongestAnswer: row.strongest_answer === true,
    changeReason: row.change_reason,
    changedBy: row.changed_by,
    createdAt: row.created_at,
  };
}

async function writeAnswerAsset({ db, actor, assetId, input, existing = null }) {
  let write;
  try {
    write = assertAnswerAssetOwner(normalizeAnswerAssetWrite({
      ...input, assetId, ownerSubject: actor,
    }), actor);
  } catch (error) {
    throw Object.assign(error, { status: 400 });
  }
  if (!(write.status === 'revoked' && existing)) {
    const [sessionRow, recording, segment] = await Promise.all([
      db.single(`ivoc_sessions?id=eq.${write.sessionId}&owner_subject=eq.${encodeURIComponent(actor)}&select=id,owner_subject,question_id&limit=1`),
      db.single(`ivoc_recordings?id=eq.${write.recordingId}&owner_subject=eq.${encodeURIComponent(actor)}&status=eq.saved&select=id,session_id,owner_subject,duration_ms&limit=1`),
      db.single(`ivoc_answer_segments?segment_id=eq.${encodeURIComponent(write.answerSegmentId)}&subject_id=eq.${encodeURIComponent(actor)}&select=segment_id,session_id,subject_id,question,answer,media_ref&limit=1`),
    ]);
    if (!sessionRow || !recording || !segment
        || recording.session_id !== sessionRow.id || segment.session_id !== sessionRow.id
        || segment.media_ref !== `recording:${recording.id}`
        || write.endMs > Number(recording.duration_ms || -1)
        || write.startMs < Number(segment.answer?.t_start_ms ?? -1)
        || write.endMs > Number(segment.answer?.t_end_ms ?? -1)
        || write.questionId !== (segment.question?.canonical_question_id || sessionRow.question_id)) {
      throw Object.assign(new Error('ivoc_answer_asset_source_invalid'), { status: 404 });
    }
  }
  try {
    return await db.rpc('ivoc_write_answer_asset', {
      p_asset_id: write.assetId,
      p_expected_version: write.expectedVersion,
      p_owner_subject: actor,
      p_session_id: write.sessionId,
      p_recording_id: write.recordingId,
      p_answer_segment_id: write.answerSegmentId,
      p_question_id: write.questionId,
      p_title: write.title,
      p_start_ms: write.startMs,
      p_end_ms: write.endMs,
      p_status: write.status,
      p_audiences: [...write.audiences],
      p_consent: {
        granted: write.consent.granted,
        scope: write.consent.scope,
        granted_at: write.consent.grantedAt,
      },
      p_strongest_answer: write.strongestAnswer,
      p_change_reason: write.changeReason,
      p_actor: actor,
    });
  } catch (error) {
    const detail = String(error?.detail || '');
    if (detail.includes('ivoc_answer_asset_version_conflict')
        || detail.includes('ivoc_answer_asset_revoked')
        || detail.includes('ivoc_answer_asset_source_immutable')
        || detail.includes('ivoc_answer_asset_ready_requires_revocation')) {
      throw Object.assign(new Error(detail), { status: 409 });
    }
    throw error;
  }
}

function practiceGoal(row) {
  const goal = String(row?.context?.goal || '').toLowerCase();
  if (goal.includes('guided')) return 'guided_mock';
  if (goal.includes('individual') || row?.session_type === 'question') return 'individual_question';
  return 'full_simulation';
}

function contractEnvironment(row) {
  const environment = String(row?.context?.environment || '').toLowerCase();
  if (environment.includes('webex')) return 'webex_sim';
  if (environment.includes('zoom')) return 'zoom_sim';
  if (environment.includes('teams')) return 'teams_sim';
  if (environment.includes('studio')) return 'live_mock_studio';
  return 'missionmed';
}

function liveConversationTurns(value, sessionId) {
  if (value == null) return [];
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || value.schema !== 'ivoc.live-conversation.v1'
      || value.provider !== 'openai-gpt-live'
      || value.clock !== 'recording-observed') {
    throw Object.assign(new TypeError('live_conversation_invalid'), { status: 400 });
  }
  const seen = new Set();
  let sawStudent = false;
  let interviewerCount = 0;
  return boundedArray(value.turns, 'live_conversation_turns', 128).map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || item.final !== true) {
      throw Object.assign(new TypeError('live_conversation_turn_invalid'), { status: 400 });
    }
    const sourceId = String(item.id || '');
    const text = String(item.text || '').trim();
    const sourceType = String(item.providerEventType || '');
    if (!sourceId || sourceId.length > 240 || seen.has(sourceId)
        || !text || text.length > 8_000 || sourceType.length > 200
        || !['student', 'interviewer'].includes(item.speaker)) {
      throw Object.assign(new TypeError('live_conversation_turn_invalid'), { status: 400 });
    }
    seen.add(sourceId);
    const startMs = contractInteger(item.startMs, 'live_conversation_start');
    const endMs = contractInteger(item.endMs, 'live_conversation_end');
    if (endMs < startMs || endMs > 43_200_000) {
      throw Object.assign(new TypeError('live_conversation_time_invalid'), { status: 400 });
    }
    const digest = createHash('sha256').update(sourceId).digest('hex');
    let relation = 'answer';
    if (item.speaker === 'interviewer') {
      relation = interviewerCount === 0 && !sawStudent ? 'opening' : (sawStudent ? 'follow_up' : 'question');
      interviewerCount += 1;
    } else {
      sawStudent = true;
    }
    return {
      turn_id: `turn:${sessionId}:live:${digest.slice(0, 24)}`,
      session_id: sessionId,
      parent_turn_id: null,
      schema_version: 1,
      speaker: item.speaker,
      relation,
      t_start_ms: startMs,
      t_end_ms: endMs,
      // Provider-delivered text is useful private continuity evidence, but is
      // explicitly provisional. Only server transcription may set canonical_ref.
      transcript: {
        provisional_ref: `provider:gpt-live-1:${digest}`,
        text,
        provider_event_type: sourceType || null,
      },
      question: item.speaker === 'interviewer' ? { origin: 'generated' } : {},
      semantic: {},
      interrupted: null,
      version: 1,
    };
  });
}

async function persistContextSpine({ db, actor, sessionRow, recording, result, nowMs }) {
  // Server-generated transcript truth is persisted here; the browser never asserts canonical text.
  if (result?.transcript?.status !== 'AVAILABLE') return { transcript: false, analysis: false };
  const transcript = result.transcript;
  const question = result.question;
  const analysisAvailable = result.analysis?.status === 'AVAILABLE';
  const startedAt = contractTimestamp(sessionRow.started_at || new Date(nowMs).toISOString(), 'session_started_at');
  const durationMs = Math.max(0, Math.trunc(Number(
    recording.duration_ms || result.analysis?.range?.endMs || transcript.segments.at(-1)?.endMs || 0,
  )));
  const questionTurnId = `turn:${sessionRow.id}:question`;
  const transcriptRef = `transcript:${transcript.transcriptId}`;
  const mediaRef = `recording:${recording.id}`;
  const answerTurns = transcript.segments.map((segment, index) => ({
    turn_id: `turn:${sessionRow.id}:answer:${index + 1}`,
    session_id: sessionRow.id,
    parent_turn_id: questionTurnId,
    schema_version: 1,
    speaker: 'student',
    relation: 'answer',
    t_start_ms: Math.max(0, Math.trunc(segment.startMs)),
    t_end_ms: Math.max(0, Math.trunc(segment.endMs)),
    transcript: { canonical_ref: `${transcriptRef}#${segment.id}`, text: segment.text },
    question: {
      identity: { canonical_question_id: question.questionId, version: String(question.revision || 1) },
      origin: 'pool',
      text_hash: createHash('sha256').update(question.canonicalText).digest('hex'),
    },
    semantic: analysisAvailable ? {
      classification: result.analysis.answerStage?.label || 'COMPLETE',
      coverage: result.analysis.coverage,
      confidence: result.analysis.score,
      classifier_version: result.analysis.provenance?.policyVersion || 'context-v1',
    } : {},
    interrupted: null,
    version: 1,
  }));
  const evidence = analysisAvailable ? result.analysis.semanticObservations.map((item, index) => ({
    evidence_id: `evidence:${sessionRow.id}:${index + 1}`,
    session_id: sessionRow.id,
    subject_id: actor,
    schema_version: 1,
    dimension: `semantic.${String(item.kind || 'supported_claim').toLowerCase()}`,
    refs: item.transcriptSegmentIds.map((id) => ({ kind: 'transcript_span', ref: `${transcriptRef}#${id}` })),
    interpretation: { text: item.text, by: 'ai_draft' },
    confidence: result.analysis.coverage,
    limitations: result.analysis.limitations || [],
    version: 1,
  })) : [];
  const contextReceipts = await readSessionContextReceipts(db, sessionRow.id);
  await db.upsert('ivoc_session_contracts', 'session_id', {
    session_id: sessionRow.id, schema_version: 1, actor_subject: actor, role_context: 'student',
    practice_goal: practiceGoal(sessionRow),
    pressure_modifier: practiceGoal(sessionRow) === 'individual_question' ? false : sessionRow.context?.pressurePractice === true,
    transport_profile: 'none', environment: contractEnvironment(sessionRow), selection_policy: 'system',
    follow_up_intensity: sessionRow.context?.pressurePractice === true ? 2 : 1,
    target_asked_count: Math.max(1, Math.trunc(Number(sessionRow.context?.targetQuestions) || 1)),
    target_duration_s: Math.max(1, Math.ceil(durationMs / 1000)),
    interviewer_config_ref: `interviewer:${safeText(sessionRow.context?.interviewer, 120) || sessionRow.interviewer_provider}`,
    question_pool_ref: `question:${question.questionId}`, analytics_config_version: sessionRow.analytics_schema || 'ivoc.analytics.v1',
    contract_state: 'complete', state_version: 1,
    clock: { origin: 'capture_owner', started_at_wall: startedAt }, context_receipts: contextReceipts,
  });
  await db.upsert('ivoc_conversation_turns', 'turn_id', {
    turn_id: questionTurnId, session_id: sessionRow.id, parent_turn_id: null, schema_version: 1,
    speaker: 'interviewer', relation: 'question', t_start_ms: 0, t_end_ms: 0,
    transcript: { text: question.canonicalText },
    question: { identity: { canonical_question_id: question.questionId, version: String(question.revision || 1) }, origin: 'pool' },
    semantic: {}, interrupted: null, version: 1,
  });
  for (const turn of answerTurns) await db.upsert('ivoc_conversation_turns', 'turn_id', turn);
  const providerFollowUps = await db.request(
    `ivoc_conversation_turns?session_id=eq.${sessionRow.id}&speaker=eq.interviewer&relation=eq.follow_up&select=turn_id&order=t_start_ms.asc`,
  );
  const evidenceIds = evidence.map((item) => item.evidence_id);
  await db.upsert('ivoc_answer_segments', 'segment_id', {
    segment_id: `segment:${sessionRow.id}:primary`, session_id: sessionRow.id, subject_id: actor,
    schema_version: 1, transcript_ref: transcriptRef, media_ref: mediaRef,
    question: { origin: 'pool', text: question.canonicalText, asked_turn_id: questionTurnId, t_asked_ms: 0, canonical_question_id: question.questionId, version: String(question.revision || 1) },
    answer: {
      t_start_ms: answerTurns[0].t_start_ms,
      t_end_ms: answerTurns.at(-1).t_end_ms,
      turn_ids: answerTurns.map((turn) => turn.turn_id),
      follow_up_turn_ids: providerFollowUps.map((turn) => turn.turn_id),
    },
    coaching_notes_refs: evidenceIds, scoring: null, strongest_marker: null, version: 1,
  });
  for (const item of evidence) await db.upsert('ivoc_coaching_evidence', 'evidence_id', item);
  return { transcript: true, analysis: analysisAvailable };
}

async function readPublicSpine(db, sessionId) {
  const turns = await db.request(`ivoc_conversation_turns?session_id=eq.${sessionId}&select=turn_id,speaker,relation,t_start_ms,t_end_ms,transcript,question,semantic,version&order=t_start_ms.asc`);
  const segments = await db.request(`ivoc_answer_segments?session_id=eq.${sessionId}&select=segment_id,transcript_ref,media_ref,question,answer,coaching_notes_refs,version&order=created_at.asc`);
  const evidence = await db.request(`ivoc_coaching_evidence?session_id=eq.${sessionId}&select=evidence_id,dimension,refs,interpretation,score,confidence,limitations,version&order=created_at.asc`);
  if (!turns.length && !segments.length && !evidence.length) return null;
  return {
    schema: 'ivoc.session-spine.v1',
    turns: turns.map((turn) => ({ id: turn.turn_id, speaker: turn.speaker, relation: turn.relation, startMs: turn.t_start_ms, endMs: turn.t_end_ms, transcript: turn.transcript, question: turn.question, semantic: turn.semantic, version: turn.version })),
    segments: segments.map((segment) => ({ id: segment.segment_id, transcriptRef: segment.transcript_ref, mediaRef: segment.media_ref, question: segment.question, answer: segment.answer, coachingNotesRefs: segment.coaching_notes_refs, version: segment.version })),
    evidence: evidence.map((item) => ({ id: item.evidence_id, dimension: item.dimension, refs: item.refs, interpretation: item.interpretation, score: item.score, confidence: item.confidence, limitations: item.limitations, version: item.version })),
  };
}

function extensionForMime(mime) { return String(mime || '').includes('mp4') ? 'mp4' : 'webm'; }

export function createIvocHandler({
  registry = admissionRegistry,
  repository = null,
  storage = null,
  now = () => Date.now(),
  env = process.env,
  fetchImpl = fetch,
  contextProvider = null,
  applicationIntelligence = null,
} = {}) {
  const mediaBase = '';
  const db = repository || createIvocRepository({
    baseUrl: env.IVPREP_SUPABASE_URL,
    serviceRoleKey: env.IVPREP_SUPABASE_SERVICE_ROLE_KEY,
  });
  const media = storage || createIvocStorage({
    endpoint: env.MMHQ_R2_ENDPOINT,
    accountId: env.MMHQ_R2_ACCOUNT_ID,
    accessKeyId: env.MMHQ_R2_ACCESS_KEY_ID,
    secretAccessKey: env.MMHQ_R2_SECRET_ACCESS_KEY,
    bucket: env.MMHQ_R2_BUCKET || 'missionmed-cam-production',
    prefix: env.MMHQ_R2_IVOC_PREFIX || 'ivoc/recordings',
    sessionSecret: env.MMHQ_SESSION_SECRET,
    fetchImpl,
  });
  const appIntelligence = applicationIntelligence || createIvocApplicationIntelligence({ repository: db, now });
  const enabled = bool(env.IVPREP_ENABLED) && bool(env.IVPREP_ADMIN_CANARY_ENABLED);
  const contextEnabled = bool(env.IVOC_CONTEXT_CANDIDATE_ENABLED);
  const contextTranscriptEnabled = bool(env.IVOC_CONTEXT_TRANSCRIPT_ENABLED);
  const requireHead = bool(env.IVOC_REQUIRE_MEDIA_HEAD, false);
  const context = contextProvider || createContextIntelligenceProvider({
    apiKey: env.MMHQ_OPENAI_API_KEY || env.OPENAI_API_KEY || '',
    transcriptionModel: env.IVOC_TRANSCRIPTION_MODEL || 'whisper-1',
    contextModel: env.IVOC_CONTEXT_MODEL || 'gpt-5.6-terra',
    fetchImpl,
    now,
  });

  async function audit({ actor, owner = null, sessionId = null, recordingId = null, action, decision, reason }) {
    await db.insert('ivoc_access_log', {
      actor_subject: actor || null, owner_subject: owner || null, session_id: sessionId,
      recording_id: recordingId, action, decision, reason,
    }).catch(() => null);
  }

  async function canReadSession({ row, actor, session, admission }) {
    if (!row) return false;
    if (row.owner_subject === actor || isAdmin(session, admission)) return true;
    if (!isMentor(session)) return false;
    const assignment = await db.single(`ivoc_reviews?session_id=eq.${encodeURIComponent(row.id)}&mentor_subject=eq.${encodeURIComponent(actor)}&status=neq.revoked&select=id&limit=1`);
    return Boolean(assignment);
  }

  return async function handleIvocRequest({ request, response, url, hqSession, cookieFingerprint, hqSessionMaxTtlSeconds, expectedOrigin } = {}) {
    const pathname = url?.pathname || '/';
    if (!(pathname === UI_PREFIX || pathname.startsWith(`${UI_PREFIX}/`) || pathname.startsWith(`${ANALYTICS_PREFIX}/`) || pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`))) return false;
    if (request.headers.authorization || request.headers.Authorization) { sendError(response, 401, 'ivprep_authentication_required', mediaBase); return true; }
    if (!enabled) { sendError(response, 503, 'ivprep_unavailable', mediaBase); return true; }

    try { await registry.refreshSubject?.({ hqSession, cookieFingerprint }); }
    catch { sendError(response, 503, 'ivprep_admission_unavailable', mediaBase); return true; }
    const admission = strictProjectHqSession({ request, hqSession, cookieFingerprint, registry, now: now(), maxSessionTtlSeconds: hqSessionMaxTtlSeconds });
    if (!admission.ok) { sendError(response, admission.status || 401, admission.code || 'ivprep_authentication_required', mediaBase); return true; }
    const actor = admission.subject;

    if (pathname === UI_PREFIX) { response.writeHead(308, securityHeaders(mediaBase, { Location: `${UI_PREFIX}/` })); response.end(); return true; }
    if (pathname.startsWith(`${UI_PREFIX}/`)) {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, securityHeaders(mediaBase, { Allow: 'GET, HEAD' })); response.end(); return true; }
      const file = staticPath(pathname);
      if (!file) { sendError(response, 404, 'not_found', mediaBase); return true; }
      response.writeHead(200, securityHeaders(mediaBase, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' }));
      if (request.method === 'HEAD') response.end(); else createReadStream(file).pipe(response);
      return true;
    }

    if (pathname.startsWith(`${ANALYTICS_PREFIX}/`)) {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, securityHeaders(mediaBase, { Allow: 'GET, HEAD' })); response.end(); return true; }
      const file = staticPath(pathname, ANALYTICS_ROOT, ANALYTICS_PREFIX);
      if (!file) { sendError(response, 404, 'not_found', mediaBase); return true; }
      response.writeHead(200, securityHeaders(mediaBase, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' }));
      if (request.method === 'HEAD') response.end(); else createReadStream(file).pipe(response);
      return true;
    }

    if (!pathname.startsWith(`${API_PREFIX}/`)) { sendError(response, 404, 'not_found', mediaBase); return true; }
    if (!['GET', 'HEAD'].includes(request.method)) {
      const mutation = validateIvPrepMutation({ request, admission, expectedOrigin });
      if (!mutation.ok) { sendError(response, mutation.status || 403, mutation.code || 'ivprep_admission_denied', mediaBase); return true; }
    }

    try {
      if (request.method === 'GET' && pathname === `${API_PREFIX}/bootstrap`) {
        const preferences = await db.single(`ivoc_preferences?owner_subject=eq.${encodeURIComponent(actor)}&select=*&limit=1`);
        sendJson(response, 200, {
          identity: { subject: actor, displayName: displayName(hqSession), roles: rolesOf(hqSession), admin: isAdmin(hqSession, admission), mentor: isMentor(hqSession) },
          entitlement: { admitted: true, founder: admission.entitlement?.founder === true, voice: true, video: admission.entitlement?.video === true },
          csrfToken: admission.csrfToken,
          preferences: preferences ? { calibration: preferences.calibration, visibility: preferences.visibility, coachingEnabled: preferences.coaching_enabled, recordingDefault: preferences.recording_default } : null,
        }, mediaBase);
        return true;
      }

      if (request.method === 'GET' && pathname === `${API_PREFIX}/questions`) {
        const admin = isAdmin(hqSession, admission);
        const filter = admin ? '' : 'status=eq.active&';
        const rows = await db.request(`ivoc_question_catalog?${filter}select=question_id,status,current_version,canonical_text,category,tags,source,change_reason,changed_by,updated_at&order=question_id.asc`);
        sendJson(response, 200, { admin, questions: rows.map(publicQuestion) }, mediaBase);
        return true;
      }

      if (request.method === 'GET' && pathname === `${API_PREFIX}/mentor-priorities`) {
        const row = await db.single(`ivoc_mentor_priority_sets?subject_id=eq.${encodeURIComponent(actor)}&select=*&order=version.desc&limit=1`);
        sendJson(response, 200, publicMentorPriorities(row || { subject_id: actor }), mediaBase);
        return true;
      }

      if (request.method === 'GET' && pathname === `${API_PREFIX}/admin/mentor-priorities`) {
        if (!isAdmin(hqSession, admission)) {
          await audit({ actor, action: 'mentor_priorities_read', decision: 'deny', reason: 'admin_required' });
          sendError(response, 403, 'ivoc_admin_required', mediaBase); return true;
        }
        const subjectId = safeText(url.searchParams.get('subjectId'), 32);
        if (!/^wp:[1-9][0-9]{0,19}$/u.test(subjectId)) {
          sendError(response, 400, 'ivoc_mentor_priorities_input_invalid', mediaBase); return true;
        }
        const row = await db.single(`ivoc_mentor_priority_sets?subject_id=eq.${encodeURIComponent(subjectId)}&select=*&order=version.desc&limit=1`);
        await audit({ actor, owner: subjectId, action: 'mentor_priorities_read', decision: 'allow', reason: 'admin' });
        sendJson(response, 200, publicMentorPriorities(row || { subject_id: subjectId }, { includeMentorNotes: true }), mediaBase);
        return true;
      }

      if (request.method === 'PUT' && pathname === `${API_PREFIX}/admin/mentor-priorities`) {
        if (!isAdmin(hqSession, admission)) {
          await audit({ actor, action: 'mentor_priorities_write', decision: 'deny', reason: 'admin_required' });
          sendError(response, 403, 'ivoc_admin_required', mediaBase); return true;
        }
        const write = mentorPriorityWrite(await readJson(request));
        let row;
        try {
          row = await db.rpc('ivoc_write_mentor_priorities', {
            p_subject_id: write.subjectId,
            p_expected_version: write.expectedVersion,
            p_priorities: write.priorities,
            p_mentor_notes: write.mentorNotes,
            p_actor: actor,
          });
        } catch (error) {
          if (String(error?.detail || '').includes('ivoc_mentor_priorities_version_conflict')) {
            throw Object.assign(new Error('ivoc_mentor_priorities_version_conflict'), { status: 409 });
          }
          throw error;
        }
        await audit({ actor, owner: write.subjectId, action: 'mentor_priorities_write', decision: 'allow', reason: `v${row.version}` });
        sendJson(response, 200, publicMentorPriorities(row, { includeMentorNotes: true }), mediaBase);
        return true;
      }

      if (request.method === 'GET' && pathname === `${API_PREFIX}/admin/config`) {
        if (!isAdmin(hqSession, admission)) {
          await audit({ actor, action: 'admin_config_read', decision: 'deny', reason: 'admin_required' });
          sendError(response, 403, 'ivoc_admin_required', mediaBase); return true;
        }
        const row = await db.single('ivoc_admin_config_versions?select=*&order=version.desc&limit=1');
        await audit({ actor, action: 'admin_config_read', decision: 'allow', reason: `v${row?.version || 0}` });
        sendJson(response, 200, publicAdminConfig(row), mediaBase);
        return true;
      }

      if (request.method === 'GET' && pathname === `${API_PREFIX}/admin/embodiment`) {
        if (!isAdmin(hqSession, admission)) {
          await audit({ actor, action: 'embodiment_config_read', decision: 'deny', reason: 'admin_required' });
          sendError(response, 403, 'ivoc_admin_required', mediaBase); return true;
        }
        await audit({ actor, action: 'embodiment_config_read', decision: 'allow', reason: EMBODIMENT_SCHEMA });
        sendJson(response, 200, publicEmbodimentConfig(), mediaBase);
        return true;
      }

      if (request.method === 'PUT' && pathname === `${API_PREFIX}/admin/config`) {
        if (!isAdmin(hqSession, admission)) {
          await audit({ actor, action: 'admin_config_write', decision: 'deny', reason: 'admin_required' });
          sendError(response, 403, 'ivoc_admin_required', mediaBase); return true;
        }
        const write = adminConfigWrite(await readJson(request));
        let row;
        try {
          row = await db.rpc('ivoc_write_admin_config', {
            p_expected_version: write.expectedVersion,
            p_analytics_config_version: write.analyticsConfigVersion,
            p_brain_pack_version: write.brainPackVersion,
            p_ais_rules_version: write.aisRulesVersion,
            p_pressure_defaults: write.pressureDefaults,
            p_proactive_budget_overrides: write.proactiveBudgetOverrides,
            p_credits: write.credits,
            p_change_reason: write.changeReason,
            p_actor: actor,
          });
        } catch (error) {
          if (String(error?.detail || '').includes('ivoc_admin_config_version_conflict')) {
            throw Object.assign(new Error('ivoc_admin_config_version_conflict'), { status: 409 });
          }
          throw error;
        }
        await audit({ actor, action: 'admin_config_write', decision: 'allow', reason: `v${row.version}` });
        sendJson(response, 200, publicAdminConfig(row), mediaBase);
        return true;
      }

      if (request.method === 'GET' && pathname === `${API_PREFIX}/credits`) {
        const row = await currentCreditAccount(db, actor);
        await audit({ actor, owner: actor, action: 'credit_balance_read', decision: 'allow', reason: 'owner' });
        sendJson(response, 200, { account: publicCreditAccount(row, actor) }, mediaBase);
        return true;
      }

      if (request.method === 'GET' && pathname === `${API_PREFIX}/admin/credits`) {
        if (!isAdmin(hqSession, admission)) {
          await audit({ actor, action: 'credit_admin_read', decision: 'deny', reason: 'admin_required' });
          sendError(response, 403, 'ivoc_admin_required', mediaBase); return true;
        }
        const subjectId = safeText(url.searchParams.get('subjectId'), 32);
        if (!/^wp:[1-9][0-9]{0,19}$/u.test(subjectId)) {
          sendError(response, 400, 'ivoc_credit_input_invalid', mediaBase); return true;
        }
        const [row, events] = await Promise.all([
          currentCreditAccount(db, subjectId),
          db.request(`ivoc_credit_events?subject_id=eq.${encodeURIComponent(subjectId)}&select=*&order=account_version.desc&limit=100`),
        ]);
        await audit({ actor, owner: subjectId, action: 'credit_admin_read', decision: 'allow', reason: 'admin' });
        sendJson(response, 200, {
          account: publicCreditAccount(row, subjectId), events: events.map(publicCreditEvent),
        }, mediaBase);
        return true;
      }

      if (request.method === 'PUT' && pathname === `${API_PREFIX}/admin/credits`) {
        if (!isAdmin(hqSession, admission)) {
          await audit({ actor, action: 'credit_admin_write', decision: 'deny', reason: 'admin_required' });
          sendError(response, 403, 'ivoc_admin_required', mediaBase); return true;
        }
        const write = creditWrite(await readJson(request));
        let row;
        try {
          row = await db.rpc('ivoc_mutate_user_credits', {
            p_subject_id: write.subjectId,
            p_expected_version: write.expectedVersion,
            p_action: write.action,
            p_amount_seconds: write.amountSeconds,
            p_idempotency_key: write.idempotencyKey,
            p_reason: write.reason,
            p_actor: actor,
          });
        } catch (error) {
          const detail = String(error?.detail || '');
          if (detail.includes('ivoc_credit_version_conflict')
              || detail.includes('ivoc_credit_idempotency_conflict')
              || detail.includes('ivoc_credit_override_exceeds_limit')
              || detail.includes('ivoc_credit_balance_insufficient')) {
            throw Object.assign(new Error(detail), { status: 409 });
          }
          throw error;
        }
        await audit({ actor, owner: write.subjectId, action: 'credit_admin_write', decision: 'allow', reason: `${write.action}:v${row.version}` });
        sendJson(response, 200, { account: publicCreditAccount(row, write.subjectId) }, mediaBase);
        return true;
      }

      if (request.method === 'GET' && pathname === `${API_PREFIX}/answer-assets`) {
        const rows = await db.request(`ivoc_answer_asset_versions?owner_subject=eq.${encodeURIComponent(actor)}&select=*&order=asset_id.asc,version.desc&limit=500`);
        const latest = [];
        const seen = new Set();
        for (const row of rows) {
          if (seen.has(row.asset_id)) continue;
          seen.add(row.asset_id);
          latest.push(publicAnswerAsset(row));
        }
        await audit({ actor, owner: actor, action: 'answer_assets_read', decision: 'allow', reason: 'owner' });
        sendJson(response, 200, { assets: latest }, mediaBase);
        return true;
      }

      if (request.method === 'POST' && pathname === `${API_PREFIX}/answer-assets`) {
        const input = await readJson(request);
        const row = await writeAnswerAsset({ db, actor, assetId: randomUUID(), input });
        await audit({ actor, owner: actor, sessionId: row.session_id, recordingId: row.recording_id, action: 'answer_asset_write', decision: 'allow', reason: `${row.status}:v${row.version}` });
        sendJson(response, 201, { asset: publicAnswerAsset(row) }, mediaBase);
        return true;
      }

      let answerAssetMatch = pathname.match(/^\/api\/ivoc\/v1\/answer-assets\/([0-9a-f-]{36})$/u);
      if (request.method === 'PATCH' && answerAssetMatch) {
        const assetId = answerAssetMatch[1];
        const existing = await db.single(`ivoc_answer_asset_versions?asset_id=eq.${assetId}&owner_subject=eq.${encodeURIComponent(actor)}&select=*&order=version.desc&limit=1`);
        if (!existing) {
          await audit({ actor, action: 'answer_asset_write', decision: 'deny', reason: 'not_owner' });
          sendError(response, 404, 'not_found', mediaBase); return true;
        }
        const row = await writeAnswerAsset({ db, actor, assetId, input: await readJson(request), existing });
        await audit({ actor, owner: actor, sessionId: row.session_id, recordingId: row.recording_id, action: 'answer_asset_write', decision: 'allow', reason: `${row.status}:v${row.version}` });
        sendJson(response, 200, { asset: publicAnswerAsset(row) }, mediaBase);
        return true;
      }

      answerAssetMatch = pathname.match(/^\/api\/ivoc\/v1\/answer-assets\/([0-9a-f-]{36})\/playback-url$/u);
      if (request.method === 'GET' && answerAssetMatch) {
        const asset = await db.single(`ivoc_answer_asset_versions?asset_id=eq.${answerAssetMatch[1]}&owner_subject=eq.${encodeURIComponent(actor)}&select=*&order=version.desc&limit=1`);
        const recording = asset?.status !== 'revoked'
          ? await db.single(`ivoc_recordings?id=eq.${asset.recording_id}&owner_subject=eq.${encodeURIComponent(actor)}&status=eq.saved&select=*&limit=1`)
          : null;
        if (!asset || !recording) {
          await audit({ actor, owner: asset?.owner_subject, recordingId: asset?.recording_id, action: 'answer_asset_playback', decision: 'deny', reason: asset?.status === 'revoked' ? 'revoked' : 'not_owner' });
          sendError(response, 404, 'not_found', mediaBase); return true;
        }
        const playback = media.createPlayback({ recordingId: recording.id, objectKey: recording.storage_object_key, disposition: 'inline' });
        const playbackUrl = `${API_PREFIX}/recordings/${recording.id}/playback?token=${encodeURIComponent(playback.token)}&expires=${playback.expiresAtMs}&disposition=inline`;
        await audit({ actor, owner: actor, sessionId: asset.session_id, recordingId: recording.id, action: 'answer_asset_playback', decision: 'allow', reason: asset.status });
        sendJson(response, 200, {
          assetId: asset.asset_id, version: asset.version, startMs: Number(asset.start_ms),
          endMs: Number(asset.end_ms), url: playbackUrl, expiresAt: playback.expiresAt,
        }, mediaBase);
        return true;
      }

      const questionMutationMatch = pathname.match(/^\/api\/ivoc\/v1\/admin\/questions(?:\/([A-Z0-9][A-Z0-9._:-]{1,119}))?$/u);
      if ((request.method === 'POST' || request.method === 'PATCH') && questionMutationMatch) {
        if (!isAdmin(hqSession, admission)) {
          await audit({ actor, action: 'question_governance_write', decision: 'deny', reason: 'admin_required' });
          sendError(response, 403, 'ivoc_admin_required', mediaBase); return true;
        }
        const input = await readJson(request);
        const suppliedId = request.method === 'PATCH' ? questionMutationMatch[1] : input.questionId;
        const write = questionWrite(input, suppliedId);
        if ((request.method === 'POST' && questionMutationMatch[1])
            || (request.method === 'PATCH' && (!questionMutationMatch[1] || input.questionId != null))) {
          sendError(response, 400, 'ivoc_question_input_invalid', mediaBase); return true;
        }
        let row;
        try {
          row = await db.rpc('ivoc_write_question_version', {
            p_question_id: write.id,
            p_expected_version: write.expectedVersion,
            p_status: write.status,
            p_canonical_text: write.canonicalText,
            p_category: write.category,
            p_tags: write.tags,
            p_source: write.source,
            p_change_reason: write.changeReason,
            p_actor: actor,
          });
        } catch (error) {
          const detail = String(error?.detail || '');
          if (detail.includes('ivoc_question_version_conflict')) {
            throw Object.assign(new Error('ivoc_question_version_conflict'), { status: 409 });
          }
          if (detail.includes('ivoc_question_retired')) {
            throw Object.assign(new Error('ivoc_question_retired'), { status: 409 });
          }
          throw error;
        }
        await audit({ actor, action: 'question_governance_write', decision: 'allow', reason: `${write.status}:v${row.current_version}` });
        sendJson(response, request.method === 'POST' ? 201 : 200, { question: publicQuestion(row) }, mediaBase);
        return true;
      }

      if (request.method === 'POST' && pathname === `${API_PREFIX}/context`) {
        if (!contextEnabled) { sendError(response, 503, 'ivprep_unavailable', mediaBase); return true; }
        const input = await readJson(request);
        const question = context.question(safeText(input.questionId, 120) || 'CORE-01');
        if (input.action === 'prepare') {
          sendJson(response, 200, {
            schema: 'missionmed.ivoc.context.candidate.v1',
            state: 'READY',
            question,
            transcriptProvider: contextTranscriptEnabled ? 'SERVER_CONFIGURED' : 'UNAVAILABLE',
            persistence: { transcript: false, analysis: false, behaviorRegistry: false, coachCommand: false },
          }, mediaBase);
          return true;
        }
        if (input.action !== 'analyze') { sendError(response, 400, 'context_action_invalid', mediaBase); return true; }
        const sessionId = safeText(input.sessionId, 120);
        const recordingId = safeText(input.recordingId, 120);
        const answerId = safeText(input.answerId, 120);
        if (!/^[0-9a-f-]{36}$/u.test(sessionId) || !/^[0-9a-f-]{36}$/u.test(recordingId) || !answerId) {
          sendError(response, 400, 'context_identity_invalid', mediaBase); return true;
        }
        const sessionRow = await db.single(`ivoc_sessions?id=eq.${sessionId}&select=*&limit=1`);
        const recording = await db.single(`ivoc_recordings?id=eq.${recordingId}&select=*&limit=1`);
        if (
          !sessionRow
          || !recording
          || sessionRow.owner_subject !== actor
          || recording.owner_subject !== actor
          || recording.session_id !== sessionId
          || recording.status !== 'saved'
        ) {
          sendError(response, 404, 'not_found', mediaBase); return true;
        }
        let audio = null;
        try {
          if (contextTranscriptEnabled) {
            const upstream = await media.fetchObject(recording.storage_object_key, { method: 'GET' });
            const declaredBytes = Number(upstream?.headers?.get?.('content-length'));
            if (!upstream?.ok || (Number.isFinite(declaredBytes) && declaredBytes > MAX_CONTEXT_AUDIO_BYTES)) {
              sendError(response, 409, 'context_recording_unavailable', mediaBase); return true;
            }
            audio = Buffer.from(await upstream.arrayBuffer());
            if (!audio.length || audio.length > MAX_CONTEXT_AUDIO_BYTES) {
              audio.fill(0);
              sendError(response, 409, 'context_recording_unavailable', mediaBase); return true;
            }
          }
          const result = await context.analyze({
            sessionId,
            answerId,
            questionId: question.questionId,
            analyticsEvents: Array.isArray(input.analyticsEvents) ? input.analyticsEvents : [],
            audio,
            mimeType: recording.mime_type || 'video/webm',
            transcriptEnabled: contextTranscriptEnabled,
          });
          const persistence = await persistContextSpine({ db, actor, sessionRow, recording, result, nowMs: now() });
          if (persistence.transcript) {
            await audit({ actor, owner: actor, sessionId, recordingId, action: 'context_persist', decision: 'allow', reason: persistence.analysis ? 'transcript_and_analysis' : 'transcript_only' });
          }
          sendJson(response, 200, { ...result, persistence: { ...result.persistence, ...persistence } }, mediaBase);
          return true;
        } finally {
          audio?.fill?.(0);
        }
      }

      if (request.method === 'POST' && pathname === `${API_PREFIX}/sessions`) {
        const input = await readJson(request);
        const row = await db.insert('ivoc_sessions', {
          owner_subject: actor, owner_display_name: displayName(hqSession),
          title: safeText(input.title, 200) || 'IV Prep practice session',
          session_type: ['question', 'quick', 'mock'].includes(input.sessionType) ? input.sessionType : 'question',
          question_id: safeText(input.questionId, 120) || null,
          question_text: safeText(input.questionText, 1000) || null,
          interviewer_provider: safeText(input.interviewerProvider, 80) || 'missionmed-static',
          analytics_schema: input.analyticsSchema === 'ivoc.analytics.v1' ? input.analyticsSchema : 'ivoc.analytics.v1',
          recording_enabled: input.recordingEnabled !== false,
          calibration_snapshot: input.calibration && typeof input.calibration === 'object' ? input.calibration : {},
          context: input.context && typeof input.context === 'object' ? input.context : {},
        });
        try {
          await appIntelligence.prepareSession({ actor, sessionRow: row });
        } catch (error) {
          await db.update(`ivoc_sessions?id=eq.${row.id}&owner_subject=eq.${encodeURIComponent(actor)}&select=*`, { state: 'error' }).catch(() => null);
          await audit({ actor, owner: actor, sessionId: row.id, action: 'session_create', decision: 'deny', reason: 'context_pack_failed' });
          throw error;
        }
        await audit({ actor, owner: actor, sessionId: row.id, action: 'session_create', decision: 'allow', reason: 'owner' });
        sendJson(response, 201, publicSession(row), mediaBase); return true;
      }

      let match = pathname.match(/^\/api\/ivoc\/v1\/sessions\/([0-9a-f-]{36})\/abandon$/u);
      if (request.method === 'POST' && match) {
        const sessionId = match[1];
        const sessionRow = await db.single(`ivoc_sessions?id=eq.${sessionId}&select=*&limit=1`);
        if (!sessionRow || sessionRow.owner_subject !== actor) {
          await audit({ actor, sessionId, action: 'session_abandon', decision: 'deny', reason: 'not_owner' });
          sendError(response, 404, 'not_found', mediaBase); return true;
        }
        const input = await readJson(request);
        const reason = ['pagehide', 'owner_cleanup', 'client_exit'].includes(input.reason)
          ? input.reason
          : 'owner_abandon';
        const endedAt = new Date(now()).toISOString();
        const startedAtMs = Date.parse(sessionRow.started_at);
        const durationMs = Number.isFinite(startedAtMs) ? Math.max(0, now() - startedAtMs) : null;
        const abandoned = ['active', 'processing'].includes(sessionRow.state)
          ? await db.update(
            `ivoc_sessions?id=eq.${sessionId}&owner_subject=eq.${encodeURIComponent(actor)}&state=in.(active,processing)&select=*`,
            { state: 'abandoned', ended_at: endedAt, ...(durationMs == null ? {} : { duration_ms: durationMs }) },
          )
          : null;
        const recording = await db.single(
          `ivoc_recordings?session_id=eq.${sessionId}&status=in.(pending,uploading)&select=*&limit=1`,
        );
        const failedRecording = recording
          ? await db.update(
            `ivoc_recordings?id=eq.${recording.id}&owner_subject=eq.${encodeURIComponent(actor)}&status=in.(pending,uploading)&select=*`,
            { status: 'error' },
          )
          : null;
        await audit({
          actor, owner: actor, sessionId, recordingId: recording?.id || null,
          action: 'session_abandon', decision: 'allow',
          reason: abandoned || sessionRow.state === 'abandoned' ? reason : `state_${sessionRow.state}`,
        });
        const finalSession = abandoned || sessionRow;
        sendJson(response, 200, {
          session: publicSession(finalSession, failedRecording),
          abandoned: finalSession.state === 'abandoned',
        }, mediaBase); return true;
      }

      match = pathname.match(/^\/api\/ivoc\/v1\/sessions\/([0-9a-f-]{36})\/spine$/u);
      if (request.method === 'POST' && match) {
        const sessionId = match[1];
        const sessionRow = await db.single(`ivoc_sessions?id=eq.${sessionId}&select=*&limit=1`);
        if (!sessionRow || sessionRow.owner_subject !== actor) {
          await audit({ actor, sessionId, action: 'spine_append', decision: 'deny', reason: 'not_owner' });
          sendError(response, 404, 'not_found', mediaBase); return true;
        }
        const input = await readJson(request);
        const session = assertSession(input.session);
        if (session.session_id !== sessionId || session.actor_id !== actor || session.subject_id !== actor) {
          sendError(response, 400, 'spine_identity_invalid', mediaBase); return true;
        }
        const events = boundedArray(input.events, 'spine_events', 512).map((event) => {
          assertTimelineEvent(event);
          if (event.session_id !== sessionId) throw Object.assign(new TypeError('spine_identity_invalid'), { status: 400 });
          return {
            event_id: event.event_id,
            session_id: sessionId,
            seq: contractInteger(event.seq, 'spine_event_seq'),
            schema_version: 1,
            source: event.source,
            event_type: event.type,
            t_wall: contractTimestamp(event.t_wall, 'spine_event_wall_time'),
            t_media_ms: contractInteger(event.t_media_ms, 'spine_event_media_time', -1),
            reliability: event.reliability,
            availability: event.availability,
            idempotency_key: event.idempotency_key || null,
            payload: event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload) ? event.payload : {},
          };
        });
        const turns = boundedArray(input.turns, 'spine_turns', 128).map((turn) => {
          assertConversationTurn(turn);
          if (turn.session_id !== sessionId) throw Object.assign(new TypeError('spine_identity_invalid'), { status: 400 });
          return {
            turn_id: turn.turn_id,
            session_id: sessionId,
            parent_turn_id: turn.parent_turn_id || null,
            schema_version: 1,
            speaker: turn.speaker,
            relation: turn.relation,
            t_start_ms: Math.trunc(turn.t_start_ms),
            t_end_ms: turn.t_end_ms === undefined ? null : Math.trunc(turn.t_end_ms),
            transcript: turn.transcript,
            question: turn.question,
            semantic: turn.semantic,
            interrupted: turn.interrupted || null,
            version: turn.version,
          };
        });
        const segments = boundedArray(input.segments, 'spine_segments', 128).map((segment) => {
          assertAnswerSegment(segment);
          if (segment.session_id !== sessionId || segment.subject_id !== actor) {
            throw Object.assign(new TypeError('spine_identity_invalid'), { status: 400 });
          }
          return {
            segment_id: segment.segment_id,
            session_id: sessionId,
            subject_id: actor,
            schema_version: 1,
            transcript_ref: segment.transcript_ref,
            media_ref: segment.media_ref,
            question: segment.question,
            answer: segment.answer,
            coaching_notes_refs: segment.coaching_notes_refs,
            scoring: segment.scoring || null,
            strongest_marker: segment.strongest_marker || null,
            version: segment.version,
          };
        });
        const evidence = boundedArray(input.evidence, 'spine_evidence', 128).map((item) => {
          assertCoachingEvidence(item);
          if (item.session_id !== sessionId || item.subject_id !== actor) {
            throw Object.assign(new TypeError('spine_identity_invalid'), { status: 400 });
          }
          return {
            evidence_id: item.evidence_id,
            session_id: sessionId,
            subject_id: actor,
            schema_version: 1,
            dimension: item.dimension,
            refs: item.refs,
            interpretation: item.interpretation,
            score: item.score || null,
            confidence: item.confidence ?? null,
            limitations: item.limitations || [],
            version: item.version,
          };
        });
        const contextReceipts = await readSessionContextReceipts(db, sessionId);
        await db.upsert('ivoc_session_contracts', 'session_id', {
          session_id: sessionId,
          schema_version: 1,
          actor_subject: actor,
          role_context: session.role_context,
          practice_goal: session.practice_goal,
          pressure_modifier: session.pressure_modifier,
          transport_profile: session.transport_profile,
          environment: session.environment,
          selection_policy: session.selection_policy,
          follow_up_intensity: session.follow_up_intensity,
          target_asked_count: session.target_asked_count ?? null,
          target_duration_s: session.target_duration_s ?? null,
          interviewer_config_ref: session.interviewer_config_ref,
          question_pool_ref: session.question_pool_ref,
          analytics_config_version: session.analytics_config_version,
          contract_state: session.state,
          state_version: session.state_version,
          clock: session.clock,
          context_receipts: contextReceipts,
        });
        if (events.length) await db.insertMany('ivoc_timeline_events', events);
        if (turns.length) await db.insertMany('ivoc_conversation_turns', turns);
        if (segments.length) await db.insertMany('ivoc_answer_segments', segments);
        if (evidence.length) await db.insertMany('ivoc_coaching_evidence', evidence);
        await audit({ actor, owner: actor, sessionId, action: 'spine_append', decision: 'allow', reason: 'owner' });
        sendJson(response, 202, {
          sessionId,
          accepted: { events: events.length, turns: turns.length, segments: segments.length, evidence: evidence.length },
        }, mediaBase); return true;
      }

      match = pathname.match(/^\/api\/ivoc\/v1\/sessions\/([0-9a-f-]{36})\/recordings$/u);
      if (request.method === 'POST' && match) {
        const sessionId = match[1];
        const sessionRow = await db.single(`ivoc_sessions?id=eq.${sessionId}&select=*&limit=1`);
        if (!sessionRow || sessionRow.owner_subject !== actor) { await audit({ actor, sessionId, action: 'recording_create', decision: 'deny', reason: 'not_owner' }); sendError(response, 404, 'not_found', mediaBase); return true; }
        const input = await readJson(request);
        const recordingId = randomUUID();
        const mime = safeText(input.mime, 120) || 'video/webm';
        const upload = await media.createUpload({ ownerSubject: actor, recordingId, extension: extensionForMime(mime), mime });
        const row = await db.insert('ivoc_recordings', {
          id: recordingId, session_id: sessionId, owner_subject: actor, storage_object_key: upload.objectKey,
          status: 'uploading', mime_type: mime, etag: upload.uploadState,
        });
        sendJson(response, 201, {
          ...publicRecording(row),
          uploadUrl: `${API_PREFIX}/recordings/${recordingId}/media`,
          uploadToken: upload.uploadToken,
          uploadExpiresAt: upload.expiresAt,
          uploadExpiresAtMs: upload.tokenExpiresAtMs,
        }, mediaBase); return true;
      }

      match = pathname.match(/^\/api\/ivoc\/v1\/recordings\/([0-9a-f-]{36})\/media$/u);
      if (request.method === 'PUT' && match) {
        const recordingId = match[1];
        const row = await db.single(`ivoc_recordings?id=eq.${recordingId}&select=*&limit=1`);
        if (!row || row.owner_subject !== actor) { await audit({ actor, recordingId, action: 'recording_media_upload', decision: 'deny', reason: 'not_owner' }); sendError(response, 404, 'not_found', mediaBase); return true; }
        const expiresAtMs = Number(request.headers['x-ivoc-upload-expires']);
        const tokenValid = media.validateUploadToken({ recordingId, objectKey: row.storage_object_key, expiresAtMs, uploadToken: request.headers['x-ivoc-upload-token'] });
        if (!tokenValid) { sendError(response, 403, 'recording_upload_token_invalid', mediaBase); return true; }

        const part = Number(url.searchParams.get('part'));
        const parts = Number(url.searchParams.get('parts'));
        const range = String(request.headers['content-range'] || '').match(/^bytes (\d+)-(\d+)\/(\d+)$/u);
        if (!Number.isSafeInteger(part) || !Number.isSafeInteger(parts) || part < 1 || parts < 1 || part > parts || parts > 1_000 || !range) {
          sendError(response, 400, 'recording_chunk_contract_invalid', mediaBase); return true;
        }
        const start = Number(range[1]);
        const end = Number(range[2]);
        const total = Number(range[3]);
        const expectedBytes = end - start + 1;
        const contractStart = (part - 1) * MAX_MEDIA_CHUNK_BYTES;
        const contractEnd = Math.min(contractStart + MAX_MEDIA_CHUNK_BYTES, total) - 1;
        const contractParts = Math.ceil(total / MAX_MEDIA_CHUNK_BYTES);
        if (![start, end, total, expectedBytes].every(Number.isSafeInteger)
          || start < 0 || end < start || total <= end || expectedBytes > MAX_MEDIA_CHUNK_BYTES
          || start !== contractStart || end !== contractEnd || parts !== contractParts) {
          sendError(response, 400, 'recording_chunk_range_invalid', mediaBase); return true;
        }
        const chunk = await readMediaChunk(request);
        try {
          if (chunk.length !== expectedBytes) { sendError(response, 400, 'recording_chunk_length_invalid', mediaBase); return true; }
          const uploaded = await media.uploadPart({
            objectKey: row.storage_object_key, uploadState: row.etag, part, parts, body: chunk,
          });
          await db.update(`ivoc_recordings?id=eq.${recordingId}&owner_subject=eq.${encodeURIComponent(actor)}&status=eq.uploading&select=*`, {
            etag: uploaded.uploadState,
          });
          await audit({ actor, owner: actor, sessionId: row.session_id, recordingId, action: 'recording_media_upload', decision: 'allow', reason: `part_${part}_of_${parts}` });
          response.writeHead(204, securityHeaders(mediaBase)); response.end(); return true;
        } finally { chunk.fill(0); }
      }

      match = pathname.match(/^\/api\/ivoc\/v1\/recordings\/([0-9a-f-]{36})\/seal$/u);
      if (request.method === 'POST' && match) {
        const recordingId = match[1];
        const row = await db.single(`ivoc_recordings?id=eq.${recordingId}&select=*&limit=1`);
        if (!row || row.owner_subject !== actor) { await audit({ actor, recordingId, action: 'recording_seal', decision: 'deny', reason: 'not_owner' }); sendError(response, 404, 'not_found', mediaBase); return true; }
        const input = await readJson(request);
        const tokenValid = media.validateUploadToken({ recordingId, objectKey: row.storage_object_key, expiresAtMs: Number(input.uploadExpiresAtMs), uploadToken: input.uploadToken });
        if (!tokenValid) { sendError(response, 403, 'recording_upload_token_invalid', mediaBase); return true; }
        const completed = await media.completeUpload({ objectKey: row.storage_object_key, uploadState: row.etag });
        if (requireHead && !(await media.verifyObject(row.storage_object_key))) { sendError(response, 409, 'recording_media_not_confirmed', mediaBase); return true; }
        const saved = await db.update(`ivoc_recordings?id=eq.${recordingId}&owner_subject=eq.${encodeURIComponent(actor)}&select=*`, {
          status: 'saved', size_bytes: Math.max(0, Math.trunc(Number(input.sizeBytes) || 0)),
          duration_ms: Math.max(0, Math.trunc(Number(input.durationMs) || 0)), mime_type: safeText(input.mime, 120) || row.mime_type,
          sealed_at: new Date(now()).toISOString(), paused_spans: Array.isArray(input.pausedSpans) ? input.pausedSpans : [], etag: completed.etag || null,
        });
        await audit({ actor, owner: actor, sessionId: row.session_id, recordingId, action: 'recording_seal', decision: 'allow', reason: requireHead ? 'head_confirmed' : 'signed_upload_completed' });
        sendJson(response, 200, { recording: publicRecording(saved) }, mediaBase); return true;
      }

      match = pathname.match(/^\/api\/ivoc\/v1\/sessions\/([0-9a-f-]{36})\/results$/u);
      if (request.method === 'POST' && match) {
        const sessionId = match[1];
        const sessionRow = await db.single(`ivoc_sessions?id=eq.${sessionId}&select=*&limit=1`);
        if (!sessionRow || sessionRow.owner_subject !== actor) { sendError(response, 404, 'not_found', mediaBase); return true; }
        const input = await readJson(request);
        if (input.schema !== 'ivoc.analytics.v1' || Number(input.schemaVersion) !== 1) { sendError(response, 400, 'analytics_schema_invalid', mediaBase); return true; }
        const providerTurns = liveConversationTurns(input.liveConversation, sessionId);
        const existing = await db.single(`ivoc_results?session_id=eq.${sessionId}&select=id&limit=1`);
        const summaryDurations = {
          sessionDurationMs: optionalDurationMs(input.sessionDurationMs),
          recordingDurationMs: optionalDurationMs(input.recordingDurationMs),
          playableDurationMs: optionalDurationMs(input.playableDurationMs ?? input.durationMs),
          activeAnsweringDurationMs: optionalDurationMs(input.activeAnsweringDurationMs),
          analyticsObservationDurationMs: optionalDurationMs(input.analyticsObservationDurationMs),
        };
        const payload = {
          owner_subject: actor,
          schema_name: input.schema,
          schema_version: 1,
          payload: input,
          summary: { scores: input.scores || {}, counters: input.counters || {}, durations: summaryDurations },
        };
        const result = existing
          ? await db.update(`ivoc_results?id=eq.${existing.id}&select=*`, payload)
          : await db.insert('ivoc_results', { session_id: sessionId, ...payload });
        for (const turn of providerTurns) await db.upsert('ivoc_conversation_turns', 'turn_id', turn);
        if (providerTurns.length) {
          await audit({ actor, owner: actor, sessionId, action: 'live_conversation_persist', decision: 'allow', reason: `${providerTurns.length}_provisional_turns` });
        }
        const durationMs = Math.max(0, Math.trunc(Number(input.playableDurationMs ?? input.durationMs ?? input.history?.at(-1)?.t * 1000) || 0));
        await db.update(`ivoc_sessions?id=eq.${sessionId}&owner_subject=eq.${encodeURIComponent(actor)}&select=*`, { state: 'saved', ended_at: new Date(now()).toISOString(), duration_ms: durationMs });
        sendJson(response, 200, { id: result.id, sessionId, schema: result.schema_name, schemaVersion: result.schema_version, liveConversationTurns: providerTurns.length }, mediaBase); return true;
      }

      match = pathname.match(/^\/api\/ivoc\/v1\/sessions\/([0-9a-f-]{36})\/review$/u);
      if (request.method === 'POST' && match) {
        const sessionId = match[1];
        const sessionRow = await db.single(`ivoc_sessions?id=eq.${sessionId}&select=*&limit=1`);
        const admin = isAdmin(hqSession, admission);
        const assigned = await db.single(`ivoc_reviews?session_id=eq.${sessionId}&mentor_subject=eq.${encodeURIComponent(actor)}&status=neq.revoked&select=*&limit=1`);
        if (!sessionRow || (!admin && (!isMentor(hqSession) || !assigned))) { await audit({ actor, owner: sessionRow?.owner_subject, sessionId, action: 'review_complete', decision: 'deny', reason: 'not_assigned' }); sendError(response, 404, 'not_found', mediaBase); return true; }
        const input = await readJson(request);
        const body = { status: 'reviewed', reviewed_at: new Date(now()).toISOString(), notes: Array.isArray(input.notes) ? input.notes.slice(0, 100) : [] };
        const row = assigned
          ? await db.update(`ivoc_reviews?id=eq.${assigned.id}&select=*`, body)
          : await db.insert('ivoc_reviews', { session_id: sessionId, owner_subject: sessionRow.owner_subject, mentor_subject: actor, assigned_by_subject: actor, ...body });
        await audit({ actor, owner: sessionRow.owner_subject, sessionId, action: 'review_complete', decision: 'allow', reason: admin ? 'admin' : 'assigned_mentor' });
        sendJson(response, 200, { sessionId, reviewStatus: row.status, reviewedAt: row.reviewed_at }, mediaBase); return true;
      }

      if (request.method === 'GET' && pathname === `${API_PREFIX}/library`) {
        const scope = url.searchParams.get('scope') || 'own';
        let rows;
        if (scope === 'all' && isAdmin(hqSession, admission)) rows = await db.request('ivoc_sessions?select=*&order=created_at.desc&limit=200');
        else if (scope === 'assigned' && (isMentor(hqSession) || isAdmin(hqSession, admission))) {
          const reviews = isAdmin(hqSession, admission)
            ? await db.request('ivoc_reviews?status=neq.revoked&select=session_id')
            : await db.request(`ivoc_reviews?mentor_subject=eq.${encodeURIComponent(actor)}&status=neq.revoked&select=session_id`);
          const ids = [...new Set(reviews.map((r) => r.session_id))];
          rows = ids.length ? await db.request(`ivoc_sessions?id=in.(${ids.join(',')})&select=*&order=created_at.desc&limit=200`) : [];
        } else rows = await db.request(`ivoc_sessions?owner_subject=eq.${encodeURIComponent(actor)}&select=*&order=created_at.desc&limit=200`);
        const ids = rows.map((r) => r.id);
        const recordings = ids.length ? await db.request(`ivoc_recordings?session_id=in.(${ids.join(',')})&select=*`) : [];
        const results = ids.length ? await db.request(`ivoc_results?session_id=in.(${ids.join(',')})&select=*`) : [];
        const reviews = ids.length ? await db.request(`ivoc_reviews?session_id=in.(${ids.join(',')})&status=neq.revoked&select=session_id,status,mentor_subject,reviewed_at,assigned_by_subject`) : [];
        sendJson(response, 200, { sessions: rows.map((row) => publicSession(row, recordings.find((x) => x.session_id === row.id), results.find((x) => x.session_id === row.id), reviews.find((x) => x.session_id === row.id))) }, mediaBase); return true;
      }

      match = pathname.match(/^\/api\/ivoc\/v1\/sessions\/([0-9a-f-]{36})$/u);
      if (request.method === 'GET' && match) {
        const row = await db.single(`ivoc_sessions?id=eq.${match[1]}&select=*&limit=1`);
        if (!(await canReadSession({ row, actor, session: hqSession, admission }))) { await audit({ actor, owner: row?.owner_subject, sessionId: match[1], action: 'session_read', decision: 'deny', reason: 'scope' }); sendError(response, 404, 'not_found', mediaBase); return true; }
        const recording = await db.single(`ivoc_recordings?session_id=eq.${row.id}&select=*&limit=1`);
        const result = await db.single(`ivoc_results?session_id=eq.${row.id}&select=*&limit=1`);
        const review = await db.single(`ivoc_reviews?session_id=eq.${row.id}&status=neq.revoked&select=status,reviewed_at&limit=1`);
        const spine = await readPublicSpine(db, row.id);
        await audit({ actor, owner: row.owner_subject, sessionId: row.id, action: 'session_read', decision: 'allow', reason: row.owner_subject === actor ? 'owner' : 'authorized_review' });
        sendJson(response, 200, publicSession(row, recording, result, review, spine), mediaBase); return true;
      }

      match = pathname.match(/^\/api\/ivoc\/v1\/recordings\/([0-9a-f-]{36})\/playback-url$/u);
      if (request.method === 'GET' && match) {
        const recording = await db.single(`ivoc_recordings?id=eq.${match[1]}&status=eq.saved&select=*&limit=1`);
        const sessionRow = recording ? await db.single(`ivoc_sessions?id=eq.${recording.session_id}&select=*&limit=1`) : null;
        if (!recording || !(await canReadSession({ row: sessionRow, actor, session: hqSession, admission }))) { await audit({ actor, owner: recording?.owner_subject, recordingId: match[1], action: 'recording_playback', decision: 'deny', reason: 'scope' }); sendError(response, 404, 'not_found', mediaBase); return true; }
        const disposition = url.searchParams.get('disposition') === 'attachment' ? 'attachment' : 'inline';
        const playback = media.createPlayback({ recordingId: recording.id, objectKey: recording.storage_object_key, disposition });
        await audit({ actor, owner: recording.owner_subject, sessionId: recording.session_id, recordingId: recording.id, action: 'recording_playback', decision: 'allow', reason: recording.owner_subject === actor ? 'owner' : 'authorized_review' });
        const playbackUrl = `${API_PREFIX}/recordings/${recording.id}/playback?token=${encodeURIComponent(playback.token)}&expires=${playback.expiresAtMs}&disposition=${playback.disposition}`;
        sendJson(response, 200, { recordingId: recording.id, url: playbackUrl, expiresAt: playback.expiresAt, disposition: playback.disposition }, mediaBase); return true;
      }

      match = pathname.match(/^\/api\/ivoc\/v1\/recordings\/([0-9a-f-]{36})\/playback$/u);
      if (['GET', 'HEAD'].includes(request.method) && match) {
        const recording = await db.single(`ivoc_recordings?id=eq.${match[1]}&status=eq.saved&select=*&limit=1`);
        const sessionRow = recording ? await db.single(`ivoc_sessions?id=eq.${recording.session_id}&select=*&limit=1`) : null;
        if (!recording || !(await canReadSession({ row: sessionRow, actor, session: hqSession, admission }))) { sendError(response, 404, 'not_found', mediaBase); return true; }
        const disposition = url.searchParams.get('disposition') === 'attachment' ? 'attachment' : 'inline';
        const tokenValid = media.validatePlaybackToken({
          recordingId: recording.id,
          objectKey: recording.storage_object_key,
          expiresAtMs: Number(url.searchParams.get('expires')),
          playbackToken: url.searchParams.get('token'),
          disposition,
        });
        if (!tokenValid) { sendError(response, 403, 'recording_playback_token_invalid', mediaBase); return true; }
        const upstream = await media.fetchObject(recording.storage_object_key, {
          method: request.method,
          range: safeText(request.headers.range, 160),
        });
        const headers = securityHeaders(mediaBase, {
          'Accept-Ranges': upstream.headers.get('accept-ranges') || 'bytes',
          'Content-Type': upstream.headers.get('content-type') || recording.mime_type || 'application/octet-stream',
          'Content-Disposition': `${disposition}; filename="iv-prep-recording.${extensionForMime(recording.mime_type)}"`,
          ...(upstream.headers.get('content-length') ? { 'Content-Length': upstream.headers.get('content-length') } : {}),
          ...(upstream.headers.get('content-range') ? { 'Content-Range': upstream.headers.get('content-range') } : {}),
          ...(upstream.headers.get('etag') ? { ETag: upstream.headers.get('etag') } : {}),
        });
        response.writeHead(upstream.status, headers);
        if (request.method === 'HEAD' || !upstream.body) response.end();
        else {
          for await (const chunk of upstream.body) response.write(Buffer.from(chunk));
          response.end();
        }
        return true;
      }

      if (request.method === 'GET' && pathname === `${API_PREFIX}/preferences`) {
        const row = await db.single(`ivoc_preferences?owner_subject=eq.${encodeURIComponent(actor)}&select=*&limit=1`);
        sendJson(response, 200, row ? { calibration: row.calibration, visibility: row.visibility, coachingEnabled: row.coaching_enabled, recordingDefault: row.recording_default } : null, mediaBase); return true;
      }
      if (request.method === 'PUT' && pathname === `${API_PREFIX}/preferences`) {
        const input = await readJson(request);
        const existing = await db.single(`ivoc_preferences?owner_subject=eq.${encodeURIComponent(actor)}&select=owner_subject&limit=1`);
        const body = { calibration: input.calibration && typeof input.calibration === 'object' ? input.calibration : {}, visibility: input.visibility && typeof input.visibility === 'object' ? input.visibility : {}, coaching_enabled: input.coachingEnabled !== false, recording_default: input.recordingDefault !== false };
        const row = existing ? await db.update(`ivoc_preferences?owner_subject=eq.${encodeURIComponent(actor)}&select=*`, body) : await db.insert('ivoc_preferences', { owner_subject: actor, ...body });
        sendJson(response, 200, { calibration: row.calibration, visibility: row.visibility, coachingEnabled: row.coaching_enabled, recordingDefault: row.recording_default }, mediaBase); return true;
      }

      sendError(response, 404, 'not_found', mediaBase); return true;
    } catch (error) {
      const status = Number(error?.status) || (error instanceof SyntaxError ? 400 : 500);
      const code = status >= 500 ? 'ivoc_internal_error' : safeText(error?.message, 100) || 'ivoc_request_failed';
      const requestId = randomUUID();
      console.error(JSON.stringify({ event: 'ivoc_request_error', requestId, path: pathname, code, detailHash: createHash('sha256').update(String(error?.detail || '')).digest('hex').slice(0, 16) }));
      sendJson(response, status, { error: code, requestId }, mediaBase); return true;
    }
  };
}

let defaultHandler = null;
export async function handleIvocRequest(input) {
  if (!defaultHandler) defaultHandler = createIvocHandler();
  return defaultHandler(input);
}
