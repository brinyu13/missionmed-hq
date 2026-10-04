import {createHash,createHmac,randomUUID} from 'node:crypto';
import {AppError} from './errors.mjs';
import {readOwnerSession} from './owner-session.mjs';

const ORIGIN='https://missionmed-rise-production.up.railway.app';
const PROGRAMS='/api/rise/v1/interviewiq/programs';
const MAX_BYTES=1048576;
const sha=value=>createHash('sha256').update(value).digest('hex');
const unavailable=()=>new AppError(503,'owner_service_unavailable','Program intelligence is temporarily unavailable. Your saved interview remains safe.');
const invalid=()=>new AppError(422,'invalid_owner_request','Choose a valid program or search.');
export const validProgramId=id=>typeof id==='string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/.test(id) && !['.','..'].includes(id);
function plain(value,keys) {
  return value && Object.getPrototypeOf(value)===Object.prototype && Object.keys(value).every(k=>keys.includes(k));
}
function route(operation) {
  if(!plain(operation,['kind','id','query']))throw invalid();
  if(operation.kind==='detail' && Object.keys(operation).length===2 && validProgramId(operation.id))
    return `${PROGRAMS}/${encodeURIComponent(operation.id)}`;
  if(operation.kind!=='search' || operation.id!==undefined || !plain(operation.query,['q','page','pageSize']))throw invalid();
  const {q='',page=1,pageSize=20}=operation.query;
  if(typeof q!=='string' || q.length>256 || /[\u0000-\u001f\u007f]/.test(q) ||
    !Number.isSafeInteger(page) || page<1 || page>10000 ||
    !Number.isSafeInteger(pageSize) || pageSize<1 || pageSize>20)throw invalid();
  return `${PROGRAMS}?${new URLSearchParams({q,page:String(page),pageSize:String(pageSize)})}`;
}
async function readJson(response) {
  if(!response?.ok || response.redirected || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''))throw unavailable();
  const length=response.headers.get('content-length');
  if(length!==null && (!/^\d+$/.test(length) || Number(length)>MAX_BYTES))throw unavailable();
  const reader=response.body?.getReader();if(!reader)throw unavailable();
  const pieces=[];let size=0;
  try {
    for(;;) {
      const {done,value}=await reader.read();if(done)break;
      size+=value.length;if(size>MAX_BYTES)throw unavailable();pieces.push(value);
    }
    const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(pieces));
    return JSON.parse(text,(key,value)=>{
      if(['__proto__','constructor','prototype'].includes(key))throw unavailable();return value;
    });
  } finally {await reader.cancel().catch(()=>{});}
}

// A2 is a client only. The owner must independently verify the signed request,
// durable nonce and fresh current-session proof before serving any response.
export function createRiseReadTransport({enabled=false,requestSecret}={}, {fetchImpl=fetch,now=Date.now}={}) {
  return async (actor,operation)=>{
    if(enabled!==true || typeof requestSecret!=='string' || Buffer.byteLength(requestSecret)<32)throw unavailable();
    const seconds=Math.floor(now()/1000),context=readOwnerSession(actor,now());
    if(!context)throw new AppError(401,'owner_session_required','Refresh your current MissionMed session.');
    const path=route(operation),url=new URL(path,ORIGIN);
    if(url.origin!==ORIGIN || !(url.pathname===PROGRAMS || url.pathname.startsWith(`${PROGRAMS}/`)))throw invalid();
    const nonce=randomUUID();
    const actorJson=JSON.stringify({subject:actor.id,wp_user_id:actor.wpUserId,session_verifier:context.verifier,auth_role:actor.role,auth_tier:actor.tier});
    const canonical=`iiq-owner-v1\nrise\n${seconds}\n${nonce}\nGET\n${path}\n${sha('')}\n${sha(actorJson)}`;
    const signature=createHmac('sha256',requestSecret).update(canonical).digest('hex');
    const controller=new AbortController();let timer;
    try {
      const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(unavailable());},5000);});
      return await Promise.race([deadline,(async()=>{
        const response=await fetchImpl(url.href,{method:'GET',redirect:'error',credentials:'omit',signal:controller.signal,
          headers:{Accept:'application/json','X-MMED-IIQ-Owner':'rise','X-MMED-IIQ-Timestamp':String(seconds),
            'X-MMED-IIQ-Nonce':nonce,'X-MMED-IIQ-Actor':Buffer.from(actorJson).toString('base64url'),'X-MMED-IIQ-Signature':signature}});
        const value=await readJson(response);
        if(!readOwnerSession(actor,now()))throw unavailable();
        return value;
      })()]);
    } catch {throw unavailable();}
    finally {clearTimeout(timer);controller.abort();}
  };
}
