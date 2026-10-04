import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveFounderPresentationSvg,materialPresentationCollisions} from '../web/js/presentation/resolved-founder-presentation.js';
import {analyzeCollisionLayout} from '../web/js/editor/collision-engine-410.js';

const axis='<g data-layer="axis"><path fill="#182B4C" d="M0 125H1920V161H0Z"/><text x="100" y="150" font-size="23" fill="white">2023</text></g>';
function paint(content){return resolveFounderPresentationSvg(`<svg viewBox="0 0 1920 1080">${axis}<g data-event-id="synthetic-flag" data-event-kind="flag">${content}</g></svg>`);}
test('milestone text crossing the navy year ribbon is a material collision',()=>{
  const result=materialPresentationCollisions(paint('<text x="300" y="138" font-size="18">Complete synthetic institution label</text>'));
  assert.ok(result.some(item=>item.elementIds.includes('furniture:axis')));
});
test('a filled pennant crossing the ribbon is blocked even without a text overlap',()=>{
  assert.ok(materialPresentationCollisions(paint('<path fill="gray" d="M300 118H350V142H300Z"/>')).length);
});
test('a pole touching the ribbon remains an intentional connector',()=>{
  assert.equal(materialPresentationCollisions(paint('<line x1="300" y1="85" x2="300" y2="125" stroke="gray" stroke-width="3"/><text x="355" y="100" font-size="18">Synthetic milestone</text>')).length,0);
});
test('the actual canonical collision report rejects an overlong milestone painted over the ribbon',()=>{
  const document={id:'synthetic-axis-hold',theme:'keynote-classic',studentProfile:{fullName:'Synthetic Avery'},events:[{id:'synthetic-long-flag',title:'Synthetic documented milestone '.repeat(24),categoryId:'personal',eventType:'milestone',startDate:'2023-06',endDate:null,visibilityState:'INTERVIEWER_SAFE'}],exams:[],metadata:{renderCurrentMonth:'2023-06'},advanced:{background:{kind:'theme'},media:[],textBlocks:[],elements:[],groups:[]}};
  const report=analyzeCollisionLayout(document);
  assert.ok(report.warnings.some(item=>item.code==='RESERVED_REGION_COLLISION'&&item.elementIds.includes('furniture:axis')));
  assert.equal(document.events[0].startDate,'2023-06');
});


test('bounded joint packing rescues full milestone labels that greedy placement cannot finish',async()=>{
  const {serializeFounderPresentation}=await import('../web/js/presentation/founder-presentation-serializer.js');
  const document={id:'synthetic-joint',theme:'keynote-classic',studentProfile:{fullName:'Synthetic Joint'},
    events:['2020-02','2020-08','2021-02'].map((date,index)=>({id:'f'+index,title:'Synthetic completed milestone',siteName:'Synthetic Academic Institution',categoryId:'personal',eventType:'milestone',startDate:date,visibilityState:'INTERVIEWER_SAFE'})),
    presentationOverrides:{axis:{mode:'manual',startYear:2020,endYear:2025,includeFuture:false,segmentWeights:Array.from({length:6},(_,index)=>({id:String(2020+index),weight:1}))}},
    advanced:{media:[],textBlocks:[],elements:[],groups:[]}};
  const before=JSON.stringify(document),render=()=>serializeFounderPresentation(document,{scope:'EVERYTHING',currentMonth:'2026-10'});
  const started=performance.now(),first=render(),elapsed=performance.now()-started,packing=first.scene.autoMilestonePacking;
  assert.equal(packing.strategy,'joint');assert.ok(packing.greedyPlaced<packing.total);assert.equal(packing.total,3);
  assert.ok(packing.expansions<=packing.limit);assert.equal(packing.limit,8192);assert.ok(elapsed<2000,`${elapsed} ms`);
  assert.equal(materialPresentationCollisions(resolveFounderPresentationSvg(first.svg)).length,0);
  assert.equal(render().svg,first.svg);assert.equal(JSON.stringify(document),before);
  const resolved=resolveFounderPresentationSvg(first.svg);
  for(const event of document.events){
    const nodes=resolved.nodes.filter(node=>node.groupId==='event:'+event.id);
    const pole=nodes.find(node=>node.kind==='path'&&node.lineOnly);
    const [year,month]=event.startDate.split('-').map(Number);
    const expectedX=39.36+1841.28*((year-2020)+(month-1)/12)/6+4; // native pole offset
    assert.ok(Math.abs(pole.bounds.x-expectedX)<.04);assert.equal(pole.bounds.y+pole.bounds.height,125);
    const label=nodes.filter(node=>node.kind==='text'&&!/^\d{4}/.test(node.text||''));
    const text=label.map(node=>node.text).join(' ');
    assert.ok(text.includes(event.title));assert.ok(text.includes(event.siteName));
    assert.ok(label.every(node=>Number(node.style['font-size'])===18));
    assert.ok(nodes.filter(node=>node.kind!=='path'||!node.lineOnly).every(node=>node.bounds.y+node.bounds.height<=125));
  }
});


test('a constrained upper band preserves the greedy incumbent with finite search and truthful unresolved collisions',async()=>{
  const {serializeFounderPresentation}=await import('../web/js/presentation/founder-presentation-serializer.js');
  const document={id:'synthetic-constrained',theme:'keynote-classic',studentProfile:{fullName:'Synthetic Joint'},
    events:Array.from({length:4},(_,index)=>({id:'f'+index,title:'Synthetic completed milestone',siteName:'Synthetic Academic Institution',categoryId:'personal',eventType:'milestone',startDate:'2020-02',visibilityState:'INTERVIEWER_SAFE'})),
    presentationOverrides:{axis:{mode:'manual',startYear:2020,endYear:2025,includeFuture:false,segmentWeights:Array.from({length:6},(_,index)=>({id:String(2020+index),weight:1}))}},
    advanced:{media:[],textBlocks:[],elements:[],groups:[]}};
  const started=performance.now(),result=serializeFounderPresentation(document,{scope:'EVERYTHING',currentMonth:'2026-10'}),packing=result.scene.autoMilestonePacking;
  assert.equal(packing.strategy,'greedy');assert.ok(packing.greedyPlaced<packing.total);assert.ok(packing.expansions<=packing.limit);
  assert.ok(performance.now()-started<2000);assert.ok(materialPresentationCollisions(resolveFounderPresentationSvg(result.svg)).length>0);
});
