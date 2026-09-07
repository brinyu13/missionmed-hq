import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from 'node:vm';

import {detectSections,classifyHeading} from "../web/js/ingestion/section-detector.js";
import {parseCvBlocks} from "../web/js/ingestion/cv-parser.js";
import {buildCandidates} from "../web/js/ingestion/candidate-builder.js";
import {classifyEvent} from "../web/js/ingestion/event-classifier.js";
import {normalizeDateRange,parseDatePoint} from "../web/js/ingestion/date-normalizer.js";
import {mapD1408CandidateToUxr,mapCvIntelligenceCandidateToUxr,createD1408PdfIntakeAdapter,sourceProfileNameClaim} from "../web/js/uxr-002/intake-d1-408-adapter.js";
import {createIntakeState,buildApprovalBatch,applyApprovalBatchToDocument,renderIntake,transitionIntake} from "../web/js/uxr-002/intake.js";
import {syncEducationMilestone,validateCoreInfo} from "../web/js/uxr-002/builder.js";
import {serializeFounderPresentation} from "../web/js/presentation/founder-presentation-serializer.js";

const fixture=JSON.parse(await readFile(new URL("fixtures/d1-timeline-astra-021/synthetic-cv-extraction.json",import.meta.url),"utf8"));
const golden=JSON.parse(await readFile(new URL('fixtures/d1-timeline-astra-021/golden-md-before-diagnosis.json',import.meta.url),'utf8'));
const inlineSource=await readFile(new URL('../web/index.html',import.meta.url),'utf8');
const source={id:"synthetic-021",fileName:fixture.sourceFilename,sha256:fixture.sourceSha256,effectiveType:"CV",detectedType:"CV",userDeclaredType:"CV",extractionMethod:"PDFJS_TEXT_LAYER",parserVersion:"408.1.0"};

function pipeline(pages=fixture.pages){
  const {blocks}=detectSections(pages);
  const records=parseCvBlocks(blocks);
  const candidates=buildCandidates(records,source);
  return{blocks,records,candidates,mapped:candidates.map(mapD1408CandidateToUxr)};
}

function pagesFor(lines){
  return[{id:"page-1",sourceDocumentId:source.id,pageNumber:1,lines,extractionMethod:"PDFJS_TEXT_LAYER"}];
}

test("021 exact synthetic PDF text produces nine source-backed entries with correct clinical, resident and volunteer categories",async()=>{
  const text=fixture.pages.map(page=>page.text).join("\n\n");
  const extraction={status:"EXTRACTED",sourceDocumentId:source.id,pages:fixture.pages,pageCount:1,text,charCount:text.length,extractionMethod:"PDFJS_TEXT_LAYER",warnings:[],inspected:{name:fixture.sourceFilename,size:24242,mimeType:"application/pdf",sha256:fixture.sourceSha256}};
  const result=await createD1408PdfIntakeAdapter({pdfExtractor:async()=>extraction}).extract({file:{name:fixture.sourceFilename,size:24242,type:"application/pdf"},documentType:"CV"});
  assert.equal(result.candidates.length,9);
  assert.deepEqual(result.candidates.map(candidate=>candidate.categoryId),["education","exams","exams","clinical","clinical","work","research","research","work"]);
  const expected=[
    ["Clinical Elective","USCE_CLINIC","2023-10","2023-11"],
    ["Resident Physician","RESIDENCY_FELLOWSHIP","2023-01","2024-06"],
    ["Research Assistant","RESEARCH_EXPERIENCE","2021-03","2022-12"],
    ["Volunteer","VOLUNTEER_EXPERIENCE","2019-01","2021-12"]
  ];
  for(const [prefix,type,start,end] of expected){
    const candidate=result.candidates.find(item=>item.title.startsWith(prefix));
    assert.equal(candidate.fields.canonicalType,type,prefix);
    assert.equal(candidate.startDate,start,prefix);
    assert.equal(candidate.endDate,end,prefix);
  }
  const originalLines=new Set(fixture.pages.flatMap(page=>page.lines));
  for(const candidate of result.candidates){
    assert.ok(candidate.provenance.length);
    for(const provenance of candidate.provenance){
      assert.equal(provenance.pageNumber,1);
      assert.ok(originalLines.has(provenance.sourceExcerpt),"Every excerpt must be an unchanged source line");
    }
  }
  assert.equal(result.parser.networkCalls,false);
  assert.equal(result.candidates[0].fields.profileFullName,"Ana Popescu");
  assert.equal(result.candidates[1].fields.result,"Passed");
  assert.equal(result.candidates[2].fields.score,"251");
  assert.equal(result.candidates[2].fields.result,"","A numeric score must not invent a pass/fail result");
  assert.ok(Array.isArray(result.parser.qualitySuggestions));
  assert.ok(!result.parser.qualitySuggestions.some(item=>item.type==="SOURCE_ITEM_NOT_INCLUDED"),"Neither the wrapped end date nor the explicit publication may be dropped");
});

test("021 accepted source entries hydrate name and exam profile with provenance, privacy and existing values preserved",async()=>{
  const text=fixture.pages.map(page=>page.text).join("\n\n");
  const extraction={status:"EXTRACTED",sourceDocumentId:source.id,pages:fixture.pages,pageCount:1,text,charCount:text.length,extractionMethod:"PDFJS_TEXT_LAYER",warnings:[],inspected:{name:fixture.sourceFilename,size:24242,mimeType:"application/pdf",sha256:fixture.sourceSha256}};
  const result=await createD1408PdfIntakeAdapter({pdfExtractor:async()=>extraction}).extract({file:{name:fixture.sourceFilename,size:24242,type:"application/pdf"},documentType:"CV"});
  const state=createIntakeState({candidates:result.candidates.slice(0,3)});
  state.stage='review';
  state.candidates[0].expanded=true;state.candidates[2].expanded=true;
  assert.match(renderIntake(state),/Name from the CV header/);
  assert.match(renderIntake(state),/Not stated — review/);
  state.candidates.forEach(candidate=>{candidate.decision='accepted';candidate.visibilityState='ADVISOR_ONLY';});
  let serial=0;const batch=buildApprovalBatch(state,[],{idFactory:prefix=>`${prefix}-${++serial}`});
  const document={events:[],studentProfile:{},builder:{}};
  applyApprovalBatchToDocument(document,batch);
  assert.equal(document.studentProfile.fullName,'Ana Popescu');
  assert.equal(document.studentProfile.fullNameProvenance[0].sourceExcerpt,'Ana Popescu, MD');
  assert.equal(document.studentProfile.fullNameProvenance[0].sourceSha256,fixture.sourceSha256);
  for(const field of ['fullName','medicalSchool','graduationDate','degree']){
    const authority=document.studentProfile.fieldProvenance[field];
    assert.equal(authority.sourceType,'document-intake');
    assert.equal(authority.visibilityState,'ADVISOR_ONLY');
    assert.ok(document.events.some(event=>event.id===authority.sourceEventId));
    assert.ok(authority.provenance.length);
  }
  assert.equal(document.exams.find(exam=>exam.examId==='step-1').result,'Passed');
  const scored=document.exams.find(exam=>exam.examId==='step-2-ck');
  assert.equal(scored.score,'251');assert.equal(scored.result,'');
  assert.equal(scored.visibilityState,'ADVISOR_ONLY');
  assert.ok(document.events.some(event=>event.id===scored.sourceEventId));
  assert.ok(scored.provenance[0].sourceExcerpt.includes('251'));
  assert.ok(document.events.every(event=>event.visibilityState==='ADVISOR_ONLY'));
  const existing={events:[],studentProfile:{fullName:'Student chosen name'},exams:[{id:'manual',system:'USMLE',examId:'step-2-ck',examDate:'2023-03',score:'249',result:'Passed'}]};
  applyApprovalBatchToDocument(existing,batch);
  assert.equal(existing.studentProfile.fullName,'Student chosen name');
  assert.equal(existing.studentProfile.fieldProvenance.fullName,undefined);
  assert.equal(existing.exams.find(exam=>exam.id==='manual').score,'249');
  const unaccepted=createIntakeState({candidates:result.candidates.slice(0,3)});
  unaccepted.stage='review';
  unaccepted.candidates[1].decision='accepted';
  const examOnly=buildApprovalBatch(unaccepted,[]);
  assert.equal(examOnly.profilePrefill,null,'An unaccepted education/name source cannot hydrate the profile');
});

test('021 calendar-invalid and ambiguous numeric dates cannot manufacture quick-review months',()=>{
  for(const date of ['04/05/2022','2022-13','2022-00','February 31 2022','2023-02-29','13/2022']){
    const result=pipeline(pagesFor(['USMLE',`USMLE Step 1 Passed | Synthetic Hospital | ${date}`]));
    const candidate=result.candidates[0];
    assert.equal(candidate.startDate,'',date);
    assert.notEqual(candidate.confidence.level,'HIGH',date);
    assert.equal(candidate.safeToBulkAccept,false,date);
    const state=createIntakeState({candidates:result.mapped});state.stage='review';state.candidates[0].decision='accepted';
    assert.throws(()=>buildApprovalBatch(state,[]),error=>error.code==='INTAKE_ACCEPTED_CANDIDATE_INVALID',date);
  }
  const european=pipeline(pagesFor(['USMLE','USMLE Step 1 Passed | Synthetic Hospital | 31/12/2022'])).candidates[0];
  assert.equal(european.startDate,'2022-12');
  assert.equal(european.dateRange.start.isoDate,'2022-12-31');
  assert.equal(european.safeToBulkAccept,false);
  assert.match(european.warnings.join(' '),/day\/month\/year/);
  const free=pipeline(pagesFor(['USMLE','USMLE Step 1 Passed — 04/05/2022'])).candidates[0];
  assert.equal(free.startDate,'','The full ambiguous date must not be truncated to 05/2022');
  assert.equal(parseDatePoint('2024-02-29').isoDate,'2024-02-29');
  assert.equal(parseDatePoint('February 28 2022').isoDate,'2022-02-28');
});

test('021 medical graduation uses its own endpoint, preserves year precision and reuses its private accepted event',()=>{
  const degree={id:'md',title:'Doctor of Medicine',categoryId:'education',eventType:'duration',startDate:'2016-01',endDate:'2022-12',visibilityState:'ADVISOR_ONLY',fields:{canonicalType:'MEDICAL_DEGREE',degree:'MD',medicalSchool:'Synthetic Medical School',datePrecision:{start:'MONTH',end:'YEAR'}},provenance:[{sourceExcerpt:'Doctor of Medicine January 2016–2022',sourceSha256:fixture.sourceSha256}]};
  const unrelated={...degree,id:'bsc',title:'Graduation Bachelor of Science',eventType:'milestone',startDate:'2015-06',endDate:null,fields:{canonicalType:'GRADUATION',degree:'BSc'}};
  const state=createIntakeState({candidates:[unrelated,degree]});state.stage='review';state.candidates.forEach(candidate=>candidate.decision='accepted');
  const batch=buildApprovalBatch(state,[]);
  assert.equal(batch.profilePrefill.graduationDate,'2022');
  assert.equal(batch.profilePrefill.graduationDatePrecision,'YEAR');
  assert.equal(batch.profilePrefill.sourceCandidateId,'md');
  const document={events:[],studentProfile:{}};applyApprovalBatchToDocument(document,batch);
  assert.equal(document.studentProfile.graduationDate,'2022');
  assert.equal(validateCoreInfo(document.studentProfile).graduationDate,undefined);
  const before=JSON.stringify(document.events),event=syncEducationMilestone(document);
  assert.equal(JSON.stringify(document.events),before,'Profile synchronization must not create an unprovenanced public duplicate');
  assert.equal(event.id,document.studentProfile.fieldProvenance.graduationDate.sourceEventId);
  assert.equal(event.visibilityState,'ADVISOR_ONLY');
  assert.equal(event.fields.datePrecision.end,'YEAR');
  state.candidates[1].fields.datePrecision.end='MONTH';
  assert.equal(buildApprovalBatch(state,[]).profilePrefill.graduationDate,'2022-12');
});

test('021 enriching a manual exam tags only the new source-derived field and preserves manual authority',()=>{
  const candidate={id:'score',title:'USMLE Step 2 CK — 251',categoryId:'exams',eventType:'milestone',startDate:'2023-03',visibilityState:'ADVISOR_ONLY',fields:{canonicalType:'STEP_2_CK',score:'251',result:''},provenance:[{sourceExcerpt:'USMLE Step 2 CK — 251',sourceSha256:fixture.sourceSha256}]};
  const state=createIntakeState({candidates:[candidate]});state.stage='review';state.candidates[0].decision='accepted';
  const doc={events:[],exams:[{id:'manual',system:'USMLE',examId:'step-2-ck',examDate:'2023-03',result:'Passed',score:''}]};
  applyApprovalBatchToDocument(doc,buildApprovalBatch(state,[]));
  assert.equal(doc.exams[0].result,'Passed');assert.equal(doc.exams[0].score,'251');
  assert.equal(doc.exams[0].sourceType,undefined,'Partial enrichment cannot promote the whole manual record');
  assert.equal(doc.exams[0].fieldProvenance.result,undefined);
  assert.equal(doc.exams[0].fieldProvenance.score.visibilityState,'ADVISOR_ONLY');
  assert.equal(doc.exams[0].fieldProvenance.score.sourceEventId,doc.events[0].id);
});

test('021 physical golden degree keeps its source study period through visibility edits and graduates at its explicit endpoint',()=>{
  const observed=golden.observedEvent;
  assert.equal(observed.eventType,'milestone','Preserve the exact observed defect as evidence');
  assert.equal(observed.fields.normalizedInterpretation.timelineKind,'duration');
  assert.equal(golden.observedGraduationDate,'2016-09');
  const extracted={...structuredClone(observed),id:'golden-md',eventType:observed.fields.normalizedInterpretation.timelineKind,decision:'undecided'};
  let state=createIntakeState({candidates:[extracted]});state.stage='review';
  state=transitionIntake(state,{type:'EDIT_CANDIDATE',id:'golden-md',patch:{visibilityState:'INTERVIEWER_SAFE'}});
  assert.equal(state.candidates[0].eventType,'duration','Visibility editing cannot coerce a degree to a milestone');
  state.candidates[0].decision='accepted';
  const document={id:'golden-md-regression',events:[],studentProfile:{}};
  applyApprovalBatchToDocument(document,buildApprovalBatch(state,[]));
  assert.equal(document.studentProfile.graduationDate,'2022-06');
  assert.equal(document.events[0].startDate,'2016-09');
  assert.equal(document.events[0].endDate,'2022-06');
  assert.equal(document.events[0].eventType,'duration');
  const svg=serializeFounderPresentation(document,{scope:'INTERVIEWER_SAFE',currentMonth:'2026-09'}).svg;
  assert.match(svg,/9\/16[^<]*6\/22/,'Canonical date caption must show both source period edges');
  state.candidates[0].eventType='milestone';
  assert.equal(buildApprovalBatch(state,[]).profilePrefill.graduationDate,'2022-06','A legacy milestone+end still uses the explicit endpoint for graduation');
});

test('021 actual inline builder retains year-only graduation and cannot generate a public duplicate from imported profile',()=>{
  const sourceAuthority={sourceType:'document-intake',sourceEventId:'accepted-md',visibilityState:'ADVISOR_ONLY'};
  const context={state:{wiz:{name:'Synthetic Name',school:'Synthetic School',grad:'2022',gradPrecision:'YEAR',degree:'MD',country:'Romania',schoolEntryMode:'unlisted',schoolVerificationStatus:'unverified-source-claimed',profileFieldProvenance:{graduationDate:sourceAuthority}},profile:{},user:{events:[{id:'accepted-md',s:'2016-01',e:'2022-12',mile:false,vis:'advisor'}]}},window:{},COUNTRIES:['Romania'],WORK_AUTHORIZATION_404:[],esc:String,needsResidencyVisaQuestion404:()=>false,queueUnlistedSchool404:()=>{},coreInfoValid:()=>true,renderBuilder404:()=>{},renderBoards:()=>{},renderHud:()=>{},renderHome:()=>{}};
  vm.createContext(context);
  const markup=inlineSource.slice(inlineSource.indexOf('function coreInfoMarkup(){'),inlineSource.indexOf('let schoolRegistryRows404='));
  const sync=inlineSource.slice(inlineSource.indexOf('function syncCoreInfo(){'),inlineSource.indexOf('function showCoreErrors('));
  vm.runInContext(markup+'\n'+sync,context);
  const html=vm.runInContext('coreInfoMarkup()',context);
  assert.match(html,/Graduation year/);
  assert.match(html,/value="2022"/);
  assert.match(html,/Graduation month remains unconfirmed/);
  const before=JSON.stringify(context.state.user.events);
  vm.runInContext('syncCoreInfo()',context);
  assert.equal(JSON.stringify(context.state.user.events),before);
  assert.ok(!context.state.user.events.some(event=>event.id==='education-core'));
});

test("021 profile name requires an explicit personal header and server mapping binds it to the same source",()=>{
  const blocks=pipeline().blocks;
  const claim=sourceProfileNameClaim(blocks,source);
  assert.equal(claim.value,'Ana Popescu');
  assert.equal(claim.provenance.sourceBlockId,blocks[0].id);
  for(const text of ['Global University, MD','Curriculum Vitae','Ana Popescu','ana@example.com','Name: Medical School','Name: Ana 123']){
    assert.equal(sourceProfileNameClaim([{...blocks[0],text}],source),null,text);
  }
  const mapped=mapCvIntelligenceCandidateToUxr({id:'ai-degree',title:'Doctor of Medicine (MD)',canonicalType:'EDUCATION',categoryId:'education',startDate:'2016-09',endDate:'2022-06',timelineKind:'duration',confidence:{level:'MEDIUM',score:75},evidence:[]},{sourceDocument:source,sourceBlocks:blocks});
  assert.equal(mapped.fields.profileFullName,'Ana Popescu');
  assert.equal(mapped.fields.profileNameProvenance[0].sourceExcerpt,'Ana Popescu, MD');
});

test("021 study plans, negation and conflicting outcomes do not manufacture exam results",()=>{
  const candidate={id:'step',canonicalType:'STEP_1',categoryId:'usmle',timelineKind:'milestone',startDate:'2022-11',confidence:{level:'HIGH'},provenance:[]};
  for(const title of ['USMLE Step 1 not passed','USMLE Step 1 will pass','USMLE Step 1 preparation']){
    assert.equal(mapD1408CandidateToUxr({...candidate,title}).fields.result,'',title);
  }
  assert.equal(mapD1408CandidateToUxr({...candidate,title:'USMLE Step 1 — Failed'}).fields.result,'Failed');
  const conflict=mapD1408CandidateToUxr({...candidate,title:'USMLE Step 1 — Passed',provenance:[{sourceExcerpt:'USMLE Step 1 — Failed'}]});
  assert.equal(conflict.fields.result,'');
});

test("021 headings stop research and education context leaking into volunteering and USMLE entries",()=>{
  assert.equal(classifyHeading("VOLUNTEERING"),"volunteer");
  assert.equal(classifyHeading("USMLE"),"examinations");
  const {candidates}=pipeline();
  const volunteer=candidates.find(item=>item.title.startsWith("Volunteer"));
  assert.equal(volunteer.section,"volunteer");
  assert.equal(volunteer.provenance.length,1);
  for(const candidate of candidates.filter(item=>item.title.startsWith("USMLE"))){
    assert.equal(candidate.section,"examinations");
    assert.equal(candidate.provenance.length,1);
    assert.notEqual(candidate.organization,"USMLE");
  }
});

test("021 university employer wording never overrides an explicit work or research role",()=>{
  const range=normalizeDateRange("January 2023 - June 2024");
  assert.equal(classifyEvent({title:"Resident Physician, Emergency University Hospital",section:"work"},range).canonicalType,"RESIDENCY_FELLOWSHIP");
  assert.equal(classifyEvent({title:"Research Assistant, Carol Davila University",section:"unknown"},range).canonicalType,"RESEARCH_EXPERIENCE");
  assert.equal(classifyEvent({title:"Medical Officer, University Hospital",section:"work"},range).canonicalType,"WORK_EXPERIENCE");
  assert.equal(classifyEvent({title:"Cardiology Research Fellow",section:"research"},range).canonicalType,"RESEARCH_EXPERIENCE");
  assert.equal(classifyEvent({title:"Clinical Elective",location:"Bucharest, Romania",section:"experiences"},range).canonicalType,"UNCLASSIFIED","A new clinical keyword cannot invent USCE geography");
});

test("021 wrapped range retains both exact source lines and a complete high-confidence research duration",()=>{
  const {candidates,blocks}=pipeline();
  const research=candidates.find(item=>item.title.startsWith("Research Assistant"));
  assert.equal(research.timelineKind,"duration");
  assert.equal(research.startDate,"2021-03");
  assert.equal(research.endDate,"2022-12");
  assert.equal(research.safeToBulkAccept,true);
  assert.deepEqual(research.provenance.map(item=>item.sourceExcerpt),[
    "Research Assistant, Cardiovascular Outcomes Lab, Carol Davila University — March 2021 –",
    "December 2022"
  ]);
  assert.deepEqual(research.originalExtraction.sourceBlockIds,research.provenance.map(item=>item.sourceBlockId));
  assert.ok(research.provenance.every(item=>blocks.some(block=>block.id===item.sourceBlockId&&block.text===item.sourceExcerpt)));
});

test("021 date continuation requires a hanging separator and cannot cross a section, page, or another entry",()=>{
  for(const pages of [
    pagesFor(["RESEARCH","Research Assistant — March 2021 –","PUBLICATIONS","December 2022"]),
    pagesFor(["RESEARCH","Research Assistant — March 2021 –","Volunteer role, Red Cross — December 2022"]),
    [pagesFor(["RESEARCH","Research Assistant — March 2021 –"])[0],{...pagesFor(["December 2022"])[0],id:"page-2",pageNumber:2}]
  ]){
    const research=pipeline(pages).candidates.find(item=>item.title.startsWith("Research Assistant"));
    assert.equal(research.endDate,null);
    assert.equal(research.timelineKind,"duration");
    assert.equal(research.safeToBulkAccept,false);
    assert.notEqual(research.confidence.level,"HIGH");
    assert.equal(research.provenance.length,1);
    assert.ok(research.warnings.some(warning=>/end date is missing/.test(warning)));
  }
  const research=pipeline(pagesFor(["RESEARCH","Research Assistant — March 2021","December 2022"])).candidates[0];
  assert.equal(research.endDate,null,"Nearby dates alone do not establish a range");
});

test("021 year-only publication and volunteering preserve explicit precision and cannot bulk-accept invented months",()=>{
  const {candidates,mapped}=pipeline();
  const publication=candidates.find(item=>item.canonicalType==="PUBLICATION");
  assert.equal(publication.timelineKind,"milestone");
  assert.equal(publication.dateRange.start.raw,"2023");
  assert.equal(publication.datePrecision.start,"YEAR");
  assert.equal(publication.safeToBulkAccept,false);
  assert.equal(publication.provenance.length,1);
  const volunteer=candidates.find(item=>item.canonicalType==="VOLUNTEER_EXPERIENCE");
  assert.deepEqual(volunteer.datePrecision,{start:"YEAR",end:"YEAR"});
  assert.equal(volunteer.safeToBulkAccept,false);
  assert.equal(volunteer.inferredFields.length,2);
  assert.equal(mapped.filter(item=>item.confidence==="high").length,7);
  for(const candidate of mapped.filter(item=>/^(Publication:|Volunteer)/.test(item.title))){
    assert.equal(candidate.confidence,"medium");
    assert.ok(candidate.inferredFields.length>0);
    assert.ok(candidate.warnings.some(warning=>/source precision remains year-only/.test(warning)));
  }
});
