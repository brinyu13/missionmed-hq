import assert from 'node:assert/strict';
import test from 'node:test';

import { createIvocStorage } from '../../ivoc/storage.mjs';

function response({ status = 200, body = '', headers = {} } = {}) {
  return new Response(body, { status, headers });
}

function storageFixture() {
  let now = 1_800_000_000_000;
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    const parsed = new URL(url);
    if (options.method === 'POST' && parsed.searchParams.has('uploads')) {
      return response({ body: '<InitiateMultipartUploadResult><UploadId>opaque-upload-id</UploadId></InitiateMultipartUploadResult>' });
    }
    if (options.method === 'PUT' && parsed.searchParams.has('partNumber')) {
      return response({ headers: { ETag: 'part-etag-1' } });
    }
    if (options.method === 'POST' && parsed.searchParams.has('uploadId')) {
      return response({ body: '<CompleteMultipartUploadResult><ETag>complete-etag</ETag></CompleteMultipartUploadResult>' });
    }
    if (options.method === 'HEAD') return response({ headers: { ETag: 'complete-etag' } });
    if (options.method === 'GET') return response({ body: 'private-media', headers: { 'Content-Type': 'video/webm' } });
    return response({ status: 500 });
  };
  const storage = createIvocStorage({
    endpoint: 'https://account.r2.cloudflarestorage.com',
    accessKeyId: 'test-access-key', secretAccessKey: 'test-secret-key',
    bucket: 'missionmed-cam-production', sessionSecret: 's'.repeat(64),
    now: () => now, fetchImpl,
  });
  return { storage, calls, advance: (value) => { now = value; } };
}

test('private multipart upload is SigV4 authenticated and keeps credentials opaque', async () => {
  const { storage, calls, advance } = storageFixture();
  const recordingId = '00000000-0000-4000-8000-000000000042';
  const upload = await storage.createUpload({ ownerSubject: 'wp:42', recordingId, extension: 'webm', mime: 'video/webm' });
  assert.match(upload.objectKey, /^ivoc\/recordings\/wp_42\/ivoc_[0-9a-f-]+\.webm$/u);
  assert.ok(!upload.uploadToken.includes('ivoc/recordings'));
  assert.ok(!upload.uploadState.includes('opaque-upload-id'));
  assert.equal(storage.validateUploadToken({
    recordingId, objectKey: upload.objectKey, expiresAtMs: upload.tokenExpiresAtMs, uploadToken: upload.uploadToken,
  }), true);
  assert.match(calls[0].options.headers.authorization, /^AWS4-HMAC-SHA256 Credential=test-access-key\//u);
  assert.doesNotMatch(JSON.stringify(calls[0]), /test-secret-key/u);
  assert.equal(new URL(calls[0].url).hostname, 'account.r2.cloudflarestorage.com');
  assert.match(new URL(calls[0].url).pathname, /^\/missionmed-cam-production\/ivoc\/recordings\//u);

  const uploaded = await storage.uploadPart({
    objectKey: upload.objectKey, uploadState: upload.uploadState, part: 1, parts: 1, body: Buffer.from('private-media'),
  });
  const completed = await storage.completeUpload({ objectKey: upload.objectKey, uploadState: uploaded.uploadState });
  assert.equal(completed.etag, '"complete-etag"');
  assert.equal(await storage.verifyObject(upload.objectKey), true);

  advance(upload.tokenExpiresAtMs + 1);
  assert.equal(storage.validateUploadToken({
    recordingId, objectKey: upload.objectKey, expiresAtMs: upload.tokenExpiresAtMs, uploadToken: upload.uploadToken,
  }), false);
});

test('same-origin playback token is scoped, expiring, and proxies private object bytes', async () => {
  const { storage, advance } = storageFixture();
  const recordingId = '00000000-0000-4000-8000-000000000042';
  const objectKey = 'ivoc/recordings/wp_42/ivoc_private.webm';
  const playback = storage.createPlayback({ recordingId, objectKey, disposition: 'inline' });
  assert.ok(!playback.token.includes(objectKey));
  assert.equal(storage.validatePlaybackToken({
    recordingId, objectKey, expiresAtMs: playback.expiresAtMs, playbackToken: playback.token, disposition: 'inline',
  }), true);
  assert.equal(storage.validatePlaybackToken({
    recordingId, objectKey, expiresAtMs: playback.expiresAtMs, playbackToken: playback.token, disposition: 'attachment',
  }), false);
  const media = await storage.fetchObject(objectKey);
  assert.equal(await media.text(), 'private-media');
  advance(playback.expiresAtMs + 1);
  assert.equal(storage.validatePlaybackToken({
    recordingId, objectKey, expiresAtMs: playback.expiresAtMs, playbackToken: playback.token, disposition: 'inline',
  }), false);
});
