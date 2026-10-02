import test from 'node:test';
import assert from 'node:assert/strict';
import {detectSections} from '../web/js/ingestion/section-detector.js';
import {parseCvBlocks} from '../web/js/ingestion/cv-parser.js';
import {buildCandidates} from '../web/js/ingestion/candidate-builder.js';
import {mapD1408CandidateToUxr} from '../web/js/uxr-002/intake-d1-408-adapter.js';
import {createIntakeState,buildApprovalBatch,applyApprovalBatchToDocument,transitionIntake} from '../web/js/uxr-002/intake.js';
import {serializeFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
const source={id:'synthetic',fileName:'synthetic.txt',sha256:'a'.repeat(64),extractionMethod:'SYNTHETIC'};
function candidate(text){const blocks=detectSections([{id:'p',pageNumber:1,lines:[text]}]).blocks;return mapD1408CandidateToUxr(buildCandidates(parseCvBlocks(blocks),source)[0]);}
function docFor(candidate){const state=createIntakeState({candidates:[candidate]});state.stage='review';state.candidates[0].decision='accepted';const doc={id:'synthetic',events:[],studentProfile:{fullName:'Synthetic Person'},builder:{},presentationOverrides:{}};applyApprovalBatchToDocument(doc,buildApprovalBatch(state,[],{idFactory:()=> 'synthetic-event'}));return doc;}
test('season and vague source wording survive import, approval and the locked presentation',()=>{
 for(const [range,words] of [['Spring 2021 to Summer 2021',['Spring 2021','Summer 2021']],['early 2019 to late 2019',['early 2019','late 2019']],['Winter 2022 to Winter 2023',['Winter 2022','Winter 2023']]]){
  const c=candidate(`${range} | Research assistant | Synthetic Institution | research`),doc=docFor(c),before=JSON.stringify(doc);
  for(const compositionMode of ['original']){const r=serializeFounderPresentation(doc,{compositionMode,currentMonth:'2026-10'});for(const word of words)assert.ok(r.svg.includes(word),word);}
  assert.equal(JSON.stringify(doc),before);
 }
});
test('explicit date correction clears old uncertain wording without rewriting untouched source evidence',()=>{
 const c=candidate('Spring 2021 to Summer 2021 | Research assistant | Synthetic Institution | research');const state=createIntakeState({candidates:[c]});const next=transitionIntake(state,{type:'EDIT_CANDIDATE',id:c.id,patch:{startDate:'2021-04'}});
 assert.equal(next.candidates[0].fields.datePrecision.start,'MONTH');assert.equal(next.candidates[0].fields.sourceDateWording.start,null);assert.equal(next.candidates[0].fields.sourceDateWording.end.raw,'Summer 2021');assert.match(next.candidates[0].sourceSnippet,/Spring 2021/);
});
test('future dates remain factual without invented completion status',()=>{
 const doc=docFor(candidate('2024-07 to 2027-06 | Residency | Synthetic Institution | work'));const r=serializeFounderPresentation(doc,{currentMonth:'2026-10'});assert.match(r.svg,/7\/24 - 6\/27/);assert.doesNotMatch(r.svg,/planned|not completed/);
});
