export const TIMELINE_AI_FEEDBACK_SCHEMA="d1-timeline-ai-feedback.1";
export const TIMELINE_AI_FEEDBACK_PIPELINE=Object.freeze([
  "PRODUCTION_FEEDBACK",
  "CURATED_DATASET",
  "EVALUATION",
  "APPROVED_PROMPT_MODEL_OR_RULE_UPDATE",
  "RELEASE"
]);

const WORKFLOWS=new Set(["CV_SMART_FILL","QUALITY_GUARDIAN","TIMELINE_RESCUE"]);
const OUTCOMES=new Set(["ACCEPTED","MODIFIED","REJECTED"]);
const ACTOR_KINDS=new Set(["STUDENT","FOUNDER","MENTOR"]);
const clean=(value,maximum)=>String(value??"").replace(/[\u0000-\u001f]/g," ").replace(/\s+/g," ").trim().slice(0,maximum);

function randomId(){
  return globalThis.crypto?.randomUUID?.()||`feedback-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function canonicalDate(value){
  const text=clean(value,32);
  return /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?$/.test(text)?text:null;
}

export function classifyTimelineAiCandidateOutcome(candidate,decision){
  if(String(decision)==="rejected")return"REJECTED";
  const original=candidate?.fields?.aiOriginalSemantic;
  if(!original||typeof original!=="object")return"ACCEPTED";
  const changed=[
    [original.title,candidate?.title],
    [original.categoryId,candidate?.categoryId],
    [original.startDate,candidate?.startDate],
    [original.endDate,candidate?.endDate]
  ].some(([before,after])=>String(before??"")!==String(after??""));
  return changed?"MODIFIED":"ACCEPTED";
}

export function createTimelineAiFeedback(input,{now=()=>new Date().toISOString(),id=randomId}={}){
  const workflow=clean(input?.workflow,40).toUpperCase();
  const outcome=clean(input?.outcome,20).toUpperCase();
  const actorKind=clean(input?.actorKind,20).toUpperCase();
  if(!WORKFLOWS.has(workflow))throw new Error("TIMELINE_AI_FEEDBACK_WORKFLOW_INVALID");
  if(!OUTCOMES.has(outcome))throw new Error("TIMELINE_AI_FEEDBACK_OUTCOME_INVALID");
  if(!ACTOR_KINDS.has(actorKind))throw new Error("TIMELINE_AI_FEEDBACK_ACTOR_INVALID");
  const confidence=Number(input?.confidence);
  if(!Number.isFinite(confidence)||confidence<0||confidence>1)throw new Error("TIMELINE_AI_FEEDBACK_CONFIDENCE_INVALID");
  const suggestionId=clean(input?.suggestionId,160);
  const suggestionType=clean(input?.suggestionType,100).toUpperCase();
  const workflowVersion=clean(input?.workflowVersion,160);
  const modelVersion=clean(input?.modelVersion,160);
  if(!suggestionId||!suggestionType||!workflowVersion||!modelVersion)throw new Error("TIMELINE_AI_FEEDBACK_VERSION_INVALID");
  const correctedCategory=input?.correctedCategory==null?null:clean(input.correctedCategory,100);
  const correctedStartDate=input?.correctedStartDate==null?null:canonicalDate(input.correctedStartDate);
  const correctedEndDate=input?.correctedEndDate==null?null:canonicalDate(input.correctedEndDate);
  if(input?.correctedStartDate!=null&&!correctedStartDate)throw new Error("TIMELINE_AI_FEEDBACK_DATE_INVALID");
  if(input?.correctedEndDate!=null&&!correctedEndDate)throw new Error("TIMELINE_AI_FEEDBACK_DATE_INVALID");
  const layoutFix=input?.layoutFix==null?null:clean(input.layoutFix,100).toUpperCase();
  const layoutFixAccepted=layoutFix==null?null:Boolean(input?.layoutFixAccepted);
  const finalCanonicalReference=clean(input?.finalCanonicalReference,200);
  if(!finalCanonicalReference)throw new Error("TIMELINE_AI_FEEDBACK_CANONICAL_REFERENCE_REQUIRED");
  return Object.freeze({
    schemaVersion:TIMELINE_AI_FEEDBACK_SCHEMA,
    id:clean(id(),160),
    recordedAt:clean(now(),64),
    workflow,
    workflowVersion,
    modelVersion,
    suggestionId,
    suggestionType,
    confidence,
    outcome,
    modified:outcome==="MODIFIED",
    accepted:outcome==="ACCEPTED",
    rejected:outcome==="REJECTED",
    correctedCategory:correctedCategory||null,
    correctedStartDate,
    correctedEndDate,
    layoutFix,
    layoutFixAccepted,
    actorKind,
    finalCanonicalReference,
    curationStatus:"UNREVIEWED",
    trainingEligible:false
  });
}

export function appendTimelineAiFeedback(document,input,options){
  if(!document||typeof document!=="object")throw new Error("TIMELINE_AI_FEEDBACK_DOCUMENT_REQUIRED");
  const prior=Array.isArray(document.aiFeedback)?document.aiFeedback:[];
  const record=createTimelineAiFeedback(input,options);
  document.aiFeedback=[...prior.slice(-499),record];
  document.aiFeedbackPolicy={
    schemaVersion:TIMELINE_AI_FEEDBACK_SCHEMA,
    automaticTraining:false,
    pipeline:[...TIMELINE_AI_FEEDBACK_PIPELINE]
  };
  return record;
}

export function feedbackForCuration(document){
  return (Array.isArray(document?.aiFeedback)?document.aiFeedback:[])
    .filter((item)=>item?.schemaVersion===TIMELINE_AI_FEEDBACK_SCHEMA)
    .map((item)=>structuredClone(item));
}
