import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  IntakeStateMachine,
  applyApprovalBatchToDocument
} from "../web/js/uxr-002/intake.js";

const webRoot=new URL("../web/",import.meta.url);
const index=await readFile(new URL("index.html",webRoot),"utf8");
const engineeringAdapter=await readFile(
  new URL("js/407f-engineering-adapter.js",webRoot),
  "utf8"
);

function sourceBetween(source,start,end){
  const from=source.indexOf(start);
  const to=source.indexOf(end,from+start.length);
  assert.ok(from>=0,`missing source marker: ${start}`);
  assert.ok(to>from,`missing source marker: ${end}`);
  return source.slice(from,to);
}

function canonicalIntakeSection(){
  return sourceBetween(
    index,
    '<section data-view="intake">',
    "<!-- ================="
  );
}

function candidate(overrides={}){
  return{
    id:"candidate-1",
    categoryId:"work",
    title:"Clinical coordinator",
    startDate:"2023-01",
    endDate:"2023-09",
    eventType:"duration",
    confidence:"high",
    sourceSnippet:"Clinical coordinator from January through September.",
    fields:{organization:"Teaching Hospital"},
    ...overrides
  };
}

test("canonical 407F provides one Intake host and removes the legacy intake and review shells",()=>{
  const intake=canonicalIntakeSection();
  assert.match(intake,/<div id="intake407F"[^>]*><\/div>/);
  assert.equal((index.match(/<section data-view="intake">/g)||[]).length,1);
  assert.doesNotMatch(index,/<section data-view="review">/);

  for(const retiredId of [
    "docTypes",
    "dropWrap",
    "dropzone",
    "parseWrap",
    "parseSteps",
    "candMeter",
    "acceptHigh",
    "candList"
  ]){
    assert.doesNotMatch(intake,new RegExp(`id="${retiredId}"`),retiredId);
  }
});

test("the Home pending-suggestions chip routes into the canonical Intake review flow",()=>{
  const home=sourceBetween(
    index,
    '<section data-view="command"',
    "<!-- ================= BUILDER"
  );
  assert.match(
    home,
    /<button class="homePending" id="homePending" data-nav="intake" hidden><\/button>/
  );
  assert.match(index,/pendingButton\.textContent=pending\+' suggestions to review'/);
});

test("the 407F engineering adapter owns IntakeStateMachine, D1-408 extraction, rendering, and installation",()=>{
  assert.match(
    engineeringAdapter,
    /import\s*\{[\s\S]*\bIntakeStateMachine\b[\s\S]*\bapplyApprovalBatchToDocument\b[\s\S]*\binstallIntake(?:\s+as\s+\w+)?\b[\s\S]*\brenderIntake(?:\s+as\s+\w+)?\b[\s\S]*\}\s*from\s*"\.\/uxr-002\/intake\.js"/
  );
  assert.match(
    engineeringAdapter,
    /import\s*\{\s*createD1408PdfIntakeAdapter\s*\}\s*from\s*"\.\/uxr-002\/intake-d1-408-adapter\.js"/
  );
  assert.match(engineeringAdapter,/new IntakeStateMachine\s*\(/);
  assert.match(engineeringAdapter,/createD1408PdfIntakeAdapter\s*\(/);
  assert.match(engineeringAdapter,/\brenderIntake(?:Screen)?\s*\(/);
  assert.match(engineeringAdapter,/\binstallIntake(?:Screen)?\s*\(/);
  assert.match(engineeringAdapter,/document\.getElementById\("intake407F"\)/);
});

test("approval makes one automatic pre-import version before one atomic timeline batch",async()=>{
  const adapter={
    capability:{
      mode:"d1-408-test-double",
      productionReady:false,
      simulated:false,
      source:"bounded-test"
    },
    async extract(){
      return{readable:true,candidates:[candidate()]};
    }
  };
  const machine=new IntakeStateMachine({
    adapter,
    clock:()=>new Date("2026-07-29T16:00:00.000Z"),
    idFactory:(prefix)=>`${prefix}-generated`
  });
  machine.receiveFile({
    name:"Timeline_CV.pdf",
    type:"application/pdf",
    size:1024,
    lastModified:1
  });
  machine.setConsent(true);
  await machine.startExtraction();
  machine.decideCandidate("candidate-1","accepted");

  const document={events:[],intake:{}};
  const calls=[];
  await machine.approveAccepted({
    async saveVersion(name,kind){
      calls.push({type:"version",name,kind,eventCount:document.events.length});
    },
    async applyBatch(batch,contract){
      calls.push({type:"batch",contract,eventCount:document.events.length});
      return applyApprovalBatchToDocument(document,batch);
    }
  });

  assert.deepEqual(calls.map(({type})=>type),["version","batch"]);
  assert.deepEqual(calls[0],{
    type:"version",
    name:"Before CV import · Jul 29, 2026",
    kind:"automatic",
    eventCount:0
  });
  assert.deepEqual(calls[1].contract,{
    label:"Add document suggestions",
    history:true,
    undoSteps:1
  });
  assert.equal(document.events.length,1);
  assert.equal(machine.state.approval.versionSaved,true);
  assert.equal(machine.state.approval.applied,true);

  const integration=sourceBetween(
    engineeringAdapter,
    "saveVersion:",
    "deleteSource:"
  );
  assert.equal((integration.match(/\bsaveVersion\s*\(/g)||[]).length,1);
  assert.equal(
    (integration.match(/\bapplyApprovalBatchToDocument\s*\(/g)||[]).length,
    1
  );
});

test("active 407F Intake copy makes no fixture, simulated, or pipeline claims",()=>{
  const visibleIntake=canonicalIntakeSection();
  assert.doesNotMatch(visibleIntake,/\bfixture(?:s)?\b/i);
  assert.doesNotMatch(visibleIntake,/\bsimulat(?:e|ed|ion)\b/i);
  assert.doesNotMatch(visibleIntake,/\bpipeline\b/i);
});
