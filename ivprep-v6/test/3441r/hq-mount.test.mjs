import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('HQ forwards the separately consumed Founder test number', async () => {
  const source = await readFile(new URL('../../server/hq-mount.mjs', import.meta.url), 'utf8');
  assert.match(source, /testNo: paidTestAuthorization\.testNo/u);
  assert.doesNotMatch(source, /testNo: 1,/u);
});
