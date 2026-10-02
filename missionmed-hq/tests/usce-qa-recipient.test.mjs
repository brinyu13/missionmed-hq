import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {handleUsceAdminOfferRoute} from '../routes/usce-offer-portal.mjs';
import {handleUscePublicRoute} from '../routes/usce-public-intake.mjs';
import {validateUscePostmarkQaRecipient} from '../lib/usce-postmark-qa-guard.mjs';

const FLAG='USCE_POSTMARK_QA_RECIPIENT_ALLOWLIST';
const ALIAS='info+usce-qa-20261002@missionmedinstitute.com';
const KEYS=[FLAG,'MMHQ_SUPABASE_URL','MMHQ_SUPABASE_SERVICE_ROLE_KEY','POSTMARK_SERVER_TOKEN',
'USCE_POSTMARK_ENABLED','USCE_POSTMARK_LIVE_SEND_ENABLED','USCE_POSTMARK_DRY_RUN',
'MM_USCE_PUBLIC_INTAKE_ENABLED','MM_USCE_PUBLIC_INTAKE_SCHEMA_READY','MM_USCE_PUBLIC_INTAKE_WRITE_MODE',
'USCE_EMAIL_FORCE_DRY_RUN','MM_USCE_EMAIL_FORCE_DRY_RUN','NODE_ENV'];
const LABEL='[USCE QA TEST]';
const session={user:{id:42,login:'synthetic_admin',email:'synthetic-admin@example.test',roles:['administrator']}};

function fixture({policy=ALIAS,recipient=ALIAS,onClaim,forceIntakeDryRun=false}={}) {
 const old=new Map(KEYS.map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch;
 const values={
  MMHQ_SUPABASE_URL:'https://fglyvdykwgbuivikqoah.supabase.co',
  MMHQ_SUPABASE_SERVICE_ROLE_KEY:crypto.randomBytes(32).toString('hex'),
  POSTMARK_SERVER_TOKEN:crypto.randomBytes(32).toString('hex'),
  USCE_POSTMARK_ENABLED:'true',USCE_POSTMARK_LIVE_SEND_ENABLED:'true',USCE_POSTMARK_DRY_RUN:'false',
  MM_USCE_PUBLIC_INTAKE_ENABLED:'true',MM_USCE_PUBLIC_INTAKE_SCHEMA_READY:'true',
  MM_USCE_PUBLIC_INTAKE_WRITE_MODE:'supabase',USCE_EMAIL_FORCE_DRY_RUN:forceIntakeDryRun?'true':'false',
  MM_USCE_EMAIL_FORCE_DRY_RUN:'false',NODE_ENV:'production'
 };
 for(const[k,v]of Object.entries(values))process.env[k]=v;
 if(policy===null)delete process.env[FLAG];else process.env[FLAG]=policy;
 const offerId=crypto.randomUUID(),claimId=crypto.randomUUID(),rawToken='usce_'+crypto.randomBytes(32).toString('base64url');
 const offer={id:offerId,revision:2,status:'ready',intake:{email:recipient},specialty:'QA',location:'QA',timing:'QA',duration_weeks:4,format:'QA',expires_at:'2099-01-01T00:00:00Z'};
 const calls={rpc:0,claims:0,provider:0,finishes:0,intakeWrites:0};
 let bound,claim,lastProvider,lastFinish;
 const message={category:'offer_ready',variant:'coordinator_clear',to_email:recipient,subject:LABEL+' Controlled synthetic offer',
 body:LABEL+' Synthetic case. No payment, reservation, enrollment or business obligation. https://cdn.missionmedinstitute.com/html-system/LIVE/usce_offer.html?offer='+rawToken};
 globalThis.fetch=async(input,options={})=>{
  const url=new URL(String(input)),payload=JSON.parse(options.body||'{}');
  if(url.origin==='https://api.postmarkapp.com'&&url.pathname==='/email'){
   calls.provider++;lastProvider=payload;return Response.json({ErrorCode:0,MessageID:crypto.randomUUID()});
  }
  assert.equal(url.origin,'https://fglyvdykwgbuivikqoah.supabase.co','Unexpected network host blocked');
  assert.ok(url.pathname.startsWith('/rest/v1/rpc/'),'Unexpected non-RPC network operation blocked');
  calls.rpc++;
  const name=url.pathname.split('/').at(-1);
  assert.ok(!JSON.stringify(payload).includes(rawToken),'Raw offer bearer entered RPC payload');
  if(name==='get_usce_offer_draft_admin')return Response.json({ok:true,item:offer});
  if(name==='usce_bind_message_preview'){bound=payload.p_message;return Response.json({ok:true,item:offer,data:{preview_hash:bound.preview_hash,revision:2,rendered_email:bound.rendered_email}});}
  if(name==='usce_claim_send'){
   calls.claims++;
   if(claim)return Response.json({ok:true,data:{claimed:false,claim,item:offer}});
   claim={id:claimId,state:'claimed',mode:payload.p_mode,revision:2};if(onClaim)onClaim();
   return Response.json({ok:true,data:{claimed:true,claim,preview:bound}});
  }
  if(name==='usce_finish_send'){calls.finishes++;lastFinish=payload;claim={...claim,state:payload.p_state};return Response.json({ok:true,item:{...offer,status:payload.p_state==='provider_accepted'?'sent':'ready'},dry_run:payload.p_state==='dry_run',data:{claim}});}
  if(name==='create_usce_public_intake_request'){calls.intakeWrites++;return Response.json({id:crypto.randomUUID(),status:'new',was_existing:false});}
  throw Error('Unexpected RPC blocked: '+name);
 };
 async function request(handler,url,body,method='POST'){
  const req=Readable.from([Buffer.from(JSON.stringify(body))]);req.method=method;
  req.headers={'content-type':'application/json',origin:'https://missionmedinstitute.com','x-mm-usce-idempotency-key':crypto.randomUUID()};
  req.socket={remoteAddress:'192.0.2.'+(1+crypto.randomInt(240))};
  let status,reply;const res={writeHead(code){status=code},end(data){reply=JSON.parse(data)}};
  assert.equal(await handler(req,res,new URL(url),{session}),true);return{status,reply};
 }
 const api=(action,body)=>request(handleUsceAdminOfferRoute,'https://local.invalid/api/usce/admin/offers/'+offerId+'/'+action,body);
 return{message,offer,calls,api,
  async reviewed(){
   const p=await api('message-preview',message);assert.equal(p.status,200);
   return{...message,preview_hash:p.reply.data.preview_hash,revision:p.reply.data.revision,idempotency_key:crypto.randomUUID(),approve_live_send:true};
  },
  async intake(email){
   const body={student_name:LABEL+' Synthetic Intake',email,training_level_or_school:'Synthetic QA only',
    preferred_specialties:['Synthetic QA'],preferred_locations:['Synthetic QA'],preferred_months_or_dates:['Synthetic QA'],
    duration_weeks:4,source_url:'https://missionmedinstitute.com/mission-clinicals/',consent:true,notes:LABEL+' No business obligation',idempotency_key:crypto.randomUUID()};
   return request(handleUscePublicRoute,'https://local.invalid/api/usce/public/requests',body);
  },
  get lastProvider(){return lastProvider},get lastFinish(){return lastFinish},
  restore(){globalThis.fetch=originalFetch;for(const[k,v]of old){if(v===undefined)delete process.env[k];else process.env[k]=v}}
 };
}

test('approved labeled recipient reaches one durable claim and provider call',async()=>{
 const f=fixture();try{const body=await f.reviewed(),r=await f.api('send',body);
  assert.equal(r.status,200);assert.equal(f.calls.claims,1);assert.equal(f.calls.provider,1);
  assert.equal(f.lastProvider.To,ALIAS);assert.ok(f.lastProvider.Subject.startsWith(LABEL));assert.ok(f.lastProvider.TextBody.startsWith(LABEL));
 }finally{f.restore()}
});
test('approved case and whitespace normalization preserves the exact controlled inbox',async()=>{
 const f=fixture({policy:' '+ALIAS.toUpperCase()+' ',recipient:ALIAS.toUpperCase()});try{
  const r=await f.api('send',await f.reviewed());assert.equal(r.status,200);assert.equal(f.lastProvider.To,ALIAS);
 }finally{f.restore()}
});
test('blocked applicant recipient fails before any RPC, claim or provider',async()=>{
 const f=fixture({recipient:'synthetic-applicant@example.invalid'});try{
  const r=await f.api('send',{...f.message,approve_live_send:true});
  assert.equal(r.reply.error,'usce_qa_recipient_blocked');assert.deepEqual(f.calls,{rpc:0,claims:0,provider:0,finishes:0,intakeWrites:0});
 }finally{f.restore()}
});
for(const[name,recipient]of[
 ['comma list',ALIAS+',synthetic-other@example.invalid'],
 ['semicolon list',ALIAS+';synthetic-other@example.invalid'],
 ['display-name address','Synthetic <'+ALIAS+'>'],
 ['CRLF header content',ALIAS+'\r\nBcc: synthetic-other@example.invalid'],
 ['lookalike domain','info+usce-qa-20261002@missionmedinstitute.com.example.invalid'],
 ['Unicode lookalike local part','infо+usce-qa-20261002@missionmedinstitute.com']
])test('recipient '+name+' is blocked before claim/provider',async()=>{
 const f=fixture();try{const r=await f.api('send',{...f.message,to_email:recipient,approve_live_send:true});
  assert.equal(r.reply.error,'usce_qa_recipient_blocked');assert.equal(f.calls.rpc,0);assert.equal(f.calls.claims,0);assert.equal(f.calls.provider,0);
 }finally{f.restore()}
});
for(const[name,policy]of[
 ['empty',''],['whitespace',' '],['wildcard','*@missionmedinstitute.com'],
 ['other address','info@missionmedinstitute.com'],['CSV list',ALIAS+',synthetic-other@example.invalid'],
 ['duplicate CSV',ALIAS+','+ALIAS],['JSON list',JSON.stringify([ALIAS])],
 ['CRLF',ALIAS+'\r\n'],['malformed','not-an-email'],['lookalike domain',ALIAS+'.example.invalid']
])test('configured '+name+' allowlist fails closed before claim/provider',async()=>{
 const f=fixture({policy});try{const r=await f.api('send',{...f.message,approve_live_send:true});
  assert.equal(r.reply.error,'usce_qa_recipient_policy_invalid');assert.equal(f.calls.rpc,0);assert.equal(f.calls.claims,0);assert.equal(f.calls.provider,0);
 }finally{f.restore()}
});
test('spoofed approved recipient cannot send an offer belonging to another email',async()=>{
 const f=fixture({recipient:'synthetic-applicant@example.invalid'});try{
  const r=await f.api('send',{...f.message,to_email:ALIAS,approve_live_send:true});
  assert.equal(r.reply.error,'recipient_mismatch');assert.equal(f.calls.claims,0);assert.equal(f.calls.provider,0);
 }finally{f.restore()}
});
for(const[field,value]of[['subject','Unlabeled subject'],['body','Unlabeled body']])
test('QA '+field+' requires the explicit label before claim/provider',async()=>{
 const f=fixture();try{const r=await f.api('send',{...f.message,[field]:value,approve_live_send:true});
  assert.equal(r.reply.error,'usce_qa_label_required');assert.equal(f.calls.rpc,0);assert.equal(f.calls.claims,0);assert.equal(f.calls.provider,0);
 }finally{f.restore()}
});
test('request-provided allowlist cannot bypass configured recipient restriction',async()=>{
 const f=fixture({recipient:'synthetic-applicant@example.invalid'});try{
  const r=await f.api('send',{...f.message,approve_live_send:true,qa_recipient_allowlist:f.message.to_email});
  assert.equal(r.reply.error,'usce_qa_recipient_blocked');assert.equal(f.calls.claims,0);assert.equal(f.calls.provider,0);
 }finally{f.restore()}
});
test('policy is rechecked at provider boundary after a durable claim',async()=>{
 const f=fixture({onClaim(){process.env[FLAG]='';}});try{
  const r=await f.api('send',await f.reviewed());assert.equal(r.reply.error,'usce_qa_recipient_policy_invalid');
  assert.equal(f.calls.claims,1);assert.equal(f.calls.provider,0);assert.equal(f.lastFinish.p_state,'failed');
 }finally{f.restore()}
});
test('dry run remains provider-free for an unapproved synthetic recipient',async()=>{
 const f=fixture({recipient:'synthetic-applicant@example.invalid'});try{
  const r=await f.api('send',{...await f.reviewed(),approve_live_send:false});
  assert.equal(r.status,200);assert.equal(r.reply.dry_run,true);assert.equal(f.calls.claims,1);assert.equal(f.calls.provider,0);
 }finally{f.restore()}
});
test('intentional variable deletion restores unchanged ordinary live-send behavior',async()=>{
 const f=fixture({policy:null,recipient:'synthetic-applicant@example.invalid'});try{
  f.message.subject='Ordinary synthetic message';f.message.body=f.message.body.replace(LABEL,'Ordinary synthetic fixture');
  const r=await f.api('send',await f.reviewed());assert.equal(r.status,200);assert.equal(f.calls.provider,1);
 }finally{f.restore()}
});
test('absent policy does not alter legacy recipient or label validation contract',()=>{
 const f=fixture({policy:null});try{assert.deepEqual(validateUscePostmarkQaRecipient({}),{ok:true,qa_only:false})}finally{f.restore()}
});
test('public intake cannot send admin or unlabeled acknowledgement emails during QA',async()=>{
 const f=fixture();try{const r=await f.intake(ALIAS);assert.equal(r.status,202);assert.equal(f.calls.intakeWrites,1);
  assert.equal(f.calls.provider,0);assert.equal(r.reply.notification_status,'partial_or_failed');
 }finally{f.restore()}
});
test('invalid QA configuration blocks every intake provider attempt',async()=>{
 const f=fixture({policy:''});try{const r=await f.intake('synthetic-'+crypto.randomUUID()+'@example.invalid');
  assert.equal(r.status,202);assert.equal(f.calls.provider,0);assert.equal(r.reply.notification_status,'partial_or_failed');
 }finally{f.restore()}
});
test('public intake force-dry-run remains an independent outbound fence',async()=>{
 const f=fixture({forceIntakeDryRun:true});try{const r=await f.intake('synthetic-'+crypto.randomUUID()+'@example.invalid');
  assert.equal(r.status,202);assert.equal(f.calls.provider,0);assert.equal(r.reply.notification_dry_run,true);
 }finally{f.restore()}
});
test('intentional variable deletion preserves ordinary public-intake notification behavior',async()=>{
 const f=fixture({policy:null});try{const r=await f.intake('synthetic-'+crypto.randomUUID()+'@example.invalid');
  assert.equal(r.status,202);assert.equal(f.calls.provider,4);assert.equal(r.reply.notification_status,'sent');
 }finally{f.restore()}
});
