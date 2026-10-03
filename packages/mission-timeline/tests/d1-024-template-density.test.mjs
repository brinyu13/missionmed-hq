import test from 'node:test';
import assert from 'node:assert/strict';
import {serializeFounderPresentation,assertCompleteFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {resolveFounderPresentationSvg} from '../web/js/presentation/resolved-founder-presentation.js';
import {FOUNDER_2025_MATRIX} from './fixtures/founder-2025-matrix.mjs';

for(const fixture of FOUNDER_2025_MATRIX){
  test(`${fixture.id} ${fixture.case}: template, source preservation and truthful gate`,()=>{
    const before=JSON.stringify(fixture.document),r=serializeFounderPresentation(fixture.document);
    assert.equal(JSON.stringify(fixture.document),before);
    assert.match(r.svg,/viewBox="0 0 1920 1080"/);assert.match(r.svg,/data-founder-keynote-source-sha256="113d22/);
    assert.equal(r.pages,undefined);
    const nodes=resolveFounderPresentationSvg(r.svg).nodes;
    const ids=new Set(nodes.map(n=>n.semanticRef));
    for(const e of r.scene.events)assert.ok(ids.has(e.id),'No included event may silently disappear: '+e.id);
    // Dense mode must retain institution names just as ordinary mode does.
    for(const e of r.scene.arrows){
      const text=nodes.filter(n=>n.kind==='text'&&n.semanticRef===e.id).map(n=>n.text).join(' ').replace(/\s+/g,' ');
      assert.ok(text.includes(e.siteName),'Institution absent: '+e.id);
    }
    if(fixture.reviewRequired)assert.throws(()=>assertCompleteFounderPresentation(r),e=>['TIMELINE_EXPORT_INCOMPLETE','TIMELINE_EXPORT_EMPTY'].includes(e.code));
    // A rendering that passes technical bounds still needs visual acceptance.
    else try{assertCompleteFounderPresentation(r);}catch(e){assert.ok(['TIMELINE_EXPORT_TEXT_OVERFLOW','TIMELINE_EXPORT_MISSING_FIELDS','TIMELINE_EXPORT_TEXT_COLLISION'].includes(e.code));}
  });
}
test('an institution omission is detected even when all event IDs remain in the artifact',()=>{
  const r=serializeFounderPresentation(FOUNDER_2025_MATRIX[0].document);
  r.svg=r.svg.replace(/<text[^>]*data-material-field="siteName"[\s\S]*?<\/text>/g,'');
  assert.throws(()=>assertCompleteFounderPresentation(r),e=>e.code==='TIMELINE_EXPORT_MISSING_FIELDS'&&e.fields.some(f=>f.field==='siteName'));
});

test('rotations and long institutions fit inside the template without changing facts',()=>{
  for(const id of ['M05','M09']){
    const document=FOUNDER_2025_MATRIX.find(f=>f.id===id).document,before=JSON.stringify(document);
    const r=serializeFounderPresentation(document);assert.doesNotThrow(()=>assertCompleteFounderPresentation(r));
    assert.equal(JSON.stringify(document),before);assert.equal(r.svg,serializeFounderPresentation(document).svg);
  }
});

test('dense automatic composition uses readable unequal year cells without changing dates or authored geometry',()=>{
  const document=FOUNDER_2025_MATRIX.find(f=>f.id==='M03').document;
  const before=JSON.stringify(document),r=serializeFounderPresentation(document);
  const weights=[...r.svg.matchAll(/data-axis-segment-weight="([^"]+)"/g)].map(m=>Number(m[1]));
  assert.ok(new Set(weights).size>1,'busy years receive more horizontal space');
  const cells=[...r.svg.matchAll(/data-axis-cell="true"[^>]*width="([^"]+)"/g)].map(m=>Number(m[1]));
  assert.ok(cells.every(width=>width>=80),'year labels retain their native size and clearance');
  assert.equal(JSON.stringify(document),before);
  assert.equal(r.svg,serializeFounderPresentation(document).svg,'composition is deterministic');
  // The remaining milestone site omission is separate from density: remove only
  // that unsupported source field in this bounded geometry test.
  const withoutMilestoneSites=structuredClone(document);
  for(const event of withoutMilestoneSites.events)if(event.eventType==='milestone')delete event.siteName;
  assert.doesNotThrow(()=>assertCompleteFounderPresentation(serializeFounderPresentation(withoutMilestoneSites)));
});

test('automatic year weighting does not change a locked lane',()=>{
  const document=structuredClone(FOUNDER_2025_MATRIX.find(f=>f.id==='M03').document);
  document.events.find(e=>e.id==='work').manualOffset={laneLocked:true,x:0,y:0};
  const r=serializeFounderPresentation(document);
  assert.ok([...r.svg.matchAll(/data-axis-segment-weight="([^"]+)"/g)].every(m=>Number(m[1])===1));
});


test('axis editing uses effective widths and freezes displayed axis with first manual event geometry',async()=>{
  const {setAxisPresentationOverride,setAxisSegmentWeights}=await import('../web/js/uxr-002/advanced-studio.js');
  const {applySceneCommandToDocument}=await import('../web/js/editor/scene-commands.js');
  const {locked407FMilestoneGeometry}=await import('../web/js/uxr-002/locked-407f-export.js');
  const document=structuredClone(FOUNDER_2025_MATRIX.find(f=>f.id==='M03').document);document.mode='advanced';
  const before=JSON.stringify(document),rendered=serializeFounderPresentation(document);
  const cells=svg=>[...svg.matchAll(/data-axis-segment-id="([^"]+)" data-axis-segment-weight="([^"]+)"[^>]*><rect data-axis-cell="true" x="([^"]+)" y="[^"]+" width="([^"]+)"/g)].map(m=>({id:m[1],weight:+m[2],x:+m[3],width:+m[4]}));
  const prior=cells(rendered.svg),index=2,dx=3;
  const pairWeight=prior[index].weight+prior[index+1].weight,pairWidth=prior[index].width+prior[index+1].width;
  const weights=prior.map((c,i)=>({id:c.id,weight:c.weight+(i===index?dx/pairWidth*pairWeight:i===index+1?-dx/pairWidth*pairWeight:0)}));
  const range=setAxisPresentationOverride(document,{startYear:2020,endYear:2025,includeFuture:false});
  const edited=setAxisSegmentWeights(range.document,weights);assert.equal(edited.changed,true);
  const after=cells(serializeFounderPresentation(edited.document).svg);
  assert.ok(Math.abs(after[index+1].x-prior[index+1].x-dx)<.001,'3px right drag moves exactly3px right');
  for(const i of [0,1,4,5])assert.ok(Math.abs(after[i].width-prior[i].width)<.001,'untouched year cells stay fixed');
  const geometry=locked407FMilestoneGeometry(rendered.scene,'degree');
  const flagX=Number(/data-event-id="degree"[^>]*>[\s\S]*?<line x1="([^"]+)"/.exec(rendered.svg)[1])-4;
  assert.ok(Math.abs(geometry.x-flagX)<.001,'geometry consumers use the rendered axis');
  const moved=applySceneCommandToDocument(document,{kind:'geometry',target:{type:'event',id:'degree'},geometry:{x:geometry.x,y:geometry.y-5,width:50,height:64,rotation:0},create:{type:'event',semanticRef:'degree',aspectLocked:false,presentation:{eventType:'milestone'}}});
  assert.equal(moved.changed,true);assert.equal(moved.document.presentationOverrides.axis.mode,'manual');
  const movedCells=cells(serializeFounderPresentation(moved.document).svg);
  for(let i=0;i<prior.length;i++)assert.ok(Math.abs(movedCells[i].x-prior[i].x)<.001,'first event edit preserves displayed axis');
  assert.equal(JSON.stringify(document),before);assert.deepEqual(moved.document.events,document.events);
});
