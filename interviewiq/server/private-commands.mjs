import {AUTHORED_GUARD,authoredReview} from './loi-prose-contract.mjs';
import {qualifyLoiEvidence} from './loi-evidence.mjs';
import {ownedTarget,targetLetterAllowed} from './loi-targets.mjs';
import {randomUUID} from 'node:crypto';
import {projectProgramResearch} from './rise-owner.mjs';
import { AppError,notFound,requireValue } from './errors.mjs';
import * as v from './validation.mjs';
import {interview} from './records.mjs';

export async function writeLearning({db,actor,interviewId,command,data}) {
  requireValue(actor.role==='student','student_required','Use your student workspace for this action.',403);
  if(interviewId)await interview(db,actor,interviewId);
  if(command==='learning.propose') {
    v.onlyKeys(data,['goal','source']);const goal=v.text(data.goal,'Practice goal',4000,{empty:false});
    v.choice(data.source,['student-entered'],'learning source');
    const {rows:[row]}=await db.query(`INSERT INTO iiq.learning_signals(owner_id,interview_id,source_kind,statement,next_change)
      VALUES($1,$2,'student',$3,$3) RETURNING id`,[actor.id,interviewId,goal]);return {type:'learning',id:row.id};
  }
  const {rows:[row]}=await db.query('SELECT * FROM iiq.learning_signals WHERE owner_id=$1 ORDER BY updated_at DESC,id LIMIT 1 FOR UPDATE',[actor.id]);
  if(!row)throw notFound();
  if(command==='learning.confirm') {
    v.onlyKeys(data,[]);
    await db.query(`UPDATE iiq.learning_signals SET status='revoked',revoked_at=now(),mentor_visible=false WHERE owner_id=$1 AND id<>$2 AND status='confirmed'`,[actor.id,row.id]);
    await db.query(`UPDATE iiq.learning_signals SET status='confirmed',confirmed_at=now(),revoked_at=null WHERE id=$1 AND owner_id=$2`,[row.id,actor.id]);
  } else if(command==='learning.correct') {
    v.onlyKeys(data,['goal']);const goal=v.text(data.goal,'Practice goal',4000,{empty:false});
    await db.query(`UPDATE iiq.learning_signals SET statement=$3,next_change=$3,status='proposed',mentor_visible=false,confirmed_at=null,revoked_at=null WHERE id=$1 AND owner_id=$2`,[row.id,actor.id,goal]);
  } else if(command==='learning.revoke') {
    v.onlyKeys(data,[]);await db.query(`UPDATE iiq.learning_signals SET status='revoked',mentor_visible=false,revoked_at=now() WHERE id=$1 AND owner_id=$2`,[row.id,actor.id]);
  } else if(command==='learning.mentor') {
    v.onlyKeys(data,['visible']);const visible=v.boolean(data.visible,'Mentor visibility');
    requireValue(!visible || row.status==='confirmed','confirmation_required','Confirm this learning before sharing a preparation gap.');
    await db.query('UPDATE iiq.learning_signals SET mentor_visible=$3 WHERE id=$1 AND owner_id=$2',[row.id,actor.id,visible]);
  } else throw new AppError(404,'unknown_command','This action is unavailable.');
  return {type:'learning',id:row.id};
}
export async function writeConsent({db,actor,command,data,owners,requestId}) {
  requireValue(actor.role==='student','student_required','Use your student workspace for this action.',403);
  const story=command==='story.consent';
  v.onlyKeys(data,story?['storyId','consent']:['consent']);
  const granted=v.boolean(data.consent,'Permission'),ref=story?v.text(data.storyId,'Story',180,{empty:false}):'season';
  if(story)await owners.storyConsent(actor,ref,granted,requestId);
  const {rows:[row]}=await db.query(`INSERT INTO iiq.consents(owner_id,scope,subject_ref,status,policy_version,revoked_at)
    VALUES($1,$2,$3,$4,$5,CASE WHEN $4='revoked' THEN now() ELSE null END)
    ON CONFLICT(owner_id,scope,subject_ref) DO UPDATE SET status=EXCLUDED.status,
      revoked_at=EXCLUDED.revoked_at,granted_at=CASE WHEN EXCLUDED.status='active' THEN now() ELSE consents.granted_at END RETURNING id`,
    [actor.id,story?'storyforge':'ranklist',ref,granted?'active':'revoked',story?'iiq-story-context-v1':'iiq-rank-consent-v1']);
  if(story && !granted) {
    // Retain the student's own prose, but remove revoked provenance and every
    // future practice context derived from that StoryForge grant.
    await db.query(`UPDATE iiq.preparation SET basis=(basis-'story'),context_revision=context_revision+1
      WHERE owner_id=$1 AND basis->>'story'=$2`,[actor.id,ref]);
    await db.query(`UPDATE iiq.practice_attempts SET context_basis=(context_basis-'story'),status='revoked'
      WHERE owner_id=$1 AND context_basis->>'story'=$2`,[actor.id,ref]);
  }
  return {type:'consent',id:row.id};
}
export async function writeShare({db,actor,interviewId,command,data,requestId}) {
  requireValue(actor.role==='student','student_required','Use your student workspace for this action.',403);
  if(command==='share.retract') {
    v.onlyKeys(data,['reviewId']);const id=v.uuid(data.reviewId,'Review');
    const {rows:[row]}=await db.query('SELECT * FROM iiq.review_items WHERE id=$1 AND owner_id=$2 FOR UPDATE',[id,actor.id]);
    if(!row)throw notFound();
    if(!['withdrawn','retracted'].includes(row.status)) {
      await db.query(`UPDATE iiq.consents SET status='revoked',revoked_at=now() WHERE id=$1 AND owner_id=$2`,[row.consent_id,actor.id]);
      // The consent trigger withdraws the review and retracts derived records
      // atomically. A second write would violate its terminal-state guard.
      await db.query(`INSERT INTO iiq.outbox_events(owner_id,topic,dedupe_key,payload) VALUES($1,'rise.report_retracted',$2,$3::jsonb)
        ON CONFLICT(dedupe_key) DO NOTHING`,[actor.id,`retract:${row.id}`,JSON.stringify({reviewId:row.id,programId:row.program_id})]);
    }
    return {type:'review',id:row.id,interviewId:row.interview_id};
  }
  v.onlyKeys(data,['excerpt','permitted','deidentified']);
  const row=await interview(db,actor,interviewId,{lock:true});
  requireValue(Boolean(row.program_id),'identity_required','Confirm the program before sharing a report.');
  const {rows:[debrief]}=await db.query('SELECT occurrence FROM iiq.debriefs WHERE interview_id=$1 AND owner_id=$2',[row.id,actor.id]);
  requireValue(debrief?.occurrence==='happened','occurrence_required','Only an interview you confirm happened can become an experience report.');
  const excerpt=v.text(data.excerpt,'Selected excerpt',3000,{empty:false});
  requireValue(v.boolean(data.permitted,'Permitted use') && v.boolean(data.deidentified,'De-identification'),'permission_required','Confirm permitted use and remove identifying details before review.');
  const key=`excerpt:${row.id}:${v.digest({excerpt})}`;
  const {rows:[previous]}=await db.query('SELECT id,status FROM iiq.review_items WHERE owner_id=$1 AND request_key=$2',[actor.id,key]);
  if(previous) {
    requireValue(!['withdrawn','retracted'].includes(previous.status),'previously_retracted','This exact excerpt was withdrawn. Edit it before making a new submission.');
    return {type:'review',id:previous.id,interviewId:row.id};
  }
  const {rows:[consent]}=await db.query(`INSERT INTO iiq.consents(owner_id,scope,subject_ref,status,policy_version)
    VALUES($1,'program_intelligence',$2,'active','iiq-permitted-excerpt-v1') RETURNING id`,[actor.id,key]);
  const {rows:[review]}=await db.query(`INSERT INTO iiq.review_items(owner_id,interview_id,source_kind,program_id,excerpt,permitted_use,consent_id,request_key)
    VALUES($1,$2,'debrief',$3,$4,true,$5,$6) RETURNING id`,[actor.id,row.id,row.program_id,excerpt,consent.id,key]);
  return {type:'review',id:review.id,interviewId:row.id};
}

// LOI entries are append-only private preparation anchors; legacy entries remain intact.
export function loiEnabled(config,actor){const l=config.loi,mode=l?.mode??'CANARY';return l?.enabled===true&&['CANARY','ELIGIBLE'].includes(mode)&&actor.role==='student'&&actor.eligible===true&&['360','ivprep_complete'].includes(actor.tier)&&(mode!=='CANARY'||Boolean(l.ownerId&&l.programId))&&(!l.ownerId||actor.id===l.ownerId);}
export function loiCanonicalLookup(config,actor){return config.loi?.mode==='ELIGIBLE'&&loiEnabled(config,actor);}
export function loiProgramAllowed(config,actor,programId){return loiEnabled(config,actor)&&typeof programId==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$(?![\s\S])/.test(programId)&&(!config.loi.programId||programId===config.loi.programId);}
export function loiInterviewAllowed(config,actor,row){return row?.owner_id===actor.id&&loiProgramAllowed(config,actor,row.program_id);}
export function requireLoi(config,actor){requireValue(loiEnabled(config,actor),'loi_unavailable','Letters of Interest are not available for this workspace.',403);}
const revisionType='iiq.loi.revision',outreachType='iiq.loi.outreach';
const known=(x,row)=>x&&[revisionType,outreachType].includes(x.type)&&(row?.targetKind==='program'?x.schemaVersion===2&&x.targetKind==='program'&&x.targetId===row.id:x.schemaVersion===1);
export async function loiSubject(ctx,lock=false){if(ctx.targetKind==='program'){const row=await ownedTarget(ctx,lock);requireValue(targetLetterAllowed(ctx.config,ctx.actor,row),'loi_program_unavailable','Resolve a current enabled canonical program first.',403);return {...row,targetKind:'program'};}return interview(ctx.db,ctx.actor,ctx.interviewId,{lock});}

export function loiHistory(anchors,row,consents=null){
  const history=(anchors||[]).filter(x=>x&&[revisionType,outreachType].includes(x.type)).map(x=>known(x,row)?x:{type:x.type,schemaVersion:x.schemaVersion,unavailable:true});
  const revisions=history.filter(x=>x.type===revisionType&&!x.unavailable),current=revisions.at(-1)||null;
  const consentValid=e=>consents===null?null:(e.storyRefs||[]).every(r=>consents.some(c=>c.subject_ref===r.id&&c.status==='active'));
  return {history,current,currentConsentValid:current?consentValid(current):null,consentInvalidRevisionIds:consents===null?[]:revisions.filter(e=>!consentValid(e)).map(e=>e.revisionId),outreach:history.filter(x=>x.type===outreachType&&!x.unavailable),currentBindingValid:Boolean(current&&(row.targetKind==='program'?current.targetKind==='program'&&current.targetId===row.id&&current.program.registryReleaseId===row.registry_release_id:current.interviewId===row.id)&&current.program.id===row.program_id&&current.program.name===row.program_name&&current.program.track===(row.program_track||''))};
}
export async function readLoi(ctx){
  const {db,actor,config}=ctx;requireLoi(config,actor);const row=await loiSubject(ctx);requireValue(loiInterviewAllowed(config,actor,row),'loi_program_unavailable','Use an enabled attached canonical program.',403);
  const prep=row.targetKind==='program'?row:(await db.query('SELECT anchors FROM iiq.preparation WHERE owner_id=$1 AND interview_id=$2',[actor.id,row.id])).rows[0];const {rows:consents}=await db.query("SELECT subject_ref,status FROM iiq.consents WHERE owner_id=$1 AND scope='storyforge'",[actor.id]);return {...(row.targetKind==='program'?{targetKind:'program',targetId:row.id}:{interviewId:row.id}),...loiHistory(prep?.anchors,row,consents)};
}
async function loiProgram(owners,actor,row){const p=await owners.getProgram(actor,row.program_id);requireValue(p.id===row.program_id&&p.name===row.program_name&&p.track===(row.program_track||'')&&typeof p.registryReleaseId==='string'&&(!row.targetKind||p.registryReleaseId===row.registry_release_id),'loi_binding_changed','The current program identity changed. Reconfirm a new draft.',409);return p;}
export async function loiEvidence(ctx){
  const {db,actor,config,owners,clock=()=>new Date()}=ctx;requireLoi(config,actor);const row=await loiSubject(ctx);requireValue(loiInterviewAllowed(config,actor,row),'loi_program_unavailable','Use an enabled attached canonical program.',403);
  const program=await loiProgram(owners,actor,row),research=projectProgramResearch(await owners.getProgramResearch(actor,row.program_id),program,clock().getTime());return {type:'loi_evidence',program,research};
}
function confirmations(data){return {studentFactualConfirmation:v.boolean(data.studentFactualConfirmation,'Factual review'),studentSpecificityConfirmation:v.boolean(data.studentSpecificityConfirmation,'Program specificity review')};}
function inputs(items,label){return v.array(items,label,20).map(x=>{v.onlyKeys(x,['id','text','confirmed']);return {id:v.uuid(x.id,label),text:v.text(x.text,label,4000,{empty:false}),confirmed:v.boolean(x.confirmed,label)};});}
function selections(items){const out=v.array(items,'Program evidence',21).map(x=>{v.onlyKeys(x,['field','claimRef']);return {field:v.text(x.field,'Evidence field',100,{empty:false}),claimRef:v.text(x.claimRef,'Evidence reference',100,{empty:false})};});requireValue(new Set(out.map(x=>x.field)).size===out.length,'loi_duplicate_evidence','Select each field once.');return out;}
function strings(value){if(typeof value==='string')return [value];if(Array.isArray(value))return value.flatMap(strings);if(value&&typeof value==='object')return Object.values(value).flatMap(strings);return [];}
export function loiChecks(entry){
  const reasons=[];const confirmed=[...entry.motivations,...entry.facts].every(x=>x.confirmed)&&entry.context.whyNow.trim()&&entry.context.applicationState.trim()&&entry.context.interviewState.trim();
  if(!confirmed)reasons.push('Confirm every student fact, reason and context.');
  const linked=entry.motivations.some(x=>x.confirmed&&entry.text.includes(x.text));
  const detail=entry.evidence.some(x=>strings(x.value).some(s=>s.trim().length>=8&&entry.text.includes(s)));
  let specificity=entry.text.includes(entry.program.name)&&linked&&detail;
  if(entry.authoredComposition){try{requireValue(entry.authoredComposition.schema===1&&entry.authoredComposition.guard===AUTHORED_GUARD,'loi_authored_review','Use a compatible authored draft.');authoredReview(entry.text,entry.authoredComposition.refs,entry.program);specificity=true;}catch{specificity=false;}if(entry.state==='approved'&&entry.authoredComposition.studentSourceVerification!==true)reasons.push('Verify every authored factual statement against the governed sources before approval.');}
  if(!specificity)reasons.push('Include the program name, a confirmed personal reason and a selected supported detail.');
  const provenance=entry.evidence.length>0&&Boolean(entry.evidenceDigest);
  if(!provenance)reasons.push('Select current supported RISE evidence.');
  if(!entry.studentFactualConfirmation||!entry.studentSpecificityConfirmation)reasons.push('Review factual accuracy and confirm this letter would change for another program.');
  return {provenance,specificity,reasons,studentFactualConfirmation:entry.studentFactualConfirmation,studentSpecificityConfirmation:entry.studentSpecificityConfirmation};
}
export async function evidenceFor(ctx,selected){const r=await loiEvidence(ctx);const evidence=selected.map(x=>{const f=r.research.facts.find(f=>f.field===x.field&&f.claimRef===x.claimRef);requireValue(f&&f.state==='SUPPORTED','loi_evidence_changed','Selected evidence is unavailable or changed. Select current evidence again.',409);return f;});return {program:r.program,evidence,evidenceDigest:v.digest({program:r.program,evidence}),resultDigest:r.research.receipt.sha256,coverageDigest:r.research.coverage.receipt.sha256,observedAt:r.research.coverage.observedAt};}
async function consentCheck(db,actor,refs){for(const ref of refs){const {rows:[c]}=await db.query("SELECT status FROM iiq.consents WHERE owner_id=$1 AND scope='storyforge' AND subject_ref=$2",[actor.id,ref.id]);requireValue(c?.status==='active','loi_consent_required','A referenced StoryForge permission is no longer active. Remove it and review a new draft.',409);}}
export function headCheck(data,current){requireValue(data.expectedHead===(current?.revisionId??null)&&data.expectedLetterVersion===(current?.letterVersion??0),'loi_head_conflict','This letter changed. Your unsaved text is kept; review its latest revision.',409);if(current)requireValue(data.letterId===current.letterId,'loi_letter_conflict','Use the current attached letter.',409);else requireValue(data.letterId===null,'loi_letter_conflict','Start a new attached letter.');}
async function currentApproval(ctx,current,data){requireValue(current?.state==='approved'&&current.contentHash===data.contentHash&&current.approval?.contentHash===current.contentHash,'loi_approval_required','Use the exact approved letter.',409);const fresh=await evidenceFor(ctx,current.selectedEvidence);requireValue(v.digest(fresh.program)===v.digest(current.program)&&fresh.evidenceDigest===current.evidenceDigest&&current.approval.evidenceDigest===fresh.evidenceDigest,'loi_evidence_changed','Program evidence changed; review a fresh draft.',409);if(current.authoredComposition)requireValue(qualifyLoiEvidence(fresh,ctx.config.loiComposition?.evidencePins).allowed,'loi_research_needed','Authored program facts require current independent claim-level source review.',409);await consentCheck(ctx.db,ctx.actor,current.storyRefs);requireValue(loiChecks(current).reasons.length===0,'loi_review_required','Review this letter before using it.');}
export function loiHandoff({recipient,subject,text}){
  v.text(recipient,'Recipient',254,{empty:false});requireValue(/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(recipient),'loi_recipient_invalid','Enter one plain recipient email address.');
  v.text(subject,'Subject',300,{empty:false});requireValue(!/[\u0000-\u001f\u007f]/.test(subject),'loi_subject_invalid','Use a plain single-line subject.');
  const gmail=new URL('https://mail.google.com/mail/');gmail.search=new URLSearchParams({view:'cm',fs:'1',to:recipient,su:subject,body:text}).toString();const mailto='mailto:'+encodeURIComponent(recipient)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(text);
  const copyOnly=Math.max(Buffer.byteLength(gmail.href),Buffer.byteLength(mailto))>8192;return {recipient,subject,text,gmailUrl:copyOnly?null:gmail.href,mailtoUrl:copyOnly?null:mailto,copyOnly,reason:copyOnly?'The full letter exceeds the compose URL limit. Copy the complete letter and paste it into your chosen email account.':null};
}
export async function writeLoi(ctx){
  const {db,actor,interviewId,config,data,command,owners,clock=()=>new Date()}=ctx;requireLoi(config,actor);
  const row=await loiSubject(ctx,true);requireValue(loiInterviewAllowed(config,actor,row),'loi_program_unavailable','Use an enabled attached canonical program.',403);
  const prep=row.targetKind==='program'?row:(await db.query('SELECT * FROM iiq.preparation WHERE owner_id=$1 AND interview_id=$2 FOR UPDATE',[actor.id,row.id])).rows[0];
  if(row.targetKind==='program')requireValue(row.target_choice==='CREATE_LETTER','loi_target_choice','Choose Create Letter explicitly before changing or using a letter.',409);const anchors=prep?.anchors||[],current=loiHistory(anchors,row).current;
  requireValue(!anchors.some(x=>x&&[revisionType,outreachType].includes(x.type)&&!known(x,row)),'loi_future_schema','A newer letter history needs a compatible application before editing.',409);
  const base=['letterId','expectedHead','expectedLetterVersion'];let entry,handoff;
  if(command==='loi.save'){
    v.onlyKeys(data,[...base,'text','context','motivations','facts','storyRefs','selectedEvidence','studentFactualConfirmation','studentSpecificityConfirmation','compositionApproach','compositionContextConfirmation']);headCheck(data,current);v.onlyKeys(data.context,['whyNow','applicationState','interviewState']);
    const context=Object.fromEntries(['whyNow','applicationState','interviewState'].map(k=>[k,v.text(data.context[k],k,2000)])),selectedEvidence=selections(data.selectedEvidence),storyRefs=v.array(data.storyRefs||[],'Story references',20).map(x=>{v.onlyKeys(x,['id']);return {id:v.text(x.id,'Story reference',180,{empty:false})};});
    let e={program:{id:row.program_id,name:row.program_name,track:row.program_track||'',registryReleaseId:row.targetKind==='program'?row.registry_release_id:null},evidence:[],evidenceDigest:null,resultDigest:null,coverageDigest:null,observedAt:null};
    try{e=await evidenceFor(ctx,selectedEvidence);}catch(error){if(selectedEvidence.length)throw error;}
    let compositionApproach=current?.compositionApproach;if(data.compositionApproach!==undefined){requireValue(config.loiComposition?.enabled===true,'loi_composition_unavailable','Composition preferences are not enabled.',403);compositionApproach=v.choice(data.compositionApproach,['WARM_PERSONAL','DIRECT_CONCISE','ACADEMIC_PROGRAM','POST_INTERVIEW','UPDATE_LED','STRONG_INTEREST'],'Composition approach');}else if(!current&&config.loiComposition?.enabled===true){const {rows:[preference]}=await db.query('SELECT default_approach FROM iiq.loi_preferences WHERE owner_id=$1',[actor.id]);compositionApproach=preference?.default_approach??'DIRECT_CONCISE';}
    let compositionContextConfirmation=current?.compositionContextConfirmation;if(compositionApproach==='POST_INTERVIEW'||compositionApproach==='UPDATE_LED'){v.onlyKeys(data.compositionContextConfirmation??current?.compositionContextConfirmation??{},['postInterviewOccurred','updateConfirmed']);compositionContextConfirmation=data.compositionContextConfirmation??current?.compositionContextConfirmation;for(const key of ['postInterviewOccurred','updateConfirmed'])if(Object.hasOwn(compositionContextConfirmation??{},key))v.boolean(compositionContextConfirmation[key],'Approach context');requireValue(compositionApproach==='POST_INTERVIEW'?compositionContextConfirmation?.postInterviewOccurred===true:compositionContextConfirmation?.updateConfirmed===true&&data.facts.some(x=>x.confirmed===true),'loi_approach_confirmation','Confirm the interview occurrence or current update before using this approach.');}
    entry={type:revisionType,schemaVersion:row.targetKind==='program'?2:1,revisionId:randomUUID(),letterId:current?.letterId||randomUUID(),parentRevisionId:current?.revisionId||null,letterVersion:(current?.letterVersion||0)+1,createdAt:clock().toISOString(),...(row.targetKind==='program'?{targetKind:'program',targetId:row.id}:{interviewId:row.id}),state:'draft',text:v.text(data.text,'Letter',20000,{empty:false}),context,motivations:inputs(data.motivations,'Motivation'),facts:inputs(data.facts,'Student fact'),storyRefs,selectedEvidence,...e,...confirmations(data),approval:null,...(compositionApproach===undefined?{}:{compositionApproach,...(compositionContextConfirmation?{compositionContextConfirmation}:{})})};
    if(ctx.authoredComposition||current?.authoredComposition){
      const origin=ctx.authoredComposition??current.authoredComposition;requireValue(origin.schema===1&&origin.guard===AUTHORED_GUARD,'loi_authored_review','Use a compatible authored draft.');
      const refs=[{ref:'program',text:entry.program.name,kind:'identity'},...Object.entries(context).map(([k,text])=>({ref:'context:'+k,text,kind:'context'})),...entry.motivations.map((x,i)=>({ref:'reason:'+i,text:x.text,kind:'reason'})),...entry.facts.map((x,i)=>({ref:'fact:'+i,text:x.text,kind:'fact'})),...(origin.refs||[]).filter(r=>r.ref==='positionContext'),...entry.evidence.map((e,i)=>({ref:'evidence:'+i,text:strings(e.value).filter(s=>s.trim().length>=8).join('\n'),kind:'evidence',field:e.field,claimRef:e.claimRef,sources:e.sources,asOf:e.asOf}))];
      const retainedClaims=origin.originalTextDigest===v.digest(entry.text)&&v.digest(origin.refs)===v.digest(refs)?origin.originalClaims:null;
      entry.authoredComposition={schema:1,guard:AUTHORED_GUARD,generationId:origin.generationId,originalTextDigest:origin.originalTextDigest,originalClaims:origin.originalClaims,refs,review:authoredReview(entry.text,refs,entry.program,retainedClaims),studentSourceVerification:false};
    }
    entry.contentHash=v.digest({... (row.targetKind==='program'?{targetKind:'program',targetId:row.id}:{}),text:entry.text,context,motivations:entry.motivations,facts:entry.facts,storyRefs,program:entry.program,evidence:entry.evidence,...(entry.authoredComposition?{authoredBindings:{schema:1,guard:AUTHORED_GUARD,generationId:entry.authoredComposition.generationId,refs:entry.authoredComposition.refs}}:{} )});entry.checks=loiChecks(entry);
  }else{
    v.onlyKeys(data,[...base,'contentHash',...(command==='loi.approve'?['studentFactualConfirmation','studentSpecificityConfirmation','studentSourceVerification']:command==='loi.handoff'?['recipient','subject','channel','recipientConfirmed']:['handoffId','confirmed'])]);headCheck(data,current);requireValue(current&&current.contentHash===data.contentHash,'loi_content_conflict','Review the exact saved content.',409);
    if(command==='loi.approve'){
      requireValue(current.state==='draft','loi_draft_required','Select the current draft.');const e=await evidenceFor(ctx,current.selectedEvidence);requireValue(v.digest(e.program)===v.digest(current.program)&&e.evidenceDigest===current.evidenceDigest,'loi_evidence_changed','Evidence changed. Review and save a fresh draft.',409);await consentCheck(db,actor,current.storyRefs);
      if(current.authoredComposition){requireValue(data.studentSourceVerification===true,'loi_source_verification_required','Verify every authored clause against the original governed sources and your confirmed facts; AI traces are not factual certification.',409);requireValue(qualifyLoiEvidence(e,config.loiComposition?.evidencePins).allowed,'loi_research_needed','Current independent claim-level source review is required.',409);authoredReview(current.text,current.authoredComposition.refs,current.program);}
      entry={...current,...confirmations(data),revisionId:randomUUID(),parentRevisionId:current.revisionId,letterVersion:current.letterVersion+1,createdAt:clock().toISOString(),state:'approved',...(current.authoredComposition?{authoredComposition:{...current.authoredComposition,studentSourceVerification:true,verifiedContentHash:current.contentHash}}:{})};entry.checks=loiChecks(entry);requireValue(entry.checks.reasons.length===0,'loi_review_required',entry.checks.reasons.join(' '));entry.approval={approvedAt:entry.createdAt,contentHash:entry.contentHash,evidenceDigest:entry.evidenceDigest};
    }else{
      await currentApproval(ctx,current,data);const history=loiHistory(anchors,row).outreach;
      if(command==='loi.handoff'){
        requireValue(v.boolean(data.recipientConfirmed,'Recipient review'),'loi_recipient_review','Confirm this destination.');v.choice(data.channel,['gmail','mailto','copy'],'handoff channel');handoff=loiHandoff({recipient:data.recipient,subject:data.subject,text:current.text});
        entry={type:outreachType,schemaVersion:row.targetKind==='program'?2:1,...(row.targetKind==='program'?{targetKind:'program',targetId:row.id}:{}),handoffId:randomUUID(),eventId:randomUUID(),recordedAt:clock().toISOString(),letterId:current.letterId,revisionId:current.revisionId,contentHash:current.contentHash,evidenceDigest:current.evidenceDigest,recipient:data.recipient,subject:data.subject,channel:data.channel,state:'prepared'};handoff.handoffId=entry.handoffId;
      }else{
        requireValue(command==='loi.mark_sent'&&v.boolean(data.confirmed,'Self-reported sending'),'loi_sent_confirmation','Confirm that you sent the letter yourself.');v.uuid(data.handoffId,'Handoff');const h=history.find(x=>x.handoffId===data.handoffId&&x.state==='prepared');requireValue(h&&h.revisionId===current.revisionId&&h.contentHash===current.contentHash&&h.evidenceDigest===current.evidenceDigest,'loi_handoff_changed','Review a current handoff first.',409);requireValue(!history.some(x=>x.handoffId===h.handoffId&&x.state==='self_reported_sent'),'loi_already_marked','This handoff was already marked as sent.',409);entry={...h,eventId:randomUUID(),recordedAt:clock().toISOString(),state:'self_reported_sent'};
      }
    }
  }
  requireValue(Buffer.byteLength(JSON.stringify(entry))<=131072,'loi_entry_too_large','This letter entry is too large. Nothing was truncated.',413);
  // UPDATE only anchors; all legacy preparation values and the full array prefix survive.
  const {rows:[saved]}=row.targetKind==='program'?await db.query('UPDATE iiq.loi_targets SET anchors=anchors||$3::jsonb,version=version+1,updated_at=$4 WHERE owner_id=$1 AND id=$2 RETURNING id',[actor.id,row.id,JSON.stringify([entry]),clock()]):await db.query(`INSERT INTO iiq.preparation(owner_id,interview_id,anchors) VALUES($1,$2,$3::jsonb) ON CONFLICT(interview_id) DO UPDATE SET anchors=iiq.preparation.anchors||$4::jsonb WHERE preparation.owner_id=$1 RETURNING id`,[actor.id,row.id,JSON.stringify([entry]),JSON.stringify([entry])]);requireValue(saved,'loi_save_failed','The letter could not be saved.');
  return {type:'loi',id:entry.type===outreachType?entry.eventId:entry.revisionId,...(row.targetKind==='program'?{targetKind:'program',targetId:row.id}:{interviewId:row.id}),...(handoff?{handoff}:{})};
}

export async function replayLoiHandoff(ctx,id){if(ctx.targetKind==='program'){const row=await loiSubject(ctx);requireValue(row.target_choice==='CREATE_LETTER','loi_target_choice','Choose Create Letter explicitly before changing or using a letter.',409);}const own=await readLoi(ctx),h=own.outreach.find(x=>x.eventId===id&&x.state==='prepared');if(!h)return {};await currentApproval(ctx,own.current,{contentHash:h.contentHash});requireValue(h.revisionId===own.current.revisionId,'loi_handoff_changed','This handoff is historical.',409);return {handoff:{...loiHandoff({recipient:h.recipient,subject:h.subject,text:own.current.text}),handoffId:h.handoffId}};}
