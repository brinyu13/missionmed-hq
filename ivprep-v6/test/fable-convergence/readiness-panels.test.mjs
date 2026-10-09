import test from 'node:test';
import assert from 'node:assert/strict';
import {deviceReadinessMarkup,projectReadinessPanels,mountDeviceReadiness,readinessCapabilities} from '../../public/studio-fable/app/adapters/device-readiness.mjs';
import {readFileSync} from 'node:fs';

test('calibration full readiness exposes four accessible panels and a live-check count',()=>{
  const markup=deviceReadinessMarkup({fullPanels:true});
  for(const label of ['Devices','Visual signals','Voice signals','Signal health'])assert.ok(markup.includes(label));
  assert.match(markup,/role="tablist"/);assert.match(markup,/data-readiness-count/);
});

const byId=rows=>Object.fromEntries(rows.map(row=>[row.id,row]));
function capture(){
  const camera={readyState:'live',enabled:true,muted:false},microphone={readyState:'live',enabled:true,muted:false};
  const stream={getVideoTracks:()=>[camera],getAudioTracks:()=>[microphone]},context={state:'running'};
  const clocks={audio:null,vision:null,transcript:null};let time=0;
  const engine={audioContext:context,events:new EventTarget(),real:{clock:{sessionMs:()=>time},projector:{latest:{clock:{lastAcceptedAtMs:clocks}}},bridge:{media:{stream,AC:context,mic:{},analyser:{fftSize:32,getFloatTimeDomainData:values=>values.fill(.2)}}},pipeline:{diagnostics:()=>({active:true,workerReady:true})}}};
  const video={srcObject:stream,paused:false,readyState:4,videoWidth:640,videoHeight:480};
  const frame={speaking:true,volume:{available:true,scientificValue:-24},pitch:{available:true,voiced:true,f0Hz:180},speedWpm:{available:true,wordsPerMinute:120},headFace:{presence:'TRACKED',smileEventsLiveAvailable:true,smileEvents:0},bodyHands:{inFrame:true,handsAvailable:true,handsVisible:true}};
  return{camera,microphone,stream,context,engine,video,frame,clocks,setTime:at=>{time=at;}};
}
test('full projection uses defensible typed evidence; camera failure does not suppress independent voice',()=>{
  const f=capture(),input={stream:f.stream,context:f.context,video:f.video,previewVerified:true,audioGraphReady:true,diagnostics:{active:true,workerReady:true},frame:f.frame,audioFrame:f.frame,transcriptFrame:f.frame};
  let rows=byId(projectReadinessPanels(input));for(const id of ['volume','pitch','pace','smile','framing'])assert.equal(rows[id].state,'resolved');
  assert.equal(rows.pauses.state,'not');assert.match(rows.pauses.text,/no validated pause/);
  f.camera.muted=true;rows=byId(projectReadinessPanels(input));assert.equal(rows.face.state,'not');assert.equal(rows.volume.state,'resolved');
  for(const frame of [{...f.frame,speaking:false},{...f.frame,volume:{available:'true',scientificValue:-24},pitch:{available:true,voiced:true,f0Hz:NaN},speedWpm:{available:true,wordsPerMinute:'120'}}]){
    rows=byId(projectReadinessPanels({...input,audioFrame:frame,transcriptFrame:frame}));for(const id of ['volume','pitch','pace'])assert.equal(rows[id].state,'not');
  }
  f.microphone.enabled=false;assert.equal(byId(projectReadinessPanels(input)).volume.state,'not');
});
test('Recording and Transcript require exact admitted identity and literal capability flags, never consent',()=>{
  const identity={subject:'wp:1',admin:false};
  const account={mode:'REAL',subject:'wp:1',role:'student',admission:{admitted:true,identity},api:{identity}};
  const durable={bootstrapPayload:{identity,entitlement:{admitted:true},capabilities:{candidateAudioCapture:true}}};
  assert.deepEqual(readinessCapabilities(account,durable,true),{recording:true,transcript:true});
  assert.equal(readinessCapabilities(account,durable,'true').recording,false);
  durable.bootstrapPayload.capabilities.candidateAudioCapture='true';assert.equal(readinessCapabilities(account,durable,true).transcript,false);
  durable.bootstrapPayload.capabilities.candidateAudioCapture=true;durable.bootstrapPayload.identity={subject:'wp:2',admin:false};assert.deepEqual(readinessCapabilities(account,durable,true),{recording:false,transcript:false});
  durable.bootstrapPayload.identity=identity;account.admission.admitted='true';assert.deepEqual(readinessCapabilities(account,durable,true),{recording:false,transcript:false});
  const rows=byId(projectReadinessPanels({capabilities:{recording:true,transcript:true}}));
  assert.equal(rows.recording.capability,true);assert.match(rows.recording.text,/not recording/);assert.match(rows.transcript.text,/check transcript after a saved answer/);
  assert.equal(projectReadinessPanels({capabilities:{recording:'true',transcript:1}}).filter(row=>row.capability&&row.state==='resolved').length,0);
});
function dom(){
  const node=()=>({children:[],dataset:{},hidden:false,value:0,textContent:'',listeners:new Map(),attributes:{},append(...items){this.children.push(...items);},setAttribute(key,value){this.attributes[key]=value;},focus(){this.focused=true;},addEventListener(type,fn){this.listeners.set(type,fn);},removeEventListener(type){this.listeners.delete(type);},querySelector(selector){return this.children.find(child=>child.dataset.readinessRow===selector.match(/="(.*?)"/)?.[1]);}});
  const meter=node(),readout=node(),rows=node(),count=node(),panel=node(),tabs=Array.from({length:4},(_,i)=>Object.assign(node(),{dataset:{readinessTab:String(i)}}));
  tabs.forEach((tab,i)=>{tab.attributes['aria-selected']=String(i===0);tab.tabIndex=i===0?0:-1;});
  const map={'[data-mic-meter]':meter,'[data-mic-readout]':readout,'[data-readiness-rows]':rows,'[data-readiness-count]':count,'[role="tabpanel"]':panel};
  return{meter,readout,rows,count,panel,tabs,host:{ownerDocument:{createElement:node},querySelector:selector=>map[selector],querySelectorAll:()=>tabs}};
}
function mounted(){
  const f=capture(),d=dom();let time=0,tick,verified=false,switching=false,current=true;
  const view=mountDeviceReadiness(d.host,{getEngine:()=>f.engine,getStream:()=>f.stream,getVideo:()=>f.video,previewVerified:()=>verified,isSwitching:()=>switching,isCurrent:()=>current,onCaptureInvalidated:()=>{verified=false;},fullPanels:true,getCapabilities:()=>({recording:true,transcript:true}),now:()=>time,schedule:fn=>{tick=fn;return 1;},cancel(){},samplePreview:()=>true});
  const row=id=>d.rows.children.find(node=>node.dataset.readinessRow===id);
  function publish(modality,at,detail=f.frame){time=at;f.setTime(at);f.clocks[modality]=at;const event=new Event('frame');Object.defineProperty(event,'detail',{value:detail});f.engine.events.dispatchEvent(event);tick();}
  return{f,d,view,row,publish,tick:()=>tick(),at:at=>{time=at;f.setTime(at);},switching:value=>{switching=value;},current:value=>{current=value;},verify:()=>{verified=true;}};
}
test('mounted idle count excludes capabilities; accepted modalities cannot renew each other',()=>{
  const m=mounted();assert.equal(m.row('volume').dataset.state,'not');assert.match(m.d.count.textContent,/4 of 13/); // camera, microphone, processing, worker; excludes two capability rows
  m.verify();m.publish('vision',100);assert.equal(m.row('face').dataset.state,'resolved');assert.equal(m.row('volume').dataset.state,'not');
  m.publish('audio',200);assert.equal(m.row('volume').dataset.state,'resolved');assert.equal(m.row('pace').dataset.state,'not');
  m.publish('transcript',300);assert.equal(m.row('pace').dataset.state,'resolved');
  m.publish('vision',1401);assert.equal(m.row('volume').dataset.state,'not');assert.equal(m.row('pace').dataset.state,'not');assert.equal(m.row('face').dataset.state,'resolved');
  m.publish('audio',2502);assert.equal(m.row('face').dataset.state,'not');assert.equal(m.row('volume').dataset.state,'resolved');
  m.publish('vision',3603);assert.equal(m.row('volume').dataset.state,'not');assert.equal(m.row('pace').dataset.state,'not');m.view.dispose();
});
test('silent evidence, switching, reset, track replacement and disposal withhold old readiness',()=>{
  const m=mounted();m.publish('audio',100);m.publish('transcript',100);assert.equal(m.row('volume').dataset.state,'resolved');
  m.publish('audio',200,{...m.f.frame,speaking:false});assert.equal(m.row('volume').dataset.state,'not');
  m.switching(true);m.view.reset();m.tick();assert.equal(m.row('pace').dataset.state,'not');m.switching(false);m.publish('vision',300);assert.equal(m.row('volume').dataset.state,'not');
  m.publish('audio',400);assert.equal(m.row('volume').dataset.state,'resolved');
  const replacement={readyState:'live',enabled:true,muted:false};m.f.stream.getAudioTracks=()=>[replacement];m.tick();assert.equal(m.row('volume').dataset.state,'not');
  m.publish('vision',450);assert.equal(m.row('volume').dataset.state,'not');m.publish('audio',500);assert.equal(m.row('volume').dataset.state,'resolved');
  m.current(false);m.at(1700);m.tick();assert.equal(m.row('volume').dataset.state,'resolved');m.current(true);m.tick();assert.equal(m.row('volume').dataset.state,'not');
  m.view.dispose();const before=m.d.count.textContent;m.publish('audio',1800);assert.equal(m.d.count.textContent,before);assert.ok(m.d.tabs.every(tab=>tab.listeners.size===0));
});
test('repeated unchanged, malformed and future modality clocks cannot grant new evidence',()=>{
  const m=mounted();m.publish('audio',100);assert.equal(m.row('volume').dataset.state,'resolved');
  // Publish another composite frame while accepted audio time stays unchanged.
  m.publish('vision',1200);assert.equal(m.row('volume').dataset.state,'not');
  m.f.clocks.audio=NaN;m.publish('vision',1300);assert.equal(m.row('volume').dataset.state,'not');
  m.f.clocks.audio=5000;m.publish('vision',1400);assert.equal(m.row('volume').dataset.state,'not');
  m.view.reset();m.publish('vision',1500);assert.equal(m.row('volume').dataset.state,'not');
  m.publish('audio',5100);assert.equal(m.row('volume').dataset.state,'resolved');
  m.view.reset();m.publish('transcript',5200);assert.equal(m.row('volume').dataset.state,'not');
  m.at(6301);m.tick();assert.equal(m.row('pace').dataset.state,'not');m.view.dispose();
});
test('four tabs default to Devices and support arrow wrap, Home/End, focus and selection',()=>{
  const m=mounted(),{tabs,panel}=m.d;assert.equal(tabs[0].tabIndex,0);assert.equal(m.row('volume').hidden,true);
  function key(index,key){let prevented=false;tabs[index].listeners.get('keydown')({key,preventDefault(){prevented=true;}});assert.equal(prevented,true);}
  key(0,'ArrowLeft');assert.equal(tabs[3].attributes['aria-selected'],'true');assert.equal(tabs[3].focused,true);assert.equal(panel.attributes['aria-labelledby'],'readiness-tab-3');assert.equal(m.row('volume').hidden,false);
  key(3,'Home');assert.equal(tabs[0].tabIndex,0);key(0,'End');assert.equal(tabs[3].tabIndex,0);key(3,'ArrowRight');assert.equal(tabs[0].tabIndex,0);
  tabs[2].listeners.get('click')({currentTarget:tabs[2]});assert.equal(tabs[2].attributes['aria-selected'],'true');assert.equal(m.row('camera').hidden,true);assert.equal(m.row('volume').hidden,false);m.view.dispose();
});
test('only calibration opts into full panels; Room keeps its original compact device disclosure',()=>{
  const read=name=>readFileSync(new URL('../../public/studio-fable/app/'+name,import.meta.url),'utf8');
  assert.match(read('calibration.mjs'),/deviceReadinessMarkup\(\{fullPanels:true\}\)/);assert.match(read('calibration.mjs'),/fullPanels:true,getCapabilities:/);
  assert.match(read('room.mjs'),/data-room-devices><summary>Camera &amp; mic<\/summary>\$\{deviceControlsMarkup\(\{variant:'room'\}\)\}/);assert.doesNotMatch(read('room.mjs'),/fullPanels:true/);
  assert.doesNotMatch(deviceReadinessMarkup(),/role="tablist"|data-readiness-count/);
});
