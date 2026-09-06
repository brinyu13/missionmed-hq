import {AdvisorReviewManager,createAdvisorReview,normalizeAdvisorReview} from "./advisor/advisor-manager.js";
import {createTimelineArtifact,migrateTimelineArtifact,validateTimelineArtifact} from "./artifacts/timeline-artifact.js";
import {sha256Hex} from "./core/canonical.js";
import {ExportEngine,sanitizeDocumentForExport} from "./export/export-engine.js";
import {eventsForScope,mediaForScope} from "./export/timeline-canvas-renderer.js";
import {LegacyFileVaultAdapter} from "./filevault/legacy-adapter.js";
import {FileVaultBridge,FILEVAULT_MODES} from "./filevault/bridge.js";
import {FileVaultV2Adapter} from "./filevault/v2-adapter.js";
import {legacyCapabilities,v2Capabilities} from "./filevault/capabilities.js";
import {MediaManager,validateMediaDescriptor} from "./media/media-manager.js";
import {migrateTimelineInput,TIMELINE_SCHEMA_409} from "./migrations/timeline-migrator.js";
import {applyTimelineDocument409,buildTimelineDocument409} from "./persistence/document-mapper.js";
import {TimelinePersistenceManager,persistenceFingerprint,versionDiff} from "./persistence/document-store.js";
import {IndexedDbAdapter} from "./persistence/indexeddb-adapter.js";
import {MemoryPersistenceAdapter} from "./persistence/memory-adapter.js";
import {install409Ui} from "./ui/product-409-ui.js";

export function createDefault409State(api){
  const state=api.state.__409||{};
  state.schemaVersion=TIMELINE_SCHEMA_409;
  state.activeDocumentId=state.activeDocumentId||"d1-sandbox-doc";
  state.mediaItems=state.mediaItems||[];
  state.mediaLayout=state.mediaLayout||{photoCount:api.state.photoN||3};
  state.advisorReview=state.advisorReview?.schemaVersion?state.advisorReview:createAdvisorReview();
  state.interviewPractice=state.interviewPractice||{questions:[],responses:[],updatedAt:null};
  state.exportRecords=state.exportRecords||[];
  state.timelineArtifacts=state.timelineArtifacts||[];
  state.fileVault=state.fileVault||{mode:FILEVAULT_MODES.DISABLED,status:"NOT_CONNECTED",links:[],syncHistory:[],mockOnly:true};
  state.persistence=state.persistence||{dirty:false,autosaveEnabled:true,activeDocumentId:state.activeDocumentId,draftName:"Mission Timeline Draft",archived:false};
  state.recovery=state.recovery||{available:false,lastCheckpointAt:null,lastRecoveryAt:null};
  state.migrationMetadata=state.migrationMetadata||{history:[]};
  state.retention=state.retention||{
    rawPdfBytes:"NOT_RETAINED_AFTER_LOCAL_PARSE",
    extractedPageText:"LOCAL_UNTIL_USER_PURGES",
    provenanceExcerpts:"MINIMUM_REQUIRED",
    generatedTimeline:"LOCAL_UNTIL_USER_DELETES",
    uploadedMedia:"LOCAL_UNTIL_USER_DELETES",
    exportedArtifacts:"LOCAL_UNTIL_USER_DELETES",
    cloudRetention:"NONE_IN_D1_409"
  };
  api.state.__409=state;
  return state;
}

function synchronizeLegacySurface(api,state,advisor){
  const review=advisor.state;
  api.state.approved=advisor.exportGate("interviewerSafe")&&advisor.exportGate("export");
  api.state.changes=review.status==="CHANGES_REQUESTED"||review.status==="NEEDS_REREVIEW";
  api.state.photoN=state.mediaLayout.photoCount||3;
  api.state.media=api.state.media||{photos:{},logo:false,avatar:false};
  api.state.media.photos={};
  state.mediaItems.filter((item)=>/^photo\d+$/.test(item.placement||"")).forEach((item)=>{api.state.media.photos[Number(item.placement.slice(5))]=true;});
  api.state.media.logo=state.mediaItems.some((item)=>item.type==="logo"||item.type==="programLogo");
  api.state.media.avatar=state.mediaItems.some((item)=>item.type==="profilePhoto");
  api.state.comments=review.comments.slice(0,3).map((comment,index)=>({n:index+1,ts:(comment.authorRole||"ADVISOR")+" COMMENT",b:comment.body}));
}

export async function install409Foundation(api,{adapter=null,autosaveDelay=650}={}){
  if(!api)throw new Error("406A compatibility API missing; cannot install D1-409.");
  const state=createDefault409State(api);
  const persistenceAdapter=adapter||window.D1_PERSISTENCE_ADAPTER||new IndexedDbAdapter();
  const advisor=new AdvisorReviewManager(state);
  const media=new MediaManager(state,persistenceAdapter);
  const legacy=new LegacyFileVaultAdapter();
  const v2=new FileVaultV2Adapter();
  const bridge=new FileVaultBridge({legacy,v2,state:state.fileVault});
  const documentProvider=()=>buildTimelineDocument409(api,state);
  const applyDocument=(document)=>{applyTimelineDocument409(api,document);state.advisorReview=normalizeAdvisorReview(state.advisorReview);advisor.state=state.advisorReview;bridge.state=state.fileVault;synchronizeLegacySurface(api,state,advisor);};
  const persistence=new TimelinePersistenceManager({adapter:persistenceAdapter,state,documentProvider,applyDocument,advisorManager:advisor,autosaveDelay});
  const exportEngine=new ExportEngine({adapter:persistenceAdapter,mediaManager:media,advisorManager:advisor,state,documentProvider,versionProvider:()=>state.persistence.lastVersionId||"working"});
  const context={api,state,adapter:persistenceAdapter,persistence,media,advisor,exportEngine,bridge,legacy,v2,documentProvider,applyDocument};
  const ui=install409Ui(context);
  context.ui=ui;

  const hardening=window.D1_407_HARDENING=window.D1_407_HARDENING||{};
  const previousBefore=hardening.beforeRenderAll;
  const previousAfter=hardening.afterRenderAll;
  hardening.beforeRenderAll=()=>{synchronizeLegacySurface(api,state,advisor);previousBefore?.();};
  hardening.afterRenderAll=()=>{previousAfter?.();ui.render();persistence.observe().catch((error)=>ui.reportError(error));};

  const initialized=await persistence.initialize();
  const materialFingerprint=await sha256Hex(AdvisorReviewManager.fingerprintInput(documentProvider()));
  advisor.checkMaterialChange(materialFingerprint);
  if(!initialized.restored)await persistence.saveDraft({reason:"INITIAL_DURABLE_DRAFT"});
  synchronizeLegacySurface(api,state,advisor);
  persistence.subscribe(()=>ui.renderStatus());
  api.renderAll();

  const testApi={
    version:"409.1",
    schemaVersion:TIMELINE_SCHEMA_409,
    ready:true,
    initialized,
    context,
    get state(){return state;},
    get document(){return documentProvider();},
    get productionRequestCount(){return bridge.productionRequestCount+legacy.networkRequestCount+v2.networkRequestCount;},
    saveDraft:(reason="TEST_SAVE")=>persistence.saveDraft({reason}),
    saveVersion:(label)=>persistence.saveVersion(label),
    listVersions:()=>persistence.listVersions(),
    restoreVersion:(id)=>persistence.restoreVersion(id),
    compareVersion:(id)=>persistence.compareVersion(id),
    duplicateDraft:(name)=>persistence.duplicateDraft(name),
    listDrafts:()=>persistence.listDrafts(),
    switchDraft:(id)=>persistence.switchDraft(id),
    previewDeleteDraft:(id)=>persistence.previewDeleteDraft(id),
    deleteDraft:(id,options)=>persistence.deleteDraft(id,options),
    importTimeline:(raw)=>persistence.importTimeline(raw),
    recoverLatest:()=>persistence.recoverLatest(),
    generatePng:(key,options)=>exportEngine.generatePng(key,options),
    generatePdf:(key,options)=>exportEngine.generatePdf(key,options),
    generateJson:(options)=>exportEngine.generateJson(options),
    generateArchive:(options)=>exportEngine.generateArchive(options),
    saveArtifactToMockVault:(artifact)=>bridge.saveArtifact(artifact),
    reconcileArtifact:(artifact)=>bridge.reconcile(artifact),
    pure:{migrateTimelineInput,migrateTimelineArtifact,validateTimelineArtifact,createTimelineArtifact,validateMediaDescriptor,eventsForScope,mediaForScope,sanitizeDocumentForExport,persistenceFingerprint,versionDiff,legacyCapabilities,v2Capabilities},
    classes:{MemoryPersistenceAdapter,IndexedDbAdapter,TimelinePersistenceManager,AdvisorReviewManager,MediaManager,ExportEngine,FileVaultBridge,LegacyFileVaultAdapter,FileVaultV2Adapter},
    modes:FILEVAULT_MODES
  };
  window.D1_409_TEST=testApi;
  window.D1_409_READY=true;

  const flush=()=>persistence.flush().catch(()=>{});
  window.addEventListener("beforeunload",()=>{flush();media.cleanup();});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")flush();});
  return testApi;
}
