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

function makeService({ identityQuery, serviceQuery, environment = {}, postmark } = {}) {
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

test('send and reminder always prepare in PostgreSQL before provider acceptance and finalize through versioned RPCs', async () => {
  const calls = [];
  const deliveries = [];
  const subject = makeService({
    identityQuery: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.includes('sf_story_feature_enabled')) return { rows: [{ enabled: true }] };
      if (sql.includes('sf_request_prepare_send')) return { rows: [{ payload: invitation }] };
      if (sql.includes('sf_request_mark_sent')) return { rows: [{ payload: { ...invitation, status: 'sent', row_version: '1' } }] };
      if (sql.includes('sf_request_prepare_reminder')) return { rows: [{ payload: { ...invitation, status: 'sent', row_version: '1' } }] };
      if (sql.includes('sf_request_mark_reminded')) return { rows: [{ payload: { ...invitation, status: 'sent', reminders_sent: 1, row_version: '2' } }] };
      throw new Error(`unexpected SQL: ${sql}`);
    },
    postmark: {
      send: async (delivery) => {
        deliveries.push(delivery);
        return { accepted: true, dryRun: false, providerMessageId: `provider-${deliveries.length}` };
      },
    },
  });

  const sent = await subject.send(identity, invitationId, { expectedVersion: 0 });
  assert.equal(sent.invitation.status, 'sent');
  const reminded = await subject.remind(identity, invitationId, { expectedVersion: 1 });
  assert.equal(reminded.invitation.remindersSent, 1);
  assert.deepEqual(
    calls.filter(({ sql }) => sql.includes('sf_request_')).map(({ sql }) => sql.match(/sf_request_[a-z_]+/)?.[0]),
    ['sf_request_prepare_send', 'sf_request_mark_sent', 'sf_request_prepare_reminder', 'sf_request_mark_reminded'],
  );
  assert.equal(deliveries[0].metadata.purpose, 'initial');
  assert.equal(deliveries[1].metadata.purpose, 'reminder');
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
