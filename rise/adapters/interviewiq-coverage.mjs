import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {isIP} from 'node:net';
import {DEEP_RESEARCH_DOSSIER_V2} from '../src/research-router.mjs';
import {readInterviewiqProgramIdentity} from './interviewiq-program-identity.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=()=>new Error('interviewiq_coverage_unavailable');
const need=x=>{if(!x)throw fail();};
const plain=x=>x&&Object.getPrototypeOf(x)===Object.prototype;
const id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}(?![\s\S])/.test(x);
const fields=DEEP_RESEARCH_DOSSIER_V2.domains.flatMap(d=>d.fields.map(field=>({area:d.key,field}))).sort((a,b)=>a.field.localeCompare(b.field,'en'));
const states=['UNKNOWN','SUPPORTED','STALE','CONFLICTED','WEAK'];
const catalog=['canonical_evidence_claims','canonical_evidence_sources','canonical_program_identities','canonical_claim_promotion_lineage','evidence_claim_review_events'];
function contract(){need(DEEP_RESEARCH_DOSSIER_V2.contractVersion==='2.0.0'&&fields.length===21&&
  sha(readFileSync(new URL('../config/deep-research-dossier-v2.json',import.meta.url)))==='41eb42b243aa8919eef96f12a081f3822c37047668c2349f6087dfb9d0bf37aa');}
function timestamp(x){const t=typeof x==='string'?Date.parse(x):NaN;need(Number.isFinite(t)&&new Date(t).toISOString()===x);return t;}
export function publicResearchUrl(x){
  if(typeof x!=='string'||x.length>2048||/[\u0000-\u0020\u007f]/.test(x))return false;
  try{const u=new URL(x),host=u.hostname.replace(/^\[|\]$/g,'').toLowerCase();
    return u.protocol==='https:'&&!u.username&&!u.password&&!isIP(host)&&host.includes('.')&&!host.endsWith('.')&&(!u.port||u.port==='443')&&
      !/(^|\.)(localhost|localdomain|local|internal|private|home\.arpa|test|invalid|example|home|lan)$/.test(host);
  }catch{return false;}
}
// Reconstruct public primitives at the owner boundary; never spread a reader row.
export function projectInterviewiqCoverage(value,{programId,registryReleaseId,now=Date.now()}={}){
  contract();need(plain(value)&&id(programId)&&id(registryReleaseId)&&value.programId===programId&&value.registryReleaseId===registryReleaseId);
  const observed=timestamp(value.observedAt);need(Number.isSafeInteger(now)&&observed<=now&&now-observed<=300000);
  need(Array.isArray(value.fields)&&value.fields.length===fields.length);
  const seen=new Set();
  const rows=value.fields.map(row=>{
    need(plain(row)&&typeof row.area==='string'&&typeof row.field==='string'&&states.includes(row.state)&&
      fields.some(f=>f.field===row.field&&f.area===row.area)&&!seen.has(row.field));seen.add(row.field);
    return {area:row.area,field:row.field,state:row.state};
  }).sort((a,b)=>a.field.localeCompare(b.field,'en'));
  const body={programId,registryReleaseId,observedAt:value.observedAt,fields:rows};
  need(plain(value.receipt)&&value.receipt.publicRef==='rise-coverage-v1'&&typeof value.receipt.sha256==='string'&&value.receipt.sha256===sha(JSON.stringify(body)));
  return {...body,receipt:{sha256:value.receipt.sha256,publicRef:'rise-coverage-v1'}};
}

// Coverage never selects values. The separately enabled factual reader shares
// this exact selection snapshot and receives only bounded canonical fields.
// Current review is read directly with the same ordering as the owner view.
const evidenceSql=(withValues=false,verified=false)=>`WITH subjects AS (
  ${verified?'SELECT unnest($3::text[]) AS id WHERE $1::text IS NOT NULL':"SELECT $1::text AS id UNION SELECT program_identity_id FROM rise_runtime.canonical_program_identities WHERE program_specialty_id=$1 AND reconciliation_status='EXACT_ACGME_MATCH' AND exposure_state='PRIVATE_BETA'"}
), visible AS (
  SELECT c.claim_id,c.subject_id,c.field,c.knowledge->>'state' AS knowledge_state,c.retrieved_at,c.created_at,c.conflict_state,
    s.source_url,s.retrieved_at AS source_retrieved_at,s.provider,s.source_type,current_review.disposition AS review_disposition${withValues?`,CASE WHEN octet_length(c.canonical_value::text)<=16384 THEN c.canonical_value END AS canonical_value,c.observed_period,current_review.review_id,current_review.created_at AS reviewed_at`:''}
  FROM rise_runtime.canonical_evidence_claims c JOIN rise_runtime.canonical_evidence_sources s USING(source_id)
  LEFT JOIN LATERAL (SELECT disposition,review_id,created_at FROM rise_runtime.evidence_claim_review_events WHERE source_claim_id=c.claim_id
    ORDER BY created_at DESC,review_id DESC LIMIT 1) current_review ON true
  WHERE c.subject_id IN(SELECT id FROM subjects) AND c.field=ANY($2::text[]) AND c.review_state='APPROVED'
    AND c.publication_state IN('STUDENT_VISIBLE','PRIVATE_BETA') AND s.rights_state='APPROVED'
    AND s.exposure_state IN('STUDENT_VISIBLE','PRIVATE_BETA') AND s.provider<>'STUDENT_INTEL'
)
SELECT wanted.field,transaction_timestamp() AS observed_at,f.knowledge_state,f.retrieved_at,f.source_retrieved_at,
  f.source_url,f.provider,f.source_type,f.review_disposition${withValues?`,f.claim_id,f.canonical_value,f.observed_period,f.review_id,f.reviewed_at`:""},
  EXISTS(SELECT 1 FROM visible c WHERE c.field=wanted.field AND c.conflict_state='CONFLICTING'
    AND (c.review_disposition IS NULL OR c.review_disposition='CONFLICT_REQUIRES_REVIEW')
    AND c.retrieved_at>=coalesce(f.retrieved_at,'-infinity'::timestamptz)) AS public_conflict,
  coalesce((SELECT jsonb_agg(jsonb_build_object(
    'identityValid',original.subject_id=f.subject_id AND original.field=f.field AND os.provider NOT IN('STUDENT_INTEL','MISSIONMED_REVIEW') AND os.source_type<>'canonical_review_promotion' AND os.rights_state<>'REJECTED' AND os.exposure_state<>'REJECTED',
    'approvalCurrent',review.review_id=l.review_id AND review.disposition='APPROVED_CURRENT',
    'disposition',CASE WHEN original.subject_id=f.subject_id AND original.field=f.field AND os.provider NOT IN('STUDENT_INTEL','MISSIONMED_REVIEW') AND os.source_type<>'canonical_review_promotion' AND os.rights_state<>'REJECTED' AND os.exposure_state<>'REJECTED' THEN review.disposition END,
    'retrievedAt',original.retrieved_at,'sourceRetrievedAt',os.retrieved_at${withValues?`, 'claimRef',original.claim_id,'reviewRef',review.review_id,'reviewedAt',review.created_at`:''},
    'urls',CASE WHEN original.subject_id=f.subject_id AND original.field=f.field AND os.provider NOT IN('STUDENT_INTEL','MISSIONMED_REVIEW') AND os.source_type<>'canonical_review_promotion' AND os.rights_state<>'REJECTED' AND os.exposure_state<>'REJECTED'
      AND review.review_id=l.review_id AND review.disposition='APPROVED_CURRENT'
      THEN (SELECT coalesce(jsonb_agg(u.value),'[]'::jsonb) FROM
        (SELECT value FROM jsonb_array_elements_text(review.source_urls) WITH ORDINALITY x(value,n) WHERE length(value)<=2048 ORDER BY n LIMIT 8) u)
      ELSE '[]'::jsonb END))
    FROM (SELECT source_claim_id,review_id FROM rise_runtime.canonical_claim_promotion_lineage WHERE promoted_claim_id=f.claim_id ORDER BY contributor_order LIMIT 201) l
    LEFT JOIN rise_runtime.canonical_evidence_claims original ON original.claim_id=l.source_claim_id
    LEFT JOIN rise_runtime.canonical_evidence_sources os ON os.source_id=original.source_id
    LEFT JOIN LATERAL (SELECT review_id,disposition,source_urls,created_at FROM rise_runtime.evidence_claim_review_events
      WHERE source_claim_id=l.source_claim_id ORDER BY created_at DESC,review_id DESC LIMIT 1) review ON true),'[]'::jsonb) AS lineage
FROM unnest($2::text[]) wanted(field)
LEFT JOIN LATERAL (SELECT * FROM visible v WHERE v.field=wanted.field AND v.conflict_state<>'CONFLICTING'
  ORDER BY v.retrieved_at DESC,v.created_at DESC,v.claim_id ASC LIMIT 1) f ON true
ORDER BY wanted.field COLLATE "C"`;

function state(row,observed){
  if(row.public_conflict===true)return 'CONFLICTED';
  if(row.knowledge_state!=='known')return 'UNKNOWN';
  if(row.review_disposition==='CONFLICT_REQUIRES_REVIEW')return 'CONFLICTED';
  if(['STALE_NEEDS_REFRESH','APPROVED_HISTORICAL'].includes(row.review_disposition))return 'STALE';
  if(row.review_disposition&&row.review_disposition!=='APPROVED_CURRENT')return 'WEAK';
  const dates=[row.retrieved_at,row.source_retrieved_at].map(x=>new Date(x).getTime());
  let supportedUrl=publicResearchUrl(row.source_url);
  if(row.provider==='MISSIONMED_REVIEW'||row.source_type==='canonical_review_promotion'){
    need(Array.isArray(row.lineage)&&row.lineage.length<=200);
    if(!row.lineage.length||row.lineage.some(x=>x.identityValid!==true))return 'WEAK';
    if(row.lineage.some(x=>x.disposition==='CONFLICT_REQUIRES_REVIEW'))return 'CONFLICTED';
    if(row.lineage.some(x=>['STALE_NEEDS_REFRESH','APPROVED_HISTORICAL'].includes(x.disposition)))return 'STALE';
    if(row.lineage.some(x=>x.approvalCurrent!==true))return 'WEAK';
    supportedUrl=row.lineage.every(x=>Array.isArray(x.urls)&&x.urls.length<=8&&x.urls.some(publicResearchUrl));
    for(const link of row.lineage)dates.push(Date.parse(link.retrievedAt),Date.parse(link.sourceRetrievedAt));
  }
  if(dates.some(t=>!Number.isFinite(t)||t>observed))return 'WEAK';
  if(Math.min(...dates)<observed-DEEP_RESEARCH_DOSSIER_V2.currentForDays*86400000)return 'STALE';
  return supportedUrl?'SUPPORTED':'WEAK';
}

// This capability owns no credentials and creates no pool. The runtime supplies
// its separately TLS/role-qualified pool. Internal admin RLS context is only for
// approved-public promotion lineage; the transaction cannot write any table.
export function createInterviewiqCoverageReader(config={}){return evidenceReader(config,false,coverage=>coverage);}
// Internal capability for the governed result projector. No remote caller can
// select this mode or supply the projection callback.
export function createInterviewiqEvidenceReader(config,projectRows){need(typeof projectRows==='function');return evidenceReader(config,true,projectRows);}
function evidenceReader({enabled=false,pool,registryIndex,registrySha256}={},withValues,projectRows){
  const registry=registryIndex===undefined?undefined:structuredClone(registryIndex);
  return async({programId,registryReleaseId}={})=>{
    need(enabled===true&&pool&&typeof pool.connect==='function'&&Number.isInteger(pool.options?.connectionTimeoutMillis)&&
      pool.options.connectionTimeoutMillis>0&&pool.options.connectionTimeoutMillis<=5000&&id(programId)&&id(registryReleaseId));
    contract();let client,timer,expired=false,discard=false,transaction=false;const deadline=Date.now()+5000;
    const check=()=>need(!expired&&Date.now()<deadline);
    const query=async(text,values)=>{check();let queryTimer;
      try{const r=await Promise.race([client.query({text,values,query_timeout:Math.max(1,deadline-Date.now())}),
        new Promise((_,reject)=>{queryTimer=setTimeout(()=>reject(fail()),Math.max(1,deadline-Date.now()));})]);check();return r;}
      finally{clearTimeout(queryTimer);}
    };
    try{
      return await Promise.race([new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(fail());},5000);}), (async()=>{
        const connected=await pool.connect();if(expired){connected.release(true);throw fail();}client=connected;check();
        await query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');transaction=true;
        await query("SET LOCAL statement_timeout='3s'; SET LOCAL lock_timeout='1s'; SET LOCAL ROLE rise_app_runtime; SET LOCAL search_path=pg_catalog; SET LOCAL rise.is_admin='true'");
        const {rows:[role]}=await query(`SELECT current_user AS role,session_user AS session,current_setting('server_version_num')::int/10000 AS major,
          (SELECT bool_or(rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication) FROM pg_roles WHERE rolname IN(current_user,session_user)) AS elevated`);
        need(role?.role==='rise_app_runtime'&&role.session==='rise_app_login'&&role.major===18&&role.elevated===false);
        const {rows:tables}=await query(`SELECT c.relname AS name,c.relkind AS kind,c.relowner::regrole::text AS owner,c.relrowsecurity AS rls,c.relforcerowsecurity AS forced
          FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rise_runtime' AND c.relname=ANY($1::text[])`,[catalog]);
        need(tables.length===catalog.length&&tables.every(t=>catalog.includes(t.name)&&t.kind==='r'&&t.owner==='postgres'&&t.rls&&t.forced));
        const identity=registry===undefined?undefined:await readInterviewiqProgramIdentity({query},{registryIndex:registry,registrySha256,programId,registryReleaseId},{required:false});
        const {rows}=await query(evidenceSql(withValues,identity!==undefined),[programId,fields.map(f=>f.field),...(identity?[identity.subjects]:[])]);
        need(rows.length===fields.length&&new Set(rows.map(r=>r.field)).size===fields.length);
        const observedAt=new Date(rows[0].observed_at).toISOString(),observed=timestamp(observedAt);
        const body={programId,registryReleaseId,observedAt,fields:fields.map(f=>{
          const row=rows.find(r=>r.field===f.field);need(row&&new Date(row.observed_at).toISOString()===observedAt);
          return {...f,state:state(row,observed)};
        })};
        const projected=projectInterviewiqCoverage({...body,receipt:{sha256:sha(JSON.stringify(body)),publicRef:'rise-coverage-v1'}},{programId,registryReleaseId});
        const result=projectRows(projected,rows);await query('COMMIT');transaction=false;return result;
      })()]);
    }catch{
      discard=true;
      if(client&&transaction&&!expired&&deadline>Date.now())try{await query('ROLLBACK');}catch{}
      throw fail();
    }finally{expired=true;clearTimeout(timer);if(client)try{client.release(discard);}catch{}}
  };
}
