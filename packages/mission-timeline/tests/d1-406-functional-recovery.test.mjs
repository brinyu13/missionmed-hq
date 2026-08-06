import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

import {
  buildKeynoteClassicScene,
  serializeKeynoteClassicSvg
} from "../web/js/uxr-002/board-renderer.js";
import {
  locked407FComposition,
  locked407FExplanationConnection
} from "../web/js/uxr-002/locked-407f-artifact.js";
import {serializeLocked407FPortableSvg} from "../web/js/uxr-002/locked-407f-export.js";
import {applyThemeToScene} from "../web/js/uxr-002/themes.js";
import {
  beginCanvasDrag,
  commitCanvasDrag,
  updateCanvasDrag
} from "../web/js/uxr-002/canvas.js";

const ranged=(id,index)=>({
  id,
  title:`Event ${index+1}`,
  categoryId:["education","exams","clinical","work","research","personal"][index%6],
  eventType:"duration",
  startDate:`${2010+index}-01`,
  endDate:`${2010+index}-10`,
  visibilityState:"INTERVIEWER_SAFE"
});

function timeline(count=3){
  return{
    studentProfile:{fullName:"D1-406 Student"},
    events:Array.from({length:count},(_,index)=>ranged(`event-${index+1}`,index))
  };
}

function scene(count=3){
  return buildKeynoteClassicScene(timeline(count),{currentMonth:"2026-07"});
}

test("D1-406 composes sparse, medium, and dense boards intentionally without changing 407F arrow size",()=>{
  const sparse=scene(3),medium=scene(7),dense=scene(12);
  assert.equal(sparse.laneLayout.composition.density,"sparse");
  assert.equal(medium.laneLayout.composition.density,"medium");
  assert.equal(dense.laneLayout.composition.density,"dense");
  assert.ok(sparse.laneLayout.composition.lanePitch>medium.laneLayout.composition.lanePitch);
  assert.ok(medium.laneLayout.composition.lanePitch>dense.laneLayout.composition.lanePitch);
  for(const rendered of [sparse,medium,dense]){
    assert.ok(rendered.arrows.every((arrow)=>arrow.shaftHeight===30));
    assert.ok(rendered.arrows.every((arrow)=>arrow.headHeight===30));
    assert.ok(rendered.arrows.at(-1).centerY<780);
    const composition=locked407FComposition(rendered);
    assert.equal(composition.density,rendered.laneLayout.composition.density);
  }
});

test("D1-406 serializes explanation geometry and a connected target leader",()=>{
  const document=timeline(3);
  document.events.push({
    id:"explanation",
    title:"Context",
    categoryId:"personal",
    eventType:"annotation",
    startDate:"2011-01",
    endDate:"2011-01",
    visibilityState:"INTERVIEWER_SAFE",
    fields:{
      builderDomain:"explanation",
      explanationText:"A concise explanation.",
      x:1310,
      y:540,
      width:260,
      height:150,
      leaderEnabled:true,
      target:{kind:"event",eventId:"event-2"}
    }
  });
  const rendered=buildKeynoteClassicScene(document,{currentMonth:"2026-07"});
  const svg=serializeKeynoteClassicSvg(rendered);
  const explanation=rendered.explanations[0];
  const connection=locked407FExplanationConnection(rendered,explanation);
  const box=connection.targetBox;
  const tolerance=.000001;
  assert.match(svg,/data-event-id="explanation"[^>]*style="left:1310px;top:540px;width:260px;height:150px"/);
  assert.match(svg,/data-explanation-leader="true"[^>]*data-target-event-id="event-2"/);
  assert.ok(
    svg.indexOf('data-explanation-leader="true"')<
      svg.indexOf('class="locked407F-sticky"'),
    "the board-space leader must be a sibling before the rotated sticky note"
  );
  assert.doesNotMatch(
    svg,
    /class="locked407F-sticky"[^>]*>[^<]*<span data-explanation-leader=/,
    "the leader must not inherit the sticky-note rotation"
  );
  assert.ok(connection.bodyLength>0);
  assert.ok(connection.target.x>=box.x-tolerance&&connection.target.x<=box.x+box.width+tolerance);
  assert.ok(connection.target.y>=box.y-tolerance&&connection.target.y<=box.y+box.height+tolerance);
  assert.ok(
    Math.abs(connection.target.x-box.x)<tolerance||
    Math.abs(connection.target.x-(box.x+box.width))<tolerance||
    Math.abs(connection.target.y-box.y)<tolerance||
    Math.abs(connection.target.y-(box.y+box.height))<tolerance,
    "leader endpoint must lie on the rendered target boundary"
  );
  const portable=serializeLocked407FPortableSvg(rendered);
  assert.match(portable,/data-explanation-leader="true"[^>]*data-target-event-id="event-2"[^>]*marker-end="url\(#d1406-red-arrowhead\)"/);
});

test("D1-406 keeps one geometry while making non-default theme presentation visibly distinct",()=>{
  const source=scene(6);
  const keynote=serializeKeynoteClassicSvg(source);
  const navy=serializeKeynoteClassicSvg(applyThemeToScene(source,"mission-navy"));
  const paper=serializeKeynoteClassicSvg(applyThemeToScene(source,"advisor-paper"));
  assert.notEqual(navy,keynote);
  assert.notEqual(paper,keynote);
  assert.match(navy,/--themeBoard:radial-gradient/);
  assert.match(paper,/--themeBoard:#FAF6EC/);
  assert.deepEqual(
    applyThemeToScene(source,"mission-navy").arrows.map(({x,x2,centerY})=>[x,x2,centerY]),
    source.arrows.map(({x,x2,centerY})=>[x,x2,centerY])
  );
});

test("D1-406 preserves the fixed six-row canonical color key and omits unfinished profile placeholders",()=>{
  const svg=serializeKeynoteClassicSvg(scene(1));
  const labels=[
    "Work Experience",
    "Personal / Not on CV",
    "USMLE Studies",
    "USCE: Teaching Hospital",
    "USCE: Clinics",
    "Research Experience"
  ];
  for(const label of labels){
    assert.match(svg,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  }
  const positions=labels.map((label)=>svg.indexOf(label));
  assert.deepEqual(positions,[...positions].sort((left,right)=>left-right));
  assert.doesNotMatch(svg,/Not set|Profile not set/);
});

test("D1-406 Canvas moves and resizes explanations as one undoable geometry mutation",()=>{
  const explanation={
    id:"explanation",
    title:"Context",
    categoryId:"personal",
    eventType:"annotation",
    startDate:"2020-01",
    endDate:"2020-01",
    visibilityState:"INTERVIEWER_SAFE",
    fields:{
      builderDomain:"explanation",
      x:1000,
      y:500,
      width:300,
      height:190
    }
  };
  const document={events:[structuredClone(explanation)]};
  const labels=[];
  const store={
    document,
    mutate(label,operation){
      labels.push(label);
      operation(this.document);
      return true;
    }
  };
  const move=updateCanvasDrag(
    beginCanvasDrag(document,"explanation",{kind:"free-move"}),
    {pixelDeltaX:80,pixelDeltaY:-40}
  );
  assert.equal(move.preview.fields.x,1080);
  assert.equal(move.preview.fields.y,460);
  commitCanvasDrag(store,move);
  assert.deepEqual(labels,["Move explanation"]);
  assert.equal(document.events[0].fields.x,1080);
  const resize=updateCanvasDrag(
    beginCanvasDrag(document,"explanation",{kind:"free-resize"}),
    {pixelDeltaX:70,pixelDeltaY:30}
  );
  commitCanvasDrag(store,resize);
  assert.equal(document.events[0].fields.width,370);
  assert.equal(document.events[0].fields.height,220);
  assert.deepEqual(labels,["Move explanation","Resize explanation"]);
});

test("D1-406 export projection remains raster-safe while retaining locked 407F assets and geometry",()=>{
  const rendered=scene(6);
  const svg=serializeLocked407FPortableSvg(rendered);
  assert.doesNotMatch(svg,/<foreignObject/);
  assert.match(svg,/data-export-projection="native-svg"/);
  assert.match(svg,/data-locked-407f-source-sha256=/);
  assert.match(svg,/data-axis-language="407f-powerpoint"/);
  assert.match(svg,/data-event-kind="arrow"/);
  assert.match(svg,/height="30"/);
  assert.match(svg,/data-artifact-chrome="color-key"/);
  assert.match(svg,/data-artifact-chrome="profile"/);
  assert.match(svg,/data-artifact-chrome="photo-frames"/);
  assert.match(svg,/data-interview-destination="407f-ribbon"/);
});

test("D1-406 recovery wiring preserves 407F visuals while closing keyboard and target-size gaps",()=>{
  const adapter=readFileSync(new URL(
    "../web/js/407f-engineering-adapter.js",
    import.meta.url
  ),"utf8");
  const advancedBoard=readFileSync(new URL(
    "../web/js/uxr-002/advanced-board.js",
    import.meta.url
  ),"utf8");
  const canvas=readFileSync(new URL(
    "../web/js/uxr-002/canvas.js",
    import.meta.url
  ),"utf8");
  const html=readFileSync(new URL("../web/index.html",import.meta.url),"utf8");
  const css=readFileSync(new URL(
    "../web/styles/407f-upgrade.css",
    import.meta.url
  ),"utf8");

  assert.match(adapter,/data-toolbar-item="media"/);
  assert.match(adapter,/mode\.insertAdjacentHTML\("afterend",markup\)/);
  assert.match(
    adapter,
    /const text=action==="symbol"[\s\S]*?:"Add your text";/
  );
  assert.match(adapter,/onAdvancedObjectKeyDown=\(event\)=>/);
  assert.match(adapter,/canvasController\?\.setUiState\(\{liveAnnouncement:message\}\)/);
  assert.match(advancedBoard,/data-advanced-media=.*role="button" tabindex="0"/s);
  assert.match(advancedBoard,/data-advanced-text=.*role="button" tabindex="0"/s);
  assert.match(canvas,/live\.textContent="";\s*queueMicrotask/s);
  assert.match(html,/function syncNavigationCurrent\(v\)/);
  assert.match(html,/control\.setAttribute\('aria-current','page'\)/);
  assert.match(css,/\.media407FCanvasLauncher\{[^}]*flex:none;[^}]*min-height:44px;[^}]*position:static;/s);
  assert.match(css,/\.guided-arrow-handles button\{[^}]*height:44px;[^}]*width:44px;/s);
  assert.match(css,/\.guided-explanation-handles button\{[^}]*height:44px;[^}]*width:44px;/s);
});
