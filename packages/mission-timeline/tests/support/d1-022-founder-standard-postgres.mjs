import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {PostgresFounderStandardRegistry} from '../../src/intelligence/founder-standard-registry.ts';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const temporary=await mkdtemp(join(tmpdir(),'d1-022-founder-standards-'));
const data=join(temporary,'postgres');
let started=false;let pool;
const checks=[];
function command(executable,args){const result=spawnSync(executable,args,{encoding:'utf8'});if(result.status!==0)throw new Error(`${executable} failed: ${result.stderr}`);return result.stdout;}
function check(name,condition=true){assert.ok(condition,name);checks.push({name,status:'PASS'});}
const identity=(principalId,wpUserId,role='STUDENT',extra={})=>({principalId,wpUserId,role,hasLearndash3893Access:role==='STUDENT',isWordpressAdministrator:role==='PROGRAM_ADMIN',programIds:[],assignedDocumentIds:[],facultyGrants:[],serviceScopes:[],sessionId:'local-test',requestId:'d1-022-registry-postgres',...extra});
const student=identity('student_a',410001);const other=identity('student_b',410002);
const manager=identity('program_admin_a',410006,'PROGRAM_ADMIN',{founderStandardsManager:true});
const ordinaryAdmin={...manager,founderStandardsManager:false};
const rawClaims=(context)=>({sub:context.principalId,wp_user_id:context.wpUserId,timeline_role:context.role,has_learndash_3893_access:context.hasLearndash3893Access,is_wordpress_administrator:context.isWordpressAdministrator,founder_standards_manager:context.founderStandardsManager===true,program_ids:[],service_scopes:[]});
async function queryAs(context,sql,values=[]){const client=await pool.connect();try{await client.query('begin');await client.query('set local role timeline_authenticated');await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(rawClaims(context))]);const result=await client.query(sql,values);await client.query('rollback');return result;}catch(error){await client.query('rollback').catch(()=>{});throw error;}finally{client.release();}}

try{
  command('initdb',['-D',data,'--auth=trust','--username=d1_022_test','--no-locale']);
  command('pg_ctl',['-D',data,'-l',join(temporary,'postgres.log'),'-o',`-h '' -k ${temporary} -p 57422`,'-w','start']);started=true;
  pool=new pg.Pool({host:temporary,port:57422,user:'d1_022_test',database:'postgres',max:3});
  const files=['database/migrations/202607150001_timeline_v1.sql','database/disposable/seed_413.sql','database/migrations/202607150002_timeline_v1_413_hardening.sql','database/migrations/202608020003_d1_411c_identity_and_admin_grants.sql','database/roles/202608020001_d1_411c_runtime_roles.sql','database/migrations/202608040004_d1_500_grant_hardening.sql','database/roles/202608040002_d1_500_runtime_roles.sql','database/migrations/20260805223000_rc1_first_use_identity_provisioning.sql','database/migrations/20260907011000_d1_022_founder_standards.sql'];
  for(const name of files)command('psql',['-h',temporary,'-p','57422','-U','d1_022_test','-d','postgres','-v','ON_ERROR_STOP=1','-f',join(root,name)]);
  check('Nine isolated base/role/022 migrations execute on real PostgreSQL');
  const registry=new PostgresFounderStandardRegistry(pool);
  const input={standardId:'synthetic-chronology-rule',baseVersion:0,kind:'INTERVIEW_READINESS',title:'Preserve source chronology',guidance:'Synthetic test guidance: ask about ambiguous dates; do not invent a month.',applicability:{workflows:['CV','GUARDIAN','RESCUE'],categoryIds:['education']},provenance:{sourceRef:'SYNTHETIC-TEST-ONLY',sourceSha256:'a'.repeat(64),dataClass:'SYNTHETIC'}};
  const first=await registry.createRevision(manager,input);check('Create yields an immutable DRAFT',first.status==='DRAFT'&&first.version===1);
  check('Student cannot list unapproved draft',(await registry.retrieve(student,{workflow:'CV',categoryIds:['education']})).standards.length===0);
  check('Draft inaccessible by direct SQL ID',(await queryAs(student,"select * from timeline.founder_standard_revisions where standard_id=$1",[input.standardId])).rows.length===0);
  await assert.rejects(registry.createRevision(ordinaryAdmin,input),{code:'FOUNDER_STANDARD_MANAGER_REQUIRED'});check('Ordinary admin cannot author standards');
  await assert.rejects(registry.decide(student,{standardId:input.standardId,version:1,decision:'APPROVE',approvalRef:'test',reason:'test'}),{code:'FOUNDER_STANDARD_MANAGER_REQUIRED'});check('Student cannot approve standards');
  await registry.decide(manager,{standardId:input.standardId,version:1,decision:'APPROVE',approvalRef:'SYNTHETIC-APPROVAL-1',reason:'Approve this synthetic test rule.'});
  const approved=await registry.retrieve(student,{workflow:'CV',categoryIds:['education']});check('Approved retrieval returns exact version and hash',approved.standards.length===1&&approved.standards[0].version===1&&approved.standards[0].contentSha256===first.contentSha256);
  check('Approved nonpersonal standards available to second eligible student',(await registry.retrieve(other,{workflow:'GUARDIAN',categoryIds:['education']})).standards.length===1);
  check('Omitting categories retrieves all approved guidance for the selected workflow',(await registry.retrieve(student,{workflow:'RESCUE'})).standards.length===1);
  check('Applicability excludes unrelated category',(await registry.retrieve(student,{workflow:'CV',categoryIds:['work']})).standards.length===0);
  check('Non-360 SQL reader denied',(await queryAs({...student,hasLearndash3893Access:false},'select * from timeline.founder_standard_revisions')).rows.length===0);
  check('Anonymous SQL reader denied',(await queryAs({principalId:'',role:'',wpUserId:null},'select * from timeline.founder_standard_revisions')).rows.length===0);
  await assert.rejects(queryAs(student,"insert into timeline.founder_standard_decisions(id,standard_id,version,decision,approval_ref,reason,actor_principal_id) values ('forged',$1,1,'APPROVE','forged','forged',$2)",[input.standardId,student.principalId]));check('Student direct SQL publication denied by RLS');
  await assert.rejects(pool.query("update timeline.founder_standard_revisions set guidance='changed' where standard_id=$1",[input.standardId]),/append-only/);check('Revision update denied even to database owner');
  await assert.rejects(pool.query("delete from timeline.founder_standard_decisions where standard_id=$1",[input.standardId]),/append-only/);check('Decision deletion denied even to database owner');
  await pool.query("update timeline.principals set status='SUSPENDED' where id=$1",[student.principalId]);
  check('Suspended identity denied despite stale eligibility claim',(await queryAs(student,'select * from timeline.founder_standard_revisions')).rows.length===0);
  await pool.query("update timeline.principals set status='ACTIVE' where id=$1",[student.principalId]);
  const second=await registry.createRevision(manager,{...input,baseVersion:1,guidance:'A different synthetic review convention.'});
  await registry.decide(manager,{standardId:input.standardId,version:2,decision:'REJECT',approvalRef:'SYNTHETIC-REJECT-2',reason:'Reject only the new draft.'});
  check('Rejected newer draft does not unpublish prior approved version',(await registry.retrieve(student,{workflow:'CV',categoryIds:['education']})).standards[0].version===1);
  await registry.decide(manager,{standardId:input.standardId,version:2,decision:'APPROVE',approvalRef:'SYNTHETIC-APPROVAL-2',reason:'Explicitly approve the new revision.'});
  check('New explicit approval publishes only exact new revision',(await registry.retrieve(student,{workflow:'CV',categoryIds:['education']})).standards[0].contentSha256===second.contentSha256);
  await registry.decide(manager,{standardId:input.standardId,version:2,decision:'RETIRE',approvalRef:'SYNTHETIC-RETIRE-2',reason:'Withdraw this standard.'});
  check('Retirement does not resurrect older approved revision',(await registry.retrieve(student,{workflow:'CV',categoryIds:['education']})).standards.length===0);
  check('Retired revision inaccessible by direct ID',(await queryAs(student,'select * from timeline.founder_standard_revisions where standard_id=$1',[input.standardId])).rows.length===0);
  await assert.rejects(registry.createRevision(manager,input),{code:'FOUNDER_STANDARD_REVISION_CONFLICT'});check('Stale authoring base version rejected');
  await registry.decide(manager,{standardId:input.standardId,version:1,decision:'APPROVE',approvalRef:'SYNTHETIC-EXPLICIT-ROLLBACK',reason:'Explicitly restore exact prior approved guidance.'});
  check('Explicit approval can restore a known exact prior version',(await registry.retrieve(student,{workflow:'CV',categoryIds:['education']})).standards[0].version===1);
  const audit=(await pool.query("select metadata_json from timeline.audit_events where resource_type='FOUNDER_STANDARD' and resource_id=$1",[input.standardId])).rows;
  check('Every revision and decision has transaction-bound noncontent audit',audit.length===7&&!JSON.stringify(audit).includes('guidance'));
  const client=await pool.connect();try{await assert.rejects(client.query(await readFile(join(root,'database/migrations/20260907011000_d1_022_founder_standards.down.sql'),'utf8')),/custody records exist/);await client.query('rollback');}finally{client.release();}
  check('Rollback refuses to destroy registry custody',(await registry.listForManagement(manager)).revisions.length===2);
  const tables=(await pool.query("select relname,relrowsecurity,relforcerowsecurity from pg_class where oid in ('timeline.founder_standard_revisions'::regclass,'timeline.founder_standard_decisions'::regclass)")).rows;
  check('Both registry tables enforce FORCE RLS',tables.length===2&&tables.every(row=>row.relrowsecurity&&row.relforcerowsecurity));
  process.stdout.write(JSON.stringify({schema:'d1-022-founder-standard-postgres-proof.1',postgresVersion:(await pool.query('show server_version')).rows[0].server_version,checks,passed:checks.length,failed:0,syntheticOnly:true,productionTouched:false},null,2)+'\n');
}finally{
  await pool?.end();
  if(started)command('pg_ctl',['-D',data,'-m','fast','-w','stop']);
  if(temporary.includes('d1-022-founder-standards-'))await rm(temporary,{recursive:true,force:true});
}
