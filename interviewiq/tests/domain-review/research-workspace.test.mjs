// Real disposable PostgreSQL and HTTP; synthetic identities/coverage only.
// This is not provider, source-fact, current entitlement or production proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomInt,createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createDatabase} from '../../server/db.mjs';
import {createCommands} from '../../server/commands.mjs';
import {createHandler} from '../../server/http.mjs';
import {publishReviewed} from '../../server/admin-commands.mjs';
import {writeResearch} from '../../server/research-commands.mjs';
import {MRX_AREAS,MRX_VERSION} from '../../server/research-standard.mjs';
import {assertDisposableTarget,qualifyDisposableConnection} from '../../scripts/disposable-db-guard.mjs';

test('durable provisional research through real RLS, commands, HTTP and reads',async t=>{
 assertDisposableTarget(process.env.IIQ_TEST_DATABASE_URL,{role:'iiq_runtime_test'});
 const database=createDatabase({databaseUrl:process.env.IIQ_TEST_DATABASE_URL});
 await qualifyDisposableConnection(database.pool,process.env.IIQ_TEST_DATABASE_URL,{role:'iiq_runtime_test'});
 t.after(()=>database.close());await database.verifyRuntimeRole();
 const base=randomInt(1000000,1000000000),actor=(role,i,tier)=>({id:randomUUID(),wpUserId:base+i,role,tier:tier||(role==='admin'?'admin':'360'),eligible:true,displayName:'Synthetic research test',firstName:'Synthetic',zone:'America/New_York',assignments:[]});
 const a=actor('student',1),b=actor('student',2,'ivprep_complete'),admin=actor('admin',3),mentor=actor('mentor',4,'assigned_mentor');
 const config={enabled:true,coreOnly:true,researchMissionsEnabled:true,publicOrigin:'https://missionmedinstitute.com',gatewaySecret:'synthetic-gateway-'.repeat(3),maxBodyBytes:262144};
 let current=Date.now(),state='UNKNOWN',bad=false,coverageCalls=0,remoteCalls=0;
 const hash=x=>createHash('sha256').update(x).digest('hex');
 const owners={async context(){return {};},async getResearchCoverage(_who,id){
   coverageCalls++;if(bad)throw new Error('SYNTHETIC_OWNER_FAILURE');
   const program={id,name:'Synthetic Program',track:'Internal Medicine',registryReleaseId:'synthetic_registry_v1'};
   const coverage={programId:id,registryReleaseId:program.registryReleaseId,observedAt:new Date(current).toISOString(),fields:Object.entries(MRX_AREAS).flatMap(([area,fields])=>fields.map(field=>({area,field,state:field==='research.visa'?state:'SUPPORTED'}))).sort((a,b)=>a.field.localeCompare(b.field,'en'))};
   coverage.receipt={publicRef:'rise-coverage-v1',sha256:hash(JSON.stringify(coverage))};return {program,coverage};
  },async publishReviewedReport(){remoteCalls++;throw new Error('must not publish');},async verifyResearchExecution(){remoteCalls++;throw new Error('must not execute');}};
 const factory=(overrides={},db=database)=>createCommands({database:db,owners,config:{...config,...overrides},clock:()=>new Date(current)});
 let commands=factory();const versions=new Map();
 const boot=async(who,c=commands)=>{const result=await c.bootstrap(who);versions.set(who.id,result.version);return result;};
 const envelope=(who,command,data,extra={})=>({command,data,requestId:randomUUID(),expectedVersion:versions.get(who.id)||0,...extra});
 const run=async(who,command,data,extra={},c=commands)=>{const result=await c.execute(who,envelope(who,command,data,extra));if(result.bootstrap)versions.set(who.id,result.bootstrap.version);return result;};
 const q=(who,sql,values=[])=>database.withActor(who,db=>db.query(sql,values));
 const read=(who,kind,id,c=commands)=>run(who,'research.read',{kind,...(id?{id}:{})},{},c);
 const deny=(p,code)=>assert.rejects(p,{code});
 let mission,submission,review,invalid,repair,original;
 const good=()=>({...structuredClone(mission.output_template),researched_at:new Date(current).toISOString(),permitted_use:true,execution_declaration:{provider:'SYNTHETIC',model:'SYNTHETIC',configuration:'TEST ONLY',completed_at:new Date(current).toISOString()}});
 const decide=(id,value='accepted',decision='quality')=>run(admin,'submission.decide',{submissionId:id,decision,value,reason:'Synthetic quality decision'});
 for(const who of [a,b,admin])await boot(who);
 await t.test('create one canonical own mission from one coverage response',async()=>{
  const n=coverageCalls,r=await run(a,'mission.create',{program:'test-research'});mission=r.mission;assert.equal(coverageCalls,n+1);assert.equal(r.id,mission.mission);
  const row=(await q(a,'SELECT * FROM iiq.research_missions WHERE id=$1',[r.id])).rows[0];assert.equal(row.owner_id,a.id);assert.equal(row.standard_version,MRX_VERSION);assert.deepEqual(row.public_payload,mission);
 });
 await t.test('new service and new observation reuse immutable packet and expiry',async()=>{
  current+=1000;commands=factory();await boot(a);const r=await run(a,'mission.create',{program:'test-research'});assert.equal(r.reused,true);assert.deepEqual(r.mission,mission);
  const detail=(await read(a,'mission',r.id)).research.mission;assert.deepEqual(detail.payload,mission);assert.equal(detail.name,'Synthetic Program');
 });
 await t.test('request replay is atomic and stable without another coverage call',async()=>{
  const e=envelope(a,'mission.create',{program:'test-research'});const first=await commands.execute(a,e),n=coverageCalls;
  const second=await commands.execute(a,e);assert.equal(second.replayed,true);assert.equal(second.resultId,first.id);assert.equal(coverageCalls,n);versions.set(a.id,second.bootstrap.version);
 });
 await t.test('concurrent writes serialize; fresh-version retry reuses same mission',async()=>{
  const results=await Promise.allSettled([commands.execute(a,envelope(a,'mission.create',{program:'test-research'})),commands.execute(a,envelope(a,'mission.create',{program:'test-research'}))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'version_conflict');await boot(a);
  assert.equal((await run(a,'mission.create',{program:'test-research'})).id,mission.mission);
 });
 await t.test('coverage failure and no gaps do not create or advance revision',async()=>{
  const before=(await boot(a)).version;bad=true;await assert.rejects(run(a,'mission.create',{program:'test-research'}));bad=false;
  state='SUPPORTED';await deny(run(a,'mission.create',{program:'test-research'}),'no_research_gaps');state='UNKNOWN';assert.equal((await boot(a)).version,before);
 });
 await t.test('changed gaps append new mission and retain original canonical ID',async()=>{
  state='STALE';const r=await run(a,'mission.create',{program:'test-research'});assert.notEqual(r.id,mission.mission);state='UNKNOWN';
  assert.equal((await run(a,'mission.create',{program:'test-research'})).id,mission.mission);assert.equal((await q(a,'SELECT id FROM iiq.research_missions WHERE owner_id=$1',[a.id])).rowCount,2);
 });
 await t.test('admin uses own identity; eligible IV Prep student independent; mentor rejected',async()=>{
  const r=await run(admin,'mission.create',{program:'test-research'});assert.notEqual(r.id,mission.mission);assert.equal((await q(admin,'SELECT owner_id FROM iiq.research_missions WHERE id=$1',[r.id])).rows[0].owner_id,admin.id);
  assert.notEqual((await run(b,'mission.create',{program:'test-research'})).id,mission.mission);await deny(run(mentor,'mission.create',{program:'test-research'}),'core_access_required');
  await deny(run({...admin,tier:'360'},'mission.create',{program:'test-research'}),'coming_soon');
 });
 await t.test('owner-only malformed original survives; cross-owner reads/repairs fail',async()=>{
  const text=' \nPRIVATE_MALFORMED_CANARY é {broken\n';invalid=(await run(a,'submission.upload',{missionId:mission.mission,text})).id;
  const r=(await read(a,'submission',invalid)).research.submission;assert.equal(r.original,text);assert.equal(r.sha256,hash(text));assert.equal(r.eligibleForReview,false);
  for(const who of [b,admin]){await deny(read(who,'submission',invalid),'not_found');await deny(read(who,'mission',mission.mission),'not_found');await deny(run(who,'submission.repair',{submissionId:invalid,text}),'not_found');}
  assert.equal((await q(admin,'SELECT id FROM iiq.review_items WHERE submission_id=$1',[invalid])).rowCount,0);
 });
 await t.test('unrepresentable or oversized UTF-8 originals fail before saving',async()=>{
  const n=(await q(a,'SELECT id FROM iiq.research_submissions WHERE owner_id=$1',[a.id])).rowCount;
  for(const text of ['\ud800','é'.repeat(64001),'hello\0world'])await assert.rejects(run(a,'submission.upload',{missionId:mission.mission,text}));
  assert.equal((await q(a,'SELECT id FROM iiq.research_submissions WHERE owner_id=$1',[a.id])).rowCount,n);
 });
 await t.test('valid original preserves exact whitespace; pending review stays unverified',async()=>{
  original=' \n'+JSON.stringify(good(),null,2)+'\n\t';const result=await run(a,'submission.upload',{missionId:mission.mission,text:original});submission=result.id;
  assert.equal(result.status,'quarantined');assert.equal(result.eligibleForReview,true);
  const detail=(await read(a,'submission',submission)).research.submission;assert.equal(detail.original,original);assert.equal(detail.sha256,hash(original));review=detail.reviewId;
  assert.deepEqual(detail.decisions,{execution:'unverified',quality:'pending',publication:'unpublished',credit:'none'});
 });
 await t.test('duplicate original and replay neither duplicate consent nor review',async()=>{
  const e=envelope(a,'submission.upload',{missionId:mission.mission,text:original});const first=await commands.execute(a,e),second=await commands.execute(a,e);versions.set(a.id,second.bootstrap.version);
  assert.equal(first.id,submission);assert.equal(first.duplicate,true);assert.equal(second.resultId,submission);assert.equal((await q(admin,'SELECT id FROM iiq.review_items WHERE submission_id=$1',[submission])).rowCount,1);
 });
 await t.test('repair appends ancestry and immutable version; originals resist UPDATE',async()=>{
  repair=(await run(a,'submission.repair',{submissionId:submission,text:JSON.stringify({...good(),limitations:['Synthetic repair']})})).id;
  const detail=(await read(a,'submission',repair)).research.submission;assert.equal(detail.parent,submission);assert.equal(detail.version,2);assert.equal((await read(a,'submission',submission)).research.submission.original,original);
  await assert.rejects(q(a,"UPDATE iiq.research_submissions SET parsed_package='{}' WHERE id=$1",[submission]));
 });
 await t.test('bootstrap contains compact own metadata; only admin sees permitted review list',async()=>{
  for(const who of [a,b,admin]){const result=await boot(who),text=JSON.stringify(result);assert.ok(result.capabilities.researchMissions);assert.doesNotMatch(text,/PRIVATE_MALFORMED_CANARY|output_template|execution_declaration/);assert.deepEqual(result.state.contrib.submissions,[]);assert.deepEqual(result.state.reviewQueue,[]);}
  assert.equal((await boot(a)).state.research.reviews,null);assert.ok((await boot(admin)).state.research.reviews.items.some(r=>r.id===submission));
  assert.ok(!(await boot(admin)).state.research.submissions.items.some(r=>r.id===submission));
 });
 await t.test('explicit admin review detail requires current permitted structurally eligible review',async()=>{
  await deny(read(a,'review',review),'admin_required');await deny(read(b,'review',review),'admin_required');
  assert.equal((await read(admin,'review',review)).research.submission.original,original);
  await deny(read(admin,'review',invalid),'not_found');await deny(decide(invalid),'submission_quarantined');
 });
 await t.test('quality is separate; original metadata unchanged and no remote execution',async()=>{
  await decide(submission);const row=(await q(admin,'SELECT * FROM iiq.review_items WHERE id=$1',[review])).rows[0];assert.equal(row.quality_status,'approved');assert.equal(row.execution_status,'unverified');assert.equal(row.publication_status,'unpublished');
  for(const [decision,value] of [['execution','verify'],['credit','grant'],['publication','publish']])await deny(decide(submission,value,decision),'coming_soon');
  const stored=(await q(a,'SELECT parsed_package FROM iiq.research_submissions WHERE id=$1',[submission])).rows[0].parsed_package;assert.equal(stored._iiq.status,'quarantined');assert.equal(stored._iiq.factsVerified,false);assert.equal(remoteCalls,0);
 });
 await t.test('central publication blocks provisional factual package even through legacy full caller',async()=>{
  await deny(database.withActor(admin,async db=>{const row=(await db.query('SELECT * FROM iiq.review_items WHERE id=$1',[review])).rows[0];return publishReviewed({db,actor:admin,owners,requestId:randomUUID()},row);},{write:true}),'coming_soon');assert.equal(remoteCalls,0);
 });
 await t.test('research read is genuinely read-only and leaves revision/idempotency/audit unchanged',async()=>{
  const count=()=>q(a,'SELECT (SELECT count(*) FROM iiq.revisions) AS revisions,(SELECT count(*) FROM iiq.request_idempotency) AS requests,(SELECT count(*) FROM iiq.audit_events) AS audit');const before=(await count()).rows;
  let proved=false;const wrapped={withActor(who,fn,options){return database.withActor(who,db=>fn({async query(sql,values){const result=await db.query(sql,values);if(sql==='SET TRANSACTION READ ONLY'){
   assert.equal((await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');await db.query('SAVEPOINT safety_probe');await deny(db.query("INSERT INTO iiq.audit_events(owner_id,actor_id,event_type,object_type,metadata) VALUES($1,$1,'test.probe','probe','{}')",[who.id]),'25006');await db.query('ROLLBACK TO SAVEPOINT safety_probe');proved=true;}return result;}}),options);}};
  const r=await read(a,'submission',submission,factory({},wrapped));assert.equal(r.research.submission.id,submission);assert.equal(proved,true);assert.deepEqual((await count()).rows,before);
 });
 await t.test('full/core flag-off cannot expose new originals or decision audit via legacy projection',async()=>{
  for(const coreOnly of [true,false])for(const researchMissionsEnabled of [true,false]){
   const c=factory({coreOnly,researchMissionsEnabled});const r=await c.bootstrap(admin);assert.doesNotMatch(JSON.stringify(r),/PRIVATE_MALFORMED_CANARY|output_template|Synthetic quality decision/);
   assert.ok(!r.state.contrib.submissions.some(x=>[invalid,submission,repair].includes(x.id)));assert.ok(!r.state.reviewQueue.some(x=>x.id===review));assert.equal(Boolean(r.state.research),researchMissionsEnabled);
   if(!researchMissionsEnabled)await deny(read(admin,'review',review,c),'coming_soon');
  }
 });
 await t.test('withdrawal retains original, closes admin reads/review, creates no remote outbox',async()=>{
  await deny(run(b,'submission.withdraw',{submissionId:submission}),'not_found');const before=(await q(a,'SELECT id FROM iiq.outbox_events')).rowCount;
  const e=envelope(a,'submission.withdraw',{submissionId:submission});const r=await commands.execute(a,e);versions.set(a.id,r.bootstrap.version);assert.equal(r.withdrawn,true);assert.equal((await commands.execute(a,e)).replayed,true);
  await deny(read(admin,'review',review),'not_found');await deny(decide(submission),'not_found');assert.ok(!(await boot(admin)).state.research.reviews.items.some(x=>x.id===submission));
  assert.equal((await read(a,'submission',submission)).research.submission.original,original);assert.equal((await q(a,'SELECT id FROM iiq.outbox_events')).rowCount,before);
  assert.equal((await run(a,'submission.withdraw',{submissionId:submission})).unchanged,true);assert.equal((await run(a,'submission.withdraw',{submissionId:invalid})).unchanged,true);
 });
 await t.test('real row-lock interleaving serializes quality with consent revocation',async()=>{
  const repairReview=(await read(a,'submission',repair)).research.submission.reviewId;
  let unlock,locked;const waitLock=new Promise(r=>locked=r),release=new Promise(r=>unlock=r);let withdrawing;
  const decision=database.withActor(admin,async db=>{
   await db.query('SELECT id FROM iiq.review_items WHERE id=$1 FOR UPDATE',[repairReview]);locked();await release;
   return writeResearch({db,actor:admin,config,command:'submission.decide',data:{submissionId:repair,decision:'quality',value:'accepted',reason:'Concurrent synthetic review'}});
  },{write:true});
  await waitLock;
  // Start a second real connection and signal immediately before its UPDATE.
  let started;const startedPromise=new Promise(r=>started=r);
  withdrawing=database.withActor(a,async db=>{const row=(await db.query('SELECT consent_id,pg_backend_pid() AS pid FROM iiq.review_items WHERE id=$1',[repairReview])).rows[0];started(row.pid);await db.query("UPDATE iiq.consents SET status='revoked',revoked_at=now() WHERE id=$1",[row.consent_id]);});
  try{const pid=await startedPromise;let blocked=false;const deadline=Date.now()+2000;
   while(Date.now()<deadline){const r=await database.pool.query('SELECT cardinality(pg_blocking_pids($1))>0 AS blocked',[pid]);if(r.rows[0].blocked){blocked=true;break;}await new Promise(r=>setImmediate(r));}
   assert.equal(blocked,true,'real revocation waits on held review lock');unlock();await Promise.all([decision,withdrawing]);
  }finally{unlock();await Promise.allSettled([decision,withdrawing]);}
  assert.equal((await q(a,'SELECT status FROM iiq.review_items WHERE id=$1',[repairReview])).rows[0].status,'withdrawn');await deny(read(admin,'review',repairReview),'not_found');await deny(decide(repair),'not_found');
 });
 await t.test('keyset pages preserve microseconds, bounded size and owner isolation',async()=>{
  for(let i=0;i<22;i++)await run(b,'mission.create',{program:`page-program-${i}`});
  const seen=new Set();let cursor;do{const r=(await run(b,'research.read',{kind:'missions',...(cursor?{cursor}:{})})).research;assert.ok(r.items.length<=20);for(const item of r.items){assert.ok(!seen.has(item.id));assert.notEqual(item.id,mission.mission);seen.add(item.id);}cursor=r.nextCursor;if(cursor)assert.match(cursor.at,/\.\d{6}Z$/);}while(cursor);
  assert.equal(seen.size,23);await deny(run(b,'research.read',{kind:'missions',cursor:{at:'2026-99-99T00:00:00.000000Z',id:randomUUID()}}),'invalid_cursor');
  await deny(run(b,'research.read',{kind:'missions',ownerId:a.id}),'unexpected_fields');
 });
 await t.test('research enablement leaves unrelated CORE gates closed',async()=>{
  await deny(run(a,'interview.create',{program:'test-research',programName:'Synthetic'}),'coming_soon');await deny(run(a,'prep.save',{}),'coming_soon');await deny(run(a,'review.approve',{reviewId:review}),'coming_soon');
 });
 await t.test('real HTTP opens stored research, rejects malformed UTF-8 and protects gateway',async()=>{
  const logs=[],server=createServer(createHandler({config,database,authorize:async()=>a,commands,owners,logger:x=>logs.push(x)}));server.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}/api/commands`,headers={Origin:config.publicOrigin,'X-MMED-IIQ-Gateway':config.gatewaySecret,'Content-Type':'application/json'};
  try{const response=await fetch(url,{method:'POST',headers,body:JSON.stringify(envelope(a,'research.read',{kind:'mission',id:mission.mission}))});assert.equal(response.status,200);assert.deepEqual((await response.json()).research.mission.payload,mission);
   const malformed=await fetch(url,{method:'POST',headers,body:Buffer.from([123,34,120,34,58,34,0xc3,0x28,34,125])});assert.equal(malformed.status,400);
   const denied=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(denied.status,403);assert.doesNotMatch(JSON.stringify(logs),/PRIVATE_MALFORMED_CANARY|execution_declaration/);
  }finally{server.close();server.closeAllConnections();await once(server,'close');}
 });
});
