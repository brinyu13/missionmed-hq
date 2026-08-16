import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('browser renders the current test and retains the keeper only for the next human action', async () => {
  const source = await readFile(new URL('../../public/aaa/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /AUTHORIZE TEST #\$\{testNo\} ONCE/u);
  assert.match(source, /nextFounderProof\?\.enabled === true && nextFounderProof\.state === 'READY'/u);
  assert.match(source, /state\.founderTestPermit = null/u);
  assert.match(source, /!nextFounderTestReady/u);
});
