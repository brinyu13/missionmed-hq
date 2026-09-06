import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { StripeGateway } from '../src/payments/stripe.mjs';
import { createMissionAccountsServer } from '../src/server.mjs';
import { PreviewStore } from '../src/storage/supabase-rest.mjs';

const localConfig = {
  production: false,
  localAuth: true,
  issuer: 'https://issuer.invalid',
  audience: 'missionaccounts',
  jwksUrl: 'https://issuer.invalid/jwks',
  features: { examPlans: false, compDays: false, autoBilling: false, zoomSync: false },
};

async function withServer(options, run) {
  const server = createMissionAccountsServer(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    server.close();
    await once(server, 'close');
  }
}

function stripeSignature(body, secret, timestamp) {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

test('Stripe webhook verifies the untouched body and stores a retry only once', async () => {
  const secret = 'whsec_server_test';
  const timestamp = Math.floor(Date.now() / 1000);
  const body = '{\n  "id": "evt_1", "type": "payment_intent.succeeded", "data": {"object": {"id": "pi_1"}}\n}';
  const headers = { 'content-type': 'application/json', 'stripe-signature': stripeSignature(body, secret, timestamp) };
  await withServer({
    config: localConfig,
    store: new PreviewStore(),
    stripeGateway: new StripeGateway({ webhookSecret: secret }),
  }, async base => {
    const first = await fetch(`${base}/api/webhooks/stripe`, { method: 'POST', headers, body });
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { received: true, duplicate: false });

    const retry = await fetch(`${base}/api/webhooks/stripe`, { method: 'POST', headers, body });
    assert.equal(retry.status, 200);
    assert.deepEqual(await retry.json(), { received: true, duplicate: true });
  });
});

test('Stripe webhook fails closed before parsing or storing an invalid signature', async () => {
  await withServer({
    config: localConfig,
    store: new PreviewStore(),
    stripeGateway: new StripeGateway({ webhookSecret: 'whsec_server_test' }),
  }, async base => {
    const response = await fetch(`${base}/api/webhooks/stripe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=invalid' },
      body: '{not json}',
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /signature invalid/);
  });
});

test('student role cannot read the administrative health endpoint', async () => {
  await withServer({
    config: localConfig,
    store: new PreviewStore(),
    stripeGateway: new StripeGateway(),
  }, async base => {
    const response = await fetch(`${base}/api/admin/health`, { headers: { 'x-missionaccounts-local-role': 'student' } });
    assert.equal(response.status, 403);
  });
});

test('student exam-plan submission is feature-gated and idempotent', async () => {
  const enabledConfig = { ...localConfig, features: { ...localConfig.features, examPlans: true } };
  const store = new PreviewStore();
  await withServer({ config: enabledConfig, store, stripeGateway: new StripeGateway() }, async base => {
    const headers = {
      'content-type': 'application/json',
      'x-missionaccounts-local-role': 'student',
      'idempotency-key': 'exam-request-0001',
    };
    const body = JSON.stringify({ step: 's2', exam_on: '2026-10-14' });
    const created = await fetch(`${base}/api/me/exam-plan`, { method: 'POST', headers, body });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).plan.state, 'pending');

    const retry = await fetch(`${base}/api/me/exam-plan`, { method: 'POST', headers, body });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);

    const conflicting = await fetch(`${base}/api/me/exam-plan`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ step: 's3', exam_on: '2026-10-15' }),
    });
    assert.equal(conflicting.status, 409);
  });
});

test('student exam-plan submission stays unavailable while its feature flag is off', async () => {
  await withServer({ config: localConfig, store: new PreviewStore(), stripeGateway: new StripeGateway() }, async base => {
    const response = await fetch(`${base}/api/me/exam-plan`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-missionaccounts-local-role': 'student',
        'idempotency-key': 'exam-request-0002',
      },
      body: JSON.stringify({ step: 's1', exam_on: '2026-10-14' }),
    });
    assert.equal(response.status, 503);
  });
});

test('admin comp override requires authority, reason, feature flag, and an idempotency key', async () => {
  const enabledConfig = { ...localConfig, features: { ...localConfig.features, compDays: true } };
  const store = new PreviewStore();
  const path = '/api/admin/students/00000000-0000-4000-8000-000000000001/comp';
  const body = JSON.stringify({ allowance: 3, joined_on: '2026-09-08', reason: 'Founder-approved student exception', apply_retroactively: false });
  await withServer({ config: enabledConfig, store, stripeGateway: new StripeGateway() }, async base => {
    const student = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-missionaccounts-local-role': 'student', 'idempotency-key': 'comp-request-0001' },
      body,
    });
    assert.equal(student.status, 403);

    const headers = { 'content-type': 'application/json', 'x-missionaccounts-local-role': 'missionaccounts_admin', 'idempotency-key': 'comp-request-0001' };
    const created = await fetch(`${base}${path}`, { method: 'POST', headers, body });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).student.comp_days_allowance, 3);

    const retry = await fetch(`${base}${path}`, { method: 'POST', headers, body });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);

    const missingReason = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': 'comp-request-0002' },
      body: JSON.stringify({ allowance: 4 }),
    });
    assert.equal(missingReason.status, 400);
  });
});

test('admin exam decisions drive grace/reminder effects and reject invalid transitions', async () => {
  const enabledConfig = { ...localConfig, features: { ...localConfig.features, examPlans: true } };
  const store = new PreviewStore();
  const submitted = await store.submitExamPlan({
    studentId: '00000000-0000-4000-8000-000000000001',
    step: 's2',
    examOn: '2026-09-09',
    actorId: 'student-1',
    requestId: 'exam-seed-0001',
  });
  const baseOptions = {
    config: enabledConfig,
    store,
    stripeGateway: new StripeGateway(),
    now: () => new Date('2026-09-10T16:00:00Z'),
  };
  const adminHeaders = { 'content-type': 'application/json', 'x-missionaccounts-local-role': 'missionaccounts_admin' };
  await withServer(baseOptions, async base => {
    const approveUrl = `${base}/api/admin/exam-plans/${submitted.plan.id}/approve`;
    const approved = await fetch(approveUrl, {
      method: 'POST',
      headers: { ...adminHeaders, 'idempotency-key': 'exam-transition-0001' },
      body: '{}',
    });
    assert.equal(approved.status, 200);
    const approval = await approved.json();
    assert.equal(approval.plan.state, 'approved');
    assert.equal(approval.effects.reminder.due_on, '2026-09-30');

    const resultUrl = `${base}/api/admin/exam-plans/${submitted.plan.id}/result`;
    const recorded = await fetch(resultUrl, {
      method: 'POST',
      headers: { ...adminHeaders, 'idempotency-key': 'exam-transition-0002' },
      body: JSON.stringify({ result: 'not_passed', note: 'Student reported result' }),
    });
    assert.equal(recorded.status, 200);
    const result = await recorded.json();
    assert.equal(result.plan.state, 'followup');
    assert.equal(result.effects.close_grace.to_on, '2026-09-10');

    const invalid = await fetch(`${base}/api/admin/exam-plans/${submitted.plan.id}/deny`, {
      method: 'POST',
      headers: { ...adminHeaders, 'idempotency-key': 'exam-transition-0003' },
      body: JSON.stringify({ note: 'Invalid from follow-up' }),
    });
    assert.equal(invalid.status, 409);
    assert.equal((await invalid.json()).accepted, false);
  });
});
