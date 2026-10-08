import test from 'node:test';
import assert from 'node:assert/strict';
import {AUTHORED_SCHEMA,proseUnits,validateAuthoredInputSpecificity,validateAuthoredTrace} from '../../server/loi-prose-contract.mjs';
import {loiFailureDiagnostic} from '../../server/loi-openai.mjs';
import {native,request} from '../helpers/loi-single-provider.mjs';
import {proseFixture} from '../helpers/loi-single-call.mjs';
import {authoredOutput} from '../helpers/loi-authored.mjs';
const refs=()=>[
 {ref:'program',kind:'identity',text:'Test Program'},
 {ref:'context:whyNow',kind:'context',text:'I am writing to express interest in Test Program.'},
 {ref:'reason:0',kind:'reason',text:'I value identifying program leadership before an interview.'},
 {ref:'evidence:0',kind:'evidence',field:'research.leadership',state:'SUPPORTED',text:'Jane Example, MD\nProgram Director, Internal Medicine Residency'}
];
test('specific named leadership and confirmed leadership motivation qualify before dispatch',()=>assert.doesNotThrow(()=>validateAuthoredInputSpecificity(refs())));
for(const [name,change]of [
 ['bare leadership interest',r=>r[2].text='I am interested in your program leadership.'],
 ['leadership without purpose',r=>r[2].text='I want to know the program leadership.'],
 ['generic leadership claim',r=>r[3].text='Excellent program leadership.'],
 ['unrelated reason',r=>r[2].text='I value weekly continuity clinic with underserved patients.'],
 ['wrong governed field',r=>r[3].field='research.other'],
 ['unassociated person and role',r=>r[3].text='Jane Example, MD\nUnrelated material\nProgram Director']
])test(name+' cannot qualify paid leadership input',()=>{const r=refs();change(r);assert.throws(()=>validateAuthoredInputSpecificity(r),e=>e.code==='loi_composition_specificity');});
test('valid leadership prose still requires exact trace, named-source support, and human review',()=>{
 const r=refs(), parts=[['Dear Program Leadership,',[]],['I am writing to express my interest in Test Program.',['program','context:whyNow']],['Knowing the program leadership before an interview is a priority for me.',['reason:0','evidence:0']],['Jane Example, MD is listed as Program Director, Internal Medicine Residency.',['evidence:0']],['Thank you for considering my interest.',[]]];
 let text='',spans=[];for(const [part,ids]of parts){if(text)text+='\n\n';const start=text.length;text+=part;spans.push({start,end:text.length,refs:ids});}
 const row={approach:'DIRECT_CONCISE',text,claims:proseUnits(text).map(u=>({start:u.start,end:u.end,refs:spans.filter(s=>s.start<u.end&&s.end>u.start).flatMap(s=>s.refs)})),fitLinks:[{evidenceRef:'evidence:0',reasonRef:'reason:0'}]};
 assert.equal(validateAuthoredTrace(row,r,{name:'Test Program'}).review.automaticFactualCertification,false);
 row.claims[1].start++;assert.throws(()=>validateAuthoredTrace(row,r,{name:'Test Program'}),e=>e.code==='loi_composition_trace');
});
test('unqualified input fails before provider and before durable AUTHOR intent',async()=>{
 const x=native(),input=proseFixture();input.refs.find(r=>r.kind==='reason').text='I like your program.';let intents=0;
 assert.equal(x.composer.inputWithinBounds(input),false);
 await assert.rejects(x.composer.compose({...request(input),recordPass:async()=>intents++}),e=>e.code==='loi_composition_specificity');assert.equal(x.calls.length,0);assert.equal(intents,0);
});
test('failed trace records only allowlisted code, stage and digest, retaining usage and no retry',async()=>{
 const x=native({author:input=>{const out=authoredOutput(input);out.candidates[0].claims[1].refs=['unknown-source'];return out;}}),r=request();
 await assert.rejects(x.composer.compose(r),e=>{assert.equal(e.code,'LOI_PROVIDER_FAILED');assert.equal(e.loiDiagnostic.code,'loi_composition_trace');assert.equal(e.loiDiagnostic.stage,'PROSE_VALIDATION');assert.match(e.loiDiagnostic.outputSha256,/^[a-f0-9]{64}$/);assert.deepEqual(Object.keys(e.loiDiagnostic).sort(),['code','outputSha256','stage']);assert.equal(e.validatedUsage.costMicros,30);return true;});
 await assert.rejects(x.composer.compose(r),e=>e.code==='LOI_PROVIDER_ALREADY_ATTEMPTED');assert.equal(x.calls.length,1);
});
test('unknown exceptions cannot leak their message, custom code or provider text',()=>{
 const d=loiFailureDiagnostic({code:'secret-value',message:'private-prose',stack:'secret'},'private-prose','private-prose');
 assert.deepEqual(d,{stage:'UNKNOWN',code:'UNCLASSIFIED',outputSha256:null});
});
