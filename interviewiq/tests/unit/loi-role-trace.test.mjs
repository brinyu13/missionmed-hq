import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLoiParagraphs,PARAGRAPH_SCHEMA} from '../../server/loi-openai.mjs';
import {validateAuthoredTrace} from '../../server/loi-prose-contract.mjs';

function fixture(){
 const refs=[{ref:'program',kind:'identity',text:'Test Program'},
  {ref:'context:whyNow',kind:'context',text:'I am writing to express interest in Test Program.'},
  {ref:'reason:0',kind:'reason',text:'I value identifying program leadership before an interview.'},
  {ref:'evidence:0',kind:'evidence',field:'research.leadership',state:'SUPPORTED',text:'Jane Example, MD\nSection Chief, General Medicine\nJohn Sample, DO\nSection Chief, Cardiology'}];
 const input={refs,program:{name:'Test Program'},approaches:['DIRECT_CONCISE']};
 const wire={schema:PARAGRAPH_SCHEMA,candidates:[{approach:'DIRECT_CONCISE',paragraphs:[
  {text:'I am writing to express my interest in Test Program.',refs:['program','context:whyNow']},
  {text:'Knowing the program leadership before an interview is a priority for me.',refs:['reason:0','evidence:0']},
  {text:'I recognize the listed roles as Section Chiefs.',refs:['evidence:0']}
 ],fitLinks:[{evidenceRef:'evidence:0',reasonRef:'reason:0'}]}]};return {input,wire};
}
function check({input,wire}){return validateAuthoredTrace(normalizeLoiParagraphs(wire,input).candidates[0],input.refs,input.program);}
test('two distinct named chiefs support the exact plural role; human verification remains mandatory',()=>{
 const f=fixture(),r=check(f);assert.equal(r.review.studentVerificationRequired,true);assert.equal(r.review.automaticFactualCertification,false);
 delete f.input.refs[3].state;assert.doesNotThrow(()=>check(f)); // admission-normalized references omit state
});
for(const [name,mutate] of [
 ['one chief',f=>f.input.refs[3].text='Jane Example, MD\nSection Chief, General Medicine'],
 ['duplicate person',f=>f.input.refs[3].text='Jane Example, MD\nSection Chief, General Medicine\nJane Example, MD\nSection Chief, Cardiology'],
 ['wrong field',f=>f.input.refs[3].field='research.other'],
 ['unmapped evidence',f=>f.wire.candidates[0].paragraphs[2].refs=['program']],
 ['invented person',f=>f.wire.candidates[0].paragraphs[2].text='I recognize Dr Invented Person as a Section Chief.'],
 ['different plural role',f=>f.wire.candidates[0].paragraphs[2].text='I recognize the listed roles as Program Directors.'],
 ['unsupported quantity',f=>f.wire.candidates[0].paragraphs[2].text='I recognize 95 Section Chiefs.'],
 ['invented meeting',f=>f.wire.candidates[0].paragraphs[2].text='I met the listed Section Chiefs.'],
 ['unknown state',f=>f.input.refs[3].state='UNKNOWN'],
 ['conflicted state',f=>f.input.refs[3].state='CONFLICTED'],
 ['missing required reference',f=>f.wire.candidates[0].paragraphs[0].refs=['program']],
 ['wrong first approach',f=>f.wire.candidates[0].paragraphs[0].refs=['program','evidence:0','context:whyNow']]
])test(name+' remains denied',()=>{const f=fixture();mutate(f);assert.throws(()=>check(f));});
