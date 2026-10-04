import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {defaultSettings,applyPreset,conductorConfig} from '../../public/studio-fable/app/settings/interviewer.mjs';
import * as interviewer from '../../public/studio-fable/app/settings/interviewer.mjs';
import {sealDerivedEvidence} from '../../public/studio-fable/app/adapters/derived-evidence.mjs';

const source=readFileSync(new URL('../../public/studio-fable/app/main.mjs',import.meta.url),'utf8');
const marker="main.querySelector('.ready-card').addEventListener('click', ";
const start=source.indexOf(marker)+marker.length,end=source.indexOf('\n    });',start);
const handlerSource=source.slice(start,end)+'\n}';
function fixture(){
  const st=defaultSettings(),cfg={durationMin:15};let current=true,draws=0;
  const handle=vm.runInNewContext('('+handlerSource+')',{st,cfg,applyPreset,isCurrent:()=>current,draw:()=>{draws++;}});
  return {st,cfg,draws:()=>draws,leave:()=>{current=false;},choose:min=>handle({target:{closest:()=>({dataset:{min:String(min)}})}})};
}
test('actual Length handler retains the chosen plan in observation and saved settings independently of recorded duration',()=>{
  for(const min of [5,10,15,25]){
    const h=fixture();h.choose(min);
    const record={durationS:32.851,settings:{...h.st},samples:[],events:[]},saved=sealDerivedEvidence(record);
    assert.equal(h.cfg.durationMin,min);assert.equal(h.st.durationMin,min);assert.equal(saved.settings.durationMin,min);
    assert.equal(conductorConfig(h.st,{durationMin:h.cfg.durationMin}).durationMs,min*60_000);
    assert.equal(record.durationS,32.851);assert.equal(h.draws(),1);
  }
});
test('invalid lengths and a retained handler after leaving cannot change the launch or saved plan',()=>{
  for(const min of [0,7,999,'invalid']){const h=fixture();h.choose(min);assert.equal(h.cfg.durationMin,15);assert.equal(h.st.durationMin,15);assert.equal(h.draws(),0);}
  const h=fixture();h.leave();h.choose(5);assert.equal(h.cfg.durationMin,15);assert.equal(h.st.durationMin,15);assert.equal(h.draws(),0);
});
test('required four durations and the bounded target are visible controls, not hidden labels',()=>{
  assert.ok(/\[5,\s*10,\s*15,\s*25\]\.map/.test(source));
  assert.ok(/<input id="adv-target" type="number" min="1" max="30"/.test(source));
});
test('Advanced target resolves independently from selected pool while untouched setup follows that pool',()=>{
  const resolve=interviewer.resolveMockQuestionTarget;
  assert.equal(typeof resolve,'function');
  assert.equal(resolve(12,5),12);assert.equal(resolve(1,5),1);assert.equal(resolve(30,5),30);
  for(const value of [null,undefined,0,31,2.5,Infinity,'invalid'])assert.equal(resolve(value,3),3);
});
test('actual target change handler retains1–30, rejects invalid edits and cannot change a departed setup',()=>{
  const targetMarker="main.querySelector('#adv-target').addEventListener('change', ";
  const from=source.indexOf(targetMarker)+targetMarker.length,to=source.indexOf('\n    });',from);
  const handler=source.slice(from,to)+'\n}';
  for(const value of ['1','12','30','','0','31','2.5','invalid']){
    const cfg={targetQuestions:null},st=defaultSettings(),set=[1,2,3],session={retry:{id:'own-retry'},retryOf:'own-retry'};let draws=0,current=true;
    const handle=vm.runInNewContext('('+handler+')',{cfg,st,set,session,isCurrent:()=>current,resolveMockQuestionTarget:interviewer.resolveMockQuestionTarget,draw:()=>draws++});
    const input={value};handle({target:input});
    const valid=['1','12','30'].includes(value);
    assert.equal(cfg.targetQuestions,valid?Number(value):null);assert.equal(draws,valid?1:0);
    if(valid){assert.equal(st.targetQuestions,Number(value));assert.equal(sealDerivedEvidence({settings:st}).settings.targetQuestions,Number(value));}
    else assert.equal(input.value,'3');
    assert.equal(session.retryOf,valid&&Number(value)!==1?null:'own-retry');
    assert.equal(session.retry?.id??null,valid&&Number(value)!==1?null:'own-retry');
    current=false;handle({target:{value:'25'}});assert.equal(cfg.targetQuestions,valid?Number(value):null);
  }
});
test('Retry starts at one without leaving an implicit target when its pool becomes a new Mock',()=>{
  assert.ok(/session\.config\.targetQuestions=null;/.test(source));
  const changeMarker='const questionsChanged=',from=source.indexOf(changeMarker)+changeMarker.length,to=source.indexOf(';\n    mountTray',from);
  const resolve=interviewer.resolveMockQuestionTarget;
  for(const explicit of [null,1]){
    const cfg={targetQuestions:explicit},session={retry:{questionId:'CORE-01'},retryOf:'own-retry'},set=[{question_id:'CORE-01'}];let target=null;
    const change=vm.runInNewContext('('+source.slice(from,to)+')',{session,set,draw:()=>{target=resolve(cfg.targetQuestions,set.length);}});
    assert.equal(resolve(cfg.targetQuestions,set.length),1);
    set.push({question_id:'CORE-02'},{question_id:'CORE-03'});change();
    assert.equal(session.retry,null);assert.equal(session.retryOf,null);assert.equal(target,explicit??3);
  }
});
