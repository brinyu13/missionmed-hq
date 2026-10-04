import {createHash} from 'node:crypto';
import tls from 'node:tls';
import pg from 'pg';
import {createInterviewiqOwner} from '../src/interviewiq-owner.mjs';
import {createInterviewiqStore} from './interviewiq-store.mjs';
import {createRiseSourceRightsController} from './postgres-runtime.mjs';

const PREFIX='/api/rise/v1/interviewiq';
const CA_SHA='cd63116483567f50b0014a4b1411bcfb38befbadaea2a427ba81991f148fd6f2';
const LEAF='FF:FD:E4:63:12:79:FA:6D:BA:6E:8B:41:AF:B7:A1:23:72:69:7F:2D:4F:79:48:13:05:CB:FC:A3:2D:38:EE:FB';
const unavailable=()=>new Error('interviewiq_runtime_unavailable');
const sha=x=>createHash('sha256').update(x).digest('hex');
const deny=()=>({status:503,body:{error:'interviewiq_owner_unavailable'}});

export function isInterviewiqNamespace(raw='') {
  let value=String(raw);
  for(let i=0;i<3;i++) {
    const candidate=value.replaceAll('\\','/');
    if(candidate.split('?',1)[0].includes(PREFIX)&&new RegExp(`${PREFIX}(?:/|$|#)`).test(candidate.split('?',1)[0]))return true;
    try {const p=new URL(candidate,'http://rise.local').pathname;if(p===PREFIX||p.startsWith(PREFIX+'/'))return true;}catch{}
    try {const next=decodeURIComponent(value);if(next===value)break;value=next;}catch{break;}
  }
  return false;
}

export function readInterviewiqRuntimeConfig(env=process.env) {
  const flag=String(env.RISE_IIQ_ENABLED??'').trim();
  if(!['','0','false','1','true'].includes(flag))throw unavailable();
  if(!['1','true'].includes(flag))return {enabled:false};
  if(env.NODE_TLS_REJECT_UNAUTHORIZED==='0'||Object.keys(env).some(k=>/^PG(?:HOST|HOSTADDR|PORT|DATABASE|USER|PASSWORD|SERVICE|SERVICEFILE|SYSCONFDIR|OPTIONS)$/.test(k)&&env[k]))throw unavailable();
  const requestSecret=env.RISE_IIQ_OWNER_REQUEST_SECRET,proofSecret=env.RISE_IIQ_OWNER_PROOF_SECRET;
  if([requestSecret,proofSecret].some(x=>typeof x!=='string'||Buffer.byteLength(x)<32)||requestSecret===proofSecret)throw unavailable();
  for(const [key,value] of Object.entries(env)) {
    if(['RISE_IIQ_OWNER_REQUEST_SECRET','RISE_IIQ_OWNER_PROOF_SECRET'].includes(key))continue;
    if(/SECRET|TOKEN|HMAC|JWT|GATEWAY|SIGNING|API_KEY/.test(key)&&value&&(value===requestSecret||value===proofSecret))throw unavailable();
  }
  let url;try{url=new URL(env.RISE_DATABASE_URL);}catch{throw unavailable();}
  const query=[...url.searchParams];
  if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!=='postgres.railway.internal'||Number(url.port||5432)!==5432||
    url.pathname!=='/railway'||url.username!=='rise_app_login'||!url.password||url.hash||
    query.length>1||query.length===1&&(query[0][0]!=='sslmode'||query[0][1]!=='require'))throw unavailable();
  if([requestSecret,proofSecret].includes(decodeURIComponent(url.password)))throw unavailable();
  url.search='';
  const ca=Buffer.from(String(env.RISE_IIQ_DATABASE_CA_PEM??''));if(sha(ca)!==CA_SHA)throw unavailable();
  return {enabled:true,requestSecret,proofSecret,pool:{connectionString:url.href,max:4,connectionTimeoutMillis:5000,
    idleTimeoutMillis:30000,statement_timeout:5000,query_timeout:5000,application_name:'rise-interviewiq-owner',
    ssl:{ca,rejectUnauthorized:true,checkServerIdentity:(_host,cert)=>cert.fingerprint256===LEAF?tls.checkServerIdentity('localhost',cert):unavailable()}}};
}

export async function readEmptyInterviewiqBody(request) {
  const headers=new Map();
  if(request.method!=='GET'||!Array.isArray(request.rawHeaders)||request.rawHeaders.length%2||request.rawHeaders.length>200)throw unavailable();
  for(let i=0;i<request.rawHeaders.length;i+=2) {
    const key=String(request.rawHeaders[i]).toLowerCase(),value=String(request.rawHeaders[i+1]);
    if(['transfer-encoding','x-http-method-override','x-method-override','x-http-method','cookie','origin','authorization','x-mmed-consumer'].includes(key))throw unavailable();
    if(key==='content-length') {if(headers.has(key)||value!=='0')throw unavailable();headers.set(key,value);}
  }
  if(request.aborted||request.destroyed)throw unavailable();
  return new Promise((resolve,reject)=>{
    let timer,settled=false;
    const finish=error=>{
      if(settled)return;settled=true;clearTimeout(timer);
      request.off('data',data);request.off('end',end);request.off('error',bad);request.off('aborted',bad);request.off('close',closed);
      if(error){request.pause();reject(unavailable());}else resolve(Buffer.alloc(0));
    };
    const data=chunk=>{if(chunk.length)finish(true);},end=()=>finish(false),bad=()=>finish(true),closed=()=>{if(!request.readableEnded)finish(true);};
    request.on('data',data);request.once('end',end);request.once('error',bad);request.once('aborted',bad);request.once('close',closed);
    timer=setTimeout(()=>finish(true),1000);
    if(request.readableEnded)end();else request.resume();
  });
}

// Same complete PG18 catalog as the independently reviewed A4 migration.
function stable(value) {
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
async function readNonceCatalog(pool) {
  return (await pool.query(`SELECT c.relname AS name,c.relkind AS kind,c.relowner::regrole::text AS owner,c.relrowsecurity AS rls,c.relforcerowsecurity AS force_rls,
    (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
    (SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END,'grantor',a.grantor::regrole::text,'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantee::regrole::text COLLATE "C",a.privilege_type COLLATE "C") FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))a) AS acl,
    (SELECT jsonb_agg(jsonb_build_object('name',co.conname,'type',co.contype,'validated',co.convalidated,'definition',pg_get_constraintdef(co.oid)) ORDER BY co.conname COLLATE "C") FROM pg_constraint co WHERE co.conrelid=c.oid) AS constraints,
    (SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY pg_get_indexdef(i.indexrelid) COLLATE "C") FROM pg_index i WHERE i.indrelid=c.oid) AS indexes,
    (SELECT jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(SELECT jsonb_agg(r::regrole::text ORDER BY r::regrole::text COLLATE "C") FROM unnest(p.polroles)r),'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname COLLATE "C") FROM pg_policy p WHERE p.polrelid=c.oid) AS policies,
    (SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.tgname COLLATE "C") FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal) AS triggers
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rise_runtime' AND c.relname=ANY($1) ORDER BY c.relname COLLATE "C"`,[['iiq_owner_migrations','iiq_owner_request_nonces']])).rows;
}

async function qualifyPool(pool) {
  const q=(text,values)=>pool.query(text,values);
  const {rows:[identity]}=await q("SELECT current_database() AS database,current_user AS role,session_user AS session,current_setting('server_version_num')::int/10000 AS major");
  if(identity?.database!=='railway'||identity.role!=='rise_app_login'||identity.session!=='rise_app_login'||identity.major!==18)throw unavailable();
  const {rows:roles}=await q("SELECT rolname,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication,rolcanlogin,rolinherit FROM pg_roles WHERE rolname IN ('rise_app_login','rise_app_runtime') ORDER BY rolname");
  if(roles.length!==2||roles.some(r=>!r.rolinherit||r.rolsuper||r.rolbypassrls||r.rolcreaterole||r.rolcreatedb||r.rolreplication)||
    roles[0].rolname!=='rise_app_login'||!roles[0].rolcanlogin||roles[1].rolname!=='rise_app_runtime'||roles[1].rolcanlogin)throw unavailable();
  const {rows:members}=await q(`SELECT p.rolname AS parent,c.rolname AS child,m.admin_option,m.inherit_option,m.set_option FROM pg_auth_members m
    JOIN pg_roles p ON p.oid=m.roleid JOIN pg_roles c ON c.oid=m.member
    WHERE p.rolname IN ('rise_app_login','rise_app_runtime') OR c.rolname IN ('rise_app_login','rise_app_runtime') ORDER BY p.rolname,c.rolname`);
  if(JSON.stringify(members)!==JSON.stringify([{parent:'rise_app_runtime',child:'rise_app_login',admin_option:false,inherit_option:true,set_option:true}]))throw unavailable();
  const {rows:tables}=await q(`SELECT c.relname AS name,c.relkind AS kind,c.relowner::regrole::text AS owner,n.nspowner::regrole::text AS schema_owner,c.relrowsecurity AS rls,c.relforcerowsecurity AS forced,
    (SELECT count(*)::int FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal) AS triggers
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rise_runtime' AND c.relname IN ('iiq_owner_request_nonces','iiq_owner_migrations') ORDER BY c.relname`);
  if(tables.length!==2||tables.some(t=>t.kind!=='r'||t.owner!=='postgres'||t.schema_owner!=='postgres'||!t.rls||!t.forced||t.triggers!==0))throw unavailable();
  const {rows:privileges}=await q(`SELECT name,privilege,has_table_privilege(current_user,'rise_runtime.'||name,privilege) AS allowed
    FROM unnest(ARRAY['iiq_owner_request_nonces','iiq_owner_migrations']) name CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) privilege ORDER BY name,privilege`);
  if(privileges.length!==16||privileges.some(p=>p.allowed!==(p.name==='iiq_owner_request_nonces'&&['SELECT','INSERT'].includes(p.privilege))))throw unavailable();
  const {rows:externalAcl}=await q(`SELECT c.relname AS name,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END AS grantee,a.privilege_type AS privilege,a.is_grantable AS grantable
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))a
    WHERE n.nspname='rise_runtime' AND c.relname IN ('iiq_owner_request_nonces','iiq_owner_migrations') AND a.grantee<>c.relowner ORDER BY c.relname,a.privilege_type`);
  if(externalAcl.length!==2||externalAcl.some(a=>a.name!=='iiq_owner_request_nonces'||a.grantee!=='rise_app_runtime'||a.grantable)||externalAcl.map(a=>a.privilege).join(',')!=='INSERT,SELECT')throw unavailable();
  if(sha(JSON.stringify(stable(await readNonceCatalog(pool))))!=='808f6ee9d17efcebb8b13739a323a4cb471c131830316be17c1e9a13cfa77902')throw unavailable();
}

export async function createInterviewiqRuntime({registryIndex,env=process.env}={}, {Pool=pg.Pool,fetchImpl=fetch}={}) {
  const config=readInterviewiqRuntimeConfig(env);
  if(!config.enabled)return Object.freeze({enabled:false,handle:async()=>deny(),close:async()=>{}});
  let underlying;
  try {
    const rights=registryIndex?.releaseGate?.sourceRights?.map(r=>r.sha256);
    if(registryIndex?.activationStatus!=='active'||registryIndex.activationReceipt?.verified!==true||
      registryIndex.releaseGate?.sourceRightsApproved!==true||!Array.isArray(registryIndex.programs)||
      typeof registryIndex.registryReleaseId!=='string'||!registryIndex.registryReleaseId||
      !rights?.length||rights.some(x=>typeof x!=='string'||!/^[a-f0-9]{64}$/.test(x))||new Set(rights).size!==rights.length)throw unavailable();
    const registryReleaseId=registryIndex.registryReleaseId;
    Object.freeze(rights);
    const ownerIndex=Object.freeze({registryReleaseId,programs:Object.freeze(registryIndex.programs.map(p=>Object.freeze({
      programSpecialtyId:p.programSpecialtyId,display:Object.freeze({programName:p.display?.programName,track:p.display?.track??''}),
    })))});
    underlying=new Pool(config.pool);underlying.on('error',()=>{});
    const pool={options:{connectionTimeoutMillis:5000},async connect(){
      const client=await underlying.connect();
      if(client.connection?.stream?.encrypted!==true||client.connection?.stream?.authorized!==true){client.release(true);throw unavailable();}return client;
    },async query(text,values){const c=await this.connect();let discard=false;
      try{return await c.query({text,values,query_timeout:5000});}catch{discard=true;throw unavailable();}finally{c.release(discard);}
    }};
    await qualifyPool(pool);
    const controller=await createRiseSourceRightsController({pool});
    const assertSourceRights=async()=>{
      const result=await controller.assertCurrent({registryReleaseId,authorizationSha256s:rights});
      if(result?.current!==true)throw unavailable();return result;
    };
    await assertSourceRights();
    const store=createInterviewiqStore({enabled:true,pool});
    const owner=createInterviewiqOwner(config,{consumeNonce:store.consumeNonce,fetchImpl,getRegistry:async()=>ownerIndex,assertSourceRights});
    let closed=false;
    return Object.freeze({enabled:true,async handle(request){
      if(closed)return deny();
      try {const body=await readEmptyInterviewiqBody(request);return await owner({method:request.method,url:request.url,rawHeaders:request.rawHeaders,body});}
      catch{return deny();}
    },async close(){if(!closed){closed=true;await underlying.end();}}});
  } catch {if(underlying)await underlying.end().catch(()=>{});throw unavailable();}
}
