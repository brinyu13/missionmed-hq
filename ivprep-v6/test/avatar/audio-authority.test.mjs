import test from 'node:test';
import assert from 'node:assert/strict';

import {
  selectInterviewerAudioAuthority,
} from '../../avatar/audio-authority.mjs';
import {
  INTERVIEWER_AUDIO_AUTHORITIES,
  InterviewerAudioAuthority,
} from '../../public/avatar/audio-authority.mjs';
import { readFile } from 'node:fs/promises';

const integration = await readFile(new URL('../../public/v6-integration.mjs', import.meta.url), 'utf8');

test('exactly one audible authority is selected for each supported rail state', () => {
  assert.equal(selectInterviewerAudioAuthority({
    railId: 'responses-speech', avatarRequested: true, avatarConnected: true,
  }).authority, INTERVIEWER_AUDIO_AUTHORITIES.LIVEAVATAR_LIVEKIT);
  assert.equal(selectInterviewerAudioAuthority({
    railId: 'responses-speech', avatarRequested: true, avatarConnected: false,
  }).authority, INTERVIEWER_AUDIO_AUTHORITIES.BROWSER_OPENAI_SPEECH);
  const realtime = selectInterviewerAudioAuthority({
    railId: 'openai-realtime-continuous', avatarRequested: true, avatarConnected: true,
  });
  assert.equal(realtime.authority, INTERVIEWER_AUDIO_AUTHORITIES.OPENAI_REALTIME_DIRECT);
  assert.equal(realtime.avatarActive, false);
});

test('a second audible stream cannot begin until the active stream finishes or is interrupted', () => {
  let now = 10;
  const authority = new InterviewerAudioAuthority({ now: () => now });
  authority.begin({ authority: INTERVIEWER_AUDIO_AUTHORITIES.LIVEAVATAR_LIVEKIT, utteranceId: 'u-1' });
  assert.throws(() => authority.begin({
    authority: INTERVIEWER_AUDIO_AUTHORITIES.BROWSER_OPENAI_SPEECH, utteranceId: 'u-1-duplicate',
  }), /already active/);
  now = 42;
  assert.equal(authority.interrupt().reason, 'interrupted');
  authority.begin({ authority: INTERVIEWER_AUDIO_AUTHORITIES.BROWSER_OPENAI_SPEECH, utteranceId: 'u-2' });
  assert.equal(authority.health().active.authority, INTERVIEWER_AUDIO_AUTHORITIES.BROWSER_OPENAI_SPEECH);
  assert.equal(authority.health().duplicateAudioPrevented, true);
});

test('the browser runtime wires the same authority guard around avatar and direct playback', () => {
  assert.match(integration, /import \{ InterviewerAudioAuthority \} from '\.\/avatar\/audio-authority\.mjs'/);
  assert.match(integration, /interviewerAudio\.begin\(\{ authority: 'liveavatar-livekit'/);
  assert.match(integration, /interviewerAudio\.begin\(\{ authority: 'browser-openai-speech'/);
  assert.match(integration, /interviewerAudio\.begin\(\{ authority: 'openai-realtime-direct'/);
  assert.match(integration, /interviewerAudio\.interrupt\(\)/);
});
