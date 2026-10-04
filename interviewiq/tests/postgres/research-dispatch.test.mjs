import test from 'node:test';
import assert from 'node:assert/strict';
import {SignJWT} from 'jose';
import {createAuthorizer,proof} from '../../server/auth.mjs';
import {randomUUID,randomInt,createHash} from 'node:crypto';
import {createDatabase} from '../../server/db.mjs';
import {createCommands} from '../../server/commands.mjs';
import {checkCommittedResearch} from '../../server/research-dispatch.mjs';
import {readDisposableConnectionFile,qualifyDisposableConnection} from '../../scripts/disposable-db-guard.mjs';

test('durable authenticated dispatch, CAS, replay and owned records on disposable PostgreSQL',async t=>{
 const c=readDisposableConnectionFile(process.env.IIQ_RUNTIME_TEST_CONNECTION),database=createDatabase({databaseUrl:c.databaseUrl});
 await qualifyDisposableConnection(database.pool,c.databaseUrl,{role:'iiq_runtime_test'});await database.verifyRuntimeRole();t.after(()=>database.close());
 const a={id:randomUUID(),wpUserId:randomInt(1000000,1000000000),role:'student',tier:'360',assignments:[],eligible:true,displayName:'Synthetic research A',firstName:'Synthetic',zone:'America/New_York'},b={...a,id:randomUUID(),wpUserId:a?.wpUserId+1,displayName:'Synthetic research B'};
 const program={id:'synthetic-dispatch-program',name:'Synthetic program',track:'Categorical',registryReleaseId:'synthetic-registry-v1'};
 const config={enabled:true,coreOnly:true,publicOrigin:'https://missionmedinstitute.com',deepResearch:{enabled:true,ownerId:a.id,programId:program.id}},jobId=randomUUID();
 const owners={getProgram:async()=>program,getProgramResearch:async()=>({coverage:{programId:program.id,registryReleaseId:program.registryReleaseId},facts:[]})};
 const authConfig={...config,jwtIssuer:config.publicOrigin,jwtAudience:'interviewiq',jwtSecret:'synthetic-jwt-'.repeat(4),ownerProofSecret:'synthetic-owner-'.repeat(4),ownerIntrospectionUrl:config.publicOrigin+'/wp-json/missionmed-interviewiq/v1/introspect',ownerTimeoutMs:1000};
 let allowed=true;
 const authorize=createAuthorizer(authConfig,{fetchImpl:async(_url,{body})=>{const i=JSON.parse(body),now=Math.floor(Date.now()/1000),payload=JSON.stringify({audience:i.audience,subject:i.subject,wp_user_id:i.wp_user_id,session_verifier:i.session_verifier,nonce:i.nonce,request_sha256:createHash('sha256').update(body).digest('hex'),allowed,role:'student',tier:'360',assignment_student_ids:[],iat:now,exp:now+30});return new Response(JSON.stringify({payload,signature:proof(authConfig.ownerProofSecret,'mmiiq-introspection-response-v1',payload)}));}});
 const token=await new SignJWT({sub:a.id,wp_user_id:a.wpUserId,app_role:a.role,tier:a.tier,name:a.displayName,interviewiq_eligible:true,session_verifier:'f'.repeat(64)}).setProtectedHeader({alg:'HS256',typ:'JWT'}).setIssuer(config.publicOrigin).setAudience('interviewiq').setIssuedAt().setExpirationTime('60s').setJti(randomUUID()).sign(new TextEncoder().encode(authConfig.jwtSecret));
 const actualFresh=()=>authorize({headers:{authorization:'Bearer '+token}},'POST /api/commands');
 const q=(actor,sql,args=[])=>database.withActor(actor,db=>db.query(sql,args));
 let status='QUEUED',calls=0,transportWork=null,revalidate=actualFresh;
 const receipt=(binding,bodyHash)=>({binding,bodyHash,status,jobId,envelope:{payload:'synthetic signed receipt',signature:'a'.repeat(64)},verifiedAt:new Date().toISOString()});
 const transport=async(binding,digest)=>{calls++;assert.equal((await q(a,'SELECT request_id FROM iiq.research_job_grants WHERE request_id=$1',[binding.requestId])).rowCount,1);if(transportWork)await transportWork();return receipt(binding,digest);};
 const commands=createCommands({database,owners,config,researchTransport:transport});
 const execute=async(command,interviewId=null,data={},fresh=false)=>{const boot=await commands.bootstrap(a);return commands.execute(a,{command,interviewId,data,requestId:randomUUID(),expectedVersion:boot.version},fresh?{revalidateActor:()=>revalidate()}:{});};
 await commands.bootstrap(a);await commands.bootstrap(b);
 let iv,binding,original;
 await t.test('canonical save commits one durable intent, grant and current request',async()=>{
  const boot=await commands.bootstrap(a);original={command:'interview.create',data:{unresolved_input:'Synthetic invitation',program:program.id},requestId:randomUUID(),expectedVersion:boot.version};
  const result=await commands.execute(a,original);iv=result.interviewId;const d=result.bootstrap.state.demands[iv];binding={requestId:d.requestId,demandId:d.id,interviewId:iv,ownerId:a.id,programId:program.id,registryReleaseId:program.registryReleaseId};assert.equal(d.status,'queued');assert.equal(calls,0);
  assert.equal((await q(a,"SELECT * FROM iiq.outbox_events WHERE dedupe_key=$1",['research:'+binding.requestId])).rowCount,1);
 });
 await t.test('check reconciles only after primary commit; restart retains original demand',async()=>{
  const r=await execute('research.check',iv,{},true);assert.equal(r.researchCheck.status,'queued');assert.equal(r.researchCheck.requestId,binding.requestId);assert.equal(calls,1);
  const restarted=createCommands({database,owners,config,researchTransport:transport});assert.equal((await restarted.bootstrap(a)).state.demands[iv].requestId,binding.requestId);
  assert.equal((await q(a,"SELECT * FROM iiq.audit_events WHERE event_type='research.receipt' AND object_id=$1",[binding.demandId])).rowCount,1);
 });
 await t.test('same status retry reuses request and does not advance demand version',async()=>{const before=(await commands.bootstrap(a)).state.demands[iv].version;await execute('research.check',iv,{},true);assert.equal((await commands.bootstrap(a)).state.demands[iv].version,before);});
 await t.test('changed job ID denied without changing saved request',async()=>{const r=await checkCommittedResearch({database,actor:a,interviewId:iv,owners,config,revalidateActor:async()=>a,transport:async(b,h)=>({...receipt(b,h),jobId:randomUUID()})}).catch(e=>e);assert.equal(r.code,'research_unavailable');assert.equal((await commands.bootstrap(a)).state.demands[iv].requestId,binding.requestId);});
 await t.test('cross owner, administrator and revoked actor do not send',async()=>{const before=calls;for(const actor of [b,{...a,role:'admin'},{...a,eligible:false}])await assert.rejects(checkCommittedResearch({database,actor,interviewId:iv,owners,config,transport,revalidateActor:async()=>actor}));assert.equal(calls,before);assert.equal((await q(b,'SELECT id FROM iiq.research_demands WHERE id=$1',[binding.demandId])).rowCount,0);});
 await t.test('revocation while provider request in flight leaves request queued',async()=>{const before=(await commands.bootstrap(a)).state.demands[iv].version;transportWork=async()=>{allowed=false;};const r=await execute('research.check',iv,{},true).catch(e=>e);assert.ok(r);allowed=true;revalidate=actualFresh;transportWork=null;assert.equal((await commands.bootstrap(a)).state.demands[iv].version,before);});
 await t.test('out-of-order status responses cannot overwrite newer completion',async()=>{
  let resolve,started;const ready=new Promise(r=>started=r);const old=checkCommittedResearch({database,actor:a,interviewId:iv,owners,config,revalidateActor:async()=>a,transport:async(b,h)=>{started();await new Promise(r=>resolve=r);return {...receipt(b,h),status:'QUEUED'};}});await ready;
  status='COMPLETED';await execute('research.check',iv,{},true);resolve();assert.equal((await old).status,'changed');assert.equal((await commands.bootstrap(a)).state.demands[iv].status,'available');
 });
 await t.test('cancel during remote await holds no interview lock and rejects stale result',async()=>{
  let resolve,started;const ready=new Promise(r=>started=r);const old=checkCommittedResearch({database,actor:a,interviewId:iv,owners,config,revalidateActor:async()=>a,transport:async(b,h)=>{started();await new Promise(r=>resolve=r);return receipt(b,h);}});await ready;
  await execute('interview.lifecycle',iv,{action:'cancel'});resolve();await assert.rejects(old);await execute('interview.lifecycle',iv,{action:'restore'});assert.equal((await commands.bootstrap(a)).state.demands[iv].requestId,binding.requestId);
 });
 await t.test('replayed original command never dispatches retargeted request',async()=>{
  await execute('interview.identity',iv,{program:null,programName:'Manual same invitation'});const before=calls;const r=await commands.execute(a,original,{revalidateActor:async()=>a});assert.equal(r.replayed,true);await new Promise(r=>setTimeout(r,30));assert.equal(calls,before);assert.equal((await commands.bootstrap(a)).state.demands[iv].requestId,null);
  await assert.rejects(commands.execute(a,{...original,data:{unresolved_input:'Changed'}}),{code:'request_reused'});
 });
 await t.test('legacy manual replay has no inferred dispatch and default core still works',async()=>{
  const boot=await commands.bootstrap(b),body={command:'interview.create',data:{unresolved_input:'Manual core'},requestId:randomUUID(),expectedVersion:boot.version};const created=await commands.execute(b,body);const before=calls;await commands.execute(b,body,{revalidateActor:async()=>b});assert.equal(calls,before);assert.equal((await commands.bootstrap(b)).state.interviews[0].id,created.id);
 });
 await t.test('outbox remains untouched and original grant/history preserved',async()=>{const out=(await q(a,'SELECT status FROM iiq.outbox_events WHERE dedupe_key=$1',['research:'+binding.requestId])).rows[0];assert.equal(out.status,'pending');assert.equal((await q(a,'SELECT request_id FROM iiq.research_job_grants WHERE request_id=$1',[binding.requestId])).rowCount,1);assert.ok((await q(a,'SELECT id FROM iiq.interview_history WHERE interview_id=$1',[iv])).rowCount>=3);});
});
