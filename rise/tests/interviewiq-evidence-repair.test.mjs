import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createInterviewiqCoverageReader} from '../adapters/interviewiq-coverage.mjs';
import {createInterviewiqResearchResultsReader} from '../adapters/interviewiq-research-results.mjs';
import {DEEP_RESEARCH_DOSSIER_V2} from '../src/research-router.mjs';
import {hasUnresolvedResearchConflict,reviewResearchCorpus} from '../src/research-review.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const artifact=JSON.parse(readFileSync(new URL('./fixtures/interviewiq-owner-evidence.json',import.meta.url)));
const actual=field=>artifact.claims.find(x=>x.field===field);
const urls=row=>row.urls.map(x=>x.url??`https://synthetic.edu/collector-redacted-${x.ordinal}`);
const fields=DEEP_RESEARCH_DOSSIER_V2.domains.flatMap(d=>d.fields);
const context={programId:'synthetic-evidence-program',registryReleaseId:'synthetic-evidence-release'};
function rowFrom(field='research.abim'){
 const real=actual(field);return {field,knowledge_state:'known',canonical_value:real.value,review_value:null,
  observed_at:new Date().toISOString(),retrieved_at:real.retrievedAt,source_retrieved_at:real.reviewedAt,
  provider:'MISSIONMED_REVIEW',source_type:'canonical_review_promotion',claim_id:'synthetic-promoted-'+field,
  observed_period:{kind:'reviewed_snapshot',label:'2026-09-10'},lineage:[{identityValid:true,approvalCurrent:true,disposition:'APPROVED_CURRENT',
   claimRef:'synthetic-original-'+field,reviewRef:'synthetic-review-'+field,value:real.originalValue,reviewValue:real.reviewValue,
   retrievedAt:real.sourceRetrievedAt,sourceRetrievedAt:real.sourceRetrievedAt,reviewedAt:real.reviewedAt,urls:urls(real)}]};
}
function readers(selected){
 let queries=0,releases=0;const client={async query({text}){queries++;
  if(text.includes('current_user AS role'))return {rows:[{role:'rise_app_runtime',session:'rise_app_login',major:18,elevated:false}]};
  if(text.includes('FROM pg_class'))return {rows:['canonical_evidence_claims','canonical_evidence_sources','canonical_program_identities','canonical_claim_promotion_lineage','evidence_claim_review_events'].map(name=>({name,kind:'r',owner:'postgres',rls:true,forced:true}))};
  if(text.startsWith('WITH subjects'))return {rows:fields.map(field=>selected.find(r=>r.field===field)??{field,knowledge_state:'unknown',observed_at:selected[0].observed_at})};
  return {rows:[]};},release(){releases++;}};
 const config={enabled:true,pool:{options:{connectionTimeoutMillis:5000},connect:async()=>client}};
 return {read:createInterviewiqResearchResultsReader(config),coverage:createInterviewiqCoverageReader(config),counts:()=>({queries,releases})};
}
test('owner artifact proves ABIM17 and contested visa; no recovered URLs are invented',()=>{
 const a=actual('research.abim');assert.equal(a.urls.length,24);assert.equal(a.urls[16].url,'https://www.abim.org/media/ep2awh1x/residency-program-pass-rates.pdf');
 assert.equal(a.urls.filter(x=>x.url===null).length,2);assert.equal(hasUnresolvedResearchConflict(a.value),false);
 assert.equal(hasUnresolvedResearchConflict(actual('research.visa').value),true);
});
test('complete24 URL review association survives as3 bounded segments with unchanged refs/dates/value',async()=>{
 const row=rowFrom(),r=readers([row]),out=await r.read(context),fact=out.facts[0];
 assert.equal(fact.sources.length,3);assert.deepEqual(fact.sources.flatMap(s=>s.urls),row.lineage[0].urls);
 assert.deepEqual(fact.value,actual('research.abim').value);assert.ok(fact.sources.every(s=>s.claimRef==='rise-claim:'+sha(row.lineage[0].claimRef)&&s.reviewRef==='rise-review:'+sha(row.lineage[0].reviewRef)&&s.retrievedAt===row.lineage[0].retrievedAt&&s.reviewedAt===row.lineage[0].reviewedAt));
 assert.ok(fact.sources.every(s=>s.urls.length===8));assert.deepEqual(r.counts(),{queries:6,releases:1});
});
test('actual mixed visa canonical value isCONFLICTED, omitted from facts, never partially rewritten',async()=>{
 const row=rowFrom('research.visa'),before=structuredClone(row),r=readers([row]);
 const out=await r.read(context);assert.equal(out.coverage.fields.find(f=>f.field===row.field).state,'CONFLICTED');assert.equal(out.facts.length,0);assert.deepEqual(row,before);
 assert.equal((await r.coverage(context)).fields.find(f=>f.field===row.field).state,'CONFLICTED');
});
for(const location of ['canonical_value','review_value','original','review'])test('contested '+location+' cannot hide behind APPROVED_CURRENT',async()=>{
 const row=rowFrom();if(location==='original')row.lineage[0].value={summary:'H-1B remains contested'};
 else if(location==='review')row.lineage[0].reviewValue={summary:'H-1B ambiguity'};else row[location]={summary:'H-1B remains contested'};
 const out=await readers([row]).read(context);assert.equal(out.facts.length,0);assert.equal(out.coverage.fields.find(f=>f.field===row.field).state,'CONFLICTED');
});
for(const [name,edit] of Object.entries({
 over128:r=>r.lineage[0].urls=Array.from({length:129},(_,i)=>`https://synthetic.edu/${i}`),
 over16segments:r=>r.lineage=[...r.lineage,...Array.from({length:14},(_,i)=>({...r.lineage[0],claimRef:'extra'+i,urls:['https://synthetic.edu/extra']}))],
 unsafeTail:r=>r.lineage[0].urls[23]='https://127.0.0.1/private',
 overlengthTail:r=>r.lineage[0].urls[23]='https://synthetic.edu/'+ 'x'.repeat(2048),
 oversizedValue:r=>r.value_bounded=false,
 oversizedLineage:r=>r.lineage[0].valueBounded=false,
 wrongIdentity:r=>r.lineage[0].identityValid=false,
 revokedReview:r=>r.lineage[0].approvalCurrent=false,
}))test('incomplete or unsafe provenance fails closed without prefix support: '+name,async()=>{
 const row=rowFrom();edit(row);const out=await readers([row]).read(context);assert.equal(out.facts.length,0);assert.equal(out.coverage.fields.find(f=>f.field===row.field).state,'WEAK');
});
test('review future normalized and ordinary claims cannot bypass explicit mixed conflict; retained sources unchanged',()=>{
 for(const evidenceState of [undefined,'NORMALIZED_PACKAGE_PROJECTION']){
  const real=actual('research.visa'),sourceUrls=urls(real),claim={id:'synthetic-conflict',field:'research.visa',value:real.value,evidenceState,provider:'CLAUDE_SONNET',sourceUrls,directSourceUrls:[]};
  const out=reviewResearchCorpus([{acgmeId:'1400000000',claims:[claim]}]);assert.equal(out.decisions[0].disposition,'CONFLICT_REQUIRES_REVIEW');assert.equal(out.promotions.length,0);assert.deepEqual(out.decisions[0].normalizedValue,real.value);assert.deepEqual(out.decisions[0].sourceUrls,sourceUrls);
 }
});
