import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {qualifyLocalHarness,prerequisiteCatalog,catalogHash} from './migrate-interviewiq-owner.mjs';

export const MIGRATION='20261004063954_iiq_1204_rise_current_rights.sql';
const SQL_SHA='2bbc71cfe9dacc840d4f6288119b620223ab523cd78de5cb41d83cabfb841fa9';
const SQL_PATH=fileURLToPath(new URL('../sql/'+MIGRATION,import.meta.url));
const RELEASE='rise_registry_acgme_2026-09-20_50d08ea6f2da';
const OLD='rise_rights_safe_beta_20260828_460f459a0359';
const BEFORE='01f9d1b43b912d84cf4d9e4213d5baf9291c0f36bb7e6509f8e23a01dc4080bc';
// Read-only production catalog capture; excludes only the three deliberately
// expanded checks. Never learn a new baseline from the target being mutated.
const TARGET_CATALOG='f01bf07f19452c1638fff1c1481964b1f7e07968583f082357a243eecb6cdd90';
const GRANT='a1996b428eed63ad52313f0a11a507d06dc1d9c75e53db5723d3f4a8e52fb398';
const PINS=Object.freeze({
  'api-index.json':'6d1f8aa306012f7eea1f7c7a0af4f04be3d60f2c435d297a584a25e98923f989',
  'index-manifest.json':'ebb01f3cf91694320b65595ed761eea63e7eb55ab245f2173845e1dada20e3ba',
  'activation-receipt.json':'a3cb698a0365b1dde529cf988953bda226e67a96018ff6177dc060efd67a6da7',
  'freida-source-authorization.json':'274a40ec17e34402ee3e73dda81271dc03482659a971fa08f46cfc8bfbdc23bf',
});
const CHANGES=['registry_releases_projection_check','registry_releases_projection_check1','release_source_rights_authorization_basis_check'];
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=()=>{throw new Error('interviewiq_registration_denied');};
const requireValue=x=>{if(!x)fail();};
const query=(c,text,values)=>c.query({text,values,query_timeout:15000});

function pinnedFile(filename,hash,maximum=400000000){
  requireValue(typeof filename==='string'&&path.isAbsolute(filename));
  const s=fs.lstatSync(filename),parent=fs.lstatSync(path.dirname(filename));
  requireValue(s.isFile()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&s.size>0&&s.size<=maximum&&parent.isDirectory()&&!parent.isSymbolicLink());
  const bytes=fs.readFileSync(filename);requireValue(sha(bytes)===hash);return bytes;
}
export function qualifyRegistrationBundle({bundleDirectory,grantPath}={}){
  const docs={};
  for(const [name,hash] of Object.entries(PINS))docs[name]=JSON.parse(pinnedFile(path.join(bundleDirectory,name),hash).toString('utf8'));
  pinnedFile(grantPath,GRANT,10000000);
  const index=docs['api-index.json'],manifest=docs['index-manifest.json'],receipt=docs['activation-receipt.json'],authorization=docs['freida-source-authorization.json'];
  requireValue(index.registryReleaseId===RELEASE&&manifest.registryReleaseId===RELEASE&&manifest.immutable===true&&manifest.programCount===6245&&
    manifest.selectedFieldCount===72&&manifest.apiIndexSha256===PINS['api-index.json']&&manifest.sourceRightsApproved===true&&
    Array.isArray(index.programs)&&index.programs.length===6245&&new Set(index.programs.map(p=>p.programSpecialtyId)).size===6245&&
    index.programs.every(p=>typeof p.programSpecialtyId==='string'&&p.programSpecialtyId.length>0));
  requireValue(receipt.registryReleaseId===RELEASE&&receipt.apiIndexSha256===PINS['api-index.json']&&receipt.indexManifestSha256===PINS['index-manifest.json']&&
    receipt.action==='activate'&&receipt.revoked===false&&receipt.immutable===true&&receipt.decisionRecordId==='DR-305');
  requireValue(authorization.status==='approved'&&authorization.provider==='AMA'&&authorization.product==='FREIDA'&&authorization.sourceOwnerGrantSha256===GRANT&&
    authorization.projection==='all_fields'&&Array.isArray(authorization.excluded)&&authorization.excluded.length===0&&
    authorization.allowedUses?.includes('create_or_supplement_missionmed_rise_database')&&
    Date.parse(authorization.effectiveFrom)<=Date.now()&&Date.parse(authorization.validThrough)>Date.now()&&
    authorization.missionMedReview?.decision==='approved'&&authorization.missionMedReview.decisionRecordId==='P1-RISE-5009-FREIDA-COMMERCIAL-GRANT');
  requireValue(index.releaseGate?.sourceRightsApproved===true&&catalogHash(index.releaseGate.sourceRights)===catalogHash(manifest.sourceRights)&&
    manifest.sourceRights.length===1&&manifest.sourceRights[0].sha256===PINS['freida-source-authorization.json']&&
    manifest.sourceRights[0].sourceOwnerGrantSha256===GRANT&&manifest.sourceRights[0].source==='FREIDA'&&manifest.sourceRights[0].status==='approved');
  return Object.freeze({bundleSha256:catalogHash({...PINS,grant:GRANT}),registryReleaseId:RELEASE,manifestProgramCount:6245,rightsBlockedFieldCount:0});
}

export async function registrationState(client){
  return (await query(client,`SELECT jsonb_build_object(
    'releases',(SELECT jsonb_agg(to_jsonb(r) ORDER BY release_id COLLATE "C") FROM rise_runtime.registry_releases r),
    'rights',(SELECT jsonb_agg(to_jsonb(r) ORDER BY release_id COLLATE "C",source COLLATE "C") FROM rise_runtime.release_source_rights r)) AS state`)).rows[0].state;
}
async function controls(client){
  const constraints=(await query(client,`SELECT c.relname AS relation,co.conname AS name,co.contype AS type,co.convalidated AS validated,pg_get_constraintdef(co.oid) AS definition
    FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE co.conname=ANY($1) AND n.nspname='rise_runtime' AND c.relname IN ('registry_releases','release_source_rights')
    ORDER BY co.conname COLLATE "C"`,[CHANGES])).rows;
  const index=(await query(client,`SELECT pg_get_indexdef(i.indexrelid) AS indexdef,i.indisvalid AS valid,i.indisready AS ready,i.indislive AS live,i.indisunique AS unique,
    i.indrelid='rise_runtime.registry_releases'::regclass AS correct_table
    FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='rise_runtime' AND c.relname='rise_runtime_one_active_release_idx'`)).rows;
  requireValue(index.length===1&&index[0].valid&&index[0].ready&&index[0].live&&index[0].unique&&index[0].correct_table&&
    index[0].indexdef==='CREATE UNIQUE INDEX rise_runtime_one_active_release_idx ON rise_runtime.registry_releases USING btree (active) WHERE (active = true)');
  return constraints;
}
async function targetCatalog(client){
  // A successful trigger/rule can mutate unrelated rows without changing the
  // registration projection. Reject such hooks before any DDL or row mutation.
  requireValue((await query(client,"SELECT count(*)::int AS n FROM pg_event_trigger WHERE evtenabled<>'D'")).rows[0].n===0);
  const rows=(await query(client,`SELECT c.relname AS name,c.relkind AS kind,c.relpersistence AS persistence,c.relowner::regrole::text AS owner,
    c.relrowsecurity AS rls,c.relforcerowsecurity AS forced,c.relacl::text AS acl,
    (SELECT count(*)::int FROM pg_trigger WHERE tgrelid=c.oid AND NOT tgisinternal) AS triggers,
    (SELECT count(*)::int FROM pg_rewrite WHERE ev_class=c.oid) AS rules,
    (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated) ORDER BY a.attnum)
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
    (SELECT jsonb_agg(jsonb_build_object('name',co.conname,'definition',pg_get_constraintdef(co.oid),'validated',co.convalidated) ORDER BY co.conname COLLATE "C") FROM pg_constraint co WHERE co.conrelid=c.oid AND NOT co.conname=ANY($1)) AS other_constraints,
    (SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY pg_get_indexdef(i.indexrelid) COLLATE "C") FROM pg_index i WHERE i.indrelid=c.oid) AS indexes,
    (SELECT jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(SELECT jsonb_agg(r::regrole::text ORDER BY r::regrole::text COLLATE "C") FROM unnest(p.polroles)r),'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname COLLATE "C") FROM pg_policy p WHERE p.polrelid=c.oid) AS policies
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rise_runtime' AND c.relname IN ('registry_releases','release_source_rights') ORDER BY c.relname COLLATE "C"`,[CHANGES])).rows;
  requireValue(rows.length===2&&rows.every(r=>r.kind==='r'&&r.persistence==='p'&&r.owner==='postgres'&&r.triggers===0&&r.rules===0&&
    r.rls===(r.name==='release_source_rights')&&r.forced===(r.name==='release_source_rights')));
  const specs={registry_releases:[['release_id','text'],['projection','text'],['api_index_sha256','character(64)'],['index_manifest_sha256','character(64)'],
    ['program_count','integer'],['rights_blocked_field_count','integer'],['active','boolean','false'],['created_at','timestamp with time zone','now()']],
  release_source_rights:[['release_id','text'],['source','text'],['authorization_sha256','character(64)'],['rights_evidence_sha256','character(64)'],
    ['authorization_basis','text'],['decision_record_id','text'],['valid_through','date'],['revoked_at','timestamp with time zone',null,false],['created_at','timestamp with time zone','now()']]};
  for(const r of rows){
    const expected=specs[r.name].map(([name,type,defaultValue=null,notnull=true])=>({name,type,notnull,default:defaultValue,identity:'',generated:''}));
    requireValue(catalogHash(r.columns)===catalogHash(expected));
    const expectedConstraints={registry_releases:'8d55c5b98504f8061a3ff6b69ea4d20a96ce21bbfb62f62c838f786e41005615',release_source_rights:'d2f49f9290e452788c7cc841fa5b4d089e9d10134fb89ffe9b861cbdfb2b43ec'};
    requireValue(catalogHash(r.other_constraints)===expectedConstraints[r.name]);
  }
  requireValue(catalogHash(rows)===TARGET_CATALOG);
  return rows;
}
function qualifyConstraints(rows,expanded){
  const projection=expanded?"CHECK ((projection = ANY (ARRAY['STUDENT_RIGHTS_SAFE_RISE'::text, 'SOURCE_CONTROLLED_REGISTRY'::text])))":"CHECK ((projection = 'STUDENT_RIGHTS_SAFE_RISE'::text))";
  const basis=expanded?"CHECK ((authorization_basis = ANY (ARRAY['government_public_domain_factual_projection'::text, 'bounded_historical_cycle_projection'::text, 'written_commercial_data_grant'::text])))":
    "CHECK ((authorization_basis = ANY (ARRAY['government_public_domain_factual_projection'::text, 'bounded_historical_cycle_projection'::text])))";
  requireValue(rows.length===3&&new Set(rows.map(r=>r.name)).size===3&&rows.every(r=>CHANGES.includes(r.name)&&
    r.relation===(r.name.startsWith('registry_')?'registry_releases':'release_source_rights')&&
    r.type==='c'&&r.validated===true&&r.definition===(r.name.startsWith('registry_')?projection:basis)));
}
async function historyPresent(client){
  const rows=(await query(client,`SELECT c.relkind AS kind,c.relpersistence AS persistence,c.relowner::regrole::text AS owner,c.relrowsecurity AS rls,c.relforcerowsecurity AS forced,
    (SELECT count(*)::int FROM pg_policy WHERE polrelid=c.oid) AS policies,
    (SELECT count(*)::int FROM pg_trigger WHERE tgrelid=c.oid AND NOT tgisinternal) AS triggers,
    (SELECT count(*)::int FROM pg_rewrite WHERE ev_class=c.oid) AS rules,
    (SELECT count(*)::int FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))a WHERE a.grantee<>c.relowner) AS external_acl,
    (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
    (SELECT jsonb_agg(jsonb_build_object('definition',pg_get_constraintdef(co.oid),'validated',co.convalidated) ORDER BY co.conname COLLATE "C") FROM pg_constraint co WHERE co.conrelid=c.oid AND co.contype<>'n') AS constraints,
    (SELECT count(*)::int FROM pg_index WHERE indrelid=c.oid) AS indexes,
    (SELECT bool_and(indisvalid AND indisready AND indislive AND indisunique AND indisprimary) FROM pg_index WHERE indrelid=c.oid) AS indexes_valid
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rise_runtime' AND c.relname='iiq_registry_registration_history'`)).rows;
  if(!rows.length)return false;
  const expectedColumns=['name','sql_sha256','bundle_sha256','before_sha256','after_sha256','applied_at'].map(name=>({name,type:name==='applied_at'?'timestamp with time zone':'text',notnull:true,default:name==='applied_at'?'clock_timestamp()':null}));
  const r=rows[0];requireValue(rows.length===1&&r.kind==='r'&&r.persistence==='p'&&r.owner==='postgres'&&r.rls&&r.forced&&r.policies===0&&r.triggers===0&&r.rules===0&&r.external_acl===0&&r.indexes===1&&r.indexes_valid===true&&
    catalogHash(r.columns)===catalogHash(expectedColumns)&&r.constraints?.length===5&&r.constraints.every(c=>c.validated===true)&&
    r.constraints.map(c=>c.definition).sort().join('\n')===['PRIMARY KEY (name)',...['sql_sha256','bundle_sha256','before_sha256','after_sha256'].map(k=>`CHECK ((${k} ~ '^[a-f0-9]{64}$'::text))`)].sort().join('\n'));
  return true;
}
function assertAfter(state){
  requireValue(state.releases?.length===3&&state.rights?.length===3);
  const old={releases:state.releases.filter(r=>r.release_id!==RELEASE).map(r=>r.release_id===OLD?{...r,active:true}:r),rights:state.rights.filter(r=>r.release_id!==RELEASE)};
  requireValue(catalogHash(old)===BEFORE&&state.releases.find(r=>r.release_id===OLD)?.active===false&&state.releases.filter(r=>r.active).length===1);
  const {created_at:releaseAt,...release}=state.releases.find(r=>r.release_id===RELEASE)??{};
  requireValue(Boolean(releaseAt)&&catalogHash(release)===catalogHash({release_id:RELEASE,projection:'SOURCE_CONTROLLED_REGISTRY',api_index_sha256:PINS['api-index.json'],
    index_manifest_sha256:PINS['index-manifest.json'],program_count:6245,rights_blocked_field_count:0,active:true}));
  const {created_at:rightAt,...right}=state.rights.find(r=>r.release_id===RELEASE)??{};
  requireValue(Boolean(rightAt)&&catalogHash(right)===catalogHash({release_id:RELEASE,source:'FREIDA',authorization_sha256:PINS['freida-source-authorization.json'],rights_evidence_sha256:GRANT,
    authorization_basis:'written_commercial_data_grant',decision_record_id:'P1-RISE-5009-FREIDA-COMMERCIAL-GRANT',valid_through:'2099-12-31',revoked_at:null}));
}

// This tranche is intentionally LOCAL-ONLY. It cannot connect to production;
// a separately reviewed production guard/recovery transaction is still required.
export async function registerInterviewiqCurrentRights({mode='local',harnessPath,bundleDirectory,grantPath}={}){
  let client,transaction=false,locked=false;
  try{
    requireValue(mode==='local');const local=qualifyLocalHarness(harnessPath);
    const bundle=qualifyRegistrationBundle({bundleDirectory,grantPath});
    const sql=pinnedFile(SQL_PATH,SQL_SHA,20000).toString('utf8');
    const begin=sql.indexOf('\nBEGIN;'),end=sql.lastIndexOf('\nCOMMIT;');requireValue(begin>0&&end>begin);
    const body=sql.slice(begin+7,end); // Exact immutable SQL hash above, never arbitrary caller SQL.
    client=new pg.Client({...local.connection,application_name:'iiq1204-local-registration-rehearsal'});await client.connect();
    const identity=(await query(client,"SELECT current_database() AS database,current_user AS role,current_setting('cluster_name') AS marker,current_setting('server_encoding') AS encoding,current_setting('server_version_num')::int/10000 AS major,inet_server_addr() AS address")).rows[0];
    requireValue(identity.database===local.h.database&&identity.role==='postgres'&&identity.marker===local.h.marker&&identity.encoding==='UTF8'&&identity.major===18&&identity.address===null);
    const prerequisite=await prerequisiteCatalog(client);
    requireValue((await query(client,"SELECT pg_try_advisory_lock(hashtextextended('rise:iiq-registry-registration',0)) AS acquired")).rows[0].acquired);locked=true;
    await query(client,'BEGIN ISOLATION LEVEL REPEATABLE READ');transaction=true;
    await query(client,"SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='10s'; SET LOCAL search_path=pg_catalog; SET LOCAL timezone='UTC'; SET LOCAL datestyle='ISO,YMD'");
    await query(client,'LOCK TABLE rise_runtime.registry_releases,rise_runtime.release_source_rights IN SHARE ROW EXCLUSIVE MODE');
    const catalog=await targetCatalog(client);
    const before=await registrationState(client),exists=await historyPresent(client);
    qualifyConstraints(await controls(client),exists);
    if(exists){
      assertAfter(before);
      const rows=(await query(client,'SELECT name,sql_sha256,bundle_sha256,before_sha256,after_sha256 FROM rise_runtime.iiq_registry_registration_history')).rows;
      requireValue(rows.length===1&&catalogHash(rows[0])===catalogHash({name:MIGRATION,sql_sha256:SQL_SHA,bundle_sha256:bundle.bundleSha256,before_sha256:BEFORE,after_sha256:catalogHash(before)}));
      await query(client,'COMMIT');transaction=false;return {status:'unchanged',migration:MIGRATION,registryReleaseId:RELEASE};
    }
    requireValue(catalogHash(before)===BEFORE);
    await query(client,body);requireValue(await historyPresent(client));qualifyConstraints(await controls(client),true);
    await query(client,`INSERT INTO rise_runtime.registry_releases(release_id,projection,api_index_sha256,index_manifest_sha256,program_count,rights_blocked_field_count,active)
      VALUES($1,'SOURCE_CONTROLLED_REGISTRY',$2,$3,6245,0,false)`,[RELEASE,PINS['api-index.json'],PINS['index-manifest.json']]);
    await query(client,`INSERT INTO rise_runtime.release_source_rights(release_id,source,authorization_sha256,rights_evidence_sha256,authorization_basis,decision_record_id,valid_through)
      VALUES($1,'FREIDA',$2,$3,'written_commercial_data_grant','P1-RISE-5009-FREIDA-COMMERCIAL-GRANT','2099-12-31')`,[RELEASE,PINS['freida-source-authorization.json'],GRANT]);
    requireValue((await query(client,'UPDATE rise_runtime.registry_releases SET active=false WHERE release_id=$1 AND active=true',[OLD])).rowCount===1);
    requireValue((await query(client,'UPDATE rise_runtime.registry_releases SET active=true WHERE release_id=$1 AND active=false',[RELEASE])).rowCount===1);
    const after=await registrationState(client);assertAfter(after);requireValue(catalogHash(await prerequisiteCatalog(client))===catalogHash(prerequisite));
    requireValue(catalogHash(await targetCatalog(client))===catalogHash(catalog));qualifyConstraints(await controls(client),true);requireValue(await historyPresent(client));
    await query(client,'INSERT INTO rise_runtime.iiq_registry_registration_history(name,sql_sha256,bundle_sha256,before_sha256,after_sha256) VALUES($1,$2,$3,$4,$5)',
      [MIGRATION,SQL_SHA,bundle.bundleSha256,BEFORE,catalogHash(after)]);
    await query(client,'COMMIT');transaction=false;
    return {status:'applied',migration:MIGRATION,registryReleaseId:RELEASE,manifestProgramCount:6245,programRowsImported:0};
  }catch{if(client&&transaction)await query(client,'ROLLBACK').catch(()=>{});fail();}
  finally{if(client){if(locked)await query(client,"SELECT pg_advisory_unlock(hashtextextended('rise:iiq-registry-registration',0))").catch(()=>{});await client.end().catch(()=>{});}}
}
