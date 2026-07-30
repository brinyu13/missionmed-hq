import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  allocateAdaptiveYearWidths,
  condensedMetrics,
  deriveTimelineSpan,
  eventDensityForYear,
  shouldRecomputeLayout,
  tickModeForYear
} from "../web/js/uxr-002/adaptive-layout.js";
import {buildKeynoteClassicScene} from "../web/js/uxr-002/board-renderer.js";

const webRoot=new URL("../web/",import.meta.url);
const index=await readFile(new URL("index.html",webRoot),"utf8");
const adapter=await readFile(new URL("js/407f-engineering-adapter.js",webRoot),"utf8");
const css=await readFile(new URL("styles/407f-upgrade.css",webRoot),"utf8");

function duration(id,startDate,endDate,categoryId="work"){
  return{
    id,
    title:id,
    categoryId,
    eventType:"duration",
    startDate,
    endDate,
    openEnded:false,
    visibilityState:"INTERVIEWER_SAFE"
  };
}

test("M8 active 407F Canvas delegates rendering to the retained adaptive board engine",()=>{
  assert.match(adapter,/canvasController=installCanvas\(canvasHost,store,\{/);
  assert.match(
    adapter.slice(adapter.indexOf("canvasController=installCanvas"),adapter.indexOf("api.canvas=canvasController")),
    /renderBoard:render407FThemedBoard/
  );
  assert.match(
    adapter,
    /function render407FThemedBoard\(document,options=\{\}\)\{\s*const base=renderKeynoteClassicBoard\(document,options\)/
  );
  assert.match(index,/<div id="canvas407F" class="canvas407FHost"/);
});

test("M8 dense years receive more width while all integer widths sum exactly to 1728",()=>{
  const events=[
    duration("foundation","2022-01","2022-01"),
    duration("busy-a","2024-01","2024-12"),
    duration("busy-b","2024-02","2024-11","clinical"),
    duration("busy-c","2024-03","2025-03","research")
  ];
  const span=deriveTimelineSpan(events,{currentMonth:"2027-07"});
  const weighted=span.segments.map((segment)=>({
    ...segment,
    density:eventDensityForYear(events,segment.year,{spanEndMonth:span.endMonth})
  }));
  const allocated=allocateAdaptiveYearWidths(weighted,{innerWidth:1728});
  const byYear=Object.fromEntries(allocated.map((segment)=>[segment.year,segment.width]));
  assert.equal(allocated.reduce((sum,segment)=>sum+segment.width,0),1728);
  assert.ok(byYear[2024]>byYear[2023]);
  assert.ok(byYear[2024]>byYear[2027]);
});

test("M8 tick density and condensed row mode are automatic with no manual Canvas toggle",()=>{
  assert.equal(tickModeForYear(83),"quarters");
  assert.equal(tickModeForYear(84),"months");
  assert.deepEqual(condensedMetrics(6),{condensed:false});
  assert.deepEqual(condensedMetrics(7),{
    condensed:true,
    laneHeight:28,
    arrowShaftHeight:22,
    labelFontSize:11
  });
  const canvas=index.slice(
    index.indexOf('<section data-view="canvas">'),
    index.indexOf("<!-- ================= INTAKE")
  );
  assert.doesNotMatch(canvas,/ctlCondensed|CONDENSED|CROWDED/);
});

test("M8 seven overlapping events render condensed without changing the shared data",()=>{
  const events=Array.from({length:7},(_,index)=>
    duration(`overlap-${index+1}`,"2022-01","2025-12",index%2?"clinical":"work")
  );
  const timeline={
    studentProfile:{fullName:"Dr. Adaptive"},
    events
  };
  const before=structuredClone(timeline);
  const scene=buildKeynoteClassicScene(timeline,{currentMonth:"2027-07"});
  assert.equal(scene.laneLayout.laneCount,7);
  assert.equal(scene.laneLayout.condensed,true);
  assert.ok(scene.arrows.every((arrow)=>arrow.shaftHeight===22));
  assert.deepEqual(timeline,before);
});

test("M8 reflows only on frozen triggers/drop and 407F honors 240ms plus reduced motion",()=>{
  for(const kind of [
    "event-add","event-delete","event-date-change","span-change",
    "intake-batch","version-restore","drag-drop"
  ]){
    assert.equal(shouldRecomputeLayout({kind}),true,kind);
    assert.equal(shouldRecomputeLayout({kind,dragActive:true}),false,`${kind} while dragging`);
  }
  assert.equal(shouldRecomputeLayout({kind:"drag-preview"}),false);
  assert.match(css,/animation:canvas407F-layout-settle 240ms ease-in-out/);
  assert.match(css,/view-transition-name:timeline-board/);
  assert.match(css,/animation-duration:240ms/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)[\s\S]*animation:none/);
});
