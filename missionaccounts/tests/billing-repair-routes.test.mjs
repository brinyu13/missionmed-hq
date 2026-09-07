import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createMissionAccountsServer} from '../src/server.mjs';
import {PreviewStore,SupabaseRestStore} from '../src/storage/supabase-rest.mjs';
const uuid='10000000-0000-4000-8000-000000000001';
const config={production:false,localAuth:true,features:{billingDecisions:true}};
async function serve(cfg,store,run){const s=createMissionAccountsServer({config:cfg,store});s.listen(0,'127.0.0.1');await once(s,'listening');try{await run(`http://127.0.0.1:${s.address().port}`);}finally{s.closeAllConnections();s.close();await once(s,'close');}}
test('new billing HTTP routes enforce role/flag/bounds then carry request and actor to authoritative store',async()=>{
 const calls=[];const store=new PreviewStore();
 for(const method of ['billingBatchControls','approveBillingBatch','reverseBillingBatch','reverseBillingDecision'])store[method]=async args=>{calls.push({method,args});return {accepted:method!=='reverseBillingDecision',processed:true,approved_count:1,rejected_count:1};};
 const routes=[['/api/admin/billing-batches/controls',{cycle_key:'2026-cycle-1',student_ids:[uuid]},'billingBatchControls'],['/api/admin/billing-batches',{cycle_key:'2026-cycle-1',items:[{student_id:uuid,expected:{},expected_amount_cents:0}],reason:'Explicit group'},'approveBillingBatch'],[`/api/admin/billing-batches/${uuid}/reverse`,{reason:'Undo batch'},'reverseBillingBatch'],[`/api/admin/billing-decisions/${uuid}/reverse`,{reason:'Undo decision'},'reverseBillingDecision']];
 await serve(config,store,async base=>{
  for(const [url,body,method] of routes){
   for(const role of ['student','mentor']){
    const r=await fetch(base+url,{method:'POST',headers:{'content-type':'application/json','x-missionaccounts-local-role':role,'idempotency-key':'repair-routes-0001'},body:JSON.stringify(body)});
    assert.equal(r.status,403,method+' '+role);
   }
   assert.equal(calls.length,0);
   const r=await fetch(base+url,{method:'POST',headers:{'content-type':'application/json','x-missionaccounts-local-role':'missionaccounts_admin','idempotency-key':'repair-routes-0001'},body:JSON.stringify(body)});
   assert.equal(r.status,method==='reverseBillingDecision'?409:200);
   assert.equal(calls[0].method,method);assert.equal(calls[0].args.actorRole,'missionaccounts_admin');
   if(method!=='billingBatchControls')assert.equal(calls[0].args.requestId,'repair-routes-0001');calls.length=0;
  }
  for(const body of [{cycle_key:'2026-cycle-1',items:[],reason:'Empty group'},{cycle_key:'2026-cycle-1',items:Array(101).fill({student_id:uuid}),reason:'Oversize group'}]){
   const r=await fetch(base+'/api/admin/billing-batches',{method:'POST',headers:{'content-type':'application/json','x-missionaccounts-local-role':'founder','idempotency-key':'repair-routes-0001'},body:JSON.stringify(body)});assert.equal(r.status,400);
  }
  assert.equal(calls.length,0);
 });
 await serve({...config,features:{billingDecisions:false}},store,async base=>{const r=await fetch(base+routes[0][0],{method:'POST',headers:{'content-type':'application/json','x-missionaccounts-local-role':'missionaccounts_admin'},body:JSON.stringify(routes[0][1])});assert.equal(r.status,503);assert.equal(calls.length,0);});
});
test('new Supabase store billing methods use exact RPC names and snake case bindings',async()=>{
 const store=new SupabaseRestStore({url:'https://example.invalid',serviceKey:'local-test-fixture'});const calls=[];
 store.rpc=async(name,args)=>{calls.push({name,args});return {accepted:true};};
 const common={actorId:'wp:fixture',actorRole:'founder',requestId:'repair-store-0001',reason:'Fixture reason'};
 await store.billingBatchControls({cycleKey:'2026-cycle-1',studentIds:[uuid],actorRole:'founder'});
 await store.approveBillingBatch({...common,cycleKey:'2026-cycle-1',items:[{student_id:uuid}]});
 await store.reverseBillingBatch({...common,batchId:uuid});
 await store.reverseBillingDecision({...common,decisionId:uuid});
 assert.deepEqual(calls.map(x=>x.name),['api_billing_batch_controls','api_approve_billing_batch','api_reverse_billing_batch','api_reverse_billing_decision']);
 assert.deepEqual(calls[0].args,{p_cycle_key:'2026-cycle-1',p_student_ids:[uuid],p_actor_role:'founder'});
 for(const call of calls.slice(1)){assert.equal(call.args.p_actor_id,common.actorId);assert.equal(call.args.p_actor_role,'founder');assert.equal(call.args.p_request_id,common.requestId);assert.equal(call.args.p_reason,common.reason);}
 assert.equal(calls[2].args.p_batch_id,uuid);assert.equal(calls[3].args.p_decision_id,uuid);
});
