import test from 'node:test';
import assert from 'node:assert/strict';
import {WORK_AUTHORIZATION_OPTIONS,normalizeWorkAuthorization,needsResidencyVisaQuestion,validateCoreInfo,builderStepState,renderBuilder,installBuilder} from '../web/js/uxr-002/builder.js';
import {TimelineStore,defaultDocument} from '../web/js/uxr-002/store.js';
import {MemoryPersistenceAdapter} from '../web/js/persistence/memory-adapter.js';
import {projectPresentationFields} from '../web/js/presentation/presentation-field-privacy.js';

const authorization='Authorized to work in the U.S.';
const profile=(overrides={})=>({
 fullName:'Synthetic Avery',medicalSchool:'Synthetic Medical College',
 canonicalSchoolId:'synthetic-school',medicalSchoolCountry:'Synthetic country',
 graduationDate:'2023-05',degree:'MD',currentUsWorkAuthorization:authorization,
 residencyVisaTypesOpenTo:'',...overrides
});
const selectedAuthorization=html=>html.match(/<select[^>]*name="currentUsWorkAuthorization"[^>]*>([\s\S]*?)<\/select>/)?.[1].match(/<option value="([^"]*)" selected>/)?.[1];

test('explicit authorization-only source wording survives normalization without subtype or sponsorship inference',()=>{
 for(const input of [profile(),{visaStatus:authorization}]){
  const before=JSON.stringify(input),normalized=normalizeWorkAuthorization(input);
  assert.deepEqual(normalized,{currentUsWorkAuthorization:authorization,residencyVisaTypesOpenTo:''});
  assert.equal(JSON.stringify(input),before);
 }
 assert.ok(WORK_AUTHORIZATION_OPTIONS.includes(authorization));
});

test('Builder selects the approved wording and accepts Core Info without an unstated visa answer',()=>{
 const document=defaultDocument();document.studentProfile=profile();
 const before=JSON.stringify(document),html=renderBuilder({document});
 assert.equal(selectedAuthorization(html),authorization);
 assert.doesNotMatch(html,/name="residencyVisaTypesOpenTo"|name="eadStatus"/);
 assert.equal(needsResidencyVisaQuestion(document.studentProfile),false);
 assert.deepEqual(validateCoreInfo(document.studentProfile),{});
 assert.equal(builderStepState(document,1),'complete');
 assert.equal(JSON.stringify(document),before);
});

test('installed Core Info handler saves the selected source wording and reopens it durably',async()=>{
 const adapter=new MemoryPersistenceAdapter();
 const entitlement={schemaVersion:'d1-405.timeline-entitlement.1',access:'FULL',verified:true,canRead:true,canCreate:true,canMutate:true,canExport:true};
 const store=new TimelineStore({adapter,entitlement});await store.initialize();
 const sourceBinding={sourceType:'myeras-profile-intake',visibilityState:'ADVISOR_ONLY',sourceExcerpt:authorization};
 store.mutate('Synthetic approved source',document=>{document.studentProfile=profile({fieldProvenance:{currentUsWorkAuthorization:sourceBinding}});});
 const rendered=renderBuilder(store);
 const values={...store.document.studentProfile,currentUsWorkAuthorization:selectedAuthorization(rendered),'core-graduation-date':'2023-05'};
 const controls=new Map(Object.entries(values).filter(([,value])=>typeof value==='string').map(([name,value])=>[name,{name,value,type:name==='currentUsWorkAuthorization'?'select-one':'text',addEventListener(){}}]));
 const handlers=new Map(),next={addEventListener:(type,handler)=>handlers.set(type,handler)};
 const form={elements:{namedItem:name=>controls.get(name)||null},querySelector:()=>null,querySelectorAll:()=>[]};
 const root={querySelectorAll:()=>[],querySelector:selector=>({'[data-core-form]':form,'[data-builder-next]':next})[selector]||null};
 installBuilder(root,store,{idFactory:prefix=>`${prefix}-synthetic`});
 handlers.get('click')();
 assert.equal(store.document.builder.step,2);
 assert.equal(store.document.studentProfile.currentUsWorkAuthorization,authorization);
 assert.equal(store.document.studentProfile.visaStatus,'');
 assert.equal(store.document.studentProfile.eadStatus,'');
 assert.equal(store.document.studentProfile.residencyVisaTypesOpenTo,'');
 assert.deepEqual(store.document.studentProfile.fieldProvenance.currentUsWorkAuthorization,sourceBinding);
 await store.saveNow();
 const reopened=new TimelineStore({adapter,entitlement});await reopened.initialize();
 assert.equal(reopened.document.studentProfile.currentUsWorkAuthorization,authorization);
 assert.deepEqual(reopened.document.studentProfile.fieldProvenance.currentUsWorkAuthorization,sourceBinding);
 reopened.document.builder.step=1;
 assert.equal(selectedAuthorization(renderBuilder(reopened)),authorization);
 assert.equal(reopened.document.studentProfile.residencyVisaTypesOpenTo,'');
 const safe=projectPresentationFields(reopened.document,{allowed:new Set(['INTERVIEWER_SAFE']),visibleEventIds:new Set(reopened.document.events.map(event=>event.id))});
 assert.equal(safe.studentProfile.currentUsWorkAuthorization,undefined);
 assert.equal(safe.studentProfile.visaStatus,'','private source wording cannot escape through a newly copied alias');
 reopened.mutate('Synthetic explicitly supplied visa',document=>{document.studentProfile.visaStatus='F-1';});
 installBuilder(root,reopened,{idFactory:prefix=>`${prefix}-synthetic`});handlers.get('click')();
 assert.equal(reopened.document.studentProfile.visaStatus,'F-1','a previously supplied visa fact is preserved rather than overwritten');
 for(const instance of [store,reopened]){clearTimeout(instance.timer);clearTimeout(instance.entitlementTimer);}
});

test('existing authorization options and visa questions retain their established behavior',()=>{
 for(const [status,eadStatus,needsQuestion] of [
  ['U.S. Citizen','',false],['Permanent Resident / Green Card','',false],
  ['Employment Authorization Document','Active and unrestricted',false],
  ['Employment Authorization Document','Restricted or expiring',true],
  ['Employment Authorization Document','Not sure',true],
  ['F-1','',true],['J-1','',true],['H-1B','',true],['Other','',true],['Not sure','',true]
 ]){
  const input=profile({currentUsWorkAuthorization:status,eadStatus});
  assert.equal(normalizeWorkAuthorization(input).currentUsWorkAuthorization,status);
  assert.equal(needsResidencyVisaQuestion(input),needsQuestion,status);
  assert.equal(validateCoreInfo(input).residencyVisaTypesOpenTo,needsQuestion?'Required.':undefined,status);
 }
 assert.equal(normalizeWorkAuthorization({visaStatus:'Need J-1'}).residencyVisaTypesOpenTo,'J-1');
 assert.equal(normalizeWorkAuthorization({visaStatus:'Need H-1B'}).residencyVisaTypesOpenTo,'H-1B');
});

test('unknown and unrecognized wording remain unknown rather than becoming authorization',()=>{
 for(const raw of ['Not sure','Unspecified source wording','Not authorized to work in the U.S.','Authorization pending']){
  const normalized=normalizeWorkAuthorization({currentUsWorkAuthorization:raw});
  assert.equal(normalized.currentUsWorkAuthorization,'Not sure');
  assert.equal(normalized.residencyVisaTypesOpenTo,'');
  assert.equal(needsResidencyVisaQuestion({currentUsWorkAuthorization:raw}),true);
 }
 assert.deepEqual(normalizeWorkAuthorization({}),{currentUsWorkAuthorization:'',residencyVisaTypesOpenTo:''});
 const input=profile({residencyVisaTypesOpenTo:'J-1'});
 assert.equal(normalizeWorkAuthorization(input).residencyVisaTypesOpenTo,'J-1','an explicitly supplied answer is retained');
});

test('private authorization-only wording remains private in presentation projection after normalization',()=>{
 const document=defaultDocument();document.studentProfile=profile({fieldProvenance:{currentUsWorkAuthorization:{sourceType:'myeras-profile-intake',visibilityState:'ADVISOR_ONLY'}}});
 const before=JSON.stringify(document);
 assert.equal(normalizeWorkAuthorization(document.studentProfile).currentUsWorkAuthorization,authorization);
 const safe=projectPresentationFields(document,{allowed:new Set(['INTERVIEWER_SAFE']),visibleEventIds:new Set()});
 assert.equal(safe.studentProfile.currentUsWorkAuthorization,undefined);
 const advisor=projectPresentationFields(document,{allowed:new Set(['INTERVIEWER_SAFE','ADVISOR_ONLY']),visibleEventIds:new Set()});
 assert.equal(advisor.studentProfile.currentUsWorkAuthorization,authorization);
 assert.equal(JSON.stringify(document),before);
});
