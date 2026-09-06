import assert from "node:assert/strict";
import test from "node:test";

const moduleUrl=new URL("../web/js/uxr-002/adaptive-layout.js",import.meta.url);
let adaptiveLayout=null;
let moduleLoadError=null;

try{
  adaptiveLayout=await import(moduleUrl);
}catch(error){
  moduleLoadError=error;
}

const REQUIRED_EXPORTS=[
  "CATEGORY_DEFINITIONS",
  "deriveTimelineSpan",
  "eventDensityForYear",
  "allocateAdaptiveYearWidths",
  "monthPositionInSegments",
  "tickModeForYear",
  "assignStableLanes",
  "placeAlternatingFlags",
  "condensedMetrics",
  "shouldRecomputeLayout"
];

/*
Pure M3 contract used by this suite:

- CATEGORY_DEFINITIONS:
  [{id,label,token,color}, ...] in frozen UI order.
- deriveTimelineSpan(events,{currentMonth,interviewMonth}):
  {startMonth,endMonth,segments}. A normal segment has
  {kind:"year",year,startMonth,endMonth}; a compressed leading segment has
  {kind:"condensed",startYear,endYear,startMonth,endMonth,width,label,tooltip}.
- eventDensityForYear(events,year,{spanEndMonth}) returns the §7.3 density.
- allocateAdaptiveYearWidths(segments,{innerWidth}) returns cloned/enriched
  segments with integer `width` values whose exact sum is innerWidth.
- monthPositionInSegments(month,segments,{margin}) returns logical x.
- tickModeForYear(width) returns "months" or "quarters".
- assignStableLanes(events,{previousLaneById}) returns
  {order,laneById,laneCount}; milestone lane values are null.
- placeAlternatingFlags(flags) returns [{id,height}, ...].
- condensedMetrics(laneCount) returns the automatic density-mode metrics.
- shouldRecomputeLayout({kind,dragActive}) classifies §7.3 triggers.

Known unresolved boundary deliberately excluded:
For N=1, N=2, or N=3 normal year segments, max(y)=innerWidth*0.28
cannot coexist with sum(widths)=innerWidth. This file contains no N<4
allocation vector and encodes no waiver, cap change, or error behavior.
*/

test("M3 adaptive-layout module resolves with the required pure contract",()=>{
  if(moduleLoadError)throw moduleLoadError;
  for(const name of REQUIRED_EXPORTS){
    assert.ok(name in adaptiveLayout,`Missing adaptive-layout export: ${name}`);
  }
  for(const name of REQUIRED_EXPORTS.filter((name)=>name!=="CATEGORY_DEFINITIONS")){
    assert.equal(typeof adaptiveLayout[name],"function",`${name} must be a function`);
  }
});

function contract(name,operation){
  test(name,{skip:moduleLoadError?"adaptive-layout.js is not implemented yet":false},()=>operation(adaptiveLayout));
}

function approximate(actual,expected,epsilon=1e-9){
  assert.ok(Math.abs(actual-expected)<=epsilon,`Expected ${expected}, received ${actual}`);
}

function yearSegments(start,end,densities=[]){
  return Array.from({length:end-start+1},(_,index)=>({
    kind:"year",
    year:start+index,
    startMonth:`${start+index}-01`,
    endMonth:`${start+index}-12`,
    density:densities[index]??0
  }));
}

contract("§2.4 exposes the six frozen category names, order, tokens, and colors",({CATEGORY_DEFINITIONS})=>{
  assert.deepEqual(CATEGORY_DEFINITIONS,[
    {id:"education",label:"Education",token:"cat.education",color:"#2C6E8F"},
    {id:"exams",label:"Exams",token:"cat.exams",color:"#3A78C9"},
    {id:"clinical",label:"US Clinical",token:"cat.clinical",color:"#C8641C"},
    {id:"work",label:"Work",token:"cat.work",color:"#3F9B52"},
    {id:"research",label:"Research",token:"cat.research",color:"#C9A227"},
    {id:"personal",label:"Personal",token:"cat.personal",color:"#8A5BBF"}
  ]);
});

contract("§7.2 span starts in the earliest event year and ends at the latest current, interview, or event year",({deriveTimelineSpan})=>{
  const baseEvents=[
    {id:"school",eventType:"milestone",startDate:"2021-06"},
    {id:"rotation",eventType:"duration",startDate:"2024-02",endDate:"2025-03"},
    {id:"open-work",eventType:"duration",startDate:"2025-04",endDate:null,openEnded:true}
  ];
  const interviewWins=deriveTimelineSpan(baseEvents,{currentMonth:"2026-07",interviewMonth:"2027-09"});
  assert.equal(interviewWins.startMonth,"2021-01");
  assert.equal(interviewWins.endMonth,"2027-12");

  const eventWins=deriveTimelineSpan([
    ...baseEvents,
    {id:"future-research",eventType:"duration",startDate:"2027-01",endDate:"2028-04"}
  ],{currentMonth:"2026-07",interviewMonth:"2027-09"});
  assert.equal(eventWins.endMonth,"2028-12");

  const currentWins=deriveTimelineSpan(baseEvents,{currentMonth:"2026-07",interviewMonth:"2024-09"});
  assert.equal(currentWins.endMonth,"2026-12");
  assert.deepEqual(
    currentWins.segments.map((segment)=>segment.year),
    [2021,2022,2023,2024,2025,2026]
  );
});

contract("§7.2 compresses spans beyond 12 years into one fixed 64px leading segment",({deriveTimelineSpan,allocateAdaptiveYearWidths,monthPositionInSegments})=>{
  const span=deriveTimelineSpan([
    {id:"early",eventType:"milestone",startDate:"2008-04"},
    {id:"recent",eventType:"duration",startDate:"2025-01",endDate:"2026-05"}
  ],{currentMonth:"2026-07",interviewMonth:null});

  assert.equal(span.startMonth,"2008-01");
  assert.equal(span.endMonth,"2026-12");
  assert.equal(span.segments.length,12);
  assert.deepEqual(span.segments.slice(1).map((segment)=>segment.year),[
    2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026
  ]);

  const condensed=span.segments[0];
  assert.deepEqual(condensed,{
    kind:"condensed",
    startYear:2008,
    endYear:2015,
    startMonth:"2008-01",
    endMonth:"2015-12",
    width:64,
    label:"…2008",
    tooltip:"Condensed early years"
  });

  const laidOut=allocateAdaptiveYearWidths(
    span.segments.map((segment)=>({...segment,density:0})),
    {innerWidth:1728}
  );
  assert.equal(laidOut[0].width,64);
  assert.equal(laidOut.reduce((sum,segment)=>sum+segment.width,0),1728);

  const earlyX=monthPositionInSegments("2008-04",laidOut,{margin:96});
  const lateEarlyX=monthPositionInSegments("2015-10",laidOut,{margin:96});
  assert.ok(earlyX>=96&&earlyX<=160);
  assert.ok(lateEarlyX>=96&&lateEarlyX<=160);
  assert.ok(lateEarlyX>earlyX,"early years must remain proportional inside the condensed segment");
});

contract("§7.3 density counts inclusive overlap months, milestones as one month, and open ends through span end",({eventDensityForYear})=>{
  const density=eventDensityForYear([
    {id:"full",eventType:"duration",startDate:"2024-01",endDate:"2024-12"},
    {id:"cross",eventType:"duration",startDate:"2023-11",endDate:"2024-02"},
    {id:"flag",eventType:"milestone",startDate:"2024-06"},
    {id:"open",eventType:"duration",startDate:"2024-11",endDate:null,openEnded:true}
  ],2024,{spanEndMonth:"2025-12"});
  approximate(density,17/12);
  assert.equal(eventDensityForYear([],2024,{spanEndMonth:"2025-12"}),0);
});

contract("§7.3 allocates exact proportional widths for an unclamped N>=4 vector and sums exactly",({allocateAdaptiveYearWidths})=>{
  const segments=yearSegments(2021,2026,[0,0,1,1,0,0]);
  const first=allocateAdaptiveYearWidths(segments,{innerWidth:1728});
  const second=allocateAdaptiveYearWidths(segments,{innerWidth:1728});
  assert.deepEqual(first.map((segment)=>segment.width),[216,216,432,432,216,216]);
  assert.equal(first.reduce((sum,segment)=>sum+segment.width,0),1728);
  assert.deepEqual(second,first,"allocation must be deterministic");
});

contract("§7.3 clamp redistribution remains deterministic and exact for N>=4",({allocateAdaptiveYearWidths})=>{
  const innerWidth=1728;
  const segments=yearSegments(2019,2026,[0,0,0,0,0,0,0,20]);
  const layout=allocateAdaptiveYearWidths(segments,{innerWidth});
  assert.equal(layout.length,8);
  assert.equal(layout.reduce((sum,segment)=>sum+segment.width,0),innerWidth);
  const minWidth=Math.max(88,innerWidth*.05);
  const maxWidth=innerWidth*.28;
  for(const segment of layout){
    assert.ok(segment.width>=Math.floor(minWidth),`${segment.year} fell below the frozen minimum`);
    assert.ok(segment.width<=Math.ceil(maxWidth),`${segment.year} exceeded the rounded frozen maximum`);
  }
  assert.equal(layout.at(-1).width,Math.round(maxWidth));
  assert.deepEqual(
    allocateAdaptiveYearWidths(segments,{innerWidth}),
    layout,
    "three clamp passes and remainder distribution must be repeatable"
  );
});

contract("§7.3 positions months linearly inside each adaptive year segment",({monthPositionInSegments})=>{
  const segments=[
    {kind:"year",year:2024,startMonth:"2024-01",endMonth:"2024-12",width:240},
    {kind:"year",year:2025,startMonth:"2025-01",endMonth:"2025-12",width:360}
  ];
  approximate(monthPositionInSegments("2024-01",segments,{margin:96}),96);
  approximate(monthPositionInSegments("2024-07",segments,{margin:96}),216);
  approximate(monthPositionInSegments("2024-12",segments,{margin:96}),316);
  approximate(monthPositionInSegments("2025-01",segments,{margin:96}),336);
  approximate(monthPositionInSegments("2025-07",segments,{margin:96}),516);
});

contract("§7.4 hides minor ticks only when month pitch is below 7px",({tickModeForYear})=>{
  assert.equal(tickModeForYear(83),"quarters");
  assert.equal(tickModeForYear(84),"months");
  assert.equal(tickModeForYear(240),"months");
});

contract("§7.5 sorts arrows before flags, then by start, then longer first",({assignStableLanes})=>{
  const result=assignStableLanes([
    {id:"flag",categoryId:"personal",eventType:"milestone",startDate:"2023-01"},
    {id:"short",categoryId:"work",eventType:"duration",startDate:"2024-01",endDate:"2024-02"},
    {id:"later",categoryId:"research",eventType:"duration",startDate:"2024-03",endDate:"2024-06"},
    {id:"long",categoryId:"education",eventType:"duration",startDate:"2024-01",endDate:"2024-12"}
  ]);
  assert.deepEqual(result.order,["long","short","later","flag"]);
  assert.equal(result.laneById.flag,null);
});

contract("§7.5 greedy placement requires one clear month and chooses the highest legal lane",({assignStableLanes})=>{
  const result=assignStableLanes([
    {id:"a",categoryId:"education",eventType:"duration",startDate:"2024-01",endDate:"2024-03"},
    {id:"b",categoryId:"work",eventType:"duration",startDate:"2024-04",endDate:"2024-06"},
    {id:"c",categoryId:"personal",eventType:"duration",startDate:"2024-08",endDate:"2024-09"}
  ]);
  assert.deepEqual(result.laneById,{a:0,b:1,c:0});
  assert.equal(result.laneCount,2);
});

contract("§7.5 category affinity wins when multiple lanes are legal",({assignStableLanes})=>{
  const result=assignStableLanes([
    {id:"education",categoryId:"education",eventType:"duration",startDate:"2024-01",endDate:"2024-02"},
    {id:"work-a",categoryId:"work",eventType:"duration",startDate:"2024-01",endDate:"2024-02"},
    {id:"work-b",categoryId:"work",eventType:"duration",startDate:"2024-05",endDate:"2024-06"}
  ]);
  assert.equal(result.laneById.education,0);
  assert.equal(result.laneById["work-a"],1);
  assert.equal(result.laneById["work-b"],1);
});

contract("§7.5 preserves legal prior lanes and moves the minimal new conflict set",({assignStableLanes})=>{
  const stable=assignStableLanes([
    {id:"education",categoryId:"education",eventType:"duration",startDate:"2024-01",endDate:"2024-02"},
    {id:"work",categoryId:"work",eventType:"duration",startDate:"2024-05",endDate:"2024-06"}
  ],{previousLaneById:{education:2,work:0}});
  assert.equal(stable.laneById.education,2);
  assert.equal(stable.laneById.work,0);

  const conflict=assignStableLanes([
    {id:"education",categoryId:"education",eventType:"duration",startDate:"2024-01",endDate:"2024-04"},
    {id:"work",categoryId:"work",eventType:"duration",startDate:"2024-01",endDate:"2024-04"},
    {id:"new",categoryId:"clinical",eventType:"duration",startDate:"2024-01",endDate:"2024-04"}
  ],{previousLaneById:{education:2,work:0}});
  assert.equal(conflict.laneById.education,2);
  assert.equal(conflict.laneById.work,0);
  assert.equal(conflict.laneById.new,1);
  assert.equal(conflict.laneCount,3);
});

contract("§7.5 alternates 34px and 52px heights for flags less than one month apart",({placeAlternatingFlags})=>{
  assert.deepEqual(placeAlternatingFlags([
    {id:"one",startDate:"2024-06"},
    {id:"two",startDate:"2024-06"},
    {id:"three",startDate:"2024-06"},
    {id:"next-month",startDate:"2024-07"}
  ]),[
    {id:"one",height:34},
    {id:"two",height:52},
    {id:"three",height:34},
    {id:"next-month",height:34}
  ]);
});

contract("§7.4 enters condensed row mode automatically only above six required lanes",({condensedMetrics})=>{
  assert.equal(condensedMetrics(6).condensed,false);
  assert.deepEqual(condensedMetrics(7),{
    condensed:true,
    laneHeight:28,
    arrowShaftHeight:22,
    labelFontSize:11
  });
  assert.equal(condensedMetrics(12).condensed,true);
});

contract("§7.3 and §5.6 classify recompute triggers and suppress every active-drag reflow",({shouldRecomputeLayout})=>{
  const recompute=[
    "event-add",
    "event-delete",
    "event-date-change",
    "span-change",
    "intake-batch",
    "version-restore",
    "drag-drop"
  ];
  const noRecompute=[
    "event-title-change",
    "selection-change",
    "theme-change",
    "mode-change",
    "drag-move"
  ];
  for(const kind of recompute){
    assert.equal(shouldRecomputeLayout({kind,dragActive:false}),true,`${kind} must recompute`);
    assert.equal(shouldRecomputeLayout({kind,dragActive:true}),false,`${kind} must wait while dragging`);
  }
  for(const kind of noRecompute){
    assert.equal(shouldRecomputeLayout({kind,dragActive:false}),false,`${kind} must not recompute`);
  }
});
