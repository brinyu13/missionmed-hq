import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {handleUsceAdminOfferRoute} from '../routes/usce-offer-portal.mjs';

const keys=['MMHQ_SUPABASE_URL','MMHQ_SUPABASE_SERVICE_ROLE_KEY','POSTMARK_SERVER_TOKEN','USCE_POSTMARK_ENABLED','USCE_POSTMARK_LIVE_SEND_ENABLED','USCE_POSTMARK_DRY_RUN','USCE_POSTMARK_QA_RECIPIENT_ALLOWLIST','USCE_POSTMARK_FROM_EMAIL','POSTMARK_FROM_EMAIL','MMHQ_POSTMARK_FROM_EMAIL','USCE_POSTMARK_REPLY_TO_EMAIL','POSTMARK_REPLY_TO_EMAIL','MMHQ_POSTMARK_REPLY_TO_EMAIL'];
const alias='info+usce-qa-20261002@missionmedinstitute.com';
function fixture({onClaim,corruptPreview,defaults=false}={}){
 const previous=new Map(keys.map(k=>[k,process.env[k]])),original=globalThis.fetch;
 for(const k of keys)delete process.env[k];
 Object.assign(process.env,{MMHQ_SUPABASE_URL:'https://fglyvdykwgbuivikqoah.supabase.co',MMHQ_SUPABASE_SERVICE_ROLE_KEY:crypto.randomBytes(32).toString('hex'),POSTMARK_SERVER_TOKEN:crypto.randomBytes(32).toString('hex'),USCE_POSTMARK_ENABLED:'true',USCE_POSTMARK_LIVE_SEND_ENABLED:'true',USCE_POSTMARK_DRY_RUN:'false',USCE_POSTMARK_QA_RECIPIENT_ALLOWLIST:alias});
 if(!defaults)Object.assign(process.env,{USCE_POSTMARK_FROM_EMAIL:'synthetic-from@example.invalid',USCE_POSTMARK_REPLY_TO_EMAIL:'synthetic-reply@example.invalid'});
 const offerId=crypto.randomUUID(),claimId=crypto.randomUUID();
 const offer={id:offerId,revision:2,status:'ready',intake:{email:alias},specialty:'QA',location:'QA',timing:'QA',duration_weeks:4,format:'QA',expires_at:'2099-01-01T00:00:00Z'};
 const message={category:'offer_ready',variant:'coordinator_clear',to_email:alias,subject:'[USCE QA TEST] Synthetic sender proof',body:'[USCE QA TEST] Synthetic only. https://cdn.missionmedinstitute.com/html-system/LIVE/usce_offer.html?offer=usce_'+crypto.randomBytes(32).toString('base64url')};
 let bound,preview,providerPayload,claims=0,providers=0,finishes=0;
 globalThis.fetch=async(input,options={})=>{
  const url=String(input),body=JSON.parse(options.body||'{}');
  if(url==='https://api.postmarkapp.com/email'){providers++;providerPayload=body;return Response.json({ErrorCode:0,MessageID:crypto.randomUUID()})}
  assert.ok(url.startsWith('https://fglyvdykwgbuivikqoah.supabase.co/rest/v1/rpc/'),'Unexpected network blocked');
  const name=url.split('/').at(-1);
  if(name==='get_usce_offer_draft_admin')return Response.json({ok:true,item:offer});
  if(name==='usce_bind_message_preview'){bound=body.p_message;preview=bound.rendered_email;return Response.json({ok:true,item:offer,data:{preview_hash:bound.preview_hash,revision:2,rendered_email:preview}})}
  if(name==='usce_claim_send'){
   claims++;const frozen=structuredClone(bound);if(corruptPreview)corruptPreview(frozen);if(onClaim)onClaim();
   return Response.json({ok:true,data:{claimed:true,claim:{id:claimId,state:'claimed',mode:body.p_mode,revision:2},preview:frozen}});
  }
  if(name==='usce_finish_send'){finishes++;return Response.json({ok:true,item:offer,dry_run:body.p_state==='dry_run',data:{provider_outcome:body.p_state}})}
  throw Error('Unexpected RPC blocked');
 };
 async function route(action,body){
  const req=Readable.from([Buffer.from(JSON.stringify(body))]);req.method='POST';req.headers={};req.socket={remoteAddress:'127.0.0.1'};
  let status,reply;const res={writeHead(c){status=c},end(b){reply=JSON.parse(b)}};
  assert.equal(await handleUsceAdminOfferRoute(req,res,new URL('http://local.invalid/api/usce/admin/offers/'+offerId+'/'+action),{session:{user:{id:42,login:'synthetic-admin',roles:['administrator']}}}),true);
  return {status,reply};
 }
 return{route,message,get preview(){return preview},get bound(){return bound},get provider(){return providerPayload},get claims(){return claims},get providers(){return providers},get finishes(){return finishes},
  async reviewed(){const r=await route('message-preview',message);assert.equal(r.status,200);return{...message,revision:2,preview_hash:r.reply.data.preview_hash,idempotency_key:crypto.randomUUID(),approve_live_send:true}},
  restore(){globalThis.fetch=original;for(const[k,v]of previous){if(v===undefined)delete process.env[k];else process.env[k]=v}}
 };
}
test('review and durable preview include configured safe sender identity without token',async()=>{
 const f=fixture();try{await f.reviewed();assert.equal(f.preview.from_name,'MMI Clinical Rotations');assert.equal(f.preview.from_email,'synthetic-from@example.invalid');assert.equal(f.preview.reply_to,'synthetic-reply@example.invalid');assert.ok(!Object.hasOwn(f.preview,'token'));assert.equal(f.providers,0)}finally{f.restore()}
});
test('provider sender, reply address, subject and rendered bodies equal the approved preview',async()=>{
 const f=fixture();try{const body=await f.reviewed(),r=await f.route('send',body);assert.equal(r.status,200);assert.equal(f.providers,1);assert.equal(f.provider.From,f.preview.from_name+' <'+f.preview.from_email+'>');assert.equal(f.provider.ReplyTo,f.preview.reply_to);assert.equal(f.provider.Subject,f.preview.subject);assert.equal(f.provider.To,f.preview.to_email);assert.equal(f.provider.TextBody.replace(/usce_[A-Za-z0-9_-]{24,160}/gu,'[secure-offer-token]'),f.preview.text_body);assert.equal(f.provider.HtmlBody.replace(/usce_[A-Za-z0-9_-]{24,160}/gu,'[secure-offer-token]'),f.preview.html_body)}finally{f.restore()}
});
for(const [field,value] of [['USCE_POSTMARK_FROM_EMAIL','changed-from@example.invalid'],['USCE_POSTMARK_REPLY_TO_EMAIL','changed-reply@example.invalid']])
test(field+' drift after review rejects the old approval before claim/provider',async()=>{
 const f=fixture();try{const body=await f.reviewed();process.env[field]=value;const r=await f.route('send',body);assert.equal(r.reply.error,'stale_preview');assert.equal(f.claims,0);assert.equal(f.providers,0)}finally{f.restore()}
});
test('configuration change during claim uses frozen approved identity',async()=>{
 const f=fixture({onClaim(){process.env.USCE_POSTMARK_FROM_EMAIL='changed-after-claim@example.invalid';process.env.USCE_POSTMARK_REPLY_TO_EMAIL='changed-after-claim-reply@example.invalid'}});try{
  const r=await f.route('send',await f.reviewed());assert.equal(r.status,200);assert.equal(f.provider.From,'MMI Clinical Rotations <synthetic-from@example.invalid>');assert.equal(f.provider.ReplyTo,'synthetic-reply@example.invalid')
 }finally{f.restore()}
});
for(const field of ['from_name','from_email','reply_to'])test('mismatched durable '+field+' holds the claim without provider attempt',async()=>{
 const f=fixture({corruptPreview(p){p.rendered_email[field]='synthetic-mismatch@example.invalid'}});try{const r=await f.route('send',await f.reviewed());assert.equal(r.reply.error,'send_claim_payload_unavailable');assert.equal(f.claims,1);assert.equal(f.providers,0);assert.equal(f.finishes,0)}finally{f.restore()}
});
test('missing durable sender proof fails closed',async()=>{
 const f=fixture({corruptPreview(p){delete p.rendered_email}});try{const r=await f.route('send',await f.reviewed());assert.equal(r.reply.error,'send_claim_payload_unavailable');assert.equal(f.providers,0);assert.equal(f.finishes,0)}finally{f.restore()}
});
test('default preview identity matches default provider header',async()=>{
 const f=fixture({defaults:true});try{const r=await f.route('send',await f.reviewed());assert.equal(r.status,200);assert.equal(f.preview.from_email,'clinicals@missionmedinstitute.com');assert.equal(f.preview.reply_to,'clinicals@missionmedinstitute.com');assert.equal(f.provider.From,'MMI Clinical Rotations <clinicals@missionmedinstitute.com>');assert.equal(f.provider.ReplyTo,f.preview.reply_to)}finally{f.restore()}
});
test('client-supplied sender fields cannot override the preview or provider',async()=>{
 const f=fixture();try{const body=await f.reviewed();const r=await f.route('send',{...body,from_name:'spoofed',from_email:'spoofed@example.invalid',reply_to:'spoofed@example.invalid'});assert.equal(r.status,200);assert.equal(f.provider.From,'MMI Clinical Rotations <synthetic-from@example.invalid>');assert.equal(f.provider.ReplyTo,'synthetic-reply@example.invalid')}finally{f.restore()}
});
test('new identity binding preserves provider-free dry run',async()=>{
 const f=fixture();try{const r=await f.route('send',{...await f.reviewed(),approve_live_send:false});assert.equal(r.status,200);assert.equal(r.reply.dry_run,true);assert.equal(f.providers,0);assert.equal(f.finishes,1)}finally{f.restore()}
});
