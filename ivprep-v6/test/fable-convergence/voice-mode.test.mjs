import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {defaultSettings,toWizard,resolveMockQuestionTarget,selectedAdminVoice,VOICES} from '../../public/studio-fable/app/settings/interviewer.mjs';
import {avatarAdmissionReady,interviewPresenceCue,AVATAR_UNAVAILABLE} from '../../public/studio-fable/app/adapters/avatar-admission.mjs';

const source=readFileSync(new URL('../../public/studio-fable/app/room.mjs',import.meta.url),'utf8');
const available={schema:'ivoc.founder-qa.v1',available:true,enabled:true,sourceIntegrity:true,maxSeconds:170,sessionId:'synthetic-avatar',usage:{expiresAt:Date.now()+60000}};
const question={question_id:'CORE-01',canonical_text:'Tell me about yourself.',core_priority:true};
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
async function until(check){for(let i=0;i<60;i++){if(check())return;await new Promise(resolve=>setImmediate(resolve));}assert.fail('Room did not settle');}

// A minimal DOM for the actual mountRoom module. No provider, media device,
// network, private account, or source-only imitation of the Start handler.
class Element {
  constructor(tag='div',attrs={}){this.tagName=tag;this.attrs={...attrs};this.dataset={};this.children=[];this.handlers={};this.hidden=Object.hasOwn(attrs,'hidden');this.disabled=Object.hasOwn(attrs,'disabled');this.value=attrs.value||'';this.textContent='';for(const[k,v]of Object.entries(attrs))if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;}
  set innerHTML(html){this.children=[];this.html=html;let node=this;const stack=[this];for(const token of html.matchAll(/<\/?[a-z][^>]*>|[^<]+/gi)){const value=token[0];if(value.startsWith('</')){if(stack.length>1)stack.pop();node=stack.at(-1);continue;}if(!value.startsWith('<')){node.textContent+=value;continue;}const tag=value.match(/^<([\w-]+)/)[1],attrs={};for(const m of value.slice(tag.length+1,-1).matchAll(/([\w-]+)(?:="([^"]*)"|'([^']*)')?/g))attrs[m[1]]=m[2]??m[3]??'';const child=new Element(tag,attrs);node.append(child);if(tag==='option'&&(Object.hasOwn(attrs,'selected')||!node.value))node.value=attrs.value||'';if(!['input','br','hr','img','meta','link'].includes(tag)){stack.push(child);node=child;}}}
  get innerHTML(){return this.html||'';}
  append(child){child.parent=this;this.children.push(child);}
  insertAdjacentHTML(_where,html){const temp=new Element();temp.innerHTML=html;for(const c of temp.children)this.append(c);}
  matches(selector){if(selector.startsWith('#'))return this.attrs.id===selector.slice(1);if(selector.startsWith('.'))return(this.attrs.class||'').split(/\s+/).includes(selector.slice(1));if(selector.startsWith('[')){const m=selector.match(/^\[([^=\]]+)(?:="?([^"\]]+)"?)?\]$/);return m&&Object.hasOwn(this.attrs,m[1])&&(m[2]===undefined||this.attrs[m[1]]===m[2]);}return this.tagName===selector;}
  querySelectorAll(selector){const parts=selector.trim().split(/\s+/),last=parts.pop(),result=[];const visit=node=>{for(const child of node.children){if(child.matches(last)){let ancestor=child.parent,ok=true;for(const part of [...parts].reverse()){while(ancestor&&!ancestor.matches(part))ancestor=ancestor.parent;if(!ancestor){ok=false;break;}ancestor=ancestor.parent;}if(ok)result.push(child);}visit(child);}};visit(this);return result;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  setAttribute(k,v){this.attrs[k]=String(v);}
  removeAttribute(k){delete this.attrs[k];}
  addEventListener(name,handler){(this.handlers[name]??=[]).push(handler);}
  removeEventListener(){}
  dispatch(name){const e={target:this,currentTarget:this};this['on'+name]?.(e);for(const fn of this.handlers[name]||[])fn(e);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.removed=true;}
  closest(selector){for(let e=this;e;e=e.parent)if(e.matches(selector))return e;return null;}
  focus(){}
}

async function mount({capability,role='admin',subject='wp:1',countdown=null,launch=null,release=null,refresh=null,save=null,practice=false,savedMode=null}={}){
  const main=new Element(),body=new Element('body');body.append(main);
  const calls={starts:[],renderers:[],refresh:0,contexts:[],releases:[],saves:[],native:[],kill:0};
  const eventHandlers=new Map(),engine={events:{addEventListener:(type,fn)=>eventHandlers.set(type,fn),removeEventListener(){}},audioContext:{state:'running'},beginAnswer(){},setOverlayVisibility(){}};
  const stream={getVideoTracks:()=>[{}],getAudioTracks:()=>[{}]};
  const account={mode:'REAL',role,subject,liveInterviewAvailable:true,api:{csrfToken:'synthetic'},capabilities:{embodimentCanary:capability&&structuredClone(capability)}};
  class NativeProvider {constructor(options){this.options=options;calls.native.push(this);}async connect(){this.options.onLine('A contextual spoken question');this.options.onSpeaking(true);if(launch)await launch.promise;}stop(){this.stopped=true;}}
  const controller={account,durable:{accountSession:{id:'synthetic'}},stream,video:{},engine,elapsed:2,phase:'READY',navigationLocked:false,
    mountVideo(){return this.video;},async acquire(){return engine;},async startSession(options){calls.starts.push(options);this.phase='STARTING';const native=new NativeProvider(options);await native.connect();this.phase='LIVE';return{interviewer:native};},
    async release(reason){calls.releases.push(reason);if(release)await release.promise;this.phase='IDLE';},
    async finishSession({record}){calls.saves.push(record);this.phase='SAVING';if(save)await save.promise;return{id:'saved-fixture'};}};
  let active=true;
  const environment=()=>{};environment.refresh=()=>{};
  const fakeObserver=class {constructor(){this.closing={reached:false};}start(){}snapshot(){return{plan:[{n:1,status:'CURRENT',text:question.canonical_text}],closing:this.closing,n:1,N:1,state:'CORE',finalObservationCount:0,fragmentTextObservationCount:0};}requestEnd(){return null;}pendingHookContext(){return null;}ingestFinal(){}ingestFragment(){return false;}};
  const context={state:{preferences:{}},uid:()=> 'fixture-attempt',commit(){},loadQuestions:async()=>({questions:[question]}),controller,
    conductorConfig:()=>({}),toWizard,defaultSettings,resolveMockQuestionTarget,VOICES,selectedAdminVoice,
    liveContext:async input=>{calls.contexts.push(input);return{synthetic:true};},arrivalDelaySeconds:()=>0,
    waitForInterviewEntry:async()=>{if(countdown)await countdown.promise;},preInterviewReady:()=>true,awaitVisibleCamera:async()=>{},assertMicrophoneReady(){},
    mountDeviceControls:async()=>Object.assign(()=>{},{refresh:async()=>{},preferences:()=>({})}),deviceControlsMarkup:()=>'<div data-device-controls></div>',
    projectReadinessLines:()=>[],readinessLinesMarkup:()=>'<div id="readiness-lines"></div>',mountReadinessLines:()=>()=>{},
    selectedEnvironment:()=> 'missionmed',environmentProfile:()=>({simulated:false}),environmentControlsMarkup:()=>'',mountEnvironmentProfile:()=>environment,
    bindPrimaryRecovery:()=>()=>{},saveOwnVisibility:async()=>null,overlayLayers:()=>({position:true}),liveOverlayVisibility:()=>({}),NativeInterviewObserver:fakeObserver,applyNativeObservationMarks(){},substantiveQuestionPlan:input=>input,
    EmbodimentRenderer:class{constructor(options){calls.renderers.push(options);}},AVATAR_UNAVAILABLE,avatarAdmissionReady,interviewPresenceCue,
    refreshAvatarAdmission:async()=>{calls.refresh++;return refresh?refresh():structuredClone(available);},leftRailMarkup:()=>'',rightRailMarkup:()=>'',RailsController:class{ingest(){}},recorderMarkup:()=>'',LiveRecorder:class{setData(){}tick(){}destroy(){}},TraceHistory:class{push(){}slice(){return[{t:1,vol:42}];}},deriveDebrief:()=>({change:[]}),hookLedger:()=>[],closingLedger:()=>null,
    document:{body,createElement:tag=>new Element(tag),querySelector:selector=>body.querySelector(selector)},location:{hash:''},window:{matchMedia:()=>({matches:true})},AbortController,
    setInterval:()=>1,clearInterval(){},setTimeout:()=>2,clearTimeout(){},fetch:async()=>{calls.kill++;return{ok:true};},console};
  const actual=source.replace(/^import .*;\n/gm,'').replace('export async function mountRoom','async function mountRoom');
  const mountRoom=vm.runInNewContext(actual+'\nmountRoom;',context,{filename:'actual-room.mjs'});
  const session={mode:practice?'practice':'mock',settings:{...defaultSettings(),...(savedMode?{interviewEmbodiment:savedMode}:{})},mockSet:[question]};
  const dispose=await mountRoom(main,{session,isCurrent:()=>active});
  const $=id=>main.querySelector('#'+id);
  await until(()=>$('stage').dataset.previewReady==='true');
  return{main,$,calls,controller,context,eventHandlers,session,choose(value){assert.ok($('interview-mode').children.some(option=>option.tagName==='option'&&option.value===value),'choice must be a rendered option');$('interview-mode').value=value;$('interview-mode').dispatch('change');},start(){ $('start-session').dispatch('click');},async ready(){await until(()=>$('room').dataset.phase==='live');},dispose(){active=false;dispose();}};
}

test('Voice mounts and starts with Founder QA OFF, exhausted, expired, or absent; no avatar request or renderer',async()=>{
  for(const capability of [undefined,{...available,enabled:false,available:false},{...available,available:false,usage:{sessionCount:1,maxSessions:1}},{...available,available:false,usage:{expiresAt:1}}]){
    const f=await mount({capability});assert.equal(f.$('interview-mode').value,'voice');assert.equal(f.$('start-session').disabled,false);
    f.start();await f.ready();assert.equal(f.calls.starts.length,1);assert.equal(f.calls.native.length,1);assert.equal(f.calls.refresh,0);assert.equal(f.calls.renderers.length,0);
    const options=f.calls.starts[0];assert.equal(options.audioRenderer,null);assert.equal(options.wizard.embodimentCanary,undefined);assert.equal(options.voice,'marin');assert.equal(f.$('presence-state').textContent,'speaking');
    options.onStatus({state:'active'});assert.equal(f.$('presence-sub').textContent,'Your interviewer is listening');options.onSpeaking(false);f.eventHandlers.get('frame')({detail:{t:1,speaking:false}});assert.equal(f.$('presence-state').textContent,'listening');
    f.dispose();
  }
});
test('only the existing Founder/canary account can see Avatar; unavailable explicit Avatar cannot silently start Voice',async()=>{
  const student=await mount({role:'student',subject:'wp:2',capability:available});assert.equal(student.$('interview-mode').children.some(x=>x.value==='avatar'),false);student.dispose();
  for(const capability of [{...available,available:false,enabled:false},{...available,sourceIntegrity:false}]){
    const f=await mount({capability});assert.equal(f.$('interview-mode').children.filter(x=>x.tagName==='option').length,2);f.choose('avatar');assert.equal(f.$('start-session').disabled,true);assert.equal(f.$('rec-text').textContent,'BLOCKED');
    f.start();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls.starts.length,0);assert.equal(f.calls.renderers.length,0);assert.equal(f.calls.refresh,0);
    f.choose('voice');assert.equal(f.$('start-session').disabled,false);assert.equal(f.$('rec-text').textContent,'READY');f.start();await f.ready();assert.equal(f.calls.starts[0].audioRenderer,null);f.dispose();
  }
});
test('explicit admitted Avatar uses one refreshed allowance and one renderer; stale refresh creates neither native session nor renderer',async()=>{
  const f=await mount({capability:available});f.choose('avatar');f.start();await f.ready();assert.equal(f.calls.refresh,1);assert.equal(f.calls.renderers.length,1);assert.equal(f.calls.starts[0].wizard.embodimentCanary,true);assert.ok(f.calls.starts[0].audioRenderer);f.dispose();
  const stale=await mount({capability:available,refresh:()=>{throw new Error(AVATAR_UNAVAILABLE);}});stale.choose('avatar');stale.start();await until(()=>stale.calls.releases.length===1);await new Promise(resolve=>setImmediate(resolve));assert.equal(stale.calls.starts.length,0);assert.equal(stale.calls.renderers.length,0);assert.equal(stale.calls.refresh,1);assert.equal(stale.$('rec-text').textContent,'BLOCKED');stale.dispose();
});
test('chosen mode and Admin voice freeze through countdown, provider startup, live and saving',async()=>{
  const countdown=deferred(),launch=deferred(),save=deferred();const f=await mount({capability:available,countdown,launch,save});
  f.$('admin-live-voice').value='willow';f.$('admin-live-voice').dispatch('change');f.start();assert.equal(f.$('interview-mode').disabled,true);f.choose('avatar');assert.equal(f.$('interview-mode').value,'voice');
  countdown.resolve();await until(()=>f.calls.starts.length===1);assert.equal(f.calls.starts[0].audioRenderer,null);assert.equal(f.calls.starts[0].voice,'willow');launch.resolve();await f.ready();assert.equal(f.$('interview-mode'),null); // readiness card is removed after native startup
  f.$('end').dispatch('click');const finish=f.context.document.querySelector('#leave');finish.dispatch('click');await until(()=>f.calls.saves.length===1);assert.equal(f.calls.saves[0].settings.interviewEmbodiment,undefined);assert.equal(f.calls.saves[0].samples[0].vol,42);assert.equal(f.calls.saves[0].transport,'gpt-live');
  save.resolve();await until(()=>f.context.location.hash==='#/results/saved-fixture');f.dispose();
});
test('failed startup keeps mode locked until teardown completes and avatar kill never disables a ready native Voice start',async()=>{
  const launch=deferred(),release=deferred();const f=await mount({capability:available,launch,release});f.start();await until(()=>f.calls.starts.length===1);launch.reject(new Error('synthetic startup failure'));await until(()=>f.calls.releases.length===1);assert.equal(f.$('interview-mode').disabled,true);f.choose('avatar');assert.equal(f.$('interview-mode').value,'voice');release.resolve();await until(()=>!f.$('interview-mode').disabled);f.dispose();
  const ready=await mount({capability:available});ready.main.querySelector('[data-qa-kill]').dispatch('click');await until(()=>ready.calls.kill===1);await new Promise(resolve=>setImmediate(resolve));assert.equal(ready.$('start-session').disabled,false);ready.start();await ready.ready();assert.equal(ready.calls.starts[0].audioRenderer,null);ready.dispose();
});
test('actual mounted runtime surfaces contain no question/caption/coaching/label text; transcript remains outside and capture is unchanged',async()=>{
  const f=await mount({capability:available});f.start();await f.ready();
  for(const id of ['presence-name','presence-sub','presence-state','presence-line','captions','stage-tag','controls']){const node=f.$(id);assert.ok(node,id);assert.equal(node.closest('.meeting-stage'),null,id);}
  assert.equal(f.$('presence-line').hidden,true);assert.equal(f.$('presence').querySelector('.orb').textContent,'');assert.equal(f.main.querySelector('[data-embodiment-host]').textContent,'');assert.ok(f.$('stage').querySelector('#overlay'));assert.ok(f.main.querySelector('[data-device-controls]'));
  f.calls.starts[0].onCaptions([{speaker:'interviewer',text:'A contextual question'}]);assert.match(f.$('transcript').innerHTML,/A contextual question/);assert.equal(f.$('transcript').closest('.meeting-stage'),null);f.dispose();
});

test('late rejection after account/capture replacement cannot release the successor; retries start with a fresh mode choice',async()=>{
  const launch=deferred();const stale=await mount({capability:available,launch});stale.start();await until(()=>stale.calls.starts.length===1);
  stale.controller.account={...stale.controller.account,subject:'wp:2'};stale.controller.engine={successor:true};launch.reject(new Error('old startup rejected'));await new Promise(resolve=>setImmediate(resolve));assert.equal(stale.calls.releases.length,0);stale.dispose();
  const retry=await mount({capability:available,savedMode:'avatar'});assert.equal(retry.$('interview-mode').value,'voice');assert.equal(retry.$('interview-mode').disabled,false);retry.choose('avatar');assert.equal(retry.$('interview-mode').value,'avatar');retry.choose('voice');retry.start();await retry.ready();assert.equal(retry.calls.refresh,0);assert.equal(retry.calls.starts[0].audioRenderer,null);retry.dispose();
});
