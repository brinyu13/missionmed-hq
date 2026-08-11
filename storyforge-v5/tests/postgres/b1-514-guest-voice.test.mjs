import assert from 'node:assert/strict';
import pg from 'pg';
import test from 'node:test';

import {
  migrationSql,
  startEphemeralStoryForgeDatabase,
  withIdentity,
  withRole,
} from './helpers/ephemeral-postgres.mjs';

const { Client } = pg;
const STUDENT = {
  sub: '11111111-1111-4111-8111-111111111111', role: 'student', wpUserId: 1101,
};
const OTHER = {
  sub: '22222222-2222-4222-8222-222222222222', role: 'student', wpUserId: 1102,
};
const promptId = '44444444-4444-4444-8444-444444444444';
const migrations = [
  '20260810190000_b1_514_v2_r1_visibility_consent_activity.sql',
  '20260810200000_b1_514_v2_r2_story_versions_provenance.sql',
  '20260810210000_b1_514_v2_r3_inspiration.sql',
  '20260810220000_b1_514_v2_ra_requests_guest.sql',
  '20260810230000_b1_514_v2_preferences_environments.sql',
  '20260810240000_b1_514_v2_ra_lifecycle_completion.sql',
  '20260810250000_b1_514_v21_authored_segment_writes.sql',
  '20260810260000_b1_514_guest_voice_contributions.sql',
];

async function service(client, sql, values = []) {
  return withRole(client, 'storyforge_app', (roleClient) => roleClient.query(sql, values));
}

async function invitation(client, tokenHash, overrides = {}) {
  const result = await client.query(
    `INSERT INTO public.sf_story_invitations(
      student_id,contributor_first_name,relationship_id,email,token_hash,status,
      personal_message,disclosure_version,expires_at,revoked_at,suppressed_at,suppression_reason
    ) VALUES($1,'Pat','parent',$2,$3,$4,'','founder-v1',$5,$6,$7,$8) RETURNING *`,
    [
      STUDENT.sub,
      `${tokenHash.slice(0, 8)}@example.test`,
      tokenHash,
      overrides.status || 'started',
      overrides.expiresAt || new Date(Date.now() + 86_400_000),
      overrides.revokedAt || null,
      overrides.suppressedAt || null,
      overrides.suppressionReason || null,
    ],
  );
  return result.rows[0];
}

async function textContribution(client, invitationId, text = 'A remembered moment.') {
  return (await service(
    client,
    `SELECT public.sf_guest_contribute(
      $1,'text',$2,$3,'Tell me about a bounded memory.'
    ) AS payload`,
    [invitationId, text, promptId],
  )).rows[0].payload;
}

test('guest voice is token-scoped, capped, idempotent, and preserves audio through promotion', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    for (const migration of migrations) {
      await client.query(migrationSql(migration).replace(/^\\set .*$/gm, ''));
    }
    await client.query(
      `INSERT INTO public.sf_contributor_prompts(
        id,library_key,relationship_ids,text,hint,sort_order
      ) VALUES($1,'c-999',ARRAY['parent'],'Tell me about a bounded memory.','One moment.',1)`,
      [promptId],
    );
    const tokenHash = 'a'.repeat(64);
    const active = await invitation(client, tokenHash);

    await assert.rejects(
      service(client, 'SELECT public.sf_guest_voice_open($1)', [tokenHash]),
      (error) => error.code === 'P0002',
    );
    await client.query(
      `UPDATE public.sf_feature_flags SET scope='eligible_all'
       WHERE key IN ('request_a_story','guest_contributions','voice_capture')`,
    );

    const opened = (await service(
      client,
      'SELECT public.sf_guest_voice_open($1) AS payload',
      [tokenHash],
    )).rows[0].payload;
    assert.equal(opened.studentId, STUDENT.sub);
    assert.equal((await client.query('SELECT count(*)::integer AS count FROM public.sf_stories')).rows[0].count, 0);
    const recordingId = opened.recordingId;
    const segmentKey = `storyforge-rec/${STUDENT.sub}/${recordingId}/seg-00000.webm`;
    await service(
      client,
      'SELECT public.sf_guest_voice_reserve_segment($1,$2,0,$3,$4,6,4000)',
      [tokenHash, recordingId, segmentKey, 'audio/webm'],
    );
    await service(client, 'SELECT public.sf_guest_voice_confirm_segment($1,$2,0)', [tokenHash, recordingId]);
    const claim = (await service(
      client,
      'SELECT public.sf_guest_voice_claim_transcription($1,$2,0) AS payload',
      [tokenHash, recordingId],
    )).rows[0].payload;
    assert.equal(claim.objectKey, segmentKey);
    await service(
      client,
      `SELECT public.sf_guest_voice_complete_transcription(
        $1,$2,0,'Provider original memory.','bounded-provider','bounded-model'
      )`,
      [tokenHash, recordingId],
    );
    const prepared = (await service(
      client,
      'SELECT public.sf_guest_voice_prepare_finish($1,$2,$3) AS payload',
      [tokenHash, recordingId, promptId],
    )).rows[0].payload;
    assert.equal(prepared.providerTranscript, 'Provider original memory.');
    assert.equal((await service(
      client,
      'SELECT count(*)::integer AS count FROM public.sf_guest_voice_assembly_manifest($1)',
      [recordingId],
    )).rows[0].count, 1);

    const contributionId = '55555555-5555-4555-8555-555555555555';
    const assetId = '66666666-6666-4666-8666-666666666666';
    const objectKey = `storyforge-contribution-audio/${STUDENT.sub}/${active.id}/${contributionId}/${assetId}.webm`;
    const completed = (await service(
      client,
      `SELECT public.sf_guest_voice_complete(
        $1,$2,$3,$4,'Reviewed guest memory.',$5,'audio/webm',6,4000,$6
      ) AS payload`,
      [tokenHash, recordingId, contributionId, assetId, objectKey, 'b'.repeat(64)],
    )).rows[0].payload;
    assert.equal(completed.kind, 'voice');
    assert.equal((await client.query('SELECT count(*)::integer AS count FROM public.sf_stories')).rows[0].count, 0);
    const assetBefore = (await client.query(
      'SELECT object_key,state FROM public.sf_contribution_audio_assets WHERE id=$1',
      [assetId],
    )).rows[0];
    assert.deepEqual(assetBefore, { object_key: objectKey, state: 'verified' });
    const playback = (await withIdentity(client, STUDENT, (identityClient) => identityClient.query(
      'SELECT public.sf_contribution_audio_playback_claim($1) AS payload',
      [contributionId],
    ))).rows[0].payload;
    assert.deepEqual(playback, {
      assetId,
      contributionId,
      objectKey,
      contentType: 'audio/webm',
      durationMs: 4000,
      byteSize: 6,
    });
    await assert.rejects(
      withIdentity(client, OTHER, (identityClient) => identityClient.query(
        'SELECT public.sf_contribution_audio_playback_claim($1)',
        [contributionId],
      )),
      (error) => error.code === 'P0002',
    );

    const retried = (await service(
      client,
      `SELECT public.sf_guest_voice_complete(
        $1,$2,$3,$4,'Reviewed guest memory.',$5,'audio/webm',6,4000,$6
      ) AS payload`,
      [tokenHash, recordingId, contributionId, assetId, objectKey, 'b'.repeat(64)],
    )).rows[0].payload;
    assert.equal(retried.existing, true);
    assert.equal((await client.query(
      'SELECT count(*)::integer AS count FROM public.sf_story_contributions WHERE invitation_id=$1',
      [active.id],
    )).rows[0].count, 1);

    const promoted = (await withIdentity(client, STUDENT, async (identityClient) => identityClient.query(
      "SELECT public.sf_request_promote($1,'A contributed memory') AS payload",
      [contributionId],
    ))).rows[0].payload;
    const assetAfter = (await client.query(
      `SELECT asset.object_key,asset.state,contribution.promoted_story_id
       FROM public.sf_contribution_audio_assets asset
       JOIN public.sf_story_contributions contribution ON contribution.id=asset.contribution_id
       WHERE asset.id=$1`,
      [assetId],
    )).rows[0];
    assert.deepEqual(assetAfter, {
      object_key: objectKey,
      state: 'verified',
      promoted_story_id: promoted.storyId,
    });

    const foreign = await invitation(client, 'f'.repeat(64));
    await assert.rejects(
      service(client, 'SELECT public.sf_guest_voice_status($1,$2)', ['f'.repeat(64), recordingId]),
      (error) => error.code === 'P0002',
    );
    assert.ok(foreign.id);

    const capped = await invitation(client, 'c'.repeat(64));
    const first = await textContribution(client, capped.id, 'Same retry-safe memory.');
    const retry = await textContribution(client, capped.id, 'Same retry-safe memory.');
    assert.equal(retry.id, first.id);
    assert.equal(retry.existing, true);
    await textContribution(client, capped.id, 'Second distinct memory.');
    await textContribution(client, capped.id, 'Third distinct memory.');
    await assert.rejects(
      textContribution(client, capped.id, 'Fourth distinct memory.'),
      (error) => error.code === 'P0003',
    );
    assert.equal((await client.query(
      'SELECT count(*)::integer AS count FROM public.sf_story_contributions WHERE invitation_id=$1',
      [capped.id],
    )).rows[0].count, 3);

    const revoked = await invitation(client, 'd'.repeat(64), {
      status: 'revoked', revokedAt: new Date(),
    });
    const expired = await invitation(client, 'e'.repeat(64), {
      status: 'expired', expiresAt: new Date(Date.now() - 60_000),
    });
    for (const [hash, row] of [['d'.repeat(64), revoked], ['e'.repeat(64), expired]]) {
      await assert.rejects(
        service(client, 'SELECT public.sf_guest_voice_open($1)', [hash]),
        (error) => error.code === 'P0002',
      );
      await assert.rejects(
        textContribution(client, row.id, 'Hostile late write.'),
        (error) => error.code === 'P0002',
      );
    }

    const bounded = await invitation(client, '9'.repeat(64));
    const boundedSession = (await service(
      client,
      'SELECT public.sf_guest_voice_open($1) AS payload',
      ['9'.repeat(64)],
    )).rows[0].payload;
    await client.query(
      `UPDATE public.sf_guest_voice_sessions
       SET total_duration_ms=1799000,total_byte_size=31457280
       WHERE id=$1`,
      [boundedSession.recordingId],
    );
    const boundedKey = `storyforge-rec/${STUDENT.sub}/${boundedSession.recordingId}/seg-00000.webm`;
    await assert.rejects(
      service(
        client,
        'SELECT public.sf_guest_voice_reserve_segment($1,$2,0,$3,$4,1,2000)',
        ['9'.repeat(64), boundedSession.recordingId, boundedKey, 'audio/webm'],
      ),
      (error) => error.code === '22023',
    );
    assert.ok(bounded.id);

    const concurrent = await invitation(client, '8'.repeat(64));
    const clients = [0, 1].map(() => new Client({
      host: database.socketDir, port: 5432, user: 'postgres', database: 'storyforge',
    }));
    await Promise.all(clients.map((connection) => connection.connect()));
    try {
      const writes = clients.map(async (connection) => {
        await connection.query('BEGIN');
        await connection.query('SET LOCAL ROLE storyforge_app');
        try {
          const result = await connection.query(
            `SELECT public.sf_guest_contribute(
              $1,'text','Concurrent retry memory.',$2,'Tell me about a bounded memory.'
            ) AS payload`,
            [concurrent.id, promptId],
          );
          await connection.query('COMMIT');
          return result.rows[0].payload;
        } catch (error) {
          await connection.query('ROLLBACK');
          throw error;
        }
      });
      const results = await Promise.all(writes);
      assert.equal(new Set(results.map((row) => row.id)).size, 1);
      assert.deepEqual(results.map((row) => row.existing).sort(), [false, true]);
    } finally {
      await Promise.all(clients.map((connection) => connection.end()));
    }
    assert.equal((await client.query(
      'SELECT count(*)::integer AS count FROM public.sf_story_contributions WHERE invitation_id=$1',
      [concurrent.id],
    )).rows[0].count, 1);
  } finally {
    await database.stop();
  }
});
