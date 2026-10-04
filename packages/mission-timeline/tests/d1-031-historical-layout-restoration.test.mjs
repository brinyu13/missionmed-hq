import assert from 'node:assert/strict';
import test from 'node:test';
import {serializeFounderPresentation,assertCompleteFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {resolveFounderPresentationSvg,materialPresentationCollisions} from '../web/js/presentation/resolved-founder-presentation.js';
import {setAxisPresentationOverride,setAxisSegmentWeights} from '../web/js/uxr-002/advanced-studio.js';
import {applySceneCommandToDocument} from '../web/js/editor/scene-commands.js';
import {FOUNDER_2025_MATRIX} from './fixtures/founder-2025-matrix.mjs';

const fixture=id=>structuredClone(FOUNDER_2025_MATRIX.find(f=>f.id===id).document);
const render=document=>serializeFounderPresentation(document,{scope:'INTERVIEWER_SAFE',currentMonth:'2026-10'});
function arrows(result){
  const nodes=resolveFounderPresentationSvg(result.svg).nodes;
  return result.scene.arrows.map(arrow=>({id:arrow.id,start:arrow.startMonth,...nodes.find(node=>node.semanticRef===arrow.id&&node.sourceAttributes['data-continuous-duration-arrow'])?.bounds}));
}
const reversals=positions=>positions.filter((position,index)=>index&&position.start>positions[index-1].start&&position.y<positions[index-1].y).length;
const cells=result=>[...result.svg.matchAll(/data-axis-segment-id="([^"]+)" data-axis-segment-weight="([^"]+)" data-axis-date-width="([^"]+)"[^>]*><rect data-axis-cell="true" x="([^"]+)" y="[^"]+" width="([^"]+)"/g)].map(m=>({id:m[1],weight:+m[2],dateWidth:+m[3],x:+m[4],width:+m[5]}));

test('normal historical stair and equal-year baseline remain while all facts survive',()=>{
  const document=fixture('M01'),before=JSON.stringify(document),result=render(document);
  assert.deepEqual(arrows(result).map(({id,y})=>[id,y]),[['work',206],['study',288],['rotation',370],['research',452]]);
  assert.equal(result.scene.composedAxis,undefined);
  assert.ok(cells(result).every(cell=>cell.weight===1));
  assert.doesNotThrow(()=>assertCompleteFounderPresentation(result));
  assert.equal(JSON.stringify(document),before);
});

test('dense chronological repair keeps the March rotation below February without introducing collisions',()=>{
  const document=fixture('M03'),before=JSON.stringify(document),result=render(document),positions=arrows(result);
  assert.ok(positions.find(a=>a.id==='rotation-14').y>=positions.find(a=>a.id==='rotation-13').y);
  assert.ok(reversals(positions)<6,'accepted BASE had six backward date transitions on these exact facts');
  assert.equal(materialPresentationCollisions(resolveFounderPresentationSvg(result.svg)).length,0);
  assert.doesNotThrow(()=>assertCompleteFounderPresentation(result));
  assert.equal(JSON.stringify(document),before);
  assert.equal(result.svg,render(document).svg);
  const reordered={...document,events:[...document.events].reverse()};
  const expected=positions.filter(a=>!['rotation','rotation-6','rotation-12','research'].includes(a.id));
  const actual=arrows(render(reordered));
  // Equal-start ties retain source order; uniquely dated chronology is stable.
  assert.deepEqual(actual.map(a=>[a.id,a.start]).sort(),positions.map(a=>[a.id,a.start]).sort());
  assert.ok(reversals(actual)<6);
  assert.ok(expected.every(a=>actual.some(b=>b.id===a.id&&b.start===a.start)));
});

test('unique-date source order does not change repaired geometry and extreme safe fallback remains',()=>{
  const document=fixture('M05'),result=render(document);
  assert.deepEqual(arrows(render({...document,events:[...document.events].reverse()})),arrows(result));
  const extreme=render(fixture('M20'));
  assert.doesNotThrow(()=>assertCompleteFounderPresentation(extreme));
  assert.equal(reversals(arrows(extreme)),14,'unsafe chronological trial retains the verified BASE placement');
});

test('unequal year drag reflows automatic anchors relatively while authored geometry survives',()=>{
  const document=fixture('M03');document.mode='advanced';
  const shown=render(document),initial=cells(shown),geometry={x:1300,y:700,width:180,height:30,rotation:0};
  const moved=applySceneCommandToDocument(document,{kind:'geometry',target:{type:'event',id:'rotation-4'},geometry,create:{type:'event',semanticRef:'rotation-4',aspectLocked:false,presentation:{eventType:'duration'}}});
  assert.equal(moved.changed,true);
  assert.deepEqual(moved.document.events,document.events);
  const weights=initial.map((cell,index)=>({id:cell.id,weight:cell.weight+(index===1?.1:index===2?-.1:0)}));
  const ranged=setAxisPresentationOverride(moved.document,{startYear:2020,endYear:2025,includeFuture:false});
  const resized=setAxisSegmentWeights(ranged.document,weights);assert.equal(resized.changed,true);
  const result=render(resized.document),next=cells(result),study=arrows(result).find(a=>a.id==='study');
  const cell=next.find(c=>c.id==='2022');
  const dateStart=39.36+initial.slice(0,2).reduce((sum,c)=>sum+c.dateWidth,0);
  const newDateStart=39.36+next.slice(0,2).reduce((sum,c)=>sum+c.dateWidth,0);
  assert.notEqual(dateStart,newDateStart);
  assert.ok(Math.abs(study.x-(newDateStart+cell.dateWidth*6/12))<1/64,'July remains halfway through its resized year');
  const manual=arrows(result).find(a=>a.id==='rotation-4');
  for(const key of ['x','y','width','height'])assert.equal(manual[key],geometry[key]);
  assert.deepEqual(resized.document.events,document.events);
  assert.equal(result.svg,render(resized.document).svg);
});

test('valid manual offsets and locked lane cannot participate in chronological placement trials',()=>{
  const document=fixture('M03');
  document.events.find(e=>e.id==='rotation-6').manualOffset={x:12,y:9};
  document.events.find(e=>e.id==='rotation-5').manualOffset={laneLocked:true,x:0,y:0};
  document.events.find(e=>e.id==='rotation-5').lane=4;
  const before=JSON.stringify(document),result=render(document);
  assert.equal(JSON.stringify(document),before);
  assert.equal(result.scene.composedAxis,undefined);
  assert.equal(result.scene.autoArrowGeometry?.has('rotation-5'),false);
  assert.deepEqual(result.scene.arrows.find(a=>a.id==='rotation-6').manualOffset,{x:12,y:9});
  assert.equal(result.svg,render(document).svg);
});

// Normalized facts from the preserved synthetic Ana CV; no source images or
// private applicant content. Parent separately replays exact original media.
test('recovered normal CV degree and full school fit above the ribbon with the education span retained',()=>{
  const document={id:'historical-normal-degree',theme:'keynote-classic',studentProfile:{"fullName":"Ana Popescu","medicalSchool":"Carol Davila University of Medicine and Pharmacy","degree":"MD"},events:[
    {"id":"event-39fd6dd7-03c3-42a3-a5d9-2f850aeaf293","title":"Doctor of Medicine (MD)","categoryId":"education","eventType":"duration","startDate":"2016-09","endDate":"2022-06","siteName":"Carol Davila University of Medicine and Pharmacy","visibilityState":"INTERVIEWER_SAFE"},
    {"id":"event-eb59c669-c278-46ff-b94e-b255508ea0bd","title":"USMLE Step 1 — Pass","categoryId":"exams","eventType":"milestone","startDate":"2022-11","endDate":null,"siteName":"","visibilityState":"INTERVIEWER_SAFE"},
    {"id":"event-e8713e32-140a-40b7-819c-7c2152ce03a7","title":"USMLE Step 2 CK — 251","categoryId":"exams","eventType":"milestone","startDate":"2023-03","endDate":null,"siteName":"","visibilityState":"INTERVIEWER_SAFE"},
    {"id":"event-270f4c88-d43f-4398-bd0c-8c405b2adcaf","title":"Observership","categoryId":"clinical","eventType":"duration","startDate":"2023-07","endDate":"2023-08","siteName":"Mount Sinai Hospital","visibilityState":"INTERVIEWER_SAFE"},
    {"id":"event-bfc34a91-d825-4d96-9520-aa31de33f2a1","title":"Clinical Elective","categoryId":"clinical","eventType":"duration","startDate":"2023-10","endDate":"2023-11","siteName":"Cleveland Clinic","visibilityState":"INTERVIEWER_SAFE"},
    {"id":"event-4bbcf334-1cb0-470c-8d7b-772d4fe500c2","title":"Resident Physician (PGY-1 equivalent)","categoryId":"work","eventType":"duration","startDate":"2023-01","endDate":"2024-06","siteName":"Emergency University Hospital Bucharest","visibilityState":"INTERVIEWER_SAFE"},
    {"id":"event-6a72760e-d4a7-4082-a58a-2d5c98f4328a","title":"Research Assistant","categoryId":"research","eventType":"duration","startDate":"2021-03","endDate":"2022-12","siteName":"Cardiovascular Outcomes Lab, Carol Davila University","visibilityState":"INTERVIEWER_SAFE"},
    {"id":"event-b1ef9cef-c326-43f2-ba1c-1378ba311b1a","title":"Outcomes after early anticoagulation.","categoryId":"research","eventType":"milestone","startDate":"2023-01","endDate":null,"siteName":"J Synthetic Cardiol.","visibilityState":"INTERVIEWER_SAFE"},
    {"id":"event-113032e1-17a5-472d-8519-45ead54d0576","title":"Volunteer","categoryId":"work","eventType":"duration","startDate":"2019-01","endDate":"2021-12","siteName":"Red Cross Romania","visibilityState":"INTERVIEWER_SAFE"},
  ],advanced:{media:[],textBlocks:[],elements:[],groups:[]}};
  const before=JSON.stringify(document),result=render(document),nodes=resolveFounderPresentationSvg(result.svg).nodes;
  const degreeId=document.events.find(e=>e.categoryId==='education').id;
  const labels=nodes.filter(n=>n.semanticRef===degreeId&&n.sourceAttributes['data-board-ink-role']==='flag-label');
  assert.equal(labels.length,1,'full label uses its measured available width');
  assert.ok(labels[0].text.includes('Doctor of Medicine (MD)'));
  assert.ok(labels[0].text.includes(document.studentProfile.medicalSchool));
  assert.ok(labels[0].bounds.y+labels[0].bounds.height<=125);
  assert.ok(result.scene.autoFlagLabels.get(degreeId).width>560);
  assert.match(result.svg,/9\/16/);assert.match(result.svg,/6\/22/);
  assert.equal(materialPresentationCollisions(resolveFounderPresentationSvg(result.svg)).length,0);
  assert.doesNotThrow(()=>assertCompleteFounderPresentation(result));
  assert.equal(JSON.stringify(document),before);assert.equal(result.svg,render(document).svg);
});
