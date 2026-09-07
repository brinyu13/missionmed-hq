import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {rescueVisibleReviewFields} from '../web/js/uxr-002/rescue-profile-intake-021.js';
import {createIntakeState,buildApprovalBatch,applyApprovalBatchToDocument,renderIntake} from '../web/js/uxr-002/intake.js';
import {serializeFounderPresentation,projectFounderPresentationDocument} from '../web/js/presentation/founder-presentation-serializer.js';
import {createEditableFounderPptx} from '../web/js/presentation/editable-pptx.js';
import {JSZip} from '../web/vendor/presentation/pptx-runtime.js';

const sha='bc'.repeat(32),evidence=(text,id)=>({evidenceId:`evidence-${id}`,artifactSha256:sha,format:'PPTX',pageOrSlide:1,objectId:id,extractionMethod:'PPTX_OOXML',support:'SOURCE_FACT',sourceText:text,geometry:{x:10,y:20,width:100,height:20,unit:'EMU'},confidence:.98});
const nameClaim={value:'Ana Popescu',provenance:[evidence('Timeline: Ana Popescu','title'),evidence('Ana Popescu','profile-name')]};
const degreeClaim={value:'MD',provenance:[evidence('Degree: MD','profile-degree')]};
const source=(id,title,categoryId,startDate,endDate,extra={})=>({id,title,categoryId,startDate,endDate,timelineKind:endDate?'duration':'milestone',datePrecision:{start:'MONTH',end:endDate?'MONTH':null},confidence:{score:.74,reasons:['Visible source review']},provenance:[evidence(`${title} ${startDate}${endDate?`–${endDate}`:''}`,id)],uncertainties:[],...extra});
const medical=source('medical','Doctor of Medicine (MD)','education','2016-09','2022-06',{institution:'Synthetic University',profileClaims:{fullName:nameClaim,degree:degreeClaim}});
const step1=source('step1','USMLE Step 1 — Pass','usmle','2022-11',null);
const step2=source('step2','USMLE Step 2 CK — 251','usmle','2023-03',null);
const adapter=await readFile(new URL('../web/js/local-synthetic-intelligence-021.js',import.meta.url),'utf8');
function mapped(candidate){
  const context={structuredClone,rescueVisibleReviewFields,candidate:structuredClone(candidate),file:{name:'visible-timeline.pptx'},sha};vm.createContext(context);
  vm.runInContext(adapter.slice(adapter.indexOf('  const rescueCandidate ='),adapter.indexOf('  const client=Object.freeze')),context);
  return JSON.parse(JSON.stringify(vm.runInContext('rescueCandidate(candidate,file,sha)',context)));
}
function review(candidates=[medical,step1,step2],visibility='INTERVIEWER_SAFE'){
  const state=createIntakeState({candidates:candidates.map(mapped)});state.stage='review';state.detectedType='TIMELINE_RESCUE';
  state.candidates.forEach(candidate=>candidate.visibilityState=visibility);return state;
}
function accept(state,profile={}){
  state.candidates.forEach(candidate=>candidate.decision='accepted');let serial=0;
  const document={id:'rescue-profile-regression',title:'Timeline',events:[],studentProfile:structuredClone(profile),exams:[],builder:{}};
  applyApprovalBatchToDocument(document,buildApprovalBatch(state,[],{idFactory:()=>`accepted-${++serial}`}));return document;
}

test('021 actual Rescue mapper and reviewed acceptance hydrate visible profile/exams with no extra events or invented facts',()=>{
  const state=review(),html=renderIntake(state);
  assert.match(html,/data-rescue-profile-review/);assert.match(html,/Name: Ana Popescu.*Degree: MD/);
  assert.match(html,/Verify source details/);assert.match(html,/>Check required<\/span>/);
  assert.doesNotMatch(html,/Needs your help|>Needs details<\/span>/);
  assert.match(html,/using this entry&#39;s visibility|using this entry's visibility/);
  assert.doesNotMatch(html,/Name from the CV header/);
  const document=accept(state);
  assert.equal(document.events.length,3);
  assert.equal(document.studentProfile.fullName,'Ana Popescu');assert.equal(document.studentProfile.degree,'MD');
  assert.equal(document.studentProfile.graduationDate,'2022-06');assert.ok(!document.studentProfile.medicalSchoolCountry);
  assert.deepEqual(document.studentProfile.fieldProvenance.fullName.provenance,nameClaim.provenance);
  assert.deepEqual(document.studentProfile.fieldProvenance.degree.provenance,degreeClaim.provenance);
  assert.equal(document.studentProfile.fieldProvenance.degree.sourceEventId,document.events[0].id);
  assert.deepEqual(document.exams.map(({examId,result,score})=>({examId,result,score})),[{examId:'step-1',result:'Passed',score:''},{examId:'step-2-ck',result:'',score:'251'}]);
  assert.ok(document.exams.every(exam=>document.events.some(event=>event.id===exam.sourceEventId)));
  assert.match(serializeFounderPresentation(document,{scope:'INTERVIEWER_SAFE'}).svg,/Timeline: Ana Popescu/);
});

test('021 rejected medical suggestion does not hydrate profile; conflict-withheld claims remain absent after approval',()=>{
  const state=review();state.candidates[0].decision='rejected';state.candidates.slice(1).forEach(candidate=>candidate.decision='accepted');
  const doc={events:[],studentProfile:{}};applyApprovalBatchToDocument(doc,buildApprovalBatch(state,[]));assert.ok(!doc.studentProfile.fullName);assert.ok(!doc.studentProfile.degree);
  const conflict=structuredClone(medical);delete conflict.profileClaims;conflict.uncertainties=['Visible names and degrees disagree; confirm before prefilling.'];
  const accepted=accept(review([conflict]));assert.ok(!accepted.studentProfile.fullName);assert.ok(!accepted.studentProfile.degree);
  assert.equal(accepted.studentProfile.graduationDate,'2022-06','Uncontested accepted event endpoint remains source-backed');
});

test('021 accepted Rescue profile and structured exam claims obey source privacy/deletion while preserving manual fields',()=>{
  for(const visibility of ['ADVISOR_ONLY','INTERVIEWER_SAFE']){
    const document=accept(review(undefined,visibility));
    if(visibility==='INTERVIEWER_SAFE')document.events.forEach(event=>event.visibilityState='ADVISOR_ONLY');
    const safe=projectFounderPresentationDocument(document,{scope:'INTERVIEWER_SAFE'});
    assert.equal(safe.studentProfile.fullName,undefined);assert.equal(safe.studentProfile.degree,undefined);assert.equal(safe.exams.length,0);
    assert.doesNotMatch(serializeFounderPresentation(document,{scope:'INTERVIEWER_SAFE'}).svg,/Ana Popescu|>251</);
    document.events=[];assert.equal(projectFounderPresentationDocument(document,{scope:'EVERYTHING'}).studentProfile.fullName,undefined);
  }
  const manual=accept(review(undefined,'ADVISOR_ONLY'),{fullName:'Manual Publicname',degree:'Manual Degree'});
  const safe=projectFounderPresentationDocument(manual,{scope:'INTERVIEWER_SAFE'});
  assert.equal(safe.studentProfile.fullName,'Manual Publicname');assert.equal(safe.studentProfile.degree,'Manual Degree');
  assert.equal(manual.studentProfile.fieldProvenance.degree.sourceType,'manual');
  const ambiguous=accept(review(undefined,'ADVISOR_ONLY'),{degree:'Earlier unknown degree',medicalSchoolVerificationStatus:'unverified-source-claimed'});
  assert.equal(ambiguous.studentProfile.fieldProvenance.degree,undefined,'Unlinked earlier imports are not promoted to manual authority');
  assert.equal(projectFounderPresentationDocument(ambiguous,{scope:'INTERVIEWER_SAFE'}).studentProfile.degree,undefined);
});

test('021 private accepted Rescue profile text is absent from every editable PowerPoint XML part',async()=>{
  const document=accept(review(undefined,'ADVISOR_ONLY'));
  const rendered=serializeFounderPresentation(document,{scope:'INTERVIEWER_SAFE'});
  const result=await createEditableFounderPptx({document,svg:rendered.svg,resolveImage:async src=>{
    const relative=src.slice(src.indexOf('assets/'));
    return `data:${relative.endsWith('.png')?'image/png':'image/jpeg'};base64,${(await readFile(new URL('../web/'+relative,import.meta.url))).toString('base64')}`;
  }});
  const zip=await JSZip.loadAsync(await result.blob.arrayBuffer());
  for(const entry of Object.values(zip.files).filter(file=>/\.xml$/.test(file.name))){
    const xml=await entry.async('string');assert.doesNotMatch(xml,/Ana Popescu|Degree: MD|>251<|"score":"251"/,entry.name);
  }
});
