import assert from 'node:assert/strict';
import test from 'node:test';

import { createAppServer } from '../../server/app.mjs';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';
const EXPERIENCE_ID = '33333333-3333-4333-8333-333333333333';
const identity = Object.freeze({ sub: STUDENT_ID, role: 'student', eligible: true });

async function fixture(context) {
  const calls = [];
  const record = (name, value = { ok: true }) => async (...args) => {
    calls.push([name, ...args]);
    return value;
  };
  const myerasService = {
    capabilities: record('capabilities', {}),
    activeProfile: record('profile', { profileKey: 'eras_2027' }),
    taxonomy: record('taxonomy', []),
    listTags: record('listTags', []),
    setTags: record('setTags'),
    legacySuggestions: record('suggestions', []),
    workspace: record('workspace', { workspace: null, experiences: [] }),
    storyFit: record('storyFit', []),
    upsertExperience: record('upsertExperience', { id: EXPERIENCE_ID }),
    reorderExperiences: record('reorder'),
    setMostMeaningful: record('meaningful'),
    linkStory: record('link'),
    unlinkStory: record('unlink'),
    setImpactful: record('impactful'),
    promoteImpactful: record('promote'),
    getClinicalCase: record('getClinical', null),
    setClinicalCase: record('setClinical'),
    setUseRank: record('useRank'),
    getFeature: record('getFeature', { key: 'myeras_workspace', scope: 'off' }),
    updateFeature: record('updateFeature', { key: 'myeras_workspace', scope: 'allowlist' }),
  };
  const condensationService = {
    configured: false,
    request: record('condensation'),
  };
  const server = createAppServer({
    checkHealth: async () => true,
    authorizeRequest: async () => identity,
    identityTransaction: async (_identity, operation) => operation({ query: async () => ({ rows: [] }) }),
    phaseOneRuntime: {
      flagService: { voiceCapture: async () => false },
      transcription: { transcribeSegment: async () => ({ text: '' }) },
      recordingsService: {},
    },
    myerasService,
    condensationService,
    reportError() {},
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { calls, origin: `http://127.0.0.1:${server.address().port}` };
}

async function json(origin, path, { method = 'GET', body } = {}) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: body == null ? undefined : { 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
  });
  assert.ok(response.status >= 200 && response.status < 300, `${method} ${path} returned ${response.status}`);
  return response.json();
}

test('ERAS taxonomy, story metadata, and use-rank routes delegate without widening identity', async (context) => {
  const { calls, origin } = await fixture(context);
  await json(origin, '/api/eras/profile');
  await json(origin, '/api/eras/taxonomy?dimension=setting');
  await json(origin, `/api/stories/${STORY_ID}/eras-tags`);
  await json(origin, `/api/stories/${STORY_ID}/eras-tags`, {
    method: 'PATCH', body: { profileKey: 'eras_2027', tags: [] },
  });
  await json(origin, `/api/stories/${STORY_ID}/eras-suggestions`);
  await json(origin, `/api/stories/${STORY_ID}/clinical-case`);
  await json(origin, `/api/stories/${STORY_ID}/clinical-case`, {
    method: 'PATCH', body: { deidentConfirmed: true, expectedVersion: 0 },
  });
  await json(origin, `/api/stories/${STORY_ID}/use-ranks/myeras_experiences`, {
    method: 'PATCH', body: { rank: 1, pinned: true, expectedVersion: 0 },
  });
  assert.deepEqual(calls.map(([name]) => name), [
    'profile', 'taxonomy', 'listTags', 'setTags', 'suggestions',
    'getClinical', 'setClinical', 'useRank',
  ]);
  assert.ok(calls.every(([, callIdentity]) => callIdentity === identity));
});

test('workspace routes cover add, order, meaning, linking, impactful, and read-only admin subject shape', async (context) => {
  const { calls, origin } = await fixture(context);
  await json(origin, '/api/myeras/workspace');
  await json(origin, '/api/myeras/story-fit');
  assert.equal((await json(origin, '/api/myeras/experiences', {
    method: 'POST', body: { expectedVersion: 0, experience: { organization: 'MissionMed' } },
  })).experience.id, EXPERIENCE_ID);
  await json(origin, `/api/myeras/experiences/${EXPERIENCE_ID}`, {
    method: 'PATCH', body: { expectedVersion: 0, experience: { organization: 'MissionMed' } },
  });
  await json(origin, '/api/myeras/experiences/order', {
    method: 'POST', body: { experienceIds: [EXPERIENCE_ID] },
  });
  await json(origin, `/api/myeras/experiences/${EXPERIENCE_ID}/most-meaningful`, {
    method: 'POST', body: { mostMeaningful: true, rank: 1, expectedVersion: 0 },
  });
  await json(origin, `/api/myeras/experiences/${EXPERIENCE_ID}/stories/${STORY_ID}`, {
    method: 'POST', body: { linkRole: 'primary' },
  });
  await json(origin, `/api/myeras/experiences/${EXPERIENCE_ID}/stories/${STORY_ID}`, { method: 'DELETE' });
  await json(origin, '/api/myeras/impactful', {
    method: 'PATCH', body: { bodyText: 'Impactful', sourceStoryId: STORY_ID, expectedVersion: 0 },
  });
  await json(origin, `/api/myeras/impactful/promote/${STORY_ID}`, {
    method: 'POST', body: { expectedVersion: 0 },
  });
  assert.deepEqual(calls.map(([name]) => name), [
    'workspace', 'storyFit', 'upsertExperience', 'upsertExperience', 'reorder',
    'meaningful', 'link', 'unlink', 'impactful', 'promote',
  ]);
});

test('admin feature and subject workspace routes are explicit and condensation stays isolated', async (context) => {
  const { calls, origin } = await fixture(context);
  await json(origin, '/api/admin/features/b1-517/myeras_workspace');
  await json(origin, '/api/admin/features/b1-517/myeras_workspace', {
    method: 'POST', body: { scope: 'off', allowlist: [], cohorts: [] },
  });
  await json(origin, `/api/admin/console/subjects/${STUDENT_ID}/myeras`);
  await json(origin, '/api/condensation', {
    method: 'POST', body: { mode: 'condense_experience', sourceText: 'Story' },
  });
  assert.deepEqual(calls.map(([name]) => name), [
    'getFeature', 'updateFeature', 'workspace', 'condensation',
  ]);
});

test('MyERAS version route accepts only the two additive keys', async (context) => {
  const { origin } = await fixture(context);
  const versionCalls = [];
  const server = createAppServer({
    authorizeRequest: async () => identity,
    identityTransaction: async (_identity, operation) => operation({ query: async () => ({ rows: [] }) }),
    phaseOneRuntime: {
      flagService: {},
      transcription: { transcribeSegment: async () => ({ text: '' }) },
      recordingsService: {},
    },
    storyVersionsService: {
      capability: async () => true,
      save: async (...args) => (versionCalls.push(args), { versionKey: args[2] }),
    },
    myerasService: { capabilities: async () => ({}) },
    condensationService: { configured: false },
    reportError() {},
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const isolated = `http://127.0.0.1:${server.address().port}`;
  for (const key of ['myeras_experience', 'myeras_impactful']) {
    const response = await fetch(`${isolated}/api/stories/${STORY_ID}/versions/${key}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'A telling', expectedVersion: 0 }),
    });
    assert.equal(response.status, 200);
  }
  assert.deepEqual(versionCalls.map((call) => call[2]), ['myeras_experience', 'myeras_impactful']);
  assert.equal((await fetch(`${origin}/api/stories/${STORY_ID}/versions/anything`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}',
  })).status, 404);
});
