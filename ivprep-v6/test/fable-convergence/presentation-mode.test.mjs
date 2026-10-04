import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {sealDerivedEvidence} from '../../public/studio-fable/app/adapters/derived-evidence.mjs';
import {projectSavedAttempt} from '../../public/studio-fable/app/adapters/saved-review.mjs';
import {toWizard,defaultSettings} from '../../public/studio-fable/app/settings/interviewer.mjs';

const source=readFileSync(new URL('../../public/studio-fable/app/room.mjs',import.meta.url),'utf8');
const section=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)));
function roomFixture(density){
  const elements=new Map(),buttons=['interview','coached'].map(value=>({dataset:{density:value},disabled:false,setAttribute(){}}));
  const element=id=>{if(!elements.has(id))elements.set(id,{dataset:{},hidden:false,disabled:false,textContent:'',remove(){},setAttribute(){}});return elements.get(id);};
  const room=element('room');room.querySelectorAll=()=>buttons;
  const handler={};room.querySelector=()=>({addEventListener:(_type,fn)=>{handler.density=fn;}});
  element('reset-density').addEventListener=(_type,fn)=>{handler.reset=fn;};
  const events=[],samples=[{t:1,vol:4,signalGap:false}],settings=defaultSettings();let filed=null,resolveCamera;
  const camera=new Promise(resolve=>{resolveCamera=resolve;});
  const context={density,initialPresentationMode:null,starting:false,started:false,saving:false,finished:false,disposed:false,deviceSwitching:false,
    current:()=>true,$:element,room,main:{querySelectorAll:()=>[],querySelector:()=>({remove(){}})},
    controller:{video:{},stream:{},elapsed:2,startSession:async()=>({interviewer:{}}),finishSession:async({record})=>{filed=record;return{saveError:'retry retained'};}},
    engine:{events:{addEventListener(){},removeEventListener(){}},personalCalibration:null},settings,session:{},mode:'practice',plan:[{question_id:'CORE-01',canonical_text:'Tell me about yourself.'}],
    awaitVisibleCamera:()=>camera,toWizard,liveContext:async()=>null,observer:null,callbacks:{},onFrame(){},onState(){},onWord(){},
    mark:(kind,label)=>events.push({t:2,kind,label}),events,turns:[],saveRecord:null,at:()=>2,renderPlan(){},recorder:{setData(){},tick(){}},history:{slice:()=>samples},
    timer:null,setInterval:()=>1,resetIdle(){},disposeDevices:null,state:{preferences:{}},commit(){},saveVisibility(){},
    detach(){},deriveDebrief:()=>({change:[]}),hookLedger:()=>[],closingLedger:()=>null,uid:()=> 'attempt',showSaveFailure(){},showSaved(){},
  };
  const helperStart=source.indexOf('  function setDensityControls(');
  const helpers=helperStart<0?'':source.slice(helperStart,source.indexOf('  function renderTranscript()',helperStart));
  vm.createContext(context);
  vm.runInContext(helpers+section('  async function start(){',"  $('connect-real').addEventListener")+section("  room.querySelector('.density').addEventListener", "  $('guides').addEventListener")+section('  async function finishSession(reason){','  applyOverlays();renderPlan();renderTranscript();')+';this.start=start;this.finish=finishSession;',context);
  return {context,buttons,events,samples,settings,releaseCamera:()=>resolveCamera(),start:()=>context.start(),finish:()=>context.finish('finished'),
    select:value=>handler.density({target:{closest:()=>buttons.find(b=>b.dataset.density===value)}}),reset:()=>handler.reset(),filed:()=>filed};
}
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
