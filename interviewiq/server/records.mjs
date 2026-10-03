import { AppError,notFound,requireValue } from './errors.mjs';
import * as v from './validation.mjs';
import { schedule,validDate } from './time.mjs';

export async function syncActor(db,actor) {
  const {rows:[existing]}=await db.query('SELECT id,wp_user_id,display_name FROM iiq.actors WHERE id=$1',[actor.id]);
  if(existing) {
    requireValue(Number(existing.wp_user_id)===actor.wpUserId,'identity_conflict','Your account identity needs reconciliation.',409);
    if(existing.display_name!==actor.displayName)await db.query('UPDATE iiq.actors SET display_name=$2 WHERE id=$1',[actor.id,actor.displayName]);
    return;
  }
  const result=await db.query(`INSERT INTO iiq.actors(id,wp_user_id,display_name) VALUES($1,$2,$3)
    ON CONFLICT(id) DO UPDATE SET display_name=EXCLUDED.display_name
    WHERE actors.wp_user_id=EXCLUDED.wp_user_id RETURNING id`,[actor.id,actor.wpUserId,actor.displayName]);
  requireValue(result.rowCount===1,'identity_conflict','Your account identity needs reconciliation.',409);
}
export async function revision(db,actor) {
  const {rows:[row]}=await db.query('SELECT coalesce(max(revision),0)::text AS revision FROM iiq.revisions WHERE owner_id=$1',[actor.id]);
  const current=Number(row.revision);
  requireValue(Number.isSafeInteger(current),'revision_unavailable','The record version is unavailable.',503);return current;
}
export async function interview(db,actor,id,{own=true,lock=false}={}) {
  v.uuid(id,'Interview');
  const {rows:[row]}=await db.query(`SELECT * FROM iiq.interviews WHERE id=$1 ${own?'AND owner_id=$2':''}${lock?' FOR UPDATE':''}`,own?[id,actor.id]:[id]);
  if(!row)throw notFound();return row;
}
export async function history(db,row,event,details={}) {
  await db.query('INSERT INTO iiq.interview_history(owner_id,interview_id,event_type,details) VALUES($1,$2,$3,$4::jsonb)',[row.owner_id,row.id,event,JSON.stringify(details)]);
}
export function scheduleColumns(input) {
  const data={...input,format:input.format==='in_person'?'in person':input.format||'unknown',joining:input.joining||''};
  const resolved=schedule(data);
  requireValue(!input.allDay || !resolved.instant,'invalid_all_day','A date-only record cannot include a clock time.');
  return {...resolved,format:resolved.format==='in person'?'in_person':resolved.format,all_day:!resolved.instant && Boolean(resolved.date)};
}
export function scheduleValues(x) {
  return [x.date,x.wall?.slice(11,19)||null,x.zone,x.instant,x.fold,x.all_day,x.duration,x.travel_minutes,x.format,x.joining];
}
export function deadline(value) {
  requireValue(value===null || value===undefined || validDate(value),'invalid_deadline','Enter a valid deadline date.');return value||null;
}
export async function ensureDemand(db,row,{refresh=false}={}) {
  const status=row.program_id?'queued':'waiting_identity';
  const {rows:[demand]}=await db.query(`INSERT INTO iiq.research_demands(owner_id,interview_id,program_id,status)
    VALUES($1,$2,$3,$4) ON CONFLICT(interview_id) DO UPDATE SET program_id=EXCLUDED.program_id,
      status=CASE WHEN research_demands.program_id IS DISTINCT FROM EXCLUDED.program_id OR $5 THEN EXCLUDED.status ELSE research_demands.status END,
      requested_at=CASE WHEN $5 THEN now() ELSE research_demands.requested_at END
    RETURNING *`,[row.owner_id,row.id,row.program_id,status,refresh]);
  if(row.program_id && (refresh || status==='queued')) {
    await db.query(`INSERT INTO iiq.outbox_events(owner_id,topic,dedupe_key,payload)
      VALUES($1,'rise.research_requested',$2,$3::jsonb) ON CONFLICT(dedupe_key) DO NOTHING`,
      [row.owner_id,`research:${demand.id}:${row.program_id}:${refresh?demand.version:0}`,JSON.stringify({demandId:demand.id,programId:row.program_id})]);
  }
  return demand;
}
export async function updateGap(db,row) {
  await db.query(`INSERT INTO iiq.mentor_gaps(owner_id,interview_id,research_state,preparation_saved,question_count,practice_count,debrief_state,followup_state)
    SELECT $1::uuid,$2::uuid,
      coalesce((SELECT status FROM iiq.research_demands WHERE interview_id=$2),'waiting_identity'),
      EXISTS(SELECT 1 FROM iiq.preparation WHERE interview_id=$2 AND length(why_program)>0),
      coalesce((SELECT jsonb_array_length(questions) FROM iiq.preparation WHERE interview_id=$2),0),
      (SELECT count(*)::integer FROM iiq.practice_attempts WHERE interview_id=$2 AND status='completed'),
      coalesce((SELECT CASE WHEN occurrence='happened' THEN CASE WHEN structured_data->>'saved'='true' THEN 'complete' ELSE 'in_progress' END
        WHEN occurrence='not_happened' THEN 'not_applicable' ELSE 'not_started' END FROM iiq.debriefs WHERE interview_id=$2),'not_started'),
      CASE WHEN EXISTS(SELECT 1 FROM iiq.followups WHERE interview_id=$2 AND status='open') THEN 'open' ELSE 'none' END
    ON CONFLICT(interview_id) DO UPDATE SET research_state=EXCLUDED.research_state,preparation_saved=EXCLUDED.preparation_saved,
      question_count=EXCLUDED.question_count,practice_count=EXCLUDED.practice_count,debrief_state=EXCLUDED.debrief_state,followup_state=EXCLUDED.followup_state`,[row.owner_id,row.id]);
}

export async function writeInterview({db,actor,command,data,interviewId,owners,config={}}) {
  requireValue(actor.role==='student','student_required','Use your student workspace for this action.',403);
  if(command==='interview.create') {
    v.onlyKeys(data,['unresolved_input','program','programName','track','deadline','schedule','format','joining']);
    const name=v.text(data.unresolved_input||data.programName,'Invitation name',500,{empty:false});
    const manualName=v.text(data.programName===undefined?name:data.programName,'Program name',500,{empty:false});
    const manualTrack=v.text(data.track||'','Track',200);
    const due=deadline(data.deadline);
    const sched=scheduleColumns(data.schedule || {zone:actor.zone,format:data.format,joining:data.joining});
    const program=data.program ? await owners.getProgram(actor,v.text(data.program,'Program ID',180,{empty:false})) : null;
    const {rows:[row]}=await db.query(`INSERT INTO iiq.interviews(owner_id,program_id,program_name,program_track,unresolved_input,deadline_date,
      local_date,local_time,timezone,start_at,fold,all_day,duration_minutes,travel_minutes,format,joining,status,duration_precision)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [actor.id,program?.id||null,program?.name||manualName,program?.track||manualTrack,name,due,...scheduleValues(sched),sched.instant?'scheduled':'offered',sched.duration===null?'unknown':'estimated']);
    if(!config.coreOnly)await ensureDemand(db,row);await history(db,row,'Offer saved',{date:sched.date,timezone:sched.zone});if(!config.coreOnly)await updateGap(db,row);
    return {type:'interview',id:row.id,interviewId:row.id};
  }
  const row=await interview(db,actor,interviewId,{lock:true});
  if(command==='interview.identity') {
    v.onlyKeys(data,['program','programName','track','unresolved_input','deadline']);
    const program=data.program ? await owners.getProgram(actor,v.text(data.program,'Program ID',180,{empty:false})) : null;
    const name=data.unresolved_input===undefined?row.unresolved_input:v.text(data.unresolved_input,'Invitation name',500,{empty:false});
    const due=data.deadline===undefined?row.deadline_date:deadline(data.deadline);
    const manualName=v.text(data.programName===undefined?(row.program_name||name):data.programName,'Program name',500,{empty:false});
    const manualTrack=v.text(data.track===undefined?(row.program_track||''):data.track,'Track',200);
    const {rows:[updated]}=await db.query(`UPDATE iiq.interviews SET program_id=$3,program_name=$4,program_track=$5,unresolved_input=$6,deadline_date=$7
      WHERE id=$1 AND owner_id=$2 RETURNING *`,[row.id,actor.id,program?.id||null,program?.name||manualName,program?.track||manualTrack,name,due]);
    if(!config.coreOnly)await ensureDemand(db,updated);await history(db,row,'Program identity updated',{from:row.program_id,to:program?.id||null});
  } else if(command==='interview.schedule') {
    v.onlyKeys(data,['date','time','zone','allDay','fold','duration','travel_minutes','format','joining']);
    const s=scheduleColumns(data);
    requireValue(!['cancelled','declined','no_show'].includes(row.status),'inactive_interview','Restore this interview before changing its schedule.');
    await db.query(`UPDATE iiq.interviews SET local_date=$3,local_time=$4,timezone=$5,start_at=$6,fold=$7,all_day=$8,
      duration_minutes=$9,travel_minutes=$10,format=$11,joining=$12,joining_verified=false,
      status=$13,duration_precision=$14,previous_schedule='{}'::jsonb WHERE id=$1 AND owner_id=$2`,[row.id,actor.id,...scheduleValues(s),s.instant?'scheduled':'offered',s.duration===null?'unknown':'estimated']);
    await history(db,row,'Schedule updated',{previous:{date:row.local_date,instant:row.start_at,timezone:row.timezone},current:{date:s.date,instant:s.instant,timezone:s.zone}});
  } else if(command==='interview.lifecycle') {
    v.onlyKeys(data,['action']);v.choice(data.action,['cancel','restore','decline','postpone','waitlist','joining-verified'],'lifecycle action');
    if(data.action==='joining-verified') await db.query('UPDATE iiq.interviews SET joining_verified=true WHERE id=$1 AND owner_id=$2',[row.id,actor.id]);
    else if(data.action==='restore') {
      requireValue(['cancelled','declined','postponed','waitlisted','no_show'].includes(row.status),'not_inactive','This interview does not need restoration.');
      const restored=row.previous_schedule?.status || (row.start_at?'scheduled':'offered');
      await db.query(`UPDATE iiq.interviews SET status=$3,previous_schedule='{}'::jsonb WHERE id=$1 AND owner_id=$2`,[row.id,actor.id,restored]);
    } else {
      const status={cancel:'cancelled',decline:'declined',postpone:'postponed',waitlist:'waitlisted'}[data.action];
      requireValue(row.status!=='completed' || ['cancel','decline'].includes(data.action),'completed_interview','Correct whether the interview happened before postponing or waitlisting it.');
      if(row.status!==status)await db.query('UPDATE iiq.interviews SET status=$3,previous_schedule=$4::jsonb WHERE id=$1 AND owner_id=$2',[row.id,actor.id,status,JSON.stringify({status:row.status})]);
    }
    await history(db,row,`Lifecycle: ${data.action}`,{});
  } else if(command==='event.create' || command==='event.update') {
    if(command==='event.update' && data.action!==undefined) {
      v.onlyKeys(data,['eventId','action']);v.choice(data.action,['cancel','restore'],'event action');
      const result=await db.query('UPDATE iiq.related_events SET status=$4 WHERE owner_id=$1 AND interview_id=$2 AND id=$3 RETURNING id',[actor.id,row.id,v.uuid(data.eventId,'Event'),data.action==='cancel'?'cancelled':'scheduled']);
      if(result.rowCount!==1)throw notFound();
      await history(db,row,`Related event ${data.action==='cancel'?'cancelled':'restored'}`,{eventId:result.rows[0].id});
      return {type:'event',id:result.rows[0].id,interviewId:row.id};
    }
    v.onlyKeys(data,['kind','date','time','zone','fold','duration_minutes','note','eventId']);
    const s=scheduleColumns({date:data.date,time:data.time,zone:data.zone,fold:data.fold,duration:data.duration_minutes});
    requireValue(Boolean(s.date),'date_required','Choose a date for the related event.');
    const label=v.text(data.kind,'Event type',80,{empty:false}),note=v.text(data.note??'','Event note',2000);
    const kind=/social/i.test(label)?'social':/deadline/i.test(label)?'deadline':'other';
    const values=[actor.id,row.id,kind,label,s.date,s.wall?.slice(11,19)||null,s.zone,s.instant,s.fold,s.all_day,s.duration];
    let result;
    if(command==='event.create') result=await db.query(`INSERT INTO iiq.related_events(owner_id,interview_id,kind,title,local_date,local_time,timezone,start_at,fold,all_day,duration_minutes,note)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,[...values,note]);
    else result=await db.query(`UPDATE iiq.related_events SET kind=$3,title=$4,local_date=$5,local_time=$6,timezone=$7,start_at=$8,fold=$9,all_day=$10,duration_minutes=$11,note=$12
      WHERE owner_id=$1 AND interview_id=$2 AND id=$13 AND status='scheduled' RETURNING id`,[...values,note,v.uuid(data.eventId,'Event')]);
    if(result.rowCount!==1)throw notFound();
    await history(db,row,command==='event.create'?'Related event added':'Related event updated',{eventId:result.rows[0].id,date:s.date,timezone:s.zone});
    return {type:'event',id:result.rows[0].id,interviewId:row.id};
  } else if(command==='research.refresh') {
    v.onlyKeys(data,[]);requireValue(Boolean(row.program_id),'identity_required','Confirm the exact program first.');await ensureDemand(db,row,{refresh:true});
    await history(db,row,'Research refresh requested',{});
  } else throw new AppError(404,'unknown_command','This action is unavailable.');
  if(!config.coreOnly)await updateGap(db,row);return {type:'interview',id:row.id,interviewId:row.id};
}
