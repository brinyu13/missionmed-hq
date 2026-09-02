import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { ANALYTICS_ENGINE_VERSION, EVENT_SCHEMA, MATURITY } from '../../public/analytics/event-contract.mjs';
import {
  BEHAVIOR_COACHING_REGISTRY,
  BEHAVIOR_REGISTRY_VERSION,
  REACHABLE_CUES,
  assertBehaviorRegistry,
  assertContextResult,
  assertTranscript,
  deriveCoachCommand,
} from '../../public/ivoc-standalone/app/context-contracts.mjs';

function observation(metric, value, unit, eventId) {
  return { metric, value, unit, reliability: 'high', coverage: 1, eventId };
}

function transcript(text = 'I grew up learning to listen closely to patients.') {
  return {
    status: 'AVAILABLE', transcriptId: 'transcript-1', provider: 'openai', model: 'whisper-1',
    adapter: 'openai-batch-transcription', truthLabel: 'REAL', reason: null, text,
    segments: [{ id: 'seg-1', speaker: 'STUDENT', startMs: 0, endMs: 42_000, text, final: true, score: 0.9, source: 'openai-batch-transcription' }],
    wordCount: text.split(/\s+/u).length, timestamps: 'FINAL_SEGMENTS',
    provenance: { storage: 'EPHEMERAL_REQUEST_MEMORY_ONLY' },
  };
}

function analysis() {
  return {
    status: 'AVAILABLE', schema: 'missionmed.ivoc.context.analysis.v1', analysisId: 'analysis-1',
    sessionId: 'session-1', answerId: 'answer-1', range: { startMs: 0, endMs: 42_000 },
    questionIntent: { label: 'PERSONAL_NARRATIVE', score: 0.9 },
    answerStage: { label: 'EVIDENCE', score: 0.8 },
    semanticObservations: [{ kind: 'SUPPORTED_CLAIM', text: 'The answer explicitly describes listening to patients.', transcriptSegmentIds: ['seg-1'] }],
    contextTags: ['PERSONAL_BACKGROUND'], score: 0.85, coverage: 0.9, limitations: [],
    provenance: { provider: 'openai', model: 'test-model', policyVersion: 'context-v1', truthLabel: 'REAL' },
  };
}

test('Behavior Coaching Registry is versioned, declarative, and limited to the five reachable cues', () => {
  assert.equal(assertBehaviorRegistry(), true);
  assert.equal(BEHAVIOR_COACHING_REGISTRY.registryVersion, BEHAVIOR_REGISTRY_VERSION);
  assert.equal(BEHAVIOR_COACHING_REGISTRY.executableRulesAllowed, false);
  assert.deepEqual(REACHABLE_CUES, ['SLOW_DOWN', 'PICK_UP_PACE', 'SPEAK_UP', 'EASE_VOLUME', 'NO_CUE']);
  assert.equal(BEHAVIOR_COACHING_REGISTRY.entries.find((entry) => entry.id.includes('semantic-gesture')).state, 'UNMEASURABLE_CURRENTLY');
  assert.doesNotMatch(JSON.stringify(BEHAVIOR_COACHING_REGISTRY), /function|javascript|python|sql|wasm/iu);
});

test('arbiter returns one dominant command and clipping outranks pace', () => {
  const command = deriveCoachCommand({
    sessionId: 'session-1', answerId: 'answer-1', issuedAtMs: 42_000,
    transcript: transcript(), analysis: analysis(),
    analyticsObservations: [
      observation('answer_duration_ms', 42_000, 'ms', 'event-duration'),
      observation('digital_clipping_fraction', 0.08, 'fraction', 'event-clipping'),
    ],
    masterDerived: { wordsPerMinute: 210, basis: 'MASTER_DERIVED_FROM_TRANSCRIPT_WORDCOUNT_AND_ANSWER_DURATION' },
    idFactory: () => 'command-1',
  });
  assert.equal(command.cue, 'EASE_VOLUME');
  assert.deepEqual(command.evidence.analyticsEventIds, ['event-clipping']);
  assert.equal(command.evidence.contextAnalysisId, 'analysis-1');
  assert.ok(command.ttlMs > 0);
});

test('arbiter emits NO_CUE when evidence does not cross a registry policy', () => {
  const command = deriveCoachCommand({
    sessionId: 'session-1', answerId: 'answer-1', issuedAtMs: 42_000,
    transcript: transcript(), analysis: analysis(),
    analyticsObservations: [observation('answer_duration_ms', 42_000, 'ms', 'event-duration')],
    masterDerived: { wordsPerMinute: 158, basis: 'MASTER_DERIVED_FROM_TRANSCRIPT_WORDCOUNT_AND_ANSWER_DURATION' },
    idFactory: () => 'command-2',
  });
  assert.equal(command.cue, 'NO_CUE');
  assert.equal(command.ttlMs, 0);
  assert.deepEqual(command.evidence.analyticsEventIds, []);
});

test('mock transcript and hidden-trait analysis fail the claim screen', () => {
  assert.throws(() => assertTranscript(transcript('[MOCK_WHISPER] not real')), /Mock transcript/u);
  const result = {
    schema: 'missionmed.ivoc.context.result.v1', sessionId: 'session-1', answerId: 'answer-1',
    question: { questionId: 'CORE-01', revision: 1, canonicalText: 'Tell me about yourself.', tags: ['CORE'], source: 'founder_core' },
    transcript: transcript(),
    analysis: { ...analysis(), semanticObservations: [{ kind: 'SUPPORTED_CLAIM', text: 'The student is an honest person.', transcriptSegmentIds: ['seg-1'] }] },
    analyticsObservations: [], masterDerived: null,
    coachCommand: deriveCoachCommand({ sessionId: 'session-1', answerId: 'answer-1', issuedAtMs: 1, transcript: transcript(), analysis: analysis(), idFactory: () => 'command-3' }),
    persistence: { transcript: false, analysis: false, behaviorRegistry: false, coachCommand: false },
  };
  assert.throws(() => assertContextResult(result), /claim screen/u);
});

test('live screen registry adds context-lab without touching the pinned processing function', async () => {
  const source = await readFile(new URL('../../public/ivoc-standalone/app/live.mjs', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../../public/ivoc-standalone/app/real-runtime.mjs', import.meta.url), 'utf8');
  assert.match(source, /'context-lab': \{ render: contextLabScreen/u);
  assert.match(source, /async function finishToProcessing\(runtimeResult = null, recordingResult = null\)/u);
  assert.match(source, /wpmLastObserved: INSTRUMENTS\[0\]._lastWpm \?\? null/u);
  assert.match(runtime, /endAnalytics\(\{ transcript: '', mediaAvailable: true \}\)/u);
});

test('Analytics contract constants remain the accepted frozen values', () => {
  assert.equal(EVENT_SCHEMA, 'missionmed.ivprep.analytics.event.v1');
  assert.equal(ANALYTICS_ENGINE_VERSION, '3420r-1.0.0');
  assert.equal(MATURITY.STUDENT_SAFE, 'VALIDATED_STUDENT_SAFE');
});
