import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {strictFlatJson,validProgramId} from './interviewiq-auth.mjs';

export const IIQ_JOB_PATH='/api/rise/v1/interviewiq/research-jobs';
export const IIQ_JOB_BINDING=Object.freeze(['requestId','demandId','interviewId','ownerId','programId','registryReleaseId']);
const PROOF_URL='https://interviewiq-production-2016.up.railway.app/api/owner/rise/research-authority';
const AUD='rise-interviewiq-research-job',PROOF_AUD='rise-interviewiq-committed-job';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$(?![\s\S])/;
const HEX=/^[a-f0-9]{64}$(?![\s\S])/;
const grants=new WeakSet();
export const jobSha=value=>createHash('sha256').update(value).digest('hex');
const mac=(key,value)=>createHmac('sha256',key).update(value).digest('hex');
const equal=(a,b)=>typeof a==='string'&&HEX.test(a)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const deny=()=>{throw Error('interviewiq_job_unavailable');};
const requireValue=value=>{if(!value)deny();};
export const exactJobId=value=>typeof value==='string'&&UUID.test(value);
const exactProgramId=value=>validProgramId(value)&&!/[^A-Za-z0-9._:-]/.test(value);
function validateBinding(value) {
  requireValue(value&&IIQ_JOB_BINDING.every((key,i)=>(i<4?exactJobId:exactProgramId)(value[key])));
  return Object.freeze(Object.fromEntries(IIQ_JOB_BINDING.map(key=>[key,value[key]])));
}
export function assertResearchGrant(grant,{binding,bodyHash,phase}) {
  requireValue(grants.has(grant)&&grant.phase===phase&&grant.bodyHash===bodyHash&&
    IIQ_JOB_BINDING.every(k=>grant.binding[k]===binding?.[k]));
  grant.assertFresh();return grant.principal;
}
function secrets(config) {
  const {requestSecret,proofSecret,otherSecrets=[]}=config;
  requireValue(config.enabled===true&&[requestSecret,proofSecret].every(x=>typeof x==='string'&&Buffer.byteLength(x)>=32)&&requestSecret!==proofSecret&&
    Array.isArray(otherSecrets)&&otherSecrets.every(x=>typeof x==='string'&&x!==requestSecret&&x!==proofSecret));
}
function decode(bytes) {
  requireValue(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=16384);
  return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
}
export async function jobBounded(work,milliseconds,onTimeout=()=>{}) {
  let timer;
  try{return await Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{
    timer=setTimeout(()=>{onTimeout();reject(Error('interviewiq_job_unavailable'));},milliseconds);
  })]);}finally{clearTimeout(timer);}
}
async function responseBody(response,signal) {
  requireValue(response?.ok===true&&response.redirected!==true&&/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')??''));
  const length=response.headers.get('content-length');if(length!==null)requireValue(/^\d+$/.test(length)&&Number(length)<=16384);
  const reader=response.body?.getReader();requireValue(reader);
  const cancel=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
  if(signal.aborted){signal.removeEventListener('abort',cancel);cancel();deny();}
  const chunks=[];let size=0;
  try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;requireValue(size<=16384);chunks.push(Buffer.from(value));}
    return decode(Buffer.concat(chunks));
  } finally {signal.removeEventListener('abort',cancel);cancel();}
}

// New service operation, never an interactive session or generic RISE actor.
export function createCommittedResearchProof(config={}, {fetchImpl=fetch,now=Date.now,onVerifiedProof}={}) {
  return async ({binding,bodyHash,phase})=>{
    secrets(config);binding=validateBinding(binding);requireValue(HEX.test(bodyHash)&&typeof bodyHash==='string'&&['reserve','start','publish'].includes(phase));
    if(onVerifiedProof!==undefined)requireValue(typeof onVerifiedProof==='function'&&['start','publish'].includes(phase)&&binding.ownerId==='c94abcfb-dfda-4c74-9a27-f58fcf56f9b2'&&binding.programId==='rise_ps_1e3d2dbb-149a-57b2-8ea1-4431da0b42ab'&&binding.registryReleaseId==='rise_registry_acgme_2026-09-20_50d08ea6f2da');
    const start=now(),monotonic=performance.now();requireValue(Number.isSafeInteger(start));
    const iat=Math.floor(start/1000),nonce=randomUUID();
    const request={audience:PROOF_AUD,nonce,iat,phase,...Object.fromEntries(IIQ_JOB_BINDING.map(k=>[k,binding[k]])),request_sha256:bodyHash};
    const raw=JSON.stringify(request),controller=new AbortController();
    try {
      const envelope=await jobBounded(async()=>strictFlatJson(await responseBody(await fetchImpl(PROOF_URL,{
        method:'POST',redirect:'error',credentials:'omit',signal:controller.signal,
        headers:{'Content-Type':'application/json',Accept:'application/json','X-MMED-IIQ-Job-Proof':mac(config.proofSecret,`iiq-job-proof-v1\nrequest\n${raw}`)},body:raw,
      }),controller.signal),['payload','signature']),5000,()=>controller.abort());
      requireValue(typeof envelope.payload==='string'&&equal(envelope.signature,mac(config.proofSecret,`iiq-job-proof-v1\nresponse\n${envelope.payload}`)));
      const value=strictFlatJson(envelope.payload,[...Object.keys(request),'allowed','reason','exp','wpUserId','role','tier']);
      const current=now();
      requireValue(Number.isSafeInteger(current)&&current>=start&&current-start<5000&&performance.now()-monotonic<5000&&
        Object.keys(request).every(k=>value[k]===request[k])&&value.allowed===true&&value.reason==='current_committed_demand'&&
        Number.isSafeInteger(value.exp)&&value.iat<=Math.floor(current/1000)&&value.exp>Math.floor(current/1000)&&value.exp>iat&&value.exp-iat<=30&&
        Number.isSafeInteger(value.wpUserId)&&value.wpUserId>0&&
        (value.role==='admin'&&value.tier==='admin'||value.role==='student'&&['360','ivprep_complete'].includes(value.tier)));
      const grant=Object.freeze({expiresAt:value.exp,binding,bodyHash,phase,receipt:Object.freeze({nonceSha256:jobSha(nonce),requestSha256:jobSha(raw)}),
        principal:Object.freeze({wpUserId:value.wpUserId,role:value.role,tier:value.tier}),assertFresh:()=>{
        const time=now();requireValue(Number.isSafeInteger(time)&&time>=start&&time<value.exp*1000&&performance.now()-monotonic<30000);
      }});
      grants.add(grant);
      if(onVerifiedProof!==undefined){requireValue(typeof onVerifiedProof==='function'&&binding.ownerId==='c94abcfb-dfda-4c74-9a27-f58fcf56f9b2'&&binding.programId==='rise_ps_1e3d2dbb-149a-57b2-8ea1-4431da0b42ab'&&binding.registryReleaseId==='rise_registry_acgme_2026-09-20_50d08ea6f2da'&&value.wpUserId===1397&&value.role==='student'&&value.tier==='ivprep_complete');grant.assertFresh();onVerifiedProof(Object.freeze({issuer:'rise-research-proof',...grant.receipt,bodySha256:bodyHash,phase}));}
      return grant;
    } catch {deny();} finally {controller.abort();}
  };
}

export function createInterviewiqJobAuthenticator(config={}, {consumeNonce,now=Date.now}={}) {
  return async request=>{
    secrets(config);requireValue(typeof consumeNonce==='function');
    requireValue(request?.method==='POST'&&request.url===IIQ_JOB_PATH&&Array.isArray(request.rawHeaders)&&request.rawHeaders.length%2===0&&request.rawHeaders.length<=100);
    const headers=new Map();
    const allowed=['x-mmed-iiq-job-timestamp','x-mmed-iiq-job-nonce','x-mmed-iiq-job-signature','x-mmed-iiq-job-receipt'];
    for(let i=0;i<request.rawHeaders.length;i+=2) {
      const name=request.rawHeaders[i],value=request.rawHeaders[i+1];
      requireValue(typeof name==='string'&&typeof value==='string'&&/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$(?![\s\S])/.test(name)&&!/[\u0000-\u001f\u007f]/.test(value));
      const key=name.toLowerCase();requireValue(!headers.has(key));headers.set(key,value);
      requireValue(!['origin','cookie','cookie2','authorization','proxy-authorization','transfer-encoding','content-encoding','expect','x-http-method-override','x-method-override','x-http-method'].includes(key));
      requireValue(!key.startsWith('x-mmed-')||allowed.includes(key));
    }
    const raw=decode(request.body),bodyHash=jobSha(request.body),time=now(),started=performance.now();
    requireValue(Number.isSafeInteger(time)&&/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(headers.get('content-type')??''));
    if(headers.has('content-length'))requireValue(headers.get('content-length')===String(request.body.length));
    const timestamp=headers.get(allowed[0]),nonce=headers.get(allowed[1]);
    requireValue(typeof timestamp==='string'&&/^\d{10}$(?![\s\S])/.test(timestamp)&&Math.abs(Math.floor(time/1000)-Number(timestamp))<=30&&exactJobId(nonce));
    const receiptMode=headers.has(allowed[3]);requireValue(!receiptMode||headers.get(allowed[3])==='synthetic-hash-v1');
    const canonical=`${receiptMode?'iiq-research-job-v2':'iiq-research-job-v1'}\nrequest\n${AUD}\n${timestamp}\n${nonce}\nPOST\n${IIQ_JOB_PATH}\n${bodyHash}`;
    requireValue(equal(headers.get(allowed[2]),mac(config.requestSecret,canonical)));
    const parsed=strictFlatJson(raw,[...IIQ_JOB_BINDING,'kind']);requireValue(parsed.kind==='program-gaps');
    const binding=validateBinding(parsed);
    requireValue(!receiptMode||binding.ownerId==='c94abcfb-dfda-4c74-9a27-f58fcf56f9b2'&&binding.programId==='rise_ps_1e3d2dbb-149a-57b2-8ea1-4431da0b42ab'&&binding.registryReleaseId==='rise_registry_acgme_2026-09-20_50d08ea6f2da');
    requireValue(await jobBounded(()=>consumeNonce({issuer:'interviewiq',nonce,requestHash:jobSha(canonical),expiresAt:new Date(time+90000).toISOString()}),5000)===true);
    const assertFresh=()=>{const current=now();requireValue(Number.isSafeInteger(current)&&current>=time&&current<Number(timestamp)*1000+30000&&performance.now()-started<10000);};
    assertFresh();
    return Object.freeze({binding,bodyHash,nonce,assertFresh,receiptMode,signReceipt:({status,jobId,proofExpiresAt,proofReceipt})=>{
      assertFresh();const iat=Math.floor(now()/1000),exp=Math.min(iat+30,Number(timestamp)+30,proofExpiresAt);
      requireValue(Number.isSafeInteger(exp)&&exp>iat);
      requireValue(!receiptMode||proofReceipt&&Object.keys(proofReceipt).sort().join()==='nonceSha256,requestSha256'&&HEX.test(proofReceipt.nonceSha256)&&HEX.test(proofReceipt.requestSha256));
      const payload=JSON.stringify({audience:AUD,nonce,request_sha256:bodyHash,...binding,status,jobId,iat,exp,...(receiptMode?{proofNonceSha256:proofReceipt.nonceSha256,proofRequestSha256:proofReceipt.requestSha256}:{})});
      return {payload,signature:mac(config.requestSecret,`iiq-research-job-v1\nresponse\n${payload}`)};
    }});
  };
}
