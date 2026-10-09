import crypto from 'node:crypto';
import {validateUscePostmarkQaRecipient} from './usce-postmark-qa-guard.mjs';

export const CLINICALS_MAILBOX='clinicals@missionmedinstitute.com';
export const PHIL_NOTIFICATION='philaperri@gmail.com';
const PROJECT='fglyvdykwgbuivikqoah';
const pick=(env,keys)=>keys.map(k=>env[k]).find(v=>typeof v==='string'&&v.trim())?.trim()||'';
export const sha256=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const email=value=>typeof value==='string'&&value.length<=254&&/^[^\s<>;,\r\n]+@[^\s<>;,\r\n]+\.[^\s<>;,\r\n]+$/.test(value)?value.toLowerCase():null;
export function makeMailRpc({env=process.env,fetchImpl=fetch}={}){
 const raw=pick(env,['MMHQ_SUPABASE_URL','SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL']);
 const key=pick(env,['MMHQ_SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SERVICE_ROLE_KEY','MMHQ_SUPABASE_KEY']);
 let origin;try{const u=new URL(raw);if(u.protocol==='https:'&&u.hostname===PROJECT+'.supabase.co'&&!u.username&&!u.password)origin=u.origin;}catch{}
 return async(name,body)=>{
  if(!origin||!key)return {ok:false,error:'mail_storage_not_configured'};
  if(!/^usce_mail_(sync|ingest|read|edit|claim_send|dispatch)$/.test(name))return {ok:false,error:'invalid_rpc'};
  try{const r=await fetchImpl(origin+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});
   const j=await r.json();return r.ok&&j&&typeof j==='object'?j:{ok:false,error:'mail_storage_unavailable'};
  }catch{return {ok:false,error:'mail_storage_unavailable'};}
 };
}
export function getMailSender(env=process.env){
 const from=pick(env,['USCE_POSTMARK_FROM_EMAIL','POSTMARK_FROM_EMAIL','MMHQ_POSTMARK_FROM_EMAIL'])||CLINICALS_MAILBOX;
 const reply=pick(env,['USCE_POSTMARK_REPLY_TO_EMAIL','POSTMARK_REPLY_TO_EMAIL','MMHQ_POSTMARK_REPLY_TO_EMAIL'])||CLINICALS_MAILBOX;
 const token=pick(env,['POSTMARK_SERVER_TOKEN','USCE_POSTMARK_SERVER_TOKEN','MMHQ_POSTMARK_SERVER_TOKEN']);
 const enabled=pick(env,['USCE_POSTMARK_ENABLED','MM_USCE_POSTMARK_ENABLED']);
 const live=pick(env,['USCE_POSTMARK_LIVE_SEND_ENABLED','MM_USCE_POSTMARK_LIVE_SEND_ENABLED']);
 const dry=pick(env,['USCE_POSTMARK_DRY_RUN','MM_USCE_POSTMARK_DRY_RUN']);
 return {ok:from===CLINICALS_MAILBOX&&reply===CLINICALS_MAILBOX&&!!token&&enabled!=='false'&&live==='true'&&dry==='false',from_email:from,reply_to:reply,token};
}
export function previewMessage(item,sender=getMailSender()){
 if(!sender.ok)return {ok:false,error:'clinicals_sender_not_ready'};
 if(!item||item.state!=='draft'||!UUID.test(item.id)||!email(item.to_email))return {ok:false,error:'draft_required'};
 if(!item.subject?.trim()||!item.body_text?.trim())return {ok:false,error:'message_required'};
 if(/[\r\n]/.test(item.subject)||item.subject.length>240||item.body_text.length>20000)return {ok:false,error:'invalid_message'};
 // Offer links belong to the existing approval/revision-bound Offer path.
 if(/usce_offer\.html|[?&]offer=|#(?:access_token|auth_handoff)=/i.test(item.body_text+' '+item.subject))return {ok:false,error:'use_offer_journey'};
 const data={message_id:item.id,revision:item.revision,to_email:item.to_email,from_email:CLINICALS_MAILBOX,reply_to:CLINICALS_MAILBOX,subject:item.subject,body_text:item.body_text,in_reply_to:item.in_reply_to||null,references:(item.references_ids||[]).filter(Boolean).join(' ')};
 return {ok:true,preview:{...data,preview_hash:sha256(JSON.stringify(data))}};
}
export function notificationMessage(dispatch){
 const p=dispatch.payload||{};
 if(!UUID.test(String(p.message_id||'')))throw new Error('invalid_notification_identity');
 const name=typeof p.student_name==='string'?p.student_name.replace(/[\r\n]/g,' ').slice(0,150):'';
 const when=new Date(p.received_at);if(Number.isNaN(when.getTime()))throw new Error('invalid_notification_time');
 const subject='New USCE student reply'+(name?' — '+name:'');
 const body='A new message has arrived in the MissionMed USCE Offer system.\n'+(name?'Student: '+name+'\n':'Student: Needs review\n')+'Received: '+when.toISOString()+'\n\nOpen the secure conversation:\nhttps://missionmedinstitute.com/usce-admin/?conversation='+p.message_id+'\n\nOpen Gmail for Clinicals:\nhttps://mail.google.com/mail/u/?authuser='+encodeURIComponent(CLINICALS_MAILBOX)+'\n\nSign in with your authorized MissionMed account to read the message.';
 return {to_email:PHIL_NOTIFICATION,from_email:CLINICALS_MAILBOX,reply_to:CLINICALS_MAILBOX,subject,body_text:body,rfc_message_id:'<usce-notify-'+dispatch.id+'@missionmedinstitute.com>',text_sha256:sha256(body)};
}
export async function submitMail(payload,dispatchId,{env=process.env,fetchImpl=fetch,notification=false}={}){
 const sender=getMailSender(env);
 if(!sender.ok)return {outcome:'failed',error:'clinicals_sender_not_ready',attempted:false,proven_unsent:true};
 if(payload.from_email!==CLINICALS_MAILBOX||payload.reply_to!==CLINICALS_MAILBOX||!email(payload.to_email)||!UUID.test(dispatchId))return {outcome:'failed',error:'invalid_message',attempted:false,proven_unsent:true};
 if(notification&&payload.to_email!==PHIL_NOTIFICATION)return {outcome:'failed',error:'notification_recipient_mismatch',attempted:false,proven_unsent:true};
 // Reuse the existing recipient guard. A globally configured QA restriction cannot be bypassed for notifications.
 const guard=validateUscePostmarkQaRecipient({toEmail:payload.to_email,subject:payload.subject,body:payload.body_text});
 if(!guard.ok)return {outcome:'failed',error:guard.error,attempted:false,proven_unsent:true};
 const rfc=payload.rfc_message_id;
 if(typeof rfc!=='string'||!/^<usce-(?:mail|notify)-[0-9a-f-]+@missionmedinstitute\.com>$/.test(rfc))return {outcome:'failed',error:'invalid_message_identity',attempted:false,proven_unsent:true};
 const headers=[{Name:'Message-ID',Value:rfc}];
 for(const [name,value] of [['In-Reply-To',payload.in_reply_to],['References',payload.references]]){
  if(value){if(typeof value!=='string'||/[\r\n]/.test(value)||value.length>4000)return {outcome:'failed',error:'invalid_reply_headers',attempted:false,proven_unsent:true};headers.push({Name:name,Value:value});}
 }
 try{
  const r=await fetchImpl('https://api.postmarkapp.com/email',{method:'POST',headers:{'X-Postmark-Server-Token':sender.token,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({From:'MissionMed Clinicals <'+CLINICALS_MAILBOX+'>',To:payload.to_email,ReplyTo:CLINICALS_MAILBOX,Subject:payload.subject,TextBody:payload.body_text,MessageStream:'outbound',Tag:notification?'usce-reply-notification':'usce-correspondence',Headers:headers,Metadata:{usce_dispatch_id:dispatchId,usce_message_id:payload.message_id||''}}),redirect:'error',signal:AbortSignal.timeout(12000)});
  let data;try{data=await r.json();}catch{return {outcome:'ambiguous',error:'provider_response_unreadable',attempted:true};}
  if(r.ok&&data.ErrorCode===0&&UUID.test(data.MessageID))return {outcome:'provider_accepted',provider_message_id:data.MessageID,attempted:true};
  const rejected=r.status>=400&&r.status<500&&r.status!==408&&Number.isInteger(data.ErrorCode)&&data.ErrorCode>0;
  return {outcome:rejected?'failed':'ambiguous',error:rejected?'provider_rejected':'provider_outcome_unknown',attempted:true,http_status:r.status,proven_unsent:rejected};
 }catch{return {outcome:'ambiguous',error:'provider_outcome_unknown',attempted:true};}
}
export async function dispatchClaim(claim,{rpc=makeMailRpc(),...options}={}){
 if(!claim?.claimed||!claim.dispatch?.id)return claim;
 const d=claim.dispatch;
 const result=await submitMail(d.payload,d.id,{...options,notification:d.action==='usce_v3_notify'});
 const recorded=await rpc('usce_mail_dispatch',{p_action:'finish',p_id:d.id,p_attempt_id:d.attempt_id,p_data:result});
 if(!recorded.ok)return {ok:false,error:'send_requires_reconciliation',dispatch_id:d.id};
 return {ok:result.outcome==='provider_accepted',...result,dispatch_id:d.id};
}
export async function sendDraft({id,revision,preview_hash,idempotency_key},{rpc=makeMailRpc(),env=process.env,...options}={}){
 const current=await rpc('usce_mail_read',{p_action:'message',p_params:{id}});if(!current.ok)return current;
 const proof=previewMessage(current.item,getMailSender(env));if(!proof.ok)return proof;
 if(proof.preview.preview_hash!==preview_hash||proof.preview.revision!==revision)return {ok:false,error:'stale_preview'};
 const payload={...proof.preview,rfc_message_id:'<usce-mail-'+id+'@missionmedinstitute.com>',text_sha256:sha256(proof.preview.body_text)};
 const claim=await rpc('usce_mail_claim_send',{p_message_id:id,p_revision:revision,p_payload:payload,p_idempotency_key:idempotency_key});
 if(!claim.ok)return claim;
 if(!claim.claimed)return {ok:claim.dispatch?.state==='provider_accepted',idempotent:true,outcome:claim.dispatch?.state||'unknown',dispatch_id:claim.dispatch?.id,error:claim.dispatch?.state==='provider_accepted'?undefined:'send_requires_reconciliation'};
 return dispatchClaim(claim,{rpc,env,...options});
}
export async function dispatchNextNotification({rpc=makeMailRpc(),env=process.env,...options}={}){
 if(!getMailSender(env).ok)return {ok:false,error:'clinicals_sender_not_ready'};
 const claim=await rpc('usce_mail_dispatch',{p_action:'claim_notification'});if(!claim.ok||!claim.claimed)return claim;
 const message=notificationMessage(claim.dispatch);
 const bound=await rpc('usce_mail_dispatch',{p_action:'bind_notification',p_id:claim.dispatch.id,p_attempt_id:claim.dispatch.attempt_id,p_data:message});
 if(!bound.ok)return bound;
 return dispatchClaim({claimed:true,dispatch:bound.dispatch},{rpc,env,...options});
}
export async function reconcileDispatch(id,{rpc=makeMailRpc(),env=process.env,fetchImpl=fetch}={}){
 const read=await rpc('usce_mail_dispatch',{p_action:'get',p_id:id});if(!read.ok)return read;
 const d=read.dispatch,p=d.payload,sender=getMailSender(env);
 if(!['claimed','ambiguous'].includes(d.dispatch_state)||!sender.token)return {ok:false,error:'reconciliation_unavailable'};
 try{
  const q=new URLSearchParams({count:'2',offset:'0',metadata_usce_dispatch_id:id});
  const h={Accept:'application/json','X-Postmark-Server-Token':sender.token};
  const search=await fetchImpl('https://api.postmarkapp.com/messages/outbound?'+q,{headers:h,redirect:'error',signal:AbortSignal.timeout(8000)});const matches=await search.json();
  if(!search.ok||matches.TotalCount!==1||!UUID.test(matches.Messages?.[0]?.MessageID))return {ok:false,error:'provider_outcome_unresolved'};
  const mid=matches.Messages[0].MessageID;
  const detail=await fetchImpl('https://api.postmarkapp.com/messages/outbound/'+mid+'/details',{headers:h,redirect:'error',signal:AbortSignal.timeout(8000)});const m=await detail.json();
  if(!detail.ok||m.Metadata?.usce_dispatch_id!==id||m.MessageID!==mid||m.Sandboxed===true||!['Sent','Processed','Queued'].includes(m.Status)||(String(m.From||'').match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)||[]).map(email).join(',')!==p.from_email||m.To?.length!==1||email(m.To[0]?.Email)!==p.to_email||m.Subject!==p.subject||sha256(m.TextBody)!==p.text_sha256)return {ok:false,error:'provider_evidence_mismatch'};
  return rpc('usce_mail_dispatch',{p_action:'finish',p_id:id,p_attempt_id:d.attempt_id,p_data:{outcome:'provider_accepted',provider_message_id:mid,evidence_source:'postmark_authenticated_readback'}});
 }catch{return {ok:false,error:'provider_readback_unavailable'};}
}

export async function retryDispatch(id,{rpc=makeMailRpc(),env=process.env,...options}={}){
 if(!getMailSender(env).ok)return {ok:false,error:'clinicals_sender_not_ready'};
 const claim=await rpc('usce_mail_dispatch',{p_action:'retry',p_id:id});if(!claim.ok||!claim.claimed)return claim;
 if(claim.dispatch.action==='usce_v3_notify'&&!claim.dispatch.payload?.to_email){
  const bound=await rpc('usce_mail_dispatch',{p_action:'bind_notification',p_id:id,p_attempt_id:claim.dispatch.attempt_id,p_data:notificationMessage(claim.dispatch)});
  if(!bound.ok)return bound;claim.dispatch=bound.dispatch;
 }
 return dispatchClaim(claim,{rpc,env,...options});
}
