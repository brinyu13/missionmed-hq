import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {detectSections} from '../web/js/ingestion/section-detector.js';
import {parseCvBlocks} from '../web/js/ingestion/cv-parser.js';
import {buildCandidates} from '../web/js/ingestion/candidate-builder.js';
import {createD1408PdfIntakeAdapter,mapCvIntelligenceCandidateToUxr} from '../web/js/uxr-002/intake-d1-408-adapter.js';
import {mergeCvSourceCoverage} from '../web/js/uxr-002/cv-source-coverage-021.js';
import {candidateQuestions} from '../web/js/uxr-002/intake.js';

const fixture=JSON.parse(await readFile(new URL('fixtures/d1-timeline-astra-021/cv2-wrapped-date.json',import.meta.url),'utf8'));
const source={id:`src-${fixture.sourceSha256.slice(0,16)}`,fileName:fixture.sourceFilename,sha256:fixture.sourceSha256,effectiveType:'CV',extractionMethod:'PDFJS_TEXT_LAYER'};
const wrapped=fixture.pages[0].lines[6];
const facts=c=>[c.id,c.title,c.categoryId,c.eventType,c.startDate,c.endDate,c.fields.canonicalType];

test('021 exact CV2 split month/year retains two source blocks and merges to the six recorded AI facts',async()=>{
  const text=fixture.pages.map(page=>page.text).join('\n\n');
  const extraction={status:'EXTRACTED',sourceDocumentId:source.id,pages:fixture.pages,pageCount:1,text,charCount:text.length,extractionMethod:'PDFJS_TEXT_LAYER',warnings:[],inspected:{name:source.fileName,size:37620,mimeType:'application/pdf',sha256:fixture.sourceSha256}};
  const local=await createD1408PdfIntakeAdapter({pdfExtractor:async()=>extraction}).extract({file:{name:source.fileName,size:37620,type:'application/pdf'},documentType:'CV'});
  assert.equal(local.candidates.length,6);
  const observation=local.candidates.find(c=>c.title.startsWith('Internal Medicine Observership'));
  assert.equal(observation.categoryId,'clinical');
  assert.equal(observation.fields.canonicalType,'OBSERVERSHIP');
  assert.equal(observation.startDate,'2024-01');
  assert.equal(observation.endDate,'2024-03');
  assert.equal(observation.title,'Internal Medicine Observership, Lakeside Community Hospital, Chicago, Illinois');
  assert.deepEqual(observation.provenance.map(p=>p.sourceExcerpt),[wrapped,'2024']);
  assert.equal(new Set(observation.provenance.map(p=>p.sourceBlockId)).size,2);
  assert.ok(observation.provenance.every(p=>p.pageNumber===1&&p.sourceSha256===fixture.sourceSha256));
  const ai=fixture.providerCandidates.map(c=>mapCvIntelligenceCandidateToUxr(c,{sourceDocument:local.sourceDocument,sourceBlocks:[...fixture.providerSourceBlocks,...local.sourceBlocks]}));
  const before=JSON.stringify(ai),merged=mergeCvSourceCoverage(ai,local.candidates);
  assert.equal(merged.candidates.length,6);
  assert.equal(merged.sourceRecoveryCount,0);
  assert.deepEqual(merged.candidates.map(facts),ai.map(facts));
  assert.equal(JSON.stringify(ai),before,'Coverage reconciliation cannot mutate provider-validated facts');
  assert.ok(merged.candidates.every(c=>c.fields.extractionBasis==='AI_REVIEW'));
  const award=merged.candidates.find(c=>c.fields.canonicalType==='AWARD_HONOR');
  assert.ok(award);
  assert.equal(candidateQuestions(award).length,0,'A dated named award with no stated issuer is reviewable without inventing a school');
  assert.equal(award.fields.medicalSchool||'','');
});

test('021 split-month continuation cannot consume another entry, cross a page/section, or guess an end year',()=>{
  const base={id:'a',pageNumber:1,pageId:'p1',section:'experiences',lineNumber:7,text:wrapped};
  for(const next of [
    {id:'b',pageNumber:2,section:'experiences',lineNumber:8,text:'2024'},
    {id:'b',pageNumber:1,section:'research',lineNumber:8,text:'2024'},
    {id:'b',pageNumber:1,section:'experiences',lineNumber:9,text:'2024'},
    {id:'b',pageNumber:1,section:'experiences',lineNumber:8,text:'2024 — Volunteer'},
    {id:'b',pageNumber:1,section:'experiences',lineNumber:8,text:'June 2024'}
  ]){
    const candidates=buildCandidates(parseCvBlocks([base,next]),source);
    const observed=candidates.find(c=>c.title.startsWith('Internal Medicine Observership'));
    assert.equal(observed.endDate,null);
    assert.equal(observed.safeToBulkAccept,false);
    assert.deepEqual(observed.provenance.map(p=>p.sourceExcerpt),[wrapped]);
  }
  const {blocks}=detectSections([{id:'page',pageNumber:1,lines:['US Clinical Experience',wrapped.replace('to March',''), '2024']}]);
  const observed=buildCandidates(parseCvBlocks(blocks),source).find(c=>c.title.startsWith('Internal Medicine Observership'));
  assert.equal(observed.endDate,null,'A nearby year alone cannot establish an explicit date range');
});

test('021 award exemption keeps true education school and missing date questions',()=>{
  const candidate={id:'award',categoryId:'education',title:"Dean's Award",startDate:'2022-06',eventType:'milestone',fields:{canonicalType:'AWARD_HONOR'}};
  assert.deepEqual(candidateQuestions(candidate),[]);
  for(const canonicalType of ['MEDICAL_DEGREE','EDUCATION','GRADUATION']){
    assert.ok(candidateQuestions({...candidate,fields:{canonicalType}}).some(q=>q.key==='medicalSchool'));
  }
  assert.deepEqual(candidateQuestions({...candidate,startDate:''}).map(q=>q.key),['startDate']);
});
