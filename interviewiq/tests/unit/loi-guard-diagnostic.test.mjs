import test from 'node:test';import assert from 'node:assert/strict';
import {authoredReview,proseUnits} from '../../server/loi-prose-contract.mjs';
import {loiFailureDiagnostic} from '../../server/loi-openai.mjs';
const refs=[{ref:'program',kind:'identity',text:'Test Program'},{ref:'evidence:0',kind:'evidence',field:'research.curriculum',text:'Residents attend a supervised clinic weekly.'}];
for(const [text,rule]of [
 ['Your program guarantees success.','UNSUPPORTED_GUARANTEE'],
 ['Your program offers visa sponsorship.','UNSUPPORTED_VISA'],
 ['Your program is my top choice.','UNSUPPORTED_RANK'],
 ['My publication is relevant.','UNSUPPORTED_ACHIEVEMENT'],
 ['My spouse lives nearby.','UNSUPPORTED_PERSONAL_TIE'],
 ['Your program offers robotic surgery.','UNSUPPORTED_PROGRAM_ROBOTICS']
])test('rejection behavior preserved with private fixed '+rule,()=>{
 const body='Test Program.\n\n'+text,claims=proseUnits(body).map(u=>({start:u.start,end:u.end,refs:['program','evidence:0']}));
 assert.throws(()=>authoredReview(body,refs,{name:'Test Program'},claims),e=>{assert.equal(e.code,'loi_composition_unsupported');assert.equal(e.rule,rule);const d=loiFailureDiagnostic(e,'PROSE_VALIDATION','a'.repeat(64));assert.equal(d.rule,rule);assert.deepEqual(loiFailureDiagnostic(d,d.stage,d.outputSha256),d);assert.deepEqual(Object.keys(d).sort(),['code','outputSha256','rule','stage']);assert.ok(!JSON.stringify(d).includes(text));return true;});
});
test('arbitrary diagnostic values cannot escape through rule field',()=>{for(const rule of ['private student text','INTERVIEWIQ_OPENAI_API_KEY',{secret:'value'},null]){const d=loiFailureDiagnostic({code:'loi_composition_unsupported',rule},'PROSE_VALIDATION');assert.equal(Object.hasOwn(d,'rule'),false);}});
test('allowed rule cannot be attached to unrelated error code',()=>{const d=loiFailureDiagnostic({code:'loi_composition_trace',rule:'UNSUPPORTED_VISA'},'PROSE_VALIDATION');assert.equal(Object.hasOwn(d,'rule'),false);});
test('unsupported evidence state remains rejected before authored-unit checks',async()=>{
 const {proseFixture}=await import('../helpers/loi-single-call.mjs');const {authoredOutput}=await import('../helpers/loi-authored.mjs');const {validateAuthoredSingleCallPlans}=await import('../../server/loi-composition.mjs');const input=proseFixture();input.refs.find(r=>r.kind==='evidence').state='UNKNOWN';assert.throws(()=>validateAuthoredSingleCallPlans(authoredOutput(input),input),e=>e.code==='loi_composition_unsupported'&&e.rule==='UNSUPPORTED_EVIDENCE_STATE');
});

for(const [word,category,extra]of [['robotics','ROBOTICS',''],['surgery','SURGERY',''],['cardiology','CARDIOLOGY',''],['fellowships','FELLOWSHIP',''],['research','RESEARCH',''],['scholarship','SCHOLARSHIP',''],['electives','ELECTIVE',''],['mentorship','MENTORSHIP',''],['simulation','SIMULATION',''],['rural','RURAL',''],['international','INTERNATIONAL',''],['visa','VISA','Sponsorship is available.'],['sponsorship','SPONSORSHIP','A visa option is available.']])test('fixed private program-topic category '+category,()=>{
 const r=structuredClone(refs);r[1].text+=extra;const text='Test Program.\n\nYour program offers '+word+'.',claims=proseUnits(text).map(u=>({start:u.start,end:u.end,refs:['program','evidence:0']}));
 assert.throws(()=>authoredReview(text,r,{name:'Test Program'},claims),e=>{assert.equal(e.code,'loi_composition_unsupported');assert.equal(e.rule,'UNSUPPORTED_PROGRAM_'+category);assert.equal(loiFailureDiagnostic(e,'PROSE_VALIDATION').rule,e.rule);return true;});
});
