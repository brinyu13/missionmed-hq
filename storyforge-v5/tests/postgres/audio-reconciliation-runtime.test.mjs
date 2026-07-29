import assert from 'node:assert/strict';
import test from 'node:test';

import { createPhaseOneRuntime } from '../../server/app.mjs';
import { appendServiceAudit } from '../../server/db.mjs';
import {
  startEphemeralStoryForgeDatabase,
  withIdentity,
  withRole,
} from './helpers/ephemeral-postgres.mjs';

const STUDENT = Object.freeze({
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'student',
  wpUserId: 1101,
});
const assetIds = Object.freeze({
  pending: '91000000-0000-4000-8000-000000000001',
  uploaded: '91000000-0000-4000-8000-000000000002',
  verified: '91000000-0000-4000-8000-000000000003',
  retired: '91000000-0000-4000-8000-000000000004',
  absent: '91000000-0000-4000-8000-000000000005',
});

function storageFixture(objects, {
  deleteAudioObject = async ({ objectKey }) => {
    objects.delete(objectKey);
  },
  markerState = { value: null },
} = {}) {
  return {
    async putRecordingSegment() {
      throw new Error('not used');
    },
    async getRecordingSegment() {
      throw new Error('not used');
    },
    async deleteRecordingObjects() {
      throw new Error('not used');
    },
    async deleteAudioAssetObject() {
      throw new Error('not used');
    },
    async listAudioObjectsPage({ prefix, continuationToken, maxKeys }) {
      assert.equal(prefix, 'storyforge-audio/');
      assert.equal(continuationToken, null);
      assert.equal(maxKeys, 1000);
      return {
        objects: [...objects.values()],
        continuationToken: null,
        truncated: false,
      };
    },
    async readAudioControlObject() {
      return markerState.value;
    },
    async writeAudioControlObject({ value }) {
      markerState.value = structuredClone(value);
    },
    deleteAudioObject,
  };
}

test('the production runtime uses the service principal for state checks and bounded reconciliation audits', async () => {
  const database = await startEphemeralStoryForgeDatabase();
  const { client } = database;
  try {
    const story = await withIdentity(client, STUDENT, async (identityClient) => {
      const result = await identityClient.query(
        `SELECT (public.sf_create_story_v5($1::jsonb, 'quick')).*`,
        [JSON.stringify({
          captureType: 'text',
          title: 'Reconciliation PostgreSQL state matrix',
          text: 'Content-free lifecycle proof.',
        })],
      );
      return result.rows[0];
    });
    const keys = Object.fromEntries(
      Object.entries(assetIds).map(([state, id]) => [
        state,
        `storyforge-audio/${STUDENT.sub}/${story.id}/${id}.webm`,
      ]),
    );
    for (const state of ['pending', 'uploaded', 'verified', 'retired']) {
      await client.query(
        `INSERT INTO public.sf_audio_assets (
           id, story_id, student_id, object_key, content_type, byte_size, state
         )
         VALUES ($1, $2, $3, $4, 'audio/webm', 64, $5)`,
        [assetIds[state], story.id, STUDENT.sub, keys[state], state],
      );
    }

    const directMatrix = await withRole(client, 'storyforge_app', async (serviceClient) => {
      const result = await serviceClient.query(
        'SELECT * FROM public.sf_voice_audio_reference_check($1::text[])',
        [[
          keys.pending,
          keys.uploaded,
          keys.verified,
          keys.retired,
          keys.absent,
        ]],
      );
      return result.rows;
    });
    assert.deepEqual(directMatrix, [
      { object_key: keys.pending, referenced: true },
      { object_key: keys.uploaded, referenced: true },
      { object_key: keys.verified, referenced: true },
      { object_key: keys.retired, referenced: false },
      { object_key: keys.absent, referenced: false },
    ]);
    await assert.rejects(
      withIdentity(client, STUDENT, (identityClient) => identityClient.query(
        'SELECT * FROM public.sf_voice_audio_reference_check($1::text[])',
        [[keys.absent]],
      )),
      (error) => error.code === '42501',
    );

    const old = new Date(Date.now() - (8 * 24 * 60 * 60 * 1000));
    const objects = new Map(
      Object.values(keys).map((objectKey, index) => [
        objectKey,
        {
          objectKey,
          byteSize: 100 + index,
          lastModified: old,
        },
      ]),
    );
    const environment = {
      STORYFORGE_AUDIO_RECONCILIATION: 'dry_run',
    };
    const markerState = { value: null };
    const deleted = [];
    const deleteAttempts = new Map();
    let identityTransactions = 0;
    let serviceTransactions = 0;
    const runtime = createPhaseOneRuntime({
      identityTransaction: async () => {
        identityTransactions += 1;
        throw new Error('reconciliation must not use authenticated transactions');
      },
      serviceTransaction: async (operation) => {
        serviceTransactions += 1;
        return withRole(client, 'storyforge_app', operation);
      },
      serviceAuditWriter: appendServiceAudit,
      eventWriter() {},
      environment,
      storage: storageFixture(objects, {
        markerState,
        async deleteAudioObject({ objectKey }) {
          const attempts = (deleteAttempts.get(objectKey) || 0) + 1;
          deleteAttempts.set(objectKey, attempts);
          if (objectKey === keys.absent && attempts === 1) {
            throw new Error('one bounded storage retry');
          }
          deleted.push(objectKey);
          objects.delete(objectKey);
        },
      }),
    });

    const dryRun = await runtime.recordingsService.runWeeklyAudioReconciliation();
    assert.deepEqual(dryRun.wouldDelete, [keys.retired, keys.absent]);
    assert.equal(dryRun.referenced, 3);
    assert.equal(dryRun.deleted, 0);
    assert.deepEqual(deleted, []);
    const beforeOnAuditCount = await client.query(
      `SELECT count(*)::integer AS count
       FROM public.sf_audit_events
       WHERE action IN ('reconciliation_deleted','object_delete_retried')`,
    );
    assert.equal(beforeOnAuditCount.rows[0].count, 0);

    markerState.value.completedAt = new Date(
      Date.now() - (8 * 24 * 60 * 60 * 1000),
    ).toISOString();
    environment.STORYFORGE_AUDIO_RECONCILIATION = 'on';
    const onRun = await runtime.recordingsService.runWeeklyAudioReconciliation();
    assert.equal(onRun.aborted, false);
    assert.equal(onRun.deleted, 2);
    assert.equal(onRun.retried, 1);
    assert.deepEqual(deleted, [keys.retired, keys.absent]);
    assert.deepEqual([...objects.keys()], [
      keys.pending,
      keys.uploaded,
      keys.verified,
    ]);
    assert.equal(identityTransactions, 0);
    assert.ok(serviceTransactions >= 5);

    const audits = await client.query(
      `SELECT action, entity_id, actor_id, actor_role, actor_display, surface,
              student_id, story_id, previous_value, new_value, detail
       FROM public.sf_audit_events
       WHERE action IN ('reconciliation_deleted','object_delete_retried')
       ORDER BY id`,
    );
    assert.deepEqual(audits.rows, [
      {
        action: 'reconciliation_deleted',
        entity_id: assetIds.retired,
        actor_id: null,
        actor_role: 'service',
        actor_display: 'StoryForge system',
        surface: 'system',
        student_id: STUDENT.sub,
        story_id: story.id,
        previous_value: null,
        new_value: { byteSize: 103, objectCount: 1 },
        detail: null,
      },
      {
        action: 'object_delete_retried',
        entity_id: assetIds.absent,
        actor_id: null,
        actor_role: 'service',
        actor_display: 'StoryForge system',
        surface: 'system',
        student_id: STUDENT.sub,
        story_id: story.id,
        previous_value: null,
        new_value: { objectCount: 1, retryCount: 1 },
        detail: null,
      },
      {
        action: 'reconciliation_deleted',
        entity_id: assetIds.absent,
        actor_id: null,
        actor_role: 'service',
        actor_display: 'StoryForge system',
        surface: 'system',
        student_id: STUDENT.sub,
        story_id: story.id,
        previous_value: null,
        new_value: { byteSize: 104, objectCount: 1 },
        detail: null,
      },
    ]);
    await assert.rejects(
      withRole(client, 'storyforge_app', (serviceClient) => serviceClient.query(
        `UPDATE public.sf_audit_events
         SET new_value = '{"objectCount":2}'::jsonb
         WHERE action = 'reconciliation_deleted'`,
      )),
      (error) => error.code === '42501',
    );

    await client.query(
      'DROP FUNCTION public.sf_voice_audio_reference_check(text[])',
    );
    let deletesAfterRollback = 0;
    const rollbackRuntime = createPhaseOneRuntime({
      identityTransaction: async () => {
        throw new Error('not used');
      },
      serviceTransaction: (operation) => withRole(
        client,
        'storyforge_app',
        operation,
      ),
      serviceAuditWriter: appendServiceAudit,
      eventWriter() {},
      environment: { STORYFORGE_AUDIO_RECONCILIATION: 'on' },
      storage: storageFixture(new Map([[
        keys.absent,
        {
          objectKey: keys.absent,
          byteSize: 104,
          lastModified: old,
        },
      ]]), {
        async deleteAudioObject() {
          deletesAfterRollback += 1;
        },
      }),
    });
    const rolledBack = await (
      rollbackRuntime.recordingsService.runWeeklyAudioReconciliation()
    );
    assert.equal(rolledBack.aborted, true);
    assert.equal(rolledBack.abortReason, 'reference_check_failed');
    assert.equal(rolledBack.deleted, 0);
    assert.equal(deletesAfterRollback, 0);
  } finally {
    await database.stop();
  }
});
