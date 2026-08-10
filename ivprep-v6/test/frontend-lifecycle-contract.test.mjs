import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const integration = await readFile(new URL('../public/v6-integration.mjs', import.meta.url), 'utf8');
const continuousRail = await readFile(new URL('../public/conversation-rail.mjs', import.meta.url), 'utf8');

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
  assert.match(integration, /if \(state\.railId === RAIL_IDS\.OPENAI_REALTIME\)[\s\S]*continuousRail\?\.submitText\(answer\)/);
  assert.match(integration, /bridge\.setTypedTranscript\(answer\);\s*bridge\.endTake\(\)/);
});

test('student-facing copy distinguishes observation from inference and discloses provider boundaries', () => {
  assert.doesNotMatch(html, /media never leaves this tab|body language is read|Hands suggest intention|read deliberate silence as confidence|silence is a power move|Their personality · the bird read|Personality read:/);
  assert.match(html, /Continuous Conversation streams microphone audio to OpenAI Realtime/);
  assert.match(html, /High-Intelligence Voice sends completed interview text/);
  assert.match(html, /local replay recording stays in this tab/);
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

test('continuous PCM scheduling drains before turn settlement and rejects stale audio', () => {
  assert.match(continuousRail, /this\.pendingSchedules \+= 1/);
  assert.match(continuousRail, /generation !== this\.playbackGeneration/);
  assert.match(continuousRail, /continuousTurnReadiness\(\{/);
  assert.match(continuousRail, /if \(readiness === 'draining' \|\| readiness === 'waiting-for-transcript-pair'\) return/);
  assert.match(continuousRail, /this\.playbackGeneration \+= 1/);
});

test('founder rail, model, voice, and behavior selections are immutable during an active interview', () => {
  assert.match(integration, /Conversation Rail is fixed during an active interview/);
  assert.match(integration, /Interviewer model is fixed during an active interview/);
  assert.match(integration, /Voice is fixed during an active interview/);
  assert.match(integration, /Interviewer behavior is fixed during an active interview/);
});

test('continuous room removes legacy manual-turn and coaching clutter while keeping essential controls', () => {
  assert.match(integration, /body\.frontier-focus-room #roomctl \{ display:none !important; \}/);
  assert.match(integration, /body\.frontier-focus-room #teledrawer/);
  assert.match(integration, /body\.frontier-focus-room #side/);
  assert.match(integration, /Listening — pause naturally\. The interviewer will respond when you finish\./);
  assert.match(integration, /typeInstead\.textContent = 'Type instead'/);
  assert.match(integration, /end\.id = 'frontier-end'/);
});
