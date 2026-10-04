import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSettings,toWizard} from '../../public/studio-fable/app/settings/interviewer.mjs';
import {DurableStudioSession} from '../../public/studio/durable-session.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {ENVIRONMENTS,normalizeEnvironment,selectedEnvironment,environmentProfile,environmentChoicesMarkup,environmentControlsMarkup,mountEnvironmentProfile} from '../../public/studio-fable/app/adapters/environment-profile.mjs';

const main=readFileSync(new URL('../../public/studio-fable/app/main.mjs',import.meta.url),'utf8');

test('selected simulated environment reaches the existing durable session contract',()=>{
  const question={question_id:'CORE-01',canonical_text:'Tell me about yourself.'};
  for(const environment of ['MissionMed','Webex','Zoom','Teams']){
    const wizard=toWizard({...defaultSettings(),environment});
    assert.equal(wizard.environment,environment);
    const input=new DurableStudioSession().sessionInput({question,interviewSet:[question],wizard});
    assert.equal(input.context.environment,environment);
    assert.equal(input.recordingEnabled,true);
  }
});

test('actual setup selection survives redraw/preset/Back state and abandons changed Retry without falsifying saved provenance',()=>{
  const marker="main.querySelector('.ready-card').addEventListener('click', ",from=main.indexOf(marker)+marker.length,to=main.indexOf('\n    });',from);
  const st=defaultSettings(),session={retry:{wizard:{environment:'Webex'}},retryOf:'saved-original'};let current=true,draws=0;
  const handle=vm.runInNewContext('('+main.slice(from,to)+'\n})',{st,session,cfg:{},ENVIRONMENTS,selectedEnvironment,isCurrent:()=>current,draw:()=>draws++});
  handle({target:{closest:()=>({dataset:{environment:'Webex'}})}});
  assert.equal(session.retryOf,'saved-original');assert.equal(st.environment,'Webex');
  assert.equal(toWizard(st,{retry:session.retry}).environment,'Webex');
  handle({target:{closest:()=>({dataset:{environment:'Teams'}})}});
  assert.equal(st.environment,'Teams');assert.equal(session.retry,null);assert.equal(session.retryOf,null);
  // The current app keeps session.settings across route Back/return; no local
  // document, private data cache, provider, or replacement settings owner added.
  const returningSettings=st;assert.equal(toWizard(returningSettings).environment,'Teams');
  handle({target:{closest:()=>({dataset:{environment:'unknown'}})}});assert.equal(st.environment,'Teams');assert.equal(draws,2);
  current=false;handle({target:{closest:()=>({dataset:{environment:'Zoom'}})}});assert.equal(st.environment,'Teams');assert.equal(draws,2);
});
test('whitelist and Retry cannot inject platform/provider configuration',()=>{
  assert.equal(defaultSettings().environment,'MissionMed');
  for(const value of [undefined,null,'zoom','<script>','LiveKit',{},1]){
    assert.equal(normalizeEnvironment(value),'MissionMed');
    assert.equal(toWizard({...defaultSettings(),environment:value}).environment,'MissionMed');
  }
  assert.equal(toWizard(defaultSettings(),{retry:{wizard:{environment:'Zoom'}}}).environment,'Zoom');
  assert.equal(toWizard(defaultSettings(),{retry:{wizard:{environment:'bad'}}}).environment,'MissionMed');
  const choices=environmentChoicesMarkup('Webex');
  for(const name of ENVIRONMENTS)assert.ok(choices.includes('data-environment="'+name+'"'));
  assert.ok(choices.includes('data-environment="Webex" aria-pressed="true"'));
  assert.ok(main.includes('environmentChoicesMarkup(selectedEnvironment(st,session.retry))'));
});
test('versioned profiles distinguish real two-participant geometry and disclose simulation without platform affiliation',()=>{
  for(const name of ENVIRONMENTS){
    const profile=environmentProfile(name);assert.equal(profile.referencePlatform,name);assert.equal(profile.version,'ivoc.meeting-profile.v1');
    if(name==='MissionMed'){assert.equal(profile.simulated,false);continue;}
    const markup=environmentControlsMarkup(profile);
    assert.ok(markup.includes('SIMULATED TRAINING ENVIRONMENT'));assert.ok(markup.includes('Not affiliated'));
    assert.ok(markup.includes('No platform meeting'));assert.ok(markup.includes('IVOC recorder'));
  }
  assert.equal(environmentProfile('Teams').controlPlacement,'top');
  assert.equal(environmentProfile('Webex').controlPlacement,'bottom');
  assert.deepEqual(environmentProfile('Webex').layouts,['Stack','Side by side']);
  assert.deepEqual(environmentProfile('Zoom').layouts,['Speaker','Gallery']);
  const practice=environmentControlsMarkup(environmentProfile('Teams'),{mode:'practice'});
  assert.ok(practice.includes('Self Practice · no AI interviewer'));assert.ok(!practice.includes('data-people-interviewer'));
});
function node(){
  const handlers=new Map();return {dataset:{},hidden:true,disabled:false,textContent:'',value:'',attributes:{},children:[],
    addEventListener:(type,handler)=>handlers.set(type,handler),removeEventListener:(type,handler)=>{if(handlers.get(type)===handler)handlers.delete(type);},
    dispatch(type,event={}){handlers.get(type)?.(event);},setAttribute(name,value){this.attributes[name]=value;},append(child){this.children.push(child);},focus(){this.focused=true;}};
}
function profileFixture(name){
  const selectors=['[data-environment-layout]','[data-self-view]','[data-people]','[data-close-people]','#meeting-people','[data-people-interviewer]','.self-view-hidden','[data-environment-bar]','[data-environment-controls]','#controls'];
  const nodes=Object.fromEntries(selectors.map(selector=>[selector,node()]));
  if(name!=='Teams')for(const selector of ['[data-people]','[data-close-people]','#meeting-people','[data-people-interviewer]'])nodes[selector]=null;
  if(name==='MissionMed')nodes['[data-self-view]']=null;
  let current=true,live=false;const room={dataset:{},querySelector:selector=>nodes[selector]};
  const dispose=mountEnvironmentProfile(room,{profile:environmentProfile(name),isCurrent:()=>current,isLive:()=>live,interviewerRole:'Faculty'});
  return {room,nodes,dispose,start(){live=true;dispose.refresh();},finish(){live=false;dispose.refresh();},depart(){current=false;}};
}
test('actual layout/self-view handlers mutate only presentation; preview cannot be hidden before live',()=>{
  for(const name of ['Webex','Zoom']){
    const f=profileFixture(name),self=f.nodes['[data-self-view]'],layout=f.nodes['[data-environment-layout]'];
    assert.equal(self.disabled,true);self.dispatch('click');assert.equal(f.room.dataset.selfView,'true');
    f.start();assert.equal(self.disabled,false);
    const profile=environmentProfile(name);layout.value=profile.layouts[1];layout.dispatch('change');assert.equal(f.room.dataset.layout,profile.layouts[1]);
    self.dispatch('click');assert.equal(f.room.dataset.selfView,'false');assert.equal(f.nodes['.self-view-hidden'].hidden,false);
    self.dispatch('click');assert.equal(f.room.dataset.selfView,'true');
    layout.value='fake';layout.dispatch('change');assert.equal(f.room.dataset.layout,profile.layouts[1]);
    f.finish();assert.equal(self.disabled,true);assert.equal(f.room.dataset.meetingLive,'false');
    assert.equal(f.nodes['[data-environment-controls]'].children[0],f.nodes['#controls']);
    f.depart();layout.value=profile.layouts[0];layout.dispatch('change');assert.equal(f.room.dataset.layout,profile.layouts[1]);
    f.dispose();self.dispatch('click');assert.equal(f.room.dataset.selfView,'true');
  }
});
test('Teams rehomes existing controls once and People names only the actual two roles; close/Escape returns focus',()=>{
  const f=profileFixture('Teams'),people=f.nodes['[data-people]'],panel=f.nodes['#meeting-people'];
  assert.equal(f.nodes['[data-environment-bar]'].children[0],f.nodes['#controls']);
  assert.equal(f.nodes['[data-people-interviewer]'].textContent,'Faculty');
  people.dispatch('click');assert.equal(panel.hidden,false);assert.equal(people.attributes['aria-expanded'],'true');
  panel.dispatch('keydown',{key:'Escape'});assert.equal(panel.hidden,true);assert.equal(people.focused,true);
  people.dispatch('click');f.nodes['[data-close-people]'].dispatch('click');assert.equal(panel.hidden,true);
  f.dispose();people.dispatch('click');assert.equal(panel.hidden,true);
});
test('profile boundary owns no runtime and Room preserves existing stage/overlay/session integration',()=>{
  const adapter=readFileSync(new URL('../../public/studio-fable/app/adapters/environment-profile.mjs',import.meta.url),'utf8');
  assert.ok(!/getUserMedia|MediaRecorder|RTCPeerConnection|\.srcObject\s*=|\.setEnabled\(|\.connect\(|\.release\(|\.startSession\(/.test(adapter));
  const room=readFileSync(new URL('../../public/studio-fable/app/room.mjs',import.meta.url),'utf8');
  assert.ok(room.includes("environmentProfile(selectedEnvironment(settings,session.retry))"));
  assert.ok(room.includes("controller.mountVideo($('stage'),$('overlay'))"));
  assert.ok(room.includes('disposeEnvironment.refresh()'));assert.ok(room.includes('disposeEnvironment();'));
  const css=readFileSync(new URL('../../public/studio-fable/styles/room.css',import.meta.url),'utf8');
  assert.ok(css.includes('[data-self-view="false"] .stage video'));
  assert.ok(css.includes('[data-meeting-live="true"]'));assert.ok(css.includes('@media(max-width:760px)'));
});
