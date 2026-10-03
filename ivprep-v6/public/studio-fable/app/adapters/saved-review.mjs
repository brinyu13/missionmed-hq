// Fresh owner-scoped account evidence -> presentation. No cache, fixture or media owner.
import { buildEvidenceMomentLinks } from '../../../studio/presentation-view-model.mjs';
import { sourceBoundSelfPracticeResult } from '../../../capabilities/context-results.mjs';
import { attemptSnapshot, canCompareAttempts } from '../../../studio/longitudinal-model.mjs';

const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const bounded = (value, durationMs) => {
  const n = finite(value); return n !== null && n >= 0 && durationMs !== null && n <= durationMs ? n : null;
};
export function projectReplayTurns(detail, durationMs) {
  const envelope = detail?.results?.payload;
  const bound = sourceBoundSelfPracticeResult(detail);
  const spine=Array.isArray(detail?.spine?.turns)?detail.spine.turns:[];
  let selected=spine.filter(turn=>detail.spine.candidateAttribution?.status==='VERIFIED'
    || (bound&&turn?.transcript?.sourceBinding?.sourceRecordingId===detail.spine.sourceBinding.sourceRecordingId)
    || (!turn?.transcript?.canonical_ref&&turn?.transcript?.provisional_ref));
  selected=selected.filter(turn=>typeof turn?.transcript?.text==='string'&&turn.transcript.text.trim());
  if(selected.some(turn=>turn.speaker==='student'&&turn.transcript.canonical_ref))
    selected=selected.filter(turn=>turn.speaker!=='student'||turn.transcript.canonical_ref);
  const fromSpine=selected.length>0;
  const conversation=envelope?.liveConversation;
  if(!fromSpine)selected=Array.isArray(conversation?.turns)?conversation.turns:[];
  const identity=turn=>fromSpine?(turn.transcript.canonical_ref||turn.transcript.provisional_ref):turn.id;
  const counts=new Map();for(const turn of selected){const ref=identity(turn);if(ref)counts.set(ref,(counts.get(ref)||0)+1);}
  return selected.filter(turn=>typeof (fromSpine?turn.transcript?.text:turn.text)==='string').map(turn=>{
    const canonical=Boolean(fromSpine&&turn.transcript.canonical_ref),ref=identity(turn);
    const unique=typeof ref==='string'&&counts.get(ref)===1;
    let startMs=null,timing='unavailable';
    if(canonical&&unique){
      if(bound){const moment=buildEvidenceMomentLinks(bound,[ref.split('#').at(-1)],durationMs)[0];if(moment?.available)startMs=moment.startMs;}
      else if(detail.spine.candidateAttribution?.status==='VERIFIED'){
        const start=bounded(turn.startMs,durationMs),end=bounded(turn.endMs,durationMs);
        if(start!==null&&end!==null&&end>start)startMs=start;
      }
      if(startMs!==null)timing='recording-bound';
    }else if(unique){
      const receipt=fromSpine?turn.transcript?.timing_basis==='MESSAGE_RECEIPT'
        :conversation?.clock==='recording-observed'&&conversation?.timingBasis==='MESSAGE_RECEIPT'&&conversation.sessionId===detail.id;
      const start=bounded(turn.startMs,durationMs),end=bounded(turn.endMs,durationMs);
      if(receipt&&start!==null&&end!==null&&end>=start){startMs=start;timing='message-receipt';}
    }
    return {speaker:['student','applicant','user'].includes(turn.speaker)?'applicant':'interviewer',
      text:(fromSpine?turn.transcript.text:turn.text).trim(),canonical,identity:ref||null,t:startMs===null?null:startMs/1000,timing};
  }).filter(turn=>turn.text);
}
export function projectSavedAttempt(saved, subject) {
  const row=saved?.session, detail=saved?.sessionDetail;
  if(!subject || !saved?.persisted || !row?.id || detail?.id!==row.id || row.ownerSubject!==subject
      || detail.ownerSubject!==subject || row.state!=='saved' || detail.state!=='saved') return null;
  const analytics=detail.results?.payload?.analytics || {};
  const f=analytics.fable?.schema==='ivoc.fable51.evidence.v1' && analytics.fable.fixture!==true ? analytics.fable : {};
  const recording=detail.recording;
  const recordingMatches=Boolean(recording?.id && recording.status==='saved' && row.recording?.id===recording.id
    && (!recording.sessionId || recording.sessionId===detail.id)
    && (!recording.ownerSubject || recording.ownerSubject===subject));
  const durationMs=finite(recording?.durationMs) ?? finite(detail.results?.payload?.durationMs) ?? finite(analytics.durationMs);
  const realTrace=f.clock==='recording-observed';
  const sample = item => item?.fixture!==true && bounded(item?.t == null ? null : Number(item.t)*1000,durationMs)!==null;
  const at=Date.parse(detail.endedAt||detail.startedAt||detail.createdAt||'');
  return {id:detail.id,ownerSubject:subject,persisted:true,storage:'account',fixture:false,engineMode:'real',
    at:Number.isFinite(at)?at:null,mode:detail.interviewerProvider==='openai-gpt-live'?'mock':'practice',
    questionId:detail.questionId||null,questionText:detail.questionText||detail.title||'Saved answer',
    durationS:durationMs===null?null:Math.max(0,durationMs/1000),recordingId:recordingMatches?recording.id:null,
    samples:realTrace && Array.isArray(f.samples)?f.samples.filter(sample):[],
    events:realTrace && Array.isArray(f.events)?f.events.filter(sample):[],
    turns:projectReplayTurns(detail,durationMs),hooks:Array.isArray(f.hooks)?f.hooks.map(h=>({...h,replay:hookReplayBinding(h,detail,durationMs)})):[],closing:f.closing||null,
    conductor:f.conductor||null,settings:f.settings||null,transport:f.transport||null,calibrationUsed:f.calibrationUsed===true,
    priorityLane:f.debrief?.lane||null,priorityText:f.debrief?.text||null,analytics,detail,remote:detail,saved,
    comparison:attemptSnapshot({...row,...detail,recording}),
    sealed:{schema:analytics.schema||null,durationMs},measurementTimeline:analytics.flightRecorder||null,
    traceUnavailable:!realTrace,traceDecimated:f.retention?.decimated===true};
}
// Exact unique reference and exact character range, never a transcript-text join.
// Receipt timestamps locate provisional text, not measured speech boundaries.
export function hookReplayBinding(hook,detail,durationMs) {
  const ref=hook?.reference,conversation=detail?.results?.payload?.liveConversation;
  if(!ref||ref.basis!=='PROVISIONAL_TRANSCRIPT'||ref.sessionId!==detail.id||conversation?.sessionId!==detail.id
    ||conversation.clock!=='recording-observed'||conversation.timingBasis!=='MESSAGE_RECEIPT')return null;
  const matches=(conversation.turns||[]).filter(t=>t.id===ref.turnId);
  if(matches.length!==1)return null;
  const turn=matches[0],start=ref.startChar,end=ref.endChar;
  if(turn.speaker!=='student'||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<=start
    ||typeof turn.text!=='string'||turn.text.slice(start,end)!==hook.span)return null;
  const at=bounded(turn.startMs,durationMs),until=bounded(turn.endMs,durationMs);
  return at!==null&&until!==null&&until>=at?{at:at/1000,timing:'message-receipt',turnId:ref.turnId,startChar:start,endChar:end}:null;
}
export function nearestComparable(attempt, sessions=[]) {
  if(!attempt?.comparison) return null;
  return sessions.map(attemptSnapshot).filter(item=>canCompareAttempts(item,attempt.comparison)
    && item.at!==null && attempt.comparison.at!==null && item.at<attempt.comparison.at)
    .sort((a,b)=>b.at-a.at)[0]||null;
}
export function validReplaySeek(value, durationS) {
  const time=finite(value), duration=finite(durationS);
  return time!==null && time>=0 && duration!==null && duration>0 && time<=duration ? time : null;
}
// HQ returns a relative, short-lived authenticated playback route, not a public
// storage URL. Resolve it against the page without widening media authority.
export function privatePlaybackUrl(signed, recordingId, pageUrl) {
  if(!recordingId || signed?.recordingId!==recordingId || typeof signed.url!=='string')return null;
  try{
    const page=new URL(pageUrl),url=new URL(signed.url,page);
    const transport=page.protocol==='https:' || (page.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(page.hostname));
    return transport && url.origin===page.origin && !url.username && !url.password
      && url.pathname==='/api/ivoc/v1/recordings/'+encodeURIComponent(recordingId)+'/playback'
      ? url.href : null;
  }catch{return null;}
}
