import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createIvocContextPackResolver } from '../../server/providers/ivoc-context-pack-resolver.mjs';
import { createIvocApplicationIntelligence } from '../../../missionmed-hq/ivoc/application-intelligence.mjs';
import { rebuildSelfPracticeAnswerSource, packageSelfPracticeAnalysis } from '../../../missionmed-hq/ivoc/self-practice-analysis.mjs';
import { createContextIntelligenceProvider } from '../../../missionmed-hq/ivoc/context-provider.mjs';

// Execute the production class (including its real allowlists/request path),
// without importing the unrelated optional LiveKit worker dependency.
const source = readFileSync(new URL('../../server/providers/supabase-durable-adapter.mjs', import.meta.url), 'utf8');
const exactClass = source.slice(source.indexOf("const PRODUCT_PROJECT_REF ="), source.indexOf('export class SupabaseAdmissionRegistry'))
  .replace('export class IvPrepSupabaseRest', 'class IvPrepSupabaseRest');
const IvPrepSupabaseRest = vm.runInNewContext(`${exactClass}\nIvPrepSupabaseRest;`, {
  URL, fetch, AbortController, setTimeout, clearTimeout, console, TextDecoder, TextEncoder,
});
const REF = 'bscnrgqlwsyygyfrbhfn';
const SESSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function adapter(reply = () => []) {
  const calls = [];
  const rest = new IvPrepSupabaseRest({ url: `https://${REF}.supabase.co`, expectedProjectRef: REF,
    serviceRoleKey: 'fixture-key-not-a-secret'.repeat(2), fetchImpl: async (url, options) => {
      calls.push({ url, options });
      const value = reply(new URL(url));
      return value instanceof Response ? value : new Response(JSON.stringify(value), { status: 200 });
    } });
  return { rest, calls };
}

// Synthetic, source-valid contracts: no live provider calls or actual capture.
async function savedSourcePractice(number) {
  const uuid = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
  const sid = uuid(number), pid = uuid(number + 100), cid = uuid(number + 200);
  const now = '2026-09-20T14:55:00.000Z'; const owner = 'wp:1';
  const row = { id: sid, owner_subject: owner, state: 'saved', session_type: 'question', interviewer_provider: 'missionmed-static',
    question_id: 'CORE-01', question_text: 'Tell me about yourself.', context: { targetQuestions: 1, questionIds: ['CORE-01'],
      promptReceipt: { schema: 'ivoc.self-practice-prompt.v1', workflow: 'SELF_PRACTICE', questionId: 'CORE-01', version: 1,
        text: 'Tell me about yourself.', approval: 'ACTIVE_AT_SELECTION', issuedAt: now } } };
  const parent = { id: pid, session_id: sid, owner_subject: owner, recording_role: 'conversation', status: 'saved',
    storage_object_key: `private/replay-${number}`, size_bytes: 1000, etag: 'parent-etag', sealed_at: now,
    mime_type: 'video/webm', duration_ms: 1000, paused_spans: [], recording_timebase: { clock: 'browser-monotonic-session',
      recordingId: pid, sessionId: sid, ownerSubject: owner, recordingStartSessionMs: 0, recordingDurationMs: 1000,
      playableDurationMs: 1000, pausedSpans: [] } };
  const stem = { id: cid, session_id: sid, owner_subject: owner, recording_role: 'candidate_audio', status: 'saved',
    parent_recording_id: pid, storage_object_key: `private/microphone-${number}`, size_bytes: 10, etag: 'source-etag', sealed_at: now,
    mime_type: 'audio/webm', duration_ms: 800, paused_spans: [], capture_receipt: { schema: 'ivoc.candidate-audio.v1',
      captureVersion: 'direct-mic-v1', status: 'SEALED', recordingId: cid, sessionId: sid, parentRecordingId: pid,
      allocatedAt: now, sealedAt: now, assurance: 'CLIENT_MIC_CAPTURE_DECLARATION', analysisEligibility: 'UNVERIFIED',
      sizeBytes: 10, etag: 'source-etag', mime: 'audio/webm', timing: { clock: 'browser-monotonic-session', clientAttested: true,
        recordingStartSessionMs: 100, recordingDurationMs: 800, playableDurationMs: 800, pausedSpans: [] } } };
  const answerSource = rebuildSelfPracticeAnswerSource({ session: row, parentRecording: parent, sourceRecording: stem });
  const pattern = { facet: 'structure', polarity: 'weakness', text: 'The supplied response has no concrete event.', transcriptSegmentIds: ['seg-1'] };
  const provider = createContextIntelligenceProvider({ apiKey: 'offline-test-key', fetchImpl: async url => url.endsWith('/transcriptions')
    ? Response.json({ text: 'I learned a lot.', segments: [{ start: 0, end: .5, text: 'I learned a lot.' }] })
    : Response.json({ status: 'completed', output_text: JSON.stringify({ questionIntent: { label: 'GENERAL', score: .9 },
      answerStage: { label: 'UNSUPPORTED', score: .9 }, score: .9, coverage: .9, semanticObservations: [],
      coachingPatterns: [pattern, pattern], contextTags: [], limitations: ['Synthetic contract evidence, not model quality.'] }) }) });
  const result = await provider.analyze({ sessionId: sid, answerId: 'answer-1', answerSource,
    audio: Buffer.from('test-audio'), mimeType: 'audio/webm', transcriptEnabled: true });
  const candidate_analysis = JSON.parse(JSON.stringify(packageSelfPracticeAnalysis({ answerSource, session: row, result, createdAt: now })));
  return { row, parent, stem, result: { session_id: sid, owner_subject: owner, candidate_analysis } };
}

async function sourceHistory() {
  const saved = await Promise.all(Array.from({ length: 20 }, (_, index) => savedSourcePractice(index + 1)));
  const current = { id: SESSION, owner_subject: 'wp:1', state: 'active', session_type: 'question', question_id: 'CORE-01',
    interviewer_provider: 'gpt-live', started_at: '2026-09-20T14:55:00.000Z', context: { contextSources: ['Prior IVOC'] } };
  const data = { saved, current, pack: null };
  const reply = url => {
    if (url.pathname.endsWith('/ivoc_context_packs')) return data.pack ? [data.pack] : [];
    if (url.pathname.endsWith('/ivoc_sessions')) return url.searchParams.get('id') === `eq.${SESSION}`
      ? [data.current] : data.saved.map(item => item.row);
    if (url.pathname.endsWith('/ivoc_results')) return data.saved.map(item => item.result);
    if (url.pathname.endsWith('/ivoc_recordings')) return data.saved.flatMap(item => [item.parent, item.stem]);
    return [];
  };
  const repository = {
    request: async path => structuredClone(reply(new URL(`https://fixture.invalid/rest/v1/${path}`))),
    single: async path => structuredClone(reply(new URL(`https://fixture.invalid/rest/v1/${path}`))[0] || null),
    upsert: async (table, _conflict, body) => { if (table === 'ivoc_context_packs') data.pack = body; return body; },
  };
  const hq = createIvocApplicationIntelligence({ repository, now: () => Date.parse('2026-09-20T14:55:00.000Z') });
  await hq.prepareSession({ actor: 'wp:1', sessionRow: current });
  return { data, reply, hq };
}

test('real context adapter permits exactly GET reads of protected source tables', async () => {
  const { rest, calls } = adapter();
  for (const name of ['ivoc_sessions', 'ivoc_results', 'ivoc_recordings']) {
    const query = `?owner_subject=eq.wp%3A1&session_id=eq.${SESSION}&select=id&limit=1`;
    await rest.table(name, query);
    await rest.table(name, query, { method: 'GET' });
    for (const method of ['POST', 'PATCH', 'DELETE', 'PUT', 'HEAD', 'get', null]) {
      assert.throws(() => rest.table(name, query, { method }), /not approved/);
    }
    assert.throws(() => rest.table(name, query, { body: {} }), /not approved/);
    assert.throws(() => rest.table(name, query, { prefer: 'resolution=merge-duplicates' }), /not approved/);
  }
  assert.equal(calls.length, 6);
  for (const { url, options } of calls) {
    assert.equal(new URL(url).origin, `https://${REF}.supabase.co`);
    assert.equal(new URL(url).searchParams.get('owner_subject'), 'eq.wp:1');
    assert.equal(options.method, 'GET');
    assert.equal(options.body, null);
    assert.equal(options.redirect, 'error');
  }
  assert.throws(() => rest.table('ivoc_private_unknown', '?select=*'), /not approved/);
});

test('actual native resolver reaches the protected session read and rejects stale prior-context custody', async () => {
  const { rest, calls } = adapter(url => url.pathname.endsWith('/ivoc_context_packs') ? [{
    pack_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', pack_version: 'c'.repeat(64),
    actor_block: 'AUTHORIZED APPLICATION CONTEXT\nfixture',
    source_receipts: [{ projection_type: 'ivoc.longitudinal_summary', owner_app: 'ivoc',
      projection_id: 'ivoc-longitudinal:wp:1', source_version: `source-bound-long-${'a'.repeat(32)}`,
      source_receipt_hash: 'b'.repeat(64), authorization_basis: 'owner_policy', degraded: null }],
  }] : []);
  assert.equal(await createIvocContextPackResolver({ rest })({ subject: 'wp:1', sessionId: SESSION }), null);
  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[1].url).pathname, '/rest/v1/ivoc_sessions');
  assert.equal(new URL(calls[1].url).searchParams.get('id'), `eq.${SESSION}`);
  assert.equal(new URL(calls[1].url).searchParams.get('owner_subject'), 'eq.wp:1');
});

test('existing context-pack writes retain their established adapter behavior', async () => {
  const { rest, calls } = adapter();
  await rest.table('ivoc_context_packs', '', { method: 'POST', body: { fixture: true } });
  assert.equal(calls[0].options.method, 'POST');
});

test('native source revalidation traverses all three real read gates, never accepting absent analysis', async () => {
  const { rest, calls } = adapter(url => {
    if (url.pathname.endsWith('/ivoc_context_packs')) return [{
      pack_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', pack_version: 'c'.repeat(64),
      actor_block: 'AUTHORIZED APPLICATION CONTEXT\nfixture',
      source_receipts: [{ projection_type: 'ivoc.longitudinal_summary', owner_app: 'ivoc',
        projection_id: 'ivoc-longitudinal:wp:1', source_version: `source-bound-long-${'a'.repeat(32)}`,
        source_receipt_hash: 'b'.repeat(64), authorization_basis: 'owner_policy', degraded: null }],
    }];
    if (url.pathname.endsWith('/ivoc_sessions')) {
      if (url.searchParams.get('id') === `eq.${SESSION}`) return [{ id: SESSION, owner_subject: 'wp:1', state: 'active', context: { contextSources: ['Prior IVOC'] } }];
      return ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc']
        .map(id => ({ id, owner_subject: 'wp:1', state: 'saved' }));
    }
    return [];
  });
  assert.equal(await createIvocContextPackResolver({ rest })({ subject: 'wp:1', sessionId: SESSION }), null);
  assert.deepEqual(calls.map(call => new URL(call.url).pathname), [
    '/rest/v1/ivoc_context_packs', '/rest/v1/ivoc_sessions', '/rest/v1/ivoc_sessions', '/rest/v1/ivoc_results', '/rest/v1/ivoc_recordings',
  ]);
  for (const call of calls) {
    assert.equal(call.options.method, 'GET');
    assert.equal(new URL(call.url).searchParams.get('owner_subject'), 'eq.wp:1');
  }
});

test('real adapter/native and HQ agree on valid source history larger than the old 64KiB cap', async t => {
  const h = await sourceHistory();
  const historyBytes = Buffer.byteLength(JSON.stringify(h.data.saved.map(item => item.result)));
  assert.ok(historyBytes > 64 * 1024 && historyBytes < 4 * 1024 * 1024, `history bytes=${historyBytes}`);
  t.diagnostic(`20 synthetic source-valid session envelopes: ${historyBytes} UTF-8 bytes.`);
  const expected = await h.hq.getActorContext({ actor: 'wp:1', sessionId: SESSION });
  assert.ok(expected);
  const { rest, calls } = adapter(h.reply);
  assert.deepEqual(await createIvocContextPackResolver({ rest })({ subject: 'wp:1', sessionId: SESSION }), expected);
  assert.ok(calls.filter(call => new URL(call.url).pathname.endsWith('/ivoc_results')).length >= 2);
  assert.ok(calls.every(call => call.options.method === 'GET' && call.options.body === null && !call.options.headers.Prefer));
});

test('oversized protected response cancels its stream before reading remaining private bytes', async () => {
  let cancellations = 0; let pulls = 0;
  const body = new ReadableStream({ pull(controller) { pulls += 1; controller.enqueue(new Uint8Array(4 * 1024 * 1024 + 1)); },
    cancel() { cancellations += 1; } }, { highWaterMark: 0 });
  const { rest } = adapter(() => new Response(body, { headers: { 'content-length': '1' } }));
  await assert.rejects(() => rest.table('ivoc_recordings', '?select=*'), /failed closed/);
  assert.equal(cancellations, 1);
  assert.equal(pulls, 1, 'actual streamed byte count overrides an understated header');
});

test('context-only byte budget accepts its boundary and rejects oversized declared/streamed UTF-8 safely', async () => {
  const maximum = 4 * 1024 * 1024;
  const exact = `"${'x'.repeat(maximum - 2)}"`;
  const { rest } = adapter(() => new Response(exact));
  assert.equal((await rest.table('ivoc_results', '?select=candidate_analysis')).length, maximum - 2);
  for (const response of [new Response(`${exact} `), new Response('[]', { headers: { 'content-length': String(maximum + 1) } }),
    new Response(`"${'é'.repeat(maximum / 2)}"`), new Response('PRIVATE-MEDIA-OR-PROVIDER-DATA', { status: 500 }),
    new Response('PRIVATE-MEDIA-OR-PROVIDER-DATA')]) {
    const { rest: blocked } = adapter(() => response);
    await assert.rejects(() => blocked.table('ivoc_results', '?select=candidate_analysis'),
      error => error.message === 'IV Prep database operation failed closed.' && !error.message.includes('PRIVATE'));
  }
  const { rest: ordinary } = adapter(() => new Response(JSON.stringify('x'.repeat(64 * 1024))));
  await assert.rejects(() => ordinary.table('ivoc_context_packs', '?select=*'), /failed closed/);
  await assert.rejects(() => ordinary.rpc('ivprep_reserve_provider_test', {}), /failed closed/);
  await assert.rejects(() => ordinary.table('ivoc_context_packs', '', { method: 'POST', body: {} }), /failed closed/);
});

test('large valid history still rejects custody, selection and in-flight source mutation', async () => {
  for (const kind of ['custody', 'selection', 'async-source', 'async-pack']) {
    const h = await sourceHistory(); let reads = 0;
    if (kind === 'custody') h.data.saved[0].stem.etag = 'changed-seal';
    if (kind === 'selection') h.data.current.context.contextSources = [];
    const { rest } = adapter(url => {
      if (kind === 'async-source' && url.pathname.endsWith('/ivoc_results') && ++reads === 2) h.data.saved[0].stem.etag = 'changed-during-read';
      if (kind === 'async-pack' && url.pathname.endsWith('/ivoc_sessions')) h.data.pack.actor_block += '\nchanged-during-read';
      return h.reply(url);
    });
    assert.equal(await createIvocContextPackResolver({ rest })({ subject: 'wp:1', sessionId: SESSION }), null, kind);
  }
});
