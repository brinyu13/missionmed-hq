// One capture, native interviewer, recorder, clock and save owner.
// Presentation never grants admission or substitutes a local mock for production.
import { createEngine } from '../adapters/engine-adapter.mjs';
import { connectAccount } from '../adapters/account-adapter.mjs';
import { GptLiveInterviewer } from '../adapters/live-adapter.mjs';
import { state, addAttempt } from '../state.mjs';
import { bindOwnLibrary, bindOwnRow } from '../adapters/own-scope.mjs';
import { resolveOwnSavedReview } from '../../../studio/review-scope.mjs';
import { sealDerivedEvidence } from '../adapters/derived-evidence.mjs';
import { projectDerivedPriority } from '../adapters/saved-review.mjs';
import {normalizeInterviewPolicy,policyChangedError} from '../../../capabilities/interview-policy.mjs';
import {assertMicrophoneReady,hasUsableMicrophone} from '../adapters/media-readiness.mjs';
import {StableCameraRecording,supportsStableCameraRecording} from '../../../capabilities/stable-camera-recording.mjs';
const ENGINE = '/iv-prep-on-call/assets';
export const recordings = new Map();
const LOCKED = new Set(['STARTING','LIVE','SAVING','SAVE_FAILED']);
function assertEffectiveActor(account){
  if(account?.api?.identity?.subject!==account?.subject
    ||Boolean(account?.api?.identity?.admin)!==(account?.role==='admin')){
    state.attempts=[];throw new Error('Your account access changed. Return to Matrix and sign in again.');
  }
}
async function revalidateOwnAdmission(account,current,{interviewPolicyVersion,onPolicy}={}) {
  const admission=await account.api.bootstrap();
  if(!current())return false;
  if(admission?.entitlement?.admitted!==true||admission.identity?.subject!==account.subject
    ||Boolean(admission.identity.admin)!==(account.role==='admin')){
    state.attempts=[];throw new Error('Your account access changed. Return to Matrix and sign in again.');
  }
  if(interviewPolicyVersion!=null){
    let policy=null;
    try{policy=normalizeInterviewPolicy(admission.interviewPolicy);}catch{/* Fail before recording/provider startup. */}
    if(policy)onPolicy?.(policy);
    if(!policy||policy.version!==interviewPolicyVersion)throw policyChangedError();
  }
  return true;
}
export class SessionController extends EventTarget {
  constructor({ accountFactory = connectAccount, engineFactory = createEngine, liveFactory = options => new GptLiveInterviewer(options), mixFactory = null, cameraFactory = null } = {}) {
    super(); Object.assign(this,{ accountFactory,engineFactory,liveFactory,mixFactory,cameraFactory });
    this.phase='IDLE'; this.engine=null; this.engineMode=null; this.account=null; this.durable=null;
    this.video=null; this.audioElement=null; this.live=null; this.mix=null; this.durableActive=false;
    this.generation=0; this.lastSave=null; this.finishing=null; this.recordingOrigin=null;
    this.startingOperation=null;this.cleanupOperation=null;this.deviceSwitchOperation=null;
    this.currentInterviewPolicy=null;
    this.recordingVideo=null;this.deviceFault=null;this.onDeviceFailure=()=>{};
  }
  setPhase(phase,detail=null) { this.phase=phase; this.dispatchEvent(new CustomEvent('phase',{detail:{phase,detail}})); }
  get stream() { return this.engine?.stream || null; }
  get real() { return this.engineMode === 'real'; }
  get navigationLocked() { return LOCKED.has(this.phase); }
  get elapsed() { return this.recordingOrigin == null ? 0 : Math.max(0,(performance.now()-this.recordingOrigin)/1000); }
  get interviewPolicy(){return this.currentInterviewPolicy||this.account?.interviewPolicy||null;}
  ensureVideoElement() {
    if (!this.video) { this.video=document.createElement('video'); this.video.id='cam'; this.video.autoplay=true; this.video.muted=true; this.video.playsInline=true; }
    if (!this.audioElement) { this.audioElement=document.createElement('audio'); this.audioElement.id='live-interviewer-audio'; this.audioElement.autoplay=true; document.body.append(this.audioElement); }
    return this.video;
  }
  mountVideo(stage,canvas=null) {
    const video=this.ensureVideoElement(); if (video.parentElement !== stage) stage.prepend(video);
    if (video.srcObject) void video.play().catch(()=>{});
    if (this.engine?.real && canvas) this.engine.real.overlayCanvas=canvas;
    return video;
  }
  async connectAccount() {
    this.account=await this.accountFactory(); this.durable=this.account.durable;
    this.currentInterviewPolicy=this.account.interviewPolicy||null;
    this.dispatchEvent(new CustomEvent('account',{detail:this.account})); return this.account;
  }
  async acquire({ mode='real',overlayCanvas=null,cameraDeviceId='',microphoneDeviceId='' }={}) {
    if (mode !== 'real') throw new Error('Simulated media is not available in production.');
    if(this.deviceSwitchOperation)throw new Error('Your device change is still finishing. Try again when the preview is ready.');
    if (this.engine && this.phase === 'READY') {
      const engine=this.engine;
      engine.resumeInputAudio?.(); // reuse the capture owner's context in this user gesture
      if(!hasUsableMicrophone(engine.stream))await this.switchDevice('microphone',microphoneDeviceId||engine.real?.currentDevices?.().microphoneDeviceId||'');
      if(this.engine!==engine||this.phase!=='READY')throw new Error('Device setup was cancelled.');
      return engine;
    }
    if(this.phase==='DEVICES'||this.navigationLocked)throw new Error('Device or interview startup is already in progress.');
    if (!this.account) await this.connectAccount();
    if (this.account.mode !== 'REAL' || !this.durable?.ready) throw new Error('Your IVOC account is not ready. Sign in through Matrix.');
    const ticket=++this.generation;
    const preferred=this.devicePreferences();
    this.setPhase('DEVICES');
    // A removed remembered USB device must not turn a new session into an
    // exact-id NotFound error. Explicit selections remain explicit; only saved
    // preferences are filtered against currently enumerated hardware.
    if(globalThis.navigator?.mediaDevices?.enumerateDevices){
      try {
        const devices=await navigator.mediaDevices.enumerateDevices();
        if(ticket!==this.generation)throw new Error('Device setup was cancelled.');
        if(!cameraDeviceId&&devices.some(d=>d.kind==='videoinput'&&d.deviceId===preferred.cameraDeviceId))cameraDeviceId=preferred.cameraDeviceId;
        if(!microphoneDeviceId&&devices.some(d=>d.kind==='audioinput'&&d.deviceId===preferred.microphoneDeviceId))microphoneDeviceId=preferred.microphoneDeviceId;
      }catch(error){if(ticket!==this.generation)throw error;/* Enumeration failure uses browser defaults, not stale exact ids. */}
    }
    const engine=await this.engineFactory({mode,video:this.ensureVideoElement(),overlayCanvas,csrfToken:this.account.csrfToken,subject:this.account.subject});
    try {
      if(ticket!==this.generation)throw new Error('Device setup was cancelled.');
      this.engine=engine; this.engineMode=mode;
      await engine.start({cameraDeviceId,microphoneDeviceId});
      if (ticket !== this.generation) throw new Error('Device setup was cancelled.');
      this.persistDevicePreferences(engine.real?.currentDevices?.());
      this.setPhase('READY'); return engine;
    } catch(error) {
      const owns=this.engine===engine;
      engine.destroy?.({releaseMedia:true,preserveVideoBinding:!owns});
      if(owns){this.engine=null;this.engineMode=null;}
      if(ticket===this.generation)this.setPhase('IDLE');throw error;
    }
  }
  async startSession(options) {
    if(this.deviceSwitchOperation)throw new Error('Your device change is still finishing. Start when the preview is ready.');
    if(this.startingOperation||this.cleanupOperation)throw new Error('The previous interview startup is still closing. Try Start again when it finishes.');
    const operation=this.startOwnedSession(options);this.startingOperation=operation;
    try{return await operation;}finally{if(this.startingOperation===operation)this.startingOperation=null;}
  }
  async switchDevice(kind,id) {
    if(!this.canSwitchDevice(kind)||this.deviceSwitchOperation)throw new Error('This device cannot change now. Check it before recording starts.');
    const engine=this.engine,ticket=this.generation,phase=this.phase,live=this.live,mix=this.mix,video=this.recordingVideo;
    const current=()=>ticket===this.generation&&this.engine===engine&&this.phase===phase&&this.live===live&&this.mix===mix&&this.recordingVideo===video;
    const assertCurrent=()=>{if(!current())throw new Error('The device change was cancelled.');};
    const rollback=async participants=>{
      let failure=null;
      for(const tx of [...participants].reverse())try{await tx.rollback();}catch(error){failure||=error;}
      if(failure){if(current()&&live){await live.stop();this.onDeviceFailure('Your interviewer disconnected during a device change. Finish and save this recording.');}throw failure;}
    };
    const coordinator={assertCurrent,prepareReplacement:async({incoming,kind:trackKind})=>{
      const participants=[];
      try {
        assertCurrent();
        if(phase==='LIVE'){
          if(trackKind==='video')participants.push(await video.prepareCamera(incoming));
          else {participants.push(mix.prepareCandidateMicrophone(incoming));if(live)participants.push(await live.prepareMicrophoneReplacement(incoming,{isCurrent:current}));}
        }
        assertCurrent();
        return {commit(){assertCurrent();participants.forEach(tx=>tx.commit());},complete(){assertCurrent();participants.forEach(tx=>tx.complete());},
          rollback:()=>rollback(participants),release(){participants.forEach(tx=>tx.release());}};
      } catch(error){await rollback(participants);if(error.deviceRecoveryRequired&&current())this.onDeviceFailure('Your interviewer disconnected during a device change. Finish and save this recording.');throw error;}
    }};
    const operation=engine.switchDevice(kind,id,coordinator);this.deviceSwitchOperation=operation;
    try{
      const devices=await operation;
      if(ticket!==this.generation||this.engine!==engine)throw new Error('The device change was cancelled.');
      this.persistDevicePreferences(devices);
      return devices;
    }finally{if(this.deviceSwitchOperation===operation)this.deviceSwitchOperation=null;}
  }
  canSwitchDevice(kind) {
    if(!this.engine||this.deviceFault||!['camera','microphone'].includes(kind))return false;
    if(this.phase==='READY')return true;
    if(this.phase!=='LIVE'||!this.durableActive)return false;
    return kind==='camera'?Boolean(this.recordingVideo&&!this.recordingVideo.closed):Boolean(this.mix?.candidateAudioStream);
  }
  devicePreferences() {
    try {const value=JSON.parse(globalThis.localStorage?.getItem('ivoc.fable.devices.v1:'+this.account?.subject)||'null');
      return value&&typeof value==='object'?Object.fromEntries(['cameraDeviceId','microphoneDeviceId'].filter(key=>typeof value[key]==='string'&&value[key].length<=512).map(key=>[key,value[key]])):{};
    } catch{return {};}
  }
  persistDevicePreferences(devices) {
    if(!/^wp:[1-9][0-9]*$/.test(String(this.account?.subject||''))||!devices)return;
    try {globalThis.localStorage?.setItem('ivoc.fable.devices.v1:'+this.account.subject,JSON.stringify({cameraDeviceId:devices.cameraDeviceId||'',microphoneDeviceId:devices.microphoneDeviceId||''}));}catch{}
  }
  async startOwnedSession(options) {
    if (this.navigationLocked || !this.stream || !this.durable?.ready) throw new Error('Connect your camera and microphone before starting.');
    if (options.mode==='mock' && !this.account.liveInterviewAvailable) throw new Error('The live interviewer is unavailable. Try again, or choose Self Practice.');
    assertMicrophoneReady(this.stream,this.engine.audioContext);
    const ticket=++this.generation;
    const engine=this.engine,durable=this.durable,account=this.account,subject=account.subject,role=account.role,api=account.api,durableApi=durable.api;
    const stream=engine.stream,audioContext=engine.audioContext,audioTrack=stream.getAudioTracks()[0];
    const assertOwnedInput=()=>{
      if(engine.stream!==stream||engine.audioContext!==audioContext||stream.getAudioTracks()[0]!==audioTrack)throw new Error('Your microphone setup changed. Reconnect before starting.');
      assertMicrophoneReady(stream,audioContext);
      this.recordingVideo?.assertHealthy?.();
    };
    const current=()=>ticket===this.generation&&this.engine===engine&&this.durable===durable&&this.account===account
      &&account.subject===subject&&account.role===role&&account.api===api&&durable.api===durableApi;
    let ownedLive=null,ownedVideo=null;
    this.deviceFault=null;this.onDeviceFailure=options.onDeviceFailure||(()=>{});
    const {mode,question,interviewSet,wizard,targetQuestions}=options;
    const input={question,interviewSet,wizard,targetQuestions,interviewerProvider:mode==='mock'?'openai-gpt-live':'missionmed-static'};
    this.setPhase('STARTING');
    try {
      if(!await revalidateOwnAdmission(account,current,{interviewPolicyVersion:mode==='mock'?wizard?.interviewPolicyVersion:undefined,
        onPolicy:policy=>{this.currentInterviewPolicy=policy;}}))throw new Error('Interview startup was cancelled.');
      assertEffectiveActor(account);
      assertOwnedInput();
      try{await durable.prepare(input);}catch(error){
        if(error.payload?.error==='ivoc_interview_policy_changed'){
          await revalidateOwnAdmission(account,current,{interviewPolicyVersion:wizard?.interviewPolicyVersion,onPolicy:policy=>{this.currentInterviewPolicy=policy;}});
          throw policyChangedError();
        }
        throw error;
      }
      if (!current()) throw new Error('Interview startup was cancelled.');
      assertEffectiveActor(account);
      assertOwnedInput();
      const stableCamera=Boolean(this.cameraFactory||supportsStableCameraRecording());
      const makeMix=mode==='mock'||stableCamera?(this.mixFactory || (await import(ENGINE+'/capabilities/conversation-recording.mjs')).createConversationRecordingMix):null;
      if(!current())throw new Error('Interview startup was cancelled.');
      assertEffectiveActor(account);
      if(mode==='mock'&&wizard?.interviewPolicyVersion!=null){
        if(!await revalidateOwnAdmission(account,current,{interviewPolicyVersion:wizard.interviewPolicyVersion,onPolicy:policy=>{this.currentInterviewPolicy=policy;}}))throw new Error('Interview startup was cancelled.');
        assertEffectiveActor(account);
      }
      assertOwnedInput();
      if(stableCamera){
        const createCamera=this.cameraFactory||((track,opts)=>StableCameraRecording.create(track,opts));
        ownedVideo=await createCamera(engine.stream.getVideoTracks()[0],{onFault:()=>{
          if(!current())return;this.deviceFault='The recording camera stopped. Finish and save the available recording, then reconnect.';
          this.onDeviceFailure(this.deviceFault);
        }});
        if(!current()){ownedVideo.destroy();throw new Error('Interview startup was cancelled.');}
        this.recordingVideo=ownedVideo;
      }
      this.mix=makeMix?makeMix({candidateStream:engine.stream,videoStream:this.recordingVideo?.stream||engine.stream,audioContext:engine.audioContext,retainCandidateAudio:true}):null;
      assertOwnedInput();
      await durable.start({...input,stream:this.mix?.stream || engine.stream,candidateStream:this.mix?.candidateAudioStream || engine.stream,assertCaptureReady:()=>{
        if(!current())throw new Error('Interview startup was cancelled.');
        assertEffectiveActor(account);assertOwnedInput();
      }});
      if (!current()) throw new Error('Interview startup was cancelled.');
      assertEffectiveActor(account);
      assertOwnedInput();
      this.durableActive=true; this.recordingOrigin=durable.recorder.startedAt;
      await engine.beginSession?.({recordingOrigin:this.recordingOrigin});
      if(!current())throw new Error('Interview startup was cancelled.');
      assertEffectiveActor(account);
      assertOwnedInput();
      if (mode==='mock') {
        const live=this.liveFactory({...options,account,audioElement:this.audioElement,engine,recordingMix:this.mix,durable,
          onStatus:status=>{options.onStatus?.(status);if(status.state==='error' && current()) options.onProviderFailed?.(status.detail);} });
        ownedLive=live;this.live=live; // publish before awaiting, so cancellation owns this connection
        await live.connect({audioTrack:engine.stream.getAudioTracks()[0],voice:options.voice,context:options.context,ivocSessionId:durable.accountSession.id,openingQuestion:options.openingQuestion});
        if (!current()) { await live.stop(); throw new Error('Interview startup was cancelled.'); }
        assertOwnedInput();
      }
      this.setPhase('LIVE');
      return {interviewer:this.live,labels:{transport:mode==='mock'?'gpt-live':'none',recording:'account',account:'REAL'}};
    } catch(error) {
      ownedVideo?.destroy?.();if(this.recordingVideo===ownedVideo)this.recordingVideo=null;
      if(current()){
        const abandoned=this.abandon('recording_start_failed'),cleanupTicket=this.generation;
        await abandoned;
        if(cleanupTicket===this.generation)this.setPhase(this.engine?'READY':'IDLE');
      }else{
        // No replacement startup is admitted until this operation drains. Only
        // the old durable owner is cleaned; newer capture/phase stays untouched.
        await this.queueCleanup({live:ownedLive,durable,sessionId:durable.accountSession?.id,reason:'cancelled_startup_drained'});
      }
      throw error;
    }
  }
  async finishSession({record}) {
    if(this.finishing) return this.finishing;
    this.finishing=this.finish(record).finally(()=>{this.finishing=null;}); return this.finishing;
  }
  async finish(record) {
    if(!this.durableActive) throw new Error('No active account recording.');
    this.setPhase('SAVING');
    if(this.live) { const live=this.live; this.live=null; await live.stop().catch(()=>{}); }
    let analytics=null;
    try {
      const result=await this.engine.finish();
      analytics=result?.analytics || null;
      if(!analytics) throw new Error('The measured session evidence could not be sealed.');
      // Derived trace only, alongside the unchanged sealed engine envelope.
      analytics={...analytics,fable:sealDerivedEvidence(record)};
      const saved=await this.durable.finish(Promise.resolve(analytics));
      return this.completeSave(record,saved);
    } catch(error) {
      this.lastSave={record,analytics,error:String(error?.message||error),retryable:Boolean(analytics)};
      this.setPhase('SAVE_FAILED',{error:this.lastSave.error,retryable:this.lastSave.retryable});
      // Keep durable pendingRecording/pendingAnalytics for exact retry. Release hardware only.
      this.releaseMedia(); return {...record,persisted:false,saveError:this.lastSave.error};
    } finally { this.mix?.destroy?.(); this.mix=null;this.recordingVideo?.destroy?.();this.recordingVideo=null; }
  }
  completeSave(record,saved) {
    const attempt={...record,id:saved.session.id,persisted:true,storage:'account',ownerSubject:this.account.subject,saveError:null,
      recordingId:saved.recording?.recording?.id||null,remote:{...saved.session,results:{payload:saved.envelope},recording:saved.recording?.recording},sealed:{schema:saved.analytics?.schema}};
    this.durableActive=false; this.lastSave={attempt}; addAttempt(attempt);
    this.releaseMedia(); this.setPhase('SAVED',{attemptId:attempt.id}); return attempt;
  }
  async retrySave() {
    if(!this.lastSave?.error || !this.durable) return null;
    if(!this.lastSave.retryable || !this.lastSave.analytics){
      this.setPhase('SAVE_FAILED',{error:'The measured evidence could not be sealed. This attempt cannot be marked saved without it.',retryable:false});return null;
    }
    const pending=this.lastSave,account=this.account,durable=this.durable,subject=account?.subject,role=account?.role,api=account?.api,durableApi=durable.api;
    const sessionId=durable.accountSession?.id,record=pending.record,ticket=this.generation;
    const current=()=>this.generation===ticket&&this.lastSave===pending&&this.account===account&&this.durable===durable&&account?.subject===subject
      &&account?.role===role&&account?.api===api&&durable.api===durableApi;
    this.setPhase('SAVING');
    try {
      if(!await revalidateOwnAdmission(account,()=>current()&&durable.accountSession?.id===sessionId))return null;
      assertEffectiveActor(account);
      const saved=await durable.finish(Promise.resolve(pending.analytics));
      if(!current())return null;
      assertEffectiveActor(account);
      if(!sessionId||saved?.session?.id!==sessionId)throw new Error('The saved attempt identity changed. Return to Matrix.');
      return this.completeSave(record,saved);
    }
    catch(error) { if(current()){pending.error=String(error?.message||error);this.setPhase('SAVE_FAILED',{error:pending.error,retryable:true});}return null; }
  }
  candidateAudioRetryAvailable(id){
    return Boolean(!this.navigationLocked&&this.account?.subject&&this.durable?.candidateRetry?.sessionId===id&&this.durable.candidateRecorder);
  }
  async retryCandidateAudio(id,{isCurrent=()=>true}={}){
    const account=this.account,durable=this.durable,subject=account?.subject;
    const current=()=>isCurrent()&&this.account===account&&this.durable===durable&&this.account?.subject===subject;
    if(!this.candidateAudioRetryAvailable(id))throw new Error('The retained microphone upload is unavailable. Your full recording is unchanged.');
    const own=await this.freshOwnLibrary({isCurrent:current});
    if(!current())return null;
    if(!own?.sessions?.some(s=>s.id===id&&s.ownerSubject===subject&&s.state==='saved')||!this.candidateAudioRetryAvailable(id))throw new Error('This microphone recording is not in your current saved account.');
    assertEffectiveActor(account);
    const result=await durable.retryCandidateAudio();
    if(!current())return null;
    return result;
  }
  releaseMedia() {
    this.engine?.destroy?.({releaseMedia:true}); this.engine=null; this.engineMode=null;
    if(this.video) this.video.srcObject=null;
  }
  queueCleanup({live=null,durable=null,mix=null,video=null,sessionId=null,reason='client_exit',keepalive=false}={}) {
    // The reused Durable owner clears its recorder after awaited server cleanup.
    // Serialize every cleanup, including cancelled-start cleanup, before admitting
    // a replacement recording. Captured IDs prevent cleanup from adopting a new owner.
    const previous=this.cleanupOperation;
    const operation=(previous||Promise.resolve()).catch(()=>{}).then(async()=>{
      if(live)await live.stop({keepalive}).catch(()=>{});
      if(sessionId&&durable?.accountSession?.id===sessionId)await durable.abandon({reason,keepalive}).catch(()=>{});
      mix?.destroy?.();
      video?.destroy?.();
    });
    this.cleanupOperation=operation;
    operation.finally(()=>{if(this.cleanupOperation===operation)this.cleanupOperation=null;}).catch(()=>{});
    return operation;
  }
  abandon(reason='client_exit',{keepalive=false}={}) {
    ++this.generation;
    const live=this.live,durable=this.durable,mix=this.mix,video=this.recordingVideo,sessionId=durable?.accountSession?.id;
    this.live=null;this.mix=null;this.recordingVideo=null;this.durableActive=false;
    return this.queueCleanup({live,durable,mix,video,sessionId,reason,keepalive});
  }
  async release(reason='release') { const abandoned=this.abandon(reason);this.releaseMedia();this.setPhase('IDLE',{reason});await abandoned; }
  async freshOwnLibrary({isCurrent=()=>true}={}) {
    if(!this.account?.subject || !this.durable?.ready) throw new Error('Sign in through Matrix to view your recordings.');
    const account=this.account,subject=account.subject,role=account.role,api=account.api,durable=this.durable,durableApi=durable.api;
    const current=()=>isCurrent()&&this.account===account&&this.durable===durable&&account.subject===subject
      &&account.role===role&&account.api===api&&durable.api===durableApi;
    if(!await revalidateOwnAdmission(account,current))return null;
    // List projection: Fable list/history screens and row identity checks never read
    // per-rep measured arrays; Results/Film Room load the full session detail separately.
    const own=await durable.library('own','list');if(!current())return null;
    // The own projection omits per-row owners. Bind only its request-scoped
    // server receipt, never infer that an unchanged client label means an
    // unchanged cookie. The receipt also rejects an A -> B -> A login race.
    if(own?.scopeSubject!==subject){
      state.attempts=[];throw new Error('Your account access changed. Return to Matrix and sign in again.');
    }
    if(!await revalidateOwnAdmission(account,current))return null;
    assertEffectiveActor(account);
    return bindOwnLibrary(own,subject);
  }
  async library({isCurrent=()=>true}={}) {
    const own=await this.freshOwnLibrary({isCurrent});if(!own)return {source:'account',attempts:[],sessions:[]};
    const attempts=(own.sessions||[]).filter(s=>s.ownerSubject===this.account.subject && s.state==='saved').map(s=>{
      const f=s.results?.payload?.analytics?.fable || {};
      const at=Date.parse(s.endedAt||s.startedAt||s.createdAt);
      const durationS=s.recording?.durationMs==null?null:s.recording.durationMs/1000;
      const priority=projectDerivedPriority(f,durationS);
      return {...f,id:s.id,at:Number.isFinite(at)?at:null,storage:'account',persisted:true,ownerSubject:s.ownerSubject,
        questionText:s.questionText||s.title||'Saved answer',questionId:s.questionId||null,mode:s.interviewerProvider==='openai-gpt-live'?'mock':'practice',
        durationS,remote:s,debriefLane:priority?.lane||null,priorityLane:priority?.lane||null,priorityText:priority?.text||null};
    });
    state.attempts=attempts;
    return {source:'account',attempts,sessions:own.sessions||[]};
  }
  async playbackUrl(attempt,{isCurrent=()=>true}={}) {
    const account=this.account,durable=this.durable,subject=account?.subject,role=account?.role,api=account?.api,durableApi=durable?.api;
    const current=()=>isCurrent()&&this.account===account&&this.durable===durable&&account?.subject===subject
      &&account?.role===role&&account?.api===api&&durable?.api===durableApi;
    if(attempt.ownerSubject!==this.account?.subject || !attempt.recordingId) throw new Error('This recording is not in your account.');
    const own=await this.freshOwnLibrary({isCurrent:current});
    if(!current()||!own?.sessions.some(row=>row.id===attempt.id&&row.recording?.id===attempt.recordingId))throw new Error('This recording is no longer available in your account.');
    const result=await durable.playback(attempt.recordingId);
    if(!current())throw new Error('Account or review changed during playback setup.');
    if(!await revalidateOwnAdmission(account,current))throw new Error('Account or review changed during playback setup.');
    assertEffectiveActor(account);
    return result;
  }
  async sessionDetail(id,{isCurrent=()=>true}={}) {
    if(!this.account?.subject || !this.durable?.ready || !isCurrent()) return null;
    const account=this.account,durable=this.durable,subject=account.subject,role=account.role,api=account.api,durableApi=durable.api;
    const current=()=>isCurrent()&&this.account===account&&this.durable===durable&&account.subject===subject
      &&account.role===role&&account.api===api&&durable.api===durableApi;
    const saved=await resolveOwnSavedReview({route:{view:'postanswer',sessionId:id},library:()=>this.freshOwnLibrary({isCurrent:current}),session:value=>durable.api.session(value),isCurrent:current});
    if(!current() || saved?.session?.ownerSubject!==subject) return null;
    if(!await revalidateOwnAdmission(account,current))return null;
    assertEffectiveActor(account);
    const detail=bindOwnRow(saved.sessionDetail,subject);
    return detail?{...saved,sessionDetail:detail,reviewScope:'own',scopeSubject:subject}:null;
  }
}
export const controller=new SessionController();
if(typeof window!=='undefined') window.addEventListener('pagehide',()=>{void controller.abandon('pagehide',{keepalive:true});controller.releaseMedia();});
