import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyNext, createClinicalsCopyWriter } from '../lib/usce-gmail-sent-copy.mjs';
import { CLINICALS_MAILBOX } from '../lib/usce-mail-dispatch.mjs';

const ids = {
  dispatch: '9ba81e3c-1575-4de8-a93c-a4a8a49c42f7',
  comm: '0a13c712-f103-40d2-a065-9f84b6aacb44',
  provider: '2c3adff2-2c6a-4c8c-a8d1-f8f38d3d678a',
  case: '6c8c4913-550b-4e7d-aa53-cac66a3e10b2',
  pilot: 'f2e45132-6fe5-4522-a5b3-ac568a0f63dc',
};
const parent = { id: 'a1b2c3d4', threadId: 'b1c2d3e4', messageId: '<parent-42@example.test>' };
const sentId = 'c1d2e3f4';
const sentAt = '2026-11-14T12:00:00.000Z';
const job = (overrides = {}) => ({
  dispatch_id: ids.dispatch, comm_id: ids.comm, provider_id: ids.provider, case_id: ids.case,
  from_email: CLINICALS_MAILBOX, to_email: 'student@example.test', subject: 'Re: Clinical case',
  body_text: 'Synthetic Clinicals follow-up\nSecond line.', rfc_message_id: `<usce-mail-${ids.comm}@missionmedinstitute.com>`,
  in_reply_to: parent.messageId, references_ids: ['<root-42@example.test>', parent.messageId],
  parent_gmail_id: parent.id, parent_thread_id: parent.threadId, parent_subject: 'Clinical case',
  sent_at: sentAt, reserved: false,
  ...overrides,
});
const headers = (message) => [
  { name: 'Message-ID', value: message.rfc_message_id },
  { name: 'From', value: `${CLINICALS_MAILBOX}` },
  { name: 'To', value: message.to_email },
  { name: 'Subject', value: message.subject },
  { name: 'In-Reply-To', value: message.in_reply_to },
  { name: 'References', value: message.references_ids.join(' ') },
];
function sentMessage(message = job(), id = sentId) {
  return { id, threadId: parent.threadId, labelIds: ['SENT'], payload: {
    mimeType: 'text/plain', headers: headers(message),
    body: { data: Buffer.from(message.body_text).toString('base64url') },
  } };
}
function parentMessage(threadId = parent.threadId) {
  return { id: parent.id, threadId, payload: { headers: [
    { name: 'Message-ID', value: parent.messageId },
    { name: 'Subject', value: 'Clinical case' },
    { name: 'From', value: 'student@example.test' },
    { name: 'To', value: CLINICALS_MAILBOX },
  ] } };
}
function makeHarness({ item = job(), reserveWon = true, parentData = parentMessage(), searchOk = true, writerResult = null } = {}) {
  const calls = { rpc: [], gmail: [], prepare: 0, insert: [] };
  let existing = null;
  const rpc = async (action, data) => {
    calls.rpc.push({ action, data });
    if (action === 'next') return { ok: true, job: item };
    if (action === 'reserve') return { ok: true, won: reserveWon };
    if (action === 'stored' || action === 'defer') return { ok: true };
    throw new Error(`unexpected RPC action: ${action}`);
  };
  const gmail = async (path, params = {}) => {
    calls.gmail.push({ path, params });
    if (path === `messages/${item.parent_gmail_id}`) return { ok: !!parentData, data: parentData };
    if (path === 'messages') return searchOk ? { ok: true, data: { messages: existing ? [{ id: existing.id }] : [] } } : { ok: false };
    if (path === `messages/${sentId}` || (existing && path === `messages/${existing.id}`)) return { ok: true, data: existing || sentMessage(item) };
    return { ok: false };
  };
  const writer = {
    prepare: async () => { calls.prepare++; return true; },
    insert: async (message) => {
      calls.insert.push(message);
      if (writerResult?.accept) existing = sentMessage(item, writerResult.id || sentId);
      return writerResult?.result || { ok: true, data: { id: sentId, threadId: parent.threadId } };
    },
  };
  return { calls, rpc, gmail, writer, setExisting(value) { existing = value; } };
}
const run = (h) => copyNext({ rpc: h.rpc, gmail: h.gmail, writer: h.writer, pilotId: ids.pilot });

test('successful insert is read back exactly and only then recorded stored', async () => {
  const h = makeHarness();
  const result = await run(h);
  assert.equal(result.outcome, 'stored');
  assert.equal(h.calls.insert.length, 1);
  assert.equal(h.calls.insert[0].labelIds, undefined);
  assert.equal(h.calls.insert[0].threadId, parent.threadId);
  assert.deepEqual(h.calls.rpc.map(x => x.action), ['next', 'reserve', 'stored']);
  assert.equal(h.calls.rpc.at(-1).data.gmail_id, sentId);
  assert.equal(h.calls.rpc.at(-1).data.thread_id, parent.threadId);
  assert.ok(h.calls.gmail.some(x => x.path === `messages/${sentId}` && x.params.format === 'full'));
});

test('lost insert response followed by restart finds and verifies the existing copy without reinserting', async () => {
  const h = makeHarness({ writerResult: { accept: true, result: { ok: false } } });
  const first = await run(h);
  assert.equal(first.outcome, 'readback_required');
  assert.equal(h.calls.insert.length, 1);
  assert.ok(h.calls.rpc.some(x => x.action === 'defer'));

  // A restarted worker sees the durable job as already reserved and the accepted Gmail copy in search.
  h.rpc = async (action, data) => {
    h.calls.rpc.push({ action, data });
    if (action === 'next') return { ok: true, job: job({ reserved: true }) };
    if (action === 'stored' || action === 'defer') return { ok: true };
    if (action === 'reserve') throw new Error('must not reserve a previously reserved job');
    throw new Error(`unexpected RPC action: ${action}`);
  };
  const second = await run(h);
  assert.equal(second.outcome, 'stored');
  assert.equal(h.calls.insert.length, 1);
  assert.ok(h.calls.rpc.some(x => x.action === 'stored'));
});

test('lost reservation race performs reads but never inserts', async () => {
  const h = makeHarness({ reserveWon: false });
  const result = await run(h);
  assert.equal(result.outcome, 'claim_unavailable');
  assert.ok(h.calls.gmail.length > 0, 'parent and existing-copy readback happen before reservation');
  assert.ok(h.calls.rpc.some(x => x.action === 'reserve'));
  assert.equal(h.calls.insert.length, 0);
});

test('unverified parent, search failure, and invalid dispatch abort before insertion', async (t) => {
  const cases = [
    ['parent thread mismatch', { parentData: parentMessage('deadbeef') }, 'parent_unverified'],
    ['sent search failure', { searchOk: false }, 'readback_required'],
    ['invalid recipient identity', { item: job({ to_email: 'not-an-address' }) }, 'invalid_dispatch'],
  ];
  for (const [name, options, outcome] of cases) await t.test(name, async () => {
    const h = makeHarness(options);
    const result = await run(h);
    assert.equal(result.outcome, outcome);
    assert.equal(h.calls.insert.length, 0);
    assert.equal(h.calls.rpc.some(x => x.action === 'stored'), false);
  });
});

test('existing verified Sent copy is reconciled without writer authorization or insert', async () => {
  const h = makeHarness({ item: job({ reserved: true }) });
  h.setExisting(sentMessage(job({ reserved: true }), 'd1e2f3a4'));
  h.writer.prepare = async () => { h.calls.prepare++; throw new Error('existing Sent copy needs no writer'); };
  const result = await run(h);
  assert.equal(result.outcome, 'stored');
  assert.equal(h.calls.prepare, 0);
  assert.equal(h.calls.insert.length, 0);
  assert.equal(h.calls.rpc.some(x => x.action === 'stored'), true);
});

test('Clinicals copy writer requests only Gmail insert scope and pins OAuth and insert to Clinicals mailbox', async () => {
  const requests = [];
  const writer = createClinicalsCopyWriter({
    env: { USCE_CLINICALS_OAUTH_CLIENT_ID: 'fixture-client', USCE_CLINICALS_OAUTH_CLIENT_SECRET: 'fixture-secret', USCE_CLINICALS_OAUTH_REFRESH_TOKEN: 'fixture-refresh' },
    now: () => 100000,
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      if (String(url) === 'https://oauth2.googleapis.com/token') {
        const form = new URLSearchParams(options.body);
        assert.equal(form.get('scope'), 'https://www.googleapis.com/auth/gmail.insert');
        return { ok: true, json: async () => ({ access_token: 'fixture-access', scope: form.get('scope'), expires_in: 3600 }) };
      }
      return { ok: true, json: async () => ({ id: sentId, threadId: parent.threadId }) };
    },
  });
  assert.equal(await writer.prepare(), true);
  const result = await writer.insert({ raw: 'fixture-raw', threadId: parent.threadId, labelIds: ['SENT'] });
  assert.equal(result.ok, true);
  const tokenRequest = requests[0];
  assert.equal(tokenRequest.url, 'https://oauth2.googleapis.com/token');
  assert.equal(tokenRequest.options.redirect, 'error');
  const insertRequest = requests[1];
  assert.match(insertRequest.url, new RegExp(`/users/${encodeURIComponent(CLINICALS_MAILBOX)}/messages\\?internalDateSource=dateHeader$`));
  assert.equal(insertRequest.options.method, 'POST');
  assert.equal(insertRequest.options.redirect, 'error');
  assert.equal(insertRequest.options.headers.Authorization, 'Bearer fixture-access');
  assert.equal(JSON.parse(insertRequest.options.body).labelIds, undefined);
});

test('writer rejects a broader or mismatched granted scope without inserting', async () => {
  let inserts = 0;
  const writer = createClinicalsCopyWriter({
    env: { USCE_CLINICALS_OAUTH_CLIENT_ID: 'fixture-client', USCE_CLINICALS_OAUTH_CLIENT_SECRET: 'fixture-secret', USCE_CLINICALS_OAUTH_REFRESH_TOKEN: 'fixture-refresh' },
    fetchImpl: async (url) => String(url) === 'https://oauth2.googleapis.com/token'
      ? { ok: true, json: async () => ({ access_token: 'fixture-access', scope: 'https://www.googleapis.com/auth/gmail.modify', expires_in: 3600 }) }
      : (inserts++, { ok: true, json: async () => ({ id: sentId, threadId: parent.threadId }) }),
  });
  assert.equal(await writer.prepare(), false);
  assert.deepEqual(await writer.insert({ raw: 'fixture-raw', labelIds: ['SENT'] }), { ok: false });
  assert.equal(inserts, 0);
});
