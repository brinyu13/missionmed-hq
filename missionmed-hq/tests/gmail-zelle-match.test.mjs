import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { canonicalSignatureInput, findExactZelleMatch, normalizeMatchInput, parseChaseZelleMessage } from '../routes/gmail-zelle-match.mjs';

function fixture({ payer = 'Test Student', amount = '1.00', id = 'msg_fixture_01', epoch = 1790697600 } = {}) {
  const text = `${payer} sent you money with Zelle.\nAmount: $${amount}\nTransaction number: TEST-1234`;
  return {
    id,
    internalDate: String(epoch * 1000),
    payload: {
      headers: [
        { name: 'From', value: 'Chase Alerts <no.reply.alerts@chase.com>' },
        { name: 'Subject', value: 'You received money with Zelle®' },
      ],
      mimeType: 'text/plain',
      body: { data: Buffer.from(text).toString('base64url') },
    },
  };
}

test('parses the allowlisted Chase structure without returning message body', () => {
  const candidate = parseChaseZelleMessage(fixture());
  assert.equal(candidate.amount, '1.00');
  assert.equal(candidate.payerName, 'test student');
  assert.match(candidate.fingerprint, /^[a-f0-9]{64}$/u);
  assert.equal(candidate.referenceMasked, '...1234');
  assert.equal(Object.hasOwn(candidate, 'body'), false);
});

test('rejects lookalike sender and wrong subject', () => {
  const message = fixture();
  message.payload.headers[0].value = 'Chase <attacker@example.com>';
  assert.equal(parseChaseZelleMessage(message), null);
  message.payload.headers[0].value = 'Chase <no.reply.alerts@chase.com>';
  message.payload.headers[1].value = 'Action needed';
  assert.equal(parseChaseZelleMessage(message), null);
});

test('normalizes exact order input and rejects incomplete requests', () => {
  assert.deepEqual(normalizeMatchInput({ order_id: 42, expected_amount: '$499', payer_name: '  Test Student ', order_created_epoch: 1790697000 }), {
    ok: true,
    orderId: 42,
    expectedAmount: '499.00',
    payerName: 'test student',
    orderCreatedEpoch: 1790697000,
    consumedFingerprints: [],
  });
  assert.equal(normalizeMatchInput({}).ok, false);
});

test('canonical HMAC input binds order, amount, payer, and order time', () => {
  const payload = { order_id: 42, expected_amount: '499.00', payer_name: 'Test Student', order_created_epoch: 1790697000 };
  const canonical = canonicalSignatureInput('1790697600', 'a'.repeat(32), payload);
  const signature = crypto.createHmac('sha256', 'test-secret').update(canonical).digest('hex');
  assert.match(signature, /^[a-f0-9]{64}$/u);
  assert.notEqual(canonicalSignatureInput('1790697600', 'a'.repeat(32), { ...payload, order_id: 43 }), canonical);
});

test('exact-match engine distinguishes verified, consumed, ambiguous, and absent', async () => {
  const nowEpoch = Math.floor(Date.now() / 1000);
  const baseInput = {
    orderId: 42,
    expectedAmount: '1.00',
    payerName: 'test student',
    orderCreatedEpoch: nowEpoch - 60,
    consumedFingerprints: [],
  };
  const messages = [fixture({ epoch: nowEpoch - 30 })];
  const gmailGetJson = async (url) => url.includes('/messages?')
    ? { ok: true, data: { messages: messages.map(({ id }) => ({ id })) } }
    : { ok: true, data: messages.find(({ id }) => url.includes(`/${id}?`)) };
  const common = {
    credentials: {}, scopes: [], gmailGetJson,
    mintToken: async () => ({ ok: true, accessToken: 'fixture-token' }),
  };
  const verified = await findExactZelleMatch({ input: baseInput, ...common });
  assert.equal(verified.state, 'verified');
  const consumed = await findExactZelleMatch({ input: { ...baseInput, consumedFingerprints: [verified.fingerprint] }, ...common });
  assert.equal(consumed.state, 'already_consumed');

  messages.push(fixture({ id: 'msg_fixture_02', epoch: nowEpoch - 20 }));
  const ambiguous = await findExactZelleMatch({ input: baseInput, ...common });
  assert.equal(ambiguous.state, 'needs_review');
  assert.equal(ambiguous.match_count, 2);

  const absent = await findExactZelleMatch({ input: { ...baseInput, payerName: 'different payer' }, ...common });
  assert.equal(absent.state, 'not_found');
});
