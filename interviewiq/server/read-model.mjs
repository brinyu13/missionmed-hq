import {loiEnabled,loiHistory} from './private-commands.mjs';
import {revision} from './records.mjs';
import {readCoreModel} from './core-read-model.mjs';
import {readResearchSummary,researchEnabled,provisionalSQL,provisionalValues} from './research-workspace.mjs';

const iso=value=>value instanceof Date?value.toISOString():value||null;
const date=value=>value instanceof Date?value.toISOString().slice(0,10):value||null;
const object=()=>Object.create(null);
const byInterview=rows=>Object.fromEntries(rows.map(x=>[x.interview_id,x]));
const status=value=>({'awaiting_confirmation':'awaiting occurrence confirmation','waiting_identity':'waiting for identity',outage:'provider outage'}[value]||value);

export async function readModel(db,actor,{owners,config,clock=()=>new Date(),speechAvailable=false}) {
  if(config.coreOnly)return readCoreModel(db,actor,{config,clock});
  // RLS applies even to these explicit owner predicates. Never ship one shared
  // browser state containing private records and filter it in the UI.
  const {rows:interviews}=await db.query('SELECT * FROM iiq.interviews ORDER BY start_at NULLS LAST,created_at DESC');
  const {rows:events}=await db.query('SELECT * FROM iiq.related_events ORDER BY start_at NULLS LAST,created_at');
  const {rows:history}=await db.query('SELECT * FROM iiq.interview_history ORDER BY created_at');
  const {rows:demands}=await db.query('SELECT * FROM iiq.research_demands');
  const {rows:gaps}=await db.query('SELECT * FROM iiq.mentor_gaps');
  const {rows:prep}=await db.query('SELECT * FROM iiq.preparation WHERE owner_id=$1',[actor.id]);
  const {rows:practice}=await db.query('SELECT * FROM iiq.practice_attempts WHERE owner_id=$1 ORDER BY created_at',[actor.id]);
  const {rows:learning}=await db.query('SELECT * FROM iiq.learning_signals ORDER BY updated_at DESC,id');
  const {rows:debriefs}=await db.query('SELECT * FROM iiq.debriefs WHERE owner_id=$1',[actor.id]);
  const {rows:speech}=await db.query('SELECT * FROM iiq.speech_segments WHERE owner_id=$1 ORDER BY created_at,sequence',[actor.id]);
  const {rows:recordings}=await db.query('SELECT * FROM iiq.recording_sessions WHERE owner_id=$1 ORDER BY created_at DESC',[actor.id]);
  const {rows:consents}=await db.query('SELECT * FROM iiq.consents WHERE owner_id=$1',[actor.id]);
  // Provisional originals are private by default, even under admin RLS and with
  // the new feature disabled. Only the bounded, consent-aware workspace reads them.
  const provisionalSub=`SELECT s.id FROM iiq.research_submissions s JOIN iiq.research_missions m ON m.id=s.mission_id AND m.owner_id=s.owner_id WHERE ${provisionalSQL}`;
  const provisionalReview=`SELECT r.id FROM iiq.review_items r WHERE r.submission_id IN (${provisionalSub})`;
  const {rows:reviews}=await db.query(`SELECT * FROM iiq.review_items WHERE id NOT IN (${provisionalReview}) ORDER BY created_at DESC`,provisionalValues);
  const {rows:missions}=await db.query(`SELECT m.* FROM iiq.research_missions m WHERE NOT ${provisionalSQL} ORDER BY created_at DESC`,provisionalValues);
  const {rows:submissions}=await db.query(`SELECT * FROM iiq.research_submissions WHERE id NOT IN (${provisionalSub}) ORDER BY created_at DESC`,provisionalValues);
  const {rows:grants}=await db.query('SELECT * FROM iiq.access_grants');
  const {rows:credits}=await db.query('SELECT * FROM iiq.contribution_credits ORDER BY created_at');
  const {rows:audit}=await db.query(`SELECT * FROM iiq.audit_events WHERE object_id IS NULL OR object_id NOT IN (
    SELECT m.id FROM iiq.research_missions m WHERE ${provisionalSQL} UNION ${provisionalSub} UNION ${provisionalReview}) ORDER BY created_at DESC LIMIT 100`,provisionalValues);
  const {rows:policyRows}=actor.role==='admin'?await db.query('SELECT * FROM iiq.policies'):{rows:[]};
  const {rows:[effectivePolicy]}=await db.query('SELECT * FROM iiq.effective_research_policy()');
  const {rows:profileRows}=await db.query('SELECT id,display_name FROM iiq.logistics_profiles()');
  const {rows:mentorNotes}=await db.query('SELECT id,owner_id,target_student_id,kind,text,created_at FROM iiq.mentor_notes ORDER BY created_at DESC');
  const current=clock().toISOString(),version=await revision(db,actor), programIds=[...new Set(interviews.map(x=>x.program_id).filter(Boolean))];
  let context;
  try {context=await owners.context(actor,programIds);} catch {context={programs:[],facts:[],sources:[],stories:[],status:{rise:'unavailable',storyforge:'unavailable'}};}
  const permittedStories=new Set(consents.filter(x=>x.scope==='storyforge' && x.status==='active').map(x=>x.subject_ref));
  const stories=(context.stories||[]).filter(x=>permittedStories.has(x.id));
  const programs=[...(context.programs||[])];
  // Previously resolved identity labels are logistics snapshots, not fresh
  // program evidence. Empty fact arrays prevent stale snapshots claiming facts.
  for(const row of interviews)if(row.program_id && !programs.some(p=>p.id===row.program_id))programs.push({id:row.program_id,name:row.program_name,track:row.program_track,specialty:'',zone:row.timezone||actor.zone,fact_ids:[],identity_snapshot:true});
  const gapMap=byInterview(gaps);
  const state={clock:current,interviews:[],loi:object(),demands:object(),results:context.results||{},why:object(),questions:object(),practice:object(),learning:object(),debriefs:object(),reviewQueue:[],shared:context.sharedReports||{},
    contrib:{missions:object(),submissions:[],ledger:[],grants:object()},policy:{contributions:false,standalone:false,mrxCentral:null,audit:[],suspended:{}},
    mentorAssigned:actor.role==='mentor'?[...actor.assignments]:[],mentorPriority:object(),rank:object(),consents:object(),changes:[],ivoc:object()};
  state.policy.contributions=effectivePolicy?.contributions===true;
  state.policy.mrxCentral=effectivePolicy?.standard_version||null;
  state.policy.allowedReviewModes=effectivePolicy?.allowed_review_modes||[];
  state.interviews=interviews.map(row=>({id:row.id,owner:row.owner_id,saved:true,version:Number(row.version),program:row.program_id,programName:row.program_name,track:row.program_track,resolutionState:row.program_id?'resolved':'manual/unresolved',fold:row.fold,
    unresolved_input:row.unresolved_input,deadline:date(row.deadline_date)||iso(row.deadline_at),received_at:iso(row.received_at),
    state:row.status==='scheduled' && row.start_at && iso(row.start_at)<current?'awaiting occurrence confirmation':status(row.status),
    disposition:['cancelled','declined','postponed','no_show','waitlisted'].includes(row.status)?row.status:null,
    date:date(row.local_date),wall:row.local_date && row.local_time?`${date(row.local_date)}T${row.local_time}`:null,
    zone:row.timezone||actor.zone,instant:iso(row.start_at),duration:row.duration_minutes,travel_minutes:row.travel_minutes,format:row.format==='in_person'?'in person':row.format,
    joining:row.joining,joinVerified:row.joining_verified?iso(row.updated_at):null,confirmed_occurred:row.confirmed_occurred,
    previous:row.previous_schedule,
    related:events.filter(x=>x.interview_id===row.id).map(x=>({id:x.id,kind:x.title||x.kind,date:date(x.local_date),wall:x.local_date&&x.local_time?`${date(x.local_date)}T${x.local_time}`:null,zone:x.timezone,instant:iso(x.start_at),fold:x.fold,duration_minutes:x.duration_minutes,note:x.note||'',status:x.status})),
    history:history.filter(x=>x.interview_id===row.id).map(x=>({at:iso(x.created_at),what:x.event_type,detail:JSON.stringify(x.details)})),
    preparationStatus:gapMap[row.id]||null,
  }));
  for(const row of demands)state.demands[row.interview_id]={id:row.id,status:status(row.status),program:row.program_id,history:[{at:iso(row.updated_at),state:status(row.status),reason:row.last_error_code?'The research service is unavailable.':''}]};
  if(loiEnabled(config,actor))for(const row of prep){const own=interviews.find(x=>x.id===row.interview_id&&x.owner_id===actor.id);if(own)state.loi[row.interview_id]=loiHistory(row.anchors,own,consents.filter(c=>c.scope==='storyforge'));}
  for(const row of prep){const basis={fact:row.basis?.fact||null,story:row.basis?.story||null};if(basis.story && !stories.some(x=>x.id===basis.story))basis.story=null;state.why[row.interview_id]={text:row.why_program,basis:basis.fact||basis.story?basis:null,edited:row.basis?.edited!==false};state.questions[row.interview_id]=row.questions.map(q=>typeof q==='string'?q:q.text||'').join('\n');}
  for(const row of practice){const basis={...row.context_basis};if(basis.story && !stories.some(x=>x.id===basis.story))delete basis.story;(state.practice[row.interview_id] ||= []).push({id:row.id,at:iso(row.created_at),program:row.program_id,question:row.question,draft:row.answer,diagnosis:row.summary?.diagnosis||[],change:row.specific_change,retry:row.retry_answer,retryDiagnosis:row.summary?.retryDiagnosis||[],reflection:row.reflection,nextChange:row.summary?.nextChange||'',feedback:row.summary?.feedback===true,discarded:row.status==='revoked',basis,status:row.status,generic:row.summary?.generic===true,adapted:row.summary?.adapted===true});}
  for(const row of learning)if(!state.learning[row.owner_id])state.learning[row.owner_id]={id:row.id,goal:row.statement,status:row.status,source:row.source_kind,at:iso(row.updated_at),mentorVisible:row.mentor_visible};
  for(const row of debriefs){
    const recording=recordings.find(x=>x.interview_id===row.interview_id);
    state.debriefs[row.interview_id]={id:row.id,occurrence:({happened:'yes',not_happened:'no',later:'later'}[row.occurrence]||null),
      raw:speech.filter(s=>s.interview_id===row.interview_id).map(s=>({id:s.id,text:s.transcript,complete:true,at:iso(s.created_at)})),
      edited:row.edited_text,narrative:row.structured_data?.narrative||'',proposed:row.proposed_structure,proposedConfirmed:Boolean(row.structure_confirmed_at),fields:row.structured_data?.fields||{},
      questions:row.questions.map(q=>({text:q.text,recollection:q.recall||q.recollection,permission:'private, not shared'})),saved:row.structured_data?.saved===true,
      autosavedAt:iso(row.updated_at),exits:{},speech:{status:({listening:'live',completed:'done',created:'idle',failed:'network',abandoned:'idle'}[recording?.status]||recording?.status||'idle'),recordingId:recording?.id||null},latency:[]};
  }
  for(const row of consents){if(row.scope==='storyforge')state.consents[row.subject_ref]=row.status==='active';if(row.scope==='ranklist')state.rank[actor.id]={consent:row.status==='active',version:Number(row.version),at:iso(row.updated_at)};}
  state.reviewQueue=reviews.map(row=>({id:row.id,from:row.owner_id,interview:row.interview_id,program:row.program_id,excerpt:row.excerpt,permitted:row.permitted_use,deid:row.quality_status==='approved',status:row.status==='withdrawn'?'retracted':row.status,version:Number(row.version),at:iso(row.created_at),decisions:{execution:row.execution_status,quality:row.quality_status,publication:row.publication_status,credit:row.credit_status}}));
  for(const row of missions)if(!state.contrib.missions[row.owner_id])state.contrib.missions[row.owner_id]={id:row.id,student:row.owner_id,program:row.program_id,policy:row.standard_version,payload:row.public_payload,status:row.status};
  state.contrib.submissions=submissions.map(row=>{const review=reviews.find(x=>x.submission_id===row.id),receipt=audit.find(x=>x.object_id===row.id&&x.event_type==='submission.execution'&&x.metadata?.receipt);
    return {id:row.id,student:row.owner_id,mission:row.mission_id,parent:row.repair_parent_id,at:iso(row.created_at),sha256:row.sha256,
      original:row.parsed_package?._iiq?.original||'',status:row.parsed_package?._iiq?.status||'quarantined',version:row.parsed_package?._iiq?.version||1,
      reasons:row.parsed_package?._iiq?.reasons||[],package:row.parsed_package?.package||{},
      preflight:{status:receipt?'verified':'unverified',receipt:receipt?.metadata?.receipt||null},
      decisions:review?{execution:review.execution_status,quality:review.quality_status,publication:review.publication_status,credit:review.credit_status}: {execution:'unverified',quality:'pending',publication:'unpublished',credit:'none'},
      ...(review?{reviewId:review.id}:{})};});
  state.contrib.ledger=credits.map(x=>({student:x.owner_id,id:x.id,review:x.review_id,mission:x.mission_id,kind:x.kind,units:x.units,policy:x.policy_version,text:x.kind==='grant'?'Credit granted under the filed contribution policy.':'Previously granted contribution credit revoked.',at:iso(x.created_at)}));
  for(const x of grants)(state.contrib.grants[x.owner_id] ||= []).push({id:x.id,program:x.program_id,expires:iso(x.expires_at),revoked:Boolean(x.revoked_at),suspended:Boolean(x.suspended_at),reviewId:x.qualifying_review_id,originalReviewId:x.review_id});
  for(const x of policyRows)if(x.policy_key==='research')state.policy={...state.policy,...x.value,mrxCentral:x.policy_version};
  state.policy.audit=actor.role==='admin'?audit.map(x=>({at:iso(x.created_at),actor:x.actor_id,action:x.event_type,detail:x.metadata})):[];
  state.changes=audit.filter(x=>x.owner_id===actor.id).map((x,index)=>({who:actor.id,actor:'you',seq:version-index,at:iso(x.created_at),kind:x.object_type,text:x.event_type.replaceAll('.',' '),to:x.object_id}));
  for(const note of mentorNotes){if(note.kind==='priority' && !state.mentorPriority[note.target_student_id])state.mentorPriority[note.target_student_id]={text:note.text,at:iso(note.created_at)};}
  state.mentorNudges=mentorNotes.filter(x=>x.kind==='nudge').map(x=>({id:x.id,student:x.target_student_id,text:x.text,at:iso(x.created_at)}));
  if(researchEnabled(config,actor))state.research=await readResearchSummary(db,actor,config);
  const research=['360','ivprep_complete'].includes(actor.tier)||actor.role==='admin';
  const {rows:accessRows}=await db.query('SELECT p AS program,iiq.deep_research_allowed(p) AS allow FROM unnest($1::text[]) p',[programs.map(x=>x.id)]);
  const researchByProgram=Object.fromEntries(accessRows.map(x=>[x.program,{allow:x.allow,reason:x.allow?'Current protected access or approved contribution grant.':'Current research access is required.'}]));
  const profiles=[{id:actor.id,displayName:actor.displayName,tier:actor.tier,approved_stories:stories,...(stories[0]?{approved_story:stories[0]}:{})},
    ...profileRows.filter(x=>x.id!==actor.id).map(x=>({id:x.id,name:x.display_name,displayName:x.display_name}))];
  return {actor:{id:actor.id,role:actor.role,displayName:actor.displayName,firstName:actor.firstName,tier:actor.tier,zone:actor.zone},
    capabilities:{loi:loiEnabled(config,actor),research,researchMissions:researchEnabled(config,actor),researchByProgram,contributions:state.policy.contributions===true},catalog:{programs,facts:context.facts||[],sources:context.sources||[],profiles,student_zone:actor.zone,registry_release:context.registryRelease||null,storyforgeProjection:context.storyforgeProjection||null,riseProjections:context.riseProjections||{}},
    state,version,server_time:current,integrations:{matrix:{available:true,status:'available',url:`${config.publicOrigin}/member-dashboard/`},
      rise:{available:context.status?.rise==='available',status:context.status?.rise||'unavailable',url:`${config.publicOrigin}/rise/`},
      storyforge:{available:context.status?.storyforge==='available',status:context.status?.storyforge||'unavailable',url:`${config.publicOrigin}/storyforge/`},
      ivoc:{available:owners.ivocAvailable===true,status:owners.ivocAvailable?'available':'unavailable',url:`${config.publicOrigin}/ivprep/`},
      speech:{available:speechAvailable,status:speechAvailable?'available':'unavailable'}}};
}
