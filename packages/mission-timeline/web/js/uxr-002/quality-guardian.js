import {
  analyzeCollisionLayout,
  deterministicAutoArrange
} from "../editor/collision-engine-410.js";
import {escapeHtml} from "./utils.js";

export const QUALITY_GUARDIAN_SCHEMA="d1-timeline-quality-guardian.1";
export const QUALITY_GUARDIAN_SECTIONS=Object.freeze([
  {id:"CONTENT",label:"Content"},
  {id:"CHRONOLOGY",label:"Chronology"},
  {id:"LAYOUT",label:"Layout"},
  {id:"READABILITY",label:"Readability"},
  {id:"MISSIONMED_FORMAT",label:"MissionMed Format"},
  {id:"EXPORT",label:"Export"}
]);
export const QUALITY_GUARDIAN_BASES=Object.freeze({
  SOURCE_FACT:"SOURCE FACT",
  AI_INFERENCE:"AI INFERENCE",
  PRESENTATION:"PRESENTATION RECOMMENDATION"
});

const CANONICAL_CATEGORY_IDS=Object.freeze([
  "education","exams","clinical","work","research","personal"
]);
const VALID_BACKGROUND_KINDS=new Set(["theme","preset","color","upload"]);
const BOARD=Object.freeze({width:1920,height:1080});

const clone=(value)=>structuredClone(value);
const safeArray=(value)=>Array.isArray(value)?value:[];
const clean=(value)=>String(value??"").trim();
const normalizedTitle=(value)=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const findingId=(section,code,elementIds=[])=>
  `qg:${section.toLowerCase()}:${code.toLowerCase()}:${elementIds.map(String).sort().join("+")||"timeline"}`;

function dateOrdinal(value){
  const match=/^(\d{4})-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/.exec(clean(value));
  if(!match)return null;
  return Number(match[1])*372+(Number(match[2])-1)*31+Number(match[3]||1)-1;
}

function provenanceItems(event){
  if(Array.isArray(event?.provenance))return event.provenance;
  if(event?.provenance&&typeof event.provenance==="object")return[event.provenance];
  return[];
}

function confidenceValue(event){
  const candidates=[event?.confidence,event?.fields?.confidence,event?.fields?.aiConfidence];
  for(const value of candidates){
    const numeric=Number(value);
    if(Number.isFinite(numeric))return numeric>1?numeric/100:numeric;
  }
  return null;
}

function advancedObjects(document){
  const advanced=document?.advanced||{};
  return[
    ...safeArray(advanced.media).map((item)=>({...item,__collection:"media"})),
    ...safeArray(advanced.textBlocks).map((item)=>({...item,__collection:"textBlocks"})),
    ...safeArray(advanced.elements).map((item)=>({...item,__collection:"elements"}))
  ];
}

function geometry(item){
  const source=item?.geometry&&typeof item.geometry==="object"?item.geometry:item;
  return{
    x:Number(source?.x),
    y:Number(source?.y),
    width:Number(source?.width),
    height:Number(source?.height)
  };
}

function isOffCanvas(item){
  const box=geometry(item);
  if(!Object.values(box).every(Number.isFinite))return false;
  return box.x<0||box.y<0||box.x+box.width>BOARD.width||box.y+box.height>BOARD.height;
}

function add(findings,{
  section,code,severity="REVIEW",basis,elementIds=[],message,recommendation,
  actionMode="REVIEW",fixKind=null,evidence={}
}){
  findings.push(Object.freeze({
    id:findingId(section,code,elementIds),
    section,
    code,
    severity,
    basis,
    elementIds:Object.freeze(elementIds.map(String)),
    message,
    recommendation,
    actionMode,
    fixKind,
    evidence:Object.freeze({...evidence})
  }));
}

function inspectContent(document,findings){
  const events=safeArray(document?.events);
  if(!events.length){
    add(findings,{
      section:"CONTENT",code:"EMPTY_TIMELINE",severity:"BLOCK_EXPORT",
      basis:QUALITY_GUARDIAN_BASES.SOURCE_FACT,
      message:"Your timeline has no events.",
      recommendation:"Add only events you can confirm from your records.",
      evidence:{eventCount:0}
    });
  }

  const duplicateGroups=new Map();
  for(const event of events){
    const key=[normalizedTitle(event?.title),clean(event?.startDate),clean(event?.endDate)].join("|");
    if(!normalizedTitle(event?.title))continue;
    duplicateGroups.set(key,[...(duplicateGroups.get(key)||[]),event]);
    const sourceType=clean(event?.sourceType||event?.fields?.sourceType).toLowerCase();
    if(/(?:ai|cv|document|import|extract)/.test(sourceType)&&!provenanceItems(event).length){
      add(findings,{
        section:"CONTENT",code:"UNSUPPORTED_DERIVED_FACT",severity:"REVIEW",
        basis:QUALITY_GUARDIAN_BASES.SOURCE_FACT,elementIds:[event.id],
        message:`“${clean(event.title)||"Untitled event"}” came from an imported or AI-assisted source but has no linked evidence.`,
        recommendation:"Open Review and confirm it against the source before relying on it.",
        evidence:{sourceType:sourceType||"unknown",provenanceCount:0}
      });
    }
    const confidence=confidenceValue(event);
    if(sourceType.includes("ai")&&confidence!==null&&confidence<.75){
      add(findings,{
        section:"CONTENT",code:"LOW_CONFIDENCE_AI_INFERENCE",severity:"REVIEW",
        basis:QUALITY_GUARDIAN_BASES.AI_INFERENCE,elementIds:[event.id],
        message:`“${clean(event.title)||"Untitled event"}” is a low-confidence AI interpretation.`,
        recommendation:"Compare the title, category, institution, and dates with the source.",
        evidence:{confidence}
      });
    }
    const title=normalizedTitle(event?.title);
    const category=clean(event?.categoryId).toLowerCase();
    const likelyCategory=/(?:award|honou?r|prize|dean.?s list)/.test(title)
      ?"personal"
      :/(?:research|publication|poster|abstract)/.test(title)
        ?"research"
        :null;
    if(likelyCategory&&category&&category!==likelyCategory){
      add(findings,{
        section:"CONTENT",code:"CATEGORY_REVIEW",severity:"REVIEW",
        basis:QUALITY_GUARDIAN_BASES.AI_INFERENCE,elementIds:[event.id],
        message:`“${clean(event.title)}” may not belong in ${category}.`,
        recommendation:`Review the source and confirm whether ${likelyCategory} is more accurate.`,
        evidence:{currentCategory:category,suggestedCategory:likelyCategory}
      });
    }
  }
  for(const group of duplicateGroups.values()){
    if(group.length<2)continue;
    add(findings,{
      section:"CONTENT",code:"POSSIBLE_DUPLICATE",severity:"REVIEW",
      basis:QUALITY_GUARDIAN_BASES.SOURCE_FACT,
      elementIds:group.map(({id})=>id),
      message:`${group.length} events have the same title and dates.`,
      recommendation:"Compare their source evidence and choose merge, keep both, edit, or dismiss.",
      evidence:{title:clean(group[0]?.title),count:group.length}
    });
  }

  const accepted=safeArray(document?.intake?.candidates).filter(({decision})=>decision==="accepted");
  const linkedCandidateIds=new Set(events.map((event)=>clean(event?.sourceCandidateId||event?.fields?.sourceCandidateId)).filter(Boolean));
  for(const candidate of accepted){
    if(linkedCandidateIds.has(clean(candidate?.id)))continue;
    add(findings,{
      section:"CONTENT",code:"ACCEPTED_SOURCE_ITEM_OMITTED",severity:"REVIEW",
      basis:QUALITY_GUARDIAN_BASES.SOURCE_FACT,elementIds:[candidate?.id],
      message:`Accepted source item “${clean(candidate?.title)||"Untitled item"}” is not linked to a timeline event.`,
      recommendation:"Review the accepted item and either add it or mark it intentionally omitted.",
      evidence:{candidateDecision:"accepted"}
    });
  }
}

function inspectChronology(document,findings){
  for(const event of safeArray(document?.events)){
    const start=dateOrdinal(event?.startDate);
    const hasEnd=clean(event?.endDate)!=="";
    const end=hasEnd?dateOrdinal(event?.endDate):start;
    if(start===null||(hasEnd&&end===null)){
      add(findings,{
        section:"CHRONOLOGY",code:"INVALID_DATE",severity:"REVIEW",
        basis:QUALITY_GUARDIAN_BASES.SOURCE_FACT,elementIds:[event.id],
        message:`“${clean(event.title)||"Untitled event"}” has a missing or invalid date.`,
        recommendation:"Review the source and enter the date without guessing.",
        evidence:{startDate:clean(event?.startDate),endDate:clean(event?.endDate)}
      });
    }else if(end<start){
      add(findings,{
        section:"CHRONOLOGY",code:"END_BEFORE_START",severity:"BLOCK_EXPORT",
        basis:QUALITY_GUARDIAN_BASES.SOURCE_FACT,elementIds:[event.id],
        message:`“${clean(event.title)||"Untitled event"}” ends before it starts.`,
        recommendation:"Review the source and correct the chronology before export.",
        evidence:{startDate:clean(event?.startDate),endDate:clean(event?.endDate)}
      });
    }
  }
}

function inspectLayout(document,findings){
  let collisionReview=null;
  try{collisionReview=analyzeCollisionLayout(document,{scope:"FULL_STORY"});}catch{}
  const collisionWarnings=safeArray(collisionReview?.warnings).filter(({severity})=>severity!=="INFO");
  if(collisionWarnings.length){
    const ids=[...new Set(collisionWarnings.flatMap(({elementIds})=>safeArray(elementIds)))];
    add(findings,{
      section:"LAYOUT",code:"COLLISION_RISK",severity:"REVIEW",
      basis:QUALITY_GUARDIAN_BASES.PRESENTATION,elementIds:ids,
      message:`${collisionWarnings.length} potential ${collisionWarnings.length===1?"collision needs":"collisions need"} attention.`,
      recommendation:"Use Fix for me to reflow event lanes, then visually confirm the result.",
      actionMode:"FIX_FOR_ME",fixKind:"AUTO_ARRANGE_EVENTS",
      evidence:{collisionCount:collisionWarnings.length,codes:[...new Set(collisionWarnings.map(({code})=>code))].join(",")}
    });
  }
  for(const item of advancedObjects(document)){
    if(!isOffCanvas(item))continue;
    add(findings,{
      section:"LAYOUT",code:"OFF_CANVAS_OBJECT",severity:"BLOCK_EXPORT",
      basis:QUALITY_GUARDIAN_BASES.PRESENTATION,elementIds:[item.id],
      message:`“${clean(item?.label||item?.text||item?.source?.name)||"Canvas object"}” extends beyond the export canvas.`,
      recommendation:"Use Fix for me to move the object fully onto the canvas.",
      actionMode:"FIX_FOR_ME",fixKind:"CLAMP_OBJECTS",
      evidence:{collection:item.__collection,...geometry(item)}
    });
  }
}

function inspectReadability(document,findings){
  const longLabels=safeArray(document?.events).filter(({title})=>clean(title).length>58);
  if(longLabels.length){
    add(findings,{
      section:"READABILITY",code:"LONG_EVENT_LABELS",severity:"REVIEW",
      basis:QUALITY_GUARDIAN_BASES.PRESENTATION,
      elementIds:longLabels.map(({id})=>id),
      message:`${longLabels.length} event ${longLabels.length===1?"label is":"labels are"} likely to wrap or clip.`,
      recommendation:"Shorten presentation labels without changing the underlying facts.",
      evidence:{count:longLabels.length,maxLength:Math.max(...longLabels.map(({title})=>clean(title).length))}
    });
  }
  const smallText=safeArray(document?.advanced?.textBlocks).filter((item)=>Number(item?.size)<12);
  if(smallText.length){
    add(findings,{
      section:"READABILITY",code:"ILLEGIBLE_TEXT_SIZE",severity:"BLOCK_EXPORT",
      basis:QUALITY_GUARDIAN_BASES.PRESENTATION,
      elementIds:smallText.map(({id})=>id),
      message:`${smallText.length} text ${smallText.length===1?"object is":"objects are"} below 12 px.`,
      recommendation:"Increase the text size and inspect Letter and A4 exports at normal viewing size.",
      evidence:{minimumSize:Math.min(...smallText.map(({size})=>Number(size)))}
    });
  }
  const visible=safeArray(document?.events).filter(({visibilityState})=>visibilityState!=="HIDDEN");
  if(visible.length>45){
    add(findings,{
      section:"READABILITY",code:"EXCESSIVE_DENSITY",severity:"REVIEW",
      basis:QUALITY_GUARDIAN_BASES.PRESENTATION,
      elementIds:visible.map(({id})=>id),
      message:`${visible.length} visible events may be difficult to read at interview distance.`,
      recommendation:"Review which events best support the interview story; do not remove facts automatically.",
      evidence:{visibleEventCount:visible.length}
    });
  }
}

function inspectMissionMedFormat(document,findings){
  const background=document?.advanced?.background;
  if(!background||!VALID_BACKGROUND_KINDS.has(clean(background.kind))){
    add(findings,{
      section:"MISSIONMED_FORMAT",code:"CANONICAL_BACKGROUND_MISSING",severity:"BLOCK_EXPORT",
      basis:QUALITY_GUARDIAN_BASES.PRESENTATION,
      message:"The approved MissionMed background is missing.",
      recommendation:"Use Fix for me to restore the selected MissionMed theme background.",
      actionMode:"FIX_FOR_ME",fixKind:"RESTORE_THEME_BACKGROUND",
      evidence:{backgroundKind:clean(background?.kind)||"missing"}
    });
  }
  if(!clean(document?.theme)){
    add(findings,{
      section:"MISSIONMED_FORMAT",code:"THEME_MISSING",severity:"BLOCK_EXPORT",
      basis:QUALITY_GUARDIAN_BASES.PRESENTATION,
      message:"No MissionMed presentation theme is selected.",
      recommendation:"Restore Keynote Classic before export.",
      actionMode:"FIX_FOR_ME",fixKind:"RESTORE_DEFAULT_THEME",
      evidence:{theme:"missing"}
    });
  }
  const categoryIds=new Set(safeArray(document?.categories).map(({id})=>clean(id)));
  const missing=CANONICAL_CATEGORY_IDS.filter((id)=>!categoryIds.has(id));
  if(missing.length){
    add(findings,{
      section:"MISSIONMED_FORMAT",code:"CANONICAL_CATEGORY_SET_INCOMPLETE",severity:"REVIEW",
      basis:QUALITY_GUARDIAN_BASES.PRESENTATION,
      message:`The MissionMed category key is missing ${missing.length} canonical ${missing.length===1?"category":"categories"}.`,
      recommendation:"Review the Color Key; do not remap event biographies automatically.",
      evidence:{missingCategoryIds:missing.join(",")}
    });
  }
}

function sectionState(findings){
  if(findings.some(({severity})=>severity==="BLOCK_EXPORT"))return"BLOCKED";
  if(findings.some(({severity})=>severity==="REVIEW"))return"REVIEW";
  return"READY";
}

export function analyzeTimelineQuality(document,{stage="DURING_BUILDING"}={}){
  const findings=[];
  inspectContent(document,findings);
  inspectChronology(document,findings);
  inspectLayout(document,findings);
  inspectReadability(document,findings);
  inspectMissionMedFormat(document,findings);

  const nonExport=findings.filter(({section})=>section!=="EXPORT");
  const blockers=nonExport.filter(({severity})=>severity==="BLOCK_EXPORT");
  if(blockers.length){
    add(findings,{
      section:"EXPORT",code:"EXPORT_BLOCKED",severity:"BLOCK_EXPORT",
      basis:QUALITY_GUARDIAN_BASES.PRESENTATION,
      elementIds:blockers.flatMap(({elementIds})=>elementIds),
      message:`Export is blocked by ${blockers.length} visible quality ${blockers.length===1?"issue":"issues"}.`,
      recommendation:"Resolve the blocked sections and run Quality Check again.",
      evidence:{blockingFindingIds:blockers.map(({id})=>id).join(",")}
    });
  }
  const sections=QUALITY_GUARDIAN_SECTIONS.map((definition)=>{
    const sectionFindings=findings.filter(({section})=>section===definition.id);
    return Object.freeze({
      ...definition,
      state:sectionState(sectionFindings),
      findings:Object.freeze(sectionFindings)
    });
  });
  const state=sectionState(findings);
  const priorGuardian=document?.metadata?.qualityGuardian||{};
  const appliedFixes=safeArray(priorGuardian.appliedFixes).map((item)=>
    typeof item==="string"?item:clean(item?.kind)
  ).filter(Boolean);
  const confirmedExceptions=safeArray(priorGuardian.confirmedExceptions).map((item)=>
    typeof item==="string"?item:clean(item?.findingId||item?.id)
  ).filter(Boolean);
  const unresolvedFactualQuestions=findings.filter(({actionMode,basis,id})=>
    actionMode==="REVIEW"&&
    [QUALITY_GUARDIAN_BASES.SOURCE_FACT,QUALITY_GUARDIAN_BASES.AI_INFERENCE].includes(basis)&&
    !confirmedExceptions.includes(id)
  ).length;
  return Object.freeze({
    schemaVersion:QUALITY_GUARDIAN_SCHEMA,
    stage,
    generatedFromRevision:Number(document?.revision||0),
    state,
    headline:state==="READY"?"READY TO EXPORT":state==="BLOCKED"?"NOT READY TO EXPORT":`${findings.length} ${findings.length===1?"thing":"things"} to review`,
    exportReady:!findings.some(({severity})=>severity==="BLOCK_EXPORT"),
    findingCount:findings.length,
    sections:Object.freeze(sections),
    findings:Object.freeze(findings),
    oversight:Object.freeze({
      issueCount:findings.length,
      appliedFixes:Object.freeze(appliedFixes),
      unresolvedFactualQuestions,
      studentConfirmedExceptions:Object.freeze(confirmedExceptions),
      exportReady:!findings.some(({severity})=>severity==="BLOCK_EXPORT")
    }),
    safety:Object.freeze({
      biographyMutationAllowed:false,
      autoFixScope:"PRESENTATION_ONLY",
      sourceFactsSeparated:true,
      inferenceSeparated:true
    })
  });
}

export function deterministicFindingsForAi(report){
  return safeArray(report?.findings).slice(0,100).map((finding)=>Object.freeze({
    id:clean(finding.id).slice(0,160),
    category:clean(finding.section).slice(0,100),
    code:clean(finding.code).slice(0,100),
    severity:clean(finding.severity).slice(0,40),
    elementIds:Object.freeze(safeArray(finding.elementIds).map(String).slice(0,100)),
    message:clean(finding.message).slice(0,1000)
  }));
}

export function mergeAiQualityAnalysis(localReport,analysis){
  const aiStatus=analysis?.status==="COMPLETE"&&analysis?.mode==="SERVER_AI"
    ?"COMPLETE"
    :"UNAVAILABLE";
  const existing=new Set(safeArray(localReport?.findings).map((finding)=>
    [finding.section,finding.code,...safeArray(finding.elementIds).map(String).sort()].join("|")
  ));
  const aiFindings=aiStatus==="COMPLETE"
    ?safeArray(analysis?.findings).flatMap((finding)=>{
      const section=clean(finding?.category);
      const code=clean(finding?.code);
      const elementIds=safeArray(finding?.elementIds).map(String);
      const key=[section,code,...elementIds.slice().sort()].join("|");
      if(!QUALITY_GUARDIAN_SECTIONS.some(({id})=>id===section)||existing.has(key))return[];
      const actionMode=finding?.actionMode==="FIX_FOR_ME"?"FIX_FOR_ME":"REVIEW";
      const basis=[
        QUALITY_GUARDIAN_BASES.SOURCE_FACT,
        QUALITY_GUARDIAN_BASES.AI_INFERENCE,
        QUALITY_GUARDIAN_BASES.PRESENTATION
      ].includes(finding?.basis)?finding.basis:QUALITY_GUARDIAN_BASES.AI_INFERENCE;
      if(actionMode==="FIX_FOR_ME"&&basis!==QUALITY_GUARDIAN_BASES.PRESENTATION)return[];
      return[Object.freeze({
        id:clean(finding.id)||findingId(section,code,elementIds),
        section,
        code,
        severity:["BLOCK_EXPORT","REVIEW","INFO"].includes(finding?.severity)?finding.severity:"REVIEW",
        basis,
        elementIds:Object.freeze(elementIds),
        message:clean(finding?.message),
        recommendation:clean(finding?.recommendation),
        actionMode,
        fixKind:actionMode==="FIX_FOR_ME"?clean(finding?.fixKind)||null:null,
        evidence:Object.freeze({
          confidence:Number(finding?.confidence)||0,
          provider:clean(analysis?.provider),
          model:clean(analysis?.model),
          promptVersion:clean(analysis?.promptVersion),
          standardVersion:clean(analysis?.standardVersion)
        })
      })];
    })
    :[];
  const findings=Object.freeze([...safeArray(localReport?.findings),...aiFindings]);
  const sections=Object.freeze(QUALITY_GUARDIAN_SECTIONS.map((definition)=>{
    const sectionFindings=findings.filter(({section})=>section===definition.id);
    return Object.freeze({...definition,state:sectionState(sectionFindings),findings:Object.freeze(sectionFindings)});
  }));
  const state=sectionState(findings);
  const prior=localReport?.oversight||{};
  const unresolved=Number(prior.unresolvedFactualQuestions||0)+safeArray(analysis?.unresolvedQuestions).length+
    aiFindings.filter(({actionMode,basis})=>actionMode==="REVIEW"&&basis===QUALITY_GUARDIAN_BASES.AI_INFERENCE).length;
  return Object.freeze({
    ...localReport,
    state,
    headline:state==="READY"?"READY TO EXPORT":state==="BLOCKED"?"NOT READY TO EXPORT":`${findings.length} ${findings.length===1?"thing":"things"} to review`,
    exportReady:!findings.some(({severity})=>severity==="BLOCK_EXPORT"),
    findingCount:findings.length,
    sections,
    findings,
    ai:Object.freeze({
      status:aiStatus,
      provider:aiStatus==="COMPLETE"?clean(analysis.provider):null,
      model:aiStatus==="COMPLETE"?clean(analysis.model):null,
      promptVersion:clean(analysis?.promptVersion),
      standardVersion:clean(analysis?.standardVersion),
      unavailableMessage:aiStatus==="UNAVAILABLE"
        ?clean(analysis?.unavailableMessage)||"Timeline AI is temporarily unavailable. Your Timeline was not changed."
        :null
    }),
    oversight:Object.freeze({
      ...prior,
      issueCount:findings.length,
      unresolvedFactualQuestions:unresolved,
      exportReady:!findings.some(({severity})=>severity==="BLOCK_EXPORT")
    })
  });
}

function clampObject(item){
  const box=geometry(item);
  if(!Object.values(box).every(Number.isFinite))return false;
  const nextX=Math.min(Math.max(0,box.x),Math.max(0,BOARD.width-box.width));
  const nextY=Math.min(Math.max(0,box.y),Math.max(0,BOARD.height-box.height));
  if(nextX===box.x&&nextY===box.y)return false;
  if(item.geometry&&typeof item.geometry==="object"){
    item.geometry.x=nextX;item.geometry.y=nextY;
  }else{
    item.x=nextX;item.y=nextY;
  }
  return true;
}

export function applySafeQualityFixes(document,report=analyzeTimelineQuality(document)){
  const next=clone(document);
  const requested=new Set(report.findings.filter(({actionMode})=>actionMode==="FIX_FOR_ME").map(({fixKind})=>fixKind));
  const changes=[];
  if(requested.has("RESTORE_DEFAULT_THEME")&&!clean(next.theme)){
    next.theme="keynote-classic";
    changes.push({kind:"RESTORE_DEFAULT_THEME",scope:"PRESENTATION",message:"Restored Keynote Classic."});
  }
  if(requested.has("RESTORE_THEME_BACKGROUND")&&(!next.advanced?.background||!VALID_BACKGROUND_KINDS.has(clean(next.advanced.background.kind)))){
    next.advanced=next.advanced&&typeof next.advanced==="object"?next.advanced:{};
    next.advanced.background={kind:"theme",preset:null,color:null,mediaId:null,dim:20,scrim:"white",fit:"cover"};
    changes.push({kind:"RESTORE_THEME_BACKGROUND",scope:"PRESENTATION",message:"Restored the selected MissionMed theme background."});
  }
  if(requested.has("AUTO_ARRANGE_EVENTS")){
    const result=deterministicAutoArrange(safeArray(next.events),{scope:"FULL_STORY"});
    changes.push({kind:"AUTO_ARRANGE_EVENTS",scope:"PRESENTATION",message:`Reflowed ${result.placed} visible events across ${result.laneCount} lanes.`});
  }
  if(requested.has("CLAMP_OBJECTS")){
    let count=0;
    for(const collection of ["media","textBlocks","elements"]){
      for(const item of safeArray(next?.advanced?.[collection]))if(clampObject(item))count+=1;
    }
    if(count)changes.push({kind:"CLAMP_OBJECTS",scope:"PRESENTATION",message:`Moved ${count} off-canvas ${count===1?"object":"objects"} into bounds.`});
  }
  if(changes.length){
    next.metadata=next.metadata&&typeof next.metadata==="object"?next.metadata:{};
    const prior=next.metadata.qualityGuardian&&typeof next.metadata.qualityGuardian==="object"
      ?next.metadata.qualityGuardian
      :{};
    next.metadata.qualityGuardian={
      ...prior,
      schemaVersion:QUALITY_GUARDIAN_SCHEMA,
      appliedFixes:[
        ...new Set([
          ...safeArray(prior.appliedFixes).map((item)=>typeof item==="string"?item:clean(item?.kind)).filter(Boolean),
          ...changes.map(({kind})=>kind)
        ])
      ]
    };
  }
  return Object.freeze({
    changed:changes.length>0,
    document:next,
    changes:Object.freeze(changes.map(Object.freeze)),
    semanticFieldsChanged:false,
    biographyFieldsChanged:false,
    review:analyzeTimelineQuality(next,{stage:"AFTER_SAFE_FIX"})
  });
}

function stateSymbol(state){return state==="READY"?"✓":state==="BLOCKED"?"✕":"⚠";}

export function qualityGuardianViewer(entitlement={},route="home"){
  const subject=clean(entitlement?.subjectKind).toLowerCase();
  const roles=safeArray(entitlement?.roles).map((value)=>clean(value).toLowerCase());
  if(subject==="administrator"||roles.includes("administrator"))return"Founder / administrator view";
  if(route==="advisor"||subject==="advisor"||roles.includes("advisor")||roles.includes("mentor"))return"Founder / mentor review";
  return"Student view";
}

export function renderQualityGuardian(report,{
  viewer="Student view",
  canFix=true,
  controlClasses={secondary:"button secondary",tertiary:"button tertiary",primary:"button primary"}
}={}){
  const reviewViewer=viewer!=="Student view";
  return`<div class="quality-guardian" data-quality-guardian-report>
    <p class="micro-label">Timeline Quality Guardian · ${escapeHtml(viewer)}</p>
    <h2 id="quality-guardian-title">${escapeHtml(report.headline)}</h2>
    <p>Source facts, AI inferences, and presentation recommendations are shown separately. Fix for me never changes your biography.</p>
    ${report.ai?`<p class="status-chip" data-quality-ai-status="${escapeHtml(report.ai.status)}">${report.ai.status==="COMPLETE"
      ?`Live AI review · ${escapeHtml(report.ai.model)} · Standard ${escapeHtml(report.ai.standardVersion)}`
      :escapeHtml(report.ai.unavailableMessage)}</p>`:""}
    ${reviewViewer?`<section data-quality-oversight aria-label="Founder and mentor quality summary">
      <h3>Review summary</h3>
      <dl>
        <div><dt>Issues found</dt><dd>${report.oversight.issueCount}</dd></div>
        <div><dt>AI layout fixes applied</dt><dd>${report.oversight.appliedFixes.length}</dd></div>
        <div><dt>Unresolved factual questions</dt><dd>${report.oversight.unresolvedFactualQuestions}</dd></div>
        <div><dt>Student-confirmed exceptions</dt><dd>${report.oversight.studentConfirmedExceptions.length}</dd></div>
        <div><dt>Export readiness</dt><dd>${report.oversight.exportReady?"Ready":"Blocked"}</dd></div>
      </dl>
    </section>`:""}
    <div class="quality-guardian-sections">${report.sections.map((section)=>`<section data-quality-section="${section.id}" data-quality-state="${section.state}">
      <h3>${stateSymbol(section.state)} ${escapeHtml(section.label)} <small>${escapeHtml(section.state)}</small></h3>
      ${section.findings.length?`<ul>${section.findings.map((finding)=>`<li data-quality-finding="${escapeHtml(finding.id)}">
        <p><strong>${escapeHtml(finding.message)}</strong></p>
        <p><span class="status-chip">${escapeHtml(finding.basis)}</span> ${escapeHtml(finding.recommendation)}</p>
        ${finding.actionMode==="FIX_FOR_ME"&&!canFix
          ?'<span class="status-chip">Student action · Fix for me</span>'
          :`<button type="button" class="${escapeHtml(finding.actionMode==="FIX_FOR_ME"?controlClasses.secondary:controlClasses.tertiary)}" ${finding.actionMode==="FIX_FOR_ME"?`data-quality-fix="${escapeHtml(finding.id)}"`:`data-quality-review="${escapeHtml(finding.id)}"`}>${finding.actionMode==="FIX_FOR_ME"?"Fix for me":"Review"}</button>`}
      </li>`).join("")}</ul>`:"<p>✓ No issues found.</p>"}
    </section>`).join("")}</div>
    <div class="dialog-actions">
      <button type="button" class="${escapeHtml(controlClasses.secondary)}" data-quality-close>Close</button>
      ${report.exportReady?`<button type="button" class="${escapeHtml(controlClasses.primary)}" data-quality-continue-export>Continue to export</button>`:""}
    </div>
  </div>`;
}

export function openQualityGuardian(store,{stage="DURING_BUILDING",continueToExport=false,opener=document.activeElement}={}){
  const overlay=document.querySelector("#overlay-root");
  if(!overlay)return null;
  const show=()=>{
    const report=analyzeTimelineQuality(store.document,{stage});
    overlay._opener=opener;
    overlay.innerHTML=`<div class="overlay-scrim" data-quality-dismiss><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="quality-guardian-title">${renderQualityGuardian(report,{
      viewer:qualityGuardianViewer(store.entitlement,store.route),
      canFix:store.entitlement?.canMutate===true
    })}</section></div>`;
    const close=()=>{
      overlay.replaceChildren();
      overlay._opener=null;
      if(opener?.isConnected)opener.focus();
    };
    overlay.querySelector("[data-quality-close]")?.addEventListener("click",close);
    overlay.querySelector("[data-quality-dismiss]")?.addEventListener("pointerdown",(event)=>{
      if(event.target.matches("[data-quality-dismiss]"))close();
    });
    overlay.querySelectorAll("[data-quality-review]").forEach((button)=>button.addEventListener("click",()=>{
      const finding=report.findings.find(({id})=>id===button.dataset.qualityReview);
      close();
      store.navigate(finding?.code==="ACCEPTED_SOURCE_ITEM_OMITTED"?"intake":"builder");
    }));
    overlay.querySelectorAll("[data-quality-fix]").forEach((button)=>button.addEventListener("click",()=>{
      const selected=report.findings.find(({id})=>id===button.dataset.qualityFix);
      if(!selected||selected.actionMode!=="FIX_FOR_ME")return;
      const scoped={...report,findings:report.findings.filter(({id})=>id===selected.id)};
      const result=applySafeQualityFixes(store.document,scoped);
      if(result.changed)store.replace(result.document,{label:"Quality Guardian: safe layout fix"});
      show();
    }));
    overlay.querySelector("[data-quality-continue-export]")?.addEventListener("click",()=>{
      close();store.navigate("export");
    });
    return report;
  };
  const report=show();
  if(continueToExport&&report?.exportReady===true){
    // The visible check remains open so the student explicitly chooses Continue.
  }
  return report;
}
