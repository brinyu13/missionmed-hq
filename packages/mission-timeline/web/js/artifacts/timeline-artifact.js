import {byteSize,clone,nowIso,sha256Hex,stableId,stableStringify} from "../core/canonical.js";

export const ARTIFACT_SCHEMA_VERSION="d1-timeline-artifact-409.1";
export const ARTIFACT_TYPES=new Set(["TIMELINE_INTERVIEWER_SAFE_PNG","TIMELINE_FULL_STORY_PNG","TIMELINE_PRINT_PDF","TIMELINE_ADVISOR_PACKET_PDF","TIMELINE_ARCHIVE","TIMELINE_SOURCE_JSON","TIMELINE_ACCESSIBLE_HTML"]);

const REQUIRED=["artifactId","artifactType","artifactSchemaVersion","timelineDocumentId","timelineVersionId","createdByRole","createdAt","updatedAt","displayName","documentCategory","mimeType","byteSize","contentHash","exportScope","visibility","approvalState","theme","primaryFile","timelineEventCount","warnings","retentionClass","fileVaultLinkageState","synchronizationStatus","idempotencyKey"];

export function validateTimelineArtifact(artifact){
  const errors=[];
  if(!artifact||typeof artifact!=="object")return {valid:false,errors:["Artifact must be an object."]};
  REQUIRED.forEach((field)=>{if(artifact[field]===undefined||artifact[field]===null||artifact[field]==="")errors.push(`Missing required field: ${field}`);});
  if(!ARTIFACT_TYPES.has(artifact.artifactType))errors.push("Unsupported artifactType.");
  if(artifact.artifactSchemaVersion!==ARTIFACT_SCHEMA_VERSION)errors.push("Unsupported artifactSchemaVersion.");
  if(!/^[a-f0-9]{64}$/i.test(artifact.contentHash||""))errors.push("contentHash must be SHA256 hex.");
  if(!Number.isFinite(artifact.byteSize)||artifact.byteSize<0)errors.push("byteSize must be a nonnegative number.");
  if(!Array.isArray(artifact.companionFiles)||!Array.isArray(artifact.warnings)||!Array.isArray(artifact.synchronizationHistory))errors.push("Artifact list fields are invalid.");
  return {valid:errors.length===0,errors};
}

export function artifactHashInput({artifactType,timelineDocumentId,timelineVersionId,exportScope,theme,contentHash}){return {artifactType,timelineDocumentId,timelineVersionId,exportScope,theme,contentHash};}

export async function createTimelineArtifact({document,versionId="working",artifactType,blob,filename,scope,visibility,approvalState,dimensions=null,pageCount=null,previewImage=null,companionFiles=[],createdByRole="STUDENT",warnings=[],description="",generatedQuestionCount=0,advisorCommentCount=0,provenanceSummary=null,retentionClass="STUDENT_CONTROLLED_LOCAL",clock=()=>new Date()}){
  if(!ARTIFACT_TYPES.has(artifactType))throw new Error("Unknown TimelineArtifact type.");
  const bytes=blob?new Uint8Array(await blob.arrayBuffer()):new TextEncoder().encode(stableStringify(document));
  const contentHash=await sha256Hex(bytes),createdAt=nowIso(clock);
  const idempotencyKey=stableId("timeline-artifact",artifactHashInput({artifactType,timelineDocumentId:document.id,timelineVersionId:versionId,exportScope:scope,theme:document.theme,contentHash}));
  const artifact={
    artifactId:idempotencyKey,artifactType,artifactSchemaVersion:ARTIFACT_SCHEMA_VERSION,timelineDocumentId:document.id,timelineVersionId:versionId,
    studentOwnerId:document.studentOwnerId||"LOCAL_STUDENT_OWNER_PLACEHOLDER",createdByRole,createdAt,updatedAt:createdAt,displayName:filename,description,
    documentCategory:"MISSION_TIMELINE",mimeType:blob?.type||"application/octet-stream",byteSize:blob?.size??byteSize(document),contentHash,exportScope:scope,visibility,
    approvalState:clone(approvalState||{}),theme:document.theme,dimensions,pageCount,previewImage,primaryFile:{filename,mimeType:blob?.type||"application/octet-stream",byteSize:blob?.size??bytes.byteLength,contentHash},
    companionFiles:clone(companionFiles),sourceDocumentReferences:(document.sourceDocuments||[]).map((source)=>({id:source.id,fileName:source.fileName,sha256:source.sha256,removed:!!source.removed})),
    timelineEventCount:(document.events||[]).length,generatedQuestionCount,advisorCommentCount,warnings:clone(warnings),provenanceSummary:provenanceSummary||{sourceDocumentCount:(document.sourceDocuments||[]).length,linkedEventCount:(document.timelineEventSourceLinks||[]).length},
    retentionClass,fileVaultLinkageState:"UNLINKED",legacyVaultReference:null,v2VaultReference:null,synchronizationStatus:"NOT_SYNCED",synchronizationHistory:[],idempotencyKey
  };
  const validation=validateTimelineArtifact(artifact);if(!validation.valid)throw new Error("TimelineArtifact invalid: "+validation.errors.join(" "));
  return artifact;
}

export function migrateTimelineArtifact(artifact){
  if(artifact?.artifactSchemaVersion===ARTIFACT_SCHEMA_VERSION)return {artifact:clone(artifact),migrated:false,warnings:[]};
  throw new Error("Unsupported TimelineArtifact schema. Import was not applied.");
}
