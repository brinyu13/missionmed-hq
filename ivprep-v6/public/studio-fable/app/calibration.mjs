// Device check and calibration use the real analytics engine without an interview.
// Each step names what the student does and which instrument must respond; pass conditions are
// read from the real producer response. Nothing is saved
// as a rep. The result is a personal calibration record used for corridors in the room.
import { state, commit } from './state.mjs';
import { controller } from './controller/session-controller.mjs';
import { awaitVisibleCamera,assertMicrophoneReady } from './adapters/media-readiness.mjs';
import {mountDeviceControls,deviceControlsMarkup} from './adapters/device-controls.mjs';
import {mountDeviceReadiness,deviceReadinessMarkup,readinessCapabilities} from './adapters/device-readiness.mjs';
import {bindPrimaryRecovery} from './adapters/engine-adapter.mjs';
import { leftRailMarkup, rightRailMarkup, RailsController } from './instruments/rails.mjs';
import { recorderMarkup, LiveRecorder } from './instruments/flight-recorder.mjs';
import { TraceHistory } from './model/trace-reducer.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PASSAGE = 'This is a microphone rehearsal, not an interview answer. Read these sentences at a comfortable pace. Take a breath between thoughts, then vary your volume naturally. A clear answer has enough space for the listener to follow. Pause for a moment, and continue at your usual speaking pace.';

const STEPS = [
  { id: 'devices', title: 'Devices', do: 'Connect your camera and microphone. Verify your visible preview.', resolves: ['readiness'], check: (f, ctx) => ctx.started },
  { id: 'frame', title: 'Frame yourself', do: 'Sit so your face fills the guide and your shoulders are visible.', resolves: ['framing'], check: (f) => f?.headFace?.presence === 'TRACKED' && f?.bodyHands?.inFrame },
  { id: 'neutral', title: 'Neutral face · 4 s', do: 'Hold a neutral face and look at the camera. This captures your personal baseline for smile detection.', resolves: ['faceBaseline'], check: (f, ctx) => ctx.neutralMs >= 4000 && f?.headFace?.faceBaseline?.available === true, timed: true },
  { id: 'smile', title: 'Smile twice', do: 'Smile naturally, relax, smile again. Watch the mouth and cheek regions respond.', resolves: ['smile'], check: (f, ctx) => (f?.headFace?.smileEvents ?? 0) - ctx.smileBase >= 2 },
  { id: 'nod', title: 'Nod three times', do: 'Nod as if an interviewer just made a good point.', resolves: ['nods'], check: (f, ctx) => (f?.headFace?.nods ?? 0) - ctx.nodBase >= 3 },
  { id: 'hands', title: 'Hands and gesture', do: 'Raise both hands into view, then explain something with your hands for a few seconds.', resolves: ['hands', 'gesture'], check: (f, ctx) => f?.bodyHands?.bothHandsVisible && (f?.bodyHands?.gestures ?? 0) - ctx.gestureBase >= 1 },
  { id: 'passage', title: 'Read the passage', do: 'Read the passage below at your normal interview voice. Pace, Volume and Pitch should come alive in that order.', resolves: ['volume', 'pitch', 'pace'], check: (f) => f?.volume?.coachingAvailable && f?.pitch?.available && f?.speedWpm?.available, passage: true },
  { id: 'vary', title: 'Vary your volume', do: 'Say one line quietly, one normally, one loud. The Volume pill should move Quiet → Hold → Loud.', resolves: ['volumeRange'], check: (f, ctx) => ctx.volSeen.size >= 2 },
  { id: 'pause', title: 'Pause 3 s', do: 'Stop talking for three seconds. While Pace holds its last value, choose Next step.', resolves: ['pauseHold'], check: (f, ctx) => ctx.pauseMs >= 3000 && ctx.paceHeld },
  { id: 'speed', title: 'Speed up, slow down', do: 'Read the line fast, then slowly. The needle should sweep right then left.', resolves: ['paceRange'], check: (f, ctx) => ctx.wpmMax - ctx.wpmMin >= 40 },
  { id: 'seal', title: 'Seal calibration', do: 'Review which instruments resolved. Unresolved instruments stay dark in the room; nothing is invented.', resolves: [], check: () => true },
];
const INSTRUMENTS = { readiness: 'Camera + mic', framing: 'Framing', faceBaseline: 'Face baseline', smile: 'Smile pattern', nods: 'Head nods', hands: 'Hand visibility', gesture: 'Gesture units', volume: 'Volume (LUFS-K)', pitch: 'Pitch (F0)', pace: 'Pace (timed words)', volumeRange: 'Volume range', pauseHold: 'Pace hold law', paceRange: 'Pace range' };

export async function mountCalibration(main, { isCurrent = () => true, returnToMock = false, returnHash = '#/mock',beforeInterview=false,onReady=()=>{} } = {}) {
  const steps = STEPS.map(step => ({...step}));
  let disposed = false, connecting = false, deviceSwitching=false;
  const account=controller.account,durable=controller.durable;
  const current = () => !disposed && isCurrent()&&controller.account===account&&controller.durable===durable;
  const ctx = { started: false, neutralMs: 0, smileBase: 0, nodBase: 0, gestureBase: 0, volSeen: new Set(), pauseMs: 0, pauseStartedAt: null, pauseLastAt: null, paceHeld: false, wpmMax: -Infinity, wpmMin: Infinity };
  let stepIndex = 0; const resolved = {}; let engine = null; let timer = null; let latest = null; let lastT = 0;let disposeDevices=null,disposePrimary=null,verifiedCapture=null;
  main.innerHTML = `
    <div class="cal-screen">
    <div class="screen-head"><div><a class="btn btn-quiet" href="#/mock" id="return-setup" hidden>Return to interview setup ▸</a><div class="t-kick gold">Devices &amp; calibration</div><h1 class="t-hero">Check devices. <em>Try your instruments.</em></h1><p class="t-edit">Choose your camera and microphone, then smile, nod, gesture and speak to check the real measurements. This is not recorded. If an instrument cannot respond, mark it unavailable; nothing is invented.</p></div><div style="display:flex;gap:8px;align-items:center"><span class="chip warn" id="calibration-record-state">Connect devices to verify saved calibration</span></div></div>
    <div class="cal">
      <aside class="housing panel"><div class="t-label" style="margin-bottom:10px">Rehearsal</div><div class="cal-steps" id="cal-steps"></div></aside>
      <div class="cal-stage-col">
        <section class="housing cal-prompt" id="cal-prompt"></section>
        <div class="stage" id="stage" data-guides="true"><canvas id="overlay"></canvas><div class="frame-guide" aria-hidden="true"></div><span class="tag"><i style="background:var(--cyan);animation:none"></i>Calibration · not recorded</span>
          <div class="stage-enter" id="enter"><div><div class="t-kick gold">Step 1 · Devices</div><h2 class="t-h2" style="margin:8px 0 6px">Connect to begin</h2><p>Raw frames never leave your browser. This rehearsal is not recorded or saved as a rep.</p><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:16px"><button class="btn btn-primary btn-lg" type="button" id="connect-real">Connect camera + mic ▸</button></div></div></div>
        </div>
        <p class="note readiness-status" id="enter-note" role="status" aria-live="polite"></p>
        <div class="note" id="primary-recovery" role="status" aria-live="polite" hidden><span data-primary-status></span> <button class="btn btn-quiet" type="button" data-reselect-primary>Lock to me</button></div>
        ${deviceControlsMarkup()}
        ${deviceReadinessMarkup({fullPanels:true})}
        <div class="cal-actions"><button class="btn btn-primary" type="button" id="next-step" disabled>Next step ▸</button><button class="btn btn-quiet" type="button" id="skip-step">Mark unavailable &amp; continue</button><span class="t-tech" id="step-state">Waiting</span><span style="flex:1"></span><button class="btn btn-primary" type="button" id="continue-interview" ${beforeInterview?'disabled':'hidden'}>Ready for interview ▸</button></div>
        <section class="recorder" id="recorder" data-mode="live" style="height:150px">${recorderMarkup({ mode: 'live' })}</section>
      </div>
      <aside class="rail" id="rail-right" aria-label="Voice rail">${rightRailMarkup()}</aside>
    </div>
    <details class="advanced cal-lower-wrap" id="cal-lower"><summary><span>Head / Face · Body / Hands plates and instrument resolution</span><span>show</span></summary>
    <div class="two-col cal-lower" style="margin-top:12px"><aside class="rail" id="rail-left" aria-label="Teaching rail" style="grid-template-columns:repeat(2,1fr);display:grid">${leftRailMarkup()}</aside>
      <section class="housing panel"><div class="t-label" style="margin-bottom:8px">Instrument resolution</div><div class="resolve-list" id="resolve-list"></div><p class="note" style="margin-top:10px">RESOLVED = the real producer responded under the pass condition. PARTIAL = responded without meeting it. NOT RESOLVED = the producer is unavailable in this environment (for example Pace requires supported timed-word measurements).</p><details class="advanced" id="saved-calibration-record" hidden><summary>Your saved calibration</summary><p class="note">These labels belong to your saved account/device baseline, not this new rehearsal.</p><div class="resolve-list" id="saved-resolve-list"></div></details></section>
    </div></details>
    </div>`;
  const $ = (id) => main.querySelector(`#${id}`);
  if(beforeInterview)$('cal-lower').open=true;
  if(returnToMock){$('return-setup').hidden=false;$('return-setup').href=returnHash;}
  if(beforeInterview){$('return-setup').hidden=false;$('return-setup').href=returnHash;}
  const rails = new RailsController(main);
  const recorder = new LiveRecorder($('recorder'), { window: '1M' });
  const history = new TraceHistory();
  const deviceReadiness=mountDeviceReadiness(main.querySelector('[data-device-readiness]'),{
    fullPanels:true,getCapabilities:()=>readinessCapabilities(controller.account,controller.durable,typeof MediaRecorder==='function'),
    getEngine:()=>engine,getStream:()=>controller.stream,getVideo:()=>controller.video,isCurrent:current,isSwitching:()=>deviceSwitching,
    previewVerified:()=>Boolean(verifiedCapture&&verifiedCapture.stream===controller.stream&&verifiedCapture.video===controller.video&&verifiedCapture.track===controller.stream?.getVideoTracks?.()[0]),
    onCaptureInvalidated:()=>{verifiedCapture=null;},
    isAdmin:()=>controller.account?.role==='admin'&&controller.account.api?.identity?.admin===true&&controller.account.api.identity.subject===controller.account.subject,
  });
  function renderCalibrationRecord(){
    state.calibration=engine?.calibrationResolution||null;commit();
    const saved=state.calibration,chip=$('calibration-record-state');
    chip.className='chip '+(saved?'ok':'warn');chip.textContent=saved?'Calibrated '+new Date(saved.at).toLocaleDateString():'No current saved resolution record';
    $('saved-calibration-record').hidden=!saved;
    $('saved-resolve-list').innerHTML=saved?Object.entries(INSTRUMENTS).map(([key,label])=>`<div class="resolve" data-state="${saved.resolved[key]||'not'}"><span>${label}</span><span class="r">${saved.resolved[key]==='resolved'?'Resolved':saved.resolved[key]==='partial'?'Partial':'Not resolved'}</span></div>`).join(''):'';
  }

  function renderSteps() {
    $('cal-steps').innerHTML = steps.map((s, i) => `<div class="cal-step" data-state="${i < stepIndex ? (s.skipped ? 'partial' : 'resolved') : i === stepIndex ? 'current' : ''}"><i>${i < stepIndex ? (s.skipped ? '–' : '✓') : i + 1}</i><div><strong>${s.title}</strong><small>${s.resolves.map((r) => INSTRUMENTS[r]).join(' · ') || 'summary'}</small></div><span class="res">${i < stepIndex ? (s.skipped ? 'skipped' : 'done') : i === stepIndex ? 'now' : ''}</span></div>`).join('');
    const s = steps[stepIndex];
    $('cal-prompt').innerHTML = `<div class="t-kick gold">Step ${stepIndex + 1} of ${steps.length}</div><h2>${s.title}</h2><p>${s.do}</p>${s.passage ? `<div class="passage">${esc(PASSAGE)}</div>` : ''}${s.id === 'seal' ? `<div class="resolve-list" style="margin-top:10px">${Object.keys(INSTRUMENTS).map((k) => `<div class="resolve" data-state="${resolved[k] || 'not'}"><span>${INSTRUMENTS[k]}</span><span class="r">${resolved[k] === 'resolved' ? 'Resolved' : resolved[k] === 'partial' ? 'Partial' : 'Not resolved'}</span></div>`).join('')}</div>` : ''}`;
    $('resolve-list').innerHTML = Object.keys(INSTRUMENTS).map((k) => `<div class="resolve" data-state="${resolved[k] || 'not'}"><span>${INSTRUMENTS[k]}</span><span class="r">${resolved[k] === 'resolved' ? 'Resolved' : resolved[k] === 'partial' ? 'Partial' : 'Not resolved'}</span></div>`).join('');
    $('next-step').textContent = s.id === 'seal' ? 'Seal calibration ▸' : 'Next step ▸';

  }
  function calibrationStatus() {
    const snapshot=engine?.real?.behavior?.calibration?.snapshot(engine.real.clock?.sessionMs()||0);
    if(snapshot?.complete)return 'Personal baseline ready to save';
    if(snapshot?.phase==='COMPLETE')return 'More measured speech is needed before a personal baseline can be saved.';
    const remaining=snapshot?Math.ceil(Math.max(0,(snapshot.phase==='READING_PASSAGE'?snapshot.readingDurationMs:snapshot.fingerprintDurationMs)-snapshot.elapsedInPhaseMs)/1000):null;
    return remaining==null?'Start rehearsal first':(snapshot.phase==='READING_PASSAGE'?'Reading baseline':'Delivery rehearsal')+' · '+remaining+' s remaining. Keep speaking naturally.';
  }
  function evaluate() {
    const s = steps[stepIndex]; const pass = Boolean(ctx.started && s.check(latest, ctx));
    $('next-step').disabled = deviceSwitching || !ctx.started || !(pass || s.id === 'seal');
    $('continue-interview').disabled=deviceSwitching||!ctx.started||s.id!=='seal'||!verifiedCapture||verifiedCapture.stream!==controller.stream;
    $('step-state').textContent = s.id === 'seal' ? calibrationStatus() : pass ? 'Responded · pass' : ctx.started ? 'Watching for the response…' : 'Waiting';
    if (pass) for (const r of s.resolves) resolved[r] = 'resolved';
  }
  function resetRehearsal(){
    renderCalibrationRecord();history.samples=[];history.lastT=-Infinity;latest=null;lastT=0;
    for(const key of Object.keys(resolved))delete resolved[key];
    steps.forEach(step=>{delete step.skipped;});Object.assign(ctx,{started:false,neutralMs:0,smileBase:0,nodBase:0,gestureBase:0,pauseMs:0,pauseStartedAt:null,pauseLastAt:null,paceHeld:false,wpmMax:-Infinity,wpmMin:Infinity});ctx.volSeen.clear();
    stepIndex=0;renderSteps();evaluate();
  }
  function completeReadiness(){
    if(!current())return;
    deviceReadiness.refresh(); // invalidate any previous capture before its new pixel receipt
    verifiedCapture={account,durable,subject:account.subject,engine,stream:controller.stream,video:controller.video,track:controller.stream?.getVideoTracks?.()[0],camera:controller.stream?.getVideoTracks?.()[0],microphone:controller.stream?.getAudioTracks?.()[0]};deviceReadiness.refresh();
    renderCalibrationRecord();ctx.started=true;resolved.readiness='resolved';$('enter')?.remove();$('enter-note').hidden=true;
    engine.beginAnswer();engine.setOverlayVisibility({face:true,hands:true,body:true,position:true});
    // Initial black-preview recovery must initialize rehearsal exactly once.
    if(timer===null){
      engine.events.addEventListener('frame',frameListener);
      timer=setInterval(()=>{if(!current())return;recorder.setData(history.samples,[]);recorder.tick(latest?.t||0);evaluate();},500);
    }
    stepIndex=1;renderSteps();evaluate();
  }
  disposeDevices=await mountDeviceControls(main.querySelector('[data-device-controls]'),{getEngine:()=>engine,getVideo:()=>controller.video,getStream:()=>controller.stream,isCurrent:current,canSwitch:()=>!connecting&&(!engine||controller.phase==='READY'),switchDevice:(kind,id)=>controller.switchDevice(kind,id),onSwitching:(value,ready)=>{
        if(!current())return;
        deviceSwitching=value;
        if(value){ctx.started=false;delete resolved.readiness;deviceReadiness.reset();deviceReadiness.refresh();}
        else if(ready)completeReadiness();
        else{$('enter-note').hidden=false;$('enter-note').textContent='The selected devices are not ready. Check the message below and choose another device.';}
        $('skip-step').disabled=value;evaluate();
      },onChanged:resetRehearsal});
  async function begin() {
    if(connecting || disposed)return;connecting=true;$('connect-real').disabled=true;$('enter-note').textContent='Connecting…';
    try {
      controller.mountVideo($('stage'),$('overlay'));
      engine=await controller.acquire({mode:'real',overlayCanvas:$('overlay'),...disposeDevices?.preferences?.()});
      if(!current())return;
      deviceReadiness.refresh();
      disposePrimary?.();disposePrimary=bindPrimaryRecovery($('primary-recovery'),{engine,isCurrent:current});
      const video=controller.mountVideo($('stage'),$('overlay'));
      await disposeDevices?.refresh?.();
      if(!current()){disposeDevices?.();return;}
      await awaitVisibleCamera(video,controller.stream,{isCurrent:current});
      if(!current())return;
      if(!controller.stream.getAudioTracks().some(t=>t.readyState==='live'&&t.enabled&&!t.muted))throw new Error('Connect your microphone to begin rehearsal.');
      completeReadiness();
    } catch(error){if(current()){$('enter-note').textContent=error.message;$('connect-real').disabled=false;}}
    finally{connecting=false;if(current())await disposeDevices?.refresh?.().catch(()=>{});}
  }
  const frameListener=e=>{if(current())onFrame(e.detail);};
  function onFrame(f) {
    if(!ctx.started||deviceSwitching)return;
    latest = f; rails.ingest(f); history.push(f);
    const s = steps[stepIndex]; const dt = Math.max(0, f.t - lastT); lastT = f.t;
    if (s.id === 'neutral' && f.headFace?.presence === 'TRACKED') ctx.neutralMs += dt * 1000;
    if (s.id === 'vary' && f.volume?.cue != null) ctx.volSeen.add(f.volume.cue);
    if (s.id === 'pause') {
      const at = Number.isFinite(f.t) && f.t >= 0 ? f.t : null;
      const quietHeld = f.speaking === false && main.querySelector('#speedo')?.dataset.held === 'true' && at !== null;
      if (!quietHeld) {
        ctx.pauseStartedAt = null; ctx.pauseLastAt = null; ctx.pauseMs = 0; ctx.paceHeld = false;
      } else {
        // One observed continuous interval, not several short pauses added together.
        // A missing/backwards clock or a >1 s producer gap cannot prove quiet continuity.
        if (ctx.pauseStartedAt === null || ctx.pauseLastAt === null || at < ctx.pauseLastAt || at - ctx.pauseLastAt > 1) ctx.pauseStartedAt = at;
        ctx.pauseLastAt = at; ctx.pauseMs = Math.max(0, (at - ctx.pauseStartedAt) * 1000); ctx.paceHeld = true;
      }
    }
    if (f.speedWpm?.available && Number.isFinite(f.speedWpm.wordsPerMinute) && s.id === 'speed') { ctx.wpmMax = Math.max(ctx.wpmMax, f.speedWpm.wordsPerMinute); ctx.wpmMin = Math.min(ctx.wpmMin, f.speedWpm.wordsPerMinute); }
    if (s.id === 'passage' && f.speedWpm?.available === false && f.speaking && /unavailable|unreachable|same_origin|csrf/i.test(String(f.speedWpm.holdReason || ''))) resolved.pace = 'not';
  }
  $('connect-real').addEventListener('click',()=>void begin());
  $('continue-interview').addEventListener('click',async()=>{
    if(!beforeInterview||stepIndex!==steps.length-1||deviceSwitching||!ctx.started)return;
    $('continue-interview').disabled=true;
    try{
      await awaitVisibleCamera(controller.video,controller.stream,{isCurrent:current});
      assertMicrophoneReady(controller.stream,engine.audioContext);
      if(!current())return;
      if(!verifiedCapture||verifiedCapture.engine!==controller.engine||verifiedCapture.stream!==controller.stream||verifiedCapture.camera!==controller.stream.getVideoTracks()[0]||verifiedCapture.microphone!==controller.stream.getAudioTracks()[0])throw new Error('Your devices changed. Repeat the device check before your interview.');
      onReady({...verifiedCapture,exercisesAttempted:true});
    }catch(error){if(current()){$('step-state').textContent=error.message;evaluate();}}
  });
  function enterStep() {
    ctx.smileBase=latest?.headFace?.smileEvents??0;ctx.nodBase=latest?.headFace?.nods??0;ctx.gestureBase=latest?.bodyHands?.gestures??0;
    ctx.pauseStartedAt=null;ctx.pauseLastAt=null;ctx.pauseMs=0;ctx.paceHeld=false;
    if(steps[stepIndex].id==='neutral'){ctx.neutralMs=0;engine?.beginFaceBaseline();}
    renderSteps();evaluate();
  }
  $('next-step').addEventListener('click',()=>{
    if(deviceSwitching)return;
    const step=steps[stepIndex];
    if(step.id==='seal'){
      try{
        state.calibration=engine.sealCalibration(resolved);commit();
        renderCalibrationRecord();
        $('step-state').textContent='Personal calibration saved for this account and device profile.';
        $('next-step').disabled=true;
        if(returnToMock)$('return-setup').textContent='Calibration saved · return to interview setup ▸';
      }catch(error){$('step-state').textContent=error.message+' Continue reading or speaking naturally while these instruments respond, then try again.';}
      return;
    }
    if(step.id==='neutral')engine?.endFaceBaseline();
    stepIndex=Math.min(steps.length-1,stepIndex+1);enterStep();
  });
  $('skip-step').addEventListener('click',()=>{
    if(deviceSwitching)return;
    const step=steps[stepIndex];if(step.id==='seal'||!ctx.started)return;
    step.skipped=true;for(const key of step.resolves)if(!resolved[key])resolved[key]='not';
    if(step.id==='neutral')engine?.endFaceBaseline();
    stepIndex=Math.min(steps.length-1,stepIndex+1);enterStep();
  });
  renderSteps(); evaluate();
  // Keep capture only. Rehearsal evidence is abandoned before a recording begins.
  return ()=>{disposed=true;deviceReadiness.dispose();disposeDevices?.();disposePrimary?.();clearInterval(timer);engine?.events.removeEventListener('frame',frameListener);engine?.abandonPreview();recorder.destroy();};
}
