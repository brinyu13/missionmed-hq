import test from 'node:test';
import assert from 'node:assert/strict';
import {overlayLayers,liveOverlayVisibility} from '../../public/studio-fable/app/adapters/overlay-view-model.mjs';
import {replayOverlays} from '../../public/studio-fable/app/adapters/replay-overlays.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('actual Room queued visibility callback cannot acquire a replacement account',async()=>{
  const source=readFileSync(new URL('../../public/studio-fable/app/room.mjs',import.meta.url),'utf8');
  const scope=source.match(/const scopeCurrent=([^;]+);/)[1];
  const fn=source.slice(source.indexOf('  function saveVisibility('),source.indexOf('  const observer='));
  for(const replaced of ['stable','account','durable','subject','route']){
    const account={subject:'wp:1'},durable={},controller={account,durable},note={hidden:true,textContent:''};let calls=0,route=true;
    const context={account,durable,subject:'wp:1',controller,disposed:false,isCurrent:()=>route,
      $:()=>note,Promise,state:{preferences:{}},commit:()=>{},saveOwnVisibility:async()=>{calls++;return {densityPersisted:false};}};
    vm.runInNewContext('const scopeCurrent='+scope+';const current=()=>!disposed&&scopeCurrent();'+fn+';saveVisibility({overlayLayers:{face:false}});',context);
    if(replaced==='account')controller.account={subject:'wp:2'};
    if(replaced==='durable')controller.durable={};
    if(replaced==='subject')account.subject='wp:2';
    if(replaced==='route')route=false;
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls,replaced==='stable'?1:0,replaced);
  }
});
test('master visibility retains independent face, body/hands and framing selection',()=>{
  const preferences={overlaysVisible:true,overlayLayers:{face:false,bodyHands:true,position:false}};
  assert.deepEqual(liveOverlayVisibility(preferences),{face:false,hands:true,body:true,position:false});
  assert.deepEqual(liveOverlayVisibility({...preferences,overlaysVisible:false}),{face:false,hands:false,body:false,position:false});
  assert.deepEqual(overlayLayers(preferences.overlayLayers),{face:false,bodyHands:true,position:false});
  assert.deepEqual(liveOverlayVisibility({}),{face:false,hands:false,body:false,position:false});
});
function fixture(){
  const records={pipelines:[],owners:[],status:[]};let current=true;
  const video={id:'playback',isConnected:true};
  class Pipeline extends EventTarget {
    constructor(options){super();this.options=options;this.started=[];this.destroyed=false;records.pipelines.push(this);}
    beginPlayback(value){this.started.push(value);return true;}
    destroy(){this.destroyed=true;}
  }
  class Owner {
    constructor(options){this.options=options;this.policies=[];this.destroyed=false;this.playbackEvents=[];records.owners.push(this);}
    configure(value){this.policies.push(value);this.policy=value;}
    onViewChange(view,role){this.view=view;this.role=role;}
    consumeOverlay(){this.draws=(this.draws||0)+1;return true;}
    clearOverlay(){this.cleared=true;}
    stopPlayback(reason){this.playbackEvents.push(['stop',reason]);this.clearOverlay();}
    toggleOverlayPart(key){this.playbackEvents.push(['toggle',key]);return true;}
    startPlayback(){this.playbackEvents.push(['start']);}
    destroy(){assert.equal(this.policy.authorized,false);this.destroyed=true;}
  }
  const loaded=[{BrowserAnalyticsPipeline:Pipeline},{StudentSurfaceOverlayController:Owner}];
  return {records,video,loaded,invalidate:()=>current=false,options:{video,isCurrent:()=>current,onStatus:value=>records.status.push(value),load:async()=>loaded}};
}
test('expected end/pause is ready, resume waits for fresh geometry, and genuine failures stay unavailable',async()=>{
  const f=fixture(),overlay=replayOverlays(f.options);await overlay.setEnabled(true);
  const pipeline=f.records.pipelines[0];
  const emit=detail=>{const event=new Event('state');Object.defineProperty(event,'detail',{value:detail});pipeline.dispatchEvent(event);};
  emit({state:'partial',message:'playback_stopped',subsystem:'vision'});
  assert.equal(f.records.status.at(-1),'ready');
  emit({state:'idle',reason:'playback_ended',ephemeralPlayback:true});
  assert.equal(f.records.status.at(-1),'ready');
  emit({state:'running',ephemeralPlayback:true});
  assert.equal(f.records.status.at(-1),'waiting');
  emit({state:'partial',message:'vision_worker_unavailable',subsystem:'vision'});
  assert.equal(f.records.status.at(-1),'unavailable');
  emit({state:'unavailable'});assert.equal(f.records.status.at(-1),'unavailable');
  await overlay.setEnabled(false);await overlay.setEnabled(true);assert.equal(f.records.status.at(-1),'ready');
  emit({state:'unavailable'});assert.equal(f.records.status.at(-1),'ready');
  f.invalidate();emit({state:'running',ephemeralPlayback:true});assert.equal(f.records.status.at(-1),'ready');
  overlay.destroy();
});
test('replay redraw is opt-in, playback-only and uses existing owner over exact video',async()=>{
  const f=fixture(),overlay=replayOverlays(f.options);
  assert.equal(f.records.pipelines.length,0);await overlay.setEnabled(false);assert.equal(f.records.pipelines.length,0);
  assert.equal(await overlay.setEnabled(true),true);
  const pipeline=f.records.pipelines[0],owner=f.records.owners[0];
  assert.deepEqual(pipeline.options,{bridge:{media:{}}});assert.equal(pipeline.started.length,0);
  assert.equal(owner.options.playbackPipeline,pipeline);assert.equal(owner.options.surfaceIds.playback,f.video.id);
  assert.equal(owner.view,'filmroom');assert.equal(owner.role,'student');
  pipeline.beginPlayback({videoElement:f.video});assert.equal(pipeline.started[0].videoElement,f.video);
  assert.equal(owner.consumeOverlay({pipelineMs:0},'playback'),true);assert.equal(f.records.status.at(-1),'drawn');
  f.invalidate();assert.equal(pipeline.beginPlayback({videoElement:f.video}),false);assert.equal(pipeline.started.length,1);
  assert.equal(owner.consumeOverlay({pipelineMs:0},'playback'),false);assert.equal(owner.cleared,true);
  overlay.destroy();assert.equal(owner.destroyed,true);assert.equal(pipeline.destroyed,true);
});
test('late playback owner import cannot bind after route or account cancellation',async()=>{
  for(const cancel of ['destroy','account']){
    const f=fixture();let resolve;
    const overlay=replayOverlays({...f.options,load:()=>new Promise(r=>resolve=r)}),pending=overlay.setEnabled(true);
    if(cancel==='destroy')overlay.destroy();else f.invalidate();
    resolve(f.loaded);assert.equal(await pending,false);assert.equal(f.records.pipelines.length,0);
  }
});
test('failed stale import cannot destroy a newer enabled playback owner',async()=>{
  const f=fixture();let reject,calls=0;
  const overlay=replayOverlays({...f.options,load:()=>++calls===1?new Promise((_,r)=>reject=r):Promise.resolve(f.loaded)});
  const old=overlay.setEnabled(true);await overlay.setEnabled(false);assert.equal(await overlay.setEnabled(true),true);
  reject(new Error('stale import'));assert.equal(await old,false);
  assert.equal(f.records.owners[0].destroyed,false);assert.equal(f.records.pipelines[0].destroyed,false);
  overlay.destroy();assert.equal(f.records.pipelines[0].destroyed,true);
});
test('owner initialization failure is truthful and releases its ephemeral pipeline',async()=>{
  const f=fixture();class BrokenOwner{constructor(){throw new Error('unavailable');}}
  const overlay=replayOverlays({...f.options,load:async()=>[f.loaded[0],{StudentSurfaceOverlayController:BrokenOwner}]});
  assert.equal(await overlay.setEnabled(true),false);assert.equal(f.records.status.at(-1),'unavailable');
  assert.equal(f.records.pipelines[0].destroyed,true);overlay.destroy();
});
test('layer switch clears old policy and invalidates only ephemeral replay before new frames',async()=>{
  const f=fixture(),overlay=replayOverlays(f.options);await overlay.setEnabled(true);
  const owner=f.records.owners[0];
  assert.equal(owner.toggleOverlayPart('face'),true);
  assert.deepEqual(owner.playbackEvents,[['stop','overlay_layers_changed'],['toggle','face'],['start']]);
  assert.equal(owner.cleared,true);assert.equal(f.records.pipelines[0].destroyed,false);
  assert.equal(owner.toggleOverlayPart('invalid'),false);
  f.invalidate();assert.equal(owner.toggleOverlayPart('bodyHands'),false);
  assert.equal(owner.playbackEvents.length,3);overlay.destroy();
});
test('unmatched replay frames expire and teardown cancels the exact freshness timer',async()=>{
  const f=fixture(),timers=new Map(),cancelled=[];let next=0;
  const overlay=replayOverlays({...f.options,schedule:(callback,ms)=>{assert.equal(ms,1500);timers.set(++next,callback);return next;},cancel:id=>{cancelled.push(id);timers.delete(id);}});
  await overlay.setEnabled(true);const owner=f.records.owners[0];
  owner.consumeOverlay({pipelineMs:0},'playback');owner.consumeOverlay({pipelineMs:0},'playback');
  assert.deepEqual(cancelled,[1]);assert.equal(timers.size,1);
  timers.get(2)();assert.equal(owner.cleared,true);assert.equal(f.records.status.at(-1),'waiting');
  owner.consumeOverlay({pipelineMs:0},'playback');await overlay.setEnabled(false);assert.deepEqual(cancelled,[1,3]);
  assert.equal(owner.destroyed,true);overlay.destroy();
});
test('old replay owner cannot cancel the replacement owner freshness expiry',async()=>{
  const f=fixture(),timers=new Map();let next=0;
  const overlay=replayOverlays({...f.options,schedule:callback=>{timers.set(++next,callback);return next;},cancel:id=>timers.delete(id)});
  await overlay.setEnabled(true);const old=f.records.owners[0];
  await overlay.setEnabled(false);await overlay.setEnabled(true);const fresh=f.records.owners[1];
  fresh.consumeOverlay({pipelineMs:0},'playback');assert.equal(timers.size,1);
  old.clearOverlay();assert.equal(old.consumeOverlay({},'playback'),false);assert.equal(old.toggleOverlayPart('face'),false);
  assert.equal(timers.size,1);timers.get(1)();assert.equal(fresh.cleared,true);assert.equal(f.records.status.at(-1),'waiting');
  overlay.destroy();
});
test('replay inference age consumes the existing freshness budget instead of restarting it at arrival',async()=>{
  const f=fixture(),timers=[];
  const overlay=replayOverlays({...f.options,schedule:(callback,ms)=>{timers.push({callback,ms});return timers.length;},cancel:()=>{}});
  await overlay.setEnabled(true);const owner=f.records.owners[0];
  assert.equal(owner.consumeOverlay({pipelineMs:900},'playback'),true);
  assert.equal(timers[0].ms,600);assert.equal(owner.draws,1);
  timers[0].callback();assert.equal(owner.cleared,true);assert.equal(f.records.status.at(-1),'waiting');
  overlay.destroy();
});
test('expired or unverifiable replay frames clear prior geometry without drawing or stopping video analysis',async()=>{
  for(const pipelineMs of [1500,1501,9000,-1,NaN,Infinity,'900',null,undefined]){
    const f=fixture(),timers=[];
    const overlay=replayOverlays({...f.options,schedule:(callback,ms)=>{timers.push({callback,ms});return timers.length;},cancel:()=>{}});
    await overlay.setEnabled(true);const owner=f.records.owners[0],pipeline=f.records.pipelines[0];
    assert.equal(owner.consumeOverlay({pipelineMs},'playback'),false);
    assert.equal(owner.draws,undefined);assert.equal(owner.cleared,true);assert.equal(timers.length,0);
    assert.equal(pipeline.destroyed,false);assert.deepEqual(owner.playbackEvents,[]);
    assert.equal(f.records.status.at(-1),'waiting');overlay.destroy();
  }
});
