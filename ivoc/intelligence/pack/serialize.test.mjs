import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeForActor, factLine, ACTOR_RULES } from './serialize.mjs';
import { PACK_BUDGETS, byteLength } from '../contracts/context-pack.mjs';
import { wordCount } from '../contracts/application-fact.mjs';
import { scenario, buildPack, profileFor, ACCUSATION } from '../test-helpers.mjs';
import {buildLiveInterviewInstructions} from '../../../ivprep-v6/server/providers/openai-live-session.mjs';
import {createLiveContext} from '../../../ivprep-v6/public/studio/live-context-adapter.mjs';
import {toWizard,defaultSettings} from '../../../ivprep-v6/public/studio-fable/app/settings/interviewer.mjs';

test('current authorized RISE facts reach native closing context; expired facts and their probes do not',async()=>{
  const s=await scenario('cross-source');
  const fresh=buildPack(s),stale=structuredClone(fresh);
  const programFacts=stale.facts.filter(f=>f.fact_type==='program_interest');
  for(const f of programFacts)f.stale=true;
  const probe=stale.signals.find(sig=>sig.proactive_eligible);
  if(probe)stale.signals.push({...probe,signal_id:'stale-program-probe',fact_refs:[programFacts[0].fact_id],possible_probes:['STALE-PROGRAM-PROBE']});
  const program={verified:true,programId:fresh.program.program_ref,programReleaseId:'synthetic-release',name:fresh.program.name};
  const question={question_id:'CORE-01',canonical_text:'Tell me about yourself.'};
  const context=createLiveContext({wizard:toWizard(defaultSettings(),{program}),interviewSet:[question]});
  const native=pack=>buildLiveInterviewInstructions(context,{receipt:'ctxpack:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb@'+'c'.repeat(64),actorBlock:serializeForActor(pack)});
  const current=native(fresh),expired=native(stale);
  for(const f of programFacts.filter(f=>f.attributes.fact)){assert.ok(current.includes(f.attributes.fact));assert.ok(!expired.includes(f.attributes.fact));}
  assert.ok(expired.includes(fresh.program.name),'selected identity remains');
  assert.ok(!expired.includes('STALE-PROGRAM-PROBE'));
  assert.match(expired,/No current verified program details/);
  assert.match(current,/Do you have any questions for me\\?/);
  const absent=serializeForActor({...fresh,program:null,facts:[],signals:[]});assert.match(absent,/PROGRAM: none/);
  const partial=serializeForActor({...fresh,facts:fresh.facts.filter(f=>f.fact_type!=='program_interest'||!f.attributes.fact),signals:[]});
  assert.match(partial,/No current verified program details/);
});

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

test('actual expired partial RISE intake withholds facts; unavailable still drops the projection',async()=>{
  for(const state of [undefined,'partial','unavailable']){
    const s=await scenario('cross-source');
    const rise=s.projections.find(p=>p.projection_type==='rise.program_cheat_sheet');
    rise.fresh_until=s.scen.now;
    if(state)rise.degraded={state,reason:'Synthetic owner state'};
    const pack=buildPack(s);
    const facts=pack.facts.filter(f=>f.fact_type==='program_interest');
    if(state==='unavailable')assert.equal(facts.length,0);
    else {assert.ok(facts.length>0);assert.ok(facts.every(f=>f.stale));}
    for(const fact of rise.payload.high_yield_facts)assert.ok(!pack.actor_block.includes(fact.fact));
  }
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
