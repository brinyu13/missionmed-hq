import test from 'node:test';
import assert from 'node:assert/strict';
import { syncPhilCaseOnce } from '../lib/usce-phil-case-mail.mjs';

const CASE = 'USCE-AB12CD34';
const ANCHOR = '<start@missionmed.example>';
const CONSENT = '2026-11-13T15:00:00.000Z';
const TS = String(Date.parse('2026-11-14T15:00:00.000Z'));
const b64 = value => Buffer.from(value, 'utf8').toString('base64url');
const header = (name, value) => ({ name, value });

function message({
  id = 'a1b2c3d4', threadId = 'f1e2d3c4', labels = ['INBOX'], from = 'Student <student@example.edu>',
  to = 'Phila Peri <philaperri@gmail.com>', cc, bcc, subject = `Request ${CASE}`,
  messageId = '<student1@example.edu>', inReplyTo = ANCHOR, references = ANCHOR,
  auth = 'mx.google.com; dkim=pass; spf=pass; dmarc=pass header.from=example.edu',
  autoSubmitted, internalDate = TS, body = 'Hello Clinicals,\nPlease let me know about availability.\n> quoted earlier message\nQuoted content'
} = {}) {
  const headers = [header('From', from), header('To', to), header('Subject', subject), header('Message-ID', messageId),
    header('In-Reply-To', inReplyTo), header('References', references)];
  if (cc !== undefined) headers.push(header('Cc', cc));
  if (bcc !== undefined) headers.push(header('Bcc', bcc));
  if (auth !== null) headers.push(header('Authentication-Results', auth));
  if (autoSubmitted) headers.push(header('Auto-Submitted', autoSubmitted));
  return {
    id, threadId, labelIds: labels, internalDate,
    payload: { mimeType: 'text/plain', headers, body: { data: b64(body), size: body.length } }
  };
}
function fixture({ messages = [message()], listed = ['f1e2d3c4'], nextPageToken = null, preflightEligible = true,
  consentAt = CONSENT, anchors = [ANCHOR], pageToken = null, authorizeError = null, studentEmail = 'student@example.edu' } = {}) {
  const rpcCalls = [], httpCalls = [];
  const rpc = async (name, args) => {
    rpcCalls.push({ name, ...args });
    const action = args.p_action, data = args.p_data || {};
    if (action === 'claim') return { ok: true, claimed: true, lease_id: 'lease-123', case_id: 'ab12cd34-0000-4000-8000-000000000001', case_ref: CASE,
      student_email: studentEmail, connected_at: consentAt, encrypted_grant: 'encrypted-fixture-only', anchors, page_token: pageToken };
    if (action === 'preflight') return { ok: true, eligible: preflightEligible };
    if (action === 'ingest') return { ok: true };
    if (action === 'checkpoint' || action === 'release') return { ok: true };
    throw new Error(`unexpected action ${action}`);
  };
  const fetchImpl = async input => {
    const url = new URL(String(input)); httpCalls.push(url);
    if (url.pathname.endsWith('/threads')) {
      return { ok: true, json: async () => ({ threads: listed.map(id => ({ id })), nextPageToken }) };
    }
    const threadMatch = url.pathname.match(/\/threads\/([^/]+)$/);
    if (threadMatch) {
      const id = decodeURIComponent(threadMatch[1]);
      return { ok: true, json: async () => ({ id, messages: messages.filter(m => m.threadId === id).map(m => ({
        id: m.id, threadId: m.threadId, labelIds: m.labelIds, internalDate: m.internalDate,
        payload: { headers: m.payload.headers }
      })) }) };
    }
    const messageMatch = url.pathname.match(/\/messages\/([^/]+)$/);
    if (messageMatch) {
      const id = decodeURIComponent(messageMatch[1]);
      const found = messages.find(m => m.id === id);
      assert.ok(found, `unexpected body read for ${id}`);
      return { ok: true, json: async () => found };
    }
    throw new Error(`unexpected Gmail path ${url.pathname}`);
  };
  const authCalls = [];
  const authorize = async grant => {
    authCalls.push(grant);
    assert.equal(grant, 'encrypted-fixture-only');
    if (authorizeError) throw new Error(authorizeError);
    return 'synthetic-access-token';
  };
  return { rpc, fetchImpl, authorize, rpcCalls, httpCalls, authCalls };
}
const run = f => syncPhilCaseOnce({ ...f, env: {}, fetchImpl: f.fetchImpl, authorize: f.authorize });
const bodyReads = f => f.httpCalls.filter(url => /\/messages\/[^/]+$/.test(url.pathname));
const cursor = (phase, token = null) => token == null ? (phase === 'anchors' ? 'p1a.' : null) : (phase === 'anchors' ? 'p1a.' : 'p1s.') + token;

test('subject discovery uses numeric consent cutoff, bounded fields, and eligible body reads', async () => {
  const f = fixture();
  const result = await run(f);
  assert.equal(result.ok, true);
  assert.equal(result.ingested, 1);
  const list = f.httpCalls.find(url => url.pathname.endsWith('/threads'));
  assert.match(list.searchParams.get('q'), /USCE-AB12CD34/);
  assert.match(list.searchParams.get('q'), /subject:"USCE-AB12CD34" after:1794581999/);
  assert.match(list.searchParams.get('q'), /-in:drafts -in:spam -in:trash -in:chats/);
  assert.doesNotMatch(list.searchParams.get('q'), /student@example\.edu|philaperri@gmail\.com/i);
  assert.equal(list.searchParams.get('maxResults'), '25');
  assert.equal(list.searchParams.get('fields'), 'threads(id),nextPageToken');
  assert.equal(list.searchParams.has('snippet'), false);
  assert.match(list.pathname, /philaperri%40gmail\.com/);
  const metadataRead = f.httpCalls.find(url => /\/threads\/f1e2d3c4$/.test(url.pathname));
  assert.equal(metadataRead.searchParams.get('format'), 'metadata');
  assert.doesNotMatch(metadataRead.searchParams.get('fields'), /snippet|body|parts/i);
  assert.ok(metadataRead.searchParams.getAll('metadataHeaders').length > 10);
  assert.ok(metadataRead.searchParams.getAll('metadataHeaders').includes('from'));
  assert.equal(bodyReads(f).length, 1);
  const preflight = f.rpcCalls.find(call => call.p_action === 'preflight').p_data;
  assert.equal(preflight.direction, 'IN');
  assert.equal(preflight.authenticated, true);
  assert.equal('body_text' in preflight, false);
  const ingest = f.rpcCalls.find(call => call.p_action === 'ingest').p_data;
  assert.equal(ingest.direction, 'IN');
  assert.equal(ingest.body_text, 'Hello Clinicals,\nPlease let me know about availability.');
  assert.equal(f.rpcCalls.find(call => call.p_action === 'checkpoint').p_data.page_token, cursor('anchors'));
});

test('historical verified RFC anchors are searched without a date cutoff', async () => {
  const f = fixture({ pageToken: cursor('anchors') });
  const result = await run(f);
  assert.equal(result.ok, true);
  const list = f.httpCalls.find(url => url.pathname.endsWith('/threads'));
  assert.match(list.searchParams.get('q'), /rfc822msgid:<start@missionmed\.example>/);
  assert.doesNotMatch(list.searchParams.get('q'), /after:/);
  assert.match(list.searchParams.get('q'), /-in:chats/);
});

test('nonqueryable RFC anchor characters cannot alter Gmail search syntax', async () => {
  const f = fixture({ anchors: ['<parent|wild@example.edu>'] });
  const result = await run(f);
  assert.equal(result.ok, true);
  const list = f.httpCalls.find(url => url.pathname.endsWith('/threads'));
  assert.match(list.searchParams.get('q'), /subject:"USCE-AB12CD34"/);
  assert.doesNotMatch(list.searchParams.get('q'), /rfc822msgid|in:anywhere|\|\*/);
  assert.doesNotMatch(list.searchParams.get('q'), /student@example\.edu/i);
});

test('no case or RFC linkage means metadata only and no body read', async () => {
  const f = fixture({ messages: [message({ subject: 'Availability question', inReplyTo: '', references: '', messageId: '<other@example.edu>' })] });
  const result = await run(f);
  assert.equal(result.ok, true);
  assert.equal(result.ingested, 0);
  assert.equal(f.rpcCalls.some(call => call.p_action === 'preflight'), false);
  assert.equal(bodyReads(f).length, 0);
});

test('ambiguous cross-case subject is skipped without body access and does not stall page', async () => {
  const f = fixture({ messages: [message({ subject: `Re: ${CASE} and USCE-ZZ99YY88` })] });
  const result = await run(f);
  assert.equal(result.ok, true);
  assert.equal(bodyReads(f).length, 0);
  assert.equal(f.rpcCalls.some(call => call.p_action === 'ingest'), false);
  assert.equal(f.rpcCalls.some(call => call.p_action === 'checkpoint'), true);
});

test('wrong labels, extra recipients, and wrong direct recipient never authorize body reads', async () => {
  for (const bad of [
    message({ labels: ['SPAM'] }),
    message({ labels: ['DRAFT'] }),
    message({ labels: ['CHAT'] }),
    message({ to: 'student@example.edu, assistant@example.edu' }),
    message({ cc: 'assistant@example.edu' }),
    message({ to: 'someone@example.edu' })
  ]) {
    const f = fixture({ messages: [bad] });
    const result = await run(f);
    assert.equal(result.ok, true);
    assert.equal(bodyReads(f).length, 0);
    assert.equal(f.rpcCalls.some(call => call.p_action === 'ingest'), false);
  }
  const unrelated = fixture({ messages: [message({ from: 'Private Sender <private@example.net>' })] });
  await run(unrelated);
  assert.equal(unrelated.rpcCalls.some(call => call.p_action === 'preflight'), false);
  assert.equal(bodyReads(unrelated).length, 0);
  assert.equal(JSON.stringify(unrelated.rpcCalls).includes('private@example.net'), false);
});

test('subject-only or parentless correspondence never sends private headers to preflight', async () => {
  const f = fixture({ messages: [message({ inReplyTo: '', references: '', messageId: '<not-anchored@example.edu>' })] });
  const result = await run(f);
  assert.equal(result.ok, true);
  assert.equal(f.rpcCalls.some(call => call.p_action === 'preflight'), false);
  assert.equal(bodyReads(f).length, 0);
  assert.equal(JSON.stringify(f.rpcCalls).includes('student@example.edu'), false);
});

test('self-addressed case is checkpointed and released before Gmail authorization or search', async () => {
  const f = fixture({ studentEmail: 'philaperri@gmail.com' });
  const result = await run(f);
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(f.authCalls.length, 0);
  assert.equal(f.httpCalls.length, 0);
  assert.ok(f.rpcCalls.some(call => call.p_action === 'checkpoint' && call.p_data.page_token === null));
  assert.equal(f.rpcCalls.at(-1).p_action, 'release');
});

test('incoming messages require a unique Gmail DMARC result aligned to From', async () => {
  for (const auth of [null, 'attacker.example; dmarc=pass header.from=example.edu',
    'mx.google.com; dmarc=pass header.from=attacker.example',
    'mx.google.com; dmarc=fail header.from=example.edu']) {
    const f = fixture({ messages: [message({ auth })] });
    await run(f);
    assert.equal(bodyReads(f).length, 0);
  }
  const splitClause = fixture({ messages: [message({ auth: 'mx.google.com; dmarc=fail; comment dmarc=pass header.from=example.edu' })] });
  await run(splitClause);
  assert.equal(bodyReads(splitClause).length, 0);
});

test('quoted comma display names are accepted while forwarded history is removed', async () => {
  const f = fixture({ messages: [message({ from: '"Doe, Student" <student@example.edu>',
    body: 'Hi.\n---------- Forwarded message ---------\nFrom: private@example.net\nSent: yesterday\nTo: someone@example.net\nSecret history.' })] });
  const result = await run(f);
  assert.equal(result.ingested, 1);
  assert.equal(f.rpcCalls.find(call => call.p_action === 'ingest').p_data.body_text, 'Hi.');
  const outlook = fixture({ messages: [message({ body: 'Fresh reply.\nFrom: private@example.net\nSent: yesterday\nTo: someone@example.net\nSubject: unrelated\nPrivate history.' })] });
  await run(outlook);
  assert.equal(outlook.rpcCalls.find(call => call.p_action === 'ingest').p_data.body_text, 'Fresh reply.');
});

test('attached forwarded messages are not ingested', async () => {
  const attached = message();
  attached.payload = { mimeType: 'multipart/mixed', headers: attached.payload.headers, parts: [
    { mimeType: 'text/plain', body: { data: b64('Reply only.'), size: 11 } },
    { mimeType: 'message/rfc822', parts: [{ mimeType: 'text/plain', body: { data: b64('Private forwarded mail.'), size: 22 } }] }
  ] };
  const f = fixture({ messages: [attached] });
  const result = await run(f);
  assert.equal(result.ok, true);
  assert.equal(result.ingested, 0);
  assert.equal(f.rpcCalls.some(call => call.p_action === 'ingest'), false);
});

test('text/plain attachment with no filename cannot enter case body', async () => {
  const attached = message();
  attached.payload = { mimeType: 'multipart/mixed', headers: attached.payload.headers, parts: [
    { mimeType: 'text/plain', body: { data: b64('Visible reply.'), size: 14 } },
    { mimeType: 'text/plain', filename: '', headers: [header('Content-Disposition', 'attachment; size=19')],
      body: { data: b64('Private attachment text.'), size: 24 } }
  ] };
  const f = fixture({ messages: [attached] });
  const result = await run(f);
  assert.equal(result.ok, true);
  assert.equal(result.ingested, 1);
  assert.equal(f.rpcCalls.find(call => call.p_action === 'ingest').p_data.body_text, 'Visible reply.');
  assert.equal(JSON.stringify(f.rpcCalls).includes('Private attachment text'), false);
});

test('HTML-only messages are unsupported and skipped without retrying the page', async () => {
  const htmlOnly = message();
  htmlOnly.payload = { mimeType: 'text/html', headers: htmlOnly.payload.headers, body: { data: b64('<p>Private HTML</p>'), size: 18 } };
  const f = fixture({ messages: [htmlOnly] });
  const result = await run(f);
  assert.equal(result.ok, true);
  assert.equal(result.ingested, 0);
  assert.equal(f.rpcCalls.some(call => call.p_action === 'ingest'), false);
  assert.equal(f.rpcCalls.some(call => call.p_action === 'checkpoint'), true);
});

test('multiple direct threads for one case are evaluated independently by preflight', async () => {
  const first = message();
  const second = message({ id: 'a1b2c3d5', threadId: 'f1e2d3c5', messageId: '<student2@example.edu>' });
  const f = fixture({ messages: [first, second], listed: ['f1e2d3c4', 'f1e2d3c5'] });
  const result = await run(f);
  assert.equal(result.ok, true);
  assert.equal(result.ingested, 2);
  assert.equal(bodyReads(f).length, 2);
});

test('messages before consent and malformed metadata are skipped without stalling', async () => {
  const old = message({ internalDate: String(Date.parse('2026-11-12T14:59:59.000Z')) });
  const malformed = message({ id: 'a1b2c3d5', messageId: 'not-an-rfc-id' });
  const f = fixture({ pageToken: cursor('anchors'), messages: [old, malformed] });
  const result = await run(f);
  assert.equal(result.ok, true);
  assert.equal(result.ingested, 0);
  assert.equal(bodyReads(f).length, 0);
  assert.equal(f.rpcCalls.some(call => call.p_action === 'checkpoint'), true);
});

test('outgoing mail requires SENT and direct recipient, then passes OUT preflight', async () => {
  const outgoing = message({ id: 'b2c3d4e5', labels: ['SENT'], from: 'Phila Peri <philaperri@gmail.com>',
    to: 'Student <student@example.edu>', subject: `Re: ${CASE}`, messageId: '<reply@example.edu>',
    inReplyTo: '<student1@example.edu>', references: `${ANCHOR} <student1@example.edu>`, auth: null,
    body: 'We will review your request.' });
  const f = fixture({ messages: [message(), outgoing] });
  const result = await run(f);
  assert.equal(result.ok, true);
  assert.equal(result.ingested, 2);
  const outgoingPreflight = f.rpcCalls.find(call => call.p_action === 'preflight' && call.p_data.gmail_id === outgoing.id).p_data;
  assert.equal(outgoingPreflight.direction, 'OUT');
  assert.equal(outgoingPreflight.to_email, 'student@example.edu');
  assert.deepEqual(f.rpcCalls.filter(call => call.p_action === 'ingest').map(call => call.p_data.gmail_id), ['a1b2c3d4', 'b2c3d4e5']);
});

test('duplicate listed thread IDs and messages are handled once', async () => {
  const duplicate = message();
  const f = fixture({ messages: [duplicate, duplicate], listed: ['f1e2d3c4', 'f1e2d3c4'] });
  const result = await run(f);
  assert.equal(result.ingested, 1);
  assert.equal(f.rpcCalls.filter(call => call.p_action === 'preflight').length, 1);
  assert.equal(bodyReads(f).length, 1);
});

test('unavailable preflight never causes body access', async () => {
  const f = fixture({ preflightEligible: false });
  const result = await run(f);
  assert.equal(result.ok, true);
  assert.equal(result.ingested, 0);
  assert.equal(bodyReads(f).length, 0);
  assert.equal(f.rpcCalls.some(call => call.p_action === 'ingest'), false);
});

test('missing consent timestamp blocks authorization and Gmail discovery', async () => {
  const f = fixture({ consentAt: null });
  const result = await run(f);
  assert.equal(result.ok, false);
  assert.equal(f.httpCalls.length, 0);
  assert.equal(f.rpcCalls.at(-1).p_action, 'release');
});

test('unconfigured or revoked grant performs no Gmail discovery and releases claim', async () => {
  for (const authorizeError of ['unconfigured', 'revoked']) {
    const f = fixture({ authorizeError });
    const result = await run(f);
    assert.equal(result.ok, false);
    assert.equal(f.httpCalls.length, 0);
    assert.equal(f.rpcCalls.at(-1).p_action, 'release');
  }
});

test('pagination token is passed through and durable next token is checkpointed', async () => {
  const f = fixture({ pageToken: cursor('subject', 'cursor-first'), nextPageToken: 'cursor-next', listed: [] });
  const result = await run(f);
  assert.equal(result.ok, true);
  assert.equal(result.more, true);
  const list = f.httpCalls.find(url => url.pathname.endsWith('/threads'));
  assert.equal(list.searchParams.get('pageToken'), 'cursor-first');
  assert.equal(f.rpcCalls.find(call => call.p_action === 'checkpoint').p_data.page_token, cursor('subject', 'cursor-next'));
});

test('historical anchor continuation cursor round-trips through the SQL limit', async () => {
  const f = fixture({ pageToken: cursor('anchors', 'anchor-page-2'), nextPageToken: 'anchor-page-3', listed: [] });
  const result = await run(f);
  assert.equal(result.ok, true);
  const list = f.httpCalls.find(url => url.pathname.endsWith('/threads'));
  assert.equal(list.searchParams.get('pageToken'), 'anchor-page-2');
  assert.doesNotMatch(list.searchParams.get('q'), /after:/);
  assert.equal(f.rpcCalls.find(call => call.p_action === 'checkpoint').p_data.page_token, cursor('anchors', 'anchor-page-3'));
});

test('control-character or oversized provider cursors fail without checkpointing', async () => {
  for (const nextPageToken of ['provider\nquery', 'x'.repeat(2045)]) {
    const f = fixture({ nextPageToken, listed: [] });
    const result = await run(f);
    assert.equal(result.ok, false);
    assert.equal(f.rpcCalls.some(call => call.p_action === 'checkpoint'), false);
    assert.equal(f.rpcCalls.at(-1).p_action, 'release');
  }
});

test('unclaimed work is low load and makes no Gmail calls', async () => {
  const f = fixture();
  f.rpc = async (name, args) => ({ ok: true, claimed: false });
  const result = await run(f);
  assert.equal(result.pending, true);
  assert.equal(f.httpCalls.length, 0);
});

test('invalid RFC anchor and checkpoint/ingest errors fail closed without checkpointing', async () => {
  const invalid = fixture({ anchors: ['<x@example.com> OR in:anywhere'] });
  let result = await run(invalid);
  assert.equal(result.ok, false);
  assert.equal(invalid.httpCalls.length, 0);

  const failed = fixture();
  const baseRpc = failed.rpc;
  failed.rpc = async (name, args) => args.p_action === 'ingest' ? { ok: false, error: 'synthetic_write_failure' } : baseRpc(name, args);
  result = await run(failed);
  assert.equal(result.ok, false);
  assert.equal(failed.rpcCalls.some(call => call.p_action === 'checkpoint'), false);
  assert.equal(failed.rpcCalls.at(-1).p_action, 'release');
});
