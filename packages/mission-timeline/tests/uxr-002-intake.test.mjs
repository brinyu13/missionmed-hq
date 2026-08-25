import assert from "node:assert/strict";
import test from "node:test";

import {
  CATEGORY_REVIEW_FIELDS,
  DOCUMENT_TYPES,
  EXTRACTION_STATUSES,
  INTAKE_COPY,
  INTAKE_STAGES,
  IntakeStateMachine,
  MAX_DOCUMENT_BYTES,
  acceptedCount,
  applyApprovalBatchToDocument,
  buildApprovalBatch,
  createIntakeState,
  detectDocumentType,
  filteredCandidates,
  findDuplicate,
  hydrateIntakeState,
  installIntake,
  intakeCapabilityMetadata,
  monthOverlapRatio,
  renderIntake,
  titleSimilarity,
  transitionIntake,
  validateCandidateForApproval,
  validateIntakeFile
} from "../web/js/uxr-002/intake.js";

const fixedClock=()=>new Date("2026-07-29T16:00:00.000Z");

function pdf(name="Synthetic_CV.pdf",size=1024){
  return{name,type:"application/pdf",size,lastModified:1};
}

function docx(name="Synthetic_CV.docx",size=1024){
  return{name,type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",size,lastModified:1};
}

function rescueFile(name="Synthetic_Timeline.pptx",type="application/vnd.openxmlformats-officedocument.presentationml.presentation",size=1024){
  return{name,type,size,lastModified:1,timelineRescue:true};
}

function candidate(overrides={}){
  return{
    id:"candidate-1",
    categoryId:"research",
    title:"Research assistant",
    startDate:"2022-01",
    endDate:"2022-06",
    eventType:"duration",
    confidence:"high",
    sourceSnippet:"Research assistant from January through June.",
    fields:{institution:"Example University"},
    ...overrides
  };
}

async function extractedMachine({
  candidates=[candidate()],
  existingEvents=[],
  adapterCapability={mode:"local-test-adapter",productionReady:false,simulated:true,source:"synthetic-test"}
}={}){
  const adapter={
    capability:adapterCapability,
    async extract(){return{readable:true,candidates};}
  };
  const machine=new IntakeStateMachine({
    adapter,
    existingEvents,
    clock:fixedClock,
    idFactory:(prefix)=>`${prefix}-generated`
  });
  machine.receiveFile(pdf());
  machine.setConsent(true);
  await machine.startExtraction();
  return machine;
}

test("file validation accepts PDF/DOCX through 20 MiB and preserves the frozen error",()=>{
  assert.deepEqual(validateIntakeFile(pdf("Timeline.PDF",MAX_DOCUMENT_BYTES)).valid,true);
  assert.deepEqual(validateIntakeFile(docx()).valid,true);
  assert.equal(validateIntakeFile(pdf("too-large.pdf",MAX_DOCUMENT_BYTES+1)).error,"PDF or DOCX, up to 20MB.");
  assert.equal(validateIntakeFile({name:"notes.txt",type:"text/plain",size:10}).error,INTAKE_COPY.fileError);
  assert.equal(validateIntakeFile({name:"spoofed.pdf",type:"text/plain",size:10}).valid,false);
  assert.equal(validateIntakeFile({name:"mismatch.pdf",type:docx().type,size:10}).valid,false);
  assert.equal(detectDocumentType(pdf("MyERAS_export.pdf")),"MyERAS export");
  assert.equal(detectDocumentType(docx("résumé.docx")),"Résumé");
  assert.deepEqual(DOCUMENT_TYPES,["CV","MyERAS export","Résumé"]);
});

test("Timeline Rescue validation is explicit, bounded, and cannot widen ordinary CV intake",()=>{
  const pptx=rescueFile();
  assert.equal(validateIntakeFile(pptx).valid,true);
  assert.equal(validateIntakeFile(pptx).kind,"rescue-pptx");
  assert.equal(validateIntakeFile(pptx).metadata.timelineRescue,true);
  assert.equal(validateIntakeFile({...pptx,timelineRescue:false}).valid,false,"ordinary PPTX must remain outside CV intake");
  assert.equal(validateIntakeFile(rescueFile("synthetic.pdf","application/pdf")).kind,"rescue-pdf");
  assert.equal(validateIntakeFile(rescueFile("synthetic.png","image/png")).kind,"rescue-png");
  assert.equal(validateIntakeFile(rescueFile("synthetic.jpg","image/jpeg")).kind,"rescue-jpeg");
  assert.equal(validateIntakeFile(rescueFile("synthetic.key","application/x-iwork-keynote-sffkey")).valid,false);
  assert.equal(validateIntakeFile(rescueFile("synthetic.txt","text/plain")).valid,false);
  assert.equal(validateIntakeFile(rescueFile("spoofed.pptx","text/plain")).valid,false);
  assert.equal(validateIntakeFile(rescueFile("too-large.pptx",pptx.type,MAX_DOCUMENT_BYTES+1)).error,INTAKE_COPY.rescueFileError);
  assert.equal(validateIntakeFile({...docx(),timelineRescue:true}).valid,false,"DOCX is not an Existing Timeline Rescue format");
});

test("the pure upload state gates extraction on both file and consent without mutating its input",()=>{
  const initial=createIntakeState();
  const before=structuredClone(initial);
  assert.throws(()=>transitionIntake(initial,{type:"START_EXTRACTION"}),/valid file and review consent/);
  assert.deepEqual(initial,before);

  const withFile=transitionIntake(initial,{type:"RECEIVE_FILE",file:pdf()});
  assert.equal(withFile.file.name,"Synthetic_CV.pdf");
  assert.equal(withFile.consent,false);
  assert.deepEqual(initial,before,"the reducer must not mutate the previous state");

  const uploadHtml=renderIntake(withFile);
  assert.match(uploadHtml,/>Add your document<\/h1>/);
  assert.match(uploadHtml,/stored privately.*approved AI processor.*Nothing appears on your timeline until you approve it\./);
  assert.match(uploadHtml,/I consent to secure AI-assisted extraction/);
  assert.match(uploadHtml,/data-intake-action="read" disabled>Read my document →<\/button>/);
  assert.match(uploadHtml,/Looks like: CV/);

  const consented=transitionIntake(withFile,{type:"SET_CONSENT",value:true});
  assert.doesNotMatch(renderIntake(consented),/data-intake-action="read" disabled/);
  assert.deepEqual(withFile.consent,false);
});

test("extraction is adapter-backed, truthfully described, and rotates only the frozen status sequence",async()=>{
  const unavailable=intakeCapabilityMetadata(null);
  assert.equal(unavailable.adapterAvailable,false);
  assert.equal(unavailable.productionReady,false);
  assert.equal(unavailable.bundledExtractor,false);
  assert.equal(unavailable.bundledFixtures,false);
  assert.equal(unavailable.moduleNetworkCalls,false);
  assert.equal(unavailable.timelineWritesBeforeApproval,false);
  assert.equal(intakeCapabilityMetadata({
    extract(){},
    capability:{productionReady:true,simulated:true}
  }).productionReady,false,"a simulated adapter must never be advertised as production-ready");

  const noAdapter=new IntakeStateMachine();
  noAdapter.receiveFile(pdf());
  noAdapter.setConsent(true);
  await assert.rejects(()=>noAdapter.startExtraction(),error=>error.code==="INTAKE_EXTRACTION_ADAPTER_REQUIRED");
  assert.equal(noAdapter.state.stage,INTAKE_STAGES.UPLOAD);

  let release;
  let received;
  const adapter={
    capability:{mode:"test-double",productionReady:false,simulated:true,source:"synthetic-test"},
    extract(input){
      received=input;
      return new Promise((resolve)=>{release=resolve;});
    }
  };
  const machine=new IntakeStateMachine({adapter});
  const rawFile=pdf("Adapter_contract.pdf");
  machine.receiveFile(rawFile);
  machine.setConsent(true);
  const pending=machine.startExtraction();
  assert.equal(machine.state.stage,INTAKE_STAGES.EXTRACTION);
  assert.equal(received.file,rawFile);
  assert.equal(received.metadata.name,rawFile.name);
  assert.equal(received.documentType,"CV");
  assert.equal(received.signal.aborted,false);
  assert.deepEqual(EXTRACTION_STATUSES,["Finding dates…","Matching institutions…","Sorting your story…"]);
  assert.match(renderIntake(machine.state),/Finding dates…/);
  machine.rotateStatus();
  assert.match(renderIntake(machine.state),/Matching institutions…/);
  machine.rotateStatus();
  assert.match(renderIntake(machine.state),/Sorting your story…/);
  machine.rotateStatus();
  assert.match(renderIntake(machine.state),/Finding dates…/);

  release({readable:true,candidates:[candidate()]});
  await pending;
  assert.equal(machine.state.stage,INTAKE_STAGES.REVIEW);
  assert.equal(machine.capability().mode,"test-double");
  assert.equal(machine.capability().productionReady,false);
  assert.equal(machine.capability().simulated,true);
});

test("unreadable and zero-candidate adapter outcomes render the exact frozen failure cards",async()=>{
  const unreadable=new IntakeStateMachine({adapter:{async extract(){return{readable:false,candidates:[]};}}});
  unreadable.receiveFile(pdf("scan.pdf"));
  unreadable.setConsent(true);
  await unreadable.startExtraction();
  const unreadableHtml=renderIntake(unreadable.state);
  assert.match(unreadableHtml,/We couldn't read text in this document\. If it's a scan, export a text PDF from MyERAS or your CV app and try again\./);
  assert.match(unreadableHtml,/>Try another file<\/button>/);
  assert.match(unreadableHtml,/>Use the guided builder instead<\/button>/);

  const empty=new IntakeStateMachine({adapter:{async extract(){return{readable:true,candidates:[]};}}});
  empty.receiveFile(docx("readable.docx"));
  empty.setConsent(true);
  await empty.startExtraction();
  assert.match(renderIntake(empty.state),/We read it, but didn't find dated events we're confident about\. The guided builder takes about 10 minutes\./);
  assert.equal(empty.state.candidates.length,0);
});

test("duplicate detection requires category, at least half-span overlap, and similar title",()=>{
  const existing={
    id:"existing-research",
    categoryId:"research",
    title:"Research assistant at Example University",
    startDate:"2022-01",
    endDate:"2022-12"
  };
  const overlap=candidate({startDate:"2022-04",endDate:"2022-09"});
  assert.equal(monthOverlapRatio(existing,overlap),1);
  assert.ok(titleSimilarity(existing.title,overlap.title)>=.5);
  const duplicate=findDuplicate(overlap,[existing]);
  assert.equal(duplicate.eventId,"existing-research");
  assert.ok(duplicate.overlapRatio>=.5);
  assert.ok(duplicate.titleSimilarity>=.5);

  assert.equal(findDuplicate({...overlap,categoryId:"work"},[existing]),null,"category must match");
  assert.equal(findDuplicate({...overlap,startDate:"2024-01",endDate:"2024-06"},[existing]),null,"dates must overlap");
  assert.equal(findDuplicate({...overlap,title:"Unrelated community service"},[existing]),null,"titles must be similar");
});

test("review supports filtering, inline edits, high-confidence acceptance, and explicit duplicate choices",async()=>{
  const existing=[{
    id:"existing-research",
    categoryId:"research",
    title:"Research assistant at Example University",
    startDate:"2022-01",
    endDate:"2022-12",
    eventType:"duration",
    notes:"",
    provenance:[]
  }];
  const machine=await extractedMachine({
    existingEvents:existing,
    candidates:[
      candidate({id:"duplicate-high",title:"Research assistant at Example University"}),
      candidate({id:"safe-high",categoryId:"work",title:"Clinical coordinator",confidence:"high"}),
      candidate({id:"manual-low",categoryId:"personal",title:"Move",confidence:"low",startDate:"2021-01",endDate:null,eventType:"milestone"})
    ]
  });
  assert.equal(machine.state.candidates[0].duplicate.eventId,"existing-research");
  machine.toggleEdit("duplicate-high");
  const expanded=renderIntake(machine.state);
  assert.match(expanded,/data-month-field="intake-duplicate-high-startDate"/);
  assert.match(expanded,/>Publication status <select/);
  assert.match(expanded,/>Journal \/ venue <input/);
  assert.match(expanded,/>Author position <select/);
  assert.deepEqual(CATEGORY_REVIEW_FIELDS.research.map(({label})=>label),[
    "Institution / lab",
    "Role",
    "Role (other)",
    "Ongoing",
    "Publication status",
    "Journal / venue",
    "Publication year",
    "Author position",
    "DOI or PMID (optional)",
    "Mark the publication on the timeline"
  ]);
  machine.toggleEdit("duplicate-high");
  assert.throws(()=>machine.decideCandidate("duplicate-high","accepted"),/Merge or Add anyway/);

  machine.acceptAllHighConfidence();
  assert.equal(machine.state.candidates.find(({id})=>id==="duplicate-high").decision,"undecided");
  assert.equal(machine.state.candidates.find(({id})=>id==="safe-high").decision,"accepted");

  machine.editCandidate("manual-low",{title:"Moved for family",fields:{location:"Example City"}});
  machine.decideCandidate("manual-low","rejected");
  machine.decideCandidate("duplicate-high","merge");
  machine.setFilter("accepted");
  assert.deepEqual(filteredCandidates(machine.state).map(({id})=>id),["duplicate-high","safe-high"]);
  assert.equal(acceptedCount(machine.state),2);

  const html=renderIntake(machine.state);
  assert.match(html,/Review 3 suggestions/);
  assert.match(html,/Accept what's right, fix what's close, reject what's wrong\. Nothing lands until you decide\./);
  assert.match(html,/3 of 3 decided/);
  assert.match(html,/Add 2 accepted events to my timeline →/);

  machine.decideCandidate("duplicate-high","undecided");
  machine.setFilter("all");
  const duplicateHtml=renderIntake(machine.state);
  assert.match(duplicateHtml,/Looks like a duplicate of 'Research assistant at Example University'/);
  assert.match(duplicateHtml,/>Merge<\/button>/);
  assert.match(duplicateHtml,/>Add anyway<\/button>/);
  assert.match(duplicateHtml,/class="confidence-tag success">High<\/span>/);
  assert.match(duplicateHtml,/“Research assistant from January through June\.”/);
});

test("an explicit reviewed end month closes false-like imported ongoing fields",async()=>{
  const machine=await extractedMachine({candidates:[candidate({
    id:"reviewed-observership",
    categoryId:"clinical",
    title:"Internal Medicine Observership",
    startDate:"2024-01",
    endDate:null,
    openEnded:true,
    confidence:"low",
    fields:{currentlyOnRotation:false,stillWorking:"false",ongoing:"false"}
  })]});

  machine.editCandidate("reviewed-observership",{endDate:"2024-03"});
  const reviewed=machine.state.candidates[0];
  assert.equal(reviewed.endDate,"2024-03");
  assert.equal(reviewed.openEnded,false);
  assert.equal(reviewed.fields.currentlyOnRotation,false);
  assert.equal(reviewed.fields.stillWorking,false);
  assert.equal(reviewed.fields.ongoing,false);

  machine.editCandidate("reviewed-observership",{fields:{currentlyOnRotation:true}});
  assert.equal(machine.state.candidates[0].openEnded,true);
  assert.equal(machine.state.candidates[0].endDate,null);
  machine.editCandidate("reviewed-observership",{fields:{currentlyOnRotation:false}});
  assert.equal(machine.state.candidates[0].openEnded,false,"clearing the visible ongoing control must restore end-date review");
});

test("zero timeline writes occur before one versioned approval callback applies one undo batch",async()=>{
  const document={
    events:[{
      id:"existing-research",
      categoryId:"research",
      title:"Research assistant at Example University",
      eventType:"duration",
      startDate:"2022-03",
      endDate:"2022-08",
      openEnded:false,
      notes:"Existing note",
      provenance:[]
    }],
    intake:{stage:null,candidates:[]}
  };
  const original=structuredClone(document);
  const machine=await extractedMachine({
    existingEvents:document.events,
    candidates:[
      candidate({
        id:"duplicate",
        title:"Research assistant at Example University",
        startDate:"2022-01",
        endDate:"2022-12",
        sourceSnippet:"Imported research source."
      }),
      candidate({
        id:"new-work",
        categoryId:"work",
        title:"Clinical coordinator",
        startDate:"2023-01",
        endDate:"2023-09",
        sourceSnippet:"Imported work source."
      })
    ]
  });

  machine.decideCandidate("duplicate","merge");
  machine.decideCandidate("new-work","accepted");
  machine.editCandidate("new-work",{title:"Senior clinical coordinator"});
  machine.setFilter("accepted");
  assert.deepEqual(document,original,"review decisions and edits must not touch the timeline");

  const calls=[];
  let versionCount=0;
  let mutationCount=0;
  const result=await machine.approveAccepted({
    async saveVersion(name,kind){
      versionCount+=1;
      calls.push({type:"version",name,kind,snapshot:structuredClone(document)});
    },
    async applyBatch(batch,options){
      mutationCount+=1;
      calls.push({type:"mutation",batch:structuredClone(batch),options});
      return applyApprovalBatchToDocument(document,batch);
    }
  });

  assert.equal(versionCount,1);
  assert.equal(mutationCount,1);
  assert.deepEqual(calls.map(({type})=>type),["version","mutation"]);
  assert.equal(calls[0].name,"Before CV import · Jul 29, 2026");
  assert.equal(calls[0].kind,"automatic");
  assert.deepEqual(calls[0].snapshot,original,"the automatic version must capture the pre-import timeline");
  assert.deepEqual(calls[1].options,{label:"Add document suggestions",history:true,undoSteps:1});
  assert.deepEqual(result.batch.history,{required:true,undoSteps:1});
  assert.equal(result.batch.version.requiredBeforeMutation,true);
  assert.equal(document.events.length,2);
  assert.equal(document.events[0].startDate,"2022-01");
  assert.equal(document.events[0].endDate,"2022-12");
  assert.equal(document.events[0].notes,"Existing note\nImported research source.");
  assert.equal(document.events[1].title,"Senior clinical coordinator");
  assert.equal(document.intake.lastImport.acceptedCount,2);
  assert.equal(document.intake.lastImport.acceptedCandidates.length,2);
  assert.equal(document.intake.lastImport.acceptedCandidates[1].title,"Senior clinical coordinator");
  assert.equal(document.intake.lastImport.acceptedCandidates[0].decision,"merge");
  assert.equal(document.intake.lastImport.acceptedCandidates[1].decision,"accepted");
  assert.equal(machine.state.stage,INTAKE_STAGES.DONE);
  assert.equal(machine.state.approval.appliedCount,2);
  assert.match(renderIntake(machine.state),/Added 2 events from Synthetic_CV\.pdf\./);

  await assert.rejects(
    ()=>machine.approveAccepted({saveVersion:async()=>{},applyBatch:async()=>{}}),
    /already been applied/
  );
  assert.equal(versionCount,1);
  assert.equal(mutationCount,1);
});

test("trace-only File Vault custody survives review, approval, applied event provenance, and intake file audit",async()=>{
  const sourceCustody={
    schemaVersion:"timeline-source-custody-ref.1",
    authority:"TRACE_ONLY",
    provider:"missionmed-filevault-v2",
    timelineObjectId:"object-filevault-27",
    sha256:"c".repeat(64),
    vaultFileId:"27",
    versionId:"22222222-2222-4222-8222-222222222222"
  };
  const sourceDocument={
    id:"source-filevault-27",fileName:"Vault_CV.pdf",fileSize:1024,mimeType:"application/pdf",
    objectId:sourceCustody.timelineObjectId,sha256:sourceCustody.sha256,sourceCustody
  };
  const provenance={
    sourceDocumentId:sourceDocument.id,
    sourceObjectId:sourceCustody.timelineObjectId,
    sourceSha256:sourceCustody.sha256,
    sourceDocumentName:sourceDocument.fileName,
    sourceExcerpt:"Synthetic research role",
    sourceCustody
  };
  const machine=new IntakeStateMachine({
    adapter:{async extract(){return{
      readable:true,
      candidates:[candidate({id:"filevault-candidate",provenance:[provenance]})],
      sourceDocument
    };}},
    clock:fixedClock,
    idFactory:(prefix)=>`${prefix}-filevault`
  });
  machine.receiveFile(pdf(sourceDocument.fileName));
  machine.setConsent(true);
  await machine.startExtraction();
  assert.deepEqual(machine.state.extraction.sourceDocument.sourceCustody,sourceCustody);
  assert.deepEqual(machine.state.file.sourceCustody,sourceCustody);
  assert.deepEqual(machine.state.candidates[0].provenance[0].sourceCustody,sourceCustody);
  machine.decideCandidate("filevault-candidate","accepted");
  const document={events:[],intake:{}};
  const result=await machine.approveAccepted({
    async saveVersion(){},
    async applyBatch(batch){return applyApprovalBatchToDocument(document,batch);}
  });
  assert.deepEqual(result.batch.sourceDocument.sourceCustody,sourceCustody);
  assert.deepEqual(result.batch.additions[0].provenance[0].sourceCustody,sourceCustody);
  assert.deepEqual(result.batch.acceptedCandidates[0].provenance[0].sourceCustody,sourceCustody);
  assert.deepEqual(document.events[0].provenance[0].sourceCustody,sourceCustody);
  assert.equal(document.events[0].provenance[0].sourceObjectId,sourceCustody.timelineObjectId);
  assert.equal(document.events[0].provenance[0].sourceSha256,sourceCustody.sha256);
  assert.deepEqual(document.intake.file.sourceCustody,sourceCustody);
  assert.equal(document.intake.file.sourceCustody.authority,"TRACE_ONLY");
});

test("a failed approval never writes, and retry reuses the already-created pre-import version",async()=>{
  const document={events:[],intake:{}};
  const machine=await extractedMachine({
    candidates:[candidate({categoryId:"work",title:"Synthetic role"})]
  });
  machine.decideCandidate("candidate-1","accepted");
  let versions=0;
  let failedMutations=0;
  await assert.rejects(()=>machine.approveAccepted({
    async saveVersion(){versions+=1;},
    async applyBatch(){
      failedMutations+=1;
      throw Object.assign(new Error("Injected storage failure"),{code:"INJECTED_FAILURE"});
    }
  }),/Injected storage failure/);
  assert.equal(versions,1);
  assert.equal(failedMutations,1);
  assert.equal(document.events.length,0);
  assert.equal(machine.state.stage,INTAKE_STAGES.REVIEW);
  assert.equal(machine.state.approval.versionSaved,true);

  let successfulMutations=0;
  await machine.approveAccepted({
    async saveVersion(){versions+=1;},
    async applyBatch(batch){
      successfulMutations+=1;
      return applyApprovalBatchToDocument(document,batch);
    }
  });
  assert.equal(versions,1,"retry must not create a duplicate automatic version");
  assert.equal(successfulMutations,1);
  assert.equal(document.events.length,1);
});

test("cancel confirmation, discard, Done actions, deletion, and preview all remain quarantined",async()=>{
  const machine=await extractedMachine();
  const request=machine.requestCancel();
  assert.equal(request.requiresConfirmation,true);
  assert.deepEqual(request.dialog,{
    title:"Discard these suggestions?",
    body:"You haven't approved any of the 1 suggested events. They'll be deleted.",
    primaryLabel:"Keep reviewing",
    secondaryLabel:"Discard",
    destructiveLabel:"Discard"
  });
  assert.equal(machine.state.stage,INTAKE_STAGES.REVIEW);
  machine.confirmDiscard();
  assert.equal(machine.state.stage,INTAKE_STAGES.UPLOAD);
  assert.equal(machine.state.candidates.length,0);

  const done=await extractedMachine();
  done.decideCandidate("candidate-1","accepted");
  await done.approveAccepted({
    async saveVersion(){},
    async applyBatch(batch){return{appliedCount:batch.acceptedCount};}
  });
  const previewCalls=[];
  const review=await extractedMachine();
  review.decideCandidate("candidate-1","accepted");
  renderIntake(review.state,{renderPreview(events,metadata){previewCalls.push({events,metadata});return"<div>Canonical preview</div>";}});
  assert.equal(previewCalls.length,1);
  assert.equal(previewCalls[0].events.length,1);
  assert.equal(previewCalls[0].metadata.pending,true);

  const deleted=[];
  assert.equal((await done.deleteDocument(async(file)=>deleted.push(file.name))).deleted,true);
  assert.deepEqual(deleted,["Synthetic_CV.pdf"]);
  assert.equal(done.state.sourceDeleted,true);
  assert.equal(done.state.file,null);
  assert.match(renderIntake(done.state),/Added 1 events from Synthetic_CV\.pdf\./);
});

test("installIntake delegates state actions, records rejected AI decisions, and cleans up every installed listener",async()=>{
  const state=hydrateIntakeState({
    stage:INTAKE_STAGES.REVIEW,
    file:validateIntakeFile(pdf()).metadata,
    candidates:[candidate()],
    filter:"all"
  });
  assert.equal(state.progressIndex,2);
  assert.equal(state.approval.applied,false);
  assert.equal(state.candidates[0].confidence,"high");
  const machine=new IntakeStateMachine({initialState:state});
  const listeners=new Map();
  const removals=[];
  const root={
    addEventListener(type,listener){listeners.set(type,listener);},
    removeEventListener(type,listener){
      removals.push(type);
      assert.equal(listeners.get(type),listener);
    }
  };
  const changes=[];
  const rejected=[];
  const cleanup=installIntake(root,machine,{
    onChange:(value)=>changes.push(value),
    onCandidateDecision:(value)=>rejected.push(value)
  });
  assert.deepEqual([...listeners.keys()],["click","change","dragover","drop"]);
  const target={
    dataset:{intakeAction:"accept-high"},
    closest(selector){return selector==="[data-intake-action]"?this:null;}
  };
  await listeners.get("click")({target});
  assert.equal(machine.state.candidates[0].decision,"accepted");
  const rejectedTarget={
    dataset:{candidateId:"candidate-1",candidateAction:"rejected"},
    closest(selector){return selector==="[data-candidate-action]"?this:null;}
  };
  await listeners.get("click")({target:rejectedTarget});
  assert.equal(rejected.length,1);
  assert.equal(rejected[0].candidate.decision,"rejected");
  assert.ok(changes.length>=2);
  cleanup();
  assert.deepEqual(removals,["click","change","dragover","drop"]);
});

test("Accept commits the reviewed title visible in the card even when the input has not blurred",async()=>{
  const state=hydrateIntakeState({
    stage:INTAKE_STAGES.REVIEW,
    file:validateIntakeFile(pdf()).metadata,
    candidates:[candidate({id:"observership",categoryId:"work",title:"Internal Medicine Observership — January 2024 to March"})],
    filter:"all"
  });
  const machine=new IntakeStateMachine({initialState:state});
  const listeners=new Map();
  const root={
    addEventListener(type,listener){listeners.set(type,listener);},
    removeEventListener(){}
  };
  const card={
    dataset:{candidateCard:"observership"},
    querySelectorAll(){return[
      {type:"text",value:"Internal Medicine Observership",dataset:{candidateField:"title"}},
      {type:"text",value:"Lakeside Community Hospital",dataset:{candidateExtra:"employer"}},
      {type:"text",value:"",dataset:{candidateExtra:"employer"}}
    ];}
  };
  const target={
    dataset:{candidateId:"observership",candidateAction:"accepted"},
    closest(selector){
      if(selector==="[data-candidate-action]")return this;
      if(selector==="[data-candidate-card]")return card;
      return null;
    }
  };
  const cleanup=installIntake(root,machine);
  await listeners.get("click")({target});
  assert.equal(machine.state.candidates[0].title,"Internal Medicine Observership");
  const batch=buildApprovalBatch(machine.state,[],{idFactory:()=>"event-observership",clock:fixedClock});
  assert.equal(batch.additions[0].title,"Internal Medicine Observership");
  assert.equal(batch.additions[0].fields.employer,"Lakeside Community Hospital");
  cleanup();
});

test("buildApprovalBatch keeps undecided suggestions and gives Add anyway a new event",async()=>{
  const existing=[{
    id:"existing-research",
    categoryId:"research",
    title:"Research assistant",
    startDate:"2022-01",
    endDate:"2022-06",
    eventType:"duration",
    notes:"",
    provenance:[]
  }];
  const machine=await extractedMachine({
    existingEvents:existing,
    candidates:[
      candidate({id:"duplicate"}),
      candidate({id:"undecided",categoryId:"personal",title:"Synthetic move",confidence:"low"})
    ]
  });
  machine.decideCandidate("duplicate","add-anyway");
  const batch=buildApprovalBatch(machine.state,existing,{idFactory:()=> "new-event",clock:fixedClock});
  assert.equal(batch.addedCount,1);
  assert.equal(batch.mergedCount,0);
  assert.equal(batch.additions[0].id,"new-event");
  assert.equal(batch.remainingCandidates.length,1);
  assert.equal(batch.remainingCandidates[0].id,"undecided");
  assert.equal(batch.version.name,"Before CV import · Jul 29, 2026");

  assert.deepEqual(validateCandidateForApproval({title:"",categoryId:"work",startDate:"bad",endDate:"2021-01"}),{
    title:"Required.",
    startDate:"Enter a month and year, like 'Jun 2023'."
  });
  assert.equal(validateCandidateForApproval({title:"Unclassified",categoryId:"",startDate:"2021-01"}).categoryId,"Choose a category.");
  const invalid=await extractedMachine({candidates:[candidate({startDate:""})]});
  invalid.decideCandidate("candidate-1","accepted");
  assert.throws(
    ()=>buildApprovalBatch(invalid.state,[],{idFactory:()=> "invalid",clock:fixedClock}),
    error=>Boolean(error.code==="INTAKE_ACCEPTED_CANDIDATE_INVALID"&&error.candidates[0].errors.startDate)
  );

  const atomicDocument={events:structuredClone(existing),intake:{stage:"review"}};
  const before=structuredClone(atomicDocument);
  const invalidBatch=structuredClone(batch);
  invalidBatch.merges=[{eventId:"missing",patch:{notes:"must not leak"}}];
  assert.throws(()=>applyApprovalBatchToDocument(atomicDocument,invalidBatch),/Merge target missing is unavailable/);
  assert.deepEqual(atomicDocument,before,"a rejected batch must not partially mutate the timeline");
});
