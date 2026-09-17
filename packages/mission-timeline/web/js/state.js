import {clone} from "./timeline-engine.js";

export function createTimelineDocumentFromLegacy(legacyState,categories){
  const source=legacyState.mode==="demo"?legacyState.demo:legacyState.user;
  const ingestion=clone(legacyState.__408Ingestion||{
    schemaVersion:"d1-ingestion-408.1",
    sourceDocuments:[],
    documentPages:[],
    sourceBlocks:[],
    extractionCandidates:[],
    candidateDuplicateGroups:[],
    candidateConflicts:[],
    humanReviewActions:[],
    timelineEventSourceLinks:[]
  });
  const doc={
    schemaVersion:"d1-timeline-document-408.1",
    id:"d1-sandbox-doc",
    title:legacyState.timelineTitle||`Timeline: ${legacyState.profile.name}`,
    studentProfile:{
      name:legacyState.profile.name,
      specialtyGoal:legacyState.profile.goal,
      medicalSchool:"",
      medicalSchoolCountry:legacyState.profile.country,
      graduationDate:legacyState.wiz?.grad||"",
      visaStatus:legacyState.profile.visa,
      scores:{step1:legacyState.profile.s1,step2ck:legacyState.profile.s2},
      languages:[],
      hobbies:"",
      summary:"",
      profilePhoto:legacyState.media.avatar?"avatar-demo":null
    },
    events:(source.events||[]).map((event)=>({
      id:event.id,
      title:event.t||"",
      categoryId:event.cat,
      eventType:event.mile?"milestone":"duration",
      startDate:event.s||"",
      endDate:event.mile?null:(event.e||""),
      siteName:event.loc||"",
      location:event.loc||"",
      lane:event.lane==null?null:event.lane,
      visibility:event.vis||"public",
      visibilityState:event.visibilityState||({public:"INTERVIEWER_SAFE",full:"FULL_STORY",advisor:"ADVISOR_ONLY",student:"STUDENT_ONLY",hidden:"HIDDEN"}[event.vis]||"ADVISOR_ONLY"),
      advisorOnly:event.vis==="advisor",
      interviewSafe:(event.visibilityState||event.vis)==="INTERVIEWER_SAFE"||event.vis==="public",
      sourceType:event.origin||event.src||"manual",
      provenance:event.provenance?clone(event.provenance):(event.src||event.origin||"manual"),
      confidence:event.confidence||null,
      canonicalType:event.canonicalType||null,
      sourceCandidateId:event.sourceCandidateId||null,
      sourceDocumentIds:clone(event.sourceDocumentIds||[]),
      datePrecision:clone(event.datePrecision||null),
      humanCorrection:clone(event.humanCorrection||null),
      notes:event.notes||"",
      manualOffset:event.manualOffset||null,
      mediaId:event.mediaId||null
    })),
    categories:Object.keys(categories).map((id)=>({
      id,
      label:categories[id].n,
      color:categories[id].c,
      canonicalRole:id,
      editable:true
    })),
    media:[
      ...Object.keys(legacyState.media.photos||{}).filter((k)=>legacyState.media.photos[k]).map((k)=>({id:`photo-${k}`,type:"photo",label:`Photo ${Number(k)+1}`,src:null,placement:`photo${k}`,visibility:"public"})),
      ...(legacyState.media.logo?[{id:"program-logo",type:"logo",label:"Program logo",src:null,placement:"ribbon",visibility:"public"}]:[]),
      ...(legacyState.media.avatar?[{id:"profile-avatar",type:"profilePhoto",label:"Profile avatar",src:null,placement:"profile",visibility:"advisor"}]:[])
    ],
    theme:legacyState.canvasTheme,
    visibilityMode:legacyState.safe?"interviewSafe":"fullStory",
    advisorReview:{
      approved:legacyState.approved,
      changesRequested:legacyState.changes,
      checklist:(legacyState.checks||[]).map((check,index)=>({id:`check-${index+1}`,label:check.t,complete:!!check.on})),
      comments:clone(legacyState.comments||[])
    },
    versions:clone(legacyState.__407Versions||[]),
    sourceDocuments:clone(ingestion.sourceDocuments||[]),
    documentPages:clone(ingestion.documentPages||[]),
    sourceBlocks:clone(ingestion.sourceBlocks||[]),
    extractionCandidates:clone(ingestion.extractionCandidates||[]),
    candidateDuplicateGroups:clone(ingestion.candidateDuplicateGroups||[]),
    candidateConflicts:clone(ingestion.candidateConflicts||[]),
    humanReviewActions:clone(ingestion.humanReviewActions||[]),
    timelineEventSourceLinks:clone(ingestion.timelineEventSourceLinks||[]),
    ingestion:{
      schemaVersion:ingestion.schemaVersion||"d1-ingestion-408.1",
      parserVersion:ingestion.parserVersion||"408.1.0",
      status:ingestion.status||"NO_DOCUMENT",
      activeDocumentId:ingestion.activeDocumentId||null,
      updatedAt:ingestion.updatedAt||null
    },
    metadata:{
      source:"app_demo_401_408",
      createdAt:"2026-07-10",
      updatedAt:new Date().toISOString(),
      sandboxOnly:true
    }
  };
  return doc;
}

export function createLegacySnapshot(legacyState){
  return clone({
    profile:legacyState.profile,
    user:legacyState.user,
    demo:legacyState.demo,
    media:legacyState.media,
    mode:legacyState.mode,
    safe:legacyState.safe,
    canvasTheme:legacyState.canvasTheme,
    draft:legacyState.draft,
    checks:legacyState.checks,
    approved:legacyState.approved,
    changes:legacyState.changes,
    __408Ingestion:legacyState.__408Ingestion,
    categories:null
  });
}

export function restoreLegacySnapshot(legacyState,snapshot,categories,targetCategories){
  Object.assign(legacyState.profile,clone(snapshot.profile||{}));
  legacyState.user=clone(snapshot.user||{events:[],interview:{}});
  legacyState.demo=clone(snapshot.demo||legacyState.demo);
  legacyState.media=clone(snapshot.media||{photos:{},logo:false,avatar:false});
  legacyState.mode=snapshot.mode||"blank";
  legacyState.safe=!!snapshot.safe;
  legacyState.canvasTheme=snapshot.canvasTheme||"keynote";
  legacyState.draft=snapshot.draft||legacyState.draft;
  legacyState.checks=clone(snapshot.checks||legacyState.checks);
  legacyState.approved=!!snapshot.approved;
  legacyState.changes=!!snapshot.changes;
  legacyState.__408Ingestion=clone(snapshot.__408Ingestion||legacyState.__408Ingestion||null);
  if(categories&&targetCategories){
    Object.keys(categories).forEach((id)=>{
      if(targetCategories[id]){
        targetCategories[id].n=categories[id].n;
        targetCategories[id].c=categories[id].c;
      }
    });
  }
}

export function createVersionRecord(label,document,legacyState,categories){
  return {
    id:`v-${Date.now()}-${Math.round(Math.random()*1000)}`,
    createdAt:new Date().toISOString(),
    label,
    documentSnapshot:clone(document),
    legacySnapshot:createLegacySnapshot(legacyState),
    categorySnapshot:clone(categories),
    changeSummary:label
  };
}
