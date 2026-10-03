import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {SignJWT} from 'jose';
import {createDatabase} from '../../server/db.mjs';
import {createAuthorizer,proof} from '../../server/auth.mjs';
import {createCommands} from '../../server/commands.mjs';
import {createHandler} from '../../server/http.mjs';

assert.ok(process.env.IIQ_TEST_DATABASE_URL,'Run with a disposable synthetic PostgreSQL database.');
const config={enabled:true,databaseUrl:process.env.IIQ_TEST_DATABASE_URL,publicOrigin:'https://missionmedinstitute.com',jwtIssuer:'https://missionmedinstitute.com',
  jwtSecret:randomBytes(48).toString('hex'),ownerProofSecret:randomBytes(48).toString('hex'),gatewaySecret:randomBytes(48).toString('hex'),
  ownerIntrospectionUrl:'https://missionmedinstitute.com/wp-json/missionmed-interviewiq/v1/introspect',ownerTimeoutMs:1000,maxBodyBytes:262144,release:'synthetic-http-test'};
const database=createDatabase(config),sqlErrors=[],safeLogs=[];
const originalTransaction=database.withActor;
database.withActor=async(...args)=>{try{return await originalTransaction(...args);}catch(e){sqlErrors.push({code:e.code,message:e.message,constraint:e.constraint});throw e;}};
const A={id:randomUUID(),wpUserId:Math.floor(Math.random()*1e8)+1e8,name:'Synthetic Student Alpha',role:'student',tier:'360',assignments:[],allowed:true};
const B={...A,id:randomUUID(),wpUserId:A.wpUserId+1,name:'Synthetic Student Beta'};
const M={...A,id:randomUUID(),wpUserId:A.wpUserId+2,name:'Synthetic Assigned Mentor',role:'mentor',tier:'assigned_mentor',assignments:[A.id]};
const U={...M,id:randomUUID(),wpUserId:A.wpUserId+3,name:'Synthetic Unassigned Mentor',assignments:[B.id]};
const Admin={...A,id:randomUUID(),wpUserId:A.wpUserId+4,name:'Synthetic Admin',role:'admin',tier:'admin'};
const actors=[A,B,M,U,Admin];for(const actor of actors)actor.verifier=randomBytes(32).toString('hex');
const ownerFetch=async(_url,{body})=>{
  const input=JSON.parse(body),actor=actors.find(x=>x.id===input.subject),now=Math.floor(Date.now()/1000);
  const payload=JSON.stringify({audience:input.audience,subject:input.subject,wp_user_id:input.wp_user_id,session_verifier:input.session_verifier,
    nonce:input.nonce,request_sha256:createHash('sha256').update(body).digest('hex'),allowed:actor.allowed,role:actor.role,tier:actor.tier,
    assignment_student_ids:actor.assignments,iat:now,exp:now+30});
  return new Response(JSON.stringify({payload,signature:proof(config.ownerProofSecret,'mmiiq-introspection-response-v1',payload)}));
};
const authorize=createAuthorizer(config,{fetchImpl:ownerFetch});
const program={id:'synthetic-api-program',name:'Synthetic Program for API Tests',track:'Categorical',zone:'America/New_York',fact_ids:[]};
const owners={ivocAvailable:false,async getProgram(_actor,id){assert.equal(id,program.id);return program;},async searchPrograms(){return {programs:[program]};},
  async context(){return {programs:[program],facts:[],sources:[],stories:[],status:{rise:'available',storyforge:'unavailable'}};},
  async validateBasis(_actor,_row,basis){return basis;},async storyConsent(){}};
const commands=createCommands({database,owners,config});
let server,base,interviewId;
before(async()=>{
  await database.verifyRuntimeRole();
  server=createServer(createHandler({config,database,authorize,commands,owners,logger:x=>safeLogs.push(x)}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
  for(const actor of actors) {
    actor.token=await new SignJWT({sub:actor.id,wp_user_id:actor.wpUserId,app_role:actor.role,tier:actor.tier,name:actor.name,
      interviewiq_eligible:true,session_verifier:actor.verifier}).setProtectedHeader({alg:'HS256',typ:'JWT'}).setIssuer(config.jwtIssuer).setAudience('interviewiq')
      .setIssuedAt().setExpirationTime('60s').setJti(randomUUID()).sign(new TextEncoder().encode(config.jwtSecret));
  }
});
after(async()=>{await new Promise(resolve=>server.close(resolve));await database.close();});
async function call(actor,path='/api/bootstrap',body,headers={}) {
  const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:config.publicOrigin,'X-MMED-IIQ-Gateway':config.gatewaySecret,
    Authorization:`Bearer ${actor.token}`,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,body:await response.json(),headers:response.headers};
}
async function ok(actor,path,body) {const result=await call(actor,path,body);assert.equal(result.status,200,JSON.stringify({body:result.body,lastError:sqlErrors.at(-1)}));return result.body;}
async function act(command,data={},id=interviewId,actor=A) {
  const boot=await ok(actor),request={command,data,interviewId:id||null,requestId:randomUUID(),expectedVersion:boot.version};
  return ok(actor,'/api/commands',request);
}
test('actual protected HTTP bootstrap creates only caller identity and rejects bypasses',async()=>{
  const a=await call(A);assert.equal(a.status,200,JSON.stringify({body:a.body,sqlErrors}));assert.equal(a.body.actor.id,A.id);assert.equal(a.body.version,0);
  assert.equal(a.headers.get('cache-control'),'private, no-store');assert.equal(a.body.state.interviews.length,0);
  assert.equal((await call(A,'/api/bootstrap',undefined,{'X-MMED-IIQ-Gateway':''})).status,403);
  assert.equal((await call(A,'/api/bootstrap',undefined,{Origin:'https://attacker.invalid'})).status,403);
  assert.equal((await call(A,'/api/bootstrap',undefined,{Cookie:'secret=not-forwarded'})).status,403);
  assert.equal((await call(A,'/api/bootstrap?token=never')).status,400);
});
test('invalid DST create is atomic; valid undated offer persists on fresh read',async()=>{
  const boot=await ok(A);
  const bad=await call(A,'/api/commands',{command:'interview.create',data:{unresolved_input:'Rejected gap',schedule:{date:'2027-03-14',time:'02:30',zone:'America/New_York'}},requestId:randomUUID(),expectedVersion:boot.version});
  assert.equal(bad.status,422);const unchanged=await ok(A);assert.equal(unchanged.version,0);assert.equal(unchanged.state.interviews.length,0);
  const created=await act('interview.create',{unresolved_input:'Actual synthetic offer',deadline:'2026-11-01'},null);
  interviewId=created.interviewId;assert.ok(interviewId);const after=await ok(A),row=after.state.interviews.find(x=>x.id===interviewId);
  assert.equal(row.instant,null);assert.equal(row.date,null);assert.equal(row.deadline,'2026-11-01');assert.equal(after.state.demands[interviewId].status,'waiting for identity');
});
test('same request replays once; altered replay and competing stale writes cannot duplicate',async()=>{
  const boot=await ok(A),body={command:'interview.create',interviewId:null,data:{unresolved_input:'Replay candidate'},requestId:randomUUID(),expectedVersion:boot.version};
  const first=await ok(A,'/api/commands',body),again=await ok(A,'/api/commands',body);
  assert.equal(first.interviewId,again.interviewId);assert.equal(again.replayed,true);assert.equal(first.bootstrap.version,again.bootstrap.version);
  assert.equal((await call(A,'/api/commands',{...body,data:{unresolved_input:'Changed replay'}})).status,409);
  const next={command:'prep.save',interviewId,data:{questions:'Which curriculum features are current?'},requestId:randomUUID(),expectedVersion:first.bootstrap.version};
  const pair=await Promise.all([call(A,'/api/commands',next),call(A,'/api/commands',{...next,requestId:randomUUID(),data:{questions:'Concurrent draft'}})]);
  assert.deepEqual(pair.map(x=>x.status).sort(),[200,409]);
});
test('identity, explicit DST fold, related events and cancel/restore preserve one record',async()=>{
  await act('interview.identity',{program:program.id});
  const s={date:'2026-11-01',time:'01:30',zone:'America/New_York',fold:1,duration:60,travel_minutes:null,format:'virtual',joining:'https://example.org/synthetic-meeting'};
  const scheduled=await act('interview.schedule',s);let row=scheduled.bootstrap.state.interviews.find(x=>x.id===interviewId);
  assert.equal(row.instant,'2026-11-01T06:30:00.000Z');assert.equal(row.program,program.id);
  await act('event.create',{kind:'Resident social',date:'2026-11-01',time:'01:15',zone:s.zone,fold:0,duration_minutes:null,note:'Synthetic logistics note'});
  const cancelled=await act('interview.lifecycle',{action:'cancel'});assert.equal(cancelled.bootstrap.state.interviews.find(x=>x.id===interviewId).state,'cancelled');
  const restored=await act('interview.lifecycle',{action:'restore'});row=restored.bootstrap.state.interviews.find(x=>x.id===interviewId);
  assert.equal(row.state,'scheduled');assert.equal(row.related.length,1);assert.equal(row.related[0].instant,'2026-11-01T05:15:00.000Z');assert.ok(row.history.length>=4);
});
test('private preparation and debrief survive reload; exact questions and correction stay private',async()=>{
  const saved=await act('prep.save',{why:{text:'PRIVATE WHY ALPHA',basis:null,edited:true},questions:'PRIVATE QUESTION ALPHA'});
  assert.equal(saved.bootstrap.state.why[interviewId].basis,null);
  // Reusing a canonical readback in manual/autosave must not send internal
  // edited metadata as an unsupported evidence-basis field.
  await act('prep.save',{why:saved.bootstrap.state.why[interviewId]});
  await act('debrief.occurrence',{occurrence:'later'});assert.equal((await ok(A)).state.interviews.find(x=>x.id===interviewId).confirmed_occurred,null);
  await act('debrief.occurrence',{occurrence:'yes'});
  await act('debrief.save',{edited:'PRIVATE RAW EDIT ALPHA: three conversations.',narrative:'PRIVATE NARRATIVE ALPHA',fields:{individual_count:'3',roles:['faculty','residents'],formats:['individual'],social:'unknown'},questions:[{text:'PRIVATE EXACT QUESTION',recall:'exact'}],saved:true});
  await act('debrief.propose',{edited:'PRIVATE RAW EDIT ALPHA: two conversations.'});await act('debrief.accept');
  let boot=await ok(A);assert.equal(boot.state.debriefs[interviewId].fields.individual_count,'2');assert.equal(boot.state.debriefs[interviewId].questions[0].recollection,'exact');
  await act('debrief.save',{edited:'My correction is the current account.'});boot=await ok(A);assert.equal(boot.state.debriefs[interviewId].proposed,null);
  assert.equal(boot.state.why[interviewId].text,'PRIVATE WHY ALPHA');assert.equal(boot.state.debriefs[interviewId].narrative,'PRIVATE NARRATIVE ALPHA');
});
test('student/mentor/admin read models and direct identifiers enforce private boundaries',async()=>{
  for(const actor of [B,U]) {
    const boot=await ok(actor);assert.equal(boot.state.interviews.some(x=>x.id===interviewId),false);
    const denied=await call(actor,'/api/commands',{command:'prep.save',interviewId,data:{questions:'steal'},requestId:randomUUID(),expectedVersion:boot.version});
    assert.ok([403,404].includes(denied.status));
  }
  for(const actor of [M,Admin]) {
    const boot=await ok(actor);assert.equal(boot.state.interviews.some(x=>x.id===interviewId),true);
    const encoded=JSON.stringify(boot);
    for(const canary of ['PRIVATE WHY ALPHA','PRIVATE QUESTION ALPHA','PRIVATE RAW EDIT ALPHA','PRIVATE NARRATIVE ALPHA','PRIVATE EXACT QUESTION','My correction is the current account.'])
      assert.equal(encoded.includes(canary),false,`Private content reached ${actor.role}: ${canary}`);
    for(const key of ['why','questions','debriefs','practice'])assert.equal(Object.keys(boot.state[key]).length,0);
  }
  M.assignments=[];assert.equal((await ok(M)).state.interviews.some(x=>x.id===interviewId),false);M.assignments=[A.id];
});
test('learning sharing is explicit and correction requires reconfirmation',async()=>{
  await act('learning.propose',{goal:'Pause before the second example',source:'student-entered'});await act('learning.confirm');
  assert.equal((await ok(M)).state.learning[A.id],undefined);await act('learning.mentor',{visible:true});
  assert.equal((await ok(M)).state.learning[A.id].goal,'Pause before the second example');
  await act('learning.correct',{goal:'Use one concrete example'});assert.equal((await ok(M)).state.learning[A.id],undefined);
  assert.equal((await ok(A)).state.learning[A.id].status,'proposed');
});
test('optional excerpt is deduplicated and withdrawal revokes only shared permission',async()=>{
  const shared=await act('share.submit',{excerpt:'Three individual conversations; format was clearly explained.',permitted:true,deidentified:true});
  const again=await act('share.submit',{excerpt:'Three individual conversations; format was clearly explained.',permitted:true,deidentified:true});assert.equal(again.id,shared.id);
  await act('share.retract',{reviewId:shared.id});const boot=await ok(A);assert.equal(boot.state.reviewQueue.find(x=>x.id===shared.id).status,'retracted');
  assert.equal(boot.state.debriefs[interviewId].edited,'My correction is the current account.');
});
test('real typed rehearsal uses current context, preserves first draft and supports student correction',async()=>{
  const started=await act('practice.start',{program:program.id});const attemptId=started.id;
  assert.equal(started.bootstrap.state.practice[interviewId].at(-1).generic,true);
  await act('practice.feedback',{attemptId,draft:'I organized a checklist. It reduced errors by 50%. That is my story.'});
  let attempt=(await ok(A)).state.practice[interviewId].find(x=>x.id===attemptId);
  assert.equal(attempt.diagnosis.find(x=>x.k==='outcome').ok,false);assert.match(attempt.change,/Verify/);
  const index=attempt.diagnosis.findIndex(x=>x.k==='outcome');await act('practice.overrule',{attemptId,which:'diagnosis',index});
  await act('practice.retry',{attemptId,retry:'I organized a checklist. I would bring careful follow-up to your program.'});
  await act('practice.reflect',{attemptId,reflection:'The change helped'});attempt=(await ok(A)).state.practice[interviewId].find(x=>x.id===attemptId);
  assert.match(attempt.draft,/50%/);assert.equal(attempt.retry.includes('50%'),false);assert.equal(attempt.reflection,'The change helped');
  assert.equal(attempt.diagnosis[index].overruled,true);assert.equal(attempt.retryDiagnosis.find(x=>x.k==='closing').ok,true);
});
test('mentor priority is visible to its target, while unassigned notes and policy bypasses are denied',async()=>{
  await act('mentor.priority',{studentId:A.id,text:'Confirm the joining link before interview day.'},null,M);
  assert.equal((await ok(A)).state.mentorPriority[A.id].text,'Confirm the joining link before interview day.');
  const wrong=await call(U,'/api/commands',{command:'mentor.priority',interviewId:null,data:{studentId:A.id,text:'Not my student'},requestId:randomUUID(),expectedVersion:(await ok(U)).version});assert.equal(wrong.status,403);
  const policy=await call(A,'/api/commands',{command:'policy.update',interviewId:null,data:{key:'contributions',value:true,reason:'Client cannot approve policy'},requestId:randomUUID(),expectedVersion:(await ok(A)).version});assert.equal(policy.status,403);
});
test('attendance correction withdraws the shared review but preserves private text',async()=>{
  const review=await act('share.submit',{excerpt:'Another permitted synthetic excerpt for correction.',permitted:true,deidentified:true});
  await act('debrief.occurrence',{occurrence:'no'});const boot=await ok(A);
  assert.equal(boot.state.reviewQueue.find(x=>x.id===review.id).status,'retracted');
  assert.equal(boot.state.debriefs[interviewId].edited,'My correction is the current account.');
  await act('debrief.occurrence',{occurrence:'yes'});
  await act('debrief.save',{fields:{individual_count:null,formats:[],social:'unknown'}});
  assert.equal((await ok(A)).state.debriefs[interviewId].fields.individual_count,undefined);
});
test('export is caller scoped even for admin and stale session is denied before data reads',async()=>{
  const exported=await act('privacy.export',{},null);assert.ok(exported.export.interviews.some(x=>x.id===interviewId));
  const adminExport=await act('privacy.export',{},null,Admin);assert.equal(adminExport.export.interviews.some(x=>x.id===interviewId),false);assert.equal(JSON.stringify(adminExport.export).includes('PRIVATE '),false);
  A.allowed=false;assert.equal((await call(A)).status,401);A.allowed=true;
  assert.equal(safeLogs.some(x=>JSON.stringify(x).includes('PRIVATE ')),false);assert.equal(safeLogs.some(x=>JSON.stringify(x).includes(A.token)),false);
});
