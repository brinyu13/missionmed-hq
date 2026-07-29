import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../../public/app.js', import.meta.url), 'utf8');

test('private local voice buffers carry timestamps and expire on the R2 backstop horizon', () => {
  assert.match(source, /VOICE_LOCAL_RETENTION_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(source, /createdAt: Number\(record\.createdAt\) \|\| Date\.now\(\)/);
  assert.match(source, /function purgeExpiredVoiceSegments\(/);
  assert.match(source, /objectStore\.delete\(key\)/);
  assert.match(source, /await purgeExpiredVoiceSegments\(database\)/);
});
