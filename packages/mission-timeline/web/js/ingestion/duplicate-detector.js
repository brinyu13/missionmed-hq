import {monthIndex} from "./date-normalizer.js";
import {stableHash} from "./provenance.js";

export function normalizeIdentity(value){
  return String(value||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/\b(the|of|at|and|inc|llc|hospital|medical center)\b/g," ").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
}

export function similarity(a,b){
  const left=new Set(normalizeIdentity(a).split(" ").filter(Boolean));
  const right=new Set(normalizeIdentity(b).split(" ").filter(Boolean));
  if(!left.size||!right.size)return 0;
  const intersection=[...left].filter((token)=>right.has(token)).length;
  return intersection/(left.size+right.size-intersection);
}

function dateDistance(a,b){
  const starts=[monthIndex(a.startDate),monthIndex(b.startDate)];
  const ends=[monthIndex(a.endDate||a.startDate),monthIndex(b.endDate||b.startDate)];
  if(starts.includes(null)||ends.includes(null))return {start:Infinity,end:Infinity};
  return {start:Math.abs(starts[0]-starts[1]),end:Math.abs(ends[0]-ends[1])};
}

function duplicateScore(a,b){
  if(a.sourceDocumentId===b.sourceDocumentId||a.canonicalType!==b.canonicalType)return null;
  const titleScore=similarity(a.title,b.title);
  const siteScore=similarity(a.siteName||a.organization,b.siteName||b.organization);
  const dates=dateDistance(a,b);
  const examLike=/^STEP_|ECFMG|GRADUATION|PUBLICATION/.test(a.canonicalType);
  const dateMatch=examLike?dates.start===0:dates.start<=1&&dates.end<=1;
  if(!dateMatch)return null;
  if(titleScore<0.48&&siteScore<0.55)return null;
  const score=Math.round((titleScore*0.5+siteScore*0.25+(dateMatch?0.25:0))*100);
  return {score,titleScore,siteScore,dates};
}

export function detectDuplicates(candidates){
  const groups=[];
  for(let left=0;left<candidates.length;left++)for(let right=left+1;right<candidates.length;right++){
    const a=candidates[left],b=candidates[right];
    if(a.conflictIds?.length||b.conflictIds?.length)continue;
    const match=duplicateScore(a,b);
    if(!match)continue;
    const id="dup-"+stableHash([a.id,b.id].sort().join("|"));
    const group={id,candidateIds:[a.id,b.id],score:match.score,reasons:["Same canonical event type","Similar title or institution","Dates match within one month"],status:"UNRESOLVED"};
    groups.push(group);
    a.duplicateGroupIds.push(id);
    b.duplicateGroupIds.push(id);
    if(a.candidateKind==="NORMAL")a.candidateKind="DUPLICATE";
    if(b.candidateKind==="NORMAL")b.candidateKind="DUPLICATE";
    a.safeToBulkAccept=false;
    b.safeToBulkAccept=false;
  }
  return groups;
}
