import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

process.env.STORYFORGE_R2_ENDPOINT = 'https://offline-r2.example';
process.env.STORYFORGE_R2_REGION = 'auto';
process.env.STORYFORGE_R2_BUCKET = 'offline-storyforge-audio';
process.env.STORYFORGE_R2_ACCESS_KEY_ID = 'offline-reconciliation-access';
process.env.STORYFORGE_R2_SECRET_ACCESS_KEY = 'offline-reconciliation-secret';

const {
  deleteAudioObject,
  listAudioObjectsPage,
  readAudioControlObject,
  writeAudioControlObject,
} = await import('../../server/storage.mjs');

const controlKey = 'storyforge-audio/_control/reconciliation.json';

test('reconciliation listing sends a bounded page request and preserves cursor evidence', async (t) => {
  const commands = [];
  t.mock.method(S3Client.prototype, 'send', async (command) => {
    commands.push(command);
    assert.ok(command instanceof ListObjectsV2Command);
    return {
      IsTruncated: true,
      NextContinuationToken: 'next-page',
      Contents: [{
        Key: 'storyforge-audio/student/story/asset.webm',
        Size: 123,
        LastModified: new Date('2026-07-20T00:00:00.000Z'),
        ETag: '"etag-value"',
      }, {
        Key: 'storyforge-audio/student/story/missing-size.webm',
        LastModified: new Date('2026-07-20T00:00:00.000Z'),
      }],
    };
  });

  const page = await listAudioObjectsPage({
    prefix: 'storyforge-audio/',
    continuationToken: 'current-page',
    maxKeys: 5_000,
  });
  assert.equal(commands.length, 1);
  assert.deepEqual(commands[0].input, {
    Bucket: 'offline-storyforge-audio',
    Prefix: 'storyforge-audio/',
    ContinuationToken: 'current-page',
    MaxKeys: 1000,
  });
  assert.deepEqual(page, {
    objects: [{
      objectKey: 'storyforge-audio/student/story/asset.webm',
      byteSize: 123,
      lastModified: new Date('2026-07-20T00:00:00.000Z'),
      etag: 'etag-value',
    }, {
      objectKey: 'storyforge-audio/student/story/missing-size.webm',
      byteSize: null,
      lastModified: new Date('2026-07-20T00:00:00.000Z'),
      etag: '',
    }],
    continuationToken: 'next-page',
    truncated: true,
  });
});

test('reconciliation listing rejects a truncated page without a continuation cursor', async (t) => {
  t.mock.method(S3Client.prototype, 'send', async () => ({
    IsTruncated: true,
    Contents: [],
  }));
  await assert.rejects(
    listAudioObjectsPage({
      prefix: 'storyforge-audio/',
      continuationToken: null,
      maxKeys: 1000,
    }),
    (error) => error.code === 'audio_storage_unavailable',
  );
});

test('control reads distinguish a missing marker from corrupt or unreadable content', async (t) => {
  const responses = [
    Object.assign(new Error('missing'), {
      name: 'NoSuchKey',
      $metadata: { httpStatusCode: 404 },
    }),
    {
      Body: {
        async transformToString() {
          return '{"completedAt":';
        },
      },
    },
    { Body: {} },
    {
      Body: {
        async transformToString() {
          return '{"mode":"dry_run","completedAt":"2026-07-29T12:00:00.000Z"}';
        },
      },
    },
  ];
  t.mock.method(S3Client.prototype, 'send', async (command) => {
    assert.ok(command instanceof GetObjectCommand);
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return response;
  });

  assert.equal(await readAudioControlObject({ objectKey: controlKey }), null);
  await assert.rejects(
    readAudioControlObject({ objectKey: controlKey }),
    SyntaxError,
  );
  await assert.rejects(
    readAudioControlObject({ objectKey: controlKey }),
    (error) => error.code === 'audio_storage_unavailable',
  );
  assert.deepEqual(await readAudioControlObject({ objectKey: controlKey }), {
    mode: 'dry_run',
    completedAt: '2026-07-29T12:00:00.000Z',
  });
});

test('control writes and reconciliation deletes target one exact private key', async (t) => {
  const commands = [];
  t.mock.method(S3Client.prototype, 'send', async (command) => {
    commands.push(command);
    return {};
  });
  const marker = {
    mode: 'dry_run',
    startedAt: '2026-07-29T12:00:00.000Z',
    completedAt: '2026-07-29T12:00:01.000Z',
    counts: { listed: 0 },
  };
  const objectKey = 'storyforge-audio/student/story/asset.webm';

  await writeAudioControlObject({ objectKey: controlKey, value: marker });
  await deleteAudioObject({ objectKey });

  assert.equal(commands.length, 2);
  assert.ok(commands[0] instanceof PutObjectCommand);
  assert.equal(commands[0].input.Bucket, 'offline-storyforge-audio');
  assert.equal(commands[0].input.Key, controlKey);
  assert.equal(commands[0].input.ContentType, 'application/json');
  assert.equal(commands[0].input.Body, JSON.stringify(marker));
  assert.equal(
    commands[0].input.ContentLength,
    Buffer.byteLength(JSON.stringify(marker)),
  );
  assert.ok(commands[1] instanceof DeleteObjectCommand);
  assert.deepEqual(commands[1].input, {
    Bucket: 'offline-storyforge-audio',
    Key: objectKey,
  });
});
