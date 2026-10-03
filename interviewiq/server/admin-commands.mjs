import {createHash} from 'node:crypto';
import {AppError,notFound,requireValue} from './errors.mjs';
import * as v from './validation.mjs';
const sha=text=>createHash('sha256').update(text).digest('hex');
export function requireAdmin(actor){requireValue(actor.role==='admin','admin_required','Administrator review is required.',403);}
export async function reviewRecord(db,id){const {rows:[row]}=await db.query('SELECT * FROM iiq.review_items WHERE id=$1 FOR UPDATE',[v.uuid(id,'Review')]);if(!row)throw notFound();return row;}
export async function auditDecision(db,actor,ownerId,event,type,id,metadata){await db.query('INSERT INTO iiq.audit_events(owner_id,actor_id,event_type,object_type,object_id,metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[ownerId,actor.id,event,type,id,JSON.stringify(metadata)]);}
function publicationReceipt(receipt,review,text,status){
 requireValue(receipt?.verified===true&&receipt.simulated!==true&&receipt.owner==='rise'&&receipt.status===status&&receipt.reviewId===review.id&&receipt.programId===review.program_id&&typeof receipt.receiptId==='string'&&receipt.receiptId.length>0&&receipt.receiptId.length<=200,'owner_receipt_required','The program-intelligence owner has not confirmed this operation.',503);
 if(status==='published')requireValue(receipt.bodySha256===sha(text),'owner_receipt_mismatch','The owner receipt does not match the reviewed text.',503);
 return {owner:'rise',status,receiptId:receipt.receiptId,bodySha256:receipt.bodySha256||null,revision:String(receipt.revision||'').slice(0,100)};
}
export async function publishReviewed({db,actor,owners,requestId},review,{sourceRefs=[]}={}){
 requireAdmin(actor);
 requireValue(review.status==='approved'&&review.quality_status==='approved'&&review.permitted_use,'quality_required','Approve permitted, de-identified quality before publication.');
 if(review.publication_status==='published')return {alreadyPublished:true};
 requireValue(typeof owners?.publishReviewedReport==='function','owner_service_unavailable','Program-intelligence publication is unavailable. Nothing was published.',503);
 // Stable review identity is the owner idempotency key, including retries after
 // an owner commit whose response was lost before the local transaction committed.
 const receipt=publicationReceipt(await owners.publishReviewedReport(actor,{reviewId:review.id,programId:review.program_id,text:review.excerpt,sourceRefs,idempotencyKey:`iiq:review:${review.id}:publish`,requestId}),review,review.excerpt,'published');
 const {rows:[published]}=await db.query('SELECT iiq.publish_report($1,$2,$3::jsonb) AS id',[review.id,review.excerpt,JSON.stringify(sourceRefs)]);
 await auditDecision(db,actor,review.owner_id,'review.publication','review',review.id,{receipt,reportId:published.id});
 return {reportId:published.id,ownerReceipt:receipt};
}
export async function retractReviewed(context,review,{status='retracted',reason='Administrator review'}={}){
 const {db,actor,owners,requestId}=context;requireAdmin(actor);let receipt=null,pending=false;
 // The local downgrade and durable intent are part of the same transaction.
 // This still does not make the external owner transaction atomic; its separately
 // reviewed reconciliation protocol is mandatory before real publication.
 await db.query("UPDATE iiq.review_items SET status=$2,publication_status='retracted',quality_status=CASE WHEN $2 IN ('rejected','repair_requested','pending') THEN $2 ELSE quality_status END,admin_note=$3 WHERE id=$1",[review.id,status,reason]);
 if(review.publication_status==='published'){
  const idempotencyKey=`iiq:review:${review.id}:retract:v${review.version}`;
  await db.query("INSERT INTO iiq.outbox_events(owner_id,topic,dedupe_key,payload) VALUES($1,'rise.report_retracted',$2,$3::jsonb) ON CONFLICT(dedupe_key) DO NOTHING",[actor.id,idempotencyKey,JSON.stringify({reviewId:review.id,programId:review.program_id,reviewVersion:String(review.version),idempotencyKey})]);
  try {
   if(typeof owners?.retractReviewedReport!=='function')throw new Error('unavailable');
   receipt=publicationReceipt(await owners.retractReviewedReport(actor,{reviewId:review.id,programId:review.program_id,idempotencyKey,requestId}),review,'','retracted');
  } catch {pending=true;}
 }
 await auditDecision(db,actor,review.owner_id,'review.retraction','review',review.id,{reason,ownerStatus:pending?'pending':receipt?'retracted':'not_published',receipt});
 return {ownerStatus:pending?'pending':receipt?'retracted':'not_published'};
}
export async function restoreContributionGrant({db},grant,reviewId=grant.qualifying_review_id){
 requireValue(new Date(grant.expires_at).getTime()>Date.now(),'grant_expired','An expired grant cannot be extended by reinstatement.',409);
 // The database verifies same mission/program, original policy, current quality,
 // execution and consent, unreversed credit, and the unchanged original window.
 await db.query('UPDATE iiq.access_grants SET qualifying_review_id=$2,revoked_at=null,suspended_at=null WHERE id=$1',[grant.id,reviewId]);
 await db.query("UPDATE iiq.review_items SET credit_status='granted' WHERE id=$1",[reviewId]);
 return {grantId:grant.id,creditStatus:'granted',restored:true,startsAt:grant.starts_at,expiresAt:grant.expires_at};
}
async function policyUpdate({db,actor,data}){
 requireAdmin(actor);v.onlyKeys(data,['key','value','reason']);const key=v.choice(data.key,['contributions','standalone'],'policy setting'),enabled=v.boolean(data.value,'Policy value'),reason=v.text(data.reason,'Policy reason',2000,{empty:false});
 const {rows:[existing]}=await db.query("SELECT * FROM iiq.policies WHERE policy_key='research' FOR UPDATE");
 let value=existing?.value||{contributions:false,standalone:false},version=existing?.policy_version||'disabled-unconfigured';value={...value,[key]:enabled};
 if(enabled){requireValue(Boolean(existing),'actual_policy_required','A reviewed actual policy must be filed before enabling access.',409);const {rows:[authority]}=await db.query('SELECT * FROM iiq.policy_authorities WHERE policy_version=$1 AND approved_policy=$2::jsonb',[version,JSON.stringify(value)]);requireValue(Boolean(authority)&&authority.authority_ref===value.contributionPolicy?.authorityRef,'actual_policy_required','This setting is not covered by the exact filed policy.',409);}
 const {rows:[row]}=await db.query("INSERT INTO iiq.policies(policy_key,value,policy_version) VALUES('research',$1::jsonb,$2) ON CONFLICT(policy_key) DO UPDATE SET value=EXCLUDED.value RETURNING id",[JSON.stringify(value),version]);
 await auditDecision(db,actor,actor.id,'policy.update','policy',row.id,{key,value:enabled,reason,policyVersion:version,protectedFloorUnchanged:true});return {type:'policy',id:row.id};
}
async function grantUpdate({db,actor,data,command}){
 requireAdmin(actor);v.onlyKeys(data,['studentId','grantId','reviewId','reason']);const student=v.uuid(data.studentId,'Student'),id=v.uuid(data.grantId,'Grant'),reason=v.text(data.reason,'Grant reason',2000,{empty:false});
 const {rows:[row]}=await db.query('SELECT * FROM iiq.access_grants WHERE id=$1 AND owner_id=$2 FOR UPDATE',[id,student]);if(!row)throw notFound();
 const reinstate=command==='grant.reinstate';
 if(reinstate)await restoreContributionGrant({db},row,data.reviewId?v.uuid(data.reviewId,'Qualifying review'):row.qualifying_review_id);
 else await db.query('UPDATE iiq.access_grants SET revoked_at=now() WHERE id=$1',[id]);
 await auditDecision(db,actor,student,command,'grant',id,{reason,programId:row.program_id,policyVersion:row.policy_version});return {type:'grant',id};
}
async function mentorNote({db,actor,data,command}){
 requireValue(actor.role==='mentor','mentor_required','A currently assigned mentor is required.',403);v.onlyKeys(data,['studentId','text']);const target=v.uuid(data.studentId,'Student'),text=v.text(data.text,'Mentor note',4000,{empty:false});
 requireValue(actor.assignments.includes(target),'assignment_required','This student is not currently assigned to you.',403);
 const kind=command==='mentor.nudge'?'nudge':'priority';
 if(kind==='nudge'){const {rows}=await db.query("SELECT id FROM iiq.learning_signals WHERE owner_id=$1 AND status='confirmed' AND mentor_visible=true LIMIT 1",[target]);requireValue(rows.length>0,'approved_gap_required','The student has not shared a confirmed preparation gap.',403);}
 const {rows:[prior]}=await db.query('SELECT id FROM iiq.mentor_notes WHERE owner_id=$1 AND target_student_id=$2 AND kind=$3 ORDER BY updated_at DESC,id LIMIT 1 FOR UPDATE',[actor.id,target,kind]);
 const result=prior?await db.query('UPDATE iiq.mentor_notes SET text=$2 WHERE id=$1 RETURNING id',[prior.id,text]):await db.query('INSERT INTO iiq.mentor_notes(owner_id,target_student_id,kind,text) VALUES($1,$2,$3,$4) RETURNING id',[actor.id,target,kind,text]);
 return {type:'mentor_note',id:result.rows[0].id};
}
export async function writeAdmin(context){
 const {db,actor,command,data}=context;
 if(command.startsWith('mentor.'))return mentorNote(context);
 if(command==='policy.update')return policyUpdate(context);
 if(['grant.revoke','grant.reinstate'].includes(command))return grantUpdate(context);
 requireAdmin(actor);v.onlyKeys(data,['reviewId']);const row=await reviewRecord(db,data.reviewId);
 if(command==='review.approve'){
  requireValue(row.source_kind==='debrief','separate_decisions_required','Research submissions require separate execution, quality, publication and credit decisions.');
  requireValue(!['withdrawn','retracted','rejected'].includes(row.status),'review_closed','This submission has been withdrawn or rejected.',409);
  await db.query("UPDATE iiq.review_items SET status='approved',quality_status='approved' WHERE id=$1",[row.id]);
  const result=await publishReviewed(context,{...row,status:'approved',quality_status:'approved'});return {type:'review',id:row.id,...result};
 }
 if(['review.reject','review.retract'].includes(command))return {type:'review',id:row.id,...await retractReviewed(context,row,{status:command==='review.reject'?'rejected':'retracted'})};
 throw new AppError(404,'unknown_command','This review action is unavailable.');
}
