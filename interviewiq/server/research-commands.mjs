import {randomUUID,createHash} from 'node:crypto';
import {isIP} from 'node:net';
import {AppError,notFound,requireValue} from './errors.mjs';
import * as v from './validation.mjs';
import {requireAdmin,reviewRecord,publishReviewed,retractReviewed,restoreContributionGrant,auditDecision} from './admin-commands.mjs';
import {MRX_VERSION,buildResearchMission,projectResearchCoverage,researchMissionReuseKey,researchMissionMatches,inspectResearchResult} from './research-standard.mjs';
import {requireResearch,provisionalMission} from './research-workspace.mjs';
const sha=text=>createHash('sha256').update(text).digest('hex');
const student=actor=>requireValue(actor.role==='student','student_required','Use your student workspace for research contributions.',403);
function publicUrl(value){try{const u=new URL(value);const host=u.hostname.replace(/^\[|\]$/g,'').toLowerCase();return u.protocol==='https:'&&!u.username&&!u.password&&!isIP(host)&&host.includes('.')&&!/(^|\.)(localhost|local|internal|test|invalid)$/.test(host)&&(!u.port||u.port==='443');}catch{return false;}}
function inspectTree(value){let nodes=0;function walk(x,depth){if(depth>18||++nodes>6000)throw new Error('package_complexity');if(typeof x==='string'&&(x.length>30000||x.includes('\0')))throw new Error('invalid_string');if(x&&typeof x==='object'){if(!Array.isArray(x)&&Object.keys(x).some(k=>['__proto__','constructor','prototype'].includes(k)))throw new Error('unsafe_field');for(const v of Object.values(x))walk(v,depth+1);}}walk(value,0);}
export function inspectResearchPackage(text,mission){
 const reasons=[];let pkg=null;
 try{pkg=JSON.parse(text);inspectTree(pkg);v.object(pkg,'Research package');}catch{return {package:null,status:'quarantined',reasons:['The original is retained. Supply a bounded JSON object without unsafe fields.']};}
 if(/ignore (?:all |any )?(?:previous|prior) instructions|system prompt|grant (?:me |admin |unlimited )?access|bypass (?:the )?(?:rules|authentication)/i.test(text))reasons.push('Instruction-like content is inert and requires a clean repair.');
 if(pkg.schema!==mission.public_payload.required_schema)reasons.push('Package schema does not match the current mission standard.');
 if(pkg.mission!==mission.id||pkg.program!==mission.program_id||pkg.policy_version!==mission.standard_version)reasons.push('Mission, program or policy identity does not match.');
 if(typeof pkg.researched_at!=='string'||!Number.isFinite(Date.parse(pkg.researched_at)))reasons.push('Research date is missing or invalid.');
 if(pkg.permitted_use!==true)reasons.push('Explicit permitted-use confirmation is required.');
 if(!pkg.categories||typeof pkg.categories!=='object'||Array.isArray(pkg.categories))reasons.push('Required category coverage is missing.');
 else for(const key of mission.public_payload.required_categories||[])if(!Object.hasOwn(pkg.categories,key))reasons.push(`Required category is missing: ${String(key).slice(0,80)}.`);
 const sources=Array.isArray(pkg.sources)?pkg.sources:[],claims=Array.isArray(pkg.claims)?pkg.claims:[],sourceIds=new Set();
 if(!sources.length||sources.length>100)reasons.push('Include between one and 100 public sources.');
 for(const source of sources){if(!source||typeof source.id!=='string'||source.id.length>100||sourceIds.has(source.id)||typeof source.title!=='string'||source.title.length>1000||!publicUrl(source.url)||!Number.isFinite(Date.parse(source.retrieved_at)))reasons.push('A source has an invalid identity, date or public HTTPS URL.');else sourceIds.add(source.id);}
 if(!claims.length||claims.length>200)reasons.push('Include bounded source-linked claims.');
 if(claims.reduce((n,c)=>n+(typeof c?.text==='string'?c.text.length:0)+2,0)>30000)reasons.push('Public claims exceed the reviewable text limit.');
 for(const claim of claims)if(!claim||typeof claim.text!=='string'||!claim.text.trim()||claim.text.length>5000||!Array.isArray(claim.source_ids)||!claim.source_ids.length||claim.source_ids.some(id=>!sourceIds.has(id)))reasons.push('A claim has no valid supporting source references.');
 for(const field of ['unknowns','contradictions','limitations'])if(!Array.isArray(pkg[field])||pkg[field].length>200)reasons.push(`${field} must be an explicit bounded array, including when empty.`);
 if(!pkg.execution_declaration||typeof pkg.execution_declaration!=='object'||Array.isArray(pkg.execution_declaration))reasons.push('Include the execution declaration; it remains unverified until trusted review.');
 return {package:pkg,status:reasons.length?'quarantined':'review',reasons:[...new Set(reasons)].slice(0,30)};
}
const nowOf=context=>(context.clock?.()||new Date()).getTime();
async function provisionalCreate(context){
 const {db,actor,data,owners,config}=context;requireResearch(config,actor);v.onlyKeys(data,['program']);
 const programId=v.text(data.program,'Program',180,{empty:false});
 requireValue(typeof owners?.getResearchCoverage==='function','owner_service_unavailable','Current program research coverage is unavailable.',503);
 const response=await owners.getResearchCoverage(actor,programId),now=nowOf(context);let current;
 try{current=projectResearchCoverage({...response,now});researchMissionReuseKey({...current,now});}
 catch(error){if(error.message==='no_research_gaps')throw new AppError(409,'no_research_gaps','This program has no current research gaps.');throw new AppError(503,'research_coverage_unavailable','Current program research coverage could not be verified.');}
 requireValue(current.program.id===programId,'program_unavailable','Confirm a current canonical program.',409);
 const {rows}=await db.query("SELECT * FROM iiq.research_missions WHERE owner_id=$1 AND program_id=$2 AND standard_version=$3 AND status IN ('open','submitted') AND expires_at>now() ORDER BY created_at DESC,id DESC LIMIT 201 FOR UPDATE",[actor.id,programId,MRX_VERSION]);
 requireValue(rows.length<=200,'mission_reconciliation_required','Research mission history requires reconciliation before another mission is created.',409);
 for(const row of rows){
  const packet=row.public_payload;
  if(row.owner_id===actor.id&&packet?.mission===row.id&&packet?.program?.id===row.program_id&&packet?.policy_version===row.standard_version&&
    new Date(row.expires_at).getTime()===Date.parse(packet.expires_at)&&researchMissionMatches(packet,{...current,now}))return {type:'mission',id:row.id,mission:packet,reused:true};
 }
 const id=randomUUID(),packet=buildResearchMission({missionId:id,...current,now});
 await db.query('INSERT INTO iiq.research_missions(id,owner_id,program_id,standard_version,public_payload,expires_at) VALUES($1,$2,$3,$4,$5::jsonb,$6)',[id,actor.id,programId,MRX_VERSION,JSON.stringify(packet),packet.expires_at]);
 return {type:'mission',id,mission:packet,reused:false};
}
async function missionCreate(context){
 if(context.config?.researchMissionsEnabled===true)return provisionalCreate(context);
 const {db,actor,data,owners,requestId}=context;
 student(actor);v.onlyKeys(data,['program']);const programId=v.text(data.program,'Program',180,{empty:false});
 requireValue(typeof owners?.researchMission==='function'&&typeof owners?.getProgram==='function','owner_service_unavailable','Current research standards and program evidence are unavailable.',503);
 const program=await owners.getProgram(actor,programId);requireValue(program?.id===programId,'program_unavailable','Confirm a current canonical program.',409);
 const standard=await owners.researchMission(actor,{programId,requestId});
 requireValue(standard?.verified===true&&standard.simulated!==true&&standard.programId===programId&&typeof standard.standardVersion==='string'&&typeof standard.requiredSchema==='string'&&standard.receipt?.sha256?.match(/^[0-9a-f]{64}$/)&&typeof standard.receipt.authorityRef==='string','research_standard_unavailable','A current owner-verified research standard is required.',503);
 const questions=v.array(standard.gaps,'Public research gaps',40).map(x=>v.text(x,'Public research question',1000,{empty:false}));
 const categories=v.array(standard.requiredCategories,'Research categories',50).map(x=>v.text(x,'Research category',100,{empty:false}));
 const id=randomUUID();
 // Construct public-only fields explicitly. Do not spread an owner response or
 // include actor identity, entitlement, private stories or premium research text.
 const payload={mission:id,program:{id:programId,name:v.text(program.name,'Program name',500),track:v.text(program.track||'','Program track',300)},policy_version:v.text(standard.standardVersion,'Research standard',100,{empty:false}),questions,required_schema:v.text(standard.requiredSchema,'Package schema',100,{empty:false}),required_categories:categories,execution_requirement:v.text(standard.executionRequirement,'Execution requirement',3000,{empty:false}),source_receipt:{sha256:standard.receipt.sha256,authority_ref:v.text(standard.receipt.authorityRef,'Research authority',1000,{empty:false})}};
 const expiry=standard.expiresAt||null;if(expiry)requireValue(Number.isFinite(Date.parse(expiry))&&Date.parse(expiry)>Date.now(),'research_standard_expired','The current research mission standard has expired.',503);
 const {rows:[prior]}=await db.query("SELECT * FROM iiq.research_missions WHERE owner_id=$1 AND program_id=$2 AND standard_version=$3 AND status IN ('open','submitted') AND (expires_at IS NULL OR expires_at>now()) ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[actor.id,programId,standard.standardVersion]);
 if(prior)return {type:'mission',id:prior.id,mission:prior.public_payload};
 await db.query('INSERT INTO iiq.research_missions(id,owner_id,program_id,standard_version,public_payload,expires_at) VALUES($1,$2,$3,$4,$5::jsonb,$6)',[id,actor.id,programId,standard.standardVersion,JSON.stringify(payload),expiry]);
 return {type:'mission',id,mission:payload};
}
async function submissionUpload(context){
 const {db,actor,data,command,config}=context;
 const repair=command==='submission.repair';v.onlyKeys(data,repair?['submissionId','text']:['missionId','text']);const text=v.text(data.text,'Original research package',128000,{empty:false});
 let parent=null,missionId;
 if(repair){const {rows:[row]}=await db.query('SELECT * FROM iiq.research_submissions WHERE id=$1 AND owner_id=$2',[v.uuid(data.submissionId,'Submission'),actor.id]);if(!row)throw notFound();parent=row;missionId=row.mission_id;}else missionId=v.uuid(data.missionId,'Mission');
 const {rows:[mission]}=await db.query('SELECT * FROM iiq.research_missions WHERE id=$1 AND owner_id=$2 FOR UPDATE',[missionId,actor.id]);if(!mission)throw notFound();
 const provisional=provisionalMission(mission);
 if(provisional)requireResearch(config,actor);else {requireValue(!config?.coreOnly,'coming_soon','Legacy contribution workflows are not active in CORE.',503);student(actor);}
 requireValue(mission.status!=='closed'&&(!mission.expires_at||new Date(mission.expires_at).getTime()>nowOf(context)),'mission_closed','This mission is closed or expired. Obtain the current mission before uploading.',409);
 if(provisional)requireValue(text.isWellFormed()&&!text.includes('\0')&&Buffer.byteLength(text,'utf8')<=128000,'original_not_storable','The original must be valid Unicode without NUL and at most 128,000 UTF-8 bytes. Nothing was saved.');
 const digest=sha(text);const {rows:[existing]}=await db.query('SELECT id FROM iiq.research_submissions WHERE owner_id=$1 AND mission_id=$2 AND sha256=$3',[actor.id,mission.id,digest]);
 if(existing)return {type:'research_submission',id:existing.id,duplicate:true};
 const inspected=provisional?inspectResearchResult(text,mission.public_payload,{now:nowOf(context)}):inspectResearchPackage(text,mission),id=randomUUID(),key=`research:${id}`;
 const stored={_iiq:{original:text,storageKind:'postgres_jsonb',status:inspected.status,reasons:inspected.reasons,executionReceipt:null,version:(parent?.parsed_package?._iiq?.version||0)+1,
  ...(provisional?{eligibleForReview:inspected.eligibleForReview,factsVerified:false,executionVerified:false}:{})},package:inspected.package};
 // The immutable JSONB row is the exact original storage custody. This logical
 // private key is not an S3 object and is never exposed as a download URL.
 await db.query('INSERT INTO iiq.research_submissions(id,owner_id,mission_id,repair_parent_id,original_object_key,sha256,parsed_package) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',[id,actor.id,mission.id,parent?.id||null,`interviewiq/db-original/${id}`,digest,JSON.stringify(stored)]);
 if(provisional?inspected.eligibleForReview:inspected.status==='review'){
  const {rows:[consent]}=await db.query("INSERT INTO iiq.consents(owner_id,scope,subject_ref,status,policy_version) VALUES($1,'research_contribution',$2,'active',$3) RETURNING id",[actor.id,key,mission.standard_version]);
  const excerpt=provisional?'Structurally eligible provisional research package. Submitted evidence remains unverified; open the original for review.':inspected.package.claims.map(c=>c.text).join('\n\n');requireValue(excerpt.length<=30000,'package_excerpt_too_large','Limit the reviewable public claims to 30,000 characters.');
  await db.query("INSERT INTO iiq.review_items(owner_id,submission_id,source_kind,program_id,excerpt,permitted_use,consent_id,request_key) VALUES($1,$2,'research',$3,$4,true,$5,$6)",[actor.id,id,mission.program_id,excerpt,consent.id,key]);
 }
 await db.query("UPDATE iiq.research_missions SET status='submitted' WHERE id=$1",[mission.id]);
 return {type:'research_submission',id,status:inspected.status,reasons:inspected.reasons,...(provisional?{eligibleForReview:inspected.eligibleForReview}:{})};
}
async function provisionalDecision(context,submission,mission){
 const {db,actor,config,data}=context;requireResearch(config,actor);requireAdmin(actor);
 requireValue(submission.parsed_package?._iiq?.eligibleForReview===true,'submission_quarantined','This immutable package needs a clean repair before review.',409);
 const {rows:[review]}=await db.query("SELECT * FROM iiq.review_items WHERE submission_id=$1 AND owner_id=$2 AND program_id=$3 AND source_kind='research' FOR UPDATE",[submission.id,submission.owner_id,mission.program_id]);
 if(!review||!review.permitted_use||!['pending','approved','repair_requested'].includes(review.status))throw notFound();
 requireValue(data.decision==='quality'&&review.publication_status!=='published','coming_soon','Execution verification, credit and canonical publication are coming soon. Nothing was published.',503);
 const status=data.value==='accepted'?'approved':data.value;
 await db.query('UPDATE iiq.review_items SET status=$2,quality_status=$2,admin_note=$3 WHERE id=$1',[review.id,status,data.reason]);
 await auditDecision(db,actor,submission.owner_id,'submission.quality','research_submission',submission.id,{decision:'quality',value:data.value,reason:data.reason});
 return {type:'research_submission',id:submission.id,decision:'quality',quality:status,publicationAvailable:false};
}
async function submissionWithdraw({db,actor,config,data}){
 requireResearch(config,actor);v.onlyKeys(data,['submissionId']);const id=v.uuid(data.submissionId,'Submission');
 const {rows:[submission]}=await db.query('SELECT s.id FROM iiq.research_submissions s JOIN iiq.research_missions m ON m.id=s.mission_id AND m.owner_id=s.owner_id WHERE s.id=$1 AND s.owner_id=$2 AND m.standard_version=$3',[id,actor.id,MRX_VERSION]);
 if(!submission)throw notFound();
 const {rows:[review]}=await db.query("SELECT * FROM iiq.review_items WHERE submission_id=$1 AND owner_id=$2 AND source_kind='research' FOR UPDATE",[id,actor.id]);
 requireValue(review?.publication_status!=='published','coming_soon','Published research retraction requires the canonical owner workflow.',503);
 if(!review||['withdrawn','retracted'].includes(review.status))return {type:'research_submission',id,withdrawn:true,unchanged:true};
 // The existing synchronous consent trigger closes the locked review. Preserve
 // all originals and decisions; no legacy publication or remote outbox action.
 await db.query("UPDATE iiq.consents SET status='revoked',revoked_at=now() WHERE id=$1 AND owner_id=$2 AND status='active'",[review.consent_id,actor.id]);
 await auditDecision(db,actor,actor.id,'submission.withdraw','research_submission',id,{decision:'consent',value:'withdrawn'});
 return {type:'research_submission',id,withdrawn:true};
}
function executionReceipt(receipt,mission,submission){
 requireValue(receipt?.verified===true&&receipt.simulated!==true&&receipt.status==='verified'&&receipt.missionId===mission.id&&receipt.submissionSha256===submission.sha256&&receipt.programId===mission.program_id&&receipt.policyVersion===mission.standard_version&&typeof receipt.receiptId==='string'&&receipt.receiptId.length>0&&typeof receipt.authorityRef==='string'&&receipt.authorityRef.length>0&&/^[0-9a-f]{64}$/.test(receipt.sha256||''),'execution_unverifiable','Execution remains unverifiable; editable provider/model declarations cannot authorize credit.',409);
 return {verified:true,status:'verified',receiptId:v.text(receipt.receiptId,'Receipt',200),authorityRef:v.text(receipt.authorityRef,'Execution authority',1000),sha256:receipt.sha256,missionId:mission.id,programId:mission.program_id,policyVersion:mission.standard_version,submissionSha256:submission.sha256,provider:v.text(receipt.provider,'Verified provider',150,{empty:false}),model:v.text(receipt.model,'Verified model',150,{empty:false}),effort:v.text(receipt.effort,'Verified effort',100,{empty:false})};
}
async function submissionDecide(context){
 const {db,actor,data,owners}=context;requireAdmin(actor);v.onlyKeys(data,['submissionId','decision','value','reason']);const id=v.uuid(data.submissionId,'Submission'),decision=v.choice(data.decision,['execution','quality','publication','credit'],'review decision'),reason=v.text(data.reason,'Decision reason',2000,{empty:false});
 const allowed={execution:['verify','reject'],quality:['accepted','rejected','repair_requested'],publication:['publish','retract'],credit:['grant','revoke']};v.choice(data.value,allowed[decision],'decision value');
 const {rows:[submission]}=await db.query('SELECT * FROM iiq.research_submissions WHERE id=$1',[id]);if(!submission)throw notFound();
 const {rows:[linkedMission]}=await db.query('SELECT * FROM iiq.research_missions WHERE id=$1 AND owner_id=$2',[submission.mission_id,submission.owner_id]);
 if(provisionalMission(linkedMission))return provisionalDecision(context,submission,linkedMission);
 requireValue(!context.config?.coreOnly,'coming_soon','Legacy contribution workflows are not active in CORE.',503);
 requireValue(submission.parsed_package?._iiq?.status==='review','submission_quarantined','This immutable package needs a clean repair before a review decision.',409);
 const {rows:[rawReview]}=await db.query('SELECT id FROM iiq.review_items WHERE submission_id=$1',[id]);if(!rawReview)throw notFound();const review=await reviewRecord(db,rawReview.id);
 requireValue(!['withdrawn','retracted','rejected'].includes(review.status),'review_closed','This review is closed. Submit a repair instead.',409);
 let receipt=null;
 if(decision==='execution'){
  if(data.value==='verify'){
   requireValue(typeof owners?.verifyResearchExecution==='function','execution_verifier_unavailable','The trusted execution verifier is unavailable.',503);
   const {rows:[mission]}=await db.query('SELECT * FROM iiq.research_missions WHERE id=$1',[submission.mission_id]);
   receipt=executionReceipt(await owners.verifyResearchExecution(actor,{mission:{id:mission.id,programId:mission.program_id,standardVersion:mission.standard_version,publicPayload:mission.public_payload},submission:{id:submission.id,sha256:submission.sha256,package:submission.parsed_package.package}}),mission,submission);
  }
  await db.query('UPDATE iiq.review_items SET execution_status=$2,admin_note=$3 WHERE id=$1',[review.id,data.value==='verify'?'verified':'rejected',reason]);
 }else if(decision==='quality'){
  const status=data.value==='accepted'?'approved':data.value;
  if(status==='rejected'||status==='repair_requested')receipt=await retractReviewed(context,review,{status,reason});
  else await db.query('UPDATE iiq.review_items SET quality_status=$2,status=$2,admin_note=$3 WHERE id=$1',[review.id,status,reason]);
 }else if(decision==='publication'){
  if(data.value==='publish'){
   const sourceRefs=submission.parsed_package.package.sources.map(s=>({id:s.id,title:s.title,url:s.url,retrieved_at:s.retrieved_at}));
   receipt=(await publishReviewed(context,review,{sourceRefs})).ownerReceipt||null;
  }else await retractReviewed(context,review,{reason});
 }else{
  if(data.value==='grant'){
   const {rows:[policy]}=await db.query("SELECT * FROM iiq.policies WHERE policy_key='research'");
   const terms=policy?.value?.contributionPolicy;
   requireValue(policy?.value?.contributions===true&&Number.isSafeInteger(terms?.executionCreditUnits)&&terms.executionCreditUnits>0&&Number.isSafeInteger(terms?.programAccessSeconds)&&terms.programAccessSeconds>0,'actual_policy_required','Contribution credit is unavailable until actual reviewed terms are filed.',409);
   // DB independently checks exact approval custody, verified execution/quality,
   // current consent and unique logical mission, including repaired submissions.
   const {rows:[existing]}=await db.query("SELECT * FROM iiq.contribution_credits WHERE owner_id=$1 AND mission_id=$2 AND kind='grant'",[review.owner_id,submission.mission_id]);
   if(existing){
    const {rows:[reversal]}=await db.query("SELECT id FROM iiq.contribution_credits WHERE review_id=$1 AND kind='revoke'",[existing.review_id]);
    requireValue(!reversal,'mission_credit_revoked','This mission credit was permanently revoked; a repair cannot mint replacement units.',409);
    const {rows:[grant]}=await db.query('SELECT * FROM iiq.access_grants WHERE owner_id=$1 AND mission_id=$2 FOR UPDATE',[review.owner_id,submission.mission_id]);
    requireValue(Boolean(grant),'grant_missing','The original grant requires administrator reconciliation.',409);
    if(grant.suspended_at||grant.revoked_at){
     const restored=await restoreContributionGrant(context,grant,review.id);
     await auditDecision(db,actor,review.owner_id,'submission.credit','research_submission',id,{decision,value:'restore',reason,originalCreditId:existing.id,qualifyingReviewId:review.id,...restored});
     return {type:'research_submission',id,duplicateCredit:true,...restored};
    }
    return {type:'research_submission',id,duplicateCredit:true,creditStatus:'granted',grantId:grant.id};
   }
   await db.query("INSERT INTO iiq.contribution_credits(owner_id,review_id,kind,units,policy_version) VALUES($1,$2,'grant',$3,$4)",[review.owner_id,review.id,terms.executionCreditUnits,policy.policy_version]);
   await db.query("INSERT INTO iiq.access_grants(owner_id,program_id,review_id,policy_version,starts_at,expires_at) VALUES($1,$2,$3,$4,now(),now()+($5::bigint*interval '1 second'))",[review.owner_id,review.program_id,review.id,policy.policy_version,terms.programAccessSeconds]);
   await db.query("UPDATE iiq.review_items SET credit_status='granted',admin_note=$2 WHERE id=$1",[review.id,reason]);
  }else{
   await db.query("INSERT INTO iiq.contribution_credits(owner_id,review_id,kind,units,policy_version) SELECT owner_id,review_id,'revoke',units,policy_version FROM iiq.contribution_credits c WHERE owner_id=$1 AND mission_id=$2 AND kind='grant' AND NOT EXISTS(SELECT 1 FROM iiq.contribution_credits r WHERE r.review_id=c.review_id AND r.kind='revoke')",[review.owner_id,submission.mission_id]);
   await db.query('UPDATE iiq.access_grants SET revoked_at=now() WHERE owner_id=$1 AND mission_id=$2 AND revoked_at IS NULL',[review.owner_id,submission.mission_id]);
   await db.query("UPDATE iiq.review_items SET credit_status='revoked',admin_note=$2 WHERE id=$1",[review.id,reason]);
  }
 }
 await auditDecision(db,actor,review.owner_id,`submission.${decision}`,'research_submission',id,{decision,value:data.value,reason,receipt});
 return {type:'research_submission',id,decision,receipt};
}
export async function writeResearch(context){
 if(context.command==='mission.create')return missionCreate(context);
 if(['submission.upload','submission.repair'].includes(context.command))return submissionUpload(context);
 if(context.command==='submission.decide')return submissionDecide(context);
 if(context.command==='submission.withdraw')return submissionWithdraw(context);
 throw new AppError(404,'unknown_command','This research action is unavailable.');
}
