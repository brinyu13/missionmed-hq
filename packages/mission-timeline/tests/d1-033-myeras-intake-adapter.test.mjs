import assert from 'node:assert/strict';
import test from 'node:test';
import {MYERAS_SOURCE_SCHEMA,normalizeMyerasSources,createMyerasIntakeAdapter,resolveMyerasConflict,myerasReviewErrors} from '../web/js/uxr-002/myeras-intake-adapter.js';
import {IntakeStateMachine,buildApprovalBatch,applyApprovalBatchToDocument,validateCandidateForApproval,renderIntake,acceptedCount,hydrateIntakeState} from '../web/js/uxr-002/intake.js';
import {resolveMyerasDuplicate} from '../web/js/uxr-002/myeras-intake-ui.js';
import {projectPresentationFields} from '../web/js/presentation/presentation-field-privacy.js';
import {defaultDocument,TimelineStore} from '../web/js/uxr-002/store.js';
const entry=patch=>({id:'role-1',title:'Synthetic research assistant',categoryId:'research',canonicalType:'RESEARCH_EXPERIENCE',institution:'Synthetic Institute',startDate:'2023-01',endDate:'2023-05',description:'Source-stated responsibility',confidence:'high',...patch});
const source=(id,entries,patch={})=>({id,kind:id==='cv'?'CV':'MYERAS_SECTION',label:`Synthetic ${id}`,entries,...patch});
const envelope=sources=>({schemaVersion:MYERAS_SOURCE_SCHEMA,sources});
function review(sources,options={}){const result=normalizeMyerasSources(envelope(sources),options);const machine=new IntakeStateMachine({existingEvents:options.existingEvents||[],narrationDelay:null});machine.dispatch({type:'EXTRACTION_SUCCEEDED',...result});return machine;}
const batch=machine=>buildApprovalBatch(machine.snapshot(),machine.existingEvents,{idFactory:()=> 'synthetic-event'});

test('CV and section exact repeats coalesce once, keep both sources and begin undecided',()=>{
  const machine=review([source('cv',[entry()]),source('section',[entry()])]);const state=machine.snapshot();
  assert.equal(state.candidates.length,1);assert.equal(state.candidates[0].provenance.length,2);assert.equal(state.candidates[0].decision,'undecided');assert.equal(state.candidates[0].visibilityState,'ADVISOR_ONLY');
  assert.deepEqual(state.candidates[0].fields.myerasReview.variants.map(item=>item.sourceId),['cv','section']);assert.doesNotMatch(renderIntake(state),/intake-provider-receipt/);assert.throws(()=>batch(machine),/Nothing accepted/);
});
test('same-title distinct dates remain separate, and category disagreements are reviewed',()=>{
  const machine=review([source('cv',[entry()]),source('section',[entry({startDate:'2024-01',endDate:'2024-05',categoryId:'work'})])]);
  assert.equal(machine.state.candidates.length,2);assert.throws(()=>machine.decideCandidate(machine.state.candidates[0].id,'accepted'),/possible duplicates/);
  resolveMyerasDuplicate(machine,machine.state.candidates[0].id,machine.state.candidates[1].id,'candidate','separate');
  machine.decideCandidate(machine.state.candidates[0].id,'accepted');assert.throws(()=>batch(machine),/remaining MyERAS/);assert.equal(machine.state.candidates[1].decision,'undecided');machine.decideCandidate(machine.state.candidates[1].id,'rejected');assert.equal(batch(machine).additions.length,1);
});
test('source A/B values stay immutable while each conflict requires explicit resolution',()=>{
  const machine=review([source('cv',[entry({recordKey:'experience-one',startDate:'2020',endDate:'2022'})]),source('section',[entry({recordKey:'experience-one',startDate:'2020-04',endDate:'2022-06'})])]);
  const candidate=machine.state.candidates[0],original=structuredClone(candidate.fields.myerasReview.variants);
  assert.equal(machine.state.candidates.length,1);machine.state.suggestions=[{id:'generic',status:'open'}];machine.dismissSuggestion('generic');
  assert.throws(()=>machine.decideCandidate(candidate.id,'accepted'),/source conflicts/);
  let next=resolveMyerasConflict(candidate,'conflict:startDate',{choiceIndex:0});next=resolveMyerasConflict(next,'conflict:endDate',{choiceIndex:0});machine.editCandidate(candidate.id,next);machine.decideCandidate(candidate.id,'accepted');
  const imported=batch(machine).additions[0];assert.deepEqual(imported.fields.datePrecision,{start:'YEAR',end:'YEAR'});assert.deepEqual(imported.fields.myerasReview.variants,original);assert.equal(imported.startDate,'2020-01');assert.equal(imported.endDate,'2022-12');
});
test('same experience merges source variants rather than dropping either candidate evidence',()=>{
  const machine=review([source('cv',[entry()]),source('section',[entry({startDate:'2023-02',description:'Other source description'})])]);const [a,b]=machine.state.candidates;
  resolveMyerasDuplicate(machine,a.id,b.id,'candidate','same');assert.equal(machine.state.candidates[1].decision,'rejected');assert.equal(machine.state.candidates[0].provenance.length,2);assert.ok(machine.state.candidates[0].fields.myerasReview.conflicts.length);
  assert.throws(()=>machine.decideCandidate(a.id,'accepted'),/source conflicts/);assert.throws(()=>machine.decideCandidate(b.id,'accepted'),/merged|possible duplicates/);
});
test('existing-event merge preserves chosen dates instead of silently widening the range',()=>{
  const existing={id:'existing',title:entry().title,categoryId:'research',siteName:'Synthetic Institute',startDate:'2023-01',endDate:'2023-06',eventType:'duration',visibilityState:'ADVISOR_ONLY',fields:{description:entry().description},provenance:[{id:'prior',sourceExcerpt:'Original evidence'}]};
  const machine=review([source('section',[entry()])],{existingEvents:[existing]});const id=machine.state.candidates[0].id;resolveMyerasDuplicate(machine,id,'existing','event','same');
  let candidate=machine.state.candidates[0];for(const conflict of candidate.fields.myerasReview.conflicts)candidate=resolveMyerasConflict(candidate,conflict.id,{choiceIndex:0});machine.editCandidate(id,candidate);machine.decideCandidate(id,'merge');
  const document={events:[structuredClone(existing)],studentProfile:{}};applyApprovalBatchToDocument(document,batch(machine));assert.equal(document.events.length,1);assert.equal(document.events[0].endDate,'2023-05');assert.ok(document.events[0].provenance.some(item=>item.id==='prior'));
});
test('exact days survive approval, invalid calendar dates fail, partial end month is not forced to a day',()=>{
  assert.throws(()=>normalizeMyerasSources(envelope([source('cv',[entry({startDate:'2023-02-30'})])])),/invalid calendar/);
  const machine=review([source('cv',[entry({startDate:'2024-02-29',endDate:'2024-03-20'})])]);const candidate=machine.state.candidates[0];machine.decideCandidate(candidate.id,'accepted');const imported=batch(machine).additions[0];assert.equal(imported.startDate,'2024-02-29');assert.deepEqual(imported.fields.datePrecision,{start:'DAY',end:'DAY'});
  assert.deepEqual(validateCandidateForApproval({...candidate,startDate:'2024-03-20',endDate:'2024-03'}),{});
  assert.ok(validateCandidateForApproval({...candidate,startDate:'2024-03-32'}).startDate);
  machine.editCandidate(candidate.id,{startDate:'2024-02'});assert.equal(machine.state.candidates[0].fields.datePrecision.start,'MONTH');assert.equal(machine.state.candidates[0].fields.myerasCorrections[0].basis,'STUDENT_CHANGE');assert.equal(machine.state.candidates[0].fields.myerasReview.variants[0].dates.start.raw,'2024-02-29');
});
test('unknown dates and categories stay quarantined without invented facts',()=>{
  const machine=review([source('cv',[entry({startDate:'Spring during training',endDate:'',categoryId:'unknown'})])]);const candidate=machine.state.candidates[0];assert.equal(candidate.startDate,'');assert.equal(candidate.categoryId,'');assert.equal(candidate.fields.sourceDateWording.start.raw,'Spring during training');
  assert.throws(()=>machine.decideCandidate(candidate.id,'accepted'),/category/);machine.editCandidate(candidate.id,{categoryId:'research',startDate:'2022',endDate:'2023'});assert.equal(machine.state.candidates[0].fields.datePrecision.start,'YEAR');
});
test('identifier allowlist and parser errors cannot leak source payload in error messages',async()=>{
  const input=envelope([source('cv',[entry()],{aamcId:'DO-NOT-PRINT'})]);assert.throws(()=>normalizeMyerasSources(input),error=>!error.message.includes('DO-NOT-PRINT')&&error.message.includes('unsupported field'));
  assert.throws(()=>normalizeMyerasSources(envelope([source('cv',[],{profile:{email:'DO-NOT-PRINT'}})])),/unsupported field email/);
  const adapter=createMyerasIntakeAdapter();await assert.rejects(adapter.extract({file:{myerasStructured:true,text:async()=>'{DO-NOT-PRINT'},signal:null}),error=>error.message==='The structured import must be valid JSON.');
});
test('profile-only claims use explicit choices, preserve current values, and retain audience after reopen',()=>{
  const existingProfile={fullName:'Synthetic Current Name'};const machine=review([source('section',[],{profile:{fullName:'Synthetic Source Name',currentUsWorkAuthorization:'Other',workAuthorizationOther:'Synthetic authorization',specialtyGoal:'Internal Medicine',graduationDate:'2020'}})],{existingProfile});
  assert.equal(machine.state.stage,'review');assert.equal(machine.state.candidates.length,0);assert.equal(acceptedCount(machine.state),0);assert.throws(()=>machine.dispatch({type:'MYERAS_PROFILE_REVIEW',id:'profile:fullName',decision:'accepted'}),/Choose/);
  for(const claim of machine.state.extraction.parser.myerasProfileReview.claims){machine.dispatch({type:'MYERAS_PROFILE_REVIEW',id:claim.id,choiceIndex:claim.field==='fullName'?1:0});machine.dispatch({type:'MYERAS_PROFILE_REVIEW',id:claim.id,decision:'accepted'});}
  machine.dispatch({type:'MYERAS_PROFILE_REVIEW',id:'profile:specialtyGoal',visibilityState:'INTERVIEWER_SAFE'});
  assert.match(renderIntake(machine.state),/Apply 5 reviewed profile facts/);assert.equal(acceptedCount(machine.state),5);
  const document={events:[],studentProfile:structuredClone(existingProfile)};applyApprovalBatchToDocument(document,batch(machine));const reopened=JSON.parse(JSON.stringify(document));
  assert.equal(reopened.events.length,0);assert.equal(reopened.studentProfile.fullName,existingProfile.fullName);assert.equal(reopened.studentProfile.fieldProvenance.specialtyGoal.sourceType,'myeras-profile-intake');assert.equal(reopened.studentProfile.graduationDate,'2020');
  const safe=projectPresentationFields(reopened,{allowed:new Set(['INTERVIEWER_SAFE']),visibleEventIds:new Set()}).studentProfile;
  assert.equal(safe.specialtyGoal,'Internal Medicine');assert.equal(safe.currentUsWorkAuthorization,undefined);assert.equal(safe.graduationDate,undefined);
  const advisor=projectPresentationFields(reopened,{allowed:new Set(['ADVISOR_ONLY','INTERVIEWER_SAFE']),visibleEventIds:new Set()}).studentProfile;assert.equal(advisor.currentUsWorkAuthorization,'Other');assert.equal(advisor.workAuthorizationOther,'Synthetic authorization');assert.equal(advisor.graduationDate,'2020');
  const stale={events:[],studentProfile:{fullName:'Different current value'}};assert.throws(()=>applyApprovalBatchToDocument(stale,batch(machine)),/profile changed/);assert.deepEqual(stale.events,[]);
  assert.equal(hydrateIntakeState(machine.snapshot()).extraction.parser.myerasProfileReview.claims.length,5);
});
test('exam facts preserve explicit result, score and attempt without guessing a result',()=>{
  const machine=review([source('cv',[entry({categoryId:'exams',title:'Step 2 CK',canonicalType:'STEP_2_CK',eventType:'milestone',startDate:'2023-05-19',endDate:null,examSystem:'USMLE',examName:'Step 2 CK',score:'245',attempt:2,result:''})])]);machine.decideCandidate(machine.state.candidates[0].id,'accepted');const imported=batch(machine);assert.equal(imported.examReviewQueue[0].result,'');assert.equal(imported.examReviewQueue[0].attempt,2);assert.equal(imported.examReviewQueue[0].examDate,'2023-05-19');
  const document={events:[],studentProfile:{}};applyApprovalBatchToDocument(document,imported);assert.equal(document.exams[0].result,'');assert.equal(document.exams[0].attempt,2);
});
test('real store approval saves one version, changes one undo step, and reopens durable profile privacy',async()=>{
  const rows=new Map();const adapter={atomicPut:async operations=>{for(const {store,key,value} of operations)rows.set(`${store}:${key}`,structuredClone(value));},open:async()=>{},get:async(table,id)=>structuredClone(rows.get(`${table}:${id}`)||null),put:async(table,value)=>{rows.set(`${table}:${value.id}`,structuredClone(value));},list:async(table,filter)=>[...rows.entries()].filter(([key])=>key.startsWith(table+':')).map(([,value])=>structuredClone(value)).filter(filter||(()=>true))};
  const entitlement={schemaVersion:'d1-405.timeline-entitlement.1',access:'FULL',verified:true,canRead:true,canCreate:true,canMutate:true,canExport:true};const store=new TimelineStore({adapter,entitlement});
  const machine=review([source('section',[],{profile:{specialtyGoal:'Synthetic goal'}})]);machine.dispatch({type:'MYERAS_PROFILE_REVIEW',id:'profile:specialtyGoal',choiceIndex:0});machine.dispatch({type:'MYERAS_PROFILE_REVIEW',id:'profile:specialtyGoal',decision:'accepted'});
  assert.equal(store.document.studentProfile.specialtyGoal,undefined);await machine.approveAccepted({saveVersion:(name,kind)=>store.saveVersion(name,kind),applyBatch:async(batch,contract)=>{let result;store.mutate(contract.label,document=>{result=applyApprovalBatchToDocument(document,batch);});return result;}});
  assert.equal((await store.listVersions()).length,1);assert.equal(store.undoStack.length,1);await store.saveNow();
  const reopened=new TimelineStore({adapter,entitlement});await reopened.initialize();assert.equal(reopened.document.studentProfile.specialtyGoal,'Synthetic goal');assert.equal(reopened.document.studentProfile.fieldProvenance.specialtyGoal.visibilityState,'ADVISOR_ONLY');
  store.undo();assert.equal(store.document.studentProfile.specialtyGoal,undefined);clearTimeout(store.timer);clearTimeout(reopened.timer);clearTimeout(store.entitlementTimer);clearTimeout(reopened.entitlementTimer);
});

 test('nonconflicting later source facts supplement the normalized candidate with field evidence',()=>{
  const machine=review([source('cv',[entry({recordKey:'shared',description:'',role:''})]),source('section',[entry({recordKey:'shared',description:'Source-stated fuller description',role:'Research fellow'})])]);
  const candidate=machine.state.candidates[0];assert.equal(candidate.fields.description,'Source-stated fuller description');assert.equal(candidate.fields.role,'Research fellow');assert.deepEqual(candidate.fields.myerasFieldProvenance.role.sourceIds,['section']);assert.equal(candidate.fields.myerasReview.conflicts.length,0);
 });
 test('repeated source record ids and generated fallback collisions fail before review',()=>{
  assert.throws(()=>normalizeMyerasSources(envelope([source('cv',[entry(),entry({startDate:'2024-01'})])])),/Entry ids must be unique/);
  assert.throws(()=>normalizeMyerasSources(envelope([source('cv',[entry({id:'1'}),entry({id:undefined,startDate:'2024-01'})])])),/Entry ids must be unique/);
 });
 test('merged source cannot be reused in a second canonical group',()=>{
  const machine=review([source('cv',[entry()]),source('section',[entry({startDate:'2023-02'})]),source('third',[entry({startDate:'2023-03'})])]);const [a,b,c]=machine.state.candidates;
  resolveMyerasDuplicate(machine,a.id,b.id,'candidate','same');assert.throws(()=>resolveMyerasDuplicate(machine,b.id,c.id,'candidate','same'),/already belongs/);assert.equal(machine.state.candidates[1].fields.myerasReview.mergedInto,a.id);
 });
 test('choosing the later year-only source preserves its precision through the intake edit seam',()=>{
  const machine=review([source('cv',[entry({recordKey:'shared',startDate:'2020-04',endDate:'2022-06'})]),source('section',[entry({recordKey:'shared',startDate:'2020',endDate:'2022'})])]);let next=machine.state.candidates[0];next=resolveMyerasConflict(next,'conflict:startDate',{choiceIndex:1});next=resolveMyerasConflict(next,'conflict:endDate',{choiceIndex:1});machine.editCandidate(next.id,next);machine.decideCandidate(next.id,'accepted');assert.deepEqual(batch(machine).additions[0].fields.datePrecision,{start:'YEAR',end:'YEAR'});
 });

 test('existing merge keeps reviewed complementary fields and the more private audience',()=>{
  const existing={id:'reviewed-work',title:'Synthetic role',categoryId:'work',siteName:'Synthetic Institute',startDate:'2023-01',endDate:'2023-05',eventType:'duration',visibilityState:'INTERVIEWER_SAFE',fields:{role:'Known reviewed role',city:'Known reviewed city',specialty:'Original specialty'},provenance:[]};
  const machine=review([source('section',[entry({title:'Synthetic role',categoryId:'work',canonicalType:'',description:'',specialty:'Private incoming specialty'})])],{existingEvents:[existing]});const id=machine.state.candidates[0].id;resolveMyerasDuplicate(machine,id,existing.id,'event','same');
  assert.ok(machine.state.candidates[0].fields.myerasReview.conflicts.some(item=>item.field==='specialty'));let candidate=machine.state.candidates[0];for(const conflict of candidate.fields.myerasReview.conflicts)candidate=resolveMyerasConflict(candidate,conflict.id,{choiceIndex:0});machine.editCandidate(id,candidate);machine.decideCandidate(id,'merge');const document={events:[existing],studentProfile:{}};applyApprovalBatchToDocument(document,batch(machine));assert.equal(document.events[0].fields.role,'Known reviewed role');assert.equal(document.events[0].fields.city,'Known reviewed city');assert.equal(document.events[0].fields.specialty,'Private incoming specialty');assert.equal(document.events[0].visibilityState,'ADVISOR_ONLY');assert.match(document.events[0].fields.myerasReview.mergePrivacyNotice,/more private audience/);
 });

 test('human boolean corrections are typed and cannot fabricate ongoing history',()=>{
  const machine=review([source('cv',[entry({recordKey:'shared',openEnded:false})]),source('section',[entry({recordKey:'shared',openEnded:true})])]);const candidate=machine.state.candidates[0];
  assert.throws(()=>resolveMyerasConflict(candidate,'conflict:openEnded',{value:'anything',reason:'Synthetic correction evidence'}),/true or false/);
  const corrected=resolveMyerasConflict(candidate,'conflict:openEnded',{value:'false',reason:'Synthetic correction evidence'});machine.editCandidate(candidate.id,corrected);machine.decideCandidate(candidate.id,'accepted');const applied=batch(machine).additions[0];assert.equal(applied.openEnded,false);assert.equal(applied.endDate,'2023-05');assert.equal(applied.fields.myerasReview.conflicts[0].resolution.value,false);
 });
 test('reviewed school replacement clears stale registry identity and exact graduation source stays in provenance',()=>{
  const existingProfile={medicalSchool:'Old synthetic school',canonicalSchoolId:'stale-id',medicalSchoolRecord:{id:'stale-id'}};
  const machine=review([source('section',[],{profile:{medicalSchool:'New synthetic school',graduationDate:'2024-05-19'}})],{existingProfile});for(const claim of machine.state.extraction.parser.myerasProfileReview.claims){machine.dispatch({type:'MYERAS_PROFILE_REVIEW',id:claim.id,choiceIndex:0});machine.dispatch({type:'MYERAS_PROFILE_REVIEW',id:claim.id,decision:'accepted'});}
  const document={events:[],studentProfile:existingProfile};applyApprovalBatchToDocument(document,batch(machine));assert.equal(document.studentProfile.canonicalSchoolId,'');assert.equal(document.studentProfile.medicalSchoolRecord,null);assert.equal(document.studentProfile.graduationDate,'2024-05');assert.equal(document.studentProfile.fieldProvenance.graduationDate.sourceDate,'2024-05-19');assert.equal(document.studentProfile.fieldProvenance.graduationDate.sourceDatePrecision,'DAY');
 });

 test('category and institution choices update the actual approved site without stale aliases',()=>{
  const machine=review([source('cv',[entry({recordKey:'shared',institution:'Source A lab'})]),source('section',[entry({recordKey:'shared',categoryId:'work',institution:'Source B organization'})])]);let candidate=machine.state.candidates[0];candidate=resolveMyerasConflict(candidate,'conflict:institution',{choiceIndex:1});candidate=resolveMyerasConflict(candidate,'conflict:categoryId',{choiceIndex:1});machine.editCandidate(candidate.id,candidate);machine.decideCandidate(candidate.id,'accepted');const event=batch(machine).additions[0];assert.equal(event.categoryId,'work');assert.equal(event.siteName,'Source B organization');assert.equal(event.fields.organization,'Source B organization');assert.equal(event.fields.institution,undefined);assert.equal(event.fields.myerasReview.variants[0].values.institution,'Source A lab');
 });
 test('local identity types and encoded components prevent numeric, whitespace and colon collisions',()=>{
  assert.throws(()=>normalizeMyerasSources(envelope([source(1,[entry()]),source('1',[entry()])])),/Source ids/);
  assert.throws(()=>normalizeMyerasSources(envelope([source(' cv',[entry()])])),/Source ids/);
  assert.throws(()=>normalizeMyerasSources(envelope([source('cv',[entry({id:1})])])),/Entry id/);
  const result=normalizeMyerasSources(envelope([source('a:b',[entry({id:'c',title:'One synthetic role'})]),source('a',[entry({id:'b:c',title:'Other synthetic role'})])]));assert.equal(new Set(result.candidates.map(candidate=>candidate.id)).size,2);
 });

 test('explicit duplicate merge supplements a missing role without silently choosing differing dates',()=>{
  const machine=review([source('cv',[entry({role:''})]),source('section',[entry({startDate:'2023-02',role:'Source research fellow'})])]);const [a,b]=machine.state.candidates;resolveMyerasDuplicate(machine,a.id,b.id,'candidate','same');assert.equal(machine.state.candidates[0].fields.role,'Source research fellow');assert.deepEqual(machine.state.candidates[0].fields.myerasFieldProvenance.role.sourceIds,['section']);assert.ok(machine.state.candidates[0].fields.myerasReview.conflicts.some(item=>item.field==='startDate'));
 });

 test('source ongoing state survives expanded category fields and explicit conflict choice',()=>{
  const machine=review([source('cv',[entry({recordKey:'shared',endDate:null,openEnded:false})]),source('section',[entry({recordKey:'shared',endDate:null,openEnded:true})])]);let candidate=resolveMyerasConflict(machine.state.candidates[0],'conflict:openEnded',{choiceIndex:1});machine.editCandidate(candidate.id,candidate);assert.equal(machine.state.candidates[0].openEnded,true);assert.equal(machine.state.candidates[0].fields.ongoing,true);machine.editCandidate(candidate.id,{fields:{ongoing:true}});machine.decideCandidate(candidate.id,'accepted');assert.equal(batch(machine).additions[0].openEnded,true);
 });

 test('partial MyERAS approval stays open until every experience and profile claim has an explicit decision',()=>{
  const machine=review([source('cv',[entry({id:'one'}),entry({id:'two',title:'Different synthetic experience'})],{profile:{fullName:'Synthetic Person',specialtyGoal:'Synthetic goal'}})]);machine.decideCandidate(machine.state.candidates[0].id,'accepted');assert.throws(()=>batch(machine),/remaining MyERAS/);assert.match(renderIntake(machine.state),/data-intake-action="approve" disabled/);machine.decideCandidate(machine.state.candidates[1].id,'deferred');assert.throws(()=>batch(machine),/remaining MyERAS/);machine.decideCandidate(machine.state.candidates[1].id,'rejected');machine.dispatch({type:'MYERAS_PROFILE_REVIEW',id:'profile:fullName',choiceIndex:0});machine.dispatch({type:'MYERAS_PROFILE_REVIEW',id:'profile:fullName',decision:'accepted'});assert.throws(()=>batch(machine),/remaining MyERAS/);machine.dispatch({type:'MYERAS_PROFILE_REVIEW',id:'profile:specialtyGoal',decision:'rejected'});assert.equal(batch(machine).additions.length,1);assert.equal(batch(machine).myerasProfileClaims.length,1);assert.equal(batch(machine).analysis.excludedMyerasCandidates.length,1);
 });
