import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createMissionAccountsServer } from '../src/server.mjs';
import { PreviewStore } from '../src/storage/supabase-rest.mjs';
import { StripeGateway } from '../src/payments/stripe.mjs';

const studentId = '00000000-0000-4000-8000-000000000001';
const features = {
  studentContacts: false, billingDecisions: false, attendanceCorrections: false,
  identityReview: false, examPlans: false, compDays: false, paymentMethodSetup: false,
  manualCharges: false, autoBilling: false, autoBillingConsent: false,
  autoBillingShadow: false, hostedInvoices: false, notifications: false, zoomSync: false,
  zoomShadow: false, zoomEffectiveWrites: false, billableDayCalculation: false,
  onboarding: true,
};
const config = {
  production: false, routeEnabled: false, localAuth: true,
  issuer: 'https://issuer.invalid', audience: 'missionaccounts', jwksUrl: 'https://issuer.invalid/jwks',
  features, stripeAccountId: '', workerToken: '',
};
const studentHeaders = {
  'content-type': 'application/json',
  'x-missionaccounts-local-role': 'student',
  'x-missionaccounts-local-user': studentId,
};
const validProfile = {
  preferred_name: 'Ari',
  school_name: 'Mission Medical School',
  best_contact_method: 'email',
  mailing_line1: '100 Learning Way',
  mailing_line2: 'Unit 4',
  mailing_city: 'Atlanta',
  mailing_region: 'GA',
  mailing_postal_code: '30303',
  mailing_country_code: 'US',
  expected_revision: 0,
};

async function withServer(options, run) {
  const server = createMissionAccountsServer(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

test('onboarding is disabled by default and does not mutate student state', async () => {
  const store = new PreviewStore();
  const disabled = { ...config, features: { ...features, onboarding: false } };
  await withServer({ config: disabled, store, stripeGateway: new StripeGateway() }, async base => {
    const get = await fetch(`${base}/api/me/onboarding`, { headers: studentHeaders });
    assert.equal(get.status, 503);
    const post = await fetch(`${base}/api/me/onboarding`, {
      method: 'POST', headers: { ...studentHeaders, 'idempotency-key': 'onboard-disabled-0001' },
      body: JSON.stringify(validProfile),
    });
    assert.equal(post.status, 503);
  });
  assert.equal(store.onboardingProfiles.size, 0);
});

test('student saves, resumes, edits, and idempotently replays only their onboarding profile', async () => {
  const store = new PreviewStore();
  store.previewStudentRecord.phone = '+15555550123';
  const initialSideEffects = {
    notifications: store.notifications.size,
    automaticDispatches: store.autoChargeDispatches.size,
    hostedInvoices: store.hostedInvoiceDispatches.size,
    charges: store.chargesByDay.size,
  };
  await withServer({ config, store, stripeGateway: new StripeGateway() }, async base => {
    const initial = await fetch(`${base}/api/me/onboarding`, { headers: studentHeaders });
    assert.equal(initial.status, 200);
    const initialBody = await initial.json();
    assert.equal(initialBody.onboarding.status, 'NOT_STARTED');
    assert.equal(initialBody.onboarding.student.display_name, 'Preview Student');
    assert.equal(initialBody.onboarding.student.student_id, undefined);
    assert.deepEqual(initialBody.onboarding.missing_steps, ['PROFILE', 'EXAM_PLAN', 'PAYMENT_METHOD', 'BILLING_CONSENT']);

    const headers = { ...studentHeaders, 'idempotency-key': 'onboard-profile-0001' };
    const first = await fetch(`${base}/api/me/onboarding`, { method: 'POST', headers, body: JSON.stringify(validProfile) });
    assert.equal(first.status, 201);
    const saved = await first.json();
    assert.equal(saved.onboarding.status, 'IN_PROGRESS');
    assert.equal(saved.onboarding.revision, 1);
    assert.equal(saved.onboarding.profile.school_name, validProfile.school_name);

    const replay = await fetch(`${base}/api/me/onboarding`, { method: 'POST', headers, body: JSON.stringify(validProfile) });
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).duplicate, true);
    assert.equal(store.onboardingProfiles.get(studentId).revision, 1);

    const conflictingReplay = await fetch(`${base}/api/me/onboarding`, {
      method: 'POST', headers, body: JSON.stringify({ ...validProfile, school_name: 'Different School' }),
    });
    assert.equal(conflictingReplay.status, 409);

    const stale = await fetch(`${base}/api/me/onboarding`, {
      method: 'POST', headers: { ...studentHeaders, 'idempotency-key': 'onboard-profile-0002' },
      body: JSON.stringify({ ...validProfile, school_name: 'Updated School' }),
    });
    assert.equal(stale.status, 409);

    const edit = await fetch(`${base}/api/me/onboarding`, {
      method: 'POST', headers: { ...studentHeaders, 'idempotency-key': 'onboard-profile-0003' },
      body: JSON.stringify({ ...validProfile, school_name: 'Updated School', expected_revision: 1 }),
    });
    assert.equal(edit.status, 201);
    assert.equal((await edit.json()).onboarding.revision, 2);

    const resumed = await fetch(`${base}/api/me/onboarding`, { headers: studentHeaders });
    const resumedBody = await resumed.json();
    assert.equal(resumedBody.onboarding.profile.school_name, 'Updated School');
    assert.equal(resumedBody.onboarding.revision, 2);
  });
  assert.deepEqual({
    notifications: store.notifications.size,
    automaticDispatches: store.autoChargeDispatches.size,
    hostedInvoices: store.hostedInvoiceDispatches.size,
    charges: store.chargesByDay.size,
  }, initialSideEffects);
});

test('student can save one approved onboarding field and resume the partial profile', async () => {
  const store = new PreviewStore();
  await withServer({ config, store, stripeGateway: new StripeGateway() }, async base => {
    const saved = await fetch(`${base}/api/me/onboarding`, {
      method: 'POST',
      headers: { ...studentHeaders, 'idempotency-key': 'onboard-partial-0001' },
      body: JSON.stringify({ school_name: 'First saved field', expected_revision: 0 }),
    });
    assert.equal(saved.status, 201);
    const body = await saved.json();
    assert.equal(body.onboarding.profile.school_name, 'First saved field');
    assert.equal(body.onboarding.profile.mailing_line1, undefined);
    assert.equal(body.onboarding.status, 'IN_PROGRESS');
    assert.equal(body.onboarding.revision, 1);

    const resumed = await fetch(`${base}/api/me/onboarding`, { headers: studentHeaders });
    assert.equal((await resumed.json()).onboarding.profile.school_name, 'First saved field');
  });
});

test('ambiguous canonical identity cannot read a previously saved onboarding profile', async () => {
  const store = new PreviewStore();
  await store.saveStudentOnboarding({
    studentId, profile: { school_name: 'Private School' }, changedFields: ['school_name'],
    expectedRevision: 0, actorId: studentId, actorRole: 'student', requestId: 'onboard-private-0001',
  });
  store.previewStudentRecord.identity_state = 'needs_review';
  await withServer({ config, store, stripeGateway: new StripeGateway() }, async base => {
    const response = await fetch(`${base}/api/me/onboarding`, { headers: studentHeaders });
    assert.equal(response.status, 403);
    assert.doesNotMatch(await response.text(), /Private School/);
  });
});

test('completion is server-derived and sponsored students do not require payment or consent', async () => {
  const direct = new PreviewStore();
  direct.previewStudentRecord.phone = '+15555550123';
  await direct.saveStudentOnboarding({ studentId, profile: validProfile, expectedRevision: 0, actorId: studentId, actorRole: 'student', requestId: 'direct-profile-0001' });
  direct.examPlans.set(studentId, { id: 'plan-1', student_id: studentId, state: 'submitted' });
  direct.seedPaymentMethod(studentId, { status: 'on_file', brand: 'visa', last4: '4242' });
  direct.billingConsents.set(studentId, { state: 'authorized', terms_version: 'approved-v1' });
  assert.equal(direct.onboardingState(studentId).status, 'COMPLETE');

  const sponsored = new PreviewStore();
  sponsored.previewStudentRecord.phone = '+15555550123';
  sponsored.previewStudentRecord.sponsor_type = 'UCC';
  await sponsored.saveStudentOnboarding({ studentId, profile: validProfile, expectedRevision: 0, actorId: studentId, actorRole: 'student', requestId: 'sponsor-profile-0001' });
  sponsored.examPlans.set(studentId, { id: 'plan-2', student_id: studentId, state: 'submitted' });
  const state = sponsored.onboardingState(studentId);
  assert.equal(state.status, 'COMPLETE');
  assert.equal(state.payment_requirement, 'NOT_APPLICABLE');
  assert.equal(state.progress.payment_method, null);
  assert.equal(state.progress.billing_consent, null);
});

test('student subject isolation, admin minimum queue, and unsupported sensitive fields fail closed', async () => {
  const store = new PreviewStore();
  store.enrollmentProjections.set(studentId, {
    student_id: studentId, program_key: 'examprep', provider: 'learndash',
    course_id: 6357, enrolled: true, valid_until: '2099-01-01T00:00:00.000Z',
  });
  await withServer({ config, store, stripeGateway: new StripeGateway() }, async base => {
    const wrongSubject = await fetch(`${base}/api/me/onboarding`, {
      headers: { ...studentHeaders, 'x-missionaccounts-local-user': '00000000-0000-4000-8000-000000000002' },
    });
    assert.ok([403, 404].includes(wrongSubject.status));

    const adminSave = await fetch(`${base}/api/me/onboarding`, {
      method: 'POST', headers: { ...studentHeaders, 'x-missionaccounts-local-role': 'missionaccounts_admin', 'idempotency-key': 'admin-profile-0001' },
      body: JSON.stringify(validProfile),
    });
    assert.equal(adminSave.status, 403);

    const sensitive = await fetch(`${base}/api/me/onboarding`, {
      method: 'POST', headers: { ...studentHeaders, 'idempotency-key': 'sensitive-profile-0001' },
      body: JSON.stringify({ ...validProfile, password: 'never-store', card_number: '4242424242424242' }),
    });
    assert.equal(sensitive.status, 400);
    assert.equal(store.onboardingProfiles.size, 0);

    const queue = await fetch(`${base}/api/admin/onboarding`, {
      headers: { 'x-missionaccounts-local-role': 'missionaccounts_admin', 'x-missionaccounts-local-user': 'dr-j' },
    });
    assert.equal(queue.status, 200);
    const row = (await queue.json()).students[0];
    assert.deepEqual(Object.keys(row).sort(), [
      'display_name', 'last_updated_at', 'missing_steps', 'payment_requirement',
      'preferred_name', 'progress', 'status', 'student_id',
    ]);
    assert.equal(row.email, undefined);
    assert.equal(row.phone, undefined);
    assert.equal(row.mailing_line1, undefined);
    assert.equal(row.provider_customer_ref, undefined);
  });
});

test('admin onboarding queue includes only current canonical ExamPrep enrollment', async () => {
  const store = new PreviewStore();
  const withoutEnrollment = await store.adminOnboardingQueue({ actorId: 'dr-j', actorRole: 'missionaccounts_admin' });
  assert.deepEqual(withoutEnrollment, []);
  store.enrollmentProjections.set(studentId, {
    student_id: studentId, program_key: 'examprep', provider: 'learndash',
    course_id: 6357, enrolled: false, valid_until: '2099-01-01T00:00:00.000Z',
  });
  assert.deepEqual(await store.adminOnboardingQueue({ actorId: 'dr-j', actorRole: 'missionaccounts_admin' }), []);
  store.enrollmentProjections.set(studentId, {
    student_id: studentId, program_key: 'examprep', provider: 'learndash',
    course_id: 6357, enrolled: true, valid_until: '2020-01-01T00:00:00.000Z',
  });
  assert.deepEqual(await store.adminOnboardingQueue({ actorId: 'dr-j', actorRole: 'missionaccounts_admin' }), []);
});

test('production HTML exposes accessible responsive onboarding routes without adding money or delivery actions', async () => {
  const html = await readFile(new URL('../public/index.production.html', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../public/missionaccounts-runtime.js', import.meta.url), 'utf8');
  assert.match(html, /data-onboarding-form/);
  assert.match(html, /ExamPrep onboarding/);
  assert.match(html, /You can leave and resume at any time/);
  assert.match(html, />Save progress<\/button>/);
  assert.doesNotMatch(html, /name="(?:school_name|best_contact_method|mailing_line1|mailing_city|mailing_region|mailing_postal_code|mailing_country_code)"[^>]*\brequired\b/);
  assert.match(html, /@media\s*\(max-width:\s*960px\)/);
  assert.match(html, /@media\s*\(max-width:\s*640px\)/);
  assert.match(runtime, /'onboarding-save': 'onboarding'/);
  assert.match(runtime, /mutation\('\/me\/onboarding'/);
  assert.doesNotMatch(runtime.slice(runtime.indexOf("action === 'onboarding-save'"), runtime.indexOf("action === 'onboarding-save'") + 700), /charge|notification|invoice|dispatch/i);
});
