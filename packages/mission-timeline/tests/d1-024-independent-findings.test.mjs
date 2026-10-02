import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalBoardPreview} from '../web/js/uxr-002/preview.js';
import {renderLastGoodBuilderPreview,clearLastGoodBuilderPreview} from '../web/js/uxr-002/last-good-builder-preview.js';
import {timelineLastGoodRenderCache} from '../web/js/presentation/last-good-render-cache.js';
import {createEmptySceneGraph,synchronizeAdvancedSceneDocument} from '../web/js/editor/scene-graph.js';
import {serializeFounderPresentation as render,assertCompleteFounderPresentation as gate} from '../web/js/presentation/founder-presentation-serializer.js';
import {analyzeTimelineQuality} from '../web/js/uxr-002/quality-guardian.js';
const event=(extra={})=>({id:'event',title:'Clinical Analyst',siteName:'Synthetic Polar Hospital',categoryId:'work',eventType:'duration',startDate:'2022-02',endDate:'2023-08',visibilityState:'INTERVIEWER_SAFE',...extra});
const doc=(extra={})=>({id:'independent-doc',studentOwnerId:'owner',revision:1,theme:'keynote-classic',studentProfile:{fullName:'Synthetic SECRET_CACHE',medicalSchool:'Synthetic Cedar College'},events:[event()],advanced:{background:{kind:'theme'},media:[],textBlocks:[],elements:[],groups:[]},...extra});
const options={viewerPrincipalId:'viewer',subjectPrincipalId:'owner',surfaceKey:'shared',audience:'EVERYTHING'};
for(const [name,changeDoc,changeOptions] of [
 ['document',d=>({...d,id:'other'}),o=>o],['owner',d=>({...d,studentOwnerId:'other'}),o=>o],
 ['viewer',d=>d,o=>({...o,viewerPrincipalId:'other'})],['subject',d=>d,o=>({...o,subjectPrincipalId:'other'})],
 ['audience',d=>d,o=>({...o,audience:'INTERVIEWER_SAFE'})],['surface',d=>d,o=>({...o,surfaceKey:'other'})]
])test('shared caches cannot cross '+name+' even with a reused surface name',()=>{
 timelineLastGoodRenderCache.clear();clearLastGoodBuilderPreview('independent-doc');
 const d=doc();canonicalBoardPreview(d,options);renderLastGoodBuilderPreview(d,options,()=>'<svg>SYNTHETIC_SECRET</svg>');
 const broken=changeDoc(structuredClone(d));broken.advanced.scene={...createEmptySceneGraph(),objects:'broken'};
 assert.throws(()=>canonicalBoardPreview(broken,changeOptions(options)),e=>e.code==='TIMELINE_SCENE_RECOVERY_REQUIRED');
 assert.throws(()=>renderLastGoodBuilderPreview(changeDoc(d),changeOptions(options),()=>{throw Error('expected');}),/expected/);
});
test('unbound previews never retain a private fallback; fully bound same identity recovers',()=>{
 const d=doc();timelineLastGoodRenderCache.clear();canonicalBoardPreview(d);
 const broken=structuredClone(d);broken.advanced.scene={...createEmptySceneGraph(),objects:'broken'};
 assert.throws(()=>canonicalBoardPreview(broken));
 canonicalBoardPreview(d,options);assert.match(canonicalBoardPreview(broken,options),/data-render-state="last-good"/);
});
test('opaque profile occlusion blocks actual final export and Guardian readiness',()=>{
 const d=doc();d.advanced.elements=[{id:'cover',kind:'rectangle',x:13,y:661,width:545,height:410,fill:'#000000'}];
 assert.throws(()=>gate(render(d)),e=>e.code==='TIMELINE_EXPORT_TEXT_COLLISION');
 assert.ok(analyzeTimelineQuality(d).findings.some(f=>f.code==='PRESENTATION_TEXT_COLLISION'&&f.severity==='BLOCK_EXPORT'));
});
test('unsupported milestone institution cannot silently disappear into a successful export',()=>{
 const d=doc({events:[event({eventType:'milestone',title:'Clinical license awarded',siteName:'Synthetic Licensing Council',endDate:null})]});
 const r=render(d);assert.equal(r.scene.flags[0].siteName,'Synthetic Licensing Council');
 assert.throws(()=>gate(r),e=>e.code==='TIMELINE_EXPORT_MISSING_FIELDS'&&e.fields.some(f=>f.field==='siteName'));
});
for(const title of ['Moved to Canada','Citizenship awarded','Immigration to Australia','Relocated to India'])test('generic relocation does not invent USA: '+title,()=>{
 assert.doesNotMatch(render(doc({events:[event({title,eventType:'milestone',categoryId:'personal',endDate:null,siteName:''})]})).svg,/<image data-founder-usa-flag-asset-sha256/);
});
test('explicit United States relocation retains the authorized asset',()=>assert.match(render(doc({events:[event({title:'Moved to the United States',eventType:'milestone',categoryId:'personal',endDate:null,siteName:''})]})).svg,/<image data-founder-usa-flag-asset-sha256/));
test('scene-only authored text is preserved for recoverable repair, not silently dropped',()=>{
 const d=doc();d.advanced.scene={...createEmptySceneGraph(),objects:[{id:'text',type:'text',semanticRef:null,geometry:{x:950,y:700,width:350,height:70,rotation:0},locked:false,aspectLocked:false,z:0,groupId:null,presentation:{text:'SYNTHETIC_SCENE_ONLY_AUTHORED',fontFamily:'Baskerville',fontSize:19}}]};
 assert.throws(()=>render(d),e=>e.code==='TIMELINE_SCENE_RECOVERY_REQUIRED');assert.deepEqual(synchronizeAdvancedSceneDocument(d).advanced.scene,d.advanced.scene);
});
test('normalized coordinates with UNKNOWN precision cannot invent date certainty',()=>{
 const r=render(doc({events:[event({fields:{datePrecision:{start:'UNKNOWN',end:'UNKNOWN'}}})]}));
 assert.match(r.svg,/Date needed/);assert.throws(()=>gate(r),e=>e.code==='TIMELINE_EXPORT_INCOMPLETE');
});
