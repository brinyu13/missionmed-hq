import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  DEFAULT_EXPORT_AUDIENCE,
  DEFAULT_EXPORT_FORMAT_ID,
  EXPORT_FORMATS,
  PRINT_GUIDANCE_COPY,
  buildExportFilename,
  filterEventsForAudience,
  renderExportScreen
} from "../web/js/uxr-002/export-screen.js";
import {createLocalExportAdapter} from "../web/js/uxr-002/export-adapter.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";

const webRoot=new URL("../web/",import.meta.url);
const index=await readFile(new URL("index.html",webRoot),"utf8");
const adapter=await readFile(new URL("js/407f-engineering-adapter.js",webRoot),"utf8");
const css=await readFile(new URL("styles/407f-upgrade.css",webRoot),"utf8");
const fixedNow=new Date("2026-07-29T16:00:00.000Z");

function sourceBetween(source,start,end){
  const from=source.indexOf(start);
  const to=source.indexOf(end,from+start.length);
  assert.ok(from>=0,`missing source marker: ${start}`);
  assert.ok(to>from,`missing source marker: ${end}`);
  return source.slice(from,to);
}

function exportSection(){
  return sourceBetween(
    index,
    '<section data-view="export">',
    "<!-- ================= REFERENCE"
  );
}

function timeline(){
  const document=defaultDocument();
  document.id="timeline-amara";
  document.studentProfile.fullName="Amara Osei";
  document.studentProfile.interviewSeason="2026-01";
  document.events=[
    {
      id:"safe",
      title:"Medical school",
      categoryId:"education",
      eventType:"duration",
      startDate:"2021-01",
      endDate:"2025-05",
      visibilityState:"INTERVIEWER_SAFE"
    },
    {
      id:"advisor",
      title:"Family context",
      categoryId:"personal",
      eventType:"milestone",
      startDate:"2023-06",
      visibilityState:"ADVISOR_ONLY"
    }
  ];
  return document;
}

test("canonical 407F exposes one Export host and removes the legacy Export Bay shell",()=>{
  const section=exportSection();
  assert.match(section,/<div id="export407F"[^>]*><\/div>/);
  assert.equal((index.match(/<section data-view="export">/g)||[]).length,1);
  for(const retired of [
    "EXPORT <em>BAY</em>",
    "SIMULATED FILE OUTPUT",
    'id="exSize"',
    'id="exGrid"',
    'id="exPrint"',
    'id="exGateChip"',
    'id="exWarnChip"'
  ]){
    assert.doesNotMatch(section,new RegExp(retired),retired);
  }
});

test("407F reuses export-screen.js and the verified local Export adapter against the shared host",()=>{
  assert.match(
    adapter,
    /import\s*\{[\s\S]*\binstallExportScreen\b[\s\S]*\bnormalizeExportState\b[\s\S]*\brenderExportScreen\b[\s\S]*\}\s*from\s*"\.\/uxr-002\/export-screen\.js"/
  );
  assert.match(
    adapter,
    /import\s*\{\s*createLocalExportAdapter\s*\}\s*from\s*"\.\/uxr-002\/export-adapter\.js"/
  );
  assert.match(adapter,/document\.getElementById\("export407F"\)/);
  assert.match(adapter,/createLocalExportAdapter\(\{/);
  assert.match(adapter,/renderExportScreen\(store\.document,\s*\{/);
  assert.match(adapter,/installExportScreen\(exportHost,\s*store\.document,\s*\{/);

  const local=createLocalExportAdapter({
    triggerDownload:()=>({downloaded:true,verification:"bounded-test"})
  });
  assert.equal(local.id,"d1-uxr-002-local-browser-export");
  assert.equal(local.executionMode,"local");
  assert.equal(local.metadata.externalApiCalls,false);
  assert.equal(local.metadata.productionWrites,false);
});

test("active Export preserves exact audience, format, filename, and collapsed print-guidance behavior",()=>{
  assert.equal(DEFAULT_EXPORT_AUDIENCE,"INTERVIEWER_SAFE");
  assert.equal(DEFAULT_EXPORT_FORMAT_ID,"png-1920x1080");
  assert.deepEqual(EXPORT_FORMATS.map(({label})=>label),[
    "PNG · 1920 × 1080 — screens and slides",
    "PNG · 2560 × 1440 — high-res screens",
    "PDF · Letter landscape — printing (300 DPI)",
    "PDF · A4 landscape — printing (300 DPI)"
  ]);

  const document=timeline();
  assert.deepEqual(
    filterEventsForAudience(document.events,"INTERVIEWER_SAFE").included.map(({id})=>id),
    ["safe"]
  );
  assert.deepEqual(
    filterEventsForAudience(document.events,"EVERYTHING").included.map(({id})=>id),
    ["safe","advisor"]
  );
  assert.equal(
    buildExportFilename(document.studentProfile.fullName,"pdf-letter-landscape",{now:fixedNow}),
    "Osei_Amara_Timeline_2026-07-29.pdf"
  );

  const html=renderExportScreen(document,{
    state:{
      audience:"EVERYTHING",
      formatId:"pdf-letter-landscape",
      showPrintMargins:true
    },
    previewHtml:'<div data-canonical-preview="true"></div>',
    now:fixedNow
  });
  assert.match(html,/data-export-layout="two-column" data-export-controls-width="380"/);
  assert.match(html,/>Interview-safe<\/span>/);
  assert.match(html,/>Everything<\/span>/);
  assert.match(html,/Includes advisor-only items\. Don&#039;t hand this version to programs\./);
  assert.equal((html.match(/name="export-format"/g)||[]).length,4);
  assert.match(html,/data-month-field="export-interview-season"/);
  assert.match(html,/data-print-margin-mm="12\.7"/);
  assert.match(html,/<details class="card export-card print-guidance"/);
  assert.doesNotMatch(html,/<details[^>]* open/);
  const plain=html.replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&#039;/g,"'");
  for(const bullet of PRINT_GUIDANCE_COPY.bullets){
    assert.ok(plain.includes(bullet),bullet);
  }
});

test("active Export preserves every frozen Advisor review card state",()=>{
  const document=timeline();
  assert.match(
    renderExportScreen(document,{now:fixedNow}),
    /Get a second pair of eyes before you export\./
  );

  document.advisor={
    status:"pending",
    requestedAt:"2026-07-28T12:00:00.000Z",
    comments:[]
  };
  let html=renderExportScreen(document,{now:fixedNow});
  assert.match(html,/Awaiting advisor review · requested Jul 28, 2026/);
  assert.match(html,/>Cancel request<\/button>/);

  document.advisor={
    status:"approved",
    approvedAt:"2026-07-27T12:00:00.000Z",
    editedSince:false,
    comments:[]
  };
  assert.match(renderExportScreen(document,{now:fixedNow}),/Advisor approved · Jul 27, 2026/);
  document.advisor.editedSince=true;
  assert.match(renderExportScreen(document,{now:fixedNow}),/Approved Jul 27, 2026 · edited since/);

  document.advisor={
    status:"changes-requested",
    comments:[{id:"open"},{id:"resolved",resolvedAt:"2026-07-29"}]
  };
  html=renderExportScreen(document,{now:fixedNow});
  assert.match(html,/>1 advisor comments<\/button>/);
});

test("407F Export integration keeps preview, download, versions, and document updates on shared engineering",()=>{
  const integration=sourceBetween(
    adapter,
    'const exportHost=document.getElementById("export407F")',
    "api.undo="
  );
  assert.match(
    integration,
    /renderPreview:\s*(?:renderExportPreview|(?:async\s*)?\(?input\)?\s*=>)/
  );
  assert.match(
    adapter,
    /const renderExportPreview=\(input\)=>\{[\s\S]*advancedBoardRenderer\(input\.timeline/
  );
  assert.match(integration,/exportAdapter/);
  assert.match(integration,/requestVersion:\s*\(label,\s*kind\)\s*=>\s*store\.saveVersion\(label,\s*kind\)/);
  assert.match(integration,/onStateChange:/);
  assert.match(integration,/store\.mutate\(/);
  assert.doesNotMatch(integration,/simulated\s*:\s*true|executionMode\s*:\s*["']simulated["']/);
});

test("active 407F CSS styles Export surfaces without theming the shell",()=>{
  const selectors=[];
  for(const match of css.matchAll(/([^{}]+)\{/g)){
    const selector=match[1].trim();
    if(/@(?:media|supports|keyframes)/.test(selector))continue;
    if(/(?:export-|print-guidance|print-margin|ghost-export)/.test(selector)){
      selectors.push(...selector.split(",").map((item)=>item.trim()));
    }
  }
  assert.ok(selectors.length>=12,"expected active 407F Export surface rules");
  for(const selector of selectors){
    assert.match(
      selector,
      /^\.export407FHost\b/,
      `Export selector must stay host-scoped: ${selector}`
    );
  }
  for(const surface of [
    "export-layout",
    "export-controls",
    "export-card",
    "export-preview",
    "export-advisor-card",
    "print-guidance"
  ]){
    assert.match(css,new RegExp(`\\.export407FHost[^,{]*\\.${surface}`),surface);
  }
  assert.doesNotMatch(css,/(?:html|body|#app|\.shell)\s*\[\s*data-screen\s*=\s*["']?export/i);
  assert.doesNotMatch(css,/(?:html|body|#app|\.shell)\.export\b/i);
});
