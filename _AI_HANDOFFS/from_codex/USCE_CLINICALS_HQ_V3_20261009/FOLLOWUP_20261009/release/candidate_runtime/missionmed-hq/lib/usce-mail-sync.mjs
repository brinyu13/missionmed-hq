import crypto from 'node:crypto';
import {readGmailDwdConfig,mintDelegatedAccessToken,GMAIL_API_ROOT} from '../routes/gmail-metadata-proof.mjs';
import {CLINICALS_MAILBOX,makeMailRpc,dispatchNextNotification,email} from './usce-mail-dispatch.mjs';
const messageId=value=>typeof value==='string'&&/^[a-f\d]{1,40}$/i.test(value)?value:null;
const headerIds=value=>[...String(value||'').matchAll(/<[^<>\s\r\n]{1,500}>/g)].map(x=>x[0]).slice(-32);
const address=value=>{const matches=String(value||'').match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)||[];return matches.length===1?email(matches[0]):null;};
function decode(value){try{return Buffer.from(String(value||''),'base64url').toString('utf8');}catch{return '';}}
function htmlText(value){return value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<(?:br|\/p|\/div|\/li)\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"');}
export function normalizeGmailMessage(message){
 if(!messageId(message?.id))throw new Error('invalid_gmail_message');
 const headers={};for(const h of message.payload?.headers||[]){const k=String(h.name||'').toLowerCase();if(!(k in headers))headers[k]=String(h.value||'');}
 const from=address(headers.from);const to=address(headers.to)||CLINICALS_MAILBOX;
 const received=Number(message.internalDate);if(!Number.isFinite(received)||received<=0)throw new Error('invalid_message_date');
 const plain=[],html=[];let attachments=0,bodyTruncated=false,bodyUnavailable=false;
 const visit=part=>{if(!part)return;if(part.filename){attachments++;return;}if(part.body?.attachmentId){if(['text/plain','text/html'].includes(part.mimeType))bodyUnavailable=true;else attachments++;return;}if(part.mimeType==='text/plain'&&part.body?.data)plain.push(decode(part.body.data));if(part.mimeType==='text/html'&&part.body?.data)html.push(decode(part.body.data));for(const child of part.parts||[])visit(child);};visit(message.payload);
 let body=plain.length?plain.join('\n'):html.map(htmlText).join('\n');if(body.length>100000){body=body.slice(0,100000);bodyTruncated=true;}
 const automatic=!!headers['auto-submitted']&&headers['auto-submitted'].toLowerCase()!=='no'||/\b(bulk|list|junk)\b/i.test(headers.precedence||'')||!!headers['list-id']||/^(mailer-daemon|postmaster)@/i.test(from||'');
 return {gmail_message_id:message.id,gmail_thread_id:messageId(message.threadId),from_email:from||'',to_email:to,
  subject:(headers.subject||'').replace(/[\r\n]/g,' ').slice(0,500),body_text:body,received_at:new Date(received).toISOString(),
  rfc_message_id:headerIds(headers['message-id'])[0]||null,in_reply_to:headerIds(headers['in-reply-to'])[0]||null,
  references_ids:headerIds(headers.references),attachment_count:attachments,body_truncated:bodyTruncated,body_unavailable:bodyUnavailable,automatic};
}
// Gmail sometimes stores a text BODY in its attachments endpoint. Fetch only unnamed text, never documents.
export async function hydrateTextBodies(message,gmail){
 const visit=async part=>{
  if(!part||part.filename)return;
  if(part.body?.attachmentId&&['text/plain','text/html'].includes(part.mimeType)){
   const size=part.body.size,id=part.body.attachmentId;
   if(!Number.isSafeInteger(size)||size<0||size>256000||typeof id!=='string'||id.length>2048)return;
   const read=await gmail('messages/'+message.id+'/attachments/'+encodeURIComponent(id));
   if(!read.ok)throw new Error('gmail_text_body_unavailable');
   const data=read.data?.data;
   if(typeof data==='string'&&data.length<=350000){part.body={...part.body,data};delete part.body.attachmentId;}
   return;
  }
  for(const child of part.parts||[])await visit(child);
 };
 await visit(message.payload);return message;
}
export function createGmailReader({fetchImpl=fetch,mint=mintDelegatedAccessToken,config=readGmailDwdConfig}={}){
 let token=null,expires=0;
 return async(path,params={})=>{
  if(!token||Date.now()>=expires){const c=config();if(!c.ok)return {ok:false,error:'gmail_setup_required'};const t=await mint({mailbox:CLINICALS_MAILBOX,credentials:c.credentials,scopes:c.scopes});if(!t.ok)return {ok:false,error:'gmail_authorization_unavailable'};token=t.accessToken;expires=Date.now()+50*60*1000;}
  const u=new URL(GMAIL_API_ROOT+'/users/'+encodeURIComponent(CLINICALS_MAILBOX)+'/'+path);
  for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null)u.searchParams.set(k,String(v));
  try{const r=await fetchImpl(u,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok){if(r.status===401){token=null;expires=0;}return {ok:false,error:r.status===404?'gmail_history_expired':'gmail_read_unavailable',status:r.status};}return {ok:true,data:await r.json()};}catch{return {ok:false,error:'gmail_read_unavailable'};}
 };
}
function requireOk(result){if(!result?.ok)throw new Error(result?.error||'sync_failed');return result;}
export async function syncMailboxOnce({rpc=makeMailRpc(),gmail=createGmailReader(),workerId=crypto.randomUUID()}={}){
 const claim=await rpc('usce_mail_sync',{p_action:'claim',p_worker_id:workerId});if(!claim.ok||!claim.claimed)return claim;
 let state=claim.state;const generation=state.generation;let ingested=0;
 const control=(action,data={})=>rpc('usce_mail_sync',{p_action:action,p_worker_id:workerId,p_generation:generation,p_data:data});
 try{
  if(!state.baseline_history_id){const p=requireOk(await gmail('profile'));state=requireOk(await control('initialize',{history_id:p.data.historyId})).state;}
  let page,phase,ids;
  if(!state.backfill_complete){
   phase='backfill';page=requireOk(await gmail('messages',{maxResults:25,q:'-in:spam -in:trash -in:drafts',pageToken:state.backfill_page_token})).data;
   ids=[...new Set((page.messages||[]).map(m=>m.id))];
  }else{
   phase='history';const history=await gmail('history',{startHistoryId:state.history_id,maxResults:25,historyTypes:'messageAdded',pageToken:state.history_page_token});
   if(!history.ok&&history.status===404){const p=requireOk(await gmail('profile'));requireOk(await control('recover',{history_id:p.data.historyId}));return {ok:true,recovering:true,ingested:0};}
   page=requireOk(history).data;ids=[...new Set((page.history||[]).flatMap(h=>(h.messagesAdded||[]).map(m=>m.message?.id)).filter(Boolean))];
  }
  for(const id of ids){
   if(!messageId(id))throw new Error('invalid_gmail_message');
   const read=await gmail('messages/'+id,{format:'full'});
   if(!read.ok&&read.status===404)continue;
   const message=requireOk(read).data;
   if(['SPAM','TRASH','DRAFT'].some(x=>message.labelIds?.includes(x)))continue;
   const m=normalizeGmailMessage(await hydrateTextBodies(message,gmail));
   requireOk(await rpc('usce_mail_ingest',{p_worker_id:workerId,p_generation:generation,p_message:m,p_phase:phase}));ingested++;
  }
  const checkpoint=phase==='backfill'?{backfill_page_token:page.nextPageToken||null,backfill_complete:!page.nextPageToken}:
   page.nextPageToken?{history_page_token:page.nextPageToken}:{history_page_token:null,history_id:page.historyId||state.history_id};
  requireOk(await control('checkpoint',checkpoint));return {ok:true,ingested,phase,more:!!page.nextPageToken};
 }catch(error){await control('error',{code:String(error?.message||'sync_failed').replace(/[^a-z_]/g,'').slice(0,80)});return {ok:false,error:'mail_sync_unavailable',ingested};}
 finally{await control('release');}
}
export function startUsceMailWorker({env=process.env,rpc=makeMailRpc({env}),gmail=createGmailReader(),intervalMs=30000,dispatchOptions={}}={}){
 if(env.MMHQ_USCE_GATEWAY_CHILD!=='1'||env.USCE_MAIL_SYNC_ENABLED!=='true')return {started:false,stop(){}};
 let running=false,stopped=false;
 const tick=async()=>{if(running||stopped)return;running=true;try{await syncMailboxOnce({rpc,gmail});if(env.USCE_MAIL_NOTIFICATIONS_ENABLED==='true')await dispatchNextNotification({rpc,env,...dispatchOptions});}catch{/* No content or provider diagnostics in logs. */}finally{running=false;}};
 const timer=setInterval(tick,Math.max(5000,intervalMs));timer.unref?.();void tick();
 return {started:true,stop(){stopped=true;clearInterval(timer);},tick};
}
