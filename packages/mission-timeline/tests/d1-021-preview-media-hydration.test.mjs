import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {timelineRenderSignature,timelineWithLorPresentation} from '../web/js/407f-engineering-adapter.js';
import {serializeFounderPresentation,FOUNDER_PRESENTATION_SERIALIZER} from '../web/js/presentation/founder-presentation-serializer.js';
import {enhanceBuilderPreviewSvg} from '../web/js/uxr-002/builder-preview.js';

const adapter=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');
const fixture=JSON.parse(await readFile(new URL('fixtures/d1-timeline-astra-021/golden2-media-preview.json',import.meta.url),'utf8'));
const imageUrls=html=>[...String(html).matchAll(/<image\b[^>]*\shref="(blob:[^"]+)"/g)].map(match=>match[1]).sort();
function harness({canMutate=true}={}){
  const timeline=structuredClone(fixture.document),urls=new Map(),hosts=new Map();
  const host=()=>({dataset:{},html:'',replacements:0,querySelector(){return this.html.includes('data-builder-preview-surface')?{}:null;},replaceChildren(...children){this.html=children.join('');this.replacements++;}});
  for(const id of ['boardCommand','boardWizard','lightbox'])hosts.set(id,host());
  const document={getElementById:id=>hosts.get(id)||null,querySelector:selector=>selector==='[data-builder-preview-canvas]'?hosts.get('lightbox'):null,createElement(){return{childNodes:[],set innerHTML(value){this.childNodes=[value];}};}};
  let canvasRenders=0,hitRefreshes=0;
  const context={Map,document,store:{document:timeline,entitlement:{canMutate}},mediaUrls:{get:id=>urls.get(String(id))||null},timelineRenderSignature,timelineWithLorPresentation,serializeFounderPresentation,FOUNDER_PRESENTATION_SERIALIZER,enhanceBuilderPreviewSvg,currentMonth:()=> '2026-09',toastStudentError(error){throw error;},canvasController:{render(){canvasRenders++;}},requestAnimationFrame(callback){callback();},onBuilderPreviewResize(){hitRefreshes++;},productionRuntime:null,announceGlobal(){},console};
  vm.createContext(context);
  vm.runInContext(adapter.slice(adapter.indexOf('  const liveMediaById='),adapter.indexOf('  const exportAdapter=')),context);
  vm.runInContext(adapter.slice(adapter.indexOf('  const builderPreviewKernel='),adapter.indexOf('  const queueBuilderEmbeddedPreview=')),context);
  const mount=(surface)=>vm.runInContext(`mountBuilderPreview(document.getElementById(${JSON.stringify(surface==='home'?'boardCommand':surface==='embedded'?'boardWizard':'lightbox')}),{surface:${JSON.stringify(surface)}})`,context);
  const hydrate=()=>{for(const asset of timeline.advanced.media)urls.set(asset.id,`blob:synthetic-${asset.id}`);};
  return{timeline,urls,hosts,context,mount,hydrate,counters:()=>({canvasRenders,hitRefreshes})};
}

test('021 actual Home and Builder mount replace stale golden photo placeholders after URL hydration without a factual edit',()=>{
  const h=harness(),before=structuredClone(h.timeline),signature=timelineRenderSignature(h.timeline);
  for(const surface of ['home','embedded','lightbox'])assert.equal(h.mount(surface),true);
  for(const host of h.hosts.values())assert.equal(imageUrls(host.html).length,0);
  h.hydrate();
  assert.equal(timelineRenderSignature(h.timeline),signature,'Hydration must not masquerade as a document change');
  for(const surface of ['home','embedded','lightbox'])assert.equal(h.mount(surface),true,'Hydration must invalidate the already mounted preview');
  const expected=h.timeline.advanced.media.map(asset=>`blob:synthetic-${asset.id}`).sort();
  for(const host of h.hosts.values())assert.deepEqual(imageUrls(host.html),expected,'All three exact source photos must fill their original frames');
  assert.match(h.hosts.get('boardCommand').html,/data-interactive="false"/);
  assert.match(h.hosts.get('boardWizard').html,/data-interactive="true"/);
  for(const surface of ['home','embedded','lightbox'])assert.equal(h.mount(surface),false,'Warm unchanged preview must retain its DOM');
  h.timeline.updatedAt='2099-01-01T00:00:00.000Z';
  assert.equal(h.mount('home'),false,'Save timestamps alone must not repaint the preview');
  delete h.timeline.updatedAt;delete before.updatedAt;
  assert.deepEqual(h.timeline,before,'Facts, crops and presentation placements must not be mutated by rendering');
});

test('021 actual asynchronous media hydration completion refreshes Home, Builder and open full preview',async()=>{
  const h=harness();
  for(const surface of ['home','embedded','lightbox'])h.mount(surface);
  h.context.mediaUrls.hydrate=async()=>{await Promise.resolve();h.hydrate();return true;};
  const start=adapter.indexOf('    mediaUrls.hydrate(store,store.document,{');
  const end=adapter.indexOf('\n  }\n  if(document.getElementById("export407F"))',start);
  assert.ok(start>0&&end>start);
  await vm.runInContext(adapter.slice(start,end).trim().replace(/;$/,''),h.context);
  for(const host of h.hosts.values())assert.equal(imageUrls(host.html).length,3,'Hydration callback must refresh every mounted preview surface');
  assert.equal(h.counters().canvasRenders,1);
  assert.equal(h.counters().hitRefreshes,1,'Refreshed interactive previews reuse the existing hit-target update');
});

test('021 hydrated preview keeps read-only semantics and interview-safe media filtering',()=>{
  const h=harness({canMutate:false});
  const privateFrame=h.timeline.mediaItems[1];
  privateFrame.visibilityState='ADVISOR_ONLY';
  h.hydrate();
  for(const surface of ['home','embedded','lightbox'])h.mount(surface);
  for(const host of h.hosts.values()){
    assert.equal(imageUrls(host.html).length,2);
    assert.ok(!imageUrls(host.html).includes(`blob:synthetic-${privateFrame.mediaId}`));
    assert.match(host.html,/data-interactive="false"/);
    assert.doesNotMatch(host.html,/role="button" tabindex=/);
  }
});
