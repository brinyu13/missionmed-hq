import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import {
  safeRequestFailureEvent,
  storyForgeContentSecurityPolicy,
} from '../../server/app.mjs';
import { createR2StorageClient } from '../../server/storage.mjs';

test('signed-audio CSP pins one exact configured origin for replay and direct PUT', () => {
  const policy = storyForgeContentSecurityPolicy({
    matrixOrigin: 'https://missionmedinstitute.com',
    audioOrigin: 'https://example-account.r2.cloudflarestorage.com/private/path',
  });
  assert.match(
    policy,
    /media-src 'self' blob: https:\/\/example-account\.r2\.cloudflarestorage\.com/,
  );
  assert.match(
    policy,
    /connect-src 'self' https:\/\/example-account\.r2\.cloudflarestorage\.com/,
  );
  assert.equal(policy.includes('*.r2.cloudflarestorage.com'), false);
  assert.equal(policy.includes('/private/path'), false);
});

test('invalid or credential-bearing audio endpoints add no CSP source', () => {
  for (const audioOrigin of [
    '',
    'javascript:alert(1)',
    'https://user:secret@example-account.r2.cloudflarestorage.com',
  ]) {
    const policy = storyForgeContentSecurityPolicy({
      matrixOrigin: 'https://missionmedinstitute.com',
      audioOrigin,
    });
    assert.match(policy, /media-src 'self' blob:;/);
    assert.match(policy, /connect-src 'self';/);
  }
});

test('R2 presigning stays on the same exact origin pinned by CSP', async (t) => {
  const endpoint = 'https://example-account.r2.cloudflarestorage.com';
  const bucket = 'missionmed-storyforge-audio-prod';
  const client = createR2StorageClient({
    endpoint,
    region: 'auto',
    accessKeyId: 'offline-test-access-key',
    secretAccessKey: 'offline-test-secret-key',
  });
  t.after(() => client.destroy());

  for (const command of [
    new PutObjectCommand({
      Bucket: bucket,
      Key: 'storyforge-audio/student/story/asset.webm',
      ContentType: 'audio/webm',
    }),
    new GetObjectCommand({
      Bucket: bucket,
      Key: 'storyforge-audio/student/story/asset.webm',
    }),
  ]) {
    const signed = new URL(await getSignedUrl(client, command, { expiresIn: 300 }));
    assert.equal(signed.origin, endpoint);
    assert.match(signed.pathname, new RegExp(`^/${bucket}/`));
  }

  const policy = storyForgeContentSecurityPolicy({
    matrixOrigin: 'https://missionmedinstitute.com',
    audioOrigin: endpoint,
  });
  assert.match(policy, new RegExp(`media-src 'self' blob: ${endpoint}`));
  assert.match(policy, new RegExp(`connect-src 'self' ${endpoint}`));
});

test('every serving layer derives CSP from an exact R2 endpoint without a wildcard', async () => {
  const files = await Promise.all([
    readFile(new URL('../../infra/edge/worker.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../../infra/edge/local-router.mjs', import.meta.url), 'utf8'),
    readFile(
      new URL('../../infra/wordpress/missionmed-storyforge-route.php', import.meta.url),
      'utf8',
    ),
  ]);
  for (const source of files) {
    assert.match(source, /STORYFORGE_R2_ENDPOINT/);
    assert.match(source, /media-src 'self' blob:/);
    assert.match(source, /connect-src 'self'/);
    assert.equal(source.includes('*.r2.cloudflarestorage.com'), false);
  }
});

test('server error reporting cannot carry transcript, token, URL, or exception text', () => {
  const secret = 'Bearer private-token transcript about a named patient';
  const event = safeRequestFailureEvent({
    status: 503,
    code: 'audio_storage_unavailable',
    message: secret,
    stack: `${secret}\nhttps://signed.example/private`,
  }, new Date('2026-07-29T12:00:00.000Z'));
  assert.deepEqual(event, {
    t: '2026-07-29T12:00:00.000Z',
    event: 'request_failed',
    status: 503,
    errorCategory: 'upload',
  });
  assert.equal(JSON.stringify(event).includes(secret), false);
});
