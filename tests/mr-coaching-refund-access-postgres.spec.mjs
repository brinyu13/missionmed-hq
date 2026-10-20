import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// PRIVATE LOCAL TEST. Exact preserved foundation + three current native RPCs;
// no production/provider requests, real accounts, orders, payments or new secrets.
const ROOT=process.argv[2] || fileURLToPath(new URL('../',import.meta.url));
const candidate=process.argv[3] || fileURLToPath(new URL('../supabase/migrations/20261020150727_mr_ir_commerce_0001_refund_access_containment.sql',import.meta.url));
const dir=mkdtempSync(join(tmpdir(),'mr-c-revoke-pg-'));const data=join(dir,'data');const socket=join(dir,'socket');mkdirSync(socket);
const BIN='/opt/homebrew/bin/';let started=false;let count=0;
const args=['-h',socket,'-p','55439','-d','postgres','-X','-q','-t','-A','-v','ON_ERROR_STOP=1'];
function cmd(name,values){const r=spawnSync(BIN+name,values,{encoding:'utf8',timeout:60000});if(r.status!==0)throw Error(`${name}: ${r.stderr||r.stdout||r.error}`);return r.stdout;}
const sql=s=>cmd('psql',[...args,'-c',s]).trim();
const check=(v,label)=>{count++;assert.ok(v,label);};
const hash=s=>createHash('sha256').update(s).digest('hex');
const query=(name,p)=>`set role service_role;select to_jsonb(public.${name}('${JSON.stringify(p).replaceAll("'","''")}'::jsonb));`;
function rpc(name,p){const r=sql(query(name,p));return r?JSON.parse(r):null;}
function reject(name,p,pattern){count++;assert.throws(()=>rpc(name,p),pattern);}
function parallel(statement){return new Promise(resolve=>{const c=spawn(BIN+'psql',[...args,'-c',statement]);let out='',error='';c.stdout.on('data',x=>out+=x);c.stderr.on('data',x=>error+=x);c.on('exit',code=>resolve({code,out,error}));});}
const actor=randomUUID(),provider=randomUUID(),donor=randomUUID(),rule=randomUUID();
const identity={identity_source:'native_scheduler_authenticated_actor',allowance_source:'authenticated_server_woo_read',actor_user_id:actor,actor_wp_user_id:9001};
const approvals={},types={};
function pack(order=101,sku='five',revision=1){const units=[];const counts=sku==='single'?{mock:1}:sku==='three'?{strategy:1,mock:3,debrief:2}:{strategy:1,mock:5,debrief:3};
 const p={order_id:order,order_item_id:order+1000,product_id:8000+(sku==='single'?1:sku==='three'?2:3),sku,snapshot_digest:hash(`snapshot-${order}`),eligibility_revision:revision,units};
 for(const [service,n] of Object.entries(counts))for(let ordinal=1;ordinal<=n;ordinal++)units.push({unit_id:`coaching-unit:v1:${order}:${p.order_item_id}:${service}:${ordinal}`,order_id:order,order_item_id:p.order_item_id,owner_wp_user_id:9001,product_id:p.product_id,sku,service,ordinal,duration_minutes:{strategy:120,mock:105,debrief:45}[service],snapshot_digest:p.snapshot_digest});p.eligible_unit_ids=units.map(u=>u.unit_id);return p;}
function receipt(packages=[pack()],extra={}){const now=Math.floor(Date.now()/1000);return {schema:'missionmed.coaching.allowances.v1',request_id:randomBytes(24).toString('hex'),subject_wp_user_id:9001,subject_user_id:actor,checked_at:now,valid_until:now+15,complete:true,packages,...extra};}
const read=(r=receipt())=>({...identity,request_digest:hash('read:'+r.request_id),allowance_receipt:r});
const BIND=['actor_user_id','actor_wp_user_id','action','idempotency_key','client_request_digest','unit_id','appointment_id','appointment_type_id','provider_id','resource_id','approval_id','start_at','end_at','timezone'];
function bind(p){p.request_binding=JSON.stringify(Object.fromEntries(BIND.map(k=>[k,p[k]??null])));p.request_digest=hash(p.request_binding);return p;}
function booking(service,ordinal,start,{order=101,sku='five',...extra}={}){const pkg=pack(order,sku);const unit=pkg.units.find(u=>u.service===service&&u.ordinal===ordinal);
 return bind({...identity,action:'book',idempotency_key:randomUUID(),client_request_digest:hash(randomUUID()),unit_id:unit.unit_id,approval_id:approvals[service],appointment_type_id:types[service],provider_id:provider,resource_id:null,timezone:'America/New_York',
  start_at:start,end_at:new Date(Date.parse(start)+unit.duration_minutes*60000).toISOString(),allowance_receipt:receipt([pkg]),...extra});}
try{
 cmd('initdb',['-D',data,'--auth-local=trust','--auth-host=reject','--no-locale','--encoding=UTF8']);
 cmd('pg_ctl',['-D',data,'-l',join(dir,'postgres.log'),'-o',`-k ${socket} -p 55439 -c listen_addresses='' -c fsync=off -c max_wal_size=32MB -c min_wal_size=32MB -c temp_file_limit=65536`,'-w','start']);started=true;
 for(const file of ['tests/fixtures/mr-coaching-native-base.sql','supabase/migrations/20261019162700_mr_coaching_native_contract.sql','supabase/migrations/20261019171856_mr_ir_commerce_0001_booking_refund_safety.sql'])cmd('psql',[...args,'-f',join(ROOT,file)]);
 cmd('psql',[...args,'-f',join(ROOT,'supabase/migrations/20261020141151_mr_ir_commerce_0001_woo_hybrid.sql')]);
 const nativeBodies=sql("select jsonb_object_agg(proname,md5(pg_get_functiondef(oid))) from pg_proc where pronamespace='public'::regnamespace and proname in ('mm_scheduler_book_appointment','mm_scheduler_reschedule_appointment','mm_scheduler_cancel_appointment')");
 cmd('psql',[...args,'-f',candidate]);
 check(sql("select jsonb_object_agg(proname,md5(pg_get_functiondef(oid))) from pg_proc where pronamespace='public'::regnamespace and proname in ('mm_scheduler_book_appointment','mm_scheduler_reschedule_appointment','mm_scheduler_cancel_appointment')")===nativeBodies,'all three original native RPC bodies byte-unchanged by combined forward migration');
 const retired=['admit_order','verified_payment','observe_refund','release_unpaid_order','claim_activation_outbox','ack_activation_outbox','claim_bridge_nonce','read_model','lookup_operation','mutate_appointment'];
 for(const name of retired)check(sql(`select has_function_privilege('service_role','public.mm_coaching_${name}(jsonb)','execute')`)==='f',`retired ${name} cannot execute`);
 reject('mm_coaching_verified_payment',{},/permission denied/);
 for(const role of ['anon','authenticated']){count++;assert.throws(()=>sql(`set role ${role};select public.mm_coaching_hybrid_read_model('{}');`),/permission denied/);count++;assert.throws(()=>sql(`set role ${role};select * from mr_coaching.woo_allowances;`),/permission denied/);}
 count++;assert.throws(()=>sql("set role service_role;update mr_coaching.orders set state='paid';"),/permission denied/);
 sql(`insert into public.mm_schedule_providers(id,display_name)values('${provider}','LOCAL SYNTHETIC COACH');insert into public.mm_appointment_types(id,slug,name,duration_minutes,min_notice_minutes,max_booking_window_days,active,status)values('${donor}','local-360-complete-donor','LOCAL LEGACY TYPE',180,0,3650,true,'active');insert into public.mm_provider_appointment_types(provider_id,appointment_type_id)values('${provider}','${donor}');insert into public.mm_availability_rules(id,provider_id,appointment_type_id,start_time,end_time,effective_start)values('${rule}','${provider}','${donor}','00:00','23:59','2020-01-01');`);
 for(const service of ['strategy','mock','debrief']){const a=rpc('mm_coaching_approve_availability',{approval_source:'authenticated_founder',founder_actor_id:actor,approval_evidence_id:`local-${service}`,service,availability_rule_id:rule,provider_id:provider,appointment_type_id:donor,approved_from:'2020-01-01T00:00:00Z',approved_until:'2040-01-01T00:00:00Z'});approvals[service]=a.id;types[service]=a.appointment_type_id;}
 let r=receipt();let model=rpc('mm_coaching_hybrid_read_model',read(r));
 check(model.packages[0].services.length===9&&model.eligible_services.length===3,'immutable Woo allowance projects exact owned usage units without payment activation');
 check(sql('select count(*) from mr_coaching.orders')==='0'&&sql('select count(*) from mr_coaching.financial_evidence')==='0'&&sql('select count(*) from mr_coaching.activation_outbox')==='0','hybrid read creates no native financial ledger or activation');
 check(sql('select count(*) from mr_coaching.services')==='9','one native lifecycle per Woo unit, no second mutable remaining counter');
 reject('mm_coaching_hybrid_read_model',read(r),/duplicate key/);
 model=rpc('mm_coaching_hybrid_read_model',read(receipt([])));
 check(model.packages.length===1&&model.packages[0].booking_allowed===false&&model.packages[0].services.length===9&&model.eligible_services.length===0,'complete absence retains owned unit history with no booking or availability rights');
 const otherActor=randomUUID();
 const otherReceipt=receipt([],{subject_user_id:otherActor});
 check(rpc('mm_coaching_hybrid_read_model',{...read(otherReceipt),actor_user_id:otherActor}).packages.length===0,'history never leaks across native actor ownership');
 const otherWpReceipt=receipt([],{subject_wp_user_id:9002});
 check(rpc('mm_coaching_hybrid_read_model',{...read(otherWpReceipt),actor_wp_user_id:9002}).packages.length===0,'history requires exact WordPress ownership too');
 const stale=Math.floor(Date.now()/1000)-16;
 reject('mm_coaching_hybrid_read_model',read(receipt([pack()],{checked_at:stale,valid_until:stale+15})),/woo_receipt_expired/);
 reject('mm_coaching_hybrid_read_model',read(receipt([pack()],{complete:false})),/exact_owned_complete/);
 reject('mm_coaching_hybrid_read_model',read(receipt([pack()],{subject_wp_user_id:999})),/exact_owned_complete/);
 reject('mm_coaching_hybrid_read_model',{...read(),actor_user_id:randomUUID()},/exact_owned_complete/);
 const changed=pack();changed.snapshot_digest=hash('changed');reject('mm_coaching_hybrid_read_model',read(receipt([changed])),/immutable_woo_owner_snapshot_mismatch/);
 const duplicate=pack(102);duplicate.units[1]=duplicate.units[0];reject('mm_coaching_hybrid_read_model',read(receipt([duplicate])),/duplicate_or_missing_woo_units|eligible_woo_unit_subset_required/);
 check(sql('select count(*) from mr_coaching.woo_allowances where order_id=102')==='0','invalid projection rolls back all imported units and package');
 rpc('mm_coaching_hybrid_read_model',read(receipt([pack(101,'five',2)])));
 reject('mm_coaching_hybrid_read_model',read(receipt([pack()])),/woo_revision_rollback/);
 // The server reader now supplies the current monotonic revision for all calls.
 function current(p){p.allowance_receipt.packages=p.allowance_receipt.packages.map(x=>({...x,eligibility_revision:2}));return p;}
 reject('mm_coaching_hybrid_mutate_appointment',current(booking('mock',1,'2031-07-07T16:00:00Z')),/strategy_must_precede_mock/);
 const strategy=current(booking('strategy',1,'2031-07-07T13:00:00Z'));const strategyResult=rpc('mm_coaching_hybrid_mutate_appointment',strategy);
 check(strategyResult.ok,'existing native booking consumes an owned Woo unit in the same transaction');
 check(rpc('mm_coaching_hybrid_mutate_appointment',strategy).idempotency_replay,'owned idempotent replay works before receipt reuse/mutable credit checks');
 reject('mm_coaching_hybrid_mutate_appointment',{...strategy,client_request_digest:hash('changed')},/booking_replay_mismatch/);
 const tampered=current(booking('mock',1,'2031-07-07T16:00:00Z'));tampered.unit_id='coaching-unit:v1:101:1101:mock:2';reject('mm_coaching_hybrid_mutate_appointment',tampered,/server_resolved_request_binding_required/);
 const absent=current(booking('mock',1,'2031-07-07T16:00:00Z'));absent.allowance_receipt.packages=[];reject('mm_coaching_hybrid_mutate_appointment',absent,/current_transaction_woo_eligibility_required/);
 const mock=current(booking('mock',1,'2031-07-07T16:00:00Z'));const mockResult=rpc('mm_coaching_hybrid_mutate_appointment',mock);check(mockResult.ok,'native mock follows owned strategy');
 reject('mm_coaching_hybrid_mutate_appointment',bind({...strategy,action:'cancel',appointment_id:strategyResult.appointment_id,idempotency_key:randomUUID(),client_request_digest:hash(randomUUID())}),/dependent_mock_sequence_requires_review/);
 const blockedStaffCancel={identity_source:'native_scheduler_authenticated_staff',actor_type:'admin',actor_user_id:randomUUID(),actor_wp_user_id:9002,appointment_id:strategyResult.appointment_id,idempotency_key:randomUUID(),client_request_digest:hash(randomUUID()),reason:'Cancel strategy before dependent mocks'};
 reject('mm_coaching_hybrid_staff_cancel_appointment',blockedStaffCancel,/dependent_mock_sequence_requires_review/);
 check(sql(`select status from public.mm_appointments where id='${strategyResult.appointment_id}'`)==='booked'
  &&sql(`select count(*) from mr_coaching.operations where idempotency_key='${blockedStaffCancel.idempotency_key}'`)==='0','staff strategy cancellation cannot orphan reserved future mocks or record a successful operation');
 reject('mm_scheduler_book_appointment',{...current(booking('mock',2,'2031-07-08T13:00:00Z')),student_user_id:actor,student_wp_user_id:9001,actor_type:'admin'},/coaching_native_credit_context_required/);
 reject('mm_scheduler_cancel_appointment',{actor_user_id:actor,actor_type:'admin',appointment_id:mockResult.appointment_id,idempotency_key:randomUUID()},/coaching_native_credit_context_required/);
 reject('mm_scheduler_reschedule_appointment',{...current(booking('mock',2,'2031-07-08T13:00:00Z')),appointment_id:mockResult.appointment_id,actor_type:'admin'},/coaching_native_credit_context_required/);
 const raced=await Promise.all(['2031-07-08T13:00:00Z','2031-07-09T13:00:00Z'].map(t=>parallel(query('mm_coaching_hybrid_mutate_appointment',current(booking('mock',2,t))))));
 check(raced.filter(x=>x.code===0).length===1,'two concurrent bookings consume the same unit exactly once');
 const reschedule=current(bind({...mock,action:'reschedule',idempotency_key:randomUUID(),client_request_digest:hash(randomUUID()),appointment_id:mockResult.appointment_id,start_at:'2031-07-07T18:00:00Z',end_at:'2031-07-07T19:45:00Z',allowance_receipt:receipt([pack()])}));
 check(rpc('mm_coaching_hybrid_mutate_appointment',reschedule).ok,'reschedule refreshes Woo eligibility and preserves same usage unit');
 model=rpc('mm_coaching_hybrid_read_model',read(receipt([])));
 const revokedPackage=model.packages.find(p=>p.order_id===101);
 const revokedUnit=revokedPackage.services.find(s=>s.unit_id===mock.unit_id);
 check(revokedPackage.booking_allowed===false&&revokedUnit.appointment_id===mockResult.appointment_id&&revokedUnit.state==='reserved'&&model.eligible_services.length===0,'revocation retains owned appointment and unit identity for cancellation');
 reject('mm_coaching_hybrid_mutate_appointment',bind({...reschedule,idempotency_key:randomUUID(),client_request_digest:hash(randomUUID()),allowance_receipt:receipt([])}),/current_transaction_woo_eligibility_required/);
 const cancel=bind({...reschedule,action:'cancel',idempotency_key:randomUUID(),client_request_digest:hash(randomUUID())});delete cancel.allowance_receipt;
 reject('mm_coaching_hybrid_mutate_appointment',bind({...cancel,actor_user_id:randomUUID(),idempotency_key:randomUUID()}),/owned_usage_required/);
 check(rpc('mm_coaching_hybrid_mutate_appointment',cancel).ok,'owned native cancellation requires no Woo availability or refund eligibility');
 check(rpc('mm_coaching_hybrid_mutate_appointment',cancel).idempotency_replay,'post-cancel retry survives cleared appointment link');
 check(sql("select state from mr_coaching.services where woo_unit_id='coaching-unit:v1:101:1101:mock:1'")==='available','cancellation releases existing usage lifecycle, not purchased allowance');
 model=rpc('mm_coaching_hybrid_read_model',read(receipt([])));
 check(model.packages[0].booking_allowed===false&&model.packages[0].services.some(s=>s.unit_id===mock.unit_id&&s.state==='available'&&s.appointment_id===null),'cancelled history remains visible without restoring purchased rights');
 const cancelledRebook=current(booking('mock',1,'2031-07-14T16:00:00Z'));cancelledRebook.allowance_receipt.packages=[];
 reject('mm_coaching_hybrid_mutate_appointment',cancelledRebook,/current_transaction_woo_eligibility_required/);
 count++;assert.throws(()=>sql(`delete from public.mm_appointments where id='${mockResult.appointment_id}'`),/coaching_hard_delete_forbidden/);
 const legacy=rpc('mm_scheduler_book_appointment',{actor_user_id:actor,student_user_id:actor,student_wp_user_id:9001,actor_type:'student',appointment_type_id:donor,provider_id:provider,start_at:'2031-07-13T13:00:00Z',end_at:'2031-07-13T16:00:00Z',timezone:'America/New_York',idempotency_key:randomUUID()});
 check(legacy.ok&&sql(`select duration_minutes from public.mm_appointment_types where id='${donor}'`)==='180','legacy 360/Complete donor type and original native RPC remain unchanged');
 check(Number(sql('select count(*) from public.mm_appointment_audit_log'))>=5&&Number(sql('select count(*) from public.mm_appointment_notifications'))>=5,'original native audit and notification placeholders preserved');
 // Create synthetic delivered usage to leave room for one, not two, 105m units.
 const currently=Number(sql("select coalesce(sum(extract(epoch from(ap.end_at-ap.start_at))/60),0) from mr_coaching.services s join public.mm_appointments ap on ap.id=s.appointment_id where ap.status in ('held','booked','confirmed','completed','no_show')"));
 const syntheticMinutes=1090-currently;const syntheticId=randomUUID();
 sql(`insert into public.mm_appointments(id,student_user_id,provider_id,appointment_type_id,start_at,end_at,status)values('${syntheticId}','${actor}','${provider}','${donor}','2031-07-10T00:00:00Z','2031-07-10T00:00:00Z'::timestamptz+interval '${syntheticMinutes} minutes','completed');update mr_coaching.services set appointment_id='${syntheticId}',state='delivered' where woo_unit_id='coaching-unit:v1:101:1101:mock:5';`);
 const weekly=await Promise.all([['mock',3,'2031-07-11T13:00:00Z'],['mock',4,'2031-07-12T13:00:00Z']].map(([s,n,t])=>parallel(query('mm_coaching_hybrid_mutate_appointment',current(booking(s,n,t))))));
 check(weekly.filter(x=>x.code===0).length===1&&weekly.some(x=>x.error.includes('weekly_coaching_capacity_exceeded')),'global NY-week cap remains atomic under concurrent Woo-authorized bookings');
 model=rpc('mm_coaching_hybrid_read_model',read(receipt([pack(101,'five',2)])));
 check(model.weekly_usage.some(w=>Number(w.used_minutes)===1195),'display usage matches native atomic 1195-minute persisted allocation');
 check(sql('select count(*) from mr_coaching.mutation_context')==='0','no reusable transaction context remains');
 check(sql('select count(*) from mr_coaching.orders')==='0'&&sql('select count(*) from mr_coaching.financial_evidence')==='0','book/reschedule/cancel never fabricate native financial authority');

 // Fresh current unit subsets never alter the immutable purchased projection.
 for(const malformed of [null,['unknown-unit'],['coaching-unit:v1:404:1404:mock:1','coaching-unit:v1:404:1404:mock:1']]){
  const p=pack(404,'single');p.eligible_unit_ids=malformed;reject('mm_coaching_hybrid_read_model',read(receipt([p])),/immutable_woo_package_required|eligible_woo_unit_subset_required/);
 }
 const missing=pack(404,'single');delete missing.eligible_unit_ids;reject('mm_coaching_hybrid_read_model',read(receipt([missing])),/immutable_woo_package_required/);
 rpc('mm_coaching_hybrid_read_model',read(receipt([pack(404,'single')])));
 const refundedBefore=booking('mock',1,'2032-06-01T13:00:00Z',{order:404,sku:'single'});refundedBefore.allowance_receipt=receipt([]);
 reject('mm_coaching_hybrid_mutate_appointment',refundedBefore,/current_transaction_woo_eligibility_required/);
 check(sql("select count(*) from mr_coaching.services where woo_allowance_id=(select id from mr_coaching.woo_allowances where order_id=404)")==='1','full refund before booking preserves purchased unit history only');

 const staff=randomUUID();const staffPayload=(appointment_id,extra={})=>({identity_source:'native_scheduler_authenticated_staff',actor_type:'admin',actor_user_id:staff,actor_wp_user_id:9002,appointment_id,idempotency_key:randomUUID(),client_request_digest:hash(randomUUID()),reason:'Refund containment: revoke future service',...extra});
 for(const role of ['anon','authenticated']){count++;assert.throws(()=>sql(`set role ${role};select public.mm_coaching_hybrid_staff_cancel_appointment('{}');`),/permission denied/);}
 const full=booking('mock',1,'2032-06-02T13:00:00Z',{order:405,sku:'single'});const fullResult=rpc('mm_coaching_hybrid_mutate_appointment',full);
 model=rpc('mm_coaching_hybrid_read_model',read(receipt([])));
 const fullHistory=model.packages.find(p=>p.order_id===405);
 check(fullHistory.booking_allowed===false&&fullHistory.services[0].booking_allowed===false&&fullHistory.services[0].appointment_id===fullResult.appointment_id,'full refund after booking retains owned usage with every booking right false');
 const deniedMove=bind({...full,action:'reschedule',appointment_id:fullResult.appointment_id,idempotency_key:randomUUID(),client_request_digest:hash(randomUUID()),allowance_receipt:receipt([])});
 reject('mm_coaching_hybrid_mutate_appointment',deniedMove,/current_transaction_woo_eligibility_required/);
 reject('mm_coaching_hybrid_staff_cancel_appointment',staffPayload(fullResult.appointment_id,{actor_type:'student'}),/authenticated_staff_cancellation_required/);
 sql(`update mr_coaching.woo_allowances set customer_id='${randomUUID()}' where order_id=405;`);
 reject('mm_coaching_hybrid_staff_cancel_appointment',staffPayload(fullResult.appointment_id),/staff_cancel_native_owner_mismatch/);
 sql(`update mr_coaching.woo_allowances set customer_id='${actor}' where order_id=405;`);
 const staffCancel=staffPayload(fullResult.appointment_id,{student_user_id:randomUUID(),unit_id:'forged-client-unit'});
 check(rpc('mm_coaching_hybrid_staff_cancel_appointment',staffCancel).ok,'actual staff path derives owner and unit from locked appointment; client target aliases ignored');
 check(rpc('mm_coaching_hybrid_staff_cancel_appointment',staffCancel).idempotency_replay,'staff replay survives released appointment link');
 reject('mm_coaching_hybrid_staff_cancel_appointment',{...staffCancel,actor_user_id:randomUUID()},/staff_cancel_replay_mismatch/);
 reject('mm_coaching_hybrid_staff_cancel_appointment',{...staffCancel,reason:'changed'},/staff_cancel_replay_mismatch/);
 check(sql(`select count(*) from public.mm_appointment_audit_log where entity_id='${fullResult.appointment_id}' and action='appointment.canceled' and actor_type='admin' and actor_id='${staff}' and actor_wp_user_id=9002`)==='1','native audit records exact actual staff actor once');
 check(sql(`select status from public.mm_appointments where id='${fullResult.appointment_id}'`)==='canceled','staff cancellation delegates native transaction');
 const rebookRefunded=booking('mock',1,'2032-06-03T13:00:00Z',{order:405,sku:'single'});rebookRefunded.allowance_receipt=receipt([]);
 reject('mm_coaching_hybrid_mutate_appointment',rebookRefunded,/current_transaction_woo_eligibility_required/);

 const partialStrategy=booking('strategy',1,'2032-07-05T13:00:00Z',{order:406,sku:'three'});const partialStrategyResult=rpc('mm_coaching_hybrid_mutate_appointment',partialStrategy);
 const partialMock=booking('mock',1,'2032-07-05T16:00:00Z',{order:406,sku:'three'});const partialMockResult=rpc('mm_coaching_hybrid_mutate_appointment',partialMock);
 sql("update mr_coaching.services set state='delivered' where woo_unit_id='coaching-unit:v1:406:1406:strategy:1'");
 const partial=pack(406,'three',2);partial.eligible_unit_ids=partial.units.filter(u=>(u.service==='mock'&&u.ordinal===2)||(u.service==='debrief'&&u.ordinal===1)).map(u=>u.unit_id);
 model=rpc('mm_coaching_hybrid_read_model',read(receipt([partial])));
 const partialHistory=model.packages.find(p=>p.order_id===406);
 check(partialHistory.services.length===6&&partialHistory.services.filter(s=>s.booking_allowed).length===2,'partial refund preserves full purchased projection and only explicit unit subset usable');
 check(partialHistory.services.some(s=>s.service==='strategy'&&s.state==='delivered'&&s.booking_allowed===false&&s.appointment_id===partialStrategyResult.appointment_id),'delivered usage history survives partial refund');
 check(sql("select immutable_projection ? 'eligible_unit_ids' from mr_coaching.woo_allowances where order_id=406")==='f','mutable eligibility subset excluded from immutable purchased projection');
 const ambiguous=structuredClone(partial);ambiguous.eligible_unit_ids=[];
 reject('mm_coaching_hybrid_read_model',read(receipt([ambiguous])),/woo_revision_membership_mismatch/);
 const badSubsetBook=booking('debrief',2,'2032-07-06T13:00:00Z',{order:406,sku:'three'});badSubsetBook.allowance_receipt=receipt([partial]);
 reject('mm_coaching_hybrid_mutate_appointment',badSubsetBook,/current_transaction_woo_eligibility_required/);
 const eligibleBook=booking('mock',2,'2032-07-06T15:00:00Z',{order:406,sku:'three'});eligibleBook.allowance_receipt=receipt([partial]);
 check(rpc('mm_coaching_hybrid_mutate_appointment',eligibleBook).ok,'partial refund retains a legitimate unrefunded mock unit');
 const badSubsetMove=bind({...partialMock,action:'reschedule',appointment_id:partialMockResult.appointment_id,idempotency_key:randomUUID(),client_request_digest:hash(randomUUID()),allowance_receipt:receipt([partial])});
 reject('mm_coaching_hybrid_mutate_appointment',badSubsetMove,/current_transaction_woo_eligibility_required/);
 reject('mm_coaching_hybrid_staff_cancel_appointment',staffPayload(partialStrategyResult.appointment_id),/staff_cancel_future_reserved_usage_required/);
 const ownerCancel=bind({...partialMock,action:'cancel',appointment_id:partialMockResult.appointment_id,idempotency_key:randomUUID(),client_request_digest:hash(randomUUID())});delete ownerCancel.allowance_receipt;
 check(rpc('mm_coaching_hybrid_mutate_appointment',ownerCancel).ok,'owned student cancellation survives partial per-unit revocation');
 check(rpc('mm_coaching_hybrid_mutate_appointment',ownerCancel).idempotency_replay,'owned revoked-unit cancellation replay preserved');
 check(rpc('mm_coaching_hybrid_staff_cancel_appointment',staffPayload(legacy.appointment_id))===null,'staff coaching helper returns null for legacy native appointments');
 check(sql('select count(*) from mr_coaching.mutation_context')==='0','staff and student operations leave no reusable contexts');


 // Service-owned cancellation independently rechecks the receipt inside SQL.
 for(const role of ['anon','authenticated'])for(const name of ['mm_coaching_hybrid_revoke_appointment','mm_coaching_hybrid_stored_usage']){count++;assert.throws(()=>sql(`set role ${role};select public.${name}('{}');`),/permission denied/);}
 const revokeBook=booking('mock',1,'2032-08-02T13:00:00Z',{order:407,sku:'single'});const revokeBooked=rpc('mm_coaching_hybrid_mutate_appointment',revokeBook);
 const revokePayload=allowance_receipt=>({appointment_id:revokeBooked.appointment_id,allowance_receipt});
 reject('mm_coaching_hybrid_revoke_appointment',revokePayload(receipt([pack(407,'single')])),/coaching_unit_still_eligible/);
 reject('mm_coaching_hybrid_revoke_appointment',revokePayload(receipt([],{subject_user_id:randomUUID()})),/exact_owned_complete_woo_receipt_required/);
 reject('mm_coaching_hybrid_revoke_appointment',revokePayload(receipt([],{complete:false})),/exact_owned_complete_woo_receipt_required/);
 check(sql(`select status from public.mm_appointments where id='${revokeBooked.appointment_id}'`)==='booked','eligible or unknown Woo facts never trigger service cancellation');
 const revoked=rpc('mm_coaching_hybrid_revoke_appointment',revokePayload(receipt([])));
 check(revoked.ok&&sql(`select status from public.mm_appointments where id='${revokeBooked.appointment_id}'`)==='canceled','fresh complete receipt omission atomically delegates native service cancellation');
 check(sql(`select count(*) from public.mm_appointment_audit_log where entity_id='${revokeBooked.appointment_id}' and action='appointment.canceled' and actor_type='service_role' and actor_id='d286cc6c-9862-5462-8da9-6e144427bc9d' and actor_wp_user_id is null`)==='1','service cancellation audit uses documented nonhuman marker, never student-as-system identity');
 check(sql(`select count(*) from public.mm_appointment_notifications where appointment_id='${revokeBooked.appointment_id}' and status in ('pending','failed')`)==='0','service revocation atomically suppresses pending and held notifications');
 check(rpc('mm_coaching_hybrid_revoke_appointment',revokePayload(receipt([]))).idempotency_replay,'service revocation replay survives cleared current unit link');
 const history=rpc('mm_coaching_hybrid_stored_usage',{appointment_id:revokeBooked.appointment_id});
 check(history.unit_id===revokeBook.unit_id&&history.subject_user_id===actor&&history.subject_wp_user_id===9001,'read-only native usage history resolves exact canceled unit and owner from original operation');
 check(rpc('mm_coaching_hybrid_stored_usage',{appointment_id:fullResult.appointment_id}).unit_id===full.unit_id,'staff cancellation historical unit association preserved too');
 check(rpc('mm_coaching_hybrid_revoke_appointment',{appointment_id:legacy.appointment_id,allowance_receipt:receipt([])})===null,'service revocation never cancels an ordinary legacy appointment');
 check(sql('select count(*) from mr_coaching.mutation_context')==='0','service revocation leaves no reusable mutation context');


 // Persistent sweep cursor, service-only lease and conditional queue transitions.
 for(const role of ['anon','authenticated']) {
  for(const name of ['mm_coaching_hybrid_reconciliation_page','mm_coaching_hybrid_reconciliation_checkpoint','mm_coaching_hybrid_claim_maintenance','mm_coaching_hybrid_release_maintenance','mm_coaching_hybrid_due_notifications']){count++;assert.throws(()=>sql(`set role ${role};select public.${name}('{}');`),/permission denied/);}
  for(const table of ['woo_receipt_units','reconciliation_checkpoint']){count++;assert.throws(()=>sql(`set role ${role};select * from mr_coaching.${table};`),/permission denied/);}
 }
 const leaseTokens=[randomUUID(),randomUUID()];
 check(rpc('mm_coaching_hybrid_claim_maintenance',{token:leaseTokens[0]})===false,'packaged maintenance defaults disabled with no timer or provider work');
 check(rpc('mm_coaching_hybrid_reconciliation_page',{limit:2}).enabled===false&&rpc('mm_coaching_hybrid_due_notifications',{limit:5}).length===0,'disabled maintenance produces no sweep or due work');
 sql('update mr_coaching.reconciliation_checkpoint set maintenance_enabled=true'); // Synthetic fixture release only.
 const leaseRace=await Promise.all(leaseTokens.map(token=>parallel(query('mm_coaching_hybrid_claim_maintenance',{token}))));
 check(leaseRace.filter(r=>r.code===0&&r.out.trim()==='true').length===1,'only one concurrent process acquires maintenance lease');
 const winner=leaseTokens[leaseRace.findIndex(r=>r.out.trim()==='true')],loser=leaseTokens.find(t=>t!==winner);
 check(rpc('mm_coaching_hybrid_release_maintenance',{token:loser})===false,'unowned process cannot release current lease');
 check(rpc('mm_coaching_hybrid_claim_maintenance',{token:winner})===true,'owner renews lease before next bounded item');
 sql("update mr_coaching.reconciliation_checkpoint set lease_until=clock_timestamp()-interval '1 second'");
 check(rpc('mm_coaching_hybrid_claim_maintenance',{token:loser})===true&&rpc('mm_coaching_hybrid_release_maintenance',{token:winner})===false,'expired owner cannot clear successor lease');
 check(rpc('mm_coaching_hybrid_reconciliation_page',{limit:2,token:winner}).enabled===false,'expired owner cannot retrieve another sweep page');
 check(rpc('mm_coaching_hybrid_reconciliation_checkpoint',{limit:2,version:0,next_cursor:null,token:winner})===false,'expired owner cannot advance successor checkpoint');
 rpc('mm_coaching_hybrid_release_maintenance',{token:loser});
 const seen=new Set();let completed=false;
 for(let n=0;n<30;n++){
  const page=rpc('mm_coaching_hybrid_reconciliation_page',{limit:2});
  check(page.appointment_ids.length<=2,'native sweep page has deterministic bounded size');
  for(const id of page.appointment_ids){check(id!==legacy.appointment_id&&!seen.has(id),'coaching sweep excludes legacy and never repeats within a cycle');seen.add(id);}
  const ack={limit:2,version:page.version,next_cursor:page.next_cursor};
  check(rpc('mm_coaching_hybrid_reconciliation_checkpoint',ack)===true,'page checkpoint advances by exact version and target cursor');
  check(rpc('mm_coaching_hybrid_reconciliation_checkpoint',ack)===false,'stale concurrent checkpoint cannot overwrite progress');
  if(page.cycle_complete){completed=true;break;}
 }
 check(completed&&seen.has(revokeBooked.appointment_id)&&seen.has(fullResult.appointment_id),'complete bounded sweep includes cancelled coaching history and wraps cursor');
 const due=rpc('mm_coaching_hybrid_due_notifications',{limit:50});
 check(due.every(n=>n.appointment_id!==legacy.appointment_id),'maintenance due query never selects ordinary legacy notifications');
 const queueId=randomUUID(),tokenA='coaching_dispatch:A',tokenB='coaching_dispatch:B';
 sql(`insert into public.mm_appointment_notifications(id,appointment_id,template_key,scheduled_at) values('${queueId}','${revokeBooked.appointment_id}','LOCAL CAS FIXTURE',clock_timestamp())`);
 const claimQueue=token=>`update public.mm_appointment_notifications set status='failed',last_error='${token}' where id='${queueId}' and status='pending' returning id`;
 const queueRace=await Promise.all([tokenA,tokenB].map(token=>parallel('set role service_role;'+claimQueue(token))));
 check(queueRace.filter(r=>r.out.includes(queueId)).length===1,'conditional existing-state queue claim permits only one sender');
 sql(`update public.mm_appointment_notifications set status='suppressed',last_error='coaching_unit_revoked' where id='${queueId}' and status in ('pending','failed')`);
 for(const token of [tokenA,tokenB])check(sql(`update public.mm_appointment_notifications set status='sent' where id='${queueId}' and status='failed' and last_error='${token}' returning id`)==='','late claimed worker cannot resurrect terminal suppression');

 // Hold the real serialization lock; facts are fresh before entering its wait.
 const holder=parallel("set application_name='hybrid-expiry-holder';begin;select pg_advisory_xact_lock(20261019,511);select pg_sleep(17);commit;");
 const lockDeadline=Date.now()+3000;
 while(sql("select count(*) from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.application_name='hybrid-expiry-holder' and l.locktype='advisory' and l.classid=20261019 and l.objid=511 and l.granted")!=='1'){
  assert.ok(Date.now()<lockDeadline,'expiry fixture acquired serialization lock');await new Promise(resolve=>setTimeout(resolve,20));
 }
 const expiringRead=read(receipt([]));const expiringBooking=booking('mock',1,'2031-07-21T13:00:00Z',{order:303,sku:'single'});
 check(Date.now()/1000<expiringRead.allowance_receipt.valid_until&&Date.now()/1000<expiringBooking.allowance_receipt.valid_until,'both Woo receipts are fresh before serialized wait');
 const waitingRead=parallel(query('mm_coaching_hybrid_read_model',expiringRead));
 const waitingBooking=parallel(query('mm_coaching_hybrid_mutate_appointment',expiringBooking));
 const waitDeadline=Date.now()+3000;
 while(Number(sql("select count(*) from pg_locks where locktype='advisory' and classid=20261019 and objid=511 and not granted"))<2){
  assert.ok(Date.now()<waitDeadline,'both receipt requests actually waited for serialization');await new Promise(resolve=>setTimeout(resolve,20));
 }
 const expired=await Promise.all([waitingRead,waitingBooking]);
 check((await holder).code===0,'owned serialization holder completed');
 check(expired.every(x=>x.code!==0&&x.error.includes('woo_receipt_expired')),'read and booking reject facts that expired during actual serialization wait');
 check(sql(`select count(*) from mr_coaching.woo_receipts where request_id in ('${expiringRead.allowance_receipt.request_id}','${expiringBooking.allowance_receipt.request_id}')`)==='0'&&sql('select count(*) from mr_coaching.woo_allowances where order_id=303')==='0','expired requests roll back receipts, allowance and unit creation');
 const ownedKiB=Number(spawnSync('/usr/bin/du',['-sk',dir],{encoding:'utf8'}).stdout.trim().split(/\s+/)[0]);
 check(Number.isFinite(ownedKiB)&&ownedKiB<512*1024,'owned local PostgreSQL fixture stays below 512 MiB');
 console.log(`Owned temporary fixture: ${ownedKiB} KiB; cleanup follows.`);
 console.log(`PASS ${count} private combined refund containment real PostgreSQL assertions; exact native source composition only, runtime/transport/Woo concurrency UNVERIFIED.`);
}finally{if(started)cmd('pg_ctl',['-D',data,'-m','fast','-w','stop']);if(dir.startsWith(join(tmpdir(),'mr-c-revoke-pg-')))rmSync(dir,{recursive:true,force:true});}
