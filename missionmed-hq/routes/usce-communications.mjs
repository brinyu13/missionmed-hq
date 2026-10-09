import {makeMailRpc,getMailSender,previewMessage,sendDraft,reconcileDispatch,retryDispatch,UUID,CLINICALS_MAILBOX} from '../lib/usce-mail-dispatch.mjs';
const PREFIX='/api/usce/admin/communications';
export function isUsceCommunicationsPath(path=''){return path===PREFIX||path.startsWith(PREFIX+'/');}
const bad=error=>({ok:false,error});
async function readJson(request){let bytes=0,parts=[];for await(const chunk of request){const part=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);bytes+=part.length;if(bytes>65536)throw new Error('payload_too_large');parts.push(part);}const data=JSON.parse(Buffer.concat(parts).toString('utf8')||'{}');if(!data||Array.isArray(data)||typeof data!=='object')throw new Error('invalid_json');return data;}
function respond(response,result,headers={},status){
 const code=status||(result.ok?200:['not_found'].includes(result.error)?404:['stale_revision','stale_preview','stale_draft','idempotency_conflict','draft_locked','dispatch_locked','reconciliation_required'].includes(result.error)?409:/unavailable|not_ready|not_configured|requires_reconciliation/.test(result.error||'')?503:400);
 response.writeHead(code,{...headers,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(result));
}
export async function handleUsceCommunicationsRoute(request,response,url,context={},dependencies={}){
 if(!isUsceCommunicationsPath(url.pathname))return false;
 // The server supplies this ONLY after the existing USCE admin/session/CSRF gate succeeds.
 if(context.authorizedUsceAdmin!==true){respond(response,bad('usce_admin_required'),context.authHeaders,403);return true;}
 const rpc=dependencies.rpc||makeMailRpc();const env=dependencies.env||process.env;const options={...dependencies,rpc,env};
 const tail=url.pathname.slice(PREFIX.length);const method=request.method||'GET';
 try{
  if(method==='GET'){
   if(tail==='/config'){const s=getMailSender(env);respond(response,{ok:true,sender:{from_email:CLINICALS_MAILBOX,reply_to:CLINICALS_MAILBOX,ready:s.ok},sync_enabled:env.USCE_MAIL_SYNC_ENABLED==='true'},context.authHeaders);return true;}
   if(tail==='/dispatches'){respond(response,await rpc('usce_mail_dispatch',{p_action:'list'}),context.authHeaders);return true;}
   if(tail==='/status'){respond(response,await rpc('usce_mail_read',{p_action:'status'}),context.authHeaders);return true;}
   const m=tail.match(/^\/messages\/([0-9a-f-]+)(\/thread)?$/i);
   if(m){if(!UUID.test(m[1]))throw new Error('invalid_id');const params={id:m[1],limit:50};if(url.searchParams.has('before')){params.before=url.searchParams.get('before');params.before_id=url.searchParams.get('before_id');if(!UUID.test(params.before_id)||!Number.isFinite(Date.parse(params.before)))throw new Error('invalid_cursor');}respond(response,await rpc('usce_mail_read',{p_action:m[2]?'thread':'message',p_params:params}),context.authHeaders);return true;}
   if(!tail||tail==='/'){
    const params={folder:url.searchParams.get('folder')||'inbox',search:(url.searchParams.get('search')||'').slice(0,200),limit:50};
    if(!['inbox','sent','drafts','unread','unassigned','all'].includes(params.folder))throw new Error('invalid_folder');
    for(const name of ['intake_request_id','before','before_id'])if(url.searchParams.has(name))params[name]=url.searchParams.get(name);
    if(params.intake_request_id&&!UUID.test(params.intake_request_id))throw new Error('invalid_id');
    if(params.before&&(!UUID.test(params.before_id)||!Number.isFinite(Date.parse(params.before))))throw new Error('invalid_cursor');
    respond(response,await rpc('usce_mail_read',{p_action:'list',p_params:params}),context.authHeaders);return true;
   }
  }
  if(method==='POST'){
   const data=await readJson(request);const actor={wordpress_user_id:String(context.session?.user?.id||''),source:'usce_v3_admin'};
   if(tail==='/drafts'){
    if(!UUID.test(data.intake_request_id)||data.id&&!UUID.test(data.id)||data.reply_to_message_id&&!UUID.test(data.reply_to_message_id)||data.id&&!Number.isSafeInteger(data.revision)||typeof data.subject!=='string'||typeof data.body_text!=='string'||/[\r\n]/.test(data.subject)||data.subject.length>240||data.body_text.length>20000)throw new Error('invalid_draft');
    const payload={id:data.id||null,intake_request_id:data.intake_request_id,reply_to_message_id:data.reply_to_message_id||null,revision:data.revision??null,subject:data.subject,body_text:data.body_text};
    respond(response,await rpc('usce_mail_edit',{p_action:'draft',p_data:payload,p_actor:actor}),context.authHeaders);return true;
   }
   const m=tail.match(/^\/messages\/([0-9a-f-]+)\/(read|assign|preview|send)$/i);
   if(m){
    const id=m[1],action=m[2];if(!UUID.test(id))throw new Error('invalid_id');let result;
    if(action==='read')result=await rpc('usce_mail_edit',{p_action:'read',p_data:{id},p_actor:actor});
    if(action==='assign'){if(!UUID.test(data.intake_request_id)||!Number.isSafeInteger(data.revision))throw new Error('invalid_assignment');result=await rpc('usce_mail_edit',{p_action:'assign',p_data:{id,intake_request_id:data.intake_request_id,revision:data.revision},p_actor:actor});}
    if(action==='preview'){const current=await rpc('usce_mail_read',{p_action:'message',p_params:{id}});result=current.ok?previewMessage(current.item,getMailSender(env)):current;}
    if(action==='send'){
     if(data.confirm_send!==true||!Number.isSafeInteger(data.revision)||!/^[a-f0-9]{64}$/.test(data.preview_hash||'')||typeof data.idempotency_key!=='string'||!/^[A-Za-z0-9._:-]{8,160}$/.test(data.idempotency_key))throw new Error('review_confirmation_required');
     result=await sendDraft({id,revision:data.revision,preview_hash:data.preview_hash,idempotency_key:data.idempotency_key},options);
    }
    respond(response,result,context.authHeaders);return true;
   }
   const r=tail.match(/^\/dispatches\/([0-9a-f-]+)\/(reconcile|retry)$/i);if(r){if(!UUID.test(r[1]))throw new Error('invalid_id');if(r[2]==='retry'&&data.confirm_retry!==true)throw new Error('review_confirmation_required');respond(response,await (r[2]==='retry'?retryDispatch:reconcileDispatch)(r[1],options),context.authHeaders);return true;}
  }
  respond(response,bad('route_or_method_not_supported'),context.authHeaders,405);return true;
 }catch(error){if(error instanceof SyntaxError)error=new Error('invalid_json');const allowed=new Set(['payload_too_large','invalid_json','invalid_id','invalid_cursor','invalid_folder','invalid_draft','invalid_assignment','review_confirmation_required']);respond(response,bad(allowed.has(error?.message)?error.message:'communications_unavailable'),context.authHeaders);return true;}
}
