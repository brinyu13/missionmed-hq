import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {applyDocumentTo407FState,apply407FStateToDocument} from '../web/js/407f-engineering-adapter.js';
import {needsResidencyVisaQuestion} from '../web/js/uxr-002/builder.js';
import {TimelineStore,defaultDocument} from '../web/js/uxr-002/store.js';
import {MemoryPersistenceAdapter} from '../web/js/persistence/memory-adapter.js';
import {projectPresentationFields} from '../web/js/presentation/presentation-field-privacy.js';

const authorization='Authorized to work in the U.S.';
const index=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
function sourceBetween(start,end){
 const from=index.indexOf(start),to=index.indexOf(end,from+start.length);
 assert.ok(from>=0&&to>from,`Missing runtime function boundary: ${start}`);
 return index.slice(from,to);
}
// Execute the actual mounted UI functions against synthetic state. Rendering
// callbacks are inert here; this is not a browser/device acceptance claim.
function runtime(state){
 const source=[
  index.match(/^function esc\(s\).*$/m)?.[0],
  index.match(/^const CORE_REQUIRED=.*$/m)?.[0],
  sourceBetween('const WORK_AUTHORIZATION_404=','function announceBuilder404'),
  sourceBetween('function coreInfoValid()','function coreInfoStarted()'),
  sourceBetween('function dateAttributeMarkup404(','function installBuilderDateControls404()'),
  sourceBetween('function coreInfoMarkup()','let schoolRegistryRows404='),
  sourceBetween('function syncCoreInfo()','function showCoreErrors(')
 ].join('\n');
 return runInNewContext(source+'\n({options:WORK_AUTHORIZATION_404,needsQuestion:needsResidencyVisaQuestion404,valid:coreInfoValid,markup:coreInfoMarkup,sync:syncCoreInfo})',{
  state,window:{},COUNTRIES:['Synthetic country'],
  queueUnlistedSchool404(){},renderBuilder404(){},renderBoards(){},renderHud(){},renderHome(){}
 });
}
const binding=(visibilityState='ADVISOR_ONLY')=>({sourceType:'myeras-profile-intake',visibilityState,sourceExcerpt:authorization});
function document(overrides={}){
 const result=defaultDocument();
 result.studentProfile={...result.studentProfile,fullName:'Synthetic Avery',medicalSchool:'Synthetic Medical College',canonicalSchoolId:'synthetic-school',medicalSchoolCountry:'Synthetic country',graduationDate:'2023-05',degree:'MD',currentUsWorkAuthorization:authorization,
  fieldProvenance:{currentUsWorkAuthorization:binding(),graduationDate:{sourceType:'document-intake',sourceEventId:'synthetic-degree',visibilityState:'ADVISOR_ONLY'}},...overrides};
 return result;
}
function stateFor(source){
 const state={user:{events:[]},profile:{},builder:{},media:{}};
 applyDocumentTo407FState(source,state);return state;
}
function selectedAuthorization(html){
 return html.match(/<select[^>]*data-core="visa"[^>]*>([\s\S]*?)<\/select>/)?.[1].match(/<option value="([^"]*)" selected>/)?.[1];
}
const projected=(source,allowed=['INTERVIEWER_SAFE'])=>projectPresentationFields(source,{allowed:new Set(allowed),visibleEventIds:new Set(source.events.map(event=>event.id))}).studentProfile;

test('actual 407F Core Info selects exact authorization wording without requiring a visa subtype',()=>{
 const source=document(),before=JSON.stringify(source),state=stateFor(source),ui=runtime(state);
 assert.ok(ui.options.includes(authorization));assert.equal(state.wiz.visa,authorization);
 assert.equal(selectedAuthorization(ui.markup()),authorization);
 assert.equal(ui.needsQuestion(state.wiz),false);assert.equal(ui.valid(),true);
 assert.doesNotMatch(ui.markup(),/data-core="residencyVisaTypesOpenTo"|data-core="eadStatus"/);
 assert.equal(state.wiz.residencyVisaTypesOpenTo,'');assert.equal(state.wiz.sourceVisaStatus,'');
 assert.equal(JSON.stringify(source),before);
});

test('mounted 407F question behavior retains prior options and agrees with the shared Builder',()=>{
 const ui=runtime(stateFor(document()));
 for(const [visa,eadStatus,expected] of [
  [authorization,'',false],['U.S. Citizen','',false],['Permanent Resident / Green Card','',false],
  ['Employment Authorization Document','Active and unrestricted',false],
  ['Employment Authorization Document','Restricted or expiring',true],['Employment Authorization Document','Not sure',true],
  ['F-1','',true],['J-1','',true],['H-1B','',true],['Other','',true],['Not sure','',true],['','',false]
 ]){
  assert.equal(ui.needsQuestion({visa,eadStatus}),expected,visa);
  assert.equal(ui.needsQuestion({visa,eadStatus}),needsResidencyVisaQuestion({currentUsWorkAuthorization:visa,eadStatus}),visa);
 }
});

test('actual Core Info sync and canonical round trip keep source authorization private without creating a visa alias',()=>{
 const source=document(),before=JSON.stringify(source),state=stateFor(source),ui=runtime(state);
 ui.sync();assert.equal(state.profile.visa,authorization);
 const target=defaultDocument();apply407FStateToDocument(state,target);
 assert.equal(target.studentProfile.currentUsWorkAuthorization,authorization);
 assert.equal(target.studentProfile.visaStatus,'');assert.equal(target.studentProfile.eadStatus,'');
 assert.equal(target.studentProfile.residencyVisaTypesOpenTo,'');
 assert.deepEqual(target.studentProfile.fieldProvenance,source.studentProfile.fieldProvenance);
 assert.equal(projected(target).currentUsWorkAuthorization,undefined);
 assert.equal(projected(target).visaStatus,'');
 assert.equal(projected(target,['INTERVIEWER_SAFE','ADVISOR_ONLY']).currentUsWorkAuthorization,authorization);
 assert.equal(selectedAuthorization(runtime(stateFor(target)).markup()),authorization);
 assert.equal(JSON.stringify(source),before);
});

test('canonical store save/reopen retains actual UI wording and source consent',async()=>{
 const source=document(),state=stateFor(source);runtime(state).sync();
 const adapter=new MemoryPersistenceAdapter(),entitlement={schemaVersion:'d1-405.timeline-entitlement.1',access:'FULL',verified:true,canRead:true,canCreate:true,canMutate:true,canExport:true};
 const store=new TimelineStore({adapter,entitlement});await store.initialize();
 store.mutate('Synthetic 407F Core Info sync',target=>apply407FStateToDocument(state,target));await store.saveNow();
 const reopened=new TimelineStore({adapter,entitlement});await reopened.initialize();
 assert.equal(reopened.document.studentProfile.currentUsWorkAuthorization,authorization);
 assert.equal(reopened.document.studentProfile.visaStatus,'');
 assert.deepEqual(reopened.document.studentProfile.fieldProvenance.currentUsWorkAuthorization,source.studentProfile.fieldProvenance.currentUsWorkAuthorization);
 const ui=runtime(stateFor(reopened.document));assert.equal(selectedAuthorization(ui.markup()),authorization);assert.equal(ui.valid(),true);
 assert.equal(projected(reopened.document).currentUsWorkAuthorization,undefined);
 for(const instance of [store,reopened]){clearTimeout(instance.timer);clearTimeout(instance.entitlementTimer);}
});

test('authorization-only UI preserves a separately supplied visa fact and its independent source binding',()=>{
 const visaBinding={sourceType:'myeras-profile-intake',visibilityState:'ADVISOR_ONLY',sourceExcerpt:'Synthetic explicitly supplied F-1 fact'};
 const source=document({visaStatus:'F-1',fieldProvenance:{currentUsWorkAuthorization:binding(),visaStatus:visaBinding}});
 const state=stateFor(source);runtime(state).sync();
 const target=defaultDocument();apply407FStateToDocument(state,target);
 assert.equal(target.studentProfile.currentUsWorkAuthorization,authorization);
 assert.equal(target.studentProfile.visaStatus,'F-1');
 assert.deepEqual(target.studentProfile.fieldProvenance.visaStatus,visaBinding);
 assert.equal(projected(target).visaStatus,undefined);
 assert.equal(projected(target).currentUsWorkAuthorization,undefined);
});

test('legacy authorization aliases retain source consent in either canonical field direction',()=>{
 for(const field of ['currentUsWorkAuthorization','visaStatus']){
  const source=document({currentUsWorkAuthorization:field==='currentUsWorkAuthorization'?authorization:'',visaStatus:authorization,fieldProvenance:{[field]:binding()}});
  const before=JSON.stringify(source),state=stateFor(source);runtime(state).sync();
  const target=defaultDocument();apply407FStateToDocument(state,target);
  assert.equal(target.studentProfile.currentUsWorkAuthorization,authorization);assert.equal(target.studentProfile.visaStatus,authorization);
  assert.deepEqual(target.studentProfile.fieldProvenance.currentUsWorkAuthorization,binding());
  assert.deepEqual(target.studentProfile.fieldProvenance.visaStatus,binding());
  assert.equal(projected(target).currentUsWorkAuthorization,undefined);assert.equal(projected(target).visaStatus,undefined);
  assert.equal(JSON.stringify(source),before);
 }
});

test('public source wording stays public and more recent canonical consent wins over a stale state copy',()=>{
 const source=document({fieldProvenance:{currentUsWorkAuthorization:binding('INTERVIEWER_SAFE')}}),state=stateFor(source);
 const publicTarget=defaultDocument();apply407FStateToDocument(state,publicTarget);
 assert.equal(projected(publicTarget).currentUsWorkAuthorization,authorization);
 const privateTarget=document({fieldProvenance:{currentUsWorkAuthorization:binding('ADVISOR_ONLY')}});
 apply407FStateToDocument(state,privateTarget);
 assert.equal(projected(privateTarget).currentUsWorkAuthorization,undefined);
 assert.equal(privateTarget.studentProfile.fieldProvenance.currentUsWorkAuthorization.visibilityState,'ADVISOR_ONLY');
});

test('unknown source wording remains unknown in mounted options and does not become authorization',()=>{
 for(const raw of ['Not sure','Authorization pending','Not authorized to work in the U.S.']){
  const state=stateFor(document({currentUsWorkAuthorization:raw})),ui=runtime(state);
  assert.equal(state.wiz.visa,'Not sure');assert.equal(selectedAuthorization(ui.markup()),'Not sure');
  assert.equal(ui.needsQuestion(state.wiz),true);assert.equal(ui.valid(),false);
 }
});
