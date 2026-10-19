import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Real isolated PostgreSQL, no network listener. Native Scheduler is a clearly
// exact foundation+current RPC source copy; production schema/data may still drift.
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'mr-coaching-pg-'));
const data = join(dir,'data'); const socket = join(dir,'socket'); mkdirSync(socket);
const bin = '/opt/homebrew/bin/';
let started = false; let assertions = 0;
function command(name,args) {
  const result=spawnSync(bin+name,args,{encoding:'utf8',timeout:30000});
  if(result.status!==0) throw new Error(`${name} failed: ${result.stderr || result.stdout || result.error}`);
  return result.stdout;
}
const connection=['-h',socket,'-p','55439','-d','postgres','-X','-q','-t','-A','-v','ON_ERROR_STOP=1'];
function sql(statement) { return command('psql',[...connection,'-c',statement]).trim(); }
function check(value,label) { assertions++; assert.ok(value,label); }
function rpc(name,payload) { return JSON.parse(sql(`set role service_role; select to_jsonb(public.${name}('${JSON.stringify(payload).replaceAll("'","''")}'::jsonb));`)); }
function reject(name,payload,pattern) { assertions++; assert.throws(()=>rpc(name,payload),pattern); }
function parallel(statement) {
 return new Promise((resolveResult)=>{ const child=spawn(bin+'psql',[...connection,'-c',statement],{stdio:['ignore','pipe','pipe']}); let out='';let error='';
 child.stdout.on('data',chunk=>out+=chunk); child.stderr.on('data',chunk=>error+=chunk);
 child.on('exit',code=>resolveResult({code,out,error})); child.on('error',error=>resolveResult({code:-1,error:String(error)})); });
}
const actor=randomUUID(); const provider=randomUUID(); const type=randomUUID(); const rule=randomUUID();
const identity={identity_source:'native_scheduler_authenticated_actor',actor_user_id:actor,actor_wp_user_id:9001};
const digest=(value)=>createHash('sha256').update(value).digest('hex');
function order(i,{sku='single',gateway='stripe',coupon='MATCHREADY2026',wp=9001}={}) {
 const prices={single:[1001,24900,39900],three:[1002,74900,109900],five:[1003,119900,179900],emergency:[1004,249900,399900]};
 const [product,promo,regular]=prices[sku];
 return {order_id:`fixture-order-${i}`,order_item_id:`fixture-item-${i}`,wp_customer_id:wp,sku,product_id:product,
 gateway,quantity:1,currency:'USD',tuition_cents:coupon?promo:regular,total_cents:coupon?promo:regular,tax_cents:0,fee_cents:0,coupon,
 order_created_at:new Date(Date.now()-1000).toISOString(),snapshot_digest:digest(`snapshot-${i}`),idempotency_key:`admit-${i}`};
}
function paid(o) { const p={...o,source:'canonical_woo_verified',event_type:'payment_complete',woo_status:'completed',is_paid:true,
 event_id:`event-${o.order_id}`,financial_fingerprint:digest(`bank-${o.order_id}`),payment_verified_at:new Date().toISOString()}; return p; }
function reset() { sql('truncate mr_coaching.operations,mr_coaching.mutation_context,mr_coaching.services,mr_coaching.financial_observations,mr_coaching.financial_evidence,mr_coaching.terminal_unpaid_evidence,mr_coaching.activation_outbox,mr_coaching.orders,public.mm_appointment_audit_log,public.mm_appointment_notifications,public.mm_scheduler_idempotency_keys,public.mm_appointments cascade;'); }
try {
 command('initdb',['-D',data,'--auth-local=trust','--auth-host=reject','--no-locale','--encoding=UTF8']);
 command('pg_ctl',['-D',data,'-l',join(dir,'postgres.log'),'-o',`-k ${socket} -p 55439 -c listen_addresses='' -c fsync=off`,'-w','start']); started=true;
 command('psql',[...connection,'-f',join(root,'tests/fixtures/mr-coaching-native-base.sql')]);
 command('psql',[...connection,'-f',join(root,'supabase/migrations/20261019162700_mr_coaching_native_contract.sql')]);
 const nonce={issuer:'canonical_woo',nonce:'synthetic_durable_nonce_001',timestamp:Math.floor(Date.now()/1000)};
 check(rpc('mm_coaching_claim_bridge_nonce',nonce)===true,'first durable nonce claim');
 check(rpc('mm_coaching_claim_bridge_nonce',nonce)===false,'durable nonce replay denied');
 assertions++;assert.throws(()=>sql("begin isolation level repeatable read; set role service_role; select public.mm_coaching_claim_bridge_nonce('{}'); commit;"),/coaching_read_committed_required/);
 reject('mm_coaching_admit_order',order('off'),/coaching_disabled/);
 for(const role of ['anon','authenticated']) {
  assertions++; assert.throws(()=>sql(`set role ${role}; select public.mm_coaching_admit_order('{}');`),/permission denied/);
  assertions++; assert.throws(()=>sql(`set role ${role}; select * from mr_coaching.orders;`),/permission denied/);
 }
 sql(`insert into public.mm_schedule_providers(id,display_name) values('${provider}','LOCAL SYNTHETIC PROVIDER');
 insert into public.mm_appointment_types(id,slug,name,duration_minutes,active,status,min_notice_minutes,max_booking_window_days)
 values('${type}','local-synthetic-donor','LOCAL SYNTHETIC DONOR',180,true,'active',0,3650);
 insert into public.mm_provider_appointment_types(provider_id,appointment_type_id) values('${provider}','${type}');
 insert into public.mm_availability_rules(id,provider_id,appointment_type_id,start_time,end_time,effective_start)
 values('${rule}','${provider}','${type}','00:00','23:59','2020-01-01');
 update mr_coaching.campaign set enabled=true,cutoff=clock_timestamp()+interval '10 years';
 update mr_coaching.offers set enabled=true,product_id=case sku when 'single' then 1001 when 'three' then 1002 when 'five' then 1003 else 1004 end;`);
 reject('mm_coaching_admit_order',order('noavailability'),/authorized_service_availability_required/);
 const approvals={}; const isolatedTypes={};
 for(const service of ['strategy','mock','debrief']) {
  const a=rpc('mm_coaching_approve_availability',{approval_source:'authenticated_founder',founder_actor_id:actor,approval_evidence_id:`founder-${service}`,
    service,availability_rule_id:rule,provider_id:provider,appointment_type_id:type,approved_from:'2020-01-01T00:00:00Z',approved_until:'2040-01-01T00:00:00Z'});
  approvals[service]=a.id;isolatedTypes[service]=a.appointment_type_id;
 }
 check(Object.values(isolatedTypes).every(id=>id!==type),'Founder approval creates isolated types, preserving donor');
 check(sql(`select duration_minutes from public.mm_appointment_types where id='${type}'`)==='180','legacy type duration unchanged');
 sql(`insert into public.mm_blackout_windows(provider_id,start_at,end_at,reason) values('${provider}',clock_timestamp()-interval '1 day',clock_timestamp()+interval '70 days','LOCAL SYNTHETIC FULL BLACKOUT');`);
 reject('mm_coaching_admit_order',order('allblocked'),/authorized_service_availability_required/);
 sql('delete from public.mm_blackout_windows;');
 reject('mm_coaching_admit_order',order('emergency',{sku:'emergency'}),/emergency_request_first/);
 reject('mm_coaching_admit_order',{...order('quantity'),quantity:2},/invalid_order_snapshot/);
 reject('mm_coaching_admit_order',{...order('wrongfees'),total_cents:24901},/invalid_order_snapshot/);
 sql("update mr_coaching.campaign set cutoff=clock_timestamp()-interval '1 second';");
 reject('mm_coaching_admit_order',order('deadline'),/promotion_unavailable/);
 sql("update mr_coaching.campaign set cutoff=clock_timestamp()+interval '10 years';");
 const raced=Array.from({length:21},(_,i)=>order(i));
 const outcomes=await Promise.all(raced.map(o=>parallel(`set role service_role; select public.mm_coaching_admit_order('${JSON.stringify(o)}');`)));
 check(outcomes.filter(r=>r.code===0).length===20,'21 parallel admission requests admit exactly20');
 check(sql("select count(*) from mr_coaching.orders where state='paid'")==='0','unpaid reservations are not redemptions');
 check(sql("select count(*) from mr_coaching.orders where state='reserved'")==='20','separate active reservations');
 const admitted=JSON.parse(sql('select jsonb_agg(snapshot || jsonb_build_object(\'snapshot_digest\',snapshot_digest,\'idempotency_key\',reservation_key)) from mr_coaching.orders;'));
 const paymentEvents=admitted.map(paid);
 const missingStatus={...paymentEvents[0]};delete missingStatus.woo_status;
 reject('mm_coaching_verified_payment',missingStatus,/canonical_verified_snapshot_required/);
 const completed=await Promise.all(paymentEvents.map(p=>parallel(`set role service_role; select public.mm_coaching_verified_payment('${JSON.stringify(p)}');`)));
 check(completed.every(r=>r.code===0),'20 parallel genuine verified events complete');
 check(sql("select count(*) from mr_coaching.orders where state='paid'")==='20','exactly20 paid');
 reject('mm_coaching_admit_order',order('21st'),/promotion_unavailable/);
 check(rpc('mm_coaching_verified_payment',paymentEvents[0]).idempotency_replay,'financial event replay idempotent');
 const progress={...paymentEvents[0],woo_status:'processing'};
 check(rpc('mm_coaching_verified_payment',progress).woo_status==='completed','older processing replay never downgrades completed');
 check(rpc('mm_coaching_verified_payment',{...progress,woo_status:'completed'}).idempotency_replay,'processing to completed replay accepted');
 reject('mm_coaching_verified_payment',{...paymentEvents[0],total_cents:1},/canonical_verified_snapshot_required/);
 check(sql('select count(*) from mr_coaching.services;')==='20','replay does not duplicate package credits');
 check(sql('select count(*) from mr_coaching.activation_outbox;')==='20','one transactional activation event per paid package');
 const claims=await Promise.all(Array.from({length:21},(_,i)=>parallel(`set role service_role; select to_jsonb(public.mm_coaching_claim_activation_outbox('{"worker_id":"local-worker-${i}","claim_request_id":"local-claim-${i}"}'));`)));
 const claimed=claims.filter(r=>r.code===0&&r.out.trim()&&r.out.trim()!=='null').map(r=>JSON.parse(r.out));
 check(claimed.length===20&&new Set(claimed.map(r=>r.id)).size===20,'parallel outbox claimers never duplicate package event');
 const ack={id:claimed[0].id,claim_token:claimed[0].claim_token,worker_id:claimed[0].worker_id,provider_message_id:'LOCAL SYNTHETIC RECEIPT'};
 check(rpc('mm_coaching_ack_activation_outbox',ack).status==='sent','claimed activation event acknowledges exact receipt');
 check(rpc('mm_coaching_ack_activation_outbox',ack).idempotency_replay,'delivery acknowledgement replay safe');
 reject('mm_coaching_ack_activation_outbox',{...ack,claim_token:randomUUID()},/outbox_claim_proof_required/);
 reset();
 const z=order('zelle',{gateway:'bacs'}); rpc('mm_coaching_admit_order',z);
 sql("update mr_coaching.orders set expires_at=clock_timestamp()-interval '1 second' where gateway='bacs';");
 check(rpc('mm_coaching_admit_order',z).state==='released','replay expires but never renews original hold');
 const late=paid(z); check(rpc('mm_coaching_verified_payment',late).state==='review','late Zelle goes to review');
 check(sql('select count(*) from mr_coaching.financial_evidence;')==='1','late financial evidence permanently retained');
 check(sql('select count(*) from mr_coaching.services;')==='0','late payment grants no service');
 const stripe=order('unknownstripe'); rpc('mm_coaching_admit_order',stripe);
 sql("update mr_coaching.orders set original_created_at=clock_timestamp()-interval '3 days',expires_at=clock_timestamp()-interval '1 day' where gateway='stripe';");
 check(rpc('mm_coaching_admit_order',stripe).state==='reserved','unknown in-flight Stripe never expires by timer');
 const terminal={...stripe,source:'canonical_woo_verified',event_type:'terminal_unpaid',is_paid:false,
 financial_outcome:'verified_terminal_unpaid',provider_status:'canceled',gateway_funds_received:false,
 provider_evidence_id:'fixture-canceled-payment-intent',release_event_id:'fixture-terminal-release'};
 reject('mm_coaching_release_unpaid_order',{...terminal,provider_status:'requires_payment_method'},/trusted_terminal_unpaid_provider_evidence_required/);
 reject('mm_coaching_release_unpaid_order',{...terminal,provider_evidence_id:null},/trusted_terminal_unpaid_provider_evidence_required/);
 reject('mm_coaching_release_unpaid_order',{...terminal,gateway_funds_received:true},/trusted_terminal_unpaid_provider_evidence_required/);
 check(rpc('mm_coaching_release_unpaid_order',terminal).state==='released','trusted canceled no-funds Stripe releases reservation');
 check(rpc('mm_coaching_release_unpaid_order',terminal).idempotency_replay,'terminal event replay safe');
 check(rpc('mm_coaching_admit_order',stripe).state==='released','gateway admission replay never restores released Stripe');
 check(rpc('mm_coaching_verified_payment',paid(stripe)).state==='review','contradictory late money retained for review after release');
 reject('mm_coaching_release_unpaid_order',terminal,/financial_evidence_prevents_unpaid_release/);
 reset();
 const pack=order('five',{sku:'five'}); rpc('mm_coaching_admit_order',pack); rpc('mm_coaching_verified_payment',paid(pack));
 reject('mm_coaching_release_unpaid_order',{...terminal,...pack,release_event_id:'cannot-release-paid'},/financial_evidence_prevents_unpaid_release/);
 let model=rpc('mm_coaching_read_model',identity);
 check(model.packages[0].services.length===9,'five package exact1strategy5mocks3debriefs');
 check(model.eligible_services.length===3&&model.eligible_services.every(s=>s.appointment_type_id!==s.donor_appointment_type_id),'owned readmodel exposes isolated service/type/approval mapping');
 reject('mm_coaching_read_model',{...identity,actor_user_id:randomUUID()},/identity_binding_conflict/);
 const credits=Object.fromEntries(model.packages[0].services.map(s=>[`${s.service}:${s.ordinal}`,s]));
 function booking(key,start,extra={}) { const credit=credits[key]; return {...identity,action:'book',idempotency_key:randomUUID(),service_credit_id:credit.id,
   approval_id:approvals[credit.service],provider_id:provider,appointment_type_id:isolatedTypes[credit.service],timezone:'America/New_York',start_at:start,
   end_at:new Date(Date.parse(start)+credit.minutes*60000).toISOString(),...extra}; }
 const monday='2031-07-07T13:00:00Z';
 reject('mm_coaching_mutate_appointment',booking('mock:1','2031-07-07T16:00:00Z'),/strategy_must_precede_mock/);
 const strat=booking('strategy:1',monday); const stratResult=rpc('mm_coaching_mutate_appointment',strat);
 check(rpc('mm_coaching_mutate_appointment',strat).idempotency_replay,'booking retry replays native result');
 const mock=booking('mock:1','2031-07-07T16:00:00Z'); const mockResult=rpc('mm_coaching_mutate_appointment',mock);
 const direct={...booking('mock:2','2031-07-12T13:00:00Z'),student_user_id:actor,student_wp_user_id:9001,actor_type:'admin'};
 reject('mm_scheduler_book_appointment',direct,/coaching_native_credit_context_required/);
 reject('mm_scheduler_cancel_appointment',{actor_user_id:actor,actor_type:'admin',appointment_id:stratResult.appointment_id,idempotency_key:randomUUID()},/coaching_native_credit_context_required/);
 reject('mm_scheduler_reschedule_appointment',{...direct,appointment_id:stratResult.appointment_id,appointment_type_id:isolatedTypes.strategy,end_at:'2031-07-12T15:00:00Z'},/coaching_native_credit_context_required/);
 assertions++;assert.throws(()=>sql(`set role service_role; set mr_coaching.credit_id='${credits['mock:2'].id}'; select public.mm_scheduler_book_appointment('${JSON.stringify({...direct,idempotency_key:randomUUID()})}');`),/coaching_native_credit_context_required/);
 assertions++;assert.throws(()=>sql(`delete from public.mm_appointments where id='${stratResult.appointment_id}';`),/coaching_hard_delete_forbidden/);
 const sameCredit=await Promise.all([1,2].map(()=>{
   const p=booking('mock:3','2031-07-07T19:00:00Z');
   return parallel(`set role service_role; select public.mm_coaching_mutate_appointment('${JSON.stringify(p)}');`);
 }));
 check(sameCredit.filter(r=>r.code===0).length===1,'parallel same-credit booking admits once');
 reject('mm_coaching_mutate_appointment',{...strat,action:'cancel',idempotency_key:randomUUID(),appointment_id:stratResult.appointment_id},/dependent_mock_sequence_requires_review/);
 reject('mm_coaching_mutate_appointment',{...strat,action:'reschedule',idempotency_key:randomUUID(),appointment_id:stratResult.appointment_id,start_at:'2031-07-07T21:00:00Z',end_at:'2031-07-07T23:00:00Z'},/dependent_mock_sequence_requires_review/);
 reject('mm_coaching_mutate_appointment',booking('mock:2','2031-07-07T16:00:00Z'),/outside_actual_authorized_rule/);
 const canceled=rpc('mm_coaching_mutate_appointment',{...mock,action:'cancel',idempotency_key:randomUUID(),appointment_id:mockResult.appointment_id});
 check(canceled.ok,'native cancellation');
 check(sql(`select state from mr_coaching.services where id='${credits['mock:1'].id}'`)==='available','>=24h cancellation releases credit');
 check(sql('select count(*) from public.mm_appointment_audit_log')==='4','actual native audit survives composition; failed mutations roll back');
 check(sql('select count(*) from public.mm_appointment_notifications')==='4','actual native notification placeholders retained');
 // Existing non-coaching appointment conflict is enforced by base exclusion.
 sql(`insert into public.mm_appointments(student_user_id,student_wp_user_id,provider_id,appointment_type_id,start_at,end_at)
 values('${randomUUID()}',700,'${provider}','${type}','2031-07-08T13:00:00Z','2031-07-08T14:00:00Z');`);
 reject('mm_coaching_mutate_appointment',booking('mock:2','2031-07-08T13:00:00Z'),/outside_actual_authorized_rule/);
 // Put usage at1090 (120strategy+105mock+865synthetic) so two parallel105min
 // requests have room for exactly one. Fixture insertion is synthetic setup.
 sql(`insert into public.mm_appointments(id,student_user_id,provider_id,appointment_type_id,start_at,end_at,status)
 values('00000000-0000-0000-0000-000000000111','${actor}','${provider}','${type}','2031-07-09T00:00:00Z','2031-07-09T14:25:00Z','completed');
 update mr_coaching.services set appointment_id='00000000-0000-0000-0000-000000000111',state='delivered' where id='${credits['mock:5'].id}';`);
 const weeklyRace=await Promise.all([['mock:2','2031-07-10T13:00:00Z'],['mock:4','2031-07-11T13:00:00Z']].map(([key,start])=>{
   const p=booking(key,start);return parallel(`set role service_role; select public.mm_coaching_mutate_appointment('${JSON.stringify(p)}');`);
 }));
 check(weeklyRace.filter(r=>r.code===0).length===1,'weekly parallel capacity admits exactly one below1200');
 check(weeklyRace.some(r=>r.error.includes('weekly_coaching_capacity_exceeded')),'weekly parallel loser fails capacity');
 const actualWeek=sql("select sum(extract(epoch from(ap.end_at-ap.start_at))/60)::integer from mr_coaching.services s join public.mm_appointments ap on ap.id=s.appointment_id where ap.status in ('booked','confirmed','completed');");
 check(actualWeek==='1195','actual persisted weekly allocation never exceeds1200');
 check(sql("select count(*) from public.mm_appointments where student_wp_user_id=700;")==='1','existing appointment retained');
 const legacy=rpc('mm_scheduler_book_appointment',{actor_user_id:actor,student_user_id:actor,student_wp_user_id:701,actor_type:'student',
  appointment_type_id:type,provider_id:provider,start_at:'2031-07-13T13:00:00Z',end_at:'2031-07-13T16:00:00Z',timezone:'America/New_York',idempotency_key:randomUUID()});
 check(legacy.ok,'unchanged original native RPC still books unlinked legacy type');
 check(sql('select count(*) from mr_coaching.mutation_context')==='0','transaction-bound credit context leaves no reusable authority');
 console.log(`PASS ${assertions} real local PostgreSQL assertions against exact foundation+current3nativeRPC source; live data/runtime integration UNVERIFIED.`);
} finally {
 if(started) command('pg_ctl',['-D',data,'-m','fast','-w','stop']);
 if(dir.startsWith(join(tmpdir(),'mr-coaching-pg-'))) rmSync(dir,{recursive:true,force:true});
}
