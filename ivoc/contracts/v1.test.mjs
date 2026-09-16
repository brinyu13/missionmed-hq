import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  assertAnswerSegment,
  assertCoachingEvidence,
  assertConversationTurn,
  assertProjectionEnvelope,
  assertResultSet,
  assertSession,
} from './index.mjs';

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));
}

test('v1 contract fixtures cover session, turn, segment, evidence, result, and projection', async () => {
  const values = await Promise.all([
    fixture('session.v1.json'),
    fixture('conversation-turn.v1.json'),
    fixture('answer-segment.v1.json'),
    fixture('coaching-evidence.v1.json'),
    fixture('result-set.v1.json'),
    fixture('projection-envelope.v1.json'),
  ]);
  assert.equal(assertSession(values[0]), values[0]);
  assert.equal(assertConversationTurn(values[1]), values[1]);
  assert.equal(assertAnswerSegment(values[2]), values[2]);
  assert.equal(assertCoachingEvidence(values[3]), values[3]);
  assert.equal(assertResultSet(values[4]), values[4]);
  assert.equal(assertProjectionEnvelope(values[5]), values[5]);
});

test('v1 contracts fail closed on invalid ownership, time, and evidence shapes', async () => {
  const sessionValue = await fixture('session.v1.json');
  const segment = await fixture('answer-segment.v1.json');
  const result = await fixture('result-set.v1.json');
  const projection = await fixture('projection-envelope.v1.json');
  assert.throws(() => assertSession({ ...sessionValue, pressure_modifier: true }), /pressure modifier/);
  assert.throws(() => assertAnswerSegment({
    ...segment,
    answer: { ...segment.answer, t_end_ms: segment.answer.t_start_ms - 1 },
  }), /time range/);
  assert.throws(() => assertResultSet({ ...result, evidence_index_ref: '' }), /evidence_index_ref/);
  assert.throws(() => assertProjectionEnvelope({
    ...projection,
    authorization: { basis: 'implicit', scope: [] },
  }), /authorization/);
});
