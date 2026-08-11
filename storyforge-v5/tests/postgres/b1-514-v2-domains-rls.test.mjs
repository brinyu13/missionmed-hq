import assert from 'node:assert/strict';
import test from 'node:test';

import {
  migrationSql,
  startEphemeralStoryForgeDatabase,
  withIdentity,
  withRole,
} from './helpers/ephemeral-postgres.mjs';

const STUDENT = { sub: '11111111-1111-4111-8111-111111111111', role: 'student', wpUserId: 1101 };
const OTHER = { sub: '22222222-2222-4222-8222-222222222222', role: 'student', wpUserId: 1102 };
const MENTOR = { sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'mentor', wpUserId: 2101 };
const ADMIN = { sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', role: 'admin', wpUserId: 3101, wordpressAdmin: true, adminMode: true };
const migrations = [
  '20260810190000_b1_514_v2_r1_visibility_consent_activity.sql',
  '20260810200000_b1_514_v2_r2_story_versions_provenance.sql',
  '20260810210000_b1_514_v2_r3_inspiration.sql',
  '20260810220000_b1_514_v2_ra_requests_guest.sql',
  '20260810230000_b1_514_v2_preferences_environments.sql',
];
const promptId = '33333333-3333-4333-8333-333333333333';
const contributorPromptId = '44444444-4444-4444-8444-444444444444';

test('B1-514 V2 domains remain additive, owner-scoped, forced-RLS, and default closed', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    const historical = await client.query(
      `INSERT INTO public.sf_stories(student_id,title,original_text,current_text,status)
       VALUES($1,'Historical','Exact original','Exact current','private') RETURNING id,xmin::text,row_version`,
      [STUDENT.sub],
    );
    for (const migration of migrations) {
      await client.query(migrationSql(migration).replace(/^\\set .*$/gm, ''));
    }
    const preserved = await client.query(
      'SELECT xmin::text,row_version,original_text,current_text,visibility FROM public.sf_stories WHERE id=$1',
      [historical.rows[0].id],
    );
    assert.deepEqual(preserved.rows[0], {
      xmin: historical.rows[0].xmin,
      row_version: historical.rows[0].row_version,
      original_text: 'Exact original',
      current_text: 'Exact current',
      visibility: null,
    });

    const flags = await client.query(
      `SELECT key,scope FROM public.sf_feature_flags
       WHERE key IN('story_versions','inspiration','request_a_story','guest_contributions') ORDER BY key`,
    );
    assert.deepEqual(flags.rows, [
      { key: 'guest_contributions', scope: 'off' },
      { key: 'inspiration', scope: 'off' },
      { key: 'request_a_story', scope: 'off' },
      { key: 'story_versions', scope: 'off' },
    ]);
    const posture = await client.query(
      `SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class
       WHERE relname IN('sf_story_versions','sf_inspiration_saved','sf_story_invitations','sf_story_contributions')
       ORDER BY relname`,
    );
    assert.equal(posture.rowCount, 4);
    assert.ok(posture.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity));
    const writePrivileges = await client.query(
      `SELECT
         has_table_privilege('authenticated','public.sf_story_versions','INSERT') AS version_insert,
         has_table_privilege('authenticated','public.sf_inspiration_saved','INSERT') AS inspiration_insert,
         has_table_privilege('authenticated','public.sf_story_invitations','INSERT') AS invitation_insert,
         has_table_privilege('authenticated','public.sf_story_contributions','UPDATE') AS contribution_update,
         has_table_privilege('storyforge_app','public.sf_story_invitations','UPDATE') AS service_invitation_update,
         has_table_privilege('storyforge_app','public.sf_story_contributions','INSERT') AS service_contribution_insert`,
    );
    assert.deepEqual(writePrivileges.rows[0], {
      version_insert: false,
      inspiration_insert: false,
      invitation_insert: false,
      contribution_update: false,
      service_invitation_update: false,
      service_contribution_insert: false,
    });

    await client.query(
      `UPDATE public.sf_feature_flags SET scope='eligible_all'
       WHERE key IN('story_versions','inspiration','request_a_story','guest_contributions')`,
    );
    await client.query(
      `INSERT INTO public.sf_inspiration_prompts
       (id,library_key,text,who_ids,who_detail_ids,domain_ids,energy_ids,territory,follow_up,interview_use,sort_order)
       VALUES($1,'q-999','A truthful test prompt?',ARRAY['you'],ARRAY[]::text[],ARRAY['personal'],ARRAY['serious'],'identity','What changed?','Behavioral',1)`,
      [promptId],
    );
    await client.query(
      `INSERT INTO public.sf_contributor_prompts(id,library_key,relationship_ids,text,hint,sort_order)
       VALUES($1,'c-999',ARRAY['parent'],'Tell me a bounded story from childhood.','Share one moment.',1)`,
      [contributorPromptId],
    );

    let invitationId;
    let versionId;
    await withIdentity(client, STUDENT, async (identityClient) => {
      const version = await identityClient.query(
        `SELECT public.sf_save_story_version($1,'thirty_second','Exact concise telling','save','typed',0,NULL,NULL) AS payload`,
        [historical.rows[0].id],
      );
      assert.equal(version.rows[0].payload.body, 'Exact concise telling');
      versionId = version.rows[0].payload.id;
      await identityClient.query(
        `SELECT public.sf_inspiration_save($1,'A truthful test prompt?','Private draft','saved','typed')`,
        [promptId],
      );
      const invitation = await identityClient.query(
        `SELECT public.sf_request_create('Pat','parent','pat@example.test','','founder-v1') AS payload`,
      );
      invitationId = invitation.rows[0].payload.id;
    });

    await withIdentity(client, OTHER, async (identityClient) => {
      assert.equal((await identityClient.query('SELECT count(*)::integer AS count FROM public.sf_story_versions')).rows[0].count, 0);
      assert.equal((await identityClient.query('SELECT count(*)::integer AS count FROM public.sf_inspiration_saved')).rows[0].count, 0);
      assert.equal((await identityClient.query('SELECT count(*)::integer AS count FROM public.sf_story_invitations')).rows[0].count, 0);
    });
    for (const directWrite of [
      `INSERT INTO public.sf_story_versions(story_id,version_key,body,source)
       VALUES('${historical.rows[0].id}','nnq_setup','bypass','typed')`,
      `UPDATE public.sf_story_versions SET body='bypass' WHERE id='${versionId}'`,
      `INSERT INTO public.sf_story_version_revisions(version_id,story_id,body,source,actor_user_id)
       VALUES('${versionId}','${historical.rows[0].id}','bypass','typed','${STUDENT.sub}')`,
      `INSERT INTO public.sf_authored_segments(story_id,story_version_id,source_role,source_entity_type,source_entity_id,body_hash,author_id)
       VALUES('${historical.rows[0].id}','${versionId}','student_typed','story_version','${versionId}',repeat('a',64),'${STUDENT.sub}')`,
    ]) {
      await assert.rejects(
        withIdentity(client, STUDENT, async (identityClient) => identityClient.query(directWrite)),
        (error) => error?.code === '42501',
      );
    }

    await assert.rejects(
      withIdentity(client, ADMIN, async (identityClient) => identityClient.query(
        'SELECT public.sf_list_story_versions($1)',
        [historical.rows[0].id],
      )),
      (error) => error?.code === 'P0002',
    );
    await client.query("UPDATE public.sf_stories SET status='awaiting' WHERE id=$1", [historical.rows[0].id]);
    await withIdentity(client, ADMIN, async (identityClient) => {
      const visible = await identityClient.query('SELECT public.sf_list_story_versions($1) AS payload', [historical.rows[0].id]);
      assert.equal(visible.rows[0].payload.versions.length, 1);
    });
    await client.query(
      "UPDATE public.sf_stories SET status='private',visibility='mentor_visible' WHERE id=$1",
      [historical.rows[0].id],
    );
    await assert.rejects(
      withIdentity(client, ADMIN, async (identityClient) => identityClient.query(
        'SELECT public.sf_list_story_versions($1)',
        [historical.rows[0].id],
      )),
      (error) => error?.code === 'P0002',
    );
    await assert.rejects(
      withIdentity(client, MENTOR, async (identityClient) => identityClient.query(
        'SELECT public.sf_list_story_versions($1)',
        [historical.rows[0].id],
      )),
      (error) => error?.code === 'P0002',
    );
    await client.query("UPDATE public.sf_feature_flags SET scope='eligible_all' WHERE key='visibility_consent'");
    await withIdentity(client, ADMIN, async (identityClient) => {
      const visible = await identityClient.query('SELECT public.sf_list_story_versions($1) AS payload', [historical.rows[0].id]);
      assert.equal(visible.rows[0].payload.versions.length, 1);
    });
    await withIdentity(client, MENTOR, async (identityClient) => {
      const visible = await identityClient.query('SELECT public.sf_list_story_versions($1) AS payload', [historical.rows[0].id]);
      assert.equal(visible.rows[0].payload.versions.length, 1);
    });

    const otherAudio = await client.query(
      `INSERT INTO public.sf_audio_assets(story_id,student_id,object_key,content_type,state)
       VALUES($1,$2,'b1-514/other-audio','audio/webm','verified') RETURNING id`,
      [historical.rows[0].id, OTHER.sub],
    );
    const otherRecording = await client.query(
      `INSERT INTO public.sf_recording_sessions(student_id,story_id,state,assembled_asset_id)
       VALUES($1,$2,'attached',$3) RETURNING id`,
      [OTHER.sub, historical.rows[0].id, otherAudio.rows[0].id],
    );
    const recording = await client.query(
      `INSERT INTO public.sf_recording_sessions(student_id,state,mime_type,total_duration_ms,segment_count)
       VALUES($1,'assembled','audio/webm',4200,1) RETURNING id`,
      [STUDENT.sub],
    );
    await client.query(
      `INSERT INTO public.sf_recording_segments(
         session_id,seq,object_key,mime_type,byte_size,duration_ms,transcribe_state,transcript
       ) VALUES($1,0,$2,'audio/webm',4,4200,'transcribed','Verified spoken telling')`,
      [recording.rows[0].id, `storyforge-rec/${STUDENT.sub}/${recording.rows[0].id}/seg-00000.webm`],
    );
    const originalCount = Number((await client.query(
      'SELECT count(*) AS count FROM public.sf_story_originals WHERE story_id=$1',
      [historical.rows[0].id],
    )).rows[0].count);
    const ownAudio = await withIdentity(client, STUDENT, async (identityClient) => identityClient.query(
      'SELECT * FROM public.sf_attach_version_recording($1,$2,$3)',
      [historical.rows[0].id, recording.rows[0].id, 'audio/webm'],
    ));
    assert.match(ownAudio.rows[0].target_object_key, new RegExp(`^storyforge-audio/${STUDENT.sub}/${historical.rows[0].id}/`));
    assert.equal(Number((await client.query(
      'SELECT count(*) AS count FROM public.sf_story_originals WHERE story_id=$1',
      [historical.rows[0].id],
    )).rows[0].count), originalCount);
    assert.deepEqual((await client.query(
      'SELECT capture_type,original_text,current_text,row_version FROM public.sf_stories WHERE id=$1',
      [historical.rows[0].id],
    )).rows[0], {
      capture_type: 'text', original_text: 'Exact original', current_text: 'Exact current', row_version: '0',
    });
    await withRole(client, 'storyforge_app', async (serviceClient) => serviceClient.query(
      'SELECT public.sf_voice_asset_mark_verified($1,4,$2)',
      [ownAudio.rows[0].asset_id, 'a'.repeat(64)],
    ));
    const protectedCounts = async () => (await client.query(
      `SELECT
         (SELECT count(*)::integer FROM public.sf_story_versions) AS versions,
         (SELECT count(*)::integer FROM public.sf_story_version_revisions) AS revisions,
         (SELECT count(*)::integer FROM public.sf_authored_segments) AS segments,
         (SELECT count(*)::integer FROM public.sf_audit_events WHERE action='story.version_edited') AS audits`,
    )).rows[0];
    const rejectVoicePair = async (recordingId, audioId, code = '42501') => {
      const before = await protectedCounts();
      await assert.rejects(
        withIdentity(client, STUDENT, async (identityClient) => identityClient.query(
          `SELECT public.sf_save_story_version($1,'thirty_second','Rejected voice provenance','save','voice',0,$2,$3)`,
          [historical.rows[0].id, recordingId, audioId],
        )),
        (error) => error?.code === code,
      );
      assert.deepEqual(await protectedCounts(), before);
    };
    await rejectVoicePair(otherRecording.rows[0].id, otherAudio.rows[0].id);
    await rejectVoicePair(recording.rows[0].id, otherAudio.rows[0].id);
    await rejectVoicePair(recording.rows[0].id, null, '22023');

    const unverifiedAudio = await client.query(
      `INSERT INTO public.sf_audio_assets(story_id,student_id,object_key,content_type,state)
       VALUES($1,$2,'b1-514/unverified-audio','audio/webm','uploaded') RETURNING id`,
      [historical.rows[0].id, STUDENT.sub],
    );
    const unverifiedRecording = await client.query(
      `INSERT INTO public.sf_recording_sessions(student_id,story_id,state,assembled_asset_id)
       VALUES($1,$2,'attached',$3) RETURNING id`,
      [STUDENT.sub, historical.rows[0].id, unverifiedAudio.rows[0].id],
    );
    await rejectVoicePair(unverifiedRecording.rows[0].id, unverifiedAudio.rows[0].id);

    const unattachedAudio = await client.query(
      `INSERT INTO public.sf_audio_assets(story_id,student_id,object_key,content_type,state)
       VALUES($1,$2,'b1-514/unattached-audio','audio/webm','verified') RETURNING id`,
      [historical.rows[0].id, STUDENT.sub],
    );
    const unattachedRecording = await client.query(
      `INSERT INTO public.sf_recording_sessions(student_id,story_id,state,assembled_asset_id)
       VALUES($1,$2,'assembled',$3) RETURNING id`,
      [STUDENT.sub, historical.rows[0].id, unattachedAudio.rows[0].id],
    );
    await rejectVoicePair(unattachedRecording.rows[0].id, unattachedAudio.rows[0].id);

    await withIdentity(client, STUDENT, async (identityClient) => {
      const saved = await identityClient.query(
        `SELECT public.sf_save_story_version($1,'thirty_second','Verified spoken telling','save','voice',0,$2,$3) AS payload`,
        [historical.rows[0].id, recording.rows[0].id, ownAudio.rows[0].asset_id],
      );
      assert.equal(saved.rows[0].payload.source, 'voice');
      assert.equal(saved.rows[0].payload.recordingId, recording.rows[0].id);
      assert.equal(saved.rows[0].payload.audioAssetId, ownAudio.rows[0].asset_id);
      await assert.rejects(
        identityClient.query('SELECT * FROM public.sf_retire_story_audio($1)', [ownAudio.rows[0].asset_id]),
        (error) => error?.code === '23503',
      );
    });
    await withRole(client, 'storyforge_app', async (serviceClient) => {
      assert.equal((await serviceClient.query('SELECT id FROM public.sf_story_invitations WHERE id=$1', [invitationId])).rowCount, 1);
    });
  } finally {
    await database.stop();
  }
});
