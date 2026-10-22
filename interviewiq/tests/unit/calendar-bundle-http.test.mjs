import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {createHash} from 'node:crypto';
import {createHandler} from '../../server/http.mjs';import {bindOwnerSession} from '../../server/owner-session.mjs';import {createCalendarDirectory} from '../../server/calendar-directory.mjs';import {admissionProof} from '../../server/calendar-admission.mjs';import {AppError} from '../../server/errors.mjs';
const own='00000000-0000-4000-8000-000000000001',peer='00000000-0000-4000-8000-000000000002',ref='00000000-0000-4000-8000-000000000003';
async function fixture({role='student',fail=false,revoke=false,denyOwner=false,changeTier=false,expire=false,onLog=()=>{},expireDuringBootstrap=false,calendarEnabled=true,coreOnly=true}={},run){
 const config={enabled:true,coreOnly,calendar:{enabled:calendarEnabled},gatewaySecret:'synthetic-gateway-secret-of-at-least-32-characters',ownerProofSecret:'synthetic-owner-proof-secret',publicOrigin:'https://missionmedinstitute.com',jwtIssuer:'https://missionmedinstitute.com',ownerIntrospectionUrl:'https://missionmedinstitute.com/wp-json/missionmed-interviewiq/v1/introspect'};
 let ownerChecks=0,peerChecks=0,directoryChecks=0,bootstrapReads=0,expired=false;
 const actor=()=>bindOwnerSession(Object.freeze({id:own,wpUserId:1,role,tier:changeTier&&ownerChecks>1?'ivprep_complete':role==='admin'?'admin':'360',eligible:true}),{verifier:'a'.repeat(64),expiresAt:Date.now()+(expire&&expired?-1:30000)});
 const authorize=async()=>{ownerChecks++;if(denyOwner||ownerChecks>1&&revoke)throw new AppError(401,'session_unavailable','Revoked');return actor();};
 const event={event_ref:ref,owner_id:peer,wp_user_id:2,program_name:'Synthetic program',local_date:'2026-10-13'};
 const database={withActor:async(_a,fn)=>fn({query:async sql=>({rows:sql.includes('calendar_candidates')?[event]:sql.includes('calendar_public')?[event]:[]})})};
 const calendarAdmission=async(_a,pairs)=>{peerChecks++;if(fail)throw new AppError(503,'calendar_admission_unavailable','Access cannot be verified');if(expire&&peerChecks===2)bindOwnerSession(_a,{verifier:'a'.repeat(64),expiresAt:Date.now()-1});return{pairs:pairs.map(x=>({...x,allowed:true}))};};
 const calendarDirectory=createCalendarDirectory(config,{fetchImpl:async(_u,{body})=>{directoryChecks++;const p=JSON.parse(body),iat=Math.floor(Date.now()/1000),payload=JSON.stringify({audience:p.audience,subject:p.subject,wp_user_id:p.wp_user_id,nonce:p.nonce,request_sha256:createHash('sha256').update(body).digest('hex'),action:p.action,allowed:true,role:'admin',tier:'admin',students:[],nextAfter:null,iat,exp:iat+30});return new Response(JSON.stringify({payload,signature:admissionProof(config.ownerProofSecret,'mmiiq-directory-response-v1',payload)}),{headers:{'content-type':'application/json'}});}});
 const commands={bootstrap:async a=>{bootstrapReads++;if(expireDuringBootstrap)bindOwnerSession(a,{verifier:'a'.repeat(64),expiresAt:Date.now()-1});return{actor:{id:a.id,role:a.role,tier:a.tier},version:4,state:{interviews:[{id:'own-saved'}]},workspacePhase:'calendar'};}};
 const server=createServer(createHandler({config,database,authorize,commands,calendarAdmission,calendarDirectory,logger:onLog}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const get=async(query,path='/api/bootstrap')=>{const r=await fetch(`http://127.0.0.1:${server.address().port}${path}${query}`,{headers:{Origin:config.publicOrigin,'X-MMED-IIQ-Gateway':config.gatewaySecret}});return{status:r.status,cache:r.headers.get('cache-control'),timing:r.headers.get('server-timing'),body:await r.json()};};
 try{await run({get,counts:()=>({ownerChecks,peerChecks,directoryChecks,bootstrapReads})});}finally{await new Promise(r=>server.close(r));}
}
const bounded='?view=calendar&start=2026-10-01&end=2026-10-31';
test('student bundle uses one normal owner check and both existing peer checks in a private response',async()=>fixture({},async f=>{const r=await f.get(bounded);assert.equal(r.status,200);assert.equal(r.cache,'private, no-store');assert.equal(r.body.state.interviews[0].id,'own-saved');assert.equal(r.body.calendarBundle.page.deidentified,true);assert.equal(r.body.calendarBundle.page.events.length,1);assert.equal(r.body.calendarBundle.page.events[0].owner_id,undefined);assert.deepEqual(f.counts(),{ownerChecks:1,peerChecks:2,directoryChecks:0,bootstrapReads:1});}));
test('administrator bundle retains both actual signed directory checks and readOnly response',async()=>fixture({role:'admin'},async f=>{const r=await f.get(bounded);assert.equal(r.status,200);assert.equal(r.body.calendarBundle.kind,'overview');assert.equal(r.body.calendarBundle.page.readOnly,true);assert.deepEqual(f.counts(),{ownerChecks:1,peerChecks:0,directoryChecks:2,bootstrapReads:1});}));
test('ambiguous peer failure needs a fresh owner check before own-only recovery and does not retry cohort',async()=>fixture({fail:true},async f=>{const r=await f.get(bounded);assert.equal(r.status,200);assert.equal(r.body.calendarBundle.error.code,'calendar_bundle_partial');assert.equal(r.body.calendarBundle.page,undefined);assert.deepEqual(f.counts(),{ownerChecks:2,peerChecks:1,directoryChecks:0,bootstrapReads:1});}));
test('revoked owner or changed tier on fallback never receives private bootstrap or peer data',async()=>{for(const options of [{fail:true,revoke:true},{fail:true,changeTier:true}])await fixture(options,async f=>{const r=await f.get(bounded);assert.equal(r.status,401);assert.equal(r.body.state,undefined);assert.equal(f.counts().bootstrapReads,0);});});
test('unsupported, duplicate, partial and oversized queries fail before owner or data reads; legacy client stays valid',async()=>fixture({},async f=>{for(const q of ['?view=calendar&start=2026-10-01','?view=calendar&start=2026-10-01&end=2027-10-01','?view=calendar&start=2026-02-30&end=2026-03-31','?view=calendar&start=2026-10-01&end=2026-10-31&start=2026-10-02','?start=2026-10-01&end=2026-10-31&view=full']){assert.ok([400,422].includes((await f.get(q)).status));}assert.equal(f.counts().ownerChecks,0);assert.equal((await f.get('?view=calendar')).status,200);assert.equal((await f.get('')).status,200);assert.equal(f.counts().peerChecks,0);}));

test('owner proof expiry after successful peer reads fails closed before own bootstrap',async()=>fixture({expire:true},async f=>{const r=await f.get(bounded);assert.equal(r.status,401);assert.equal(r.body.state,undefined);assert.equal(f.counts().bootstrapReads,0);}));

test('owner expiry during own read denies both successful and partial bundles',async()=>{for(const fail of [false,true])await fixture({fail,expireDuringBootstrap:true},async f=>{const r=await f.get(bounded);assert.equal(r.status,401);assert.equal(r.body.state,undefined);assert.equal(f.counts().bootstrapReads,1);});});
test('disabled Calendar keeps ordinary bootstrap and full mode compatible',async()=>{for(const coreOnly of [true,false])await fixture({coreOnly,calendarEnabled:false},async f=>{const r=await f.get(bounded);assert.equal(r.status,503);assert.equal(r.body.error.code,'calendar_unavailable');assert.equal((await f.get('')).status,200);assert.equal(f.counts().peerChecks,0);});});

// Timing must remain non-authorizing and must not leak private payloads.
test('bounded startup timing records fixed numeric spans without private request or response data',async()=>{
 const logs=[];await fixture({onLog:x=>logs.push(x)},async f=>{assert.equal((await f.get(bounded)).status,200);});
 const entry=logs.find(x=>x.event==='calendar_bootstrap_timing');assert.ok(entry);assert.deepEqual(Object.keys(entry).sort(),['event','method','path','requestId','stages','status','totalMs']);assert.equal(entry.status,200);assert.equal(entry.stages.owner.count,1);assert.equal(entry.stages.admission.count,2);assert.equal(entry.stages.cohort.count,1);assert.equal(entry.stages.own.count,1);assert.equal(entry.stages.directory.count,0);
 for(const span of Object.values(entry.stages)){assert.ok(Number.isFinite(span.ms)&&span.ms>=0);assert.deepEqual(Object.keys(span).sort(),['count','ms']);}
 const text=JSON.stringify(entry);for(const secret of [own,peer,ref,'2026-10-01','Synthetic program','own-saved'])assert.ok(!text.includes(secret));
});
test('timing is absent on legacy bootstrap and diagnostic logger failure cannot break a successful read',async()=>{
 const logs=[];await fixture({onLog:x=>logs.push(x)},async f=>{assert.equal((await f.get('?view=calendar')).status,200);assert.equal((await f.get('')).status,200);});assert.ok(!logs.some(x=>x.event==='calendar_bootstrap_timing'));
 await fixture({onLog:()=>{throw Error('diagnostic sink unavailable');}},async f=>{const r=await f.get(bounded);assert.equal(r.status,200);assert.equal(r.body.calendarBundle.page.events.length,1);});
});

const timingNames=['owner','cohort','own','admission','directory','total'];
function assertAggregateTiming(value){
 assert.equal(typeof value,'string');assert.ok(value.length<=256);
 const parts=value.split(', ');assert.equal(parts.length,timingNames.length);
 for(const [index,name] of timingNames.entries())assert.match(parts[index],new RegExp(`^iiq_${name};dur=(?:0|[1-9][0-9]{0,4})\\.[0-9]$`));
 for(const privateValue of [own,peer,ref,'2026-10-01','Synthetic program','own-saved'])assert.ok(!value.includes(privateValue));
}
test('successful bounded startup exposes only numeric aggregate timings with unchanged authorization and private body',async()=>{
 for(const role of ['student','admin'])await fixture({role,onLog:()=>{throw Error('Log sink unavailable');}},async f=>{
  const r=await f.get(bounded);assert.equal(r.status,200);assertAggregateTiming(r.timing);assert.equal(r.cache,'private, no-store');assert.equal(r.body.state.interviews[0].id,'own-saved');
  assert.deepEqual(f.counts(),{ownerChecks:1,peerChecks:role==='student'?2:0,directoryChecks:role==='admin'?2:0,bootstrapReads:1});
 });
});
test('ordinary overview and cohort expose aggregate timings while retaining both fresh directory or peer checks',async()=>{
 for(const role of ['student','admin']){const logs=[];await fixture({role,onLog:x=>logs.push(x)},async f=>{
  const r=await f.get('?start=2026-10-01&end=2026-10-31',role==='admin'?'/api/calendar/overview':'/api/calendar/cohort');assert.equal(r.status,200);assertAggregateTiming(r.timing);assert.equal(r.cache,'private, no-store');
  assert.deepEqual(f.counts(),{ownerChecks:1,peerChecks:role==='student'?2:0,directoryChecks:role==='admin'?2:0,bootstrapReads:0});
 });const entry=logs.find(x=>x.event==='calendar_read_timing');assert.ok(entry);assert.equal(entry.stages.cohort.count,1);}
});
test('legacy, malformed, disabled and denied requests do not expose timing headers or private data on denial',async()=>{
 await fixture({},async f=>{for(const query of ['', '?view=calendar','?start=invalid'])assert.equal((await f.get(query)).timing,null);});
 for(const options of [{denyOwner:true},{calendarEnabled:false},{expire:true},{expireDuringBootstrap:true}])await fixture(options,async f=>{const r=await f.get(bounded);assert.notEqual(r.status,200);assert.equal(r.timing,null);assert.equal(r.body.state,undefined);});
});
