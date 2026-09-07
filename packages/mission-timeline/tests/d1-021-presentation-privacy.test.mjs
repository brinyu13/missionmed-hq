import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createIntakeState,buildApprovalBatch,applyApprovalBatchToDocument} from '../web/js/uxr-002/intake.js';
import {serializeFounderPresentation,projectFounderPresentationDocument} from '../web/js/presentation/founder-presentation-serializer.js';
import {buildKeynoteClassicScene} from '../web/js/uxr-002/board-renderer.js';
import {normalizeExamDocument,updateBuilderExamAttempt} from '../web/js/uxr-002/exam-integration.js';
import {buildExportPreviewInput,buildExportRequest,buildExportScreenModel} from '../web/js/uxr-002/export-screen.js';
import {createLocalExportAdapter} from '../web/js/uxr-002/export-adapter.js';
import {createEditableFounderPptx} from '../web/js/presentation/editable-pptx.js';
import {resolveFounderPresentationSvg} from '../web/js/presentation/resolved-founder-presentation.js';
import {JSZip} from '../web/vendor/presentation/pptx-runtime.js';

const evidence={sourceSha256:'cd'.repeat(32),sourceExcerpt:'PRIVATE_RAW_SOURCE_021'};
const degree={id:'private-degree',title:'Doctor of Medicine at PRIVATE_SCHOOL_021',categoryId:'education',eventType:'duration',startDate:'2016-09',endDate:'2022-12',visibilityState:'ADVISOR_ONLY',fields:{canonicalType:'MEDICAL_DEGREE',degree:'PRIVATE_DEGREE_021',medicalSchool:'PRIVATE_SCHOOL_021',medicalSchoolCountry:'PRIVATE_COUNTRY_021',profileFullName:'Private Studentname',profileNameProvenance:[evidence],datePrecision:{start:'MONTH',end:'YEAR'}},provenance:[evidence]};
const score={id:'private-score',title:'USMLE Step 2 CK PRIVATE_EXAM_021',categoryId:'exams',eventType:'milestone',startDate:'2023-03',visibilityState:'ADVISOR_ONLY',fields:{canonicalType:'STEP_2_CK',score:'297',result:''},provenance:[evidence]};
const publicEvent={id:'public-event',title:'Public clinical work',categoryId:'clinical',eventType:'duration',startDate:'2024-02',endDate:'2024-04',visibilityState:'INTERVIEWER_SAFE',provenance:[evidence]};

function approved({visibility='ADVISOR_ONLY',profile={},exams=[],candidates=[degree,score]}={}){
  const state=createIntakeState({candidates:structuredClone(candidates)});state.stage='review';
  state.candidates.forEach(candidate=>{candidate.decision='accepted';candidate.visibilityState=visibility;});
  let serial=0;
  const document={title:'Private Studentname PRIVATE_TITLE_021',events:[structuredClone(publicEvent)],studentProfile:structuredClone(profile),exams:structuredClone(exams),builder:{}};
  applyApprovalBatchToDocument(document,buildApprovalBatch(state,document.events,{idFactory:()=>`accepted-${++serial}`}));
  return document;
}

test('accepted private profile and exams keep their consent across every canonical audience',()=>{
  for(const visibility of ['FULL_STORY','ADVISOR_ONLY','STUDENT_ONLY','HIDDEN']){
    const document=approved({visibility});
    assert.equal(document.studentProfile.fullName,'Private Studentname','approval still hydrates the editable student draft');
    assert.equal(document.studentProfile.graduationDate,'2022');
    for(const scope of ['INTERVIEWER_SAFE','PRINT','ACCESSIBLE','FULL_STORY','ADVISOR_PACKET','STUDENT','EVERYTHING']){
      const permitted=visibility!=='HIDDEN'&&(scope==='STUDENT'||scope==='EVERYTHING'||(scope==='ADVISOR_PACKET'&&visibility!=='STUDENT_ONLY')||(scope==='FULL_STORY'&&visibility==='FULL_STORY'));
      const projected=projectFounderPresentationDocument(document,{scope});
      assert.equal(projected.studentProfile.fullName,permitted?'Private Studentname':undefined,`${visibility} / ${scope}`);
      assert.equal(projected.exams.length,permitted?1:0,`${visibility} / ${scope} exam`);
      const svg=serializeFounderPresentation(document,{scope,currentMonth:'2025-01'}).svg;
      if(permitted){assert.match(svg,/Private Studentname/);assert.match(svg,/>297</);}
      else assert.doesNotMatch(svg,/Private Studentname|PRIVATE_SCHOOL_021|PRIVATE_DEGREE_021|PRIVATE_EXAM_021|>297</);
      assert.doesNotMatch(JSON.stringify(projected.studentProfile),/PRIVATE_RAW_SOURCE_021/);
    }
  }
});

test('current source privacy, deletion and missing linkage override copied public field consent',()=>{
  for(const change of ['private','delete','orphan']){
    const document=approved({visibility:'INTERVIEWER_SAFE'});
    if(change==='private')document.events.filter(e=>e.id!=='public-event').forEach(e=>e.visibilityState='ADVISOR_ONLY');
    if(change==='delete')document.events=[document.events[0]];
    if(change==='orphan'){
      Object.values(document.studentProfile.fieldProvenance).forEach(field=>field.sourceEventId=null);
      document.exams[0].sourceEventId=null;
    }
    const projected=projectFounderPresentationDocument(document,{scope:'INTERVIEWER_SAFE'});
    assert.equal(projected.studentProfile.fullName,undefined,change);assert.equal(projected.exams.length,0,change);
    const rendered=serializeFounderPresentation(document,{scope:'INTERVIEWER_SAFE'});
    assert.equal(rendered.scene.profile.fullName,'Your journey');
    assert.equal(rendered.scene.profile.medicalSchool,'');assert.equal(rendered.scene.profile.step2,'');
    if(change!=='orphan')assert.doesNotMatch(rendered.svg,/Private Studentname|PRIVATE_SCHOOL_021|>297</);
  }
});

test('export prefilter cannot widen private profile consent via the EVERYTHING render option',()=>{
  const document=approved();
  for(const audience of ['INTERVIEWER_SAFE','LOR_WRITER','PROFESSIONAL_CONNECTION','MISSION_RESIDENCY_ALUMNI']){
    const input=buildExportPreviewInput(document,{audience});
    assert.equal(input.rendererOptions.audience,'EVERYTHING');
    assert.equal(input.timeline.studentProfile.fullName,undefined);
    assert.equal(input.timeline.exams.length,0);
    assert.doesNotMatch(serializeFounderPresentation(input.timeline,input.rendererOptions).svg,/Private Studentname|PRIVATE_SCHOOL_021|>297</);
  }
  assert.equal(buildExportScreenModel(document).exportActionDisabled,true);
  assert.equal(buildExportScreenModel(document).filename,null);
  assert.throws(()=>buildExportRequest(document),/name/i);
  for(const event of document.events.filter(e=>e.id!=='public-event'))event.fields.exportAudiences=['LOR_WRITER'];
  const shared=buildExportPreviewInput(document,{audience:'LOR_WRITER'});
  assert.equal(shared.timeline.studentProfile.fullName,'Private Studentname');
  assert.equal(shared.timeline.exams[0].score,'297');
  assert.match(serializeFounderPresentation(shared.timeline,shared.rendererOptions).svg,/Private Studentname/);
  assert.equal(buildExportPreviewInput(document,{audience:'PROFESSIONAL_CONNECTION'}).timeline.studentProfile.fullName,undefined);
});

test('manual profile and exam fields survive a private import while new exam fields remain scoped',()=>{
  const document=approved({profile:{fullName:'Manual Publicname',medicalSchool:'Manual Public School',degree:'Manual Degree'},exams:[{id:'manual',system:'USMLE',examId:'step-2-ck',examDate:'2023-03',result:'Passed',score:''}]});
  assert.equal(document.exams[0].score,'297');
  const safe=projectFounderPresentationDocument(document,{scope:'INTERVIEWER_SAFE'});
  assert.equal(safe.studentProfile.fullName,'Manual Publicname');assert.equal(safe.studentProfile.medicalSchool,'Manual Public School');
  assert.equal(safe.exams[0].result,'Passed');assert.equal(safe.exams[0].score,undefined);
  assert.equal(projectFounderPresentationDocument(document,{scope:'ADVISOR_PACKET'}).exams[0].score,'297');
  const direct=buildKeynoteClassicScene(document,{audience:'INTERVIEWER_SAFE',currentMonth:'2025-01'});
  assert.equal(direct.profile.fullName,'Manual Publicname');assert.equal(direct.profile.step2,'Passed');
});

test('legacy unlinked imports fail closed using retained source custody without hiding unrelated manual values',()=>{
  const document=approved();delete document.studentProfile.fieldProvenance;
  document.builder.lastAiPrefill.profilePrefilled=false; // a later exam-only import replaced the last-batch summary
  const safe=projectFounderPresentationDocument(document,{scope:'INTERVIEWER_SAFE'});
  assert.equal(safe.studentProfile.fullName,undefined);assert.equal(safe.studentProfile.medicalSchool,undefined);
  const manual=approved({profile:{fullName:'Manual Publicname'},exams:[{id:'manual',system:'USMLE',examId:'step-2-ck',examDate:'2023-03',score:'',result:'Passed'}]});
  delete manual.exams[0].fieldProvenance;
  assert.equal(projectFounderPresentationDocument(manual,{scope:'INTERVIEWER_SAFE'}).exams[0].score,undefined);
  assert.equal(projectFounderPresentationDocument(manual,{scope:'INTERVIEWER_SAFE'}).exams[0].result,'Passed');
  document.events=[document.events[0]];
  assert.equal(projectFounderPresentationDocument(document,{scope:'EVERYTHING'}).studentProfile.fullName,undefined,'orphaned imported claims require review');
});

test('actual exam normalization and editing retain private source authority at the presentation boundary',()=>{
  const document=approved();
  const id=document.exams[0].id;
  const originalEventIds=document.events.map(event=>event.id);
  normalizeExamDocument(document);
  assert.equal(document.exams.find(exam=>exam.id===id)?.sourceType,'document-intake');
  assert.deepEqual(document.events.map(event=>event.id),originalEventIds,'normalization cannot generate a public duplicate of the accepted source exam');
  updateBuilderExamAttempt(document,id,{score:'252'});
  assert.equal(document.exams.find(exam=>exam.id===id)?.score,'252');
  assert.deepEqual(document.events.map(event=>event.id),originalEventIds,'editing the imported exam cannot promote or duplicate its source event');
  const safe=projectFounderPresentationDocument(document,{scope:'INTERVIEWER_SAFE'});
  assert.deepEqual(safe.events.map(event=>event.id),['public-event']);assert.equal(safe.exams.length,0);
  assert.doesNotMatch(serializeFounderPresentation(document,{scope:'INTERVIEWER_SAFE'}).svg,/PRIVATE_EXAM_021|>252<|>297</);
  assert.match(serializeFounderPresentation(document,{scope:'ADVISOR_PACKET'}).svg,/>252</);
});

test('normalizing a public manual exam enriched by a private score does not disclose that score',()=>{
  const document=approved({profile:{fullName:'Manual Publicname'},exams:[{id:'manual',system:'USMLE',examId:'step-2-ck',examDate:'2023-03',result:'Passed',score:'',showScoreOnTimeline:true,showScoreTouched:true}]});
  normalizeExamDocument(document);
  const safe=projectFounderPresentationDocument(document,{scope:'INTERVIEWER_SAFE'});
  assert.equal(safe.exams[0].result,'Passed');assert.equal(safe.exams[0].score,undefined);
  assert.ok(document.exams[0].fieldProvenance.score.sourceEventId);
  const rendered=serializeFounderPresentation(document,{scope:'INTERVIEWER_SAFE'});
  assert.equal(rendered.scene.profile.step2,'Passed');
  assert.doesNotMatch(resolveFounderPresentationSvg(rendered.svg).nodes.filter(node=>node.kind==='text').map(node=>node.text).join('\n'),/PRIVATE_EXAM_021|\b297\b/);
});

test('imported score toggle changes every presentation surface without changing the accepted fact or evidence',async()=>{
  const document=approved({visibility:'INTERVIEWER_SAFE',profile:{fullName:'Manual Publicname'},candidates:[{...score,title:'USMLE Step 2 CK — 297'}]});
  const originalFacts=JSON.stringify(document.events),originalEvidence=JSON.stringify(document.exams[0].provenance);
  const id=document.exams[0].id;
  assert.equal(document.exams[0].showScoreOnTimeline,true,'an explicitly accepted source score has a consistent checked initial preference');
  normalizeExamDocument(document);
  assert.equal(document.exams[0].showScoreOnTimeline,true);
  updateBuilderExamAttempt(document,id,{showScoreOnTimeline:false});
  assert.equal(document.exams[0].score,'297');
  assert.equal(JSON.stringify(document.events),originalFacts,'provider factual binding and canonical source titles are unchanged');
  assert.equal(JSON.stringify(document.exams[0].provenance),originalEvidence);
  const input=buildExportPreviewInput(document,{formatId:'pptx-editable'});
  const rendered=serializeFounderPresentation(input.timeline,input.rendererOptions);
  assert.equal(rendered.scene.profile.step2,'');
  assert.doesNotMatch(resolveFounderPresentationSvg(rendered.svg).nodes.filter(n=>n.kind==='text').map(n=>n.text).join('\n'),/\b297\b/);
  assert.equal(buildKeynoteClassicScene(document,{currentMonth:'2025-01'}).profile.step2,'');
  const artifact=await createEditableFounderPptx({svg:rendered.svg,document,resolveImage:async src=>{
    const relative=src.slice(src.indexOf('assets/'));
    return`data:${relative.endsWith('.png')?'image/png':'image/jpeg'};base64,${(await readFile(new URL('../web/'+relative,import.meta.url))).toString('base64')}`;
  }});
  assert.doesNotMatch(artifact.validation.text.join('\n'),/\b297\b/);
  const exportedFact=artifact.recovery.facts.find(event=>event.id!=='public-event');
  assert.equal(exportedFact.title,'USMLE Step 2 CK');
  assert.deepEqual(exportedFact.presentationRedactions,['EXAM_SCORE_HIDDEN']);
  assert.doesNotMatch(JSON.stringify(artifact.recovery),/297/);
  updateBuilderExamAttempt(document,id,{showScoreOnTimeline:true});
  assert.equal(JSON.stringify(document.events),originalFacts);
  const shown=serializeFounderPresentation(document,{scope:'INTERVIEWER_SAFE'});
  assert.equal(shown.scene.profile.step2,'297');
  assert.match(shown.svg,/USMLE Step 2 CK — 297/);
});

test('editable PPTX contains no private source fields, raw title or biography in any XML part',async()=>{
  const document=approved({profile:{fullName:'Manual Publicname'}});
  normalizeExamDocument(document);
  document.studentProfile.privateAdvisorNote='PRIVATE_NOTE_021';
  const input=buildExportPreviewInput(document,{formatId:'pptx-editable'});
  const rendered=serializeFounderPresentation(input.timeline,input.rendererOptions);
  // Pass the original draft deliberately: OOXML must still use the rendered
  // semantic IDs and visible title as its factual and core-metadata authority.
  const artifact=await createEditableFounderPptx({svg:rendered.svg,document,resolveImage:async src=>{
    const relative=src.slice(src.indexOf('assets/'));
    return`data:${relative.endsWith('.png')?'image/png':'image/jpeg'};base64,${(await readFile(new URL('../web/'+relative,import.meta.url))).toString('base64')}`;
  }});
  const zip=await JSZip.loadAsync(await artifact.blob.arrayBuffer());
  for(const [name,entry] of Object.entries(zip.files)){
    if(entry.dir||!name.endsWith('.xml'))continue;
    assert.doesNotMatch(await entry.async('string'),/Private Studentname|PRIVATE_(?:SCHOOL|DEGREE|COUNTRY|EXAM|TITLE|RAW_SOURCE|NOTE)_021|>297</,name);
  }
  assert.deepEqual(artifact.recovery.facts.map(event=>event.id),['public-event']);
  assert.match(await zip.file('docProps/core.xml').async('string'),/Manual Publicname/);
  assert.equal(artifact.validation.errors.length,0);
});

test('actual PDF generation derives document properties from the scoped visible title',async()=>{
  const document=approved({profile:{fullName:'Manual Publicname'}});
  const jpeg=await readFile(new URL('../web/assets/founder_keynote_2024/background/Magnetboard-1920-107.jpg',import.meta.url));
  let paintedSvg='';
  // Only canvas encoding is substituted; approval, audience projection, shared
  // SVG serialization, real adapter generation and the PDF writer all execute.
  const adapter=createLocalExportAdapter({rasterize:async(svg,{width,height})=>{
    paintedSvg=svg;
    return{canvas:{width,height,toBlob:callback=>callback(new Blob([jpeg],{type:'image/jpeg'}))},warnings:[]};
  }});
  for(const formatId of ['pdf-letter-landscape','pdf-a4-landscape']){
    const request=buildExportRequest(document,{formatId});
    const artifact=await adapter.generate(request);
    const pdf=await artifact.blob.text();
    assert.doesNotMatch(paintedSvg,/Private Studentname|PRIVATE_SCHOOL_021/);
    assert.doesNotMatch(pdf,/Private Studentname|PRIVATE_TITLE_021|PRIVATE_RAW_SOURCE_021/);
    assert.match(pdf,/\/Title \(Timeline: Manual Publicname\)/);
    assert.equal(artifact.mimeType,'application/pdf');
  }
});
