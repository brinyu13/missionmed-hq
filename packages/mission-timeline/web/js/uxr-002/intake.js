import {CATEGORIES,VISIBILITY} from "./constants.js";
import {installMonthFields,monthFieldMarkup} from "./month-field.js";
import {dateLabel,escapeHtml,monthIndex,monthString} from "./utils.js";

export const INTAKE_STAGES=Object.freeze({
  UPLOAD:"upload",
  EXTRACTION:"extraction",
  REVIEW:"review",
  DONE:"done"
});

export const INTAKE_PROGRESS=Object.freeze(["Upload","Read","Review","Done"]);
export const EXTRACTION_STATUSES=Object.freeze([
  "Finding dates…",
  "Matching institutions…",
  "Sorting your story…"
]);
export const DOCUMENT_TYPES=Object.freeze(["CV","MyERAS export","Résumé"]);
export const INTAKE_FILTERS=Object.freeze(["all","accepted","rejected","undecided"]);
export const MAX_DOCUMENT_BYTES=20*1024*1024;

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
  fileError:"PDF or DOCX, up to 20MB.",
  rescueFileError:"PPTX, PDF, PNG, or JPEG, up to 20MB.",
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

export function openSuggestions(state){
  return(state?.suggestions||[]).filter((suggestion)=>suggestion.status==="open");
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
  const level=candidate?.confidence==="high"?"high":candidate?.confidence==="medium"?"medium":"low";
  if(level==="high"&&(candidate?.duplicate||flagged.has(candidate?.id)))return"medium";
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
  if(fields.mappingReviewRequired===true||String(fields.canonicalType||"").toUpperCase()==="UNCLASSIFIED"){
    questions.push({key:"categoryId",kind:"category",field:"categoryId",label:"Which part of your story is this?"});
  }
  const institution=INSTITUTION_FIELD_BY_CATEGORY[candidate?.categoryId];
  if(institution&&!String(fields[institution]||"").trim()){
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
    categoryId:categoryResolved?sourceCategory:categoryNeedsReview?"":"personal",
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
    const next={...candidate,duplicate:findDuplicate(candidate,existingEvents)};
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
  const validSize=Number.isFinite(size)&&size>=0&&size<=MAX_DOCUMENT_BYTES;
  if(!validType||!validSize)return{valid:false,error:INTAKE_COPY.fileError};
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
    sourceDeleted:false
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
    candidates:(source.candidates||[]).map((candidate,index)=>normalizeCandidate(candidate,index,existingEvents)),
    suggestions:normalizeSuggestions(source.suggestions||[]),
    filter:INTAKE_FILTERS.includes(source.filter)?source.filter:"all",
    approval:{...base.approval,...(source.approval||{})}
  };
  if(stage===INTAKE_STAGES.DONE){
    hydrated.approval.applied=true;
    hydrated.approval.appliedCount=Number(hydrated.approval.appliedCount||source.lastImport?.acceptedCount)||0;
    hydrated.approval.fileName=hydrated.approval.fileName||source.lastImport?.fileName||source.file?.name||"document";
  }
  return hydrated;
}

function positiveDecision(decision){
  return["accepted","merge","add-anyway"].includes(decision);
}

export function acceptedCount(state){
  return(state?.candidates||[]).filter((candidate)=>positiveDecision(candidate.decision)).length;
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

export function transitionIntake(current,action,{existingEvents=[]}={}){
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
        state.extraction.statusIndex=(state.extraction.statusIndex+1)%EXTRACTION_STATUSES.length;
      }
      return state;
    case"EXTRACTION_SUCCEEDED":
      state.candidates=(action.candidates||[]).map((candidate,index)=>normalizeCandidate(candidate,index,existingEvents));
      if(!state.candidates.length)throw new Error("EXTRACTION_SUCCEEDED requires at least one candidate.");
      state.stage=INTAKE_STAGES.REVIEW;
      state.progressIndex=2;
      state.filter="all";
      state.failure=null;
      state.extraction.completed=true;
      state.extraction.sourceDocument=action.sourceDocument?clone(action.sourceDocument):null;
      state.extraction.parser=action.parser?clone(action.parser):null;
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
      if(Object.hasOwn(patch,"visibilityState")){
        candidate.visibilityState=patch.visibilityState===VISIBILITY.ADVISOR_ONLY
          ?VISIBILITY.ADVISOR_ONLY
          :VISIBILITY.INTERVIEWER_SAFE;
      }
      if(candidate.categoryId==="education")candidate.eventType="milestone";
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
      if(["accepted","merge","add-anyway"].includes(decision)&&!CATEGORIES.some(({id})=>id===candidate.categoryId)){
        throw new Error("Choose a category before accepting this suggestion.");
      }
      if(decision==="accepted"&&candidate.duplicate)throw new Error("Resolve the duplicate with Merge or Add anyway.");
      if(decision==="merge"&&!candidate.duplicate)throw new Error("Merge is available only for duplicate candidates.");
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
  return{
    id,
    title:candidate.title,
    categoryId:candidate.categoryId,
    eventType:candidate.eventType,
    startDate:candidate.startDate,
    endDate:candidate.endDate,
    openEnded:candidate.openEnded,
    visibilityState:candidate.visibilityState||VISIBILITY.INTERVIEWER_SAFE,
    siteName:String(
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
    fields:clone(candidate.fields)
  };
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
  if(!degree)return null;
  const graduationDate=graduation?.startDate||degree.endDate||(
    String(degree.fields?.canonicalType||"").toUpperCase()==="GRADUATION"
      ?degree.startDate
      :null
  );
  return{
    sourceCandidateId:String(degree.id),
    medicalSchool:String(
      degree.fields?.medicalSchool||
      degree.siteName||
      explicitMedicalSchoolFromDegreeTitle(degree)||
      ""
    ).trim(),
    medicalSchoolCountry:String(degree.fields?.medicalSchoolCountry||degree.fields?.sourceCountry||"").trim(),
    graduationDate:graduationDate?String(graduationDate).slice(0,7):"",
    degree:String(degree.fields?.degree||"").trim(),
    verificationStatus:"unverified-source-claimed",
    provenance:approvalProvenance(degree)
  };
}

function cvExamReviewQueue(candidates=[]){
  return candidates.filter((candidate)=>candidate.categoryId==="exams").map((candidate)=>({
    sourceCandidateId:String(candidate.id),
    canonicalType:String(candidate.fields?.canonicalType||""),
    examName:String(candidate.fields?.examName||candidate.title||""),
    examDate:candidate.startDate?String(candidate.startDate).slice(0,7):"",
    result:String(candidate.fields?.result||""),
    score:String(candidate.fields?.score||""),
    status:"needs-student-confirmation",
    provenance:approvalProvenance(candidate)
  }));
}

function mergePatch(existing,candidate,fileName){
  const existingRange=monthRange(existing),candidateRange=monthRange(candidate);
  const start=existingRange&&candidateRange?Math.min(existingRange.start,candidateRange.start):(existingRange?.start??candidateRange?.start);
  const end=existingRange&&candidateRange?Math.max(existingRange.end,candidateRange.end):(existingRange?.end??candidateRange?.end);
  const snippet=candidate.sourceSnippet;
  const currentNotes=String(existing.notes||"").trim();
  const notes=snippet&&!currentNotes.includes(snippet)?[currentNotes,snippet].filter(Boolean).join("\n"):currentNotes;
  const provenance=[
    ...(existing.provenance||[]),
    ...approvalProvenance(candidate,fileName)
  ];
  return{
    startDate:Number.isFinite(start)?monthString(start):existing.startDate,
    endDate:existing.openEnded||candidate.openEnded?null:(Number.isFinite(end)?monthString(end):existing.endDate),
    openEnded:!!existing.openEnded||!!candidate.openEnded,
    notes,
    provenance
  };
}

export function validateCandidateForApproval(candidate){
  const errors={};
  if(!String(candidate?.title||"").trim())errors.title="Required.";
  if(!CATEGORIES.some(({id})=>id===candidate?.categoryId))errors.categoryId="Choose a category.";
  const start=monthIndex(candidate?.startDate);
  const end=candidate?.endDate?monthIndex(candidate.endDate):null;
  if(!Number.isFinite(start))errors.startDate="Enter a month and year, like 'Jun 2023'.";
  if(candidate?.endDate&&!Number.isFinite(end))errors.endDate="Enter a month and year, like 'Jun 2023'.";
  else if(Number.isFinite(start)&&Number.isFinite(end)&&end<start)errors.endDate="End must be on or after start.";
  return errors;
}

export function buildApprovalBatch(state,existingEvents,{idFactory=(prefix)=>`${prefix}-${crypto.randomUUID()}`,clock=()=>new Date()}={}){
  if(state.stage!==INTAKE_STAGES.REVIEW)throw new Error("Approval is available only during Review.");
  const positive=state.candidates.filter((candidate)=>positiveDecision(candidate.decision));
  if(!positive.length)throw new Error(INTAKE_COPY.emptyAccepted);
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
  const versionName=`Before CV import · ${dateLabel(clock())}`;
  return{
    schemaVersion:"d1-uxr-002-intake-batch.2",
    label:"Add document suggestions",
    history:{required:true,undoSteps:1},
    version:{name:versionName,kind:"automatic",requiredBeforeMutation:true},
    sourceDocument:state.file?clone(state.file):null,
    documentType:state.detectedType,
    additions,
    merges,
    profilePrefill:cvProfilePrefill(positive),
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
    acceptedCount:positive.length,
    addedCount:additions.length,
    mergedCount:merges.length,
    createdAt:clock().toISOString()
  };
}

export function applyApprovalBatchToDocument(document,batch){
  if(!document||typeof document!=="object")throw new Error("A timeline document is required.");
  if(batch?.history?.undoSteps!==1||batch?.version?.requiredBeforeMutation!==true)throw new Error("Invalid intake batch contract.");
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
    for(const field of["medicalSchool","medicalSchoolCountry","graduationDate","degree"]){
      if(!String(current[field]||"").trim()&&String(prefill[field]||"").trim())patch[field]=prefill[field];
    }
    if(patch.medicalSchool){
      patch.medicalSchoolEntryMode="unlisted";
      patch.medicalSchoolVerificationStatus=prefill.verificationStatus;
      patch.medicalSchoolNormalizationStatus="review-required";
      patch.medicalSchoolAnalyticsEligible=false;
    }
    document.studentProfile={...current,...patch};
  }
  document.builder=document.builder&&typeof document.builder==="object"?document.builder:{};
  const priorExamQueue=Array.isArray(document.builder.aiExamReviewQueue)
    ?document.builder.aiExamReviewQueue:[];
  const examBySource=new Map(priorExamQueue.map((item)=>[String(item.sourceCandidateId),clone(item)]));
  for(const item of batch.examReviewQueue||[])examBySource.set(String(item.sourceCandidateId),clone(item));
  document.builder.aiExamReviewQueue=[...examBySource.values()];
  document.builder.lastAiPrefill={
    at:batch.createdAt,
    sourceFileName:String(batch.sourceDocument?.name||""),
    acceptedCount:Number(batch.acceptedCount)||0,
    eventCount:Number(batch.addedCount)||0,
    profilePrefilled:!!batch.profilePrefill,
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
      at:batch.createdAt,
      fileName:batch.sourceDocument?.name||"",
      acceptedCount:batch.acceptedCount,
      addedCount:batch.addedCount,
      mergedCount:batch.mergedCount,
      acceptedCandidates:(batch.acceptedCandidates||[]).map((candidate)=>clone(candidate))
    }
  };
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
  constructor({adapter=null,initialState=null,existingEvents=[],clock=()=>new Date(),idFactory=null}={}){
    this.adapter=adapter;
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
    this.state=transitionIntake(this.state,action,{existingEvents:this.existingEvents});
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
    try{
      const response=await this.adapter.extract({
        file:this.sourceFile,
        metadata:clone(this.state.file),
        documentType:this.state.detectedType,
        signal:this.abortController.signal
      });
      if(run!==this.runSequence||this.abortController.signal.aborted)return this.snapshot();
      const outcome=String(response?.outcome||response?.status||"").toLowerCase();
      if(response?.readable===false||["unreadable","scanned-no-text","scanned_no_text"].includes(outcome)){
        return this.dispatch({type:"EXTRACTION_UNREADABLE"});
      }
      const candidates=Array.isArray(response)?response:(response?.candidates||[]);
      if(!candidates.length)return this.dispatch({type:"EXTRACTION_EMPTY"});
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
      this.dispatch({type:"APPROVAL_SUCCEEDED",appliedCount,fileName:batch.sourceDocument?.name});
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
      <span>PDF or DOCX · up to 20MB</span>
    </label>
    ${state.file?`<div class="intake-file-row"><span>${escapeHtml(state.file.name)}</span><span class="status-chip">Looks like: ${escapeHtml(state.detectedType)}</span><button type="button" class="button tertiary" data-intake-action="change-type">Change</button></div>`:""}
    ${state.fileError?`<p class="field-error" role="alert">${escapeHtml(state.fileError)}</p>`:""}
    <p class="secondary-body">${INTAKE_COPY.privacy}</p>
    <label class="intake-consent"><input type="checkbox" data-intake-consent${state.consent?" checked":""}> <span>${INTAKE_COPY.consent}</span></label>
    <button type="button" class="button primary" data-intake-action="read"${ready?"":" disabled"}>${INTAKE_COPY.read}</button>
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
  return`<section class="intake-stage intake-extraction" aria-labelledby="intake-title">
    <h1 id="intake-title">Reading ${escapeHtml(state.file?.name||"document")}…</h1>
    <div class="indeterminate-progress" role="progressbar" aria-label="Reading document"></div>
    <p class="extraction-status" aria-live="polite">${EXTRACTION_STATUSES[state.extraction.statusIndex]}</p>
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
  "datePrecision",
  "mappingRationale",
  "mappingReviewRequired",
  "extractionWarnings",
  "inferredFields",
  "duplicateGroupIds",
  "conflictIds",
  "privacy",
  "aiOriginalSemantic"
]);

function reviewField(candidate,field){
  const value=candidate.fields?.[field.key]??"";
  const attributes=`data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-extra="${escapeHtml(field.key)}"`;
  if(field.type==="select"){
    return`<label>${escapeHtml(field.label)} <select ${attributes}>${field.options.map((option)=>`<option value="${escapeHtml(option)}"${String(value)===option?" selected":""}>${escapeHtml(option)}</option>`).join("")}</select></label>`;
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

function candidateMonthField(candidate,field,label,value){
  const id=`intake-${encodeURIComponent(candidate.id)}-${field}`;
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
    :"Extracted dates are explicit in the source";
  return`<div class="candidate-evidence" aria-label="Extraction evidence">
    ${source?`<p class="secondary-body"><strong>${escapeHtml(source.fileName)}</strong> · ${escapeHtml(source.locator)}</p>`:""}
    <p class="secondary-body">Extracted dates: ${escapeHtml(candidate.startDate||"Needs review")}${candidate.openEnded?" – ongoing":candidate.endDate?` – ${escapeHtml(candidate.endDate)}`:""} · ${escapeHtml(dateStatus)}</p>
    ${relation.map((item)=>`<p class="duplicate-banner">${escapeHtml(item)}</p>`).join("")}
    ${confidenceReasons.length||warnings.length?`<details class="source-snippet confidence-review"><summary>Why ${escapeHtml(candidate.confidence)} confidence?</summary>
      ${confidenceReasons.length?`<p>${escapeHtml(confidenceReasons.join(" · "))}</p>`:""}
      ${warnings.length?`<p>Review notes: ${escapeHtml(warnings.join(" · "))}</p>`:""}
    </details>`:""}
  </div>`;
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

function suggestionsMarkup(state){
  const suggestions=state.suggestions||[];
  if(!suggestions.length){
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
  if(!questions.length)return`<p class="secondary-body candidate-questions-clear">${INTAKE_COPY.questionsClear}</p>`;
  return`<div class="candidate-questions" data-candidate-questions="${escapeHtml(candidate.id)}">
    <p class="secondary-body">We need ${questions.length} answer${questions.length===1?"":"s"} from you. Everything else came from your document.</p>
    ${questions.map((question)=>questionMarkup(candidate,question)).join("")}
  </div>`;
}

function candidateMarkup(candidate,{lane="medium",suggestions=[]}={}){
  const positive=positiveDecision(candidate.decision);
  if(positive){
    return`<article class="candidate-row accepted" data-candidate-card="${escapeHtml(candidate.id)}">
      <span class="status-badge success">${candidate.decision==="merge"?"Merge":candidate.decision==="add-anyway"?"Add anyway":"Accepted"}</span>
      <strong>${escapeHtml(candidate.title)}</strong>
      <button type="button" class="button tertiary small" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-action="undecided">Undo</button>
    </article>`;
  }
  if(candidate.decision==="rejected"){
    return`<article class="candidate-row rejected" data-candidate-card="${escapeHtml(candidate.id)}">
      <span>Rejected</span><strong>${escapeHtml(candidate.title)}</strong>
      <button type="button" class="button tertiary small" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-action="undecided">Restore</button>
    </article>`;
  }
  if(candidate.reviewLater){
    return`<article class="candidate-row" data-candidate-card="${escapeHtml(candidate.id)}">
      <span class="status-badge">Review later</span><strong>${escapeHtml(candidate.title)}</strong>
      <button type="button" class="button tertiary small" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-action="undecided">Review now</button>
    </article>`;
  }
  const confidenceLabel=candidate.confidence[0].toUpperCase()+candidate.confidence.slice(1);
  const confidenceClass=candidate.confidence==="high"?"success":candidate.confidence==="medium"?"gold":"tertiary";
  const visibility=`<label class="candidate-visibility">Timeline visibility
    <select data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-field="visibilityState">
      <option value="${VISIBILITY.INTERVIEWER_SAFE}"${candidate.visibilityState===VISIBILITY.INTERVIEWER_SAFE?" selected":""}>Show in interview Timeline</option>
      <option value="${VISIBILITY.ADVISOR_ONLY}"${candidate.visibilityState===VISIBILITY.ADVISOR_ONLY?" selected":""}>Advisor only</option>
    </select>
  </label>`;
  const fields=lane==="low"
    ?`<div class="candidate-fields needs-help">
      <strong>${escapeHtml(candidate.title||"Untitled entry")}</strong>
      <span class="status-badge">NEEDS YOUR HELP</span>
      <span class="confidence-tag ${confidenceClass}">${confidenceLabel}</span>
    </div>
    ${candidateQuestionsMarkup(candidate)}${visibility}`
    :`<div class="candidate-fields">
      <label>Category <select data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-field="categoryId">${categoryOptions(candidate.categoryId)}</select></label>
      <label>Proposed title <input type="text" value="${escapeHtml(candidate.title)}" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-field="title"></label>
      ${candidateMonthField(candidate,"startDate","Start",candidate.startDate)}
      ${candidateMonthField(candidate,"endDate","End",candidate.endDate)}
      <span class="confidence-tag ${confidenceClass}">${confidenceLabel}</span>
      ${visibility}
    </div>`;
  return`<article class="candidate-card" data-candidate-card="${escapeHtml(candidate.id)}" data-review-lane="${escapeHtml(lane)}">
    ${candidate.duplicate?`<div class="duplicate-banner">Looks like a duplicate of '${escapeHtml(candidate.duplicate.eventTitle)}'</div>`:""}
    ${candidateSuggestionsMarkup(suggestions)}
    ${fields}
    <details class="source-snippet" title="${escapeHtml(candidate.sourceSnippet)}">
      <summary>“${escapeHtml(candidate.sourceSnippet)}”</summary>
    </details>
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

function candidateListMarkup(state){
  const visible=new Set(filteredCandidates(state).map(({id})=>id));
  const lanes=reviewLanes(state);
  const sections=REVIEW_LANES.map((lane)=>{
    const members=lanes[lane.id].filter(({id})=>visible.has(id));
    if(!members.length)return"";
    return`<section class="candidate-lane" data-review-lane="${lane.id}">
      <div class="candidate-lane-head">
        <h2>${escapeHtml(lane.title)} (${members.length})</h2>
        <p class="secondary-body">${escapeHtml(lane.hint)}</p>
      </div>
      ${members.map((candidate)=>candidateMarkup(candidate,{lane:lane.id,suggestions:suggestionsForCandidate(state,candidate.id)})).join("")}
    </section>`;
  }).join("");
  const decided=lanes.decided
    .filter(({id})=>visible.has(id))
    .map((candidate)=>candidateMarkup(candidate,{lane:"decided",suggestions:[]}))
    .join("");
  return sections+decided||'<p class="secondary-body">No suggestions in this filter.</p>';
}

function reviewMarkup(state,{renderPreview=null,existingEvents=[]}={}){
  const total=state.candidates.length;
  const accepted=acceptedCount(state);
  const high=highConfidenceCount(state);
  const previewEvents=acceptedPreviewEvents(state,existingEvents);
  const preview=typeof renderPreview==="function"
    ?renderPreview(previewEvents,{label:"Accepted document suggestions preview",pending:true})
    :`<p class="secondary-body">${previewEvents.length?`${previewEvents.length} accepted suggestion${previewEvents.length===1?"":"s"} in preview.`:"Accepted suggestions appear here."}</p>`;
  return`<section class="intake-stage intake-review" aria-labelledby="intake-title">
    <div class="intake-review-heading">
      <h1 id="intake-title">Review ${total} suggestions</h1>
      <p>${INTAKE_COPY.reviewSubline}</p>
    </div>
    ${suggestionsMarkup(state)}
    <div class="intake-review-toolbar">
      <button type="button" class="button secondary" data-intake-action="accept-high"${high?"":" disabled"}>${high?`Accept all ${high} high-confidence entries`:"No high-confidence entries to accept"}</button>
      <div class="filter-chips" aria-label="Suggestion filters">${INTAKE_FILTERS.map((filter)=>`<button type="button" class="filter-chip${state.filter===filter?" selected":""}" data-intake-filter="${filter}"${state.filter===filter?' aria-pressed="true"':' aria-pressed="false"'}>${filter[0].toUpperCase()+filter.slice(1)}</button>`).join("")}</div>
      <span>${decidedCount(state)} of ${total} decided</span>
    </div>
    <div class="intake-review-grid">
      <div class="candidate-list">${candidateListMarkup(state)}</div>
      <aside class="intake-live-preview" aria-label="Live board preview">${preview}</aside>
    </div>
    <footer class="intake-review-footer">
      <button type="button" class="button primary" data-intake-action="approve"${accepted&&!state.approval.inFlight?"":" disabled"}>${accepted?`Add ${accepted} accepted events to my timeline →`:INTAKE_COPY.emptyAccepted}</button>
      <button type="button" class="button tertiary" data-intake-action="discard-all">Discard all</button>
    </footer>
  </section>`;
}

function doneMarkup(state){
  const filename=state.approval.fileName||state.file?.name||"document";
  return`<section class="intake-stage intake-done" aria-labelledby="intake-title">
    <div class="card success-card">
      <span class="success-check" aria-hidden="true">✓</span>
      <h1 id="intake-title">Added ${state.approval.appliedCount} events from ${escapeHtml(filename)}.</h1>
      <p>${INTAKE_COPY.doneBody}</p>
      <button type="button" class="button primary" data-intake-action="open-canvas">Edit my timeline →</button>
      <button type="button" class="button secondary" data-intake-action="open-builder">Review my timeline in the Builder</button>
      <button type="button" class="button tertiary" data-intake-action="delete-document"${state.sourceDeleted?" disabled":""}>Delete the document</button>
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
      <button type="button" class="button tertiary intake-cancel" data-intake-action="cancel">✕ Cancel upload</button>
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
function commitVisibleCandidateFields(machine,target,candidateId){
  const card=closest(target,"[data-candidate-card]");
  if(!card?.querySelectorAll||String(card.dataset?.candidateCard||"")!==String(candidateId||""))return;
  const patch={},fields={};
  const controls=card.querySelectorAll(
    "input[data-candidate-field],select[data-candidate-field],textarea[data-candidate-field],"+
    "input[data-candidate-extra],select[data-candidate-extra],textarea[data-candidate-extra]"
  );
  for(const control of controls){
    const value=control.type==="checkbox"?control.checked:control.value;
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
      statusTimer=setIntervalFn(()=>machine.rotateStatus(),2000);
    }else if(state.stage!==INTAKE_STAGES.EXTRACTION||state.failure){
      stopTicker();
    }
    onChange(state);
    installCandidateMonths();
  });

  const handleClick=async(event)=>{
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
    const candidateAction=closest(event.target,"[data-candidate-action]");
    if(candidateAction){
      const {candidateId}=candidateAction.dataset;
      const action=candidateAction.dataset.candidateAction;
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
    if(field&&id)machine.editCandidate(id,{[field]:event.target.value});
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
