// Bounded presentation trace, never another canonical transcript or raw biometric store.
const text=(v,n=240)=>typeof v==='string'?v.slice(0,n):null;
const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const cue=v=>v===-1||v===0||v===1?v:null;
const thin=(items,limit)=>items.length<=limit?items:items.filter((_,i)=>i%Math.ceil(items.length/limit)===0);
const settingKeys=new Set(['preset','role','style','depth','curiosity','pressure','interruption','pacing','maxFollowUps','programEmphasis','targetQuestions','durationMin','voice','advanced']);
const hookReference=value=>value&&value.basis==='PROVISIONAL_TRANSCRIPT'&&typeof value.sessionId==='string'&&/^[0-9a-f-]{36}$/.test(value.sessionId)
  &&typeof value.turnId==='string'&&value.turnId.length>0&&value.turnId.length<=240
  &&Number.isSafeInteger(value.startChar)&&Number.isSafeInteger(value.endChar)&&value.startChar>=0&&value.endChar>value.startChar&&value.endChar<=8000
  ?{sessionId:value.sessionId,turnId:value.turnId,startChar:value.startChar,endChar:value.endChar,basis:value.basis}:null;
export function sealDerivedEvidence(record={}) {
  const input=Array.isArray(record.samples)?record.samples:[];
  const samples=thin(input.filter(s=>s?.fixture!==true&&number(s?.t)!==null&&s.t>=0),1200).map(s=>({
    ...Object.fromEntries(['t','vol','pitch','pace','variety','facing','nods','smiles','gestures','wpm','loudness','f0Hz'].map(k=>[k,number(s[k])])),
    state:text(s.state,32),hands:text(s.hands,32),presence:text(s.presence,32),loudnessUnit:text(s.loudnessUnit,32),
    speaking:s.speaking===true,signalGap:s.signalGap===true,
    paceCue:cue(s.paceCue),volumeCue:cue(s.volumeCue),
    scores:Object.fromEntries(['pace','volume','variety'].map(k=>[k,number(s.scores?.[k])]))
  }));
  const events=thin((Array.isArray(record.events)?record.events:[]).filter(e=>e?.fixture!==true&&number(e?.t)!==null&&e.t>=0),512)
    .map(e=>({t:e.t,kind:text(e.kind,32),label:text(e.label,160),state:text(e.state,32)}));
  const hooks=(Array.isArray(record.hooks)?record.hooks:[]).slice(0,32).map(h=>({questionId:text(h.questionId,96),span:text(h.span,500),
    category:text(h.category,64),decision:text(h.decision,64),taken:h.taken===true,attempted:h.attempted===true,followUp:text(h.followUp,1000),verdict:text(h.verdict,240),reference:hookReference(h.reference)}));
  const closing=record.closing?{status:text(record.closing.status,32),label:text(record.closing.label,240),
    candidateQuestions:number(record.closing.candidateQuestions),closeDelivered:record.closing.closeDelivered===true}:null;
  const evidence={schema:'ivoc.fable51.evidence.v1',clock:'recording-observed',fixture:false,samples,events,hooks,closing,
    conductor:null,turns:[],debrief:{lane:text(record.priorityLane,32),text:text(record.priorityText,500)},
    transport:text(record.transport,32),calibrationUsed:record.calibrationUsed===true,
    settings:Object.fromEntries(Object.entries(record.settings||{}).filter(([k,v])=>k==='initialPresentationMode'?['interview','coached'].includes(v):settingKeys.has(k)&&['string','boolean','number'].includes(typeof v))
      .map(([k,v])=>[k,typeof v==='string'?text(v,96):typeof v==='number'?number(v):v])),
    retention:{sampleCount:input.length,retainedSamples:samples.length,eventCount:Array.isArray(record.events)?record.events.length:0,retainedEvents:events.length,decimated:input.length>samples.length}};
  if(new TextEncoder().encode(JSON.stringify(evidence)).byteLength>512*1024)throw new Error('The derived presentation trace exceeds its safe save budget.');
  return evidence;
}
