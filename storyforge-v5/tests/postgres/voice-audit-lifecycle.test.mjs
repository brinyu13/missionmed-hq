import assert from 'node:assert/strict';
import test from 'node:test';

import {
  startEphemeralStoryForgeDatabase,
  withIdentity,
  withRole,
} from './helpers/ephemeral-postgres.mjs';

const STUDENT_A = Object.freeze({
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'student',
  wpUserId: 1101,
});
const STUDENT_B = Object.freeze({
  sub: '22222222-2222-4222-8222-222222222222',
  role: 'student',
  wpUserId: 1102,
});
const MENTOR = Object.freeze({
  sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'mentor',
  wpUserId: 2101,
});
const ADMIN = Object.freeze({
  sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  role: 'admin',
  wpUserId: 3101,
});
const INELIGIBLE_ADMIN = Object.freeze({
  ...ADMIN,
  eligible: false,
});

const ids = Object.freeze({
  auditSessionA: '31000000-0000-4000-8000-000000000001',
  auditSessionB: '31000000-0000-4000-8000-000000000002',
  sweepAbandoned: '32000000-0000-4000-8000-000000000001',
  sweepDraftProtected: '32000000-0000-4000-8000-000000000002',
  sweepAttached: '32000000-0000-4000-8000-000000000003',
  sweepFailedEmpty: '32000000-0000-4000-8000-000000000004',
  sweepFinishing: '32000000-0000-4000-8000-000000000005',
  sweepFailedWithSegment: '32000000-0000-4000-8000-000000000006',
  attachVerified: '33000000-0000-4000-8000-000000000001',
  attachFailed: '33000000-0000-4000-8000-000000000002',
  attachRetired: '33000000-0000-4000-8000-000000000003',
  attachAtomicFailure: '33000000-0000-4000-8000-000000000004',
});

async function insertSession(client, {
  id,
  studentId = STUDENT_A.sub,
  state = 'recording',
  mimeType = 'audio/webm',
  totalDurationMs = 0,
  segmentCount = 0,
  lastActivityAt = new Date(),
  updatedAt = new Date(),
}) {
  await client.query(
    `INSERT INTO public.sf_recording_sessions (
       id, student_id, state, mime_type, total_duration_ms, segment_count,
       last_activity_at, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8)`,
    [
      id,
      studentId,
      state,
      mimeType,
      totalDurationMs,
      segmentCount,
      lastActivityAt,
      updatedAt,
    ],
  );
}

async function insertSegment(client, {
  id,
  sessionId,
  seq = 0,
  objectKey,
  transcript = 'Synthetic transcript used only by the isolated authorization test.',
  transcribeState = 'transcribed',
  durationMs = 4_000,
}) {
  await client.query(
    `INSERT INTO public.sf_recording_segments (
       id, session_id, seq, object_key, mime_type, byte_size, duration_ms,
       transcribe_state, transcript
     )
     VALUES ($1, $2, $3, $4, 'audio/webm', 256, $5, $6, $7)`,
    [id, sessionId, seq, objectKey, durationMs, transcribeState, transcript],
  );
}

async function createAudioStory(client, identity, suffix) {
  return withIdentity(client, identity, async (identityClient) => {
    const result = await identityClient.query(
      `SELECT (public.sf_create_story_v5($1::jsonb, 'quick')).*`,
      [JSON.stringify({
        captureType: 'audio',
        title: `Voice lifecycle ${suffix}`,
        text: `Reviewed transcript ${suffix}`,
      })],
    );
    return result.rows[0];
  });
}

async function attachRecording(client, identity, storyId, sessionId) {
  return withIdentity(client, identity, async (identityClient) => {
    const result = await identityClient.query(
      `SELECT *
       FROM public.sf_attach_recording($1::uuid, $2::uuid, 'audio/webm')`,
      [storyId, sessionId],
    );
    return result.rows[0];
  });
}

test('bounded audit writers enforce disjoint grants, vocabulary, payload, identity, and ownership', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    await insertSession(client, {
      id: ids.auditSessionA,
      studentId: STUDENT_A.sub,
      state: 'finishing',
    });
    await insertSession(client, {
      id: ids.auditSessionB,
      studentId: STUDENT_B.sub,
      state: 'finishing',
    });

    const grants = await client.query(
      `SELECT routine_name, grantee
       FROM information_schema.routine_privileges
       WHERE specific_schema = 'public'
         AND routine_name IN (
           'sf_append_voice_audit',
           'sf_append_voice_audit_service',
           'sf_voice_sweep_candidates',
           'sf_voice_sweep_purge',
           'sf_voice_asset_pending_candidates',
           'sf_voice_asset_mark_verified',
           'sf_voice_asset_mark_failed',
           'sf_voice_audio_reference_check',
           'sf_retire_story_audio',
           'sf_attach_recording'
         )
         AND grantee IN ('authenticated', 'storyforge_app', 'PUBLIC')
       ORDER BY routine_name, grantee`,
    );
    assert.deepEqual(grants.rows, [
      { routine_name: 'sf_append_voice_audit', grantee: 'authenticated' },
      { routine_name: 'sf_append_voice_audit_service', grantee: 'storyforge_app' },
      { routine_name: 'sf_attach_recording', grantee: 'authenticated' },
      { routine_name: 'sf_retire_story_audio', grantee: 'authenticated' },
      { routine_name: 'sf_voice_asset_mark_failed', grantee: 'storyforge_app' },
      { routine_name: 'sf_voice_asset_mark_verified', grantee: 'storyforge_app' },
      { routine_name: 'sf_voice_asset_pending_candidates', grantee: 'storyforge_app' },
      { routine_name: 'sf_voice_audio_reference_check', grantee: 'storyforge_app' },
      { routine_name: 'sf_voice_sweep_candidates', grantee: 'storyforge_app' },
      { routine_name: 'sf_voice_sweep_purge', grantee: 'storyforge_app' },
    ]);

    const authenticatedAuditId = await withIdentity(
      client,
      STUDENT_A,
      async (identityClient) => {
        const result = await identityClient.query(
          `SELECT public.sf_append_voice_audit(
             'recording_finished', 'recording_session', $1, 'quick',
             $2, NULL, '{"state":"recording"}', '{"state":"finishing"}'
           ) AS id`,
          [ids.auditSessionA, STUDENT_A.sub],
        );
        return result.rows[0].id;
      },
    );
    assert.ok(Number(authenticatedAuditId) > 0);

    const serviceAuditId = await withRole(client, 'storyforge_app', async (serviceClient) => {
      const result = await serviceClient.query(
        `SELECT public.sf_append_voice_audit_service(
           'assembly_failed', 'recording_session', $1, $2, NULL,
           '{"state":"finishing"}',
           '{"state":"failed","errorCategory":"assembly"}'
         ) AS id`,
        [ids.auditSessionA, STUDENT_A.sub],
      );
      return result.rows[0].id;
    });
    assert.ok(Number(serviceAuditId) > Number(authenticatedAuditId));
    await assert.rejects(
      withRole(client, 'storyforge_app', (serviceClient) => serviceClient.query(
        `SELECT public.sf_append_voice_audit_service(
           'assembly_failed', 'recording_session', $1, $2, NULL,
           '{"state":"finishing"}',
           '{"state":"failed","errorCategory":"private-provider-detail"}'
         )`,
        [ids.auditSessionA, STUDENT_A.sub],
      )),
      (error) => error.code === '22023',
    );

    await assert.rejects(
      withIdentity(client, STUDENT_A, (identityClient) => identityClient.query(
        `SELECT public.sf_append_voice_audit_service(
           'recording_cancelled', 'recording_session', $1, $2
         )`,
        [ids.auditSessionA, STUDENT_A.sub],
      )),
      (error) => error.code === '42501',
    );
    await assert.rejects(
      withRole(client, 'storyforge_app', (serviceClient) => serviceClient.query(
        `SELECT public.sf_append_voice_audit(
           'recording_finished', 'recording_session', $1, 'quick', $2
         )`,
        [ids.auditSessionA, STUDENT_A.sub],
      )),
      (error) => error.code === '42501',
    );

    await assert.rejects(
      withIdentity(client, STUDENT_A, (identityClient) => identityClient.query(
        `SELECT public.sf_append_voice_audit(
           'story_text_logged', 'recording_session', $1, 'quick', $2
         )`,
        [ids.auditSessionA, STUDENT_A.sub],
      )),
      (error) => error.code === '22023',
    );
    await assert.rejects(
      withIdentity(client, STUDENT_A, (identityClient) => identityClient.query(
        `SELECT public.sf_append_voice_audit(
           'recording_finished', 'recording_session', $1, 'quick', $2,
           NULL, NULL, '{"transcript":"forbidden"}'
         )`,
        [ids.auditSessionA, STUDENT_A.sub],
      )),
      (error) => error.code === '22023',
    );
    await assert.rejects(
      withIdentity(client, STUDENT_A, (identityClient) => identityClient.query(
        `SELECT public.sf_append_voice_audit(
           'recording_finished', 'recording_session', $1, 'quick', $2
         )`,
        [ids.auditSessionA, STUDENT_B.sub],
      )),
      (error) => error.code === '42501',
    );
    await assert.rejects(
      withIdentity(client, MENTOR, (identityClient) => identityClient.query(
        `SELECT public.sf_append_voice_audit(
           'recording_finished', 'recording_session', $1, 'quick', $2
         )`,
        [ids.auditSessionA, MENTOR.sub],
      )),
      (error) => error.code === '42501',
    );
    await assert.rejects(
      withIdentity(client, STUDENT_A, (identityClient) => identityClient.query(
        `SELECT public.sf_append_voice_audit(
           'recording_finished', 'recording_session', $1, 'quick', $2
         )`,
        [ids.auditSessionB, STUDENT_A.sub],
      )),
      (error) => error.code === '42501',
    );

    const allowlist = Array.from(
      { length: 50 },
      (_, index) => `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    );
    const cohorts = Array.from(
      { length: 20 },
      (_, index) => `C${String(index + 1).padStart(2, '0')}`,
    );
    await withIdentity(client, ADMIN, (identityClient) => identityClient.query(
      `SELECT public.sf_append_voice_audit(
         'feature_scope_changed', 'feature_flag', NULL, 'system', NULL, NULL,
         '{"scope":"off"}'::jsonb, $1::jsonb
       )`,
      [JSON.stringify({ scope: 'allowlist', allowlist, cohorts })],
    ));

    const featureTail = await withIdentity(client, ADMIN, async (identityClient) => {
      const result = await identityClient.query(
        'SELECT * FROM public.sf_feature_audit_tail(50)',
      );
      return result.rows;
    });
    assert.ok(featureTail.some((row) => row.action === 'feature_scope_changed'));
    assert.equal(Object.hasOwn(featureTail[0], 'actor_display'), false);
    assert.equal(Object.hasOwn(featureTail[0], 'student_id'), false);

    const errorSummary = await withIdentity(client, ADMIN, async (identityClient) => {
      const result = await identityClient.query(
        'SELECT * FROM public.sf_voice_error_summary()',
      );
      return result.rows;
    });
    assert.deepEqual(errorSummary, [{ error_category: 'assembly', count: 1 }]);

    for (const identity of [MENTOR, STUDENT_A, INELIGIBLE_ADMIN]) {
      await assert.rejects(
        withIdentity(client, identity, (identityClient) => identityClient.query(
          'SELECT * FROM public.sf_feature_audit_tail(20)',
        )),
        (error) => error.code === '42501',
      );
      await assert.rejects(
        withIdentity(client, identity, (identityClient) => identityClient.query(
          'SELECT * FROM public.sf_voice_error_summary()',
        )),
        (error) => error.code === '42501',
      );
    }
    await assert.rejects(
      withRole(client, 'storyforge_app', (serviceClient) => serviceClient.query(
        'SELECT * FROM public.sf_feature_audit_tail(20)',
      )),
      (error) => error.code === '42501',
    );
    await assert.rejects(
      withRole(client, 'storyforge_app', (serviceClient) => serviceClient.query(
        'SELECT * FROM public.sf_voice_error_summary()',
      )),
      (error) => error.code === '42501',
    );
  } finally {
    await database.stop();
  }
});

test('sweeps exclude live drafts, attached rows, and empty failures and purge transcripts atomically', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  const old24 = new Date(Date.now() - (25 * 60 * 60 * 1000));
  const old72 = new Date(Date.now() - (73 * 60 * 60 * 1000));
  try {
    await insertSession(client, {
      id: ids.sweepAbandoned,
      studentId: STUDENT_A.sub,
      state: 'recording',
      segmentCount: 1,
      lastActivityAt: old24,
      updatedAt: old24,
    });
    await insertSegment(client, {
      id: '32100000-0000-4000-8000-000000000001',
      sessionId: ids.sweepAbandoned,
      objectKey: `storyforge-rec/${STUDENT_A.sub}/${ids.sweepAbandoned}/seg-00000.webm`,
    });
    await insertSession(client, {
      id: ids.sweepDraftProtected,
      studentId: STUDENT_B.sub,
      state: 'recording',
      segmentCount: 1,
      lastActivityAt: old24,
      updatedAt: old24,
    });
    await insertSegment(client, {
      id: '32100000-0000-4000-8000-000000000002',
      sessionId: ids.sweepDraftProtected,
      objectKey: `storyforge-rec/${STUDENT_B.sub}/${ids.sweepDraftProtected}/seg-00000.webm`,
    });
    await client.query(
      `INSERT INTO public.sf_story_drafts (user_id, payload, updated_at)
       VALUES ($1, '{"voiceReview":true}', now())
       ON CONFLICT (user_id) DO UPDATE
       SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at`,
      [STUDENT_B.sub],
    );
    await insertSession(client, {
      id: ids.sweepAttached,
      state: 'attached',
      lastActivityAt: old72,
      updatedAt: old72,
    });
    await insertSession(client, {
      id: ids.sweepFailedEmpty,
      state: 'failed',
      lastActivityAt: old24,
      updatedAt: old24,
    });
    await insertSession(client, {
      id: ids.sweepFinishing,
      state: 'finishing',
      segmentCount: 1,
      lastActivityAt: old72,
      updatedAt: old72,
    });
    await insertSegment(client, {
      id: '32100000-0000-4000-8000-000000000005',
      sessionId: ids.sweepFinishing,
      objectKey: `storyforge-rec/${STUDENT_A.sub}/${ids.sweepFinishing}/seg-00000.webm`,
      transcript: 'This transcript must be erased by the finishing-session purge.',
    });
    await insertSession(client, {
      id: ids.sweepFailedWithSegment,
      state: 'failed',
      segmentCount: 1,
      lastActivityAt: old24,
      updatedAt: old24,
    });
    await insertSegment(client, {
      id: '32100000-0000-4000-8000-000000000006',
      sessionId: ids.sweepFailedWithSegment,
      objectKey: `storyforge-rec/${STUDENT_A.sub}/${ids.sweepFailedWithSegment}/seg-00000.webm`,
    });

    const candidates = await withRole(client, 'storyforge_app', async (serviceClient) => {
      const result = await serviceClient.query(
        'SELECT * FROM public.sf_voice_sweep_candidates(100)',
      );
      return result.rows;
    });
    const byId = new Map(candidates.map((row) => [row.session_id, row.reason]));
    assert.equal(byId.get(ids.sweepAbandoned), 'abandoned_24h');
    assert.equal(byId.get(ids.sweepFinishing), 'save_never_completed_72h');
    assert.equal(byId.get(ids.sweepFailedWithSegment), 'failed_24h');
    assert.equal(byId.has(ids.sweepDraftProtected), false);
    assert.equal(byId.has(ids.sweepAttached), false);
    assert.equal(byId.has(ids.sweepFailedEmpty), false);

    await client.query(
      `UPDATE public.sf_recording_sessions
       SET last_activity_at = now(), updated_at = now()
       WHERE id = $1`,
      [ids.sweepAbandoned],
    );
    const revalidated = await withRole(client, 'storyforge_app', async (serviceClient) => {
      const result = await serviceClient.query(
        `SELECT * FROM public.sf_voice_sweep_purge($1, 'abandoned_24h')`,
        [ids.sweepAbandoned],
      );
      return result.rows;
    });
    assert.deepEqual(revalidated, []);
    const resumed = await client.query(
      `SELECT state,
              (SELECT count(*)::integer FROM public.sf_recording_segments
               WHERE session_id = $1) AS segment_count
       FROM public.sf_recording_sessions
       WHERE id = $1`,
      [ids.sweepAbandoned],
    );
    assert.deepEqual(resumed.rows[0], { state: 'recording', segment_count: 1 });

    const purged = await withRole(client, 'storyforge_app', async (serviceClient) => {
      const result = await serviceClient.query(
        `SELECT * FROM public.sf_voice_sweep_purge(
           $1, 'save_never_completed_72h'
         )`,
        [ids.sweepFinishing],
      );
      return result.rows;
    });
    assert.deepEqual(purged, [{
      object_key: `storyforge-rec/${STUDENT_A.sub}/${ids.sweepFinishing}/seg-00000.webm`,
    }]);
    const afterPurge = await client.query(
      `SELECT state,
              (SELECT count(*)::integer FROM public.sf_recording_segments
               WHERE session_id = $1) AS remaining_segments
       FROM public.sf_recording_sessions
       WHERE id = $1`,
      [ids.sweepFinishing],
    );
    assert.deepEqual(afterPurge.rows[0], {
      state: 'failed',
      remaining_segments: 0,
    });

    const firstAuditCount = await client.query(
      `SELECT count(*)::integer AS count
       FROM public.sf_audit_events
       WHERE action = 'recording_swept' AND entity_id = $1`,
      [ids.sweepFinishing],
    );
    assert.equal(firstAuditCount.rows[0].count, 1);
    await withRole(client, 'storyforge_app', (serviceClient) => serviceClient.query(
      `SELECT * FROM public.sf_voice_sweep_purge(
         $1, 'save_never_completed_72h'
       )`,
      [ids.sweepFinishing],
    ));
    const secondAuditCount = await client.query(
      `SELECT count(*)::integer AS count
       FROM public.sf_audit_events
       WHERE action = 'recording_swept' AND entity_id = $1`,
      [ids.sweepFinishing],
    );
    assert.equal(secondAuditCount.rows[0].count, 1);
  } finally {
    await database.stop();
  }
});

test('attach, asset finalization, retirement, reconciliation, and archive invariants are atomic', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    const verifiedStory = await createAudioStory(client, STUDENT_A, 'verified');
    await insertSession(client, {
      id: ids.attachVerified,
      state: 'assembled',
      totalDurationMs: 5_000,
      segmentCount: 1,
    });
    const verifiedTempKey =
      `storyforge-rec/${STUDENT_A.sub}/${ids.attachVerified}/seg-00000.webm`;
    await insertSegment(client, {
      id: '33100000-0000-4000-8000-000000000001',
      sessionId: ids.attachVerified,
      objectKey: verifiedTempKey,
      durationMs: 5_000,
    });

    const attached = await attachRecording(
      client,
      STUDENT_A,
      verifiedStory.id,
      ids.attachVerified,
    );
    assert.match(
      attached.target_object_key,
      new RegExp(`^storyforge-audio/${STUDENT_A.sub}/${verifiedStory.id}/[a-f0-9-]+$`),
    );
    assert.equal(/\.(webm|m4a|mp4|ogg|wav)$/.test(attached.target_object_key), false);
    const attachedAgain = await attachRecording(
      client,
      STUDENT_A,
      verifiedStory.id,
      ids.attachVerified,
    );
    assert.deepEqual(attachedAgain, attached);

    const attachedRows = await client.query(
      `SELECT
         (SELECT count(*)::integer FROM public.sf_audio_assets
          WHERE story_id = $1) AS assets,
         (SELECT count(*)::integer FROM public.sf_story_originals
          WHERE story_id = $1) AS originals,
         (SELECT count(*)::integer FROM public.sf_audit_events
          WHERE action = 'audio_attached' AND entity_id = $2) AS attach_audits`,
      [verifiedStory.id, ids.attachVerified],
    );
    assert.deepEqual(attachedRows.rows[0], {
      assets: 1,
      originals: 1,
      attach_audits: 1,
    });

    await assert.rejects(
      attachRecording(client, STUDENT_B, verifiedStory.id, ids.attachVerified),
      (error) => error.code === 'P0002',
    );

    await client.query(
      `UPDATE public.sf_audio_assets
       SET created_at = now() - interval '20 minutes'
       WHERE id = $1`,
      [attached.asset_id],
    );
    const pending = await withRole(client, 'storyforge_app', async (serviceClient) => {
      const result = await serviceClient.query(
        'SELECT * FROM public.sf_voice_asset_pending_candidates(20)',
      );
      return result.rows;
    });
    assert.ok(pending.some((row) => (
      row.asset_id === attached.asset_id
      && row.session_id === ids.attachVerified
      && row.pending_minutes >= 19
    )));

    const verifiedRemoved = await withRole(
      client,
      'storyforge_app',
      async (serviceClient) => {
        const result = await serviceClient.query(
          `SELECT * FROM public.sf_voice_asset_mark_verified($1, 4096, $2)`,
          [attached.asset_id, 'a'.repeat(64)],
        );
        return result.rows;
      },
    );
    assert.deepEqual(verifiedRemoved, [{ object_key: verifiedTempKey }]);
    const verifiedState = await client.query(
      `SELECT asset.state, asset.byte_size, asset.checksum_sha256, asset.duration_ms,
              session.segment_count,
              (SELECT count(*)::integer FROM public.sf_recording_segments
               WHERE session_id = session.id) AS remaining_segments
       FROM public.sf_audio_assets asset
       JOIN public.sf_recording_sessions session
         ON session.assembled_asset_id = asset.id
       WHERE asset.id = $1`,
      [attached.asset_id],
    );
    assert.deepEqual(verifiedState.rows[0], {
      state: 'verified',
      byte_size: '4096',
      checksum_sha256: 'a'.repeat(64),
      duration_ms: 5_000,
      segment_count: 1,
      remaining_segments: 0,
    });

    await withIdentity(client, STUDENT_A, (identityClient) => identityClient.query(
      `SELECT public.sf_set_story_archived($1, true, 'library')`,
      [verifiedStory.id],
    ));
    const retainedAfterArchive = await client.query(
      `SELECT asset.state AS state, session.state AS session_state
       FROM public.sf_audio_assets asset
       JOIN public.sf_recording_sessions session
         ON session.assembled_asset_id = asset.id
       WHERE asset.id = $1`,
      [attached.asset_id],
    );
    assert.deepEqual(retainedAfterArchive.rows[0], {
      state: 'verified',
      session_state: 'attached',
    });

    const failedStory = await createAudioStory(client, STUDENT_A, 'failed');
    await insertSession(client, {
      id: ids.attachFailed,
      state: 'assembled',
      totalDurationMs: 6_000,
      segmentCount: 1,
    });
    const failedTempKey =
      `storyforge-rec/${STUDENT_A.sub}/${ids.attachFailed}/seg-00000.webm`;
    await insertSegment(client, {
      id: '33100000-0000-4000-8000-000000000002',
      sessionId: ids.attachFailed,
      objectKey: failedTempKey,
      durationMs: 6_000,
    });
    const failedAttached = await attachRecording(
      client,
      STUDENT_A,
      failedStory.id,
      ids.attachFailed,
    );
    const failedRemoved = await withRole(
      client,
      'storyforge_app',
      async (serviceClient) => {
        const result = await serviceClient.query(
          'SELECT * FROM public.sf_voice_asset_mark_failed($1)',
          [failedAttached.asset_id],
        );
        return result.rows;
      },
    );
    assert.deepEqual(failedRemoved, [{ object_key: failedTempKey }]);
    const failedState = await client.query(
      `SELECT asset.state, session.segment_count,
              (SELECT count(*)::integer FROM public.sf_recording_segments
               WHERE session_id = session.id) AS remaining_segments
       FROM public.sf_audio_assets asset
       JOIN public.sf_recording_sessions session
         ON session.assembled_asset_id = asset.id
       WHERE asset.id = $1`,
      [failedAttached.asset_id],
    );
    assert.deepEqual(failedState.rows[0], {
      state: 'failed',
      segment_count: 0,
      remaining_segments: 0,
    });

    const retiredStory = await createAudioStory(client, STUDENT_A, 'retired');
    await insertSession(client, {
      id: ids.attachRetired,
      state: 'assembled',
      totalDurationMs: 7_000,
      segmentCount: 1,
    });
    const retiredTempKey =
      `storyforge-rec/${STUDENT_A.sub}/${ids.attachRetired}/seg-00000.webm`;
    await insertSegment(client, {
      id: '33100000-0000-4000-8000-000000000003',
      sessionId: ids.attachRetired,
      objectKey: retiredTempKey,
      durationMs: 7_000,
    });
    const retiredAttached = await attachRecording(
      client,
      STUDENT_A,
      retiredStory.id,
      ids.attachRetired,
    );
    await assert.rejects(
      withIdentity(client, STUDENT_B, (identityClient) => identityClient.query(
        'SELECT * FROM public.sf_retire_story_audio($1)',
        [retiredAttached.asset_id],
      )),
      (error) => error.code === 'P0002',
    );
    const retired = await withIdentity(client, STUDENT_A, async (identityClient) => {
      const result = await identityClient.query(
        'SELECT * FROM public.sf_retire_story_audio($1)',
        [retiredAttached.asset_id],
      );
      return result.rows[0];
    });
    assert.deepEqual(retired, {
      object_key: retiredAttached.target_object_key,
      story_id: retiredStory.id,
      changed: true,
    });
    const retiredAgain = await withIdentity(
      client,
      STUDENT_A,
      async (identityClient) => {
        const result = await identityClient.query(
          'SELECT * FROM public.sf_retire_story_audio($1)',
          [retiredAttached.asset_id],
        );
        return result.rows[0];
      },
    );
    assert.equal(retiredAgain.changed, false);
    const retiredState = await client.query(
      `SELECT asset.state, session.segment_count,
              (SELECT count(*)::integer FROM public.sf_recording_segments
               WHERE session_id = session.id) AS remaining_segments
       FROM public.sf_audio_assets asset
       JOIN public.sf_recording_sessions session
         ON session.assembled_asset_id = asset.id
       WHERE asset.id = $1`,
      [retiredAttached.asset_id],
    );
    assert.deepEqual(retiredState.rows[0], {
      state: 'retired',
      segment_count: 0,
      remaining_segments: 0,
    });

    const atomicStory = await createAudioStory(client, STUDENT_A, 'atomic failure');
    await insertSession(client, {
      id: ids.attachAtomicFailure,
      state: 'finishing',
      segmentCount: 1,
    });
    await insertSegment(client, {
      id: '33100000-0000-4000-8000-000000000004',
      sessionId: ids.attachAtomicFailure,
      objectKey:
        `storyforge-rec/${STUDENT_A.sub}/${ids.attachAtomicFailure}/seg-00000.webm`,
    });
    await assert.rejects(
      attachRecording(client, STUDENT_A, atomicStory.id, ids.attachAtomicFailure),
      (error) => error.code === '23514',
    );
    const atomicState = await client.query(
      `SELECT
         (SELECT count(*)::integer FROM public.sf_audio_assets
          WHERE story_id = $1) AS assets,
         (SELECT count(*)::integer FROM public.sf_story_originals
          WHERE story_id = $1) AS originals,
         (SELECT state FROM public.sf_recording_sessions
          WHERE id = $2) AS session_state`,
      [atomicStory.id, ids.attachAtomicFailure],
    );
    assert.deepEqual(atomicState.rows[0], {
      assets: 0,
      originals: 0,
      session_state: 'finishing',
    });

    const referenceCheck = await withRole(
      client,
      'storyforge_app',
      async (serviceClient) => {
        const result = await serviceClient.query(
          `SELECT * FROM public.sf_voice_audio_reference_check($1::text[])`,
          [[
            `${attached.target_object_key}.webm`,
            'storyforge-audio/unreferenced/fixture.webm',
          ]],
        );
        return result.rows;
      },
    );
    assert.deepEqual(referenceCheck, [
      { object_key: `${attached.target_object_key}.webm`, referenced: true },
      { object_key: 'storyforge-audio/unreferenced/fixture.webm', referenced: false },
    ]);
    await assert.rejects(
      withRole(client, 'storyforge_app', (serviceClient) => serviceClient.query(
        `SELECT * FROM public.sf_voice_audio_reference_check(
           ARRAY(SELECT 'key-' || value FROM generate_series(1, 1001) value)
         )`,
      )),
      (error) => error.code === '22023',
    );

    const archiveInvariant = await client.query(
      `SELECT count(*)::integer AS count
       FROM public.sf_recording_sessions
       WHERE state NOT IN ('attached','cancelled','failed')
         AND story_id IS NOT NULL`,
    );
    assert.equal(archiveInvariant.rows[0].count, 0);
  } finally {
    await database.stop();
  }
});
