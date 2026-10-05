import {deepResearchEnabled,captureResearchBinding,checkCommittedResearch,createRiseResearchJobTransport} from './research-dispatch.mjs';
import {AppError,requireValue} from './errors.mjs';
import {commandEnvelope} from './validation.mjs';
import {syncActor,revision,writeInterview} from './records.mjs';
import {writeDebrief,writePreparation} from './debrief.mjs';
import {writeLearning,writeConsent,writeShare,loiEnabled,loiCanonicalLookup,loiProgramAllowed,requireLoi,readLoi,loiEvidence,writeLoi,replayLoiHandoff} from './private-commands.mjs';
import {readModel} from './read-model.mjs';
import {writeRehearsal} from './rehearsal.mjs';
import {writeAdmin} from './admin-commands.mjs';
import {writeResearch} from './research-commands.mjs';
import {researchEnabled,researchCommands,readResearch,requireResearch} from './research-workspace.mjs';

const coreCommands=new Set(['interview.create','interview.identity','interview.schedule','interview.lifecycle','event.create','event.update']);
function coreActor(actor,config) { if(config.coreOnly) requireValue(actor.role==='admin' || (actor.role==='student' && ['360','ivprep_complete'].includes(actor.tier)),'core_access_required','InterviewIQ is not available for your current access.',403); }
const interviewCommands=new Set(['interview.create','interview.identity','interview.schedule','interview.lifecycle','event.create','event.update','research.refresh']);
const debriefCommands=new Set(['debrief.occurrence','debrief.save','debrief.propose','debrief.accept','debrief.reject']);
const loiCommands=new Set(['loi.save','loi.approve','loi.evidence','loi.export','loi.handoff','loi.mark_sent']);
const learningCommands=new Set(['learning.propose','learning.confirm','learning.correct','learning.revoke','learning.mentor']);
export function createCommands({database,owners,config,clock,speechAvailable=false,additionalCommands={},researchTransport=createRiseResearchJobTransport(config.deepResearch)}) {
  const settings={owners,config,clock,speechAvailable};
  async function bootstrap(actor) {coreActor(actor,config);return database.withActor(actor,async db=>{await syncActor(db,actor);return readModel(db,actor,settings);});}
  async function execute(actor,body,{revalidateActor}={}) {
    coreActor(actor,config);
    const envelope=commandEnvelope(body);
    if(loiCommands.has(envelope.command))requireLoi(config,actor);
    if(config.coreOnly) {
      requireValue(coreCommands.has(envelope.command)||loiEnabled(config,actor)&&loiCommands.has(envelope.command)||envelope.command==='research.check'&&deepResearchEnabled(config,actor)||researchEnabled(config,actor)&&researchCommands.has(envelope.command),'coming_soon','COMING SOON — this integration is not active. Your saved calendar is unchanged.',503);
      requireValue(!envelope.data.program||envelope.command==='mission.create'||deepResearchEnabled(config,actor)||loiCanonicalLookup(config,actor)&&['interview.create','interview.identity'].includes(envelope.command)&&loiProgramAllowed(config,actor,envelope.data.program),'coming_soon','Canonical program lookup is not available for this selection. Enter the program name from your invitation.',503);
    }
    if(['loi.evidence','loi.export'].includes(envelope.command)){
      requireValue(Object.keys(envelope.data).length===0,'unexpected_fields','This read accepts no additional fields.');
      return database.withActor(actor,async db=>{await db.query('SET TRANSACTION READ ONLY');
        if(envelope.command==='loi.evidence')return loiEvidence({db,actor,interviewId:envelope.interviewId,config,owners,clock});
        const own=await readLoi({db,actor,interviewId:envelope.interviewId,config});return {type:'loi_export',export:{interviewId:own.interviewId,history:own.history}};});
    }
    if(envelope.command==='research.check')requireValue(envelope.interviewId&&Object.keys(envelope.data).length===0,'invalid_research_check','Choose an existing interview without changing its request.');
    if(envelope.command==='research.read'){
      requireResearch(config,actor);
      return database.withActor(actor,async db=>{
        await db.query('SET TRANSACTION READ ONLY');
        return {type:'research_read',research:await readResearch({db,actor,config,data:envelope.data})};
      });
    }
    const result=await database.withActor(actor,async db=>{
      await syncActor(db,actor);
      const {rows:[prior]}=await db.query('SELECT * FROM iiq.request_idempotency WHERE owner_id=$1 AND request_key=$2',[actor.id,envelope.requestId]);
      if(prior) {
        requireValue(prior.request_digest===envelope.bodyHash,'request_reused','This request identifier was already used for a different action.',409);
        // Rebuild from current owner permissions rather than replaying a stale
        // cached body that could contain revoked story or shared context.
        const currentRead=await readModel(db,actor,settings);
        const {rows:[audit]}=deepResearchEnabled(config,actor)?await db.query("SELECT metadata FROM iiq.audit_events WHERE owner_id=$1 AND event_type=$2 AND metadata->>'requestId'=$3",[actor.id,envelope.command,envelope.requestId]):{rows:[]};
        const loiReplay=prior.result_type==='loi'&&envelope.command==='loi.handoff'?await replayLoiHandoff({db,actor,interviewId:envelope.interviewId,config,owners,clock},prior.result_id):{};
        return {...loiReplay,bootstrap:currentRead,...(audit?.metadata?.researchBinding?{researchBinding:audit.metadata.researchBinding}:{}),replayed:true,resultId:prior.result_id,...(prior.result_type==='interview'?{interviewId:prior.result_id}:{}),
          ...(prior.result_type==='export'?{export:privateExport(currentRead,actor)}:{})};
      }
      const current=await revision(db,actor);
      requireValue(current===envelope.expectedVersion,'version_conflict','This workspace changed. Your unsaved text is kept; review the latest version and try again.',409,{version:current});
      const context={db,actor,...envelope,owners,config,clock};let result;
      if(envelope.command==='research.check')result={type:'research',id:envelope.interviewId,interviewId:envelope.interviewId,researchBinding:await captureResearchBinding({...context,interviewId:envelope.interviewId})};
      else if(interviewCommands.has(envelope.command)) result=await writeInterview(context);
      else if(debriefCommands.has(envelope.command))result=await writeDebrief(context);
      else if(loiCommands.has(envelope.command))result=await writeLoi(context);
      else if(envelope.command==='prep.save')result=await writePreparation(context);
      else if(learningCommands.has(envelope.command))result=await writeLearning(context);
      else if(['story.consent','rank.consent'].includes(envelope.command))result=await writeConsent(context);
      else if(['share.submit','share.retract'].includes(envelope.command))result=await writeShare(context);
      else if(['practice.start','practice.feedback','practice.retry','practice.reflect','practice.overrule','practice.discard'].includes(envelope.command))result=await writeRehearsal(context);
      else if(researchCommands.has(envelope.command))result=await writeResearch(context);
      else if(['review.approve','review.reject','review.retract','policy.update','grant.revoke','grant.reinstate','mentor.priority','mentor.nudge'].includes(envelope.command))result=await writeAdmin(context);
      else if(additionalCommands[envelope.command])result=await additionalCommands[envelope.command](context);
      else if(envelope.command==='privacy.export') {
        result={type:'export',id:null,export:privateExport(await readModel(db,actor,settings),actor)};
      } else throw new AppError(503,'operation_unavailable','This operation is not available yet. Your saved work is unchanged.');
      const next=current+1;
      await db.query('INSERT INTO iiq.revisions(owner_id,revision,reason,request_key) VALUES($1,$2,$3,$4)',[actor.id,next,envelope.command,envelope.requestId]);
      await db.query('INSERT INTO iiq.request_idempotency(owner_id,request_key,request_digest,result_type,result_id,result_revision) VALUES($1,$2,$3,$4,$5,$6)',[actor.id,envelope.requestId,envelope.bodyHash,result.type,result.id,next]);
      await db.query(`INSERT INTO iiq.audit_events(owner_id,actor_id,event_type,object_type,object_id,metadata) VALUES($1,$1,$2,$3,$4,$5::jsonb)`,
        [actor.id,envelope.command,result.type,result.id,JSON.stringify({requestId:envelope.requestId,revision:next,...(result.researchBinding?{researchBinding:result.researchBinding}:{})})]);
      return {bootstrap:await readModel(db,actor,settings),...result};
    },{write:true});
    const binding=result.researchBinding;delete result.researchBinding;
    if(binding&&deepResearchEnabled(config,actor)&&typeof revalidateActor==='function'){
      const work=()=>checkCommittedResearch({database,actor,interviewId:binding.interviewId,expectedRequestId:binding.requestId,owners,transport:researchTransport,revalidateActor,config});
      if(envelope.command==='research.check'){
        try{result.researchCheck=await work();}catch{result.researchCheck={status:'unavailable'};}
        const latest=await revalidateActor();requireValue(latest?.id===actor.id&&latest.wpUserId===actor.wpUserId&&deepResearchEnabled(config,latest),'research_unavailable','Current research access could not be verified.',403);
        result.bootstrap=await bootstrap(latest);
        const own=result.bootstrap.state.interviews.find(i=>i.id===binding.interviewId),demand=result.bootstrap.state.demands[binding.interviewId];
        if(!own||['cancelled','declined','no_show'].includes(own.state)||own.program!==binding.programId||demand?.requestId!==binding.requestId||demand?.version!==result.researchCheck?.version)result.researchCheck={status:'changed'};
      }else {void work().catch(()=>{});}
    }
    return result;
  }
  return {bootstrap,execute};
}
function privateExport(read,actor) {
  const own=read.state.interviews.filter(x=>x.owner===actor.id),ids=new Set(own.map(x=>x.id));
  const pick=obj=>Object.fromEntries(Object.entries(obj).filter(([id])=>ids.has(id)));
  return {exported_at:new Date().toISOString(),actor:read.actor,interviews:own,
    preparation:pick(read.state.why),questions:pick(read.state.questions),practice:pick(read.state.practice),debriefs:pick(read.state.debriefs),
    learning:read.state.learning[actor.id]||null,consents:read.state.consents,rank:read.state.rank[actor.id]||null,
    shared_by_me:read.state.reviewQueue.filter(x=>x.from===actor.id)};
}
