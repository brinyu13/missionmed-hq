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

test('session preference validation precedes storage and cannot become hidden pressure or evidence', async () => {
  const repo = repository(); const { route } = handler(repo);
  const call = async context => {
    const response = new ResponseCapture();
    await route({ ...base, request: request('POST', { sessionType: 'mock', context }, {
      origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24),
    }), response, url: new URL('https://hq.test/api/ivoc/v1/sessions'), hqSession: session() });
    return response;
  };
  for (const practiceFocus of [null, 7, {}, 'a'.repeat(501), 'a\nb', 'a\u200bb']) {
    assert.equal((await call({ goal: 'Guided Mock IV Practice', practiceFocus })).status, 400);
  }
  assert.equal(repo.inserts.length, 0);
  assert.equal((await call({ goal: 'Guided Mock IV Practice', practiceFocus: '  Explain the impact  ' })).status, 201);
  const guided = repo.inserts.find(row => row.table === 'ivoc_sessions').body;
  assert.equal(guided.context.practiceFocus, 'Explain the impact');
  assert.equal(guided.owner_subject, 'wp:42');
  assert.equal(guided.context.promptReceipt, undefined);
  assert.equal((await call({ goal: 'Individual Question', pressurePractice: true, practiceFocus: 'stale focus' })).status, 201);
  const individual = repo.inserts.filter(row => row.table === 'ivoc_sessions').at(-1).body;
  assert.equal(individual.context.practiceFocus, undefined);
  assert.equal(individual.context.pressurePractice, false);
});

test('typed follow-up preferences are bounded before persistence and cannot grant an Admin ceiling',async()=>{
  const repo=repository();const{route}=handler(repo);
  repo.single=async path=>path.startsWith('ivoc_admin_config_versions?')?{schema_name:'ivoc.admin_config.v1',version:3,pressure_defaults:{max_follow_ups_per_answer:1,default_follow_up_intensity:1,default_pressure_enabled:false}}:null;
  const call=async context=>{const response=new ResponseCapture();await route({...base,request:request('POST',{sessionType:'mock',context},{origin:'https://hq.test','sec-fetch-site':'same-origin','x-mmhq-csrf':'a'.repeat(24)}),response,url:new URL('https://hq.test/api/ivoc/v1/sessions'),hqSession:session()});return response;};
  for(const context of [{followUpDepth:1},{followUpDepth:'1',maxFollowUps:4,interviewPolicyVersion:3},{followUpDepth:3,maxFollowUps:4,interviewPolicyVersion:3},{followUpDepth:1,maxFollowUps:9,interviewPolicyVersion:3},{followUpDepth:1,maxFollowUps:4,interviewPolicyVersion:0}]){
    const response=await call(context);assert.equal(response.status,400);assert.equal(response.json().error,'invalid_follow_up_settings');
  }
  assert.equal(repo.inserts.length,0);
  const stale=await call({followUpDepth:1,maxFollowUps:4,interviewPolicyVersion:2});assert.equal(stale.status,409);assert.equal(stale.json().error,'ivoc_interview_policy_changed');assert.equal(repo.inserts.length,0);
  assert.equal((await call({goal:'Full IV Simulation',followUpDepth:2,maxFollowUps:4,interviewPolicyVersion:3,interviewPolicy:{maxFollowUpsPerAnswer:99}})).status,201);
  const context=repo.inserts.find(row=>row.table==='ivoc_sessions').body.context;
  assert.equal(context.followUpDepth,1);assert.equal(context.maxFollowUps,4);assert.equal(context.interviewPolicyVersion,3);assert.equal(context.interviewPolicy,undefined);
});

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

test('server transcript read is session-authorized, cold-readable and rechecks owner/mentor/admission custody', async () => {
  const sid = foreignSessionId;
  const oid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const root = { observation_id: oid, seq: 1, session_id: sid, owner_subject: 'wp:7',
    provider_session_id: 'private_provider_identity', kind: 'attached', speaker: null, provider_event_id: null,
    fragment_text: null, provider_start_ms: null, provider_end_ms: null, server_received_at: '2026-10-02T04:00:00Z',
    terminal_status: null, terminal_reason: null };
  const records = [root, { ...root, seq: 2, kind: 'fragment', speaker: 'input',
    fragment_text: 'Private  exact transcript.', provider_start_ms: 100, provider_end_ms: 200 },
  { ...root, seq: 3, kind: 'terminal', terminal_status: 'PROVIDER_CLOSED', terminal_reason: 'provider_closed' }];
  for (const scenario of ['owner', 'admin', 'assigned', 'foreign', 'revoked', 'owner_changed', 'admission_changed']) {
    let reads = 0, assigned = true, row = { id: sid, owner_subject: 'wp:7', state: 'saved', interviewer_provider: 'openai-gpt-live' };
    let refreshes = 0;
    const reg = registry(); reg.refreshSubject = async () => { refreshes++; };
    reg.isRevoked = () => scenario === 'admission_changed' && refreshes > 1;
    const repo = repository();
    repo.single = async path => {
      if (path.startsWith('ivoc_sessions?')) return { ...row };
      if (path.includes('mentor_subject=')) return assigned ? { id: 'review-1' } : null;
      return null;
    };
    repo.request = async path => {
      if (!path.startsWith('ivoc_live_transcript_events?')) return [];
      reads++; assert.match(path, /owner_subject=eq.wp%3A7/);
      if (scenario === 'revoked') assigned = false;
      if (scenario === 'owner_changed') row = { ...row, owner_subject: 'wp:8' };
      if (path.includes('kind=eq.attached')) return [root];
      if (path.includes('order=seq.desc')) return [{ seq: 3 }];
      return records;
    };
    const route = createIvocHandler({ repository: repo, registry: reg, storage: {},
      env: { IVPREP_ENABLED: 'true', IVPREP_ADMIN_CANARY_ENABLED: 'true', MMHQ_SESSION_SECRET: 's'.repeat(64) } });
    const response = new ResponseCapture();
    const roles = scenario === 'admin' ? ['administrator'] : ['assigned', 'revoked'].includes(scenario) ? ['mentor'] : ['student'];
    await route({ ...base, request: request('GET'), response, url: new URL(`https://hq.test/api/ivoc/v1/sessions/${sid}`),
      hqSession: session(['owner', 'owner_changed', 'admission_changed'].includes(scenario) ? 7 : 42, roles) });
    const allowed = ['owner', 'admin', 'assigned'].includes(scenario);
    assert.equal(response.status, allowed ? 200 : 404, scenario);
    if (allowed) {
      assert.equal(response.json().liveTranscript.status, 'AVAILABLE');
      assert.equal(response.json().liveTranscript.observations[0].fragments[0].text, 'Private  exact transcript.');
      assert.equal(response.json().analysisAvailability.status, 'UNAVAILABLE');
      assert.doesNotMatch(response.body, /private_provider_identity|bbbbbbbb|canonical_ref/);
    } else assert.doesNotMatch(response.body, /Private  exact transcript/);
    if (scenario === 'foreign') assert.equal(reads, 0);
    assert.equal(repo.updates.length + repo.upserts.length + repo.batches.length, 0);
  }
});

function candidateCaptureHarness() {
  const repo = repository();
  const sid = '00000000-0000-4000-8000-000000000042';
  const pid = '00000000-0000-4000-8000-000000000043';
  const ownedSession = { id: sid, owner_subject: 'wp:42', state: 'active' };
  const rows = [{ id: pid, session_id: sid, owner_subject: 'wp:42', status: 'uploading', recording_role: 'conversation' }];
  let storageCompletions = 0;
  repo.single = async path => {
    if (path.startsWith(`ivoc_sessions?id=eq.${sid}`)) return ownedSession;
    if (path.startsWith('ivoc_recordings?id=eq.')) return rows.find(r => path.startsWith(`ivoc_recordings?id=eq.${r.id}&`)) || null;
    if (path.startsWith(`ivoc_recordings?parent_recording_id=eq.${pid}`)) return rows.find(r => r.parent_recording_id === pid) || null;
    if (path.startsWith(`ivoc_recordings?session_id=eq.${sid}`)) return rows.find(r => r.recording_role === 'conversation') || null;
    return null;
  };
  repo.insert = async (table, body) => { repo.inserts.push({ table, body }); if (table === 'ivoc_recordings') rows.push(body); return body; };
  repo.update = async (path, body) => { repo.updates.push({ path, body }); const row = await repo.single(path); Object.assign(row, body); return row; };
  const route = createIvocHandler({ registry: registry(), repository: repo, candidateAudioCaptureEnabled: true, storage: {
    createUpload: async ({ recordingId }) => ({ objectKey: `private/${recordingId}`, uploadState: 'pending-multipart', uploadToken: 'test-only-token', tokenExpiresAtMs: 12345 }),
    validateUploadToken: () => true, completeUpload: async () => { storageCompletions++; return { etag: 'sealed-etag' }; }, verifyObject: async () => true,
    renewUpload: () => ({ uploadToken: 'fresh-test-token', tokenExpiresAtMs: 12346 }),
    inspectObject: async () => ({ sizeBytes: 1234, mime: 'audio/webm;codecs=opus', etag: 'sealed-etag' }),
  }, env: { IVPREP_ENABLED: 'true', IVPREP_ADMIN_CANARY_ENABLED: 'true', MMHQ_SESSION_SECRET: 's'.repeat(64), MMHQ_CIE_BASE: 'https://media.test' } });
  const invoke = async (path, body, { method = 'POST', roles = ['student'], actorId = 42, csrf = true } = {}) => {
    const response = new ResponseCapture();
    await route({ ...base, request: request(method, body, csrf ? { origin: 'https://hq.test', 'x-mmhq-csrf': 'a'.repeat(24) } : {}), response,
      url: new URL(`https://hq.test/api/ivoc/v1/${path}`), hqSession: session(actorId, roles) });
    return response;
  };
  return { repo, rows, sid, pid, ownedSession, invoke, completions: () => storageCompletions,
    allocate: () => invoke(`sessions/${sid}/candidate-audio`, { parentRecordingId: pid, captureVersion: 'direct-mic-v1', mime: 'audio/webm;codecs=opus', owner_subject: 'wp:7', analysisEligibility: 'VERIFIED' }),
  };
}

test('candidate capture is server-bound, one per owned parent, and cannot replace replay', async () => {
  const h = candidateCaptureHarness();
  const created = await h.allocate();
  assert.equal(created.status, 201);
  const child = created.json();
  assert.equal(child.recordingRole, 'candidate_audio');
  assert.equal(child.parentRecordingId, h.pid);
  assert.equal(child.captureReceipt.analysisEligibility, 'UNVERIFIED');
  assert.equal(h.rows[1].owner_subject, 'wp:42');
  assert.doesNotMatch(created.body, /private\/|pending-multipart/);
  const recovered = await h.allocate();
  assert.equal(recovered.status, 200);
  assert.equal(recovered.json().id, child.id);
  assert.equal(recovered.json().uploadToken, 'fresh-test-token');
  assert.equal(h.rows.length, 2);
  for (const suffix of ['playback-url', 'playback']) {
    assert.equal((await h.invoke(`recordings/${child.id}/${suffix}`, null, { method: 'GET' })).status, 404);
  }
  const detail = await h.invoke(`sessions/${h.sid}`, null, { method: 'GET' });
  assert.equal(detail.json().recording.id, h.pid);
});

test('candidate allocation denies foreign actors, inactive parents, bad contracts and missing CSRF before storage', async () => {
  for (const scenario of ['foreign', 'inactive', 'child-parent', 'bad-mime', 'csrf']) {
    const h = candidateCaptureHarness();
    if (scenario === 'inactive') h.ownedSession.state = 'saved';
    if (scenario === 'child-parent') h.rows[0].recording_role = 'candidate_audio';
    const response = await h.invoke(`sessions/${h.sid}/candidate-audio`, { parentRecordingId: h.pid, captureVersion: 'direct-mic-v1', mime: scenario === 'bad-mime' ? 'video/webm' : 'audio/webm' },
      { actorId: scenario === 'foreign' ? 7 : 42, csrf: scenario !== 'csrf' });
    assert.ok([400, 403, 404].includes(response.status), scenario);
    assert.equal(h.rows.length, 1);
  }
});

test('candidate seal validates clock before storage and cannot overwrite a sealed receipt on retry', async () => {
  const h = candidateCaptureHarness();
  const child = (await h.allocate()).json();
  const body = { mime: 'audio/webm;codecs=opus', sizeBytes: 1234, durationMs: 1000,
    captureTiming: { recordingStartSessionMs: 140, recordingDurationMs: 1000, playableDurationMs: null, pausedSpans: [] } };
  assert.equal((await h.invoke(`recordings/${child.id}/seal`, { ...body, captureTiming: null })).status, 400);
  assert.equal(h.completions(), 0);
  const sealed = await h.invoke(`recordings/${child.id}/seal`, body);
  assert.equal(sealed.status, 200);
  assert.equal(sealed.json().recording.captureReceipt.status, 'SEALED');
  assert.equal(sealed.json().recording.captureReceipt.analysisEligibility, 'UNVERIFIED');
  assert.equal(h.completions(), 1);
  const retried = await h.invoke(`recordings/${child.id}/seal`, { ...body, sizeBytes: 9999, durationMs: 9000 });
  assert.equal(retried.status, 200);
  assert.equal(retried.json().recording.sizeBytes, 1234);
  assert.equal(h.completions(), 1);
  const rewritten = await h.invoke(`recordings/${child.id}/media`, {}, { method: 'PUT' });
  assert.equal(rewritten.status, 409);
});

test('status-only review preserves stored notes without replaying stale note content', async () => {
  const repo = repository();
  const stored = { id: 'review-1', status: 'assigned', notes: ['Existing mentor note'] };
  repo.single = async (path) => path.startsWith('ivoc_sessions?')
    ? { id: foreignSessionId, owner_subject: 'wp:7' }
    : path.startsWith('ivoc_reviews?') ? { ...stored } : null;
  repo.update = async (path, body) => {
    repo.updates.push({ path, body });
    stored.notes = ['Concurrent mentor note'];
    Object.assign(stored, body);
    return stored;
  };
  const { route } = handler(repo);
  const response = new ResponseCapture();
  await route({ ...base, request: request('POST', {}, { origin: 'https://hq.test', 'x-mmhq-csrf': 'a'.repeat(24) }), response,
    url: new URL(`https://hq.test/api/ivoc/v1/sessions/${foreignSessionId}/review`), hqSession: session(42, ['mentor']) });
  assert.equal(response.status, 200);
  assert.equal(response.json().reviewStatus, 'reviewed');
  assert.equal(Object.hasOwn(repo.updates[0].body, 'notes'), false);
  assert.deepEqual(stored.notes, ['Concurrent mentor note']);
  assert.doesNotMatch(response.body, /mentor note/u);
});

test('review creation defaults empty notes, explicit arrays remain bounded, invalid input never clears notes', async () => {
  for (const [input, expectedStatus] of [[{}, 200], [{ notes: ['Explicit note'] }, 200], [{ notes: [] }, 200], [{ notes: Array(101).fill('note') }, 200], [{ notes: null }, 400], [{ notes: 'bad' }, 400], [null, 400]]) {
    const repo = repository();
    repo.single = async (path) => path.startsWith('ivoc_sessions?') ? { id: foreignSessionId, owner_subject: 'wp:7' } : null;
    const { route } = handler(repo);
    const response = new ResponseCapture();
    await route({ ...base, request: rawRequest('POST', JSON.stringify(input), { origin: 'https://hq.test', 'x-mmhq-csrf': 'a'.repeat(24) }), response,
      url: new URL(`https://hq.test/api/ivoc/v1/sessions/${foreignSessionId}/review`), hqSession: session(42, ['administrator']) });
    assert.equal(response.status, expectedStatus);
    const reviews = repo.inserts.filter(row => row.table === 'ivoc_reviews');
    if (expectedStatus === 400) assert.equal(reviews.length, 0);
    else {
      assert.deepEqual(reviews[0].body.notes, (input.notes || []).slice(0, 100));
      assert.equal(reviews[0].body.owner_subject, 'wp:7');
      assert.equal(reviews[0].body.mentor_subject, 'wp:42');
    }
  }
});

test('review completion still denies unassigned students and missing CSRF before mutation', async () => {
  for (const [roles, headers, status] of [[['student'], { origin: 'https://hq.test', 'x-mmhq-csrf': 'a'.repeat(24) }, 404], [['administrator'], {}, 403]]) {
    const repo = repository();
    repo.single = async (path) => path.startsWith('ivoc_sessions?') ? { id: foreignSessionId, owner_subject: 'wp:7' } : null;
    const { route } = handler(repo);
    const response = new ResponseCapture();
    await route({ ...base, request: request('POST', {}, headers), response,
      url: new URL(`https://hq.test/api/ivoc/v1/sessions/${foreignSessionId}/review`), hqSession: session(42, roles) });
    assert.equal(response.status, status);
    assert.equal(repo.inserts.filter(row => row.table === 'ivoc_reviews').length, 0);
    assert.equal(repo.updates.length, 0);
  }
});

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
  assert.deepEqual(response.json().capabilities.contextSources, {
    storyForge: { connected: false, requiresAuthorizedData: true },
    rise: { connected: false, requiresProgramSelection: true },
    fileVault: { connected: false, projection: 'current_cv', requiresAuthorizedData: true },
  });
  assert.ok(!/service|secret|objectKey/u.test(response.body));
});

test('bootstrap exposes only non-secret owner-connector availability', async () => {
  const repo = repository();
  const route = createIvocHandler({
    registry: registry(), repository: repo,
    storage: { createUpload: () => { throw new Error('not used'); }, validateUploadToken: () => false },
    applicationIntelligence: { prepareSession: async () => null, getActorContext: async () => null },
    env: {
      IVPREP_ENABLED: 'true', IVPREP_ADMIN_CANARY_ENABLED: 'true', MMHQ_SESSION_SECRET: 's'.repeat(64),
      MMHQ_WP_BASE: 'https://missionmed.example.test', MMHQ_RISE_BASE: 'https://rise.example.test',
    },
  });
  const response = new ResponseCapture();
  await route({ ...base, request: request('GET'), response, url: new URL('https://hq.test/api/ivoc/v1/bootstrap'), hqSession: session() });
  assert.equal(response.status, 200);
  assert.equal(response.json().capabilities.contextSources.storyForge.connected, true);
  assert.equal(response.json().capabilities.contextSources.fileVault.connected, true);
  assert.equal(response.json().capabilities.contextSources.rise.connected, true);
  assert.doesNotMatch(response.body, /missionmed\.example|rise\.example|authorization|cookie/u);
});

test('student bootstrap exposes only the minimized current interview policy, not private Admin configuration',async()=>{
  const repo=repository();repo.single=async path=>path.startsWith('ivoc_admin_config_versions?')?{schema_name:'ivoc.admin_config.v1',version:4,pressure_defaults:{max_follow_ups_per_answer:2,default_follow_up_intensity:1,default_pressure_enabled:false},changed_by:'private-actor',credits:{private:true}}:null;
  const{route}=handler(repo);const response=new ResponseCapture();await route({...base,request:request('GET'),response,url:new URL('https://hq.test/api/ivoc/v1/bootstrap'),hqSession:session()});
  assert.equal(response.status,200);assert.deepEqual(response.json().interviewPolicy,{schema:'ivoc.interview-policy.v1',version:4,maxFollowUpsPerAnswer:2,defaultFollowUpDepth:1,defaultPressureEnabled:false});
  assert.doesNotMatch(response.body,/private-actor|"credits"/);
});

test('authenticated program search proxies the bounded RISE owner result without exposing the owner URL', async () => {
  const repo = repository();
  const calls = [];
  const route = createIvocHandler({
    registry: registry(), repository: repo,
    storage: { createUpload: () => { throw new Error('not used'); }, validateUploadToken: () => false },
    applicationIntelligence: { prepareSession: async () => null, getActorContext: async () => null },
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({
        registryReleaseId: 'rise_registry_20260920_0123456789ab', total: 13, page: 2, pageSize: 12,
        records: [{ programSpecialtyId: 'rise_ps_program_1', display: { programName: 'Example Residency', state: 'New York' }, designation: 'Internal Medicine', evidence: { coveragePercent: 55 } }],
      }), { status: 200 });
    },
    env: {
      IVPREP_ENABLED: 'true', IVPREP_ADMIN_CANARY_ENABLED: 'true', MMHQ_SESSION_SECRET: 's'.repeat(64),
      MMHQ_RISE_BASE: 'https://rise.example.test',
    },
  });
  const response = new ResponseCapture();
  await route({
    ...base,
    request: request('GET', null, { cookie: `mmhq_session=${'s'.repeat(32)}` }), response,
    url: new URL('https://hq.test/api/ivoc/v1/programs/search?q=example&specialty=Internal%20Medicine&page=2'), hqSession: session(),
  });
  assert.equal(response.status, 200);
  assert.equal(response.json().records[0].name, 'Example Residency');
  assert.equal(response.json().records[0].id, 'rise_ps_program_1');
  assert.equal(response.json().registryReleaseId, 'rise_registry_20260920_0123456789ab');
  assert.match(calls[0].url, /\/api\/rise\/v1\/programs\?q=example&specialty=Internal\+Medicine/u);
  assert.doesNotMatch(response.body, /rise\.example\.test/u);
  assert.equal(response.json().page, 2);
  assert.equal(response.json().totalPages, 2);
  assert.match(calls[0].url, /page=2&pageSize=12/u);
  for (const page of ['0', '-1', '1.5', '2abc', '10001', '']) {
    const denied = new ResponseCapture();
    await route({ ...base, request: request('GET', null, { cookie: `mmhq_session=${'s'.repeat(32)}` }), response: denied,
      url: new URL(`https://hq.test/api/ivoc/v1/programs/search?page=${encodeURIComponent(page)}`), hqSession: session() });
    assert.equal(denied.status, 400);
  }
  assert.equal(calls.length, 1);
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

test('self-practice prompt is issued from approved exact source and client receipts are stripped', async () => {
  const headers = { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) };
  const input = { sessionType: 'question', interviewerProvider: 'missionmed-static', questionId: 'CORE-01',
    questionText: 'Tell me about yourself.', context: { targetQuestions: 1, questionIds: ['CORE-01'], promptReceipt: { version: 999, fake: true } } };
  for (const scenario of ['approved', 'edited', 'retired', 'ai', 'multi']) {
    const { route, repo } = handler();
    if (scenario === 'retired') repo.single = async path => path.startsWith('ivoc_question_catalog?')
      ? { question_id: 'CORE-01', current_version: 2, canonical_text: input.questionText, status: 'retired' } : null;
    const candidate = structuredClone(input);
    if (scenario === 'edited') candidate.questionText = 'Client invented wording';
    if (scenario === 'ai') candidate.interviewerProvider = 'openai-gpt-live';
    if (scenario === 'multi') candidate.context.targetQuestions = 2;
    const response = new ResponseCapture();
    await route({ ...base, request: request('POST', candidate, headers), response,
      url: new URL('https://hq.test/api/ivoc/v1/sessions'), hqSession: session() });
    assert.equal(response.status, 201);
    const receipt = repo.inserts.find(row => row.table === 'ivoc_sessions').body.context.promptReceipt;
    if (scenario === 'approved') {
      assert.equal(receipt.schema, 'ivoc.self-practice-prompt.v1'); assert.equal(receipt.version, 1);
      assert.equal(receipt.text, input.questionText); assert.equal(receipt.fake, undefined);
    } else assert.equal(receipt, undefined);
  }
});

test('retry setup projection is bounded and owner-only, including authorized Admin reviews', async () => {
  const repo = repository();
  const source = { id: foreignSessionId, owner_subject: 'wp:42', question_id: 'Q1', question_text: 'Why here?',
    context: { goal: 'Full IV Simulation', pressurePractice: true, program: 'Original program',
      interviewer: 'Associate Program Director', interviewerStyle: 'Eagle',
      contextSources: ['CV', 'StoryForge', 'CV', 'unknown'], actor_block: 'PRIVATE-CONTEXT',
      source_receipts: ['PRIVATE-RECEIPT'], readiness: { secret: 'PRIVATE-DEVICE' } } };
  repo.single = async path => path.startsWith('ivoc_sessions?') ? source : null;
  const { route } = handler(repo);
  for (const [id, roles, allowed] of [[42, ['student'], true], [7, ['administrator'], false]]) {
    const response = new ResponseCapture();
    await route({ ...base, request: request(), response, url: new URL(`https://hq.test/api/ivoc/v1/sessions/${foreignSessionId}`), hqSession: session(id, roles) });
    assert.equal(response.status, 200);
    assert.equal(Boolean(response.json().retryContext), allowed);
    if (allowed) {
      assert.deepEqual(response.json().retryContext.contextSources, ['CV', 'StoryForge']);
      assert.equal(response.json().retryContext.questionVersion, null);
      assert.equal(response.json().retryContext.sourceSessionId, foreignSessionId);
      assert.equal(response.json().retryContext.interviewer, 'Associate Program Director');
      assert.equal(response.json().retryContext.interviewerStyle, 'Eagle');
    }
    assert.doesNotMatch(response.body, /PRIVATE-|actor_block|source_receipts|readiness/);
  }
  source.context.interviewerStyle = 'untrusted instruction';
  const invalid = new ResponseCapture();
  await route({ ...base, request: request(), response: invalid, url: new URL(`https://hq.test/api/ivoc/v1/sessions/${foreignSessionId}`), hqSession: session() });
  assert.equal(invalid.json().retryContext.interviewerStyle, null);
});

test('retry creation rejects foreign or mismatched source before insertion and derives provenance itself', async () => {
  const repo = repository();
  const source = { id: foreignSessionId, owner_subject: 'wp:42', question_id: 'Q1', question_text: 'Why here?', session_type: 'mock', context: { goal: 'Guided Mock IV Practice' } };
  repo.single = async path => path.startsWith('ivoc_sessions?') ? source : null;
  const { route } = handler(repo);
  const headers = { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) };
  const input = { questionId: 'Q1', questionText: 'Why here?', sessionType: 'mock', retrySourceSessionId: foreignSessionId,
    context: { retry: { sourceSessionId: 'forged' }, goal: 'Individual Question' } };
  const call = async (body, identity = session()) => {
    const response = new ResponseCapture();
    await route({ ...base, request: request('POST', body, headers), response, url: new URL('https://hq.test/api/ivoc/v1/sessions'), hqSession: identity });
    return response;
  };
  assert.equal((await call(input, session(7, ['administrator']))).status, 404);
  assert.equal((await call({ ...input, questionText: 'Different' })).status, 409);
  assert.equal((await call({ ...input, sessionType: 'question' })).status, 409);
  assert.equal((await call({ ...input, retrySourceSessionId: 'bad' })).status, 400);
  assert.equal(repo.inserts.filter(row => row.table === 'ivoc_sessions').length, 0);
  assert.equal((await call(input)).status, 201);
  const created = repo.inserts.find(row => row.table === 'ivoc_sessions').body;
  assert.equal(created.owner_subject, 'wp:42');
  assert.equal(created.context.retry.sourceSessionId, foreignSessionId);
  assert.equal(created.context.retry.sourceGoal, 'Guided Mock IV Practice');
  assert.equal(created.context.retry.questionVersion, null);
});

test('session creation passes only bounded server-held upstream credentials to Application Intelligence', async () => {
  const repo = repository();
  const prepared = [];
  const route = createIvocHandler({
    registry: registry(), repository: repo,
    storage: { createUpload: () => { throw new Error('not used'); }, validateUploadToken: () => false },
    applicationIntelligence: {
      async prepareSession(input) { prepared.push(input); return { receipt: 'ctxpack:test@receipt' }; },
      async getActorContext() { return null; },
    },
    env: { IVPREP_ENABLED: 'true', IVPREP_ADMIN_CANARY_ENABLED: 'true', MMHQ_SESSION_SECRET: 's'.repeat(64) },
  });
  const hqSession = { ...session(), wpAuthorization: `Bearer ${'w'.repeat(32)}` };
  const response = new ResponseCapture();
  await route({
    ...base,
    request: request('POST', { title: 'CV and program practice', context: { contextSources: ['CV', 'RISE'] } }, {
      origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24),
      cookie: `unrelated=discard; mmhq_session=${'s'.repeat(32)}; another=discard`,
    }),
    response, url: new URL('https://hq.test/api/ivoc/v1/sessions'), hqSession,
  });
  assert.equal(response.status, 201);
  assert.equal(prepared.length, 1);
  assert.equal(prepared[0].actor, 'wp:42');
  assert.equal(prepared[0].authorization, hqSession.wpAuthorization);
  assert.equal(prepared[0].sessionCookie, `mmhq_session=${'s'.repeat(32)}`);
  assert.deepEqual(prepared[0].sessionRow.context.contextSources, ['CV', 'RISE']);
  assert.doesNotMatch(response.body, /Bearer|wpAuthorization|mmhq_session/u);
});

test('an unavailable requested owner projection is actionable and never reported as an internal save failure', async () => {
  const repo = repository();
  const route = createIvocHandler({
    registry: registry(), repository: repo,
    storage: { createUpload: () => { throw new Error('not used'); }, validateUploadToken: () => false },
    applicationIntelligence: {
      async prepareSession() { throw new TypeError('ivoc_rise_projection_unavailable'); },
      async getActorContext() { return null; },
    },
    env: { IVPREP_ENABLED: 'true', IVPREP_ADMIN_CANARY_ENABLED: 'true', MMHQ_SESSION_SECRET: 's'.repeat(64) },
  });
  const response = new ResponseCapture();
  await route({
    ...base,
    request: request('POST', { title: 'Program practice', context: { contextSources: ['RISE'] } }, {
      origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24),
    }),
    response, url: new URL('https://hq.test/api/ivoc/v1/sessions'), hqSession: session(),
  });
  assert.equal(response.status, 409);
  assert.equal(response.json().error, 'ivoc_rise_projection_unavailable');
  assert.equal(repo.updates.at(-1).body.state, 'error');
  assert.doesNotMatch(response.body, /ivoc_internal_error/u);
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
    ['interviewer', 'aside'], ['student', 'answer'], ['interviewer', 'aside'],
  ]);
  assert.equal(liveTurns[0].transcript.text, 'Tell me about yourself.');
  assert.match(liveTurns[0].transcript.provisional_ref, /^provider:gpt-live-1:/u);
  assert.equal(Object.hasOwn(liveTurns[0].transcript, 'canonical_ref'), false);
  assert.equal(liveTurns[0].transcript.timing_basis, 'LEGACY_UNSPECIFIED');
  assert.equal(liveTurns[0].transcript.finalization, 'LEGACY_UNSPECIFIED');
  assert.deepEqual(liveTurns[0].question, {});
  assert.equal(response.json().liveConversationTurns, 3);
  assert.equal(response.json().audioAuthorityVerified, true);
  assert.equal(resultInsert.body.payload.audioAuthority.mode, 'single');
  const sessionUpdate = repo.updates.find((entry) => entry.path.startsWith(`ivoc_sessions?id=eq.${sessionId}`));
  assert.equal(sessionUpdate.body.duration_ms, 24_500);
});

function provisionalConversation(sessionId = '00000000-0000-4000-8000-000000000042') {
  const metadata = { timingBasis: 'MESSAGE_RECEIPT', provenance: 'BROWSER_DECLARED' };
  return { schema: 'ivoc.live-conversation.v1', provider: 'openai-gpt-live', clock: 'recording-observed', sessionId,
    ...metadata, turns: [
      { ...metadata, id: 'prompt-item', itemId: 'prompt-item', responseId: 'prompt-response', speaker: 'interviewer',
        text: 'A second base question?', startMs: 100, endMs: 200, final: true,
        finalization: 'PROVIDER_FINAL_MESSAGE', providerEventType: 'response.audio_transcript.done' },
      { ...metadata, id: 'candidate-item', itemId: 'candidate-item', speaker: 'student', text: 'An unfinished response',
        startMs: 300, endMs: 400, final: true, finalization: 'CLIENT_FINISH',
        providerEventType: 'input.transcript.delta:client-finish' },
      { ...metadata, id: 'other-prompt', itemId: 'other-prompt', responseId: 'other-response', speaker: 'interviewer',
        text: 'Another utterance.', startMs: 500, endMs: 500, final: true,
        finalization: 'PROVIDER_FINAL_MESSAGE', providerEventType: 'response.audio_transcript.done' },
    ] };
}

test('Results→saved spine→authorized reload preserves declared IDs and receipt provenance without canonical prompt/speech claims', async () => {
  const id = '00000000-0000-4000-8000-000000000042';
  const row = { id, owner_subject: 'wp:42', state: 'saved', interviewer_provider: 'openai-gpt-live', question_id: 'CORE-01',
    question_text: 'Tell me about yourself.', context: {} };
  const repo = repository(); let saved = null;
  const insert = repo.insert;
  repo.insert = async (table, body) => { const result = await insert(table, body); if (table === 'ivoc_results') saved = result; return result; };
  repo.single = async path => path.startsWith('ivoc_sessions?') ? row : path.startsWith('ivoc_results?') ? saved : null;
  repo.request = async path => path.startsWith('ivoc_conversation_turns?') ? repo.upserts.map(entry => entry.body)
    : path.startsWith('ivoc_sessions?') ? [row] : path.startsWith('ivoc_results?') ? [saved] : [];
  const { route } = handler(repo); const response = new ResponseCapture();
  const input = { schema: 'ivoc.analytics.v1', schemaVersion: 1, sessionId: id, durationMs: 1000,
    analytics: { objectiveMarker: 'unchanged' }, liveConversation: provisionalConversation(id) };
  // Extra browser assertions are discarded, not granted a canonical/provider origin.
  input.liveConversation.turns[0].canonical_ref = 'transcript:forged#seg-1';
  input.liveConversation.turns[0].speechBoundaries = 'VERIFIED';
  input.liveConversation.turns[0].question = { canonical_question_id: 'CORE-99' };
  await route({ ...base, request: request('POST', input, { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }),
    response, url: new URL(`https://hq.test/api/ivoc/v1/sessions/${id}/results`), hqSession: session() });
  assert.equal(response.status, 200, response.body);
  const storedTurns = repo.upserts.map(entry => entry.body);
  assert.deepEqual(storedTurns.map(turn => turn.relation), ['aside', 'answer', 'aside']);
  assert.equal(storedTurns[0].transcript.item_id, 'prompt-item');
  assert.equal(storedTurns[0].transcript.response_id, 'prompt-response');
  assert.equal(storedTurns[0].transcript.ivoc_session_id, id);
  assert.equal(storedTurns[0].transcript.provenance, 'BROWSER_DECLARED');
  assert.equal(storedTurns[0].transcript.timing_basis, 'MESSAGE_RECEIPT');
  assert.equal(storedTurns[0].transcript.finalization, 'PROVIDER_FINAL_MESSAGE');
  assert.equal(storedTurns[1].transcript.finalization, 'CLIENT_FINISH');
  assert.equal(storedTurns.every(turn => turn.parent_turn_id === null && !turn.transcript.canonical_ref), true);
  assert.equal(storedTurns.every(turn => turn.transcript.prompt_binding === 'UNVERIFIED' && turn.transcript.speech_boundaries === 'UNVERIFIED'), true);
  assert.deepEqual(storedTurns[0].question, {});
  assert.deepEqual(saved.payload.analytics, input.analytics);
  assert.equal(saved.payload.liveConversation.turns[0].canonical_ref, undefined);
  const preimage = structuredClone({ saved, storedTurns });
  const read = new ResponseCapture();
  await handler(repo).route({ ...base, request: request('GET'), response: read,
    url: new URL(`https://hq.test/api/ivoc/v1/sessions/${id}`), hqSession: session() });
  assert.equal(read.status, 200, read.body);
  const detail = read.json();
  assert.equal(detail.spine.turns[0].transcript.response_id, 'prompt-response');
  assert.equal(detail.spine.turns[1].transcript.finalization, 'CLIENT_FINISH');
  assert.equal(detail.spine.turns[2].startMs, detail.spine.turns[2].endMs);
  assert.equal(detail.spine.candidateAttribution.status, 'UNVERIFIED');
  assert.equal(detail.analysisAvailability.status, 'UNAVAILABLE');
  assert.equal(detail.results.payload.liveConversation.turns[0].speechBoundaries, 'UNVERIFIED');
  assert.deepEqual({ saved, storedTurns }, preimage);
});

test('malformed or foreign provisional identity/receipt metadata rejects before Results and turn writes', async () => {
  const id = '00000000-0000-4000-8000-000000000042';
  const mutations = [v => { v.sessionId = foreignSessionId; }, v => { v.liveConversation.sessionId = foreignSessionId; },
    v => { delete v.liveConversation.sessionId; }, v => { delete v.liveConversation.provenance; },
    v => { v.liveConversation.turns[0].sessionId = foreignSessionId; },
    v => { v.liveConversation.timingBasis = 'MEASURED_SPEECH'; }, v => { v.liveConversation.provenance = 'SERVER_ATTESTED'; },
    v => { v.liveConversation.turns[0].provenance = 'PROVIDER_ATTESTED'; },
    v => { delete v.liveConversation.turns[0].finalization; }, v => { v.liveConversation.turns[0].finalization = 'COMPLETE_ANSWER'; },
    v => { v.liveConversation.turns[0].id = 1; }, v => { v.liveConversation.turns[0].itemId = ' padded '; },
    v => { v.liveConversation.turns[0].responseId = 'x'.repeat(241); }, v => { v.liveConversation.turns[0].itemId = {}; },
    v => { v.liveConversation.turns[0].text = {}; }, v => { v.liveConversation.turns[0].providerEventType = {}; },
    v => { v.liveConversation.turns[1].id = v.liveConversation.turns[0].id; },
    v => { v.liveConversation.turns[0].endMs = 99; } ];
  for (const mutate of mutations) {
    const repo = repository(); repo.single = async path => path.startsWith('ivoc_sessions?') ? { id, owner_subject: 'wp:42' } : null;
    const input = { schema: 'ivoc.analytics.v1', schemaVersion: 1, sessionId: id, liveConversation: provisionalConversation(id) };
    mutate(input); const response = new ResponseCapture();
    await handler(repo).route({ ...base, request: request('POST', input, { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }),
      response, url: new URL(`https://hq.test/api/ivoc/v1/sessions/${id}/results`), hqSession: session() });
    assert.equal(response.status, 400, response.body);
    assert.equal(repo.inserts.length, 0); assert.equal(repo.upserts.length, 0); assert.equal(repo.updates.length, 0);
  }
});

test('legacy provisional reads retain text/offsets but remove inferred follow-up proof without rewriting rows', async () => {
  const id = '00000000-0000-4000-8000-000000000042';
  const row = { id, owner_subject: 'wp:42', state: 'saved', context: {} };
  const legacyTurn = { turn_id: `turn:${id}:live:legacy`, speaker: 'interviewer', relation: 'follow_up',
    t_start_ms: 120, t_end_ms: 120, transcript: { provisional_ref: 'provider:gpt-live-1:legacy', text: 'Legacy prompt text',
      provider_event_type: 'response.transcript.done', item_id: 'legacy-item', response_id: 'legacy-response' },
    question: { origin: 'generated', identity: { canonical_question_id: 'CORE-01' } }, version: 1 };
  const legacyConversation = provisionalConversation(id);
  delete legacyConversation.sessionId; delete legacyConversation.timingBasis; delete legacyConversation.provenance;
  for (const turn of legacyConversation.turns) { delete turn.timingBasis; delete turn.provenance; delete turn.finalization; }
  const result = { payload: { liveConversation: legacyConversation }, summary: {} };
  const preimage = structuredClone({ legacyTurn, result });
  const repo = repository();
  repo.single = async path => path.startsWith('ivoc_sessions?') ? row : path.startsWith('ivoc_results?') ? result : null;
  repo.request = async path => path.startsWith('ivoc_conversation_turns?') ? [legacyTurn] : [];
  const response = new ResponseCapture();
  await handler(repo).route({ ...base, request: request('GET'), response,
    url: new URL(`https://hq.test/api/ivoc/v1/sessions/${id}`), hqSession: session() });
  assert.equal(response.status, 200);
  const turn = response.json().spine.turns[0];
  assert.equal(turn.relation, 'aside'); assert.deepEqual(turn.question, {});
  assert.equal(turn.startMs, 120); assert.equal(turn.transcript.text, 'Legacy prompt text');
  assert.equal(turn.transcript.item_id, 'legacy-item'); assert.equal(turn.transcript.response_id, 'legacy-response');
  assert.equal(turn.transcript.timing_basis, 'LEGACY_UNSPECIFIED');
  assert.equal(turn.transcript.finalization, 'LEGACY_UNSPECIFIED');
  assert.equal(turn.transcript.prompt_binding, 'UNVERIFIED');
  assert.equal(response.json().results.payload.liveConversation.turns[0].finalization, 'LEGACY_UNSPECIFIED');
  assert.deepEqual({ legacyTurn, result }, preimage);
  assert.equal(repo.upserts.length, 0); assert.equal(repo.updates.length, 0);
});

test('source-bound unavailable transcription audits only allowlisted reason codes, never provider text or locations', async () => {
  const sid = '00000000-0000-4000-8000-000000000042';
  const pid = '00000000-0000-4000-8000-000000000043';
  const cid = '00000000-0000-4000-8000-000000000044';
  const stamp = '2026-09-17T20:00:00.000Z'; const bytes = Buffer.from('offline-microphone');
  const row = { id: sid, owner_subject: 'wp:42', state: 'saved', session_type: 'question', interviewer_provider: 'missionmed-static',
    question_id: 'CORE-01', question_text: 'Tell me about yourself.', context: { targetQuestions: 1, questionIds: ['CORE-01'],
      promptReceipt: { schema: 'ivoc.self-practice-prompt.v1', workflow: 'SELF_PRACTICE', questionId: 'CORE-01', version: 1,
        text: 'Tell me about yourself.', approval: 'ACTIVE_AT_SELECTION', issuedAt: stamp } } };
  const parent = { id: pid, session_id: sid, owner_subject: 'wp:42', recording_role: 'conversation', status: 'saved',
    storage_object_key: 'private/replay', size_bytes: 1000, etag: 'parent-etag', mime_type: 'video/webm', sealed_at: stamp,
    duration_ms: 1000, paused_spans: [], recording_timebase: { clock: 'browser-monotonic-session', recordingId: pid,
      sessionId: sid, ownerSubject: 'wp:42', recordingStartSessionMs: 0, recordingDurationMs: 1000, playableDurationMs: 1000, pausedSpans: [] } };
  const source = { id: cid, session_id: sid, owner_subject: 'wp:42', recording_role: 'candidate_audio', parent_recording_id: pid,
    status: 'saved', storage_object_key: 'private/microphone', size_bytes: bytes.length, etag: 'source-etag', mime_type: 'audio/webm',
    sealed_at: stamp, duration_ms: 800, paused_spans: [], capture_receipt: { schema: 'ivoc.candidate-audio.v1', captureVersion: 'direct-mic-v1',
      status: 'SEALED', recordingId: cid, sessionId: sid, parentRecordingId: pid, allocatedAt: stamp, sealedAt: stamp,
      assurance: 'CLIENT_MIC_CAPTURE_DECLARATION', analysisEligibility: 'UNVERIFIED', sizeBytes: bytes.length,
      etag: 'source-etag', mime: 'audio/webm', timing: { clock: 'browser-monotonic-session', clientAttested: true,
        recordingStartSessionMs: 100, recordingDurationMs: 800, playableDurationMs: 800, pausedSpans: [] } } };
  for (const reason of ['TRANSCRIPT_SEGMENTS_UNAVAILABLE', 'TRANSCRIPT_PROVIDER_ERROR',
    'Provider text https://private.example/signed?token=never-log-this', { code: 'TRANSCRIPT_PROVIDER_ERROR' }]) {
    const repo = repository(); let providerCalls = 0;
    repo.single = async path => path.startsWith('ivoc_sessions?') ? row
      : path.startsWith('ivoc_recordings?parent_recording_id=') ? source : path.startsWith('ivoc_recordings?id=') ? parent
        : path.startsWith('ivoc_results?') ? { id: 'result', candidate_analysis: null } : null;
    const route = createIvocHandler({ registry: registry(), repository: repo,
      storage: { fetchObject: async key => { assert.equal(key, source.storage_object_key); return new Response(bytes,
        { headers: { 'Content-Length': String(bytes.length), 'Content-Type': source.mime_type, ETag: source.etag } }); } },
      contextProvider: { analyze: async () => { providerCalls += 1; return { transcript: { status: 'UNAVAILABLE', reason }, analysis: { status: 'UNAVAILABLE' } }; } },
      env: { IVPREP_ENABLED: 'true', IVPREP_ADMIN_CANARY_ENABLED: 'true', MMHQ_SESSION_SECRET: 's'.repeat(64),
        IVOC_CONTEXT_CANDIDATE_ENABLED: 'true', IVOC_CONTEXT_TRANSCRIPT_ENABLED: 'true' } });
    const response = new ResponseCapture();
    await route({ ...base, request: request('POST', { action: 'analyze', sessionId: sid, recordingId: pid, answerId: 'answer-1' },
      { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }), response,
      url: new URL('https://hq.test/api/ivoc/v1/context'), hqSession: session() });
    assert.equal(response.status, 200, response.body); assert.equal(providerCalls, 1);
    assert.equal(repo.updates.length, 0); assert.equal(repo.upserts.length, 0);
    const audits = repo.inserts.filter(entry => entry.table === 'ivoc_access_log');
    assert.equal(audits.length, 1);
    assert.deepEqual(audits[0].body, { actor_subject: 'wp:42', owner_subject: 'wp:42', session_id: sid, recording_id: pid,
      action: 'context_transcript_unavailable', decision: 'deny',
      reason: typeof reason === 'string' && reason.startsWith('TRANSCRIPT_') ? reason : 'TRANSCRIPT_UNAVAILABLE' });
    assert.doesNotMatch(JSON.stringify(audits), /private\/|signed\?|never-log-this|Provider text/u);
  }
});

test('Answer History library quarantines unverified batch transcript and candidate semantic summaries', async () => {
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
    transcriptAvailable: false,
    answerSegmentCount: 0,
    supportedObservationCount: 0,
    dimensions: [],
    candidateAttribution: { status: 'UNVERIFIED', reason: 'CANDIDATE_AUDIO_SOURCE_UNVERIFIED' },
  });
});

test('own library list projection omits duplicated measured arrays and keeps saved evidence; default is unchanged', async () => {
  const repo = repository();
  const sessionId = '00000000-0000-4000-8000-000000000043';
  const fable = { schema: 'ivoc.fable51.evidence.v1', fixture: false, clock: 'recording-observed', samples: [{ t: 1, pace: 150 }], events: [{ t: 2, lane: 'pace' }], debrief: { lane: 'pace', text: 'Pace left the displayed range.' } };
  const payload = { schema: 'ivoc.results.v1', events: [{ t: 1, kind: 'raw' }], liveConversation: { turns: [] },
    analytics: { schema: 'ivoc.analytics.v1', events: [{ t: 1, kind: 'raw' }], flightRecorder: { lanes: [[1, 2, 3]] }, studentEvents: [{ metric: 'answer_duration_ms', maturity: 'STUDENT_SAFE', observation: { value: 1000 } }], fable } };
  repo.request = async (path) => {
    if (path.startsWith('ivoc_sessions?owner_subject=eq.wp%3A42')) return [{
      id: sessionId, owner_subject: 'wp:42', title: 'Opening answer', session_type: 'question',
      question_id: 'CORE-01', question_text: 'Tell me about yourself.', state: 'saved',
      started_at: '2026-09-20T12:00:00.000Z', ended_at: '2026-09-20T12:01:00.000Z',
      duration_ms: 60_000, interviewer_provider: 'openai-gpt-live',
    }];
    if (path.startsWith('ivoc_results?')) return [{ session_id: sessionId, schema_name: 'ivoc.results.v1', schema_version: 1, payload, summary: {} }];
    return [];
  };
  const { route } = handler(repo);
  const full = new ResponseCapture();
  await route({ ...base, request: request('GET'), response: full, url: new URL('https://hq.test/api/ivoc/v1/library?scope=own'), hqSession: session() });
  assert.equal(full.status, 200);
  const fullRow = full.json().sessions[0];
  assert.deepEqual(fullRow.results.payload.events, payload.events);
  assert.deepEqual(fullRow.results.payload.analytics.flightRecorder, payload.analytics.flightRecorder);
  const list = new ResponseCapture();
  await route({ ...base, request: request('GET'), response: list, url: new URL('https://hq.test/api/ivoc/v1/library?scope=own&projection=list'), hqSession: session() });
  assert.equal(list.status, 200);
  const body = list.json();
  assert.equal(body.scopeSubject, 'wp:42');
  const row = body.sessions[0];
  assert.equal(row.id, sessionId);
  assert.equal('events' in row.results.payload, false);
  assert.equal('events' in row.results.payload.analytics, false);
  assert.equal('flightRecorder' in row.results.payload.analytics, false);
  assert.deepEqual(row.results.payload.analytics.fable, fable);
  assert.deepEqual(row.results.payload.analytics.studentEvents, payload.analytics.studentEvents);
  assert.equal(row.results.payload.analytics.schema, 'ivoc.analytics.v1');
  assert.ok(row.results.payload.liveConversation);
  assert.ok(row.results.payload.candidateAttribution);
  assert.equal(row.state, 'saved');
  assert.deepEqual(Object.keys(fullRow).sort(), Object.keys(row).sort());
  assert.ok(list.body.length < full.body.length);
});

test('Admin all-student library exposes stable owner identity without leaking it to owner scope', async () => {
  const repo = repository();
  const sessionId = '00000000-0000-4000-8000-000000000042';
  const row = {
    id: sessionId, owner_subject: 'wp:42', owner_display_name: 'Student 42', title: 'Opening answer',
    session_type: 'question', question_id: 'CORE-01', question_text: 'Tell me about yourself.',
    state: 'saved', started_at: '2026-09-20T12:00:00.000Z', ended_at: '2026-09-20T12:01:00.000Z',
    duration_ms: 60_000, interviewer_provider: 'openai-gpt-live',
  };
  repo.request = async (path) => {
    if (path.startsWith('ivoc_sessions?select=*')) return [row];
    if (path.startsWith('ivoc_sessions?owner_subject=eq.wp%3A42')) return [row];
    return [];
  };
  const { route } = handler(repo);
  const adminResponse = new ResponseCapture();
  await route({
    ...base, request: request('GET'), response: adminResponse,
    url: new URL('https://hq.test/api/ivoc/v1/library?scope=all'),
    hqSession: session(1, ['administrator']),
  });
  assert.equal(adminResponse.status, 200);
  assert.equal(adminResponse.json().sessions[0].ownerSubject, 'wp:42');
  assert.equal(Object.hasOwn(adminResponse.json(), 'scopeSubject'), false);

  const ownerResponse = new ResponseCapture();
  await route({
    ...base, request: request('GET'), response: ownerResponse,
    url: new URL('https://hq.test/api/ivoc/v1/library?scope=own'),
    hqSession: session(),
  });
  assert.equal(ownerResponse.status, 200);
  assert.equal(ownerResponse.json().scopeSubject, 'wp:42');
  assert.equal(Object.hasOwn(ownerResponse.json().sessions[0], 'ownerSubject'), false);
});

test('own preference projection binds its request actor without granting a client-selected subject', async () => {
  const repo = repository();
  repo.single = async path => path.startsWith('ivoc_preferences?owner_subject=eq.wp%3A42')
    ? { calibration: { version: 7 }, visibility: { analyticsVisible: true }, coaching_enabled: true, recording_default: true } : null;
  const { route } = handler(repo); const response = new ResponseCapture();
  await route({ ...base, request: request('GET'), response,
    url: new URL('https://hq.test/api/ivoc/v1/preferences?subject=wp:1'), hqSession: session() });
  assert.equal(response.status, 200);
  assert.equal(response.json().scopeSubject, 'wp:42');
  assert.deepEqual(response.json().calibration, { version: 7 });
  assert.equal(Object.hasOwn(response.json(), 'ownerSubject'), false);
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

test('authorized session read quarantines batch-derived candidate text and answer ranges without changing rows', async () => {
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
  assert.deepEqual(response.json().spine.turns, []);
  assert.equal(response.json().spine.segments[0].transcriptRef, null);
  assert.equal(response.json().spine.segments[0].answer, null);
  assert.equal(response.json().spine.candidateAttribution.status, 'UNVERIFIED');
  assert.doesNotMatch(response.body, /A private answer|transcript:1/u);
  assert.doesNotMatch(response.body, /storage_object_key|never-return-this/u);
});

test('public spine/results/history quarantine unsafe batch context but preserve native conversation, metrics, replay and retry identity', async () => {
  const id = '00000000-0000-4000-8000-000000000042';
  const row = { id, owner_subject: 'wp:42', question_id: 'CORE-01', question_text: 'Tell me about yourself.',
    state: 'saved', context: { goal: 'Individual Question' }, duration_ms: 12000 };
  const recording = { id: foreignRecordingId, session_id: id, status: 'saved', duration_ms: 12000,
    storage_object_key: 'private/unchanged.webm' };
  const unsafeContext = { transcript: { status: 'AVAILABLE', text: 'Misattributed interviewer words' },
    analysis: { status: 'AVAILABLE', coachingPatterns: [{ text: 'Unsafe coaching' }] },
    behaviorRegistry: { enabled: true }, coachCommand: { cue: 'SLOW_DOWN' } };
  const metrics = { counters: { durationMs: 12000, clippingPercent: 0.5 }, voice: { volumeDbfs: -24 } };
  const result = { session_id: id, schema_name: 'ivoc.analytics.v1', schema_version: 1,
    payload: { analytics: metrics, contextResult: unsafeContext, nested: { contextResult: unsafeContext } },
    summary: { durations: { playableDurationMs: 12000 } } };
  const turns = [
    { turn_id: `turn:${id}:question`, speaker: 'interviewer', relation: 'question', t_start_ms: 0, t_end_ms: 0,
      transcript: { text: 'Synthetic first pool question at zero' }, question: {} },
    { turn_id: `turn:${id}:answer:1`, speaker: 'student', relation: 'answer', t_start_ms: 0, t_end_ms: 12000,
      transcript: { canonical_ref: 'transcript:batch#seg-1', text: 'Misattributed interviewer words' }, semantic: { confidence: 0.99 } },
    { turn_id: `turn:${id}:live:interviewer`, speaker: 'interviewer', relation: 'follow_up', t_start_ms: 3000, t_end_ms: 4000,
      transcript: { provisional_ref: 'provider:gpt-live-1:interviewer', text: 'Actual follow-up prompt' }, semantic: {} },
    { turn_id: `turn:${id}:live:candidate`, speaker: 'student', relation: 'answer', t_start_ms: 4500, t_end_ms: 9000,
      transcript: { provisional_ref: 'provider:gpt-live-1:candidate', text: 'Actual provisional candidate words' }, semantic: {} },
  ];
  const segments = [{ session_id: id, segment_id: 'batch-segment', transcript_ref: 'transcript:batch', media_ref: `recording:${foreignRecordingId}`,
    question: { canonical_question_id: 'CORE-01', text: 'Tell me about yourself.', version: '1' },
    answer: { t_start_ms: 0, t_end_ms: 12000, turn_ids: [`turn:${id}:answer:1`] }, coaching_notes_refs: ['unsafe-evidence'] },
    { session_id: id, segment_id: 'legacy-unproven', transcript_ref: null,
      question: {}, answer: { t_start_ms: 0, t_end_ms: 12000 }, coaching_notes_refs: ['unsafe-evidence'] },
  ];
  const evidence = [
    { session_id: id, evidence_id: 'unsafe-evidence', dimension: 'semantic.supported_claim', refs: [{ ref: 'transcript:batch#seg-1' }], interpretation: { text: 'Unsafe coaching' } },
    { session_id: id, evidence_id: 'dependent-voice', dimension: 'voice.pacing', refs: [{ ref: 'transcript:batch#seg-1' }], interpretation: { text: 'Unsafe derived pace' } },
    { session_id: id, evidence_id: 'measured', dimension: 'voice.volume', refs: [{ ref: 'event:measured-volume' }], interpretation: { text: 'Measured volume' } },
  ];
  const stored = { row, recording, result, turns, segments, evidence };
  const preimage = structuredClone(stored);
  const repo = repository();
  repo.single = async path => path.startsWith('ivoc_sessions?') ? row : path.startsWith('ivoc_recordings?') ? recording
    : path.startsWith('ivoc_results?') ? result : null;
  repo.request = async path => path.startsWith('ivoc_conversation_turns?') ? turns
    : path.startsWith('ivoc_answer_segments?') ? segments : path.startsWith('ivoc_coaching_evidence?') ? evidence
      : path.startsWith('ivoc_sessions?') ? [row] : path.startsWith('ivoc_recordings?') ? [recording]
        : path.startsWith('ivoc_results?') ? [result] : [];
  const { route } = handler(repo);
  const detailResponse = new ResponseCapture();
  await route({ ...base, request: request('GET'), response: detailResponse,
    url: new URL(`https://hq.test/api/ivoc/v1/sessions/${id}`), hqSession: session() });
  assert.equal(detailResponse.status, 200);
  const detail = detailResponse.json();
  assert.deepEqual(detail.spine.turns.map(turn => [turn.speaker, turn.startMs, turn.transcript.text]), [
    ['interviewer', 3000, 'Actual follow-up prompt'], ['student', 4500, 'Actual provisional candidate words'],
  ]);
  assert.equal(detail.spine.segments[0].answer, null);
  assert.equal(detail.spine.segments[0].transcriptRef, null);
  assert.deepEqual(detail.spine.segments[0].coachingNotesRefs, []);
  assert.equal(detail.spine.segments[1].answer, null);
  assert.deepEqual(detail.spine.evidence.map(item => item.id), ['measured']);
  assert.equal(detail.retryContext.questionVersion, '1');
  assert.equal(detail.retryContext.questionText, row.question_text);
  assert.deepEqual(detail.results.payload.analytics, metrics);
  assert.equal(detail.results.payload.contextResult.transcript.status, 'UNAVAILABLE');
  assert.deepEqual(detail.results.payload.contextResult.analysis.coachingPatterns, []);
  assert.equal(detail.results.payload.contextResult.behaviorRegistry.status, 'DISABLED');
  assert.equal(detail.results.payload.contextResult.coachCommand.status, 'UNAVAILABLE');
  assert.equal(detail.results.payload.nested.contextResult.transcript.reason, 'CANDIDATE_AUDIO_SOURCE_UNVERIFIED');
  assert.equal(detail.spine.candidateAttribution.status, 'UNVERIFIED');
  assert.equal(detail.results.candidateAttribution.status, 'UNVERIFIED');
  assert.equal(detail.recording.id, recording.id);
  assert.equal(detail.recording.durationMs, 12000);
  assert.doesNotMatch(detailResponse.body, /Misattributed|Unsafe coaching|Unsafe derived pace|Synthetic first pool|private\/unchanged/u);
  const libraryResponse = new ResponseCapture();
  await route({ ...base, request: request('GET'), response: libraryResponse,
    url: new URL('https://hq.test/api/ivoc/v1/library?scope=own'), hqSession: session() });
  assert.equal(libraryResponse.status, 200);
  const history = libraryResponse.json().sessions[0];
  assert.equal(history.answerHistory.supportedObservationCount, 0);
  assert.equal(history.answerHistory.transcriptAvailable, false);
  assert.deepEqual(history.results.payload.analytics, metrics);
  assert.doesNotMatch(libraryResponse.body, /Misattributed|Unsafe coaching|private\/unchanged/u);
  assert.deepEqual(stored, preimage);
  assert.equal(repo.updates.length, 0);
  assert.equal(repo.upserts.length, 0);
});

test('an owned recording without transcript rows still discloses unverified candidate attribution', async () => {
  const repo = scopedRepository({ assigned: true });
  const { route } = handler(repo);
  const response = new ResponseCapture();
  await route({ ...base, request: request('GET'), response,
    url: new URL(`https://hq.test/api/ivoc/v1/sessions/${foreignSessionId}`), hqSession: session(42, ['mentor']) });
  assert.equal(response.status, 200);
  assert.deepEqual(response.json().spine.candidateAttribution, { status: 'UNVERIFIED', reason: 'CANDIDATE_AUDIO_SOURCE_UNVERIFIED' });
  assert.deepEqual(response.json().spine.turns, []);
});

test('administrator can read any session without receiving the private object key', async () => {
  const { route } = handler(scopedRepository());
  const response = new ResponseCapture();
  await route({ ...base, request: request('GET'), response, url: new URL(`https://hq.test/api/ivoc/v1/sessions/${foreignSessionId}`), hqSession: session(42, ['administrator']) });
  assert.equal(response.status, 200);
  assert.doesNotMatch(response.body, /storage_object_key|never-return-this/u);
});

test('authenticated legacy Matrix launch redirects to the Founder-facing IVOC route', async () => {
  const { route } = handler();
  const response = new ResponseCapture();
  await route({ ...base, request: request('HEAD'), response, url: new URL('https://hq.test/iv-prep-analytics/'), hqSession: session() });
  assert.equal(response.status, 302);
  assert.equal(response.headers.Location, '/iv-prep-on-call/');
  assert.equal(response.headers['Cache-Control'], 'no-store');
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
