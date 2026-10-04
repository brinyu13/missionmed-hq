import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import pg from 'pg';

export const MIGRATION='20261004045129_iiq_1204_rise_owner_nonce.sql';
const SQL_PATH=fileURLToPath(new URL(`../sql/${MIGRATION}`,import.meta.url));
const NAMES=['iiq_owner_migrations','iiq_owner_request_nonces'];
const PROJECT='c0113625-951e-46ab-939b-dd57acc0e87c';
const ENVIRONMENT='549d6597-1962-44cb-b0f5-7d88bd025e31';
const SERVICE='58236876-7616-4a6b-9792-bfdb114b51d8';
const sha=x=>createHash('sha256').update(x).digest('hex');
function fail(){throw new Error('interviewiq_migration_denied');}
function stable(value) {
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
export const catalogHash=value=>sha(JSON.stringify(stable(value)));
const query=(client,text,values)=>client.query({text,values,query_timeout:15000});

function pinnedEvidence(reference,{privateFile=false}={}) {
  if(!reference||typeof reference.path!=='string'||!path.isAbsolute(reference.path)||!/^[a-f0-9]{64}$/.test(reference.sha256??''))fail();
  const stat=fs.lstatSync(reference.path),parent=fs.lstatSync(path.dirname(reference.path));
  if(stat.isSymbolicLink()||!stat.isFile()||stat.uid!==process.getuid()||stat.size>100000000||
    parent.isSymbolicLink()||!parent.isDirectory()||parent.uid!==process.getuid()||
    (privateFile&&((stat.mode&0o077)||(parent.mode&0o077))))fail();
  const bytes=fs.readFileSync(reference.path);if(sha(bytes)!==reference.sha256)fail();return bytes;
}

// Boolean flags are not backup or review evidence. Bind the actual receipts,
// reviewed SQL bytes and retained recoverable dump before opening a connection.
export function qualifyProductionEvidence(approval,sqlHash) {
  if(!approval||approval.project!==PROJECT||approval.environment!==ENVIRONMENT||approval.service!==SERVICE||
    approval.sqlSha256!==sqlHash||!/^[a-f0-9]{64}$/.test(approval.backupSha256??''))fail();
  const review=JSON.parse(pinnedEvidence(approval.recoveryReview));
  const repaired=JSON.parse(pinnedEvidence(review.repairedRestoreReceipt));
  const source=JSON.parse(pinnedEvidence(review.sourceReceipt));
  const sqlReview=JSON.parse(pinnedEvidence(approval.sqlReview));
  if(review.approved!==true||review.allTableRowsMatch!==true||review.rolesOwnersAclRlsConstraintsPoliciesMatch!==true||
    review.productionWrites!==0||review.localRestore?.independentPgCtlStatus!=='NO_SERVER_RUNNING'||
    repaired.status!=='PASS'||repaired.localServerStopped!==true||repaired.restore?.recordsAndCanonicalRelationshipsPreserved!==true||
    repaired.restore?.rolesOwnersAclRlsConstraintsPoliciesPreserved!==true||
    source.project!==PROJECT||source.environment!==ENVIRONMENT||source.service!==SERVICE||source.identity?.database!=='railway'||
    sqlReview.approved!==true||sqlReview.sqlSha256!==sqlHash||sqlReview.migration!==MIGRATION||sqlReview.productionDdlApproved!==true)fail();
  const backup=repaired.backup,capturedAt=backup?.capturedAt*1000;
  if(!Number.isFinite(capturedAt)||Date.now()<capturedAt||Date.now()-capturedAt>86400000||approval.backupCapturedAt!==capturedAt||
    backup.snapshotConsistent!==true||backup.sha256!==approval.backupSha256||backup.sha256!==review.dump?.sha256||
    backup.sha256!==source.backup?.sha256||backup.path!==review.dump.path||backup.path!==source.backup.path||
    review.sourceFingerprint!==review.restoredFingerprint||review.sourceFingerprint!==repaired.restore.sourceFingerprint||
    repaired.restore.sourceFingerprint!==repaired.restore.restoredFingerprint)fail();
  const dump=pinnedEvidence(backup,{privateFile:true});
  if(dump.length!==backup.bytes||dump.subarray(0,5).toString()!=='PGDMP')fail();
  return true;
}

export function qualifyLocalHarness(manifestPath) {
  // This check runs before constructing or connecting a PostgreSQL client.
  if(Object.keys(process.env).some(k=>/^(?:DATABASE_URL|RISE_DATABASE_URL|PGHOST|PGHOSTADDR|PGSERVICE|PGSERVICEFILE|PGOPTIONS|RAILWAY_ENVIRONMENT_ID)$/.test(k)&&process.env[k]))fail();
  if(typeof manifestPath!=='string'||!/^\/tmp\/iiq-rise-test-[A-Za-z0-9_-]+\/harness\.json$/.test(manifestPath))fail();
  const directory=path.dirname(manifestPath),stat=fs.lstatSync(manifestPath),dirStat=fs.lstatSync(directory);
  if(stat.isSymbolicLink()||!stat.isFile()||stat.uid!==process.getuid()||(stat.mode&0o077)||
    dirStat.isSymbolicLink()||!dirStat.isDirectory()||dirStat.uid!==process.getuid()||(dirStat.mode&0o077))fail();
  const h=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  if(h.directory!==directory||h.host!==directory+'/socket'||h.database!=='iiq_owner_synthetic'||h.user!=='postgres'||
    h.port!==55440||typeof h.marker!=='string'||!/^iiq-test-[a-f0-9-]{36}$/.test(h.marker)||
    !Number.isInteger(h.pid)||h.pid<2||!Number.isInteger(h.createdAt)||Date.now()-h.createdAt<0||Date.now()-h.createdAt>3600000)fail();
  for(const p of [h.host,directory+'/data']) {
    const s=fs.lstatSync(p);if(s.isSymbolicLink()||!s.isDirectory()||s.uid!==process.getuid()||(s.mode&0o077))fail();
  }
  const socket=fs.lstatSync(`${h.host}/.s.PGSQL.${h.port}`);
  if(!socket.isSocket()||socket.uid!==process.getuid())fail();
  if(Number(fs.readFileSync(directory+'/data/postmaster.pid','utf8').split('\n')[0])!==h.pid)fail();
  process.kill(h.pid,0);
  return {h,connection:{host:h.host,port:h.port,database:h.database,user:h.user,connectionTimeoutMillis:5000}};
}

export async function seamCatalog(client) {
  return (await query(client,`SELECT c.relname AS name,c.relkind AS kind,c.relowner::regrole::text AS owner,c.relrowsecurity AS rls,c.relforcerowsecurity AS force_rls,
    (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
    (SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END,'grantor',a.grantor::regrole::text,'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantee::regrole::text COLLATE "C",a.privilege_type COLLATE "C") FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))a) AS acl,
    (SELECT jsonb_agg(jsonb_build_object('name',co.conname,'type',co.contype,'validated',co.convalidated,'definition',pg_get_constraintdef(co.oid)) ORDER BY co.conname COLLATE "C") FROM pg_constraint co WHERE co.conrelid=c.oid) AS constraints,
    (SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY pg_get_indexdef(i.indexrelid) COLLATE "C") FROM pg_index i WHERE i.indrelid=c.oid) AS indexes,
    (SELECT jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(SELECT jsonb_agg(r::regrole::text ORDER BY r::regrole::text COLLATE "C") FROM unnest(p.polroles)r),'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname COLLATE "C") FROM pg_policy p WHERE p.polrelid=c.oid) AS policies,
    (SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.tgname COLLATE "C") FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal) AS triggers
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rise_runtime' AND c.relname=ANY($1) ORDER BY c.relname COLLATE "C"`,[NAMES])).rows;
}

export async function prerequisiteCatalog(client) {
  const roles=(await query(client,"SELECT rolname,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication,rolcanlogin,rolinherit FROM pg_roles WHERE rolname IN ('rise_app_login','rise_app_runtime') ORDER BY rolname COLLATE \"C\"")).rows;
  const schema=(await query(client,"SELECT nspowner::regrole::text AS owner FROM pg_namespace WHERE nspname='rise_runtime'")).rows;
  if(roles.length!==2||schema.length!==1||schema[0].owner!=='postgres'||roles.some(r=>r.rolsuper||r.rolbypassrls||r.rolcreaterole||r.rolcreatedb||r.rolreplication)||
    !roles.find(r=>r.rolname==='rise_app_login')?.rolcanlogin||roles.find(r=>r.rolname==='rise_app_runtime')?.rolcanlogin)fail();
  const capabilities=(await query(client,"SELECT pg_has_role('rise_app_login','rise_app_runtime','MEMBER') AS member,pg_has_role('rise_app_login','rise_app_runtime','SET') AS can_set,has_schema_privilege('rise_app_runtime','rise_runtime','USAGE') AS usage")).rows[0];
  const memberships=(await query(client,`SELECT parent.rolname AS parent,child.rolname AS child,m.admin_option,m.inherit_option,m.set_option
    FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles child ON child.oid=m.member
    WHERE parent.rolname IN ('rise_app_login','rise_app_runtime') OR child.rolname IN ('rise_app_login','rise_app_runtime')
    ORDER BY parent.rolname COLLATE "C",child.rolname COLLATE "C"`)).rows;
  if(!capabilities.member||!capabilities.can_set||!capabilities.usage||roles.some(r=>!r.rolinherit)||
    JSON.stringify(memberships)!==JSON.stringify([{parent:'rise_app_runtime',child:'rise_app_login',admin_option:false,inherit_option:true,set_option:true}]))fail();
  return {roles,schema,capabilities,memberships};
}

function assertSeam(catalog) {
  // Fixed PG18 catalog of this reviewed SQL: every type/default/constraint,
  // index, owner, ACL, policy and trigger state is bound before first commit.
  // Never learn the expected schema from the database being migrated.
  if(catalogHash(catalog)!=='808f6ee9d17efcebb8b13739a323a4cb471c131830316be17c1e9a13cfa77902')fail();
  if(catalog.length!==2||catalog.some(t=>t.kind!=='r'||t.owner!=='postgres'||!t.rls||!t.force_rls||t.triggers))fail();
  const nonce=catalog.find(t=>t.name==='iiq_owner_request_nonces'),ledger=catalog.find(t=>t.name==='iiq_owner_migrations');
  if(nonce.columns.map(c=>c.name).join(',')!=='issuer,nonce,request_sha256,created_at,expires_at'||
    ledger.columns.map(c=>c.name).join(',')!=='name,sql_sha256,schema_sha256,applied_at'||
    catalog.some(t=>t.columns.some(c=>!c.notNull)||t.constraints.some(c=>!c.validated)))fail();
  const external=t=>(t.acl??[]).filter(a=>a.grantee!=='postgres');
  if(external(ledger).length||ledger.policies!==null||external(nonce).length!==2||
    external(nonce).some(a=>a.grantee!=='rise_app_runtime'||a.grantable||!['SELECT','INSERT'].includes(a.privilege))||
    new Set(external(nonce).map(a=>a.privilege)).size!==2||nonce.policies?.length!==2)fail();
  const policy=(cmd,key)=>nonce.policies.find(p=>p.command===cmd&&p.permissive===true&&p.roles?.join(',')==='rise_app_runtime'&&p[key]==="(issuer = 'interviewiq'::text)");
  if(!policy('r','using')||!policy('a','check'))fail();
}

function sqlTopLevel(sql) {
  let output='',i=0;
  while(i<sql.length) {
    if(sql.startsWith('--',i)){const end=sql.indexOf('\n',i+2);i=end<0?sql.length:end;output+=' ';continue;}
    if(sql.startsWith('/*',i)) {
      let depth=1;i+=2;
      while(i<sql.length&&depth){if(sql.startsWith('/*',i)){depth++;i+=2;}else if(sql.startsWith('*/',i)){depth--;i+=2;}else i++;}
      if(depth)fail();output+=' ';continue;
    }
    if(sql[i]==="'"||sql[i]==='"') {
      const quote=sql[i],escaped=quote==="'"&&/[eE]/.test(sql[i-1]??'')&&!/[A-Za-z_0-9$]/.test(sql[i-2]??'');
      let closed=false;i++;
      while(i<sql.length) {
        if(escaped&&sql[i]==='\\'){i+=2;continue;}
        if(sql[i]===quote){if(sql[i+1]===quote){i+=2;continue;}i++;closed=true;break;}i++;
      }
      if(!closed)fail();output+=' ';continue;
    }
    const delimiter=sql[i]==='$'&&!/[A-Za-z_0-9$]/.test(sql[i-1]??'')?sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/)?.[0]:null;
    if(delimiter){const end=sql.indexOf(delimiter,i+delimiter.length);if(end<0)fail();i=end+delimiter.length;output+=' ';continue;}
    output+=sql[i++];
  }
  return output;
}

export function transactionBody(sql) {
  // This runner handles one fixed ASCII migration, not arbitrary SQL dialects
  // or Unicode identifiers. Reject unsupported lexical input before execution.
  if(typeof sql!=='string'||Buffer.byteLength(sql)>30000||/[^\x00-\x7f]/.test(sql))fail();
  const clean=sql.replace(/^\s*--[^\n]*$/gm,'').trim();
  if(!/^BEGIN\s*;/i.test(clean)||!/COMMIT\s*;$/i.test(clean))fail();
  const body=clean.replace(/^BEGIN\s*;/i,'').replace(/COMMIT\s*;$/i,'');
  if(/\b(COMMIT|ROLLBACK|SAVEPOINT|TRUNCATE|DROP|DELETE|UPDATE|COPY|PREPARE|SECURITY\s+DEFINER|ALTER\s+(?:ROLE|DATABASE|SCHEMA)|SET\s+(?:ROLE|SESSION))\b/i.test(body))fail();
  // END is also PostgreSQL's COMMIT alias. Ignore the reviewed procedural
  // dollar-quoted block when examining top-level transaction controls.
  const topLevel=sqlTopLevel(body);
  if(/\b(?:BEGIN|START\s+TRANSACTION|END|ABORT|RELEASE|SET\s+TRANSACTION)\b/i.test(topLevel))fail();
  return body;
}

// Production composition is intentionally explicit; this module never reads a
// database URL from ambient environment or creates/modifies prerequisites.
export async function migrateInterviewiqOwner({mode='local',harnessPath,connectionString,ca,approval,sqlPath=SQL_PATH}={}) {
  let client,locked=false,transaction=false;
  try {
    if(path.basename(sqlPath)!==MIGRATION)fail();
    const sql=fs.readFileSync(sqlPath,'utf8'),hash=sha(sql),body=transactionBody(sql);
    let config,local;
    if(mode==='local') {local=qualifyLocalHarness(harnessPath);config=local.connection;}
    else if(mode==='production') {
      qualifyProductionEvidence(approval,hash);
      if(!approval||approval.approved!==true||approval.sourceSecurityApproved!==true||approval.sqlSha256!==hash||
        approval.project!==PROJECT||approval.service!==SERVICE||approval.database!=='railway'||approval.role!=='postgres'||
        !approval.backupRestoreVerified||!Number.isFinite(approval.backupCapturedAt)||Date.now()-approval.backupCapturedAt>86400000||
        Date.now()<approval.backupCapturedAt||!/^[a-f0-9]{64}$/.test(approval.backupSha256??'')||!approval.catalogSha256||
        !Array.isArray(approval.expectedLedger)||process.env.NODE_TLS_REJECT_UNAUTHORIZED==='0'||process.env.PGOPTIONS||process.env.PGHOSTADDR||process.env.PGSERVICE)fail();
      const url=new URL(connectionString);
      if(!['postgres:','postgresql:'].includes(url.protocol)||url.search||url.hostname!==approval.connectHost||Number(url.port||5432)!==approval.connectPort||
        url.pathname!=='/railway'||url.username!=='postgres'||!url.password||!Buffer.isBuffer(ca)||sha(ca)!==approval.caSha256||
        approval.caSha256!=='cd63116483567f50b0014a4b1411bcfb38befbadaea2a427ba81991f148fd6f2')fail();
      config={connectionString,connectionTimeoutMillis:5000,ssl:{ca,rejectUnauthorized:true,checkServerIdentity:(_host,cert)=>
        cert.fingerprint256==='FF:FD:E4:63:12:79:FA:6D:BA:6E:8B:41:AF:B7:A1:23:72:69:7F:2D:4F:79:48:13:05:CB:FC:A3:2D:38:EE:FB'?tls.checkServerIdentity('localhost',cert):new Error('certificate_mismatch')}};
    } else fail();
    client=new pg.Client({...config,application_name:'iiq1204-reviewed-nonce-migration'});await client.connect();
    const identity=(await query(client,"SELECT current_database() AS database,current_user AS role,current_setting('server_version_num')::int/10000 AS major,current_setting('server_encoding') AS encoding,current_setting('cluster_name') AS marker,host(inet_server_addr()) AS address,inet_server_port() AS port")).rows[0];
    if(identity.major!==18||identity.role!=='postgres'||identity.encoding!=='UTF8')fail();
    if(local) {if(identity.database!==local.h.database||identity.address!==null||identity.marker!==local.h.marker)fail();}
    else if(identity.database!=='railway'||identity.address!==approval.serverAddress||identity.port!==approval.serverPort||!client.connection.stream.encrypted||!client.connection.stream.authorized)fail();
    const prerequisite=await prerequisiteCatalog(client);
    if(!(await query(client,"SELECT pg_try_advisory_lock(hashtextextended('rise:iiq-owner:migrations',0)) AS acquired")).rows[0].acquired)fail();locked=true;
    await query(client,'BEGIN ISOLATION LEVEL REPEATABLE READ');transaction=true;
    await query(client,"SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='10s'; SET LOCAL search_path=pg_catalog; SET LOCAL standard_conforming_strings=on");
    const before=await seamCatalog(client);
    if(before.length!==0&&before.length!==2)fail();
    if(before.length)assertSeam(before);
    const ledger=before.length?(await query(client,'SELECT name,sql_sha256,schema_sha256 FROM rise_runtime.iiq_owner_migrations ORDER BY name COLLATE "C"')).rows:[];
    if(!local&&(catalogHash({prerequisite,seam:before})!==approval.catalogSha256||JSON.stringify(ledger)!==JSON.stringify(approval.expectedLedger)))fail();
    if(before.length) {
      if(ledger.length!==1||ledger[0].name!==MIGRATION||ledger[0].sql_sha256!==hash||ledger[0].schema_sha256!==catalogHash(before))fail();
      await query(client,'COMMIT');transaction=false;return {status:'unchanged',name:MIGRATION,sha256:hash};
    }
    await query(client,body);
    const after=await seamCatalog(client);assertSeam(after);
    if(catalogHash(await prerequisiteCatalog(client))!==catalogHash(prerequisite))fail();
    await query(client,'INSERT INTO rise_runtime.iiq_owner_migrations(name,sql_sha256,schema_sha256) VALUES($1,$2,$3)',[MIGRATION,hash,catalogHash(after)]);
    await query(client,'COMMIT');transaction=false;
    return {status:'applied',name:MIGRATION,sha256:hash,schemaSha256:catalogHash(after)};
  } catch {if(client&&transaction)await query(client,'ROLLBACK').catch(()=>{});throw new Error('interviewiq_migration_denied');}
  finally {if(client){if(locked)await query(client,"SELECT pg_advisory_unlock(hashtextextended('rise:iiq-owner:migrations',0))").catch(()=>{});await client.end().catch(()=>{});}}
}
