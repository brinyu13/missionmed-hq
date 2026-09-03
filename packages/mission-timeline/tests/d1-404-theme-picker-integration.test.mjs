import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  THEME_DEFINITIONS,
  THEME_PICKER_CARD_SIZE,
  THEME_PICKER_LAYOUT
} from "../web/js/uxr-002/themes.js";
import {
  buildThemePickerForDocument,
  renderThemePicker
} from "../web/js/uxr-002/theme-picker.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";

const webRoot=new URL("../web/",import.meta.url);
const adapter=await readFile(new URL("js/407f-engineering-adapter.js",webRoot),"utf8");
const css=await readFile(new URL("styles/407f-upgrade.css",webRoot),"utf8");

function populatedDocument(){
  const document=defaultDocument();
  document.studentProfile.fullName="Amara Osei";
  document.events=[
    {
      id:"education",
      title:"Medical school",
      categoryId:"education",
      eventType:"duration",
      startDate:"2021-01",
      endDate:"2022-12",
      visibilityState:"INTERVIEWER_SAFE"
    },
    {
      id:"rotation",
      title:"US rotation",
      categoryId:"clinical",
      eventType:"duration",
      startDate:"2023-01",
      endDate:"2024-06",
      visibilityState:"INTERVIEWER_SAFE"
    },
    {
      id:"research",
      title:"Research",
      categoryId:"research",
      eventType:"duration",
      startDate:"2023-06",
      endDate:"2025-06",
      visibilityState:"INTERVIEWER_SAFE"
    }
  ];
  return document;
}

function sourceBetween(source,start,end){
  const from=source.indexOf(start);
  const to=source.indexOf(end,from+start.length);
  assert.ok(from>=0,`missing source marker: ${start}`);
  assert.ok(to>from,`missing source marker: ${end}`);
  return source.slice(from,to);
}

function cssRule(selector){
  const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const match=css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  assert.ok(match,`missing CSS rule: ${selector}`);
  return match[1];
}

test("407F imports the existing live-board theme picker and supplies it to the shared Canvas controller",()=>{
  assert.match(
    adapter,
    /import\s*\{\s*renderThemePicker\s*\}\s*from\s*"\.\/uxr-002\/theme-picker\.js"/
  );
  const canvasInstall=sourceBetween(
    adapter,
    "canvasController=installCanvas(canvasHost,store,{",
    "api.canvas=canvasController"
  );
  assert.match(
    canvasInstall,
    /renderTheme:\s*\(document\)\s*=>\s*renderThemePicker\(document/
  );
});

test("the integrated picker delegates to the frozen five-theme catalog and renders the 2x3 live-miniature model",()=>{
  assert.equal(THEME_DEFINITIONS.length,5);
  assert.deepEqual(THEME_PICKER_LAYOUT,{columns:3,rows:2});
  assert.deepEqual(THEME_PICKER_CARD_SIZE,{width:128,height:72});

  const document=populatedDocument();
  const model=buildThemePickerForDocument(document,{currentMonth:"2026-07"});
  assert.equal(model.cells.length,6);
  assert.equal(model.cells.filter(({kind})=>kind==="theme").length,5);
  assert.equal(model.cells.filter(({kind})=>kind==="advanced-teaser").length,1);
  assert.ok(
    model.cells
      .filter(({kind})=>kind==="theme")
      .every(({miniature})=>(
        miniature.includes('width="128" height="72"')&&
        miniature.includes('data-renderer="D1-UXR-002-Keynote-Classic"')
      ))
  );
  assert.equal((renderThemePicker(document).match(/data-select-theme=/g)||[]).length,5);
});

test("theme selection mutates the shared TimelineStore document and then synchronizes the 407F bridge",()=>{
  const canvasInstall=sourceBetween(
    adapter,
    "canvasController=installCanvas(canvasHost,store,{",
    "api.canvas=canvasController"
  );
  assert.match(canvasInstall,/onSelectTheme:\s*\(themeId\)\s*=>\s*\{/);
  assert.match(
    canvasInstall,
    /store\.mutate\("Change theme",\s*\(document\)\s*=>\s*\{\s*document\.theme=themeId;\s*\}\)/
  );
  const selection=sourceBetween(canvasInstall,"onSelectTheme:","onDropReflow:");
  assert.match(selection,/syncBridgeFromStore\(\)/);
  assert.doesNotMatch(selection,/documentElement|document\.body|classList|dataset|style\./);
});

test("active 407F CSS scopes the 2x3 picker, 128x72 miniatures, and gold active border to the Canvas host",()=>{
  const grid=cssRule(".canvas407FHost .theme-picker-grid");
  assert.match(
    grid,
    /grid-template-columns:\s*repeat\(3,\s*(?:128px|minmax\(0,\s*1fr\))\)/
  );

  const miniature=cssRule(".canvas407FHost .theme-miniature");
  assert.match(miniature,/\bwidth:\s*128px/);
  assert.match(miniature,/\bheight:\s*72px/);

  const miniatureSvg=cssRule(".canvas407FHost .theme-miniature svg");
  assert.match(miniatureSvg,/\bwidth:\s*128px/);
  assert.match(miniatureSvg,/\bheight:\s*72px/);

  const active=cssRule(".canvas407FHost .theme-card.active");
  assert.match(active,/(?:border-color|outline-color):\s*var\(--gd\)/);

  assert.doesNotMatch(css,/(?:html|body|\.shell)\s*\[\s*data-theme/i);
  assert.doesNotMatch(css,/(?:html|body|\.shell)\.[^{,\s]*theme-(?:keynote|mission|advisor|horizon|journeys)/i);
});
