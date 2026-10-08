import {createHash} from 'node:crypto';
import {createCanonicalEvidenceClaim} from '../src/evidence.mjs';
import {reviewResearchCorpus} from '../src/research-review.mjs';
import {ingestProviderRecordTransaction,applyCorpusTransaction} from './postgres-runtime.mjs';
import {readInterviewiqProgramIdentity} from './interviewiq-program-identity.mjs';
import {assertMRXGrant} from './interviewiq-mrx.mjs';
import {mrxNeed,mrxBinding,mrxPayload,mrxCanonical,mrxSha,MRX_RULE} from './interviewiq-mrx-contract.mjs';
const dbSha=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const dbId=(p,x)=>p+'_'+dbSha(x).slice(0,32);
// Existing owner validator supplies field schema/normalization. Its hostname
// classifier NEVER supplies MRX factual or source-rights authority: the frozen
// explicit human review is independently required at both service boundaries.
export function reviewedMRXCorpus(payload,{identity,publicationId,at,current=[]}){
 mrxPayload(payload,Date.parse(at));const claims=payload.claims.map(c=>({...createCanonicalEvidenceClaim({subjectId:identity.canonicalSubjectId,field:c.field,value:c.value,provider:'MRX_PUBLIC_RESEARCH',providerRunId:publicationId,sourceType:'mrx_governed_public_submission',sourceUrl:c.sources[0].url,sourceLocator:publicationId+'/'+c.id,retrievedAt:c.sources.map(s=>s.retrievedAt).sort()[0],observedPeriod:{kind:'as_of',label:c.asOf}}),sourceUrls:c.sources.map(s=>s.url),directSourceUrls:c.sources.map(s=>s.url)}));
 const checked=reviewResearchCorpus([{acgmeId:identity.acgmeId,claims}],{resolvedAcgmeIds:new Set([identity.acgmeId])});
 const bad=checked.decisions.find(d=>!['APPROVED_CURRENT','SUPERSEDED'].includes(d.disposition));mrxNeed(!bad);
 const conflicts=new Set();for(const c of claims){const incoming=claims.filter(x=>x.field===c.field);if(new Set(incoming.map(x=>mrxCanonical(x.value))).size>1||current.some(x=>x.field===c.field&&mrxCanonical(x.canonical_value)!==mrxCanonical(c.value)))conflicts.add(c.field);}
 const decisions=checked.decisions.map(d=>({...d,ruleVersion:MRX_RULE,reason:conflicts.has(d.field)?'mrx_conflicts_with_current_or_parallel_claim':'mrx_independent_public_fact_and_source_rights_review',disposition:conflicts.has(d.field)?'CONFLICT_REQUIRES_REVIEW':d.disposition}));
 const promotions=checked.promotions.map(p=>({...p,conflictState:conflicts.has(p.field)?'CONFLICTING':'RESOLVED'}));
 return {claims,review:{...checked,ruleVersion:MRX_RULE,decisions,promotions},status:conflicts.size?'conflicted':'published'};
}
export function createInterviewiqMRXStore({enabled=false,registryIndex,registrySha256,authorizationSha256s}={}, {pool,now=Date.now}={}){
 const registry=structuredClone(registryIndex),rights=authorizationSha256s&&[...authorizationSha256s];
 return {async apply({binding,payload,grant}){
  mrxNeed(enabled===true&&pool?.connect&&registry&&/^[a-f0-9]{64}$/.test(registrySha256||'')&&rights?.length);mrxBinding(binding);assertMRXGrant(grant,binding);
  const deadline=performance.now()+5000;let client,expired=false;const check=()=>{assertMRXGrant(grant,binding);mrxNeed(!expired&&performance.now()<deadline);};
  async function bounded(f){check();let timer;try{return await Promise.race([Promise.resolve().then(f),new Promise((_,rej)=>{timer=setTimeout(()=>{expired=true;rej(Error('mrx_store_unavailable'));},Math.max(1,deadline-performance.now()));})]);}finally{clearTimeout(timer);}}
  const query=(text,values)=>bounded(()=>client.query({text,values,query_timeout:Math.max(1,Math.floor(deadline-performance.now()))}));
  try{client=await bounded(async()=>{const c=await pool.connect();if(expired){c.release(true);throw Error('mrx_store_unavailable');}return c;});await query('BEGIN');await query("SET LOCAL search_path=pg_catalog; SET LOCAL statement_timeout='3000'; SET LOCAL lock_timeout='1000'; SET LOCAL idle_in_transaction_session_timeout='5000'; SET LOCAL ROLE rise_app_runtime; SET LOCAL rise.is_admin='true'");
   const {rows:[role]}=await query(`SELECT current_user AS role,session_user AS login,(SELECT bool_or(rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication) FROM pg_roles WHERE rolname IN(current_user,session_user)) AS elevated`);mrxNeed(role?.role==='rise_app_runtime'&&role.login==='rise_app_login'&&role.elevated===false);
   const {rows:tables}=await query(`SELECT c.relname,c.relowner::regrole::text AS owner,c.relrowsecurity,c.relforcerowsecurity,has_table_privilege(current_user,c.oid,'UPDATE,DELETE,TRUNCATE,TRIGGER') AS mutable FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rise_runtime' AND c.relname=ANY($1)`,[['iiq_mrx_publications','iiq_mrx_operations','iiq_mrx_claim_links']]);mrxNeed(tables.length===3&&tables.every(t=>t.owner==='postgres'&&t.relrowsecurity&&t.relforcerowsecurity&&!t.mutable));
   await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['iiq-mrx:'+binding.programId]);
   const fingerprint=mrxSha(mrxCanonical({binding,payload})),{rows:[prior]}=await query('SELECT * FROM rise_runtime.iiq_mrx_operations WHERE idempotency_key=$1',[binding.idempotencyKey]);
   if(prior){mrxNeed(prior.request_sha256===fingerprint);await query('COMMIT');return {status:prior.status,claims:prior.claims};}
   const {rows:[removed]}=await query("SELECT * FROM rise_runtime.iiq_mrx_operations WHERE publication_id=$1 AND operation='retract'",[binding.publicationId]);
   if(binding.operation==='publish'&&removed){await query('COMMIT');return {status:'retracted',claims:removed.claims};}
   const {rows:[publication]}=await query('SELECT * FROM rise_runtime.iiq_mrx_publications WHERE publication_id=$1',[binding.publicationId]);let result;
   if(binding.operation==='retract'){
    if(publication)mrxNeed(publication.payload_sha256===binding.priorReceiptSha256&&publication.submission_sha256===binding.submissionSha256&&publication.program_id===binding.programId&&publication.registry_release_id===binding.registryReleaseId&&publication.binding.reviewId===binding.reviewId&&publication.binding.reviewVersion===binding.reviewVersion&&publication.binding.consentId===binding.consentId&&publication.binding.adminId===binding.adminId);
    const {rows:links}=await query('SELECT claim_id,source_claim_id FROM rise_runtime.iiq_mrx_claim_links WHERE publication_id=$1',[binding.publicationId]);
    const ids=[...new Set(links.flatMap(x=>[x.claim_id,x.source_claim_id]))],{rows:reviews}=await query('SELECT * FROM rise_runtime.evidence_claim_review_current WHERE source_claim_id=ANY($1::text[])',[ids]);
    const at=new Date(now()).toISOString();const decisions=ids.map(id=>({claimId:id,disposition:'SUPERSEDED',reason:'mrx_contribution_consent_or_review_withdrawn',ruleVersion:MRX_RULE,normalizedValue:null,sourceUrls:[],qualityScore:0,overridesReviewId:reviews.find(r=>r.source_claim_id===id)?.review_id||null}));
    await applyCorpusTransaction({query},{review:{ruleVersion:MRX_RULE,decisions,promotions:[]},actorSubject:'MRX removal '+binding.intentId,reviewedAt:at,ticket:'MRX removal '+binding.publicationId,promotionSourceId:dbId('rise_src','mrx-retract:'+binding.publicationId)});
    result={status:'retracted',claims:links.map(l=>({claimRef:l.claim_id,sourceClaimRef:l.source_claim_id}))};
   }else{
    mrxPayload(payload,now());mrxNeed(!publication&&binding.registryReleaseId===registry.registryReleaseId&&mrxSha(mrxCanonical(payload))===binding.payloadSha256);
    const {rows:[right]}=await query('SELECT rise_runtime.iiq_lock_research_rights($1,$2,$3::text[]) AS current',[binding.registryReleaseId,registrySha256,rights]);mrxNeed(right?.current===true);
    const identity=await readInterviewiqProgramIdentity({query},{registryIndex:registry,registrySha256,programId:binding.programId,registryReleaseId:binding.registryReleaseId},{lock:true});
    const {rows:current}=await query('SELECT field,canonical_value FROM rise_runtime.canonical_current_facts WHERE subject_id=ANY($1::text[]) AND field=ANY($2::text[])',[identity.subjects,payload.claims.map(c=>c.field)]);
    const at=new Date(now()).toISOString(),built=reviewedMRXCorpus(payload,{identity,publicationId:binding.publicationId,at,current}),ticket='MRX-'+binding.publicationId;
    await ingestProviderRecordTransaction({query},{ingest:{provider:'MRX_PUBLIC_RESEARCH',providerRunId:binding.publicationId,campaignId:ticket,acgmeId:identity.acgmeId,idempotencyKey:binding.idempotencyKey,sourceFile:ticket,sourceFileSha256:binding.submissionSha256,stagedAt:at,newSpendUsd:0,claims:built.claims,mrxAttribution:{payloadSha256:binding.payloadSha256,review:payload.review,claims:payload.claims.map(c=>({id:c.id,field:c.field,text:c.text,sources:c.sources}))}}});
    await applyCorpusTransaction({query},{review:built.review,actorSubject:'MRX independent admin '+binding.adminId,reviewedAt:at,ticket,promotionSourceId:dbId('rise_src','mrx-review:'+binding.publicationId)});
    await query('INSERT INTO rise_runtime.iiq_mrx_publications(publication_id,submission_sha256,payload_sha256,program_id,registry_release_id,binding) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[binding.publicationId,binding.submissionSha256,binding.payloadSha256,binding.programId,binding.registryReleaseId,mrxCanonical(binding)]);
    const refs=[];for(const p of built.review.promotions){const claimId=dbId('rise_claim',`${ticket}:${identity.canonicalSubjectId}:${p.field}:${dbSha(p.canonicalValue)}`);for(const sourceClaimId of p.sourceClaimIds){await query('INSERT INTO rise_runtime.iiq_mrx_claim_links(publication_id,claim_id,source_claim_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[binding.publicationId,claimId,sourceClaimId]);refs.push({field:p.field,claimRef:claimId,sourceClaimRef:sourceClaimId,disposition:p.conflictState==='CONFLICTING'?'CONFLICT_REQUIRES_REVIEW':'APPROVED_CURRENT'});}}
    result={status:built.status,claims:refs};
   }
   await query('INSERT INTO rise_runtime.iiq_mrx_operations(idempotency_key,publication_id,operation,request_sha256,status,claims) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[binding.idempotencyKey,binding.publicationId,binding.operation,fingerprint,result.status,mrxCanonical(result.claims)]);check();await query('COMMIT');return result;
  }catch{if(client&&!expired)try{await query('ROLLBACK');}catch{expired=true;}throw Error('mrx_store_unavailable');}finally{if(client)client.release(expired);}
 }};
}
