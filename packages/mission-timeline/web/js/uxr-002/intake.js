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
  privacy:"Your document is processed for extraction and can be deleted afterward. Nothing appears on your timeline until you approve it.",
  consent:"I understand I'll review every suggestion before it lands on my timeline.",
  read:"Read my document →",
  reviewSubline:"Accept what's right, fix what's close, reject what's wrong. Nothing lands until you decide.",
  emptyAccepted:"Nothing accepted yet",
  unreadable:"We couldn't read text in this document. If it's a scan, export a text PDF from MyERAS or your CV app and try again.",
  empty:"We read it, but didn't find dated events we're confident about. The guided builder takes about 10 minutes.",
  doneBody:"Your document has been processed. You can delete it now or keep it for another pass.",
  fileError:"PDF or DOCX, up to 20MB."
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
    {key:"icon",label:"Icon",type:"select",options:["heart","home","plane","baby","ring","star","flag","globe","shield","sun","book","sparkle"]},
    {key:"visibility",label:"Visibility",type:"select",options:["Show everyone","Advisor only"]}
  ])
});

function clone(value){
  return structuredClone(value);
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

function normalizeCandidate(value,index,existingEvents){
  const candidate={
    id:String(value?.id||`candidate-${index+1}`),
    categoryId:CATEGORIES.some(({id})=>id===value?.categoryId)?value.categoryId:"personal",
    title:String(value?.title||"").trim(),
    startDate:String(value?.startDate||value?.date||""),
    endDate:value?.endDate?String(value.endDate):null,
    openEnded:!!value?.openEnded,
    eventType:value?.eventType==="milestone"?"milestone":"duration",
    confidence:confidenceLevel(value),
    sourceSnippet:String(value?.sourceSnippet??value?.sourceExcerpt??value?.provenance?.[0]?.sourceExcerpt??"").trim(),
    notes:String(value?.notes||""),
    visibilityState:value?.visibilityState||value?.visibilityRecommendation||VISIBILITY.INTERVIEWER_SAFE,
    fields:value?.fields&&typeof value.fields==="object"?clone(value.fields):{},
    decision:normalizedDecision(value?.decision),
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
  const unknownMime=!type||type==="application/octet-stream";
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

export function createIntakeState({file=null,candidates=[],existingEvents=[]}={}){
  const validated=file?validateIntakeFile(file):null;
  const acceptedFile=validated?.valid?validated.metadata:null;
  return{
    stage:INTAKE_STAGES.UPLOAD,
    progressIndex:0,
    file:acceptedFile,
    detectedType:acceptedFile?detectDocumentType(acceptedFile):"CV",
    consent:false,
    fileError:file&&!validated?.valid?INTAKE_COPY.fileError:null,
    extraction:{statusIndex:0,completed:false,errorCode:null},
    candidates:(candidates||[]).map((candidate,index)=>normalizeCandidate(candidate,index,existingEvents)),
    filter:"all",
    failure:null,
    approval:{inFlight:false,applied:false,versionSaved:false,versionName:null,fileName:null,errorCode:null,appliedCount:0},
    sourceDeleted:false
  };
}

export function hydrateIntakeState(value,{existingEvents=[]}={}){
  const source=value&&typeof value==="object"?clone(value):{};
  const base=createIntakeState({file:source.file,candidates:source.candidates||[],existingEvents});
  const stage=Object.values(INTAKE_STAGES).includes(source.stage)?source.stage:INTAKE_STAGES.UPLOAD;
  const progressIndex={upload:0,extraction:1,review:2,done:3}[stage];
  const hydrated={
    ...base,
    ...source,
    stage,
    progressIndex:Number.isInteger(source.progressIndex)?source.progressIndex:progressIndex,
    extraction:{...base.extraction,...(source.extraction||{})},
    candidates:(source.candidates||[]).map((candidate,index)=>normalizeCandidate(candidate,index,existingEvents)),
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

export function highConfidenceCount(state){
  return(state?.candidates||[]).filter((candidate)=>
    candidate.decision==="undecided"&&candidate.confidence==="high"&&!candidate.duplicate
  ).length;
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
      state.consent=false;
      state.extraction={statusIndex:0,completed:false,errorCode:null};
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
      state.extraction={statusIndex:0,completed:false,errorCode:null};
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
      state.extraction={statusIndex:0,completed:false,errorCode:action.errorCode||null};
      return state;
    case"SET_FILTER":
      if(INTAKE_FILTERS.includes(action.filter))state.filter=action.filter;
      return state;
    case"EDIT_CANDIDATE":{
      const index=state.candidates.findIndex(({id})=>id===action.id);
      if(index<0)return state;
      const patch=action.patch&&typeof action.patch==="object"?clone(action.patch):{};
      const candidate={...state.candidates[index]};
      for(const field of["title","categoryId","startDate","endDate","notes","eventType","openEnded","visibilityState"]){
        if(Object.hasOwn(patch,field))candidate[field]=patch[field];
      }
      if(patch.fields&&typeof patch.fields==="object")candidate.fields={...candidate.fields,...patch.fields};
      if(!CATEGORIES.some(({id})=>id===candidate.categoryId))candidate.categoryId="personal";
      if(candidate.categoryId==="education")candidate.eventType="milestone";
      if(candidate.categoryId==="personal"){
        candidate.visibilityState=candidate.fields.visibility==="Advisor only"?VISIBILITY.ADVISOR_ONLY:VISIBILITY.INTERVIEWER_SAFE;
        if(candidate.fields.when){
          candidate.eventType=candidate.fields.when==="A period"?"duration":"milestone";
          if(candidate.eventType==="milestone")candidate.endDate=null;
        }
      }
      if(candidate.fields.currentlyOnRotation||candidate.fields.stillWorking||candidate.fields.ongoing){
        candidate.openEnded=true;
        candidate.endDate=null;
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
      if(decision==="accepted"&&candidate.duplicate)throw new Error("Resolve the duplicate with Merge or Add anyway.");
      if(decision==="merge"&&!candidate.duplicate)throw new Error("Merge is available only for duplicate candidates.");
      candidate.decision=decision;
      candidate.expanded=false;
      return state;
    }
    case"ACCEPT_HIGH_CONFIDENCE":
      for(const candidate of state.candidates){
        if(candidate.decision==="undecided"&&candidate.confidence==="high"&&!candidate.duplicate){
          candidate.decision="accepted";
          candidate.expanded=false;
        }
      }
      return state;
    case"RESET_UPLOAD":{
      const reset=createIntakeState();
      return reset;
    }
    case"DISCARD_ALL":
      state.candidates=[];
      state.stage=INTAKE_STAGES.UPLOAD;
      state.progressIndex=0;
      state.file=null;
      state.consent=false;
      state.failure=null;
      state.extraction={statusIndex:0,completed:false,errorCode:null};
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
    siteName:String(candidate.fields?.institution||candidate.fields?.employer||candidate.fields?.siteName||""),
    notes:candidate.notes,
    lane:null,
    sourceType:"document-intake",
    provenance:approvalProvenance(candidate,fileName),
    fields:clone(candidate.fields)
  };
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
    schemaVersion:"d1-uxr-002-intake-batch.1",
    label:"Add document suggestions",
    history:{required:true,undoSteps:1},
    version:{name:versionName,kind:"automatic",requiredBeforeMutation:true},
    sourceDocument:state.file?clone(state.file):null,
    documentType:state.detectedType,
    additions,
    merges,
    acceptedCandidateIds:positive.map(({id})=>id),
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
  const nextIntake={
    ...(document.intake||{}),
    stage:INTAKE_STAGES.DONE,
    file:batch.sourceDocument?clone(batch.sourceDocument):null,
    candidates:batch.remainingCandidates.map((candidate)=>clone(candidate)),
    filter:"all",
    lastImport:{
      at:batch.createdAt,
      fileName:batch.sourceDocument?.name||"",
      acceptedCount:batch.acceptedCount,
      addedCount:batch.addedCount,
      mergedCount:batch.mergedCount
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
      return this.dispatch({type:"EXTRACTION_SUCCEEDED",candidates});
    }catch(error){
      if(error?.name==="AbortError"||run!==this.runSequence)return this.snapshot();
      const code=String(error?.code||"").toLowerCase();
      if(["unreadable","scanned_no_text","scanned-no-text"].includes(code)){
        return this.dispatch({type:"EXTRACTION_UNREADABLE"});
      }
      this.dispatch({type:"EXTRACTION_ABORTED",errorCode:String(error?.code||"ADAPTER_ERROR")});
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
    ${state.fileError?`<p class="field-error" role="alert">${INTAKE_COPY.fileError}</p>`:""}
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
  return CATEGORIES.map(({id,label})=>`<option value="${escapeHtml(id)}"${id===selected?" selected":""}>${escapeHtml(label)}</option>`).join("");
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
  "extractionWarnings",
  "privacy"
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

function expandedFields(candidate){
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
  return`<div class="candidate-expanded" data-candidate-expanded>
    ${frozen}${extra}
    <label>Notes <textarea data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-field="notes">${escapeHtml(candidate.notes)}</textarea></label>
  </div>`;
}

function candidateMonthField(candidate,field,label,value){
  const id=`intake-${encodeURIComponent(candidate.id)}-${field}`;
  return`<div class="candidate-month" data-candidate-month data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-field="${field}">
    ${monthFieldMarkup({id,label,value:value||""})}
  </div>`;
}

function candidateMarkup(candidate){
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
  const confidenceLabel=candidate.confidence[0].toUpperCase()+candidate.confidence.slice(1);
  const confidenceClass=candidate.confidence==="high"?"success":candidate.confidence==="medium"?"gold":"tertiary";
  return`<article class="candidate-card" data-candidate-card="${escapeHtml(candidate.id)}">
    ${candidate.duplicate?`<div class="duplicate-banner">Looks like a duplicate of '${escapeHtml(candidate.duplicate.eventTitle)}'</div>`:""}
    <div class="candidate-fields">
      <label>Category <select data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-field="categoryId">${categoryOptions(candidate.categoryId)}</select></label>
      <label>Proposed title <input type="text" value="${escapeHtml(candidate.title)}" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-field="title"></label>
      ${candidateMonthField(candidate,"startDate","Start",candidate.startDate)}
      ${candidateMonthField(candidate,"endDate","End",candidate.endDate)}
      <span class="confidence-tag ${confidenceClass}">${confidenceLabel}</span>
    </div>
    <details class="source-snippet" title="${escapeHtml(candidate.sourceSnippet)}">
      <summary>“${escapeHtml(candidate.sourceSnippet)}”</summary>
    </details>
    ${candidate.expanded?expandedFields(candidate):""}
    <div class="candidate-actions">
      ${candidate.duplicate?`<button type="button" class="button primary small" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-action="merge">Merge</button>
      <button type="button" class="button secondary small" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-action="add-anyway">Add anyway</button>`:`<button type="button" class="button primary small" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-action="accepted">Accept</button>`}
      <button type="button" class="button secondary small" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-action="edit">Edit</button>
      <button type="button" class="button tertiary small" data-candidate-id="${escapeHtml(candidate.id)}" data-candidate-action="rejected">Reject</button>
    </div>
  </article>`;
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
    <div class="intake-review-toolbar">
      <button type="button" class="button secondary" data-intake-action="accept-high"${high?"":" disabled"}>Accept all high-confidence (${high})</button>
      <div class="filter-chips" aria-label="Suggestion filters">${INTAKE_FILTERS.map((filter)=>`<button type="button" class="filter-chip${state.filter===filter?" selected":""}" data-intake-filter="${filter}"${state.filter===filter?' aria-pressed="true"':' aria-pressed="false"'}>${filter[0].toUpperCase()+filter.slice(1)}</button>`).join("")}</div>
      <span>${decidedCount(state)} of ${total} decided</span>
    </div>
    <div class="intake-review-grid">
      <div class="candidate-list">${filteredCandidates(state).map(candidateMarkup).join("")||'<p class="secondary-body">No suggestions in this filter.</p>'}</div>
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

export function installIntake(root,machine,{
  onChange=()=>{},
  onNavigate=()=>{},
  onToast=()=>{},
  onError=()=>{},
  openDialog=null,
  saveVersion=null,
  applyBatch=null,
  deleteSource=async()=>{},
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
    const candidateAction=closest(event.target,"[data-candidate-action]");
    if(candidateAction){
      const {candidateId}=candidateAction.dataset;
      const action=candidateAction.dataset.candidateAction;
      if(action==="edit")machine.toggleEdit(candidateId);
      else machine.decideCandidate(candidateId,action);
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
