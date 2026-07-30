import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read=(relativePath)=>readFileSync(new URL(`../${relativePath}`,import.meta.url),"utf8");
const index=read("web/index.html");
const upgradeCss=read("web/styles/407f-upgrade.css");
const home=index.match(/<!-- ================= COMMAND ================= -->([\s\S]*?)<!-- ================= BUILDER \/ WIZARD ================= -->/)?.[1]||"";

test("M2 Home contains exactly the three frozen regions",()=>{
  assert.equal((home.match(/class="panelD homeRegion/g)||[]).length,3);
  assert.match(home,/class="panelD homeRegion homeBuildRegion"/);
  assert.match(home,/class="panelD homeRegion homeIntakeRegion"/);
  assert.match(home,/class="panelD homeRegion homeTimelineRegion"/);
  assert.doesNotMatch(home,/DRAFT STATUS|rolemini|LOAD DEMO STORY|VIEW REFERENCE SAMPLE|OP D1|AXIS AUTO-CALIBRATES/);
  assert.match(upgradeCss,/grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
  assert.match(upgradeCss,/\.homeBuildRegion\{[\s\S]*?grid-column:span 7/);
  assert.match(upgradeCss,/\.homeIntakeRegion\{[\s\S]*?grid-column:span 5/);
  assert.match(upgradeCss,/\.homeTimelineRegion\{[\s\S]*?grid-column:1\/-1/);
});

test("D1-405 Home preserves the five-second contract while making File Vault primary",()=>{
  const required=[
    "Turn your medical journey into an interview-ready timeline.",
    "Answer guided questions about your school, exams, rotations, work, and research. Timeline Builder draws the Keynote-style timeline for you — no design work.",
    "Start faster from File Vault",
    "Already have your CV or MyERAS file? Let Timeline Builder do the first pass.",
    "CHOOSE FROM FILE VAULT ▸",
    "Upload from this computer",
    "PDF or DOCX · up to 20 MB",
    "Nothing is added until you review and approve it.",
    "Latest timeline preview",
    "Your timeline will take shape here.",
    "Your latest working timeline will appear as you add information.",
    "START BUILDING ▸"
  ];
  for(const copy of required)assert.ok(home.includes(copy),`missing frozen Home copy: ${copy}`);
  assert.match(home,/>1 · ADD YOUR JOURNEY<\/span>/);
  assert.match(home,/>2 · EDIT YOUR TIMELINE<\/span>/);
  assert.match(home,/>3 · EXPORT FOR INTERVIEWS<\/span>/);
});

test("M2 Home supports empty, resume, intake-review, approval, and start-over states",()=>{
  assert.match(index,/build\.textContent=count\?'CONTINUE BUILDING ▸':'START BUILDING ▸'/);
  assert.match(index,/pendingButton\.textContent=pending\+' suggestions to review'/);
  assert.match(index,/approved\.textContent=state\.approved\?'Advisor approved · '/);
  assert.match(index,/shell\.classList\.toggle\('isEmpty',!count\)/);
  assert.match(index,/>Start a new timeline\?<\/div>/);
  assert.match(index,/Your current draft stays in History as a version\. You can restore it anytime\./);
  assert.match(index,/Before starting over · /);
  assert.doesNotMatch(index,/homeHasEvents\?state\.user:state\.demo/);
  assert.match(index,/homePreviewPlaceholder/);
  assert.match(upgradeCss,/\.homePreviewPlaceholder\{/);
});
