import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { createPostmarkService, PostmarkError } from '../../server/postmark.mjs';
import { createRequestsService, RequestsError } from '../../server/requests.mjs';

const identity = {
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'student',
  eligible: true,
  firstName: 'Maya',
};
const invitationId = '22222222-2222-4222-8222-222222222222';
const attemptId = '33333333-3333-4333-8333-333333333333';
const contributionId = '44444444-4444-4444-8444-444444444444';
const invitation = {
  id: invitationId,
  contributor_first_name: 'Sam',
  relationship_id: 'parent',
  email: 'sam@example.test',
  status: 'draft',
  personal_message: 'Please share one moment.',
  disclosure_version: 'founder-v1',
  reminders_sent: 0,
  row_version: '1',
  delivery_state: 'reserved',
  delivery_attempt_id: attemptId,
  delivery_ordinal: 0,
};

function makeService({ identityQuery, serviceQuery, postmark, signPlayback } = {}) {
  return createRequestsService({
    environment: {
      STORYFORGE_REQUEST_A_STORY_FORCE_OFF: '0',
      STORYFORGE_GUEST_FORCE_OFF: '0',
      STORYFORGE_GUEST_CONTRIBUTIONS_FORCE_OFF: '0',
      STORYFORGE_GUEST_DISCLOSURE_VERSION: 'founder-v1',
      STORYFORGE_PUBLIC_URL: 'https://example.test/storyforge',
    },
    postmark,
    signPlayback,
    withIdentity: async (_identity, operation) => operation({ query: identityQuery }),
    withServiceTransaction: async (operation) => operation({ query: serviceQuery }),
  });
}

test('dry-run delivery performs read-only preparation without a token reservation or provider call', async () => {
  const sqlCalls = [];
  let sends = 0;
  const subject = makeService({
    identityQuery: async (sql) => {
      sqlCalls.push(sql);
      if (sql.includes('sf_story_feature_enabled')) return { rows: [{ enabled: true }] };
      if (sql.includes('sf_request_prepare_send')) return { rows: [{ payload: invitation }] };
      throw new Error(`unexpected SQL: ${sql}`);
    },
    serviceQuery: async () => { throw new Error('service transaction must not run'); },
    postmark: {
      readiness: () => ({ mode: 'dry_run' }),
      send: async () => { sends += 1; },
    },
  });
  const result = await subject.send(identity, invitationId, { expectedVersion: 0 });
  assert.equal(result.dryRun, true);
  assert.equal(result.deliveryPending, false);
  assert.match(result.previewUrl, /secure-link-created-on-send/);
  assert.equal(sends, 0);
  assert.equal(sqlCalls.some((sql) => sql.includes('sf_request_reserve_delivery')), false);
});

test('an existing active reservation returns pending and never calls the provider again', async () => {
  let sends = 0;
  const subject = makeService({
    identityQuery: async (sql) => {
      if (sql.includes('sf_story_feature_enabled')) return { rows: [{ enabled: true }] };
      if (sql.includes('sf_request_reserve_delivery')) {
        return { rows: [{ payload: { ...invitation, delivery_created: false } }] };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    },
    serviceQuery: async () => { throw new Error('service transaction must not run'); },
    postmark: { send: async () => { sends += 1; } },
  });
  const result = await subject.send(identity, invitationId, { expectedVersion: 0 });
  assert.equal(result.deliveryPending, true);
  assert.equal(sends, 0);
});

test('ambiguous provider outcomes freeze the reservation and retries do not duplicate delivery', async () => {
  let reserveCalls = 0;
  let sends = 0;
  const serviceCalls = [];
  const subject = makeService({
    identityQuery: async (sql) => {
      if (sql.includes('sf_story_feature_enabled')) return { rows: [{ enabled: true }] };
      if (sql.includes('sf_request_reserve_delivery')) {
        reserveCalls += 1;
        return { rows: [{ payload: { ...invitation, delivery_created: reserveCalls === 1 } }] };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    },
    serviceQuery: async (sql) => {
      serviceCalls.push(sql);
      if (sql.includes('sf_request_claim_delivery_attempt')) {
        return { rows: [{ payload: { claimed: true, state: 'dispatching' } }] };
      }
      if (sql.includes('sf_request_mark_delivery_ambiguous')) return { rows: [{ payload: { state: 'ambiguous' } }] };
      throw new Error(`unexpected SQL: ${sql}`);
    },
    postmark: {
      send: async () => {
        sends += 1;
        const error = new Error('network outcome unknown');
        error.deliveryDisposition = 'ambiguous';
        throw error;
      },
    },
  });
  assert.equal((await subject.send(identity, invitationId, { expectedVersion: 0 })).deliveryPending, true);
  assert.equal((await subject.send(identity, invitationId, { expectedVersion: 0 })).deliveryPending, true);
  assert.equal(sends, 1);
  assert.equal(serviceCalls.filter((sql) => sql.includes('sf_request_claim_delivery_attempt')).length, 1);
  assert.equal(serviceCalls.filter((sql) => sql.includes('sf_request_mark_delivery_ambiguous')).length, 1);
});

test('provider acceptance followed by finalize failure returns pending and never resends', async () => {
  let reserveCalls = 0;
  let sends = 0;
  const subject = makeService({
    identityQuery: async (sql) => {
      if (sql.includes('sf_story_feature_enabled')) return { rows: [{ enabled: true }] };
      if (sql.includes('sf_request_reserve_delivery')) {
        reserveCalls += 1;
        return { rows: [{ payload: { ...invitation, delivery_created: reserveCalls === 1 } }] };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    },
    serviceQuery: async (sql) => {
      if (sql.includes('sf_request_claim_delivery_attempt')) return { rows: [{ payload: { claimed: true } }] };
      if (sql.includes('sf_request_accept_delivery')) throw new Error('database unavailable after acceptance');
      if (sql.includes('sf_request_mark_delivery_ambiguous')) return { rows: [{ payload: { state: 'ambiguous' } }] };
      throw new Error(`unexpected SQL: ${sql}`);
    },
    postmark: {
      send: async () => {
        sends += 1;
        return { accepted: true, providerMessageId: 'provider-accepted' };
      },
    },
  });
  assert.equal((await subject.send(identity, invitationId, { expectedVersion: 0 })).deliveryPending, true);
  assert.equal((await subject.send(identity, invitationId, { expectedVersion: 0 })).deliveryPending, true);
  assert.equal(sends, 1);
});

test('a proven not-sent provider rejection closes only its reserved attempt and surfaces the fixed error', async () => {
  const serviceCalls = [];
  const rejection = new Error('provider rejected before acceptance');
  rejection.deliveryDisposition = 'not_sent';
  const subject = makeService({
    identityQuery: async (sql) => {
      if (sql.includes('sf_story_feature_enabled')) return { rows: [{ enabled: true }] };
      if (sql.includes('sf_request_reserve_delivery')) {
        return { rows: [{ payload: { ...invitation, delivery_created: true } }] };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    },
    serviceQuery: async (sql, values) => {
      serviceCalls.push({ sql, values });
      if (sql.includes('sf_request_claim_delivery_attempt')) return { rows: [{ payload: { claimed: true } }] };
      if (sql.includes('sf_request_fail_delivery')) return { rows: [{ payload: { state: 'definitive_failure' } }] };
      throw new Error(`unexpected SQL: ${sql}`);
    },
    postmark: { send: async () => { throw rejection; } },
  });
  await assert.rejects(
    () => subject.send(identity, invitationId, { expectedVersion: 0 }),
    (error) => error === rejection,
  );
  const failure = serviceCalls.find(({ sql }) => sql.includes('sf_request_fail_delivery'));
  assert.deepEqual(failure.values, [attemptId, 'provider_rejected', null]);
  assert.equal(serviceCalls.some(({ sql }) => sql.includes('sf_request_mark_delivery_ambiguous')), false);
});

test('signed webhook metadata is bounded to attempt and invitation identifiers only', async () => {
  let values;
  const subject = makeService({
    identityQuery: async () => ({ rows: [{ enabled: true }] }),
    serviceQuery: async (sql, input) => {
      if (sql.includes('sf_request_provider_event_resolve')) {
        values = input;
        return { rows: [{ payload: { accepted: true } }] };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    },
    postmark: { send: async () => ({ accepted: true }) },
  });
  await subject.processWebhook({
    RecordType: 'Delivery',
    MessageID: 'provider-1',
    DeliveredAt: '2026-08-10T12:00:00Z',
    Metadata: {
      storyforgeDeliveryAttemptId: attemptId,
      storyforgeInvitationId: invitationId,
      ignoredEmail: 'must-not-enter-sql@example.test',
    },
  });
  assert.equal(values[5], attemptId);
  assert.equal(values[6], invitationId);
  assert.equal(JSON.stringify(values).includes('must-not-enter-sql@example.test'), false);
});

test('Postmark treats network, non-2xx, and missing MessageID outcomes as ambiguous without retrying', async () => {
  const environment = {
    STORYFORGE_POSTMARK_ENABLED: '1',
    STORYFORGE_POSTMARK_LIVE_SEND_ENABLED: '1',
    STORYFORGE_POSTMARK_FROM: 'verified@example.test',
    STORYFORGE_POSTMARK_REPLY_TO: 'reply@example.test',
    STORYFORGE_POSTMARK_SERVER_TOKEN: 'x'.repeat(24),
  };
  for (const fetchImpl of [
    async () => { throw new Error('timeout'); },
    async () => ({ ok: false, status: 503 }),
    async () => ({ ok: true, json: async () => ({ MessageID: '' }) }),
  ]) {
    let calls = 0;
    const subject = createPostmarkService({
      environment,
      fetchImpl: async (...args) => { calls += 1; return fetchImpl(...args); },
    });
    await assert.rejects(
      () => subject.send({ to: 'guest@example.test', subject: 's', htmlBody: 'h', textBody: 't' }),
      (error) => error instanceof PostmarkError && error.deliveryDisposition === 'ambiguous',
    );
    assert.equal(calls, 1);
  }
});

test('guest contribution cap maps to a fixed safe 429 and playback returns only a short-lived signed owner URL', async () => {
  const rawToken = 'A'.repeat(43);
  let signInput;
  const capped = makeService({
    identityQuery: async () => ({ rows: [{ enabled: true }] }),
    serviceQuery: async (sql) => {
      if (sql.includes("key='guest_contributions'")) return { rows: [{ enabled: true }] };
      if (sql.includes('sf_guest_rate_hit')) return { rows: [{ attempts: 1 }] };
      if (sql.includes('FROM public.sf_story_invitations')) return { rows: [{
        id: invitationId,
        token_hash: createHash('sha256').update(rawToken).digest('hex'),
        relationship_id: 'parent',
        expires_at: '2099-01-01T00:00:00Z',
      }] };
      if (sql.includes('sf_contributor_prompts')) return { rows: [{ id: contributionId, text: 'Prompt' }] };
      if (sql.includes('sf_guest_contribute')) {
        const error = new Error('database detail must not leak');
        error.code = 'P0003';
        throw error;
      }
      throw new Error(`unexpected SQL: ${sql}`);
    },
    postmark: { send: async () => ({ accepted: true }) },
  });
  await assert.rejects(
    () => capped.contribute(rawToken, { promptId: contributionId, transcript: 'A memory.' }),
    (error) => error instanceof RequestsError
      && error.code === 'invitation_complete'
      && error.status === 429
      && error.message === 'This invitation already has three shared stories.'
      && !error.message.includes('database detail'),
  );

  const playback = makeService({
    identityQuery: async (sql) => {
      if (sql.includes('sf_story_feature_enabled')) return { rows: [{ enabled: true }] };
      if (sql.includes('sf_contribution_audio_playback_claim')) return { rows: [{ payload: {
        contributionId,
        objectKey: 'private/contribution.webm',
        contentType: 'audio/webm',
        durationMs: 4000,
        byteSize: 6,
      } }] };
      throw new Error(`unexpected SQL: ${sql}`);
    },
    serviceQuery: async () => ({ rows: [] }),
    postmark: { send: async () => ({ accepted: true }) },
    signPlayback: async (input) => {
      signInput = input;
      return { playbackUrl: 'https://signed.example/private', expiresIn: 60 };
    },
  });
  const result = await playback.contributionPlayback(identity, contributionId);
  assert.deepEqual(signInput, { objectKey: 'private/contribution.webm' });
  assert.equal(result.playbackUrl, 'https://signed.example/private');
  assert.equal(JSON.stringify(result).includes('objectKey'), false);
});
