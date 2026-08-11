import assert from 'node:assert/strict';
import test from 'node:test';

import {
  migrationSql,
  startEphemeralStoryForgeDatabase,
  withIdentity,
} from './helpers/ephemeral-postgres.mjs';

const STUDENT = {
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'student',
  wpUserId: 1101,
};
const OTHER_STUDENT = {
  sub: '22222222-2222-4222-8222-222222222222',
  role: 'student',
  wpUserId: 1102,
};
const MENTOR = {
  sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'mentor',
  wpUserId: 2101,
};
const ADMIN = {
  sub: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  role: 'admin',
  wpUserId: 3101,
};
const migrationName = '20260810190000_b1_514_v2_r1_visibility_consent_activity.sql';

test('B1-514 R1 preserves historical rows and enforces consent, visibility, activity, and RLS', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    const historical = await client.query(
      `INSERT INTO public.sf_stories
         (student_id, title, original_text, current_text, status)
       VALUES ($1, 'Historical exact story', 'Original bytes', 'Working bytes', 'private')
       RETURNING id, xmin::text AS xmin, row_version, current_text`,
      [STUDENT.sub],
    );
    const before = historical.rows[0];

    await client.query(migrationSql(migrationName));

    const after = await client.query(
      `SELECT id, xmin::text AS xmin, row_version, current_text, visibility,
         visibility_changed_at
       FROM public.sf_stories WHERE id = $1`,
      [before.id],
    );
    assert.deepEqual(after.rows[0], {
      id: before.id,
      xmin: before.xmin,
      row_version: before.row_version,
      current_text: before.current_text,
      visibility: null,
      visibility_changed_at: null,
    });

    const flags = await client.query(
      `SELECT key, scope, allowlist, cohorts
       FROM public.sf_feature_flags
       WHERE key IN ('visibility_consent', 'activity_tracking')
       ORDER BY key`,
    );
    assert.equal(flags.rowCount, 2);
    assert.ok(flags.rows.every((row) => (
      row.scope === 'off' && row.allowlist.length === 0 && row.cohorts.length === 0
    )));

    const posture = await client.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity
       FROM pg_class
       WHERE relname IN (
         'sf_mentorship_consent', 'sf_activity_config',
         'sf_activity_sessions', 'sf_activity_counters',
         'sf_admin_saved_views', 'sf_review_checks'
       )
       ORDER BY relname`,
    );
    assert.equal(posture.rowCount, 6);
    assert.ok(posture.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity));

    await client.query(
      `UPDATE public.sf_feature_flags
       SET scope = 'eligible_all', updated_at = now()
       WHERE key = 'visibility_consent'`,
    );

    let firstAuditId;
    await withIdentity(client, STUDENT, async (identityClient) => {
      const deferred = await identityClient.query(
        `SELECT public.sf_decide_mentorship_consent(
          'mentorship-visibility-1', 'defer'
        ) AS payload`,
      );
      assert.equal(deferred.rows[0].payload.consent.accepted, false);
      assert.equal(typeof deferred.rows[0].payload.receipt.auditId, 'string');

      const accepted = await identityClient.query(
        `SELECT public.sf_decide_mentorship_consent(
          'mentorship-visibility-1', 'accept'
        ) AS payload`,
      );
      assert.equal(accepted.rows[0].payload.consent.accepted, true);
      firstAuditId = accepted.rows[0].payload.receipt.auditId;
      assert.match(firstAuditId, /^\d+$/);
    });

    const consentRows = await client.query(
      `SELECT decision, audit_event_id, pg_typeof(audit_event_id)::text AS audit_type
       FROM public.sf_mentorship_consent
       WHERE user_id = $1 ORDER BY audit_event_id`,
      [STUDENT.sub],
    );
    assert.deepEqual(consentRows.rows.map((row) => row.decision), ['defer', 'accept']);
    assert.ok(consentRows.rows.every((row) => row.audit_type === 'bigint'));
    await assert.rejects(
      client.query(
        `UPDATE public.sf_mentorship_consent SET decision = 'defer'
         WHERE user_id = $1`,
        [STUDENT.sub],
      ),
      (error) => error.code === '42501',
    );

    let visibleStory;
    await withIdentity(client, STUDENT, async (identityClient) => {
      const created = await identityClient.query(
        `SELECT * FROM public.sf_create_story_v5(
          '{"title":"New consent story","text":"New bytes"}'::jsonb,
          'quick'
        )`,
      );
      visibleStory = created.rows[0];
      assert.equal(visibleStory.visibility, 'mentor_visible');
      assert.notEqual(visibleStory.visibility_changed_at, null);
    });
    assert.equal(
      (await client.query(
        `SELECT visibility FROM public.sf_stories WHERE id = $1`,
        [before.id],
      )).rows[0].visibility,
      null,
    );

    await withIdentity(client, MENTOR, async (identityClient) => {
      const readable = await identityClient.query(
        'SELECT id FROM public.sf_stories WHERE id = $1',
        [visibleStory.id],
      );
      assert.equal(readable.rowCount, 1);
      const historicalHidden = await identityClient.query(
        'SELECT id FROM public.sf_stories WHERE id = $1',
        [before.id],
      );
      assert.equal(historicalHidden.rowCount, 0);
    });
    await withIdentity(client, OTHER_STUDENT, async (identityClient) => {
      const crossStudent = await identityClient.query(
        'SELECT id FROM public.sf_stories WHERE id = $1',
        [visibleStory.id],
      );
      assert.equal(crossStudent.rowCount, 0);
    });

    await client.query(
      `UPDATE public.sf_feature_flags
       SET scope = 'off', updated_at = now()
       WHERE key = 'visibility_consent'`,
    );
    await withIdentity(client, MENTOR, async (identityClient) => {
      const dormant = await identityClient.query(
        'SELECT id FROM public.sf_stories WHERE id = $1',
        [visibleStory.id],
      );
      assert.equal(dormant.rowCount, 0);
    });

    await client.query(
      `UPDATE public.sf_feature_flags
       SET scope = 'eligible_all', updated_at = now()
       WHERE key = 'admin_console'`,
    );
    await withIdentity(client, ADMIN, async (identityClient) => {
      const flag = await identityClient.query(
        `SELECT public.sf_admin_set_b1_514_feature_flag(
          'activity_tracking', 'eligible_all', '{}'::uuid[], '{}'::text[]
        ) AS payload`,
      );
      assert.equal(flag.rows[0].payload.scope, 'eligible_all');
      assert.equal(typeof flag.rows[0].payload.auditId, 'string');
      for (const key of ['admin_directory', 'review_check']) {
        const enabled = await identityClient.query(
          `SELECT public.sf_admin_set_b1_514_feature_flag(
            $1, 'eligible_all', '{}'::uuid[], '{}'::text[]
          ) AS payload`,
          [key],
        );
        assert.equal(enabled.rows[0].payload.scope, 'eligible_all');
      }

      const directory = await identityClient.query(
        `SELECT public.sf_admin_directory('', 'all', '', 'name', 1, 25) AS payload`,
      );
      assert.ok(directory.rows[0].payload.students.some((student) => student.id === STUDENT.sub));
      const detail = await identityClient.query(
        'SELECT public.sf_admin_directory_student($1) AS payload',
        [STUDENT.sub],
      );
      assert.equal(detail.rows[0].payload.student.id, STUDENT.sub);
      assert.ok(!JSON.stringify(detail.rows[0].payload.stories).includes('Historical exact story'));

      const saved = await identityClient.query(
        `SELECT public.sf_admin_save_view('Needs attention','{"filter":"needs_review","session":"","sort":"attention"}'::jsonb) AS payload`,
      );
      const views = await identityClient.query('SELECT public.sf_admin_saved_views() AS payload');
      assert.equal(views.rows[0].payload.views.length, 1);
      await identityClient.query('SELECT public.sf_admin_delete_saved_view($1)', [saved.rows[0].payload.id]);

      const preview = await identityClient.query(
        'SELECT public.sf_record_review_check($1,true) AS payload',
        [STUDENT.sub],
      );
      assert.equal(preview.rows[0].payload.sent, false);
      assert.match(preview.rows[0].payload.body, /no stories had been submitted/);
      const sent = await identityClient.query(
        'SELECT public.sf_record_review_check($1,false) AS payload',
        [STUDENT.sub],
      );
      assert.equal(sent.rows[0].payload.status, 'recorded');
      assert.match(sent.rows[0].payload.auditEventId, /^\d+$/);
    });
    await assert.rejects(
      withIdentity(client, ADMIN, async (identityClient) => identityClient.query(
        'SELECT public.sf_record_review_check($1,false)',
        [STUDENT.sub],
      )),
      (error) => error.code === 'P0003',
    );

    const sessionId = crypto.randomUUID();
    let firstActiveMs;
    await withIdentity(client, STUDENT, async (identityClient) => {
      const heartbeat = await identityClient.query(
        'SELECT public.sf_activity_heartbeat($1, $2, $3) AS payload',
        [sessionId, 'story_detail', 60_000],
      );
      assert.equal(heartbeat.rows[0].payload.accepted, true);
      assert.notEqual(heartbeat.rows[0].payload.availableFrom, null);
      firstActiveMs = Number(heartbeat.rows[0].payload.activeMs);

      await assert.rejects(
        identityClient.query('SELECT * FROM public.sf_activity_sessions'),
        (error) => error.code === '42501',
      );
    });
    await withIdentity(client, STUDENT, async (identityClient) => {
      const immediate = await identityClient.query(
        'SELECT public.sf_activity_heartbeat($1, $2, $3) AS payload',
        [sessionId, 'story_detail', 60_000],
      );
      assert.ok(Number(immediate.rows[0].payload.activeMs) < firstActiveMs + 1000);
    });
    await withIdentity(client, OTHER_STUDENT, async (identityClient) => {
      await assert.rejects(
        identityClient.query(
          'SELECT public.sf_activity_heartbeat($1, $2, $3)',
          [sessionId, 'home', 1000],
        ),
        (error) => error.code === 'P0002',
      );
    });
    await withIdentity(client, ADMIN, async (identityClient) => {
      const report = await identityClient.query(
        'SELECT public.sf_admin_activity_for_student($1) AS payload',
        [STUDENT.sub],
      );
      assert.equal(report.rows[0].payload.studentId, STUDENT.sub);
      assert.equal(report.rows[0].payload.sessions.length, 1);
      assert.notEqual(report.rows[0].payload.availableFrom, null);
    });
  } finally {
    await database.stop();
  }
});
