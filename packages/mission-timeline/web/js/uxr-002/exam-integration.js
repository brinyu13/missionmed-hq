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
  const selected=new Set(document.builder?.examSystems||[]);
  for(const builderSystem of selected){
    const workflowSystem=BUILDER_SYSTEM_TO_WORKFLOW[builderSystem];
    if(workflowSystem)state=setExamSystemActive(state,workflowSystem,true);
  }
  const groups=new Map();
  for(const record of records){
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
      const changes={
        result:record.result||"",
        score:record.score||"",
        examDate:record.examDate||"",
        studyPeriodStart:record.studyStartDate||record.studyPeriodStart||""
      };
      if(record.showScoreTouched||record.showScoreWasSet){
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
  document.exams=builderRecordsFromExamWorkflow(state)
    .filter((record)=>!suppressed.has(record.id));
  document.events=[
    ...(document.events||[]).filter((event)=>event?.sourceType!=="exam-workflow"),
    ...projectedExamEvents(state)
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
  const {targetId}=locateDocumentAttempt(document,recordId);
  const mapped={
    ...clone(changes),
    ...("studyStartDate" in (changes||{})?{studyPeriodStart:changes.studyStartDate}:null)
  };
  delete mapped.studyStartDate;
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
