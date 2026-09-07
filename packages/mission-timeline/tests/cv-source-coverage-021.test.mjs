import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeCvSourceCoverage} from '../web/js/uxr-002/cv-source-coverage-021.js';
test('source omissions stay reviewable with honest basis and no bulk acceptance',()=>{
  const cv={id:'cv1',title:'Research Assistant, University Lab',categoryId:'research',startDate:'2021-03',endDate:'2022-12',confidence:'high',fields:{},provenance:[{sourceExcerpt:'exact source'}]};
  const volunteer={...cv,id:'vol',title:'Volunteer',categoryId:'work',startDate:'2019-01',endDate:'2021-12'};
  const publication={...cv,id:'pub',title:'Publication',startDate:'2023-01',endDate:null};
  const ai={...cv,id:'ai1',title:'Research Assistant'};
  const output=mergeCvSourceCoverage([ai],[cv,volunteer,publication]);
  assert.equal(output.candidates.length,3);assert.equal(output.sourceRecoveryCount,2);
  assert.equal(output.candidates[0].fields.extractionBasis,'AI_REVIEW');
  assert.deepEqual(output.candidates.slice(1).map(c=>c.confidence),['medium','medium']);
  assert.equal(output.candidates[1].fields.extractionBasis,'MISSIONMED_RULE');
  assert.deepEqual(output.candidates[1].provenance,volunteer.provenance);
  assert.equal(volunteer.confidence,'high');assert.equal(ai.fields.extractionBasis,undefined);
});
