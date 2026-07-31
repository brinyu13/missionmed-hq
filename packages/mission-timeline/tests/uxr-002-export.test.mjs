import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_EXPORT_AUDIENCE,
  DEFAULT_EXPORT_FORMAT_ID,
  EXPORT_AUDIENCES,
  EXPORT_FORMATS,
  EXPORT_PREVIEW_LOADING_MAX_MS,
  EXPORT_PRINT_MARGIN_MM,
  PRINT_GUIDANCE_COPY,
  audienceDetailsComplete,
  buildAdvisorReviewRequest,
  buildExportFilename,
  buildExportPreviewInput,
  buildExportRequest,
  buildExportScreenModel,
  executeExportRequest,
  filterEventsForAudience,
  installExportScreen,
  normalizeExportState,
  parseStudentName,
  planAdvisorPaperPdfSuggestion,
  reduceExportState,
  refreshExportPreview,
  renderExportScreen
} from "../web/js/uxr-002/export-screen.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";

const fixedNow=new Date("2026-07-29T16:00:00.000Z");

function event(id,visibilityState="INTERVIEWER_SAFE"){
  return{
    id,
    title:id,
    categoryId:"education",
    eventType:"duration",
    startDate:"2021-01",
    endDate:"2025-05",
    visibilityState
  };
}

function fixture(){
  const document=defaultDocument();
  document.id="timeline-amara";
  document.studentProfile.fullName="Amara Osei";
  document.studentProfile.interviewSeason="2026-01";
  document.events=[
    event("safe-one"),
    {
      ...event("advisor-one","ADVISOR_ONLY"),
      fields:{exportAudiences:["LOR_WRITER"]}
    },
    event("safe-two")
  ];
  return document;
}

const lorDetails={
  LOR_WRITER:{
    writerName:"Dr. Maya Chen",
    titlePosition:"Program Director",
    institution:"Mission University Hospital",
    specialty:"Pediatrics",
    relationship:"Rotation supervisor",
    understanding:"Clinical growth and service commitment"
  }
};

test("M10 preserves Interview-safe default and defines four explicit recipient audiences",()=>{
  assert.equal(DEFAULT_EXPORT_AUDIENCE,"INTERVIEWER_SAFE");
  assert.deepEqual(EXPORT_AUDIENCES.map(({label})=>label),[
    "Interview-safe",
    "LOR writer",
    "Professional connection",
    "Mission Residency alumni connection"
  ]);
  assert.equal(EXPORT_AUDIENCES.some(({id})=>id==="EVERYTHING"),false);
  assert.equal(audienceDetailsComplete("INTERVIEWER_SAFE",{}),true);
  assert.equal(audienceDetailsComplete("LOR_WRITER",lorDetails),true);
  assert.equal(audienceDetailsComplete("LOR_WRITER",{}),false);
  assert.equal(DEFAULT_EXPORT_FORMAT_ID,"png-1920x1080");
  assert.equal(EXPORT_FORMATS.length,4);
  assert.deepEqual(EXPORT_FORMATS.map(({label})=>label),[
    "PNG · 1920 × 1080 — screens and slides",
    "PNG · 2560 × 1440 — high-res screens",
    "PDF · Letter landscape — printing (300 DPI)",
    "PDF · A4 landscape — printing (300 DPI)"
  ]);
  assert.ok(Object.isFrozen(EXPORT_FORMATS));
});

test("M10 audience filtering uses explicit scopes and never exposes hidden or student-only events",()=>{
  const source=fixture().events;
  source.push(
    event("hidden-one","HIDDEN"),
    event("student-one","STUDENT_ONLY")
  );
  const before=structuredClone(source);
  const safe=filterEventsForAudience(source,"INTERVIEWER_SAFE");
  const lor=filterEventsForAudience(source,"LOR_WRITER");
  const professional=filterEventsForAudience(source,"PROFESSIONAL_CONNECTION");
  assert.deepEqual(safe.included.map(({id})=>id),["safe-one","safe-two"]);
  assert.deepEqual(safe.excludedIds,["advisor-one","hidden-one","student-one"]);
  assert.deepEqual(safe.excludedAdvisorOnlyIds,["advisor-one"]);
  assert.deepEqual(lor.included.map(({id})=>id),["safe-one","advisor-one","safe-two"]);
  assert.deepEqual(professional.included.map(({id})=>id),["safe-one","safe-two"]);
  assert.equal(lor.policy.explicitAdvisorOnlyScope,"LOR_WRITER");
  assert.equal(lor.policy.studentOnlyIncluded,false);
  assert.equal(lor.policy.hiddenIncluded,false);
  assert.deepEqual(source,before);
});

test("M10 all four audience policies produce deterministic, distinct event sets",()=>{
  const events=[
    event("safe"),
    {
      ...event("lor-private","ADVISOR_ONLY"),
      fields:{exportAudiences:["LOR_WRITER"]}
    },
    {
      ...event("professional-private","ADVISOR_ONLY"),
      fields:{exportAudiences:["PROFESSIONAL_CONNECTION"]}
    },
    {
      ...event("alumni-private","ADVISOR_ONLY"),
      fields:{exportAudiences:["MISSION_RESIDENCY_ALUMNI"]}
    }
  ];
  assert.deepEqual(
    filterEventsForAudience(events,"INTERVIEWER_SAFE").included.map(({id})=>id),
    ["safe"]
  );
  assert.deepEqual(
    filterEventsForAudience(events,"LOR_WRITER").included.map(({id})=>id),
    ["safe","lor-private"]
  );
  assert.deepEqual(
    filterEventsForAudience(events,"PROFESSIONAL_CONNECTION").included.map(({id})=>id),
    ["safe","professional-private"]
  );
  assert.deepEqual(
    filterEventsForAudience(events,"MISSION_RESIDENCY_ALUMNI").included.map(({id})=>id),
    ["safe","alumni-private"]
  );
});

test("M12 preview input performs one exact filter pass and carries theme, mode, and interview target",()=>{
  const document=fixture();
  document.theme="horizon";
  document.mode="advanced";
  const input=buildExportPreviewInput(document,{
    audience:"INTERVIEWER_SAFE",
    formatId:"pdf-letter-landscape"
  });
  assert.equal(input.contract,"D1-UXR-002-EXPORT-RENDER-INPUT-V1");
  assert.deepEqual(input.timeline.events.map(({id})=>id),["safe-one","safe-two"]);
  assert.equal(input.rendererOptions.audience,"EVERYTHING");
  assert.equal(input.rendererOptions.interviewMonth,"2026-01");
  assert.equal(input.themeId,"horizon");
  assert.equal(input.mode,"advanced");
  assert.equal(input.output.id,"pdf-letter-landscape");
  assert.deepEqual(input.audience.excludedAdvisorOnlyIds,["advisor-one"]);
});

test("M12 filename parsing is deterministic, space-free, and handles titles, suffixes, commas, and reserved characters",()=>{
  assert.deepEqual(parseStudentName("Dr. Amara N. Osei, MD"),{
    firstName:"Amara",
    lastName:"Osei"
  });
  assert.deepEqual(parseStudentName("de la Cruz, Ana María"),{
    firstName:"Ana",
    lastName:"delaCruz"
  });
  assert.equal(
    buildExportFilename("Dr. Amara N. Osei, MD","png-1920x1080",{now:fixedNow}),
    "Osei_Amara_Timeline_2026-07-29.png"
  );
  assert.equal(
    buildExportFilename('Ana / Rivera','pdf-a4-landscape',{now:fixedNow}),
    "Rivera_Ana_Timeline_2026-07-29.pdf"
  );
  assert.throws(()=>buildExportFilename("","png-1920x1080",{now:fixedNow}),/Student name is required/);
});

test("M10 export request gives preview and generation identical scoped input plus recipient context",()=>{
  const request=buildExportRequest(fixture(),{
    audience:"LOR_WRITER",
    audienceDetails:lorDetails,
    formatId:"pdf-letter-landscape",
    showPrintMargins:true
  },{now:fixedNow});
  assert.equal(request.filename,"Osei_Amara_Timeline_2026-07-29.pdf");
  assert.equal(request.previewInput,request.renderInput);
  assert.deepEqual(request.renderInput.timeline.events.map(({id})=>id),[
    "safe-one","advisor-one","safe-two"
  ]);
  assert.equal(request.audience,"LOR_WRITER");
  assert.deepEqual(request.recipientContext,lorDetails.LOR_WRITER);
  assert.equal(request.renderInput.audience.detailsComplete,true);
  assert.deepEqual(request.printGuide,{
    visible:true,
    marginMm:12.7,
    includedInFile:false
  });
  assert.deepEqual(request.version,{kind:"automatic",label:"Export · Jul 29, 2026"});
  assert.equal(request.boundary.externalApiCalls,false);
  assert.equal(request.boundary.productionWrites,false);
});

test("M12 print margin toggle exists only for PDF and normalizing back to PNG clears it",()=>{
  const pdf=normalizeExportState({formatId:"pdf-a4-landscape",showPrintMargins:true});
  assert.equal(pdf.showPrintMargins,true);
  const png=reduceExportState(pdf,{type:"format",value:"png-2560x1440"});
  assert.equal(png.showPrintMargins,false);
  assert.equal(buildExportScreenModel(fixture(),png,{now:fixedNow}).showPrintMarginToggle,false);
  const pdfModel=buildExportScreenModel(fixture(),pdf,{now:fixedNow});
  assert.equal(pdfModel.showPrintMarginToggle,true);
  assert.equal(pdfModel.printMarginMm,EXPORT_PRINT_MARGIN_MM);
});

test("M10 renders explicit audience selection, progressive recipient details, and collapsed print guidance",()=>{
  const html=renderExportScreen(fixture(),{
    state:{
      audience:"LOR_WRITER",
      audienceDetails:lorDetails,
      formatId:"pdf-letter-landscape",
      showPrintMargins:true
    },
    previewHtml:'<div data-canonical-preview="true"></div>',
    now:fixedNow
  });
  assert.match(html,/data-export-layout="two-column" data-export-controls-width="380"/);
  assert.match(html,/<h1 id="export-title" tabindex="-1">Export<\/h1>/);
  assert.match(html,/data-export-audience/);
  assert.match(html,/>Interview-safe<\/option>/);
  assert.match(html,/>LOR writer<\/option>/);
  assert.match(html,/>Professional connection<\/option>/);
  assert.match(html,/>Mission Residency alumni connection<\/option>/);
  assert.doesNotMatch(html,/>Everything</);
  assert.match(html,/data-export-audience-detail="writerName"/);
  assert.match(html,/data-export-audience-detail="understanding"/);
  assert.match(html,/Recipient details complete\./);
  assert.match(html,/data-month-field="export-interview-season"/);
  assert.equal((html.match(/name="export-format"/g)||[]).length,4);
  assert.match(html,/data-export-theme-trigger/);
  assert.match(html,/data-export-print-margins/);
  assert.match(html,/data-print-margin-mm="12\.7"/);
  assert.match(html,/class="button primary export-action"/);
  assert.match(html,/>Export PDF<\/button>/);
  assert.match(html,/<details class="card export-card print-guidance"/);
  assert.doesNotMatch(html,/<details[^>]* open/);
  for(const bullet of PRINT_GUIDANCE_COPY.bullets){
    const plain=html.replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&#039;/g,"'");
    assert.ok(plain.includes(bullet),`missing verbatim guidance: ${bullet}`);
  }
});

test("M12 zero-event state disables controls and action while preserving only the Open Builder escape",()=>{
  const document=fixture();
  document.events=[];
  const html=renderExportScreen(document,{now:fixedNow});
  const model=buildExportScreenModel(document,{}, {now:fixedNow});
  assert.equal(model.empty,true);
  assert.equal(model.controlsDisabled,true);
  assert.equal(model.preview.kind,"ghost");
  assert.match(html,/ghost-export-board/);
  assert.match(html,/<h2>Add events before exporting\.<\/h2>/);
  assert.match(html,/data-export-open-builder>Open Builder<\/button>/);
  assert.match(html,/data-export-action disabled/);
  assert.doesNotMatch(html,/data-export-preview-content/);
});

test("M10 non-empty timelines without a student name remain explicitly blocked before export",()=>{
  const document=fixture();
  document.studentProfile.fullName="";
  const model=buildExportScreenModel(document,{}, {now:fixedNow});
  const html=renderExportScreen(document,{now:fixedNow});
  assert.equal(model.empty,false);
  assert.equal(model.hasStudentName,false);
  assert.equal(model.exportActionDisabled,true);
  assert.equal(model.filename,null);
  assert.match(html,/Add your name in Builder before exporting\./);
  assert.match(html,/data-export-action disabled/);
});

test("M12 preview refresh exposes and enforces the at-most-400ms loading contract",async()=>{
  const states=[];
  const result=await refreshExportPreview({
    document:fixture(),
    state:{},
    renderPreview:async(input)=>({
      html:`<div>${input.audience.includedEventCount}</div>`,
      metadata:{renderer:"canonical"}
    }),
    onState:(state)=>states.push(state.status)
  });
  assert.equal(EXPORT_PREVIEW_LOADING_MAX_MS,400);
  assert.deepEqual(states,["loading","ready"]);
  assert.equal(result.html,"<div>2</div>");
  await assert.rejects(
    refreshExportPreview({
      document:fixture(),
      renderPreview:()=>new Promise(()=>{}),
      timeoutMs:2
    }),
    (error)=>error.code==="EXPORT_PREVIEW_TIMEOUT"
  );
  await assert.rejects(
    refreshExportPreview({
      document:fixture(),
      renderPreview:async()=>"",
      timeoutMs:401
    }),
    /between 1 and 400ms/
  );
});

test("M12 Advisor Paper PDF suggestion is delegated to themes.js once and never silently changes the theme",()=>{
  const document=fixture();
  document.theme="horizon";
  const first=planAdvisorPaperPdfSuggestion(document,"pdf-letter-landscape",{});
  assert.equal(first.offered,true);
  assert.equal(first.suggestion.message,"Advisor Paper prints best — switch?");
  assert.equal(document.theme,"horizon");
  assert.equal(planAdvisorPaperPdfSuggestion(
    document,
    "pdf-a4-landscape",
    first.suggestionState
  ).offered,false);
  assert.equal(planAdvisorPaperPdfSuggestion(document,"png-1920x1080",{}).offered,false);
});

test("M12 advisor request always sends Everything, the optional message, local session route, and version request",()=>{
  const document=fixture();
  const request=buildAdvisorReviewRequest(document,{
    message:"Please check the research overlap.",
    now:fixedNow
  });
  assert.equal(request.audience,"EVERYTHING");
  assert.deepEqual(request.includedEventIds,["safe-one","advisor-one","safe-two"]);
  assert.equal(request.message,"Please check the research overlap.");
  assert.equal(request.sessionRoute,"advisor-session:timeline-amara");
  assert.deepEqual(request.version,{
    kind:"automatic",
    label:"Sent for review · Jul 29, 2026"
  });
  assert.equal(request.boundary.localHandoffStub,true);
  assert.equal(request.boundary.externalApiCalls,false);
});

test("M12 advisor card renders never-requested, pending, approved, edited-since, and changes-requested states",()=>{
  const document=fixture();
  assert.match(renderExportScreen(document,{now:fixedNow}),/Get a second pair of eyes before you export\./);
  document.advisor={status:"pending",requestedAt:"2026-07-28T12:00:00.000Z",comments:[]};
  assert.match(renderExportScreen(document,{now:fixedNow}),/Awaiting advisor review · requested Jul 28, 2026/);
  assert.match(renderExportScreen(document,{now:fixedNow}),/>Cancel request<\/button>/);
  document.advisor={status:"cancelled",requestedAt:"2026-07-28T12:00:00.000Z",comments:[]};
  assert.match(renderExportScreen(document,{now:fixedNow}),/Get a second pair of eyes before you export\./);
  document.advisor={status:"approved",approvedAt:"2026-07-27T12:00:00.000Z",editedSince:false,comments:[]};
  assert.match(renderExportScreen(document,{now:fixedNow}),/Advisor approved · Jul 27, 2026/);
  document.advisor.editedSince=true;
  assert.match(renderExportScreen(document,{now:fixedNow}),/Approved Jul 27, 2026 · edited since/);
  document.advisor={status:"changes-requested",comments:[{id:"one"},{id:"two",resolvedAt:"2026-07-29"}]};
  assert.match(renderExportScreen(document,{now:fixedNow}),/>1 advisor comments<\/button>/);
});

test("M12 verified local adapter success downloads, toasts, and requests the automatic Export version",async()=>{
  const request=buildExportRequest(fixture(),{}, {now:fixedNow});
  const calls=[];
  const result=await executeExportRequest(request,{
    adapter:{
      id:"local-test-adapter",
      executionMode:"local",
      generate:async(received)=>{
        calls.push(["generate",received]);
        return{kind:"blob",bytes:42};
      },
      download:async(artifact,options)=>{
        calls.push(["download",artifact,options]);
        return{downloaded:true,method:"browser-download"};
      }
    },
    authorize:async()=>true,
    requestVersion:async(label,kind)=>calls.push(["version",label,kind]),
    toast:(message,options)=>calls.push(["toast",message,options])
  });
  assert.equal(result.completed,true);
  assert.equal(result.status,"downloaded");
  assert.equal(result.metadata.executionMode,"local");
  assert.equal(result.metadata.downloaded,true);
  assert.equal(result.versionRequested,true);
  assert.equal(result.toastSent,true);
  assert.equal(calls[0][0],"generate");
  assert.equal(calls[1][0],"download");
  assert.deepEqual(calls[2],["version","Export · Jul 29, 2026","automatic"]);
  assert.deepEqual(calls[3],[
    "toast",
    "Exported · Osei_Amara_Timeline_2026-07-29.png",
    {tone:"success"}
  ]);
});

test("M12 simulated adapters remain truthful: no download, success toast, or version is claimed",async()=>{
  const request=buildExportRequest(fixture(),{}, {now:fixedNow});
  let downloads=0;
  let versions=0;
  let toasts=0;
  const result=await executeExportRequest(request,{
    adapter:{
      id:"simulation",
      executionMode:"simulated",
      generate:async()=>({simulated:true,description:"prepared only"}),
      download:async()=>{downloads+=1;return{downloaded:true};}
    },
    authorize:async()=>true,
    requestVersion:async()=>{versions+=1;},
    toast:()=>{toasts+=1;}
  });
  assert.equal(result.status,"simulated");
  assert.equal(result.completed,false);
  assert.equal(result.metadata.executionMode,"simulated");
  assert.equal(result.metadata.downloadAttempted,false);
  assert.equal(result.metadata.downloaded,false);
  assert.equal(downloads,0);
  assert.equal(versions,0);
  assert.equal(toasts,0);
});

class FakeButton{
  constructor(){
    this.disabled=false;
    this.textContent="Export PNG";
    this.attributes=new Map();
    this.listeners=new Map();
  }
  addEventListener(type,handler){this.listeners.set(type,handler);}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  async click(){await this.listeners.get("click")?.({currentTarget:this});}
}

class FakeRoot{
  constructor(button){this.button=button;}
  querySelector(selector){return selector==="[data-export-action]"?this.button:null;}
  querySelectorAll(){return[];}
}

test("M12 installed action re-enables after failure and uses only the frozen failure toast",async()=>{
  const button=new FakeButton();
  const root=new FakeRoot(button);
  const messages=[];
  installExportScreen(root,fixture(),{
    state:{},
    entitlement:{
      access:"FULL",verified:true,canRead:true,canCreate:true,canMutate:true,
      canExport:true,reason:"Verified test entitlement."
    },
    now:()=>fixedNow,
    exportAdapter:{
      executionMode:"local",
      generate:async()=>{throw new Error("renderer unavailable");},
      download:async()=>({downloaded:true})
    },
    requestVersion:async()=>{},
    toast:(message)=>messages.push(message)
  });
  await button.click();
  assert.equal(button.disabled,false);
  assert.equal(button.attributes.get("aria-busy"),"false");
  assert.equal(button.textContent,"Export PNG");
  assert.deepEqual(messages,["Export failed — try again"]);
});
