// Fresh owner-scoped account evidence -> presentation. No cache, fixture or media owner.
import { buildEvidenceMomentLinks } from '../../../studio/presentation-view-model.mjs';
import { sourceBoundSelfPracticeResult } from '../../../capabilities/context-results.mjs';
import { attemptSnapshot, canCompareAttempts } from '../../../studio/longitudinal-model.mjs';
import { deriveDebrief } from '../model/teaching.mjs';

const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const bounded = (value, durationMs) => {
  const n = finite(value); return n !== null && n >= 0 && durationMs !== null && n <= durationMs ? n : null;
};
// Saved prose is derived, not authority. Recompute with current evidence rules
// for Home/Review/Results; never backfill or rewrite the canonical saved attempt.
export function projectDerivedPriority(evidence, durationS) {
  if (evidence?.schema !== 'ivoc.fable51.evidence.v1' || evidence.fixture !== false
      || evidence.clock !== 'recording-observed' || !Number.isFinite(durationS) || durationS < 0) return null;
  const eligible = item => item?.fixture !== true && typeof item?.t === 'number'
    && Number.isFinite(item.t) && item.t >= 0 && item.t <= durationS;
  const debrief = deriveDebrief({
    samples: Array.isArray(evidence.samples) ? evidence.samples.filter(eligible) : [],
    events: Array.isArray(evidence.events) ? evidence.events.filter(eligible) : [], turns: [],
    traceDecimated: evidence.retention?.decimated === true,
  });
  return debrief.change[0] ? { lane: debrief.change[0].lane, text: debrief.change[0].text } : null;
}
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
  const priority=projectDerivedPriority(f,durationMs===null?null:Math.max(0,durationMs/1000));
  return {id:detail.id,ownerSubject:subject,persisted:true,storage:'account',fixture:false,engineMode:'real',
    at:Number.isFinite(at)?at:null,mode:detail.interviewerProvider==='openai-gpt-live'?'mock':'practice',
    questionId:detail.questionId||null,questionText:detail.questionText||detail.title||'Saved answer',
    durationS:durationMs===null?null:Math.max(0,durationMs/1000),recordingId:recordingMatches?recording.id:null,
    samples:realTrace && Array.isArray(f.samples)?f.samples.filter(sample):[],
    events:realTrace && Array.isArray(f.events)?f.events.filter(sample):[],
    turns:projectReplayTurns(detail,durationMs),hooks:Array.isArray(f.hooks)?f.hooks.map(h=>({...h,replay:hookReplayBinding(h,detail,durationMs)})):[],closing:f.closing||null,
    conductor:f.conductor||null,settings:f.settings||null,transport:f.transport||null,calibrationUsed:f.calibrationUsed===true,
    priorityLane:priority?.lane||null,priorityText:priority?.text||null,analytics,detail,remote:detail,saved,
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
// Report only the admitted recording's retained scalar trace. A last-frame
// readout can be unavailable after capture stops without erasing earlier data.
// Counts/ranges are not time coverage, continuous runs, or a performance score.
export function retainedEvidenceReport(attempt) {
  const unavailable = 'Unavailable — no qualifying sample retained';
  const groups = [];
  const duration = attempt?.durationS;
  const admitted = attempt?.persisted === true && attempt.fixture === false
    && typeof duration === 'number'
    && Number.isFinite(duration) && duration >= 0;
  const eligible = item => admitted && attempt.traceUnavailable === false
    && item?.fixture !== true && typeof item?.t === 'number'
    && Number.isFinite(item.t) && item.t >= 0 && item.t <= duration;
  const samples = (Array.isArray(attempt?.samples) ? attempt.samples : []).filter(eligible);
  const events = (Array.isArray(attempt?.events) ? attempt.events : []).filter(eligible);
  const row = (label, selected, value) => ({label, value: selected.length ? value(selected) : unavailable,
    at: selected.length ? selected[0].t : null});
  const measured = (items, key, predicate = () => true) => items.filter(s => typeof s[key] === 'number'
    && Number.isFinite(s[key]) && predicate(s[key]));
  const range = (items, key, unit, digits = 0) => {
    const values = items.map(s => s[key]), low = Math.min(...values), high = Math.max(...values);
    return `${low.toFixed(digits)}–${high.toFixed(digits)} ${unit} · ${items.length} retained sample${items.length === 1 ? '' : 's'}`;
  };
  const tracked = samples.filter(s => s.presence === 'TRACKED');
  const facing = measured(tracked, 'facing', n => n >= 0 && n <= 100);
  const hands = samples.filter(s => ['NONE','LEFT','RIGHT','BOTH'].includes(s.hands));
  groups.push({label:'Captured visual evidence', rows:[
    row('Face/head tracking', tracked, items => `${items.length} tracked sample${items.length === 1 ? '' : 's'} retained`),
    row('Head orientation proxy', facing, items => range(items,'facing','% camera-facing proxy')),
    row('Hand visibility', hands, items => `${items.filter(s => s.hands !== 'NONE').length} with hands visible / ${items.length} retained detection samples`),
    ...[['smile','Smile patterns'],['nod','Head nods'],['gesture','Gesture units'],['framing','Framing observations']].map(([kind,label]) => {
      const selected = events.filter(e => e.kind === kind);
      return {label,value:selected.length ? `${selected.length} event${selected.length === 1 ? '' : 's'} retained` : 'No qualifying event retained',
        at:selected[0]?.t ?? null};
    }),
  ]});
  const speech = samples.filter(s => s.state === 'ANSWERING' && s.speaking === true && s.signalGap !== true);
  groups.push({label:'Captured candidate voice', rows:[
    row('Pace', measured(speech,'wpm',n => n > 0), items => range(items,'wpm','WPM')),
    row('Loudness (LUFS-K)', measured(speech.filter(s => s.loudnessUnit === 'LUFS-K'),'loudness'), items => range(items,'loudness','LUFS-K',1)),
    row('Volume (dBFS)', measured(speech.filter(s => s.loudnessUnit === 'dBFS'),'loudness'), items => range(items,'loudness','dBFS',1)),
    row('Voiced pitch', measured(speech,'f0Hz',n => n > 0), items => range(items,'f0Hz','Hz')),
  ]});
  // Film Room uses the older measurement timeline when no Fable samples exist.
  // Keep its lanes separate: it has neither answer-state nor event-count evidence.
  const timeline=attempt?.measurementTimeline;
  const points=admitted && !samples.length && timeline?.fixture!==true
    && timeline?.schema==='ivoc.measurement-timeline.v1' && timeline.clock==='recording-observed'
    && Array.isArray(timeline.points) ? timeline.points.filter(p=>p && typeof p==='object' && p.fixture!==true
      && typeof p.atMs==='number' && Number.isFinite(p.atMs) && p.atMs>=0 && p.atMs<=duration*1000
      && ['voice','delivery'].includes(p.lane)).map(p=>({...p,t:p.atMs/1000})) : [];
  let legacyAvailable=false;
  if(points.length){
    const voice=points.filter(p=>p.lane==='voice'),delivery=points.filter(p=>p.lane==='delivery');
    const voiceSpeech=voice.filter(p=>p.speaking===true);
    const booleanRow=(label,items,key,active='active')=>{
      const selected=items.filter(p=>typeof p[key]==='boolean');
      return row(label,selected,values=>`${values.filter(p=>p[key]).length} ${active} / ${values.length} retained observations`);
    };
    const rows=[
      row('Voice level (dBFS)',measured(voiceSpeech,'level'),items=>range(items,'level','dBFS',1)),
      row('Voiced pitch',measured(voiceSpeech,'pitch',n=>n>0),items=>range(items,'pitch','Hz')),
      booleanRow('Speech / silence',voice,'speaking','speech'),
      booleanRow('Head facing camera',delivery,'facing'),
      row('Hands in view',measured(delivery,'hands',n=>Number.isInteger(n)&&n>=0&&n<=2),items=>range(items,'hands','hands')),
      booleanRow('Hand-region movement',delivery,'movement'),
      booleanRow('Mouth-corner elevation',delivery,'mouth'),
      booleanRow('Qualified smile pattern',delivery,'smile'),
    ];
    legacyAvailable=rows.some(r=>r.at!==null);
    if(legacyAvailable)groups.push({label:'Earlier Flight Recorder observations',rows});
  }
  return {groups, available:samples.length > 0 || events.length > 0 || legacyAvailable,
    note:'These are retained observations, not percentages of interview time or a readiness score. Missing intervals are not reconstructed. Open Film Room to inspect the synchronized evidence.'
      +(legacyAvailable?' The earlier timeline does not identify answering turns or event counts.':'')};
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
