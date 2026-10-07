import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NativeInterviewObserver} from '../../public/studio-fable/app/brain/native-observer.mjs';
import {GptLiveInterviewer} from '../../public/studio-fable/app/adapters/live-adapter.mjs';
import {LiveInterviewSession} from '../../public/capabilities/live-interview.mjs';
import {mountDeviceControls} from '../../public/studio-fable/app/adapters/device-controls.mjs';
import {buildLiveInterviewInstructions} from '../../server/providers/openai-live-session.mjs';
const room=readFileSync(new URL('../../public/studio-fable/app/room.mjs',import.meta.url),'utf8');
test('semantic curiosity and prompt responses are startup policy, not dependent on a lexical Director hint',()=>{
  const instructions=buildLiveInterviewInstructions({goal:'Full interview simulation',questionIds:['CORE-01'],targetQuestions:1,interviewer:'Program Director · balanced',pressurePractice:false,program:'Internal Medicine · RISE seam',environment:'RISE + StoryForge seams'},
    {receipt:'ctxpack:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb@'+'c'.repeat(64),actorBlock:'AUTHORIZED APPLICATION CONTEXT\nNo applicant facts provided.'});
  assert.match(instructions,/silently compare the actual answer with what you asked/);
  assert.match(instructions,/do not wait for an application hint/);
  assert.match(instructions,/Do not chase an irrelevant tangent or withheld\/private details/);
  assert.match(instructions,/Do you have any questions for me/);
});
test('production partial-answer path never forces move-on or interrupts native speech with strong objectives',()=>{
  const guide=room.slice(room.indexOf('  function guideHook(){'),room.indexOf('  const callbacks='));
  assert.doesNotMatch(guide,/pendingObjective|steerObjective/);
  assert.match(guide,/pendingHookContext/);assert.match(guide,/appendHookContext/);
  const observer=new NativeInterviewObserver({questions:[{question_id:'CORE-01',canonical_text:'Tell me about yourself.'}],config:{maxDepth:1,maxFollowUps:4}});
  observer.start();const wire=[];
  const live=new LiveInterviewSession({createSession(){},endSession(){},PeerConnection:class{}});
  live.state='active';live.channel={readyState:'open',send:raw=>wire.push(JSON.parse(raw))};
  const interviewer=new GptLiveInterviewer();interviewer.live=live;
  let n=0;
  for(const delta of ['I trained in Ohio and I enjoy teaching medicine. ','Actually, there was a really interesting teaching moment with my son yesterday.',' It involved an unexpected question.',' And a surprising result.']){
    observer.ingestFragment({type:'session.input_transcript.delta',event_id:'in-'+(++n),start_ms:n*1000,end_ms:n*1000+999,delta});
    const hint=observer.pendingHookContext();if(hint&&interviewer.appendHookContext(hint))observer.hookContextSent(hint);
  }
  assert.equal(wire.filter(e=>e.type==='session.instructions.append').length,0);
  assert.equal(wire.filter(e=>e.type==='session.thinking.append').length,1,'one hint, not a per-fragment instruction queue');
  assert.match(wire[0].content,/son/);
});
class Select extends EventTarget{
  constructor(kind){super();this.dataset={deviceKind:kind};this.options=[];this.value='';}
  replaceChildren(){this.options=[];this.value='';}
  append(option){this.options.push(option);if(option.selected||this.options.length===1)this.value=option.value;}
}
test('selectors enumerate and remember choices before capture without opening another stream',async()=>{
  const camera=new Select('camera'),mic=new Select('microphone'),status={textContent:''};let engine=null,captures=0;
  const host={hidden:true,querySelector:()=>status,querySelectorAll:()=>[camera,mic],ownerDocument:{createElement:()=>({}),defaultView:new EventTarget()}};
  const mediaDevices=new EventTarget();mediaDevices.enumerateDevices=async()=>[{kind:'videoinput',deviceId:'facetime',label:'FaceTime HD Camera'},{kind:'audioinput',deviceId:'builtin',label:'Built-in microphone'}];
  mediaDevices.getUserMedia=()=>{captures++;};
  const dispose=await mountDeviceControls(host,{getEngine:()=>engine,getStream:()=>null,mediaDevices});
  assert.equal(host.hidden,false);assert.equal(camera.disabled,false);assert.equal(mic.disabled,false);
  camera.value='facetime';camera.dispatchEvent(new Event('change'));mic.value='builtin';mic.dispatchEvent(new Event('change'));
  assert.deepEqual(dispose.preferences(),{cameraDeviceId:'facetime',microphoneDeviceId:'builtin'});
  assert.equal(captures,0);assert.match(status.textContent,/Connect/);
  engine={real:{currentDevices:()=>({cameraDeviceId:'facetime',microphoneDeviceId:'builtin'})}};
  await dispose.refresh();assert.equal(camera.value,'facetime');assert.equal(mic.value,'builtin');dispose();
});
