import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeTimelineQuality} from '../web/js/uxr-002/quality-guardian.js';
import {buildExportScreenModel,buildExportReadiness} from '../web/js/uxr-002/export-screen.js';
const document=()=>({id:'guardian-synthetic',revision:1,theme:'keynote-classic',studentProfile:{fullName:'Synthetic Guardian'},categories:['education','exams','clinical','work','research','personal'].map(id=>({id,label:id,color:'#123456'})),events:[{id:'education',title:'Medical school',categoryId:'education',eventType:'duration',startDate:'2020-08',endDate:'2024-05',visibilityState:'INTERVIEWER_SAFE'}],advanced:{background:{kind:'theme'},media:[],textBlocks:[],elements:[],groups:[]}});
test('Guardian and final export agree when the student name is missing',()=>{
 const doc=document();doc.studentProfile.fullName='';const report=analyzeTimelineQuality(doc);assert.equal(report.state,'BLOCKED');assert.ok(report.findings.some(f=>f.code==='STUDENT_NAME_MISSING'));assert.equal(buildExportScreenModel(doc).exportActionDisabled,true);assert.equal(buildExportReadiness(doc,report).state,'BLOCKED');
});
test('unrenderable facts block readiness rather than silently disappearing',()=>{
 const doc=document();doc.events[0].startDate='';const report=analyzeTimelineQuality(doc);assert.ok(report.findings.some(f=>f.code==='EVENTS_NOT_RENDERABLE'&&f.severity==='BLOCK_EXPORT'));
});
test('a render failure is not a clean layout pass',()=>{
 const doc=document();doc.events[0].categoryId='unsupported';const report=analyzeTimelineQuality(doc);assert.equal(report.state,'BLOCKED');assert.ok(report.findings.some(f=>f.code==='PRESENTATION_UNAVAILABLE'));
});
test('empty optional furniture cannot produce unconditional Ready',()=>{
 const report=analyzeTimelineQuality(document());assert.notEqual(report.state,'READY');assert.ok(report.findings.some(f=>f.code==='UNFINISHED_PRESENTATION_FURNITURE'));
});
