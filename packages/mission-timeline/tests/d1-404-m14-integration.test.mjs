import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  ACCESSIBILITY_BASELINE,
  RESPONSIVE_BANNER,
  RESPONSIVE_BREAKPOINTS,
  buildResponsiveModel,
  responsiveTier
} from "../web/js/uxr-002/responsive.js";

const webRoot=new URL("../web/",import.meta.url);
const index=await readFile(new URL("index.html",webRoot),"utf8");
const adapter=await readFile(new URL("js/407f-engineering-adapter.js",webRoot),"utf8");
const canvas=await readFile(new URL("js/uxr-002/canvas.js",webRoot),"utf8");
const css=await readFile(new URL("styles/407f-upgrade.css",webRoot),"utf8");
const packageJson=JSON.parse(await readFile(new URL("../package.json",import.meta.url),"utf8"));
const buildScript=await readFile(new URL("../scripts/build-d1-404-candidate.mjs",import.meta.url),"utf8");

function modelAt(width,options={}){
  return buildResponsiveModel({
    width,
    height:options.height??900,
    ...options
  });
}

function mediaBlocks(source,maxWidth){
  const marker=new RegExp(`@media\\s*\\(\\s*max-width\\s*:\\s*${maxWidth}px\\s*\\)\\s*\\{`,"g");
  const blocks=[];
  for(const match of source.matchAll(marker)){
    let depth=1;
    let cursor=match.index+match[0].length;
    while(cursor<source.length&&depth){
      if(source[cursor]==="{")depth+=1;
      if(source[cursor]==="}")depth-=1;
      cursor+=1;
    }
    assert.equal(depth,0,`unterminated ${maxWidth}px media query`);
    blocks.push(source.slice(match.index,cursor));
  }
  assert.ok(blocks.length,`missing ${maxWidth}px media query`);
  return blocks.join("\n");
}

function namedMediaBlocks(source,query){
  const marker=new RegExp(`@media\\s*\\(\\s*${query}\\s*\\)\\s*\\{`,"g");
  const blocks=[];
  for(const match of source.matchAll(marker)){
    let depth=1;
    let cursor=match.index+match[0].length;
    while(cursor<source.length&&depth){
      if(source[cursor]==="{")depth+=1;
      if(source[cursor]==="}")depth-=1;
      cursor+=1;
    }
    assert.equal(depth,0,`unterminated ${query} media query`);
    blocks.push(source.slice(match.index,cursor));
  }
  assert.ok(blocks.length,`missing ${query} media query`);
  return blocks.join("\n");
}

function htmlText(source){
  return source
    .replace(/<script\b[\s\S]*?<\/script>/gi," ")
    .replace(/<style\b[\s\S]*?<\/style>/gi," ")
    .replace(/<!--[\s\S]*?-->/g," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi," ")
    .replace(/\s+/g," ")
    .trim();
}

test("M14 active 407F keeps every frozen width boundary and the required screen capability changes",()=>{
  assert.deepEqual(RESPONSIVE_BREAKPOINTS,{
    full:1440,
    compressed:1280,
    desktop:1024,
    tablet:768
  });
  for(const [width,tier] of [
    [1440,"full"],
    [1439,"compressed"],
    [1280,"compressed"],
    [1279,"desktop-overlay"],
    [1024,"desktop-overlay"],
    [1023,"tablet"],
    [768,"tablet"],
    [767,"phone"]
  ]){
    assert.equal(responsiveTier(width).id,tier,`${width}px`);
  }

  const compressed=modelAt(1280);
  assert.equal(compressed.screens.builder.preview,"live-pane");
  assert.equal(compressed.screens.builder.previewMinimumWidth,420);
  assert.equal(compressed.screens.builder.formColumnWidth,480);

  const overlay=modelAt(1024);
  assert.equal(overlay.screens.home.layout,"stacked");
  assert.equal(overlay.screens.builder.preview,"overlay-sheet");
  assert.equal(overlay.screens.canvas.contentMode,"interactive");

  const tablet=modelAt(768);
  assert.equal(tablet.navigation.placement,"bottom-tab-bar");
  assert.equal(tablet.screens.canvas.contentMode,"view-only");
  assert.equal(tablet.screens.canvas.banner,RESPONSIVE_BANNER);
  assert.equal(tablet.screens.export.contentMode,"full");

  const phone=modelAt(767);
  assert.equal(phone.navigation.placement,"bottom-tab-bar");
  assert.equal(phone.screens.home.functional,true);
  assert.equal(phone.screens.builder.functional,true);
  assert.equal(phone.screens.intake.functional,true);
  assert.equal(phone.screens.canvas.contentMode,"preview-only");
  assert.equal(phone.screens.export.contentMode,"preview-only");
  assert.equal(phone.features.emailReminder,false);
});

test("M14 installs the retained responsive runtime in the canonical 407F adapter",()=>{
  assert.match(
    adapter,
    /import\s*\{[\s\S]*\binstallResponsiveRuntime\b[\s\S]*\}\s*from\s*"\.\/uxr-002\/responsive\.js"/
  );
  assert.match(adapter,/installResponsiveRuntime\s*\(\s*\{/);
  assert.match(adapter,/onChange\s*:/);
  assert.match(adapter,/\.destroy\(\)/);
  assert.match(adapter,/api\.responsive\s*=/);
  assert.match(adapter,/setResponsiveWidth\s*\(/);
});

test("M14 canonical CSS implements the desktop overlay, tablet bottom tabs, and phone preview tiers",()=>{
  const desktop=mediaBlocks(css,1279);
  assert.match(desktop,/\.d1404HomeGrid/);
  assert.match(desktop,/\.d1404Builder/);
  assert.match(desktop,/\.builderPreview/);
  assert.match(desktop,/builderPreviewToggle/);

  const tablet=mediaBlocks(css,1023);
  assert.match(tablet,/#rail/);
  assert.match(tablet,/bottom\s*:\s*0/);
  assert.match(tablet,/main/);
  assert.match(tablet,/canvas-responsive-banner/);

  const phone=mediaBlocks(css,767);
  assert.match(phone,/export407FPhoneBoard/);
  assert.match(adapter,/data-responsive-mode="preview-only"/);
  assert.match(adapter,/responsive407FBanner/);
  assert.doesNotMatch(phone,/email[^}]*reminder/i);
});

test("M14 provides the global keyboard map, shortcut sheet, and polite announcement target",()=>{
  assert.equal(ACCESSIBILITY_BASELINE.language,"en");
  assert.equal(ACCESSIBILITY_BASELINE.keyboardOperable,true);
  assert.match(index,/<html\s+lang="en"/i);
  assert.match(
    index,
    /id="globalLive407F"[^>]*role="status"[^>]*aria-live="polite"|id="globalLive407F"[^>]*aria-live="polite"[^>]*role="status"/
  );
  assert.match(adapter,/class="shortcut407FDialog"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(adapter,/Keyboard shortcuts/i);

  assert.match(adapter,/addEventListener\(\s*["']keydown["']/);
  assert.match(adapter,/(?:metaKey|ctrlKey)/);
  assert.match(adapter,/shiftKey/);
  assert.match(adapter,/(?:key|lower)\s*===\s*["']z["']/i);
  assert.match(adapter,/(?:key|lower)\s*===\s*["']e["']/i);
  assert.match(adapter,/["']Escape["']/);
  assert.match(adapter,/["']\?["']/);
  assert.match(adapter,/bridge\.go\(\s*["']export["']\s*\)/);
  assert.match(adapter,/api\.undo\s*=\s*\(\)\s*=>/);
  assert.match(adapter,/api\.redo\s*=\s*\(\)\s*=>/);
  assert.match(adapter,/event\.shiftKey\s*\?\s*api\.redo\s*:\s*api\.undo/);
});

test("M14 exposes Canvas application semantics and independent live announcements",()=>{
  assert.match(canvas,/role="application"/);
  assert.match(canvas,/Timeline visualization,[^"]*events; use Tab to move between events/);
  assert.match(canvas,/aria-live="polite"/);
  assert.match(canvas,/F2/);
  assert.match(canvas,/Delete/);
  assert.match(adapter,/function namespaceBoardSvg\s*\(/);
  assert.match(adapter,/aria-labelledby/);
  assert.match(adapter,/url\\\(#/);
  assert.match(adapter,/svg\s*:\s*namespaceBoardSvg\s*\(/);
});

test("M14 reduced motion suppresses every named motion path in the active 407F layer",()=>{
  assert.match(css,/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/);
  const reducedBlocks=namedMediaBlocks(css,"prefers-reduced-motion\\s*:\\s*reduce");
  assert.match(reducedBlocks,/animation\s*:\s*none/);
  assert.match(reducedBlocks,/transition\s*:\s*none/);
  assert.match(reducedBlocks,/scroll-behavior\s*:\s*auto/);
  assert.match(reducedBlocks,/canvas407F-layout-settle|layout-settling/);
  assert.match(reducedBlocks,/advisor-question-highlight/);
  assert.match(reducedBlocks,/\*\s*,\s*\*::before\s*,\s*\*::after/);
});

test("M14 language sweep finds none of the frozen prohibited terms in shipped HTML UI text",()=>{
  const text=htmlText(index);
  const prohibited=[
    "fixture",
    "quarantine",
    "engine",
    "dupe",
    "command",
    "stress",
    "sprite",
    "OP D1"
  ];
  for(const term of prohibited){
    assert.doesNotMatch(text,new RegExp(`\\b${term.replace(" ","\\\\s+")}\\b`,"i"),term);
  }
});

test("M14 production build packages only the active local 407F runtime and emits a manifest",()=>{
  assert.equal(packageJson.scripts.build,"node scripts/build-d1-404-candidate.mjs");
  assert.match(buildScript,/D1-404_TIMELINE_407F/);
  assert.match(buildScript,/407f-engineering-adapter\.js/);
  assert.match(buildScript,/superseded shell entry/);
  assert.match(buildScript,/TimelineBuilder_v5\.5_PreLaunch\.html/);
  assert.match(buildScript,/productionWrites:false/);
  assert.match(buildScript,/matrixWrites:false/);
  assert.match(buildScript,/manifest\.json/);
});
