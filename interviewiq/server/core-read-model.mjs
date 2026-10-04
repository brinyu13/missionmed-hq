import {deepResearchEnabled} from './research-dispatch.mjs';
import {revision} from './records.mjs';
import {readResearchSummary,researchEnabled} from './research-workspace.mjs';
const iso=x=>x instanceof Date?x.toISOString():x||null;
const date=x=>x instanceof Date?x.toISOString().slice(0,10):x||null;
const empty=()=>Object.create(null);
export const comingSoon=['rise','storyforge','ivoc','speech','publication','research','contributions','growth','mentor','admin','notifications','ranklist','debrief','prepare','export'];
// CORE deliberately never reads advanced/private-owner projections or invokes
// an integration. Explicit own-record predicates supplement forced database RLS.
export async function readCoreModel(db,actor,{config,clock=()=>new Date()}) {
  const {rows:records}=await db.query('SELECT * FROM iiq.interviews WHERE owner_id=$1 ORDER BY start_at NULLS LAST,created_at DESC',[actor.id]);
  const {rows:events}=await db.query('SELECT * FROM iiq.related_events WHERE owner_id=$1 ORDER BY start_at NULLS LAST,created_at',[actor.id]);
  const {rows:history}=await db.query('SELECT * FROM iiq.interview_history WHERE owner_id=$1 ORDER BY created_at',[actor.id]);
  const current=clock().toISOString(),version=await revision(db,actor);
  const interviews=records.map(row=>({id:row.id,owner:row.owner_id,saved:true,version:Number(row.version),program:row.program_id,
    programName:row.program_name||row.unresolved_input,track:row.program_track||'',resolutionState:row.program_id?'resolved snapshot':'manual/unresolved',
    unresolved_input:row.unresolved_input,deadline:date(row.deadline_date)||iso(row.deadline_at),received_at:iso(row.received_at),
    state:row.status==='scheduled'&&row.start_at&&iso(row.start_at)<current?'awaiting occurrence confirmation':row.status,
    disposition:['cancelled','declined','postponed','no_show','waitlisted'].includes(row.status)?row.status:null,
    date:date(row.local_date),wall:row.local_date&&row.local_time?`${date(row.local_date)}T${row.local_time}`:null,
    zone:row.timezone||actor.zone,instant:iso(row.start_at),fold:row.fold,duration:row.duration_minutes,travel_minutes:row.travel_minutes,
    format:row.format==='in_person'?'in person':row.format,joining:row.joining,joinVerified:row.joining_verified?iso(row.updated_at):null,
    confirmed_occurred:row.confirmed_occurred,previous:row.previous_schedule,preparationStatus:null,
    related:events.filter(e=>e.interview_id===row.id).map(e=>({id:e.id,kind:e.title||e.kind,date:date(e.local_date),wall:e.local_date&&e.local_time?`${date(e.local_date)}T${e.local_time}`:null,zone:e.timezone,instant:iso(e.start_at),fold:e.fold,duration_minutes:e.duration_minutes,note:e.note||'',status:e.status})),
    history:history.filter(e=>e.interview_id===row.id).map(e=>({at:iso(e.created_at),what:e.event_type,detail:JSON.stringify(e.details)}))}));
  const programs=records.filter(r=>r.program_id).map(r=>({id:r.program_id,name:r.program_name,track:r.program_track,specialty:'',zone:r.timezone||actor.zone,fact_ids:[],identity_snapshot:true}));
  const state={clock:current,interviews,demands:empty(),results:empty(),why:empty(),questions:empty(),practice:empty(),learning:empty(),debriefs:empty(),reviewQueue:[],shared:empty(),
    contrib:{missions:empty(),submissions:[],ledger:[],grants:empty()},policy:{contributions:false,standalone:false,mrxCentral:null,audit:[],suspended:empty()},
    mentorAssigned:[],mentorPriority:empty(),mentorNudges:[],rank:empty(),consents:empty(),changes:[],ivoc:empty()};
  if(deepResearchEnabled(config,actor)){
    const {rows:demands}=await db.query(`SELECT d.*,g.registry_release_id FROM iiq.research_demands d LEFT JOIN iiq.research_job_grants g ON g.request_id::text=d.external_request_id AND g.owner_id=d.owner_id AND g.demand_id=d.id WHERE d.owner_id=$1`,[actor.id]);
    for(const d of demands)state.demands[d.interview_id]={id:d.id,requestId:d.external_request_id,programId:d.program_id,registryReleaseId:d.registry_release_id,status:d.status,version:Number(d.version),requestedAt:iso(d.requested_at),refreshedAt:iso(d.refreshed_at)};
  }
  const actorView={id:actor.id,role:actor.role,displayName:actor.displayName,firstName:actor.firstName,tier:actor.tier,zone:actor.zone};
  if(researchEnabled(config,actor))state.research=await readResearchSummary(db,actor,config);
  const integrations={matrix:{available:true,status:'available',url:`${config.publicOrigin}/member-dashboard/`}};
  for(const name of comingSoon)integrations[name]={available:false,status:'coming_soon'};
  return {actor:actorView,capabilities:{coreOnly:true,comingSoon:[...comingSoon],research:false,deepResearch:deepResearchEnabled(config,actor),researchMissions:researchEnabled(config,actor),researchByProgram:empty(),contributions:false},
    catalog:{programs,facts:[],sources:[],profiles:[{id:actor.id,displayName:actor.displayName,tier:actor.tier,approved_stories:[]}],student_zone:actor.zone,registry_release:null,storyforgeProjection:null,riseProjections:empty()},
    state,version,server_time:current,integrations};
}
