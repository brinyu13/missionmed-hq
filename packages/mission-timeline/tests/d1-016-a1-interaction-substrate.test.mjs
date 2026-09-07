/* D1-TIMELINE-CANVA-UX-FORENSIC-016 — Phase A1 interaction substrate.
   Covers the four substrate defects reproduced in a real browser:
   the events-only canvas gate, missing selection suppression, selection never taking
   keyboard focus, and selection overlays outliving the objects they point at. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {createCanvasState,renderCanvas} from "../web/js/uxr-002/canvas.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";

const webRoot=new URL("../web/",import.meta.url);
const adapter=await readFile(new URL("js/407f-engineering-adapter.js",webRoot),"utf8");
const canvasModule=await readFile(new URL("js/uxr-002/canvas.js",webRoot),"utf8");
const css=await readFile(new URL("styles/407f-upgrade.css",webRoot),"utf8");

const advancedElement=(id,overrides={})=>({
  id,type:"element",kind:"rectangle",x:860,y:480,width:200,height:104,
  fill:"#2C6E8F",stroke:"#17324A",label:"",countryCode:"US",
  aspectLocked:true,locked:false,layerIndex:0,zIndex:0,
  resizeHandles:8,contextActions:["bring-forward","send-backward","duplicate","delete"],
  ...overrides
});
const semanticEvent=(id)=>({
  id,title:"Untitled education event",categoryId:"education",eventType:"milestone",
  startDate:"2026-08",endDate:null,openEnded:false,visibilityState:"INTERVIEWER_SAFE",
  siteName:"",notes:"",lane:null,sourceType:"canvas-guided",provenance:[],fields:{}
});
const boardFor=({events=[],elements=[],media=[],textBlocks=[]}={})=>{
  const document=defaultDocument();
  document.mode="advanced";
  document.events=events;
  document.advanced={...document.advanced,elements,media,textBlocks};
  return renderCanvas({document,state:createCanvasState(),historyStatus:{}});
};

/* The reproduced defect: canvas.js gated the entire .canvas-application on
   (document?.events || []).length, so Advanced Studio objects entered the model and
   rendered nowhere — and with no .canvas-application there are no hit proxies, so a
   drag fell through to the document and selected board text. */
test("A1.1 the canvas stays mounted for every combination of events and scene items",()=>{
  const cases=[
    ["zero events, zero advanced items",{}],
    ["zero events, one advanced item",{elements:[advancedElement("advanced-element-1")]}],
    ["zero events, several advanced items",{elements:[
      advancedElement("advanced-element-1"),
      advancedElement("advanced-element-2",{x:200,y:200})
    ]}],
    ["one event and one advanced item",{
      events:[semanticEvent("event-1")],
      elements:[advancedElement("advanced-element-1")]
    }]
  ];
  for(const [label,shape] of cases){
    const html=boardFor(shape);
    assert.ok(html.includes('class="canvas-application"'),`${label}: canvas must stay mounted`);
    assert.ok(!html.includes("canvas-empty-board"),`${label}: the suppressing empty board must not render`);
    assert.ok(!html.includes("No events yet"),`${label}: the empty-state copy must not replace the board`);
  }
});

test("A1.1 the gate consults scene items, not just the semantic event list",()=>{
  /* The reproduced failure was structural: the gate never looked at advanced.*, so an
     object could exist in the model with nowhere to render. Assert the predicate reads
     the scene collections and that the events-only condition is gone. */
  assert.ok(
    !canvasModule.includes("if ((document?.events || []).length) {"),
    "the events-only canvas gate must be gone"
  );
  assert.ok(canvasModule.includes("advancedSceneItemCount(document?.advanced)"));
  assert.ok(canvasModule.includes("const boardIsRenderable=true;"));
});

/* Unplaced uploads live in the library rather than on the board, so they are not
   scene presence and must not suppress the coach hint. */
test("A1.1 the coach hint appears only while the board has no content of its own",()=>{
  const coached=(shape)=>boardFor(shape).includes("data-canvas-coach");
  assert.ok(coached(),"an empty board should coach");
  assert.ok(!coached({elements:[advancedElement("advanced-element-1")]}),"an element is content");
  assert.ok(!coached({events:[semanticEvent("event-1")]}),"an event is content");
  assert.ok(coached({media:[{id:"media-1",placed:false}]}),"an unplaced upload is not on the board");
  assert.ok(!coached({media:[{id:"media-1",placed:true}]}),"placed media is content");
});

test("A1.1 the coach hint never intercepts pointer input on a live board",()=>{
  assert.match(css,/\.canvas-coach-chip\{[^}]*pointer-events:none/);
});

/* The board is an inline SVG in the top document, so every label is a real text node.
   The identical rule in d1-411a/kernel-host.js guards a different, inactive renderer. */
test("A1.2 the active board suppresses native text selection, and text editing re-enables it",()=>{
  assert.match(css,/\.canvas407FHost \.canvas-stage,\s*\n?\.canvas407FHost \.canvas-application\{[^}]*user-select:none/);
  assert.match(css,/\[contenteditable="true"\][\s\S]{0,400}?user-select:text/);
});

/* Pointer selection calls preventDefault to own the drag, which also suppresses the
   browser's native focus, so focus has to be restored deliberately. */
test("A1.3 selection hands keyboard focus to the object's hit proxy",()=>{
  assert.match(adapter,/focusAdvancedSelectionTarget\(target,groupMembers\)/);
  assert.match(adapter,/canvas-hit-proxy-\$\{focusTarget\.id\}/);
  assert.match(adapter,/requestAnimationFrame\(applyFocus\)/);
});

/* A per-render sequence number cannot survive a re-render; the id has to follow the
   object so the shell's focus restoration can find it again. */
test("A1.3 hit proxies carry a stable id derived from the object they stand in for",()=>{
  assert.match(canvasModule,/proxy\.id=`canvas-hit-proxy-\$\{proxyIdentity\}`/);
});

test("A1.3 a live text editor or form control always keeps focus",()=>{
  assert.match(adapter,/const editableHasFocus=\(\)=>\{[\s\S]*?isContentEditable[\s\S]*?INPUT","TEXTAREA","SELECT"/);
  assert.match(adapter,/onAdvancedSelectionKeyDown=\(event,\{force=false\}=\{\}\)=>\{[\s\S]*?if\(editableHasFocus\(\)\)return;/);
});

test("A1.3 the keyboard map nudges by one unit and by ten with Shift",()=>{
  assert.match(adapter,/const step=event\.shiftKey\?10:1;/);
  assert.match(adapter,/if\(event\.altKey&&\["media","element","text"\]\.includes\(object\.type\)\)/);
});

test("A1.3 Escape, Delete, duplicate and select-all are wired to scene commands",()=>{
  const handler=adapter.slice(adapter.indexOf("onAdvancedSelectionKeyDown=(event,{force=false}={})=>{"));
  assert.match(handler,/key==="Escape"/);
  assert.match(handler,/key==="Delete"\|\|key==="Backspace"/);
  /* AAA-019: the selection engine lower-cases once (`lower`) and dispatches the whole map from it. */
  assert.match(handler,/lower==="d"/);
  assert.match(handler,/lower==="a"/);
  // Cmd+A must select the scene, never the page.
  assert.match(handler,/allAdvancedSelectableMembers\(\)/);
});

/* Multi-selection used to return before drawing anything, so a shift-click changed
   state with no board feedback at all. */
test("A1.4 multi-selection draws member outlines and combined bounds",()=>{
  assert.doesNotMatch(adapter,/if\(!target\|\|target\.type==="multi"\|\|target\.type==="headline"\)return;/);
  assert.match(adapter,/advancedDirectSelectionMember/);
  assert.match(adapter,/advancedDirectSelectionCount/);
  assert.match(adapter,/\$\{members\.length\} selected/);
  assert.match(css,/\.advancedDirectSelectionMember\{/);
});

/* Every mutation that removes or regroups an object must reconcile the overlay, which
   lives on document.body and otherwise survives the re-render pointing at nothing. */
test("A1.5 ungroup, clear-selection and delete all reconcile the selection overlay",()=>{
  // Ungroup previously skipped the refresh exactly when it produced a multi-selection.
  assert.doesNotMatch(adapter,/if\(selection\?\.type!=="multi"\)requestAdvancedDirectSelection\(selection\);/);
  assert.match(adapter,/onClearSelection:\(\)=>\{[\s\S]*?requestAdvancedDirectSelection\(null\);/);
  assert.match(adapter,/requestAdvancedDirectSelection\(result\.selection\|\|null\);/);
  assert.match(adapter,/onSelectObject:\(target(?:,event=null)?\)=>\{\s*\n\s*if\(!target\)\{[\s\S]*?requestAdvancedDirectSelection\(null\);/);
});

/* ---------------------------------------------------------------------------
   Phase A2 — the Canva-class behaviours that were genuinely missing.
   --------------------------------------------------------------------------- */

/* Marquee had zero references in the active seam; the 15 matches in
   d1-411a/kernel-host.js belong to an inactive iframe renderer. */
test("A2.6 an empty-board press rubber-bands instead of falling through",()=>{
  const handler=adapter.slice(adapter.indexOf("onAdvancedPointerDown=(event)=>{"));
  assert.match(handler,/marqueePointer=\{/);
  assert.match(adapter,/advancedMarquee/);
  assert.match(css,/\.advancedMarquee\{/);
  // Intersecting, not strictly contained.
  assert.match(adapter,/box\.left<rect\.right&&box\.right>rect\.left&&/);
  // Shift extends the existing selection rather than replacing it.
  assert.match(adapter,/additive:event\.shiftKey===true/);
  // A press with no drag is a deselect.
  assert.match(adapter,/if\(!pending\.moved&&event\?\.type!=="pointercancel"\)/);
});

test("A2.6 the marquee band never intercepts the gesture underneath it",()=>{
  assert.match(css,/\.advancedMarquee\{[^}]*pointer-events:none/);
});

/* Chrome positioned in document space did not move when the stage panned and painted
   over the asset rail; mounting it in the stage puts it in board space instead. */
test("A2.7 selection chrome is mounted in board space, not document space",()=>{
  assert.match(adapter,/const advancedOverlayHost=\(\)=>canvasHost\?\.querySelector\?\.\("\.canvas-stage"\)/);
  assert.match(adapter,/host\.scrollLeft/);
  assert.match(adapter,/host\.scrollTop/);
  assert.ok(!adapter.includes("document.body.append(overlay)"),"the overlay must not mount on document.body");
  for(const rule of [".advancedDirectSelection{",".advancedDirectSelectionMember{",".advancedMarquee{"]){
    const block=css.slice(css.indexOf(rule),css.indexOf("}",css.indexOf(rule)));
    assert.ok(block.includes("position:absolute"),`${rule} must position in board space`);
    assert.ok(!block.includes("position:fixed"),`${rule} must not position in document space`);
  }
});

/* Committing a gesture on pointerup re-renders the board, replacing the node the browser
   needs for a click; no click or dblclick is dispatched, so detail-based double-click
   detection is unreachable on this surface. */
test("A2.8 double-press is detected from the pointer stream, not from click detail",()=>{
  assert.match(adapter,/const consumeDoublePress=\(event\)=>\{/);
  assert.match(adapter,/now-lastAdvancedPress\.time<450&&/);
  assert.match(adapter,/Math\.hypot\(event\.clientX-lastAdvancedPress\.x,event\.clientY-lastAdvancedPress\.y\)<6/);
  // Resetting on a match stops a third press chaining into a fourth.
  assert.match(adapter,/lastAdvancedPress=isDouble\?\{time:0,x:0,y:0\}/);
});

test("A2.8 a double-press on text opens the inline editor with the current text",()=>{
  const handler=adapter.slice(adapter.indexOf("onAdvancedPointerDown=(event)=>{"));
  assert.match(handler,/if\(doublePress&&object\.type==="text"&&store\.entitlement\.canMutate===true\)/);
  assert.match(handler,/advancedTextEdit:\{id:object\.id,draft:String\(block\?\.text\|\|""\)\}/);
  assert.match(handler,/data-advanced-inline-text-input/);
});
