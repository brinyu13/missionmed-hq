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

test('Founder video preserves the native avatar frame, opens the interview once, and uses provider time', async () => {
  const source = await readFile(new URL('../../public/aaa/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /video\.style\.objectFit = 'contain'/u);
  assert.match(source, /video\.style\.objectPosition = 'center center'/u);
  assert.equal((source.match(/localParticipant\.sendText\(/gu) || []).length, 1);
  assert.match(source, /Begin the interview now\. Greet the student naturally/u);
  assert.match(source, /\{ topic: 'lk\.chat' \}/u);
  assert.match(source, /updateRoomClockFromProvider\(providerTiming\?\.startedAtMs, providerTiming\?\.maximumSeconds\)/u);
  assert.match(source, /terminalReason === 'authorized_deadline'/u);
  assert.match(source, /limit <= 60 \* 60/u);
  assert.match(source, /Interview start failed closed; provider cleanup was requested\./u);
});
