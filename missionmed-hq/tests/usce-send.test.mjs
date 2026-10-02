import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {handleUsceAdminOfferRoute} from '../routes/usce-offer-portal.mjs';

// Every network operation is intercepted. These tests cannot contact a provider.
process.env.MMHQ_SUPABASE_URL='https://fglyvdykwgbuivikqoah.supabase.co';
process.env.MMHQ_SUPABASE_SERVICE_ROLE_KEY='synthetic-local-test';
process.env.POSTMARK_SERVER_TOKEN='synthetic-local-test';
process.env.USCE_POSTMARK_ENABLED='true';
process.env.USCE_POSTMARK_LIVE_SEND_ENABLED='true';
const offerId=crypto.randomUUID(),claimId=crypto.randomUUID();
const session={user:{id:1,login:'synthetic_admin',email:'admin@example.invalid',roles:['administrator']}};
async function route(action,body={},method='POST') {
 const req=Readable.from([Buffer.from(JSON.stringify(body))]);
 req.method=method;req.headers={};req.socket={remoteAddress:'127.0.0.1'};
 let status,reply;
 const res={writeHead(code){status=code;},end(value){reply=JSON.parse(value);}};
 assert.equal(await handleUsceAdminOfferRoute(req,res,new URL('http://local/api/usce/admin/offers/'+offerId+'/'+action),{session}),true);
 return {status,reply};
}
function fixture({provider='accept',finishFails=false}={}) {
 const rawToken='usce_'+crypto.randomBytes(32).toString('base64url');
 const offer={id:offerId,revision:2,status:'ready',intake:{email:'qa@example.invalid'},specialty:'QA',location:'QA',timing:'QA',duration_weeks:4,format:'QA',expires_at:'2099-01-01T00:00:00Z'};
 let bound,claim,attempts=0,stored=[],finishCount=0;
 const message={category:'offer_ready',variant:'coordinator_clear',to_email:'qa@example.invalid',subject:'TEST ONLY',body:'TEST ONLY: https://cdn.missionmedinstitute.com/html-system/LIVE/usce_offer.html?offer='+rawToken};
 const original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  const payload=JSON.parse(options.body||'{}');
  if(String(url)==='https://api.postmarkapp.com/email'){
   attempts++;
   assert.equal(payload.Metadata.usce_claim_id,claimId);
   assert.ok(payload.TextBody.includes(rawToken));
   await new Promise(r=>setTimeout(r,20));
   if(provider==='ambiguous')throw Error('synthetic network interruption');
   return Response.json(provider==='reject'?{ErrorCode:300}:{ErrorCode:0,MessageID:crypto.randomUUID()},{status:provider==='reject'?422:200});
  }
  assert.ok(String(url).startsWith('https://fglyvdykwgbuivikqoah.supabase.co/rest/v1/rpc/'),'unexpected network operation');
  const name=String(url).split('/').at(-1);
  stored.push(payload);
  assert.ok(!decodeURIComponent(JSON.stringify(payload)).includes(rawToken),'bearer token entered durable RPC payload');
  if(name==='get_usce_offer_draft_admin')return Response.json({ok:true,item:offer});
  if(name==='usce_bind_message_preview'){
   bound=payload.p_message;
   return Response.json({ok:true,item:offer,data:{preview_hash:bound.preview_hash,revision:bound.revision,rendered_email:bound.rendered_email}});
  }
  if(name==='usce_claim_send'){
   if(claim)return Response.json({ok:true,data:{claimed:false,claim,item:offer}});
   claim={id:claimId,state:'claimed',mode:payload.p_mode,revision:offer.revision};
   return Response.json({ok:true,data:{claimed:true,claim,preview:bound}});
  }
  if(name==='usce_finish_send'){
   finishCount++;
   if(finishFails)throw Error('synthetic DB timeout');
   claim={...claim,state:payload.p_state};
   return Response.json({ok:true,item:{...offer,status:payload.p_state==='provider_accepted'?'sent':'ready'},dry_run:payload.p_state==='dry_run',data:{claim,provider_outcome:payload.p_state}});
  }
  throw Error('unexpected RPC '+name);
 };
 return {message,offer,get attempts(){return attempts;},get claim(){return claim;},get finishCount(){return finishCount;},restore(){globalThis.fetch=original;}};
}
async function reviewed(f){
 const p=await route('message-preview',f.message);
 assert.equal(p.status,200);
 assert.ok(p.reply.data.rendered_email.text_body.includes('Offer revision: 2'));
 return {...f.message,preview_hash:p.reply.data.preview_hash,revision:p.reply.data.revision,idempotency_key:'synthetic-key',approve_live_send:true};
}
test('review binds full rendering and redacts durable bearer tokens',async()=>{
 const f=fixture();try{await reviewed(f);assert.equal(f.attempts,0);}finally{f.restore();}
});
test('bearer token in subject is rejected before storage',async()=>{
 const f=fixture();try{
  const result=await route('message-preview',{...f.message,subject:f.message.body});
  assert.equal(result.reply.error,'invalid_message_subject');
  assert.equal(f.attempts,0);
 }finally{f.restore();}
});
test('percent-encoded bearer prefix is redacted from every stored rendering',async()=>{
 const f=fixture();try{
  f.message.body=f.message.body.replace('?offer=usce_','?offer=%75sce_');
  const result=await route('message-preview',f.message);
  assert.equal(result.status,200);
  assert.ok(result.reply.data.rendered_email.text_body.includes('%75sce_'));
 }finally{f.restore();}
});
test('changed subject or recipient cannot reuse approval',async()=>{
 const f=fixture();try{
  const body=await reviewed(f);
  assert.equal((await route('send',{...body,subject:'changed'})).status,409);
  assert.equal((await route('send',{...body,to_email:'wrong@example.invalid'})).reply.error,'recipient_mismatch');
  assert.equal(f.attempts,0);
 }finally{f.restore();}
});
test('concurrent duplicate send contacts provider exactly once',async()=>{
 const f=fixture();try{
  const body=await reviewed(f);
  const out=await Promise.all([route('send',body),route('send',body),route('send',body)]);
  assert.equal(f.attempts,1);
  assert.equal(out.filter(x=>x.status===200).length,1);
  assert.equal((await route('send',body)).reply.idempotent,true);
  assert.equal(f.attempts,1);
 }finally{f.restore();}
});
test('ambiguous provider outcome never retries blindly',async()=>{
 const f=fixture({provider:'ambiguous'});try{
  const body=await reviewed(f);
  assert.equal((await route('send',body)).reply.error,'postmark_outcome_unknown');
  assert.equal(f.claim.state,'ambiguous');
  assert.equal((await route('send',body)).reply.error,'send_requires_reconciliation');
  assert.equal(f.attempts,1);
 }finally{f.restore();}
});
test('provider acceptance followed by failed readback remains durably held',async()=>{
 const f=fixture({finishFails:true});try{
  const body=await reviewed(f);
  assert.equal((await route('send',body)).reply.error,'send_requires_reconciliation');
  assert.equal(f.claim.state,'claimed');
  await route('send',body);
  assert.equal(f.attempts,1);
 }finally{f.restore();}
});
test('dry run uses no provider and returns ready business stage',async()=>{
 const f=fixture();try{
  const body=await reviewed(f);
  const result=await route('send',{...body,approve_live_send:false});
  assert.equal(result.reply.dry_run,true);
  assert.equal(result.reply.item.status,'ready');
  assert.equal(f.attempts,0);
 }finally{f.restore();}
});
test('revision changed after preview requires renewed review',async()=>{
 const f=fixture();try{
  const body=await reviewed(f);f.offer.revision++;
  assert.equal((await route('send',body)).reply.error,'stale_preview');
  assert.equal(f.attempts,0);
 }finally{f.restore();}
});
