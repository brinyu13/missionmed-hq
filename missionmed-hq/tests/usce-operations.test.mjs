import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import crypto from 'node:crypto';
import {handleUsceAdminOfferRoute} from '../routes/usce-offer-portal.mjs';

const actor={user:{id:42,login:'synthetic_local_admin',email:'synthetic-local@example.invalid',roles:['administrator']}};
function fixture(){
 const keys=['MMHQ_SUPABASE_URL','MMHQ_SUPABASE_SERVICE_ROLE_KEY'],previous=new Map(keys.map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch;
 process.env.MMHQ_SUPABASE_URL='https://fglyvdykwgbuivikqoah.supabase.co';process.env.MMHQ_SUPABASE_SERVICE_ROLE_KEY=crypto.randomBytes(32).toString('hex');
 let calls=0,last;
 globalThis.fetch=async(url,options)=>{
  assert.equal(String(url),'https://fglyvdykwgbuivikqoah.supabase.co/rest/v1/rpc/update_usce_offer_operations_state','Any unexpected/provider network request is blocked');
  calls++;last=JSON.parse(options.body);return Response.json({ok:true,item:{id:last.p_offer_id,revision:8,metadata:{last_operations_update:last.p_patch}},comms_id:crypto.randomUUID()});
 };
 async function patch(action,body,method='PATCH'){
  const req=Readable.from([Buffer.from(JSON.stringify(body))]);req.method=method;req.headers={'content-type':'application/json'};req.socket={remoteAddress:'127.0.0.1'};
  let status,reply;const res={writeHead(c){status=c},end(b){reply=JSON.parse(b)}};
  assert.equal(await handleUsceAdminOfferRoute(req,res,new URL('http://local.invalid/api/usce/admin/offers/'+crypto.randomUUID()+'/'+action),{session:actor}),true);
  return{status,reply};
 }
 return{patch,get calls(){return calls},get last(){return last},restore(){globalThis.fetch=originalFetch;for(const[k,v]of previous){if(v===undefined)delete process.env[k];else process.env[k]=v}}};
}
const evidence={evidence_source:'Synthetic controlled QA source',reason:'Synthetic QA record; no business action',expected_revision:7};
const statuses={payment:{payment_status:'manual_review'},paperwork:{paperwork_status:'requested'},learndash:{learndash_status:'ready'}};
for(const[action,status]of Object.entries(statuses))test(action+' status-only request fails before RPC',async()=>{
 const f=fixture();try{const r=await f.patch(action,status);assert.equal(r.reply.error,'operations_evidence_required');assert.equal(f.calls,0)}finally{f.restore()}
});
for(const[field,value]of[
 ['evidence_source',undefined],['reason',undefined],['evidence_source',' \t '],['reason',' \n '],
 ['evidence_source',true],['reason',42],['evidence_source',{}],['reason',[]]
])test(field+' '+String(value)+' fails required typed provenance before RPC',async()=>{
 const f=fixture();try{const r=await f.patch('payment',{...evidence,...statuses.payment,[field]:value,note:'Legacy note cannot substitute required evidence'});
  assert.equal(r.reply.error,'operations_evidence_required');assert.equal(f.calls,0)
 }finally{f.restore()}
});
for(const value of [undefined,null,'7',true,0,-1,1.5,Number.MAX_SAFE_INTEGER+1])test('invalid expected_revision '+String(value)+' fails before RPC',async()=>{
 const f=fixture();try{const r=await f.patch('paperwork',{...evidence,...statuses.paperwork,expected_revision:value});
  assert.equal(r.status,409);assert.equal(r.reply.error,'stale_revision');assert.equal(f.calls,0)
 }finally{f.restore()}
});
for(const[action,status]of Object.entries(statuses))test(action+' forwards a manual source/reason/current revision with server actor',async()=>{
 const f=fixture();try{
  const r=await f.patch(action,{...evidence,...status,evidence_kind:'provider_verified',admin_identity:{login:'client-spoof'},note:'Optional synthetic note'});
  assert.equal(r.status,200);assert.equal(f.calls,1);assert.equal(f.last.p_patch.evidence_kind,'manual_coordinator_record');
  assert.equal(f.last.p_patch.evidence_source,evidence.evidence_source);assert.equal(f.last.p_patch.reason,evidence.reason);
  assert.equal(f.last.p_patch.expected_revision,7);assert.equal(f.last.p_patch.note,'Optional synthetic note');
  assert.equal(f.last.p_admin_identity.wp_id,42);assert.equal(f.last.p_admin_identity.login,'synthetic_local_admin');
  assert.ok(r.reply.comms_id);assert.equal(r.reply.item.revision,8);
 }finally{f.restore()}
});
test('required evidence trims whitespace and optional note may be omitted',async()=>{
 const f=fixture();try{
  const r=await f.patch('payment',{...evidence,...statuses.payment,evidence_source:' '+evidence.evidence_source+' ',reason:' '+evidence.reason+' '});
  assert.equal(r.status,200);assert.equal(f.last.p_patch.evidence_source,evidence.evidence_source);assert.equal(f.last.p_patch.reason,evidence.reason);assert.equal(Object.hasOwn(f.last.p_patch,'note'),false);
 }finally{f.restore()}
});
for(const action of Object.keys(statuses))test(action+' existing status domain remains enforced',async()=>{
 const f=fixture();try{const r=await f.patch(action,{...evidence,status:'unsupported'});assert.equal(r.status,400);assert.equal(f.calls,0)}finally{f.restore()}
});
test('operations mutation still rejects wrong HTTP method',async()=>{
 const f=fixture();try{const r=await f.patch('payment',{...evidence,...statuses.payment},'POST');assert.equal(r.status,405);assert.equal(f.calls,0)}finally{f.restore()}
});
