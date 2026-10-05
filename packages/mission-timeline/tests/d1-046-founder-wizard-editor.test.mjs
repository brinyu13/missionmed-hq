import {activeSpecialtyVariant} from '../web/js/uxr-002/specialty-variants.js';
import {analyzeTimelineQuality} from "../web/js/uxr-002/quality-guardian.js";
import assert from "node:assert/strict";
import test from "node:test";
import {defaultDocument} from "../web/js/uxr-002/store.js";
import {chooseFounderOptionalMilestone,founderWizardMilestoneType,commitBuilderEntry,FOUNDER_OPTIONAL_MILESTONES,renderBuilder,validateExam} from "../web/js/uxr-002/builder.js";
import {addBuilderExam,updateBuilderExamAttempt,setBuilderExamSystem,proposeLocalTestStudyBounds,builderExamForReview,normalizeExamDocument,reviewSourceExamDates,sourceExamDefinition,sourceExamReviewCandidates} from "../web/js/uxr-002/exam-integration.js";
import {effectiveCategoryKey,addCategoryKeyPresentationOverride,removeCategoryKeyPresentationOverride,setCategoryKeyPresentationOverride,resetCategoryKeyPresentationOverride,renderAdvancedPresentationControls} from "../web/js/uxr-002/advanced-studio.js";
import {setFounderCategoryKey,resetFounderCategoryKey,deriveFounderEventDisplay,setFounderEventDisplay,computeFounderCategoryKey,projectFounderDisplayEvents} from "../web/js/presentation/founder-display-rules.js";
import {renderCanvasDetails,mountFounderBuilderStep407F,currentFounderBuilderStep407F,applyCanvasDisplayEdit407F,timelineWithLorPresentation,createPersistedExportMediaResolver407F,createExportDownloadLink407F} from "../web/js/407f-engineering-adapter.js";
import {TimelineStore} from "../web/js/uxr-002/store.js";
const loopback={protocol:"http:",hostname:"localhost"},production={protocol:"https:",hostname:"example.test"};
const entitlement={schemaVersion:"d1-405.timeline-entitlement.1",access:"FULL",verified:true,canRead:true,canCreate:true,canMutate:true,canExport:true};
class MemoryAdapter{
 constructor(){this.stores=new Map();}
 bucket(name){if(!this.stores.has(name))this.stores.set(name,new Map());return this.stores.get(name);}
 async open(){return this;}
 async get(store,key){return structuredClone(this.bucket(store).get(key)??null);}
 async put(store,value,key=value?.id){this.bucket(store).set(key,structuredClone(value));return value;}
 async list(store,predicate=()=>true){return [...this.bucket(store).values()].map(value=>structuredClone(value)).filter(predicate);}
 async atomicPut(entries){for(const {store,key,value} of entries)this.bucket(store).set(key,structuredClone(value));}
}
function sourceDocument(){const document=defaultDocument();document.mode="advanced";document.events=[{id:"clinical-source",categoryId:"clinical",eventType:"duration",title:"Internal Medicine Extern",siteName:"University of Wisconsin",startDate:"2025-01",endDate:"2025-03",fields:{role:"Internal Medicine Extern",institution:"University of Wisconsin",location:"Madison, Wisconsin"},visibilityState:"INTERVIEWER_SAFE"}];return document;}
test("optional questions never fabricate history and adding requires an actual date",()=>{
 const document=defaultDocument(),before=structuredClone(document.events);
 for(const title of FOUNDER_OPTIONAL_MILESTONES){assert.equal(chooseFounderOptionalMilestone(document,title),true);assert.deepEqual(document.events,before);assert.equal(document.builder.drafts.personal.startDate,"");}
 assert.equal(commitBuilderEntry(document,"personal",{happened:"Advanced degree completion"}).ok,false);assert.deepEqual(document.events,before);
 const added=commitBuilderEntry(document,"personal",{happened:"Custom source title",displayLabel:"My milestone",startDate:"2025-08",whenKind:"One date"});assert.equal(added.ok,true);assert.equal(added.event.title,"Custom source title");assert.equal(document.presentationOverrides.events[added.event.id].label,"My milestone");assert.match(renderBuilder(document),/Optional milestones/);assert.ok(FOUNDER_OPTIONAL_MILESTONES.some(title=>title.includes("EAD")));
});
test("source full labels remain visible and display controls preserve source fields",()=>{
 const document=sourceDocument(),original=structuredClone(document.events);
 const edited=setFounderEventDisplay(document,original[0].id,{role:"IM",institution:"U of Wisconsin",location:"Madison WI",categoryId:"volunteer"});
 assert.deepEqual(edited.events,original);const html=renderCanvasDetails({step:3},edited.events[0],edited);assert.match(html,/Full source label/);assert.match(html,/University of Wisconsin/);assert.match(html,/data-canvas-display-field="institution"/);assert.match(html,/data-canvas-display-save/);
});
test("unused custom key rows remain assignable and used rows require reassignment",()=>{
 const source=sourceDocument(),original=structuredClone(source.events);let result=addCategoryKeyPresentationOverride(source,"Community","#225566");assert.equal(result.changed,true);let doc=result.document;
 const custom=effectiveCategoryKey(doc).find(row=>row.label==="Community");assert.ok(custom);assert.equal(computeFounderCategoryKey(doc).some(row=>row.id===custom.id),false);
 doc=setFounderEventDisplay(doc,original[0].id,{categoryId:custom.id});assert.equal(removeCategoryKeyPresentationOverride(doc,custom.id).changed,false);
 result=setCategoryKeyPresentationOverride(doc,custom.id,{label:"Volunteer work",color:"#336699"});assert.equal(result.changed,true);doc=result.document;assert.match(renderAdvancedPresentationControls(doc),/Volunteer work/);
 result=removeCategoryKeyPresentationOverride(doc,custom.id,"volunteer");assert.equal(result.changed,true);assert.deepEqual(result.document.events,original);assert.equal(result.document.presentationOverrides.events[original[0].id].categoryId,"volunteer");
 doc=resetCategoryKeyPresentationOverride(result.document).document;assert.equal(doc.presentationOverrides.categoryKey,undefined);assert.deepEqual(doc.events,original);
});
test("USMLE and COMLEX need explicit study bounds and never infer retake dates or results",()=>{
 for(const [system,type] of [["USMLE","step-1"],["COMLEX-USA","level-1"]]){
  const document=defaultDocument();setBuilderExamSystem(document,system,true);addBuilderExam(document,system,type);const id=document.exams[0].id;
  updateBuilderExamAttempt(document,id,{result:"Failed",examDate:"2025-08"});assert.equal(document.events.some(event=>event.eventType==="duration"),false);
  const second=document.exams.find(record=>record.attempt===2);assert.ok(second);assert.equal(second.studyStartDate,"");assert.equal(second.studyEndDate,"");
  updateBuilderExamAttempt(document,id,{studyStartDate:"2025-04",studyEndDate:"2025-07"});const duration=document.events.find(event=>event.eventType==="duration");assert.equal(duration.startDate,"2025-04");assert.equal(duration.endDate,"2025-07");
  updateBuilderExamAttempt(document,second.id,{result:"Unknown",examDate:"2025-12",studyStartDate:"2025-09",studyEndDate:"2025-11"});assert.equal(document.events.filter(event=>event.eventType==="duration").length,2);assert.equal(document.exams.find(record=>record.id===second.id).result,"Unknown");
 }
 assert.ok(validateExam({system:"USMLE",examId:"step-1",result:"Unknown",examDate:"2026-08-17"}).studyStartDate);assert.equal(validateExam({system:"USMLE",examId:"step-1",result:"Unknown",examDate:"2026-08-17"}).result,undefined);
});
function sourceExams(){
 const document=defaultDocument();document.builder.step=2;document.events=[
 {id:"exam-first",startDate:"2025-08",fields:{canonicalType:"STEP_1",result:"Failed"}},
 {id:"exam-second",startDate:"2026-08-17",fields:{canonicalType:"STEP_1"}},
 {id:"exam-ck",startDate:"2026-09",fields:{canonicalType:"STEP_2_CK"}},
 {id:"exam-third",startDate:"2026-10",fields:{canonicalType:"STEP_3"}}
 ].map(event=>({...event,categoryId:"exams",eventType:"milestone",title:event.fields.canonicalType,visibilityState:"ADVISOR_ONLY",sourceType:"document-intake",provenance:[{extractionCandidateId:event.id}]}));return document;
}
test("known source exam dates become reviewable through the existing wizard without inferred ordinals",()=>{
 const document=sourceExams(),source=structuredClone(document.events);assert.match(renderBuilder(document),/data-review-source-exams/);reviewSourceExamDates(document);assert.deepEqual(document.events,source);assert.equal(document.exams.length,4);assert.equal(document.exams.filter(record=>record.result==="Unknown").length,3);assert.ok(document.exams.every(record=>record.attempt===undefined&&record.attemptNumberUnconfirmed));assert.match(renderBuilder(document),/Actual study end/);
});
test("four imported local TEST studies preserve sources, exact end date and provenance across reopen, then disappear outside gate",()=>{
 const prior=globalThis.location;globalThis.location=loopback;
 try{
  const document=sourceExams(),source=structuredClone(document.events);reviewSourceExamDates(document);const original=structuredClone(document.exams);assert.throws(()=>proposeLocalTestStudyBounds(document,original[0].id),/confirmation required/);
  document.metadata.localTestPrototype=true;for(const record of original)proposeLocalTestStudyBounds(document,record.id);
  assert.deepEqual(document.exams,original);assert.deepEqual(document.events.filter(event=>event.eventType==="milestone"),source);const durations=document.events.filter(event=>event.eventType==="duration");assert.equal(durations.length,4);
  const exact=durations.find(event=>event.fields.sourceEventId==="exam-second");assert.equal(exact.endDate,"2026-08-17");assert.equal(exact.fields.placeholder,true);assert.equal(exact.fields.sourcePrecision,"UNKNOWN");assert.equal(exact.fields.originalKnownValue,null);
  const bounds=document.builder.examStudyReviewOverrides[original[1].id];assert.equal(bounds.fieldProvenance.studyEndDate.placeholder,false);assert.equal(bounds.fieldProvenance.studyEndDate.originalKnownValue,"2026-08-17");
  const reopened=JSON.parse(JSON.stringify(document));normalizeExamDocument(reopened);assert.deepEqual(reopened.exams,original);assert.equal(reopened.events.filter(event=>event.sourceType==="local-test-study").length,4);
  globalThis.location=production;assert.equal(builderExamForReview(reopened,reopened.exams[0]).studyStartDate,"");assert.equal(projectFounderDisplayEvents(reopened).events.filter(event=>event.sourceType==="local-test-study").length,0);normalizeExamDocument(reopened);assert.equal(reopened.events.filter(event=>event.sourceType==="local-test-study").length,0);
 }finally{globalThis.location=prior;}
});
test("actual imported study dates project without override and explicit corrections retain original facts",()=>{
 const document=sourceExams();reviewSourceExamDates(document);const record=document.exams[2];record.studyStartDate="2026-06";record.studyEndDate="2026-08";normalizeExamDocument(document);assert.ok(document.events.some(event=>event.eventType==="duration"&&event.fields.sourceExamRecordId===record.id));
 const original=structuredClone(record),source=structuredClone(document.events.find(event=>event.id==="exam-ck"));updateBuilderExamAttempt(document,record.id,{result:"Passed",score:"242",examDate:"2026-09-15"});const corrected=document.exams.find(item=>item.id===record.id);assert.equal(corrected.examDate,"2026-09-15");assert.equal(corrected.result,"Passed");assert.deepEqual(corrected.sourceOriginal,original);assert.deepEqual(document.events.find(event=>event.id==="exam-ck"),source);const projected=projectFounderDisplayEvents(document).events.find(event=>event.id==="exam-ck");assert.equal(projected.startDate,"2026-09-15");assert.equal(projected.fields.result,"Passed");
});
test("actual store history and save/reopen retain display-only assignments",async()=>{
 const adapter=new MemoryAdapter(),clock=()=>new Date("2032-06-01T12:00:00.000Z"),store=new TimelineStore({adapter,clock,entitlement});await store.initialize();store.replace(sourceDocument(),{label:"Synthetic source"});
 const source=structuredClone(store.document.events);store.replace(setFounderEventDisplay(store.document,"clinical-source",{role:"IM",institution:"U of Wisconsin",categoryId:"volunteer"}),{label:"Edit display"});assert.equal(store.historyStatus().canUndo,true);assert.deepEqual(store.document.events,source);await store.saveNow("FOUNDER_DISPLAY_TEST");
 const restored=new TimelineStore({adapter,clock,entitlement});await restored.initialize();assert.equal(restored.document.presentationOverrides.events["clinical-source"].role,"IM");assert.equal(restored.document.presentationOverrides.events["clinical-source"].categoryId,"volunteer");assert.deepEqual(restored.document.events,source);clearTimeout(store.timer);clearTimeout(restored.timer);clearTimeout(store.entitlementTimer);clearTimeout(restored.entitlementTimer);
});
test("US status metadata requires explicit US preset or US country evidence",()=>{
 assert.equal(founderWizardMilestoneType({happened:"Received permanent residency / green card",toCountry:"Canada",toCountryCode:"CA"}),null);
 assert.equal(founderWizardMilestoneType({happened:"Received permanent residency / green card",toCountryCode:"US"}),"US_GREEN_CARD");
 assert.equal(founderWizardMilestoneType({happened:"Received an Employment Authorization Document (EAD)"}),null);
 assert.equal(founderWizardMilestoneType({happened:"Received a U.S. Employment Authorization Document (EAD)"}),"US_EAD");
});
test("exact study DAY dates reject reversed spans and end after exam within the same month",()=>{
 const document=sourceExams();reviewSourceExamDates(document);const record=document.exams[1];
 updateBuilderExamAttempt(document,record.id,{studyStartDate:"2026-08-14",studyEndDate:"2026-08-12"});assert.equal(document.events.filter(event=>event.eventType==="duration").length,0);
 updateBuilderExamAttempt(document,record.id,{studyStartDate:"2026-08-01",studyEndDate:"2026-08-18"});assert.equal(document.events.filter(event=>event.eventType==="duration").length,0);
 updateBuilderExamAttempt(document,record.id,{studyStartDate:"2026-08-01",studyEndDate:"2026-08-16"});const study=document.events.find(event=>event.eventType==="duration");assert.equal(study.startDate,"2026-08-01");assert.equal(study.endDate,"2026-08-16");assert.equal(study.fields.datePrecision.start,"DAY");assert.equal(study.fields.datePrecision.end,"DAY");
 assert.ok(validateExam({system:"USMLE",examId:"step-1",result:"Unknown",examDate:"2026-08-17",studyStartDate:"2026-08-01",studyEndDate:"2026-08-18"}).studyEndDate);
});
test("source MyERAS entries without optional canonical type surface exact exam aliases without inferred result or attempt",()=>{
 const document=sourceExams();const names=["USMLE Step 1","Step 1 — 2nd attempt","Step 2 CK","USMLE Step 3"];
 document.events=document.events.map((event,index)=>({...event,title:names[index],fields:{}}));const original=structuredClone(document.events);assert.equal(sourceExamReviewCandidates(document).length,4);assert.match(renderBuilder(document),/data-review-source-exams/);reviewSourceExamDates(document);assert.equal(document.exams.length,4);assert.deepEqual(document.events,original);assert.ok(document.exams.every(record=>record.result==="Unknown"&&record.score===""&&record.attempt===undefined));
 assert.equal(sourceExamDefinition({...original[0],title:"Step 1 research award"}),null);assert.equal(sourceExamDefinition({...original[0],eventType:"duration"}),null);assert.equal(sourceExamDefinition({...original[0],sourceType:"guided-builder"}),null);assert.equal(sourceExamDefinition({...original[0],categoryId:"research"}),null);assert.equal(sourceExamDefinition({...original[0],startDate:""}),null);
 const comlex={...original[0],title:"COMLEX-USA Level 2-CE",fields:{}};assert.equal(sourceExamDefinition(comlex).system,"COMLEX-USA");assert.equal(sourceExamDefinition(comlex).examId,"level-2-ce");
});

test("active 407F Builder step mount installs canonical source-review action on the existing host and real store",async()=>{
 const adapter=new MemoryAdapter(),clock=()=>new Date("2032-06-01T12:00:00.000Z"),store=new TimelineStore({adapter,clock,entitlement});await store.initialize();store.replace(sourceExams(),{label:"Synthetic source dates"});
 const listeners={},button={addEventListener(name,callback){listeners[name]=callback;}},host={dataset:{},innerHTML:"",addEventListener(){},querySelector(selector){return selector==="[data-review-source-exams]"?button:null;},querySelectorAll(){return[];}};
 let committed=0;assert.equal(mountFounderBuilderStep407F(host,{store,step:2,onCommitted:()=>committed++}),true);assert.equal(host.dataset.founderBuilderStep,"2");assert.match(host.innerHTML,/data-review-source-exams/);assert.equal(typeof listeners.click,"function");const source=structuredClone(store.document.events);listeners.click();await new Promise(resolve=>queueMicrotask(resolve));assert.equal(store.document.exams.length,4);assert.deepEqual(store.document.events,source);assert.equal(committed,1);assert.equal(store.historyStatus().canUndo,true);
 assert.equal(mountFounderBuilderStep407F(host,{store,step:1}),false);assert.equal(mountFounderBuilderStep407F(host,{store,step:6}),true);assert.match(host.innerHTML,/Optional milestones/);assert.equal(mountFounderBuilderStep407F(host,{store,step:4}),true);assert.match(host.innerHTML,/Volunteer/);clearTimeout(store.timer);clearTimeout(store.entitlementTimer);
});


test("active legacy Wizard step wins before persisted store synchronization",()=>{
 assert.equal(currentFounderBuilderStep407F({builder:{step:2}},{builder:{step:7}}),2);
 assert.equal(currentFounderBuilderStep407F({builder:{step:6}},{builder:{step:2}}),6);
 assert.equal(currentFounderBuilderStep407F({},{builder:{step:4}}),4);
 assert.equal(currentFounderBuilderStep407F(undefined,undefined),1);
});


test("existing COMLEX Wizard study labels use explicit supported type with Unknown or Passed results",()=>{
 for(const [examId,label] of [["level-1","Level 1"],["level-2-ce","Level 2-CE"],["level-3","Level 3"]])for(const result of ["Unknown","Passed"]){
  const document=defaultDocument();setBuilderExamSystem(document,"COMLEX-USA",true);addBuilderExam(document,"COMLEX-USA",examId);
  updateBuilderExamAttempt(document,document.exams[0].id,{result,score:examId==="level-1"?"":"540",examDate:"2025-08",studyStartDate:"2025-04",studyEndDate:"2025-08"});
  const study=document.events.find(event=>event.eventType==="duration"),before=JSON.stringify(document);
  assert.equal(deriveFounderEventDisplay(document,study).role,label);assert.equal(JSON.stringify(document),before);
  if(result==="Unknown")assert.equal(document.events.some(event=>event.eventType==="milestone"),false);
 }
});
test("source-linked COMLEX study labels require one exact supported review record and never infer ambiguous family",()=>{
 for(const [examId,label] of [["level-1","Level 1"],["level-2-ce","Level 2-CE"],["level-3","Level 3"]]){
  const document=defaultDocument(),study={id:"source-study",eventType:"duration",categoryId:"exams",title:"Study period",startDate:"2025-04",endDate:"2025-08",fields:{isStudyPeriod:true,sourceExamRecordId:"accepted-exam"}};
  document.events=[study];document.exams=[{id:"accepted-exam",system:"COMLEX-USA",examId,result:"Unknown",examDate:"2025-08"}];const before=JSON.stringify(document);
  assert.equal(deriveFounderEventDisplay(document,study).role,label);assert.equal(JSON.stringify(document),before);
  const ambiguous=structuredClone(document);ambiguous.exams.push({...ambiguous.exams[0],examId:examId==="level-1"?"level-3":"level-1"});assert.equal(deriveFounderEventDisplay(ambiguous,study).role,"Study");
  const wrongFamily=structuredClone(document);wrongFamily.exams[0].system="USMLE";assert.equal(deriveFounderEventDisplay(wrongFamily,study).role,"Study");
  const unsupported=structuredClone(document);unsupported.exams[0].examId="level-2-pe";assert.equal(deriveFounderEventDisplay(unsupported,study).role,"Study");
  const conflicting={...study,examTypeId:examId==="level-1"?"comlex-level-3":"comlex-level-1",systemId:"comlex"};assert.equal(deriveFounderEventDisplay(document,conflicting).role,"Study");
 }
});


test("contextual existing exams key labels reflect explicit families without changing source or saved customization",()=>{
 const add=(document,system,examId)=>{setBuilderExamSystem(document,system,true);addBuilderExam(document,system,examId);const record=document.exams.find(record=>record.system===system&&record.examId===examId);updateBuilderExamAttempt(document,record.id,{result:"Unknown",examDate:"2025-08",studyStartDate:"2025-04",studyEndDate:"2025-08"});};
 const key=document=>computeFounderCategoryKey(document).find(row=>row.id==="exams");
 const usmle=defaultDocument();add(usmle,"USMLE","step-1");const comlex=defaultDocument();add(comlex,"COMLEX-USA","level-1");const both=defaultDocument();add(both,"USMLE","step-1");add(both,"COMLEX-USA","level-1");
 const unknown=defaultDocument();unknown.events=[{id:"unprovided-family",eventType:"duration",categoryId:"exams",title:"Study period",startDate:"2025-04",endDate:"2025-08",fields:{isStudyPeriod:true}}];
 for(const [document,label] of [[usmle,"USMLE Studies"],[comlex,"COMLEX Studies"],[both,"USMLE/COMLEX"],[unknown,"Exam Studies"]]){const before=JSON.stringify(document);assert.equal(key(document).label,label);assert.equal(JSON.stringify(document),before);}
 const ambiguous=structuredClone(comlex);ambiguous.exams.push({...ambiguous.exams[0],system:"USMLE",examId:"step-1"});assert.equal(key(ambiguous).label,"Exam Studies");
 const source=JSON.stringify({events:comlex.events,exams:comlex.exams}),custom=setFounderCategoryKey(comlex,[{id:"exams",label:"Student study label",color:"#123456"}]);custom.presentationOverrides.colorKeyGeometry={x:1100,y:700,width:300,height:120};
 assert.equal(key(custom).label,"Student study label");assert.equal(key(custom).color,"#123456");const reset=resetFounderCategoryKey(custom);assert.equal(key(reset).label,"COMLEX Studies");assert.deepEqual(reset.presentationOverrides.colorKeyGeometry,custom.presentationOverrides.colorKeyGeometry);assert.equal(JSON.stringify({events:reset.events,exams:reset.exams}),source);
});


test("explicit local TEST duration refresh preserves placeholder provenance, known exact end, and real reviewed dates",()=>{
 const priorLocation=globalThis.location;globalThis.location=loopback;
 try{
  const document=sourceExams();reviewSourceExamDates(document);document.metadata.localTestPrototype=true;document.builder.step=2;
  const record=document.exams.find(record=>record.sourceEventId==="exam-second"),source=structuredClone(document.events),records=structuredClone(document.exams);
  proposeLocalTestStudyBounds(document,record.id);assert.match(renderBuilder(document),/Use 6-month LOCAL TEST study proposal/);
  proposeLocalTestStudyBounds(document,record.id,{monthsBefore:6});const override=document.builder.examStudyReviewOverrides[record.id];
  assert.equal(override.studyStartDate,"2026-02");assert.equal(override.studyEndDate,"2026-08-17");assert.equal(override.localTestOnly,true);assert.deepEqual(override.fieldProvenance.studyStartDate,{placeholder:true,reason:"LOCAL_TEST_STUDY_PROPOSAL",sourcePrecision:"UNKNOWN",originalKnownValue:null,sourceStudyValue:null});assert.equal(override.fieldProvenance.studyEndDate.placeholder,false);
  assert.deepEqual(document.exams,records);assert.deepEqual(document.events.filter(event=>event.eventType==="milestone"),source);
  const before=JSON.stringify(document);assert.throws(()=>proposeLocalTestStudyBounds(document,record.id,{monthsBefore:4}),/3, 6, or 9/);assert.equal(JSON.stringify(document),before);
  assert.throws(()=>proposeLocalTestStudyBounds(document,record.id,{location:production,monthsBefore:6}),/confirmation required/);assert.equal(JSON.stringify(document),before);
  assert.match(renderBuilder(document),/Use 9-month LOCAL TEST study proposal/);proposeLocalTestStudyBounds(document,record.id,{monthsBefore:9});assert.equal(document.builder.examStudyReviewOverrides[record.id].studyStartDate,"2025-11");assert.equal(document.builder.examStudyReviewOverrides[record.id].studyEndDate,"2026-08-17");assert.equal(document.builder.examStudyReviewOverrides[record.id].fieldProvenance.studyStartDate.placeholder,true);assert.deepEqual(document.exams,records);
  updateBuilderExamAttempt(document,record.id,{studyStartDate:"2026-03"});const actual=JSON.stringify(document);proposeLocalTestStudyBounds(document,record.id,{monthsBefore:9});assert.equal(JSON.stringify(document),actual);assert.doesNotMatch(renderBuilder(document),/Use 6-month LOCAL TEST study proposal/);
  const real=sourceExams();reviewSourceExamDates(real);real.metadata.localTestPrototype=true;const known=real.exams[0];known.studyStartDate="2023-02";known.studyEndDate="2023-04";const original=JSON.stringify(real);proposeLocalTestStudyBounds(real,known.id,{monthsBefore:6});assert.equal(JSON.stringify(real),original);
 }finally{globalThis.location=priorLocation;}
});


test("Guardian honors only explicit category confirmation while retaining unresolved source reviews",()=>{
 const document=defaultDocument();document.studentProfile.fullName="Synthetic";
 document.events=[{id:"confirmed-role",eventType:"duration",categoryId:"work",title:"Research Associate",startDate:"2023-01",endDate:"2024-01",visibilityState:"INTERVIEWER_SAFE",sourceType:"ai-cv",confidence:.4,provenance:[],fields:{categoryConfirmed:true}},{id:"unconfirmed-role",eventType:"duration",categoryId:"work",title:"Research Associate",startDate:"2024-03",endDate:"2025-03",visibilityState:"INTERVIEWER_SAFE",fields:{categoryConfirmed:false}}];
 const before=JSON.stringify(document),report=analyzeTimelineQuality(document),category=report.findings.filter(finding=>finding.code==="CATEGORY_REVIEW");
 assert.deepEqual(category.flatMap(finding=>finding.elementIds),["unconfirmed-role"]);assert.ok(report.findings.some(finding=>finding.code==="UNSUPPORTED_DERIVED_FACT"&&finding.elementIds.includes("confirmed-role")));assert.ok(report.findings.some(finding=>finding.code==="LOW_CONFIDENCE_AI_INFERENCE"&&finding.elementIds.includes("confirmed-role")));assert.equal(JSON.stringify(document),before);
});
test("Guardian long-label heuristic uses included Founder display fields and retains excluded source content holds",()=>{
 const document=defaultDocument();document.studentProfile.fullName="Synthetic";
 document.events=[{id:"short-display",eventType:"duration",categoryId:"work",startDate:"2023-01",endDate:"2024-01",title:"Synthetic source role with complete documentary wording retained verbatim for source evidence and student review",visibilityState:"INTERVIEWER_SAFE"},{id:"retained-cv",eventType:"milestone",categoryId:"education",startDate:"2024-06",title:"Certificate of Recognition with complete documentary wording retained for source review and evidence",fields:{canonicalType:"AWARD_HONOR"},sourceType:"document-intake",provenance:[],visibilityState:"INTERVIEWER_SAFE"},{id:"long-visible",eventType:"duration",categoryId:"work",startDate:"2024-01",endDate:"2025-01",title:"Long visible role",visibilityState:"INTERVIEWER_SAFE"}];
 document.presentationOverrides={events:{"short-display":{role:"Short role"},"long-visible":{role:"Explicit long display role with complete supplied wording that remains above the heuristic threshold"}}};
 const before=JSON.stringify(document),report=analyzeTimelineQuality(document),long=report.findings.find(finding=>finding.code==="LONG_EVENT_LABELS");
 assert.ok(long);assert.deepEqual(long.elementIds,["long-visible"]);assert.ok(report.findings.some(finding=>finding.code==="UNSUPPORTED_DERIVED_FACT"&&finding.elementIds.includes("retained-cv")));assert.equal(JSON.stringify(document),before);
});


test('046 export resolver recovers persisted portrait-only and aliased frame media from revoked preview URLs without changing source',async()=>{
 const priorReader=globalThis.FileReader,priorBitmap=globalThis.createImageBitmap;let encoded=0,decoded=0;globalThis.createImageBitmap=async blob=>{assert.equal(blob.type,'image/png');decoded++;return {width:1,height:1,close(){}};};
 globalThis.FileReader=class{async readAsDataURL(blob){this.result=`data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;encoded++;this.onload();}};
 try{
  const document=sourceDocument();document.mediaItems=[{id:'portrait-only',type:'profilePhoto',placement:'profile',visibilityState:'INTERVIEWER_SAFE',source:{blobKey:'persisted-portrait'}},{id:'photo-frame',mediaId:'library-photo',type:'photo',placement:'photo1',source:{blobKey:'frame-metadata-key'}}];
  document.advanced.media=[{id:'library-photo',source:{blobKey:'persisted-photo'}}];
  const before=JSON.stringify(document),calls=[],portrait=new Blob([Uint8Array.from([137,80,78,71,13,10,26,10]),'synthetic portrait'],{type:'image/png'}),photo=new Blob([Uint8Array.from([137,80,78,71,13,10,26,10]),'synthetic frame'],{type:'image/png'}),blobs=new Map([['persisted-portrait',portrait],['persisted-photo',photo]]);
  const store={document,adapter:{getBlob:async key=>{calls.push(key);return blobs.get(key)||null;}}},registry={get(){throw new Error('A revoked preview URL must never be reused when saved bytes exist.');}},resolve=createPersistedExportMediaResolver407F(store,registry);
  const [profile,frame]=await Promise.all([resolve('portrait-only',document.mediaItems[0]),resolve('library-photo',document.mediaItems[1])]);
  assert.equal(profile,`data:image/png;base64,${Buffer.from(await portrait.arrayBuffer()).toString('base64')}`);assert.equal(frame,`data:image/png;base64,${Buffer.from(await photo.arrayBuffer()).toString('base64')}`);
  assert.deepEqual(calls,['persisted-portrait','persisted-photo']);assert.equal(encoded,2);assert.equal(decoded,2);assert.equal(JSON.stringify(document),before);const reused=await resolve('library-photo',document.advanced.media[0]);assert.equal(reused,frame,'the same asset can serve library and frame roles without revoking an earlier export source');
  const {serializeFounderPresentationAsync}=await import('../web/js/presentation/founder-presentation-serializer.js');
  const rendered=await serializeFounderPresentationAsync(document,{scope:'FULL_STORY',currentMonth:'2026-10',mediaResolver:item=>resolve(item.mediaId||item.id,item)});
  assert.equal(rendered.scene.mediaProjection.profilePhoto.source,profile);assert.equal(rendered.scene.mediaProjection.photos[0].source,frame);assert.deepEqual(rendered.scene.mediaProjection.pendingIds,[]);assert.equal(JSON.stringify(document),before);
 }finally{globalThis.FileReader=priorReader;globalThis.createImageBitmap=priorBitmap;}
});
test('046 export media lookup rejects foreign aliases and document changes before returning persisted bytes',async()=>{
 const document=sourceDocument();document.mediaItems=[{id:'portrait-only',placement:'profile',source:{blobKey:'owned-portrait'}}];
 let reads=0,release;const pending=new Promise(resolve=>{release=resolve;});
 const store={document,adapter:{getBlob:async()=>{reads++;return pending;}}},registry={get(){throw new Error('Foreign media must not fall back to the preview registry.');}},resolve=createPersistedExportMediaResolver407F(store,registry),snapshot=JSON.stringify(document);
 assert.equal(await resolve('portrait-only',{id:'portrait-only',source:{blobKey:'foreign-portrait'}}),null);
 assert.equal(await resolve('foreign-id',{id:'foreign-id',source:{blobKey:'owned-portrait'}}),null);
 assert.equal(await resolve('portrait-only',{...document.mediaItems[0],documentId:'foreign-document'}),null);assert.equal(reads,0);
 const result=resolve('portrait-only',document.mediaItems[0]);store.document={...document,id:'another-document'};release(new Blob(['synthetic portrait'],{type:'image/png'}));assert.equal(await result,null);assert.equal(reads,1);assert.equal(JSON.stringify(document),snapshot);
});
test('046 actual export adapter uses persisted media resolver while missing bytes retain existing visible export checks',async()=>{
 const {readFile}=await import('node:fs/promises'),source=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');
 assert.match(source,/const exportAdapter=createLocalExportAdapter\(\{\s*resolveObjectUrl:createPersistedExportMediaResolver407F\(store,mediaUrls\)/);assert.match(source,/triggerDownload:\(blob,filename\)=>exportDelivery\.download\(blob,filename\)/);assert.match(source,/exportAdapter\.generate=request=>exportDelivery\.generate\(generateLocalExport,request\)/);assert.match(source,/const reconcile=\(event\)=>\{\s*exportDelivery\.sync\(\)/);assert.match(source,/unsubscribeStore=store\.subscribe\(\(\)=>\{\s*exportDelivery\.sync\(\)/);assert.match(source,/exportController\?\.destroy\(\);\s*exportDelivery\.destroy\(\)/);assert.match(source,/exportDelivery\.mount\(\);\s*api\.export=exportController/);
 const document=sourceDocument();document.mediaItems=[{id:'local-logo',placement:'ribbon',visibilityState:'INTERVIEWER_SAFE',source:{blobKey:'missing-local'}}];const before=JSON.stringify(document),store={document,adapter:{getBlob:async()=>null}},resolve=createPersistedExportMediaResolver407F(store,{get:id=>id==='local-logo'?'blob:synthetic-live-preview':null});
 assert.equal(await resolve('local-logo',document.mediaItems[0]),null);const {serializeFounderPresentationAsync,assertCompleteFounderPresentation}=await import('../web/js/presentation/founder-presentation-serializer.js');const rendered=await serializeFounderPresentationAsync(document,{scope:'FULL_STORY',currentMonth:'2026-10',mediaResolver:item=>resolve(item.mediaId||item.id,item)});assert.deepEqual(rendered.scene.mediaProjection.pendingIds,['local-logo']);assert.throws(()=>assertCompleteFounderPresentation(rendered),error=>error.code==='TIMELINE_EXPORT_MISSING_FIELDS'&&error.fields.some(field=>field.id==='local-logo'&&field.field==='media'));assert.equal(JSON.stringify(document),before);
});

test('046 persisted export resolver rejects unsupported or corrupt saved media before encoding',async()=>{
 const document=sourceDocument();document.mediaItems=[{id:'portrait-only',placement:'profile',source:{blobKey:'owned-portrait'}}];
 for(const blob of [new Blob(['synthetic'],{type:'text/html'}),new Blob(['not a PNG'],{type:'image/png'})]){
  const resolve=createPersistedExportMediaResolver407F({document,adapter:{getBlob:async()=>blob}},{get(){throw new Error('Invalid stored bytes must not fall back to a preview URL.');}});
  await assert.rejects(resolve('portrait-only',document.mediaItems[0]),/valid supported image/);
 }
});

test('046 export resolver blocks a document switch during FileReader encoding',async()=>{
 const priorReader=globalThis.FileReader,priorBitmap=globalThis.createImageBitmap;let reader;
 globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});globalThis.FileReader=class{readAsDataURL(){reader=this;}};
 try{
  const document=sourceDocument();document.mediaItems=[{id:'portrait',placement:'profile',source:{blobKey:'owned'}}];const snapshot=JSON.stringify(document),blob=new Blob([Uint8Array.from([137,80,78,71,13,10,26,10])],{type:'image/png'}),store={document,adapter:{getBlob:async()=>blob}},resolve=createPersistedExportMediaResolver407F(store,{get:()=>null});
  const result=resolve('portrait',document.mediaItems[0]);while(!reader)await new Promise(done=>setImmediate(done));store.document={...document,id:'another-document'};reader.result='data:image/png;base64,c3ludGhldGlj';reader.onload();assert.equal(await result,null);assert.equal(JSON.stringify(document),snapshot);
 }finally{globalThis.FileReader=priorReader;globalThis.createImageBitmap=priorBitmap;}
});


function syntheticExportDelivery(){
 class Node extends EventTarget{constructor(tag){super();this.tag=tag;this.children=[];this.isConnected=true;this.clicks=0;}setAttribute(){}append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);this.isConnected=false;}click(){this.clicks++;return this.dispatchEvent(new Event('click',{cancelable:true}));}}
 let current={...sourceDocument(),revision:1},host=new Node('host'),view='export',canExport=true,principalId='synthetic-principal';const created=[],revoked=[],documentNode={createElement:tag=>new Node(tag)},urlApi={createObjectURL:blob=>{created.push(blob);return `blob:synthetic-generated-${created.length}`;},revokeObjectURL:url=>revoked.push(url)};
 const delivery=createExportDownloadLink407F({getDocument:()=>current,getHost:()=>view==='export'?host:null,getEntitlement:()=>({canExport,principalId}),getPrincipal:()=>({principalId}),documentNode,urlApi});
 return{delivery,created,revoked,get host(){return host;},get current(){return current;},replace(doc){current=doc;},rerender(){host.children=[];},leave(){view='builder';},deny(){canExport=false;},changePrincipal(){principalId='another-principal';},unmount(){host.isConnected=false;}};
}
test('046 successful export keeps an ordinary visible download link across workspace rerender and distinguishes browser handoff from saved-file proof',async()=>{
 const f=syntheticExportDelivery(),before=JSON.stringify(f.current),blob=new Blob(['synthetic PNG'],{type:'image/png'}),artifact=await f.delivery.generate(async()=>({blob}),{}),result=f.delivery.download(artifact.blob,'Synthetic.png');
 assert.deepEqual(result,{downloaded:true,verification:'browser-download-dispatched'});assert.equal(f.created.length,1);let section=f.host.children[0],link=section.children[1];assert.equal(link.href,'blob:synthetic-generated-1');assert.equal(link.download,'Synthetic.png');assert.equal(link.textContent,'Download file');assert.equal(link.clicks,1);assert.match(section.children[0].textContent,/Download requested/);assert.doesNotMatch(section.children[0].textContent,/saved|verified/i);
 f.rerender();assert.ok(f.delivery.mount());section=f.host.children[0];assert.match(section.children[0].textContent,/Download ready/);section.children[1].click();assert.match(section.children[0].textContent,/download this file again/);assert.equal(f.created.length,1);assert.deepEqual(f.revoked,[]);assert.equal(JSON.stringify(f.current),before);
 const second=await f.delivery.generate(async()=>({blob:new Blob(['synthetic PDF'],{type:'application/pdf'})}),{});f.delivery.download(second.blob,'Synthetic.pdf');assert.deepEqual(f.revoked,['blob:synthetic-generated-1']);f.delivery.destroy();assert.deepEqual(f.revoked,['blob:synthetic-generated-1','blob:synthetic-generated-2']);assert.equal(f.host.children.length,0);
});
test('046 export download bytes cannot cross student/document/source revision or survive workspace unmount',async()=>{
 for(const change of ['student','source','leave','unmount','entitlement','owner','principal','privacy','audience']){
  const f=syntheticExportDelivery(),artifact=await f.delivery.generate(async()=>({blob:new Blob(['synthetic'])}),{});f.delivery.download(artifact.blob,'Synthetic.png');const link=f.host.children[0].children[1];
  if(change==='student')f.replace({...f.current,id:'another-student-document'});if(change==='source')f.replace({...f.current,revision:f.current.revision+1,title:'Changed Timeline'});if(change==='leave')f.leave();if(change==='unmount')f.unmount();if(change==='entitlement')f.deny();if(change==='owner')f.replace({...f.current,studentOwnerId:'another-owner'});if(change==='principal')f.changePrincipal();if(change==='privacy')f.replace({...f.current,metadata:{...f.current.metadata,prototypeStudyOverrides:{synthetic:true}}});if(change==='audience')f.replace({...f.current,exportState:{audience:'EVERYTHING',audienceDetails:{recipient:'another-recipient'}}});
  f.delivery.sync();assert.deepEqual(f.revoked,['blob:synthetic-generated-1']);assert.equal(f.host.children.length,0);assert.equal(link.click(),false,'detached old link cannot dispatch a stale download');assert.throws(()=>f.delivery.download(artifact.blob,'Old.png'),/current Timeline file again/);
 }
 const f=syntheticExportDelivery();let finish;const pending=new Promise(resolve=>{finish=resolve;}),generation=f.delivery.generate(()=>pending,{});f.replace({...f.current,id:'other-document'});finish({blob:new Blob(['previous student'])});await assert.rejects(generation,/Timeline changed/);assert.equal(f.created.length,0);assert.equal(f.host.children.length,0);
});
test('046 failed or unbound generation never exposes bytes and metadata-only export bookkeeping keeps exact generated source',async()=>{
 const f=syntheticExportDelivery();await assert.rejects(f.delivery.generate(async()=>{throw new Error('generation rejected');},{}),/generation rejected/);assert.throws(()=>f.delivery.download(new Blob(['unbound']),'Unbound.png'),/current Timeline file again/);assert.equal(f.created.length,0);await assert.rejects(f.delivery.generate(async()=>({blob:new Blob(['foreign'])}),{renderInput:{timeline:{id:'foreign-document',studentProfile:f.current.studentProfile}}}),/current student Timeline/);assert.equal(f.created.length,0);const denied=syntheticExportDelivery();denied.deny();await assert.rejects(denied.delivery.generate(async()=>({blob:new Blob(['denied'])}),{}),/Export access is required/);assert.equal(denied.created.length,0);
 const artifact=await f.delivery.generate(async()=>({blob:new Blob(['synthetic'])}),{});f.delivery.download(artifact.blob,'Synthetic.png');f.replace({...f.current,revision:f.current.revision+1,metadata:{...f.current.metadata,exportHistory022:[{filename:'Synthetic.png',browserHandoffOnly:true}]}});f.delivery.sync();assert.equal(f.revoked.length,0,'the export own history does not alter the generated source');assert.ok(f.delivery.mount());assert.match(f.host.children[0].children[0].textContent,/revision 1/);
});

const displayBinding=document=>({documentId:document.id,ownerId:document.studentOwnerId||'',revision:document.revision||0,variantId:activeSpecialtyVariant(document).id});
test('B1 selected-event display edit preserves facts, reuses existing hide/restore variants, saves/reopens and Undo restores exact display',async()=>{
 const adapter=new MemoryAdapter(),clock=()=>new Date('2032-06-01T12:00:00.000Z'),store=new TimelineStore({adapter,clock,entitlement});await store.initialize();const document=sourceDocument();document.studentOwnerId='synthetic-owner';document.events.push({...structuredClone(document.events[0]),id:'other',title:'Other source role',startDate:'2025-04',endDate:'2025-06'});store.replace(document,{label:'Synthetic source'});
 const source=structuredClone(store.document.events),priorOverride=structuredClone(store.document.presentationOverrides),beforeSvg=(await import('../web/js/presentation/founder-presentation-serializer.js')).serializeFounderPresentation(timelineWithLorPresentation(store.document),{scope:'EVERYTHING',currentMonth:'2026-10'}).svg;
 const edited=applyCanvasDisplayEdit407F(store.document,'clinical-source',{role:'IM',institution:'U of Wisconsin',labelSize:22,labelFit:'fit'},displayBinding(store.document),{visible:false});store.replace(edited,{label:'Edit Timeline display labels'});assert.deepEqual(store.document.events,source);assert.ok(activeSpecialtyVariant(store.document).hiddenEventIds.includes('clinical-source'));assert.equal(timelineWithLorPresentation(store.document).events.some(event=>event.id==='clinical-source'),false);
 const {buildExportPreviewInput}=await import('../web/js/uxr-002/export-screen.js');const preview=buildExportPreviewInput(timelineWithLorPresentation(store.document),{});assert.equal(preview.timeline.events.some(event=>event.id==='clinical-source'),false);assert.ok(preview.timeline.events.some(event=>event.id==='other'));
 await store.saveNow('B1_DISPLAY');const restored=new TimelineStore({adapter,clock,entitlement});await restored.initialize();assert.equal(restored.document.presentationOverrides.events['clinical-source'].labelSize,22);assert.deepEqual(restored.document.events,source);assert.ok(activeSpecialtyVariant(restored.document).hiddenEventIds.includes('clinical-source'));
 const visible=applyCanvasDisplayEdit407F(restored.document,'clinical-source',{},displayBinding(restored.document),{visible:true});assert.equal(timelineWithLorPresentation(visible).events.some(event=>event.id==='clinical-source'),true);assert.deepEqual(visible.events,source);assert.match(renderCanvasDetails({step:3},restored.document.events[0],restored.document),/data-canvas-display-visible/,'hidden source-backed event retains its restoration controls');
 store.undo();assert.deepEqual(store.document.presentationOverrides,priorOverride);assert.deepEqual(store.document.events,source);assert.equal((await import('../web/js/presentation/founder-presentation-serializer.js')).serializeFounderPresentation(timelineWithLorPresentation(store.document),{scope:'EVERYTHING',currentMonth:'2026-10'}).svg,beforeSvg);
 for(const instance of [store,restored]){clearTimeout(instance.timer);clearTimeout(instance.entitlementTimer);}
});
test('B1 selected display editor refuses stale document, owner, revision or active variant before changing any facts',()=>{
 const document=sourceDocument(),binding=displayBinding(document),before=JSON.stringify(document);
 for(const other of [{...binding,documentId:'different'},{...binding,ownerId:'different'},{...binding,revision:99},{...binding,variantId:'different'}])assert.throws(()=>applyCanvasDisplayEdit407F(document,'clinical-source',{role:'Edited'},other),{code:'TIMELINE_DISPLAY_EDITOR_STALE'});
 assert.equal(JSON.stringify(document),before);const markup=renderCanvasDetails({step:3},document.events[0],document);assert.match(markup,/data-display-document-id=/);assert.match(markup,/data-display-revision=/);assert.match(markup,/Role \/ milestone text size/);assert.match(markup,/Fit, minimum 18 px/);
});

test('B1 actual selected-event Save display handler parses font inputs, persists only display/variant state and rejects stale bindings',async()=>{
 const {readFile}=await import('node:fs/promises'),source=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8'),start=source.indexOf('const displayButton=event.target.closest?'),end=source.indexOf('const saveButton=event.target.closest?',start),branch=source.slice(start,end);
 assert.ok(start>0&&end>start);const execute=new Function('event','store','applyCanvasDisplayEdit407F','syncBridgeStateFromStore','canvasController','bridge',branch),document=sourceDocument(),events=structuredClone(document.events),binding=displayBinding(document),controls={dataset:{displayDocumentId:binding.documentId,displayOwnerId:binding.ownerId,displayRevision:String(binding.revision),displayVariantId:binding.variantId}},status={textContent:''};let persisted=0,renders=0;
 const inputs=[{dataset:{canvasDisplayField:'role'},type:'text',value:'IM'},{dataset:{canvasDisplayField:'labelSize'},type:'number',value:'22'},{dataset:{canvasDisplayField:'labelFit'},type:'select',value:'fit'}],form={dataset:{eventId:'clinical-source'},querySelectorAll:()=>inputs,querySelector:selector=>selector==='[data-founder-display-controls]'?controls:selector==='[data-canvas-display-visible]'?{checked:false}:status},button={closest:()=>form,hasAttribute:()=>false},event={target:{closest:()=>button},preventDefault(){},stopPropagation(){}},store={document,entitlement,replace(next){this.document=next;persisted++;}};
 execute(event,store,applyCanvasDisplayEdit407F,()=>{}, {render(){renders++;}},{toast(){}});assert.equal(persisted,1);assert.equal(renders,1);assert.deepEqual(store.document.events,events);assert.equal(store.document.presentationOverrides.events['clinical-source'].labelSize,22);assert.equal(store.document.presentationOverrides.events['clinical-source'].role,'IM');assert.ok(activeSpecialtyVariant(store.document).hiddenEventIds.includes('clinical-source'));
 controls.dataset.displayDocumentId='stale-document';execute(event,store,applyCanvasDisplayEdit407F,()=>{},{render(){}},{toast(){}});assert.equal(persisted,1);assert.match(status.textContent,/out of date/);assert.deepEqual(store.document.events,events);
});
