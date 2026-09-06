import {monthIndex} from "./date-normalizer.js";
import {similarity} from "./duplicate-detector.js";
import {stableHash} from "./provenance.js";

function dateDiff(a,b){
  const startA=monthIndex(a.startDate),startB=monthIndex(b.startDate);
  const endA=monthIndex(a.endDate||a.startDate),endB=monthIndex(b.endDate||b.startDate);
  return {start:startA==null||startB==null?null:Math.abs(startA-startB),end:endA==null||endB==null?null:Math.abs(endA-endB)};
}

function isIdentityMatch(a,b){
  if(a.sourceDocumentId===b.sourceDocumentId||a.canonicalType!==b.canonicalType)return false;
  return similarity(a.title,b.title)>=0.48||similarity(a.siteName||a.organization,b.siteName||b.organization)>=0.6;
}

export function detectConflicts(candidates){
  const conflicts=[];
  for(let left=0;left<candidates.length;left++)for(let right=left+1;right<candidates.length;right++){
    const a=candidates[left],b=candidates[right];
    if(!isIdentityMatch(a,b))continue;
    const dates=dateDiff(a,b);
    const examLike=/^STEP_|ECFMG|GRADUATION/.test(a.canonicalType);
    const dateConflict=examLike?(dates.start!=null&&dates.start>0):((dates.start!=null&&dates.start>1)||(dates.end!=null&&dates.end>1));
    const orgA=a.siteName||a.organization,orgB=b.siteName||b.organization;
    const organizationConflict=!!orgA&&!!orgB&&similarity(orgA,orgB)<0.16&&similarity(a.title,b.title)>=0.75;
    if(!dateConflict&&!organizationConflict)continue;
    const id="conf-"+stableHash([a.id,b.id].sort().join("|"));
    const reasons=[];
    if(dateConflict)reasons.push("Normalized dates disagree across documents");
    if(organizationConflict)reasons.push("Organizations disagree for an otherwise matching event");
    const conflict={id,candidateIds:[a.id,b.id],fields:[...(dateConflict?["startDate","endDate"]:[]),...(organizationConflict?["organization"]:[])],reasons,status:"UNRESOLVED"};
    conflicts.push(conflict);
    a.conflictIds.push(id);
    b.conflictIds.push(id);
    if(a.candidateKind==="NORMAL"||a.candidateKind==="DUPLICATE")a.candidateKind="CONFLICT";
    if(b.candidateKind==="NORMAL"||b.candidateKind==="DUPLICATE")b.candidateKind="CONFLICT";
    a.safeToBulkAccept=false;
    b.safeToBulkAccept=false;
  }
  return conflicts;
}
