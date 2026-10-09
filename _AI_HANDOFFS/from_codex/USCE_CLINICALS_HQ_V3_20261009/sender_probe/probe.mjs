import fs from 'node:fs';
import crypto from 'node:crypto';
import {readGmailDwdConfig,mintDelegatedAccessToken,googleGetJson,getConfiguredAllowedMailboxes} from '../../../../missionmed-hq/routes/gmail-metadata-proof.mjs';
import {validateUscePostmarkQaRecipient} from '../../../../missionmed-hq/lib/usce-postmark-qa-guard.mjs';
const base=new URL('./',import.meta.url),path=new URL('SEND_STATE.json',base);
const mailbox='clinicals@missionmedinstitute.com',to='clinicals+usce-v3-senderprobe-20261009@missionmedinstitute.com';
const subject='[USCE QA TEST] Clinicals V3 sender verification';
const body='[USCE QA TEST] MissionMed-controlled sender verification only. No applicant, placement, offer, payment, enrollment, or business obligation. No action required.\nMissionMed Clinicals development QA';
const mode=process.argv[2];
if(mode==='send'){
 if(fs.existsSync(path))throw Error('Existing probe state: reconcile, never blindly resend');
 const guard=validateUscePostmarkQaRecipient({toEmail:to,subject,body});if(!guard.ok)throw Error('Existing QA recipient guard prevents probe');
 const token=process.env.POSTMARK_SERVER_TOKEN||process.env.USCE_POSTMARK_SERVER_TOKEN||process.env.MMHQ_POSTMARK_SERVER_TOKEN;if(!token)throw Error('Provider credential unavailable');
 const id=crypto.randomUUID(),rfc='<usce-v3-probe-'+id+'@missionmedinstitute.com>';
 const state={id,rfc,to,from:mailbox,reply_to:mailbox,subject,started_at:new Date().toISOString(),state:'attempting'};
 fs.writeFileSync(path,JSON.stringify(state,null,2),{flag:'wx',mode:0o600});
 try{
 const res=await fetch('https://api.postmarkapp.com/email',{method:'POST',signal:AbortSignal.timeout(12000),headers:{Accept:'application/json','Content-Type':'application/json','X-Postmark-Server-Token':token},body:JSON.stringify({From:'MissionMed Clinicals <'+mailbox+'>',ReplyTo:mailbox,To:to,Subject:subject,TextBody:body,MessageStream:'outbound',Tag:'usce-v3-qa-probe',Headers:[{Name:'Message-ID',Value:rfc}],Metadata:{usce_v3_probe:id}})});
 const data=await res.json();state.state=res.ok&&data.ErrorCode===0&&data.MessageID?'provider_accepted':res.status>=500?'ambiguous':'rejected';state.provider_message_id=data.MessageID||null;state.http_status=res.status;state.provider_error_code=data.ErrorCode;state.completed_at=new Date().toISOString();fs.writeFileSync(path,JSON.stringify(state,null,2));console.log(JSON.stringify(state));
 }catch(e){state.state='ambiguous';fs.writeFileSync(path,JSON.stringify(state,null,2));throw Error('Probe outcome held for reconciliation');}
}else if(mode==='read'){
 const state=JSON.parse(fs.readFileSync(path));if(!getConfiguredAllowedMailboxes().has(mailbox))throw Error('Mailbox outside existing allowlist');
 const c=readGmailDwdConfig();if(!c.ok)throw Error('DWD config unavailable');const t=await mintDelegatedAccessToken({mailbox,credentials:c.credentials,scopes:c.scopes});if(!t.ok)throw Error('DWD read unavailable');
 const q=encodeURIComponent('rfc822msgid:'+state.rfc.replace(/[<>]/g,''));const list=await googleGetJson('https://gmail.googleapis.com/gmail/v1/users/'+encodeURIComponent(mailbox)+'/messages?maxResults=5&q='+q,t.accessToken);if(!list.ok)throw Error('Receipt search unavailable');
 const ids=list.data.messages||[];if(ids.length!==1){console.log(JSON.stringify({receipt_count:ids.length,state:'pending_or_ambiguous'}));process.exit(0)}
 const got=await googleGetJson('https://gmail.googleapis.com/gmail/v1/users/'+encodeURIComponent(mailbox)+'/messages/'+ids[0].id+'?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Reply-To&metadataHeaders=Message-ID&metadataHeaders=Authentication-Results&metadataHeaders=Subject',t.accessToken);if(!got.ok)throw Error('Receipt unavailable');
 const h=Object.fromEntries(got.data.payload.headers.map(x=>[x.name.toLowerCase(),x.value]));const result={provider_message_id:state.provider_message_id,gmail_message_id:got.data.id,gmail_thread_id:got.data.threadId,received_at:new Date(Number(got.data.internalDate)).toISOString(),from:h.from,reply_to:h['reply-to'],to:h.to,rfc_message_id:h['message-id'],authentication_results:h['authentication-results'],matches_rfc:h['message-id']===state.rfc};
 fs.writeFileSync(new URL('RECEIPT.json',base),JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result));
}else throw Error('Invalid mode');

