import {TimelineStore} from "./uxr-002/store.js";
import {
  addBuilderExam,
  deleteBuilderExamAttempt,
  finalizeBuilderExams,
  setBuilderExamSystem,
  updateBuilderExamAttempt
} from "./uxr-002/exam-integration.js";
import {
  beginBuilderEntryEdit,
  commitBuilderEntry,
  deleteBuilderEntry,
  ensureBuilderState,
  rankCountryMatches,
  typeaheadRows
} from "./uxr-002/builder.js";
import {
  buildCompletenessSummary,
  computeStoryChecks
} from "./uxr-002/review.js";
import {
  createCanvasState,
  installCanvas
} from "./uxr-002/canvas.js";
import {assignStableLanes} from "./uxr-002/adaptive-layout.js";
import {createAdvancedBoardRenderer} from "./uxr-002/advanced-board.js";
import {
  applyAdvancedObjectAction,
  applyAdvancedTypography,
  applyModeSwitch,
  createFlatColorBackground,
  createMediaElement,
  createPresetBackground,
  createTextBlock,
  createUploadedBackground,
  installAdvancedStudio,
  planModeSwitch,
  recordRecentColor,
  renderAdvancedStudio,
  renderModeDialog,
  relativeLuminanceFromRgb,
  sampleEyeDropper,
  setBackgroundDim,
  setLayoutLock,
  updateTextBlockContent
} from "./uxr-002/advanced-studio.js";
import {
  renderKeynoteClassicBoard,
  serializeKeynoteClassicSvg
} from "./uxr-002/board-renderer.js";
import {renderThemePicker} from "./uxr-002/theme-picker.js";
import {
  DEFAULT_THEME_ID,
  THEMES_BY_ID,
  applyThemeToTimelineRender
} from "./uxr-002/themes.js";
import {
  applyAdvisorRequest,
  buildAdvisorRequestPlan,
  cancelAdvisorRequest
} from "./uxr-002/advisor.js";
import {
  buildExportPreviewInput,
  installExportScreen,
  normalizeExportState,
  renderExportScreen
} from "./uxr-002/export-screen.js";
import {createLocalExportAdapter} from "./uxr-002/export-adapter.js";
import {
  IntakeStateMachine,
  applyApprovalBatchToDocument,
  installIntake,
  renderIntake
} from "./uxr-002/intake.js";
import {createD1408PdfIntakeAdapter} from "./uxr-002/intake-d1-408-adapter.js";
import {uid} from "./uxr-002/utils.js";

const CATEGORY_TO_407F=Object.freeze({
  work:"work",
  exams:"usmle",
  education:"education",
  clinical:"cl",
  research:"res",
  personal:"personal"
});

const CATEGORY_FROM_407F=Object.freeze({
  work:"work",
  usmle:"exams",
  education:"education",
  th:"clinical",
  cl:"clinical",
  res:"research",
  personal:"personal"
});

const VISIBILITY_TO_407F=Object.freeze({
  INTERVIEWER_SAFE:"safe",
  FULL_STORY:"full",
  ADVISOR_ONLY:"advisor",
  STUDENT_ONLY:"student",
  HIDDEN:"hidden"
});

const VISIBILITY_FROM_407F=Object.freeze({
  safe:"INTERVIEWER_SAFE",
  public:"INTERVIEWER_SAFE",
  full:"FULL_STORY",
  advisor:"ADVISOR_ONLY",
  student:"STUDENT_ONLY",
  hidden:"HIDDEN"
});

function clone(value){
  return value==null?value:structuredClone(value);
}

export function documentEventTo407F(event,index=0){
  const legacyCategory=event.fields?.legacy407fCategory;
  return{
    id:event.id||`event-${index+1}`,
    t:event.title||`Event ${index+1}`,
    cat:Object.hasOwn(CATEGORY_FROM_407F,legacyCategory)?
      legacyCategory:(CATEGORY_TO_407F[event.categoryId]||"personal"),
    mile:event.eventType==="milestone",
    s:event.startDate||"",
    e:event.eventType==="milestone"?null:(event.openEnded?null:(event.endDate||null)),
    vis:VISIBILITY_TO_407F[event.visibilityState]||"safe",
    loc:event.siteName||"",
    origin:event.sourceType||"engineering",
    notes:event.notes||"",
    lane:Number.isInteger(event.lane)?event.lane:null,
    provenance:clone(event.provenance||[]),
    fields:{
      ...clone(event.fields||{}),
      ...(event.dangerDot?{dangerDot:true}:{}),
      ...(event.provisional?{provisional:true}:{}),
      ...(event.actionChip?{actionChip:clone(event.actionChip)}:{}),
      ...(event.fillStyle?{fillStyle:event.fillStyle}:{}),
      ...(event.fillOpacity!=null?{fillOpacity:event.fillOpacity}:{}),
      ...(event.outlineStyle?{outlineStyle:event.outlineStyle}:{})
    }
  };
}

export function event407FToDocument(event,index=0){
  return{
    id:event.id||`event-${index+1}`,
    title:event.t||`Event ${index+1}`,
    categoryId:event.fields?.canonicalCategory||CATEGORY_FROM_407F[event.cat]||"personal",
    eventType:event.mile?"milestone":"duration",
    startDate:event.s||"",
    endDate:event.mile?null:(event.e||null),
    openEnded:!event.mile&&!event.e,
    visibilityState:VISIBILITY_FROM_407F[event.vis]||"INTERVIEWER_SAFE",
    siteName:event.loc||"",
    notes:event.notes||"",
    lane:Number.isInteger(event.lane)?event.lane:null,
    sourceType:event.origin||"407f",
    provenance:clone(event.provenance||[]),
    ...(event.fields?.dangerDot?{dangerDot:true}:{}),
    ...(event.fields?.provisional?{provisional:true}:{}),
    ...(event.fields?.actionChip?{actionChip:clone(event.fields.actionChip)}:{}),
    ...(event.fields?.fillStyle?{fillStyle:event.fields.fillStyle}:{}),
    ...(event.fields?.fillOpacity!=null?{fillOpacity:event.fields.fillOpacity}:{}),
    ...(event.fields?.outlineStyle?{outlineStyle:event.fields.outlineStyle}:{}),
    fields:{...clone(event.fields||{}),legacy407fCategory:event.cat||"personal"}
  };
}

export function applyDocumentTo407FState(document,state){
  const profile=document.studentProfile||{};
  state.user.events=(document.events||[])
    .filter((event)=>String(event?.startDate||"").trim())
    .map(documentEventTo407F);
  state.user.interview=clone(document.metadata?.interview||state.user.interview||{
    prog:"",
    date:"",
    label:""
  });
  state.profile={
    ...state.profile,
    name:profile.fullName||state.profile.name,
    country:profile.medicalSchoolCountry||state.profile.country,
    visa:profile.visaStatus||state.profile.visa,
    goal:profile.specialtyGoal||state.profile.goal,
    s1:document.metadata?.step1Score||state.profile.s1,
    s2:document.metadata?.step2Score||state.profile.s2
  };
  state.sticky=document.metadata?.stickyNote??state.sticky;
  state.media=clone(document.metadata?.boardMedia||state.media);
  state.wiz={
    ...state.wiz,
    ...clone(document.metadata?.wizard407F||{})
  };
  state.builder={
    ...state.builder,
    ...clone(document.metadata?.builder407F||{}),
    step:Number(document.builder?.step)||Number(state.builder?.step)||1,
    examSystems:clone(document.builder?.examSystems||[]),
    exams:clone(document.exams||[]),
    domainDrafts:clone(document.builder?.drafts||{}),
    domainEditing:clone(document.builder?.editing||{})
  };
  state.intake=clone(document.intake||state.intake||{});
  state.canvasTheme=document.theme==="season-one-board"?"season":
    document.theme==="clean-advisor-paper"||document.theme==="advisor-paper"?"paper":
    document.theme==="horizon"?"horizon":
    document.theme==="little-journeys"?"journeys":"keynote";
  state.saved=true;
  state.sel=null;
  return state;
}

export function apply407FStateToDocument(state,document){
  document.events=(state.user?.events||[]).map(event407FToDocument);
  document.studentProfile={
    ...document.studentProfile,
    fullName:state.wiz?.name||state.profile?.name||"",
    medicalSchool:state.wiz?.school||"",
    medicalSchoolCountry:state.profile?.country||"",
    graduationDate:state.wiz?.grad||"",
    graduationExpected:!!state.wiz?.notGraduated,
    degree:state.wiz?.degree||"",
    degreeOther:state.wiz?.degreeOther||"",
    visaStatus:state.profile?.visa||"",
    specialtyGoal:state.profile?.goal||""
  };
  document.theme=state.canvasTheme==="season"?"season-one-board":
    state.canvasTheme==="paper"?"advisor-paper":
    state.canvasTheme==="horizon"?"horizon":
    state.canvasTheme==="journeys"?"little-journeys":"keynote-classic";
  document.builder={
    ...document.builder,
    step:Number(state.builder?.step)||1,
    examSystems:clone(state.builder?.examSystems||[]),
    drafts:clone(state.builder?.domainDrafts||document.builder?.drafts||{}),
    editing:clone(state.builder?.domainEditing||document.builder?.editing||{}),
    touched:Object.entries(state.builder?.touched||{})
      .filter(([,touched])=>!!touched)
      .map(([step])=>Number(step)),
    skipped:Object.entries(state.builder?.skipped||{})
      .filter(([,skipped])=>!!skipped)
      .map(([step])=>Number(step))
  };
  document.exams=clone(state.builder?.exams||[]);
  document.metadata={
    ...document.metadata,
    source:"D1-402-407F-CANONICAL-RECOVERY",
    canonicalUi:"407F",
    productionWrites:false,
    interview:clone(state.user?.interview||{prog:"",date:"",label:""}),
    stickyNote:state.sticky||"",
    boardMedia:clone(state.media||{}),
    wizard407F:clone(state.wiz||{}),
    builder407F:clone(state.builder||{}),
    step1Score:state.profile?.s1||"",
    step2Score:state.profile?.s2||""
  };
  return document;
}

function stableState(state){
  return JSON.stringify({
    user:state.user,
    profile:state.profile,
    sticky:state.sticky,
    media:state.media,
    canvasTheme:state.canvasTheme,
    wiz:state.wiz,
    builder:state.builder
  });
}

const CANVAS_DETAIL_FIELDS=Object.freeze({
  clinical:Object.freeze([
    ["institution","Institution"],
    ["specialty","Specialty"],
    ["rotationType","Rotation type"],
    ["city","City"],
    ["state","State"],
    ["current","Currently on this rotation","checkbox"]
  ]),
  work:Object.freeze([
    ["role","Role / title"],
    ["organization","Organization"],
    ["country","Country"],
    ["city","City"],
    ["kind","Kind"],
    ["current","I still work here","checkbox"],
    ["description","One-line description"]
  ]),
  research:Object.freeze([
    ["projectTitle","Project title"],
    ["institution","Institution / lab"],
    ["role","Role"],
    ["roleOther","Role (other)"],
    ["ongoing","Ongoing","checkbox"],
    ["publicationStatus","Publication status"],
    ["journal","Journal / venue"],
    ["publicationYear","Publication year"],
    ["authorPosition","Author position"],
    ["doiOrPmid","DOI or PMID"],
    ["markPublication","Mark the publication on the timeline","checkbox"]
  ]),
  personal:Object.freeze([
    ["happened","What happened"],
    ["whenKind","When"],
    ["icon","Icon"]
  ]),
  exams:Object.freeze([
    ["examName","Exam"],
    ["result","Result"],
    ["score","Score"],
    ["attempt","Attempt"],
    ["studyStartDate","Started studying"]
  ])
});

function escapeMarkup(value){
  return String(value??"").replace(/[&<>"']/g,(character)=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  })[character]);
}

function persistedIntakeState(state){
  const value=clone(state);
  if(value.stage==="done"){
    value.candidates=(value.candidates||[])
      .filter((candidate)=>candidate.decision==="undecided");
  }
  return value;
}

function currentMonth(){
  return new Date().toISOString().slice(0,7);
}

function render407FThemedBoard(document,options={}){
  const base=renderKeynoteClassicBoard(document,options);
  const themeId=document?.theme||DEFAULT_THEME_ID;
  return themeId===DEFAULT_THEME_ID
    ?base
    :applyThemeToTimelineRender(base,themeId,{
      serializeScene:serializeKeynoteClassicSvg
    });
}

function autoArrange(document){
  const lanes=assignStableLanes(document.events||[]).laneById;
  for(const event of document.events||[]){
    event.lane=lanes[event.id];
    delete event.manualY;
  }
  return document;
}

function createObjectUrlRegistry(){
  const urls=new Map();
  return{
    get:(id)=>urls.get(String(id))||null,
    set(id,blob){
      const key=String(id);
      const prior=urls.get(key);
      if(prior)URL.revokeObjectURL(prior);
      const url=URL.createObjectURL(blob);
      urls.set(key,url);
      return url;
    },
    async hydrate(store,document){
      const advanced=document?.advanced||{};
      const ids=[
        advanced.background?.kind==="upload"?advanced.background.mediaId:null,
        ...(advanced.media||[]).map((item)=>item.id)
      ].filter(Boolean);
      let changed=false;
      for(const id of ids){
        if(urls.has(String(id)))continue;
        const blob=await store.adapter.getBlob(String(id));
        if(blob){this.set(id,blob);changed=true;}
      }
      return changed;
    },
    revokeAll(){
      for(const url of urls.values())URL.revokeObjectURL(url);
      urls.clear();
    }
  };
}

async function imageMetrics(file,{sample=false}={}){
  if(typeof createImageBitmap!=="function"){
    return{width:320,height:180,luminance:.5};
  }
  const bitmap=await createImageBitmap(file);
  try{
    const result={width:bitmap.width,height:bitmap.height,luminance:.5};
    if(sample){
      const canvas=document.createElement("canvas");
      canvas.width=24;
      canvas.height=24;
      const context=canvas.getContext("2d",{willReadFrequently:true});
      context.drawImage(bitmap,0,0,24,24);
      const pixels=context.getImageData(0,0,24,24).data;
      let red=0;
      let green=0;
      let blue=0;
      let count=0;
      for(let index=0;index<pixels.length;index+=4){
        if(pixels[index+3]===0)continue;
        red+=pixels[index];
        green+=pixels[index+1];
        blue+=pixels[index+2];
        count+=1;
      }
      if(count){
        result.luminance=relativeLuminanceFromRgb({
          r:red/count,
          g:green/count,
          b:blue/count
        });
      }
    }
    return result;
  }finally{
    bitmap.close?.();
  }
}

function chooseLocalFile(accept){
  return new Promise((resolve)=>{
    const input=document.createElement("input");
    input.type="file";
    input.accept=accept;
    input.addEventListener("change",()=>resolve(input.files?.[0]||null),{once:true});
    input.click();
  });
}

function canvasDetailField([key,label,type="text"],event){
  const value=event.fields?.[key]??"";
  if(type==="checkbox"){
    return `<label class="canvas407FDetailCheck"><input type="checkbox" data-canvas-detail-field="${key}" ${value?"checked":""}> <span>${escapeMarkup(label)}</span></label>`;
  }
  return `<label class="canvas407FDetailField"><span>${escapeMarkup(label)}</span><input type="text" data-canvas-detail-field="${key}" value="${escapeMarkup(value)}"></label>`;
}

function renderCanvasDetails(route,event){
  const domain=event.fields?.builderDomain||event.categoryId||"personal";
  const detailFields=CANVAS_DETAIL_FIELDS[domain]||[];
  const isMilestone=event.eventType==="milestone";
  return `<div class="canvas407FDetails" data-canvas-details-form data-event-id="${escapeMarkup(event.id)}">
    <div class="canvas407FDetailGrid">
      <label class="canvas407FDetailField canvas407FDetailWide"><span>Title</span><input type="text" data-canvas-detail-key="title" value="${escapeMarkup(event.title)}"></label>
      <label class="canvas407FDetailField"><span>Category</span><select data-canvas-detail-key="categoryId">${Object.keys(CATEGORY_TO_407F).map((category)=>`<option value="${category}" ${event.categoryId===category?"selected":""}>${escapeMarkup(category[0].toUpperCase()+category.slice(1))}</option>`).join("")}</select></label>
      <label class="canvas407FDetailField"><span>Start</span><input type="month" data-canvas-detail-key="startDate" value="${escapeMarkup(event.startDate)}"></label>
      ${isMilestone?"":`<label class="canvas407FDetailField"><span>End</span><input type="month" data-canvas-detail-key="endDate" value="${escapeMarkup(event.endDate||"")}"></label>`}
      <label class="canvas407FDetailField"><span>Visibility</span><select data-canvas-detail-key="visibilityState">
        <option value="INTERVIEWER_SAFE" ${event.visibilityState==="INTERVIEWER_SAFE"?"selected":""}>Show everyone</option>
        <option value="ADVISOR_ONLY" ${event.visibilityState==="ADVISOR_ONLY"?"selected":""}>Advisor only</option>
      </select></label>
      <label class="canvas407FDetailField"><span>Site / location</span><input type="text" data-canvas-detail-key="siteName" value="${escapeMarkup(event.siteName)}"></label>
      ${detailFields.map((field)=>canvasDetailField(field,event)).join("")}
      <label class="canvas407FDetailField canvas407FDetailWide"><span>Notes</span><textarea data-canvas-detail-key="notes">${escapeMarkup(event.notes)}</textarea></label>
    </div>
    <div class="canvas407FDetailActions">
      <button type="button" class="btnD go" data-canvas-details-save>Save changes</button>
      <button type="button" class="btnD alt" data-canvas-builder-step="${route.step}" data-event-id="${escapeMarkup(event.id)}">Open in Builder</button>
    </div>
  </div>`;
}

export async function boot407FEngineeringAdapter({
  bridge=window.D1_407F_TEST,
  store=new TimelineStore()
}={}){
  if(!bridge?.state||typeof bridge.renderAll!=="function"){
    throw new Error("407F bridge is unavailable");
  }

  const init=await store.initialize();
  const mediaUrls=createObjectUrlRegistry();
  const advancedBoardRenderer=createAdvancedBoardRenderer({
    baseRenderer:render407FThemedBoard,
    resolveObjectUrl:(id)=>mediaUrls.get(id)
  });
  const exportAdapter=createLocalExportAdapter({
    resolveObjectUrl:(id)=>mediaUrls.get(id)
  });
  let exportState=normalizeExportState({
    suggestionState:{
      advisorPaperPdfSuggestionShown:
        !!store.document.preferences?.advisorPaperPdfSuggestionShown
    }
  });
  let applying=false;
  let canvasController=null;
  let removeAdvanced=()=>{};
  let exportController=null;
  let exportRenderQueued=false;
  let intakeCleanup=()=>{};
  let intakeMachine=null;
  let canvasSyncing=false;
  let unsubscribeStore=()=>{};
  let onCanvasDetailsClick=()=>{};
  let onAdvancedObjectClick=()=>{};
  let onCanvasResize=()=>{};
  let on407FRendered=()=>{};
  let lastState=stableState(bridge.state);
  const watchedEvents=["input","change","click","pointerup","blur"];

  if(init.restored){
    applying=true;
    applyDocumentTo407FState(store.document,bridge.state);
    bridge.renderAll();
    lastState=stableState(bridge.state);
    applying=false;
  }else{
    store.mutate(
      "Seed canonical 407F document",
      (document)=>apply407FStateToDocument(bridge.state,document),
      {history:false}
    );
    lastState=stableState(bridge.state);
  }

  let pending=false;
  const reconcile=(event)=>{
    if(event?.target?.closest?.("#canvas407F"))return;
    if(applying||pending)return;
    pending=true;
    queueMicrotask(()=>{
      pending=false;
      reflectStoreStatus();
      const nextState=stableState(bridge.state);
      if(nextState===lastState)return;
      lastState=nextState;
      store.mutate(
        "407F canonical UI change",
        (document)=>apply407FStateToDocument(bridge.state,document)
      );
      if(bridge.state.view==="canvas")canvasController?.render();
    });
  };

  document.addEventListener("d1:407f-rendered",reconcile);
  for(const eventName of watchedEvents){
    document.addEventListener(eventName,reconcile,true);
  }
  window.addEventListener("beforeunload",()=>{
    document.removeEventListener("d1:407f-rendered",reconcile);
    for(const eventName of watchedEvents){
      document.removeEventListener(eventName,reconcile,true);
    }
    const nextState=stableState(bridge.state);
    if(nextState!==lastState){
      lastState=nextState;
      store.mutate(
        "407F page exit",
        (document)=>apply407FStateToDocument(bridge.state,document)
      );
    }
    canvasController?.destroy();
    removeAdvanced();
    exportController?.destroy();
    intakeCleanup();
    mediaUrls.revokeAll();
    unsubscribeStore();
    document.getElementById("canvas407F")?.removeEventListener("click",onCanvasDetailsClick);
    document.getElementById("canvas407F")?.removeEventListener("click",onAdvancedObjectClick);
    window.removeEventListener("resize",onCanvasResize);
    document.removeEventListener("d1:407f-rendered",on407FRendered);
    store.saveNow("PAGE_EXIT").catch(()=>{});
  },{once:true});

  const api={
    store,
    bridge,
    reconcile,
    applyDocument(){
      applying=true;
      applyDocumentTo407FState(store.document,bridge.state);
      bridge.renderAll();
      canvasController?.render();
      lastState=stableState(bridge.state);
      applying=false;
    }
  };
  const syncBridgeFromStore=()=>{
    applying=true;
    applyDocumentTo407FState(store.document,bridge.state);
    bridge.renderAll();
    canvasController?.render();
    lastState=stableState(bridge.state);
    applying=false;
  };
  const applyModeDecision=async(plan,decision)=>{
    if(plan.versionRequest&&["enter-advanced","confirm"].includes(decision)){
      await store.saveVersion(plan.versionRequest.name,plan.versionRequest.kind);
    }
    const result=applyModeSwitch(store.document,plan,decision);
    if(!result.changed)return result;
    if(result.effects?.rerunAutoArrange)autoArrange(result.document);
    store.replace(result.document,{
      label:plan.mutation?.label||"Change Canvas mode",
      history:!!plan.mutation
    });
    syncBridgeFromStore();
    return result;
  };
  const requestCanvasMode=(targetMode)=>{
    const plan=planModeSwitch(store.document,targetMode);
    if(plan.status==="noop")return;
    if(plan.status==="ready"){
      applyModeDecision(plan,"confirm")
        .catch((error)=>bridge.toast(String(error?.message||error)));
      return;
    }
    if(typeof bridge.openModal!=="function")return;
    bridge.openModal(renderModeDialog(plan.dialog));
    document.querySelector("[data-mode-dialog-secondary]")?.addEventListener("click",()=>{
      bridge.closeModal?.();
      const decision=targetMode==="advanced"?"stay-guided":"cancel";
      applyModeDecision(plan,decision)
        .catch((error)=>bridge.toast(String(error?.message||error)));
    },{once:true});
    document.querySelector("[data-mode-dialog-primary]")?.addEventListener("click",()=>{
      bridge.closeModal?.();
      const decision=targetMode==="advanced"?"enter-advanced":"return-guided";
      applyModeDecision(plan,decision)
        .catch((error)=>bridge.toast(String(error?.message||error)));
    },{once:true});
  };
  const persistAdvancedBlob=async(id,file,kind)=>{
    await store.adapter.putBlob(id,file,{
      kind,
      name:file.name,
      type:file.type,
      size:file.size,
      localOnly:true
    });
    mediaUrls.set(id,file);
  };
  const addAdvancedMedia=async(kind)=>{
    const accept=kind==="gif"
      ?".gif,image/gif"
      :kind==="logo"
        ?".png,.jpg,.jpeg,.gif,image/png,image/jpeg,image/gif"
        :".png,.jpg,.jpeg,image/png,image/jpeg";
    const file=await chooseLocalFile(accept);
    if(!file)return;
    const id=uid(`advanced-${kind}`);
    const metrics=await imageMetrics(file);
    const media=createMediaElement({
      id,
      kind,
      file,
      naturalWidth:metrics.width,
      naturalHeight:metrics.height,
      layerIndex:store.document.advanced?.media?.length||0
    });
    media.source.blobKey=id;
    await persistAdvancedBlob(id,file,kind);
    store.mutate(`Add ${kind}`,(document)=>{
      document.advanced.media.push(media);
    });
    syncBridgeFromStore();
    canvasController?.setUiState({advancedSelection:{type:"media",id}});
  };
  const addAdvancedBackground=async(file)=>{
    if(!file)return;
    const id=uid("advanced-background");
    const metrics=await imageMetrics(file,{sample:true});
    const background=createUploadedBackground(file,{
      id,
      luminance:metrics.luminance
    });
    background.source.blobKey=id;
    await persistAdvancedBlob(id,file,"background");
    store.mutate("Change background",(document)=>{
      document.advanced.background=background;
    });
    syncBridgeFromStore();
  };
  const currentTypography=(target)=>{
    if(target?.type==="headline"){
      return store.document.advanced?.headlineTypography||{
        font:"Inter",
        size:48,
        weight:700,
        color:"#191C21",
        alignment:"left"
      };
    }
    return(store.document.advanced?.textBlocks||[])
      .find((item)=>String(item.id)===String(target?.id))||null;
  };
  const applyTypographyChange=(changes,target)=>{
    if(!target)return;
    if(Object.values(changes||{}).some((value)=>value==null||value===""))return;
    const prior=currentTypography(target);
    if(!prior)return;
    const result=applyAdvancedTypography(store.document,target,{
      font:prior.font,
      size:Number(prior.size),
      weight:Number(prior.weight),
      color:prior.color,
      alignment:prior.alignment,
      ...changes
    });
    if(changes.color){
      result.advanced.recentColors=recordRecentColor(
        result.advanced.recentColors,
        changes.color
      );
    }
    store.replace(result,{label:"Change Advanced typography"});
    syncBridgeFromStore();
    canvasController?.setUiState({advancedSelection:target});
  };
  const advancedHooks=()=>({
    onAction:(action)=>{
      if(action==="background"){
        canvasController?.setUiState((state)=>({
          ...state,
          backgroundOpen:!state.backgroundOpen
        }));
      }else if(action==="text"){
        const id=uid("advanced-text");
        store.mutate("Add text",(document)=>{
          document.advanced.textBlocks.push(createTextBlock({
            id,
            text:"",
            layerIndex:document.advanced.textBlocks.length
          }));
        });
        syncBridgeFromStore();
        canvasController?.setUiState({advancedSelection:{type:"text",id}});
      }else if(["image","gif","logo"].includes(action)){
        addAdvancedMedia(action)
          .catch((error)=>bridge.toast(String(error?.message||error)));
      }
    },
    onObjectAction:(action,target)=>{
      const result=applyAdvancedObjectAction(store.document,target,action);
      if(!result.changed)return;
      store.replace(result.document,{label:result.mutation.label});
      syncBridgeFromStore();
      canvasController?.setUiState({advancedSelection:result.selection});
    },
    onTypography:(changes,target)=>applyTypographyChange(changes,target),
    onTextContent:(text,target)=>{
      const result=updateTextBlockContent(store.document,target,text);
      store.replace(result,{label:"Edit Advanced text"});
      syncBridgeFromStore();
      canvasController?.setUiState({advancedSelection:target});
    },
    onBackgroundTab:(backgroundTab)=>canvasController?.setUiState({backgroundTab}),
    onBackgroundPreset:(presetId)=>{
      store.mutate("Change background",(document)=>{
        document.advanced.background=createPresetBackground(presetId);
      });
      syncBridgeFromStore();
    },
    onBackgroundUpload:(file)=>{
      addAdvancedBackground(file)
        .catch((error)=>bridge.toast(String(error?.message||error)));
    },
    onBackgroundDim:(dim)=>{
      store.mutate("Adjust background readability",(document)=>{
        document.advanced.background=setBackgroundDim(document.advanced.background,dim);
      });
      syncBridgeFromStore();
    },
    onColor:(color)=>{
      if(!color)return;
      store.mutate("Change background color",(document)=>{
        document.advanced.background=createFlatColorBackground(color);
        document.advanced.recentColors=recordRecentColor(
          document.advanced.recentColors,
          color
        );
      });
      syncBridgeFromStore();
    },
    onHex:(color)=>{
      if(color)advancedHooks().onColor(color);
    },
    onEyeDropper:(_event,context)=>{
      sampleEyeDropper(window)
        .then((sample)=>{
          if(!sample?.color)return;
          if(context?.scope==="typography"){
            applyTypographyChange({color:sample.color},context.target);
          }else{
            advancedHooks().onColor(sample.color);
          }
        })
        .catch((error)=>{
          if(error?.name!=="AbortError")bridge.toast(String(error?.message||error));
        });
    },
    onLayoutLock:(locked)=>{
      const result=setLayoutLock(store.document,locked);
      if(!result.changed)return;
      if(result.effects?.rerunAutoArrange)autoArrange(result.document);
      store.replace(result.document,{label:result.mutation.label});
      syncBridgeFromStore();
    }
  });
  const renderExportPreview=(input)=>{
    const rendered=advancedBoardRenderer(input.timeline,{
      ...input.rendererOptions,
      currentMonth:currentMonth()
    });
    return`<div class="board-preview canonical-board-preview export407FBoard" role="img" aria-label="Export preview" data-theme="${escapeMarkup(input.timeline.theme||DEFAULT_THEME_ID)}">${rendered.svg}</div>`;
  };
  const queueExportRender=()=>{
    if(exportRenderQueued)return;
    exportRenderQueued=true;
    queueMicrotask(()=>{
      exportRenderQueued=false;
      if(bridge.state.view==="export")renderExportHost();
    });
  };
  const openExportThemeDialog=()=>{
    if(typeof bridge.openModal!=="function")return;
    const picker=renderThemePicker(store.document)
      .replace("data-theme-picker hidden","data-theme-picker");
    bridge.openModal(`<section class="export407FThemeDialog" role="dialog" aria-modal="true" aria-label="Choose theme">
      <div class="export407FDialogHeader">
        <h2>Theme</h2>
        <button type="button" class="btnD alt sm" data-export-theme-close>Close</button>
      </div>
      ${picker}
    </section>`);
    document.querySelector("[data-export-theme-close]")?.addEventListener("click",()=>{
      bridge.closeModal?.();
    },{once:true});
    document.querySelectorAll("#modalIn [data-select-theme]").forEach((button)=>{
      button.addEventListener("click",()=>{
        store.mutate("Change theme",(document)=>{
          document.theme=button.dataset.selectTheme;
        });
        bridge.closeModal?.();
        syncBridgeFromStore();
        queueExportRender();
      },{once:true});
    });
    document.querySelector("#modalIn [data-open-backgrounds]")?.addEventListener("click",()=>{
      bridge.closeModal?.();
      bridge.go("canvas");
      queueMicrotask(()=>requestCanvasMode("advanced"));
    },{once:true});
  };
  const openAdvisorPaperSuggestion=(suggestion)=>{
    if(typeof bridge.openModal!=="function"){
      bridge.toast(suggestion.message);
      return;
    }
    bridge.openModal(`<section class="export407FSuggestionDialog" role="dialog" aria-modal="true" aria-labelledby="export407FSuggestionTitle">
      <h2 id="export407FSuggestionTitle">${escapeMarkup(suggestion.message)}</h2>
      <div>
        <button type="button" class="btnD alt" data-export-suggestion-dismiss>Not now</button>
        <button type="button" class="btnD go" data-export-suggestion-apply>${escapeMarkup(suggestion.actionLabel)}</button>
      </div>
    </section>`);
    document.querySelector("[data-export-suggestion-dismiss]")?.addEventListener("click",()=>{
      bridge.closeModal?.();
      suggestion.dismiss?.();
    },{once:true});
    document.querySelector("[data-export-suggestion-apply]")?.addEventListener("click",()=>{
      bridge.closeModal?.();
      suggestion.apply?.();
    },{once:true});
  };
  function renderExportHost(){
    const exportHost=document.getElementById("export407F");
    if(!exportHost)return;
    exportController?.destroy();
    let previewHtml="";
    if((store.document.events||[]).length){
      try{
        previewHtml=renderExportPreview(
          buildExportPreviewInput(store.document,exportState)
        );
      }catch(error){
        bridge.toast(String(error?.message||error));
      }
    }
    exportHost.innerHTML=renderExportScreen(store.document,{
      state:exportState,
      previewHtml
    });
    exportController=installExportScreen(exportHost,store.document,{
      state:exportState,
      renderPreview:renderExportPreview,
      exportAdapter,
      toast:(message)=>bridge.toast(message),
      requestVersion:(label,kind)=>store.saveVersion(label,kind),
      onStateChange:(state,reason)=>{
        exportState=state;
        if(["audience","format","print-margins","export-finish"].includes(reason)){
          queueExportRender();
        }
      },
      onOpenBuilder:()=>bridge.go("builder"),
      onThemeTrigger:openExportThemeDialog,
      onThemeChange:(themeId,{suggestionState}={})=>{
        store.mutate("Change theme",(document)=>{
          document.theme=themeId;
          if(suggestionState?.advisorPaperPdfSuggestionShown){
            document.preferences.advisorPaperPdfSuggestionShown=true;
          }
        });
        syncBridgeFromStore();
        queueExportRender();
      },
      onSuggestionStateChange:(suggestionState)=>{
        store.mutate("Record export suggestion",(document)=>{
          document.preferences.advisorPaperPdfSuggestionShown=
            !!suggestionState.advisorPaperPdfSuggestionShown;
        },{history:false,material:false});
      },
      onAdvisorPaperSuggestion:openAdvisorPaperSuggestion,
      onInterviewSeasonChange:(value)=>{
        store.mutate("Set interview season",(document)=>{
          document.studentProfile.interviewSeason=value;
        });
        syncBridgeFromStore();
        queueExportRender();
      },
      onAdvisorRequest:async(request)=>{
        const plan=buildAdvisorRequestPlan(store.document,{
          message:request.message,
          clock:()=>new Date(request.requestedAt)
        });
        await store.saveVersion(plan.versionRequest.name,plan.versionRequest.kind);
        const result=applyAdvisorRequest(store.document,plan);
        await store.adapter.put("syncRecords",{
          id:plan.route,
          kind:"local-advisor-session",
          timelineId:store.document.id,
          route:plan.route,
          createdAt:plan.handoff.createdAt,
          handoff:plan.handoff,
          localOnly:true,
          externalApiCalls:false,
          productionWrites:false
        });
        store.replace(result.document,{label:result.mutation.label});
        syncBridgeFromStore();
        queueExportRender();
        return{versionHandled:true,route:plan.route};
      },
      onAdvisorCancel:()=>{
        const result=cancelAdvisorRequest(store.document);
        if(!result.changed)return;
        store.replace(result.document,{label:result.mutation.label});
        syncBridgeFromStore();
        queueExportRender();
      },
      onAdvisorComments:()=>{
        bridge.go("canvas");
        canvasController?.setUiState({
          commentsOpen:true,
          activeAdvisorPinId:null
        });
      }
    });
    api.export=exportController;
    exportController.refreshPreview();
  }
  on407FRendered=()=>{
    if(bridge.state.view==="export")queueExportRender();
  };
  document.addEventListener("d1:407f-rendered",on407FRendered);
  const commitExamMutation=(label,mutation)=>{
    store.mutate(label,(document)=>{
      apply407FStateToDocument(bridge.state,document);
      mutation(document);
    });
    applying=true;
    applyDocumentTo407FState(store.document,bridge.state);
    bridge.renderAll();
    canvasController?.render();
    lastState=stableState(bridge.state);
    applying=false;
  };
  api.exam=Object.freeze({
    setSystem(system,active){
      commitExamMutation("Choose exam systems",(document)=>{
        setBuilderExamSystem(document,system,active);
      });
    },
    add(system,examId){
      commitExamMutation("Add exam",(document)=>{
        addBuilderExam(document,system,examId);
      });
    },
    update(recordId,changes){
      commitExamMutation("Update exam",(document)=>{
        updateBuilderExamAttempt(document,recordId,changes);
      });
    },
    delete(recordId){
      commitExamMutation("Delete exam",(document)=>{
        deleteBuilderExamAttempt(document,recordId);
      });
    },
    finalize(){
      commitExamMutation("Finish Builder exams",(document)=>{
        finalizeBuilderExams(document);
      });
    }
  });
  const commitDomainMutation=(label,mutation)=>{
    let result=null;
    store.mutate(label,(document)=>{
      apply407FStateToDocument(bridge.state,document);
      ensureBuilderState(document);
      result=mutation(document);
    });
    applying=true;
    applyDocumentTo407FState(store.document,bridge.state);
    bridge.renderAll();
    canvasController?.render();
    lastState=stableState(bridge.state);
    applying=false;
    return result;
  };
  api.domain=Object.freeze({
    updateDraft(domain,changes){
      return commitDomainMutation(`Update ${domain} entry`,(document)=>{
        const builder=ensureBuilderState(document);
        builder.drafts[domain]={...builder.drafts[domain],...clone(changes||{})};
        return clone(builder.drafts[domain]);
      });
    },
    save(domain,entry){
      return commitDomainMutation(`Save ${domain} entry`,(document)=>
        commitBuilderEntry(document,domain,clone(entry||{}))
      );
    },
    edit(eventId){
      return commitDomainMutation("Edit Builder entry",(document)=>
        beginBuilderEntryEdit(document,eventId)
      );
    },
    delete(eventId){
      return commitDomainMutation("Delete Builder entry",(document)=>
        deleteBuilderEntry(document,eventId)
      );
    },
    cancel(domain){
      return commitDomainMutation(`Cancel ${domain} entry`,(document)=>{
        const builder=ensureBuilderState(document);
        builder.drafts[domain]={};
        delete builder.editing[domain];
        return true;
      });
    }
  });
  api.typeahead=Object.freeze({
    rows(query,matches,options){
      return typeaheadRows(query,clone(matches||[]),clone(options||{}));
    },
    rankCountries(matches,options){
      return rankCountryMatches(clone(matches||[]),clone(options||{}));
    }
  });
  api.review=Object.freeze({
    snapshot(options={}){
      const current=clone(store.document);
      apply407FStateToDocument(bridge.state,current);
      return{
        completeness:buildCompletenessSummary(current),
        checks:computeStoryChecks(current,clone(options||{}))
      };
    }
  });
  const reflectStoreStatus=()=>{
    const save=document.getElementById("hudSave");
    if(!save)return;
    const status=store.saveStatus;
    save.textContent=status==="error"?"COULDN’T SAVE — RETRY":status==="saving"?"SAVING…":"SAVED JUST NOW";
    save.className=`saveState ${status==="saved"?"isSaved":status==="saving"?"isSaving":"isError"}`;
  };
  unsubscribeStore=store.subscribe(reflectStoreStatus);

  const canvasHost=document.getElementById("canvas407F");
  if(canvasHost){
    const syncCanvasDocument=()=>{
      if(canvasSyncing)return;
      canvasSyncing=true;
      syncBridgeFromStore();
      reflectStoreStatus();
      canvasSyncing=false;
    };
    canvasController=installCanvas(canvasHost,store,{
      state:createCanvasState({
        viewportWidth:window.innerWidth,
        mode:store.document.mode
      }),
      renderBoard:advancedBoardRenderer,
      renderTheme:(document)=>renderThemePicker(document),
      renderAdvanced:(document,options)=>renderAdvancedStudio(document,{
        ...options,
        themeSwatches:THEMES_BY_ID[document.theme]
      }),
      renderDetails:renderCanvasDetails,
      onStateChange:syncCanvasDocument,
      onOpenBuilder:()=>bridge.go("builder"),
      onDateControl:({edge,event})=>{
        canvasController?.setUiState({detailsEventId:event.id});
        queueMicrotask(()=>{
          canvasHost.querySelector(`[data-canvas-detail-key="${edge==="end"?"endDate":"startDate"}"]`)?.focus();
        });
      },
      onAdvanced:()=>requestCanvasMode("advanced"),
      onGuided:()=>requestCanvasMode("guided"),
      onSelectTheme:(themeId)=>{
        store.mutate("Change theme",(document)=>{
          document.theme=themeId;
        });
        syncBridgeFromStore();
        bridge.toast("Theme applied");
      },
      onDropReflow:syncCanvasDocument,
      onToast:(message)=>bridge.toast(message)
    });
    api.canvas=canvasController;
    removeAdvanced=installAdvancedStudio(canvasHost,advancedHooks());

    onCanvasDetailsClick=(event)=>{
      const saveButton=event.target.closest?.("[data-canvas-details-save]");
      const builderButton=event.target.closest?.("[data-canvas-builder-step]");
      if(saveButton){
        const form=saveButton.closest("[data-canvas-details-form]");
        const eventId=form?.dataset?.eventId;
        store.mutate("Edit Canvas event details",(document)=>{
          const selected=document.events.find((item)=>String(item.id)===String(eventId));
          if(!selected)return;
          for(const input of form.querySelectorAll("[data-canvas-detail-key]")){
            const key=input.dataset.canvasDetailKey;
            selected[key]=input.value;
          }
          for(const input of form.querySelectorAll("[data-canvas-detail-field]")){
            const key=input.dataset.canvasDetailField;
            selected.fields={...(selected.fields||{}),[key]:input.type==="checkbox"?input.checked:input.value};
          }
          selected.title=String(selected.title||"").trim()||"Untitled event";
          if(selected.eventType!=="milestone"){
            selected.endDate=selected.endDate||null;
            selected.openEnded=!selected.endDate;
          }
        });
        canvasController.render({animateLayout:true});
        bridge.toast("Event details saved");
        return;
      }
      if(builderButton){
        const step=Math.max(1,Math.min(7,Number(builderButton.dataset.canvasBuilderStep)||1));
        const eventId=builderButton.dataset.eventId;
        if(step>=3&&step<=6&&eventId)api.domain.edit(eventId);
        bridge.state.builder.step=step;
        bridge.go("builder");
      }
    };
    onAdvancedObjectClick=(event)=>{
      const media=event.target.closest?.("[data-advanced-media]");
      const text=event.target.closest?.("[data-advanced-text]");
      const headline=event.target.closest?.("[data-board-headline]");
      const selection=media
        ?{type:"media",id:media.dataset.advancedMedia}
        :text
          ?{type:"text",id:text.dataset.advancedText}
          :headline
            ?{type:"headline",id:"headline"}
            :null;
      if(selection)canvasController?.setUiState({advancedSelection:selection});
    };
    canvasHost.addEventListener("click",onCanvasDetailsClick);
    canvasHost.addEventListener("click",onAdvancedObjectClick);
    onCanvasResize=()=>canvasController?.setResponsiveWidth(window.innerWidth);
    window.addEventListener("resize",onCanvasResize);
    mediaUrls.hydrate(store,store.document)
      .then((changed)=>{
        if(changed)canvasController?.render();
      })
      .catch((error)=>bridge.toast(String(error?.message||error)));
  }
  if(document.getElementById("export407F"))renderExportHost();
  const intakeHost=document.getElementById("intake407F");
  if(intakeHost){
    const intakeAdapter=window.D1_TIMELINE_INTAKE_ADAPTER||createD1408PdfIntakeAdapter();
    window.D1_TIMELINE_INTAKE_ADAPTER=intakeAdapter;
    const renderIntakePreview=(previewEvents)=>{
      const replacementIds=new Set((previewEvents||[]).map(({id})=>String(id)));
      const events=[
        ...(store.document.events||[]).filter(({id})=>!replacementIds.has(String(id))),
        ...(previewEvents||[])
      ];
      if(!events.length){
        return`<div class="intake407FPreviewEmpty"><strong>Accepted suggestions appear here.</strong><span>Your timeline remains unchanged until final approval.</span></div>`;
      }
      try{
        const rendered=renderKeynoteClassicBoard({
          ...clone(store.document),
          events
        },{
          currentMonth:currentMonth(),
          audience:"EVERYTHING"
        });
        return`<div class="intake407FBoardPreview">${rendered.svg}</div>`;
      }catch{
        return`<div class="intake407FPreviewEmpty"><strong>${events.length} event${events.length===1?"":"s"} ready to preview.</strong><span>The exact board will settle after approval.</span></div>`;
      }
    };
    const renderIntakeHost=(state)=>{
      intakeHost.innerHTML=renderIntake(state,{
        existingEvents:store.document.events,
        renderPreview:renderIntakePreview
      });
    };
    const openIntakeDialog=(dialog)=>{
      if(typeof bridge.openModal!=="function")return;
      bridge.openModal(`<section class="intake407FDialog" role="dialog" aria-modal="true" aria-labelledby="intake407FDialogTitle">
        <h2 id="intake407FDialogTitle">${escapeMarkup(dialog.title)}</h2>
        <p>${escapeMarkup(dialog.body)}</p>
        <div>
          <button type="button" class="btnD alt" data-intake-dialog-secondary>${escapeMarkup(dialog.secondaryLabel||"Cancel")}</button>
          <button type="button" class="btnD go" data-intake-dialog-primary>${escapeMarkup(dialog.primaryLabel||"Continue")}</button>
        </div>
      </section>`);
      document.querySelector("[data-intake-dialog-secondary]")?.addEventListener("click",()=>{
        bridge.closeModal?.();
        dialog.onSecondary?.();
      },{once:true});
      document.querySelector("[data-intake-dialog-primary]")?.addEventListener("click",()=>{
        bridge.closeModal?.();
        dialog.onPrimary?.();
      },{once:true});
    };
    intakeMachine=new IntakeStateMachine({
      adapter:intakeAdapter,
      initialState:store.document.intake,
      existingEvents:store.document.events
    });
    intakeCleanup=installIntake(intakeHost,intakeMachine,{
      onChange:(state)=>{
        renderIntakeHost(state);
        if(state.stage==="upload")intakeMachine.existingEvents=clone(store.document.events||[]);
        store.mutate("Update Intake flow",(document)=>{
          document.intake=persistedIntakeState(state);
        },{history:false,material:false});
        bridge.state.intake=persistedIntakeState(state);
        bridge.renderAll();
      },
      onNavigate:(route)=>bridge.go(route),
      onToast:(message)=>bridge.toast(message),
      onError:(error)=>bridge.toast(String(error?.message||error)),
      openDialog:openIntakeDialog,
      saveVersion:(name,kind)=>store.saveVersion(name,kind),
      applyBatch:async(batch,contract)=>{
        let result=null;
        store.mutate(contract?.label||"Add document suggestions",(document)=>{
          result=applyApprovalBatchToDocument(document,batch);
        });
        syncBridgeFromStore();
        return result;
      },
      deleteSource:async(file)=>{
        if(typeof intakeAdapter.deleteSource==="function"){
          await intakeAdapter.deleteSource(file);
        }
      }
    });
    api.intake=Object.freeze({
      machine:intakeMachine,
      adapter:intakeAdapter,
      render:()=>renderIntakeHost(intakeMachine.snapshot())
    });
  }
  api.undo=()=>{
    const entry=store.undo();
    if(!entry)return null;
    applying=true;
    applyDocumentTo407FState(store.document,bridge.state);
    bridge.renderAll();
    canvasController?.render();
    reflectStoreStatus();
    lastState=stableState(bridge.state);
    applying=false;
    return entry;
  };
  window.D1_407F_ENGINEERING=api;
  document.dispatchEvent(new CustomEvent("d1:407f-engineering-ready",{
    detail:{documentId:store.document.id,restored:init.restored,adapter:store.adapter.kind}
  }));
  return api;
}

if(typeof window!=="undefined"){
  boot407FEngineeringAdapter().catch((error)=>{
    console.error("407F engineering adapter failed",error);
    document.dispatchEvent(new CustomEvent("d1:407f-engineering-error",{
      detail:{message:String(error?.message||error)}
    }));
  });
}
