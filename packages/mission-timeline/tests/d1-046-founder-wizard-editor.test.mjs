import assert from "node:assert/strict";
import test from "node:test";
import {defaultDocument} from "../web/js/uxr-002/store.js";
import {chooseFounderOptionalMilestone,founderWizardMilestoneType,commitBuilderEntry,FOUNDER_OPTIONAL_MILESTONES,renderBuilder,validateExam} from "../web/js/uxr-002/builder.js";
import {addBuilderExam,updateBuilderExamAttempt,setBuilderExamSystem,proposeLocalTestStudyBounds,builderExamForReview,normalizeExamDocument,reviewSourceExamDates,sourceExamDefinition,sourceExamReviewCandidates} from "../web/js/uxr-002/exam-integration.js";
import {effectiveCategoryKey,addCategoryKeyPresentationOverride,removeCategoryKeyPresentationOverride,setCategoryKeyPresentationOverride,resetCategoryKeyPresentationOverride,renderAdvancedPresentationControls} from "../web/js/uxr-002/advanced-studio.js";
import {setFounderEventDisplay,computeFounderCategoryKey,projectFounderDisplayEvents} from "../web/js/presentation/founder-display-rules.js";
import {renderCanvasDetails,mountFounderBuilderStep407F,currentFounderBuilderStep407F} from "../web/js/407f-engineering-adapter.js";
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
