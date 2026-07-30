import {IndexedDbAdapter} from "../persistence/indexeddb-adapter.js";
import {AUTOSAVE_DELAY,CATEGORIES,DOCUMENT_SCHEMA,HISTORY_LIMIT,PRIMARY_NAV_ITEMS,VISIBILITY} from "./constants.js";
import {clone,isoNow,uid} from "./utils.js";

function defaultDocument(){
  const now=isoNow();
  return{
    schemaVersion:DOCUMENT_SCHEMA,
    id:"d1-uxr-002-local-timeline",
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
    builder:{step:1,skipped:[],touched:[]},
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
}

function eventFromLegacy(event,index){
  const categoryAliases={th:"education",usmle:"exams",cl:"clinical",res:"research",work:"work",personal:"personal"};
  const categoryId=CATEGORIES.some((item)=>item.id===event.categoryId)?event.categoryId:(categoryAliases[event.cat]||"personal");
  const fields=clone(event.fields||{});
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
  return{
    id:event.id||uid("event"),
    title:event.title||event.t||`Event ${index+1}`,
    categoryId,
    eventType:event.eventType||(event.mile?"milestone":"duration"),
    startDate:event.startDate||event.s||"",
    endDate:event.endDate??event.e??null,
    openEnded:!!event.openEnded||(!event.mile&&!event.endDate&&!event.e),
    visibilityState:event.visibilityState||(event.vis==="advisor"?VISIBILITY.ADVISOR_ONLY:VISIBILITY.INTERVIEWER_SAFE),
    siteName:event.siteName||event.loc||"",
    notes:event.notes||"",
    lane:Number.isInteger(event.lane)?event.lane:null,
    sourceType:event.sourceType||event.origin||"legacy",
    provenance:clone(event.provenance||[]),
    fields
  };
}

function migrateDocument(value){
  const base=defaultDocument();
  if(!value||typeof value!=="object")return base;
  const source=value.document||value;
  const profile=source.studentProfile||{};
  const result={
    ...base,
    ...clone(source),
    schemaVersion:DOCUMENT_SCHEMA,
    id:source.id||base.id,
    studentProfile:{...base.studentProfile,...clone(profile),fullName:profile.fullName||profile.name||""},
    categories:CATEGORIES.map((item)=>clone(item)),
    events:(source.events||[]).map(eventFromLegacy),
    medicalSchoolNormalizationQueue:clone(
      source.medicalSchoolNormalizationQueue||[]
    ),
    builder:{...base.builder,...clone(source.builder||{})},
    advanced:{...base.advanced,...clone(source.advanced||{}),background:{...base.advanced.background,...clone(source.advanced?.background||{})}},
    intake:{...base.intake,...clone(source.intake||{})},
    advisor:{...base.advisor,...clone(source.advisor||source.advisorReview||{})},
    preferences:{...base.preferences,...clone(source.preferences||{})},
    metadata:{...base.metadata,...clone(source.metadata||{}),sourceSchema:source.schemaVersion||"legacy"}
  };
  const clinicalDraft=result.builder?.drafts?.clinical;
  if(clinicalDraft&&!clinicalDraft.rotationDatePrecision){
    clinicalDraft.rotationStartDate=null;
    clinicalDraft.rotationEndDate=null;
    clinicalDraft.rotationDatePrecision=clinicalDraft.startDate
      ?"month-legacy"
      :"unknown";
  }
  result.updatedAt=source.updatedAt||source.metadata?.updatedAt||isoNow();
  return result;
}

function stable(value){return JSON.stringify(value);}

export class TimelineStore{
  constructor({adapter=null,clock=()=>new Date()}={}){
    this.adapter=adapter||window.D1_PERSISTENCE_ADAPTER||new IndexedDbAdapter({name:"missionmed-timeline-uxr-002",version:1});
    this.clock=clock;
    this.document=defaultDocument();
    this.route="home";
    this.saveStatus="loading";
    this.saveError=null;
    this.undoStack=[];
    this.redoStack=[];
    this.listeners=new Set();
    this.timer=null;
    this.saveSequence=0;
    this.pendingSave=null;
  }

  now(){return this.clock().toISOString();}
  subscribe(listener){this.listeners.add(listener);listener(this);return()=>this.listeners.delete(listener);}
  emit(){for(const listener of this.listeners)listener(this);}

  async initialize(){
    await this.adapter.open();
    const active=await this.adapter.get("settings","uxr-002-active-document");
    const id=active?.documentId||this.document.id;
    const record=await this.adapter.get("documents",id);
    if(record?.document)this.document=migrateDocument(record.document);
    else{
      const legacyActive=await this.adapter.get("settings","active-document");
      const legacy=legacyActive?.documentId?await this.adapter.get("documents",legacyActive.documentId):null;
      if(legacy?.document)this.document=migrateDocument(legacy.document);
      await this.saveNow("INITIAL_DURABLE_DRAFT");
    }
    this.saveStatus="saved";
    this.saveError=null;
    this.emit();
    return{restored:!!record,adapter:this.adapter.kind,documentId:this.document.id};
  }

  navigate(route){
    const primary=PRIMARY_NAV_ITEMS.map(({id})=>id);
    if(![...primary,"intake","advisor"].includes(route))return false;
    this.route=route;this.emit();return true;
  }

  snapshot(){return clone(this.document);}

  mutate(label,operation,{history=true,material=true}={}){
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
    this.saveStatus="saving";this.saveError=null;this.scheduleSave();this.emit();return true;
  }

  async mutateWithBlobs(
    label,
    operation,
    {blobs=[],history=true,material=true,reason="LOCAL_ASSET_MUTATION"}={}
  ){
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

  scheduleSave(){
    clearTimeout(this.timer);
    this.timer=setTimeout(()=>this.saveNow("AUTOSAVE").catch(()=>{}),AUTOSAVE_DELAY);
  }

  async saveNow(reason="EXPLICIT_SAVE"){
    clearTimeout(this.timer);
    const prior=this.pendingSave;
    const queued=(prior?prior.catch(()=>{}):Promise.resolve()).then(async()=>{
      this.saveStatus="saving";this.emit();
      const savedAt=this.now(),sequence=++this.saveSequence;
      const document=this.snapshot();
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
    });
    this.pendingSave=queued;
    return queued.finally(()=>{if(this.pendingSave===queued)this.pendingSave=null;});
  }

  undo(){
    const entry=this.undoStack.pop();if(!entry)return null;
    this.redoStack.push(entry);this.document=clone(entry.before);this.document.updatedAt=this.now();this.saveStatus="saving";this.scheduleSave();this.emit();return entry;
  }

  redo(){
    const entry=this.redoStack.pop();if(!entry)return null;
    this.undoStack.push(entry);this.document=clone(entry.after);this.document.updatedAt=this.now();this.saveStatus="saving";this.scheduleSave();this.emit();return entry;
  }

  historyStatus(){
    return{undoCount:this.undoStack.length,redoCount:this.redoStack.length,canUndo:this.undoStack.length>0,canRedo:this.redoStack.length>0,undoLabel:this.undoStack.at(-1)?.label||null,redoLabel:this.redoStack.at(-1)?.label||null};
  }

  async startNewTimeline(){
    const date=new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(this.clock());
    const version=await this.saveVersion(`Before starting over · ${date}`,"automatic");
    const preferences=clone(this.document.preferences);
    this.replace({...defaultDocument(),preferences},{label:"Start new timeline"});
    await this.saveNow("START_NEW_TIMELINE");
    return version;
  }

  async saveVersion(label,kind="manual"){
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
    await this.adapter.put("versions",version);
    return version;
  }

  async listVersions(){
    const values=await this.adapter.list("versions",(item)=>item.documentId===this.document.id);
    return values.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async restoreVersion(id){
    const version=await this.adapter.get("versions",id);
    if(!version)throw new Error("Version not found.");
    await this.saveVersion(`Before restore · ${new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(this.clock())}`,"automatic");
    this.replace(version.documentSnapshot,{label:"Restore version"});
    await this.saveNow("RESTORE_VERSION");
    return version;
  }
}

export {defaultDocument,migrateDocument};
