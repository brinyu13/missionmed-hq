import assert from "node:assert/strict";
import test from "node:test";

globalThis.window=globalThis;
const {projectTimelineDocument}=await import(
  "../web/js/d1-411a/domain-visual-adapter.js?d1-411a-presentation-amendment"
);
const {
  effectiveAxisOverride,
  effectiveColorKeyGeometry,
  effectiveCategoryKey,
  renderAdvancedPresentationControls,
  resetAxisPresentationOverride,
  resetColorKeyGeometryPresentationOverride,
  resetCategoryKeyPresentationOverride,
  setAxisPresentationOverride,
  setAxisSegmentWeights,
  setCategoryKeyPresentationOverride,
  setColorKeyGeometryPresentationOverride
}=await import("../web/js/uxr-002/advanced-studio.js?d1-411a-presentation-amendment");
const {migrateDocument}=await import("../web/js/uxr-002/store.js?d1-411a-presentation-amendment");
await import("../web/js/d1-411a/presentation-kernel-adapter.js?d1-411a-presentation-amendment");
const {toRenderModel}=globalThis.D1411A_Adapter;

const IDS=["education","exams","clinical","work","research","personal"];

function timeline(){
  return{
    schemaVersion:"d1-timeline-document/1",
    id:"axis-key-test",
    title:"Timeline: Axis and Key",
    mode:"advanced",
    studentProfile:{fullName:"Axis Key"},
    categories:IDS.map((id,index)=>({
      id,
      label:["Medical Education","USMLE Studies","US Clinical Experience","Work Experience","Research","Personal (Not on CV)"][index],
      color:["#2C6E8F","#3A78C9","#C8641C","#3F9B52","#C9A227","#8A5BBF"][index]
    })),
    events:[
      {id:"school",title:"Medical school",categoryId:"education",startDate:"2019-08",endDate:"2023-05",visibilityState:"INTERVIEWER_SAFE",fields:{}},
      {id:"rotation",title:"Rotation",categoryId:"clinical",startDate:"2024-01",endDate:"2024-03",visibilityState:"INTERVIEWER_SAFE",fields:{}}
    ],
    exams:[],advanced:{media:[],textBlocks:[]},metadata:{interview:{}},presentationOverrides:{}
  };
}

test("D1-411A absent overrides preserve the accepted adaptive render model",()=>{
  const projected=projectTimelineDocument(timeline(),{revision:1});
  assert.equal("axisOverride" in projected.model,false);
  assert.equal("categoryKey" in projected.model,false);
  assert.equal("categoryId" in projected.model.events[0],false);
  assert.equal(projected.model.axisMode,"adaptive");
});

test("D1-411A manual axis is history-ready, bounded, inclusive, and resettable",()=>{
  const source=timeline();
  const changed=setAxisPresentationOverride(source,{startYear:2018,endYear:2026,includeFuture:false});
  assert.equal(changed.changed,true);
  assert.deepEqual(effectiveAxisOverride(changed.document),{
    mode:"manual",startYear:2018,endYear:2026,includeFuture:false
  });
  const projected=projectTimelineDocument(changed.document,{revision:2});
  assert.deepEqual(projected.model.axisOverride,{
    mode:"manual",startYear:2018,endYear:2026,includeFuture:false
  });
  assert.equal(setAxisPresentationOverride(source,{startYear:2020,endYear:2024}).changed,false);
  assert.match(setAxisPresentationOverride(source,{startYear:2020,endYear:2024}).error,/include all visible dates/);
  assert.equal(resetAxisPresentationOverride(changed.document).document.presentationOverrides.axis,undefined);
  assert.equal(setAxisPresentationOverride(source,{startYear:1899,endYear:2024}).changed,false);
});

test("D1-411A ongoing events extend to the explicit manual axis end",()=>{
  const source=timeline();
  source.events[0].openEnded=true;
  delete source.events[0].endDate;
  const changed=setAxisPresentationOverride(source,{startYear:2018,endYear:2026,includeFuture:true});
  const model=projectTimelineDocument(changed.document,{revision:2}).model;
  const ongoing=model.events.find(({id})=>id==="ev-school");
  assert.equal(ongoing.ey,2026);
  assert.equal(ongoing.em,12);
  assert.match(ongoing.date,/Active$/);
});

test("D1-411A direct axis resizing preserves ordered segments and persists safe relative weights",()=>{
  const manual=setAxisPresentationOverride(timeline(),{
    startYear:2018,endYear:2026,includeFuture:true
  }).document;
  const ids=["2018","2019","2020","2021","2022","2023","2024","2025","2026","FUTURE"];
  const result=setAxisSegmentWeights(manual,ids.map((id,index)=>({
    id,weight:index===3?1.5:index===4?0.5:1
  })));
  assert.equal(result.changed,true);
  assert.deepEqual(effectiveAxisOverride(result.document).segmentWeights,result.document.presentationOverrides.axis.segmentWeights);
  assert.equal(setAxisSegmentWeights(manual,[{id:"2020",weight:1}]).changed,false);
  assert.equal(setAxisSegmentWeights(manual,ids.map((id)=>({id,weight:.1}))).changed,false);
  assert.deepEqual(effectiveCategoryKey(result.document).map(({id})=>id),IDS);
});

test("D1-411A category override keeps the exact six IDs/order and resets atomically",()=>{
  let source=timeline();
  source=setCategoryKeyPresentationOverride(source,"education",{
    label:"Medical Training",color:"#123ABC"
  }).document;
  const key=effectiveCategoryKey(source);
  assert.deepEqual(key.map(({id,order})=>[id,order]),IDS.map((id,index)=>[id,index]));
  assert.equal(key[0].label,"Medical Training");
  assert.equal(key[0].color,"#123ABC");
  const model=projectTimelineDocument(source,{revision:3}).model;
  assert.deepEqual(model.categoryKey.map(({id,order})=>[id,order]),IDS.map((id,index)=>[id,index]));
  assert.equal(model.events[0].categoryId,"education");
  assert.equal(resetCategoryKeyPresentationOverride(source).document.presentationOverrides.categoryKey,undefined);
});

test("D1-411A Color Key geometry is board-bounded, persistent, and independently resettable",()=>{
  const changed=setColorKeyGeometryPresentationOverride(timeline(),{
    x:1880,y:1060,width:500,height:400
  });
  assert.equal(changed.changed,true);
  assert.deepEqual(effectiveColorKeyGeometry(changed.document),{
    x:1420,y:680,width:500,height:400
  });
  assert.equal(changed.document.presentationOverrides.categoryKey,undefined);
  assert.equal(resetColorKeyGeometryPresentationOverride(changed.document).document.presentationOverrides.colorKeyGeometry,undefined);
});

test("D1-411A malformed, duplicated, extra, or reordered overrides fail closed",()=>{
  const base=timeline();
  const valid=effectiveCategoryKey(base);
  for(const categoryKey of [
    valid.slice(0,5),
    [...valid,valid[0]],
    [valid[1],valid[0],...valid.slice(2)],
    valid.map((item,index)=>index===2?{...item,color:"orange"}:item)
  ]){
    const source=structuredClone(base);
    source.presentationOverrides.categoryKey=categoryKey;
    assert.throws(()=>projectTimelineDocument(source,{revision:4}),/category key|category label\/color/i);
  }
  const badAxis=structuredClone(base);
  badAxis.presentationOverrides.axis={mode:"cropped",startYear:2019,endYear:2024,includeFuture:true};
  assert.throws(()=>projectTimelineDocument(badAxis,{revision:5}),/axis override mode must be manual/i);
  const outOfBounds=structuredClone(base);
  outOfBounds.presentationOverrides.axis={mode:"manual",startYear:1899,endYear:2024,includeFuture:true};
  assert.throws(()=>projectTimelineDocument(outOfBounds,{revision:6}),/1900–2200/);
  const longLabel=structuredClone(base);
  longLabel.presentationOverrides.categoryKey=valid.map((item,index)=>index===0?{...item,label:"A".repeat(33)}:item);
  assert.throws(()=>projectTimelineDocument(longLabel,{revision:7}),/category label\/color/i);
});

test("D1-411A store migration preserves explicit presentation overrides exactly",()=>{
  const source=timeline();
  source.presentationOverrides={
    axis:{mode:"manual",startYear:2018,endYear:2026,includeFuture:false},
    categoryKey:effectiveCategoryKey(source)
  };
  assert.deepEqual(migrateDocument(source).presentationOverrides,source.presentationOverrides);
});

test("D1-411A Advanced UI exposes axis and six key controls only in Advanced mode",()=>{
  const advanced=renderAdvancedPresentationControls(timeline());
  assert.match(advanced,/data-axis-override-mode/);
  assert.match(advanced,/data-color-key-geometry-field="width"/);
  assert.equal((advanced.match(/data-category-key-id=/g)||[]).length,6);
  assert.deepEqual(
    [...advanced.matchAll(/data-category-key-id="([^"]+)"/g)].map((match)=>match[1]),
    IDS
  );
  assert.equal(renderAdvancedPresentationControls({...timeline(),mode:"guided"}),"");
});

test("D1-411A separates overlapping canonical exam events before reporting saturation",()=>{
  const visual={
    schemaVersion:"d1-411a/timeline-visual-document/1",
    timelineId:"overlap",revision:1,title:"Overlap",
    categories:[
      {id:"education",mapsTo:"work"},{id:"exams",mapsTo:"usmle"},
      {id:"clinical",mapsTo:"usce"},{id:"work",mapsTo:"work"},
      {id:"research",mapsTo:"res"},{id:"personal",mapsTo:"personal"}
    ],
    events:[
      {id:"step-1",title:"Step 1",categoryId:"exams",startDate:"2026-01",endDate:"2026-08"},
      {id:"step-2",title:"Step 2 CK",categoryId:"exams",startDate:"2026-04",endDate:"2026-10"}
    ]
  };
  const projected=toRenderModel(visual);
  const lanes=projected.model.events.map(({lane})=>lane);
  assert.deepEqual(lanes,[1,2]);
  assert.ok(projected.warnings.includes("EVENT_LANE_OVERFLOW:step-2:2"));
  assert.ok(!projected.warnings.some((warning)=>warning.startsWith("EVENT_LANE_SATURATED:")));
  assert.deepEqual(projected.model.events.map(({cat})=>cat),["usmle","usmle"]);
});
