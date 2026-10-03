// The production 3528C composition root is reused, never duplicated.
// Rehearsal and recording have distinct epochs but retain one capture stream.
const ENGINE='/iv-prep-on-call/assets';
export function invalidateDeviceCalibration(real) {
  real.cancelFaceBaseline?.('DEVICE_CHANGED_RECALIBRATION_REQUIRED');
  real.behavior.setBaseline(null);
  real.behavior.reset(real.bridge.sessionClock.sessionMs());
  real.pipeline.clearPersonalCalibration();
}
// New measurement answer, not a new capture/session clock. The bridge owns it.
export function beginMeasurementEpoch(real,{mediaStartedAt=null}={}) {
  const clock=real.bridge.sessionClock;
  real.transcript.stop(); real.pipeline.abandonAnswer('preflight_complete');
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
      return {at:record.createdAtMs,staleAt:record.staleAtMs,resolved:{...resolved},engineMode:'real',fixture:false,corridors:record.corridors};
    },
    beginFaceBaseline(){return real.pipeline.beginPersonalFaceBaseline();},
    endFaceBaseline(){return real.pipeline.endPersonalFaceBaseline();},
    abandonPreview(){real.pipeline.abandonAnswer('preflight_complete');real.transcript.stop();},
    interviewerTurn(kind,{questionId=null,source='REMOTE_VAD'}={}) {const atMs=real.clock?.sessionMs()||0; if(kind==='started') real.behavior.interviewerTurnStarted({atMs,questionId,source}); else real.behavior.interviewerTurnEnded({atMs,questionId});},
    setOverlayVisibility(value){return real.setOverlayVisibility(value);},
    async switchDevice(kind,id) {
      if(destroyed)throw new Error('Device capture has closed.');
      try{
        const devices=await real.switchDevice(kind,id);
        if(destroyed)throw new Error('The device change was cancelled.');
        baselines.invalidateForDeviceChange(subject);baseline=null;invalidateDeviceCalibration(real);return devices;
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
