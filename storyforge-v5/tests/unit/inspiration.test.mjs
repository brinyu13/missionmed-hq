import assert from 'node:assert/strict';
import test from 'node:test';
import { createInspirationService, deterministicPrompt, InspirationError } from '../../server/inspiration.mjs';

const studentId = '11111111-1111-4111-8111-111111111111';
const promptId = '22222222-2222-4222-8222-222222222222';
const sessionId = '33333333-3333-4333-8333-333333333333';
const identity = { sub: studentId, role: 'student', eligible: true };
const rows = [
  { id: promptId, library_key: 'q-001', text: 'A prompt long enough.', who_ids: ['you'], who_detail_ids: [], domain_ids: ['personal'], energy_ids: ['light'], territory: 'food', follow_up: 'What happened?', interview_use: 'Shows warmth.', state: 'active', recommended: false, row_version: '2' },
  { id: '44444444-4444-4444-8444-444444444444', library_key: 'q-002', text: 'A second prompt.', who_ids: ['family'], who_detail_ids: [], domain_ids: ['personal'], energy_ids: ['light'], territory: 'family', follow_up: 'What happened?', interview_use: 'Shows care.', state: 'active', recommended: true, row_version: '2' },
];

function service({ environment = { STORYFORGE_INSPIRATION_FORCE_OFF: '0' }, query } = {}) {
  return createInspirationService({ environment, withIdentity: async (_identity, operation) => operation({
    async query(sql, values) {
      if (sql.includes('sf_story_feature_enabled')) return { rows: [{ enabled: true }] };
      if (query) return query(sql, values);
      if (sql.includes('FROM public.sf_inspiration_prompts')) return { rows };
      return { rows: [], rowCount: 1 };
    },
  }) });
}

test('Inspiration defaults closed and remains student-only', async () => {
  assert.equal(await service({ environment: {} }).capability(identity), false);
  assert.equal(await service().capability(identity), true);
  assert.equal(await service().capability({ ...identity, role: 'mentor' }), false);
});

test('prompt selection is deterministic and honors the score band and exclusions', () => {
  const input = { who: 'you', whoDetail: '', domain: 'personal', energy: 'light', excludeIds: [], sessionId };
  const first = deterministicPrompt(rows, input, studentId, 2);
  const second = deterministicPrompt(rows, input, studentId, 2);
  assert.equal(first.id, second.id);
  assert.equal(first.id, promptId);
  assert.equal(deterministicPrompt(rows, { ...input, excludeIds: [promptId] }, studentId, 2).library_key, 'q-002');
});

test('next records only content-free dimensions', async () => {
  const calls = [];
  const subject = service({ query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('FROM public.sf_inspiration_prompts')) return { rows };
    return { rows: [], rowCount: 1 };
  } });
  const result = await subject.next(identity, { who: 'you', domain: 'personal', energy: 'light', sessionId, excludeIds: [] });
  assert.equal(result.prompt.id, promptId);
  const event = calls.find((call) => call.sql.includes('sf_inspiration_record_event'));
  assert.ok(event);
  assert.doesNotMatch(JSON.stringify(event.values), /A prompt long enough/);
});

test('analytics reject private content keys', async () => {
  await assert.rejects(
    () => service().event(identity, promptId, sessionId, 'answered', { dimensions: { transcript: 'private words' } }),
    (error) => error instanceof InspirationError && error.code === 'private_event_content',
  );
});

test('save is bounded and remove remains owner scoped', async () => {
  let captured;
  const subject = service({ query: async (sql, values) => {
    captured = { sql, values };
    if (sql.includes('sf_inspiration_save')) return { rows: [{ payload: { id: 'saved' } }], rowCount: 1 };
    return { rows: [{ payload: { removed: true } }], rowCount: 1 };
  } });
  await subject.save(identity, { promptId, promptText: 'A safe prompt snapshot', draft: 'draft', kind: 'saved' });
  assert.match(captured.sql, /sf_inspiration_save/);
  await subject.removeSaved(identity, '55555555-5555-4555-8555-555555555555');
  assert.match(captured.sql, /sf_inspiration_remove_saved/);
  await assert.rejects(() => subject.save(identity, { promptText: 'x', draft: '' }), /cannot be saved/);
});

test('browse returns self-scoped answered state and a pinned projection from one authorized query', async () => {
  let observedSql = '';
  const subject = service({ query: async (sql) => {
    observedSql = sql;
    return { rows: [{
      ...rows[0],
      favorite: true,
      pin_position: 0,
      answered_story_id: '66666666-6666-4666-8666-666666666666',
    }] };
  } });
  const result = await subject.browse(identity, { layout: 'grid' });
  assert.equal(result.prompts[0].answeredStoryId, '66666666-6666-4666-8666-666666666666');
  assert.deepEqual(result.pinned, result.prompts);
  assert.match(observedSql, /story\.student_id=public\.sf_actor_id\(\)/);
  assert.match(observedSql, /story\.origin->>'inspirationPromptId'/);
});
