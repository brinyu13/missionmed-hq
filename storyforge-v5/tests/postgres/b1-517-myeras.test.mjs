import assert from 'node:assert/strict';
import test from 'node:test';

import {
  migrationSql,
  startEphemeralStoryForgeDatabase,
  withIdentity,
  withRole,
} from './helpers/ephemeral-postgres.mjs';

const STUDENT = { sub: '11111111-1111-4111-8111-111111111111', role: 'student', wpUserId: 1101 };
const PEER = { sub: '22222222-2222-4222-8222-222222222222', role: 'student', wpUserId: 1102 };
const MENTOR = { sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'mentor', wpUserId: 2101 };
const ADMIN = {
  sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', role: 'admin', wpUserId: 3101,
  wordpressAdmin: true, adminMode: true,
};

const migrations = [
  '20260810190000_b1_514_v2_r1_visibility_consent_activity.sql',
  '20260810200000_b1_514_v2_r2_story_versions_provenance.sql',
  '20260810210000_b1_514_v2_r3_inspiration.sql',
  '20260810220000_b1_514_v2_ra_requests_guest.sql',
  '20260810230000_b1_514_v2_preferences_environments.sql',
  '20260810240000_b1_514_v2_ra_lifecycle_completion.sql',
  '20260810250000_b1_514_v21_authored_segment_writes.sql',
  '20260810260000_b1_514_guest_voice_contributions.sql',
  '20260810270000_b1_514_request_delivery_attempts.sql',
  '20260810280000_b1_514_guest_voice_cleanup_recovery.sql',
  '20260812120000_b1_515_v201_reviews_collections_peer.sql',
  '20260813120000_b1_515r_admin_subject_masterkey.sql',
  '20260813130000_b1_515r_action_center_contribution_review.sql',
  '20260813140000_b1_515r_arena_avatar_directory_groups.sql',
  '20260813150000_b1_515r_inspiration_recommendation_publish_fix.sql',
  '20260814120000_b1_515r2_admin_population_avatar_sound.sql',
  '20260819220000_b1_515r4_admin_population_scope_repair.sql',
  '20260820120000_b1_517_myeras_alignment.sql',
];

async function applyMigrations(client) {
  for (const migration of migrations) {
    await client.query(
      migrationSql(migration)
        .replace(/^\\set .*$/gm, '')
        .replaceAll(":'founder_user_id'", "'11111111-1111-4111-8111-111111111111'"),
    );
  }
}

async function syncPopulation(client) {
  await withRole(client, 'storyforge_app', (db) => db.query(
    `SELECT public.sf_sync_admin_population_snapshot(
       'match_mentorship_360','66666666-6666-4666-8666-666666666666',now(),
       'mmhq_cam_build_entitlement',3893,$1::jsonb,false
     )`,
    [JSON.stringify([
      { storyforge_uuid: STUDENT.sub, wp_user_id: STUDENT.wpUserId, arena_avatar_id: '', arena_avatar_thumbnail_url: '' },
    ])],
  ));
}

test('B1-517 is additive, off by default, owner-scoped, version-safe, and audited', { timeout: 120_000 }, async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    await applyMigrations(client);
    const flags = await client.query(
      `SELECT key,scope,cardinality(allowlist)::int AS allowlist_count,cardinality(cohorts)::int AS cohort_count
         FROM public.sf_feature_flags
        WHERE key=ANY($1::text[]) ORDER BY key`,
      [[
        'eras_taxonomy', 'myeras_workspace', 'clinical_case_metadata',
        'use_ranking', 'myeras_versions', 'ai_condensation',
      ]],
    );
    assert.equal(flags.rowCount, 6);
    assert.ok(flags.rows.every((row) => row.scope === 'off' && row.allowlist_count === 0 && row.cohort_count === 0));
    const tables = await client.query(
      `SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class
        WHERE relname=ANY($1::text[]) ORDER BY relname`,
      [[
        'sf_eras_profiles', 'sf_eras_taxonomy_terms', 'sf_story_eras_tags',
        'sf_eras_legacy_theme_map', 'sf_myeras_workspaces', 'sf_myeras_experiences',
        'sf_myeras_experience_stories', 'sf_myeras_impactful', 'sf_story_clinical_case',
        'sf_story_use_ranks',
      ]],
    );
    assert.equal(tables.rowCount, 10);
    assert.ok(tables.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity));
    assert.deepEqual((await client.query(
      `SELECT count(*)::int AS experiences,count(*) FILTER(WHERE profile_key='eras_2027')::int AS profiles
         FROM public.sf_myeras_experiences CROSS JOIN public.sf_eras_profiles`,
    )).rows[0], { experiences: 0, profiles: 0 });

    await client.query(
      `UPDATE public.sf_feature_flags SET scope='eligible_all',allowlist='{}',cohorts='{}'
        WHERE key=ANY($1::text[])`,
      [[
        'admin_console', 'admin_directory', 'story_versions', 'eras_taxonomy',
        'myeras_workspace', 'clinical_case_metadata', 'use_ranking', 'myeras_versions',
      ]],
    );
    await syncPopulation(client);
    const story = (await client.query(
      `INSERT INTO public.sf_stories(student_id,title,original_text,current_text,status,visibility)
       VALUES($1,'MyERAS source','original','full story','private','private') RETURNING id`,
      [STUDENT.sub],
    )).rows[0];

    const taxonomy = await withIdentity(client, STUDENT, async (db) => (
      await db.query(`SELECT public.sf_eras_taxonomy('experience_type') AS value`)
    ).rows[0].value);
    assert.equal(taxonomy.length, 8);
    assert.equal(taxonomy[0].label, 'Education/training');

    const savedVersion = await withIdentity(client, STUDENT, async (db) => (
      await db.query(
        `SELECT public.sf_save_story_version($1,'myeras_experience','A concise experience','save','typed',0,NULL,NULL) AS value`,
        [story.id],
      )
    ).rows[0].value);
    assert.equal(savedVersion.key, 'myeras_experience');
    assert.equal(savedVersion.rowVersion, 0);

    const experience = await withIdentity(client, STUDENT, async (db) => (
      await db.query(
        `SELECT public.sf_myeras_upsert_experience(NULL,$1::jsonb,0) AS value`,
        [JSON.stringify({
          organization: 'Teaching program', experienceType: 'teaching_mentoring',
          positionTitle: 'Peer teacher', descriptionText: 'I taught a weekly review session.',
          mostMeaningful: true, mostMeaningfulRank: 1,
        })],
      )
    ).rows[0].value);
    assert.equal(experience.slotNo, 1);
    const linked = await withIdentity(client, STUDENT, async (db) => (
      await db.query(`SELECT public.sf_myeras_link_story($1,$2,'primary') AS value`, [experience.id, story.id])
    ).rows[0].value);
    assert.equal(linked.linkRole, 'primary');
    await withIdentity(client, STUDENT, (db) => db.query(
      `SELECT public.sf_myeras_set_impactful('A private-source impactful draft.',$1,0)`,
      [story.id],
    ));

    await withIdentity(client, STUDENT, (db) => db.query(
      `SELECT public.sf_set_story_eras_tags($1,'eras_2027',$2::jsonb)`,
      [story.id, JSON.stringify([
        { dimension: 'experience_type', termId: 'teaching_mentoring' },
        { dimension: 'primary_focus', termId: 'medical_education' },
        { dimension: 'key_characteristic', termId: 'communication' },
      ])],
    ));
    await withIdentity(client, STUDENT, (db) => db.query(
      `SELECT public.sf_set_story_clinical_case($1,$2::jsonb,0)`,
      [story.id, JSON.stringify({ patientContext: 'Adult patient, details removed.', outcomeFocus: 'Safer handoff.', deidentConfirmed: true })],
    ));
    await withIdentity(client, STUDENT, (db) => db.query(
      `SELECT public.sf_set_story_use_rank($1,'myeras_experiences',2,true,0)`,
      [story.id],
    ));

    const workspace = await withIdentity(client, STUDENT, async (db) => (
      await db.query(`SELECT public.sf_myeras_workspace(NULL) AS value`)
    ).rows[0].value);
    assert.equal(workspace.experiences.length, 1);
    assert.equal(workspace.experiences[0].linkedStories[0].storyId, story.id);
    assert.equal(workspace.storyFit[0].tagCompleteness, 3);
    assert.equal(workspace.storyFit[0].uses.find((use) => use.useId === 'myeras_experiences').studentRank, 2);

    const adminWorkspace = await withIdentity(client, ADMIN, async (db) => (
      await db.query(`SELECT public.sf_myeras_workspace($1) AS value`, [STUDENT.sub])
    ).rows[0].value);
    assert.deepEqual(adminWorkspace.experiences[0].linkedStories, []);
    assert.equal(adminWorkspace.impactful.bodyText, 'A private-source impactful draft.');
    assert.equal(adminWorkspace.impactful.sourceStoryId, null);
    assert.deepEqual(await withIdentity(client, ADMIN, async (db) => (
      await db.query(`SELECT
        (SELECT count(*)::int FROM public.sf_myeras_experience_stories) AS links,
        (SELECT count(*)::int FROM public.sf_myeras_impactful) AS impactful`)
    ).rows[0]), { links: 0, impactful: 0 });

    await assert.rejects(
      withIdentity(client, MENTOR, (db) => db.query(`SELECT public.sf_eras_active_profile()`)),
      (error) => error?.code === '42501',
    );
    await assert.rejects(
      withIdentity(client, MENTOR, (db) => db.query(`SELECT public.sf_eras_taxonomy(NULL)`)),
      (error) => error?.code === '42501',
    );
    await assert.rejects(
      withIdentity(client, STUDENT, (db) => db.query(
        `SELECT public.sf_myeras_upsert_experience(NULL,$1::jsonb,0)`,
        [JSON.stringify({ organization: 'Rejected', participationFrequency: 'Invented value' })],
      )),
      (error) => error?.code === '22023',
    );

    await assert.rejects(
      withIdentity(client, PEER, (db) => db.query(`SELECT public.sf_get_story_clinical_case($1)`, [story.id])),
      (error) => error?.code === 'P0002',
    );
    await assert.rejects(
      withIdentity(client, ADMIN, (db) => db.query(`SELECT public.sf_get_story_clinical_case($1)`, [story.id])),
      (error) => error?.code === 'P0002',
    );

    await client.query(
      `UPDATE public.sf_feature_flags SET scope='off',allowlist='{}',cohorts='{}'
        WHERE key=ANY($1::text[])`,
      [[
        'eras_taxonomy', 'myeras_workspace', 'clinical_case_metadata',
        'use_ranking', 'myeras_versions', 'ai_condensation',
      ]],
    );
    assert.deepEqual(await withIdentity(client, STUDENT, async (db) => (
      await db.query(`SELECT
        (SELECT count(*)::int FROM public.sf_eras_profiles) AS profiles,
        (SELECT count(*)::int FROM public.sf_eras_taxonomy_terms) AS taxonomy,
        (SELECT count(*)::int FROM public.sf_story_eras_tags) AS tags,
        (SELECT count(*)::int FROM public.sf_myeras_workspaces) AS workspaces,
        (SELECT count(*)::int FROM public.sf_myeras_experiences) AS experiences,
        (SELECT count(*)::int FROM public.sf_myeras_experience_stories) AS links,
        (SELECT count(*)::int FROM public.sf_myeras_impactful) AS impactful,
        (SELECT count(*)::int FROM public.sf_story_clinical_case) AS clinical,
        (SELECT count(*)::int FROM public.sf_story_use_ranks) AS ranks`)
    ).rows[0]), {
      profiles: 0, taxonomy: 0, tags: 0, workspaces: 0, experiences: 0,
      links: 0, impactful: 0, clinical: 0, ranks: 0,
    });
    assert.deepEqual(await withIdentity(client, ADMIN, async (db) => (
      await db.query(`SELECT
        (SELECT count(*)::int FROM public.sf_myeras_experiences) AS experiences,
        (SELECT count(*)::int FROM public.sf_story_use_ranks) AS ranks`)
    ).rows[0]), { experiences: 0, ranks: 0 });
    await assert.rejects(
      withIdentity(client, STUDENT, (db) => db.query(`SELECT public.sf_myeras_workspace(NULL)`)),
      (error) => error?.code === '42501',
    );
    await assert.rejects(
      withIdentity(client, STUDENT, (db) => db.query(`SELECT public.sf_eras_taxonomy(NULL)`)),
      (error) => error?.code === '42501',
    );
    assert.ok(Number((await client.query(
      `SELECT count(*) AS count FROM public.sf_audit_events
        WHERE student_id=$1 AND action LIKE ANY(ARRAY['myeras.%','story.%'])`,
      [STUDENT.sub],
    )).rows[0].count) >= 5);
  } finally {
    await database.stop();
  }
});
