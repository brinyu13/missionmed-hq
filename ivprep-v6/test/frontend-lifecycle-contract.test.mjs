import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const integration = await readFile(new URL('../public/v6-integration.mjs', import.meta.url), 'utf8');

test('turn completion is single-entry and stale callbacks are rejected', () => {
  assert.match(html, /function endTake\(\)\{if\(!REC\|\|TURN_FINALIZING\)return;/);
  assert.match(html, /if\(SEQTOK!==turnToken\|\|RUN\.qi!==questionIndex\|\|VIEW!=='room'\)return;/);
  assert.match(html, /const openMic=\(\)=>\{if\(tok!==SEQTOK\|\|VIEW!=='room'\|\|REC\)return;/);
  assert.match(html, /cancelTurn\('navigation'\);stopMedia\(\)/);
});

test('frontier evidence preserves the answered question and generated follow-up separately', () => {
  assert.match(html, /take\.generatedUtterance=frontierTurn\.utterance/);
  assert.match(html, /question:t\.q,answer:t\.transcript\|\|'',generatedUtterance:t\.generatedUtterance\|\|null/);
  assert.match(html, /providerObserverModel:t\.providerObserverModel\|\|null/);
  assert.match(integration, /providerObserverModel: state\.providerObserverModel/);
  assert.match(integration, /INTERVIEWER QUESTION ANSWERED:/);
  assert.match(integration, /COMPLETED NEXT INTERVIEWER UTTERANCE:/);
});

test('metrics-only history never labels its action as Replay', () => {
  assert.match(html, /last\.blobUrl\?'replayRep\(\\''\+last\.id\+'\\'\)':'openLastResults\(\)'/);
  assert.match(html, /last\.blobUrl\?'▶ Replay':'Evidence \/ Results'/);
});

test('plan exhaustion fails closed unless the provider returns a real closing utterance', () => {
  assert.match(html, /if\(planExhausted&&!frontierTurn\.terminated&&!frontierTurn\.final\)\{fail\(new Error\('The interviewer did not return a valid closing utterance\./);
  assert.doesNotMatch(html, /setTimeout\(nextQ/);
});

test('a no-transcript failure reopens a clean protected answer window for typed recovery', () => {
  assert.match(html, /if\(!take\.transcript\).*RUN\.takes\.pop\(\)/s);
  assert.match(html, /No usable transcript was captured\. The protected answer window is open again/);
  assert.match(integration, /if \(!bridge\.recording\) \{\s*if \(bridge\.view !== 'room' \|\| state\.activeExchangeController\)/);
  assert.match(integration, /bridge\.beginRec\(\);\s*\}\s*const answer = bridge\.setTypedTranscript/);
});

test('student-facing copy distinguishes observation from inference and discloses provider boundaries', () => {
  assert.doesNotMatch(html, /media never leaves this tab|body language is read|Hands suggest intention|read deliberate silence as confidence|silence is a power move|Their personality · the bird read|Personality read:/);
  assert.match(html, /raw recording stays local to this tab/);
  assert.match(html, /interview text may be sent to the configured OpenAI service/);
  assert.match(html, /browser speech recognition follows the browser implementation/);
  assert.match(html, /do not infer trust or intent from hand position/);
});

test('interactive selectors and question ordering have keyboard-operable controls', () => {
  assert.match(html, /<button type="button" class="selpick on" aria-pressed="true" data-plat="zoom"/);
  assert.match(html, /createElement\('button'\);d\.type='button';d\.className='qRow'/);
  assert.match(html, /function moveQ\(i,delta\)/);
  assert.match(html, /aria-label="Move question /);
  assert.match(html, /aria-label="Switch active role"/);
});
