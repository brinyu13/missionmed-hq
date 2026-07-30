import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  AUTOMATIC_VERSION_TYPES,
  CANVAS_TOOLBAR_ORDER,
  createCanvasState,
  renderCanvas
} from "../web/js/uxr-002/canvas.js";
import {AUTOSAVE_DELAY,HISTORY_LIMIT} from "../web/js/uxr-002/constants.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";

const webRoot=new URL("../web/",import.meta.url);
const index=await readFile(new URL("index.html",webRoot),"utf8");
const adapter=await readFile(new URL("js/407f-engineering-adapter.js",webRoot),"utf8");
const canvasModule=await readFile(new URL("js/uxr-002/canvas.js",webRoot),"utf8");
const css=await readFile(new URL("styles/407f-upgrade.css",webRoot),"utf8");

function sourceBetween(source,start,end){
  const from=source.indexOf(start);
  const to=source.indexOf(end,from+start.length);
  assert.ok(from>=0,`missing source marker: ${start}`);
  assert.ok(to>from,`missing source marker: ${end}`);
  return source.slice(from,to);
}

test("M7 replaces only the retired Canvas panels with the production Canvas host",()=>{
  const canvas=sourceBetween(
    index,
    '<section data-view="canvas">',
    "<!-- ================= INTAKE"
  );
  assert.match(canvas,/id="canvas407F"/);
  assert.doesNotMatch(canvas,/canvasGrid|boardMain|inspector|elemList|evList|histList/);
  assert.equal((canvas.match(/<section data-view="canvas">/g)||[]).length,1);
});

test("M7 installs the retained Canvas controller against the shared TimelineStore",()=>{
  assert.match(adapter,/import \{\s*createCanvasState,\s*installCanvas\s*\} from "\.\/uxr-002\/canvas\.js"/);
  assert.match(adapter,/canvasController=installCanvas\(canvasHost,store,\{/);
  assert.match(adapter,/api\.canvas=canvasController/);
  assert.match(adapter,/applyDocumentTo407FState\(store\.document,bridge\.state\)/);
  assert.match(adapter,/canvasController\?\.destroy\(\)/);
});

test("M7 active markup keeps the frozen toolbar and removes permanent Canvas UI",()=>{
  const document=defaultDocument();
  document.events=[{
    id:"work-1",
    title:"Clinical work",
    categoryId:"work",
    eventType:"duration",
    startDate:"2022-01",
    endDate:"2025-06",
    openEnded:false,
    visibilityState:"INTERVIEWER_SAFE",
    fields:{builderDomain:"work",builderEntryId:"work-1"}
  }];
  document.advisor.comments=[{id:"comment-1",resolvedAt:null}];
  const html=renderCanvas({
    document,
    state:createCanvasState(),
    historyStatus:{canUndo:true,canRedo:false}
  });
  const items=[...html.matchAll(/data-toolbar-item="([^"]+)"/g)].map((match)=>match[1]);
  assert.deepEqual(items,CANVAS_TOOLBAR_ORDER);
  assert.match(html,/data-canvas-toolbar data-height="48"/);
  assert.doesNotMatch(html,/Inspector|Event list|Draft history|JSON import|JSON export/);
});

test("M7 retains month-snapped direct manipulation, 50-step undo, autosave, and all automatic versions",()=>{
  assert.equal(HISTORY_LIMIT,50);
  assert.equal(AUTOSAVE_DELAY,800);
  assert.deepEqual(
    AUTOMATIC_VERSION_TYPES.map(({id})=>id),
    ["export","advisor-request","start-over","before-intake"]
  );
  assert.match(adapter,/onDropReflow:syncCanvasDocument/);
  assert.match(adapter,/onDateControl:\(\{edge,event\}\)=>/);
  assert.match(adapter,/reflectStoreStatus/);
});

test("M7 renders the 407F toolbar, contextual controls, Details sheet, and History slide-over without a white shell",()=>{
  assert.match(css,/section\[data-view="canvas"\][\s\S]*padding:0/);
  assert.match(css,/\.canvas407FHost \.canvas-toolbar[\s\S]*background:linear-gradient/);
  assert.match(css,/\.canvas407FHost \.canvas-context-toolbar/);
  assert.match(css,/\.canvas407FHost \.canvas-details-sheet/);
  assert.match(css,/\.canvas407FHost \.history-slide-over/);
  assert.match(css,/\.canvas407FHost \.canvas-stage[\s\S]*background:#efede8/);
  assert.doesNotMatch(css,/\.canvas407FHost \.canvas-toolbar[\s\S]{0,500}background:#fff/);
  assert.match(canvasModule,/style="width:560px"/);
  assert.match(adapter,/data-canvas-details-save/);
  assert.match(adapter,/data-canvas-builder-step/);
});
