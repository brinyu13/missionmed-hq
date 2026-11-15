import {createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, timingSafeEqual} from 'node:crypto';
import {makeMailRpc, PHIL_NOTIFICATION} from '../lib/usce-mail-dispatch.mjs';

export const PHIL_GMAIL_PATH = '/api/usce/public/phil-gmail';
const origin = 'https://missionmed-usce-gateway-production.up.railway.app';
const callback = origin + PHIL_GMAIL_PATH + '/callback';
const scope = 'https://www.googleapis.com/auth/gmail.readonly';
const cookieName = '__Host-usce-phil-consent';
const cookieAttrs = '; Path=/; HttpOnly; Secure; SameSite=None';
const expireCookie = cookieName + '=; Max-Age=0' + cookieAttrs;
const fields = {client_id:'USCE_PHIL_GOOGLE_CLIENT_ID', client_secret:'USCE_PHIL_GOOGLE_CLIENT_SECRET'};

function configured(env) {
  return env.MMHQ_USCE_GATEWAY_CHILD === '1' && /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(env[fields.client_id] || '') &&
    Boolean(env[fields.client_secret]) && /^[A-Za-z0-9_-]{43}$/.test(env.USCE_PHIL_GRANT_KEY || '');
}

function keyFor(env, purpose) {
  if (!configured(env)) throw Error('phil_connection_unavailable');
  return hkdfSync('sha256', Buffer.from(env.USCE_PHIL_GRANT_KEY,'base64url'), Buffer.from(env[fields.client_id]), Buffer.from('usce/phil/'+purpose), 32);
}
function seal(env, purpose, value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(env, purpose), iv);
  const bytes = Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),bytes.toString('base64url')].join('.');
}
function open(env, purpose, value) {
  if (typeof value!=='string' || value.length>8192 || !/^v1\.[\w-]{16}\.[\w-]{22}\.[\w-]+$/.test(value)) throw Error('invalid_envelope');
  const [,iv,tag,bytes] = value.split('.');
  const cipher = createDecipheriv('aes-256-gcm', keyFor(env,purpose), Buffer.from(iv,'base64url'));
  cipher.setAuthTag(Buffer.from(tag,'base64url'));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(bytes,'base64url')),cipher.final()]).toString('utf8'));
}
async function googleToken(env, fetchImpl, grant) {
  const body = new URLSearchParams({client_id:env[fields.client_id],client_secret:env[fields.client_secret],...grant});
  const r = await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',body,redirect:'error',signal:AbortSignal.timeout(10000)});
  if (!r.ok) throw Error('google_authorization_unavailable');
  const data = await r.json();
  const expiresIn = Number(data.expires_in);
  if (data.scope!==scope || typeof data.access_token!=='string' || !data.access_token ||
      !Number.isFinite(expiresIn) || expiresIn<60 || data.token_type?.toLowerCase()!=='bearer') throw Error('google_scope_mismatch');
  return data;
}
export async function philAccessToken(encryptedGrant,env=process.env,fetchImpl=fetch) {
  const record = open(env,'grant',encryptedGrant);
  if (record.account!==PHIL_NOTIFICATION || record.scope!==scope || !record.token) throw Error('wrong_mailbox_binding');
  return (await googleToken(env,fetchImpl,{grant_type:'refresh_token',refresh_token:record.token})).access_token;
}

const noStore = {'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow',
  'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
function page(res,status,title,body,headers={}) {
  res.writeHead(status,{...noStore,'Content-Type':'text/html; charset=utf-8',...headers});
  res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+' · MissionMed</title><style>body{font:18px/1.55 system-ui,sans-serif;color:#172d36;background:#f3f7f7;margin:0}main{max-width:42rem;margin:8vh auto;padding:2rem;background:white;border-top:5px solid #20675a}h1{font-size:2rem;line-height:1.15}a{color:#145c5a}button{font:inherit;background:#145c50;color:white;border:0;border-radius:6px;padding:.65rem 1.15rem;cursor:pointer}small{color:#46575c}</style><main><h1>'+title+'</h1>'+body+'</main></html>');
}
function redirect(res,url,cookie) {
  res.writeHead(303,{...noStore,Location:url,'Set-Cookie':cookie});res.end();
}
function intro(res) {
  page(res,200,'Connect your Gmail to Clinicals HQ',
    '<p>Phil, enter the Gmail address you use for Clinicals. You’ll review the permission on Google before anything connects.</p>'+
    '<p>Google will ask for read-only access to Gmail. This permission covers the mailbox. MissionMed searches for conversations using existing Clinicals case and message references. Only direct correspondence between you and the verified student with a matching case reply reference can be added to HQ.</p>'+
    '<p>Starting when you approve, authorized Clinicals HQ staff can see the sender, recipient, date, subject and text of matching replies on the student’s case. Personal conversations, attachments and ambiguous matches stay out of HQ. Connecting gives HQ no permission to send, edit or delete Gmail messages.</p>'+
    '<form method="post" action="'+PHIL_GMAIL_PATH+'/start"><p><label>Your Gmail address<br><input type="email" name="account" autocomplete="email" maxlength="254" required style="font:inherit;padding:.4rem;max-width:100%"></label></p><button type="submit">Continue to Google</button></form>'+
    '<p><small>MissionMed uses and transfers Gmail data in accordance with the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including its Limited Use requirements.</small></p>'+
    '<p><small>You can stop access in <a href="https://myaccount.google.com/connections">Google Account connections</a>. To request deletion of imported case mail, contact <a href="mailto:clinicals@missionmedinstitute.com">Clinicals</a>. <a href="https://missionmedinstitute.com/privacy-policy/">MissionMed privacy policy</a>.</small></p>',
    {'Referrer-Policy':'same-origin','Content-Security-Policy':noStore['Content-Security-Policy'].replace("form-action 'self'","form-action 'self' https://accounts.google.com")});
}
async function formFields(req) {
  if (String(req.headers['content-type']||'').split(';')[0]!=='application/x-www-form-urlencoded') throw Error('unexpected_form');
  const chunks=[];let length=0;
  for await(const chunk of req){const b=Buffer.from(chunk); length+=b.length;if(length>12000)throw Error('oversized');chunks.push(b);}
  const form=new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
  for(const key of ['state','code','error','iss','account']) if(form.getAll(key).length>1)throw Error('duplicate_field');
  return form;
}
function boundState(req, env, expected, now) {
  const values=String(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(cookieName+'='));
  if(values.length!==1 || !/^[\w-]{43}$/.test(expected||''))throw Error('invalid_state');
  const state=open(env,'consent',values[0].slice(cookieName.length+1));
  if(!/^[\w-]{43}$/.test(state.nonce)||!timingSafeEqual(Buffer.from(state.nonce),Buffer.from(expected))||
     !Number.isFinite(state.created)||now<state.created||now-state.created>900000||!/^[\w-]{64}$/.test(state.verifier))throw Error('invalid_state');
  return state;
}

export async function handlePhilGmail(req,res,url,{env=process.env,fetchImpl=fetch,rpc=makeMailRpc({env,fetchImpl}),now=Date.now}={}) {
  const path=url.pathname;
  if(path!==PHIL_GMAIL_PATH&&!path.startsWith(PHIL_GMAIL_PATH+'/'))return false;
  if(!configured(env)){page(res,503,'Connection unavailable','<p>Clinicals has not finished configuring this connection. Please try again later.</p>');return true;}
  const home=PHIL_GMAIL_PATH;
  if(path===home&&req.method==='GET'&&!url.search){intro(res);return true;}
  if(path===home+'/start'&&req.method==='POST'&&req.headers.origin===origin&&!url.search){
    let account;
    try { account=(await formFields(req)).get('account')?.trim().toLowerCase(); } catch { /* Invalid form. */ }
    if(account!==PHIL_NOTIFICATION){
      page(res,400,'Check the Gmail address','<p>Use the account invited by MissionMed. <a href="'+home+'">Return to the connection page</a>.</p>');
      return true;
    }
    const verifier=randomBytes(48).toString('base64url'),nonce=randomBytes(32).toString('base64url');
    const auth=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    auth.search=new URLSearchParams({client_id:env[fields.client_id],redirect_uri:callback,response_type:'code',response_mode:'form_post',scope,
      access_type:'offline',prompt:'consent',login_hint:PHIL_NOTIFICATION,state:nonce,code_challenge_method:'S256',
      code_challenge:createHash('sha256').update(verifier).digest('base64url')});
    redirect(res,auth.toString(),cookieName+'='+seal(env,'consent',{nonce,verifier,created:now()})+'; Max-Age=900'+cookieAttrs);return true;
  }
  if(path!==home+'/callback'||req.method!=='POST'||url.search){
    page(res,400,'Open the Clinicals connection link','<p><a href="'+home+'">Start your Gmail connection</a>.</p>');return true;
  }
  try {
    const form=await formFields(req);
    const state=boundState(req,env,form.get('state'),now());
    if(form.has('error')||(form.has('iss')&&form.get('iss')!=='https://accounts.google.com')||!form.get('code'))throw Error('not_approved');
    const grant=await googleToken(env,fetchImpl,{grant_type:'authorization_code',code:form.get('code'),code_verifier:state.verifier,redirect_uri:callback});
    if(typeof grant.refresh_token!=='string'||!grant.refresh_token||grant.refresh_token.length>2048)throw Error('no_offline_grant');
    const profile=await fetchImpl('https://gmail.googleapis.com/gmail/v1/users/me/profile?fields=emailAddress',{headers:{Authorization:'Bearer '+grant.access_token},redirect:'error',signal:AbortSignal.timeout(10000)});
    if(!profile.ok||(await profile.json()).emailAddress?.toLowerCase()!==PHIL_NOTIFICATION)throw Error('wrong_mailbox');
    const encrypted_grant=seal(env,'grant',{account:PHIL_NOTIFICATION,scope,token:grant.refresh_token});
    await philAccessToken(encrypted_grant,env,fetchImpl);
    const saved=await rpc('usce_phil_case_mail',{p_action:'bind',p_data:{account:PHIL_NOTIFICATION,scope,encrypted_grant}});
    if(!saved?.ok)throw Error('binding_unavailable');
    page(res,200,'Your Clinicals Gmail connection is active','<p>Verified future case replies from <strong>philaperri@gmail.com</strong> can now appear in Clinicals HQ. You can close this tab.</p>',{'Set-Cookie':expireCookie});
  } catch {
    page(res,400,'This Gmail connection was not completed','<p>Open the link again and use the account invited by MissionMed if you want to connect. <a href="'+home+'">Return to the connection page</a>.</p>',{'Set-Cookie':expireCookie});
  }
  return true;
}
