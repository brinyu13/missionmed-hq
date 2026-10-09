
import fs from 'node:fs';import crypto from 'node:crypto';
import {validateUscePostmarkQaRecipient} from '../../../../missionmed-hq/lib/usce-postmark-qa-guard.mjs';
const dir=new URL('./',import.meta.url),from='info+usce-v3-20261009@missionmedinstitute.com',to='clinicals@missionmedinstitute.com';
const token=process.env.POSTMARK_SERVER_TOKEN||process.env.USCE_POSTMARK_SERVER_TOKEN||process.env.MMHQ_POSTMARK_SERVER_TOKEN;
if(!token)throw Error('Provider credential unavailable');
const headers={Accept:'application/json','Content-Type':'application/json','X-Postmark-Server-Token':token};
const fence=()=>{const f=JSON.parse(fs.readFileSync(new URL('WRITER_FENCE.json',dir)));if(!f.healthy||f.valid_until*1000<=Date.now())throw Error('Writer fence stale');};
const mode=process.argv[2];
if(mode==='reply'){
 const path=new URL('REPLY_SEND_STATE.json',dir);if(fs.existsSync(path))throw Error('Prior attempt exists; reconcile first');
 const subject='Re: [USCE QA TEST] Clinicals V3 controlled Offer workflow';
 const body='[USCE QA TEST] Controlled synthetic reply from MissionMed development QA. Please verify this appears on the Alex Morgan test conversation. No real student, placement, payment, enrollment, or business obligation. No further action required.';
 const guard=validateUscePostmarkQaRecipient({toEmail:to,subject,body});if(!guard.ok)throw Error('Existing recipient guard rejected QA');
 const state={id:crypto.randomUUID(),from,to,subject,in_reply_to:'<usce-offer-f7fb80d9-1721-48be-9395-0985b10208de@missionmedinstitute.com>',state:'attempting',started_at:new Date().toISOString()};
 state.rfc='<usce-v3-reply-'+state.id+'@missionmedinstitute.com>';
 fence();fs.writeFileSync(path,JSON.stringify(state,null,2),{flag:'wx',mode:0o600});
 try{fence();const r=await fetch('https://api.postmarkapp.com/email',{method:'POST',headers,redirect:'error',signal:AbortSignal.timeout(12000),body:JSON.stringify({From:'MissionMed Controlled QA <'+from+'>',ReplyTo:from,To:to,Subject:subject,TextBody:body,MessageStream:'outbound',Tag:'usce-v3-controlled-reply',Headers:[{Name:'Message-ID',Value:state.rfc},{Name:'In-Reply-To',Value:state.in_reply_to},{Name:'References',Value:state.in_reply_to}],Metadata:{usce_v3_qa:state.id}})});
 const d=await r.json();Object.assign(state,{state:r.ok&&d.ErrorCode===0&&d.MessageID?'provider_accepted':r.status>=500?'ambiguous':'rejected',provider_message_id:d.MessageID||null,http_status:r.status,error_code:d.ErrorCode,completed_at:new Date().toISOString()});fence();fs.writeFileSync(path,JSON.stringify(state,null,2));console.log(JSON.stringify(state));
 }catch{throw Error('Reply attempt held; reconcile without resend');}
}else if(mode==='provider'){
 const id=process.argv[3];if(!/^[0-9a-f-]{36}$/.test(id))throw Error('Invalid identity');
 const r=await fetch('https://api.postmarkapp.com/messages/outbound/'+id+'/details',{headers,redirect:'error',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Provider read unavailable');const d=await r.json();
 const result={id:d.MessageID,status:d.Status,from:d.From,to:(d.To||[]).map(x=>x.Email),subject:d.Subject,sandboxed:d.Sandboxed,received_at:d.ReceivedAt,events:(d.MessageEvents||[]).map(x=>({type:x.Type,received_at:x.ReceivedAt,recipient:x.Recipient})),metadata:d.Metadata};
 fence();fs.writeFileSync(new URL('PROVIDER_'+id+'.json',dir),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}else throw Error('Invalid mode');
