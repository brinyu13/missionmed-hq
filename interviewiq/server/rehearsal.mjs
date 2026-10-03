import {AppError,requireValue,notFound} from './errors.mjs';
import * as v from './validation.mjs';
import {interview,updateGap} from './records.mjs';

// Port of the approved Fable four-check typed rehearsal. These are transparent
// wording checks, not clinical assessment, outcome verification or IVOC sessions.
const words=text=>[...new Set(String(text||'').toLowerCase().match(/[a-z]{5,}/g)||[])].filter(w=>!['about','their','there','these','those','which','would','could','should','program','residency','training'].includes(w));
export function diagnoseAnswer(answer,{programName='',fact=null,story=null,goal=null}={}) {
  const text=answer.trim();if(!text)return [{k:'empty',ok:false,text:'Write an answer before asking for wording feedback.',hits:[]}];
  const lower=text.toLowerCase(),sentences=text.split(/(?<=[.!?])\s+/),last=sentences.at(-1)||'';
  const outcomeHits=lower.match(/\b\d+\s?%|\b\d+\s?percent|\bby half\b|\bdoubled\b|\btripled\b|\bzero\b/g)||[];
  const storyHits=story?words(story.summary||story.text||story.title).filter(w=>lower.includes(w)):[];
  const factHits=fact?words(fact.claim).filter(w=>lower.includes(w)):[];
  const forward=/\b(carry|bring|take|learn|next|would|will|want|hope|look forward)\b/i.test(last);
  const tied=/\b(program|clinic|here|residency|your|training|train)\b/i.test(last)||words(programName).some(w=>last.toLowerCase().includes(w));
  const closing=forward&&tied&&last.split(/\s+/).length>=5;
  const output=[
    {k:'outcome',ok:!outcomeHits.length,hits:outcomeHits,text:outcomeHits.length?'Check the quantified result against your original evidence. This wording check cannot verify that it happened.':'No quantified result wording detected. This is not a factual verification.'},
    {k:'story',ok:!story||storyHits.length>0,informational:!story,hits:storyHits,text:!story?'No approved experience is currently permitted; this check is skipped.':storyHits.length?'Your wording refers to terms in your approved experience. Check that the account remains accurate.':'Name what you actually did in the approved experience, if it is relevant to this answer.'},
    {k:'fact',ok:!fact||factHits.length>0,informational:!fact,hits:factHits,text:!fact?'No current supported program fact is available; this check is skipped.':factHits.length?'Your wording references the supported program detail. Check the source before making a stronger claim.':`Connect your answer to the supported detail: ${fact.claim}`},
    {k:'closing',ok:closing,hits:closing?[last]:[],text:closing?'Your last sentence looks forward and mentions the program.':`Explain what you would carry into this program. Your closing sentence is: “${last}”`},
  ];
  if(goal && /clos|end|conclu/i.test(goal)){const check=output.pop();check.goal=true;output.unshift(check);}
  return output;
}
export function specificChange(checks,{goal=null,fact=null,story=null}={}) {
  const order=['goal','outcome','story','fact','closing','empty'];
  const open=checks.filter(x=>!x.ok&&!x.informational&&!x.overruled).sort((a,b)=>order.indexOf(a.goal?'goal':a.k)-order.indexOf(b.goal?'goal':b.k));
  if(!open.length)return 'The wording checks are satisfied. Say it aloud once and remove repetition; this does not establish interview readiness.';
  const first=open[0];
  if(first.goal)return `Your confirmed goal: ${goal}. End with one sentence explaining what you would carry into this program.`;
  if(first.k==='outcome')return `Verify “${first.hits[0]}” against your original account, or replace it with the action you can support.`;
  if(first.k==='story')return 'Describe one action from your currently approved experience, then explain its relevance.';
  if(first.k==='fact')return `Name the supported program detail without extending it beyond its source: ${fact?.claim||''}`;
  if(first.k==='closing')return 'End with one sentence explaining what you would carry into this program.';
  return 'Write the moment, its connection to the program, and what you would carry forward.';
}
async function currentContext(db,actor,row,owners) {
  let context;try{context=await owners.context(actor,[row.program_id]);}catch{context={};}
  const {rows:[access]}=await db.query('SELECT iiq.deep_research_allowed($1) AS allow',[row.program_id]);
  const {rows:consents}=await db.query("SELECT subject_ref FROM iiq.consents WHERE owner_id=$1 AND scope='storyforge' AND status='active'",[actor.id]);
  const {rows:[signal]}=await db.query('SELECT * FROM iiq.learning_signals WHERE owner_id=$1 ORDER BY updated_at DESC,id LIMIT 1',[actor.id]);
  const program=context.programs?.find(x=>x.id===row.program_id);
  const fact=access.allow?context.facts?.find(x=>(x.program===row.program_id||program?.fact_ids?.includes(x.id))&&x.status==='supported'):null;
  const story=context.stories?.find(x=>consents.some(c=>c.subject_ref===x.id));
  const goal=signal?.status==='confirmed'?signal.statement:null;
  return {programName:program?.name||row.program_name,fact,story,goal,signalId:goal?signal.id:null,
    question:program?.question||'What interests you about this program, and what would you bring to it?',generic:!program?.question};
}
export async function writeRehearsal({db,actor,command,interviewId,data,owners}) {
  requireValue(actor.role==='student','student_required','Use your student workspace for this action.',403);
  const row=await interview(db,actor,interviewId,{lock:true});
  requireValue(!['cancelled','declined','postponed','no_show'].includes(row.status),'inactive_interview','Restore the interview before rehearsing.');
  const context=await currentContext(db,actor,row,owners);
  if(command==='practice.start') {
    v.onlyKeys(data,['program']);requireValue(row.program_id&&data.program===row.program_id,'program_mismatch','Confirm this interview’s program before rehearsing.');
    const {rows:[previous]}=await db.query("SELECT summary,specific_change FROM iiq.practice_attempts WHERE owner_id=$1 AND interview_id=$2 AND status='completed' AND reflection<>'' ORDER BY updated_at DESC LIMIT 1",[actor.id,row.id]);
    const basis={fact:context.fact?.id||null,story:context.story?.id||null,learning:context.goal,learningId:context.signalId,carried:previous?.summary?.nextChange||previous?.specific_change||null};
    const {rows:[created]}=await db.query(`INSERT INTO iiq.practice_attempts(owner_id,interview_id,program_id,question,confirmed_goal,context_basis,summary)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) RETURNING id`,[actor.id,row.id,row.program_id,context.question,context.goal||'',JSON.stringify(basis),JSON.stringify({generic:context.generic,adapted:context.generic,kind:'typed-wording-rehearsal'})]);
    return {type:'practice',id:created.id,interviewId:row.id};
  }
  const id=v.uuid(data.attemptId,'Attempt');
  const {rows:[attempt]}=await db.query('SELECT * FROM iiq.practice_attempts WHERE id=$1 AND owner_id=$2 AND interview_id=$3 FOR UPDATE',[id,actor.id,row.id]);
  if(!attempt)throw notFound();requireValue(attempt.summary.kind==='typed-wording-rehearsal','wrong_practice_kind','Use IV Prep On-Call for this recorded session.',409);
  requireValue(attempt.status!=='revoked','attempt_revoked','This attempt is no longer in use.',409);
  requireValue(attempt.program_id===row.program_id,'program_changed','The interview program changed. Start a new rehearsal.',409);
  const summary={...attempt.summary};
  // Feedback always uses current consent and confirmed learning, even if the
  // attempt was started before a withdrawal or learning correction.
  const basis={...attempt.context_basis,fact:context.fact?.id||null,story:context.story?.id||null,learning:context.goal,learningId:context.signalId};
  if(command==='practice.feedback') {
    v.onlyKeys(data,['attemptId','draft']);const answer=v.text(data.draft,'Answer',20000,{empty:false});
    summary.diagnosis=diagnoseAnswer(answer,context);summary.feedback=true;summary.feedbackMethod='transparent-wording-checks-v1';
    await db.query(`UPDATE iiq.practice_attempts SET answer=$3,diagnosis=$4,specific_change=$5,summary=$6::jsonb,context_basis=$7::jsonb,confirmed_goal=$8,status='completed',retry_answer='',reflection='' WHERE id=$1 AND owner_id=$2`,
      [id,actor.id,answer,summary.diagnosis.map(x=>x.text).join('\n'),specificChange(summary.diagnosis,context),JSON.stringify({...summary,retryDiagnosis:[],nextChange:null}),JSON.stringify(basis),context.goal||'']);
  } else if(command==='practice.retry') {
    v.onlyKeys(data,['attemptId','retry']);requireValue(summary.feedback===true,'feedback_required','Get feedback on your first draft before retrying.');
    const answer=v.text(data.retry,'Retry',20000,{empty:false});summary.retryDiagnosis=diagnoseAnswer(answer,context);summary.nextChange=specificChange(summary.retryDiagnosis,context);
    await db.query('UPDATE iiq.practice_attempts SET retry_answer=$3,summary=$4::jsonb,context_basis=$5::jsonb,confirmed_goal=$6 WHERE id=$1 AND owner_id=$2',[id,actor.id,answer,JSON.stringify(summary),JSON.stringify(basis),context.goal||'']);
  } else if(command==='practice.reflect') {
    v.onlyKeys(data,['attemptId','reflection']);requireValue(Boolean(attempt.retry_answer),'retry_required','Save a retry before reflecting.');
    const reflection=v.choice(data.reflection,['The change helped','Still unclear','I need another try','The question surprised me'],'reflection');
    await db.query('UPDATE iiq.practice_attempts SET reflection=$3 WHERE id=$1 AND owner_id=$2',[id,actor.id,reflection]);
  } else if(command==='practice.overrule') {
    v.onlyKeys(data,['attemptId','which','index']);v.choice(data.which,['diagnosis','retryDiagnosis'],'feedback');
    const index=v.integer(data.index,'Check',0,20),checks=summary[data.which];requireValue(Array.isArray(checks)&&checks[index]&&!checks[index].ok&&!checks[index].informational,'check_unavailable','This check cannot be overruled.');
    checks[index]={...checks[index],overruled:!checks[index].overruled};
    if(data.which==='retryDiagnosis')summary.nextChange=specificChange(checks,context);
    await db.query('UPDATE iiq.practice_attempts SET summary=$3::jsonb,specific_change=$4 WHERE id=$1 AND owner_id=$2',[id,actor.id,JSON.stringify(summary),data.which==='diagnosis'?specificChange(checks,context):attempt.specific_change]);
  } else if(command==='practice.discard') {
    v.onlyKeys(data,['attemptId']);await db.query("UPDATE iiq.practice_attempts SET status='revoked' WHERE id=$1 AND owner_id=$2",[id,actor.id]);
  } else throw new AppError(404,'unknown_command','This practice action is unavailable.');
  await updateGap(db,row);return {type:'practice',id,interviewId:row.id};
}
