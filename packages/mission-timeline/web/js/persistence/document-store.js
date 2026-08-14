import {clone,nowIso,sha256Hex,stableId,stableStringify} from "../core/canonical.js";
import {migrateTimelineInput,TIMELINE_SCHEMA_409} from "../migrations/timeline-migrator.js";
import {RecoveryManager} from "../recovery/recovery-manager.js";

function persistenceFingerprint(document){
  const value=clone(document);delete value.persistence;delete value.recovery;delete value.exportRecords;delete value.timelineArtifacts;if(value.metadata)delete value.metadata.updatedAt;
  return stableStringify(value);
}

function versionDiff(current,version){
  const before=version.documentSnapshot||{},after=current||{},byId=(items)=>new Map((items||[]).map((item)=>[item.id,item]));
  const oldEvents=byId(before.events),newEvents=byId(after.events),oldMedia=byId(before.mediaItems),newMedia=byId(after.mediaItems);
  return {versionId:version.id,label:version.label,eventsAdded:[...newEvents.keys()].filter((id)=>!oldEvents.has(id)),eventsRemoved:[...oldEvents.keys()].filter((id)=>!newEvents.has(id)),eventsChanged:[...newEvents.keys()].filter((id)=>oldEvents.has(id)&&stableStringify(oldEvents.get(id))!==stableStringify(newEvents.get(id))),mediaAdded:[...newMedia.keys()].filter((id)=>!oldMedia.has(id)),mediaRemoved:[...oldMedia.keys()].filter((id)=>!newMedia.has(id)),advisorCommentDelta:(after.advisorReview?.comments?.length||0)-(before.advisorReview?.comments?.length||0)};
}

export class TimelinePersistenceManager{
  constructor({adapter,state,documentProvider,applyDocument,advisorManager,autosaveDelay=450,clock=()=>new Date()}){
    this.adapter=adapter;this.state=state;this.documentProvider=documentProvider;this.applyDocument=applyDocument;this.advisorManager=advisorManager;this.autosaveDelay=autosaveDelay;this.clock=clock;this.recovery=new RecoveryManager(adapter);this.timer=null;this.sequence=0;this.lastObservedFingerprint=null;this.saving=null;this.listeners=new Set();
    state.persistence=state.persistence||{adapter:adapter.kind,dirty:false,autosaveEnabled:true,lastSavedAt:null,lastSaveError:null,saveSequence:0,activeDocumentId:state.activeDocumentId||"d1-sandbox-doc",draftName:"Mission Timeline Draft",archived:false};
    state.recovery=state.recovery||{available:false,lastCheckpointAt:null,lastRecoveryAt:null};state.migrationMetadata=state.migrationMetadata||{history:[]};
  }
  notify(){this.listeners.forEach((listener)=>listener(this.state.persistence));}
  subscribe(listener){this.listeners.add(listener);listener(this.state.persistence);return()=>this.listeners.delete(listener);}
  async initialize(){
    await this.adapter.open();const settings=await this.adapter.get("settings","active-document"),activeId=settings?.documentId||this.state.persistence.activeDocumentId;
    const record=await this.adapter.get("documents",activeId);
    if(record?.document?.schemaVersion===TIMELINE_SCHEMA_409){this.applyDocument(record.document);this.state.persistence={...this.state.persistence,...record.persistence,adapter:this.adapter.kind,activeDocumentId:activeId,dirty:false,lastSaveError:null};this.sequence=Number(record.persistence?.saveSequence||record.sequence||0);this.lastObservedFingerprint=persistenceFingerprint(this.documentProvider());}
    else if(record){
      const recovery=await this.recovery.recover(activeId,null);
      if(recovery.recovered){this.applyDocument(recovery.document);this.state.recovery.available=true;this.state.recovery.lastRecoveryAt=nowIso(this.clock);this.state.persistence.dirty=true;}
      else{this.state.persistence.dirty=true;this.state.persistence.lastSaveError="Stored draft was malformed and no valid recovery checkpoint was available.";}
    }
    this.notify();return {restored:!!record,activeDocumentId:activeId,adapter:this.adapter.kind};
  }
  async observe(){
    const document=this.documentProvider(),fingerprint=persistenceFingerprint(document);if(this.lastObservedFingerprint===null){this.lastObservedFingerprint=fingerprint;return false;}if(fingerprint===this.lastObservedFingerprint)return false;
    this.lastObservedFingerprint=fingerprint;this.state.persistence.dirty=true;this.state.persistence.lastSaveError=null;
    const materialHash=await sha256Hex(this.advisorManager.constructor.fingerprintInput(document));this.advisorManager.checkMaterialChange(materialHash);this.notify();if(this.state.persistence.autosaveEnabled)this.scheduleAutosave();return true;
  }
  scheduleAutosave(){clearTimeout(this.timer);this.timer=setTimeout(()=>this.saveDraft({reason:"AUTOSAVE"}).catch(()=>{}),this.autosaveDelay);}
  async saveDraft({reason="EXPLICIT_SAVE"}={}){
    const prior=this.saving;
    const queued=(prior?prior.catch(()=>{}):Promise.resolve()).then(async()=>{
      const document=this.documentProvider();document.schemaVersion=TIMELINE_SCHEMA_409;document.id=this.state.persistence.activeDocumentId||document.id;const savedAt=nowIso(this.clock),sequence=++this.sequence;
      const persistence={...clone(this.state.persistence),dirty:false,lastSavedAt:savedAt,lastSaveError:null,saveSequence:sequence,adapter:this.adapter.kind};document.persistence=clone(persistence);
      const record={id:document.id,document:clone(document),persistence,savedAt,sequence,schemaVersion:TIMELINE_SCHEMA_409};
      const checkpoint={id:stableId("checkpoint",[document.id,sequence,reason]),documentId:document.id,sequence,reason,document:clone(document),createdAt:savedAt,valid:true};
      try{
        await this.adapter.atomicPut([{store:"documents",key:record.id,value:record},{store:"checkpoints",key:checkpoint.id,value:checkpoint},{store:"settings",key:"active-document",value:{id:"active-document",documentId:record.id,updatedAt:savedAt}}]);
        this.state.persistence={...persistence};this.state.recovery.lastCheckpointAt=savedAt;this.state.recovery.available=true;this.lastObservedFingerprint=persistenceFingerprint(record.document);this.notify();return record;
      }catch(error){this.state.persistence.dirty=true;this.state.persistence.lastSaveError=String(error.message||error);this.notify();throw error;}
    });
    this.saving=queued;
    return queued.finally(()=>{if(this.saving===queued)this.saving=null;});
  }
  async saveVersion(label="Named version"){
    await this.saveDraft({reason:"BEFORE_VERSION"});const document=this.documentProvider(),createdAt=nowIso(this.clock),version={id:stableId("version",[document.id,createdAt,label,Math.random()]),documentId:document.id,label:String(label||"Named version").trim()||"Named version",createdAt,documentSnapshot:clone(document),contentHash:await sha256Hex(persistenceFingerprint(document)),eventCount:document.events?.length||0,mediaCount:document.mediaItems?.length||0};
    await this.adapter.put("versions",version);return version;
  }
  async listVersions(documentId=this.state.persistence.activeDocumentId){const values=await this.adapter.list("versions",(item)=>item.documentId===documentId);return values.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));}
  async restoreVersion(versionId){const version=await this.adapter.get("versions",versionId);if(!version)throw new Error("Version not found.");this.applyDocument(version.documentSnapshot);this.state.persistence.dirty=true;this.lastObservedFingerprint=null;await this.saveDraft({reason:"RESTORE_VERSION"});return version;}
  async compareVersion(versionId){const version=await this.adapter.get("versions",versionId);if(!version)throw new Error("Version not found.");return versionDiff(this.documentProvider(),version);}
  async duplicateDraft(name="Copy of Mission Timeline"){
    await this.saveDraft({reason:"BEFORE_DUPLICATE"});const document=clone(this.documentProvider()),newId=stableId("timeline",[document.id,name,nowIso(this.clock),Math.random()]);document.id=newId;document.title=name;document.persistence={...document.persistence,activeDocumentId:newId,draftName:name,dirty:false};const record={id:newId,document,persistence:document.persistence,savedAt:nowIso(this.clock),sequence:1,schemaVersion:TIMELINE_SCHEMA_409};await this.adapter.put("documents",record);return record;
  }
  async renameDraft(name){const clean=String(name||"").trim();if(!clean)throw new Error("Draft name is required.");this.state.persistence.draftName=clean;this.state.persistence.dirty=true;await this.saveDraft({reason:"RENAME_DRAFT"});return clean;}
  async archiveDraft(archived=true){this.state.persistence.archived=!!archived;this.state.persistence.dirty=true;await this.saveDraft({reason:archived?"ARCHIVE_DRAFT":"UNARCHIVE_DRAFT"});return archived;}
  async listDrafts(){const values=await this.adapter.list("documents");return values.map((record)=>({id:record.id,title:record.document?.title||record.persistence?.draftName||"Timeline Draft",savedAt:record.savedAt,archived:!!record.persistence?.archived,eventCount:record.document?.events?.length||0})).sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt)));}
  async switchDraft(id){const record=await this.adapter.get("documents",id);if(!record)throw new Error("Draft not found.");this.applyDocument(record.document);this.state.persistence={...record.persistence,activeDocumentId:id,dirty:false};await this.adapter.put("settings",{id:"active-document",documentId:id,updatedAt:nowIso(this.clock)});this.lastObservedFingerprint=persistenceFingerprint(this.documentProvider());this.notify();return record;}
  async previewDeleteDraft(id=this.state.persistence.activeDocumentId){
    const record=await this.adapter.get("documents",id),target=record?.document||(id===this.state.persistence.activeDocumentId?this.documentProvider():null);
    if(!target)return {requiresConfirmation:true,id,missing:true,willDelete:{drafts:0},willNotDelete:["No matching local draft was found."]};
    const allDrafts=await this.adapter.list("documents"),others=allDrafts.filter((item)=>item.id!==id).map((item)=>item.document||{});
    const ids=(items,key="id")=>new Set((items||[]).map((item)=>item?.[key]).filter(Boolean));
    const mediaIds=ids(target.mediaItems),exportIds=ids(target.exportRecords),artifactIds=ids(target.timelineArtifacts,"artifactId");
    const sharedMedia=ids(others.flatMap((item)=>item.mediaItems||[]));
    const sharedExports=ids(others.flatMap((item)=>item.exportRecords||[]));
    const sharedArtifacts=ids(others.flatMap((item)=>item.timelineArtifacts||[]),"artifactId");
    const removableMedia=[...mediaIds].filter((key)=>!sharedMedia.has(key));
    const removableExports=[...exportIds].filter((key)=>!sharedExports.has(key));
    const removableArtifacts=[...artifactIds].filter((key)=>!sharedArtifacts.has(key));
    const versions=await this.adapter.list("versions",(item)=>item.documentId===id),checkpoints=await this.adapter.list("checkpoints",(item)=>item.documentId===id);
    const exports=await this.adapter.list("exports",(item)=>removableExports.includes(item.id)||removableArtifacts.includes(item.artifactId));
    const artifacts=await this.adapter.list("artifacts",(item)=>removableArtifacts.includes(item.artifactId||item.id)||item.timelineDocumentId===id&&!sharedArtifacts.has(item.artifactId||item.id));
    const artifactKeys=[...new Set(artifacts.map((item)=>item.artifactId||item.id).filter(Boolean))];
    const exportKeys=[...new Set(exports.map((item)=>item.id).filter(Boolean))];
    const blobKeys=[...removableMedia,...exportKeys.map((key)=>`export:${key}`)];
    const syncRecords=await this.adapter.list("syncRecords",(item)=>item.timelineDocumentId===id||artifactKeys.includes(item.artifactId)||removableArtifacts.includes(item.artifactId));
    const migrations=await this.adapter.list("migrations",(item)=>[item.documentId,item.timelineDocumentId,item.targetDocumentId,item.importedDocumentId].includes(id));
    const activeSetting=await this.adapter.get("settings","active-document");
    const sharedCount=(mediaIds.size-removableMedia.length)+(exportIds.size-removableExports.length)+(artifactIds.size-removableArtifacts.length);
    const willDelete={drafts:record?1:0,versions:versions.length,recoveryCheckpoints:checkpoints.length,mediaItems:removableMedia.length,mediaBlobs:removableMedia.length,exportRecords:exportKeys.length,exportBlobs:exportKeys.length,timelineArtifacts:artifactKeys.length,fileVaultSyncRecords:syncRecords.length,migrationRecords:migrations.length,activeDraftPointer:activeSetting?.documentId===id?1:0};
    const willNotDelete=[
      `${Math.max(0,allDrafts.length-(record?1:0))} other local draft(s) and their versions`,
      `${sharedCount} blob or artifact reference(s) shared by another local draft`,
      "Source PDF or image files on the Mac outside this browser sandbox",
      "Files already downloaded from the browser",
      "Dropbox, Downloads, MissionMed production, and FileVault production records"
    ];
    return {requiresConfirmation:true,id,missing:false,willDelete,willNotDelete,_keys:{versions:versions.map((item)=>item.id),checkpoints:checkpoints.map((item)=>item.id),media:removableMedia,exports:exportKeys,artifacts:artifactKeys,syncRecords:syncRecords.map((item)=>item.id),migrations:migrations.map((item)=>item.id),deleteActiveSetting:activeSetting?.documentId===id}};
  }
  async deleteDraft(id,{confirmed=false}={}){
    const preview=await this.previewDeleteDraft(id);if(!confirmed)return preview;if(preview.missing)return {deleted:false,id,preview};
    const keys=preview._keys;
    for(const key of keys.versions)await this.adapter.delete("versions",key);
    for(const key of keys.checkpoints)await this.adapter.delete("checkpoints",key);
    for(const key of keys.media)await this.adapter.deleteBlob(key);
    for(const key of keys.exports){await this.adapter.delete("exports",key);await this.adapter.deleteBlob(`export:${key}`);}
    for(const key of keys.artifacts)await this.adapter.delete("artifacts",key);
    for(const key of keys.syncRecords)await this.adapter.delete("syncRecords",key);
    for(const key of keys.migrations)await this.adapter.delete("migrations",key);
    await this.adapter.delete("documents",id);if(keys.deleteActiveSetting)await this.adapter.delete("settings","active-document");
    if(id===this.state.persistence.activeDocumentId){clearTimeout(this.timer);this.state.persistence.autosaveEnabled=false;this.state.persistence.dirty=false;this.state.persistence.lastDeletion=clone(preview.willDelete);this.notify();}
    return {deleted:true,id,willDelete:preview.willDelete,willNotDelete:preview.willNotDelete};
  }
  async recoverLatest(){const activeId=this.state.persistence.activeDocumentId,current=await this.adapter.get("documents",activeId),result=await this.recovery.recover(activeId,current);if(result.recovered){this.applyDocument(result.document);this.state.recovery.lastRecoveryAt=nowIso(this.clock);this.state.persistence.dirty=true;this.lastObservedFingerprint=null;}return result;}
  async importTimeline(raw){const result=migrateTimelineInput(raw);this.state.migrationMetadata.history.push(clone(result.report));await this.adapter.put("migrations",result.report,result.report.id);if(!result.ok)return result;this.applyDocument(result.document);this.state.persistence.activeDocumentId=result.document.id;this.state.persistence.dirty=true;this.lastObservedFingerprint=null;await this.saveDraft({reason:"IMPORT_MIGRATION"});return result;}
  async purgeExtractedPageText(){const document=this.documentProvider(),pages=document.documentPages||[],blocks=document.sourceBlocks||[],summary={pageCount:pages.length,blockCount:blocks.length,provenanceExcerptCount:(document.extractionCandidates||[]).reduce((sum,item)=>sum+(item.provenance?.length||0),0)};document.documentPages=[];document.sourceBlocks=[];this.applyDocument(document);this.state.retention={...(this.state.retention||{}),pageTextPurgedAt:nowIso(this.clock),retainedProvenanceExcerpts:summary.provenanceExcerptCount};this.state.persistence.dirty=true;await this.saveDraft({reason:"PURGE_EXTRACTED_TEXT"});return summary;}
  async flush(){clearTimeout(this.timer);if(this.state.persistence.dirty)return this.saveDraft({reason:"FLUSH"});return null;}
}

export {persistenceFingerprint,versionDiff};
