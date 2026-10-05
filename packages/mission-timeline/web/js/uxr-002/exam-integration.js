import {studyDateOrderError} from "./exam-workflow.js";
import {parseExactDate} from "./exact-date-field.js";
function parseMonth(value){const exact=parseExactDate(value);return exact?exact.slice(0,7):parseMonthValue(value);}
import {addMonths,parseMonth as parseMonthValue} from "./utils.js";
import {
  EXAM_SYSTEM_IDS,
  EXAM_TYPES,
  addExam,
  createExamWorkflowState,
  deleteExamAttempt,
  examAttemptId,
  examTimelineEvents,
  finalizeExamWorkflow,
  setExamSystemActive,
  updateExamAttempt,
  validateExamAttempt
} from "./exam-workflow.js";

const BUILDER_SYSTEM_TO_WORKFLOW=Object.freeze({
  USMLE:EXAM_SYSTEM_IDS.USMLE,
  "COMLEX-USA":EXAM_SYSTEM_IDS.COMLEX
});

const WORKFLOW_SYSTEM_TO_BUILDER=Object.freeze({
  [EXAM_SYSTEM_IDS.USMLE]:"USMLE",
  [EXAM_SYSTEM_IDS.COMLEX]:"COMLEX-USA"
});

const BUILDER_TO_WORKFLOW_TYPE=Object.freeze({
  "USMLE:step-1":"usmle-step-1",
  "USMLE:step-2-ck":"usmle-step-2-ck",
  "USMLE:step-2-cs":"usmle-step-2-cs",
  "USMLE:step-3":"usmle-step-3",
  "COMLEX-USA:level-1":"comlex-level-1",
  "COMLEX-USA:level-2-ce":"comlex-level-2-ce",
  "COMLEX-USA:level-3":"comlex-level-3"
});

const WORKFLOW_TYPE_TO_BUILDER=Object.freeze(Object.fromEntries(
  Object.entries(BUILDER_TO_WORKFLOW_TYPE).map(([builder,workflow])=>{
    const [system,examId]=builder.split(":");
    return[workflow,{system,examId}];
  })
));

const TYPE_BY_ID=new Map(EXAM_TYPES.map((type)=>[type.id,type]));

function clone(value){
  return structuredClone(value);
}

function builderRecordType(record){
  return BUILDER_TO_WORKFLOW_TYPE[`${record?.system}:${record?.examId}`]||null;
}

export function localTestStudyEnvironment(document={},location=globalThis.location){
  return location?.protocol==="http:"&&["localhost","127.0.0.1"].includes(location.hostname)&&document.metadata?.localTestPrototype===true;
}
export function builderExamForReview(document,record,{location=globalThis.location}={}){
  const override=document.builder?.examStudyReviewOverrides?.[record.id];
  if(!override)return record;
  if(override.localTestOnly&&!localTestStudyEnvironment(document,location))return record;
  return {...record,studyStartDate:override.studyStartDate??record.studyStartDate,studyEndDate:override.studyEndDate??record.studyEndDate,studyReviewProvenance:override.fieldProvenance};
}
export function proposeLocalTestStudyBounds(document,recordId,{location=globalThis.location,monthsBefore=3}={}){
  if(!localTestStudyEnvironment(document,location))throw new Error("Local TEST prototype confirmation required.");
  if(![3,6,9].includes(monthsBefore))throw new Error("Choose an explicit 3, 6, or 9-month local TEST proposal.");
  const record=(document.exams||[]).find(item=>item.id===recordId),examDate=parseMonth(record?.examDate);
  if(!examDate)throw new Error("Known exam date required for a local TEST proposal.");
  const reviewed=builderExamForReview(document,record,{location}),changes={},fieldProvenance={};
  const prior=document.builder?.examStudyReviewOverrides?.[recordId]||{};
  for(const [key,value] of [["studyStartDate",addMonths(examDate,-monthsBefore)],["studyEndDate",record.examDate]]){
    const refreshTestStart=key==="studyStartDate"&&!parseMonth(record[key])&&prior.localTestOnly===true&&prior.fieldProvenance?.[key]?.placeholder===true&&prior.fieldProvenance?.[key]?.reason==="LOCAL_TEST_STUDY_PROPOSAL";
    if(parseMonth(reviewed[key])&&!refreshTestStart)continue;changes[key]=value;
    fieldProvenance[key]={placeholder:key==="studyStartDate",reason:"LOCAL_TEST_STUDY_PROPOSAL",sourcePrecision:key==="studyStartDate"?"UNKNOWN":(record.examDatePrecision||"MONTH"),originalKnownValue:key==="studyStartDate"?null:record.examDate,sourceStudyValue:record[key]||null};
  }
  if(!Object.keys(changes).length)return document;
  document.builder||={};document.builder.examStudyReviewOverrides||={};
  document.builder.examStudyReviewOverrides[recordId]={...prior,...changes,localTestOnly:true,fieldProvenance:{...(prior.fieldProvenance||{}),...fieldProvenance}};
  return applyExamWorkflow(document,examWorkflowFromDocument(document));
}

const SOURCE_EXAM_TYPES={STEP_1:{system:"USMLE",examId:"step-1",name:"Step 1"},STEP_2_CK:{system:"USMLE",examId:"step-2-ck",name:"Step 2 CK"},STEP_3:{system:"USMLE",examId:"step-3",name:"Step 3"}};
export function sourceExamDefinition(event){
  if(event?.sourceType!=="document-intake"||event.categoryId!=="exams"||event.eventType!=="milestone"||!parseMonth(event.startDate))return null;
  const canonical=SOURCE_EXAM_TYPES[event.fields?.canonicalType];if(canonical)return canonical;
  let name=String(event.fields?.examName||event.title||"").trim();
  const comlex=/^COMLEX(?:-USA)?\b/i.test(name)||/^COMLEX(?:-USA)?$/i.test(event.fields?.examSystem||"");
  name=name.replace(/^(?:USMLE|COMLEX(?:-USA)?)\s*[:·—-]?\s*/i,"").replace(/\s*[-—·:]?\s*\(?\s*(?:[1-9][0-9]*(?:st|nd|rd|th)?\s+attempt|attempt(?:\s+[1-9][0-9]*)?)\s*\)?$/i,"").trim();
  if(!comlex){
    if(/^Step\s*1$/i.test(name))return SOURCE_EXAM_TYPES.STEP_1;
    if(/^Step\s*2\s*[- ]?\s*CK$/i.test(name))return SOURCE_EXAM_TYPES.STEP_2_CK;
    if(/^Step\s*3$/i.test(name))return SOURCE_EXAM_TYPES.STEP_3;
  }else{
    if(/^Level\s*1$/i.test(name))return{system:"COMLEX-USA",examId:"level-1",name:"Level 1"};
    if(/^Level\s*2\s*[- ]?\s*CE$/i.test(name))return{system:"COMLEX-USA",examId:"level-2-ce",name:"Level 2-CE"};
    if(/^Level\s*3$/i.test(name))return{system:"COMLEX-USA",examId:"level-3",name:"Level 3"};
  }
  return null;
}
export function sourceExamReviewCandidates(document){
  return(document.events||[]).filter(event=>sourceExamDefinition(event)&&!(document.exams||[]).some(record=>record.sourceEventId===event.id||record.fieldProvenance?.examDate?.sourceEventId===event.id));
}
export function reviewSourceExamDates(document){
  document.exams||=[];document.builder||={};
  for(const event of sourceExamReviewCandidates(document)){
    const definition=sourceExamDefinition(event);
    document.exams.push({id:"source-exam-review-"+event.id,system:"USMLE",...definition,examDate:event.startDate,examDatePrecision:event.fields?.datePrecision?.start||(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(event.startDate)?"DAY":"MONTH"),result:event.fields?.result||"Unknown",score:event.fields?.score||"",studyStartDate:"",studyEndDate:"",attemptNumberUnconfirmed:true,sourceType:"document-intake",sourceEventId:event.id,visibilityState:event.visibilityState||"ADVISOR_ONLY",provenance:clone(event.provenance||[]),fieldProvenance:clone(event.fields?.fieldProvenance||{})});
  }
  document.builder.examSystems=[...new Set([...(document.builder.examSystems||[]),...document.exams.map(record=>record.system)])];
  return applyExamWorkflow(document,examWorkflowFromDocument(document));
}
function unconfirmedSourceStudy(document,record){
  const reviewed=builderExamForReview(document,record),start=parseMonth(reviewed.studyStartDate),end=parseMonth(reviewed.studyEndDate),exam=parseMonth(record.examDate);
  if(!start||!end||!exam||studyDateOrderError(reviewed.studyStartDate,reviewed.studyEndDate,record.examDate))return[];
  const override=document.builder?.examStudyReviewOverrides?.[record.id]||{},sourceEvent=(document.events||[]).find(event=>event.id===record.sourceEventId);
  const local=override.localTestOnly===true;
  if(local&&!localTestStudyEnvironment(document))return[];
  return[{id:"source-study-"+record.id,attemptId:"source-exam:"+record.id,categoryId:"exams",eventType:"duration",title:(record.name||"Exam")+" — study period",startDate:reviewed.studyStartDate,endDate:reviewed.studyEndDate,openEnded:false,sourceType:local?"local-test-study":"exam-workflow",visibilityState:sourceEvent?.visibilityState||record.visibilityState||"ADVISOR_ONLY",fields:{builderDomain:"exams",builderEntryId:record.id,attemptId:"source-exam:"+record.id,isStudyPeriod:true,datePrecision:{start:parseExactDate(reviewed.studyStartDate)?"DAY":"MONTH",end:parseExactDate(reviewed.studyEndDate)?"DAY":"MONTH"},sourceDateWording:{start:reviewed.studyStartDate,end:reviewed.studyEndDate},sourceExamRecordId:record.id,sourceEventId:record.sourceEventId,localTestOnly:local,placeholder:override.fieldProvenance?.studyStartDate?.placeholder===true,reason:override.fieldProvenance?.studyStartDate?.reason,sourcePrecision:override.fieldProvenance?.studyStartDate?.sourcePrecision,originalKnownValue:override.fieldProvenance?.studyStartDate?.originalKnownValue,studyReviewProvenance:clone(override.fieldProvenance||{}),fieldProvenance:clone(record.fieldProvenance||{})}}];
}

function hasIntakeAuthority(record){
  return record?.sourceType==='document-intake'||Object.values(record?.fieldProvenance||{}).some(authority=>authority?.sourceType==='document-intake');
}

export function selectedBuilderExamSystems(document={}){
  const selected=new Set(document.builder?.examSystems||[]);
  if(document.builder?.examSystemSelectionExplicit!==true){
    for(const record of document.exams||[])if(hasIntakeAuthority(record)&&BUILDER_SYSTEM_TO_WORKFLOW[record.system])selected.add(record.system);
  }
  return [...selected];
}

function workflowAttempt(state,typeId,attemptNumber){
  return state.exams
    .find((group)=>group.examTypeId===typeId)
    ?.attempts.find((attempt)=>attempt.attemptNumber===attemptNumber)||null;
}

function suppressedRetakeIds(document){
  return new Set(
    Array.isArray(document?.builder?.examSuppressedRetakes)
      ?document.builder.examSuppressedRetakes.map(String)
      :[]
  );
}

export function examWorkflowFromDocument(document={}){
  let state=createExamWorkflowState();
  const records=Array.isArray(document.exams)?document.exams:[];
  const selected=new Set(selectedBuilderExamSystems(document));
  for(const builderSystem of selected){
    const workflowSystem=BUILDER_SYSTEM_TO_WORKFLOW[builderSystem];
    if(workflowSystem)state=setExamSystemActive(state,workflowSystem,true);
  }
  const groups=new Map();
  for(const record of records){
    if(record.attemptNumberUnconfirmed)continue;
    const typeId=builderRecordType(record);
    if(!typeId)continue;
    if(!groups.has(typeId))groups.set(typeId,[]);
    groups.get(typeId).push(record);
  }
  for(const [typeId,attempts] of groups){
    const type=TYPE_BY_ID.get(typeId);
    const explicitlyActive=!!state.activeSystems[type.systemId];
    if(!state.activeSystems[type.systemId]){
      state=setExamSystemActive(state,type.systemId,true);
    }
    state=addExam(state,typeId);
    attempts.sort((a,b)=>(Number(a.attempt)||1)-(Number(b.attempt)||1));
    for(const record of attempts){
      const number=Number(record.attempt)||1;
      const target=workflowAttempt(state,typeId,number);
      if(!target){
        const error=new RangeError(`Exam attempt ${number} has no automatic predecessor.`);
        error.code="D1_UXR_002_EXAM_ATTEMPT_WITHOUT_FAILED_PREDECESSOR";
        error.examTypeId=typeId;
        error.attemptNumber=number;
        throw error;
      }
      const reviewed=builderExamForReview(document,record);
      const changes={
        result:record.result||"",
        score:record.score||"",
        examDate:record.examDate||"",
        studyPeriodStart:reviewed.studyStartDate||record.studyPeriodStart||"",
        studyPeriodEnd:reviewed.studyEndDate||record.studyPeriodEnd||""
      };
      if(record.showScoreTouched||record.showScoreWasSet||hasIntakeAuthority(record)){
        changes.showScoreOnTimeline=!!record.showScoreOnTimeline;
      }
      state=updateExamAttempt(state,target.id,changes);
    }
    if(!explicitlyActive){
      state=setExamSystemActive(state,type.systemId,false);
    }
  }
  const suppressed=suppressedRetakeIds(document);
  if(suppressed.size){
    state.exams=state.exams.map((group)=>({
      ...group,
      attempts:group.attempts.filter((attempt)=>!suppressed.has(attempt.id))
    }));
  }
  return state;
}

export function builderRecordsFromExamWorkflow(state){
  const records=[];
  for(const group of state?.exams||[]){
    const type=TYPE_BY_ID.get(group.examTypeId);
    const builder=WORKFLOW_TYPE_TO_BUILDER[group.examTypeId];
    if(!type||!builder)continue;
    for(const attempt of group.attempts||[]){
      records.push({
        id:attempt.id,
        system:builder.system,
        examId:builder.examId,
        name:type.label,
        passFailOnly:type.passFailOnly,
        attempt:attempt.attemptNumber,
        result:attempt.result,
        score:attempt.score,
        examDate:attempt.examDate,
        studyStartDate:attempt.studyPeriodStart,
        studyEndDate:attempt.studyPeriodEnd,
        showScoreOnTimeline:attempt.showScoreOnTimeline,
        showScoreTouched:attempt.showScoreWasSet,
        showScoreLocked:attempt.showScoreLocked,
        automatic:attempt.automatic,
        linkedFailureAttemptId:attempt.linkedFailureAttemptId,
        sourceType:"guided-builder"
      });
    }
  }
  return records;
}

export function projectedExamEvents(state){
  return examTimelineEvents(state).map((event)=>({
    ...event,
    isStudyPeriod:event.eventType==="duration",
    fields:{
      ...(event.fields||{}),
      builderDomain:"exams",
      builderEntryId:event.attemptId||event.linkedFailureAttemptId||event.id,
      isStudyPeriod:event.eventType==="duration",
      studyPeriod:event.eventType==="duration"
    }
  }));
}

export function applyExamWorkflow(document,state){
  document.builder=document.builder&&typeof document.builder==="object"?document.builder:{};
  document.builder.examSystems=Object.entries(state.activeSystems||{})
    .filter(([,active])=>active)
    .map(([systemId])=>WORKFLOW_SYSTEM_TO_BUILDER[systemId])
    .filter(Boolean);
  const suppressed=suppressedRetakeIds(document);
  const priorRecords=document.exams||[];
  const importedWorkflowIds=new Set();
  document.exams=builderRecordsFromExamWorkflow(state)
    .filter((record)=>!suppressed.has(record.id))
    .map(record=>{
      const prior=priorRecords.find(item=>hasIntakeAuthority(item)&&builderRecordType(item)===builderRecordType(record)&&(Number(item.attempt)||1)===(Number(record.attempt)||1));
      if(!prior)return record;
      importedWorkflowIds.add(record.id);
      // Normalizing/editing an accepted source record must not erase its
      // privacy authority, or claim an inferred attempt number as source fact.
      const corrections=document.builder?.examReviewCorrections?.[prior.id];
      return corrections?{...clone(prior),...clone(corrections),sourceOriginal:clone(prior.sourceOriginal||prior)}:clone(prior);
    });
  for(const prior of priorRecords.filter(record=>record.attemptNumberUnconfirmed)){
    const corrections=document.builder?.examReviewCorrections?.[prior.id];
    document.exams.push(corrections?{...clone(prior),...clone(corrections),sourceOriginal:clone(prior.sourceOriginal||prior)}:clone(prior));
  }
  document.events=[
    ...(document.events||[]).filter((event)=>event?.sourceType!=="exam-workflow"&&event?.sourceType!=="local-test-study"),
    // The accepted source event already represents this fact. Creating another
    // workflow event would duplicate it with the workflow's default public scope.
    ...projectedExamEvents(state).flatMap(event=>{
      const attemptId=event.attemptId||event.fields?.attemptId||event.fields?.builderEntryId;
      const prior=priorRecords.find(record=>!record.attemptNumberUnconfirmed&&builderRecordType(record)&&examAttemptId(builderRecordType(record),Number(record.attempt)||1)===attemptId);
      if(importedWorkflowIds.has(attemptId)&&event.eventType!=="duration")return[];
      if(event.eventType!=="duration"||!prior)return[event];
      const override=document.builder?.examStudyReviewOverrides?.[prior.id]||{};
      if(override.localTestOnly&&!localTestStudyEnvironment(document))return[];
      const sourceEvent=(document.events||[]).find(item=>item.id===(prior.sourceEventId||prior.fieldProvenance?.examDate?.sourceEventId));
      return[{...event,sourceType:override.localTestOnly?"local-test-study":"exam-workflow",visibilityState:sourceEvent?.visibilityState||prior.visibilityState||event.visibilityState,
        endDate:override.studyEndDate||prior.studyEndDate||event.endDate,fields:{...event.fields,sourceExamRecordId:prior.id,sourceEventId:prior.sourceEventId||prior.fieldProvenance?.examDate?.sourceEventId||null,
          localTestOnly:override.localTestOnly===true,placeholder:override.fieldProvenance?.studyStartDate?.placeholder===true,reason:override.fieldProvenance?.studyStartDate?.reason,sourcePrecision:override.fieldProvenance?.studyStartDate?.sourcePrecision,originalKnownValue:override.fieldProvenance?.studyStartDate?.originalKnownValue,studyReviewProvenance:clone(override.fieldProvenance||{}),fieldProvenance:clone(prior.fieldProvenance||{})}}];
    }),
    ...document.exams.filter(record=>record.attemptNumberUnconfirmed).flatMap(record=>unconfirmedSourceStudy(document,record))
  ];
  return document;
}

export function normalizeExamDocument(document){
  return applyExamWorkflow(document,examWorkflowFromDocument(document));
}

export function setBuilderExamSystem(document,builderSystem,active){
  const workflowSystem=BUILDER_SYSTEM_TO_WORKFLOW[builderSystem];
  if(!workflowSystem)throw new TypeError(`Unsupported Builder exam system: ${String(builderSystem)}`);
  const state=setExamSystemActive(examWorkflowFromDocument(document),workflowSystem,active);
  document.builder={...(document.builder||{}),examSystemSelectionExplicit:true};
  return applyExamWorkflow(document,state);
}

export function addBuilderExam(document,builderSystem,builderExamId){
  const typeId=BUILDER_TO_WORKFLOW_TYPE[`${builderSystem}:${builderExamId}`];
  if(!typeId)throw new TypeError(`Unsupported Builder exam: ${String(builderSystem)} ${String(builderExamId)}`);
  const state=addExam(examWorkflowFromDocument(document),typeId);
  return applyExamWorkflow(document,state);
}

function locateDocumentAttempt(document,recordId){
  const record=(document.exams||[]).find((item)=>item.id===recordId);
  if(!record)throw new Error(`Exam attempt not found: ${String(recordId)}`);
  const typeId=builderRecordType(record);
  if(!typeId)throw new TypeError(`Unsupported Builder exam record: ${String(recordId)}`);
  return{record,typeId,targetId:examAttemptId(typeId,Number(record.attempt)||1)};
}

export function updateBuilderExamAttempt(document,recordId,changes){
  const {targetId,record}=locateDocumentAttempt(document,recordId);
  if(hasIntakeAuthority(record)){
    const corrections=Object.fromEntries(Object.entries(changes||{}).filter(([key])=>!["studyStartDate","studyEndDate"].includes(key)));
    if(Object.keys(corrections).length){document.builder||={};document.builder.examReviewCorrections||={};document.builder.examReviewCorrections[recordId]={...(document.builder.examReviewCorrections[recordId]||{}),...clone(corrections)};}
  }
  const studyChanges=Object.fromEntries(Object.entries(changes||{}).filter(([key])=>["studyStartDate","studyEndDate"].includes(key)));
  if(Object.keys(studyChanges).length){
    document.builder||={};document.builder.examStudyReviewOverrides||={};
    const prior=document.builder.examStudyReviewOverrides[recordId]||{},provenance={...(prior.fieldProvenance||{})};
    for(const [key,value] of Object.entries(studyChanges))provenance[key]={placeholder:false,reason:"STUDENT_ENTERED_ACTUAL_STUDY_DATE",sourcePrecision:parseMonth(value)?"MONTH":"UNKNOWN",originalKnownValue:value||null};
    const localTestOnly=Object.values(provenance).some(item=>item.placeholder);
    document.builder.examStudyReviewOverrides[recordId]={...prior,...studyChanges,localTestOnly,fieldProvenance:provenance};
  }
  const mapped={
    ...clone(changes),
    ...("studyStartDate" in (changes||{})?{studyPeriodStart:changes.studyStartDate}:null),
    ...("studyEndDate" in (changes||{})?{studyPeriodEnd:changes.studyEndDate}:null)
  };
  delete mapped.studyStartDate;
  delete mapped.studyEndDate;
  if(record.attemptNumberUnconfirmed)return applyExamWorkflow(document,examWorkflowFromDocument(document));
  const state=updateExamAttempt(examWorkflowFromDocument(document),targetId,mapped);
  return applyExamWorkflow(document,state);
}

export function deleteBuilderExamAttempt(document,recordId){
  const {targetId}=locateDocumentAttempt(document,recordId);
  const state=deleteExamAttempt(examWorkflowFromDocument(document),targetId);
  return applyExamWorkflow(document,state);
}

export function finalizeBuilderExams(document){
  const before=examWorkflowFromDocument(document);
  const suppressed=new Set(suppressedRetakeIds(document));
  for(const group of before.exams||[]){
    for(const attempt of group.attempts||[]){
      if(
        attempt.automatic&&
        !String(attempt.result||"").trim()&&
        !String(attempt.score||"").trim()&&
        !String(attempt.examDate||"").trim()&&
        !String(attempt.studyPeriodStart||"").trim()
      )suppressed.add(attempt.id);
    }
  }
  document.builder=document.builder&&typeof document.builder==="object"
    ?document.builder:{};
  document.builder.examSuppressedRetakes=[...suppressed];
  const state=finalizeExamWorkflow(before);
  return applyExamWorkflow(document,state);
}

export function restoreBuilderAutomaticRetake(document,targetAttemptId){
  const targetId=String(targetAttemptId||"");
  const suppressed=suppressedRetakeIds(document);
  if(!targetId||!suppressed.has(targetId))return null;
  const state=examWorkflowFromDocument(document);
  let failedAttempt=null;
  for(const group of state.exams||[]){
    failedAttempt=(group.attempts||[]).find((attempt)=>
      attempt.result==="Failed"&&
      examAttemptId(group.examTypeId,attempt.attemptNumber+1)===targetId
    );
    if(failedAttempt)break;
  }
  if(!failedAttempt)return null;
  const restored=updateExamAttempt(state,failedAttempt.id,{
    result:failedAttempt.result,
    score:failedAttempt.score,
    examDate:failedAttempt.examDate,
    studyPeriodStart:failedAttempt.studyPeriodStart
  });
  suppressed.delete(targetId);
  document.builder.examSuppressedRetakes=[...suppressed];
  applyExamWorkflow(document,restored);
  return(document.exams||[]).find((record)=>record.id===targetId)||null;
}

export function completedBuilderExamAttempts(document){
  const state=examWorkflowFromDocument(document);
  return(state.exams||[]).flatMap((group)=>group.attempts||[])
    .filter((attempt)=>validateExamAttempt(attempt).valid);
}

export function builderExamTypeId(builderSystem,builderExamId){
  return BUILDER_TO_WORKFLOW_TYPE[`${builderSystem}:${builderExamId}`]||null;
}
