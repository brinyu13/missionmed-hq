import {clone,nowIso,stableId,stableStringify} from "../core/canonical.js";

export const REVIEW_STATES={UNREVIEWED:"UNREVIEWED",CHANGES_REQUESTED:"CHANGES_REQUESTED",PARTIALLY_APPROVED:"PARTIALLY_APPROVED",APPROVED_INTERVIEWER_SAFE:"APPROVED_INTERVIEWER_SAFE",APPROVED_FULL_STORY:"APPROVED_FULL_STORY",APPROVAL_REVOKED:"APPROVAL_REVOKED",NEEDS_REREVIEW:"NEEDS_REREVIEW"};

export function createAdvisorReview(){
  return {schemaVersion:"d1-advisor-review-409.1",status:REVIEW_STATES.UNREVIEWED,checklist:[
    {id:"chronology",label:"Chronology and dates verified",complete:false},
    {id:"privacy",label:"Privacy and visibility choices reviewed",complete:false},
    {id:"story",label:"Story arc and overlaps reviewed",complete:false},
    {id:"questions",label:"Likely interview questions discussed",complete:false}
  ],comments:[],changeRequests:[],approvals:{interviewerSafe:null,fullStory:null,export:null},auditHistory:[],studentAcknowledgements:[],materialFingerprint:null,updatedAt:nowIso()};
}

export function normalizeAdvisorReview(value={}){
  const base=createAdvisorReview(),input=clone(value||{});
  return {...base,...input,
    checklist:Array.isArray(input.checklist)&&input.checklist.length?input.checklist:base.checklist,
    comments:Array.isArray(input.comments)?input.comments:[],changeRequests:Array.isArray(input.changeRequests)?input.changeRequests:[],
    approvals:{...base.approvals,...(input.approvals||{})},auditHistory:Array.isArray(input.auditHistory)?input.auditHistory:[],
    studentAcknowledgements:Array.isArray(input.studentAcknowledgements)?input.studentAcknowledgements:[]};
}

export function materialApprovalSnapshot(document){
  return {
    title:document.title,studentProfile:document.studentProfile,categories:document.categories,theme:document.theme,
    events:(document.events||[]).map((event)=>({id:event.id,title:event.title,categoryId:event.categoryId,eventType:event.eventType,startDate:event.startDate,endDate:event.endDate,siteName:event.siteName,location:event.location,visibility:event.visibilityState||event.visibility,lane:event.lane,mediaId:event.mediaId})),
    mediaItems:(document.mediaItems||[]).map((item)=>({id:item.id,type:item.type,placement:item.placement,contentHash:item.contentHash,crop:item.crop,visibility:item.visibility,altText:item.altText})),
    mediaLayout:document.mediaLayout
  };
}

export class AdvisorReviewManager{
  constructor(state,clock=()=>new Date()){this.state=normalizeAdvisorReview(state.advisorReview);state.advisorReview=this.state;this.clock=clock;}
  at(){return nowIso(this.clock);}
  audit(action,details={}){const item={id:stableId("advisor-audit",[action,this.at(),this.state.auditHistory.length]),action,details:clone(details),at:this.at()};this.state.auditHistory.push(item);this.state.updatedAt=item.at;return item;}
  setChecklist(id,complete,authorRole="ADVISOR"){const item=this.state.checklist.find((check)=>check.id===id);if(!item)throw new Error("Advisor checklist item not found.");item.complete=!!complete;item.updatedAt=this.at();item.updatedByRole=authorRole;this.audit("CHECKLIST_UPDATED",{id,complete:!!complete,authorRole});return item;}
  addComment({body,timelineEventId=null,authorRole="ADVISOR",visibility="STUDENT_AND_ADVISOR",kind="COMMENT"}){
    if(!String(body||"").trim())throw new Error("Comment text is required.");
    const comment={id:stableId("comment",[body,timelineEventId,this.at(),this.state.comments.length]),body:String(body).trim(),timelineEventId,authorRole,visibility,kind,resolved:false,studentAcknowledged:false,createdAt:this.at(),updatedAt:this.at()};
    this.state.comments.push(comment);this.audit("COMMENT_ADDED",{commentId:comment.id,timelineEventId,kind});return comment;
  }
  resolveComment(id,authorRole="ADVISOR"){const comment=this.state.comments.find((item)=>item.id===id);if(!comment)throw new Error("Advisor comment not found.");comment.resolved=true;comment.resolvedAt=this.at();comment.resolvedByRole=authorRole;comment.updatedAt=this.at();this.audit("COMMENT_RESOLVED",{commentId:id,authorRole});return comment;}
  acknowledgeComment(id){const comment=this.state.comments.find((item)=>item.id===id);if(!comment)throw new Error("Advisor comment not found.");comment.studentAcknowledged=true;comment.studentAcknowledgedAt=this.at();this.state.studentAcknowledgements.push({commentId:id,at:comment.studentAcknowledgedAt});this.audit("STUDENT_ACKNOWLEDGED",{commentId:id});return comment;}
  requestChanges({body="Advisor requested changes.",timelineEventId=null,authorRole="ADVISOR"}={}){
    const request={id:stableId("change-request",[body,timelineEventId,this.at()]),body,timelineEventId,authorRole,state:"OPEN",createdAt:this.at(),resolvedAt:null,studentAcknowledged:false};
    this.state.changeRequests.push(request);this.state.status=REVIEW_STATES.CHANGES_REQUESTED;this.revokeApprovals("CHANGES_REQUESTED",false);this.audit("CHANGES_REQUESTED",{requestId:request.id,timelineEventId});return request;
  }
  resolveChangeRequest(id,authorRole="ADVISOR"){const request=this.state.changeRequests.find((item)=>item.id===id);if(!request)throw new Error("Change request not found.");request.state="RESOLVED";request.resolvedAt=this.at();request.resolvedByRole=authorRole;this.audit("CHANGE_REQUEST_RESOLVED",{requestId:id});return request;}
  acknowledgeChangeRequest(id){const request=this.state.changeRequests.find((item)=>item.id===id);if(!request)throw new Error("Change request not found.");request.studentAcknowledged=true;request.studentAcknowledgedAt=this.at();this.audit("CHANGE_REQUEST_ACKNOWLEDGED",{requestId:id});return request;}
  canApprove(){return this.state.checklist.every((item)=>item.complete)&&!this.state.changeRequests.some((item)=>item.state==="OPEN");}
  approve(scope,materialFingerprint,authorRole="ADVISOR"){
    if(!["personalContext","interviewerSafe","fullStory","export"].includes(scope))throw new Error("Unknown approval scope.");
    if(!this.canApprove())throw new Error("Complete the checklist and resolve change requests before approval.");
    const approval={id:stableId("approval",[scope,materialFingerprint,this.at()]),scope,state:"APPROVED",authorRole,approvedAt:this.at(),materialFingerprint,revokedAt:null,revocationReason:null};
    this.state.approvals[scope]=approval;this.state.materialFingerprint=materialFingerprint;
    const approved=Object.values(this.state.approvals).filter(Boolean).length;
    this.state.status=scope==="fullStory"?REVIEW_STATES.APPROVED_FULL_STORY:scope==="interviewerSafe"||scope==="export"?REVIEW_STATES.APPROVED_INTERVIEWER_SAFE:approved?REVIEW_STATES.PARTIALLY_APPROVED:REVIEW_STATES.UNREVIEWED;
    this.audit("APPROVED",{scope,approvalId:approval.id,materialFingerprint});return approval;
  }
  revokeApprovals(reason="MANUAL_REVOCATION",record=true){
    let count=0;Object.keys(this.state.approvals).forEach((scope)=>{const approval=this.state.approvals[scope];if(approval&&approval.state==="APPROVED"){approval.state="REVOKED";approval.revokedAt=this.at();approval.revocationReason=reason;count++;}});
    if(count)this.state.status=reason==="MATERIAL_TIMELINE_CHANGE"?REVIEW_STATES.NEEDS_REREVIEW:REVIEW_STATES.APPROVAL_REVOKED;
    if(record&&count)this.audit("APPROVALS_REVOKED",{reason,count});return count;
  }
  checkMaterialChange(materialFingerprint){
    if(!this.state.materialFingerprint){this.state.materialFingerprint=materialFingerprint;return false;}
    if(this.state.materialFingerprint===materialFingerprint)return false;
    const hadApproval=Object.values(this.state.approvals).some((approval)=>approval?.state==="APPROVED");
    if(hadApproval)this.revokeApprovals("MATERIAL_TIMELINE_CHANGE");
    this.state.materialFingerprint=materialFingerprint;
    if(hadApproval)this.audit("MATERIAL_CHANGE_REQUIRES_REREVIEW",{materialFingerprint});
    return hadApproval;
  }
  exportGate(scope){const approval=this.state.approvals[scope];return !!approval&&approval.state==="APPROVED"&&approval.materialFingerprint===this.state.materialFingerprint;}
  static fingerprintInput(document){return stableStringify(materialApprovalSnapshot(document));}
}
