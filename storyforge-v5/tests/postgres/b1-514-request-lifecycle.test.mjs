import assert from 'node:assert/strict';
import test from 'node:test';

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
];
const tokenA = 'a'.repeat(64);
const tokenB = 'b'.repeat(64);
const tokenC = 'c'.repeat(64);
const tokenD = 'd'.repeat(64);

async function asStudent(client, sql, values = []) {
  return withIdentity(client, STUDENT, (identityClient) => identityClient.query(sql, values));
}

async function createDraft(client, email, first = 'Pat') {
  return (await asStudent(
    client,
    `SELECT public.sf_request_create($1,'parent',$2,'One bounded moment, please.','founder-v1') AS payload`,
    [first, email],
  )).rows[0].payload;
}

test('Request-a-Story lifecycle is versioned, monotonic, append-only, suppressible, and default-off', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    for (const migration of migrations) {
      await client.query(migrationSql(migration).replace(/^\\set .*$/gm, ''));
    }

    const flags = await client.query(
      `SELECT key,scope FROM public.sf_feature_flags
       WHERE key IN ('request_a_story','guest_contributions') ORDER BY key`,
    );
    assert.deepEqual(flags.rows, [
      { key: 'guest_contributions', scope: 'off' },
      { key: 'request_a_story', scope: 'off' },
    ]);
    await client.query(
      `UPDATE public.sf_feature_flags SET scope='eligible_all'
       WHERE key IN ('request_a_story','guest_contributions')`,
    );

    let invitation = await createDraft(client, 'pat@example.test');
    const invitationId = invitation.id;
    assert.equal(invitation.status, 'draft');

    invitation = (await asStudent(
      client,
      `SELECT public.sf_request_update($1,0,'Patricia','parent','patricia@example.test','Updated bounded moment.') AS payload`,
      [invitationId],
    )).rows[0].payload;
    assert.equal(invitation.row_version, 1);
    assert.equal(invitation.previewed_at, null);

    await assert.rejects(
      () => asStudent(client, 'SELECT public.sf_request_prepare_send($1,1)', [invitationId]),
      (error) => error.code === '40001',
    );
    let preview = (await asStudent(
      client,
      'SELECT public.sf_request_preview($1,1) AS payload',
      [invitationId],
    )).rows[0].payload;
    assert.equal(preview.previewed_row_version, 1);
    assert.equal(typeof preview.preview_event_id, 'string');

    invitation = (await asStudent(
      client,
      `SELECT public.sf_request_update($1,1,'Patricia','parent','patricia@example.test','Final bounded moment.') AS payload`,
      [invitationId],
    )).rows[0].payload;
    assert.equal(invitation.row_version, 2);
    assert.equal(invitation.previewed_at, null);
    preview = (await asStudent(client, 'SELECT public.sf_request_preview($1,2) AS payload', [invitationId])).rows[0].payload;
    assert.equal(preview.previewed_row_version, 2);

    invitation = (await asStudent(
      client,
      'SELECT public.sf_request_mark_sent($1,2,$2,$3) AS payload',
      [invitationId, tokenA, 'provider-initial'],
    )).rows[0].payload;
    assert.equal(invitation.status, 'sent');
    assert.equal(invitation.row_version, 3);

    await client.query(
      `SELECT public.sf_request_provider_event('provider-initial','delivered','event-delivered',now(),NULL)`,
    );
    assert.equal((await client.query('SELECT status FROM public.sf_story_invitations WHERE id=$1', [invitationId])).rows[0].status, 'delivered');

    let prepared = (await asStudent(client, 'SELECT public.sf_request_prepare_reminder($1,3) AS payload', [invitationId])).rows[0].payload;
    assert.equal(prepared.reminders_sent, 0);
    invitation = (await asStudent(
      client,
      'SELECT public.sf_request_mark_reminded($1,3,$2,$3) AS payload',
      [invitationId, tokenB, 'provider-reminder-1'],
    )).rows[0].payload;
    assert.equal(invitation.reminders_sent, 1);
    invitation = (await asStudent(
      client,
      'SELECT public.sf_request_mark_reminded($1,4,$2,$3) AS payload',
      [invitationId, tokenC, 'provider-reminder-2'],
    )).rows[0].payload;
    assert.equal(invitation.reminders_sent, 2);
    await assert.rejects(
      () => asStudent(client, 'SELECT public.sf_request_prepare_reminder($1,5)', [invitationId]),
      (error) => error.code === '40001',
    );

    await client.query('SELECT public.sf_guest_mark_visited($1)', [invitationId]);
    await client.query('SELECT public.sf_guest_mark_started($1)', [invitationId]);
    await client.query('SELECT public.sf_guest_mark_started($1)', [invitationId]);
    let state = (await client.query(
      `SELECT status,link_visited_at IS NOT NULL AS visited,started_at IS NOT NULL AS started
       FROM public.sf_story_invitations WHERE id=$1`,
      [invitationId],
    )).rows[0];
    assert.deepEqual(state, { status: 'started', visited: true, started: true });
    assert.equal((await client.query(
      `SELECT count(*)::integer AS count FROM public.sf_story_invitation_events
       WHERE invitation_id=$1 AND event_type='started'`,
      [invitationId],
    )).rows[0].count, 1);

    await client.query(
      `SELECT public.sf_request_provider_event('provider-initial','bounced','event-bounced',now(),'mailbox unavailable')`,
    );
    invitation = (await client.query(
      'SELECT * FROM public.sf_story_invitations WHERE id=$1',
      [invitationId],
    )).rows[0];
    assert.equal(invitation.status, 'bounced');
    assert.equal(invitation.token_hash, null);

    await assert.rejects(
      () => asStudent(
        client,
        'SELECT public.sf_request_reinvite($1,$2,$3)',
        [invitationId, invitation.row_version, 'patricia@example.test'],
      ),
      (error) => error.code === '42501',
    );
    const replacement = (await asStudent(
      client,
      'SELECT public.sf_request_reinvite($1,$2,$3) AS payload',
      [invitationId, invitation.row_version, 'replacement@example.test'],
    )).rows[0].payload;
    assert.equal(replacement.status, 'draft');
    assert.equal(replacement.reinvited_from_id, invitationId);
    assert.notEqual(replacement.id, invitationId);
    await assert.rejects(
      () => asStudent(
        client,
        'SELECT public.sf_request_reinvite($1,$2,$3)',
        [invitationId, invitation.row_version, 'another@example.test'],
      ),
      (error) => error.code === '23505',
    );

    await asStudent(client, 'SELECT public.sf_request_preview($1,0)', [replacement.id]);
    await asStudent(
      client,
      'SELECT public.sf_request_mark_sent($1,0,$2,$3)',
      [replacement.id, tokenD, 'provider-replacement'],
    );
    await client.query(
      `SELECT public.sf_request_provider_event('provider-replacement','complained','event-complaint',now(),'spam complaint')`,
    );
    const complained = (await client.query(
      'SELECT suppressed_at,suppression_reason,token_hash FROM public.sf_story_invitations WHERE id=$1',
      [replacement.id],
    )).rows[0];
    assert.ok(complained.suppressed_at);
    assert.equal(complained.suppression_reason, 'spam_complaint');
    assert.equal(complained.token_hash, null);
    const suppression = await client.query('SELECT * FROM public.sf_story_invitation_suppressions');
    assert.equal(suppression.rowCount, 1);
    assert.match(suppression.rows[0].email_hash, /^[a-f0-9]{64}$/);
    assert.equal(Object.hasOwn(suppression.rows[0], 'email'), false);
    await assert.rejects(
      () => createDraft(client, 'REPLACEMENT@example.test'),
      (error) => error.code === '42501',
    );

    const expiring = await createDraft(client, 'expiring@example.test', 'Alex');
    await asStudent(client, 'SELECT public.sf_request_preview($1,0)', [expiring.id]);
    await asStudent(
      client,
      'SELECT public.sf_request_mark_sent($1,0,$2,$3)',
      [expiring.id, 'e'.repeat(64), 'provider-expiring'],
    );
    await client.query(
      `UPDATE public.sf_story_invitations SET expires_at=now()-interval '1 minute' WHERE id=$1`,
      [expiring.id],
    );
    assert.equal((await client.query('SELECT public.sf_request_expire_due(100) AS count')).rows[0].count, 1);
    state = (await client.query(
      'SELECT status,token_hash FROM public.sf_story_invitations WHERE id=$1',
      [expiring.id],
    )).rows[0];
    assert.deepEqual(state, { status: 'expired', token_hash: null });

    const event = (await client.query(
      'SELECT id FROM public.sf_story_invitation_events WHERE invitation_id=$1 LIMIT 1',
      [invitationId],
    )).rows[0];
    await assert.rejects(
      () => client.query("UPDATE public.sf_story_invitation_events SET detail='{}'::jsonb WHERE id=$1", [event.id]),
      (error) => error.code === '42501',
    );

    const posture = await client.query(
      `SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class
       WHERE relname IN ('sf_story_invitation_suppressions','sf_story_invitation_provider_messages')
       ORDER BY relname`,
    );
    assert.equal(posture.rowCount, 2);
    assert.ok(posture.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity));
    await assert.rejects(
      () => withRole(client, 'authenticated', (identityClient) => identityClient.query(
        'SELECT * FROM public.sf_story_invitation_suppressions',
      )),
      (error) => error.code === '42501',
    );
  } finally {
    await database.stop();
  }
});
