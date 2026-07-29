import {installMonthFields,monthFieldMarkup} from "./month-field.js";
import {installFocusTrap} from "./responsive.js";
import {
  ADVISOR_PAPER_THEME_ID,
  DEFAULT_THEME_ID,
  THEMES_BY_ID,
  evaluateAdvisorPaperPdfSuggestion,
  resolveAdvisorPaperPdfSuggestion
} from "./themes.js";
import {clone,dateLabel,escapeHtml} from "./utils.js";

const freezeDeep=(value)=>{
  if(!value||typeof value!=="object"||Object.isFrozen(value))return value;
  for(const child of Object.values(value))freezeDeep(child);
  return Object.freeze(value);
};

export const EXPORT_PREVIEW_LOADING_MAX_MS=400;
export const EXPORT_PRINT_MARGIN_MM=12.7;
export const DEFAULT_EXPORT_AUDIENCE="INTERVIEWER_SAFE";
export const DEFAULT_EXPORT_FORMAT_ID="png-1920x1080";

export const EXPORT_AUDIENCES=freezeDeep([
  {
    id:"INTERVIEWER_SAFE",
    label:"Interview-safe",
    description:"Interview-safe hides items you marked advisor-only.",
    tone:"secondary"
  },
  {
    id:"EVERYTHING",
    label:"Everything",
    description:"Includes advisor-only items. Don't hand this version to programs.",
    tone:"danger"
  }
]);

export const EXPORT_FORMATS=freezeDeep([
  {
    id:"png-1920x1080",
    kind:"PNG",
    extension:"png",
    label:"PNG · 1920 × 1080 — screens and slides",
    width:1920,
    height:1080,
    dpi:null,
    page:null
  },
  {
    id:"png-2560x1440",
    kind:"PNG",
    extension:"png",
    label:"PNG · 2560 × 1440 — high-res screens",
    width:2560,
    height:1440,
    dpi:null,
    page:null
  },
  {
    id:"pdf-letter-landscape",
    kind:"PDF",
    extension:"pdf",
    label:"PDF · Letter landscape — printing (300 DPI)",
    width:null,
    height:null,
    dpi:300,
    page:freezeDeep({name:"Letter",orientation:"landscape",widthIn:11,heightIn:8.5})
  },
  {
    id:"pdf-a4-landscape",
    kind:"PDF",
    extension:"pdf",
    label:"PDF · A4 landscape — printing (300 DPI)",
    width:null,
    height:null,
    dpi:300,
    page:freezeDeep({name:"A4",orientation:"landscape",widthMm:297,heightMm:210})
  }
]);

export const PRINT_GUIDANCE_COPY=freezeDeep({
  title:"Printing for interviews",
  lead:"For interview handouts:",
  bullets:[
    "Export the PDF (Letter or A4) — it renders at 300 DPI for sharp print.",
    "Print at a professional print shop (FedEx Office, Staples, or a local printer), not a home inkjet.",
    "Ask for heavyweight matte cardstock, 80–100 lb (216–270 gsm). Glossy stock glares under interview-room lighting.",
    "For a handout you'll reuse across interview season, ask for matte lamination (3 mil) — it resists fingerprints and stays flat in a padfolio.",
    "Print one per interviewer plus two spares.",
    "Do a single test print first and check that the smallest text is comfortably readable at arm's length."
  ]
});

export class ExportBoundaryError extends Error{
  constructor(code,message,{cause=null,partial=null}={}){
    super(message,{cause});
    this.name="ExportBoundaryError";
    this.code=code;
    this.partial=partial;
  }
}

function exportFormat(formatId){
  const format=EXPORT_FORMATS.find((candidate)=>candidate.id===formatId);
  if(!format)throw new RangeError(`Unknown export format: ${String(formatId)}`);
  return format;
}

function exportAudience(audience){
  const normalized=String(audience||DEFAULT_EXPORT_AUDIENCE).toUpperCase();
  const entry=EXPORT_AUDIENCES.find((candidate)=>candidate.id===normalized);
  if(!entry)throw new RangeError("Export audience must be INTERVIEWER_SAFE or EVERYTHING.");
  return entry;
}

function localDateStamp(value){
  const date=value instanceof Date?value:new Date(value);
  if(Number.isNaN(date.getTime()))throw new TypeError("A valid export date is required.");
  return[
    date.getFullYear(),
    String(date.getMonth()+1).padStart(2,"0"),
    String(date.getDate()).padStart(2,"0")
  ].join("-");
}

function cleanNamePart(value){
  return String(value||"")
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g,"")
    .replace(/\s+/g,"")
    .trim();
}

const NAME_TITLES=/^(?:dr|mr|mrs|ms|mx|prof)\.?$/i;
const NAME_SUFFIXES=/^(?:jr|sr|ii|iii|iv|v|md|do|mbbs|phd)\.?$/i;

export function parseStudentName(fullName){
  const normalized=String(fullName||"").normalize("NFKC").replace(/\s+/g," ").trim();
  if(!normalized)throw new TypeError("Student name is required to export.");
  const commaParts=normalized.split(",").map((part)=>part.trim()).filter(Boolean);
  let firstTokens=[];
  let lastTokens=[];
  const commaTailIsSuffix=commaParts.length===2&&
    commaParts[1].split(" ").every((token)=>NAME_SUFFIXES.test(token));
  if(commaParts.length>1&&!commaTailIsSuffix){
    lastTokens=commaParts[0].split(" ");
    firstTokens=commaParts.slice(1).join(" ").split(" ");
  }else{
    const tokens=(commaTailIsSuffix?commaParts[0]:normalized).split(" ");
    while(tokens.length&&NAME_TITLES.test(tokens[0]))tokens.shift();
    while(tokens.length>1&&NAME_SUFFIXES.test(tokens.at(-1)))tokens.pop();
    if(!tokens.length)throw new TypeError("Student name is required to export.");
    firstTokens=[tokens[0]];
    lastTokens=[tokens.length===1?tokens[0]:tokens.at(-1)];
  }
  while(firstTokens.length&&NAME_TITLES.test(firstTokens[0]))firstTokens.shift();
  while(firstTokens.length>1&&NAME_SUFFIXES.test(firstTokens.at(-1)))firstTokens.pop();
  while(lastTokens.length>1&&NAME_SUFFIXES.test(lastTokens.at(-1)))lastTokens.pop();
  const firstName=cleanNamePart(firstTokens[0]);
  const lastName=cleanNamePart(lastTokens.join(""));
  if(!firstName||!lastName)throw new TypeError("Student name must include a usable first and last name.");
  return freezeDeep({firstName,lastName});
}

export function buildExportFilename(fullName,formatId,{now=new Date()}={}){
  const {firstName,lastName}=parseStudentName(fullName);
  const format=exportFormat(formatId);
  return`${lastName}_${firstName}_Timeline_${localDateStamp(now)}.${format.extension}`;
}

export function filterEventsForAudience(events,audience=DEFAULT_EXPORT_AUDIENCE){
  const selection=exportAudience(audience);
  const source=Array.isArray(events)?events:[];
  const included=selection.id==="EVERYTHING"
    ?source
    :source.filter((event)=>event?.visibilityState!=="ADVISOR_ONLY");
  const excluded=selection.id==="EVERYTHING"
    ?[]
    :source.filter((event)=>event?.visibilityState==="ADVISOR_ONLY");
  return{
    audience:selection.id,
    included:clone(included),
    excludedIds:excluded.map((event)=>String(event?.id||"")).filter(Boolean)
  };
}

export function normalizeExportState(state={}){
  const audience=exportAudience(state.audience).id;
  const format=exportFormat(state.formatId||DEFAULT_EXPORT_FORMAT_ID);
  return{
    audience,
    formatId:format.id,
    showPrintMargins:format.kind==="PDF"&&Boolean(state.showPrintMargins),
    previewStatus:["idle","loading","ready","error"].includes(state.previewStatus)
      ?state.previewStatus
      :"idle",
    exporting:Boolean(state.exporting),
    suggestionState:{
      advisorPaperPdfSuggestionShown:Boolean(
        state.suggestionState?.advisorPaperPdfSuggestionShown
      )
    }
  };
}

export function reduceExportState(state,action){
  const current=normalizeExportState(state);
  switch(action?.type){
    case"audience":
      return{...current,audience:exportAudience(action.value).id,previewStatus:"loading"};
    case"format":{
      const format=exportFormat(action.value);
      return{
        ...current,
        formatId:format.id,
        showPrintMargins:format.kind==="PDF"&&current.showPrintMargins,
        previewStatus:"loading"
      };
    }
    case"print-margins":
      return{
        ...current,
        showPrintMargins:exportFormat(current.formatId).kind==="PDF"&&Boolean(action.value)
      };
    case"preview-status":
      return{...current,previewStatus:normalizeExportState({...current,previewStatus:action.value}).previewStatus};
    case"exporting":
      return{...current,exporting:Boolean(action.value)};
    case"suggestion-shown":
      return{
        ...current,
        suggestionState:{advisorPaperPdfSuggestionShown:true}
      };
    default:
      return current;
  }
}

export function buildExportPreviewInput(document,state={}){
  if(!document||typeof document!=="object"||Array.isArray(document)){
    throw new TypeError("Export preview requires a timeline document.");
  }
  const normalized=normalizeExportState(state);
  const format=exportFormat(normalized.formatId);
  const filtered=filterEventsForAudience(document.events,normalized.audience);
  const timeline=clone(document);
  timeline.events=filtered.included;
  return{
    contract:"D1-UXR-002-EXPORT-RENDER-INPUT-V1",
    timeline,
    rendererOptions:{
      /*
       * Filtering happens once at this boundary. EVERYTHING tells the shared
       * renderer not to perform a second, potentially divergent filter pass.
       */
      audience:"EVERYTHING",
      interviewMonth:timeline.studentProfile?.interviewSeason||null
    },
    audience:{
      mode:filtered.audience,
      sourceEventCount:Array.isArray(document.events)?document.events.length:0,
      includedEventCount:timeline.events.length,
      includedEventIds:timeline.events.map((event)=>String(event?.id||"")).filter(Boolean),
      excludedAdvisorOnlyIds:filtered.excludedIds
    },
    themeId:timeline.theme||DEFAULT_THEME_ID,
    mode:timeline.mode||"guided",
    output:clone(format)
  };
}

export function buildExportRequest(document,state={},options={}){
  const normalized=normalizeExportState(state);
  const format=exportFormat(normalized.formatId);
  const renderInput=buildExportPreviewInput(document,normalized);
  const now=options.now||new Date();
  return{
    contract:"D1-UXR-002-EXPORT-REQUEST-V1",
    filename:buildExportFilename(document?.studentProfile?.fullName,format.id,{now}),
    audience:normalized.audience,
    format:clone(format),
    /*
     * Preview and generation intentionally receive the same object. The
     * optional 12.7mm margin guide is shell UI and never enters file content.
     */
    previewInput:renderInput,
    renderInput,
    printGuide:{
      visible:format.kind==="PDF"&&normalized.showPrintMargins,
      marginMm:EXPORT_PRINT_MARGIN_MM,
      includedInFile:false
    },
    version:{
      kind:"automatic",
      label:`Export · ${dateLabel(now)}`
    },
    boundary:{
      permittedExecutionModes:["local","simulated"],
      externalApiCalls:false,
      productionWrites:false,
      requiresVerifiedDownload:true
    }
  };
}

export function buildAdvisorReviewRequest(document,{message="",now=new Date()}={}){
  if(!document||typeof document!=="object"||Array.isArray(document)){
    throw new TypeError("Advisor review requires a timeline document.");
  }
  const timeline=clone(document);
  timeline.events=clone(Array.isArray(document.events)?document.events:[]);
  return{
    contract:"D1-UXR-002-ADVISOR-REQUEST-V1",
    timeline,
    audience:"EVERYTHING",
    includedEventIds:timeline.events.map((event)=>String(event?.id||"")).filter(Boolean),
    message:String(message||"").trim(),
    requestedAt:(now instanceof Date?now:new Date(now)).toISOString(),
    sessionRoute:`advisor-session:${String(document.id||"timeline")}`,
    version:{
      kind:"automatic",
      label:`Sent for review · ${dateLabel(now)}`
    },
    boundary:{
      localHandoffStub:true,
      externalApiCalls:false,
      productionWrites:false
    }
  };
}

function suggestionStateFrom(document,state){
  const preferences=document?.preferences||{};
  return{
    advisorPaperPdfSuggestionShown:Boolean(
      state?.advisorPaperPdfSuggestionShown||
      preferences.advisorPaperPdfSuggestionShown||
      preferences.advisorPaperSuggestionDismissed
    )
  };
}

export function planAdvisorPaperPdfSuggestion(document,formatId,suggestionState={}){
  const format=exportFormat(formatId);
  return evaluateAdvisorPaperPdfSuggestion({
    format:format.kind,
    activeThemeId:document?.theme||DEFAULT_THEME_ID,
    suggestionState:suggestionStateFrom(document,suggestionState)
  });
}

export function resolveExportAdvisorPaperSuggestion(document,evaluation,resolution){
  return resolveAdvisorPaperPdfSuggestion(document,evaluation,resolution);
}

function normalizeAdvisorState(advisor={}){
  const status=String(advisor.status||"not-requested").toLowerCase().replace(/_/g,"-");
  const unresolvedComments=Array.isArray(advisor.comments)
    ?advisor.comments.filter((comment)=>!comment?.resolvedAt).length
    :0;
  if(advisor.approvedAt||status==="approved"){
    return{
      kind:"approved",
      date:dateLabel(advisor.approvedAt||advisor.updatedAt||new Date()),
      editedSince:Boolean(advisor.editedSince),
      comments:unresolvedComments
    };
  }
  if(["changes-requested","change-requested"].includes(status)){
    return{kind:"changes-requested",date:null,editedSince:false,comments:unresolvedComments};
  }
  if(advisor.requestedAt||["pending","requested","awaiting"].includes(status)){
    return{
      kind:"pending",
      date:dateLabel(advisor.requestedAt||advisor.updatedAt||new Date()),
      editedSince:false,
      comments:unresolvedComments
    };
  }
  return{kind:"not-requested",date:null,editedSince:false,comments:unresolvedComments};
}

export function buildExportScreenModel(document,state={},options={}){
  const normalized=normalizeExportState(state);
  const format=exportFormat(normalized.formatId);
  const audience=exportAudience(normalized.audience);
  const eventCount=Array.isArray(document?.events)?document.events.length:0;
  const empty=eventCount===0;
  const theme=THEMES_BY_ID[document?.theme]||THEMES_BY_ID[DEFAULT_THEME_ID];
  let filename=null;
  if(!empty&&String(document?.studentProfile?.fullName||"").trim()){
    filename=buildExportFilename(document.studentProfile.fullName,format.id,{now:options.now||new Date()});
  }
  return{
    layout:{columns:2,controlsWidthPx:380,preview:"fluid"},
    state:normalized,
    empty,
    eventCount,
    controlsDisabled:empty||normalized.exporting,
    audience,
    format,
    formats:EXPORT_FORMATS,
    theme:{id:theme.id,name:theme.name},
    filename,
    showPrintMarginToggle:format.kind==="PDF",
    printMarginMm:EXPORT_PRINT_MARGIN_MM,
    advisor:normalizeAdvisorState(document?.advisor),
    preview:empty
      ?{kind:"ghost",status:"idle",input:null}
      :{
        kind:"live",
        status:normalized.previewStatus,
        maxLoadingMs:EXPORT_PREVIEW_LOADING_MAX_MS,
        input:buildExportPreviewInput(document,normalized)
      }
  };
}

function disabledAttribute(disabled){
  return disabled?" disabled":"";
}

function renderAudienceCard(model,document){
  return`<section class="card export-card export-audience-card" aria-labelledby="export-audience-title">
    <h2 id="export-audience-title">Audience</h2>
    <div class="segmented export-audience" role="radiogroup" aria-label="Export audience">
      ${EXPORT_AUDIENCES.map((audience)=>`<label>
        <input type="radio" name="export-audience" value="${audience.id}" ${model.audience.id===audience.id?"checked":""}${disabledAttribute(model.controlsDisabled)}>
        <span>${audience.label}</span>
      </label>`).join("")}
    </div>
    <p class="export-audience-copy ${model.audience.tone==="danger"?"danger":""}" data-export-audience-copy>${escapeHtml(model.audience.description)}</p>
    ${monthFieldMarkup({
      id:"export-interview-season",
      label:"Interview season",
      value:document?.studentProfile?.interviewSeason||"",
      help:"Optional · adds the interview target to your timeline.",
      disabled:model.controlsDisabled
    })}
  </section>`;
}

function renderThemeCard(model){
  return`<section class="card export-card export-theme-card" aria-labelledby="export-theme-title">
    <h2 id="export-theme-title">Theme</h2>
    <button type="button" class="button secondary export-theme-trigger" data-export-theme-trigger${disabledAttribute(model.controlsDisabled)}>Theme · ${escapeHtml(model.theme.name)} ▾</button>
  </section>`;
}

export function renderPrintGuidance({disabled=false}={}){
  return`<details class="card export-card print-guidance" data-print-guidance ${disabled?'aria-disabled="true"':""}>
    <summary>${PRINT_GUIDANCE_COPY.title}</summary>
    <div class="print-guidance-copy">
      <p><strong>${PRINT_GUIDANCE_COPY.lead}</strong></p>
      <ul>
        <li>Export the PDF (Letter or A4) — it renders at 300 DPI for sharp print.</li>
        <li>Print at a professional print shop (FedEx Office, Staples, or a local printer), not a home inkjet.</li>
        <li>Ask for <strong>heavyweight matte cardstock, 80–100 lb (216–270 gsm)</strong>. Glossy stock glares under interview-room lighting.</li>
        <li>For a handout you'll reuse across interview season, ask for <strong>matte lamination (3 mil)</strong> — it resists fingerprints and stays flat in a padfolio.</li>
        <li>Print one per interviewer plus two spares.</li>
        <li>Do a single test print first and check that the smallest text is comfortably readable at arm's length.</li>
      </ul>
    </div>
  </details>`;
}

function renderFormatCard(model){
  return`<section class="card export-card export-format-card" aria-labelledby="export-format-title">
    <h2 id="export-format-title">Format &amp; size</h2>
    <fieldset class="export-format-list">
      <legend class="sr-only">Export format and size</legend>
      ${EXPORT_FORMATS.map((format)=>`<label class="export-format-option">
        <input type="radio" name="export-format" value="${format.id}" ${model.format.id===format.id?"checked":""}${disabledAttribute(model.controlsDisabled)}>
        <span>${format.label}</span>
      </label>`).join("")}
    </fieldset>
    ${model.showPrintMarginToggle?`<label class="check-row export-print-margin">
      <input type="checkbox" data-export-print-margins ${model.state.showPrintMargins?"checked":""}${disabledAttribute(model.controlsDisabled)}>
      <span>Show print margins</span>
    </label>`:""}
  </section>
  ${renderPrintGuidance({disabled:model.controlsDisabled})}`;
}

function renderAdvisorCard(model){
  const advisor=model.advisor;
  let contents="";
  if(advisor.kind==="pending"){
    contents=`<p>Awaiting advisor review · requested ${escapeHtml(advisor.date)}</p>
      <button type="button" class="button tertiary" data-export-advisor-cancel${disabledAttribute(model.controlsDisabled)}>Cancel request</button>`;
  }else if(advisor.kind==="approved"){
    const text=advisor.editedSince
      ?`Approved ${advisor.date} · edited since`
      :`Advisor approved · ${advisor.date}`;
    contents=`<span class="badge success">${escapeHtml(text)}</span>`;
  }else if(advisor.kind==="changes-requested"){
    contents=`<button type="button" class="chip gold" data-export-advisor-comments${disabledAttribute(model.controlsDisabled)}>${advisor.comments} advisor comments</button>`;
  }else{
    contents=`<p>Get a second pair of eyes before you export.</p>
      <button type="button" class="button secondary" data-export-advisor-request${disabledAttribute(model.controlsDisabled)}>Request advisor review</button>`;
  }
  return`<section class="card export-card export-advisor-card" aria-labelledby="export-advisor-title">
    <h2 id="export-advisor-title">Advisor review</h2>
    ${contents}
  </section>
  <section class="export-advisor-sheet" role="dialog" aria-modal="true" aria-labelledby="export-advisor-sheet-title" hidden data-export-advisor-sheet>
    <h2 id="export-advisor-sheet-title">Request advisor review</h2>
    <label for="export-advisor-message">Anything you want your advisor to focus on?</label>
    <textarea id="export-advisor-message" data-export-advisor-message></textarea>
    <div class="dialog-actions">
      <button type="button" class="button secondary" data-export-advisor-sheet-cancel>Cancel</button>
      <button type="button" class="button primary" data-export-advisor-send>Send for review</button>
    </div>
  </section>`;
}

function renderPreview(model,previewHtml){
  if(model.empty){
    return`<section class="export-preview-panel empty" aria-label="Export preview" data-export-preview>
      <div class="ghost-export-board" aria-hidden="true"><span class="ghost-export-axis"></span></div>
      <div class="empty-preview-card" role="status">
        <h2>Add events before exporting.</h2>
        <button type="button" class="button secondary" data-export-open-builder>Open Builder</button>
      </div>
    </section>`;
  }
  const loading=model.preview.status==="loading";
  return`<section class="export-preview-panel" aria-label="Live export preview" data-export-preview aria-busy="${String(loading)}">
    <div class="export-preview-loading" role="status" data-export-preview-loading data-max-duration-ms="${EXPORT_PREVIEW_LOADING_MAX_MS}" ${loading?"":"hidden"}>
      <span class="spinner" aria-hidden="true"></span><span>Rendering preview…</span>
    </div>
    <div class="export-preview-content" data-export-preview-content>${previewHtml||""}</div>
    ${model.showPrintMarginToggle&&model.state.showPrintMargins?`<div class="print-margin-overlay" aria-hidden="true" data-print-margin-mm="${EXPORT_PRINT_MARGIN_MM}"></div>`:""}
  </section>`;
}

export function renderExportScreen(document,{state={},previewHtml="",now=new Date()}={}){
  const model=buildExportScreenModel(document,state,{now});
  return`<div class="screen export-screen" data-screen="export" data-export-layout="two-column" data-export-controls-width="380">
    <div class="export-layout">
      <section class="export-controls" aria-labelledby="export-title">
        <h1 id="export-title" tabindex="-1">Export</h1>
        ${renderAudienceCard(model,document)}
        ${renderThemeCard(model)}
        ${renderFormatCard(model)}
        ${renderAdvisorCard(model)}
        <button type="button" class="button primary export-action" data-export-action${disabledAttribute(model.controlsDisabled)}>Export ${model.format.kind}</button>
      </section>
      ${renderPreview(model,previewHtml)}
    </div>
  </div>`;
}

function adapterExecutionMode(adapter,artifact){
  const declared=String(
    artifact?.executionMode||
    adapter?.executionMode||
    adapter?.metadata?.executionMode||
    (artifact?.simulated||adapter?.simulated?"simulated":"")
  ).toLowerCase();
  if(declared!=="local"&&declared!=="simulated"){
    throw new ExportBoundaryError(
      "EXPORT_ADAPTER_MODE_UNVERIFIED",
      "Export adapter must truthfully declare local or simulated execution."
    );
  }
  return artifact?.simulated===true?"simulated":declared;
}

export async function executeExportRequest(request,{
  adapter,
  requestVersion,
  toast=()=>{}
}={}){
  if(!request||request.contract!=="D1-UXR-002-EXPORT-REQUEST-V1"){
    throw new ExportBoundaryError("EXPORT_REQUEST_INVALID","A verified export request is required.");
  }
  if(typeof adapter?.generate!=="function"||typeof adapter?.download!=="function"){
    throw new ExportBoundaryError(
      "EXPORT_ADAPTER_UNAVAILABLE",
      "A generation and download adapter is required."
    );
  }
  if(typeof requestVersion!=="function"){
    throw new ExportBoundaryError(
      "EXPORT_VERSION_ADAPTER_UNAVAILABLE",
      "An automatic version request adapter is required."
    );
  }
  let artifact;
  try{
    artifact=await adapter.generate(request);
  }catch(cause){
    throw new ExportBoundaryError("EXPORT_GENERATION_FAILED","Export generation failed.",{cause});
  }
  const executionMode=adapterExecutionMode(adapter,artifact);
  const baseMetadata={
    adapterId:String(adapter.id||adapter.name||"anonymous-export-adapter"),
    executionMode,
    generated:Boolean(artifact),
    downloadAttempted:false,
    downloaded:false,
    externalApiCalls:false,
    productionWrites:false
  };
  if(executionMode==="simulated"){
    return{
      status:"simulated",
      completed:false,
      filename:request.filename,
      artifact:artifact||null,
      delivery:null,
      metadata:baseMetadata,
      versionRequested:false,
      toastSent:false
    };
  }
  let delivery;
  try{
    delivery=await adapter.download(artifact,{filename:request.filename,request});
  }catch(cause){
    throw new ExportBoundaryError(
      "EXPORT_DOWNLOAD_FAILED",
      "Export download failed.",
      {cause,partial:{...baseMetadata,downloadAttempted:true}}
    );
  }
  const metadata={
    ...baseMetadata,
    downloadAttempted:true,
    downloaded:delivery?.downloaded===true
  };
  if(!metadata.downloaded){
    throw new ExportBoundaryError(
      "EXPORT_DOWNLOAD_UNVERIFIED",
      "The export adapter did not verify a downloaded file.",
      {partial:metadata}
    );
  }
  try{
    await requestVersion(request.version.label,request.version.kind,{request,artifact,delivery});
  }catch(cause){
    throw new ExportBoundaryError(
      "EXPORT_VERSION_REQUEST_FAILED",
      "The file downloaded, but the automatic version request failed.",
      {cause,partial:metadata}
    );
  }
  toast(`Exported · ${request.filename}`,{tone:"success"});
  return{
    status:"downloaded",
    completed:true,
    filename:request.filename,
    artifact,
    delivery,
    metadata,
    versionRequested:true,
    toastSent:true
  };
}

export async function refreshExportPreview({
  document,
  state={},
  renderPreview,
  onState=()=>{},
  timeoutMs=EXPORT_PREVIEW_LOADING_MAX_MS,
  timers={set:setTimeout,clear:clearTimeout}
}={}){
  if(typeof renderPreview!=="function")throw new TypeError("renderPreview must be a function.");
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>EXPORT_PREVIEW_LOADING_MAX_MS){
    throw new RangeError(`Preview timeout must be between 1 and ${EXPORT_PREVIEW_LOADING_MAX_MS}ms.`);
  }
  const input=buildExportPreviewInput(document,state);
  onState({status:"loading",maxDurationMs:EXPORT_PREVIEW_LOADING_MAX_MS,input});
  let timer;
  try{
    const result=await Promise.race([
      Promise.resolve().then(()=>renderPreview(input)),
      new Promise((_,reject)=>{
        timer=timers.set(()=>reject(new ExportBoundaryError(
          "EXPORT_PREVIEW_TIMEOUT",
          `Export preview exceeded ${timeoutMs}ms.`
        )),timeoutMs);
      })
    ]);
    const html=typeof result==="string"?result:result?.html;
    if(typeof html!=="string"){
      throw new ExportBoundaryError("EXPORT_PREVIEW_INVALID","Preview renderer did not return HTML.");
    }
    const ready={status:"ready",maxDurationMs:EXPORT_PREVIEW_LOADING_MAX_MS,input,html,metadata:result?.metadata||null};
    onState(ready);
    return ready;
  }catch(error){
    const failure=error instanceof ExportBoundaryError
      ?error
      :new ExportBoundaryError("EXPORT_PREVIEW_FAILED","Export preview failed.",{cause:error});
    onState({status:"error",maxDurationMs:EXPORT_PREVIEW_LOADING_MAX_MS,input,error:failure});
    throw failure;
  }finally{
    if(timer!=null)timers.clear(timer);
  }
}

function setButtonBusy(button,busy,label){
  if(!button)return;
  button.disabled=Boolean(busy);
  button.setAttribute("aria-busy",String(Boolean(busy)));
  if(label!=null)button.textContent=label;
}

export function installExportScreen(root,document,{
  state={},
  now=()=>new Date(),
  renderPreview=null,
  exportAdapter=null,
  toast=()=>{},
  requestVersion=null,
  onStateChange=()=>{},
  onOpenBuilder=()=>{},
  onThemeTrigger=()=>{},
  onThemeChange=()=>{},
  onSuggestionStateChange=()=>{},
  onAdvisorPaperSuggestion=null,
  onInterviewSeasonChange=()=>{},
  onAdvisorRequest=()=>{},
  onAdvisorCancel=()=>{},
  onAdvisorComments=()=>{}
}={}){
  let current=normalizeExportState(state);
  const emit=(next,reason)=>{
    current=normalizeExportState(next);
    onStateChange(clone(current),reason);
    return current;
  };
  const previewHost=root.querySelector("[data-export-preview]");
  const refresh=async(next=current)=>{
    if(typeof renderPreview!=="function"||!Array.isArray(document?.events)||document.events.length===0)return null;
    const loading=previewHost?.querySelector?.("[data-export-preview-loading]");
    const content=previewHost?.querySelector?.("[data-export-preview-content]");
    try{
      return await refreshExportPreview({
        document,
        state:next,
        renderPreview,
        onState:(previewState)=>{
          emit(reduceExportState(current,{type:"preview-status",value:previewState.status}),`preview-${previewState.status}`);
          if(previewHost)previewHost.setAttribute("aria-busy",String(previewState.status==="loading"));
          if(loading)loading.hidden=previewState.status!=="loading";
          if(content&&previewState.status==="ready")content.innerHTML=previewState.html;
        }
      });
    }catch(error){
      toast("Export failed — try again",{tone:"danger"});
      return{status:"error",error};
    }
  };

  root.querySelectorAll('[name="export-audience"]').forEach((control)=>{
    control.addEventListener("change",()=>{
      const next=emit(reduceExportState(current,{type:"audience",value:control.value}),"audience");
      refresh(next);
    });
  });

  root.querySelectorAll('[name="export-format"]').forEach((control)=>{
    control.addEventListener("change",()=>{
      const next=emit(reduceExportState(current,{type:"format",value:control.value}),"format");
      const evaluation=planAdvisorPaperPdfSuggestion(document,next.formatId,next.suggestionState);
      if(evaluation.offered){
        const shown=emit(reduceExportState(next,{type:"suggestion-shown"}),"advisor-paper-suggestion");
        onSuggestionStateChange(clone(shown.suggestionState));
        const apply=()=>{
          const resolution=resolveExportAdvisorPaperSuggestion(document,evaluation,"apply");
          onThemeChange(ADVISOR_PAPER_THEME_ID,{
            historyEntry:resolution.historyEntry,
            suggestionState:resolution.suggestionState,
            source:"export-pdf-suggestion"
          });
        };
        const dismiss=()=>resolveExportAdvisorPaperSuggestion(document,evaluation,"dismiss");
        if(typeof onAdvisorPaperSuggestion==="function"){
          onAdvisorPaperSuggestion({...evaluation.suggestion,apply,dismiss});
        }else{
          toast(evaluation.suggestion.message,{actionLabel:evaluation.suggestion.actionLabel,onAction:apply});
        }
      }
      refresh(next);
    });
  });

  root.querySelector("[data-export-print-margins]")?.addEventListener("change",(event)=>{
    const next=emit(reduceExportState(current,{type:"print-margins",value:event.currentTarget.checked}),"print-margins");
    refresh(next);
  });
  root.querySelector("[data-export-theme-trigger]")?.addEventListener("click",onThemeTrigger);
  root.querySelector("[data-export-open-builder]")?.addEventListener("click",onOpenBuilder);

  installMonthFields(root,{onCommit:(id,value,input)=>{
    if(id!=="export-interview-season")return;
    onInterviewSeasonChange(value,input);
    refresh(current);
  }});

  const advisorSheet=root.querySelector("[data-export-advisor-sheet]");
  const advisorMessage=root.querySelector("[data-export-advisor-message]");
  let advisorTrap=null;
  let advisorOpener=null;
  const closeAdvisorSheet=()=>{
    advisorTrap?.destroy();
    advisorTrap=null;
    if(advisorSheet)advisorSheet.hidden=true;
    advisorOpener?.focus?.();
    advisorOpener=null;
  };
  root.querySelector("[data-export-advisor-request]")?.addEventListener("click",(event)=>{
    if(advisorSheet){
      advisorOpener=event.currentTarget;
      advisorSheet.hidden=false;
      advisorTrap=installFocusTrap(advisorSheet,{
        opener:advisorOpener,
        onEscape:closeAdvisorSheet,
        restoreFocus:false
      });
    }
  });
  root.querySelector("[data-export-advisor-sheet-cancel]")?.addEventListener("click",closeAdvisorSheet);
  root.querySelector("[data-export-advisor-send]")?.addEventListener("click",async(event)=>{
    const button=event.currentTarget;
    setButtonBusy(button,true,"Sending…");
    try{
      const request=buildAdvisorReviewRequest(document,{message:advisorMessage?.value||"",now:now()});
      const handoff=await onAdvisorRequest(request);
      if(handoff?.versionHandled!==true&&typeof requestVersion!=="function"){
        throw new ExportBoundaryError(
          "ADVISOR_VERSION_ADAPTER_UNAVAILABLE",
          "An automatic version request adapter is required."
        );
      }
      if(handoff?.versionHandled!==true){
        await requestVersion(request.version.label,request.version.kind,{request});
      }
      closeAdvisorSheet();
    }catch(error){
      toast(String(error?.message||error),{tone:"danger"});
    }finally{
      setButtonBusy(button,false,"Send for review");
    }
  });
  root.querySelector("[data-export-advisor-cancel]")?.addEventListener("click",onAdvisorCancel);
  root.querySelector("[data-export-advisor-comments]")?.addEventListener("click",onAdvisorComments);

  const exportButton=root.querySelector("[data-export-action]");
  exportButton?.addEventListener("click",async()=>{
    const format=exportFormat(current.formatId);
    emit(reduceExportState(current,{type:"exporting",value:true}),"export-start");
    setButtonBusy(exportButton,true,`Exporting ${format.kind}…`);
    try{
      const request=buildExportRequest(document,current,{now:now()});
      const result=await executeExportRequest(request,{
        adapter:exportAdapter,
        requestVersion,
        toast
      });
      if(!result.completed){
        throw new ExportBoundaryError(
          "EXPORT_SIMULATION_NOT_DOWNLOAD",
          "Simulated export did not download a file.",
          {partial:result.metadata}
        );
      }
    }catch(error){
      toast("Export failed — try again",{tone:"danger"});
    }finally{
      emit(reduceExportState(current,{type:"exporting",value:false}),"export-finish");
      setButtonBusy(exportButton,false,`Export ${format.kind}`);
    }
  });

  return{
    get state(){return clone(current);},
    refreshPreview:()=>refresh(current),
    destroy:()=>advisorTrap?.destroy()
  };
}
