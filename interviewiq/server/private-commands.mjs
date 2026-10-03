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
