import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { StripeGateway } from '../src/payments/stripe.mjs';
import { createMissionAccountsServer } from '../src/server.mjs';
import { PreviewStore } from '../src/storage/supabase-rest.mjs';

const localConfig = {
  production: false,
  routeEnabled: false,
  localAuth: true,
  issuer: 'https://issuer.invalid',
  audience: 'missionaccounts',
  jwksUrl: 'https://issuer.invalid/jwks',
  features: { studentContacts: false, billingDecisions: false, attendanceCorrections: false, identityReview: false, examPlans: false, compDays: false, paymentMethodSetup: false, manualCharges: false, autoBilling: false, notifications: false, zoomSync: false },
  stripeAccountId: '',
  workerToken: '',
};

test('admin manual cycle charge is approval-bound, webhook-finalized, and retry-idempotent', async () => {
  const studentId = '00000000-0000-4000-8000-000000000001';
  const decisionId = '10000000-0000-4000-8000-000000000001';
  const cycleKey = '2026-cycle-1';
  const store = new PreviewStore();
  const approved = await store.approveBillingDecision({
    studentId, cycleKey, treatment: 'other', requestedAmountCents: 100,
    note: 'Founder-authorized one-dollar production witness', actorId: 'dr-j', actorRole: 'missionaccounts_admin', requestId: 'decision-request-0001',
  });
  approved.decision.id = decisionId;
  approved.invoice.decision_id = decisionId;
  store.billingDecisions.set(`${studentId}:${cycleKey}`, approved.decision);
  store.invoices.set(approved.invoice.id, approved.invoice);
  await store.saveStripeCustomer({ studentId, customerId: 'cus_live_manual_1' });
  store.seedPaymentMethod(studentId, {
    brand: 'visa', last4: '7734', status: 'on_file', provider_pm_ref: 'pm_live_manual_1', provider_customer_ref: 'cus_live_manual_1',
  });
  let providerCalls = 0;
  const gateway = {
    assertMutationAllowed() {},
    configurationState() { return { mode: 'live', credentials_configured: true, webhook_configured: true, mutations_enabled: true, live_mutations_enabled: true }; },
    verifyWebhook() {},
    async createManualCycleCharge(input) {
      providerCalls += 1;
      assert.equal(input.amountCents, 100);
      assert.equal(input.decisionId, decisionId);
      assert.equal(input.paymentMethodId, 'pm_live_manual_1');
      return { id: 'pi_live_manual_cycle_1', status: 'succeeded' };
    },
  };
  const config = { ...localConfig, features: { ...localConfig.features, manualCharges: true } };
  const path = `/api/admin/students/${studentId}/cycles/${cycleKey}/charge`;
  const headers = { 'content-type': 'application/json', 'x-missionaccounts-local-role': 'missionaccounts_admin', 'idempotency-key': 'manual-charge-request-0001' };
  const body = JSON.stringify({ decision_id: decisionId, expected_amount_cents: 100, expected_last4: '7734' });
  await withServer({ config, store, stripeGateway: gateway }, async base => {
    const first = await fetch(`${base}${path}`, { method: 'POST', headers, body });
    assert.equal(first.status, 202);
    const receipt = await first.json();
    assert.equal(receipt.payment_intent_id, 'pi_live_manual_cycle_1');
    assert.equal(receipt.charge.amount_cents, 100);
    assert.equal(receipt.customer_ref, undefined);
    assert.equal(receipt.payment_method_ref, undefined);

    const event = {
      id: 'evt_live_manual_cycle_1', type: 'payment_intent.succeeded', data: { object: {
        id: 'pi_live_manual_cycle_1', amount: 100, amount_received: 100, currency: 'usd', status: 'succeeded',
        customer: 'cus_live_manual_1', payment_method: 'pm_live_manual_1',
        metadata: { kind: 'manual_cycle_charge', manual_cycle_charge_id: receipt.charge.id, student_id: studentId, cycle_key: cycleKey, billing_decision_id: decisionId, amount_cents: '100' },
      } },
    };
    const webhook = await fetch(`${base}/api/webhooks/stripe`, { method: 'POST', headers: { 'stripe-signature': 'verified-by-stub' }, body: JSON.stringify(event) });
    assert.equal(webhook.status, 200);
    const charge = store.manualCycleCharges.get(`${studentId}:${cycleKey}`);
    assert.equal(charge.state, 'succeeded');
    assert.equal(store.invoices.get(charge.invoice_id).state, 'paid');

    const retry = await fetch(`${base}${path}`, { method: 'POST', headers, body });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).already_succeeded, true);
    assert.equal(providerCalls, 1);
    const fourth = await fetch(`${base}${path}`, { method: 'POST', headers: { ...headers, 'idempotency-key': 'manual-charge-request-0002' }, body });
    assert.equal(fourth.status, 409);
    assert.equal((await fourth.json()).reason, 'charge_already_succeeded');
    assert.equal(providerCalls, 1);
  });
});
const webhookConfig = {
  ...localConfig,
  features: { ...localConfig.features, paymentMethodSetup: true },
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
  const body = '{\n  "id": "evt_1", "type": "customer.updated", "data": {"object": {"id": "cus_1"}}\n}';
  const headers = { 'content-type': 'application/json', 'stripe-signature': stripeSignature(body, secret, timestamp) };
  const store = new PreviewStore();
  await withServer({
    config: webhookConfig,
    store,
    stripeGateway: new StripeGateway({ webhookSecret: secret }),
  }, async base => {
    const first = await fetch(`${base}/api/webhooks/stripe`, { method: 'POST', headers, body });
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { received: true, duplicate: false });
    assert.equal(store.providerEvents.get('stripe:evt_1').state, 'ignored');
    assert.equal(store.integrationExceptions.get('stripe:evt_1:unhandled').kind, 'unhandled_webhook_event');

    const retry = await fetch(`${base}/api/webhooks/stripe`, { method: 'POST', headers, body });
    assert.equal(retry.status, 200);
    assert.deepEqual(await retry.json(), { received: true, duplicate: true });
    assert.equal(store.integrationExceptions.size, 1);
  });
});

test('signed Stripe events from other account integrations are ignored without reaching MissionAccounts billing state', async () => {
  const secret = 'whsec_shared_account_test';
  const timestamp = Math.floor(Date.now() / 1000);
  const store = new PreviewStore();
  const gateway = new StripeGateway({ webhookSecret: secret });
  gateway.retrievePaymentMethod = async () => assert.fail('an unowned SetupIntent must not retrieve payment details');
  const events = [
    { id: 'evt_unowned_setup', type: 'setup_intent.succeeded', data: { object: { id: 'seti_other', metadata: {} } } },
    { id: 'evt_unowned_payment', type: 'payment_intent.succeeded', data: { object: { id: 'pi_other', metadata: {} } } },
    { id: 'evt_unowned_invoice', type: 'invoice.finalized', data: { object: { id: 'in_other', metadata: {} } } },
  ];

  await withServer({ config: webhookConfig, store, stripeGateway: gateway }, async base => {
    for (const event of events) {
      const body = JSON.stringify(event);
      const headers = { 'content-type': 'application/json', 'stripe-signature': stripeSignature(body, secret, timestamp) };
      const first = await fetch(`${base}/api/webhooks/stripe`, { method: 'POST', headers, body });
      assert.equal(first.status, 200);
      assert.deepEqual(await first.json(), { received: true, duplicate: false });
      assert.equal(store.providerEvents.get(`stripe:${event.id}`).state, 'ignored');

      const retry = await fetch(`${base}/api/webhooks/stripe`, { method: 'POST', headers, body });
      assert.equal(retry.status, 200);
      assert.deepEqual(await retry.json(), { received: true, duplicate: true });
    }
    assert.equal(store.integrationExceptions.size, 3);
  });
});

test('identity-cluster adjudication is admin-only, feature-gated, and idempotent', async () => {
  const store = new PreviewStore();
  const canonicalStudentId = '00000000-0000-4000-8000-000000000001';
  const secondStudentId = '00000000-0000-4000-8000-000000000002';
  store.seedIdentityCluster({
    ref: 'cluster:test-pair',
    members: [
      { id: 'alias-1', student_id: canonicalStudentId, source_key: 'source-1', display_value: 'Student One', relationship_state: 'candidate' },
      { id: 'alias-2', student_id: secondStudentId, source_key: 'source-2', display_value: 'Student 1', relationship_state: 'candidate' },
    ],
  });
  const enabledConfig = { ...localConfig, features: { ...localConfig.features, identityReview: true } };
  const body = JSON.stringify({
    decision: 'same',
    canonical_student_id: canonicalStudentId,
    note: 'Dr J confirmed the preserved Zoom identities belong to one student',
  });
  const headers = {
    'content-type': 'application/json',
    'x-missionaccounts-local-role': 'missionaccounts_admin',
    'idempotency-key': 'identity-cluster-0001',
  };
  await withServer({ config: enabledConfig, store, stripeGateway: new StripeGateway() }, async base => {
    const first = await fetch(`${base}/api/admin/identity/${encodeURIComponent('cluster:test-pair')}`, { method: 'POST', headers, body });
    assert.equal(first.status, 201);
    assert.equal((await first.json()).decision.canonical_student_id, canonicalStudentId);
    const retry = await fetch(`${base}/api/admin/identity/${encodeURIComponent('cluster:test-pair')}`, { method: 'POST', headers, body });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);
    const studentDenied = await fetch(`${base}/api/admin/identity/${encodeURIComponent('cluster:test-pair')}`, {
      method: 'POST',
      headers: { ...headers, 'x-missionaccounts-local-role': 'student', 'idempotency-key': 'identity-cluster-0002' },
      body: JSON.stringify({ decision: 'different', canonical_student_id: null, note: 'Student attempted an administrative decision' }),
    });
    assert.equal(studentDenied.status, 403);
  });
  await withServer({ config: localConfig, store, stripeGateway: new StripeGateway() }, async base => {
    const disabled = await fetch(`${base}/api/admin/identity/${encodeURIComponent('cluster:test-pair')}`, { method: 'POST', headers: { ...headers, 'idempotency-key': 'identity-cluster-0003' }, body });
    assert.equal(disabled.status, 503);
  });
});

test('device identity adjudication is admin-only, feature-gated, and idempotent', async () => {
  const store = new PreviewStore();
  const aliasId = '20000000-0000-4000-8000-000000000001';
  store.seedDeviceIdentityAlias({
    id: aliasId,
    student_id: '00000000-0000-4000-8000-000000000002',
    source_student_id: '00000000-0000-4000-8000-000000000002',
    source_key: 'device:zoom-ipad-7',
    display_value: 'Zoom iPad 7',
  });
  const enabledConfig = { ...localConfig, features: { ...localConfig.features, identityReview: true } };
  const body = JSON.stringify({
    decision: 'not_student',
    target_student_id: null,
    note: 'Dr J confirmed this Zoom endpoint was not a student attendee',
  });
  const headers = {
    'content-type': 'application/json',
    'x-missionaccounts-local-role': 'missionaccounts_admin',
    'idempotency-key': 'device-identity-0001',
  };
  await withServer({ config: enabledConfig, store, stripeGateway: new StripeGateway() }, async base => {
    const first = await fetch(`${base}/api/admin/device-identity/${aliasId}`, { method: 'POST', headers, body });
    assert.equal(first.status, 201);
    assert.equal((await first.json()).decision.decision, 'not_student');
    const retry = await fetch(`${base}/api/admin/device-identity/${aliasId}`, { method: 'POST', headers, body });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);
    const studentDenied = await fetch(`${base}/api/admin/device-identity/${aliasId}`, {
      method: 'POST',
      headers: { ...headers, 'x-missionaccounts-local-role': 'student', 'idempotency-key': 'device-identity-0002' },
      body,
    });
    assert.equal(studentDenied.status, 403);
  });
  await withServer({ config: localConfig, store, stripeGateway: new StripeGateway() }, async base => {
    const disabled = await fetch(`${base}/api/admin/device-identity/${aliasId}`, {
      method: 'POST', headers: { ...headers, 'idempotency-key': 'device-identity-0003' }, body,
    });
    assert.equal(disabled.status, 503);
  });
});

test('Stripe webhook fails closed before parsing or storing an invalid signature', async () => {
  await withServer({
    config: webhookConfig,
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

test('Stripe webhook cannot mutate payment state while automatic billing is feature-off', async () => {
  const gateway = {
    verifyWebhook() {
      assert.fail('feature-off webhook must stop before signature processing');
    },
  };
  await withServer({ config: localConfig, store: new PreviewStore(), stripeGateway: gateway }, async base => {
    const response = await fetch(`${base}/api/webhooks/stripe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': 'unused' },
      body: '{}',
    });
    assert.equal(response.status, 503);
    assert.match((await response.json()).message, /not enabled/i);
  });
});

test('Stripe SetupIntent webhook binds verified sanitized card metadata to the authenticated student record once', async () => {
  const secret = 'whsec_setup_test';
  const timestamp = Math.floor(Date.now() / 1000);
  const studentId = '00000000-0000-4000-8000-000000000001';
  const store = new PreviewStore();
  await store.saveStripeCustomer({ studentId, customerId: 'cus_test_student_1' });
  const gateway = new StripeGateway({ webhookSecret: secret });
  gateway.retrievePaymentMethod = async paymentMethodId => ({
    id: paymentMethodId,
    customer: 'cus_test_student_1',
    type: 'card',
    card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 },
  });
  const event = {
    id: 'evt_setup_1',
    type: 'setup_intent.succeeded',
    data: { object: {
      id: 'seti_test_1',
      customer: 'cus_test_student_1',
      payment_method: 'pm_test_student_1',
      metadata: { student_id: studentId },
    } },
  };
  const body = JSON.stringify(event);
  const headers = { 'content-type': 'application/json', 'stripe-signature': stripeSignature(body, secret, timestamp) };
  await withServer({ config: webhookConfig, store, stripeGateway: gateway }, async base => {
    const first = await fetch(`${base}/api/webhooks/stripe`, { method: 'POST', headers, body });
    assert.equal(first.status, 200);
    assert.equal((await first.json()).duplicate, false);
    const paymentMethod = await store.paymentMethodForStudent(studentId);
    assert.deepEqual(
      { brand: paymentMethod.brand, last4: paymentMethod.last4, status: paymentMethod.status },
      { brand: 'visa', last4: '4242', status: 'on_file' },
    );

    const retry = await fetch(`${base}/api/webhooks/stripe`, { method: 'POST', headers, body });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);
  });
});

test('student payment setup creates a stable Stripe customer and returns only SetupIntent browser material', async () => {
  const enabledConfig = { ...localConfig, features: { ...localConfig.features, paymentMethodSetup: true } };
  const store = new PreviewStore();
  const calls = { customers: 0, setupIntents: 0 };
  const gateway = {
    createCustomer: async ({ studentId }) => {
      calls.customers += 1;
      assert.equal(studentId, '00000000-0000-4000-8000-000000000001');
      return { id: 'cus_test_student_1' };
    },
    createSetupIntent: async (customerId, studentId, requestId) => {
      calls.setupIntents += 1;
      assert.equal(customerId, 'cus_test_student_1');
      return { id: `seti_test_setup_${calls.setupIntents}`, client_secret: `seti_test_${studentId}_secret_preview` };
    },
  };
  await withServer({ config: enabledConfig, store, stripeGateway: gateway }, async base => {
    const headers = { 'x-missionaccounts-local-role': 'student', 'idempotency-key': 'payment-setup-0001' };
    const first = await fetch(`${base}/api/me/payment-setup/session`, { method: 'POST', headers });
    assert.equal(first.status, 201);
    const firstPayload = await first.json();
    assert.equal(firstPayload.customer_created, true);
    assert.equal(firstPayload.setup_intent_id, 'seti_test_setup_1');
    assert.match(firstPayload.client_secret, /_secret_/);
    assert.equal(Object.hasOwn(firstPayload, 'customer_id'), false);

    const second = await fetch(`${base}/api/me/payment-setup/session`, {
      method: 'POST', headers: { ...headers, 'idempotency-key': 'payment-setup-0002' },
    });
    assert.equal(second.status, 201);
    assert.equal((await second.json()).customer_created, false);
    assert.deepEqual(calls, { customers: 1, setupIntents: 2 });
  });
});

test('student payment-method removal revokes billing consent before a retry-safe Stripe detach', async () => {
  const enabledConfig = { ...localConfig, features: { ...localConfig.features, paymentMethodSetup: true } };
  const store = new PreviewStore();
  const studentId = '00000000-0000-4000-8000-000000000001';
  store.seedPaymentMethod(studentId, { brand: 'visa', last4: '4242', status: 'on_file', provider_pm_ref: 'pm_test_remove_1' });
  store.seedBillingTerms('test-terms-v1');
  await store.setBillingConsent({
    studentId,
    action: 'authorize',
    termsVersion: 'test-terms-v1',
    acceptedIp: '127.0.0.1',
    reason: 'Student accepted test terms',
    actorId: studentId,
    requestId: 'payment-remove-consent-seed',
  });
  const detachCalls = [];
  const gateway = {
    assertMutationAllowed() {},
    async detachPaymentMethod(paymentMethodId, requestId) {
      detachCalls.push({ paymentMethodId, requestId });
      return { id: paymentMethodId };
    },
  };
  await withServer({ config: enabledConfig, store, stripeGateway: gateway }, async base => {
    const headers = { 'x-missionaccounts-local-role': 'student', 'idempotency-key': 'payment-remove-request-0001' };
    const removed = await fetch(`${base}/api/me/payment-method`, { method: 'DELETE', headers });
    assert.equal(removed.status, 200);
    const payload = await removed.json();
    assert.equal(payload.payment_method.status, 'removed');
    assert.equal(Object.hasOwn(payload, 'provider_payment_method_ref'), false);
    assert.equal(store.billingConsents.get(studentId).state, 'revoked');
    assert.deepEqual(detachCalls, [{ paymentMethodId: 'pm_test_remove_1', requestId: 'payment-remove-request-0001' }]);

    const retry = await fetch(`${base}/api/me/payment-method`, { method: 'DELETE', headers });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);
    assert.equal(detachCalls.length, 1);
  });
});

test('Dr J receives only the configured live Stripe customer link while students remain denied', async () => {
  const store = new PreviewStore();
  const studentId = '00000000-0000-4000-8000-000000000001';
  await store.saveStripeCustomer({ studentId, customerId: 'cus_live_student_1' });
  const config = {
    ...localConfig,
    stripeMode: 'live',
    stripeAccountId: 'acct_live_exam_prep',
    features: { ...localConfig.features, paymentMethodSetup: true },
  };
  const path = `/api/admin/students/${studentId}/stripe-customer`;
  await withServer({ config, store, stripeGateway: new StripeGateway() }, async base => {
    const denied = await fetch(`${base}${path}`, { headers: { 'x-missionaccounts-local-role': 'student' } });
    assert.equal(denied.status, 403);
    const allowed = await fetch(`${base}${path}`, { headers: { 'x-missionaccounts-local-role': 'missionaccounts_admin' } });
    assert.equal(allowed.status, 200);
    assert.deepEqual(await allowed.json(), {
      customer_id: 'cus_live_student_1',
      dashboard_url: 'https://dashboard.stripe.com/acct_live_exam_prep/customers/cus_live_student_1',
    });
  });
});

test('student attendance issue report is self-bound, idempotent, audited, and queued for Dr J', async () => {
  const config = { ...localConfig, features: { ...localConfig.features, attendanceCorrections: true } };
  const store = new PreviewStore();
  await withServer({ config, store, stripeGateway: new StripeGateway() }, async base => {
    const headers = {
      'x-missionaccounts-local-role': 'student',
      'idempotency-key': 'attendance-issue-request-0001',
      'content-type': 'application/json',
    };
    const body = JSON.stringify({
      issue_text: 'I attended the Step 2/3 class on August 21, but it is missing.',
      route: '#/me/attendance?cycle=august',
    });
    const created = await fetch(`${base}/api/me/attendance-issues`, { method: 'POST', headers, body });
    assert.equal(created.status, 201);
    const payload = await created.json();
    assert.equal(payload.accepted, true);
    assert.equal(payload.duplicate, false);
    assert.equal(payload.issue.student_id, '00000000-0000-4000-8000-000000000001');
    assert.equal(payload.issue.state, 'open');
    assert.equal(store.attendanceIssues.size, 1);
    const notice = [...store.notifications.values()].find(row => row.event_kind === 'attendance.issue_reported');
    assert.equal(notice.audience, 'missionaccounts_admin');
    assert.equal(notice.student_id, payload.issue.student_id);

    const retry = await fetch(`${base}/api/me/attendance-issues`, { method: 'POST', headers, body });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);
    assert.equal(store.attendanceIssues.size, 1);
    assert.equal([...store.notifications.values()].filter(row => row.event_kind === 'attendance.issue_reported').length, 1);

    const admin = await fetch(`${base}/api/me/attendance-issues`, {
      method: 'POST',
      headers: { ...headers, 'x-missionaccounts-local-role': 'missionaccounts_admin', 'idempotency-key': 'attendance-issue-admin-forbidden' },
      body,
    });
    assert.equal(admin.status, 403);

    const studentQueue = await fetch(`${base}/api/admin/attendance-issues`, {
      headers: { 'x-missionaccounts-local-role': 'student' },
    });
    assert.equal(studentQueue.status, 403);

    const adminHeaders = {
      'x-missionaccounts-local-role': 'missionaccounts_admin',
      'x-missionaccounts-local-user': '00000000-0000-4000-8000-000000000002',
      'content-type': 'application/json',
    };
    const queue = await fetch(`${base}/api/admin/attendance-issues?state=open`, { headers: adminHeaders });
    assert.equal(queue.status, 200);
    assert.equal((await queue.json()).issues.length, 1);
    const adminBootstrap = await fetch(`${base}/api/ui/bootstrap`, { headers: adminHeaders });
    assert.equal(adminBootstrap.status, 200);
    const adminBootstrapPayload = await adminBootstrap.json();
    assert.equal(adminBootstrapPayload.attendance_issues.length, 1);
    assert.equal(adminBootstrapPayload.home.attendance_issues, 1);

    const studentReview = await fetch(`${base}/api/admin/attendance-issues/${payload.issue.id}/review`, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': 'attendance-issue-student-review-forbidden' },
      body: JSON.stringify({ state: 'resolved', resolution_note: 'Checked the Zoom report.' }),
    });
    assert.equal(studentReview.status, 403);

    const reviewHeaders = { ...adminHeaders, 'idempotency-key': 'attendance-issue-review-0001' };
    const reviewBody = JSON.stringify({ state: 'resolved', resolution_note: 'Checked the Zoom record and restored the class separately.' });
    const reviewed = await fetch(`${base}/api/admin/attendance-issues/${payload.issue.id}/review`, {
      method: 'POST', headers: reviewHeaders, body: reviewBody,
    });
    assert.equal(reviewed.status, 201);
    const reviewedPayload = await reviewed.json();
    assert.equal(reviewedPayload.duplicate, false);
    assert.equal(reviewedPayload.issue.state, 'resolved');
    assert.equal(reviewedPayload.issue.resolution_note, 'Checked the Zoom record and restored the class separately.');
    const studentNotice = [...store.notifications.values()].find(row => row.event_kind === 'attendance.issue_reviewed');
    assert.equal(studentNotice.audience, 'student');
    assert.equal(studentNotice.student_id, payload.issue.student_id);

    const reviewRetry = await fetch(`${base}/api/admin/attendance-issues/${payload.issue.id}/review`, {
      method: 'POST', headers: reviewHeaders, body: reviewBody,
    });
    assert.equal(reviewRetry.status, 200);
    assert.equal((await reviewRetry.json()).duplicate, true);
    assert.equal([...store.notifications.values()].filter(row => row.event_kind === 'attendance.issue_reviewed').length, 1);
    assert.equal((await (await fetch(`${base}/api/admin/attendance-issues?state=open`, { headers: adminHeaders })).json()).issues.length, 0);
    assert.equal((await (await fetch(`${base}/api/admin/attendance-issues?state=resolved`, { headers: adminHeaders })).json()).issues.length, 1);
  });
});

test('student attendance issue reporting is feature-off and validates bounded route context', async () => {
  const store = new PreviewStore();
  const headers = {
    'x-missionaccounts-local-role': 'student',
    'idempotency-key': 'attendance-issue-feature-off',
    'content-type': 'application/json',
  };
  await withServer({ config: localConfig, store, stripeGateway: new StripeGateway() }, async base => {
    const response = await fetch(`${base}/api/me/attendance-issues`, {
      method: 'POST', headers, body: JSON.stringify({ issue_text: 'A valid issue', route: '#/me/attendance' }),
    });
    assert.equal(response.status, 503);
    assert.equal(store.attendanceIssues.size, 0);
  });
  const config = { ...localConfig, features: { ...localConfig.features, attendanceCorrections: true } };
  await withServer({ config, store, stripeGateway: new StripeGateway() }, async base => {
    const response = await fetch(`${base}/api/me/attendance-issues`, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': 'attendance-issue-invalid-route' },
      body: JSON.stringify({ issue_text: 'A valid issue', route: 'https://attacker.invalid/' }),
    });
    assert.equal(response.status, 400);
    assert.equal(store.attendanceIssues.size, 0);
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

async function seedAutomaticChargeFixture(store, { computedAt, attendanceDayId }) {
  const studentId = '00000000-0000-4000-8000-000000000001';
  const cycleKey = '2026-cycle-1';
  store.seedAttendanceDays(studentId, cycleKey, [{
    id: attendanceDayId,
    day: '2026-09-08',
    kind: 'billable',
    event_ids: ['event-auto-charge'],
    computed_at: computedAt,
  }]);
  await store.approveBillingDecision({
    studentId, cycleKey, treatment: 'confirm', requestedAmountCents: null,
    note: null, actorId: 'admin-1', requestId: `auto-charge-decision-${attendanceDayId}`,
  });
  await store.saveStripeCustomer({ studentId, customerId: 'cus_test_auto_charge' });
  store.seedPaymentMethod(studentId, {
    brand: 'visa', last4: '4242', status: 'on_file', provider_pm_ref: 'pm_test_auto_charge',
  });
  store.seedBillingTerms('test-terms-v1');
  await store.setBillingConsent({
    studentId, action: 'authorize', termsVersion: 'test-terms-v1', acceptedIp: '127.0.0.1',
    reason: 'Student accepted automatic billing terms', actorId: studentId,
    requestId: `auto-charge-consent-${attendanceDayId}`,
  });
  return { studentId, cycleKey };
}

test('automatic charge worker stops before claiming database work unless Stripe Test Mode is configured', async () => {
  const store = new PreviewStore();
  let claims = 0;
  store.claimDueDayCharges = async () => { claims += 1; return { claimed: [], expired: 0 }; };
  const config = {
    ...localConfig,
    workerToken: 'automatic-charge-worker-disabled',
    features: { ...localConfig.features, autoBilling: true },
  };
  const gateway = { assertTestMode() { throw new Error('Stripe mutation is disabled outside configured Test Mode'); } };
  await withServer({ config, store, stripeGateway: gateway }, async base => {
    const response = await fetch(`${base}/api/internal/charges/drain`, {
      method: 'POST', headers: { authorization: 'Bearer automatic-charge-worker-disabled' },
    });
    assert.equal(response.status, 500);
    assert.equal(claims, 0);
  });
});

test('automatic charge worker submits one eligible day only inside the 24-48 hour window', async () => {
  const store = new PreviewStore();
  const attendanceDayId = '10000000-0000-4000-8000-000000000021';
  await seedAutomaticChargeFixture(store, {
    attendanceDayId,
    computedAt: '2026-09-09T11:00:00.000Z',
  });
  const calls = [];
  const gateway = {
    assertTestMode() {},
    async createDayCharge(args) { calls.push(args); return { id: 'pi_test_automatic_charge_1' }; },
  };
  const config = {
    ...localConfig,
    workerToken: 'automatic-charge-worker-test',
    features: { ...localConfig.features, autoBilling: true },
  };
  await withServer({
    config, store, stripeGateway: gateway, now: () => new Date('2026-09-10T12:00:00.000Z'),
  }, async base => {
    const headers = { authorization: 'Bearer automatic-charge-worker-test', 'content-type': 'application/json' };
    const first = await fetch(`${base}/api/internal/charges/drain`, { method: 'POST', headers, body: '{}' });
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { claimed: 1, submitted: 1, failed: 0, expired: 0 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].attendanceDayId, attendanceDayId);
    assert.equal(calls[0].receiptEmail, 'student.preview@invalid.local');
    assert.equal(store.chargesByDay.get(attendanceDayId).provider_ref, 'pi_test_automatic_charge_1');
    assert.equal(store.autoChargeDispatches.get(attendanceDayId).state, 'submitted');

    const second = await fetch(`${base}/api/internal/charges/drain`, { method: 'POST', headers, body: '{}' });
    assert.equal(second.status, 200);
    assert.deepEqual(await second.json(), { claimed: 0, submitted: 0, failed: 0, expired: 0 });
    assert.equal(calls.length, 1);
  });
});

test('automatic charge worker safely resumes a stale pre-provider claim with the same day idempotency key', async () => {
  const store = new PreviewStore();
  const attendanceDayId = '10000000-0000-4000-8000-000000000025';
  await seedAutomaticChargeFixture(store, {
    attendanceDayId,
    computedAt: '2026-09-09T11:00:00.000Z',
  });
  const abandoned = await store.claimDueDayCharges({
    now: '2026-09-10T12:00:00.000Z', workerId: 'crashed-worker', limit: 1,
  });
  assert.equal(abandoned.claimed.length, 1);
  assert.equal(store.autoChargeDispatches.get(attendanceDayId).state, 'claimed');

  let calls = 0;
  const gateway = {
    assertTestMode() {},
    async createDayCharge() { calls += 1; return { id: 'pi_test_reclaimed_charge_1' }; },
  };
  const config = {
    ...localConfig,
    workerToken: 'automatic-charge-reclaim-worker',
    features: { ...localConfig.features, autoBilling: true },
  };
  await withServer({
    config, store, stripeGateway: gateway, now: () => new Date('2026-09-10T12:11:00.000Z'),
  }, async base => {
    const response = await fetch(`${base}/api/internal/charges/drain`, {
      method: 'POST', headers: { authorization: 'Bearer automatic-charge-reclaim-worker' },
    });
    assert.deepEqual(await response.json(), { claimed: 1, submitted: 1, failed: 0, expired: 0 });
    assert.equal(calls, 1);
    assert.equal(store.autoChargeDispatches.get(attendanceDayId).state, 'submitted');
  });
});

test('automatic charge worker leaves early days untouched and records missed-window days for review', async () => {
  const config = {
    ...localConfig,
    workerToken: 'automatic-charge-window-worker',
    features: { ...localConfig.features, autoBilling: true },
  };
  const gateway = { assertTestMode() {}, async createDayCharge() { assert.fail('no charge should be submitted'); } };

  const earlyStore = new PreviewStore();
  await seedAutomaticChargeFixture(earlyStore, {
    attendanceDayId: '10000000-0000-4000-8000-000000000022',
    computedAt: '2026-09-09T13:00:00.000Z',
  });
  await withServer({
    config, store: earlyStore, stripeGateway: gateway, now: () => new Date('2026-09-10T12:00:00.000Z'),
  }, async base => {
    const response = await fetch(`${base}/api/internal/charges/drain`, {
      method: 'POST', headers: { authorization: 'Bearer automatic-charge-window-worker' },
    });
    assert.deepEqual(await response.json(), { claimed: 0, submitted: 0, failed: 0, expired: 0 });
    assert.equal(earlyStore.chargesByDay.size, 0);
  });

  const expiredStore = new PreviewStore();
  await seedAutomaticChargeFixture(expiredStore, {
    attendanceDayId: '10000000-0000-4000-8000-000000000023',
    computedAt: '2026-09-08T10:00:00.000Z',
  });
  await withServer({
    config, store: expiredStore, stripeGateway: gateway, now: () => new Date('2026-09-10T12:00:00.000Z'),
  }, async base => {
    const response = await fetch(`${base}/api/internal/charges/drain`, {
      method: 'POST', headers: { authorization: 'Bearer automatic-charge-window-worker' },
    });
    assert.deepEqual(await response.json(), { claimed: 0, submitted: 0, failed: 0, expired: 1 });
    assert.equal(expiredStore.chargesByDay.size, 0);
    assert.equal(expiredStore.integrationExceptions.size, 1);
  });
});

test('automatic charge submission failure is notified and never retried automatically', async () => {
  const store = new PreviewStore();
  const attendanceDayId = '10000000-0000-4000-8000-000000000024';
  await seedAutomaticChargeFixture(store, {
    attendanceDayId,
    computedAt: '2026-09-09T11:00:00.000Z',
  });
  let calls = 0;
  const gateway = {
    assertTestMode() {},
    async createDayCharge() { calls += 1; throw new Error('test provider rejection'); },
  };
  const config = {
    ...localConfig,
    workerToken: 'automatic-charge-failure-worker',
    features: { ...localConfig.features, autoBilling: true },
  };
  await withServer({
    config, store, stripeGateway: gateway, now: () => new Date('2026-09-10T12:00:00.000Z'),
  }, async base => {
    const headers = { authorization: 'Bearer automatic-charge-failure-worker' };
    const first = await fetch(`${base}/api/internal/charges/drain`, { method: 'POST', headers });
    assert.deepEqual(await first.json(), { claimed: 1, submitted: 0, failed: 1, expired: 0 });
    assert.equal(store.chargesByDay.get(attendanceDayId).state, 'failed');
    assert.equal(store.notifications.size, 2);
    assert.equal(store.integrationExceptions.size, 1);

    const second = await fetch(`${base}/api/internal/charges/drain`, { method: 'POST', headers });
    assert.deepEqual(await second.json(), { claimed: 0, submitted: 0, failed: 0, expired: 0 });
    assert.equal(calls, 1);
  });
});

function zoomBatchFixture() {
  return {
    state: 'ready_to_persist',
    window_from: '2026-09-01T00:00:00.000Z',
    window_to: '2026-09-02T00:00:00.000Z',
    artifact: {
      source_path: 'zoom-api://completed-meetings/test-window',
      sha256: 'a'.repeat(64),
      byte_count: 512,
      observed_at: '2026-09-02T12:00:00.000Z',
    },
    sessions: [{
      cycle_key: '2026-cycle-3', provider_meeting_id: 'meeting-1',
      provider_instance_id: 'instance-1', starts_at: '2026-09-01T16:00:00.000Z',
      held_on: '2026-09-01', time_zone: 'America/New_York', step: 's1',
      state: 'candidate', source_payload: {},
    }],
    source_rows: [{
      provider_instance_id: 'instance-1', provider_source_id: 'source-row-1',
      participant_source_id: 'participant-1', display_name: 'Unresolved attendee',
      joined_at: '2026-09-01T16:01:00.000Z', left_at: '2026-09-01T17:00:00.000Z',
      duration_seconds: 3540, payload: {}, payload_sha256: 'b'.repeat(64),
    }],
  };
}

test('Zoom sync remains feature-off and provider-disconnected without creating run evidence', async () => {
  const store = new PreviewStore();
  let providerChecks = 0;
  const zoomProvider = { assertConfigured() { providerChecks += 1; } };
  await withServer({ config: localConfig, store, stripeGateway: new StripeGateway(), zoomProvider }, async base => {
    const response = await fetch(`${base}/api/internal/zoom/sync`, {
      method: 'POST', headers: { authorization: 'Bearer unused', 'content-type': 'application/json', 'idempotency-key': 'zoom-sync-off-0001' },
      body: JSON.stringify({ window_from: '2026-09-01T00:00:00Z', window_to: '2026-09-02T00:00:00Z' }),
    });
    assert.equal(response.status, 503);
    assert.equal(providerChecks, 0);
    assert.equal(store.syncRuns.size, 0);
  });
});

test('Zoom sync reconciles only confirmed attendance and reports every prohibited automatic mutation', async () => {
  const store = new PreviewStore();
  const calls = [];
  const zoomProvider = {
    assertConfigured() {},
    async ingestWindow(window) { calls.push(window); return zoomBatchFixture(); },
  };
  const config = {
    ...localConfig,
    workerToken: 'zoom-worker-test',
    features: { ...localConfig.features, zoomSync: true },
  };
  await withServer({ config, store, stripeGateway: new StripeGateway(), zoomProvider }, async base => {
    const headers = {
      authorization: 'Bearer zoom-worker-test', 'content-type': 'application/json',
      'idempotency-key': 'zoom-sync-request-0001',
    };
    const body = JSON.stringify({ window_from: '2026-09-01T00:00:00Z', window_to: '2026-09-02T00:00:00Z' });
    const first = await fetch(`${base}/api/internal/zoom/sync`, { method: 'POST', headers, body });
    assert.equal(first.status, 201);
    assert.deepEqual(await first.json(), {
      accepted: true, duplicate: false, state: 'reconciled_attendance',
      sync_run_id: 'preview-zoom-sync-1', sessions: 1, source_rows: 1,
      attendance_events_created: 0, attendance_source_links_created: 0,
      review_identities_created: 0, exact_identities_reused: 0,
      matched_source_rows: 0, review_source_rows: 1, excluded_source_rows: 0,
      nonconfirmed_source_rows: 1, students_recomputed: 0, billing_decisions_staled: 0,
      identity_decisions_created: 0, billing_decisions_approved: 0,
      invoices_created: 0, charges_created: 0, charges_submitted: 0,
    });
    assert.equal(store.chargesByDay.size, 0);
    assert.equal(store.attendanceDays.size, 0);

    const retry = await fetch(`${base}/api/internal/zoom/sync`, { method: 'POST', headers, body });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);
    assert.equal(store.zoomImports.size, 1);
    assert.equal(calls.length, 2);
  });
});

test('Zoom provider failure creates one persistent run exception and exposes no false success', async () => {
  const store = new PreviewStore();
  const zoomProvider = {
    assertConfigured() {},
    async ingestWindow() { throw Object.assign(new Error('disposable Zoom provider failure'), { status: 502 }); },
  };
  const config = {
    ...localConfig,
    workerToken: 'zoom-worker-failure-test',
    features: { ...localConfig.features, zoomSync: true },
  };
  await withServer({ config, store, stripeGateway: new StripeGateway(), zoomProvider }, async base => {
    const headers = {
      authorization: 'Bearer zoom-worker-failure-test', 'content-type': 'application/json',
      'idempotency-key': 'zoom-sync-failure-0001',
    };
    const body = JSON.stringify({ window_from: '2026-09-01T00:00:00Z', window_to: '2026-09-02T00:00:00Z' });
    const response = await fetch(`${base}/api/internal/zoom/sync`, { method: 'POST', headers, body });
    assert.equal(response.status, 502);
    assert.equal(store.syncRuns.get('zoom-sync-failure-0001').state, 'failed');
    assert.equal(store.integrationExceptions.size, 1);
    const health = await store.adminHealth();
    assert.equal(health.latest_zoom_sync.state, 'failed');
    assert.equal(health.open_integration_exceptions, 1);
  });
});

test('UI bootstrap is role-scoped and works from the mounted MissionAccounts route', async () => {
  const studentId = '00000000-0000-4000-8000-000000000001';
  const store = new PreviewStore();
  store.seedIdentityCluster({
    ref: 'cluster:bootstrap-review',
    members: [
      { id: 'alias-bootstrap-1', student_id: studentId, display_value: 'Preview Student', relationship_state: 'candidate' },
      { id: 'alias-bootstrap-2', student_id: null, display_value: 'Preview Learner', relationship_state: 'candidate' },
    ],
  });
  await withServer({ config: localConfig, store, stripeGateway: new StripeGateway() }, async base => {
    const studentResponse = await fetch(`${base}/missionaccounts/api/ui/bootstrap`, {
      headers: { 'x-missionaccounts-local-role': 'student' },
    });
    assert.equal(studentResponse.status, 200);
    const student = await studentResponse.json();
    assert.equal(student.schema_version, 'missionaccounts-ui-bootstrap-v1');
    assert.equal(student.scope, 'student');
    assert.equal(student.user.role, 'student');
    assert.equal(student.account.student.id, studentId);
    assert.equal(student.canon.scope, 'student');
    assert.equal(student.canon.students.length, 1);
    assert.equal(Object.hasOwn(student.canon, 'identity_clusters'), false);
    for (const adminOnlyKey of ['home', 'students', 'cycles', 'identity_clusters', 'health']) {
      assert.equal(Object.hasOwn(student, adminOnlyKey), false, `student bootstrap leaked ${adminOnlyKey}`);
    }

    const adminResponse = await fetch(`${base}/missionaccounts/api/ui/bootstrap`, {
      headers: { 'x-missionaccounts-local-role': 'missionaccounts_admin' },
    });
    assert.equal(adminResponse.status, 200);
    const admin = await adminResponse.json();
    assert.equal(admin.schema_version, 'missionaccounts-ui-bootstrap-v1');
    assert.equal(admin.scope, 'admin');
    assert.equal(admin.user.role, 'missionaccounts_admin');
    assert.equal(admin.students.length, 1);
    assert.equal(admin.cycles.length, 3);
    assert.equal(admin.identity_clusters.length, 1);
    assert.equal(admin.canon.scope, 'admin');
    assert.equal(admin.canon.students.length, 1);
    assert.equal(admin.canon.identity_clusters.length, 1);
    assert.equal(admin.health.mode, 'preview');
    assert.equal(admin.health.zoom_sync_enabled, false);
    assert.equal(admin.health.zoom_provider_configured, false);
    assert.equal(Object.hasOwn(admin, 'account'), false);
  });
});

test('administrator account linking is idempotent, private, and applies the post-September-5 comp default', async () => {
  const studentId = '00000000-0000-4000-8000-000000000001';
  const matrixUserId = '10000000-0000-4000-8000-000000000099';
  const store = new PreviewStore();
  store.previewStudentRecord.matrix_user_ref = null;
  await withServer({
    config: localConfig,
    store,
    stripeGateway: new StripeGateway(),
    now: () => new Date('2026-09-06T16:00:00Z'),
  }, async base => {
    const path = `${base}/api/admin/students/${studentId}/account-link`;
    const body = JSON.stringify({ matrix_user_id: matrixUserId, reason: 'Verified pilot account identity' });
    const headers = {
      'content-type': 'application/json',
      'x-missionaccounts-local-role': 'missionaccounts_admin',
      'idempotency-key': 'account-link-request-0001',
    };

    const denied = await fetch(path, {
      method: 'POST',
      headers: { ...headers, 'x-missionaccounts-local-role': 'student', 'idempotency-key': 'account-link-request-0000' },
      body,
    });
    assert.equal(denied.status, 403);

    const linked = await fetch(path, { method: 'POST', headers, body });
    assert.equal(linked.status, 201);
    const payload = await linked.json();
    assert.equal(payload.duplicate, false);
    assert.equal(payload.student.joined_at, '2026-09-06');
    assert.equal(payload.student.comp_days_allowance, 5);
    assert.equal(Object.hasOwn(payload.student, 'matrix_user_ref'), false);

    const retry = await fetch(path, { method: 'POST', headers, body });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);

    const studentBootstrap = await fetch(`${base}/api/ui/bootstrap`, {
      headers: { 'x-missionaccounts-local-role': 'student', 'x-missionaccounts-local-user': matrixUserId },
    });
    assert.equal(studentBootstrap.status, 200);
    assert.equal((await studentBootstrap.json()).account.student.comp_days_allowance, 5);
  });
});

test('administrative home, cycle, directory, and student projections are role-protected and server-derived', async () => {
  const store = new PreviewStore();
  const studentId = '00000000-0000-4000-8000-000000000001';
  const cycleKey = '2026-cycle-1';
  store.seedAttendanceDays(studentId, cycleKey, [
    { id: '10000000-0000-4000-8000-000000000001', day: '2026-09-08', kind: 'billable', event_ids: ['event-1'] },
  ]);
  store.seedIdentityCluster({
    ref: 'cluster:test-review',
    members: [
      { id: 'alias-1', student_id: studentId, display_value: 'Preview A', relationship_state: 'candidate' },
      { id: 'alias-2', student_id: null, display_value: 'Preview B', relationship_state: 'candidate' },
    ],
  });
  await store.submitExamPlan({ studentId, step: 's1', examOn: '2026-10-14', actorId: studentId, requestId: 'admin-projection-exam-0001' });
  await withServer({
    config: localConfig,
    store,
    stripeGateway: new StripeGateway(),
    now: () => new Date('2026-09-15T16:00:00Z'),
  }, async base => {
    const denied = await fetch(`${base}/api/admin/home`, { headers: { 'x-missionaccounts-local-role': 'student' } });
    assert.equal(denied.status, 403);

    const headers = { 'x-missionaccounts-local-role': 'missionaccounts_admin' };
    const home = await fetch(`${base}/api/admin/home`, { headers });
    assert.equal(home.status, 200);
    const homePayload = await home.json();
    assert.equal(homePayload.pending_exam_plans, 1);
    assert.equal(homePayload.missing_payment_setup, 1);
    assert.equal(homePayload.identity_questions, 1);

    const identity = await fetch(`${base}/api/admin/identity?state=open`, { headers });
    assert.equal(identity.status, 200);
    const identityPayload = await identity.json();
    assert.equal(identityPayload.clusters.length, 1);
    assert.equal(identityPayload.clusters[0].members.length, 2);

    const identityDenied = await fetch(`${base}/api/admin/identity`, { headers: { 'x-missionaccounts-local-role': 'student' } });
    assert.equal(identityDenied.status, 403);

    const directory = await fetch(`${base}/api/admin/students?missing=setup&q=Preview`, { headers });
    assert.equal(directory.status, 200);
    assert.equal((await directory.json()).students.length, 1);
    const noMatch = await fetch(`${base}/api/admin/students?q=Nobody`, { headers });
    assert.equal((await noMatch.json()).students.length, 0);

    const cycle = await fetch(`${base}/api/admin/cycles/${cycleKey}`, { headers });
    assert.equal(cycle.status, 200);
    assert.equal((await cycle.json()).attendance_days.length, 1);

    const detail = await fetch(`${base}/api/admin/students/${studentId}`, { headers });
    assert.equal(detail.status, 200);
    const detailPayload = await detail.json();
    assert.equal(detailPayload.student.id, studentId);
    assert.equal(detailPayload.exam_plan.state, 'pending');
    assert.equal(Object.hasOwn(detailPayload.student, 'matrix_user_ref'), false);

    const missing = await fetch(`${base}/api/admin/students/00000000-0000-4000-8000-000000000002`, { headers });
    assert.equal(missing.status, 404);
  });
});

test('notification worker claims each row once, requires its own token, and records transport success or retry', async () => {
  const config = {
    ...localConfig,
    workerToken: 'worker-secret-test',
    features: { ...localConfig.features, notifications: true },
  };
  const store = new PreviewStore();
  store.seedNotification({ id: 'notification-ok', event_kind: 'exam_plan.approved', idempotency_key: 'notification-key-ok' });
  store.seedNotification({ id: 'notification-fail', event_kind: 'charge.failed', idempotency_key: 'notification-key-fail' });
  const gateway = {
    assertConfigured() {},
    async send(notification) {
      if (notification.id === 'notification-fail') throw new Error('Provider temporarily unavailable');
      return { providerRef: 'matrix-message-1' };
    },
  };
  await withServer({
    config,
    store,
    stripeGateway: new StripeGateway(),
    notificationGateway: gateway,
    now: () => new Date('2026-09-15T16:00:00Z'),
  }, async base => {
    const denied = await fetch(`${base}/api/internal/notifications/drain`, {
      method: 'POST', headers: { authorization: 'Bearer wrong-secret', 'content-type': 'application/json' }, body: '{}',
    });
    assert.equal(denied.status, 401);
    assert.equal([...store.notifications.values()].every(row => row.state === 'pending'), true);

    const headers = { authorization: 'Bearer worker-secret-test', 'content-type': 'application/json' };
    const drained = await fetch(`${base}/api/internal/notifications/drain`, { method: 'POST', headers, body: JSON.stringify({ limit: 2 }) });
    assert.equal(drained.status, 200);
    assert.deepEqual(await drained.json(), { enqueued_due: 0, claimed: 2, sent: 1, failed: 1, suppressed: 0 });
    assert.equal(store.notifications.get('notification-ok').state, 'sent');
    assert.equal(store.notifications.get('notification-fail').state, 'failed');
    assert.equal(store.notifications.get('notification-ok').provider_ref, 'matrix-message-1');

    const immediateRetry = await fetch(`${base}/api/internal/notifications/drain`, { method: 'POST', headers, body: '{}' });
    assert.equal(immediateRetry.status, 200);
    assert.deepEqual(await immediateRetry.json(), { enqueued_due: 0, claimed: 0, sent: 0, failed: 0, suppressed: 0 });
  });
});

test('third-Wednesday reminders enqueue only when due, deliver once to the student, and then become sent', async () => {
  const config = {
    ...localConfig,
    workerToken: 'worker-reminder-test',
    features: { ...localConfig.features, notifications: true },
  };
  const store = new PreviewStore();
  const studentId = '00000000-0000-4000-8000-000000000001';
  const submitted = await store.submitExamPlan({
    studentId, step: 's1', examOn: '2026-09-09', today: '2026-09-01', actorId: studentId, requestId: 'reminder-submit-0001',
  });
  await store.transitionExamPlan({
    planId: submitted.plan.id, toState: 'approved', result: null, note: null,
    today: '2026-09-01', actorId: 'admin-1', requestId: 'reminder-approve-0001',
  });
  const deliveries = [];
  const gateway = {
    assertConfigured() {},
    async send(notification) {
      deliveries.push(notification);
      return { providerRef: `matrix-reminder-${deliveries.length}` };
    },
  };
  let clock = new Date('2026-09-29T16:00:00Z');
  await withServer({ config, store, stripeGateway: new StripeGateway(), notificationGateway: gateway, now: () => clock }, async base => {
    const headers = { authorization: 'Bearer worker-reminder-test', 'content-type': 'application/json' };
    const beforeDue = await fetch(`${base}/api/internal/notifications/drain`, { method: 'POST', headers, body: '{}' });
    assert.deepEqual(await beforeDue.json(), { enqueued_due: 0, claimed: 0, sent: 0, failed: 0, suppressed: 0 });

    clock = new Date('2026-09-30T16:00:00Z');
    const due = await fetch(`${base}/api/internal/notifications/drain`, { method: 'POST', headers, body: '{}' });
    assert.deepEqual(await due.json(), { enqueued_due: 1, claimed: 1, sent: 1, failed: 0, suppressed: 0 });
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0].audience, 'student');
    assert.equal(deliveries[0].event_kind, 'exam_result_checkin');
    assert.equal([...store.reminders.values()][0].state, 'sent');

    const retry = await fetch(`${base}/api/internal/notifications/drain`, { method: 'POST', headers, body: '{}' });
    assert.deepEqual(await retry.json(), { enqueued_due: 0, claimed: 0, sent: 0, failed: 0, suppressed: 0 });
    assert.equal(deliveries.length, 1);
  });
});

test('a result recorded after reminder queueing cancels delivery before the provider is called', async () => {
  const config = {
    ...localConfig,
    workerToken: 'worker-cancelled-reminder-test',
    features: { ...localConfig.features, notifications: true },
  };
  const store = new PreviewStore();
  const studentId = '00000000-0000-4000-8000-000000000001';
  const submitted = await store.submitExamPlan({
    studentId, step: 's1', examOn: '2026-09-09', today: '2026-09-01', actorId: studentId, requestId: 'cancel-reminder-submit-0001',
  });
  await store.transitionExamPlan({
    planId: submitted.plan.id, toState: 'approved', result: null, note: null,
    today: '2026-09-01', actorId: 'admin-1', requestId: 'cancel-reminder-approve-0001',
  });
  await store.enqueueDueExamReminders({ today: '2026-09-30', now: '2026-09-30T15:59:00Z', limit: 10 });
  await store.transitionExamPlan({
    planId: submitted.plan.id, toState: 'passed', result: 'passed', note: 'Student reported passing',
    today: '2026-09-30', actorId: studentId, requestId: 'cancel-reminder-result-0001',
  });
  const gateway = {
    assertConfigured() {},
    async send() { assert.fail('cancelled reminder must not reach the notification provider'); },
  };
  await withServer({
    config, store, stripeGateway: new StripeGateway(), notificationGateway: gateway,
    now: () => new Date('2026-09-30T16:00:00Z'),
  }, async base => {
    const response = await fetch(`${base}/api/internal/notifications/drain`, {
      method: 'POST',
      headers: { authorization: 'Bearer worker-cancelled-reminder-test', 'content-type': 'application/json' },
      body: '{}',
    });
    assert.deepEqual(await response.json(), { enqueued_due: 0, claimed: 0, sent: 0, failed: 0, suppressed: 0 });
    assert.equal([...store.reminders.values()][0].state, 'cancelled');
    assert.equal([...store.notifications.values()][0].state, 'cancelled');
  });
});

test('a disabled notification transport cannot advance or enqueue a due reminder', async () => {
  const config = {
    ...localConfig,
    workerToken: 'worker-disabled-transport-test',
    features: { ...localConfig.features, notifications: true },
  };
  const store = new PreviewStore();
  const studentId = '00000000-0000-4000-8000-000000000001';
  const submitted = await store.submitExamPlan({
    studentId, step: 's1', examOn: '2026-09-09', today: '2026-09-01', actorId: studentId, requestId: 'disabled-reminder-submit-0001',
  });
  await store.transitionExamPlan({
    planId: submitted.plan.id, toState: 'approved', result: null, note: null,
    today: '2026-09-01', actorId: 'admin-1', requestId: 'disabled-reminder-approve-0001',
  });
  await withServer({
    config,
    store,
    stripeGateway: new StripeGateway(),
    now: () => new Date('2026-09-30T16:00:00Z'),
  }, async base => {
    const response = await fetch(`${base}/api/internal/notifications/drain`, {
      method: 'POST',
      headers: { authorization: 'Bearer worker-disabled-transport-test', 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(response.status, 503);
    assert.equal([...store.reminders.values()][0].state, 'scheduled');
    assert.equal(store.notifications.size, 0);
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

test('a replacement exam plan closes prior approved grace on the server local day', async () => {
  const enabledConfig = { ...localConfig, features: { ...localConfig.features, examPlans: true } };
  const store = new PreviewStore();
  const studentId = '00000000-0000-4000-8000-000000000001';
  const prior = await store.submitExamPlan({
    studentId,
    step: 's1',
    examOn: '2026-10-14',
    today: '2026-09-01',
    actorId: studentId,
    requestId: 'exam-replacement-seed-0001',
  });
  await store.transitionExamPlan({
    planId: prior.plan.id,
    toState: 'approved',
    result: null,
    note: null,
    today: '2026-09-01',
    actorId: 'admin-1',
    requestId: 'exam-replacement-approve-0001',
  });
  await withServer({
    config: enabledConfig,
    store,
    stripeGateway: new StripeGateway(),
    now: () => new Date('2026-09-20T16:00:00Z'),
  }, async base => {
    const headers = {
      'content-type': 'application/json',
      'x-missionaccounts-local-role': 'student',
      'idempotency-key': 'exam-replacement-request-0001',
    };
    const body = JSON.stringify({ step: 's1', exam_on: '2026-11-11' });
    const replacement = await fetch(`${base}/api/me/exam-plan`, { method: 'POST', headers, body });
    assert.equal(replacement.status, 201);
    const result = await replacement.json();
    assert.equal(result.closed_grace_windows, 1);
    assert.equal(result.attendance_recompute.today, '2026-09-20');
    assert.equal(result.plan.state, 'pending');

    const retry = await fetch(`${base}/api/me/exam-plan`, { method: 'POST', headers, body });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);
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

test('student Passed action resolves only the authenticated student current plan and closes grace idempotently', async () => {
  const enabledConfig = { ...localConfig, features: { ...localConfig.features, examPlans: true } };
  const store = new PreviewStore();
  const studentId = '00000000-0000-4000-8000-000000000001';
  const submitted = await store.submitExamPlan({
    studentId, step: 's1', examOn: '2026-09-09', actorId: studentId, requestId: 'student-passed-seed-0001',
  });
  await store.transitionExamPlan({
    planId: submitted.plan.id, toState: 'approved', result: null, note: null,
    today: '2026-09-01', actorId: 'admin-1', requestId: 'student-passed-approve-0001',
  });
  await withServer({
    config: enabledConfig,
    store,
    stripeGateway: new StripeGateway(),
    now: () => new Date('2026-09-15T16:00:00Z'),
  }, async base => {
    const headers = { 'content-type': 'application/json', 'x-missionaccounts-local-role': 'student', 'idempotency-key': 'student-passed-request-0001' };
    const passed = await fetch(`${base}/api/me/exam-plan/passed`, { method: 'POST', headers, body: '{}' });
    assert.equal(passed.status, 201);
    const result = await passed.json();
    assert.equal(result.plan.state, 'passed');
    assert.equal(result.plan.passed_on, '2026-09-15');
    assert.equal(result.effects.close_grace.closed_reason, 'passed');

    const retry = await fetch(`${base}/api/me/exam-plan/passed`, { method: 'POST', headers, body: '{}' });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);

    const otherStudent = await fetch(`${base}/api/me/exam-plan/passed`, {
      method: 'POST',
      headers: { ...headers, 'x-missionaccounts-local-user': '00000000-0000-4000-8000-000000000002', 'idempotency-key': 'student-passed-request-0002' },
      body: '{}',
    });
    assert.equal(otherStudent.status, 404);
  });
});

test('student exam-plan withdrawal closes grace, cancels reminders, preserves the plan, and is idempotent', async () => {
  const enabledConfig = { ...localConfig, features: { ...localConfig.features, examPlans: true } };
  const store = new PreviewStore();
  const studentId = '00000000-0000-4000-8000-000000000001';
  const submitted = await store.submitExamPlan({
    studentId, step: 's1', examOn: '2026-09-09', today: '2026-09-01',
    actorId: studentId, actorRole: 'student', requestId: 'withdraw-submit-0001',
  });
  await store.transitionExamPlan({
    planId: submitted.plan.id, toState: 'approved', result: null, note: null,
    today: '2026-09-01', actorId: 'admin-1', actorRole: 'missionaccounts_admin', requestId: 'withdraw-approve-0001',
  });
  await store.enqueueDueExamReminders({ today: '2026-09-30', now: '2026-09-30T15:59:00Z', limit: 10 });
  await withServer({
    config: enabledConfig,
    store,
    stripeGateway: new StripeGateway(),
    now: () => new Date('2026-09-30T16:00:00Z'),
  }, async base => {
    const headers = {
      'content-type': 'application/json',
      'x-missionaccounts-local-role': 'student',
      'idempotency-key': 'withdraw-request-0001',
    };
    const body = JSON.stringify({ plan_id: submitted.plan.id });
    const withdrawn = await fetch(`${base}/api/me/exam-plan/withdraw`, { method: 'POST', headers, body });
    assert.equal(withdrawn.status, 201);
    const result = await withdrawn.json();
    assert.equal(result.accepted, true);
    assert.equal(result.closed_grace_windows, 1);
    assert.equal(result.plan.id, submitted.plan.id);
    assert.ok(result.plan.withdrawn_at);
    assert.equal(await store.currentExamPlanForStudent(studentId), null);
    assert.equal([...store.reminders.values()][0].state, 'cancelled');
    assert.equal([...store.notifications.values()][0].state, 'cancelled');

    const retry = await fetch(`${base}/api/me/exam-plan/withdraw`, { method: 'POST', headers, body });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);

    const projection = await store.canonicalUiData({ scope: 'student', studentId });
    assert.equal(projection.exam_plans.length, 1);
    assert.ok(projection.exam_plans[0].withdrawn_at);
    assert.equal(projection.exam_transitions.at(-1).to_state, 'withdrawn');
  });
});

test('student billing consent requires approved terms plus an on-file method and is idempotent', async () => {
  const enabledConfig = { ...localConfig, features: { ...localConfig.features, autoBilling: true } };
  const store = new PreviewStore();
  const studentId = '00000000-0000-4000-8000-000000000001';
  const headers = {
    'content-type': 'application/json',
    'x-missionaccounts-local-role': 'student',
  };
  const body = JSON.stringify({ terms_version: 'test-terms-v1' });
  await withServer({ config: enabledConfig, store, stripeGateway: new StripeGateway() }, async base => {
    const noTerms = await fetch(`${base}/api/me/consent`, {
      method: 'POST', headers: { ...headers, 'idempotency-key': 'consent-request-0001' }, body,
    });
    assert.equal(noTerms.status, 409);
    assert.equal((await noTerms.json()).reason, 'approved_billing_terms_required');

    store.seedBillingTerms('test-terms-v1');
    const noMethod = await fetch(`${base}/api/me/consent`, {
      method: 'POST', headers: { ...headers, 'idempotency-key': 'consent-request-0002' }, body,
    });
    assert.equal(noMethod.status, 409);
    assert.equal((await noMethod.json()).reason, 'payment_method_required');

    store.seedPaymentMethod(studentId, { brand: 'visa', last4: '4242', status: 'on_file' });
    const authorizeHeaders = { ...headers, 'idempotency-key': 'consent-request-0003' };
    const authorized = await fetch(`${base}/api/me/consent`, { method: 'POST', headers: authorizeHeaders, body });
    assert.equal(authorized.status, 201);
    assert.equal((await authorized.json()).consent.state, 'authorized');

    const retry = await fetch(`${base}/api/me/consent`, { method: 'POST', headers: authorizeHeaders, body });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);

    const duplicateAuthorization = await fetch(`${base}/api/me/consent`, {
      method: 'POST', headers: { ...headers, 'idempotency-key': 'consent-request-0004' }, body,
    });
    assert.equal(duplicateAuthorization.status, 409);
    assert.equal((await duplicateAuthorization.json()).reason, 'authorization_already_active');

    const account = await fetch(`${base}/api/me`, { headers: { 'x-missionaccounts-local-role': 'student' } });
    assert.equal(account.status, 200);
    const accountPayload = await account.json();
    assert.equal(accountPayload.payment_method.last4, '4242');
    assert.equal(accountPayload.billing_terms.version, 'test-terms-v1');
    assert.equal(accountPayload.billing_consent.state, 'authorized');
    assert.equal(Object.hasOwn(accountPayload.payment_method, 'provider_pm_ref'), false);

    const revokeHeaders = { ...headers, 'idempotency-key': 'consent-request-0005' };
    const revoked = await fetch(`${base}/api/me/consent`, { method: 'DELETE', headers: revokeHeaders });
    assert.equal(revoked.status, 200);
    assert.equal((await revoked.json()).consent.state, 'revoked');

    const revokeRetry = await fetch(`${base}/api/me/consent`, { method: 'DELETE', headers: revokeHeaders });
    assert.equal(revokeRetry.status, 200);
    assert.equal((await revokeRetry.json()).duplicate, true);
  });
});

test('billing consent stays feature-off and administrator impersonation cannot accept it', async () => {
  const body = JSON.stringify({ terms_version: 'test-terms-v1' });
  await withServer({ config: localConfig, store: new PreviewStore(), stripeGateway: new StripeGateway() }, async base => {
    const featureOff = await fetch(`${base}/api/me/consent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-missionaccounts-local-role': 'student', 'idempotency-key': 'consent-request-0010' },
      body,
    });
    assert.equal(featureOff.status, 503);
  });

  const enabledConfig = { ...localConfig, features: { ...localConfig.features, autoBilling: true } };
  await withServer({ config: enabledConfig, store: new PreviewStore(), stripeGateway: new StripeGateway() }, async base => {
    const admin = await fetch(`${base}/api/me/consent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-missionaccounts-local-role': 'missionaccounts_admin', 'idempotency-key': 'consent-request-0011' },
      body,
    });
    assert.equal(admin.status, 403);
  });
});

test('a $25 day charge is server-authorized once and reaches succeeded only through its signed Stripe webhook', async () => {
  const enabledConfig = { ...localConfig, features: { ...localConfig.features, autoBilling: true } };
  const store = new PreviewStore();
  const studentId = '00000000-0000-4000-8000-000000000001';
  const attendanceDayId = '10000000-0000-4000-8000-000000000001';
  const cycleKey = '2026-cycle-1';
  store.seedAttendanceDays(studentId, cycleKey, [
    { id: attendanceDayId, day: '2026-09-08', kind: 'billable', event_ids: ['event-1'] },
  ]);
  await store.approveBillingDecision({
    studentId, cycleKey, treatment: 'confirm', requestedAmountCents: null,
    note: null, actorId: 'admin-1', requestId: 'charge-decision-0001',
  });
  await store.saveStripeCustomer({ studentId, customerId: 'cus_test_charge_student' });
  store.seedPaymentMethod(studentId, { brand: 'visa', last4: '4242', status: 'on_file' });
  store.seedBillingTerms('test-terms-v1');

  const secret = 'whsec_charge_test';
  const gateway = new StripeGateway({ webhookSecret: secret });
  const paymentIntentCalls = [];
  gateway.assertTestMode = () => {};
  gateway.createDayCharge = async args => {
    paymentIntentCalls.push(args);
    return { id: 'pi_test_day_charge_1' };
  };
  const path = `/api/admin/attendance-days/${attendanceDayId}/charge`;
  const adminHeaders = { 'content-type': 'application/json', 'x-missionaccounts-local-role': 'missionaccounts_admin' };
  await withServer({ config: enabledConfig, store, stripeGateway: gateway }, async base => {
    const noConsent = await fetch(`${base}${path}`, {
      method: 'POST', headers: { ...adminHeaders, 'idempotency-key': 'day-charge-request-0000' }, body: '{}',
    });
    assert.equal(noConsent.status, 409);
    assert.equal((await noConsent.json()).reason, 'billing_authorization_required');

    await store.setBillingConsent({
      studentId, action: 'authorize', termsVersion: 'test-terms-v1', acceptedIp: '127.0.0.1',
      reason: 'Student accepted test terms', actorId: studentId, requestId: 'charge-consent-0001',
    });
    store.previewStudentRecord.email = null;
    const missingReceiptEmail = await fetch(`${base}${path}`, {
      method: 'POST', headers: { ...adminHeaders, 'idempotency-key': 'day-charge-request-no-email' }, body: '{}',
    });
    assert.equal(missingReceiptEmail.status, 409);
    assert.equal((await missingReceiptEmail.json()).reason, 'student_receipt_email_required');
    assert.equal(paymentIntentCalls.length, 0);
    store.previewStudentRecord.email = 'Verified.Student@Example.org';
    const chargeHeaders = { ...adminHeaders, 'idempotency-key': 'day-charge-request-0001' };
    const prepared = await fetch(`${base}${path}`, { method: 'POST', headers: chargeHeaders, body: '{}' });
    assert.equal(prepared.status, 202);
    const preparedPayload = await prepared.json();
    assert.equal(preparedPayload.charge.amount_cents, 2_500);
    assert.equal(preparedPayload.state, 'pending_webhook');

    const retry = await fetch(`${base}${path}`, { method: 'POST', headers: chargeHeaders, body: '{}' });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);
    assert.equal(paymentIntentCalls.length, 2);
    assert.equal(paymentIntentCalls[0].attendanceDayId, attendanceDayId);
    assert.equal(paymentIntentCalls[0].receiptEmail, 'verified.student@example.org');

    const parallel = await fetch(`${base}${path}`, {
      method: 'POST', headers: { ...adminHeaders, 'idempotency-key': 'day-charge-request-0002' }, body: '{}',
    });
    assert.equal(parallel.status, 409);
    assert.equal((await parallel.json()).reason, 'charge_already_pending');

    const event = {
      id: 'evt_charge_success_1',
      type: 'payment_intent.succeeded',
      data: { object: {
        id: 'pi_test_day_charge_1',
        metadata: { student_id: studentId, attendance_day_id: attendanceDayId },
      } },
    };
    const eventBody = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000);
    const webhookHeaders = { 'content-type': 'application/json', 'stripe-signature': stripeSignature(eventBody, secret, timestamp) };
    const webhook = await fetch(`${base}/api/webhooks/stripe`, { method: 'POST', headers: webhookHeaders, body: eventBody });
    assert.equal(webhook.status, 200);
    assert.equal((await webhook.json()).duplicate, false);
    assert.equal(store.chargesByDay.get(attendanceDayId).state, 'succeeded');

    const webhookRetry = await fetch(`${base}/api/webhooks/stripe`, { method: 'POST', headers: webhookHeaders, body: eventBody });
    assert.equal(webhookRetry.status, 200);
    assert.equal((await webhookRetry.json()).duplicate, true);

    const afterSuccess = await fetch(`${base}${path}`, {
      method: 'POST', headers: { ...adminHeaders, 'idempotency-key': 'day-charge-request-0003' }, body: '{}',
    });
    assert.equal(afterSuccess.status, 409);
    assert.equal((await afterSuccess.json()).reason, 'charge_already_succeeded');
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

test('Dr J can enter or replace an exam plan and preserve a suggested replacement date', async () => {
  const enabledConfig = { ...localConfig, features: { ...localConfig.features, examPlans: true } };
  const store = new PreviewStore();
  const studentId = '00000000-0000-4000-8000-000000000001';
  const path = `/api/admin/students/${studentId}/exam-plan`;
  const body = JSON.stringify({ step: 's3', exam_on: '2026-11-18' });
  const adminHeaders = { 'content-type': 'application/json', 'x-missionaccounts-local-role': 'missionaccounts_admin' };
  await withServer({ config: enabledConfig, store, stripeGateway: new StripeGateway() }, async base => {
    const forbidden = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { ...adminHeaders, 'x-missionaccounts-local-role': 'student', 'idempotency-key': 'admin-exam-submit-0001' },
      body,
    });
    assert.equal(forbidden.status, 403);

    const created = await fetch(`${base}${path}`, {
      method: 'POST', headers: { ...adminHeaders, 'idempotency-key': 'admin-exam-submit-0001' }, body,
    });
    assert.equal(created.status, 201);
    const createdPayload = await created.json();
    assert.equal(createdPayload.plan.step, 's3');
    assert.equal(createdPayload.plan.submitted_by, studentId);

    const retry = await fetch(`${base}${path}`, {
      method: 'POST', headers: { ...adminHeaders, 'idempotency-key': 'admin-exam-submit-0001' }, body,
    });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);

    const denied = await fetch(`${base}/api/admin/exam-plans/${createdPayload.plan.id}/deny`, {
      method: 'POST',
      headers: { ...adminHeaders, 'idempotency-key': 'admin-exam-deny-0001' },
      body: JSON.stringify({ note: 'Please choose the later sitting', suggested_on: '2026-12-02' }),
    });
    assert.equal(denied.status, 200);
    assert.equal((await denied.json()).plan.suggested_on, '2026-12-02');

    const invalidSuggestion = await fetch(`${base}/api/admin/exam-plans/${createdPayload.plan.id}/approve`, {
      method: 'POST',
      headers: { ...adminHeaders, 'idempotency-key': 'admin-exam-approve-0001' },
      body: JSON.stringify({ suggested_on: '2026-12-09' }),
    });
    assert.equal(invalidSuggestion.status, 400);
  });
});

test('billing approval derives totals on the server and deduplicates retries', async () => {
  const enabledConfig = { ...localConfig, features: { ...localConfig.features, billingDecisions: true } };
  const store = new PreviewStore();
  const studentId = '00000000-0000-4000-8000-000000000001';
  const cycleKey = '2026-cycle-1';
  store.seedAttendanceDays(studentId, cycleKey, [
    { id: 'day-1', day: '2026-06-08', kind: 'billable', event_ids: ['event-1', 'event-2'] },
    { id: 'day-2', day: '2026-06-09', kind: 'billable', event_ids: ['event-3'] },
  ]);
  const path = `/api/admin/students/${studentId}/decisions`;
  const headers = { 'content-type': 'application/json', 'x-missionaccounts-local-role': 'missionaccounts_admin', 'idempotency-key': 'billing-request-0001' };
  const body = JSON.stringify({ cycle_key: cycleKey, treatment: 'confirm', requested_amount_cents: 999_999 });
  await withServer({ config: enabledConfig, store, stripeGateway: new StripeGateway() }, async base => {
    const created = await fetch(`${base}${path}`, { method: 'POST', headers, body });
    assert.equal(created.status, 201);
    const payload = await created.json();
    assert.equal(payload.decision.amount_cents, 5_000);
    assert.equal(payload.invoice.amount_cents, 5_000);
    assert.equal(payload.decision.basis.att, 3);

    const retry = await fetch(`${base}${path}`, { method: 'POST', headers, body });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);

    const unauthorized = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { ...headers, 'x-missionaccounts-local-role': 'student', 'idempotency-key': 'billing-request-0002' },
      body,
    });
    assert.equal(unauthorized.status, 403);
  });
});

test('cycle 13–15-day policy is audited, idempotent, and changes derived approvals', async () => {
  const enabledConfig = { ...localConfig, features: { ...localConfig.features, billingDecisions: true } };
  const store = new PreviewStore();
  const studentId = '00000000-0000-4000-8000-000000000001';
  const cycleKey = '2026-cycle-1';
  store.seedAttendanceDays(studentId, cycleKey, Array.from({ length: 13 }, (_, index) => ({
    id: `policy-day-${index + 1}`,
    day: `2026-06-${String(index + 8).padStart(2, '0')}`,
    kind: 'billable',
    event_ids: [`policy-event-${index + 1}`],
  })));
  const decisionPath = `/api/admin/students/${studentId}/decisions`;
  const policyPath = `/api/admin/policy/${cycleKey}`;
  const adminHeaders = { 'content-type': 'application/json', 'x-missionaccounts-local-role': 'missionaccounts_admin' };
  await withServer({ config: enabledConfig, store, stripeGateway: new StripeGateway() }, async base => {
    const unresolved = await fetch(`${base}${decisionPath}`, {
      method: 'POST',
      headers: { ...adminHeaders, 'idempotency-key': 'cycle-policy-billing-0001' },
      body: JSON.stringify({ cycle_key: cycleKey, treatment: 'confirm' }),
    });
    assert.equal(unresolved.status, 409);
    assert.equal((await unresolved.json()).reason, 'cycle_cap_policy_requires_review');

    const forbidden = await fetch(`${base}${policyPath}`, {
      method: 'POST',
      headers: { ...adminHeaders, 'x-missionaccounts-local-role': 'student', 'idempotency-key': 'cycle-policy-0001' },
      body: JSON.stringify({ decision: 'cap', reason: 'Founder-approved cycle treatment' }),
    });
    assert.equal(forbidden.status, 403);

    const cap = await fetch(`${base}${policyPath}`, {
      method: 'POST',
      headers: { ...adminHeaders, 'idempotency-key': 'cycle-policy-0001' },
      body: JSON.stringify({ decision: 'cap', reason: 'Founder-approved cycle treatment' }),
    });
    assert.equal(cap.status, 201);
    const capPayload = await cap.json();
    assert.equal(capPayload.policy.value.decision, 'cap');
    assert.equal(capPayload.projection.policies[0].value.decision, 'cap');

    const capRetry = await fetch(`${base}${policyPath}`, {
      method: 'POST',
      headers: { ...adminHeaders, 'idempotency-key': 'cycle-policy-0001' },
      body: JSON.stringify({ decision: 'cap', reason: 'Founder-approved cycle treatment' }),
    });
    assert.equal(capRetry.status, 200);
    assert.equal((await capRetry.json()).duplicate, true);

    const cappedApproval = await fetch(`${base}${decisionPath}`, {
      method: 'POST',
      headers: { ...adminHeaders, 'idempotency-key': 'cycle-policy-billing-0002' },
      body: JSON.stringify({ cycle_key: cycleKey, treatment: 'confirm' }),
    });
    assert.equal(cappedApproval.status, 201);
    assert.equal((await cappedApproval.json()).decision.amount_cents, 30_000);

    const perDay = await fetch(`${base}${policyPath}`, {
      method: 'POST',
      headers: { ...adminHeaders, 'idempotency-key': 'cycle-policy-0002' },
      body: JSON.stringify({ decision: 'per', reason: 'Keep the written per-day amount' }),
    });
    assert.equal(perDay.status, 201);
    const perDayPayload = await perDay.json();
    assert.equal(perDayPayload.stale_decisions, 1);
    assert.equal(perDayPayload.projection.billing_decisions[0].state, 'stale');

    const perDayApproval = await fetch(`${base}${decisionPath}`, {
      method: 'POST',
      headers: { ...adminHeaders, 'idempotency-key': 'cycle-policy-billing-0003' },
      body: JSON.stringify({ cycle_key: cycleKey, treatment: 'confirm' }),
    });
    assert.equal(perDayApproval.status, 201);
    assert.equal((await perDayApproval.json()).decision.amount_cents, 32_500);
  });
});

test('unverified historical cap candidate blocks approval until verified', async () => {
  const enabledConfig = { ...localConfig, features: { ...localConfig.features, billingDecisions: true } };
  const store = new PreviewStore();
  const studentId = '00000000-0000-4000-8000-000000000001';
  const cycleKey = '2026-cycle-1';
  store.seedAttendanceDays(studentId, cycleKey, Array.from({ length: 15 }, (_, index) => ({
    id: `day-${index + 1}`,
    day: `2026-06-${String(index + 8).padStart(2, '0')}`,
    kind: 'billable',
    event_ids: [`event-${index + 1}`],
  })));
  await store.setCyclePolicy({
    cycleKey,
    decision: 'per',
    reason: 'Exercise the individual historical cap gate',
    actorId: 'admin-1',
    requestId: 'billing-cap-policy-seed-0001',
  });
  store.seedBillingCap(studentId, cycleKey, { id: 'cap-1', status: 'candidate', verified: false, ceiling_cents: 30_000 });
  const path = `/api/admin/students/${studentId}/decisions`;
  const ceilingPath = `/api/admin/students/${studentId}/full-cycle-ceilings/${cycleKey}`;
  const headers = { 'content-type': 'application/json', 'x-missionaccounts-local-role': 'missionaccounts_admin' };
  const body = JSON.stringify({ cycle_key: cycleKey, treatment: 'confirm' });
  await withServer({ config: enabledConfig, store, stripeGateway: new StripeGateway() }, async base => {
    const blocked = await fetch(`${base}${path}`, { method: 'POST', headers: { ...headers, 'idempotency-key': 'billing-cap-0001' }, body });
    assert.equal(blocked.status, 409);
    assert.equal((await blocked.json()).reason, 'cap_candidate_requires_review');

    const ceilingBody = JSON.stringify({ status: 'verified', reason: 'Verified historical full-cycle enrollment evidence' });
    const denied = await fetch(`${base}${ceilingPath}`, {
      method: 'POST',
      headers: { ...headers, 'x-missionaccounts-local-role': 'student', 'idempotency-key': 'billing-cap-decision-0000' },
      body: ceilingBody,
    });
    assert.equal(denied.status, 403);

    const verified = await fetch(`${base}${ceilingPath}`, {
      method: 'POST', headers: { ...headers, 'idempotency-key': 'billing-cap-decision-0001' }, body: ceilingBody,
    });
    assert.equal(verified.status, 201);
    const verifiedPayload = await verified.json();
    assert.equal(verifiedPayload.ceiling.status, 'verified');
    assert.equal(verifiedPayload.ceiling.ceiling_cents, 30_000);

    const verifiedRetry = await fetch(`${base}${ceilingPath}`, {
      method: 'POST', headers: { ...headers, 'idempotency-key': 'billing-cap-decision-0001' }, body: ceilingBody,
    });
    assert.equal(verifiedRetry.status, 200);
    assert.equal((await verifiedRetry.json()).duplicate, true);

    const approved = await fetch(`${base}${path}`, { method: 'POST', headers: { ...headers, 'idempotency-key': 'billing-cap-0002' }, body });
    assert.equal(approved.status, 201);
    assert.equal((await approved.json()).decision.amount_cents, 30_000);
  });
});

test('admin attendance correction is append-only, idempotent, and stales an approval', async () => {
  const enabledConfig = { ...localConfig, features: { ...localConfig.features, attendanceCorrections: true } };
  const store = new PreviewStore();
  const studentId = '00000000-0000-4000-8000-000000000001';
  const sessionId = '20000000-0000-4000-9000-000000000001';
  const eventId = '30000000-0000-4000-9000-000000000001';
  store.seedAttendanceEvent({ id: eventId, student_id: studentId, session_id: sessionId });
  store.billingDecisions.set(`${studentId}:2026-cycle-1`, { id: 'decision-1', state: 'approved' });
  const path = `/api/admin/students/${studentId}/corrections`;
  const headers = { 'content-type': 'application/json', 'x-missionaccounts-local-role': 'missionaccounts_admin', 'idempotency-key': 'correction-request-0001' };
  const body = JSON.stringify({ type: 'remove', session_id: sessionId, attendance_event_id: eventId, reason: 'Verified Zoom evidence shows absence' });
  await withServer({ config: enabledConfig, store, stripeGateway: new StripeGateway() }, async base => {
    const created = await fetch(`${base}${path}`, { method: 'POST', headers, body });
    assert.equal(created.status, 201);
    const payload = await created.json();
    assert.equal(payload.stale_decisions, 1);
    assert.equal(payload.correction.attendance_event_id, eventId);

    const retry = await fetch(`${base}${path}`, { method: 'POST', headers, body });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);

    const unauthorized = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { ...headers, 'x-missionaccounts-local-role': 'student', 'idempotency-key': 'correction-request-0002' },
      body,
    });
    assert.equal(unauthorized.status, 403);
  });
});

test('contact custody and invoice readiness are feature-gated, audited, idempotent, and email-safe', async () => {
  const enabledConfig = {
    ...localConfig,
    features: { ...localConfig.features, studentContacts: true, billingDecisions: true },
  };
  const store = new PreviewStore();
  const studentId = '00000000-0000-4000-8000-000000000001';
  const cycleKey = '2026-cycle-1';
  store.seedAttendanceDays(studentId, cycleKey, [
    { id: 'ready-day-1', day: '2026-06-08', kind: 'billable', event_ids: ['ready-event-1'] },
  ]);
  const adminHeaders = { 'content-type': 'application/json', 'x-missionaccounts-local-role': 'missionaccounts_admin' };
  await withServer({ config: enabledConfig, store, stripeGateway: new StripeGateway() }, async base => {
    const approvedResponse = await fetch(`${base}/api/admin/students/${studentId}/decisions`, {
      method: 'POST',
      headers: { ...adminHeaders, 'idempotency-key': 'ready-billing-0001' },
      body: JSON.stringify({ cycle_key: cycleKey, treatment: 'confirm' }),
    });
    assert.equal(approvedResponse.status, 201);
    const approved = await approvedResponse.json();
    const invoiceId = approved.invoice.id;

    const clearContact = await fetch(`${base}/api/admin/students/${studentId}/contact`, {
      method: 'POST',
      headers: { ...adminHeaders, 'idempotency-key': 'contact-change-0001' },
      body: JSON.stringify({ email: '', phone: '', reason: 'Email requires verification' }),
    });
    assert.equal(clearContact.status, 201);
    assert.equal((await clearContact.json()).student.email, null);

    const blockedReady = await fetch(`${base}/api/admin/invoices/${invoiceId}/readiness`, {
      method: 'POST',
      headers: { ...adminHeaders, 'idempotency-key': 'invoice-ready-0001' },
      body: JSON.stringify({ ready: true }),
    });
    assert.equal(blockedReady.status, 409);
    assert.equal((await blockedReady.json()).reason, 'student_email_required');

    const contactHeaders = { ...adminHeaders, 'idempotency-key': 'contact-change-0002' };
    const contactBody = JSON.stringify({ email: 'Verified.Student@Example.org', phone: '555-0102', reason: 'Confirmed with student' });
    const savedContact = await fetch(`${base}/api/admin/students/${studentId}/contact`, { method: 'POST', headers: contactHeaders, body: contactBody });
    assert.equal(savedContact.status, 201);
    assert.equal((await savedContact.json()).student.email, 'verified.student@example.org');
    const contactRetry = await fetch(`${base}/api/admin/students/${studentId}/contact`, { method: 'POST', headers: contactHeaders, body: contactBody });
    assert.equal(contactRetry.status, 200);
    assert.equal((await contactRetry.json()).duplicate, true);

    const readyHeaders = { ...adminHeaders, 'idempotency-key': 'invoice-ready-0002' };
    const readyBody = JSON.stringify({ ready: true, reason: 'Amount and email confirmed' });
    const ready = await fetch(`${base}/api/admin/invoices/${invoiceId}/readiness`, { method: 'POST', headers: readyHeaders, body: readyBody });
    assert.equal(ready.status, 201);
    assert.equal((await ready.json()).invoice.state, 'ready');
    const readyRetry = await fetch(`${base}/api/admin/invoices/${invoiceId}/readiness`, { method: 'POST', headers: readyHeaders, body: readyBody });
    assert.equal(readyRetry.status, 200);
    assert.equal((await readyRetry.json()).duplicate, true);

    const demoted = await fetch(`${base}/api/admin/students/${studentId}/contact`, {
      method: 'POST',
      headers: { ...adminHeaders, 'idempotency-key': 'contact-change-0003' },
      body: JSON.stringify({ email: '', phone: '555-0102', reason: 'Student withdrew this email address' }),
    });
    assert.equal(demoted.status, 201);
    assert.equal((await demoted.json()).demoted_ready_invoices, 1);
    assert.equal(store.invoices.get(invoiceId).state, 'draft');

    const studentDenied = await fetch(`${base}/api/admin/students/${studentId}/contact`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-missionaccounts-local-role': 'student', 'idempotency-key': 'contact-change-0004' },
      body: contactBody,
    });
    assert.equal(studentDenied.status, 403);
  });

  await withServer({ config: localConfig, store: new PreviewStore(), stripeGateway: new StripeGateway() }, async base => {
    const disabled = await fetch(`${base}/api/admin/students/${studentId}/contact`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-missionaccounts-local-role': 'missionaccounts_admin', 'idempotency-key': 'contact-disabled-0001' },
      body: JSON.stringify({ email: 'student@example.org' }),
    });
    assert.equal(disabled.status, 503);
  });
});

test('hosted invoice send is provider-backed, idempotent, and paid only by a signed Stripe event', async () => {
  const config = {
    ...localConfig,
    invoiceDueDays: 30,
    features: { ...localConfig.features, billingDecisions: true, hostedInvoices: true },
  };
  const store = new PreviewStore();
  const studentId = store.previewStudentRecord.id;
  const cycleKey = '2026-cycle-1';
  store.seedAttendanceDays(studentId, cycleKey, [
    { id: 'hosted-day-1', day: '2026-06-08', kind: 'billable', event_ids: ['hosted-event-1'] },
  ]);
  const approved = await store.approveBillingDecision({
    studentId, cycleKey, treatment: 'confirm', requestedAmountCents: null, note: null,
    actorId: 'admin-1', actorRole: 'missionaccounts_admin', requestId: 'hosted-billing-0001',
  });
  await store.setInvoiceReadiness({
    invoiceId: approved.invoice.id, ready: true, reason: 'Amount and email confirmed',
    actorId: 'admin-1', actorRole: 'missionaccounts_admin', requestId: 'hosted-ready-0001',
  });
  await store.saveStripeCustomer({ studentId, customerId: 'cus_test_hosted_1' });
  const secret = 'whsec_hosted_invoice_test';
  const gateway = new StripeGateway({ webhookSecret: secret });
  let providerCalls = 0;
  gateway.assertMutationAllowed = () => {};
  gateway.createHostedInvoice = async args => {
    providerCalls += 1;
    assert.equal(args.amountCents, 2500);
    assert.equal(args.dueDays, 30);
    assert.equal(args.customerId, 'cus_test_hosted_1');
    return {
      id: 'in_test_hosted_1', status: 'open',
      hosted_invoice_url: 'https://invoice.stripe.com/i/test-hosted-1',
      invoice_pdf: 'https://pay.stripe.com/invoice/test/pdf',
      due_date: 1_800_000_000,
    };
  };
  const headers = {
    'content-type': 'application/json', 'x-missionaccounts-local-role': 'missionaccounts_admin',
    'idempotency-key': 'hosted-send-0001',
  };
  await withServer({ config, store, stripeGateway: gateway }, async base => {
    const first = await fetch(`${base}/api/admin/invoices/${approved.invoice.id}/provider`, {
      method: 'POST', headers, body: JSON.stringify({ action: 'send' }),
    });
    assert.equal(first.status, 201);
    const sent = await first.json();
    assert.equal(sent.invoice.state, 'sent');
    assert.equal(sent.invoice.provider_ref, 'in_test_hosted_1');
    assert.equal(sent.invoice.hosted_invoice_url, 'https://invoice.stripe.com/i/test-hosted-1');
    assert.equal(providerCalls, 1);

    const retry = await fetch(`${base}/api/admin/invoices/${approved.invoice.id}/provider`, {
      method: 'POST', headers, body: JSON.stringify({ action: 'send' }),
    });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);
    assert.equal(providerCalls, 1);

    const event = {
      id: 'evt_hosted_invoice_paid_1', type: 'invoice.paid',
      data: { object: {
        id: 'in_test_hosted_1', status: 'paid', amount_due: 2500, amount_paid: 2500,
        hosted_invoice_url: 'https://invoice.stripe.com/i/test-hosted-1',
        invoice_pdf: 'https://pay.stripe.com/invoice/test/pdf', due_date: 1_800_000_000,
        metadata: { missionaccounts_invoice_id: approved.invoice.id },
      } },
    };
    const raw = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000);
    const paid = await fetch(`${base}/api/webhooks/stripe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': stripeSignature(raw, secret, timestamp) },
      body: raw,
    });
    assert.equal(paid.status, 200);
    assert.equal(store.invoices.get(approved.invoice.id).state, 'paid');
  });
});
