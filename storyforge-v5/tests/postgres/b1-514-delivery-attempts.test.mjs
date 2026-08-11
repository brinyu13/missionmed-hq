import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';

import {
  migrationSql,
  startEphemeralStoryForgeDatabase,
  withIdentity,
  withRole,
} from './helpers/ephemeral-postgres.mjs';

const STUDENT = {
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'student',
  wpUserId: 1101,
};
const migrations = [
  '20260810190000_b1_514_v2_r1_visibility_consent_activity.sql',
  '20260810200000_b1_514_v2_r2_story_versions_provenance.sql',
  '20260810210000_b1_514_v2_r3_inspiration.sql',
  '20260810220000_b1_514_v2_ra_requests_guest.sql',
  '20260810230000_b1_514_v2_preferences_environments.sql',
  '20260810240000_b1_514_v2_ra_lifecycle_completion.sql',
  '20260810260000_b1_514_guest_voice_contributions.sql',
  '20260810270000_b1_514_request_delivery_attempts.sql',
];

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const { Client } = pg;

async function asStudent(client, sql, values = []) {
  return withIdentity(client, STUDENT, (identityClient) => identityClient.query(sql, values));
}

async function asService(client, sql, values = []) {
  return withRole(client, 'storyforge_app', (serviceClient) => serviceClient.query(sql, values));
}

async function createPreviewed(client, email) {
  const invitation = (await asStudent(
    client,
    `SELECT public.sf_request_create('Pat','parent',$1,'One bounded moment.','founder-v1') AS payload`,
    [email],
  )).rows[0].payload;
  await asStudent(client, 'SELECT public.sf_request_preview($1,0)', [invitation.id]);
  return invitation;
}

test('delivery reservation commits the hash before dispatch, is retry-safe, and reconciles without duplicate send effects', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    for (const migration of migrations) {
      await client.query(migrationSql(migration).replace(/^\\set .*$/gm, ''));
    }
    await client.query(
      `UPDATE public.sf_feature_flags SET scope='eligible_all'
       WHERE key IN ('request_a_story','guest_contributions')`,
    );

    const rawToken = 'A'.repeat(43);
    const tokenHash = sha256(rawToken);
    const invitation = await createPreviewed(client, 'durable@example.test');
    let reserved = (await asStudent(
      client,
      `SELECT public.sf_request_reserve_delivery($1,0,'initial',$2) AS payload`,
      [invitation.id, tokenHash],
    )).rows[0].payload;
    assert.equal(reserved.delivery_created, true);
    assert.equal(reserved.status, 'draft');
    assert.equal(reserved.delivery_state, 'reserved');
    assert.equal(reserved.token_hash, tokenHash);
    assert.equal(JSON.stringify(reserved).includes(rawToken), false);

    const retry = (await asStudent(
      client,
      `SELECT public.sf_request_reserve_delivery($1,0,'initial',$2) AS payload`,
      [invitation.id, sha256('different-token')],
    )).rows[0].payload;
    assert.equal(retry.delivery_created, false);
    assert.equal(retry.delivery_attempt_id, reserved.delivery_attempt_id);
    const retryFromPendingProjection = (await asStudent(
      client,
      `SELECT public.sf_request_reserve_delivery($1,1,'initial',$2) AS payload`,
      [invitation.id, sha256('yet-another-token')],
    )).rows[0].payload;
    assert.equal(retryFromPendingProjection.delivery_created, false);
    assert.equal(retryFromPendingProjection.delivery_attempt_id, reserved.delivery_attempt_id);
    assert.equal((await client.query(
      'SELECT count(*)::integer AS count FROM public.sf_story_invitation_delivery_attempts WHERE invitation_id=$1',
      [invitation.id],
    )).rows[0].count, 1);

    let claim = (await asService(
      client,
      'SELECT public.sf_request_claim_delivery_attempt($1) AS payload',
      [reserved.delivery_attempt_id],
    )).rows[0].payload;
    assert.equal(claim.claimed, true);
    claim = (await asService(
      client,
      'SELECT public.sf_request_claim_delivery_attempt($1) AS payload',
      [reserved.delivery_attempt_id],
    )).rows[0].payload;
    assert.equal(claim.claimed, false);

    await asService(
      client,
      'SELECT public.sf_request_mark_delivery_ambiguous($1)',
      [reserved.delivery_attempt_id],
    );
    let pending = (await client.query(
      `SELECT status,token_hash,delivery_state FROM public.sf_story_invitations WHERE id=$1`,
      [invitation.id],
    )).rows[0];
    assert.deepEqual(pending, { status: 'draft', token_hash: tokenHash, delivery_state: 'ambiguous' });

    // A recipient using the already-accepted link establishes a truthful first-
    // party receipt even when the provider acceptance finalize was ambiguous.
    await asService(client, 'SELECT public.sf_guest_mark_visited($1)', [invitation.id]);
    pending = (await client.query(
      `SELECT status,token_hash,delivery_state,active_delivery_attempt_id
       FROM public.sf_story_invitations WHERE id=$1`,
      [invitation.id],
    )).rows[0];
    assert.equal(pending.status, 'link_visited');
    assert.equal(pending.token_hash, tokenHash);
    assert.equal(pending.delivery_state, null);
    assert.equal(pending.active_delivery_attempt_id, null);

    await asService(
      client,
      `SELECT public.sf_request_provider_event_resolve(
         'provider-durable','delivered','provider-event-durable',now(),NULL,$1,$2
       )`,
      [reserved.delivery_attempt_id, invitation.id],
    );
    const reconciled = (await client.query(
      `SELECT invitation.status,attempt.state,attempt.provider_message_id
       FROM public.sf_story_invitations invitation
       JOIN public.sf_story_invitation_delivery_attempts attempt ON attempt.invitation_id=invitation.id
       WHERE invitation.id=$1`,
      [invitation.id],
    )).rows[0];
    assert.deepEqual(reconciled, {
      status: 'link_visited',
      state: 'delivered',
      provider_message_id: 'provider-durable',
    });
    assert.equal((await client.query(
      `SELECT count(*)::integer AS count FROM public.sf_story_invitation_events
       WHERE invitation_id=$1 AND event_type='sent'`,
      [invitation.id],
    )).rows[0].count, 1);

    const direct = await createPreviewed(client, 'direct@example.test');
    reserved = (await asStudent(
      client,
      `SELECT public.sf_request_reserve_delivery($1,0,'initial',$2) AS payload`,
      [direct.id, sha256('direct-token')],
    )).rows[0].payload;
    await asService(client, 'SELECT public.sf_request_claim_delivery_attempt($1)', [reserved.delivery_attempt_id]);
    await asService(
      client,
      `SELECT public.sf_request_accept_delivery($1,'provider-direct','provider_response')`,
      [reserved.delivery_attempt_id],
    );
    await asService(
      client,
      `SELECT public.sf_request_accept_delivery($1,'provider-direct','provider_response')`,
      [reserved.delivery_attempt_id],
    );
    assert.equal((await client.query(
      `SELECT count(*)::integer AS count FROM public.sf_story_invitation_events
       WHERE invitation_id=$1 AND event_type='sent'`,
      [direct.id],
    )).rows[0].count, 1);

    const currentVersion = Number((await client.query(
      'SELECT row_version FROM public.sf_story_invitations WHERE id=$1', [direct.id],
    )).rows[0].row_version);
    const reminder = (await asStudent(
      client,
      `SELECT public.sf_request_reserve_delivery($1,$2,'reminder',$3) AS payload`,
      [direct.id, currentVersion, sha256('reminder-token')],
    )).rows[0].payload;
    await asService(client, 'SELECT public.sf_request_claim_delivery_attempt($1)', [reminder.delivery_attempt_id]);
    await asService(
      client,
      `SELECT public.sf_request_accept_delivery($1,'provider-reminder','provider_response')`,
      [reminder.delivery_attempt_id],
    );
    await asService(
      client,
      `SELECT public.sf_request_accept_delivery($1,'provider-reminder','provider_response')`,
      [reminder.delivery_attempt_id],
    );
    assert.equal((await client.query(
      'SELECT reminders_sent FROM public.sf_story_invitations WHERE id=$1', [direct.id],
    )).rows[0].reminders_sent, 1);
    assert.equal((await client.query(
      `SELECT count(*)::integer AS count FROM public.sf_story_invitation_events
       WHERE invitation_id=$1 AND event_type='reminded'`,
      [direct.id],
    )).rows[0].count, 1);

    const failed = await createPreviewed(client, 'failed@example.test');
    const failedReservation = (await asStudent(
      client,
      `SELECT public.sf_request_reserve_delivery($1,0,'initial',$2) AS payload`,
      [failed.id, sha256('failed-token')],
    )).rows[0].payload;
    await asService(client, 'SELECT public.sf_request_claim_delivery_attempt($1)', [failedReservation.delivery_attempt_id]);
    await asService(client, 'SELECT public.sf_request_mark_delivery_ambiguous($1)', [failedReservation.delivery_attempt_id]);
    await asService(
      client,
      `SELECT public.sf_request_fail_delivery($1,'operator_proven_absent','postmark-absence-receipt')`,
      [failedReservation.delivery_attempt_id],
    );
    const failedState = (await client.query(
      `SELECT token_hash,active_delivery_attempt_id,delivery_state,row_version
       FROM public.sf_story_invitations WHERE id=$1`,
      [failed.id],
    )).rows[0];
    assert.equal(failedState.token_hash, null);
    assert.equal(failedState.active_delivery_attempt_id, null);
    assert.equal(failedState.delivery_state, null);
    assert.equal(Number(failedState.row_version), 2);
    await asStudent(client, 'SELECT public.sf_request_preview($1,2)', [failed.id]);
    const replacementAttempt = (await asStudent(
      client,
      `SELECT public.sf_request_reserve_delivery($1,2,'initial',$2) AS payload`,
      [failed.id, sha256('replacement-token')],
    )).rows[0].payload;
    assert.equal(replacementAttempt.delivery_created, true);
    assert.notEqual(replacementAttempt.delivery_attempt_id, failedReservation.delivery_attempt_id);

    const terminal = await createPreviewed(client, 'terminal@example.test');
    const terminalInitial = (await asStudent(
      client,
      `SELECT public.sf_request_reserve_delivery($1,0,'initial',$2) AS payload`,
      [terminal.id, sha256('terminal-initial')],
    )).rows[0].payload;
    await asService(client, 'SELECT public.sf_request_claim_delivery_attempt($1)', [terminalInitial.delivery_attempt_id]);
    await asService(
      client,
      `SELECT public.sf_request_accept_delivery($1,'provider-terminal','provider_response')`,
      [terminalInitial.delivery_attempt_id],
    );
    const terminalVersion = Number((await client.query(
      'SELECT row_version FROM public.sf_story_invitations WHERE id=$1', [terminal.id],
    )).rows[0].row_version);
    const terminalReminder = (await asStudent(
      client,
      `SELECT public.sf_request_reserve_delivery($1,$2,'reminder',$3) AS payload`,
      [terminal.id, terminalVersion, sha256('terminal-reminder')],
    )).rows[0].payload;
    await asService(
      client,
      `SELECT public.sf_request_provider_event_resolve(
        'provider-terminal','bounced','provider-terminal-bounce',now(),'mailbox unavailable',$1,$2
      )`,
      [terminalInitial.delivery_attempt_id, terminal.id],
    );
    const terminalState = (await client.query(
      `SELECT invitation.status,invitation.token_hash,invitation.active_delivery_attempt_id,
              attempt.state,attempt.failure_reason
       FROM public.sf_story_invitations invitation
       JOIN public.sf_story_invitation_delivery_attempts attempt ON attempt.id=$2
       WHERE invitation.id=$1`,
      [terminal.id, terminalReminder.delivery_attempt_id],
    )).rows[0];
    assert.deepEqual(terminalState, {
      status: 'bounced',
      token_hash: null,
      active_delivery_attempt_id: null,
      state: 'abandoned',
      failure_reason: 'provider_bounce',
    });

    await assert.rejects(
      () => asService(
        client,
        `SELECT public.sf_request_provider_event_resolve(
           'provider-direct','delivered','mismatch-event',now(),NULL,$1,$2
         )`,
        [reserved.delivery_attempt_id, invitation.id],
      ),
      (error) => error.code === '42501',
    );

    await assert.rejects(
      () => withRole(client, 'authenticated', (roleClient) => roleClient.query(
        'SELECT * FROM public.sf_story_invitation_delivery_attempts',
      )),
      (error) => error.code === '42501',
    );
    await assert.rejects(
      () => withRole(client, 'storyforge_app', (roleClient) => roleClient.query(
        'UPDATE public.sf_story_invitation_delivery_attempts SET state=state',
      )),
      (error) => error.code === '42501',
    );
    await assert.rejects(
      () => asStudent(
        client,
        `SELECT public.sf_request_mark_sent($1,0,$2,'forged-provider')`,
        [invitation.id, sha256('forged')],
      ),
      (error) => error.code === '42501',
    );

    const columnNames = (await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='sf_story_invitation_delivery_attempts'`,
    )).rows.map((row) => row.column_name);
    assert.equal(columnNames.includes('token'), false);
    assert.equal(columnNames.includes('email'), false);
    assert.equal(columnNames.includes('body'), false);
  } finally {
    await database.stop();
  }
});

test('concurrent student reservations serialize to one durable attempt and one dispatch owner', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const peers = [];
  try {
    for (const migration of migrations) {
      await database.client.query(migrationSql(migration).replace(/^\\set .*$/gm, ''));
    }
    await database.client.query(
      `UPDATE public.sf_feature_flags SET scope='eligible_all' WHERE key='request_a_story'`,
    );
    const invitation = await createPreviewed(database.client, 'concurrent@example.test');
    for (let index = 0; index < 2; index += 1) {
      const client = new Client({
        host: database.socketDir,
        port: 5432,
        user: 'postgres',
        database: 'storyforge',
      });
      await client.connect();
      peers.push(client);
    }
    const results = await Promise.all(peers.map((client, index) => asStudent(
      client,
      `SELECT public.sf_request_reserve_delivery($1,0,'initial',$2) AS payload`,
      [invitation.id, sha256(`concurrent-${index}`)],
    )));
    const payloads = results.map((result) => result.rows[0].payload);
    assert.deepEqual(payloads.map((payload) => payload.delivery_created).sort(), [false, true]);
    assert.equal(new Set(payloads.map((payload) => payload.delivery_attempt_id)).size, 1);
    assert.equal((await database.client.query(
      'SELECT count(*)::integer AS count FROM public.sf_story_invitation_delivery_attempts WHERE invitation_id=$1',
      [invitation.id],
    )).rows[0].count, 1);
  } finally {
    await Promise.all(peers.map((client) => client.end().catch(() => {})));
    await database.stop();
  }
});
