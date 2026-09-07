import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {PostgresTimelineAdminService} from '../../src/admin/postgres-admin-service.ts';
import {document} from '../fixtures.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const temporary=await mkdtemp(join(tmpdir(),'d1-022-admin-cv-lineage-'));const data=join(temporary,'postgres');const port=57524;
const command=(name,args)=>{const r=spawnSync(name,args,{encoding:'utf8',timeout:30000});assert.equal(r.status,0,`${name}: ${r.stderr}`);};
let started=false,ownerPool,pool;const checks=[];
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);};
try {
 command('initdb',['-D',data,'--auth=trust','--username=d1_022_cv_owner','--no-locale']);
 command('pg_ctl',['-D',data,'-l',join(temporary,'postgres.log'),'-o',`-h '' -k ${temporary} -p ${port}`,'-w','start']);started=true;
 const config={host:temporary,port,database:'postgres',max:2};ownerPool=new pg.Pool({...config,user:'d1_022_cv_owner'});
 for(const file of ['database/migrations/202607150001_timeline_v1.sql','database/disposable/seed_413.sql','database/migrations/202607150002_timeline_v1_413_hardening.sql','database/migrations/202608020003_d1_411c_identity_and_admin_grants.sql','database/roles/202608020001_d1_411c_runtime_roles.sql','database/migrations/202608040004_d1_500_grant_hardening.sql','database/roles/202608040002_d1_500_runtime_roles.sql','database/migrations/20260805223000_rc1_first_use_identity_provisioning.sql','database/migrations/20260907011000_d1_022_founder_standards.sql','database/migrations/20260907012000_d1_022_admin_workspace.sql'])command('psql',['-h',temporary,'-p',String(port),'-U','d1_022_cv_owner','-d','postgres','-v','ON_ERROR_STOP=1','-f',join(root,file)]);
 await ownerPool.query('create role timeline_cv_test_login login noinherit nosuperuser nobypassrls nocreatedb nocreaterole');
 await ownerPool.query('grant timeline_authenticated,timeline_identity_sync,timeline_grant_authority to timeline_cv_test_login with inherit false, set true');
 pool=new pg.Pool({...config,user:'timeline_cv_test_login'});
 const adminId='00000000-0000-4000-8000-000000022901';
 await ownerPool.query("insert into timeline.principals(id,matrix_wp_user_id,wp_user_id,role,status) values($1,522900,522900,'PROGRAM_ADMIN','ACTIVE')",[adminId]);
 const context={principalId:adminId,wpUserId:522900,role:'PROGRAM_ADMIN',isWordpressAdministrator:true,adminWorkspace:true,requestId:'local-cv-lineage-roster',programIds:['missionmed-360:3893']};
 const service=new PostgresTimelineAdminService(pool);
 const lineage={documentType:'cv',sourceDocumentId:'local-source',sourceSha256:'a'.repeat(64),sourceBlockId:'local-block',pageNumber:1,sourceExcerpt:'SYNTHETIC_PRIVATE_SOURCE_SENTINEL'};
 const source={id:'local-source',sha256:'a'.repeat(64),effectiveType:'cv'};
 const cases=[
  ['canonical-after-reset',{events:[{id:'event-cv',provenance:[lineage]}],intake:{lastImport:null,candidates:[]}},true],
  ['legacy-accepted',{events:[],intake:{lastImport:{acceptedCandidates:[{id:'old',provenance:[{...lineage,sourceSha256:undefined}]}]}}},true],
  ['pending-review',{events:[],intake:{stage:'review',candidates:[{id:'pending',provenance:[lineage]}]}},true],
  ['completed-source',{events:[],intake:{extraction:{completed:true,sourceDocument:source}}},true],
  ['profile-lineage',{events:[],studentProfile:{fieldProvenance:{degree:{provenance:[lineage]}}}},true],
  ['manual',{events:[{id:'manual',title:'CV uploaded'}],intake:null},false],
  ['media-only',{events:[],advanced:{media:[{source:{objectId:'portrait',type:'image/png'}}]}},false],
  ['rescue',{events:[{id:'rescue',provenance:[{...lineage,documentType:'TIMELINE_RESCUE',userDeclaredType:'cv'}]}],intake:{extraction:{completed:true,sourceDocument:{...source,effectiveType:'TIMELINE_RESCUE'}}}},false],
  ['forged-status',{events:[],cvImported:true,intake:{approval:{applied:true,appliedCount:9},lastImport:{acceptedCandidates:[{id:'flag-only'}]}}},false],
  ['malformed-intake-shapes',{events:[],intake:{candidates:42,lastImport:{acceptedCandidates:true}}},false],
  ['never-started',null,false],
  ['deleted-import',{events:[{id:'deleted',provenance:[lineage]}]},false]
 ];
 if(process.argv[2]) {
  // Optional exact synthetic browser snapshot; never load a production connection.
  const snapshot=JSON.parse(await readFile(process.argv[2],'utf8'));
  assert.equal(snapshot.id,'timeline_8e31890d-68b9-4711-8ee6-5a3455bde470');assert.equal(snapshot.studentOwnerId,'c530d2dd-e898-5bcb-bcb7-c99f41ec1f08');assert.equal(snapshot.events.length,9);
  assert.equal(snapshot.intake.lastImport,null);assert.equal(snapshot.intake.candidates.length,0);
  cases.push(['actual-synthetic-031-after-apply',snapshot,true]);
 }
 for(let i=0;i<cases.length;i++) {
  const[name,patch]=cases[i],id=`00000000-0000-4000-8000-${String(22910+i).padStart(12,'0')}`,wp=522910+i;
  await ownerPool.query("insert into timeline.principals(id,matrix_wp_user_id,wp_user_id,role,status) values($1,$2,$2,'STUDENT','ACTIVE')",[id,wp]);
  if(patch){const doc={...document({id:'cv-test-'+i,studentOwnerId:id,programId:'missionmed-360:3893'}),...patch,id:'cv-test-'+i,studentOwnerId:id};await ownerPool.query("insert into timeline.documents(id,owner_principal_id,program_id,schema_version,status,document_json) values($1,$2,'missionmed-360:3893','d1-timeline-document-409.1',$3,$4::jsonb)",[doc.id,id,name==='deleted-import'?'DELETED':'DRAFT',JSON.stringify(doc)]);}
 }
 await assert.rejects(pool.query('select * from timeline.documents'),/permission denied/);check('restricted-login-has-no-ambient-document-access',true);
 const roster=await service.roster(context,{wpUserIds:cases.map((_,i)=>522910+i),verifiedAt:new Date().toISOString()});
 for(let i=0;i<cases.length;i++){const[name,,expected]=cases[i],row=roster.students[i];check(name,row.cvStatus===(expected?'IMPORTED':'NOT_IMPORTED')&&row.filters.cv_imported===expected);}
 check('never-started-and-deleted-remain-never-started',roster.students[10].filters.never_started&&roster.students[11].filters.never_started);
 check('no-source-excerpts-or-document-payload-returned',!JSON.stringify(roster).includes('SYNTHETIC_PRIVATE_SOURCE_SENTINEL')&&!JSON.stringify(roster).includes('quality_source')&&!JSON.stringify(roster).includes('sourceSha256'));
 await assert.rejects(service.roster({...context,role:'STUDENT',isWordpressAdministrator:false},{wpUserIds:[522910],verifiedAt:new Date().toISOString()}),{code:'ADMIN_WORKSPACE_REQUIRED'});check('student-cannot-read-roster',true);
 const trace=(await ownerPool.query("select count(*) as total from timeline.audit_events where action='ADMIN_ROSTER_VIEW' and request_id=$1",[context.requestId])).rows[0];check('successful-roster-read-remains-audited',Number(trace.total)===1);
 check('transaction-role-resets',(await pool.query('select current_user')).rows[0].current_user==='timeline_cv_test_login');
 console.log(JSON.stringify({status:'PASS_DISPOSABLE_POSTGRES_CV_LINEAGE',checks,passed:checks.length,productionTouched:false,databaseTransport:'private Unix socket, TCP disabled'}));
} finally {
 await pool?.end();await ownerPool?.end();if(started)command('pg_ctl',['-D',data,'-m','fast','-w','stop']);await rm(temporary,{recursive:true,force:true});
}
