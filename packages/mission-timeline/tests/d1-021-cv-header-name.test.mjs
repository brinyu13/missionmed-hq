import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {detectSections} from '../web/js/ingestion/section-detector.js';
import {sourceProfileNameClaim,mapCvIntelligenceCandidateToUxr} from '../web/js/uxr-002/intake-d1-408-adapter.js';
import {createIntakeState,buildApprovalBatch,applyApprovalBatchToDocument} from '../web/js/uxr-002/intake.js';
const fixture=JSON.parse(await readFile(new URL('fixtures/d1-timeline-astra-021/cv2-wrapped-date.json',import.meta.url),'utf8'));
const source={id:'cv2-source',fileName:fixture.sourceFilename,sha256:fixture.sourceSha256};
const blocks=detectSections(fixture.pages).blocks;

test('CV2 explicit name plus CV suffix preserves the exact header and source custody',()=>{
  const claim=sourceProfileNameClaim(blocks,source);
  assert.equal(claim?.value,'Alex Rivera');
  assert.equal(claim.provenance.sourceExcerpt,'Alex Rivera — Synthetic Test CV');
  assert.equal(claim.provenance.sourceBlockId,blocks[0].id);
  assert.equal(claim.provenance.sourceSha256,fixture.sourceSha256);
  assert.equal(claim.provenance.sourceDocumentId,source.id);
});

test('CV suffix name extraction accepts delimited labels but rejects roles, institutions and extra assertions',()=>{
  const header=text=>[{...blocks[0],text}];
  for(const text of ['Alex Rivera — CV','Alex Rivera | Curriculum Vitae','Alex Rivera - Synthetic Test CV','Alex Rivera, MD — CV','Name: Alex Rivera — CV']){
    assert.equal(sourceProfileNameClaim(header(text),source)?.value,'Alex Rivera',text);
  }
  for(const text of ['Alex Rivera','Curriculum Vitae','Global University — CV','Clinical Research — CV','Research Assistant — CV','Synthetic Test — CV','Alex Rivera — CV pending verification','Alex Rivera — Personal statement','Alex Rivera CV','alex@example.com — CV','Alex 123 — CV']){
    assert.equal(sourceProfileNameClaim(header(text),source),null,text);
  }
  assert.equal(sourceProfileNameClaim([{...blocks[0],text:'Alex Rivera — CV',section:'education'}],source),null);
  assert.equal(sourceProfileNameClaim([{...blocks[0],text:'Alex Rivera — CV',pageNumber:2}],source),null);
});

test('accepted medical degree prefills CV2 name with source-event authority and preserves existing manual name',()=>{
  const provider=fixture.providerCandidates.find(c=>c.canonicalType==='MEDICAL_DEGREE');
  const mapped=mapCvIntelligenceCandidateToUxr(provider,{sourceDocument:source,sourceBlocks:blocks});
  assert.equal(mapped.fields.profileFullName,'Alex Rivera');
  for(const manual of ['', 'Existing Manualname']){
    const state=createIntakeState({candidates:[structuredClone(mapped)]});state.stage='review';
    state.candidates[0].decision='accepted';state.candidates[0].visibilityState='ADVISOR_ONLY';
    const document={events:[],studentProfile:manual?{fullName:manual}:{},exams:[],builder:{}};
    applyApprovalBatchToDocument(document,buildApprovalBatch(state,[],{idFactory:()=> 'accepted-cv2-md'}));
    assert.equal(document.studentProfile.fullName,manual||'Alex Rivera');
    if(!manual){
      assert.equal(document.studentProfile.fieldProvenance.fullName.sourceEventId,'accepted-cv2-md');
      assert.equal(document.studentProfile.fieldProvenance.fullName.visibilityState,'ADVISOR_ONLY');
      assert.ok(JSON.stringify(document.studentProfile.fieldProvenance.fullName).includes('Alex Rivera — Synthetic Test CV'));
    }
  }
});
