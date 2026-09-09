import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TimelineProductionAuthClient} from '../web/js/production/timeline-auth-client.js';
import {productionEntitlementAssertion} from '../web/js/production/timeline-production-runtime.js';
import {evaluateTimelineEntitlement} from '../web/js/uxr-002/entitlement.js';
import {TimelineStore} from '../web/js/uxr-002/store.js';
import {MemoryPersistenceAdapter} from '../web/js/persistence/memory-adapter.js';
import {studentAccessMessage} from '../web/js/uxr-002/student-language.js';

const source=fs.readFileSync(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');
const seam=source.match(/unsubscribeAuthClaims=productionRuntime.authClient.subscribeClaims\(\(claims\)=>\{([\s\S]*?)\n    \}\);/);
assert.ok(seam,'Use the actual production claims subscriber');
const wire=new Function('productionRuntime','evaluateTimelineEntitlement','store','runtimeMode','return productionRuntime.authClient.subscribeClaims((claims)=>{'+seam[1]+'\n});');
const origin='https://session-retry.invalid',owner='99999999-aaaa-4bbb-8ccc-000000000001';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
async function setup(t,{failures=[],defer=false}={}){
 const NativeDate=Date,nativeSet=setTimeout,nativeClear=clearTimeout;
 let now=Date.UTC(2032,0,1),sequence=0,requests=0,held=null;
 const timers=new Map(),listeners=new Map(),locks=[],authHeaders=[];
 globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
 globalThis.setTimeout=(callback,delay)=>{const timer={id:++sequence,at:now+Number(delay),callback,unref(){}};timers.set(timer.id,timer);return timer;};
 globalThis.clearTimeout=timer=>{if(timer)timers.delete(timer.id);};
 const flush=async()=>{for(let i=0;i<35;i++)await Promise.resolve();};
 const token=(overrides={})=>['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:owner,wp_user_id:42,timeline_role:'PROGRAM_ADMIN',is_wordpress_administrator:true,timeline_admin_workspace:true,iss:origin,aud:'mission-timeline',jti:'test-'+now,iat:now/1000,exp:now/1000+120,...overrides})).toString('base64url'),'synthetic'].join('.');
 const client=new TimelineProductionAuthClient({locationObject:{origin,pathname:'/timeline/',search:'',hash:''},documentObject:null,globalObject:{addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name)=>listeners.delete(name)},clock:()=>now,onAccountSwitch:reason=>locks.push(reason),fetchImpl:async(url,options={})=>{
  if(String(url).includes('admin-ajax'))return json({success:true,data:{nonce:'n0',token_endpoint:origin+'/token',api_base:origin+'/api',matrix_url:origin+'/matrix',user:{wp_user_id:42,principal_id:owner,role:'PROGRAM_ADMIN'}}});
  assert.equal(String(url),origin+'/token','No other request or real provider is allowed');requests++;authHeaders.push(options.headers['x-wp-nonce']);
  if(requests>1&&defer)await new Promise(resolve=>held=resolve);
  const failure=requests>1?failures[requests-2]:null;
  if(failure==='network')throw new TypeError('Temporary network failure');
  if(typeof failure==='number')return json({code:failure===403?'eligibility_required':'temporary_failure'},failure);
  return json({token:token(failure&&typeof failure==='object'?failure:{}),nonce:'n'+requests});
 }});
 const identity=await client.initialize(),initial=productionEntitlementAssertion(identity,0);
 const binding={principalId:owner,issuer:initial.issuer,audience:initial.audience,membershipVersion:initial.membershipVersion};
 const store=new TimelineStore({adapter:new MemoryPersistenceAdapter(),clock:()=>new Date(now)});
 store.setEntitlement(evaluateTimelineEntitlement(initial,{mode:'production',hasExistingTimeline:true,expectedBinding:binding}));
 const before=JSON.stringify(store.document);
 const unsub=wire({authClient:client,assertionForClaims:claims=>productionEntitlementAssertion({...identity,claims},0),expectedBinding:binding},evaluateTimelineEntitlement,store,'production');
 t.after(()=>{unsub();client.close();globalThis.Date=NativeDate;globalThis.setTimeout=nativeSet;globalThis.clearTimeout=nativeClear;});
 return {client,store,locks,listeners,authHeaders,requests:()=>requests,now:()=>now,unchanged:()=>JSON.stringify(store.document)===before,hasTimer:()=>timers.has(client.refreshTimer?.id),release:()=>held?.(),flush,advance:async(ms)=>{
  now+=ms;
  for(const timer of [...timers.values()].filter(timer=>timer.at<=now).sort((a,b)=>a.at-b.at)){
   if(!timers.has(timer.id))continue;timers.delete(timer.id);timer.callback();await flush();
  }
 }};
}
for(const failure of ['network',503]){
 test('idle '+failure+' failure recovers automatically and rotates nonce without changing facts',async t=>{
  const f=await setup(t,{failures:[failure]});
  await f.advance(90000);assert.equal(f.requests(),2);assert.equal(f.hasTimer(),true);
  await f.advance(5000);assert.equal(f.requests(),3);assert.equal(f.client.refreshRetryCount,0);
  assert.equal(f.store.entitlement.canMutate,true);assert.equal(f.store.entitlement.canExport,true);
  assert.equal(f.unchanged(),true);assert.deepEqual(f.authHeaders,['n0','n1','n1']);
 });
}
test('outage retries are bounded; expired authority stays disabled, online event renews',async t=>{
 const f=await setup(t,{failures:Array(7).fill(503)});
 await f.advance(90000);
 for(const delay of [5000,10000,20000,30000,30000,30000])await f.advance(delay);
 assert.equal(f.requests(),8);assert.equal(f.hasTimer(),false);
 assert.equal(f.store.entitlement.canMutate,false);assert.equal(f.store.entitlement.canExport,false);
 assert.equal(f.store.entitlement.denialCode,'SESSION_VERIFICATION_EXPIRED');
 const message=studentAccessMessage(f.store.entitlement.denialCode,{readOnly:true});
 assert.match(message,/session needs to reconnect/);assert.doesNotMatch(message,/membership|renew it|access has ended/);
 await f.advance(600000);assert.equal(f.requests(),8);
 f.listeners.get('online')();await f.flush();
 assert.equal(f.requests(),9);assert.equal(f.store.entitlement.canMutate,true);assert.equal(f.unchanged(),true);
});
for(const failure of [401,403,{sub:'99999999-aaaa-4bbb-8ccc-000000000002'},{timeline_role:'STUDENT'}]){
 test('revocation or identity change stops retry '+JSON.stringify(failure),async t=>{
  const f=await setup(t,{failures:[failure]});await f.advance(90000);
  assert.equal(f.client.locked,true);assert.equal(f.hasTimer(),false);assert.equal(f.locks.length,1);
  f.listeners.get('online')();await f.advance(120000);
  assert.equal(f.requests(),2);await assert.rejects(f.client.refreshToken(),e=>e.code==='TIMELINE_SESSION_LOCKED');
  assert.equal(f.store.entitlement.canMutate,false);
 });
}
test('suspended browser expiry blocks edits until the actual pending renewal returns',async t=>{
 const f=await setup(t,{defer:true});await f.advance(121000);
 assert.equal(f.store.entitlement.canMutate,false);assert.equal(f.store.entitlement.canExport,false);
 assert.equal(f.store.entitlement.denialCode,'SESSION_VERIFICATION_EXPIRED');
 f.release();await f.flush();assert.equal(f.store.entitlement.canMutate,true);assert.equal(f.unchanged(),true);
});
test('closing cancels retry and online listener; APIs cannot use a closed session',async t=>{
 const f=await setup(t,{failures:[503]});await f.advance(90000);f.client.close();
 assert.equal(f.hasTimer(),false);assert.equal(f.listeners.has('online'),false);assert.equal(f.client.configured,false);
 await f.advance(600000);assert.equal(f.requests(),2);
 await assert.rejects(f.client.listDocuments(),e=>e.code==='TIMELINE_SESSION_CLOSED');
});
test('a successful response arriving after close cannot publish claims or renew authority',async t=>{
 const f=await setup(t,{defer:true});await f.advance(121000);const prior=f.client.claims;
 f.client.close();f.release();await f.flush();
 assert.equal(f.client.claims,prior);assert.equal(f.hasTimer(),false);assert.equal(f.store.entitlement.canMutate,false);
});
test('concurrent retry callers share one refresh and preserve source state',async t=>{
 const f=await setup(t,{defer:true});await f.advance(90000);
 const a=f.client.refreshToken(),b=f.client.refreshToken();assert.equal(f.requests(),2);
 f.release();await Promise.all([a,b]);assert.equal(f.requests(),2);assert.equal(f.unchanged(),true);
});
test('local membership expiry retains its separate membership denial',async t=>{
 const f=await setup(t);f.store.setEntitlement({...f.store.entitlement,mode:'local'});
 await f.advance(121000);f.store.setEntitlement({...f.store.entitlement,mode:'local',expiresAt:new Date(f.now()-1).toISOString()});
 assert.equal(f.store.entitlement.denialCode,'ENTITLEMENT_EXPIRED');
});
