import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read=(relativePath)=>readFileSync(new URL(`../${relativePath}`,import.meta.url),"utf8");
const index=read("web/index.html");
const upgradeCss=read("web/styles/407f-upgrade.css");

function extract(tagExpression){
  const match=index.match(tagExpression);
  assert.ok(match,`missing candidate region: ${tagExpression}`);
  return match[0];
}

test("M1 rail contains exactly Home, Builder, Canvas, and Export in order",()=>{
  const rail=extract(/<nav id="rail"[\s\S]*?<\/nav>/);
  const items=[...rail.matchAll(/<button class="rtab(?: on)?" data-v="([^"]+)">([^<]+)<\/button>/g)]
    .map((match)=>({route:match[1],label:match[2]}));
  assert.deepEqual(items,[
    {route:"command",label:"Home"},
    {route:"builder",label:"Builder"},
    {route:"canvas",label:"Canvas"},
    {route:"export",label:"Export"}
  ]);
  assert.equal((rail.match(/class="rtab/g)||[]).length,4);
  assert.doesNotMatch(rail,/Command|Intake|Review|Media|Advisor|Questions|Versions|Reference|railFoot/);
});

test("M1 header preserves 407F identity and removes the legacy HUD",()=>{
  const header=extract(/<header class="d1404Header">[\s\S]*?<\/header>/);
  assert.match(header,/id="matrixBack"[^>]+>← MATRIX<\/a>/);
  assert.match(header,/TIMELINE<b>\/\/S1<\/b>/);
  assert.match(header,/id="hudSave" role="status" aria-live="polite"/);
  assert.match(header,/id="hudExport" data-nav="export" disabled aria-disabled="true"/);
  assert.doesNotMatch(header,/hudMid|hudRight|hudName|hudDraft|hudCount|hudAxis|hudGate|hudSafe|mpWrap|lvlHex|xpWrap|avHex/);
  assert.doesNotMatch(index,/DRAFT STATUS/);
});

test("M1 uses one 407F runtime seam and no white-shell activation",()=>{
  assert.match(index,/<link rel="stylesheet" href="\.\/styles\/407f-upgrade\.css">/);
  assert.match(index,/<script type="module" src="\.\/js\/407f-engineering-adapter\.js"><\/script>/);
  assert.doesNotMatch(index,/src=["']\.\/js\/app\.js["']/);
  assert.doesNotMatch(index,/href=["']\.\/styles\.css["']/);
  assert.match(index,/renderAll:renderAll/);
  assert.match(index,/document\.dispatchEvent\(new CustomEvent\('d1:407f-rendered'\)\)/);
  assert.match(upgradeCss,/outline:2px solid var\(--cy\)/);
  assert.match(upgradeCss,/@media \(prefers-reduced-motion:reduce\)/);
});
