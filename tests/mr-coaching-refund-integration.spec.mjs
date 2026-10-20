import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createWooCoachingAllowanceReader } from '../missionmed-hq/lib/scheduler/coaching-woo-read.mjs';
import { createCoachingStoredAccess } from '../missionmed-hq/lib/scheduler/coaching-stored-access.mjs';
import { dispatchCoachingNotification } from '../missionmed-hq/lib/scheduler/coaching-notification-guard.mjs';
import { reconcileCoachingUsagePage } from '../missionmed-hq/lib/scheduler/coaching-reconciliation.mjs';
import { runCoachingMaintenance } from '../missionmed-hq/lib/scheduler/coaching-maintenance.mjs';
import { handleSchedulerApiRoute } from '../missionmed-hq/lib/scheduler/routes.mjs';
const USER='11111111-1111-4111-8111-111111111111',AP='22222222-2222-4222-8222-222222222222',TYPE='33333333-3333-4333-8333-333333333333',PROVIDER='44444444-4444-4444-8444-444444444444',N='55555555-5555-4555-8555-555555555555';
const UNIT='coaching-unit:v1:101:1101:mock:1';
const SESSION={user:{supabaseUserId:USER,wpUserId:77,roles:['student'],email:'synthetic@example.test'}};
const ADMIN={user:{supabaseUserId:PROVIDER,wpUserId:88,roles:['administrator']}};
const status={mode:'supabase_rest',configured:true,service_role_configured:true};
const unit={unit_id:UNIT,order_id:101,order_item_id:1101,product_id:8001,owner_wp_user_id:77,sku:'single',service:'mock',ordinal:1,duration_minutes:105,snapshot_digest:'a'.repeat(64)};
const pack={order_id:101,order_item_id:1101,product_id:8001,sku:'single',snapshot_digest:'a'.repeat(64),eligibility_revision:1,units:[unit],eligible_unit_ids:[UNIT]};
function receipt(eligible=true){const t=Math.floor(Date.now()/1000);return {schema:'missionmed.coaching.allowances.v1',request_id:'a'.repeat(48),subject_user_id:USER,subject_wp_user_id:77,checked_at:t,valid_until:t+15,complete:true,packages:eligible?[structuredClone(pack)]:[]};}
function fixture({coaching=true,eligible=true}={}){
 const events=[];const state={eligible,outage:false,coaching,events,lease:true,cleanupOk:true,ambiguous:false};
 state.ap={id:AP,student_user_id:USER,student_wp_user_id:77,appointment_type_id:TYPE,provider_id:PROVIDER,start_at:'2032-07-01T13:00:00Z',end_at:'2032-07-01T14:45:00Z',status:'booked',timezone:'America/New_York',meeting_url:'https://fixture.invalid/JOIN-SECRET',metadata:{scheduler_integrations:{meeting:{provider:'webex',webex_meeting_id:'owned-meeting',external_event_id:'owned-meeting',meeting_url:'https://fixture.invalid/JOIN-SECRET'},recording:{status:'ready',playback_url:'https://fixture.invalid/RECORDING-SECRET'}}}};
 state.type={id:TYPE,name:'Synthetic meeting',slug:coaching?'mr-coaching-mock-synthetic':'ordinary-360',metadata:{...(coaching?{mr_coaching_service:'mock'}:{}),web_meetings:{provider:'webex',auto_generate:true}}};
 const notifications=new Map([[N,{id:N,appointment_id:AP,status:'pending',channel:'email',template_key:'scheduler_appointment_reminder',recipient_role:'student',attempt_count:0,metadata:{meeting_url:'https://fixture.invalid/STALE-SECRET',recipient_email:'synthetic@example.test'}}]]);
 const repository={status:()=>status,getAppointmentById:async id=>id===AP?structuredClone(state.ap):null,
  listAppointmentTypes:async()=>[structuredClone(state.type)],listProviders:async()=>[],listMyAppointments:async()=>[structuredClone(state.ap)],listAppointmentHistory:async()=>[structuredClone(state.ap)],
  updateAppointmentIntegration:async(id,patch)=>Object.assign(state.ap,patch),writeAuditEvent:async()=>{},
  listDueNotifications:async()=>[...notifications.values()].filter(n=>n.status==='pending').map(n=>structuredClone(n)),
  getNotificationById:async id=>structuredClone(notifications.get(id)),
  claimCoachingNotification:async(id,token,attempt)=>{const n=notifications.get(id);if(n.status!=='pending')return null;Object.assign(n,{status:'failed',last_error:token,attempt_count:attempt});return structuredClone(n);},
  finishCoachingNotification:async(id,token,patch)=>{const n=notifications.get(id);if(n.status!=='failed'||n.last_error!==token)return null;Object.assign(n,patch);return structuredClone(n);},
  suppressCoachingNotifications:async()=>{for(const n of notifications.values())if(['pending','failed'].includes(n.status))Object.assign(n,{status:'suppressed',last_error:'coaching_unit_revoked'});},
  updateNotificationStatus:async(id,patch)=>{events.push('legacy-update');Object.assign(notifications.get(id),patch);},
  enqueueNotification:async request=>{const id='queued-'+notifications.size;const n={...request,id};notifications.set(id,n);return n;},
  cancelAppointment:async()=>{events.push('legacy-cancel');state.ap.status='canceled';return {ok:true,appointment:structuredClone(state.ap)};},
  rpc:async(name,{p_payload:p})=>{events.push(name);
   if(name==='mm_coaching_hybrid_read_model')return {packages:[{order_id:101,booking_allowed:state.eligible,services:[{unit_id:UNIT,appointment_id:AP,state:state.ap.status==='completed'?'delivered':'reserved',booking_allowed:state.ambiguous?undefined:state.eligible}]}],eligible_services:[],weekly_usage:[]};
   if(name==='mm_coaching_hybrid_stored_usage')return {appointment_id:AP,unit_id:UNIT,subject_user_id:USER,subject_wp_user_id:77,state:state.ap.status};
   if(name==='mm_coaching_hybrid_revoke_appointment'){assert.equal(p.appointment_id,AP);assert.equal(p.allowance_receipt.complete,true);assert.equal(p.allowance_receipt.packages.length,0);state.ap.status='canceled';await repository.suppressCoachingNotifications();return {ok:true,appointment_id:AP};}
   if(name==='mm_coaching_hybrid_staff_cancel_appointment'){assert.equal(p.actor_user_id,PROVIDER);assert.equal(p.actor_wp_user_id,88);state.ap.status='canceled';return {ok:true,appointment_id:AP};}
   if(name==='mm_coaching_hybrid_reconciliation_page')return {version:0,limit:p.limit,appointment_ids:state.pageIds||[AP],next_cursor:AP,cycle_complete:false};
   if(name==='mm_coaching_hybrid_reconciliation_checkpoint'){state.checkpoint=p;return true;}
   if(name==='mm_coaching_hybrid_claim_maintenance')return state.lease;
   if(name==='mm_coaching_hybrid_release_maintenance')return true;
   if(name==='mm_coaching_hybrid_due_notifications')return [...notifications.values()].filter(n=>n.status==='pending').map(n=>structuredClone(n));
   throw Error(name);
  }};
 const read=async()=>receipt(state.eligible);
 read.forStoredAppointment=async(repo,id)=>{events.push('fresh-woo');if(state.outage)throw Error('unknown Woo');const appointment=await repo.getAppointmentById(id);state.afterWoo?.();return {appointment,receipt:receipt(state.eligible)};};
 const cleanup=async p=>{assert.equal(p.appointment.id,AP);assert.equal(p.unit_id,UNIT);events.push('cleanup');await state.cleanupWait;return {ok:state.cleanupOk,status:state.cleanupOk?'provider_resources_absent':'held'};};
 const access=createCoachingStoredAccess({repository,readWooAllowances:read,cleanupCoachingMeeting:cleanup});
 return {state,repository,read,access,cleanup,notifications,events};
}
async function route(f,pathname,{admin=false,payload={},adapters={}}={}){
 const response={};await handleSchedulerApiRoute({method:payload&&Object.keys(payload).length?'POST':'GET',headers:{}},response,new URL(pathname,'https://fixture.invalid'),{
  session:admin?ADMIN:SESSION,schedulerRepository:f.repository,readWooAllowances:f.read,validateCsrf:()=>true,
  readJsonBody:async()=>payload,sendJson:(r,status,p)=>Object.assign(r,{status,payload:p}),sendMethodNotAllowed:()=>assert.fail('unexpected method'),
  schedulerAdapters:{cleanupCoachingMeeting:f.cleanup,coachingWebexProvider:{create:async()=>assert.fail('unexpected create'),recordings:async()=>{f.events.push('coaching-recordings');return {ok:true,recordings:[{id:'bound-recording',playback_url:'https://fixture.invalid/BOUND-RECORDING'}]};},cleanup:f.cleanup},...adapters},
 });return response;
}
test('canonical reader requires exact subset; missing, foreign and duplicate fail; empty remains valid',async()=>{
 for(const ids of [undefined,['foreign'],[UNIT,UNIT],[]]){
  const reader=createWooCoachingAllowanceReader({getServiceHeaders:async()=>({Authorization:'Basic c2VydmVyOnNlcnZlcg=='}),fetchImpl:async(url,options)=>{
   const request=JSON.parse(options.body);const p={...pack};if(ids===undefined)delete p.eligible_unit_ids;else p.eligible_unit_ids=ids;
   return new Response(JSON.stringify({...receipt(),...request,packages:[p]}),{headers:{'content-type':'application/json'}});
  }});
  if(ids?.length===0)assert.equal((await reader(SESSION)).packages[0].eligible_unit_ids.length,0);else await assert.rejects(reader(SESSION),{code:'coaching_woo_allowances_unavailable'});
 }
});
test('server owner reader derives subject from actual persisted appointment',async()=>{
 let requested;const reader=createWooCoachingAllowanceReader({getServiceHeaders:async()=>({Authorization:'Basic c2VydmVyOnNlcnZlcg=='}),fetchImpl:async(url,options)=>{requested=JSON.parse(options.body);return new Response(JSON.stringify({...receipt(),...requested}),{headers:{'content-type':'application/json'}});}});
 const f=fixture();await reader.forStoredAppointment(f.repository,AP);assert.equal(requested.subject_user_id,USER);assert.equal(requested.subject_wp_user_id,77);
 await assert.rejects(reader.forStoredAppointment(f.repository,TYPE));
});
test('future revocation cancels native usage then awaits own provider cleanup before returning',async()=>{
 const f=fixture({eligible:false});let release;f.state.cleanupWait=new Promise(r=>release=r);let done=false;
 const work=f.access.reconcile(AP).then(r=>{done=true;return r;});await new Promise(r=>setImmediate(r));assert.equal(done,false);assert.equal(f.state.ap.status,'canceled');release();
 const result=await work;assert.equal(result.cleanup.ok,true);assert.ok(f.events.indexOf('mm_coaching_hybrid_revoke_appointment')<f.events.indexOf('cleanup'));
 const historical=await f.access.getStoredCoachingAccess({id:AP,unit_id:'forged'});assert.equal(historical.unit_id,UNIT);assert.equal(historical.eligibility,false);assert.equal(historical.state,'canceled');
});
test('unknown or ambiguous facts neither cancel nor delete resources',async()=>{
 for(const flag of ['outage','ambiguous']){const f=fixture();f.state[flag]=true;const a=await f.access.reconcile(AP);assert.equal(a.state,'unverified');assert.equal(f.state.ap.status,'booked');assert.ok(!f.events.includes('cleanup'));assert.equal((await f.access.getStoredCoachingAccess({id:AP})).eligibility,null);}
});
test('delivered revoked usage receives resource cleanup without appointment/history mutation',async()=>{
 const f=fixture({eligible:false});f.state.ap.status='completed';f.state.ap.start_at='2020-01-01T13:00:00Z';const before=structuredClone(f.state.ap);
 const a=await f.access.reconcile(AP);assert.equal(a.cleanup.ok,true);assert.deepEqual(f.state.ap,before);assert.ok(!f.events.includes('mm_coaching_hybrid_revoke_appointment'));
});
test('student list, history and calendar redact copied meeting/recording links on revocation or outage',async()=>{
 for(const pathname of ['/api/scheduler/my-appointments','/api/scheduler/my-appointment-history','/api/scheduler/calendar-feed'])for(const outage of [false,true]){
  const f=fixture({eligible:false});f.state.outage=outage;const r=await route(f,pathname);assert.equal(r.status,200);assert.ok(!/JOIN-SECRET|RECORDING-SECRET/.test(JSON.stringify(r.payload)));assert.equal(f.state.ap.status,outage?'booked':'canceled');
 }
});
test('recording endpoint denies before cached or provider lookup; eligible coaching uses bound provider',async()=>{
 const revoked=fixture({eligible:false});const denied=await route(revoked,`/api/scheduler/appointments/${AP}/recording`);assert.equal(denied.status,403);assert.ok(!revoked.events.includes('coaching-recordings'));assert.ok(!JSON.stringify(denied.payload).includes('SECRET'));
 const allowed=fixture();const r=await route(allowed,`/api/scheduler/appointments/${AP}/recording`);assert.equal(r.status,200);assert.ok(allowed.events.includes('coaching-recordings'));assert.ok(JSON.stringify(r.payload).includes('BOUND-RECORDING'));assert.ok(!JSON.stringify(r.payload).includes('RECORDING-SECRET'));
});
test('ordinary list/history/calendar and cached recording retain exact existing provider path without Woo',async()=>{
 for(const path of ['/api/scheduler/my-appointments','/api/scheduler/my-appointment-history','/api/scheduler/calendar-feed',`/api/scheduler/appointments/${AP}/recording`]){
  const f=fixture({coaching:false});f.state.outage=true;const r=await route(f,path);assert.equal(r.status,200);assert.ok(JSON.stringify(r.payload).includes('SECRET'));assert.ok(!f.events.includes('fresh-woo')&&!f.events.includes('coaching-recordings')&&!f.events.includes('cleanup'));
 }
});
test('UUID-owned legacy rows with null WP retain byte-exact content; coaching and unknown require joint ownership',async()=>{
 const legacy=fixture({coaching:false});legacy.state.ap.student_wp_user_id=null;
 const original=structuredClone(legacy.state.ap);const before=JSON.stringify(original);
 const rows=await legacy.access.redactForStudent([original],{userId:USER,wpUserId:77});
 assert.equal(rows.length,1);assert.equal(rows[0],original);assert.equal(JSON.stringify(rows[0]),before);
 assert.ok(!legacy.events.includes('fresh-woo'));
 for(const unknown of [false,true]){
  const f=fixture();f.state.ap.student_wp_user_id=null;
  if(unknown)f.repository.listAppointmentTypes=async()=>[];
  assert.deepEqual(await f.access.redactForStudent([structuredClone(f.state.ap)],{userId:USER,wpUserId:77}),[]);
 }
});
test('admin coaching cancel uses actual staff RPC; ordinary admin cancel uses original native method',async()=>{
 const f=fixture();const r=await route(f,'/api/scheduler/admin/cancel',{admin:true,payload:{appointment_id:AP,idempotency_key:'staff-cancel',reason:'Refund review',actor_user_id:USER,isAdmin:true}});assert.equal(r.status,200);assert.ok(f.events.includes('mm_coaching_hybrid_staff_cancel_appointment'));assert.ok(f.events.includes('cleanup'));assert.ok(!f.events.includes('legacy-cancel'));
 const legacy=fixture({coaching:false});const old=await route(legacy,'/api/scheduler/admin/cancel',{admin:true,payload:{appointment_id:AP,idempotency_key:'legacy-cancel'}});assert.equal(old.status,200);assert.ok(legacy.events.includes('legacy-cancel'));assert.ok(!legacy.events.includes('mm_coaching_hybrid_staff_cancel_appointment'));assert.ok(!legacy.events.includes('cleanup'));
});
test('queued revoked/canceled notifications suppress; unknown and uncertain provider outcomes hold without send/retry',async()=>{
 for(const kind of ['revoked','canceled','unknown','provider-failure']){
  const f=fixture({eligible:kind!=='revoked'});if(kind==='canceled')f.state.ap.status='canceled';if(kind==='unknown')f.state.outage=true;let sends=0;
  const r=await dispatchCoachingNotification({repository:f.repository,access:f.access,notification:structuredClone(f.notifications.get(N)),send:async()=>{sends++;throw Error('unknown external outcome');}});
  assert.equal(sends,kind==='provider-failure'?1:0);assert.equal(r.status,['revoked','canceled'].includes(kind)?'suppressed':'held');assert.notEqual(f.notifications.get(N).status,'pending');
 }
});
test('concurrent senders claim once; late acknowledgement cannot overwrite suppression',async()=>{
 const f=fixture();let sends=0;const send=async()=>{sends++;await f.repository.suppressCoachingNotifications();return {ok:true,status:'sent'};};
 await Promise.all([1,2].map(()=>dispatchCoachingNotification({repository:f.repository,access:f.access,notification:structuredClone(f.notifications.get(N)),send})));
 assert.equal(sends,1);assert.equal(f.notifications.get(N).status,'suppressed');
});
test('cancellation while Woo read is pending suppresses the stale worker before send',async()=>{
 const f=fixture();f.state.afterWoo=()=>{f.state.ap.status='canceled';};let sends=0;
 const r=await dispatchCoachingNotification({repository:f.repository,access:f.access,notification:structuredClone(f.notifications.get(N)),send:async()=>{sends++;return {ok:true,status:'sent'};}});
 assert.equal(sends,0);assert.equal(r.status,'suppressed');
});
test('bounded sweep handles held owner and checkpoints only processed prefix',async()=>{
 const f=fixture();f.state.pageIds=[AP,TYPE,PROVIDER];let count=0;
 const r=await reconcileCoachingUsagePage({repository:f.repository,access:{reconcile:async()=>({state:'unverified'})},limit:3,beforeEach:async()=>++count<3});
 assert.equal(r.processed,2);assert.deepEqual(f.state.checkpoint,{limit:2,version:0,next_cursor:TYPE});
});
test('maintenance lease denial does no work; active tick sweeps before due coaching dispatch only',async()=>{
 const denied=fixture();denied.state.lease=false;assert.equal((await runCoachingMaintenance({repository:denied.repository,readWooAllowances:denied.read})).status,'skipped_lease');assert.ok(!denied.events.includes('fresh-woo'));
 const f=fixture({eligible:false});let sends=0;const r=await runCoachingMaintenance({repository:f.repository,readWooAllowances:f.read,schedulerAdapters:{cleanupCoachingMeeting:f.cleanup,emailMedMailNotificationAdapter:async()=>{sends++;return {ok:true,status:'sent'};}}});
 assert.equal(r.status,'processed');assert.equal(sends,0);assert.equal(f.state.ap.status,'canceled');assert.ok(f.events.indexOf('mm_coaching_hybrid_revoke_appointment')<f.events.indexOf('mm_coaching_hybrid_due_notifications'));assert.ok(!f.events.includes('legacy-update'));
});
test('actual meeting creation function retains ordinary Webex adapter and isolates coaching provider selection',async()=>{
 const source=fs.readFileSync(new URL('../missionmed-hq/lib/scheduler/routes.mjs',import.meta.url),'utf8');
 const start=source.indexOf('async function createAndPersistMeetingLink('),end=source.indexOf('\nasync function cleanupZoomMeetingAfterCancel(',start);
 assert.ok(start>=0&&end>start);let ordinary=0,coaching=0;
 const context=vm.createContext({webMeetingConfig:()=>({provider:'webex',auto_generate:true}),isStoredCoachingType:t=>t.slug.startsWith('mr-coaching-'),
  zoomMeetingLinkAdapter(){throw Error('wrong provider');},manualMeetingLinkAdapter(){throw Error('wrong provider');},webexMeetingLinkAdapter(){throw Error('unmocked legacy');},
  providerDisplayName:()=> 'Coach',appointmentTypeDisplayName:()=> 'Mock',schedulerMeetingTitle:()=> 'Synthetic title',normalizeMetadata:m=>m||{},resultAppointmentMutable:()=>false,writeAuditSafe:async()=>{}});
 const create=vm.runInContext('('+source.slice(start,end)+')',context);
 const f=fixture();const adapters={webexMeetingLinkAdapter:async()=>{ordinary++;return {ok:true,status:'created',meeting_url:'https://fixture.invalid/ORDINARY',external_event_id:'ordinary'};},coachingWebexProvider:{create:async p=>{coaching++;assert.equal(p.appointment.id,AP);return {ok:true,status:'created',meeting_url:'https://fixture.invalid/COACHING',external_event_id:'coaching'};}}};
 const args={appointment:f.state.ap,actor:{userId:USER},payload:{idempotency_key:'provider-choice'},repository:{updateAppointmentIntegration:async()=>{}},schedulerAdapters:adapters};
 assert.equal((await create({...args,appointmentType:{slug:'ordinary-360'}})).meeting_url,'https://fixture.invalid/ORDINARY');assert.equal(ordinary,1);assert.equal(coaching,0);
 assert.equal((await create({...args,appointmentType:{slug:'mr-coaching-mock'}})).meeting_url,'https://fixture.invalid/COACHING');assert.equal(ordinary,1);assert.equal(coaching,1);
});
