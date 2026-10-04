import {createHash,randomUUID} from 'node:crypto';
import {assertResearchGrant,IIQ_JOB_BINDING,exactJobId} from './interviewiq-job-auth.mjs';
import {genericResearchOriginPredicates} from './interviewiq-job-origin.mjs';
import {subjectKey,readResearchControls,isPaidRoute,ingestProviderRecordTransaction,applyCorpusTransaction,completeJobTransaction} from './postgres-runtime.mjs';
import {evaluateInterviewiqResearchEligibility} from '../src/interviewiq-research-policy.mjs';
import {recoverOpenAiResearchResponse} from './openai-research-provider.mjs';
import {programDescriptor} from '../src/research-router.mjs';
import {reviewResearchCorpus} from '../src/research-review.mjs';
import {readInterviewiqProgramIdentity} from './interviewiq-program-identity.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),HASH=/^[a-f0-9]{64}$(?![\s\S])/;
const fail=(code='IIQ_EXECUTION_UNAVAILABLE')=>{throw Object.assign(Error('InterviewIQ research execution unavailable'),{code});};
export const EXECUTION_SCHEMA_SHA='1a75314d961e0a9738e7c77e21f8a2d60ddd23cebf77265d10785c04727272ed';
export async function executionCatalog(client){return (await client.query(`SELECT c.relname,c.relkind,c.relpersistence,c.relowner::regrole::text AS owner,c.relrowsecurity,c.relforcerowsecurity,n.nspowner::regrole::text AS schema_owner,
 (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'required',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'acl',a.attacl) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
 (SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END,'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantee::regrole::text COLLATE "C",a.privilege_type COLLATE "C") FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))a) AS acl,
 (SELECT jsonb_agg(jsonb_build_object('name',conname,'validated',convalidated,'definition',pg_get_constraintdef(oid)) ORDER BY conname COLLATE "C") FROM pg_constraint WHERE conrelid=c.oid) AS constraints,
 (SELECT jsonb_agg(pg_get_indexdef(indexrelid) ORDER BY indexrelid::regclass::text COLLATE "C") FROM pg_index WHERE indrelid=c.oid) AS indexes,
 (SELECT jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(SELECT jsonb_agg(r::regrole::text ORDER BY r::regrole::text COLLATE "C") FROM unnest(p.polroles)r),'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname COLLATE "C") FROM pg_policy p WHERE p.polrelid=c.oid) AS policies,
 (SELECT jsonb_agg(jsonb_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled,'function',pg_get_functiondef(p.oid),'owner',p.proowner::regrole::text,'acl',p.proacl) ORDER BY t.tgname COLLATE "C") FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid=c.oid AND NOT t.tgisinternal) AS triggers,
 (SELECT jsonb_agg(pg_get_ruledef(oid) ORDER BY rulename COLLATE "C") FROM pg_rewrite WHERE ev_class=c.oid) AS rules
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rise_runtime' AND c.relname='iiq_research_executions'`)).rows;}
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
const snapshot=j=>({jobId:j.job_id,programSpecialtyId:j.program_specialty_id,acgmeId:j.acgme_id,specialty:j.specialty,state:j.state_code,taskClass:j.task_class,providerKey:j.provider_key,modelKey:j.model_key,taskPayload:j.task_payload??{}});
function rawReceipt(row){return {rawBodyBase64:row.raw_body.toString('base64'),sha256:row.raw_sha256,httpStatus:row.http_status,providerKey:row.provider_key,modelKey:row.model_key,receivedAt:new Date(row.received_at).toISOString()};}

export function createInterviewiqResearchWorkerStore(config={}, {pool}={}) {
 if(config.enabled!==true)return Object.freeze({claim:async()=>fail()});
 const c=structuredClone(config),b=c.binding,models={OPENAI_TERRA:'gpt-5.6-terra',OPENAI_SOL:'gpt-5.6-sol'};
 if(!b||!IIQ_JOB_BINDING.every((k,i)=>i<4?exactJobId(b[k]):typeof b[k]==='string'&&/^[A-Za-z0-9._:-]{1,180}$(?![\s\S])/.test(b[k]))||!exactJobId(c.jobId)||
  !HASH.test(c.bodyHash??'')||!HASH.test(c.expectedSubjectKey??'')||!HASH.test(c.registrySha256??'')||typeof c.subjectHmacKey!=='string'||c.subjectHmacKey.length<32||
  typeof c.providerKey!=='string'||!Object.hasOwn(models,c.providerKey)||c.modelKey!==models[c.providerKey]||!Array.isArray(c.authorizationSha256s)||!c.authorizationSha256s.length||c.authorizationSha256s.length>32||c.authorizationSha256s.some(x=>!HASH.test(x))||
  c.registryIndex?.registryReleaseId!==b.registryReleaseId||!Array.isArray(c.registryIndex?.programs)||typeof pool?.connect!=='function')fail();
 const candidates=c.registryIndex.programs.filter(p=>p.programSpecialtyId===b.programId);if(candidates.length!==1)fail();const program=candidates[0],descriptor=programDescriptor(program);if(!descriptor.acgmeId||!descriptor.specialty||!descriptor.state)fail();freeze(c);
 const identityContext={registryIndex:c.registryIndex,registrySha256:c.registrySha256,programId:b.programId,registryReleaseId:b.registryReleaseId};
 const handles=new WeakSet();
 function proofCheck(proof,phase){const principal=assertResearchGrant(proof,{binding:b,bodyHash:c.bodyHash,phase});if(subjectKey(`wp:${principal.wpUserId}`,c.subjectHmacKey)!==c.expectedSubjectKey)fail();return principal;}
 function owned(h){if(!handles.has(h))fail('IIQ_EXECUTION_LEASE_LOST');}
 async function tx(work,{proof,phase,controls=false,onCommitAttempt}={}) {
  if(phase!==undefined)proofCheck(proof,phase);
  let client,broken=false;const deadline=performance.now()+5000;
  const fresh=()=>{if(performance.now()>=deadline)fail();if(phase!==undefined)proof.assertFresh();};
  try {
   let connectExpired=false,timer;
   try {client=await Promise.race([Promise.resolve().then(()=>pool.connect()).then(value=>{if(connectExpired){value.release(true);fail();}return value;}),new Promise((_,reject)=>{timer=setTimeout(()=>{connectExpired=true;reject(Object.assign(Error('InterviewIQ research execution unavailable'),{code:'IIQ_EXECUTION_UNAVAILABLE'}));},Math.max(1,deadline-performance.now()));})]);} finally {clearTimeout(timer);}
   fresh();
   const query=async(text,values)=>{fresh();const r=await client.query({text,values,query_timeout:Math.max(1,Math.floor(deadline-performance.now()))});fresh();return r;};
   const q={query};await query('BEGIN');await query("SET LOCAL search_path=pg_catalog; SET LOCAL statement_timeout='3000'; SET LOCAL lock_timeout='1000'; SET LOCAL idle_in_transaction_session_timeout='5000'");
   const {rows:[role]}=await query("SELECT current_user AS name,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication,pg_has_role(current_user,'rise_app_runtime','MEMBER') AS member FROM pg_roles WHERE rolname=current_user");
   if(role?.name!=='rise_app_login'||!role.member||role.rolsuper||role.rolbypassrls||role.rolcreaterole||role.rolcreatedb||role.rolreplication)fail();
   if(sha(JSON.stringify(await executionCatalog(q)))!==EXECUTION_SCHEMA_SHA)fail('IIQ_EXECUTION_SCHEMA_DRIFT');
   await genericResearchOriginPredicates(q);
  const {rows:[fn]}=await query(`SELECT p.proowner::regrole::text AS owner,p.prosecdef,p.provolatile,p.proconfig,p.prosrc,
    (SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END,
      'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantee::regrole::text)
      FROM aclexplode(p.proacl) a WHERE a.grantee<>p.proowner) AS acl
    FROM pg_proc p WHERE p.oid=to_regprocedure('rise_runtime.iiq_lock_research_rights(text,text,text[])')`);
  if(!fn||fn.owner!=='postgres'||!fn.prosecdef||fn.provolatile!=='v'||JSON.stringify(fn.proconfig)!=='["search_path=pg_catalog"]'||sha(fn.prosrc)!=='65b23dcd11d177be0fa5c5c04e37e43e6cd23d033e640ef027486274b965c6f1'||
    fn.acl?.length!==1||fn.acl[0].grantee!=='rise_app_runtime'||fn.acl[0].privilege!=='EXECUTE'||fn.acl[0].grantable!==false)fail('IIQ_EXECUTION_RIGHTS_SCHEMA_DRIFT');
   await query("SELECT set_config('rise.subject_key',$1,true),set_config('rise.iiq_owner_id',$2,true),set_config('rise.iiq_job_id',$3,true),set_config('rise.is_admin','true',true)",[c.expectedSubjectKey,b.ownerId,c.jobId]);
   let current;
   if(controls) {
    await query('SELECT control_id FROM rise_runtime.research_router_settings WHERE control_id=true FOR UPDATE');
    await query('SELECT provider_key FROM rise_runtime.research_provider_routes WHERE provider_key=$1 FOR UPDATE',[c.providerKey]);
    const {rows:[rights]}=await query('SELECT rise_runtime.iiq_lock_research_rights($1,$2,$3::text[]) AS current',[b.registryReleaseId,c.registrySha256,c.authorizationSha256s]);if(rights?.current!==true)fail('IIQ_EXECUTION_RIGHTS_REVOKED');
    current=await readResearchControls(q);const route=current.providers.find(p=>p.providerKey===c.providerKey),ctl=current.controls;
    if(!route||!isPaidRoute(route)||route.modelKey!==c.modelKey||ctl.primaryProvider!==c.providerKey||!ctl.globalEnabled||!ctl.studentEnabled||ctl.emergencyKillSwitch||ctl.actualSpendUsd+ctl.reservedSpendUsd>ctl.budgetCapUsd||route.actualSpendUsd+route.reservedSpendUsd>route.budgetCapUsd)fail('IIQ_EXECUTION_PAUSED');
    // Test envelope cannot become broad activation merely by omitting an allowlist.
    if(ctl.subjectAllowlistHashes.length!==1||ctl.subjectAllowlistHashes[0]!==c.expectedSubjectKey||ctl.canaryMode!=='PROGRAM_ID_ALLOWLIST'||ctl.canaryProgramIds.length!==1||ctl.canaryProgramIds[0]!==descriptor.acgmeId)fail('IIQ_EXECUTION_ENVELOPE_CHANGED');
    if(phase!==undefined&&!evaluateInterviewiqResearchEligibility({program,controls:ctl,subjectHash:c.expectedSubjectKey,proof,binding:b,bodyHash:c.bodyHash,phase}).eligible)fail('IIQ_EXECUTION_INELIGIBLE');
   }
   const result=await work(q,current);fresh();onCommitAttempt?.();await query('COMMIT');return result;
  } catch(error){if(client)try{await client.query('ROLLBACK');}catch{broken=true;}broken=true;throw error?.code?.startsWith('IIQ_')?error:Object.assign(Error('InterviewIQ research execution unavailable'),{code:'IIQ_EXECUTION_UNAVAILABLE'});
  } finally {client?.release(broken);}
 }
 async function locked(q){
  const {rows:[link]}=await q.query('SELECT * FROM rise_runtime.iiq_research_job_links WHERE owner_id=$1 AND request_id=$2',[b.ownerId,b.requestId]);
  if(!link||link.created_job!==true||link.job_id!==c.jobId||link.subject_key!==c.expectedSubjectKey||link.request_sha256!==c.bodyHash||link.demand_id!==b.demandId||link.interview_id!==b.interviewId||link.program_id!==b.programId||link.release_id!==b.registryReleaseId)fail();
  const {rows:[job]}=await q.query('SELECT * FROM rise_runtime.research_jobs WHERE job_id=$1 FOR UPDATE',[c.jobId]);
  if(!job||job.requester_subject_key!==c.expectedSubjectKey||job.program_specialty_id!==b.programId||job.release_id!==b.registryReleaseId||job.provider_key!==c.providerKey||job.model_key!==c.modelKey||job.task_class!=='PROGRAM_DEEP_RESEARCH'||job.parent_job_id!==null||job.acgme_id!==descriptor.acgmeId||job.specialty!==descriptor.specialty||job.state_code!==descriptor.state)fail();
  const {rows:[execution]}=await q.query('SELECT * FROM rise_runtime.iiq_research_executions WHERE job_id=$1 FOR UPDATE',[c.jobId]);
  return {job,execution};
 }
 const valid=(h,j,e)=>{owned(h);if(!e||e.lease_token!==h.leaseToken||Number(e.lease_fence)!==h.fence||e.worker_id!==h.workerId||j.lease_token!==h.leaseToken||j.worker_id!==h.workerId||new Date(e.lease_until)<=new Date()||new Date(j.lease_expires_at)<=new Date()||!['RUNNING','NORMALIZING','PROMOTING'].includes(j.status))fail('IIQ_EXECUTION_LEASE_LOST');};
 return Object.freeze({
  async claim({proof,workerId}={}) {
   if(typeof workerId!=='string'||workerId.length<1||workerId.length>128)fail();
   const result=await tx(async(q,current)=>{
    const {job,execution:e}=await locked(q);
    if(e?.state==='COMPLETED')return {mode:'COMPLETED',receipt:e.completion_receipt};
    if(e&&new Date(e.lease_until)>new Date())return {mode:'BUSY'};
    if(e&&!e.raw_body){await q.query("UPDATE rise_runtime.iiq_research_executions SET state='QUARANTINED',error_code='RECONCILIATION_REQUIRED',updated_at=clock_timestamp() WHERE job_id=$1",[c.jobId]);return {mode:'RECONCILIATION_REQUIRED'};}
    if(!e&&job.status!=='QUEUED'||e&&!['RUNNING','NORMALIZING','PROMOTING'].includes(job.status))fail();
    const {rows:[active]}=await q.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE provider_key=$1)::int AS provider FROM rise_runtime.research_jobs WHERE status IN ('LEASED','RUNNING','NORMALIZING','PROMOTING') AND lease_expires_at>now()",[c.providerKey]);
    const route=current.providers.find(p=>p.providerKey===c.providerKey);if(active.total>=current.controls.concurrencyCap||active.provider>=route.concurrencyCap)return {mode:'BUSY'};
    await readInterviewiqProgramIdentity(q,identityContext,{lock:true});
    const leaseToken=randomUUID(),dispatchId=e?.dispatch_id??randomUUID(),fence=e?Number(e.lease_fence)+1:1,jobSnapshot=e?.job_snapshot??snapshot(job);
    await q.query("UPDATE rise_runtime.research_jobs SET status='RUNNING',worker_id=$2,lease_token=$3,lease_expires_at=now()+interval '180 seconds',heartbeat_at=now(),attempt_count=attempt_count+$4,updated_at=now() WHERE job_id=$1",[c.jobId,workerId,leaseToken,e?0:1]);
    if(e)await q.query("UPDATE rise_runtime.iiq_research_executions SET worker_id=$2,lease_token=$3,lease_fence=$4,lease_until=now()+interval '180 seconds',state='RAW_CAPTURED',error_code=NULL,updated_at=clock_timestamp() WHERE job_id=$1",[c.jobId,workerId,leaseToken,fence]);
    else await q.query(`INSERT INTO rise_runtime.iiq_research_executions(job_id,owner_id,request_id,subject_key,binding,request_sha256,provider_key,model_key,job_snapshot,snapshot_sha256,dispatch_id,worker_id,lease_token,lease_until,state) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9::jsonb,encode(sha256(convert_to(($9::jsonb)::text,'UTF8')),'hex'),$10,$11,$12,now()+interval '180 seconds','DISPATCHED')`,[c.jobId,b.ownerId,b.requestId,c.expectedSubjectKey,JSON.stringify(b),c.bodyHash,c.providerKey,c.modelKey,JSON.stringify(jobSnapshot),dispatchId,workerId,leaseToken]);
    return {mode:e?'RECOVER':'SEND',job:jobSnapshot,leaseToken,dispatchId,fence,workerId};
   },{proof,phase:'start',controls:true});
   freeze(result);if(['SEND','RECOVER'].includes(result.mode))handles.add(result);return result;
  },
  async heartbeat(h){owned(h);return tx(async q=>{const {job,execution}=await locked(q);valid(h,job,execution);await q.query("UPDATE rise_runtime.research_jobs SET lease_expires_at=now()+interval '180 seconds',heartbeat_at=now(),updated_at=now() WHERE job_id=$1",[c.jobId]);await q.query("UPDATE rise_runtime.iiq_research_executions SET lease_until=now()+interval '180 seconds',updated_at=clock_timestamp() WHERE job_id=$1",[c.jobId]);return true;},{controls:true});},
  async captureRaw(h,record){owned(h);const r=structuredClone(record);if(r?.providerKey!==c.providerKey||r.modelKey!==c.modelKey||typeof r.rawBodyBase64!=='string'||r.rawBodyBase64.length>11184812||typeof r.sha256!=='string'||!HASH.test(r.sha256)||!Number.isInteger(r.httpStatus)||r.httpStatus<100||r.httpStatus>599||typeof r.receivedAt!=='string'||!Number.isFinite(Date.parse(r.receivedAt))||new Date(r.receivedAt).toISOString()!==r.receivedAt)fail();const raw=Buffer.from(r.rawBodyBase64,'base64');if(!raw.length||raw.length>8388608||raw.toString('base64')!==r.rawBodyBase64||sha(raw)!==r.sha256)fail();return tx(async q=>{const {execution:e}=await locked(q);if(e?.dispatch_id!==h.dispatchId)fail();if(e.raw_body){if(!e.raw_body.equals(raw)||e.raw_sha256!==r.sha256||e.http_status!==r.httpStatus||new Date(e.received_at).toISOString()!==r.receivedAt)fail('IIQ_EXECUTION_RAW_CONFLICT');return true;}if(e.state==='COMPLETED')fail();await q.query("UPDATE rise_runtime.iiq_research_executions SET raw_body=$2,raw_sha256=$3,http_status=$4,received_at=$5,state='RAW_CAPTURED',updated_at=clock_timestamp() WHERE job_id=$1",[c.jobId,raw,r.sha256,r.httpStatus,r.receivedAt]);return true;});},
  async quarantine(h,{code='RECONCILIATION_REQUIRED'}={}){owned(h);if(!/^[A-Z0-9_]{1,64}$/.test(code))fail();return tx(async q=>{const {execution:e}=await locked(q);if(e?.state==='COMPLETED')return e.completion_receipt;if(!e||e.lease_token!==h.leaseToken||Number(e.lease_fence)!==h.fence)fail('IIQ_EXECUTION_LEASE_LOST');await q.query("UPDATE rise_runtime.iiq_research_executions SET state='QUARANTINED',error_code=$2,updated_at=clock_timestamp() WHERE job_id=$1",[c.jobId,e.raw_body?code:'RECONCILIATION_REQUIRED']);return {mode:'RECONCILIATION_REQUIRED'};});},
  async complete(h,{proof}={}){owned(h);let commitAttempted=false;try{return await tx(async q=>{const {job,execution:e}=await locked(q);if(e?.state==='COMPLETED')return e.completion_receipt;valid(h,job,e);if(e.state!=='RAW_CAPTURED'||!e.raw_body)fail();const result=recoverOpenAiResearchResponse({job:e.job_snapshot,providerKey:c.providerKey,receipt:rawReceipt(e)});
   const identity=await readInterviewiqProgramIdentity(q,identityContext,{lock:true});if(identity.acgmeId!==result.acgmeId)fail('IIQ_EXECUTION_IDENTITY_CHANGED');
   const ingested=await ingestProviderRecordTransaction(q,{ingest:result.ingest});const review=reviewResearchCorpus([result.ingest],{resolvedAcgmeIds:new Set([result.acgmeId]),allowedCanaryAcgmeIds:new Set([result.acgmeId])});
   const reviewed=await applyCorpusTransaction(q,{review,actorSubject:'IIQ-1204',reviewedAt:result.researchTimestamp,ticket:'IIQ-1204',promotionSourceId:'rise_src_iiq_1204_review'});
   // Verify the existing ingest/promotion engine kept the qualified canonical
   // subject. Claims and relationship IDs are never rewritten by this adapter.
   const {rows:published}=await q.query(`SELECT c.claim_id,c.subject_id FROM rise_runtime.canonical_evidence_claims c
    WHERE c.claim_id=ANY($1::text[]) OR c.claim_id IN(SELECT promoted_claim_id FROM rise_runtime.canonical_claim_promotion_lineage WHERE source_claim_id=ANY($1::text[]))`,[result.ingest.claims.map(x=>x.id)]);
   if(published.some(x=>x.subject_id!==identity.canonicalSubjectId)||result.ingest.claims.some(x=>!published.some(y=>y.claim_id===x.id)))fail('IIQ_EXECUTION_IDENTITY_CHANGED');
   const currentIdentity=await readInterviewiqProgramIdentity(q,identityContext,{lock:true});if(currentIdentity.canonicalSubjectId!==identity.canonicalSubjectId)fail('IIQ_EXECUTION_IDENTITY_CHANGED');
   const status=review.promotions.length?(result.dossierOutcome==='DEEP'?'COMPLETED':'PARTIAL'):'NEEDS_REVIEW';const receipt={jobId:c.jobId,status,providerResponseId:result.providerResponseId,rawSha256:e.raw_sha256,ingestRunId:ingested.ingestRunId,review:reviewed,usage:result.usage,webSearchCalls:result.webSearchCalls,estimatedCostUsd:result.actualCostUsd,costBasis:'configured_estimate'};
   await completeJobTransaction(q,{jobId:c.jobId,leaseToken:h.leaseToken,workerId:h.workerId,status,canonicalIngestRunId:ingested.ingestRunId,actualCostUsd:result.actualCostUsd,usage:result.usage,providerResponseId:result.providerResponseId,resultSummary:receipt,dossier:{completionMatrix:result.completionMatrix,completionScore:result.completionScore,dossierOutcome:result.dossierOutcome,researchTimestamp:result.researchTimestamp,resultSchemaVersion:result.resultSchemaVersion}});
   await q.query("UPDATE rise_runtime.iiq_research_executions SET state='COMPLETED',completion_receipt=$2::jsonb,error_code=NULL,updated_at=clock_timestamp() WHERE job_id=$1",[c.jobId,JSON.stringify(receipt)]);return receipt;
  },{proof,phase:'publish',controls:true,onCommitAttempt:()=>{commitAttempted=true;}});
   } catch(error) {
    if(commitAttempted) {
     // Resolve only a durable receipt; never replay any publication/accounting
     // body merely because COMMIT acknowledgement was lost.
     const receipt=await tx(async q=>{const {rows:[e]}=await q.query("SELECT state,dispatch_id,completion_receipt FROM rise_runtime.iiq_research_executions WHERE job_id=$1",[c.jobId]);return e?.state==='COMPLETED'&&e.dispatch_id===h.dispatchId?e.completion_receipt:null;}).catch(()=>null);
     if(receipt)return receipt;
    }
    throw error;
   }
  },
 });
}
