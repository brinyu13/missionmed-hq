import test from 'node:test';
import assert from 'node:assert/strict';
import {buildKeynoteClassicScene} from '../web/js/uxr-002/board-renderer.js';
import {projectFounderPresentationDocument} from '../web/js/presentation/founder-presentation-serializer.js';

// Every name, identifier and institution in this file is synthetic.
const event=(id,categoryId,startDate,endDate,visibilityState='INTERVIEWER_SAFE')=>({
  id,title:`Synthetic ${categoryId}`,siteName:'Synthetic Institution',categoryId,
  eventType:'duration',startDate,endDate,visibilityState
});
const document=()=>({
  id:'synthetic-profile-completeness',revision:1,theme:'keynote-classic',
  studentProfile:{fullName:'Synthetic Applicant'},
  events:[event('clinical','clinical','2024-01','2024-02'),event('research','research','2024-03','2024-05')],
  exams:[],advanced:{media:[],textBlocks:[],elements:[],groups:[]}
});
const scene=(source,audience='INTERVIEWER_SAFE')=>buildKeynoteClassicScene(source,{currentMonth:'2026-10',audience});
const bound=(id,visibilityState='ADVISOR_ONLY')=>({sourceType:'document-intake',sourceEventId:id,visibilityState});

test('all explicitly supplied profile facts survive privacy projection and scene without replacing derived totals',()=>{
  const source=document();
  const originalDerived=scene(source).profile;
  Object.assign(source.studentProfile,{
    aamcDisplay:'SYNTHETIC-AAMC-DISPLAY',aamcId:'SYNTHETIC-AAMC-ID',
    emrExperience:'Epic and Cerner',languages:['English','Arabic (Levantine)'],
    hobbies:['Gardening','Classical piano'],usceSummary:'Two supplied rotation months',
    researchSummary:'One supplied abstract',degree:'Other',degreeOther:'MBBCh',
    currentUsWorkAuthorization:'Other',workAuthorizationOther:'Synthetic authorization detail'
  });
  source.exams=[{id:'cs-attempt-2',system:'USMLE',examId:'step-2-cs',examDate:'2009-06',result:'Passed',attempt:2}];
  const before=JSON.stringify(source),projected=projectFounderPresentationDocument(source),profile=scene(source).profile;
  for(const field of ['aamcDisplay','aamcId','emrExperience','languages','hobbies','usceSummary','researchSummary','degreeOther','workAuthorizationOther']){
    assert.deepEqual(projected.studentProfile[field],source.studentProfile[field],`${field} projected`);
  }
  assert.equal(profile.aamcDisplay,'SYNTHETIC-AAMC-DISPLAY','explicit display spelling takes precedence');
  assert.equal(profile.emrExperience,'Epic and Cerner');
  assert.equal(profile.languages,'English, Arabic (Levantine)');
  assert.equal(profile.hobbies,'Gardening, Classical piano');
  assert.equal(profile.usceSummary,'Two supplied rotation months');
  assert.equal(profile.researchSummary,'One supplied abstract');
  assert.equal(profile.usceMonths,2,'two verified clinical months are counted from source dates');
  assert.equal(profile.researchMonths,3,'three verified research months are counted from source dates');
  assert.equal(profile.usceMonths,originalDerived.usceMonths,'authored summary does not replace the existing derived clinical total');
  assert.equal(profile.researchMonths,originalDerived.researchMonths,'authored summary does not replace the existing derived research total');
  assert.equal(profile.degree,'Other: MBBCh');
  assert.equal(profile.status,'Other: Synthetic authorization detail');
  assert.equal(profile.step2Cs,'Passed (2nd attempt)');
  assert.equal(JSON.stringify(source),before,'scene construction cannot alter facts or provenance');
});

test('one supplied AAMC identifier falls back only when its alias is absent',()=>{
  const source=document();source.studentProfile.aamcId='SYNTHETIC-AAMC-ID';
  assert.equal(projectFounderPresentationDocument(source).studentProfile.aamcId,'SYNTHETIC-AAMC-ID');
  assert.equal(scene(source).profile.aamcDisplay,'SYNTHETIC-AAMC-ID');
});

test('a hidden AAMC alias suppresses both spellings before public fallback, in either direction',()=>{
  for(const hidden of ['aamcDisplay','aamcId']){
    const source=document(),other=hidden==='aamcDisplay'?'aamcId':'aamcDisplay';
    source.events.push(event('private-aamc','personal','2025-01','2025-01','ADVISOR_ONLY'));
    source.studentProfile[hidden]='PRIVATE_AAMC_026';
    source.studentProfile[other]='PUBLIC_ALIAS_026';
    source.studentProfile.fieldProvenance={[hidden]:bound('private-aamc')};
    const before=JSON.stringify(source),projected=projectFounderPresentationDocument(source);
    assert.equal(projected.studentProfile.aamcDisplay,undefined,hidden);
    assert.equal(projected.studentProfile.aamcId,undefined,hidden);
    assert.equal(scene(source).profile.aamcDisplay,'',hidden);
    const advisor=projectFounderPresentationDocument(source,{scope:'ADVISOR_PACKET'});
    assert.equal(advisor.studentProfile[hidden],'PRIVATE_AAMC_026');
    assert.equal(advisor.studentProfile[other],'PUBLIC_ALIAS_026');
    assert.equal(JSON.stringify(source),before);
  }
});

test('source-bound new profile fields, Other details and Step 2 CS result stay out of the public scene',()=>{
  const source=document();source.events.push(event('private-source','personal','2025-01','2025-01','ADVISOR_ONLY'));
  Object.assign(source.studentProfile,{
    aamcId:'PRIVATE_AAMC_026',emrExperience:'PRIVATE_EMR_026',languages:['PRIVATE_LANGUAGE_026'],
    hobbies:['PRIVATE_HOBBY_026'],usceSummary:'PRIVATE_USCE_026',researchSummary:'PRIVATE_RESEARCH_026',
    degree:'Other',degreeOther:'PRIVATE_DEGREE_026',currentUsWorkAuthorization:'Other',
    workAuthorizationOther:'PRIVATE_AUTHORIZATION_026'
  });
  source.studentProfile.fieldProvenance=Object.fromEntries([
    'aamcId','emrExperience','languages','hobbies','usceSummary','researchSummary',
    'degreeOther','workAuthorizationOther'
  ].map(field=>[field,bound('private-source')]));
  source.exams=[{id:'private-cs',system:'USMLE',examId:'step-2-cs',examDate:'2009-06',result:'PRIVATE_CS_026',attempt:2,
    sourceType:'document-intake',sourceEventId:'private-source',visibilityState:'ADVISOR_ONLY',
    fieldProvenance:{result:bound('private-source')}}];
  const before=JSON.stringify(source),safe=projectFounderPresentationDocument(source),profile=scene(source).profile;
  for(const field of Object.keys(source.studentProfile.fieldProvenance))assert.equal(safe.studentProfile[field],undefined,field);
  for(const field of ['aamcDisplay','emrExperience','languages','hobbies','usceSummary','researchSummary','step2Cs','degreeOther','workAuthorizationOther'])assert.equal(profile[field],'',field);
  assert.equal(profile.degree,'Other');assert.equal(profile.status,'Other');
  assert.equal(safe.exams.length,0);
  const advisor=projectFounderPresentationDocument(source,{scope:'ADVISOR_PACKET'});
  assert.equal(advisor.studentProfile.aamcId,'PRIVATE_AAMC_026');
  assert.equal(advisor.studentProfile.degreeOther,'PRIVATE_DEGREE_026');
  assert.equal(advisor.exams[0].result,'PRIVATE_CS_026');
  assert.equal(JSON.stringify(source),before);
});

test('orphaned source links fail closed and Other details do not stand alone',()=>{
  const source=document();
  Object.assign(source.studentProfile,{
    aamcId:'ORPHAN_AAMC_026',degree:'Other',degreeOther:'ORPHAN_DEGREE_026',
    currentUsWorkAuthorization:'Other',workAuthorizationOther:'ORPHAN_AUTH_026',
    fieldProvenance:{
      aamcId:bound('missing-source','INTERVIEWER_SAFE'),
      degree:bound('missing-source','INTERVIEWER_SAFE'),
      currentUsWorkAuthorization:bound('missing-source','INTERVIEWER_SAFE')
    }
  });
  const projected=projectFounderPresentationDocument(source),profile=scene(source).profile;
  for(const field of ['aamcId','degree','degreeOther','currentUsWorkAuthorization','workAuthorizationOther'])assert.equal(projected.studentProfile[field],undefined,field);
  assert.equal(profile.aamcDisplay,'');assert.equal(profile.degree,'');assert.equal(profile.status,'');
});

test('missing optional facts remain empty and unconfirmed Step 2 CS attempts are not invented',()=>{
  const source=document(),empty=scene(source).profile;
  for(const field of ['aamcDisplay','emrExperience','languages','hobbies','usceSummary','researchSummary','step2Cs','degreeOther','workAuthorizationOther'])assert.equal(empty[field],'',field);
  source.exams=[{id:'cs-unconfirmed',system:'USMLE',examId:'step-2-cs',examDate:'2009-06',result:'Passed',attempt:2,attemptNumberUnconfirmed:true}];
  assert.equal(scene(source).profile.step2Cs,'Passed');
});

test('visible exact-month source spans form an inclusive union; private and uncertain spans add no months',()=>{
  const source=document();source.events=[
    event('clinical-a','clinical','2024-01','2024-03'),
    event('clinical-b','clinical','2024-03','2024-04'),
    event('clinical-private','clinical','2024-05','2024-12','ADVISOR_ONLY'),
    event('clinical-unknown-end','clinical','2025-01',null),
    {...event('clinical-year-only','clinical','2023-01','2023-12'),fields:{datePrecision:{start:'YEAR',end:'YEAR'}}},
    {...event('clinical-scalar-year','clinical','2021-01','2021-12'),fields:{datePrecision:'YEAR'}},
    {...event('clinical-source-year','clinical','2022-01','2022-12'),fields:{sourceDateWording:{start:{raw:'2022',precision:'YEAR'},end:{raw:'2022',precision:'YEAR'}}}},
    event('research-a','research','2024-01','2024-02'),
    event('research-b','research','2024-02','2024-04'),
    event('research-backwards','research','2025-05','2025-04')
  ];
  const before=JSON.stringify(source),publicProfile=scene(source).profile;
  assert.equal(publicProfile.usceMonths,4,'Jan–Apr are four months even with March overlap');
  assert.equal(publicProfile.researchMonths,4,'Jan–Apr are four months even with February overlap');
  assert.equal(scene(source,'EVERYTHING').profile.usceMonths,12,'advisor-only May–Dec become visible only in the broader audience');
  assert.equal(JSON.stringify(source),before);
});

test('a public Step 2 CS attempt with a private result does not disclose that result',()=>{
  const source=document();source.events.push(event('private-result','exams','2009-06','2009-06','ADVISOR_ONLY'));
  source.exams=[{id:'cs-public-attempt',system:'USMLE',examId:'step-2-cs',examDate:'2009-06',result:'PRIVATE_RESULT_026',attempt:2,
    fieldProvenance:{result:bound('private-result')}}];
  assert.equal(scene(source).profile.step2Cs,'');
  assert.equal(projectFounderPresentationDocument(source).exams.length,0);
  assert.equal(projectFounderPresentationDocument(source,{scope:'ADVISOR_PACKET'}).exams[0].result,'PRIVATE_RESULT_026');
});
