import { fail } from './ledger.mjs';
import { createHash } from 'node:crypto';
const rpcNames=Object.freeze({ingest:'ingest_expense',reviewExpense:'review_expense',certifyPeriod:'certify_period',reportSent:'report_sent',verifyPayment:'mark_partner_payment_verified_and_complete',adjustment:'record_adjustment',applySettlement:'apply_settlement',stageProposal:'stage_proposal',method:'partner_method',consent:'partner_consent'});
function camel(value) {
 if(Array.isArray(value))return value.map(camel);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),camel(v)]));
 return value;
}
// Private schema access is backend-only. Production activation/profile approval is a separate gate.
export class PartnerRestStore {
 constructor({url,serviceKey,fetchImpl=fetch}) {
  const parsed=new URL(url);if(parsed.protocol!=='https:'||!serviceKey)fail('Private partner database configuration incomplete',503);
  this.url=parsed.origin;this.serviceKey=serviceKey;this.fetch=fetchImpl;
 }
 async rpc(name,parameters) {
  if(!Object.values(rpcNames).includes(name)&&!['member_for_principal','partner_view','asset_metadata','register_asset','collection_proposal','reserve_dispatch','record_dispatch','resolve_dispatch','dispatch_for_provider'].includes(name))fail('Unknown private partner operation',400);
  let response;try{response=await this.fetch(this.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:this.serviceKey,Authorization:'Bearer '+this.serviceKey,'content-type':'application/json','Content-Profile':'partner_cost_sharing','Accept-Profile':'partner_cost_sharing'},body:JSON.stringify(parameters),signal:AbortSignal.timeout(15000),redirect:'error'});}catch{fail('Private partner database is unavailable',503);}
  let body;try{body=await response.json();}catch{fail('Private partner database response invalid',503);}
  if(!response.ok)fail(body.code==='42501'?'Explicit partner authority denied':body.code==='23505'?'Duplicate evidence or conflicting invoice':'Partner ledger operation was held for review',body.code==='42501'?403:response.status===404?503:409);
  return camel(body);
 }
 async memberForPrincipal(principal,wpUserId) {
  if(!/^[0-9a-f-]{36}$/i.test(String(principal))||!Number.isSafeInteger(wpUserId)||wpUserId<=0)return null;
  return this.rpc('member_for_principal',{p_actor:principal,p_wp_user_id:wpUserId});
 }
 view(actor){return this.rpc('partner_view',{p_actor:actor.principalId,p_wp_user_id:actor.wpUserId});}
 execute(actor,command,requestId,payload) {
  const name=rpcNames[command];if(!name)fail('Unknown partner domain command',400);
  return this.rpc(name,{p_actor:actor.principalId,p_wp_user_id:actor.wpUserId,p_request:requestId,p_payload:payload});
 }
 async readOriginal(actor,expenseId){
  if(!/^[0-9a-f-]{36}$/i.test(String(expenseId)))fail('Private invoice reference invalid',404);
  const asset=await this.rpc('asset_metadata',{p_actor:actor.principalId,p_wp_user_id:actor.wpUserId,p_expense_id:expenseId});
  if(!/^[a-z0-9-]{1,80}\/[a-z0-9._-]{1,160}$/.test(asset.objectKey||'')||!['application/pdf','image/png','image/jpeg'].includes(asset.contentType)||!Number.isSafeInteger(asset.byteLength)||asset.byteLength<1||asset.byteLength>10485760)fail('Private invoice metadata invalid',409);
  let response;try{response=await this.fetch(this.url+'/storage/v1/object/partner-cost-sharing-private/'+asset.objectKey,{headers:{apikey:this.serviceKey,Authorization:'Bearer '+this.serviceKey},redirect:'error',signal:AbortSignal.timeout(15000)});}catch{fail('Private invoice store unavailable',503);}
  if(!response.ok||Number(response.headers.get('content-length'))>10485760)fail('Private original unavailable',409);
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>10485760){await reader.cancel();fail('Private invoice exceeds document limit',413);}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
  const bytes=Buffer.concat(chunks);
  if(bytes.length!==asset.byteLength||createHash('sha256').update(bytes).digest('hex')!==asset.originalSha256)fail('Private original custody differs',409);
  return {bytes,type:asset.contentType,sha256:asset.originalSha256,filename:'invoice-'+expenseId+(asset.contentType==='application/pdf'?'.pdf':asset.contentType==='image/jpeg'?'.jpg':'.png')};
 }
 registerAsset(actor,payload){return this.rpc('register_asset',{p_actor:actor.principalId,p_wp_user_id:actor.wpUserId,p_request:'asset:'+payload.originalSha256,p_payload:payload});}
 resolveDispatch(actor,requestId,payload){return this.rpc('resolve_dispatch',{p_actor:actor.principalId,p_wp_user_id:actor.wpUserId,p_request:requestId,p_payload:payload});}
 collectionProposal(actor,partner,obligationId){return this.rpc('collection_proposal',{p_actor:actor.principalId,p_wp_user_id:actor.wpUserId,p_partner:partner,p_obligation_id:obligationId});}
 reserveDispatch(actor,proposal,moneyAuthorization){return this.rpc('reserve_dispatch',{p_actor:actor.principalId,p_wp_user_id:actor.wpUserId,p_request:proposal.idempotencyKey,p_payload:{proposal,moneyAuthorization}});}
 recordDispatch(actor,dispatchId,providerPaymentId,state){return this.rpc('record_dispatch',{p_actor:actor.principalId,p_wp_user_id:actor.wpUserId,p_request:'provider:'+providerPaymentId,p_payload:{dispatchId,providerPaymentId,state}});}
 dispatchForProvider(actor,providerPaymentId){return this.rpc('dispatch_for_provider',{p_actor:actor.principalId,p_wp_user_id:actor.wpUserId,p_provider_payment_id:providerPaymentId});}
}
export function environmentPartnerConfig(env=process.env) {
 return {enabled:env.MISSIONACCOUNTS_PARTNER_COST_SHARING==='1',brianOnly:env.MISSIONACCOUNTS_PARTNER_ACCEPTANCE!=='partners',
  prototype:false,cardMode:'disabled',gmailMode:'disabled',collectionEnabled:false};
}
export function environmentPartnerStore(env=process.env) {
 if(env.MISSIONACCOUNTS_PARTNER_COST_SHARING!=='1')return null;
 const url=env.MISSIONACCOUNTS_SUPABASE_URL, serviceKey=env.MISSIONACCOUNTS_SUPABASE_SERVICE_KEY;
 if(!url||!serviceKey)return null;
 try{return new PartnerRestStore({url,serviceKey});}catch{return null;}
}
// The preview journal is disposable and accepts only explicit synthetic partner lenses.
export class LocalPartnerStore {
 constructor(ledger){this.ledger=ledger;}
 view(actor){if(!actor.prototype)fail('Local journal requires prototype identity',403);return this.ledger.view({...actor,active:true});}
 execute(actor,command,requestId,payload){
  if(!actor.prototype)fail('Local journal requires prototype identity',403);
  const bound={...actor,active:true};
  if(command==='verifyPayment')return this.ledger.markPartnerPaymentVerifiedAndComplete(bound,requestId,payload);
  if(command==='method')return payload.action==='remove'?this.ledger.removeMethod(bound,requestId):this.ledger.setMethod(bound,requestId,payload);
  if(!['ingest','reviewExpense','certifyPeriod','reportSent','adjustment','applySettlement','stageProposal','consent'].includes(command))fail('Unknown local partner command',400);
  return this.ledger[command](bound,requestId,payload);
 }
}
