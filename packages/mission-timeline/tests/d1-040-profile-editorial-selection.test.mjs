import test from 'node:test';
import assert from 'node:assert/strict';
import {serializeFounderPresentation,assertCompleteFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {resolveFounderPresentationSvg} from '../web/js/presentation/resolved-founder-presentation.js';
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC0lEQVR42mP8/x8AAwMCAO+jE3sAAAAASUVORK5CYII=';
const school=(id,title,siteName,startDate,endDate)=>({id,title,siteName,startDate,endDate,categoryId:'education',eventType:'duration',visibilityState:'INTERVIEWER_SAFE',fields:{datePrecision:{start:'MONTH',end:'MONTH'}},provenance:[{sourceDocumentId:'synthetic-source',sourceExcerpt:`${title} | ${siteName} | ${startDate} to ${endDate}`}]});
const source=()=>({id:'synthetic-editorial',revision:1,studentProfile:{fullName:'Synthetic Applicant',currentUsWorkAuthorization:'US Citizen',aamcDisplay:'SYNTHETIC-040',medicalSchool:'Synthetic Medical College',degree:'Medical degree',hobbies:'OPTIONAL_HOBBY '+Array.from({length:100},(_,i)=>`supplied activity ${i}`).join(', '),languages:'OPTIONAL_LANGUAGE English, Arabic',emrExperience:'OPTIONAL_EMR Epic, Cerner',fieldProvenance:{hobbies:{sourceType:'user-authored',visibilityState:'INTERVIEWER_SAFE'}}},events:[school('school-a','Medical degree','Synthetic Medical College','2010-09','2014-06'),school('school-b','Medical education (no degree)','Synthetic Second School','2015-01','2016-06'),school('school-c','Additional education','Synthetic Third School','2017-01','2018-06'),{id:'degree-confirmed',title:'Medical degree completed',siteName:'Synthetic Medical College',categoryId:'education',eventType:'milestone',startDate:'2014-06',visibilityState:'INTERVIEWER_SAFE'}],exams:[],mediaItems:[{id:'technical-portrait',type:'profilePhoto',placement:'profile',visibilityState:'INTERVIEWER_SAFE',resolvedUrl:pixel}],advanced:{media:[],textBlocks:[],elements:[],groups:[]}});
const render=d=>serializeFounderPresentation(d,{scope:'INTERVIEWER_SAFE',currentMonth:'2026-10'});
const paint=r=>resolveFounderPresentationSvg(r.svg).nodes;
const profileText=r=>paint(r).filter(n=>n.kind==='text'&&n.sourceAttributes['data-profile-field']);
const flatten=nodes=>nodes.map(n=>n.text).join(' ').replace(/\s+/g,' ').trim();

test('automatic editorial paper preserves full source/provenance and accounts for optional narrative exclusions',()=>{
 const d=source(),before=JSON.stringify(d),r=render(d);
 assert.doesNotThrow(()=>assertCompleteFounderPresentation(r));
 for(const field of ['hobbies','languages','emrExperience']){
  assert.equal(r.scene.profile[field],d.studentProfile[field]);
  assert.equal(r.scene.profileDisplay.excludedFields.find(x=>x.field===field)?.reason,'optional-source-narrative');
  assert.ok(!r.svg.includes(d.studentProfile[field].split(' ')[0]));
 }
 assert.equal(JSON.stringify(d),before);
 assert.equal(render(d).svg,r.svg,'selection and wrapping are deterministic');
});

test('three material education spans retain complete title, school, dates and portrait at native type',()=>{
 const d=source(),r=render(d),nodes=profileText(r);
 for(const record of r.scene.profile.educationRecords){
  const text=flatten(nodes.filter(n=>n.semanticRef===record.eventId));
  assert.ok(text.includes(record.title));assert.ok(text.includes(record.school));
  const expectedDates={'school-a':['9/10','6/14'],'school-b':['1/15','6/16'],'school-c':['1/17','6/18']}[record.eventId];
  for(const date of expectedDates)assert.ok(text.includes(date),date);
  assert.ok(nodes.filter(n=>n.semanticRef===record.eventId).every(n=>n.sourceAttributes['data-material-field']==='educationSpan'));
 }
 assert.equal(r.scene.profile.educationRecords.length,3);
 assert.equal(nodes.some(n=>n.sourceAttributes['data-profile-field']==='Medical school'),false);
 assert.equal(nodes.some(n=>n.sourceAttributes['data-profile-field']==='Degree'),false);
 assert.ok(nodes.every(n=>n.fontSize===19));
 const portrait=paint(r).find(n=>n.kind==='image'&&n.sourceAttributes['data-media-id']==='technical-portrait');assert.ok(portrait);
 for(const n of nodes.filter(n=>n.bounds.y<portrait.bounds.y+portrait.bounds.height&&n.bounds.y+n.bounds.height>portrait.bounds.y))assert.ok(n.bounds.x+n.bounds.width<portrait.bounds.x-4,n.text);
 assert.match(r.svg,/data-artifact-chrome="profile" data-founder-geometry="13,661,545,410"/);
 assert.deepEqual(r.scene.profile.educationRecords.map(x=>x.provenance),d.events.slice(0,3).map(x=>x.provenance));
});

test('education ranges never invent completion flags; actual degree milestones remain',()=>{
 const d=source(),r=render(d);
 for(const id of ['school-a','school-b','school-c'])assert.ok(![...r.scene.arrows,...r.scene.flags].some(x=>x.id===id));
 assert.equal(r.scene.flags.find(x=>x.id==='degree-confirmed')?.month,'2014-06');
 assert.doesNotThrow(()=>assertCompleteFounderPresentation(r));
 d.events=d.events.slice(0,3);
 assert.doesNotThrow(()=>assertCompleteFounderPresentation(render(d)),'education-only source is materially represented by its profile spans');
});

test('duplicate suppression requires the complete same value; differing school and degree stay visible',()=>{
 const d=source();d.studentProfile.medicalSchool='Synthetic Different College';d.studentProfile.degree='Synthetic Different Degree';
 const r=render(d),text=flatten(profileText(r));
 assert.ok(text.includes(d.studentProfile.medicalSchool));assert.ok(text.includes(d.studentProfile.degree));
 assert.doesNotThrow(()=>assertCompleteFounderPresentation(r));
});

test('denied optional source narrative and education remain denied before editorial selection',()=>{
 const d=source();d.events[1].visibilityState='ADVISOR_ONLY';
 d.studentProfile.fieldProvenance.languages={sourceType:'document-intake',sourceEventId:'school-b',visibilityState:'ADVISOR_ONLY'};
 const before=JSON.stringify(d),r=render(d);
 assert.equal(r.scene.profile.languages,'');assert.ok(!r.svg.includes('OPTIONAL_LANGUAGE'));
 assert.ok(!r.scene.profile.educationRecords.some(x=>x.eventId==='school-b'));
 assert.ok(!r.svg.includes('Synthetic Second School'));assert.equal(JSON.stringify(d),before);
});

test('mandatory material overflow and unaccounted omissions still block export',()=>{
 const d=source();d.events[0].siteName=Array.from({length:100},(_,i)=>`Mandatory institution term ${i}`).join(' ');
 const r=render(d);assert.ok(flatten(profileText(r)).includes(d.events[0].siteName));
 assert.throws(()=>assertCompleteFounderPresentation(r),e=>e.code==='TIMELINE_EXPORT_TEXT_OVERFLOW');
 const complete=render(source());complete.scene.profileDisplay.excludedFields=complete.scene.profileDisplay.excludedFields.filter(x=>x.field!=='medicalSchool');
 assert.throws(()=>assertCompleteFounderPresentation(complete),e=>e.code==='TIMELINE_EXPORT_MISSING_FIELDS');
});
