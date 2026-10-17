import {IndexedDbAdapter} from "../persistence/indexeddb-adapter.js";
import {AUTOSAVE_DELAY,CATEGORIES,DOCUMENT_SCHEMA,HISTORY_LIMIT,PRIMARY_NAV_ITEMS,VISIBILITY} from "./constants.js";
import {normalizeSpecialtyVariants} from "./specialty-variants.js";
import {clone,isoNow,uid} from "./utils.js";

const MIGRATION_FALLBACK_ISO="1970-01-01T00:00:00.000Z";

export class TimelineEntitlementError extends Error{
  constructor(capability,reason){
    super(reason||"Timeline access is read-only.");
    this.name="TimelineEntitlementError";
    this.code="TIMELINE_ENTITLEMENT_REQUIRED";
    this.capability=capability;
  }
}

function defaultDocument({id="d1-uxr-002-local-timeline"}={}){
  const now=isoNow();
  const document={
    schemaVersion:DOCUMENT_SCHEMA,
    id,
    title:"Timeline Builder",
    createdAt:now,
    updatedAt:now,
    studentProfile:{
      fullName:"",
      medicalSchool:"",
      canonicalSchoolId:"",
      medicalSchoolRecord:null,
      medicalSchoolCountry:"",
      medicalSchoolEntryMode:"registry",
      medicalSchoolVerificationStatus:"",
      medicalSchoolNormalizationStatus:"",
      medicalSchoolAnalyticsEligible:false,
      medicalSchoolUnlistedSubmission:null,
      medicalSchoolCity:"",
      graduationDate:"",
      expectedGraduation:false,
      degree:"",
      degreeOther:"",
      visaStatus:"",
      currentUsWorkAuthorization:"",
      workAuthorizationOther:"",
      eadStatus:"",
      residencyVisaTypesOpenTo:"",
      interviewSeason:""
    },
    categories:CATEGORIES.map((item)=>clone(item)),
    events:[],
    exams:[],
    medicalSchoolNormalizationQueue:[],
    builder:{step:1,skipped:[],touched:[],examSystems:[]},
    theme:"keynote-classic",
    mode:"guided",
    layoutLock:true,
    advanced:{
      enteredBefore:false,
      background:{kind:"theme",preset:null,color:null,mediaId:null,dim:20,scrim:"white"},
      media:[],
      textBlocks:[],
      recentColors:[]
    },
    intake:{stage:null,file:null,candidates:[],filter:"all",lastImport:null},
    advisor:{
      status:"not-requested",
      requestedAt:null,
      message:"",
      advisorName:"Advisor",
      approvedAt:null,
      editedSince:false,
      checklist:[],
      questions:[],
      hiddenQuestionIds:[],
      comments:[]
    },
    preferences:{railPinned:false,advisorPaperSuggestionDismissed:false,advancedDialogSeen:false},
    metadata:{source:"D1-UXR-002",localOnly:true,productionWrites:false}
  };
  document.specialtyVariants=normalizeSpecialtyVariants(document);
  return document;
}

function eventFromLegacy(event,index){
  const source=clone(event||{});
  const categoryAliases={th:"education",usmle:"exams",cl:"clinical",res:"research",work:"work",personal:"personal"};
  const originalCategoryId=String(event.categoryId||event.cat||"").trim();
  const categoryId=CATEGORIES.some((item)=>item.id===event.categoryId)?event.categoryId:(categoryAliases[event.cat]||"personal");
  const fields=clone(event.fields||{});
  const knownKeys=new Set([
    "id","title","t","categoryId","cat","eventType","mile","startDate","s",
    "endDate","e","openEnded","visibilityState","vis","siteName","loc",
    "notes","lane","sourceType","origin","provenance","fields"
  ]);
  const unknownFields=Object.keys(source).filter((key)=>!knownKeys.has(key));
  if(unknownFields.length){
    fields.migrationUnknownFields=[
      ...new Set([...(fields.migrationUnknownFields||[]),...unknownFields])
    ];
  }
  if(originalCategoryId&&originalCategoryId!==categoryId){
    fields.migrationOriginalCategoryId=fields.migrationOriginalCategoryId||originalCategoryId;
  }
  const visibilityAliases={
    safe:"INTERVIEWER_SAFE",
    interviewer:"INTERVIEWER_SAFE",
    public:"INTERVIEWER_SAFE",
    advisor:"ADVISOR_ONLY",
    student:"STUDENT_ONLY",
    hidden:"HIDDEN",
    full:"FULL_STORY"
  };
  const explicitVisibility=String(event.visibilityState||"").trim();
  const compactVisibility=String(event.vis||"").trim().toLowerCase();
  const knownVisibility=new Set([
    "INTERVIEWER_SAFE","ADVISOR_ONLY","STUDENT_ONLY","HIDDEN","FULL_STORY"
  ]);
  let visibilityState=knownVisibility.has(explicitVisibility)
    ?explicitVisibility
    :visibilityAliases[compactVisibility]||"INTERVIEWER_SAFE";
  if(
    (explicitVisibility&&!knownVisibility.has(explicitVisibility))||
    (compactVisibility&&!visibilityAliases[compactVisibility])
  ){
    fields.migrationOriginalVisibility=
      fields.migrationOriginalVisibility||explicitVisibility||compactVisibility;
    visibilityState="HIDDEN";
  }
  if(categoryId==="clinical"&&!fields.rotationDatePrecision){
    const hasExact=/^\d{4}-\d{2}-\d{2}$/.test(String(fields.rotationStartDate||""))&&(
      !!event.openEnded||
      /^\d{4}-\d{2}-\d{2}$/.test(String(fields.rotationEndDate||""))
    );
    fields.rotationStartDate=hasExact?fields.rotationStartDate:null;
    fields.rotationEndDate=hasExact?(fields.rotationEndDate||null):null;
    fields.rotationDatePrecision=hasExact
      ?"day"
      :(String(event.startDate||event.s||"").trim()?"month-legacy":"unknown");
  }
  if(categoryId==="clinical"&&!fields.lorStatus){
    const submittedEvidence=fields.lorSubmitted===true;
    const targetEvidence=Object.keys(fields.lorStatusesByTarget||{}).length>0;
    fields.lorStatus=submittedEvidence?"submitted-to-eras":"unknown";
    fields.lorMigrationEvidence={
      ...(fields.lorMigrationEvidence||{}),
      sourceStatus:submittedEvidence
        ?"legacy-submitted-flag"
        :targetEvidence
          ?"target-specific-status-preserved"
          :"absent",
      interpretedStatus:submittedEvidence?"submitted-to-eras":"unknown",
      submittedToEras:submittedEvidence
        ?true
        :targetEvidence
          ?null
          :false
    };
  }
  const milestone=event.eventType==="milestone"||event.mile===true;
  return{
    ...source,
    id:event.id||`legacy-event-${index+1}`,
    title:event.title||event.t||`Event ${index+1}`,
    categoryId,
    eventType:event.eventType||(milestone?"milestone":"duration"),
    startDate:event.startDate||event.s||"",
    endDate:event.endDate??event.e??null,
    openEnded:typeof event.openEnded==="boolean"
      ?event.openEnded
      :!milestone&&!event.endDate&&!event.e,
    visibilityState,
    siteName:event.siteName||event.loc||"",
    notes:event.notes||"",
    lane:Number.isInteger(event.lane)?event.lane:null,
    sourceType:event.sourceType||event.origin||"legacy",
    provenance:clone(event.provenance||[]),
    fields
  };
}

function normalizeEventIds(events){
  const seen=new Set();
  return events.map((event,index)=>{
    const originalId=String(event?.id||`legacy-event-${index+1}`);
    if(!seen.has(originalId)){
      seen.add(originalId);
      return event;
    }
    let suffix=2;
    let normalizedId=`${originalId}--duplicate-${suffix}`;
    while(seen.has(normalizedId)){
      suffix+=1;
      normalizedId=`${originalId}--duplicate-${suffix}`;
    }
    seen.add(normalizedId);
    return{
      ...event,
      id:normalizedId,
      fields:{
        ...clone(event.fields||{}),
        migrationOriginalId:
          event.fields?.migrationOriginalId||originalId,
        migrationDuplicateIdOccurrence:suffix
      }
    };
  });
}

function migrateDocument(value){
  const base=defaultDocument();
  if(!value||typeof value!=="object")return base;
  const source=value.document||value;
  const profile=source.studentProfile||{};
  const sourceCategories=Array.isArray(source.categories)?clone(source.categories):[];
  const canonicalCategoryIds=new Set(CATEGORIES.map(({id})=>id));
  const unknownCategories=sourceCategories.filter(
    ({id}={})=>id&&!canonicalCategoryIds.has(id)
  );
  const priorMetadata=clone(source.metadata||{});
  const sourceSchema=priorMetadata.sourceSchema||source.schemaVersion||"legacy";
  const createdAt=source.createdAt||
    source.metadata?.createdAt||
    MIGRATION_FALLBACK_ISO;
  const updatedAt=source.updatedAt||
    source.metadata?.updatedAt||
    createdAt;
  const result={
    ...base,
    ...clone(source),
    schemaVersion:DOCUMENT_SCHEMA,
    id:source.id||base.id,
    createdAt,
    updatedAt,
    studentProfile:{...base.studentProfile,...clone(profile),fullName:profile.fullName||profile.name||""},
    categories:[
      ...CATEGORIES.map((item)=>{
        const prior=sourceCategories.find(({id}={})=>id===item.id);
        return{...clone(prior||{}),...clone(item)};
      }),
      ...unknownCategories
    ],
    events:normalizeEventIds((source.events||[]).map(eventFromLegacy)),
    medicalSchoolNormalizationQueue:clone(
      source.medicalSchoolNormalizationQueue||[]
    ),
    builder:{...base.builder,...clone(source.builder||{})},
    advanced:{...base.advanced,...clone(source.advanced||{}),background:{...base.advanced.background,...clone(source.advanced?.background||{})}},
    intake:{...base.intake,...clone(source.intake||{})},
    advisor:{...base.advisor,...clone(source.advisor||source.advisorReview||{})},
    preferences:{...base.preferences,...clone(source.preferences||{})},
    metadata:{
      ...base.metadata,
      ...priorMetadata,
      sourceSchema,
      compatibilityMigration:{
        ...clone(priorMetadata.compatibilityMigration||{}),
        schemaVersion:"d1-405.compatibility-migration.1",
        sourceSchema,
        unknownFieldsPolicy:"preserved-uninterpreted",
        fabricatedLorStatus:false
      }
    }
  };
  const clinicalDraft=result.builder?.drafts?.clinical;
  if(clinicalDraft){
    if(!clinicalDraft.rotationDatePrecision){
      clinicalDraft.rotationStartDate=null;
      clinicalDraft.rotationEndDate=null;
      clinicalDraft.rotationDatePrecision=clinicalDraft.startDate
        ?"month-legacy"
        :"unknown";
    }
    if(!clinicalDraft.lorStatus){
      clinicalDraft.lorStatus="unknown";
      clinicalDraft.lorMigrationEvidence={
        ...(clinicalDraft.lorMigrationEvidence||{}),
        sourceStatus:"absent",
        interpretedStatus:"unknown",
        submittedToEras:false
      };
    }
  }
  if(!source.specialtyVariants)delete result.specialtyVariants;
  result.specialtyVariants=normalizeSpecialtyVariants(result);
  return result;
}

function stable(value){return JSON.stringify(value);}

export class TimelineStore{
  constructor({adapter=null,clock=()=>new Date(),entitlement=null,documentId=null}={}){
    this.adapter=adapter||window.D1_PERSISTENCE_ADAPTER||new IndexedDbAdapter({name:"missionmed-timeline-uxr-002",version:1});
    this.clock=clock;
    this.document=defaultDocument({id:documentId||this.adapter.newDocumentId||"d1-uxr-002-local-timeline"});
    this.route="home";
    this.saveStatus="loading";
    this.saveError=null;
    this.undoStack=[];
    this.redoStack=[];
    this.listeners=new Set();
    this.timer=null;
    this.scheduledAuthorization=null;
    this.saveSequence=0;
    this.pendingSave=null;
    this.entitlementTimer=null;
    this.entitlement=Object.freeze({
      access:"DENIED",
      canRead:false,
      canCreate:false,
      canMutate:false,
      canExport:false,
      verified:false,
      denialCode:"ENTITLEMENT_PENDING",
      reason:"Timeline access has not yet been evaluated."
    });
    if(entitlement)this.setEntitlement(entitlement,{emit:false});
  }

  now(){return this.clock().toISOString();}
  subscribe(listener){this.listeners.add(listener);listener(this);return()=>this.listeners.delete(listener);}
  emit(){for(const listener of this.listeners)listener(this);}

  async initialize(){
    await this.adapter.open();
    const active=await this.adapter.get("settings","uxr-002-active-document");
    const id=active?.documentId||this.document.id;
    const record=await this.adapter.get("documents",id);
    let restoredRecord=record;
    if(record?.document)this.document=migrateDocument(record.document);
    else{
      const legacyActive=await this.adapter.get("settings","active-document");
      const legacy=legacyActive?.documentId?await this.adapter.get("documents",legacyActive.documentId):null;
      if(legacy?.document){
        this.document=migrateDocument(legacy.document);
        restoredRecord=legacy;
      }
    }
    if(!restoredRecord&&this.entitlement.canCreate===true){
      await this.saveNow("INITIAL_DURABLE_DRAFT");
    }
    this.saveStatus="saved";
    this.saveError=null;
    this.emit();
    return{
      restored:!!restoredRecord,
      adapter:this.adapter.kind,
      documentId:this.document.id
    };
  }

  navigate(route){
    const primary=PRIMARY_NAV_ITEMS.map(({id})=>id);
    if(![...primary,"intake","advisor"].includes(route))return false;
    this.route=route;this.emit();return true;
  }

  snapshot(){return clone(this.document);}

  setEntitlement(entitlement,{emit=true}={}){
    const source=clone(entitlement||{});
    const access=String(source.access||"DENIED");
    const expiresAtText=String(source.expiresAt||"").trim();
    const expiresAtValid=!expiresAtText||
      Number.isFinite(Date.parse(expiresAtText));
    const contractValid=
      source.schemaVersion==="d1-405.timeline-entitlement.1"&&
      ["FULL","READ_ONLY","DENIED"].includes(access)&&
      expiresAtValid;
    const writeGrantValid=
      contractValid&&
      source.verified===true&&
      access==="FULL";
    this.entitlement=Object.freeze({
      ...source,
      access:contractValid?access:"DENIED",
      canRead:contractValid&&source.canRead===true,
      canCreate:writeGrantValid&&source.canCreate===true,
      canMutate:writeGrantValid&&source.canMutate===true,
      canExport:writeGrantValid&&source.canExport===true,
      verified:contractValid&&source.verified===true,
      denialCode:contractValid
        ?source.denialCode
        :"ENTITLEMENT_CONTRACT_INVALID",
      reason:String(
        contractValid
          ?source.reason||"Timeline access is unavailable."
          :"Timeline access contract is invalid."
      )
    });
    clearTimeout(this.entitlementTimer);
    this.entitlementTimer=null;
    const expiresAt=Date.parse(String(this.entitlement.expiresAt||""));
    const delay=expiresAt-this.clock().getTime();
    if(Number.isFinite(delay)&&delay<=0){
      this.refreshEntitlementExpiry({emit:false});
    }else if(Number.isFinite(delay)){
      this.entitlementTimer=setTimeout(()=>{
        this.entitlementTimer=null;
        if(!this.refreshEntitlementExpiry({emit:true})){
          this.setEntitlement(this.entitlement,{emit:false});
        }
      },Math.min(delay,2_147_483_647));
    }
    if(emit)this.emit();
    return this.entitlement;
  }

  assertCapability(capability){
    this.refreshEntitlementExpiry({emit:true});
    if(this.entitlement?.[capability]!==true){
      throw new TimelineEntitlementError(capability,this.entitlement.reason);
    }
    return true;
  }

  refreshEntitlementExpiry({emit=false}={}){
    const expiresAt=Date.parse(String(this.entitlement?.expiresAt||""));
    if(
      !Number.isFinite(expiresAt)||
      expiresAt>this.clock().getTime()||
      this.entitlement.denialCode==="ENTITLEMENT_EXPIRED"
    )return false;
    clearTimeout(this.entitlementTimer);
    this.entitlementTimer=null;
    const access=this.entitlement.canRead===true?"READ_ONLY":"DENIED";
    this.entitlement=Object.freeze({
      ...this.entitlement,
      access,
      readOnly:access==="READ_ONLY",
      denied:access==="DENIED",
      canCreate:false,
      canMutate:false,
      canExport:false,
      denialCode:"ENTITLEMENT_EXPIRED",
      reason:"Timeline access expired."
    });
    if(emit)this.emit();
    return true;
  }

  mutate(label,operation,{history=true,material=true}={}){
    const persistenceLease=this.capturePersistenceLease();
    const before=this.snapshot();
    const advisorEventDataBefore=stable({events:before.events,exams:before.exams});
    operation(this.document);
    if(stable(before)===stable(this.document))return false;
    this.document.updatedAt=this.now();
    if(
      material&&
      this.document.advisor?.approvedAt&&
      advisorEventDataBefore!==stable({
        events:this.document.events,
        exams:this.document.exams
      })
    )this.document.advisor.editedSince=true;
    const after=this.snapshot();
    if(history){
      this.undoStack.push({label,before,after,at:this.now()});
      if(this.undoStack.length>HISTORY_LIMIT)this.undoStack.shift();
      this.redoStack=[];
    }
    this.saveStatus="saving";
    this.saveError=null;
    this.scheduleSave(
      this.capturePersistenceAuthorization(persistenceLease)
    );
    this.emit();
    return true;
  }

  async mutateWithBlobs(
    label,
    operation,
    {blobs=[],history=true,material=true,reason="LOCAL_ASSET_MUTATION"}={}
  ){
    this.assertCapability("canMutate");
    await this.saveNow("BEFORE_LOCAL_ASSET_MUTATION");
    const before=this.snapshot();
    const advisorEventDataBefore=stable({events:before.events,exams:before.exams});
    try{
      operation(this.document);
    }catch(error){
      this.document=before;
      throw error;
    }
    if(stable(before)===stable(this.document)&&!blobs.length)return false;
    this.document.updatedAt=this.now();
    if(
      material&&
      this.document.advisor?.approvedAt&&
      advisorEventDataBefore!==stable({
        events:this.document.events,
        exams:this.document.exams
      })
    )this.document.advisor.editedSince=true;
    const after=this.snapshot();
    const savedAt=this.now();
    const sequence=this.saveSequence+1;
    const record={
      id:after.id,
      document:after,
      schemaVersion:DOCUMENT_SCHEMA,
      savedAt,
      sequence,
      reason
    };
    const checkpoint={
      id:uid("checkpoint"),
      documentId:after.id,
      document:clone(after),
      createdAt:savedAt,
      sequence,
      reason
    };
    const blobEntries=blobs.map(({key,blob,metadata={}})=>({
      store:"blobs",
      key,
      value:{id:key,blob,metadata:clone(metadata)}
    }));
    this.saveStatus="saving";
    this.saveError=null;
    this.emit();
    try{
      this.assertCapability("canMutate");
      await this.adapter.atomicPut([
        {store:"documents",key:record.id,value:record},
        {store:"checkpoints",key:checkpoint.id,value:checkpoint},
        {
          store:"settings",
          key:"uxr-002-active-document",
          value:{
            id:"uxr-002-active-document",
            documentId:after.id,
            updatedAt:savedAt
          }
        },
        ...blobEntries
      ]);
    }catch(error){
      this.document=before;
      this.saveStatus="error";
      this.saveError=String(error?.message||error);
      this.emit();
      throw error;
    }
    this.saveSequence=sequence;
    if(history){
      this.undoStack.push({label,before,after,at:savedAt});
      if(this.undoStack.length>HISTORY_LIMIT)this.undoStack.shift();
      this.redoStack=[];
    }
    this.saveStatus="saved";
    this.saveError=null;
    this.emit();
    return true;
  }

  replace(document,{label="Replace timeline",history=true}={}){
    return this.mutate(label,(target)=>{for(const key of Object.keys(target))delete target[key];Object.assign(target,migrateDocument(document));},{history});
  }

  scheduleSave(authorization=this.capturePersistenceAuthorization()){
    clearTimeout(this.timer);
    this.scheduledAuthorization=authorization;
    const expiresAt=Date.parse(String(this.entitlement?.expiresAt||""));
    const remaining=expiresAt-this.clock().getTime();
    const delay=Number.isFinite(remaining)
      ?remaining<=AUTOSAVE_DELAY+250
        ?0
        :Math.min(AUTOSAVE_DELAY,Math.max(0,remaining-250))
      :AUTOSAVE_DELAY;
    this.timer=setTimeout(()=>{
      this.timer=null;
      const authorization=this.scheduledAuthorization;
      this.scheduledAuthorization=null;
      this.queueAuthorizedSave("AUTOSAVE",authorization).catch(()=>{});
    },delay);
  }

  capturePersistenceLease(){
    this.assertCapability("canMutate");
    return Object.freeze({
      authorizedAt:this.now(),
      lease:Object.freeze({
        schemaVersion:"d1-405.local-persistence-lease.1",
        authorized:true,
        capability:"canMutate",
        access:"FULL",
        expiresAt:String(this.entitlement.expiresAt||""),
        decisionId:String(this.entitlement.decisionId||"")
      })
    });
  }

  capturePersistenceAuthorization(
    persistenceLease=this.capturePersistenceLease()
  ){
    return Object.freeze({
      document:this.snapshot(),
      ...persistenceLease
    });
  }

  async saveNow(reason="EXPLICIT_SAVE"){
    const authorization=this.capturePersistenceAuthorization();
    clearTimeout(this.timer);
    this.timer=null;
    this.scheduledAuthorization=null;
    return this.queueAuthorizedSave(reason,authorization);
  }

  flushPendingSave(reason="PAGE_HIDE"){
    clearTimeout(this.timer);
    this.timer=null;
    const authorization=this.scheduledAuthorization||
      this.capturePersistenceAuthorization();
    this.scheduledAuthorization=null;
    return this.queueAuthorizedSave(reason,authorization);
  }

  async queueAuthorizedSave(reason,{document,authorizedAt,lease}){
    const prior=this.pendingSave;
    const perform=async()=>{
      this.saveStatus="saving";this.emit();
      const leaseValid=
        lease?.schemaVersion==="d1-405.local-persistence-lease.1"&&
        lease.authorized===true&&
        lease.capability==="canMutate"&&
        lease.access==="FULL";
      if(!leaseValid){
        throw new TimelineEntitlementError(
          "canMutate",
          "The local persistence authorization is invalid."
        );
      }
      const savedAt=authorizedAt,sequence=++this.saveSequence;
      const record={id:document.id,document,schemaVersion:DOCUMENT_SCHEMA,savedAt,sequence,reason};
      const checkpoint={id:uid("checkpoint"),documentId:document.id,document:clone(document),createdAt:savedAt,sequence,reason};
      try{
        await this.adapter.atomicPut([
          {store:"documents",key:record.id,value:record},
          {store:"checkpoints",key:checkpoint.id,value:checkpoint},
          {store:"settings",key:"uxr-002-active-document",value:{id:"uxr-002-active-document",documentId:document.id,updatedAt:savedAt}}
        ]);
        this.saveStatus="saved";this.saveError=null;this.emit();return record;
      }catch(error){
        this.saveStatus="error";this.saveError=String(error?.message||error);this.emit();throw error;
      }
    };
    const queued=prior?prior.catch(()=>{}).then(perform):perform();
    this.pendingSave=queued;
    return queued.finally(()=>{if(this.pendingSave===queued)this.pendingSave=null;});
  }

  undo(){
    const persistenceLease=this.capturePersistenceLease();
    const entry=this.undoStack.pop();if(!entry)return null;
    this.redoStack.push(entry);
    this.document=clone(entry.before);
    this.document.updatedAt=this.now();
    this.saveStatus="saving";
    this.scheduleSave(this.capturePersistenceAuthorization(persistenceLease));
    this.emit();
    return entry;
  }

  redo(){
    const persistenceLease=this.capturePersistenceLease();
    const entry=this.redoStack.pop();if(!entry)return null;
    this.undoStack.push(entry);
    this.document=clone(entry.after);
    this.document.updatedAt=this.now();
    this.saveStatus="saving";
    this.scheduleSave(this.capturePersistenceAuthorization(persistenceLease));
    this.emit();
    return entry;
  }

  historyStatus(){
    return{undoCount:this.undoStack.length,redoCount:this.redoStack.length,canUndo:this.undoStack.length>0,canRedo:this.redoStack.length>0,undoLabel:this.undoStack.at(-1)?.label||null,redoLabel:this.redoStack.at(-1)?.label||null};
  }

  async startNewTimeline(){
    this.assertCapability("canMutate");
    const date=new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(this.clock());
    const version=await this.saveVersion(`Before starting over · ${date}`,"automatic");
    const preferences=clone(this.document.preferences);
    this.replace({...defaultDocument({id:this.document.id}),preferences},{label:"Start new timeline"});
    await this.saveNow("START_NEW_TIMELINE");
    return version;
  }

  async saveVersion(label,kind="manual"){
    this.assertCapability("canMutate");
    await this.saveNow("BEFORE_VERSION");
    const versions=await this.listVersions();
    const version={
      id:uid("version"),
      documentId:this.document.id,
      name:String(label||`Version ${versions.length+1}`).trim(),
      kind,
      createdAt:this.now(),
      eventCount:this.document.events.length,
      documentSnapshot:this.snapshot()
    };
    this.assertCapability("canMutate");
    await this.adapter.put("versions",version);
    return version;
  }

  async listVersions(){
    const values=await this.adapter.list("versions",(item)=>item.documentId===this.document.id);
    return values.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async restoreVersion(id){
    this.assertCapability("canMutate");
    const version=await this.adapter.get("versions",id);
    if(!version)throw new Error("Version not found.");
    this.assertCapability("canMutate");
    await this.saveVersion(`Before restore · ${new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(this.clock())}`,"automatic");
    this.replace(version.documentSnapshot,{label:"Restore version"});
    await this.saveNow("RESTORE_VERSION");
    return version;
  }

  async renameVersion(id,name){
    this.assertCapability("canMutate");
    const resolved=String(name||"").trim();
    if(!resolved)throw new TypeError("Version name is required.");
    const version=await this.adapter.get("versions",id);
    if(!version)throw new Error("Version not found.");
    this.assertCapability("canMutate");
    const updated={...version,name:resolved};
    await this.adapter.put("versions",updated);
    return updated;
  }

  async deleteVersion(id){
    this.assertCapability("canMutate");
    const version=await this.adapter.get("versions",id);
    if(!version)return null;
    this.assertCapability("canMutate");
    await this.adapter.delete("versions",id);
    return version;
  }

  async putSyncRecord(record){
    this.assertCapability("canMutate");
    await this.adapter.put("syncRecords",record);
    return record;
  }

  async putBlob(id,blob,metadata={}){
    this.assertCapability("canMutate");
    await this.adapter.putBlob(id,blob,metadata);
    return{id,metadata:clone(metadata)};
  }
}

export {defaultDocument,migrateDocument};
