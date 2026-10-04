import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';

const PREFIX='/api/rise/v1/interviewiq/programs';
const PROOF_URL='https://missionmedinstitute.com/wp-json/missionmed/v1/interviewiq-owner/rise/introspect';
const AUDIENCE='interviewiq-rise-owner-proof';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const HEX=/^[a-f0-9]{64}$/;
const SECURITY=['owner','timestamp','nonce','actor','signature'].map(x=>`x-mmed-iiq-${x}`);
const FORBIDDEN=['cookie','origin','authorization','x-mmed-consumer'];
const sha=x=>createHash('sha256').update(x).digest('hex');
const hmac=(key,x)=>createHmac('sha256',key).update(x).digest('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&HEX.test(a)&&HEX.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const deny=()=>new Error('interviewiq_owner_unavailable');
const floor=(role,tier)=>role==='admin'&&tier==='admin'||role==='student'&&['360','ivprep_complete'].includes(tier);
export const validProgramId=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/.test(x);

// Both protocol objects are flat and exact. Tokenize strings after JSON syntax
// validation so even escaped duplicate keys cannot silently replace authority.
export function strictFlatJson(raw,keys,maxBytes=16384) {
  if(typeof raw!=='string'||Buffer.byteLength(raw)>maxBytes)throw deny();
  const value=JSON.parse(raw);
  if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).length!==keys.length||
    Object.keys(value).some(k=>!keys.includes(k))||Object.values(value).some(v=>v!==null&&typeof v==='object'))throw deny();
  const seen=new Set();
  for(const match of raw.matchAll(/"(?:[^"\\]|\\.)*"/g)) {
    if(!/^\s*:/.test(raw.slice(match.index+match[0].length)))continue;
    const key=JSON.parse(match[0]);if(seen.has(key)||!keys.includes(key))throw deny();seen.add(key);
  }
  if(seen.size!==keys.length)throw deny();return value;
}

export function parseInterviewiqRoute(method,path) {
  if(method!=='GET'||typeof path!=='string'||path.length>4096)throw deny();
  if(path.startsWith(`${PREFIX}/`)) {
    const encoded=path.slice(PREFIX.length+1),id=decodeURIComponent(encoded);
    if(!validProgramId(id)||encodeURIComponent(id)!==encoded)throw deny();
    return Object.freeze({kind:'detail',id});
  }
  if(!path.startsWith(`${PREFIX}?`))throw deny();
  const query=new URLSearchParams(path.slice(PREFIX.length+1));
  if([...query.keys()].join(',')!=='q,page,pageSize')throw deny();
  const q=query.get('q'),page=query.get('page'),pageSize=query.get('pageSize');
  if(q.length>256||/[\u0000-\u001f\u007f]/.test(q)||!/^\d+$/.test(page)||!/^\d+$/.test(pageSize)||
    Number(page)<1||Number(page)>10000||Number(pageSize)<1||Number(pageSize)>20)throw deny();
  if(`${PREFIX}?${new URLSearchParams({q,page:String(Number(page)),pageSize:String(Number(pageSize))})}`!==path)throw deny();
  return Object.freeze({kind:'search',q,page:Number(page),pageSize:Number(pageSize)});
}

function securityHeaders(raw) {
  if(!Array.isArray(raw)||raw.length%2||raw.length>200)throw deny();
  const headers=Object.create(null);
  for(let i=0;i<raw.length;i+=2) {
    if(typeof raw[i]!=='string'||typeof raw[i+1]!=='string')throw deny();
    const key=raw[i].toLowerCase(),value=raw[i+1];
    if(FORBIDDEN.includes(key))throw deny();
    if(!SECURITY.includes(key))continue;
    if(key in headers||value.includes(',')||value.length>4096||/[\r\n]/.test(value))throw deny();headers[key]=value;
  }
  if(SECURITY.some(key=>!headers[key]))throw deny();return headers;
}

async function boundedResponse(response,signal) {
  if(!response?.ok||response.redirected||!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''))throw deny();
  const length=response.headers.get('content-length');
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>16384))throw deny();
  const reader=response.body?.getReader();if(!reader)throw deny();
  const chunks=[];let size=0;
  // Cancellation must not wait on a stalled producer after the outer deadline.
  const cancel=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
  try {
    for(;;) {const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384)throw deny();chunks.push(value);}
    return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));
  } finally {signal.removeEventListener('abort',cancel);cancel();}
}

export function createInterviewiqAuthenticator({enabled=false,requestSecret,proofSecret}={},
  {consumeNonce,fetchImpl=fetch,now=Date.now}={}) {
  async function proof(context) {
    const {actor,requestHash,action}=context,nonce=randomUUID();
    const body=JSON.stringify({audience:AUDIENCE,nonce,subject:actor.subject,wp_user_id:actor.wp_user_id,
      session_verifier:actor.session_verifier,action,request_sha256:requestHash});
    const controller=new AbortController();let timer;
    try {
      return await Promise.race([new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(deny());},5000);}), (async()=>{
        const response=await fetchImpl(PROOF_URL,{method:'POST',redirect:'error',credentials:'omit',signal:controller.signal,
          headers:{Accept:'application/json','Content-Type':'application/json','X-MMED-IIQ-Owner-Proof':hmac(proofSecret,`iiq-owner-proof-v1\nrequest\n${body}`)},body});
        const raw=await boundedResponse(response,controller.signal);
        if(!equal(response.headers.get('x-mmed-iiq-owner-proof'),hmac(proofSecret,`iiq-owner-proof-v1\nresponse\n${raw}`)))throw deny();
        const p=strictFlatJson(raw,['audience','nonce','request_sha256','subject','wp_user_id','session_verifier','allowed','role','tier','iat','exp']);
        const seconds=Math.floor(now()/1000);
        if(p.audience!==AUDIENCE||p.nonce!==nonce||p.request_sha256!==requestHash||p.subject!==actor.subject||
          p.wp_user_id!==actor.wp_user_id||p.session_verifier!==actor.session_verifier||p.allowed!==true||
          p.role!==actor.auth_role||p.tier!==actor.auth_tier||!floor(p.role,p.tier)||
          !Number.isSafeInteger(p.iat)||!Number.isSafeInteger(p.exp)||p.iat>seconds||p.exp<=seconds||p.exp-p.iat<1||p.exp-p.iat>30||
          now()-context.startedAt>30000||now()<context.startedAt)throw deny();
        context.proofExpiresAt=p.exp*1000;
        return true;
      })()]);
    } catch {throw deny();} finally {clearTimeout(timer);controller.abort();}
  }
  return async request=>{
    try {
      if(enabled!==true||typeof consumeNonce!=='function'||typeof requestSecret!=='string'||typeof proofSecret!=='string'||
        Buffer.byteLength(requestSecret)<32||Buffer.byteLength(proofSecret)<32||requestSecret===proofSecret)throw deny();
      const startedAt=now(),route=parseInterviewiqRoute(request.method,request.url);
      if(!Buffer.isBuffer(request.body)||request.body.length!==0)throw deny();
      const h=securityHeaders(request.rawHeaders),timestamp=h[SECURITY[1]],nonce=h[SECURITY[2]],encoded=h[SECURITY[3]];
      if(h[SECURITY[0]]!=='rise'||!/^\d{10}$/.test(timestamp)||Math.abs(Math.floor(startedAt/1000)-Number(timestamp))>30||
        !UUID.test(nonce)||!/^[A-Za-z0-9_-]+$/.test(encoded))throw deny();
      const bytes=Buffer.from(encoded,'base64url');if(bytes.toString('base64url')!==encoded)throw deny();
      const raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
      const actor=strictFlatJson(raw,['subject','wp_user_id','session_verifier','auth_role','auth_tier'],2048);
      if(!UUID.test(actor.subject)||!Number.isSafeInteger(actor.wp_user_id)||actor.wp_user_id<1||!HEX.test(actor.session_verifier)||
        !floor(actor.auth_role,actor.auth_tier))throw deny();
      const canonical=`iiq-owner-v1\nrise\n${timestamp}\n${nonce}\nGET\n${request.url}\n${sha('')}\n${sha(bytes)}`;
      if(!equal(h[SECURITY[4]],hmac(requestSecret,canonical)))throw deny();
      const requestHash=sha(canonical);
      if(await consumeNonce({issuer:'interviewiq',nonce,requestHash,expiresAt:new Date(startedAt+90000).toISOString()})!==true)throw deny();
      const context={actor:Object.freeze(actor),requestHash,action:`GET ${request.url}`,startedAt};
      await proof(context);
      // A closure retains private authority without returning actor/session bytes.
      return Object.freeze({route,recheck:()=>proof(context),assertFresh:()=>{
        const time=now();
        if(time<context.startedAt||time-context.startedAt>30000||time>=context.proofExpiresAt)throw deny();
      }});
    } catch {throw deny();}
  };
}
