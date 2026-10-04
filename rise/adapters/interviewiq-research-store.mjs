import {createHash} from 'node:crypto';
import {assertResearchGrant,IIQ_JOB_BINDING} from './interviewiq-job-auth.mjs';
import {subjectKey,reserveResearchJobTransaction,readResearchControls,isReplayRoute,isPaidRoute} from './postgres-runtime.mjs';
import {evaluateInterviewiqResearchEligibility} from '../src/interviewiq-research-policy.mjs';

const HASH=/^[a-f0-9]{64}$(?![\s\S])/;
const unavailable=()=>{throw Error('interviewiq_research_store_unavailable');};
const sha=value=>createHash('sha256').update(value).digest('hex');
import {researchLinkCatalog,LINK_CATALOG_SHA} from './interviewiq-job-origin.mjs';
export {researchLinkCatalog} from './interviewiq-job-origin.mjs';
const RIGHTS_BODY_SHA='65b23dcd11d177be0fa5c5c04e37e43e6cd23d033e640ef027486274b965c6f1';


async function qualify(client) {
  const {rows:[role]}=await client.query(`SELECT current_user AS name,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication,
    pg_has_role(current_user,'rise_app_runtime','MEMBER') AS member FROM pg_roles WHERE rolname=current_user`);
  if(role?.name!=='rise_app_login'||!role.member||role.rolsuper||role.rolbypassrls||role.rolcreatedb||role.rolcreaterole||role.rolreplication)unavailable();
  const {rows:tables}=await client.query(`SELECT c.relname,c.relkind,c.relowner::regrole::text AS owner,
    c.relrowsecurity,c.relforcerowsecurity,n.nspowner::regrole::text AS schema_owner,
    has_table_privilege(current_user,c.oid,'SELECT') AS readable,has_table_privilege(current_user,c.oid,'INSERT') AS insertable,
    has_table_privilege(current_user,c.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS mutable
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='rise_runtime' AND c.relname IN ('iiq_research_job_links','iiq_research_link_migrations')`);
  if(tables.length!==2||tables.some(t=>t.relkind!=='r'||t.owner!=='postgres'||t.schema_owner!=='postgres'||!t.relrowsecurity||!t.relforcerowsecurity||t.mutable||
    t.readable!==(t.relname==='iiq_research_job_links')||t.insertable!==(t.relname==='iiq_research_job_links')))unavailable();
  if(sha(JSON.stringify(await researchLinkCatalog(client)))!==LINK_CATALOG_SHA)unavailable();
  const {rows:[fn]}=await client.query(`SELECT p.proowner::regrole::text AS owner,p.prosecdef,p.provolatile,p.proconfig,p.prosrc,
    (SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END,
      'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantee::regrole::text)
      FROM aclexplode(p.proacl) a WHERE a.grantee<>p.proowner) AS acl
    FROM pg_proc p WHERE p.oid=to_regprocedure('rise_runtime.iiq_lock_research_rights(text,text,text[])')`);
  if(!fn||fn.owner!=='postgres'||!fn.prosecdef||fn.provolatile!=='v'||JSON.stringify(fn.proconfig)!=='["search_path=pg_catalog"]'||sha(fn.prosrc)!==RIGHTS_BODY_SHA||
    fn.acl?.length!==1||fn.acl[0].grantee!=='rise_app_runtime'||fn.acl[0].privilege!=='EXECUTE'||fn.acl[0].grantable!==false)unavailable();
}

// Default-off, unmounted; caller must separately qualify TLS and live lineage.
// Provider/worker activation is NOT authorized by creating this capability.
export function createInterviewiqResearchAcceptance({enabled=false,registryIndex,registrySha256,authorizationSha256s,subjectHmacKey}={}, {pool}={}) {
  if(enabled!==true)return Object.freeze({acceptJob:async()=>unavailable()});
  const key=typeof subjectHmacKey==='string'?subjectHmacKey.trim():'';
  if(key.length<32||typeof pool?.connect!=='function'||!HASH.test(registrySha256??'')||
    !Array.isArray(authorizationSha256s)||!authorizationSha256s.length||authorizationSha256s.length>32||
    authorizationSha256s.some(h=>typeof h!=='string'||!HASH.test(h))||new Set(authorizationSha256s).size!==authorizationSha256s.length||
    typeof registryIndex?.registryReleaseId!=='string'||!Array.isArray(registryIndex.programs))unavailable();
  // Capture trusted startup configuration, never a mutable caller's later edit.
  const registry=structuredClone(registryIndex),rights=[...authorizationSha256s];
  async function transaction(subject,owner,proof,work) {
    const deadline=performance.now()+5000;let client,expired=false,broken=false;
    const remaining=()=>{const ms=Math.floor(deadline-performance.now());if(expired||ms<1){expired=true;unavailable();}return ms;};
    async function bounded(run) {const ms=remaining();let timer;try{return await Promise.race([Promise.resolve().then(run),new Promise((_,reject)=>{
      timer=setTimeout(()=>{expired=true;reject(Error('interviewiq_research_store_unavailable'));},ms);
    })]);}finally{clearTimeout(timer);}}
    const query=(text,values)=>bounded(()=>client.query({text,values,query_timeout:remaining()}));
    try {
      client=await bounded(async()=>{const c=await pool.connect();if(expired||performance.now()>=deadline){c.release(true);unavailable();}return c;});
      await query('BEGIN');
      await query("SET LOCAL search_path=pg_catalog; SET LOCAL statement_timeout='3000'; SET LOCAL lock_timeout='1000'; SET LOCAL idle_in_transaction_session_timeout='5000'");
      await qualify({query});
      await query("SELECT set_config('rise.subject_key',$1,true),set_config('rise.iiq_owner_id',$2,true),set_config('rise.is_admin','true',true)",[subject,owner]);
      const checked={query:async(text,values)=>{proof.assertFresh();return query(text,values);}};
      const result=await work(checked);proof.assertFresh();remaining();
      await query('COMMIT');remaining();return result;
    } catch {
      if(client&&!expired)try{await query('ROLLBACK');}catch{broken=true;}
      unavailable();
    } finally {if(client)client.release(expired||broken);}
  }
  return Object.freeze({async acceptJob({ownerId,requestId,bodyHash,binding,proof}={}) {
    const principal=assertResearchGrant(proof,{binding,bodyHash,phase:'reserve'});
    if(ownerId!==binding.ownerId||requestId!==binding.requestId||binding.registryReleaseId!==registry.registryReleaseId)unavailable();
    // Only the authenticated, frozen snapshot may cross asynchronous boundaries.
    binding=proof.binding;bodyHash=proof.bodyHash;
    const candidates=registry.programs.filter(p=>p?.programSpecialtyId===binding.programId);if(candidates.length!==1)unavailable();
    const program=candidates[0],quotaKey=subjectKey(`wp:${principal.wpUserId}`,key);
    return transaction(quotaKey,ownerId,proof,async client=>{
      const {rows:[router]}=await client.query('SELECT primary_provider FROM rise_runtime.research_router_settings WHERE control_id=true FOR UPDATE');
      if(!router)unavailable();
      await client.query('SELECT provider_key FROM rise_runtime.research_provider_routes WHERE provider_key=$1 FOR UPDATE',[router.primary_provider]);
      const {rows:[right]}=await client.query('SELECT rise_runtime.iiq_lock_research_rights($1,$2,$3::text[]) AS current',[binding.registryReleaseId,registrySha256,rights]);
      if(right?.current!==true)unavailable();
      const {controls,providers}=await readResearchControls(client,{lock:true});
      const admission=evaluateInterviewiqResearchEligibility({program,controls,subjectHash:quotaKey,proof,binding,bodyHash});
      const provider=providers.find(p=>p.providerKey===controls.primaryProvider);
      if(!admission.eligible||!provider?.enabled||!(isReplayRoute(provider)||isPaidRoute(provider)))unavailable();
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`iiq-request:${ownerId}:${requestId}`]);
      const {rows:[link]}=await client.query(`SELECT request_id::text AS "requestId",demand_id::text AS "demandId",interview_id::text AS "interviewId",
        owner_id::text AS "ownerId",program_id AS "programId",release_id AS "registryReleaseId",request_sha256 AS "bodyHash",subject_key AS "subjectKey",job_id::text AS "jobId",disposition
        FROM rise_runtime.iiq_research_job_links WHERE owner_id=$1 AND request_id=$2`,[ownerId,requestId]);
      if(link) {
        if(!IIQ_JOB_BINDING.every(k=>link[k]===binding[k])||link.bodyHash!==bodyHash||link.subjectKey!==quotaKey)unavailable();
        if(link.disposition==='NO_OP')return {jobId:null,status:'NO_OP'};
        const {rows:[job]}=await client.query('SELECT job_id::text AS "jobId",status FROM rise_runtime.research_jobs WHERE job_id=$1',[link.jobId]);
        if(!job)unavailable();return job;
      }
      const result=await reserveResearchJobTransaction(client,{key:quotaKey,releaseId:binding.registryReleaseId,program,source:'STUDENT',
        eligibilityFor:({controls})=>evaluateInterviewiqResearchEligibility({program,controls,subjectHash:quotaKey,proof,binding,bodyHash}),
        jobProjection:row=>({jobId:row.jobId,status:row.status})});
      const outcome=result.noOp===true?{jobId:null,status:'NO_OP'}:result.job;
      if(!outcome||!(outcome.jobId||outcome.status==='NO_OP'))unavailable();
      if(outcome.jobId) {
        const {rows:[job]}=await client.query('SELECT release_id,program_specialty_id FROM rise_runtime.research_jobs WHERE job_id=$1',[outcome.jobId]);
        if(job?.release_id!==binding.registryReleaseId||job.program_specialty_id!==binding.programId)unavailable();
      }
      await client.query(`INSERT INTO rise_runtime.iiq_research_job_links(owner_id,request_id,demand_id,interview_id,program_id,release_id,request_sha256,subject_key,job_id,disposition,created_job)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[ownerId,requestId,binding.demandId,binding.interviewId,binding.programId,binding.registryReleaseId,bodyHash,quotaKey,outcome.jobId,outcome.jobId?'JOB':'NO_OP',result.quotaReserved===true]);
      return outcome;
    });
  }});
}
