import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseAnswer,specificChange} from '../../server/rehearsal.mjs';
test('wording feedback is input-derived and never labels claims verified',()=>{
  const context={programName:'Example Program',fact:{claim:'Residents attend a continuity clinic.'},story:{summary:'Organized a follow-up checklist.'}};
  const a=diagnoseAnswer('I organized a checklist. It cut errors by 50%. I would bring careful follow-up to your continuity clinic.',context);
  assert.deepEqual(a.find(x=>x.k==='outcome').hits,['50%']);assert.equal(a.find(x=>x.k==='fact').ok,true);assert.equal(a.find(x=>x.k==='story').ok,true);
  assert.match(specificChange(a,context),/Verify/);assert.match(a[0].text,/cannot verify/);
});
test('confirmed closing goal changes feedback priority; unavailable context is explicitly skipped',()=>{
  const a=diagnoseAnswer('I organized the work. That was useful.',{goal:'Make my closing forward looking'});
  assert.equal(a[0].k,'closing');assert.equal(a[0].goal,true);assert.match(specificChange(a,{goal:'Make my closing forward looking'}),/confirmed goal/);
  for(const key of ['story','fact'])assert.equal(a.find(x=>x.k===key).informational,true);
});
