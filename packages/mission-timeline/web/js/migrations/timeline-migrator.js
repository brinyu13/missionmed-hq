import {clone,legacyVisibility,nowIso,stableId,visibilityName} from "../core/canonical.js";
import {normalizeAdvisorReview} from "../advisor/advisor-manager.js";

export const TIMELINE_SCHEMA_409="d1-timeline-document-409.1";
export const SUPPORTED_IMPORT_SCHEMAS=new Set(["d1-timeline-407f","d1-timeline-document-407","d1-timeline-document-408.1",TIMELINE_SCHEMA_409,"d1-timeline-artifact-409.1"]);

function report(source,target=TIMELINE_SCHEMA_409){return {id:stableId("migration",[source,target,Date.now()]),sourceSchema:source||"UNKNOWN",targetSchema:target,status:"PENDING",warnings:[],preservedUnknownFields:[],changes:[],createdAt:nowIso()};}

function normalizeEvent(event,index){
  const normalizedVisibility=visibilityName(event.visibilityState||event.visibility||event.vis||"ADVISOR_ONLY");
  return {
    id:event.id||stableId("event",[event.title||event.t,index,event.startDate||event.s]),
    title:event.title||event.t||"Untitled event",
    categoryId:event.categoryId||event.cat||"personal",
    eventType:event.eventType||(event.mile?"milestone":"duration"),
    startDate:event.startDate||event.s||"",
    endDate:event.eventType==="milestone"||event.mile?null:(event.endDate||event.e||""),
    siteName:event.siteName||event.loc||"",
    location:event.location||event.loc||"",
    lane:event.lane??null,
    visibility:legacyVisibility(normalizedVisibility),
    visibilityState:normalizedVisibility,
    advisorOnly:normalizedVisibility==="ADVISOR_ONLY",
    interviewSafe:normalizedVisibility==="INTERVIEWER_SAFE",
    sourceType:event.sourceType||event.origin||"import",
    provenance:clone(event.provenance??event.src??null),
    confidence:clone(event.confidence||null),
    canonicalType:event.canonicalType||null,
    sourceCandidateId:event.sourceCandidateId||null,
    sourceDocumentIds:clone(event.sourceDocumentIds||[]),
    datePrecision:clone(event.datePrecision||null),
    humanCorrection:clone(event.humanCorrection||null),
    notes:event.notes||"",
    manualOffset:clone(event.manualOffset||null),
    mediaId:event.mediaId||null,
    sourceDates:clone(event.sourceDates||null)
  };
}

function base409(input){
  const doc=clone(input);
  doc.schemaVersion=TIMELINE_SCHEMA_409;
  doc.id=doc.id||stableId("timeline",[doc.studentProfile?.name||doc.profile?.name||"student",doc.metadata?.createdAt||"local"]);
  doc.title=doc.title||`Timeline: ${doc.studentProfile?.name||doc.profile?.name||"Student"}`;
  doc.events=(doc.events||doc.user?.events||[]).map(normalizeEvent);
  doc.studentProfile=clone(doc.studentProfile||doc.profile||{});
  doc.categories=clone(doc.categories||[]);
  doc.theme=doc.theme||doc.canvasTheme||"keynote";
  doc.visibilityMode=doc.visibilityMode||"fullStory";
  doc.sourceDocuments=clone(doc.sourceDocuments||[]);
  doc.documentPages=clone(doc.documentPages||[]);
  doc.sourceBlocks=clone(doc.sourceBlocks||[]);
  doc.extractionCandidates=clone(doc.extractionCandidates||[]);
  doc.candidateDuplicateGroups=clone(doc.candidateDuplicateGroups||[]);
  doc.candidateConflicts=clone(doc.candidateConflicts||[]);
  doc.humanReviewActions=clone(doc.humanReviewActions||[]);
  doc.timelineEventSourceLinks=clone(doc.timelineEventSourceLinks||[]);
  doc.mediaItems=clone(doc.mediaItems||doc.media||[]);
  doc.mediaLayout=clone(doc.mediaLayout||{photoCount:3});
  doc.advisorReview=normalizeAdvisorReview(doc.advisorReview);
  doc.interviewPractice={questions:[],responses:[],updatedAt:null,...clone(doc.interviewPractice||{})};
  doc.versions=clone(doc.versions||[]);
  doc.exportRecords=clone(doc.exportRecords||[]);
  doc.timelineArtifacts=clone(doc.timelineArtifacts||[]);
  doc.fileVault={mode:"DISABLED",status:"NOT_CONNECTED",links:[],syncHistory:[],mockOnly:true,...clone(doc.fileVault||{})};
  doc.fileVault.links=Array.isArray(doc.fileVault.links)?doc.fileVault.links:[];doc.fileVault.syncHistory=Array.isArray(doc.fileVault.syncHistory)?doc.fileVault.syncHistory:[];
  doc.persistence={dirty:true,autosaveEnabled:true,archived:false,...clone(doc.persistence||{})};
  doc.recovery={available:false,lastCheckpointAt:null,lastRecoveryAt:null,...clone(doc.recovery||{})};
  doc.migrationMetadata={history:[],...clone(doc.migrationMetadata||{})};doc.migrationMetadata.history=Array.isArray(doc.migrationMetadata.history)?doc.migrationMetadata.history:[];
  doc.releaseCandidate=clone(doc.releaseCandidate||{});
  doc.retention=clone(doc.retention||{});
  doc.metadata={...(doc.metadata||{}),source:doc.metadata?.source||"d1_import",sandboxOnly:true,updatedAt:nowIso()};
  return doc;
}

function collectUnknown(input,known){return Object.keys(input||{}).filter((key)=>!known.has(key));}

export function migrateTimelineInput(raw){
  let input;
  try{input=typeof raw==="string"?JSON.parse(raw):clone(raw);}catch(error){return {ok:false,document:null,report:{...report("MALFORMED_JSON"),status:"REJECTED",warnings:["Malformed JSON: "+error.message]}};}
  if(!input||typeof input!=="object")return {ok:false,document:null,report:{...report("INVALID_ROOT"),status:"REJECTED",warnings:["Import root must be an object."]}};
  const source=input.artifactSchemaVersion||input.schemaVersion||input.version||"UNKNOWN";
  const migration=report(source);
  if(/^d1-timeline-document-(?:4[1-9][0-9]|[5-9][0-9]{2})/.test(source)||/^d1-timeline-artifact-(?:4[1-9][0-9]|[5-9][0-9]{2})/.test(source)){
    migration.status="REJECTED";migration.warnings.push("Unsupported future schema. The current draft was not replaced.");return {ok:false,document:null,report:migration};
  }
  let candidate=input;
  if(source==="d1-timeline-artifact-409.1"){
    candidate=input.companionDocument||input.timelineDocument||null;
    if(!candidate){migration.status="REJECTED";migration.warnings.push("Artifact manifest does not contain an importable companion TimelineDocument.");return {ok:false,document:null,report:migration};}
    migration.changes.push("Extracted companion TimelineDocument from TimelineArtifact manifest.");
  }
  if(!SUPPORTED_IMPORT_SCHEMAS.has(source)&&source!=="407"&&source!=="UNKNOWN")migration.warnings.push("Unrecognized source schema was preserved conservatively.");
  const known=new Set(["schemaVersion","id","title","studentProfile","profile","events","user","categories","theme","canvasTheme","visibilityMode","advisorReview","versions","sourceDocuments","documentPages","sourceBlocks","extractionCandidates","candidateDuplicateGroups","candidateConflicts","humanReviewActions","timelineEventSourceLinks","ingestion","metadata","media","mediaItems","mediaLayout","interviewPractice","exportRecords","timelineArtifacts","fileVault","persistence","recovery","migrationMetadata","releaseCandidate","retention"]);
  const unknown=collectUnknown(candidate,known);
  const document=base409(candidate);
  if(unknown.length){document.extensions={...(document.extensions||{}),unmappedImportFields:Object.fromEntries(unknown.map((key)=>[key,clone(candidate[key])]))};migration.preservedUnknownFields.push(...unknown);migration.warnings.push("Unknown fields were preserved under extensions.unmappedImportFields.");}
  if(!document.sourceDocuments.length&&document.timelineEventSourceLinks.length)migration.warnings.push("Timeline contains source links but no source documents.");
  document.events.forEach((event)=>{if(event.sourceType!=="manual"&&(!event.provenance||(Array.isArray(event.provenance)&&!event.provenance.length))){event.provenanceMissing=true;migration.warnings.push("Event "+event.id+" is missing source provenance.");}});
  const eventIds=new Set(document.events.map((event)=>event.id));
  (document.advisorReview.comments||[]).forEach((comment)=>{if(comment.timelineEventId&&!eventIds.has(comment.timelineEventId)){comment.orphaned=true;migration.warnings.push(`Advisor comment ${comment.id||"unknown"} references a missing event.`);}});
  document.fileVault.links=(document.fileVault.links||[]).map((link)=>link?.artifactId?link:{...link,orphaned:true});
  const artifactIds=new Set();
  (document.timelineArtifacts||[]).forEach((artifact)=>{if(artifactIds.has(artifact.artifactId)){artifact.duplicateArtifactId=true;migration.warnings.push("Duplicate TimelineArtifact ID preserved for review: "+artifact.artifactId);}artifactIds.add(artifact.artifactId);});
  migration.changes.push(`Normalized ${document.events.length} events and five-state visibility.`);
  migration.status="MIGRATED";
  document.migrationMetadata.history=[...(document.migrationMetadata.history||[]),clone(migration)];
  return {ok:true,document,report:migration};
}
