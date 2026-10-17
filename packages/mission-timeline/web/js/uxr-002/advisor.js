import {
  ADVISOR_PAPER_THEME_ID,
  DEFAULT_THEME_ID,
  THEMES_BY_ID
} from "./themes.js";
import {
  dateLabel,
  escapeHtml,
  formatMonth,
  monthIndex,
  monthString
} from "./utils.js";

const freezeDeep=(value)=>{
  if(!value||typeof value!=="object"||Object.isFrozen(value))return value;
  for(const child of Object.values(value))freezeDeep(child);
  return Object.freeze(value);
};

const clone=(value)=>structuredClone(value);
const safeArray=(value)=>Array.isArray(value)?value:[];
const normalizedText=(value)=>String(value??"").trim();

export const ADVISOR_SESSION_THEME_ID=ADVISOR_PAPER_THEME_ID;
export const ADVISOR_PIN_NOTE_MAX=280;
export const ADVISOR_QUESTION_HIGHLIGHT_MS=2000;
export const ADVISOR_HIGHLIGHT_COLOR="#B98A2E";

export const ADVISOR_STATUSES=freezeDeep({
  NOT_REQUESTED:"not-requested",
  PENDING:"pending",
  CHANGES_REQUESTED:"changes-requested",
  APPROVED:"approved",
  CANCELLED:"cancelled"
});

export const CHECKLIST_STATES=freezeDeep({
  UNTOUCHED:"untouched",
  PASS:"pass",
  FLAG:"flag"
});

export const ADVISOR_CHECKLIST_ITEMS=freezeDeep([
  {
    id:"chronology",
    label:"Chronology is complete — no unexplained gaps"
  },
  {
    id:"overlaps",
    label:"Overlaps look intentional and readable"
  },
  {
    id:"interview-comfort",
    label:"Nothing here the student wouldn't want asked about"
  },
  {
    id:"advisor-only",
    label:"Advisor-only items are correctly marked"
  },
  {
    id:"thirty-seconds",
    label:"The story reads in under 30 seconds"
  }
]);

export const ADVISOR_COPY=freezeDeep({
  inactive:"This review link isn't active.",
  requestCard:"Get a second pair of eyes before you export.",
  requestAction:"Request advisor review",
  requestMessage:"Anything you want your advisor to focus on?",
  send:"Send for review",
  checklist:"Checklist",
  questions:"Likely interview questions",
  comments:"Comments",
  pinInstruction:"Click anywhere on the board to pin a comment.",
  approve:"Approve for export",
  requestChanges:"Request changes",
  resolve:"Resolve"
});

export const ADVISOR_LOCAL_ADAPTER_CONTRACT=freezeDeep({
  route:"advisor-session:{timelineId}",
  invitation:"local handoff stub",
  audience:"everything",
  includesAdvisorOnlyItems:true,
  sessionTheme:ADVISOR_PAPER_THEME_ID,
  networkCalls:false,
  protectedRuntimeCalls:false,
  matrixIntegration:false,
  persistence:"consumer-supplied local store adapter"
});

const DEFAULT_ADVISOR=freezeDeep({
  status:ADVISOR_STATUSES.NOT_REQUESTED,
  requestedAt:null,
  message:"",
  advisorName:"Advisor",
  approvedAt:null,
  editedSince:false,
  approvalEventFingerprint:null,
  checklist:ADVISOR_CHECKLIST_ITEMS.map(({id,label})=>({
    id,
    label,
    state:CHECKLIST_STATES.UNTOUCHED
  })),
  questions:[],
  hiddenQuestionIds:[],
  comments:[],
  route:null,
  session:null,
  verdictAt:null
});

function validChecklistState(value){
  return Object.values(CHECKLIST_STATES).includes(value)?
    value:CHECKLIST_STATES.UNTOUCHED;
}

function normalizeChecklist(items){
  const byId=new Map(safeArray(items).map((item)=>[item?.id,item]));
  return ADVISOR_CHECKLIST_ITEMS.map((definition)=>{
    const source=byId.get(definition.id)||{};
    return{
      id:definition.id,
      label:definition.label,
      state:validChecklistState(source.state)
    };
  });
}

function clampCoordinate(value){
  const numeric=Number(value);
  if(!Number.isFinite(numeric))return .5;
  return Math.min(1,Math.max(0,numeric));
}

function normalizeComment(comment,index){
  return{
    id:String(comment?.id||`advisor-comment-${index+1}`),
    number:Number.isInteger(comment?.number)&&comment.number>0?
      comment.number:index+1,
    x:clampCoordinate(comment?.x),
    y:clampCoordinate(comment?.y),
    note:String(comment?.note||"").slice(0,ADVISOR_PIN_NOTE_MAX),
    resolved:!!comment?.resolved,
    createdAt:comment?.createdAt||null,
    updatedAt:comment?.updatedAt||comment?.createdAt||null,
    resolvedAt:comment?.resolvedAt||null
  };
}

function normalizeAdvisor(value={}){
  const source=value&&typeof value==="object"?value:{};
  const statuses=Object.values(ADVISOR_STATUSES);
  return{
    ...clone(DEFAULT_ADVISOR),
    ...clone(source),
    status:statuses.includes(source.status)?
      source.status:ADVISOR_STATUSES.NOT_REQUESTED,
    message:String(source.message||""),
    advisorName:normalizedText(source.advisorName)||"Advisor",
    editedSince:!!source.editedSince,
    checklist:normalizeChecklist(source.checklist),
    questions:clone(safeArray(source.questions)),
    hiddenQuestionIds:[...new Set(safeArray(source.hiddenQuestionIds).map(String))],
    comments:safeArray(source.comments).map(normalizeComment)
  };
}

export function normalizeAdvisorDocument(document={}){
  const next=clone(document&&typeof document==="object"?document:{});
  next.id=String(next.id||"");
  next.events=clone(safeArray(next.events));
  next.exams=clone(safeArray(next.exams));
  next.studentProfile={
    ...(next.studentProfile&&typeof next.studentProfile==="object"?
      clone(next.studentProfile):{})
  };
  next.theme=String(next.theme||DEFAULT_THEME_ID);
  next.advisor=normalizeAdvisor(next.advisor);
  return next;
}

export function advisorSessionRoute(timelineId){
  const id=normalizedText(timelineId);
  if(!id)throw new TypeError("A timeline id is required.");
  return`advisor-session:${id}`;
}

export function isActiveAdvisorSession(document,route){
  const state=normalizeAdvisorDocument(document);
  if(!state.id||String(route)!==advisorSessionRoute(state.id))return false;
  return[
    ADVISOR_STATUSES.PENDING,
    ADVISOR_STATUSES.CHANGES_REQUESTED,
    ADVISOR_STATUSES.APPROVED
  ].includes(state.advisor.status)&&state.advisor.status!==ADVISOR_STATUSES.CANCELLED;
}

function stableValue(value){
  if(Array.isArray(value))return value.map(stableValue);
  if(value&&typeof value==="object"){
    return Object.fromEntries(
      Object.keys(value).sort().map((key)=>[key,stableValue(value[key])])
    );
  }
  return value;
}

export function advisorEventDataFingerprint(document={}){
  const events=safeArray(document.events).map((event)=>stableValue(event));
  const exams=safeArray(document.exams).map((exam)=>stableValue(exam));
  return JSON.stringify({events,exams});
}

function reviewDataset(document){
  const state=normalizeAdvisorDocument(document);
  return{
    schemaVersion:"d1-uxr-002-advisor-dataset.1",
    audience:"everything",
    includesAdvisorOnlyItems:true,
    timelineId:state.id,
    studentThemeId:state.theme,
    renderThemeId:ADVISOR_SESSION_THEME_ID,
    studentProfile:clone(state.studentProfile),
    events:clone(state.events),
    exams:clone(state.exams),
    advanced:clone(state.advanced||null)
  };
}

export function buildAdvisorRequestPlan(document,{
  message="",
  clock=()=>new Date()
}={}){
  const state=normalizeAdvisorDocument(document);
  if(!state.id)throw new TypeError("A timeline id is required.");
  const now=clock();
  const route=advisorSessionRoute(state.id);
  return{
    type:"advisor-request",
    route,
    message:String(message),
    handoff:{
      kind:"local-advisor-session",
      route,
      createdAt:now.toISOString(),
      dataset:reviewDataset(state)
    },
    versionRequest:{
      name:`Sent for review · ${dateLabel(now)}`,
      kind:"automatic",
      requiredBeforeMutation:true
    },
    mutation:{
      label:"Request advisor review",
      history:true,
      undoSteps:1
    },
    nextStatus:ADVISOR_STATUSES.PENDING,
    requestedAt:now.toISOString()
  };
}

/*
 * Applies the document side only. Consumers must honor versionRequest before
 * committing this result, then persist the local handoff through their adapter.
 */
export function applyAdvisorRequest(document,plan){
  if(plan?.type!=="advisor-request"||
    plan.versionRequest?.requiredBeforeMutation!==true){
    throw new TypeError("A valid advisor request plan is required.");
  }
  const next=normalizeAdvisorDocument(document);
  if(plan.handoff?.dataset?.timelineId!==next.id){
    throw new Error("Advisor request timeline does not match the document.");
  }
  next.advisor={
    ...next.advisor,
    status:ADVISOR_STATUSES.PENDING,
    requestedAt:plan.requestedAt,
    message:plan.message,
    approvedAt:null,
    editedSince:false,
    approvalEventFingerprint:null,
    checklist:normalizeChecklist([]),
    questions:computeAdvisorQuestions(next),
    hiddenQuestionIds:[],
    comments:[],
    route:plan.route,
    session:clone(plan.handoff),
    verdictAt:null
  };
  return{
    document:next,
    handoff:clone(plan.handoff),
    versionRequest:clone(plan.versionRequest),
    mutation:clone(plan.mutation)
  };
}

export function cancelAdvisorRequest(document){
  const next=normalizeAdvisorDocument(document);
  if(next.advisor.status!==ADVISOR_STATUSES.PENDING){
    return{document:next,changed:false};
  }
  next.advisor.status=ADVISOR_STATUSES.CANCELLED;
  next.advisor.route=null;
  next.advisor.session=null;
  return{
    document:next,
    changed:true,
    mutation:{label:"Cancel advisor review",history:true,undoSteps:1}
  };
}

function validMonth(value){
  const index=monthIndex(value);
  return Number.isInteger(index)?index:null;
}

function currentMonthIndex(now){
  return now.getUTCFullYear()*12+now.getUTCMonth();
}

function eventIntervals(events,{now=new Date(),durationsOnly=false}={}){
  const present=currentMonthIndex(now);
  return safeArray(events).flatMap((event)=>{
    const start=validMonth(event?.startDate);
    if(start==null)return[];
    const milestone=event?.eventType==="milestone";
    if(durationsOnly&&milestone)return[];
    const parsedEnd=validMonth(event?.endDate);
    const end=milestone?start:event?.openEnded?
      Math.max(start,present):Math.max(start,parsedEnd??start);
    return[{
      id:String(event.id||""),
      title:normalizedText(event.title)||"event",
      start,
      end,
      event
    }];
  }).sort((first,second)=>
    first.start-second.start||
    second.end-first.end||
    first.id.localeCompare(second.id));
}

function gapQuestions(document,{now=new Date()}={}){
  const intervals=eventIntervals(document.events,{now});
  if(intervals.length<2)return[];
  const questions=[];
  let coveredThrough=intervals[0].end;
  let covering=intervals[0];
  for(const interval of intervals.slice(1)){
    const gap=interval.start-coveredThrough-1;
    if(gap>=6){
      const gapStart=coveredThrough+1;
      const gapEnd=interval.start-1;
      questions.push({
        id:`advisor-gap-${gapStart}-${gapEnd}`,
        type:"gap",
        text:`There is a ${gap}-month gap from ${formatMonth(monthString(gapStart))} to ${formatMonth(monthString(gapEnd))}. What was happening then?`,
        sourceEventIds:[covering.id,interval.id].filter(Boolean),
        sourceMonth:monthString(gapStart),
        count:gap
      });
    }
    if(interval.end>coveredThrough){
      coveredThrough=interval.end;
      covering=interval;
    }
  }
  return questions;
}

function examEventIds(document,exam){
  return safeArray(document.events).filter((event)=>
    event?.attemptId===exam.id||
    event?.fields?.builderEntryId===exam.id||
    event?.fields?.examId===exam.id
  ).map((event)=>String(event.id||"")).filter(Boolean);
}

function failedAttemptQuestions(document){
  return safeArray(document.exams).filter((exam)=>
    String(exam?.result||"").toLowerCase()==="failed"
  ).map((exam,index)=>{
    const name=normalizedText(exam.name||exam.examName||exam.examId)||"exam";
    const when=formatMonth(exam.examDate);
    return{
      id:`advisor-failed-${String(exam.id||index)}`,
      type:"failed-attempt",
      text:`How would you discuss the ${name} attempt${when?` from ${when}`:""}?`,
      sourceEventIds:examEventIds(document,exam),
      sourceMonth:validMonth(exam.examDate)==null?null:exam.examDate,
      examId:exam.id||null
    };
  });
}

function overlapQuestions(document,{now=new Date()}={}){
  const intervals=eventIntervals(document.events,{now,durationsOnly:true});
  if(intervals.length<3)return[];
  const first=Math.min(...intervals.map(({start})=>start));
  const last=Math.max(...intervals.map(({end})=>end));
  const activeAt=(month)=>intervals.filter(({start,end})=>start<=month&&end>=month);
  const questions=[];
  let month=first;
  while(month<=last){
    let active=activeAt(month);
    if(active.length<3){month+=1;continue;}
    const runStart=month;
    let peak=active;
    let peakMonth=month;
    while(month<=last){
      active=activeAt(month);
      if(active.length<3)break;
      if(active.length>peak.length){
        peak=active;
        peakMonth=month;
      }
      month+=1;
    }
    questions.push({
      id:`advisor-overlap-${runStart}-${peakMonth}`,
      type:"overlap",
      text:`How did you balance ${peak.length} overlapping commitments in ${formatMonth(monthString(peakMonth))}?`,
      sourceEventIds:peak.map(({id})=>id).filter(Boolean),
      sourceMonth:monthString(peakMonth),
      count:peak.length
    });
  }
  return questions;
}

function visaQuestions(document){
  const visa=normalizedText(document.studentProfile?.visaStatus);
  const nonQuestionStatuses=new Set([
    "",
    "US citizen / permanent resident",
    "Prefer not to say"
  ]);
  if(nonQuestionStatuses.has(visa))return[];
  return[{
    id:"advisor-visa-status",
    type:"visa-status",
    text:"How would your visa / work status affect residency training?",
    sourceEventIds:[],
    sourceMonth:null,
    visaStatus:visa
  }];
}

function graduationQuestions(document,{now=new Date()}={}){
  if(document.studentProfile?.expectedGraduation)return[];
  const graduation=validMonth(document.studentProfile?.graduationDate);
  if(graduation==null||currentMonthIndex(now)-graduation<=24)return[];
  const year=Math.floor(graduation/12);
  return[{
    id:"advisor-graduation-age",
    type:"graduation-age",
    text:`How have you stayed current since graduating in ${year}?`,
    sourceEventIds:[],
    sourceMonth:monthString(graduation),
    monthsSinceGraduation:currentMonthIndex(now)-graduation
  }];
}

export function computeAdvisorQuestions(document={},options={}){
  const state=normalizeAdvisorDocument(document);
  return[
    ...gapQuestions(state,options),
    ...failedAttemptQuestions(state),
    ...overlapQuestions(state,options),
    ...visaQuestions(state),
    ...graduationQuestions(state,options)
  ];
}

export function advisorQuestionModel(document={},options={}){
  const state=normalizeAdvisorDocument(document);
  const questions=computeAdvisorQuestions(state,options);
  const hiddenIds=new Set(state.advisor.hiddenQuestionIds);
  return{
    visible:questions.filter(({id})=>!hiddenIds.has(id)),
    hidden:questions.filter(({id})=>hiddenIds.has(id)),
    hiddenCount:questions.filter(({id})=>hiddenIds.has(id)).length
  };
}

export function hideAdvisorQuestion(document,questionId){
  const next=normalizeAdvisorDocument(document);
  const id=String(questionId||"");
  if(!computeAdvisorQuestions(next).some((question)=>question.id===id)){
    return{document:next,changed:false};
  }
  if(!next.advisor.hiddenQuestionIds.includes(id)){
    next.advisor.hiddenQuestionIds.push(id);
  }
  return{
    document:next,
    changed:true,
    mutation:{label:"Hide advisor question",history:false,material:false}
  };
}

export function questionHighlightEffect(question,{reducedMotion=false}={}){
  return{
    questionId:question?.id||null,
    eventIds:clone(safeArray(question?.sourceEventIds)),
    color:ADVISOR_HIGHLIGHT_COLOR,
    durationMs:ADVISOR_QUESTION_HIGHLIGHT_MS,
    animation:reducedMotion?"none":"gold-halo"
  };
}

export function setChecklistState(document,itemId,state){
  const next=normalizeAdvisorDocument(document);
  const item=next.advisor.checklist.find(({id})=>id===itemId);
  if(!item)throw new RangeError("Advisor checklist item not found.");
  const normalized=validChecklistState(state);
  if(item.state===normalized)return{document:next,changed:false};
  item.state=normalized;
  return{
    document:next,
    changed:true,
    mutation:{label:"Update advisor checklist",history:false,material:false}
  };
}

export function checklistGate(advisorOrDocument={}){
  const advisor="advisor" in advisorOrDocument?
    normalizeAdvisor(advisorOrDocument.advisor):normalizeAdvisor(advisorOrDocument);
  const untouched=advisor.checklist.filter(({state})=>
    state===CHECKLIST_STATES.UNTOUCHED);
  const flagged=advisor.checklist.filter(({state})=>
    state===CHECKLIST_STATES.FLAG);
  return{
    complete:untouched.length===0,
    touched:advisor.checklist.length-untouched.length,
    total:ADVISOR_CHECKLIST_ITEMS.length,
    untouchedIds:untouched.map(({id})=>id),
    flaggedIds:flagged.map(({id})=>id)
  };
}

export function validateAdvisorNote(note){
  const value=String(note||"");
  if(value.length>ADVISOR_PIN_NOTE_MAX){
    return{
      valid:false,
      error:`Comments are limited to ${ADVISOR_PIN_NOTE_MAX} characters.`
    };
  }
  return{valid:true,value};
}

export function addAdvisorComment(document,{
  x=.5,
  y=.5,
  note="",
  clock=()=>new Date(),
  idFactory=null
}={}){
  const validation=validateAdvisorNote(note);
  if(!validation.valid)throw new RangeError(validation.error);
  const next=normalizeAdvisorDocument(document);
  const number=Math.max(0,...next.advisor.comments.map((comment)=>comment.number))+1;
  const at=clock().toISOString();
  const id=idFactory?String(idFactory("advisor-comment")):
    `advisor-comment-${number}-${at.replace(/[^0-9]/g,"")}`;
  const comment=normalizeComment({
    id,
    number,
    x,
    y,
    note:validation.value,
    createdAt:at,
    updatedAt:at
  },next.advisor.comments.length);
  next.advisor.comments.push(comment);
  return{
    document:next,
    comment:clone(comment),
    openNoteField:true,
    mutation:{label:"Add advisor comment",history:false,material:false}
  };
}

export function updateAdvisorComment(document,commentId,note,{
  clock=()=>new Date()
}={}){
  const validation=validateAdvisorNote(note);
  if(!validation.valid)throw new RangeError(validation.error);
  const next=normalizeAdvisorDocument(document);
  const comment=next.advisor.comments.find(({id})=>id===commentId);
  if(!comment)throw new RangeError("Advisor comment not found.");
  comment.note=validation.value;
  comment.updatedAt=clock().toISOString();
  return{
    document:next,
    comment:clone(comment),
    mutation:{label:"Edit advisor comment",history:false,material:false}
  };
}

export function deleteAdvisorComment(document,commentId){
  const next=normalizeAdvisorDocument(document);
  const length=next.advisor.comments.length;
  next.advisor.comments=next.advisor.comments.filter(({id})=>id!==commentId);
  return{
    document:next,
    changed:next.advisor.comments.length!==length,
    mutation:{label:"Delete advisor comment",history:false,material:false}
  };
}

export function resolveAdvisorComment(document,commentId,{
  clock=()=>new Date()
}={}){
  const next=normalizeAdvisorDocument(document);
  const comment=next.advisor.comments.find(({id})=>id===commentId);
  if(!comment)throw new RangeError("Advisor comment not found.");
  comment.resolved=true;
  comment.resolvedAt=clock().toISOString();
  comment.updatedAt=comment.resolvedAt;
  return{
    document:next,
    comment:clone(comment),
    mutation:{label:"Resolve advisor comment",history:true,undoSteps:1}
  };
}

export function advisorCommentModel(document={}){
  const state=normalizeAdvisorDocument(document);
  const active=state.advisor.comments.filter(({resolved})=>!resolved);
  const resolved=state.advisor.comments.filter(({resolved})=>resolved);
  return{
    all:clone(state.advisor.comments),
    active,
    resolved,
    activeCount:active.length,
    toolbarLabel:`Comments · ${active.length}`
  };
}

export function advisorPinsForContext(document,{context="advisor"}={}){
  if(context==="export")return[];
  return advisorCommentModel(document).all;
}

export function canRequestAdvisorChanges(document={}){
  const state=normalizeAdvisorDocument(document);
  const hasComment=state.advisor.comments.some(({note,resolved})=>
    !resolved&&normalizedText(note));
  const hasFlag=state.advisor.checklist.some(({state:checkState})=>
    checkState===CHECKLIST_STATES.FLAG);
  return{
    allowed:hasComment||hasFlag,
    hasComment,
    hasFlag
  };
}

export function approveAdvisorReview(document,{
  advisorName=null,
  clock=()=>new Date()
}={}){
  const next=normalizeAdvisorDocument(document);
  const gate=checklistGate(next);
  if(!gate.complete){
    throw new Error("All five checklist items must be touched before approval.");
  }
  const at=clock().toISOString();
  next.advisor.status=ADVISOR_STATUSES.APPROVED;
  next.advisor.advisorName=normalizedText(advisorName)||next.advisor.advisorName||"Advisor";
  next.advisor.approvedAt=at;
  next.advisor.verdictAt=at;
  next.advisor.editedSince=false;
  next.advisor.approvalEventFingerprint=advisorEventDataFingerprint(next);
  return{
    document:next,
    badge:advisorApprovalBadge(next),
    mutation:{label:"Approve advisor review",history:true,undoSteps:1}
  };
}

export function requestAdvisorChanges(document,{clock=()=>new Date()}={}){
  const next=normalizeAdvisorDocument(document);
  const gate=canRequestAdvisorChanges(next);
  if(!gate.allowed){
    throw new Error("Request changes requires a comment or flagged checklist item.");
  }
  next.advisor.status=ADVISOR_STATUSES.CHANGES_REQUESTED;
  next.advisor.verdictAt=clock().toISOString();
  return{
    document:next,
    activePins:advisorCommentModel(next).active,
    mutation:{label:"Request advisor changes",history:true,undoSteps:1}
  };
}

export function markApprovalEditedSince(document,changeKind){
  const next=normalizeAdvisorDocument(document);
  if(next.advisor.status!==ADVISOR_STATUSES.APPROVED||
    changeKind!=="event-data"){
    return{document:next,changed:false,badge:advisorApprovalBadge(next)};
  }
  if(next.advisor.editedSince){
    return{document:next,changed:false,badge:advisorApprovalBadge(next)};
  }
  next.advisor.editedSince=true;
  return{
    document:next,
    changed:true,
    badge:advisorApprovalBadge(next),
    mutation:{label:"Mark advisor approval edited",history:false,material:false}
  };
}

export function reconcileApprovalFingerprint(document){
  const next=normalizeAdvisorDocument(document);
  if(next.advisor.status!==ADVISOR_STATUSES.APPROVED||
    !next.advisor.approvalEventFingerprint){
    return{document:next,changed:false,badge:advisorApprovalBadge(next)};
  }
  const changed=advisorEventDataFingerprint(next)!==
    next.advisor.approvalEventFingerprint;
  if(changed)next.advisor.editedSince=true;
  return{
    document:next,
    changed:changed&&!document?.advisor?.editedSince,
    badge:advisorApprovalBadge(next)
  };
}

export function advisorApprovalBadge(document={}){
  const state=normalizeAdvisorDocument(document);
  if(!state.advisor.approvedAt)return null;
  const approvedDate=dateLabel(state.advisor.approvedAt);
  if(state.advisor.editedSince){
    return{
      status:"approved-edited",
      tone:"success",
      text:`Approved ${approvedDate} · edited since`,
      silentlyRevoked:false
    };
  }
  return{
    status:"approved",
    tone:"success",
    text:`${state.advisor.advisorName||"Advisor"} approved · ${approvedDate}`,
    silentlyRevoked:false
  };
}

export function advisorReviewCardModel(document={}){
  const state=normalizeAdvisorDocument(document);
  const advisor=state.advisor;
  if(advisor.status===ADVISOR_STATUSES.APPROVED){
    return{state:"approved",badge:advisorApprovalBadge(state)};
  }
  if(advisor.status===ADVISOR_STATUSES.CHANGES_REQUESTED){
    const count=advisorCommentModel(state).activeCount;
    return{
      state:"changes-requested",
      chip:`${count} advisor comments`,
      action:"open-comments"
    };
  }
  if(advisor.status===ADVISOR_STATUSES.PENDING){
    return{
      state:"pending",
      body:`Awaiting advisor review · requested ${dateLabel(advisor.requestedAt)}`,
      action:"Cancel request"
    };
  }
  return{
    state:"not-requested",
    body:ADVISOR_COPY.requestCard,
    action:ADVISOR_COPY.requestAction
  };
}

function studentThemeName(themeId){
  return THEMES_BY_ID[themeId]?.name||
    THEMES_BY_ID[DEFAULT_THEME_ID]?.name||
    "Keynote Classic";
}

export function advisorSessionModel(document,{
  route,
  loading=false,
  now=new Date()
}={}){
  const state=normalizeAdvisorDocument(document);
  if(loading)return{
    state:"loading",
    themeId:ADVISOR_SESSION_THEME_ID,
    skeleton:true
  };
  if(!isActiveAdvisorSession(state,route))return{
    state:"invalid",
    message:ADVISOR_COPY.inactive
  };
  const questions=advisorQuestionModel(state,{now});
  const checklist=checklistGate(state);
  const changes=canRequestAdvisorChanges(state);
  return{
    state:"active",
    route:String(route),
    themeId:ADVISOR_SESSION_THEME_ID,
    themeForced:true,
    boardReadOnly:true,
    audience:"everything",
    studentThemeId:state.theme,
    studentThemeChip:`Student's theme: ${studentThemeName(state.theme)}`,
    checklist:clone(state.advisor.checklist),
    checklistGate:checklist,
    questions,
    comments:advisorCommentModel(state),
    approveEnabled:checklist.complete,
    requestChangesEnabled:changes.allowed,
    badge:advisorApprovalBadge(state)
  };
}

export function renderAdvisorRequestSheet(document={},{
  message=""
}={}){
  const state=normalizeAdvisorDocument(document);
  return`<section class="advisor-request-sheet" role="dialog" aria-modal="true" aria-labelledby="advisor-request-title" data-advisor-request-sheet data-timeline-id="${escapeHtml(state.id)}">
    <h2 id="advisor-request-title">${ADVISOR_COPY.requestAction}</h2>
    <label for="advisor-request-message">${ADVISOR_COPY.requestMessage}</label>
    <textarea id="advisor-request-message" data-advisor-request-message>${escapeHtml(message)}</textarea>
    <button type="button" class="button primary" data-advisor-send>${ADVISOR_COPY.send}</button>
  </section>`;
}

function renderChecklist(items){
  return`<section class="advisor-checklist" aria-labelledby="advisor-checklist-title">
    <h2 id="advisor-checklist-title">${ADVISOR_COPY.checklist}</h2>
    <ul>${items.map((item)=>`<li data-checklist-item="${escapeHtml(item.id)}" data-checklist-state="${item.state}">
      <span id="advisor-check-${escapeHtml(item.id)}">${escapeHtml(item.label)}</span>
      <span class="checklist-tristate" role="group" aria-labelledby="advisor-check-${escapeHtml(item.id)}">
        <button type="button" data-checklist-choice="pass" data-checklist-id="${escapeHtml(item.id)}" aria-pressed="${String(item.state===CHECKLIST_STATES.PASS)}" aria-label="Pass">✓</button>
        <button type="button" data-checklist-choice="flag" data-checklist-id="${escapeHtml(item.id)}" aria-pressed="${String(item.state===CHECKLIST_STATES.FLAG)}" aria-label="Flag">⚑</button>
      </span>
    </li>`).join("")}</ul>
  </section>`;
}

function renderQuestions(model){
  const visible=model.visible.map((question)=>`<li>
    <button type="button" class="advisor-question" data-advisor-question="${escapeHtml(question.id)}">${escapeHtml(question.text)}</button>
    <button type="button" class="icon-button" data-hide-advisor-question="${escapeHtml(question.id)}" aria-label="Hide question">✕</button>
  </li>`).join("");
  const hidden=model.hiddenCount?`<details class="hidden-advisor-questions">
    <summary>Hidden (${model.hiddenCount})</summary>
    <ul>${model.hidden.map((question)=>`<li><button type="button" class="advisor-question" data-advisor-question="${escapeHtml(question.id)}">${escapeHtml(question.text)}</button></li>`).join("")}</ul>
  </details>`:"";
  return`<section class="advisor-questions" aria-labelledby="advisor-questions-title">
    <h2 id="advisor-questions-title">${ADVISOR_COPY.questions}</h2>
    <ul>${visible}</ul>
    ${hidden}
  </section>`;
}

function renderCommentPins(comments,{activePinId=null,student=false}={}){
  return comments.map((comment)=>{
    const label=`Comment ${comment.number}${comment.resolved?", resolved":""}`;
    const popover=student&&activePinId===comment.id?`<div class="advisor-pin-popover" data-advisor-pin-popover>
      <p>${escapeHtml(comment.note)}</p>
      ${comment.resolved?"":`<button type="button" class="button secondary compact" data-resolve-advisor-comment="${escapeHtml(comment.id)}">${ADVISOR_COPY.resolve}</button>`}
    </div>`:"";
    return`<button type="button" class="advisor-comment-pin ${comment.resolved?"resolved":""}" data-advisor-pin="${escapeHtml(comment.id)}" aria-label="${escapeHtml(label)}" style="--pin-x:${comment.x*100}%;--pin-y:${comment.y*100}%"><span>${comment.number}</span></button>${popover}`;
  }).join("");
}

function renderComments(model,{editingCommentId=null}={}){
  return`<section class="advisor-comments" aria-labelledby="advisor-comments-title">
    <h2 id="advisor-comments-title">${ADVISOR_COPY.comments}</h2>
    <p>${ADVISOR_COPY.pinInstruction}</p>
    <ol>${model.all.map((comment)=>{
      const editing=editingCommentId===comment.id||!comment.note;
      return`<li class="${comment.resolved?"resolved":""}" data-advisor-comment="${escapeHtml(comment.id)}">
        <span class="comment-number">${comment.number}</span>
        ${editing?`<label><span class="sr-only">Comment ${comment.number}</span><textarea maxlength="${ADVISOR_PIN_NOTE_MAX}" data-advisor-comment-note="${escapeHtml(comment.id)}">${escapeHtml(comment.note)}</textarea></label>
          <button type="button" class="button secondary compact" data-save-advisor-comment="${escapeHtml(comment.id)}">Save</button>`:
          `<p>${escapeHtml(comment.note)}</p>
          <button type="button" class="button tertiary compact" data-edit-advisor-comment="${escapeHtml(comment.id)}">Edit</button>`}
        <button type="button" class="button tertiary compact" data-delete-advisor-comment="${escapeHtml(comment.id)}">Delete</button>
      </li>`;
    }).join("")}</ol>
  </section>`;
}

export function renderAdvisorSession(document,{
  route,
  boardHtml="",
  loading=false,
  now=new Date(),
  editingCommentId=null
}={}){
  const model=advisorSessionModel(document,{route,loading,now});
  if(model.state==="invalid"){
    return`<main class="advisor-session-state" data-advisor-session="invalid"><h1>Advisor review</h1><section class="advisor-inactive-card"><p>${ADVISOR_COPY.inactive}</p></section></main>`;
  }
  if(model.state==="loading"){
    return`<main class="advisor-session-state" data-advisor-session="loading" aria-busy="true"><h1>Advisor review</h1><div class="advisor-board-skeleton" aria-label="Loading timeline"></div></main>`;
  }
  return`<main class="advisor-session" data-advisor-session="active" data-advisor-theme="${model.themeId}">
    <h1 class="sr-only">Advisor review</h1>
    <section class="advisor-board-zone" aria-label="Student timeline">
      <span class="student-theme-chip">${escapeHtml(model.studentThemeChip)}</span>
      <div class="advisor-board" data-advisor-board tabindex="0" role="group" aria-label="Read-only student timeline. Use arrow keys to move the comment cursor and Enter to pin a comment." aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter Space">
        ${boardHtml}
        <span class="advisor-pin-cursor" data-advisor-pin-cursor aria-hidden="true" style="--pin-x:50%;--pin-y:50%"></span>
        ${renderCommentPins(model.comments.all)}
      </div>
    </section>
    <aside class="advisor-rail" aria-label="Advisor review tools" data-advisor-rail>
      ${renderChecklist(model.checklist)}
      ${renderQuestions(model.questions)}
      ${renderComments(model.comments,{editingCommentId})}
      <footer class="advisor-verdict">
        <button type="button" class="button primary" data-advisor-approve ${model.approveEnabled?"":"disabled"}>${ADVISOR_COPY.approve}</button>
        <button type="button" class="button secondary" data-advisor-request-changes ${model.requestChangesEnabled?"":"disabled"}>${ADVISOR_COPY.requestChanges}</button>
        ${model.badge?`<p role="status" class="advisor-approval-confirmation">${escapeHtml(model.badge.text)}</p>`:""}
      </footer>
    </aside>
    <p class="sr-only" aria-live="polite" data-advisor-live></p>
  </main>`;
}

export function renderStudentCommentLayer(document,{
  visible=false,
  activePinId=null,
  context="canvas"
}={}){
  if(context==="export"||!visible)return"";
  const comments=advisorCommentModel(document);
  return`<div class="student-advisor-comments" data-student-comment-layer>${renderCommentPins(comments.all,{activePinId,student:true})}</div>`;
}

function closest(target,selector){
  return target?.closest?.(selector)||null;
}

function announce(root,hooks,message){
  if(typeof hooks.onAnnounce==="function"){
    hooks.onAnnounce(message);
    return;
  }
  const live=root.querySelector?.("[data-advisor-live]");
  if(live)live.textContent=message;
}

function boardCoordinates(board,event){
  const bounds=board.getBoundingClientRect?.();
  if(!bounds||!bounds.width||!bounds.height)return{x:.5,y:.5};
  return{
    x:clampCoordinate((Number(event.clientX)-bounds.left)/bounds.width),
    y:clampCoordinate((Number(event.clientY)-bounds.top)/bounds.height)
  };
}

/*
 * Event delegation keeps all store, version, persistence, route, and timeout
 * ownership in explicit root-supplied hooks. Keyboard board pinning uses a
 * visible normalized cursor: arrows move it, Enter/Space pins.
 */
export function installAdvisorWorkflow(root,hooks={}){
  if(!root?.addEventListener)return()=>{};
  let cursor={x:.5,y:.5};
  const updateCursor=(board)=>{
    const marker=board?.querySelector?.("[data-advisor-pin-cursor]");
    marker?.style?.setProperty?.("--pin-x",`${cursor.x*100}%`);
    marker?.style?.setProperty?.("--pin-y",`${cursor.y*100}%`);
    hooks.onBoardCursor?.(clone(cursor));
  };
  const click=(event)=>{
    const checklist=closest(event.target,"[data-checklist-choice]");
    if(checklist){
      hooks.onChecklist?.({
        id:checklist.dataset.checklistId,
        state:checklist.dataset.checklistChoice
      },event);
      return;
    }
    const hideQuestion=closest(event.target,"[data-hide-advisor-question]");
    if(hideQuestion){
      hooks.onHideQuestion?.(hideQuestion.dataset.hideAdvisorQuestion,event);
      return;
    }
    const question=closest(event.target,"[data-advisor-question]");
    if(question){
      hooks.onQuestion?.(question.dataset.advisorQuestion,{
        color:ADVISOR_HIGHLIGHT_COLOR,
        durationMs:ADVISOR_QUESTION_HIGHLIGHT_MS
      },event);
      announce(root,hooks,"Highlighted the question source on the board.");
      return;
    }
    const pin=closest(event.target,"[data-advisor-pin]");
    if(pin){
      hooks.onPin?.(pin.dataset.advisorPin,event);
      return;
    }
    const save=closest(event.target,"[data-save-advisor-comment]");
    if(save){
      const id=save.dataset.saveAdvisorComment;
      const note=root.querySelector?.(`[data-advisor-comment-note="${id}"]`)?.value||"";
      hooks.onSaveComment?.({id,note},event);
      return;
    }
    const edit=closest(event.target,"[data-edit-advisor-comment]");
    if(edit){
      hooks.onEditComment?.(edit.dataset.editAdvisorComment,event);
      return;
    }
    const remove=closest(event.target,"[data-delete-advisor-comment]");
    if(remove){
      hooks.onDeleteComment?.(remove.dataset.deleteAdvisorComment,event);
      return;
    }
    const resolve=closest(event.target,"[data-resolve-advisor-comment]");
    if(resolve){
      hooks.onResolveComment?.(resolve.dataset.resolveAdvisorComment,event);
      return;
    }
    if(closest(event.target,"[data-advisor-approve]")){
      hooks.onApprove?.(event);
      return;
    }
    if(closest(event.target,"[data-advisor-request-changes]")){
      hooks.onRequestChanges?.(event);
      return;
    }
    if(closest(event.target,"[data-advisor-send]")){
      const message=root.querySelector?.("[data-advisor-request-message]")?.value||"";
      hooks.onSendRequest?.({message},event);
      return;
    }
    const board=closest(event.target,"[data-advisor-board]");
    if(board){
      cursor=boardCoordinates(board,event);
      updateCursor(board);
      hooks.onCreatePin?.(clone(cursor),event);
      announce(root,hooks,"Comment pin added.");
    }
  };
  const keydown=(event)=>{
    const board=closest(event.target,"[data-advisor-board]");
    if(!board)return;
    const step=event.shiftKey?.01:.05;
    const deltas={
      ArrowLeft:[-step,0],
      ArrowRight:[step,0],
      ArrowUp:[0,-step],
      ArrowDown:[0,step]
    };
    if(deltas[event.key]){
      event.preventDefault?.();
      cursor={
        x:clampCoordinate(cursor.x+deltas[event.key][0]),
        y:clampCoordinate(cursor.y+deltas[event.key][1])
      };
      updateCursor(board);
      announce(root,hooks,`Comment cursor ${Math.round(cursor.x*100)} percent across, ${Math.round(cursor.y*100)} percent down.`);
      return;
    }
    if(event.key==="Enter"||event.key===" "){
      event.preventDefault?.();
      hooks.onCreatePin?.(clone(cursor),event);
      announce(root,hooks,"Comment pin added.");
    }
  };
  root.addEventListener("click",click);
  root.addEventListener("keydown",keydown);
  return()=>{
    root.removeEventListener("click",click);
    root.removeEventListener("keydown",keydown);
  };
}
