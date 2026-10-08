import {randomUUID} from 'node:crypto';
import {jobBounded} from './interviewiq-job-auth.mjs';
import {MRX_PATH,MRX_PROOF_PATH,mrxHeaders,mrxExact,mrxBinding,mrxPayload,mrxCanonical,mrxSha,mrxNeed,mrxMac,mrxEqual,mrxResponse,mrxParse} from './interviewiq-mrx-contract.mjs';
const grants=new WeakSet();
export function assertMRXGrant(grant,binding){mrxNeed(grants.has(grant)&&mrxCanonical(grant.binding)===mrxCanonical(binding));grant.assertFresh();}
export function createCommittedMRXProof(config={}, {fetchImpl=fetch,now=Date.now}={}){
 return async binding=>{mrxNeed(config.enabled===true);mrxBinding(binding);const p={audience:'rise-interviewiq-mrx-proof',nonce:randomUUID(),iat:Math.floor(now()/1000),binding},body=mrxCanonical(p),controller=new AbortController();try{
  const e=await jobBounded(()=>mrxResponsePromise(),8000,()=>controller.abort());
  mrxNeed(typeof e.payload==='string'&&mrxEqual(e.signature,mrxMac(config.proofSecret,'proof-response',e.payload)));const r=mrxParse(Buffer.from(e.payload),16384);mrxExact(r,[...Object.keys(p),'allowed','reason','exp','wpUserId','role','tier']);mrxNeed(r.audience===p.audience&&r.nonce===p.nonce&&r.iat===p.iat&&mrxCanonical(r.binding)===mrxCanonical(binding)&&r.allowed===true&&Number.isSafeInteger(r.exp)&&r.exp>now()/1000&&r.exp<=p.iat+30&&(binding.operation==='retract'&&r.reason==='committed_lineage_removal'||binding.operation==='publish'&&r.reason==='current_admin_review_and_consent'&&r.role==='admin'&&r.tier==='admin'));
  const start=performance.now(),grant=Object.freeze({binding:structuredClone(binding),assertFresh(){mrxNeed(now()/1000<r.exp&&performance.now()-start<20000);}});grants.add(grant);return grant;
  async function mrxResponsePromise(){return mrxResponse(await fetchImpl('https://interviewiq-production-2016.up.railway.app'+MRX_PROOF_PATH,{method:'POST',redirect:'error',credentials:'omit',signal:controller.signal,headers:{'Content-Type':'application/json',Accept:'application/json','X-MMED-IIQ-MRX-Proof':mrxMac(config.proofSecret,'proof-request',body)},body}),16384);}
 }finally{controller.abort();}};
}
export function createInterviewiqMRX(config={}, {consumeNonce,prove,store,assertSourceRights,now=Date.now}={}){
 return async request=>{if(config.enabled!==true)return {status:503,body:{error:'mrx_unavailable'}};try{
  mrxNeed([config.requestSecret,config.proofSecret].every(s=>typeof s==='string'&&s.length>=32)&&config.requestSecret!==config.proofSecret);
  const p=mrxHeaders(request,{path:MRX_PATH,secret:config.requestSecret,domain:'request',header:'x-mmed-iiq-mrx',now:now()});mrxExact(p,['audience','nonce','iat','binding','payload']);mrxNeed(p.audience==='rise-interviewiq-mrx');mrxBinding(p.binding);
  if(p.binding.operation==='publish'){mrxPayload(p.payload,now());mrxNeed(p.payload.programId===p.binding.programId&&p.payload.registryReleaseId===p.binding.registryReleaseId&&p.payload.submissionSha256===p.binding.submissionSha256&&mrxSha(mrxCanonical(p.payload))===p.binding.payloadSha256);}else mrxNeed(p.payload===null&&p.binding.priorReceiptSha256===p.binding.payloadSha256);
  mrxNeed(await consumeNonce({issuer:'interviewiq',nonce:p.nonce,requestHash:mrxSha(request.body),expiresAt:new Date(now()+90000).toISOString()}));
  if(p.binding.operation==='publish')mrxNeed((await assertSourceRights())?.current===true);const grant=await prove(p.binding);assertMRXGrant(grant,p.binding);
  const result=await store.apply({binding:p.binding,payload:p.payload,grant});assertMRXGrant(grant,p.binding);
  const payload=mrxCanonical({audience:p.audience,nonce:p.nonce,idempotencyKey:p.binding.idempotencyKey,publicationId:p.binding.publicationId,operation:p.binding.operation,payloadSha256:p.binding.payloadSha256,status:result.status,claims:result.claims,exp:Math.min(p.iat+30,Math.floor(now()/1000)+30)});
  return {status:200,body:{payload,signature:mrxMac(config.proofSecret,'receipt',payload)}};
 }catch{return {status:403,body:{error:'mrx_denied'}};}};
}
