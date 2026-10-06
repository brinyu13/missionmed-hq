import test from 'node:test';
import assert from 'node:assert/strict';
import {routeCommand,commandChips,matchQuestion,programQuery,isSafeHref,DEFAULT_SUGGESTIONS,ROUTES} from '../../public/studio-fable/app/adapters/command-router.mjs';
import {SEED_QUESTIONS} from '../../public/questions/mission-residency-corpus.mjs';

const questions=SEED_QUESTIONS.filter(q=>!q.is_collection_description).map(q=>({question_id:q.question_id,canonical_text:q.canonical_text,core_priority:q.collection==='CORE'||/^CORE-/.test(q.question_id),tags:q.tags||[]}));
const latest={id:'att-0a1b2c3d',mode:'practice',questionId:'CORE-08',questionText:'What is your greatest weakness?',priorityText:'Finish the answer in under 90 seconds.'};
const route=(text,options={})=>routeCommand(text,{questions,...options});

test('corpus fixture is the real 193-question library',()=>{assert.equal(questions.length,193);});

test('practice phrasings resolve to the canonical question id, including misspellings and student wording',()=>{
  const cases=[
    ['practice tell me about yourself','CORE-01'],
    ['Tell me about yourself','CORE-01'],
    ['tel me abt myself','CORE-01'],
    ['help me practise my greatest weeknes answer','CORE-08'],
    ['weakness','CORE-08'],
    ['my strengths','CORE-05'],
    ['where do I see myself in five years','CORE-03'],
    ['how do i handle conflict','CORE-07'],
    ['why did you choose this specialty','CORE-06'],
    ['an error I made in patient care','CORE-10'],
    ['hobbies question','CORE-02'],
  ];
  for(const [text,id] of cases){
    const result=route(text);
    assert.equal(result.kind,'route',text);assert.equal(result.intent,'practice',text);
    assert.equal(result.href,'#/practice?q='+id,text);assert.equal(result.question.question_id,id,text);
  }
});

test('mock phrasings resolve to Mock setup with only valid length and preset hints',()=>{
  assert.deepEqual(route('give me a full mock').href,ROUTES.mock);
  assert.equal(route('Give me a 5 minute pressure mock').href,'#/mock?min=5&preset=pressure');
  assert.equal(route('ten minute mock interview').href,'#/mock?min=10');
  assert.equal(route('quick mock').href,'#/mock?min=5');
  assert.equal(route('mock me, 12 mins').href,'#/mock?min=10');
  assert.equal(route('a gentle warm mock please').href,'#/mock?preset=warm');
  assert.equal(route('pressure').intent,'mock');
  assert.equal(route('simulate an interview').intent,'mock');
  assert.equal(route('practice a full mock interview').intent,'mock','ambiguous practice+mock text goes to the fuller workflow');
});

test('prepare phrasings route to Prepare and pre-fill the RISE query without calling RISE',()=>{
  assert.equal(route('Prepare me for SUNY Downstate').href,'#/prepare?q=SUNY%20Downstate');
  assert.equal(route('prepare me for a program').href,ROUTES.prepare);
  assert.equal(route('prep for residency at Mount Sinai').href,'#/prepare?q=Mount%20Sinai');
  assert.equal(route("I'd like to prepare for Mayo Clinic internal medicine program").href,'#/prepare?q=Mayo%20Clinic%20internal%20medicine');
  assert.equal(route('program search').href,ROUTES.prepare);
  assert.equal(programQuery('prepare me for the program'),'');
  const sanitized=programQuery('Prepare me for SUNY Downstate <script>alert(1)</script>');
  assert.ok(sanitized.startsWith('SUNY Downstate'));assert.doesNotMatch(sanitized,/[<>()]/,'markup characters never reach the RISE query');
  assert.equal(programQuery('x'.repeat(90)),'','over-long queries are dropped');
});

test('review, improve and progress phrasings route to real review surfaces; the latest debrief only when it exists',()=>{
  assert.equal(route('show me what to improve').href,ROUTES.review);
  assert.equal(route('show me what to improve',{latest}).href,'#/results/att-0a1b2c3d');
  assert.equal(route('what should I change?',{latest}).href,'#/results/att-0a1b2c3d');
  assert.equal(route('how did I do',{latest}).intent,'results');
  assert.equal(route('review my reps').href,ROUTES.review);
  assert.equal(route('open the film room').href,ROUTES.review);
  assert.equal(route('show my progress').href,ROUTES.progress);
  assert.equal(route('whats my streak').href,ROUTES.progress);
});

test('device phrasings route to Devices & calibration; a practice question beats a stray device word',()=>{
  assert.equal(route('check my camera').href,ROUTES.devices);
  assert.equal(route('microphone').href,ROUTES.devices);
  assert.equal(route('calibrate').href,ROUTES.devices);
  assert.equal(route('tell me about yourself on camera').href,'#/practice?q=CORE-01');
});

test('unknown or empty text returns three real suggestions and never a route or fabricated answer',()=>{
  for(const text of ['','   ','asdf qwerty zxcv','what is the weather in Brooklyn','write my personal statement for me']){
    const result=route(text,{latest});
    assert.equal(result.kind,'suggest',text);assert.equal(result.suggestions.length,3,text);
    assert.ok(result.suggestions.every(chip=>isSafeHref(chip.href)),text);assert.ok(typeof result.message==='string'&&result.message.length>0);
    assert.equal(Object.hasOwn(result,'href'),false);
  }
  assert.equal(route('mock').kind,'route');
  const closest=route('practice',{});assert.equal(closest.kind,'route');assert.equal(closest.href,ROUTES.practice,'generic practice without a question match opens the chooser');
});

test('every emitted href is an existing IVOC hash route; nothing else passes the safety gate',()=>{
  const texts=['practice tell me about yourself','full mock','5 minute pressure mock','prepare me for SUNY Downstate','what to improve','progress','camera','conflict','practice','rehearse my answer about research'];
  for(const text of texts){const result=route(text,{latest});if(result.kind==='route')assert.ok(isSafeHref(result.href),result.href);}
  for(const bad of ['#/ai-answer','#/results/<x>','javascript:alert(1)','https://example.com','#/practice?q=CORE-01&x=<b>','#/mock?min=5 ','#/vault'])assert.equal(isSafeHref(bad),false,bad);
  for(const good of ['#/practice','#/practice?q=CORE-01','#/mock?min=5&preset=pressure','#/prepare?q=SUNY%20Downstate','#/review','#/progress','#/devices','#/results/att-0a1b2c3d'])assert.equal(isSafeHref(good),true,good);
});

test('chips are the four defaults plus one personalised retry built from the latest debrief priority',()=>{
  const plain=commandChips();
  assert.deepEqual(plain.map(c=>c.id),DEFAULT_SUGGESTIONS.map(c=>c.id));
  assert.equal(plain.find(c=>c.id==='review').href,ROUTES.review);
  const personal=commandChips({latest});
  assert.equal(personal.length,5);
  assert.equal(personal.find(c=>c.id==='review').href,'#/results/att-0a1b2c3d');
  const chip=personal.at(-1);assert.equal(chip.id,'priority');
  assert.equal(chip.label,'Clear my priority: Finish the answer in under 90 seconds');
  assert.equal(chip.href,'#/practice?q=CORE-08&retry=att-0a1b2c3d');
  assert.equal(commandChips({latest:{...latest,mode:'mock'}}).at(-1).href,'#/mock?q=CORE-08&retry=att-0a1b2c3d');
  assert.equal(commandChips({latest:{...latest,priorityText:null}}).length,4,'no priority, no personalised chip');
  assert.equal(commandChips({latest:{...latest,id:'bad id/with spaces'}}).every(c=>isSafeHref(c.href)),true);
  const long=commandChips({latest:{...latest,priorityText:'x'.repeat(80)}}).at(-1).label;assert.ok(long.length<=70&&long.endsWith('…'));
});

test('fuzzy question matching is bounded: no match below the floor, Core ties win, scores are reported',()=>{
  assert.equal(matchQuestion('zzzz qqqq',questions),null);
  assert.equal(matchQuestion('',questions),null);
  const hit=matchQuestion('greatest weakness',questions);assert.equal(hit.question.question_id,'CORE-08');assert.ok(hit.score>=0.75);
  assert.equal(matchQuestion('tell me about yourself',[{question_id:'X-1',canonical_text:'Tell me about yourself.'},{question_id:'CORE-01',canonical_text:'Tell me about yourself.',core_priority:true}]).question.question_id,'CORE-01');
  assert.equal(matchQuestion('weakness',[{question_id:'A',canonical_text:''},{canonical_text:'no id'}]),null);
});
