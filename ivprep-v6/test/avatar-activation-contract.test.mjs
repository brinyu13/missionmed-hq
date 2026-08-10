import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const browserProvider = await readFile(new URL('../public/avatar-provider.mjs', import.meta.url), 'utf8');
const integration = await readFile(new URL('../public/v6-integration.mjs', import.meta.url), 'utf8');

test('browser activation waits for synchronized audio, video, and playable audio before claiming live', () => {
  assert.match(browserProvider, /const mediaSubscribed = new Promise/);
  assert.match(browserProvider, /import \{ liveMediaReady \} from '.\/avatar\/media-readiness\.mjs'/);
  assert.match(browserProvider, /if \(liveMediaReady\(this\)\)/);
  assert.match(browserProvider, /Promise\.race\(\[\s*mediaSubscribed,/);
  assert.match(browserProvider, /videoReady: true, audioReady: true, audioPlaybackReady: true/);
  assert.match(browserProvider, /api\/avatar\/session\/stop/);
  assert.match(browserProvider, /await this\.#detach\(\)/);
});

test('live media attachment is unmirrored, inline, and removed when unsubscribed', () => {
  assert.match(browserProvider, /element\.playsInline = true/);
  assert.match(browserProvider, /transform:none/);
  assert.match(browserProvider, /RoomEvent\.TrackUnsubscribed/);
  assert.match(browserProvider, /track\.detach\(attached\.element\)/);
});

test('browser reconnect and playback results preserve the server provider contract', () => {
  assert.match(browserProvider, /api\/avatar\/session\/reconnect/);
  assert.match(browserProvider, /let finalResponse = null/);
  assert.match(browserProvider, /return \{ \.\.\.finalResponse, accepted:/);
  assert.doesNotMatch(browserProvider, /await this\.#detach\(\);\s*return this\.start\(\)/);
});

test('browser binds every provider control to the active alpha session and interruption event', () => {
  assert.match(browserProvider, /const alphaSessionId = String\(configuration\.alphaSessionId/);
  assert.match(browserProvider, /this\.alphaSessionId = alphaSessionId/);
  assert.match(browserProvider, /alphaSessionId: this\.alphaSessionId/);
  assert.match(browserProvider, /activeAudioEventId/);
  assert.match(browserProvider, /api\/avatar\/session\/interrupt[\s\S]*eventId/);
});

test('avatar speech participates in microphone barge-in and shared speaking guards', () => {
  assert.match(integration, /state\.avatarSpeechActive = true;[\s\S]*?setInterviewerSpeaking\(true, 'streaming'\)/);
  assert.match(integration, /finally \{[\s\S]*?state\.avatarSpeechActive = false;[\s\S]*?setInterviewerSpeaking\(false,/);
  assert.match(integration, /await interruptAudio\('superseded'\)/);
  assert.match(integration, /if \(!state\.interviewerSpeaking\) return bridge\.toast\('The interviewer is not speaking\.'\)/);
  assert.match(integration, /if \(state\.interviewerSpeaking\) return bridge\.toast\('Interrupt the interviewer before submitting an answer\.'\)/);
});

test('durable alpha completion is attempted independently from avatar cleanup', () => {
  assert.match(integration, /const persistEnd = async \(\) =>/);
  assert.match(integration, /try \{ if \(avatar\.health\(\)\.state !== 'idle'\) await avatar\.stop\(terminationState\); \} catch \(error\) \{ errors\.push\(error\); \}\s*try \{ await persistEnd\(\); \} catch/);
  assert.match(integration, /if \(keepalive\) \{\s*try \{ await persistEnd\(\); \} catch/);
});
