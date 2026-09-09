// Fixed remote helper. Secret inputs are read from stdin, never command arguments.
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const MIGRATIONS_022 = Object.freeze([
  ['20260907011000_d1_022_founder_standards.sql','f1a27f6d763e944d95fdc0d21cbfc882008ebbecaa3a008480e366bb1ec00ee2'],
  ['20260907012000_d1_022_admin_workspace.sql','c7ae9018aa1f7e5b49d0335f6dd7bc5d5eaac5043fd6403bc836b030a112cc3e'],
  ['20260907013000_d1_022_admin_outbox.sql','5e8dfb6fea20a5a74a336c822198c0ed4fc9622fef9a2b93437dc2225f3fc299'],
  ['20260908014000_d1_022_version_history_scope.sql','980e53e2317cf00d7fe627bdc10a4b5ea979fdc02c5a474d39d58a49496465a7'],
  ['20260908015000_d1_022_current_document_version_scope.sql','901b52b7e237fdc140719caa8ea7f93e051f71640b0dce40cea5a4550667ebbc'],
]);
export const LOGIN_022='timeline_api_login_022';
export const ROLES_022=['timeline_authenticated','timeline_grant_authority','timeline_identity_sync'];
export function checkedMigrationBodies(entries){
  if(!Array.isArray(entries)||entries.length!==MIGRATIONS_022.length)throw Error('MIGRATION_SET_DENIED');
  return entries.map((entry,index)=>{
    const [name,hash]=MIGRATIONS_022[index];
    if(entry.name!==name||typeof entry.sql!=='string'||createHash('sha256').update(entry.sql).digest('hex')!==hash)throw Error('MIGRATION_BYTES_DENIED');
    const opening=/^((?:--[^\n]*(?:\n|$)|\s)*)begin;\s*/i;
    if(!opening.test(entry.sql)||!/\bcommit;\s*$/i.test(entry.sql))throw Error('MIGRATION_TRANSACTION_SHAPE_DENIED');
    // The exact reviewed bytes carry their own schema assertions. Only their outer
    // transaction delimiters are removed so all migrations and the login are atomic.
    return entry.sql.replace(opening,'$1').replace(/\bcommit;\s*$/i,'');
  });
}
const BASELINE_SQL=`select current_database() as database, current_user as operator,
  (select system_identifier::text from pg_control_system()) as system_identifier,
  timeline.schema_version() as schema_version,
  (select pg_get_userbyid(nspowner) from pg_namespace where nspname='timeline') as schema_owner,
  to_regclass('timeline.founder_standard_revisions') is null and to_regclass('timeline.founder_standard_decisions') is null as new_tables_absent,
  not exists(select 1 from pg_roles where rolname='timeline_api_login_022') as login_absent,
  not exists(select 1 from timeline.principals where id='timeline_admin_authority_022' or wp_user_id=-22022) as issuer_absent,
  not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='timeline' and p.proname='admin_outbox_matches_022')
    and not exists(select 1 from pg_policies where schemaname='timeline' and policyname in ('reviews_admin_insert_022','reviews_admin_update_022','comments_admin_insert_022','approvals_admin_insert_022','exports_admin_insert_022','outbox_admin_insert_022','outbox_admin_scope_022')) as admin_workflow_absent,
  (select coalesce(json_agg(table_schema||'.'||table_name order by table_schema,table_name),'[]'::json) from information_schema.tables where table_schema not in ('pg_catalog','information_schema') and (table_name ilike '%migration%' or table_name ilike '%ledger%')) as bookkeeping_tables`;
export function assertBaseline(row){
  if(row?.database!=='railway'||row.operator!=='postgres'||row.schema_owner!=='postgres'||row.schema_version!=='d1-timeline-db-500.1'||!row.new_tables_absent||!row.login_absent||!row.issuer_absent||!row.admin_workflow_absent||JSON.stringify(row.bookkeeping_tables)!=='[]')throw Error('DATABASE_BASELINE_CHANGED');
}
export function assertLogin(row,members){
  if(row?.rolname!==LOGIN_022||!row.rolcanlogin||row.rolinherit||row.rolsuper||row.rolbypassrls||row.rolcreatedb||row.rolcreaterole||row.rolreplication)throw Error('LOGIN_ATTRIBUTES_DENIED');
  if(JSON.stringify(members.map(x=>x.role).sort())!==JSON.stringify(ROLES_022)||members.some(x=>x.inherit_option||!x.set_option||x.admin_option))throw Error('LOGIN_MEMBERSHIPS_DENIED');
}
export async function runDatabaseOperation(input,pg,administrativeUrl){
  if(!['inspect','apply','verify'].includes(input.action))throw Error('DATABASE_ACTION_DENIED');
  const client=new pg.Client({connectionString:administrativeUrl,application_name:'d1-022-guarded-release',connectionTimeoutMillis:8000});
  let transaction=false;
  await client.connect();
  try{
    if(input.action==='inspect')return {status:'INSPECTED',baseline:(await client.query(BASELINE_SQL)).rows[0]};
    if(input.action==='apply'){
      const bodies=checkedMigrationBodies(input.migrations);
      if(!/^[A-Za-z0-9_-]{64}$/.test(input.password||''))throw Error('PASSWORD_INPUT_DENIED');
      await client.query('begin');transaction=true;
      await client.query("set local lock_timeout='8s'; set local statement_timeout='60s'; set local log_statement='none'; set local log_min_duration_statement=-1; set local log_min_duration_sample=-1; set local log_transaction_sample_rate=0; set local log_duration=off; set local log_min_error_statement='panic'; set local password_encryption='scram-sha-256'");
      await client.query("select pg_advisory_xact_lock(hashtextextended('D1-TIMELINE-STORYFORGE-LIVE-022',0))");
      const baseline=(await client.query(BASELINE_SQL)).rows[0];assertBaseline(baseline);
      if(!/^\d+$/.test(input.expectedSystemIdentifier||'')||baseline.system_identifier!==input.expectedSystemIdentifier)throw Error('DATABASE_CLUSTER_IDENTITY_CHANGED');
      const roles=(await client.query('select rolname,rolcanlogin,rolsuper,rolbypassrls from pg_roles where rolname=any($1::text[])',[ROLES_022])).rows;
      if(roles.length!==3||roles.some(x=>x.rolcanlogin||x.rolsuper||x.rolbypassrls))throw Error('EXISTING_ROLE_IDENTITY_DENIED');
      for(const body of bodies)await client.query(body);
      // The password alphabet above excludes all SQL delimiters. It exists only
      // in process memory/private pipe and the PostgreSQL role's SCRAM verifier.
      await client.query(`create role ${LOGIN_022} login noinherit nosuperuser nobypassrls nocreatedb nocreaterole noreplication password '${input.password}'`);
      await client.query(`grant timeline_authenticated,timeline_identity_sync,timeline_grant_authority to ${LOGIN_022} with inherit false, set true, admin false`);
      await client.query(`grant connect on database railway to ${LOGIN_022}`);
      await client.query('commit');transaction=false;
    }
    const attrs=(await client.query('select rolname,rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication from pg_roles where rolname=$1',[LOGIN_022])).rows[0];
    const members=(await client.query('select r.rolname as role,m.inherit_option,m.set_option,m.admin_option from pg_auth_members m join pg_roles r on r.oid=m.roleid join pg_roles u on u.oid=m.member where u.rolname=$1 order by r.rolname',[LOGIN_022])).rows;
    assertLogin(attrs,members);
    const restricted=new pg.Client({connectionString:input.replacementUrl,application_name:'d1-022-login-readback',connectionTimeoutMillis:8000});
    await restricted.connect();
    try{
      const identity=(await restricted.query('select current_user,current_database() as database')).rows[0];
      if(identity.current_user!==LOGIN_022||identity.database!=='railway')throw Error('NEW_CONNECTION_IDENTITY_DENIED');
      let denied=false;
      try{await restricted.query('select 1 from timeline.documents limit 1');}catch(error){denied=error.code==='42501';}
      if(!denied)throw Error('AMBIENT_ACCESS_NOT_DENIED');
      await restricted.query('begin read only');
      await restricted.query('set local role timeline_authenticated');
      const schema=(await restricted.query("select timeline.schema_version() as version,to_regclass('timeline.founder_standard_revisions') is not null and to_regclass('timeline.founder_standard_decisions') is not null as standards_ready")).rows[0];
      if(schema.version!=='d1-timeline-db-500.1'||!schema.standards_ready)throw Error('SCHEMA_READINESS_DENIED');
      const versionScope=(await restricted.query("select to_regprocedure('timeline.can_read_version_022(text,text)') is not null as history_ready,to_regprocedure('timeline.can_read_current_document_022(text,text,text,timestamp with time zone)') is not null as current_document_ready")).rows[0];
      if(!versionScope.history_ready||!versionScope.current_document_ready)throw Error('VERSION_SCOPE_READINESS_DENIED');
      const workflow=(await restricted.query("select to_regprocedure('timeline.admin_outbox_matches_022(text,text,text,text,jsonb,integer,timestamp with time zone,timestamp with time zone)') is not null as function_ready,(select count(*)::int from pg_policies where schemaname='timeline' and policyname in ('reviews_admin_insert_022','reviews_admin_update_022','comments_admin_insert_022','approvals_admin_insert_022','exports_admin_insert_022','outbox_admin_insert_022','outbox_admin_scope_022')) as policy_count")).rows[0];
      if(!workflow.function_ready||workflow.policy_count!==7)throw Error('ADMIN_WORKFLOW_READINESS_DENIED');
      await restricted.query('set local role timeline_identity_sync');
      await restricted.query('set local role timeline_grant_authority');
      await restricted.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:'timeline_admin_authority_022',timeline_role:'SERVICE',program_ids:[],service_scopes:['audit:read']})]);
      const issuer=(await restricted.query("select exists(select 1 from timeline.principals where id='timeline_admin_authority_022' and wp_user_id=-22022 and role='SERVICE' and status='ACTIVE') as ready")).rows[0];
      if(!issuer.ready)throw Error('ISSUER_READINESS_DENIED');
      await restricted.query('rollback');
      return {status:'PASS',schema_version:schema.version,login:attrs,memberships:members,ambient_access_denied:true,standards_ready:true,issuer_ready:true,admin_workflow_ready:true,history_scope_ready:true,current_document_scope_ready:true,migrations:MIGRATIONS_022.map(([name,sha256])=>({name,sha256}))};
    }finally{await restricted.end();}
  }finally{if(transaction)await client.query('rollback').catch(()=>{});await client.end();}
}
async function main(){
  let raw='';for await(const chunk of process.stdin){raw+=chunk;if(raw.length>200000)throw Error('INPUT_TOO_LARGE');}
  const pg=(await import('pg')).default;
  const result=await runDatabaseOperation(JSON.parse(raw),pg,process.env.DATABASE_URL);
  process.stdout.write(JSON.stringify(result));
}
// Remote invocation uses `node --input-type=module -e <this public source>`.
if(process.argv[1]===undefined||import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(()=>{process.stderr.write('DATABASE_OPERATION_FAILED_PRIVATE_DIAGNOSTICS_SUPPRESSED\n');process.exitCode=1;});
}
