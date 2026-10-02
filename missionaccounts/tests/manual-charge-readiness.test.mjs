import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { buildManualChargeReadiness } from '../src/domain/manual-charge-readiness.mjs';
import { createMissionAccountsServer } from '../src/server.mjs';
import { PreviewStore } from '../src/storage/supabase-rest.mjs';
import { StripeGateway } from '../src/payments/stripe.mjs';

const id = '00000000-0000-4000-8000-000000000001';
const decision = { id: 'decision-1', student_id: id, cycle_key: '2026-cycle-1', treatment: 'per_day',
  amount_cents: 2500, state: 'approved', superseded_by_id: null };
const student = { id, display_name: 'Student A', email: 'student@example.test', identity_state: 'verified',
  matrix_user_ref: '00000000-0000-4000-8000-000000000002', sponsor_type: 'DIRECT' };
const profile = { student_id: id, school_name: 'School', best_contact_method: 'email', mailing_line1: 'Street',
  mailing_city: 'City', mailing_region: 'State', mailing_postal_code: '12345', mailing_country_code: 'US' };
const invoice = { id: 'invoice-1', student_id: id, cycle_key: decision.cycle_key, decision_id: decision.id,
  amount_cents: 2500, state: 'draft', provider_ref: null, created_at: '2026-09-01T00:00:00Z' };
const customer = { student_id: id, provider_customer_ref: 'cus_private' };
const method = { student_id: id, status: 'on_file', provider_customer_ref: 'cus_private',
  provider_pm_ref: 'pm_private', brand: 'Visa', last4: '4242' };
const base = () => ({ decisions: [{ ...decision }], students: [{ ...student }],
  identities: [{ id, canonical_student_id: id, absorbed: false, excluded: false }], profiles: [{ ...profile }],
  invoices: [{ ...invoice }], customers: [{ ...customer }], methods: [{ ...method }], charges: [] });

test('only an exact current approved and collectible balance is marked ready, with private refs removed', () => {
  const result = buildManualChargeReadiness(base());
  assert.equal(result.summary.ready_count, 1);
  assert.equal(result.summary.ready_amount_cents, 2500);
  assert.equal(result.rows[0].profile_status, 'COMPLETE');
  assert.deepEqual(result.rows[0].payment_method, { status: 'ON_FILE', brand: 'Visa', last4: '4242' });
  assert.doesNotMatch(JSON.stringify(result), /cus_private|pm_private|student@example/);
});

test('server-charge blockers prevent a ready presentation, while profile status remains separate', () => {
  const changes = [
    input => { input.students[0].matrix_user_ref = null; },
    input => { input.identities[0].absorbed = true; },
    input => { input.students[0].sponsor_type = 'UCC'; },
    input => { input.invoices[0].amount_cents = 3000; },
    input => { input.invoices[0].provider_ref = 'in_sent'; },
    input => { input.methods[0].provider_customer_ref = 'cus_wrong'; },
    input => { input.students[0].email = ''; },
    input => { input.charges.push({ student_id: id, cycle_key: decision.cycle_key, state: 'pending' }); },
    input => { input.charges.push({ student_id: id, cycle_key: decision.cycle_key, state: 'succeeded' }); },
  ];
  for (const change of changes) {
    const input = base(); change(input);
    assert.equal(buildManualChargeReadiness(input).summary.ready_count, 0);
  }
  const input = base(); input.profiles = [];
  const result = buildManualChargeReadiness(input);
  assert.equal(result.rows[0].profile_status, 'NOT_STARTED');
  assert.equal(result.rows[0].status, 'READY');
});

test('processing and collected balances are never offered for a second charge', () => {
  const input = base();
  input.charges = [{ student_id: id, cycle_key: decision.cycle_key, state: 'pending' },
    { student_id: id, cycle_key: decision.cycle_key, state: 'succeeded' }];
  const result = buildManualChargeReadiness(input);
  assert.equal(result.rows[0].status, 'COLLECTED');
  assert.equal(result.summary.collected_count, 1);
});

test('charge-readiness bootstrap stays admin-only and feature-gated', async () => {
  const store = new PreviewStore();
  let calls = 0;
  store.adminChargeReadiness = async () => {
    calls += 1;
    return { summary: { ready_count: 0, ready_amount_cents: 0 }, rows: [] };
  };
  const config = {
    production: false, routeEnabled: false, localAuth: true,
    issuer: 'https://issuer.invalid', audience: 'missionaccounts',
    jwksUrl: 'https://issuer.invalid/jwks', stripeAccountId: '', workerToken: '',
    features: { manualCharges: true, onboarding: false, commerce: false },
  };
  const server = createMissionAccountsServer({ config, store, stripeGateway: new StripeGateway() });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const student = await fetch(`${base}/api/ui/bootstrap`,
      { headers: { 'x-missionaccounts-local-role': 'student' } });
    assert.equal(student.status, 200);
    assert.equal(Object.hasOwn(await student.json(), 'charge_readiness'), false);
    assert.equal(calls, 0);
    const admin = await fetch(`${base}/api/ui/bootstrap`,
      { headers: { 'x-missionaccounts-local-role': 'missionaccounts_admin' } });
    assert.equal(admin.status, 200);
    assert.deepEqual((await admin.json()).charge_readiness.rows, []);
    assert.equal(calls, 1);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
