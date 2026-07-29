import assert from "node:assert/strict";
import test from "node:test";

import {
  installHome,
  pendingSuggestionCount,
  renderHome,
  timelineRange
} from "../web/js/uxr-002/home.js";
import {defaultDocument,TimelineStore} from "../web/js/uxr-002/store.js";

class MemoryAdapter{
  constructor(){
    this.kind="m2-memory";
    this.stores=new Map();
    this.atomicBatches=[];
  }

  bucket(name){
    if(!this.stores.has(name))this.stores.set(name,new Map());
    return this.stores.get(name);
  }

  async open(){return this;}

  async get(store,key){
    const value=this.bucket(store).get(key);
    return value===undefined?null:structuredClone(value);
  }

  async put(store,value,key=value?.id){
    const record=structuredClone(value);
    this.bucket(store).set(key,record);
    return structuredClone(record);
  }

  async list(store,predicate=()=>true){
    return[...this.bucket(store).values()].map((value)=>structuredClone(value)).filter(predicate);
  }

  async atomicPut(entries){
    const batch=entries.map((entry)=>structuredClone(entry));
    this.atomicBatches.push(batch);
    for(const {store,key,value} of batch)this.bucket(store).set(key,structuredClone(value));
  }
}

class FakeClassList{
  constructor(){this.values=new Set();}
  add(value){this.values.add(value);}
  remove(value){this.values.delete(value);}
  contains(value){return this.values.has(value);}
}

class FakeElement{
  constructor(name){
    this.name=name;
    this.listeners=new Map();
    this.classList=new FakeClassList();
  }

  addEventListener(type,listener){
    this.listeners.set(type,listener);
  }

  contains(node){
    return node===this;
  }

  async fire(type,overrides={}){
    const listener=this.listeners.get(type);
    assert.ok(listener,`${this.name} is missing a ${type} listener`);
    let defaultPrevented=false;
    const event={
      currentTarget:this,
      target:this,
      relatedTarget:null,
      preventDefault(){defaultPrevented=true;},
      ...overrides
    };
    const result=await listener(event);
    return{event,result,defaultPrevented};
  }
}

function fakeHomeRoot(){
  const elements={
    build:new FakeElement("build"),
    intake:new FakeElement("intake"),
    canvas:new FakeElement("canvas"),
    review:new FakeElement("review"),
    startOver:new FakeElement("start-over")
  };
  return{
    elements,
    querySelectorAll(selector){
      return selector==="[data-home-build]"?[elements.build]:[];
    },
    querySelector(selector){
      return({
        "[data-home-intake]":elements.intake,
        "[data-open-canvas]":elements.canvas,
        "[data-review-suggestions]":elements.review,
        "[data-start-over]":elements.startOver
      })[selector]||null;
    }
  };
}

function fakeStore({eventCount=0,builderStep=4}={}){
  const store={
    document:{
      events:Array.from({length:eventCount},(_,index)=>({id:`event-${index}`})),
      builder:{step:builderStep},
      intake:{stage:null}
    },
    mutations:[],
    routes:[],
    startNewTimelineCalls:0,
    mutate(label,operation,options){
      operation(this.document);
      this.mutations.push({label,options});
      return true;
    },
    navigate(route){
      this.routes.push(route);
      return true;
    },
    async startNewTimeline(){
      this.startNewTimelineCalls+=1;
    }
  };
  return store;
}

test("Home empty state preserves the exact three-region hierarchy and does not load demo data",()=>{
  const document=defaultDocument();
  document.updatedAt=new Date().toISOString();
  const before=structuredClone(document);
  const html=renderHome({document});

  assert.equal((html.match(/<section class="card home-/g)||[]).length,3);
  assert.ok(html.indexOf('class="card home-build"')<html.indexOf('class="card home-intake"'));
  assert.ok(html.indexOf('class="card home-intake"')<html.indexOf('class="card home-preview"'));
  assert.match(html,/>Turn your medical journey into an interview-ready timeline\.<\/h1>/);
  assert.match(html,/>Start building<\/button>/);
  assert.doesNotMatch(html,/data-start-over/);
  assert.match(html,/>Drop a PDF here, or browse</);
  assert.match(html,/>CV · MyERAS PDF · résumé</);
  assert.match(html,/>Nothing appears on your timeline until you approve it\.<\/p>/);
  assert.match(html,/class="board-preview ghost /);
  assert.match(html,/<h3>This is what you're building\.<\/h3>/);
  assert.match(html,/<p>A one-page visual story an interviewer can read at a glance\.<\/p>/);
  assert.match(html,/>Use the guided builder →<\/button>/);
  assert.doesNotMatch(html,/status panel|role explainer|demo-story|load demo/i);
  assert.deepEqual(document,before,"rendering the packaged example must never load it into student data");
});

test("returning Home renders exact metadata, one pending chip, approval, and an interview-safe Canvas affordance",()=>{
  const document=defaultDocument();
  document.updatedAt=new Date().toISOString();
  document.events=[
    {
      id:"education-1",
      title:"Medical school",
      categoryId:"education",
      eventType:"duration",
      startDate:"2018-06",
      endDate:"2020-07",
      visibilityState:"INTERVIEWER_SAFE"
    },
    {
      id:"personal-1",
      title:"Advisor-only event",
      categoryId:"personal",
      eventType:"milestone",
      startDate:"2022-01",
      endDate:null,
      visibilityState:"ADVISOR_ONLY"
    }
  ];
  document.intake.candidates=[
    {id:"pending-1"},
    {id:"pending-2",decision:"pending"},
    {id:"accepted",decision:"accepted"},
    {id:"rejected",decision:"rejected"}
  ];
  document.advisor.approvedAt="2026-07-29T10:00:00.000Z";

  const html=renderHome({document});
  assert.match(html,/>Continue building<\/button>/);
  assert.match(html,/>Start over<\/button>/);
  assert.equal((html.match(/class="status-chip"/g)||[]).length,1);
  assert.match(html,/>2 suggestions to review<\/button>/);
  assert.match(html,/>Advisor approved · Jul 29<\/span>/);
  assert.match(html,/>2 events · 2018–2022 · edited /);
  assert.match(html,/data-open-canvas aria-label="Open canvas"/);
  assert.match(html,/Current interview-safe timeline preview/);
  assert.match(html,/#2C6E8F/,"interviewer-safe event must render");
  assert.doesNotMatch(html,/#8A5BBF/,"advisor-only event must not render in the Home preview");
  assert.doesNotMatch(html,/class="empty-preview"/);

  document.advisor.editedSince=true;
  const editedHtml=renderHome({document});
  assert.match(editedHtml,/>Approved Jul 29 · edited since<\/span>/);
  assert.doesNotMatch(editedHtml,/>Advisor approved · Jul 29<\/span>/);
});

test("Home metadata helpers handle boundaries without mutating candidate state",()=>{
  assert.equal(
    timelineRange([
      {startDate:"2024-11",endDate:"2025-02"},
      {startDate:"2019-06",endDate:null},
      {startDate:"not-a-date",endDate:""}
    ]),
    "2019–2025"
  );
  assert.equal(timelineRange([],{now:new Date("2031-04-05T00:00:00.000Z")}),"2031–2031");

  const candidates=[
    {id:"one"},
    {id:"two",decision:"pending"},
    {id:"three",decision:"accepted"},
    {id:"four",decision:"rejected"}
  ];
  const before=structuredClone(candidates);
  assert.equal(pendingSuggestionCount(candidates),2);
  assert.equal(pendingSuggestionCount(null),0);
  assert.deepEqual(candidates,before);
});

test("Start over durably versions the current draft, resets student data, and preserves preferences",async()=>{
  const adapter=new MemoryAdapter();
  const clock=()=>new Date("2032-06-14T09:30:00.000Z");
  const store=new TimelineStore({adapter,clock});
  await store.initialize();
  store.mutate("Returning draft",(document)=>{
    document.studentProfile.fullName="Amara Osei";
    document.builder.step=5;
    document.preferences.railPinned=true;
    document.events.push({
      id:"work-1",
      title:"Clinical work",
      categoryId:"work",
      eventType:"duration",
      startDate:"2029-01",
      endDate:"2030-01",
      visibilityState:"INTERVIEWER_SAFE"
    });
  });

  const version=await store.startNewTimeline();
  clearTimeout(store.timer);
  store.timer=null;

  assert.equal(version.name,"Before starting over · Jun 14, 2032");
  assert.equal(version.kind,"automatic");
  assert.equal(version.eventCount,1);
  assert.equal(version.documentSnapshot.studentProfile.fullName,"Amara Osei");
  assert.equal(version.documentSnapshot.events[0].title,"Clinical work");
  assert.equal((await store.listVersions()).length,1);
  assert.equal(store.document.events.length,0);
  assert.equal(store.document.studentProfile.fullName,"");
  assert.equal(store.document.builder.step,1);
  assert.equal(store.document.preferences.railPinned,true);
  assert.equal(store.historyStatus().undoLabel,"Start new timeline");
  assert.equal(adapter.atomicBatches.at(-1)[0].value.reason,"START_NEW_TIMELINE");
  assert.equal(adapter.atomicBatches.at(-1)[0].value.document.events.length,0);
});

test("Home controls route Builder, Intake, Canvas, Review, and the exact Start-over confirmation",async()=>{
  const emptyRoot=fakeHomeRoot();
  const emptyStore=fakeStore({eventCount:0,builderStep:6});
  const intakeCalls=[];
  installHome(emptyRoot,emptyStore,{openIntake:(payload)=>intakeCalls.push(payload)});

  await emptyRoot.elements.build.fire("click");
  assert.equal(emptyStore.document.builder.step,1);
  assert.deepEqual(emptyStore.routes,["builder"]);
  assert.deepEqual(emptyStore.mutations,[{
    label:"Open Builder",
    options:{history:false,material:false}
  }]);

  await emptyRoot.elements.intake.fire("click");
  assert.deepEqual(intakeCalls,[{source:"home-browse"}]);

  const dragData={files:[],dropEffect:"none"};
  const dragOver=await emptyRoot.elements.intake.fire("dragover",{dataTransfer:dragData});
  assert.equal(dragOver.defaultPrevented,true);
  assert.equal(dragData.dropEffect,"copy");
  assert.equal(emptyRoot.elements.intake.classList.contains("drag-active"),true);
  await emptyRoot.elements.intake.fire("dragleave",{relatedTarget:null});
  assert.equal(emptyRoot.elements.intake.classList.contains("drag-active"),false);

  const droppedFile={name:"journey.PDF",type:"application/pdf",size:1024,lastModified:1234};
  const drop=await emptyRoot.elements.intake.fire("drop",{dataTransfer:{files:[droppedFile]}});
  assert.equal(drop.defaultPrevented,true);
  assert.deepEqual(intakeCalls.at(-1),{
    source:"home-drop",
    file:{
      name:"journey.PDF",
      type:"application/pdf",
      size:1024,
      lastModified:1234
    }
  });
  const droppedDocx={
    name:"journey.docx",
    type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size:2048,
    lastModified:5678
  };
  await emptyRoot.elements.intake.fire("drop",{dataTransfer:{files:[droppedDocx]}});
  assert.deepEqual(intakeCalls.at(-1),{source:"home-drop",file:droppedDocx});

  await emptyRoot.elements.canvas.fire("click");
  await emptyRoot.elements.review.fire("click");
  assert.deepEqual(emptyStore.routes.slice(-2),["canvas","intake"]);
  assert.equal(emptyStore.document.intake.stage,"review");

  const returningRoot=fakeHomeRoot();
  const returningStore=fakeStore({eventCount:1,builderStep:4});
  let dialog=null;
  const toasts=[];
  installHome(returningRoot,returningStore,{
    openConfirm:(options)=>{dialog=options;},
    toast:(message)=>toasts.push(message)
  });

  await returningRoot.elements.build.fire("click");
  assert.equal(returningStore.document.builder.step,4,"Continue building must retain the current step");
  assert.equal(returningStore.mutations.length,0);
  assert.deepEqual(returningStore.routes,["builder"]);

  await returningRoot.elements.startOver.fire("click");
  assert.equal(dialog.title,"Start a new timeline?");
  assert.equal(dialog.body,"Your current draft stays in History as a version. You can restore it anytime.");
  assert.equal(dialog.primaryLabel,"Save & start new");
  assert.equal(dialog.secondaryLabel,"Cancel");
  assert.equal(dialog.opener,returningRoot.elements.startOver);
  await dialog.onPrimary();
  assert.equal(returningStore.startNewTimelineCalls,1);
  assert.deepEqual(returningStore.routes,["builder","builder"]);
  assert.deepEqual(toasts,["New timeline ready"]);
});
