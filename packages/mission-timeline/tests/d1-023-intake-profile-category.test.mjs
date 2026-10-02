import test from 'node:test';
import assert from 'node:assert/strict';
import {createD1408PdfIntakeAdapter,sourceProfileNameClaim,sourceProfileHeaderClaims} from '../web/js/uxr-002/intake-d1-408-adapter.js';
import {detectSections} from '../web/js/ingestion/section-detector.js';
import {parseCvBlocks} from '../web/js/ingestion/cv-parser.js';
import {createIntakeState,buildApprovalBatch,applyApprovalBatchToDocument,renderIntake,transitionIntake,validateCandidateForApproval,candidateQuestions} from '../web/js/uxr-002/intake.js';
import {serializeFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
const lines=['SYNTHETIC CV FOR SOFTWARE EVALUATION ONLY','Case: F01','Name: Synthetic Avery Lane','Medical school: Synthetic North Medical School','Degree: MD','Experience and milestones','2021-09 to 2025-06 | Medical education | Synthetic Institution | education','2023-03 to 2023-08 | Volunteer health education | Synthetic Institution | volunteer'];
const pagesFor=lines=>[{id:'p1',sourceDocumentId:'synthetic-cv',pageNumber:1,lines}];
async function extract(lines){const text=lines.join('\n');return createD1408PdfIntakeAdapter({pdfExtractor:async()=>({status:'EXTRACTED',sourceDocumentId:'synthetic-cv',pages:pagesFor(lines),pageCount:1,text,charCount:text.length,extractionMethod:'PDFJS_TEXT_LAYER',warnings:[],inspected:{name:'synthetic.pdf',size:500,mimeType:'application/pdf',sha256:'a'.repeat(64)}})}).extract({file:{name:'synthetic.pdf',size:500,type:'application/pdf'},documentType:'CV'});}
test('labelled CV headers yield two dated entries, source profile claims and no invented MD event',async()=>{
 const result=await extract(lines);assert.equal(result.candidates.length,2);const [education,volunteer]=result.candidates;
 assert.equal(education.categoryId,'education');assert.equal(education.fields.medicalSchool,'Synthetic Institution');assert.equal(education.fields.profileMedicalSchool,'Synthetic North Medical School');assert.equal(education.fields.profileDegree,'MD');assert.equal(education.fields.profileFullName,'Synthetic Avery Lane');
 assert.equal(volunteer.fields.canonicalType,'VOLUNTEER_EXPERIENCE');assert.equal(volunteer.categoryId,'work');
 const state=createIntakeState({candidates:result.candidates});state.stage='review';assert.match(renderIntake(state),/Optional profile details from your CV header/);assert.match(renderIntake(state),/data-candidate-extra="acceptProfileClaims">/);assert.match(renderIntake(state),/Synthetic North Medical School/);
 state.candidates.forEach(c=>{c.decision='accepted';c.visibilityState='INTERVIEWER_SAFE';});
 assert.equal(buildApprovalBatch(state,[],{idFactory:()=>crypto.randomUUID()}).profilePrefill,null,'Accepting events alone does not approve profile headers');
 state.candidates[0].fields.acceptProfileClaims=true;let serial=0;
 const batch=buildApprovalBatch(state,[],{idFactory:()=>`synthetic-${++serial}`}),doc={events:[],studentProfile:{},builder:{},exams:[]};applyApprovalBatchToDocument(doc,batch);
 assert.equal(doc.studentProfile.fullName,'Synthetic Avery Lane');assert.equal(doc.studentProfile.degree,'MD');assert.equal(doc.studentProfile.medicalSchool,'Synthetic North Medical School');assert.equal(doc.events[0].siteName,'Synthetic Institution');
 for(const field of ['fullName','degree','medicalSchool']){const p=doc.studentProfile.fieldProvenance[field];assert.equal(p.sourceEventId,doc.events[0].id);assert.equal(p.provenance[0].sourceSha256,'a'.repeat(64));}
 doc.events[0].visibilityState='ADVISOR_ONLY';const svg=serializeFounderPresentation(doc).svg;assert.doesNotMatch(svg,/Synthetic Avery Lane|Synthetic North Medical School/);
 const existing={events:[],studentProfile:{fullName:'Manual Name',medicalSchool:'Manual School',degree:'DO'},builder:{},exams:[]};applyApprovalBatchToDocument(existing,batch);assert.equal(existing.studentProfile.fullName,'Manual Name');assert.equal(existing.studentProfile.medicalSchool,'Manual School');assert.equal(existing.studentProfile.degree,'DO');
});
test('profile context does not swallow a legitimate dated key-value degree and conflicting headers are not chosen',()=>{
 const blocks=detectSections(pagesFor(['Education','Degree: MD','Institution: Synthetic School','Dates: 2020 to 2024'])).blocks;const records=parseCvBlocks(blocks);assert.equal(records.length,1);assert.equal(records[0].title,'MD');assert.equal(records[0].dates,'2020 to 2024');
 const conflict=detectSections(pagesFor(['Name: Synthetic First Person','Name: Synthetic Second Person','Medical school: Synthetic One School','Medical school: Synthetic Two School','Degree: MD','2020 to 2024 | Medical education | Synthetic Institution | education'])).blocks;
 assert.equal(sourceProfileNameClaim(conflict),null);assert.equal(sourceProfileHeaderClaims(conflict).medicalSchool,undefined);
 assert.equal(sourceProfileNameClaim(detectSections(pagesFor(['Research Assistant','Name: Synthetic Person','2020 to 2021 | Job | Company'])).blocks)?.value,'Synthetic Person');
 const body=detectSections(pagesFor(['2020 to 2021 | Job | Company','Name: Synthetic Body Person'])).blocks;assert.equal(sourceProfileNameClaim(body),null);
});
test('unknown category stays unselected until an explicit review choice; source location is retained',async()=>{
 const result=await extract(['Name: Synthetic Person','2020 to 2021 | Unspecified role | Synthetic Entity | Prague']);
 const state=createIntakeState({candidates:result.candidates});state.stage='review';const c=state.candidates[0];assert.equal(c.categoryId,'');assert.equal(c.fields.sourceLocation,'Prague');assert.equal(validateCandidateForApproval(c).categoryId,'Choose a category.');assert.match(renderIntake(state),/value="" selected disabled>Choose a category/);
 const changed=transitionIntake(state,{type:'EDIT_CANDIDATE',id:c.id,patch:{categoryId:'work'}});assert.equal(changed.candidates[0].fields.categoryConfirmed,true);assert.ok(!candidateQuestions(changed.candidates[0]).some(q=>q.key==='categoryId'));assert.equal(validateCandidateForApproval(changed.candidates[0]).categoryId,undefined);
});

test('unsourced select fields render a blank choice rather than the first immigration status',async()=>{
 const result=await extract(lines),state=createIntakeState({candidates:result.candidates});state.stage='review';state.candidates[0].expanded=true;
 const html=renderIntake(state),select=html.match(/<select[^>]*data-candidate-extra="[^"]*"[^>]*>[\s\S]*?US citizen \/ permanent resident[\s\S]*?<\/select>/)?.[0];
 assert.ok(select);assert.match(select,/<option value="" selected>Not stated — review<\/option>/);assert.doesNotMatch(select,/<option[^>]*selected[^>]*>US citizen/);
});

test('a name-only CV header requires separate profile confirmation',async()=>{
 const result=await extract(['Name: Synthetic Avery Lane','2021-09 to 2025-06 | Medical education | Synthetic Institution | education']);
 const state=createIntakeState({candidates:result.candidates});state.stage='review';
 const education=state.candidates[0];
 assert.equal(education.fields.profileFullName,'Synthetic Avery Lane');
 assert.equal(education.fields.profileHeaderReviewRequired,true);
 assert.match(renderIntake(state),/data-candidate-extra="acceptProfileClaims">/);
 education.decision='accepted';
 const unconfirmed=buildApprovalBatch(state,[]);
 assert.equal(unconfirmed.profilePrefill,null);
 assert.equal(unconfirmed.additions[0].fields.profileFullName,undefined);
 assert.equal(unconfirmed.additions[0].fields.profileNameProvenance,undefined);
 delete education.fields.profileHeaderReviewRequired;
 assert.equal(buildApprovalBatch(state,[]).profilePrefill,null,'Source provenance still requires confirmation if an adapter omits its review flag');
 education.fields.acceptProfileClaims=true;
 assert.equal(buildApprovalBatch(state,[]).profilePrefill.fullName,'Synthetic Avery Lane');
});

test('conflicting labelled CV profile claims cannot be silently chosen or confirmed',async()=>{
 const result=await extract(['Name: Synthetic First Person','Name: Synthetic Second Person','Medical school: Synthetic One School','Medical school: Synthetic Two School','Degree: MD','2021-09 to 2025-06 | Medical education | Synthetic Institution | education']);
 const state=createIntakeState({candidates:result.candidates});state.stage='review';
 const education=state.candidates[0];
 assert.deepEqual(education.fields.profileHeaderConflicts,['fullName','medicalSchool']);
 assert.equal(education.fields.profileHeaderConflictProvenance.length,4);
 assert.ok(education.fields.profileHeaderConflictProvenance.every(item=>item.sourceSha256==='a'.repeat(64)));
 assert.match(renderIntake(state),/Conflicting CV profile headers need review/);
 assert.doesNotMatch(renderIntake(state),/data-candidate-extra="acceptProfileClaims"/);
 education.decision='accepted';
 assert.equal(buildApprovalBatch(state,[]).profilePrefill,null);
 education.fields.acceptProfileClaims=true;
 const conflicted=buildApprovalBatch(state,[]);
 assert.equal(conflicted.profilePrefill,null);
 assert.equal(conflicted.additions[0].fields.profileHeaderConflictProvenance,undefined);
 assert.equal(conflicted.additions[0].fields.profileDegree,undefined);
 assert.equal(buildApprovalBatch(state,[]).additions.length,1,'The dated experience can still be approved');
});

test('multiple medical education records cannot claim one shared CV profile header',async()=>{
 const result=await extract(['Name: Synthetic Avery Lane','2021-09 to 2023-06 | Medical education | Synthetic First School | education','2023-09 to 2025-06 | Medical education | Synthetic Second School | education']);
 const state=createIntakeState({candidates:result.candidates});state.stage='review';
 assert.equal(state.candidates.length,2);
 for(const education of state.candidates){
  assert.deepEqual(education.fields.profileHeaderConflicts,['medicalEducationSource']);
  education.decision='accepted';education.fields.acceptProfileClaims=true;
 }
 const batch=buildApprovalBatch(state,[]);
 assert.equal(batch.profilePrefill,null);
 assert.equal(batch.additions.length,2);
});
