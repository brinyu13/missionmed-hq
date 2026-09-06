import {clone,legacyVisibility,nowIso,visibilityName} from "../core/canonical.js";
import {TIMELINE_SCHEMA_409} from "../migrations/timeline-migrator.js";

export function buildTimelineDocument409(api,state409){
  const base=clone(window.D1_407_TEST?.sync?.()||api.state.__407Document||{});
  const ext=state409||api.state.__409||{};
  base.schemaVersion=TIMELINE_SCHEMA_409;
  base.events=(base.events||[]).map((event)=>{const visibilityState=visibilityName(event.visibilityState||event.visibility);return {...event,visibilityState,visibility:legacyVisibility(visibilityState),interviewSafe:visibilityState==="INTERVIEWER_SAFE",advisorOnly:visibilityState==="ADVISOR_ONLY"};});
  base.mediaItems=clone(ext.mediaItems||[]);
  base.mediaLayout=clone(ext.mediaLayout||{photoCount:api.state.photoN||3});
  base.advisorReview=clone(ext.advisorReview||base.advisorReview||{});
  base.interviewPractice=clone(ext.interviewPractice||{});
  base.exportRecords=clone(ext.exportRecords||[]);
  base.timelineArtifacts=clone(ext.timelineArtifacts||[]);
  base.fileVault=clone(ext.fileVault||{mode:"DISABLED",status:"NOT_CONNECTED",links:[],syncHistory:[]});
  base.persistence=clone(ext.persistence||{});
  base.recovery=clone(ext.recovery||{});
  base.migrationMetadata=clone(ext.migrationMetadata||{history:[]});
  base.retention=clone(ext.retention||{});
  base.releaseCandidate=clone(ext.releaseCandidate||{});
  base.title=api.state.timelineTitle||base.title;
  base.metadata={...(base.metadata||{}),source:"app_demo_401_410",applicationVersion:ext.releaseCandidate?.applicationVersion||"D1-409.1",sandboxOnly:true,updatedAt:nowIso()};
  return base;
}

export function applyTimelineDocument409(api,document){
  const doc=clone(document);
  api.state.user.events=(doc.events||[]).map((event)=>({
    id:event.id,t:event.title,cat:event.categoryId,mile:event.eventType==="milestone",s:event.startDate,e:event.eventType==="milestone"?null:event.endDate,
    vis:legacyVisibility(event.visibilityState||event.visibility),visibilityState:visibilityName(event.visibilityState||event.visibility),loc:event.siteName||event.location||"",origin:event.sourceType||"persisted",notes:event.notes||"",lane:event.lane??null,
    manualOffset:clone(event.manualOffset||null),canonicalType:event.canonicalType||null,provenance:clone(event.provenance||null),sourceCandidateId:event.sourceCandidateId||null,
    sourceDocumentIds:clone(event.sourceDocumentIds||[]),datePrecision:clone(event.datePrecision||null),humanCorrection:clone(event.humanCorrection||null),confidence:clone(event.confidence||null),mediaId:event.mediaId||null,sourceDates:clone(event.sourceDates||null)
  }));
  if(doc.studentProfile){api.state.profile.name=doc.studentProfile.name||api.state.profile.name;api.state.profile.goal=doc.studentProfile.specialtyGoal||api.state.profile.goal;api.state.profile.country=doc.studentProfile.medicalSchoolCountry||api.state.profile.country;api.state.profile.visa=doc.studentProfile.visaStatus||api.state.profile.visa;}
  (doc.categories||[]).forEach((category)=>{if(api.CATS[category.id]){api.CATS[category.id].n=category.label||api.CATS[category.id].n;api.CATS[category.id].c=category.color||api.CATS[category.id].c;}});
  api.state.canvasTheme=doc.theme||"keynote";
  api.state.mode="blank";api.state.sel=null;
  api.state.__408Ingestion={
    schemaVersion:doc.ingestion?.schemaVersion||"d1-ingestion-408.1",parserVersion:doc.ingestion?.parserVersion||"408.1.0",status:doc.ingestion?.status||"READY_FOR_REVIEW",
    statusDetail:"Restored from durable local TimelineDocument.",activeDocumentId:doc.ingestion?.activeDocumentId||null,sourceDocuments:clone(doc.sourceDocuments||[]),
    documentPages:clone(doc.documentPages||[]),sourceBlocks:clone(doc.sourceBlocks||[]),extractionCandidates:clone(doc.extractionCandidates||[]),candidateDuplicateGroups:clone(doc.candidateDuplicateGroups||[]),
    candidateConflicts:clone(doc.candidateConflicts||[]),humanReviewActions:clone(doc.humanReviewActions||[]),timelineEventSourceLinks:clone(doc.timelineEventSourceLinks||[]),processingHistory:[],lastError:null,
    filters:{status:"ALL",confidence:"ALL",type:"ALL"},updatedAt:nowIso()
  };
  const existing=api.state.__409||{};
  const replaceObject=(key,value)=>{
    const next=clone(value||{});
    if(existing[key]&&typeof existing[key]==="object"&&!Array.isArray(existing[key])){
      Object.keys(existing[key]).forEach((name)=>delete existing[key][name]);
      Object.assign(existing[key],next);
    }else existing[key]=next;
  };
  existing.schemaVersion=TIMELINE_SCHEMA_409;
  existing.activeDocumentId=doc.id;
  existing.mediaItems=clone(doc.mediaItems||[]);
  replaceObject("mediaLayout",doc.mediaLayout||{photoCount:3});
  replaceObject("advisorReview",doc.advisorReview||{});
  replaceObject("interviewPractice",doc.interviewPractice||{});
  existing.exportRecords=clone(doc.exportRecords||[]);
  existing.timelineArtifacts=clone(doc.timelineArtifacts||[]);
  replaceObject("fileVault",doc.fileVault||{});
  replaceObject("persistence",doc.persistence||{});
  replaceObject("recovery",doc.recovery||{});
  replaceObject("migrationMetadata",doc.migrationMetadata||{history:[]});
  replaceObject("retention",doc.retention||{});
  replaceObject("releaseCandidate",doc.releaseCandidate||{});
  api.state.__409=existing;
  api.state.timelineTitle=doc.title||`Timeline: ${api.state.profile.name}`;
  api.state.photoN=doc.mediaLayout?.photoCount||3;
  api.state.saved=true;
  return doc;
}
