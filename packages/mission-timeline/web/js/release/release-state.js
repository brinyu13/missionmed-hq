import {clone,nowIso,visibilityName} from "../core/canonical.js";

export const RELEASE_CANDIDATE_VERSION="410.0-rc";
export const OCR_RELEASE_DECISION="MANUAL_TEXT_FALLBACK";
export const VISIBILITY_STATES=["INTERVIEWER_SAFE","FULL_STORY","ADVISOR_ONLY","STUDENT_ONLY","HIDDEN"];

function cleanIds(value){return [...new Set((Array.isArray(value)?value:[]).map(String).filter(Boolean))];}

export function createReleaseCandidateState(api,state409){
  const sourceDatesByEvent={};
  (api.state.user?.events||[]).forEach((event)=>{sourceDatesByEvent[event.id]={startDate:event.s,endDate:event.e||null};});
  return {
    schemaVersion:"d1-release-candidate-410.1",
    applicationVersion:RELEASE_CANDIDATE_VERSION,
    status:"RELEASE_CANDIDATE",
    onboarding:{route:null,walkthroughCompleted:false,privacySeen:false,lastSafeExit:"command"},
    editor:{zoom:1,density:"FIT",viewScope:"FULL_STORY",deletedEvents:[],sourceDatesByEvent,categoryDefaults:Object.fromEntries(Object.entries(api.CATS||{}).map(([id,item])=>[id,{label:item.n,color:item.c}])),lastSelectedEventId:null,lastCollisionCount:0},
    review:{query:"",status:"ALL",confidence:"ALL",type:"ALL",source:"ALL",group:"ALL",page:1,pageSize:25,selectedCandidateIds:[],scrollTop:0,lastFocusedCandidateId:null},
    ocr:{decision:OCR_RELEASE_DECISION,cloudOcr:false,manualTextEnabled:true,languageDisclosure:"English-first parser. Other languages require human review.",lastManualSourceId:null},
    accessibleExports:{visualPdfTagged:false,accessibleHtmlEnabled:true,archiveTextSummaryEnabled:true,limitation:"Visual PDFs are untagged. Semantic HTML and text companions are provided."},
    advisor:{practiceQuestionIds:[],lastBriefOpenedAt:null},
    recovery:{lastAttackStatus:"NOT_RUN",lastVerifiedAt:null},
    createdAt:nowIso(),updatedAt:nowIso(),sandboxOnly:true
  };
}

export function normalizeReleaseCandidateState(value,api,state409){
  const base=createReleaseCandidateState(api,state409),input=clone(value||{});
  const result={...base,...input,
    onboarding:{...base.onboarding,...(input.onboarding||{})},
    editor:{...base.editor,...(input.editor||{})},
    review:{...base.review,...(input.review||{})},
    ocr:{...base.ocr,...(input.ocr||{})},
    accessibleExports:{...base.accessibleExports,...(input.accessibleExports||{})},
    advisor:{...base.advisor,...(input.advisor||{})},
    recovery:{...base.recovery,...(input.recovery||{})}
  };
  result.applicationVersion=RELEASE_CANDIDATE_VERSION;
  result.status="RELEASE_CANDIDATE";
  result.review.selectedCandidateIds=cleanIds(result.review.selectedCandidateIds);
  result.editor.deletedEvents=Array.isArray(result.editor.deletedEvents)?result.editor.deletedEvents:[];
  result.editor.sourceDatesByEvent=result.editor.sourceDatesByEvent&&typeof result.editor.sourceDatesByEvent==="object"?result.editor.sourceDatesByEvent:{};
  result.editor.categoryDefaults=result.editor.categoryDefaults&&typeof result.editor.categoryDefaults==="object"?result.editor.categoryDefaults:base.editor.categoryDefaults;
  result.editor.zoom=Math.min(1.4,Math.max(.55,Number(result.editor.zoom)||1));
  result.review.page=Math.max(1,Number(result.review.page)||1);
  result.review.pageSize=[10,25,50,100].includes(Number(result.review.pageSize))?Number(result.review.pageSize):25;
  result.ocr.decision=OCR_RELEASE_DECISION;
  result.updatedAt=nowIso();
  return result;
}

export function ensureReleaseCandidateState(api,state409){
  const state=normalizeReleaseCandidateState(state409.releaseCandidate,api,state409);
  state409.releaseCandidate=state;
  api.state.timelineTitle=api.state.timelineTitle||`Timeline: ${api.state.profile?.name||"Student"}`;
  (api.state.user?.events||[]).forEach((event)=>{
    event.visibilityState=visibilityName(event.visibilityState||event.vis);
    if(!state.editor.sourceDatesByEvent[event.id])state.editor.sourceDatesByEvent[event.id]={startDate:event.s,endDate:event.e||null};
  });
  return state;
}

export function touchReleaseState(state){state.updatedAt=nowIso();return state;}
