import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createIvocApplicationIntelligence,
  createIvocProjectionProvider,
  longitudinalProjection,
  readSessionContextReceipts,
  readSourceBoundLongitudinalProjection,
  validateSourceBoundPriorIvocPack,
} from '../../ivoc/application-intelligence.mjs';
import { rebuildSelfPracticeAnswerSource, packageSelfPracticeAnalysis } from '../../ivoc/self-practice-analysis.mjs';
import { createContextIntelligenceProvider } from '../../ivoc/context-provider.mjs';
import { createIvocActorInstructionResolver, createIvocContextPackResolver } from '../../../ivprep-v6/server/providers/ivoc-context-pack-resolver.mjs';

const SESSION_ID = '00000000-0000-4000-8000-000000000042';
const NOW = '2026-09-20T14:55:00.000Z';

function repository() {
  const upserts = [];
  return {
    upserts,
    upsert: async (table, conflict, body) => {
      upserts.push({ table, conflict, body });
      return body;
    },
    request: async () => [],
    single: async (path) => {
      const pack = upserts.find((entry) => entry.table === 'ivoc_context_packs')?.body;
      if (path.startsWith(`ivoc_context_packs?session_id=eq.${SESSION_ID}`)
          && path.includes('owner_subject=eq.wp%3A42') && pack) return pack;
      const contract = upserts.find((entry) => entry.table === 'ivoc_session_contracts')?.body;
      if (path.startsWith(`ivoc_session_contracts?session_id=eq.${SESSION_ID}`) && contract) return contract;
      return null;
    },
  };
}

function sessionRow() {
  return {
    id: SESSION_ID,
    owner_subject: 'wp:42',
    session_type: 'question',
    question_id: 'CORE-01',
    interviewer_provider: 'gpt-live',
    analytics_schema: 'ivoc.analytics.v1',
    context: {},
    started_at: NOW,
  };
}

// Synthetic contract fixtures only: no physical capture or genuine recurrence claim.
async function savedSourcePractice(number) {
  const uuid = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
  const sid = uuid(number), pid = uuid(number + 100), cid = uuid(number + 200);
  const row = { id: sid, owner_subject: 'wp:42', state: 'saved', session_type: 'question', interviewer_provider: 'missionmed-static',
    question_id: 'CORE-01', question_text: 'Tell me about yourself.', context: { targetQuestions: 1, questionIds: ['CORE-01'],
      promptReceipt: { schema: 'ivoc.self-practice-prompt.v1', workflow: 'SELF_PRACTICE', questionId: 'CORE-01', version: 1,
        text: 'Tell me about yourself.', approval: 'ACTIVE_AT_SELECTION', issuedAt: NOW } } };
  const parent = { id: pid, session_id: sid, owner_subject: 'wp:42', recording_role: 'conversation', status: 'saved',
    storage_object_key: `private/replay-${number}`, size_bytes: 1000, etag: 'parent-etag', sealed_at: NOW,
    mime_type: 'video/webm', duration_ms: 1000, paused_spans: [], recording_timebase: { clock: 'browser-monotonic-session',
      recordingId: pid, sessionId: sid, ownerSubject: 'wp:42', recordingStartSessionMs: 0, recordingDurationMs: 1000,
      playableDurationMs: 1000, pausedSpans: [] } };
  const source = { id: cid, session_id: sid, owner_subject: 'wp:42', recording_role: 'candidate_audio', status: 'saved',
    parent_recording_id: pid, storage_object_key: `private/microphone-${number}`, size_bytes: 10, etag: 'source-etag', sealed_at: NOW,
    mime_type: 'audio/webm', duration_ms: 800, paused_spans: [], capture_receipt: { schema: 'ivoc.candidate-audio.v1',
      captureVersion: 'direct-mic-v1', status: 'SEALED', recordingId: cid, sessionId: sid, parentRecordingId: pid,
      allocatedAt: NOW, sealedAt: NOW, assurance: 'CLIENT_MIC_CAPTURE_DECLARATION', analysisEligibility: 'UNVERIFIED',
      sizeBytes: 10, etag: 'source-etag', mime: 'audio/webm', timing: { clock: 'browser-monotonic-session', clientAttested: true,
        recordingStartSessionMs: 100, recordingDurationMs: 800, playableDurationMs: 800, pausedSpans: [] } } };
  const answerSource = rebuildSelfPracticeAnswerSource({ session: row, parentRecording: parent, sourceRecording: source });
  const pattern = { facet: 'structure', polarity: 'weakness', text: 'The supplied response has no concrete event.', transcriptSegmentIds: ['seg-1'] };
  const provider = createContextIntelligenceProvider({ apiKey: 'offline-test-key', fetchImpl: async url => url.endsWith('/transcriptions')
    ? Response.json({ text: 'I learned a lot.', segments: [{ start: 0, end: .5, text: 'I learned a lot.' }] })
    : Response.json({ status: 'completed', output_text: JSON.stringify({ questionIntent: { label: 'GENERAL', score: .9 },
      answerStage: { label: 'UNSUPPORTED', score: .9 }, score: .9, coverage: .9, semanticObservations: [],
      coachingPatterns: [pattern, pattern], contextTags: [], limitations: ['Synthetic contract evidence, not model quality.'] }) }) });
  const result = await provider.analyze({ sessionId: sid, answerId: 'answer-1', answerSource,
    audio: Buffer.from('test-audio'), mimeType: 'audio/webm', transcriptEnabled: true });
  const envelope = packageSelfPracticeAnalysis({ answerSource, session: row, result, createdAt: NOW });
  return { row, parent, source, result: { session_id: sid, owner_subject: 'wp:42', candidate_analysis: JSON.parse(JSON.stringify(envelope)) } };
}

async function priorFixture() {
  const saved = await Promise.all([savedSourcePractice(1), savedSourcePractice(2)]);
  const current = { ...sessionRow(), state: 'active', context: { contextSources: ['Prior IVOC'] } };
  const repo = repository(); const single = repo.single; const paths = [];
  const data = { current, sessions: saved.map(item => item.row), results: saved.map(item => item.result),
    recordings: saved.flatMap(item => [item.parent, item.source]), onRead: null };
  repo.request = async path => {
    paths.push(path); if (data.onRead) await data.onRead(path);
    return path.startsWith('ivoc_sessions?') ? data.sessions : path.startsWith('ivoc_results?') ? data.results
      : path.startsWith('ivoc_recordings?') ? data.recordings : [];
  };
  repo.single = async path => {
    paths.push(path); if (data.onRead) await data.onRead(path);
    return path.startsWith(`ivoc_sessions?id=eq.${SESSION_ID}`) ? data.current : single(path);
  };
  return { repo, data, paths, saved };
}

test('source-bound Prior IVOC aggregates cited patterns across two distinct sessions without fabricated pattern scores', async () => {
  const h = await priorFixture();
  const projection = await readSourceBoundLongitudinalProjection({ repository: h.repo, actor: 'wp:42', session: h.data.current });
  assert.equal(projection.projection_type, 'ivoc.longitudinal_summary');
  assert.deepEqual(projection.payload.recurring.weaknesses[0].sessions, h.saved.map(item => item.row.id));
  assert.equal(projection.payload.recurring.weaknesses[0].evidence_refs.length, 4);
  assert.match(projection.source_version, /^source-bound-long-[0-9a-f]{32}$/u);
  assert.equal(JSON.stringify(projection).includes('private/'), false);
  assert.equal(JSON.stringify(projection).includes('I learned a lot.'), false);
  assert.equal(Object.hasOwn(projection.payload.recurring.weaknesses[0], 'score'), false);
  assert.equal(h.paths.some(path => path.startsWith('ivoc_coaching_evidence?')), false);
  h.data.sessions = [h.saved[0].row];
  assert.equal(await readSourceBoundLongitudinalProjection({ repository: h.repo, actor: 'wp:42', session: h.data.current }), null);
  h.data.sessions = [h.saved[0].row, h.saved[0].row];
  assert.equal(await readSourceBoundLongitudinalProjection({ repository: h.repo, actor: 'wp:42', session: h.data.current }), null);
});

test('Prior IVOC opt-in and current owner identity gate all historical reads', async () => {
  const h = await priorFixture();
  for (const current of [{ ...h.data.current, context: {} }, { ...h.data.current, owner_subject: 'wp:7' },
    { ...h.data.current, id: '../unsafe' }]) {
    assert.equal(await readSourceBoundLongitudinalProjection({ repository: h.repo, actor: 'wp:42', session: current }), null);
  }
  assert.deepEqual(h.paths, []);
});

test('AVAILABLE source custody does not make zero/low analysis-quality evidence eligible for recurrence', async () => {
  for (const [score, coverage, eligible] of [[0, .9, false], [.9, 0, false], [.64, .9, false], [.9, .64, false], [.65, .65, true]]) {
    const h = await priorFixture();
    const analysis = h.data.results[1].candidate_analysis.result.analysis;
    assert.equal(analysis.status, 'AVAILABLE'); analysis.score = score; analysis.coverage = coverage;
    const projection = await readSourceBoundLongitudinalProjection({ repository: h.repo, actor: 'wp:42', session: h.data.current });
    assert.equal(Boolean(projection), eligible, `score=${score}, coverage=${coverage}`);
    if (projection) {
      assert.match(projection.minimization.fields_excluded_reason.analysis_quality, /not calibration, per-pattern scores, or speaker identity proof/u);
      assert.equal(Object.hasOwn(projection.payload.recurring.weaknesses[0], 'score'), false);
    }
  }
});

test('active, foreign, mixed, legacy and tampered saved analyses cannot contribute recurrence', async () => {
  const mutations = [h => { h.data.sessions[1].state = 'active'; }, h => { h.data.sessions[1].owner_subject = 'wp:7'; },
    h => { h.data.sessions[1].interviewer_provider = 'openai-gpt-live'; }, h => { delete h.data.sessions[1].context.promptReceipt; },
    h => { h.data.results[1].owner_subject = 'wp:7'; }, h => { h.data.results[1].candidate_analysis = null; },
    h => { h.data.results[1].candidate_analysis.result.analysis.coachingPatterns[0].transcriptSegmentIds = ['missing']; },
    h => { h.data.recordings[3].parent_recording_id = SESSION_ID; }, h => { h.data.recordings[3].owner_subject = 'wp:7'; },
    h => { h.data.recordings[3].recording_role = 'conversation'; }, h => { h.data.recordings[2].etag = 'mutated'; },
    h => { h.data.recordings.push(h.data.recordings[3]); }, h => { h.data.results.push(h.data.results[1]); }];
  for (const mutate of mutations) {
    const h = await priorFixture(); mutate(h);
    assert.equal(await readSourceBoundLongitudinalProjection({ repository: h.repo, actor: 'wp:42', session: h.data.current }), null);
  }
});

test('prepared Prior IVOC actor packs revalidate exact source and semantic fingerprints on HQ/native/inactive reads', async () => {
  const h = await priorFixture(); const service = createIvocApplicationIntelligence({ repository: h.repo, now: () => Date.parse(NOW) });
  await service.prepareSession({ actor: 'wp:42', sessionRow: h.data.current });
  const pack = h.repo.upserts.find(entry => entry.table === 'ivoc_context_packs').body;
  assert.equal(pack.source_receipts.some(receipt => receipt.projection_type === 'ivoc.longitudinal_summary'), true);
  assert.equal(pack.pack.signals.some(signal => signal.rule_id === 'AIS-R10'), true);
  const rest = { table: async (table, query) => { const path = `${table}${query}`;
    if (query.includes('limit=1')) { const row = await h.repo.single(path); return row ? [row] : []; }
    return h.repo.request(path); } };
  const native = createIvocContextPackResolver({ rest });
  const context = { goal: 'Individual question', interviewer: 'Program Director · balanced', pressurePractice: false,
    questionIds: ['CORE-01'], targetQuestions: 1, program: 'General residency interview', environment: 'MissionMed · interview only' };
  const inactive = createIvocActorInstructionResolver({ rest, readSessionContext: async () => ({ ownerSubject: 'wp:42', sessionId: SESSION_ID, state: 'active', context }) });
  assert.ok(await service.getActorContext({ actor: 'wp:42', sessionId: SESSION_ID }));
  assert.ok(await native({ subject: 'wp:42', sessionId: SESSION_ID }));
  assert.ok(await inactive({ subject: 'wp:42', sessionId: SESSION_ID }));
  // Same pattern IDs/sessions but changed valid semantic wording must change provenance.
  h.data.results[1].candidate_analysis.result.analysis.coachingPatterns[0].text = 'A differently worded safe observation.';
  assert.equal(await service.getActorContext({ actor: 'wp:42', sessionId: SESSION_ID }), null);
  assert.equal(await native({ subject: 'wp:42', sessionId: SESSION_ID }), null);
  await assert.rejects(() => inactive({ subject: 'wp:42', sessionId: SESSION_ID }), /context pack is unavailable/u);
  assert.equal(pack.invalidated_at, null, 'read rejection does not rewrite or destroy the prepared pack');
});

test('source pack read rejects deselection, ownership/state drift and asynchronous source/pack mutation', async () => {
  for (const kind of ['deselection', 'owner', 'state', 'async-source', 'async-pack']) {
    const h = await priorFixture(); const service = createIvocApplicationIntelligence({ repository: h.repo, now: () => Date.parse(NOW) });
    await service.prepareSession({ actor: 'wp:42', sessionRow: h.data.current });
    const pack = h.repo.upserts.find(entry => entry.table === 'ivoc_context_packs').body;
    if (kind === 'deselection') h.data.current.context.contextSources = [];
    if (kind === 'owner') h.data.current.owner_subject = 'wp:7';
    if (kind === 'state') h.data.current.state = 'saved';
    let reads = 0;
    h.data.onRead = async path => {
      if (kind === 'async-source' && path.startsWith('ivoc_results?') && ++reads === 2) h.data.recordings[3].etag = 'changed-in-flight';
      if (kind === 'async-pack' && path.startsWith('ivoc_sessions?id=')) pack.actor_block += '\nchanged-in-flight';
    };
    assert.equal(await service.getActorContext({ actor: 'wp:42', sessionId: SESSION_ID }), null, kind);
  }
  const h = await priorFixture();
  h.data.onRead = async () => { h.data.current.context.contextSources = []; };
  assert.equal(await readSourceBoundLongitudinalProjection({ repository: h.repo, actor: 'wp:42', session: h.data.current }), null);
});

test('Prior IVOC receipt must exactly match current provenance including freshness and consent fields', async () => {
  const h = await priorFixture(); const service = createIvocApplicationIntelligence({ repository: h.repo, now: () => Date.parse(NOW) });
  await service.prepareSession({ actor: 'wp:42', sessionRow: h.data.current });
  const receipts = h.repo.upserts.find(entry => entry.table === 'ivoc_context_packs').body.source_receipts;
  const validate = sourceReceipts => validateSourceBoundPriorIvocPack({ repository: h.repo, actor: 'wp:42', sessionId: SESSION_ID, sourceReceipts });
  assert.equal(await validate(receipts), true);
  const mutations = [receipt => { receipt.fresh_until = '2020-01-01T00:00:00.000Z'; },
    receipt => { receipt.consent_ref = 'browser-invented'; }, receipt => { receipt.extra = 'not-issued'; },
    receipt => { delete receipt.fresh_until; }, receipt => { receipt.source_receipt_hash = '0'.repeat(64); },
    receipt => { receipt.source_version = `source-bound-long-${'0'.repeat(32)}`; }];
  for (const mutate of mutations) {
    const changed = structuredClone(receipts);
    mutate(changed.find(receipt => receipt.projection_type === 'ivoc.longitudinal_summary'));
    assert.equal(await validate(changed), false);
  }
});

test('session preparation persists one fail-closed pack and pins its server receipt', async () => {
  const repo = repository();
  const service = createIvocApplicationIntelligence({ repository: repo, now: () => Date.parse(NOW) });
  const prepared = await service.prepareSession({ actor: 'wp:42', sessionRow: sessionRow() });

  const packWrite = repo.upserts.find((entry) => entry.table === 'ivoc_context_packs');
  const contractWrite = repo.upserts.find((entry) => entry.table === 'ivoc_session_contracts');
  assert.equal(packWrite.conflict, 'session_id,pack_version');
  assert.equal(packWrite.body.schema_name, 'ivoc.interview_context_pack.v1');
  assert.equal(packWrite.body.owner_subject, 'wp:42');
  assert.deepEqual(packWrite.body.pack.facts, []);
  assert.deepEqual(packWrite.body.pack.signals, []);
  assert.ok(Buffer.byteLength(packWrite.body.actor_block) <= 6144);
  assert.match(prepared.receipt, /^ctxpack:[0-9a-f-]+@[0-9a-f]{64}$/u);
  assert.deepEqual(contractWrite.body.context_receipts, [prepared.receipt]);
  assert.equal(contractWrite.body.practice_goal, 'individual_question');
  assert.equal(contractWrite.body.contract_state, 'ready_check');
});

test('actor context read is owner-scoped and returns only the bounded actor projection', async () => {
  const repo = repository();
  const service = createIvocApplicationIntelligence({ repository: repo, now: () => Date.parse(NOW) });
  const prepared = await service.prepareSession({ actor: 'wp:42', sessionRow: sessionRow() });
  const actorContext = await service.getActorContext({ actor: 'wp:42', sessionId: SESSION_ID });
  assert.equal(actorContext.receipt, prepared.receipt);
  assert.equal(typeof actorContext.actorBlock, 'string');
  assert.deepEqual(Object.keys(actorContext).sort(), ['actorBlock', 'receipt']);
});

test('receipt readback accepts only persisted context-pack receipts', async () => {
  const repo = {
    single: async () => ({ context_receipts: ['forged:browser', 'ctxpack:a@b', 'ctxpack:a@b', 42] }),
  };
  assert.deepEqual(await readSessionContextReceipts(repo, SESSION_ID), ['ctxpack:a@b']);
});

test('repository-backed Mentor Top 3 becomes a provenance-bound interviewer attention signal', async () => {
  const writes = repository();
  const priorityRow = {
    subject_id: 'wp:42', version: 3,
    priorities: [{ id: 'leadership', text: 'Can you give me one concrete example that shows your leadership?', rank: 1 }],
    mentor_notes: [{ id: 'private', text: 'Student tends to bury the point.', visibility: 'mentor_only' }],
    set_by: 'wp:1', created_at: NOW,
  };
  const originalSingle = writes.single;
  writes.single = async (path) => path.startsWith('ivoc_mentor_priority_sets?subject_id=eq.wp%3A42')
    ? priorityRow : originalSingle(path);

  const provider = createIvocProjectionProvider({ repository: writes });
  const projections = await provider({ actor: 'wp:42' });
  assert.equal(projections.length, 1);
  assert.equal(projections[0].projection_type, 'ivoc.mentor_priorities');
  assert.equal(projections[0].source_version, 'mp-v3');
  assert.match(projections[0].source_receipt.hash, /^[0-9a-f]{64}$/u);

  const service = createIvocApplicationIntelligence({ repository: writes, now: () => Date.parse(NOW) });
  await service.prepareSession({ actor: 'wp:42', sessionRow: sessionRow() });
  const pack = writes.upserts.find((entry) => entry.table === 'ivoc_context_packs').body.pack;
  assert.ok(pack.inputs.some((input) => input.projection_type === 'ivoc.mentor_priorities'));
  assert.ok(pack.facts.some((fact) => fact.fact_type === 'mentor_priority' && fact.student_visible === false));
  assert.ok(pack.signals.some((signal) => signal.rule_id === 'AIS-R09'));
  assert.match(pack.actor_block, /Can you give me one concrete example that shows your leadership\?/u);
  assert.doesNotMatch(pack.actor_block, /bury the point/u);
});

test('selected File Vault CV is owner-read once and becomes provenance-bound application context', async () => {
  const repo = repository();
  const reads = [];
  const fileVaultSource = {
    read: async (input) => {
      reads.push(input);
      return {
        projection_id: 'filevault-cv:document-42', owner_app: 'filevault',
        projection_type: 'filevault.document_projection', schema_version: '1', subject_id: 'wp:42',
        source_version: 'cv:document-42@version-3', produced_at: NOW,
        authorization: { basis: 'student_consent', scope: ['entries'], consent_ref: `ivoc-session:${SESSION_ID}` },
        minimization: { fields_included: ['entries'] },
        payload: {
          doc_id: 'document-42', kind: 'cv', version: '3', content_hash: 'b'.repeat(64), as_of: '2026-09-20',
          entries: [{ entry_id: 'research-1', entry_type: 'research_item', title: 'A verified quality-improvement project', role: 'lead' }],
        },
        source_receipt: { owner_ref: 'filevault:document-42@version-3', hash: 'c'.repeat(64) },
        revocation: { revocable: true },
      };
    },
  };
  const row = sessionRow();
  row.context = { contextSources: ['CV'] };
  const service = createIvocApplicationIntelligence({ repository: repo, fileVaultSource, now: () => Date.parse(NOW) });
  await service.prepareSession({ actor: 'wp:42', sessionRow: row, authorization: 'Bearer owner-session-token' });
  assert.deepEqual(reads, [{ actor: 'wp:42', sessionId: SESSION_ID, authorization: 'Bearer owner-session-token' }]);
  const pack = repo.upserts.find((entry) => entry.table === 'ivoc_context_packs').body.pack;
  assert.ok(pack.inputs.some((input) => input.projection_type === 'filevault.document_projection'));
  assert.ok(pack.facts.some((fact) => fact.fact_type === 'research_item'));
  assert.match(pack.actor_block, /quality-improvement project/u);
});

test('File Vault is not read unless selected, and a selected unavailable projection fails closed', async () => {
  const repo = repository();
  let reads = 0;
  const fileVaultSource = { read: async () => { reads += 1; return null; } };
  const provider = createIvocProjectionProvider({ repository: repo, fileVaultSource });
  await provider({ actor: 'wp:42', session: sessionRow(), authorization: 'Bearer owner-session-token' });
  assert.equal(reads, 0);

  const selected = sessionRow();
  selected.context = { contextSources: ['File Vault'] };
  await assert.rejects(
    () => provider({ actor: 'wp:42', session: selected, authorization: 'Bearer owner-session-token' }),
    /projection_unavailable/u,
  );
  assert.equal(reads, 1);
});

test('selected StoryForge is owner-read once and enters the context pack as consented story evidence', async () => {
  const repo = repository();
  const reads = [];
  const storyForgeSource = {
    read: async (input) => {
      reads.push(input);
      return {
        projection_id: 'storyforge-approved-stories:wp:42', owner_app: 'storyforge',
        projection_type: 'storyforge.approved_stories', schema_version: '1', subject_id: 'wp:42',
        source_version: 'sf-ivoc-42', produced_at: NOW,
        authorization: { basis: 'student_consent', scope: ['approved_story_summary'], consent_ref: 'storyforge:consent-42' },
        minimization: { fields_included: ['stories'] },
        payload: { stories: [{
          story_id: '33333333-3333-4333-8333-333333333333', version: '7', consent_state: 'granted',
          title: 'Night shift turnaround', themes: ['teamwork'],
          summary: 'I clarified roles, closed two safety gaps, and confirmed shared ownership.',
        }] },
        source_receipt: { owner_ref: 'storyforge:wp:42@sf-ivoc-42', hash: 'd'.repeat(64) },
        revocation: { revocable: true },
      };
    },
  };
  const row = sessionRow();
  row.context = { contextSources: ['StoryForge'] };
  const service = createIvocApplicationIntelligence({ repository: repo, storyForgeSource, now: () => Date.parse(NOW) });
  await service.prepareSession({ actor: 'wp:42', sessionRow: row, authorization: 'Bearer owner-session-token' });
  assert.deepEqual(reads, [{ actor: 'wp:42', sessionId: SESSION_ID, authorization: 'Bearer owner-session-token' }]);
  const pack = repo.upserts.find((entry) => entry.table === 'ivoc_context_packs').body.pack;
  assert.ok(pack.inputs.some((input) => input.projection_type === 'storyforge.approved_stories'));
  assert.ok(pack.facts.some((fact) => fact.fact_type === 'story_theme' && fact.attributes.consent_state === 'granted'));
});

test('StoryForge is not read unless selected, and selected absence fails closed', async () => {
  const repo = repository();
  let reads = 0;
  const storyForgeSource = { read: async () => { reads += 1; return null; } };
  const provider = createIvocProjectionProvider({ repository: repo, storyForgeSource });
  await provider({ actor: 'wp:42', session: sessionRow(), authorization: 'Bearer owner-session-token' });
  assert.equal(reads, 0);

  const selected = sessionRow();
  selected.context = { contextSources: ['StoryForge'] };
  await assert.rejects(
    () => provider({ actor: 'wp:42', session: selected, authorization: 'Bearer owner-session-token' }),
    /storyforge_projection_unavailable/u,
  );
  assert.equal(reads, 1);
});

test('selected RISE program is owner-read once and binds the exact program and release to the context pack', async () => {
  const repo = repository();
  const reads = [];
  const riseSource = {
    read: async (input) => {
      reads.push(input);
      return {
        projection_id: 'rise-program:wp:42:rise_ps_test', owner_app: 'rise',
        projection_type: 'rise.program_cheat_sheet', schema_version: '1', subject_id: 'wp:42',
        source_version: 'rise-ivoc-release-test', produced_at: NOW,
        authorization: { basis: 'owner_policy', consent_ref: `ivoc-session:${SESSION_ID}`, scope: ['program_identity'] },
        minimization: { fields_included: ['program_id', 'name', 'high_yield_facts', 'people'] },
        payload: {
          program_id: 'rise_ps_test', name: 'Example Internal Medicine Residency', specialty: 'Internal Medicine',
          high_yield_facts: [{ fact: 'Curriculum: Resident-led quality improvement', source_ref: 'rise:test:curriculum' }],
          people: [{ role: 'Program Director', source_ref: 'rise:test:leadership' }],
        },
        source_receipt: { owner_ref: 'rise:test', hash: 'e'.repeat(64) }, revocation: { revocable: true },
      };
    },
  };
  const row = sessionRow();
  row.context = {
    contextSources: ['RISE'], programId: 'rise_ps_test', programReleaseId: 'rise_registry_test',
  };
  const service = createIvocApplicationIntelligence({ repository: repo, riseSource, now: () => Date.parse(NOW) });
  await service.prepareSession({ actor: 'wp:42', sessionRow: row, sessionCookie: `mmhq_session=${'s'.repeat(32)}` });
  assert.deepEqual(reads, [{
    actor: 'wp:42', sessionId: SESSION_ID, sessionCookie: `mmhq_session=${'s'.repeat(32)}`,
    programId: 'rise_ps_test', registryReleaseId: 'rise_registry_test',
  }]);
  const pack = repo.upserts.find((entry) => entry.table === 'ivoc_context_packs').body.pack;
  assert.equal(pack.program.program_ref, 'rise_ps_test');
  assert.ok(pack.inputs.some((input) => input.projection_type === 'rise.program_cheat_sheet'));
  assert.match(pack.actor_block, /Example Internal Medicine Residency/u);
});

test('RISE is not read unless selected, and selection requires an exact canonical program and release', async () => {
  const repo = repository();
  let reads = 0;
  const riseSource = { read: async () => { reads += 1; return null; } };
  const provider = createIvocProjectionProvider({ repository: repo, riseSource });
  await provider({ actor: 'wp:42', session: sessionRow(), sessionCookie: `mmhq_session=${'s'.repeat(32)}` });
  assert.equal(reads, 0);

  const selected = sessionRow();
  selected.context = { contextSources: ['RISE'] };
  await assert.rejects(() => provider({ actor: 'wp:42', session: selected }), /program_selection_required/u);
  assert.equal(reads, 0);
});

test('prior-IVOC projection requires two distinct saved sessions and bounded structured evidence', async () => {
  const rows = [
    {
      evidence_id: 'evidence:a:1', session_id: 'session-a', subject_id: 'wp:42',
      dimension: 'semantic.coaching_pattern', refs: [{ kind: 'transcript_span', ref: 'transcript:a#seg-1' }],
      interpretation: { facet: 'structure', polarity: 'weakness', text: 'The main point arrives after the detail.' },
      score: { value: 0.82, scale: '0..1', basis: 'context_analysis' }, confidence: 0.88, limitations: [], version: 1, created_at: '2026-09-18T10:00:00.000Z',
    },
    {
      evidence_id: 'evidence:b:1', session_id: 'session-b', subject_id: 'wp:42',
      dimension: 'semantic.coaching_pattern', refs: [{ kind: 'transcript_span', ref: 'transcript:b#seg-1' }],
      interpretation: { facet: 'structure', polarity: 'weakness', text: 'The main point arrives after the detail.' },
      score: { value: 0.84, scale: '0..1', basis: 'context_analysis' }, confidence: 0.9, limitations: [], version: 1, created_at: '2026-09-19T10:00:00.000Z',
    },
    {
      evidence_id: 'evidence:c:1', session_id: 'session-c', subject_id: 'wp:42',
      dimension: 'semantic.coaching_pattern', refs: [{ kind: 'transcript_span', ref: 'transcript:c#seg-1' }],
      interpretation: { facet: 'specificity', polarity: 'strength', text: 'A concrete example is present.' },
      score: { value: 0.9, scale: '0..1', basis: 'context_analysis' }, confidence: 0.91, limitations: [], version: 1, created_at: '2026-09-19T11:00:00.000Z',
    },
    {
      evidence_id: 'evidence:low:1', session_id: 'session-d', subject_id: 'wp:42',
      dimension: 'semantic.coaching_pattern', refs: [{ kind: 'transcript_span', ref: 'transcript:d#seg-1' }],
      interpretation: { facet: 'structure', polarity: 'weakness', text: 'Low-confidence observation.' },
      score: { value: 0.4, scale: '0..1', basis: 'context_analysis' }, confidence: 0.4, limitations: [], version: 1, created_at: '2026-09-19T12:00:00.000Z',
    },
  ];
  const projection = longitudinalProjection(rows, 'wp:42');
  assert.equal(projection.projection_type, 'ivoc.longitudinal_summary');
  assert.deepEqual(projection.payload.recurring.weaknesses, [{
    facet: 'structure', sessions: ['session-a', 'session-b'], evidence_refs: ['evidence:a:1', 'evidence:b:1'],
  }]);
  assert.deepEqual(projection.payload.recurring.strengths, []);
  assert.equal(projection.produced_at, '2026-09-19T10:00:00.000Z');
  assert.match(projection.source_receipt.hash, /^[0-9a-f]{64}$/u);
  assert.equal(longitudinalProjection(rows.slice(0, 1), 'wp:42'), null);
});

test('production projection withholds historical coaching without candidate-source provenance', async () => {
  const repo = repository();
  const calls = [];
  repo.request = async (path) => {
    calls.push(path);
    if (path.startsWith('ivoc_sessions?')) return [{ id: SESSION_ID }, { id: 'session-a' }, { id: 'session-b' }];
    if (path.startsWith('ivoc_coaching_evidence?')) return [
      {
        evidence_id: 'evidence:a', session_id: 'session-a', subject_id: 'wp:42', dimension: 'semantic.coaching_pattern',
        refs: [{ kind: 'transcript_span', ref: 'a#1' }], interpretation: { facet: 'evidence', polarity: 'weakness' },
        score: { value: 0.9, scale: '0..1', basis: 'context_analysis' }, confidence: 0.9, limitations: [], version: 1, created_at: '2026-09-18T10:00:00Z',
      },
      {
        evidence_id: 'evidence:b', session_id: 'session-b', subject_id: 'wp:42', dimension: 'semantic.coaching_pattern',
        refs: [{ kind: 'transcript_span', ref: 'b#1' }], interpretation: { facet: 'evidence', polarity: 'weakness' },
        score: { value: 0.9, scale: '0..1', basis: 'context_analysis' }, confidence: 0.9, limitations: [], version: 1, created_at: '2026-09-19T10:00:00Z',
      },
    ];
    return [];
  };
  const provider = createIvocProjectionProvider({ repository: repo });
  const projections = await provider({ actor: 'wp:42', session: sessionRow() });
  assert.deepEqual(projections, []);
  assert.deepEqual(calls, [], 'no unverified historical evidence is fetched or projected');

  const service = createIvocApplicationIntelligence({ repository: repo, now: () => Date.parse(NOW) });
  await service.prepareSession({ actor: 'wp:42', sessionRow: sessionRow() });
  const pack = repo.upserts.find((entry) => entry.table === 'ivoc_context_packs').body.pack;
  assert.ok(!pack.signals.some((signal) => signal.rule_id === 'AIS-R10'));
  assert.doesNotMatch(pack.actor_block, /session-a|session-b/u);
});

test('prepared packs with historical prior-IVOC receipts are not reused or destructively rewritten', async () => {
  const repo = repository();
  const historical = { pack_id: 'prior-pack', pack_version: 'prior-version',
    actor_block: 'Unverified candidate observation',
    source_receipts: [{ owner_app: 'ivoc', projection_type: 'ivoc.longitudinal_summary' }] };
  const paths = [];
  repo.single = async path => { paths.push(path); return historical; };
  const service = createIvocApplicationIntelligence({ repository: repo });
  assert.equal(await service.getActorContext({ actor: 'wp:42', sessionId: SESSION_ID }), null);
  assert.deepEqual(repo.upserts, []);
  assert.equal(historical.actor_block, 'Unverified candidate observation');
  assert.ok(paths[0].includes('owner_subject=eq.wp%3A42'));
  assert.ok(paths[0].includes('source_receipts'));
  delete historical.source_receipts;
  assert.equal(await service.getActorContext({ actor: 'wp:42', sessionId: SESSION_ID }), null,
    'missing provenance does not establish safe legacy context');
  historical.source_receipts = [{ owner_app: 'file_vault', projection_type: 'file_vault.cv' }];
  assert.equal((await service.getActorContext({ actor: 'wp:42', sessionId: SESSION_ID })).actorBlock,
    historical.actor_block, 'unrelated owner context remains available');
});

test('session contract pins the exact versioned Admin Analytics and InterviewBrain configuration', async () => {
  const repo = repository();
  const originalSingle = repo.single;
  repo.single = async (path) => path.startsWith('ivoc_admin_config_versions?')
    ? {
      version: 4,
      analytics_config_version: 'ivoc.analytics.v4',
      brain_pack_version: 'gpt-live-1:meridian',
      ais_rules_version: '2026-09-18.2',
      pressure_defaults: { default_follow_up_intensity: 2 },
    }
    : originalSingle(path);
  const service = createIvocApplicationIntelligence({ repository: repo, now: () => Date.parse(NOW) });
  await service.prepareSession({ actor: 'wp:42', sessionRow: sessionRow() });
  const contract = repo.upserts.find((entry) => entry.table === 'ivoc_session_contracts').body;
  assert.equal(contract.admin_config_version, 4);
  assert.equal(contract.analytics_config_version, 'ivoc.analytics.v4');
  assert.equal(contract.brain_pack_version, 'gpt-live-1:meridian');
  assert.equal(contract.ais_rules_version, '2026-09-18.2');
  assert.equal(contract.follow_up_intensity, 2);
});
