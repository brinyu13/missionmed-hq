import test from 'node:test';
import assert from 'node:assert/strict';
import {buildExportRequest,buildExportPreviewInput,buildExportScreenModel} from '../web/js/uxr-002/export-screen.js';
import {createLocalExportAdapter} from '../web/js/uxr-002/export-adapter.js';
const document=()=>({id:'export-synthetic',studentProfile:{fullName:'Synthetic Export'},events:[{id:'valid',title:'Research',categoryId:'research',eventType:'duration',startDate:'2024-01',endDate:'2024-06',visibilityState:'INTERVIEWER_SAFE'},{id:'invalid',title:'Work',categoryId:'work',eventType:'duration',startDate:'2025-01',endDate:'2024-06',visibilityState:'INTERVIEWER_SAFE'}],advanced:{media:[],textBlocks:[],elements:[],groups:[]}});
test('final export request rejects an included event the shared renderer would omit',()=>{
 const doc=document(),before=JSON.stringify(doc);assert.throws(()=>buildExportRequest(doc),e=>e.code==='TIMELINE_EXPORT_INCOMPLETE'&&e.eventIds[0]==='invalid');assert.equal(JSON.stringify(doc),before);
});
test('private invalid events do not block or leak into interview-safe export diagnostics',()=>{
 const doc=document();doc.events[1].visibilityState='STUDENT_ONLY';const request=buildExportRequest(doc);assert.equal(request.renderInput.timeline.events.length,1);assert.equal(request.renderInput.timeline.events[0].id,'valid');
});
test('the actual adapter checks completeness even when a caller bypasses request construction',async()=>{
 let rasterized=false;const adapter=createLocalExportAdapter({rasterize:()=>{rasterized=true;throw Error('must not rasterize incomplete facts');}});
 await assert.rejects(()=>adapter.generate({renderInput:buildExportPreviewInput(document())}),e=>e.code==='TIMELINE_EXPORT_INCOMPLETE');assert.equal(rasterized,false);
});

test('request, final adapter and visible export control consistently reject off-page text',async()=>{
 const doc=document();doc.events.pop();doc.advanced.textBlocks=[{id:'outside',text:'Essential visible note',x:1870,y:800,width:400,height:80,size:24,font:'Arial'}];
 const model=buildExportScreenModel(doc);assert.equal(model.exportActionDisabled,true);assert.match(model.exportBlockedReason,/does not fit/);assert.throws(()=>buildExportRequest(doc),e=>e.code==='TIMELINE_EXPORT_TEXT_OVERFLOW');
 const adapter=createLocalExportAdapter({rasterize:()=>{throw Error('unreadable output must never rasterize');}});await assert.rejects(()=>adapter.generate({renderInput:buildExportPreviewInput(doc)}),e=>e.code==='TIMELINE_EXPORT_TEXT_OVERFLOW');
});

test('an audience with no visible events cannot receive an empty finished timeline',()=>{
 const doc=document();doc.events.forEach(event=>event.visibilityState='STUDENT_ONLY');assert.equal(buildExportScreenModel(doc).exportActionDisabled,true);assert.throws(()=>buildExportRequest(doc),error=>error.code==='TIMELINE_EXPORT_EMPTY');
});
