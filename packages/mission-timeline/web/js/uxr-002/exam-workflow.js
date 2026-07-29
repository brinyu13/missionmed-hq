import {addMonths,parseMonth} from "./utils.js";

export const EXAM_WORKFLOW_SCHEMA="d1-uxr-002.exams.1";

export const EXAM_SYSTEM_IDS=Object.freeze({
  USMLE:"usmle",
  COMLEX:"comlex"
});

export const EXAM_RESULTS=Object.freeze({
  PASSED:"Passed",
  FAILED:"Failed",
  AWAITING:"Awaiting result"
});

export const EXAM_WORKFLOW_COPY=Object.freeze({
  purpose:"Your exam story — scores and results first, dates second.",
  emptyHelper:"Choose USMLE, COMLEX, or both.",
  scoreOptional:"Score (optional)",
  examDate:"Exam date",
  awaitingExamDate:"Exam date (taken)",
  studyStart:"Started studying (optional)",
  retakeAction:"Set retake date"
});

export const EXAM_CARD_FIELD_ORDER=Object.freeze([
  Object.freeze({id:"result",row:1,order:1,priority:"primary",required:true}),
  Object.freeze({id:"score",row:1,order:2,priority:"primary",required:false,typography:"18px/650"}),
  Object.freeze({id:"examDate",row:2,order:3,priority:"secondary",required:true}),
  Object.freeze({id:"studyPeriodStart",row:2,order:4,priority:"secondary",required:false})
]);

export const EXAM_SYSTEMS=Object.freeze([
  Object.freeze({id:EXAM_SYSTEM_IDS.USMLE,label:"USMLE",order:1}),
  Object.freeze({id:EXAM_SYSTEM_IDS.COMLEX,label:"COMLEX-USA",order:2})
]);

export const EXAM_TYPES=Object.freeze([
  Object.freeze({
    id:"usmle-step-1",
    systemId:EXAM_SYSTEM_IDS.USMLE,
    label:"Step 1",
    order:1,
    passFailOnly:true,
    scoreRange:null
  }),
  Object.freeze({
    id:"usmle-step-2-ck",
    systemId:EXAM_SYSTEM_IDS.USMLE,
    label:"Step 2 CK",
    order:2,
    passFailOnly:false,
    scoreRange:Object.freeze({min:1,max:300,message:"USMLE scores run 1–300."})
  }),
  Object.freeze({
    id:"usmle-step-3",
    systemId:EXAM_SYSTEM_IDS.USMLE,
    label:"Step 3",
    order:3,
    passFailOnly:false,
    scoreRange:Object.freeze({min:1,max:300,message:"USMLE scores run 1–300."})
  }),
  Object.freeze({
    id:"comlex-level-1",
    systemId:EXAM_SYSTEM_IDS.COMLEX,
    label:"Level 1",
    order:4,
    passFailOnly:true,
    scoreRange:null
  }),
  Object.freeze({
    id:"comlex-level-2-ce",
    systemId:EXAM_SYSTEM_IDS.COMLEX,
    label:"Level 2-CE",
    order:5,
    passFailOnly:false,
    scoreRange:Object.freeze({min:9,max:999,message:"COMLEX scores run 9–999."})
  }),
  Object.freeze({
    id:"comlex-level-3",
    systemId:EXAM_SYSTEM_IDS.COMLEX,
    label:"Level 3",
    order:6,
    passFailOnly:false,
    scoreRange:Object.freeze({min:9,max:999,message:"COMLEX scores run 9–999."})
  })
]);

const SYSTEM_BY_ID=new Map(EXAM_SYSTEMS.map((system)=>[system.id,system]));
const TYPE_BY_ID=new Map(EXAM_TYPES.map((exam)=>[exam.id,exam]));
const VALID_RESULTS=new Set(Object.values(EXAM_RESULTS));
const EDITABLE_ATTEMPT_FIELDS=new Set([
  "result",
  "score",
  "examDate",
  "studyPeriodStart",
  "showScoreOnTimeline"
]);

function clone(value){
  return structuredClone(value);
}

function requireSystem(systemId){
  const system=SYSTEM_BY_ID.get(systemId);
  if(!system)throw new TypeError(`Unsupported exam system: ${String(systemId)}`);
  return system;
}

function requireExamType(examTypeId){
  const exam=TYPE_BY_ID.get(examTypeId);
  if(!exam)throw new TypeError(`Unsupported exam type: ${String(examTypeId)}`);
  return exam;
}

function canonicalMonthOrRaw(value){
  const raw=String(value??"").trim();
  return parseMonth(raw)||raw;
}

function scoreText(value){
  return value==null?"":String(value).trim();
}

function normalizeExamResult(value){
  const text=String(value??"").trim();
  if(!text)return"";
  if(text==="PASSED")return EXAM_RESULTS.PASSED;
  if(text==="FAILED")return EXAM_RESULTS.FAILED;
  if(text==="AWAITING"||text==="Awaiting")return EXAM_RESULTS.AWAITING;
  return text;
}

function attemptOrdinal(attemptNumber){
  const number=Number(attemptNumber);
  if(!Number.isInteger(number)||number<1){
    throw new TypeError("attemptNumber must be a positive integer.");
  }
  const lastTwo=number%100;
  const suffix=lastTwo>=11&&lastTwo<=13
    ?"th"
    :({1:"st",2:"nd",3:"rd"}[number%10]||"th");
  return`${number}${suffix}`;
}

export function examAttemptId(examTypeId,attemptNumber){
  requireExamType(examTypeId);
  attemptOrdinal(attemptNumber);
  return`exam-${examTypeId}-attempt-${attemptNumber}`;
}

export function examMilestoneEventId(examTypeId,attemptNumber){
  return`${examAttemptId(examTypeId,attemptNumber)}-milestone`;
}

export function examStudyWindowEventId(examTypeId,attemptNumber){
  return`${examAttemptId(examTypeId,attemptNumber)}-study-window`;
}

export function retakeStudyPeriodEventId(examTypeId,attemptNumber){
  return`${examAttemptId(examTypeId,attemptNumber)}-retake-study-period`;
}

function createAttempt(examType,attemptNumber,{automatic=false,linkedFailureAttemptId=null}={}){
  const ordinal=attemptOrdinal(attemptNumber);
  return{
    id:examAttemptId(examType.id,attemptNumber),
    examTypeId:examType.id,
    systemId:examType.systemId,
    attemptNumber,
    attemptLabel:attemptNumber===1?null:`${ordinal} attempt`,
    attemptNumberVisible:attemptNumber>=2,
    cardTitle:attemptNumber===1?examType.label:`${examType.label} — ${ordinal} attempt`,
    result:"",
    score:"",
    examDate:"",
    studyPeriodStart:"",
    showScoreOnTimeline:false,
    showScoreWasSet:false,
    showScoreLocked:examType.passFailOnly,
    automatic,
    linkedFailureAttemptId
  };
}

function createExamGroup(examType){
  return{
    id:examType.id,
    examTypeId:examType.id,
    systemId:examType.systemId,
    label:examType.label,
    order:examType.order,
    attempts:[createAttempt(examType,1)]
  };
}

export function createExamWorkflowState(){
  return{
    schemaVersion:EXAM_WORKFLOW_SCHEMA,
    activeSystems:{
      [EXAM_SYSTEM_IDS.USMLE]:false,
      [EXAM_SYSTEM_IDS.COMLEX]:false
    },
    exams:[],
    studyPeriods:[]
  };
}

function cloneWorkflow(state){
  if(!state||typeof state!=="object"||Array.isArray(state)){
    throw new TypeError("Exam workflow state must be an object.");
  }
  const next=clone(state);
  next.schemaVersion=EXAM_WORKFLOW_SCHEMA;
  next.activeSystems={
    [EXAM_SYSTEM_IDS.USMLE]:!!state.activeSystems?.[EXAM_SYSTEM_IDS.USMLE],
    [EXAM_SYSTEM_IDS.COMLEX]:!!state.activeSystems?.[EXAM_SYSTEM_IDS.COMLEX]
  };
  next.exams=Array.isArray(next.exams)?next.exams:[];
  next.studyPeriods=Array.isArray(next.studyPeriods)?next.studyPeriods:[];
  return next;
}

export function setExamSystemActive(state,systemId,active=true){
  requireSystem(systemId);
  const next=cloneWorkflow(state);
  next.activeSystems[systemId]=!!active;
  return next;
}

export function toggleExamSystem(state,systemId){
  requireSystem(systemId);
  return setExamSystemActive(state,systemId,!state.activeSystems?.[systemId]);
}

export function activeExamSystems(state){
  return EXAM_SYSTEMS
    .filter((system)=>!!state?.activeSystems?.[system.id])
    .map((system)=>clone(system));
}

export function availableExamChips(state){
  const added=new Set((state?.exams||[]).map((exam)=>exam.examTypeId));
  return EXAM_TYPES
    .filter((exam)=>!!state?.activeSystems?.[exam.systemId]&&!added.has(exam.id))
    .map((exam)=>({
      id:exam.id,
      examTypeId:exam.id,
      systemId:exam.systemId,
      examLabel:exam.label,
      label:`+ Add ${exam.label}`,
      order:exam.order
    }));
}

export function addedExamGroups(state,{visibleOnly=false}={}){
  return (state?.exams||[])
    .filter((group)=>!visibleOnly||!!state?.activeSystems?.[group.systemId])
    .slice()
    .sort((left,right)=>(left.order??99)-(right.order??99))
    .map((group)=>clone(group));
}

export function addExam(state,examTypeId){
  const examType=requireExamType(examTypeId);
  const next=cloneWorkflow(state);
  if(!next.activeSystems[examType.systemId]){
    throw new Error(`${SYSTEM_BY_ID.get(examType.systemId).label} must be active before adding ${examType.label}.`);
  }
  if(next.exams.some((exam)=>exam.examTypeId===examType.id))return next;
  next.exams.push(createExamGroup(examType));
  return next;
}

export function removeExam(state,examTypeId){
  requireExamType(examTypeId);
  const next=cloneWorkflow(state);
  next.exams=next.exams.filter((exam)=>exam.examTypeId!==examTypeId);
  next.studyPeriods=next.studyPeriods.filter((event)=>event.examTypeId!==examTypeId);
  return next;
}

function isAttemptEmpty(attempt){
  return !String(attempt.result||"").trim()
    &&!scoreText(attempt.score)
    &&!String(attempt.examDate||"").trim()
    &&!String(attempt.studyPeriodStart||"").trim();
}

function normalizeAttempt(attempt,examType,attemptNumber){
  const defaults=createAttempt(examType,attemptNumber);
  const normalized={...defaults,...attempt};
  normalized.examTypeId=examType.id;
  normalized.systemId=examType.systemId;
  normalized.attemptNumber=attemptNumber;
  normalized.id=examAttemptId(examType.id,attemptNumber);
  normalized.attemptLabel=attemptNumber===1?null:`${attemptOrdinal(attemptNumber)} attempt`;
  normalized.attemptNumberVisible=attemptNumber>=2;
  normalized.cardTitle=attemptNumber===1
    ?examType.label
    :`${examType.label} — ${attemptOrdinal(attemptNumber)} attempt`;
  normalized.result=normalizeExamResult(normalized.result);
  normalized.score=scoreText(normalized.score);
  normalized.examDate=canonicalMonthOrRaw(normalized.examDate);
  normalized.studyPeriodStart=canonicalMonthOrRaw(normalized.studyPeriodStart);
  normalized.showScoreOnTimeline=!!normalized.showScoreOnTimeline;
  normalized.showScoreWasSet=!!normalized.showScoreWasSet;
  normalized.automatic=!!normalized.automatic;
  normalized.linkedFailureAttemptId=normalized.linkedFailureAttemptId||null;
  if(examType.passFailOnly){
    normalized.score="";
    normalized.showScoreOnTimeline=false;
  }
  normalized.showScoreLocked=examType.passFailOnly||normalized.result===EXAM_RESULTS.FAILED;
  if(normalized.showScoreLocked)normalized.showScoreOnTimeline=false;
  if(!normalized.score)normalized.showScoreOnTimeline=false;
  return normalized;
}

function renumberExamGroup(group,examType){
  const priorIds=group.attempts.map((attempt)=>attempt.id);
  const idMap=new Map();
  group.attempts=group.attempts.map((attempt,index)=>{
    const normalized=normalizeAttempt(attempt,examType,index+1);
    if(priorIds[index])idMap.set(priorIds[index],normalized.id);
    return normalized;
  });
  for(const attempt of group.attempts){
    attempt.linkedFailureAttemptId=idMap.get(attempt.linkedFailureAttemptId)||attempt.linkedFailureAttemptId||null;
  }
}

function createRetakeStudyPeriod(examType,failedAttempt,retakeAttempt){
  const failedDate=parseMonth(failedAttempt.examDate);
  const retakeDate=parseMonth(retakeAttempt?.examDate);
  const startDate=failedDate?addMonths(failedDate,1):"";
  const provisional=!retakeDate;
  const endDate=retakeDate||(startDate?addMonths(startDate,3):"");
  const id=retakeStudyPeriodEventId(examType.id,failedAttempt.attemptNumber);
  return{
    id,
    examTypeId:examType.id,
    systemId:examType.systemId,
    categoryId:"exams",
    eventType:"duration",
    studyPeriodKind:"automatic-retake",
    title:`${examType.label} — preparing for retake`,
    startDate,
    endDate,
    openEnded:false,
    provisional,
    linkedFailureAttemptId:failedAttempt.id,
    linkedRetakeAttemptId:retakeAttempt?.id||null,
    automatic:true,
    sourceType:"exam-workflow",
    visibilityState:"INTERVIEWER_SAFE",
    fillStyle:"hatched",
    fillOpacity:0.6,
    outlineStyle:provisional?"dashed":"solid",
    actionChip:provisional
      ?{label:EXAM_WORKFLOW_COPY.retakeAction,targetAttemptId:retakeAttempt?.id||null}
      :null,
    fields:{
      automatic:true,
      provisional,
      linkedFailureAttemptId:failedAttempt.id,
      linkedRetakeAttemptId:retakeAttempt?.id||null
    }
  };
}

function rebuildStudyPeriodsForGroup(state,group,examType){
  state.studyPeriods=state.studyPeriods.filter((event)=>event.examTypeId!==examType.id);
  for(let index=0;index<group.attempts.length;index+=1){
    const attempt=group.attempts[index];
    if(attempt.result!==EXAM_RESULTS.FAILED)continue;
    state.studyPeriods.push(createRetakeStudyPeriod(examType,attempt,group.attempts[index+1]||null));
  }
}

function synchronizeExamGroup(state,group,{ensureRetakeCards=true}={}){
  const examType=requireExamType(group.examTypeId);
  renumberExamGroup(group,examType);

  const failedIds=new Set(
    group.attempts
      .filter((attempt)=>attempt.result===EXAM_RESULTS.FAILED)
      .map((attempt)=>attempt.id)
  );
  group.attempts=group.attempts.filter((attempt)=>{
    if(!attempt.automatic||!attempt.linkedFailureAttemptId||failedIds.has(attempt.linkedFailureAttemptId))return true;
    if(isAttemptEmpty(attempt))return false;
    attempt.automatic=false;
    attempt.linkedFailureAttemptId=null;
    return true;
  });
  renumberExamGroup(group,examType);

  if(ensureRetakeCards){
    for(let index=0;index<group.attempts.length;index+=1){
      const attempt=group.attempts[index];
      if(attempt.result!==EXAM_RESULTS.FAILED)continue;
      let retake=group.attempts[index+1];
      if(!retake){
        retake=createAttempt(examType,index+2,{
          automatic:true,
          linkedFailureAttemptId:attempt.id
        });
        group.attempts.push(retake);
      }else if(isAttemptEmpty(retake)){
        retake.automatic=true;
        retake.linkedFailureAttemptId=attempt.id;
      }
    }
    renumberExamGroup(group,examType);
  }

  rebuildStudyPeriodsForGroup(state,group,examType);
}

function locateAttempt(state,attemptId){
  for(const group of state.exams){
    const index=group.attempts.findIndex((attempt)=>attempt.id===attemptId);
    if(index>=0)return{group,index,attempt:group.attempts[index]};
  }
  return null;
}

export function updateExamAttempt(state,attemptId,changes){
  if(!changes||typeof changes!=="object"||Array.isArray(changes)){
    throw new TypeError("Attempt changes must be an object.");
  }
  const next=cloneWorkflow(state);
  const located=locateAttempt(next,attemptId);
  if(!located)throw new Error(`Exam attempt not found: ${String(attemptId)}`);
  const {group,attempt}=located;
  const examType=requireExamType(group.examTypeId);
  const previouslyDefaultable=attempt.result!==EXAM_RESULTS.PASSED||!scoreText(attempt.score);

  for(const [field,value] of Object.entries(changes)){
    if(!EDITABLE_ATTEMPT_FIELDS.has(field))continue;
    if(field==="result")attempt.result=normalizeExamResult(value);
    else if(field==="score")attempt.score=scoreText(value);
    else if(field==="examDate"||field==="studyPeriodStart")attempt[field]=canonicalMonthOrRaw(value);
    else if(field==="showScoreOnTimeline"){
      attempt.showScoreOnTimeline=!!value;
      attempt.showScoreWasSet=true;
    }
  }

  if(examType.passFailOnly){
    attempt.score="";
    attempt.showScoreOnTimeline=false;
    attempt.showScoreLocked=true;
  }else if(attempt.result===EXAM_RESULTS.FAILED){
    attempt.showScoreOnTimeline=false;
    attempt.showScoreLocked=true;
  }else{
    attempt.showScoreLocked=false;
    if(!attempt.score)attempt.showScoreOnTimeline=false;
    else if(
      attempt.result===EXAM_RESULTS.PASSED
      &&previouslyDefaultable
      &&!attempt.showScoreWasSet
      &&!("showScoreOnTimeline" in changes)
    ){
      attempt.showScoreOnTimeline=true;
    }
  }

  synchronizeExamGroup(next,group);
  return next;
}

export function deleteExamAttempt(state,attemptId){
  const next=cloneWorkflow(state);
  const located=locateAttempt(next,attemptId);
  if(!located)return next;
  const {group,index}=located;
  group.attempts.splice(index,1);
  if(!group.attempts.length){
    next.exams=next.exams.filter((exam)=>exam!==group);
    next.studyPeriods=next.studyPeriods.filter((event)=>event.examTypeId!==group.examTypeId);
    return next;
  }
  synchronizeExamGroup(next,group);
  return next;
}

export function finalizeExamWorkflow(state){
  const next=cloneWorkflow(state);
  for(const group of next.exams){
    const examType=requireExamType(group.examTypeId);
    renumberExamGroup(group,examType);
    while(group.attempts.length&&group.attempts.at(-1).automatic&&isAttemptEmpty(group.attempts.at(-1))){
      group.attempts.pop();
    }
    renumberExamGroup(group,examType);
    rebuildStudyPeriodsForGroup(next,group,examType);
  }
  return next;
}

export function validateExamResult(value){
  const normalized=normalizeExamResult(value);
  return{
    value:normalized,
    valid:VALID_RESULTS.has(normalized),
    error:VALID_RESULTS.has(normalized)?null:"Required."
  };
}

export function validateExamScore(examTypeId,value){
  const examType=requireExamType(examTypeId);
  const text=scoreText(value);
  if(examType.passFailOnly){
    return{value:"",visible:false,optional:true,valid:true,error:null,range:null};
  }
  if(!text){
    return{value:"",visible:true,optional:true,valid:true,error:null,range:clone(examType.scoreRange)};
  }
  const numeric=/^\d{1,3}$/.test(text)?Number(text):Number.NaN;
  const valid=Number.isInteger(numeric)
    &&numeric>=examType.scoreRange.min
    &&numeric<=examType.scoreRange.max;
  return{
    value:text,
    visible:true,
    optional:true,
    valid,
    error:valid?null:examType.scoreRange.message,
    range:clone(examType.scoreRange)
  };
}

function validateMonthField(value,{required=false}={}){
  const text=String(value??"").trim();
  if(!text)return{value:"",valid:!required,error:required?"Required.":null};
  const parsed=parseMonth(text);
  return{
    value:parsed||text,
    valid:!!parsed,
    error:parsed?null:"Enter a month and year, like 'Jun 2023'."
  };
}

export function examCardMetadata(examTypeId,result=""){
  const examType=requireExamType(examTypeId);
  const normalizedResult=normalizeExamResult(result);
  return{
    examTypeId:examType.id,
    systemId:examType.systemId,
    examLabel:examType.label,
    fieldOrder:EXAM_CARD_FIELD_ORDER.map((field)=>({
      ...field,
      hidden:field.id==="score"&&examType.passFailOnly,
      label:field.id==="score"
        ?EXAM_WORKFLOW_COPY.scoreOptional
        :field.id==="examDate"
          ?(normalizedResult===EXAM_RESULTS.AWAITING
            ?EXAM_WORKFLOW_COPY.awaitingExamDate
            :EXAM_WORKFLOW_COPY.examDate)
          :field.id==="studyPeriodStart"
            ?EXAM_WORKFLOW_COPY.studyStart
            :field.id
    })),
    score:{
      visible:!examType.passFailOnly,
      optional:true,
      inputMode:"numeric",
      maxLength:3,
      range:examType.scoreRange?clone(examType.scoreRange):null,
      lockedOff:examType.passFailOnly||normalizedResult===EXAM_RESULTS.FAILED
    },
    awaitingResult:normalizedResult===EXAM_RESULTS.AWAITING
  };
}

export function validateExamAttempt(attempt){
  if(!attempt||typeof attempt!=="object")throw new TypeError("Exam attempt must be an object.");
  const examType=requireExamType(attempt.examTypeId);
  const result=validateExamResult(attempt.result);
  const score=validateExamScore(examType.id,attempt.score);
  const examDate=validateMonthField(attempt.examDate,{required:true});
  const studyPeriodStart=validateMonthField(attempt.studyPeriodStart);
  return{
    valid:result.valid&&score.valid&&examDate.valid&&studyPeriodStart.valid,
    result,
    score,
    examDate:{
      ...examDate,
      label:result.value===EXAM_RESULTS.AWAITING
        ?EXAM_WORKFLOW_COPY.awaitingExamDate
        :EXAM_WORKFLOW_COPY.examDate
    },
    studyPeriodStart:{...studyPeriodStart,label:EXAM_WORKFLOW_COPY.studyStart},
    awaitingResult:result.value===EXAM_RESULTS.AWAITING
  };
}

function validScoreForBoard(attempt){
  const validation=validateExamScore(attempt.examTypeId,attempt.score);
  return validation.valid&&validation.value?validation.value:"";
}

function milestoneEvent(examType,attempt){
  const score=validScoreForBoard(attempt);
  const showScore=attempt.result!==EXAM_RESULTS.FAILED
    &&!!attempt.showScoreOnTimeline
    &&!!score;
  const labelParts=[
    examType.label,
    ...(attempt.attemptLabel?[attempt.attemptLabel]:[]),
    ...(showScore?[score]:[])
  ];
  return{
    id:examMilestoneEventId(examType.id,attempt.attemptNumber),
    examTypeId:examType.id,
    systemId:examType.systemId,
    attemptId:attempt.id,
    attemptNumber:attempt.attemptNumber,
    attemptLabel:attempt.attemptLabel,
    categoryId:"exams",
    eventType:"milestone",
    title:labelParts.join(" · "),
    startDate:parseMonth(attempt.examDate),
    endDate:null,
    openEnded:false,
    result:attempt.result,
    score,
    showScoreOnTimeline:showScore,
    dangerDot:attempt.result===EXAM_RESULTS.FAILED,
    awaitingResult:attempt.result===EXAM_RESULTS.AWAITING,
    tone:"neutral",
    sourceType:"exam-workflow",
    visibilityState:"INTERVIEWER_SAFE",
    fields:{
      attemptId:attempt.id,
      attemptNumber:attempt.attemptNumber,
      result:attempt.result,
      score,
      showScoreOnTimeline:showScore
    }
  };
}

function studyWindowEvent(examType,attempt){
  return{
    id:examStudyWindowEventId(examType.id,attempt.attemptNumber),
    examTypeId:examType.id,
    systemId:examType.systemId,
    attemptId:attempt.id,
    categoryId:"exams",
    eventType:"duration",
    studyPeriodKind:"entered",
    title:`${examType.label} — study period`,
    startDate:parseMonth(attempt.studyPeriodStart),
    endDate:parseMonth(attempt.examDate),
    openEnded:false,
    automatic:false,
    sourceType:"exam-workflow",
    visibilityState:"INTERVIEWER_SAFE",
    fields:{attemptId:attempt.id,automatic:false}
  };
}

export function examTimelineEvents(state){
  const events=[];
  for(const group of addedExamGroups(state)){
    const examType=requireExamType(group.examTypeId);
    for(const attempt of group.attempts){
      const result=validateExamResult(attempt.result);
      const examDate=parseMonth(attempt.examDate);
      const studyStart=parseMonth(attempt.studyPeriodStart);
      if(studyStart&&examDate)events.push(studyWindowEvent(examType,attempt));
      if(result.valid&&examDate)events.push(milestoneEvent(examType,attempt));
    }
  }
  events.push(...(state?.studyPeriods||[]).map((event)=>clone(event)));
  return events;
}

export function awaitingExamChecks(state){
  const checks=[];
  for(const group of addedExamGroups(state)){
    const examType=requireExamType(group.examTypeId);
    for(const attempt of group.attempts){
      if(normalizeExamResult(attempt.result)!==EXAM_RESULTS.AWAITING)continue;
      checks.push({
        id:`awaiting-${attempt.id}`,
        attemptId:attempt.id,
        examTypeId:examType.id,
        text:`${attempt.cardTitle||examType.label} result pending — update it when it arrives.`
      });
    }
  }
  return checks;
}

export {attemptOrdinal,normalizeExamResult};
