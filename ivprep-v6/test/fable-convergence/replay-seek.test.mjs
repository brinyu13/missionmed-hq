import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {validReplaySeek} from '../../public/studio-fable/app/adapters/saved-review.mjs';

const source=readFileSync(new URL('../../public/studio-fable/app/results.mjs',import.meta.url),'utf8');
const seekCode=source.slice(source.indexOf('  const seek=value=>'),source.indexOf('\n  let lanes=null;',source.indexOf('  const seek=value=>')));
function mounted({current=true,video=true}={}){
  const calls=[];let time=11,paused=false;
  const playback=video?{pause(){calls.push('pause');paused=true;},get currentTime(){return time;},set currentTime(value){calls.push(['seek',value]);time=value;},play(){throw new Error('Evidence seek must never autoplay');}}:null;
  const context={current:()=>current,video:playback,a:{durationS:32.851},validReplaySeek};
  runInNewContext(seekCode+';this.seek=seek;',context);
  return{seek:context.seek,calls,get time(){return time;},get paused(){return paused;}};
}

test('actual Film seek pauses playing private video before moving to a bounded evidence moment',()=>{
  const view=mounted();view.seek('4.025');
  assert.deepEqual(view.calls,['pause',['seek',4.025]]);
  assert.equal(view.paused,true);assert.equal(view.time,4.025);
  view.seek(0);assert.equal(view.paused,true);assert.equal(view.time,0);
});

test('invalid/out-of-range citation cannot pause or move existing playback',()=>{
  for(const value of [null,undefined,'','not-a-time',NaN,Infinity,-1,32.852]){
    const view=mounted();view.seek(value);assert.deepEqual(view.calls,[]);assert.equal(view.time,11);assert.equal(view.paused,false);
  }
});

test('disposed/replaced account view and unavailable private video cannot seek',()=>{
  for(const options of [{current:false},{video:false}]){
    const view=mounted(options);view.seek(4);assert.deepEqual(view.calls,[]);
  }
});

test('moments, transcript/hook buttons, Flight Recorder and route citations share the same guarded seek',()=>{
  assert.match(source,/renderFilmLanes\(host,\{[^\n]*onSeek:seek/);
  assert.ok(source.includes("if(b&&!b.closest('#film-recorder'))seek(b.dataset.seek)"));
  assert.match(source,/loaded=\(\)=>\{if\(start!==null\)seek\(start\);\}/);
});
