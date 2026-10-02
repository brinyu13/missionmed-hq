import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');
const start=source.indexOf('  const mountBuilderPreview='),end=source.indexOf('  const renderBuilderEmbeddedPreview=',start);
function harness(){
 const store={document:{id:'A',studentOwnerId:'ownerA'},entitlement:{canMutate:true}};const runtime={identity:{principalId:'viewerA'}};let fail=false;
 const dom={createElement:()=>({dataset:{},setAttribute(){},set innerHTML(value){this.childNodes=[{surface:true,html:value}];}})};
 const host={dataset:{},children:[],querySelector(selector){return this.children.find(n=>selector.includes('recovery')?n.dataset?.builderPreviewRecovery:n.surface)||null;},append(n){this.children.push(n);},replaceChildren(...children){this.children=children;}};
 const mount=new Function('store','productionRuntime','document','timelineRenderSignature','liveMediaById','builderPreviewKernel','toastStudentError','FOUNDER_PRESENTATION_SERIALIZER',source.slice(start,end)+'return mountBuilderPreview;')(store,runtime,dom,d=>d.id,()=>new Map(),()=>{if(fail)throw Error('synthetic');return{html:store.document.id};},()=>{},'test');
 return{store,runtime,host,mount,setFailure:()=>{fail=true;}};
}
test('a failed replacement clears the previously displayed document',()=>{
 const h=harness();h.mount(h.host);h.store.document={id:'B',studentOwnerId:'ownerB'};h.setFailure();h.mount(h.host);assert.equal(h.host.querySelector('[data-builder-preview-surface]'),null);assert.equal(h.host.dataset.builderPreviewSignature,undefined);assert.match(h.host.children[0].textContent,/could not be displayed/);
});
test('same document failure keeps last good content with a visible stale notice',()=>{
 const h=harness();h.mount(h.host);h.setFailure();h.mount(h.host,{force:true});assert.ok(h.host.querySelector('[data-builder-preview-surface]'));assert.match(h.host.querySelector('[data-builder-preview-recovery]').textContent,/last successfully rendered version/);
});
test('an owner change with the same document ID cannot reuse the old preview',()=>{
 const h=harness();h.mount(h.host);h.store.document.studentOwnerId='ownerB';h.setFailure();h.mount(h.host);assert.equal(h.host.querySelector('[data-builder-preview-surface]'),null);
});

test('an unchanged render signature cannot bypass a changed viewer identity',()=>{
 const h=harness();h.mount(h.host);h.runtime.identity.principalId='viewerB';h.setFailure();h.mount(h.host);assert.equal(h.host.querySelector('[data-builder-preview-surface]'),null);
});

