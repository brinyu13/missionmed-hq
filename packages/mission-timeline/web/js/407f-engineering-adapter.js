import {TimelineStore} from "./uxr-002/store.js";

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
    fields:clone(event.fields||{})
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
    fields:{...clone(event.fields||{}),legacy407fCategory:event.cat||"personal"}
  };
}

export function applyDocumentTo407FState(document,state){
  const profile=document.studentProfile||{};
  state.user.events=(document.events||[]).map(documentEventTo407F);
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
    ...clone(document.metadata?.builder407F||{})
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
    fullName:state.profile?.name||"",
    medicalSchoolCountry:state.profile?.country||"",
    visaStatus:state.profile?.visa||"",
    specialtyGoal:state.profile?.goal||""
  };
  document.theme=state.canvasTheme==="season"?"season-one-board":
    state.canvasTheme==="paper"?"advisor-paper":
    state.canvasTheme==="horizon"?"horizon":
    state.canvasTheme==="journeys"?"little-journeys":"keynote-classic";
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

export async function boot407FEngineeringAdapter({
  bridge=window.D1_407F_TEST,
  store=new TimelineStore()
}={}){
  if(!bridge?.state||typeof bridge.renderAll!=="function"){
    throw new Error("407F bridge is unavailable");
  }

  const init=await store.initialize();
  let applying=false;
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
  const reconcile=()=>{
    if(applying||pending)return;
    pending=true;
    queueMicrotask(()=>{
      pending=false;
      const nextState=stableState(bridge.state);
      if(nextState===lastState)return;
      lastState=nextState;
      store.mutate(
        "407F canonical UI change",
        (document)=>apply407FStateToDocument(bridge.state,document)
      );
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
      lastState=stableState(bridge.state);
      applying=false;
    }
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
