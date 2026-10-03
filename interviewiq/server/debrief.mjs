import { AppError,requireValue } from './errors.mjs';
import * as v from './validation.mjs';
import {interview,updateGap} from './records.mjs';

const fields={
  individual_count:['1','2','3','4+','unknown','prefer not to say'],
  individual_duration:['under 15 min','15–30 min','over 30 min','estimated ~20','unknown','not applicable'],
  roles:['faculty','program director','associate program director','chief resident','residents','coordinator','other','unknown','prefer not to share'],
  formats:['individual','panel','group','resident group','social (separate)','unknown'],
  social:['attended','skipped','none offered','unknown','prefer not to say'],
  categories:['why this program','your story','teamwork / handoff','clinical reasoning','conflict','ethics','research','personal','unknown'],
  unexpected:['none','one','several','unknown'],difficult:['none','one','several','prefer not to say'],
  impression:['went well','mixed','rough','prefer not to say'],redflags:['none noticed','some','serious','prefer not to say'],
  followup:['thank-you sent','thank-you planned','second look requested','nothing planned','not applicable'],
};
const multi=new Set(['roles','formats','categories','followup']);
const certainty=['exact','estimated','unknown','not applicable','prefer not to share'];
export function validateEncounters(value) {
  const ids=new Set();
  return v.array(value,'Encounters',100).map(item=>{
    v.onlyKeys(item,['id','format','roles','duration_minutes','duration_precision']);
    const id=v.uuid(item.id,'Encounter');requireValue(!ids.has(id),'duplicate_encounter','Each encounter must have its own identifier.');ids.add(id);
    const precision=v.choice(item.duration_precision,certainty,'encounter duration certainty');
    const duration=item.duration_minutes==null?null:v.integer(item.duration_minutes,'Encounter duration',1,1440);
    requireValue(['exact','estimated'].includes(precision)?duration!==null:duration===null,'duration_certainty','Use minutes only for an exact or estimated duration.');
    return {id,format:v.choice(item.format,['individual','panel','group','unknown','not applicable','prefer not to share'],'encounter format'),
      roles:[...new Set(v.array(item.roles,'Encounter roles',fields.roles.length).map(x=>v.choice(x,fields.roles,'encounter role')))],duration_minutes:duration,duration_precision:precision};
  });
}
export function validateFields(value) {
  v.onlyKeys(value,[...Object.keys(fields),'encounters','encounter_count','encounter_count_precision','emphasized_topics','program_information']);
  const result={};
  for(const [key,input] of Object.entries(value)) {
    if(input===null)continue; // Deselecting a chip clears it; it is not an inferred answer.
    if(key==='encounters')result[key]=validateEncounters(input);
    else if(key==='encounter_count')result[key]=v.integer(input,'Encounter count',0,100);
    else if(key==='encounter_count_precision')result[key]=v.choice(input,certainty,'encounter count certainty');
    else if(['emphasized_topics','program_information'].includes(key)){
      v.onlyKeys(input,['text','certainty']);const confidence=v.choice(input.certainty,['recalled','estimated','unknown','not applicable','prefer not to share'],'recollection certainty');
      const text=v.text(input.text,key==='emphasized_topics'?'Emphasized topics':'Program information learned',20000);
      requireValue(['recalled','estimated'].includes(confidence)||text==='', 'recollection_certainty','Clear the text when marking it unknown, not applicable, or private from this record.');
      result[key]={text,certainty:confidence};
    }
    else if(multi.has(key)) result[key]=[...new Set(v.array(input,key,fields[key].length).map(x=>v.choice(x,fields[key],key)))];
    else result[key]=v.choice(input,fields[key],key);
  }
  if('encounter_count_precision'in result || 'encounter_count'in result){
    requireValue(['exact','estimated'].includes(result.encounter_count_precision)?result.encounter_count!==undefined:result.encounter_count===undefined,'count_certainty','Enter a count only when exact or estimated.');
    if(result.encounter_count_precision==='exact')requireValue((result.encounters||[]).length<=result.encounter_count,'encounter_count_mismatch','The exact total cannot be less than the encounters recorded.');
  }
  return result;
}
export function validateQuestions(value) {
  return v.array(value,'Questions',100).map(q=>{
    v.onlyKeys(q,['text','recall','recollection','permission']);
    const recall=q.recall || q.recollection;
    return {text:v.text(q.text,'Question',4000,{empty:false}),recall:v.choice(recall,['exact','paraphrase'],'recollection'),permission:'private'};
  });
}
// Extract only explicitly stated candidates. Unknown fields stay unknown, and
// nothing becomes structured truth until the student confirms the proposal.
export function proposeStructure(text) {
  const words={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
  const matches=[...text.matchAll(/\b(one|two|three|four|five|six|seven|eight|nine|ten|[1-9]\d?)\s+(?:individual\s+|separate\s+)?(?:interviews|conversations)\b/gi)];
  const last=matches.at(-1), value=last ? words[last[1].toLowerCase()] || Number(last[1]) : null;
  return {individual_count:value===null?'unknown':value>=4?'4+':String(value),
    resident_group:/\b(?:resident group|group (?:of|with) residents)\b/i.test(text)?true:null,
    confirmation_required:true,method:'explicit-text-candidates',source:'student-edited-account'};
}

export async function writeDebrief({db,actor,command,interviewId,data,owners}) {
  requireValue(actor.role==='student','student_required','Use your student workspace for this action.',403);
  const row=await interview(db,actor,interviewId,{lock:true});
  requireValue(!['cancelled','declined','postponed','waitlisted'].includes(row.status),'inactive_interview','Restore or update this interview before recording that it happened.');
  await db.query(`INSERT INTO iiq.debriefs(owner_id,interview_id) VALUES($1,$2) ON CONFLICT(interview_id) DO NOTHING`,[actor.id,row.id]);
  const {rows:[draft]}=await db.query('SELECT * FROM iiq.debriefs WHERE interview_id=$1 AND owner_id=$2 FOR UPDATE',[row.id,actor.id]);
  if(command==='debrief.occurrence') {
    v.onlyKeys(data,['occurrence']);v.choice(data.occurrence,['yes','no','later',null],'occurrence');
    const occurrence={yes:'happened',no:'not_happened',later:'later'}[data.occurrence]||'unconfirmed';
    await db.query('UPDATE iiq.debriefs SET occurrence=$3 WHERE interview_id=$1 AND owner_id=$2',[row.id,actor.id,occurrence]);
    await db.query(`UPDATE iiq.interviews SET confirmed_occurred=$3,status=CASE WHEN $3 IS TRUE THEN 'completed'
      WHEN status='completed' THEN 'awaiting_confirmation' ELSE status END WHERE id=$1 AND owner_id=$2`,[row.id,actor.id,data.occurrence==='yes'?true:data.occurrence==='no'?false:null]);
    if(occurrence!=='happened' && draft.occurrence==='happened') {
      // Correcting attendance also withdraws the permission underlying an
      // experience report. The private account remains the student's record.
      await db.query(`INSERT INTO iiq.outbox_events(owner_id,topic,dedupe_key,payload)
        SELECT owner_id,'rise.report_retracted','retract:'||id::text,
          jsonb_build_object('reviewId',id,'programId',program_id)
        FROM iiq.review_items WHERE owner_id=$1 AND interview_id=$2 AND source_kind='debrief' AND status NOT IN ('withdrawn','retracted')
        ON CONFLICT(dedupe_key) DO NOTHING`,[actor.id,row.id]);
      await db.query(`UPDATE iiq.consents SET status='revoked',revoked_at=now() WHERE owner_id=$1 AND status='active'
        AND id IN (SELECT consent_id FROM iiq.review_items WHERE owner_id=$1 AND interview_id=$2 AND source_kind='debrief')`,[actor.id,row.id]);
    }
  } else {
    requireValue(draft.occurrence==='happened','occurrence_required','Confirm that the interview happened first.');
    if(command==='debrief.save') {
      v.onlyKeys(data,['edited','narrative','fields','questions','saved']);
      const edited=data.edited===undefined?draft.edited_text:v.text(data.edited,'Your account',100000);
      const structured={...draft.structured_data};
      if(data.narrative!==undefined)structured.narrative=v.text(data.narrative,'Narrative',100000);
      if(data.fields!==undefined)structured.fields=validateFields(data.fields);
      if(data.saved!==undefined)structured.saved=v.boolean(data.saved,'Save');
      const questions=data.questions===undefined?draft.questions:validateQuestions(data.questions);
      await db.query(`UPDATE iiq.debriefs SET edited_text=$3,structured_data=$4::jsonb,questions=$5::jsonb,
        proposed_structure=CASE WHEN edited_text IS DISTINCT FROM $3 THEN null ELSE proposed_structure END,
        structure_confirmed_at=CASE WHEN edited_text IS DISTINCT FROM $3 THEN null ELSE structure_confirmed_at END,
        last_client_revision=last_client_revision+1 WHERE interview_id=$1 AND owner_id=$2`,[row.id,actor.id,edited,JSON.stringify(structured),JSON.stringify(questions)]);
    } else if(command==='debrief.propose') {
      v.onlyKeys(data,['edited']);const edited=v.text(data.edited,'Your account',100000,{empty:false});
      const proposed=proposeStructure(edited);
      await db.query(`UPDATE iiq.debriefs SET edited_text=$3,proposed_structure=$4::jsonb,structure_confirmed_at=null WHERE interview_id=$1 AND owner_id=$2`,[row.id,actor.id,edited,JSON.stringify(proposed)]);
    } else if(command==='debrief.accept') {
      v.onlyKeys(data,[]);requireValue(Boolean(draft.proposed_structure),'proposal_required','Create and review a proposal first.');
      const structured={...draft.structured_data,fields:{...draft.structured_data.fields,individual_count:draft.proposed_structure.individual_count}};
      if(draft.proposed_structure.resident_group===true)structured.fields.formats=[...new Set([...(structured.fields.formats||[]),'resident group'])];
      await db.query(`UPDATE iiq.debriefs SET structured_data=$3::jsonb,structure_confirmed_at=now() WHERE interview_id=$1 AND owner_id=$2`,[row.id,actor.id,JSON.stringify(structured)]);
    } else if(command==='debrief.reject') {
      v.onlyKeys(data,[]);await db.query('UPDATE iiq.debriefs SET proposed_structure=null,structure_confirmed_at=null WHERE interview_id=$1 AND owner_id=$2',[row.id,actor.id]);
    } else throw new AppError(404,'unknown_command','This action is unavailable.');
  }
  await updateGap(db,row);return {type:'debrief',id:draft.id,interviewId:row.id};
}

export async function writePreparation({db,actor,interviewId,data,owners}) {
  requireValue(actor.role==='student','student_required','Use your student workspace for this action.',403);
  v.onlyKeys(data,['why','questions']);const row=await interview(db,actor,interviewId,{lock:true});
  const {rows:[prior]}=await db.query('SELECT * FROM iiq.preparation WHERE interview_id=$1 AND owner_id=$2',[row.id,actor.id]);
  let why=prior?.why_program||'',basis=prior?.basis||{},questions=prior?.questions||[];
  if(data.why!==undefined) {
    v.onlyKeys(data.why,['text','basis','edited']);why=v.text(data.why.text,'Why this program',20000);
    if(data.why.basis) {
      v.onlyKeys(data.why.basis,['fact','story']);
      basis=data.why.basis.fact||data.why.basis.story?await owners.validateBasis(actor,row,data.why.basis):{};
    } else basis={};
    basis.edited=data.why.edited===undefined?true:v.boolean(data.why.edited,'Edited');
  }
  if(data.questions!==undefined)questions=v.text(data.questions,'Questions',20000).split('\n').filter(text=>text.trim()).map(text=>({text}));
  const {rows:[record]}=await db.query(`INSERT INTO iiq.preparation(owner_id,interview_id,why_program,basis,questions)
    VALUES($1,$2,$3,$4::jsonb,$5::jsonb) ON CONFLICT(interview_id) DO UPDATE SET why_program=EXCLUDED.why_program,basis=EXCLUDED.basis,questions=EXCLUDED.questions RETURNING id`,
    [actor.id,row.id,why,JSON.stringify(basis),JSON.stringify(questions)]);
  await updateGap(db,row);return {type:'preparation',id:record.id,interviewId:row.id};
}
