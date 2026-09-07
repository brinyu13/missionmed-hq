import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {renderCanvas,createCanvasState} from '../web/js/uxr-002/canvas.js';
import {createTextBlock} from '../web/js/uxr-002/advanced-studio.js';
import {reconcileAdvancedScene} from '../web/js/editor/scene-graph.js';

// The parent authored this synthetic note through the normal Builder controls.
const fixture=JSON.parse(await readFile(new URL('./fixtures/d1-timeline-astra-021/fidelity-required-authored.json',import.meta.url)));
const source=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');
const begin=source.indexOf('    onAction:(action,_event,control)=>{');
const end=source.indexOf('    onObjectAction:(action,target)=>{',begin);
assert.ok(begin>0&&end>begin,'Actual Advanced insertion hooks remain available');
const handlers=source.slice(begin,end);

for(const [route,action] of [['click','text'],['click','symbol'],['drop','text'],['drop','symbol']]){
  test(`${route} ${action} insertion replaces prior note controls with the new text editor`,()=>{
    const document=structuredClone(fixture);
    document.mode='advanced';
    const before=structuredClone(document);
    const note=document.events.find(event=>event.fields?.builderDomain==='explanation');
    const id=`selection-regression-${route}-${action}`;
    const controller={
      state:{...createCanvasState(),selectedEventId:note.id,detailsEventId:note.id,advancedSelection:null},
      setUiState(next){this.state={...this.state,...next};}
    };
    const store={document,mutate(_label,change){change(this.document);}};
    // Execute the actual adapter handlers. Only host placement/focus plumbing is
    // isolated; text creation, scene reconciliation and canvas markup are real.
    const hooks=new Function(
      'store','canvasController','uid','createTextBlock','nextAdvancedLayerIndex',
      'openAdvancedPlacement','reconcileAdvancedScene','syncBridgeStateFromStore',
      'requestAdvancedDirectSelection','reselectAdvancedKernel','canvasHost',
      `return ({${handlers}});`
    )(
      store,controller,()=>id,createTextBlock,()=>100,()=>({x:700,y:500}),
      reconcileAdvancedScene,()=>{},()=>{},()=>{},null
    );
    if(route==='click')hooks.onAction(action,null,{dataset:{advancedSymbol:'Add body text'}});
    else assert.equal(hooks.onAssetDrop({kind:'insert',action,symbol:'Add body text'},{x:700,y:500}),true);

    assert.equal(controller.state.selectedEventId,null);
    assert.equal(controller.state.detailsEventId,null);
    assert.equal(controller.state.advancedSelection.id,id);
    assert.equal(controller.state.advancedTextEdit.id,id);
    for(const field of ['events','exams','studentProfile','categories','specialtyVariants']){
      assert.deepEqual(document[field],before[field],field);
    }
    assert.equal(document.advanced.textBlocks.length,before.advanced.textBlocks.length+1);
    const html=renderCanvas({document,state:controller.state});
    assert.doesNotMatch(html,/aria-label="Resize explanation"/);
    assert.ok(!html.includes(note.title+' controls'),'Old note toolbar disappears');
    assert.ok(html.includes('data-advanced-inline-text-input'),'New text editor remains active');
    assert.ok(html.includes(id));
  });
}
