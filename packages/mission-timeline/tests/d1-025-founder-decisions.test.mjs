import test from 'node:test';
import assert from 'node:assert/strict';
import {serializeFounderPresentation,assertCompleteFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {resolveFounderPresentationSvg} from '../web/js/presentation/resolved-founder-presentation.js';
import {FOUNDER_2025_MATRIX} from './fixtures/founder-2025-matrix.mjs';

// All examples are synthetic. Check the visible artifact as well as its scene:
// retaining a source fact in memory does not mean it reached the export.
const base=()=>structuredClone(FOUNDER_2025_MATRIX.find(item=>item.id==='M02').document);
const render=(document,showEmptySlots=false)=>serializeFounderPresentation(document,{
  scope:'INTERVIEWER_SAFE',currentMonth:'2026-10',showEmptySlots
});
const paintedText=(svg,predicate)=>resolveFounderPresentationSvg(svg).nodes
  .filter(node=>node.kind==='text'&&predicate(node))
  .map(node=>node.text).join(' ').replace(/\s+/g,' ').trim();
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE3sAAAAASUVORK5CYII=';
const media=(id,type,placement)=>({id,type,placement,resolvedUrl:pixel,visibilityState:'INTERVIEWER_SAFE'});

test('G1: empty program-facing artifact omits media and interview placeholders while editing retains slots',()=>{
  const document=base(),before=JSON.stringify(document);
  const final=render(document),editing=render(document,true);
  assert.doesNotMatch(final.svg,/data-frame-slot=|data-interview-destination=|PROFILE PHOTO|DROP PHOTO|PROGRAM LOGO|Date pending/);
  assert.match(editing.svg,/data-frame-slot="profile" data-media-state="empty"/);
  for(let index=1;index<=3;index++)assert.match(editing.svg,new RegExp(`data-frame-slot="photo${index}" data-media-state="empty"`));
  assert.match(editing.svg,/data-frame-slot="logo" data-media-state="empty"/);
  assert.match(editing.svg,/data-interview-destination="407f-ribbon"/);
  assert.match(editing.svg,/Date pending/);
  assert.equal(JSON.stringify(document),before,'rendering does not mutate the source');
});

test('G1: partially filled media and program details remain visible without invented slots or date',()=>{
  const document=base();
  document.mediaItems=[media('photo-one','photo','photo1')];
  document.metadata.interview={programName:'Synthetic Residency Program'};
  const final=render(document),editing=render(document,true);
  assert.match(final.svg,/data-frame-slot="photo1" data-media-state="filled" data-media-id="photo-one"/);
  assert.doesNotMatch(final.svg,/data-frame-slot="photo[23]"|data-frame-slot="profile"|data-media-state="empty"|PROGRAM LOGO|Date pending/);
  assert.match(final.svg,/SYNTHETIC RESIDENCY PROGRAM/,'authored program name remains in the interview header');
  assert.doesNotMatch(final.svg,/data-board-ink-role="interview-date"/);
  assert.match(editing.svg,/data-frame-slot="photo2" data-media-state="empty"/);
  assert.match(editing.svg,/Date pending/);
});

test('G1: filled interview date and logo render authored values and suppress placeholders',()=>{
  const document=base();
  document.metadata.interview={date:'2026-11',programName:'Synthetic Residency Program'};
  document.mediaItems=[media('program-logo','programLogo','ribbon'),media('profile-photo','profilePhoto','profile')];
  const {scene,svg}=render(document);
  assert.equal(scene.interviewMarker?.month,'2026-11');
  assert.match(svg,/data-frame-slot="logo" data-media-state="filled" data-media-id="program-logo"/);
  assert.match(svg,/data-frame-slot="profile" data-media-state="filled" data-media-id="profile-photo"/);
  assert.match(svg,/data-board-ink-role="interview-date"/);
  assert.doesNotMatch(svg,/Date pending|DROP PHOTO|PROGRAM LOGO|PROFILE PHOTO|data-media-state="empty"/);
});

test('G2: general and USA milestones preserve full supplied institutions beside their flags',()=>{
  const document=base();
  const institution='Synthetic International University Hospital and Regional Center for Advanced Cardiovascular Medicine';
  document.events=[
    {id:'general',title:'Clinical milestone',siteName:institution,categoryId:'clinical',eventType:'milestone',startDate:'2023-06',visibilityState:'INTERVIEWER_SAFE'},
    {id:'usa',title:'Moved to USA',siteName:'Synthetic University Hospital',categoryId:'personal',eventType:'milestone',startDate:'2024-08',visibilityState:'INTERVIEWER_SAFE'}
  ];
  const before=JSON.stringify(document),{svg}=render(document),nodes=resolveFounderPresentationSvg(svg).nodes;
  for(const [id,title,site] of [['general','Clinical milestone',institution],['usa','Moved to USA','Synthetic University Hospital']]){
    const visible=nodes.filter(node=>node.kind==='text'&&node.semanticRef===id).map(node=>node.text).join(' ').replace(/\s+/g,' ');
    assert.ok(visible.includes(title),`${id} title missing`);
    assert.ok(visible.includes(site),`${id} supplied institution missing`);
    assert.ok(nodes.some(node=>node.semanticRef===id&&node.sourceAttributes['data-board-ink-role']==='flag-label'),`${id} has no adjacent flag label`);
  }
  assert.ok(nodes.filter(node=>node.kind==='text'&&node.semanticRef==='general'&&node.sourceAttributes['data-board-ink-role']==='flag-label').length>1,'long institution wraps without abbreviation');
  assert.match(svg,/data-event-id="usa" data-founder-milestone-style="usa"/);
  assert.equal(JSON.stringify(document),before);
});

test('G4: completed school spans, source wording and degree flags remain visible within six-row template',()=>{
  const document=base();
  const provenance=[{sourceType:'synthetic-fixture',sourceExcerpt:'Doctor of Medicine at Synthetic Medical College, 2018 to 2022'}];
  document.events=[{
    id:'degree-span',title:'Doctor of Medicine',siteName:'Synthetic Medical College',categoryId:'education',eventType:'duration',
    startDate:'2018-01',endDate:'2022-12',openEnded:false,visibilityState:'INTERVIEWER_SAFE',
    fields:{datePrecision:{start:'YEAR',end:'YEAR'},sourceDateWording:{start:{raw:'2018',normalizedMonth:'2018-01',precision:'YEAR'},end:{raw:'2022',normalizedMonth:'2022-12',precision:'YEAR'}}},provenance
  }];
  const before=JSON.stringify(document),{scene,svg}=render(document);
  assert.deepEqual(scene.profile.educationRecords.map(record=>({id:record.eventId,title:record.title,school:record.school,start:record.startDate,end:record.endDate,provenance:record.provenance})),[
    {id:'degree-span',title:'Doctor of Medicine',school:'Synthetic Medical College',start:'2018-01',end:'2022-12',provenance}
  ]);
  assert.equal(scene.flags.find(flag=>flag.id==='degree-span')?.month,'2022-12');
  assert.equal(scene.arrows.some(arrow=>arrow.id==='degree-span'),false);
  assert.equal(scene.founderPresentation.categoryKey.length,6);
  assert.equal(scene.founderPresentation.categoryKey.some(row=>row.id==='education'),false);
  const education=paintedText(svg,node=>node.semanticRef==='degree-span'&&node.sourceAttributes['data-material-field']==='educationSpan');
  for(const fact of ['Doctor of Medicine','Synthetic Medical College','2018','2022'])assert.ok(education.includes(fact),`education profile omitted ${fact}`);
  assert.match(education,/: 2018 – 2022/,'year-only source precision stays visible');
  assert.doesNotMatch(education,/1\/18|12\/22/,'year-only source is not rendered as invented months');
  assert.equal(JSON.stringify(document),before);
});

test('G4: an authored profile position is retained during composition with education content',()=>{
  const document=base();
  const geometry={x:24,y:635,width:545,height:410};
  document.presentationOverrides={profileGeometry:geometry};
  document.events=[{id:'degree-span',title:'Medical degree',siteName:'Synthetic Medical College',categoryId:'education',eventType:'duration',startDate:'2018-01',endDate:'2022-12',visibilityState:'INTERVIEWER_SAFE',fields:{datePrecision:{start:'YEAR',end:'YEAR'}}}];
  const {scene,svg}=render(document);
  assert.equal(scene.founderPresentation.profileGeometryExplicit,true);
  assert.deepEqual(scene.founderPresentation.profileGeometry,geometry);
  assert.match(svg,/data-artifact-chrome="profile" data-founder-geometry="24,635,545,410"/);
  assert.match(svg,/data-material-field="educationSpan"/);
});

test('painted Bezier bounds use exact extrema instead of invisible control-point hulls',()=>{
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><path d="M0 0 C100 100 100 100 200 0" fill="#000"/><path d="M0 0 Q100 100 200 0" fill="#000"/></svg>';
  const paths=resolveFounderPresentationSvg(svg).nodes.filter(node=>node.kind==='path');
  assert.equal(paths.length,2);
  assert.ok(Math.abs(paths[0].bounds.height-75)<1e-9,'cubic peak is 75, not its 100px control hull');
  assert.ok(Math.abs(paths[1].bounds.height-50)<1e-9,'quadratic peak is 50, not its 100px control hull');
  for(const path of paths){assert.equal(path.bounds.x,0);assert.equal(path.bounds.width,200);}
});


test('supplied media that cannot render is an explicit hold, not an empty optional slot',()=>{
 const document=base();document.mediaItems=[{id:'lost-profile',type:'profilePhoto',storagePath:'missing-local-fixture'}];
 const out=render(document);assert.throws(()=>assertCompleteFounderPresentation(out),e=>e.code==='TIMELINE_EXPORT_MISSING_FIELDS'&&e.fields.some(f=>f.id==='lost-profile'&&f.field==='media'));
 document.mediaItems[0].visibilityState='ADVISOR_ONLY';
 assert.doesNotThrow(()=>assertCompleteFounderPresentation(render(document)),'private assets do not block a public export');
});

test('education span cannot disappear while its degree flag remains',()=>{
 const document=base();document.events=[{id:'school',title:'Medical degree',siteName:'Synthetic College',categoryId:'education',eventType:'duration',startDate:'2018-09',endDate:'2022-06',visibilityState:'INTERVIEWER_SAFE'}];
 const out=render(document);assert.doesNotThrow(()=>assertCompleteFounderPresentation(out));
 out.svg=out.svg.replace(/<text[^>]*data-material-field="educationSpan"[\s\S]*?<\/text>/g,'');
 assert.throws(()=>assertCompleteFounderPresentation(out),e=>e.code==='TIMELINE_EXPORT_MISSING_FIELDS'&&e.fields.some(f=>f.field==='education.startDate'));
});

test('exact interview day survives and invalid dates are held for correction',()=>{
 const document=base();document.metadata.interview={date:'2026-11-19'};
 assert.match(render(document).svg,/Interview · Nov 19, 2026/);
 for(const date of ['undetermined','2026-02-31']){document.metadata.interview.date=date;assert.throws(()=>assertCompleteFounderPresentation(render(document)),e=>e.code==='TIMELINE_EXPORT_MISSING_FIELDS'&&e.fields.some(f=>f.id==='interview'));}
});

test('three same-month milestones fit without moving dates, merging labels or changing the key',()=>{
 const document=structuredClone(FOUNDER_2025_MATRIX.find(item=>item.id==='M14').document),before=JSON.stringify(document),out=render(document);
 assert.doesNotThrow(()=>assertCompleteFounderPresentation(out));
 assert.equal(out.scene.flags.length,3);assert.ok(out.scene.flags.every(flag=>flag.month==='2023-05'));
 assert.equal(out.scene.founderPresentation.categoryKey.length,6);
 assert.deepEqual(out.scene.composedAxis.segmentWeights.map(x=>x.id),['2022','2023']);
 assert.equal(JSON.stringify(document),before);
});
