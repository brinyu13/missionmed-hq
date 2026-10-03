import test from 'node:test';
import assert from 'node:assert/strict';
import {buildKeynoteClassicScene} from '../web/js/uxr-002/board-renderer.js';

const source={sourceDocumentId:'synthetic-cv',sourceSha256:'a'.repeat(64),sourceExcerpt:'Medical education | 2018 to 2022'};
const school=(id,overrides={})=>({
 id,title:'Medical education',categoryId:'education',eventType:'duration',
 startDate:'2018-09',endDate:'2022-06',openEnded:false,
 siteName:'Synthetic Medical College',visibilityState:'INTERVIEWER_SAFE',
 fields:{datePrecision:{start:'MONTH',end:'MONTH'},sourceDateWording:{start:{raw:'Sep 2018',normalizedMonth:'2018-09',precision:'MONTH'},end:{raw:'Jun 2022',normalizedMonth:'2022-06',precision:'MONTH'}}},
 provenance:[source],...overrides
});
const document=events=>({studentProfile:{fullName:'Synthetic Avery Lane'},events});
const scene=(events,audience='INTERVIEWER_SAFE')=>buildKeynoteClassicScene(document(events),{currentMonth:'2026-10',audience});

test('completed education uses its end-date flag and a source-linked profile span without changing facts',()=>{
 const event=school('degree-1'),input=document([event]),before=JSON.stringify(input);
 const result=buildKeynoteClassicScene(input,{currentMonth:'2026-10'});
 assert.equal(result.arrows.some(arrow=>arrow.id===event.id),false);
 assert.equal(result.flags.find(flag=>flag.id===event.id)?.month,'2022-06');
 assert.equal(result.flags.find(flag=>flag.id===event.id)?.title,event.title);
 assert.equal(result.flags.find(flag=>flag.id===event.id)?.siteName,event.siteName);
 assert.equal(result.events.filter(item=>item.id===event.id).length,1);
 assert.deepEqual(result.profile.educationRecords,[{
  eventId:event.id,title:event.title,school:event.siteName,startDate:event.startDate,endDate:event.endDate,
  openEnded:false,datePrecision:event.fields.datePrecision,sourceDateWording:event.fields.sourceDateWording,
  provenance:event.provenance
 }]);
 assert.equal(result.omissions.length,0);
 assert.equal(JSON.stringify(input),before);
});

test('multiple completed schools retain separate names, spans, flags and evidence',()=>{
 const first=school('school-one');
 const second=school('school-two',{title:'Doctor of Medicine',siteName:'Synthetic Graduate School',startDate:'2023-01',endDate:'2025-06',fields:{datePrecision:{start:'MONTH',end:'MONTH'},sourceDateWording:{start:{raw:'Jan 2023',normalizedMonth:'2023-01',precision:'MONTH'},end:{raw:'Jun 2025',normalizedMonth:'2025-06',precision:'MONTH'}}},provenance:[{...source,sourceExcerpt:'Doctor of Medicine | 2023 to 2025'}]});
 const result=scene([first,second]);
 assert.deepEqual(result.profile.educationRecords.map(record=>[record.eventId,record.school,record.startDate,record.endDate]),[
  ['school-one','Synthetic Medical College','2018-09','2022-06'],
  ['school-two','Synthetic Graduate School','2023-01','2025-06']
 ]);
 assert.deepEqual(result.flags.filter(flag=>['school-one','school-two'].includes(flag.id)).map(flag=>[flag.id,flag.month]),[['school-one','2022-06'],['school-two','2025-06']]);
 assert.equal(result.profile.educationRecords[1].provenance[0].sourceExcerpt,'Doctor of Medicine | 2023 to 2025');
});

test('year-only completion retains year precision and original source wording',()=>{
 const event=school('year-only',{endDate:'2022-12',fields:{datePrecision:{start:'YEAR',end:'YEAR'},sourceDateWording:{start:{raw:'2018',normalizedMonth:'2018-01',precision:'YEAR'},end:{raw:'2022',normalizedMonth:'2022-12',precision:'YEAR'}}}});
 const result=scene([event]),flag=result.flags.find(item=>item.id===event.id),record=result.profile.educationRecords[0];
 assert.equal(flag.month,'2022-12');
 assert.equal(flag.datePrecision.start,'YEAR');
 assert.equal(flag.ariaLabel,'Medical education, Education, 2022');
 assert.equal(flag.sourceDateWording.start.raw,'2022');
 assert.deepEqual(record.datePrecision,event.fields.datePrecision);
 assert.deepEqual(record.sourceDateWording,event.fields.sourceDateWording);
});

test('source wording alone supplies year precision and a contradictory end month gates the flag',()=>{
 const sourceDateWording={start:{raw:'2018',normalizedMonth:'2018-01',precision:'YEAR'},end:{raw:'2022',normalizedMonth:'2022-12',precision:'YEAR'}};
 const valid=school('wording-only',{endDate:'2022-12',fields:{},sourceDateWording});
 const coarserSource=school('coarser-source',{endDate:'2022-12',fields:{datePrecision:{start:'MONTH',end:'MONTH'},sourceDateWording}});
 const conflict=school('conflicting-end',{sourceDateWording:{...sourceDateWording,end:{...sourceDateWording.end,normalizedMonth:'2021-12'}}});
 const result=scene([valid,coarserSource,conflict]);
 assert.equal(result.flags.find(item=>item.id==='wording-only')?.datePrecision.start,'YEAR');
 assert.equal(result.flags.find(item=>item.id==='wording-only')?.sourceDateWording.start.raw,'2022');
 assert.equal(result.flags.find(item=>item.id==='coarser-source')?.datePrecision.start,'YEAR');
 assert.equal(result.flags.some(item=>item.id==='conflicting-end'),false);
 assert.equal(result.omissions.find(item=>item.id==='conflicting-end')?.reason,'education-end-source-conflict');
});

test('missing, ongoing or ambiguous completion remains a review omission, never a graduation flag',()=>{
 const cases=[
  school('missing-end',{endDate:null}),
  school('ongoing',{endDate:null,openEnded:true}),
  school('unknown-start',{fields:{datePrecision:{start:'UNKNOWN',end:'MONTH'},sourceDateWording:{start:{raw:'start unclear',normalizedMonth:'2018-09',precision:'UNKNOWN'},end:{raw:'Jun 2022',normalizedMonth:'2022-06',precision:'MONTH'}}}}),
  school('season-end',{fields:{datePrecision:{start:'MONTH',end:'SEASON'},sourceDateWording:{end:{raw:'Summer 2022',normalizedMonth:'2022-07',precision:'SEASON'}}}}),
  school('unknown-end',{fields:{datePrecision:{start:'MONTH',end:'UNKNOWN'},sourceDateWording:{end:{raw:'date unclear',normalizedMonth:'2022-06',precision:'UNKNOWN'}}}})
 ];
 const result=scene(cases);
 assert.equal(result.profile.educationRecords.length,5);
 assert.equal(result.arrows.filter(item=>item.categoryId==='education').length,0);
 assert.equal(result.flags.filter(item=>item.categoryId==='education').length,0);
 assert.deepEqual(new Set(result.omissions.map(item=>item.id)),new Set(cases.map(item=>item.id)));
});

test('private school spans stay out of interviewer scene and prior training retains its work arrow',()=>{
 const residency={id:'residency',title:'Internal Medicine Residency',siteName:'Synthetic Hospital',categoryId:'work',eventType:'duration',startDate:'2022-07',endDate:'2025-06',visibilityState:'INTERVIEWER_SAFE'};
 for(const visibilityState of ['ADVISOR_ONLY','STUDENT_ONLY','FULL_STORY']){
  const privateSchool=school('private-degree',{visibilityState});
  const publicScene=scene([privateSchool,residency]);
  assert.deepEqual(publicScene.profile.educationRecords,[]);
  assert.equal(publicScene.flags.some(item=>item.id==='private-degree'),false);
  assert.equal(publicScene.events.some(item=>item.id==='private-degree'),false);
  assert.equal(publicScene.arrows.find(item=>item.id==='residency')?.categoryId,'work');
  const everything=scene([privateSchool,residency],'EVERYTHING');
  assert.equal(everything.profile.educationRecords[0].eventId,'private-degree');
  assert.equal(everything.flags.find(item=>item.id==='private-degree')?.month,'2022-06');
 }
});
