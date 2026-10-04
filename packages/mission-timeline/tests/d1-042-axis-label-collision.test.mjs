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
