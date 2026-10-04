// Fable composition consumes the current native engine; it never drives a scripted speech loop.
import { state, uid, commit } from './state.mjs';
import { loadQuestions } from './questions.mjs';
import { controller } from './controller/session-controller.mjs';
import { conductorConfig, toWizard, defaultSettings, resolveMockQuestionTarget } from './settings/interviewer.mjs';
import { liveContext } from './adapters/context-adapter.mjs';
import { awaitVisibleCamera,assertMicrophoneReady } from './adapters/media-readiness.mjs';
import {mountDeviceControls,deviceControlsMarkup} from './adapters/device-controls.mjs';
import {selectedEnvironment,environmentProfile,environmentControlsMarkup,mountEnvironmentProfile} from './adapters/environment-profile.mjs';
import {bindPrimaryRecovery} from './adapters/engine-adapter.mjs';
import {saveOwnVisibility} from './adapters/own-presentation.mjs';
import {overlayLayers,liveOverlayVisibility} from './adapters/overlay-view-model.mjs';
import { NativeInterviewObserver } from './brain/native-observer.mjs';
import {applyNativeObservationMarks} from './model/native-observation-marks.mjs';
import { substantiveQuestionPlan } from '../../capabilities/interview-progression.mjs';
import { leftRailMarkup, rightRailMarkup, RailsController } from './instruments/rails.mjs';
import { recorderMarkup, LiveRecorder } from './instruments/flight-recorder.mjs';
import { TraceHistory } from './model/trace-reducer.mjs';
import { deriveDebrief, hookLedger, closingLedger } from './model/teaching.mjs';
const esc = s => String(s ?? '').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = s => String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0');
export async function mountRoom(main,{session,isCurrent=()=>true}) {
  const account=controller.account,durable=controller.durable,subject=account?.subject;
  const scopeCurrent=()=>isCurrent()&&controller.account===account&&controller.durable===durable&&controller.account?.subject===subject;
  const {questions}=await loadQuestions({account}); if(!scopeCurrent())return ()=>{};
  const mode=session.mode==='mock'?'mock':'practice';
  const practiceQ=questions.find(q=>q.question_id===session.questionId)||questions[0];
  const plan=substantiveQuestionPlan(mode==='mock'?(session.mockSet||questions.filter(q=>q.core_priority).slice(0,5)):[practiceQ]);
  if(!plan.length)throw new Error('Choose at least one current interview question.');
  const cfg=session.config||{};
  const targetQuestions=mode==='mock'?resolveMockQuestionTarget(cfg.targetQuestions,plan.length,{goal:session.retry?.wizard?.goal||session.settings?.goal}):1;
  const settings={...(session.settings||defaultSettings()),targetQuestions};
  const profile=environmentProfile(selectedEnvironment(settings,session.retry));
  let density=mode==='mock'&&!state.preferences?.densityPersisted?'interview':(state.preferences?.density||'coached');
  let initialPresentationMode=null;
  let overlaysVisible=state.preferences?.overlaysVisible===true;
  let layers=overlayLayers(state.preferences?.overlayLayers);
  let disposed=false,starting=false,started=false,saving=false,finished=false,engine=null,interviewer=null,saveRecord=null,deviceSwitching=false;
  main.innerHTML = `
  <div class="room" id="room" data-density="${density}" data-mode="${mode}">
    <div class="room-strip">
      <button class="exit" type="button" id="exit" aria-label="Leave the room">‹ Leave</button>
      <div class="plan" id="plan" aria-label="Question plan"></div>
      <div class="room-status">
        <div class="density" role="group" aria-label="Analytics density"><button type="button" data-density="interview" aria-pressed="${density === 'interview'}">Interview only</button><button type="button" data-density="coached" aria-pressed="${density === 'coached'}">Coached</button></div>
        <span class="rec" id="rec" data-state="ready"><i></i><span id="rec-text">READY</span></span>
        <span class="clock" id="clock">00:00</span>
      </div>
    </div>
    <aside class="rail" id="rail-left" aria-label="Teaching rail">${leftRailMarkup()}</aside>
    <div class="stage-col">
      ${environmentControlsMarkup(profile,{mode})}
      <div class="meeting-stage">
      <section class="presence" id="presence" data-speaking="false" aria-live="polite">
        <div class="orb" aria-hidden="true">${mode === 'mock' ? 'PD' : 'Q'}</div>
        <div class="who"><strong id="presence-name">${mode === 'mock' ? `${esc(settings.style || 'Owl')} · ${esc(settings.role || 'Program Director')}` : 'Practice rep'}</strong><span id="presence-sub">${mode === 'mock' ? 'Starts only when you choose Start Interview' : 'Your private answer recording'}</span></div>
        <div class="presence-tag"><span class="wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span class="t-tech" id="presence-state">waiting</span></div>
        <div class="line" id="presence-line">${mode === 'mock' ? 'The interviewer will begin when you are ready.' : esc(practiceQ.canonical_text)}</div>
      </section>
      <div class="stage" id="stage" data-guides="${overlaysVisible}" data-idle="false">
        <canvas id="overlay"></canvas>
        <div class="frame-guide" aria-hidden="true"></div>
        <span class="tag" id="stage-tag"><i></i>You</span>
        <p class="self-view-hidden" hidden>Self view hidden · your camera, recording, and enabled measurements continue.</p>
        <div class="captions" id="captions" hidden><span></span></div>
        <div class="controls" id="controls">
          <button class="ctl-icon" type="button" id="guides" aria-pressed="${overlaysVisible}" aria-label="Show tracking overlays" title="Show tracking overlays">⌖</button>
          <button class="btn btn-primary" type="button" id="primary-action">Start answer</button>
          <button class="btn btn-quiet" type="button" id="end">Finish &amp; save</button>
        </div>
        <div class="stage-enter" id="enter">
          <div>
            <div class="t-kick gold">${mode === 'mock' ? 'Mock interview' : 'Practice rep'} · ${targetQuestions} question${targetQuestions > 1 ? 's' : ''}${mode === 'mock' && targetQuestions !== plan.length ? ` · ${plan.length} selected` : ''}</div>
            <h2 class="t-h2" style="margin:8px 0 6px">${mode === 'mock' ? 'Ready for your interview?' : 'Ready for your answer?'}</h2>
            <p>${mode === 'mock' ? `Priority: ${esc(session.priority || 'leave one natural hook the interviewer can follow')}.` : `Priority: ${esc(session.priority || 'finish the answer in under 90 seconds')}.`} Connect your camera and microphone. Check your visible preview, then start when you are ready.</p>
            <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:16px"><button class="btn btn-primary btn-lg" type="button" id="connect-real">Connect camera + mic</button><button class="btn btn-primary btn-lg" type="button" id="start-session" disabled>${mode === 'mock' ? 'Start Interview' : 'Start recorded answer'} ▸</button></div>
          </div>
        </div>
      </div>
      </div>
      <p class="note readiness-status" id="enter-note" role="status" aria-live="polite"></p>
      ${profile.simulated?'<div class="environment-controls" data-environment-controls></div>':''}
      <div class="under-stage" id="under-stage"><span id="engine-label">Nothing is measured yet.</span><button class="transcript-toggle" type="button" id="transcript-toggle" aria-expanded="false">Transcript</button></div>
      <div class="note" id="primary-recovery" role="status" aria-live="polite" hidden><span data-primary-status></span> <button class="btn btn-quiet" type="button" data-reselect-primary>Lock to me</button></div>
      <p class="note" id="room-preference-note" role="status" hidden></p>
      <details class="expert"><summary>Display options</summary><button class="btn btn-quiet" type="button" id="reset-density">Use default analytics view</button><p class="note">Choose overlay layers below. Use the tracking-overlays button on your video to show or hide them. Measurement continues while overlays are hidden.</p><div class="review-actions" id="overlay-layers" role="group" aria-label="Tracking overlay layers">${[['face','Face'],['bodyHands','Body / hands'],['position','Framing']].map(([key,label])=>'<button class="btn btn-quiet" type="button" data-overlay-layer="'+key+'" aria-pressed="'+layers[key]+'">'+label+'</button>').join('')}</div></details>
    <div class="transcript" id="transcript" hidden></div>
    <details class="expert" data-room-devices open><summary>Devices</summary>${deviceControlsMarkup()}</details>

    </div>
    <aside class="rail" id="rail-right" aria-label="Voice rail">${rightRailMarkup()}</aside>
    <section class="recorder" id="recorder" data-mode="live">${recorderMarkup({ mode: 'live' })}</section>
  </div>`;

  const $=id=>main.querySelector('#'+id),room=$('room'),rails=new RailsController(main);
  const recorder=new LiveRecorder($('recorder'),{window:'1M'}),history=new TraceHistory(),events=[],turns=[];let captions=[];
  let timer=null,idleTimer=null,roomFault=null,lastCueId=null,disposeDevices=null,disposePrimary=null;
  const counts={smiles:0,nods:0,gestures:0};
  const current=()=>!disposed&&scopeCurrent();
  const disposeEnvironment=mountEnvironmentProfile(room,{profile,isCurrent:current,isLive:()=>started&&!saving&&!finished,interviewerRole:settings.role});
  function applyOverlays(){
    if(!current())return;
    $('guides').setAttribute('aria-pressed',String(overlaysVisible));
    $('stage').dataset.guides=String(overlaysVisible&&layers.position);
    $('overlay-layers').querySelectorAll('[data-overlay-layer]').forEach(button=>button.setAttribute('aria-pressed',String(layers[button.dataset.overlayLayer])));
    engine?.setOverlayVisibility(liveOverlayVisibility({overlaysVisible,overlayLayers:layers}));
  }
  function saveVisibility(patch){
    if(!current())return;
    $('room-preference-note').hidden=false;$('room-preference-note').textContent='Saving display preference…';
    Promise.resolve().then(()=>current()?saveOwnVisibility(controller,patch,{isCurrent:current}):null).then(saved=>{if(current()&&saved){state.preferences.densityPersisted=saved.densityPersisted===true;commit();$('room-preference-note').textContent='Display preference saved to your account.';}}).catch(()=>{
      if(!current())return;$('room-preference-note').hidden=false;$('room-preference-note').textContent='Your display changed, but the account preference could not be saved. Try the control again.';
    });
  }
  const observer=mode==='mock'?new NativeInterviewObserver({questions:plan,config:conductorConfig(settings,{durationMin:cfg.durationMin,interviewPolicy:controller.interviewPolicy}),context:{specialty:session.program?.specialty||null},now:()=>controller.elapsed*1000}):null;
  const at=()=>controller.elapsed;
  const mark=(kind,label)=>events.push({t:at(),kind,label});
  function setDensityControls(disabled){room.querySelectorAll('.density [data-density]').forEach(button=>{button.disabled=disabled;});$('reset-density').disabled=disabled;}
  function recordDensity(){if(started&&!saving&&!finished)events.push({t:at(),kind:'presentation',label:density==='interview'?'Interview only':'Coached',state:density});}
  function renderTranscript(){ const rows=captions.length?captions:turns;$('transcript').innerHTML=rows.map(t=>'<div class="turn '+t.speaker+'"><b>'+(t.speaker==='interviewer'?'Interviewer':'You')+'</b><span>'+esc(t.text)+'</span></div>').join('')||'<p class="note">The conversation appears here as you speak.</p>';if(captions.length)$('transcript').insertAdjacentHTML('beforeend','<p class="note">Live captions use approximate fragment timing, not confirmed turn boundaries. Recording is authoritative for what was heard.</p>'); }
  function addTurn(speaker,text,event={}) {
    if(!current()||finished||saving||!text)return;
    const before=observer?.snapshot();
    turns.push({speaker,text,t:at(),identity:event.identity||null,timingBasis:'MESSAGE_RECEIPT',state:before?.state||'PRACTICE',n:before?.n||1});
    observer?.ingestFinal({speaker,text,identity:event.identity||null,sessionId:controller.durable.accountSession?.id||null});
    markObservations(before,speaker);
    renderTranscript();renderPlan();
  }
  function markObservations(before,speaker){
    const snap=observer?.snapshot();
    applyNativeObservationMarks(events,before,snap,speaker,at());
  }
  const callbacks={
    onLine(text){if(!current()||saving)return;$('presence-line').textContent=text;},
    onSpeaking(on){if(!current()||saving)return;$('presence').dataset.speaking=String(on);$('presence-state').textContent=on?'speaking':'listening';},
    onFinal(text,directive,event){addTurn('interviewer',text,event);},
    onApplicantFinal(text,event){addTurn('applicant',text,event);},
    onTranscriptFragment(event){if(!current()||finished||saving||!observer)return;const before=observer.snapshot();if(observer.ingestFragment(event)){markObservations(before,event.type==='session.input_transcript.delta'?'applicant':'interviewer');renderPlan();}},
    onTranscriptOverlap(observation){
      if(!current()||!started||!controller.durableActive||controller.recordingOrigin==null||finished||saving)return;
      if(observation.invalidated){for(let i=events.length-1;i>=0;i--)if(events[i].kind==='overlap')events.splice(i,1);return;}
      if(!Number.isSafeInteger(observation.count)||observation.count<1||observation.count>128)return;
      const t=at();if(!Number.isFinite(t)||t<0)return;
      for(let i=0;i<observation.count;i++)events.push({t,kind:'overlap',label:'Transcript overlap observed — interruption unverified.',state:'MESSAGE_RECEIPT'});
    },
    onCaptions(groups){if(!current()||saving)return;captions=groups;renderTranscript();},
    onStatus(status){if(!current()||saving)return;if(status.state==='active')$('presence-sub').textContent='Your interviewer is listening';if(status.state==='closed'&&started)providerFailed();},
    onProviderFailed:providerFailed,
    onDeviceFailure(message){if(!current()||saving||finished)return;roomFault={message:'Device change interrupted',detail:message};$('room-preference-note').hidden=false;$('room-preference-note').textContent=message;mark('gap',message);}
  };
  function providerFailed(){if(!current()||!started||saving)return;roomFault={message:'Interviewer disconnected',detail:'Finish and save what you recorded, then start another interview.'};$('presence-sub').textContent=roomFault.detail;mark('gap','Interviewer disconnected');}
  function renderPlan(){
    if(!observer){$('plan').innerHTML='<span class="label"><b>Practice</b> · '+esc(practiceQ.canonical_text.slice(0,60))+'</span>';return;}
    const snap=observer.snapshot(),phase=snap.state==='CLOSING_INVITE'?'Wrapping up':started&&snap.finalObservationCount===0&&snap.fragmentTextObservationCount===0?snap.N+' questions planned':snap.state==='FOLLOWUP'?'Follow-up · hook followed':snap.state==='CANDIDATE_QUESTIONS'?'Your questions':snap.state==='PROFESSIONAL_CLOSE'?'Sign-off · finish when ready':'Question '+snap.n+' of '+snap.N;
    $('plan').innerHTML='<span class="seg">'+snap.plan.map(q=>'<span class="pip '+(q.status==='ASKED'?'asked':q.status==='CURRENT'?'current':'')+'" title="Q'+q.n+' · '+esc(q.text)+'"></span>').join('')+'<span class="pip closing '+(snap.closing.reached?'asked':'')+'" title="Your questions"></span></span><span class="label"><b>'+phase+'</b></span>';
  }
  async function connect(){
    if(!current()||starting||started||deviceSwitching)return;starting=true;$('connect-real').disabled=true;
    $('stage').dataset.previewReady='false';$('start-session').disabled=true;
    setDensityControls(true);
    $('enter-note').textContent='Connecting your camera and microphone…';
    try{
      controller.mountVideo($('stage'),$('overlay'));
      engine=await controller.acquire({mode:'real',overlayCanvas:$('overlay')});
      if(!current())return;
      disposePrimary?.();disposePrimary=bindPrimaryRecovery($('primary-recovery'),{engine,isCurrent:current});
      const video=controller.mountVideo($('stage'),$('overlay'));
      // Selection must remain available when the acquired camera renders black.
      // The same capture owner switches devices; no second stream or readiness bypass.
      disposeDevices?.();disposeDevices=await mountDeviceControls(main.querySelector('[data-device-controls]'),{engine,video,getStream:()=>controller.stream,isCurrent:current,canSwitch:kind=>!starting&&!saving&&!finished&&(controller.phase==='READY'||(controller.phase==='LIVE'&&controller.canSwitchDevice(kind))),switchDevice:(kind,id)=>controller.switchDevice(kind,id),onSwitching:(value,ready)=>{
        if(!current())return;
        if(started){deviceSwitching=value;$('room-preference-note').hidden=false;$('room-preference-note').textContent=value?'Changing your device. Finish & save remains available.':ready?'Device changed. This recording continues; recalibrate before your next attempt.':'Device change was not confirmed. Check the message in Devices.';if(!value&&ready){mark('gap','Device changed; personal calibration reset');applyOverlays();}return;}
        deviceSwitching=value;$('start-session').disabled=value||!ready;$('connect-real').disabled=value;
        $('stage').dataset.previewReady=String(!value&&ready);
        $('enter-note').textContent=value?'Checking your selected camera and microphone…':ready?'Preview visible · microphone connected. Nothing is recorded until you start.':'The selected devices are not ready. Check the message below, choose another device, or check the preview again.';
        if(!value&&ready){$('connect-real').textContent='Check preview again';applyOverlays();}
      },onReadinessChanged:readiness=>{
        if(!current()||starting||saving||finished)return;
        if(started){$('room-preference-note').hidden=false;$('room-preference-note').textContent=readiness.message;return;}
        $('start-session').disabled=true;$('stage').dataset.previewReady='false';
        $('enter-note').textContent=readiness.message;$('connect-real').disabled=false;
      },onChanged:()=>{state.calibration=null;commit();}});
      if(!current()){disposeDevices?.();return;}
      await awaitVisibleCamera(video,controller.stream,{isCurrent:current});
      if(!current())return;
      assertMicrophoneReady(controller.stream,engine.audioContext);
      $('stage').dataset.previewReady='true';
      $('start-session').disabled=false;$('enter-note').textContent='Preview visible · microphone connected. Nothing is recorded until you start.';
      $('connect-real').textContent='Check preview again';applyOverlays();
    }catch(error){if(current()){$('enter-note').textContent=error.message;$('start-session').disabled=true;}}
    finally{starting=false;if(current()){setDensityControls(false);$('connect-real').disabled=false;main.querySelectorAll('[data-device-kind]').forEach(select=>{select.disabled=controller.phase!=='READY'||!select.options.length;});}}
  }
  const onFrame=e=>{
    if(!started||saving||disposed)return;
    const f=roomFault?{...e.detail,fault:roomFault}:e.detail;
    rails.ingest(f);history.push(f);
    for(const [field,value,kind,label]of [['smiles',f.headFace?.smileEvents,'smile','Smile pattern'],['nods',f.headFace?.nods,'nod','Head nod'],['gestures',f.bodyHands?.gestures,'gesture','Gesture unit']]){
      if(Number.isFinite(value)&&value>counts[field]){counts[field]=value;events.push({t:f.t,kind,label,state:f.state});}
    }
    if(f.cue&&f.cue.id!==lastCueId){lastCueId=f.cue.id;events.push({t:f.t,kind:'cue',label:f.cue.message,state:f.state});}
    if(!f.cue)lastCueId=null;
    if(f.speaking)$('presence-state').textContent='listening to you';
  };
  const onState=e=>{if(!started||saving||disposed)return;const d=e.detail||{};if(['partial','recovering','unavailable'].includes(d.state)){roomFault={message:d.subsystem==='audio'?'Check microphone':'Check camera',detail:d.message||''};mark('gap',d.subsystem||'Signal unavailable');}else if(['recovered','running'].includes(d.state))roomFault=null;};
  const onWord=e=>{if(current()&&e.detail?.state==='unavailable')$('pace-basis').textContent='Timed-word pace unavailable';};
  async function start(){
    if(!current()||starting||started||deviceSwitching)return;starting=true;$('start-session').disabled=true;$('connect-real').disabled=true;
    initialPresentationMode=density==='interview'?'interview':'coached';setDensityControls(true);
    main.querySelectorAll('[data-device-kind]').forEach(select=>{select.disabled=true;});
    $('enter-note').textContent='Preparing your private recording…';
    try{
      await awaitVisibleCamera(controller.video,controller.stream,{isCurrent:current});
      assertMicrophoneReady(controller.stream,engine.audioContext);
      const wizard=toWizard(settings,{program:session.program,mode,contextSources:session.contextSources||[],retry:session.retry||null,priority:session.priority,interviewPolicy:controller.interviewPolicy});
      const context=mode==='mock'?await liveContext({wizard,interviewSet:plan,targetQuestions}):null;
      if(!current())return;
      observer?.start(); // before provider callbacks; native start owns the sole opening question
      engine.events.addEventListener('frame',onFrame);engine.events.addEventListener('state',onState);engine.events.addEventListener('word-timing',onWord);
      const result=await controller.startSession({mode,question:plan[0],interviewSet:plan,wizard,targetQuestions,openingQuestion:plan[0].canonical_text,context,voice:settings.voice||'marin',...callbacks});
      if(!current())return;
      interviewer=result.interviewer;started=true;$('enter').remove();$('enter-note').hidden=true;$('rec').dataset.state='recording';$('rec-text').textContent='REC';
      main.querySelector('[data-room-devices]').open=false;
      $('primary-action').hidden=true;$('engine-label').textContent='Recording privately to your account';$('end').disabled=false;
      $('presence-sub').textContent=mode==='mock'?'Speak naturally. Your interviewer can hear you.':'Answer the question. Finish & save when you are done.';
      mark('recording','Recording started');mark('question','Q1 planned');recordDensity();renderPlan();
      timer=setInterval(()=>{if(!current())return;$('clock').textContent=fmt(at());recorder.setData(history.samples,events);recorder.tick(at());},500);resetIdle();
    }catch(error){if(current()){$('stage').dataset.previewReady='false';$('enter-note').textContent=error.message;
      if(error.code==='ivoc_interview_policy_changed'){const back=document.createElement('a');back.href='#/mock';back.textContent=' Return to interview setup';$('enter-note').append(back);}
      $('start-session').disabled=true;$('connect-real').disabled=false;}engine?.events.removeEventListener('frame',onFrame);engine?.events.removeEventListener('state',onState);engine?.events.removeEventListener('word-timing',onWord);}
    finally{starting=false;if(current()){setDensityControls(false);disposeEnvironment.refresh();await disposeDevices?.refresh?.().catch(()=>{});}}
  }
  $('connect-real').addEventListener('click',()=>void connect());$('start-session').addEventListener('click',()=>void start());
  $('end').disabled=true;$('primary-action').hidden=true;
  $('exit').addEventListener('click',()=>{if(controller.phase==='SAVE_FAILED'){openSaveFailureSheet();return;}if(started&&!finished){if(!saving)openEndSheet();return;}void controller.release('left_before_start');location.hash=mode==='mock'?'#/mock':'#/practice';});
  $('end').addEventListener('click',()=>{if(controller.phase==='SAVE_FAILED'){if(controller.lastSave?.retryable)void retrySave();else openSaveFailureSheet();return;}if(mode==='mock')openEndSheet();else void finishSession('finished');});
  function openSaveFailureSheet(){
    if(saving||document.querySelector('.sheet-backdrop'))return;
    const sheet=document.createElement('div');sheet.className='sheet-backdrop';
    sheet.innerHTML='<div class="housing sheet" role="dialog" aria-modal="true"><h3 class="t-h3">This attempt is not saved</h3><p>'+esc(controller.lastSave?.error||'Saving failed.')+'</p><p>Leaving abandons this unsaved attempt. It will not appear as a completed recording.</p><div class="row"><button type="button" class="btn btn-secondary" id="stay-failed">Stay here</button><button type="button" class="btn btn-quiet" id="leave-failed">Leave without saving</button></div></div>';
    document.body.append(sheet);sheet.querySelector('#stay-failed').onclick=()=>sheet.remove();
    sheet.querySelector('#leave-failed').onclick=async()=>{sheet.querySelector('#leave-failed').disabled=true;await controller.release('user_abandoned_failed_save');finished=true;sheet.remove();location.hash='#/review';};
  }
  function openEndSheet(){
    if(saving||disposed||document.querySelector('.sheet-backdrop'))return;
    const closingReached=observer?.closing.reached;
    const sheet=document.createElement('div');sheet.className='sheet-backdrop';
    sheet.innerHTML='<div class="housing sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><h3 class="t-h3" id="sheet-title">Finish your interview</h3><p>'+(closingReached?'Your closing conversation is still recorded. Save whenever you are ready.':'Wrap up invites your questions before you finish. Finish now saves the conversation exactly as it happened.')+'</p><div class="row">'+(!closingReached?'<button class="btn btn-primary" id="wrap" type="button">Ask my closing questions</button>':'')+'<button class="btn '+(closingReached?'btn-primary':'btn-secondary')+'" id="leave" type="button">Finish &amp; save</button><button class="btn btn-quiet" id="stay" type="button">Keep interviewing</button></div></div>';
    document.body.append(sheet);sheet.querySelector('button').focus();
    sheet.querySelector('#stay').onclick=()=>sheet.remove();
    sheet.querySelector('#wrap')?.addEventListener('click',()=>{sheet.remove();const d=observer.requestEnd('wrap');if(d){mark('closing','Closing requested');void interviewer?.execute(d);}renderPlan();});
    sheet.querySelector('#leave').onclick=()=>{sheet.remove();if(!closingReached)observer.requestEnd('leave');void finishSession('finished');};
    sheet.onkeydown=e=>{if(e.key==='Escape'){sheet.remove();return;}if(e.key!=='Tab')return;const b=[...sheet.querySelectorAll('button')],first=b[0],last=b.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}};
  }
  room.querySelector('.density').addEventListener('click',e=>{if(!current()||starting||saving||finished)return;const b=e.target.closest('[data-density]');if(!b||!['interview','coached'].includes(b.dataset.density))return;density=b.dataset.density;room.dataset.density=density;room.querySelectorAll('[data-density]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));recordDensity();state.preferences.density=density;commit();saveVisibility({density});});
  $('reset-density').addEventListener('click',()=>{if(!current()||starting||saving||finished)return;density=mode==='mock'?'interview':'coached';room.dataset.density=density;room.querySelectorAll('.density [data-density]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.density===density)));recordDensity();state.preferences.density='coached';state.preferences.densityPersisted=false;commit();saveVisibility({density:'default'});});
  $('guides').addEventListener('click',()=>{if(!current())return;overlaysVisible=!overlaysVisible;applyOverlays();state.preferences.overlaysVisible=overlaysVisible;commit();saveVisibility({overlaysVisible});});
  $('overlay-layers').addEventListener('click',event=>{if(!current())return;const button=event.target.closest('[data-overlay-layer]');if(!button)return;const key=button.dataset.overlayLayer;if(!Object.hasOwn(layers,key))return;layers={...layers,[key]:!layers[key]};applyOverlays();state.preferences.overlayLayers=layers;commit();saveVisibility({overlayLayers:{[key]:layers[key]}});});
  $('transcript-toggle').addEventListener('click',e=>{$('transcript').hidden=!$('transcript').hidden;e.currentTarget.setAttribute('aria-expanded',String(!$('transcript').hidden));});
  function resetIdle(){if(disposed)return;$('stage').dataset.idle='false';clearTimeout(idleTimer);idleTimer=setTimeout(()=>{if(current())$('stage').dataset.idle='true';},4000);}
  $('stage').addEventListener('mousemove',resetIdle);$('stage').addEventListener('keydown',resetIdle);
  function detach(){clearInterval(timer);clearTimeout(idleTimer);engine?.events.removeEventListener('frame',onFrame);engine?.events.removeEventListener('state',onState);engine?.events.removeEventListener('word-timing',onWord);}
  function showSaved(saved){if(!current())return;finished=true;$('rec').dataset.state='saved';$('rec-text').textContent='SAVED';location.hash='#/results/'+saved.id;}
  function showSaveFailure(message){
    if(!current())return;saving=false;$('rec').dataset.state='error';$('rec-text').textContent='SAVE FAILED';
    const retryable=controller.lastSave?.retryable===true;
    $('presence-sub').textContent=retryable?'Your recording and measured evidence are retained for retry. Do not close this page.':'Measured evidence could not be sealed. This attempt is not accepted as saved.';
    $('engine-label').textContent=message;$('end').textContent=retryable?'Retry save':'Review save failure';$('end').disabled=false;
  }
  async function retrySave(){if(saving)return;saving=true;$('end').disabled=true;const saved=await controller.retrySave();if(saved)showSaved(saved);else showSaveFailure(controller.lastSave?.error||'Save is still unavailable.');}
  async function finishSession(reason){
    if(saving||finished||!started)return;saving=true;disposeEnvironment.refresh();detach();$('end').disabled=true;
    $('rec').dataset.state='saving';$('rec-text').textContent='SAVING';mark('recording','Recording stopped');
    const samples=history.slice(),snap=observer?.snapshot()||null,debrief=deriveDebrief({samples,events,turns});
    saveRecord={id:uid('att'),at:Date.now(),mode,fixture:false,engineMode:'real',transport:mode==='mock'?'gpt-live':'none',questionId:plan[0].question_id,questionText:plan[0].canonical_text,durationS:at(),samples,events,turns,conductor:snap,hooks:hookLedger(snap),closing:closingLedger(snap),debriefLane:debrief.change[0]?.lane||null,priorityLane:debrief.change[0]?.lane||null,priorityText:debrief.change[0]?.text||null,retryOf:session.retryOf||null,calibrationUsed:Boolean(engine.personalCalibration),program:session.program?{id:session.program.id,name:session.program.name,verified:session.program.verified}:null,endReason:reason,settings:{...settings,initialPresentationMode}};
    try{const saved=await controller.finishSession({record:saveRecord});if(saved.saveError)showSaveFailure(saved.saveError);else showSaved(saved);}catch(error){showSaveFailure(error.message);}
  }
  applyOverlays();renderPlan();renderTranscript();
  return ()=>{disposed=true;disposeEnvironment();disposeDevices?.();disposePrimary?.();detach();recorder.destroy();document.querySelector('.sheet-backdrop')?.remove();if(!finished&&!controller.navigationLocked)void controller.release('route_change');};
}
