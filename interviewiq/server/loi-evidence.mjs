import * as v from './validation.mjs';
// Empty by default. Adding a claim requires independent review of exact supporting
// content and current canonical program/field/value/provenance; URL host is never authority.
export const APPROVED_LOI_EVIDENCE_PINS=Object.freeze([]);
export const EVIDENCE_GUARD='SOURCE_PINNED_CLAIM_REVIEW_V1';
const strings=x=>typeof x==='string'?[x]:Array.isArray(x)?x.flatMap(strings):x&&typeof x==='object'?Object.values(x).flatMap(strings):[];
export const loiEvidencePin=(program,e)=>v.digest({contract:EVIDENCE_GUARD,program:Object.fromEntries(['id','name','track','registryReleaseId'].map(k=>[k,program[k]])),evidence:Object.fromEntries(['field','state','claimRef','value','retrievedAt','asOf','sources'].map(k=>[k,e[k]]))});
export function qualifyLoiEvidence(fresh,pins=APPROVED_LOI_EVIDENCE_PINS){
 const evidence=fresh?.evidence;if(!fresh?.program||!Array.isArray(evidence)||!evidence.length||!Array.isArray(pins)||pins.some(p=>typeof p!=='string'||!/^[a-f0-9]{64}$/.test(p)))return {allowed:false,reason:'RESEARCH_NEEDED'};
 const claimDigests=[];
 for(const e of evidence){const narrative=strings(e.value).join('\n');
  if(e.state!=='SUPPORTED'||/\b(?:contest\w*|ambigu\w*|conflict\w*|contradict\w*|uncertain\w*|unresolved|unverified|unknown|disputed)\b|(?:not|cannot|could not)\s+(?:be\s+)?(?:confirm\w*|verif\w*)|no complete|not found/i.test(narrative)||!Array.isArray(e.sources)||!e.sources.length||e.sources.length>16||e.sources.some(s=>!/^rise-review:[a-f0-9]{64}$/.test(s.reviewRef??'')||!Array.isArray(s.urls)||(s.urls.length<1||s.urls.length>8)||s.urls.some(u=>{try{const x=new URL(u);return x.protocol!=='https:'||x.username||x.password;}catch{return true;}})))return {allowed:false,reason:'RESEARCH_NEEDED'};
  const digest=loiEvidencePin(fresh.program,e);if(!pins.includes(digest))return {allowed:false,reason:'RESEARCH_NEEDED'};claimDigests.push(digest);
 }
 return {allowed:true,contract:EVIDENCE_GUARD,claimDigests};
}
