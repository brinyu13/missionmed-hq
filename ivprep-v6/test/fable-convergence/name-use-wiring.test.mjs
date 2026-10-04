import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSettings,toWizard} from '../../public/studio-fable/app/settings/interviewer.mjs';
import {DurableStudioSession} from '../../public/studio/durable-session.mjs';
import {normalizeManualInterviewerName} from '../../public/studio-fable/app/settings/interviewer.mjs';
import {nameUseViewMarkup} from '../../public/studio-fable/app/adapters/name-use-view.mjs';
import {projectSavedAttempt} from '../../public/studio-fable/app/adapters/saved-review.mjs';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../../public/studio-fable/app/main.mjs',import.meta.url),'utf8');
function handlers(st){
  const events=new Map();let current=true,draws=0;
  const input={value:st.interviewerName||'',setCustomValidity(v){this.error=v;},reportValidity(){}};
  const checkbox={checked:false},launch={disabled:false};
  const elements={'#adv-name':input,'#adv-name-use':checkbox,'#go-room':launch};
  for(const [id,element] of Object.entries(elements))element.addEventListener=(type,fn)=>events.set(id,fn);
  const begin=source.indexOf("    main.querySelector('#adv-name').addEventListener"),end=source.indexOf("    main.querySelector('#adv-style')",begin);
  runInNewContext(source.slice(begin,end),{st,main:{querySelector:id=>elements[id]},isCurrent:()=>current,normalizeManualInterviewerName,draw:()=>draws++});
  return {input,checkbox,launch,events,stale:()=>{current=false;},draws:()=>draws};
}

test('Fable optional name-use passes strict opt-in into existing Durable preparation',()=>{
  assert.equal(defaultSettings().nameUseCoaching,false);
  const wizard=toWizard({...defaultSettings(),interviewerName:'  Dr. Élan  ',nameUseCoaching:true});
  assert.equal(wizard.interviewerName,'Dr. Élan');assert.equal(wizard.nameUseCoaching,true);
  const input=new DurableStudioSession().sessionInput({wizard});
  assert.equal(input.context.nameUseCoaching.name,'Dr. Élan');
  for(const optIn of [false,undefined,'true',1]){
    const value=toWizard({...defaultSettings(),interviewerName:'Dr. Élan',nameUseCoaching:optIn});
    assert.equal(value.nameUseCoaching,false);
    assert.equal(new DurableStudioSession().sessionInput({wizard:value}).context.nameUseCoaching,null);
  }
});

test('actual Customize handlers normalize, require explicit name opt-in and freeze saved preparation',async()=>{
  const settings=defaultSettings(),h=handlers(settings),writes=[];
  h.checkbox.checked=true;h.events.get('#adv-name-use')({target:h.checkbox});
  assert.equal(h.checkbox.checked,false);assert.match(h.input.error,/optional name first/);
  h.input.value='  Dr. E\u0301lan  ';h.events.get('#adv-name')({target:h.input});
  assert.equal(settings.interviewerName,'Dr. Élan');assert.equal(settings.nameUseCoaching,false);
  h.checkbox.checked=true;h.events.get('#adv-name-use')({target:h.checkbox});
  assert.equal(settings.nameUseCoaching,true);
  const durable=new DurableStudioSession({api:{bootstrap:async()=>({entitlement:{admitted:true}}),createSession:async()=>({id:'saved-session'}),saveResults:async(id,payload)=>{writes.push(payload);return {id};}},recordingFactory:()=>({start:async()=>true,stopAndSeal:async()=>({recording:{id:'recording',durationMs:3000}}),destroy(){}})});
  await durable.bootstrap();await durable.start({stream:{},wizard:toWizard(settings)});
  settings.interviewerName='Different name';settings.nameUseCoaching=false;
  await assert.rejects(durable.prepare({wizard:toWizard(settings)}),/context_changed/);
  await durable.finish({durationMs:3000,events:[]});
  assert.deepEqual(writes[0].nameUseCoaching,{schema:'ivoc.name-use.v1',enabled:true,source:'manual',name:'Dr. Élan',sessionId:'saved-session'});
  h.input.value='';h.events.get('#adv-name')({target:h.input});assert.equal(settings.nameUseCoaching,false);
  h.input.value='Dr.\nInvalid';h.events.get('#adv-name')({target:h.input});assert.equal(h.launch.disabled,true);
  const before={...settings};h.stale();h.input.value='Stale';h.events.get('#adv-name')({target:h.input});
  h.checkbox.checked=true;h.events.get('#adv-name-use')({target:h.checkbox});assert.deepEqual(settings,before);
});

function savedView({verified=true,duration=3000,start=100,end=800}={}){
  const recording={id:'r1',status:'saved',durationMs:duration},session={id:'s1',state:'saved',ownerSubject:'wp:owner',recording};
  const detail={...session,results:{payload:{sessionId:'s1',nameUseCoaching:{schema:'ivoc.name-use.v1',enabled:true,source:'manual',name:'Dr. Sample',sessionId:'s1'}}},spine:{candidateAttribution:{status:verified?'VERIFIED':'UNVERIFIED'},turns:[{speaker:'student',startMs:start,endMs:end,transcript:{canonical_ref:'transcript:test#seg-1',text:'Thank you Dr. Sample. <img src=x>'}}]}};
  return {persisted:true,session,sessionDetail:detail};
}

test('optional Results review uses strict saved-owner evidence, escaped text and bounded paused replay',()=>{
  const saved=savedView(),view=projectSavedAttempt(saved,'wp:owner'),html=nameUseViewMarkup(view);
  assert.match(html,/Possibl/);assert.match(html,/First recording third/);assert.match(html,/#\/film\/s1\?t=0.1/);
  assert.match(html,/&lt;img src=x&gt;/);assert.doesNotMatch(html,/<img|autoplay|Actor name/);
  assert.equal(projectSavedAttempt(saved,'wp:other'),null);
  assert.doesNotMatch(nameUseViewMarkup(null),/#\/film\//);
  const unverified=nameUseViewMarkup(projectSavedAttempt(savedView({verified:false}),'wp:owner'));
  assert.match(unverified,/not assessed/i);assert.doesNotMatch(unverified,/#\/film\/|Thank you/);
  for(const values of [{duration:null},{start:-1},{end:9000}]){
    const noRange=nameUseViewMarkup(projectSavedAttempt(savedView(values),'wp:owner'));
    assert.match(noRange,/Replay range unavailable/);assert.doesNotMatch(noRange,/#\/film\//);
  }
});

test('actual Results continuation rejects an account or Durable swap before rendering',async()=>{
  const results=readFileSync(new URL('../../public/studio-fable/app/results.mjs',import.meta.url),'utf8');
  const begin=results.indexOf('export async function mountResults('),end=results.indexOf('  const {questions}',begin);
  const body=results.slice(begin,end).replace('export ','')+'\nreturn a;\n}';
  for(const field of ['account','durable']){
    let release,rendered=false;const controller={account:{},durable:{}},scope={controller,noop:()=>{},unavailable:()=>{rendered=true;},resolveAttempt:()=>new Promise(resolve=>{release=resolve;})};
    runInNewContext(body+';this.mountResults=mountResults;',scope);
    const pending=scope.mountResults({},'s1');controller[field]={};release(null);await pending;
    assert.equal(rendered,false);
  }
});
