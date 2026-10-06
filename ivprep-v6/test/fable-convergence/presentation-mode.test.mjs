import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {sealDerivedEvidence} from '../../public/studio-fable/app/adapters/derived-evidence.mjs';
import {projectSavedAttempt} from '../../public/studio-fable/app/adapters/saved-review.mjs';
import {toWizard,defaultSettings,resolveMockQuestionTarget,selectedAdminVoice} from '../../public/studio-fable/app/settings/interviewer.mjs';
import {assertMicrophoneReady} from '../../public/studio-fable/app/adapters/media-readiness.mjs';
import {environmentProfile,selectedEnvironment} from '../../public/studio-fable/app/adapters/environment-profile.mjs';

const source=readFileSync(new URL('../../public/studio-fable/app/room.mjs',import.meta.url),'utf8');
const section=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)));
function roomFixture(density,{mode='practice',target=null,goal='Guided Mock IV Practice',focus='',priority=null,interviewPolicy=null,role='student',voice='marin'}={}){
  const handlers=new Map();
  const elements=new Map(),buttons=['interview','coached'].map(value=>({dataset:{density:value},disabled:false,setAttribute(){}}));
  const element=id=>{if(!elements.has(id))elements.set(id,{dataset:{},hidden:false,disabled:false,textContent:'',value:'',remove(){},setAttribute(){},addEventListener(type,fn){handlers.set(id+':'+type,fn);}});return elements.get(id);};
  const room=element('room');room.querySelectorAll=()=>buttons;
  const handler={};room.querySelector=()=>({addEventListener:(_type,fn)=>{handler.density=fn;}});
  element('reset-density').addEventListener=(_type,fn)=>{handler.reset=fn;};
  const events=[],samples=[{t:1,vol:4,signalGap:false}];let filed=null,resolveCamera,launched=null,contextInput=null;
  const plan=[{question_id:'CORE-01',canonical_text:'Tell me about yourself.'}];
  const setup=vm.runInNewContext(section('  const cfg=session.config||{};',"  let density=" )+'\n({settings,targetQuestions})',{session:{config:{targetQuestions:target},settings:{...defaultSettings(),goal,practiceFocus:focus,pressure:true,voice}},mode,plan,defaultSettings,resolveMockQuestionTarget,environmentProfile,selectedEnvironment});
  const {settings,targetQuestions}=setup;
  const camera=new Promise(resolve=>{resolveCamera=resolve;});
  const context={density,initialPresentationMode:null,avatarCanary:null,practiceQ:plan[0],starting:false,started:false,saving:false,finished:false,disposed:false,deviceSwitching:false,
    current:()=>true,account:{mode:'REAL',role},selectedAdminVoice,$:element,room,main:{querySelectorAll:()=>[],querySelector:()=>({remove(){}})},
    controller:{video:{},stream:{getAudioTracks:()=>[{readyState:'live',enabled:true,muted:false}]},elapsed:2,interviewPolicy,startSession:async input=>{launched=input;return{interviewer:{}};},finishSession:async({record})=>{filed=record;return{saveError:'retry retained'};}},
    engine:{audioContext:{state:'running'},events:{addEventListener(){},removeEventListener(){}},personalCalibration:null},settings,session:{priority},mode,targetQuestions,plan,
    awaitVisibleCamera:()=>camera,assertMicrophoneReady,toWizard,liveContext:async input=>{contextInput=input;return{};},observer:null,callbacks:{},onFrame(){},onState(){},onWord(){},
    mark:(kind,label)=>events.push({t:2,kind,label}),events,turns:[],saveRecord:null,at:()=>2,renderPlan(){},recorder:{setData(){},tick(){}},history:{slice:()=>samples},
    timer:null,setInterval:()=>1,resetIdle(){},disposeDevices:null,disposeEnvironment:{refresh(){}},state:{preferences:{}},commit(){},saveVisibility(){},
    detach(){},deriveDebrief:()=>({change:[]}),hookLedger:()=>[],closingLedger:()=>null,uid:()=> 'attempt',showSaveFailure(){},showSaved(){},
  };
  const helperStart=source.indexOf('  function setDensityControls(');
  const helpers=helperStart<0?'':source.slice(helperStart,source.indexOf('  function renderTranscript()',helperStart));
  vm.createContext(context);
  vm.runInContext(helpers+section('  function restoreReadinessPresence(){','  async function start(){')+section('  async function start(){',"  $('connect-real').addEventListener")+section("  room.querySelector('.density').addEventListener", "  $('guides').addEventListener")+section('  async function finishSession(reason){','  applyOverlays();renderPlan();renderTranscript();')+';this.start=start;this.finish=finishSession;',context);
  return {context,buttons,events,samples,settings,releaseCamera:()=>resolveCamera(),start:()=>context.start(),finish:()=>context.finish('finished'),
    select:value=>handler.density({target:{closest:()=>buttons.find(b=>b.dataset.density===value)}}),reset:()=>handler.reset(),filed:()=>filed,launched:()=>launched,contextInput:()=>contextInput,
    chooseVoice(value){const select=element('admin-live-voice');select.value=value;handlers.get('admin-live-voice:change')({target:select});},voiceElement:()=>element('admin-live-voice')};
}
test('actual Room passes the chosen goal and displayed or edited Guided priority into the same Start contract',async()=>{
  for(const goal of ['Full IV Simulation','Guided Mock IV Practice','Individual Question']){
    for(const focus of ['', 'name my contribution']){
      const f=roomFixture('interview',{mode:'mock',target:12,goal,focus,priority:'finish the example'}),pending=f.start();f.releaseCamera();await pending;
      const launched=f.launched();assert.equal(launched.wizard.goal,goal);
      assert.equal(launched.targetQuestions,goal==='Individual Question'?1:12);
      assert.equal(launched.wizard.pressurePractice,goal!=='Individual Question');
      assert.equal(f.contextInput().wizard,launched.wizard);
      if(goal==='Guided Mock IV Practice')assert.ok(launched.wizard.focus.includes(focus||'finish the example'));
      else assert.equal(launched.wizard.focus,undefined);
    }
  }
});
test('actual Room resolves and pins Mock target through context, Start and sealed saved settings',async()=>{
  for(const target of [null,1,12,30]){
    const f=roomFixture('interview',{mode:'mock',target}),pending=f.start();f.releaseCamera();await pending;
    const expected=target??1;
    assert.equal(f.context.started,true);assert.equal(f.contextInput().targetQuestions,expected);assert.equal(f.launched().targetQuestions,expected);
    assert.equal(f.launched().interviewSet.length,1);assert.equal(f.launched().interviewSet[0].question_id,'CORE-01');
    await f.finish();assert.equal(sealDerivedEvidence(f.filed()).settings.targetQuestions,expected);
  }
  const practice=roomFixture('coached',{target:30}),pending=practice.start();practice.releaseCamera();await pending;
  assert.equal(practice.launched().targetQuestions,1);assert.equal(practice.contextInput(),null);
});
test('actual Room passes current bounded follow-up settings to the same native and Durable Start wizard',async()=>{
  const interviewPolicy={schema:'ivoc.interview-policy.v1',version:4,maxFollowUpsPerAnswer:0,defaultFollowUpDepth:0,defaultPressureEnabled:false};
  const f=roomFixture('interview',{mode:'mock',interviewPolicy}),pending=f.start();f.releaseCamera();await pending;
  assert.equal(f.launched().wizard.followUpDepth,0);assert.equal(f.launched().wizard.maxFollowUps,0);assert.equal(f.launched().wizard.interviewPolicyVersion,4);
  assert.equal(f.contextInput().wizard,f.launched().wizard);assert.equal(f.context.started,true);
});
test('actual Room Start files the initial display mode without changing measurement or canonical wizard inputs',async()=>{
  for(const density of ['interview','coached']){
    const f=roomFixture(density),pending=f.start();
    assert.ok(f.buttons.every(button=>button.disabled));
    f.select(density==='interview'?'coached':'interview');assert.equal(f.context.density,density);
    f.releaseCamera();await pending;assert.equal(f.context.started,true);assert.ok(f.buttons.every(button=>!button.disabled));
    f.select(density==='interview'?'coached':'interview');await f.finish();
    const saved=sealDerivedEvidence(f.filed());
    assert.equal(saved.settings.initialPresentationMode,density);
    assert.equal(saved.samples[0].vol,4);assert.equal(saved.samples[0].signalGap,false);
    assert.equal(toWizard(f.settings).analyticsEnabled,true);assert.equal(toWizard(f.settings).environment,'MissionMed');
    assert.equal(saved.events.filter(event=>event.kind==='presentation').length,2);
    const id='c7fe94c0-4ad2-4a17-81a8-db900509d966',recording={id:'r',status:'saved',durationMs:2000};
    const session={id,ownerSubject:'wp:1',state:'saved',recording};
    const projected=projectSavedAttempt({persisted:true,session,sessionDetail:{...session,results:{payload:{analytics:{fable:saved}}}}},'wp:1');
    assert.equal(projected.settings.initialPresentationMode,density);
    // A save failure retains this exact record; subsequent display changes cannot rewrite it.
    f.select(density);assert.equal(f.filed().settings.initialPresentationMode,density);
  }
});
test('only exact presentation enums are retained; old or malformed values remain unknown',()=>{
  for(const value of [undefined,null,false,'mock','practice','COACHED','interview-only']){
    const saved=sealDerivedEvidence({settings:{initialPresentationMode:value}});
    assert.equal(Object.hasOwn(saved.settings,'initialPresentationMode'),false);
  }
  for(const value of ['interview','coached'])assert.equal(sealDerivedEvidence({settings:{initialPresentationMode:value}}).settings.initialPresentationMode,value);
});

test('actual Admin preflight selector changes only native Start voice and freezes while starting/live',async()=>{
  for(const voice of ['marin','meridian','gleam','vesper','stone','willow']){
    const f=roomFixture('interview',{mode:'mock',role:'admin'});f.chooseVoice(voice);
    const pending=f.start();assert.equal(f.voiceElement().disabled,true);
    f.chooseVoice('marin');assert.equal(f.settings.voice,voice);
    f.releaseCamera();await pending;assert.equal(f.launched().voice,voice);
    assert.equal(f.voiceElement().disabled,true);f.chooseVoice('stone');assert.equal(f.settings.voice,voice);
  }
  const markup=section('  main.innerHTML = `','  const $=');
  assert.ok(markup.includes("mode==='mock'&&account?.mode==='REAL'&&account.role==='admin'?"));
  assert.ok(markup.includes('Student default remains marin'));
});
test('Student/practice/default/invalid voice remains marin and stale Room cannot launch',async()=>{
  for(const options of [{mode:'mock',role:'student',voice:'willow'},{mode:'practice',role:'admin',voice:'stone'},{mode:'mock',role:'admin',voice:'external-tts'}]){
    const f=roomFixture('interview',options),pending=f.start();f.releaseCamera();await pending;assert.equal(f.launched().voice,'marin');
  }
  const f=roomFixture('interview',{mode:'mock',role:'admin'}),pending=f.start();f.context.current=()=>false;f.releaseCamera();await pending;assert.equal(f.launched(),null);
  f.chooseVoice('willow');assert.equal(f.settings.voice,'marin');
});
