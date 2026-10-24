import {extractPdf} from "./pdf-text-extractor.js";
import {detectSections} from "./section-detector.js";
import {detectDocumentType,normalizeDocumentType,DOCUMENT_TYPES} from "./document-types.js";
import {parseErasBlocks} from "./eras-parser.js";
import {parseCvBlocks,parseResumeBlocks,parseUnknownBlocks} from "./cv-parser.js";
import {buildCandidates} from "./candidate-builder.js";
import {detectConflicts} from "./conflict-detector.js";
import {detectDuplicates} from "./duplicate-detector.js";
import {ensureIngestionState,resetCandidateRelations,PARSER_VERSION,clone} from "./ingestion-state.js";
import {stableHash} from "./provenance.js";
import {sha256Hex} from "../core/canonical.js";

const VISIBILITY_TO_LEGACY={INTERVIEWER_SAFE:"public",FULL_STORY:"full",ADVISOR_ONLY:"advisor",STUDENT_ONLY:"student",HIDDEN:"hidden"};
const REVIEWED=new Set(["ACCEPTED","REJECTED","MERGED","KEPT_BOTH","SOURCE_NOT_SELECTED","DEFERRED"]);

function parseRecords(type,blocks){
  if(type===DOCUMENT_TYPES.ERAS)return parseErasBlocks(blocks);
  if(type===DOCUMENT_TYPES.RESUME)return parseResumeBlocks(blocks);
  if(type===DOCUMENT_TYPES.CV)return parseCvBlocks(blocks);
  return parseUnknownBlocks(blocks);
}

function actionId(candidateId,action){return "review-"+stableHash(candidateId+"|"+action+"|"+Date.now()+"|"+Math.random());}

export class IngestionController{
  constructor(api){
    if(!api?.state)throw new Error("D1 legacy state is required for ingestion.");
    this.api=api;
    this.state=ensureIngestionState(api.state);
    this.listeners=new Set();
    this.filesByDocumentId=new Map();
  }

  subscribe(listener){this.listeners.add(listener);listener(this.state);return()=>this.listeners.delete(listener);}
  notify(){this.state.updatedAt=new Date().toISOString();this.listeners.forEach((listener)=>listener(this.state));}
  transition(status,detail,data={}){
    this.state.status=status;
    this.state.statusDetail=detail||status;
    this.state.processingHistory.push({status,detail:this.state.statusDetail,at:new Date().toISOString(),...data});
    this.notify();
  }
  syncLegacy({render=true}={}){
    this.api.state.__408Ingestion=this.state;
    if(render)this.api.renderAll();
    this.notify();
  }

  async ingestFile(file,{declaredType="auto",password=null}={}){
    this.state.lastError=null;
    this.transition("READING","Inspecting "+String(file?.name||"the local file"));
    try{
      const extraction=await extractPdf(file,{password,onStatus:(status,detail)=>this.transition(status,detail.message,detail)});
      const typeResult=detectDocumentType(extraction.text,declaredType);
      const normalizedDeclaredType=normalizeDocumentType(declaredType);
      const explicitType=[DOCUMENT_TYPES.ERAS,DOCUMENT_TYPES.CV,DOCUMENT_TYPES.RESUME].includes(normalizedDeclaredType);
      const detectedType=extraction.status==="OCR_REQUIRED"?DOCUMENT_TYPES.SCANNED:typeResult.detectedType;
      const effectiveType=explicitType?normalizedDeclaredType:detectedType;
      const document={
        id:extraction.sourceDocumentId,
        fileName:extraction.inspected.name,
        fileSize:extraction.inspected.size,
        mimeType:extraction.inspected.mimeType,
        sha256:extraction.inspected.sha256,
        userDeclaredType:normalizedDeclaredType,
        detectedType,
        effectiveType,
        typeConfirmedByUser:explicitType,
        detectionConfidence:extraction.status==="OCR_REQUIRED"?"HIGH":typeResult.confidence,
        typeDetection:typeResult,
        pageCount:extraction.pageCount,
        charCount:extraction.charCount,
        extractionMethod:extraction.extractionMethod,
        ocr:clone(extraction.ocr),
        status:extraction.status,
        parserVersion:PARSER_VERSION,
        warnings:[...extraction.warnings,...(typeResult.mismatch?["Declared and detected document types differ."]:[])],
        createdAt:new Date().toISOString(),
        updatedAt:new Date().toISOString(),
        removed:false
      };
      this.replaceDocument(document,extraction.pages,[]);
      this.filesByDocumentId.set(document.id,file);
      this.state.activeDocumentId=document.id;
      if(extraction.status==="OCR_REQUIRED"){
        this.transition("OCR_REQUIRED","No native text layer was found. Local OCR is required.",{documentId:document.id});
        this.syncLegacy();
        return {status:"OCR_REQUIRED",document,candidates:[]};
      }
      this.transition("SECTIONING","Detecting document sections",{documentId:document.id});
      const sectionResult=detectSections(extraction.pages);
      this.transition("CLASSIFYING","Parsing "+document.effectiveType.toUpperCase()+" chronology",{documentId:document.id,sections:sectionResult.sections});
      const records=parseRecords(document.effectiveType,sectionResult.blocks);
      this.transition("CANDIDATE_CREATION","Building quarantined candidates",{documentId:document.id,recordCount:records.length});
      let candidates=buildCandidates(records,document);
      candidates=this.preserveExistingReviews(document.id,candidates);
      this.replaceDocument(document,extraction.pages,sectionResult.blocks,candidates);
      this.transition("DUPLICATE_ANALYSIS","Comparing candidates across source documents",{documentId:document.id});
      this.reanalyzeRelations();
      this.transition("CONFLICT_ANALYSIS","Checking dates, organizations, and event identities",{documentId:document.id});
      const pending=this.state.extractionCandidates.filter((candidate)=>candidate.reviewStatus==="PENDING").length;
      this.transition("READY_FOR_REVIEW",pending+" candidates are quarantined for human review.",{documentId:document.id,candidateCount:candidates.length});
      this.syncLegacy();
      return {status:"READY_FOR_REVIEW",document,candidates,sections:sectionResult.sections,records};
    }catch(error){
      const code=error?.code||"INGESTION_FAILED";
      this.state.lastError={code,message:String(error?.message||error),details:error?.details||{},fileName:file?.name||null,at:new Date().toISOString()};
      const status=["UNSUPPORTED_FILE","INVALID_PDF","FILE_TOO_LARGE","EMPTY_FILE","NO_FILE","PAGE_LIMIT"].includes(code)?"UNSUPPORTED":code==="PASSWORD_REQUIRED"?"PASSWORD_REQUIRED":code==="CORRUPTED_PDF"?"CORRUPTED":"PARTIAL_FAILURE";
      this.transition(status,this.state.lastError.message,{code,fileName:file?.name||null});
      this.syncLegacy();
      return {status,error:this.state.lastError,candidates:[]};
    }
  }

  async ingestManualText(text,{fileName="local-ocr-text.txt",declaredType="auto"}={}){
    const raw=String(text||"").replace(/\r\n?/g,"\n").trim();
    if(raw.length<40)throw new Error("Paste at least 40 characters of locally generated OCR text.");
    this.state.lastError=null;
    this.transition("READING","Reading manually supplied local OCR text");
    const chunks=raw.split(/\n\s*(?:---+\s*PAGE\s+\d+\s*---+|\[PAGE\s+\d+\]|\f)\s*\n/gi).map((value)=>value.trim()).filter(Boolean);
    const sha256=await sha256Hex(raw),documentId="manual-ocr-"+sha256.slice(0,20);
    const pages=(chunks.length?chunks:[raw]).map((value,index)=>({id:documentId+":page:"+(index+1),sourceDocumentId:documentId,pageNumber:index+1,width:0,height:0,lines:value.split("\n").map((line)=>line.trim()).filter(Boolean),text:value,charCount:value.length,textLayerPresent:true,extractionMethod:"MANUAL_LOCAL_OCR_TEXT"}));
    const typeResult=detectDocumentType(raw,declaredType),normalizedDeclaredType=normalizeDocumentType(declaredType),explicitType=[DOCUMENT_TYPES.ERAS,DOCUMENT_TYPES.CV,DOCUMENT_TYPES.RESUME].includes(normalizedDeclaredType),effectiveType=explicitType?normalizedDeclaredType:typeResult.detectedType;
    const sourceDocument={id:documentId,fileName:String(fileName||"local-ocr-text.txt"),fileSize:new TextEncoder().encode(raw).byteLength,mimeType:"text/plain",sha256,userDeclaredType:normalizedDeclaredType,detectedType:typeResult.detectedType,effectiveType,typeConfirmedByUser:explicitType,detectionConfidence:typeResult.confidence,typeDetection:typeResult,pageCount:pages.length,charCount:raw.length,extractionMethod:"MANUAL_LOCAL_OCR_TEXT",ocr:{status:"MANUAL_TEXT_FALLBACK",provider:"USER_LOCAL_TOOL",cloud:false,pageMapping:pages.map((page)=>page.pageNumber),accuracyNotVerified:true},status:"EXTRACTED",parserVersion:PARSER_VERSION,warnings:["OCR accuracy was not verified by this app. Review every candidate against the local source scan."],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),removed:false};
    this.state.activeDocumentId=documentId;
    this.transition("SECTIONING","Detecting sections in local OCR text",{documentId});
    const sectionResult=detectSections(pages);
    this.transition("CLASSIFYING","Parsing "+effectiveType.toUpperCase()+" chronology",{documentId,sections:sectionResult.sections});
    const records=parseRecords(effectiveType,sectionResult.blocks);
    this.transition("CANDIDATE_CREATION","Building quarantined candidates from local OCR text",{documentId,recordCount:records.length});
    let candidates=buildCandidates(records,sourceDocument);candidates=this.preserveExistingReviews(documentId,candidates);
    this.replaceDocument(sourceDocument,pages,sectionResult.blocks,candidates);this.reanalyzeRelations();
    this.transition("READY_FOR_REVIEW",candidates.length+" OCR-text candidates are quarantined for human review.",{documentId,candidateCount:candidates.length});
    this.syncLegacy();
    return {status:"READY_FOR_REVIEW",document:sourceDocument,candidates,sections:sectionResult.sections,records,decision:"MANUAL_TEXT_FALLBACK"};
  }

  replaceDocument(document,pages,blocks,candidates=null){
    this.state.sourceDocuments=this.state.sourceDocuments.filter((item)=>item.id!==document.id).concat(document);
    this.state.documentPages=this.state.documentPages.filter((item)=>item.sourceDocumentId!==document.id).concat(pages||[]);
    this.state.sourceBlocks=this.state.sourceBlocks.filter((item)=>item.sourceDocumentId!==document.id).concat(blocks||[]);
    if(candidates)this.state.extractionCandidates=this.state.extractionCandidates.filter((item)=>item.sourceDocumentId!==document.id).concat(candidates);
  }

  preserveExistingReviews(documentId,newCandidates){
    const existing=new Map(this.state.extractionCandidates.filter((candidate)=>candidate.sourceDocumentId===documentId).map((candidate)=>[candidate.fingerprint,candidate]));
    return newCandidates.map((candidate)=>{
      const previous=existing.get(candidate.fingerprint);
      if(!previous||!REVIEWED.has(previous.reviewStatus))return candidate;
      return {...candidate,reviewStatus:previous.reviewStatus,finalHumanAction:previous.finalHumanAction,humanCorrection:clone(previous.humanCorrection),resultingEventIds:clone(previous.resultingEventIds||[]),visibilityRecommendation:previous.visibilityRecommendation};
    });
  }

  reanalyzeRelations(){
    this.state.extractionCandidates.forEach(resetCandidateRelations);
    this.state.candidateConflicts=detectConflicts(this.state.extractionCandidates);
    this.state.candidateDuplicateGroups=detectDuplicates(this.state.extractionCandidates);
  }

  candidate(id){return this.state.extractionCandidates.find((candidate)=>candidate.id===id)||null;}
  duplicateGroup(id){return this.state.candidateDuplicateGroups.find((group)=>group.id===id)||null;}
  conflict(id){return this.state.candidateConflicts.find((conflict)=>conflict.id===id)||null;}

  recordAction(candidate,action,details={}){
    const item={id:actionId(candidate.id,action),candidateId:candidate.id,action,details:clone(details),at:new Date().toISOString()};
    this.state.humanReviewActions.push(item);
    candidate.finalHumanAction=item;
    return item;
  }

  editCandidate(id,patch){
    const candidate=this.candidate(id);
    if(!candidate)throw new Error("Candidate not found.");
    const allowed=["title","categoryId","canonicalType","timelineKind","startDate","endDate","organization","siteName","location","specialty","experienceType","visibilityRecommendation"];
    const correction={};
    allowed.forEach((key)=>{if(Object.prototype.hasOwnProperty.call(patch,key)){correction[key]={from:candidate[key],to:patch[key]};candidate[key]=patch[key];}});
    candidate.humanCorrection={at:new Date().toISOString(),fields:correction,originalExtraction:clone(candidate.originalExtraction)};
    candidate.safeToBulkAccept=false;
    this.recordAction(candidate,"EDIT",{fields:Object.keys(correction)});
    this.syncLegacy();
    return candidate;
  }

  createEvent(candidate,visibility="INTERVIEWER_SAFE",provenanceOverride=null){
    const provenance=clone(provenanceOverride||candidate.provenance||[]);
    if(!provenance.length)throw new Error("No provenance means no timeline event.");
    const eventId="ing-"+stableHash(candidate.id+"|"+Date.now()+"|"+Math.random());
    const legacyVisibility=VISIBILITY_TO_LEGACY[visibility]||"advisor";
    const event={
      id:eventId,
      t:candidate.title,
      cat:candidate.categoryId,
      canonicalType:candidate.canonicalType,
      mile:candidate.timelineKind==="milestone",
      s:candidate.startDate,
      e:candidate.timelineKind==="milestone"?null:candidate.endDate,
      vis:legacyVisibility,
      visibilityState:visibility,
      loc:candidate.siteName||candidate.organization||candidate.location||"",
      origin:"document",
      notes:"",
      lane:null,
      src:provenance.map((item)=>item.fileName+" P"+item.pageNumber).join(" + "),
      q:provenance.map((item)=>item.sourceExcerpt).join(" | "),
      provenance,
      confidence:clone(candidate.confidence),
      sourceCandidateId:candidate.id,
      sourceDocumentIds:[...new Set(provenance.map((item)=>item.sourceDocumentId))],
      datePrecision:clone(candidate.datePrecision),
      humanCorrection:clone(candidate.humanCorrection),
      sourceDates:{startDate:candidate.startDate,endDate:candidate.timelineKind==="milestone"?null:candidate.endDate}
    };
    this.api.state.user.events.push(event);
    this.state.timelineEventSourceLinks.push(...provenance.map((item)=>({
      id:"link-"+stableHash(eventId+"|"+item.id),
      timelineEventId:eventId,
      candidateId:candidate.id,
      provenanceId:item.id,
      sourceDocumentId:item.sourceDocumentId,
      createdAt:new Date().toISOString(),
      sourceRemoved:false
    })));
    return event;
  }

  acceptCandidate(id,{visibility=null,allowUnresolved=false}={}){
    const candidate=this.candidate(id);
    if(!candidate)throw new Error("Candidate not found.");
    if(candidate.reviewStatus!=="PENDING"&&candidate.reviewStatus!=="DEFERRED")throw new Error("Candidate is already resolved.");
    if(!allowUnresolved&&(candidate.duplicateGroupIds.length||candidate.conflictIds.length))throw new Error("Resolve duplicate or conflict review before acceptance.");
    if(!candidate.startDate)throw new Error("A start date is required before acceptance.");
    const selectedVisibility=visibility||candidate.visibilityRecommendation||"ADVISOR_ONLY";
    const event=this.createEvent(candidate,selectedVisibility);
    candidate.reviewStatus="ACCEPTED";
    candidate.visibilityRecommendation=selectedVisibility;
    candidate.resultingEventIds.push(event.id);
    this.recordAction(candidate,"ACCEPT",{visibility:selectedVisibility,eventId:event.id});
    this.api.state.mode="blank";
    this.api.state.saved=false;
    this.syncLegacy();
    return event;
  }

  rejectCandidate(id){
    const candidate=this.candidate(id);
    if(!candidate)throw new Error("Candidate not found.");
    candidate.reviewStatus="REJECTED";
    this.recordAction(candidate,"REJECT");
    this.syncLegacy();
    return candidate;
  }

  deferCandidate(id){
    const candidate=this.candidate(id);
    if(!candidate)throw new Error("Candidate not found.");
    candidate.reviewStatus="DEFERRED";
    this.recordAction(candidate,"DEFER");
    this.syncLegacy();
    return candidate;
  }

  setCandidateVisibility(id,visibility){
    const candidate=this.candidate(id);
    if(!candidate)throw new Error("Candidate not found.");
    if(!VISIBILITY_TO_LEGACY[visibility])throw new Error("Unknown visibility.");
    candidate.visibilityRecommendation=visibility;
    this.recordAction(candidate,"VISIBILITY_CHANGE",{visibility});
    this.syncLegacy({render:false});
    return candidate;
  }

  mergeDuplicate(groupId,primaryCandidateId=null,visibility="INTERVIEWER_SAFE"){
    const group=this.duplicateGroup(groupId);
    if(!group)throw new Error("Duplicate group not found.");
    const candidates=group.candidateIds.map((id)=>this.candidate(id)).filter(Boolean);
    const primary=this.candidate(primaryCandidateId)||candidates[0];
    const provenance=candidates.flatMap((candidate)=>candidate.provenance||[]);
    const merged={...primary,id:"merged-"+group.id,sourceDocumentIds:[...new Set(candidates.flatMap((candidate)=>candidate.sourceDocumentIds))],provenance};
    const event=this.createEvent(merged,visibility,provenance);
    candidates.forEach((candidate)=>{
      candidate.reviewStatus="MERGED";
      candidate.resultingEventIds.push(event.id);
      this.recordAction(candidate,"MERGE",{groupId,eventId:event.id,sourceDocumentIds:merged.sourceDocumentIds});
    });
    group.status="MERGED";
    group.resultingEventId=event.id;
    this.syncLegacy();
    return event;
  }

  keepBoth(groupId,visibility="INTERVIEWER_SAFE"){
    const group=this.duplicateGroup(groupId);
    if(!group)throw new Error("Duplicate group not found.");
    const events=group.candidateIds.map((id)=>this.acceptCandidate(id,{visibility,allowUnresolved:true}));
    group.candidateIds.forEach((id)=>{const candidate=this.candidate(id);candidate.reviewStatus="KEPT_BOTH";candidate.finalHumanAction.action="KEEP_BOTH";});
    group.status="KEPT_BOTH";
    this.syncLegacy();
    return events;
  }

  chooseSource(conflictId,candidateId,visibility="INTERVIEWER_SAFE"){
    const conflict=this.conflict(conflictId);
    if(!conflict||!conflict.candidateIds.includes(candidateId))throw new Error("Conflict source choice is invalid.");
    const chosen=this.acceptCandidate(candidateId,{visibility,allowUnresolved:true});
    conflict.candidateIds.filter((id)=>id!==candidateId).forEach((id)=>{
      const candidate=this.candidate(id);
      candidate.reviewStatus="SOURCE_NOT_SELECTED";
      this.recordAction(candidate,"CHOOSE_OTHER_SOURCE",{conflictId,selectedCandidateId:candidateId});
    });
    conflict.status="RESOLVED";
    conflict.selectedCandidateId=candidateId;
    conflict.resultingEventId=chosen.id;
    this.syncLegacy();
    return chosen;
  }

  acceptAllSafeHighConfidence(){
    const eligible=this.state.extractionCandidates.filter((candidate)=>candidate.reviewStatus==="PENDING"&&candidate.safeToBulkAccept);
    const events=eligible.map((candidate)=>this.acceptCandidate(candidate.id,{visibility:"INTERVIEWER_SAFE"}));
    return {accepted:eligible.length,eventIds:events.map((event)=>event.id)};
  }

  acceptCandidatesSafe(ids=[]){
    const selected=new Set(ids),eligible=this.state.extractionCandidates.filter((candidate)=>selected.has(candidate.id)&&candidate.reviewStatus==="PENDING"&&candidate.safeToBulkAccept&&!candidate.duplicateGroupIds.length&&!candidate.conflictIds.length),eventIds=[];
    eligible.forEach((candidate)=>{const visibility=candidate.visibilityRecommendation||"INTERVIEWER_SAFE",event=this.createEvent(candidate,visibility);candidate.reviewStatus="ACCEPTED";candidate.visibilityRecommendation=visibility;candidate.resultingEventIds.push(event.id);this.recordAction(candidate,"ACCEPT",{visibility,eventId:event.id,bulk:true});eventIds.push(event.id);});
    if(eligible.length){this.api.state.mode="blank";this.api.state.saved=false;this.syncLegacy();}
    return {accepted:eligible.length,eventIds,skipped:selected.size-eligible.length};
  }

  reviewProgress(){
    const total=this.state.extractionCandidates.length;
    const reviewed=this.state.extractionCandidates.filter((candidate)=>candidate.reviewStatus!=="PENDING").length;
    return {reviewed,total,pending:total-reviewed};
  }

  previewDocumentRemoval(documentId){
    const candidateIds=this.state.extractionCandidates.filter((candidate)=>candidate.sourceDocumentIds.includes(documentId)).map((candidate)=>candidate.id);
    const eventIds=[...new Set(this.state.timelineEventSourceLinks.filter((link)=>link.sourceDocumentId===documentId).map((link)=>link.timelineEventId))];
    return {documentId,candidateIds,eventIds,candidateCount:candidateIds.length,eventCount:eventIds.length};
  }

  removeDocument(documentId,{confirmed=false}={}){
    const impact=this.previewDocumentRemoval(documentId);
    if(!confirmed)return impact;
    this.state.sourceDocuments=this.state.sourceDocuments.filter((document)=>document.id!==documentId);
    this.state.documentPages=this.state.documentPages.filter((page)=>page.sourceDocumentId!==documentId);
    this.state.sourceBlocks=this.state.sourceBlocks.filter((block)=>block.sourceDocumentId!==documentId);
    this.state.extractionCandidates=this.state.extractionCandidates.filter((candidate)=>!candidate.sourceDocumentIds.includes(documentId)||candidate.resultingEventIds.length);
    this.state.timelineEventSourceLinks.filter((link)=>link.sourceDocumentId===documentId).forEach((link)=>{link.sourceRemoved=true;});
    this.filesByDocumentId.delete(documentId);
    this.reanalyzeRelations();
    this.transition("READY_FOR_REVIEW","Source removed. Existing timeline events were retained and marked with removed-source links.",impact);
    this.syncLegacy();
    return impact;
  }

  async rerunDocument(documentId){
    const file=this.filesByDocumentId.get(documentId);
    const document=this.state.sourceDocuments.find((item)=>item.id===documentId);
    if(!file||!document)throw new Error("The local File object is no longer available. Choose the PDF again.");
    return this.ingestFile(file,{declaredType:document.userDeclaredType});
  }

  async correctDocumentType(documentId,declaredType){
    const document=this.state.sourceDocuments.find((item)=>item.id===documentId);
    const file=this.filesByDocumentId.get(documentId);
    if(!document||!file)throw new Error("Choose the local PDF again before correcting its type.");
    const normalized=normalizeDocumentType(declaredType);
    if(![DOCUMENT_TYPES.AUTO,DOCUMENT_TYPES.ERAS,DOCUMENT_TYPES.CV,DOCUMENT_TYPES.RESUME].includes(normalized))throw new Error("Choose Auto Detect, ERAS, CV, or Resume.");
    const history=clone(document.typeCorrectionHistory||[]);
    history.push({from:document.effectiveType||document.detectedType,to:normalized,at:new Date().toISOString()});
    const result=await this.ingestFile(file,{declaredType:normalized});
    const corrected=this.state.sourceDocuments.find((item)=>item.id===documentId);
    if(corrected){corrected.typeCorrectionHistory=history;corrected.typeConfirmedByUser=normalized!==DOCUMENT_TYPES.AUTO;}
    this.syncLegacy();
    return result;
  }
}
