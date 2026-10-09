import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateGeneratedLoiQuality} from '../../server/loi-prose-contract.mjs';
import {normalizeLoiParagraphs,PARAGRAPH_SCHEMA,buildLoiProseRequest,loiFailureDiagnostic} from '../../server/loi-openai.mjs';
import {validateAuthoredSingleCallPlans} from '../../server/loi-composition.mjs';
import {native,request} from '../helpers/loi-single-provider.mjs';
const fixture=name=>JSON.parse(fs.readFileSync(new URL('../fixtures/'+name,import.meta.url)));
const retained=fixture('loi-r11-quality-rejection.json'),fiction=fixture('loi-fictional-quality-02.json'),input=fiction.input;
const opening='I am writing to reaffirm my interest in the '+input.program.name+' after submitting my application.';
const evidence='I prepare for interviews by identifying program leadership and the clinical services those leaders oversee so I can ask focused questions about training. Learning that Shyam Chalise is Program Director gives me a specific starting point for that preparation.';
const context='I have applied to your program. I have not interviewed at your program.';
const paragraphs=()=>[
 {text:opening,refs:['program','context:whyNow']},
 {text:evidence,refs:['reason:0','evidence:0']},
 {text:context,refs:['context:applicationState','context:interviewState']},
 {text:'Thank you for considering my interest.',refs:[]}
];
const plan=ps=>normalizeLoiParagraphs({schema:PARAGRAPH_SCHEMA,candidates:[{approach:'DIRECT_CONCISE',paragraphs:ps,fitLinks:[{evidenceRef:'evidence:0',reasonRef:'reason:0'}]}]},input);
const row=ps=>plan(ps).candidates[0];
const quality=r=>validateGeneratedLoiQuality(r,input.refs,input.program);
test('actual R11 provider bytes are not accepted merely because structural guards passed',()=>{
 assert.equal(retained.provenance.humanQualityAccepted,false);
 const before=JSON.stringify(retained);
 assert.throws(()=>validateGeneratedLoiQuality(retained.proposal,retained.refs,retained.program),{code:'loi_composition_quality'});
 assert.equal(JSON.stringify(retained),before);
});
test('explicit fictional quality fixture is separate and passes unchanged factual/trace guards',()=>{
 assert.match(fiction.classification,/FICTIONAL/);assert.equal(fiction.input.context.interviewState,'I have not interviewed at your program.');
 const o=plan(paragraphs());assert.equal(validateAuthoredSingleCallPlans(o,input)[0].review.automaticFactualCertification,false);
 assert.equal(quality(o.candidates[0]).studentReviewRequired,true);
});
test('leadership evidence needs a cited concrete person and role, not interchangeable praise',()=>{
 for(const text of ['Program leadership matters to my interview preparation.','Shyam Chalise is someone I want to identify before an interview.','The Program Director is part of program leadership.']){
  const ps=paragraphs();ps[1].text=text;assert.throws(()=>quality(row(ps)),{rule:'MISSING_CONCRETE_LEADERSHIP_DETAIL'});
 }
});
test('name and role must occur in a clause linked to the leadership evidence',()=>{
 const ps=paragraphs();ps[1].refs=['reason:0'];assert.throws(()=>quality(row(ps)),{rule:'MISSING_CONCRETE_LEADERSHIP_DETAIL'});
});
test('roster cannot become an assertion about program quality',()=>{
 const ps=paragraphs();ps[1].text+=' This demonstrates program quality.';assert.throws(()=>quality(row(ps)),{rule:'ROSTER_IS_NOT_QUALITY_EVIDENCE'});
});
test('composition metadiscourse and observed incomplete sentence are rejected',()=>{
 for(const [text,rule] of [['The program identity is repeated here.','COMPOSITION_METADISCOURSE'],['Lead by the leadership roster.','INCOMPLETE_SENTENCE']]){
  const ps=paragraphs();ps.push({text,refs:['evidence:0']});assert.throws(()=>quality(row(ps)),{rule});
 }
});
test('repeating canonical identity is caught without rewriting a draft',()=>{
 const ps=paragraphs();ps.push({text:'I remain interested in '+input.program.name+'.',refs:['program']});
 assert.throws(()=>quality(row(ps)),{rule:'REPEATED_PROGRAM_IDENTITY'});
});
test('unknown faculty names remain rejected by the existing factual guard',()=>{
 const ps=paragraphs();ps[1].text=ps[1].text.replace('Shyam Chalise','Invented Person');
 assert.throws(()=>validateAuthoredSingleCallPlans(plan(ps),input),{code:'loi_composition_invented_identity'});
});
test('writer instructions require natural sentences and specific sourced leadership without quality inference',()=>{
 const b=JSON.parse(buildLoiProseRequest(input,4096));assert.match(b.instructions,/exact listed role/);assert.match(b.instructions,/not program quality/);
 assert.deepEqual(b.tools,[]);assert.equal(b.model,'gpt-5-nano-2025-08-07');
});
test('native composer consumes one mocked attempt and retains usage when quality rejects a traced response',async()=>{
 const exact={...input,program:retained.program,refs:retained.refs};
 const x=native({author:()=>({candidates:[retained.proposal]})}),r=request(exact);
 await assert.rejects(x.composer.compose(r),e=>e.code==='LOI_PROVIDER_FAILED'&&e.loiDiagnostic.code==='loi_composition_quality'&&e.validatedUsage.costMicros===30);
 assert.equal(x.calls.length,1);
 await assert.rejects(x.composer.compose(r),{code:'LOI_PROVIDER_ALREADY_ATTEMPTED'});
 assert.equal(x.calls.length,1);
});
test('native composer accepts concrete fictional prose without changing model, passes, or student verification',async()=>{
 const x=native({author:()=>plan(paragraphs())});
 const result=await x.composer.compose(request(input));
 assert.equal(x.calls.length,1);assert.equal(result.usage.passes.length,1);
 assert.equal(validateAuthoredSingleCallPlans(result.output,input)[0].studentReviewRequired,true);
});

test('quality diagnostics admit only private closed rules, never arbitrary provider text',()=>{
 const allowed=loiFailureDiagnostic({code:'loi_composition_quality',rule:'MISSING_CONCRETE_LEADERSHIP_DETAIL'},'PROSE_VALIDATION');
 assert.equal(allowed.rule,'MISSING_CONCRETE_LEADERSHIP_DETAIL');
 const denied=loiFailureDiagnostic({code:'loi_composition_quality',rule:'secret or provider prose'},'PROSE_VALIDATION');
 assert.equal(denied.rule,undefined);
});

// R12 regression: supported facts in a different paragraph are not local citations.
test('specialty cannot be borrowed from a leadership roster into an uncited identity opening',()=>{
 const ps=paragraphs();ps[0].text=ps[0].text.replace(' after submitting',' in Internal Medicine after submitting');
 const original=JSON.stringify(ps);
 assert.throws(()=>validateAuthoredSingleCallPlans(plan(ps),input),{code:'loi_composition_invented_identity'});
 assert.equal(JSON.stringify(ps),original);
 assert.equal(validateAuthoredSingleCallPlans(plan(paragraphs()),input)[0].studentReviewRequired,true);
});
test('review snapshot metadata is not silently converted into factual letter content',()=>{
 const ps=paragraphs();ps.push({text:'The roster was reviewed on 2026-09-10.',refs:['evidence:0']});
 assert.equal(input.refs.find(r=>r.ref==='evidence:0').asOf.label,'2026-09-10');
 assert.throws(()=>validateAuthoredSingleCallPlans(plan(ps),input),{code:'loi_composition_invented_quantity'});
});
test('generation scopes specialty and provenance dates without weakening provider limits',()=>{
 const b=JSON.parse(buildLoiProseRequest(input,4096));
 assert.match(b.instructions,/never append a specialty/);
 assert.match(b.instructions,/metadata labels are not applicant updates or program events/);
 assert.match(b.instructions,/same paragraph, omit it/);
 assert.equal(b.max_output_tokens,4096);assert.deepEqual(b.reasoning,{effort:'low'});
 assert.deepEqual(b.tools,[]);assert.equal(b.store,false);
});

// R13 regression: the provider schema must enforce the existing complete-letter contract.
test('provider schema bounds requested candidates, full paragraphs and nonempty fit links',()=>{
 const body=JSON.parse(buildLoiProseRequest(input,4096)),schema=body.text.format.schema;
 assert.equal(schema.properties.candidates.minItems,1);assert.equal(schema.properties.candidates.maxItems,1);
 const row=schema.properties.candidates.items.properties;
 assert.equal(row.paragraphs.minItems,4);assert.equal(row.paragraphs.maxItems,30);
 assert.equal(row.fitLinks.minItems,1);assert.equal(row.fitLinks.maxItems,20);
 const three=JSON.parse(buildLoiProseRequest({...input,approaches:['WARM_PERSONAL','DIRECT_CONCISE','ACADEMIC_PROGRAM']},4096)).text.format.schema;
 assert.equal(three.properties.candidates.minItems,3);assert.equal(three.properties.candidates.maxItems,3);
 assert.match(body.instructions,/at least FOUR paragraphs/);assert.match(body.instructions,/three substantive complete sentences/);
 assert.equal(body.model,'gpt-5-nano-2025-08-07');assert.deepEqual(body.reasoning,{effort:'low'});
 assert.equal(body.max_output_tokens,4096);assert.deepEqual(body.tools,[]);
});
test('two-paragraph output stays rejected without synthesizing a missing closing',()=>{
 const short=paragraphs().slice(0,2),original=JSON.stringify(short);
 assert.throws(()=>plan(short),{code:'loi_composition_trace'});assert.equal(JSON.stringify(short),original);
 assert.equal(validateAuthoredSingleCallPlans(plan(paragraphs()),input)[0].studentReviewRequired,true);
});

for(const subject of ['Your program','The program',input.program.name])for(const verb of ['supports','provides','offers','delivers','enables'])test('roster cannot establish a training offering: '+subject+' '+verb,()=>{
 const ps=paragraphs();if(subject===input.program.name)ps[0].text=ps[0].text.replace(input.program.name,'your program');ps.push({text:subject+' '+verb+' comprehensive internal medicine training.',refs:['program','evidence:0','reason:0']});assert.throws(()=>quality(row(ps)),{rule:'ROSTER_TO_TRAINING_INFERENCE'});
});
test('presupposed how-supports inquiry is not uncertain whether inquiry',()=>{
 const ps=paragraphs();ps.push({text:'I want to confirm how your program supports comprehensive internal medicine training.',refs:['evidence:0','reason:0']});assert.throws(()=>quality(row(ps)),{rule:'ROSTER_TO_TRAINING_INFERENCE'});
 ps.at(-1).text='I would like to ask whether your program supports clinical experience.';assert.doesNotThrow(()=>quality(row(ps)));
});
for(const text of ["Your program's structure aligns with my preparation purpose.",'Your leadership structure aligns with my needs.',"The program's training fits my goals."])test('roster cannot establish program structural fit: '+text,()=>{
 const ps=paragraphs();ps.push({text,refs:['evidence:0','reason:0']});assert.throws(()=>quality(row(ps)),{rule:'ROSTER_TO_STRUCTURE_INFERENCE'});
});
test('personal preparation and exact roster roles remain usable without fabricated offerings',()=>{
 assert.doesNotThrow(()=>quality(row(paragraphs())));const b=JSON.parse(buildLoiProseRequest(input,4096));assert.match(b.instructions,/Do not infer specialty, curriculum/);assert.match(b.instructions,/HOW the program supports/);
 for(const rule of ['ROSTER_TO_TRAINING_INFERENCE','ROSTER_TO_STRUCTURE_INFERENCE'])assert.equal(loiFailureDiagnostic({code:'loi_composition_quality',rule},'PROSE_VALIDATION').rule,rule);
});

test('admiration of what a program provides is a claim, not an uncertainty question',()=>{const ps=paragraphs();ps.push({text:'I admire what your program provides in comprehensive internal medicine training.',refs:['evidence:0','reason:0']});assert.throws(()=>quality(row(ps)),{rule:'ROSTER_TO_TRAINING_INFERENCE'});});
