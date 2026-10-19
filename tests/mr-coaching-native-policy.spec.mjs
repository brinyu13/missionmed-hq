import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createCoachingService, verifyCoachingEnvelope, COACHING_RPC } from '../missionmed-hq/lib/scheduler/coaching.mjs';

// Entirely synthetic key; never an environment/provider secret.
const secret = 'local-nonfinancial-test-key-32-bytes-only';
const now = 1800000000000; const timestamp = String(now/1000); const nonce='synthetic_nonce_0000001';
function envelope(action='admit_order',payload={}) {
 const rawBody=JSON.stringify({action,payload});
 return {rawBody,timestamp,nonce,now,signature:createHmac('sha256',secret).update(`${timestamp}\n${nonce}\n${rawBody}`).digest('hex')};
}
let count=0;
function check(value,label) { count++; assert.ok(value,label); }
function bad(value,pattern=/coaching_/) { count++; assert.throws(()=>verifyCoachingEnvelope({...envelope(),secret,...value}),pattern); }
check(verifyCoachingEnvelope({...envelope(),secret}).action==='admit_order','HMAC raw envelope accepted');
for(const change of [{rawBody:'{}'},{timestamp:String(now/1000-301)},{timestamp:String(now/1000+301)},{nonce:'short'},
 {signature:'0'.repeat(64)},{signature:'bad'},{secret:'short'},{rawBody:JSON.stringify({action:'read_model',payload:{}})},
 {rawBody:'x'.repeat(32769)}]) bad(change);
// Exact +/-300 second boundary is admitted if its signature is valid.
for(const offset of [-300,300]) {
 const e=envelope(); e.timestamp=String(now/1000+offset);
 e.signature=createHmac('sha256',secret).update(`${e.timestamp}\n${nonce}\n${e.rawBody}`).digest('hex');
 check(verifyCoachingEnvelope({...e,secret}).timestamp===Number(e.timestamp),'timestamp boundary');
}
let calls=[];const rpcClient=async(name,payload)=>{calls.push({name,payload});return {ok:true};};
count++;await assert.rejects(createCoachingService({rpcClient}).canonicalWooEnvelope(envelope()),/coaching_disabled/);
count++;await assert.rejects(createCoachingService({enabled:true,rpcClient,secret}).canonicalWooEnvelope(envelope()),/nonce_replayed/);
calls=[];
const claimed=new Set(); // Unit double only: production MUST supply persisted unique nonce claim.
const service=createCoachingService({enabled:true,rpcClient,secret,claimNonce:async({nonce:n})=>{if(claimed.has(n))return false;claimed.add(n);return true;},
 resolveNativeActor:async(session)=>session==='real-native-session'?{userId:'canonical-uuid',wpUserId:22}:null,
 verifyFounderActor:async(session)=>session==='founder-session'?{userId:'founder-uuid',isFounder:true}:null});
await service.canonicalWooEnvelope(envelope());
check(calls[0].name===COACHING_RPC.admit_order,'only exact RPCmapping used');
count++;await assert.rejects(service.canonicalWooEnvelope(envelope()),/nonce_replayed/);
await service.mutateAppointment('real-native-session',{action:'book',actor_type:'admin',actorUserId:'forged',actor_user_id:'forged',student_user_id:'victim',service_credit_id:'credit',start_at:'fixture'});
check(calls.at(-1).payload.p_payload.actor_user_id==='canonical-uuid','actor comes from trusted native resolver');
check(!Object.hasOwn(calls.at(-1).payload.p_payload,'actorUserId')&&!Object.hasOwn(calls.at(-1).payload.p_payload,'student_user_id'),'browser role/identity aliases stripped');
check(calls.at(-1).payload.p_payload.actor_type==='student','no role escalation');
count++;await assert.rejects(service.readModel('browser'),/exact_native_actor/);
count++;await assert.rejects(service.approveAvailability('browser',{}),/founder_required/);
await service.approveAvailability('founder-session',{service:'mock',founder_actor_id:'attacker',approval_source:'browser',approval_evidence_id:'fixture'});
check(calls.at(-1).payload.p_payload.founder_actor_id==='founder-uuid','Founder identity bound server-side');
check(calls.at(-1).payload.p_payload.approval_source==='authenticated_founder','approval source not client controlled');
check(service.status().native_composition_acceptance==='UNVERIFIED','no native acceptance overclaim');
check(service.status().emergency==='REQUEST_FIRST_ONLY_NO_NATIVE_PURCHASE_RESERVATION','Emergency remains fail closed');
const terminalService=createCoachingService({enabled:true,secret,rpcClient,claimNonce:async()=>true});
count++;await assert.rejects(terminalService.canonicalWooEnvelope(envelope('release_unpaid_order',{source:'canonical_woo_verified',event_type:'terminal_unpaid',is_paid:false,provider_status:'requires_payment_method'})),/terminal_unpaid_required/);
await terminalService.canonicalWooEnvelope(envelope('release_unpaid_order',{source:'canonical_woo_verified',event_type:'terminal_unpaid',is_paid:false,
 gateway:'stripe',provider_status:'canceled',financial_outcome:'verified_terminal_unpaid',gateway_funds_received:false,provider_evidence_id:'synthetic-terminal-intent'}));
check(calls.at(-1).name===COACHING_RPC.release_unpaid_order,'only bounded canceled-unpaid action maps to release RPC');
const persistedCalls=[];
const defaultNonce=createCoachingService({enabled:true,secret,rpcClient:async(name,payload)=>{persistedCalls.push({name,payload});return name===COACHING_RPC.claim_bridge_nonce?true:{ok:true};}});
await defaultNonce.canonicalWooEnvelope(envelope());
check(persistedCalls[0].name===COACHING_RPC.claim_bridge_nonce && persistedCalls[1].name===COACHING_RPC.admit_order,'default bridge claims native durable nonce before action');
console.log(`PASS ${count} deterministic service-envelope/actor-policy assertions; no providers.`);
