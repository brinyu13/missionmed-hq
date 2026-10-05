import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createMissionAccountsServer } from '../src/server.mjs';
import { PreviewStore } from '../src/storage/supabase-rest.mjs';
import { StripeGateway } from '../src/payments/stripe.mjs';
import {
  EXAMPREP_CONTRACT_SHA256,
  EXAMPREP_CONTRACT_VERSION,
  EXAMPREP_OFFERS,
  commercePlanState,
} from '../src/domain/business-contract.mjs';

const studentId = '00000000-0000-4000-8000-000000000001';
const studentHeaders = {
  'content-type': 'application/json',
  'x-missionaccounts-local-role': 'student',
  'x-missionaccounts-local-user': studentId,
  'x-missionaccounts-local-programs': 'examprep',
};
const features = {
  studentContacts: false, billingDecisions: false, attendanceCorrections: false,
  identityReview: false, examPlans: false, compDays: false, paymentMethodSetup: false,
  manualCharges: false, autoBilling: false, autoBillingConsent: false,
  autoBillingShadow: false, hostedInvoices: false, notifications: false, zoomSync: false,
  zoomShadow: false, zoomEffectiveWrites: false, billableDayCalculation: false,
  onboarding: true, legacyInvoices: false, commerce: true, onboardingLaunch: true,
};
const config = {
  production: false, routeEnabled: false, localAuth: true,
  issuer: 'https://issuer.invalid', audience: 'missionaccounts', jwksUrl: 'https://issuer.invalid/jwks',
  features, stripeAccountId: '', workerToken: '',
};

async function withServer(options, run) {
  const server = createMissionAccountsServer(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

test('registered contract prices and attended-day trial mechanics are exact', () => {
  assert.equal(EXAMPREP_CONTRACT_VERSION, 'examprep-business-contract-2026-09-16-v1');
  assert.equal(EXAMPREP_CONTRACT_SHA256, 'd57b8d8486f0be0741132d474130dcdbe4e8d600138081a1b4e62e88005d503d');
  assert.equal(EXAMPREP_OFFERS.tutoring_hourly.amount_cents, 8500);
  assert.equal(EXAMPREP_OFFERS.live_group_monthly.amount_cents, 30000);
  assert.equal(EXAMPREP_OFFERS.live_group_pay_go.amount_cents, 2500);
  const state = commercePlanState({ attendedDays: ['2026-09-01','2026-09-01','2026-09-03','2026-09-04','2026-09-08','2026-09-09'] });
  assert.equal(state.attended_trial_days, 5);
  assert.equal(state.trial_days_remaining, 0);
  assert.equal(state.plan_required, true);
  assert.equal(state.state, 'PLAN_REQUIRED');
  const existing = commercePlanState({ attendedDays: [], existingPlan: 'monthly', liveGroupEligible: true });
  assert.equal(existing.selected_plan, 'monthly');
  assert.equal(existing.selection_source, 'existing_active_arrangement');
  assert.equal(existing.plan_required, false);
  const ineligible = commercePlanState({ attendedDays: ['2026-09-01'], liveGroupEligible: false });
  assert.equal(ineligible.state, 'NOT_ELIGIBLE');
  assert.equal(ineligible.attended_trial_days, 0);
});

test('trial plan selection is explicit, idempotent, subject-bound and zero-money', async () => {
  const store = new PreviewStore();
  store.attendanceDays.set(`${studentId}:2026-cycle-3`, [
    { day: '2026-09-01', kind: 'billable' },
    { day: '2026-09-02', kind: 'billable' },
    { day: '2026-09-03', kind: 'billable' },
    { day: '2026-09-04', kind: 'billable' },
    { day: '2026-09-05', kind: 'billable' },
  ]);
  const before = {
    charges: store.chargesByDay.size, dispatches: store.autoChargeDispatches.size,
    invoices: store.invoices.size, notifications: store.notifications.size,
  };
  await withServer({ config, store, stripeGateway: new StripeGateway() }, async base => {
    const initial = await fetch(`${base}/api/me/commerce`, { headers: studentHeaders });
    assert.equal(initial.status, 200);
    assert.equal((await initial.json()).commerce.plan_required, true);
    const headers = { ...studentHeaders, 'idempotency-key': 'commerce-plan-0001' };
    const body = JSON.stringify({ plan: 'pay_go' });
    const selected = await fetch(`${base}/api/me/commerce/plan`, { method: 'POST', headers, body });
    assert.equal(selected.status, 201);
    const receipt = await selected.json();
    assert.equal(receipt.commerce.selected_plan, 'pay_go');
    assert.deepEqual(receipt.next_action, {
      type: 'review_billing_authorization',
      route: '#/me/billing',
      label: 'Review billing authorization',
    });
    assert.equal(receipt.provider_action, null);
    assert.equal(receipt.money_moved_cents, 0);
    const replay = await fetch(`${base}/api/me/commerce/plan`, { method: 'POST', headers, body });
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).duplicate, true);
    const wrong = await fetch(`${base}/api/me/commerce`, { headers: { ...studentHeaders, 'x-missionaccounts-local-user': '00000000-0000-4000-8000-000000000002' } });
    assert.equal(wrong.status, 404);
  });
  assert.deepEqual({
    charges: store.chargesByDay.size, dispatches: store.autoChargeDispatches.size,
    invoices: store.invoices.size, notifications: store.notifications.size,
  }, before);
});

test('monthly choice returns only the signed same-origin checkout handoff', async () => {
  const store = new PreviewStore();
  store.attendanceDays.set(`${studentId}:2026-cycle-3`, [
    { day: '2026-09-01', kind: 'billable' },
    { day: '2026-09-02', kind: 'billable' },
    { day: '2026-09-03', kind: 'billable' },
    { day: '2026-09-04', kind: 'billable' },
    { day: '2026-09-05', kind: 'billable' },
  ]);
  await withServer({ config, store, stripeGateway: new StripeGateway() }, async base => {
    const response = await fetch(`${base}/api/me/commerce/plan`, {
      method: 'POST',
      headers: { ...studentHeaders, 'idempotency-key': 'commerce-plan-monthly-0001' },
      body: JSON.stringify({ plan: 'monthly' }),
    });
    assert.equal(response.status, 201);
    const receipt = await response.json();
    assert.deepEqual(receipt.next_action, {
      type: 'woocommerce_checkout',
      url: 'https://missionmedinstitute.com/checkout/?add-to-cart=3651',
      label: 'Continue to secure checkout',
    });
    assert.equal(receipt.provider_action, null);
    assert.equal(receipt.money_moved_cents, 0);
  });
  assert.equal(store.autoChargeDispatches.size, 0);
  assert.equal(store.chargesByDay.size, 0);
  assert.equal(store.invoices.size, 0);
  assert.equal(store.notifications.size, 0);
});

test('first-login introduction acknowledgement persists without billing or notification effects', async () => {
  const store = new PreviewStore();
  await withServer({ config, store, stripeGateway: new StripeGateway() }, async base => {
    const bootstrap = await fetch(`${base}/api/ui/bootstrap`, { headers: studentHeaders });
    const initial = await bootstrap.json();
    assert.equal(initial.onboarding_launch.intro_required, true);
    const response = await fetch(`${base}/api/me/onboarding/intro`, {
      method: 'POST',
      headers: { ...studentHeaders, 'idempotency-key': 'onboarding-intro-0001' },
      body: JSON.stringify({ acknowledged: true }),
    });
    assert.equal(response.status, 201);
    const receipt = await response.json();
    assert.equal(receipt.onboarding_launch.intro_required, false);
    assert.equal(receipt.notification_sent, false);
    assert.equal(receipt.money_moved_cents, 0);
  });
  assert.equal(store.notifications.size, 0);
  assert.equal(store.autoChargeDispatches.size, 0);
  assert.equal(store.chargesByDay.size, 0);
});

test('Dr J repeat-trial override is documented, idempotent and zero-money', async () => {
  const store = new PreviewStore();
  const adminHeaders = {
    'content-type': 'application/json',
    'x-missionaccounts-local-role': 'missionaccounts_admin',
    'x-missionaccounts-local-user': 'wp:drj',
    'idempotency-key': 'trial-override-0001',
  };
  await withServer({ config, store, stripeGateway: new StripeGateway() }, async base => {
    const url = `${base}/api/admin/students/${studentId}/commerce/trial-override`;
    const body = JSON.stringify({ starts_on: '2026-09-17', reason: 'Dr J approved one documented repeat trial.' });
    const first = await fetch(url, { method: 'POST', headers: adminHeaders, body });
    assert.equal(first.status, 201);
    const receipt = await first.json();
    assert.equal(receipt.money_moved_cents, 0);
    assert.equal(receipt.trial_override.starts_on, '2026-09-17');
    const replay = await fetch(url, { method: 'POST', headers: adminHeaders, body });
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).duplicate, true);
  });
  assert.equal(store.notifications.size, 0);
  assert.equal(store.chargesByDay.size, 0);
});

test('migration and launch assets preserve the protected safety contract', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20260917100000_commerce_onboarding_launch_5404e.sql', import.meta.url), 'utf8');
  const html = await readFile(new URL('../public/index.production.html', import.meta.url), 'utf8');
  const manifest = JSON.parse(await readFile(new URL('../emails/onboarding-launch-v1.manifest.json', import.meta.url), 'utf8'));
  const commercePlugin = await readFile(new URL('../infra/wordpress/missionmed-drj-examprep-commerce.php', import.meta.url), 'utf8');
  const ssoPlugin = await readFile(new URL('../infra/wordpress/missionmed-missionaccounts-sso.php', import.meta.url), 'utf8');
  const emailHtml = await readFile(new URL('../emails/onboarding-launch-v1.html', import.meta.url), 'utf8');
  const emailText = await readFile(new URL('../emails/onboarding-launch-v1.txt', import.meta.url), 'utf8');
  for (const token of ['absence_consumes_trial_day', 'same_day_sessions_count', 'automatic_conversion', 'money_moved_cents', 'external_send_authorized boolean not null default false', 'for update', 'api_grant_student_trial_override', 'student_live_group_grandfathered_plan', 'auto_charge_dispatch_requires_pay_go_plan']) assert.match(migration, new RegExp(token));
  assert.match(html, /Start onboarding/);
  assert.match(html, /takes only a few minutes/);
  assert.match(html, /within 48 hours/);
  assert.match(html, /Incomplete/);
  assert.match(html, /Choose \$300\/month/);
  assert.match(html, /Grant repeat trial/);
  assert.match(commercePlugin, /MMDRJ_TEAM_PRODUCT_ID\s+=>\s+MMDRJ_TEAM_COURSE_ID/);
  assert.match(commercePlugin, /MMDRJ_DAILY_DRILLS_PRODUCT_ID\s+=>\s+MMDRJ_DAILY_DRILLS_COURSE_ID/);
  assert.match(commercePlugin, /array\( 'cancelled', 'failed', 'refunded' \)/);
  assert.match(commercePlugin, /usage_limit_per_user/);
  assert.match(commercePlugin, /14 \* DAY_IN_SECONDS/);
  assert.match(commercePlugin, /woocommerce_before_calculate_totals/);
  assert.match(commercePlugin, /subscription_renewal/);
  assert.doesNotMatch(commercePlugin, /DRJGROUPS|DRJMUL|DRJUCC|DRJGUARANTEE/);
  const publicPanel = commercePlugin.match(/function mmdrj_public_pricing_panel[\s\S]+?add_filter\( 'the_content'/)?.[0] || '';
  assert.doesNotMatch(publicPanel, /\$39\.99/);
  assert.match(ssoPlugin, /missionaccounts_commerce/);
  for (const required of ['within 48 hours', 'Dr J is still your teacher', '{{username}}', '{{password_setup_url}}', '{{support_email}}', 'does not create a charge']) {
    assert.match(`${emailHtml}\n${emailText}`, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
  assert.equal(manifest.external_send_authorized, false);
  assert.equal(manifest.access_enforcement_enabled, false);
  assert.equal(manifest.recipient_addresses_stored_in_source, false);
  assert.equal(manifest.provider, 'wordpress_wp_mail');
  assert.deepEqual(manifest.pilot_display_names, ['Neidy','Ana Torres','Raghav Gupta','Subani Dias']);
});
