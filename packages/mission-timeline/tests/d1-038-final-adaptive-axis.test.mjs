import assert from 'node:assert/strict';
import test from 'node:test';
import {deriveFounderYearAllocation,restoreFounderYearAllocation} from '../web/js/uxr-002/adaptive-layout.js';
import {serializeFounderPresentation,serializeFounderScene,buildFounderPresentationScene,assertCompleteFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {composeLocked407FPortableSvg} from '../web/js/uxr-002/locked-407f-export.js';
import {resolveFounderPresentationSvg,materialPresentationCollisions} from '../web/js/presentation/resolved-founder-presentation.js';
import {applySceneCommandToDocument} from '../web/js/editor/scene-commands.js';
import {setAxisSegmentWeights} from '../web/js/uxr-002/advanced-studio.js';
import {readFileSync} from 'node:fs';
import {FOUNDER_2025_MATRIX} from './fixtures/founder-2025-matrix.mjs';

const duration=(id,startDate,endDate,extra={})=>({id,title:id,categoryId:'work',
  eventType:'duration',startDate,endDate,visibilityState:'INTERVIEWER_SAFE',...extra});
const document=events=>({id:'synthetic-final-axis',theme:'keynote-classic',
  studentProfile:{fullName:'Synthetic Axis'},events,
  advanced:{media:[],textBlocks:[],elements:[],groups:[]}});
const busy=()=>document([
  duration('A','2012-01','2018-12'),duration('B','2012-01','2018-12'),
  duration('C','2025-01','2025-12')
]);
const render=input=>serializeFounderPresentation(input,{scope:'INTERVIEWER_SAFE',currentMonth:'2026-10'});
const cells=result=>[...result.svg.matchAll(/data-axis-segment-id="([^"]+)" data-axis-segment-weight="([^"]+)" data-axis-date-width="([^"]+)"/g)]
  .map(match=>({id:match[1],weight:+match[2],width:+match[3]}));
const close=(actual,expected,epsilon=1e-8)=>assert.ok(Math.abs(actual-expected)<epsilon,`${actual} versus ${expected}`);
const paintedArrow=(result,id)=>resolveFounderPresentationSvg(result.svg).nodes.find(node=>
  node.semanticRef===id&&node.sourceAttributes['data-continuous-duration-arrow']);
const measure=text=>String(text).length*9;

test('automatic final cells expand active early years and compress quiet years with immutable facts',()=>{
  const input=busy(),before=JSON.stringify(input),result=render(input),segments=cells(result);
  assert.equal(segments.length,14);
  assert.deepEqual(segments.map(s=>s.id),Array.from({length:14},(_,i)=>String(2012+i)));
  assert.ok(segments.find(s=>s.id==='2014').width>segments.find(s=>s.id==='2020').width);
  assert.ok(segments.every(s=>s.width>=80-1e-8));
  close(segments.reduce((sum,s)=>sum+s.width,0),1918*.96);
  assert.equal(materialPresentationCollisions(resolveFounderPresentationSvg(result.svg)).length,0);
  assert.ok(result.scene.composedAxis,'the zero-collision early return must retain its axis snapshot');
  assert.equal(result.scene.autoYearAllocation.fallback,false);
  assert.equal(result.svg,render(input).svg);
  assert.equal(JSON.stringify(input),before);
  assert.deepEqual(cells(render({...input,events:[...input.events].reverse()})),segments);
});

test('span interiors, complete label widths and milestones each contribute automatic year demand',()=>{
  const options={firstYear:2020,lastYear:2027,measureText:measure};
  const longSpan=duration('span','2020-01','2024-12');
  const allocation=deriveFounderYearAllocation([longSpan],options);
  assert.ok(allocation.autoYearWeights.get(2022)>allocation.autoYearWeights.get(2026),
    'interior activity is demand even without an endpoint in that year');
  const short=duration('short','2022-01','2022-01');
  const long={...short,title:'Complete synthetic role title with a supplied long institution',siteName:'Synthetic institution'};
  assert.ok(deriveFounderYearAllocation([long],options).autoYearWeights.get(2022)>
    deriveFounderYearAllocation([short],options).autoYearWeights.get(2022));
  const milestone={...short,eventType:'milestone',endDate:null};
  assert.ok(deriveFounderYearAllocation([milestone],options).autoYearWeights.get(2022)>
    deriveFounderYearAllocation([short],options).autoYearWeights.get(2022));
  const base=document([duration('first','2020-01','2020-12'),duration('last','2027-01','2027-12')]);
  const expanded=render({...base,events:[...base.events,longSpan,milestone]});
  const baseline=render(base);
  assert.ok(cells(expanded).find(s=>s.id==='2022').width>cells(baseline).find(s=>s.id==='2022').width);
  assert.ok(expanded.scene.flags.some(flag=>flag.id==='short'));
});

test('short and long numeric spans consume the full portable width without condensed early years',()=>{
  for(const count of [1,2,3,4,14,31]){
    const allocation=deriveFounderYearAllocation([
      duration('busy','2000-01','2000-12'),duration('end',`${1999+count}-01`,`${1999+count}-12`)
    ],{firstYear:2000,lastYear:1999+count,measureText:measure});
    const weights=allocation.composedAxis.segmentWeights,total=weights.reduce((sum,s)=>sum+s.weight,0);
    const widths=weights.map(s=>1918*.96*s.weight/total);
    assert.equal(weights.length,count);
    close(widths.reduce((sum,width)=>sum+width,0),1918*.96);
    assert.ok(widths.every(width=>width>=Math.min(80,1918*.96/count)-1e-8));
    assert.ok(weights.every(s=>s.weight>=.25&&s.weight<=8));
  }
});

test('manual weights dominate automatic demand and date anchors stay relative to resized years',()=>{
  const input=busy();input.events.push(duration('July','2021-07','2021-12'));
  const shown=render(input),axis=shown.scene.composedAxis;
  const manual={...input,mode:'advanced',presentationOverrides:{axis:structuredClone(axis)}};
  const before=cells(render(manual)),target=axis.segmentWeights.map(s=>({
    id:s.id,weight:s.weight+(s.id==='2020'?.15:s.id==='2021'?-.15:0)
  }));
  const resized=setAxisSegmentWeights(manual,target);
  assert.equal(resized.changed,true);
  const after=render(resized.document),next=cells(after),year=next.find(s=>s.id==='2021');
  assert.equal(after.scene.autoYearWeights,undefined);
  assert.notEqual(next.find(s=>s.id==='2020').width,before.find(s=>s.id==='2020').width);
  const expected=39.36+next.filter(s=>+s.id<2021).reduce((sum,s)=>sum+s.width,0)+year.width/2;
  close(paintedArrow(after,'July').commands[0].x,expected,1/64);
  assert.deepEqual(resized.document.events,input.events);
});

test('first authored event geometry freezes the displayed automatic or refined axis exactly',()=>{
  for(const input of [busy(),document([
    duration('a','2020-01','2024-12',{title:'Synthetic complete duration label'}),
    duration('b','2020-02','2025-06'),duration('c','2025-07','2025-12')
  ])]){
    const shown=render(input),id=input.events[0].id,geometry={x:1000,y:750,width:180,height:30,rotation:0};
    const moved=applySceneCommandToDocument(input,{kind:'geometry',target:{type:'event',id},geometry,
      create:{type:'event',semanticRef:id,aspectLocked:false,presentation:{eventType:'duration'}}},
      {scope:'INTERVIEWER_SAFE'});
    assert.equal(moved.changed,true);
    assert.deepEqual(moved.document.presentationOverrides.axis,shown.scene.composedAxis);
    const rendered=render(moved.document);
    const original=cells(shown),next=cells(rendered);
    assert.deepEqual(next.map(s=>s.id),original.map(s=>s.id));
    next.forEach((s,i)=>close(s.width,original[i].width));
    const bounds=paintedArrow(rendered,id).bounds;
    for(const key of ['x','y','width','height'])close(bounds[key],geometry[key],1/64);
    assert.deepEqual(moved.document.events,input.events);
  }
});

test('pre-existing authored event geometry, manual offsets and locked lanes bypass automatic reallocation',()=>{
  for(const offset of [{x:12,y:9},{laneLocked:true,x:0,y:0}]){
    const input=busy();input.events[0].manualOffset=offset;input.events[0].lane=4;
    const before=JSON.stringify(input),result=render(input);
    assert.equal(result.scene.autoYearWeights,undefined);
    assert.equal(result.scene.composedAxis,undefined);
    assert.equal(JSON.stringify(input),before);
  }
  const input=busy(),moved=applySceneCommandToDocument(input,{
    kind:'geometry',target:{type:'event',id:'A'},geometry:{x:700,y:700,width:140,height:30,rotation:0},
    create:{type:'event',semanticRef:'A',presentation:{eventType:'duration'}}
  }).document;
  delete moved.presentationOverrides.axis; // Legacy authored event before the axis-freeze contract.
  const result=render(moved);
  assert.equal(result.scene.autoYearWeights,undefined);
  assert.equal(result.scene.composedAxis,undefined);
  close(paintedArrow(result,'A').bounds.x,700);
});

test('single-year final axis snapshot agrees with the portable year interval',()=>{
  const input=document([duration('one','2024-03','2024-10')]),result=render(input);
  assert.deepEqual(cells(result).map(s=>s.id),['2024']);
  assert.equal(result.scene.composedAxis.startYear,2024);
  assert.equal(result.scene.composedAxis.endYear,2024);
});

test('theme projection and JSON save/reopen preserve automatic allocation and the first edit',()=>{
  for(const theme of ['keynote-classic','mission-navy','horizon','little-journeys']){
    const input={...busy(),theme},before=JSON.stringify(input),shown=render(input);
    const reopened=JSON.parse(before);
    assert.deepEqual(cells(render(reopened)),cells(shown));
    const initial=buildFounderPresentationScene(reopened,{currentMonth:'2026-10'});
    const transported=JSON.parse(JSON.stringify(initial));
    const restoredSvg=serializeFounderScene(transported);
    cells({svg:restoredSvg}).forEach((s,i)=>close(s.width,cells(shown)[i].width));
    const moved=applySceneCommandToDocument(reopened,{kind:'geometry',target:{type:'event',id:'A'},
      geometry:{x:900,y:750,width:180,height:30,rotation:0},
      create:{type:'event',semanticRef:'A',presentation:{eventType:'duration'}}},{scope:'INTERVIEWER_SAFE'});
    const saved=JSON.parse(JSON.stringify(moved.document));
    cells(render(saved)).forEach((s,i)=>close(s.width,cells(shown)[i].width));
    assert.deepEqual(saved.events,input.events);
    assert.equal(JSON.stringify(input),before);
  }
});

test('allocation recovery retains a refined snapshot and saturated weights remain manually valid',()=>{
  const allocation=deriveFounderYearAllocation(Array.from({length:14},(_,i)=>
    duration(String(i),`${2012+i}-01`,`${2012+i}-12`,{title:'Synthetic complete label '.repeat(30)})
  ),{firstYear:2012,lastYear:2025,measureText:measure});
  assert.ok(allocation.composedAxis.segmentWeights.every(s=>s.weight<=8));
  const refined=render(busy()).scene;
  const recovered=restoreFounderYearAllocation({autoYearWeights:{},composedAxis:refined.composedAxis});
  const recreated=deriveFounderYearAllocation([],{
    firstYear:2012,lastYear:2025,measureText:measure
  });
  assert.ok(recovered.autoYearWeights.get(2012)>recreated.autoYearWeights.get(2012));
  const count=14,total=[...recovered.autoYearWeights.values()].reduce((sum,w)=>sum+w,0);
  const floor=80/1918*100,flexible=96-floor*count;
  const original=cells({svg:serializeFounderScene(buildFounderPresentationScene(busy(),{currentMonth:'2026-10'}))});
  for(const [year,weight] of recovered.autoYearWeights){
    close(1918*(floor+flexible*weight/total)/100,original.find(s=>+s.id===year).width);
  }
});

test('bounded recovery diagnoses genuine paint risk and retains the existing safe composer result',()=>{
  const fixture=JSON.parse(readFileSync(new URL('fixtures/d1-timeline-astra-021/golden2-guardian-milestones.json',import.meta.url),'utf8'));
  const input=fixture.document,before=JSON.stringify(input);
  const result=serializeFounderPresentation(input,{scope:'FULL_STORY',currentMonth:'2026-10'});
  const diagnostic=result.scene.autoYearAllocation;
  assert.equal(diagnostic.fallback,true);
  assert.equal(diagnostic.reason,'weighted-paint-risk');
  assert.ok(diagnostic.weightedRisk>diagnostic.selectedRisk);
  assert.equal(diagnostic.selectedRisk,0);
  assert.equal(materialPresentationCollisions(resolveFounderPresentationSvg(result.svg)).length,0);
  assert.ok(result.scene.composedAxis,'safe recovery still preserves the displayed axis on first edit');
  assert.equal(JSON.stringify(input),before);
  assert.equal(diagnostic.adaptive,false,
    'constrained milestone recovery honestly records its equal-year fallback');
});

test('equal paint risk retains demand and existing extreme offboard text continues to block export',()=>{
  const input=FOUNDER_2025_MATRIX.find(f=>f.id==='M20').document;
  const result=render(input),initial=buildFounderPresentationScene(input,{currentMonth:'2026-10'});
  const baseline=composeLocked407FPortableSvg({...initial,autoYearWeights:undefined,composedAxis:undefined});
  const overflow=svg=>resolveFounderPresentationSvg(svg).nodes.filter(node=>node.kind==='text'&&(
    node.sourceAttributes['data-text-overflow']==='true'||node.bounds.x<-.5||node.bounds.y<-.5||
    node.bounds.x+node.bounds.width>1920.5||node.bounds.y+node.bounds.height>1080.5
  )).map(node=>[node.semanticRef,node.text,node.bounds.y]);
  assert.deepEqual(overflow(result.svg),overflow(baseline.svg));
  assert.ok(overflow(result.svg).length,'the preserved extreme layout already has offboard text');
  assert.equal(result.scene.autoYearAllocation.fallback,false);
  assert.equal(result.scene.autoYearAllocation.selectedRisk,result.scene.autoYearAllocation.weightedRisk);
  assert.throws(()=>assertCompleteFounderPresentation(result),{code:'TIMELINE_EXPORT_TEXT_OVERFLOW'});
});
