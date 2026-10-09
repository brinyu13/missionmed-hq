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
function fixture({provider='accept',finishFails=false,prepareFails=false,bindFails=false}={}) {
 const rawToken='usce_'+crypto.randomBytes(32).toString('base64url');
 const offer={id:offerId,revision:2,status:'ready',intake:{email:'qa@example.invalid'},specialty:'QA',location:'QA',timing:'QA',duration_weeks:4,format:'QA',expires_at:'2099-01-01T00:00:00Z'};
 let bound,claim,attempts=0,stored=[],finishCount=0,names=[],providerPayload;
 const message={category:'offer_ready',variant:'coordinator_clear',to_email:'qa@example.invalid',subject:'TEST ONLY',body:'TEST ONLY: https://cdn.missionmedinstitute.com/html-system/LIVE/usce_offer.html?offer='+rawToken};
 const original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  const payload=JSON.parse(options.body||'{}');
  if(String(url)==='https://api.postmarkapp.com/email'){
   attempts++;providerPayload=payload;names.push('provider');
   assert.equal(payload.Metadata.usce_claim_id,claimId);
   assert.ok(payload.TextBody.includes(rawToken));
   await new Promise(r=>setTimeout(r,20));
   if(provider==='ambiguous')throw Error('synthetic network interruption');
   return Response.json(provider==='reject'?{ErrorCode:300}:{ErrorCode:0,MessageID:crypto.randomUUID()},{status:provider==='reject'?422:200});
  }
  assert.ok(String(url).startsWith('https://fglyvdykwgbuivikqoah.supabase.co/rest/v1/rpc/'),'unexpected network operation');
  const name=String(url).split('/').at(-1);
  names.push(name);stored.push(payload);
  assert.ok(!JSON.stringify(payload).replace(/%([0-9a-f]{2})/giu,(_,hex)=>String.fromCharCode(parseInt(hex,16))).includes(rawToken),'bearer token entered durable RPC payload');
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
  if(name==='usce_mail_prepare_offer')return Response.json(prepareFails?{ok:false,error:'offer_claim_not_sendable'}:{ok:true,rfc_message_id:'<usce-offer-'+claimId+'@missionmedinstitute.com>'});
  if(name==='usce_mail_bind_offer')return Response.json(bindFails?{ok:false,error:'offer_history_reconciliation_required'}:{ok:true,message_id:crypto.randomUUID()});
  throw Error('unexpected RPC '+name);
 };
 return {message,offer,get names(){return names},get providerPayload(){return providerPayload},get attempts(){return attempts;},get claim(){return claim;},get finishCount(){return finishCount;},restore(){globalThis.fetch=original;}};
}
async function reviewed(f){
 const p=await route('message-preview',f.message);
 assert.equal(p.status,200);
 assert.ok(p.reply.data.rendered_email.text_body.includes('Offer revision: 2'));
 return {...f.message,preview_hash:p.reply.data.preview_hash,revision:p.reply.data.revision,idempotency_key:'synthetic-key',approve_live_send:true};
}

process.env.USCE_MAIL_OFFER_HISTORY_ENABLED='true';
process.env.USCE_POSTMARK_FROM_EMAIL='clinicals@missionmedinstitute.com';
process.env.USCE_POSTMARK_REPLY_TO_EMAIL='clinicals@missionmedinstitute.com';

test('new Offer transport durably prepares RFC identity before provider and binds canonical history after acceptance',async()=>{
 const f=fixture();try{const body=await reviewed(f),result=await route('send',body);
 assert.equal(result.status,200);assert.equal(result.reply.history_sync,'recorded');
 assert.deepEqual(f.providerPayload.Headers,[{Name:'Message-ID',Value:'<usce-offer-'+claimId+'@missionmedinstitute.com>'}]);
 assert.ok(f.names.indexOf('usce_mail_prepare_offer')<f.names.indexOf('provider'));
 assert.ok(f.names.indexOf('usce_finish_send')<f.names.indexOf('usce_mail_bind_offer'));
 assert.equal(f.attempts,1);
 }finally{f.restore();}
});
test('failed transport preparation keeps claim held and never calls provider',async()=>{
 const f=fixture({prepareFails:true});try{const body=await reviewed(f),result=await route('send',body);assert.equal(result.status,503);assert.equal(result.reply.error,'send_claim_transport_held');assert.equal(f.attempts,0);assert.equal(f.claim.state,'claimed');assert.equal(f.names.includes('usce_finish_send'),false);
 }finally{f.restore();}
});
test('history binding failure truthfully retains provider acceptance and duplicate send cannot redeliver',async()=>{
 const f=fixture({bindFails:true});try{const body=await reviewed(f),result=await route('send',body);assert.equal(result.status,200);assert.equal(result.reply.history_sync,'requires_reconciliation');assert.match(result.reply.history_message,/provider accepted/i);await route('send',body);assert.equal(f.attempts,1);
 }finally{f.restore();}
});
test('ambiguous provider outcome never binds history or blindly retries',async()=>{
 const f=fixture({provider:'ambiguous'});try{const body=await reviewed(f);await route('send',body);await route('send',body);assert.equal(f.attempts,1);assert.equal(f.names.includes('usce_mail_bind_offer'),false);assert.equal(f.claim.state,'ambiguous');
 }finally{f.restore();}
});
test('dry run does not mark live RFC transport or bind correspondence',async()=>{
 const f=fixture();try{const body=await reviewed(f);body.approve_live_send=false;await route('send',body);assert.equal(f.attempts,0);assert.equal(f.names.includes('usce_mail_prepare_offer'),false);assert.equal(f.names.includes('usce_mail_bind_offer'),false);
 }finally{f.restore();}
});
