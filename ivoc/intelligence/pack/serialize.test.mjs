import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeForActor, factLine, ACTOR_RULES } from './serialize.mjs';
import { PACK_BUDGETS, byteLength } from '../contracts/context-pack.mjs';
import { wordCount } from '../contracts/application-fact.mjs';
import { scenario, buildPack, profileFor, ACCUSATION } from '../test-helpers.mjs';

test('actor block: fixed sections, byte cap, no ids, no restricted content, no accusation language', async () => {
  const s = await scenario('cross-source');
  const pack = buildPack(s);
  const block = serializeForActor(pack, { role: 'faculty', practice_goal: s.scen.practice_goal, pressure_profile: profileFor(s.scen) });
  assert.ok(byteLength(block) <= PACK_BUDGETS.max_actor_block_bytes);
  assert.match(block, /^AUTHORIZED APPLICATION CONTEXT\nPROGRAM: /u);
  for (const section of ['APPLICANT FACTS:', 'ATTENTION:', 'RULES:']) assert.ok(block.includes(section));
  for (const rule of ACTOR_RULES) assert.ok(block.includes(rule));
  assert.ok(!/fact:[0-9a-f]{32}|sig:AIS|AIS-R\d\d/u.test(block));
  assert.ok(!block.includes('Step 2 CK'));
  assert.ok(!ACCUSATION.test(block));
  assert.ok(!block.includes('coaching'), 'full_simulation never permits coaching language');
  const coached = serializeForActor(pack, { role: 'faculty', practice_goal: 'guided_mock', pressure_profile: profileFor({ ...s.scen, practice_goal: 'guided_mock' }) });
  assert.ok(coached.includes('Brief coaching between answers is allowed'));
});

test('actor block respects allowed roles and trims deterministically', async () => {
  const s = await scenario('cross-source');
  const pack = buildPack(s);
  const limited = { ...pack, signals: pack.signals.map((sig) => ({ ...sig, allowed_roles: ['chief_resident'] })) };
  const pd = serializeForActor(limited, { role: 'program_director' });
  assert.match(pd, /ATTENTION:\n- none/u);
  const chief = serializeForActor(limited, { role: 'chief_resident' });
  assert.ok(!/ATTENTION:\n- none/u.test(chief));
  assert.equal(serializeForActor(pack, {}), serializeForActor(pack, {}));
  assert.throws(() => serializeForActor(pack, { role: 'student' }), /role must be one of/u);
});

test('fact lines are bounded paraphrases built only from present attributes', async () => {
  const s = await scenario('cross-source');
  const pack = buildPack(s);
  for (const fact of pack.facts) {
    const line = factLine(fact);
    assert.ok(wordCount(line) <= PACK_BUDGETS.max_fact_line_words, line);
    assert.ok(!line.includes('undefined') && !line.includes('null'), line);
  }
  const research = pack.facts.find((f) => f.fact_type === 'research_item' && f.attributes.field === 'genetics');
  assert.match(factLine(research), /^Research: Variant interpretation in hereditary cardiomyopathy as first author in genetics at Northlake University \(2025-01–2025-12\)$/u);
});
