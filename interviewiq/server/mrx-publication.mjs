import {randomUUID} from 'node:crypto';
import {AppError,requireValue,notFound} from './errors.mjs';
import * as v from './validation.mjs';
import {requireAdmin,auditDecision} from './admin-commands.mjs';
import {requireResearch,researchEnabled} from './research-workspace.mjs';
import {mrxReviewProjection,mrxPayload,mrxBinding,mrxCanonical,mrxSha,mrxNeed,mrxMac,mrxEqual,mrxResponse,mrxParse,MRX_PATH} from './mrx-contract.mjs';
export const mrxCommands=new Set(['mrx.review','mrx.publish','mrx.reconcile']);
export const mrxEnabled=(config,actor)=>researchEnabled(config,actor)&&config?.mrxPublication?.enabled===true;
function requireMRX(config,actor){requireResearch(config,actor);requireValue(mrxEnabled(config,actor),'coming_soon','Governed MRX publication is not active.',503);}
export async function writeMRX({db,actor,config,data,command,clock}){
 requireMRX(config,actor);requireAdmin(actor);
 if(command==='mrx.reconcile'){v.onlyKeys(data,['intentId']);const id=v.uuid(data.intentId,'Publication intent');const {rows:[r]}=await db.query('SELECT id FROM iiq.mrx_intents WHERE id=$1',[id]);if(!r)throw notFound();return {type:'mrx_intent',id};}
 if(command==='mrx.review'){
  v.onlyKeys(data,['submissionId','expectedReviewVersion','decision']);const sid=v.uuid(data.submissionId,'Submission');
  const {rows:[s]}=await db.query(`SELECT s.*,m.public_payload AS mission,r.id AS review_id,r.version AS review_version,r.consent_id,r.status,r.quality_status FROM iiq.research_submissions s JOIN iiq.research_missions m ON m.id=s.mission_id AND m.owner_id=s.owner_id JOIN iiq.review_items r ON r.submission_id=s.id AND r.owner_id=s.owner_id WHERE s.id=$1 AND m.standard_version='PROVISIONAL_MRX_V1' FOR UPDATE OF r`,[sid]);
  if(!s)throw notFound();requireValue(s.owner_id!==actor.id,'independent_review_required','Another administrator must review a contribution you submitted.',403);requireValue(Number(s.review_version)===data.expectedReviewVersion,'version_conflict','The review changed. Reopen it before approving public facts.',409);
  requireValue(s.parsed_package?._iiq?.eligibleForReview===true&&s.status==='approved'&&s.quality_status==='approved','mrx_review_required','Accept structural quality before the separate factual/source-rights review.',409);
  let payload;try{payload=mrxReviewProjection({...s.parsed_package.package,__submissionSha256:s.sha256},s.mission,data.decision,(clock?.()||new Date()).getTime());}catch{throw new AppError(422,'mrx_public_review_invalid','Review only current, uncontested public program claims, their exact source associations and source rights. Nothing was approved.');}
  const id=randomUUID(),digest=mrxSha(mrxCanonical(payload));
  await db.query(`INSERT INTO iiq.mrx_decisions(id,owner_id,submission_id,review_id,review_version,consent_id,admin_id,submission_sha256,program_id,registry_release_id,public_payload,payload_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)`,[id,s.owner_id,s.id,s.review_id,s.review_version,s.consent_id,actor.id,s.sha256,payload.programId,payload.registryReleaseId,mrxCanonical(payload),digest]);
  await auditDecision(db,actor,s.owner_id,'mrx.review','research_submission',sid,{decisionId:id,reviewId:s.review_id,reviewVersion:Number(s.review_version),payloadSha256:digest});
  return {type:'mrx_decision',id};
 }
 v.onlyKeys(data,['decisionId']);const id=v.uuid(data.decisionId,'Factual review');const {rows:[d]}=await db.query('SELECT * FROM iiq.mrx_decisions WHERE id=$1',[id]);if(!d)throw notFound();
 mrxPayload(d.public_payload,(clock?.()||new Date()).getTime());requireValue(d.admin_id===actor.id,'mrx_admin_changed','The independent reviewing administrator must approve publication.',403);
 const {rows:[existing]}=await db.query("SELECT id FROM iiq.mrx_intents WHERE decision_id=$1 AND operation='publish'",[id]);if(existing)return {type:'mrx_intent',id:existing.id};
 const intentId=randomUUID(),key=mrxSha('iiq-mrx-v1:publish:'+id+':'+d.payload_sha256),binding=mrxBinding({intentId,publicationId:id,submissionId:d.submission_id,submissionSha256:d.submission_sha256,reviewId:d.review_id,reviewVersion:Number(d.review_version),programId:d.program_id,registryReleaseId:d.registry_release_id,consentId:d.consent_id,adminId:d.admin_id,operation:'publish',idempotencyKey:key,payloadSha256:d.payload_sha256,priorReceiptSha256:'0'.repeat(64)});
 await db.query("INSERT INTO iiq.mrx_intents(id,owner_id,decision_id,publication_id,operation,binding,idempotency_key) VALUES($1,$2,$3,$3,'publish',$4::jsonb,$5)",[intentId,d.owner_id,id,mrxCanonical(binding),key]);
 return {type:'mrx_intent',id:intentId};
}
export async function readMRX(db,actor,config,submissionId){
 if(!mrxEnabled(config,actor))return null;
 const {rows}=await db.query(`SELECT d.id,d.review_id,d.review_version,d.payload_sha256,d.public_payload,d.created_at,i.id AS intent_id,i.operation,r.receipt,r.sha256 AS receipt_sha256 FROM iiq.mrx_decisions d LEFT JOIN iiq.mrx_intents i ON i.decision_id=d.id LEFT JOIN iiq.mrx_receipts r ON r.intent_id=i.id WHERE d.submission_id=$1 ORDER BY d.created_at DESC,i.created_at DESC LIMIT 40`,[submissionId]);
 return rows.map(r=>({decisionId:r.id,reviewId:r.review_id,reviewVersion:Number(r.review_version),payloadSha256:r.payload_sha256,publicPayload:r.public_payload,intentId:r.intent_id||null,operation:r.operation||null,receipt:r.receipt||null,receiptSha256:r.receipt_sha256||null}));
}
// This function is called only after the command transaction committed. A lost
// response leaves the same immutable intent pending; retries never mint a new key.
export async function reconcileMRX({database,actor,config,intentId,transport,revalidateActor}){
 requireMRX(config,actor);const latest=await revalidateActor();requireValue(latest?.id===actor.id&&latest.wpUserId===actor.wpUserId&&mrxEnabled(config,latest),'mrx_access_changed','Current publication access changed.',403);
 const item=await database.withActor(latest,async db=>{await db.query('SET TRANSACTION READ ONLY');const {rows:[r]}=await db.query(`SELECT i.id,i.owner_id,i.operation,i.binding,d.public_payload,r.receipt FROM iiq.mrx_intents i JOIN iiq.mrx_decisions d ON d.id=i.decision_id LEFT JOIN iiq.mrx_receipts r ON r.intent_id=i.id WHERE i.id=$1`,[intentId]);if(!r)throw notFound();requireValue(latest.role==='admin'||r.owner_id===latest.id&&r.operation==='retract','admin_required','Administrator publication review is required.',403);return r;});
 // Always ask owner again on reconciliation; a stored publication receipt must
 // not hide a later committed withdrawal or a changed current owner projection.
 let receipt;try{receipt=await transport({binding:item.binding,payload:item.operation==='publish'?item.public_payload:null});}catch{return {status:'pending',intentId};}
 const current=await revalidateActor();requireValue(current?.id===latest.id&&current.wpUserId===latest.wpUserId,'mrx_access_changed','Current access changed.',403);
 await database.withActor(current,async db=>{await db.query('INSERT INTO iiq.mrx_receipts(intent_id,owner_id,receipt,sha256) VALUES($1,$2,$3::jsonb,$4) ON CONFLICT(intent_id) DO NOTHING',[item.id,item.owner_id,mrxCanonical(receipt),mrxSha(mrxCanonical(receipt))]);},{write:true});
 return {status:receipt.status,intentId,receipt};
}
export function createMRXTransport(config={}, {fetchImpl=fetch,now=Date.now}={}){
 return async({binding,payload})=>{mrxNeed(config.enabled===true&&typeof config.requestSecret==='string'&&config.requestSecret.length>=32&&typeof config.proofSecret==='string'&&config.proofSecret.length>=32&&config.requestSecret!==config.proofSecret);mrxBinding(binding);if(binding.operation==='publish'){mrxPayload(payload,now());mrxNeed(mrxSha(mrxCanonical(payload))===binding.payloadSha256);}else mrxNeed(payload===null);
 const sent={audience:'rise-interviewiq-mrx',nonce:randomUUID(),iat:Math.floor(now()/1000),binding,payload},body=mrxCanonical(sent),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{const envelope=await mrxResponse(await fetchImpl('https://missionmed-rise-production.up.railway.app'+MRX_PATH,{method:'POST',redirect:'error',credentials:'omit',signal:controller.signal,headers:{'Content-Type':'application/json',Accept:'application/json','X-MMED-IIQ-MRX':mrxMac(config.requestSecret,'request',body)},body}));mrxNeed(typeof envelope.payload==='string'&&mrxEqual(envelope.signature,mrxMac(config.proofSecret,'receipt',envelope.payload)));const r=mrxParse(Buffer.from(envelope.payload));mrxNeed(r.audience===sent.audience&&r.nonce===sent.nonce&&r.idempotencyKey===binding.idempotencyKey&&r.publicationId===binding.publicationId&&r.operation===binding.operation&&r.payloadSha256===binding.payloadSha256&&['published','conflicted','retracted'].includes(r.status)&&Array.isArray(r.claims)&&Number.isSafeInteger(r.exp)&&r.exp>now()/1000&&r.exp<=sent.iat+30);return r;}finally{clearTimeout(timer);controller.abort();}
 };
}
