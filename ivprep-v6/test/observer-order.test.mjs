import test from 'node:test';
import assert from 'node:assert/strict';

import { createInterviewerExchange } from '../providers/openai-responses.mjs';

const CONTEXT = Object.freeze({
  latestApplicantAnswer: 'I stayed late to reconcile the medication list.',
  transcript: [],
  plan: [{ id: 'motivation', prompt: 'Why this specialty?' }],
});

function response({ outputText, model, ok = true, status = 200 }) {
  return {
    ok,
    status,
    async json() {
      return { id: 'resp_test', model, output_text: outputText, usage: { input_tokens: 1, output_tokens: 1 } };
    },
  };
}

function observerMetadata() {
  return {
    action: 'FOLLOW_UP',
    activeTopic: 'medication reconciliation',
    evidenceExcerpt: 'reconcile the medication list',
    instructorRationale: 'The follow-up remains grounded in the applicant answer.',
    threadState: 'continued',
    riskFlags: [],
    importantFacts: [{ fact: 'Stayed late', evidenceExcerpt: 'stayed late' }],
    planDisposition: 'stay',
    planQuestionId: 'motivation',
    final: false,
    terminated: false,
    terminationReason: null,
    conductEvidence: null,
  };
}

test('natural interviewer utterance is complete before the separate observer request begins', async () => {
  const calls = [];
  const utterance = 'What did you discover when you reconciled the list?';
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    if (calls.length === 1) return response({ outputText: utterance, model: 'gpt-5.6-terra' });
    return response({ outputText: JSON.stringify(observerMetadata()), model: 'gpt-5.6-luna' });
  };

  const exchange = await createInterviewerExchange({
    apiKey: 'test-key-not-a-secret',
    model: 'gpt-5.6-terra',
    observerModel: 'gpt-5.6-luna',
    behaviorPresetId: 'direct-program-director',
    context: CONTEXT,
    fetchImpl,
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].model, 'gpt-5.6-terra');
  assert.equal(calls[0].text.format, undefined, 'natural language must not be constrained by observer schema');
  assert.equal(calls[1].model, 'gpt-5.6-luna');
  assert.equal(calls[1].text.format.type, 'json_schema');
  assert.equal(JSON.parse(calls[1].input).completedInterviewerUtterance, utterance);
  assert.equal(exchange.utterance, utterance);
  assert.equal(exchange.requestedModel, 'gpt-5.6-terra');
  assert.equal(exchange.model, 'gpt-5.6-terra');
  assert.equal(exchange.observerModel, 'gpt-5.6-luna');
  assert.equal(exchange.metadata.evidenceExcerpt, 'reconcile the medication list');
});

test('observer is never called when natural generation fails', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return response({ outputText: '', model: 'gpt-5.6-terra', ok: false, status: 503 });
  };

  await assert.rejects(
    createInterviewerExchange({
      apiKey: 'test-key-not-a-secret',
      model: 'gpt-5.6-terra',
      observerModel: 'gpt-5.6-luna',
      context: CONTEXT,
      fetchImpl,
    }),
    (error) => error?.code === 'openai_interviewer_failed',
  );
  assert.equal(calls, 1);
});

test('requested and provider-returned model IDs remain separately visible', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return response({ outputText: 'Tell me more.', model: 'gpt-5.6-terra-2026-08-01' });
    return response({ outputText: JSON.stringify(observerMetadata()), model: 'gpt-5.6-luna-2026-08-01' });
  };

  const exchange = await createInterviewerExchange({
    apiKey: 'test-key-not-a-secret',
    model: 'gpt-5.6-terra',
    observerModel: 'gpt-5.6-luna',
    context: CONTEXT,
    fetchImpl,
  });

  assert.equal(exchange.requestedModel, 'gpt-5.6-terra');
  assert.equal(exchange.model, 'gpt-5.6-terra-2026-08-01');
  assert.equal(exchange.observerModel, 'gpt-5.6-luna-2026-08-01');
});
