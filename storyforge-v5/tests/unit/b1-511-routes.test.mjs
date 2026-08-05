import assert from 'node:assert/strict';
import test from 'node:test';

import { createAppServer } from '../../server/app.mjs';

const STUDENT = Object.freeze({
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'student',
  eligible: true,
  wpUserId: 101,
});
const ADMIN = Object.freeze({
  sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'admin',
  eligible: true,
  wpUserId: 107,
});
const STORY = '22222222-2222-4222-8222-222222222222';
const NOTE = '33333333-3333-4333-8333-333333333333';

function runtime() {
  return Object.freeze({
    transcription: { available: false },
    flagService: {
      voiceCapture: async () => false,
    },
    recordingsService: {},
  });
}

async function fixture(context) {
  const calls = [];
  const mentorNotesService = {
    capability: async (identity) => identity.role === 'admin',
    readCapability: async () => true,
    list: async (identity, storyId) => (calls.push(['list', identity, storyId]), []),
    create: async (identity, storyId, body) => (
      calls.push(['create', identity, storyId, body]), { id: NOTE, state: 'draft' }
    ),
    update: async (identity, noteId, body) => (
      calls.push(['update', identity, noteId, body]), { id: NOTE, rowVersion: 2 }
    ),
    publish: async (identity, noteId, body) => (
      calls.push(['publish', identity, noteId, body]), { id: NOTE, state: 'published' }
    ),
    discard: async (identity, noteId, body) => (
      calls.push(['discard', identity, noteId, body]), { id: NOTE, state: 'archived' }
    ),
    uploadAudio: async (identity, noteId, body) => (
      calls.push(['audio', identity, noteId, body]), { id: NOTE, transcript: 'Verbatim.' }
    ),
    playback: async (identity, noteId) => (
      calls.push(['playback', identity, noteId]), { playbackUrl: 'https://private.invalid' }
    ),
  };
  const adminConsoleService = {
    capability: async (identity) => identity.role === 'admin',
    taxonomy: async (identity, storyId, body) => (
      calls.push(['adminTaxonomy', identity, storyId, body]), { story: { id: storyId } }
    ),
  };
  const identityTransaction = async (identity, operation) => operation({
    async query(sql, values = []) {
      if (sql && typeof sql === 'object') {
        values = sql.values || [];
        sql = sql.text || '';
      }
      calls.push(['query', identity, sql, values]);
      if (String(sql).includes('sf_update_story_taxonomy')) {
        return { rows: [{ story: {
          id: STORY, rowVersion: 2, categories: values[2], uses: values[3],
        } }] };
      }
      if (String(sql).includes('sf_update_story_priority')) {
        return { rows: [{ story: { id: STORY, rowVersion: 2, priority: values[2] } }] };
      }
      if (String(sql).includes('sf_withdraw_story')) {
        return { rows: [{ id: STORY, row_version: 3, status: 'private' }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  });
  const server = createAppServer({
    authorizeRequest: async (request) => (
      request.headers['x-test-role'] === 'admin' ? ADMIN : STUDENT
    ),
    identityTransaction,
    phaseOneRuntime: runtime(),
    adminConsoleService,
    mentorNotesService,
    reportError() {},
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { calls, origin: `http://127.0.0.1:${server.address().port}` };
}

async function json(response) {
  return { status: response.status, body: await response.json() };
}

test('student taxonomy and priority routes preserve row-versioned bounded RPC ownership', async (context) => {
  const { calls, origin } = await fixture(context);
  const taxonomy = await json(await fetch(`${origin}/api/stories/${STORY}/taxonomy`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      expectedVersion: 1,
      categories: ['clinical'],
      uses: ['myeras_experiences'],
      surface: 'library',
    }),
  }));
  assert.equal(taxonomy.status, 200);
  assert.deepEqual(taxonomy.body.story.categories, ['clinical']);

  const priority = await json(await fetch(`${origin}/api/stories/${STORY}/priority`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ expectedVersion: 2, priority: 5, surface: 'library' }),
  }));
  assert.equal(priority.status, 200);
  assert.equal(priority.body.story.priority, 5);

  const withdrawn = await json(await fetch(`${origin}/api/stories/${STORY}/withdraw`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ expectedVersion: 2, surface: 'workspace' }),
  }));
  assert.equal(withdrawn.status, 200);
  assert.equal(withdrawn.body.story.status, 'private');
  assert.equal(calls.filter((call) => call[0] === 'query').length, 3);
});

test('admin taxonomy and mentor-note routes delegate to existing bounded services', async (context) => {
  const { calls, origin } = await fixture(context);
  const adminTaxonomy = await json(await fetch(
    `${origin}/api/admin/console/stories/${STORY}/taxonomy`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-test-role': 'admin' },
      body: JSON.stringify({ expectedVersion: 1, categories: ['clinical'], uses: ['ps'] }),
    },
  ));
  assert.equal(adminTaxonomy.status, 200);
  assert.equal(calls.some((call) => call[0] === 'adminTaxonomy'), true);

  assert.equal((await fetch(`${origin}/api/stories/${STORY}/mentor-notes`)).status, 200);
  assert.equal((await fetch(`${origin}/api/stories/${STORY}/mentor-notes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-role': 'admin' },
    body: JSON.stringify({ body: 'Draft', internalOnly: false }),
  })).status, 201);
  assert.equal((await fetch(`${origin}/api/mentor-notes/${NOTE}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-test-role': 'admin' },
    body: JSON.stringify({ body: 'Edited', expectedVersion: 1 }),
  })).status, 200);
  assert.equal((await fetch(`${origin}/api/mentor-notes/${NOTE}/publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-role': 'admin' },
    body: JSON.stringify({ expectedVersion: 2 }),
  })).status, 200);
  assert.equal((await fetch(`${origin}/api/mentor-notes/${NOTE}/playback`)).status, 200);
  assert.equal(calls.some((call) => call[0] === 'publish'), true);
  assert.equal(calls.some((call) => call[0] === 'playback'), true);
});

test('mentor-note multipart preserves expected version and private bytes at the service boundary', async (context) => {
  const { calls, origin } = await fixture(context);
  const form = new FormData();
  form.set('expectedVersion', '4');
  form.set('durationMs', '2000');
  form.set('mimeType', 'audio/webm');
  form.set('segment', new Blob([Buffer.from('mentor-private-audio')], {
    type: 'audio/webm',
  }), 'mentor.webm');
  const result = await json(await fetch(`${origin}/api/mentor-notes/${NOTE}/audio`, {
    method: 'POST',
    headers: { 'x-test-role': 'admin' },
    body: form,
  }));
  assert.equal(result.status, 200);
  const call = calls.find((item) => item[0] === 'audio');
  assert.equal(call[3].expectedVersion, '4');
  assert.equal(call[3].buffer.toString(), 'mentor-private-audio');
});
