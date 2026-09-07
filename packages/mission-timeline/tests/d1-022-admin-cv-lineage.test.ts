import assert from 'node:assert/strict';
import test from 'node:test';
import {adminRosterStatus,hasImportedCv022} from '../src/admin/postgres-admin-service.js';
const sha='7e32019b764c1803830749abccad07988008c06fd6ff054580101dd30f5c1c4b';
const provenance=(patch:Record<string,unknown>={})=>({documentType:'cv',sourceDocumentId:'src-test-cv',sourceObjectId:'object-test-source',sourceSha256:sha,sourceBlockId:'block-1',pageNumber:1,sourceExcerpt:'Synthetic research assistant, January–June 2022.',...patch});
const source={id:'src-test-cv',objectId:'object-test-source',effectiveType:'cv',sha256:sha};
const event=(patch:Record<string,unknown>={})=>({id:'event-test',sourceType:'document-intake',provenance:[provenance()],...patch});

test('admin CV import survives an emptied/reset review queue through canonical source lineage',()=>{
 const doc={events:[event()],intake:{lastImport:null,candidates:[],stage:'done'}};
 assert.equal(hasImportedCv022(doc),true);
 const row={document_id:'timeline-test',principal_status:'ACTIVE',document_status:'DRAFT',quality_source:doc};
 const status=adminRosterStatus(42,row);assert.equal(status.cvStatus,'IMPORTED');assert.equal(status.filters.cv_imported,true);
 assert.equal(hasImportedCv022({...doc,intake:null}),true);
});
test('a completed checksum-bound CV source counts before apply; picking a file alone does not',()=>{
 assert.equal(hasImportedCv022({intake:{extraction:{completed:true,sourceDocument:source}}}),true);
 for(const intake of [{file:{name:'CV.pdf'}},{extraction:{completed:false,sourceDocument:source}},{extraction:{completed:true,sourceDocument:{...source,sha256:'bad'}}},{extraction:{completed:true,sourceDocument:{...source,id:'',objectId:''}}}])assert.equal(hasImportedCv022({intake}),false);
});
test('legacy accepted and pending review candidates count only with exact CV provenance',()=>{
 for(const key of ['acceptedCandidates','candidates']){
  const records=[{id:'legacy-candidate',provenance:[provenance({sourceSha256:undefined,sourceObjectId:undefined})]}];
  assert.equal(hasImportedCv022({intake:key==='candidates'?{candidates:records}:{lastImport:{acceptedCandidates:records}}}),true);
 }
 assert.equal(hasImportedCv022({intake:{lastImport:{acceptedCount:9,acceptedCandidates:[{id:'flag-only'}]}}}),false);
});
test('recognized parser CV, resume and ERAS types count; filename and conflicting declared type do not',()=>{
 for(const type of ['cv','CV','resume','eras'])assert.equal(hasImportedCv022({events:[event({provenance:[provenance({documentType:type})]})]}),true);
 for(const type of ['TIMELINE_RESCUE','transcript','MSPE','unknown',''])assert.equal(hasImportedCv022({events:[event({provenance:[provenance({documentType:type,userDeclaredType:type||undefined,fileName:'CV.pdf'})]})]}),false);
 assert.equal(hasImportedCv022({events:[event({provenance:[provenance({documentType:'TIMELINE_RESCUE',userDeclaredType:'cv'})]})]}),false);
});
test('bare client status, applied and AI flags cannot manufacture CV import',()=>{
 for(const doc of [{cvImported:true},{intake:{approval:{applied:true,appliedCount:9}}},{builder:{lastAiPrefill:{acceptedCount:9}}},{events:[{sourceType:'document-intake',title:'CV imported',provenance:[]}]},{intake:{extraction:{completed:true,sourceDocument:{effectiveType:'cv'}}}}])assert.equal(hasImportedCv022(doc),false);
 assert.equal(adminRosterStatus(42,{document_id:'timeline-test',principal_status:'ACTIVE',cv_imported:true}).cvStatus,'NOT_IMPORTED');
});
test('manual-only, media-only, rescued and never-started students remain unimported',()=>{
 for(const value of [undefined,null,[],{}, {events:[{title:'Manual research'}]}, {advanced:{media:[{source:{objectId:'image',type:'image/png'}}]}}])assert.equal(hasImportedCv022(value),false);
 const never=adminRosterStatus(42,undefined);assert.equal(never.status,'NEVER_STARTED');assert.equal(never.cvStatus,'NOT_IMPORTED');assert.equal(never.filters.never_started,true);
 assert.equal(adminRosterStatus(42,{quality_source:{events:[event()]}}).cvStatus,'NOT_IMPORTED');
});
test('retained exam or profile field provenance preserves CV history after event removal',()=>{
 for(const doc of [{exams:[{provenance:[provenance()]}]},{studentProfile:{fieldProvenance:{degree:{provenance:[provenance()]}}}},{studentProfile:{fullNameProvenance:[provenance()]}}])assert.equal(hasImportedCv022(doc),true);
});
test('malformed provenance and invalid supplied checksum cannot become legacy evidence',()=>{
 for(const patch of [{sourceDocumentId:'',sourceObjectId:''},{sourceBlockId:''},{pageNumber:0},{pageNumber:'1'},{sourceExcerpt:'',sourceSnippet:''},{sourceSha256:123},{sourceSha256:' '},{sourceSha256:'invalid'}])assert.equal(hasImportedCv022({events:[event({provenance:[provenance(patch)]})]}),false);
 for(const value of [null,true,'cv',{documentType:'cv'}])assert.equal(hasImportedCv022({events:[event({provenance:value})]}),false);
});
test('actual intake approval and persisted DONE snapshot retain server-derived import',async()=>{
 // Dynamic browser module import avoids manufacturing a substitute apply transition.
 const moduleUrl=new URL('../web/js/uxr-002/intake.js',import.meta.url).href;
 const {IntakeStateMachine,applyApprovalBatchToDocument}=await import(moduleUrl);
 const document:Record<string,any>={events:[],studentProfile:{},builder:{},intake:{lastImport:null}};
 const machine=new IntakeStateMachine({adapter:{extract:async()=>({readable:true,sourceDocument:source,candidates:[{id:'candidate-test',categoryId:'research',title:'Synthetic research assistant',startDate:'2022-01',endDate:'2022-06',eventType:'duration',confidence:'high',sourceSnippet:'Synthetic research assistant, January–June 2022.',fields:{institution:'Synthetic University'},provenance:[provenance()]}]})},idFactory:(prefix:string)=>prefix+'-test',clock:()=>new Date('2026-09-07T00:00:00Z')});
 machine.subscribe((state:Record<string,unknown>)=>{document.intake={lastImport:null,...state};});
 machine.receiveFile({name:'Synthetic CV.pdf',type:'application/pdf',size:2439,lastModified:1});machine.setConsent(true);await machine.startExtraction();
 assert.equal(hasImportedCv022(document),true);machine.decideCandidate('candidate-test','accepted');
 await machine.approveAccepted({saveVersion:async()=>{},applyBatch:async(batch:unknown)=>applyApprovalBatchToDocument(document,batch)});
 assert.equal(document.intake.lastImport,null);assert.equal(document.intake.approval.applied,true);assert.equal(document.events.length,1);
 assert.equal(hasImportedCv022(document),true);document.intake={lastImport:null,candidates:[]};assert.equal(hasImportedCv022(document),true);
});
