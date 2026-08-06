import {CATEGORIES,HISTORY_LIMIT,VISIBILITY} from "./constants.js";
import {renderKeynoteClassicBoard} from "./board-renderer.js";
import {assignStableLanes} from "./adaptive-layout.js";
import {
  compareExactDates,
  shiftExactDateByMonths
} from "./exact-date-field.js";
import {
  addMonths,
  clone,
  escapeHtml,
  formatMonth,
  monthIndex,
  monthString,
  parseMonth,
  shortDate,
  uid
} from "./utils.js";

const freeze = (value) => Object.freeze(value);

export const CANVAS_TOOLBAR_ORDER = freeze([
  "mode",
  "divider",
  "add-event",
  "undo",
  "redo",
  "divider",
  "theme",
  "zoom",
  "spacer",
  "history",
  "comments"
]);

export const GUIDED_CONTEXT_CONTROL_ORDER = freeze({
  arrow: freeze([
    "category",
    "title",
    "start",
    "end",
    "visibility",
    "details",
    "delete"
  ]),
  milestone: freeze([
    "category",
    "title",
    "start",
    "visibility",
    "details",
    "delete"
  ]),
  "personal-milestone": freeze([
    "category",
    "title",
    "start",
    "icon",
    "visibility",
    "details",
    "delete"
  ]),
  "exam-milestone-with-score": freeze([
    "category",
    "title",
    "start",
    "show-score",
    "visibility",
    "details",
    "delete"
  ]),
  "study-period": freeze([
    "start",
    "end",
    "automatic-note",
    "delete"
  ])
});

export const GUIDED_CONTEXT_MENU_ORDER = freeze([
  "edit-details",
  "duplicate",
  "toggle-visibility",
  "delete"
]);

export const AUTOMATIC_VERSION_TYPES = freeze([
  freeze({id:"export",prefix:"Export ·"}),
  freeze({id:"advisor-request",prefix:"Sent for review ·"}),
  freeze({id:"start-over",prefix:"Before starting over ·"}),
  freeze({id:"before-intake",prefix:"Before CV import ·"})
]);

export const CANVAS_FOUNDER_BRANCHES = freeze({
  N_LT_4:"D1_UXR_002_M4_ISOLATED_N_LT_4_YEAR_WIDTH_CONTRADICTION",
  SHORT_ARROW:"D1_UXR_002_M4_ISOLATED_DURATION_WIDTH_LT_ARROW_HEAD"
});

const CATEGORY_STEP = freeze({
  education:freeze({step:1,stepId:"core",builderDomain:"core"}),
  exams:freeze({step:2,stepId:"exams",builderDomain:"exams"}),
  clinical:freeze({step:3,stepId:"clinical",builderDomain:"clinical"}),
  work:freeze({step:4,stepId:"work",builderDomain:"work"}),
  research:freeze({step:5,stepId:"research",builderDomain:"research"}),
  personal:freeze({step:6,stepId:"personal",builderDomain:"personal"})
});

const DRAG_KINDS = new Set([
  "move","resize-start","resize-end","lane","free-move","free-resize"
]);
const EDITING_ACTIONS = new Set([
  "add-event",
  "undo",
  "redo",
  "mode",
  "delete",
  "duplicate",
  "toggle-visibility"
]);

function currentMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}`;
}

function eventKind(event) {
  if(event?.fields?.builderDomain==="explanation")return"explanation";
  const source = String(event?.sourceType || "").toLowerCase();
  const studyKind = String(event?.studyPeriodKind || "").toLowerCase();
  if (
    event?.isStudyPeriod ||
    event?.studyPeriod ||
    event?.fields?.isStudyPeriod ||
    source === "auto-study-period" ||
    source === "study-period" ||
    studyKind
  ) {
    return "study-period";
  }
  return String(event?.eventType || event?.kind || event?.type).toLowerCase() === "milestone"
    ? "milestone"
    : "arrow";
}

function eventScore(event) {
  return event?.score ?? event?.fields?.score ?? event?.fields?.examScore ?? "";
}

function eventById(document, eventId) {
  return (document?.events || []).find((event) => String(event.id) === String(eventId)) || null;
}

function assertEvent(document, eventId) {
  const event = eventById(document,eventId);
  if (!event) throw new Error(`Canvas event not found: ${String(eventId)}`);
  return event;
}

function normalizedLane(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0,Math.trunc(number)) : 0;
}

function isEditable(state) {
  return state?.responsive?.editing !== false&&
    state?.entitlementEditable !== false;
}

function assertEditable(state) {
  if (!isEditable(state)) {
    const error = new Error("Editing needs a larger screen.");
    error.code = "D1_UXR_002_CANVAS_VIEW_ONLY";
    throw error;
  }
}

function dateWithYear(value) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US",{
    month:"short",
    day:"numeric",
    year:"numeric"
  }).format(date);
}

function control(id,label,extra = {}) {
  return freeze({id,label,...extra});
}

export function canvasResponsiveContract(viewportWidth = 1440) {
  const width = Number.isFinite(Number(viewportWidth)) ? Number(viewportWidth) : 1440;
  // A maximized 13-inch Retina Chrome window exposes 983 CSS px after the
  // browser frame. Keep that real desktop usable without opening editing on
  // the established 900 px tablet contract.
  if (width >= 960) {
    return freeze({
      range:"desktop",
      viewOnly:false,
      previewOnly:false,
      editing:true,
      pan:true,
      zoom:true,
      themePicker:true,
      banner:null,
      emailReminder:false
    });
  }
  if (width >= 768) {
    return freeze({
      range:"tablet",
      viewOnly:true,
      previewOnly:false,
      editing:false,
      pan:true,
      zoom:true,
      themePicker:true,
      banner:"Editing needs a larger screen.",
      emailReminder:false
    });
  }
  return freeze({
    range:"phone",
    viewOnly:true,
    previewOnly:true,
    editing:false,
    pan:true,
    zoom:true,
    themePicker:true,
    banner:"Editing needs a larger screen.",
    emailReminder:false
  });
}

export function createCanvasZoom(value = "fit") {
  if (String(value).toLowerCase() === "fit") {
    return freeze({mode:"fit",percent:null,label:"Fit",snappingIndicator:false});
  }
  const percent = Math.min(200,Math.max(50,Math.round(Number(value) || 100)));
  return freeze({
    mode:"percent",
    percent,
    label:`${percent}%`,
    snappingIndicator:false
  });
}

export function updateCanvasZoom(zoom,change) {
  const prior = zoom?.mode === "percent" ? zoom.percent : 100;
  if (change?.kind === "preset") {
    const preset = String(change.value).toLowerCase();
    if (preset === "fit") return createCanvasZoom("fit");
    if (preset === "100" || preset === "100%") return createCanvasZoom(100);
    if (preset === "150" || preset === "150%") return createCanvasZoom(150);
    throw new TypeError("Canvas zoom preset must be Fit, 100%, or 150%.");
  }
  if (change?.kind !== "trackpad") {
    throw new TypeError("Canvas zoom change must be a preset or trackpad change.");
  }
  const requested = change.percent == null
    ? prior + Number(change.delta || 0)
    : Number(change.percent);
  const percent = Math.min(200,Math.max(50,Math.round(requested)));
  const crossed100 = (prior < 100 && percent >= 100) || (prior > 100 && percent <= 100);
  return freeze({
    mode:"percent",
    percent,
    label:`${percent}%`,
    snappingIndicator:crossed100
  });
}

export function createCanvasState({
  viewportWidth = 1440,
  zoom = "fit",
  mode = "guided"
} = {}) {
  return {
    mode:mode === "advanced" ? "advanced" : "guided",
    selectedEventId:null,
    addEventOpen:false,
    categoryMenuOpen:false,
    themeOpen:false,
    backgroundOpen:false,
    backgroundTab:"Presets",
    historyOpen:false,
    historyNaming:false,
    historyName:"",
    versionMenuId:null,
    detailsEventId:null,
    commentsOpen:false,
    activeAdvisorPinId:null,
    advancedSelection:null,
    advancedTextEdit:null,
    advancedPanel:"elements",
    advancedAssetQuery:"",
    contextMenu:null,
    inlineEdit:null,
    toolbarFocus:false,
    drag:null,
    zoom:createCanvasZoom(zoom),
    liveAnnouncement:"",
    responsive:canvasResponsiveContract(viewportWidth)
  };
}

export function chronologicalEventIds(events) {
  return (events || [])
    .map((event,index) => ({
      id:String(event.id),
      index,
      start:monthIndex(event.startDate ?? event.date),
      end:monthIndex(event.endDate ?? event.startDate ?? event.date)
    }))
    .filter(({start}) => Number.isFinite(start))
    .sort((left,right) => (
      left.start - right.start ||
      left.end - right.end ||
      left.index - right.index
    ))
    .map(({id}) => id);
}

export function selectCanvasEvent(state,eventId) {
  assertEditable(state);
  return {
    ...state,
    selectedEventId:String(eventId),
    addEventOpen:false,
    categoryMenuOpen:false,
    contextMenu:null,
    inlineEdit:null,
    toolbarFocus:false
  };
}

export function deselectCanvas(state) {
  return {
    ...state,
    selectedEventId:null,
    contextMenu:null,
    inlineEdit:null,
    toolbarFocus:false,
    categoryMenuOpen:false
  };
}

export function cycleCanvasSelection(state,events,direction = 1) {
  assertEditable(state);
  const ids = chronologicalEventIds(events);
  if (!ids.length) return deselectCanvas(state);
  const current = ids.indexOf(String(state.selectedEventId));
  const delta = direction < 0 ? -1 : 1;
  const index = current < 0
    ? (delta < 0 ? ids.length - 1 : 0)
    : (current + delta + ids.length) % ids.length;
  return {
    ...state,
    selectedEventId:ids[index],
    contextMenu:null,
    inlineEdit:null,
    toolbarFocus:false,
    liveAnnouncement:`Selected ${eventById({events},ids[index])?.title || "event"}`
  };
}

export function contextControlsForEvent(event) {
  const kind = eventKind(event);
  if (kind === "study-period") {
    const provisional = Boolean(
      event?.provisional ||
      event?.isProvisional ||
      event?.fields?.provisional ||
      event?.fields?.retakeDatePending
    );
    return freeze([
      control("start",formatMonth(event.startDate) || "Start"),
      control("end",provisional ? "Set retake date" : (formatMonth(event.endDate) || "End")),
      control(
        "automatic-note",
        "Created automatically after a failed attempt",
        {interactive:false}
      ),
      control("delete","Delete")
    ]);
  }

  const category = CATEGORIES.find(({id}) => id === event?.categoryId);
  const commonStart = [
    control("category",category?.label || "Category",{color:category?.color || "#565D66"}),
    control("title",String(event?.title || "Untitled event")),
    control("start",formatMonth(event?.startDate) || "Start")
  ];
  const commonEnd = [
    control(
      "visibility",
      event?.visibilityState === VISIBILITY.ADVISOR_ONLY ? "Advisor only" : "Show everyone"
    ),
    control("details","Details"),
    control("delete","Delete")
  ];

  if (kind === "arrow") {
    return freeze([
      ...commonStart,
      control("end",event?.openEnded ? "Present" : (formatMonth(event?.endDate) || "End")),
      ...commonEnd
    ]);
  }

  const conditional = [];
  if (event?.categoryId === "personal") {
    conditional.push(control("icon",event?.fields?.icon || "star"));
  }
  if (event?.categoryId === "exams" && String(eventScore(event)).trim()) {
    conditional.push(control(
      "show-score",
      "Show score",
      {checked:event?.fields?.showScore !== false}
    ));
  }
  return freeze([...commonStart,...conditional,...commonEnd]);
}

export function contextMenuForEvent(event,{mode = "guided"} = {}) {
  const toggleLabel = event?.visibilityState === VISIBILITY.ADVISOR_ONLY
    ? "Show everyone"
    : "Advisor only";
  const items = [
    control("edit-details","Edit details"),
    control("duplicate","Duplicate"),
    control("toggle-visibility",toggleLabel)
  ];
  const kind = String(event?.eventType || event?.kind || "").toLowerCase();
  if (mode === "advanced" && ["media","text"].includes(kind)) {
    items.push(
      control("bring-forward","Bring forward"),
      control("send-backward","Send backward")
    );
  }
  items.push(control("delete","Delete"));
  return freeze(items);
}

export function detailsRouteForEvent(event) {
  const domain = event?.fields?.builderDomain;
  if(domain==="explanation"){
    return freeze({
      kind:"explanation",
      placement:"centered",
      width:560,
      eventId:String(event?.id||""),
      entryId:String(event?.id||""),
      step:7,
      stepId:"review",
      fieldsSource:"builder-step-7-explanation",
      sameFieldsAsWizard:true
    });
  }
  const owner = CATEGORY_STEP[event?.categoryId] || CATEGORY_STEP.personal;
  const resolved = Object.values(CATEGORY_STEP).find((item) => item.builderDomain === domain) || owner;
  return freeze({
    kind:"wizard-entry-sheet",
    placement:"centered",
    width:560,
    eventId:String(event?.id || ""),
    entryId:String(event?.fields?.builderEntryId || event?.id || ""),
    step:resolved.step,
    stepId:resolved.stepId,
    fieldsSource:`builder-step-${resolved.step}`,
    sameFieldsAsWizard:true
  });
}

export function beginInlineLabelEdit(state,event) {
  assertEditable(state);
  if (!event?.id) throw new TypeError("Inline label editing requires an event.");
  const title = String(event.title || "");
  return {
    ...state,
    selectedEventId:String(event.id),
    inlineEdit:{eventId:String(event.id),original:title,draft:title},
    toolbarFocus:false,
    contextMenu:null
  };
}

export function updateInlineLabelDraft(state,value) {
  if (!state.inlineEdit) return state;
  return {
    ...state,
    inlineEdit:{...state.inlineEdit,draft:String(value ?? "")}
  };
}

export function cancelInlineLabelEdit(state) {
  return {...state,inlineEdit:null,liveAnnouncement:"Label edit canceled"};
}

function runStoreMutation(store,label,operation) {
  if (!store || typeof store.mutate !== "function") {
    throw new TypeError("Canvas mutations require a TimelineStore-compatible store.");
  }
  const changed = store.mutate(label,operation);
  if (Array.isArray(store.undoStack) && store.undoStack.length > HISTORY_LIMIT) {
    store.undoStack.splice(0,store.undoStack.length - HISTORY_LIMIT);
  }
  return changed;
}

export function commitInlineLabelEdit(store,state) {
  if (!state.inlineEdit) return {changed:false,state};
  const title = state.inlineEdit.draft.trim();
  if (!title) {
    return {
      changed:false,
      state:{...state,liveAnnouncement:"A label cannot be empty."},
      error:"A label cannot be empty."
    };
  }
  const changed = runStoreMutation(store,"Edit event label",(document) => {
    assertEvent(document,state.inlineEdit.eventId).title = title;
  });
  return {
    changed,
    state:{
      ...state,
      inlineEdit:null,
      liveAnnouncement:changed ? `Label changed to ${title}` : "Label unchanged"
    }
  };
}

export function temporalCenterMonth(events,{fallbackMonth = currentMonth()} = {}) {
  const values = (events || []).flatMap((event) => {
    const start = monthIndex(event.startDate ?? event.date);
    const end = monthIndex(event.endDate ?? event.startDate ?? event.date);
    return [start,end];
  }).filter(Number.isFinite);
  if (!values.length) return parseMonth(fallbackMonth) || currentMonth();
  return monthString(Math.round((Math.min(...values) + Math.max(...values)) / 2));
}

export function addCanvasEvent(
  store,
  categoryId,
  {
    fallbackMonth = currentMonth(),
    idFactory = () => uid("event"),
    eventFactory = null
  } = {}
) {
  const category = CATEGORIES.find(({id}) => id === categoryId);
  if (!category) throw new TypeError(`Unknown timeline category: ${String(categoryId)}`);
  const centerMonth = temporalCenterMonth(store?.document?.events,{fallbackMonth});
  const id = String(idFactory(categoryId));
  const owner = CATEGORY_STEP[categoryId];
  const base = {
    id,
    title:`Untitled ${category.label.toLowerCase()} event`,
    categoryId,
    eventType:"milestone",
    startDate:centerMonth,
    endDate:null,
    openEnded:false,
    visibilityState:VISIBILITY.INTERVIEWER_SAFE,
    siteName:"",
    notes:"",
    lane:null,
    sourceType:"canvas-guided",
    provenance:[],
    fields:{
      builderDomain:owner.builderDomain,
      builderEntryId:id,
      canvasDraft:true
    }
  };
  const event = eventFactory ? eventFactory(clone(base),category) : base;
  if (!event || String(event.id || "") !== id || event.categoryId !== categoryId) {
    throw new TypeError("Canvas event factories must preserve the canonical id and category.");
  }
  const changed = runStoreMutation(store,`Add ${category.label} event`,(document) => {
    document.events.push(clone(event));
  });
  return {
    changed,
    event:clone(event),
    detailsRoute:detailsRouteForEvent(event),
    announcement:`${category.label} event added at ${formatMonth(centerMonth)}`
  };
}

function shiftedEvent(before,kind,{
  monthDelta = 0,
  targetLane = null,
  laneDelta = 0,
  pixelDeltaX = 0,
  pixelDeltaY = 0,
  currentMonth:nowMonth
}) {
  const event = clone(before);
  const delta = Math.trunc(Number(monthDelta) || 0);
  const type = eventKind(event);

  if(type==="explanation"){
    const fields={...(event.fields||{})};
    const dx=Math.round(Number(pixelDeltaX)||0);
    const dy=Math.round(Number(pixelDeltaY)||0);
    if(kind==="free-move"){
      fields.x=Math.min(1744,Math.max(96,(Number(fields.x)||1470)+dx));
      fields.y=Math.min(904,Math.max(80,(Number(fields.y)||574)+dy));
    }else if(kind==="free-resize"){
      fields.width=Math.min(520,Math.max(180,(Number(fields.width)||300)+dx));
      fields.height=Math.min(320,Math.max(110,(Number(fields.height)||190)+dy));
    }else{
      throw new TypeError(`Unsupported explanation drag kind: ${String(kind)}`);
    }
    event.fields=fields;
    return event;
  }

  if (kind === "lane") {
    const lane = targetLane == null
      ? normalizedLane(event.lane) + Math.trunc(Number(laneDelta) || 0)
      : normalizedLane(targetLane);
    event.lane = Math.max(0,lane);
    return event;
  }

  if (kind === "move") {
    event.startDate = addMonths(event.startDate,delta);
    if (type === "arrow" || type === "study-period") {
      if (event.endDate) event.endDate = addMonths(event.endDate,delta);
    }
    syncClinicalExactDates(before,event,kind);
    return event;
  }

  if (type === "milestone") {
    throw new TypeError("Milestone flags do not have duration handles.");
  }

  const effectiveEnd = parseMonth(event.endDate) || (
    event.openEnded ? (parseMonth(nowMonth) || currentMonth()) : null
  );
  if (kind === "resize-start") {
    const requested = addMonths(event.startDate,delta);
    if (!requested) throw new TypeError("Resize requires a valid start month.");
    event.startDate = effectiveEnd && monthIndex(requested) > monthIndex(effectiveEnd)
      ? effectiveEnd
      : requested;
    syncClinicalExactDates(before,event,kind);
    return event;
  }
  if (kind === "resize-end") {
    if (!effectiveEnd) throw new TypeError("Resize requires a valid end month.");
    const requested = addMonths(effectiveEnd,delta);
    event.endDate = monthIndex(requested) < monthIndex(event.startDate)
      ? event.startDate
      : requested;
    event.openEnded = false;
    syncClinicalExactDates(before,event,kind);
    return event;
  }
  throw new TypeError(`Unsupported Canvas drag kind: ${String(kind)}`);
}

function syncClinicalExactDates(before,event,kind){
  if(
    (event.fields?.builderDomain||event.categoryId)!=="clinical"||
    event.fields?.rotationDatePrecision!=="day"
  )return event;
  const fields={...(event.fields||{})};
  const startDelta=(monthIndex(event.startDate)??0)-(monthIndex(before.startDate)??0);
  const endDelta=(monthIndex(event.endDate)??0)-(monthIndex(before.endDate)??0);
  if(kind==="move"||kind==="resize-start"){
    fields.rotationStartDate=shiftExactDateByMonths(
      before.fields?.rotationStartDate,
      startDelta
    );
  }
  if(kind==="move"||kind==="resize-end"){
    fields.rotationEndDate=before.fields?.rotationEndDate
      ?shiftExactDateByMonths(before.fields.rotationEndDate,endDelta)
      :null;
  }
  if(
    fields.rotationStartDate&&
    fields.rotationEndDate&&
    compareExactDates(fields.rotationStartDate,fields.rotationEndDate)===1
  ){
    if(kind==="resize-start")fields.rotationStartDate=fields.rotationEndDate;
    else fields.rotationEndDate=fields.rotationStartDate;
  }
  fields.rotationDatePrecision=fields.rotationStartDate&&(
    event.openEnded||fields.rotationEndDate
  )?"day":"month-legacy";
  event.fields=fields;
  return event;
}

export function canvasDateTooltip(event) {
  if(eventKind(event)==="explanation"){
    const fields=event?.fields||{};
    return`Position ${Math.round(Number(fields.x)||0)}, ${Math.round(Number(fields.y)||0)} · ${Math.round(Number(fields.width)||0)} × ${Math.round(Number(fields.height)||0)}`;
  }
  const start = formatMonth(event?.startDate);
  if (eventKind(event) === "milestone") return start;
  const end = event?.openEnded ? "Present" : formatMonth(event?.endDate);
  return end ? `${start} – ${end}` : start;
}

export function beginCanvasDrag(
  document,
  eventId,
  {
    kind = "move",
    currentMonth:nowMonth = currentMonth(),
    reducedMotion = false
  } = {}
) {
  if (!DRAG_KINDS.has(kind)) throw new TypeError(`Unsupported Canvas drag kind: ${String(kind)}`);
  const before = clone(assertEvent(document,eventId));
  if (
    (kind === "resize-start" || kind === "resize-end") &&
    eventKind(before) === "milestone"
  ) {
    throw new TypeError("Milestone flags do not have duration handles.");
  }
  return {
    active:true,
    eventId:String(eventId),
    kind,
    before,
    preview:clone(before),
    monthDelta:0,
    laneDelta:0,
    pixelDeltaX:0,
    pixelDeltaY:0,
    targetLane:null,
    currentMonth:parseMonth(nowMonth) || currentMonth(),
    liveTooltip:canvasDateTooltip(before),
    axisReflow:"suppressed-until-drop",
    reflowCount:0,
    settleAnimationMs:reducedMotion ? 0 : 240,
    reducedMotion:Boolean(reducedMotion)
  };
}

export function updateCanvasDrag(
  transaction,
  {
    monthDelta = transaction?.monthDelta || 0,
    laneDelta = transaction?.laneDelta || 0,
    targetLane = transaction?.targetLane ?? null
    ,pixelDeltaX = transaction?.pixelDeltaX || 0
    ,pixelDeltaY = transaction?.pixelDeltaY || 0
  } = {}
) {
  if (!transaction?.active) throw new TypeError("Canvas drag transaction is not active.");
  const preview = shiftedEvent(transaction.before,transaction.kind,{
    monthDelta,
    laneDelta,
    targetLane,
    pixelDeltaX,
    pixelDeltaY,
    currentMonth:transaction.currentMonth
  });
  return {
    ...transaction,
    preview,
    monthDelta:Math.trunc(Number(monthDelta) || 0),
    laneDelta:Math.trunc(Number(laneDelta) || 0),
    targetLane:targetLane == null ? null : normalizedLane(targetLane),
    pixelDeltaX:Math.round(Number(pixelDeltaX)||0),
    pixelDeltaY:Math.round(Number(pixelDeltaY)||0),
    liveTooltip:canvasDateTooltip(preview),
    axisReflow:"suppressed-until-drop",
    reflowCount:0
  };
}

function dragAnnouncement(transaction) {
  const title = transaction.preview.title || "Event";
  if(eventKind(transaction.preview)==="explanation"){
    return`${title} ${transaction.kind==="free-resize"?"resized":"moved"}: ${canvasDateTooltip(transaction.preview)}`;
  }
  if (transaction.kind === "lane") {
    return `${title} moved to lane ${normalizedLane(transaction.preview.lane) + 1}`;
  }
  if (transaction.kind === "resize-start") {
    return `${title} starts ${formatMonth(transaction.preview.startDate)}`;
  }
  if (transaction.kind === "resize-end") {
    return `${title} ends ${formatMonth(transaction.preview.endDate)}`;
  }
  return `${title} moved to ${canvasDateTooltip(transaction.preview)}`;
}

export function commitCanvasDrag(
  store,
  transaction,
  {
    onDropReflow = () => {}
  } = {}
) {
  if (!transaction?.active) throw new TypeError("Canvas drag transaction is not active.");
  const label = transaction.kind === "free-move"
    ?"Move explanation"
    :transaction.kind === "free-resize"
      ?"Resize explanation"
      :transaction.kind === "lane"
    ? "Move event lane"
    : transaction.kind === "move"
      ? "Move event"
      : "Resize event";
  const changed = runStoreMutation(store,label,(document) => {
    const event = assertEvent(document,transaction.eventId);
    Object.assign(event,clone(transaction.preview));
    if (transaction.kind === "lane"&&eventKind(event)!=="explanation") {
      const preferred = Object.fromEntries(
        document.events
          .filter((item) => eventKind(item) !== "milestone")
          .map((item) => [item.id,normalizedLane(item.lane)])
      );
      preferred[event.id] = normalizedLane(transaction.preview.lane);
      const arranged = assignStableLanes(document.events,{previousLaneById:preferred});
      for (const item of document.events) {
        if (eventKind(item) !== "milestone") item.lane = arranged.laneById[item.id];
      }
    }
  });
  if (changed) {
    onDropReflow({
      kind:transaction.kind === "lane" ? "lane-drop" : "event-date-change",
      eventId:transaction.eventId,
      settleAnimationMs:transaction.settleAnimationMs
    });
  }
  return {
    changed,
    transaction:{
      ...transaction,
      active:false,
      axisReflow:changed ? "completed-on-drop" : "not-required",
      reflowCount:changed ? 1 : 0
    },
    announcement:changed ? dragAnnouncement(transaction) : "Event unchanged"
  };
}

export function cancelCanvasDrag(transaction) {
  if (!transaction) return null;
  return {
    ...transaction,
    active:false,
    preview:clone(transaction.before),
    axisReflow:"canceled",
    reflowCount:0
  };
}

export function deleteCanvasEvent(store,eventId) {
  const event = clone(assertEvent(store.document,eventId));
  const changed = runStoreMutation(store,"Delete event",(document) => {
    document.events = document.events.filter((item) => String(item.id) !== String(eventId));
  });
  return {
    changed,
    event,
    announcement:changed ? `${event.title || "Event"} deleted` : "Event unchanged"
  };
}

export function duplicateCanvasEvent(
  store,
  eventId,
  {
    idFactory = () => uid("event")
  } = {}
) {
  const source = clone(assertEvent(store.document,eventId));
  const duplicateId = String(idFactory(source));
  const duplicate = {
    ...source,
    id:duplicateId,
    title:`${source.title || "Untitled event"} copy`,
    fields:{
      ...(source.fields || {}),
      builderEntryId:`${duplicateId}-entry`
    }
  };
  const changed = runStoreMutation(store,"Duplicate event",(document) => {
    document.events.push(clone(duplicate));
  });
  return {
    changed,
    event:duplicate,
    announcement:changed ? `${duplicate.title} created` : "Event unchanged"
  };
}

export function toggleCanvasEventVisibility(store,eventId) {
  let next;
  const changed = runStoreMutation(store,"Change event visibility",(document) => {
    const event = assertEvent(document,eventId);
    next = event.visibilityState === VISIBILITY.ADVISOR_ONLY
      ? VISIBILITY.INTERVIEWER_SAFE
      : VISIBILITY.ADVISOR_ONLY;
    event.visibilityState = next;
  });
  return {
    changed,
    visibilityState:next,
    announcement:next === VISIBILITY.ADVISOR_ONLY
      ? "Event visible to advisor only"
      : "Event visible to everyone"
  };
}

export function swapCanvasEventCategory(store,eventId,categoryId) {
  if (!CATEGORIES.some(({id}) => id === categoryId)) {
    throw new TypeError(`Unknown timeline category: ${String(categoryId)}`);
  }
  const changed = runStoreMutation(store,"Change event category",(document) => {
    assertEvent(document,eventId).categoryId = categoryId;
  });
  return {
    changed,
    categoryId,
    announcement:`Category changed to ${CATEGORIES.find(({id}) => id === categoryId).label}`
  };
}

export function setCanvasPersonalIcon(store,eventId,iconName) {
  const event = assertEvent(store.document,eventId);
  if (event.categoryId !== "personal" || eventKind(event) !== "milestone") {
    throw new TypeError("Icon swap is available only for Personal milestone flags.");
  }
  const changed = runStoreMutation(store,"Change personal milestone icon",(document) => {
    const target = assertEvent(document,eventId);
    target.fields = {...(target.fields || {}),icon:String(iconName || "star")};
  });
  return {changed,announcement:`Personal icon changed to ${String(iconName || "star")}`};
}

export function toggleCanvasScore(store,eventId) {
  const event = assertEvent(store.document,eventId);
  if (event.categoryId !== "exams" || !String(eventScore(event)).trim()) {
    throw new TypeError("Show score is available only for exam milestones with a score.");
  }
  let shown;
  const changed = runStoreMutation(store,"Toggle exam score",(document) => {
    const target = assertEvent(document,eventId);
    shown = target.fields?.showScore === false;
    target.fields = {...(target.fields || {}),showScore:shown};
  });
  return {changed,shown,announcement:shown ? "Exam score shown" : "Exam score hidden"};
}

export function canvasKeyboardIntent(keyEvent,{hasSelection = true,toolbarFocus = false} = {}) {
  const key = String(keyEvent?.key || "");
  if ((keyEvent?.metaKey || keyEvent?.ctrlKey) && key.toLowerCase() === "z") {
    return freeze({type:keyEvent?.shiftKey ? "redo" : "undo"});
  }
  if (key === "Escape") return freeze({type:toolbarFocus ? "exit-toolbar" : "deselect"});
  if (key === "Tab") return freeze({type:"cycle-selection",direction:keyEvent?.shiftKey ? -1 : 1});
  if (!hasSelection) return null;
  if (key === "F2") return freeze({type:"focus-toolbar"});
  if (key === "Enter") return freeze({type:"open-details"});
  if (key === "Delete" || key === "Backspace") return freeze({type:"delete"});
  if (key === "ArrowUp") return freeze({type:"lane",laneDelta:-1});
  if (key === "ArrowDown") return freeze({type:"lane",laneDelta:1});
  if (key === "ArrowLeft" || key === "ArrowRight") {
    const delta = key === "ArrowLeft" ? -1 : 1;
    if (keyEvent?.shiftKey) return freeze({type:"resize-end",monthDelta:delta});
    if (keyEvent?.altKey) return freeze({type:"resize-start",monthDelta:delta});
    return freeze({type:"move",monthDelta:delta});
  }
  return null;
}

export function applyCanvasKeyboard(
  store,
  state,
  keyEvent,
  {
    currentMonth:nowMonth = currentMonth(),
    onDropReflow = () => {},
    onToast = () => {}
  } = {}
) {
  const event = eventById(store.document,state.selectedEventId);
  const intent = canvasKeyboardIntent(keyEvent,{
    hasSelection:Boolean(event),
    toolbarFocus:state.toolbarFocus
  });
  if (!intent) return {handled:false,state,intent:null};
  assertEditable(state);

  if (intent.type === "cycle-selection") {
    return {
      handled:true,
      state:cycleCanvasSelection(state,store.document.events,intent.direction),
      intent
    };
  }
  if (intent.type === "undo") {
    const result = undoCanvas(store);
    return {
      handled:true,
      state:{...state,liveAnnouncement:result.announcement},
      intent,
      result
    };
  }
  if (intent.type === "redo") {
    const result = redoCanvas(store);
    return {
      handled:true,
      state:{...state,liveAnnouncement:result.announcement},
      intent,
      result
    };
  }
  if (intent.type === "exit-toolbar") {
    return {
      handled:true,
      state:{...state,toolbarFocus:false,liveAnnouncement:"Returned to selected event"},
      intent
    };
  }
  if (intent.type === "deselect") {
    return {handled:true,state:deselectCanvas(state),intent};
  }
  if (intent.type === "focus-toolbar") {
    return {
      handled:true,
      state:{...state,toolbarFocus:true,liveAnnouncement:"Contextual toolbar"},
      intent
    };
  }
  if (intent.type === "open-details") {
    return {
      handled:true,
      state:{...state,detailsEventId:event.id,toolbarFocus:false},
      intent,
      detailsRoute:detailsRouteForEvent(event)
    };
  }
  if (intent.type === "delete") {
    const result = deleteCanvasEvent(store,event.id);
    onToast(result.announcement,{
      actionLabel:"Undo",
      onAction:() => store.undo?.()
    });
    return {
      handled:true,
      state:{
        ...deselectCanvas(state),
        liveAnnouncement:result.announcement
      },
      intent,
      result
    };
  }

  const explanation=eventKind(event)==="explanation";
  const dragKind=explanation
    ?(keyEvent?.shiftKey?"free-resize":"free-move")
    :intent.type === "lane" ? "lane" : intent.type;
  const transaction = beginCanvasDrag(store.document,event.id,{
    kind:dragKind,
    currentMonth:nowMonth
  });
  const updated = updateCanvasDrag(transaction,{
    monthDelta:intent.monthDelta,
    laneDelta:intent.laneDelta,
    pixelDeltaX:explanation&&["ArrowLeft","ArrowRight"].includes(keyEvent?.key)
      ?(keyEvent.key==="ArrowLeft"?-16:16)
      :0,
    pixelDeltaY:explanation&&["ArrowUp","ArrowDown"].includes(keyEvent?.key)
      ?(keyEvent.key==="ArrowUp"?-16:16)
      :0
  });
  const result = commitCanvasDrag(store,updated,{onDropReflow});
  return {
    handled:true,
    state:{...state,liveAnnouncement:result.announcement},
    intent,
    result
  };
}

export function undoCanvas(store) {
  const entry = store?.undo?.() || null;
  return {
    entry,
    announcement:entry ? `Undid ${entry.label}` : "Nothing to undo"
  };
}

export function redoCanvas(store) {
  const entry = store?.redo?.() || null;
  return {
    entry,
    announcement:entry ? `Redid ${entry.label}` : "Nothing to redo"
  };
}

export function historyDefaultName(versionCount,{now = new Date()} = {}) {
  return `Version ${Number(versionCount || 0) + 1} · ${shortDate(now)}`;
}

export function automaticVersionName(type,{now = new Date()} = {}) {
  const definition = AUTOMATIC_VERSION_TYPES.find(({id}) => id === type);
  if (!definition) throw new TypeError(`Unknown automatic version type: ${String(type)}`);
  return `${definition.prefix} ${dateWithYear(now)}`;
}

export function classifyCanvasVersion(version) {
  const name = String(version?.name || "");
  const automatic = AUTOMATIC_VERSION_TYPES.find(({prefix}) => name.startsWith(prefix));
  const automaticKind = Boolean(automatic) || version?.kind === "automatic";
  return freeze({
    kind:automaticKind ? "automatic" : "manual",
    automaticType:automatic?.id || null
  });
}

export async function saveManualCanvasVersion(store,name,{now = new Date()} = {}) {
  const versions = await store.listVersions();
  const resolved = String(name || "").trim() || historyDefaultName(versions.length,{now});
  return store.saveVersion(resolved,"manual");
}

export async function createAutomaticCanvasVersion(store,type,{now = new Date()} = {}) {
  return store.saveVersion(automaticVersionName(type,{now}),"automatic");
}

export async function renameCanvasVersion(store,versionId,name) {
  const resolved = String(name || "").trim();
  if (!resolved) throw new TypeError("Version name is required.");
  return store.renameVersion(versionId,resolved);
}

export async function deleteCanvasVersion(store,versionId) {
  return store.deleteVersion(versionId);
}

export async function restoreCanvasVersion(
  store,
  versionId,
  {
    confirm = async () => true
  } = {}
) {
  const approved = await confirm({
    title:"Restore this version?",
    body:"Your current board is saved as a version first.",
    primaryLabel:"Restore",
    secondaryLabel:"Cancel"
  });
  if (!approved) return null;
  return store.restoreVersion(versionId);
}

function renderModeSwitch(state,disabled) {
  const mode = state?.mode === "advanced" ? "advanced" : "guided";
  return `<div class="canvas-mode-switch" role="group" aria-label="Timeline editing mode">
    <button type="button" data-canvas-action="guided" aria-pressed="${mode === "guided"}" ${disabled ? "disabled" : ""}>Guided</button>
    <button type="button" data-canvas-action="advanced" aria-pressed="${mode === "advanced"}" ${disabled ? "disabled" : ""}>Advanced Studio</button>
  </div>`;
}

function renderZoom(zoom) {
  const active = zoom?.mode === "fit" ? "fit" : String(zoom?.percent);
  return `<div class="canvas-zoom" role="group" aria-label="Timeline zoom">
    ${[
      ["fit","Fit"],
      ["100","100%"],
      ["150","150%"]
    ].map(([value,label]) => `<button type="button" data-canvas-zoom="${value}" aria-pressed="${active === value}">${label}</button>`).join("")}
    ${zoom?.snappingIndicator ? '<span class="zoom-snap-indicator" role="status">100%</span>' : ""}
  </div>`;
}

export function renderCanvasToolbar({
  state,
  historyStatus = {},
  commentsCount = 0
}) {
  const viewOnly = !isEditable(state);
  const disabled = viewOnly ? "disabled" : "";
  return `<div class="canvas-toolbar" data-canvas-toolbar data-height="48" style="height:48px" role="toolbar" aria-label="Timeline editing tools">
    <div data-toolbar-item="mode">${renderModeSwitch(state,viewOnly)}</div>
    <span data-toolbar-item="divider" class="toolbar-divider" aria-hidden="true"></span>
    <button type="button" data-toolbar-item="add-event" data-canvas-action="add-event" ${disabled}>+ Add event</button>
    <button type="button" data-toolbar-item="undo" data-canvas-action="undo" aria-label="Undo" ${viewOnly || !historyStatus.canUndo ? "disabled" : ""}><span aria-hidden="true">↶</span></button>
    <button type="button" data-toolbar-item="redo" data-canvas-action="redo" aria-label="Redo" ${viewOnly || !historyStatus.canRedo ? "disabled" : ""}><span aria-hidden="true">↷</span></button>
    <span data-toolbar-item="divider" class="toolbar-divider" aria-hidden="true"></span>
    <button type="button" data-toolbar-item="theme" data-canvas-action="theme" aria-haspopup="true" aria-expanded="${String(!!state.themeOpen)}">Theme ▾</button>
    <div data-toolbar-item="zoom">${renderZoom(state.zoom)}</div>
    <span data-toolbar-item="spacer" class="toolbar-spacer" aria-hidden="true"></span>
    <button type="button" data-toolbar-item="history" data-canvas-action="history"><span aria-hidden="true">◴</span> History</button>
    ${Number(commentsCount) > 0 ? `<button type="button" data-toolbar-item="comments" data-canvas-action="comments">Comments · ${Number(commentsCount)}</button>` : ""}
  </div>`;
}

export function renderAddEventPopover(state) {
  if (!state.addEventOpen || !isEditable(state)) return "";
  return `<div class="canvas-popover add-event-popover" role="menu" aria-label="Add event">
    ${CATEGORIES.map((category) => `<button type="button" role="menuitem" data-add-category="${category.id}">
      <span class="category-dot" style="--category-color:${category.color}" aria-hidden="true"></span>
      <span data-category-icon="${escapeHtml(category.icon)}" aria-hidden="true"></span>
      <span>${escapeHtml(category.label)}</span>
    </button>`).join("")}
  </div>`;
}

function renderControl(item,event,state) {
  if (item.id === "automatic-note") {
    return `<p data-context-control="${item.id}" class="context-note">${escapeHtml(item.label)}</p>`;
  }
  if (item.id === "category") {
    return `<button type="button" data-context-control="category" data-canvas-action="category" aria-label="Change category: ${escapeHtml(item.label)}">
      <span class="category-dot" style="--category-color:${escapeHtml(item.color)}" aria-hidden="true"></span>
    </button>`;
  }
  if (item.id === "title") {
    return `<button type="button" data-context-control="title" data-canvas-action="edit-title">${escapeHtml(item.label)}</button>`;
  }
  if (item.id === "visibility") {
    return `<button type="button" data-context-control="visibility" data-canvas-action="toggle-visibility" aria-label="${escapeHtml(item.label)}"><span aria-hidden="true">◉</span></button>`;
  }
  if (item.id === "details") {
    return '<button type="button" data-context-control="details" data-canvas-action="details">Details</button>';
  }
  if (item.id === "delete") {
    return '<button type="button" data-context-control="delete" data-canvas-action="delete" aria-label="Delete"><span aria-hidden="true">⌫</span></button>';
  }
  if (item.id === "show-score") {
    return `<button type="button" role="switch" data-context-control="show-score" data-canvas-action="show-score" aria-checked="${item.checked}">Show score</button>`;
  }
  if (item.id === "icon") {
    return `<button type="button" data-context-control="icon" data-canvas-action="icon" aria-label="Change icon">${escapeHtml(item.label)}</button>`;
  }
  const picker = item.id === "start" || item.id === "end";
  return `<button type="button" data-context-control="${item.id}" ${picker ? `data-canvas-action="${item.id}-date"` : ""}>${escapeHtml(item.label)}</button>`;
}

export function renderContextualToolbar(event,sceneEvent,state) {
  if (!event || !sceneEvent || !isEditable(state)) return "";
  const controls = contextControlsForEvent(event);
  const top = sceneEvent.kind === "flag"
    ? sceneEvent.plate?.y
    : sceneEvent.centerY - (sceneEvent.headHeight || sceneEvent.shaftHeight || 0) / 2;
  const placement = top < 64 ? "below" : "above";
  const focusable = state.toolbarFocus ? "0" : "-1";
  return `<div class="canvas-context-toolbar" data-context-toolbar data-placement="${placement}" data-offset="12" role="toolbar" aria-label="${escapeHtml(event.title || "Event")} controls" style="--canvas-x:${Number(sceneEvent.x ?? sceneEvent.anchorX ?? 0)};--canvas-y:${Number(top || 0)};max-width:520px" data-focus-trapped="${state.toolbarFocus}">
    ${controls.map((item) => renderControl(item,event,state)).join("")}
    ${state.categoryMenuOpen ? `<div class="category-swap-menu" role="menu" aria-label="Change category">
      ${CATEGORIES.map((category) => `<button type="button" role="menuitemradio" aria-checked="${category.id === event.categoryId}" data-swap-category="${category.id}">
        <span class="category-dot" style="--category-color:${category.color}" aria-hidden="true"></span>
        ${escapeHtml(category.label)}
      </button>`).join("")}
    </div>` : ""}
  </div>`.replaceAll("<button ","<button tabindex=\"" + focusable + "\" ");
}

function renderProtectedSelectionToolbar(event,advancedSelection,state){
  if(!isEditable(state))return"";
  const labels={
    axis:"Year axis",
    "color-key":"Color key",
    headline:"Timeline title",
    profile:"Profile card",
    portrait:"Portrait"
  };
  const label=labels[advancedSelection?.type];
  if(label){
    return`<div class="canvas-protected-context-toolbar" data-protected-context-toolbar role="toolbar" aria-label="${escapeHtml(label)} controls"><strong>${escapeHtml(label)}</strong><span>Selected · edit in the left panel</span></div>`;
  }
  if(event){
    return`<div class="canvas-protected-context-toolbar" data-protected-context-toolbar role="toolbar" aria-label="${escapeHtml(event.title||"Event")} controls"><strong>${escapeHtml(event.title||"Untitled event")}</strong><button type="button" data-canvas-action="details">Details</button><button type="button" data-canvas-action="duplicate">Duplicate</button><button type="button" data-canvas-action="delete" aria-label="Delete">⌫</button></div>`;
  }
  return"";
}

export function renderCanvasContextMenu(event,state) {
  if (!event || !state.contextMenu || state.contextMenu.eventId !== String(event.id)) return "";
  const items = contextMenuForEvent(event,{mode:"guided"});
  return `<div class="canvas-context-menu" role="menu" aria-label="${escapeHtml(event.title || "Event")} actions" style="--menu-x:${Number(state.contextMenu.x || 0)}px;--menu-y:${Number(state.contextMenu.y || 0)}px">
    ${items.map((item) => `<button type="button" role="menuitem" data-context-menu-action="${item.id}">${escapeHtml(item.label)}</button>`).join("")}
  </div>`;
}

function renderInlineEditor(state,sceneEvent) {
  if (!state.inlineEdit || !sceneEvent) return "";
  const x = Number(sceneEvent.label?.x ?? sceneEvent.plate?.x ?? sceneEvent.anchorX ?? 0);
  const y = Number(sceneEvent.label?.y ?? sceneEvent.plate?.y ?? 0);
  return `<form class="canvas-inline-label" data-inline-label-form style="--canvas-x:${x};--canvas-y:${y}">
    <label class="sr-only" for="canvas-inline-label-input">Event label</label>
    <input id="canvas-inline-label-input" data-inline-label-input value="${escapeHtml(state.inlineEdit.draft)}" autocomplete="off">
  </form>`;
}

function renderAdvancedTextEditor(document,state){
  const edit=state?.advancedTextEdit;
  if(!edit||state?.mode!=="advanced")return"";
  const block=(document?.advanced?.textBlocks||[]).find(
    (item)=>String(item.id)===String(edit.id)
  );
  if(!block)return"";
  const left=Math.max(0,Math.min(100,Number(block.x||0)/1920*100));
  const top=Math.max(0,Math.min(100,Number(block.y||0)/1080*100));
  return`<form class="canvas-advanced-text-editor" data-advanced-inline-text-form data-advanced-target-id="${escapeHtml(block.id)}" style="--advanced-text-left:${left}%;--advanced-text-top:${top}%">
    <label><span class="sr-only">Edit selected text</span><textarea data-advanced-inline-text-input rows="3">${escapeHtml(edit.draft)}</textarea></label>
    <div><button type="submit">Save text</button><button type="button" data-canvas-action="cancel-advanced-text">Cancel</button></div>
  </form>`;
}

function xmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g,(character) => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&apos;"
  })[character]);
}

function interactiveBoardSvg(svg,scene,state) {
  if (!isEditable(state)){
    return String(svg||"").replace(
      /; use Tab to move between events/g,
      ""
    );
  }
  let result = String(svg || "");
  for (const event of scene.events) {
    const needle = `data-event-id="${xmlEscape(event.id)}"`;
    const selected = String(state.selectedEventId) === String(event.id);
    const replacement = `${needle} data-canvas-event role="button" tabindex="${selected ? 0 : -1}" aria-selected="${selected}"`;
    result = result.replace(needle,replacement);
  }
  result=result.replaceAll(
    /data-study-action-chip="([^"]*)"/g,
    'data-study-action-chip="$1" role="button" tabindex="0" aria-label="Set retake date"'
  );
  return result;
}

function renderSelectionHandles(event,sceneEvent,state) {
  if (!event || !sceneEvent || !isEditable(state)) return "";
  if(sceneEvent.kind==="explanation"){
    return `<div class="guided-explanation-handles" data-selection-handles data-event-id="${escapeHtml(event.id)}" style="--explanation-x:${Number(sceneEvent.x)||0};--explanation-y:${Number(sceneEvent.y)||0};--explanation-width:${Number(sceneEvent.width)||300};--explanation-height:${Number(sceneEvent.height)||190}">
      <button type="button" data-drag-kind="free-resize" aria-label="Resize explanation"></button>
    </div>`;
  }
  if (sceneEvent.kind !== "arrow") return "";
  return `<div class="guided-arrow-handles" data-selection-handles data-event-id="${escapeHtml(event.id)}" style="--start-x:${sceneEvent.x};--end-x:${sceneEvent.x2};--center-y:${sceneEvent.centerY}">
    <button type="button" data-drag-kind="resize-start" aria-label="Adjust start month"></button>
    <button type="button" data-drag-kind="resize-end" aria-label="Adjust end month"></button>
  </div>`;
}

function emptyBoardMarkup(state) {
  const editable=isEditable(state);
  return `<div class="canvas-empty-board" role="${editable?"application":"region"}" aria-label="${editable
    ?"Timeline visualization, 0 events; use Tab to move between events"
    :"Timeline visualization, 0 events. Editing is unavailable."
  }">
    <div class="canvas-axis-placeholder" aria-hidden="true"></div>
    <div class="canvas-empty-message">
      <p>No events yet — add one below or use the Builder.</p>
      <button type="button" data-canvas-action="open-builder">Open Builder</button>
    </div>
  </div>`;
}

function renderDetailsSheet(event,renderer) {
  if (!event) return "";
  const route = detailsRouteForEvent(event);
  const content = typeof renderer === "function"
    ? renderer(route,event)
    : `<div data-wizard-entry-route="${escapeHtml(route.entryId)}" data-same-fields-as-wizard="true"></div>`;
  return `<div class="canvas-sheet-scrim" data-canvas-action="close-details">
    <section class="canvas-details-sheet" role="dialog" aria-modal="true" aria-labelledby="canvas-details-title" style="width:560px" data-details-sheet data-event-id="${escapeHtml(event.id)}" data-builder-step="${route.step}" data-fields-source="${route.fieldsSource}">
      <button type="button" data-canvas-action="close-details" aria-label="Close">×</button>
      <h2 id="canvas-details-title">Details</h2>
      <div class="canvas-details-fields" data-wizard-entry-route="${escapeHtml(route.entryId)}" data-same-fields-as-wizard="true">${content}</div>
    </section>
  </div>`;
}

export function renderHistorySlideOver({
  state,
  versions = [],
  now = new Date()
}) {
  if (!state.historyOpen) return "";
  const viewOnly=!isEditable(state);
  const sorted = [...versions].sort((left,right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  const defaultName = state.historyName || historyDefaultName(sorted.length,{now});
  return `<div class="history-scrim" data-canvas-action="close-history">
    <section class="history-slide-over" role="dialog" aria-modal="true" aria-labelledby="history-title" data-width="360" style="width:360px">
      <button type="button" data-canvas-action="close-history" aria-label="Close">×</button>
      <h2 id="history-title">History</h2>
      ${viewOnly
        ?'<p class="history-view-only" role="status">Saved versions are available for review. Editing and restore actions require Timeline access.</p>'
        :state.historyNaming ? `<form data-history-name-form>
        <label for="history-version-name">Version name</label>
        <input id="history-version-name" name="versionName" value="${escapeHtml(defaultName)}">
        <button type="submit">Save</button>
        <button type="button" data-canvas-action="cancel-version-name">Cancel</button>
      </form>` : '<button type="button" data-canvas-action="save-version">Save current as version</button>'}
      <div class="history-version-list">
        ${sorted.length ? sorted.map((version) => {
          const classification = classifyCanvasVersion(version);
          return `<article class="history-version-row" data-version-id="${escapeHtml(version.id)}" data-version-kind="${classification.kind}" data-automatic-type="${classification.automaticType || ""}">
            <div>
              <strong>${escapeHtml(version.name)}</strong>
              <span>${escapeHtml(shortDate(version.createdAt))} · ${Number(version.eventCount || 0)} events</span>
            </div>
            <button type="button" data-history-restore="${escapeHtml(version.id)}" ${viewOnly?"disabled":""}>Restore</button>
            <button type="button" data-history-menu="${escapeHtml(version.id)}" aria-label="More actions" aria-expanded="${state.versionMenuId === version.id}" ${viewOnly?"disabled":""}>⋯</button>
            ${!viewOnly&&state.versionMenuId === version.id ? `<div role="menu">
              <button type="button" role="menuitem" data-history-rename="${escapeHtml(version.id)}">Rename</button>
              <button type="button" role="menuitem" data-history-delete="${escapeHtml(version.id)}">Delete</button>
            </div>` : ""}
          </article>`;
        }).join("") : '<p class="history-empty">No saved versions yet.</p>'}
      </div>
    </section>
  </div>`;
}

export function renderCanvas({
  document,
  state = createCanvasState(),
  historyStatus = {},
  versions = [],
  commentsCount = document?.advisor?.comments?.filter((comment) => !comment.resolvedAt).length || 0,
  currentMonth:nowMonth = currentMonth(),
  now = new Date(),
  renderBoard = renderKeynoteClassicBoard,
  renderTheme = null,
  renderAdvanced = null,
  renderCommentLayer = null,
  renderDetails = null
}) {
  const viewState = {...state,mode:document?.mode === "advanced" ? "advanced" : "guided"};
  const selected = eventById(document,viewState.selectedEventId);
  let board = emptyBoardMarkup(viewState);
  let scene = null;
  let selectedSceneEvent = null;
  let usingProtectedPresentation=false;

  if ((document?.events || []).length) {
    const rendered = renderBoard(document,{
      currentMonth:parseMonth(nowMonth) || currentMonth(),
      audience:"EVERYTHING",
      previousLaneById:Object.fromEntries(
        (document.events || [])
          .filter((event) => Number.isInteger(event.lane))
          .map((event) => [event.id,event.lane])
      )
    });
    scene = rendered.scene;
    selectedSceneEvent = (scene?.events||[]).find((event) => String(event.id) === String(viewState.selectedEventId)) || null;
    const zoomStyle=viewState.zoom?.mode==="percent"
      ?`width:${1920*Number(viewState.zoom.percent||100)/100}px;max-width:none`
      :"";
    const editable=isEditable(viewState);
    const canvasLabel=editable
      ?scene.accessibility.ariaLabel
      :String(scene.accessibility.ariaLabel||"").replace(
        /; use Tab to move between events/g,
        ""
      );
    const protectedPresentation=String(rendered.kind||"").startsWith("d1-411a-");
    usingProtectedPresentation=protectedPresentation;
    const presentation=protectedPresentation
      ?rendered.html
      :interactiveBoardSvg(rendered.svg,scene,viewState);
    board = `<div class="canvas-application" role="${editable?"application":"region"}" aria-label="${escapeHtml(canvasLabel)}" data-logical-width="1920" data-logical-height="1080" data-zoom-mode="${escapeHtml(viewState.zoom?.mode||"fit")}" data-zoom-percent="${Number(viewState.zoom?.percent||0)}" data-presentation-kernel="${protectedPresentation?"D1-409H-A1":"legacy"}" style="${zoomStyle}">
      ${presentation}
      ${renderSelectionHandles(selected,selectedSceneEvent,viewState)}
      ${renderInlineEditor(viewState,selectedSceneEvent)}
      ${renderAdvancedTextEditor(document,viewState)}
      ${viewState.drag?.active ? `<output class="canvas-date-tooltip" role="status">${escapeHtml(viewState.drag.liveTooltip)}</output>` : ""}
    </div>`;
  }

  const themeMarkup = typeof renderTheme === "function"
    ? String(renderTheme(document) || "").replace(
      /(<div class="theme-picker-popover"[^>]*?)\s+hidden>/,
      "$1>"
    )
    : "";
  const advancedMarkup = typeof renderAdvanced === "function"
    ? String(renderAdvanced(document,{
      backgroundOpen:!!viewState.backgroundOpen,
      activeTab:viewState.backgroundTab,
      activePanel:viewState.advancedPanel,
      query:viewState.advancedAssetQuery,
      selection:viewState.advancedSelection
    }) || "")
    : "";
  const commentMarkup = typeof renderCommentLayer === "function"
    ? String(renderCommentLayer(document,viewState) || "")
    : "";

  return `<div class="screen canvas-screen" data-screen="canvas" data-mode="${viewState.mode}" data-view-only="${!isEditable(viewState)}">
    <h1 class="sr-only">Edit Timeline</h1>
    ${viewState.responsive.banner ? `<div class="canvas-responsive-banner" role="status">${escapeHtml(viewState.responsive.banner)}</div>` : ""}
    ${renderCanvasToolbar({state:viewState,historyStatus,commentsCount})}
    ${viewState.themeOpen ? themeMarkup : ""}
    ${advancedMarkup}
    ${renderAddEventPopover(viewState)}
    <div class="canvas-stage" data-letterbox="#EFEDE8">
      ${board}
      ${commentMarkup}
      ${renderContextualToolbar(selected,selectedSceneEvent,viewState)}
      ${usingProtectedPresentation?renderProtectedSelectionToolbar(selected,viewState.advancedSelection,viewState):""}
      ${renderCanvasContextMenu(selected,viewState)}
    </div>
    <div class="sr-only" aria-live="polite" aria-atomic="true" data-canvas-live>${escapeHtml(viewState.liveAnnouncement)}</div>
    ${renderDetailsSheet(eventById(document,viewState.detailsEventId),renderDetails)}
    ${renderHistorySlideOver({state:viewState,versions,now})}
  </div>`;
}

function trapToolbarTab(event,root) {
  const toolbar = root.querySelector?.("[data-context-toolbar]");
  if (!toolbar || !toolbar.contains(event.target) || event.key !== "Tab") return false;
  const items = [...toolbar.querySelectorAll("button:not([disabled]),input:not([disabled])")];
  if (!items.length) return false;
  const first = items[0];
  const last = items.at(-1);
  if (event.shiftKey && event.target === first) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && event.target === last) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

function trapCanvasDialogTab(event,root){
  if(event.key!=="Tab")return false;
  const container=event.target.closest?.(".canvas-details-sheet,.history-slide-over");
  if(!container)return false;
  const items=[...container.querySelectorAll("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]")]
    .filter((item)=>!item.hidden&&item.getAttribute?.("aria-hidden")!=="true");
  if(!items.length){event.preventDefault();return true;}
  const first=items[0],last=items.at(-1);
  if(event.shiftKey&&event.target===first){event.preventDefault();last.focus();return true;}
  if(!event.shiftKey&&event.target===last){event.preventDefault();first.focus();return true;}
  return false;
}

export function installCanvas(
  root,
  store,
  {
    state:initialState = createCanvasState({
      viewportWidth:globalThis.innerWidth || 1440
    }),
    currentMonth:nowMonth = () => currentMonth(),
    now = () => new Date(),
    renderBoard = renderKeynoteClassicBoard,
    renderTheme = null,
    renderAdvanced = null,
    renderCommentLayer = null,
    renderDetails = null,
    onStateChange = () => {},
    onTheme = () => {},
    onSelectTheme = () => {},
    onBackgrounds = () => {},
    onAdvanced = () => {},
    onGuided = () => {},
    onComments = () => {},
    onAdvisorPin = () => {},
    onResolveAdvisorComment = () => {},
    onOpenBuilder = () => store.navigate?.("builder"),
    onDetails = () => {},
    onDateControl = () => {},
    onCategoryControl = () => {},
    onPersonalIcon = () => {},
    onDropReflow = () => {},
    onToast = () => {},
    confirmRestore = async (copy) => globalThis.confirm
      ? globalThis.confirm(`${copy.title}\n\n${copy.body}`)
      : false,
    promptRename = async (version) => globalThis.prompt
      ? globalThis.prompt("Rename version",version.name)
      : null,
    confirmDeleteVersion = async (version) => globalThis.confirm
      ? globalThis.confirm(`Delete ${version.name}?`)
      : false,
    pixelsPerMonth = 24,
    lanePitch = 44,
    touchSlop = 8
  } = {}
) {
  if (!root?.addEventListener) throw new TypeError("installCanvas requires a DOM root.");
  let state = initialState;
  let versions = [];
  let destroyed = false;
  let pointer = null;
  let effectiveHitFrame=0;

  const copyElementAttributes=(target,source)=>{
    if(!target?.attributes||!source?.attributes)return;
    for(const attribute of [...target.attributes]){
      if(!source.hasAttribute(attribute.name))target.removeAttribute(attribute.name);
    }
    for(const attribute of [...source.attributes]){
      target.setAttribute(attribute.name,attribute.value);
    }
  };

  const patchPersistentCanvas=(markup)=>{
    if(
      !globalThis.document?.createElement||
      !root.querySelector||
      !root.replaceChildren
    )return false;
    const currentScreen=root.querySelector(":scope > .canvas-screen");
    if(!currentScreen)return false;
    const template=globalThis.document.createElement("template");
    template.innerHTML=markup;
    const nextScreen=template.content.firstElementChild;
    if(!nextScreen?.matches?.(".canvas-screen"))return false;
    if(currentScreen.dataset.mode!==nextScreen.dataset.mode)return false;
    const currentStage=currentScreen.querySelector(":scope > .canvas-stage");
    const nextStage=nextScreen.querySelector(":scope > .canvas-stage");
    const currentApplication=currentStage?.querySelector(":scope > .canvas-application");
    const nextApplication=nextStage?.querySelector(":scope > .canvas-application");
    const currentKernel=currentApplication?.querySelector(":scope > d1-timeline-kernel");
    const nextKernel=nextApplication?.querySelector(":scope > d1-timeline-kernel");
    if(
      !currentStage||!nextStage||!currentApplication||!nextApplication||
      !currentKernel||!nextKernel||
      currentKernel.dataset.kernelToken!==nextKernel.dataset.kernelToken
    )return false;

    copyElementAttributes(currentScreen,nextScreen);
    copyElementAttributes(currentStage,nextStage);
    copyElementAttributes(currentApplication,nextApplication);

    for(const child of [...currentApplication.children]){
      if(child!==currentKernel)child.remove();
    }
    for(const child of [...nextApplication.children]){
      if(child!==nextKernel)currentApplication.append(child);
    }

    for(const child of [...currentStage.children]){
      if(child!==currentApplication)child.remove();
    }
    for(const child of [...nextStage.children]){
      if(child!==nextApplication)currentStage.append(child);
    }

    const nextStageIndex=[...nextScreen.children].indexOf(nextStage);
    for(const child of [...currentScreen.children]){
      if(child!==currentStage)child.remove();
    }
    [...nextScreen.children].forEach((child,index)=>{
      if(child===nextStage)return;
      if(index<nextStageIndex)currentScreen.insertBefore(child,currentStage);
      else currentScreen.append(child);
    });
    Promise.resolve(currentKernel.updateProjection?.()).catch((error)=>{
      currentKernel.dataset.error=String(error?.code||error?.message||error);
      currentKernel.dataset.errorMessage=String(error?.message||error);
      currentKernel.dispatchEvent?.(new CustomEvent("d1-411a:error",{
        bubbles:true,
        composed:true,
        detail:{surface:currentKernel.dataset.surface,error}
      }));
      console.error(
        "Persistent Timeline canvas update failed",
        currentKernel.dataset.lastFailureContext||"",
        error
      );
    });
    return true;
  };

  const installEffectiveHitTargets=()=>{
    const priorProxies=[...(root.querySelectorAll?.(
      "[data-canvas-effective-hit-proxy]"
    )||[])];
    const priorSources=[...(root.querySelectorAll?.(
      "[data-canvas-effective-hit-source]"
    )||[])];
    const rootBounds=root.getBoundingClientRect?.();
    const stablePairs=priorProxies.map((proxy)=>({
      proxy,
      source:priorSources.find(
        (candidate)=>candidate.dataset.canvasEffectiveHitToken===
          proxy.dataset.canvasEffectiveHitToken
      )||null
    }));
    const canRefreshInPlace=
      Boolean(rootBounds?.width&&rootBounds?.height)&&
      stablePairs.length>0&&
      stablePairs.length===priorSources.length&&
      stablePairs.every(({source})=>{
        const bounds=source?.getBoundingClientRect?.();
        return Boolean(
          bounds?.width&&
          bounds?.height&&
          (bounds.width<44||bounds.height<44)
        );
      });
    if(canRefreshInPlace){
      for(const {proxy,source} of stablePairs){
        const targetBounds=source.getBoundingClientRect();
        const width=Math.max(44,targetBounds.width);
        const height=Math.max(44,targetBounds.height);
        proxy.style.left=`${targetBounds.left-rootBounds.left-(width-targetBounds.width)/2}px`;
        proxy.style.top=`${targetBounds.top-rootBounds.top-(height-targetBounds.height)/2}px`;
        proxy.style.width=`${width}px`;
        proxy.style.height=`${height}px`;
        proxy.style.setProperty("--effective-source-width",`${targetBounds.width}px`);
        proxy.style.setProperty("--effective-source-height",`${targetBounds.height}px`);
      }
      return;
    }
    for(const proxy of priorProxies){
      const token=proxy.dataset.canvasEffectiveHitToken;
      const source=priorSources.find(
        (candidate)=>candidate.dataset.canvasEffectiveHitToken===token
      );
      if(source){
        source.setAttribute("role","button");
        source.setAttribute("tabindex",proxy.getAttribute("tabindex")||"0");
        source.setAttribute("aria-label",proxy.getAttribute("aria-label")||"Edit timeline item");
        source.removeAttribute("data-canvas-effective-hit-source");
        source.removeAttribute("data-canvas-effective-hit-token");
      }
      proxy.remove();
    }
    if(!rootBounds?.width||!rootBounds?.height)return;
    const targets=root.querySelectorAll?.(
      "[data-canvas-event],[data-advanced-media],[data-advanced-text]"
    )||[];
    let proxySequence=0;
    for(const target of targets){
      if(
        target.hasAttribute("data-canvas-effective-hit-proxy")||
        target.hasAttribute("data-canvas-effective-hit-source")
      )continue;
      const targetBounds=target.getBoundingClientRect?.();
      if(!targetBounds?.width||!targetBounds?.height)continue;
      if(targetBounds.width>=44&&targetBounds.height>=44)continue;
      const width=Math.max(44,targetBounds.width);
      const height=Math.max(44,targetBounds.height);
      const proxy=globalThis.document.createElement("button");
      proxy.type="button";
      proxy.className="canvasEffectiveHitProxy";
      proxy.setAttribute("data-canvas-effective-hit-proxy","true");
      const proxyToken=`canvas-hit-${proxySequence++}`;
      proxy.setAttribute("data-canvas-effective-hit-token",proxyToken);
      proxy.innerHTML='<span data-hit-edge="top"></span><span data-hit-edge="right"></span><span data-hit-edge="bottom"></span><span data-hit-edge="left"></span>';
      for(const attribute of [
        "data-canvas-event",
        "data-event-id",
        "data-advanced-media",
        "data-advanced-text",
        "data-media-kind",
        "aria-selected"
      ]){
        if(target.hasAttribute(attribute)){
          proxy.setAttribute(attribute,target.getAttribute(attribute)||"");
        }
      }
      proxy.setAttribute(
        "aria-label",
        target.getAttribute("aria-label")||
          target.textContent?.trim()?.replace(/\s+/g," ")||
          "Edit timeline item"
      );
      proxy.setAttribute("tabindex",target.getAttribute("tabindex")||"0");
      proxy.style.left=`${targetBounds.left-rootBounds.left-(width-targetBounds.width)/2}px`;
      proxy.style.top=`${targetBounds.top-rootBounds.top-(height-targetBounds.height)/2}px`;
      proxy.style.width=`${width}px`;
      proxy.style.height=`${height}px`;
      proxy.style.setProperty("--effective-source-width",`${targetBounds.width}px`);
      proxy.style.setProperty("--effective-source-height",`${targetBounds.height}px`);
      root.append(proxy);
      target.setAttribute("data-canvas-effective-hit-source","true");
      target.setAttribute("data-canvas-effective-hit-token",proxyToken);
      target.removeAttribute("role");
      target.removeAttribute("tabindex");
      target.removeAttribute("aria-label");
    }
  };

  const queueEffectiveHitTargets=()=>{
    globalThis.cancelAnimationFrame?.(effectiveHitFrame);
    effectiveHitFrame=globalThis.requestAnimationFrame?.(
      installEffectiveHitTargets
    )||0;
  };

  const render = ({animateLayout=false}={}) => {
    if (destroyed) return "";
    const markup=renderCanvas({
      document:store.document,
      state,
      historyStatus:store.historyStatus?.() || {},
      versions,
      currentMonth:nowMonth(),
      now:now(),
      renderBoard,
      renderTheme,
      renderAdvanced,
      renderCommentLayer,
      renderDetails
    });
    const commit=()=>{
      if(!patchPersistentCanvas(markup))root.innerHTML=markup;
    };
    if(animateLayout&&typeof globalThis.document?.startViewTransition==="function"){
      globalThis.document.startViewTransition(commit);
    }else{
      commit();
      if(animateLayout&&root.classList){
        root.classList.add("layout-settling");
        globalThis.setTimeout?.(()=>root.classList?.remove("layout-settling"),240);
      }
    }
    queueEffectiveHitTargets();
    onStateChange(state);
    return root.innerHTML;
  };

  const setState = (next,{focus = null,animateLayout=false} = {}) => {
    if(!isEditable(next)&&pointer){
      pointer=null;
      next={...next,drag:null};
    }
    state = next;
    render({animateLayout});
    queueMicrotask(() => {
      if (focus === "selected") {
        root.querySelector?.(`[data-canvas-effective-hit-proxy][data-canvas-event][data-event-id="${globalThis.CSS?.escape ? CSS.escape(state.selectedEventId) : state.selectedEventId}"], [data-canvas-event][data-event-id="${globalThis.CSS?.escape ? CSS.escape(state.selectedEventId) : state.selectedEventId}"]`)?.focus();
      } else if (focus === "toolbar") {
        root.querySelector?.("[data-context-toolbar] button")?.focus();
      } else if (focus === "inline") {
        root.querySelector?.("[data-inline-label-input]")?.focus();
      } else if (focus === "advanced-text") {
        const input=root.querySelector?.("[data-advanced-inline-text-input]");
        input?.focus();
        input?.select?.();
      } else if (focus === "history") {
        root.querySelector?.(".history-slide-over button")?.focus();
      } else if (focus === "details") {
        root.querySelector?.(".canvas-details-sheet button")?.focus();
      } else if (focus === "theme-picker") {
        root.querySelector?.("[data-theme-picker] [data-select-theme], [data-theme-picker] [data-open-backgrounds]")?.focus();
      } else if (focus === "theme-trigger") {
        root.querySelector?.('[data-canvas-action="theme"]')?.focus();
      } else if (focus === "history-trigger") {
        root.querySelector?.('[data-canvas-action="history"]')?.focus();
      }
    });
  };

  const refreshVersions = async () => {
    versions = typeof store.listVersions === "function" ? await store.listVersions() : [];
    if (!destroyed && state.historyOpen) render();
    return versions;
  };

  const announceResult = (message) => {
    const normalized=String(message||"");
    setState({...state,liveAnnouncement:normalized});
    const live=root.querySelector?.("[data-canvas-live]");
    if(!live)return;
    live.textContent="";
    queueMicrotask(()=>{
      if(!destroyed&&live.isConnected)live.textContent=normalized;
    });
  };

  const onClick = async (event) => {
    const actionTarget = event.target.closest?.("[data-canvas-action]");
    const action = actionTarget?.dataset?.canvasAction;
    const eventTarget = event.target.closest?.("[data-canvas-event]");
    const categoryTarget = event.target.closest?.("[data-add-category]");
    const categorySwapTarget = event.target.closest?.("[data-swap-category]");
    const menuTarget = event.target.closest?.("[data-context-menu-action]");
    const zoomTarget = event.target.closest?.("[data-canvas-zoom]");
    const restoreTarget = event.target.closest?.("[data-history-restore]");
    const historyMenuTarget = event.target.closest?.("[data-history-menu]");
    const renameTarget = event.target.closest?.("[data-history-rename]");
    const deleteVersionTarget = event.target.closest?.("[data-history-delete]");
    const selectThemeTarget = event.target.closest?.("[data-select-theme]");
    const openBackgroundsTarget = event.target.closest?.("[data-open-backgrounds]");
    const advisorPinTarget = event.target.closest?.("[data-advisor-pin]");
    const resolveAdvisorTarget = event.target.closest?.("[data-resolve-advisor-comment]");
    const studyActionTarget = event.target.closest?.("[data-study-action-chip]");
    if(
      !isEditable(state)&&(
        studyActionTarget||
        resolveAdvisorTarget||
        selectThemeTarget||
        categorySwapTarget||
        categoryTarget||
        restoreTarget||
        historyMenuTarget||
        renameTarget||
        deleteVersionTarget||
        menuTarget
      )
    )return;

    if (studyActionTarget) {
      const group=studyActionTarget.closest?.("[data-event-id]");
      const selected=eventById(store.document,group?.dataset?.eventId);
      if(selected){
        setState(selectCanvasEvent(state,selected.id));
        onDateControl({
          edge:"end",
          event:selected,
          targetAttemptId:studyActionTarget.dataset.studyActionChip||null,
          label:"Set retake date"
        });
      }
      return;
    }
    if (resolveAdvisorTarget) {
      onResolveAdvisorComment(resolveAdvisorTarget.dataset.resolveAdvisorComment);
      return;
    }
    if (advisorPinTarget) {
      const id=advisorPinTarget.dataset.advisorPin;
      setState({...state,activeAdvisorPinId:state.activeAdvisorPinId===id?null:id});
      onAdvisorPin(id);
      return;
    }
    if (selectThemeTarget) {
      onSelectTheme(selectThemeTarget.dataset.selectTheme);
      setState({...state,themeOpen:false},{focus:"theme-trigger"});
      return;
    }
    if (openBackgroundsTarget) {
      setState({...state,themeOpen:false,backgroundOpen:true,backgroundTab:"Presets"});
      onBackgrounds({state,document:store.document});
      return;
    }

    if (categorySwapTarget) {
      assertEditable(state);
      const result = swapCanvasEventCategory(
        store,
        state.selectedEventId,
        categorySwapTarget.dataset.swapCategory
      );
      setState({...state,categoryMenuOpen:false,liveAnnouncement:result.announcement});
      return;
    }
    if (categoryTarget) {
      assertEditable(state);
      const result = addCanvasEvent(store,categoryTarget.dataset.addCategory,{
        fallbackMonth:nowMonth()
      });
      setState({
        ...state,
        addEventOpen:false,
        selectedEventId:result.event.id,
        detailsEventId:result.event.id,
        liveAnnouncement:result.announcement
      });
      onDetails(result.detailsRoute,result.event);
      return;
    }
    if (zoomTarget) {
      setState({...state,zoom:updateCanvasZoom(state.zoom,{kind:"preset",value:zoomTarget.dataset.canvasZoom})});
      return;
    }
    if (restoreTarget) {
      const restored = await restoreCanvasVersion(store,restoreTarget.dataset.historyRestore,{confirm:confirmRestore});
      if (restored) {
        await refreshVersions();
        setState({...state,historyOpen:false,liveAnnouncement:`Restored ${restored.name}`});
      }
      return;
    }
    if (historyMenuTarget) {
      const id = historyMenuTarget.dataset.historyMenu;
      setState({...state,versionMenuId:state.versionMenuId === id ? null : id});
      return;
    }
    if (renameTarget) {
      const version = versions.find(({id}) => id === renameTarget.dataset.historyRename);
      const name = version ? await promptRename(version) : null;
      if (name) {
        await renameCanvasVersion(store,version.id,name);
        await refreshVersions();
      }
      return;
    }
    if (deleteVersionTarget) {
      const version = versions.find(({id}) => id === deleteVersionTarget.dataset.historyDelete);
      if (version && await confirmDeleteVersion(version)) {
        await deleteCanvasVersion(store,version.id);
        await refreshVersions();
      }
      return;
    }
    if (menuTarget) {
      const selected = assertEvent(store.document,state.selectedEventId);
      const menuAction = menuTarget.dataset.contextMenuAction;
      if (menuAction === "edit-details") {
        const route = detailsRouteForEvent(selected);
        setState({...state,detailsEventId:selected.id,contextMenu:null},{focus:"details"});
        onDetails(route,selected);
      } else if (menuAction === "duplicate") {
        const result = duplicateCanvasEvent(store,selected.id);
        setState({...state,selectedEventId:result.event.id,contextMenu:null,liveAnnouncement:result.announcement});
      } else if (menuAction === "toggle-visibility") {
        const result = toggleCanvasEventVisibility(store,selected.id);
        setState({...state,contextMenu:null,liveAnnouncement:result.announcement});
      } else if (menuAction === "delete") {
        const result = deleteCanvasEvent(store,selected.id);
        onToast(result.announcement,{actionLabel:"Undo",onAction:() => store.undo?.()});
        setState({...deselectCanvas(state),liveAnnouncement:result.announcement});
      }
      return;
    }
    if (eventTarget && !action) {
      if (!isEditable(state)) return;
      setState(selectCanvasEvent(state,eventTarget.dataset.eventId),{focus:"selected"});
      return;
    }
    if (!action) {
      if (
        isEditable(state) &&
        event.target.closest?.(".canvas-stage") &&
        !event.target.closest?.("[data-context-toolbar],.canvas-context-menu")
      ) {
        setState(deselectCanvas(state));
      }
      return;
    }
    if (EDITING_ACTIONS.has(action)) assertEditable(state);

    if (action === "add-event") {
      setState({...state,addEventOpen:!state.addEventOpen,contextMenu:null});
    } else if (action === "undo") {
      announceResult(undoCanvas(store).announcement);
    } else if (action === "redo") {
      announceResult(redoCanvas(store).announcement);
    } else if (action === "duplicate"&&state.selectedEventId) {
      const result=duplicateCanvasEvent(store,state.selectedEventId);
      setState({...state,selectedEventId:result.event.id,liveAnnouncement:result.announcement});
    } else if (action === "theme") {
      const opening=!state.themeOpen;
      setState(
        {...state,themeOpen:opening},
        {focus:opening&&isEditable(state)?"theme-picker":"theme-trigger"}
      );
      onTheme({state,document:store.document});
    } else if (action === "history") {
      setState({...state,historyOpen:true,historyNaming:false,versionMenuId:null},{focus:"history"});
      await refreshVersions();
      queueMicrotask(()=>root.querySelector?.(".history-slide-over button")?.focus());
    } else if (action === "close-history") {
      if (event.target === actionTarget || actionTarget.matches?.("button")) {
        setState(
          {...state,historyOpen:false,historyNaming:false,versionMenuId:null},
          {focus:"history-trigger"}
        );
      }
    } else if (action === "save-version") {
      setState({
        ...state,
        historyNaming:true,
        historyName:historyDefaultName(versions.length,{now:now()})
      });
    } else if (action === "cancel-version-name") {
      setState({...state,historyNaming:false,historyName:""});
    } else if (action === "comments") {
      setState({...state,commentsOpen:!state.commentsOpen,activeAdvisorPinId:null});
      onComments({state,document:store.document});
    } else if (action === "advanced") {
      onAdvanced({state,document:store.document});
    } else if (action === "guided") {
      if (store.document?.mode === "advanced") onGuided({state,document:store.document});
      else announceResult("Guided Mode selected");
    } else if (action === "cancel-advanced-text") {
      setState({...state,advancedTextEdit:null,liveAnnouncement:"Text edit canceled"});
    } else if (action === "open-builder") {
      onOpenBuilder();
    } else if (action === "details") {
      const selected = assertEvent(store.document,state.selectedEventId);
      const route = detailsRouteForEvent(selected);
      setState({...state,detailsEventId:selected.id,toolbarFocus:false},{focus:"details"});
      onDetails(route,selected);
    } else if (action === "close-details") {
      if (event.target === actionTarget || actionTarget.matches?.("button")) {
        setState({...state,detailsEventId:null},{focus:"selected"});
      }
    } else if (action === "edit-title") {
      const selected = assertEvent(store.document,state.selectedEventId);
      setState(beginInlineLabelEdit(state,selected),{focus:"inline"});
    } else if (action === "toggle-visibility") {
      const result = toggleCanvasEventVisibility(store,state.selectedEventId);
      announceResult(result.announcement);
    } else if (action === "delete") {
      const result = deleteCanvasEvent(store,state.selectedEventId);
      onToast(result.announcement,{actionLabel:"Undo",onAction:() => store.undo?.()});
      setState({...deselectCanvas(state),liveAnnouncement:result.announcement});
    } else if (action === "show-score") {
      announceResult(toggleCanvasScore(store,state.selectedEventId).announcement);
    } else if (action === "icon") {
      onPersonalIcon(assertEvent(store.document,state.selectedEventId));
    } else if (action === "category") {
      const selected = assertEvent(store.document,state.selectedEventId);
      setState({...state,categoryMenuOpen:!state.categoryMenuOpen});
      onCategoryControl(selected);
    } else if (action === "start-date" || action === "end-date") {
      onDateControl({
        edge:action === "start-date" ? "start" : "end",
        event:assertEvent(store.document,state.selectedEventId)
      });
    }
  };

  const onDoubleClick = (event) => {
    const target = event.target.closest?.("[data-canvas-event]");
    if (!target || !isEditable(state)) return;
    event.preventDefault();
    const selected = assertEvent(store.document,target.dataset.eventId);
    setState(beginInlineLabelEdit(state,selected),{focus:"inline"});
  };

  const onContextMenu = (event) => {
    const target = event.target.closest?.("[data-canvas-event]");
    if (!target || !isEditable(state)) return;
    event.preventDefault();
    const selectedState = selectCanvasEvent(state,target.dataset.eventId);
    setState({
      ...selectedState,
      contextMenu:{
        eventId:target.dataset.eventId,
        x:Number(event.clientX || 0),
        y:Number(event.clientY || 0)
      }
    });
  };

  const onInput = (event) => {
    if(!isEditable(state))return;
    if (event.target.matches?.("[data-inline-label-input]")) {
      state = updateInlineLabelDraft(state,event.target.value);
      onStateChange(state);
    } else if(event.target.matches?.("[data-advanced-inline-text-input]")){
      state={
        ...state,
        advancedTextEdit:{
          ...state.advancedTextEdit,
          draft:String(event.target.value??"")
        }
      };
      onStateChange(state);
    } else if (event.target.name === "versionName") {
      state = {...state,historyName:event.target.value};
      onStateChange(state);
    }
  };

  const onSubmit = async (event) => {
    if(!isEditable(state)){
      event.preventDefault();
      return;
    }
    if (event.target.matches?.("[data-inline-label-form]")) {
      event.preventDefault();
      const result = commitInlineLabelEdit(store,state);
      setState(result.state,{focus:"selected"});
    } else if(event.target.matches?.("[data-advanced-inline-text-form]")){
      event.preventDefault();
      const edit=state.advancedTextEdit;
      if(!edit)return;
      const changed=store.mutate("Edit Advanced text",(document)=>{
        const block=(document.advanced?.textBlocks||[]).find(
          (item)=>String(item.id)===String(edit.id)
        );
        if(block)block.text=String(edit.draft??"");
      });
      setState({
        ...state,
        advancedTextEdit:null,
        liveAnnouncement:changed?"Text updated":"Text unchanged"
      });
    } else if (event.target.matches?.("[data-history-name-form]")) {
      event.preventDefault();
      const version = await saveManualCanvasVersion(store,state.historyName,{now:now()});
      await refreshVersions();
      setState({
        ...state,
        historyNaming:false,
        historyName:"",
        liveAnnouncement:`Saved ${version.name}`
      });
    }
  };

  const onFocusIn = (event) => {
    if(!isEditable(state))return;
    const target=event.target.closest?.("[data-canvas-event]");
    const eventId=String(target?.dataset?.eventId||"");
    if(!eventId||eventId===String(state.selectedEventId||""))return;
    if(!eventById(store.document,eventId))return;
    state=selectCanvasEvent(state,eventId);
    root.querySelectorAll?.("[data-canvas-event]").forEach((candidate)=>
      candidate.setAttribute(
        "aria-selected",
        String(String(candidate.dataset?.eventId||"")===eventId)
      )
    );
  };

  const onKeyDown = (event) => {
    if (state.toolbarFocus && trapToolbarTab(event,root)) return;
    if(trapCanvasDialogTab(event,root))return;
    if (event.key === "Escape") {
      if (state.themeOpen) {
        event.preventDefault();
        setState({...state,themeOpen:false},{focus:"theme-trigger"});
        return;
      }
      if (state.detailsEventId) {
        event.preventDefault();
        setState({...state,detailsEventId:null},{focus:"selected"});
        return;
      }
      if (state.historyOpen) {
        event.preventDefault();
        setState({
          ...state,
          historyOpen:false,
          historyNaming:false,
          versionMenuId:null
        },{focus:"history-trigger"});
        return;
      }
      if (state.categoryMenuOpen || state.addEventOpen || state.contextMenu) {
        event.preventDefault();
        setState({
          ...state,
          categoryMenuOpen:false,
          addEventOpen:false,
          contextMenu:null
        },{focus:"selected"});
        return;
      }
    }
    if(!isEditable(state))return;
    const studyActionTarget=event.target.closest?.("[data-study-action-chip]");
    if(studyActionTarget&&["Enter"," "].includes(event.key)){
      event.preventDefault();
      const group=studyActionTarget.closest?.("[data-event-id]");
      const selected=eventById(store.document,group?.dataset?.eventId);
      if(selected){
        setState(selectCanvasEvent(state,selected.id));
        onDateControl({
          edge:"end",
          event:selected,
          targetAttemptId:studyActionTarget.dataset.studyActionChip||null,
          label:"Set retake date"
        });
      }
      return;
    }
    if (event.target.matches?.("[data-inline-label-input]")) {
      if (event.key === "Escape") {
        event.preventDefault();
        setState(cancelInlineLabelEdit(state),{focus:"selected"});
      }
      return;
    }
    if(event.target.matches?.("[data-advanced-inline-text-input]")){
      if(event.key==="Escape"){
        event.preventDefault();
        setState({...state,advancedTextEdit:null,liveAnnouncement:"Text edit canceled"});
      }
      return;
    }
    const insideCanvas = event.target.closest?.(".canvas-application,[data-canvas-event],[data-context-toolbar]");
    const commandUndo = isEditable(state) && (
      (event.metaKey || event.ctrlKey) &&
      String(event.key || "").toLowerCase() === "z"
    );
    if (!insideCanvas && !commandUndo) return;
    const result = applyCanvasKeyboard(store,state,event,{
      currentMonth:nowMonth(),
      onDropReflow,
      onToast
    });
    if (!result.handled) return;
    event.preventDefault();
    const focus = result.intent.type === "focus-toolbar"
      ? "toolbar"
      : result.intent.type === "open-details"
        ? "details"
      : result.intent.type === "cycle-selection" || result.intent.type === "exit-toolbar"
        ? "selected"
        : null;
    setState(result.state,{focus});
    if (result.detailsRoute) {
      onDetails(result.detailsRoute,eventById(store.document,result.detailsRoute.eventId));
    }
  };

  const onWheel = (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? 5 : -5;
    setState({...state,zoom:updateCanvasZoom(state.zoom,{kind:"trackpad",delta})});
  };

  const onPointerDown = (event) => {
    if (!isEditable(state) || event.button !== 0) return;
    const handle = event.target.closest?.("[data-drag-kind]");
    const target = handle
      ? event.target.closest?.("[data-selection-handles]")
      : event.target.closest?.("[data-canvas-event]");
    if (!target) return;
    const eventId = target.dataset.eventId;
    const selectedEvent=eventById(store.document,eventId);
    const application=target.closest?.(".canvas-application")||root.querySelector?.(".canvas-application");
    const bounds=application?.getBoundingClientRect?.();
    pointer = {
      eventId,
      startX:Number(event.clientX || 0),
      startY:Number(event.clientY || 0),
      kind:handle?.dataset.dragKind || (
        eventKind(selectedEvent)==="explanation"?"free-move":"move"
      ),
      logicalScaleX:bounds?.width?1920/bounds.width:1,
      logicalScaleY:bounds?.height?1080/bounds.height:1,
      transaction:null,
      moved:false
    };
    if (handle) {
      pointer.transaction = beginCanvasDrag(store.document,eventId,{
        kind:pointer.kind,
        currentMonth:nowMonth()
      });
    }
  };

  const onPointerMove = (event) => {
    if (!pointer) return;
    if(!isEditable(state)){
      pointer=null;
      if(state.drag)setState({...state,drag:null});
      return;
    }
    const dx = Number(event.clientX || 0) - pointer.startX;
    const dy = Number(event.clientY || 0) - pointer.startY;
    if (!pointer.moved && Math.hypot(dx,dy) < touchSlop) return;
    pointer.moved = true;
    if (!pointer.transaction) {
      pointer.kind=eventKind(eventById(store.document,pointer.eventId))==="explanation"
        ?"free-move"
        :Math.abs(dy) > Math.abs(dx) ? "lane" : "move";
      pointer.transaction = beginCanvasDrag(store.document,pointer.eventId,{
        kind:pointer.kind,
        currentMonth:nowMonth()
      });
    }
    pointer.transaction = updateCanvasDrag(pointer.transaction,{
      monthDelta:Math.round(dx / pixelsPerMonth),
      laneDelta:Math.round(-dy / lanePitch),
      pixelDeltaX:dx*pointer.logicalScaleX,
      pixelDeltaY:dy*pointer.logicalScaleY
    });
    state = {...state,drag:pointer.transaction,liveAnnouncement:pointer.transaction.liveTooltip};
    const live = root.querySelector?.("[data-canvas-live]");
    if (live) live.textContent = pointer.transaction.liveTooltip;
    let tooltip = root.querySelector?.(".canvas-date-tooltip");
    if (!tooltip && globalThis.document?.createElement) {
      tooltip = globalThis.document.createElement("output");
      tooltip.className = "canvas-date-tooltip";
      tooltip.setAttribute("role","status");
      root.querySelector?.(".canvas-stage")?.append(tooltip);
    }
    if (tooltip) tooltip.textContent = pointer.transaction.liveTooltip;
    if (tooltip?.style) {
      tooltip.style.position = "fixed";
      tooltip.style.left = `${Number(event.clientX || 0)}px`;
      tooltip.style.top = `${Number(event.clientY || 0) - 36}px`;
    }
  };

  const onPointerUp = () => {
    if (!pointer) return;
    if(!isEditable(state)){
      pointer=null;
      if(state.drag)setState({...state,drag:null});
      return;
    }
    if (pointer.transaction && pointer.moved) {
      const result = commitCanvasDrag(store,pointer.transaction,{onDropReflow});
      setState({
        ...state,
        drag:null,
        selectedEventId:pointer.eventId,
        liveAnnouncement:result.announcement
      },{focus:"selected",animateLayout:result.changed});
    }
    pointer = null;
  };

  root.addEventListener("click",onClick);
  root.addEventListener("dblclick",onDoubleClick);
  root.addEventListener("contextmenu",onContextMenu);
  root.addEventListener("input",onInput);
  root.addEventListener("submit",onSubmit);
  root.addEventListener("focusin",onFocusIn);
  root.addEventListener("keydown",onKeyDown);
  root.addEventListener("wheel",onWheel,{passive:false});
  root.addEventListener("pointerdown",onPointerDown);
  globalThis.document?.addEventListener("pointermove",onPointerMove);
  globalThis.document?.addEventListener("pointerup",onPointerUp);

  render();
  if(state.detailsEventId)queueMicrotask(()=>root.querySelector?.(".canvas-details-sheet button")?.focus());
  else if(state.historyOpen)queueMicrotask(()=>root.querySelector?.(".history-slide-over button")?.focus());

  return {
    get state(){return state;},
    get versions(){return versions.slice();},
    render,
    refreshEffectiveHitTargets:queueEffectiveHitTargets,
    refreshVersions,
    setUiState(next){
      setState(typeof next === "function" ? next(state) : {...state,...next});
    },
    setResponsiveWidth(width){
      setState({...state,responsive:canvasResponsiveContract(width)});
    },
    destroy(){
      destroyed = true;
      globalThis.cancelAnimationFrame?.(effectiveHitFrame);
      root.removeEventListener("click",onClick);
      root.removeEventListener("dblclick",onDoubleClick);
      root.removeEventListener("contextmenu",onContextMenu);
      root.removeEventListener("input",onInput);
      root.removeEventListener("submit",onSubmit);
      root.removeEventListener("focusin",onFocusIn);
      root.removeEventListener("keydown",onKeyDown);
      root.removeEventListener("wheel",onWheel);
      root.removeEventListener("pointerdown",onPointerDown);
      globalThis.document?.removeEventListener("pointermove",onPointerMove);
      globalThis.document?.removeEventListener("pointerup",onPointerUp);
    }
  };
}
