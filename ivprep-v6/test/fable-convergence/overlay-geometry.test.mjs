import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../../public/ivoc-standalone/app/real-runtime.mjs',import.meta.url),'utf8');
const start=source.indexOf('function overlayVideoRect'),end=source.indexOf('\nfunction corridorScore',start);
const rect=runInNewContext(source.slice(start,end).replace('export ','')+';overlayVideoRect');
test('actual overlay mapping follows centered contain/cover and preserves intrinsic aspect',()=>{
  for(const [w,h] of [[640,360],[510,480],[280,158],[360,480],[1728,1117]]){
    for(const fit of ['contain','cover']){
      const r=rect(640,480,w,h,fit);
      assert.ok(Math.abs(r.width/r.height-4/3)<1e-10);
      assert.equal(r.left,(w-r.width)/2);assert.equal(r.top,(h-r.height)/2);
      assert.ok(fit==='contain'?r.width<=w+1e-9&&r.height<=h+1e-9:r.width>=w-1e-9&&r.height>=h-1e-9);
    }
  }
  assert.equal(rect(0,480,640,360),null);
});
test('DPR, camera switch and resize cannot retain a detached cover overlay',()=>{
  assert.match(source,/getComputedStyle\(this.video\).objectFit/);
  assert.match(source,/this.video\?\.videoWidth \|\| bitmap.width/);
  assert.match(source,/ResizeObserver\(\(\) => this.clearOverlay\(\)\)/);
  assert.match(source,/overlayResizeObserver\?\.disconnect\(\)/);
  const drawStart=source.indexOf('  drawOverlay('),drawEnd=source.indexOf('\n  setOverlayVisibility',drawStart);
  let draws=[];const canvas={clientWidth:640,clientHeight:360,width:0,height:0,getContext:()=>({clearRect(){},drawImage:(...args)=>draws.push(args)})};
  const method=runInNewContext('('+source.slice(drawStart,drawEnd).trim().replace(/^drawOverlay/,'function')+')',{overlayVideoRect:rect,globalThis:{devicePixelRatio:2},getComputedStyle:()=>({objectFit:'contain'}),setTimeout:()=>1,clearTimeout(){},OVERLAY_STALE_AFTER_MS:1500});
  method.call({overlayCanvas:canvas,video:{videoWidth:640,videoHeight:480},clearOverlay(){}},{bitmap:{width:640,height:480}});
  assert.equal(canvas.width,1280);assert.equal(canvas.height,720);
  assert.deepEqual(draws[0].slice(1),[160,0,960,720]);
});
