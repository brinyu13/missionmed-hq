import test from 'node:test';
import assert from 'node:assert/strict';
import {renderFilmLanes,LiveRecorder} from '../../public/studio-fable/app/instruments/flight-recorder.mjs';
import {sealDerivedEvidence} from '../../public/studio-fable/app/adapters/derived-evidence.mjs';

function fixture({samples:inputSamples,events=[{t:6,kind:'smile',label:'Smile pattern'}],durationS=23.161}={}){
  const listeners=new Map(),seeks=[],clock={},heads=[];
  const context=new Proxy({}, {get:(_target,key)=>key==='fillStyle'||key==='font'?undefined:()=>{},set:()=>true});
  const canvas={clientWidth:200,clientHeight:40,getContext:()=>context};
  const track={getBoundingClientRect:()=>({left:100,width:200}),append:head=>heads.push(head)};
  const host={innerHTML:'',querySelector:selector=>selector==='[data-voice]'?canvas:selector==='#film-clock'?clock:null,
    querySelectorAll:()=>[track],addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}};
  const playback={currentTime:0,addEventListener:(name,fn)=>listeners.set('video:'+name,fn),removeEventListener:(name,fn)=>{if(listeners.get('video:'+name)===fn)listeners.delete('video:'+name);}};
  const priorDocument=globalThis.document,priorRatio=globalThis.devicePixelRatio;
  globalThis.document={createElement:()=>({style:{}})};globalThis.devicePixelRatio=1;
  const samples=inputSamples||[{t:14.8,hands:'RIGHT',state:'ANSWERING',presence:'TRACKED',signalGap:false},{t:15.3,hands:'RIGHT',state:'ANSWERING',presence:'TRACKED',signalGap:false}];
  const lanes=renderFilmLanes(host,{samples,events,durationS,playback,onSeek:t=>seeks.push(t)});
  const click=(element,clientX=236)=>listeners.get('click')({target:{closest:selector=>selector==='[data-seek]'?element:selector==='[data-track]'?track:null},clientX});
  return{host,listeners,seeks,click,lanes,restore(){lanes.destroy();if(priorDocument===undefined)delete globalThis.document;else globalThis.document=priorDocument;if(priorRatio===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=priorRatio;}};
}
test('continuous Film marks use native buttons and seek from their own start with two-second lead-in',()=>{
  const f=fixture();
  try{
    const run=f.host.innerHTML.match(/<(button|span)\b([^>]*class="run one"[^>]*)>/);
    const seek=run[2].match(/data-seek="([^"]+)"/);
    f.click(seek?{dataset:{seek:seek[1]}}:null);
    assert.equal(f.seeks[0],12.8);
    assert.equal(run[1],'button');assert.match(run[2],/type="button"/);
    assert.match(run[2],/aria-label="hands RIGHT/);
    assert.ok(run[2].includes(`left:${14.8/23.161*100}%;width:${(15.3-14.8+.5)/23.161*100}%`));
  }finally{f.restore();}
});
test('decimated observed bands do not visually fill unknown intervals with minimum-percent widths',()=>{
  const samples=Array.from({length:601},(_,t)=>({t,hands:'NONE',presence:'TRACKED',state:'ANSWERING',speaking:false,signalGap:false}));
  const f=fixture({samples,durationS:600});
  try{
    const bands=[...f.host.innerHTML.matchAll(/<button[^>]*class="run (none|tracked)"[^>]*style="left:([^;]+);width:([^"]+)"/g)];
    assert.equal(bands.length,1202);
    assert.ok(bands.every(b=>Number.parseFloat(b[3])<=.5/600*100));
    assert.ok(bands.filter(b=>b[1]==='none').every((b,i,list)=>i===list.length-1||Number.parseFloat(b[2])+Number.parseFloat(b[3])<Number.parseFloat(list[i+1][2])));
    assert.doesNotMatch(f.host.innerHTML,/hands NONE · 00:00–10:00/);
  }finally{f.restore();}
});
test('existing event lead-in, exact empty-track scrubbing, start clamp and cleanup remain unchanged',()=>{
  const f=fixture();
  try{
    f.click({dataset:{seek:'6'}});assert.equal(f.seeks.at(-1),4);
    f.click(null,250);assert.equal(f.seeks.at(-1),23.161*.75);
    f.click({dataset:{seek:'1'}});assert.equal(f.seeks.at(-1),0);
    f.lanes.destroy();assert.equal(f.listeners.size,0);
  }finally{f.restore();}
});
test('sealed overlap observation renders a truthful accessible Film pin seeking to receipt time, not an audio boundary',()=>{
  const cold=JSON.parse(JSON.stringify(sealDerivedEvidence({events:[{t:37.25,kind:'overlap',label:'Transcript overlap observed — interruption unverified.',state:'MESSAGE_RECEIPT'}]})));
  const f=fixture({events:cold.events,durationS:60});
  try{
    const pin=f.host.innerHTML.match(/<button[^>]*class="pin overlap"[^>]*>/)?.[0];
    assert.ok(pin);assert.match(pin,/data-seek="37.25"/);assert.match(pin,/aria-label="00:37 Transcript overlap observed — interruption unverified./);
    f.click({dataset:{seek:'37.25'}});assert.equal(f.seeks.at(-1),35.25);
    assert.doesNotMatch(pin,/confirmed|truncated|heard|interruption verified/);
  }finally{f.restore();}
});
test('actual Live Recorder draws the overlap glyph from receipt events without re-timing the voice traces',()=>{
  const prior={addEventListener:globalThis.addEventListener,removeEventListener:globalThis.removeEventListener,devicePixelRatio:globalThis.devicePixelRatio},glyphs=[];
  const ctx=new Proxy({}, {get:()=>()=>{},set:()=>true}),eventCtx=new Proxy({}, {get:(_target,key)=>key==='fillText'?text=>glyphs.push(text):()=>{},set:()=>true});
  const canvas={clientWidth:200,clientHeight:40,getContext:()=>ctx},evCanvas={clientWidth:200,clientHeight:12,getContext:()=>eventCtx};
  globalThis.addEventListener=()=>{};globalThis.removeEventListener=()=>{};globalThis.devicePixelRatio=1;
  const root={querySelector:selector=>selector==='#fr-canvas'?canvas:selector==='#fr-events'?evCanvas:selector==='#fr-clock'?{}:null};
  let recorder;
  try{
    recorder=new LiveRecorder(root);recorder.setData([],[{t:37.25,kind:'overlap'}]);recorder.tick(40);assert.ok(glyphs.includes('≋'));assert.equal(recorder.events[0].t,37.25);
  }finally{recorder?.destroy();for(const [key,value]of Object.entries(prior)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
