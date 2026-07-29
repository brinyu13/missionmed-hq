import { test, expect } from '@playwright/test';
import { createPhaseOneRuntime } from '../../server/app.mjs';

const studentId = '22222222-2222-4222-8222-222222222222';
const storyId = '33333333-3333-4333-8333-333333333333';
const referencedAssetId = '44444444-4444-4444-8444-444444444444';
const optionAAssetId = '55555555-5555-4555-8555-555555555555';
const optionBAssetId = '66666666-6666-4666-8666-666666666666';
const controlKey = 'storyforge-audio/_control/reconciliation.json';

function permanentObject(objectKey, {
  byteSize,
  lastModified = new Date(Date.now() - (8 * 24 * 60 * 60 * 1000)),
} = {}) {
  return {
    objectKey,
    byteSize,
    lastModified,
  };
}

test('a storage-fake dry-run then on cycle deletes only the exact ruled orphan set', async () => {
  const referencedKey = (
    `storyforge-audio/${studentId}/${storyId}/${referencedAssetId}.webm`
  );
  const optionAKey = (
    `storyforge-audio/${studentId}/${storyId}/${optionAAssetId}.m4a`
  );
  const optionBKey = (
    `storyforge-audio/${studentId}/${storyId}/${optionBAssetId}/seg-00000.webm`
  );
  const youngKey = (
    `storyforge-audio/${studentId}/${storyId}/77777777-7777-4777-8777-777777777777.ogg`
  );
  const invalidKey = `storyforge-audio/${studentId}/${storyId}/not-an-asset.webm`;
  const transientKey = (
    `storyforge-rec/${studentId}/88888888-8888-4888-8888-888888888888/seg-00000.webm`
  );
  const objects = new Map([
    [referencedKey, permanentObject(referencedKey, { byteSize: 101 })],
    [optionAKey, permanentObject(optionAKey, { byteSize: 202 })],
    [optionBKey, permanentObject(optionBKey, { byteSize: 303 })],
    [youngKey, permanentObject(youngKey, {
      byteSize: 404,
      lastModified: new Date(Date.now() - (6 * 24 * 60 * 60 * 1000)),
    })],
    [invalidKey, permanentObject(invalidKey, { byteSize: 505 })],
    [transientKey, permanentObject(transientKey, { byteSize: 606 })],
  ]);
  const referencedKeys = new Set([referencedKey]);
  const deletedKeys = [];
  const serviceAudits = [];
  const events = [];
  const environment = {
    STORYFORGE_AUDIO_RECONCILIATION: 'dry_run',
  };
  let marker = null;
  let identityTransactions = 0;
  let serviceTransactions = 0;

  const client = {
    async query(sql, parameters) {
      expect(sql).toContain('sf_voice_audio_reference_check');
      const keys = parameters[0];
      return {
        rows: keys.map((objectKey) => ({
          object_key: objectKey,
          referenced: referencedKeys.has(objectKey),
        })),
      };
    },
  };
  const runtime = createPhaseOneRuntime({
    identityTransaction: async () => {
      identityTransactions += 1;
      throw new Error('reconciliation must not use an authenticated transaction');
    },
    serviceTransaction: async (operation) => {
      serviceTransactions += 1;
      return operation(client);
    },
    serviceAuditWriter: async (_client, event) => {
      serviceAudits.push(event);
    },
    eventWriter(event) {
      events.push(event);
    },
    environment,
    storage: {
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
        expect(prefix).toBe('storyforge-audio/');
        expect(continuationToken).toBeNull();
        expect(maxKeys).toBe(1000);
        return {
          objects: [...objects.values()].filter((object) => (
            object.objectKey.startsWith(prefix)
          )),
          continuationToken: null,
          truncated: false,
        };
      },
      async readAudioControlObject({ objectKey }) {
        expect(objectKey).toBe(controlKey);
        return marker;
      },
      async writeAudioControlObject({ objectKey, value }) {
        expect(objectKey).toBe(controlKey);
        marker = structuredClone(value);
      },
      async deleteAudioObject({ objectKey }) {
        deletedKeys.push(objectKey);
        objects.delete(objectKey);
      },
    },
  });

  const dryRun = await runtime.recordingsService.runWeeklyAudioReconciliation();
  expect(dryRun.mode).toBe('dry_run');
  expect(dryRun.aborted).toBe(false);
  expect(dryRun.wouldDelete).toEqual([optionAKey, optionBKey]);
  expect(dryRun.deleted).toBe(0);
  expect(deletedKeys).toEqual([]);
  expect(serviceAudits).toEqual([]);
  expect(marker.mode).toBe('dry_run');

  marker.completedAt = new Date(Date.now() - (8 * 24 * 60 * 60 * 1000)).toISOString();
  environment.STORYFORGE_AUDIO_RECONCILIATION = 'on';
  const onRun = await runtime.recordingsService.runWeeklyAudioReconciliation();

  expect(onRun.mode).toBe('on');
  expect(onRun.aborted).toBe(false);
  expect(onRun.wouldDelete).toEqual([optionAKey, optionBKey]);
  expect(onRun.deleted).toBe(2);
  expect(deletedKeys).toEqual([optionAKey, optionBKey]);
  expect([...objects.keys()]).toEqual([
    referencedKey,
    youngKey,
    invalidKey,
    transientKey,
  ]);
  expect(serviceAudits).toEqual([
    {
      action: 'reconciliation_deleted',
      entityType: 'audio_asset',
      entityId: optionAAssetId,
      studentId,
      storyId,
      previousValue: null,
      newValue: { objectCount: 1, byteSize: 202 },
    },
    {
      action: 'reconciliation_deleted',
      entityType: 'audio_asset',
      entityId: optionBAssetId,
      studentId,
      storyId,
      previousValue: null,
      newValue: { objectCount: 1, byteSize: 303 },
    },
  ]);
  expect(identityTransactions).toBe(0);
  expect(serviceTransactions).toBe(4);
  expect(events.filter((event) => event.event === 'audio_reconciliation')).toHaveLength(2);
  expect(marker.mode).toBe('on');
  expect(marker.counts.deleted).toBe(2);
});
