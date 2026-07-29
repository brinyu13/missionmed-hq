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

test("M2 Home renders the verbatim five-second contract copy",()=>{
  const required=[
    "Turn your medical journey into an interview-ready timeline.",
    "Answer guided questions about your school, exams, rotations, work, and research. Timeline Builder draws the Keynote-style timeline for you — no design work.",
    "Start from your CV or MyERAS",
    "Upload your CV or MyERAS export. We'll read it, suggest timeline events, and you approve each one before it appears.",
    "Drop a PDF here, or browse",
    "CV · MyERAS PDF · résumé",
    "Nothing appears on your timeline until you approve it.",
    "Your timeline",
    "This is what you're building.",
    "A one-page visual story an interviewer can read at a glance.",
    "Use the guided builder →"
  ];
  for(const copy of required)assert.ok(home.includes(copy),`missing frozen Home copy: ${copy}`);
  assert.match(home,/1 · ADD YOUR JOURNEY&nbsp;&nbsp;&nbsp;2 · REFINE ON THE CANVAS&nbsp;&nbsp;&nbsp;3 · EXPORT FOR INTERVIEWS/);
});

test("M2 Home supports empty, resume, intake-review, approval, and start-over states",()=>{
  assert.match(index,/build\.textContent=count\?'CONTINUE BUILDING ▸':'START BUILDING ▸'/);
  assert.match(index,/pendingButton\.textContent=pending\+' suggestions to review'/);
  assert.match(index,/approved\.textContent=state\.approved\?'Advisor approved · '/);
  assert.match(index,/shell\.classList\.toggle\('isEmpty',!count\)/);
  assert.match(index,/>Start a new timeline\?<\/div>/);
  assert.match(index,/Your current draft stays in History as a version\. You can restore it anytime\./);
  assert.match(index,/Before starting over · /);
  assert.match(index,/homeHasEvents\?state\.user:state\.demo/);
  assert.match(upgradeCss,/\.homePreviewShell\.isEmpty #boardCommand\{[\s\S]*?opacity:\.4/);
});
