import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const runtime=readFileSync(new URL('../../public/source/runtime.js',import.meta.url),'utf8');
const functions=runtime.slice(runtime.indexOf('function sameOriginURL('),runtime.indexOf('let loiAuthorityEpoch='));
function fixture(remaining){
 const pending=[],now=1800000000000,context=vm.createContext({URL,Headers,Error,Number,Promise,Date:class extends Date{static now(){return now;}},fetch:(url,options)=>new Promise((resolve,reject)=>pending.push({url:String(url),options,resolve,reject}))});
 vm.runInContext(`let session={token:'synthetic-old',nonce:'synthetic-nonce',apiBase:'/interviewiq/api',expiresAt:${now+remaining}},sessionRefresh=null,sessionEpoch=1,actor={id:'synthetic'},locked=false;const location={origin:'https://example.test'},studentPreview=()=>false,coreOnly=()=>false,lockWorkspace=()=>{locked=true;sessionEpoch++;};`+functions,context);
 const respond=(i,body,status=200)=>pending[i].resolve({ok:status<400,status,json:async()=>body});
 const tick=()=>new Promise(r=>setImmediate(r));
 async function refresh(){respond(0,{nonce:'synthetic-new-nonce',token_endpoint:'/signed',api_base:'/interviewiq/api'});await tick();respond(1,{token:'synthetic-new',expires_at:(now+60000)/1000,actor:{id:'synthetic'}});await tick();}
 return{pending,run:s=>vm.runInContext(s,context),respond,tick,refresh};
}
for(const path of ['/commands','/calendar/cohort?start=2026-10-01&end=2026-11-01'])test(`refreshes before slow ${path} at less than fifteen seconds remaining`,async()=>{
 const f=fixture(14999),p=f.run(`apiFetch(${JSON.stringify(path)})`);assert.match(f.pending[0].url,/admin-ajax/);await f.refresh();assert.equal(f.pending.length,3);assert.equal(f.pending[2].options.headers.get('Authorization'),'Bearer synthetic-new');f.respond(2,{ok:true});assert.equal((await p).ok,true);
});
test('exact fifteen seconds and fresh tokens avoid unnecessary renewal',async()=>{for(const remaining of [15000,60000]){const f=fixture(remaining),p=f.run("apiFetch('/bootstrap')");assert.equal(f.pending.length,1);assert.equal(f.pending[0].url,'/interviewiq/api/bootstrap');f.respond(0,{ok:true});await p;}});
test('parallel reads share one fresh handshake',async()=>{const f=fixture(5000),a=f.run("apiFetch('/bootstrap')"),b=f.run("apiFetch('/calendar/cohort')");assert.equal(f.pending.length,1);await f.refresh();assert.equal(f.pending.length,4);f.respond(2,{ok:true});f.respond(3,{ok:true});await Promise.all([a,b]);});
test('account or session change during refresh prevents the protected request',async()=>{for(const mutation of ["actor={id:'another'}","sessionEpoch++"]){const f=fixture(0),p=f.run("apiFetch('/commands')");const rejected=assert.rejects(p,/workspace changed/);f.respond(0,{nonce:'synthetic',token_endpoint:'/signed'});await f.tick();f.run(mutation);f.respond(1,{token:'synthetic-new',expires_at:1800000060,actor:{id:'synthetic'}});await rejected;assert.equal(f.pending.length,2);}});
test('refresh failure denies access and upstream503 is never automatically retried',async()=>{
 const f=fixture(0),p=f.run("apiFetch('/commands')"),rejected=assert.rejects(p);f.respond(0,{error:{message:'denied'}},403);await rejected;assert.equal(f.run('locked'),true);assert.equal(f.pending.length,1);
 const g=fixture(60000),q=g.run("apiFetch('/commands')"),failure=assert.rejects(q,e=>e.status===503);g.respond(0,{error:{code:'owner_service_unavailable',message:'unavailable'}},503);await failure;assert.equal(g.pending.length,1);
});
