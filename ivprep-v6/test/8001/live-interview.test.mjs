import assert from 'node:assert/strict';
import test from 'node:test';
import { LiveInterviewSession, NATIVE_PLAYBACK_CONTRACT } from '../../public/capabilities/live-interview.mjs';
import { IvocApi } from '../../public/ivoc-standalone/app/api.mjs';

test('native speech boundary is unavailable; delegated response and append receipts never resume the Actor',()=>{
  let hints=0;const session=new LiveInterviewSession({createSession:async()=>({}),endSession:async()=>{},PeerConnection:class {},audioRenderer:{interrupt(trigger){assert.equal(trigger,'candidate-transcript');hints++;},resume(){throw new Error('unsafe resume');}}});
  assert.equal(Object.isFrozen(NATIVE_PLAYBACK_CONTRACT),true);
  assert.deepEqual(session.diagnostics().playbackBoundary,NATIVE_PLAYBACK_CONTRACT);
  assert.equal(NATIVE_PLAYBACK_CONTRACT.responseIdentity,false);
  assert.equal(NATIVE_PLAYBACK_CONTRACT.cancellationAcknowledgment,false);
  for(const event of [{type:'response.event',event:{type:'response.completed',response:{id:'delegated'}}},{type:'session.instructions.appended',client_event_id:'cancel'},{type:'session.output_transcript.delta',delta:'A later fragment',start_ms:9000,end_ms:10000}])session.handleEvent(JSON.stringify(event));
  assert.equal(hints,0);
  session.handleEvent(JSON.stringify({type:'session.input_transcript.delta',delta:'Please stop'}));assert.equal(hints,1);
});

test('provisional transcript preserves provider item/response identities, not speech-boundary claims', () => {
  const events = [];
  const session = new LiveInterviewSession({ onTranscript: event => events.push(event), now: () => 135,
    createSession: async () => ({}), endSession: async () => {}, PeerConnection: class {}, audioElement: {} });
  session.startedAtMs = 100;
  session.handleEvent(JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed',
    item_id: 'candidate-item', response_id: 'prompt-response', transcript: 'My response.' }));
  session.handleEvent(JSON.stringify({ type: 'response.audio_transcript.done',
    item_id: 'prompt-item', response_id: 'prompt-response', transcript: 'An actual follow-up?' }));
  assert.equal(events[0].itemId, 'candidate-item');
  assert.equal(events[0].responseId, 'prompt-response');
  assert.equal(events[0].identity, 'candidate-item');
  assert.equal(events[1].itemId, 'prompt-item');
  assert.equal(events[1].speaker, 'interviewer');
  assert.equal(events[1].observedAtMs, 35);
  assert.equal(events[1].speechStartMs, undefined);
});

test('candidate allocation retries a lost transport response once using identical parent, never HTTP denial', async () => {
  const oldFetch = globalThis.fetch; const calls = [];
  const api = new IvocApi(); api.csrfToken = 'csrf';
  const input = { parentRecordingId: 'parent', captureVersion: 'direct-mic-v1', mime: 'audio/webm' };
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      if (calls.length === 1) throw new TypeError('network response lost');
      return { ok: true, json: async () => ({ id: 'existing-source' }) };
    };
    assert.equal((await api.createCandidateAudio('session', input)).id, 'existing-source');
    assert.equal(calls.length, 2); assert.equal(calls[0].options.body, calls[1].options.body);
    assert.equal(calls[1].options.headers['X-MMHQ-CSRF'], 'csrf');
    calls.length = 0;
    globalThis.fetch = async () => { calls.push({}); return { ok: false, status: 403, json: async () => ({ error: 'denied' }) }; };
    await assert.rejects(api.createCandidateAudio('session', input), /denied/);
    assert.equal(calls.length, 1);
    calls.length = 0;
    globalThis.fetch = async () => { calls.push({}); throw new TypeError('offline'); };
    await assert.rejects(api.createCandidateAudio('session', input), /offline/);
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = oldFetch; }
});
