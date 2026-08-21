import {BUILDER_STEPS,NAV_ITEMS} from "./constants.js";
import {assignStableLanes} from "./adaptive-layout.js";
import {createAdvancedBoardRenderer} from "./advanced-board.js";
import {
  ADVISOR_SESSION_THEME_ID,
  addAdvisorComment,
  advisorQuestionModel,
  advisorSessionRoute,
  applyAdvisorRequest,
  approveAdvisorReview,
  buildAdvisorRequestPlan,
  cancelAdvisorRequest,
  deleteAdvisorComment,
  hideAdvisorQuestion,
  installAdvisorWorkflow,
  isActiveAdvisorSession,
  questionHighlightEffect,
  renderAdvisorSession,
  renderStudentCommentLayer,
  requestAdvisorChanges,
  resolveAdvisorComment,
  setChecklistState,
  updateAdvisorComment
} from "./advisor.js";
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
  relativeLuminanceFromRgb,
  sampleEyeDropper,
  setBackgroundDim,
  setLayoutLock,
  updateTextBlockContent
} from "./advanced-studio.js";
import {
  beginBuilderEntryEdit,
  installBuilder as installBuilderScreen,
  renderBuilder as renderBuilderScreen,
  renderBuilderEntryDetails
} from "./builder.js";
import {createCanvasState,installCanvas as installCanvasScreen} from "./canvas.js";
import {createRuntimeDatasets} from "./datasets.js";
import {updateBuilderExamAttempt} from "./exam-integration.js";
import {
  installExportScreen,
  normalizeExportState,
  renderExportScreen
} from "./export-screen.js";
import {createLocalExportAdapter} from "./export-adapter.js";
import {renderHome,installHome} from "./home.js";
import {icon} from "./icons.js";
import {
  IntakeStateMachine,
  applyApprovalBatchToDocument,
  installIntake as installIntakeScreen,
  renderIntake as renderIntakeScreen
} from "./intake.js";
import {createD1408PdfIntakeAdapter} from "./intake-d1-408-adapter.js";
import {monthFieldMarkup,installMonthFields} from "./month-field.js";
import {announce,closeOverlay,openDialog,showToast} from "./overlays.js";
import {canonicalBoardPreview} from "./preview.js";
import {openQualityGuardian} from "./quality-guardian.js";
import {
  installFocusTrap,
  installResponsiveRuntime,
  renderResponsiveFrame
} from "./responsive.js";
import {TimelineStore} from "./store.js";
import {
  createLocalEntitlementAdapter,
  createProductionEntitlementBoundaryAdapter,
  evaluateTimelineEntitlement,
  localEntitlementScenarioFromLocation
} from "./entitlement.js";
import {renderThemePicker} from "./theme-picker.js";
import {THEMES_BY_ID} from "./themes.js";
import {escapeHtml,uid} from "./utils.js";

function autosaveText(store){
  if(store.saveStatus==="saving")return"Saving…";
  if(store.saveStatus==="error")return`<button type="button" class="save-error" data-retry-save>Couldn't save — retry</button>`;
  return"Saved just now";
}

function createIntakeMachine(store,{file=null,initialState=store.document.intake}={}){
  const machine=new IntakeStateMachine({
    adapter:window.D1_TIMELINE_INTAKE_ADAPTER||null,
    initialState,
    existingEvents:store.document.events
  });
  if(file)machine.receiveFile(file);
  return machine;
}

function persistedIntakeState(state){
  const value=structuredClone(state);
  if(value.stage==="done"){
    value.candidates=(value.candidates||[]).filter((candidate)=>candidate.decision==="undecided");
  }
  return value;
}

function intakePreview(store,events){
  const replacementIds=new Set((events||[]).map((event)=>event.id));
  return canonicalBoardPreview({
    ...store.document,
    events:[
      ...store.document.events.filter((event)=>!replacementIds.has(event.id)),
      ...(events||[])
    ]
  },{
    label:"Accepted document suggestions preview",
    audience:"EVERYTHING"
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
      canvas.width=24;canvas.height=24;
      const context=canvas.getContext("2d",{willReadFrequently:true});
      context.drawImage(bitmap,0,0,24,24);
      const pixels=context.getImageData(0,0,24,24).data;
      let red=0,green=0,blue=0,count=0;
      for(let index=0;index<pixels.length;index+=4){
        if(pixels[index+3]===0)continue;
        red+=pixels[index];green+=pixels[index+1];blue+=pixels[index+2];count+=1;
      }
      if(count)result.luminance=relativeLuminanceFromRgb({
        r:red/count,g:green/count,b:blue/count
      });
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

function openThemeOverlay(store,{onBackgrounds=()=>{}}={}){
  const root=document.querySelector("#overlay-root");
  closeOverlay({restoreFocus:false});
  root._opener=document.activeElement;
  const picker=renderThemePicker(store.document).replace("data-theme-picker hidden","data-theme-picker");
  root.innerHTML=`<div class="overlay-scrim" data-theme-overlay-dismiss>
    <section class="dialog theme-dialog" role="dialog" aria-modal="true" aria-label="Choose theme">
      <button type="button" class="dialog-close icon-button" data-theme-overlay-close aria-label="Close">×</button>
      ${picker}
    </section>
  </div>`;
  const dismiss=()=>closeOverlay();
  root.querySelector("[data-theme-overlay-close]")?.addEventListener("click",dismiss);
  root.querySelector("[data-theme-overlay-dismiss]")?.addEventListener("pointerdown",(event)=>{
    if(event.target.matches("[data-theme-overlay-dismiss]"))dismiss();
  });
  root.querySelectorAll("[data-select-theme]").forEach((button)=>button.addEventListener("click",()=>{
    store.mutate("Change theme",(document)=>{document.theme=button.dataset.selectTheme;});
    dismiss();
  }));
  root.querySelector("[data-open-backgrounds]")?.addEventListener("click",()=>{
    dismiss();
    onBackgrounds();
  });
  const trap=installFocusTrap(root.querySelector(".theme-dialog"),{
    opener:root._opener,
    onEscape:dismiss,
    restoreFocus:false
  });
  root._cleanup=()=>trap.destroy();
}

function openKeyboardShortcutSheet(){
  const root=document.querySelector("#overlay-root");
  closeOverlay({restoreFocus:false});
  root._opener=document.activeElement;
  root.innerHTML=`<div class="overlay-scrim" data-shortcuts-dismiss>
    <section class="dialog shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
      <button type="button" class="dialog-close icon-button" data-shortcuts-close aria-label="Close">${icon("x",{size:20})}</button>
      <h2 id="shortcuts-title">Keyboard shortcuts</h2>
      <dl class="shortcut-list">
        <div><dt><kbd>⌘/Ctrl</kbd> + <kbd>Z</kbd></dt><dd>Undo</dd></div>
        <div><dt><kbd>Shift</kbd> + <kbd>⌘/Ctrl</kbd> + <kbd>Z</kbd></dt><dd>Redo</dd></div>
        <div><dt><kbd>⌘/Ctrl</kbd> + <kbd>E</kbd></dt><dd>Go to Export</dd></div>
        <div><dt><kbd>Esc</kbd></dt><dd>Close or deselect</dd></div>
        <div><dt><kbd>?</kbd></dt><dd>Keyboard shortcuts</dd></div>
      </dl>
    </section>
  </div>`;
  const dismiss=()=>closeOverlay();
  root.querySelector("[data-shortcuts-close]")?.addEventListener("click",dismiss);
  root.querySelector("[data-shortcuts-dismiss]")?.addEventListener("pointerdown",(event)=>{
    if(event.target.matches("[data-shortcuts-dismiss]"))dismiss();
  });
  const trap=installFocusTrap(root.querySelector(".shortcut-dialog"),{
    opener:root._opener,
    onEscape:dismiss,
    restoreFocus:false
  });
  root._cleanup=()=>trap.destroy();
}

function openCanvasMonthDialog({
  title,
  value="",
  onSave=()=>{}
}={}){
  const root=document.querySelector("#overlay-root");
  closeOverlay({restoreFocus:false});
  root._opener=document.activeElement;
  let selectedValue=value;
  root.innerHTML=`<div class="overlay-scrim" data-month-dialog-dismiss>
    <section class="dialog canvas-month-dialog" role="dialog" aria-modal="true" aria-labelledby="canvas-month-dialog-title">
      <button type="button" class="dialog-close icon-button" data-month-dialog-close aria-label="Close">${icon("x",{size:20})}</button>
      <h2 id="canvas-month-dialog-title">${escapeHtml(title||"Choose month")}</h2>
      ${monthFieldMarkup({id:"canvas-event-month",label:"Month",value,required:true})}
      <div class="dialog-actions">
        <button type="button" class="button secondary" data-month-dialog-cancel>Cancel</button>
        <button type="button" class="button primary" data-month-dialog-save>Save</button>
      </div>
    </section>
  </div>`;
  const dismiss=()=>closeOverlay();
  root.querySelector("[data-month-dialog-close]")?.addEventListener("click",dismiss);
  root.querySelector("[data-month-dialog-cancel]")?.addEventListener("click",dismiss);
  root.querySelector("[data-month-dialog-dismiss]")?.addEventListener("pointerdown",(event)=>{
    if(event.target.matches("[data-month-dialog-dismiss]"))dismiss();
  });
  installMonthFields(root,{onCommit:(_id,next)=>{selectedValue=next;}});
  root.querySelector("[data-month-dialog-save]")?.addEventListener("click",()=>{
    if(!selectedValue)return;
    onSave(selectedValue);
    dismiss();
  });
  const trap=installFocusTrap(root.querySelector(".canvas-month-dialog"),{
    opener:root._opener,
    onEscape:dismiss,
    restoreFocus:false
  });
  root._cleanup=()=>trap.destroy();
}

function responsiveFrame(store,screen,{
  fullContent,
  viewOnlyContent=fullContent,
  previewContent=fullContent
}){
  if(!store.responsive)return fullContent;
  return renderResponsiveFrame({
    model:store.responsive,
    screen,
    fullContent,
    viewOnlyContent,
    previewContent
  });
}

function renderShell(store,screen){
  const pinned=store.document.preferences?.railPinned;
  return`<div class="app-shell ${pinned?"rail-pinned":""}">
    <header class="top-header">
      <div class="header-left">
        <button type="button" class="matrix-link" data-matrix-link>← Matrix</button>
        <span class="wordmark">Timeline Builder</span>
      </div>
      <div class="header-actions">
        <span class="autosave-indicator" data-autosave>${autosaveText(store)}</span>
        <button type="button" class="button secondary compact" data-quality-check>Check my timeline</button>
        <span class="export-button-wrap" ${store.document.events.length?"":'title="Add at least one event first"'}>
          <button type="button" class="button primary header-export" data-header-export ${store.document.events.length?"":'disabled aria-describedby="export-disabled-help"'}>Export</button>
        </span>
        ${store.document.events.length?"":'<span id="export-disabled-help" class="sr-only">Add at least one event first</span>'}
      </div>
    </header>
    <nav class="rail-nav" aria-label="Timeline Builder">
      <button type="button" class="rail-pin icon-button" data-rail-pin aria-label="${pinned?"Collapse":"Pin"} navigation" aria-pressed="${String(!!pinned)}">${icon(pinned?"chevron-left":"chevron-right",{size:17})}</button>
      <div class="rail-items">${NAV_ITEMS.map((item)=>`<button type="button" class="rail-item ${store.route===item.id?"active":""}" data-route="${item.id}" ${store.route===item.id?'aria-current="page"':""}>${icon(item.icon,{size:21})}<span>${item.label}</span></button>`).join("")}</div>
    </nav>
    <main id="screen-host" class="screen-host">${screen}</main>
  </div>`;
}

function renderBuilderFoundation(store){
  const step=BUILDER_STEPS[Math.max(0,Math.min(6,(store.document.builder?.step||1)-1))],profile=store.document.studentProfile;
  return`<div class="screen builder-screen" data-screen="builder">
    <div class="builder-layout">
      <nav class="wizard-stepper" aria-label="Builder steps">${BUILDER_STEPS.map((item,index)=>`<button type="button" class="wizard-step ${index+1===store.document.builder.step?"active":""}" data-builder-step="${index+1}"><span class="step-number">${index+1}</span><span>${item.title}</span><span class="step-state" aria-hidden="true">${index===6?"":profile.fullName&&index===0?icon("check",{size:15}):"○"}</span></button>`).join("")}</nav>
      <section class="wizard-form" aria-labelledby="builder-title">
        <h1 id="builder-title" tabindex="-1">${step.title}</h1>
        <p class="screen-purpose">${step.purpose}</p>
        ${step.id==="core"?`<form class="core-info-form" data-core-form>
          <div class="field"><label for="full-name">Full name<span class="required-mark"> *</span></label><input id="full-name" name="fullName" required placeholder="e.g., Amara Osei" value="${escapeHtml(profile.fullName)}"><p class="field-error" aria-live="polite"></p></div>
          <div class="field"><label for="medical-school">Medical school<span class="required-mark"> *</span></label><input id="medical-school" name="medicalSchool" required value="${escapeHtml(profile.medicalSchool)}"><p class="field-error" aria-live="polite"></p></div>
          <div class="field"><label for="school-country">Medical school country<span class="required-mark"> *</span></label><input id="school-country" name="medicalSchoolCountry" required value="${escapeHtml(profile.medicalSchoolCountry)}"><p class="field-error" aria-live="polite"></p></div>
          ${monthFieldMarkup({id:"graduation-date",label:profile.expectedGraduation?"Expected graduation":"Graduation date",value:profile.graduationDate,required:true})}
          <label class="check-row"><input type="checkbox" name="expectedGraduation" ${profile.expectedGraduation?"checked":""}><span>I haven't graduated yet</span></label>
          <fieldset class="field"><legend>Degree<span class="required-mark"> *</span></legend><div class="segmented">${["MD","DO","MBBS","Other"].map((value)=>`<label><input type="radio" name="degree" value="${value}" ${profile.degree===value?"checked":""}><span>${value}</span></label>`).join("")}</div></fieldset>
          <div class="field"><label for="visa-status">Visa / work status</label><select id="visa-status" name="visaStatus"><option value="">Select</option>${["US citizen / permanent resident","Need H-1B","Need J-1","Other (text)","Prefer not to say"].map((value)=>`<option ${profile.visaStatus===value?"selected":""}>${value}</option>`).join("")}</select></div>
        </form>`:`<div class="step-foundation"><p>Use this step to add your ${step.title.toLowerCase()}.</p>${step.id!=="review"?'<button type="button" class="button tertiary" data-skip-step>I have nothing to add here → skip</button>':""}</div>`}
        <footer class="wizard-footer">
          <button type="button" class="button tertiary" data-builder-back ${store.document.builder.step===1?"disabled":""}>← Back</button>
          <button type="button" class="button primary" data-builder-next>${store.document.builder.step===7?"Edit my timeline →":"Continue →"}</button>
        </footer>
      </section>
      <aside class="builder-preview" aria-label="Live timeline preview">
        <button type="button" class="button secondary show-preview">Show preview</button>
        <div class="preview-empty"><span class="axis-illustration" aria-hidden="true"></span><p>Your timeline appears here as you answer.</p></div>
      </aside>
    </div>
  </div>`;
}

function renderCanvasFoundation(store){
  const history=store.historyStatus();
  return`<div class="screen canvas-screen" data-screen="canvas">
    <h1 class="sr-only" id="canvas-title" tabindex="-1">Edit Timeline</h1>
    <div class="editing-banner">Editing needs a larger screen.</div>
    <div class="canvas-toolbar" role="toolbar" aria-label="Timeline editing tools">
      <div class="segmented mode-switch"><button type="button" class="${store.document.mode==="guided"?"selected":""}">Guided</button><button type="button" class="${store.document.mode==="advanced"?"selected":""}">Advanced Studio</button></div>
      <span class="toolbar-divider"></span>
      <button type="button" class="button secondary compact">+ Add event</button>
      <button type="button" class="icon-button" aria-label="Undo" ${history.canUndo?"":"disabled"}>${icon("chevron-left",{size:18})}</button>
      <button type="button" class="icon-button" aria-label="Redo" ${history.canRedo?"":"disabled"}>${icon("chevron-right",{size:18})}</button>
      <span class="toolbar-divider"></span>
      <button type="button" class="button secondary compact theme-button">Theme ▾</button>
      <div class="segmented zoom-switch"><button class="selected">Fit</button><button>100%</button><button>150%</button></div>
      <span class="toolbar-spacer"></span>
      <button type="button" class="button secondary compact">History</button>
    </div>
    <div class="board-stage">
      <section class="empty-board" aria-labelledby="canvas-empty-title">
        <div class="empty-axis" aria-hidden="true"></div>
        <h2 id="canvas-empty-title">No events yet — add one below or use the Builder.</h2>
        <button type="button" class="button secondary" data-route="builder">Open Builder</button>
      </section>
    </div>
  </div>`;
}

function renderExportFoundation(store){
  return`<div class="screen export-screen" data-screen="export">
    <h1 tabindex="-1">Export</h1>
    <div class="export-zero ${store.document.events.length?"hidden":""}">
      <div class="ghost-export-board" aria-hidden="true"></div>
      <div class="empty-preview-card"><h2>Add events before exporting.</h2><button type="button" class="button secondary" data-route="builder">Open Builder</button></div>
    </div>
  </div>`;
}

function renderIntakeFoundation(store){
  return`<div class="screen intake-screen" data-screen="intake">
    <div class="intake-stage-header"><div class="intake-progress" aria-label="Upload progress">${["Upload","Read","Review","Done"].map((label,index)=>`<span class="${index===0?"active":""}">${label}</span>`).join("")}</div><button type="button" class="button tertiary" data-cancel-intake>✕ Cancel upload</button></div>
    <section class="intake-upload" aria-labelledby="intake-title"><h1 id="intake-title" tabindex="-1">Add your document</h1><div class="large-dropzone">${icon("upload-cloud",{size:30})}<strong>Drop a PDF or DOCX here, or browse</strong><small>PDF or DOCX, up to 20MB.</small></div><p>Your document is processed for extraction and can be deleted afterward. Nothing appears on your timeline until you approve it.</p><label class="check-row"><input type="checkbox"><span>I understand I'll review every suggestion before it lands on my timeline.</span></label><button type="button" class="button primary" disabled>Read my document →</button></section>
  </div>`;
}

function renderScreen(store){
  if(store.route==="home")return responsiveFrame(store,"home",{fullContent:renderHome(store)});
  if(store.route==="builder"){
    const previewHtml=store.document.events.length?canonicalBoardPreview(store.document,{
      interactive:true,
      label:"Live timeline preview; activate an event to edit it",
      eventTargetAttribute:"data-builder-preview-entry"
    }):"";
    const content=renderBuilderScreen(store,{previewHtml});
    return responsiveFrame(store,"builder",{fullContent:content});
  }
  if(store.route==="canvas"){
    const fullContent='<div data-canvas-host class="canvas-host"></div>';
    const preview=store.document.events.length
      ?canonicalBoardPreview(store.document,{label:"Timeline visualization preview",audience:"EVERYTHING"})
      :'<div class="canvas-empty-message"><p>No events yet — add one below or use the Builder.</p><button type="button" class="button secondary" data-route="builder">Open Builder</button></div>';
    const previewContent=`<div class="screen canvas-screen canvas-preview-only" data-screen="canvas">
      <h1 class="sr-only" tabindex="-1">Edit Timeline</h1>
      <div class="canvas-stage">${preview}</div>
    </div>`;
    if(store.responsive?.screens?.canvas?.contentMode==="view-only")return fullContent;
    return responsiveFrame(store,"canvas",{
      fullContent,
      viewOnlyContent:fullContent,
      previewContent
    });
  }
  if(store.route==="export"){
    const state=store.exportState||normalizeExportState();
    const previewHtml=store.document.events.length?canonicalBoardPreview(store.document,{
      label:"Export preview",
      audience:state.audience
    }):"";
    const fullContent=renderExportScreen(store.document,{
      state,
      previewHtml,
      entitlement:store.entitlement
    });
    const previewContent=`<div class="screen export-screen export-preview-only" data-screen="export">
      <h1 class="sr-only" tabindex="-1">Export</h1>
      <section class="export-preview-panel${store.document.events.length?"":" empty"}" aria-label="Export preview">
        ${store.document.events.length?previewHtml:`<div class="empty-preview-card"><h2>Add events before exporting.</h2><button type="button" class="button secondary" data-route="builder">Open Builder</button></div>`}
      </section>
    </div>`;
    return responsiveFrame(store,"export",{fullContent,previewContent});
  }
  if(store.route==="intake"){
    const content=renderIntakeScreen(store.intakeMachine.snapshot(),{
      existingEvents:store.document.events,
      renderPreview:(events)=>intakePreview(store,events)
    });
    return responsiveFrame(store,"intake",{fullContent:content});
  }
  if(store.route==="advisor"){
    const boardHtml=canonicalBoardPreview({
      ...store.document,
      theme:ADVISOR_SESSION_THEME_ID,
      mode:"guided"
    },{
      label:"Advisor Paper timeline review",
      audience:"EVERYTHING"
    });
    return renderAdvisorSession(store.document,{
      route:store.document.advisor?.route,
      boardHtml,
      editingCommentId:store.advisorUi?.editingCommentId||null
    });
  }
  return responsiveFrame(store,"home",{fullContent:renderHome(store)});
}

function installGlobal(root,store){
  const qualityCheck=(stage="DURING_BUILDING",opener=document.activeElement)=>
    openQualityGuardian(store,{stage,opener});
  root.querySelectorAll("[data-route]").forEach((button)=>button.addEventListener("click",()=>{
    if(button.dataset.route==="export"){
      qualityCheck("BEFORE_EXPORT",button);
      return;
    }
    store.navigate(button.dataset.route);
  }));
  root.querySelector("[data-matrix-link]")?.addEventListener("click",()=>{
    window.dispatchEvent(new CustomEvent("navigate:matrix",{detail:{source:"timeline-builder"}}));
    announce("Returning to Matrix");
  });
  root.querySelector("[data-quality-check]")?.addEventListener("click",(event)=>
    qualityCheck("DURING_BUILDING",event.currentTarget)
  );
  root.querySelector("[data-header-export]")?.addEventListener("click",(event)=>
    qualityCheck("BEFORE_EXPORT",event.currentTarget)
  );
  root.querySelector("[data-rail-pin]")?.addEventListener("click",()=>store.mutate("Navigation preference",(document)=>{document.preferences.railPinned=!document.preferences.railPinned;},{history:false,material:false}));
  root.querySelector("[data-retry-save]")?.addEventListener("click",()=>store.saveNow("RETRY").catch((error)=>showToast(String(error?.message||error),{tone:"danger"})));
  root.querySelector("[data-cancel-intake]")?.addEventListener("click",()=>store.navigate("home"));
}

function installBuilder(root,store){
  root.querySelectorAll("[data-builder-step]").forEach((button)=>button.addEventListener("click",()=>store.mutate("Choose Builder step",(document)=>{document.builder.step=Number(button.dataset.builderStep);},{history:false,material:false})));
  root.querySelector("[data-builder-back]")?.addEventListener("click",()=>store.mutate("Previous Builder step",(document)=>{document.builder.step=Math.max(1,document.builder.step-1);},{history:false,material:false}));
  root.querySelector("[data-builder-next]")?.addEventListener("click",()=>{
    if(store.document.builder.step===7){store.navigate("canvas");return;}
    store.mutate("Next Builder step",(document)=>{document.builder.step=Math.min(7,document.builder.step+1);},{history:false,material:false});
  });
  root.querySelector("[data-skip-step]")?.addEventListener("click",()=>store.mutate("Skip Builder step",(document)=>{if(!document.builder.skipped.includes(document.builder.step))document.builder.skipped.push(document.builder.step);document.builder.step=Math.min(7,document.builder.step+1);},{material:false}));
  const form=root.querySelector("[data-core-form]");
  if(form){
    const commit=()=>{
      const data=new FormData(form);
      store.mutate("Update Core Info",(document)=>{
        for(const key of ["fullName","medicalSchool","medicalSchoolCountry","degree","visaStatus"])document.studentProfile[key]=String(data.get(key)||"");
        document.studentProfile.expectedGraduation=data.get("expectedGraduation")==="on";
      });
    };
    form.querySelectorAll("input:not(#graduation-date),select").forEach((control)=>control.addEventListener("change",commit));
    form.querySelectorAll("input[required]").forEach((control)=>control.addEventListener("blur",()=>{control.closest(".field")?.querySelector(".field-error")?.replaceChildren(document.createTextNode(control.value.trim()?"":"Required."));}));
    installMonthFields(form,{onCommit:(id,value)=>store.mutate("Update graduation date",(document)=>{document.studentProfile.graduationDate=value;})});
  }
}

function updateStatusOnly(store){
  const node=document.querySelector("[data-autosave]");
  if(node){
    node.innerHTML=autosaveText(store);
    node.querySelector("[data-retry-save]")?.addEventListener("click",()=>store.saveNow("RETRY").catch((error)=>showToast(String(error?.message||error),{tone:"danger"})));
  }
}

export async function bootTimelineBuilder(){
  window.D1_UXR_002_DATASETS=window.D1_UXR_002_DATASETS||createRuntimeDatasets();
  window.D1_TIMELINE_INTAKE_ADAPTER=
    window.D1_TIMELINE_INTAKE_ADAPTER||createD1408PdfIntakeAdapter();
  const store=new TimelineStore();
  const responsiveRuntime=installResponsiveRuntime({
    onChange:(model)=>{
      store.responsive=model;
      store.emit();
    }
  });
  store.intakeMachine=createIntakeMachine(store);
  store.exportState=normalizeExportState();
  store.advisorUi={editingCommentId:null};
  const mediaUrls=createObjectUrlRegistry();
  const advancedBoardRenderer=createAdvancedBoardRenderer({
    resolveObjectUrl:(id)=>mediaUrls.get(id)
  });
  const exportAdapter=createLocalExportAdapter({
    resolveObjectUrl:(id)=>mediaUrls.get(id)
  });
  window.D1_UXR_002_STORE=store;
  let renderedKey="",focusedView="",renderQueued=false,viewCleanup=null;
  let canvasState=createCanvasState({
    viewportWidth:window.innerWidth,
    mode:store.document.mode
  });
  let canvasController=null;

  const applyModeDecision=async(plan,decision)=>{
    if(plan.versionRequest&&["enter-advanced","confirm"].includes(decision)){
      await store.saveVersion(plan.versionRequest.name,plan.versionRequest.kind);
    }
    const result=applyModeSwitch(store.document,plan,decision);
    if(!result.changed)return result;
    if(result.effects?.rerunAutoArrange)autoArrange(result.document);
    store.replace(result.document,{
      label:plan.mutation?.label||"Change editing mode",
      history:!!plan.mutation
    });
    return result;
  };

  const applyAdvisorResult=(result,{history=true}={})=>{
    if(!result?.document)return result;
    store.replace(result.document,{
      label:result.mutation?.label||"Update advisor review",
      history
    });
    return result;
  };

  const requestCanvasMode=(target)=>{
    const plan=planModeSwitch(store.document,target);
    if(plan.status==="noop")return;
    if(plan.status==="ready"){
      applyModeDecision(plan,"confirm").catch((error)=>showToast(String(error?.message||error),{tone:"danger"}));
      return;
    }
    openDialog({
      title:plan.dialog.title,
      body:plan.dialog.body,
      primaryLabel:plan.dialog.primary,
      secondaryLabel:plan.dialog.secondary,
      onPrimary:()=>applyModeDecision(
        plan,
        target==="advanced"?"enter-advanced":"return-guided"
      ),
      onSecondary:()=>{
        const decision=target==="advanced"?"stay-guided":"cancel";
        applyModeDecision(plan,decision).catch((error)=>showToast(String(error?.message||error),{tone:"danger"}));
      }
    });
  };

  const persistAdvancedBlob=async(id,file,kind)=>{
    await store.putBlob(id,file,{
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
      id,kind,file,
      naturalWidth:metrics.width,
      naturalHeight:metrics.height,
      layerIndex:store.document.advanced?.media?.length||0
    });
    media.source.blobKey=id;
    await persistAdvancedBlob(id,file,kind);
    store.mutate(`Add ${kind}`,(document)=>{
      document.advanced.media.push(media);
    });
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
  };

  const advancedHooks=()=>({
    onAction:(action)=>{
      if(action==="background"){
        canvasController?.setUiState((state)=>({
          ...state,
          backgroundOpen:!state.backgroundOpen
        }));
      }else if(action==="text"){
        store.mutate("Add text",(document)=>{
          document.advanced.textBlocks.push(createTextBlock({
            id:uid("advanced-text"),
            text:"",
            layerIndex:document.advanced.textBlocks.length
          }));
        });
      }else if(["image","gif","logo"].includes(action)){
        addAdvancedMedia(action).catch((error)=>showToast(String(error?.message||error),{tone:"danger"}));
      }
    },
    onBackgroundTab:(backgroundTab)=>canvasController?.setUiState({backgroundTab}),
    onBackgroundPreset:(presetId)=>{
      store.mutate("Change background",(document)=>{
        document.advanced.background=createPresetBackground(presetId);
      });
    },
    onBackgroundUpload:(file)=>{
      addAdvancedBackground(file).catch((error)=>showToast(String(error?.message||error),{tone:"danger"}));
    },
    onBackgroundDim:(dim)=>{
      store.mutate("Adjust background readability",(document)=>{
        document.advanced.background=setBackgroundDim(document.advanced.background,dim);
      });
    },
    onColor:(color)=>{
      if(!color)return;
      store.mutate("Change background color",(document)=>{
        document.advanced.background=createFlatColorBackground(color);
        document.advanced.recentColors=recordRecentColor(document.advanced.recentColors,color);
      });
    },
    onHex:(color)=>{
      if(!!color)advancedHooks().onColor(color);
    },
    onEyeDropper:()=>{
      sampleEyeDropper(window)
        .then((color)=>advancedHooks().onColor(color))
        .catch((error)=>{
          if(error?.name!=="AbortError")showToast(String(error?.message||error),{tone:"danger"});
        });
    },
    onLayoutLock:(locked)=>{
      const result=setLayoutLock(store.document,locked);
      if(!result.changed)return;
      if(result.effects?.rerunAutoArrange)autoArrange(result.document);
      store.replace(result.document,{label:result.mutation.label});
    }
  });
  const render=()=>{
    const key=`${store.route}|${store.document.updatedAt}|${store.document.preferences?.railPinned}|${store.responsive?.tier?.id||""}|${store.responsive?.viewport?.orientation||""}|${store.advisorUi?.editingCommentId||""}`;
    if(key===renderedKey){updateStatusOnly(store);return;}
    renderedKey=key;
    const app=document.querySelector("#app");
    const active=document.activeElement;
    const activeIdentity=active&&app.contains(active)?{
      id:active.id,
      name:active.getAttribute?.("name"),
      value:active.getAttribute?.("value"),
      selectionStart:typeof active.selectionStart==="number"?active.selectionStart:null,
      selectionEnd:typeof active.selectionEnd==="number"?active.selectionEnd:null
    }:null;
    const viewKey=`${store.route}|${store.route==="builder"?store.document.builder?.step||1:store.route==="intake"?store.intakeMachine.snapshot().stage:""}`;
    viewCleanup?.();
    viewCleanup=null;
    app.innerHTML=renderShell(store,renderScreen(store));app.removeAttribute("aria-busy");
    installGlobal(app,store);
    if(store.route==="home")installHome(app,store,{
      openIntake:({file=null}={})=>{
        store.intakeMachine=createIntakeMachine(store,{file,initialState:null});
        store.mutate("Open Intake",(document)=>{
          document.intake=persistedIntakeState(store.intakeMachine.snapshot());
        },{history:false,material:false});
        store.navigate("intake");
      },
      openReviewIntake:()=>{
        const initial={...store.document.intake,stage:"review",progressIndex:2};
        store.intakeMachine=createIntakeMachine(store,{initialState:initial});
        store.mutate("Open Intake review",(document)=>{
          document.intake=persistedIntakeState(store.intakeMachine.snapshot());
        },{history:false,material:false});
        store.navigate("intake");
      }
    });
    if(store.route==="builder")installBuilderScreen(app,store,{
      providers:window.D1_UXR_002_DATASETS||{},
      toast:showToast
    });
    if(store.route==="canvas"&&app.querySelector("[data-canvas-host]")){
      const host=app.querySelector("[data-canvas-host]");
      canvasController=installCanvasScreen(host,store,{
        state:{
          ...canvasState,
          mode:store.document.mode
        },
        renderBoard:advancedBoardRenderer,
        renderTheme:(document)=>renderThemePicker(document),
        renderAdvanced:(document,options)=>{
          const theme=THEMES_BY_ID[document.theme];
          return renderAdvancedStudio(document,{
            ...options,
            themeSwatches:theme
          });
        },
        renderCommentLayer:(document,state)=>renderStudentCommentLayer(document,{
          visible:state.commentsOpen,
          activePinId:state.activeAdvisorPinId,
          context:"canvas"
        }),
        renderDetails:(route,event)=>renderBuilderEntryDetails(store.document,event),
        onStateChange:(state)=>{canvasState=state;},
        onSelectTheme:(themeId)=>store.mutate("Change theme",(document)=>{
          document.theme=themeId;
        }),
        onAdvanced:()=>requestCanvasMode("advanced"),
        onGuided:()=>requestCanvasMode("guided"),
        onResolveAdvisorComment:(commentId)=>applyAdvisorResult(
          resolveAdvisorComment(store.document,commentId)
        ),
        onOpenBuilder:()=>store.navigate("builder"),
        onDateControl:({edge,event,targetAttemptId=null,label=null})=>openCanvasMonthDialog({
          title:label||`Change ${edge==="start"?"start":"end"} month`,
          value:targetAttemptId
            ?store.document.exams.find((attempt)=>attempt.id===targetAttemptId)?.examDate||""
            :edge==="start"?event.startDate:event.endDate,
          onSave:(value)=>store.mutate(
            targetAttemptId?"Set retake date":`Change event ${edge} month`,
            (document)=>{
              if(targetAttemptId){
                updateBuilderExamAttempt(document,targetAttemptId,{examDate:value});
                return;
              }
              const target=document.events.find((item)=>item.id===event.id);
              if(target)target[edge==="start"?"startDate":"endDate"]=value;
            }
          )
        }),
        onPersonalIcon:(event)=>{
          canvasController?.setUiState({detailsEventId:event.id});
          store.mutate("Open personal event details",(document)=>{
            beginBuilderEntryEdit(document,event.id);
          },{history:false,material:false});
        },
        onDetails:(details,event)=>{
          if(details?.step&&event?.id){
            store.mutate("Open event details",(document)=>{
              beginBuilderEntryEdit(document,event.id);
            },{history:false,material:false});
          }
        },
        onToast:showToast
      });
      installBuilderScreen(host,store,{
        providers:window.D1_UXR_002_DATASETS||{},
        toast:showToast
      });
      const removeAdvanced=installAdvancedStudio(host,advancedHooks());
      const resize=()=>canvasController?.setResponsiveWidth(window.innerWidth);
      window.addEventListener("resize",resize);
      mediaUrls.hydrate(store,store.document)
        .then((changed)=>{if(changed&&store.route==="canvas")canvasController?.render();})
        .catch((error)=>showToast(String(error?.message||error),{tone:"danger"}));
      viewCleanup=()=>{
        canvasState=canvasController?.state||canvasState;
        removeAdvanced();
        canvasController?.destroy();
        canvasController=null;
        window.removeEventListener("resize",resize);
      };
    }
    if(store.route==="export"&&app.querySelector("[data-export-action]")){
      const controller=installExportScreen(app,store.document,{
        state:store.exportState,
        entitlement:store.entitlement,
        getEntitlement:()=>store.entitlement,
        renderPreview:(input)=>canonicalBoardPreview(input.timeline,{
          label:"Export preview",
          audience:"EVERYTHING"
        }),
        exportAdapter,
        toast:showToast,
        requestVersion:(label,kind)=>store.saveVersion(label,kind),
        onStateChange:(state)=>{store.exportState=state;},
        onOpenBuilder:()=>store.navigate("builder"),
        onThemeTrigger:()=>openThemeOverlay(store,{
          onBackgrounds:()=>{
            if(store.document.mode==="advanced")store.navigate("canvas");
            else requestCanvasMode("advanced");
          }
        }),
        onThemeChange:(themeId,{suggestionState}={})=>store.mutate("Change theme",(document)=>{
          document.theme=themeId;
          if(suggestionState?.advisorPaperPdfSuggestionShown){
            document.preferences.advisorPaperPdfSuggestionShown=true;
          }
        }),
        onSuggestionStateChange:(suggestionState)=>store.mutate(
          "Record export suggestion",
          (document)=>{
            document.preferences.advisorPaperPdfSuggestionShown=
              !!suggestionState.advisorPaperPdfSuggestionShown;
          },
          {history:false,material:false}
        ),
        onAdvisorPaperSuggestion:(suggestion)=>showToast(suggestion.message,{
          actionLabel:suggestion.actionLabel,
          onAction:suggestion.apply
        }),
        onInterviewSeasonChange:(value)=>store.mutate("Set interview season",(document)=>{
          document.studentProfile.interviewSeason=value;
        }),
        onAdvisorRequest:async(request)=>{
          const plan=buildAdvisorRequestPlan(store.document,{
            message:request.message,
            clock:()=>new Date(request.requestedAt)
          });
          await store.saveVersion(plan.versionRequest.name,plan.versionRequest.kind);
          const result=applyAdvisorRequest(store.document,plan);
          await store.putSyncRecord({
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
          applyAdvisorResult(result);
          return{versionHandled:true,route:plan.route};
        },
        onAdvisorCancel:()=>applyAdvisorResult(cancelAdvisorRequest(store.document)),
        onAdvisorComments:()=>store.navigate("advisor")
      });
      controller.refreshPreview();
      viewCleanup=()=>{
        store.exportState=controller.state;
        controller.destroy();
      };
    }
    if(store.route==="advisor"){
      let highlightTimer=null;
      const disposeAdvisor=installAdvisorWorkflow(app,{
        onChecklist:({id,state})=>applyAdvisorResult(
          setChecklistState(store.document,id,state),
          {history:false}
        ),
        onHideQuestion:(questionId)=>applyAdvisorResult(
          hideAdvisorQuestion(store.document,questionId),
          {history:false}
        ),
        onQuestion:(questionId)=>{
          const model=advisorQuestionModel(store.document);
          const question=[...model.visible,...model.hidden].find(({id})=>id===questionId);
          if(!question)return;
          const effect=questionHighlightEffect(question,{
            reducedMotion:!!store.responsive?.motion?.reduced
          });
          const targets=effect.eventIds.flatMap((eventId)=>[
            ...app.querySelectorAll(`[data-event-id="${CSS.escape(eventId)}"]`)
          ]);
          const nodes=targets.length?targets:[app.querySelector("[data-advisor-board]")].filter(Boolean);
          nodes.forEach((node)=>node.classList.add("advisor-question-highlight"));
          clearTimeout(highlightTimer);
          highlightTimer=setTimeout(
            ()=>nodes.forEach((node)=>node.classList.remove("advisor-question-highlight")),
            effect.animation==="none"?0:effect.durationMs
          );
        },
        onPin:(commentId)=>{
          store.advisorUi.editingCommentId=commentId;
          store.emit();
        },
        onCreatePin:(position)=>{
          const result=addAdvisorComment(store.document,position);
          store.advisorUi.editingCommentId=result.comment.id;
          applyAdvisorResult(result,{history:false});
        },
        onSaveComment:({id,note})=>{
          store.advisorUi.editingCommentId=null;
          applyAdvisorResult(updateAdvisorComment(store.document,id,note),{history:false});
        },
        onEditComment:(commentId)=>{
          store.advisorUi.editingCommentId=commentId;
          store.emit();
        },
        onDeleteComment:(commentId)=>{
          store.advisorUi.editingCommentId=null;
          applyAdvisorResult(deleteAdvisorComment(store.document,commentId),{history:false});
        },
        onResolveComment:(commentId)=>applyAdvisorResult(
          resolveAdvisorComment(store.document,commentId)
        ),
        onApprove:()=>applyAdvisorResult(approveAdvisorReview(store.document)),
        onRequestChanges:()=>applyAdvisorResult(requestAdvisorChanges(store.document)),
        onAnnounce:announce
      });
      viewCleanup=()=>{
        clearTimeout(highlightTimer);
        disposeAdvisor();
      };
    }
    if(store.route==="intake"){
      viewCleanup=installIntakeScreen(app,store.intakeMachine,{
        onChange:(state)=>store.mutate("Update Intake flow",(document)=>{
          document.intake=persistedIntakeState(state);
        },{history:false,material:false}),
        onNavigate:(route)=>store.navigate(route),
        onToast:showToast,
        onError:(error)=>showToast(String(error?.message||error),{tone:"danger"}),
        openDialog,
        saveVersion:(name,kind)=>store.saveVersion(name,kind),
        applyBatch:async(batch,contract)=>{
          let result=null;
          store.mutate(contract?.label||"Add document suggestions",(document)=>{
            result=applyApprovalBatchToDocument(document,batch);
          });
          return result;
        },
        deleteSource:async(file)=>{
          if(typeof window.D1_TIMELINE_INTAKE_ADAPTER?.deleteSource==="function"){
            await window.D1_TIMELINE_INTAKE_ADAPTER.deleteSource(file);
          }
        }
      });
    }
    requestAnimationFrame(()=>{
      let restored=null;
      if(activeIdentity?.id)restored=app.querySelector(`#${CSS.escape(activeIdentity.id)}`);
      if(!restored&&activeIdentity?.name){
        const selector=`[name="${CSS.escape(activeIdentity.name)}"]${activeIdentity.value!=null?`[value="${CSS.escape(activeIdentity.value)}"]`:""}`;
        restored=app.querySelector(selector);
      }
      if(restored){
        restored.focus({preventScroll:true});
        if(activeIdentity.selectionStart!=null&&typeof restored.setSelectionRange==="function")restored.setSelectionRange(activeIdentity.selectionStart,activeIdentity.selectionEnd);
      }else if(viewKey!==focusedView){
        app.querySelector(".screen h1[tabindex='-1']")?.focus({preventScroll:true});
      }
      focusedView=viewKey;
    });
  };
  const scheduleRender=()=>{
    if(renderQueued)return;
    renderQueued=true;
    queueMicrotask(()=>{renderQueued=false;render();});
  };
  store.subscribe(()=>{
    canvasState={
      ...canvasState,
      entitlementEditable:store.entitlement.canMutate===true
    };
    scheduleRender();
  });
  const initialized=await store.initialize();
  const localHost=["localhost","127.0.0.1","0.0.0.0"].includes(
    String(window.location?.hostname||"").toLowerCase()
  );
  const explicitMode=String(window.D1_TIMELINE_RUNTIME_MODE||"").toLowerCase();
  const runtimeMode=localHost&&explicitMode!=="production"
    ?"local"
    :"production";
  const entitlementAdapter=runtimeMode==="production"
    ?createProductionEntitlementBoundaryAdapter()
    :window.D1_TIMELINE_ENTITLEMENT_ADAPTER||
      createLocalEntitlementAdapter({
        scenario:localEntitlementScenarioFromLocation(window.location)||
          "eligible-360",
        currentUsage:initialized.restored?1:0
      });
  let assertion;
  try{
    assertion=await entitlementAdapter.resolve();
  }catch{
    assertion={
      verified:false,
      enabled:false,
      eligible:false,
      allowance:0,
      currentUsage:0,
      source:"entitlement-adapter-error",
      reason:"Timeline entitlement could not be verified."
    };
  }
  store.setEntitlement(evaluateTimelineEntitlement(assertion,{
    mode:runtimeMode,
    hasExistingTimeline:initialized.restored,
    expectedBinding:entitlementAdapter.expectedBinding||null
  }));
  if(!initialized.restored&&store.entitlement.canCreate){
    await store.saveNow("INITIAL_DURABLE_DRAFT");
  }
  const syncLocationRoute=()=>{
    const route=decodeURIComponent(String(window.location.hash||"").replace(/^#/,""));
    const expectedRoute=advisorSessionRoute(store.document.id);
    if(route===expectedRoute&&isActiveAdvisorSession(store.document,route))store.navigate("advisor");
  };
  syncLocationRoute();
  window.addEventListener("hashchange",syncLocationRoute);
  store.intakeMachine=createIntakeMachine(store,{initialState:store.document.intake});
  store.emit();
  window.D1_UXR_002={
    version:"D1-UXR-002",
    ready:true,
    store,
    initialized,
    navigate:(route)=>store.navigate(route),
    get document(){return store.snapshot();},
    get history(){return store.historyStatus();},
    contrastDecision:"D1-UXR-002-CONTRAST-ADDENDUM-001",
    contrastDecisions:["D1-UXR-002-CONTRAST-ADDENDUM-001","D1-UXR-002-CONTRAST-ADDENDUM-002"],
    implementationAuthority:"D1-UXR-002-IMPLEMENTATION-AUTHORITY-ADDENDUM-001",
    executionAuthority:"D1-UXR-002-EXECUTION-AMENDMENT-001",
    completionAuthority:"D1-UXR-002-AUTONOMOUS-COMPLETION-DIRECTIVE-001"
  };
  window.D1_UXR_002_TEST={
    version:window.D1_UXR_002.version,
    ready:true,
    store,
    initialized,
    navigate:(route)=>store.navigate(route),
    get document(){return store.snapshot();},
    get history(){return store.historyStatus();},
    contrastDecisions:window.D1_UXR_002.contrastDecisions,
    implementationAuthority:window.D1_UXR_002.implementationAuthority,
    executionAuthority:window.D1_UXR_002.executionAuthority,
    completionAuthority:window.D1_UXR_002.completionAuthority,
    setDocument:(document)=>store.replace(document,{label:"Test document",history:false}),
    reset:()=>store.replace(undefined,{label:"Reset test document",history:false}),
    flush:()=>store.saveNow("TEST_FLUSH"),
    productionRequestCount:0
  };
  window.addEventListener("keydown",(event)=>{
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="z"){event.preventDefault();if(event.shiftKey)store.redo();else store.undo();}
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="e"){event.preventDefault();store.navigate("export");}
    const target=event.target;
    const isEditing=target?.matches?.("input,textarea,select,[contenteditable='true']");
    if(event.key==="?"&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!isEditing){
      event.preventDefault();
      openKeyboardShortcutSheet();
    }
  });
  window.addEventListener("beforeunload",()=>{
    window.removeEventListener("hashchange",syncLocationRoute);
    responsiveRuntime.destroy();
    mediaUrls.revokeAll();
    store.saveNow("BEFORE_UNLOAD").catch(()=>{});
  });
  return window.D1_UXR_002;
}
