import {createHash} from 'node:crypto';
import {createInterviewiqEvidenceReader,projectInterviewiqCoverage,publicResearchUrl} from './interviewiq-coverage.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=()=>{throw Error('interviewiq_results_unavailable');};
const need=x=>{if(!x)fail();};
const plain=x=>x&&Object.getPrototypeOf(x)===Object.prototype;
const date=x=>{need(typeof x==='string'&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x);return x;};
const text=(x,max)=>typeof x==='string'&&x.length<=max&&!/[\u0000-\u001f\u007f]/.test(x);
const ref=x=>typeof x==='string'&&/^rise-(?:claim|review):[a-f0-9]{64}$/.test(x);
// Canonical values are data, never HTML, prompts or executable instructions.
// Reject private/debug containers rather than carrying arbitrary row metadata.
function value(x,depth=0){
 need(depth<=6);
 if(x===null||typeof x==='boolean')return x;
 if(typeof x==='number'){need(Number.isFinite(x));return x;}
 if(typeof x==='string'){need(text(x,8000));return x;}
 if(Array.isArray(x)){need(x.length<=100);return x.map(v=>value(v,depth+1));}
 need(plain(x)&&Object.keys(x).length<=60);
 return Object.fromEntries(Object.entries(x).map(([k,v])=>{need(text(k,100)&&!/(?:^|_)(?:private|secret|token|password|prompt|raw|owner|student_id|wp_user_id|subject_key|metadata)(?:_|$)/i.test(k.replace(/([A-Z]+)([A-Z][a-z])/g,'$1_$2').replace(/([a-z0-9])([A-Z])/g,'$1_$2').replace(/[^A-Za-z0-9]+/g,'_'))&&!['__proto__','constructor','prototype'].includes(k));return [k,value(v,depth+1)];}));
}
function source(s,observed){
 need(plain(s)&&ref(s.claimRef)&&Array.isArray(s.urls)&&s.urls.length>0&&s.urls.length<=8&&s.urls.every(publicResearchUrl));
 const retrievedAt=date(s.retrievedAt),reviewedAt=s.reviewedAt===null?null:date(s.reviewedAt);
 need(Date.parse(retrievedAt)<=observed&&(reviewedAt===null||Date.parse(reviewedAt)<=observed));
 need(s.reviewRef===null||ref(s.reviewRef));
 return {claimRef:s.claimRef,reviewRef:s.reviewRef,urls:[...new Set(s.urls)],retrievedAt,reviewedAt};
}
export function projectInterviewiqResearchResults(input,expected={}){
 need(plain(input)&&input.schema==='rise-interviewiq-research-results-v1');
 const coverage=projectInterviewiqCoverage(input.coverage,expected),observed=Date.parse(coverage.observedAt);
 need(Array.isArray(input.facts)&&input.facts.length<=21);
 const seen=new Set(),facts=input.facts.map(f=>{
  need(plain(f)&&!seen.has(f.field));seen.add(f.field);
  const field=coverage.fields.find(r=>r.field===f.field);need(field?.state==='SUPPORTED'&&f.state==='SUPPORTED'&&f.area===field.area&&ref(f.claimRef));
  need(Array.isArray(f.sources)&&f.sources.length>0&&f.sources.length<=16);
  const v=value(f.value);need(v!==null&&Buffer.byteLength(JSON.stringify(v))<=16384);
  const retrievedAt=date(f.retrievedAt);need(Date.parse(retrievedAt)<=observed);
  let asOf=null;if(f.asOf!==null){need(plain(f.asOf)&&text(f.asOf.kind,80)&&text(f.asOf.label,120));asOf={kind:f.asOf.kind,label:f.asOf.label};}
  return {area:field.area,field:field.field,state:'SUPPORTED',claimRef:f.claimRef,value:v,retrievedAt,asOf,sources:f.sources.map(s=>source(s,observed))};
 });
 const body={schema:input.schema,coverage,facts};need(Buffer.byteLength(JSON.stringify(body))<=196608);
 need(input.receipt?.publicRef==='rise-results-v1'&&input.receipt.sha256===sha(JSON.stringify(body)));
 return {...body,receipt:{publicRef:'rise-results-v1',sha256:input.receipt.sha256}};
}
export function createInterviewiqResearchResultsReader(config={}){
 return createInterviewiqEvidenceReader(config,(coverage,rows)=>{
  const facts=[];
  for(const field of coverage.fields){
   if(field.state!=='SUPPORTED')continue;
   const row=rows.find(r=>r.field===field.field);
   // An oversized/unsupported canonical shape remains retained by RISE. It is
   // omitted here rather than exposing an unbounded or private-shaped payload.
   try{
    const v=value(row.canonical_value);if(v===null)continue;
    const promoted=row.provider==='MISSIONMED_REVIEW'||row.source_type==='canonical_review_promotion';
    const lineage=promoted?row.lineage:[{claimRef:row.claim_id,reviewRef:row.review_id??null,urls:[row.source_url],retrievedAt:row.retrieved_at,reviewedAt:row.reviewed_at??null}];
    if(lineage.length>16)continue;
    const sources=lineage.map(l=>({claimRef:'rise-claim:'+sha(l.claimRef),reviewRef:l.reviewRef?'rise-review:'+sha(l.reviewRef):null,
      urls:l.urls.filter(publicResearchUrl),retrievedAt:new Date(l.retrievedAt).toISOString(),reviewedAt:l.reviewedAt?new Date(l.reviewedAt).toISOString():null}));
    const period=row.observed_period,asOf=plain(period)&&text(period.kind,80)&&text(period.label,120)?{kind:period.kind,label:period.label}:null;
    facts.push({...field,claimRef:'rise-claim:'+sha(row.claim_id),value:v,retrievedAt:new Date(row.retrieved_at).toISOString(),asOf,sources});
   }catch{continue;}
  }
  const body={schema:'rise-interviewiq-research-results-v1',coverage,facts};
  return projectInterviewiqResearchResults({...body,receipt:{publicRef:'rise-results-v1',sha256:sha(JSON.stringify(body))}},
    {programId:coverage.programId,registryReleaseId:coverage.registryReleaseId});
 });
}
