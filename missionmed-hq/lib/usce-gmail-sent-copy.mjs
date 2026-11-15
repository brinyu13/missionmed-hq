// Store an accepted HQ correspondence message in the shared Clinicals mailbox.
import { CLINICALS_MAILBOX, UUID } from './usce-mail-dispatch.mjs';

const INSERT_SCOPE = 'https://www.googleapis.com/auth/gmail.insert';
const mailboxUrl = 'https://gmail.googleapis.com/gmail/v1/users/' + encodeURIComponent(CLINICALS_MAILBOX);
const gmailId = value => typeof value === 'string' && /^[a-f0-9]{1,40}$/i.test(value);
const address = value => typeof value === 'string' && /^[a-z0-9._%+!'-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value) && value.length <= 254;
const rfcId = value => typeof value === 'string' && /^<[\x21-\x3b\x3d\x3f-\x7e]{1,500}>$/.test(value);
const sameSubject = (a,b) => typeof a === 'string' && typeof b === 'string' &&
  a.replace(/^(?:re:\s*)+/i,'').trim() === b.replace(/^(?:re:\s*)+/i,'').trim();
const normalizeText = value => value.replace(/\r\n/g,'\n');
function oneHeader(message,name) {
  const headers = (message?.payload?.headers || []).filter(h => h.name.toLowerCase() === name);
  return headers.length === 1 ? headers[0].value : null;
}
function mailboxAddress(header) {
  const match = /^([^<>,\r\n]*<([^<>,\s]+)>|([^<>,\s]+))$/.exec(header || '');
  return (match?.[2] || match?.[3] || '').toLowerCase();
}
function valid(job) {
  return UUID.test(job.dispatch_id) && UUID.test(job.comm_id) && UUID.test(job.provider_id) && UUID.test(job.case_id) &&
    job.from_email === CLINICALS_MAILBOX && address(job.to_email) && job.rfc_message_id === '<usce-mail-'+job.comm_id+'@missionmedinstitute.com>' &&
    typeof job.subject === 'string' && job.subject.trim() && job.subject.length <= 240 && !/[\x00-\x1f\x7f]/.test(job.subject) &&
    typeof job.body_text === 'string' && job.body_text.length > 0 && job.body_text.length <= 20000 && Number.isFinite(Date.parse(job.sent_at)) &&
    Array.isArray(job.references_ids) && job.references_ids.length <= 64 && job.references_ids.every(rfcId) &&
    (!job.in_reply_to ? job.references_ids.length === 0 : rfcId(job.in_reply_to) && job.references_ids.includes(job.in_reply_to));
}
function encodeSubject(subject) {
  // UTF-8 encoded words must fit the 75-character RFC 2047 limit, including delimiters.
  if (/^[\x20-\x7e]+$/.test(subject)) return subject;
  const chunks = []; let chunk = '';
  for (const ch of subject) {
    if (Buffer.byteLength(chunk + ch) > 42) { chunks.push(chunk); chunk = ''; }
    chunk += ch;
  }
  chunks.push(chunk);
  return chunks.map(s => '=?UTF-8?B?'+Buffer.from(s).toString('base64')+'?=').join('\r\n ');
}
function mime(job) {
  const headers = ['From: '+CLINICALS_MAILBOX, 'To: '+job.to_email, 'Reply-To: '+CLINICALS_MAILBOX,
    'Date: '+new Date(job.sent_at).toUTCString(), 'Message-ID: '+job.rfc_message_id, 'Subject: '+encodeSubject(job.subject)];
  if (job.in_reply_to) headers.push('In-Reply-To: '+job.in_reply_to, 'References: '+job.references_ids.join('\r\n '));
  headers.push('MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64');
  const body = Buffer.from(normalizeText(job.body_text).replace(/\n/g,'\r\n')).toString('base64').match(/.{1,76}/g).join('\r\n');
  return Buffer.from(headers.join('\r\n')+'\r\n\r\n'+body+'\r\n').toString('base64url');
}
export function createClinicalsCopyWriter({env=process.env,fetchImpl=fetch,now=Date.now}={}) {
  let token,expires=0;
  // A dedicated per-user refresh grant. The shared domain-wide reader keeps its original scope.
  return {
    async prepare() {
      if (token && now()<expires) return true;
      token = null;
      const client_id=env.USCE_CLINICALS_OAUTH_CLIENT_ID, client_secret=env.USCE_CLINICALS_OAUTH_CLIENT_SECRET, refresh_token=env.USCE_CLINICALS_OAUTH_REFRESH_TOKEN;
      if (!client_id || !client_secret || !refresh_token) return false;
      const response=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
        body:new URLSearchParams({client_id,client_secret,refresh_token,grant_type:'refresh_token',scope:INSERT_SCOPE})});
      if (!response.ok) return false;
      const grant=await response.json();
      if (!grant.access_token || grant.scope!==INSERT_SCOPE || !(Number(grant.expires_in)>60)) return false;
      token=grant.access_token; expires=now()+1000*(Math.min(3600,Number(grant.expires_in))-60);
      return true;
    },
    async insert({raw,threadId}) {
      if (!token || now()>=expires) return {ok:false};
      // The URL pins the mailbox even if a different user's grant is accidentally configured.
      const r=await fetchImpl(mailboxUrl+'/messages?internalDateSource=dateHeader',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
        headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(threadId ? {raw,threadId} : {raw})});
      if (!r.ok) { if (r.status===401) token=null; return {ok:false}; }
      return {ok:true,data:await r.json()};
    }
  };
}
async function correctParent(job,gmail) {
  if (!job.in_reply_to) return true;
  if (!gmailId(job.parent_gmail_id) || !gmailId(job.parent_thread_id) || !sameSubject(job.subject,job.parent_subject)) return false;
  const result=await gmail('messages/'+job.parent_gmail_id,{format:'metadata'});
  const p=result?.data;
  return result?.ok && p?.id===job.parent_gmail_id && p.threadId===job.parent_thread_id &&
    oneHeader(p,'message-id')===job.in_reply_to && sameSubject(oneHeader(p,'subject'),job.subject) &&
    mailboxAddress(oneHeader(p,'from'))===job.to_email && mailboxAddress(oneHeader(p,'to'))===CLINICALS_MAILBOX;
}
function matches(job,m) {
  if (!gmailId(m?.id) || !gmailId(m.threadId) || !m.labelIds?.includes('SENT') ||
      (job.in_reply_to && m.threadId!==job.parent_thread_id) || oneHeader(m,'message-id')!==job.rfc_message_id ||
      mailboxAddress(oneHeader(m,'from'))!==CLINICALS_MAILBOX || mailboxAddress(oneHeader(m,'to'))!==job.to_email ||
      oneHeader(m,'subject')!==job.subject || oneHeader(m,'in-reply-to')!==(job.in_reply_to || null) ||
      (m.payload?.headers||[]).some(h=>['cc','bcc'].includes(h.name.toLowerCase())) ||
      (oneHeader(m,'references')||'').trim().split(/\s+/).filter(Boolean).join(' ')!==job.references_ids.join(' ')) return false;
  if (m.payload.mimeType!=='text/plain' || typeof m.payload.body?.data!=='string') return false;
  return normalizeText(Buffer.from(m.payload.body.data,'base64url').toString('utf8'))===normalizeText(job.body_text);
}
export async function copyNext({rpc,gmail,writer,pilotId=null,since=null}) {
  if (pilotId ? !UUID.test(pilotId) || since : !since || !Number.isFinite(Date.parse(since))) return {outcome:'disabled'};
  const scope={pilot_id:pilotId,since}; const pick=await rpc('next',scope);
  if (!pick?.ok || !pick.job) return {outcome:pick?.ok?'idle':'storage_unavailable'};
  const job=pick.job, data={...scope,dispatch_id:job.dispatch_id};
  const defer=async reason=>{await rpc('defer',{...data,reason});return {outcome:reason};};
  let wonHere=false;
  async function verify(id) {
    if (!gmailId(id)) return defer('readback_required');
    const r=await gmail('messages/'+id,{format:'full'});
    if (!r?.ok || r.data?.id!==id || !matches(job,r.data)) return defer('readback_required');
    if (!job.reserved && !wonHere) {
      const observed=await rpc('reserve',{...data,observed_id:id});
      if (!observed?.won) return {outcome:'claim_unavailable'};
    }
    const saved=await rpc('stored',{...data,gmail_id:id,thread_id:r.data.threadId});
    return {outcome:saved?.ok?'stored':'readback_required'};
  }
  if (!valid(job)) return defer('invalid_dispatch');
  if (!await correctParent(job,gmail)) return defer('parent_unverified');
  const read=await gmail('messages',{q:'in:anywhere rfc822msgid:'+job.rfc_message_id.slice(1,-1),maxResults:2});
  if (!read?.ok || !read.data || !Array.isArray(read.data.messages??[])) return defer('readback_required');
  const found=read.data.messages||[];
  if (found.length>1 || read.data.nextPageToken) return defer('identity_conflict');
  if (found.length===1) return verify(found[0].id);
  if (job.reserved || job.existing_gmail_id) return defer('readback_required');
  if (!await writer.prepare()) return defer('authorization_required');
  if (!(await rpc('reserve',data))?.won) return {outcome:'claim_unavailable'};
  // From this point, a crash, timeout or rejected response can only be reconciled by reading Gmail.
  wonHere=true;
  // Gmail assigns SENT from the matching From address. System label SENT cannot be set manually.
  const result=await writer.insert({raw:mime(job),...(job.in_reply_to?{threadId:job.parent_thread_id}:{})});
  if (!result?.ok || !gmailId(result.data?.id)) return defer('readback_required');
  return verify(result.data.id);
}
