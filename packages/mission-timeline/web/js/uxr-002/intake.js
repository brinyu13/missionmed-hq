import {MYERAS_PROFILE_FIELDS,myerasDate,myerasReviewErrors,synchronizeMyerasInstitution,synchronizeMyerasOngoing} from './myeras-intake-adapter.js';
import {parseExactDate} from './exact-date-field.js';
import {MAX_DIRECT_SOURCE_BYTES,MAX_FILE_BYTES} from "../ingestion/file-inspector.js";
import {CATEGORIES,VISIBILITY} from "./constants.js";
import {bindImportedBuilderEvent022} from "./imported-builder-entry-022.js";
import {installMonthFields,monthFieldMarkup} from "./month-field.js";
import {dateLabel,escapeHtml,monthIndex,monthString} from "./utils.js";

export const INTAKE_STAGES=Object.freeze({
  UPLOAD:"upload",
  EXTRACTION:"extraction",
  REVIEW:"review",
  DONE:"done"
});

export const INTAKE_PROGRESS=Object.freeze(["Upload","Read","Review","Done"]);
/* AAA-019 — student-language stages (11 §3). Each stage is shown for at least
   EXTRACTION_MIN_STAGE_MS even when the read is instant, so the student can see what
   happened rather than a flash between UPLOAD and REVIEW. */
export const EXTRACTION_STATUSES=Object.freeze([
  "Reading your CV…",
  "Finding your education and training…",
  "Matching dates…",
  "Organizing your experiences…",
  "Building your Timeline…",
  "Checking spacing and readability…"
]);
export const EXTRACTION_MIN_STAGE_MS=550;
export const DOCUMENT_TYPES=Object.freeze(["CV","MyERAS export","Résumé"]);
export const INTAKE_FILTERS=Object.freeze(["all","accepted","rejected","undecided"]);
export const MAX_DOCUMENT_BYTES=MAX_DIRECT_SOURCE_BYTES;

export const INTAKE_COPY=Object.freeze({
  uploadTitle:"Add your document",
  privacy:"Your document is stored privately and, when secure AI review is available, its extracted text is sent to MissionMed's approved AI processor to suggest events. You can delete the source afterward. Nothing appears on your timeline until you approve it.",
  consent:"I consent to secure AI-assisted extraction and understand I'll review every suggestion before it lands on my timeline.",
  read:"Read my document →",
  reviewSubline:"Accept what's right, fix what's close, reject what's wrong. Nothing lands until you decide.",
  emptyAccepted:"Nothing accepted yet",
  unreadable:"We couldn't read text in this document. If it's a scan, export a text PDF from MyERAS or your CV app and try again.",
  empty:"We read it, but didn't find dated events we're confident about. The guided builder takes about 10 minutes.",
  doneBody:"Your document has been processed. You can delete it now or keep it for another pass.",
  fileError:"PDF or DOCX, up to 15MB.",
  rescueFileError:"PPTX, PDF, PNG, or JPEG, up to 15MB.",
  suggestionsSubline:"We checked your document before you start. Nothing here changes your history unless you apply it, and every applied change can be undone.",
  suggestionsClear:"We checked your document and found nothing to flag.",
  questionsClear:"Your document already answers everything we need for this one."
});

export const SUGGESTION_LABELS=Object.freeze({
  POSSIBLE_DUPLICATE:"Possible duplicate",
  CATEGORY_REVIEW:"Category needs you",
  CHRONOLOGY_REVIEW:"Dates disagree",
  MISSING_END_DATE:"Missing end date",
  SOURCE_ITEM_NOT_INCLUDED:"Line we did not use",
  RESCUE_CV_ONLY:"CV entry to consider",
  RESCUE_TIMELINE_ONLY:"Timeline entry to verify",
  LABEL_READABILITY:"Label too long",
  VISUAL_OVERLAP:"Crowded timeline"
});

/* C-09: HIGH/MEDIUM/LOW must change what the student is asked to DO, not just the tag
   colour. HIGH is bulk-acceptable, MEDIUM is prefilled but confirmed one by one, and LOW
   asks only for the facts the document does not already state. */
export const REVIEW_LANES=Object.freeze([
  Object.freeze({id:"high",title:"Ready to accept",hint:"Your document states these outright. Accept them together."}),
  Object.freeze({id:"medium",title:"Confirm these",hint:"Prefilled from your document. Give each one a quick look."}),
  Object.freeze({id:"low",title:"Needs your help",hint:"We are missing something here, so we ask only for that."})
]);

const PROPOSABLE_FIELDS=Object.freeze(["title","categoryId","startDate","endDate","openEnded","eventType"]);
const ONGOING_FIELD_BY_CATEGORY=Object.freeze({clinical:"currentlyOnRotation",work:"stillWorking",research:"ongoing"});
const INSTITUTION_FIELD_BY_CATEGORY=Object.freeze({education:"medicalSchool",clinical:"institution",work:"organization",research:"institution"});
const INSTITUTION_QUESTIONS=Object.freeze({
  education:"Which school was this?",
  clinical:"Which hospital or clinic was this?",
  work:"Which organization was this?",
  research:"Which institution or lab was this?"
});

export const INTAKE_ADAPTER_CONTRACT=Object.freeze({
  method:"extract",
  input:"{ file, metadata, documentType, signal }",
  output:"{ readable, candidates[] }",
  bundledExtractor:false,
  bundledFixtures:false,
  moduleNetworkCalls:false,
  timelineWritePolicy:"single approval batch only"
});

export const CATEGORY_REVIEW_FIELDS=Object.freeze({
  education:Object.freeze([
    {key:"medicalSchool",label:"Medical school",type:"text"},
    {key:"medicalSchoolCountry",label:"Medical school country",type:"text"},
    {key:"degree",label:"Degree",type:"select",options:["MD","DO","MBBS","Other"]},
    {key:"degreeOther",label:"Degree (other)",type:"text"},
    {key:"expectedGraduation",label:"I haven't graduated yet",type:"checkbox"},
    {key:"visaStatus",label:"Visa / work status",type:"select",options:["US citizen / permanent resident","Need H-1B","Need J-1","Other (text)","Prefer not to say"]},
    {key:"visaStatusOther",label:"Visa / work status (other)",type:"text"}
  ]),
  exams:Object.freeze([
    {key:"examSystem",label:"Exam system",type:"select",options:["USMLE","COMLEX-USA"]},
    {key:"examName",label:"Exam",type:"text"},
    {key:"result",label:"Result",type:"select",options:["Passed","Failed","Awaiting result"]},
    {key:"score",label:"Score (optional)",type:"text"},
    {key:"studyPeriodStart",label:"Started studying (optional)",type:"text"},
    {key:"showScoreOnTimeline",label:"Show score on timeline",type:"checkbox"}
  ]),
  clinical:Object.freeze([
    {key:"institution",label:"Institution",type:"text"},
    {key:"institutionShortName",label:"Institution short name",type:"text"},
    {key:"specialty",label:"Specialty",type:"text"},
    {key:"rotationType",label:"Rotation type",type:"select",options:["Elective","Sub-internship","Observership","Externship","Clerkship (core)","Other"]},
    {key:"city",label:"City",type:"text"},
    {key:"state",label:"State",type:"text"},
    {key:"currentlyOnRotation",label:"Currently on this rotation",type:"checkbox"}
  ]),
  work:Object.freeze([
    {key:"organization",label:"Organization",type:"text"},
    {key:"country",label:"Country",type:"text"},
    {key:"city",label:"City (optional)",type:"text"},
    {key:"kind",label:"Kind",type:"select",options:["Clinical","Non-clinical"]},
    {key:"stillWorking",label:"I still work here",type:"checkbox"},
    {key:"description",label:"One-line description (optional)",type:"text"}
  ]),
  research:Object.freeze([
    {key:"institution",label:"Institution / lab",type:"text"},
    {key:"role",label:"Role",type:"select",options:["Research assistant","Research fellow","Coordinator","Volunteer","Principal investigator","Other"]},
    {key:"roleOther",label:"Role (other)",type:"text"},
    {key:"ongoing",label:"Ongoing",type:"checkbox"},
    {key:"publicationStatus",label:"Publication status",type:"select",options:["Not published","Submitted","Accepted","Published"]},
    {key:"journal",label:"Journal / venue",type:"text"},
    {key:"publicationYear",label:"Publication year",type:"text"},
    {key:"authorPosition",label:"Author position",type:"select",options:["First author","Co-first author","Second author","Middle author","Last / senior author","Corresponding author"]},
    {key:"doiOrPmid",label:"DOI or PMID (optional)",type:"text"},
    {key:"markPublication",label:"Mark the publication on the timeline",type:"checkbox"}
  ]),
  personal:Object.freeze([
    {key:"when",label:"When",type:"select",options:["One date","A period"]},
    {key:"icon",label:"Icon",type:"select",options:["heart","home","plane","baby","ring","star","flag","globe","shield","sun","book","sparkle","graduation","certificate","hospital","memorial","award","research","career","family"]},
    {key:"visibility",label:"Visibility",type:"select",options:["Show everyone","Advisor only"]}
  ])
});

function clone(value){
  return structuredClone(value);
}

function traceOnlySourceCustody(value){
  if(!value||typeof value!=="object")return null;
  const reference={
    schemaVersion:String(value.schemaVersion||""),
    authority:String(value.authority||""),
    provider:String(value.provider||""),
    timelineObjectId:String(value.timelineObjectId||""),
    sha256:String(value.sha256||"").toLowerCase(),
    vaultFileId:String(value.vaultFileId||""),
    versionId:String(value.versionId||"")
  };
  if(
    reference.schemaVersion!=="timeline-source-custody-ref.1"||
    reference.authority!=="TRACE_ONLY"||
    reference.provider!=="missionmed-filevault-v2"||
    !reference.timelineObjectId||
    !/^[a-f0-9]{64}$/.test(reference.sha256)||
    !/^[1-9][0-9]{0,18}$/.test(reference.vaultFileId)||
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(reference.versionId)
  )return null;
  return reference;
}

function normalizedText(value){
  return String(value||"")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g," ")
    .trim();
}

function wordTokens(value){
  return new Set(normalizedText(value).split(/\s+/).filter(Boolean));
}

function bigrams(value){
  const compact=normalizedText(value).replace(/\s+/g," ");
  if(compact.length<2)return new Set(compact?[compact]:[]);
  return new Set(Array.from({length:compact.length-1},(_,index)=>compact.slice(index,index+2)));
}

function setSimilarity(first,second){
  if(!first.size&&!second.size)return 1;
  if(!first.size||!second.size)return 0;
  let shared=0;
  for(const value of first)if(second.has(value))shared+=1;
  return shared/(first.size+second.size-shared);
}

export function titleSimilarity(first,second){
  const left=normalizedText(first),right=normalizedText(second);
  if(!left&&!right)return 1;
  if(!left||!right)return 0;
  if(left===right)return 1;
  const tokenScore=setSimilarity(wordTokens(left),wordTokens(right));
  const leftPairs=bigrams(left),rightPairs=bigrams(right);
  let sharedPairs=0;
  for(const pair of leftPairs)if(rightPairs.has(pair))sharedPairs+=1;
  const pairScore=leftPairs.size+rightPairs.size?2*sharedPairs/(leftPairs.size+rightPairs.size):0;
  return Number(Math.max(tokenScore,pairScore).toFixed(4));
}

function monthRange(value){
  const start=monthIndex(value?.startDate||value?.date);
  if(!Number.isFinite(start))return null;
  const end=monthIndex(value?.endDate||value?.startDate||value?.date);
  return{start,end:Number.isFinite(end)?Math.max(start,end):start};
}

export function monthOverlapRatio(first,second){
  const left=monthRange(first),right=monthRange(second);
  if(!left||!right)return 0;
  const overlap=Math.max(0,Math.min(left.end,right.end)-Math.max(left.start,right.start)+1);
  if(!overlap)return 0;
  const shorter=Math.min(left.end-left.start+1,right.end-right.start+1);
  return Number((overlap/shorter).toFixed(4));
}

export function findDuplicate(candidate,existingEvents,{titleThreshold=.5,overlapThreshold=.5}={}){
  let best=null;
  for(const event of existingEvents||[]){
    if(event.categoryId!==candidate.categoryId)continue;
    const overlap=monthOverlapRatio(candidate,event);
    if(overlap<overlapThreshold)continue;
    const similarity=titleSimilarity(candidate.title,event.title);
    if(similarity<titleThreshold)continue;
    const score=overlap+similarity;
    if(!best||score>best.score){
      best={
        eventId:event.id,
        eventTitle:event.title,
        overlapRatio:overlap,
        titleSimilarity:similarity,
        score
      };
    }
  }
  if(!best)return null;
  delete best.score;
  return best;
}

function confidenceLevel(value){
  const raw=value?.confidence?.level??value?.confidenceLevel??value?.confidence??"low";
  const normalized=String(raw).toLowerCase();
  if(normalized==="high")return"high";
  if(normalized==="medium")return"medium";
  return"low";
}

function normalizedDecision(value){
  const raw=String(value||"undecided").toLowerCase().replace(/_/g,"-");
  if(["accepted","rejected","merge","add-anyway"].includes(raw))return raw;
  return"undecided";
}

function normalizeProposal(value){
  if(!value||typeof value!=="object")return null;
  const source=value.patch&&typeof value.patch==="object"?value.patch:{};
  const patch={};
  for(const field of PROPOSABLE_FIELDS)if(Object.hasOwn(source,field))patch[field]=clone(source[field]);
  if(!Object.keys(patch).length)return null;
  return{
    candidateId:String(value.candidateId||""),
    patch,
    label:String(value.label||"Apply this"),
    evidence:String(value.evidence||"")
  };
}

function normalizeSuggestion(value,index){
  const status=String(value?.status||"open").toLowerCase();
  return{
    id:String(value?.id||`suggestion-${index+1}`),
    type:String(value?.type||"CATEGORY_REVIEW").toUpperCase(),
    severity:String(value?.severity||"REVIEW").toUpperCase()==="INFO"?"INFO":"REVIEW",
    candidateIds:Array.isArray(value?.candidateIds)?value.candidateIds.map(String):[],
    eventIds:Array.isArray(value?.eventIds)?value.eventIds.map(String):[],
    sourceBlockIds:Array.isArray(value?.sourceBlockIds)?value.sourceBlockIds.map(String):[],
    reason:String(value?.reason||"").trim(),
    recommendation:String(value?.recommendation||"").trim(),
    source:String(value?.source||"AI_REVIEW").toUpperCase()==="DETERMINISTIC"?"DETERMINISTIC":"AI_REVIEW",
    proposal:normalizeProposal(value?.proposal),
    status:["applied","dismissed"].includes(status)?status:"open",
    previous:value?.previous&&typeof value.previous==="object"?clone(value.previous):null
  };
}

export function normalizeSuggestions(list){
  const normalized=(list||[])
    .filter((value)=>value&&typeof value==="object")
    .map(normalizeSuggestion)
    .filter((suggestion)=>suggestion.reason);
  return[...new Map(normalized.map((suggestion)=>[suggestion.id,suggestion])).values()];
}

function visibleSuggestions(state){
  if(!state||!isTimelineRescueReview(state))return state?.suggestions||[];
  const parser=state.extraction?.parser||{};
  const routine=new Set((parser.cleanupProposal?.actions||[]).filter(action=>
    ["RESTORE_CANONICAL_BACKGROUND","RESTORE_CANONICAL_FURNITURE","NORMALIZE_TYPOGRAPHY","REBUILD_SEMANTIC_EVENT"].includes(action.kind)).map(action=>String(action.id)));
  const matches=new Set((parser.reconciliation||[]).filter(item=>item.state==="MATCH").map(item=>
    `rescue-reconcile-${String(item.timelineCandidateId||"none")}-${String(item.cvCandidateId||"none")}-MATCH`));
  // Legacy reviews keep their original receipt; only exact routine-action/MATCH
  // IDs are presentation context. Unrelated warnings and real conflicts remain.
  return(state.suggestions||[]).filter(suggestion=>!routine.has(suggestion.id)&&!matches.has(suggestion.id));
}

export function openSuggestions(state){
  return visibleSuggestions(state).filter((suggestion)=>suggestion.status==="open");
}

export function suggestionsForCandidate(state,candidateId){
  return openSuggestions(state).filter((suggestion)=>suggestion.candidateIds.includes(candidateId));
}

function flaggedCandidateIds(state){
  const ids=new Set();
  for(const suggestion of openSuggestions(state)){
    if(suggestion.severity!=="REVIEW")continue;
    for(const id of suggestion.candidateIds)ids.add(id);
  }
  return ids;
}

/* A flagged entry can only ever be demoted out of the bulk-acceptable lane; a LOW entry is
   never promoted because something was flagged on it. */
export function reviewClassOf(candidate,flagged=new Set()){
  if(candidate?.fields?.myerasReview&&candidateQuestions(candidate).length)return"low";
  const level=candidate?.confidence==="high"?"high":candidate?.confidence==="medium"?"medium":"low";
  if(level==="high"&&(candidate?.duplicate||flagged.has(candidate?.id)||Object.keys(myerasReviewErrors(candidate)).length))return"medium";
  return level;
}

export function reviewLanes(state){
  const flagged=flaggedCandidateIds(state);
  const lanes={high:[],medium:[],low:[],decided:[]};
  for(const candidate of state?.candidates||[]){
    if(candidate.decision!=="undecided"||candidate.reviewLater){lanes.decided.push(candidate);continue;}
    lanes[reviewClassOf(candidate,flagged)].push(candidate);
  }
  return lanes;
}

export function candidateQuestions(candidate){
  const fields=candidate?.fields||{};
  const questions=[];
  if(!String(candidate?.title||"").trim())questions.push({key:"title",kind:"text",field:"title",label:"What should we call this?"});
  if(!candidate?.startDate)questions.push({key:"startDate",kind:"month",field:"startDate",label:"When did it start?"});
  if(candidate?.eventType==="duration"&&candidate?.startDate&&!candidate?.endDate&&candidate?.openEnded!==true){
    questions.push({key:"endDate",kind:"month",field:"endDate",label:"When did it end?"});
    const ongoing=ONGOING_FIELD_BY_CATEGORY[candidate.categoryId];
    if(ongoing)questions.push({key:ongoing,kind:"toggle",extra:ongoing,label:"I am still doing this"});
  }
  if(fields.categoryConfirmed!==true&&(fields.mappingReviewRequired===true||String(fields.canonicalType||"").toUpperCase()==="UNCLASSIFIED")){
    questions.push({key:"categoryId",kind:"category",field:"categoryId",label:"Which part of your story is this?"});
  }
  const institution=INSTITUTION_FIELD_BY_CATEGORY[candidate?.categoryId];
  const awardWithoutSchool=candidate?.categoryId==="education"&&String(fields.canonicalType||"").toUpperCase()==="AWARD_HONOR";
  if(institution&&!awardWithoutSchool&&!String(fields[institution]||"").trim()){
    questions.push({key:institution,kind:"text",extra:institution,label:INSTITUTION_QUESTIONS[candidate.categoryId]});
  }
  return questions;
}

function normalizeCandidate(value,index,existingEvents){
  const sourceFields=value?.fields&&typeof value.fields==="object"?clone(value.fields):{};
  const sourceCategory=String(value?.categoryId||"");
  const categoryResolved=CATEGORIES.some(({id})=>id===sourceCategory);
  const categoryNeedsReview=sourceFields.mappingReviewRequired===true||
    String(sourceFields.canonicalType||value?.canonicalType||"").toUpperCase()==="UNCLASSIFIED"||
    sourceCategory.toLowerCase()==="unclassified";
  const candidate={
    id:String(value?.id||`candidate-${index+1}`),
    categoryId:categoryNeedsReview&&sourceFields.categoryConfirmed!==true?"":categoryResolved?sourceCategory:"personal",
    title:String(value?.title||"").trim(),
    startDate:String(value?.startDate||value?.date||""),
    endDate:value?.endDate?String(value.endDate):null,
    openEnded:!!value?.openEnded,
    eventType:value?.eventType==="milestone"?"milestone":"duration",
    confidence:confidenceLevel(value),
    confidenceDetails:value?.confidenceDetails&&typeof value.confidenceDetails==="object"?clone(value.confidenceDetails):null,
    sourceSnippet:String(value?.sourceSnippet??value?.sourceExcerpt??value?.provenance?.[0]?.sourceExcerpt??"").trim(),
    provenance:Array.isArray(value?.provenance)?clone(value.provenance):[],
    inferredFields:Array.isArray(value?.inferredFields)?clone(value.inferredFields):[],
    warnings:Array.isArray(value?.warnings)?value.warnings.map(String):[],
    notes:String(value?.notes||""),
    visibilityState:value?.visibilityState||value?.visibilityRecommendation||VISIBILITY.INTERVIEWER_SAFE,
    fields:sourceFields,
    decision:normalizedDecision(value?.decision),
    reviewLater:value?.reviewLater===true,
    expanded:!!value?.expanded,
    extractionId:value?.extractionId||value?.id||null
  };
  candidate.duplicate=findDuplicate(candidate,existingEvents);
  if(candidate.decision==="merge"&&!candidate.duplicate)candidate.decision="undecided";
  return candidate;
}

function refreshDuplicates(candidates,existingEvents){
  return candidates.map((candidate)=>{
    const next={...candidate,duplicate:candidate.fields?.myerasReview?.mergeEventId?{eventId:candidate.fields.myerasReview.mergeEventId}:findDuplicate(candidate,existingEvents)};
    if(next.decision==="merge"&&!next.duplicate)next.decision="undecided";
    return next;
  });
}

export function detectDocumentType(file){
  const name=normalizedText(file?.name);
  if(name.includes("myeras")||name.includes("eras export"))return"MyERAS export";
  if(name.includes("resume"))return"Résumé";
  return"CV";
}

export function validateIntakeFile(file){
  const name=String(file?.name||"");
  const type=String(file?.type||"").toLowerCase();
  const size=Number(file?.size);
  const extension=name.toLowerCase().match(/\.([^.]+)$/)?.[1]||"";
  const pdfMime="application/pdf";
  const docxMime="application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const pptxMime="application/vnd.openxmlformats-officedocument.presentationml.presentation";
  const pngMime="image/png";
  const jpegMime="image/jpeg";
  const unknownMime=!type||type==="application/octet-stream";
  const timelineRescue=file?.timelineRescue===true;
  if(file?.myerasStructured===true){
    if(extension!=="json"||type!=="application/json"||!Number.isFinite(size)||size<=0||size>2*1024*1024)return{valid:false,error:"MyERAS structured sources must be a JSON file up to 2MB."};
    return{valid:true,error:null,kind:"myeras-structured",metadata:{name,type,size,lastModified:Number(file.lastModified)||null,myerasStructured:true}};
  }
  if(timelineRescue){
    const rescueKind=extension==="pptx"&&(unknownMime||type===pptxMime)
      ?"rescue-pptx"
      :extension==="pdf"&&(unknownMime||type===pdfMime)
        ?"rescue-pdf"
        :extension==="png"&&(unknownMime||type===pngMime)
          ?"rescue-png"
          :["jpg","jpeg"].includes(extension)&&(unknownMime||type===jpegMime)
            ?"rescue-jpeg"
            :!extension&&type===pptxMime
              ?"rescue-pptx"
              :!extension&&type===pdfMime
                ?"rescue-pdf"
                :!extension&&type===pngMime
                  ?"rescue-png"
                  :!extension&&type===jpegMime
                    ?"rescue-jpeg"
                    :null;
    const validSize=Number.isFinite(size)&&size>=0&&size<=MAX_DOCUMENT_BYTES;
    if(!rescueKind||!validSize)return{valid:false,error:INTAKE_COPY.rescueFileError};
    return{
      valid:true,
      error:null,
      kind:rescueKind,
      metadata:{
        name,
        type:type||({
          "rescue-pptx":pptxMime,
          "rescue-pdf":pdfMime,
          "rescue-png":pngMime,
          "rescue-jpeg":jpegMime
        })[rescueKind],
        size,
        lastModified:Number(file?.lastModified)||null,
        timelineRescue:true
      }
    };
  }
  const kind=extension==="pdf"&&(unknownMime||type===pdfMime)
    ?"pdf"
    :extension==="docx"&&(unknownMime||type===docxMime)
      ?"docx"
      :!extension&&type===pdfMime
        ?"pdf"
        :!extension&&type===docxMime
          ?"docx"
          :null;
  const validType=kind!==null;
  // This local parser allowance grants no access: the server revalidates the
  // File Vault object owner, exact version and checksum before it can be reused.
  const vaultSource=file?.timelineSourceObject;
  const handedOffVaultSource=vaultSource?.provider==="missionmed-filevault-v2"&&Boolean(vaultSource?.objectId);
  const maxBytes=handedOffVaultSource?MAX_FILE_BYTES:MAX_DOCUMENT_BYTES;
  const validSize=Number.isFinite(size)&&size>=0&&size<=maxBytes;
  if(!validType||!validSize)return{valid:false,error:handedOffVaultSource?`PDF or DOCX, up to ${Math.round(maxBytes/1024/1024)}MB.`:INTAKE_COPY.fileError};
  return{
    valid:true,
    error:null,
    kind,
    metadata:{
      name,
      type:type||(kind==="pdf"?pdfMime:docxMime),
      size,
      lastModified:Number(file?.lastModified)||null
    }
  };
}

export function intakeCapabilityMetadata(adapter){
  const available=typeof adapter?.extract==="function";
  const declared=adapter?.capability&&typeof adapter.capability==="object"?adapter.capability:{};
  return Object.freeze({
    feature:"document-intake-extraction",
    adapterRequired:true,
    adapterAvailable:available,
    mode:available?String(declared.mode||"adapter-provided-unverified"):"unavailable",
    productionReady:available&&declared.productionReady===true&&declared.simulated!==true,
    simulated:declared.simulated===true,
    source:available?String(declared.source||"injected-adapter"):"none",
    bundledExtractor:available&&declared.bundledExtractor===true,
    bundledFixtures:available&&declared.bundledFixtures===true,
    moduleNetworkCalls:available&&declared.networkCalls===true,
    timelineWritesBeforeApproval:false,
    approvalMutation:"one injected batch callback",
    adapterContract:INTAKE_ADAPTER_CONTRACT
  });
}

export function acceptedCvImportReceipt(value){
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const analysis=value.analysis&&typeof value.analysis==="object"?value.analysis:{};
  const types=[value.documentType,analysis.effectiveType,analysis.detectedType].filter(type=>String(type||"").trim()).map(type=>String(type).toUpperCase());
  const documentType=types[0]||"";
  if(!types.length||types.some(type=>!["CV","RESUME","MYERAS"].includes(type))||!Array.isArray(value.acceptedCandidates))return null;
  if(!value.acceptedCandidates.every(candidate=>candidate&&typeof candidate==="object"&&Array.isArray(candidate.provenance)&&candidate.provenance.length))return null;
  return{at:value.at||null,documentType,fileName:String(value.fileName||""),acceptedCount:value.acceptedCandidates.length,
    acceptedCandidates:clone(value.acceptedCandidates),analysis:{analysisId:String(analysis.analysisId||""),
      schemaVersion:String(analysis.schemaVersion||""),effectiveType:documentType}};
}

export function createIntakeState({file=null,candidates=[],existingEvents=[],suggestions=[]}={}){
  const validated=file?validateIntakeFile(file):null;
  const acceptedFile=validated?.valid?validated.metadata:null;
  return{
    stage:INTAKE_STAGES.UPLOAD,
    progressIndex:0,
    file:acceptedFile,
    detectedType:acceptedFile?detectDocumentType(acceptedFile):"CV",
    consent:false,
    fileError:file&&!validated?.valid?INTAKE_COPY.fileError:null,
    extraction:{statusIndex:0,completed:false,errorCode:null,errorMessage:null,sourceDocument:null,parser:null},
    candidates:(candidates||[]).map((candidate,index)=>normalizeCandidate(candidate,index,existingEvents)),
    suggestions:normalizeSuggestions(suggestions),
    filter:"all",
    failure:null,
    approval:{inFlight:false,applied:false,versionSaved:false,versionName:null,fileName:null,errorCode:null,appliedCount:0},
    sourceDeleted:false,
    identity:null
  };
}

/* Whose document is this? A structured source (the MyERAS CV) states the applicant on
   every page. That claim is compared with the Timeline's current name here, once, and the
   outcome is explicit state: an empty or matching name adopts the claim; a different
   name blocks approval until the student chooses. A profile name is never replaced or
   kept silently. */
const normalizedPersonName=(value)=>String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
function samePersonName(a,b){
  const tokens=(value)=>normalizedPersonName(value).split(" ").filter(Boolean).sort().join(" ");
  const left=tokens(a),right=tokens(b);
  return !!left&&left===right;
}
export function identityReview(sourceIdentity,profile={}){
  if(!sourceIdentity||typeof sourceIdentity!=="object")return null;
  const current=String(profile?.fullName||"").trim();
  if(sourceIdentity.conflict===true){
    return{claim:null,conflict:true,reason:String(sourceIdentity.reason||"The document names more than one applicant."),provenance:clone(sourceIdentity.provenance||[]),current,status:"unresolved",decision:null};
  }
  const claim={
    fullName:String(sourceIdentity.fullName||"").trim(),sourceForm:String(sourceIdentity.sourceForm||""),preferredName:String(sourceIdentity.preferredName||""),
    aamcId:String(sourceIdentity.aamcId||""),confidence:String(sourceIdentity.confidence||"high"),extractionMethod:String(sourceIdentity.extractionMethod||""),
    provenance:clone(sourceIdentity.provenance||[])
  };
  if(!claim.fullName)return null;
  const status=!current?"empty":samePersonName(current,claim.fullName)?"match":"conflict";
  return{claim,conflict:false,reason:"",provenance:clone(claim.provenance),current,status,decision:status==="conflict"?null:"use-source"};
}
export function identityDecisionRequired(state){
  const identity=state?.identity;
  return !!identity&&!identity.decision;
}
function candidateInstitution(candidate){
  const fields=candidate?.fields||{};
  return String(fields.institution||fields.medicalSchool||fields.organization||fields.employer||fields.siteName||"").trim();
}
export function reviewSummary(state){
  const lanes=reviewLanes(state);
  const records=lanes.high.filter((candidate)=>candidate.fields?.sourceRecordOnly===true).length;
  const duplicates=openSuggestions(state).filter((suggestion)=>suggestion.type==="POSSIBLE_DUPLICATE"&&suggestion.candidateIds.length===2).length;
  return{
    total:(state?.candidates||[]).length,
    ready:lanes.high.length-records,
    records,
    attention:lanes.medium.length+lanes.low.length,
    duplicates,
    decided:decidedCount(state)
  };
}

export function hydrateIntakeState(value,{existingEvents=[]}={}){
  const source=value&&typeof value==="object"?clone(value):{};
  const base=createIntakeState({file:source.file,candidates:source.candidates||[],existingEvents,suggestions:source.suggestions||[]});
  const stage=Object.values(INTAKE_STAGES).includes(source.stage)?source.stage:INTAKE_STAGES.UPLOAD;
  const progressIndex={upload:0,extraction:1,review:2,done:3}[stage];
  const hydrated={
    ...base,
    ...source,
    stage,
    progressIndex:Number.isInteger(source.progressIndex)?source.progressIndex:progressIndex,
    extraction:{...base.extraction,...(source.extraction||{})},
    lastAcceptedCvImport:acceptedCvImportReceipt(source.lastImport)||acceptedCvImportReceipt(source.lastAcceptedCvImport),
    candidates:(source.candidates||[]).map((candidate,index)=>normalizeCandidate(candidate,index,existingEvents)),
    suggestions:normalizeSuggestions(source.suggestions||[]),
    filter:INTAKE_FILTERS.includes(source.filter)?source.filter:"all",
    approval:{...base.approval,...(source.approval||{})}
  };
  if(stage===INTAKE_STAGES.DONE){
    hydrated.approval.applied=true;
    hydrated.approval.appliedCount=Number(hydrated.approval.appliedCount||source.lastImport?.acceptedCount)||0;
    hydrated.approval.addedCount=Number(hydrated.approval.addedCount??source.lastImport?.addedCount??hydrated.approval.appliedCount)||0;
    hydrated.approval.mergedCount=Number(hydrated.approval.mergedCount??source.lastImport?.mergedCount)||0;
    hydrated.approval.fileName=hydrated.approval.fileName||source.lastImport?.fileName||source.file?.name||"document";
  }
  return hydrated;
}

function positiveDecision(decision){
  return["accepted","merge","add-anyway"].includes(decision);
}

function myerasProfileClaims(state){return state?.extraction?.parser?.myerasProfileReview?.claims||[];}
function pendingMyerasReviewCount(state){
  if(!state?.extraction?.parser?.myerasProfileReview&&!state?.candidates?.some(candidate=>candidate.fields?.myerasReview))return 0;
  return(state.candidates||[]).filter(candidate=>candidate.fields?.myerasReview&&(candidate.decision==='undecided'||candidate.reviewLater)).length+myerasProfileClaims(state).filter(claim=>claim.decision==='undecided'||claim.decision==='accepted'&&!claim.resolution).length;
}
function acceptedMyerasProfileClaims(state){return myerasProfileClaims(state).filter(claim=>claim.decision==='accepted'&&claim.resolution);}
export function acceptedCount(state){
  return(state?.candidates||[]).filter((candidate)=>positiveDecision(candidate.decision)).length+acceptedMyerasProfileClaims(state).length;
}

export function bulkAcceptableCandidates(state){
  const flagged=flaggedCandidateIds(state);
  return(state?.candidates||[]).filter((candidate)=>
    candidate.decision==="undecided"&&!candidate.reviewLater&&reviewClassOf(candidate,flagged)==="high"
  );
}

export function highConfidenceCount(state){
  return bulkAcceptableCandidates(state).length;
}

export function decidedCount(state){
  return(state?.candidates||[]).filter((candidate)=>candidate.decision!=="undecided").length;
}

export function filteredCandidates(state){
  const filter=INTAKE_FILTERS.includes(state?.filter)?state.filter:"all";
  if(filter==="all")return state.candidates;
  if(filter==="accepted")return state.candidates.filter((candidate)=>positiveDecision(candidate.decision));
  return state.candidates.filter((candidate)=>candidate.decision===filter);
}

export function transitionIntake(current,action,{existingEvents=[],existingProfile={}}={}){
  const state=clone(current);
  switch(action?.type){
    case"RECEIVE_FILE":{
      const validation=validateIntakeFile(action.file);
      state.stage=INTAKE_STAGES.UPLOAD;
      state.progressIndex=0;
      state.failure=null;
      state.candidates=[];
      state.suggestions=[];
      state.consent=false;
      state.identity=null;
      state.extraction={statusIndex:0,completed:false,errorCode:null,errorMessage:null,sourceDocument:null,parser:null};
      state.approval={inFlight:false,applied:false,versionSaved:false,versionName:null,fileName:null,errorCode:null,appliedCount:0};
      if(!validation.valid){
        state.file=null;
        state.fileError=validation.error;
        return state;
      }
      state.file=validation.metadata;
      state.fileError=null;
      state.detectedType=detectDocumentType(validation.metadata);
      state.sourceDeleted=false;
      return state;
    }
    case"SET_CONSENT":
      state.consent=!!action.value;
      return state;
    case"CYCLE_DOCUMENT_TYPE":{
      const index=DOCUMENT_TYPES.indexOf(state.detectedType);
      state.detectedType=DOCUMENT_TYPES[(index+1+DOCUMENT_TYPES.length)%DOCUMENT_TYPES.length];
      return state;
    }
    case"START_EXTRACTION":
      if(!state.file||!state.consent)throw new Error("A valid file and review consent are required.");
      state.stage=INTAKE_STAGES.EXTRACTION;
      state.progressIndex=1;
      state.failure=null;
      state.extraction={...state.extraction,statusIndex:0,completed:false,errorCode:null,errorMessage:null};
      return state;
    case"ROTATE_STATUS":
      if(state.stage===INTAKE_STAGES.EXTRACTION&&!state.failure){
        /* Advance to the last stage and hold there — never wrap back to "Reading…". */
        state.extraction.statusIndex=Math.min(EXTRACTION_STATUSES.length-1,state.extraction.statusIndex+1);
      }
      return state;
    case"EXTRACTION_SUCCEEDED":
      state.candidates=(action.candidates||[]).map((candidate,index)=>normalizeCandidate(candidate,index,existingEvents));
      if(!state.candidates.length&&!action.parser?.myerasProfileReview?.claims?.length)throw new Error("EXTRACTION_SUCCEEDED requires at least one candidate.");
      state.stage=INTAKE_STAGES.REVIEW;
      state.progressIndex=2;
      state.filter="all";
      state.failure=null;
      state.extraction.completed=true;
      state.extraction.sourceDocument=action.sourceDocument?clone(action.sourceDocument):null;
      state.extraction.parser=action.parser?clone(action.parser):null;
      state.identity=identityReview(action.parser?.sourceIdentity||null,existingProfile);
      const sourceCustody=traceOnlySourceCustody(action.sourceDocument?.sourceCustody);
      if(state.file&&sourceCustody)state.file={...state.file,sourceCustody};
      /* C-06: the quality review the server already computed used to stop at the adapter. */
      state.suggestions=normalizeSuggestions(action.qualitySuggestions||action.parser?.qualitySuggestions||[]);
      return state;
    case"EXTRACTION_UNREADABLE":
      state.stage=INTAKE_STAGES.EXTRACTION;
      state.progressIndex=1;
      state.failure={kind:"unreadable"};
      state.extraction.completed=true;
      return state;
    case"EXTRACTION_EMPTY":
      state.stage=INTAKE_STAGES.EXTRACTION;
      state.progressIndex=1;
      state.failure={kind:"empty"};
      state.extraction.completed=true;
      return state;
    case"EXTRACTION_ABORTED":
      state.stage=INTAKE_STAGES.UPLOAD;
      state.progressIndex=0;
      state.failure=null;
      state.fileError=action.errorMessage||null;
      state.extraction={...state.extraction,statusIndex:0,completed:false,errorCode:action.errorCode||null,errorMessage:action.errorMessage||null};
      return state;
    case"SET_FILTER":
      if(INTAKE_FILTERS.includes(action.filter))state.filter=action.filter;
      return state;
    case"EDIT_CANDIDATE":{
      const index=state.candidates.findIndex(({id})=>id===action.id);
      if(index<0)return state;
      const patch=action.patch&&typeof action.patch==="object"?clone(action.patch):{};
      const candidate={...state.candidates[index]};
      const priorCategoryId=candidate.categoryId;
      for(const field of["title","categoryId","startDate","endDate","notes","eventType","openEnded","visibilityState"]){
        if(Object.hasOwn(patch,field))candidate[field]=patch[field];
      }
      if(patch.fields&&typeof patch.fields==="object")candidate.fields={...candidate.fields,...patch.fields};
      if(!CATEGORIES.some(({id})=>id===candidate.categoryId))candidate.categoryId="";
      if(Object.hasOwn(patch,'categoryId')&&candidate.categoryId){
        candidate.fields={...candidate.fields,categoryConfirmed:true,mappingReviewRequired:false};
      }
      if(candidate.fields?.myerasReview)synchronizeMyerasInstitution(candidate);
      for(const [field,edge] of [['startDate','start'],['endDate','end']]){
        if(Object.hasOwn(patch,field)&&String(patch[field]||'')!==String(state.candidates[index][field]||'')){
          if(candidate.fields?.myerasReview){
            const sourceWording=patch.fields?.sourceDateWording?.[edge];
            const selectedRaw=sourceWording?.normalizedMonth===patch[field]?sourceWording.raw:null;
            const date=myerasDate(selectedRaw||patch[field],edge);
            if(String(patch[field]||'').trim()&&!date.value)throw new Error("Use a source-backed year, month and year, or exact calendar date.");
            candidate[field]=date.value||null;
            candidate.fields={...candidate.fields,datePrecision:{...candidate.fields.datePrecision,[edge]:date.precision},sourceDateWording:{...candidate.fields.sourceDateWording,[edge]:{raw:date.raw,precision:date.precision,normalizedMonth:date.value}},
              myerasCorrections:[...(candidate.fields.myerasCorrections||[]),{field,before:state.candidates[index][field]||null,value:date.value,precision:date.precision,basis:'STUDENT_CHANGE'}]};
          }
          const precision=candidate.fields?.datePrecision?.[edge];
          if(['SEASON','VAGUE_RANGE'].includes(precision))candidate.fields={...candidate.fields,datePrecision:{...candidate.fields.datePrecision,[edge]:'MONTH'},sourceDateWording:{...candidate.fields.sourceDateWording,[edge]:null}};
        }
      }
      if(Object.hasOwn(patch,"visibilityState")){
        candidate.visibilityState=patch.visibilityState===VISIBILITY.ADVISOR_ONLY
          ?VISIBILITY.ADVISOR_ONLY
          :VISIBILITY.INTERVIEWER_SAFE;
      }
      // Editing a degree's visibility or title must not turn its explicit
      // training period into a graduation milestone at the start date.
      if(candidate.categoryId==="personal"){
        if(Object.hasOwn(patch,"visibilityState")){
          candidate.visibilityState=patch.visibilityState===VISIBILITY.INTERVIEWER_SAFE
            ?VISIBILITY.INTERVIEWER_SAFE
            :VISIBILITY.ADVISOR_ONLY;
          candidate.fields={
            ...candidate.fields,
            visibility:candidate.visibilityState===VISIBILITY.ADVISOR_ONLY
              ?"Advisor only"
              :"Show everyone"
          };
        }else if(Object.hasOwn(patch.fields||{},"visibility")){
          candidate.visibilityState=candidate.fields.visibility==="Advisor only"
            ?VISIBILITY.ADVISOR_ONLY
            :VISIBILITY.INTERVIEWER_SAFE;
        }else if(priorCategoryId!=="personal"){
          candidate.visibilityState=VISIBILITY.ADVISOR_ONLY;
          candidate.fields={...candidate.fields,visibility:"Advisor only"};
        }
        if(candidate.fields.when){
          candidate.eventType=candidate.fields.when==="A period"?"duration":"milestone";
          if(candidate.eventType==="milestone")candidate.endDate=null;
        }
      }
      /* Imported document adapters can surface boolean-looking values as text.
         The string "false" must never turn a finished experience into Present.
         Conversely, entering an explicit end month is the student's direct
         instruction to close the range, so clear every ongoing alias. */
      if(Object.hasOwn(patch,"endDate")&&String(patch.endDate||"").trim()){
        candidate.openEnded=false;
        candidate.fields={
          ...candidate.fields,
          currentlyOnRotation:false,
          stillWorking:false,
          ongoing:false
        };
      }
      if(candidate.fields?.myerasReview&&(Object.hasOwn(patch,'openEnded')||priorCategoryId!==candidate.categoryId))synchronizeMyerasOngoing(candidate);
      const ongoingFlag=[
        candidate.fields.currentlyOnRotation,
        candidate.fields.stillWorking,
        candidate.fields.ongoing
      ].some((value)=>value===true||String(value||"").trim().toLowerCase()==="true");
      const ongoingFieldPatched=["currentlyOnRotation","stillWorking","ongoing"]
        .some((field)=>Object.hasOwn(patch.fields||{},field));
      if(ongoingFlag){
        candidate.openEnded=true;
        candidate.endDate=null;
      }else if(ongoingFieldPatched){
        candidate.openEnded=false;
      }
      candidate.title=String(candidate.title||"").trim();
      candidate.startDate=String(candidate.startDate||"");
      candidate.endDate=candidate.endDate?String(candidate.endDate):null;
      state.candidates[index]=candidate;
      state.candidates=refreshDuplicates(state.candidates,existingEvents);
      return state;
    }
    case"TOGGLE_EDIT":{
      const candidate=state.candidates.find(({id})=>id===action.id);
      if(candidate)candidate.expanded=!candidate.expanded;
      return state;
    }
    case"MYERAS_PROFILE_REVIEW":{
      const claim=myerasProfileClaims(state).find(item=>item.id===action.id);
      if(!claim)throw new Error("This profile claim is unavailable.");
      if(Object.hasOwn(action,'choiceIndex')||Object.hasOwn(action,'value')){
        const choice=action.choiceIndex!=null?claim.choices[Number(action.choiceIndex)]:null;
        if(action.choiceIndex!=null&&!choice)throw new Error("Choose an available profile source.");
        if(!choice&&!String(action.reason||'').trim())throw new Error("Describe the evidence for your profile correction.");
        const value=String(choice?choice.value:action.value||'').trim();
        if(!value||value.length>12000)throw new Error("Enter a supported profile value.");
        if(claim.field==='graduationDate'&&!myerasDate(value).value)throw new Error("The graduation date needs a source-backed year, month or exact date.");
        claim.resolution={basis:choice?'SOURCE_CHOICE':'HUMAN_CORRECTION',value,sourceIds:clone(choice?.sourceIds||[]),provenance:clone(choice?.evidence||[]),keepCurrent:choice?.keepCurrent===true,reason:String(action.reason||'').trim()};
        claim.decision='undecided';
      }
      if(Object.hasOwn(action,'visibilityState'))claim.visibilityState=action.visibilityState==='INTERVIEWER_SAFE'?'INTERVIEWER_SAFE':'ADVISOR_ONLY';
      if(Object.hasOwn(action,'decision')){
        if(action.decision==='accepted'&&!claim.resolution)throw new Error("Choose or correct this profile value first.");
        claim.decision=['accepted','rejected'].includes(action.decision)?action.decision:'undecided';
      }
      return state;
    }
    case"MYERAS_MERGE_CANDIDATES":{
      const candidate=state.candidates.find(item=>item.id===action.id),target=state.candidates.find(item=>item.id===action.targetId);
      if(!candidate?.fields?.myerasReview||!target?.fields?.myerasReview||candidate===target||candidate.fields.myerasReview.mergedInto||target.fields.myerasReview.mergedInto)throw new Error("Both source candidates must be available.");
      for(const field of ['title','categoryId','startDate','endDate','openEnded','eventType'])if(Object.hasOwn(action.patch||{},field))candidate[field]=clone(action.patch[field]);
      candidate.fields=clone(action.fields);candidate.provenance=[...candidate.provenance,...clone(target.provenance)];candidate.sourceSnippet=[candidate.sourceSnippet,target.sourceSnippet].filter(Boolean).join('\n');candidate.decision='undecided';
      target.decision='rejected';target.fields.myerasReview.mergedInto=candidate.id;
      for(const childId of target.fields.myerasReview.mergedCandidateIds||[]){const child=state.candidates.find(item=>item.id===childId);if(child){child.decision='rejected';child.fields.myerasReview.mergedInto=candidate.id;}}
      return state;
    }
    case"DECIDE_CANDIDATE":{
      const candidate=state.candidates.find(({id})=>id===action.id);
      if(!candidate)return state;
      const decision=normalizedDecision(action.decision);
      if(action.decision==="deferred"){
        candidate.decision="undecided";
        candidate.reviewLater=true;
        candidate.expanded=false;
        return state;
      }
      if(["accepted","merge","add-anyway"].includes(decision)&&Object.keys(myerasReviewErrors(candidate)).length)throw new Error("Resolve the source conflicts and possible duplicates first.");
      if(candidate.fields?.myerasReview?.mergedInto&&["accepted","merge","add-anyway"].includes(decision))throw new Error("This source was merged into another reviewed candidate.");
      if(["accepted","merge","add-anyway"].includes(decision)&&!CATEGORIES.some(({id})=>id===candidate.categoryId)){
        throw new Error("Choose a category before accepting this suggestion.");
      }
      if(decision==="accepted"&&candidate.duplicate)throw new Error("Resolve the duplicate with Merge or Add anyway.");
      if(decision==="merge"&&!candidate.duplicate&&!candidate.fields?.myerasReview?.mergeEventId)throw new Error("Merge is available only for duplicate candidates.");
      candidate.decision=decision;
      candidate.reviewLater=false;
      candidate.expanded=false;
      return state;
    }
    case"ACCEPT_HIGH_CONFIDENCE":{
      const acceptable=new Set(bulkAcceptableCandidates(state).map(({id})=>id));
      for(const candidate of state.candidates){
        if(!acceptable.has(candidate.id))continue;
        candidate.decision="accepted";
        candidate.expanded=false;
      }
      return state;
    }
    case"IDENTITY_DECISION":{
      if(!state.identity)throw new Error("No document identity is under review.");
      const decision=["use-source","keep-current"].includes(action.decision)?action.decision:null;
      if(!decision)throw new Error("Choose whose document this is.");
      if(decision==="use-source"&&!state.identity.claim)throw new Error("The document identity could not be confirmed.");
      state.identity.decision=decision;
      return state;
    }
    case"ACCEPT_SECTION":{
      const ids=new Set((action.candidateIds||[]).map(String));
      const flagged=flaggedCandidateIds(state);
      for(const candidate of state.candidates){
        if(!ids.has(String(candidate.id))||candidate.decision!=="undecided"||candidate.reviewLater)continue;
        // Section acceptance never swallows a question, a duplicate, or an invalid entry.
        if(reviewClassOf(candidate,flagged)==="low"||candidate.duplicate)continue;
        if(Object.keys(validateCandidateForApproval(candidate)).length)continue;
        candidate.decision="accepted";
        candidate.expanded=false;
      }
      return state;
    }
    case"RESOLVE_DUPLICATE_GROUP":{
      const suggestion=state.suggestions.find(({id})=>id===action.id);
      if(!suggestion||suggestion.type!=="POSSIBLE_DUPLICATE"||suggestion.status!=="open")throw new Error("This duplicate group is unavailable.");
      const [first,second]=suggestion.candidateIds.map((id)=>state.candidates.find((candidate)=>candidate.id===id));
      if(!first||!second)throw new Error("Both duplicate entries must be available.");
      const choice=String(action.choice||"");
      const keep=(winner,loser,reason)=>{
        winner.decision="accepted";winner.expanded=false;
        loser.decision="rejected";loser.expanded=false;
        loser.fields={...(loser.fields||{}),duplicateDecision:reason,duplicateOf:winner.id};
      };
      if(choice==="keep-a")keep(first,second,"rejected-as-duplicate");
      else if(choice==="keep-b")keep(second,first,"rejected-as-duplicate");
      else if(choice==="merge"){
        const seen=new Set((first.provenance||[]).map((item)=>JSON.stringify(item)));
        for(const item of second.provenance||[])if(!seen.has(JSON.stringify(item)))first.provenance.push(clone(item));
        first.sourceSnippet=[first.sourceSnippet,second.sourceSnippet].filter(Boolean).join("\n");
        if(!first.endDate&&second.endDate)first.endDate=second.endDate;
        if(second.openEnded){first.openEnded=true;first.endDate=null;}
        first.fields={...(first.fields||{}),mergedSourceCandidateIds:[...(first.fields?.mergedSourceCandidateIds||[]),second.id]};
        keep(first,second,"merged");
      }else if(choice==="keep-both"){
        for(const candidate of [first,second]){candidate.decision="accepted";candidate.expanded=false;}
      }else throw new Error("Choose Keep A, Keep B, Merge, or Keep both.");
      suggestion.status="applied";
      suggestion.previous={duplicateChoice:choice};
      return state;
    }
    case"APPLY_SUGGESTION":{
      const suggestion=state.suggestions.find(({id})=>id===action.id);
      if(!suggestion||suggestion.status!=="open"||!suggestion.proposal)return state;
      const index=state.candidates.findIndex(({id})=>id===suggestion.proposal.candidateId);
      if(index<0)return state;
      const candidate=state.candidates[index];
      const previous={};
      for(const field of Object.keys(suggestion.proposal.patch))previous[field]=clone(candidate[field]??null);
      Object.assign(candidate,clone(suggestion.proposal.patch));
      if(candidate.openEnded===true)candidate.endDate=null;
      suggestion.previous=previous;
      suggestion.status="applied";
      state.candidates=refreshDuplicates(state.candidates,existingEvents);
      return state;
    }
    case"DISMISS_SUGGESTION":{
      const suggestion=state.suggestions.find(({id})=>id===action.id);
      if(!suggestion||suggestion.status!=="open")return state;
      suggestion.status="dismissed";
      return state;
    }
    case"UNDO_SUGGESTION":{
      const suggestion=state.suggestions.find(({id})=>id===action.id);
      if(!suggestion||suggestion.status==="open")return state;
      if(suggestion.status==="applied"&&suggestion.previous?.duplicateChoice){
        for(const id of suggestion.candidateIds){
          const candidate=state.candidates.find((item)=>item.id===id);
          if(!candidate)continue;
          candidate.decision="undecided";
          if(candidate.fields){delete candidate.fields.duplicateDecision;delete candidate.fields.duplicateOf;}
        }
        suggestion.previous=null;
        suggestion.status="open";
        return state;
      }
      if(suggestion.status==="applied"&&suggestion.previous){
        const index=state.candidates.findIndex(({id})=>id===suggestion.proposal?.candidateId);
        if(index>=0)Object.assign(state.candidates[index],clone(suggestion.previous));
      }
      suggestion.previous=null;
      suggestion.status="open";
      state.candidates=refreshDuplicates(state.candidates,existingEvents);
      return state;
    }
    case"RESET_UPLOAD":{
      const reset=createIntakeState();
      reset.lastAcceptedCvImport=acceptedCvImportReceipt(state.lastImport)||acceptedCvImportReceipt(state.lastAcceptedCvImport);
      return reset;
    }
    case"DISCARD_ALL":
      state.candidates=[];
      state.suggestions=[];
      state.stage=INTAKE_STAGES.UPLOAD;
      state.progressIndex=0;
      state.file=null;
      state.consent=false;
      state.failure=null;
      state.extraction={statusIndex:0,completed:false,errorCode:null,errorMessage:null,sourceDocument:null,parser:null};
      return state;
    case"APPROVAL_STARTED":
      state.approval.inFlight=true;
      state.approval.errorCode=null;
      state.approval.versionName=action.versionName;
      return state;
    case"APPROVAL_VERSION_SAVED":
      state.approval.versionSaved=true;
      return state;
    case"APPROVAL_FAILED":
      state.approval.inFlight=false;
      state.approval.errorCode=action.errorCode||"APPROVAL_FAILED";
      return state;
    case"APPROVAL_SUCCEEDED":
      state.approval.inFlight=false;
      state.approval.applied=true;
      state.approval.appliedCount=Number(action.appliedCount)||0;
      state.approval.addedCount=Number(action.addedCount??action.appliedCount)||0;
      state.approval.mergedCount=Number(action.mergedCount)||0;
      state.approval.fileName=String(action.fileName||state.file?.name||"document");
      state.approval.errorCode=null;
      state.stage=INTAKE_STAGES.DONE;
      state.progressIndex=3;
      return state;
    case"DOCUMENT_DELETED":
      state.sourceDeleted=true;
      state.file=null;
      return state;
    default:
      throw new Error(`Unknown intake transition: ${action?.type||"(missing)"}`);
  }
}

function approvalProvenance(candidate,fileName=""){
  const detailed=Array.isArray(candidate.provenance)&&candidate.provenance.length
    ?candidate.provenance
    :Array.isArray(candidate.fields?.sourceProvenance)
      ?candidate.fields.sourceProvenance
      :[];
  if(detailed.length){
    return detailed.map((item)=>({
      ...clone(item),
      sourceDocumentName:String(
        item?.sourceDocumentName||
        item?.fileName||
        fileName||
        ""
      ),
      extractionCandidateId:String(
        item?.extractionCandidateId||
        candidate.extractionId||
        candidate.id
      ),
      sourceSnippet:String(
        item?.sourceSnippet||
        item?.sourceExcerpt||
        candidate.sourceSnippet||
        ""
      )
    }));
  }
  return[{
    sourceDocumentName:fileName||null,
    extractionCandidateId:candidate.extractionId||candidate.id,
    sourceSnippet:candidate.sourceSnippet
  }];
}

function candidateEvent(candidate,id,fileName=""){
  const fields=clone(candidate.fields);
  if(fields.profileHeaderConflicts?.length||
    ((fields.profileHeaderReviewRequired===true||
      (fields.rescueProfileClaims!==true&&['profileNameProvenance','profileMedicalSchoolProvenance','profileDegreeProvenance'].some(key=>fields[key]?.length)))&&
      fields.acceptProfileClaims!==true)){
    // An event approval is not approval to persist unconfirmed CV profile claims.
    for(const key of ['profileFullName','profileNameProvenance','profileMedicalSchool','profileMedicalSchoolProvenance',
      'profileDegree','profileDegreeProvenance','profileHeaderConflicts','profileHeaderConflictProvenance',
      'profileHeaderReviewRequired','acceptProfileClaims'])delete fields[key];
  }
  return bindImportedBuilderEvent022({
    id,
    title:candidate.title,
    categoryId:candidate.categoryId,
    eventType:candidate.eventType,
    startDate:candidate.startDate,
    endDate:candidate.endDate,
    openEnded:candidate.openEnded,
    visibilityState:candidate.visibilityState||VISIBILITY.INTERVIEWER_SAFE,
    siteName:String(
      (candidate.fields?.myerasReview?candidate.fields?.[INSTITUTION_FIELD_BY_CATEGORY[candidate.categoryId]]:null)||
      candidate.fields?.institution||
      candidate.fields?.medicalSchool||
      candidate.fields?.organization||
      candidate.fields?.employer||
      candidate.fields?.siteName||
      ""
    ),
    notes:candidate.notes,
    lane:null,
    sourceType:"document-intake",
    provenance:approvalProvenance(candidate,fileName),
    fields
  });
}

function explicitMedicalSchoolFromDegreeTitle(candidate){
  const canonical=String(candidate?.fields?.canonicalType||"").toUpperCase();
  const credential=String(candidate?.fields?.degree||"").trim().toUpperCase().replaceAll(".","");
  const title=String(candidate?.title||"").trim();
  const isMedicalDegree=canonical==="MEDICAL_DEGREE"||
    ["MD","DO","MBBS","MBCHB","MBBCH"].includes(credential)||
    /\b(?:doctor of medicine|doctor of osteopathic medicine|medical degree|mbbs|mbchb|mbbch)\b/i.test(title);
  if(!isMedicalDegree)return"";

  /* Some source-grounded extractors retain an explicit institution in the
     reviewed title while leaving the optional organization field blank. Only
     accept the unambiguous "degree, school" / "degree at school" forms; a
     bare degree title must stay blank and reviewable rather than be guessed. */
  const match=title.match(
    /^(?:doctor of medicine(?:\s*\(md\))?|doctor of osteopathic medicine(?:\s*\(do\))?|medical degree|bachelor of medicine(?:\s+and\s+bachelor of surgery)?|mbbs|mbchb|mbbch)\s*(?:,|\bat\b|[-—])\s*(.+)$/i
  );
  return String(match?.[1]||"").trim();
}

function cvProfilePrefill(candidates=[]){
  const education=candidates.filter((candidate)=>candidate.categoryId==="education");
  /* A general undergraduate EDUCATION entry can legitimately precede the
     medical degree in CV chronology. Profile identity must come from the
     medical-degree candidate, not whichever education entry appears first. */
  const medicalDegree=education.find((candidate)=>{
    const canonical=String(candidate.fields?.canonicalType||"").toUpperCase();
    const credential=String(candidate.fields?.degree||"").trim().toUpperCase().replaceAll(".","");
    const title=String(candidate.title||"");
    return canonical==="MEDICAL_DEGREE"||
      ["MD","DO","MBBS","MBCHB","MBBCH"].includes(credential)||
      /\b(?:doctor of medicine|doctor of osteopathic medicine|medical degree|mbbs|mbchb|mbbch)\b/i.test(title);
  });
  const graduation=education.find((candidate)=>
    String(candidate.fields?.canonicalType||"").toUpperCase()==="GRADUATION"
  );
  const degree=medicalDegree||graduation||education.find((candidate)=>
    String(candidate.fields?.canonicalType||"").toUpperCase()==="EDUCATION"
  );
  if(!degree||degree.fields?.profileHeaderConflicts?.length)return null;
  const extractedProfileClaim=degree.fields?.profileHeaderReviewRequired===true||
    (degree.fields?.rescueProfileClaims!==true&&
      ['profileNameProvenance','profileMedicalSchoolProvenance','profileDegreeProvenance']
        .some(field=>degree.fields?.[field]?.length));
  if(extractedProfileClaim&&degree.fields?.acceptProfileClaims!==true)return null;
  // A separate BSc graduation must never supply the medical degree's date.
  const graduationEdge=degree.endDate?"end":degree.eventType==="milestone"||String(degree.fields?.canonicalType||"").toUpperCase()==="GRADUATION"?"start":"end";
  const graduationDate=graduationEdge==="start"?degree.startDate:degree.endDate;
  const graduationDatePrecision=candidateDatePrecision(degree,graduationEdge+"Date");
  const claims=degree.fields?.profileClaims&&typeof degree.fields.profileClaims==="object"?degree.fields.profileClaims:{};
  const claimValue=(field)=>String(claims[field]?.value||"").trim();
  const claimProvenance=Object.fromEntries(Object.entries(claims).filter(([,claim])=>Array.isArray(claim?.provenance)&&claim.provenance.length).map(([field,claim])=>[field,clone(claim.provenance)]));
  return{
    claimProvenance,
    languages:claimValue("languages"),
    hobbies:claimValue("hobbies"),
    sourceCandidateId:String(degree.id),
    visibilityState:degree.visibilityState||VISIBILITY.ADVISOR_ONLY,
    fullName:Array.isArray(degree.fields?.profileNameProvenance)&&degree.fields.profileNameProvenance.length
      ?String(degree.fields.profileFullName||'').trim():"",
    fullNameProvenance:clone(degree.fields?.profileNameProvenance||[]),
    medicalSchool:String(
      degree.fields?.profileMedicalSchool||
      degree.fields?.medicalSchool||
      degree.siteName||
      explicitMedicalSchoolFromDegreeTitle(degree)||
      ""
    ).trim(),
    medicalSchoolCountry:String(degree.fields?.medicalSchoolCountry||degree.fields?.sourceCountry||claimValue("medicalSchoolCountry")||"").trim(),
    graduationDate:claimValue("graduationDate")||(graduationDate?String(graduationDate).slice(0,graduationDatePrecision==="YEAR"?4:7):""),
    graduationDatePrecision:claimValue("graduationDate")?(claimValue("graduationDate").length===4?"YEAR":"MONTH"):graduationDatePrecision,
    degree:String(["MD","DO","MBBS"].includes(String(degree.fields?.degree||"").trim().toUpperCase())?degree.fields.degree:degree.fields?.profileDegree||degree.fields?.degree||"").trim(),
    medicalSchoolProvenance:clone(degree.fields?.profileMedicalSchoolProvenance||[]),
    degreeProvenance:clone(degree.fields?.profileDegreeProvenance||[]),
    verificationStatus:"unverified-source-claimed",
    provenance:approvalProvenance(degree)
  };
}

function cvExamReviewQueue(candidates=[]){
  return candidates.filter((candidate)=>candidate.categoryId==="exams").map((candidate)=>({
    sourceCandidateId:String(candidate.id),
    canonicalType:String(candidate.fields?.canonicalType||""),
    ...(candidate.fields?.myerasReview?{examSystem:String(candidate.fields.examSystem||''),attempt:candidate.fields.attempt??null}:{}),
    examName:String(candidate.fields?.examName||candidate.title||""),
    examDate:candidate.startDate?String(candidate.startDate).slice(0,candidateDatePrecision(candidate,"startDate")==="YEAR"?4:candidateDatePrecision(candidate,"startDate")==="DAY"?10:7):"",
    examDatePrecision:candidateDatePrecision(candidate,"startDate"),
    result:String(candidate.fields?.result||""),
    score:String(candidate.fields?.score||""),
    visibilityState:candidate.visibilityState||VISIBILITY.ADVISOR_ONLY,
    status:"needs-student-confirmation",
    provenance:approvalProvenance(candidate)
  }));
}

function mergePatch(existing,candidate,fileName){
  if(candidate.fields?.myerasReview){
    const reviewed=candidateEvent(candidate,existing.id,fileName);
    const nonemptyFields=Object.fromEntries(Object.entries(reviewed.fields||{}).filter(([,value])=>value!=null&&value!==''));
    const audiences=[existing.visibilityState||'ADVISOR_ONLY',reviewed.visibilityState||'ADVISOR_ONLY'];
    const visibilityState=['HIDDEN','STUDENT_ONLY','ADVISOR_ONLY','FULL_STORY','INTERVIEWER_SAFE'].find(value=>audiences.includes(value))||'ADVISOR_ONLY';
    return{title:reviewed.title,categoryId:reviewed.categoryId,startDate:reviewed.startDate,endDate:reviewed.endDate,openEnded:reviewed.openEnded,eventType:reviewed.eventType,
      visibilityState,siteName:reviewed.siteName||existing.siteName,fields:{...clone(existing.fields||{}),...clone(nonemptyFields)},provenance:[...clone(existing.provenance||[]),...clone(reviewed.provenance)],notes:existing.notes||''};
  }
  const existingRange=monthRange(existing),candidateRange=monthRange(candidate);
  const start=existingRange&&candidateRange?Math.min(existingRange.start,candidateRange.start):(existingRange?.start??candidateRange?.start);
  const end=existingRange&&candidateRange?Math.max(existingRange.end,candidateRange.end):(existingRange?.end??candidateRange?.end);
  const evidenceKey=item=>JSON.stringify([
    item.id||item.evidenceId||null,item.sourceSha256||item.artifactSha256||null,
    item.sourceDocumentId||((item.sourceSha256||item.artifactSha256)?null:item.sourceDocumentName||item.fileName||null),item.sourceBlockId||item.objectId||null,
    item.pageNumber??item.pageOrSlide??null,item.sourceExcerpt||item.sourceText||item.sourceSnippet||null,
    item.extractionMethod||null
  ]);
  const seen=new Set(),provenance=[];
  for(const item of existing.provenance||[]){
    const key=evidenceKey(item);if(!seen.has(key)){seen.add(key);provenance.push(item);}
  }
  let newEvidence=false;
  for(const item of approvalProvenance(candidate,fileName)){
    const key=evidenceKey(item);if(!seen.has(key)){seen.add(key);provenance.push(item);newEvidence=true;}
  }
  const snippet=candidate.sourceSnippet;
  const currentNotes=String(existing.notes||"").trim();
  const notes=newEvidence&&snippet&&!currentNotes.includes(snippet)?[currentNotes,snippet].filter(Boolean).join("\n"):currentNotes;
  // monthRange uses the start as a comparison endpoint for a point event.
  // That comparison bound is not a factual end date to write back on reupload.
  const pointWithoutEnd=existing.eventType==="milestone"&&!existing.endDate;
  return{
    startDate:Number.isFinite(start)?monthString(start):existing.startDate,
    endDate:pointWithoutEnd||existing.openEnded||candidate.openEnded?null:(Number.isFinite(end)?monthString(end):existing.endDate),
    openEnded:!!existing.openEnded||!!candidate.openEnded,
    notes,
    provenance
  };
}

export function validateCandidateForApproval(candidate){
  const errors={};
  if(!String(candidate?.title||"").trim())errors.title="Required.";
  if(!CATEGORIES.some(({id})=>id===candidate?.categoryId))errors.categoryId="Choose a category.";
  const calendarIndex=(value,edge)=>{
    if(/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))){const exact=parseExactDate(value);return exact?Date.parse(exact+'T00:00:00Z')/86400000:null;}
    const month=monthIndex(value);return Number.isFinite(month)?Date.UTC(Math.floor(month/12),month%12+(edge==='end'?1:0),edge==='end'?0:1)/86400000:null;
  };
  const start=calendarIndex(candidate?.startDate,'start');
  const end=candidate?.endDate?calendarIndex(candidate.endDate,'end'):null;
  if(!Number.isFinite(start))errors.startDate="Enter a month and year, like 'Jun 2023'.";
  if(candidate?.endDate&&!Number.isFinite(end))errors.endDate="Enter a month and year, like 'Jun 2023'.";
  else if(Number.isFinite(start)&&Number.isFinite(end)&&end<start)errors.endDate="End must be on or after start.";
  Object.assign(errors,myerasReviewErrors(candidate));
  if(candidate?.fields?.myerasReview&&candidate.categoryId==='exams'&&/^STEP_[123]/.test(candidate.fields.canonicalType)&&candidate.fields.examSystem&&candidate.fields.examSystem!=='USMLE')errors.examSystem='Resolve the exam system and canonical exam type disagreement.';
  if(candidate?.fields?.myerasReview)for(const question of candidateQuestions(candidate))errors[question.extra||question.field]='Confirm this fact from your source before approval.';
  if(candidate?.fields?.myerasReview&&candidate.eventType==='duration'&&!candidate.endDate&&!candidate.openEnded)errors.endDate='Confirm the end date or mark this experience ongoing.';
  return errors;
}

/** The uploaded Rescue marker and completed extraction describe the current
 * source. The filename-based upload guess can still say CV after Rescue. */
export function intakeDocumentType(state){
  const normalize=value=>String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase().replace(/^MYERAS EXPORT$/,"MYERAS");
  const current=[state.extraction?.sourceDocument?.effectiveType,state.extraction?.parser?.effectiveType,state.extraction?.parser?.detectedType]
    .map(normalize).filter(Boolean);
  if(state.file?.timelineRescue===true||current.includes("TIMELINE_RESCUE"))return "TIMELINE_RESCUE";
  return current[0]||normalize(state.detectedType)||"DOCUMENT";
}

export function buildApprovalBatch(state,existingEvents,{idFactory=(prefix)=>`${prefix}-${crypto.randomUUID()}`,clock=()=>new Date()}={}){
  if(state.stage!==INTAKE_STAGES.REVIEW)throw new Error("Approval is available only during Review.");
  const positive=state.candidates.filter((candidate)=>positiveDecision(candidate.decision));
  const profileClaims=acceptedMyerasProfileClaims(state);
  if(!positive.length&&!profileClaims.length)throw new Error(INTAKE_COPY.emptyAccepted);
  if(pendingMyerasReviewCount(state))throw new Error(`Decide on all ${pendingMyerasReviewCount(state)} remaining MyERAS experience or profile facts before final approval. Accept or leave out each one; reviewing later keeps this import open.`);
  if(identityDecisionRequired(state)){
    const error=new Error("Confirm whose document this is before adding anything to this Timeline.");
    error.code="INTAKE_IDENTITY_UNDECIDED";
    throw error;
  }
  const invalid=positive.map((candidate)=>({id:candidate.id,errors:validateCandidateForApproval(candidate)})).filter(({errors})=>Object.keys(errors).length);
  if(invalid.length){
    const error=new Error("Fix accepted suggestions before adding them.");
    error.code="INTAKE_ACCEPTED_CANDIDATE_INVALID";
    error.candidates=invalid;
    throw error;
  }
  const additions=[];
  const merges=[];
  for(const candidate of positive){
    if(candidate.decision==="merge"){
      const existing=existingEvents.find((event)=>event.id===candidate.duplicate?.eventId);
      if(!existing)throw new Error(`Duplicate target is unavailable for ${candidate.id}.`);
      const prior=merges.find(({eventId})=>eventId===existing.id);
      if(prior){
        prior.candidateIds.push(candidate.id);
        prior.patch=mergePatch({...existing,...prior.patch},candidate,state.file?.name||"");
      }else{
        merges.push({
          candidateId:candidate.id,
          candidateIds:[candidate.id],
          eventId:existing.id,
          patch:mergePatch(existing,candidate,state.file?.name||"")
        });
      }
      continue;
    }
    const event=candidateEvent(
      candidate,
      idFactory("event"),
      state.file?.name||""
    );
    additions.push(event);
  }
  const documentType=intakeDocumentType(state);
  const importName={TIMELINE_RESCUE:"Timeline Rescue",CV:"CV",RESUME:"résumé",MYERAS:"MyERAS"}[documentType]||"document";
  const versionName=`Before ${importName} import · ${dateLabel(clock())}`;
  return{
    schemaVersion:"d1-uxr-002-intake-batch.2",
    label:"Add document suggestions",
    history:{required:true,undoSteps:1},
    version:{name:versionName,kind:"automatic",requiredBeforeMutation:true},
    sourceDocument:state.file?clone(state.file):null,
    analysis:state.extraction?.parser?{...clone(state.extraction.parser),...(state.extraction.parser.myerasProfileReview?{myerasSourceDecisions:state.candidates.map(candidate=>({id:candidate.id,decision:candidate.decision})),excludedMyerasCandidates:state.candidates.filter(candidate=>candidate.fields?.myerasReview&&candidate.decision==='rejected').map(candidate=>clone(candidate))}:{} )}:null,
    documentType,
    additions,
    merges,
    myerasProfileClaims:clone(profileClaims),
    identity:state.identity?clone(state.identity):null,
    profilePrefill:positive.some(candidate=>candidate.fields?.myerasReview)?null:cvProfilePrefill(positive),
    examReviewQueue:cvExamReviewQueue(positive),
    acceptedCandidateIds:positive.map(({id})=>id),
    acceptedCandidates:positive.map((candidate)=>({
      id:String(candidate.id),
      decision:String(candidate.decision),
      title:String(candidate.title||""),
      categoryId:String(candidate.categoryId||""),
      startDate:candidate.startDate?String(candidate.startDate):null,
      endDate:candidate.endDate?String(candidate.endDate):null,
      provenance:clone(candidate.provenance||[])
    })),
    qualitySuggestions:(state.suggestions||[]).map((suggestion)=>clone(suggestion)),
    candidateDecisions:state.candidates.map(({id,decision})=>({id,decision})),
    remainingCandidates:state.candidates.filter(({decision})=>decision==="undecided").map((candidate)=>clone(candidate)),
    acceptedCount:positive.length+profileClaims.length,
    addedCount:additions.length,
    mergedCount:merges.length,
    createdAt:clock().toISOString()
  };
}

export function applyApprovalBatchToDocument(document,batch){
  if(!document||typeof document!=="object")throw new Error("A timeline document is required.");
  if(batch?.history?.undoSteps!==1||batch?.version?.requiredBeforeMutation!==true)throw new Error("Invalid intake batch contract.");
  const currentProfile=document.studentProfile||{};
  const profilePatch={},profileBindings=clone(currentProfile.fieldProvenance||{});
  for(const claim of batch.myerasProfileClaims||[]){
    if(!MYERAS_PROFILE_FIELDS.includes(claim.field)||claim.decision!=='accepted'||!claim.resolution)throw new Error("Invalid reviewed MyERAS profile claim.");
    if(String(currentProfile[claim.field]||'').trim()!==claim.expectedPrior)throw new Error("Your profile changed during review. Import again to compare the current value.");
    if(claim.resolution.keepCurrent)continue;
    profilePatch[claim.field]=claim.resolution.value;
    profileBindings[claim.field]={sourceType:'myeras-profile-intake',claimId:claim.id,visibilityState:claim.visibilityState==='INTERVIEWER_SAFE'?'INTERVIEWER_SAFE':'ADVISOR_ONLY',provenance:clone(claim.resolution.provenance),sourceIds:clone(claim.resolution.sourceIds),review:clone(claim.resolution)};
    if(claim.field==='graduationDate'){
      const date=myerasDate(claim.resolution.value);profilePatch.graduationDate=date.precision==='YEAR'?date.raw:date.value.slice(0,7);profilePatch.graduationDatePrecision=date.precision==='DAY'?'MONTH':date.precision;profileBindings.graduationDate.sourceDatePrecision=date.precision;profileBindings.graduationDate.sourceDate=date.raw;profileBindings.graduationDatePrecision=clone(profileBindings.graduationDate);
    }
    if(claim.field==='medicalSchool'){profilePatch.medicalSchoolEntryMode='unlisted';profilePatch.medicalSchoolVerificationStatus='unverified-source-claimed';profilePatch.medicalSchoolNormalizationStatus='review-required';profilePatch.medicalSchoolAnalyticsEligible=false;profilePatch.canonicalSchoolId='';profilePatch.medicalSchoolRecord=null;profilePatch.medicalSchoolCity='';profilePatch.medicalSchoolUnlistedSubmission=null;}
  }
  const nextEvents=clone(Array.isArray(document.events)?document.events:[]);
  const existingIds=new Set(nextEvents.map(({id})=>id));
  for(const addition of batch.additions){
    if(existingIds.has(addition.id))throw new Error(`Event ${addition.id} already exists.`);
    existingIds.add(addition.id);
  }
  for(const merge of batch.merges){
    const event=nextEvents.find(({id})=>id===merge.eventId);
    if(!event)throw new Error(`Merge target ${merge.eventId} is unavailable.`);
    Object.assign(event,clone(merge.patch));
  }
  nextEvents.push(...batch.additions.map((event)=>clone(event)));
  if(batch.profilePrefill){
    const current=document.studentProfile&&typeof document.studentProfile==="object"
      ?document.studentProfile:{};
    const prefill=batch.profilePrefill;
    const patch={};
    const sourceEvent=nextEvents.find(event=>(event.provenance||[]).some(provenance=>String(provenance.extractionCandidateId)===prefill.sourceCandidateId));
    const fieldProvenance=clone(current.fieldProvenance||{});
    // Adding an imported school must not retroactively label independent
    // preexisting profile values as that school's private source claims.
    // Ambiguous earlier imports keep their existing conservative projection.
    const hasPriorImportedProfile=current.medicalSchoolVerificationStatus==='unverified-source-claimed'||
      current.medicalSchoolNormalizationStatus==='review-required'||current.fullNameProvenance?.length||
      document.builder?.lastAiPrefill||document.intake?.lastImport||
      (document.events||[]).some(event=>event.sourceType==='document-intake')||
      Object.values(fieldProvenance).some(binding=>binding?.sourceType==='document-intake');
    if(!hasPriorImportedProfile&&!String(current.medicalSchool||'').trim()&&prefill.medicalSchool){
      for(const field of['medicalSchoolCountry','graduationDate','graduationDatePrecision','degree']){
        if(String(current[field]||'').trim()&&!fieldProvenance[field]){
          fieldProvenance[field]={sourceType:'manual',visibilityState:'INTERVIEWER_SAFE'};
        }
      }
    }
    /* When the student has just confirmed this document belongs to someone other than
       the name the Timeline carried, the typed profile facts beside that name (school,
       degree, graduation) belonged to that other identity too. Explicit document facts
       replace typed values that have no source of their own; sourced values stay. */
    const replacingIdentity=batch.identity?.decision==="use-source"&&batch.identity?.status==="conflict";
    const replaceable=(field)=>replacingIdentity&&field!=="fullName"&&!fieldProvenance[field]?.provenance?.length&&fieldProvenance[field]?.sourceType!=="document-intake";
    const replacedProfile={};
    for(const field of["fullName","medicalSchool","medicalSchoolCountry","graduationDate","degree","languages","hobbies"]){
      if(String(current[field]||"").trim()&&replaceable(field)&&String(prefill[field]||"").trim()&&String(prefill[field]).trim()!==String(current[field]).trim()){
        replacedProfile[field]=String(current[field]);
        current[field]="";
      }
      if(!String(current[field]||"").trim()&&String(prefill[field]||"").trim()){
        patch[field]=prefill[field];
        fieldProvenance[field]={sourceType:'document-intake',sourceCandidateId:prefill.sourceCandidateId,
          sourceEventId:sourceEvent?.id||null,visibilityState:prefill.visibilityState,
          provenance:clone(field==='fullName'?prefill.fullNameProvenance:field==='degree'&&prefill.degreeProvenance?.length?prefill.degreeProvenance:field==='medicalSchool'&&prefill.medicalSchoolProvenance?.length?prefill.medicalSchoolProvenance:prefill.claimProvenance?.[field]?.length?prefill.claimProvenance[field]:prefill.provenance)};
      }
    }
    if(Object.keys(patch).length)patch.fieldProvenance=fieldProvenance;
    if(patch.graduationDate){
      patch.graduationDatePrecision=prefill.graduationDatePrecision;
      fieldProvenance.graduationDatePrecision=clone(fieldProvenance.graduationDate);
    }
    if(patch.fullName)patch.fullNameProvenance=clone(prefill.fullNameProvenance||[]);
    if(patch.medicalSchool){
      patch.medicalSchoolEntryMode="unlisted";
      patch.medicalSchoolVerificationStatus=prefill.verificationStatus;
      patch.medicalSchoolNormalizationStatus="review-required";
      patch.medicalSchoolAnalyticsEligible=false;
      for(const field of['medicalSchoolEntryMode','medicalSchoolVerificationStatus','medicalSchoolNormalizationStatus','medicalSchoolAnalyticsEligible'])fieldProvenance[field]=clone(fieldProvenance.medicalSchool);
    }
    if(Object.keys(replacedProfile).length){
      patch.identityReplacedProfile={...(current.identityReplacedProfile||{}),...replacedProfile};
      if(replacedProfile.medicalSchool){
        for(const field of["canonicalSchoolId","medicalSchoolRecord","medicalSchoolCity","medicalSchoolUnlistedSubmission"])current[field]=field==="medicalSchoolRecord"||field==="medicalSchoolUnlistedSubmission"?null:"";
      }
    }
    document.studentProfile={...current,...patch};
  }
  if(batch.identity&&batch.identity.decision){
    const current=document.studentProfile&&typeof document.studentProfile==="object"?document.studentProfile:{};
    const claim=batch.identity.claim||null;
    const receipt={
      decision:String(batch.identity.decision),fullName:String(claim?.fullName||""),sourceForm:String(claim?.sourceForm||""),
      aamcId:String(claim?.aamcId||""),previousName:String(current.fullName||""),at:String(batch.createdAt||""),
      fileName:String(batch.sourceDocument?.name||""),sourceSha256:String(claim?.provenance?.[0]?.sourceSha256||""),
      provenance:clone(claim?.provenance||[])
    };
    if(batch.identity.decision==="use-source"&&claim?.fullName){
      const fieldProvenance=clone(current.fieldProvenance||{});
      fieldProvenance.fullName={sourceType:"document-identity",visibilityState:"INTERVIEWER_SAFE",provenance:clone(claim.provenance||[]),aamcId:String(claim.aamcId||""),sourceForm:String(claim.sourceForm||"")};
      const patch={fullName:claim.fullName,fullNameProvenance:clone(claim.provenance||[]),fieldProvenance};
      if(claim.aamcId&&!String(current.aamcDisplay||"").trim()){
        patch.aamcDisplay=String(claim.aamcId);
        fieldProvenance.aamcDisplay={sourceType:"document-identity",visibilityState:"INTERVIEWER_SAFE",provenance:clone(claim.provenance||[])};
      }
      document.studentProfile={...current,...patch};
    }
    document.intake=document.intake&&typeof document.intake==="object"?document.intake:{};
    document.intake.sourceIdentity=receipt;
  }
  document.builder=document.builder&&typeof document.builder==="object"?document.builder:{};
  const priorExamQueue=Array.isArray(document.builder.aiExamReviewQueue)
    ?document.builder.aiExamReviewQueue:[];
  const examBySource=new Map(priorExamQueue.map((item)=>[String(item.sourceCandidateId),clone(item)]));
  for(const item of batch.examReviewQueue||[])examBySource.set(String(item.sourceCandidateId),clone(item));
  document.builder.aiExamReviewQueue=[...examBySource.values()];
  const examIds={STEP_1:'step-1',STEP_2_CK:'step-2-ck',STEP_3:'step-3'};
  const exams=clone(Array.isArray(document.exams)?document.exams:[]);
  for(const item of batch.examReviewQueue||[]){
    const examId=examIds[item.canonicalType];
    if(!examId||!item.provenance?.length||(!item.result&&!item.score))continue;
    const existing=exams.find(exam=>exam.system==='USMLE'&&exam.examId===examId&&exam.examDate===item.examDate);
    const sourceEvent=nextEvents.find(event=>(event.provenance||[]).some(provenance=>String(provenance.extractionCandidateId)===item.sourceCandidateId));
    // Reimport may enrich empty fields, but never overwrite another accepted result.
    if(existing){
      for(const field of ['result','score'])if(!existing[field]&&item[field]){
        existing[field]=item[field];
        existing.fieldProvenance={...(existing.fieldProvenance||{}),[field]:{
          sourceType:'document-intake',sourceCandidateId:item.sourceCandidateId,sourceEventId:sourceEvent?.id||null,
          visibilityState:item.visibilityState,provenance:clone(item.provenance)}};
      }
      continue;
    }
    exams.push({id:`cv-exam-${item.sourceCandidateId}`,system:'USMLE',examId,
      name:examId==='step-2-ck'?'Step 2 CK':examId==='step-1'?'Step 1':'Step 3',
      result:item.result,score:item.score,examDate:item.examDate,examDatePrecision:item.examDatePrecision,studyStartDate:'',
      passFailOnly:examId==='step-1',showScoreOnTimeline:Boolean(item.score),showScoreTouched:true,attemptNumberUnconfirmed:item.attempt==null,...(item.attempt!=null?{attempt:item.attempt}:{}),
      sourceType:'document-intake',sourceCandidateId:item.sourceCandidateId,sourceEventId:sourceEvent?.id||null,
      visibilityState:item.visibilityState,provenance:clone(item.provenance)});
  }
  document.exams=exams;
  if((batch.examReviewQueue||[]).length){
    document.builder.examSystems=[...new Set([...(document.builder.examSystems||[]),...exams.filter(exam=>(batch.examReviewQueue||[]).some(item=>item.sourceCandidateId===exam.sourceCandidateId)).map(exam=>exam.system)])];
  }
  document.builder.lastAiPrefill={
    at:batch.createdAt,
    sourceFileName:String(batch.sourceDocument?.name||""),
    acceptedCount:Number(batch.acceptedCount)||0,
    eventCount:Number(batch.addedCount)||0,
    profilePrefilled:!!batch.profilePrefill||(batch.myerasProfileClaims||[]).length>0,
    examReviewCount:(batch.examReviewQueue||[]).length
  };
  const nextIntake={
    ...(document.intake||{}),
    stage:INTAKE_STAGES.DONE,
    file:batch.sourceDocument?clone(batch.sourceDocument):null,
    candidates:batch.remainingCandidates.map((candidate)=>clone(candidate)),
    suggestions:(batch.qualitySuggestions||[]).map((suggestion)=>clone(suggestion)),
    filter:"all",
    lastImport:{
      documentType:String(batch.documentType||""),
      at:batch.createdAt,
      fileName:batch.sourceDocument?.name||"",
      acceptedCount:batch.acceptedCount,
      addedCount:batch.addedCount,
      mergedCount:batch.mergedCount,
      acceptedCandidates:(batch.acceptedCandidates||[]).map((candidate)=>clone(candidate)),
      analysis:batch.analysis?clone(batch.analysis):null
    }
  };
  nextIntake.lastAcceptedCvImport=acceptedCvImportReceipt(nextIntake.lastImport)||
    acceptedCvImportReceipt(document.intake?.lastImport)||acceptedCvImportReceipt(document.intake?.lastAcceptedCvImport);
  if(Object.keys(profilePatch).length)document.studentProfile={...document.studentProfile,...profilePatch,fieldProvenance:profileBindings};
  document.events=nextEvents;
  document.intake=nextIntake;
  return{appliedCount:batch.acceptedCount,addedCount:batch.addedCount,mergedCount:batch.mergedCount};
}

export function acceptedPreviewEvents(state,existingEvents=[]){
  const events=[];
  for(const candidate of state.candidates||[]){
    if(!positiveDecision(candidate.decision))continue;
    if(candidate.decision==="merge"){
      const existing=existingEvents.find(({id})=>id===candidate.duplicate?.eventId);
      if(existing)events.push({...clone(existing),...mergePatch(existing,candidate,state.file?.name||"")});
    }else{
      events.push(candidateEvent(
        candidate,
        `intake-preview-${candidate.id}`,
        state.file?.name||""
      ));
    }
  }
  return events;
}

export class IntakeStateMachine{
  constructor({adapter=null,initialState=null,existingEvents=[],existingProfile={},clock=()=>new Date(),idFactory=null,narrationDelay=undefined}={}){
    this.adapter=adapter;
    this.existingProfile=clone(existingProfile||{});
    /* Tests pass narrationDelay:null to skip the read-aloud pacing; the product waits. */
    this.narrationDelay=narrationDelay===undefined
      ?(ms,signal)=>new Promise((resolve)=>{
        const timer=setTimeout(resolve,ms);
        signal?.addEventListener?.("abort",()=>{clearTimeout(timer);resolve();},{once:true});
      })
      :narrationDelay;
    this.existingEvents=clone(existingEvents||[]);
    this.clock=clock;
    this.idFactory=idFactory||((prefix)=>`${prefix}-${crypto.randomUUID()}`);
    this.state=initialState
      ?hydrateIntakeState(initialState,{existingEvents:this.existingEvents})
      :createIntakeState({existingEvents:this.existingEvents});
    this.sourceFile=null;
    this.listeners=new Set();
    this.abortController=null;
    this.runSequence=0;
  }

  snapshot(){return clone(this.state);}

  capability(){return intakeCapabilityMetadata(this.adapter);}

  subscribe(listener){
    this.listeners.add(listener);
    listener(this.snapshot());
    return()=>this.listeners.delete(listener);
  }

  emit(){
    const value=this.snapshot();
    for(const listener of this.listeners)listener(value);
  }

  dispatch(action){
    this.state=transitionIntake(this.state,action,{existingEvents:this.existingEvents,existingProfile:this.existingProfile});
    this.emit();
    return this.snapshot();
  }

  receiveFile(file){
    const result=this.dispatch({type:"RECEIVE_FILE",file});
    this.sourceFile=result.file?file:null;
    return result;
  }

  setConsent(value){return this.dispatch({type:"SET_CONSENT",value});}
  cycleDocumentType(){return this.dispatch({type:"CYCLE_DOCUMENT_TYPE"});}
  rotateStatus(){return this.dispatch({type:"ROTATE_STATUS"});}
  setFilter(filter){return this.dispatch({type:"SET_FILTER",filter});}
  editCandidate(id,patch){return this.dispatch({type:"EDIT_CANDIDATE",id,patch});}
  toggleEdit(id){return this.dispatch({type:"TOGGLE_EDIT",id});}
  decideCandidate(id,decision){return this.dispatch({type:"DECIDE_CANDIDATE",id,decision});}
  acceptAllHighConfidence(){return this.dispatch({type:"ACCEPT_HIGH_CONFIDENCE"});}
  decideIdentity(decision){return this.dispatch({type:"IDENTITY_DECISION",decision});}
  acceptSection(candidateIds){return this.dispatch({type:"ACCEPT_SECTION",candidateIds});}
  resolveDuplicateGroup(id,choice){return this.dispatch({type:"RESOLVE_DUPLICATE_GROUP",id,choice});}
  applySuggestion(id){return this.dispatch({type:"APPLY_SUGGESTION",id});}
  dismissSuggestion(id){return this.dispatch({type:"DISMISS_SUGGESTION",id});}
  undoSuggestion(id){return this.dispatch({type:"UNDO_SUGGESTION",id});}

  resetUpload(){
    this.abortController?.abort();
    this.abortController=null;
    this.sourceFile=null;
    return this.dispatch({type:"RESET_UPLOAD"});
  }

  discardAll(){
    this.sourceFile=null;
    return this.dispatch({type:"DISCARD_ALL"});
  }

  async startExtraction(){
    if(typeof this.adapter?.extract!=="function"){
      const error=new Error("Document extraction requires an injected adapter.");
      error.code="INTAKE_EXTRACTION_ADAPTER_REQUIRED";
      throw error;
    }
    const run=++this.runSequence;
    this.dispatch({type:"START_EXTRACTION"});
    this.abortController=new AbortController();
    const startedAt=Date.now();
    try{
      const response=await this.adapter.extract({
        file:this.sourceFile,
        metadata:clone(this.state.file),
        documentType:this.state.detectedType,
        signal:this.abortController.signal
      });
      if(run!==this.runSequence||this.abortController.signal.aborted)return this.snapshot();
      /* Narrate every stage at a readable pace before revealing the review. */
      const minimum=EXTRACTION_MIN_STAGE_MS*EXTRACTION_STATUSES.length;
      const remaining=minimum-(Date.now()-startedAt);
      if(remaining>0&&typeof this.narrationDelay==="function"){
        await this.narrationDelay(remaining,this.abortController.signal);
        if(run!==this.runSequence||this.abortController.signal.aborted)return this.snapshot();
      }
      const outcome=String(response?.outcome||response?.status||"").toLowerCase();
      if(response?.readable===false||["unreadable","scanned-no-text","scanned_no_text"].includes(outcome)){
        return this.dispatch({type:"EXTRACTION_UNREADABLE"});
      }
      const candidates=Array.isArray(response)?response:(response?.candidates||[]);
      if(!candidates.length&&!response?.parser?.myerasProfileReview?.claims?.length)return this.dispatch({type:"EXTRACTION_EMPTY"});
      return this.dispatch({
        type:"EXTRACTION_SUCCEEDED",
        candidates,
        sourceDocument:response?.sourceDocument||null,
        parser:response?.parser||null,
        qualitySuggestions:response?.qualitySuggestions||response?.parser?.qualitySuggestions||[]
      });
    }catch(error){
      if(error?.name==="AbortError"||run!==this.runSequence)return this.snapshot();
      const code=String(error?.code||"").toLowerCase();
      if(["unreadable","scanned_no_text","scanned-no-text"].includes(code)){
        return this.dispatch({type:"EXTRACTION_UNREADABLE"});
      }
      this.dispatch({type:"EXTRACTION_ABORTED",errorCode:String(error?.code||"ADAPTER_ERROR"),errorMessage:String(error?.message||"The document could not be read safely.")});
      throw error;
    }finally{
      if(run===this.runSequence)this.abortController=null;
    }
  }

  requestCancel(){
    if(this.state.stage===INTAKE_STAGES.REVIEW&&!this.state.approval.applied&&this.state.candidates.length){
      return{
        requiresConfirmation:true,
        dialog:{
          title:"Discard these suggestions?",
          body:`You haven't approved any of the ${this.state.candidates.length} suggested events. They'll be deleted.`,
          primaryLabel:"Keep reviewing",
          secondaryLabel:"Discard",
          destructiveLabel:"Discard"
        }
      };
    }
    this.resetUpload();
    return{requiresConfirmation:false};
  }

  confirmDiscard(){
    this.discardAll();
    return{discarded:true};
  }

  async approveAccepted({saveVersion,applyBatch}={}){
    if(typeof saveVersion!=="function")throw new Error("saveVersion callback is required.");
    if(typeof applyBatch!=="function")throw new Error("applyBatch callback is required.");
    if(this.state.approval.applied)throw new Error("This approval batch has already been applied.");
    const batch=buildApprovalBatch(this.state,this.existingEvents,{idFactory:this.idFactory,clock:this.clock});
    this.dispatch({type:"APPROVAL_STARTED",versionName:batch.version.name});
    try{
      if(!this.state.approval.versionSaved){
        await saveVersion(batch.version.name,batch.version.kind);
        this.dispatch({type:"APPROVAL_VERSION_SAVED"});
      }
      const result=await applyBatch(clone(batch),{
        label:batch.label,
        history:true,
        undoSteps:1
      });
      const appliedCount=Number(result?.appliedCount??batch.acceptedCount);
      const priorCv=acceptedCvImportReceipt(this.state.lastImport)||acceptedCvImportReceipt(this.state.lastAcceptedCvImport);
      this.state.lastImport={documentType:String(batch.documentType||""),at:batch.createdAt,fileName:batch.sourceDocument?.name||"",
        acceptedCount:batch.acceptedCount,addedCount:batch.addedCount,mergedCount:batch.mergedCount,
        acceptedCandidates:clone(batch.acceptedCandidates||[]),analysis:batch.analysis?clone(batch.analysis):null,
        identity:batch.identity?{decision:String(batch.identity.decision||""),fullName:String(batch.identity.claim?.fullName||""),aamcId:String(batch.identity.claim?.aamcId||""),sourceForm:String(batch.identity.claim?.sourceForm||""),previousName:String(batch.identity.current||"")}:null};
      this.state.lastAcceptedCvImport=acceptedCvImportReceipt(this.state.lastImport)||priorCv;
      this.dispatch({type:"APPROVAL_SUCCEEDED",appliedCount,addedCount:Number(result?.addedCount??batch.addedCount)||0,mergedCount:Number(result?.mergedCount??batch.mergedCount)||0,fileName:batch.sourceDocument?.name});
      return{batch,result:this.snapshot().approval};
    }catch(error){
      this.dispatch({type:"APPROVAL_FAILED",errorCode:String(error?.code||"APPROVAL_FAILED")});
      throw error;
    }
  }

  async deleteDocument(deleteSource=async()=>{}){
    const file=this.state.file?clone(this.state.file):null;
    if(file)await deleteSource(file);
    this.sourceFile=null;
    this.dispatch({type:"DOCUMENT_DELETED"});
    return{deleted:!!file};
  }
}

function progressMarkup(state){
  return`<ol class="intake-progress" aria-label="Document intake progress">${INTAKE_PROGRESS.map((label,index)=>{
    const status=index<state.progressIndex?"complete":index===state.progressIndex?"current":"upcoming";
    return`<li data-progress="${status}"${status==="current"?' aria-current="step"':""}><span></span>${label}</li>`;
  }).join("")}</ol>`;
}

function uploadMarkup(state){
  const ready=!!state.file&&state.consent;
  return`<section class="intake-stage intake-upload" aria-labelledby="intake-title">
    <h1 id="intake-title">${INTAKE_COPY.uploadTitle}</h1>
    <label class="intake-dropzone" data-intake-dropzone>
      <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" data-intake-file>
      <strong>Drop a PDF here, or browse</strong>
      <span>PDF or DOCX · up to 15MB</span>
    </label>
    ${state.file?`<div class="intake-file-row"><span>${escapeHtml(state.file.name)}</span><span class="status-chip">Looks like: ${escapeHtml(state.detectedType)}</span><button type="button" class="button tertiary" data-intake-action="change-type">Change</button></div>`:""}
    ${state.fileError?`<p class="field-error" role="alert">${escapeHtml(state.fileError)}</p>`:""}
    <p class="secondary-body">${INTAKE_COPY.privacy}</p>
    <label class="intake-consent"><input type="checkbox" data-intake-consent${state.consent?" checked":""}> <span>${INTAKE_COPY.consent}</span></label>
    <span class="intake-read-gate" data-intake-read-gate${ready?"":` data-gate-reason="${escapeHtml(!state.file?"Add your document first.":"Check the consent box first.")}"`}><button type="button" class="button primary" data-intake-action="read"${ready?"":` disabled aria-disabled="true" title="${escapeHtml(!state.file?"Add your document first":"Check the consent box first")}"`}>${INTAKE_COPY.read}</button></span>
    ${ready?"":`<p class="intake-gate-hint" data-intake-gate-hint aria-live="polite">${escapeHtml(!state.file?"Add a PDF or DOCX to continue.":"Tick the consent box to read your document.")}</p>`}
  </section>`;
}

function failureMarkup(kind){
  const message=kind==="empty"?INTAKE_COPY.empty:INTAKE_COPY.unreadable;
  return`<section class="intake-stage intake-failure" data-intake-failure="${escapeHtml(kind)}">
    <div class="card">
      <p>${message}</p>
      <div class="button-row">
        <button type="button" class="button primary" data-intake-action="try-another">Try another file</button>
        <button type="button" class="button secondary" data-intake-action="guided-builder">Use the guided builder instead</button>
      </div>
    </div>
  </section>`;
}

function extractionMarkup(state){
  if(state.failure)return failureMarkup(state.failure.kind);
  const status=state.file?.timelineRescue===true&&state.extraction.statusIndex===0
    ?"Reading your Timeline…":EXTRACTION_STATUSES[state.extraction.statusIndex];
  return`<section class="intake-stage intake-extraction" aria-labelledby="intake-title">
    <h1 id="intake-title">Reading ${escapeHtml(state.file?.name||"document")}…</h1>
    <div class="indeterminate-progress" role="progressbar" aria-label="Reading document"></div>
    <p class="extraction-status" aria-live="polite">${status}</p>
  </section>`;
}

function categoryOptions(selected){
  const unresolved=!CATEGORIES.some(({id})=>id===selected)
    ?'<option value="" selected disabled>Choose a category</option>'
    :"";
  return unresolved+CATEGORIES.map(({id,label})=>`<option value="${escapeHtml(id)}"${id===selected?" selected":""}>${escapeHtml(label)}</option>`).join("");
}

function fieldLabel(key){
  return String(key).replace(/([a-z])([A-Z])/g,"$1 $2").replace(/[_-]+/g," ").replace(/^\w/,value=>value.toUpperCase());
}

const INTERNAL_CANDIDATE_FIELDS=new Set([
  "canonicalType",
  "sourceLocation",
  "sourceProvenance",
  "extractionConfidence",
  "extractionBasis",
  "datePrecision",
  "mappingRationale",
  "mappingReviewRequired",
  "extractionWarnings",
  "inferredFields",
  "duplicateGroupIds",
  "conflictIds",
  "privacy",
  "sourceDateWording",
  "sourceCategoryToken",
  "categoryConfirmed",
  "profileHeaderReviewRequired",
  "profileHeaderConflicts",
  "profileHeaderConflictProvenance",
  "acceptProfileClaims",
  "profileMedicalSchoolProvenance",
  "profileDegreeProvenance",
  "aiOriginalSemantic"
]);

function reviewField(candidate,field){
  const value=candidate.fields?.[field.key]??"";
  const attributes=`data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-extra="${escapeHtml(field.key)}"`;
  if(field.type==="select"){
    return`<label>${escapeHtml(field.label)} <select ${attributes}>${!field.options.some(option=>String(option)===String(value))||field.key==="result"?`<option value=""${value?"":" selected"}>Not stated — review</option>`:""}${field.options.map((option)=>`<option value="${escapeHtml(option)}"${String(value)===option?" selected":""}>${escapeHtml(option)}</option>`).join("")}</select></label>`;
  }
  if(field.type==="checkbox"){
    const checked=value===true||value==="true";
    return`<label class="candidate-toggle"><input type="checkbox" ${attributes}${checked?" checked":""}> <span>${escapeHtml(field.label)}</span></label>`;
  }
  return`<label>${escapeHtml(field.label)} <input type="${field.type==="number"?"number":"text"}" value="${escapeHtml(value)}" ${attributes}></label>`;
}

function expandedFields(candidate,{includeIdentity=false}={}){
  const schema=CATEGORY_REVIEW_FIELDS[candidate.categoryId]||[];
  const schemaKeys=new Set(schema.map(({key})=>key));
  const frozen=schema.map((field)=>reviewField(candidate,field)).join("");
  const extra=Object.entries(candidate.fields||{}).filter(([key,value])=>
    !schemaKeys.has(key)&&
    !(candidate.fields?.myerasReview&&(value===''||["stillWorking","ongoing","currentlyOnRotation","sourceDescription"].includes(key)))&&
    !INTERNAL_CANDIDATE_FIELDS.has(key)&&
    ["string","number","boolean"].includes(typeof value)
  ).map(([key,value])=>`<label>${escapeHtml(fieldLabel(key))}
    <input type="text" value="${escapeHtml(value)}" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-extra="${escapeHtml(key)}">
  </label>`).join("");
  /* The compact "needs your help" card hides the always-on title and category inputs, so
     Edit has to bring them back or those entries would become uneditable. */
  const identity=includeIdentity
    ?`<label>Category <select data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-field="categoryId">${categoryOptions(candidate.categoryId)}</select></label>
    <label>Proposed title <input type="text" value="${escapeHtml(candidate.title)}" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-field="title"></label>`
    :"";
  return`<div class="candidate-expanded" data-candidate-expanded>
    ${identity}${frozen}${extra}
    <label>Notes <textarea data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-field="notes">${escapeHtml(candidate.notes)}</textarea></label>
  </div>`;
}

export function candidateDatePrecision(candidate,field){
  const precision=candidate?.fields?.datePrecision;
  const edge=field==="endDate"?"end":"start";
  if(typeof precision==="string")return precision.toUpperCase();
  const direct=precision?.[edge]||precision?.[field];
  if(direct)return String(direct).toUpperCase();
  const inferred=[...(candidate?.inferredFields||[]),...(candidate?.fields?.inferredFields||[])].find((item)=>item.field===field&&item.sourcePrecision);
  return String(inferred?.sourcePrecision||"").toUpperCase();
}

const candidateDateLabel=(candidate,field)=>{
 const edge=field==='endDate'?'end':'start',wording=candidate.fields?.sourceDateWording?.[edge];
 if(wording?.raw&&wording.normalizedMonth===candidate[field]&&['SEASON','VAGUE_RANGE'].includes(wording.precision))return wording.raw;
 return candidateDatePrecision(candidate,field)==='YEAR'?String(candidate[field]||'').slice(0,4):String(candidate[field]||'');
};

function candidateMonthField(candidate,field,label,value){
  const id=`intake-${encodeURIComponent(candidate.id)}-${field}`;
  if(candidate.fields?.myerasReview&&candidateDatePrecision(candidate,field)==="DAY")return`<label>${escapeHtml(label)} <input type="text" value="${escapeHtml(value||'')}" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-field="${field}" aria-label="${escapeHtml(label)} exact source date"></label>`;
  if(candidateDatePrecision(candidate,field)==="YEAR"){
    return`<div class="candidate-month candidate-year"><label for="${id}">${escapeHtml(label)} year
      <input id="${id}" type="text" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" value="${escapeHtml(String(value||"").slice(0,4))}" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-field="${field}" data-candidate-year-only="true" data-candidate-placeholder-month="${field==="endDate"?"12":"01"}" aria-describedby="${id}-precision">
      </label><span class="field-help" id="${id}-precision">Year only · month unconfirmed</span></div>`;
  }
  return`<div class="candidate-month" data-candidate-month data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-field="${field}">
    ${monthFieldMarkup({id,label,value:value||""})}
  </div>`;
}

function candidateSource(candidate){
  const provenance=candidate.provenance?.[0]||candidate.fields?.sourceProvenance?.[0]||null;
  if(!provenance)return null;
  const section=String(provenance.section||"").replaceAll("_"," ");
  const locator=Number.isFinite(Number(provenance.pageNumber))&&Number(provenance.pageNumber)>0
    ?`Page ${Number(provenance.pageNumber)}`
    :section
      ?`Section: ${section}`
      :"Document text";
  return{fileName:String(provenance.fileName||provenance.sourceDocumentName||"Source document"),locator,section};
}

function candidateEvidenceMarkup(candidate){
  const source=candidateSource(candidate);
  const details=candidate.confidenceDetails||candidate.fields?.extractionConfidence||null;
  const inferred=candidate.inferredFields?.length?candidate.inferredFields:candidate.fields?.inferredFields||[];
  const warnings=[...new Set([...(candidate.warnings||[]),...(candidate.fields?.extractionWarnings||[])].map(String).filter(Boolean))];
  const relation=[];
  if(candidate.duplicate)relation.push("Duplicate review required");
  if(candidate.fields?.conflictIds?.length)relation.push("Source conflict review required");
  const confidenceReasons=Array.isArray(details?.summary)?details.summary:[];
  const dateStatus=inferred.length
    ?`Inferred values: ${inferred.map((item)=>String(item.field||"date")).join(", ")}`
    :candidate.startDate?"No date inference recorded":"Start date needs review";
  return`<details class="source-snippet candidate-evidence" aria-label="Extraction evidence">
    <summary>Source and confidence${source?` · ${escapeHtml(source.locator)}`:""}</summary>
    ${candidate.sourceSnippet?`<blockquote>“${escapeHtml(candidate.sourceSnippet)}”</blockquote>`:""}
    ${candidate.fields?.profileFullName?`<p class="secondary-body">Name from the ${candidate.fields.rescueProfileClaims?'visible Timeline header and profile':'CV header'}: <strong>${escapeHtml(candidate.fields.profileFullName)}</strong>. ${candidate.fields.profileHeaderReviewRequired?'Confirm profile details separately to fill an empty profile name.':'Accepting this entry fills an empty profile name.'}</p>`:""}
    ${candidate.fields?.profileMedicalSchool||candidate.fields?.profileDegree?`<p class="secondary-body">Explicit CV profile: ${escapeHtml([candidate.fields.profileMedicalSchool,candidate.fields.profileDegree].filter(Boolean).join(' · '))}. Confirm separately before empty profile fields are filled; the experience institution remains unchanged.</p>`:''}
    ${source?`<p class="secondary-body"><strong>${escapeHtml(source.fileName)}</strong> · ${escapeHtml(source.locator)}</p>`:""}
    <p class="secondary-body">Source confidence: ${escapeHtml(candidate.confidence)}. Review eligibility also accounts for duplicates and open checks.</p>
    <p class="secondary-body">Extracted dates: ${escapeHtml(candidateDateLabel(candidate,"startDate")||"Needs review")}${candidate.openEnded?" – ongoing":candidate.endDate?` – ${escapeHtml(candidateDateLabel(candidate,"endDate"))}`:""} · ${escapeHtml(dateStatus)}</p>
    ${relation.map((item)=>`<p class="duplicate-banner">${escapeHtml(item)}</p>`).join("")}
    ${confidenceReasons.length?`<p><strong>Why ${escapeHtml(candidate.confidence)} confidence?</strong> ${escapeHtml(confidenceReasons.join(" · "))}</p>`:""}
    ${warnings.length?`<p>Review notes: ${escapeHtml(warnings.join(" · "))}</p>`:""}
  </details>`;
}

function suggestionLabel(type){
  return SUGGESTION_LABELS[type]||"Review suggestion";
}

function suggestionMarkup(suggestion){
  const resolved=suggestion.status!=="open";
  const attributes=`data-suggestion-id="${escapeHtml(suggestion.id)}"`;
  return`<li class="intake-suggestion" data-suggestion="${escapeHtml(suggestion.id)}" data-suggestion-status="${escapeHtml(suggestion.status)}" data-suggestion-severity="${escapeHtml(suggestion.severity)}">
    <p class="suggestion-head">
      <span class="status-chip${suggestion.severity==="REVIEW"?" gold":""}">${escapeHtml(suggestionLabel(suggestion.type))}</span>
      <span class="secondary-body">${suggestion.source==="AI_REVIEW"?"AI review":"Document check"}</span>
      ${suggestion.status==="applied"?'<span class="status-badge success">Applied</span>':""}
      ${suggestion.status==="dismissed"?'<span class="status-badge">Dismissed</span>':""}
    </p>
    <p>${escapeHtml(suggestion.reason)}</p>
    <p class="secondary-body">${escapeHtml(suggestion.recommendation)}</p>
    ${suggestion.proposal?.evidence&&!resolved?`<p class="secondary-body">${escapeHtml(suggestion.proposal.evidence)}</p>`:""}
    <span class="suggestion-actions">
      ${!resolved&&suggestion.proposal?`<button type="button" class="button secondary small" ${attributes} data-suggestion-action="apply">${escapeHtml(suggestion.proposal.label)}</button>`:""}
      ${resolved
        ?`<button type="button" class="button tertiary small" ${attributes} data-suggestion-action="undo">Undo</button>`
        :`<button type="button" class="button tertiary small" ${attributes} data-suggestion-action="dismiss">Dismiss</button>`}
    </span>
  </li>`;
}

function isTimelineRescueReview(state){
  return [state.detectedType,state.extraction?.sourceDocument?.effectiveType,state.extraction?.parser?.effectiveType]
    .some(type=>String(type||"").toUpperCase()==="TIMELINE_RESCUE")||
    (state.candidates||[]).some(candidate=>candidate.fields?.rescueReviewRequired===true);
}

function rescueReconstructionMarkup(state){
  if(!isTimelineRescueReview(state))return"";
  return`<section class="intake-suggestions" aria-label="What Timeline Rescue rebuilds" data-rescue-reconstruction-notice>
    <h2>What will be rebuilt</h2>
    <p>Only the entries you accept and their supported profile details are added to a new MissionMed layout. These suggestions come from the uploaded Timeline; check them against your source documents.</p>
    <p><strong>Photos, notes and original object positions from the uploaded file are not restored.</strong> Add photos or notes in Advanced Studio after rebuilding.</p>
    <p class="secondary-body">Your original file stays unchanged. Preview the accepted suggestions below, then use Quality Guardian to check the rebuilt layout before exporting.</p>
  </section>`;
}

function rescueComparisonMarkup(state){
  if(!isTimelineRescueReview(state))return "";
  const items=state.extraction?.parser?.reconciliation||[];
  const matched=items.filter(item=>item.state==="MATCH");
  const names=matched.map(item=>(state.candidates||[]).find(candidate=>candidate.id===item.timelineCandidateId)?.title).filter(Boolean);
  return `<section class="intake-suggestions" aria-label="Source comparison" data-rescue-source-comparison>
    <h2>Source comparison</h2>
    <p>${items.length?`${matched.length} of ${state.candidates?.length||0} Timeline entries match an accepted CV title, with no disagreement in the recorded dates or category.`:
      'No accepted CV comparison is available for this import. Verify these entries against your original sources.'}</p>
    ${names.length?`<details><summary>See matched entries</summary><ul>${names.map(name=>`<li>${escapeHtml(name)}</li>`).join("")}</ul></details>`:""}
    ${items.length?'<p class="secondary-body">This compares saved, student-accepted CV entries. It does not certify the original facts. Review any differences below before importing.</p>':""}
  </section>`;
}

function suggestionsMarkup(state){
  const suggestions=visibleSuggestions(state);
  if(state.extraction?.parser?.myerasProfileReview){
    const held=(state.candidates||[]).filter(candidate=>Object.keys(myerasReviewErrors(candidate)).length).length;
    return`<section class="intake-suggestions" aria-label="Source review"><p class="secondary-body">${held?`${held} experience${held===1?'':'s'} need source conflict or duplicate decisions below.`:'Review your source facts and profile choices below. No facts are verified by dismissing a suggestion.'}</p></section>`;
  }
  if(!suggestions.length){
    if(isTimelineRescueReview(state))return"";
    return`<section class="intake-suggestions empty" aria-label="Document check"><p class="secondary-body">${INTAKE_COPY.suggestionsClear}</p></section>`;
  }
  const open=openSuggestions(state).length;
  return`<section class="intake-suggestions" aria-label="Document check">
    <h2>Before you review: ${open} thing${open===1?"":"s"} we noticed</h2>
    <p class="secondary-body">${INTAKE_COPY.suggestionsSubline}</p>
    <ul class="suggestion-list">${suggestions.map(suggestionMarkup).join("")}</ul>
  </section>`;
}

function candidateSuggestionsMarkup(suggestions){
  return(suggestions||[]).map((suggestion)=>
    `<p class="duplicate-banner" data-candidate-suggestion="${escapeHtml(suggestion.id)}">${escapeHtml(suggestionLabel(suggestion.type))}: ${escapeHtml(suggestion.recommendation)}</p>`
  ).join("");
}

function questionMarkup(candidate,question){
  const attributes=`data-candidate-id="${escapeHtml(candidate.id)}"`;
  if(question.kind==="month")return candidateMonthField(candidate,question.field,question.label,candidate[question.field]);
  if(question.kind==="category")return`<label>${escapeHtml(question.label)} <select ${attributes} data-candidate-field="categoryId">${categoryOptions(candidate.categoryId)}</select></label>`;
  if(question.kind==="toggle")return`<label class="candidate-toggle"><input type="checkbox" ${attributes} data-candidate-extra="${escapeHtml(question.extra)}"> <span>${escapeHtml(question.label)}</span></label>`;
  if(question.field)return`<label>${escapeHtml(question.label)} <input type="text" value="${escapeHtml(candidate[question.field]||"")}" ${attributes} data-candidate-field="${escapeHtml(question.field)}"></label>`;
  return`<label>${escapeHtml(question.label)} <input type="text" value="${escapeHtml(candidate.fields?.[question.extra]||"")}" ${attributes} data-candidate-extra="${escapeHtml(question.extra)}"></label>`;
}

/* LOW confidence must not mean "open the same 30-field form again": ask only for what the
   document leaves genuinely unanswered, and say so when it answers everything. */
function candidateQuestionsMarkup(candidate){
  const questions=candidateQuestions(candidate);
  if(!questions.length)return`<p class="secondary-body candidate-questions-clear">${Object.keys(myerasReviewErrors(candidate)).length?'Compare and resolve the conflicting source facts below before accepting.':candidate.fields?.myerasReview?'Review the stated facts and audience before accepting.':INTAKE_COPY.questionsClear}</p>`;
  return`<div class="candidate-questions" data-candidate-questions="${escapeHtml(candidate.id)}">
    <p class="secondary-body">We need ${questions.length} answer${questions.length===1?"":"s"} from you. Everything else came from your document.</p>
    ${questions.map((question)=>questionMarkup(candidate,question)).join("")}
  </div>`;
}

export function candidateReviewBasis(candidate,parser=null){
  const basis=String(candidate?.fields?.extractionBasis||"").toUpperCase();
  if(["MISSIONMED_RULE","DETERMINISTIC","SOURCE_CHECK"].includes(basis))return{mode:"MISSIONMED_RULE",label:"Source check"};
  if((basis==="AI_REVIEW"||(!basis&&String(parser?.intelligenceMode||"").toUpperCase()==="SERVER_AI"))&&verifiedProviderReceipt022(parser?.providerReceipt))return{mode:"AI_REVIEW",label:"AI review"};
  return{mode:"DOCUMENT_CHECK",label:"Document check"};
}

function candidateMarkup(candidate,{lane="medium",suggestions=[],parser=null}={}){
  const basis=candidateReviewBasis(candidate,parser);
  const basisMarkup=`<span class="candidate-basis" data-candidate-basis="${basis.mode}">${basis.label}</span>`;
  const positive=positiveDecision(candidate.decision);
  if(positive){
    return`<article class="candidate-row accepted" data-candidate-card="${escapeHtml(candidate.id)}">
      <span class="status-badge success">${candidate.decision==="merge"?"Merge":candidate.decision==="add-anyway"?"Add anyway":"Accepted"}</span>
      <strong>${escapeHtml(candidate.title)}</strong>
      ${basisMarkup}
      <button type="button" class="button tertiary small" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-action="undecided">Undo</button>
    </article>`;
  }
  if(candidate.decision==="rejected"){
    return`<article class="candidate-row rejected" data-candidate-card="${escapeHtml(candidate.id)}">
      <span>Rejected</span><strong>${escapeHtml(candidate.title)}</strong>${basisMarkup}
      <button type="button" class="button tertiary small" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-action="undecided">Restore</button>
    </article>`;
  }
  if(candidate.reviewLater){
    return`<article class="candidate-row" data-candidate-card="${escapeHtml(candidate.id)}">
      <span class="status-badge">Review later</span><strong>${escapeHtml(candidate.title)}</strong>${basisMarkup}
      <button type="button" class="button tertiary small" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-action="undecided">Review now</button>
    </article>`;
  }
  const completeRescueReview=candidate.fields?.rescueReviewRequired&&candidateQuestions(candidate).length===0;
  const confidenceLabel=lane==="high"?"Quick review":lane==="medium"||completeRescueReview?"Check required":"Needs details";
  const confidenceClass=lane==="high"?"success":lane==="medium"?"gold":"tertiary";
  const visibility=`<label class="candidate-visibility">Timeline visibility
    <select data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-field="visibilityState">
      <option value="${VISIBILITY.INTERVIEWER_SAFE}"${candidate.visibilityState===VISIBILITY.INTERVIEWER_SAFE?" selected":""}>Show in interview Timeline</option>
      <option value="${VISIBILITY.ADVISOR_ONLY}"${candidate.visibilityState===VISIBILITY.ADVISOR_ONLY?" selected":""}>Advisor only</option>
    </select>
  </label>`;
  const fields=lane==="low"
    ?`<div class="candidate-fields needs-help">
      <strong>${escapeHtml(candidate.title||"Untitled entry")}</strong>
    </div>
    ${candidateQuestionsMarkup(candidate)}${visibility}`
    :`<div class="candidate-fields">
      <label>Category <select data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-field="categoryId">${categoryOptions(candidate.categoryId)}</select></label>
      <label>Proposed title <input type="text" value="${escapeHtml(candidate.title)}" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-field="title"></label>
      ${candidateMonthField(candidate,"startDate","Start",candidate.startDate)}
      ${candidateMonthField(candidate,"endDate","End",candidate.endDate)}
      ${visibility}
    </div>`;
  return`<article class="candidate-card" data-candidate-card="${escapeHtml(candidate.id)}" data-review-lane="${escapeHtml(lane)}">
    <div class="candidate-review-meta">${basisMarkup}<span class="confidence-tag ${confidenceClass}">${confidenceLabel}</span></div>
    ${candidate.duplicate?`<div class="duplicate-banner">Looks like a duplicate of '${escapeHtml(candidate.duplicate.eventTitle)}'</div>`:""}
    ${candidateSuggestionsMarkup(suggestions)}
    ${fields}
    ${candidate.fields?.profileHeaderReviewRequired?`<section class="card" data-cv-profile-review aria-label="Optional profile details from CV header"><strong>Optional profile details from your CV header</strong><p>${escapeHtml([candidate.fields.profileFullName,candidate.fields.profileMedicalSchool,candidate.fields.profileDegree].filter(Boolean).join(' · '))}</p><p class="secondary-body">Source: ${escapeHtml([...(candidate.fields.profileNameProvenance||[]),...(candidate.fields.profileMedicalSchoolProvenance||[]),...(candidate.fields.profileDegreeProvenance||[]),...(candidate.fields.profileHeaderConflictProvenance||[])].map(item=>`Page ${item.pageNumber||1}: ${item.sourceExcerpt}`).join(' · '))}</p>${candidate.fields.profileHeaderConflicts?.length?'<p class="secondary-body">Conflicting CV profile headers need review. Add the dated experience separately, then correct your profile in Builder.</p>':`<label><input type="checkbox" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-extra="acceptProfileClaims"${candidate.fields.acceptProfileClaims===true?' checked':''}> Use these details in my profile</label><p class="secondary-body">Leave unchecked to add only the experience. Existing profile values will remain unchanged.</p>`}</section>`:''}
    ${candidate.fields?.rescueProfileClaims?`<p class="secondary-body" role="note" data-rescue-profile-review>Visible profile details: ${[candidate.fields.profileFullName?`Name: ${escapeHtml(candidate.fields.profileFullName)}`:'',candidate.fields.degree?`Degree: ${escapeHtml(candidate.fields.degree)}`:''].filter(Boolean).join(' · ')}. Accepting this entry fills empty profile fields using this entry's visibility.</p>`:""}
    ${["startDate","endDate"].some((field)=>candidateDatePrecision(candidate,field)==="YEAR")?'<p class="candidate-year-warning" role="note">The source gives years only. Months remain unconfirmed; accepting keeps year-only precision.</p>':""}
    ${candidateEvidenceMarkup(candidate)}
    ${candidate.expanded?expandedFields(candidate,{includeIdentity:lane==="low"}):""}
    <div class="candidate-actions">
      ${candidate.duplicate?`<button type="button" class="button primary small" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-action="merge">Merge</button>
      <button type="button" class="button secondary small" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-action="add-anyway">Add anyway</button>`:`<button type="button" class="button primary small" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-action="accepted">Accept</button>`}
      <button type="button" class="button secondary small" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-action="edit">Edit</button>
      <button type="button" class="button tertiary small" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-action="rejected">Reject</button>
      <button type="button" class="button tertiary small" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-action="deferred">Review later</button>
    </div>
  </article>`;
}

function identityMarkup(state){
  const identity=state?.identity;
  if(!identity)return"";
  const claim=identity.claim;
  const evidence=(identity.provenance||[]).map((item)=>`Page ${item.pageNumber||1}: ${item.sourceExcerpt||""}`).filter(Boolean).join(" · ");
  const name=claim?`<strong>${escapeHtml(claim.fullName)}</strong>${claim.aamcId?` <span class="secondary-body">(AAMC ID ${escapeHtml(claim.aamcId)})</span>`:""}`:"";
  if(identity.status==="unresolved"){
    return`<section class="card intake-identity unresolved" data-intake-identity="unresolved" aria-label="Document identity">
      <strong>We could not confirm whose document this is.</strong>
      <p>${escapeHtml(identity.reason)} Your Timeline name is not changed.</p>
      ${evidence?`<p class="secondary-body">Source: ${escapeHtml(evidence)}</p>`:""}
      ${identity.decision?"":`<div class="candidate-actions"><button type="button" class="button secondary small" data-identity-decision="keep-current">Continue without changing my name</button></div>`}
    </section>`;
  }
  if(identity.status==="conflict"&&!identity.decision){
    return`<section class="card intake-identity conflict" data-intake-identity="conflict" role="alert" aria-label="Whose Timeline is this?">
      <strong>Whose Timeline is this?</strong>
      <p>This document belongs to ${name}, but this Timeline is named <strong>${escapeHtml(identity.current)}</strong>. Nothing is added until you choose.</p>
      <p class="secondary-body">Source: ${escapeHtml(evidence)}</p>
      <div class="candidate-actions">
        <button type="button" class="button primary small" data-identity-decision="use-source">Use ${escapeHtml(claim.fullName)}</button>
        <button type="button" class="button secondary small" data-identity-decision="keep-current">Keep ${escapeHtml(identity.current)}</button>
      </div>
    </section>`;
  }
  const adopted=identity.decision==="use-source";
  const outcome=adopted
    ?`This document belongs to ${name}.${identity.status==="empty"?" It becomes your Timeline name when you add these entries.":identity.status==="conflict"?` It replaces <s>${escapeHtml(identity.current)}</s> when you add these entries.`:""}`
    :`This document belongs to ${name}; your Timeline keeps the name <strong>${escapeHtml(identity.current||"(none yet)")}</strong>.`;
  return`<section class="card intake-identity" data-intake-identity="${escapeHtml(identity.status)}" data-identity-decision-made="${escapeHtml(identity.decision||"")}" aria-label="Document identity">
    <p>${outcome}</p>
    <p class="secondary-body">Source: ${escapeHtml(evidence)}</p>
    <div class="candidate-actions">${adopted
      ?`<button type="button" class="button tertiary small" data-identity-decision="keep-current">${identity.current?`Keep ${escapeHtml(identity.current)} instead`:"Don't use this name"}</button>`
      :`<button type="button" class="button tertiary small" data-identity-decision="use-source">Use ${escapeHtml(claim.fullName)}</button>`}</div>
  </section>`;
}

function duplicateGroupMarkup(state,suggestion){
  const [first,second]=suggestion.candidateIds.map((id)=>(state.candidates||[]).find((candidate)=>candidate.id===id));
  if(!first||!second)return"";
  const line=(candidate)=>{
    const where=candidateInstitution(candidate);
    const dates=`${candidateDateLabel(candidate,"startDate")||"?"}${candidate.openEnded?" – ongoing":candidate.endDate&&candidate.endDate!==candidate.startDate?` – ${candidateDateLabel(candidate,"endDate")}`:""}`;
    return`<strong>${escapeHtml(candidate.title)}</strong>${where?` · ${escapeHtml(where)}`:""} · ${escapeHtml(dates)}`;
  };
  const button=(choice,label,tone="secondary")=>`<button type="button" class="button ${tone} small" data-suggestion-id="${escapeHtml(suggestion.id)}" data-duplicate-choice="${choice}">${label}</button>`;
  return`<section class="candidate-card duplicate-group" data-duplicate-group="${escapeHtml(suggestion.id)}" aria-label="Possible duplicate">
    <div class="candidate-review-meta"><span class="confidence-tag gold">Possible duplicate</span><span class="secondary-body">${escapeHtml(suggestion.reason)}</span></div>
    <p class="duplicate-option"><span class="duplicate-letter">A</span> ${line(first)}</p>
    <p class="duplicate-option"><span class="duplicate-letter">B</span> ${line(second)}</p>
    <div class="candidate-actions">${button("keep-a","Keep A")}${button("keep-b","Keep B")}${button("merge","Merge into one")}${button("keep-both","Keep both","primary")}</div>
    <p class="secondary-body">Nothing is deleted. A rejected entry stays below and can be restored.</p>
  </section>`;
}

function compactCandidateMarkup(candidate,{parser=null}={}){
  const basis=candidateReviewBasis(candidate,parser);
  const category=CATEGORIES.find(({id})=>id===candidate.categoryId);
  const dates=`${candidateDateLabel(candidate,"startDate")||"?"}${candidate.openEnded?" – ongoing":candidate.endDate&&candidate.endDate!==candidate.startDate?` – ${candidateDateLabel(candidate,"endDate")}`:""}`;
  const place=candidate.fields?.sourceLocation||[candidate.fields?.city,candidate.fields?.state].filter(Boolean).join(", ")||candidate.fields?.country||"";
  const source=candidateSource(candidate);
  const detail=[candidateInstitution(candidate),place,dates].filter(Boolean).join(" · ");
  const profileNote=candidate.fields?.profileHeaderReviewRequired&&candidate.fields?.acceptProfileClaims===true
    ?`<span class="secondary-body" data-cv-profile-review>Also fills your profile: ${escapeHtml([candidate.fields.profileFullName,candidate.fields.profileMedicalSchool,candidate.fields.profileDegree].filter(Boolean).join(" · "))} <label><input type="checkbox" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-extra="acceptProfileClaims" checked> Use in my profile</label></span>`
    :"";
  const id=escapeHtml(candidate.id);
  return`<article class="candidate-row ready" data-candidate-card="${id}" data-review-lane="high" data-compact-candidate="true">
    <span class="candidate-chip" style="--chip:${escapeHtml(category?.color||"#5B6168")}">${escapeHtml(category?.label||"Choose category")}</span>
    <span class="candidate-summary"><strong>${escapeHtml(candidate.title)}</strong><span class="secondary-body">${escapeHtml(detail)}</span>${profileNote}<span class="candidate-basis" data-candidate-basis="${basis.mode}">${escapeHtml(basis.label)}${source?` · ${escapeHtml(source.fileName)} · ${escapeHtml(source.locator)}`:""}</span></span>
    <span class="candidate-actions">
      <button type="button" class="button primary small" data-candidate-id="${id}" data-candidate-action="accepted">Accept</button>
      <button type="button" class="button secondary small" data-candidate-id="${id}" data-candidate-action="edit">Edit</button>
      <button type="button" class="button tertiary small" data-candidate-id="${id}" data-candidate-action="rejected">Reject</button>
    </span>
  </article>`;
}

function compactReviewEligible(candidate){
  if(!candidate||candidate.expanded||candidate.duplicate)return false;
  const fields=candidate.fields||{};
  // Inferred values deserve the full card with their evidence, not a one-line row.
  if((candidate.inferredFields||[]).length||(fields.inferredFields||[]).length)return false;
  if(fields.profileHeaderReviewRequired&&fields.acceptProfileClaims!==true)return false;
  if(fields.profileHeaderConflicts?.length||fields.rescueProfileClaims||fields.myerasReview||fields.rescueReviewRequired)return false;
  return candidateQuestions(candidate).length===0;
}

function sectionAcceptButton(members,label){
  const ids=members.filter((candidate)=>candidate.decision==="undecided"&&!candidate.reviewLater&&!candidate.duplicate).map(({id})=>id);
  if(!ids.length)return"";
  return`<button type="button" class="button secondary small" data-accept-section="${escapeHtml(ids.join(","))}">${escapeHtml(label.replace("{n}",String(ids.length)))}</button>`;
}

function candidateListMarkup(state){
  const visible=new Set(filteredCandidates(state).map(({id})=>id));
  const lanes=reviewLanes(state);
  const parser=state.extraction?.parser;
  const duplicateGroups=openSuggestions(state)
    .filter((suggestion)=>suggestion.type==="POSSIBLE_DUPLICATE"&&suggestion.candidateIds.length===2&&
      suggestion.candidateIds.every((id)=>{const candidate=(state.candidates||[]).find((item)=>item.id===id);return candidate&&candidate.decision==="undecided"&&visible.has(id);}))
    .map((suggestion)=>duplicateGroupMarkup(state,suggestion)).join("");
  const laneSection=(laneId,members,{title,hint,group,accept,compact=false})=>{
    if(!members.length)return"";
    return`<section class="candidate-lane" data-review-lane="${laneId}"${group?` data-review-group="${group}"`:""}>
      <div class="candidate-lane-head">
        <h2>${escapeHtml(title)} (${members.length})</h2>
        <p class="secondary-body">${escapeHtml(hint)}</p>
        ${accept?sectionAcceptButton(members,accept):""}
      </div>
      ${members.map((candidate)=>compact&&compactReviewEligible(candidate)
        ?compactCandidateMarkup(candidate,{parser})
        :candidateMarkup(candidate,{lane:laneId,suggestions:suggestionsForCandidate(state,candidate.id),parser})).join("")}
    </section>`;
  };
  const high=lanes.high.filter(({id})=>visible.has(id));
  const ready=high.filter((candidate)=>candidate.fields?.sourceRecordOnly!==true);
  const records=high.filter((candidate)=>candidate.fields?.sourceRecordOnly===true);
  const sections=[
    laneSection("high",ready,{title:REVIEW_LANES[0].title,hint:REVIEW_LANES[0].hint,group:"ready",accept:"Accept these {n}",compact:true}),
    ...REVIEW_LANES.slice(1).map((lane)=>{
      const members=lanes[lane.id].filter(({id})=>visible.has(id));
      const rescueReview=lane.id==='low'&&members.length>0&&members.every(candidate=>candidate.fields?.rescueReviewRequired);
      return laneSection(lane.id,members,{
        title:rescueReview?'Verify source details':lane.title,
        hint:rescueReview?'Check each entry against your Timeline. Answer only the details the source could not establish.':lane.hint,
        group:lane.id==="medium"?"attention":"questions",
        accept:lane.id==="medium"?"Accept the {n} that check out":null
      });
    }),
    laneSection("high",records,{title:"Also in your document",hint:"Honors, certifications and scholarly work are kept as records with your Timeline. They are not drawn as events.",group:"records",accept:"Keep all {n} records",compact:true})
  ].join("");
  const sectionsWithGroups=duplicateGroups+sections;
  void sectionsWithGroups;
  const decided=lanes.decided
    .filter(({id})=>visible.has(id))
    .map((candidate)=>candidateMarkup(candidate,{lane:"decided",suggestions:[],parser:state.extraction?.parser}))
    .join("");
  return duplicateGroups+sections+decided||'<p class="secondary-body">No suggestions in this filter.</p>';
}

/* AAA-019 — no theater. The review screen says what produced the suggestions. A live
   provider result names itself; anything else is called a local document check, with the
   reason the AI did not run, so a student never mistakes a regex pass for an AI review. */
const FALLBACK_REASON_COPY=Object.freeze({
  AI_EMPTY:"the AI returned no suggestions",
  PROVIDER_UNAVAILABLE:"the AI service could not be reached",
  LOCAL_DEMO_API_DISABLED:"this local build runs without the AI service",
  CONSENT_REQUIRED:"AI review needs your consent first",
  CV_AI_CONSENT_REQUIRED:"enable optional Timeline AI in AI settings first",
  TIMELINE_AI_CONSENT_REQUIRED:"enable optional Timeline AI in AI settings first",
  TIMELINE_AI_PROCESSING_DISABLED:"AI processing is not enabled for this account",
  AI_RECEIPT_UNVERIFIED:"the provider receipt could not be verified",
  PRIVATE_MEDIA_DISABLED:"secure document storage is not enabled for your account yet",
  NETWORK:"the AI service could not be reached"
});
export function reviewBasis(parser,candidates=[]){
  const mode=String(parser?.intelligenceMode||"").toUpperCase();
  if(mode==="SERVER_AI"&&verifiedProviderReceipt022(parser?.providerReceipt)){
    const mixed=candidates.some((candidate)=>candidateReviewBasis(candidate,parser).mode==="MISSIONMED_RULE");
    return{mode:"SERVER_AI",label:mixed?"AI review + source checks":"AI REVIEW",body:mixed?"AI suggestions are supplemented by source checks. Each entry shows its basis and stays a suggestion until you confirm it.":"Reviewed by MissionMed's AI. Every entry stays a suggestion until you confirm it."};
  }
  const reasonKey=String(parser?.fallbackReason||"").toUpperCase().replace(/[\s-]+/g,"_");
  const reason=FALLBACK_REASON_COPY[reasonKey]||(parser?"AI review is not available right now":"AI review is not available in this build");
  return{mode:"LOCAL_LIMITED",label:"DOCUMENT CHECK",body:`No AI review — ${reason}. These entries were read straight from your file by a local document check, so verify each date and name.`};
}

function providerReceiptMarkup(parser){
  if(String(parser?.intelligenceMode||"").toUpperCase()!=="SERVER_AI"||!verifiedProviderReceipt022(parser?.providerReceipt))return"";
  const receipt=parser?.providerReceipt;
  if(!receipt?.responseId)return'<details class="intake-provider-receipt"><summary>AI review details</summary><p>No provider response receipt is attached to this review.</p></details>';
  const rows=[
    ["Provider",receipt.provider||parser.provider],
    ["Model",receipt.model||parser.model],
    ["Response ID",receipt.responseId],
    ["Provider response storage",receipt.store===false?"Disabled (store: false)":"Not recorded"],
    ["Received",receipt.receivedAt],
    ["Result",parser.cached===true?"Previously completed response, reused":"Completed provider response"]
  ].filter(([,value])=>value!==undefined&&value!==null&&value!=="");
  return`<details class="intake-provider-receipt"><summary>AI review details</summary><dl>${rows.map(([label,value])=>`<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join("")}</dl></details>`;
}

function excludedCandidatesMarkup(state){
  if(!verifiedProviderReceipt022(state.extraction?.parser?.providerReceipt))return'';
  const count=Number(state.extraction?.parser?.rejectedCandidateCount);
  if(!Number.isFinite(count)||count<1)return"";
  const excluded=Math.floor(count);
  const sourceCount=(state.candidates||[]).filter((candidate)=>candidateReviewBasis(candidate,state.extraction?.parser).mode==="MISSIONMED_RULE").length;
  return`<aside class="intake-validation-notice" aria-label="Excluded AI interpretations">
    <strong>${excluded} AI interpretation${excluded===1?" was":"s were"} excluded by validation.</strong>
    <p>These interpretations could not be verified against the source and are not included in the suggestions you can accept.</p>
    <p>${sourceCount?`${sourceCount} additional source-check entr${sourceCount===1?"y is":"ies are"} included below. These come from local source rules, not the excluded AI interpretations. Review them against your document for the missing history.`:"No source-check recovery is included here. After review, add any missing verified history in Builder."}</p>
    ${sourceCount?'<button type="button" class="button tertiary small" data-intake-filter="all" data-intake-recovery-review>Show all suggestions</button>':""}
  </aside>`;
}

function reviewMarkup(state,{renderPreview=null,existingEvents=[]}={}){
  const total=state.candidates.length;
  const basis=reviewBasis(state.extraction?.parser,state.candidates);
  const accepted=acceptedCount(state);
  const added=state.candidates.filter(candidate=>positiveDecision(candidate.decision)&&candidate.decision!=="merge").length;
  const merged=new Set(state.candidates.filter(candidate=>candidate.decision==="merge").map(candidate=>candidate.duplicate?.eventId||candidate.id)).size;
  const profileCount=acceptedMyerasProfileClaims(state).length;
  const pendingMyeras=pendingMyerasReviewCount(state);
  const approveLabel=profileCount&&!added&&!merged?`Apply ${profileCount} reviewed profile facts →`:merged?added?`Add ${added} and update ${merged} events →`:`Update ${merged} existing events →`:`Add ${accepted} accepted events to my timeline →`;
  const high=highConfidenceCount(state);
  const summary=reviewSummary(state);
  const identityBlocked=identityDecisionRequired(state);
  const previewEvents=acceptedPreviewEvents(state,existingEvents);
  const preview=typeof renderPreview==="function"
    ?renderPreview(previewEvents,{label:"Accepted document suggestions preview",pending:true})
    :`<p class="secondary-body">${previewEvents.length?`${previewEvents.length} accepted suggestion${previewEvents.length===1?"":"s"} in preview.`:"Accepted suggestions appear here."}</p>`;
  return`<section class="intake-stage intake-review" aria-labelledby="intake-title">
    <div class="intake-review-heading">
      <h1 id="intake-title">${!total&&myerasProfileClaims(state).length?`Review ${myerasProfileClaims(state).length} profile facts`:`Review ${total} suggestions`}</h1>
      <p class="intake-review-summary" data-intake-review-summary data-ready="${summary.ready}" data-attention="${summary.attention}" data-records="${summary.records}">We found <strong>${summary.total}</strong> item${summary.total===1?"":"s"}. <strong>${summary.ready}</strong> look${summary.ready===1?"s":""} ready${summary.records?`, plus ${summary.records} record${summary.records===1?"":"s"} we keep but do not draw`:""}. <strong>${summary.attention}</strong> need${summary.attention===1?"s":""} your attention.${summary.duplicates?` ${summary.duplicates} possible duplicate${summary.duplicates===1?"":"s"} to settle.`:""}</p>
      <p>${INTAKE_COPY.reviewSubline}</p>
      <p class="intake-review-basis" data-intake-review-basis="${basis.mode}"><span class="status-chip">${escapeHtml(basis.label)}</span> ${escapeHtml(basis.body)}</p>
      ${providerReceiptMarkup(state.extraction?.parser)}
    </div>
    ${identityMarkup(state)}
    ${rescueReconstructionMarkup(state)}
    ${rescueComparisonMarkup(state)}
    ${excludedCandidatesMarkup(state)}
    ${suggestionsMarkup(state)}
    <div class="intake-review-toolbar">
      <button type="button" class="button secondary" data-intake-action="accept-high"${high?"":" disabled"}>${high?`Accept all ${high} high-confidence entries`:"No high-confidence entries to accept"}</button>
      ${summary.attention?`<button type="button" class="button tertiary" data-intake-jump="attention">Review the ${summary.attention} that need you</button>`:""}
      <div class="filter-chips" aria-label="Suggestion filters">${INTAKE_FILTERS.map((filter)=>`<button type="button" class="filter-chip${state.filter===filter?" selected":""}" data-intake-filter="${filter}"${state.filter===filter?' aria-pressed="true"':' aria-pressed="false"'}>${filter[0].toUpperCase()+filter.slice(1)}</button>`).join("")}</div>
      <span>${decidedCount(state)} of ${total} decided</span>
    </div>
    <div class="intake-review-grid">
      <div class="candidate-list">${candidateListMarkup(state)}</div>
      <details class="intake-live-preview" aria-label="Live board preview"><summary>Preview accepted suggestions (${accepted})</summary>${preview}</details>
    </div>
    <footer class="intake-review-footer">
      ${pendingMyeras?`<p role="status">Decide on all ${pendingMyeras} remaining MyERAS experience or profile facts. Accept or leave out each one before final approval.</p>`:''}
      ${identityBlocked?`<p role="status" data-intake-identity-gate>Choose whose Timeline this is (above) before adding anything.</p>`:''}
      <button type="button" class="button primary" data-intake-action="approve"${accepted&&!state.approval.inFlight&&!pendingMyeras&&!identityBlocked?"":" disabled"}>${identityBlocked?"Confirm whose document this is first":pendingMyeras?`Review ${pendingMyeras} remaining facts`:accepted?approveLabel:INTAKE_COPY.emptyAccepted}</button>
      <button type="button" class="button tertiary" data-intake-action="discard-all">Discard all</button>
    </footer>
  </section>`;
}

function doneMarkup(state){
  const filename=state.approval.fileName||state.file?.name||"document";
  const added=Number(state.approval.addedCount??state.approval.appliedCount)||0;
  const merged=Number(state.approval.mergedCount)||0;
  const profileCount=acceptedMyerasProfileClaims(state).length;
  const resultLabel=profileCount&&!added&&!merged?`Applied ${profileCount} profile facts`:merged?added?`Added ${added} and updated ${merged} events`:`Updated ${merged} events`:`Added ${added} events`;
  return`<section class="intake-stage intake-done" aria-labelledby="intake-title">
    <div class="card success-card">
      <span class="success-check" aria-hidden="true">✓</span>
      <h1 id="intake-title">${resultLabel} from ${escapeHtml(filename)}.</h1>
      <p>${INTAKE_COPY.doneBody}</p>
      <button type="button" class="button primary" data-intake-action="open-canvas">Edit my timeline →</button>
      <button type="button" class="button secondary" data-intake-action="quality-check">Run a quality check now →</button>
      <button type="button" class="button secondary" data-intake-action="open-builder">Review my timeline in the Builder</button>
      <div class="intake-done-secondary">
        <button type="button" class="button secondary" data-intake-action="try-another">Add another document</button>
        <button type="button" class="button tertiary" data-intake-action="delete-document"${state.sourceDeleted?" disabled":""}>${state.sourceDeleted?"Document deleted":"Delete the document"}</button>
      </div>
    </div>
  </section>`;
}

export function renderIntake(state,options={}){
  const content=state.stage===INTAKE_STAGES.UPLOAD
    ?uploadMarkup(state)
    :state.stage===INTAKE_STAGES.EXTRACTION
      ?extractionMarkup(state)
      :state.stage===INTAKE_STAGES.REVIEW
        ?reviewMarkup(state,options)
        :doneMarkup(state);
  return`<div class="screen intake-screen" data-screen="intake">
    <div class="intake-chrome">
      ${progressMarkup(state)}
      <button type="button" class="button tertiary intake-cancel" data-intake-action="cancel">${state.stage===INTAKE_STAGES.DONE?"✕ Close":"✕ Cancel upload"}</button>
    </div>
    ${content}
  </div>`;
}

function closest(target,selector){
  return target?.closest?.(selector)||null;
}

/* A click can move focus before a text input's change event reaches the state
   machine (notably under browser automation and fast pointer use). Snapshot the
   visible review card once immediately before its decision so the event added
   to the Timeline is always the text the student can see. */
function reviewedControlValue(control){
  const value=control.type==="checkbox"?control.checked:control.value;
  return control.dataset?.candidateYearOnly==="true"&&/^\d{4}$/.test(String(value).trim())
    ?`${String(value).trim()}-${control.dataset.candidatePlaceholderMonth||"01"}`:value;
}

function commitVisibleCandidateFields(machine,target,candidateId){
  const card=closest(target,"[data-candidate-card]");
  if(!card?.querySelectorAll||String(card.dataset?.candidateCard||"")!==String(candidateId||""))return;
  const patch={},fields={};
  const controls=card.querySelectorAll(
    "input[data-candidate-field],select[data-candidate-field],textarea[data-candidate-field],"+
    "input[data-candidate-extra],select[data-candidate-extra],textarea[data-candidate-extra]"
  );
  for(const control of controls){
    const value=reviewedControlValue(control);
    if(control.dataset.candidateField){
      const key=control.dataset.candidateField;
      if(!Object.hasOwn(patch,key)||String(value||"").trim())patch[key]=value;
    }else if(control.dataset.candidateExtra){
      const key=control.dataset.candidateExtra;
      if(!Object.hasOwn(fields,key)||value===true||String(value||"").trim())fields[key]=value;
    }
  }
  if(Object.keys(fields).length)patch.fields=fields;
  if(Object.keys(patch).length)machine.editCandidate(candidateId,patch);
}

export function installIntake(root,machine,{
  onChange=()=>{},
  onNavigate=()=>{},
  onToast=()=>{},
  onError=()=>{},
  openDialog=null,
  saveVersion=null,
  applyBatch=null,
  deleteSource=async()=>{},
  onCandidateDecision=null,
  setIntervalFn=setInterval,
  clearIntervalFn=clearInterval
}={}){
  let statusTimer=null;
  const installCandidateMonths=()=>{
    if(typeof root.querySelectorAll!=="function")return;
    installMonthFields(root,{onCommit:(_fieldId,value,input)=>{
      const wrapper=input.closest?.("[data-candidate-month]");
      const id=wrapper?.dataset?.candidateId;
      const field=wrapper?.dataset?.candidateField;
      if(id&&field)machine.editCandidate(id,{[field]:value});
    }});
  };
  const stopTicker=()=>{
    if(statusTimer!=null){
      clearIntervalFn(statusTimer);
      statusTimer=null;
    }
  };
  const unsubscribe=machine.subscribe((state)=>{
    if(state.stage===INTAKE_STAGES.EXTRACTION&&!state.failure&&statusTimer==null){
      statusTimer=setIntervalFn(()=>machine.rotateStatus(),EXTRACTION_MIN_STAGE_MS);
    }else if(state.stage!==INTAKE_STAGES.EXTRACTION||state.failure){
      stopTicker();
    }
    onChange(state);
    installCandidateMonths();
  });

  const handleClick=async(event)=>{
    if(handleGateClick(event))return;
    const filter=closest(event.target,"[data-intake-filter]");
    if(filter){
      machine.setFilter(filter.dataset.intakeFilter);
      return;
    }
    const suggestionAction=closest(event.target,"[data-suggestion-action]");
    if(suggestionAction){
      const {suggestionId}=suggestionAction.dataset;
      const action=suggestionAction.dataset.suggestionAction;
      if(action==="apply")machine.applySuggestion(suggestionId);
      else if(action==="dismiss")machine.dismissSuggestion(suggestionId);
      else if(action==="undo")machine.undoSuggestion(suggestionId);
      return;
    }
    const identityDecision=closest(event.target,"[data-identity-decision]");
    if(identityDecision){
      try{machine.decideIdentity(identityDecision.dataset.identityDecision);}catch(error){onError(error);}
      return;
    }
    const duplicateChoice=closest(event.target,"[data-duplicate-choice]");
    if(duplicateChoice){
      try{machine.resolveDuplicateGroup(duplicateChoice.dataset.suggestionId,duplicateChoice.dataset.duplicateChoice);}catch(error){onError(error);}
      return;
    }
    const sectionAccept=closest(event.target,"[data-accept-section]");
    if(sectionAccept){
      try{machine.acceptSection(String(sectionAccept.dataset.acceptSection||"").split(",").filter(Boolean));}catch(error){onError(error);}
      return;
    }
    const jump=closest(event.target,"[data-intake-jump]");
    if(jump){
      const target=root.querySelector?.('[data-review-group="attention"],[data-review-group="questions"]');
      target?.scrollIntoView?.({behavior:"smooth",block:"start"});
      return;
    }
    const candidateAction=closest(event.target,"[data-candidate-action]");
    if(candidateAction){
      const {candidateId}=candidateAction.dataset;
      const action=candidateAction.dataset.candidateAction;
      try{
        if(action==="edit")machine.toggleEdit(candidateId);
        else{
          commitVisibleCandidateFields(machine,candidateAction,candidateId);
          machine.decideCandidate(candidateId,action);
          if(action==="rejected"&&typeof onCandidateDecision==="function"){
            const state=machine.snapshot();
            const candidate=state.candidates.find(({id})=>String(id)===String(candidateId));
            await onCandidateDecision({candidate,decision:action,state});
          }
        }
      }catch(error){onError(error);}
      return;
    }
    const target=closest(event.target,"[data-intake-action]");
    if(!target)return;
    const action=target.dataset.intakeAction;
    try{
      if(action==="change-type")machine.cycleDocumentType();
      else if(action==="read")await machine.startExtraction();
      else if(action==="accept-high")machine.acceptAllHighConfidence();
      else if(action==="approve")await machine.approveAccepted({saveVersion,applyBatch});
      else if(action==="try-another")machine.resetUpload();
      else if(action==="guided-builder"||action==="open-builder")onNavigate("builder");
      else if(action==="open-canvas")onNavigate("canvas");
      else if(action==="quality-check")onNavigate("quality-check");
      else if(action==="discard-all"){
        machine.discardAll();
        onNavigate("home");
      }else if(action==="delete-document"){
        const result=await machine.deleteDocument(deleteSource);
        if(result.deleted)onToast("Document deleted");
      }else if(action==="cancel"){
        const request=machine.requestCancel();
        if(!request.requiresConfirmation){
          onNavigate("home");
        }else if(typeof openDialog==="function"){
          openDialog({
            title:request.dialog.title,
            body:request.dialog.body,
            primaryLabel:"Discard",
            primaryTone:"danger",
            secondaryLabel:"Keep reviewing",
            secondaryTone:"primary",
            opener:target,
            onPrimary:()=>{
              machine.confirmDiscard();
              onNavigate("home");
            },
            onSecondary:()=>{}
          });
        }
      }
    }catch(error){
      onError(error);
    }
  };

  const handleGateClick=(event)=>{
    const gate=closest(event.target,"[data-intake-read-gate][data-gate-reason]");
    if(!gate)return false;
    onToast(String(gate.dataset.gateReason||"Check the consent box first."));
    const hint=root.querySelector?.("[data-intake-gate-hint]");
    if(hint){hint.classList.remove("is-nudged");void hint.offsetWidth;hint.classList.add("is-nudged");}
    (root.querySelector?.("[data-intake-consent]")||root.querySelector?.("[data-intake-file]"))?.focus?.();
    return true;
  };
  const handleChange=(event)=>{
    if(event.target?.matches?.("[data-intake-file]")){
      const file=event.target.files?.[0];
      if(file)machine.receiveFile(file);
      return;
    }
    if(event.target?.matches?.("[data-intake-consent]")){
      machine.setConsent(event.target.checked);
      return;
    }
    const field=event.target?.dataset?.candidateField;
    const extra=event.target?.dataset?.candidateExtra;
    const id=event.target?.dataset?.candidateId;
    if(field&&id)machine.editCandidate(id,{[field]:reviewedControlValue(event.target)});
    else if(extra&&id)machine.editCandidate(id,{fields:{[extra]:event.target.type==="checkbox"?event.target.checked:event.target.value}});
  };

  const handleDragOver=(event)=>{
    if(closest(event.target,"[data-intake-dropzone]"))event.preventDefault();
  };
  const handleDrop=(event)=>{
    if(!closest(event.target,"[data-intake-dropzone]"))return;
    event.preventDefault();
    const file=event.dataTransfer?.files?.[0];
    if(file)machine.receiveFile(file);
  };

  root.addEventListener("click",handleClick);
  root.addEventListener("change",handleChange);
  root.addEventListener("dragover",handleDragOver);
  root.addEventListener("drop",handleDrop);
  return()=>{
    stopTicker();
    unsubscribe();
    root.removeEventListener("click",handleClick);
    root.removeEventListener("change",handleChange);
    root.removeEventListener("dragover",handleDragOver);
    root.removeEventListener("drop",handleDrop);
  };
}
import {verifiedProviderReceipt022} from '../production/provider-receipt-022.js';
