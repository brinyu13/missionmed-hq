import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLoiParagraphs,PARAGRAPH_SCHEMA,buildLoiProseRequest,LOI_MODEL} from '../../server/loi-openai.mjs';
import {AUTHORED_SCHEMA,proseUnits} from '../../server/loi-prose-contract.mjs';
import {validateAuthoredSingleCallPlans} from '../../server/loi-composition.mjs';
import {proseFixture} from '../helpers/loi-single-call.mjs';
import {authoredOutput} from '../helpers/loi-authored.mjs';
import {paragraphOutput} from '../helpers/loi-single-provider.mjs';
const fixture=()=>{const input=proseFixture();return {input,wire:paragraphOutput(authoredOutput(input))};};
test('server computes exact UTF16 clause offsets without changing authored text or declared refs',()=>{
 const {input,wire}=fixture();const paragraphs=[{text:'Dear Program Leadership,',refs:[]},{text:'A😀B. Same text; 3.5 units! Next?',refs:['program']},{text:'Same text; again.',refs:['reason:0','evidence:0']}];wire.candidates[0].paragraphs=paragraphs;
 const row=normalizeLoiParagraphs(wire,input).candidates[0],text=paragraphs.map(p=>p.text).join('\n\n');assert.equal(row.text,text);
 assert.deepEqual(row.claims.map(({start,end})=>({start,end})),proseUnits(text).map(({start,end})=>({start,end})));
 const boundary=text.indexOf('Same text; again.');for(const c of row.claims){assert.deepEqual(c.refs,c.end<=paragraphs[0].text.length+1?[]:c.end<=boundary?['program']:['reason:0','evidence:0']);}
 assert.equal(row.claims[1].end-row.claims[1].start,5); // surrogate pair counted in UTF16
});
test('persisted authored schema and final factual/student-review contract remain unchanged',()=>{
 const {input,wire}=fixture(),output=normalizeLoiParagraphs(wire,input);assert.equal(output.schema,AUTHORED_SCHEMA);const rows=validateAuthoredSingleCallPlans(output,input);assert.equal(rows.length,1);assert.equal(rows[0].review.studentVerificationRequired,true);assert.equal(rows[0].review.automaticFactualCertification,false);
});
for(const [name,mutate]of [
 ['unknown refs',p=>p.refs=['unknown']],['duplicate refs',p=>p.refs=['program','program']],['missing refs',p=>delete p.refs],['extra properties',p=>p.claims=[]],['empty text',p=>p.text=''],['leading whitespace',p=>p.text=' '+p.text],['embedded newline',p=>p.text+='\nOther'],['embedded unicode separator',p=>p.text+='\u2028Other'],['oversize text',p=>p.text='a'.repeat(20001)]
])test('fails closed for '+name,()=>{const {input,wire}=fixture();mutate(wire.candidates[0].paragraphs[1]);assert.throws(()=>normalizeLoiParagraphs(wire,input),e=>e.code==='loi_composition_trace');});
test('sources are never inferred from text or neighboring paragraphs',()=>{const {input,wire}=fixture();wire.candidates[0].paragraphs[1].refs=[];const output=normalizeLoiParagraphs(wire,input);assert.deepEqual(output.candidates[0].claims[1].refs,[]);assert.throws(()=>validateAuthoredSingleCallPlans(output,input),e=>e.code==='loi_composition_unmapped');});
test('invented quantity remains denied after normalization even with a declared evidence ref',()=>{const {input,wire}=fixture();wire.candidates[0].paragraphs.splice(2,0,{text:'The passing rate is 95%.',refs:['evidence:0']});assert.throws(()=>validateAuthoredSingleCallPlans(normalizeLoiParagraphs(wire,input),input),e=>e.code==='loi_composition_invented_quantity');});
test('canonical program substitution is not repaired',()=>{const {input,wire}=fixture();for(const p of wire.candidates[0].paragraphs)p.text=p.text.replaceAll(input.program.name,'Another Program');assert.throws(()=>validateAuthoredSingleCallPlans(normalizeLoiParagraphs(wire,input),input),e=>e.code==='loi_composition_reference');});
test('provider wire requests paragraphs with explicit refs; same approved model and no tools',()=>{const {input}=fixture(),b=JSON.parse(buildLoiProseRequest(input,4096)),row=b.text.format.schema.properties.candidates.items;assert.equal(b.model,LOI_MODEL);assert.deepEqual(b.reasoning,{effort:'minimal'});assert.deepEqual(b.tools,[]);assert.equal(b.store,false);assert.equal(b.max_output_tokens,4096);assert.equal(JSON.parse(b.input[0].content[0].text).schema,PARAGRAPH_SCHEMA);assert.deepEqual(row.required,['approach','paragraphs','fitLinks']);assert.equal(row.properties.claims,undefined);});
