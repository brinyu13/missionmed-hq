import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {arrivalDelaySeconds,waitForInterviewEntry,mockSetupRoute,mockCalibrationRoute} from '../../public/studio-fable/app/adapters/interview-entry.mjs';

test('calibration and Back preserve explicit opt-out and retry, not arbitrary destinations',()=>{
  const params=new URLSearchParams('program=none&retry=synthetic-attempt&return=https://evil.invalid&min=5');
  assert.equal(mockSetupRoute(params),'#/mock?program=none&retry=synthetic-attempt');
  const calibration=mockCalibrationRoute(params);
  assert.equal(calibration,'#/devices?return=mock&program=none&retry=synthetic-attempt');
  assert.equal(mockSetupRoute(new URLSearchParams(calibration.split('?')[1])),mockSetupRoute(params));
  assert.equal(mockSetupRoute(new URLSearchParams('program=invalid&retry=https://evil.invalid')),'#/mock');
  const main=readFileSync(new URL('../../public/studio-fable/app/main.mjs',import.meta.url),'utf8');
  const room=readFileSync(new URL('../../public/studio-fable/app/room.mjs',import.meta.url),'utf8');
  assert.match(main,/href="#\/mock\?program=none">General mock instead/);
  assert.ok(main.includes('session.setupReturnHash=mockSetupRoute(params,session.retry?.id||null)'));
  assert.ok(main.includes('mockCalibrationRoute(params,session.retry?.id||null)'));
  assert.equal(mockSetupRoute(params,null),'#/mock?program=none');
  assert.equal(mockCalibrationRoute(params,null),'#/devices?return=mock&program=none');
  assert.ok(room.includes("session.setupReturnHash||'#/mock'"));
});

function clock(options={}){
  let now=0,timer=null,live=true;
  const ticks=[],abort=new AbortController();
  const promise=waitForInterviewEntry({...options,signal:abort.signal,isCurrent:()=>live,now:()=>now,
    schedule:fn=>(timer=fn,1),cancel:()=>{timer=null;},onTick:value=>ticks.push(value)});
  return {promise,ticks,abort,advance(ms){now+=ms;const next=timer;timer=null;next?.();},leave(){live=false;},pending:()=>Boolean(timer)};
}
test('immediate arrival has the required deliberate 10-second countdown',async()=>{
  const c=clock();assert.deepEqual(c.ticks[0],{phase:'countdown',seconds:10});
  c.advance(1000);assert.equal(c.ticks.at(-1).seconds,9);
  c.advance(8999);assert.equal(c.ticks.at(-1).seconds,1);
  c.advance(1);await c.promise;assert.equal(c.pending(),false);
});
test('delayed arrival waits exactly 30 seconds before the same countdown',async()=>{
  const c=clock({delaySeconds:30});assert.deepEqual(c.ticks[0],{phase:'waiting',seconds:30});
  c.advance(29999);assert.equal(c.ticks.at(-1).seconds,1);
  c.advance(1);assert.deepEqual(c.ticks.at(-1),{phase:'countdown',seconds:10});
  c.advance(10000);await c.promise;assert.equal(c.pending(),false);
});
test('leaving, aborting, or an account change cancels without starting',async()=>{
  for(const action of ['abort','leave']){
    const c=clock({delaySeconds:30});const rejected=assert.rejects(c.promise,{name:'AbortError'});
    if(action==='abort')c.abort.abort();else{c.leave();c.advance(100);}
    await rejected;assert.equal(c.pending(),false);
  }
  const signal=AbortSignal.abort();
  await assert.rejects(waitForInterviewEntry({signal}),{name:'AbortError'});
});
test('only the supported delay is accepted; late timer delivery does not extend it',async()=>{
  for(const value of [undefined,-1,45,'30',Infinity])assert.equal(arrivalDelaySeconds({arrivalDelaySeconds:value}),0);
  assert.equal(arrivalDelaySeconds({arrivalDelaySeconds:30}),30);
  const c=clock({delaySeconds:30});c.advance(60000);await c.promise;
});
test('room gates canonical start and embodiment construction after countdown and rechecks devices',()=>{
  const src=readFileSync(new URL('../../public/studio-fable/app/room.mjs',import.meta.url),'utf8');
  const start=src.slice(src.indexOf('  async function start()'),src.indexOf("  $('connect-real').addEventListener"));
  assert.ok(start.indexOf('await waitForInterviewEntry')<start.indexOf('new EmbodimentRenderer'));
  assert.ok(start.indexOf('await waitForInterviewEntry')<start.indexOf('controller.startSession'));
  assert.equal((start.match(/await awaitVisibleCamera/g)||[]).length,2);
  assert.equal((start.match(/assertMicrophoneReady/g)||[]).length,2);
  assert.match(src,/disposed=true;entryAbort\?\.abort\(\)/);
  assert.match(src,/entryAbort\?\.abort\(\);void controller.release\('left_before_start'\)/);
});
