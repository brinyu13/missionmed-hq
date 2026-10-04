// The production 3528C composition root is reused, never duplicated.
// Rehearsal and recording have distinct epochs but retain one capture stream.
import {COACHING_CONFIG} from '../../../analytics/coaching-config.mjs';
const ENGINE='/iv-prep-on-call/assets';
const RESOLUTION_KEYS=['readiness','framing','faceBaseline','smile','nods','hands','gesture','volume','pitch','pace','volumeRange','pauseHold','paceRange'];
const RESOLUTION_VALUES=new Set(['resolved','partial','not']);
const PROFILE_FIELDS={audio:['sampleRate','channelCount','echoCancellation','noiseSuppression','autoGainControl'],video:['width','height','frameRate']};
const projectedResolutions=value=>Object.fromEntries(RESOLUTION_KEYS.filter(key=>RESOLUTION_VALUES.has(value?.[key])).map(key=>[key,value[key]]));
function safeResolutionProfile(value) {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!Object.hasOwn(PROFILE_FIELDS,key)))return null;
  const profile={};
  for(const [kind,fields]of Object.entries(PROFILE_FIELDS)) {
    const part=value[kind];
    if(!part||typeof part!=='object'||Array.isArray(part)||Object.keys(part).some(key=>!fields.includes(key)))return null;
    if(Object.values(part).some(v=>typeof v!=='boolean'&&(typeof v!=='number'||!Number.isFinite(v))))return null;
    profile[kind]=Object.fromEntries(fields.filter(key=>Object.hasOwn(part,key)).map(key=>[key,part[key]]));
  }
  return profile;
}
function resolutionBinding(subject,record,deviceProfile,now) {
  const profile=safeResolutionProfile(record?.deviceProfile),current=safeResolutionProfile(deviceProfile);
  if(!/^wp:[1-9][0-9]*$/.test(String(subject||''))||record?.schemaVersion!==1||record.configVersion!==COACHING_CONFIG.version
    ||!Number.isSafeInteger(record.createdAtMs)||record.createdAtMs<0||record.createdAtMs>now
    ||record.staleAtMs!==record.createdAtMs+COACHING_CONFIG.baseline.staleAfterDays*86_400_000||now>=record.staleAtMs
    ||!profile||!current||JSON.stringify(profile)!==JSON.stringify(current))return null;
  return {subject,configVersion:record.configVersion,createdAtMs:record.createdAtMs,staleAtMs:record.staleAtMs,deviceProfile:profile};
}
// Presentation metadata only. BaselineStore remains the sole calibration authority.
export class CalibrationResolutionStore {
  constructor({storage=globalThis.localStorage,now=()=>Date.now()}={}) {this.storage=storage;this.now=now;}
  key(subject) {if(!/^wp:[1-9][0-9]*$/.test(String(subject||'')))throw new Error('An admitted calibration subject is required.');return 'ivoc.fable.calibration-resolution.v1:'+subject;}
  clear(subject) {try{this.storage.removeItem(this.key(subject));}catch{}}
  save(subject,baseline,resolved) {
    const binding=resolutionBinding(subject,baseline,baseline?.deviceProfile,this.now());
    if(!binding)throw new Error('A current device-bound personal baseline is required to save the calibration record.');
    const record={schema:'ivoc.fable.calibration-resolution.v1',binding,resolved:projectedResolutions(resolved)};
    this.storage.setItem(this.key(subject),JSON.stringify(record));
    const saved=this.load(subject,baseline,{deviceProfile:baseline.deviceProfile});
    if(!saved)throw new Error('The calibration resolution record could not be saved.');
    return saved;
  }
  load(subject,baseline,{deviceProfile=baseline?.deviceProfile}={}) {
    try {
      const binding=resolutionBinding(subject,baseline,deviceProfile,this.now());
      const raw=this.storage.getItem(this.key(subject));
      if(!raw)return null;
      const record=JSON.parse(raw),resolved=projectedResolutions(record?.resolved);
      if(!binding||record?.schema!=='ivoc.fable.calibration-resolution.v1'
        ||Object.keys(record).some(key=>!['schema','binding','resolved'].includes(key))
        ||JSON.stringify(record.binding)!==JSON.stringify(binding)||!record.resolved||typeof record.resolved!=='object'||Array.isArray(record.resolved)
        ||Object.keys(resolved).length!==Object.keys(record.resolved).length) {this.clear(subject);return null;}
      return {at:binding.createdAtMs,staleAt:binding.staleAtMs,resolved,engineMode:'real',fixture:false,corridors:baseline.corridors};
    }catch{this.clear(subject);return null;}
  }
}
// React only to the real producer's bounded primary-lock state, never raw geometry.
export function bindPrimaryRecovery(host,{engine,isCurrent=()=>true}={}) {
  const button=host?.querySelector('[data-reselect-primary]'),copy=host?.querySelector('[data-primary-status]');
  if(!host||!button||!copy)return()=>{};
  let disposed=false,pending=false;
  const current=()=>!disposed&&isCurrent();
  const update=detail=>{
    if(!current()||detail?.state!=='primary-lock')return;
    const lock=detail.primaryLock,required=lock?.selectionRequired===true||lock?.state==='PRIMARY_SELECTION_REQUIRED';
    if(required)pending=false;
    else if(lock?.state==='PRIMARY_LOCKED')pending=false;
    host.hidden=!required&&!pending;button.disabled=!required;
    copy.textContent=required?'Select yourself. Person-specific measurements are withheld until your lock is stable.':'Center yourself in the guide. Measurements remain withheld while selection restarts.';
  };
  const listener=event=>update(event.detail);
  const click=()=>{
    if(!current()||button.disabled)return;
    try{
      if(engine.reselectPrimary()===true){pending=true;button.disabled=true;copy.textContent='Center yourself in the guide. Measurements remain withheld while selection restarts.';}
      else copy.textContent='Person selection is not ready. Measurements remain withheld; try again when the camera is connected.';
    }catch{copy.textContent='Person selection could not restart. Measurements remain withheld; reconnect the camera before trying again.';}
  };
  engine.events.addEventListener('state',listener);button.addEventListener('click',click);
  update({state:'primary-lock',primaryLock:engine.real?.pipeline?.diagnostics?.().primaryLock});
  return()=>{disposed=true;engine.events.removeEventListener('state',listener);button.removeEventListener('click',click);host.hidden=true;};
}
export function invalidateDeviceCalibration(real) {
  real.cancelFaceBaseline?.('DEVICE_CHANGED_RECALIBRATION_REQUIRED');
  // A new input invalidates device-bound baselines, not the active interview.
  // Resetting the whole behavior runtime erases turns and leaves it in SETUP.
  real.behavior.calibration.reset(real.bridge.sessionClock.sessionMs());
  real.behavior.setBaseline(null);
  real.pipeline.clearPersonalCalibration();
}
// New measurement answer, not a new capture/session clock. The bridge owns it.
export function beginMeasurementEpoch(real,{mediaStartedAt=null}={}) {
  const clock=real.bridge.sessionClock;
  real.transcript.stop(); real.pipeline.abandonAnswer('preflight_complete', { preservePrimary: true });
  real.history=[]; real.events=[]; real.lastHistoryAt=-Infinity; real.lastRecordedState=null;
  real.lastCounts={smiles:0,nods:0,gestures:0}; real.latestAudioSpeaking=false;
  real.projector.reset();
  const atMs=clock.sessionMs(); real.behavior.reset(atMs);
  real.pipeline.beginAnswer({videoElement:real.video,mediaStartedAt});
  if(real.bridge.sessionClock!==clock)throw new Error('The capture clock changed during measurement startup.');
  real.clock=clock; real.behavior.beginInterview(atMs,{explicitMeasurementStart:true}); real.running=true;
  void real.startTranscriptTiming(real.bridge.media.stream);
}
export async function createEngine({mode='real',video,overlayCanvas,csrfToken='',subject}={}) {
  if(mode!=='real') throw new Error('Simulated Analytics are disabled in production.');
  const [{RealAnalyticsEngine},{BaselineStore},{MetricBus},{MeasurementTimeline},di]=await Promise.all([
    import(ENGINE+'/ivoc-standalone/app/real-runtime.mjs'),import(ENGINE+'/live-analytics/baseline-store.mjs'),
    import(ENGINE+'/studio/metric-bus.mjs'),import(ENGINE+'/studio/flight-recorder-view.mjs'),import(ENGINE+'/analytics/di-groups-ui.mjs')
  ]);
  const real=new RealAnalyticsEngine({video,overlayCanvas,csrfToken});
  const events=new EventTarget(); const baselines=new BaselineStore();
  const resolutions=new CalibrationResolutionStore({storage:baselines.storage,now:baselines.now});
  let recordingOrigin=null; let baseline=null;let destroyed=false;
  const bus=new MetricBus(), timeline=new MeasurementTimeline(); let readouts={};
  const diagnostic=event=>{
    if(recordingOrigin===null || !real.running)return;
    const detail=event.detail||{}, metrics=bus.ingest(detail);
    if(metrics)timeline.ingest(detail,metrics,performance.now()-recordingOrigin);
    if(detail.modality==='audio')readouts={...readouts,...di.voiceLaneReadouts(detail),...di.pitchLaneReadouts(detail.pitch)};
    else if(detail.modality==='vision')readouts={...readouts,...di.faceLaneReadouts(detail.faceFamily),...di.bodyLaneReadouts(detail.geometry)};
  };
  let diagnosticPipeline=null;
  const profile=()=>{
    const settings=kind=>real.bridge.media?.stream?.[kind]?.()[0]?.getSettings?.()||{};
    const audio=settings('getAudioTracks'),camera=settings('getVideoTracks');
    const project=(s,fields)=>Object.fromEntries(fields.filter(k=>typeof s[k]==='number'||typeof s[k]==='boolean').map(k=>[k,s[k]]));
    return {audio:project(audio,['sampleRate','channelCount','echoCancellation','noiseSuppression','autoGainControl']),video:project(camera,['width','height','frameRate'])};
  };
  const applyBaseline=record=>{
    baseline=record; if(!record) return;
    real.behavior.setBaseline(record.derived); real.pipeline.setPersonalCalibration(record.derived);
  };
  let previousCounts={smiles:0,nods:0,gestures:0};
  real.addEventListener('frame',event=>{
    const frame=event.detail;
    const smiles=frame.headFace?.smileEvents,nods=frame.headFace?.nods,gestures=frame.bodyHands?.gestures;
    const cue=real.behavior.latest?.cue;
    events.dispatchEvent(new CustomEvent('frame',{detail:{...frame,fixture:false,
      t:recordingOrigin===null?frame.t:Math.max(0,(performance.now()-recordingOrigin)/1000),
      cue:cue && (!Number.isFinite(cue.expiresAtMs)||real.clock.sessionMs()<=cue.expiresAtMs)?{id:cue.id,message:cue.message,detail:''}:null,
      headFace:{...frame.headFace,smileNow:Number.isFinite(smiles)&&smiles>previousCounts.smiles,nodNow:Number.isFinite(nods)&&nods>previousCounts.nods},
      bodyHands:{...frame.bodyHands,gestureNow:Number.isFinite(gestures)&&gestures>previousCounts.gestures,framing:frame.bodyHands?.inFrame?'IN FRAME':'UNAVAILABLE'}
    }}));
    if(Number.isFinite(smiles)) previousCounts.smiles=smiles;
    if(Number.isFinite(nods)) previousCounts.nods=nods;
    if(Number.isFinite(gestures)) previousCounts.gestures=gestures;
  });
  for(const [source,target] of [['pipeline-state','state'],['word-timing-state','word-timing']]) real.addEventListener(source,e=>events.dispatchEvent(new CustomEvent(target,{detail:e.detail})));
  return {
    mode:'real',label:'Live camera + microphone',events,real,
    async start(options={}) {
      const stream=await real.start(options);
      diagnosticPipeline=real.pipeline; diagnosticPipeline.addEventListener('diagnostic',diagnostic);
      applyBaseline(baselines.load(subject,{deviceProfile:profile()})); return stream;
    },
    get latest(){return real.latest;},get stream(){return real.bridge.media.stream;},get audioContext(){return real.bridge.audioContext;},get personalCalibration(){return baseline;},
    resumeInputAudio(){return real.bridge.primeAudioContext();},
    get calibrationResolution(){
      const current=baselines.load(subject,{deviceProfile:profile()});
      if(current?.createdAtMs!==baseline?.createdAtMs||current?.configVersion!==baseline?.configVersion)return null;
      return resolutions.load(subject,current,{deviceProfile:profile()});
    },
    setPhase(){},beginAnswer(){
      recordingOrigin=null;previousCounts={smiles:0,nods:0,gestures:0};
      beginMeasurementEpoch(real);applyBaseline(baseline);
    },
    async beginSession({recordingOrigin:origin}={}) {
      if(!Number.isFinite(origin))throw new Error('A recording timebase is required.');
      bus.reset();timeline.reset();readouts={};
      previousCounts={smiles:0,nods:0,gestures:0};
      beginMeasurementEpoch(real,{mediaStartedAt:origin});
      applyBaseline(baseline);recordingOrigin=origin;
    },
    sealCalibration(resolved={}) {
      const derived=real.behavior.calibrationDerived();
      if(!derived || !Object.values(derived).some(value=>typeof value==='number'&&Number.isFinite(value))) throw new Error('Speak during rehearsal before saving a personal calibration.');
      const record=baselines.save(subject,derived,{deviceProfile:profile()}); applyBaseline(record);
      return resolutions.save(subject,record,resolved);
    },
    beginFaceBaseline(){return real.pipeline.beginPersonalFaceBaseline();},
    endFaceBaseline(){return real.pipeline.endPersonalFaceBaseline();},
    abandonPreview(){real.pipeline.abandonAnswer('preflight_complete', { preservePrimary: true });real.transcript.stop();},
    interviewerTurn(kind,{questionId=null,source='REMOTE_VAD'}={}) {const atMs=real.clock?.sessionMs()||0; if(kind==='started') real.behavior.interviewerTurnStarted({atMs,questionId,source}); else real.behavior.interviewerTurnEnded({atMs,questionId});},
    setOverlayVisibility(value){return real.setOverlayVisibility(value);},
    async switchDevice(kind,id,coordinator) {
      if(destroyed)throw new Error('Device capture has closed.');
      try{
        const devices=await real.switchDevice(kind,id,coordinator);
        if(destroyed)throw new Error('The device change was cancelled.');
        baselines.invalidateForDeviceChange(subject);resolutions.clear(subject);baseline=null;invalidateDeviceCalibration(real);return devices;
      }finally{if(destroyed)real.destroy({releaseMedia:true});}
    },
    reselectPrimary(){return real.pipeline.reselectPrimary();},
    async finish(){
      const result=await real.finish();if(!result?.analytics)return result;
      return {...result,analytics:{...result.analytics,flightRecorder:timeline.snapshot(),deliveryIntelligence:{schema:'ivoc.delivery-intelligence.view-model.v1',readouts:{...readouts}}}};
    },destroy({releaseMedia=true,preserveVideoBinding=false}={}){
      destroyed=true;
      diagnosticPipeline?.removeEventListener('diagnostic',diagnostic);
      if(preserveVideoBinding)real.video=null;
      real.destroy({releaseMedia});
    }
  };
}
