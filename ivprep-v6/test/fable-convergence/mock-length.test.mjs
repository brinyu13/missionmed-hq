import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {defaultSettings,applyPreset,conductorConfig} from '../../public/studio-fable/app/settings/interviewer.mjs';
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
  for(const min of [5,15,25]){
    const h=fixture();h.choose(min);
    const record={durationS:32.851,settings:{...h.st},samples:[],events:[]},saved=sealDerivedEvidence(record);
    assert.equal(h.cfg.durationMin,min);assert.equal(h.st.durationMin,min);assert.equal(saved.settings.durationMin,min);
    assert.equal(conductorConfig(h.st,{durationMin:h.cfg.durationMin}).durationMs,min*60_000);
    assert.equal(record.durationS,32.851);assert.equal(h.draws(),1);
  }
});
test('invalid lengths and a retained handler after leaving cannot change the launch or saved plan',()=>{
  for(const min of [0,10,999,'invalid']){const h=fixture();h.choose(min);assert.equal(h.cfg.durationMin,15);assert.equal(h.st.durationMin,15);assert.equal(h.draws(),0);}
  const h=fixture();h.leave();h.choose(5);assert.equal(h.cfg.durationMin,15);assert.equal(h.st.durationMin,15);assert.equal(h.draws(),0);
});
