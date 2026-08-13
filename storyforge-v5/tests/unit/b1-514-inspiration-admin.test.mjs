import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInspirationService,
  InspirationError,
  parseInspirationBulkCsv,
  validateAdminPromptDraft,
} from '../../server/inspiration.mjs';

const studentId = '11111111-1111-4111-8111-111111111111';
const promptId = '22222222-2222-4222-8222-222222222222';
const admin = { sub: studentId, role: 'admin', eligible: true };
const founderStudent = { sub: studentId, role: 'student', eligible: true, wordpressAdmin: true };

const prompt = {
  id: promptId,
  libraryKey: 'q-001',
  text: 'Tell me about one ordinary moment you still remember clearly.',
  who: ['you'],
  whoDetail: [],
  domain: ['personal'],
  energy: ['light'],
  territory: 'ordinary_moments',
  followUp: 'What could you see and hear?',
  interviewUse: 'Specific ordinary moments reveal attention, warmth, and perspective.',
  state: 'active',
  recommended: true,
  sortOrder: 1,
  expectedVersion: 2,
};

function subject({ environment, query } = {}) {
  const calls = [];
  const service = createInspirationService({
    environment: environment || {
      STORYFORGE_INSPIRATION_FORCE_OFF: '0',
      STORYFORGE_INSPIRATION_ADMIN_FORCE_OFF: '0',
    },
    withIdentity: async (identity, operation, options) => operation({
      async query(sql, values) {
        calls.push({ identity, options, sql, values });
        if (sql.includes('sf_story_feature_enabled')) return { rows: [{ enabled: true }] };
        if (query) return query(sql, values);
        return { rows: [], rowCount: 1 };
      },
    }),
  });
  return { service, calls };
}

test('Content Studio is independently default-off and admin-only', async () => {
  assert.equal(await subject({ environment: {} }).service.adminCapability(admin), false);
  assert.equal(await subject().service.adminCapability(admin), true);
  assert.equal(await subject().service.adminCapability(founderStudent), true);
  assert.equal(await subject().service.adminCapability({ ...admin, role: 'student', wordpressAdmin: false }), false);
  const founder = subject();
  await founder.service.adminList(founderStudent);
  assert.equal(founder.calls.some((call) => call.options?.adminMode === true), true);
});

test('single prompt validation is exact, bounded, plain-text only, and versioned', () => {
  assert.deepEqual(validateAdminPromptDraft(prompt), prompt);
  assert.throws(
    () => validateAdminPromptDraft({ ...prompt, text: '<script>alert(1)</script>' }),
    (error) => error instanceof InspirationError && error.code === 'invalid_inspiration_prompt',
  );
  assert.throws(() => validateAdminPromptDraft({ ...prompt, surprise: true }), /unsupported fields/);
  assert.throws(() => validateAdminPromptDraft({ ...prompt, expectedVersion: null }), /expected version/);
  assert.throws(() => validateAdminPromptDraft({ ...prompt, domain: ['unknown'] }), /unsupported value/);
});

test('bulk CSV parsing is quote-aware and never accepts client ids', () => {
  const csv = [
    'libraryKey,text,who,whoDetail,domain,energy,territory,followUp,interviewUse,state,recommended,sortOrder,expectedVersion',
    'q-001,"Tell me about one meal, trip, or ordinary moment.",you,,personal,light,ordinary_moments,"What happened next?","Shows warmth, specificity, and perspective.",active,true,1,2',
    ',"Tell me about a phrase you remember ""word for word"".",family,parents,personal,moving,family_sayings,"Who said it?","Shows family context and reflective depth.",active,false,2,',
  ].join('\n');
  const parsed = parseInspirationBulkCsv(csv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].text, 'Tell me about one meal, trip, or ordinary moment.');
  assert.equal(parsed[1].text.includes('"word for word"'), true);
  assert.equal(parsed[1].id, null);
  assert.throws(() => parseInspirationBulkCsv(`${csv}\n"unterminated`), /unterminated quoted field/);
});

test('bulk preview exposes duplicate keys and order before any commit', async () => {
  const csv = [
    'libraryKey,text,who,whoDetail,domain,energy,territory,followUp,interviewUse,state,recommended,sortOrder,expectedVersion',
    'q-001,"Tell me about one ordinary moment you still remember clearly.",you,,personal,light,ordinary_moments,"What happened next?","Shows perspective.",active,true,1,2',
    'q-001,"Tell me about another ordinary moment you still remember.",you,,personal,light,ordinary_moments,"What changed?","Shows reflection.",active,false,1,2',
  ].join('\n');
  const observed = subject();
  const result = await observed.service.adminParseBulk(admin, { csv });
  assert.deepEqual(result.validation, {
    validCount: 2,
    duplicateLibraryKeys: ['q-001'],
    duplicateSortOrders: [1],
    publishable: false,
    commitState: 'retired',
  });
  assert.equal(observed.calls.some((call) => call.sql.includes('sf_admin_publish_inspiration_bulk')), false);
});

test('bulk preview accepts new stable keys without pretending they are versioned existing prompts', async () => {
  const csv = [
    'libraryKey,text,who,whoDetail,domain,energy,territory,followUp,interviewUse,state,recommended,sortOrder,expectedVersion',
    'q-901,"What did you learn, exactly?",you,,personal,serious,reflection,"What changed?","Shows reflection.",retired,false,901,',
    'q-902,"What surprised you most?",you,,personal,serious,surprise,"Why did it matter?","Shows insight.",retired,false,901,',
  ].join('\n');
  const result = await subject().service.adminParseBulk(admin, { csv });
  assert.equal(result.count, 2);
  assert.deepEqual(result.validation.duplicateSortOrders, [901]);
  assert.equal(result.validation.publishable, false);
});

test('admin publish revalidates and delegates one atomic audited write to the bounded RPC', async () => {
  const observed = subject({ query: async (sql, values) => {
    if (sql.includes('sf_admin_publish_inspiration_prompt')) {
      const payload = JSON.parse(values[0]);
      return { rows: [{ prompt: { ...payload, rowVersion: 3 } }] };
    }
    return { rows: [] };
  } });
  const result = await observed.service.adminPublish(admin, { prompt });
  assert.equal(result.prompt.rowVersion, 3);
  const publish = observed.calls.find((call) => call.sql.includes('sf_admin_publish_inspiration_prompt'));
  assert.equal(JSON.parse(publish.values[0]).expectedVersion, 2);
  assert.equal(observed.calls.filter((call) => call.sql.includes('sf_admin_publish_inspiration_prompt')).length, 1);
});

test('new single and bulk prompts receive server-generated UUIDs before bounded publish', async () => {
  const rpcPayloads = [];
  const observed = subject({ query: async (sql, values) => {
    if (sql.includes('sf_admin_publish_inspiration_prompt')) {
      rpcPayloads.push(JSON.parse(values[0]));
      return { rows: [{ prompt: JSON.parse(values[0]) }] };
    }
    if (sql.includes('sf_admin_publish_inspiration_bulk')) {
      rpcPayloads.push(...JSON.parse(values[0]));
      return { rows: [{ result: { prompts: JSON.parse(values[0]) } }] };
    }
    return { rows: [] };
  } });
  const fresh = { ...prompt, id: null, libraryKey: null, expectedVersion: null, sortOrder: 80 };
  await observed.service.adminPublish(admin, fresh);
  await observed.service.adminCommitBulk(admin, { prompts: [{ ...fresh, sortOrder: 81 }] });
  assert.match(rpcPayloads[0].id, /^[a-f0-9-]{36}$/);
  assert.equal(rpcPayloads[1].id, null);
  assert.match(rpcPayloads[1].serverId, /^[a-f0-9-]{36}$/);
});

test('pin order mutates only through bounded RPCs and layout stays enum bounded', async () => {
  const observed = subject({ query: async (sql, values) => {
    if (sql.includes('sf_inspiration_set_layout')) return { rows: [{ payload: { layout: values[0] } }] };
    if (sql.includes('sf_inspiration_set_pins')) return { rows: [{ payload: { promptIds: values[0] } }] };
    return { rows: [], rowCount: 1 };
  } });
  const student = { sub: studentId, role: 'student', eligible: true };
  await observed.service.setPins(student, [promptId]);
  assert.equal(observed.calls.some((call) => call.sql.includes('sf_inspiration_set_pins')), true);
  assert.equal(observed.calls.some((call) => /\b(?:INSERT|UPDATE|DELETE)\b/u.test(call.sql)), false);
  assert.equal((await observed.service.setLayout(student, 'grid')).layout, 'grid');
  await assert.rejects(() => observed.service.setPins(student, [promptId, promptId]), /unique/);
  await assert.rejects(() => observed.service.setLayout(student, 'gallery'), /invalid/);
});

test('Content Studio history exposes only prompt snapshots and immutable attribution', async () => {
  const observed = subject({ query: async (sql) => {
    if (sql.includes('sf_inspiration_prompt_history')) return { rows: [{
      id: '8', prompt_id: promptId, row_version: '2', snapshot: { text: prompt.text },
      actor_id: studentId, created_at: '2026-08-10T12:00:00.000Z',
    }] };
    return { rows: [] };
  } });
  const result = await observed.service.adminHistory(admin, promptId);
  assert.deepEqual(result.history[0], {
    id: '8', promptId, rowVersion: 2, snapshot: { text: prompt.text },
    actorId: studentId, createdAt: '2026-08-10T12:00:00.000Z',
  });
});

test('Content Studio reorder requires the complete active bank and exact row versions', async () => {
  const secondId = '33333333-3333-4333-8333-333333333333';
  const rows = [
    {
      id: promptId, library_key: 'q-001', text: prompt.text, who_ids: ['you'], who_detail_ids: [],
      domain_ids: ['personal'], energy_ids: ['light'], territory: 'ordinary_moments',
      follow_up: prompt.followUp, interview_use: prompt.interviewUse, state: 'active', recommended: true,
      sort_order: 1, row_version: '2',
    },
    {
      id: secondId, library_key: 'q-002', text: 'Tell me about a second moment you remember clearly.', who_ids: ['you'], who_detail_ids: [],
      domain_ids: ['personal'], energy_ids: ['moving'], territory: 'ordinary_moments',
      follow_up: 'Why does it stay with you?', interview_use: 'Shows reflection.', state: 'active', recommended: false,
      sort_order: 2, row_version: '4',
    },
  ];
  const writes = [];
  const observed = subject({ query: async (sql, values) => {
    if (sql.includes("WHERE state='active'")) return { rows };
    if (sql.includes('sf_admin_publish_inspiration_prompt')) {
      writes.push(JSON.parse(values[0]));
      return { rows: [{ prompt: JSON.parse(values[0]) }] };
    }
    return { rows: [] };
  } });
  const result = await observed.service.adminReorder(admin, {
    promptIds: [secondId, promptId],
    expectedVersions: { [promptId]: 2, [secondId]: 4 },
  });
  assert.deepEqual(result.promptIds, [secondId, promptId]);
  assert.deepEqual(writes.map((entry) => [entry.id, entry.sortOrder, entry.expectedVersion]), [
    [secondId, 1, 4], [promptId, 2, 2],
  ]);
  await assert.rejects(
    () => observed.service.adminReorder(admin, {
      promptIds: [promptId], expectedVersions: { [promptId]: 2 },
    }),
    (error) => error instanceof InspirationError && error.code === 'incomplete_prompt_order' && error.status === 409,
  );
});
