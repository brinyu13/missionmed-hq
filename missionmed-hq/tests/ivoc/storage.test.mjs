import assert from 'node:assert/strict';
import test from 'node:test';

import { createIvocStorage } from '../../ivoc/storage.mjs';

test('signed recording upload uses an opaque token and expiring URL', () => {
  let now = 1_800_000_000_000;
  const storage = createIvocStorage({ mediaBase: 'https://media.test', sessionSecret: 's'.repeat(64), now: () => now });
  const upload = storage.createUpload({ ownerSubject: 'wp:42', recordingId: '00000000-0000-4000-8000-000000000042', extension: 'webm' });
  assert.match(upload.uploadUrl, /^https:\/\/media\.test\/dboc-iv\/wp_42\/ivoc_[0-9a-f-]+\.webm\?/u);
  assert.equal(upload.objectKey.split('/').length, 3);
  assert.ok(!upload.uploadToken.includes('dboc-iv'));
  assert.equal(storage.validateUploadToken({
    recordingId: '00000000-0000-4000-8000-000000000042', objectKey: upload.objectKey,
    expiresAtMs: upload.tokenExpiresAtMs, uploadToken: upload.uploadToken,
  }), true);
  now = upload.tokenExpiresAtMs + 1;
  assert.equal(storage.validateUploadToken({
    recordingId: '00000000-0000-4000-8000-000000000042', objectKey: upload.objectKey,
    expiresAtMs: upload.tokenExpiresAtMs, uploadToken: upload.uploadToken,
  }), false);
});
