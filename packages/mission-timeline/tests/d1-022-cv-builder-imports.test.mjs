import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {detectSections} from '../web/js/ingestion/section-detector.js';
import {parseCvBlocks} from '../web/js/ingestion/cv-parser.js';
import {buildCandidates} from '../web/js/ingestion/candidate-builder.js';
import {mapD1408CandidateToUxr,mapCvIntelligenceCandidateToUxr} from '../web/js/uxr-002/intake-d1-408-adapter.js';
import {createIntakeState,buildApprovalBatch,applyApprovalBatchToDocument} from '../web/js/uxr-002/intake.js';
import {beginBuilderEntryEdit,builderStepForEvent,commitBuilderEntry,deleteBuilderEntry,renderBuilder} from '../web/js/uxr-002/builder.js';
import {builderDomain022,isImportedBuilderEvent022,importedBuilderFields022,importedBuilderDraft022,importedBuilderSummary022,importedDraftFromForm022,renderImportedBuilderForm022,validateImportedBuilderDraft022,updateImportedBuilderEvent022,updateImportedCanvasDetails022} from '../web/js/uxr-002/imported-builder-entry-022.js';
import {documentEventTo407F,renderCanvasDetails} from '../web/js/407f-engineering-adapter.js';

const fixture=JSON.parse(await readFile(new URL('fixtures/d1-timeline-astra-021/synthetic-cv-extraction.json',import.meta.url),'utf8'));
const providerFixture=JSON.parse(await readFile(new URL('fixtures/d1-timeline-astra-021/cv2-wrapped-date.json',import.meta.url),'utf8'));
function approved(candidates){
  const state=createIntakeState({candidates});state.stage='review';
  state.candidates.forEach(candidate=>{candidate.decision='accepted';candidate.visibilityState='ADVISOR_ONLY';});
  let serial=0;
  const batch=buildApprovalBatch(state,[],{idFactory:prefix=>`${prefix}-${++serial}`});
  const document={events:[],studentProfile:{},builder:{}};
  applyApprovalBatchToDocument(document,batch);
  return document;
}
function localDocument(){
  const {blocks}=detectSections(fixture.pages);
  const source={id:'synthetic-022',fileName:fixture.sourceFilename,sha256:fixture.sourceSha256,effectiveType:'CV'};
  return approved(buildCandidates(parseCvBlocks(blocks),source).map(mapD1408CandidateToUxr));
}
function factual(event){
  return Object.fromEntries(['id','title','categoryId','eventType','startDate','endDate','openEnded','visibilityState','sourceType','provenance','notes','lane'].map(key=>[key,structuredClone(event[key])]));
}

test('022 messy accepted CV imports appear in Saved entries and open prefilled existing entries',()=>{
  const document=localDocument();
  assert.equal(document.events.length,9);
  const targets=document.events.filter(event=>['clinical','work','research'].includes(event.categoryId));
  for(const event of targets){
    assert.equal(beginBuilderEntryEdit(document,event.id),true,event.title);
    assert.equal(builderStepForEvent(event),{clinical:3,work:4,research:5}[event.categoryId]);
    const draft=document.builder.drafts[event.categoryId];
    assert.equal(draft.title,event.title);
    assert.equal(draft.importedEventId,event.id);
    const html=renderBuilder(document);
    assert.ok(html.includes(`data-saved-entry="${event.id}"`));
    assert.match(html,/Review imported entry/);
    assert.doesNotMatch(html,/Exact day required|choose the exact day/);
  }
  const clinical=document.events.find(event=>event.title.startsWith('Observership'));
  assert.equal(clinical.fields.institution,'Mount Sinai Hospital');
  assert.equal(clinical.fields.specialty,'Internal Medicine');
  const elective=document.events.find(event=>event.title.startsWith('Clinical Elective'));
  assert.equal(elective.fields.institution,'Cleveland Clinic');
  assert.equal(elective.fields.specialty,'Cardiology');
  const work=document.events.find(event=>event.title.startsWith('Resident Physician'));
  assert.equal(work.fields.role,'Resident Physician (PGY-1 equivalent)');
  assert.equal(work.fields.organization,'Emergency University Hospital Bucharest');
  const research=document.events.find(event=>event.title.startsWith('Research Assistant'));
  assert.equal(research.fields.role,'Research Assistant');
  assert.equal(research.fields.institution,'Cardiovascular Outcomes Lab, Carol Davila University');
});

test('022 unchanged imported saves preserve canonical facts, evidence, privacy and month/year precision without duplicates',()=>{
  const document=localDocument();
  for(const target of [...document.events].filter(event=>['clinical','work','research'].includes(event.categoryId))){
    const before=factual(target),datePrecision=structuredClone(target.fields.datePrecision);
    assert.equal(beginBuilderEntryEdit(document,target.id),true);
    const draft=document.builder.drafts[target.categoryId];
    const result=commitBuilderEntry(document,target.categoryId,draft);
    assert.equal(result.ok,true,JSON.stringify(result.errors));
    assert.equal(document.events.length,9);
    const current=document.events.find(event=>event.id===target.id);
    assert.deepEqual(factual(current),before);
    assert.deepEqual(current.fields.datePrecision,datePrecision);
    assert.equal(current.fields.importedBuilderEdits022,undefined);
  }
  const volunteer=document.events.find(event=>event.title.startsWith('Volunteer'));
  assert.equal(beginBuilderEntryEdit(document,volunteer.id),true);
  assert.equal(document.builder.drafts.work.startDate,'2019');
  assert.equal(document.builder.drafts.work.endDate,'2021');
  assert.equal(document.builder.drafts.work.country,'','Missing country is not guessed or made mandatory');
  assert.equal(document.builder.drafts.work.kind,'','Volunteer does not automatically mean non-clinical');
  const publication=document.events.find(event=>event.fields.canonicalType==='PUBLICATION');
  assert.equal(publication.eventType,'milestone');
  assert.equal(beginBuilderEntryEdit(document,publication.id),true);
  assert.equal(document.builder.drafts.research.startDate,'2023');
  assert.equal(document.builder.drafts.research.endDate,'');
});

test('022 legacy CV imports work without mutating event facts just to open or render them',()=>{
  const document=localDocument();
  for(const event of document.events){delete event.fields.builderDomain;delete event.fields.builderEntryId;}
  const before=structuredClone(document.events);
  const target=document.events.find(event=>event.categoryId==='clinical');
  assert.equal(beginBuilderEntryEdit(document,target.id),true);
  assert.match(renderBuilder(document),/Review imported entry/);
  assert.deepEqual(document.events,before);
  const draft={...document.builder.drafts.clinical,notes:'Student-reviewed note'};
  const result=commitBuilderEntry(document,'clinical',draft);
  assert.equal(result.ok,true);
  assert.equal(document.events.length,9);
  assert.equal(result.event.id,target.id);
  assert.deepEqual(result.event.provenance,target.provenance);
  assert.equal(result.event.sourceType,'document-intake');
  assert.equal(result.event.visibilityState,'ADVISOR_ONLY');
  assert.equal(result.event.fields.importedBuilderEdits022.at(-1).changes[0].basis,'STUDENT_CHANGE');
  assert.equal(deleteBuilderEntry(document,target.id),true);
  assert.equal(document.events.length,8);
});

test('022 source-backed structured field projection keeps unknowns and unsupported wording empty',()=>{
  const event={id:'unknown',sourceType:'document-intake',categoryId:'clinical',title:'Observership, Cardiology, Invented Hospital',fields:{},provenance:[{sourceExcerpt:'Observership in Cardiology, institution not provided'}]};
  const fields=importedBuilderFields022(event);
  assert.equal(fields.institution,undefined);
  assert.equal(fields.specialty,undefined);
  assert.deepEqual(event.fields,{});
  const noSource={...event,provenance:[]};
  assert.deepEqual(importedBuilderFields022(noSource),{});
});

test('022 reviewed date corrections retain precision and reject invalid ranges or mismatched imported IDs',()=>{
  const event=localDocument().events.find(event=>event.title.startsWith('Volunteer'));
  const draft=importedBuilderDraft022(event);
  const corrected=updateImportedBuilderEvent022(event,{...draft,endDate:'2022'});
  assert.equal(corrected.ok,true);
  assert.equal(corrected.event.endDate,'2022-12');
  assert.deepEqual(corrected.event.fields.datePrecision,{start:'YEAR',end:'YEAR'});
  assert.deepEqual(corrected.event.provenance,event.provenance);
  assert.equal(updateImportedBuilderEvent022(event,{...draft,endDate:'2018'}).ok,false);
  assert.equal(updateImportedBuilderEvent022(event,{...draft,startDate:'Feb 31, 2020'}).ok,false);
  assert.equal(updateImportedBuilderEvent022(event,{...draft,importedEventId:'different'}).ok,false);
});

test('022 recorded provider fixture retains institution/specialty and prefills explicit research role without a new provider call',()=>{
  const candidates=providerFixture.providerCandidates;
  assert.ok(Array.isArray(candidates));
  const source={id:'controlled-recorded-fixture',objectId:'controlled-recorded-fixture',sha256:providerFixture.sourceSha256||'a'.repeat(64),fileName:'controlled.pdf'};
  const document=approved(candidates.map(candidate=>mapCvIntelligenceCandidateToUxr(candidate,{sourceDocument:source,sourceBlocks:providerFixture.providerSourceBlocks})));
  const clinical=document.events.find(event=>event.categoryId==='clinical');
  assert.equal(beginBuilderEntryEdit(document,clinical.id),true);
  assert.equal(document.builder.drafts.clinical.institution,'Lakeside Community Hospital');
  assert.equal(document.builder.drafts.clinical.specialty,'Internal Medicine');
  const research=document.events.find(event=>event.categoryId==='research');
  assert.equal(beginBuilderEntryEdit(document,research.id),true);
  assert.equal(document.builder.drafts.research.role,'Cardiology Research Fellow');
  assert.equal(document.builder.drafts.research.institution,'Meridian Research Institute');
});

test('022 actual Canvas Details renders imported month/year precision and retains sharing and normal manual day controls',()=>{
  const document=localDocument();
  const clinical=document.events.find(event=>event.categoryId==='clinical');
  const before=structuredClone(clinical);
  const html=renderCanvasDetails({step:3},clinical,document);
  assert.match(html,/data-canvas-imported-date="startDate" value="2023-07"/);
  assert.match(html,/data-canvas-imported-date="endDate" value="2023-08"/);
  assert.doesNotMatch(html,/Exact day required|choose the exact day/);
  assert.match(html,/Recipient sharing/);
  assert.match(html,/data-canvas-variant-visible/);
  assert.match(html,/data-canvas-detail-key="visibilityState"/);
  assert.deepEqual(clinical,before,'Opening Details does not rewrite the canonical event');
  const manual=renderCanvasDetails({step:3},{...clinical,sourceType:'guided-builder'},document);
  assert.match(manual,/data-canvas-rotation-date="rotationStartDate"/);
  const publication=document.events.find(event=>event.fields.canonicalType==='PUBLICATION');
  const publicationHtml=renderCanvasDetails({step:5},publication,document);
  assert.match(publicationHtml,/data-canvas-imported-date="startDate" value="2023"/);
  assert.doesNotMatch(publicationHtml,/data-canvas-imported-date="endDate"/);
});

test('022 Canvas imported saves preserve source facts and privacy; explicit dates, notes and sharing update only the selected entry',()=>{
  const document=localDocument();
  const clinical=document.events.find(event=>event.categoryId==='clinical');
  const before=structuredClone(clinical);
  const noop=updateImportedCanvasDetails022(clinical,{keys:{title:clinical.title,visibilityState:clinical.visibilityState},fields:{current:false},dates:{startDate:'2023-07',endDate:'2023-08'},exportAudiences:[]});
  assert.equal(noop.ok,true);
  assert.deepEqual(noop.event,clinical);
  const result=updateImportedCanvasDetails022(clinical,{keys:{notes:'Student correction'},fields:{current:false},dates:{startDate:'2023-07',endDate:'2023-09'},exportAudiences:['LOR_WRITER']});
  assert.equal(result.ok,true);
  assert.equal(result.event.id,clinical.id);
  assert.equal(result.event.startDate,'2023-07');
  assert.equal(result.event.endDate,'2023-09');
  assert.equal(result.event.notes,'Student correction');
  assert.equal(result.event.visibilityState,'ADVISOR_ONLY');
  assert.equal(result.event.sourceType,'document-intake');
  assert.deepEqual(result.event.fields.datePrecision,{start:'MONTH',end:'MONTH'});
  assert.deepEqual(result.event.provenance,clinical.provenance);
  assert.deepEqual(result.event.fields.exportAudiences,['LOR_WRITER']);
  assert.deepEqual(clinical,before,'The pure updater does not mutate another document reference');
  assert.equal(updateImportedCanvasDetails022(clinical,{dates:{endDate:'2022'}}).ok,false);
});

test('022 Canvas preserves ongoing imports and year-only publications without manufacturing missing dates',()=>{
  const document=localDocument();
  const clinical=document.events.find(event=>event.categoryId==='clinical');
  const ongoing={...clinical,openEnded:true,endDate:null};
  const rendered=renderCanvasDetails({step:3},ongoing,{...document,events:[ongoing]});
  assert.match(rendered,/data-canvas-detail-field="current" checked/);
  const unchanged=updateImportedCanvasDetails022(ongoing,{fields:{current:true},dates:{startDate:'2023-07',endDate:''}});
  assert.equal(unchanged.event.openEnded,true);
  assert.equal(unchanged.event.endDate,null);
  assert.deepEqual(unchanged.event.provenance,ongoing.provenance);
  const publication=document.events.find(event=>event.fields.canonicalType==='PUBLICATION');
  const saved=updateImportedCanvasDetails022(publication,{dates:{startDate:'2023'}});
  assert.deepEqual(factual(saved.event),factual(publication));
  assert.deepEqual(saved.event.fields.datePrecision,publication.fields.datePrecision);
});

test('022 actual inline 407F renderer lists legacy imports and uses source-preserving form, reading and validation',async()=>{
  const document=localDocument();
  for(const event of document.events){delete event.fields.builderDomain;delete event.fields.builderEntryId;}
  const clinical=document.events.find(event=>event.categoryId==='clinical');
  const draft=importedBuilderDraft022(clinical);
  const api={
    entryDomain:id=>builderDomain022(document.events.find(event=>event.id===id)),
    importedSummary:id=>{const event=document.events.find(item=>item.id===id);return isImportedBuilderEvent022(event)?importedBuilderSummary022(event):null;},
    importedMarkup:(domain,value)=>renderImportedBuilderForm022(value,domain),
    readImportedForm:importedDraftFromForm022,
    validateImportedDraft:validateImportedBuilderDraft022
  };
  const context=vm.createContext({
    window:{D1_407F_ENGINEERING:{domain:api}},
    state:{user:{events:document.events.map(documentEventTo407F)},builder:{domainDrafts:{clinical:draft},domainEditing:{clinical:`imported:${clinical.id}`}}},
    esc:value=>String(value??'').replaceAll('&','&amp;').replaceAll('"','&quot;'),CATS:{},lorStatusForEvent404:()=>null
  });
  const source=await readFile(new URL('../web/index.html',import.meta.url),'utf8');
  for(const name of ['domainDefaults404','domainDraft404','domainEvents404','domainSavedSummary404','domainSavedList404','domainStepMarkup404','domainFormData404','domainErrors404']){
    const match=source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`));
    assert.ok(match,name);vm.runInContext(match[0],context);
  }
  assert.equal(context.domainEvents404('clinical').length,2);
  assert.equal(context.domainEvents404('work').length,2);
  assert.equal(context.domainEvents404('research').length,2);
  const html=context.domainStepMarkup404(3);
  assert.match(html,/Review imported entry/);
  assert.match(html,/data-domain-form="clinical"/);
  assert.match(html,/data-domain-save="clinical"/);
  assert.match(html,/name="startDate"[^>]*value="2023-07"/);
  assert.doesNotMatch(html,/Exact day required|choose the exact.*day/);
  const controls=['title','startDate','endDate'].map(key=>({dataset:{importedField:key},type:'text',value:draft[key]}));
  const form={querySelectorAll:selector=>{assert.equal(selector,'[data-imported-field]');return controls;}};
  const entry=context.domainFormData404(form,'clinical');
  assert.equal(entry.startDate,'2023-07');
  assert.equal(entry.endDate,'2023-08');
  assert.deepEqual(context.domainErrors404('clinical',entry),{});
  const saved=updateImportedBuilderEvent022(clinical,entry);
  assert.equal(saved.ok,true);
  assert.deepEqual(factual(saved.event),factual(clinical));
  assert.ok(html.includes(`data-domain-edit="${clinical.id}"`));
});
