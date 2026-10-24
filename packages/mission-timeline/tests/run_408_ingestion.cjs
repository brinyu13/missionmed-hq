const fs=require("fs");
const path=require("path");
const {chromium}=require("/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const appUrl="file:///Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/app_demo_401/index.html";
const fixtureDir="/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/app_demo_401/tests/fixtures/pdfs";
const evidenceDir="/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/evidence/408";
fs.mkdirSync(evidenceDir,{recursive:true});

const results=[];
const consoleErrors=[];
const requestFailures=[];
const unexpectedRequests=[];
const screenshots=[];
let browser;

function fixture(name){return path.join(fixtureDir,name);}
function out(name){return path.join(evidenceDir,name);}
function assert(condition,message){if(!condition)throw new Error(message);}
async function test(name,fn){
  try{const notes=await fn();results.push({name,status:"PASS",notes:notes||""});}
  catch(error){results.push({name,status:"FAIL",notes:error?.message||String(error)});}
}
async function launchPage(viewport={width:1440,height:950}){
  const context=await browser.newContext({viewport,deviceScaleFactor:1});
  const page=await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror",(error)=>consoleErrors.push("pageerror: "+error.message));
  page.on("console",(message)=>{if(message.type()==="error")consoleErrors.push("console: "+message.text());});
  page.on("requestfailed",(request)=>requestFailures.push({url:request.url(),failure:request.failure()?.errorText}));
  page.on("request",(request)=>{
    const url=request.url();
    if(!url.startsWith("file:")&&!url.startsWith("data:")&&!url.startsWith("blob:"))unexpectedRequests.push(url);
  });
  await page.goto(appUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>!!window.D1_408_TEST&&!!window.D1_407_TEST&&!!window.D1_406A_TEST);
  return page;
}
async function nav(page,view){
  await page.click('#rail .rtab[data-v="'+view+'"]');
  await page.waitForFunction((target)=>document.querySelector('section[data-view="'+target+'"]')?.classList.contains("live"),view);
}
async function snap(page,name,label,fullPage=false){
  const target=out(name);
  await page.screenshot({path:target,fullPage});
  screenshots.push({label,filename:name,path:target,viewport:page.viewportSize()});
}
async function upload(page,name,expected="READY_FOR_REVIEW"){
  await page.setInputFiles("#pdfFileInput",fixture(name));
  await page.waitForFunction(({fileName,status})=>{
    const state=window.D1_408_TEST.state;
    return state.sourceDocuments.some((document)=>document.fileName===fileName&&state.status===status)
      ||state.lastError?.fileName===fileName&&state.status===status;
  },{fileName:name,status:expected},{timeout:40000});
}
async function stateSummary(page){
  return page.evaluate(()=>({
    status:window.D1_408_TEST.state.status,
    documents:window.D1_408_TEST.state.sourceDocuments.length,
    pages:window.D1_408_TEST.state.documentPages.length,
    blocks:window.D1_408_TEST.state.sourceBlocks.length,
    candidates:window.D1_408_TEST.state.extractionCandidates.length,
    duplicates:window.D1_408_TEST.state.candidateDuplicateGroups.length,
    conflicts:window.D1_408_TEST.state.candidateConflicts.length,
    events:window.D1_406A_TEST.state.user.events.length
  }));
}

async function runPureTests(page){
  await test("408 API exposes versioned schema",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.schemaVersion==="d1-ingestion-408.1"),"schema missing"));
  await test("PDF.js is vendored locally",async()=>assert(await page.evaluate(()=>[...document.scripts].every((script)=>!script.src||script.src.startsWith("file:"))),"remote script found"));
  await test("blank builder remains default",async()=>assert(await page.evaluate(()=>window.D1_406A_TEST.state.mode==="blank"&&window.D1_406A_TEST.state.user.events.length===0),"blank default regressed"));
  await test("Keynote Classic remains default",async()=>assert(await page.evaluate(()=>window.D1_406A_TEST.state.canvasTheme==="keynote"),"theme regressed"));
  await test("reference remains read-only",async()=>{await nav(page,"reference");assert(await page.locator("#boardReference .ah").count()===0,"reference is editable");});
  await test("Review workspace is reachable",async()=>{await nav(page,"review");assert(await page.locator('section[data-view="review"].live').count()===1,"review nav missing");});

  const documentCases=[
    ["document type detects ERAS","ERAS APPLICATION\nAAMC ID: SYNTHETIC\nExperience Type: Work","eras"],
    ["document type detects CV","CURRICULUM VITAE\nEDUCATION\nRESEARCH EXPERIENCE","cv"],
    ["document type detects resume","PROFESSIONAL SUMMARY\nEMPLOYMENT HISTORY\nSKILLS","resume"],
    ["document type preserves unknown fallback","Chronology fragments without standard headings","unknown"]
  ];
  for(const [name,text,expected] of documentCases)await test(name,async()=>assert(await page.evaluate(({text,expected})=>window.D1_408_TEST.pure.detectDocumentType(text).detectedType===expected,{text,expected}),"wrong detected type"));
  await test("declared/detected type mismatch is recorded",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.pure.detectDocumentType("CURRICULUM VITAE\nEDUCATION","eras").mismatch===true),"mismatch missing"));

  const pointCases=[
    ["MM/YYYY normalization","06/2021","2021-06","MONTH"],
    ["full month normalization","June 2021","2021-06","MONTH"],
    ["abbreviated month normalization","Sep 2022","2022-09","MONTH"],
    ["day precision normalization","06/15/2021","2021-06","DAY"],
    ["ISO month normalization","2021-06","2021-06","MONTH"],
    ["year-only precision preserved","2019","2019-01","YEAR"],
    ["present remains open-ended","Present",null,"OPEN_ENDED"]
  ];
  for(const [name,raw,month,precision] of pointCases)await test(name,async()=>assert(await page.evaluate(({raw,month,precision})=>{const point=window.D1_408_TEST.pure.parseDatePoint(raw);return point.timelineMonth===month&&point.precision===precision;},{raw,month,precision}),"date point mismatch"));
  await test("year-only source is marked inferred",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.pure.parseDatePoint("2019").inferred===true),"year precision lost"));
  await test("seasonal range expands with explicit season precision",async()=>assert(await page.evaluate(()=>{const range=window.D1_408_TEST.pure.normalizeDateRange("Spring 2021");return range.start.timelineMonth==="2021-03"&&range.end.timelineMonth==="2021-05"&&range.inferred;}),"season range wrong"));
  await test("late-year wording remains vague",async()=>assert(await page.evaluate(()=>{const range=window.D1_408_TEST.pure.normalizeDateRange("late 2020");return range.start.precision==="VAGUE_RANGE"&&range.end.timelineMonth==="2020-12";}),"vague date wrong"));
  await test("open-ended range is preserved",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.pure.normalizeDateRange("June 2021 - Present").openEnded===true),"present range closed"));
  await test("end-before-start is invalid",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.pure.normalizeDateRange("June 2022 - May 2021").validOrder===false),"bad order accepted"));
  await test("unknown date is not fabricated",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.pure.parseDatePoint("sometime later").timelineMonth===null),"unknown date fabricated"));

  const headings=[["EDUCATION","education"],["RESEARCH EXPERIENCE","research"],["VISA STATUS","visa_status"],["NOT A STANDARD HEADING",null]];
  for(const [line,expected] of headings)await test("section heading "+line,async()=>assert(await page.evaluate(({line,expected})=>window.D1_408_TEST.pure.classifyHeading(line)===expected,{line,expected}),"heading classification mismatch"));
  await test("section blocks preserve page numbers",async()=>assert(await page.evaluate(()=>{const page={id:"doc:page:2",sourceDocumentId:"doc",pageNumber:2,lines:["EDUCATION","2017 | Medical Degree"],extractionMethod:"TEST"};const result=window.D1_408_TEST.pure.detectSections([page]);return result.blocks[0].pageNumber===2&&result.blocks[0].section==="education";}),"section provenance missing"));

  const classifierCases=[
    ["classifies Step 1",{"title":"USMLE Step 1","section":"examinations"},"STEP_1","usmle"],
    ["classifies Step 2 preparation",{"title":"Step 2 CK Preparation","section":"examinations"},"USMLE_STUDY_PERIOD","usmle"],
    ["classifies ECFMG",{"title":"ECFMG Certified","section":"certifications"},"ECFMG_CERTIFICATION","usmle"],
    ["classifies hospital USCE",{"title":"Internal Medicine Observership","organization":"Teaching Hospital","section":"experiences"},"OBSERVERSHIP","th"],
    ["classifies clinic USCE",{"title":"Family Medicine Observership","organization":"Harbor Clinic","section":"experiences"},"OBSERVERSHIP","cl"],
    ["classifies research",{"title":"Research Assistant","section":"research"},"RESEARCH_EXPERIENCE","res"],
    ["classifies publication",{"title":"Published Journal Article","section":"publications"},"PUBLICATION","res"],
    ["classifies personal context",{"title":"Parental leave for family reasons","section":"personal"},"PERSONAL_NOT_ON_CV","personal"],
    ["uses unclassified fallback",{"title":"Unlabeled chronology item","section":"unknown"},"UNCLASSIFIED","work"]
  ];
  for(const [name,record,type,category] of classifierCases)await test(name,async()=>assert(await page.evaluate(({record,type,category})=>{const value=window.D1_408_TEST.pure.classifyEvent(record,window.D1_408_TEST.pure.normalizeDateRange("June 2021"));return value.canonicalType===type&&value.categoryId===category;},{record,type,category}),"classification mismatch"));

  const privacyCases=[
    ["flags family context","Parental leave for daughter","FAMILY"],
    ["flags immigration context","Green card and visa milestone","IMMIGRATION"],
    ["flags health context","Medical leave for a health condition","HEALTH"]
  ];
  for(const [name,title,flag] of privacyCases)await test(name,async()=>assert(await page.evaluate(({title,flag})=>{const result=window.D1_408_TEST.pure.detectPrivacy({title});return result.sensitive&&result.flags.includes(flag);},{title,flag}),"privacy flag missing"));
  await test("neutral work entry is not privacy-sensitive",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.pure.detectPrivacy({title:"Medical Scribe"}).sensitive===false),"false privacy flag"));

  await test("file inspector rejects non-PDF extension",async()=>assert(await page.evaluate(async()=>{try{await window.D1_408_TEST.pure.inspectFile(new File(["text"],"notes.txt",{type:"text/plain"}));return false;}catch(error){return error.code==="UNSUPPORTED_FILE";}}),"non-PDF accepted"));
  await test("file inspector rejects invalid PDF signature",async()=>assert(await page.evaluate(async()=>{try{await window.D1_408_TEST.pure.inspectFile(new File(["not a pdf"],"fake.pdf",{type:"application/pdf"}));return false;}catch(error){return error.code==="INVALID_PDF";}}),"invalid signature accepted"));
  await test("file inspector enforces local size limit",async()=>assert(await page.evaluate(async()=>{try{const size=window.D1_408_TEST.limits.MAX_FILE_BYTES+1;await window.D1_408_TEST.pure.inspectFile(new File([new Uint8Array(size)],"large.pdf",{type:"application/pdf"}));return false;}catch(error){return error.code==="FILE_TOO_LARGE";}}),"large file accepted"));
  await test("OCR adapter identifies a missing text layer",async()=>assert(await page.evaluate(()=>{const result=window.D1_408_TEST.pure.assessOcrRequirement({charCount:0,emptyPages:2,pageCount:2});return result.required&&result.status==="OCR_REQUIRED"&&result.transmission==="NONE";}),"OCR boundary missing"));
  await test("OCR adapter refuses to fabricate local text",async()=>assert(await page.evaluate(async()=>{try{await window.D1_408_TEST.pure.runLocalOcr();return false;}catch(error){return error.code==="LOCAL_OCR_NOT_CONFIGURED"&&error.details.transmission==="NONE";}}),"OCR adapter pretended to run"));
  await test("privacy acknowledgement is keyboard accessible",async()=>{await nav(page,"upload");const control=page.locator("#privOk");await control.focus();await page.keyboard.press("Space");assert(await control.getAttribute("aria-pressed")==="false","privacy pressed state did not change");await page.keyboard.press("Space");assert(await control.getAttribute("aria-pressed")==="true","privacy acknowledgement did not restore");});
}

async function runErasAndReviewTests(){
  const page=await launchPage();
  await nav(page,"upload");
  await snap(page,"intake_empty_408.png","Document Intake empty");
  await upload(page,"synthetic_eras_clean.pdf");
  await test("native ERAS PDF reaches review",async()=>assert((await stateSummary(page)).status==="READY_FOR_REVIEW","ERAS not ready"));
  await test("ERAS source hash is SHA-256",async()=>assert(await page.evaluate(()=>/^[a-f0-9]{64}$/.test(window.D1_408_TEST.state.sourceDocuments[0].sha256)),"hash missing"));
  await test("ERAS type is detected separately",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.sourceDocuments[0].detectedType==="eras"),"ERAS detection failed"));
  await test("ERAS page count is preserved",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.sourceDocuments[0].pageCount===3&&window.D1_408_TEST.state.documentPages.length===3),"page model wrong"));
  await test("per-page text extraction is nonempty",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.documentPages.every((page)=>page.charCount>100)),"empty extracted page"));
  await test("source blocks retain page and section",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.sourceBlocks.every((block)=>block.pageNumber>0&&block.section&&block.sourceDocumentId)),"block provenance missing"));
  await test("clean ERAS produces eight candidates",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.length===8),"candidate count mismatch"));
  await test("no candidate bypasses review",async()=>assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length===0&&window.D1_408_TEST.state.extractionCandidates.every((candidate)=>candidate.reviewStatus==="PENDING")),"review bypass detected"));
  await test("every ERAS candidate has provenance",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.every((candidate)=>candidate.provenance.length>0)),"provenance missing"));
  await test("candidate provenance has exact page and excerpt",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.flatMap((candidate)=>candidate.provenance).every((item)=>item.pageNumber>0&&item.sourceExcerpt&&item.fileName)),"provenance fields missing"));
  await test("medical degree taxonomy extracted",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.some((candidate)=>candidate.canonicalType==="MEDICAL_DEGREE")),"medical degree missing"));
  await test("Step 2 CK taxonomy extracted",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.some((candidate)=>candidate.canonicalType==="STEP_2_CK")),"Step 2 CK missing"));
  await test("USCE site and location extracted",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.some((candidate)=>candidate.canonicalType==="OBSERVERSHIP"&&/Starlight/.test(candidate.siteName)&&/Newark/.test(candidate.location))),"USCE site missing"));
  await test("confidence is factor-based",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.every((candidate)=>candidate.confidence.factors.length>=5&&Number.isFinite(candidate.confidence.score))),"confidence factors missing"));
  await nav(page,"review");
  await snap(page,"extraction_review_populated_408.png","Extraction Review populated",true);
  await test("candidate cards render",async()=>assert(await page.locator("[data-candidate-card]").count()===8,"candidate cards missing"));
  await test("provenance drawer opens",async()=>{await page.locator('[data-408-action="provenance"]').first().click();await page.waitForSelector("#modalBk.on .provRow");assert(await page.locator("#modalBk.on .provRow").count()>0,"provenance modal missing");});
  await test("provenance modal receives keyboard focus",async()=>{await page.waitForFunction(()=>document.activeElement?.id==="provClose408");assert(await page.evaluate(()=>document.activeElement?.id==="provClose408"),"modal focus missing");});
  await snap(page,"provenance_drawer_408.png","Provenance drawer");
  await test("Escape closes provenance and restores opener focus",async()=>{await page.keyboard.press("Escape");assert(await page.locator("#modalBk.on").count()===0,"Escape did not close modal");assert(await page.evaluate(()=>document.activeElement?.dataset?.["408Action"]==="provenance"),"focus was not restored");});

  const firstId=await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates[0].id);
  await test("accept creates exactly one TimelineEvent",async()=>{const before=await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length);await page.evaluate((id)=>window.D1_408_TEST.acceptCandidate(id,{visibility:"INTERVIEWER_SAFE"}),firstId);const after=await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length);assert(after===before+1,"accept did not create one event");});
  await test("accepted event keeps candidate link",async()=>assert(await page.evaluate((id)=>window.D1_406A_TEST.state.user.events.some((event)=>event.sourceCandidateId===id&&event.provenance.length>0),firstId),"candidate link missing"));
  await test("accepted event creates provenance links",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.timelineEventSourceLinks.length>0),"event source links missing"));
  const secondId=await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates[1].id);
  await test("reject creates no event",async()=>{const before=await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length);await page.evaluate((id)=>window.D1_408_TEST.rejectCandidate(id),secondId);assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length)===before,"reject created event");});
  await test("rejected candidate records final action",async()=>assert(await page.evaluate((id)=>{const candidate=window.D1_408_TEST.state.extractionCandidates.find((item)=>item.id===id);return candidate.reviewStatus==="REJECTED"&&candidate.finalHumanAction.action==="REJECT";},secondId),"reject action missing"));
  const thirdId=await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates[2].id);
  await test("manual edit preserves original extraction",async()=>{await page.evaluate((id)=>window.D1_408_TEST.editCandidate(id,{title:"Step 1 Confirmed",categoryId:"personal",startDate:"2021-02",endDate:"2021-03",siteName:"Confirmed Test Center",organization:"Confirmed Test Center"}),thirdId);assert(await page.evaluate((id)=>{const candidate=window.D1_408_TEST.state.extractionCandidates.find((item)=>item.id===id);return candidate.title==="Step 1 Confirmed"&&candidate.humanCorrection.originalExtraction.rawText;},thirdId),"edit provenance lost");});
  await test("category correction is retained",async()=>assert(await page.evaluate((id)=>window.D1_408_TEST.state.extractionCandidates.find((item)=>item.id===id).categoryId==="personal",thirdId),"category correction lost"));
  await test("date correction is retained",async()=>assert(await page.evaluate((id)=>{const candidate=window.D1_408_TEST.state.extractionCandidates.find((item)=>item.id===id);return candidate.startDate==="2021-02"&&candidate.endDate==="2021-03";},thirdId),"date correction lost"));
  await test("organization correction is retained",async()=>assert(await page.evaluate((id)=>window.D1_408_TEST.state.extractionCandidates.find((item)=>item.id===id).siteName==="Confirmed Test Center",thirdId),"organization correction lost"));
  await test("accept-all only accepts eligible candidates",async()=>{const result=await page.evaluate(()=>window.D1_408_TEST.acceptAllSafeHighConfidence());assert(result.accepted>0,"nothing accepted");assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.filter((candidate)=>candidate.reviewStatus==="PENDING"&&candidate.safeToBulkAccept).length===0),"eligible candidate left pending");});
  await test("canonical TimelineDocument includes ingestion roots",async()=>assert(await page.evaluate(()=>["sourceDocuments","documentPages","sourceBlocks","extractionCandidates","humanReviewActions","timelineEventSourceLinks"].every((key)=>Array.isArray(window.D1_407_TEST.document[key]))),"document roots missing"));
  await test("rerun preserves reviewed decisions by fingerprint",async()=>{const before=await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.map((candidate)=>candidate.reviewStatus).join("|"));await page.evaluate(()=>window.D1_408_TEST.controller.rerunDocument(window.D1_408_TEST.state.activeDocumentId));await page.waitForFunction(()=>window.D1_408_TEST.state.status==="READY_FOR_REVIEW");const after=await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.map((candidate)=>candidate.reviewStatus).join("|"));assert(before===after,"rerun lost review decisions");});
  await nav(page,"canvas");
  await snap(page,"accepted_candidates_canvas_408.png","Accepted candidates on editable canvas");
  await test("accepted candidates appear on editable canvas",async()=>assert(await page.locator("#boardMain .kcArrow,#boardMain .kcFlag").count()>0,"accepted events not rendered"));
  const documentId=await page.evaluate(()=>window.D1_408_TEST.state.activeDocumentId);
  await test("document removal preview identifies candidates and events",async()=>assert(await page.evaluate((id)=>{const impact=window.D1_408_TEST.previewDocumentRemoval(id);return impact.candidateCount===8&&impact.eventCount>0;},documentId),"removal impact incomplete"));
  await test("confirmed source removal retains accepted events",async()=>{const before=await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length);await page.evaluate((id)=>window.D1_408_TEST.removeDocument(id,{confirmed:true}),documentId);assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length)===before,"events silently removed");});
  await test("removed source links are marked",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.timelineEventSourceLinks.some((link)=>link.sourceRemoved)),"removed links not marked"));
  await page.close();
}

async function runCvResumeTests(){
  const cv=await launchPage();
  await nav(cv,"upload");
  await cv.click('#docTypes [data-doc="cv"]');
  await upload(cv,"synthetic_cv_clean.pdf");
  await test("traditional CV stores declared and detected type",async()=>assert(await cv.evaluate(()=>{const source=window.D1_408_TEST.state.sourceDocuments[0];return source.userDeclaredType==="cv"&&source.detectedType==="cv";}),"CV type contract wrong"));
  await test("traditional CV uses the CV parser path",async()=>assert(await cv.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.some((candidate)=>candidate.canonicalType==="MEDICAL_DEGREE")&&window.D1_408_TEST.state.extractionCandidates.some((candidate)=>candidate.canonicalType==="RESEARCH_EXPERIENCE")),"CV chronology missing"));
  await test("traditional CV candidates remain quarantined",async()=>assert(await cv.evaluate(()=>window.D1_406A_TEST.state.user.events.length===0&&window.D1_408_TEST.state.extractionCandidates.every((candidate)=>candidate.reviewStatus==="PENDING")),"CV bypassed review"));
  await cv.close();

  const resume=await launchPage();
  await nav(resume,"upload");
  await resume.click('#docTypes [data-doc="resume"]');
  await upload(resume,"synthetic_resume.pdf");
  await test("resume stores declared and detected type",async()=>assert(await resume.evaluate(()=>{const source=window.D1_408_TEST.state.sourceDocuments[0];return source.userDeclaredType==="resume"&&source.detectedType==="resume";}),"resume type contract wrong"));
  await test("resume parser produces work chronology",async()=>assert(await resume.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.some((candidate)=>candidate.canonicalType==="WORK_EXPERIENCE")),"resume work missing"));
  await test("resume provenance remains page scoped",async()=>assert(await resume.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.every((candidate)=>candidate.provenance.every((item)=>item.pageNumber>0&&item.sourceDocumentId))),"resume provenance missing"));
  await resume.close();
}

async function runDocumentTypeCorrectionTests(){
  const page=await launchPage();
  await nav(page,"upload");
  await page.click('#docTypes [data-doc="cv"]');
  await upload(page,"synthetic_eras_clean.pdf");
  await test("declared and detected document types remain distinct",async()=>assert(await page.evaluate(()=>{const source=window.D1_408_TEST.state.sourceDocuments[0];return source.userDeclaredType==="cv"&&source.detectedType==="eras"&&source.effectiveType==="cv"&&source.typeDetection.mismatch;}),"type distinction missing"));
  await test("explicit user type controls the parser without overwriting detection",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.sourceDocuments[0].typeConfirmedByUser===true),"user type was not confirmed"));
  const documentId=await page.evaluate(()=>window.D1_408_TEST.state.sourceDocuments[0].id);
  await nav(page,"upload");
  await page.selectOption('[data-source-type="'+documentId+'"]',"eras");
  await page.waitForFunction((id)=>{const source=window.D1_408_TEST.state.sourceDocuments.find((document)=>document.id===id);return window.D1_408_TEST.state.status==="READY_FOR_REVIEW"&&source?.effectiveType==="eras"&&source?.typeCorrectionHistory?.length===1;},documentId);
  await test("post-detection type correction re-runs only the local source",async()=>assert(await page.evaluate((id)=>{const source=window.D1_408_TEST.state.sourceDocuments.find((document)=>document.id===id);return source.detectedType==="eras"&&source.effectiveType==="eras"&&source.userDeclaredType==="eras"&&source.typeCorrectionHistory[0].from==="cv";},documentId),"type correction did not persist"));
  await test("type correction keeps all candidates quarantined",async()=>assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length===0&&window.D1_408_TEST.state.extractionCandidates.every((candidate)=>candidate.reviewStatus==="PENDING")),"type correction bypassed review"));
  await page.locator("#sourceDocList").scrollIntoViewIfNeeded();
  await snap(page,"intake_source_type_correction_408.png","Source type correction");
  await page.close();
}

async function runActionMatrixTests(){
  const page=await launchPage();
  await upload(page,"synthetic_eras_clean.pdf");
  const matrix=[
    ["INTERVIEWER_SAFE","public"],
    ["FULL_STORY","full"],
    ["ADVISOR_ONLY","advisor"],
    ["STUDENT_ONLY","student"],
    ["HIDDEN","hidden"]
  ];
  const candidateIds=await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.slice(0,6).map((candidate)=>candidate.id));
  for(let index=0;index<matrix.length;index++){
    const [visibility,legacy]=matrix[index];
    await test("accept supports "+visibility+" visibility",async()=>assert(await page.evaluate(({id,visibility,legacy})=>{window.D1_408_TEST.setCandidateVisibility(id,visibility);const event=window.D1_408_TEST.acceptCandidate(id,{visibility});return window.D1_408_TEST.state.extractionCandidates.find((candidate)=>candidate.id===id).visibilityRecommendation===visibility&&event.vis===legacy;},{id:candidateIds[index],visibility,legacy}),"visibility mapping failed"));
  }
  const deferredId=candidateIds[5];
  await test("defer keeps a candidate quarantined",async()=>{const before=await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length);await page.evaluate((id)=>window.D1_408_TEST.deferCandidate(id),deferredId);assert(await page.evaluate((id)=>window.D1_408_TEST.state.extractionCandidates.find((candidate)=>candidate.id===id).reviewStatus==="DEFERRED",deferredId),"defer status missing");assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length)===before,"defer created an event");});
  await test("review progress counts accepted and deferred actions",async()=>assert(await page.evaluate(()=>{const progress=window.D1_408_TEST.reviewProgress();return progress.reviewed===6&&progress.total===8&&progress.pending===2;}),"review progress wrong"));
  await nav(page,"review");
  await page.selectOption('[data-408-filter="status"]',"ACCEPTED");
  await test("status filter isolates accepted candidates",async()=>assert(await page.locator("[data-candidate-card]").count()===5,"status filter wrong"));
  await page.selectOption('[data-408-filter="status"]',"DEFERRED");
  await test("status filter isolates deferred candidates",async()=>assert(await page.locator("[data-candidate-card]").count()===1,"deferred filter wrong"));
  await page.selectOption('[data-408-filter="status"]',"ALL");
  await page.selectOption('[data-408-filter="confidence"]',"HIGH");
  await test("confidence filter renders only high-confidence candidates",async()=>assert(await page.evaluate(()=>[...document.querySelectorAll("[data-candidate-card] .candidateHead .chip")].some((chip)=>chip.textContent.startsWith("HIGH")))&&await page.locator("[data-candidate-card]").count()>0,"confidence filter wrong"));
  await page.selectOption('[data-408-filter="confidence"]',"ALL");
  await page.selectOption('[data-408-filter="type"]',"NORMAL");
  await test("type filter isolates standard candidates",async()=>assert(await page.locator("[data-candidate-card]").count()===8,"type filter wrong"));
  await page.close();
}

async function runDuplicateTests(){
  const page=await launchPage();
  await upload(page,"synthetic_duplicate_eras.pdf");
  await upload(page,"synthetic_duplicate_cv.pdf");
  await nav(page,"review");
  await test("multi-document draft keeps sources separate",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.sourceDocuments.length===2&&new Set(window.D1_408_TEST.state.sourceDocuments.map((document)=>document.id)).size===2),"sources collapsed"));
  await test("duplicate detector creates one group",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.candidateDuplicateGroups.length===1),"duplicate group missing"));
  await test("duplicate candidates are not bulk-safe",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.every((candidate)=>!candidate.safeToBulkAccept&&candidate.candidateKind==="DUPLICATE")),"duplicate safety wrong"));
  const firstDocumentId=await page.evaluate(()=>window.D1_408_TEST.state.sourceDocuments[0].id);
  const secondSourceBefore=await page.evaluate(()=>{const id=window.D1_408_TEST.state.sourceDocuments[1].id;return {id,fingerprints:window.D1_408_TEST.state.extractionCandidates.filter((candidate)=>candidate.sourceDocumentId===id).map((candidate)=>candidate.fingerprint).sort()};});
  await test("re-running one source preserves the other source decisions",async()=>{await page.evaluate((id)=>window.D1_408_TEST.controller.rerunDocument(id),firstDocumentId);await page.waitForFunction(()=>window.D1_408_TEST.state.status==="READY_FOR_REVIEW");assert(await page.evaluate((before)=>{const source=window.D1_408_TEST.state.sourceDocuments.find((document)=>document.id===before.id);const fingerprints=window.D1_408_TEST.state.extractionCandidates.filter((candidate)=>candidate.sourceDocumentId===before.id).map((candidate)=>candidate.fingerprint).sort();return !!source&&JSON.stringify(fingerprints)===JSON.stringify(before.fingerprints);},secondSourceBefore),"other source changed during rerun");});
  await test("cross-document duplicate relation survives a single-source rerun",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.candidateDuplicateGroups.length===1),"duplicate relation lost after rerun"));
  await snap(page,"duplicate_card_408.png","Duplicate candidate card",true);
  await test("unresolved duplicate cannot be directly accepted",async()=>assert(await page.evaluate(()=>{try{window.D1_408_TEST.acceptCandidate(window.D1_408_TEST.state.extractionCandidates[0].id);return false;}catch(error){return /Resolve duplicate/.test(error.message);}}),"duplicate bypassed"));
  await test("merge produces one event with both source documents",async()=>{await page.evaluate(()=>{const group=window.D1_408_TEST.state.candidateDuplicateGroups[0];window.D1_408_TEST.mergeDuplicate(group.id,group.candidateIds[0],"INTERVIEWER_SAFE");});assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length===1&&window.D1_406A_TEST.state.user.events[0].sourceDocumentIds.length===2),"merge provenance incomplete");});
  await test("merge resolves both candidates",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.every((candidate)=>candidate.reviewStatus==="MERGED"&&candidate.resultingEventIds.length===1)),"merge status incomplete"));
  await test("merged event has provenance from both PDFs",async()=>assert(await page.evaluate(()=>new Set(window.D1_406A_TEST.state.user.events[0].provenance.map((item)=>item.fileName)).size===2),"merged provenance collapsed"));
  await page.close();

  const bothPage=await launchPage();
  await upload(bothPage,"synthetic_duplicate_eras.pdf");
  await upload(bothPage,"synthetic_duplicate_cv.pdf");
  await test("keep both creates two events",async()=>{await bothPage.evaluate(()=>window.D1_408_TEST.keepBoth(window.D1_408_TEST.state.candidateDuplicateGroups[0].id,"INTERVIEWER_SAFE"));assert(await bothPage.evaluate(()=>window.D1_406A_TEST.state.user.events.length===2),"keep both wrong");});
  await test("keep both records explicit status",async()=>assert(await bothPage.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.every((candidate)=>candidate.reviewStatus==="KEPT_BOTH")),"keep-both status missing"));
  await bothPage.close();
}

async function runConflictTests(){
  const page=await launchPage();
  await upload(page,"synthetic_conflict_eras.pdf");
  await upload(page,"synthetic_conflict_cv.pdf");
  await nav(page,"review");
  await test("Step 2 CK conflict is detected",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.candidateConflicts.length===1&&window.D1_408_TEST.state.extractionCandidates.every((candidate)=>candidate.canonicalType==="USMLE_STUDY_PERIOD")),"conflict missing"));
  await test("conflict records disagreeing fields",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.candidateConflicts[0].fields.includes("endDate")),"conflict field missing"));
  await test("conflict candidates are not bulk-safe",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.every((candidate)=>candidate.candidateKind==="CONFLICT"&&!candidate.safeToBulkAccept)),"conflict safety wrong"));
  await snap(page,"conflict_card_408.png","Conflict candidate card",true);
  await test("choose source creates one event",async()=>{await page.evaluate(()=>{const conflict=window.D1_408_TEST.state.candidateConflicts[0];window.D1_408_TEST.chooseSource(conflict.id,conflict.candidateIds[1],"INTERVIEWER_SAFE");});assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length===1),"source choice wrong");});
  await test("unselected conflict source is preserved",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.some((candidate)=>candidate.reviewStatus==="SOURCE_NOT_SELECTED"&&candidate.provenance.length>0)),"alternate source lost"));
  await test("selected conflict date reaches event",async()=>assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events[0].e==="2020-06"),"wrong source date used"));
  await test("conflict resolution is explicit",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.candidateConflicts[0].status==="RESOLVED"&&window.D1_408_TEST.state.candidateConflicts[0].selectedCandidateId),"conflict not resolved"));
  await page.close();
}

async function runPrivacyTests(){
  const page=await launchPage();
  await upload(page,"synthetic_personal_family.pdf");
  await upload(page,"synthetic_sensitive.pdf");
  await nav(page,"review");
  await test("family event is privacy-sensitive",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.some((candidate)=>candidate.privacy.flags.includes("FAMILY"))),"family flag missing"));
  await test("health event is privacy-sensitive",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.some((candidate)=>candidate.privacy.flags.includes("HEALTH"))),"health flag missing"));
  await test("immigration event is privacy-sensitive",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.some((candidate)=>candidate.privacy.flags.includes("IMMIGRATION"))),"immigration flag missing"));
  await test("sensitive candidates recommend advisor-only",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.filter((candidate)=>candidate.privacy.sensitive).every((candidate)=>candidate.visibilityRecommendation==="ADVISOR_ONLY")),"privacy visibility wrong"));
  await test("safe high-confidence bulk action skips privacy",async()=>{const before=await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length);const result=await page.evaluate(()=>window.D1_408_TEST.acceptAllSafeHighConfidence());assert(result.accepted===0&&await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length)===before,"privacy bulk accepted");});
  await snap(page,"privacy_card_408.png","Privacy review card",true);
  const privateId=await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.find((candidate)=>candidate.privacy.sensitive).id);
  await test("explicit advisor-only acceptance works",async()=>{await page.evaluate((id)=>window.D1_408_TEST.acceptCandidate(id,{visibility:"ADVISOR_ONLY"}),privateId);assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events[0].vis==="advisor"),"advisor visibility lost");});
  await test("privacy review is a flag, not medical judgment",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.every((candidate)=>candidate.privacy.legalOrMedicalJudgment===false)),"judgment flag wrong"));
  await page.close();
}

async function runEdgeFixtureTests(){
  const page=await launchPage();
  await upload(page,"synthetic_missing_date.pdf");
  await test("missing-date candidate remains quarantined",async()=>assert(await page.evaluate(()=>{const candidate=window.D1_408_TEST.state.extractionCandidates[0];return !candidate.startDate&&candidate.reviewStatus==="PENDING"&&!candidate.safeToBulkAccept;}),"missing date fabricated"));
  await test("missing-date candidate cannot be accepted",async()=>assert(await page.evaluate(()=>{try{window.D1_408_TEST.acceptCandidate(window.D1_408_TEST.state.extractionCandidates[0].id);return false;}catch(error){return /start date/.test(error.message);}}),"missing date accepted"));
  await upload(page,"synthetic_year_only.pdf");
  await test("year-only candidate retains YEAR precision",async()=>assert(await page.evaluate(()=>{const candidate=window.D1_408_TEST.state.extractionCandidates.find((item)=>item.sourceDocumentId===window.D1_408_TEST.state.activeDocumentId);return candidate.datePrecision.start==="YEAR"&&candidate.inferredFields.some((field)=>field.field==="startDate");}),"year precision lost"));
  await upload(page,"synthetic_usce_site.pdf");
  await test("USCE fixture extracts site name",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.some((candidate)=>/Harborview Teaching Hospital/.test(candidate.siteName)&&candidate.canonicalType==="OBSERVERSHIP")),"USCE site not extracted"));
  await upload(page,"synthetic_research_publication.pdf");
  await test("research-publication chain has duration and milestone",async()=>assert(await page.evaluate(()=>{const current=window.D1_408_TEST.state.extractionCandidates.filter((candidate)=>candidate.sourceDocumentId===window.D1_408_TEST.state.activeDocumentId);return current.some((candidate)=>candidate.canonicalType==="RESEARCH_EXPERIENCE"&&candidate.timelineKind==="duration")&&current.some((candidate)=>candidate.canonicalType==="PUBLICATION"&&candidate.timelineKind==="milestone");}),"research chain wrong"));
  await upload(page,"synthetic_overlap.pdf");
  await test("work and exam overlap both parse",async()=>assert(await page.evaluate(()=>{const current=window.D1_408_TEST.state.extractionCandidates.filter((candidate)=>candidate.sourceDocumentId===window.D1_408_TEST.state.activeDocumentId);return current.some((candidate)=>candidate.canonicalType==="WORK_EXPERIENCE")&&current.some((candidate)=>candidate.canonicalType==="USMLE_STUDY_PERIOD");}),"overlap events missing"));
  await upload(page,"synthetic_mixed_language.pdf");
  await test("mixed-language document preserves known English block",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.some((candidate)=>candidate.sourceDocumentId===window.D1_408_TEST.state.activeDocumentId&&candidate.canonicalType==="RESEARCH_EXPERIENCE")),"mixed document failed"));
  await upload(page,"synthetic_unknown_layout.pdf");
  await test("unknown layout uses conservative unclassified fallback",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.some((candidate)=>candidate.sourceDocumentId===window.D1_408_TEST.state.activeDocumentId&&candidate.canonicalType==="UNCLASSIFIED"&&!candidate.safeToBulkAccept)),"unknown forced into category"));
  await page.close();
}

async function runFailureTests(){
  const scanned=await launchPage();
  await upload(scanned,"synthetic_scanned_empty_text.pdf","OCR_REQUIRED");
  await test("image-only PDF reports OCR_REQUIRED",async()=>assert(await scanned.evaluate(()=>window.D1_408_TEST.state.status==="OCR_REQUIRED"),"OCR state wrong"));
  await test("OCR-required PDF creates zero candidates",async()=>assert(await scanned.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.length===0),"OCR candidate fabricated"));
  await test("OCR-required source records the local adapter boundary",async()=>assert(await scanned.evaluate(()=>{const source=window.D1_408_TEST.state.sourceDocuments[0];return source.ocr.required&&source.ocr.available===false&&source.ocr.transmission==="NONE";}),"OCR source metadata missing"));
  await nav(scanned,"upload");
  await snap(scanned,"ocr_required_408.png","OCR required state");
  await scanned.close();

  const corrupted=await launchPage();
  await upload(corrupted,"synthetic_corrupted.pdf","CORRUPTED");
  await test("corrupted PDF is rejected",async()=>assert(await corrupted.evaluate(()=>window.D1_408_TEST.state.lastError.code==="CORRUPTED_PDF"),"corrupt code wrong"));
  await test("corrupted PDF creates zero documents and candidates",async()=>assert(await corrupted.evaluate(()=>window.D1_408_TEST.state.sourceDocuments.length===0&&window.D1_408_TEST.state.extractionCandidates.length===0),"corrupt state leaked"));
  await nav(corrupted,"upload");
  await snap(corrupted,"corrupted_pdf_state_408.png","Corrupted PDF state");
  await corrupted.close();

  const password=await launchPage();
  await upload(password,"synthetic_password_protected.pdf","PASSWORD_REQUIRED");
  await test("password-protected PDF is reported honestly",async()=>assert(await password.evaluate(()=>window.D1_408_TEST.state.lastError.code==="PASSWORD_REQUIRED"),"password state wrong"));
  await test("password-protected PDF creates zero candidates",async()=>assert(await password.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.length===0),"password candidate fabricated"));
  await password.close();
}

async function runLongAndResponsiveTests(){
  const page=await launchPage({width:1440,height:900});
  await nav(page,"upload");
  const uploadPromise=page.setInputFiles("#pdfFileInput",fixture("synthetic_long_cv.pdf"));
  try{await page.waitForFunction(()=>["EXTRACTING","SECTIONING","CLASSIFYING","CANDIDATE_CREATION"].includes(window.D1_408_TEST.state.status),null,{timeout:5000});await snap(page,"intake_processing_408.png","Document Intake processing");}catch{}
  await uploadPromise;
  await page.waitForFunction(()=>window.D1_408_TEST.state.status==="READY_FOR_REVIEW",null,{timeout:60000});
  await test("long CV stays within page safety limit",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.sourceDocuments[0].pageCount===18),"long page count wrong"));
  await test("long CV extracts a dense candidate list",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.length>=150),"long candidate count too low"));
  await nav(page,"review");
  await snap(page,"dense_candidate_list_408.png","Dense candidate list",true);
  const viewports=[
    {name:"1280x800",width:1280,height:800},
    {name:"1440x900",width:1440,height:900},
    {name:"1728x1117",width:1728,height:1117},
    {name:"1920x1080",width:1920,height:1080},
    {name:"2560x1440",width:2560,height:1440},
    {name:"900x1100",width:900,height:1100}
  ];
  for(const viewport of viewports){
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await page.waitForTimeout(100);
    await snap(page,"responsive_review_"+viewport.name+"_408.png","Review "+viewport.name);
    await test("review visible at "+viewport.name,async()=>assert(await page.locator('section[data-view="review"].live').isVisible(),"review hidden"));
    await test("candidate cards fit at "+viewport.name,async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2),"horizontal page overflow"));
  }
  await page.close();
}

function writeReports(){
  const passed=results.filter((result)=>result.status==="PASS").length;
  const failed=results.length-passed;
  const payload={
    generatedAt:new Date().toISOString(),
    appUrl,
    fixtureDir,
    total:results.length,
    passed,
    failed,
    consoleErrors,
    requestFailures,
    unexpectedRequests:[...new Set(unexpectedRequests)],
    screenshots,
    results
  };
  fs.writeFileSync(out("test_results_408.json"),JSON.stringify(payload,null,2)+"\n");
  const rows=results.map((result,index)=>"| "+(index+1)+" | "+result.name.replace(/\|/g,"/")+" | "+result.status+" | "+String(result.notes||"").replace(/\|/g,"/")+" |").join("\n");
  const markdown=[
    "# D1 408 Ingestion Test Results",
    "",
    "- Total: "+results.length,
    "- Passed: "+passed,
    "- Failed: "+failed,
    "- Console errors: "+consoleErrors.length,
    "- Request failures: "+requestFailures.length,
    "- Unexpected network requests: "+new Set(unexpectedRequests).size,
    "",
    "| # | Test | Status | Notes |",
    "|---:|---|---|---|",
    rows,
    ""
  ].join("\n");
  fs.writeFileSync(out("test_results_408.md"),markdown);
  fs.writeFileSync(out("viewport_manifest_408.json"),JSON.stringify({generatedAt:new Date().toISOString(),screenshots},null,2)+"\n");
  return payload;
}

async function main(){
  browser=await chromium.launch({headless:true,channel:"chrome",args:["--allow-file-access-from-files"]});
  const purePage=await launchPage();
  await runPureTests(purePage);
  await purePage.close();
  await runErasAndReviewTests();
  await runCvResumeTests();
  await runDocumentTypeCorrectionTests();
  await runActionMatrixTests();
  await runDuplicateTests();
  await runConflictTests();
  await runPrivacyTests();
  await runEdgeFixtureTests();
  await runFailureTests();
  await runLongAndResponsiveTests();
  await test("zero console errors",async()=>assert(consoleErrors.length===0,consoleErrors.slice(0,5).join("; ")));
  await test("zero request failures",async()=>assert(requestFailures.length===0,JSON.stringify(requestFailures.slice(0,5))));
  await test("zero unexpected network requests",async()=>assert(new Set(unexpectedRequests).size===0,[...new Set(unexpectedRequests)].slice(0,5).join("; ")));
  await browser.close();
  const payload=writeReports();
  console.log(JSON.stringify({total:payload.total,passed:payload.passed,failed:payload.failed,consoleErrors:payload.consoleErrors.length,requestFailures:payload.requestFailures.length,unexpectedRequests:payload.unexpectedRequests.length,screenshots:payload.screenshots.length}));
  if(payload.failed)process.exitCode=1;
}

main().catch(async(error)=>{
  console.error(error);
  try{await browser?.close();}catch{}
  process.exitCode=1;
});
