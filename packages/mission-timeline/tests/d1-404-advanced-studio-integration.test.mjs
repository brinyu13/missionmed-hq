import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  ADVANCED_ENTRY_DIALOG,
  GUIDED_RETURN_DIALOG,
  applyModeSwitch,
  planModeSwitch,
  renderAdvancedStudio
} from "../web/js/uxr-002/advanced-studio.js";
import {
  createAdvancedBoardRenderer
} from "../web/js/uxr-002/advanced-board.js";
import {renderKeynoteClassicBoard} from "../web/js/uxr-002/board-renderer.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";

const webRoot=new URL("../web/",import.meta.url);
const adapter=await readFile(new URL("js/407f-engineering-adapter.js",webRoot),"utf8");
const css=await readFile(new URL("styles/407f-upgrade.css",webRoot),"utf8");

function sourceBetween(source,start,end){
  const from=source.indexOf(start);
  const to=source.indexOf(end,from+start.length);
  assert.ok(from>=0,`missing source marker: ${start}`);
  assert.ok(to>from,`missing source marker: ${end}`);
  return source.slice(from,to);
}

function advancedDocument(mode="guided"){
  const document=defaultDocument();
  document.mode=mode;
  document.studentProfile.fullName="Amara Osei";
  document.events=[
    {
      id:"work",
      title:"Clinical coordinator",
      categoryId:"work",
      eventType:"duration",
      startDate:"2023-01",
      endDate:"2024-01",
      visibilityState:"INTERVIEWER_SAFE"
    }
  ];
  return document;
}

test("407F reuses the existing Advanced Studio state/actions and Advanced board renderer modules",()=>{
  for(const name of [
    "applyAdvancedObjectAction",
    "applyAdvancedTypography",
    "applyModeSwitch",
    "createFlatColorBackground",
    "createMediaElement",
    "createPresetBackground",
    "createTextBlock",
    "createUploadedBackground",
    "installAdvancedStudio",
    "planModeSwitch",
    "recordRecentColor",
    "renderAdvancedStudio",
    "sampleEyeDropper",
    "setBackgroundDim",
    "setLayoutLock",
    "updateTextBlockContent"
  ]){
    assert.match(adapter,new RegExp(`\\b${name}\\b`),name);
  }
  assert.match(
    adapter,
    /import\s*\{\s*createAdvancedBoardRenderer\s*\}\s*from\s*"\.\/uxr-002\/advanced-board\.js"/
  );
});

test("the reused exact mode plans gate both directions and require the pre-Advanced automatic version",()=>{
  const clock=()=>new Date("2026-07-29T16:00:00.000Z");
  const guided=advancedDocument("guided");
  const enter=planModeSwitch(guided,"advanced",{clock});
  assert.deepEqual(enter.dialog,ADVANCED_ENTRY_DIALOG);
  assert.deepEqual(enter.versionRequest,{
    name:"Before Advanced Studio · Jul 29, 2026",
    kind:"automatic",
    requiredBeforeMutation:true
  });
  assert.equal(applyModeSwitch(guided,enter,"stay-guided").document.mode,"guided");

  const advanced=applyModeSwitch(guided,enter,"enter-advanced").document;
  const leave=planModeSwitch(advanced,"guided",{clock});
  assert.deepEqual(leave.dialog,GUIDED_RETURN_DIALOG);
  assert.equal(applyModeSwitch(advanced,leave,"cancel").document.mode,"advanced");
  assert.equal(applyModeSwitch(advanced,leave,"return-guided").document.mode,"guided");

  assert.match(adapter,/planModeSwitch\(store\.document,\s*targetMode\)/);
  assert.match(adapter,/applyModeSwitch\(store\.document,\s*plan,\s*decision\)/);
  const decisionFlow=sourceBetween(
    adapter,
    "const applyModeDecision=",
    "const requestCanvasMode="
  );
  const saveIndex=decisionFlow.indexOf("store.saveVersion(");
  const applyIndex=decisionFlow.indexOf("applyModeSwitch(");
  const replaceIndex=decisionFlow.indexOf("store.replace(");
  assert.ok(saveIndex>=0&&saveIndex<applyIndex,"automatic version must precede the mode mutation");
  assert.ok(applyIndex<replaceIndex,"the approved mode result must precede shared-store replacement");
});

test("Canvas receives the themed Advanced renderer, Advanced controls, and exact mode requests",()=>{
  assert.match(
    adapter,
    /createAdvancedBoardRenderer\(\{\s*baseRenderer:\s*render407FThemedBoard/
  );
  const canvasInstall=sourceBetween(
    adapter,
    "canvasController=installCanvas(canvasHost,store,{",
    "api.canvas=canvasController"
  );
  assert.match(canvasInstall,/renderBoard:\s*advancedBoardRenderer/);
  assert.match(
    canvasInstall,
    /renderAdvanced:\s*\(document,\s*options\)\s*=>\s*renderAdvancedStudio\(document/
  );
  assert.match(canvasInstall,/onAdvanced:\s*\(\)\s*=>\s*requestCanvasMode\("advanced"\)/);
  assert.match(canvasInstall,/onGuided:\s*\(\)\s*=>\s*requestCanvasMode\("guided"\)/);
  assert.match(adapter,/installAdvancedStudio\(canvasHost,\s*advancedHooks\(\)\)/);
});

test("all Advanced controls delegate through shared-store hooks and preserve Guided isolation",()=>{
  const hooks=sourceBetween(
    adapter,
    "const advancedHooks=",
    "const canvasHost="
  );
  for(const hook of [
    "onAction",
    "onObjectAction",
    "onTypography",
    "onTextContent",
    "onBackgroundTab",
    "onBackgroundPreset",
    "onBackgroundUpload",
    "onBackgroundDim",
    "onColor",
    "onHex",
    "onEyeDropper",
    "onLayoutLock"
  ]){
    assert.match(hooks,new RegExp(`\\b${hook}\\s*:`),hook);
  }
  assert.match(hooks,/store\.mutate\(/);
  assert.match(hooks,/store\.replace\(/);
  assert.match(hooks,/document\.advanced\./);
  assert.doesNotMatch(hooks,/bridge\.state\.user\.events|bridge\.state\.wiz|state\.user\.events/);

  const guided=advancedDocument("guided");
  assert.equal(renderAdvancedStudio(guided,{backgroundOpen:true}),"");
  const guidedBase=renderKeynoteClassicBoard(guided,{currentMonth:"2026-07"});
  const guidedAdvanced=createAdvancedBoardRenderer()(guided,{currentMonth:"2026-07"});
  assert.equal(guidedAdvanced.svg,guidedBase.svg);
  assert.equal("advanced" in guidedAdvanced,false);
});

test("407F CSS styles Advanced surfaces without applying Advanced mode to the shell",()=>{
  const selectors=[];
  for(const match of css.matchAll(/([^{}]+)\{/g)){
    const selector=match[1].trim();
    if(/@(?:media|supports|keyframes)/.test(selector))continue;
    if(/advanced-(?:insert|background|selection|typography|object|text|color|mode)|layout-lock/.test(selector)){
      selectors.push(...selector.split(",").map((item)=>item.trim()));
    }
  }
  assert.ok(selectors.length>=10,"expected the active 407F Advanced surface rules");
  for(const selector of selectors){
    assert.match(
      selector,
      /^(?:\.canvas407FHost|#modalIn)\b/,
      `Advanced selector must stay scoped: ${selector}`
    );
  }

  for(const surface of [
    "advanced-insert-strip",
    "advanced-background-panel",
    "advanced-selection-controls",
    "advanced-typography-controls",
    "advanced-object-actions"
  ]){
    assert.match(css,new RegExp(`\\.canvas407FHost[^,{]*\\.${surface}`),surface);
  }
  assert.doesNotMatch(css,/(?:html|body|#app|\.shell)\s*\[\s*data-mode\s*=\s*["']?advanced/i);
  assert.doesNotMatch(css,/(?:html|body|#app|\.shell)\.advanced\b/i);
});
