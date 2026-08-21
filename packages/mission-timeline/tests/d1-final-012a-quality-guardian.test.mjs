import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  QUALITY_GUARDIAN_BASES,
  QUALITY_GUARDIAN_SCHEMA,
  QUALITY_GUARDIAN_SECTIONS,
  analyzeTimelineQuality,
  applySafeQualityFixes,
  deterministicFindingsForAi,
  mergeAiQualityAnalysis,
  qualityGuardianViewer,
  renderQualityGuardian
} from "../web/js/uxr-002/quality-guardian.js";

const categories=()=>[
  "education","exams","clinical","work","research","personal"
].map((id)=>({id,label:id,color:"#123456"}));

function timeline(overrides={}){
  const source={
    schemaVersion:"d1-uxr-002.1",
    revision:9,
    id:"timeline-quality-test",
    title:"Residency Timeline",
    theme:"keynote-classic",
    studentProfile:{fullName:"Avery Student",medicalSchool:"Example Medical School"},
    categories:categories(),
    events:[{
      id:"education-1",
      title:"Medical school",
      categoryId:"education",
      eventType:"duration",
      startDate:"2020-08",
      endDate:"2024-05",
      visibilityState:"INTERVIEWER_SAFE",
      sourceType:"manual",
      provenance:[]
    }],
    advanced:{
      background:{kind:"theme",preset:null,color:null,mediaId:null,dim:20,scrim:"white",fit:"cover"},
      media:[],textBlocks:[],elements:[],groups:[]
    },
    intake:{candidates:[]}
  };
  return{
    ...source,
    ...structuredClone(overrides),
    studentProfile:{...source.studentProfile,...structuredClone(overrides.studentProfile||{})},
    advanced:{...source.advanced,...structuredClone(overrides.advanced||{})},
    events:"events" in overrides?structuredClone(overrides.events):source.events,
    categories:"categories" in overrides?structuredClone(overrides.categories):source.categories,
    intake:{...source.intake,...structuredClone(overrides.intake||{})}
  };
}

test("Quality Guardian always reports the six explicit release sections without a black-box score",()=>{
  const report=analyzeTimelineQuality(timeline());
  assert.equal(report.schemaVersion,QUALITY_GUARDIAN_SCHEMA);
  assert.deepEqual(report.sections.map(({id})=>id),[
    "CONTENT","CHRONOLOGY","LAYOUT","READABILITY","MISSIONMED_FORMAT","EXPORT"
  ]);
  assert.deepEqual(QUALITY_GUARDIAN_SECTIONS.map(({label})=>label),[
    "Content","Chronology","Layout","Readability","MissionMed Format","Export"
  ]);
  assert.equal(Object.hasOwn(report,"score"),false);
  for(const section of report.sections)assert.ok(["READY","REVIEW","BLOCKED"].includes(section.state));
  assert.deepEqual(report.safety,{
    biographyMutationAllowed:false,
    autoFixScope:"PRESENTATION_ONLY",
    sourceFactsSeparated:true,
    inferenceSeparated:true
  });
});

test("missing canonical background is a release blocker with a presentation-only Fix for me",()=>{
  const source=timeline({advanced:{background:null}});
  const report=analyzeTimelineQuality(source,{stage:"BEFORE_EXPORT"});
  const finding=report.findings.find(({code})=>code==="CANONICAL_BACKGROUND_MISSING");
  assert.equal(finding.severity,"BLOCK_EXPORT");
  assert.equal(finding.basis,QUALITY_GUARDIAN_BASES.PRESENTATION);
  assert.equal(finding.actionMode,"FIX_FOR_ME");
  assert.equal(report.sections.find(({id})=>id==="MISSIONMED_FORMAT").state,"BLOCKED");
  assert.equal(report.sections.find(({id})=>id==="EXPORT").state,"BLOCKED");
  assert.equal(report.exportReady,false);

  const fixed=applySafeQualityFixes(source,report);
  assert.equal(fixed.changed,true);
  assert.equal(fixed.document.advanced.background.kind,"theme");
  assert.equal(fixed.semanticFieldsChanged,false);
  assert.equal(fixed.biographyFieldsChanged,false);
  assert.deepEqual(fixed.document.metadata.qualityGuardian.appliedFixes,[
    "RESTORE_THEME_BACKGROUND"
  ]);
  assert.deepEqual(fixed.review.oversight.appliedFixes,[
    "RESTORE_THEME_BACKGROUND"
  ]);
  assert.deepEqual(fixed.document.events,source.events);
  assert.deepEqual(fixed.document.studentProfile,source.studentProfile);
});

test("semantic findings are Review actions and never mutate biography data",()=>{
  const repeated={
    id:"award-1",title:"Dean's Award",categoryId:"work",eventType:"milestone",
    startDate:"2024-06",endDate:null,visibilityState:"INTERVIEWER_SAFE",
    sourceType:"ai-cv",confidence:.41,provenance:[]
  };
  const source=timeline({events:[repeated,{...repeated,id:"award-2"}]});
  const report=analyzeTimelineQuality(source);
  for(const code of ["POSSIBLE_DUPLICATE","CATEGORY_REVIEW","UNSUPPORTED_DERIVED_FACT","LOW_CONFIDENCE_AI_INFERENCE"]){
    const findings=report.findings.filter((item)=>item.code===code);
    assert.ok(findings.length>0,`${code} must be reported`);
    assert.ok(findings.every(({actionMode})=>actionMode==="REVIEW"));
  }
  assert.equal(report.findings.find(({code})=>code==="LOW_CONFIDENCE_AI_INFERENCE").basis,QUALITY_GUARDIAN_BASES.AI_INFERENCE);
  assert.equal(report.findings.find(({code})=>code==="UNSUPPORTED_DERIVED_FACT").basis,QUALITY_GUARDIAN_BASES.SOURCE_FACT);
  const fixed=applySafeQualityFixes(source,report);
  assert.equal(fixed.semanticFieldsChanged,false);
  assert.equal(fixed.biographyFieldsChanged,false);
  const biography=(events)=>events.map(({id,title,categoryId,startDate,endDate,sourceType,confidence,provenance})=>({
    id,title,categoryId,startDate,endDate,sourceType,confidence,provenance
  }));
  assert.deepEqual(biography(fixed.document.events),biography(source.events));
});

test("impossible chronology blocks export and remains a human Review action",()=>{
  const source=timeline({events:[{
    id:"bad-date",title:"Research fellow",categoryId:"research",eventType:"duration",
    startDate:"2025-06",endDate:"2024-06",visibilityState:"INTERVIEWER_SAFE",
    sourceType:"manual",provenance:[]
  }]});
  const report=analyzeTimelineQuality(source);
  const finding=report.findings.find(({code})=>code==="END_BEFORE_START");
  assert.equal(finding.severity,"BLOCK_EXPORT");
  assert.equal(finding.basis,QUALITY_GUARDIAN_BASES.SOURCE_FACT);
  assert.equal(finding.actionMode,"REVIEW");
  assert.equal(report.exportReady,false);
  assert.equal(applySafeQualityFixes(source,report).changed,false);
});

test("accepted source item omission is surfaced without inventing an event",()=>{
  const source=timeline({intake:{candidates:[{id:"candidate-1",title:"Cardiology elective",decision:"accepted"}]}});
  const report=analyzeTimelineQuality(source);
  const finding=report.findings.find(({code})=>code==="ACCEPTED_SOURCE_ITEM_OMITTED");
  assert.equal(finding.basis,QUALITY_GUARDIAN_BASES.SOURCE_FACT);
  assert.equal(finding.actionMode,"REVIEW");
  assert.equal(applySafeQualityFixes(source,report).document.events.length,1);
});

test("off-canvas repair clamps only presentation geometry",()=>{
  const source=timeline({advanced:{
    background:{kind:"theme"},
    textBlocks:[{id:"text-1",text:"Interview-ready",x:1870,y:1060,width:240,height:80,size:24}],
    media:[],elements:[],groups:[]
  }});
  const report=analyzeTimelineQuality(source);
  const finding=report.findings.find(({code})=>code==="OFF_CANVAS_OBJECT");
  assert.equal(finding.actionMode,"FIX_FOR_ME");
  const fixed=applySafeQualityFixes(source,report);
  assert.equal(fixed.document.advanced.textBlocks[0].x,1680);
  assert.equal(fixed.document.advanced.textBlocks[0].y,1000);
  assert.equal(fixed.document.advanced.textBlocks[0].text,"Interview-ready");
  assert.deepEqual(fixed.document.events,source.events);
});

test("automatic layout repair commits only when measured collision warnings decrease",()=>{
  const shared={
    categoryId:"work",eventType:"duration",startDate:"2020-01",endDate:"2020-12",
    visibilityState:"INTERVIEWER_SAFE",sourceType:"manual",provenance:[],lane:0
  };
  const source=timeline({events:[
    {...shared,id:"anchor-start",title:"Start",eventType:"milestone",startDate:"2016-01",endDate:null},
    {...shared,id:"work-a",title:"Clinical Coordinator"},
    {...shared,id:"work-b",title:"Research Assistant"},
    {...shared,id:"anchor-end",title:"End",eventType:"milestone",startDate:"2024-01",endDate:null}
  ]});
  const report=analyzeTimelineQuality(source);
  const before=report.findings.find(({code})=>code==="COLLISION_RISK")?.evidence?.collisionCount;
  assert.ok(Number(before)>0);
  const fixed=applySafeQualityFixes(source,report);
  const after=fixed.review.findings.find(({code})=>code==="COLLISION_RISK")?.evidence?.collisionCount||0;
  assert.equal(fixed.changed,true);
  assert.ok(Number(after)<Number(before));
  assert.deepEqual(fixed.document.events.map(({id,title,startDate,endDate})=>({id,title,startDate,endDate})),source.events.map(({id,title,startDate,endDate})=>({id,title,startDate,endDate})));
});

test("rendered panel exposes every section, evidence basis, semantic Review, and safe Fix for me",()=>{
  const report=analyzeTimelineQuality(timeline({advanced:{background:null},events:[{
    id:"bad-date",title:"Award",categoryId:"work",eventType:"milestone",
    startDate:"2025-06",endDate:"2024-06",visibilityState:"INTERVIEWER_SAFE",
    sourceType:"ai",confidence:.2,provenance:[]
  }]}));
  const html=renderQualityGuardian(report,{viewer:"Founder / administrator view"});
  for(const label of ["Content","Chronology","Layout","Readability","MissionMed Format","Export"]){
    assert.match(html,new RegExp(label));
  }
  assert.match(html,/Founder \/ administrator view/);
  assert.match(html,/Review summary/);
  assert.match(html,/AI layout fixes applied/);
  assert.match(html,/Unresolved factual questions/);
  assert.match(html,/Student-confirmed exceptions/);
  assert.match(html,/Export readiness/);
  assert.match(html,/SOURCE FACT/);
  assert.match(html,/AI INFERENCE/);
  assert.match(html,/PRESENTATION RECOMMENDATION/);
  assert.match(html,/Review/);
  assert.match(html,/Fix for me/);
  assert.doesNotMatch(html,/\d+\s*\/\s*100/);
});

test("Founder, administrator, mentor, and student visibility use the same explicit result",()=>{
  assert.equal(qualityGuardianViewer({subjectKind:"administrator"},"home"),"Founder / administrator view");
  assert.equal(qualityGuardianViewer({roles:["mentor"]},"home"),"Founder / mentor review");
  assert.equal(qualityGuardianViewer({},"advisor"),"Founder / mentor review");
  assert.equal(qualityGuardianViewer({subjectKind:"student"},"home"),"Student view");
});

test("read-only mentor view exposes findings but never exposes a mutation control",()=>{
  const report=analyzeTimelineQuality(timeline({advanced:{background:null}}));
  const html=renderQualityGuardian(report,{viewer:"Founder / mentor review",canFix:false});
  assert.match(html,/Founder \/ mentor review/);
  assert.match(html,/Student action · Fix for me/);
  assert.doesNotMatch(html,/data-quality-fix=/);
});

test("live AI findings merge into the versioned MissionMed Format while unsafe factual fixes are absent",()=>{
  const local=analyzeTimelineQuality(timeline());
  const requestFindings=deterministicFindingsForAi(local);
  assert.ok(requestFindings.every(({category})=>QUALITY_GUARDIAN_SECTIONS.some(({id})=>id===category)));
  const merged=mergeAiQualityAnalysis(local,{
    status:"COMPLETE",mode:"SERVER_AI",provider:"openai",model:"gpt-test-pinned",
    promptVersion:"d1-timeline-quality-guardian-ai.1",standardVersion:"D1-409H-A1+D1-411A",
    findings:[{
      id:"qg-ai:test",category:"READABILITY",code:"LONG_LABEL",severity:"REVIEW",
      basis:"AI_INFERENCE",elementIds:["event-1"],message:"The event label may clip.",
      recommendation:"Review the wording without changing the fact.",confidence:.86,
      actionMode:"REVIEW",fixKind:null
    }],
    unresolvedQuestions:["Confirm whether the shortened label preserves meaning."]
  });
  assert.equal(merged.ai.status,"COMPLETE");
  assert.equal(merged.ai.standardVersion,"D1-409H-A1+D1-411A");
  assert.ok(merged.findings.some(({id})=>id==="qg-ai:test"));
  assert.match(renderQualityGuardian(merged),/Live AI review/);
});

test("provider-unavailable quality state shows the truth and adds no canned AI findings",()=>{
  const local=analyzeTimelineQuality(timeline());
  const merged=mergeAiQualityAnalysis(local,{
    status:"AI_UNAVAILABLE",mode:"UNAVAILABLE",findings:[],unresolvedQuestions:[],
    unavailableMessage:"Timeline AI is temporarily unavailable. Your Timeline was not changed."
  });
  assert.equal(merged.findings.length,local.findings.length);
  assert.match(renderQualityGuardian(merged),/Timeline AI is temporarily unavailable/);
});

test("the production 407F entry exposes a visible release gate and an explicit proceed-to-export action",async()=>{
  const adapter=await readFile(new URL("../web/js/407f-engineering-adapter.js",import.meta.url),"utf8");
  assert.match(adapter,/from "\.\/uxr-002\/quality-guardian\.js"/);
  assert.match(adapter,/qualityGuardianButton\.textContent="CHECK MY TIMELINE"/);
  assert.match(adapter,/document\.addEventListener\("click",onQualityGuardianCapture,true\)/);
  assert.match(adapter,/"\[data-quality-guardian-open\],#hudExport,#rail \[data-v='export'\],\[data-nav='export'\],\[data-review-export\]"/);
  assert.match(adapter,/openQualityGuardian407F\("BEFORE_EXPORT"\)/);
  assert.match(adapter,/\[data-quality-continue-export\][\s\S]*bridge\.go\("export"\)/);
  assert.match(adapter,/applySafeQualityFixes\(store\.document/);
  assert.match(adapter,/TIMELINE_AI_STALE_DOCUMENT/);
  assert.match(adapter,/Number\(analysis\?\.documentRevision\)!==requestedRevision/);
  assert.match(adapter,/classifyTimelineAiCandidateOutcome\(candidate,decision\.decision\)/);
  assert.match(adapter,/onCandidateDecision:async/);
  assert.match(adapter,/store\.entitlement\.canMutate===true/);
  assert.match(adapter,/document\.removeEventListener\("click",onQualityGuardianCapture,true\)/);
});
