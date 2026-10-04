import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../../public/studio-fable/app/calibration.mjs',import.meta.url),'utf8');
const stepsSource=source.slice(source.indexOf('const STEPS = ['),source.indexOf('\nconst INSTRUMENTS'));
const frameSource=source.slice(source.indexOf('  function onFrame(f) {'),source.indexOf("\n  $('connect-real')"));
const entrySource=source.slice(source.indexOf('  function enterStep() {'),source.indexOf("\n  $('next-step')"));
const deviceSource=source.slice(source.indexOf('  function resetRehearsal(){'),source.indexOf('  function completeReadiness(){'));

function rehearsal(){
  const needle={dataset:{held:'false'}},ctx={started:true,pauseMs:0,pauseStartedAt:null,pauseLastAt:null,paceHeld:false,volSeen:new Set()};
  const scope={ctx,deviceSwitching:false,resolved:{},main:{querySelector:()=>needle},rails:{ingest(){}},history:{push(){},samples:[]},engine:{beginAnswer(){}},
    renderCalibrationRecord(){},renderSteps(){},evaluate(){}};
  const run=vm.runInNewContext(stepsSource+`
    let latest=null,lastT=0,stepIndex=STEPS.findIndex(s=>s.id==='pause');
    const steps=STEPS;
    ${frameSource}
    ${entrySource}
    ${deviceSource}
    ({sample:onFrame,pass:()=>steps[stepIndex].check(latest,ctx),enter:enterStep,
      device:()=>{resetRehearsal();ctx.started=true;stepIndex=STEPS.findIndex(s=>s.id==='pause');}});
  `,scope);
  return{ctx,pass:run.pass,enter:run.enter,device:run.device,sample:(t,speaking=false,held=true)=>{
    needle.dataset.held=String(held);run.sample({t,speaking});return run.pass();
  }};
}

test('actual rehearsal rejects several short pauses separated by speech',()=>{
  const r=rehearsal();
  for(const [t,speaking]of [[0,true],[.8,false],[1,true],[1.8,false],[2,true],[2.8,false],[3,true],[3.8,false]])r.sample(t,speaking);
  assert.equal(r.pass(),false);assert.equal(r.ctx.pauseMs,0);
});
test('actual rehearsal requires a continuous three seconds after the first quiet held observation',()=>{
  const r=rehearsal();
  for(const t of [0,.5,1,1.5,2,2.5])assert.equal(r.sample(t),false);
  assert.equal(r.sample(3),true);assert.equal(r.ctx.pauseMs,3000);
  assert.equal(r.sample(3.1,true),false);assert.equal(r.ctx.pauseMs,0);assert.equal(r.ctx.paceHeld,false);
});
for(const [name,interrupt]of [
  ['speech',r=>r.sample(2.1,true)],['lost pace hold',r=>r.sample(2.1,false,false)],
  ['unknown speech state',r=>r.sample(2.1,null)],['missing clock',r=>r.sample(NaN)],
  ['backwards clock',r=>r.sample(1)],['missing producer interval',r=>r.sample(4)],
])test('actual rehearsal restarts its evidence interval after '+name,()=>{
  const r=rehearsal();for(const t of [0,.5,1,1.5,2])r.sample(t);
  interrupt(r);assert.equal(r.pass(),false);assert.equal(r.ctx.pauseMs,0);
  assert.equal(r.sample(4.5),false);
});
test('actual step entry and successful device replacement cannot inherit a quiet interval',()=>{
  for(const reset of ['enter','device']){
    const r=rehearsal();for(const t of [0,.5,1,1.5,2,2.5,3])r.sample(t);
    assert.equal(r.pass(),true);r[reset]();assert.equal(r.pass(),false);assert.equal(r.ctx.pauseMs,0);assert.equal(r.ctx.paceHeld,false);
    assert.equal(r.sample(3.5),false);
  }
});
