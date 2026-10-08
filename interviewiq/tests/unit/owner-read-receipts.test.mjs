import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createOwnerReadReceipts} from '../../server/owner-read-receipts.mjs';

const OWNER='c94abcfb-dfda-4c74-9a27-f58fcf56f9b2';
const actor=()=>Object.freeze({id:OWNER,wpUserId:1397,role:'student',tier:'ivprep_complete',eligible:true});
const request=(path='/api/bootstrap',method='GET',trace=randomUUID())=>({method,url:path,headers:{'x-iiq-request-id':trace}});
const sha=x=>createHash('sha256').update(x).digest('hex');
const read=(label='fixture')=>({nonceSha256:sha('nonce '+label),requestSha256:sha('signed GET '+label),method:'GET',path:'/api/rise/v1/interviewiq/saved-programs?page=1&pageSize=100'});

test('default off and nonboolean enable retain ordinary response without receipts',async()=>{
 for(const options of [{},{enabled:false},{enabled:1}]){
  const receipts=createOwnerReadReceipts(options),a=actor(),value={version:4};
  const result=await receipts.run(a,request(),async()=>{assert.equal(receipts.activeFor(a),false);receipts.record(a,read());return value;});
  assert.equal(result,value);assert.equal(result.ownerReadReceipts,undefined);
 }
});

test('wrong actor, current role, tier, wp mapping or eligibility cannot activate scope',async()=>{
 for(const patch of [{id:randomUUID()},{wpUserId:1398},{role:'admin'},{tier:'360'},{eligible:false}]){
  const receipts=createOwnerReadReceipts({enabled:true}),a={...actor(),...patch};
  const result=await receipts.run(a,request(),async()=>{assert.equal(receipts.activeFor(a),false);receipts.record(a,read());return {ordinary:true};});
  assert.deepEqual(result,{ordinary:true});
 }
});

test('missing or invalid trace, method, route and command preserve ordinary response',async()=>{
 const cases=[request('/api/bootstrap','GET','invalid'),{method:'GET',url:'/api/bootstrap',headers:{}},request('/api/bootstrap','DELETE'),request('/api/bootstrap','POST'),request('/api/other'),request('/api/commands','GET'),request('/api/commands','POST')];
 for(const req of cases){const receipts=createOwnerReadReceipts({enabled:true}),a=actor();assert.deepEqual(await receipts.run(a,req,async()=>{assert.equal(receipts.activeFor(a),false);return {ordinary:true};}),{ordinary:true});}
 const receipts=createOwnerReadReceipts({enabled:true});assert.deepEqual(await receipts.run(actor(),request('/api/commands','POST'),async()=>({ordinary:true}),'loi.generate'),{ordinary:true});
});

test('enabled scope emits only exact safe hash receipt fields and caller binding',async()=>{
 const receipts=createOwnerReadReceipts({enabled:true}),a=actor(),req=request(),q=read();
 const result=await receipts.run(a,req,async()=>{assert.equal(receipts.activeFor(a),true);receipts.record(a,{...q,nonce:'raw-nonce-secret',signature:'signature-secret',session_verifier:'session-secret',proof:'proof-secret'});return {version:4};});
 assert.deepEqual(result,{version:4,ownerReadReceipts:{schema:'iiq-owner-read-receipts-v1',callerTrace:req.headers['x-iiq-request-id'],apiPath:'/api/bootstrap',command:null,actorId:OWNER,wpUserId:1397,requests:[{issuer:'interviewiq',...q}]}});
 assert.equal(receipts.activeFor(a),false);
 const raw=JSON.stringify(result);for(const secret of ['raw-nonce-secret','signature-secret','session-secret','proof-secret','session_verifier'])assert.equal(raw.includes(secret),false);
});

test('only explicit create/check command scopes collect their separately bounded signed GETs',async()=>{
 for(const [command,max]of [['interview.create',4],['research.check',3]]){
  const receipts=createOwnerReadReceipts({enabled:true}),a=actor();
  const result=await receipts.run(a,request('/api/commands','POST'),async()=>{for(let i=0;i<max;i++)receipts.record(a,read(command+i));assert.throws(()=>receipts.record(a,read('extra')),/owner_read_receipt_unavailable/);return {bootstrap:{version:1}};},command);
  assert.equal(result.ownerReadReceipts.apiPath,'/api/commands');assert.equal(result.ownerReadReceipts.command,command);assert.equal(result.ownerReadReceipts.requests.length,max);assert.ok(result.ownerReadReceipts.requests.every(r=>r.method==='GET'));
 }
});

test('current revalidated same actor is accepted but wrong identity or unsafe read is rejected',async()=>{
 const receipts=createOwnerReadReceipts({enabled:true}),a=actor();
 const result=await receipts.run(a,request(),async()=>{for(const [who,q]of [[{...a,id:randomUUID()},read()],[{...a,wpUserId:2},read()],[{...a,role:'admin'},read()],[{...a,tier:'360'},read()],[{...a,eligible:false},read()],[a,{...read(),nonceSha256:'raw'}],[a,{...read(),requestSha256:'raw'}],[a,{...read(),method:'POST'}],[a,{...read(),path:'/api/rise/v1/interviewiq/research-jobs'}]])assert.throws(()=>receipts.record(who,q),/owner_read_receipt_unavailable/);receipts.record({...a},read('revalidated'));assert.throws(()=>receipts.record(a,read('over GET limit')),/owner_read_receipt_unavailable/);return {};});
 assert.deepEqual(result.ownerReadReceipts.requests,[{issuer:'interviewiq',...read('revalidated')}]);
});

test('concurrent request-local scopes keep actors, traces and receipt lists separate',async()=>{
 const receipts=createOwnerReadReceipts({enabled:true}),a=actor(),b=actor(),ra=request(),rb=request('/api/programs');let release;const barrier=new Promise(resolve=>{release=resolve;});
 const first=receipts.run(a,ra,async()=>{await barrier;assert.equal(receipts.activeFor(a),true);assert.equal(receipts.activeFor(b),false);receipts.record(a,read('first'));return {response:'first'};});
 const second=receipts.run(b,rb,async()=>{assert.equal(receipts.activeFor(b),true);assert.equal(receipts.activeFor(a),false);release();await Promise.resolve();receipts.record(b,read('second'));return {response:'second'};});
 const [x,y]=await Promise.all([first,second]);assert.equal(x.ownerReadReceipts.callerTrace,ra.headers['x-iiq-request-id']);assert.equal(y.ownerReadReceipts.callerTrace,rb.headers['x-iiq-request-id']);assert.deepEqual(x.ownerReadReceipts.requests,[{issuer:'interviewiq',...read('first')}]);assert.deepEqual(y.ownerReadReceipts.requests,[{issuer:'interviewiq',...read('second')}]);assert.equal(receipts.activeFor(a),false);receipts.record(a,read('outside'));assert.equal(x.ownerReadReceipts.requests.length,1);
});

test('failed operations restore scope and cannot leak receipts into a later response',async()=>{
 const receipts=createOwnerReadReceipts({enabled:true}),a=actor();await assert.rejects(receipts.run(a,request(),async()=>{receipts.record(a,read('failed'));throw Error('offline fixture failure');}),/offline fixture failure/);assert.equal(receipts.activeFor(a),false);
 const result=await receipts.run(a,request(),async()=>{receipts.record(a,read('later'));return {};});assert.deepEqual(result.ownerReadReceipts.requests,[{issuer:'interviewiq',...read('later')}]);
});
