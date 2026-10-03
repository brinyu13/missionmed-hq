import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFields,validateQuestions,proposeStructure} from '../../server/debrief.mjs';
test('debrief uncertainty and private exact/paraphrase questions remain explicit',()=>{
  assert.deepEqual(validateFields({individual_count:'unknown',roles:['faculty','faculty','unknown'],impression:'prefer not to say'}),{individual_count:'unknown',roles:['faculty','unknown'],impression:'prefer not to say'});
  assert.deepEqual(validateQuestions([{text:'Why here?',recall:'exact',permission:'public'}]),[{text:'Why here?',recall:'exact',permission:'private'}]);
  assert.throws(()=>validateQuestions([{text:'Question',recall:'fabricated'}]));
  assert.throws(()=>validateFields({private_owner_id:'someone else'}));
});
test('structure proposal uses latest explicit count and never infers a missing resident group',()=>{
  const proposal=proposeStructure('There were three interviews. Correction: two individual conversations and a resident group.');
  assert.equal(proposal.individual_count,'2');assert.equal(proposal.resident_group,true);assert.equal(proposal.confirmation_required,true);
  assert.equal(proposeStructure('It was interesting.').individual_count,'unknown');assert.equal(proposeStructure('It was interesting.').resident_group,null);
});

test('each actual encounter has its own bounded duration, format, roles and certainty',()=>{
  const id='f4c830d0-482d-46a6-a342-df8a4a61ce40';
  const item={id,format:'panel',roles:['faculty','associate program director','other'],duration_minutes:22,duration_precision:'estimated'};
  const data={encounter_count:2,encounter_count_precision:'exact',encounters:[item,{...item,id:'c45fbdc7-1c6b-41b6-bf13-baa07d97ca2c',roles:['unknown'],duration_minutes:null,duration_precision:'prefer not to share'}],emphasized_topics:{text:'Continuity and transitions',certainty:'recalled'},program_information:{text:'My recollection of the clinic schedule',certainty:'estimated'}};
  assert.deepEqual(validateFields(data),data);
  for(const duration of [0,-1,1441,1.5,'20'])assert.throws(()=>validateFields({encounters:[{...item,duration_minutes:duration}]}));
  assert.throws(()=>validateFields({encounters:[item,item]}),/own identifier/);
  assert.throws(()=>validateFields({encounters:[{...item,duration_precision:'unknown'}]}),/minutes only/);
  assert.throws(()=>validateFields({encounters:[{...item,duration_minutes:null}]}),/minutes only/);
  assert.throws(()=>validateFields({encounters:[{...item,raw_transcript:'Unapproved field'}]}));
  assert.throws(()=>validateFields({...data,encounter_count:1}),/cannot be less/);
  assert.throws(()=>validateFields({...data,encounter_count_precision:'unknown'}),/count only/);
  assert.throws(()=>validateFields({emphasized_topics:{text:'Hidden content',certainty:'prefer not to share'}}),/Clear the text/);
  assert.deepEqual(validateFields({encounter_count:null,encounter_count_precision:'unknown',emphasized_topics:{text:'',certainty:'not applicable'}}),{encounter_count_precision:'unknown',emphasized_topics:{text:'',certainty:'not applicable'}});
});
