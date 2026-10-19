import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { checkCoachingAccess } from '../missionmed-hq/lib/scheduler/coaching.mjs';
import { createCoachingIntegration } from '../missionmed-hq/lib/scheduler/coaching-integration.mjs';
import { getSchedulerActor } from '../missionmed-hq/lib/scheduler/auth.mjs';

// Pure repository doubles: native PostgreSQL correctness is separately tested.
// No account, provider, appointment, payment or production data is mutated here.
const USER='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';
const PROVIDER='33333333-3333-4333-8333-333333333333';
const DONOR='44444444-4444-4444-8444-444444444444';
const MOCK='55555555-5555-4555-8555-555555555555';
const STRATEGY='66666666-6666-4666-8666-666666666666';
const RULE='77777777-7777-4777-8777-777777777777';
const SESSION={user:{wpUserId:77,supabaseUserId:USER,roles:['student']}};
const ACTOR=getSchedulerActor(SESSION).actor;
const SECRET='synthetic-coaching-secret-at-least-32-bytes';
const ENV={MMED_COACHING_ENABLED:'1',MMED_COACHING_WOO_SECRET:SECRET};
const RANGE={start_date:'2031-07-07T13:00:00Z',end_date:'2031-07-07T21:00:00Z',provider_id:PROVIDER};
let count=0;
function check(value,label) { count++;assert.ok(value,label); }
async function rejects(operation,pattern) { count++;await assert.rejects(operation,error=>pattern.test(error.code||error.message)); }
function fixture({sku='single', paid=true, resource=null}={}) {
 const ordinary={id:DONOR,slug:'mock-interview',name:'Existing Mock',duration_minutes:180,entitlement:{locked:false}};
 const mock={id:MOCK,slug:'mr-coaching-mock-local',name:'Private mock',metadata:{mr_coaching_service:'mock'},duration_minutes:105,
   min_notice_minutes:0,max_booking_window_days:3650,buffer_before_minutes:0,buffer_after_minutes:0,active:true,status:'active'};
 const strategy={...mock,id:STRATEGY,slug:'mr-coaching-strategy-local',name:'Private strategy',duration_minutes:120,metadata:{mr_coaching_service:'strategy'}};
 const rule={id:RULE,provider_id:PROVIDER,appointment_type_id:DONOR,resource_id:resource,day_of_week:[],start_time:'09:00',end_time:'17:00',
   timezone:'America/New_York',effective_start:'2020-01-01',effective_end:'2040-01-01',active:true,status:'active'};
 const services=[{id:'mock-credit-2',service:'mock',ordinal:2,minutes:105,state:'available',appointment_id:null},
   {id:'mock-credit-1',service:'mock',ordinal:1,minutes:105,state:'available',appointment_id:null}];
 if(sku!=='single')services.push({id:'strategy-credit-1',service:'strategy',ordinal:1,minutes:120,state:'available',appointment_id:null});
 const data={weekly_usage:[],packages:paid?[{order_id:'paid-order',sku,services,snapshot_digest:'a'.repeat(64),booking_allowed:true}]:[],eligible_services:paid?[
  {service:'mock',approval_id:'approved-mock',appointment_type_id:MOCK,donor_appointment_type_id:DONOR,availability_rule_id:RULE,provider_id:PROVIDER,approved_from:'2030-01-01T00:00:00Z',approved_until:'2032-01-01T00:00:00Z'},
  {service:'strategy',approval_id:'approved-strategy',appointment_type_id:STRATEGY,donor_appointment_type_id:DONOR,availability_rule_id:RULE,provider_id:PROVIDER,approved_from:'2030-01-01T00:00:00Z',approved_until:'2032-01-01T00:00:00Z'},
 ]:[]};
 const state={data,ordinary,mock,strategy,rule,appointments:[],blackouts:[],calls:[],operations:new Map(),accessCalls:0,accessActive:true,pageSize:200,config:{mode:'supabase_rest',configured:true,service_role_configured:true}};
 state.fetch=async(url,options)=>{
  state.accessCalls++; check(url==='https://missionmedinstitute.com/wp-json/mmed-coaching/v1/access-status'&&options.redirect==='error'&&options.credentials==='omit','fixed no-cookie no-redirect access endpoint');
  const raw=options.body;const request=JSON.parse(raw);const nonce=options.headers['x-mmed-coaching-nonce'];const timestamp=options.headers['x-mmed-coaching-timestamp'];
  check(options.headers['x-mmed-coaching-signature']===createHmac('sha256',SECRET).update(`mmed-coaching-access-request-v1\n${timestamp}\n${nonce}\n${raw}`).digest('hex'),'domain-separated signed access request');
  if(state.accessOutage)throw Error('synthetic outage');
  const response={nonce,request_digest:createHash('sha256').update(raw).digest('hex'),actor_user_id:request.actor_user_id,actor_wp_user_id:request.actor_wp_user_id,checked_at:Math.floor(Date.now()/1000),
   bindings:request.bindings.map(b=>({...b,active:typeof state.accessActive==='function'?state.accessActive(state.accessCalls):state.accessActive}))};
  state.mutateAccess?.(response);
  const bytes=JSON.stringify(response);return new Response(JSON.stringify({payload:Buffer.from(bytes).toString('base64'),signature:state.badSignature?'0'.repeat(64):createHmac('sha256',SECRET).update(`mmed-coaching-access-response-v1\n${bytes}`).digest('hex')}));
 };
 const repository={
  status:()=>state.config,
  listAppointmentTypes:async filters=>[ordinary,mock,strategy].filter(t=>!filters.appointment_type_id||t.id===filters.appointment_type_id),
  listAvailabilityRules:async filters=>filters.appointment_type_id===DONOR?[rule]:[],
  listBlackoutWindows:async filters=>{state.calls.push({name:'blackouts',filters});return state.blackouts;},
  adminListAppointments:async filters=>state.appointments.filter(a=>!filters.status||a.status===filters.status),
  restSelect:async(table,params)=>{state.calls.push({name:table,filters:params});
    let rows=table==='mm_appointments'?state.appointments.filter(a=>['held','booked','confirmed'].includes(a.status)):state.blackouts;
    rows=rows.map((r,i)=>({...r,id:r.id||`blackout-${i}`}));
    const offset=state.repeatPage?0:Number(params.offset);return rows.slice(offset,offset+Math.min(Number(params.limit),state.pageSize));},
  getAppointmentById:async id=>state.appointments.find(a=>a.id===id)||null,
  rpc:async(name,payload)=>{state.calls.push({name,payload});if(name==='mm_coaching_read_model')return data;
    if(name==='mm_coaching_lookup_operation') {const previous=state.operations.get(payload.p_payload.idempotency_key);if(!previous)return null;
      if(previous.payload.client_request_digest!==payload.p_payload.client_request_digest)throw Error('booking_replay_mismatch');return previous;}
    if(name==='mm_coaching_mutate_appointment')return {ok:true,appointment_id:'native-result',action:payload.p_payload.action};
    throw Error('Unexpected RPC');},
 };
 state.integration=(options={})=>createCoachingIntegration({repository,session:SESSION,actor:ACTOR,env:ENV,fetchImpl:state.fetch,...options});
 state.booking=(extra={})=>({appointment_type_id:MOCK,provider_id:PROVIDER,start_at:'2031-07-07T13:00:00Z',end_at:'2031-07-07T14:45:00Z',idempotency_key:'book-request',...extra});
 state.ownAppointment=(extra={})=>({id:'own-appointment',student_user_id:USER,student_wp_user_id:77,appointment_type_id:MOCK,provider_id:PROVIDER,
  resource_id:resource,schedule_event_id:null,start_at:'2031-07-07T16:00:00Z',end_at:'2031-07-07T17:45:00Z',status:'booked',timezone:'America/New_York',...extra});
 return state;
}

let f=fixture();
let integration=f.integration({env:{}});
const raw=[f.ordinary,f.mock,f.strategy];const sanitized=raw.map(t=>({id:t.id,slug:t.slug,name:t.name}));
const disabled=await integration.decorateTypes(sanitized,raw);
check(disabled.length===1&&disabled[0]===sanitized[0],'disabled catalog hides only new coaching types');
check(await integration.availability(RANGE,f.ordinary)===null,'ordinary availability uses unchanged old path');
check(await integration.mutate('book',{appointment_type_id:DONOR})===null,'ordinary booking uses unchanged old path');
check(f.calls.length===0,'ordinary/disabled paths do not call paid ledger');
check((await integration.availability(RANGE,f.mock)).length===0,'disabled new availability closed');
await rejects(()=>integration.mutate('book',f.booking()),/coaching_disabled/);

f=fixture({paid:false});integration=f.integration();
const unpaid=await integration.decorateTypes([f.ordinary,f.mock],[f.ordinary,f.mock]);
check(unpaid[0]===f.ordinary,'ordinary decorated object unchanged');
check(unpaid[1].division==='mission-residency'&&unpaid[1].entitlement.locked&&unpaid[1].coaching_remaining===0,'unpaid coaching remains locked');
check((await integration.availability(RANGE,f.mock)).length===0,'unpaid gets no slots');
await rejects(()=>integration.mutate('book',f.booking()),/coaching_paid_credit_required/);

for(const options of [{session:null},{actor:{...ACTOR,userId:OTHER}},
 {session:{user:{wpUserId:77,id:USER}},actor:{...ACTOR,supabaseIdentityConfirmed:false}}]) {
 f=fixture();await rejects(()=>f.integration(options).availability(RANGE,f.mock),/coaching_confirmed_identity_required/);
}
f=fixture();f.config.service_role_configured=false;
await rejects(()=>f.integration().availability(RANGE,f.mock),/coaching_service_repository_required/);

f=fixture();integration=f.integration();
let decorated=await integration.decorateTypes([f.mock],[f.mock]);
check(decorated[0].entitlement.status==='eligible'&&!decorated[0].entitlement.locked,'paid credit unlocks coaching type');
check(decorated[0].coaching_service==='mock'&&decorated[0].coaching_remaining===2,'browser-safe coaching kind/balance');
const booked=await integration.mutate('book',f.booking({service_credit_id:'forged',approval_id:'forged',actor_user_id:OTHER,actor_type:'admin',student_user_id:OTHER,studentWpUserId:999}));
check(booked.result.ok&&booked.appointmentType.id===MOCK,'new mutation uses canonical coaching service');
check(booked.payload.service_credit_id==='mock-credit-1'&&booked.payload.approval_id==='approved-mock','credit stable ordinal and approval server chosen');
check(booked.payload.student_user_id===USER&&booked.payload.student_wp_user_id===77,'returned postmutation payload binds native actor pair');
const call=f.calls.find(c=>c.name==='mm_coaching_mutate_appointment').payload.p_payload;
check(call.actor_user_id===USER&&call.actor_wp_user_id===77&&call.actor_type==='student'&&!Object.hasOwn(call,'studentWpUserId'),'RPC identities never follow browser aliases');
check(f.rule.appointment_type_id===DONOR,'donor rule mapped only in memory');
await rejects(()=>f.integration().mutate('book',f.booking({provider_id:OTHER})),/coaching_service_approval_required/);
f=fixture();
f.data.packages[0].services.find(c=>c.id==='mock-credit-1').state='reserved';
f.data.packages[0].services.find(c=>c.id==='mock-credit-1').appointment_id='booked-replay';
f.appointments.push(f.ownAppointment({id:'booked-replay',start_at:'2031-07-07T13:00:00Z',end_at:'2031-07-07T14:45:00Z',idempotency_key:'book-request'}));
const replay=await f.integration().mutate('book',f.booking());
check(replay.payload.service_credit_id==='mock-credit-1','book acknowledgement replay retains original reserved credit');

f=fixture({sku:'three'});
decorated=await f.integration().decorateTypes([f.mock,f.strategy],[f.mock,f.strategy]);
check(decorated[0].entitlement.locked&&!decorated[1].entitlement.locked,'strategy before mock catalog gate');
check((await f.integration().availability(RANGE,f.mock)).length===0,'missing strategy means zero mock slots');
await rejects(()=>f.integration().mutate('book',f.booking()),/coaching_paid_credit_required/);
const strategyCredit=f.data.packages[0].services.find(c=>c.service==='strategy');strategyCredit.state='reserved';strategyCredit.appointment_id='strategy-ap';
f.appointments.push(f.ownAppointment({id:'strategy-ap',appointment_type_id:STRATEGY,start_at:'2031-07-07T13:00:00Z',end_at:'2031-07-07T15:00:00Z'}));
let slots=await f.integration().availability(RANGE,f.mock);
check(slots.length>0&&slots.every(s=>Date.parse(s.startAt)>=Date.parse('2031-07-07T15:00:00Z')),'mock slots start after owned strategy finishes');
f.appointments[0].student_user_id=OTHER;
check((await f.integration().availability(RANGE,f.mock)).length===0,'another user strategy never authorizes mock');

f=fixture();f.appointments.push(f.ownAppointment());
const credit=f.data.packages[0].services.find(c=>c.id==='mock-credit-1');credit.state='reserved';credit.appointment_id='own-appointment';
let updated=await f.integration().mutate('reschedule',f.booking({appointment_id:'own-appointment',start_at:'2031-07-07T18:00:00Z',end_at:'2031-07-07T19:45:00Z',service_credit_id:'forged'}));
check(updated.payload.service_credit_id===credit.id&&updated.payload.appointment_id==='own-appointment','reschedule resolves owned reserved credit from actual appointment');
await rejects(()=>f.integration().mutate('reschedule',f.booking({appointment_id:'own-appointment',appointment_type_id:DONOR})),/coaching_type_change_forbidden/);
await rejects(()=>f.integration().availability({...RANGE,appointment_id:'own-appointment'},f.strategy),/coaching_type_change_forbidden/);
f.data.eligible_services=[];
updated=await f.integration().mutate('cancel',{appointment_id:'own-appointment',idempotency_key:'cancel-own',actor_type:'admin',student_user_id:OTHER});
check(updated.payload.student_user_id===USER&&updated.payload.provider_id===PROVIDER&&updated.payload.service_credit_id===credit.id,'cancel uses actual appointment and remains possible after approval withdrawal');
f.appointments[0].student_wp_user_id=999;
await rejects(()=>f.integration().mutate('cancel',{appointment_id:'own-appointment',idempotency_key:'cancel-forged'}),/coaching_appointment_owner_required/);
f=fixture();f.appointments.push(f.ownAppointment({id:'legacy',appointment_type_id:DONOR}));
await rejects(()=>f.integration().mutate('reschedule',f.booking({appointment_id:'legacy'})),/coaching_type_change_forbidden/);

f=fixture();
f.appointments.push(f.ownAppointment({id:'PRIVATE-OTHER-ID',student_user_id:OTHER,student_wp_user_id:999,start_at:'2031-07-07T13:00:00Z',end_at:'2031-07-07T15:00:00Z',email:'PRIVATE-EMAIL',notes:'PRIVATE-NOTES'}));
slots=await f.integration().availability(RANGE,f.mock);
check(slots.length>0&&slots[0].startAt==='2031-07-07T15:00:00.000Z','persisted other-student busy time filtered');
check(!JSON.stringify(slots).includes('PRIVATE'),'no other-student fields enter availability response');
f.blackouts.push({provider_id:null,appointment_type_id:DONOR,start_at:'2031-07-07T15:00:00Z',end_at:'2031-07-07T16:00:00Z',status:'active',reason:'PRIVATE-REASON'});
slots=await f.integration().availability(RANGE,f.mock);
check(slots.length>0&&slots[0].startAt==='2031-07-07T16:00:00.000Z','global donor-scoped blackout retained for isolated type');
check(f.calls.filter(c=>c.name==='mm_blackout_windows').every(c=>!c.filters.appointment_type_id&&!c.filters.provider_id),'blackout query does not discard global/donor scopes');
await rejects(()=>f.integration().availability({...RANGE,exclude_appointment_id:'PRIVATE-OTHER-ID'},f.mock),/coaching_appointment_owner_required/);

f=fixture({resource:'room'});
f.appointments.push(f.ownAppointment({id:'resource-busy',provider_id:OTHER,resource_id:'room',student_user_id:OTHER,student_wp_user_id:999,start_at:'2031-07-07T13:00:00Z',end_at:'2031-07-07T16:00:00Z'}));
slots=await f.integration().availability({...RANGE,end_date:'2031-07-07T16:00:00Z'},f.mock);
check(slots.length===0,'shared resource conflict honored across providers');

f=fixture();f.data.eligible_services[0].approved_from='2031-07-07T14:00:00Z';f.data.eligible_services[0].approved_until='2031-07-07T16:00:00Z';
slots=await f.integration().availability(RANGE,f.mock);
check(slots.length>0&&slots.every(s=>Date.parse(s.startAt)>=Date.parse('2031-07-07T14:00:00Z')&&Date.parse(s.endAt)<=Date.parse('2031-07-07T16:00:00Z')),'availability clipped to Founder approval bounds');
f=fixture();slots=await f.integration().availability({start_date:'2031-11-10T00:00:00Z',end_date:'2031-11-11T00:00:00Z'},f.mock);
check(slots.length>0&&slots[0].startAt==='2031-11-10T14:00:00.000Z'&&slots[0].timezone==='America/New_York','native engine honors winter timezone offset');

f=fixture();f.pageSize=1;f.appointments=[f.ownAppointment({id:'one',start_at:'2031-07-07T13:00:00Z',end_at:'2031-07-07T15:00:00Z'}),f.ownAppointment({id:'two',start_at:'2031-07-07T15:00:00Z',end_at:'2031-07-07T16:00:00Z'})];
slots=await f.integration().availability(RANGE,f.mock);
check(slots[0].startAt==='2031-07-07T16:00:00.000Z','short pages continue until empty; later conflict retained');
check(f.calls.filter(c=>c.name==='mm_appointments').map(c=>c.filters.offset).join(',')==='0,1,2','pagination advances by actual rows');
f.repeatPage=true;await rejects(()=>f.integration().availability(RANGE,f.mock),/coaching_busy_scan_incomplete/);

f=fixture();f.data.weekly_usage=[{week_start_utc:'2031-07-07T04:00:00Z',week_end_utc:'2031-07-14T04:00:00Z',used_minutes:1100}];
check((await f.integration().availability(RANGE,f.mock)).length===0,'global authoritative weekly usage filters displayed slots');
f.appointments.push(f.ownAppointment());f.data.packages[0].services[0].state='reserved';f.data.packages[0].services[0].appointment_id='own-appointment';
check((await f.integration().availability({...RANGE,appointment_id:'own-appointment'},f.mock)).length>0,'reschedule reclaims only its own week allocation');

f=fixture();integration=f.integration();await integration.decorateTypes([f.mock],[f.mock]);await integration.availability(RANGE,f.mock);
check(f.accessCalls===1,'display uses request-local signed access cache');
await integration.mutate('book',f.booking());check(f.accessCalls===2,'booking forces fresh check immediately before native mutation');
f=fixture();f.accessActive=n=>n===1;
await rejects(()=>f.integration().mutate('book',f.booking()),/coaching_package_review_required/);
check(!f.calls.some(c=>c.name==='mm_coaching_mutate_appointment'),'refund between display and final access check blocks mutation');
for(const mutateAccess of [r=>r.actor_wp_user_id=999,r=>r.nonce='wrong',r=>r.request_digest='wrong',r=>r.checked_at-=61,
 r=>r.bindings=[],r=>r.bindings[0].snapshot_digest='b'.repeat(64),r=>r.bindings.push(r.bindings[0]),r=>r.bindings[0].active='true']) {
 f=fixture();f.mutateAccess=mutateAccess;await rejects(()=>f.integration().availability(RANGE,f.mock),/coaching_access_unavailable/);
}
f=fixture();f.badSignature=true;await rejects(()=>f.integration().availability(RANGE,f.mock),/coaching_access_unavailable/);
f=fixture();f.accessOutage=true;await rejects(()=>f.integration().mutate('book',f.booking()),/coaching_access_unavailable/);
f.appointments.push(f.ownAppointment());f.data.packages[0].services[0].state='reserved';f.data.packages[0].services[0].appointment_id='own-appointment';
f.data.packages[0].refund_review_required=true;f.data.packages[0].booking_allowed=false;
updated=await f.integration().mutate('cancel',{appointment_id:'own-appointment',idempotency_key:'safe-cancel'});
check(updated.result.ok,'owned cancellation remains possible with refund and access outage');
const stored={result:{...updated.result,idempotency_replay:true},appointment_type:f.mock,payload:updated.payload};f.operations.set('safe-cancel',stored);
f.data.packages[0].services[0].state='available';f.data.packages[0].services[0].appointment_id=null;f.appointments[0].status='canceled';
check((await f.integration().mutate('cancel',{appointment_id:'own-appointment',idempotency_key:'safe-cancel'})).result.idempotency_replay,'cancel acknowledgement replay precedes mutable credit checks');
await rejects(()=>f.integration().mutate('cancel',{appointment_id:'own-appointment',idempotency_key:'safe-cancel',reason:'changed'}),/booking_replay_mismatch/);
f=fixture();f.data.packages[0].booking_allowed=false;f.data.packages[0].refund_review_required=true;
check((await f.integration().availability(RANGE,f.mock)).length===0,'native refund quarantine overrides stale active Woo response');
await rejects(()=>checkCoachingAccess({actor:ACTOR,bindings:Array.from({length:101},(_,i)=>({order_id:String(i),snapshot_digest:'a'.repeat(64)})),secret:SECRET,fetchImpl:f.fetch}),/coaching_access_unavailable/);
console.log(`PASS ${count} bounded coaching-integration assertions; repository doubles only, no runtime acceptance.`);
