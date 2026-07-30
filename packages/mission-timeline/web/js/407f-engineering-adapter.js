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
  let applying=false;
  let canvasController=null;
  let canvasSyncing=false;
  let unsubscribeStore=()=>{};
  let onCanvasDetailsClick=()=>{};
  let onCanvasResize=()=>{};
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
    unsubscribeStore();
    document.getElementById("canvas407F")?.removeEventListener("click",onCanvasDetailsClick);
    window.removeEventListener("resize",onCanvasResize);
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
      applying=true;
      applyDocumentTo407FState(store.document,bridge.state);
      bridge.renderAll();
      reflectStoreStatus();
      lastState=stableState(bridge.state);
      applying=false;
      canvasSyncing=false;
    };
    canvasController=installCanvas(canvasHost,store,{
      state:createCanvasState({
        viewportWidth:window.innerWidth,
        mode:store.document.mode
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
      onAdvanced:()=>bridge.toast("Advanced Studio is available from the mode switch when enabled."),
      onGuided:()=>bridge.toast("Guided Mode selected"),
      onDropReflow:syncCanvasDocument,
      onToast:(message)=>bridge.toast(message)
    });
    api.canvas=canvasController;

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
    canvasHost.addEventListener("click",onCanvasDetailsClick);
    onCanvasResize=()=>canvasController?.setResponsiveWidth(window.innerWidth);
    window.addEventListener("resize",onCanvasResize);
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
