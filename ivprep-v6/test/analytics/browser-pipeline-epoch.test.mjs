import test from 'node:test';
import assert from 'node:assert/strict';

if (!globalThis.CustomEvent) globalThis.CustomEvent = class CustomEvent extends Event { constructor(type, init = {}) { super(type);this.detail=init.detail; } };
globalThis.document = {
  hidden: false,
  addEventListener() {},
  removeEventListener() {},
  getElementById() { return null; },
};

const { BrowserAnalyticsPipeline, visionFrameDimensions, visionFrameWatchdogMs } = await import('../../public/analytics/browser-pipeline.mjs');

test('vision capture preserves source aspect ratio inside the 480 by 270 analysis box',()=>{
  assert.deepEqual(visionFrameDimensions(1_280,720),{width:480,height:270});
  assert.deepEqual(visionFrameDimensions(640,480),{width:360,height:270});
  assert.deepEqual(visionFrameDimensions(720,1_280),{width:152,height:270});
});

test('Holistic frame watchdog follows the bounded scheduler budget',()=>{
  assert.equal(visionFrameWatchdogMs(125),1_000);
  assert.equal(visionFrameWatchdogMs(500),2_000);
  assert.equal(visionFrameWatchdogMs(2_000),5_000);
  assert.equal(visionFrameWatchdogMs(Number.NaN),1_000);
});

test('a silent Holistic frame times out, releases its slot, and ignores a late reply',()=>{
  const priorSetTimeout=globalThis.setTimeout;
  const priorClearTimeout=globalThis.clearTimeout;
  const timers=new Map();let nextTimer=0;
  globalThis.setTimeout=(callback,delay)=>{const id=++nextTimer;timers.set(id,{callback,delay});return id};
  globalThis.clearTimeout=(id)=>{timers.delete(id)};
  let now=250;let holisticTerminated=0;let faceTerminated=0;let closed=0;let diagnosticCount=0;
  const pipeline=new BrowserAnalyticsPipeline({bridge:{media:{}},now:()=>now});
  try{
    pipeline.beginAnswer({answerId:'silent-holistic'});
    const generation=pipeline.generation;
    const answerEpoch=pipeline.answerEpoch;
    const visionEpoch=pipeline.visionEpoch;
    const states=[];
    pipeline.addEventListener('state',(event)=>states.push(event.detail));
    pipeline.addEventListener('diagnostic',()=>{diagnosticCount+=1});
    pipeline.worker={terminate(){holisticTerminated+=1}};
    pipeline.faceWorker={terminate(){faceTerminated+=1}};
    pipeline.workerReady=true;
    pipeline.faceWorkerReady=true;
    pipeline.multiFaceProtection=true;
    pipeline.inFlightVision={generation,answerEpoch,visionEpoch,frameId:17,timestampMs:200,expectedFrameMs:125,captureStartedAt:100};
    pipeline.frameInFlight=true;
    pipeline.armVisionFrameWatchdog(pipeline.inFlightVision);
    const watchdog=timers.get(pipeline.visionFrameTimer);
    assert.equal(watchdog.delay,1_000);
    now=1_250;watchdog.callback();
    assert.equal(pipeline.frameInFlight,false);
    assert.equal(pipeline.inFlightVision,null);
    assert.equal(pipeline.worker,null);
    assert.equal(pipeline.faceWorker,null);
    assert.equal(holisticTerminated,1);
    assert.equal(faceTerminated,1);
    assert.equal(pipeline.generation,generation+1);
    assert.match(pipeline.diagnostics().workerErrors.at(-1),/holistic frame timed out/u);
    const partial=states.find((detail)=>detail.state==='partial'&&detail.subsystem==='vision');
    assert.equal(partial.atMs,1_000);
    assert.equal(Number.isFinite(partial.atMs),true);

    pipeline.onWorkerMessage({
      type:'geometry',generation,answerEpoch,visionEpoch,frameId:17,timestampMs:200,expectedFrameMs:125,
      geometry:{faceCount:1,face:{present:true},pose:{torsoPresent:true},hands:{}},
      overlayBitmap:{close(){closed+=1}},overlayRendered:true,
    },generation);
    assert.equal(closed,1);
    assert.equal(diagnosticCount,0);
    assert.equal(pipeline.session.vision.frames,0);
    assert.equal(pipeline.frameInFlight,false);
  }finally{
    pipeline.destroy();
    globalThis.setTimeout=priorSetTimeout;
    globalThis.clearTimeout=priorClearTimeout;
  }
});

test('an already queued old Holistic watchdog cannot terminate a newer owned frame',()=>{
  const priorSetTimeout=globalThis.setTimeout;
  const priorClearTimeout=globalThis.clearTimeout;
  const timers=new Map();let nextTimer=0;let terminated=0;
  globalThis.setTimeout=(callback,delay)=>{const id=++nextTimer;timers.set(id,{callback,delay});return id};
  globalThis.clearTimeout=(id)=>{timers.delete(id)};
  const pipeline=new BrowserAnalyticsPipeline({bridge:{media:{}},now:()=>0});
  try{
    pipeline.beginAnswer({answerId:'watchdog-ownership'});
    pipeline.worker={terminate(){terminated+=1}};
    const shared={generation:pipeline.generation,answerEpoch:pipeline.answerEpoch,visionEpoch:pipeline.visionEpoch,expectedFrameMs:125,captureStartedAt:0};
    pipeline.inFlightVision={...shared,frameId:1,timestampMs:10};
    pipeline.frameInFlight=true;
    pipeline.armVisionFrameWatchdog(pipeline.inFlightVision);
    const oldTimerId=pipeline.visionFrameTimer;
    const oldCallback=timers.get(oldTimerId).callback;
    pipeline.inFlightVision={...shared,frameId:2,timestampMs:20};
    pipeline.armVisionFrameWatchdog(pipeline.inFlightVision);
    const currentTimerId=pipeline.visionFrameTimer;
    oldCallback();
    assert.equal(terminated,0);
    assert.equal(pipeline.visionFrameTimer,currentTimerId);
    assert.equal(pipeline.inFlightVision.frameId,2);
  }finally{
    pipeline.destroy();
    globalThis.setTimeout=priorSetTimeout;
    globalThis.clearTimeout=priorClearTimeout;
  }
});

test('late worker geometry from a prior answer epoch is ignored',()=>{
  let now=0;
  const pipeline=new BrowserAnalyticsPipeline({bridge:{media:{}},now:()=>now});
  pipeline.beginAnswer({answerId:'first'});
  const firstEpoch=pipeline.answerEpoch;
  now=1_000;pipeline.endAnswer({endAt:now});
  now=1_100;pipeline.beginAnswer({answerId:'second'});
  assert.notEqual(pipeline.answerEpoch,firstEpoch);
  pipeline.onWorkerMessage({
    type:'geometry',generation:pipeline.generation,answerEpoch:firstEpoch,timestampMs:500,inferenceMs:10,
    geometry:{faceCount:1,face:{present:false},pose:{torsoPresent:false},hands:{}},
  },pipeline.generation);
  assert.equal(pipeline.session.vision.frames,0);
  pipeline.destroy();
});

test('diagnostics retain unavailable multi-face protection state',()=>{
  const pipeline=new BrowserAnalyticsPipeline({bridge:{media:{}},now:()=>0});
  assert.equal(pipeline.diagnostics().faceDetectorStatus,'idle');
  pipeline.beginAnswer({answerId:'a'});
  pipeline.onFaceWorkerMessage({type:'init-error',generation:pipeline.generation,answerEpoch:pipeline.answerEpoch,message:'local detector failed'},pipeline.generation);
  assert.equal(pipeline.diagnostics().multiFaceProtection,false);
  assert.equal(pipeline.diagnostics().faceDetectorStatus,'unavailable');
  assert.deepEqual(pipeline.diagnostics().workerErrors,['multi-face protection: local detector failed']);
  pipeline.destroy();
});

test('face detector diagnostics expose capability lifecycle without claiming a stale guard',()=>{
  const pipeline=new BrowserAnalyticsPipeline({bridge:{media:{}},now:()=>0});
  pipeline.faceWorker={terminate(){}};
  pipeline.faceWorkerReady=false;
  pipeline.multiFaceProtection=false;
  assert.equal(pipeline.diagnostics().faceDetectorStatus,'initializing');
  pipeline.faceWorkerReady=true;
  pipeline.multiFaceProtection=true;
  assert.equal(pipeline.diagnostics().faceDetectorStatus,'ready');
  pipeline.faceWorker=null;
  assert.equal(pipeline.diagnostics().faceDetectorStatus,'unavailable');
  pipeline.destroy();
});

test('same-frame FaceDetector result is joined before Holistic inference',()=>{
  let now=0;const pipeline=new BrowserAnalyticsPipeline({bridge:{media:{}},now:()=>now});
  pipeline.beginAnswer({answerId:'a'});
  const posted=[];const bitmap={close(){throw new Error('joined bitmap must transfer, not close')}};
  pipeline.worker={postMessage(message,transfer){posted.push({message,transfer})},terminate(){}};
  pipeline.pendingVisionFrame={bitmap,generation:pipeline.generation,answerEpoch:pipeline.answerEpoch,visionEpoch:pipeline.visionEpoch,frameId:7,timestampMs:125,expectedFrameMs:125,captureStartedAt:0};
  pipeline.frameInFlight=true;
  const lock={state:'PRIMARY_LOCKED',zoneStatus:'primary_inside',continuity:'locked',bystanderCount:0,excludedDurationMs:0,reacquisitionCount:0,selectionRequired:false,withheldIntervals:[]};
  now=20;pipeline.onFaceWorkerMessage({type:'primary-lock',generation:pipeline.generation,answerEpoch:pipeline.answerEpoch,visionEpoch:pipeline.visionEpoch,frameId:7,timestampMs:125,faceCount:1,primaryTrackId:'primary-1',primaryUsable:true,primaryRoi:{left:.1,top:.1,width:.8,height:.8},primaryLock:lock,faceInferenceMs:18},pipeline.generation);
  assert.equal(posted.length,1);
  assert.equal(posted[0].message.faceCount,1);
  assert.equal(posted[0].message.frameId,7);
  assert.equal(posted[0].message.timestampMs,125);
  assert.equal(posted[0].message.faceInferenceMs,18);
  assert.equal(posted[0].message.primaryTrackId,'primary-1');
  assert.equal(posted[0].message.primaryUsable,true);
  assert.deepEqual(posted[0].message.primaryLock,lock);
  assert.deepEqual(posted[0].transfer,[bitmap]);
  assert.equal(pipeline.pendingVisionFrame,null);
  pipeline.destroy();
});

test('face timeout disables the safety worker and cannot queue another face frame',()=>{
  const pipeline=new BrowserAnalyticsPipeline({bridge:{media:{}},now:()=>0});
  pipeline.beginAnswer({answerId:'a'});
  let terminated=0;const posted=[];
  pipeline.faceWorker={terminate(){terminated+=1}};
  pipeline.faceWorkerReady=true;
  pipeline.worker={postMessage(message){posted.push(message)},terminate(){}};
  pipeline.pendingVisionFrame={bitmap:{close(){}},generation:pipeline.generation,answerEpoch:pipeline.answerEpoch,visionEpoch:pipeline.visionEpoch,frameId:3,timestampMs:50,expectedFrameMs:125,captureStartedAt:0};
  pipeline.frameInFlight=true;
  pipeline.failFaceWorker('face safety frame timed out');
  assert.equal(terminated,1);
  assert.equal(pipeline.faceWorker,null);
  assert.equal(pipeline.faceWorkerReady,false);
  assert.equal(posted.length,1);
  assert.equal(posted[0].faceCount,null);
  pipeline.destroy();
});

test('hidden or disconnected vision invalidates every older reply and closes its overlay',()=>{
  let now=0;const pipeline=new BrowserAnalyticsPipeline({bridge:{media:{}},now:()=>now});
  pipeline.beginAnswer({answerId:'a'});
  const resets=[];
  pipeline.worker={postMessage:(message)=>resets.push(['holistic',message]),terminate(){}};
  pipeline.faceWorker={postMessage:(message)=>resets.push(['face',message]),terminate(){}};
  const oldVisionEpoch=pipeline.visionEpoch;let closed=0;let diagnostics=0;
  pipeline.addEventListener('diagnostic',()=>{diagnostics+=1});
  pipeline.inFlightVision={generation:pipeline.generation,answerEpoch:pipeline.answerEpoch,visionEpoch:oldVisionEpoch,frameId:9,timestampMs:100,captureStartedAt:0};
  pipeline.frameInFlight=true;
  pipeline.invalidateVision('document_hidden');
  assert.deepEqual(resets.map(([worker,message])=>[worker,message.type,message.answerEpoch]),[['holistic','reset',pipeline.answerEpoch],['face','reset',pipeline.answerEpoch]]);
  assert.equal(pipeline.diagnostics().primaryLock,null);
  now=200;pipeline.onWorkerMessage({
    type:'geometry',generation:pipeline.generation,answerEpoch:pipeline.answerEpoch,visionEpoch:oldVisionEpoch,frameId:9,timestampMs:100,expectedFrameMs:125,
    geometry:{faceCount:1,face:{present:false},pose:{torsoPresent:false},hands:{}},overlayBitmap:{close(){closed+=1}},overlayRendered:true,
  },pipeline.generation);
  assert.equal(closed,1);
  assert.equal(diagnostics,0);
  assert.equal(pipeline.session.vision.frames,0);
  pipeline.destroy();
});

test('a Holistic frame error is observed as unavailable and cannot inflate analyzable coverage',()=>{
  let now=0;const pipeline=new BrowserAnalyticsPipeline({bridge:{media:{}},now:()=>now});
  pipeline.beginAnswer({answerId:'frame-error'});
  pipeline.session.active.hasCamera=true;
  const visionEpoch=pipeline.visionEpoch;let diagnostic=null;
  pipeline.addEventListener('diagnostic',(event)=>{diagnostic=event.detail});
  pipeline.inFlightVision={generation:pipeline.generation,answerEpoch:pipeline.answerEpoch,visionEpoch,frameId:4,timestampMs:100,expectedFrameMs:125,captureStartedAt:0};
  pipeline.frameInFlight=true;now=150;
  pipeline.onWorkerMessage({
    type:'frame-error',generation:pipeline.generation,answerEpoch:pipeline.answerEpoch,visionEpoch,
    frameId:4,timestampMs:100,expectedFrameMs:125,message:'local inference failed',
  },pipeline.generation);
  assert.equal(diagnostic.geometry,null);
  assert.equal(pipeline.session.vision.frames,1);
  assert.equal(pipeline.session.vision.analyzableFrames,0);
  assert.equal(pipeline.diagnostics().visualFrameCount,0);
  assert.equal(pipeline.frameInFlight,false);
  pipeline.destroy();
});

test('full FaceDetector-to-Holistic latency drives backoff and overlay closes after any ingest failure',()=>{
  let now=0;const pipeline=new BrowserAnalyticsPipeline({bridge:{media:{}},now:()=>now});
  pipeline.beginAnswer({answerId:'a'});
  const visionEpoch=pipeline.visionEpoch;let closed=0;let diagnostic=null;let partialState=null;
  pipeline.addEventListener('diagnostic',(event)=>{diagnostic=event.detail});
  pipeline.addEventListener('state',(event)=>{if(event.detail?.state==='partial')partialState=event.detail});
  pipeline.inFlightVision={generation:pipeline.generation,answerEpoch:pipeline.answerEpoch,visionEpoch,frameId:5,timestampMs:0,captureStartedAt:0};
  pipeline.frameInFlight=true;now=300;
  pipeline.onWorkerMessage({
    type:'geometry',generation:pipeline.generation,answerEpoch:pipeline.answerEpoch,visionEpoch,frameId:5,timestampMs:0,expectedFrameMs:125,
    geometry:{faceCount:null,face:{present:false},pose:{torsoPresent:false},hands:{}},overlayBitmap:{close(){closed+=1}},overlayRendered:true,overlayPrimitiveCount:4,faceInferenceMs:240,holisticInferenceMs:40,
  },pipeline.generation);
  assert.equal(pipeline.targetFps,6);
  assert.equal(diagnostic.inferenceMs,300);
  assert.equal('overlayBitmap' in diagnostic,false);
  assert.equal(closed,1);

  const rejectedBitmap={close(){closed+=1}};
  pipeline.inFlightVision={generation:pipeline.generation,answerEpoch:pipeline.answerEpoch,visionEpoch,frameId:6,timestampMs:10,captureStartedAt:300};
  pipeline.frameInFlight=true;pipeline.session.ingestVision=()=>{throw new Error('forced rejection')};now=320;
  pipeline.onWorkerMessage({type:'geometry',generation:pipeline.generation,answerEpoch:pipeline.answerEpoch,visionEpoch,frameId:6,timestampMs:10,expectedFrameMs:125,geometry:{faceCount:null,face:{present:false},pose:{torsoPresent:false},hands:{}},overlayBitmap:rejectedBitmap,overlayRendered:true},pipeline.generation);
  assert.equal(closed,2);
  assert.match(pipeline.diagnostics().workerErrors.at(-1),/forced rejection/u);
  assert.equal(partialState.subsystem,'vision');
  assert.equal(partialState.atMs,10);
  pipeline.destroy();
});

test('beginAnswer is transactional when a sampler throws',()=>{
  const track={readyState:'live',enabled:true};
  const bridge={media:{mic:true,AC:{state:'running'},stream:{getAudioTracks:()=>[track],getVideoTracks:()=>[]},data:new Float32Array(4),analyser:{getFloatTimeDomainData(){throw new Error('analyser failed')}}}};
  const pipeline=new BrowserAnalyticsPipeline({bridge,now:()=>0});
  assert.throws(()=>pipeline.beginAnswer({answerId:'a'}),/analyser failed/u);
  assert.equal(pipeline.answer,null);
  assert.equal(pipeline.session.active,null);
  pipeline.destroy();
});

test('blocked worker egress attempts are retained without a URL',()=>{
  const pipeline=new BrowserAnalyticsPipeline({bridge:{media:{}},now:()=>0});
  pipeline.beginAnswer({answerId:'a'});
  pipeline.onWorkerMessage({type:'egress-blocked',generation:pipeline.generation,count:1},pipeline.generation);
  assert.equal(pipeline.diagnostics().blockedEgressAttempts,1);
  assert.equal(JSON.stringify(pipeline.diagnostics()).includes('http'),false);
  pipeline.destroy();
});

test('muted media tracks are unavailable and a newly muted microphone creates a gap',()=>{
  const mutedVideo={readyState:'live',enabled:true,muted:true};
  const cameraPipeline=new BrowserAnalyticsPipeline({bridge:{media:{cam:true,stream:{getVideoTracks:()=>[mutedVideo],getAudioTracks:()=>[]}}},now:()=>0});
  cameraPipeline.beginAnswer({answerId:'camera',videoElement:{}});
  assert.equal(cameraPipeline.session.active.hasCamera,false);
  cameraPipeline.destroy();

  let now=0;let audioTick=null;const priorSetInterval=globalThis.setInterval;
  globalThis.setInterval=(callback)=>{audioTick=callback;return 1};
  try{
    const audioTrack={readyState:'live',enabled:true,muted:false};
    const bridge={media:{mic:true,AC:{state:'running'},stream:{getAudioTracks:()=>[audioTrack],getVideoTracks:()=>[]},data:new Float32Array([.1,.1,.1,.1]),analyser:{getFloatTimeDomainData(){}}}};
    const pipeline=new BrowserAnalyticsPipeline({bridge,now:()=>now});
    const diagnostics=[];const states=[];
    pipeline.addEventListener('diagnostic',(event)=>diagnostics.push(event.detail));
    pipeline.addEventListener('state',(event)=>states.push(event.detail));
    pipeline.beginAnswer({answerId:'audio'});
    audioTrack.muted=true;now=100;audioTick();now=1_000;
    assert.equal(diagnostics.at(-1).available,false);
    assert.equal(diagnostics.at(-1).atMs,100);
    assert.equal(states.at(-1).subsystem,'audio');
    assert.equal(states.at(-1).atMs,100);
    const result=pipeline.endAnswer({endAt:now});
    assert.deepEqual(result.studentEvents.map((event)=>event.metric),['answer_duration_ms']);
    const gap=result.events.find((event)=>event.metric==='observation_gap'&&event.observation.qualifiers.includes('audio'));
    assert.deepEqual([gap.startMs,gap.endMs,gap.observation.value],[100,1_000,'microphone_or_audio_context_disconnected']);
    pipeline.destroy();
  }finally{globalThis.setInterval=priorSetInterval}
});

test('a hide while createImageBitmap is pending closes the frame and posts no stale work',async()=>{
  const priorWorker=globalThis.Worker;
  const priorCreateImageBitmap=globalThis.createImageBitmap;
  const priorSetTimeout=globalThis.setTimeout;
  const priorClearTimeout=globalThis.clearTimeout;
  const scheduled=[];const workers=[];
  let resolveBitmap;let closed=0;
  globalThis.setTimeout=(callback,delay)=>{scheduled.push({callback,delay});return scheduled.length};
  globalThis.clearTimeout=()=>{};
  globalThis.Worker=class FakeWorker{
    constructor(){this.messages=[];workers.push(this)}
    postMessage(message){this.messages.push(message)}
    terminate(){}
  };
  globalThis.createImageBitmap=()=>new Promise((resolve)=>{resolveBitmap=resolve});
  const videoTrack={readyState:'live',enabled:true,muted:false};
  const bridge={media:{cam:true,stream:{getVideoTracks:()=>[videoTrack],getAudioTracks:()=>[]}}};
  const pipeline=new BrowserAnalyticsPipeline({bridge,now:()=>0});
  try{
    pipeline.beginAnswer({answerId:'camera',videoElement:{readyState:2,videoWidth:480,videoHeight:270}});
    pipeline.workerReady=true;
    pipeline.faceWorker=null;
    const tick=scheduled.shift();
    const pending=tick.callback();
    await Promise.resolve();
    assert.equal(typeof resolveBitmap,'function');
    const epochBeforeHide=pipeline.visionEpoch;
    document.hidden=true;
    pipeline.onVisibilityChange();
    assert.ok(pipeline.visionEpoch>epochBeforeHide);
    resolveBitmap({close(){closed+=1}});
    await pending;
    assert.equal(closed,1);
    assert.equal(pipeline.frameInFlight,false);
    assert.equal(workers.flatMap((worker)=>worker.messages).filter((message)=>message.type==='frame').length,0);
  }finally{
    document.hidden=false;
    pipeline.hiddenAt=null;
    pipeline.destroy();
    if(priorWorker===undefined)delete globalThis.Worker;else globalThis.Worker=priorWorker;
    if(priorCreateImageBitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=priorCreateImageBitmap;
    globalThis.setTimeout=priorSetTimeout;
    globalThis.clearTimeout=priorClearTimeout;
  }
});

test('camera loss during the FaceDetector clone closes both bitmaps and posts no frame',async()=>{
  const priorWorker=globalThis.Worker;
  const priorCreateImageBitmap=globalThis.createImageBitmap;
  const priorSetTimeout=globalThis.setTimeout;
  const priorClearTimeout=globalThis.clearTimeout;
  const scheduled=[];const workers=[];let resolveClone;let sourceClosed=0;let cloneClosed=0;let calls=0;
  globalThis.setTimeout=(callback,delay)=>{scheduled.push({callback,delay});return scheduled.length};
  globalThis.clearTimeout=()=>{};
  globalThis.Worker=class FakeWorker{
    constructor(){this.messages=[];workers.push(this)}
    postMessage(message){this.messages.push(message)}
    terminate(){}
  };
  globalThis.createImageBitmap=()=>{
    calls+=1;
    if(calls===1)return Promise.resolve({close(){sourceClosed+=1}});
    return new Promise((resolve)=>{resolveClone=resolve});
  };
  const videoTrack={readyState:'live',enabled:true,muted:false};
  const bridge={media:{cam:true,stream:{getVideoTracks:()=>[videoTrack],getAudioTracks:()=>[]}}};
  const pipeline=new BrowserAnalyticsPipeline({bridge,now:()=>0});
  try{
    pipeline.beginAnswer({answerId:'camera',videoElement:{readyState:2,videoWidth:480,videoHeight:270}});
    pipeline.workerReady=true;
    pipeline.faceWorkerReady=true;
    const pending=scheduled.shift().callback();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(typeof resolveClone,'function');
    videoTrack.muted=true;
    resolveClone({close(){cloneClosed+=1}});
    await pending;
    assert.equal(sourceClosed,1);
    assert.equal(cloneClosed,1);
    assert.equal(pipeline.frameInFlight,false);
    assert.equal(workers.flatMap((worker)=>worker.messages).filter((message)=>message.type==='frame').length,0);
  }finally{
    pipeline.destroy();
    if(priorWorker===undefined)delete globalThis.Worker;else globalThis.Worker=priorWorker;
    if(priorCreateImageBitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=priorCreateImageBitmap;
    globalThis.setTimeout=priorSetTimeout;
    globalThis.clearTimeout=priorClearTimeout;
  }
});

test('an old deferred capture cannot clear a newer answer capture slot',async()=>{
  const priorWorker=globalThis.Worker;
  const priorCreateImageBitmap=globalThis.createImageBitmap;
  const priorSetTimeout=globalThis.setTimeout;
  const priorClearTimeout=globalThis.clearTimeout;
  const scheduled=[];const resolvers=[];
  globalThis.setTimeout=(callback,delay)=>{scheduled.push({callback,delay});return scheduled.length};
  globalThis.clearTimeout=()=>{};
  globalThis.Worker=class FakeWorker{postMessage(){}terminate(){}};
  globalThis.createImageBitmap=()=>new Promise((resolve)=>resolvers.push(resolve));
  const videoTrack={readyState:'live',enabled:true,muted:false};
  const bridge={media:{cam:true,stream:{getVideoTracks:()=>[videoTrack],getAudioTracks:()=>[]}}};
  const pipeline=new BrowserAnalyticsPipeline({bridge,now:()=>0});
  try{
    const video={readyState:2,videoWidth:480,videoHeight:270};
    pipeline.beginAnswer({answerId:'old',videoElement:video});
    pipeline.workerReady=true;
    pipeline.faceWorker=null;
    const oldIndex=scheduled.findIndex((item)=>item.delay===125);
    const oldCapture=scheduled.splice(oldIndex,1)[0].callback();
    await Promise.resolve();
    pipeline.abandonAnswer('superseded');
    pipeline.beginAnswer({answerId:'new',videoElement:video});
    pipeline.workerReady=true;
    pipeline.faceWorker=null;
    const newIndex=scheduled.findIndex((item)=>item.delay===125);
    const newCapture=scheduled.splice(newIndex,1)[0].callback();
    await Promise.resolve();
    assert.equal(resolvers.length,2);
    resolvers[0]({close(){}});
    await oldCapture;
    assert.equal(pipeline.frameInFlight,true);
    resolvers[1]({close(){}});
    await newCapture;
    assert.equal(pipeline.frameInFlight,true);
  }finally{
    pipeline.destroy();
    if(priorWorker===undefined)delete globalThis.Worker;else globalThis.Worker=priorWorker;
    if(priorCreateImageBitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=priorCreateImageBitmap;
    globalThis.setTimeout=priorSetTimeout;
    globalThis.clearTimeout=priorClearTimeout;
  }
});

test('an old deferred capture rejection cannot contaminate a newer answer diagnostic',async()=>{
  const priorWorker=globalThis.Worker;
  const priorCreateImageBitmap=globalThis.createImageBitmap;
  const priorSetTimeout=globalThis.setTimeout;
  const priorClearTimeout=globalThis.clearTimeout;
  const scheduled=[];const deferred=[];
  globalThis.setTimeout=(callback,delay)=>{scheduled.push({callback,delay});return scheduled.length};
  globalThis.clearTimeout=()=>{};
  globalThis.Worker=class FakeWorker{postMessage(){}terminate(){}};
  globalThis.createImageBitmap=()=>new Promise((resolve,reject)=>deferred.push({resolve,reject}));
  const videoTrack={readyState:'live',enabled:true,muted:false};
  const bridge={media:{cam:true,stream:{getVideoTracks:()=>[videoTrack],getAudioTracks:()=>[]}}};
  const pipeline=new BrowserAnalyticsPipeline({bridge,now:()=>0});
  try{
    const video={readyState:2,videoWidth:480,videoHeight:270};
    pipeline.beginAnswer({answerId:'old',videoElement:video});
    pipeline.workerReady=true;
    pipeline.faceWorker=null;
    const oldIndex=scheduled.findIndex((item)=>item.delay===125);
    const oldCapture=scheduled.splice(oldIndex,1)[0].callback();
    await Promise.resolve();
    pipeline.abandonAnswer('superseded');
    pipeline.beginAnswer({answerId:'new',videoElement:video});
    pipeline.workerReady=true;
    pipeline.faceWorker=null;
    const newIndex=scheduled.findIndex((item)=>item.delay===125);
    const newCapture=scheduled.splice(newIndex,1)[0].callback();
    await Promise.resolve();
    deferred[0].reject(new Error('old capture rejected'));
    await oldCapture;
    assert.equal(pipeline.frameInFlight,true);
    assert.deepEqual(pipeline.diagnostics().workerErrors,[]);
    deferred[1].resolve({close(){}});
    await newCapture;
  }finally{
    pipeline.destroy();
    if(priorWorker===undefined)delete globalThis.Worker;else globalThis.Worker=priorWorker;
    if(priorCreateImageBitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=priorCreateImageBitmap;
    globalThis.setTimeout=priorSetTimeout;
    globalThis.clearTimeout=priorClearTimeout;
  }
});

test('Holistic-ready startup waits for FaceDetector protection before the first visual frame',async()=>{
  const priorWorker=globalThis.Worker;
  const priorCreateImageBitmap=globalThis.createImageBitmap;
  const priorSetTimeout=globalThis.setTimeout;
  const priorClearTimeout=globalThis.clearTimeout;
  const scheduled=[];const workers=[];let bitmapCalls=0;
  globalThis.setTimeout=(callback,delay)=>{scheduled.push({callback,delay});return scheduled.length};
  globalThis.clearTimeout=()=>{};
  globalThis.Worker=class FakeWorker{
    constructor(_url,options={}){this.name=options.name;this.messages=[];workers.push(this)}
    postMessage(message){this.messages.push(message)}
    terminate(){}
  };
  globalThis.createImageBitmap=async()=>{bitmapCalls+=1;return {close(){}}};
  const videoTrack={readyState:'live',enabled:true,muted:false};
  const bridge={media:{cam:true,stream:{getVideoTracks:()=>[videoTrack],getAudioTracks:()=>[]}}};
  const pipeline=new BrowserAnalyticsPipeline({bridge,now:()=>0});
  try{
    pipeline.beginAnswer({answerId:'protected-start',videoElement:{readyState:2,videoWidth:480,videoHeight:270}});
    pipeline.workerReady=true;
    const firstVisionIndex=scheduled.findIndex((item)=>item.delay===125);
    const firstVision=scheduled.splice(firstVisionIndex,1)[0];
    await firstVision.callback();
    assert.equal(bitmapCalls,0);
    assert.equal(workers.flatMap((worker)=>worker.messages).filter((message)=>message.type==='frame').length,0);

    pipeline.onFaceWorkerMessage({type:'ready',generation:pipeline.generation,answerEpoch:pipeline.answerEpoch},pipeline.generation);
    const protectedVisionIndex=scheduled.findIndex((item)=>item.delay===125);
    const protectedVision=scheduled.splice(protectedVisionIndex,1)[0];
    await protectedVision.callback();
    assert.equal(bitmapCalls,2);
    const faceWorker=workers.find((worker)=>worker.name?.includes('face-safety'));
    const holisticWorker=workers.find((worker)=>worker.name?.startsWith('communication-analytics-'));
    const faceFrame=faceWorker.messages.find((message)=>message.type==='frame');
    assert.ok(faceFrame);
    assert.equal(holisticWorker.messages.some((message)=>message.type==='frame'),false);

    const primaryLock={state:'PRIMARY_LOCKED',zoneStatus:'primary_inside',continuity:'locked',bystanderCount:0,excludedDurationMs:0,reacquisitionCount:0,selectionRequired:false,withheldIntervals:[]};
    pipeline.onFaceWorkerMessage({...faceFrame,type:'primary-lock',faceCount:1,primaryTrackId:'primary-1',primaryUsable:true,primaryRoi:{left:.1,top:.1,width:.8,height:.8},primaryLock,faceInferenceMs:5},pipeline.generation);
    const holisticFrame=holisticWorker.messages.find((message)=>message.type==='frame');
    assert.equal(holisticFrame.faceCount,1);
    pipeline.onWorkerMessage({
      type:'geometry',generation:pipeline.generation,answerEpoch:pipeline.answerEpoch,visionEpoch:holisticFrame.visionEpoch,
      frameId:holisticFrame.frameId,timestampMs:holisticFrame.timestampMs,expectedFrameMs:holisticFrame.expectedFrameMs,
      geometry:{faceCount:1,primaryAssociated:true,face:{present:true,yawProxyDeg:0,pitchProxyDeg:0,rollProxyDeg:0,movementRatePerSecond:0},pose:{torsoPresent:false},hands:{}},
      primaryLock,
      overlayRendered:false,
    },pipeline.generation);
    assert.equal(pipeline.session.vision.multiFaceProtectionUnavailableFrames,0);
    assert.equal(pipeline.session.vision.personSpecificFrames,1);
  }finally{
    pipeline.destroy();
    if(priorWorker===undefined)delete globalThis.Worker;else globalThis.Worker=priorWorker;
    if(priorCreateImageBitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=priorCreateImageBitmap;
    globalThis.setTimeout=priorSetTimeout;
    globalThis.clearTimeout=priorClearTimeout;
  }
});

test('G: playback uses the same FaceDetector-to-primary-ROI worker path and leaves no result session',async()=>{
  const priorWorker=globalThis.Worker;
  const priorCreateImageBitmap=globalThis.createImageBitmap;
  const priorSetTimeout=globalThis.setTimeout;
  const priorClearTimeout=globalThis.clearTimeout;
  const scheduled=[];const workers=[];const captureSources=[];
  globalThis.setTimeout=(callback,delay)=>{scheduled.push({callback,delay});return scheduled.length};
  globalThis.clearTimeout=()=>{};
  globalThis.Worker=class FakeWorker{
    constructor(_url,options={}){this.name=options.name;this.messages=[];workers.push(this)}
    postMessage(message){this.messages.push(message)}
    terminate(){}
  };
  globalThis.createImageBitmap=async(source)=>{captureSources.push(source);return {width:480,height:270,close(){}}};
  const video={readyState:4,paused:false,ended:false,videoWidth:640,videoHeight:360};
  const pipeline=new BrowserAnalyticsPipeline({bridge:{media:{}},now:()=>0});
  try{
    pipeline.setInstrumentation({overlayEnabled:true,faceOverlayEnabled:true,bodyHandsOverlayEnabled:false});
    pipeline.beginPlayback({videoElement:video});
    assert.equal(pipeline.diagnostics().visionSourceMode,'playback');
    pipeline.workerReady=true;
    pipeline.onFaceWorkerMessage({type:'ready',generation:pipeline.generation,answerEpoch:pipeline.answerEpoch},pipeline.generation);
    const captureIndex=scheduled.findIndex((item)=>item.delay===125);
    await scheduled.splice(captureIndex,1)[0].callback();
    assert.equal(captureSources[0],video);
    const faceWorker=workers.find((worker)=>worker.name?.includes('face-safety'));
    const holisticWorker=workers.find((worker)=>worker.name?.startsWith('communication-analytics-'));
    const faceFrame=faceWorker.messages.find((message)=>message.type==='frame');
    const primaryLock={state:'PRIMARY_LOCKED',zoneStatus:'primary_inside',continuity:'locked_bystander_excluded',bystanderCount:1,excludedDurationMs:0,reacquisitionCount:0,selectionRequired:false,withheldIntervals:[]};
    pipeline.onFaceWorkerMessage({...faceFrame,type:'primary-lock',faceCount:2,primaryTrackId:'primary-1',primaryUsable:true,primaryRoi:{left:.1,top:.05,width:.8,height:.9},primaryLock,faceInferenceMs:4},pipeline.generation);
    const holisticFrame=holisticWorker.messages.find((message)=>message.type==='frame');
    assert.equal(holisticFrame.faceCount,2);
    assert.equal(holisticFrame.primaryTrackId,'primary-1');
    assert.equal(holisticFrame.primaryUsable,true);
    assert.equal(holisticFrame.bodyHandsOverlayEnabled,undefined);
    assert.deepEqual(holisticFrame.primaryLock,primaryLock);
    video.paused=true;
    assert.equal(pipeline.endPlayback('playback_paused'),true);
    assert.equal(pipeline.diagnostics().active,false);
    assert.equal(pipeline.diagnostics().visionSourceMode,'camera');
    assert.equal(pipeline.session,null);
  }finally{
    pipeline.destroy();
    if(priorWorker===undefined)delete globalThis.Worker;else globalThis.Worker=priorWorker;
    if(priorCreateImageBitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=priorCreateImageBitmap;
    globalThis.setTimeout=priorSetTimeout;
    globalThis.clearTimeout=priorClearTimeout;
  }
});
