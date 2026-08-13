import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { createRequestsService, RequestsError } from '../../server/requests.mjs';

const identity = {
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'student',
  eligible: true,
  firstName: 'Maya',
};
const invitationId = '22222222-2222-4222-8222-222222222222';
const invitation = {
  id: invitationId,
  contributor_first_name: 'Sam',
  relationship_id: 'parent',
  email: 'sam@example.test',
  status: 'draft',
  personal_message: 'Please share one specific moment.',
  disclosure_version: 'founder-v1',
  reminders_sent: 0,
  row_version: '0',
  preview_event_id: '9007199254740993',
};

function makeService({ identityQuery, serviceQuery, environment = {}, postmark, signPlayback } = {}) {
  return createRequestsService({
    environment: {
      STORYFORGE_REQUEST_A_STORY_FORCE_OFF: '0',
      STORYFORGE_GUEST_FORCE_OFF: '0',
      STORYFORGE_GUEST_CONTRIBUTIONS_FORCE_OFF: '0',
      STORYFORGE_GUEST_DISCLOSURE_VERSION: 'founder-v1',
      STORYFORGE_PUBLIC_URL: 'https://example.test/storyforge',
      STORYFORGE_POSTMARK_FROM: 'verified@example.test',
      STORYFORGE_POSTMARK_REPLY_TO: 'reply@example.test',
      ...environment,
    },
    postmark: postmark || {
      send: async () => ({ accepted: true, dryRun: false, providerMessageId: 'provider-1' }),
    },
    signPlayback,
    withIdentity: async (_identity, operation) => operation({ query: identityQuery }),
    withServiceTransaction: async (operation) => operation({
      query: serviceQuery || (async () => ({ rows: [] })),
    }),
  });
}

test('draft update and preview use versioned SECURITY DEFINER contracts and preview returns the exact composed send content', async () => {
  const calls = [];
  const subject = makeService({
    identityQuery: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.includes('sf_story_feature_enabled')) return { rows: [{ enabled: true }] };
      if (sql.includes('sf_request_update')) return { rows: [{ payload: { ...invitation, row_version: '1' } }] };
      if (sql.includes('sf_request_preview')) return { rows: [{ payload: { ...invitation, previewed_at: '2026-08-10T12:00:00Z' } }] };
      throw new Error(`unexpected SQL: ${sql}`);
    },
  });

  const updated = await subject.update(identity, invitationId, {
    recipientFirstName: 'Sam',
    relationship: 'parent',
    email: 'SAM@example.test',
    personalMessage: 'Please share one specific moment.',
    expectedVersion: 0,
  });
  assert.equal(updated.maskedEmail, 's***@example.test');
  assert.equal(JSON.stringify(updated).includes('sam@example.test'), false);

  const previewed = await subject.preview(identity, invitationId, { expectedVersion: 0 });
  assert.equal(previewed.preview.auditEventId, '9007199254740993');
  assert.equal(previewed.preview.to, 'sam@example.test');
  assert.match(previewed.preview.textBody, /secure-link-created-on-send/);
  assert.match(previewed.preview.htmlBody, /Please share one specific moment\./);
  assert.equal(previewed.preview.senderVerification, 'required-before-live-send');
  assert.ok(calls.some(({ sql }) => sql.includes('sf_request_update')));
  assert.ok(calls.some(({ sql }) => sql.includes('sf_request_preview')));
});

test('guest links fail closed unless the configured public URL is canonical HTTPS StoryForge', async () => {
  for (const environment of [
    { STORYFORGE_PUBLIC_URL: '', STORYFORGE_PUBLIC_ORIGIN: '' },
    { STORYFORGE_PUBLIC_URL: 'http://missionmedinstitute.com/storyforge' },
    { STORYFORGE_PUBLIC_URL: 'https://evil.example/storyforge', STORYFORGE_PUBLIC_ORIGIN: 'https://missionmedinstitute.com' },
    { STORYFORGE_PUBLIC_URL: 'https://missionmedinstitute.com/not-storyforge' },
  ]) {
    const subject = makeService({
      environment,
      identityQuery: async (sql) => {
        if (sql.includes('sf_story_feature_enabled')) return { rows: [{ enabled: true }] };
        throw new Error(`unexpected SQL: ${sql}`);
      },
    });
    await assert.rejects(
      () => subject.preview(identity, invitationId, { expectedVersion: 0 }),
      (error) => error instanceof RequestsError
        && error.code === 'guest_public_url_unavailable'
        && error.status === 503,
    );
  }
});

test('guest experience preview is owner-bounded, governed, non-sending, and contains no email or token', async () => {
  const calls = [];
  const subject = makeService({
    identityQuery: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.includes('sf_story_feature_enabled')) return { rows: [{ enabled: true }] };
      if (sql.includes('FROM public.sf_story_invitations invitation')) {
        return { rows: [{
          id: invitationId,
          contributor_first_name: 'Sam',
          relationship_id: 'parent',
          personal_message: 'Please share one specific moment.',
          disclosure_version: 'founder-v1',
          expires_at: '2026-09-01T00:00:00Z',
          status: 'draft',
        }] };
      }
      if (sql.includes('FROM public.sf_contributor_prompts')) {
        return { rows: [{
          id: '33333333-3333-4333-8333-333333333333',
          library_key: 'parent-001',
          text: 'When did you see Maya become more confident?',
          hint: 'Choose one concrete moment.',
        }] };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    },
  });

  const preview = await subject.guestExperiencePreview(identity, invitationId);
  assert.equal(preview.previewOnly, true);
  assert.equal(preview.student.firstName, 'Maya');
  assert.equal(preview.recipientFirstName, 'Sam');
  assert.equal(preview.relationship, 'parent');
  assert.equal(preview.prompts.length, 1);
  assert.equal(JSON.stringify(preview).includes('sam@example.test'), false);
  assert.equal(JSON.stringify(preview).includes('secure-link'), false);
  assert.equal(calls.some(({ sql }) => sql.includes('sf_request_prepare_send')), false);
  assert.equal(calls.some(({ sql }) => sql.includes('sf_request_reserve_delivery')), false);
  assert.deepEqual(
    calls.find(({ sql }) => sql.includes('sf_story_invitations invitation')).values,
    [invitationId],
  );

  const missing = makeService({
    identityQuery: async (sql) => sql.includes('sf_story_feature_enabled')
      ? { rows: [{ enabled: true }] }
      : { rows: [] },
  });
  await assert.rejects(
    () => missing.guestExperiencePreview(identity, invitationId),
    (error) => error instanceof RequestsError
      && error.code === 'invitation_not_found'
      && error.status === 404,
  );
});

test('send and reminder commit a unique reservation before the one provider call and finalize through service-only RPCs', async () => {
  const sequence = [];
  const deliveries = [];
  let reserveCount = 0;
  const subject = makeService({
    identityQuery: async (sql, values) => {
      if (sql.includes('sf_story_feature_enabled')) return { rows: [{ enabled: true }] };
      if (sql.includes('sf_request_reserve_delivery')) {
        reserveCount += 1;
        sequence.push({ step: 'reserve', values });
        return { rows: [{ payload: {
          ...invitation,
          status: reserveCount === 1 ? 'draft' : 'sent',
          row_version: String(reserveCount === 1 ? 1 : 3),
          delivery_state: 'reserved',
          delivery_created: true,
          delivery_attempt_id: reserveCount === 1
            ? '33333333-3333-4333-8333-333333333333'
            : '44444444-4444-4444-8444-444444444444',
          delivery_ordinal: reserveCount === 1 ? 0 : 1,
        } }] };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    },
    serviceQuery: async (sql, values) => {
      if (sql.includes('sf_request_claim_delivery_attempt')) {
        sequence.push({ step: 'claim', values });
        return { rows: [{ payload: { claimed: true, state: 'dispatching' } }] };
      }
      if (sql.includes('sf_request_accept_delivery')) {
        sequence.push({ step: 'accept', values });
        const reminder = values[1] === 'provider-2';
        return { rows: [{ payload: {
          ...invitation,
          status: 'sent',
          reminders_sent: reminder ? 1 : 0,
          row_version: String(reminder ? 4 : 2),
        } }] };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    },
    postmark: {
      send: async (delivery) => {
        sequence.push({ step: 'provider' });
        deliveries.push(delivery);
        return { accepted: true, dryRun: false, providerMessageId: `provider-${deliveries.length}` };
      },
    },
  });

  const sent = await subject.send(identity, invitationId, { expectedVersion: 0 });
  assert.equal(sent.invitation.status, 'sent');
  const reminded = await subject.remind(identity, invitationId, { expectedVersion: 2 });
  assert.equal(reminded.invitation.remindersSent, 1);
  assert.deepEqual(
    sequence.map(({ step }) => step),
    ['reserve', 'claim', 'provider', 'accept', 'reserve', 'claim', 'provider', 'accept'],
  );
  assert.equal(sequence[0].values[3].length, 64);
  assert.equal(sequence[4].values[3].length, 64);
  assert.equal(sequence.some(({ values }) => JSON.stringify(values || []).includes('/guest/')), false);
  assert.equal(deliveries[0].metadata.purpose, 'initial');
  assert.equal(deliveries[1].metadata.purpose, 'reminder');
  assert.equal(deliveries[0].metadata.storyforgeDeliveryAttemptId, '33333333-3333-4333-8333-333333333333');
  assert.equal(Object.hasOwn(deliveries[0].metadata, 'token'), false);
  assert.match(deliveries[1].subject, /^Reminder:/);
});

test('re-invite is bounded to a new address and unsupported payload keys fail before database access', async () => {
  let rpcValues;
  const subject = makeService({
    identityQuery: async (sql, values) => {
      if (sql.includes('sf_story_feature_enabled')) return { rows: [{ enabled: true }] };
      if (sql.includes('sf_request_reinvite')) {
        rpcValues = values;
        return { rows: [{ payload: { ...invitation, id: '33333333-3333-4333-8333-333333333333', email: 'new@example.test' } }] };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    },
  });
  const result = await subject.reinvite(identity, invitationId, { expectedVersion: 4, email: 'NEW@example.test' });
  assert.equal(result.maskedEmail, 'n***@example.test');
  assert.deepEqual(rpcValues, [invitationId, 4, 'new@example.test']);
  await assert.rejects(
    () => subject.reinvite(identity, invitationId, { expectedVersion: 4, email: 'new@example.test', provider: 'Postmark' }),
    (error) => error instanceof RequestsError && error.code === 'invalid_invitation',
  );
});

test('SpamComplaint is normalized to the suppression contract without exposing an address', async () => {
  let values;
  const subject = makeService({
    identityQuery: async () => ({ rows: [{ enabled: true }] }),
    serviceQuery: async (sql, input) => {
      if (sql.includes('sf_request_provider_event')) {
        values = input;
        return { rows: [{ payload: { accepted: true } }] };
      }
      return { rows: [] };
    },
  });
  assert.deepEqual(await subject.processWebhook({
    RecordType: 'SpamComplaint',
    MessageID: 'provider-complaint',
    ReceivedAt: '2026-08-10T12:00:00Z',
    Description: 'recipient complaint',
    Email: 'must-not-enter-contract@example.test',
  }), { accepted: true });
  assert.equal(values[1], 'complained');
  assert.equal(JSON.stringify(values).includes('must-not-enter-contract@example.test'), false);
});

test('expiry processing defaults closed and never touches PostgreSQL without the lifecycle gate', async () => {
  let calls = 0;
  const subject = makeService({
    environment: { STORYFORGE_REQUEST_LIFECYCLE_FORCE_OFF: '1' },
    serviceQuery: async () => { calls += 1; return { rows: [{ expired: 3 }] }; },
  });
  assert.deepEqual(await subject.expireDue(), { expired: 0, disabled: true });
  assert.equal(calls, 0);
});

test('student contribution review uses the versioned owner-only RPC and normalizes a blank note', async () => {
  const calls = [];
  const reviewed = {
    id: invitationId,
    state: 'new',
    studentScore: 4,
    studentReviewNote: null,
    rowVersion: 3,
    reviewedAt: '2026-08-13T17:00:00Z',
  };
  const subject = makeService({
    identityQuery: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.includes('sf_story_feature_enabled')) return { rows: [{ enabled: true }] };
      if (sql.includes('sf_request_review_contribution')) return { rows: [{ payload: reviewed }] };
      throw new Error(`unexpected SQL: ${sql}`);
    },
  });

  assert.deepEqual(await subject.reviewContribution(identity, invitationId, {
    expectedVersion: 2,
    score: 4,
    note: '   ',
  }), reviewed);
  const rpc = calls.find(({ sql }) => sql.includes('sf_request_review_contribution'));
  assert.deepEqual(rpc.values, [invitationId, 2, 4, null]);
});

test('student contribution review rejects malformed input before mutation and sanitizes database outcomes', async () => {
  let mutations = 0;
  const invalid = makeService({
    identityQuery: async (sql) => {
      if (sql.includes('sf_story_feature_enabled')) return { rows: [{ enabled: true }] };
      mutations += 1;
      return { rows: [] };
    },
  });
  for (const input of [
    { expectedVersion: 0, score: 0, note: '' },
    { expectedVersion: -1, score: 5, note: '' },
    { expectedVersion: 0, score: 5, note: 42 },
    { expectedVersion: 0, score: 5, note: 'x'.repeat(2001) },
    { expectedVersion: 0, score: 5, note: '', email: 'hidden@example.test' },
  ]) {
    await assert.rejects(
      () => invalid.reviewContribution(identity, invitationId, input),
      (error) => error instanceof RequestsError
        && error.code === 'invalid_contribution_review'
        && error.status === 400,
    );
  }
  assert.equal(mutations, 0);

  for (const [databaseCode, expectedCode, expectedStatus] of [
    ['P0002', 'contribution_not_found', 404],
    ['40001', 'contribution_conflict', 409],
    ['22023', 'invalid_contribution_review', 400],
    ['42501', 'request_a_story_disabled', 403],
  ]) {
    const subject = makeService({
      identityQuery: async (sql) => {
        if (sql.includes('sf_story_feature_enabled')) return { rows: [{ enabled: true }] };
        const error = new Error('sensitive postgres detail');
        error.code = databaseCode;
        throw error;
      },
    });
    await assert.rejects(
      () => subject.reviewContribution(identity, invitationId, { expectedVersion: 0, score: 5, note: 'Keep.' }),
      (error) => error instanceof RequestsError
        && error.code === expectedCode
        && error.status === expectedStatus
        && !error.message.includes('postgres'),
    );
  }
});

test('migration keeps lifecycle writes in SECURITY DEFINER functions with forced-RLS hash-only suppression', async () => {
  const sql = await readFile(new URL('../../infra/postgres/migrations/20260810240000_b1_514_v2_ra_lifecycle_completion.sql', import.meta.url), 'utf8');
  for (const name of [
    'sf_request_update', 'sf_request_preview', 'sf_request_prepare_send',
    'sf_request_prepare_reminder', 'sf_request_mark_reminded', 'sf_request_reinvite',
    'sf_guest_mark_started', 'sf_guest_expire_if_due', 'sf_request_expire_due',
    'sf_request_provider_event',
  ]) {
    assert.match(sql, new RegExp(`FUNCTION public\\.${name}\\(`));
  }
  assert.match(sql, /sf_story_invitation_suppressions FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /email_hash text PRIMARY KEY/);
  assert.doesNotMatch(sql, /sf_story_invitation_suppressions[\s\S]{0,300}\bemail\s+text\b/);
  assert.match(sql, /sf_story_invitation_events_append_only/);
  assert.match(sql, /reminders_sent < 2/);
  assert.match(sql, /token_hash = NULL/);
});
