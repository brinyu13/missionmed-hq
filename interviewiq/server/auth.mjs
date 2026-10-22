import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { jwtVerify } from 'jose';
import { AppError, requireValue } from './errors.mjs';
import { bindOwnerSession } from './owner-session.mjs';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = new Set(['student', 'mentor', 'admin']);
const audience = 'interviewiq-owner-introspection';
const denial = () => new AppError(401, 'session_unavailable', 'Your session is no longer available. Sign in again.');
export function proof(secret, domain, body) {
  return createHmac('sha256', secret).update(`${domain}\n${body}`).digest('hex');
}
export function equalHex(actual, expected) {
  return typeof actual === 'string' && /^[a-f0-9]{64}$/.test(actual) &&
    timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}
async function boundedText(response, maximum = 65536) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');
  const chunks=[]; let size=0;
  try {
    while (true) {
      const {done,value}=await reader.read(); if (done) break;
      size += value.length;
      if (size > maximum) throw new Error('Owner response exceeds limit');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel().catch(()=>{}); }
  return Buffer.concat(chunks).toString('utf8');
}

// No positive authorization cache: WordPress logout, role, enrollment and
// assignment changes are consulted on every protected request.
export function createAuthorizer(config, {fetchImpl = fetch, now = () => Date.now()} = {}) {
  // Volatile, bounded outstanding requests only; never an authorization cache.
  const pending=new Map(), emptyDigest=createHash('sha256').update('').digest('hex');
  const hash=value=>createHash('sha256').update(value).digest('hex');
  const targetAllowed=target=>typeof target==='string' && target.length<=2048 &&
    /^\/api\/calendar\/(overview|cohort)\?/.test(target) && !/[#\\]/.test(target);
  const localHeaders=request=>request.headers['x-mmed-iiq-owner-challenge']!==undefined || request.headers['x-mmed-iiq-owner-proof']!==undefined;
  const empty=request=>(request.headers['content-length']===undefined || request.headers['content-length']==='0') && request.headers['transfer-encoding']===undefined;
  const binding=(token,c,target)=>hash(JSON.stringify([hash(token),c.session_verifier,'GET',target,emptyDigest]));
  const prune=()=>{for(const [id,entry] of pending)if(entry.expiresAt<=Math.floor(now()/1000))pending.delete(id);};
  async function claimsFor(request) {
    const raw = String(request.headers.authorization || '');
    const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(raw);
    if (!match || raw.length > 12000) throw denial();
    let c;
    const seconds=Math.floor(now()/1000);
    try {
      ({payload:c}=await jwtVerify(match[1], new TextEncoder().encode(config.jwtSecret), {
        algorithms:['HS256'], issuer:config.jwtIssuer, audience:'interviewiq',
        requiredClaims:['sub','iat','exp','jti','wp_user_id','app_role','tier','interviewiq_eligible','session_verifier'],
        clockTolerance:3, currentDate:new Date(now()), typ:'JWT',
      }));
      if (!UUID.test(c.sub) || !UUID.test(c.jti) || !ROLES.has(c.app_role) || c.interviewiq_eligible !== true ||
          !Number.isSafeInteger(c.wp_user_id) || c.wp_user_id<=0 || !/^[a-f0-9]{64}$/.test(c.session_verifier) ||
          !['360','ivprep_complete','admin','assigned_mentor'].includes(c.tier) ||
          !Number.isSafeInteger(c.iat) || !Number.isSafeInteger(c.exp) || c.exp-c.iat>90 || c.exp<=c.iat || c.iat>seconds+3)
        throw new Error('Invalid claims');
    } catch { throw denial(); }
    return {c,seconds,token:match[1]};
  }
  const ownerPayload=(c,seconds,action)=>JSON.stringify({audience,subject:c.sub,wp_user_id:c.wp_user_id,session_verifier:c.session_verifier,nonce:randomUUID(),iat:seconds,action:String(action).slice(0,160)});
  async function authorize(request, action) {
    const {c,seconds,token}=await claimsFor(request);
    let payload=ownerPayload(c,seconds,action),current;
    try {
      let envelope;
      if(localHeaders(request)) {
        const id=request.headers['x-mmed-iiq-owner-challenge'],encoded=request.headers['x-mmed-iiq-owner-proof'];
        const entry=typeof id==='string'?pending.get(id):null;
        // Synchronous take/delete before parsing/acceptance; no await can race it.
        if(typeof id==='string')pending.delete(id);
        if(!entry || entry.expiresAt<=seconds || request.method!=='GET' || !targetAllowed(request.url) ||
            !empty(request) || entry.binding!==binding(token,c,request.url) || action!==`GET ${request.url.split('?')[0]}` ||
            typeof encoded!=='string' || encoded.length>8192 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw new Error('Invalid owner challenge');
        const decoded=Buffer.from(encoded,'base64');
        if(decoded.toString('base64')!==encoded)throw new Error('Invalid proof encoding');
        envelope=JSON.parse(decoded.toString('utf8'));
        if(!envelope || Object.keys(envelope).sort().join(',')!=='payload,signature')throw new Error('Invalid proof envelope');
        payload=entry.payload;
      } else {
      const response=await fetchImpl(config.ownerIntrospectionUrl, {
        method:'POST', redirect:'error', signal:AbortSignal.timeout(config.ownerTimeoutMs),
        headers:{'Content-Type':'application/json','Accept':'application/json','X-MMED-IIQ-Proof':proof(config.ownerProofSecret,'mmiiq-introspection-request-v1',payload)},
        body:payload,
      });
      if (!response.ok) throw new Error('Owner unavailable');
      envelope=JSON.parse(await boundedText(response));
      }
      const sent=JSON.parse(payload);
      if (typeof envelope.payload !== 'string' || !equalHex(envelope.signature,proof(config.ownerProofSecret,'mmiiq-introspection-response-v1',envelope.payload)))
        throw new Error('Invalid owner proof');
      current=JSON.parse(envelope.payload);
      const expectedHash=createHash('sha256').update(payload).digest('hex');
      if (current.audience!==audience || current.request_sha256!==expectedHash || current.nonce!==sent.nonce || current.subject!==c.sub ||
          current.wp_user_id!==c.wp_user_id || current.session_verifier!==c.session_verifier || !Number.isSafeInteger(current.iat) || !Number.isSafeInteger(current.exp) ||
          current.iat<seconds-3 || current.iat>Math.floor(now()/1000)+3 || current.exp<=Math.floor(now()/1000) || current.exp-current.iat>30 || current.exp<=current.iat)
        throw new Error('Stale or mismatched owner proof');
    } catch {
      throw new AppError(503,'identity_owner_unavailable','Current access could not be verified. Please try again.');
    }
    if (current.allowed!==true || !ROLES.has(current.role) || current.role!==c.app_role || current.tier!==c.tier) throw denial();
    if (!Array.isArray(current.assignment_student_ids) || current.assignment_student_ids.length>1000 ||
        !current.assignment_student_ids.every(id=>typeof id==='string' && UUID.test(id))) throw denial();
    requireValue(typeof current.tier==='string' && current.tier.length<=80,'invalid_access','Your access could not be verified.',401);
    const actor=Object.freeze({
      sub:c.sub, id:c.sub, wpUserId:c.wp_user_id, role:current.role, tier:current.tier, eligible:true,
      assignments:Object.freeze([...new Set(current.assignment_student_ids)]),
      displayName:String(c.name || '').slice(0,160), firstName:String(c.first_name || '').slice(0,100),
      zone:typeof c.zone==='string' ? c.zone : 'America/New_York',
    });
    return bindOwnerSession(actor,{verifier:c.session_verifier,expiresAt:Math.min(c.exp,current.exp)*1000});
  }
  // Called only after the HTTP gateway gate and exact existing GET route/range validation.
  authorize.issueChallenge=async(request,target)=>{
    const {c,seconds,token}=await claimsFor(request);
    if(!targetAllowed(target) || localHeaders(request) || c.exp<=seconds)throw denial();
    prune();
    const jwt=hash(token),requester=hash(String(request.socket?.remoteAddress||'unknown'));
    const unavailable=()=>{
      const payload=JSON.stringify({audience:'interviewiq-owner-challenge',code:'owner_challenge_unavailable',
        target,jwt_sha256:jwt,session_verifier:c.session_verifier,iat:seconds,exp:seconds+10});
      return {status:503,body:{payload,signature:proof(config.ownerProofSecret,'mmiiq-owner-challenge-unavailable-v1',payload)}};
    };
    const entries=[...pending.values()];
    if(!['student','admin'].includes(c.app_role) || pending.size>=256 || entries.filter(x=>x.jwt===jwt).length>=4 ||
        entries.filter(x=>x.requester===requester).length>=64)return unavailable();
    const id=randomUUID(),expiresAt=Math.min(c.exp,seconds+10),payload=ownerPayload(c,seconds,`GET ${target.split('?')[0]}`);
    pending.set(id,{jwt,requester,expiresAt,payload,binding:binding(token,c,target)});
    return {status:200,body:{version:1,id,expires_at:expiresAt,payload,
      signature:proof(config.ownerProofSecret,'mmiiq-introspection-request-v1',payload)}};
  };
  return authorize;
}
