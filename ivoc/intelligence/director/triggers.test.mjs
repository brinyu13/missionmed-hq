import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateReactiveTriggers, extractDurationMentions, evaluateLiveConsistency } from './triggers.mjs';
import { DeterministicSemanticMatcher, UnavailableSemanticMatcher, sanitizeMatcherResult } from './semantic-matcher.mjs';
import { tokenize } from '../pack/trigger-index.mjs';
import { scenario, buildPack } from '../test-helpers.mjs';

test('reactive triggers match the genetics research probe on a research mention, with provenance', async () => {
  const s = await scenario('reactive');
  const pack = buildPack(s);
  const matches = evaluateReactiveTriggers(pack, s.scen.answer_text);
  assert.ok(matches.length >= 1);
  const top = pack.signals.find((sig) => sig.signal_id === matches[0].signal_id);
  assert.equal(top.rule_id, 'AIS-R01');
  assert.match(top.possible_probes[0], /genetics/u);
  assert.ok(matches[0].matched_lexemes.includes('research'));
  assert.ok(matches[0].matched_lexemes.includes('genetic'));
  const genetics = pack.facts.find((f) => f.fact_type === 'research_item' && f.attributes.field === 'genetics');
  assert.ok(top.fact_refs.includes(genetics.fact_id));
  assert.equal(genetics.provenance.projection_id, 'fx-cv-001');
  assert.deepEqual(evaluateReactiveTriggers(pack, 'I enjoy hiking and cooking on weekends.'), []);
  assert.deepEqual(evaluateReactiveTriggers(pack, ''), []);
  assert.throws(() => evaluateReactiveTriggers(pack, 42), /text must be a string/u);
});

test('duration mentions and answer-versus-document consistency are deterministic and neutral', () => {
  assert.deepEqual(extractDurationMentions('I spent six months there and two years at home.').map((m) => m.months), [6, 24]);
  assert.deepEqual(extractDurationMentions('about 3 weeks').map((m) => m.months), [0.8]);
  assert.deepEqual(extractDurationMentions('no durations here'), []);
});

test('live consistency flags a duration that differs from the document as a gentle clarification', async () => {
  const s = await scenario('consistency');
  const pack = buildPack(s);
  const findings = evaluateLiveConsistency(pack, s.scen.answer_text);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].relation, 'date_range_mismatch');
  assert.equal(findings[0].stance, 'interviewer_plausible');
  assert.match(findings[0].probe, /^Help me line up the timeline of Riverbend General Hospital\.$/u);
  assert.deepEqual(evaluateLiveConsistency(pack, 'I spent two months at Riverbend General Hospital.'), []);
  assert.deepEqual(evaluateLiveConsistency(pack, 'I spent six months somewhere unrelated.'), []);
});

test('semantic matcher interface: deterministic implementation, unavailable fallback, sanitized ids', async () => {
  const s = await scenario('reactive');
  const pack = buildPack(s);
  const matcher = new DeterministicSemanticMatcher({ tokenize });
  const result = sanitizeMatcherResult(pack, await matcher.match(pack, s.scen.answer_text));
  assert.equal(result.state, 'ok');
  assert.ok(result.matches.length >= 1);
  assert.ok(result.matches.every((m) => pack.signals.some((sig) => sig.signal_id === m.signal_id)));
  const unavailable = await new UnavailableSemanticMatcher().match(pack, 'anything');
  assert.equal(unavailable.state, 'unavailable');
  assert.equal(sanitizeMatcherResult(pack, { state: 'ok', matches: [{ signal_id: 'sig:forged', score: 1 }] }).matches.length, 0);
  assert.equal(sanitizeMatcherResult(pack, null).state, 'unavailable');
});
