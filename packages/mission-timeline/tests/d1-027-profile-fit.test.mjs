import test from 'node:test';
import assert from 'node:assert/strict';
import {serializeFounderPresentation,assertCompleteFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {resolveFounderPresentationSvg} from '../web/js/presentation/resolved-founder-presentation.js';
import {createEditableFounderPptx,inspectEditablePptx} from '../web/js/presentation/editable-pptx.js';
import {FOUNDER_2025_MATRIX} from './fixtures/founder-2025-matrix.mjs';
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE3sAAAAASUVORK5CYII=';
const source=()=>{
  const d=structuredClone(FOUNDER_2025_MATRIX.find(f=>f.id==='M01').document);
  Object.assign(d.studentProfile,{fullName:'Synthetic Applicant',currentUsWorkAuthorization:'US Citizen',aamcDisplay:'SYNTHETIC-027',emrExperience:'Epic, Cerner',languages:'English, Arabic',hobbies:'Piano, hiking',usceSummary:'3 months',researchSummary:'18 months; 1 abstract'});
  d.exams=[['step-1','252','2017-06'],['step-2-ck','264','2018-06'],['step-2-cs',null,'2019-06'],['step-3','233','2020-06']].map(([examId,score,examDate],i)=>({id:'synthetic-exam-'+i,system:'USMLE',examId,examDate,score,result:'Passed',attempt:examId==='step-2-cs'?2:1}));
  // A technical pixel tests the occupied aperture. It is not an applicant photo.
  d.mediaItems=[{id:'technical-portrait',type:'profilePhoto',placement:'profile',visibilityState:'INTERVIEWER_SAFE',resolvedUrl:pixel}];return d;
};
const longSchool='Synthetic International University College of Medicine and Biomedical Sciences';
const longProfile={fullName:'Synthetic Alexandra Meridian Applicant',medicalSchool:longSchool,emrExperience:'Epic, Cerner, Allscripts',languages:'English, Arabic, French, Spanish',hobbies:'Photography, piano, hiking, community gardening'};
const render=d=>serializeFounderPresentation(d,{scope:'INTERVIEWER_SAFE',currentMonth:'2026-10'});
const textNodes=r=>resolveFounderPresentationSvg(r.svg).nodes.filter(n=>n.kind==='text'&&n.sourceAttributes['data-profile-field']);
const flattened=nodes=>nodes.map(n=>n.text).join(' ').replace(/\s+/g,' ').trim();
for(const [name,profile] of Object.entries({longSchool:{medicalSchool:longSchool},combined:longProfile}))test(`${name} fits the original portrait paper without shrinking or dropping source values`,()=>{
  const d=source();Object.assign(d.studentProfile,profile);const before=JSON.stringify(d),r=render(d),nodes=textNodes(r);
  assert.doesNotThrow(()=>assertCompleteFounderPresentation(r));
  for(const value of Object.values(profile))assert.ok(flattened(nodes).includes(value),value);
  assert.match(r.svg,/data-artifact-chrome="profile" data-founder-geometry="13,661,545,410"/);
  assert.ok(nodes.every(n=>n.fontSize===19));
  assert.ok(nodes.every(n=>n.sourceAttributes['data-text-overflow']==='false'));
  assert.ok(Math.max(...nodes.map(n=>n.bounds.y+n.bounds.height))<1054);
  const portrait=resolveFounderPresentationSvg(r.svg).nodes.find(n=>n.kind==='image'&&n.sourceAttributes['data-media-id']==='technical-portrait');
  for(const n of nodes.filter(n=>n.bounds.y<portrait.bounds.y+portrait.bounds.height&&n.bounds.y+n.bounds.height>portrait.bounds.y))assert.ok(n.bounds.x+n.bounds.width<portrait.bounds.x-4,n.text);
  assert.equal(JSON.stringify(d),before);assert.equal(render(d).svg,r.svg,'deterministic after fitting');
});
test('an oversized profile remains complete and blocks final export instead of truncating',()=>{
  const d=source();d.studentProfile.hobbies=Array.from({length:110},(_,i)=>`Supplied activity ${i}`).join(', ');
  const r=render(d);assert.ok(flattened(textNodes(r)).includes(d.studentProfile.hobbies));
  assert.throws(()=>assertCompleteFounderPresentation(r),e=>e.code==='TIMELINE_EXPORT_TEXT_OVERFLOW');
});
test('explicit profile paper and portrait crop remain authored after fitting',()=>{
  const d=source();Object.assign(d.studentProfile,longProfile);d.presentationOverrides={profileGeometry:{x:20,y:650,width:545,height:410}};d.mediaItems[0].crop={x:30,y:65,zoom:1.4};const before=JSON.stringify(d),r=render(d);
  assert.match(r.svg,/data-artifact-chrome="profile" data-founder-geometry="20,650,545,410"/);
  assert.match(r.svg,/data-crop-zoom="1.4" data-crop-x="30" data-crop-y="65"/);
  assert.equal(JSON.stringify(d),before);
});
test('fitted profile fields remain individual native editable text objects',async()=>{
  const d=source();Object.assign(d.studentProfile,longProfile);const r=render(d);
  const artifact=await createEditableFounderPptx({svg:r.svg,document:d,resolveImage:async()=>pixel});
  const pptx=await inspectEditablePptx(artifact.blob);assert.deepEqual(pptx.errors,[]);
  const nodes=pptx.recovery.objects.filter(n=>n.kind==='text'&&n.groupId==='furniture:profile');
  for(const value of Object.values(longProfile))assert.ok(flattened(nodes).includes(value),value);
  assert.ok(nodes.every(n=>n.fontFamily==='American Typewriter'));
});
