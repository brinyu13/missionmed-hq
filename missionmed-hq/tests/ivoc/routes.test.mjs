import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import { createIvocHandler } from '../../ivoc/routes.mjs';

class ResponseCapture {
  writeHead(status, headers) { this.status = status; this.headers = headers; }
  write(body = '') { this.body = `${this.body || ''}${Buffer.from(body).toString()}`; return true; }
  end(body = '') { this.body = `${this.body || ''}${Buffer.from(body).toString()}`; }
  json() { return this.body ? JSON.parse(this.body) : null; }
}

function request(method = 'GET', body = null, headers = {}) {
  const stream = Readable.from(body == null ? [] : [Buffer.from(JSON.stringify(body))]);
  stream.method = method;
  stream.headers = headers;
  return stream;
}

function rawRequest(method, body, headers = {}) {
  const bytes = Buffer.from(body);
  const stream = Readable.from([bytes]);
  stream.method = method;
  stream.headers = { 'content-length': String(bytes.length), ...headers };
  return stream;
}

function session(id = 42, roles = ['student']) {
  return {
    version: 1, issuedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
    csrfToken: 'a'.repeat(24), authSource: 'wordpress-cookie',
    user: { id, roles, displayName: `Student ${id}`, login: `student${id}` },
  };
}

function registry() {
  return {
    refreshSubject: async () => {}, isRevoked: () => false,
    entitlementFor: (subject) => ({ subject, revision: 'test', expiresAtMs: Date.now() + 60_000, voice: true, video: true, founder: false }),
  };
}

function repository() {
  const inserts = [];
  const updates = [];
  const upserts = [];
  const batches = [];
  const rpcs = [];
  return {
    inserts, updates, upserts, batches, rpcs,
    single: async () => null,
    request: async (path) => path.startsWith('ivoc_sessions?owner_subject=eq.wp%3A42') ? [] : [],
    insert: async (table, body) => {
      inserts.push({ table, body });
      if (table === 'ivoc_sessions') return { id: '00000000-0000-4000-8000-000000000042', ...body, started_at: new Date().toISOString(), created_at: new Date().toISOString() };
      return { id: 1, ...body };
    },
    insertMany: async (table, body) => { batches.push({ table, body }); return body; },
    upsert: async (table, conflict, body) => { upserts.push({ table, conflict, body }); return body; },
    update: async (path, body) => { updates.push({ path, body }); return { ...body }; },
    rpc: async (name, body) => {
      rpcs.push({ name, body });
      if (name === 'ivoc_write_mentor_priorities') {
        return {
          subject_id: body.p_subject_id,
          version: body.p_expected_version + 1,
          priorities: body.p_priorities,
          mentor_notes: body.p_mentor_notes,
          set_by: body.p_actor,
          created_at: new Date().toISOString(),
        };
      }
      if (name === 'ivoc_write_admin_config') {
        return {
          version: body.p_expected_version + 1,
          schema_name: 'ivoc.admin_config.v1',
          analytics_config_version: body.p_analytics_config_version,
          brain_pack_version: body.p_brain_pack_version,
          ais_rules_version: body.p_ais_rules_version,
          pressure_defaults: body.p_pressure_defaults,
          proactive_budget_overrides: body.p_proactive_budget_overrides,
          credits: body.p_credits,
          change_reason: body.p_change_reason,
          changed_by: body.p_actor,
          created_at: new Date().toISOString(),
        };
      }
      if (name === 'ivoc_mutate_user_credits') {
        return {
          subject_id: body.p_subject_id,
          version: body.p_expected_version + 1,
          allowance_seconds: body.p_action === 'set_allowance' ? body.p_amount_seconds : 0,
          override_seconds: body.p_action === 'set_override' ? body.p_amount_seconds : 0,
          consumed_seconds: 0,
          balance_seconds: body.p_amount_seconds,
          period_started_at: new Date().toISOString(),
          period_ends_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
          updated_by: body.p_actor,
          updated_at: new Date().toISOString(),
          event_id: body.p_idempotency_key,
          event_action: body.p_action,
        };
      }
      if (name === 'ivoc_write_answer_asset') {
        return {
          asset_id: body.p_asset_id,
          version: body.p_expected_version + 1,
          schema_name: 'ivoc.answer_asset.v1',
          owner_subject: body.p_owner_subject,
          session_id: body.p_session_id,
          recording_id: body.p_recording_id,
          answer_segment_id: body.p_answer_segment_id,
          question_id: body.p_question_id,
          title: body.p_title,
          start_ms: body.p_start_ms,
          end_ms: body.p_end_ms,
          status: body.p_status,
          audiences: body.p_audiences,
          consent: body.p_consent,
          strongest_answer: body.p_strongest_answer,
          change_reason: body.p_change_reason,
          changed_by: body.p_actor,
          created_at: new Date().toISOString(),
        };
      }
      return {
        question_id: body.p_question_id, status: body.p_status,
        current_version: body.p_expected_version + 1,
        canonical_text: body.p_canonical_text, category: body.p_category,
        tags: body.p_tags, source: body.p_source, change_reason: body.p_change_reason,
        changed_by: body.p_actor, updated_at: new Date().toISOString(),
      };
    },
  };
}

function handler(repo = repository()) {
  return { repo, route: createIvocHandler({
    registry: registry(), repository: repo,
    storage: { createUpload: () => { throw new Error('not used'); }, validateUploadToken: () => false },
    env: { IVPREP_ENABLED: 'true', IVPREP_ADMIN_CANARY_ENABLED: 'true', MMHQ_SESSION_SECRET: 's'.repeat(64), MMHQ_CIE_BASE: 'https://media.test' },
  }) };
}

const foreignSessionId = '00000000-0000-4000-8000-000000000007';
const foreignRecordingId = '00000000-0000-4000-8000-000000000008';

function scopedRepository({ assigned = false } = {}) {
  const foreign = {
    id: foreignSessionId, owner_subject: 'wp:7', owner_display_name: 'Student 7',
    title: 'Foreign take', session_type: 'question', question_id: 'q1', question_text: 'Tell me about yourself.',
    state: 'saved', started_at: new Date().toISOString(), ended_at: new Date().toISOString(), duration_ms: 12_000,
    interviewer_provider: 'missionmed-static', created_at: new Date().toISOString(),
  };
  const recording = {
    id: foreignRecordingId, session_id: foreignSessionId, owner_subject: 'wp:7', status: 'saved',
    mime_type: 'video/webm', storage_object_key: 'private/never-return-this.webm', size_bytes: 1234,
    duration_ms: 12_000, paused_spans: [{ startMs: 4_000, endMs: 5_500 }],
    sealed_at: new Date().toISOString(), created_at: new Date().toISOString(),
  };
  return {
    single: async (path) => {
      if (path.startsWith(`ivoc_sessions?id=eq.${foreignSessionId}`)) return foreign;
      if (path.startsWith(`ivoc_recordings?session_id=eq.${foreignSessionId}`)) return recording;
      if (path.startsWith(`ivoc_reviews?session_id=eq.${foreignSessionId}`)) return assigned ? { id: 'review-1', status: 'assigned', mentor_subject: 'wp:42' } : null;
      return null;
    },
    request: async () => [],
    insert: async (table, body) => ({ id: 1, ...body }),
    update: async () => null,
  };
}

const base = {
  cookieFingerprint: 'f'.repeat(64), hqSessionMaxTtlSeconds: 28_800, expectedOrigin: 'https://hq.test',
};

test('anonymous API request fails closed', async () => {
  const { route } = handler();
  const response = new ResponseCapture();
  await route({ ...base, request: request('GET'), response, url: new URL('https://hq.test/api/ivoc/v1/bootstrap'), hqSession: null });
  assert.equal(response.status, 401);
  assert.equal(response.json().error, 'ivprep_authentication_required');
});

test('entitled owner bootstraps without exposing credentials', async () => {
  const { route } = handler();
  const response = new ResponseCapture();
  await route({ ...base, request: request('GET'), response, url: new URL('https://hq.test/api/ivoc/v1/bootstrap'), hqSession: session() });
  assert.equal(response.status, 200);
  assert.equal(response.json().identity.subject, 'wp:42');
  assert.equal(response.json().csrfToken, 'a'.repeat(24));
  assert.ok(!/service|secret|objectKey/u.test(response.body));
});

test('question catalog exposes active overrides to students and all lifecycle states to Admins', async () => {
  const repo = repository();
  repo.request = async (path) => {
    assert.match(path, /ivoc_question_catalog\?/u);
    if (path.includes('status=eq.active')) return [{
      question_id: 'CUSTOM-001', status: 'active', current_version: 1,
      canonical_text: 'What contribution are you proudest of?', category: 'Program Fit',
      tags: ['CUSTOM'], source: 'admin_custom', change_reason: 'Founder addition',
      changed_by: 'wp:1', updated_at: new Date().toISOString(),
    }];
    return [];
  };
  const { route } = handler(repo);
  const student = new ResponseCapture();
  await route({ ...base, request: request('GET'), response: student, url: new URL('https://hq.test/api/ivoc/v1/questions'), hqSession: session() });
  assert.equal(student.status, 200);
  assert.equal(student.json().questions[0].questionId, 'CUSTOM-001');
  assert.equal(student.json().admin, false);

  const admin = new ResponseCapture();
  await route({ ...base, request: request('GET'), response: admin, url: new URL('https://hq.test/api/ivoc/v1/questions'), hqSession: session(1, ['administrator']) });
  assert.equal(admin.status, 200);
  assert.equal(admin.json().admin, true);
});

test('question governance is Admin-only, version-checked, and actor-stamped server-side', async () => {
  const { route, repo } = handler();
  const input = {
    questionId: 'CUSTOM-001', expectedVersion: 0, status: 'active',
    canonicalText: 'What contribution are you proudest of?', category: 'Program Fit',
    tags: ['CUSTOM'], source: 'admin_custom', changeReason: 'Founder addition',
  };
  const denied = new ResponseCapture();
  await route({ ...base, request: request('POST', input, { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }), response: denied, url: new URL('https://hq.test/api/ivoc/v1/admin/questions'), hqSession: session() });
  assert.equal(denied.status, 403);
  assert.equal(repo.rpcs.length, 0);

  const allowed = new ResponseCapture();
  await route({ ...base, request: request('POST', input, { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }), response: allowed, url: new URL('https://hq.test/api/ivoc/v1/admin/questions'), hqSession: session(1, ['administrator']) });
  assert.equal(allowed.status, 201);
  assert.equal(allowed.json().question.version, 1);
  assert.deepEqual(repo.rpcs[0], {
    name: 'ivoc_write_question_version',
    body: {
      p_question_id: 'CUSTOM-001', p_expected_version: 0, p_status: 'active',
      p_canonical_text: input.canonicalText, p_category: input.category,
      p_tags: input.tags, p_source: input.source, p_change_reason: input.changeReason,
      p_actor: 'wp:1',
    },
  });
});

test('Mentor Top 3 is Admin-written, actor-stamped, and student reads hide mentor-only notes', async () => {
  const { route, repo } = handler();
  const input = {
    subjectId: 'wp:42', expectedVersion: 0,
    priorities: [{ id: 'leadership', text: 'Give one concrete example that shows your leadership.' }],
    mentorNotes: [
      { id: 'shared', text: 'Lead with the result.', visibility: 'shared' },
      { id: 'private', text: 'The student tends to bury the point.', visibility: 'mentor_only' },
    ],
  };
  const denied = new ResponseCapture();
  await route({ ...base, request: request('PUT', input, { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }), response: denied, url: new URL('https://hq.test/api/ivoc/v1/admin/mentor-priorities'), hqSession: session() });
  assert.equal(denied.status, 403);

  const allowed = new ResponseCapture();
  await route({ ...base, request: request('PUT', input, { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }), response: allowed, url: new URL('https://hq.test/api/ivoc/v1/admin/mentor-priorities'), hqSession: session(1, ['administrator']) });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.json().version, 1);
  assert.deepEqual(repo.rpcs.at(-1), {
    name: 'ivoc_write_mentor_priorities',
    body: {
      p_subject_id: 'wp:42', p_expected_version: 0,
      p_priorities: [{ id: 'leadership', text: input.priorities[0].text, rank: 1 }],
      p_mentor_notes: input.mentorNotes,
      p_actor: 'wp:1',
    },
  });

  repo.single = async (path) => path.startsWith('ivoc_mentor_priority_sets?subject_id=eq.wp%3A42')
    ? {
      subject_id: 'wp:42', version: 1, priorities: repo.rpcs.at(-1).body.p_priorities,
      mentor_notes: input.mentorNotes, set_by: 'wp:1', created_at: new Date().toISOString(),
    } : null;
  const studentRead = new ResponseCapture();
  await route({ ...base, request: request('GET'), response: studentRead, url: new URL('https://hq.test/api/ivoc/v1/mentor-priorities'), hqSession: session() });
  assert.equal(studentRead.status, 200);
  assert.deepEqual(studentRead.json().mentorNotes.map((note) => note.id), ['shared']);
});

test('versioned Analytics and InterviewBrain config is Admin-only and actor-stamped', async () => {
  const { route, repo } = handler();
  const input = {
    expectedVersion: 1,
    analyticsConfigVersion: 'ivoc.analytics.v1',
    brainPackVersion: 'gpt-live-1:marin',
    aisRulesVersion: '2026-09-18.1',
    pressureDefaults: {
      defaultFollowUpIntensity: 1, defaultPressureEnabled: false, maxFollowUpsPerAnswer: 2,
    },
    proactiveBudgetOverrides: {
      maxProactivePerSession: 3, maxReactivePerAnswer: 1, maxApplicationProbesPerAnswer: 1,
    },
    credits: { defaultAllowanceSeconds: 0, maxOverrideSeconds: 36_000, resetPeriodDays: 30 },
    changeReason: 'Bounded config write test',
  };
  const denied = new ResponseCapture();
  await route({ ...base, request: request('PUT', input, { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }), response: denied, url: new URL('https://hq.test/api/ivoc/v1/admin/config'), hqSession: session() });
  assert.equal(denied.status, 403);

  const allowed = new ResponseCapture();
  await route({ ...base, request: request('PUT', input, { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }), response: allowed, url: new URL('https://hq.test/api/ivoc/v1/admin/config'), hqSession: session(1, ['administrator']) });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.json().version, 2);
  assert.equal(allowed.json().changedBy, 'wp:1');
  assert.deepEqual(repo.rpcs.at(-1), {
    name: 'ivoc_write_admin_config',
    body: {
      p_expected_version: 1,
      p_analytics_config_version: 'ivoc.analytics.v1',
      p_brain_pack_version: 'gpt-live-1:marin',
      p_ais_rules_version: '2026-09-18.1',
      p_pressure_defaults: { default_follow_up_intensity: 1, default_pressure_enabled: false, max_follow_ups_per_answer: 2 },
      p_proactive_budget_overrides: { max_proactive_per_session: 3, max_reactive_per_answer: 1, max_application_probes_per_answer: 1 },
      p_credits: { default_allowance_seconds: 0, max_override_seconds: 36_000, reset_period_days: 30 },
      p_change_reason: 'Bounded config write test',
      p_actor: 'wp:1',
    },
  });
});

test('provider-neutral embodiment contract is Admin-only and keeps external providers inactive', async () => {
  const { route } = handler();
  const denied = new ResponseCapture();
  await route({
    ...base, request: request('GET'), response: denied,
    url: new URL('https://hq.test/api/ivoc/v1/admin/embodiment'), hqSession: session(),
  });
  assert.equal(denied.status, 403);

  const allowed = new ResponseCapture();
  await route({
    ...base, request: request('GET'), response: allowed,
    url: new URL('https://hq.test/api/ivoc/v1/admin/embodiment'), hqSession: session(1, ['administrator']),
  });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.json().schema, 'missionmed.ivoc.embodiment.v1');
  assert.equal(allowed.json().profiles.length, 12);
  assert.equal(allowed.json().runtime.directorAuthority, 'missionmed-interviewbrain');
  assert.equal(allowed.json().runtime.providerRole, 'actor-only');
  assert.equal(allowed.json().runtime.providerSelectionExposedToStudent, false);
  assert.equal(allowed.json().adminPolicy.providers.lemonSlice, 'deferred');
  assert.equal(allowed.json().adminPolicy.activation.externalSpendAllowed, false);
});

test('per-user credits are owner-readable and Admin mutations are versioned, idempotent, and actor-stamped', async () => {
  const { route, repo } = handler();
  repo.single = async (path) => {
    if (path.startsWith('ivoc_credit_accounts?subject_id=eq.wp%3A42')) {
      return {
        subject_id: 'wp:42', version: 3, allowance_seconds: 900,
        override_seconds: 120, consumed_seconds: 300, balance_seconds: 720,
        period_started_at: '2026-09-20T00:00:00.000Z', period_ends_at: '2026-10-20T00:00:00.000Z',
        updated_by: 'wp:1', updated_at: '2026-09-20T00:00:00.000Z',
      };
    }
    return null;
  };
  const ownerRead = new ResponseCapture();
  await route({ ...base, request: request('GET'), response: ownerRead, url: new URL('https://hq.test/api/ivoc/v1/credits'), hqSession: session() });
  assert.equal(ownerRead.status, 200);
  assert.equal(ownerRead.json().account.balanceSeconds, 720);
  assert.equal(ownerRead.json().account.subjectId, 'wp:42');

  const input = {
    subjectId: 'wp:42', expectedVersion: 3, action: 'set_override', amountSeconds: 180,
    idempotencyKey: 'f401da3f-c517-4cee-9a60-1e8133c3a1cc', reason: 'Bounded Admin override test',
  };
  const denied = new ResponseCapture();
  await route({ ...base, request: request('PUT', input, { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }), response: denied, url: new URL('https://hq.test/api/ivoc/v1/admin/credits'), hqSession: session() });
  assert.equal(denied.status, 403);

  const allowed = new ResponseCapture();
  await route({ ...base, request: request('PUT', input, { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }), response: allowed, url: new URL('https://hq.test/api/ivoc/v1/admin/credits'), hqSession: session(1, ['administrator']) });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.json().account.version, 4);
  assert.deepEqual(repo.rpcs.at(-1), {
    name: 'ivoc_mutate_user_credits',
    body: {
      p_subject_id: 'wp:42', p_expected_version: 3, p_action: 'set_override',
      p_amount_seconds: 180, p_idempotency_key: input.idempotencyKey,
      p_reason: input.reason, p_actor: 'wp:1',
    },
  });
});

test('credit consumption is not exposed as a browser-owned Admin mutation', async () => {
  const { route, repo } = handler();
  const response = new ResponseCapture();
  await route({
    ...base,
    request: request('PUT', {
      subjectId: 'wp:42', expectedVersion: 0, action: 'consume', amountSeconds: 60,
      idempotencyKey: '0f28e0fb-2a51-441c-b866-2fe4a443e643', reason: 'Browser consume attempt',
    }, { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }),
    response, url: new URL('https://hq.test/api/ivoc/v1/admin/credits'), hqSession: session(1, ['administrator']),
  });
  assert.equal(response.status, 400);
  assert.equal(repo.rpcs.length, 0);
});

test('owner creates a bounded private AnswerAsset without exposing recording storage identity', async () => {
  const { route, repo } = handler();
  const sessionId = '00000000-0000-4000-8000-000000000142';
  const recordingId = '00000000-0000-4000-8000-000000000143';
  const segmentId = `segment:${sessionId}:primary`;
  repo.single = async (path) => {
    if (path.startsWith(`ivoc_sessions?id=eq.${sessionId}&owner_subject=eq.wp%3A42`)) {
      return { id: sessionId, owner_subject: 'wp:42', question_id: 'CORE-01' };
    }
    if (path.startsWith(`ivoc_recordings?id=eq.${recordingId}&owner_subject=eq.wp%3A42`)) {
      return { id: recordingId, session_id: sessionId, owner_subject: 'wp:42', duration_ms: 12_000 };
    }
    if (path.startsWith(`ivoc_answer_segments?segment_id=eq.${encodeURIComponent(segmentId)}`)) {
      return {
        segment_id: segmentId, session_id: sessionId, subject_id: 'wp:42',
        question: { canonical_question_id: 'CORE-01' },
        answer: { t_start_ms: 1_000, t_end_ms: 10_000 }, media_ref: `recording:${recordingId}`,
      };
    }
    return null;
  };
  const input = {
    expectedVersion: 0, sessionId, recordingId, answerSegmentId: segmentId,
    questionId: 'CORE-01', title: 'Leadership answer', startMs: 1_500, endMs: 8_500,
    status: 'private', audiences: ['student'],
    consent: { granted: false, scope: 'bounded_clip', grantedAt: null },
    strongestAnswer: true, changeReason: 'Save private answer clip',
  };
  const response = new ResponseCapture();
  await route({
    ...base,
    request: request('POST', input, { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }),
    response, url: new URL('https://hq.test/api/ivoc/v1/answer-assets'), hqSession: session(),
  });
  assert.equal(response.status, 201);
  assert.equal(response.json().asset.ownerSubject, 'wp:42');
  assert.equal(response.json().asset.status, 'private');
  assert.doesNotMatch(response.body, /storage_object_key|never-return/u);
  assert.equal(repo.rpcs.at(-1).name, 'ivoc_write_answer_asset');
  assert.equal(repo.rpcs.at(-1).body.p_actor, 'wp:42');
  assert.deepEqual(repo.rpcs.at(-1).body.p_audiences, ['student']);
});

test('Match Bridge Ready is rejected without bounded owner consent', async () => {
  const { route, repo } = handler();
  const response = new ResponseCapture();
  await route({
    ...base,
    request: request('POST', {
      expectedVersion: 0,
      sessionId: '00000000-0000-4000-8000-000000000142',
      recordingId: '00000000-0000-4000-8000-000000000143',
      answerSegmentId: 'segment:00000000-0000-4000-8000-000000000142:primary',
      questionId: 'CORE-01', title: 'Unconsented clip', startMs: 1_500, endMs: 8_500,
      status: 'match_bridge_ready', audiences: ['student', 'match_bridge'],
      consent: { granted: false, scope: 'bounded_clip', grantedAt: null },
      strongestAnswer: false, changeReason: 'Invalid promotion attempt',
    }, { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }),
    response, url: new URL('https://hq.test/api/ivoc/v1/answer-assets'), hqSession: session(),
  });
  assert.equal(response.status, 400);
  assert.equal(repo.rpcs.length, 0);
});

test('session creation requires same-origin CSRF and persists server identity', async () => {
  const { route, repo } = handler();
  const denied = new ResponseCapture();
  await route({ ...base, request: request('POST', { title: 'Take' }, { origin: 'https://hq.test' }), response: denied, url: new URL('https://hq.test/api/ivoc/v1/sessions'), hqSession: session() });
  assert.equal(denied.status, 403);

  const allowed = new ResponseCapture();
  await route({ ...base, request: request('POST', { title: 'Take', sessionType: 'question' }, { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }), response: allowed, url: new URL('https://hq.test/api/ivoc/v1/sessions'), hqSession: session() });
  assert.equal(allowed.status, 201);
  assert.equal(repo.inserts.find((row) => row.table === 'ivoc_sessions').body.owner_subject, 'wp:42');
  const contextPack = repo.upserts.find((row) => row.table === 'ivoc_context_packs');
  const contract = repo.upserts.find((row) => row.table === 'ivoc_session_contracts');
  assert.equal(contextPack.body.owner_subject, 'wp:42');
  assert.deepEqual(contextPack.body.pack.facts, []);
  assert.match(contract.body.context_receipts[0], /^ctxpack:/u);
  assert.doesNotMatch(allowed.body, /actor_block|source_receipts|"facts"/u);
});

test('owner can abandon an interrupted session without exposing private recording identity', async () => {
  const repo = repository();
  const sessionId = '00000000-0000-4000-8000-000000000042';
  const recordingId = '00000000-0000-4000-8000-000000000043';
  const nowMs = Date.now();
  repo.single = async (path) => {
    if (path.startsWith(`ivoc_sessions?id=eq.${sessionId}`)) {
      return {
        id: sessionId, owner_subject: 'wp:42', title: 'Interrupted take',
        session_type: 'question', state: 'active',
        started_at: new Date(nowMs - 12_000).toISOString(), interviewer_provider: 'missionmed-static',
      };
    }
    if (path.startsWith(`ivoc_recordings?session_id=eq.${sessionId}`)) {
      return {
        id: recordingId, session_id: sessionId, owner_subject: 'wp:42',
        status: 'uploading', storage_object_key: 'private/never-return.webm',
      };
    }
    return null;
  };
  const route = createIvocHandler({
    registry: registry(), repository: repo,
    storage: { createUpload: () => { throw new Error('not used'); }, validateUploadToken: () => false },
    now: () => nowMs,
    env: { IVPREP_ENABLED: 'true', IVPREP_ADMIN_CANARY_ENABLED: 'true', MMHQ_SESSION_SECRET: 's'.repeat(64) },
  });
  const response = new ResponseCapture();
  await route({
    ...base,
    request: request('POST', { reason: 'owner_cleanup' }, {
      origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24),
    }),
    response,
    url: new URL(`https://hq.test/api/ivoc/v1/sessions/${sessionId}/abandon`),
    hqSession: session(),
  });
  assert.equal(response.status, 200);
  assert.equal(response.json().abandoned, true);
  assert.equal(response.json().session.state, 'abandoned');
  assert.equal(response.json().session.durationMs, 12_000);
  assert.equal(response.json().session.recording.status, 'error');
  assert.doesNotMatch(response.body, /storage_object_key|never-return/u);
  assert.ok(repo.updates.some((entry) => entry.body.state === 'abandoned'));
  assert.ok(repo.updates.some((entry) => entry.body.status === 'error'));
  assert.equal(repo.inserts.find((entry) => entry.table === 'ivoc_access_log').body.action, 'session_abandon');
});

test('a student cannot abandon another student session', async () => {
  const repo = scopedRepository();
  const { route } = handler(repo);
  const response = new ResponseCapture();
  await route({
    ...base,
    request: request('POST', { reason: 'owner_cleanup' }, {
      origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24),
    }),
    response,
    url: new URL(`https://hq.test/api/ivoc/v1/sessions/${foreignSessionId}/abandon`),
    hqSession: session(),
  });
  assert.equal(response.status, 404);
  assert.equal(response.json().error, 'not_found');
});

test('owner can append a contract-validated M1 spine without changing server identity', async () => {
  const repo = repository();
  const sessionId = '00000000-0000-4000-8000-000000000042';
  repo.single = async (path) => {
    if (path.startsWith(`ivoc_sessions?id=eq.${sessionId}`)) return { id: sessionId, owner_subject: 'wp:42' };
    if (path.startsWith(`ivoc_session_contracts?session_id=eq.${sessionId}`)) {
      return { context_receipts: ['ctxpack:server-pack@server-version'] };
    }
    return null;
  };
  const { route } = handler(repo);
  const response = new ResponseCapture();
  const body = {
    session: {
      session_id: sessionId, schema_version: '1', actor_id: 'wp:42', subject_id: 'wp:42',
      role_context: 'student', practice_goal: 'guided_mock', pressure_modifier: false,
      transport_profile: 'none', environment: 'missionmed', selection_policy: 'system',
      follow_up_intensity: 1, target_asked_count: 3, target_duration_s: 300,
      interviewer_config_ref: 'interviewer:prompted:v1', question_pool_ref: 'pool:student:v1',
      analytics_config_version: 'analytics:m1', state: 'live', state_version: 1,
      clock: { origin: 'capture_owner', started_at_wall: '2026-09-16T16:00:00.000Z' },
      context_receipts: ['ctxpack:forged-browser@forged-version'], created_at: '2026-09-16T16:00:00.000Z', updated_at: '2026-09-16T16:00:00.000Z',
    },
    events: [{
      event_id: 'event:m1:1', session_id: sessionId, schema_version: '1', seq: 1,
      source: 'client.analytics', type: 'analytics.signal', t_wall: '2026-09-16T16:00:01.000Z',
      t_media_ms: 1000, reliability: 'measured', availability: 'ok', idempotency_key: 'm1:1',
      payload: { signal: 'voice.rms', value: 0.2 },
    }],
    turns: [{
      turn_id: 'turn:m1:1', session_id: sessionId, schema_version: '1', speaker: 'student', relation: 'answer',
      t_start_ms: 1000, t_end_ms: 4000, transcript: { text: 'Synthetic canary.' },
      question: { origin: 'pool' }, semantic: {}, version: 1,
    }],
    segments: [{
      segment_id: 'segment:m1:1', session_id: sessionId, subject_id: 'wp:42', schema_version: '1',
      transcript_ref: 'transcript:m1:1', media_ref: 'recording:m1:1',
      question: { origin: 'pool', text: 'Synthetic?', asked_turn_id: 'turn:q1', t_asked_ms: 0 },
      answer: { t_start_ms: 1000, t_end_ms: 4000, turn_ids: ['turn:m1:1'], follow_up_turn_ids: [] },
      coaching_notes_refs: [], version: 1,
    }],
    evidence: [{
      evidence_id: 'evidence:m1:1', session_id: sessionId, subject_id: 'wp:42', schema_version: '1',
      dimension: 'voice.pacing', refs: [{ kind: 'event', ref: 'event:m1:1' }],
      interpretation: { text: 'Synthetic canary only.', by: 'ai_draft' }, limitations: ['Synthetic.'], version: 1,
    }],
  };
  await route({
    ...base,
    request: request('POST', body, { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }),
    response,
    url: new URL(`https://hq.test/api/ivoc/v1/sessions/${sessionId}/spine`),
    hqSession: session(),
  });
  assert.equal(response.status, 202);
  assert.deepEqual(response.json().accepted, { events: 1, turns: 1, segments: 1, evidence: 1 });
  assert.equal(repo.upserts[0].body.actor_subject, 'wp:42');
  assert.deepEqual(repo.upserts[0].body.context_receipts, ['ctxpack:server-pack@server-version']);
  assert.deepEqual(repo.batches.map((entry) => entry.table), [
    'ivoc_timeline_events', 'ivoc_conversation_turns', 'ivoc_answer_segments', 'ivoc_coaching_evidence',
  ]);
  assert.equal(repo.batches[0].body[0].session_id, sessionId);
});

test('M1 spine rejects client identity drift before persistence', async () => {
  const repo = repository();
  const sessionId = '00000000-0000-4000-8000-000000000042';
  repo.single = async () => ({ id: sessionId, owner_subject: 'wp:42' });
  const { route } = handler(repo);
  const response = new ResponseCapture();
  await route({
    ...base,
    request: request('POST', {
      session: {
        session_id: sessionId, schema_version: '1', actor_id: 'wp:7', subject_id: 'wp:7',
        role_context: 'student', practice_goal: 'guided_mock', pressure_modifier: false,
        transport_profile: 'none', environment: 'missionmed', selection_policy: 'system', follow_up_intensity: 1,
        interviewer_config_ref: 'interviewer:prompted:v1', question_pool_ref: 'pool:student:v1',
        analytics_config_version: 'analytics:m1', state: 'live', state_version: 1,
        clock: { origin: 'capture_owner', started_at_wall: '2026-09-16T16:00:00.000Z' },
        context_receipts: [], created_at: '2026-09-16T16:00:00.000Z', updated_at: '2026-09-16T16:00:00.000Z',
      },
      events: [], turns: [], segments: [], evidence: [],
    }, { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }),
    response,
    url: new URL(`https://hq.test/api/ivoc/v1/sessions/${sessionId}/spine`),
    hqSession: session(),
  });
  assert.equal(response.status, 400);
  assert.equal(response.json().error, 'spine_identity_invalid');
  assert.equal(repo.upserts.length, 0);
  assert.equal(repo.batches.length, 0);
});

test('results preserve explicit duration vocabulary while the library duration follows playable media', async () => {
  const repo = repository();
  const sessionId = '00000000-0000-4000-8000-000000000042';
  repo.single = async (path) => {
    if (path.startsWith(`ivoc_sessions?id=eq.${sessionId}`)) return { id: sessionId, owner_subject: 'wp:42' };
    if (path.startsWith(`ivoc_results?session_id=eq.${sessionId}`)) return null;
    return null;
  };
  const { route } = handler(repo);
  const response = new ResponseCapture();
  const resultEnvelope = {
    schema: 'ivoc.analytics.v1', schemaVersion: 1,
    durationMs: 25_000, sessionDurationMs: 41_000, recordingDurationMs: 25_000,
    playableDurationMs: 24_500, activeAnsweringDurationMs: 18_000,
    analyticsObservationDurationMs: 39_500,
    recordingStartSessionMs: 8_000,
    pausedSpans: [{ startMs: 11_000, endMs: 13_000 }],
    scores: { pace: 7.4, volume: 7.8, variety: 8.1 }, counters: { gestures: 4 }, history: [],
    liveConversation: {
      schema: 'ivoc.live-conversation.v1', provider: 'openai-gpt-live', clock: 'recording-observed',
      turns: [
        { id: 'response-1', speaker: 'interviewer', startMs: 0, endMs: 1_200, text: 'Tell me about yourself.', final: true, providerEventType: 'session.output_transcript.done' },
        { id: 'item-1', speaker: 'student', startMs: 1_500, endMs: 8_000, text: 'I value careful listening.', final: true, providerEventType: 'session.input_transcript.done' },
        { id: 'response-2', speaker: 'interviewer', startMs: 8_300, endMs: 9_100, text: 'How did that change your work?', final: true, providerEventType: 'session.output_transcript.done' },
      ],
    },
    audioAuthority: {
      schema: 'ivoc.audio-authority.v1', mode: 'single', authority: 'openai-gpt-live-native',
      events: [
        { state: 'configured', observedAtMs: 0 },
        { state: 'bound', observedAtMs: 120 },
        { state: 'released', observedAtMs: 24_500 },
      ],
    },
  };
  await route({
    ...base,
    request: request('POST', resultEnvelope, { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }),
    response,
    url: new URL(`https://hq.test/api/ivoc/v1/sessions/${sessionId}/results`),
    hqSession: session(),
  });
  assert.equal(response.status, 200);
  const resultInsert = repo.inserts.find((entry) => entry.table === 'ivoc_results');
  assert.deepEqual(resultInsert.body.summary.durations, {
    sessionDurationMs: 41_000,
    recordingDurationMs: 25_000,
    playableDurationMs: 24_500,
    activeAnsweringDurationMs: 18_000,
    analyticsObservationDurationMs: 39_500,
  });
  assert.equal(resultInsert.body.payload.recordingStartSessionMs, 8_000);
  assert.deepEqual(resultInsert.body.payload.pausedSpans, [{ startMs: 11_000, endMs: 13_000 }]);
  const liveTurns = repo.upserts.filter((entry) => entry.table === 'ivoc_conversation_turns').map((entry) => entry.body);
  assert.deepEqual(liveTurns.map((turn) => [turn.speaker, turn.relation]), [
    ['interviewer', 'opening'], ['student', 'answer'], ['interviewer', 'follow_up'],
  ]);
  assert.equal(liveTurns[0].transcript.text, 'Tell me about yourself.');
  assert.match(liveTurns[0].transcript.provisional_ref, /^provider:gpt-live-1:/u);
  assert.equal(Object.hasOwn(liveTurns[0].transcript, 'canonical_ref'), false);
  assert.equal(response.json().liveConversationTurns, 3);
  assert.equal(response.json().audioAuthorityVerified, true);
  assert.equal(resultInsert.body.payload.audioAuthority.mode, 'single');
  const sessionUpdate = repo.updates.find((entry) => entry.path.startsWith(`ivoc_sessions?id=eq.${sessionId}`));
  assert.equal(sessionUpdate.body.duration_ms, 24_500);
});

test('Answer History library projects question-bound transcript and semantic evidence summaries', async () => {
  const repo = repository();
  const sessionId = '00000000-0000-4000-8000-000000000042';
  repo.request = async (path) => {
    if (path.startsWith('ivoc_sessions?owner_subject=eq.wp%3A42')) return [{
      id: sessionId, owner_subject: 'wp:42', title: 'Opening answer', session_type: 'question',
      question_id: 'CORE-01', question_text: 'Tell me about yourself.', state: 'saved',
      started_at: '2026-09-20T12:00:00.000Z', ended_at: '2026-09-20T12:01:00.000Z',
      duration_ms: 60_000, interviewer_provider: 'openai-gpt-live',
    }];
    if (path.startsWith('ivoc_recordings?')) return [];
    if (path.startsWith('ivoc_results?')) return [];
    if (path.startsWith('ivoc_reviews?')) return [];
    if (path.startsWith('ivoc_answer_segments?')) return [
      { session_id: sessionId, transcript_ref: `transcript:${sessionId}` },
    ];
    if (path.startsWith('ivoc_coaching_evidence?')) return [
      { session_id: sessionId, dimension: 'semantic.supported_claim' },
      { session_id: sessionId, dimension: 'voice.pacing' },
    ];
    return [];
  };
  const { route } = handler(repo);
  const response = new ResponseCapture();
  await route({ ...base, request: request('GET'), response, url: new URL('https://hq.test/api/ivoc/v1/library?scope=own'), hqSession: session() });
  assert.equal(response.status, 200);
  assert.deepEqual(response.json().sessions[0].answerHistory, {
    transcriptAvailable: true,
    answerSegmentCount: 1,
    supportedObservationCount: 1,
    dimensions: ['semantic.supported_claim'],
  });
});

test('results reject multiple bound provider audio tracks instead of accepting split authority', async () => {
  const repo = repository();
  const sessionId = '00000000-0000-4000-8000-000000000042';
  repo.single = async (path) => path.startsWith(`ivoc_sessions?id=eq.${sessionId}`)
    ? { id: sessionId, owner_subject: 'wp:42' }
    : null;
  const { route } = handler(repo);
  const response = new ResponseCapture();
  await route({
    ...base,
    request: request('POST', {
      schema: 'ivoc.analytics.v1', schemaVersion: 1, durationMs: 1_000,
      audioAuthority: {
        schema: 'ivoc.audio-authority.v1', mode: 'single', authority: 'openai-gpt-live-native',
        events: [
          { state: 'configured', observedAtMs: 0 },
          { state: 'bound', observedAtMs: 10 },
          { state: 'bound', observedAtMs: 20 },
        ],
      },
    }, { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }),
    response,
    url: new URL(`https://hq.test/api/ivoc/v1/sessions/${sessionId}/results`),
    hqSession: session(),
  });
  assert.equal(response.status, 400);
  assert.equal(repo.inserts.some((entry) => entry.table === 'ivoc_results'), false);
});

test('student cannot read another student session', async () => {
  const { route } = handler(scopedRepository());
  const response = new ResponseCapture();
  await route({ ...base, request: request('GET'), response, url: new URL(`https://hq.test/api/ivoc/v1/sessions/${foreignSessionId}`), hqSession: session() });
  assert.equal(response.status, 404);
  assert.equal(response.json().error, 'not_found');
});

test('assigned mentor can read results without receiving the private object key', async () => {
  const { route } = handler(scopedRepository({ assigned: true }));
  const response = new ResponseCapture();
  await route({ ...base, request: request('GET'), response, url: new URL(`https://hq.test/api/ivoc/v1/sessions/${foreignSessionId}`), hqSession: session(42, ['mentor']) });
  assert.equal(response.status, 200);
  assert.equal(response.json().recording.id, foreignRecordingId);
  assert.equal(response.json().ownerDisplayName, 'Student 7');
  assert.deepEqual(response.json().recording.pausedSpans, [{ startMs: 4_000, endMs: 5_500 }]);
  assert.equal(response.json().reviewStatus, 'assigned');
  assert.doesNotMatch(response.body, /storage_object_key|never-return-this/u);
});

test('authorized session read returns only the private persisted transcript spine projection', async () => {
  // Readback is deliberately projected and never carries the storage object key.
  const repo = scopedRepository({ assigned: true });
  repo.request = async (path) => {
    if (path.startsWith('ivoc_conversation_turns?')) return [{
      turn_id: 'turn:1', speaker: 'student', relation: 'answer', t_start_ms: 1200, t_end_ms: 3400,
      transcript: { canonical_ref: 'transcript:1#seg-1', text: 'A private answer.' }, question: {}, semantic: {}, version: 1,
    }];
    if (path.startsWith('ivoc_answer_segments?')) return [{
      segment_id: 'segment:1', transcript_ref: 'transcript:1', media_ref: `recording:${foreignRecordingId}`,
      question: {}, answer: { t_start_ms: 1200, t_end_ms: 3400 }, coaching_notes_refs: [], version: 1,
    }];
    if (path.startsWith('ivoc_coaching_evidence?')) return [];
    return [];
  };
  const { route } = handler(repo);
  const response = new ResponseCapture();
  await route({ ...base, request: request('GET'), response, url: new URL(`https://hq.test/api/ivoc/v1/sessions/${foreignSessionId}`), hqSession: session(42, ['mentor']) });
  assert.equal(response.status, 200);
  assert.equal(response.json().spine.turns[0].transcript.text, 'A private answer.');
  assert.equal(response.json().spine.turns[0].startMs, 1200);
  assert.doesNotMatch(response.body, /storage_object_key|never-return-this/u);
});

test('administrator can read any session without receiving the private object key', async () => {
  const { route } = handler(scopedRepository());
  const response = new ResponseCapture();
  await route({ ...base, request: request('GET'), response, url: new URL(`https://hq.test/api/ivoc/v1/sessions/${foreignSessionId}`), hqSession: session(42, ['administrator']) });
  assert.equal(response.status, 200);
  assert.doesNotMatch(response.body, /storage_object_key|never-return-this/u);
});

test('authenticated UI response carries camera, microphone, and font policy', async () => {
  const { route } = handler();
  const response = new ResponseCapture();
  await route({ ...base, request: request('HEAD'), response, url: new URL('https://hq.test/iv-prep-analytics/'), hqSession: session() });
  assert.equal(response.status, 200);
  assert.match(response.headers['Permissions-Policy'], /camera=\(self\).*microphone=\(self\)/u);
  assert.match(response.headers['Content-Security-Policy'], /fonts\.googleapis\.com.*fonts\.gstatic\.com/u);
});

test('authenticated UI serves the frozen design tokens and arena art with exact MIME types', async () => {
  const { route } = handler();
  const tokens = new ResponseCapture();
  await route({ ...base, request: request('HEAD'), response: tokens, url: new URL('https://hq.test/iv-prep-analytics/styles/tokens.css'), hqSession: session() });
  assert.equal(tokens.status, 200);
  assert.equal(tokens.headers['Content-Type'], 'text/css; charset=utf-8');

  const arena = new ResponseCapture();
  await route({ ...base, request: request('HEAD'), response: arena, url: new URL('https://hq.test/iv-prep-analytics/assets/arena-world-day.jpg'), hqSession: session() });
  assert.equal(arena.status, 200);
  assert.equal(arena.headers['Content-Type'], 'image/jpeg');

  const scanner = new ResponseCapture();
  await route({ ...base, request: request('HEAD'), response: scanner, url: new URL('https://hq.test/iv-prep-analytics/assets/founder-face-scanner.png'), hqSession: session() });
  assert.equal(scanner.status, 200);
  assert.equal(scanner.headers['Content-Type'], 'image/png');
});

test('recording media upload is same-origin proxied without exposing the private object key', async () => {
  const recordingId = '00000000-0000-4000-8000-000000000099';
  const bytes = Buffer.from('private-media-bytes');
  const recording = {
    id: recordingId, session_id: foreignSessionId, owner_subject: 'wp:42', status: 'uploading',
    storage_object_key: 'ivoc/recordings/wp_42/ivoc_private.webm', mime_type: 'video/webm', etag: 'opaque-upload-state', created_at: new Date().toISOString(),
  };
  const repo = repository();
  repo.single = async (path) => path.startsWith(`ivoc_recordings?id=eq.${recordingId}`) ? recording : null;
  const uploaded = [];
  const route = createIvocHandler({
    registry: registry(), repository: repo,
    storage: {
      createUpload: () => { throw new Error('not used'); },
      validateUploadToken: ({ recordingId: id, uploadToken, expiresAtMs }) => id === recordingId && uploadToken === 'opaque-token' && expiresAtMs > Date.now(),
      uploadPart: async (input) => { uploaded.push({ ...input, body: Buffer.from(input.body) }); return { etag: '"part-etag"', uploadState: 'next-opaque-upload-state' }; },
    },
    env: { IVPREP_ENABLED: 'true', IVPREP_ADMIN_CANARY_ENABLED: 'true', MMHQ_SESSION_SECRET: 's'.repeat(64), MMHQ_CIE_BASE: 'https://media.test' },
  });
  const response = new ResponseCapture();
  const expiresAtMs = Date.now() + 60_000;
  await route({
    ...base,
    request: rawRequest('PUT', bytes, {
      origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24),
      'x-ivoc-upload-token': 'opaque-token', 'x-ivoc-upload-expires': String(expiresAtMs),
      'content-type': 'application/octet-stream', 'content-range': `bytes 0-${bytes.length - 1}/${bytes.length}`,
    }),
    response,
    url: new URL(`https://hq.test/api/ivoc/v1/recordings/${recordingId}/media?part=1&parts=1`),
    hqSession: session(),
  });
  assert.equal(response.status, 204);
  assert.equal(uploaded.length, 1);
  assert.equal(uploaded[0].part, 1);
  assert.equal(uploaded[0].parts, 1);
  assert.equal(uploaded[0].body.toString(), bytes.toString());
  assert.equal(repo.updates.at(-1).body.etag, 'next-opaque-upload-state');
  assert.doesNotMatch(response.body || '', /storage_object_key|dboc-iv/u);
});

test('authorized playback remains same-origin and never returns the private object key', async () => {
  const repo = scopedRepository({ assigned: true });
  repo.single = async (path) => {
    if (path.startsWith(`ivoc_recordings?id=eq.${foreignRecordingId}`)) return {
      id: foreignRecordingId, session_id: foreignSessionId, owner_subject: 'wp:7', status: 'saved',
      mime_type: 'video/webm', storage_object_key: 'ivoc/recordings/private/never-return.webm',
    };
    if (path.startsWith(`ivoc_sessions?id=eq.${foreignSessionId}`)) return {
      id: foreignSessionId, owner_subject: 'wp:7', title: 'Foreign take', state: 'saved',
    };
    if (path.startsWith(`ivoc_reviews?session_id=eq.${foreignSessionId}`)) return { id: 'review-1', status: 'assigned', mentor_subject: 'wp:42' };
    return null;
  };
  const storage = {
    createPlayback: () => ({ token: 'opaque-playback-token', expiresAt: '2027-01-15T09:10:00.000Z', expiresAtMs: 1_800_000_600_000, disposition: 'inline' }),
    validatePlaybackToken: ({ playbackToken }) => playbackToken === 'opaque-playback-token',
    fetchObject: async () => new Response('private-media', { headers: { 'Content-Type': 'video/webm', ETag: 'private-etag' } }),
  };
  const route = createIvocHandler({
    registry: registry(), repository: repo, storage,
    env: { IVPREP_ENABLED: 'true', IVPREP_ADMIN_CANARY_ENABLED: 'true', MMHQ_SESSION_SECRET: 's'.repeat(64) },
  });
  const linkResponse = new ResponseCapture();
  await route({
    ...base, request: request('GET'), response: linkResponse,
    url: new URL(`https://hq.test/api/ivoc/v1/recordings/${foreignRecordingId}/playback-url`),
    hqSession: session(42, ['mentor']),
  });
  assert.equal(linkResponse.status, 200);
  assert.match(linkResponse.json().url, new RegExp(`^/api/ivoc/v1/recordings/${foreignRecordingId}/playback\\?`, 'u'));
  assert.doesNotMatch(linkResponse.body, /storage_object_key|never-return|cloudflarestorage/u);

  const mediaResponse = new ResponseCapture();
  await route({
    ...base, request: request('GET'), response: mediaResponse,
    url: new URL(`https://hq.test/api/ivoc/v1/recordings/${foreignRecordingId}/playback?token=opaque-playback-token&expires=1800000600000&disposition=inline`),
    hqSession: session(42, ['mentor']),
  });
  assert.equal(mediaResponse.status, 200);
  assert.equal(mediaResponse.body, 'private-media');
  assert.equal(mediaResponse.headers['Content-Type'], 'video/webm');
});
