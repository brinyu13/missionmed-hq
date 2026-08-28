import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  AUTOMATIC_VERSION_TYPES,
  CANVAS_TOOLBAR_ORDER,
  GUIDED_CONTEXT_CONTROL_ORDER,
  GUIDED_CONTEXT_MENU_ORDER,
  addCanvasEvent,
  applyCanvasKeyboard,
  automaticVersionName,
  beginCanvasDrag,
  beginInlineLabelEdit,
  canvasResponsiveContract,
  cancelCanvasDrag,
  chronologicalEventIds,
  classifyCanvasVersion,
  commitCanvasDrag,
  commitInlineLabelEdit,
  contextControlsForEvent,
  contextMenuForEvent,
  createAutomaticCanvasVersion,
  createCanvasState,
  deleteCanvasVersion,
  detailsRouteForEvent,
  duplicateCanvasEvent,
  historyDefaultName,
  installCanvas,
  redoCanvas,
  renameCanvasVersion,
  renderAddEventPopover,
  renderCanvas,
  renderHistorySlideOver,
  restoreCanvasVersion,
  saveManualCanvasVersion,
  selectCanvasEvent,
  temporalCenterMonth,
  toggleCanvasEventVisibility,
  undoCanvas,
  updateCanvasDrag,
  updateCanvasZoom,
  updateInlineLabelDraft
} from "../web/js/uxr-002/canvas.js";
import {CATEGORIES,HISTORY_LIMIT,VISIBILITY} from "../web/js/uxr-002/constants.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";

const canvasSource=await readFile(
  new URL("../web/js/uxr-002/canvas.js",import.meta.url),
  "utf8"
);

test("persistent canvas patch tolerates blur-triggered nested renders",()=>{
  assert.match(
    canvasSource,
    /child!==persistentPresentation&&child\.parentNode===currentApplication/
  );
  assert.match(
    canvasSource,
    /child!==currentApplication&&child\.parentNode===currentStage/
  );
  assert.match(
    canvasSource,
    /child!==currentStage&&child\.parentNode===currentScreen/
  );
});

class MemoryVersionAdapter {
  constructor() {
    this.versions = new Map();
  }

  async get(store,key) {
    assert.equal(store,"versions");
    const value = this.versions.get(key);
    return value ? structuredClone(value) : null;
  }

  async put(store,value) {
    assert.equal(store,"versions");
    this.versions.set(value.id,structuredClone(value));
    return structuredClone(value);
  }

  async delete(store,key) {
    assert.equal(store,"versions");
    this.versions.delete(key);
  }
}

class FakeStore {
  constructor(document = canonicalDocument()) {
    this.document = structuredClone(document);
    this.undoStack = [];
    this.redoStack = [];
    this.adapter = new MemoryVersionAdapter();
    this.versionSequence = 0;
    this.restored = [];
    this.routes = [];
  }

  mutate(label,operation) {
    const before = structuredClone(this.document);
    operation(this.document);
    if (JSON.stringify(before) === JSON.stringify(this.document)) return false;
    const after = structuredClone(this.document);
    this.undoStack.push({label,before,after});
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
    return true;
  }

  undo() {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push(entry);
    this.document = structuredClone(entry.before);
    return entry;
  }

  redo() {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push(entry);
    this.document = structuredClone(entry.after);
    return entry;
  }

  historyStatus() {
    return {
      canUndo:this.undoStack.length > 0,
      canRedo:this.redoStack.length > 0,
      undoCount:this.undoStack.length,
      redoCount:this.redoStack.length
    };
  }

  async listVersions() {
    return [...this.adapter.versions.values()]
      .map((version) => structuredClone(version))
      .sort((left,right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  }

  async saveVersion(name,kind = "manual") {
    this.versionSequence += 1;
    const version = {
      id:`version-${this.versionSequence}`,
      documentId:this.document.id,
      name,
      kind,
      createdAt:`2031-06-${String(this.versionSequence).padStart(2,"0")}T12:00:00.000Z`,
      eventCount:this.document.events.length,
      documentSnapshot:structuredClone(this.document)
    };
    await this.adapter.put("versions",version);
    return version;
  }

  async restoreVersion(id) {
    const version = await this.adapter.get("versions",id);
    if (!version) throw new Error("Version not found.");
    this.restored.push(id);
    this.document = structuredClone(version.documentSnapshot);
    return version;
  }

  async renameVersion(id,name) {
    const version=await this.adapter.get("versions",id);
    if(!version)throw new Error("Version not found.");
    const updated={...version,name};
    await this.adapter.put("versions",updated);
    return updated;
  }

  async deleteVersion(id) {
    const version=await this.adapter.get("versions",id);
    if(!version)return null;
    await this.adapter.delete("versions",id);
    return version;
  }

  navigate(route) {
    this.routes.push(route);
    return true;
  }
}

class FakeRoot {
  constructor() {
    this.innerHTML = "";
    this.listeners = new Map();
  }

  addEventListener(type,listener) {
    this.listeners.set(type,listener);
  }

  removeEventListener(type,listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }

  querySelector() {
    return null;
  }
}

function canonicalDocument() {
  const document = defaultDocument();
  document.studentProfile.fullName = "Amara Osei";
  document.events = [
    {
      id:"education",
      title:"Medical school",
      categoryId:"education",
      eventType:"duration",
      startDate:"2021-01",
      endDate:"2021-12",
      openEnded:false,
      visibilityState:VISIBILITY.INTERVIEWER_SAFE,
      lane:0,
      fields:{builderDomain:"core",builderEntryId:"education"}
    },
    {
      id:"work",
      title:"Clinical officer",
      categoryId:"work",
      eventType:"duration",
      startDate:"2022-01",
      endDate:"2022-12",
      openEnded:false,
      visibilityState:VISIBILITY.INTERVIEWER_SAFE,
      lane:1,
      fields:{builderDomain:"work",builderEntryId:"work"}
    },
    {
      id:"research",
      title:"Hypertension study",
      categoryId:"research",
      eventType:"duration",
      startDate:"2023-01",
      endDate:"2023-12",
      openEnded:false,
      visibilityState:VISIBILITY.ADVISOR_ONLY,
      lane:2,
      fields:{builderDomain:"research",builderEntryId:"research"}
    },
    {
      id:"clinical",
      title:"Internal medicine rotation",
      categoryId:"clinical",
      eventType:"duration",
      startDate:"2024-01",
      endDate:"2024-12",
      openEnded:false,
      visibilityState:VISIBILITY.INTERVIEWER_SAFE,
      lane:0,
      fields:{builderDomain:"clinical",builderEntryId:"clinical"}
    },
    {
      id:"exam",
      title:"Step 2 CK",
      categoryId:"exams",
      eventType:"milestone",
      startDate:"2025-06",
      endDate:null,
      openEnded:false,
      visibilityState:VISIBILITY.INTERVIEWER_SAFE,
      fields:{builderDomain:"exams",builderEntryId:"exam",score:"247",showScore:true}
    },
    {
      id:"personal",
      title:"Moved to Boston",
      categoryId:"personal",
      eventType:"milestone",
      startDate:"2026-03",
      endDate:null,
      openEnded:false,
      visibilityState:VISIBILITY.INTERVIEWER_SAFE,
      fields:{builderDomain:"personal",builderEntryId:"personal",icon:"plane"}
    }
  ];
  return document;
}

function contextIds(event) {
  return contextControlsForEvent(event).map(({id}) => id);
}

test("M8 renders the one 48px Guided toolbar in frozen order with no permanent or retired Canvas UI",() => {
  const document = canonicalDocument();
  document.advisor.comments = [{id:"comment-1",resolvedAt:null}];
  const state = selectCanvasEvent(createCanvasState(),"work");
  const html = renderCanvas({
    document,
    state,
    historyStatus:{canUndo:true,canRedo:false},
    currentMonth:"2026-07"
  });
  const items = [...html.matchAll(/data-toolbar-item="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(items,CANVAS_TOOLBAR_ORDER);
  assert.match(html,/data-height="48" style="height:48px"/);
  assert.equal((html.match(/data-canvas-toolbar/g) || []).length,1);
  assert.match(html,/>Guided<\/button>/);
  assert.match(html,/>Advanced Studio<\/button>/);
  assert.match(html,/>Comments · 1<\/button>/);
  assert.match(html,/data-context-toolbar/);
  assert.doesNotMatch(html,/data-canvas-action="(?:background|media|typography|layout-lock)"/);
  assert.doesNotMatch(html,/Insert strip|Event list|Draft history|Inspector|COMPARE|CONDENSED|CROWDED/);
  assert.doesNotMatch(html,/data-permanent-(?:panel|inspector)/);
  assert.doesNotMatch(html,/JSON (?:import|export)|Import timeline|Export timeline/);
});

test("M8 contextual toolbar controls are exact for arrows, flags, exams, Personal, and automatic study periods",() => {
  const document = canonicalDocument();
  const arrow = document.events.find(({id}) => id === "work");
  const exam = document.events.find(({id}) => id === "exam");
  const personal = document.events.find(({id}) => id === "personal");
  const plainMilestone = {...exam,categoryId:"education",fields:{}};
  const study = {
    id:"study",
    title:"Study period",
    categoryId:"exams",
    eventType:"duration",
    startDate:"2025-07",
    endDate:"2025-09",
    sourceType:"auto-study-period",
    provisional:true
  };

  assert.deepEqual(contextIds(arrow),GUIDED_CONTEXT_CONTROL_ORDER.arrow);
  assert.deepEqual(contextIds(plainMilestone),GUIDED_CONTEXT_CONTROL_ORDER.milestone);
  assert.deepEqual(contextIds(personal),GUIDED_CONTEXT_CONTROL_ORDER["personal-milestone"]);
  assert.deepEqual(contextIds(exam),GUIDED_CONTEXT_CONTROL_ORDER["exam-milestone-with-score"]);
  assert.deepEqual(contextIds(study),GUIDED_CONTEXT_CONTROL_ORDER["study-period"]);
  assert.equal(contextControlsForEvent(study)[1].label,"Set retake date");
  assert.equal(
    contextControlsForEvent(study)[2].label,
    "Created automatically after a failed attempt"
  );
});

test("M8 Guided selection is single, deselects with Esc, and Tab cycles chronologically in both directions",() => {
  const store = new FakeStore();
  let state = createCanvasState();
  state = selectCanvasEvent(state,"personal");
  state = selectCanvasEvent(state,"work");
  assert.equal(state.selectedEventId,"work","Guided replaces the prior selection");

  const order = chronologicalEventIds([
    {id:"third",startDate:"2024-01",endDate:"2024-06"},
    {id:"first",startDate:"2022-01",endDate:"2022-06"},
    {id:"second",startDate:"2023-01",endDate:"2023-06"}
  ]);
  assert.deepEqual(order,["first","second","third"]);

  state = createCanvasState();
  let result = applyCanvasKeyboard(store,state,{key:"Tab"});
  assert.equal(result.state.selectedEventId,"education");
  result = applyCanvasKeyboard(store,result.state,{key:"Tab",shiftKey:true});
  assert.equal(result.state.selectedEventId,"personal");
  result = applyCanvasKeyboard(store,result.state,{key:"Escape"});
  assert.equal(result.state.selectedEventId,null);
});

test("M8 Details routing always targets a centered 560px sheet backed by the owning wizard entry",() => {
  const document = canonicalDocument();
  const expected = {
    education:[1,"core"],
    exam:[2,"exams"],
    clinical:[3,"clinical"],
    work:[4,"work"],
    research:[5,"research"],
    personal:[6,"personal"]
  };
  for (const [id,[step,stepId]] of Object.entries(expected)) {
    const route = detailsRouteForEvent(document.events.find((event) => event.id === id));
    assert.equal(route.kind,"wizard-entry-sheet");
    assert.equal(route.placement,"centered");
    assert.equal(route.width,560);
    assert.equal(route.step,step);
    assert.equal(route.stepId,stepId);
    assert.equal(route.sameFieldsAsWizard,true);
    assert.equal(route.fieldsSource,`builder-step-${step}`);
  }
});

test("M8 double-click label state commits with Enter semantics and reverts without mutation on Esc semantics",() => {
  const store = new FakeStore();
  const original = store.document.events.find(({id}) => id === "work");
  let state = beginInlineLabelEdit(selectCanvasEvent(createCanvasState(),"work"),original);
  state = updateInlineLabelDraft(state,"Community health physician");
  const committed = commitInlineLabelEdit(store,state);
  assert.equal(committed.changed,true);
  assert.equal(store.document.events.find(({id}) => id === "work").title,"Community health physician");
  assert.equal(committed.state.inlineEdit,null);
  assert.equal(store.undoStack.at(-1).label,"Edit event label");

  const editingAgain = beginInlineLabelEdit(
    committed.state,
    store.document.events.find(({id}) => id === "work")
  );
  const before = structuredClone(store.document);
  assert.equal(editingAgain.inlineEdit.original,"Community health physician");
  assert.deepEqual(store.document,before,"opening and canceling inline edit is non-mutating");
});

test("M8 body, end, and lane drags remain preview transactions until a single month-snapped drop reflow",() => {
  const store = new FakeStore();
  const before = structuredClone(store.document);
  let reflows = 0;

  const body = beginCanvasDrag(store.document,"work",{
    kind:"move",
    currentMonth:"2026-07"
  });
  const moved = updateCanvasDrag(body,{monthDelta:2});
  assert.equal(moved.preview.startDate,"2022-03");
  assert.equal(moved.preview.endDate,"2023-02");
  assert.equal(moved.liveTooltip,"Mar 2022 – Feb 2023");
  assert.equal(moved.axisReflow,"suppressed-until-drop");
  assert.equal(moved.reflowCount,0);
  assert.deepEqual(store.document,before,"active drag must not mutate or reflow the timeline");

  const dropped = commitCanvasDrag(store,moved,{onDropReflow:() => {reflows += 1;}});
  assert.equal(dropped.changed,true);
  assert.equal(dropped.transaction.reflowCount,1);
  assert.equal(dropped.transaction.settleAnimationMs,240);
  assert.equal(reflows,1);
  assert.equal(store.document.events.find(({id}) => id === "work").startDate,"2022-03");

  const resize = updateCanvasDrag(
    beginCanvasDrag(store.document,"work",{kind:"resize-end",currentMonth:"2026-07"}),
    {monthDelta:-99}
  );
  assert.equal(resize.preview.endDate,resize.preview.startDate,"duration has a one-month minimum");

  const lane = updateCanvasDrag(
    beginCanvasDrag(store.document,"work",{kind:"lane"}),
    {targetLane:4}
  );
  assert.equal(lane.preview.lane,4);
  assert.equal(lane.reflowCount,0);
  assert.equal(cancelCanvasDrag(lane).axisReflow,"canceled");
  assert.equal(reflows,1,"preview and cancel paths never request a reflow");
});

test("M8 keyboard move, resize, lane, Details, F2 trap state, Delete, announcements, and undo toast hooks work",() => {
  const store = new FakeStore();
  let state = selectCanvasEvent(createCanvasState(),"clinical");
  const reflows = [];
  const toasts = [];

  let result = applyCanvasKeyboard(store,state,{key:"ArrowRight"},{
    currentMonth:"2026-07",
    onDropReflow:(entry) => reflows.push(entry)
  });
  state = result.state;
  assert.equal(store.document.events.find(({id}) => id === "clinical").startDate,"2024-02");
  assert.match(state.liveAnnouncement,/moved to Feb 2024 – Jan 2025/);

  result = applyCanvasKeyboard(store,state,{key:"ArrowLeft",shiftKey:true},{
    currentMonth:"2026-07",
    onDropReflow:(entry) => reflows.push(entry)
  });
  state = result.state;
  assert.equal(store.document.events.find(({id}) => id === "clinical").endDate,"2024-12");

  result = applyCanvasKeyboard(store,state,{key:"ArrowRight",altKey:true},{
    currentMonth:"2026-07",
    onDropReflow:(entry) => reflows.push(entry)
  });
  state = result.state;
  assert.equal(store.document.events.find(({id}) => id === "clinical").startDate,"2024-03");

  result = applyCanvasKeyboard(store,state,{key:"ArrowDown"},{onDropReflow:(entry) => reflows.push(entry)});
  state = result.state;
  assert.equal(store.document.events.find(({id}) => id === "clinical").lane,1);
  assert.match(state.liveAnnouncement,/lane 2/);
  assert.equal(reflows.length,4);

  result = applyCanvasKeyboard(store,state,{key:"Enter"});
  state = result.state;
  assert.equal(result.detailsRoute.step,3);
  assert.equal(state.detailsEventId,"clinical");

  result = applyCanvasKeyboard(store,state,{key:"F2"});
  state = result.state;
  assert.equal(state.toolbarFocus,true);
  result = applyCanvasKeyboard(store,state,{key:"Escape"});
  state = result.state;
  assert.equal(state.toolbarFocus,false);
  assert.equal(state.selectedEventId,"clinical");

  result = applyCanvasKeyboard(store,state,{key:"Delete"},{
    onToast:(message,options) => toasts.push({message,options})
  });
  assert.equal(store.document.events.some(({id}) => id === "clinical"),false);
  assert.equal(result.state.selectedEventId,null);
  assert.match(result.state.liveAnnouncement,/deleted/);
  assert.equal(toasts[0].options.actionLabel,"Undo");
  toasts[0].options.onAction();
  assert.equal(store.document.events.some(({id}) => id === "clinical"),true);
});

test("M8 add-event popover contains the shared six-category dataset and adds one canonical event at temporal center",() => {
  const state = {...createCanvasState(),addEventOpen:true};
  const html = renderAddEventPopover(state);
  const ids = [...html.matchAll(/data-add-category="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids,CATEGORIES.map(({id}) => id));
  for (const category of CATEGORIES) {
    assert.match(html,new RegExp(`>${category.label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}<`));
  }

  const store = new FakeStore();
  assert.equal(temporalCenterMonth(store.document.events,{fallbackMonth:"2026-07"}),"2023-08");
  const result = addCanvasEvent(store,"research",{
    fallbackMonth:"2026-07",
    idFactory:() => "canvas-research"
  });
  const added = store.document.events.find(({id}) => id === "canvas-research");
  assert.equal(result.changed,true);
  assert.equal(added.categoryId,"research");
  assert.equal(added.startDate,"2023-08");
  assert.equal(added.endDate,null);
  assert.equal(added.eventType,"milestone");
  assert.equal(added.sourceType,"canvas-guided");
  assert.equal(added.fields.builderDomain,"research");
  assert.equal(result.detailsRoute.step,5);
  assert.equal(result.detailsRoute.eventId,added.id);
  assert.equal(store.undoStack.at(-1).label,"Add Research event");
});

test("M8 Guided context menu is exact and its duplicate/visibility mutations stay in the shared dataset",() => {
  const store = new FakeStore();
  const source = store.document.events.find(({id}) => id === "research");
  const guided = contextMenuForEvent(source);
  assert.deepEqual(guided.map(({id}) => id),GUIDED_CONTEXT_MENU_ORDER);
  assert.deepEqual(
    guided.map(({label}) => label),
    ["Edit details","Duplicate","Show everyone","Delete"]
  );
  assert.doesNotMatch(guided.map(({label}) => label).join(" " ),/Bring forward|Send backward/);

  const duplicate = duplicateCanvasEvent(store,"research",{
    idFactory:(() => {
      const ids = ["research-copy","research-copy-entry"];
      return () => ids.shift();
    })()
  });
  assert.equal(store.document.events.length,7);
  assert.equal(duplicate.event.id,"research-copy");
  assert.equal(duplicate.event.categoryId,"research");
  assert.equal(duplicate.event.visibilityState,VISIBILITY.ADVISOR_ONLY);

  const toggled = toggleCanvasEventVisibility(store,"research");
  assert.equal(toggled.visibilityState,VISIBILITY.INTERVIEWER_SAFE);
  assert.deepEqual(
    contextMenuForEvent(store.document.events.find(({id}) => id === "research")).map(({label}) => label),
    ["Edit details","Duplicate","Advisor only","Delete"]
  );
});

test("M8 undo remains capped at 50 session steps and toolbar hooks preserve redo",() => {
  const store = new FakeStore();
  for (let index = 0; index < 55; index += 1) {
    toggleCanvasEventVisibility(store,"work");
  }
  assert.equal(store.undoStack.length,50);
  const undo = undoCanvas(store);
  assert.equal(undo.entry.label,"Change event visibility");
  assert.match(undo.announcement,/Undid/);
  assert.equal(store.redoStack.length,1);
  const redo = redoCanvas(store);
  assert.equal(redo.entry.label,"Change event visibility");
  assert.match(redo.announcement,/Redid/);
  assert.equal(store.redoStack.length,0);
});

test("M8 History supports manual and all four automatic version actions, restore confirmation, rename, and delete without retired data UI",async() => {
  const store = new FakeStore();
  const now = new Date("2031-06-14T12:00:00.000Z");
  assert.equal(historyDefaultName(4,{now}),"Version 5 · Jun 14");

  const manual = await saveManualCanvasVersion(store,"",{now});
  assert.equal(manual.name,"Version 1 · Jun 14");
  for (const definition of AUTOMATIC_VERSION_TYPES) {
    const version = await createAutomaticCanvasVersion(store,definition.id,{now});
    assert.equal(version.name,`${definition.prefix} Jun 14, 2031`);
    assert.deepEqual(classifyCanvasVersion(version),{
      kind:"automatic",
      automaticType:definition.id
    });
  }
  assert.equal(automaticVersionName("before-intake",{now}),"Before CV import · Jun 14, 2031");

  const state = {
    ...createCanvasState(),
    historyOpen:true,
    versionMenuId:manual.id
  };
  const versions = await store.listVersions();
  const html = renderHistorySlideOver({state,versions,now});
  assert.match(html,/data-width="360" style="width:360px"/);
  assert.match(html,/>Save current as version<\/button>/);
  assert.equal((html.match(/data-version-kind="automatic"/g) || []).length,4);
  assert.equal((html.match(/data-history-restore=/g) || []).length,5);
  assert.match(html,/>Rename<\/button>/);
  assert.match(html,/>Delete<\/button>/);
  assert.doesNotMatch(html,/JSON|Compare view|Import timeline|Export timeline/);

  const renamed = await renameCanvasVersion(store,manual.id,"Advisor review draft");
  assert.equal(renamed.name,"Advisor review draft");
  let confirmationCopy;
  const restored = await restoreCanvasVersion(store,manual.id,{
    confirm:async (copy) => {
      confirmationCopy = copy;
      return true;
    }
  });
  assert.equal(restored.id,manual.id);
  assert.deepEqual(confirmationCopy,{
    title:"Restore this version?",
    body:"Your current board is saved as a version first.",
    primaryLabel:"Restore",
    secondaryLabel:"Cancel"
  });
  assert.deepEqual(store.restored,[manual.id]);
  assert.equal((await deleteCanvasVersion(store,manual.id)).id,manual.id);
  assert.equal(await store.adapter.get("versions",manual.id),null);
});

test("007 zoom exposes Fit, direct percentage, +/- steps, and clamped 25–400% trackpad state",() => {
  let zoom = createCanvasState().zoom;
  assert.deepEqual(zoom,{mode:"fit",percent:null,label:"Fit",snappingIndicator:false});
  zoom = updateCanvasZoom(zoom,{kind:"preset",value:"150"});
  assert.equal(zoom.percent,150);
  zoom = updateCanvasZoom(zoom,{kind:"trackpad",delta:-60});
  assert.equal(zoom.percent,90);
  assert.equal(zoom.snappingIndicator,true);
  zoom = updateCanvasZoom(zoom,{kind:"trackpad",percent:500});
  assert.equal(zoom.percent,400);
  zoom = updateCanvasZoom(zoom,{kind:"trackpad",percent:-10});
  assert.equal(zoom.percent,25);
  assert.equal(updateCanvasZoom(zoom,{kind:"preset",value:"100%"}).percent,100);
  assert.equal(updateCanvasZoom(zoom,{kind:"preset",value:"in"}).percent,35);
  assert.equal(updateCanvasZoom(zoom,{kind:"direct",percent:137}).percent,137);
});

test("Advanced text opens a genuine on-canvas editor with explicit save and cancel",()=>{
  const document=defaultDocument();
  document.mode="advanced";
  document.events=[{
    id:"work",
    title:"Clinical work",
    categoryId:"work",
    eventType:"duration",
    startDate:"2025-01",
    endDate:"2026-01",
    visibilityState:VISIBILITY.INTERVIEWER_SAFE
  }];
  document.advanced.textBlocks=[{
    id:"advanced-text",
    type:"text",
    text:"Interview story",
    x:960,
    y:540,
    width:320,
    height:72,
    font:"Inter",
    size:24,
    weight:400,
    color:"#191C21",
    alignment:"left",
    layerIndex:0
  }];
  const state={
    ...createCanvasState({mode:"advanced"}),
    advancedSelection:{type:"text",id:"advanced-text"},
    advancedTextEdit:{id:"advanced-text",draft:"Interview story revised"}
  };
  const html=renderCanvas({document,state,currentMonth:"2026-07"});
  assert.match(html,/data-advanced-inline-text-form/);
  assert.match(html,/data-advanced-inline-text-input/);
  assert.match(html,/Interview story revised/);
  assert.match(html,/Save text/);
  assert.match(html,/data-canvas-action="cancel-advanced-text"/);
  assert.match(canvasSource,/store\.mutate\("Edit Advanced text"/);
});

test("M8 tablet and phone Canvas contracts are view-only with the exact banner and no email affordance",() => {
  const desktop = canvasResponsiveContract(1024);
  const retinaChromeDesktop = canvasResponsiveContract(983);
  const tablet = canvasResponsiveContract(900);
  const phone = canvasResponsiveContract(500);
  assert.equal(desktop.editing,true);
  assert.equal(retinaChromeDesktop.editing,true);
  assert.equal(retinaChromeDesktop.range,"desktop");
  assert.deepEqual(
    {
      range:tablet.range,
      viewOnly:tablet.viewOnly,
      editing:tablet.editing,
      pan:tablet.pan,
      zoom:tablet.zoom,
      themePicker:tablet.themePicker,
      banner:tablet.banner,
      emailReminder:tablet.emailReminder
    },
    {
      range:"tablet",
      viewOnly:true,
      editing:false,
      pan:true,
      zoom:true,
      themePicker:true,
      banner:"Editing needs a larger screen.",
      emailReminder:false
    }
  );
  assert.equal(phone.previewOnly,true);
  assert.equal(phone.banner,"Editing needs a larger screen.");
  assert.equal(phone.emailReminder,false);

  const state = createCanvasState({viewportWidth:900});
  const html = renderCanvas({
    document:canonicalDocument(),
    state,
    currentMonth:"2026-07"
  });
  assert.match(html,/data-view-only="true"/);
  assert.match(html,/class="canvas-application" role="region"/);
  assert.doesNotMatch(html,/use Tab to move between events/);
  assert.match(html,/>Editing needs a larger screen\.<\/div>/);
  assert.match(html,/data-canvas-action="add-event" disabled/);
  assert.match(html,/data-canvas-action="theme"/);
  assert.doesNotMatch(html,/data-context-toolbar/);
  assert.doesNotMatch(html,/Email me a reminder/);
  assert.throws(() => selectCanvasEvent(state,"work"),{code:"D1_UXR_002_CANVAS_VIEW_ONLY"});

  const empty=canonicalDocument();
  empty.events=[];
  const emptyHtml=renderCanvas({document:empty,state,currentMonth:"2026-07"});
  assert.match(
    emptyHtml,
    /class="canvas-empty-board" role="region" aria-label="Timeline visualization, 0 events\. Editing is unavailable\."/
  );
});

test("D1-405 renders N<4 canvases and preserves short events in the canonical artifact",() => {
  const fewerThanFour = defaultDocument();
  fewerThanFour.events = [{
    id:"two-year",
    title:"Two year event",
    categoryId:"work",
    eventType:"duration",
    startDate:"2025-01",
    endDate:"2026-12",
    visibilityState:VISIBILITY.INTERVIEWER_SAFE
  }];
  const rendered = renderCanvas({
    document:fewerThanFour,
    state:createCanvasState(),
    currentMonth:"2026-07"
  });
  assert.match(rendered,/data-renderer="D1-UXR-002-Keynote-Classic"/);
  assert.doesNotMatch(rendered,/data-render-isolated/);

  const shortArrow = defaultDocument();
  shortArrow.events = [
    {
      id:"short",
      title:"One month",
      categoryId:"work",
      eventType:"duration",
      startDate:"2015-01",
      endDate:"2015-01",
      visibilityState:VISIBILITY.INTERVIEWER_SAFE
    },
    {
      id:"span",
      title:"Span marker",
      categoryId:"personal",
      eventType:"milestone",
      startDate:"2026-06",
      visibilityState:VISIBILITY.INTERVIEWER_SAFE
    }
  ];
  const shortRendered=renderCanvas({
    document:shortArrow,
    state:createCanvasState(),
    currentMonth:"2026-07"
  });
  assert.match(shortRendered,/data-event-id="short"/);
  assert.match(shortRendered,/data-event-id="span"/);
  assert.doesNotMatch(shortRendered,/data-render-isolated/);
});

test("M8 install owns delegated Canvas listeners, canonical rendering, responsive updates, and clean teardown",() => {
  const root = new FakeRoot();
  const store = new FakeStore();
  const controller = installCanvas(root,store,{
    state:createCanvasState(),
    currentMonth:() => "2026-07",
    now:() => new Date("2031-06-14T12:00:00.000Z")
  });
  assert.match(root.innerHTML,/role="application"/);
  assert.match(root.innerHTML,/Timeline visualization, 6 events; use Tab to move between events/);
  assert.deepEqual(
    [...root.listeners.keys()].sort(),
    ["change","click","contextmenu","d1-411a:pan","d1-411a:wheel-zoom","dblclick","focusin","input","keydown","pointerdown","submit","wheel"].sort()
  );
  controller.setResponsiveWidth(900);
  assert.equal(controller.state.responsive.viewOnly,true);
  assert.match(root.innerHTML,/Editing needs a larger screen\./);
  controller.destroy();
  assert.equal(root.listeners.size,0);
});

test("M8 an existing Advanced document is unlocked in the canonical store before its first gesture",()=>{
  const document=canonicalDocument();
  document.mode="advanced";
  document.layoutLock=true;
  delete document.preferences.advancedFreePlacementInitialized;
  const root=new FakeRoot();
  const store=new FakeStore(document);
  const controller=installCanvas(root,store,{
    state:{...createCanvasState({mode:"advanced"}),entitlementEditable:true},
    currentMonth:()=>"2026-07"
  });
  assert.equal(store.document.layoutLock,false);
  assert.equal(store.document.preferences.advancedFreePlacementInitialized,true);
  controller.destroy();
});

test("M10 Canvas theme picker moves focus on open and restores the trigger on close, selection, and Escape",()=>{
  assert.match(
    canvasSource,
    /focus === "theme-picker"[\s\S]*\[data-theme-picker\] \[data-select-theme\]/
  );
  assert.match(
    canvasSource,
    /focus === "theme-trigger"[\s\S]*data-canvas-action="theme"/
  );
  assert.match(
    canvasSource,
    /opening&&isEditable\(state\)\?"theme-picker":"theme-trigger"/
  );
  assert.match(
    canvasSource,
    /if \(state\.themeOpen\) \{[\s\S]*themeOpen:false\},\{focus:"theme-trigger"\}/
  );
});

test("M11 read-only Canvas keeps inspection controls safe and cancels stale mutation paths",()=>{
  const readOnlyState={
    ...createCanvasState(),
    entitlementEditable:false,
    historyOpen:true
  };
  const history=renderHistorySlideOver({
    state:readOnlyState,
    versions:[{
      id:"version-read-only",
      name:"Before access changed",
      createdAt:"2031-06-14T12:00:00.000Z",
      eventCount:6
    }]
  });
  assert.match(history,/Saved versions are available for review/);
  assert.match(history,/data-history-restore="version-read-only" disabled/);
  assert.match(history,/data-history-menu="version-read-only"[^>]* disabled/);

  const root=new FakeRoot();
  const store=new FakeStore();
  const controller=installCanvas(root,store,{
    state:readOnlyState,
    currentMonth:()=>"2026-07"
  });
  const before=structuredClone(store.document);
  assert.doesNotThrow(()=>root.listeners.get("keydown")({
    key:"ArrowRight",
    target:{closest:()=>({})},
    preventDefault(){throw new Error("Read-only key must remain non-mutating.");}
  }));
  assert.deepEqual(store.document,before);
  controller.destroy();

  assert.match(
    canvasSource,
    /if\(!isEditable\(next\)&&pointer\)\{[\s\S]*next=\{\.\.\.next,drag:null\}/
  );
  assert.match(
    canvasSource,
    /const onPointerMove = \(event\) => \{[\s\S]*if\(!isEditable\(state\)\)\{[\s\S]*pointer=null/
  );
  assert.match(
    canvasSource,
    /const onPointerUp = \(\) => \{[\s\S]*if\(!isEditable\(state\)\)\{[\s\S]*pointer=null/
  );
  assert.match(
    canvasSource,
    /await refreshVersions\(\);[\s\S]*history-slide-over button/
  );
  assert.match(
    canvasSource,
    /focus === "history-trigger"[\s\S]*data-canvas-action="history"/
  );
});
