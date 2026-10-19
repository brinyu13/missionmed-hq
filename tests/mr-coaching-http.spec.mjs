import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHmac } from 'node:crypto';
import { handleCoachingHttp } from '../missionmed-hq/lib/scheduler/coaching-http.mjs';
let assertions = 0;
const check = (condition, label) => { assert.ok(condition, label); assertions++; };
const secret = 'test-only-coaching-capability-not-production';
const env = { MMED_COACHING_ENABLED:'1', MMED_COACHING_WOO_SECRET:secret, MMED_COACHING_FOUNDER_WP_ID:'42' };
const session = { supabaseUserId:'1f3d1d0d-1339-40c7-b54a-72013cc19da2', user:{id:42,wpUserId:42,roles:['subscriber']} };
const calls = [], nonces = new Set();
const repository = { status:()=>({mode:'supabase_rest',service_role_configured:true}),
  rpc:async (name, args) => { calls.push([name,args]);
    if(name === 'mm_coaching_claim_bridge_nonce') { const nonce=args.p_payload.nonce; if(nonces.has(nonce))return false; nonces.add(nonce);return true; }
    if(name==='mm_coaching_admit_order')return {state:'reserved',order_id:'fixture-only'};
    return {packages:[]};
  } };
async function invoke(path, {method='POST',body='{}',headers={},context={}}={}) {
  let result;
  const request=Readable.from([body]); request.method=method;request.headers={'content-type':'application/json',...headers};
  const handled=await handleCoachingHttp(request,{},new URL(path,'https://example.test'),{
    env,repository,session,validateCsrf:()=>true,sendJson:(_r,status,data,responseHeaders)=>{result={status,data,headers:responseHeaders};},...context,
  }); return {handled,...result};
}
check(!(await invoke('/api/scheduler/book')).handled,'old path untouched');
check((await invoke('/api/scheduler/coaching/service',{context:{env:{}}})).status===503,'default disabled');
check((await invoke('/api/scheduler/coaching/other')).status===404,'unknown path denied');
check((await invoke('/api/scheduler/coaching/service',{method:'GET'})).status===405,'service post only');
const body=JSON.stringify({action:'admit_order',payload:{order_id:'fixture-only'}});
const timestamp=String(Math.floor(Date.now()/1000)),nonce='test_http_nonce_000001';
const headers={'x-mmed-coaching-timestamp':timestamp,'x-mmed-coaching-nonce':nonce,
  'x-mmed-coaching-signature':createHmac('sha256',secret).update(`${timestamp}\n${nonce}\n${body}`).digest('hex')};
let result=await invoke('/api/scheduler/coaching/service',{body,headers,context:{session:null}});
check(result.status===200 && result.data.state==='reserved','signed server path needs no browser session');
check((await invoke('/api/scheduler/coaching/service',{body,headers})).status===403,'nonce replay denied');
check((await invoke('/api/scheduler/coaching/service',{body:body+' ',headers:{...headers,'x-mmed-coaching-nonce':'different_nonce_00001'}})).status===403,'body and nonce bound');
check((await invoke('/api/scheduler/coaching/service',{body:'a'.repeat(32769)})).status===413,'bounded raw body');
check((await invoke('/api/scheduler/coaching/packages',{method:'GET',context:{session:null}})).status===401,'anonymous packages denied');
check((await invoke('/api/scheduler/coaching/packages',{method:'GET',context:{session:{user:{id:42}}}})).status===403,'unconfirmed UUID denied');
result=await invoke('/api/scheduler/coaching/packages',{method:'GET'});
check(result.status===200 && result.headers['Cache-Control']==='no-store','owned packages no cache');
check((await invoke('/api/scheduler/coaching/appointments',{context:{validateCsrf:()=>false}})).status===403,'native CSRF mandatory');
await invoke('/api/scheduler/coaching/appointments',{body:JSON.stringify({action:'book',actor_type:'admin',actor_user_id:'spoof',service_credit_id:'fixture-credit'})});
const mutation=calls.findLast(([name])=>name==='mm_coaching_mutate_appointment')[1].p_payload;
check(mutation.actor_type==='student' && mutation.actor_user_id===session.supabaseUserId && mutation.actor_wp_user_id===42,'native actor replaces client spoof');
check((await invoke('/api/scheduler/coaching/availability-approval')).status===403,'subscriber not Founder');
check((await invoke('/api/scheduler/coaching/availability-approval',{context:{session:{...session,user:{...session.user,roles:['administrator'],id:43,wpUserId:43}}}})).status===403,'other admin not Founder');
check((await invoke('/api/scheduler/coaching/availability-approval',{body:JSON.stringify({service:'mock',approval_source:'forged'}),context:{session:{...session,user:{...session.user,roles:['administrator']}}}})).status===200,'exact native Founder permitted');
check((await invoke('/api/scheduler/coaching/appointments',{body:'not-json'})).status===400,'malformed body denied');
check((await invoke('/api/scheduler/coaching/packages',{method:'GET',context:{repository:{...repository,rpc:async()=>{throw new Error('private customer evidence');}}}})).data.error==='coaching_request_requires_review','private SQL detail omitted');
console.log(`PASS ${assertions} isolated HTTP/source-seam assertions; no live route or provider acceptance.`);
