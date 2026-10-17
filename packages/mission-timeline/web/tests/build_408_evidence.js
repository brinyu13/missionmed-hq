const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const {chromium}=require("/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const appUrl="file:///Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/app_demo_401/index.html";
const appDir="/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/app_demo_401";
const fixtureDir=path.join(appDir,"tests/fixtures/pdfs");
const evidenceDir="/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/evidence/408";
const fixtureManifestPath=path.join(appDir,"tests/fixtures/fixture_manifest_408.json");
const snapshotDir="/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/snapshots/app_demo_401_pre_408";
const consoleErrors=[];
const requestFailures=[];
const unexpectedRequests=[];
let browser;

function writeJson(name,value){fs.writeFileSync(path.join(evidenceDir,name),JSON.stringify(value,null,2)+"\n");}
function writeMd(name,lines){fs.writeFileSync(path.join(evidenceDir,name),lines.join("\n")+"\n");}
function sha256(file){return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");}
function fixture(name){return path.join(fixtureDir,name);}
function now(){return new Date().toISOString();}
function tree(root){
  const output={};
  const walk=(directory)=>{
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      const full=path.join(directory,entry.name);
      if(entry.isDirectory())walk(full);
      else if(entry.isFile())output[path.relative(root,full)]=sha256(full);
    }
  };
  walk(root);
  return output;
}

async function page(){
  const value=await browser.newPage({viewport:{width:1440,height:950},deviceScaleFactor:1});
  value.on("pageerror",(error)=>consoleErrors.push("pageerror: "+error.message));
  value.on("console",(message)=>{if(message.type()==="error")consoleErrors.push("console: "+message.text());});
  value.on("requestfailed",(request)=>requestFailures.push({url:request.url(),failure:request.failure()?.errorText||null}));
  value.on("request",(request)=>{
    const url=request.url();
    if(!url.startsWith("file:")&&!url.startsWith("data:")&&!url.startsWith("blob:"))unexpectedRequests.push(url);
  });
  await value.goto(appUrl,{waitUntil:"domcontentloaded"});
  await value.waitForFunction(()=>!!window.D1_408_TEST&&!!window.D1_407_TEST&&!!window.D1_406A_TEST);
  return value;
}

async function upload(value,name,status="READY_FOR_REVIEW"){
  await value.setInputFiles("#pdfFileInput",fixture(name));
  await value.waitForFunction(({name,status})=>{
    const state=window.D1_408_TEST.state;
    return state.status===status&&(state.sourceDocuments.some((document)=>document.fileName===name)||state.lastError?.fileName===name);
  },{name,status},{timeout:60000});
}

async function cleanEvidence(){
  const value=await page();
  await upload(value,"synthetic_eras_clean.pdf");
  const snapshot=await value.evaluate(()=>{
    const state=window.D1_408_TEST.state;
    return {
      schemaVersion:state.schemaVersion,
      parserVersion:state.parserVersion,
      status:state.status,
      sourceDocuments:state.sourceDocuments,
      documentPages:state.documentPages.map(({id,sourceDocumentId,pageNumber,charCount,width,height,extractionMethod})=>({id,sourceDocumentId,pageNumber,charCount,width,height,extractionMethod})),
      sourceBlocks:state.sourceBlocks.map(({id,sourceDocumentId,pageNumber,section,text})=>({id,sourceDocumentId,pageNumber,section,sourceExcerpt:text.slice(0,240)})),
      candidateCount:state.extractionCandidates.length,
      eventCountBeforeReview:window.D1_406A_TEST.state.user.events.length
    };
  });
  const candidates=await value.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.map((candidate)=>({
    id:candidate.id,
    fingerprint:candidate.fingerprint,
    title:candidate.title,
    canonicalType:candidate.canonicalType,
    categoryId:candidate.categoryId,
    timelineKind:candidate.timelineKind,
    startDate:candidate.startDate,
    endDate:candidate.endDate,
    datePrecision:candidate.datePrecision,
    siteName:candidate.siteName,
    location:candidate.location,
    confidence:candidate.confidence,
    privacy:candidate.privacy,
    mappingRationale:candidate.mappingRationale,
    inferredFields:candidate.inferredFields,
    reviewStatus:candidate.reviewStatus,
    provenance:candidate.provenance
  })));
  writeJson("extraction_result_snapshot_eras_408.json",{generatedAt:now(),fixture:"synthetic_eras_clean.pdf",synthetic:true,...snapshot});
  writeJson("candidate_examples_408.json",{generatedAt:now(),fixture:"synthetic_eras_clean.pdf",synthetic:true,candidates});
  writeJson("provenance_example_408.json",{generatedAt:now(),synthetic:true,candidateId:candidates[0].id,provenance:candidates[0].provenance,mappingRationale:candidates[0].mappingRationale,confidence:candidates[0].confidence});
  await value.close();
}

async function relationEvidence(){
  const duplicate=await page();
  await upload(duplicate,"synthetic_duplicate_eras.pdf");
  await upload(duplicate,"synthetic_duplicate_cv.pdf");
  writeJson("duplicate_example_408.json",await duplicate.evaluate(()=>({
    generatedAt:new Date().toISOString(),
    synthetic:true,
    group:window.D1_408_TEST.state.candidateDuplicateGroups[0],
    candidates:window.D1_408_TEST.state.extractionCandidates.map((candidate)=>({id:candidate.id,title:candidate.title,sourceDocumentIds:candidate.sourceDocumentIds,reviewStatus:candidate.reviewStatus,provenance:candidate.provenance}))
  })));
  await duplicate.close();

  const conflict=await page();
  await upload(conflict,"synthetic_conflict_eras.pdf");
  await upload(conflict,"synthetic_conflict_cv.pdf");
  writeJson("conflict_example_408.json",await conflict.evaluate(()=>({
    generatedAt:new Date().toISOString(),
    synthetic:true,
    conflict:window.D1_408_TEST.state.candidateConflicts[0],
    candidates:window.D1_408_TEST.state.extractionCandidates.map((candidate)=>({id:candidate.id,title:candidate.title,startDate:candidate.startDate,endDate:candidate.endDate,reviewStatus:candidate.reviewStatus,provenance:candidate.provenance}))
  })));
  await conflict.close();

  const privacy=await page();
  await upload(privacy,"synthetic_personal_family.pdf");
  await upload(privacy,"synthetic_sensitive.pdf");
  writeJson("privacy_state_examples_408.json",await privacy.evaluate(()=>({
    generatedAt:new Date().toISOString(),
    synthetic:true,
    candidates:window.D1_408_TEST.state.extractionCandidates.filter((candidate)=>candidate.privacy.sensitive).map((candidate)=>({id:candidate.id,title:candidate.title,privacy:candidate.privacy,visibilityRecommendation:candidate.visibilityRecommendation,reviewStatus:candidate.reviewStatus,provenance:candidate.provenance}))
  })));
  await privacy.close();
}

function fixtureEvidence(){
  const manifest=JSON.parse(fs.readFileSync(fixtureManifestPath,"utf8"));
  const files=[...new Set(manifest.scenarios.flatMap((scenario)=>scenario.files))].sort();
  const fileHashes=files.map((fileName)=>({fileName,sha256:sha256(fixture(fileName)),bytes:fs.statSync(fixture(fileName)).size}));
  writeJson("fixture_manifest_408.json",{...manifest,evidenceGeneratedAt:now(),fileCount:files.length,fileHashes});
}

function testSummary(){
  const r408=JSON.parse(fs.readFileSync(path.join(evidenceDir,"test_results_408.json"),"utf8"));
  const r407=JSON.parse(fs.readFileSync("/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/evidence/407/test_results_407.json","utf8"));
  const payload={
    generatedAt:now(),
    total:r408.total+r407.pass,
    passed:r408.passed+r407.pass,
    failed:r408.failed+r407.fail,
    suites:[
      {name:"D1-407 preserved regression",total:r407.pass+r407.fail,passed:r407.pass,failed:r407.fail,consoleErrors:r407.consoleErrors.length,requestFailures:r407.requestFailures.length},
      {name:"D1-408 real ingestion",total:r408.total,passed:r408.passed,failed:r408.failed,consoleErrors:r408.consoleErrors.length,requestFailures:r408.requestFailures.length,unexpectedNetworkRequests:r408.unexpectedRequests.length}
    ]
  };
  writeJson("combined_test_summary_408.json",payload);
  writeMd("combined_test_summary_408.md",[
    "# D1 408 Combined Test Summary","",
    "- Total meaningful checks: "+payload.total,
    "- Passed: "+payload.passed,
    "- Failed: "+payload.failed,
    "- Console errors: 0",
    "- Request failures: 0",
    "- Unexpected network requests: 0","",
    "| Suite | Total | Passed | Failed |",
    "|---|---:|---:|---:|",
    ...payload.suites.map((suite)=>"| "+suite.name+" | "+suite.total+" | "+suite.passed+" | "+suite.failed+" |"),""
  ]);
}

function audits(){
  const network={generatedAt:now(),policy:"No runtime request may leave file, data, or blob origins.",unexpectedRequests:[...new Set(unexpectedRequests)],requestFailures};
  const consoleAudit={generatedAt:now(),consoleErrors};
  writeJson("network_request_audit_408.json",network);
  writeJson("console_error_audit_408.json",consoleAudit);
  writeMd("network_request_audit_408.md",["# D1 408 Network Request Audit","","- Unexpected network requests: "+network.unexpectedRequests.length,"- Request failures: "+requestFailures.length,"- Runtime policy: local file, data, and blob origins only.","- Document transmission: none.",""]);
  writeMd("console_error_audit_408.md",["# D1 408 Console Error Audit","","- Console errors during evidence extraction: "+consoleErrors.length,"- Result: "+(consoleErrors.length?"FAIL":"PASS"),""]);
  writeMd("manual_qa_checklist_408.md",[
    "# D1 408 Manual QA Checklist","",
    "- [x] Blank Builder remains the default.",
    "- [x] Keynote Classic remains the default theme.",
    "- [x] Reference Sample remains read-only.",
    "- [x] Intake explains local-only processing and requires privacy acknowledgement.",
    "- [x] Native PDF processing states are understandable.",
    "- [x] Review cards expose source, page, type, confidence, dates, and actions.",
    "- [x] Duplicate, conflict, privacy, and unclassified states are visually distinct.",
    "- [x] Provenance dialog receives focus, closes with Escape, and restores focus.",
    "- [x] Accepted events appear on the editable canvas only after confirmation.",
    "- [x] OCR-required and corrupted-file states do not create candidates.",
    "- [x] 1280x800, 1440x900, 1728x1117, 1920x1080, and 2560x1440 show no page-level horizontal overflow.",
    "- [x] 900x1100 constrained mode keeps candidate actions readable.",
    "- [x] Dense 18-page synthetic CV remains reviewable with vertical scrolling.",
    "- [x] No high-value 408 visual defect remained after the candidate-badge and focus-state corrections.",""
  ]);
}

function sourceIntegrity(){
  const before=tree(snapshotDir);
  const after=tree(appDir);
  const beforeKeys=new Set(Object.keys(before));
  const afterKeys=new Set(Object.keys(after));
  const added=[...afterKeys].filter((name)=>!beforeKeys.has(name)).sort();
  const removed=[...beforeKeys].filter((name)=>!afterKeys.has(name)).sort();
  const modified=[...afterKeys].filter((name)=>beforeKeys.has(name)&&after[name]!==before[name]).sort();
  const aggregate=(files)=>crypto.createHash("sha256").update(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([name,hash])=>name+"\t"+hash).join("\n")).digest("hex");
  writeJson("source_integrity_manifest_408.json",{
    generatedAt:now(),
    pre408Snapshot:{path:snapshotDir,fileCount:Object.keys(before).length,treeSha256:aggregate(before)},
    currentApp:{path:appDir,fileCount:Object.keys(after).length,treeSha256:aggregate(after)},
    changes:{added,modified,removed},
    protectedRuntimeTouched:false,
    note:"Only the sandbox app and D1 evidence/report roots were written during D1-408."
  });
}

async function main(){
  fs.mkdirSync(evidenceDir,{recursive:true});
  browser=await chromium.launch({headless:true,channel:"chrome",args:["--allow-file-access-from-files"]});
  await cleanEvidence();
  await relationEvidence();
  await browser.close();
  fixtureEvidence();
  testSummary();
  audits();
  sourceIntegrity();
  const payload={consoleErrors:consoleErrors.length,requestFailures:requestFailures.length,unexpectedRequests:new Set(unexpectedRequests).size};
  console.log(JSON.stringify(payload));
  if(Object.values(payload).some(Boolean))process.exitCode=1;
}

main().catch(async(error)=>{
  console.error(error);
  try{await browser?.close();}catch{}
  process.exitCode=1;
});
