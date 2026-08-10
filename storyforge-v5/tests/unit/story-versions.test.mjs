import assert from 'node:assert/strict';
import test from 'node:test';
import { createStoryVersionsService, StoryVersionsError } from '../../server/story-versions.mjs';

const storyId = '11111111-1111-4111-8111-111111111111';
const revisionId = '22222222-2222-4222-8222-222222222222';
const identity = { sub: storyId, role: 'student', eligible: true };

function service({ environment = { STORYFORGE_STORY_VERSIONS_FORCE_OFF: '0' }, query } = {}) {
  return createStoryVersionsService({
    environment,
    withIdentity: async (_identity, operation) => operation({
      async query(sql, values) {
        if (sql.includes('sf_story_versions_enabled')) return { rows: [{ enabled: true }] };
        if (query) return query(sql, values);
        return { rows: [{ payload: { ok: true } }] };
      },
    }),
  });
}

test('version capability is independently force-off and defaults closed', async () => {
  assert.equal(await service({ environment: {} }).capability(identity), false);
  assert.equal(await service().capability(identity), true);
  assert.equal(await service().capability({ ...identity, eligible: false }), false);
});

test('save permits only the two additive keys and bounded row-versioned modes', async () => {
  let captured;
  const subject = service({ query: async (sql, values) => { captured = { sql, values }; return { rows: [{ payload: { ok: true } }] }; } });
  await subject.save(identity, storyId, 'thirty_second', {
    body: 'A concise telling.', mode: 'append', source: 'typed', expectedVersion: 3,
  });
  assert.match(captured.sql, /sf_save_story_version/);
  assert.deepEqual(captured.values.slice(0, 6), [storyId, 'thirty_second', 'A concise telling.', 'append', 'typed', 3]);
  for (const key of ['original', 'full_story', 'anything']) {
    await assert.rejects(() => subject.save(identity, storyId, key, { body: 'x', expectedVersion: 0 }), StoryVersionsError);
  }
});

test('retell may deliberately start blank but normal save cannot', async () => {
  const subject = service();
  await subject.save(identity, storyId, 'nnq_setup', { body: '', mode: 'retell', expectedVersion: 0 });
  await assert.rejects(() => subject.save(identity, storyId, 'nnq_setup', { body: '', mode: 'save', expectedVersion: 0 }), /could not be saved/);
});

test('restore is owner-only and row-versioned', async () => {
  let captured;
  const subject = service({ query: async (sql, values) => { captured = { sql, values }; return { rows: [{ payload: { ok: true } }] }; } });
  await subject.restore(identity, storyId, { versionKey: 'nnq_setup', revisionId, expectedVersion: 4 });
  assert.match(captured.sql, /sf_restore_story_version/);
  assert.deepEqual(captured.values, [storyId, 'nnq_setup', revisionId, 4]);
  await assert.rejects(() => subject.restore({ ...identity, role: 'mentor' }, storyId, { versionKey: 'nnq_setup', revisionId, expectedVersion: 4 }), /Only the story owner/);
});

test('database conflicts are private HTTP 409 results', async () => {
  const subject = service({ query: async () => { const error = new Error('private database detail'); error.code = '40001'; throw error; } });
  await assert.rejects(
    () => subject.save(identity, storyId, 'thirty_second', { body: 'x', expectedVersion: 0 }),
    (error) => error.code === 'story_version_conflict' && error.status === 409 && !error.message.includes('private database detail'),
  );
});
