import {analyzeCollisionLayout} from "../editor/collision-engine-410.js";
import {escapeHtml} from "./utils.js";
import {applySceneCommandToDocument} from '../editor/scene-commands.js';
import {serializeFounderPresentation,assertCompleteFounderPresentation,founderMilestoneTemplateGeometry,founderDurationTemplateGeometry,violatesFounderTemplateBand} from '../presentation/founder-presentation-serializer.js';
import {resolveFounderPresentationSvg,materialPresentationCollisions} from '../presentation/resolved-founder-presentation.js';
import {locked407FMilestoneGeometry} from './locked-407f-export.js';
import {createLocalLayoutReview,isLocalLayoutReviewLocation} from './local-layout-review.js';
import {measureLayoutCriticSafety,stableLayoutJson} from '../presentation/layout-critic-projection.js';

export const QUALITY_GUARDIAN_SCHEMA="d1-timeline-quality-guardian.1";
export const QUALITY_GUARDIAN_SECTIONS=Object.freeze([
  {id:"CONTENT",label:"Content"},
  {id:"CHRONOLOGY",label:"Chronology"},
  {id:"LAYOUT",label:"Layout"},
  {id:"READABILITY",label:"Readability"},
  {id:"MISSIONMED_FORMAT",label:"MissionMed Format"},
  {id:"EXPORT",label:"Export"}
]);
/* AAA-019 — chip vocabulary the student reads. The four bases keep their keys (the
   server schema still emits SOURCE_FACT / RULE / AI_INFERENCE / PRESENTATION_RECOMMENDATION);
   only the rendered text changed: "AI REVIEW" says what actually happened (a model reviewed
   it — no inference is claimed without a provider result, Law QG1) and "FOUNDER STANDARD"
   names whose presentation standard a layout recommendation comes from. The previous chip
   strings stay accepted on the way in so stored reports never lose their basis. */
export const QUALITY_GUARDIAN_BASES=Object.freeze({
  SOURCE_FACT:"SOURCE FACT",
  RULE:"MISSIONMED RULE",
  AI_INFERENCE:"AI REVIEW",
  PRESENTATION:"FOUNDER STANDARD"
});
const LEGACY_CHIP_BASES=Object.freeze({
  "AI INFERENCE":"AI REVIEW",
  "PRESENTATION RECOMMENDATION":"FOUNDER STANDARD"
});

/* Normalize deterministic rule vocabulary and classify provider presentation actions.
   A provider-origin finding is always displayed as AI REVIEW after its transport receipt;
   its claimed basis never grants source-fact or Founder-standard authority. */
const SERVER_BASIS_TO_CHIP=Object.freeze({
  SOURCE_FACT:QUALITY_GUARDIAN_BASES.SOURCE_FACT,
  RULE:QUALITY_GUARDIAN_BASES.RULE,
  AI_INFERENCE:QUALITY_GUARDIAN_BASES.AI_INFERENCE,
  PRESENTATION_RECOMMENDATION:QUALITY_GUARDIAN_BASES.PRESENTATION
});
const CHIP_BASIS_VALUES=new Set(Object.values(SERVER_BASIS_TO_CHIP));
const chipBasis=(value)=>{
  const raw=String(value??"").trim();
  if(CHIP_BASIS_VALUES.has(raw))return raw;
  if(LEGACY_CHIP_BASES[raw])return LEGACY_CHIP_BASES[raw];
  return SERVER_BASIS_TO_CHIP[raw.toUpperCase().replace(/[\s-]+/g,"_")]||QUALITY_GUARDIAN_BASES.RULE;
};

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
  if(!clean(document?.studentProfile?.fullName))add(findings,{
    section:"CONTENT",code:"STUDENT_NAME_MISSING",severity:"BLOCK_EXPORT",basis:QUALITY_GUARDIAN_BASES.SOURCE_FACT,
    message:"Add your name in Builder before exporting.",recommendation:"Enter your name in Core Info; confirm it against your source."});
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
        basis:QUALITY_GUARDIAN_BASES.RULE,elementIds:[event.id],
        message:`“${clean(event.title)||"Untitled event"}” is a low-confidence AI interpretation.`,
        recommendation:"Compare the title, category, institution, and dates with the source.",
        evidence:{confidence}
      });
    }
    const title=normalizedTitle(event?.title);
    const category=clean(event?.categoryId).toLowerCase();
    const likelyCategory=/(?:award|honou?r|prize|dean.?s list)/.test(title)
      ?"education"
      :/(?:research|publication|poster|abstract)/.test(title)
        ?"research"
        :null;
    if(event.fields?.categoryConfirmed!==true&&likelyCategory&&category&&category!==likelyCategory){
      add(findings,{
        section:"CONTENT",code:"CATEGORY_REVIEW",severity:"REVIEW",
        basis:QUALITY_GUARDIAN_BASES.RULE,elementIds:[event.id],
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

// Use the same final painted collision gate as export. Its recognized automatic
// native arrows use filled shaft/head polygons; authored and unknown paths keep
// conservative envelopes rather than borrowing automatic ownership.
export function qualityGuardianRenderedCollisionWarnings(rendered,{advancedGroups=[]}={}){
  const paint=resolveFounderPresentationSvg(rendered.svg,{advancedGroups});
  return materialPresentationCollisions(paint).map(({elementIds})=>({
    code:"MATERIAL_PAINT_COLLISION",severity:"REVIEW",elementIds
  }));
}

function inspectLayout(document,findings){
  let collisionWarnings=[];
  try{
    collisionWarnings=qualityGuardianRenderedCollisionWarnings(
      serializeFounderPresentation(document,{scope:"FULL_STORY"}),
      {advancedGroups:document.advanced?.groups||[]});
  }catch{
    // Resolution failures retain the existing conservative review fallback.
    try{collisionWarnings=safeArray(analyzeCollisionLayout(document,{scope:"FULL_STORY"})?.warnings).filter(({severity})=>severity!=="INFO");}catch{}
  }
  if(collisionWarnings.length){
    const ids=[...new Set(collisionWarnings.flatMap(({elementIds})=>safeArray(elementIds)))];
    add(findings,{
      section:"LAYOUT",code:"COLLISION_RISK",severity:"REVIEW",
      basis:QUALITY_GUARDIAN_BASES.PRESENTATION,elementIds:ids,
      message:`${collisionWarnings.length} potential ${collisionWarnings.length===1?"collision needs":"collisions need"} attention.`,
      recommendation:"Use Fix for me to separate overlapping event positions, then visually confirm the result.",
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
  // Check the final painted text. Character count alone missed two-month
  // duration labels squeezed by SVG textLength into unreadable glyphs.
  let compressed=[],longLabels=[];
  try{
    const rendered=serializeFounderPresentation(document,{scope:"FULL_STORY"});
    // Presentation warnings describe only labels on the included Founder board.
    // Source confidence, provenance and category review remain separate content checks.
    longLabels=[...(rendered.scene.arrows||[]),...(rendered.scene.flags||[])].map(event=>{
      const display=event.display||{},fields=event.kind==='arrow'?[display.role,display.institution,display.location]:[display.label,display.institution];
      const labels=fields.map(clean).filter(Boolean);return{id:event.id,title:labels.join(' · '),long:labels.some(label=>label.length>58)};
    }).filter(event=>event.long);
    const omitted=rendered.scene.omissions||[];
    if(omitted.length)add(findings,{section:"CHRONOLOGY",code:"EVENTS_NOT_RENDERABLE",severity:"BLOCK_EXPORT",
      basis:QUALITY_GUARDIAN_BASES.SOURCE_FACT,elementIds:omitted.map(item=>item.id),
      message:`${omitted.length} included event${omitted.length===1?' cannot':'s cannot'} appear on the timeline.`,
      recommendation:"Review missing or invalid dates before exporting. No event will be silently omitted.",evidence:{count:omitted.length}});
    const pendingMedia=rendered.scene.mediaProjection?.pendingIds||[];
    if(pendingMedia.length)add(findings,{section:"READABILITY",code:"MEDIA_PENDING_RESOLUTION",severity:"REVIEW",
      basis:QUALITY_GUARDIAN_BASES.PRESENTATION,elementIds:pendingMedia,
      message:"Attached images must load before the final export can be verified.",
      recommendation:"Preview your images. Export will stop if any attached image cannot be loaded.",evidence:{count:pendingMedia.length}});
    try{assertCompleteFounderPresentation(rendered,{allowPendingMedia:true});}catch(error){
      if(['TIMELINE_EXPORT_MISSING_FIELDS','TIMELINE_EXPORT_INCOMPLETE'].includes(error.code)&&!omitted.length)
        add(findings,{section:"CHRONOLOGY",code:error.code,severity:"BLOCK_EXPORT",basis:QUALITY_GUARDIAN_BASES.SOURCE_FACT,
          elementIds:error.eventIds||error.fields?.map(field=>field.id)||[],message:error.message,
          recommendation:"Review these source facts and their visible representation before exporting.",evidence:{fields:error.fields||[]}});
    }
    const paint=resolveFounderPresentationSvg(rendered.svg);
    const materialCollisions=materialPresentationCollisions(paint);
    if(materialCollisions.length)add(findings,{section:"LAYOUT",code:"PRESENTATION_TEXT_COLLISION",severity:"BLOCK_EXPORT",
      basis:QUALITY_GUARDIAN_BASES.PRESENTATION,elementIds:[...new Set(materialCollisions.flatMap(c=>c.elementIds))],
      message:"Some visible text is overlapped or hidden by another object.",recommendation:"Adjust the layout and review the preview before exporting.",evidence:{count:materialCollisions.length}});
    const outside=paint.nodes.filter(node=>node.kind==='text'&&(node.bounds.x<-.5||node.bounds.y<-.5||node.bounds.x+node.bounds.width>BOARD.width+.5||node.bounds.y+node.bounds.height>BOARD.height+.5));
    if(outside.length)add(findings,{section:"LAYOUT",code:"PRESENTATION_TEXT_OFF_CANVAS",severity:"BLOCK_EXPORT",
      basis:QUALITY_GUARDIAN_BASES.PRESENTATION,elementIds:[...new Set(outside.map(node=>node.semanticRef||node.groupId||node.id))],
      message:`${outside.length} visible text block${outside.length===1?' extends':'s extend'} beyond the exported page.`,recommendation:"Adjust the layout and inspect the whole exported page before sharing.",evidence:{count:outside.length}});
    const overflow=paint.nodes.filter(node=>node.kind==='text'&&node.sourceAttributes['data-text-overflow']==='true');
    if(overflow.length)add(findings,{section:"READABILITY",code:"TEXT_CONTAINER_OVERFLOW",severity:"BLOCK_EXPORT",basis:QUALITY_GUARDIAN_BASES.PRESENTATION,
      elementIds:overflow.map(node=>node.groupId||node.id),message:"Some text does not fit its container at the selected minimum size.",recommendation:"Enlarge the text container or review the layout. Source text has been preserved.",evidence:{count:overflow.length}});
    const placeholders=paint.nodes.filter(node=>node.kind==='text'&&/^(?:PROFILE PHOTO|DROP PHOTO\s*\d*|PROGRAM LOGO|Date pending)$/.test(node.text.trim()));
    if(placeholders.length)add(findings,{section:"MISSIONMED_FORMAT",code:"UNFINISHED_PRESENTATION_FURNITURE",severity:"REVIEW",basis:QUALITY_GUARDIAN_BASES.PRESENTATION,
      message:"The preview includes empty photo or interview placeholders.",recommendation:"Review the final page before sharing; empty editor placeholders are not finished content.",evidence:{count:placeholders.length}});
    compressed=paint.nodes.filter(node=>{
      if(node.kind!=="text"||!node.sourceAttributes.textLength||node.characterSpacing>=0)return false;
      const naturalWidth=node.bounds.width-node.characterSpacing*(node.text.length-1);
      return naturalWidth>0&&node.bounds.width/naturalWidth<.72;
    });
  }catch(error){
    add(findings,{section:"LAYOUT",code:"PRESENTATION_UNAVAILABLE",severity:"BLOCK_EXPORT",basis:QUALITY_GUARDIAN_BASES.PRESENTATION,
      message:error?.code==='TIMELINE_SCENE_RECOVERY_REQUIRED'?"Your saved layout needs recovery before export.":"The timeline could not be rendered, so its layout has not passed review.",
      recommendation:"Review the timeline or restore a prior version from History, then run this check again.",evidence:{code:String(error?.code||'RENDER_FAILED')}});
  }
  if(compressed.length)add(findings,{
    section:"READABILITY",code:"COMPRESSED_PRESENTATION_TEXT",severity:"REVIEW",
    basis:QUALITY_GUARDIAN_BASES.PRESENTATION,
    elementIds:[...new Set(compressed.map(node=>node.semanticRef||node.groupId||node.id))],
    message:`${compressed.length} presentation ${compressed.length===1?"label is":"labels are"} horizontally compressed and may be unreadable.`,
    recommendation:"Wrap the visible label or give it more room, then inspect the exported page at normal viewing size. Keep the source facts unchanged.",
    evidence:{count:compressed.length,minimumWidthRatio:Math.min(...compressed.map(node=>node.bounds.width/(node.bounds.width-node.characterSpacing*(node.text.length-1))))}
  });
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
  const receipt=analysis?.providerReceipt;
  const receiptVerified=Boolean(receipt?.responseId && receipt?.model && receipt?.store===false
    && /^[a-f0-9]{64}$/.test(receipt?.inputSha256||"") && /^[a-f0-9]{64}$/.test(receipt?.outputSha256||""));
  const aiStatus=analysis?.status==="COMPLETE"&&analysis?.mode==="SERVER_AI"&&receiptVerified
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
      const providerClaimedBasis=clean(finding?.basis);
      const safePresentationKinds=new Set(['AUTO_ARRANGE_EVENTS','CLAMP_OBJECTS','RESTORE_THEME_BACKGROUND','RESTORE_DEFAULT_THEME']);
      if(actionMode==="FIX_FOR_ME"&&(chipBasis(providerClaimedBasis)!==QUALITY_GUARDIAN_BASES.PRESENTATION||!safePresentationKinds.has(clean(finding?.fixKind))))return[];
      const basis=QUALITY_GUARDIAN_BASES.AI_INFERENCE;
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
          providerClaimedBasis,
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
      providerReceipt:aiStatus==="COMPLETE"?receipt:null,
      providerAuthenticity:aiStatus==="COMPLETE"&&analysis?.providerAuthenticity?clone(analysis.providerAuthenticity):null,
      founderStandardProvenance:aiStatus==="COMPLETE"&&analysis?.founderStandardProvenance?clone(analysis.founderStandardProvenance):null,
      provider:aiStatus==="COMPLETE"?clean(analysis.provider):null,
      model:aiStatus==="COMPLETE"?clean(analysis.model):null,
      promptVersion:clean(analysis?.promptVersion),
      standardVersion:clean(analysis?.standardVersion),
      unavailableMessage:aiStatus==="UNAVAILABLE"
        ?clean(analysis?.unavailableMessage)||(analysis?.status==="COMPLETE"&&!receiptVerified?"The provider receipt could not be verified. Showing MissionMed rules only.":"Timeline AI is temporarily unavailable. Your Timeline was not changed.")
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

const MAX_LAYOUT_SEARCH_CANDIDATES=8;

function autoArrangeLanesWithoutWorsening(document,initial,budget){
  const events=safeArray(document?.events);
  const visible=new Set(initial.boxes.filter(box=>box.kind==='event').map(box=>String(box.id)));
  const authored=new Set(safeArray(document?.advanced?.scene?.objects)
    .filter(object=>object.type==='event')
    .flatMap(object=>[String(object.semanticRef||''),String(object.id||'')]));
  // The chronological composer ignores unlocked lane values and all milestone
  // lanes. Do not mutate or serialize those ineffective candidates. An explicit
  // Advanced event placement also owns its geometry independently of lanes.
  const ordered=events.filter(event=>visible.has(String(event.id))&&
    event.manualOffset?.laneLocked&&Number.isInteger(event.lane)&&
    String(event.eventType??event.kind??event.type??'').toLowerCase()!=='milestone'&&
    event.categoryId!=='education'&&event.fields?.builderDomain!=='explanation'&&
    !authored.has(String(event.id)))
    .sort((left,right)=>String(left.id).localeCompare(String(right.id)));
  const before=initial.stats.collisionCount;
  let bestReview=initial,changed=false;
  const laneLimit=Math.max(1,Math.min(10,events.length));
  for(const event of ordered){
    if(!budget.remaining||!bestReview.stats.collisionCount)break;
    const currentLane=event.lane;
    let bestLane=currentLane;
    for(let lane=0;lane<laneLimit&&budget.remaining;lane+=1){
      if(lane===currentLane)continue;
      budget.remaining--;
      event.lane=lane;
      try{
        const review=analyzeCollisionLayout(document,{scope:'FULL_STORY'});
        if(review.stats.collisionCount<bestReview.stats.collisionCount){
          bestReview=review;bestLane=lane;
        }
      }catch{}finally{event.lane=currentLane;}
      if(!bestReview.stats.collisionCount)break;
    }
    event.lane=bestLane;
    if(bestLane!==currentLane)changed=true;
  }
  return{changed,before,after:bestReview.stats.collisionCount,review:bestReview};
}

function reflowMilestonePresentation(document,initial,budget){
  let bestScore=initial.stats.collisionCount,moved=0;
  if(!bestScore)return{changed:false,moved,before:0,after:0};
  const implicated=new Set(initial.warnings.flatMap(warning=>warning.elementIds));
  const milestones=initial.boxes.filter(box=>box.kind==='milestone'&&implicated.has(box.id)).slice(0,8);
  let scene=null;
  for(const box of milestones){
    if(!budget.remaining)break;
    scene=scene||serializeFounderPresentation(document,{scope:'FULL_STORY'}).scene;
    const placed=locked407FMilestoneGeometry(scene,box.id);
    // Respect an explicit Advanced placement/lock. This repair owns only new
    // offsets and its prior offsets; it never changes date-axis x positions.
    if(!placed||placed.rotation||placed.object?.locked||placed.object?.groupId||
      (placed.object&&placed.object.presentation?.guardianAnchor!=='axis'))continue;
    const axis=initial.fixedRegions.find(region=>region.id==='furniture:axis');
    const flag=scene.flags.find(flag=>String(flag.id)===String(box.id));
    // Attached exam-result flags keep their native study-arrow relationship.
    if(flag?.examAttemptId&&scene.arrows.some(arrow=>arrow.study&&arrow.examAttemptId===flag.examAttemptId))continue;
    const positions=[8,58,87]
      .filter(y=>Math.abs(y-placed.y)>.01).sort((a,b)=>Math.abs(a-placed.y)-Math.abs(b-placed.y));
    let best=null;
    for(const y of positions){
      if(!budget.remaining)break;
      budget.remaining--;
      const result=applySceneCommandToDocument(document,{
        kind:'geometry',target:{type:'event',id:placed.object?.id||box.id},
        geometry:{x:placed.x,y,width:placed.width,height:placed.height,rotation:0},
        create:{type:'event',semanticRef:box.id,aspectLocked:false,presentation:{eventType:'milestone',guardianAnchor:'axis'}},
        label:'Quality Guardian: separate milestone flags'
      },{scope:'FULL_STORY'});
      if(!result.changed)continue;
      const review=analyzeCollisionLayout(result.document,{scope:'FULL_STORY'});
      const candidate=review.boxes.find(item=>item.id===box.id);
      if(!candidate||candidate.x<0||candidate.y<0||candidate.x+candidate.w>1920||candidate.y+candidate.h>1080)continue;
      // Poles intentionally meet the axis. Flag bodies and labels must remain
      // outside the date ribbon, even though that connector overlap is exempt.
      if(axis&&candidate.y<axis.y+axis.h+6&&candidate.y+candidate.h>axis.y-6)continue;
      const score=review.stats.collisionCount;
      if(score<bestScore){bestScore=score;best=result.document;}
      if(bestScore===0)break;
    }
    if(best){document.advanced=best.advanced;document.presentationOverrides=best.presentationOverrides;moved++;scene=null;}
    if(bestScore===0)break;
  }
  return{changed:moved>0,moved,before:initial.stats.collisionCount,after:bestScore};
}

function autoArrangeWithoutWorsening(document){
  const initial=analyzeCollisionLayout(document,{scope:'FULL_STORY'});
  const budget={remaining:MAX_LAYOUT_SEARCH_CANDIDATES};
  const lanes=autoArrangeLanesWithoutWorsening(document,initial,budget);
  const milestones=reflowMilestonePresentation(document,lanes.review,budget);
  return{changed:lanes.changed||milestones.changed,before:initial.stats.collisionCount,after:milestones.after,milestonesMoved:milestones.moved};
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
    const result=autoArrangeWithoutWorsening(next);
    if(result.changed){
      changes.push({kind:"AUTO_ARRANGE_EVENTS",scope:"PRESENTATION",message:`Adjusted event presentation and reduced collision warnings from ${result.before} to ${result.after}.`});
    }
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

// A proposal must improve the actual paint, not just mutate layout metadata.
// This is mechanical qualification only; it does not grant visual acceptance.
function layoutProposalSourceSnapshot(document,legacyIds){
  const value=clone(document);
  delete value.revision;delete value.presentationOverrides;
  if(value.metadata)delete value.metadata.qualityGuardian;
  for(const event of safeArray(value.events)){delete event.manualOffset;delete event.lane;}
  const stripGeometry=item=>{
    const copy={...item};
    for(const field of ['geometry','x','y','width','height','rotation','locked','aspectLocked','zIndex','layerIndex'])delete copy[field];
    return copy;
  };
  if(value.advanced){
    for(const collection of ['media','textBlocks','elements'])if(Array.isArray(value.advanced[collection]))value.advanced[collection]=value.advanced[collection].map(item=>stripGeometry(collection==='textBlocks'?{...item,type:item.type||'text'}:item));
    if(value.advanced.scene){
      value.advanced.scene.objects=safeArray(value.advanced.scene.objects).filter(item=>item.type!=='event'&&!legacyIds.has(String(item.id))).map(stripGeometry);
      delete value.advanced.scene.revision;delete value.advanced.scene.legacyDigest;
      if(!value.advanced.scene.objects.length&&!safeArray(value.advanced.scene.groups).length)delete value.advanced.scene;
    }
  }
  return stableLayoutJson(value);
}
function measuredProposalPaint(rendered){
  const paint=resolveFounderPresentationSvg(rendered.svg,{measureText:rendered.scene.measureText});
  const visible=paint.nodes.filter(node=>node.bounds&&node.groupId&&
    !node.sourceAttributes['data-board-background']&&!node.sourceAttributes['data-advanced-background']&&
    Number(node.style.opacity??1)>0&&Number(node.style['fill-opacity']??1)>0&&
    node.sourceAttributes.visibility!=='hidden'&&node.sourceAttributes.display!=='none'&&
    !(node.kind==='path'&&(node.lineOnly||node.style.fill==='none'||node.bounds.width<1||node.bounds.height<1)));
  const parts=visible.map(node=>({id:node.id,groupId:node.groupId,
    role:node.groupId==='furniture:axis'?'AXIS':node.role==='event'?'EVENT':['media','annotation'].includes(node.role)?'OBJECT':'FURNITURE',
    bounds:node.occlusionBounds||node.bounds,overflow:node.sourceAttributes['data-text-overflow']==='true'}));
  const safety=measureLayoutCriticSafety(parts);
  const templateViolationCount=[...founderMilestoneTemplateGeometry(rendered.scene,paint),...founderDurationTemplateGeometry(rendered.scene,paint)].filter(violatesFounderTemplateBand).length;
  const unreadableCount=visible.filter(node=>node.kind==='text'&&(node.fontSize<12||
    node.characterSpacing<0&&node.bounds.width/(node.bounds.width-node.characterSpacing*(node.text.length-1))<.72)).length;
  return {paint,visible,metrics:{...safety,materialCollisionCount:materialPresentationCollisions(paint).length,templateViolationCount,unreadableCount}};
}
function visibleProposalContent(nodes){
  const text=new Map(),images=[];
  for(const node of nodes){
    if(node.kind==='text'){
      const key=[node.groupId,node.semanticRef||'',node.sourceAttributes['data-material-field']||''].join('|');
      text.set(key,[...(text.get(key)||[]),node.text]);
    }
    if(node.kind==='image')images.push({groupId:node.groupId,source:node.source,crop:node.crop||null});
  }
  return stableLayoutJson({text:[...text].map(([key,lines])=>[key,lines.join(' ').replace(/\s+/g,' ').trim()]).sort(),images});
}
export function qualifyRenderedLayoutImprovement(beforeRendered,afterRendered,{beforeDocument,afterDocument}={}){
  const result={qualified:false,mechanicalOnly:true,reasonCode:'LAYOUT_PROPOSAL_RENDER_UNAVAILABLE',sourceUnchanged:false,geometryChanged:false,before:null,after:null};
  if(!beforeDocument||!afterDocument)return Object.freeze({...result,reasonCode:'LAYOUT_PROPOSAL_SOURCE_UNVERIFIED'});
  try{
    // Scene reconciliation may materialize existing legacy notes/media. Their
    // source collections and the visible text/image checks below remain bound.
    const legacyIds=new Set(advancedObjects(beforeDocument).map(item=>String(item.id)));
    result.sourceUnchanged=layoutProposalSourceSnapshot(beforeDocument,legacyIds)===layoutProposalSourceSnapshot(afterDocument,legacyIds);
    if(!result.sourceUnchanged)return Object.freeze({...result,reasonCode:'LAYOUT_PROPOSAL_SOURCE_CHANGED'});
    const before=measuredProposalPaint(beforeRendered),after=measuredProposalPaint(afterRendered);
    result.before=before.metrics;result.after=after.metrics;
    if(visibleProposalContent(before.visible)!==visibleProposalContent(after.visible))return Object.freeze({...result,reasonCode:'LAYOUT_PROPOSAL_VISIBLE_CONTENT_CHANGED'});
    const positions=nodes=>stableLayoutJson(nodes.map(node=>({groupId:node.groupId,semanticRef:node.semanticRef,kind:node.kind,bounds:node.bounds})));
    result.geometryChanged=positions(before.visible)!==positions(after.visible);
    const hard=['collisionCount','axisOverlapCount','materialCollisionCount','offCanvasCount','overflowCount','templateViolationCount','unreadableCount'];
    if(hard.some(field=>after.metrics[field]>0))return Object.freeze({...result,reasonCode:'LAYOUT_PROPOSAL_HARD_ERRORS_REMAIN'});
    // Completeness/source/media gates are additional to geometry safety. Never
    // permit an unresolved image to disappear as a supposed improvement.
    try{assertCompleteFounderPresentation(afterRendered);}catch(error){return Object.freeze({...result,reasonCode:error.code||'LAYOUT_PROPOSAL_INCOMPLETE'});}
    if(!result.geometryChanged)return Object.freeze({...result,reasonCode:'LAYOUT_PROPOSAL_UNCHANGED'});
    if(after.metrics.crowdingCount>before.metrics.crowdingCount||after.metrics.crowdingPairs.some(pair=>!before.metrics.crowdingPairs.includes(pair)))return Object.freeze({...result,reasonCode:'LAYOUT_PROPOSAL_CROWDING_WORSENED'});
    const clearedHardErrors=hard.some(field=>before.metrics[field]>after.metrics[field]);
    const reducedCrowding=before.metrics.crowdingCount-after.metrics.crowdingCount>=Math.max(1,Math.ceil(before.metrics.crowdingCount*.2));
    if(!clearedHardErrors&&!reducedCrowding)return Object.freeze({...result,reasonCode:'LAYOUT_PROPOSAL_NO_MATERIAL_IMPROVEMENT'});
    return Object.freeze({...result,qualified:true,reasonCode:'LAYOUT_PROPOSAL_MECHANICALLY_QUALIFIED'});
  }catch{return Object.freeze(result);}
}

function stateSymbol(state){return state==="READY"?"✓":state==="BLOCKED"?"✕":"⚠";}

export function qualityGuardianViewer(entitlement={},route="home"){
  const subject=clean(entitlement?.subjectKind).toLowerCase();
  const roles=safeArray(entitlement?.roles).map((value)=>clean(value).toLowerCase());
  if(subject==="administrator"||roles.includes("administrator"))return"Founder / administrator view";
  if(route==="advisor"||subject==="advisor"||roles.includes("advisor")||roles.includes("mentor"))return"Founder / mentor review";
  return"Student view";
}

export function renderLocalLayoutReview(state={},canFix=true){
  const receipt=state.receipt;
  const messages={UNAVAILABLE:'Local AI layout review is unavailable.',READY:'Local AI layout review is ready.',REVIEWING:state.stage==='MEASURING'?'Measuring the current layout…':state.stage==='VALIDATING'?'Validating AI recommendations…':'Waiting for the AI layout review…',FAILED:'AI review failed. Your timeline is unchanged.',STALE:'The layout changed during review. Review again to use the current layout.',APPLIED:'Validated layout changes applied.',REVIEWED:'AI review completed; no safe changes were applied.'};
  return `<section data-local-layout-review><h3>Local AI layout review</h3>
    <p>Review layout with AI sends anonymous geometry and measured text bounds to OpenAI. Biography, words, dates, photos and source files stay local. Only validated geometry improvements can be applied.</p>
    <button type="button" class="button secondary" data-local-layout-review-start ${!state.available||state.busy||!canFix?'disabled':''}>${state.busy?'Reviewing layout…':'Review layout with AI'}</button>
    <p role="status" data-local-layout-review-status>${escapeHtml(messages[state.status]||messages.UNAVAILABLE)}${state.errorCode?` (${escapeHtml(state.errorCode)})`:''}</p>
    ${receipt?`<details class="quality-provider-receipt"><summary>Local AI layout receipt</summary><dl>
      <dt>Result</dt><dd>${escapeHtml(messages[receipt.status]||receipt.status)}</dd>
      <dt>Provider response</dt><dd>${escapeHtml(receipt.providerReceipt.responseId)}</dd>
      <dt>Model</dt><dd>${escapeHtml(receipt.providerReceipt.model)}</dd>
      <dt>Received</dt><dd>${escapeHtml(receipt.providerReceipt.receivedAt)}</dd>
      <dt>Layout digest</dt><dd>${escapeHtml(receipt.sceneDigest)}</dd>
      <dt>Recommendations / applied / rejected</dt><dd>${receipt.recommended} / ${receipt.applied} / ${receipt.rejected}</dd>
      ${receipt.rejectionCodes?.length?`<dt>Validation holds</dt><dd>${receipt.rejectionCodes.map(escapeHtml).join(', ')}</dd>`:''}
      <dt>Provider storage</dt><dd>store: false</dd>
      <dt>Biography</dt><dd>Unchanged</dd></dl></details>`:''}
  </section>`;
}

export function renderQualityGuardian(report,{
  viewer="Student view",
  canFix=true,
  localLayoutReview=null,
  controlClasses={secondary:"button secondary",tertiary:"button tertiary",primary:"button primary"}
}={}){
  const reviewViewer=viewer!=="Student view";
  /* Law G-0: the header must state which engine actually ran. Without a COMPLETE server
     result nothing here was reviewed by AI, so the page may not use the word at all. */
  const aiComplete=report.ai?.status==="COMPLETE"&&Boolean(report.ai?.providerReceipt?.responseId);
  return`<div class="quality-guardian" data-quality-guardian-report>
    <p class="micro-label">Timeline Quality Guardian · ${escapeHtml(viewer)}</p>
    <h2 id="quality-guardian-title">${escapeHtml(report.headline)}</h2>
    <p>${aiComplete
      ?"Source facts, AI inferences, and presentation recommendations are shown separately."
      :"Every finding below comes from MissionMed's own checks. These findings were not reviewed by AI."} Fix for me never changes your biography.</p>
    ${aiComplete
      ?`<p class="status-chip" data-quality-ai-status="COMPLETE">Live AI review · ${escapeHtml(report.ai.model)} · Standard ${escapeHtml(report.ai.standardVersion)}</p>`
      :`<p class="status-chip" data-quality-ai-status="${escapeHtml(report.ai?.status||"UNAVAILABLE")}">${escapeHtml(report.ai?.unavailableMessage||"Quick check · MissionMed rules only")}</p>`}
    ${aiComplete?`<details class="quality-provider-receipt"><summary>AI review receipt</summary><dl><dt>Provider response</dt><dd>${escapeHtml(report.ai.providerReceipt.responseId)}</dd><dt>Model</dt><dd>${escapeHtml(report.ai.providerReceipt.model)}</dd><dt>Received</dt><dd>${escapeHtml(report.ai.providerReceipt.receivedAt||"")}</dd>${receipt.rejectionCodes?.length?`<dt>Validation holds</dt><dd>${receipt.rejectionCodes.map(escapeHtml).join(', ')}</dd>`:''}
      <dt>Provider storage</dt><dd>store: false</dd></dl></details>`:""}
    ${reviewViewer?`<section data-quality-oversight aria-label="Founder and mentor quality summary">
      <h3>Review summary</h3>
      <dl>
        <div><dt>Issues found</dt><dd>${report.oversight.issueCount}</dd></div>
        <div><dt>Layout fixes applied</dt><dd>${report.oversight.appliedFixes.length}</dd></div>
        <div><dt>Unresolved factual questions</dt><dd>${report.oversight.unresolvedFactualQuestions}</dd></div>
        <div><dt>Student-confirmed exceptions</dt><dd>${report.oversight.studentConfirmedExceptions.length}</dd></div>
        <div><dt>Export readiness</dt><dd>${report.oversight.exportReady?"Ready":"Blocked"}</dd></div>
      </dl>
    </section>`:""}
    ${localLayoutReview?renderLocalLayoutReview(localLayoutReview,canFix):''}
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
  let closed=false,local=null;
  if(isLocalLayoutReviewLocation())local=createLocalLayoutReview(store,{onState:()=>{if(!closed)show();}});
  const show=()=>{
    const report=analyzeTimelineQuality(store.document,{stage});
    overlay._opener=opener;
    overlay.innerHTML=`<div class="overlay-scrim" data-quality-dismiss><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="quality-guardian-title">${renderQualityGuardian(report,{
      viewer:qualityGuardianViewer(store.entitlement,store.route),
      canFix:store.entitlement?.canMutate===true,
      localLayoutReview:local?{...local.state,receipt:Object.hasOwn(local.state,'receipt')?local.state.receipt:store.document?.metadata?.qualityGuardian?.localLayoutReview}:null
    })}</section></div>`;
    const close=()=>{
      closed=true;
      overlay.replaceChildren();
      overlay._opener=null;
      if(opener?.isConnected)opener.focus();
    };
    overlay.querySelector('[data-local-layout-review-start]')?.addEventListener('click',()=>local?.review());
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
  local?.capabilities();
  if(continueToExport&&report?.exportReady===true){
    // The visible check remains open so the student explicitly chooses Continue.
  }
  return report;
}
