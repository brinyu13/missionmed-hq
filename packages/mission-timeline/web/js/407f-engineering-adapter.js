import {TimelineStore} from "./uxr-002/store.js";
import {
  addBuilderExam,
  deleteBuilderExamAttempt,
  finalizeBuilderExams,
  normalizeExamDocument,
  restoreBuilderAutomaticRetake,
  setBuilderExamSystem,
  updateBuilderExamAttempt
} from "./uxr-002/exam-integration.js";
import {
  beginBuilderEntryEdit,
  commitBuilderEntry,
  deleteBuilderEntry,
  ensureBuilderState,
  normalizeWorkAuthorization,
  projectRotationDates,
  rankCountryMatches,
  typeaheadRows
} from "./uxr-002/builder.js";
import {createRuntimeDatasets} from "./uxr-002/datasets.js";
import {
  buildCompletenessSummary,
  computeStoryChecks
} from "./uxr-002/review.js";
import {
  createCanvasState,
  installCanvas
} from "./uxr-002/canvas.js";
import {
  createCanvasZoom,
  updateCanvasZoom
} from "./uxr-002/canvas.js";
import {
  BUILDER_PREVIEW_ZOOM_PRESETS,
  builderPreviewFocusableTargets,
  builderPreviewTargetAttributes,
  enhanceBuilderPreviewSvg,
  moveBuilderPreviewFocus,
  resolveBuilderPreviewOwner
} from "./uxr-002/builder-preview.js";
import {
  installExactDateFields,
  exactDateFieldMarkup,
  parseExactDate
} from "./uxr-002/exact-date-field.js";
import {
  installMonthFields,
  monthFieldMarkup
} from "./uxr-002/month-field.js";
import {
  createMediaLibraryAsset,
  mediaLibraryMarkup,
  nudgeMediaLibraryAsset,
  placeMediaLibraryAsset,
  unplaceMediaLibraryAsset
} from "./uxr-002/media-library.js";
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
  ADVISOR_SESSION_THEME_ID,
  addAdvisorComment,
  advisorQuestionModel,
  applyAdvisorRequest,
  approveAdvisorReview,
  buildAdvisorRequestPlan,
  cancelAdvisorRequest,
  deleteAdvisorComment,
  hideAdvisorQuestion,
  installAdvisorWorkflow,
  questionHighlightEffect,
  reconcileApprovalFingerprint,
  renderAdvisorSession,
  renderStudentCommentLayer,
  requestAdvisorChanges,
  resolveAdvisorComment,
  setChecklistState,
  updateAdvisorComment
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
import {
  queryFileVaultSource,
  renderFileVaultSourceChooser,
  resolveFileVaultSourceAdapter,
  selectFileVaultSourceDocument
} from "./uxr-002/filevault-source.js";
import {
  buildResponsiveModel,
  focusScreenHeading,
  installFocusTrap,
  installResponsiveRuntime
} from "./uxr-002/responsive.js";
import {
  LOR_GUIDED_STATUS_OPTIONS,
  createLocalQueuedLorBuilderAdapter,
  createLorBuilderQueueState,
  createRotationLorState,
  deriveLorState,
  rotationLorIndicator,
  rotationLorStatus,
  setRotationLorStatus
} from "./uxr-002/rotation-lor.js";
import {
  PINNED_ROTATION_SPECIALTIES,
  normalizeSpecialtyId,
  rankSpecialtyMatches,
  specialtyOption
} from "./uxr-002/specialty-taxonomy.js";
import {
  activeSpecialtyVariant,
  applyActiveSpecialtyVariant,
  createSpecialtyVariant,
  ensureSpecialtyVariants,
  normalizeSpecialtyVariants,
  removeSpecialtyVariant,
  renameSpecialtyVariant,
  setVariantEventHidden,
  setVariantInterviewTarget,
  switchSpecialtyVariant
} from "./uxr-002/specialty-variants.js";
import {
  EXPLANATION_TEXT_MAX,
  createExplanation,
  deleteExplanation,
  isExplanationEvent,
  moveExplanation,
  resizeExplanation,
  updateExplanation
} from "./uxr-002/explanation.js";
import {
  createUnavailableMatrixCalendarAdapter
} from "./uxr-002/matrix-calendar-adapter.js";
import {
  createLocalEntitlementAdapter,
  createProductionEntitlementBoundaryAdapter,
  entitlementStatusMarkup,
  evaluateTimelineEntitlement,
  localEntitlementScenarioFromLocation
} from "./uxr-002/entitlement.js";
import {parseMonth,uid} from "./uxr-002/utils.js";

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

function canonicalExamProfileValue(document,system,examId){
  const attempts=(document?.exams||[])
    .filter((record)=>
      record?.system===system&&record?.examId===examId
    )
    .slice()
    .sort((left,right)=>
      (Number(right.attempt)||1)-(Number(left.attempt)||1)
    );
  const record=attempts.find((attempt)=>
    String(attempt.score||attempt.result||"").trim()
  );
  return record
    ?String(record.score||record.result||"").trim()
    :"";
}

function activeTargetSpecialty(document){
  const variant=activeSpecialtyVariant(document);
  if(variant?.specialty?.id){
    return{
      id:String(variant.specialty.id),
      label:String(variant.specialty.label||"")
    };
  }
  const label=String(
    document?.builder?.targetSpecialtyLabel||
    document?.studentProfile?.specialtyGoal||
    ""
  ).trim();
  const id=String(
    document?.builder?.targetSpecialtyId||
    normalizeSpecialtyId(label)
  ).trim();
  return{id,label};
}

function rotationSpecialtyReference(event){
  const label=String(event?.fields?.specialty||"").trim();
  const id=String(
    event?.fields?.specialtyId||
    normalizeSpecialtyId(label)
  ).trim();
  return{id,label};
}

function lorTargetForRotation(document,event,preferredId=""){
  const active=activeTargetSpecialty(document);
  if(active.id)return active;
  const rotation=rotationSpecialtyReference(event);
  const id=String(preferredId||rotation.id).trim();
  return{
    id,
    label:id===rotation.id
      ?rotation.label
      :(active.label||rotation.label||id)
  };
}

function rotationLorStateFromDocument(document){
  const records=[...(document?.rotationLor?.records||[])];
  for(const event of document?.events||[]){
    if(event?.categoryId!=="clinical")continue;
    const rotationId=String(
      event?.fields?.builderEntryId||event?.id||""
    );
    if(!rotationId)continue;
    const byTarget=event?.fields?.lorStatusesByTarget||{};
    for(const [targetSpecialtyId,status] of Object.entries(byTarget)){
      records.push({rotationId,targetSpecialtyId,status});
    }
    if(
      event?.fields?.lorTargetSpecialtyId&&
      event?.fields?.lorStatus
    ){
      records.push({
        rotationId,
        targetSpecialtyId:event.fields.lorTargetSpecialtyId,
        status:event.fields.lorStatus
      });
    }
  }
  return createRotationLorState(records);
}

export function timelineWithLorPresentation(document){
  const projected=applyActiveSpecialtyVariant(document);
  const target=activeTargetSpecialty(projected);
  if(!target.id)return projected;
  const lorState=rotationLorStateFromDocument(projected);
  return{
    ...projected,
    events:(projected?.events||[]).map((event)=>{
      if(event?.categoryId!=="clinical")return event;
      const rotationId=String(
        event?.fields?.builderEntryId||event?.id||""
      );
      if(!rotationId)return event;
      const indicator=rotationLorIndicator(lorState,{
        rotationId,
        selectedTargetSpecialtyId:target.id
      });
      const fields={...(event.fields||{})};
      if(indicator.visible){
        fields.lorSubmitted=true;
        fields.lorSubmittedTargetSpecialtyId=target.id;
      }else{
        delete fields.lorSubmitted;
        delete fields.lorSubmittedTargetSpecialtyId;
      }
      return{...event,fields};
    })
  };
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
  const targetSpecialty=activeTargetSpecialty(document);
  const authorization=normalizeWorkAuthorization(profile);
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
    visa:authorization.currentUsWorkAuthorization||state.profile.visa,
    goal:targetSpecialty.label||profile.specialtyGoal||state.profile.goal,
    s1:canonicalExamProfileValue(document,"USMLE","step-1"),
    s2:canonicalExamProfileValue(document,"USMLE","step-2-ck")
  };
  state.sticky=document.metadata?.stickyNote??state.sticky;
  state.media=clone(document.metadata?.boardMedia||state.media);
  state.wiz={
    ...state.wiz,
    ...clone(document.metadata?.wizard407F||{}),
    school:profile.medicalSchool||state.wiz?.school||"",
    country:profile.medicalSchoolCountry||state.wiz?.country||"",
    canonicalSchoolId:
      profile.canonicalSchoolId||state.wiz?.canonicalSchoolId||"",
    schoolRecord:clone(
      profile.medicalSchoolRecord||state.wiz?.schoolRecord||null
    ),
    schoolEntryMode:
      profile.medicalSchoolEntryMode||state.wiz?.schoolEntryMode||"registry",
    schoolVerificationStatus:
      profile.medicalSchoolVerificationStatus||
      state.wiz?.schoolVerificationStatus||
      "",
    schoolNormalizationStatus:
      profile.medicalSchoolNormalizationStatus||
      state.wiz?.schoolNormalizationStatus||
      "",
    schoolAnalyticsEligible:
      profile.medicalSchoolAnalyticsEligible===true,
    schoolUnlistedSubmission:clone(
      profile.medicalSchoolUnlistedSubmission||
      state.wiz?.schoolUnlistedSubmission||
      null
    ),
    schoolCity:profile.medicalSchoolCity||state.wiz?.schoolCity||"",
    visa:
      authorization.currentUsWorkAuthorization||
      state.wiz?.visa||
      "",
    visaOther:
      profile.workAuthorizationOther||state.wiz?.visaOther||"",
    eadStatus:profile.eadStatus||state.wiz?.eadStatus||"",
    residencyVisaTypesOpenTo:
      authorization.residencyVisaTypesOpenTo||
      state.wiz?.residencyVisaTypesOpenTo||
      ""
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
    canonicalSchoolId:state.wiz?.canonicalSchoolId||"",
    medicalSchoolRecord:clone(state.wiz?.schoolRecord||null),
    medicalSchoolCountry:state.profile?.country||"",
    medicalSchoolEntryMode:state.wiz?.schoolEntryMode||"registry",
    medicalSchoolVerificationStatus:
      state.wiz?.schoolVerificationStatus||"",
    medicalSchoolNormalizationStatus:
      state.wiz?.schoolNormalizationStatus||"",
    medicalSchoolAnalyticsEligible:
      state.wiz?.schoolAnalyticsEligible===true,
    medicalSchoolUnlistedSubmission:clone(
      state.wiz?.schoolUnlistedSubmission||null
    ),
    medicalSchoolCity:state.wiz?.schoolCity||"",
    graduationDate:state.wiz?.grad||"",
    graduationExpected:!!state.wiz?.notGraduated,
    degree:state.wiz?.degree||"",
    degreeOther:state.wiz?.degreeOther||"",
    visaStatus:state.wiz?.visa||state.profile?.visa||"",
    currentUsWorkAuthorization:
      state.wiz?.visa||state.profile?.visa||"",
    workAuthorizationOther:state.wiz?.visaOther||"",
    eadStatus:state.wiz?.eadStatus||"",
    residencyVisaTypesOpenTo:
      state.wiz?.residencyVisaTypesOpenTo||"",
    specialtyGoal:state.profile?.goal||""
  };
  document.medicalSchoolNormalizationQueue=Array.isArray(
    document.medicalSchoolNormalizationQueue
  )?document.medicalSchoolNormalizationQueue:[];
  const schoolRecord=document.studentProfile.medicalSchoolRecord;
  if(schoolRecord?.canonical_school_id){
    const normalizationStatus=schoolRecord.normalization_status||
      (schoolRecord.analytics_eligible===true?"normalized":"review-needed");
    const queueIndex=document.medicalSchoolNormalizationQueue.findIndex(
      (item)=>item?.canonical_school_id===schoolRecord.canonical_school_id
    );
    if(normalizationStatus==="normalized"){
      if(queueIndex>=0){
        document.medicalSchoolNormalizationQueue.splice(queueIndex,1);
      }
    }else{
      const queuedRecord={
        ...clone(schoolRecord),
        normalization_status:normalizationStatus,
        queue_status:"pending-local-review",
        analytics_eligible:false
      };
      if(queueIndex>=0){
        document.medicalSchoolNormalizationQueue[queueIndex]=queuedRecord;
      }else{
        document.medicalSchoolNormalizationQueue.push(queuedRecord);
      }
    }
  }
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
    builder407F:clone(state.builder||{})
  };
  delete document.metadata.step1Score;
  delete document.metadata.step2Score;
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

let boardSvgInstance=0;

export function namespaceBoardSvg(svg,namespace){
  const prefix=String(namespace||`d1404-board-${++boardSvgInstance}`)
    .replace(/[^a-zA-Z0-9_-]+/g,"-");
  const ids=new Map();
  let result=String(svg||"").replace(
    /(^|[\s<])id="([^"]+)"/g,
    (match,prefixToken,id)=>{
    const next=`${prefix}-${id}`;
    ids.set(id,next);
    return`${prefixToken}id="${next}"`;
    }
  );
  if(!ids.size)return result;
  result=result
    .replace(/url\(#([^)]+)\)/g,(match,id)=>ids.has(id)?`url(#${ids.get(id)})`:match)
    .replace(/\baria-labelledby="([^"]+)"/g,(match,value)=>{
      const next=value.split(/\s+/).map((id)=>ids.get(id)||id).join(" ");
      return`aria-labelledby="${next}"`;
    })
    .replace(/\b(?:href|xlink:href)="#([^"]+)"/g,(match,id)=>{
      if(!ids.has(id))return match;
      return match.replace(`#${id}`,`#${ids.get(id)}`);
    });
  return result;
}

function render407FThemedBoard(document,options={}){
  const timeline=timelineWithLorPresentation(document);
  const base=renderKeynoteClassicBoard(timeline,options);
  const themeId=document?.theme||DEFAULT_THEME_ID;
  const rendered=themeId===DEFAULT_THEME_ID
    ?base
    :applyThemeToTimelineRender(base,themeId,{
      serializeScene:serializeKeynoteClassicSvg
    });
  return{
    ...rendered,
    svg:namespaceBoardSvg(rendered.svg,options.idNamespace)
  };
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
    revoke(id){
      const key=String(id);
      const prior=urls.get(key);
      if(prior)URL.revokeObjectURL(prior);
      urls.delete(key);
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

const CANVAS_EXPORT_AUDIENCE_OPTIONS=Object.freeze([
  Object.freeze({id:"LOR_WRITER",label:"LOR writers"}),
  Object.freeze({id:"PROFESSIONAL_CONNECTION",label:"Professional connections"}),
  Object.freeze({id:"MISSION_RESIDENCY_ALUMNI",label:"Mission Residency alumni connections"})
]);

function renderCanvasDetails(route,event,document){
  const domain=event.fields?.builderDomain||event.categoryId||"personal";
  const detailFields=CANVAS_DETAIL_FIELDS[domain]||[];
  const isMilestone=event.eventType==="milestone";
  const clinical=domain==="clinical";
  const variant=activeSpecialtyVariant(document||{});
  const visibleInVariant=!variant.hiddenEventIds.includes(String(event.id));
  const exportAudiences=new Set(
    Array.isArray(event.fields?.exportAudiences)
      ?event.fields.exportAudiences.map((value)=>String(value).toUpperCase())
      :[]
  );
  const startDateControl=clinical
    ?exactDateFieldMarkup({
      id:`canvas-${event.id}-rotation-start`,
      label:"Start date",
      value:event.fields?.rotationStartDate||"",
      required:true,
      help:event.fields?.rotationDatePrecision==="month-legacy"
        ?`Legacy month ${event.startDate} — choose the exact day before saving.`
        :"Exact day required.",
      inputAttributes:{"data-canvas-rotation-date":"rotationStartDate"}
    })
    :monthFieldMarkup({
      id:`canvas-${event.id}-start`,
      label:"Start",
      value:event.startDate,
      inputAttributes:{"data-canvas-detail-key":"startDate"}
    });
  const endDateControl=isMilestone
    ?""
    :clinical
      ?exactDateFieldMarkup({
        id:`canvas-${event.id}-rotation-end`,
        label:"End date",
        value:event.fields?.rotationEndDate||"",
        required:!event.openEnded,
        disabled:event.openEnded,
        help:event.openEnded
          ?"Current rotation."
          :event.fields?.rotationDatePrecision==="month-legacy"
            ?`Legacy month ${event.endDate||""} — choose the exact day before saving.`
            :"Exact day required.",
        inputAttributes:{"data-canvas-rotation-date":"rotationEndDate"}
      })
      :monthFieldMarkup({
        id:`canvas-${event.id}-end`,
        label:"End",
        value:event.endDate||"",
        inputAttributes:{"data-canvas-detail-key":"endDate"}
      });
  return `<div class="canvas407FDetails" data-canvas-details-form data-event-id="${escapeMarkup(event.id)}">
    <div class="canvas407FDetailGrid">
      <label class="canvas407FDetailField canvas407FDetailWide"><span>Title</span><input type="text" data-canvas-detail-key="title" value="${escapeMarkup(event.title)}"></label>
      <label class="canvas407FDetailField"><span>Category</span><select data-canvas-detail-key="categoryId">${Object.keys(CATEGORY_TO_407F).map((category)=>`<option value="${category}" ${event.categoryId===category?"selected":""}>${escapeMarkup(category[0].toUpperCase()+category.slice(1))}</option>`).join("")}</select></label>
      ${startDateControl}
      ${endDateControl}
      <label class="canvas407FDetailField"><span>Visibility</span><select data-canvas-detail-key="visibilityState">
        <option value="INTERVIEWER_SAFE" ${event.visibilityState==="INTERVIEWER_SAFE"?"selected":""}>Show everyone</option>
        <option value="ADVISOR_ONLY" ${event.visibilityState==="ADVISOR_ONLY"?"selected":""}>Advisor only</option>
      </select></label>
      <fieldset class="canvas407FRecipientSharing canvas407FDetailWide">
        <legend>Recipient sharing</legend>
        <p>For advisor-only items, choose which export audiences may receive this item.</p>
        ${CANVAS_EXPORT_AUDIENCE_OPTIONS.map(({id,label})=>`<label class="canvas407FDetailCheck"><input type="checkbox" data-canvas-export-audience="${id}" ${exportAudiences.has(id)?"checked":""}> <span>${escapeMarkup(label)}</span></label>`).join("")}
      </fieldset>
      <label class="canvas407FDetailCheck canvas407FDetailWide"><input type="checkbox" data-canvas-variant-visible ${visibleInVariant?"checked":""}> <span>Show in ${escapeMarkup(variant.name)}</span></label>
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
  const explicitMode=String(window.D1_TIMELINE_RUNTIME_MODE||"").toLowerCase();
  const localHost=["localhost","127.0.0.1","0.0.0.0"].includes(
    String(window.location?.hostname||"").toLowerCase()
  );
  const runtimeMode=localHost&&explicitMode!=="production"
    ?"local"
    :"production";
  const entitlementAdapter=runtimeMode==="production"
    ?createProductionEntitlementBoundaryAdapter()
    :window.D1_TIMELINE_ENTITLEMENT_ADAPTER||
      createLocalEntitlementAdapter({
        scenario:localEntitlementScenarioFromLocation(window.location)||
          "eligible-360",
        currentUsage:init.restored?1:0
      });
  let entitlementAssertion;
  try{
    entitlementAssertion=await entitlementAdapter.resolve();
  }catch(error){
    entitlementAssertion={
      verified:false,
      enabled:false,
      eligible:false,
      allowance:0,
      currentUsage:0,
      source:"entitlement-adapter-error",
      reason:"Timeline entitlement could not be verified.",
      administratorReason:String(error?.message||error)
    };
  }
  const entitlement=evaluateTimelineEntitlement(entitlementAssertion,{
    mode:runtimeMode,
    hasExistingTimeline:init.restored,
    expectedBinding:entitlementAdapter.expectedBinding||null
  });
  store.setEntitlement(entitlement);
  const runtimeDatasets=createRuntimeDatasets();
  const lorBuilderAdapter=createLocalQueuedLorBuilderAdapter();
  const mediaUrls=createObjectUrlRegistry();
  const matrixCalendarAdapter=createUnavailableMatrixCalendarAdapter();
  const matrixCalendarState=await matrixCalendarAdapter
    .listScheduledInterviews();
  const advancedBoardRenderer=createAdvancedBoardRenderer({
    baseRenderer:render407FThemedBoard,
    resolveObjectUrl:(id)=>mediaUrls.get(id)
  });
  const renderResponsiveAdvancedBoard=(document,options={})=>
    advancedBoardRenderer(timelineWithLorPresentation(document),{
      ...options,
      reducedMotion:window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      )?.matches
    });
  const exportAdapter=createLocalExportAdapter({
    resolveObjectUrl:(id)=>mediaUrls.get(id)
  });
  let exportState=normalizeExportState(store.document.exportState||{
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
  let exportRenderFocusSelector=null;
  let approvalReconciling=false;
  let advisorCleanup=()=>{};
  let advisorEditingCommentId=null;
  let advisorHighlightTimer=null;
  let intakeCleanup=()=>{};
  let intakeMachine=null;
  let canvasSyncing=false;
  let unsubscribeStore=()=>{};
  let onCanvasDetailsClick=()=>{};
  let onAdvancedObjectClick=()=>{};
  let onCanvasResize=()=>{};
  let on407FRendered=()=>{};
  let onAdvisorHashChange=()=>{};
  let onGlobalKeydown=()=>{};
  let onBuilderPreview=()=>{};
  let onBuilderPreviewInteraction=()=>{};
  let onBuilderPreviewFocus=()=>{};
  let onBuilderPreviewResize=()=>{};
  let onBuilderPreviewBackdrop=()=>{};
  let onHomeFileVault=()=>{};
  let onMediaLibraryClick=()=>{};
  let onMediaLibraryChange=()=>{};
  let onMediaLibraryDragStart=()=>{};
  let onMediaLibraryDragOver=()=>{};
  let onMediaLibraryDragLeave=()=>{};
  let onMediaLibraryDragEnd=()=>{};
  let onMediaLibraryDrop=()=>{};
  let onSpecialtyVariantClick=()=>{};
  let onSpecialtyVariantChange=()=>{};
  let onSpecialtyVariantBackdrop=()=>{};
  let onM9BuilderClick=()=>{};
  let onM9BuilderChange=()=>{};
  let onEntitlementCapture=()=>{};
  let renderM9BuilderSurfaces=()=>{};
  let onRouteRendered=()=>{};
  let responsiveRuntime=null;
  let shortcutTrap=null;
  let fileVaultTrap=null;
  let builderPreviewTrap=null;
  let specialtyVariantTrap=null;
  let exportThemeTrap=null;
  let exportThemeOpener=null;
  let entitlementObserver=null;
  let entitlementObserverQueued=false;
  let onExportThemeBackdrop=()=>{};
  let specialtyVariantOpener=null;
  let builderPreviewZoom=createCanvasZoom("fit");
  let builderPreviewOpener=null;
  let mediaDrawerOpener=null;
  let builderPreviewRenderQueued=false;
  let lastFocusedView=null;
  let lastState=stableState(bridge.state);
  const watchedEvents=["input","change","click","pointerup","blur"];

  if(!init.restored&&entitlement.canCreate){
    store.mutate(
      "Seed canonical 407F document",
      (document)=>apply407FStateToDocument(bridge.state,document),
      {history:false}
    );
  }
  if(entitlement.canMutate&&(init.restored||entitlement.canCreate)){
    store.mutate(
      "Normalize canonical exam workflow",
      (document)=>normalizeExamDocument(document),
      {history:false,material:false}
    );
    store.mutate(
      "Normalize specialty timeline variants",
      (document)=>ensureSpecialtyVariants(document),
      {history:false,material:false}
    );
    if(!init.restored&&entitlement.canCreate){
      await store.saveNow("INITIAL_DURABLE_DRAFT");
    }
  }
  applying=true;
  applyDocumentTo407FState(store.document,bridge.state);
  bridge.renderAll();
  lastState=stableState(bridge.state);
  applying=false;

  let pending=false;
  const entitlementViewControl=(control)=>control?.matches?.([
    "[data-nav]",
    "[data-builder-preview-open]",
    "[data-builder-preview-close]",
    "[data-builder-preview-zoom]",
    "[data-open-media-library]",
    "[data-close-media-library]",
    "[data-canvas-zoom]",
    "[data-history-menu]",
    '[data-canvas-action="history"]',
    '[data-canvas-action="close-history"]',
    '[data-canvas-action="theme"]',
    '[data-canvas-action="comments"]'
  ].join(","));
  const applyEntitlementSurface=()=>{
    const access=store.entitlement;
    const status=entitlementStatusMarkup(access);
    const focusedBefore=document.activeElement;
    const badge=document.getElementById("entitlement407F");
    if(badge){
      badge.className=`entitlement407F is-${status.tone}`;
      badge.dataset.access=access.access;
      badge.innerHTML=`<span>${escapeMarkup(status.label)}</span><small>${escapeMarkup(status.allowance)}</small>`;
      badge.title=status.reason;
    }
    let banner=document.getElementById("entitlementBanner407F");
    const restoringFromBanner=
      access.access==="FULL"&&
      focusedBefore===banner;
    if(access.access==="FULL"){
      banner?.remove();
    }else{
      if(!banner){
        banner=document.createElement("div");
        banner.id="entitlementBanner407F";
        banner.className="entitlementBanner407F";
        banner.setAttribute("role","status");
        banner.tabIndex=-1;
        document.querySelector("main")?.prepend(banner);
      }
      const consequence=access.access==="DENIED"
        ?"Timeline creation and export are disabled."
        :"Your saved timeline remains available; editing and export are disabled.";
      const bannerMarkup=`<strong>${escapeMarkup(status.label)}</strong><span>${escapeMarkup(status.reason)} ${escapeMarkup(consequence)}</span>`;
      if(banner.innerHTML!==bannerMarkup)banner.innerHTML=bannerMarkup;
    }
    const main=document.querySelector("main");
    main?.classList.toggle("isEntitlementReadOnly",access.canMutate!==true);
    main?.setAttribute("data-entitlement-access",access.access);
    if(access.canMutate!==true){
      main?.querySelectorAll("button,input,select,textarea").forEach((control)=>{
        if(entitlementViewControl(control))return;
        if(!Object.hasOwn(control.dataset,"entitlementWasDisabled")){
          control.dataset.entitlementWasDisabled=String(control.disabled);
        }
        control.disabled=true;
        control.setAttribute("aria-disabled","true");
        if(!control.title){
          control.title=status.reason;
          control.dataset.entitlementTitle="true";
        }
      });
      main?.querySelectorAll("[contenteditable],[draggable='true']").forEach((control)=>{
        control.dataset.entitlementContenteditable=
          control.getAttribute("contenteditable")??"__absent__";
        control.dataset.entitlementDraggable=
          control.getAttribute("draggable")??"__absent__";
        control.setAttribute("aria-disabled","true");
        control.removeAttribute("contenteditable");
        control.setAttribute("draggable","false");
      });
      if(
        focusedBefore instanceof HTMLElement&&
        main?.contains(focusedBefore)&&
        (
          focusedBefore.matches("input,select,textarea,[contenteditable],[draggable='true']")||
          (focusedBefore.matches("button")&&!entitlementViewControl(focusedBefore))
        )
      ){
        banner?.focus({preventScroll:true});
      }
    }else{
      main?.querySelectorAll("[data-entitlement-was-disabled]").forEach((control)=>{
        control.disabled=control.dataset.entitlementWasDisabled==="true";
        if(control.dataset.entitlementWasDisabled!=="true"){
          control.removeAttribute("aria-disabled");
        }
        if(control.dataset.entitlementTitle==="true")control.removeAttribute("title");
        delete control.dataset.entitlementWasDisabled;
        delete control.dataset.entitlementTitle;
      });
      main?.querySelectorAll("[data-entitlement-contenteditable]").forEach((control)=>{
        const contenteditable=control.dataset.entitlementContenteditable;
        const draggable=control.dataset.entitlementDraggable;
        if(contenteditable==="__absent__")control.removeAttribute("contenteditable");
        else control.setAttribute("contenteditable",contenteditable);
        if(draggable==="__absent__")control.removeAttribute("draggable");
        else control.setAttribute("draggable",draggable);
        control.removeAttribute("aria-disabled");
        delete control.dataset.entitlementContenteditable;
        delete control.dataset.entitlementDraggable;
      });
      if(restoringFromBanner){
        const focusTarget=
          main?.querySelector("section.live h1,section.live h2")||
          main?.querySelector("[data-screen] h1,[data-screen] h2")||
          document.querySelector('[data-nav][aria-current="page"]');
        if(focusTarget instanceof HTMLElement){
          if(!focusTarget.hasAttribute("tabindex"))focusTarget.tabIndex=-1;
          queueMicrotask(()=>focusTarget.focus({preventScroll:true}));
        }
      }
    }
    const exportButton=document.getElementById("hudExport");
    if(exportButton&&access.canExport!==true){
      if(!Object.hasOwn(exportButton.dataset,"entitlementWasDisabled")){
        exportButton.dataset.entitlementWasDisabled=String(exportButton.disabled);
      }
      exportButton.disabled=true;
      exportButton.setAttribute("aria-disabled","true");
      exportButton.title=status.reason;
    }else if(exportButton?.dataset.entitlementWasDisabled!=null){
      exportButton.disabled=exportButton.dataset.entitlementWasDisabled==="true";
      if(!exportButton.disabled)exportButton.removeAttribute("aria-disabled");
      delete exportButton.dataset.entitlementWasDisabled;
    }
  };
  onEntitlementCapture=(event)=>{
    if(store.entitlement.canMutate===true)return;
    const target=event.target?.closest?.(
      "main button, main input, main select, main textarea, main [contenteditable], main [draggable='true']"
    );
    if(!target||entitlementViewControl(target))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    applying=true;
    applyDocumentTo407FState(store.document,bridge.state);
    bridge.renderAll();
    lastState=stableState(bridge.state);
    applying=false;
    applyEntitlementSurface();
    bridge.toast(store.entitlement.reason);
  };
  for(const eventName of ["click","input","change","drop"]){
    document.addEventListener(eventName,onEntitlementCapture,true);
  }
  entitlementObserver=new MutationObserver(()=>{
    if(
      store.entitlement.canMutate===true||
      entitlementObserverQueued
    )return;
    entitlementObserverQueued=true;
    requestAnimationFrame(()=>{
      entitlementObserverQueued=false;
      applyEntitlementSurface();
    });
  });
  const entitlementMain=document.querySelector("main");
  if(entitlementMain){
    entitlementObserver.observe(entitlementMain,{childList:true,subtree:true});
  }
  applyEntitlementSurface();

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
      if(store.entitlement.canMutate===true){
        store.mutate(
          "407F canonical UI change",
          (document)=>apply407FStateToDocument(bridge.state,document)
        );
      }else{
        applying=true;
        applyDocumentTo407FState(store.document,bridge.state);
        bridge.renderAll();
        lastState=stableState(bridge.state);
        applying=false;
        applyEntitlementSurface();
      }
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
    if(nextState!==lastState&&store.entitlement.canMutate===true){
      lastState=nextState;
      store.mutate(
        "407F page exit",
        (document)=>apply407FStateToDocument(bridge.state,document)
      );
    }
    canvasController?.destroy();
    removeAdvanced();
    exportController?.destroy();
    advisorCleanup();
    clearTimeout(advisorHighlightTimer);
    intakeCleanup();
    mediaUrls.revokeAll();
    unsubscribeStore();
    entitlementObserver?.disconnect();
    for(const eventName of ["click","input","change","drop"]){
      document.removeEventListener(eventName,onEntitlementCapture,true);
    }
    document.getElementById("canvas407F")?.removeEventListener("click",onCanvasDetailsClick);
    document.getElementById("canvas407F")?.removeEventListener("click",onAdvancedObjectClick);
    window.removeEventListener("resize",onCanvasResize);
    document.removeEventListener("d1:407f-rendered",on407FRendered);
    document.removeEventListener("d1:407f-rendered",onRouteRendered);
    window.removeEventListener("hashchange",onAdvisorHashChange);
    document.removeEventListener("keydown",onGlobalKeydown);
    document.removeEventListener("click",onBuilderPreviewInteraction);
    document.removeEventListener("keydown",onBuilderPreviewInteraction);
    document.removeEventListener("focusin",onBuilderPreviewFocus);
    window.removeEventListener("resize",onBuilderPreviewResize);
    document.getElementById("modalBk")?.removeEventListener(
      "click",
      onBuilderPreviewBackdrop,
      true
    );
    document.removeEventListener("click",onM9BuilderClick);
    document.removeEventListener("change",onM9BuilderChange);
    document.getElementById("builderPreviewToggle")?.removeEventListener("click",onBuilderPreview);
    document.getElementById("homeFileVault")?.removeEventListener("click",onHomeFileVault);
    document.removeEventListener("click",onMediaLibraryClick);
    document.removeEventListener("change",onMediaLibraryChange);
    document.removeEventListener("dragstart",onMediaLibraryDragStart);
    document.removeEventListener("dragover",onMediaLibraryDragOver);
    document.removeEventListener("dragleave",onMediaLibraryDragLeave);
    document.removeEventListener("dragend",onMediaLibraryDragEnd);
    document.removeEventListener("drop",onMediaLibraryDrop);
    document.removeEventListener("click",onSpecialtyVariantClick);
    document.removeEventListener("change",onSpecialtyVariantChange);
    document.getElementById("modalBk")?.removeEventListener(
      "click",
      onSpecialtyVariantBackdrop,
      true
    );
    responsiveRuntime?.destroy();
    shortcutTrap?.destroy();
    fileVaultTrap?.destroy();
    builderPreviewTrap?.destroy();
    specialtyVariantTrap?.destroy();
    exportThemeTrap?.destroy();
    document.getElementById("modalBk")?.removeEventListener(
      "click",
      onExportThemeBackdrop,
      true
    );
    store.saveNow("PAGE_EXIT").catch(()=>{});
  },{once:true});

  const api={
    store,
    entitlement:store.entitlement,
    entitlementAdapter,
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
  const dispatchDateCommit=(precision,id,value,input)=>{
    input.dataset.dateCanonical=value;
    input.dispatchEvent(new CustomEvent("d1:date-commit",{
      bubbles:true,
      detail:Object.freeze({precision,id,value})
    }));
  };
  api.dateControls=Object.freeze({
    parseExact(value){
      return parseExactDate(value)||"";
    },
    markup(options={}){
      return options.precision==="day"
        ?exactDateFieldMarkup(options)
        :monthFieldMarkup(options);
    },
    install(root=document){
      installMonthFields(root,{
        onCommit:(id,value,input)=>
          dispatchDateCommit("month",id,value,input)
      });
      installExactDateFields(root,{
        onCommit:(id,value,input)=>
          dispatchDateCommit("day",id,value,input)
      });
    }
  });
  const renderSpecialtyVariantBar=()=>{
    const host=document.getElementById("builderVariantBarContent");
    if(!host)return;
    const state=normalizeSpecialtyVariants(store.document);
    const active=state.variants.find(
      (variant)=>variant.id===state.activeVariantId
    )||state.variants[0];
    host.innerHTML=`<div class="builderVariantIdentity">
      <span class="builderVariantSignal" aria-hidden="true"></span>
      <div>
        <div class="builderVariantEyebrow" id="builderVariantBarTitle">ACTIVE SPECIALTY TIMELINE</div>
        <strong class="builderVariantName">${escapeMarkup(active.name)}</strong>
        <span class="builderVariantSpecialty">${escapeMarkup(active.specialty.label||"Choose a target specialty")}</span>
      </div>
    </div>
    <div class="builderVariantControls">
      <label class="srOnly407F" for="builderSpecialtyVariantSelect">Active specialty timeline</label>
      <select class="builderVariantSelect" id="builderSpecialtyVariantSelect" data-specialty-variant-select>
        ${state.variants.map((variant)=>`<option value="${escapeMarkup(variant.id)}" ${variant.id===active.id?"selected":""}>${escapeMarkup(variant.name)}</option>`).join("")}
      </select>
      <button type="button" class="btnD alt sm builderVariantManage" data-specialty-variant-new>+ NEW SPECIALTY TIMELINE</button>
      <button type="button" class="btnD alt sm builderVariantManage" data-specialty-variant-rename>RENAME</button>
      <button type="button" class="homeTertiary builderVariantManage" data-specialty-variant-remove ${state.variants.length<=1?"disabled":""}>REMOVE</button>
    </div>`;
  };
  const refreshSpecialtyVariantSurfaces=({restoreSelectFocus=false}={})=>{
    syncBridgeFromStore();
    queueBuilderEmbeddedPreview({force:true});
    if(bridge.state.view==="export")queueExportRender();
    if(restoreSelectFocus){
      queueMicrotask(()=>
        document.querySelector("[data-specialty-variant-select]")?.focus()
      );
    }
  };
  const closeSpecialtyVariantDialog=({restoreFocus=true}={})=>{
    const trap=specialtyVariantTrap;
    specialtyVariantTrap=null;
    trap?.destroy();
    document.getElementById("modalBk")?.removeEventListener(
      "click",
      onSpecialtyVariantBackdrop,
      true
    );
    bridge.closeModal?.();
    previewBackgroundInert(false);
    if(restoreFocus){
      specialtyVariantOpener?.focus?.();
    }
    specialtyVariantOpener=null;
  };
  const activateSpecialtyVariantDialog=(dialog,{initialFocus=true}={})=>{
    if(!dialog)return;
    specialtyVariantTrap?.destroy();
    specialtyVariantTrap=installFocusTrap(dialog,{
      opener:specialtyVariantOpener,
      restoreFocus:false,
      initialFocus,
      onEscape:()=>closeSpecialtyVariantDialog()
    });
    onSpecialtyVariantBackdrop=(event)=>{
      if(event.target?.id!=="modalBk")return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeSpecialtyVariantDialog();
    };
    document.getElementById("modalBk")?.addEventListener(
      "click",
      onSpecialtyVariantBackdrop,
      true
    );
    previewBackgroundInert(true);
  };
  const openCreateSpecialtyVariant=()=>{
    specialtyVariantOpener=document.activeElement;
    const existing=new Set(
      normalizeSpecialtyVariants(store.document).variants
        .map((variant)=>variant.specialty.id)
    );
    const choices=PINNED_ROTATION_SPECIALTIES
      .map((label)=>specialtyOption(label))
      .filter((option)=>!existing.has(option.id));
    bridge.openModal?.(`<section class="specialtyVariantDialog" role="dialog" aria-modal="true" aria-labelledby="specialtyVariantCreateTitle" data-specialty-variant-dialog>
      <div>
        <div class="builderVariantEyebrow">SPECIALTY-SPECIFIC PRESENTATION</div>
        <h2 id="specialtyVariantCreateTitle">New specialty timeline</h2>
      </div>
      <p>Your factual history stays shared. This adds a presentation, LOR, visibility, and interview-target configuration for another specialty.</p>
      <label>Target specialty
        <select data-specialty-variant-specialty>
          <option value="">Choose a specialty…</option>
          ${choices.map((option)=>`<option value="${escapeMarkup(option.id)}" data-label="${escapeMarkup(option.label)}">${escapeMarkup(option.label)}</option>`).join("")}
        </select>
      </label>
      <label>Timeline name
        <input type="text" maxlength="80" data-specialty-variant-name placeholder="Internal Medicine timeline">
      </label>
      <div class="specialtyVariantDialogActions">
        <button type="button" class="btnD alt" data-specialty-variant-cancel>Cancel</button>
        <button type="button" class="btnD go" data-specialty-variant-create>Create timeline</button>
      </div>
    </section>`);
    const dialog=document.querySelector("[data-specialty-variant-dialog]");
    const specialty=dialog?.querySelector("[data-specialty-variant-specialty]");
    const name=dialog?.querySelector("[data-specialty-variant-name]");
    activateSpecialtyVariantDialog(dialog,{initialFocus:false});
    specialty?.addEventListener("change",()=>{
      const label=specialty.selectedOptions?.[0]?.dataset?.label||"";
      if(name&&!name.value.trim())name.value=label?`${label} timeline`:"";
    });
    dialog?.querySelector("[data-specialty-variant-cancel]")?.addEventListener(
      "click",
      closeSpecialtyVariantDialog,
      {once:true}
    );
    dialog?.querySelector("[data-specialty-variant-create]")?.addEventListener("click",()=>{
      const selected=specialty?.selectedOptions?.[0];
      let result={ok:false,message:"Choose a specialty."};
      store.mutate("Create specialty timeline",(document)=>{
        result=createSpecialtyVariant(document,{
          specialtyId:specialty?.value||"",
          specialtyLabel:selected?.dataset?.label||"",
          name:name?.value||""
        });
      });
      if(!result.ok){
        bridge.toast(result.message||"Choose a specialty.");
        specialty?.focus();
        return;
      }
      closeSpecialtyVariantDialog({restoreFocus:false});
      refreshSpecialtyVariantSurfaces({restoreSelectFocus:true});
      bridge.toast(`${result.variant.name} created`);
      announceGlobal(`${result.variant.name} is now active`);
    });
    specialty?.focus();
  };
  const openRenameSpecialtyVariant=()=>{
    specialtyVariantOpener=document.activeElement;
    const active=activeSpecialtyVariant(store.document);
    bridge.openModal?.(`<section class="specialtyVariantDialog" role="dialog" aria-modal="true" aria-labelledby="specialtyVariantRenameTitle" data-specialty-variant-dialog>
      <div>
        <div class="builderVariantEyebrow">PRESENTATION NAME ONLY</div>
        <h2 id="specialtyVariantRenameTitle">Rename specialty timeline</h2>
      </div>
      <label>Timeline name
        <input type="text" maxlength="80" value="${escapeMarkup(active.name)}" data-specialty-variant-rename-name>
      </label>
      <div class="specialtyVariantDialogActions">
        <button type="button" class="btnD alt" data-specialty-variant-cancel>Cancel</button>
        <button type="button" class="btnD go" data-specialty-variant-rename-save>Save name</button>
      </div>
    </section>`);
    const dialog=document.querySelector("[data-specialty-variant-dialog]");
    const input=dialog?.querySelector("[data-specialty-variant-rename-name]");
    activateSpecialtyVariantDialog(dialog,{initialFocus:false});
    dialog?.querySelector("[data-specialty-variant-cancel]")?.addEventListener(
      "click",
      closeSpecialtyVariantDialog,
      {once:true}
    );
    dialog?.querySelector("[data-specialty-variant-rename-save]")?.addEventListener("click",()=>{
      let result={ok:false};
      store.mutate("Rename specialty timeline",(document)=>{
        result=renameSpecialtyVariant(document,active.id,input?.value||"");
      });
      if(!result.ok){
        bridge.toast("Enter a timeline name.");
        input?.focus();
        return;
      }
      closeSpecialtyVariantDialog({restoreFocus:false});
      refreshSpecialtyVariantSurfaces({restoreSelectFocus:true});
      bridge.toast("Specialty timeline renamed");
    });
    input?.focus();
    input?.select();
  };
  const openRemoveSpecialtyVariant=()=>{
    const state=normalizeSpecialtyVariants(store.document);
    const active=activeSpecialtyVariant(store.document);
    if(state.variants.length<=1){
      bridge.toast("Keep at least one specialty timeline.");
      return;
    }
    specialtyVariantOpener=document.activeElement;
    bridge.openModal?.(`<section class="specialtyVariantDialog" role="alertdialog" aria-modal="true" aria-labelledby="specialtyVariantRemoveTitle" aria-describedby="specialtyVariantRemoveDescription" data-specialty-variant-dialog>
      <div>
        <div class="builderVariantEyebrow">SAFE REMOVE</div>
        <h2 id="specialtyVariantRemoveTitle">Remove ${escapeMarkup(active.name)}?</h2>
      </div>
      <p class="specialtyVariantGuard" id="specialtyVariantRemoveDescription">Only this specialty’s presentation settings are removed. Shared factual events, source data, and other specialty timelines remain unchanged.</p>
      <div class="specialtyVariantDialogActions">
        <button type="button" class="btnD alt" data-specialty-variant-cancel>Keep timeline</button>
        <button type="button" class="btnD go" data-specialty-variant-remove-confirm>Remove configuration</button>
      </div>
    </section>`);
    const dialog=document.querySelector("[data-specialty-variant-dialog]");
    activateSpecialtyVariantDialog(dialog);
    dialog?.querySelector("[data-specialty-variant-cancel]")?.addEventListener(
      "click",
      closeSpecialtyVariantDialog,
      {once:true}
    );
    dialog?.querySelector("[data-specialty-variant-remove-confirm]")?.addEventListener("click",()=>{
      let result={ok:false};
      store.mutate("Remove specialty timeline",(document)=>{
        result=removeSpecialtyVariant(document,active.id,{confirmed:true});
      });
      if(!result.ok){
        bridge.toast(result.message||"Specialty timeline was not removed.");
        return;
      }
      closeSpecialtyVariantDialog({restoreFocus:false});
      refreshSpecialtyVariantSurfaces({restoreSelectFocus:true});
      bridge.toast(`${active.name} removed`);
      announceGlobal(`${result.active.name} is now active`);
    });
  };
  const syncBridgeFromStore=()=>{
    applying=true;
    applyDocumentTo407FState(store.document,bridge.state);
    bridge.renderAll();
    renderSpecialtyVariantBar();
    renderM9BuilderSurfaces();
    canvasController?.render();
    lastState=stableState(bridge.state);
    applying=false;
  };
  onSpecialtyVariantChange=(event)=>{
    const select=event.target.closest?.("[data-specialty-variant-select]");
    if(!select)return;
    store.mutate("Switch specialty timeline",(document)=>{
      switchSpecialtyVariant(document,select.value);
    });
    refreshSpecialtyVariantSurfaces({restoreSelectFocus:true});
    const active=activeSpecialtyVariant(store.document);
    bridge.toast(`${active.name} active`);
    announceGlobal(`${active.name} active`);
  };
  onSpecialtyVariantClick=(event)=>{
    if(event.target.closest?.("[data-specialty-variant-new]")){
      event.preventDefault();
      openCreateSpecialtyVariant();
      return;
    }
    if(event.target.closest?.("[data-specialty-variant-rename]")){
      event.preventDefault();
      openRenameSpecialtyVariant();
      return;
    }
    if(event.target.closest?.("[data-specialty-variant-remove]")){
      event.preventDefault();
      openRemoveSpecialtyVariant();
    }
  };
  document.addEventListener("change",onSpecialtyVariantChange);
  document.addEventListener("click",onSpecialtyVariantClick);
  renderSpecialtyVariantBar();
  const mediaItems=()=>store.document.advanced?.media||[];
  const mediaFocusState=()=>{
    const active=document.activeElement;
    const root=active?.closest?.("#media407F, #mediaDrawer407FContent");
    if(!root)return null;
    const card=active.closest?.("[data-media-asset]");
    const action=active.closest?.(
      "[data-media-place], [data-media-unplace], [data-media-nudge], [data-media-upload]"
    );
    return{
      rootId:root.id,
      assetId:card?.dataset.mediaAsset||null,
      action:action?.hasAttribute("data-media-nudge")
        ?`nudge-${action.dataset.mediaNudge}`
        :action?.hasAttribute("data-media-unplace")
        ?"unplace"
        :action?.hasAttribute("data-media-place")
          ?"place"
          :action?.hasAttribute("data-media-upload")
            ?"upload"
            :null
    };
  };
  const restoreMediaFocus=(state)=>{
    if(!state)return;
    const root=document.getElementById(state.rootId);
    if(!root)return;
    let target=null;
    if(state.action==="upload")target=root.querySelector("[data-media-upload]");
    if(state.assetId){
      const card=root.querySelector(
        `[data-media-asset="${CSS.escape(state.assetId)}"]`
      );
      target=card?.querySelector(
        state.action?.startsWith("nudge-")
          ?`[data-media-nudge="${CSS.escape(state.action.slice(6))}"]`
          :state.action==="unplace"
            ?"[data-media-unplace], [data-media-place]"
            :"[data-media-place], [data-media-unplace]"
      );
    }
    (target||root.querySelector("button, input"))?.focus?.();
  };
  const renderMediaLibrarySurfaces=()=>{
    const focusState=mediaFocusState();
    const reducedMotion=window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches;
    const page=document.getElementById("media407F");
    const drawer=document.getElementById("mediaDrawer407FContent");
    if(page){
      page.innerHTML=mediaLibraryMarkup(mediaItems(),{
        resolveObjectUrl:(id)=>mediaUrls.get(id),
        reducedMotion
      });
    }
    if(drawer){
      drawer.innerHTML=mediaLibraryMarkup(mediaItems(),{
        resolveObjectUrl:(id)=>mediaUrls.get(id),
        compact:true,
        reducedMotion
      });
    }
    const canvasHost=document.getElementById("canvas407F");
    if(
      bridge.state.view==="canvas"&&
      canvasHost&&
      !canvasHost.querySelector("[data-open-media-library]")
    ){
      canvasHost.insertAdjacentHTML(
        "afterbegin",
        '<button type="button" class="btnD alt sm media407FCanvasLauncher" data-open-media-library aria-controls="mediaDrawer407F" aria-expanded="false" aria-haspopup="dialog">MEDIA</button>'
      );
    }
    queueMicrotask(()=>restoreMediaFocus(focusState));
  };
  const openMediaLibrary=(opener)=>{
    const drawer=document.getElementById("mediaDrawer407F");
    if(!drawer)return;
    mediaDrawerOpener=opener||document.activeElement;
    renderMediaLibrarySurfaces();
    drawer.hidden=false;
    document.documentElement.setAttribute("data-media-drawer-open","true");
    document.querySelectorAll("[data-open-media-library]")
      .forEach((button)=>button.setAttribute("aria-expanded","true"));
    drawer.querySelector("[data-media-upload]")?.focus();
  };
  const closeMediaLibrary=()=>{
    const drawer=document.getElementById("mediaDrawer407F");
    if(!drawer||drawer.hidden)return;
    drawer.hidden=true;
    document.documentElement.removeAttribute("data-media-drawer-open");
    document.querySelectorAll("[data-open-media-library]")
      .forEach((button)=>button.setAttribute("aria-expanded","false"));
    mediaDrawerOpener?.focus?.();
    mediaDrawerOpener=null;
  };
  const commitMediaPlacement=(id,{x=960,y=540}={})=>{
    let placed=false;
    store.mutate("Place Media asset",(document)=>{
      const result=placeMediaLibraryAsset(document.advanced.media,id,{x,y});
      placed=result.changed;
      if(placed)document.advanced.media=result.media;
    });
    if(!placed)return false;
    syncBridgeFromStore();
    renderMediaLibrarySurfaces();
    bridge.toast("Media placed on timeline");
    announceGlobal("Media placed on timeline");
    return true;
  };
  const boardPointFromDrop=(target,event)=>{
    const svg=target.querySelector?.("svg")||target.closest?.("svg");
    const bounds=svg?.getBoundingClientRect?.();
    if(!bounds?.width||!bounds?.height)return{x:960,y:540};
    return{
      x:Math.max(0,Math.min(1920,(event.clientX-bounds.left)/bounds.width*1920)),
      y:Math.max(0,Math.min(1080,(event.clientY-bounds.top)/bounds.height*1080))
    };
  };
  onMediaLibraryClick=(event)=>{
    const open=event.target.closest?.("[data-open-media-library]");
    if(open){
      event.preventDefault();
      openMediaLibrary(open);
      return;
    }
    if(event.target.closest?.("[data-close-media-library]")){
      event.preventDefault();
      closeMediaLibrary();
      return;
    }
    const place=event.target.closest?.("[data-media-place]");
    if(place){
      event.preventDefault();
      commitMediaPlacement(place.dataset.mediaPlace);
      return;
    }
    const unplace=event.target.closest?.("[data-media-unplace]");
    if(unplace){
      event.preventDefault();
      let changed=false;
      store.mutate("Remove Media from timeline",(document)=>{
        const result=unplaceMediaLibraryAsset(
          document.advanced.media,
          unplace.dataset.mediaUnplace
        );
        changed=result.changed;
        if(changed)document.advanced.media=result.media;
      });
      if(changed){
        syncBridgeFromStore();
        renderMediaLibrarySurfaces();
        bridge.toast("Media removed from timeline");
        announceGlobal("Media removed from timeline");
      }
      return;
    }
    const nudge=event.target.closest?.("[data-media-nudge]");
    if(nudge){
      event.preventDefault();
      let changed=false;
      store.mutate("Move Media asset",(document)=>{
        const result=nudgeMediaLibraryAsset(
          document.advanced.media,
          nudge.dataset.mediaId,
          nudge.dataset.mediaNudge
        );
        changed=result.changed;
        if(changed)document.advanced.media=result.media;
      });
      if(changed){
        syncBridgeFromStore();
        renderMediaLibrarySurfaces();
        const message=`Media moved ${nudge.dataset.mediaNudge}`;
        bridge.toast(message);
        announceGlobal(message);
      }
      return;
    }
  };
  onMediaLibraryChange=async(event)=>{
    const input=event.target.closest?.("[data-media-upload]");
    if(!input)return;
    const files=[...(input.files||[])];
    input.value="";
    if(!files.length)return;
    const existing=mediaItems();
    const additions=[];
    const blobs=[];
    for(const file of files){
      if([...existing,...additions].some((item)=>
        item.source?.name===file.name&&
        Number(item.source?.size)===Number(file.size)&&
        item.source?.type===file.type
      )){
        const message=`${file.name} is already in Media`;
        bridge.toast(message);
        announceGlobal(message);
        continue;
      }
      try{
        const id=uid("media-library");
        const metrics=await imageMetrics(file);
        const asset=createMediaLibraryAsset({
          id,
          file,
          naturalWidth:metrics.width,
          naturalHeight:metrics.height,
          layerIndex:existing.length+additions.length
        });
        asset.source.blobKey=id;
        additions.push(asset);
        blobs.push({
          key:id,
          blob:file,
          metadata:{
            kind:"media-library",
            name:file.name,
            type:file.type,
            size:file.size,
            localOnly:true
          }
        });
      }catch(error){
        const message=String(error?.message||error);
        bridge.toast(message);
        announceGlobal(`${file.name} could not be added: ${message}`);
      }
    }
    if(!additions.length)return;
    try{
      await store.mutateWithBlobs(
        "Add Media assets",
        (document)=>document.advanced.media.push(...additions),
        {blobs,reason:"ADD_MEDIA_ASSETS"}
      );
    }catch(error){
      const message=String(error?.message||error);
      bridge.toast(message);
      announceGlobal("Media could not be added");
      return;
    }
    additions.forEach((asset,index)=>mediaUrls.set(asset.id,blobs[index].blob));
    syncBridgeFromStore();
    renderMediaLibrarySurfaces();
    bridge.toast(`${additions.length} Media asset${additions.length===1?"":"s"} added`);
    announceGlobal(
      `${additions.length} Media asset${additions.length===1?"":"s"} added`
    );
  };
  onMediaLibraryDragStart=(event)=>{
    const card=event.target.closest?.("[data-media-asset]");
    if(!card||!event.dataTransfer)return;
    event.dataTransfer.effectAllowed="copy";
    event.dataTransfer.setData(
      "application/x-missionmed-media-id",
      card.dataset.mediaAsset
    );
    event.dataTransfer.setData("text/plain",card.dataset.mediaAsset);
  };
  onMediaLibraryDragOver=(event)=>{
    const target=event.target.closest?.("#boardWizard, #canvas407F");
    if(!target||!event.dataTransfer)return;
    const types=[...(event.dataTransfer.types||[])];
    if(!types.includes("application/x-missionmed-media-id"))return;
    event.preventDefault();
    event.dataTransfer.dropEffect="copy";
    target.setAttribute("data-media-drop-active","true");
  };
  const clearMediaDropTargets=()=>{
    document.querySelectorAll("[data-media-drop-active]")
      .forEach((target)=>target.removeAttribute("data-media-drop-active"));
  };
  onMediaLibraryDragLeave=(event)=>{
    const target=event.target.closest?.("#boardWizard, #canvas407F");
    if(!target||target.contains(event.relatedTarget))return;
    target.removeAttribute("data-media-drop-active");
  };
  onMediaLibraryDragEnd=clearMediaDropTargets;
  onMediaLibraryDrop=(event)=>{
    const target=event.target.closest?.("#boardWizard, #canvas407F");
    if(!target||!event.dataTransfer)return;
    const id=event.dataTransfer.getData("application/x-missionmed-media-id");
    clearMediaDropTargets();
    if(!id)return;
    event.preventDefault();
    commitMediaPlacement(id,boardPointFromDrop(target,event));
  };
  document.addEventListener("click",onMediaLibraryClick);
  document.addEventListener("change",onMediaLibraryChange);
  document.addEventListener("dragstart",onMediaLibraryDragStart);
  document.addEventListener("dragover",onMediaLibraryDragOver);
  document.addEventListener("dragleave",onMediaLibraryDragLeave);
  document.addEventListener("dragend",onMediaLibraryDragEnd);
  document.addEventListener("drop",onMediaLibraryDrop);
  const explanationTargetMarkup=(event)=>{
    const target=event?.fields?.target||{};
    const kind=["event","date","region","coordinate"].includes(target.kind)
      ?target.kind
      :"event";
    const panelAttributes=(panelKind)=>panelKind===kind
      ?` data-explanation-target-panel="${panelKind}"`
      :` data-explanation-target-panel="${panelKind}" hidden`;
    const disabledAttribute=(panelKind)=>panelKind===kind?"":" disabled";
    const factual=(store.document.events||[]).filter(
      (candidate)=>!isExplanationEvent(candidate)
    );
    return`<div class="m9FieldGrid">
      <label>Points to
        <select data-explanation-target-kind>
          ${["event","date","region","coordinate"].map((optionKind)=>`<option value="${optionKind}" ${kind===optionKind?"selected":""}>${optionKind[0].toUpperCase()+optionKind.slice(1)}</option>`).join("")}
        </select>
      </label>
      <label${panelAttributes("event")}>Timeline item
        <select data-explanation-target-event${disabledAttribute("event")}>
          <option value="">Choose an item…</option>
          ${factual.map((item)=>`<option value="${escapeMarkup(item.id)}" ${target.eventId===item.id?"selected":""}>${escapeMarkup(item.title)}</option>`).join("")}
        </select>
      </label>
      <label${panelAttributes("date")}>Date
        <input type="month" data-explanation-target-date value="${escapeMarkup(target.date||event?.startDate||"")}"${disabledAttribute("date")}>
      </label>
      <label${panelAttributes("region")}>Region
        <select data-explanation-target-region${disabledAttribute("region")}>
          ${["top left","top center","top right","bottom left","bottom center","bottom right"].map((region)=>`<option value="${region}" ${target.region===region?"selected":""}>${region}</option>`).join("")}
        </select>
      </label>
      <fieldset class="m9CoordinateTarget"${panelAttributes("coordinate")}>
        <legend>Target coordinate</legend>
        <label>X <input type="number" min="96" max="1824" step="8" value="${Number(target.x)||960}" data-explanation-target-x${disabledAttribute("coordinate")}></label>
        <label>Y <input type="number" min="112" max="968" step="8" value="${Number(target.y)||540}" data-explanation-target-y${disabledAttribute("coordinate")}></label>
      </fieldset>
    </div>`;
  };
  const explanationCardMarkup=(event)=>{
    const fields=event.fields||{};
    const errorId=`m9ExplanationError-${escapeMarkup(event.id)}`;
    return`<article class="m9ExplanationCard" data-explanation-editor="${escapeMarkup(event.id)}">
      <label>Short explanation
        <textarea maxlength="${EXPLANATION_TEXT_MAX}" data-explanation-text aria-describedby="${errorId}">${escapeMarkup(fields.explanationText||event.title)}</textarea>
        <small class="m9InlineError" id="${errorId}" data-explanation-error role="alert" hidden></small>
      </label>
      ${explanationTargetMarkup(event)}
      <label class="canvas407FDetailCheck"><input type="checkbox" data-explanation-leader ${fields.leaderEnabled!==false?"checked":""}> <span>Show leader arrow</span></label>
      <div class="m9Geometry" aria-label="Explanation placement and size">
        <label>X <input type="number" min="96" max="1744" step="8" value="${Number(fields.x)||1180}" data-explanation-x></label>
        <label>Y <input type="number" min="112" max="904" step="8" value="${Number(fields.y)||144}" data-explanation-y></label>
        <label>Width <input type="number" min="220" max="520" step="8" value="${Number(fields.width)||360}" data-explanation-width></label>
        <label>Height <input type="number" min="96" max="220" step="8" value="${Number(fields.height)||126}" data-explanation-height></label>
      </div>
      <div class="m9Nudge" role="toolbar" aria-label="Move explanation">
        ${["left","up","down","right"].map((direction)=>`<button type="button" class="btnD alt sm" data-explanation-move="${direction}" data-event-id="${escapeMarkup(event.id)}">${direction}</button>`).join("")}
        <button type="button" class="btnD alt sm" data-explanation-resize="smaller" data-event-id="${escapeMarkup(event.id)}">Smaller</button>
        <button type="button" class="btnD alt sm" data-explanation-resize="larger" data-event-id="${escapeMarkup(event.id)}">Larger</button>
      </div>
      <div class="m9CardActions">
        <button type="button" class="btnD go sm" data-explanation-save data-event-id="${escapeMarkup(event.id)}">SAVE EXPLANATION</button>
        <button type="button" class="homeTertiary" data-explanation-delete data-event-id="${escapeMarkup(event.id)}">Delete</button>
      </div>
    </article>`;
  };
  const interviewLogoMarkup=(target)=>{
    const asset=(store.document.advanced?.media||[]).find(
      (item)=>item.id===target.logoMediaId
    );
    const url=asset?mediaUrls.get(asset.id):"";
    return`<section class="m9LogoEditor" aria-labelledby="m9LogoTitle">
      <div>
        <div class="builderVariantEyebrow" id="m9LogoTitle">PROGRAM LOGO · LOCAL MEDIA</div>
        <p>PNG, JPG, or WEBP. The original local asset stays in Media; this timeline stores only its reference and placement.</p>
      </div>
      ${asset?`<div class="m9LogoPreview">${url?`<img src="${escapeMarkup(url)}" alt="Current program logo preview">`:""}<strong>${escapeMarkup(asset.source?.name||"Program logo")}</strong></div>`:"<div class=\"m9LogoEmpty\">No program logo selected.</div>"}
      <label class="btnD alt sm m9LogoUpload">CHOOSE OR REPLACE LOGO<input type="file" accept="image/png,image/jpeg,image/webp" data-interview-logo-upload aria-describedby="m9LogoError"></label>
      <small class="m9InlineError" id="m9LogoError" data-interview-logo-error role="alert" hidden></small>
      <div class="m9FieldGrid">
        <label>Fit
          <select data-interview-logo-fit><option value="contain" ${target.logoFit!=="cover"?"selected":""}>Contain</option><option value="cover" ${target.logoFit==="cover"?"selected":""}>Crop to frame</option></select>
        </label>
        <label>X <input type="number" min="96" max="1744" value="${Number(target.logoX)||1560}" data-interview-logo-x></label>
        <label>Y <input type="number" min="80" max="904" value="${Number(target.logoY)||112}" data-interview-logo-y></label>
        <label>Width <input type="number" min="80" max="420" value="${Number(target.logoWidth)||180}" data-interview-logo-width></label>
        <label>Height <input type="number" min="60" max="260" value="${Number(target.logoHeight)||96}" data-interview-logo-height></label>
      </div>
      ${asset?'<button type="button" class="homeTertiary" data-interview-logo-remove>Remove from this interview timeline</button>':""}
    </section>`;
  };
  renderM9BuilderSurfaces=()=>{
    const explanationHost=document.getElementById("explanationBuilder407F");
    const interviewHost=document.getElementById("interviewConfig407F");
    if(!explanationHost||!interviewHost)return;
    const explanations=(store.document.events||[]).filter(isExplanationEvent);
    explanationHost.innerHTML=`<section class="builderReviewBlock m9BuilderTool" aria-labelledby="m9ExplanationTitle">
      <header class="m9ToolHeader">
        <div><div class="builderVariantEyebrow">BOUNDED ANNOTATION</div><h2 id="m9ExplanationTitle">Explanation</h2></div>
        <span>${explanations.length}/12</span>
      </header>
      <p>Add brief interview context without creating an unrestricted drawing layer.</p>
      <form class="m9CreateExplanation" data-explanation-create-form>
        <label>Short explanation
          <textarea maxlength="${EXPLANATION_TEXT_MAX}" placeholder="Explain a gap, transition, or unusual sequence." data-explanation-create-text aria-describedby="m9ExplanationCreateError"></textarea>
          <small class="m9InlineError" id="m9ExplanationCreateError" data-explanation-error role="alert" hidden></small>
        </label>
        ${explanationTargetMarkup(null)}
        <label class="canvas407FDetailCheck"><input type="checkbox" data-explanation-create-leader checked> <span>Show leader arrow</span></label>
        <button type="button" class="btnD go sm" data-explanation-create ${explanations.length>=12?"disabled":""}>ADD EXPLANATION</button>
      </form>
      <div class="m9ExplanationList">${explanations.map(explanationCardMarkup).join("")}</div>
    </section>`;
    const variant=activeSpecialtyVariant(store.document);
    const target=variant.interviewTarget||{};
    const specific=target.mode==="specific";
    interviewHost.innerHTML=`<section class="builderReviewBlock m9BuilderTool" aria-labelledby="m9InterviewTitle" data-interview-config>
      <header class="m9ToolHeader">
        <div><div class="builderVariantEyebrow">ACTIVE VARIANT</div><h2 id="m9InterviewTitle">Interview target</h2></div>
        <span>${escapeMarkup(variant.name)}</span>
      </header>
      <fieldset class="m9ModeChoice">
        <legend>Timeline purpose</legend>
        <label><input type="radio" name="interview-mode" value="general" ${!specific?"checked":""}> General timeline</label>
        <label><input type="radio" name="interview-mode" value="specific" ${specific?"checked":""}> Specific interview</label>
      </fieldset>
      <div class="m9InterviewSpecific" data-interview-specific ${specific?"":"hidden"}>
        <div class="m9FieldGrid">
          <label>Program name <input type="text" maxlength="100" value="${escapeMarkup(target.programName||"")}" data-interview-program></label>
          <label>Specialty
            <select data-interview-specialty>
              ${PINNED_ROTATION_SPECIALTIES.map((label)=>`<option value="${escapeMarkup(normalizeSpecialtyId(label))}" data-label="${escapeMarkup(label)}" ${(target.specialtyId||variant.specialty.id)===normalizeSpecialtyId(label)?"selected":""}>${escapeMarkup(label)}</option>`).join("")}
            </select>
          </label>
          <label>Interview date <input type="date" value="${escapeMarkup(target.interviewDate||"")}" data-interview-date></label>
          <label>Program location <input type="text" maxlength="100" value="${escapeMarkup(target.location||"")}" data-interview-location></label>
          <label>Optional timeline label <input type="text" maxlength="60" value="${escapeMarkup(target.label||"")}" data-interview-label></label>
        </div>
        ${interviewLogoMarkup(target)}
      </div>
      <section class="m9CalendarState" aria-labelledby="m9CalendarTitle">
        <div><div class="builderVariantEyebrow">MATRIX CALENDAR · SCHEDULED INTERVIEWS</div><h3 id="m9CalendarTitle">${matrixCalendarState.status==="unavailable"?"Calendar unavailable":"Scheduled interviews"}</h3></div>
        <p>${escapeMarkup(matrixCalendarState.message)}</p>
        <span class="chip">LOCAL REVIEW · NO LIVE CONNECTION</span>
      </section>
      <button type="button" class="btnD go sm" data-interview-save>SAVE INTERVIEW TARGET</button>
    </section>`;
  };
  const explanationTargetFrom=(root)=>{
    const kind=root.querySelector("[data-explanation-target-kind]")?.value||"coordinate";
    return{
      kind,
      eventId:root.querySelector("[data-explanation-target-event]")?.value||"",
      date:root.querySelector("[data-explanation-target-date]")?.value||"",
      region:root.querySelector("[data-explanation-target-region]")?.value||"",
      x:root.querySelector("[data-explanation-target-x]")?.value||960,
      y:root.querySelector("[data-explanation-target-y]")?.value||540
    };
  };
  const syncExplanationTargetPanels=(root)=>{
    const kind=root?.querySelector("[data-explanation-target-kind]")?.value;
    if(!kind)return;
    for(const panel of root.querySelectorAll("[data-explanation-target-panel]")){
      const active=panel.dataset.explanationTargetPanel===kind;
      panel.hidden=!active;
      for(const control of panel.querySelectorAll("input,select")){
        control.disabled=!active;
      }
    }
  };
  const explanationErrorMessage=(result)=>({
    EXPLANATION_TEXT_TOO_LONG:`Keep the explanation to ${EXPLANATION_TEXT_MAX} characters.`,
    EXPLANATION_LIMIT_REACHED:"This timeline already has the maximum of 12 explanations."
  }[result?.code]||"Enter a short explanation.");
  const setM9InlineError=(control,error,message)=>{
    if(!control||!error)return;
    control.setAttribute("aria-invalid","true");
    error.textContent=message;
    error.hidden=false;
    announceGlobal(message);
    control.focus();
  };
  const clearM9InlineError=(control,error)=>{
    control?.removeAttribute("aria-invalid");
    if(error){
      error.textContent="";
      error.hidden=true;
    }
  };
  const refreshM9=({focusSelector=""}={})=>{
    syncBridgeFromStore();
    queueBuilderEmbeddedPreview({force:true});
    if(bridge.state.view==="export")queueExportRender();
    if(focusSelector)queueMicrotask(()=>document.querySelector(focusSelector)?.focus());
  };
  onM9BuilderClick=(event)=>{
    if(
      event.target.closest?.('[data-builder-step="7"]')||
      event.target.closest?.("#builderContinue")
    ){
      queueMicrotask(renderM9BuilderSurfaces);
    }
    const create=event.target.closest?.("[data-explanation-create]");
    if(create){
      const form=create.closest("[data-explanation-create-form]");
      const textControl=form.querySelector("[data-explanation-create-text]");
      const error=form.querySelector("[data-explanation-error]");
      clearM9InlineError(textControl,error);
      const target=explanationTargetFrom(form);
      const owner=(store.document.events||[]).find(
        (item)=>item.id===target.eventId
      );
      let result={ok:false};
      store.mutate("Add Explanation",(document)=>{
        result=createExplanation(document,{
          text:form.querySelector("[data-explanation-create-text]")?.value,
          target,
          startDate:target.date||owner?.startDate||currentMonth()
        });
        if(result.ok){
          result.event.fields.leaderEnabled=
            form.querySelector("[data-explanation-create-leader]")?.checked!==false;
          const canonical=document.events.find(
            (item)=>item.id===result.event.id
          );
          if(canonical)canonical.fields.leaderEnabled=result.event.fields.leaderEnabled;
        }
      });
      if(!result.ok){
        const message=explanationErrorMessage(result);
        bridge.toast(message);
        setM9InlineError(textControl,error,message);
        return;
      }
      refreshM9({
        focusSelector:`[data-explanation-editor="${CSS.escape(result.event.id)}"] [data-explanation-text]`
      });
      bridge.toast("Explanation added");
      announceGlobal("Explanation added to the timeline");
      return;
    }
    const save=event.target.closest?.("[data-explanation-save]");
    if(save){
      const card=save.closest("[data-explanation-editor]");
      const id=save.dataset.eventId;
      const textControl=card.querySelector("[data-explanation-text]");
      const error=card.querySelector("[data-explanation-error]");
      clearM9InlineError(textControl,error);
      let result={ok:false};
      store.mutate("Edit Explanation",(document)=>{
        result=updateExplanation(document,id,{
          text:card.querySelector("[data-explanation-text]")?.value,
          target:explanationTargetFrom(card),
          leaderEnabled:card.querySelector("[data-explanation-leader]")?.checked,
          x:card.querySelector("[data-explanation-x]")?.value,
          y:card.querySelector("[data-explanation-y]")?.value,
          width:card.querySelector("[data-explanation-width]")?.value,
          height:card.querySelector("[data-explanation-height]")?.value
        });
      });
      if(!result.ok){
        const message=explanationErrorMessage(result);
        bridge.toast(message);
        setM9InlineError(textControl,error,message);
        return;
      }
      refreshM9({focusSelector:`[data-explanation-editor="${CSS.escape(id)}"] [data-explanation-save]`});
      bridge.toast("Explanation updated");
      return;
    }
    const remove=event.target.closest?.("[data-explanation-delete]");
    if(remove){
      const id=remove.dataset.eventId;
      store.mutate("Delete Explanation",(document)=>
        deleteExplanation(document,id)
      );
      refreshM9({focusSelector:"[data-explanation-create-text]"});
      bridge.toast("Explanation deleted");
      return;
    }
    const move=event.target.closest?.("[data-explanation-move]");
    if(move){
      const source=store.document.events.find(
        (item)=>item.id===move.dataset.eventId
      );
      const fields=source?.fields||{};
      const delta={
        left:{x:-24,y:0},
        right:{x:24,y:0},
        up:{x:0,y:-24},
        down:{x:0,y:24}
      }[move.dataset.explanationMove];
      store.mutate("Move Explanation",(document)=>moveExplanation(
        document,
        move.dataset.eventId,
        {x:(Number(fields.x)||1180)+delta.x,y:(Number(fields.y)||144)+delta.y}
      ));
      refreshM9({focusSelector:`[data-explanation-move="${move.dataset.explanationMove}"][data-event-id="${CSS.escape(move.dataset.eventId)}"]`});
      announceGlobal(`Explanation moved ${move.dataset.explanationMove}`);
      return;
    }
    const resize=event.target.closest?.("[data-explanation-resize]");
    if(resize){
      const source=store.document.events.find(
        (item)=>item.id===resize.dataset.eventId
      );
      const fields=source?.fields||{};
      const delta=resize.dataset.explanationResize==="larger"?24:-24;
      store.mutate("Resize Explanation",(document)=>resizeExplanation(
        document,
        resize.dataset.eventId,
        {width:(Number(fields.width)||360)+delta,height:(Number(fields.height)||126)+delta/2}
      ));
      refreshM9({focusSelector:`[data-explanation-resize="${resize.dataset.explanationResize}"][data-event-id="${CSS.escape(resize.dataset.eventId)}"]`});
      announceGlobal(`Explanation ${resize.dataset.explanationResize}`);
      return;
    }
    if(event.target.closest?.("[data-interview-logo-remove]")){
      const active=activeSpecialtyVariant(store.document);
      store.mutate("Remove interview logo",(document)=>{
        setVariantInterviewTarget(document,active.id,{
          ...active.interviewTarget,
          logoMediaId:""
        });
      });
      refreshM9({focusSelector:"[data-interview-logo-upload]"});
      bridge.toast("Logo removed from this interview timeline");
      return;
    }
    if(event.target.closest?.("[data-interview-save]")){
      const root=event.target.closest("[data-interview-config]");
      const mode=root.querySelector('[name="interview-mode"]:checked')?.value||"general";
      const specialty=root.querySelector("[data-interview-specialty]");
      const active=activeSpecialtyVariant(store.document);
      store.mutate("Save interview target",(document)=>{
        setVariantInterviewTarget(document,active.id,{
          ...active.interviewTarget,
          mode,
          programName:root.querySelector("[data-interview-program]")?.value,
          specialtyId:specialty?.value||active.specialty.id,
          specialtyLabel:specialty?.selectedOptions?.[0]?.dataset?.label||
            active.specialty.label,
          interviewDate:root.querySelector("[data-interview-date]")?.value,
          location:root.querySelector("[data-interview-location]")?.value,
          label:root.querySelector("[data-interview-label]")?.value,
          logoFit:root.querySelector("[data-interview-logo-fit]")?.value,
          logoX:root.querySelector("[data-interview-logo-x]")?.value,
          logoY:root.querySelector("[data-interview-logo-y]")?.value,
          logoWidth:root.querySelector("[data-interview-logo-width]")?.value,
          logoHeight:root.querySelector("[data-interview-logo-height]")?.value
        });
      });
      refreshM9({focusSelector:"[data-interview-save]"});
      bridge.toast(mode==="specific"?"Interview target saved":"General timeline saved");
      announceGlobal(mode==="specific"?"Interview-specific timeline saved":"General timeline saved");
    }
  };
  onM9BuilderChange=async(event)=>{
    const targetKind=event.target.closest?.("[data-explanation-target-kind]");
    if(targetKind){
      syncExplanationTargetPanels(
        targetKind.closest("[data-explanation-create-form],[data-explanation-editor]")
      );
      return;
    }
    const mode=event.target.closest?.('[name="interview-mode"]');
    if(mode){
      const root=mode.closest("[data-interview-config]");
      const specific=root?.querySelector("[data-interview-specific]");
      if(specific)specific.hidden=mode.value!=="specific";
      return;
    }
    const input=event.target.closest?.("[data-interview-logo-upload]");
    if(!input)return;
    const logoRoot=input.closest(".m9LogoEditor");
    const logoError=logoRoot?.querySelector("[data-interview-logo-error]");
    clearM9InlineError(input,logoError);
    const file=input.files?.[0];
    input.value="";
    if(!file)return;
    if(!["image/png","image/jpeg","image/webp"].includes(file.type)){
      const message="Choose a PNG, JPG, or WEBP logo.";
      bridge.toast(message);
      setM9InlineError(input,logoError,message);
      return;
    }
    try{
      const id=uid("interview-logo");
      const metrics=await imageMetrics(file);
      const asset=createMediaLibraryAsset({
        id,
        file,
        naturalWidth:metrics.width,
        naturalHeight:metrics.height,
        layerIndex:mediaItems().length
      });
      asset.source.blobKey=id;
      asset.role="interview-program-logo-source";
      const active=activeSpecialtyVariant(store.document);
      await store.mutateWithBlobs(
        "Add interview program logo",
        (document)=>{
          document.advanced.media.push(asset);
          setVariantInterviewTarget(document,active.id,{
            ...active.interviewTarget,
            logoMediaId:id
          });
        },
        {
          blobs:[{
            key:id,
            blob:file,
            metadata:{
              kind:"interview-program-logo",
              name:file.name,
              type:file.type,
              size:file.size,
              localOnly:true
            }
          }],
          reason:"ADD_INTERVIEW_PROGRAM_LOGO"
        }
      );
      mediaUrls.set(id,file);
      refreshM9({focusSelector:"[data-interview-logo-upload]"});
      renderMediaLibrarySurfaces();
      bridge.toast("Program logo added locally");
      announceGlobal("Program logo added to the active interview timeline");
    }catch(error){
      const message=String(error?.message||error);
      bridge.toast(message);
      setM9InlineError(input,logoError,message);
    }
  };
  document.addEventListener("click",onM9BuilderClick);
  document.addEventListener("change",onM9BuilderChange);
  renderM9BuilderSurfaces();
  const previewBackgroundInert=(active)=>{
    for(const element of [
      document.querySelector("header"),
      document.getElementById("rail"),
      document.querySelector("main")
    ].filter(Boolean)){
      element.toggleAttribute("inert",active);
    }
    document.documentElement.toggleAttribute("data-builder-preview-open",active);
  };
  const updateBuilderPreviewHitTargets=(root)=>{
    const surface=root?.matches?.("[data-builder-preview-surface]")
      ?root
      :root?.querySelector?.("[data-builder-preview-surface]");
    if(surface?.dataset?.interactive!=="true"){
      root?.querySelectorAll?.("[data-builder-preview-hit-target]")
        .forEach((target)=>target.remove());
      return;
    }
    const svg=surface.querySelector?.("svg");
    if(!svg)return;
    const bounds=svg.getBoundingClientRect?.();
    if(!bounds?.width||!bounds?.height)return;
    const viewBox=svg.viewBox?.baseVal;
    const scale=Math.min(
      bounds.width/Math.max(1,viewBox?.width||1920),
      bounds.height/Math.max(1,viewBox?.height||1080)
    );
    if(!Number.isFinite(scale)||scale<=0)return;
    const minimum=44/scale;
    for(const target of builderPreviewFocusableTargets(root)){
      target.querySelector?.(":scope > [data-builder-preview-hit-target]")?.remove();
      let box=null;
      try{box=target.getBBox?.();}catch{box=null;}
      if(!box||!Number.isFinite(box.width)||!Number.isFinite(box.height))continue;
      const width=Math.max(box.width,minimum);
      const height=Math.max(box.height,minimum);
      const hit=document.createElementNS("http://www.w3.org/2000/svg","rect");
      hit.setAttribute("data-builder-preview-hit-target","true");
      hit.setAttribute("aria-hidden","true");
      hit.setAttribute("x",String(box.x-(width-box.width)/2));
      hit.setAttribute("y",String(box.y-(height-box.height)/2));
      hit.setAttribute("width",String(width));
      hit.setAttribute("height",String(height));
      hit.setAttribute("fill","transparent");
      hit.setAttribute("pointer-events","all");
      target.insertBefore(hit,target.firstChild);
    }
  };
  const builderPreviewSvg=(namespace,{interactive=true}={})=>{
    const rendered=renderResponsiveAdvancedBoard(store.document,{
      currentMonth:currentMonth(),
      audience:"INTERVIEWER_SAFE",
      idNamespace:namespace
    });
    return enhanceBuilderPreviewSvg(rendered.svg,store.document,{interactive});
  };
  const mountBuilderPreview=(host,{
    surface="embedded",
    namespace=`d1-405-builder-${surface}`,
    force=false
  }={})=>{
    if(!host)return false;
    const signature=[
      surface,
      store.document?.id,
      store.document?.updatedAt,
      store.document?.theme,
      store.document?.mode,
      store.entitlement.canMutate
    ].join("|");
    if(
      !force&&
      host.dataset.builderPreviewSignature===signature&&
      host.querySelector("[data-builder-preview-surface]")
    )return false;
    let svg="";
    try{
      svg=builderPreviewSvg(namespace,{
        interactive:store.entitlement.canMutate===true
      });
    }catch(error){
      bridge.toast(String(error?.message||error));
    }
    host.dataset.builderPreviewSignature=signature;
    const interactive=store.entitlement.canMutate===true;
    host.innerHTML=svg
      ?`<div class="builderPreviewSurface" data-builder-preview-surface="${surface}" data-interactive="${interactive}" role="region" aria-label="${interactive
        ?"Interactive timeline preview. Use arrow keys to move between timeline items and Enter to edit."
        :"Timeline preview. Editing is unavailable in read-only access."
      }">${svg}</div>`
      :`<div class="builderPreviewTrueEmpty" role="status"><strong>Your timeline preview will appear here.</strong><span>Add information in Builder to create the final 16:9 artifact.</span></div>`;
    if(interactive){
      requestAnimationFrame(()=>updateBuilderPreviewHitTargets(host));
    }
    return true;
  };
  const renderBuilderEmbeddedPreview=({force=false}={})=>
    mountBuilderPreview(document.getElementById("boardWizard"),{
      surface:"embedded",
      namespace:"d1-405-builder-embedded",
      force
    });
  const queueBuilderEmbeddedPreview=({force=false}={})=>{
    if(builderPreviewRenderQueued&&!force)return;
    builderPreviewRenderQueued=true;
    queueMicrotask(()=>{
      builderPreviewRenderQueued=false;
      renderBuilderEmbeddedPreview({force});
    });
  };
  const applyBuilderPreviewZoom=()=>{
    const canvas=document.querySelector("[data-builder-preview-canvas]");
    if(!canvas)return;
    const percent=builderPreviewZoom.mode==="percent"
      ?builderPreviewZoom.percent
      :null;
    canvas.dataset.zoomMode=builderPreviewZoom.mode;
    canvas.dataset.zoomPercent=percent||"fit";
    canvas.style.setProperty(
      "--builder-preview-board-width",
      `${1920*((percent||100)/100)}px`
    );
    document.querySelectorAll("[data-builder-preview-zoom]").forEach((button)=>{
      const selected=button.dataset.builderPreviewZoom===(
        builderPreviewZoom.mode==="fit"?"fit":String(builderPreviewZoom.percent)
      );
      button.setAttribute("aria-pressed",String(selected));
    });
    requestAnimationFrame(()=>{
      updateBuilderPreviewHitTargets(canvas);
      document.querySelector("[data-builder-preview-viewport]")?.scrollTo?.({
        left:0,
        top:0,
        behavior:"instant"
      });
    });
  };
  const closeBuilderPreview=({restoreFocus=true}={})=>{
    const trap=builderPreviewTrap;
    builderPreviewTrap=null;
    trap?.destroy();
    document.getElementById("modalBk")?.removeEventListener(
      "click",
      onBuilderPreviewBackdrop,
      true
    );
    bridge.closeModal?.();
    previewBackgroundInert(false);
    if(restoreFocus){
      trap?.restore?.();
      if(!trap)builderPreviewOpener?.focus?.();
    }
    builderPreviewOpener=null;
  };
  const focusBuilderPreviewOwner=(route)=>{
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      let target=null;
      if(route.kind==="exam-attempt"){
        target=document.querySelector(
          `[data-exam-card="${CSS.escape(route.ownerId)}"]`
        );
      }else if(route.kind==="core-education"){
        target=document.querySelector('[data-core="school"]');
      }else if(route.kind==="explanation"){
        target=document.querySelector(
          `[data-explanation-editor="${CSS.escape(route.ownerId)}"]`
        );
      }else if(route.kind==="interview-target"){
        target=document.querySelector("[data-interview-config]");
      }else{
        target=document.querySelector(
          `[data-domain-form="${CSS.escape(route.stepId)}"]`
        );
      }
      target=target||document.getElementById("builderStepPanel");
      target.scrollIntoView?.({block:"center",behavior:"smooth"});
      const control=target.matches?.("input,select,textarea,button")
        ?target
        :target.querySelector?.(
          "input:not([type='hidden']):not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled):not([data-exam-delete]):not([data-domain-delete])"
        );
      (control||target).focus?.({preventScroll:true});
    }));
  };
  const activateBuilderPreviewOwner=(attributes,{fromLightbox=false}={})=>{
    if(store.entitlement.canMutate!==true){
      bridge.toast(store.entitlement.reason);
      return false;
    }
    const route=resolveBuilderPreviewOwner(store.document,attributes);
    if(!route){
      bridge.toast("This preview item is not connected to an editable entry.");
      return false;
    }
    if(route.kind==="interview-target"||route.kind==="explanation"){
      store.mutate(
        route.kind==="explanation"
          ?"Open Explanation"
          :"Open interview configuration",
        (document)=>{
        document.builder={...(document.builder||{}),step:7};
        },
        {history:false,material:false}
      );
    }else{
      store.mutate("Open Builder entry",(document)=>{
        beginBuilderEntryEdit(document,route.eventId);
      },{history:false,material:false});
    }
    if(fromLightbox)closeBuilderPreview({restoreFocus:false});
    syncBridgeFromStore();
    bridge.state.builder.step=route.step;
    bridge.go("builder");
    focusBuilderPreviewOwner(route);
    const event=route.eventId
      ?store.document.events.find(({id})=>String(id)===String(route.eventId))
      :null;
    announceGlobal(
      route.kind==="interview-target"
        ?"Opened interview configuration in Review & Finish"
        :route.kind==="explanation"
          ?"Opened explanation in Review & Finish"
        :`Opened ${event?.title||"timeline item"} in Builder`
    );
    return true;
  };
  const activateBuilderPreviewRetake=(targetAttemptId,{fromLightbox=false}={})=>{
    if(store.entitlement.canMutate!==true){
      bridge.toast(store.entitlement.reason);
      return false;
    }
    const id=String(targetAttemptId||"");
    if(!id)return false;
    let record=(store.document.exams||[]).find(
      (attempt)=>String(attempt.id)===id
    );
    if(!record)record=api.exam?.restoreRetake?.(id);
    if(!record){
      bridge.toast("The retake card could not be restored.");
      return false;
    }
    if(fromLightbox)closeBuilderPreview({restoreFocus:false});
    bridge.state.builder.step=2;
    bridge.go("builder");
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const card=document.querySelector(
        `[data-exam-card="${CSS.escape(id)}"]`
      );
      const field=card?.querySelector('[data-exam-field="examDate"]');
      (field||card)?.focus?.();
      card?.scrollIntoView?.({block:"center",behavior:"smooth"});
    }));
    announceGlobal("Opened the retake exam date in Builder");
    return true;
  };
  onBuilderPreviewInteraction=(event)=>{
    const zoomButton=event.type==="click"
      ?event.target?.closest?.("[data-builder-preview-zoom]")
      :null;
    if(zoomButton){
      builderPreviewZoom=updateCanvasZoom(builderPreviewZoom,{
        kind:"preset",
        value:zoomButton.dataset.builderPreviewZoom
      });
      applyBuilderPreviewZoom();
      return;
    }
    const closeButton=event.type==="click"
      ?event.target?.closest?.("[data-builder-preview-close]")
      :null;
    if(closeButton){
      closeBuilderPreview();
      return;
    }
    const attributes=builderPreviewTargetAttributes(event.target);
    if(!attributes)return;
    if(store.entitlement.canMutate!==true)return;
    const target=event.target.closest(
      "[data-builder-preview-event],[data-builder-preview-interview],[data-builder-preview-retake]"
    );
    if(event.type==="keydown"){
      const moves={
        ArrowRight:"next",
        ArrowDown:"next",
        ArrowLeft:"previous",
        ArrowUp:"previous",
        Home:"first",
        End:"last"
      };
      if(moves[event.key]){
        event.preventDefault();
        moveBuilderPreviewFocus(
          target.closest("[data-builder-preview-surface]"),
          target,
          moves[event.key]
        );
        return;
      }
      if(!["Enter"," "].includes(event.key))return;
      event.preventDefault();
    }else if(event.type!=="click"){
      return;
    }
    const fromLightbox=!!target.closest(
      '[data-builder-preview-surface="lightbox"]'
    );
    if(attributes.retakeTarget){
      activateBuilderPreviewRetake(attributes.retakeTarget,{fromLightbox});
    }else{
      activateBuilderPreviewOwner(attributes,{fromLightbox});
    }
  };
  onBuilderPreviewFocus=(event)=>{
    const target=event.target?.closest?.(
      "[data-builder-preview-event],[data-builder-preview-interview],[data-builder-preview-retake]"
    );
    if(!target)return;
    for(const item of builderPreviewFocusableTargets(
      target.closest("[data-builder-preview-surface]")
    )){
      item.setAttribute("tabindex",item===target?"0":"-1");
    }
  };
  onBuilderPreviewResize=()=>{
    updateBuilderPreviewHitTargets(document.getElementById("boardWizard"));
    updateBuilderPreviewHitTargets(
      document.querySelector("[data-builder-preview-canvas]")
    );
  };
  document.addEventListener("click",onBuilderPreviewInteraction);
  document.addEventListener("keydown",onBuilderPreviewInteraction);
  document.addEventListener("focusin",onBuilderPreviewFocus);
  window.addEventListener("resize",onBuilderPreviewResize);
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
  const advancedBlobRecord=(id,file,kind)=>({
    key:id,
    blob:file,
    metadata:{
      kind,
      name:file.name,
      type:file.type,
      size:file.size,
      localOnly:true
    }
  });
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
    await store.mutateWithBlobs(
      `Add ${kind}`,
      (document)=>document.advanced.media.push(media),
      {blobs:[advancedBlobRecord(id,file,kind)],reason:"ADD_ADVANCED_MEDIA"}
    );
    mediaUrls.set(id,file);
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
    await store.mutateWithBlobs(
      "Change background",
      (document)=>{document.advanced.background=background;},
      {
        blobs:[advancedBlobRecord(id,file,"background")],
        reason:"CHANGE_ADVANCED_BACKGROUND"
      }
    );
    mediaUrls.set(id,file);
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
    const rendered=renderResponsiveAdvancedBoard(input.timeline,{
      ...input.rendererOptions,
      currentMonth:currentMonth()
    });
    return`<div class="board-preview canonical-board-preview export407FBoard" role="img" aria-label="Export preview" data-theme="${escapeMarkup(input.timeline.theme||DEFAULT_THEME_ID)}">${rendered.svg}</div>`;
  };
  const queueExportRender=({focusSelector=null}={})=>{
    if(focusSelector)exportRenderFocusSelector=focusSelector;
    if(exportRenderQueued)return;
    exportRenderQueued=true;
    queueMicrotask(()=>{
      exportRenderQueued=false;
      if(bridge.state.view==="export"){
        renderExportHost();
        const selector=exportRenderFocusSelector;
        exportRenderFocusSelector=null;
        if(selector)queueMicrotask(()=>document.querySelector(selector)?.focus());
      }else{
        exportRenderFocusSelector=null;
      }
    });
  };
  const closeExportThemeDialog=({restoreFocus=true}={})=>{
    const trap=exportThemeTrap;
    exportThemeTrap=null;
    trap?.destroy();
    document.getElementById("modalBk")?.removeEventListener(
      "click",
      onExportThemeBackdrop,
      true
    );
    bridge.closeModal?.();
    previewBackgroundInert(false);
    if(restoreFocus)exportThemeOpener?.focus?.();
    exportThemeOpener=null;
  };
  const openExportThemeDialog=()=>{
    if(typeof bridge.openModal!=="function")return;
    exportThemeOpener=document.activeElement;
    const picker=renderThemePicker(store.document)
      .replace(
        /(<div class="theme-picker-popover"[^>]*?)\s+hidden>/,
        "$1>"
      );
    bridge.openModal(`<section class="export407FThemeDialog" role="dialog" aria-modal="true" aria-label="Choose theme">
      <div class="export407FDialogHeader">
        <h2>Theme</h2>
        <button type="button" class="btnD alt sm" data-export-theme-close>Close</button>
      </div>
      ${picker}
    </section>`);
    const dialog=document.querySelector(".export407FThemeDialog");
    if(dialog){
      exportThemeTrap=installFocusTrap(dialog,{
        opener:exportThemeOpener,
        restoreFocus:false,
        initialFocus:true,
        onEscape:()=>closeExportThemeDialog()
      });
    }
    onExportThemeBackdrop=(event)=>{
      if(event.target?.id!=="modalBk")return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeExportThemeDialog();
    };
    document.getElementById("modalBk")?.addEventListener(
      "click",
      onExportThemeBackdrop,
      true
    );
    previewBackgroundInert(true);
    document.querySelector("[data-export-theme-close]")?.addEventListener("click",()=>{
      closeExportThemeDialog();
    },{once:true});
    document.querySelectorAll("#modalIn [data-select-theme]").forEach((button)=>{
      button.addEventListener("click",()=>{
        store.mutate("Change theme",(document)=>{
          document.theme=button.dataset.selectTheme;
        });
        closeExportThemeDialog({restoreFocus:false});
        syncBridgeFromStore();
        queueExportRender({focusSelector:"[data-export-theme-trigger]"});
      },{once:true});
    });
    document.querySelector("#modalIn [data-open-backgrounds]")?.addEventListener("click",()=>{
      closeExportThemeDialog({restoreFocus:false});
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
  const currentResponsiveModel=()=>responsiveRuntime?.state||buildResponsiveModel({
    width:window.innerWidth,
    height:window.innerHeight,
    maxTouchPoints:window.navigator?.maxTouchPoints||0,
    reducedMotion:window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    higherContrast:window.matchMedia?.("(prefers-contrast: more)")?.matches,
    forcedColors:window.matchMedia?.("(forced-colors: active)")?.matches
  });
  function renderExportHost(){
    const exportHost=document.getElementById("export407F");
    if(!exportHost)return;
    exportController?.destroy();
    const exportDocument=timelineWithLorPresentation(store.document);
    let previewHtml="";
    if((exportDocument.events||[]).length){
      try{
        previewHtml=renderExportPreview(
          buildExportPreviewInput(exportDocument,exportState)
        );
      }catch(error){
        bridge.toast(String(error?.message||error));
      }
    }
    const responsive=currentResponsiveModel();
    if(responsive.screens.export.contentMode==="preview-only"){
      exportHost.innerHTML=`<div class="export407FPhonePreview" data-responsive-screen="export" data-responsive-tier="${responsive.tier.id}" data-responsive-mode="preview-only">
        <h1>Export</h1>
        <div class="responsive407FBanner" role="status">Editing needs a larger screen.</div>
        <div class="export407FPhoneBoard">${previewHtml||"<p>Add an event in Builder to preview your export.</p>"}</div>
      </div>`;
      api.export=Object.freeze({
        state:"preview-only",
        refreshPreview:renderExportHost,
        destroy(){}
      });
      return;
    }
    exportHost.innerHTML=renderExportScreen(exportDocument,{
      state:exportState,
      previewHtml,
      entitlement:store.entitlement
    });
    exportController=installExportScreen(exportHost,exportDocument,{
      state:exportState,
      entitlement:store.entitlement,
      getEntitlement:()=>store.entitlement,
      renderPreview:renderExportPreview,
      exportAdapter,
      toast:(message)=>bridge.toast(message),
      requestVersion:(label,kind)=>store.saveVersion(label,kind),
      onStateChange:(state,reason)=>{
        exportState=state;
        if(store.entitlement.canMutate===true){
          store.mutate(
            "Persist export settings",
            (document)=>{document.exportState=clone(state);},
            {history:false,material:false}
          );
        }
        if([
          "format",
          "print-margins",
          "export-finish"
        ].includes(reason)){
          queueExportRender();
        }else if(reason==="audience"){
          queueExportRender({focusSelector:"[data-export-audience]"});
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
  const applyAdvisorResult=(result,{history=true}={})=>{
    if(!result?.document)return result;
    store.replace(result.document,{
      label:result.mutation?.label||"Update advisor review",
      history
    });
    syncBridgeFromStore();
    if(bridge.state.view==="advisor")queueMicrotask(renderAdvisorHost);
    if(bridge.state.view==="export")queueExportRender();
    return result;
  };
  const advisorAction=(action)=>{
    try{
      return action();
    }catch(error){
      bridge.toast(String(error?.message||error));
      return null;
    }
  };
  const advisorBoardHtml=()=>{
    const forced={
      ...clone(store.document),
      theme:ADVISOR_SESSION_THEME_ID,
      mode:"guided"
    };
    const rendered=render407FThemedBoard(forced,{
      currentMonth:currentMonth(),
      audience:"EVERYTHING"
    });
    return`<div class="advisor407FBoardRender" data-theme="${ADVISOR_SESSION_THEME_ID}" data-audience="EVERYTHING">${rendered.svg}</div>`;
  };
  function renderAdvisorHost(){
    const advisorHost=document.getElementById("advisor407F");
    if(!advisorHost)return;
    advisorCleanup();
    let boardHtml="";
    try{
      boardHtml=advisorBoardHtml();
    }catch(error){
      bridge.toast(String(error?.message||error));
    }
    advisorHost.innerHTML=renderAdvisorSession(store.document,{
      route:store.document.advisor?.route,
      boardHtml,
      editingCommentId:advisorEditingCommentId
    });
    advisorCleanup=installAdvisorWorkflow(advisorHost,{
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
        const question=[...model.visible,...model.hidden]
          .find(({id})=>id===questionId);
        if(!question)return;
        const effect=questionHighlightEffect(question,{
          reducedMotion:window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
        });
        const targets=effect.eventIds.flatMap((eventId)=>[
          ...advisorHost.querySelectorAll(
            `[data-event-id="${CSS.escape(eventId)}"]`
          )
        ]);
        const nodes=targets.length
          ?targets
          :[advisorHost.querySelector("[data-advisor-board]")].filter(Boolean);
        nodes.forEach((node)=>node.classList.add("advisor-question-highlight"));
        clearTimeout(advisorHighlightTimer);
        advisorHighlightTimer=setTimeout(
          ()=>nodes.forEach((node)=>node.classList.remove("advisor-question-highlight")),
          effect.animation==="none"?0:effect.durationMs
        );
      },
      onPin:(commentId)=>{
        advisorEditingCommentId=commentId;
        renderAdvisorHost();
      },
      onCreatePin:(position)=>{
        const result=advisorAction(()=>addAdvisorComment(store.document,position));
        if(!result)return;
        advisorEditingCommentId=result.comment.id;
        applyAdvisorResult(result,{history:false});
      },
      onSaveComment:({id,note})=>{
        advisorEditingCommentId=null;
        const result=advisorAction(
          ()=>updateAdvisorComment(store.document,id,note)
        );
        if(result)applyAdvisorResult(result,{history:false});
      },
      onEditComment:(commentId)=>{
        advisorEditingCommentId=commentId;
        renderAdvisorHost();
      },
      onDeleteComment:(commentId)=>{
        advisorEditingCommentId=null;
        const result=advisorAction(
          ()=>deleteAdvisorComment(store.document,commentId)
        );
        if(result)applyAdvisorResult(result,{history:false});
      },
      onResolveComment:(commentId)=>{
        const result=advisorAction(
          ()=>resolveAdvisorComment(store.document,commentId)
        );
        if(result)applyAdvisorResult(result);
      },
      onApprove:()=>{
        const result=advisorAction(()=>approveAdvisorReview(store.document));
        if(result)applyAdvisorResult(result);
      },
      onRequestChanges:()=>{
        const result=advisorAction(()=>requestAdvisorChanges(store.document));
        if(result)applyAdvisorResult(result);
      },
      onAnnounce:(message)=>{
        const live=advisorHost.querySelector("[data-advisor-live]");
        if(live)live.textContent=message;
      }
    });
    api.advisor=Object.freeze({
      route:store.document.advisor?.route||null,
      active:advisorHost.querySelector("[data-advisor-session]")?.dataset.advisorSession==="active",
      render:renderAdvisorHost
    });
  }
  on407FRendered=()=>{
    applyEntitlementSurface();
    if(bridge.state.view==="export")queueExportRender();
    if(bridge.state.view==="advisor")queueMicrotask(renderAdvisorHost);
    if(bridge.state.view==="builder"){
      queueBuilderEmbeddedPreview();
      queueMicrotask(renderM9BuilderSurfaces);
    }
    if(["builder","canvas","media"].includes(bridge.state.view)){
      queueMicrotask(renderMediaLibrarySurfaces);
    }
    requestAnimationFrame(applyEntitlementSurface);
  };
  document.addEventListener("d1:407f-rendered",on407FRendered);
  onAdvisorHashChange=()=>{
    const route=decodeURIComponent(String(window.location.hash||"").replace(/^#/,""));
    if(route.startsWith("advisor-session:"))bridge.go("advisor");
  };
  window.addEventListener("hashchange",onAdvisorHashChange);
  const commitExamMutation=(label,mutation)=>{
    let result=null;
    store.mutate(label,(document)=>{
      apply407FStateToDocument(bridge.state,document);
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
      return commitExamMutation("Finish Builder exams",(document)=>
        finalizeBuilderExams(document)
      );
    },
    restoreRetake(targetAttemptId){
      return commitExamMutation("Restore automatic retake",(document)=>
        restoreBuilderAutomaticRetake(document,targetAttemptId)
      );
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
      return commitDomainMutation(`Save ${domain} entry`,(document)=>{
        const normalized=clone(entry||{});
        const builder=ensureBuilderState(document);
        const editingEntryId=builder.editing?.[domain]||"";
        const previousEvent=editingEntryId
          ?document.events.find((candidate)=>
            candidate?.fields?.builderEntryId===editingEntryId
          )
          :null;
        const previousLorStatuses=clone(
          previousEvent?.fields?.lorStatusesByTarget||{}
        );
        const result=commitBuilderEntry(document,domain,normalized);
        if(domain!=="clinical"||result?.ok===false||!result?.event){
          return result;
        }
        const event=document.events.find(
          (candidate)=>candidate.id===result.event.id
        )||result.event;
        const rotationId=String(
          event?.fields?.builderEntryId||event?.id||""
        );
        const target=lorTargetForRotation(
          document,
          event,
          normalized.lorTargetSpecialtyId
        );
        if(rotationId&&target.id){
          event.fields={
            ...(event.fields||{}),
            preceptor:normalized.preceptor||"",
            lorStatus:normalized.lorStatus||"not-requested",
            lorTargetSpecialtyId:target.id,
            lorStatusesByTarget:{
              ...previousLorStatuses,
              [target.id]:normalized.lorStatus||"not-requested"
            }
          };
          document.rotationLor=setRotationLorStatus(
            rotationLorStateFromDocument(document),
            {
              rotationId,
              targetSpecialtyId:target.id,
              status:normalized.lorStatus||"not-requested"
            }
          );
        }
        return result;
      });
    },
    edit(eventId){
      return commitDomainMutation("Edit Builder entry",(document)=>{
        const edited=beginBuilderEntryEdit(document,eventId);
        const event=document.events.find((candidate)=>candidate.id===eventId);
        if(!edited||event?.categoryId!=="clinical")return edited;
        const rotationId=String(
          event?.fields?.builderEntryId||event?.id||""
        );
        const target=lorTargetForRotation(document,event);
        const builder=ensureBuilderState(document);
        if(rotationId&&target.id){
          const status=rotationLorStatus(
            rotationLorStateFromDocument(document),
            {rotationId,targetSpecialtyId:target.id}
          );
          builder.drafts.clinical={
            ...builder.drafts.clinical,
            lorStatus:status.statusId,
            lorTargetSpecialtyId:target.id
          };
        }
        return edited;
      });
    },
    delete(eventId){
      return commitDomainMutation("Delete Builder entry",(document)=>{
        const event=document.events.find((candidate)=>candidate.id===eventId);
        const rotationId=String(
          event?.fields?.builderEntryId||event?.id||""
        );
        const deleted=deleteBuilderEntry(document,eventId);
        if(deleted&&rotationId){
          document.rotationLor=createRotationLorState(
            (document.rotationLor?.records||[]).filter(
              (record)=>record?.rotationId!==rotationId
            )
          );
        }
        return deleted;
      });
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
  api.lor=Object.freeze({
    options(){
      return clone(LOR_GUIDED_STATUS_OPTIONS);
    },
    context(rotationSpecialty=""){
      const current=clone(store.document);
      apply407FStateToDocument(bridge.state,current);
      const active=activeTargetSpecialty(current);
      if(active.id)return active;
      const label=String(rotationSpecialty||"").trim();
      return{id:normalizeSpecialtyId(label),label};
    },
    status(rotationId,targetSpecialtyId){
      const current=clone(store.document);
      apply407FStateToDocument(bridge.state,current);
      return clone(rotationLorStatus(rotationLorStateFromDocument(current),{
        rotationId,
        targetSpecialtyId
      }));
    },
    derived(status){
      return clone(deriveLorState(status));
    },
    queue(eventId){
      return commitDomainMutation("Queue LOR Builder to-do",(document)=>{
        const event=document.events.find((candidate)=>candidate.id===eventId);
        if(event?.categoryId!=="clinical"){
          return{
            status:"unavailable",
            productionCreated:false,
            message:"Nothing was queued because the rotation was not found."
          };
        }
        const rotationId=String(
          event.fields?.builderEntryId||event.id||""
        );
        const target=lorTargetForRotation(document,event);
        if(!rotationId||!target.id){
          return{
            status:"unavailable",
            productionCreated:false,
            message:"Choose a target specialty before creating the LOR to-do."
          };
        }
        const status=rotationLorStatus(
          rotationLorStateFromDocument(document),
          {rotationId,targetSpecialtyId:target.id}
        );
        const specialty=rotationSpecialtyReference(event);
        const queued=lorBuilderAdapter.queue(
          createLorBuilderQueueState(
            document.lorBuilderQueue?.commands||[]
          ),
          {
            studentId:document.studentProfile?.id||"",
            timelineId:document.id||"timeline-local",
            rotationId,
            institution:event.fields?.institution||event.siteName||"",
            specialty,
            preceptor:event.fields?.preceptor||"",
            rotationDates:{
              startDate:
                event.fields?.rotationStartDate||event.startDate||"",
              endDate:
                event.fields?.rotationEndDate||
                event.endDate||
                (event.openEnded?"present":"")
            },
            currentStatus:status.statusId,
            requestedTargetSpecialty:target
          }
        );
        document.lorBuilderQueue=queued.state;
        return clone(queued.result);
      });
    }
  });
  api.typeahead=Object.freeze({
    rows(query,matches,options){
      return typeaheadRows(query,clone(matches||[]),clone(options||{}));
    },
    rankCountries(matches,options){
      return rankCountryMatches(clone(matches||[]),clone(options||{}));
    },
    rankSpecialties(matches,options){
      return rankSpecialtyMatches(clone(matches||[]),clone(options||{}));
    },
    specialty(label){
      return specialtyOption(label);
    },
    normalizeSpecialtyId(label){
      return normalizeSpecialtyId(label);
    }
  });
  api.schoolRegistry=Object.freeze({
    search(query,filters={}){
      return runtimeDatasets.schools.search(query,{
        ...clone(filters||{}),
        limit:Math.min(20,Math.max(1,Number(filters?.limit)||10))
      });
    },
    countries(){
      return runtimeDatasets.schools.countries();
    },
    metadata(){
      return runtimeDatasets.schools.metadata();
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
  unsubscribeStore=store.subscribe(()=>{
    reflectStoreStatus();
    applyEntitlementSurface();
    const entitlementEditable=store.entitlement.canMutate===true;
    if(
      canvasController&&
      canvasController.state.entitlementEditable!==entitlementEditable
    ){
      canvasController.setUiState((state)=>({
        ...state,
        entitlementEditable
      }));
    }
    queueBuilderEmbeddedPreview();
    if(store.entitlement.canMutate!==true)return;
    if(approvalReconciling)return;
    const approval=reconcileApprovalFingerprint(store.document);
    if(!approval.changed)return;
    approvalReconciling=true;
    store.replace(approval.document,{
      label:"Mark advisor approval edited",
      history:false
    });
    approvalReconciling=false;
  });

  const canvasHost=document.getElementById("canvas407F");
  if(canvasHost){
    const syncCanvasDocument=()=>{
      if(canvasSyncing)return;
      canvasSyncing=true;
      syncBridgeFromStore();
      reflectStoreStatus();
      queueMicrotask(()=>api.dateControls.install(canvasHost));
      canvasSyncing=false;
    };
    canvasController=installCanvas(canvasHost,store,{
      state:{
        ...createCanvasState({
          viewportWidth:window.innerWidth,
          mode:store.document.mode
        }),
        entitlementEditable:store.entitlement.canMutate===true
      },
      renderBoard:renderResponsiveAdvancedBoard,
      renderTheme:(document)=>renderThemePicker(document),
      renderAdvanced:(document,options)=>renderAdvancedStudio(document,{
        ...options,
        themeSwatches:THEMES_BY_ID[document.theme]
      }),
      renderCommentLayer:(document,state)=>renderStudentCommentLayer(document,{
        visible:state.commentsOpen,
        activePinId:state.activeAdvisorPinId,
        context:"canvas"
      }),
      renderDetails:(route,event)=>renderCanvasDetails(route,event,store.document),
      onStateChange:syncCanvasDocument,
      onOpenBuilder:()=>bridge.go("builder"),
      onDateControl:({edge,event})=>{
        canvasController?.setUiState({detailsEventId:event.id});
        queueMicrotask(()=>{
          const domain=event.fields?.builderDomain||event.categoryId;
          const selector=domain==="clinical"
            ?`[data-canvas-rotation-date="${edge==="end"?"rotationEndDate":"rotationStartDate"}"]`
            :`[data-canvas-detail-key="${edge==="end"?"endDate":"startDate"}"]`;
          canvasHost.querySelector(selector)?.focus();
        });
      },
      onAdvanced:()=>requestCanvasMode("advanced"),
      onGuided:()=>requestCanvasMode("guided"),
      onResolveAdvisorComment:(commentId)=>{
        const result=advisorAction(
          ()=>resolveAdvisorComment(store.document,commentId)
        );
        if(result)applyAdvisorResult(result);
      },
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
        const selectedBefore=store.document.events.find(
          (item)=>String(item.id)===String(eventId)
        );
        const clinical=(selectedBefore?.fields?.builderDomain||
          selectedBefore?.categoryId)==="clinical";
        if(clinical){
          const startInput=form.querySelector(
            '[data-canvas-rotation-date="rotationStartDate"]'
          );
          const endInput=form.querySelector(
            '[data-canvas-rotation-date="rotationEndDate"]'
          );
          const start=parseExactDate(
            startInput?.dataset?.dateCanonical||startInput?.value
          );
          const end=selectedBefore.openEnded
            ?null
            :parseExactDate(endInput?.dataset?.dateCanonical||endInput?.value);
          const error=!start
            ?"Choose the exact rotation start date."
            :(!selectedBefore.openEnded&&!end)
              ?"Choose the exact rotation end date."
              :end<start
                ?"End date is before the start date."
                :"";
          if(error){
            const target=!start?startInput:endInput;
            const message=target?.closest(
              "[data-exact-date-field]"
            )?.querySelector(".field-error");
            if(message)message.textContent=error;
            target?.setAttribute("aria-invalid","true");
            target?.focus();
            return;
          }
        }
        store.mutate("Edit timeline event details",(document)=>{
          const selected=document.events.find((item)=>String(item.id)===String(eventId));
          if(!selected)return;
          for(const input of form.querySelectorAll("[data-canvas-detail-key]")){
            const key=input.dataset.canvasDetailKey;
            selected[key]=["startDate","endDate"].includes(key)
              ?(input.dataset.dateCanonical||parseMonth(input.value)||"")
              :input.value;
          }
          for(const input of form.querySelectorAll("[data-canvas-detail-field]")){
            const key=input.dataset.canvasDetailField;
            selected.fields={...(selected.fields||{}),[key]:input.type==="checkbox"?input.checked:input.value};
          }
          selected.fields={
            ...(selected.fields||{}),
            exportAudiences:Array.from(
              form.querySelectorAll("[data-canvas-export-audience]:checked"),
              (input)=>input.dataset.canvasExportAudience
            )
          };
          selected.title=String(selected.title||"").trim()||"Untitled event";
          if(clinical){
            const rotationStart=form.querySelector(
              '[data-canvas-rotation-date="rotationStartDate"]'
            );
            const rotationEnd=form.querySelector(
              '[data-canvas-rotation-date="rotationEndDate"]'
            );
            const projection=projectRotationDates({
              startDate:selected.startDate,
              endDate:selected.endDate,
              current:selected.openEnded,
              rotationStartDate:rotationStart?.dataset?.dateCanonical||
                parseExactDate(rotationStart?.value),
              rotationEndDate:rotationEnd?.dataset?.dateCanonical||
                parseExactDate(rotationEnd?.value)
            });
            selected.startDate=projection.startDate;
            selected.endDate=projection.endDate;
            selected.fields={
              ...(selected.fields||{}),
              rotationStartDate:projection.rotationStartDate,
              rotationEndDate:projection.rotationEndDate,
              rotationDatePrecision:projection.rotationDatePrecision
            };
          }
          if(selected.eventType!=="milestone"){
            selected.endDate=selected.endDate||null;
            selected.openEnded=!selected.endDate;
          }
          const active=activeSpecialtyVariant(document);
          const visible=form.querySelector("[data-canvas-variant-visible]")?.checked!==false;
          setVariantEventHidden(document,active.id,selected.id,!visible);
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
  if(document.getElementById("advisor407F"))renderAdvisorHost();
  onAdvisorHashChange();
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
        const rendered=render407FThemedBoard({
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
        if(store.entitlement.canMutate===true){
          store.mutate("Update Intake flow",(document)=>{
            document.intake=persistedIntakeState(state);
          },{history:false,material:false});
        }
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
  const announceGlobal=(message)=>{
    const live=document.getElementById("globalLive407F");
    if(!live)return;
    live.textContent="";
    queueMicrotask(()=>{live.textContent=String(message||"");});
  };
  const applyHistory=(direction)=>{
    const entry=store[direction]();
    if(!entry)return null;
    applying=true;
    applyDocumentTo407FState(store.document,bridge.state);
    bridge.renderAll();
    canvasController?.render();
    reflectStoreStatus();
    lastState=stableState(bridge.state);
    applying=false;
    announceGlobal(`${direction==="undo"?"Undid":"Redid"} ${entry.label}`);
    return entry;
  };
  api.undo=()=>applyHistory("undo");
  api.redo=()=>applyHistory("redo");

  const closeOwnedModal=()=>{
    if(builderPreviewTrap){
      closeBuilderPreview();
      return;
    }
    shortcutTrap?.destroy();
    shortcutTrap=null;
    fileVaultTrap?.destroy();
    fileVaultTrap=null;
    bridge.closeModal?.();
  };
  const fileVaultSource=resolveFileVaultSourceAdapter(
    window.MISSIONMED_FILEVAULT_SOURCE_ADAPTER
  );
  let fileVaultQuerySequence=0;
  const openFileVaultSource=async(query="")=>{
    const sequence=++fileVaultQuerySequence;
    const model=await queryFileVaultSource(fileVaultSource,{query});
    if(sequence!==fileVaultQuerySequence)return;
    bridge.openModal?.(renderFileVaultSourceChooser(model));
    const dialog=document.querySelector("[data-file-vault-source-dialog]");
    const search=document.querySelector("[data-file-vault-source-search]");
    const continueButton=document.querySelector("[data-file-vault-source-continue]");
    document.querySelector("[data-file-vault-source-close]")?.addEventListener(
      "click",
      closeOwnedModal,
      {once:true}
    );
    document.querySelectorAll('input[name="file-vault-source"]').forEach((radio)=>{
      radio.addEventListener("change",()=>{
        if(continueButton)continueButton.disabled=!radio.checked;
      });
    });
    continueButton?.addEventListener("click",async()=>{
      const selected=document.querySelector('input[name="file-vault-source"]:checked');
      if(!selected)return;
      try{
        await selectFileVaultSourceDocument(fileVaultSource,selected.value);
        closeOwnedModal();
        bridge.go("intake");
      }catch(error){
        bridge.toast(String(error?.message||error));
      }
    });
    let searchTimer=null;
    search?.addEventListener("input",()=>{
      clearTimeout(searchTimer);
      searchTimer=setTimeout(()=>openFileVaultSource(search.value),180);
    });
    if(dialog){
      fileVaultTrap?.destroy();
      fileVaultTrap=installFocusTrap(dialog,{onEscape:closeOwnedModal});
      queueMicrotask(()=>search?.focus());
    }
  };
  onHomeFileVault=()=>openFileVaultSource().catch((error)=>{
    bridge.toast(String(error?.message||error));
  });
  document.getElementById("homeFileVault")?.addEventListener("click",onHomeFileVault);
  const openShortcuts=()=>{
    bridge.openModal?.(`<section class="shortcut407FDialog" role="dialog" aria-modal="true" aria-labelledby="shortcut407FTitle" data-shortcut-dialog>
      <div class="shortcut407FHeader">
        <h2 id="shortcut407FTitle">Keyboard shortcuts</h2>
        <button type="button" class="btnD alt sm" data-shortcut-close>Close</button>
      </div>
      <dl class="shortcut407FList">
        <div><dt><kbd>⌘/Ctrl Z</kbd></dt><dd>Undo</dd></div>
        <div><dt><kbd>⇧ ⌘/Ctrl Z</kbd></dt><dd>Redo</dd></div>
        <div><dt><kbd>⌘/Ctrl E</kbd></dt><dd>Go to Export</dd></div>
        <div><dt><kbd>Esc</kbd></dt><dd>Close or deselect</dd></div>
        <div><dt><kbd>?</kbd></dt><dd>Show this shortcut sheet</dd></div>
        <div><dt><kbd>F2</kbd></dt><dd>Focus the selected event toolbar</dd></div>
      </dl>
    </section>`);
    const dialog=document.querySelector("[data-shortcut-dialog]");
    document.querySelector("[data-shortcut-close]")?.addEventListener("click",closeOwnedModal,{once:true});
    if(dialog){
      shortcutTrap=installFocusTrap(dialog,{
        onEscape:closeOwnedModal
      });
    }
  };
  const isEditableTarget=(target)=>Boolean(
    target?.closest?.("input, textarea, select, [contenteditable='true']")
  );
  onGlobalKeydown=(event)=>{
    if(event.defaultPrevented)return;
    const key=String(event.key||"");
    const lower=key.toLowerCase();
    const command=event.metaKey||event.ctrlKey;
    if(command&&lower==="z"&&!isEditableTarget(event.target)){
      event.preventDefault();
      if(store.entitlement.canMutate!==true){
        bridge.toast(store.entitlement.reason);
        return;
      }
      (event.shiftKey?api.redo:api.undo)();
      return;
    }
    if(command&&lower==="e"){
      event.preventDefault();
      bridge.go("export");
      announceGlobal("Opened Export");
      return;
    }
    if(key==="?"&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!isEditableTarget(event.target)){
      event.preventDefault();
      openShortcuts();
      return;
    }
    if(key!=="Escape")return;
    if(!document.getElementById("mediaDrawer407F")?.hidden){
      event.preventDefault();
      closeMediaLibrary();
      return;
    }
    if(document.getElementById("modalBk")?.classList.contains("on")){
      event.preventDefault();
      closeOwnedModal();
      return;
    }
    if(bridge.state.view==="canvas"&&canvasController?.state?.selectedEventId){
      event.preventDefault();
      canvasController.setUiState({
        selectedEventId:null,
        toolbarFocus:false,
        categoryMenuOpen:false,
        addEventOpen:false,
        contextMenu:null
      });
      announceGlobal("Timeline selection cleared");
    }
  };
  document.addEventListener("keydown",onGlobalKeydown);

  onBuilderPreview=()=>{
    builderPreviewOpener=document.activeElement;
    builderPreviewZoom=createCanvasZoom("fit");
    bridge.openModal?.(`<section class="builderPreview407FSheet" role="dialog" aria-modal="true" aria-labelledby="builderPreview407FTitle" data-builder-preview-sheet>
      <div class="builderPreview407FHeader">
        <div>
          <h2 id="builderPreview407FTitle">Full timeline preview</h2>
          <p id="builderPreview407FHelp">${store.entitlement.canMutate===true
            ?"Use arrow keys to move between timeline items. Press Enter to edit."
            :"Review the timeline at Fit, 100%, or 150% zoom. Editing is unavailable in read-only access."
          }</p>
        </div>
        <button type="button" class="btnD alt sm" data-builder-preview-close>Close preview</button>
      </div>
      <div class="builderPreview407FToolbar" role="toolbar" aria-label="Preview zoom">
        ${BUILDER_PREVIEW_ZOOM_PRESETS.map(({id,label})=>`<button type="button" class="btnD alt sm" data-builder-preview-zoom="${id}" aria-pressed="${id==="fit"}">${label}</button>`).join("")}
      </div>
      <div class="builderPreview407FViewport" data-builder-preview-viewport>
        <div class="builderPreview407FCanvas" data-builder-preview-canvas></div>
      </div>
    </section>`);
    const dialog=document.querySelector("[data-builder-preview-sheet]");
    const canvas=document.querySelector("[data-builder-preview-canvas]");
    mountBuilderPreview(canvas,{
      surface:"lightbox",
      namespace:"d1-405-builder-lightbox",
      force:true
    });
    applyBuilderPreviewZoom();
    previewBackgroundInert(true);
    onBuilderPreviewBackdrop=(event)=>{
      if(event.target?.id!=="modalBk")return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeBuilderPreview();
    };
    document.getElementById("modalBk")?.addEventListener(
      "click",
      onBuilderPreviewBackdrop,
      true
    );
    if(dialog){
      builderPreviewTrap=installFocusTrap(dialog,{
        opener:builderPreviewOpener,
        onEscape:()=>closeBuilderPreview({restoreFocus:false})
      });
    }
  };
  document.getElementById("builderPreviewToggle")?.addEventListener("click",onBuilderPreview);

  onRouteRendered=()=>{
    const active=document.querySelector("section[data-view].live");
    if(!active)return;
    const view=String(active.dataset.view||"");
    if(view==="builder")renderM9BuilderSurfaces();
    if(!["builder","canvas"].includes(view))closeMediaLibrary();
    if(["builder","canvas","media"].includes(view))renderMediaLibrarySurfaces();
    if(view===lastFocusedView)return;
    const result=focusScreenHeading(active,{
      previousViewKey:lastFocusedView,
      nextViewKey:view
    });
    if(result.focused)lastFocusedView=view;
  };
  document.addEventListener("d1:407f-rendered",onRouteRendered);

  responsiveRuntime=installResponsiveRuntime({
    windowObject:window,
    documentObject:document,
    target:document.documentElement,
    onChange:(model)=>{
      api.responsive=model;
      canvasController?.setResponsiveWidth(model.viewport.width);
      const active=document.querySelector("section[data-view].live");
      if(active){
        const screen=bridge.state.view==="command"?"home":bridge.state.view;
        active.dataset.responsiveScreen=screen;
        active.dataset.responsiveTier=model.tier.id;
        active.dataset.responsiveMode=model.screens[screen]?.contentMode||"full";
      }
      if(bridge.state.view==="export")queueExportRender();
    },
    onMotionChange:(motion)=>{
      renderMediaLibrarySurfaces();
      canvasController?.render();
      queueBuilderEmbeddedPreview({force:true});
      if(bridge.state.view==="export")queueExportRender();
      announceGlobal(
        motion.reduced?"Reduced motion enabled":"Standard motion enabled"
      );
    }
  });
  api.responsive=responsiveRuntime.state;
  onRouteRendered();

  window.D1_407F_ENGINEERING=api;
  bridge.renderAll();
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
