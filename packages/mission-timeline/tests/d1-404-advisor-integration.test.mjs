import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  ADVISOR_CHECKLIST_ITEMS,
  advisorApprovalBadge,
  advisorSessionModel,
  applyAdvisorRequest,
  approveAdvisorReview,
  buildAdvisorRequestPlan,
  markApprovalEditedSince,
  renderAdvisorSession,
  setChecklistState
} from "../web/js/uxr-002/advisor.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";

const webRoot=new URL("../web/",import.meta.url);
const index=await readFile(new URL("index.html",webRoot),"utf8");
const adapter=await readFile(new URL("js/407f-engineering-adapter.js",webRoot),"utf8");
const css=await readFile(new URL("styles/407f-upgrade.css",webRoot),"utf8");
const fixedClock=()=>new Date("2026-07-29T16:00:00.000Z");

function sourceBetween(source,start,end){
  const from=source.indexOf(start);
  const to=source.indexOf(end,from+start.length);
  assert.ok(from>=0,`missing source marker: ${start}`);
  assert.ok(to>from,`missing source marker: ${end}`);
  return source.slice(from,to);
}

function timeline(){
  const document=defaultDocument();
  document.id="timeline-amara";
  document.theme="horizon";
  document.studentProfile.fullName="Amara Osei";
  document.studentProfile.graduationDate="2024-05";
  document.events=[
    {
      id:"safe",
      title:"Medical school",
      categoryId:"education",
      eventType:"duration",
      startDate:"2020-01",
      endDate:"2024-05",
      visibilityState:"INTERVIEWER_SAFE"
    },
    {
      id:"advisor-only",
      title:"Private family context",
      categoryId:"personal",
      eventType:"milestone",
      startDate:"2023-04",
      visibilityState:"ADVISOR_ONLY"
    }
  ];
  return document;
}

function requestedTimeline(){
  const source=timeline();
  const plan=buildAdvisorRequestPlan(source,{
    message:"Please focus on chronology.",
    clock:fixedClock
  });
  return applyAdvisorRequest(source,plan).document;
}

test("canonical 407F provides one Advisor session host, removes the legacy panel, and adds no Advisor rail item",()=>{
  const section=sourceBetween(
    index,
    '<section data-view="advisor">',
    "<!-- ================= EXPORT"
  );
  assert.match(section,/<div id="advisor407F"[^>]*><\/div>/);
  assert.equal((index.match(/<section data-view="advisor">/g)||[]).length,1);
  for(const legacyId of [
    "boardAdvisor",
    "advChecks",
    "advComments",
    "advFlags",
    "advApprove"
  ]){
    assert.doesNotMatch(section,new RegExp(`id="${legacyId}"`),legacyId);
  }

  const rail=sourceBetween(index,'<nav id="rail"','</nav>');
  assert.deepEqual(
    [...rail.matchAll(/data-v="([^"]+)"/g)].map((match)=>match[1]),
    ["command","builder","canvas","media","export"]
  );
  assert.doesNotMatch(rail,/data-v="advisor"|>\s*Advisor\s*</i);
});

test("407F reuses the retained Advisor renderer and installer against the shared host",()=>{
  assert.match(
    adapter,
    /import\s*\{[\s\S]*\binstallAdvisorWorkflow\b[\s\S]*\brenderAdvisorSession\b[\s\S]*\}\s*from\s*"\.\/uxr-002\/advisor\.js"/
  );
  assert.match(adapter,/document\.getElementById\("advisor407F"\)/);
  assert.match(adapter,/renderAdvisorSession\(store\.document,\s*\{/);
  assert.match(adapter,/installAdvisorWorkflow\(advisorHost,\s*\{/);
  assert.match(adapter,/api\.advisor=/);
});

test("active Advisor session forces Advisor Paper, Everything, and a read-only board while retaining the student's theme chip",()=>{
  const document=requestedTimeline();
  const model=advisorSessionModel(document,{
    route:"advisor-session:timeline-amara",
    now:fixedClock()
  });
  assert.equal(model.state,"active");
  assert.equal(model.themeId,"advisor-paper");
  assert.equal(model.themeForced,true);
  assert.equal(model.audience,"everything");
  assert.equal(model.boardReadOnly,true);
  assert.equal(model.studentThemeId,"horizon");
  assert.equal(model.studentThemeChip,"Student's theme: Horizon");

  const html=renderAdvisorSession(document,{
    route:"advisor-session:timeline-amara",
    boardHtml:'<svg data-forced-advisor-paper data-audience="everything"></svg>',
    now:fixedClock()
  });
  assert.match(html,/data-advisor-theme="advisor-paper"/);
  assert.match(html,/Student&#039;s theme: Horizon/);
  assert.match(html,/data-forced-advisor-paper/);
  assert.match(html,/Read-only student timeline/);
  assert.doesNotMatch(html,/data-canvas-action|contenteditable=/);
});

test("active Advisor retains checklist, questions, pins, comments, verdict gates, and edited-since status",()=>{
  let document=requestedTimeline();
  let html=renderAdvisorSession(document,{
    route:"advisor-session:timeline-amara",
    now:fixedClock()
  });
  assert.equal(ADVISOR_CHECKLIST_ITEMS.length,5);
  assert.equal((html.match(/data-checklist-item=/g)||[]).length,5);
  assert.equal((html.match(/data-checklist-choice="pass"/g)||[]).length,5);
  assert.equal((html.match(/data-checklist-choice="flag"/g)||[]).length,5);
  assert.match(html,/>Likely interview questions</);
  assert.match(html,/>Comments</);
  assert.match(html,/Click anywhere on the board to pin a comment\./);
  assert.match(html,/>Approve for export</);
  assert.match(html,/>Request changes</);
  assert.match(html,/data-advisor-approve disabled/);
  assert.match(html,/data-advisor-request-changes disabled/);
  assert.match(html,/data-advisor-pin-cursor/);

  for(const {id} of ADVISOR_CHECKLIST_ITEMS){
    document=setChecklistState(document,id,"pass").document;
  }
  const approved=approveAdvisorReview(document,{
    advisorName:"Advisor",
    clock:fixedClock
  }).document;
  assert.match(advisorApprovalBadge(approved).text,/Advisor approved · Jul 29, 2026/);
  const edited=markApprovalEditedSince(approved,"event-data");
  assert.equal(edited.changed,true);
  assert.deepEqual(edited.badge,{
    status:"approved-edited",
    tone:"success",
    text:"Approved Jul 29, 2026 · edited since",
    silentlyRevoked:false
  });
  html=renderAdvisorSession(edited.document,{
    route:"advisor-session:timeline-amara",
    now:fixedClock()
  });
  assert.match(html,/Approved Jul 29, 2026 · edited since/);
});

test("407F Advisor handlers delegate checklist, questions, pins, comments, and verdicts through the shared store",()=>{
  const integration=sourceBetween(
    adapter,
    "const applyAdvisorResult=",
    "on407FRendered="
  );
  for(const hook of [
    "onChecklist",
    "onHideQuestion",
    "onQuestion",
    "onCreatePin",
    "onPin",
    "onSaveComment",
    "onEditComment",
    "onDeleteComment",
    "onResolveComment",
    "onApprove",
    "onRequestChanges"
  ]){
    assert.match(integration,new RegExp(`\\b${hook}\\s*:`),hook);
  }
  assert.match(integration,/store\.replace\(/);
  assert.match(integration,/store\.document/);
  assert.match(integration,/renderResponsiveAdvancedBoard/);
  assert.match(integration,/theme:\s*ADVISOR_SESSION_THEME_ID/);
  assert.match(integration,/audience:\s*"EVERYTHING"/);
  assert.doesNotMatch(integration,/bridge\.state\.checks|bridge\.state\.comments|state\.comments\.push/);
});

test("active 407F CSS styles Advisor session surfaces without changing the application shell",()=>{
  const selectors=[];
  for(const match of css.matchAll(/([^{}]+)\{/g)){
    const selector=match[1].trim();
    if(/@(?:media|supports|keyframes)/.test(selector))continue;
    if(/(?:advisor-session|advisor-board|advisor-rail|advisor-checklist|advisor-questions|advisor-comments|advisor-verdict|advisor-comment-pin|student-theme-chip)/.test(selector)){
      selectors.push(...selector.split(",").map((item)=>item.trim()));
    }
  }
  assert.ok(selectors.length>=12,"expected active 407F Advisor surface rules");
  for(const selector of selectors){
    assert.match(
      selector,
      /^(?:\.advisor407FHost|\.canvas407FHost)\b/,
      `Advisor or student-pin selector must stay 407F-host scoped: ${selector}`
    );
    if(selector.startsWith(".canvas407FHost")){
      assert.match(
        selector,
        /student-advisor-comments|advisor-comment-pin|advisor-pin-popover/,
        `only student-side Advisor pins belong on Canvas: ${selector}`
      );
    }
  }
  for(const surface of [
    "advisor-session",
    "advisor-board-zone",
    "advisor-board",
    "advisor-rail",
    "advisor-checklist",
    "advisor-questions",
    "advisor-comments",
    "advisor-verdict"
  ]){
    assert.match(css,new RegExp(`\\.advisor407FHost[^,{]*\\.${surface}`),surface);
  }
  assert.doesNotMatch(css,/(?:html|body|#app|\.shell)\s*\[\s*data-advisor-theme/i);
  assert.doesNotMatch(css,/(?:html|body|#app|\.shell)\.advisor\b/i);
});
