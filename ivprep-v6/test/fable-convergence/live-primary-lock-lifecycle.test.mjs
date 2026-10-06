// P0 live tracking lifecycle: a lone candidate must be bound automatically and
// retained through ordinary one-person events; the plates may never say
// "Paused · not tracked" while a mesh is on screen. Drives the real production
// modules in node: BrowserAnalyticsPipeline, the face-safety worker's own lock
// functions, RealAnalyticsEngine, the Fable measurement epoch, the adapter frame
// projection and RailsController. Only MediaPipe inference and the DOM are faked.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const PUBLIC=new URL('../../public/',import.meta.url);
if(!globalThis.CustomEvent)globalThis.CustomEvent=class extends Event{constructor(type,init={}){super(type);this.detail=init.detail;}};
globalThis.document={hidden:false,addEventListener(){},removeEventListener(){},getElementById(){return null;}};
globalThis.devicePixelRatio=1;

const {BrowserAnalyticsPipeline}=await import(new URL('analytics/browser-pipeline.mjs',PUBLIC));
const {PrimaryIntervieweeLock,faceDetectionCandidates,primaryLockDiagnostic,primaryFaceAssociation}=await import(new URL('analytics/primary-interviewee-lock.mjs',PUBLIC));
const {beginMeasurementEpoch}=await import(new URL('studio-fable/app/adapters/engine-adapter.mjs',PUBLIC));
const {RailsController}=await import(new URL('studio-fable/app/instruments/rails.mjs',PUBLIC));
const runtimeSource=readFileSync(new URL('ivoc-standalone/app/real-runtime.mjs',PUBLIC),'utf8')
  .replace(/from '\/iv-prep-on-call\/(live-analytics|analytics)\/([^']+)'/g,(_,dir,file)=>`from '${new URL(`${dir}/${file}`,PUBLIC).href}'`)
  .replace(/from '\.\/data\.mjs'/,`from '${new URL('ivoc-standalone/app/data.mjs',PUBLIC).href}'`);
const {RealAnalyticsEngine}=await import(`data:text/javascript;base64,${Buffer.from(runtimeSource).toString('base64')}`);
const faceWorkerSource=readFileSync(new URL('analytics/face-detector-worker.mjs',PUBLIC),'utf8');
const faceWorkerBody=faceWorkerSource.slice(faceWorkerSource.indexOf('function analyze(message)'),faceWorkerSource.indexOf('function shutdown(message)'));
const adapterSource=readFileSync(new URL('studio-fable/app/adapters/engine-adapter.mjs',PUBLIC),'utf8');
const adapterFrameProjection=adapterSource.slice(adapterSource.indexOf('  let previousCounts='),adapterSource.indexOf('  for(const [source,target] of'));

const FRAME={width:1280,height:720};
const face=(cx=.5,cy=.4,w=.18,h=.24)=>({cx,cy,w,h});

// Minimal DOM for the production left/right rail controller.
const ctx2d=new Proxy({},{get:()=>()=>{}});
class El{
  constructor(id='',tag='div'){this.id=id;this.tag=tag;this.dataset={};this.style={};this.children=[];this.classes=new Set();this.textContent='';this._html='';
    const classes=this.classes;this.classList={add:(...c)=>c.forEach(x=>classes.add(x)),remove:(...c)=>c.forEach(x=>classes.delete(x)),toggle:(c,f)=>{(f===undefined?!classes.has(c):f)?classes.add(c):classes.delete(c);},contains:c=>classes.has(c)};}
  get className(){return [...this.classes].join(' ');}set className(v){this.classes.clear();String(v).split(/\s+/).filter(Boolean).forEach(x=>this.classes.add(x));}
  get innerHTML(){return this._html;}set innerHTML(v){this._html=String(v);this.textContent=this._html.replace(/<[^>]+>/g,'');}
  get offsetWidth(){return 1;}
  getContext(){return ctx2d;}
  add(...nodes){this.children.push(...nodes);return this;}
  all(){const out=[];const walk=n=>{for(const c of n.children){out.push(c);walk(c);}};walk(this);return out;}
  querySelectorAll(sel){return this.all().filter(el=>matches(el,sel));}
  querySelector(sel){return this.querySelectorAll(sel)[0]||null;}
}
function matches(el,sel){
  if(sel.startsWith('#'))return el.id===sel.slice(1);
  if(sel.startsWith('.'))return el.classes.has(sel.slice(1));
  const region=/^\[data-region="([^"]+)"\]$/.exec(sel);if(region)return el.dataset.region===region[1];
  return el.tag===sel;
}
function railsRoot(){
  const root=new El('root');const el=(id,tag)=>{const node=new El(id,tag);root.add(node);return node;};
  const region=name=>{const r=new El('',`span`);r.classes.add('region');r.dataset.region=name;return r;};
  const correction=el('correction');correction.add(Object.assign(new El('','span'),{classes:new Set(['glyph'])}),new El('','strong'),new El('','small'));
  el('face-scan').add(region('brows'),region('eyes'),region('cheeks'),region('mouth'));
  el('body-scan').add(region('torso'),region('left'),region('right'));
  for(const id of ['face-chip','face-facing','face-smiles','face-nods','body-chip','body-framing','body-hands','body-gestures','pitch-verb','speed-needle','pace-score','pace-wpm','pace-verb','pace-basis','vol-score','vol-raw','vol-verb','pitch-st','pitch-hz','var-score','var-verb','var-marker','var-note'])el(id);
  const speedo=el('speedo');for(let i=0;i<31;i++){const t=new El('','line');t.classes.add('speed-tick');t.dataset.tick=String(i);speedo.add(t);}
  const segments=el('vol-segments');for(let i=0;i<16;i++)segments.add(new El('','i'));
  const piano=el('piano');for(let i=0;i<15;i++){const k=new El('','rect');k.classes.add('pk-w');piano.add(k);}
  el('var-ribbon','canvas');
  return root;
}

// One room: real pipeline + real engine + fake MediaPipe workers driven by a scene.
function liveRoom(){
  const previous={setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval,Worker:globalThis.Worker,createImageBitmap:globalThis.createImageBitmap};
  let now=0;const timers=new Map();let timerId=0;
  globalThis.setTimeout=fn=>{timers.set(++timerId,fn);return timerId;};globalThis.clearTimeout=id=>{timers.delete(id);};
  globalThis.setInterval=()=>++timerId;globalThis.clearInterval=()=>{};
  globalThis.createImageBitmap=async source=>({width:source.videoWidth||source.width||FRAME.width,height:source.videoHeight||source.height||FRAME.height,close(){}});
  const scene={faces:[face()],hands:true,torso:true};
  const workers=[];
  globalThis.Worker=class FakeWorker{
    constructor(url){this.url=String(url);this.face=this.url.includes('face-detector-worker');this.onmessage=null;workers.push(this);
      if(this.face){this.scope={ready:false,generation:0,activeAnswerEpoch:0,primaryLock:null,detector:null,performance,PrimaryIntervieweeLock,faceDetectionCandidates,primaryLockDiagnostic,self:{postMessage:m=>this.onmessage?.({data:m})}};
        vm.createContext(this.scope);vm.runInContext(faceWorkerBody+';this.analyze=analyze;this.reset=reset;this.reselectPrimary=reselectPrimary;',this.scope);}
    }
    postMessage(message){
      if(this.face){
        if(message.type==='init'){this.scope.generation=message.generation;this.scope.activeAnswerEpoch=message.answerEpoch;this.scope.primaryLock=new PrimaryIntervieweeLock();
          this.scope.detector={detectForVideo:bitmap=>({detections:scene.faces.map(f=>({boundingBox:{originX:(f.cx-f.w/2)*bitmap.width,originY:(f.cy-f.h/2)*bitmap.height,width:f.w*bitmap.width,height:f.h*bitmap.height}}))})};
          this.scope.ready=true;this.onmessage?.({data:{type:'ready',generation:message.generation,answerEpoch:message.answerEpoch}});return;}
        if(message.type==='frame')return this.scope.analyze(message);
        if(message.type==='reset')return this.scope.reset(message);
        if(message.type==='reselect-primary')return this.scope.reselectPrimary(message);
        return;
      }
      // Holistic worker emulation mirrors the deployed contract: landmarks and the
      // mesh exist only inside the usable primary ROI; primaryLock is echoed.
      if(message.type==='init'){this.generation=message.generation;this.answerEpoch=message.answerEpoch;this.overlayEnabled=Boolean(message.overlayEnabled);this.onmessage?.({data:{type:'ready',generation:message.generation,answerEpoch:message.answerEpoch}});return;}
      if(message.type==='reset'){this.answerEpoch=message.answerEpoch;this.onmessage?.({data:{type:'ready',generation:this.generation,answerEpoch:this.answerEpoch}});return;}
      if(message.type==='instrumentation'){this.overlayEnabled=Boolean(message.overlayEnabled);return;}
      if(message.type!=='frame')return;
      const usable=message.primaryUsable===true,roi=message.primaryRoi;
      const inside=f=>usable&&f.cx>=roi.left&&f.cx<=roi.left+roi.width&&f.cy>=roi.top&&f.cy<=roi.top+roi.height;
      const f=scene.faces.find(inside)||null;
      const faceGeometry=f?{present:true,box:{left:f.cx-f.w/2,top:f.cy-f.h/2,width:f.w,height:f.h,centerX:f.cx,centerY:f.cy},yawProxyDeg:3,pitchProxyDeg:-2,rollProxyDeg:1,yawDeg:3,pitchDeg:-2,rollDeg:1,headPoseMethod:'LINEAR_FACE_GEOMETRY_PROXY',movementRatePerSecond:.1}
        :{present:false,box:null,yawProxyDeg:null,pitchProxyDeg:null,rollProxyDeg:null,yawDeg:null,pitchDeg:null,rollDeg:null,headPoseMethod:'UNAVAILABLE'};
      const primaryAssociated=Boolean(f)&&primaryFaceAssociation(message.primaryFaceBox,faceGeometry.box);
      const geometry={faceCount:message.faceCount,face:faceGeometry,
        pose:f&&scene.torso?{upperBodyPresent:true,torsoPresent:true,shoulderWidth:.3,centerX:f.cx,centerY:f.cy+.3,lateralLeanDeg:1}:{upperBodyPresent:false,torsoPresent:false,shoulderWidth:null,centerX:null,centerY:null,lateralLeanDeg:null},
        hands:f&&scene.hands?{left:{present:true,centerX:f.cx-.2,centerY:.8,wristX:f.cx-.2,wristY:.82,zone:'chest'},right:{present:true,centerX:f.cx+.2,centerY:.8,wristX:f.cx+.2,wristY:.82,zone:'chest'}}:{left:{present:false},right:{present:false}},
        primaryAssociated,primaryLockState:message.primaryLock?.state||'SEARCHING',bystanderCount:message.primaryLock?.bystanderCount||0};
      const overlayRendered=this.overlayEnabled&&primaryAssociated;
      this.onmessage?.({data:{type:'geometry',generation:message.generation,answerEpoch:message.answerEpoch,visionEpoch:message.visionEpoch,frameId:message.frameId,timestampMs:message.timestampMs,expectedFrameMs:message.expectedFrameMs,holisticInferenceMs:20,faceInferenceMs:message.faceInferenceMs,geometry,faceCategories:null,primaryLock:message.primaryLock||null,overlayRequested:this.overlayEnabled,overlayRendered,overlayPrimitiveCount:overlayRendered?400:0,overlayBitmap:overlayRendered?{width:FRAME.width,height:FRAME.height,close(){}}:null}});
    }
    terminate(){}
  };
  const camera={kind:'video',readyState:'live',enabled:true,muted:false,label:'cam',getSettings:()=>({deviceId:'cam',width:FRAME.width,height:FRAME.height,frameRate:30})};
  const stream={getVideoTracks:()=>[camera],getAudioTracks:()=>[]};
  const video={srcObject:null,paused:false,readyState:4,videoWidth:FRAME.width,videoHeight:FRAME.height,isConnected:true,async play(){}};
  const overlay={draws:0,clears:0,visible:false};
  const overlayCanvas={clientWidth:640,clientHeight:360,width:0,height:0,getContext:()=>({drawImage(){overlay.draws++;overlay.visible=true;},clearRect(){overlay.clears++;overlay.visible=false;}})};
  let pipeline=null;
  const bridge={get media(){return {cam:true,stream,cameraTrack:camera,mic:false};},primeAudioContext(){},async requestMedia(){return {stream};},
    ensureAnalytics(){if(!pipeline)pipeline=new BrowserAnalyticsPipeline({bridge,now:()=>now});return pipeline;},
    startAnalytics(options){return this.ensureAnalytics().beginAnswer(options);},get sessionClock(){return this.ensureAnalytics().ensureSession().clock;},
    endAnalytics(options){return pipeline?.endAnswer?.(options)??null;},destroy(){},audioContext:null,readiness:{}};
  const real=new RealAnalyticsEngine({video,overlayCanvas});
  real.bridge=bridge;real.transcript={async start(){},stop(){}};
  const events=new EventTarget();const root=railsRoot();const rails=new RailsController(root);
  const frames=[];events.addEventListener('frame',e=>{frames.push(e.detail);rails.ingest(e.detail);});
  const faceWorker=()=>workers.find(w=>w.face);
  const room={
    scene,real,events,rails,root,overlay,frames,
    get pipeline(){return pipeline;},get lock(){return faceWorker().scope.primaryLock;},
    now:()=>now,
    async connect(){await real.start();},
    start(){
      // The production Fable measurement epoch, then the production adapter frame projection.
      beginMeasurementEpoch(real,{mediaStartedAt:now});
      const recordingOrigin=now;
      Function('real','events','performance','recordingOrigin',adapterFrameProjection)(real,events,{now:()=>now},recordingOrigin);
    },
    async tick(dtMs=125){now+=dtMs;const callback=timers.get(pipeline.visionTimer);if(!callback)throw new Error('vision scheduler is not armed');await callback();},
    async run(ms){for(let elapsed=0;elapsed<ms;elapsed+=125)await this.tick(125);},
    plates(){
      const $=id=>root.querySelector('#'+id);
      return {faceTracked:$('face-scan').dataset.tracked,faceChip:$('face-chip').textContent,facing:$('face-facing').textContent,bodyTracked:$('body-scan').dataset.tracked,framing:$('body-framing').textContent,hands:$('body-hands').textContent};
    },
    close(){real.destroy();Object.assign(globalThis,previous);},
  };
  return room;
}
const trackedPlates={faceTracked:'true',faceChip:'Tracked',bodyTracked:'true',framing:'in frame',hands:'L + R in view'};
function assertTracked(room,label){
  const plates=room.plates();
  assert.deepEqual({faceTracked:plates.faceTracked,faceChip:plates.faceChip,bodyTracked:plates.bodyTracked,framing:plates.framing,hands:plates.hands},trackedPlates,label);
  assert.match(plates.facing,/^\d+%/,label+' facing');
}
function assertPaused(room,label){
  const plates=room.plates();
  assert.equal(plates.faceTracked,'false',label);assert.equal(plates.facing,'unavailable',label);
  assert.equal(plates.bodyTracked,'false',label);assert.equal(plates.framing,'unavailable',label);assert.equal(plates.hands,'unavailable',label);
}
async function liveOnePerson(){
  const room=liveRoom();
  await room.connect();await room.run(2000);
  assert.equal(room.real.latest.headFace.presence,'TRACKED','preflight binds the lone candidate');
  room.start();await room.run(1500);
  assertTracked(room,'after Start the plates track the same person');
  return room;
}

test('one-person preflight then Start keeps the candidate bound; plates show Tracked, FACING, FRAMING and HANDS',async()=>{
  const room=await liveOnePerson();
  try{
    assert.equal(room.pipeline.lastPrimaryLock.state,'PRIMARY_LOCKED');
    assert.equal(room.lock.primaryTrackId,'primary-1','the preflight identity carried across the measurement epoch');
    assert.equal(room.overlay.visible,true,'the mesh is drawn for the tracked frame');
  }finally{room.close();}
});

test('a lone candidate who leans toward the camera is re-bound automatically; plates recover without a manual lock',async()=>{
  const room=await liveOnePerson();
  try{
    const track=room.lock.primaryTrackId;
    room.scene.faces=[face(.5,.42,.30,.40)]; // same seat, face box area jumps past the continuity ratio
    await room.run(4000);
    assert.equal(room.lock.selectionRestartRequired,false,'a lone candidate never requires manual selection');
    assert.equal(room.pipeline.lastPrimaryLock.state,'PRIMARY_LOCKED');
    assert.equal(room.lock.primaryTrackId,track,'the same person keeps the same identity');
    assertTracked(room,'plates recover after the lone subject re-poses');
  }finally{room.close();}
});

test('a lone candidate who looks away for six seconds is bound again when the only face returns',async()=>{
  const room=await liveOnePerson();
  try{
    room.scene.faces=[];await room.run(6000);
    assertPaused(room,'metrics are withheld while nobody is in frame');
    assert.equal(room.lock.selectionRestartRequired,false,'lone absence is not an identity conflict');
    room.scene.faces=[face()];await room.run(2500); // acquisition hold, then the 1 Hz plate clock
    assert.equal(room.pipeline.lastPrimaryLock.state,'PRIMARY_LOCKED');
    assertTracked(room,'plates track the returning lone candidate');
  }finally{room.close();}
});

test('a lone candidate seated off-centre is bound; framing is coached, not withheld',async()=>{
  const room=liveRoom();
  try{
    room.scene.faces=[face(.22,.4)];
    await room.connect();await room.run(1500);room.start();await room.run(1500);
    assert.equal(room.pipeline.lastPrimaryLock.state,'PRIMARY_LOCKED');
    assertTracked(room,'the only person in frame is the interviewee wherever they sit');
  }finally{room.close();}
});

test('a second person keeps the retained subject: bystanders are excluded, crossings withhold with a reason and never switch identity',async()=>{
  const room=await liveOnePerson();
  try{
    const track=room.lock.primaryTrackId;
    room.scene.faces=[face(),face(.85,.3,.08,.11)];await room.run(1500);
    assert.equal(room.pipeline.lastPrimaryLock.state,'PRIMARY_LOCKED');assert.equal(room.pipeline.lastPrimaryLock.bystanderCount,1);
    assert.equal(room.lock.primaryTrackId,track);assertTracked(room,'a distant bystander does not disturb the primary');
    room.scene.faces=[face(.52),face(.56)];await room.run(1000); // two faces inside the primary continuity window
    assert.equal(room.lock.primaryTrackId,track,'ambiguity never transfers the identity');
    assert.equal(room.real.projector.latest.metrics.HEAD_FACE.available,false);
    assert.match(room.real.projector.latest.metrics.HEAD_FACE.reason,/^PRIMARY_(TEMPORARILY_UNAVAILABLE|SELECTION_REQUIRED|NOT_LOCKED)$/,'withheld with the lock reason');
    assertPaused(room,'person-specific measures are withheld during ambiguity');
    room.scene.faces=[face(.52)];await room.run(3000);
    assert.notEqual(room.lock.primaryTrackId,'primary-2','a candidate descending from a crossing is never silently promoted');
  }finally{room.close();}
});

test('the mesh never outlives a withheld frame: a vision frame that withholds the person clears the overlay',async()=>{
  const room=await liveOnePerson();
  try{
    assert.equal(room.overlay.visible,true);
    room.scene.faces=[face(.5,.42,.30,.40)];
    await room.tick();
    assert.equal(room.real.latest.headFace.presence,'SEARCHING','the first re-posed frame is withheld by the lock');
    assert.equal(room.overlay.visible,false,'the stale mesh is cleared on the same frame instead of waiting for the freshness timer');
    for(const frame of room.frames)if(frame.headFace.presence!=='TRACKED')assert.equal(frame.headFace.cameraFacingPct,null);
  }finally{room.close();}
});

test('every frame that drew a mesh reported the person as tracked (per-frame invariant across the lifecycle)',async()=>{
  const room=liveRoom();
  try{
    const log=[];room.real.addEventListener('frame',e=>log.push({presence:e.detail.headFace.presence,visible:room.overlay.visible,draws:room.overlay.draws}));
    await room.connect();await room.run(1500);room.start();await room.run(1500);
    room.scene.faces=[];await room.run(1000);room.scene.faces=[face(.5,.42,.30,.40)];await room.run(2000);
    let previousDraws=0;
    for(const entry of log){if(entry.draws>previousDraws)assert.equal(entry.presence,'TRACKED','a drawn mesh implies TRACKED on that frame');previousDraws=entry.draws;}
  }finally{room.close();}
});
