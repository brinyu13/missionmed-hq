import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from '../node_modules/pg/esm/index.mjs';
import {SignJWT} from '../node_modules/jose/dist/webapi/index.js';
import {PostgresTimelineAdminService} from '../src/admin/postgres-admin-service.ts';
import {PostgresTimelinePrincipalDirectory} from '../src/identity/postgres-principal-directory.ts';
import {WordPressTimelineJwtVerifier} from '../src/identity/wordpress-timeline-jwt.ts';
import {PostgresTimelineRepository} from '../src/persistence/postgres/repository.ts';
import {postgresClaimsFromPrincipal} from '../src/persistence/postgres/types.ts';
import {TimelineService} from '../src/domain/timeline-service.ts';
import {TimelineHttpApi} from '../src/api/http-api.ts';
import {PrivacySafeTelemetry} from '../src/telemetry/telemetry.ts';
import {createTimelineProductionHttpHandler} from '../src/server/production-http-handler.ts';
import {assertProductionDatabaseReadiness,readProductionDatabaseHealth} from '../src/server/production-database-readiness.ts';
import {decide} from '../src/security/authorization.ts';
import {document} from '../tests/fixtures.ts';

const originalQuery=pg.Client.prototype.query;pg.Client.prototype.query=function(...args){const result=originalQuery.apply(this,args);return result?.catch?result.catch(error=>{if(error.code==='42501')process.stderr.write(JSON.stringify({independentSqlFailure:{code:error.code,table:error.table,message:error.message,query:String(args[0]).slice(0,150)}})+'\n');throw error;}):result;};
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const temporary=await mkdtemp(join(tmpdir(),'d1-022-admin-workflow-'));const data=join(temporary,'postgres');
let started=false;let ownerPool,pool,server;const checks=[];
const command=(name,args)=>{const result=spawnSync(name,args,{encoding:'utf8'});if(result.status!==0)throw new Error(`${name} failed: ${result.stderr}`);return result.stdout;};
const check=(name,condition=true)=>{assert.ok(condition,name);checks.push({name,status:'PASS'});};
const actors={student:{id:'10000000-0000-4000-8000-000000022001',wp:422001,role:'STUDENT'},other:{id:'10000000-0000-4000-8000-000000022002',wp:422002,role:'STUDENT'},admin:{id:'10000000-0000-4000-8000-000000022003',wp:422003,role:'PROGRAM_ADMIN'},non360:{id:'10000000-0000-4000-8000-000000022004',wp:422004,role:'STUDENT'}};
const secret=new TextEncoder().encode('d1-022-disposable-jwt-secret-not-production');const gateway='d1-022-disposable-gateway-not-production';
const token=(actor,extra={})=>{const now=Math.floor(Date.now()/1000);return new SignJWT({wp_user_id:actor.wp,timeline_role:actor.role,timeline_eligible:true,course_id:3893,has_learndash_3893_access:actor.role==='STUDENT',is_wordpress_administrator:actor.role==='PROGRAM_ADMIN',timeline_admin_workspace:actor.role==='PROGRAM_ADMIN',...extra}).setProtectedHeader({alg:'HS256',typ:'JWT',kid:'test'}).setIssuer('https://synthetic.test/timeline/').setAudience('mission-timeline').setSubject(actor.id).setIssuedAt(now).setNotBefore(now).setExpirationTime(now+120).setJti(randomUUID()).sign(secret);};
const scoped=(actor)=>({timeline_admin_subject_principal_id:actor.id,timeline_admin_subject_wp_user_id:actor.wp});
let origin,verifier;
async function call(path,{actor,claims={},body,headers={},gatewayEnabled=true,method}={}){const auth=actor?{authorization:`Bearer ${await token(actor,claims)}`}:{ };const response=await fetch(origin+path,{method:method||(body===undefined?'GET':'POST'),headers:{...(gatewayEnabled?{'x-missionmed-timeline-gateway-secret':gateway}:{}),...auth,...(body===undefined?{}:{'content-type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:response.status,data:await response.json()};}
async function asContext(context,sql,values=[]){const client=await pool.connect();try{await client.query('begin');await client.query('set local role timeline_authenticated');await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(postgresClaimsFromPrincipal(context))]);const result=await client.query(sql,values);await client.query('rollback');return result;}catch(error){await client.query('rollback').catch(()=>{});throw error;}finally{client.release();}}
const bridgeHeaders={'x-timeline-admin-directory':'learndash-3893'};
try{
 command('initdb',['-D',data,'--auth=trust','--username=d1_022_owner','--no-locale']);command('pg_ctl',['-D',data,'-l',join(temporary,'postgres.log'),'-o',`-h '' -k ${temporary} -p 57431`,'-w','start']);started=true;
 const config={host:temporary,port:57431,database:'postgres',max:3};ownerPool=new pg.Pool({...config,user:'d1_022_owner'});
 const files=['database/migrations/202607150001_timeline_v1.sql','database/disposable/seed_413.sql','database/migrations/202607150002_timeline_v1_413_hardening.sql','database/migrations/202608020003_d1_411c_identity_and_admin_grants.sql','database/roles/202608020001_d1_411c_runtime_roles.sql','database/migrations/202608040004_d1_500_grant_hardening.sql','database/roles/202608040002_d1_500_runtime_roles.sql','database/migrations/20260805223000_rc1_first_use_identity_provisioning.sql','database/migrations/20260907011000_d1_022_founder_standards.sql','database/migrations/20260907012000_d1_022_admin_workspace.sql','database/migrations/20260907013000_d1_022_admin_outbox.sql'];
 for(const file of files)command('psql',['-h',temporary,'-p','57431','-U','d1_022_owner','-d','postgres','-v','ON_ERROR_STOP=1','-f',join(root,file)]);
 await ownerPool.query('create role timeline_api_test_022 login noinherit nosuperuser nobypassrls nocreatedb nocreaterole noreplication');
 await ownerPool.query('grant timeline_authenticated,timeline_identity_sync,timeline_grant_authority to timeline_api_test_022 with inherit false, set true');
 pool=new pg.Pool({...config,user:'timeline_api_test_022'});
 const login=(await pool.query("select current_user,rolsuper,rolbypassrls,rolinherit,rolcreatedb,rolcreaterole from pg_roles where rolname=current_user")).rows[0];check('Real application login has no superuser/bypass/inherit/create privileges',login.current_user==='timeline_api_test_022'&&!login.rolsuper&&!login.rolbypassrls&&!login.rolinherit&&!login.rolcreatedb&&!login.rolcreaterole);
 await assert.rejects(pool.query('select * from timeline.documents'),/permission denied/);check('Login has no ambient direct Timeline table access');
 await new PostgresTimelineRepository(pool,{runtimeRole:'timeline_authenticated',expectedSchemaVersion:'d1-timeline-db-500.1'}).initialize();await assertProductionDatabaseReadiness(pool);check('Schema/startup checks succeed under explicit limited roles');
 const directory=new PostgresTimelinePrincipalDirectory(pool);verifier=new WordPressTimelineJwtVerifier({issuer:'https://synthetic.test/timeline/',secretsByKeyId:new Map([['test',secret]]),principalDirectory:directory});
 const adminService=new PostgresTimelineAdminService(pool);
 const commentKey=randomBytes(32);const commentBodyCodec={encrypt(value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',commentKey,iv);const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return 'synthetic-aesgcm:'+Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64');},decrypt(value){const bytes=Buffer.from(value.slice('synthetic-aesgcm:'.length),'base64'),decipher=createDecipheriv('aes-256-gcm',commentKey,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8');}};
 const serviceProvider=context=>new TimelineService(new PostgresTimelineRepository(pool,{runtimeRole:'timeline_authenticated',expectedSchemaVersion:'d1-timeline-db-500.1',rlsClaims:postgresClaimsFromPrincipal(context),commentBodyCodec}));
 const api=new TimelineHttpApi(serviceProvider,verifier,{},new PrivacySafeTelemetry({emit(){}},'isolated-test'),'synthetic-d1-022-test',true,undefined,undefined,{adminService});
 server=createServer(createTimelineProductionHttpHandler({api,gatewaySecret:gateway,releaseVersion:'synthetic-d1-022-test',expectedSchemaVersion:'d1-timeline-db-500.1',health:()=>readProductionDatabaseHealth(pool)}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
 check('Production health handler works with restricted login',(await call('/healthz',{gatewayEnabled:false})).status===200);
 for(const[which,id]of [['student','document022a'],['other','document022b']]){const actor=actors[which];const result=await call('/v1/documents',{actor,body:{id,programId:'missionmed-360:3893',title:'Synthetic test Timeline',document:document({id,studentOwnerId:actor.id,programId:'missionmed-360:3893'})}});assert.equal(result.status,201,JSON.stringify(result.data));}
 check('Fresh eligible students provision through identity role and save distinct canonical Timelines');
 const admin=await verifier.verify(await token(actors.admin),'admin-test');const student=await verifier.verify(await token(actors.student),'student-test');const other=await verifier.verify(await token(actors.other),'other-test');
 check('Student direct-ID own read passes',(await call('/v1/documents/document022a',{actor:actors.student})).status===200);
 check('Cross-student direct-ID read denied',(await call('/v1/documents/document022b',{actor:actors.student})).status===404);
 check('Anonymous signed-gateway request denied',(await call('/v1/documents/document022a')).status===401);
 check('Non360 signed identity denied',(await call('/v1/documents/document022a',{actor:actors.non360,claims:{has_learndash_3893_access:false}})).status===401);
 check('Client cannot reach API by forging internal directory header without gateway',(await call('/v1/admin/roster',{actor:actors.admin,body:{wpUserIds:[actors.student.wp],verifiedAt:new Date().toISOString()},headers:bridgeHeaders,gatewayEnabled:false})).status===403);
 check('Student with client admin marker and directory header denied',(await call('/v1/admin/roster',{actor:actors.student,claims:{timeline_admin_workspace:true},body:{wpUserIds:[actors.student.wp],verifiedAt:new Date().toISOString()},headers:bridgeHeaders})).status===403);
 check('Admin without verified workspace capability denied',(await call('/v1/admin/roster',{actor:actors.admin,claims:{timeline_admin_workspace:false},body:{wpUserIds:[],verifiedAt:new Date().toISOString()},headers:bridgeHeaders})).status===403);
 check('Admin without current internal directory bridge marker denied',(await call('/v1/admin/roster',{actor:actors.admin,body:{wpUserIds:[],verifiedAt:new Date().toISOString()}})).status===403);
 check('Stale enrollment verification denied',(await call('/v1/admin/roster',{actor:actors.admin,body:{wpUserIds:[],verifiedAt:new Date(Date.now()-120000).toISOString()},headers:bridgeHeaders})).status===409);
 const roster=await call('/v1/admin/roster',{actor:actors.admin,body:{wpUserIds:[actors.student.wp,actors.other.wp,499999],verifiedAt:new Date().toISOString()},headers:bridgeHeaders});assert.equal(roster.status,200,JSON.stringify(roster.data));check('Current bridge roster includes never-started identity without fabricating a Timeline',roster.data.students.length===3&&roster.data.students.find(row=>row.wpUserId===499999)?.status==='NEVER_STARTED');
 check('Admin direct ID denied before resource grant',(await call('/v1/documents/document022a',{actor:actors.admin,claims:scoped(actors.student)})).status===404);
 const opened=await call('/v1/admin/open',{actor:actors.admin,body:{wpUserId:actors.student.wp,verifiedAt:new Date().toISOString()},headers:bridgeHeaders});assert.equal(opened.status,200,JSON.stringify(opened.data));check('Current admin bridge issues exact independently audited document grant',opened.data.documentId==='document022a'&&opened.data.studentPrincipalId===actors.student.id);
 const openedOther=await call('/v1/admin/open',{actor:actors.admin,body:{wpUserId:actors.other.wp,verifiedAt:new Date().toISOString()},headers:bridgeHeaders});assert.equal(openedOther.status,200,JSON.stringify(openedOther.data));
 const repeatedOpen=await call('/v1/admin/open',{actor:actors.admin,body:{wpUserId:actors.student.wp,verifiedAt:new Date().toISOString()},headers:bridgeHeaders});assert.equal(repeatedOpen.status,200);
 check('Repeated open reuses the active matching short grant',Number((await ownerPool.query("select count(*) from timeline.admin_resource_grants where administrator_principal_id=$1 and document_id='document022a'",[actors.admin.id])).rows[0].count)===1);
 check('Both granted documents remain bound to the current selected subject',(await call('/v1/documents/document022b',{actor:actors.admin,claims:scoped(actors.student)})).status===404&&(await call('/v1/documents/document022b',{actor:actors.admin,claims:scoped(actors.other)})).status===200);
 check('Selected student read works after grant',(await call('/v1/documents/document022a',{actor:actors.admin,claims:scoped(actors.student)})).status===200);
 check('Workspace token without selected student cannot use grant',(await call('/v1/documents/document022a',{actor:actors.admin})).status===404);
 check('Wrong selected principal blocks direct-ID grant',(await call('/v1/documents/document022a',{actor:actors.admin,claims:scoped(actors.other)})).status===404);
 check('Wrong selected WP identity blocks direct-ID grant',(await call('/v1/documents/document022a',{actor:actors.admin,claims:{...scoped(actors.student),timeline_admin_subject_wp_user_id:actors.other.wp}})).status===404);

 const ownBefore=(await call('/v1/documents/document022a',{actor:actors.student})).data.document;
 const otherBefore=(await call('/v1/documents/document022b',{actor:actors.other})).data.document;
 const wrongWrite=await call('/v1/documents/document022b/versions',{actor:actors.admin,claims:scoped(actors.student),body:{baseRevision:otherBefore.revision,snapshot:{...otherBefore,title:'Forbidden admin change'},label:'Independent negative'}});
 check('Workflow: wrong-subject administrator version write denied',wrongWrite.status===404);
 const crossWrite=await call('/v1/documents/document022b/versions',{actor:actors.student,body:{baseRevision:otherBefore.revision,snapshot:otherBefore,label:'Independent negative'}});
 check('Workflow: cross-student version write denied',crossWrite.status===404);
 check('Workflow: denied writes preserve the other canonical revision',(await call('/v1/documents/document022b',{actor:actors.other})).data.document.revision===otherBefore.revision);
 const allowedWrite=await call('/v1/documents/document022a/versions',{actor:actors.admin,claims:scoped(actors.student),body:{baseRevision:ownBefore.revision,snapshot:{...ownBefore,studentOwnerId:actors.admin.id},label:'Independent selected-student version'}});
 assert.equal(allowedWrite.status,201,JSON.stringify(allowedWrite.data));
 check('Workflow: selected administrator saves an actual version through RLS',allowedWrite.status===201);
 const ownerAfter=(await call('/v1/documents/document022a',{actor:actors.student})).data.document;
 check('Workflow: server preserves the student owner despite owner override',ownerAfter.studentOwnerId===actors.student.id&&ownerAfter.revision===ownBefore.revision+1);
 const staleWrite=await call('/v1/documents/document022a/versions',{actor:actors.student,body:{baseRevision:ownBefore.revision,snapshot:ownBefore,label:'Stale independent device'}});
 check('Workflow: stale student save cannot overwrite administrator version',staleWrite.status===409);
 const listed=await call('/v1/documents',{actor:actors.admin,claims:scoped(actors.student)});
 check('Workflow: administrator list has only selected subject despite two grants',listed.status===200&&listed.data.documents.length===1&&listed.data.documents[0].document.studentOwnerId===actors.student.id);
 const currentAdmin=await verifier.verify(await token(actors.admin,scoped(actors.student)),'current-admin-test');

 // Exercise the complete advertised administrator lifecycle through the actual HTTP
 // service, restricted login and transaction-bound RLS, not a mocked repository.
 await ownerPool.query("insert into timeline.advisor_assignments(document_id,advisor_principal_id,program_id,starts_at) values('document022a','advisor_assigned','missionmed-360:3893',clock_timestamp()-interval '1 minute')");
 const reviewResult=await call('/v1/documents/document022a/reviews',{actor:actors.admin,claims:scoped(actors.student),body:{versionId:allowedWrite.data.id}});
 assert.equal(reviewResult.status,201,JSON.stringify(reviewResult.data));check('Granted administrator requests review with exact assigned advisor and immutable version');
 const reviewId=reviewResult.data.id;
 const commentResult=await call(`/v1/reviews/${reviewId}/comments`,{actor:actors.admin,claims:scoped(actors.student),body:{body:'Synthetic admin review comment',visibility:'SHARED'}});
 assert.equal(commentResult.status,201,JSON.stringify(commentResult.data));check('Granted administrator comment and matching outbox commit together');
 const decisionResult=await call(`/v1/reviews/${reviewId}/decision`,{actor:actors.admin,claims:scoped(actors.student),body:{decision:'APPROVED',reason:'Synthetic exact-version review'}});
 assert.equal(decisionResult.status,200,JSON.stringify(decisionResult.data));check('Granted administrator approves the reviewed version and updates its review status');
 const exportResult=await call('/v1/exports',{actor:actors.admin,claims:scoped(actors.student),body:{documentId:'document022a',versionId:allowedWrite.data.id,artifactType:'TIMELINE_INTERVIEWER_SAFE_PNG',scope:'INTERVIEWER_SAFE',renderer:'WEB_CANDIDATE'}});
 assert.equal(exportResult.status,202,JSON.stringify(exportResult.data));check('Granted administrator queues exact-version export and matching outbox together');
 const beforeMaterial=(await call('/v1/documents/document022a',{actor:actors.student})).data.document;
 const materialResult=await call('/v1/documents/document022a/versions',{actor:actors.admin,claims:scoped(actors.student),body:{baseRevision:beforeMaterial.revision,snapshot:{...beforeMaterial,title:'Synthetic material administrator revision'},label:'Material admin revision'}});
 assert.equal(materialResult.status,201,JSON.stringify(materialResult.data));
 check('Material administrator save invalidates the former approval atomically',Number((await ownerPool.query("select count(*) from timeline.approval_events where document_id='document022a' and decision='INVALIDATED' and actor_id=$1",[actors.admin.id])).rows[0].count)===1);
 const eventTypes=(await ownerPool.query("select event_type from timeline.outbox_events where document_id='document022a' and actor_id=$1",[actors.admin.id])).rows.map(r=>r.event_type);
 check('Every successful administrator workflow emits its matching transaction-bound outbox', ['timeline.document.versioned','timeline.review.requested','timeline.comment.created','timeline.review.approved','timeline.export.requested','timeline.approval.invalidated'].every(event=>eventTypes.includes(event)));
 const newReview=await call('/v1/documents/document022a/reviews',{actor:actors.admin,claims:scoped(actors.student),body:{versionId:materialResult.data.id}});assert.equal(newReview.status,201,JSON.stringify(newReview.data));
 const changes=await call(`/v1/reviews/${newReview.data.id}/decision`,{actor:actors.admin,claims:scoped(actors.student),body:{decision:'CHANGES_REQUESTED',reason:'Synthetic wording revision requested'}});assert.equal(changes.status,200,JSON.stringify(changes.data));
 check('Granted administrator changes-requested decision emits exact reviewed-version outbox');
 const validOutbox=(await ownerPool.query("select * from timeline.outbox_events where event_type='timeline.document.versioned' and actor_id=$1 order by available_at desc limit 1",[actors.admin.id])).rows[0];
 const forge=async(overrides={})=>{
   const row={...validOutbox,...overrides};
   return asContext(currentAdmin,'insert into timeline.outbox_events(id,aggregate_id,event_type,payload_json,attempts,available_at,published_at,actor_id,document_id) values($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)',
     [`outbox_forged_${randomUUID()}`,row.aggregate_id,row.event_type,JSON.stringify(row.payload_json),row.attempts,row.available_at,row.published_at,row.actor_id,row.document_id]);
 };
 const malformed=[
   ['another actor',{actor_id:actors.student.id}],['another aggregate',{aggregate_id:'document022b'}],
   ['another document',{document_id:'document022b'}],['another payload document',{payload_json:{...validOutbox.payload_json,documentId:'document022b'}}],
   ['another version',{payload_json:{...validOutbox.payload_json,versionId:'version_b1'}}],
   ['false content hash',{payload_json:{...validOutbox.payload_json,contentSha256:'a'.repeat(64)}}],
   ['false revision',{payload_json:{...validOutbox.payload_json,revision:9000}}],
   ['unsupported event',{event_type:'timeline.document.deleted'}],['already published',{published_at:new Date()}],
   ['nonzero attempts',{attempts:1}],['different record timestamp',{available_at:new Date(0)}],
   ['forged legacy review event',{event_type:'timeline.review.approved',payload_json:{documentId:'document022a',versionId:materialResult.data.id,reviewRequestId:'invented'}}]
 ];
 for(const[name,override]of malformed){await assert.rejects(forge(override),{code:'42501'});check(`Direct outbox forgery denied: ${name}`);}
 const countState=async()=>({revision:Number((await ownerPool.query("select current_revision from timeline.documents where id='document022a'")).rows[0].current_revision),versions:Number((await ownerPool.query("select count(*) from timeline.versions where document_id='document022a'")).rows[0].count),outbox:Number((await ownerPool.query("select count(*) from timeline.outbox_events where document_id='document022a'")).rows[0].count)});
 const atomicBefore=await countState();const atomicDocument=(await call('/v1/documents/document022a',{actor:actors.student})).data.document;
 const repository=new PostgresTimelineRepository(pool,{runtimeRole:'timeline_authenticated',expectedSchemaVersion:'d1-timeline-db-500.1',rlsClaims:postgresClaimsFromPrincipal(currentAdmin)});
 await assert.rejects(repository.withTransaction(async tx=>{
   await new TimelineService(tx).createVersion(currentAdmin,'document022a',atomicDocument.revision,{...atomicDocument,title:'Must roll back'},'Must roll back');
   await tx.addOutbox({id:`outbox_atomic_${randomUUID()}`,aggregateId:'document022a',eventType:'timeline.document.deleted',payload:{documentId:'document022a'},attempts:0,availableAt:new Date().toISOString(),publishedAt:null});
 }),{code:'PERSISTENCE_ACCESS_DENIED'});
 assert.deepEqual(await countState(),atomicBefore);check('Denied outbox rolls back canonical version, approval changes and earlier outbox writes in the same transaction');
 check('Application authorization independently denies cross-subject',!decide(currentAdmin,'document:read',{documentId:'document022a',ownerPrincipalId:actors.other.id}).allowed);
 check('Direct SQL with current admin still cannot see other subject',(await asContext(currentAdmin,"select id from timeline.documents where id='document022b'")).rows.length===0);
 const forged={...student,adminWorkspace:true,adminSubjectPrincipalId:actors.other.id,adminSubjectWpUserId:actors.other.wp};check('Direct SQL student flag cannot grant admin rights',(await asContext(forged,"select id from timeline.documents where id='document022b'")).rows.length===0);
 await ownerPool.query("update timeline.principals set status='SUSPENDED' where id=$1",[actors.student.id]);
 check('Suspended student own direct-ID request denied',(await call('/v1/documents/document022a',{actor:actors.student})).status===403);
 check('Existing admin grant cannot read suspended student through direct ID',(await call('/v1/documents/document022a',{actor:actors.admin,claims:scoped(actors.student)})).status===404);
 check('Existing signed admin context cannot bypass suspended subject RLS',(await asContext(currentAdmin,"select id from timeline.documents where id='document022a'")).rows.length===0);
 check('Admin cannot mint fresh grant for suspended student',(await call('/v1/admin/open',{actor:actors.admin,body:{wpUserId:actors.student.wp,verifiedAt:new Date().toISOString()},headers:bridgeHeaders})).status===404);
 await ownerPool.query("update timeline.principals set status='ACTIVE' where id=$1",[actors.student.id]);
 await ownerPool.query("update timeline.admin_resource_grants set revoked_at=clock_timestamp() where administrator_principal_id=$1 and document_id='document022a'",[actors.admin.id]);
 const revokedBefore=await countState();const revokedWrite=await call('/v1/documents/document022a/versions',{actor:actors.admin,claims:scoped(actors.student),body:{baseRevision:atomicDocument.revision,snapshot:atomicDocument,label:'Revoked'}});assert.equal(revokedWrite.status,404);assert.deepEqual(await countState(),revokedBefore);check('Revoked grant version write denied without partial writes');
 check('Revoked grant denied despite cached signed admin identity',(await asContext(currentAdmin,"select id from timeline.documents where id='document022a'")).rows.length===0);
 await ownerPool.query("update timeline.admin_resource_grants set revoked_at=clock_timestamp() where administrator_principal_id=$1 and document_id='document022b'",[actors.admin.id]);
 const oldClock=()=>new Date(Date.now()-20*60000);const expiredService=new PostgresTimelineAdminService(pool,oldClock);await expiredService.open(admin,{wpUserId:actors.other.wp,verifiedAt:oldClock().toISOString()});
 const expiredAdmin=await verifier.verify(await token(actors.admin,scoped(actors.other)),'expired-admin-test');check('Expired grant cannot be read by current admin',(await asContext(expiredAdmin,"select id from timeline.documents where id='document022b'")).rows.length===0);
 const expiredBefore=Number((await ownerPool.query("select current_revision from timeline.documents where id='document022b'")).rows[0].current_revision);const expiredWrite=await call('/v1/documents/document022b/versions',{actor:actors.admin,claims:scoped(actors.other),body:{baseRevision:otherBefore.revision,snapshot:otherBefore,label:'Expired'}});assert.equal(expiredWrite.status,404);assert.equal(Number((await ownerPool.query("select current_revision from timeline.documents where id='document022b'")).rows[0].current_revision),expiredBefore);check('Expired grant version write denied without partial writes');
 check('Student cannot directly mint an admin grant',await asContext(student,"select has_table_privilege(current_user,'timeline.admin_resource_grants','INSERT') as allowed").then(r=>r.rows[0].allowed===false));
 await ownerPool.query("update timeline.principals set status='SUSPENDED' where id=$1",[actors.admin.id]);check('Suspended admin cannot use internal bridge',(await call('/v1/admin/roster',{actor:actors.admin,body:{wpUserIds:[actors.other.wp],verifiedAt:new Date().toISOString()},headers:bridgeHeaders})).status===403);
 await assert.rejects(adminService.open(admin,{wpUserId:actors.other.wp,verifiedAt:new Date().toISOString()}),{code:'ADMIN_WORKSPACE_REQUIRED'});check('Admin service rechecks active actor even with previously verified context');
 await ownerPool.query("update timeline.principals set status='ACTIVE' where id=$1",[actors.admin.id]);
 const grants=(await ownerPool.query('select g.*,a.actor_id,a.action as audit_action,a.metadata_json from timeline.admin_resource_grants g join timeline.audit_events a on a.id=g.authorization_audit_id where g.administrator_principal_id=$1',[actors.admin.id])).rows;
 check('Each grant preserves exact SERVICE issuer audit and bounded 10-minute scope',grants.length===3&&grants.every(g=>g.created_by_principal_id==='timeline_admin_authority_022'&&g.actor_id===g.created_by_principal_id&&g.audit_action==='ADMIN_RESOURCE_GRANT'&&g.metadata_json.grant_id===g.id&&(new Date(g.expires_at)-new Date(g.starts_at))===600000));
 await adminService.open(admin,{wpUserId:actors.student.wp,verifiedAt:new Date().toISOString()});
 command('psql',['-h',temporary,'-p','57431','-U','d1_022_owner','-d','postgres','-v','ON_ERROR_STOP=1','-f',join(root,'database/migrations/20260907013000_d1_022_admin_outbox.down.sql')]);
 const rollbackBefore=await countState();const rollbackDoc=(await call('/v1/documents/document022a',{actor:actors.student})).data.document;const rollbackWrite=await call('/v1/documents/document022a/versions',{actor:actors.admin,claims:scoped(actors.student),body:{baseRevision:rollbackDoc.revision,snapshot:rollbackDoc,label:'After policy rollback'}});assert.equal(rollbackWrite.status,403);assert.deepEqual(await countState(),rollbackBefore);check('Policy-only rollback retains all rows and rejects the unsupported admin save atomically');
 command('psql',['-h',temporary,'-p','57431','-U','d1_022_owner','-d','postgres','-v','ON_ERROR_STOP=1','-f',join(root,'database/migrations/20260907012000_d1_022_admin_workspace.down.sql')]);
 check('Operational rollback revokes only022 issuer grants and retains custody',Number((await ownerPool.query("select count(*) from timeline.admin_resource_grants where created_by_principal_id='timeline_admin_authority_022' and revoked_at is null")).rows[0].count)===0&&Number((await ownerPool.query("select count(*) from timeline.audit_events where action='ADMIN_RESOURCE_GRANT'")).rows[0].count)===4);
 await assert.rejects(assertProductionDatabaseReadiness(pool),/TIMELINE_ADMIN_AUTHORITY_INCOMPLETE/);check('Rollback disables authority so new022 startup fails closed');
 await assert.rejects(adminService.open(admin,{wpUserId:actors.student.wp,verifiedAt:new Date().toISOString()}),{code:'ADMIN_WORKSPACE_REQUIRED'});check('Disabled rollback authority cannot mint fresh grants');
 check('Preexisting faculty grant records remain intact after rollback',Number((await ownerPool.query('select count(*) from timeline.faculty_grants')).rows[0].count)===2);
 check('Role and claim state reset after every transaction',(await pool.query("select current_user,current_setting('request.jwt.claims',true) as claims")).rows.every(r=>r.current_user==='timeline_api_test_022'&&!r.claims));
 process.stdout.write(JSON.stringify({schema:'d1-022-admin-workflow-builder-proof.1',postgresVersion:(await pool.query('show server_version')).rows[0].server_version,checks,passed:checks.length,failed:0,syntheticOnly:true,productionTouched:false,scope:'Real restricted login, API gateway, signed JWT, first-use directory, admin service and RLS. Live WordPress/LearnDash enrollment checks require separate root proof.'},null,2)+'\n');
}catch(error){process.stderr.write(JSON.stringify({failedAfter:checks.length,checks,error:String(error?.stack||error)},null,2)+'\n');process.exitCode=1;}
finally{if(server)await new Promise(resolve=>server.close(resolve));await pool?.end();await ownerPool?.end();if(started)command('pg_ctl',['-D',data,'-m','fast','-w','stop']);if(temporary.includes('d1-022-admin-workflow-'))await rm(temporary,{recursive:true,force:true});}
