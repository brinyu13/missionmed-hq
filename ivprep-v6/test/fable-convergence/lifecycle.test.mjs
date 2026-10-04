import test from 'node:test';
import assert from 'node:assert/strict';
import {beginMeasurementEpoch,invalidateDeviceCalibration} from '../../public/studio-fable/app/adapters/engine-adapter.mjs';
import {GptLiveInterviewer,LiveCaptionGroups} from '../../public/studio-fable/app/adapters/live-adapter.mjs';
import {LiveInterviewSession} from '../../public/capabilities/live-interview.mjs';
import {SessionController} from '../../public/studio-fable/app/controller/session-controller.mjs';
import {DurableStudioSession} from '../../public/studio/durable-session.mjs';
import {IvocApi} from '../../public/ivoc-standalone/app/api.mjs';
import {LiveAnalyticsMediaBridge} from '../../public/live-analytics/media-bridge.mjs';
import {BehaviorIntelligenceRuntime} from '../../public/live-analytics/behavior-intelligence-runtime.mjs';
import {bindSubject} from '../../public/studio-fable/app/state.mjs';
if(!globalThis.CustomEvent)globalThis.CustomEvent=class extends Event{constructor(type,init={}){super(type);this.detail=init.detail;}};
globalThis.document={hidden:false,addEventListener(){},removeEventListener(){},getElementById(){return null;}};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
const readyStream=()=>{const track={kind:'audio',readyState:'live',enabled:true,muted:false};return{getAudioTracks:()=>[track]};};
test('timed GPT-Live fragments preserve spaces/repetition and independent overlapping captions, never finals',()=>{
  const captions=new LiveCaptionGroups();
  const event=(speaker,delta,start,end,id)=>({type:'session.'+speaker+'_transcript.delta',delta,start_ms:start,end_ms:end,event_id:id});
  captions.ingest(event('input','I worked',100,300,'a'));
  captions.ingest(event('output','Tell me',200,400,'b'));
  const update=captions.ingest(event('input',' on research research',300,500,'c'));
  assert.deepEqual(update.groups.map(g=>g.text),['I worked on research research','Tell me']);
  assert.equal(update.groups.every(g=>g.final===false&&g.timingBasis==='PROVIDER_FRAGMENT'),true);
  assert.equal(captions.ingest(event('input',' on research research',300,500,'c')),null);
  assert.equal(captions.ingest(event('input','invalid',-1,0,'bad')),null);
  captions.ingest(event('output',' why?',2200,2400,'d'));assert.equal(captions.groups.length,3);
  for(let n=0;n<50;n++)captions.ingest(event('input','x'.repeat(1000),500+n,501+n,'large-'+n));
  assert.ok(captions.chars<=32768);
});
test('actual native teardown release reaches exact Durable owner while stale transcript/status callbacks remain rejected',async()=>{
  let native,lateTranscripts=0;const durable={accountSession:{id:'session-1'},events:[],recordLiveAudioTelemetry(e){this.events.push(e);}};
  class Native extends LiveInterviewSession {constructor(options){super({...options,PeerConnection:class{}});}async start(){native=this;this.audioAuthority='configured';this.startedAtMs=0;this.emitTelemetry('configured');this.audioAuthority='bound';this.emitTelemetry('bound');return{};}}
  const live=new GptLiveInterviewer({account:{apiClient:{createLiveInterview(){},endLiveInterview(){}}},durable,
    LiveInterviewSessionCtor:Native,onApplicantFinal(){lateTranscripts++;}});
  await live.connect({ivocSessionId:'session-1',openingQuestion:'Tell me about yourself.'});
  await live.stop();native.onTranscript({speaker:'applicant',final:true,text:'late'});
  native.emitTelemetry('bound');native.emitTelemetry('released');
  assert.deepEqual(durable.events.map(e=>e.state),['configured','bound','released']);assert.equal(lateTranscripts,0);
});
test('actual bridge/pipeline retains clock across rehearsal, abandonment and recording',()=>{
  let now=100;const bridge=new LiveAnalyticsMediaBridge({now:()=>now});const pipeline=bridge.ensureAnalytics();
  pipeline.beginAnswer();const clock=bridge.sessionClock;let timingStarts=0;
  const real={bridge,pipeline,video:{},transcript:{stop(){}},projector:{reset(){}},behavior:{reset(){},beginInterview(){}},startTranscriptTiming(){timingStarts++;}};
  now=5000;beginMeasurementEpoch(real);assert.equal(bridge.sessionClock,clock);assert.ok(pipeline.answer);
  pipeline.abandonAnswer('leave_calibration');now=7000;beginMeasurementEpoch(real);
  assert.equal(bridge.sessionClock,clock);assert.ok(pipeline.answer,'re-entry restarts sampling answer');
  now=8000;beginMeasurementEpoch(real,{mediaStartedAt:7900});
  assert.equal(bridge.sessionClock,clock);assert.equal(pipeline.session.active.mediaStartedAtMs,7800);
  assert.equal(timingStarts,3);pipeline.destroy();
});
test('device change clears actual face/pitch/behavior calibration through rehearsal and recording epochs',()=>{
  let now=100;const bridge=new LiveAnalyticsMediaBridge({now:()=>now}),pipeline=bridge.ensureAnalytics();
  const behavior=new BehaviorIntelligenceRuntime({now:()=>now});
  const prior={pitchMedianHz:160,smileBaseline:.25,browBaseline:.1,periocularBaseline:.1,speechLufsK:-20};
  behavior.setBaseline(prior);pipeline.setPersonalCalibration(prior);
  behavior.calibration.ingestAudio({atMs:100,speaking:true,loudness:{speechLufsK:-20},pitch:{medianHz:160}});
  assert.equal(pipeline.pitchTrack.calibrationMedianHz,160);assert.equal(pipeline.faceFamily.hasPersonalBaseline(),true);
  pipeline.beginPersonalFaceBaseline();let cancellation=null;
  const real={bridge,pipeline,behavior,video:{},transcript:{stop(){}},projector:{reset(){}},
    cancelFaceBaseline(reason){cancellation=reason;pipeline.endPersonalFaceBaseline();},startTranscriptTiming(){}};
  invalidateDeviceCalibration(real);
  assert.equal(cancellation,'DEVICE_CHANGED_RECALIBRATION_REQUIRED');assert.equal(behavior.baseline,null);
  assert.deepEqual(behavior.calibration.pitch,[]);assert.deepEqual(behavior.calibration.loudness,[]);
  const assertCleared=()=>{assert.equal(behavior.baseline,null);assert.equal(pipeline.pitchTrack.calibrationMedianHz,null);
    assert.equal(pipeline.faceFamily.hasPersonalBaseline(),false);assert.equal(pipeline.faceBaselineCapturing,false);};
  assertCleared();now=5000;beginMeasurementEpoch(real);assertCleared();
  now=8000;beginMeasurementEpoch(real,{mediaStartedAt:7900});assertCleared();pipeline.destroy();
});
for(const delayed of ['native','api'])test('stop during '+delayed+' import never starts a provider',async()=>{
  const wait=deferred();let starts=0;
  class Native{async start(){starts++;}async stop(){}}
  const live=new GptLiveInterviewer({account:{},LiveInterviewSessionCtor:delayed==='api'?Native:null,
    moduleLoader:async path=>{if(path.includes(delayed==='native'?'live-interview':'api-client'))await wait.promise;return path.includes('live-interview')?{LiveInterviewSession:Native}:{};}});
  const connecting=live.connect({openingQuestion:'Question'});await live.stop();wait.resolve();
  await assert.rejects(connecting,/cancelled/);assert.equal(starts,0);assert.equal(live.live,null);
});
test('stop during native start tears down the published owner and rejects late completion',async()=>{
  const wait=deferred();let stops=0;
  class Native{async start(){await wait.promise;}async stop(){stops++;}}
  const live=new GptLiveInterviewer({account:{apiClient:{}},LiveInterviewSessionCtor:Native});
  const connecting=live.connect({openingQuestion:'Question'});await live.stop();wait.resolve();
  await assert.rejects(connecting,/cancelled/);assert.equal(stops,1);assert.equal(live.live,null);
});
test('obsolete device startup cannot overwrite a newer READY owner',async()=>{
  const wait=deferred();let factories=0;const engines=[];
  const c=new SessionController({engineFactory:async()=>{const n=++factories;const e={stream:readyStream(),destroyed:false,
    async start(){if(n===1)await wait.promise;},destroy(){this.destroyed=true;}};engines.push(e);return e;}});
  c.account={mode:'REAL',subject:'wp:1'};c.durable={ready:true};c.video={};c.audioElement={};
  const first=c.acquire();await Promise.resolve();await c.release('cancelled');const second=await c.acquire();
  assert.equal(c.phase,'READY');wait.resolve();await assert.rejects(first,/cancelled/);
  assert.equal(c.phase,'READY');assert.equal(c.engine,second);assert.equal(second.destroyed,false);
  assert.equal(await c.acquire(),second);assert.equal(factories,2);
});
test('obsolete lazy engine result is never published or started',async()=>{
  const wait=deferred();let starts=0;const c=new SessionController({engineFactory:async()=>{await wait.promise;return{start:async()=>{starts++;},destroy(){}};}});
  c.account={mode:'REAL',subject:'wp:1'};c.durable={ready:true};c.video={};c.audioElement={};
  const acquiring=c.acquire();await c.release('cancelled');wait.resolve();await assert.rejects(acquiring,/cancelled/);
  assert.equal(starts,0);assert.equal(c.engine,null);assert.equal(c.phase,'IDLE');
});
test('preflight device replacement must drain before recording or replacement capture',async()=>{
  const wait=deferred();let starts=0;const c=new SessionController();
  c.engine={stream:{},switchDevice:()=>wait.promise,destroy(){}};c.phase='READY';
  c.startOwnedSession=async()=>{starts++;};
  const changing=c.switchDevice('camera','selected-camera');
  await assert.rejects(c.startSession({mode:'practice'}),/device change.*finishing/);
  const rejected=assert.rejects(changing,/cancelled/);
  await c.release('left_preflight');
  await assert.rejects(c.acquire(),/device change.*finishing/);
  wait.resolve({});await rejected;assert.equal(c.deviceSwitchOperation,null);assert.equal(starts,0);
  c.engine={stream:{}};c.phase='LIVE';
  await assert.rejects(c.switchDevice('camera','selected-camera'),/before recording/);
});
test('cancelled durable preparation drains before replacement recording can start',async()=>{
  const wait=deferred();let creates=0,abandoned=0;
  const api={identity:{subject:'wp:1',admin:false},bootstrap:async()=>({entitlement:{admitted:true},identity:{subject:'wp:1',admin:false}}),createSession:async()=>{creates++;if(creates===1)await wait.promise;return{id:'session-'+creates};},
    abandonSession:async()=>{abandoned++;return{};}};
  const durable=new DurableStudioSession({api,recordingFactory:()=>({startedAt:100,start:async()=>true,destroy(){}})});await durable.bootstrap();
  const stream=readyStream(),engine=()=>({stream,audioContext:{state:'running'},beginSession:async()=>{},destroy(){}});
  const c=new SessionController({mixFactory:()=>null});c.account={mode:'REAL',subject:'wp:1',role:'student',api};c.durable=durable;c.engine=engine();c.phase='READY';
  const first=c.startSession({mode:'practice',question:{question_id:'CORE-01',canonical_text:'Question'},interviewSet:[],wizard:{},targetQuestions:1});
  for(let tick=0;!creates&&tick<100;tick++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(creates,1,'cancel the in-flight durable preparation, not the new admission read');
  await c.release('cancelled');c.engine=engine();c.phase='READY';
  await assert.rejects(c.startSession({mode:'practice'}),/previous.*closing/);
  wait.resolve();await assert.rejects(first,/cancelled/);assert.equal(abandoned,1);assert.equal(c.phase,'READY');assert.equal(durable.accountSession,null);
  await c.startSession({mode:'practice',question:{question_id:'CORE-01',canonical_text:'Question'},interviewSet:[],wizard:{},targetQuestions:1});
  assert.equal(c.phase,'LIVE');assert.equal(durable.accountSession.id,'session-2');assert.equal(c.durableActive,true);
});
test('release and cancelled-start cleanup both drain before replacing the shared Durable owner',{timeout:3000},async t=>{
  const begin=deferred(),abandon=deferred();let creates=0,abandons=0;const destroyed=[];
  const api={identity:{subject:'wp:1',admin:false},bootstrap:async()=>({entitlement:{admitted:true},identity:{subject:'wp:1',admin:false}}),createSession:async()=>({id:'session-'+(++creates)}),
    abandonSession:async()=>{abandons++;await abandon.promise;return{};}};
  let recorders=0;
  const durable=new DurableStudioSession({api,recordingFactory:()=>{const id=++recorders;return{startedAt:100,start:async()=>true,destroy(){destroyed.push(id);}};}});
  await durable.bootstrap();const stream=readyStream(),audioContext={state:'running'};
  const c=new SessionController();c.account={mode:'REAL',subject:'wp:1',role:'student',api};c.durable=durable;
  c.engine={stream,audioContext,beginSession:()=>begin.promise,destroy(){}};c.phase='READY';
  const input={mode:'practice',question:{question_id:'CORE-01',canonical_text:'Question'},interviewSet:[],wizard:{},targetQuestions:1};
  const first=c.startSession(input);const failed=assert.rejects(first,/cancelled/);
  for(let tick=0;!c.durableActive&&tick<100;tick++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(c.durableActive,true,'recording must reach the paused measurement boundary');
  t.diagnostic('initial recording started');
  const releasing=c.release('cancelled');
  for(let tick=0;!abandons&&tick<100;tick++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(abandons,1,'release must begin durable cleanup');
  t.diagnostic('release cleanup is waiting');
  c.engine={stream,audioContext,beginSession:async()=>{},destroy(){}};c.phase='READY';begin.resolve();
  await new Promise(resolve=>setImmediate(resolve));
  await assert.rejects(c.startSession(input),/previous.*closing/);
  assert.equal(creates,1);assert.equal(abandons,1);
  abandon.resolve();await releasing;await failed;
  t.diagnostic('both old operations drained');
  assert.equal(c.phase,'READY');assert.equal(abandons,1,'duplicate cleanup must not abandon twice');
  await c.startSession(input);assert.equal(durable.accountSession.id,'session-2');
  assert.ok(durable.recorder);assert.equal(c.phase,'LIVE');assert.equal(c.durableActive,true);
  assert.deepEqual(destroyed,[1],'old cleanup must not destroy the replacement recorder');
});
function saveHarness({failEvidence=false,failPersistence=false}={}){
  const writes=[];let seals=0;
  const api={identity:{subject:'wp:1',admin:false},bootstrap:async()=>({entitlement:{admitted:true},identity:{subject:'wp:1',admin:false}}),createSession:async()=>({id:'f13869aa-2b3e-4b65-9f66-1288fb459444'}),
    saveResults:async(id,envelope)=>{writes.push(envelope);if(failPersistence&&writes.length===1)throw new Error('temporary_save_failure');return{};}};
  const durable=new DurableStudioSession({api,recordingFactory:()=>({startedAt:100,start:async()=>true,
    stopAndSeal:async()=>{seals++;return{recording:{id:'recording-1',status:'saved'},recordingDurationMs:1000};},destroy(){}})});
  const c=new SessionController();c.account={mode:'REAL',subject:'wp:1',role:'student',api};c.durable=durable;
  c.engine={finish:async()=>{if(failEvidence)throw new Error('evidence_failure');return{analytics:{schema:'missionmed.ivprep.analytics.session.v1',events:[],durationMs:1000}};},destroy(){}};
  bindSubject('wp:1');return{c,durable,writes,seals:()=>seals};
}
test('evidence-seal failure cannot retry into a saved analytics:null attempt',async()=>{
  const h=saveHarness({failEvidence:true});await h.durable.bootstrap();await h.durable.start({stream:{}});h.c.durableActive=true;
  const result=await h.c.finishSession({record:{samples:[],events:[]}});
  assert.equal(result.persisted,false);assert.equal(h.c.lastSave.retryable,false);
  assert.equal(await h.c.retrySave(),null);assert.equal(h.writes.length,0);assert.equal(h.c.phase,'SAVE_FAILED');
});
test('a rejected real API account switch cannot later start under the cached actor',async t=>{
  const previousFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=previousFetch;});
  let actor='wp:1',creates=0,recorders=0;
  globalThis.fetch=async(path,options={})=>({ok:true,json:async()=>{
    if(path.endsWith('/bootstrap'))return{entitlement:{admitted:true},identity:{subject:actor,admin:true},csrfToken:'fixture-csrf'};
    if(path.endsWith('/sessions')&&options.method==='POST'){creates++;return{id:'fixture-session',ownerSubject:actor};}
    return{};
  }});
  const api=new IvocApi(),durable=new DurableStudioSession({api,recordingFactory:()=>{recorders++;return{startedAt:100,start:async()=>true,destroy(){}};}});
  await durable.bootstrap();const c=new SessionController();
  c.account={mode:'REAL',subject:'wp:1',role:'admin',api};c.durable=durable;
  c.engine={stream:readyStream(),audioContext:{state:'running'},beginSession:async()=>{},destroy(){}};c.phase='READY';
  actor='wp:2';await assert.rejects(c.freshOwnLibrary(),/access changed/);
  assert.equal(api.identity.subject,'wp:2');assert.equal(durable.ready,true);
  await assert.rejects(c.startSession({mode:'practice',question:{question_id:'CORE-01',canonical_text:'Question'},interviewSet:[],wizard:{},targetQuestions:1}),/access changed/);
  assert.equal(creates,0);assert.equal(recorders,0);assert.notEqual(c.phase,'LIVE');
});
test('overlapping actual bootstrap responses cannot replace Start effective actor or strand STARTING',async t=>{
  const previousFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=previousFetch;});
  let actor='wp:1',creates=0,recorders=0,bootstrapCalls=0,parallelRejected=false,parallel,c;
  globalThis.fetch=async(path,options={})=>{
    if(path.endsWith('/bootstrap')){
      const requestActor=actor,number=++bootstrapCalls;
      return{ok:true,json:()=>{
        if(number===1)queueMicrotask(()=>{actor='wp:2';parallel=c.freshOwnLibrary().catch(()=>{parallelRejected=true;});});
        return Promise.resolve({entitlement:{admitted:true},identity:{subject:requestActor,admin:true},csrfToken:'fixture-'+requestActor});
      }};
    }
    if(path.endsWith('/sessions')&&options.method==='POST'){
      assert.equal(options.headers['X-MMHQ-CSRF'],'fixture-'+actor);creates++;
      return{ok:true,json:async()=>({id:'fixture-session'})};
    }
    throw new Error('Unexpected fixture request');
  };
  const api=new IvocApi();api.identity={subject:'wp:1',admin:true};api.csrfToken='fixture-wp:1';
  const durable=new DurableStudioSession({api,recordingFactory:()=>{recorders++;return{startedAt:100,start:async()=>true,destroy(){}};}});
  durable.bootstrapPayload={entitlement:{admitted:true},identity:{subject:'wp:1',admin:true}};
  c=new SessionController();c.account={mode:'REAL',subject:'wp:1',role:'admin',api};c.durable=durable;
  c.engine={stream:readyStream(),audioContext:{state:'running'},beginSession:async()=>{},destroy(){}};c.phase='READY';
  await assert.rejects(c.startSession({mode:'practice',question:{question_id:'CORE-01',canonical_text:'Question'},interviewSet:[],wizard:{},targetQuestions:1}),/access changed/);
  await parallel;assert.equal(parallelRejected,true);assert.equal(bootstrapCalls,2);
  assert.equal(creates,0);assert.equal(recorders,0);assert.equal(c.phase,'READY');
  assert.equal(c.account.subject,'wp:1');assert.equal(api.identity.subject,'wp:2');
});
test('retained save retries reject a changed account without replacing pending owner evidence',async()=>{
  const h=saveHarness({failPersistence:true});await h.durable.bootstrap();await h.durable.start({stream:{}});h.c.durableActive=true;
  await h.c.finishSession({record:{samples:[],events:[]}});
  const session=h.durable.accountSession,recording=h.durable.pendingRecording,analytics=h.c.lastSave.analytics;
  h.c.account.api.bootstrap=async()=>({entitlement:{admitted:true},identity:{subject:'wp:2',admin:false}});
  assert.equal(await h.c.retrySave(),null);assert.equal(h.writes.length,1);
  assert.equal(h.durable.accountSession,session);assert.equal(h.durable.pendingRecording,recording);
  assert.equal(h.c.lastSave.analytics,analytics);assert.equal(h.c.phase,'SAVE_FAILED');
});
test('persistence retry retains measured evidence and exact sealed recording',async()=>{
  const h=saveHarness({failPersistence:true});await h.durable.bootstrap();await h.durable.start({stream:{}});h.c.durableActive=true;
  const record={samples:[],events:[],questionText:'Question'};await h.c.finishSession({record});
  assert.equal(h.c.lastSave.retryable,true);const saved=await h.c.retrySave();
  assert.equal(saved.persisted,true);assert.equal(h.seals(),1);
  assert.deepEqual({...h.writes[1],capturedAt:h.writes[0].capturedAt},h.writes[0]);
  assert.equal(h.writes[1].analytics.schema,'missionmed.ivprep.analytics.session.v1');assert.equal(h.c.phase,'SAVED');
});
