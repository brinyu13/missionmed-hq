import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { loadLocalEnvironment } from '../config/load-environment.mjs';
import { OpenAIContinuousRealtimeRail } from '../providers/openai-continuous-realtime.mjs';
import { createOpenAISpeech } from '../providers/openai-speech.mjs';

const FRAME_MS = 100;
const FRAME_BYTES = 24_000 * 2 * FRAME_MS / 1_000;
const FINAL_SILENCE_MS = 12_000;
const PAUSES_MS = Object.freeze([2_000, 5_000, 8_000]);

async function feedPcm(rail, bytes) {
  for (let offset = 0; offset < bytes.length; offset += FRAME_BYTES) {
    const frame = bytes.subarray(offset, Math.min(bytes.length, offset + FRAME_BYTES));
    const bounded = frame.length % 2 === 0 ? frame : frame.subarray(0, frame.length - 1);
    if (bounded.length) rail.appendInputAudio(bounded);
    await delay(FRAME_MS);
  }
}

async function feedSilence(rail, durationMs) {
  const frame = Buffer.alloc(FRAME_BYTES);
  for (let elapsed = 0; elapsed < durationMs; elapsed += FRAME_MS) {
    rail.appendInputAudio(frame);
    await delay(FRAME_MS);
  }
}

async function synthesize(input) {
  const result = await createOpenAISpeech({
    input,
    selection: {
      voiceId: 'cedar',
      speed: 0.92,
      format: 'pcm',
      instructions: 'Speak as an applicant thinking aloud in a residency interview. Keep an unfinished, reflective cadence without adding words.',
    },
  });
  return result.bytes;
}

async function runScenario({ pauseMs, firstPcm, secondPcm }) {
  const events = [];
  let phase = 'before-first-phrase';
  const rail = new OpenAIContinuousRealtimeRail({
    onEvent: (event) => events.push({ ...event, observedPhase: phase, observedAt: Date.now() }),
  });
  const startedAt = Date.now();
  await rail.start({
    model: 'gpt-realtime-2.1',
    voiceId: 'cedar',
    speed: 0.92,
    behaviorPresetId: 'direct-program-director',
    reasoningEffort: 'low',
    context: {
      specialty: 'Internal Medicine',
      interviewType: 'Residency interview',
      syntheticProbe: true,
      currentQuestion: 'Tell me about a challenge that shaped you.',
    },
  });
  phase = 'first-phrase';
  await feedPcm(rail, firstPcm);
  phase = 'mid-sentence-pause';
  await feedSilence(rail, pauseMs);
  const prematureResponse = events.some((event) => event.type === 'response_started' && event.observedPhase === 'mid-sentence-pause');
  phase = 'second-phrase';
  await feedPcm(rail, secondPcm);
  phase = 'final-silence';
  const finalSilenceStartedAt = Date.now();
  await feedSilence(rail, FINAL_SILENCE_MS);
  const deadline = Date.now() + 12_000;
  while (!events.some((event) => event.type === 'response_done') && Date.now() < deadline) await delay(100);
  const speechStopped = events.find((event) => event.type === 'speech_stopped' && event.observedPhase === 'final-silence');
  const responseStarted = events.find((event) => event.type === 'response_started' && event.observedPhase === 'final-silence');
  const transcript = events.filter((event) => event.type === 'input_transcript_done').map((event) => event.transcript).join(' ').trim();
  const assistantTranscript = events.filter((event) => event.type === 'assistant_transcript_done').map((event) => event.transcript).join(' ').trim();
  const result = {
    pauseSeconds: pauseMs / 1_000,
    prematureResponse,
    singleApplicationTurn: !prematureResponse && events.filter((event) => event.type === 'response_started').length === 1,
    providerTranscriptSegments: events.filter((event) => event.type === 'input_transcript_done').length,
    transcript,
    assistantTranscript,
    floorToResponseMs: speechStopped && responseStarted ? responseStarted.observedAt - speechStopped.observedAt : null,
    answerEndToResponseMs: responseStarted ? responseStarted.observedAt - finalSilenceStartedAt : null,
    responseCompleted: events.some((event) => event.type === 'response_done'),
    providerErrors: events.filter((event) => event.type === 'error').map((event) => event.code),
    eventCounts: Object.fromEntries([...new Set(events.map((event) => event.type))].map((type) => [type, events.filter((event) => event.type === type).length])),
    speechPhases: events.filter((event) => event.type === 'speech_started' || event.type === 'speech_stopped').map((event) => ({ type: event.type, phase: event.observedPhase })),
    elapsedMs: Date.now() - startedAt,
  };
  await rail.close();
  return result;
}

loadLocalEnvironment({ path: fileURLToPath(new URL('../.env.local', import.meta.url)) });
if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('OPENAI_API_KEY is required; its value is never printed.');

const firstPcm = await synthesize('The biggest challenge for me was');
const secondPcm = await synthesize('actually when my father became ill.');
const scenarios = [];
for (const pauseMs of PAUSES_MS) scenarios.push(await runScenario({ pauseMs, firstPcm, secondPcm }));

process.stdout.write(`${JSON.stringify({
  probe: 'synthetic-mid-sentence-pause',
  model: 'gpt-realtime-2.1',
  voice: 'cedar',
  turnDetection: { type: 'semantic_vad', eagerness: 'low' },
  caveat: 'Synthetic TTS halves are a repeatable transport/VAD probe, not a substitute for founder microphone naturalness review.',
  scenarios,
}, null, 2)}\n`);
