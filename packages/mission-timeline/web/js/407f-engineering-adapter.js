import {TimelineStore} from "./uxr-002/store.js";
import {prepareTimelineProductionRuntime} from "./production/timeline-production-runtime.js";
import {installFamilyRuntime022} from "./production/family-runtime-022.js";
import {attachSelectedSubjectDialog022} from "./production/selected-subject-context-022.js";
import {qualitySourceText022,qualitySourceSha022,persistQualityReport022,recordCompletedExport022,restoreServerGuardian022} from "./production/quality-state-022.js";
import {reconcileRestoredProviderTruth022} from "./production/provider-receipt-022.js";
import {
  addBuilderExam,
  deleteBuilderExamAttempt,
  finalizeBuilderExams,
  normalizeExamDocument,
  selectedBuilderExamSystems,
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
import {createRuntimeDatasets,browserCountryRows} from "./uxr-002/datasets.js";
import {bindImportedBuilderEvent022,builderDomain022,isImportedBuilderEvent022,importedBuilderSummary022,importedDraftFromForm022,renderImportedBuilderForm022,validateImportedBuilderDraft022,importedCanvasDateField022,updateImportedCanvasDetails022} from "./uxr-002/imported-builder-entry-022.js";
import {
  buildCompletenessSummary,
  computeStoryChecks
} from "./uxr-002/review.js";
import {
  analyzeTimelineQuality,
  applySafeQualityFixes,
  deterministicFindingsForAi,
  mergeAiQualityAnalysis,
  qualityGuardianViewer,
  renderQualityGuardian
} from "./uxr-002/quality-guardian.js";
import {
  appendTimelineAiFeedback,
  classifyTimelineAiCandidateOutcome
} from "./uxr-002/ai-feedback.js";
import {
  beginCanvasDrag,
  commitCanvasDrag,
  createCanvasState,
  deleteCanvasEvent,
  installCanvas,
  redoCanvas,
  undoCanvas,
  updateCanvasDrag
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
  MEDIA_LIBRARY_ACCEPT,
  createMediaLibraryAsset,
  mediaKindForFile,
  mediaLibraryMarkup,
  nudgeMediaLibraryAsset,
  placeMediaLibraryAsset,
  removeMediaLibraryAsset,
  replaceMediaLibraryAsset,
  unplaceMediaLibraryAsset
} from "./uxr-002/media-library.js";
import {assignStableLanes} from "./uxr-002/adaptive-layout.js";
import {createAdvancedBoardRenderer} from "./uxr-002/advanced-board.js";
import {
  applyAdvancedObjectAction,
  applyAdvancedTypography,
  applyModeSwitch,
  constrainAdvancedObjectToBoard,
  createFlatColorBackground,
  createAdvancedElement,
  createMediaElement,
  createPresetBackground,
  createTextBlock,
  createUploadedBackground,
  installAdvancedStudio,
  groupAdvancedObjects,
  moveMediaElement,
  panMediaCrop,
  planModeSwitch,
  recordRecentColor,
  renderAdvancedStudio,
  renderModeDialog,
  resetAxisPresentationOverride,
  resetColorKeyGeometryPresentationOverride,
  resetCategoryKeyPresentationOverride,
  resizeMediaElement,
  relativeLuminanceFromRgb,
  sampleEyeDropper,
  snapAdvancedObjectToBoard,
  FREE_TEXT_SIZE,
  setBackgroundDim,
  setAxisPresentationOverride,
  setAxisSegmentWeights,
  placeAdvancedObjectAt,
  setAdvancedObjectGeometry,
  setCategoryKeyPresentationOverride,
  setColorKeyGeometryPresentationOverride,
  setLayoutLock,
  setAdvancedObjectLock,
  setAdvancedObjectAspectLock,
  setMediaAspectLock,
  ungroupAdvancedObjects,
  updateMediaPresentation,
  advancedLayerRows,
  toggleAdvancedSelection,
  reorderAdvancedLayers,
  CANONICAL_MEDIA_FRAME_SLOTS,
  hitTestMediaFrames,
  fillCanonicalMediaFrame,
  updateTextContainerPresentation,
  updateTextBlockContent,
  validateBackgroundUpload,
  validateMediaUpload
} from "./uxr-002/advanced-studio.js";
import {applySceneCommandToDocument} from "./editor/scene-commands.js";
import {reconcileAdvancedScene} from "./editor/scene-graph.js";
import {resizeSceneGeometry,rotateSceneGeometry} from "./editor/scene-interaction.js";
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
import {
  createD1411AKernelManager
} from "./d1-411a/kernel-host.js";
import {createLocalExportAdapter} from "./uxr-002/export-adapter.js";
import {
  FOUNDER_PRESENTATION_SERIALIZER,
  serializeFounderPresentation
} from "./presentation/founder-presentation-serializer.js";
import {
  IntakeStateMachine,
  applyApprovalBatchToDocument,
  installIntake,
  renderIntake
} from "./uxr-002/intake.js";
import {
  createD1408PdfIntakeAdapter,
  createProductionCvIntakeAdapter
} from "./uxr-002/intake-d1-408-adapter.js";
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
  installResponsiveRuntime,
  renderResponsiveNotice
} from "./uxr-002/responsive.js";
import {
  studentAccessMessage,
  studentDiagnostic,
  studentError,
  studentMessage
} from "./uxr-002/student-language.js";
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

const EMPTY_407F_WIZARD=Object.freeze({
  name:"",school:"",canonicalSchoolId:"",schoolRecord:null,
  schoolEntryMode:"registry",schoolVerificationStatus:"",
  schoolNormalizationStatus:"",schoolAnalyticsEligible:false,
  schoolUnlistedSubmission:null,schoolCountryFilter:"",schoolTypeFilter:"",
  schoolCity:"",country:"",grad:"",notGraduated:false,degree:"",
  degreeOther:"",visa:"",visaOther:"",eadStatus:"",
  residencyVisaTypesOpenTo:"",s1a:"",s1b:"",s2a:"",s2b:"",
  cla:"",clb:"",tha:"",thb:"",ra:"",rb:"",pt:"",pd:"",
  padv:false,ip:"",idt:""
});

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

export function event407FToDocument(event,index=0,canonicalSource=null){
  const result={
    ...clone(canonicalSource||{}),
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
    fields:{
      ...clone(canonicalSource?.fields||{}),
      ...clone(event.fields||{}),
      legacy407fCategory:event.cat||"personal"
    }
  };
  for(const key of [
    "dangerDot","provisional","actionChip","fillStyle","fillOpacity",
    "outlineStyle"
  ]){
    if(!Object.hasOwn(result,key))continue;
    const fieldKey=key;
    if(!Object.hasOwn(event.fields||{},fieldKey))delete result[key];
  }
  return result;
}

export function applyDocumentTo407FState(document,state){
  const profile=document.studentProfile||{};
  const targetSpecialty=activeTargetSpecialty(document);
  const authorization=normalizeWorkAuthorization(profile);
  const canonicalEvents=(document.events||[]);
  const renderableEvents=canonicalEvents.filter(
    (event)=>String(event?.startDate||"").trim()
  );
  state.user.events=renderableEvents.map(documentEventTo407F);
  state.user.canonicalEventPayloads=Object.fromEntries(
    canonicalEvents
      .filter((event)=>event?.id)
      .map((event)=>[String(event.id),clone(event)])
  );
  state.user.canonicalEventOrder=canonicalEvents.map((event,index)=>({
    id:String(event?.id||""),
    index,
    renderable:String(event?.startDate||"").trim().length>0,
    event:String(event?.startDate||"").trim()?null:clone(event)
  }));
  state.user.interview=clone(document.metadata?.interview||{
    prog:"",
    date:"",
    label:""
  });
  state.profile={
    name:profile.fullName||"",
    country:profile.medicalSchoolCountry||"",
    visa:authorization.currentUsWorkAuthorization||"",
    goal:targetSpecialty.label||profile.specialtyGoal||"",
    s1:canonicalExamProfileValue(document,"USMLE","step-1"),
    s2:canonicalExamProfileValue(document,"USMLE","step-2-ck")
  };
  state.sticky=document.metadata?.stickyNote??"";
  state.media=clone(document.metadata?.boardMedia||{
    photos:{},
    logo:false,
    avatar:false
  });
  state.wiz={
    ...clone(EMPTY_407F_WIZARD),
    ...clone(document.metadata?.wizard407F||{}),
    name:profile.fullName||document.metadata?.wizard407F?.name||"",
    school:profile.medicalSchool||"",
    country:profile.medicalSchoolCountry||"",
    canonicalSchoolId:
      profile.canonicalSchoolId||"",
    schoolRecord:clone(
      profile.medicalSchoolRecord||null
    ),
    schoolEntryMode:
      profile.medicalSchoolEntryMode||"registry",
    schoolVerificationStatus:
      profile.medicalSchoolVerificationStatus||"",
    schoolNormalizationStatus:
      profile.medicalSchoolNormalizationStatus||"",
    schoolAnalyticsEligible:
      profile.medicalSchoolAnalyticsEligible===true,
    schoolUnlistedSubmission:clone(
      profile.medicalSchoolUnlistedSubmission||null
    ),
    schoolCity:profile.medicalSchoolCity||"",
    grad:profile.graduationDate||"",
    gradPrecision:profile.graduationDatePrecision||"",
    profileFieldProvenance:clone(profile.fieldProvenance||{}),
    notGraduated:profile.graduationExpected===true,
    degree:profile.degree||"",
    degreeOther:profile.degreeOther||"",
    visa:
      authorization.currentUsWorkAuthorization||"",
    visaOther:profile.workAuthorizationOther||"",
    eadStatus:profile.eadStatus||"",
    residencyVisaTypesOpenTo:
      authorization.residencyVisaTypesOpenTo||""
  };
  state.builder={
    ...state.builder,
    ...clone(document.metadata?.builder407F||{}),
    step:Number(document.builder?.step)||Number(state.builder?.step)||1,
    examSystems:selectedBuilderExamSystems(document),
    examSystemSelectionExplicit:document.builder?.examSystemSelectionExplicit===true,
    exams:clone(document.exams||[]),
    domainDrafts:clone(document.builder?.drafts||{}),
    domainEditing:clone(document.builder?.editing||{})
  };
  state.intake=clone(document.intake||{});
  state.canvasTheme=document.theme==="season-one-board"?"season":
    document.theme==="mission-navy"?"navy":
    document.theme==="clean-advisor-paper"||document.theme==="advisor-paper"?"paper":
    document.theme==="horizon"?"horizon":
    document.theme==="little-journeys"?"journeys":"keynote";
  state.saved=true;
  state.sel=null;
  return state;
}

export function apply407FStateToDocument(state,document){
  const canonicalPayloads=state.user?.canonicalEventPayloads||{};
  const renderedEvents=(state.user?.events||[]).map((event,index)=>
    event407FToDocument(
      event,
      index,
      canonicalPayloads[String(event?.id||"")]||null
    )
  );
  const remainingById=new Map(
    renderedEvents
      .filter((event)=>event?.id)
      .map((event)=>[String(event.id),event])
  );
  const orderedEvents=[];
  for(const entry of state.user?.canonicalEventOrder||[]){
    if(entry?.renderable===false){
      orderedEvents.push(clone(entry.event));
      continue;
    }
    const id=String(entry?.id||"");
    if(!id||!remainingById.has(id))continue;
    orderedEvents.push(remainingById.get(id));
    remainingById.delete(id);
  }
  const orderedIds=new Set(
    orderedEvents.filter((event)=>event?.id).map((event)=>String(event.id))
  );
  document.events=[
    ...orderedEvents,
    ...renderedEvents.filter(
      (event)=>!event?.id||!orderedIds.has(String(event.id))
    )
  ];
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
    graduationDatePrecision:state.wiz?.gradPrecision||"",
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
    state.canvasTheme==="navy"?"mission-navy":
    state.canvasTheme==="paper"?"advisor-paper":
    state.canvasTheme==="horizon"?"horizon":
    state.canvasTheme==="journeys"?"little-journeys":"keynote-classic";
  document.builder={
    ...document.builder,
    step:Number(state.builder?.step)||1,
    examSystems:clone(state.builder?.examSystems||[]),
    examSystemSelectionExplicit:state.builder?.examSystemSelectionExplicit===true,
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

export function productionPrivacyControlMarkup(identity){
  if(identity?.role!=="STUDENT")return"";
  const action=escapeMarkup(identity.consentAction);
  const endpoint=escapeMarkup(identity.consentEndpoint||identity.consentAction);
  const nonce=escapeMarkup(identity.consentNonce);
  if(identity.remoteSyncConsent!==true){
    return`<aside class="timelineSecureSaveCard" data-timeline-privacy-control role="region" aria-labelledby="timelineSecureSaveTitle">
      <p class="timelineSecureSaveEyebrow">Secure access across devices</p>
      <h2 id="timelineSecureSaveTitle">Keep your Timeline with you.</h2>
      <p>Your work is already safe on this device. Turn on secure saving when you want to reopen it on your other authorized MissionMed devices.</p>
      <form method="post" action="${action}" data-consent-endpoint="${endpoint}" class="timelineSecureSaveForm">
        <input type="hidden" name="action" value="missionmed_timeline_consent">
        <input type="hidden" name="_wpnonce" value="${nonce}">
        <input type="hidden" name="timeline_remote_sync_action" value="grant">
        <label><input required type="checkbox" name="timeline_remote_sync_consent" value="grant"> <span>I agree to securely save my Timeline in my private MissionMed account.</span></label>
        <div class="timelineSecureSaveActions">
          <button type="submit" class="btnD go">TURN ON SECURE SAVING ▸</button>
          <a href="${escapeMarkup(identity.matrixUrl)}">Not now — return to Matrix</a>
        </div>
        <p class="timelineSecureSaveStatus" data-consent-status role="status" aria-live="polite"></p>
      </form>
    </aside>`;
  }
  return`<details class="timelineSecureSaveManage" data-timeline-privacy-control>
    <summary>Secure saving is on · Privacy settings</summary>
    <div>
      <p>Your Timeline is available on your authorized MissionMed devices. Turning this off keeps this device copy and stops remote saving.</p>
      <form method="post" action="${action}" data-consent-endpoint="${endpoint}">
        <input type="hidden" name="action" value="missionmed_timeline_consent">
        <input type="hidden" name="_wpnonce" value="${nonce}">
        <input type="hidden" name="timeline_remote_sync_action" value="withdraw">
        <button type="submit" class="homeTertiary">Turn off secure saving</button>
        <p class="timelineSecureSaveStatus" data-consent-status role="status" aria-live="polite"></p>
      </form>
    </div>
  </details>`;
}

function installProductionPrivacyControl(identity){
  if(identity?.role!=="STUDENT")return;
  const host=document.querySelector(".homeBuildRegion>.pi");
  if(!host||host.querySelector("[data-timeline-privacy-control]"))return;
  host.insertAdjacentHTML("beforeend",productionPrivacyControlMarkup(identity));
  const form=host.querySelector("[data-timeline-privacy-control] form");
  if(!form)return;
  form.addEventListener("submit",async(event)=>{
    event.preventDefault();
    if(form.dataset.submitting==="true")return;
    const button=form.querySelector('button[type="submit"]');
    const status=form.querySelector("[data-consent-status]");
    form.dataset.submitting="true";
    if(button)button.disabled=true;
    if(status)status.textContent="Updating secure saving…";
    try{
      const response=await fetch(form.dataset.consentEndpoint||form.action,{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{accept:"application/json"},body:new FormData(form),signal:AbortSignal.timeout(20_000)
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok||payload?.success!==true)throw new Error(String(payload?.data?.code||"TIMELINE_CONSENT_UPDATE_FAILED"));
      location.reload();
    }catch(error){
      form.dataset.submitting="false";
      if(button)button.disabled=false;
      if(status)status.textContent="Secure saving could not be updated. Try again.";
    }
  });
}

export function persistedIntakeState(state,priorIntake=null){
  const value=clone(state);
  if(value.lastAcceptedCvImport==null&&priorIntake?.lastAcceptedCvImport){
    value.lastAcceptedCvImport=clone(priorIntake.lastAcceptedCvImport);
  }
  if(value.stage==="done"){
    // applyApprovalBatchToDocument owns this actual apply receipt; the machine's
    // subsequent DONE notification has not received it yet.
    if(value.lastImport==null&&priorIntake?.lastImport){
      value.lastImport=clone(priorIntake.lastImport);
    }
    value.candidates=(value.candidates||[])
      .filter((candidate)=>candidate.decision==="undecided");
  }
  return value;
}

function currentMonth(){
  return new Date().toISOString().slice(0,7);
}

async function sha256File(file){
  const digest=await crypto.subtle.digest("SHA-256",await file.arrayBuffer());
  return[...new Uint8Array(digest)]
    .map((value)=>value.toString(16).padStart(2,"0"))
    .join("");
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

export function createObjectUrlRegistry(){
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
    async hydrate(store,document,{remoteLoader=null,onError=()=>{}}={}){
      const advanced=document?.advanced||{};
      const objects=[
        advanced.background?.kind==="upload"
          ?{
            id:advanced.background.mediaId,
            blobKey:advanced.background.source?.blobKey,
            objectId:advanced.background.source?.objectId
          }
          :null,
        ...(advanced.media||[]).map((item)=>({
          id:item.id,
          blobKey:item.source?.blobKey,
          objectId:item.source?.objectId
        }))
      ].filter((item)=>item?.id);
      let changed=false;
      for(const {id,blobKey,objectId} of objects){
        if(urls.has(String(id)))continue;
        try{
          let blob=await store.adapter.getBlob(String(blobKey||id));
          if(!blob&&objectId&&typeof remoteLoader==="function"){
            blob=await remoteLoader(String(objectId));
            if(blob)await store.adapter.putBlob(String(id),blob,{
              kind:"private-media-cache",
              objectId:String(objectId),
              localOnly:false,
              cachedAt:new Date().toISOString()
            });
          }
          if(blob){this.set(id,blob);changed=true;}
        }catch(error){
          onError(error,{id:String(id),objectId:String(objectId||"")});
        }
      }
      return changed;
    },
    revokeAll(){
      for(const url of urls.values())URL.revokeObjectURL(url);
      urls.clear();
    }
  };
}

export function productionMediaSource(objectId,contentSha256){
  const durableId=String(objectId||"").trim();
  const checksum=String(contentSha256||"").trim().toLowerCase();
  if(!durableId)throw new TypeError("A durable private-media object ID is required.");
  if(!/^[a-f0-9]{64}$/.test(checksum))throw new TypeError("A private-media SHA-256 checksum is required.");
  return Object.freeze({
    objectId:durableId,
    contentSha256:checksum,
    localOnly:false,
    url:null
  });
}

export function remoteSyncPresentation(state){
  const result={
    LOCAL_SAVED:["SAVED LOCALLY — SYNC PENDING","isSaving"],
    SYNC_PENDING:["SAVED LOCALLY — SYNC PENDING","isSaving"],
    SYNCING:["SYNCING…","isSaving"],
    SYNCED:["SAVED & SYNCED","isSaved"],
    CONFLICT:["SYNC CONFLICT — REVIEW","isError"],
    ERROR:["LOCAL SAVE — SYNC RETRY","isError"],
    OFFLINE:["SAVED LOCALLY — OFFLINE","isSaving"],
    LOCAL_ONLY:["SAVED LOCALLY","isSaved"]
  }[String(state||"")];
  return result?Object.freeze({text:result[0],className:result[1]}):null;
}

export function timelineRenderSignature(document){
  return JSON.stringify({
    id:document?.id||"",
    theme:document?.theme||"",
    mode:document?.mode||"",
    title:document?.title||"",
    studentProfile:document?.studentProfile||null,
    events:document?.events||[],
    advanced:document?.advanced||null,
    presentationOverrides:document?.presentationOverrides||null,
    /* Frame fills and their crops live in mediaItems; without them here a filled
       polaroid never re-rendered and stayed "DROP PHOTO" until an unrelated edit. */
    mediaItems:document?.mediaItems||null,
    interview:document?.metadata?.interview||null,
    specialties:document?.specialties||document?.specialtyVariants||null
  });
}

/* A clipped landscape fill can overflow the SVG group's DOM bounds. The frame's
   own rectangle remains the canonical geometry for selection, hover and gestures. */
export function advancedFrameScreenBounds022(node){
  const rect=node?.querySelector?.("rect");
  if(!rect)return null;
  try{
    const box=rect.getBBox?.(),matrix=rect.getScreenCTM?.();
    if(box?.width>0&&box?.height>0&&matrix&&[box.x,box.y,matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f].every(Number.isFinite)){
      const corners=[[box.x,box.y],[box.x+box.width,box.y],[box.x+box.width,box.y+box.height],[box.x,box.y+box.height]]
        .map(([x,y])=>({x:matrix.a*x+matrix.c*y+matrix.e,y:matrix.b*x+matrix.d*y+matrix.f}));
      const left=Math.min(...corners.map(point=>point.x)),top=Math.min(...corners.map(point=>point.y));
      const right=Math.max(...corners.map(point=>point.x)),bottom=Math.max(...corners.map(point=>point.y));
      return{left,top,right,bottom,width:right-left,height:bottom-top};
    }
    return rect.getBoundingClientRect?.()||null;
  }catch{return null;}
}

export function examMutationNeedsImmediateRender(changes={}){
  return Object.prototype.hasOwnProperty.call(changes||{},"result");
}

const MAX_IMAGE_DIMENSION=8192;
const MAX_IMAGE_PIXELS=40_000_000;

async function hasExpectedImageSignature(file,type){
  const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
  const ascii=(start,end)=>String.fromCharCode(...bytes.slice(start,end));
  if(type==="png"){
    return[137,80,78,71,13,10,26,10]
      .every((value,index)=>bytes[index]===value);
  }
  if(type==="jpg")return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(type==="gif")return["GIF87a","GIF89a"].includes(ascii(0,6));
  if(type==="webp")return ascii(0,4)==="RIFF"&&ascii(8,12)==="WEBP";
  return false;
}

async function imageMetrics(
  file,
  {sample=false,kind="image",background=false}={}
){
  const validation=background
    ?validateBackgroundUpload(file)
    :validateMediaUpload(file,{kind});
  if(!validation.valid)throw new TypeError(validation.error);
  if(!(await hasExpectedImageSignature(file,validation.type))){
    throw new TypeError("The selected file is not a valid supported image.");
  }
  if(typeof createImageBitmap!=="function"){
    throw new Error("This browser cannot securely decode local images.");
  }
  const bitmap=await createImageBitmap(file);
  try{
    const pixels=bitmap.width*bitmap.height;
    if(
      bitmap.width>MAX_IMAGE_DIMENSION||
      bitmap.height>MAX_IMAGE_DIMENSION||
      pixels>MAX_IMAGE_PIXELS
    ){
      throw new RangeError(
        "Image dimensions exceed the 8,192px / 40-megapixel local limit."
      );
    }
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
    input.tabIndex=-1;
    input.style.cssText="position:fixed;left:-10000px;top:auto;width:1px;height:1px;opacity:0;pointer-events:none;";
    document.body.append(input);
    const finish=(file)=>{
      input.remove();
      resolve(file||null);
    };
    input.addEventListener("change",()=>finish(input.files?.[0]),{once:true});
    input.addEventListener("cancel",()=>finish(null),{once:true});
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

export function renderCanvasDetails(route,event,document){
  const imported=isImportedBuilderEvent022(event);
  if(imported){
    event=bindImportedBuilderEvent022(event);
    event.fields={...event.fields,[event.categoryId==="research"?"ongoing":"current"]:event.openEnded===true};
  }
  const domain=event.fields?.builderDomain||event.categoryId||"personal";
  if(domain==="explanation"){
    const fields=event.fields||{};
    return `<div class="canvas407FDetails" data-canvas-details-form data-event-id="${escapeMarkup(event.id)}">
      <div class="canvas407FDetailGrid">
        <label class="canvas407FDetailField canvas407FDetailWide"><span>Explanation</span><textarea maxlength="${EXPLANATION_TEXT_MAX}" data-canvas-detail-field="explanationText">${escapeMarkup(fields.explanationText||event.title||"")}</textarea></label>
        <label class="canvas407FDetailField"><span>X</span><input type="number" min="96" max="1744" data-canvas-detail-field="x" value="${Number(fields.x)||1470}"></label>
        <label class="canvas407FDetailField"><span>Y</span><input type="number" min="80" max="904" data-canvas-detail-field="y" value="${Number(fields.y)||574}"></label>
        <label class="canvas407FDetailField"><span>Width</span><input type="number" min="180" max="520" data-canvas-detail-field="width" value="${Number(fields.width)||300}"></label>
        <label class="canvas407FDetailField"><span>Height</span><input type="number" min="110" max="320" data-canvas-detail-field="height" value="${Number(fields.height)||190}"></label>
        <label class="canvas407FDetailCheck canvas407FDetailWide"><input type="checkbox" data-canvas-detail-field="leaderEnabled" ${fields.leaderEnabled!==false?"checked":""}> <span>Connect to the referenced timeline item</span></label>
      </div>
      <div class="canvas407FDetailActions">
        <button type="button" class="btnD go" data-canvas-details-save>Save changes</button>
        <button type="button" class="btnD alt" data-canvas-builder-step="7" data-event-id="${escapeMarkup(event.id)}">Open in Builder</button>
      </div>
    </div>`;
  }
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
  const startDateControl=imported
    ?importedCanvasDateField022(event,"start")
    :clinical
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
    :imported
      ?importedCanvasDateField022(event,"end")
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
      ${imported?'<p class="field-error canvas407FDetailWide" data-canvas-imported-error role="status" aria-live="polite"></p>':""}
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

function installLocalMatrixAppMode({store,locationObject=window.location}={}){
  const parameters=new URLSearchParams(locationObject.search||"");
  if(parameters.get("matrixAppMode")!=="local")return null;
  const requested=parameters.get("returnUrl")||"/";
  let returnUrl;
  let returnUrlRejected=false;
  try{
    const candidate=new URL(requested,locationObject.href);
    if(candidate.origin!==locationObject.origin)throw new Error("cross-origin");
    returnUrl=`${candidate.pathname}${candidate.search}${candidate.hash}`;
  }catch{
    returnUrl="/";
    returnUrlRejected=true;
  }
  const back=document.getElementById("matrixBack");
  if(back){
    back.onclick=null;
    back.href=returnUrl;
    back.title="Return to Matrix";
    back.setAttribute("aria-label","Return to Matrix dashboard");
  }
  const runtime={
    version:"413.0.0-rc.0",
    mode:"MATRIX_APP_MODE",
    sourceAuthority:"D1_407F_CURRENT_APP",
    returnUrl,
    returnUrlRejected,
    sync:()=>store.adapter?.flush?.()||Promise.resolve({synced:0,pending:0}),
    get syncState(){return store.adapter?.kind||"UNKNOWN";}
  };
  window.MMEDTimeline=runtime;
  document.documentElement.dataset.matrixAppMode="local";
  return runtime;
}

export function installProductionMatrixReturn({store,productionRuntime,locationObject=window.location}={}){
  const back=document.getElementById("matrixBack");
  const matrixUrl=productionRuntime?.authClient?.bootstrapState?.matrixUrl;
  if(!back||!matrixUrl)return null;
  const target=new URL(matrixUrl,locationObject.href);
  if(target.origin!==locationObject.origin)throw new Error("Timeline Matrix return target must be same-origin.");
  back.href=target.href;
  back.title="Return to Matrix";
  back.setAttribute("aria-label","Save and return to Matrix dashboard");
  back.onclick=async(event)=>{
    event.preventDefault();
    if(back.dataset.returning==="true")return;
    back.dataset.returning="true";
    back.setAttribute("aria-disabled","true");
    try{
      await store.flushPendingSave("RETURN_TO_MATRIX");
      const result=await store.adapter?.flush?.();
      if(Number(result?.pending||0)>0){
        throw new Error("Timeline is still syncing. Try returning to Matrix again in a moment.");
      }
      locationObject.assign(target.href);
    }catch(error){
      back.dataset.returning="false";
      back.removeAttribute("aria-disabled");
      window.D1_407F_TEST?.toast?.(studentMessage(error,{context:"save"}),{
        tone:"danger",
        diagnostic:studentDiagnostic(error)
      });
    }
  };
  return Object.freeze({mode:"MATRIX_PRODUCTION",returnUrl:target.href});
}

export function initializeCompatibilityProjection022(store,{production=false,restored=false,canCreate=false}={}){
  if(store.entitlement.canMutate!==true||(!restored&&!canCreate))return;
  if(production&&restored){
    // Compatibility defaults belong to the initial display projection. A passive
    // reader must not version another device's document; its next real edit will
    // include these defaults in the normal durable save.
    normalizeExamDocument(store.document);
    ensureSpecialtyVariants(store.document);
    return;
  }
  store.mutate("Tidy up your exam entries",document=>normalizeExamDocument(document),{history:false,material:false});
  store.mutate("Normalize specialty timeline variants",document=>ensureSpecialtyVariants(document),{history:false,material:false});
}

export function persistExportStateChange022(store,state,reason){
  // Loading/ready/error describe this preview, not a student document edit.
  if(String(reason||"").startsWith("preview-")||store.entitlement.canMutate!==true)return false;
  return store.mutate("Persist export settings",document=>{document.exportState=clone(state);},{history:false,material:false});
}

export async function restoreAuthenticatedGuardianOnBoot022(document,serverDocument){
  const documentId=document.id,ownerId=document.studentOwnerId;
  reconcileRestoredProviderTruth022(document,serverDocument);
  const restored=await restoreServerGuardian022(document,serverDocument,{
    analyze:analyzeTimelineQuality,merge:mergeAiQualityAnalysis
  });
  if(!restored||document.id!==documentId||document.studentOwnerId!==ownerId||
    restored.sourceText!==qualitySourceText022(document))return null;
  document.metadata={...document.metadata,
    qualityReport022:structuredClone(restored.report),
    qualitySummary022:structuredClone(serverDocument.metadata.qualitySummary022)
  };
  return restored;
}

export async function boot407FEngineeringAdapter({
  bridge=window.D1_407F_TEST,
  store=null
}={}){
  if(!bridge?.state||typeof bridge.renderAll!=="function"){
    throw new Error("407F bridge is unavailable");
  }

  const explicitMode=String(window.D1_TIMELINE_RUNTIME_MODE||"").toLowerCase();
  const localHost=["localhost","127.0.0.1","0.0.0.0"].includes(
    String(window.location?.hostname||"").toLowerCase()
  );
  const runtimeMode=localHost&&explicitMode!=="production"
    ?"local"
    :"production";
  const productionRuntime=runtimeMode==="production"
    ?await prepareTimelineProductionRuntime()
    :null;
  const privateMediaStorageEnabled=productionRuntime?.privateMediaStorageEnabled===true;
  const privateMediaWriteEnabled=!productionRuntime||productionRuntime.privateMediaWriteEnabled===true;
  if(productionRuntime){
    window.D1_TIMELINE_PRODUCTION_ASSERTION=productionRuntime.assertion;
    window.D1_TIMELINE_PRODUCTION_BINDING=productionRuntime.expectedBinding;
    window.D1_TIMELINE_AUTH_CLIENT=productionRuntime.authClient;
  }
  store=store||new TimelineStore({adapter:productionRuntime?.adapter||null});
  const init=await store.initialize();
  const authoritativeDocument022=structuredClone(productionRuntime?.documents?.find(record=>record.document?.id===store.document.id)?.document||null);
  let initialGuardianRestore022=null;
  if(runtimeMode==="production"){
    // Finish authenticated receipt reconciliation before any startup callback can save.
    initialGuardianRestore022=await restoreAuthenticatedGuardianOnBoot022(store.document,authoritativeDocument022);
    store.document.metadata={
      ...(store.document.metadata||{}),
      localOnly:!productionRuntime?.remotePersistenceAllowed,
      productionWrites:productionRuntime?.remotePersistenceAllowed===true,
      authority:productionRuntime?.remotePersistenceAllowed?"timeline-server":"timeline-device"
    };
  }
  const entitlementAdapter=runtimeMode==="production"
    ?createProductionEntitlementBoundaryAdapter({
      assertion:productionRuntime.assertion,
      expectedBinding:productionRuntime.expectedBinding
    })
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
  let unsubscribeAuthClaims=()=>{};
  let reflectStoreStatus=()=>{};
  let syncConflictDialog=null;
  let closeSyncConflictDialog=()=>{};
  let remoteSyncStatus=productionRuntime?.adapter?.getSyncStatus?.()||null;
  const onRemoteSyncStatus=(event)=>{
    remoteSyncStatus=event?.detail||productionRuntime?.adapter?.getSyncStatus?.()||null;
    reflectStoreStatus();
  };
  if(productionRuntime){
    unsubscribeAuthClaims=productionRuntime.authClient.subscribeClaims((claims)=>{
      const renewedAssertion=productionRuntime.assertionForClaims(claims);
      const renewedEntitlement=evaluateTimelineEntitlement(renewedAssertion,{
        mode:runtimeMode,
        hasExistingTimeline:true,
        expectedBinding:productionRuntime.expectedBinding
      });
      store.setEntitlement(renewedEntitlement);
    });
    window.addEventListener("mission-timeline-sync",onRemoteSyncStatus);
  }
  const runtimeDatasets=createRuntimeDatasets();
  const lorBuilderAdapter=createLocalQueuedLorBuilderAdapter();
  const mediaUrls=createObjectUrlRegistry();
  const ensureRemoteDocumentForMedia=async()=>{
    if(!privateMediaStorageEnabled)return;
    const stateKey=`remote-revision:${store.document.id}`;
    if(await store.adapter.get("settings",stateKey))return;
    await store.saveNow("PREPARE_PRIVATE_MEDIA_UPLOAD");
    const result=await store.adapter.flush();
    if(Number(result?.pending||0)>0||!(await store.adapter.get("settings",stateKey))){
      throw new Error("Timeline must finish syncing before media can be uploaded.");
    }
  };
  const MAX_PRODUCTION_MEDIA_BYTES=15*1024*1024;
  const prepareMediaPersistence=async(file,{id,kind,contentSha256})=>{
    if(!privateMediaWriteEnabled)throw new Error('Private files are managed by the student. You can arrange and crop the images already in this Timeline.');
    const metadata={
      kind,
      name:file.name,
      type:file.type,
      size:file.size,
      localOnly:!privateMediaStorageEnabled
    };
    if(!privateMediaStorageEnabled){
      return{
        source:{
          name:file.name,
          type:file.type,
          size:file.size,
          blobKey:id,
          contentSha256,
          localOnly:true,
          url:null
        },
        blob:{key:id,blob:file,metadata},
        rollback:async()=>{}
      };
    }
    if(file.size>MAX_PRODUCTION_MEDIA_BYTES){
      throw new TypeError("Timeline media must be 15 MB or smaller for secure syncing.");
    }
    await ensureRemoteDocumentForMedia();
    let objectId="";
    try{
      const grant=await productionRuntime.authClient.signObjectUpload(
        store.document.id,
        {mimeType:file.type,byteSize:file.size,sha256:contentSha256,objectClass:"MEDIA"}
      );
      objectId=String(grant.objectId||"");
      let confirmed;
      try{
        await productionRuntime.authClient.uploadSignedObject(grant,file);
        confirmed=await productionRuntime.authClient.confirmObjectUpload(
          objectId,
          grant.uploadToken
        );
      }catch(error){
        if(String(error?.code||"")!=="OBJECT_UPLOAD_NETWORK_FAILED")throw error;
        await productionRuntime.authClient.deleteObject(objectId).catch(()=>{});
        objectId="";
        confirmed=await productionRuntime.authClient.uploadOwnedObject(
          store.document.id,
          file,
          {sha256:contentSha256,objectClass:"MEDIA"}
        );
        objectId=String(confirmed?.id||"");
      }
      if(String(confirmed?.status||"")!=="CONFIRMED"){
        throw new Error("Timeline media upload could not be confirmed.");
      }
      return{
        source:{
          name:file.name,
          type:file.type,
          size:file.size,
          ...productionMediaSource(objectId,contentSha256)
        },
        blob:{
          key:id,
          blob:file,
          metadata:{...metadata,localOnly:false,objectId,confirmedAt:confirmed.confirmedAt||new Date().toISOString()}
        },
        rollback:async()=>{
          await productionRuntime.authClient.deleteObject(objectId).catch(()=>{});
        }
      };
    }catch(error){
      if(objectId)await productionRuntime.authClient.deleteObject(objectId).catch(()=>{});
      throw error;
    }
  };
  const mediaRetirementKey=(objectId)=>
    `private-media-retirement:${store.document.id}:${String(objectId)}`;
  const mediaObjectIdsInDocument=(timeline)=>new Set([
    timeline?.advanced?.background?.kind==="upload"
      ?timeline.advanced.background.source?.objectId
      :null,
    ...(timeline?.advanced?.media||[]).map((item)=>item.source?.objectId)
  ].filter(Boolean).map(String));
  const queueDurableMediaRetirement=async(objectId)=>{
    if(!privateMediaStorageEnabled||!objectId)return false;
    const id=mediaRetirementKey(objectId);
    await store.adapter.put("settings",{
      id,
      documentId:store.document.id,
      objectId:String(objectId),
      createdAt:new Date().toISOString(),
      reason:"USER_MEDIA_REPLACEMENT_OR_DELETION"
    });
    return true;
  };
  const cancelDurableMediaRetirement=async(objectId)=>{
    if(!privateMediaStorageEnabled||!objectId)return;
    await store.adapter.delete("settings",mediaRetirementKey(objectId));
  };
  const processDurableMediaRetirements=async()=>{
    if(!privateMediaStorageEnabled)return{deleted:0,pending:0};
    const prefix=`private-media-retirement:${store.document.id}:`;
    const records=await store.adapter.list(
      "settings",
      (record)=>String(record?.id||"").startsWith(prefix)
    );
    const referenced=mediaObjectIdsInDocument(store.document);
    const eligible=records.filter(({objectId})=>!referenced.has(String(objectId)));
    if(!eligible.length)return{deleted:0,pending:records.length};
    await store.flushPendingSave("RETIRE_PRIVATE_MEDIA");
    const result=await store.adapter.flush();
    if(Number(result?.pending||0)>0){
      return{deleted:0,pending:records.length};
    }
    let deleted=0;
    for(const record of eligible){
      await productionRuntime.authClient.deleteObject(String(record.objectId));
      await store.adapter.delete("settings",record.id);
      deleted+=1;
    }
    return{deleted,pending:records.length-deleted};
  };
  const retireDurableMediaObject=async(objectId)=>{
    if(!privateMediaStorageEnabled||!objectId)return false;
    await queueDurableMediaRetirement(objectId);
    const result=await processDurableMediaRetirements();
    return result.deleted>0;
  };
  queueMicrotask(()=>{
    processDurableMediaRetirements().catch(()=>{
      console.warn("Timeline private-media cleanup remains queued for a later synced session.");
    });
  });
  const matrixCalendarAdapter=createUnavailableMatrixCalendarAdapter();
  const matrixCalendarState=await matrixCalendarAdapter
    .listScheduledInterviews();
  const kernelManager=createD1411AKernelManager({
    resolveObjectUrl:(id)=>mediaUrls.get(id)
  });
  /* AAA-019 — the live board was serialized without any resolved media URLs, so every
     placed upload rendered as `data-media-state="missing"` (invisible) while the model,
     the inspector and the "Media placed on timeline" toast all said it was there. The
     object URLs already live in `mediaUrls`; hand them to the serializer the same way
     the export path does through its mediaResolver. Frame fills (`mediaItems`) point at
     a library asset through `mediaId`, so both ids resolve to the same URL. */
  const liveMediaById=(timeline)=>{
    const resolved=new Map();
    const remember=(id,assetId)=>{
      const key=String(id||"").trim();
      if(!key||resolved.has(key))return;
      const url=mediaUrls.get(assetId||key);
      if(url)resolved.set(key,url);
    };
    for(const item of timeline?.advanced?.media||[])remember(item?.id);
    for(const item of timeline?.mediaItems||[])remember(item?.id,item?.mediaId||item?.id);
    const background=timeline?.advanced?.background;
    if(background?.kind==="upload"&&background.mediaId)remember(background.mediaId);
    return resolved;
  };
  const hydrateMissingAdvancedMedia=()=>mediaUrls.hydrate(store,store.document,{
    remoteLoader:productionRuntime?(objectId)=>productionRuntime.authClient.downloadPrivateObject(objectId):null,
    onError:()=>announceGlobal("One copied image could not be loaded yet. Your edits remain saved; try reopening the timeline.")
  }).then((changed)=>{
    if(!changed)return false;
    canvasController?.render();
    renderHomePreview();
    renderBuilderEmbeddedPreview();
    return true;
  }).catch((error)=>{toastStudentError(error,"media");return false;});
  const renderResponsiveAdvancedBoard=(timeline,options={})=>{
    const surface=options.surface||"edit";
    const editable=surface==="edit"&&store.entitlement.canMutate===true;
    const projected=timelineWithLorPresentation(timeline);
    const mediaById=liveMediaById(projected);
    const rendered=serializeFounderPresentation(projected,{
      audience:options.audience||"EVERYTHING",
      currentMonth:options.currentMonth||currentMonth(),
      resourceNamespace:`timeline-${surface}`,
      mediaById
    });
    const interactive=surface==="edit"?editable:options.interactive!==false;
    const presentation=["builder","home","full-preview"].includes(surface)
      ?enhanceBuilderPreviewSvg(rendered.svg,projected,{interactive})
      :rendered.svg;
    return{
      // Canvas owns event/selection semantics on Edit, so it receives the SVG
      // directly. Read/preview surfaces receive their already-enhanced markup.
      ...(surface==="edit"?{svg:presentation}:{html:presentation}),
      kind:"founder-shared-presentation",
      scene:rendered.scene,
      warnings:[],
      serializer:rendered.serializer,
      /* Media hydration is asynchronous: the same document renders differently once
         the object URLs arrive, so the signature that decides whether the mounted SVG
         is swapped has to change with them — otherwise every image after a reload
         stayed missing until an unrelated edit. */
      renderSignature:`${timelineRenderSignature(projected)}|media:${[...mediaById.entries()].map(([id,url])=>`${id}=${url}`).sort().join(",")}`,
      presentationAuthority:"D1-TIMELINE-FOUNDER-REANCHOR-015+DR-127"
    };
  };
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
  let cancelInvalidAdvancedSessions=()=>false;
  let onCanvasDetailsClick=()=>{};
  let onAdvancedObjectClick=()=>{};
  let onAdvancedObjectKeyDown=()=>{};
  let onAdvancedSelectionKeyDown=()=>{};
  let onAdvancedCanvasRendered=()=>{};
  let onAdvancedQuickActionClick=()=>{};
  let onAdvancedHoverMove=()=>{};
  let onAdvancedHoverLeave=()=>{};
  let onAdvancedContextMenu=()=>{};
  let onAdvancedViewportChange=()=>{};
  let onAdvancedPointerDown=()=>{};
  let onAdvancedPointerMove=()=>{};
  let onAdvancedPointerUp=()=>{};
  let onAdvancedRailDragOver=()=>{};
  let onAdvancedRailDrop=()=>{};
  let onAdvancedRailNativeDragStart=()=>{};
  let onAdvancedRailNativeDragEnd=()=>{};
  let requestAdvancedDirectSelection=()=>{};
  let onKernelAdvancedSelect=()=>{};
  let onKernelAdvancedGesture=()=>{};
  let onKernelPresentationEventGesture=()=>{};
  let onKernelAdvancedTextEditing=()=>{};
  let onKernelAdvancedText=()=>{};
  let onKernelAdvancedDrop=()=>{};
  let onKernelAdvancedCommand=()=>{};
  let onKernelRejected=()=>{};
  let advancedTextSelectionTimer=null;
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
  let onQualityGuardianCapture=()=>{};
  let renderM9BuilderSurfaces=()=>{};
  let onRouteRendered=()=>{};
  let responsiveRuntime=null;
  let shortcutTrap=null;
  let fileVaultTrap=null;
  let builderPreviewTrap=null;
  let specialtyVariantTrap=null;
  let exportThemeTrap=null;
  let standardModalTrap=null;
  let standardModalOpener=null;
  let exportThemeOpener=null;
  let entitlementObserver=null;
  let entitlementObserverQueued=false;
  let onExportThemeBackdrop=()=>{};
  let onStandardModalBackdrop=()=>{};
  let specialtyVariantOpener=null;
  let builderPreviewZoom=createCanvasZoom("fit");
  let builderPreviewOpener=null;
  let mediaDrawerOpener=null;
  let builderPreviewRenderQueued=false;
  let lastFocusedView=null;
  let routeFocusFrame=0;
  let exitPersistenceStarted=false;
  let lastState=stableState(bridge.state);
  let booting=true;
  const watchedEvents=["input","change","click","pointerup","blur"];

  initializeCompatibilityProjection022(store,{
    production:!!productionRuntime,restored:init.restored,canCreate:entitlement.canCreate
  });
  applying=true;
  applyDocumentTo407FState(store.document,bridge.state);
  bridge.renderAll();
  lastState=stableState(bridge.state);
  applying=false;

  /* Every student-facing failure leaves this file through here. The untranslated text goes
     to the console and onto the toast as a data attribute for support; only the translated
     sentence reaches the screen. */
  const toastStudentError=(error,context="generic")=>{
    const translated=studentError(error,{context});
    console.warn("Timeline student-facing error",translated.diagnostic,error);
    bridge.toast(translated.message,{tone:"danger",diagnostic:translated.diagnostic});
    return translated.message;
  };
  const entitlementStudentReason=()=>entitlementStatusMarkup(store.entitlement).reason;

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
    bridge.toast(entitlementStudentReason(),{tone:"warning",diagnostic:store.entitlement.reason});
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
    if(booting||applying||pending)return;
    pending=true;
    queueMicrotask(()=>{
      pending=false;
      reflectStoreStatus();
      const nextState=stableState(bridge.state);
      if(nextState===lastState)return;
      lastState=nextState;
      if(store.entitlement.canMutate===true){
        store.mutate(
          "Timeline edit",
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
  const flushExitPersistence=()=>{
    if(exitPersistenceStarted||store.entitlement.canMutate!==true)return;
    exitPersistenceStarted=true;
    store.flushPendingSave("PAGE_EXIT").catch(()=>{});
  };
  window.addEventListener("pagehide",flushExitPersistence,{capture:true});
  window.addEventListener("pageshow",(event)=>{
    if(event.persisted)exitPersistenceStarted=false;
  },{capture:true});
  window.addEventListener("beforeunload",()=>{
    document.removeEventListener("d1:407f-rendered",reconcile);
    for(const eventName of watchedEvents){
      document.removeEventListener(eventName,reconcile,true);
    }
    const nextState=stableState(bridge.state);
    if(!booting&&nextState!==lastState&&store.entitlement.canMutate===true){
      lastState=nextState;
      store.mutate(
        "Timeline edit",
        (document)=>apply407FStateToDocument(bridge.state,document)
      );
    }
    canvasController?.destroy();
    removeAdvanced();
    exportController?.destroy();
    advisorCleanup();
    clearTimeout(advisorHighlightTimer);
    intakeCleanup();
    closeSyncConflictDialog();
    mediaUrls.revokeAll();
    unsubscribeStore();
    unsubscribeAuthClaims();
    window.removeEventListener("mission-timeline-sync",onRemoteSyncStatus);
    entitlementObserver?.disconnect();
    for(const eventName of ["click","input","change","drop"]){
      document.removeEventListener(eventName,onEntitlementCapture,true);
    }
    document.removeEventListener("click",onQualityGuardianCapture,true);
    document.getElementById("canvas407F")?.removeEventListener("click",onCanvasDetailsClick);
    document.getElementById("canvas407F")?.removeEventListener("click",onAdvancedObjectClick);
    document.getElementById("canvas407F")?.removeEventListener("keydown",onAdvancedObjectKeyDown);
    document.removeEventListener("keydown",onAdvancedSelectionKeyDown);
    document.getElementById("canvas407F")?.removeEventListener("d1:canvas-rendered",onAdvancedCanvasRendered);
    document.removeEventListener("click",onAdvancedQuickActionClick,true);
    document.getElementById("canvas407F")?.removeEventListener("contextmenu",onAdvancedContextMenu,true);
    document.getElementById("canvas407F")?.removeEventListener("pointermove",onAdvancedHoverMove);
    document.getElementById("canvas407F")?.removeEventListener("pointerleave",onAdvancedHoverLeave);
    document.getElementById("canvas407F")?.removeEventListener("d1:canvas-viewport",onAdvancedViewportChange);
    document.removeEventListener("scroll",onAdvancedViewportChange,true);
    window.removeEventListener("resize",onAdvancedViewportChange);
    document.removeEventListener("pointerdown",onAdvancedPointerDown,true);
    document.removeEventListener("mousedown",onAdvancedPointerDown,true);
    canvasHost?.removeEventListener("dragover",onAdvancedRailDragOver);
    canvasHost?.removeEventListener("drop",onAdvancedRailDrop);
    canvasHost?.removeEventListener("dragstart",onAdvancedRailNativeDragStart);
    document.removeEventListener("dragend",onAdvancedRailNativeDragEnd);
    document.removeEventListener("pointermove",onAdvancedPointerMove);
    document.removeEventListener("mousemove",onAdvancedPointerMove);
    document.removeEventListener("pointerup",onAdvancedPointerUp);
    document.removeEventListener("mouseup",onAdvancedPointerUp);
    document.removeEventListener("pointercancel",onAdvancedPointerUp);
    document.querySelectorAll("[data-advanced-alignment-guides]").forEach((node)=>node.remove());
    document.querySelectorAll("[data-advanced-direct-selection],[data-advanced-axis-boundary-handle]").forEach((node)=>node.remove());
    window.removeEventListener("resize",onCanvasResize);
    document.removeEventListener("d1:407f-rendered",on407FRendered);
    document.removeEventListener("d1:407f-rendered",onRouteRendered);
    window.removeEventListener("hashchange",onAdvisorHashChange);
    document.removeEventListener("keydown",onGlobalKeydown);
    document.removeEventListener("click",onBuilderPreviewInteraction);
    document.removeEventListener("keydown",onBuilderPreviewInteraction);
    document.removeEventListener("focusin",onBuilderPreviewFocus);
    window.removeEventListener("resize",onBuilderPreviewResize);
    cancelAnimationFrame(routeFocusFrame);
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
    document.removeEventListener("d1-411a:interaction",onKernelInteraction);
    document.removeEventListener("d1-411a:gesture",onKernelGesture);
    document.removeEventListener("d1-411a:presentation-gesture",onKernelPresentationGesture);
    document.removeEventListener("d1-411a:presentation-event-gesture",onKernelPresentationEventGesture);
    document.removeEventListener("d1-411a:advanced-select",onKernelAdvancedSelect);
    document.removeEventListener("d1-411a:advanced-gesture",onKernelAdvancedGesture);
    document.removeEventListener("d1-411a:advanced-text-editing",onKernelAdvancedTextEditing);
    document.removeEventListener("d1-411a:advanced-text",onKernelAdvancedText);
    document.removeEventListener("d1-411a:advanced-drop",onKernelAdvancedDrop);
    document.removeEventListener("d1-411a:advanced-command",onKernelAdvancedCommand);
    document.removeEventListener("d1-411a:rejected",onKernelRejected);
    document.removeEventListener("d1-411a:command",onKernelCommand);
    document.removeEventListener("d1-411a:media-drop",onKernelMediaDrop);
    clearTimeout(advancedTextSelectionTimer);
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
    standardModalTrap?.destroy();
    document.getElementById("modalBk")?.removeEventListener(
      "click",
      onExportThemeBackdrop,
      true
    );
    document.getElementById("modalBk")?.removeEventListener(
      "click",
      onStandardModalBackdrop,
      true
    );
    flushExitPersistence();
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
    attachSelectedSubjectDialog022(dialog,{runtime:productionRuntime,document:store.document});
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
  const syncBridgeStateFromStore=()=>{
    applying=true;
    applyDocumentTo407FState(store.document,bridge.state);
    lastState=stableState(bridge.state);
    applying=false;
  };
  const syncBridgeFromStore=()=>{
    syncBridgeStateFromStore();
    applying=true;
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
      "[data-media-place], [data-media-unplace], [data-media-replace], [data-media-delete], [data-media-nudge], [data-media-upload]"
    );
    return{
      rootId:root.id,
      assetId:card?.dataset.mediaAsset||null,
      action:action?.hasAttribute("data-media-nudge")
        ?`nudge-${action.dataset.mediaNudge}`
        :action?.hasAttribute("data-media-delete")
          ?"delete"
          :action?.hasAttribute("data-media-replace")
            ?"replace"
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
          :state.action==="delete"
            ?"[data-media-delete]"
            :state.action==="replace"
              ?"[data-media-replace]"
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
    const mediaBadge=document.querySelector(".media407FLocalBadge");
    if(mediaBadge){
      mediaBadge.textContent=privateMediaStorageEnabled
        ?"PRIVATE MEDIA · MISSIONMED ACCOUNT"
        :"LOCAL DEVICE ONLY";
    }
    if(page){
      page.innerHTML=mediaLibraryMarkup(mediaItems(),{
        resolveObjectUrl:(id)=>mediaUrls.get(id),
        reducedMotion,
        durableOnline:privateMediaStorageEnabled
      });
    }
    if(drawer){
      drawer.innerHTML=mediaLibraryMarkup(mediaItems(),{
        resolveObjectUrl:(id)=>mediaUrls.get(id),
        compact:true,
        reducedMotion,
        durableOnline:privateMediaStorageEnabled
      });
    }
    if(!privateMediaWriteEnabled){
      for(const host of [page,drawer].filter(Boolean))host.querySelectorAll('[data-media-upload],[data-media-replace],[data-media-delete]').forEach(control=>{control.disabled=true;control.title='Private files are managed by the student.';});
    }
    const canvasHost=document.getElementById("canvas407F");
    if(
      bridge.state.view==="canvas"&&
      canvasHost&&
      !canvasHost.querySelector("[data-open-media-library]")
    ){
      const toolbar=canvasHost.querySelector("[data-canvas-toolbar]");
      const mode=toolbar?.querySelector('[data-toolbar-item="mode"]');
      const markup='<button type="button" class="btnD alt sm media407FCanvasLauncher" data-toolbar-item="media" data-open-media-library aria-controls="mediaDrawer407F" aria-expanded="false" aria-haspopup="dialog">MEDIA</button>';
      if(mode)mode.insertAdjacentHTML("afterend",markup);
      else if(toolbar)toolbar.insertAdjacentHTML("afterbegin",markup);
      else canvasHost.insertAdjacentHTML("afterbegin",markup);
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
  const commitMediaPlacement=(id,{x=null,y=null,select=true}={})=>{
    if(x===null||y===null){const center=visibleBoardCenter();x=center.x;y=center.y;}
    let placed=false;
    store.mutate("Place Media asset",(document)=>{
      const result=placeMediaLibraryAsset(document.advanced.media,id,{x,y});
      placed=result.changed;
      if(placed){
        /* A newly placed image lands on top and is selected, like every insert. */
        const top=nextAdvancedLayerIndex(document);
        document.advanced.media=result.media.map((item)=>String(item.id)===String(id)
          ?{...item,zIndex:top,layerIndex:top}
          :item);
        document.advanced.scene=reconcileAdvancedScene(document.advanced,{revision:document.revision});
      }
    });
    if(!placed)return false;
    syncBridgeStateFromStore();
    if(select&&store.document.mode==="advanced"){
      canvasController?.setUiState({selectedEventId:null,advancedSelection:{type:"media",id:String(id)},advancedTextEdit:null});
      requestAdvancedDirectSelection({type:"media",id:String(id)});
    }
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
  const replaceMediaLibraryItem=async(id)=>{
    const current=mediaItems().find((item)=>String(item.id)===String(id));
    if(!current)throw new Error("That image is no longer in your timeline.");
    const file=await chooseLocalFile(MEDIA_LIBRARY_ACCEPT.join(","));
    if(!file)return false;
    const metrics=await imageMetrics(file,{kind:mediaKindForFile(file)});
    const replacement=createMediaLibraryAsset({
      id:current.id,
      file,
      naturalWidth:metrics.width,
      naturalHeight:metrics.height,
      layerIndex:current.layerIndex
    });
    const contentSha256=await sha256File(file);
    const persistence=await prepareMediaPersistence(file,{
      id:current.id,
      kind:"media-library",
      contentSha256
    });
    replacement.source=persistence.source;
    const priorObjectId=current.source?.objectId;
    if(priorObjectId)await queueDurableMediaRetirement(priorObjectId);
    try{
      await store.mutateWithBlobs(
        "Replace Media asset",
        (document)=>{
          const result=replaceMediaLibraryAsset(
            document.advanced.media,
            current.id,
            replacement
          );
          if(!result.changed)throw new Error("That image is no longer in your timeline.");
          document.advanced.media=result.media;
        },
        {blobs:[persistence.blob],reason:"REPLACE_MEDIA_ASSET"}
      );
    }catch(error){
      if(priorObjectId)await cancelDurableMediaRetirement(priorObjectId);
      await persistence.rollback();
      throw error;
    }
    mediaUrls.set(current.id,file);
    syncBridgeFromStore();
    renderMediaLibrarySurfaces();
    let cleanupComplete=true;
    if(priorObjectId){
      cleanupComplete=await retireDurableMediaObject(priorObjectId);
    }
    const message=cleanupComplete
      ?"Image replaced"
      :"Image replaced. We are still tidying up the old file, and your timeline is safe.";
    bridge.toast(message);
    announceGlobal(message);
    return true;
  };
  const deleteMediaLibraryItem=async(id)=>{
    const current=mediaItems().find((item)=>String(item.id)===String(id));
    if(!current)throw new Error("That image is no longer in your timeline.");
    const priorObjectId=current.source?.objectId;
    if(priorObjectId)await queueDurableMediaRetirement(priorObjectId);
    try{
      await store.mutateWithBlobs(
        "Delete Media asset",
        (document)=>{
          document.advanced.media=removeMediaLibraryAsset(
            document.advanced.media,
            current.id
          );
          /* AAA-019 red-team D7 — "everywhere it appears" includes the Founder frames:
             a fill that references the deleted picture must go too, or the frame renders
             half-empty and disagrees with itself after reload. */
          if(Array.isArray(document.mediaItems)){
            document.mediaItems=document.mediaItems.filter((item)=>
              String(item?.mediaId||item?.id||"")!==String(current.id)
            );
          }
          if(document.advanced?.background?.mediaId&&String(document.advanced.background.mediaId)===String(current.id)){
            document.advanced.background={...document.advanced.background,kind:"theme",mediaId:null};
          }
        },
        {blobs:[],reason:"DELETE_MEDIA_ASSET"}
      );
    }catch(error){
      if(priorObjectId)await cancelDurableMediaRetirement(priorObjectId);
      throw error;
    }
    mediaUrls.revoke(current.id);
    await store.adapter.deleteBlob(String(current.id)).catch(()=>{});
    syncBridgeFromStore();
    renderMediaLibrarySurfaces();
    let cleanupComplete=true;
    if(priorObjectId){
      cleanupComplete=await retireDurableMediaObject(priorObjectId);
    }
    const message=cleanupComplete
      ?"Image deleted"
      :"Image removed. We are still deleting the stored file, and your timeline is safe.";
    bridge.toast(message);
    announceGlobal(message);
    return true;
  };
  const openDeleteMediaLibraryDialog=(id)=>{
    const current=mediaItems().find((item)=>String(item.id)===String(id));
    if(!current)return;
    const name=escapeMarkup(current.source?.name||"this image");
    const dialog=openStandardModal(`<section class="export407FSuggestionDialog" role="dialog" aria-modal="true" aria-labelledby="media407FDeleteTitle" data-media-delete-dialog>
      <p class="k">DELETE THIS IMAGE</p>
      <h2 id="media407FDeleteTitle">Delete ${name}?</h2>
      <p>This takes the image off your timeline everywhere it appears, and deletes the stored copy once your timeline is safely saved.</p>
      <div class="export407FDialogActions">
        <button type="button" class="btnD alt" data-media-delete-cancel>Cancel</button>
        <button type="button" class="btnD go" data-media-delete-confirm>Delete image</button>
      </div>
    </section>`,"[data-media-delete-dialog]");
    dialog?.querySelector("[data-media-delete-cancel]")?.addEventListener(
      "click",
      ()=>closeStandardModal(),
      {once:true}
    );
    dialog?.querySelector("[data-media-delete-confirm]")?.addEventListener(
      "click",
      async()=>{
        const confirm=dialog.querySelector("[data-media-delete-confirm]");
        confirm.disabled=true;
        try{
          await deleteMediaLibraryItem(id);
          closeStandardModal({restoreFocus:false});
        }catch(error){
          confirm.disabled=false;
          const message=toastStudentError(error,"media");
          announceGlobal(`That image could not be deleted. ${message}`);
        }
      },
      {once:true}
    );
  };
  /* AAA-019 — set by the canvas block once frames exist; lets the media rail hand a tile to an armed frame. */
  let advancedFrameFillHook={armed:()=>false,consume:()=>false};
  let advancedFrameDropHook=()=>false;
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
      /* An armed frame ("Choose from uploads") takes the tile instead of the board. */
      if(advancedFrameFillHook.consume(String(place.dataset.mediaPlace||"")))return;
      commitMediaPlacement(place.dataset.mediaPlace);
      return;
    }
    const armedTile=event.target.closest?.("[data-media-asset][data-advanced-select-object]");
    if(armedTile&&advancedFrameFillHook.armed()){
      event.preventDefault();
      event.stopPropagation();
      advancedFrameFillHook.consume(String(armedTile.dataset.mediaAsset||""));
      return;
    }
    const replace=event.target.closest?.("[data-media-replace]");
    if(replace){
      event.preventDefault();
      replaceMediaLibraryItem(replace.dataset.mediaReplace)
        .catch((error)=>{
          const message=toastStudentError(error,"media");
          announceGlobal(`That image could not be replaced. ${message}`);
        });
      return;
    }
    const remove=event.target.closest?.("[data-media-delete]");
    if(remove){
      event.preventDefault();
      openDeleteMediaLibraryDialog(remove.dataset.mediaDelete);
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
    const rollbacks=[];
    const acceptedIds=[];
    for(const file of files){
      const duplicate=[...existing,...additions].find((item)=>
        item.source?.name===file.name&&
        Number(item.source?.size)===Number(file.size)&&
        item.source?.type===file.type
      );
      if(duplicate){
        acceptedIds.push(duplicate.id);
        const message=`${file.name} is already in Media`;
        bridge.toast(message);
        announceGlobal(message);
        continue;
      }
      try{
        const id=uid("media-library");
        const metrics=await imageMetrics(file,{kind:mediaKindForFile(file)});
        const asset=createMediaLibraryAsset({
          id,
          file,
          naturalWidth:metrics.width,
          naturalHeight:metrics.height,
          layerIndex:nextAdvancedLayerIndex()+additions.length
        });
        const contentSha256=await sha256File(file);
        const persistence=await prepareMediaPersistence(file,{
          id,kind:"media-library",contentSha256
        });
        asset.source=persistence.source;
        additions.push(asset);
        blobs.push(persistence.blob);
        rollbacks.push(persistence.rollback);
      }catch(error){
        const message=toastStudentError(error,"media");
        announceGlobal(`${file.name} could not be added. ${message}`);
      }
    }
    if(!additions.length)return acceptedIds;
    try{
      await store.mutateWithBlobs(
        "Add Media assets",
        (document)=>document.advanced.media.push(...additions),
        {blobs,reason:"ADD_MEDIA_ASSETS"}
      );
    }catch(error){
      await Promise.allSettled(rollbacks.map((rollback)=>rollback()));
      toastStudentError(error,"media");
      announceGlobal("Those images could not be added.");
      return [];
    }
    additions.forEach((asset,index)=>mediaUrls.set(asset.id,blobs[index].blob));
    syncBridgeFromStore();
    renderMediaLibrarySurfaces();
    bridge.toast(`${additions.length} image${additions.length===1?"":"s"} added`);
    announceGlobal(
      `${additions.length} image${additions.length===1?"":"s"} added`
    );
    return [...new Set([...acceptedIds,...additions.map((asset)=>asset.id)])];
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
    const target=event.target.closest?.("#boardWizard, #canvas407F .canvas-application");
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
    const target=event.target.closest?.("#boardWizard, #canvas407F .canvas-application");
    if(!target||target.contains(event.relatedTarget))return;
    target.removeAttribute("data-media-drop-active");
  };
  onMediaLibraryDragEnd=clearMediaDropTargets;
  onMediaLibraryDrop=(event)=>{
    const target=event.target.closest?.("#boardWizard, #canvas407F .canvas-application");
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
        <p>PNG, JPG, or WEBP. Your original image stays in Media, and this timeline just shows it where you place it.</p>
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
  const renderBuilderPersistenceActions=()=>{
    const continueButton=document.getElementById("builderContinue");
    const footer=continueButton?.closest?.(".builderFooter");
    if(!continueButton||!footer)return;
    const step=Math.max(1,Math.min(7,Number(store.document.builder?.step)||1));
    if(step<7)continueButton.textContent="SAVE AND CONTINUE →";
    let finish=footer.querySelector("[data-builder-finish-later]");
    if(!finish){
      finish=document.createElement("button");
      finish.type="button";
      finish.className="homeTertiary builderFinishLater";
      finish.dataset.builderFinishLater="true";
      footer.insertBefore(finish,continueButton);
    }
    finish.textContent="SAVE AND FINISH LATER";
    finish.hidden=step===7;
  };
  const renderHomeCompletionStatus=()=>{
    const host=document.querySelector(".homeBuildRegion .pi");
    if(!host)return;
    const summary=buildCompletenessSummary(store.document);
    const complete=summary.filter(({state})=>state==="complete");
    const pending=summary.filter(({state})=>state!=="complete"&&state!=="skipped");
    const next=pending[0]||null;
    const resumeStep=Math.max(1,Math.min(7,Number(store.document.builder?.step)||1));
    const resumeLabel=summary.find(({step})=>step===resumeStep)?.label||"Builder";
    const updated=new Date(store.document.updatedAt||Date.now());
    const savedLabel=Number.isNaN(updated.getTime())
      ?"Saved recently"
      :`Last saved ${new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(updated)}`;
    const remoteState=String(remoteSyncStatus?.syncState||remoteSyncStatus?.state||"").toUpperCase();
    const syncLabel=store.saveStatus==="error"
      ?"Save needs attention"
      :store.saveStatus==="saving"||remoteState.includes("PENDING")
        ?"Saving securely…"
        :productionRuntime?.remotePersistenceAllowed
          ?"Saved and securely synced"
          :"Saved on this device";
    let panel=document.getElementById("homeCompletion407F");
    if(!panel){
      panel=document.createElement("section");
      panel.id="homeCompletion407F";
      panel.className="homeCompletion407F";
      panel.setAttribute("aria-label","Timeline progress");
      host.querySelector(".homeJourneyStrip")?.before(panel);
    }
    panel.innerHTML=`<div><strong>${complete.length} of ${summary.length} sections complete</strong><span>${escapeMarkup(syncLabel)} · ${escapeMarkup(savedLabel)}</span></div>
      <p>${complete.length?`Completed: ${escapeMarkup(complete.map(({label})=>label).join(", "))}.`:"Your first section is ready to begin."}</p>
      <p>${pending.length?`Still to review: ${escapeMarkup(pending.map(({label})=>label).join(", "))}. Next recommended: ${escapeMarkup(next.label)}.`:"All guided sections are ready for final review."}</p>
      <button type="button" class="btnD go sm" data-home-resume-builder>${pending.length?`RESUME ${escapeMarkup(resumeLabel.toUpperCase())} →`:"REVIEW TIMELINE →"}</button>`;
  };
  renderM9BuilderSurfaces=()=>{
    renderBuilderPersistenceActions();
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
  onM9BuilderClick=async(event)=>{
    const resume=event.target.closest?.("[data-home-resume-builder]");
    if(resume){
      const pending=buildCompletenessSummary(store.document).some(
        ({state})=>state!=="complete"&&state!=="skipped"
      );
      bridge.go(pending?"builder":"canvas");
      return;
    }
    const finishLater=event.target.closest?.("[data-builder-finish-later]");
    if(finishLater){
      finishLater.disabled=true;
      finishLater.textContent="SAVING…";
      try{
        lastState=stableState(bridge.state);
        store.mutate(
          "Save Builder progress",
          (document)=>apply407FStateToDocument(bridge.state,document),
          {history:false}
        );
        await store.saveNow("BUILDER_FINISH_LATER");
        const result=await store.adapter?.flush?.();
        if(Number(result?.pending||0)>0)throw new Error("Timeline is still syncing.");
        bridge.go("command");
        bridge.toast("Progress saved. Resume anytime from Home.");
        announceGlobal("Progress saved and Home opened");
      }catch(error){
        finishLater.disabled=false;
        finishLater.textContent="RETRY SAVE AND FINISH LATER";
        toastStudentError(error,"save");
      }
      return;
    }
    if(
      event.target.closest?.('[data-builder-step="7"]')||
      event.target.closest?.("#builderContinue")
    ){
      queueMicrotask(renderM9BuilderSurfaces);
    }
    if(event.target.closest?.("#builderContinue")){
      store.saveNow("BUILDER_SAVE_AND_CONTINUE")
        .then(()=>store.adapter?.flush?.())
        .then(()=>announceGlobal("Progress saved"))
        .catch((error)=>toastStudentError(error,"save"));
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
    let rollbackUpload=async()=>{};
    try{
      const id=uid("interview-logo");
      const metrics=await imageMetrics(file,{kind:"logo"});
      const asset=createMediaLibraryAsset({
        id,
        file,
        naturalWidth:metrics.width,
        naturalHeight:metrics.height,
        layerIndex:mediaItems().length
      });
      const contentSha256=await sha256File(file);
      const persistence=await prepareMediaPersistence(file,{
        id,kind:"interview-program-logo",contentSha256
      });
      rollbackUpload=persistence.rollback;
      asset.source=persistence.source;
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
          blobs:[persistence.blob],
          reason:"ADD_INTERVIEW_PROGRAM_LOGO"
        }
      );
      mediaUrls.set(id,file);
      refreshM9({focusSelector:"[data-interview-logo-upload]"});
      renderMediaLibrarySurfaces();
      bridge.toast("Program logo added locally");
      announceGlobal("Program logo added to the active interview timeline");
    }catch(error){
      await rollbackUpload();
      const message=toastStudentError(error,"media");
      setM9InlineError(input,logoError,message);
    }
  };
  document.addEventListener("click",onM9BuilderClick);
  document.addEventListener("change",onM9BuilderChange);
  renderM9BuilderSurfaces();
  renderHomeCompletionStatus();
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
  const standardModalBackgroundInert=(active)=>{
    for(const element of [
      document.querySelector("header"),
      document.getElementById("rail"),
      document.querySelector("main")
    ].filter(Boolean)){
      element.toggleAttribute("inert",active);
    }
  };
  const closeStandardModal=({restoreFocus=true}={})=>{
    const trap=standardModalTrap;
    standardModalTrap=null;
    trap?.destroy();
    document.getElementById("modalBk")?.removeEventListener(
      "click",
      onStandardModalBackdrop,
      true
    );
    bridge.closeModal?.();
    standardModalBackgroundInert(false);
    if(restoreFocus)standardModalOpener?.focus?.();
    standardModalOpener=null;
  };
  const openStandardModal=(markup,selector)=>{
    standardModalOpener=document.activeElement;
    bridge.openModal?.(markup);
    const dialog=document.querySelector(selector);
    if(!dialog)return null;
    attachSelectedSubjectDialog022(dialog,{runtime:productionRuntime,document:store.document});
    standardModalBackgroundInert(true);
    standardModalTrap?.destroy();
    standardModalTrap=installFocusTrap(dialog,{
      opener:standardModalOpener,
      restoreFocus:false,
      onEscape:()=>closeStandardModal()
    });
    onStandardModalBackdrop=(event)=>{
      if(event.target?.id!=="modalBk")return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeStandardModal();
    };
    document.getElementById("modalBk")?.addEventListener(
      "click",
      onStandardModalBackdrop,
      true
    );
    return dialog;
  };
  const qualityGuardianControls=Object.freeze({
    secondary:"btnD alt sm",
    tertiary:"homeTertiary",
    primary:"btnD go sm"
  });
  let lastGuardianReport022=null;
  let lastGuardianSource022='';
  if(initialGuardianRestore022?.sourceText===qualitySourceText022(store.document)){
    lastGuardianReport022=initialGuardianRestore022.report;
    lastGuardianSource022=initialGuardianRestore022.sourceText;
  }
  const openQualityGuardian407F=async(stage="DURING_BUILDING")=>{
    let report=analyzeTimelineQuality(store.document,{stage});
    const localSyntheticAi=runtimeMode!=="production"?window.D1_LOCAL_SYNTHETIC_AI:null;
    const syntheticAi=!!localSyntheticAi||productionRuntime?.authClient?.bootstrapState?.syntheticFixture===true;
    const consentedAi=productionRuntime?.authClient?.bootstrapState?.aiConsent===true&&productionRuntime?.identity?.role==="STUDENT";
    if(syntheticAi||consentedAi){
      openStandardModal(`<section class="export407FSuggestionDialog" role="dialog" aria-modal="true" aria-labelledby="quality-guardian-loading" data-quality-guardian-loading style="width:min(640px,calc(100vw - 40px))">
        <p class="micro-label">Timeline Quality Guardian</p>
        <h2 id="quality-guardian-loading">Checking your Timeline…</h2>
        <p>Running the live MissionMed AI review. Your Timeline stays unchanged until you approve a safe action.</p>
      </section>`,"[data-quality-guardian-loading]");
      try{
        await store.saveNow('BEFORE_GUARDIAN_AI');
        const syncResult=await store.adapter.flush?.();
        if(Number(syncResult?.pending||0)>0||syncResult?.conflict===true){
          const unsynced=new Error("Save and sync this Timeline before running the AI review.");
          unsynced.code="TIMELINE_AI_DOCUMENT_NOT_SYNCED";
          throw unsynced;
        }
        const requestedRevision=localSyntheticAi?Number(store.document.revision||0):await store.adapter.getRemoteRevision?.(store.document.id);
        if(!Number.isInteger(requestedRevision)){
          const unsynced=new Error("Save and sync this Timeline before running the AI review.");
          unsynced.code="TIMELINE_AI_DOCUMENT_NOT_SYNCED";
          throw unsynced;
        }
        const requestedDocument=JSON.stringify(store.document);
        const analysis=localSyntheticAi
          ?await localSyntheticAi.analyzeQuality(store.document,deterministicFindingsForAi(report))
          :await productionRuntime.authClient.analyzeQuality(store.document.id,{
            deterministicFindings:deterministicFindingsForAi(report)
          });
        if(Number(analysis?.documentRevision)!==requestedRevision||JSON.stringify(store.document)!==requestedDocument){
          const stale=new Error("Timeline changed while AI review was running. Run Check My Timeline again.");
          stale.code="TIMELINE_AI_STALE_DOCUMENT";
          throw stale;
        }
        report=mergeAiQualityAnalysis(report,analysis);
      }catch(error){
        report=mergeAiQualityAnalysis(report,{
          status:"AI_UNAVAILABLE",
          mode:"UNAVAILABLE",
          promptVersion:"d1-timeline-quality-guardian-ai.1",
          standardVersion:"D1-TIMELINE-FOUNDER-REANCHOR-015+DR-127",
          unavailableMessage:error?.code==="TIMELINE_AI_STALE_DOCUMENT"
            ?"Timeline changed while AI review was running. Run Check My Timeline again."
            :error?.code==="TIMELINE_AI_DOCUMENT_NOT_SYNCED"
              ?"Save and sync this Timeline before running the AI review."
            :String(error?.code||"").startsWith("SYNTHETIC_DOCUMENT_")
              ?String(error.message)
            :"Timeline AI is temporarily unavailable. Your Timeline was not changed.",
          findings:[],
          unresolvedQuestions:[]
        });
      }
      closeStandardModal({restoreFocus:false});
    }
    lastGuardianReport022=report;
    lastGuardianSource022=qualitySourceText022(store.document);
    if(store.entitlement.canMutate===true){
      try{await persistQualityReport022(store,report);}catch(error){bridge.toast('Guardian review completed. Its saved record needs attention.',{tone:'warning'});}
    }
    const dialog=openStandardModal(`<section class="export407FSuggestionDialog" role="dialog" aria-modal="true" aria-labelledby="quality-guardian-title" data-quality-guardian-dialog style="width:min(860px,calc(100vw - 40px));max-height:min(820px,calc(100vh - 40px));overflow:auto">
      ${renderQualityGuardian(report,{
        viewer:qualityGuardianViewer(store.entitlement,bridge.state.view),
        canFix:store.entitlement.canMutate===true,
        controlClasses:qualityGuardianControls
      })}
    </section>`,"[data-quality-guardian-dialog]");
    if(!dialog)return report;
    dialog.querySelector("[data-quality-close]")?.addEventListener(
      "click",
      ()=>closeStandardModal(),
      {once:true}
    );
    dialog.querySelectorAll("[data-quality-review]").forEach((button)=>{
      button.addEventListener("click",()=>{
        const finding=report.findings.find(({id})=>id===button.dataset.qualityReview);
        closeStandardModal({restoreFocus:false});
        if(finding?.code==="ACCEPTED_SOURCE_ITEM_OMITTED"){
          bridge.go("intake");
          return;
        }
        const event=store.document.events.find(({id})=>finding?.elementIds.includes(String(id)));
        const step={education:1,exams:2,clinical:3,work:4,research:5,personal:6}[event?.categoryId]||7;
        if(store.entitlement.canMutate===true){
          store.mutate("Open Quality Guardian review",(document)=>{
            document.builder=document.builder||{};
            document.builder.step=step;
            document.builder.reviewFocus={
              eventId:event?.id||null,
              findingId:finding?.id||null
            };
          },{history:false,material:false});
          syncBridgeFromStore();
        }
        bridge.go("builder");
      },{once:true});
    });
    dialog.querySelectorAll("[data-quality-fix]").forEach((button)=>{
      button.addEventListener("click",()=>{
        const selected=report.findings.find(({id})=>id===button.dataset.qualityFix);
        if(!selected||selected.actionMode!=="FIX_FOR_ME"||store.entitlement.canMutate!==true)return;
        const result=applySafeQualityFixes(store.document,{
          ...report,
          findings:report.findings.filter(({id})=>id===selected.id)
        });
        if(!result.changed){
          button.textContent="Open Advanced Studio";
          button.insertAdjacentHTML("afterend",'<p class="field-help" role="status">No safe improvement found. Use Advanced Studio to adjust the spacing or size of these elements.</p>');
          button.addEventListener("click",()=>{
            closeStandardModal({restoreFocus:false});
            api.openAdvancedStudio();
          },{once:true});
          return;
        }
        const beforeDocument=JSON.stringify(store.document);
        const previewSvg=(timeline,side)=>serializeFounderPresentation(timeline,{
          audience:"EVERYTHING",currentMonth:currentMonth(),
          resourceNamespace:`guardian-fix-${side}`,mediaById:liveMediaById(timeline)
        }).svg;
        const beforeSvg=previewSvg(store.document,"before");
        const afterSvg=previewSvg(result.document,"after");
        closeStandardModal({restoreFocus:false});
        const preview=openStandardModal(`<section class="export407FSuggestionDialog qualityFixPreview" role="dialog" aria-modal="true" aria-labelledby="quality-fix-title" data-quality-fix-preview>
          <h2 id="quality-fix-title">Review the layout change</h2>
          <p>Compare the proposed presentation change. Your dates, scores and experiences stay the same.</p>
          <div class="qualityFixComparison"><figure><figcaption>Before</figcaption>${beforeSvg}</figure><figure><figcaption>Proposed</figcaption>${afterSvg}</figure></div>
          <p data-quality-fix-status>Nothing has changed yet. Apply this change to save it as one undoable step.</p>
          <div class="dialog-actions"><button class="btnD alt sm" data-quality-fix-cancel>Back to review</button><button class="btnD go sm" data-quality-fix-apply>Apply layout change</button></div>
        </section>`,"[data-quality-fix-preview]");
        if(!preview)return;
        preview.querySelector("[data-quality-fix-cancel]")?.addEventListener("click",()=>{
          closeStandardModal({restoreFocus:false});
          void openQualityGuardian407F("DURING_BUILDING");
        },{once:true});
        preview.querySelector("[data-quality-fix-apply]")?.addEventListener("click",()=>{
          if(JSON.stringify(store.document)!==beforeDocument||store.entitlement.canMutate!==true){
            preview.querySelector("[data-quality-fix-status]").textContent="Your Timeline changed. Go back to review before applying a layout change.";
            preview.querySelector("[data-quality-fix-apply]").disabled=true;
            return;
          }
          if(report.ai?.status==="COMPLETE"&&String(selected.id).startsWith("qg-ai:")){
          appendTimelineAiFeedback(result.document,{
            workflow:"QUALITY_GUARDIAN",
            workflowVersion:report.ai.promptVersion,
            modelVersion:report.ai.model,
            suggestionId:selected.id,
            suggestionType:selected.code,
            confidence:Number(selected.evidence?.confidence)||0,
            outcome:"ACCEPTED",
            layoutFix:selected.fixKind,
            layoutFixAccepted:true,
            actorKind:qualityGuardianViewer(store.entitlement,bridge.state.view).startsWith("Founder")?"FOUNDER":"STUDENT",
            finalCanonicalReference:`document:${store.document.id}@revision:${Number(store.document.revision||0)+1}`
          });
          }
          store.replace(result.document,{label:"Quality Guardian: safe layout fix"});
          syncBridgeFromStore();
          const appliedDocument=JSON.stringify(store.document);
          preview.querySelector("[data-quality-fix-status]").textContent="Layout change saved. Your facts are unchanged.";
          preview.querySelector("[data-quality-fix-apply]").remove();
          const undo=document.createElement("button");
          undo.className="btnD alt sm";
          undo.textContent="Undo layout change";
          undo.dataset.qualityFixUndo="true";
          preview.querySelector(".dialog-actions").append(undo);
          undo.addEventListener("click",()=>{
            if(JSON.stringify(store.document)!==appliedDocument||store.historyStatus().undoLabel!=="Quality Guardian: safe layout fix"){
              preview.querySelector("[data-quality-fix-status]").textContent="Your Timeline changed again. Close this preview and use the editor history to choose an undo step.";
              undo.disabled=true;
              return;
            }
            store.undo();
            syncBridgeFromStore();
            preview.querySelector("[data-quality-fix-status]").textContent="Layout change undone. The Before version is restored.";
            undo.disabled=true;
          },{once:true});
        },{once:true});
      },{once:true});
    });
    dialog.querySelector("[data-quality-continue-export]")?.addEventListener(
      "click",
      ()=>{
        closeStandardModal({restoreFocus:false});
        bridge.go("export");
        announceGlobal("Quality Check complete. Opened Export.");
      },
      {once:true}
    );
    return report;
  };
  const qualityGuardianButton=document.createElement("button");
  qualityGuardianButton.type="button";
  qualityGuardianButton.id="qualityGuardian407F";
  qualityGuardianButton.className="btnD alt sm";
  qualityGuardianButton.dataset.qualityGuardianOpen="true";
  qualityGuardianButton.textContent="CHECK MY TIMELINE";
  document.getElementById("hudExport")?.before(qualityGuardianButton);
  onQualityGuardianCapture=(event)=>{
    const trigger=event.target?.closest?.(
      "[data-quality-guardian-open],#hudExport,#rail [data-v='export'],[data-nav='export'],[data-review-export]"
    );
    if(!trigger)return;
    if(trigger.matches("button:disabled,[aria-disabled='true']"))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void openQualityGuardian407F(
      trigger.hasAttribute("data-quality-guardian-open")
        ?"DURING_BUILDING"
        :"BEFORE_EXPORT"
    );
  };
  document.addEventListener("click",onQualityGuardianCapture,true);
  api.qualityGuardian=Object.freeze({
    analyze:(stage="DURING_BUILDING")=>analyzeTimelineQuality(store.document,{stage}),
    open:openQualityGuardian407F
  });
  const updateBuilderPreviewHitTargets=(root)=>{
    const surface=root?.matches?.("[data-builder-preview-surface]")
      ?root
      :root?.querySelector?.("[data-builder-preview-surface]");
    const priorProxies=[...(surface?.querySelectorAll?.(
      "[data-builder-preview-hit-proxy]"
    )||[])];
    const priorSources=[...(surface?.querySelectorAll?.(
      "[data-builder-preview-proxied-source]"
    )||[])];
    for(const proxy of priorProxies){
      const token=proxy.dataset.builderPreviewProxyToken;
      const source=priorSources.find(
        (candidate)=>candidate.dataset.builderPreviewProxyToken===token
      );
      if(source){
        source.setAttribute("role","button");
        source.setAttribute("tabindex",proxy.getAttribute("tabindex")||"-1");
        source.setAttribute("aria-label",proxy.getAttribute("aria-label")||"Edit timeline item");
        source.removeAttribute("data-builder-preview-proxied-source");
        source.removeAttribute("data-builder-preview-proxy-token");
      }
      proxy.remove();
    }
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
    let proxySequence=0;
    for(const target of builderPreviewFocusableTargets(root)){
      if(target.hasAttribute("data-builder-preview-hit-proxy"))continue;
      if(
        target.namespaceURI!=="http://www.w3.org/2000/svg"||
        target.closest?.("foreignObject")
      ){
        const targetBounds=target.getBoundingClientRect?.();
        const surfaceBounds=surface.getBoundingClientRect?.();
        if(!targetBounds?.width||!targetBounds?.height||!surfaceBounds)continue;
        const width=Math.max(44,targetBounds.width);
        const height=Math.max(44,targetBounds.height);
        const proxy=document.createElement("button");
        proxy.type="button";
        proxy.className="builderPreviewHitProxy";
        proxy.setAttribute("data-builder-preview-hit-proxy","true");
        const proxyToken=`preview-hit-${proxySequence++}`;
        proxy.setAttribute("data-builder-preview-proxy-token",proxyToken);
        proxy.innerHTML='<span data-hit-edge="top"></span><span data-hit-edge="right"></span><span data-hit-edge="bottom"></span><span data-hit-edge="left"></span>';
        for(const attribute of [
          "data-builder-preview-event",
          "data-builder-preview-interview",
          "data-builder-preview-retake",
          "data-builder-preview-owner",
          "data-owner-kind",
          "data-owner-id",
          "data-owner-order",
          "data-event-id",
          "data-retake-target"
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
        proxy.setAttribute("tabindex",target.getAttribute("tabindex")||"-1");
        proxy.style.left=`${targetBounds.left-surfaceBounds.left-(width-targetBounds.width)/2}px`;
        proxy.style.top=`${targetBounds.top-surfaceBounds.top-(height-targetBounds.height)/2}px`;
        proxy.style.width=`${width}px`;
        proxy.style.height=`${height}px`;
        proxy.style.setProperty("--effective-source-width",`${targetBounds.width}px`);
        proxy.style.setProperty("--effective-source-height",`${targetBounds.height}px`);
        surface.append(proxy);
        target.setAttribute("data-builder-preview-proxied-source","true");
        target.setAttribute("data-builder-preview-proxy-token",proxyToken);
        target.removeAttribute("role");
        target.removeAttribute("tabindex");
        target.removeAttribute("aria-label");
        continue;
      }
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
  const builderPreviewKernel=(surface,{interactive=true}={})=>
    renderResponsiveAdvancedBoard(store.document,{
      surface:surface==="embedded"?"builder":surface==="lightbox"?"full-preview":"home",
      audience:"INTERVIEWER_SAFE",
      interactive
    });
  const mountBuilderPreview=(host,{
    surface="embedded",
    namespace=`d1-405-builder-${surface}`,
    force=false
  }={})=>{
    if(!host)return false;
    const signature=[
      namespace,
      surface,
      timelineRenderSignature(store.document),
      // Blob URLs arrive after the document: a cached preview must observe hydration.
      JSON.stringify([...liveMediaById(store.document).entries()].sort()),
      store.entitlement.canMutate
    ].join("|");
    if(
      !force&&
      host.dataset.builderPreviewSignature===signature&&
      host.querySelector("[data-builder-preview-surface]")
    )return false;
    let rendered=null;
    const interactive=surface!=="home"&&store.entitlement.canMutate===true;
    try{
      rendered=builderPreviewKernel(surface,{
        interactive
      });
    }catch(error){
      toastStudentError(error,"open");
    }
    if(!rendered?.html&&host.querySelector("[data-builder-preview-surface]")){
      host.dataset.builderPreviewError="true";
      return false;
    }
    host.dataset.builderPreviewSignature=signature;
    delete host.dataset.builderPreviewError;
    const next=document.createElement("div");
    next.innerHTML=rendered?.html
      ?`<div class="builderPreviewSurface" data-builder-preview-surface="${surface}" data-interactive="${interactive}" role="region" aria-label="${interactive
        ?"Interactive timeline preview. Use arrow keys to move between timeline items and Enter to edit."
        :store.entitlement.canMutate===true
          ?"Timeline preview. Open Edit Timeline to make changes."
          :"Timeline preview. Editing is unavailable in read-only access."
      }" data-presentation-kernel="D1-TIMELINE-FOUNDER-REANCHOR-015+DR-127" data-founder-serializer="${FOUNDER_PRESENTATION_SERIALIZER}">${rendered.html}</div>`
      :`<div class="builderPreviewTrueEmpty" role="status"><strong>Your timeline preview will appear here.</strong><span>Add information in Builder to create the final 16:9 artifact.</span></div>`;
    host.replaceChildren(...next.childNodes);
    return true;
  };
  const renderBuilderEmbeddedPreview=({force=false}={})=>
    mountBuilderPreview(document.getElementById("boardWizard"),{
      surface:"embedded",
      namespace:"d1-405-builder-embedded",
      force
    });
  const renderHomePreview=({force=false}={})=>{
    /* P0 canonical-board law: the Founder template renders on Home at zero events too. */
    return mountBuilderPreview(document.getElementById("boardCommand"),{
      surface:"home",
      namespace:"d1-405-home-preview",
      force
    });
  };
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
    const opener=builderPreviewOpener;
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
      opener?.focus?.();
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        const current=document.getElementById("builderPreviewToggle");
        (current||opener)?.focus?.();
      }));
      setTimeout(()=>{
        const current=document.getElementById("builderPreviewToggle");
        (current||opener)?.focus?.();
      },0);
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
      }else if(route.kind==="core-profile"){
        target=document.querySelector(route.focusSelector||'[data-core="name"]');
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
      bridge.toast(entitlementStudentReason(),{tone:"warning",diagnostic:store.entitlement.reason});
      return false;
    }
    const route=resolveBuilderPreviewOwner(store.document,attributes);
    if(!route){
      bridge.toast("This preview item is not connected to an editable entry.");
      return false;
    }
    if(route.kind==="media-library"){
      if(fromLightbox)closeBuilderPreview({restoreFocus:false});
      bridge.go("media");
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        document.querySelector(route.focusSelector)?.focus?.();
      }));
      announceGlobal("Opened Media for this image");
      return true;
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
    }else if(route.kind==="core-profile"){
      store.mutate("Open profile details",(document)=>{
        document.builder={...(document.builder||{}),step:1};
      },{history:false,material:false});
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
        :route.kind==="core-profile"
          ?"Opened profile details in Builder"
        :`Opened ${event?.title||"timeline item"} in Builder`
    );
    return true;
  };
  const activateBuilderPreviewRetake=(targetAttemptId,{fromLightbox=false}={})=>{
    if(store.entitlement.canMutate!==true){
      bridge.toast(entitlementStudentReason(),{tone:"warning",diagnostic:store.entitlement.reason});
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
  const onKernelInteraction=(event)=>{
    const detail=event.detail||{};
    if(!detail.surface)return;
    const domainId=String(detail.domainId||"");
    if(detail.surface==="edit"){
      if(domainId){
        const next={
          selectedEventId:domainId,
          toolbarFocus:false,
          categoryMenuOpen:false,
          contextMenu:null,
          detailsEventId:detail.op==="edit-requested"?domainId:null,
          advancedSelection:null
        };
        canvasController?.setUiState(next);
      }else{
        const selectionByObject={
          "year-axis":{type:"axis",id:"axis"},
          "color-key":{type:"color-key",id:"color-key"},
          "title-plaque":{type:"headline",id:"headline"},
          "profile-sheet":{type:"profile",id:"profile"},
          "profile-photo-well":{type:"portrait",id:"portrait"}
        };
        const selection=selectionByObject[String(detail.objectId||"")]||null;
        if(detail.op==="select"){
          canvasController?.setUiState({
            selectedEventId:null,
            detailsEventId:null,
            advancedSelection:selection,
            advancedPanel:selection?.type==="axis"||selection?.type==="color-key"
              ?"timeline"
              :"elements"
          });
        }
        if(detail.op==="edit-requested"){
        if(detail.objectType==="profile"||detail.objectType==="profile-photo"){
          activateBuilderPreviewOwner({ownerKind:"core-profile",ownerId:"profile"});
        }else if(detail.objectType==="logo"){
          activateBuilderPreviewOwner({ownerKind:"interview-target",ownerId:"interview-target"});
        }else if(detail.objectType==="photo"){
          activateBuilderPreviewOwner({ownerKind:"media-library",ownerId:"media"});
        }else if(detail.objectType==="callout"){
          const explanation=(store.document.events||[]).find(
            (item)=>item?.fields?.builderDomain==="explanation"||item?.eventType==="explanation"
          );
          if(explanation)activateBuilderPreviewOwner({eventId:explanation.id});
        }
        }
      }
      return;
    }
    if(!["builder","full-preview"].includes(detail.surface))return;
    if(store.entitlement.canMutate!==true)return;
    if(domainId){
      activateBuilderPreviewOwner({eventId:domainId},{fromLightbox:detail.surface==="full-preview"});
      return;
    }
    if(detail.op!=="edit-requested"&&detail.op!=="select")return;
    if(detail.objectType==="profile"||detail.objectType==="profile-photo"){
      activateBuilderPreviewOwner(
        {ownerKind:"core-profile",ownerId:"profile"},
        {fromLightbox:detail.surface==="full-preview"}
      );
    }else if(detail.objectType==="logo"){
      activateBuilderPreviewOwner(
        {ownerKind:"interview-target",ownerId:"interview-target"},
        {fromLightbox:detail.surface==="full-preview"}
      );
    }else if(detail.objectType==="photo"){
      activateBuilderPreviewOwner(
        {ownerKind:"media-library",ownerId:"media"},
        {fromLightbox:detail.surface==="full-preview"}
      );
    }
  };
  const onKernelGesture=(event)=>{
    const detail=event.detail||{};
    if(detail.surface!=="edit"||store.entitlement.canMutate!==true)return;
    try{
      let transaction=beginCanvasDrag(store.document,detail.domainId,{
        kind:detail.kind,
        currentMonth:currentMonth(),
        reducedMotion:window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
      });
      transaction=updateCanvasDrag(transaction,detail.kind==="lane"
        ?{targetLane:detail.targetLane}
        :{monthDelta:detail.monthDelta});
      const result=commitCanvasDrag(store,transaction);
      if(result.changed){
        syncBridgeStateFromStore();
        bridge.toast(result.announcement||"Timeline updated");
      }
    }catch(error){
      toastStudentError(error,"layout");
    }
  };
  const normalizeFurnitureGeometry=(value,fallback)=>{
    const source=value&&typeof value==="object"?value:{};
    return{
      x:Number.isFinite(Number(source.x))?Number(source.x):fallback.x,
      y:Number.isFinite(Number(source.y))?Number(source.y):fallback.y,
      width:Number.isFinite(Number(source.width))?Number(source.width):fallback.width,
      height:Number.isFinite(Number(source.height))?Number(source.height):fallback.height
    };
  };
  const furnitureOverlaps=(first,second,gap=12)=>!(
    first.x+first.width+gap<=second.x||
    second.x+second.width+gap<=first.x||
    first.y+first.height+gap<=second.y||
    second.y+second.height+gap<=first.y
  );
  const furnitureGeometryFor=(document,key)=>normalizeFurnitureGeometry(
    document?.presentationOverrides?.[key],
    key==="colorKeyGeometry"
      ?{x:20,y:300,width:284,height:346}
      :{x:13,y:661,width:545,height:410}
  );
  const rejectFurnitureCollision=(selection)=>{
    canvasController?.render?.();
    canvasController?.setUiState({
      selectedEventId:null,detailsEventId:null,advancedSelection:selection,advancedPanel:"timeline"
    });
    const kernel=canvasHost?.querySelector?.('d1-timeline-kernel[data-surface="edit"]');
    kernel?.restorePresentationGeometry?.({
      colorKeyGeometry:furnitureGeometryFor(store.document,"colorKeyGeometry"),
      profileGeometry:furnitureGeometryFor(store.document,"profileGeometry")
    });
    bridge.toast("Keep the Color Key and profile card separate so your Timeline stays readable.");
  };
  const onKernelPresentationGesture=(event)=>{
    const detail=event.detail||{};
    if(detail.surface!=="edit"||store.entitlement.canMutate!==true)return;
    let result=null;
    if(detail.kind==="axis-boundary"){
      const range=setAxisPresentationOverride(store.document,{
        startYear:Number(detail.startYear),endYear:Number(detail.endYear),
        includeFuture:detail.includeFuture!==false
      });
      result=range.changed
        ?setAxisSegmentWeights(range.document,detail.segmentWeights)
        :range;
    }else if(detail.kind==="color-key-move"||detail.kind==="color-key-resize"){
      result=setColorKeyGeometryPresentationOverride(store.document,detail.geometry||{});
      const nextKey=furnitureGeometryFor(result.document,"colorKeyGeometry");
      const profile=furnitureGeometryFor(store.document,"profileGeometry");
      if(furnitureOverlaps(nextKey,profile)){
        rejectFurnitureCollision({type:"color-key",id:"color-key"});
        return;
      }
    }else if(detail.kind==="profile-card-move"||detail.kind==="profile-card-resize"){
      const geometry=detail.geometry||{};
      const document=clone(store.document);
      const width=Math.max(360,Math.min(900,Number(geometry.width)||566));
      const height=Math.max(272,Math.min(680,Number(geometry.height)||428));
      document.presentationOverrides={...(document.presentationOverrides||{}),profileGeometry:{
        x:Math.max(0,Math.min(1920-width,Number(geometry.x)||0)),
        y:Math.max(0,Math.min(1080-height,Number(geometry.y)||0)),
        width,height
      }};
      result={document,changed:true,mutation:{label:"Change profile card presentation"}};
      const key=furnitureGeometryFor(store.document,"colorKeyGeometry");
      const nextProfile=furnitureGeometryFor(document,"profileGeometry");
      if(furnitureOverlaps(key,nextProfile)){
        rejectFurnitureCollision({type:"profile",id:"profile"});
        return;
      }
    }
    if(!result)return;
    if(result.error){bridge.toast(result.error);return;}
    if(!result.changed)return;
    store.replace(result.document,{label:result.mutation?.label||"Change timeline presentation"});
    syncBridgeStateFromStore();
    const selection=detail.kind==="axis-boundary"
      ?{type:"axis",id:"axis"}
      :detail.kind.startsWith("profile-card-")
        ?{type:"profile",id:"profile"}
        :{type:"color-key",id:"color-key"};
    canvasController?.setUiState({
      selectedEventId:null,detailsEventId:null,advancedSelection:selection,advancedPanel:"timeline"
    });
    bridge.toast(detail.kind==="axis-boundary"?"Year widths updated":"Color key updated");
  };
  onKernelPresentationEventGesture=(event)=>{
    const detail=event.detail||{};
    if(
      detail.surface!=="edit"||
      store.entitlement.canMutate!==true||
      store.document.mode!=="advanced"||
      !detail.domainId||
      !detail.geometry
    )return;
    const domainId=String(detail.domainId);
    const semanticEvent=store.document.events.find((item)=>String(item.id)===domainId);
    if(!semanticEvent)return;
    const label=String(detail.kind||"").startsWith("resize")
      ?"Resize Timeline event presentation"
      :"Move Timeline event presentation";
    const result=applySceneCommandToDocument(store.document,{
      kind:"geometry",
      target:{type:"event",id:domainId},
      geometry:detail.geometry,
      create:{
        type:"event",
        semanticRef:domainId,
        aspectLocked:false,
        presentation:{eventType:semanticEvent.eventType||"duration"}
      },
      label
    });
    if(!result.changed)return;
    store.replace(result.document,{label});
    syncBridgeStateFromStore();
    bridge.toast(detail.kind==="move"?"Timeline item positioned":"Timeline item resized");
  };
  const reselectAdvancedKernel=(type,id,attempt=0)=>{
    const kernel=canvasHost?.querySelector?.('d1-timeline-kernel[data-surface="edit"]');
    if(kernel?.selectAdvancedObject?.(type,id))return;
    if(attempt<12)setTimeout(()=>reselectAdvancedKernel(type,id,attempt+1),80);
  };
  onKernelAdvancedSelect=(event)=>{
    const detail=event.detail||{};
    if(detail.surface!=="edit"||!detail.type)return;
    clearTimeout(advancedTextSelectionTimer);
    if(detail.type==="multi"){
      const members=(Array.isArray(detail.members)?detail.members:[])
        .filter((member)=>["media","text","element"].includes(member?.type)&&member?.id);
      if(members.length<2)return;
      canvasController?.setUiState({
        selectedEventId:null,detailsEventId:null,
        advancedSelection:{type:"multi",members},advancedTextEdit:null
      });
      return;
    }
    if(!detail.id)return;
    const reconcileSelection=()=>{
      canvasController?.setUiState({
        selectedEventId:null,
        detailsEventId:null,
        advancedSelection:{type:String(detail.type),id:String(detail.id)},
        advancedTextEdit:null
      });
      reselectAdvancedKernel(detail.type,detail.id);
    };
    // Text inside a composition reports the enclosing group on the first
    // click. Defer inspector reconciliation long enough for the protected
    // kernel to receive a second click and enter contenteditable mode. The
    // advanced-text-editing event cancels this timer, so the live text node is
    // never replaced between the two clicks.
    if(detail.type==="text"||detail.type==="group"){
      advancedTextSelectionTimer=setTimeout(reconcileSelection,900);
      return;
    }
    reconcileSelection();
  };
  onKernelAdvancedGesture=(event)=>{
    const detail=event.detail||{};
    if(detail.surface!=="edit"||store.entitlement.canMutate!==true)return;
    if(!["group","text","element","media"].includes(detail.type)||!detail.id||!detail.geometry)return;
    const label=detail.kind==="resize"
      ?detail.type==="group"?"Resize Timeline group":"Resize Timeline object"
      :detail.type==="group"?"Move Timeline group":"Move Timeline object";
    const result=applySceneCommandToDocument(store.document,{
      kind:"geometry",
      target:{type:String(detail.type),id:String(detail.id)},
      geometry:detail.geometry,
      label
    });
    if(!result.changed)return;
    store.replace(result.document,{label});
    syncBridgeStateFromStore();
    canvasController?.setUiState({advancedSelection:{type:detail.type,id:String(detail.id)}});
    reselectAdvancedKernel(detail.type,detail.id);
  };
  onKernelAdvancedText=(event)=>{
    clearTimeout(advancedTextSelectionTimer);
    const detail=event.detail||{};
    if(detail.surface!=="edit"||store.entitlement.canMutate!==true)return;
    const text=String(detail.text||"");
    const result=applySceneCommandToDocument(store.document,{
      kind:"text",
      target:{type:"text",id:String(detail.id)},
      text,
      label:"Edit Advanced text"
    });
    if(!result.changed)return;
    store.replace(result.document,{label:"Edit Advanced text"});
    syncBridgeStateFromStore();
    canvasController?.setUiState({advancedSelection:{type:"text",id:String(detail.id)}});
  };
  onKernelAdvancedTextEditing=(event)=>{
    const detail=event.detail||{};
    if(detail.surface==="edit")clearTimeout(advancedTextSelectionTimer);
  };
  onKernelAdvancedDrop=(event)=>{
    const detail=event.detail||{};
    if(detail.surface!=="edit"||store.entitlement.canMutate!==true)return;
    advancedHooks().onAssetDrop(detail.payload,{x:detail.x,y:detail.y});
  };
  onKernelAdvancedCommand=(event)=>{
    const detail=event.detail||{};
    if(detail.surface!=="edit"||store.entitlement.canMutate!==true)return;
    if(!["duplicate","delete"].includes(detail.command)||!detail.target)return;
    advancedHooks().onObjectAction(detail.command,detail.target);
  };
  onKernelRejected=(event)=>{
    const detail=event.detail||{};
    if(detail.surface!=="edit"||store.entitlement.canMutate!==true)return;
    if(Number(kernelManager.projection()?.model?.revision)!==Number(detail.revision))return;
    const entry=store.undo();
    if(entry)syncBridgeStateFromStore();
    const message=studentMessage(detail,{
      context:"layout",
      fallback:"We kept your last working layout."
    });
    canvasController?.setUiState((state)=>({...state,liveAnnouncement:message}));
    bridge.toast(message);
  };
  const onKernelCommand=(event)=>{
    const detail=event.detail||{};
    if(detail.surface==="full-preview"&&detail.command==="close-preview"){
      closeBuilderPreview();
      return;
    }
    if(detail.surface!=="edit"||store.entitlement.canMutate!==true)return;
    let announcement="";
    if(detail.command==="undo")announcement=undoCanvas(store).announcement;
    else if(detail.command==="redo")announcement=redoCanvas(store).announcement;
    else if(detail.command==="delete"){
      announcement=deleteCanvasEvent(store,detail.domainId).announcement;
    }else return;
    syncBridgeStateFromStore();
    canvasController?.setUiState((state)=>({
      ...state,
      selectedEventId:detail.command==="delete"?null:state.selectedEventId,
      detailsEventId:detail.command==="delete"?null:state.detailsEventId,
      liveAnnouncement:announcement
    }));
    announceGlobal(announcement);
  };
  const onKernelMediaDrop=(event)=>{
    const detail=event.detail||{};
    if(!["builder","edit"].includes(detail.surface))return;
    if(store.entitlement.canMutate!==true)return;
    commitMediaPlacement(detail.id,{x:detail.x,y:detail.y});
  };
  document.addEventListener("d1-411a:interaction",onKernelInteraction);
  document.addEventListener("d1-411a:gesture",onKernelGesture);
  document.addEventListener("d1-411a:presentation-gesture",onKernelPresentationGesture);
  document.addEventListener("d1-411a:presentation-event-gesture",onKernelPresentationEventGesture);
  document.addEventListener("d1-411a:advanced-select",onKernelAdvancedSelect);
  document.addEventListener("d1-411a:advanced-gesture",onKernelAdvancedGesture);
  document.addEventListener("d1-411a:advanced-text-editing",onKernelAdvancedTextEditing);
  document.addEventListener("d1-411a:advanced-text",onKernelAdvancedText);
  document.addEventListener("d1-411a:advanced-drop",onKernelAdvancedDrop);
  document.addEventListener("d1-411a:advanced-command",onKernelAdvancedCommand);
  document.addEventListener("d1-411a:rejected",onKernelRejected);
  document.addEventListener("d1-411a:command",onKernelCommand);
  document.addEventListener("d1-411a:media-drop",onKernelMediaDrop);
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
      "[data-builder-preview-event],[data-builder-preview-interview],[data-builder-preview-retake],[data-builder-preview-owner]"
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
      "[data-builder-preview-event],[data-builder-preview-interview],[data-builder-preview-retake],[data-builder-preview-owner]"
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
        .catch((error)=>toastStudentError(error));
      return;
    }
    if(typeof bridge.openModal!=="function")return;
    openStandardModal(
      renderModeDialog(plan.dialog),
      "[data-advanced-dialog]"
    );
    document.querySelector("[data-mode-dialog-secondary]")?.addEventListener("click",()=>{
      closeStandardModal();
      const decision=targetMode==="advanced"?"stay-guided":"cancel";
      applyModeDecision(plan,decision)
        .catch((error)=>toastStudentError(error));
    },{once:true});
    document.querySelector("[data-mode-dialog-primary]")?.addEventListener("click",()=>{
      closeStandardModal();
      const decision=targetMode==="advanced"?"enter-advanced":"return-guided";
      applyModeDecision(plan,decision)
        .catch((error)=>toastStudentError(error));
    },{once:true});
  };
  api.openAdvancedStudio=()=>{bridge.go("canvas");requestCanvasMode("advanced");};
  const addAdvancedMedia=async(kind)=>{
    const accept=kind==="gif"
      ?".gif,image/gif"
      :kind==="logo"
        ?".png,.jpg,.jpeg,.gif,image/png,image/jpeg,image/gif"
        :".png,.jpg,.jpeg,image/png,image/jpeg";
    const file=await chooseLocalFile(accept);
    if(!file)return;
    const id=uid(`advanced-${kind}`);
    const metrics=await imageMetrics(file,{kind});
    const media=createMediaElement({
      id,
      kind,
      file,
      naturalWidth:metrics.width,
      naturalHeight:metrics.height,
      layerIndex:nextAdvancedLayerIndex()
    });
    const contentSha256=await sha256File(file);
    const persistence=await prepareMediaPersistence(file,{id,kind,contentSha256});
    media.source=persistence.source;
    try{
      await store.mutateWithBlobs(
        `Add ${kind}`,
        (document)=>{
          document.advanced.media.push(media);
          document.advanced.scene=reconcileAdvancedScene(document.advanced,{
            revision:document.revision
          });
        },
        {blobs:[persistence.blob],reason:"ADD_ADVANCED_MEDIA"}
      );
    }catch(error){
      await persistence.rollback();
      throw error;
    }
    mediaUrls.set(id,file);
    syncBridgeStateFromStore();
    canvasController?.setUiState({advancedSelection:{type:"media",id}});
  };
  const addAdvancedBackground=async(file)=>{
    if(!file)return;
    const priorObjectId=store.document.advanced?.background?.source?.objectId;
    const id=uid("advanced-background");
    const metrics=await imageMetrics(file,{sample:true,background:true});
    const background=createUploadedBackground(file,{
      id,
      luminance:metrics.luminance
    });
    const contentSha256=await sha256File(file);
    const persistence=await prepareMediaPersistence(file,{
      id,kind:"background",contentSha256
    });
    background.source=persistence.source;
    try{
      await store.mutateWithBlobs(
        "Change background",
        (document)=>{document.advanced.background=background;},
        {blobs:[persistence.blob],reason:"CHANGE_ADVANCED_BACKGROUND"}
      );
    }catch(error){
      await persistence.rollback();
      throw error;
    }
    mediaUrls.set(id,file);
    syncBridgeStateFromStore();
    if(priorObjectId){
      retireDurableMediaObject(priorObjectId)
        .catch((error)=>toastStudentError(error,"media"));
    }
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
    syncBridgeStateFromStore();
    canvasController?.setUiState({advancedSelection:target});
  };
  const applyPresentationControlResult=(resultOrFactory)=>{
    const deferred=typeof resultOrFactory==="function";
    const initialResult=deferred?null:resultOrFactory;
    if(initialResult?.error){
      bridge.toast(initialResult.error);
      setTimeout(()=>canvasController?.render(),0);
      return false;
    }
    if(!deferred&&!initialResult?.changed)return false;
    // Do not replace the control subtree from inside its own change/blur
    // dispatch. Safari and Chromium can otherwise attempt to continue a
    // native input event against a node the render just detached.
    const presentationSelection=canvasController?.state?.advancedSelection;
    setTimeout(()=>{
      // Text and color controls can commit during the same browser turn. Resolve
      // factories here, after the preceding deferred mutation has reached the
      // store, so the later change rebases on the latest presentation document
      // instead of restoring a stale sibling field.
      const result=deferred?resultOrFactory():initialResult;
      if(result?.error){
        bridge.toast(result.error);
        canvasController?.render();
        return;
      }
      if(!result?.changed)return;
      store.replace(result.document,{label:result.mutation?.label||"Change timeline presentation"});
      syncBridgeStateFromStore();
      if(["axis","color-key"].includes(presentationSelection?.type)){
        canvasController?.setUiState({
          selectedEventId:null,detailsEventId:null,
          advancedSelection:presentationSelection,advancedPanel:"timeline"
        });
      }
    },0);
    return true;
  };
  /* AAA-019 — a new object must land on top of everything already on the board.
     Using `collection.length` as the layer index put a fresh insert UNDER older objects
     with higher z (a rectangle inserted at z=2 vanished behind a text block at z=5). */
  const nextAdvancedLayerIndex=(document=store.document)=>{
    const advanced=document?.advanced||{};
    const values=[...(advanced.media||[]),...(advanced.textBlocks||[]),...(advanced.elements||[])]
      .flatMap((item)=>[Number(item?.zIndex),Number(item?.layerIndex)])
      .filter((value)=>Number.isFinite(value));
    return values.length?Math.max(...values)+1:0;
  };
  /* Centre of the part of the board the student can currently see, in board units.
     Click-to-add lands here (Canva P2) instead of at a fixed board coordinate that may
     be scrolled out of view at 150%. */
  const visibleBoardCenter=()=>{
    const application=canvasHost?.querySelector?.(".canvas-application");
    const stage=canvasHost?.querySelector?.(".canvas-stage");
    const board=application?.getBoundingClientRect?.();
    const view=stage?.getBoundingClientRect?.();
    if(!board?.width||!board?.height)return{x:960,y:540};
    const left=Math.max(board.left,view?.left??board.left),right=Math.min(board.right,view?.right??board.right);
    const top=Math.max(board.top,view?.top??board.top),bottom=Math.min(board.bottom,view?.bottom??board.bottom);
    if(right<=left||bottom<=top)return{x:960,y:540};
    return{
      x:Math.max(0,Math.min(1920,((left+right)/2-board.left)/board.width*1920)),
      y:Math.max(0,Math.min(1080,((top+bottom)/2-board.top)/board.height*1080))
    };
  };
  const openAdvancedPlacement=(width=200,height=104)=>{
    const occupied=[
      ...(store.document.advanced?.media||[]),
      ...(store.document.advanced?.textBlocks||[]),
      ...(store.document.advanced?.elements||[])
    ].filter((item)=>item.placed!==false).map((item)=>({
      x:Number(item.x)||0,y:Number(item.y)||0,
      width:Number(item.width)||1,height:Number(item.height)||1
    }));
    const overlaps=(candidate,box)=>!(
      candidate.x+candidate.width+18<=box.x||
      box.x+box.width+18<=candidate.x||
      candidate.y+candidate.height+18<=box.y||
      box.y+box.height+18<=candidate.y
    );
    /* Click-to-add lands at the centre of what the student can see (Canva P2). A second
       identical insert cascades by 24px so stacked copies stay visibly distinct, but
       the object never wanders away from the centre to dodge other objects — it sits on
       top of them, which is what "insert" means in every mature editor. */
    const center=visibleBoardCenter();
    const cx=center.x-width/2,cy=center.y-height/2;
    const candidates=[0,1,2,3,4,5].map((step)=>({
      x:Math.max(0,Math.min(1920-width,cx+step*24)),
      y:Math.max(0,Math.min(1080-height,cy+step*24)),width,height
    }));
    const sameSpot=(candidate,box)=>Math.abs(candidate.x-box.x)<2&&Math.abs(candidate.y-box.y)<2;
    return candidates.find((candidate)=>!occupied.some((box)=>sameSpot(candidate,box)))||candidates[0];
  };
  const insertAdvancedAsset=(kind,{x=null,y=null,countryCode="US",centerOnPoint=false}={})=>{
    const id=uid("advanced-element");
    store.mutate("Add Timeline asset",(document)=>{
      document.advanced.elements=document.advanced.elements||[];
      const prototype=createAdvancedElement({id,kind,x:0,y:0,
        countryCode,
        label:"",
        layerIndex:nextAdvancedLayerIndex(document)
      });
      /* A dropped asset is centred on the cursor, like the ghost that followed it. */
      const placement=x!==null&&y!==null&&Number.isFinite(Number(x))&&Number.isFinite(Number(y))
        ?{
          x:Math.max(0,Math.min(1920-prototype.width,Number(x)-(centerOnPoint?prototype.width/2:0))),
          y:Math.max(0,Math.min(1080-prototype.height,Number(y)-(centerOnPoint?prototype.height/2:0)))
        }
        :openAdvancedPlacement(prototype.width,prototype.height);
      document.advanced.elements.push({...prototype,x:placement.x,y:placement.y});
      document.advanced.scene=reconcileAdvancedScene(document.advanced,{
        revision:document.revision
      });
    });
    syncBridgeStateFromStore();
    canvasController?.setUiState({
      selectedEventId:null,
      advancedSelection:{type:"element",id},
      advancedTextEdit:null
    });
    requestAdvancedDirectSelection({type:"element",id});
    setTimeout(()=>canvasHost?.querySelector?.('d1-timeline-kernel[data-surface="edit"]')?.selectAdvancedObject?.("element",id),180);
    return id;
  };
  const advancedHooks=()=>({
    onAxisMode:(mode)=>{
      const result=mode==="manual"
        ?setAxisPresentationOverride(store.document,{})
        :resetAxisPresentationOverride(store.document);
      applyPresentationControlResult(result);
    },
    onAxisChange:(changes)=>{
      applyPresentationControlResult(
        setAxisPresentationOverride(store.document,changes)
      );
    },
    onAxisReset:()=>{
      applyPresentationControlResult(resetAxisPresentationOverride(store.document));
    },
    onAxisWeightChange:(id,weight)=>{
      const axis=store.document.presentationOverrides?.axis;
      if(axis?.mode!=="manual")return;
      const ids=[];
      for(let year=Number(axis.startYear);year<=Number(axis.endYear);year+=1)ids.push(String(year));
      if(axis.includeFuture!==false)ids.push("FUTURE");
      const prior=new Map((axis.segmentWeights||[]).map((item)=>[String(item.id),Number(item.weight)]));
      applyPresentationControlResult(setAxisSegmentWeights(store.document,ids.map((segmentId)=>({
        id:segmentId,weight:segmentId===id?weight:(prior.get(segmentId)||1)
      }))));
    },
    onAxisWeightReset:()=>{
      applyPresentationControlResult(setAxisPresentationOverride(store.document,{segmentWeights:null}));
    },
    onCategoryKeyChange:(id,changes)=>{
      applyPresentationControlResult(
        ()=>setCategoryKeyPresentationOverride(store.document,id,changes)
      );
    },
    onCategoryKeyReset:()=>{
      applyPresentationControlResult(resetCategoryKeyPresentationOverride(store.document));
    },
    onColorKeyGeometryChange:(changes)=>{
      const candidate=setColorKeyGeometryPresentationOverride(store.document,changes);
      if(
        candidate.changed&&
        furnitureOverlaps(
          furnitureGeometryFor(candidate.document,"colorKeyGeometry"),
          furnitureGeometryFor(store.document,"profileGeometry")
        )
      ){
        rejectFurnitureCollision({type:"color-key",id:"color-key"});
        return;
      }
      applyPresentationControlResult(candidate);
    },
    onColorKeyGeometryReset:()=>{
      applyPresentationControlResult(
        resetColorKeyGeometryPresentationOverride(store.document)
      );
    },
    onPanel:(advancedPanel)=>{
      /* AAA-019 (Canva parity): browsing a different side panel is not a deselect. The
         selection — and its on-board chrome — stays; only an open inline text edit is
         committed first so the draft is never lost behind a panel change. */
      if(canvasController?.state?.advancedTextEdit){
        canvasHost?.querySelector?.("[data-advanced-inline-text-form]")?.requestSubmit?.();
      }
      canvasController?.setUiState({
        advancedPanel,
        advancedAssetQuery:"",
        advancedTextEdit:null,
        backgroundOpen:advancedPanel==="backgrounds"
      });
      const kept=canvasController?.state?.advancedSelection;
      if(kept)requestAdvancedDirectSelection(kept);
    },
    onAssetSearch:(advancedAssetQuery,event)=>{
      const selection={start:event?.target?.selectionStart,end:event?.target?.selectionEnd,direction:event?.target?.selectionDirection};
      canvasController?.setUiState({advancedAssetQuery});
      queueMicrotask(()=>{
        const field=canvasHost?.querySelector?.("[data-advanced-asset-search]");
        field?.focus?.();
        const end=field?.value?.length||0;
        field?.setSelectionRange?.(
          Number.isInteger(selection.start)?Math.min(selection.start,end):end,
          Number.isInteger(selection.end)?Math.min(selection.end,end):end,
          selection.direction||"none"
        );
      });
    },
    onCategoryKeyPalette:(paletteId)=>{
      const palettes={
        missionmed:["#2C6E8F","#3A78C9","#C8641C","#3F9B52","#C9A227","#8A5BBF"],
        coastal:["#1F6F8B","#4C8CCB","#D4772B","#4F8A6A","#D1A93B","#7656A7"],
        heritage:["#315B6E","#466F9E","#A95E2A","#4D7A4B","#A4872E","#74518A"]
      };
      const colors=palettes[paletteId];
      if(!colors)return;
      const ids=["education","exams","clinical","work","research","personal"];
      let next=store.document;
      ids.forEach((id,index)=>{
        const result=setCategoryKeyPresentationOverride(next,id,{color:colors[index]});
        if(result.changed)next=result.document;
      });
      store.replace(next,{label:"Apply color key palette"});
      syncBridgeStateFromStore();
      canvasController?.setUiState({
        selectedEventId:null,detailsEventId:null,
        advancedSelection:{type:"color-key",id:"color-key"}
      });
    },
    /* AAA-019 — Layers panel commands. Up/down/lock share the scene commands the
       keyboard map uses; drag-reorder rewrites the z-order of the front-to-back list. */
    onLayerAction:(action,target)=>{
      if(!target?.type||!target?.id||store.entitlement.canMutate!==true)return;
      const scoped={type:target.type,id:String(target.id)};
      if(action==="up"||action==="down"){
        const result=applySceneCommandToDocument(store.document,{kind:"layer",target:scoped,direction:action==="up"?"bring-forward":"send-backward",label:"Change Timeline layer"});
        if(!result.changed)return;
        store.replace(result.document,{label:"Change Timeline layer"});
      }else if(action==="lock"||action==="unlock"){
        const result=applySceneCommandToDocument(store.document,{kind:"lock",target:scoped,value:action==="lock",label:action==="lock"?"Lock Timeline object":"Unlock Timeline object"});
        if(!result.changed)return;
        store.replace(result.document,{label:action==="lock"?"Lock Timeline object":"Unlock Timeline object"});
      }else if(action==="edit-text"){
        beginAdvancedTextEdit(scoped);
        return;
      }else return;
      syncBridgeStateFromStore();
      canvasController?.setUiState({selectedEventId:null,advancedSelection:scoped,advancedTextEdit:null,advancedPanel:"layers"});
      requestAdvancedDirectSelection(scoped);
      announceGlobal(action==="up"?"Brought forward":action==="down"?"Sent backward":action==="lock"?"Locked":"Unlocked");
    },
    onLayerReorder:(dragged,target,position)=>{
      if(store.entitlement.canMutate!==true||!dragged?.id||!target?.id)return;
      const result=reorderAdvancedLayers(store.document,dragged,target,position);
      if(!result.changed)return;
      store.replace(result.document,{label:"Reorder layers"});
      syncBridgeStateFromStore();
      const selection={type:dragged.type,id:String(dragged.id)};
      canvasController?.setUiState({selectedEventId:null,advancedSelection:selection,advancedTextEdit:null,advancedPanel:"layers"});
      requestAdvancedDirectSelection(selection);
      bridge.toast("Layers reordered");
      announceGlobal("Layers reordered");
    },
    onSelectObject:(target,event=null)=>{
      if(!target){
        canvasController?.setUiState({advancedSelection:null,advancedTextEdit:null});
        requestAdvancedDirectSelection(null);
        return;
      }
      /* AAA-019 red-team D11 — a selection made from a Layers row keeps focus on that row
         (re-found by id after the panel re-renders) so its own keyboard verbs keep working. */
      const fromLayerRow=!!event?.target?.closest?.("[data-advanced-layer-row]");
      const selection=toggleAdvancedSelection(canvasController?.state?.advancedSelection,target,!!(event?.shiftKey||event?.metaKey||event?.ctrlKey));
      canvasController?.setUiState({
        selectedEventId:selection?.type==="event"?selection.id:null,detailsEventId:null,advancedSelection:selection,advancedTextEdit:null
      });
      requestAdvancedDirectSelection(selection);
      if(fromLayerRow){
        const refocusRow=()=>{
          const escaped=globalThis.CSS?.escape?CSS.escape(String(target.id)):String(target.id);
          const row=canvasHost?.querySelector?.(`[data-advanced-layer-row][data-advanced-layer-id="${escaped}"]`);
          row?.focus?.({preventScroll:true});
        };
        queueMicrotask(refocusRow);
        requestAnimationFrame(()=>requestAnimationFrame(refocusRow));
        return;
      }
      queueMicrotask(()=>{
        const protectedObjectId={
          axis:"year-axis",
          "color-key":"color-key",
          headline:"title-plaque",
          profile:"profile-sheet",
          portrait:"profile-photo-well"
        }[target.type]||null;
        const kernel=canvasHost?.querySelector?.(
          'd1-timeline-kernel[data-surface="edit"]'
        );
        if(protectedObjectId)kernel?.selectObject?.(protectedObjectId);
        const escaped=globalThis.CSS?.escape?CSS.escape(target.id):target.id;
        const selector=target.type==="media"
          ?`[data-advanced-media="${escaped}"]`
          :target.type==="text"
            ?`[data-advanced-text="${escaped}"]`
            :`[data-advanced-canonical="${target.type}"]`;
        canvasHost?.querySelector(selector)?.focus?.();
      });
    },
    onGroup:(members)=>{
      try{
        const result=groupAdvancedObjects(store.document,members,{id:uid("advanced-group")});
        if(!result.changed)return;
        store.replace(result.document,{label:"Group Timeline objects"});
        syncBridgeStateFromStore();
        canvasController?.setUiState({advancedSelection:result.selection,advancedTextEdit:null});
        reselectAdvancedKernel("group",result.selection.id);
        requestAdvancedDirectSelection(result.selection);
        announceGlobal("Objects grouped");
      }catch(error){toastStudentError(error,"layout");}
    },
    onClearSelection:()=>{
      canvasController?.setUiState({advancedSelection:null,advancedTextEdit:null});
      /* State alone is not enough: the overlay lives on document.body and survives the
         re-render, so without this the handles stayed on the board pointing at nothing. */
      requestAdvancedDirectSelection(null);
    },
    onAction:(action,_event,control)=>{
      if(action==="background"){
        canvasController?.setUiState({advancedPanel:"backgrounds",backgroundOpen:true,advancedSelection:null});
      }else if(action==="text"||action==="symbol"){
        const id=uid("advanced-text");
        const text=action==="symbol"
          ?String(control?.dataset?.advancedSymbol||"Add your text")
          :"Add your text";
        store.mutate("Add text",(document)=>{
          const prototype=createTextBlock({id,text,
            layerIndex:nextAdvancedLayerIndex(document)
          });
          const placement=openAdvancedPlacement(prototype.width,prototype.height);
          document.advanced.textBlocks.push({...prototype,x:placement.x,y:placement.y});
          document.advanced.scene=reconcileAdvancedScene(document.advanced,{
            revision:document.revision
          });
        });
        syncBridgeStateFromStore();
        canvasController?.setUiState({
          selectedEventId:null,
          detailsEventId:null,
          advancedSelection:{type:"text",id},
          advancedTextEdit:{id,draft:text}
        });
        requestAdvancedDirectSelection({type:"text",id});
        reselectAdvancedKernel("text",id);
        queueMicrotask(()=>{
          const field=canvasHost?.querySelector?.("[data-advanced-inline-text-input]");
          field?.focus?.();
          field?.select?.();
        });
      }else if(["image","gif","logo"].includes(action)){
        addAdvancedMedia(action)
          .catch((error)=>toastStudentError(error,"media"));
      }else if(action==="asset"){
        insertAdvancedAsset(
          String(control?.dataset?.advancedKind||"rectangle"),
          {countryCode:String(control?.dataset?.advancedSymbol||"US")}
        );
      }
    },
    onAssetDrop:(payload,{x,y}={})=>{
      if(payload?.kind!=="insert")return false;
      /* Dragging an object the student already owns is a move, not an insert. Without
         this branch the drop silently did nothing while the app announced success. */
      if(payload.action==="place"&&payload.target){
        if(payload.target.type==="media"&&advancedFrameDropHook(String(payload.target.id),{x,y}))return true;
        const result=placeAdvancedObjectAt(store.document,payload.target,{x,y});
        if(!result.changed)return false;
        store.replace(result.document,{label:result.mutation?.label||"Place Timeline object"});
        syncBridgeStateFromStore();
        canvasController?.setUiState({advancedSelection:result.selection||null});
        return true;
      }
      if(payload.action==="text"||payload.action==="symbol"){
        const id=uid("advanced-text");
        store.mutate("Add text",(document)=>{
          document.advanced.textBlocks.push(createTextBlock({
            id,text:payload.symbol||"Add your text",x,y,
            layerIndex:nextAdvancedLayerIndex(document)
          }));
          document.advanced.scene=reconcileAdvancedScene(document.advanced,{
            revision:document.revision
          });
        });
        syncBridgeStateFromStore();
        canvasController?.setUiState({
          selectedEventId:null,
          detailsEventId:null,
          advancedSelection:{type:"text",id},
          advancedTextEdit:{id,draft:payload.symbol||"Add your text"}
        });
        return true;
      }
      if(payload.action==="asset"){
        insertAdvancedAsset(payload.assetKind||"rectangle",{
          x,y,countryCode:payload.symbol||"US",centerOnPoint:true
        });
        return true;
      }
      return false;
    },
    onObjectAction:(action,target)=>{
      if(action==="ungroup"&&target?.type==="group"){
        const group=store.document.advanced?.groups?.find(
          (item)=>String(item.id)===String(target.id)
        );
        const members=(Array.isArray(group?.children)?group.children:[])
          .map((member)=>{
            if(member&&typeof member==="object")return{
              type:String(member.type||""),id:String(member.id||"")
            };
            const value=String(member||"");
            const separator=value.indexOf(":");
            return separator>=0
              ?{type:value.slice(0,separator),id:value.slice(separator+1)}
              :{type:"",id:value};
          })
          .filter((member)=>["media","text","element"].includes(member.type)&&member.id);
        const result=ungroupAdvancedObjects(store.document,target.id);
        if(!result.changed)return;
        store.replace(result.document,{label:"Ungroup Timeline objects"});
        syncBridgeStateFromStore();
        const selection=members.length>1
          ?{type:"multi",members}
          :members[0]||null;
        canvasController?.setUiState({advancedSelection:selection});
        requestAdvancedDirectSelection(selection);
        canvasHost?.querySelector?.(
          'd1-timeline-kernel[data-surface="edit"]'
        )?.releaseAdvancedGroup?.(target.id,members);
        return;
      }
      if(action==="lock"||action==="unlock"){
        const result=setAdvancedObjectLock(store.document,target,action==="lock");
        store.replace(result,{label:action==="lock"?"Lock Timeline object":"Unlock Timeline object"});
        syncBridgeStateFromStore();
        canvasController?.setUiState({advancedSelection:target});
        return;
      }
      if(target?.type==="group"&&["bring-forward","send-backward"].includes(action)){
        const result=applySceneCommandToDocument(store.document,{
          kind:"layer",
          target:{type:"group",id:String(target.id)},
          direction:action,
          label:action==="bring-forward"?"Bring Timeline group forward":"Send Timeline group backward"
        });
        if(!result.changed)return;
        store.replace(result.document,{label:result.label});
        syncBridgeStateFromStore();
        canvasController?.setUiState({advancedSelection:target});
        reselectAdvancedKernel("group",target.id);
        return;
      }
      const priorObjectId=action==="delete"&&target?.type==="media"
        ?store.document.advanced?.media?.find(
          (item)=>String(item.id)===String(target.id)
        )?.source?.objectId
        :null;
      const result=applyAdvancedObjectAction(store.document,target,action,{
        duplicateId:action==="duplicate"
          ?uid(`advanced-${target?.type||"object"}`)
          :""
      });
      if(!result.changed)return;
      store.replace(result.document,{label:result.mutation.label});
      syncBridgeStateFromStore();
      canvasController?.setUiState({advancedSelection:result.selection});
      /* Delete leaves result.selection null; without this the handles of the object
         that was just removed stayed on the board. */
      requestAdvancedDirectSelection(result.selection||null);
      if(action==="duplicate"&&target?.type==="media"&&result.selection?.id){
        const duplicateId=result.selection.id;
        const source=(store.document.advanced?.media||[]).find(
          (item)=>String(item.id)===String(target.id)
        );
        Promise.resolve(store.adapter.getBlob(String(
          source?.source?.blobKey||target.id
        )))
          .then((blob)=>blob||(
            source?.source?.objectId&&productionRuntime
              ?productionRuntime.authClient.downloadPrivateObject(source.source.objectId)
              :null
          ))
          .then((blob)=>{
            if(!blob)return;
            mediaUrls.set(duplicateId,blob);
            canvasController?.render();
          })
          .catch(()=>{
            announceGlobal("The copied image will appear as soon as it finishes loading.");
          });
      }
      if(priorObjectId){
        mediaUrls.revoke(target.id);
        retireDurableMediaObject(priorObjectId)
          .catch((error)=>toastStudentError(error,"media"));
      }
    },
    onAspectLock:(locked,target)=>{
      if(target?.type!=="media"&&target?.type!=="element"&&target?.type!=="group")return;
      const result=target.type==="media"
        ?setMediaAspectLock(store.document,target,locked)
        :setAdvancedObjectAspectLock(store.document,target,locked);
      store.replace(result,{label:locked?"Lock Media proportions":"Unlock Media proportions"});
      syncBridgeStateFromStore();
      canvasController?.setUiState({advancedSelection:target});
      announceGlobal(locked?"Media proportions locked":"Media proportions unlocked");
    },
    onMediaPresentation:(changes,target)=>{
      try{
        const next=updateMediaPresentation(store.document,target,changes);
        store.replace(next,{label:"Adjust media presentation"});
        syncBridgeStateFromStore();
        canvasController?.setUiState({advancedSelection:target});
        reselectAdvancedKernel("media",target.id);
      }catch(error){toastStudentError(error,"layout");}
    },
    onTypography:(changes,target)=>applyTypographyChange(changes,target),
    /* The position and size inputs rendered and fired, but nothing implemented this hook,
       so typing a width moved nothing. A visible control that does nothing is worse than
       no control - the student assumes the board is broken, not the field. */
    onGeometry:(changes,target)=>{
      try{
        // setAdvancedObjectGeometry returns the next document itself, the same shape
        // updateTextContainerPresentation uses - not a {document,changed} result.
        const next=setAdvancedObjectGeometry(store.document,target,changes);
        store.replace(next,{label:"Set position and size"});
        syncBridgeStateFromStore();
        canvasController?.setUiState({advancedSelection:target});
        reselectAdvancedKernel(target?.type,target?.id);
      }catch(error){toastStudentError(error,"layout");}
    },
    onTextLayout:(changes,target)=>{
      try{
        const next=updateTextContainerPresentation(store.document,target,changes);
        store.replace(next,{label:"Adjust text layout"});
        syncBridgeStateFromStore();
        canvasController?.setUiState({advancedSelection:target});
        reselectAdvancedKernel("text",target.id);
      }catch(error){toastStudentError(error,"layout");}
    },
    onTextContent:(text,target,event)=>{
      const field=event?.target;
      const caret=field?.selectionStart??null;
      const result=updateTextBlockContent(store.document,target,text);
      store.replace(result,{label:"Edit Advanced text"});
      syncBridgeStateFromStore();
      canvasController?.setUiState({advancedSelection:target});
      // The inspector is rebuilt on every keystroke and detaches this textarea mid-word,
      // so put the caret back the way the asset search field does.
      queueMicrotask(()=>{
        const restored=canvasHost?.querySelector?.("[data-advanced-text-content]");
        if(!restored||restored===field)return;
        restored.focus?.();
        if(caret!=null)restored.setSelectionRange?.(caret,caret);
      });
    },
    onBackgroundTab:(backgroundTab)=>canvasController?.setUiState({backgroundTab}),
    onBackgroundPreset:(presetId)=>{
      const priorObjectId=store.document.advanced?.background?.source?.objectId;
      store.mutate("Change background",(document)=>{
        document.advanced.background=createPresetBackground(presetId);
      });
      syncBridgeStateFromStore();
      if(priorObjectId){
        retireDurableMediaObject(priorObjectId)
          .catch((error)=>toastStudentError(error,"media"));
      }
    },
    onBackgroundUpload:(file)=>{
      addAdvancedBackground(file)
        .catch((error)=>toastStudentError(error,"media"));
    },
    onBackgroundDim:(dim)=>{
      store.mutate("Adjust background readability",(document)=>{
        document.advanced.background=setBackgroundDim(document.advanced.background,dim);
      });
      syncBridgeStateFromStore();
    },
    onColor:(color)=>{
      if(!color)return;
      const priorObjectId=store.document.advanced?.background?.source?.objectId;
      store.mutate("Change background color",(document)=>{
        document.advanced.background=createFlatColorBackground(color);
        document.advanced.recentColors=recordRecentColor(
          document.advanced.recentColors,
          color
        );
      });
      syncBridgeStateFromStore();
      if(priorObjectId){
        retireDurableMediaObject(priorObjectId)
          .catch((error)=>toastStudentError(error,"media"));
      }
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
          if(error?.name!=="AbortError")toastStudentError(error);
        });
    },
    onLayoutLock:(locked)=>{
      const result=setLayoutLock(store.document,locked);
      if(!result.changed)return;
      if(result.effects?.rerunAutoArrange)autoArrange(result.document);
      store.replace(result.document,{label:result.mutation.label});
      syncBridgeStateFromStore();
    }
  });
  const renderExportPreview=(input)=>{
    const rendered=renderResponsiveAdvancedBoard(input.timeline,{
      ...input.rendererOptions,
      surface:"export",
      interactive:false
    });
    return`<div class="board-preview canonical-board-preview export407FBoard" role="img" aria-label="Export preview" data-theme="founder-keynote-2024" data-presentation-kernel="D1-TIMELINE-FOUNDER-REANCHOR-015+DR-127" data-founder-serializer="${FOUNDER_PRESENTATION_SERIALIZER}">${rendered.html}</div>`;
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
      attachSelectedSubjectDialog022(dialog,{runtime:productionRuntime,document:store.document});
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
    openStandardModal(`<section class="export407FSuggestionDialog" role="dialog" aria-modal="true" aria-labelledby="export407FSuggestionTitle">
      <h2 id="export407FSuggestionTitle">${escapeMarkup(suggestion.message)}</h2>
      <div>
        <button type="button" class="btnD alt" data-export-suggestion-dismiss>Not now</button>
        <button type="button" class="btnD go" data-export-suggestion-apply>${escapeMarkup(suggestion.actionLabel)}</button>
      </div>
    </section>`,".export407FSuggestionDialog");
    document.querySelector("[data-export-suggestion-dismiss]")?.addEventListener("click",()=>{
      closeStandardModal();
      suggestion.dismiss?.();
    },{once:true});
    document.querySelector("[data-export-suggestion-apply]")?.addEventListener("click",()=>{
      closeStandardModal();
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
  /* The phone stylesheet hides the canvas toolbar outright. Without this notice the board
     just looks broken, so render the banner the responsive model already computes. */
  const renderCanvasResponsiveNotice=()=>{
    const host=document.getElementById("canvasResponsiveNotice407F");
    if(!host)return;
    const notice=renderResponsiveNotice(currentResponsiveModel(),"canvas");
    const markup=notice
      ?`${notice}<p class="responsive407FNoticeHint">You can still read your timeline here. Open Timeline Builder on a laptop or desktop to edit it.</p>`
      :"";
    if(host.innerHTML!==markup)host.innerHTML=markup;
  };
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
        toastStudentError(error,"export");
      }
    }
    exportHost.innerHTML=renderExportScreen(exportDocument,{
      state:exportState,
      previewHtml,
      entitlement:store.entitlement,
      readiness:lastGuardianReport022&&lastGuardianSource022===qualitySourceText022(store.document)?lastGuardianReport022:analyzeTimelineQuality(store.document,{stage:"BEFORE_EXPORT"}),
      readinessCurrent:true,
      exportHistory:store.document.metadata?.exportHistory022||[]
    });
    exportController=installExportScreen(exportHost,exportDocument,{
      state:exportState,
      entitlement:store.entitlement,
      getEntitlement:()=>store.entitlement,
      renderPreview:renderExportPreview,
      exportAdapter,
      toast:(message,options)=>bridge.toast(
        studentMessage(message,{context:"export"}),
        options?{...options,diagnostic:studentDiagnostic(message)}:options
      ),
      requestVersion:(label,kind)=>store.saveVersion(label,kind),
      onExportComplete:result=>recordCompletedExport022(store,result),
      onStateChange:(state,reason)=>{
        exportState=state;
        persistExportStateChange022(store,state,reason);
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
      toastStudentError(error);
      return null;
    }
  };
  const advisorBoardHtml=()=>{
    const forced={
      ...clone(store.document),
      theme:ADVISOR_SESSION_THEME_ID,
      mode:"guided"
    };
    const rendered=renderResponsiveAdvancedBoard(forced,{
      surface:"advisor",
      currentMonth:currentMonth(),
      audience:"EVERYTHING",
      interactive:false
    });
    return`<div class="advisor407FBoardRender" data-theme="${ADVISOR_SESSION_THEME_ID}" data-audience="EVERYTHING">${rendered.html}</div>`;
  };
  function renderAdvisorHost(){
    const advisorHost=document.getElementById("advisor407F");
    if(!advisorHost)return;
    advisorCleanup();
    let boardHtml="";
    try{
      boardHtml=advisorBoardHtml();
    }catch(error){
      toastStudentError(error,"open");
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
    if(bridge.state.view==="command")queueMicrotask(()=>{
      renderHomePreview();
      renderHomeCompletionStatus();
    });
    if(bridge.state.view==="export")queueExportRender();
    if(bridge.state.view==="advisor")queueMicrotask(renderAdvisorHost);
    if(bridge.state.view==="builder"){
      queueBuilderEmbeddedPreview();
      queueMicrotask(renderM9BuilderSurfaces);
    }
    if(["builder","canvas","media"].includes(bridge.state.view)){
      queueMicrotask(renderMediaLibrarySurfaces);
    }
    if(bridge.state.view==="canvas"){
      const selection=canvasController?.state?.advancedSelection;
      if(selection?.type&&selection.type!=="multi"&&selection.id){
        reselectAdvancedKernel(selection.type,selection.id);
        requestAdvancedDirectSelection(selection);
      }
    }
    requestAnimationFrame(applyEntitlementSurface);
  };
  document.addEventListener("d1:407f-rendered",on407FRendered);
  onAdvisorHashChange=()=>{
    const route=decodeURIComponent(String(window.location.hash||"").replace(/^#/,""));
    if(route.startsWith("advisor-session:"))bridge.go("advisor");
  };
  window.addEventListener("hashchange",onAdvisorHashChange);
  const commitExamMutation=(label,mutation,{render=true}={})=>{
    let result=null;
    store.mutate(label,(document)=>{
      apply407FStateToDocument(bridge.state,document);
      result=mutation(document);
    },{emit:render});
    applying=true;
    applyDocumentTo407FState(store.document,bridge.state);
    if(render){
      bridge.renderAll();
      canvasController?.render();
    }else{
      reflectStoreStatus();
      queueBuilderEmbeddedPreview({force:true});
    }
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
      },{render:examMutationNeedsImmediateRender(changes)});
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
  const commitDomainMutation=(label,mutation,{render=true}={})=>{
    let result=null;
    store.mutate(label,(document)=>{
      apply407FStateToDocument(bridge.state,document);
      ensureBuilderState(document);
      result=mutation(document);
    });
    applying=true;
    applyDocumentTo407FState(store.document,bridge.state);
    if(render){
      bridge.renderAll();
      canvasController?.render();
    }else{
      queueBuilderEmbeddedPreview({force:true});
    }
    lastState=stableState(bridge.state);
    applying=false;
    return result;
  };
  api.domain=Object.freeze({
    entryDomain(eventId){return builderDomain022(store.document.events.find(event=>String(event.id)===String(eventId)));},
    importedSummary(eventId){
      const event=store.document.events.find(item=>String(item.id)===String(eventId));
      return isImportedBuilderEvent022(event)?importedBuilderSummary022(event):null;
    },
    importedMarkup(domain,draft){return renderImportedBuilderForm022(draft,domain);},
    readImportedForm(form,draft){return importedDraftFromForm022(form,draft);},
    validateImportedDraft(draft){return validateImportedBuilderDraft022(draft);},
    updateDraft(domain,changes){
      return commitDomainMutation(`Update ${domain} entry`,(document)=>{
        const builder=ensureBuilderState(document);
        builder.drafts[domain]={...builder.drafts[domain],...clone(changes||{})};
        return clone(builder.drafts[domain]);
      },{render:false});
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
        if(normalized.importedEventId||domain!=="clinical"||result?.ok===false||!result?.event){
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
    allCountries(){
      return browserCountryRows();
    },
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
  closeSyncConflictDialog=()=>{
    if(!syncConflictDialog)return;
    if(typeof syncConflictDialog.close==="function"&&syncConflictDialog.open){
      syncConflictDialog.close();
    }
    syncConflictDialog.remove();
    syncConflictDialog=null;
  };
  const openSyncConflictRecovery=async()=>{
    const conflict=await store.adapter?.getConflict?.(store.document.id);
    if(!conflict){
      await store.adapter?.flush?.();
      return;
    }
    closeSyncConflictDialog();
    const dialog=document.createElement("dialog");
    dialog.id="timelineSyncConflictRecovery";
    dialog.setAttribute("aria-labelledby","timelineSyncConflictTitle");
    dialog.style.cssText="max-width:620px;width:calc(100% - 32px);border:1px solid rgba(100,220,255,.35);border-radius:14px;background:#111827;color:#f8fafc;padding:0;box-shadow:0 24px 80px rgba(0,0,0,.65)";
    dialog.innerHTML=`<div style="padding:24px">
      <p style="margin:0 0 8px;color:#6ee7f9;font:700 11px/1.3 var(--num);letter-spacing:.16em">SAVE CONFLICT RECOVERY</p>
      <h2 id="timelineSyncConflictTitle" style="margin:0 0 12px;font-size:24px">Choose which Timeline to continue with.</h2>
      <p style="margin:0 0 12px;line-height:1.55;color:#cbd5e1">A newer version is saved on the server, and this copy has unsynced changes. Both copies will be preserved in History.</p>
      <p data-conflict-status role="status" aria-live="polite" style="min-height:22px;margin:0 0 18px;color:#fbbf24"></p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button type="button" class="btnD go" data-conflict-strategy="KEEP_LOCAL">KEEP THIS COPY &amp; SYNC</button>
        <button type="button" class="btnD alt" data-conflict-strategy="USE_SERVER">USE LATEST SAVED COPY</button>
        <button type="button" class="btnD alt" data-conflict-cancel>CANCEL</button>
      </div>
    </div>`;
    attachSelectedSubjectDialog022(dialog,{runtime:productionRuntime,document:store.document});
    const status=dialog.querySelector("[data-conflict-status]");
    const buttons=[...dialog.querySelectorAll("button")];
    dialog.querySelector("[data-conflict-cancel]").onclick=closeSyncConflictDialog;
    dialog.querySelectorAll("[data-conflict-strategy]").forEach((button)=>{
      button.onclick=async()=>{
        buttons.forEach((item)=>{item.disabled=true;});
        status.textContent="Preserving both copies and completing recovery…";
        try{
          const result=await store.adapter.resolveConflict(
            store.document.id,
            button.dataset.conflictStrategy
          );
          if(Number(result?.pending||0)>0){
            throw new Error("Timeline recovery is still syncing. Please try again.");
          }
          status.textContent="Recovery complete. Reloading the saved Timeline…";
          window.location.reload();
        }catch(error){
          status.textContent=studentMessage(error,{context:"save"});
          status.dataset.diagnostic=studentDiagnostic(error);
          buttons.forEach((item)=>{item.disabled=false;});
        }
      };
    });
    document.body.append(dialog);
    syncConflictDialog=dialog;
    if(typeof dialog.showModal==="function")dialog.showModal();
    else dialog.setAttribute("open","");
    dialog.querySelector("[data-conflict-strategy]")?.focus();
  };
  reflectStoreStatus=()=>{
    const save=document.getElementById("hudSave");
    if(!save)return;
    // Claim the badge so the legacy shell stops repainting over the real sync state.
    save.dataset.d1407fOwned="1";
    const status=store.saveStatus;
    const remoteState=String(remoteSyncStatus?.syncState||remoteSyncStatus?.state||"");
    const remotePresentation=remoteSyncPresentation(remoteState);
    if(status==="error"){
      save.textContent="COULDN’T SAVE — RETRY";
      save.className="saveState isError";
    }else if(status==="saving"){
      save.textContent="SAVING…";
      save.className="saveState isSaving";
    }else if(productionRuntime&&remotePresentation){
      save.textContent=remotePresentation.text;
      save.className=`saveState ${remotePresentation.className}`;
    }else{
      save.textContent="SAVED JUST NOW";
      save.className="saveState isSaved";
    }
    const recoverable=productionRuntime&&remoteState==="CONFLICT"&&
      typeof store.adapter?.resolveConflict==="function";
    save.onclick=recoverable?()=>{openSyncConflictRecovery().catch(()=>{});}:null;
    save.onkeydown=recoverable?(event)=>{
      if(event.key==="Enter"||event.key===" "){
        event.preventDefault();
        openSyncConflictRecovery().catch(()=>{});
      }
    }:null;
    if(recoverable){
      save.setAttribute("role","button");
      save.setAttribute("tabindex","0");
      save.setAttribute("aria-label","Review and resolve Timeline save conflict");
      save.title="Review and resolve the Timeline save conflict";
    }else{
      save.setAttribute("role","status");
      save.removeAttribute("tabindex");
      save.setAttribute("aria-label",save.textContent);
      save.removeAttribute("title");
    }
    if(bridge.state.view==="command")renderHomeCompletionStatus();
  };
  let lastStoreRenderSignature=timelineRenderSignature(store.document);
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
    cancelInvalidAdvancedSessions();
    const renderSignature=timelineRenderSignature(store.document);
    const documentPresentationChanged=renderSignature!==lastStoreRenderSignature;
    if(documentPresentationChanged){
      lastStoreRenderSignature=renderSignature;
      queueBuilderEmbeddedPreview();
      if(bridge.state.view==="canvas")canvasController?.render();
    }
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
    const syncCanvasDocument=(canvasState)=>{
      if(canvasSyncing)return;
      canvasSyncing=true;
      // Canvas-only UI state (selection, panels, zoom and transient gestures)
      // must not ask the legacy bridge to rebuild the active route. Canonical
      // document mutations already synchronize through their owning hooks and
      // the store subscription below.
      reflectStoreStatus();
      queueMicrotask(()=>api.dateControls.install(canvasHost));
      canvasSyncing=false;
    };
    canvasController=installCanvas(canvasHost,store,{
      state:{
        ...createCanvasState({
          viewportWidth:window.innerWidth,
          mode:store.document.mode,
          zoom:store.document.preferences?.canvasZoom||"fit"
        }),
        entitlementEditable:store.entitlement.canMutate===true
      },
      renderBoard:renderResponsiveAdvancedBoard,
      renderTheme:(document)=>renderThemePicker(document),
      renderAdvanced:(document,options)=>renderAdvancedStudio(document,{
        ...options,
        themeSwatches:THEMES_BY_ID[document.theme],
        resolveObjectUrl:(id)=>mediaUrls.get(id)
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
      onAdvancedTextCommit:(id,text)=>{
        const result=applySceneCommandToDocument(store.document,{
          kind:"text",
          target:{type:"text",id},
          text,
          label:"Edit Advanced text"
        });
        if(!result.changed)return false;
        store.replace(result.document,{label:"Edit Advanced text"});
        syncBridgeStateFromStore();
        canvasController?.setUiState({advancedSelection:{type:"text",id}});
        return true;
      },
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
        syncBridgeStateFromStore();
        bridge.toast("Theme applied");
      },
      onDropReflow:syncCanvasDocument,
      onToast:(message)=>bridge.toast(studentMessage(message,{context:"layout"}))
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
        if(isImportedBuilderEvent022(selectedBefore)){
          const values={keys:{},fields:{},dates:{}};
          for(const input of form.querySelectorAll("[data-canvas-detail-key]"))values.keys[input.dataset.canvasDetailKey]=input.value;
          for(const input of form.querySelectorAll("[data-canvas-detail-field]"))values.fields[input.dataset.canvasDetailField]=input.type==="checkbox"?input.checked:input.value;
          for(const input of form.querySelectorAll("[data-canvas-imported-date]"))values.dates[input.dataset.canvasImportedDate]=input.value;
          values.exportAudiences=Array.from(form.querySelectorAll("[data-canvas-export-audience]:checked"),input=>input.dataset.canvasExportAudience);
          const result=updateImportedCanvasDetails022(selectedBefore,values);
          if(!result.ok){
            const message=form.querySelector("[data-canvas-imported-error]");
            if(message)message.textContent=Object.values(result.errors).join(" ");
            const key=Object.keys(result.errors)[0];
            form.querySelector(`[data-canvas-imported-date="${key}"],[data-canvas-detail-key="${key}"]`)?.focus();
            return;
          }
          store.mutate("Edit imported Timeline details",document=>{
            const index=document.events.findIndex(item=>String(item.id)===String(eventId));
            if(index<0)return;
            document.events[index]=result.event;
            const active=activeSpecialtyVariant(document);
            const visible=form.querySelector("[data-canvas-variant-visible]")?.checked!==false;
            setVariantEventHidden(document,active.id,eventId,!visible);
          });
          syncBridgeStateFromStore();
          canvasController.render({animateLayout:true});
          bridge.toast("Event details saved");
          return;
        }
        if(isExplanationEvent(selectedBefore)){
          const changes={};
          for(const input of form.querySelectorAll("[data-canvas-detail-field]")){
            const field=input.dataset.canvasDetailField;
            changes[field==="explanationText"?"text":field]=input.type==="checkbox"?input.checked:input.value;
          }
          const draft=structuredClone(store.document);
          const result=updateExplanation(draft,eventId,changes);
          if(!result.ok){
            bridge.toast(result.code==="EXPLANATION_TEXT_TOO_LONG"
              ?`Keep your explanation to ${EXPLANATION_TEXT_MAX} characters or fewer.`
              :"Enter a short explanation before saving.");
            form.querySelector('[data-canvas-detail-field="explanationText"]')?.focus();
            return;
          }
          store.replace(draft,{label:"Edit explanation details"});
          syncBridgeStateFromStore();
          canvasController.render({animateLayout:true});
          bridge.toast("Explanation saved");
          return;
        }
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
        syncBridgeStateFromStore();
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
        if(step===7&&eventId){
          focusBuilderPreviewOwner({
            kind:"explanation",
            ownerId:eventId,
            eventId,
            step:7,
            stepId:"review"
          });
        }
      }
    };
    onAdvancedObjectClick=(event)=>{
      if(store.document.mode==="advanced"){
        const object=advancedObjectForTarget(event.target);
        if(object?.type==="event"){
          event.preventDefault();
          commitAdvancedSelection({type:"event",id:object.id});
          restoreAdvancedObjectFocus("event",object.id);
          return;
        }
      }
      const media=event.target.closest?.("[data-advanced-media]");
      const text=event.target.closest?.("[data-advanced-text]");
      const element=event.target.closest?.("[data-advanced-element]");
      const colorKey=event.target.closest?.('[data-artifact-chrome="color-key"]');
      const profile=event.target.closest?.('[data-artifact-chrome="profile"]');
      const axis=event.target.closest?.('[data-layer="axis"]');
      const headline=event.target.closest?.(
        "[data-board-headline],[data-artifact-chrome='title']"
      );
      const selection=media
        ?{type:"media",id:media.dataset.advancedMedia}
        :text
          ?{type:"text",id:text.dataset.advancedText}
          :element
            ?{type:"element",id:element.dataset.advancedElement}
          :colorKey
            ?{type:"color-key",id:"color-key"}
          :profile
            ?{type:"profile",id:"profile"}
          :axis
            ?{type:"axis",id:"axis"}
          :headline
            ?{type:"headline",id:"headline"}
            :null;
      if(selection){
        const collection=selection.type==="media"
          ?store.document.advanced?.media
          :selection.type==="text"
            ?store.document.advanced?.textBlocks
            :selection.type==="element"
              ?store.document.advanced?.elements
              :null;
        const selectedItem=(collection||[]).find(
          (item)=>String(item.id)===String(selection.id)
        );
        const effectiveSelection=selectedItem?.groupId&&Number(event.detail)<2
          ?{type:"group",id:String(selectedItem.groupId)}
          :selection;
        if(selection.type==="text"&&Number(event.detail)>=2){
          const block=(store.document.advanced?.textBlocks||[]).find(
            (item)=>String(item.id)===String(selection.id)
          );
          canvasController?.setUiState({
            advancedSelection:selection,
            advancedTextEdit:{id:selection.id,draft:String(block?.text||"")}
          });
          queueMicrotask(()=>{
            const field=canvasHost.querySelector("[data-advanced-inline-text-input]");
            field?.focus?.();
            field?.select?.();
          });
        }else if(event.shiftKey||event.metaKey||event.ctrlKey){
          const nextSelection=toggleAdvancedSelection(canvasController?.state?.advancedSelection,effectiveSelection,true);
          canvasController?.setUiState({
            advancedSelection:nextSelection,
            advancedTextEdit:null
          });
          /* AAA-019 — a multi-selection must draw its chrome too; clearing here left the
             panel saying "2 objects selected" while the board showed nothing. */
          showAdvancedDirectSelection(nextSelection);
        }else{
          canvasController?.setUiState({advancedSelection:effectiveSelection,advancedTextEdit:null});
          showAdvancedDirectSelection(effectiveSelection);
        }
      }
    };
    let advancedPointer=null;
    let axisPointer=null;
    let railPointer=null;
    let marqueePointer=null;
    let layoutLockExplainedAt=0;
    const explainLayoutLock=()=>{
      const now=Date.now();
      if(now-layoutLockExplainedAt<4000)return;
      layoutLockExplainedAt=now;
      const message="Layout lock is on — turn it off (top of the side panel) to move, resize, or edit objects.";
      bridge.toast?.(message);
      announceGlobal?.(message);
      const control=canvasHost?.querySelector?.("[data-advanced-layout-lock-control]");
      if(control){
        control.dataset.advancedLockNudge="true";
        setTimeout(()=>{delete control.dataset.advancedLockNudge;},1200);
      }
    };
    let advancedCrop=null;
    /* event.detail is not a dependable double-press signal on this surface: the board
       is driven by a pure pointer stream, and some environments deliver every
       pointerdown with detail 0 and never synthesise mousedown/click/dblclick at all.
       Track the second press ourselves from time and distance, which holds for any
       pointer source. Resetting on a match stops a third press chaining into a fourth. */
    let lastAdvancedPress={time:0,x:0,y:0};
    const consumeDoublePress=(event)=>{
      const now=Number(event.timeStamp)||performance.now();
      const isDouble=
        now-lastAdvancedPress.time<450&&
        Math.hypot(event.clientX-lastAdvancedPress.x,event.clientY-lastAdvancedPress.y)<6;
      lastAdvancedPress=isDouble?{time:0,x:0,y:0}:{time:now,x:event.clientX,y:event.clientY};
      return isDouble;
    };
    let nativeRailDrag=null;
    const advancedEditIframe=()=>canvasHost
      ?.querySelector?.('d1-timeline-kernel[data-surface="edit"]')
      ?.shadowRoot
      ?.querySelector?.("iframe");
    const advancedEditSurface=()=>advancedEditIframe()||canvasHost
      ?.querySelector?.('.canvas-screen svg[data-founder-serializer]');
    const sceneVisualNode=(node)=>node?.closest?.("[data-scene-object]")||node;
    const advancedGroupMembers=(groupId)=>{
      const group=(store.document.advanced?.groups||[]).find(
        (candidate)=>String(candidate.id)===String(groupId)
      );
      if(!group)return[];
      const references=(group.children||group.childIds||[]).map((entry)=>{
        if(entry&&typeof entry==="object")return{
          type:String(entry.type||""),id:String(entry.id||"")
        };
        const value=String(entry||"");
        const separator=value.indexOf(":");
        return separator>=0
          ?{type:value.slice(0,separator),id:value.slice(separator+1)}
          :{type:"",id:value};
      });
      const collections=[
        ["media",store.document.advanced?.media||[],"advancedMedia"],
        ["text",store.document.advanced?.textBlocks||[],"advancedText"],
        ["element",store.document.advanced?.elements||[],"advancedElement"]
      ];
      return references.flatMap(({type:expectedType,id})=>collections.flatMap(([type,items,dataset])=>{
        if(expectedType&&expectedType!==type)return[];
        const item=items.find((candidate)=>String(candidate.id)===String(id));
        const raw=item?canvasHost.querySelector(
          `[data-${dataset.replace(/[A-Z]/g,(match)=>`-${match.toLowerCase()}`)}="${globalThis.CSS?.escape?CSS.escape(id):id}"]`
        ):null;
        return item&&raw?[{type,id:String(id),item,element:sceneVisualNode(raw)}]:[];
      }));
    };
    const advancedGroupObject=(groupId)=>{
      const group=(store.document.advanced?.groups||[]).find(
        (candidate)=>String(candidate.id)===String(groupId)
      );
      const members=advancedGroupMembers(groupId);
      if(!group||members.length<2)return null;
      const left=Math.min(...members.map(({item})=>Number(item.x)||0));
      const top=Math.min(...members.map(({item})=>Number(item.y)||0));
      const right=Math.max(...members.map(({item})=>(Number(item.x)||0)+(Number(item.width)||1)));
      const bottom=Math.max(...members.map(({item})=>(Number(item.y)||0)+(Number(item.height)||1)));
      const domBounds=members.map(({element})=>element.getBoundingClientRect?.()).filter(
        (box)=>box?.width&&box?.height
      );
      const bounds=domBounds.length?{
        left:Math.min(...domBounds.map((box)=>box.left)),
        top:Math.min(...domBounds.map((box)=>box.top)),
        right:Math.max(...domBounds.map((box)=>box.right)),
        bottom:Math.max(...domBounds.map((box)=>box.bottom))
      }:null;
      if(bounds){bounds.width=bounds.right-bounds.left;bounds.height=bounds.bottom-bounds.top;}
      return{
        type:"group",id:String(groupId),members,bounds,
        item:{...group,x:left,y:top,width:right-left,height:bottom-top},
        element:members[0].element
      };
    };
    const clearAdvancedAxisBoundaryHandles=()=>document.querySelectorAll?.(
      "[data-advanced-axis-boundary-handle]"
    ).forEach((node)=>node.remove());
    const showAdvancedAxisBoundaryHandles=()=>queueMicrotask(()=>{
      clearAdvancedAxisBoundaryHandles();
      const surface=advancedEditSurface();
      const segments=[...(surface?.querySelectorAll?.("[data-axis-segment-id]")||[])];
      if(segments.length<2)return;
      segments.slice(0,-1).forEach((segment,index)=>{
        const next=segments[index+1];
        const box=segment.getBoundingClientRect?.();
        const nextBox=next.getBoundingClientRect?.();
        if(!box?.width||!nextBox?.width)return;
        const handle=document.createElement("button");
        handle.type="button";
        handle.className="advancedAxisBoundaryHandle";
        handle.dataset.advancedAxisBoundaryHandle=String(index);
        handle.dataset.axisLeftId=String(segment.dataset.axisSegmentId||"");
        handle.dataset.axisRightId=String(next.dataset.axisSegmentId||"");
        handle.setAttribute("aria-label",`Resize ${handle.dataset.axisLeftId} and ${handle.dataset.axisRightId}`);
        handle.style.left=`${(box.right+nextBox.left)/2-7}px`;
        handle.style.top=`${Math.min(box.top,nextBox.top)-5}px`;
        handle.style.height=`${Math.max(box.bottom,nextBox.bottom)-Math.min(box.top,nextBox.top)+10}px`;
        document.body.append(handle);
      });
    });
    /* Selection chrome used to be fixed-positioned on document.body. That made it a
       document-space overlay over a board that scrolls and zooms: it did not move when
       the stage panned, and it painted over the asset rail and the inspector because
       nothing clipped it. Mounting it inside .canvas-stage instead puts it in board
       space — it scrolls with the content for free, and the stage's own overflow clips
       it — which is the "overlay in board space, not fixed document space" the audit
       asked for. Coordinates are relative to the stage's scrollable content, so the
       scroll offset has to be added back in. */
    const advancedOverlayHost=()=>canvasHost?.querySelector?.(".canvas-stage")||null;
    const mountAdvancedOverlay=(node,bounds)=>{
      const host=advancedOverlayHost();
      if(!host||!bounds)return false;
      const view=host.getBoundingClientRect();
      node.style.left=`${bounds.left-view.left+host.scrollLeft}px`;
      node.style.top=`${bounds.top-view.top+host.scrollTop}px`;
      node.style.width=`${bounds.width}px`;
      node.style.height=`${bounds.height}px`;
      host.append(node);
      return true;
    };

    const advancedMemberElement=(member)=>{
      const id=String(member?.id||"");
      if(!id)return null;
      const escaped=globalThis.CSS?.escape?CSS.escape(id):id;
      return sceneVisualNode(canvasHost?.querySelector?.(
        member.type==="media"?`[data-advanced-media="${escaped}"]`:
        member.type==="text"?`[data-advanced-text="${escaped}"]`:
        member.type==="element"?`[data-advanced-element="${escaped}"]`:""
      ));
    };

    /* ===================== AAA-019 — quick-bar + context menu =====================
       Every selection gets a floating quick-bar (Canva S2) with the two or three verbs a
       student reaches for, and the same verbs are reachable from a right-click menu that
       prints its shortcuts (Canva X1). Both dispatch through the selection engine. */
    const advancedQuickActionsFor=(target,{frameState="empty"}={})=>{
      const lockedNow=selectionIsLocked(target);
      const lock={action:lockedNow?"unlock":"lock",label:lockedNow?"Unlock":"Lock",icon:lockedNow?"🔓":"🔒"};
      if(target.type==="frame"){
        return frameState==="filled"
          ?[{action:"frame-replace",label:"Replace",icon:"⇄"},{action:"crop",label:"Crop",icon:"⌗"},{action:"frame-remove",label:"Remove photo",icon:"✕"}]
          :[{action:"frame-choose",label:"Choose from uploads",icon:"▤"},{action:"frame-upload",label:"Upload photo",icon:"⇧"}];
      }
      if(target.type==="multi")return[{action:"group",label:"Group",icon:"⧉",keys:"⌘G"},{action:"duplicate",label:"Duplicate",icon:"⧉",keys:"⌘D"},{action:"delete",label:"Delete",icon:"🗑",keys:"⌫"}];
      const common=[{action:"duplicate",label:"Duplicate",icon:"⧉",keys:"⌘D"},{action:"delete",label:"Delete",icon:"🗑",keys:"⌫"},lock,{action:"more",label:"More",icon:"⋯"}];
      if(target.type==="media")return[{action:"crop",label:"Crop",icon:"⌗"},...common];
      if(target.type==="text")return[{action:"edit-text",label:"Edit text",icon:"✎",keys:"Enter"},...common];
      if(target.type==="group")return[{action:"ungroup",label:"Ungroup",icon:"⧈",keys:"⇧⌘G"},...common];
      if(["element"].includes(target.type))return common;
      return[];
    };
    const clearAdvancedQuickBar=()=>document.querySelectorAll?.("[data-advanced-quick-bar]").forEach((node)=>node.remove());
    const mountAdvancedQuickBar=(target,bounds,{frameState="empty"}={})=>{
      clearAdvancedQuickBar();
      if(store.entitlement.canMutate!==true||store.document.mode!=="advanced")return;
      const actions=advancedQuickActionsFor(target,{frameState});
      if(!actions.length)return;
      const host=advancedOverlayHost();
      if(!host)return;
      const bar=document.createElement("div");
      bar.className="advancedQuickBar";
      bar.dataset.advancedQuickBar="true";
      bar.dataset.advancedDirectSelection="true";
      bar.setAttribute("role","toolbar");
      bar.setAttribute("aria-label","Selected object actions");
      /* Frames and multi-selections carry short verb labels (few actions, unfamiliar
         verbs); every other object gets a compact icon bar with tooltips, so the bar
         never sprawls over neighbouring objects and steals their clicks. */
      const compact=!["frame","multi"].includes(target.type);
      bar.dataset.advancedQuickBarCompact=String(compact);
      bar.innerHTML=actions.map((item)=>`<button type="button" data-advanced-quick-action="${item.action}" data-advanced-target-type="${target.type}" data-advanced-target-id="${target.id||""}" title="${item.label}${item.keys?` (${item.keys})`:""}" aria-label="${item.label}"><span aria-hidden="true">${item.icon}</span>${compact?"":`<span class="advancedQuickBarLabel">${item.label}</span>`}</button>`).join("");
      const view=host.getBoundingClientRect();
      const barWidth=compact?actions.length*34+8:Math.min(420,Math.max(120,actions.length*118));
      const centred=bounds.left-view.left+host.scrollLeft+bounds.width/2-barWidth/2;
      const leftAligned=bounds.left-view.left+host.scrollLeft;
      const left=Math.max(4,Math.min(view.width-barWidth-4,barWidth>bounds.width+24?leftAligned:centred));
      const above=bounds.top-view.top-46;
      const top=above>=4?above+host.scrollTop:bounds.top-view.top+host.scrollTop+bounds.height+10;
      bar.style.left=`${left}px`;
      bar.style.top=`${top}px`;
      host.append(bar);
    };
    const runAdvancedQuickAction=(action,target,anchor=null)=>{
      const selection=canvasController?.state?.advancedSelection||target;
      switch(action){
        case"duplicate":return duplicateAdvancedSelection(selection);
        case"delete":return deleteAdvancedSelection(selection);
        case"lock":return lockAdvancedSelection(selection,true);
        case"unlock":return lockAdvancedSelection(selection,false);
        case"group":return groupAdvancedSelection(selection);
        case"ungroup":return ungroupAdvancedSelection(selection);
        case"bring-forward":case"send-backward":case"bring-to-front":case"send-to-back":return layerAdvancedSelection(selection,action);
        case"copy":return copyAdvancedSelection(selection);
        case"cut":return copyAdvancedSelection(selection)&&deleteAdvancedSelection(selection);
        case"paste":return pasteAdvancedClipboard();
        case"select-all":{const members=allAdvancedSelectableMembers();if(!members.length)return false;commitAdvancedSelection(members.length===1?members[0]:{type:"multi",members});return true;}
        case"edit-text":return beginAdvancedTextEdit(target);
        case"crop":return beginAdvancedCrop(target);
        case"frame-choose":armAdvancedFrameFill(target.id);return true;
        case"frame-upload":uploadIntoAdvancedFrame(target.id);return true;
        case"frame-replace":armAdvancedFrameFill(target.id);return true;
        case"frame-remove":return clearAdvancedFrame(target.id);
        case"layers":canvasController?.setUiState({advancedPanel:"layers"});return true;
        case"align-left":case"align-center":case"align-right":case"align-top":case"align-middle":case"align-bottom":
          return alignAdvancedSelection(selection,action.replace("align-",""));
        case"more":openAdvancedContextMenu({anchor,selection:target});return true;
        default:return false;
      }
    };
    const closeAdvancedContextMenu=()=>{
      const menu=document.querySelector("[data-advanced-context-menu]");
      if(!menu)return false;
      menu.remove();
      document.removeEventListener("pointerdown",onAdvancedContextMenuDismiss,true);
      return true;
    };
    const onAdvancedContextMenuDismiss=(event)=>{
      if(event.target.closest?.("[data-advanced-context-menu]"))return;
      closeAdvancedContextMenu();
    };
    const advancedContextMenuItems=(selection)=>{
      if(!selection)return[
        {action:"paste",label:"Paste",keys:"⌘V",disabled:!advancedClipboard.length},
        {action:"select-all",label:"Select all",keys:"⌘A"},
        {action:"layers",label:"Layers…"}
      ];
      const lockedNow=selectionIsLocked(selection);
      if(selection.type==="frame"){
        const filled=advancedFrameItem(store.document,selection.id);
        return filled
          ?[{action:"frame-replace",label:"Replace photo"},{action:"crop",label:"Crop"},{action:"frame-remove",label:"Remove photo",keys:"⌫"}]
          :[{action:"frame-choose",label:"Choose from uploads"},{action:"frame-upload",label:"Upload photo"}];
      }
      const items=[
        {action:"cut",label:"Cut",keys:"⌘X"},
        {action:"copy",label:"Copy",keys:"⌘C"},
        {action:"paste",label:"Paste",keys:"⌘V",disabled:!advancedClipboard.length},
        {action:"duplicate",label:"Duplicate",keys:"⌘D"},
        {action:"delete",label:"Delete",keys:"⌫"},
        {separator:true},
        {action:lockedNow?"unlock":"lock",label:lockedNow?"Unlock":"Lock",keys:"⇧⌘L"},
        selection.type==="multi"?{action:"group",label:"Group",keys:"⌘G"}:selection.type==="group"?{action:"ungroup",label:"Ungroup",keys:"⇧⌘G"}:null,
        {separator:true},
        {action:"bring-forward",label:"Bring forward",keys:"⌘]"},
        {action:"send-backward",label:"Send backward",keys:"⌘["},
        {action:"bring-to-front",label:"Bring to front",keys:"⌥⌘]"},
        {action:"send-to-back",label:"Send to back",keys:"⌥⌘["},
        {action:"layers",label:"Layers…"},
        {separator:true}
      ].filter(Boolean);
      if(selection.type==="media")items.push({action:"crop",label:"Crop"});
      if(selection.type==="text")items.push({action:"edit-text",label:"Edit text",keys:"Enter"});
      /* Canva's "Align to page" — one row of six, so the whole selection can be squared to
         the board without a nudge marathon. */
      items.push({separator:true},{alignRow:true,label:"Align to board",items:[
        {action:"align-left",label:"Left",icon:"⇤"},{action:"align-center",label:"Center",icon:"↔"},{action:"align-right",label:"Right",icon:"⇥"},
        {action:"align-top",label:"Top",icon:"⤒"},{action:"align-middle",label:"Middle",icon:"↕"},{action:"align-bottom",label:"Bottom",icon:"⤓"}
      ]});
      if(items.at(-1)?.separator)items.pop();
      return items;
    };
    /* Align the selection's combined box to the board; members keep their relative layout. */
    const alignAdvancedSelection=(selection,edge)=>{
      if(store.entitlement.canMutate!==true||store.document.layoutLock!==false)return false;
      const members=advancedLeafMembers(selection);
      if(!members.length||selectionIsLocked(selection))return false;
      const boxes=members.map((member)=>({member,item:advancedItemFor(member)})).filter(({item})=>item);
      if(!boxes.length)return false;
      const left=Math.min(...boxes.map(({item})=>Number(item.x)||0));
      const top=Math.min(...boxes.map(({item})=>Number(item.y)||0));
      const right=Math.max(...boxes.map(({item})=>(Number(item.x)||0)+(Number(item.width)||0)));
      const bottom=Math.max(...boxes.map(({item})=>(Number(item.y)||0)+(Number(item.height)||0)));
      const width=right-left,height=bottom-top;
      const dx=edge==="left"?-left:edge==="center"?960-(left+width/2):edge==="right"?1920-right:0;
      const dy=edge==="top"?-top:edge==="middle"?540-(top+height/2):edge==="bottom"?1080-bottom:0;
      if(!dx&&!dy)return false;
      let working=store.document,changed=false;
      const label=`Align to board ${edge}`;
      for(const {member,item} of boxes){
        const x=Math.max(0,Math.min(1920-(Number(item.width)||0),(Number(item.x)||0)+dx));
        const y=Math.max(0,Math.min(1080-(Number(item.height)||0),(Number(item.y)||0)+dy));
        const next=member.type==="media"?moveMediaElement(item,{x,y}):{...item,x,y};
        const result=applySceneCommandToDocument(working,{kind:"geometry",target:member,geometry:next,label});
        if(result.changed){working=result.document;changed=true;}
      }
      if(!changed)return false;
      store.replace(working,{label});
      commitAdvancedSelection(selection,{announce:`Aligned to board ${edge}`});
      return true;
    };
    const openAdvancedContextMenu=({x=null,y=null,anchor=null,selection=null}={})=>{
      closeAdvancedContextMenu();
      if(store.document.mode!=="advanced"||store.entitlement.canMutate!==true)return false;
      const items=advancedContextMenuItems(selection);
      const menu=document.createElement("div");
      menu.className="advancedContextMenu";
      menu.dataset.advancedContextMenu="true";
      menu.setAttribute("role","menu");
      const itemButton=(item,extra="")=>`<button type="button" role="menuitem" data-advanced-quick-action="${item.action}" data-advanced-target-type="${selection?.type||""}" data-advanced-target-id="${selection?.id||""}"${item.disabled?" disabled":""}${extra}><span>${item.label}</span>${item.keys?`<kbd>${item.keys}</kbd>`:""}</button>`;
      menu.innerHTML=items.map((item)=>item.separator
        ?'<hr role="separator">'
        :item.alignRow
          ?`<div class="advancedContextMenuAlign" role="group" aria-label="${item.label}"><span class="advancedContextMenuAlignLabel">${item.label}</span><div class="advancedContextMenuAlignRow">${item.items.map((entry)=>`<button type="button" role="menuitem" data-advanced-quick-action="${entry.action}" data-advanced-target-type="${selection?.type||""}" data-advanced-target-id="${selection?.id||""}" title="${entry.label}" aria-label="${item.label}: ${entry.label}"><span aria-hidden="true">${entry.icon}</span></button>`).join("")}</div></div>`
          :itemButton(item)
      ).join("");
      document.body.append(menu);
      let left=x,top=y;
      if(anchor?.getBoundingClientRect){const box=anchor.getBoundingClientRect();left=box.left;top=box.bottom+4;}
      const size=menu.getBoundingClientRect();
      left=Math.max(4,Math.min(window.innerWidth-size.width-4,Number(left)||0));
      top=Math.max(4,Math.min(window.innerHeight-size.height-4,Number(top)||0));
      menu.style.left=`${left}px`;
      menu.style.top=`${top}px`;
      queueMicrotask(()=>document.addEventListener("pointerdown",onAdvancedContextMenuDismiss,true));
      menu.querySelector("button:not([disabled])")?.focus?.({preventScroll:true});
      return true;
    };
    onAdvancedQuickActionClick=(event)=>{
      const button=event.target.closest?.("[data-advanced-quick-action]");
      if(!button)return;
      event.preventDefault();
      event.stopPropagation();
      const action=String(button.dataset.advancedQuickAction||"");
      const target=button.dataset.advancedTargetType?{type:String(button.dataset.advancedTargetType),id:String(button.dataset.advancedTargetId||"")}:null;
      const inMenu=!!button.closest("[data-advanced-context-menu]");
      if(inMenu)closeAdvancedContextMenu();
      runAdvancedQuickAction(action,target,button);
    };
    onAdvancedContextMenu=(event)=>{
      if(store.document.mode!=="advanced"||store.entitlement.canMutate!==true)return;
      if(event.target.closest?.("[data-advanced-inline-text-input], input, textarea, select"))return;
      /* Effective hit proxies (small objects, text at 100%) sit beside the board, not in
         it (red-team D4); they carry the object's data attributes, so they resolve below. */
      const surface=event.target.closest?.(".canvas-application, [data-advanced-direct-selection], [data-canvas-effective-hit-proxy]");
      if(!surface)return;
      event.preventDefault();
      const object=advancedObjectForTarget(event.target);
      let selection=canvasController?.state?.advancedSelection||null;
      if(object&&!["event","color-key","profile","axis"].includes(object.type)){
        const key=`${object.type}:${object.id}`;
        const already=selection?.type==="multi"
          ?(selection.members||[]).some((member)=>`${member.type}:${member.id}`===key)
          :selection&&`${selection.type}:${selection.id}`===key;
        if(!already){
          selection={type:object.type,id:String(object.id)};
          canvasController?.setUiState({selectedEventId:null,advancedSelection:selection,advancedTextEdit:null});
          requestAdvancedDirectSelection(selection);
        }
      }else if(!object){
        selection=null;
      }else{
        return;
      }
      openAdvancedContextMenu({x:event.clientX,y:event.clientY,selection});
    };
    const clearAdvancedDirectSelection=()=>{
      document.querySelectorAll?.("[data-advanced-direct-selection]").forEach((node)=>node.remove());
      clearAdvancedAxisBoundaryHandles();
    };
    const clearAdvancedHoverChrome=()=>document.querySelectorAll?.("[data-advanced-hover]").forEach((node)=>node.remove());
    const showAdvancedDirectSelection=(target)=>queueMicrotask(()=>{
      const retainedRotationFocus=document.activeElement?.matches?.('[data-advanced-direct-handle="rotate"]');
      clearAdvancedDirectSelection();
      if(!target||target.type==="headline")return;
      if(advancedCrop)return;
      if(target.type==="axis"){
        showAdvancedAxisBoundaryHandles();
        return;
      }
      /* A1.4 — multi-selection used to return here and draw nothing, so shift-clicking
         a second object changed state with no board feedback at all: the only evidence
         was a line of panel text. Draw every member and the combined bounds, so what
         will move, group, or delete is never ambiguous. No resize handles: resizing a
         multi-selection is not a supported command, and drawing handles would promise
         a gesture that does nothing. */
      if(target.type==="multi"){
        const members=(Array.isArray(target.members)?target.members:[])
          .map((member)=>({member,element:advancedMemberElement(member)}))
          .filter(({element})=>element);
        const boxes=members
          .map(({element})=>element.getBoundingClientRect?.())
          .filter((box)=>box?.width&&box?.height);
        if(boxes.length<2)return;
        members.forEach(({member,element})=>{
          const box=element.getBoundingClientRect?.();
          if(!box?.width||!box?.height)return;
          const outline=document.createElement("div");
          outline.className="advancedDirectSelectionMember";
          outline.dataset.advancedDirectSelection="true";
          outline.dataset.advancedTargetType=String(member.type||"");
          outline.dataset.advancedTargetId=String(member.id||"");
          mountAdvancedOverlay(outline,box);
        });
        const combined=document.createElement("div");
        combined.className="advancedDirectSelection advancedDirectSelectionMulti";
        combined.dataset.advancedDirectSelection="true";
        combined.dataset.advancedTargetType="multi";
        combined.dataset.advancedMultiCount=String(members.length);
        const left=Math.min(...boxes.map((box)=>box.left));
        const top=Math.min(...boxes.map((box)=>box.top));
        const combinedBounds={
          left,top,
          width:Math.max(...boxes.map((box)=>box.right))-left,
          height:Math.max(...boxes.map((box)=>box.bottom))-top
        };
        const count=document.createElement("span");
        count.className="advancedDirectSelectionCount";
        count.textContent=`${members.length} selected`;
        combined.append(count);
        mountAdvancedOverlay(combined,combinedBounds);
        mountAdvancedQuickBar(target,combinedBounds,{});
        return;
      }
      const escaped=globalThis.CSS?.escape?CSS.escape(target.id):target.id;
      const groupMembers=target.type==="group"?advancedGroupMembers(target.id):[];
      const rawSource=target.type==="group"?groupMembers[0]?.element:target.type==="frame"?advancedFrameNode(target.id):canvasHost?.querySelector?.(
        target.type==="media"?`[data-advanced-media="${escaped}"]`:
        target.type==="text"?`[data-advanced-text="${escaped}"]`:
        target.type==="element"?`[data-advanced-element="${escaped}"]`:
        target.type==="event"?advancedEventSelector(target.id):
        target.type==="color-key"?'[data-artifact-chrome="color-key"]':
        target.type==="profile"?'[data-artifact-chrome="profile"]':""
      );
      const source=target.type==="event"
        ?rawSource?.querySelector?.("[data-continuous-duration-arrow],image")||rawSource
        :sceneVisualNode(rawSource);
      const memberBounds=groupMembers.map(({element})=>element.getBoundingClientRect?.()).filter(
        (box)=>box?.width&&box?.height
      );
      let bounds=memberBounds.length?{
        left:Math.min(...memberBounds.map((box)=>box.left)),
        top:Math.min(...memberBounds.map((box)=>box.top)),
        right:Math.max(...memberBounds.map((box)=>box.right)),
        bottom:Math.max(...memberBounds.map((box)=>box.bottom))
      }:target.type==="frame"?advancedFrameScreenBounds022(rawSource)||source?.getBoundingClientRect?.():source?.getBoundingClientRect?.();
      if(bounds&&!Object.hasOwn(bounds,"width")){
        bounds.width=bounds.right-bounds.left;
        bounds.height=bounds.bottom-bounds.top;
      }
      /* AAA-019 — a line or a hairline arrow has a near-zero box; give thin objects a
         minimum visible chrome (Canva's 12px grab corridor) instead of drawing nothing. */
      if(bounds&&(bounds.width>0||bounds.height>0)){
        const minimum=14;
        const padX=Math.max(0,(minimum-bounds.width)/2),padY=Math.max(0,(minimum-bounds.height)/2);
        if(padX||padY)bounds={
          left:bounds.left-padX,top:bounds.top-padY,
          width:bounds.width+padX*2,height:bounds.height+padY*2,
          right:bounds.left+bounds.width+padX,bottom:bounds.top+bounds.height+padY
        };
      }
      if(!bounds?.width||!bounds?.height)return;
      const overlay=document.createElement("div");
      overlay.className="advancedDirectSelection";
      overlay.dataset.advancedDirectSelection="true";
      overlay.dataset.advancedTargetType=target.type;
      overlay.dataset.advancedTargetId=target.id;

      overlay.tabIndex=-1;
      const fixedFrame=target.type==="frame"&&!/^photo\d$/.test(String(target.id));
      if(target.type==="frame")overlay.dataset.advancedFrameState=String(rawSource?.dataset?.mediaState||"empty");
      overlay.innerHTML=fixedFrame?"":["nw","n","ne","e","se","s","sw","w"].map((handle)=>`<button type="button" aria-label="Resize ${handle}" data-advanced-direct-handle="${handle}" data-advanced-target-type="${target.type}" data-advanced-target-id="${target.id}"></button>`).join("");
      if(document.body.classList.contains("prototype021")&&(["media","text","element","event"].includes(target.type)||(target.type==="frame"&&!fixedFrame))){
        const rotate=document.createElement("button");
        rotate.type="button";
        rotate.dataset.advancedDirectHandle="rotate";
        rotate.dataset.advancedTargetType=target.type;
        rotate.dataset.advancedTargetId=target.id;
        rotate.setAttribute("aria-label","Rotate object. Drag, or use arrow keys. Shift snaps to 15 degrees.");
        rotate.title="Rotate · drag or use arrow keys · Shift for 15°";
        rotate.textContent="↻";
        overlay.append(rotate);
      }
      if(!mountAdvancedOverlay(overlay,bounds))return;
      if(retainedRotationFocus)overlay.querySelector('[data-advanced-direct-handle="rotate"]')?.focus?.({preventScroll:true});
      mountAdvancedQuickBar(target,bounds,{frameState:overlay.dataset.advancedFrameState});
      /* A1.3 — pointer selection must hand keyboard focus to the object's hit proxy.
         onAdvancedObjectKeyDown resolves its object from event.target and is bound to
         canvasHost, so without this the entire keyboard map (nudge, Shift-resize,
         Enter-to-edit) was unreachable after a click: activeElement stayed on <body>
         and every arrow key fell through to the page. */
      focusAdvancedSelectionTarget(target,groupMembers);
    });
    requestAdvancedDirectSelection=(target)=>showAdvancedDirectSelection(target);
    /* Focus belongs on the hit proxy inside canvasHost, never on the overlay itself:
       the overlay lives on document.body, outside the keydown listener's subtree.
       A live text editor or form control always keeps focus — a selection redraw must
       never yank the caret out from under someone who is typing. */
    const editableHasFocus=()=>{
      const active=document.activeElement;
      if(!active)return false;
      if(active.isContentEditable)return true;
      return ["INPUT","TEXTAREA","SELECT"].includes(active.tagName);
    };
    const focusAdvancedSelectionTarget=(target,members=[])=>{
      if(editableHasFocus())return;
      /* AAA-019 red-team D11 — a selection made from the Layers panel (or any sidebar
         control) keeps keyboard focus where the student is working; the row's own
         Alt+Arrow reorder keys must not be hijacked by the board's resize map. */
      if(document.activeElement?.closest?.(".advanced-editor-sidebar, [data-advanced-layer-row]"))return;
      /* An open inline text editor owns focus even between renders. */
      if(canvasController?.state?.advancedTextEdit){
        queueMicrotask(()=>{
          const field=canvasHost?.querySelector?.("[data-advanced-inline-text-input]");
          /* Focus that has moved to the editor's own Done/Cancel buttons (Tab) stays there. */
          if(document.activeElement?.closest?.("[data-advanced-inline-text-form]"))return;
          if(field&&document.activeElement!==field&&!editableHasFocus())field.focus({preventScroll:true});
        });
        return;
      }
      const focusTarget=target?.type==="group"
        ?members.find(({type,id})=>type&&id)||null
        :target;
      if(!focusTarget?.type||!focusTarget?.id)return;
      if(!["media","text","element"].includes(focusTarget.type))return;
      /* Pointer selection calls preventDefault to own the drag, which also suppresses
         the browser's native focus. Focus has to be restored deliberately — but the hit
         proxies are rebuilt during the render's animation frame, so a microtask here
         queries a DOM that does not contain them yet and silently finds nothing. Wait
         for the frame, and retry a couple of times for a render that lands late. */
      const proxyId=`canvas-hit-proxy-${focusTarget.id}`;
      let attempts=0;
      const applyFocus=()=>{
        if(editableHasFocus())return;
        if(document.activeElement?.matches?.('[data-advanced-direct-handle="rotate"]'))return;
        const node=document.getElementById(proxyId);
        if(node){
          node.focus({preventScroll:true});
          return;
        }
        /* AAA-019 — hit proxies exist only for objects smaller than 44px on screen. A
           large object (most of them at 100%+) never had a proxy, so focus stayed on
           <body> and the whole keyboard map was dead for exactly the objects a student
           touches most. Focus the object's own SVG node instead: it lives inside
           canvasHost, so the per-object keydown handler resolves it like any proxy. */
        const source=advancedMemberElement(focusTarget);
        if(source&&source.isConnected){
          if(!source.hasAttribute("tabindex"))source.setAttribute("tabindex","-1");
          source.focus?.({preventScroll:true});
          return;
        }
        if(attempts++<3)requestAnimationFrame(applyFocus);
      };
      /* Try immediately — the node usually exists already — then retry across frames
         for a render that lands late. */
      applyFocus();
      if(!(document.activeElement&&document.activeElement!==document.body&&canvasHost?.contains?.(document.activeElement))){
        requestAnimationFrame(applyFocus);
      }
    };

    /* Keyboard commands share the scene commands the inspector buttons use, so a
       shortcut and a button press are the same mutation and land in one undo step. */
    const keyboardObjectAction=(target,action)=>{
      if(store.entitlement.canMutate!==true)return false;
      const result=applyAdvancedObjectAction(store.document,target,action,{
        duplicateId:action==="duplicate"?uid(`advanced-${target?.type||"object"}`):""
      });
      if(!result.changed)return false;
      store.replace(result.document,{label:result.mutation.label});
      syncBridgeStateFromStore();
      canvasController?.setUiState({advancedSelection:result.selection});
      requestAdvancedDirectSelection(result.selection||null);
      const message=action==="duplicate"?"Timeline object duplicated":"Timeline object deleted";
      if(action==="duplicate")hydrateMissingAdvancedMedia();
      bridge.toast(message);
      announceGlobal(message);
      return true;
    };
    const allAdvancedSelectableMembers=()=>[
      ...(store.document.advanced?.media||[])
        .filter((item)=>item?.placed!==false)
        .map((item)=>({type:"media",id:String(item.id)})),
      ...(store.document.advanced?.textBlocks||[]).map((item)=>({type:"text",id:String(item.id)})),
      ...(store.document.advanced?.elements||[]).map((item)=>({type:"element",id:String(item.id)}))
    ];

    const clearAdvancedAlignmentGuides=(svg=null)=>{
      const scope=svg||canvasHost;
      scope?.querySelectorAll?.("[data-advanced-alignment-guides]")
        .forEach((node)=>node.remove());
    };
    /* Every other unlocked-or-locked object on the board is a snap peer for the dragged
       object (Canva's smart guides); the dragged object itself and its group members are not. */
    const advancedSnapPeers=(pointer)=>{
      const advanced=store.document.advanced||{};
      const excluded=new Set([`${pointer?.type}:${pointer?.id}`]);
      for(const member of pointer?.members||[])excluded.add(`${member?.type}:${member?.id}`);
      const groupId=pointer?.type==="group"
        ?String(pointer.id)
        :(pointer?.groupId||advancedItemFor({type:pointer?.type,id:pointer?.id})?.groupId||null);
      const rows=[
        ...(advanced.media||[]).filter((item)=>item.placed!==false).map((item)=>({type:"media",item})),
        ...(advanced.textBlocks||[]).map((item)=>({type:"text",item})),
        ...(advanced.elements||[]).map((item)=>({type:"element",item}))
      ];
      return rows
        .filter(({type,item})=>!excluded.has(`${type}:${item.id}`)&&!(groupId&&item.groupId===groupId))
        .map(({item})=>({x:Number(item.x)||0,y:Number(item.y)||0,width:Number(item.width)||0,height:Number(item.height)||0}))
        .filter((box)=>box.width>0&&box.height>0)
        .slice(0,80);
    };
    const showAdvancedAlignmentGuides=(svg,guides={})=>{
      clearAdvancedAlignmentGuides(svg);
      if(!svg||(!guides.vertical&&!guides.horizontal))return;
      const layer=document.createElementNS("http://www.w3.org/2000/svg","g");
      layer.dataset.advancedAlignmentGuides="true";
      layer.setAttribute("aria-hidden","true");
      if(guides.vertical){
        const line=document.createElementNS("http://www.w3.org/2000/svg","line");
        line.dataset.advancedAlignmentGuide="vertical";
        line.setAttribute("x1",String(guides.vertical.position));
        line.setAttribute("x2",String(guides.vertical.position));
        line.setAttribute("y1","0");
        line.setAttribute("y2","1080");
        layer.append(line);
      }
      if(guides.horizontal){
        const line=document.createElementNS("http://www.w3.org/2000/svg","line");
        line.dataset.advancedAlignmentGuide="horizontal";
        line.setAttribute("x1","0");
        line.setAttribute("x2","1920");
        line.setAttribute("y1",String(guides.horizontal.position));
        line.setAttribute("y2",String(guides.horizontal.position));
        layer.append(line);
      }
      svg.append(layer);
    };
    const advancedEventSelector=(id)=>{
      const escaped=globalThis.CSS?.escape?CSS.escape(String(id)):String(id);
      return `[data-event-kind][data-event-id="${escaped}"]:not([data-canvas-effective-hit-proxy])`;
    };
    const advancedSourceElement=(type,id,fallback)=>{
      if(!fallback?.hasAttribute?.("data-canvas-effective-hit-proxy"))return sceneVisualNode(fallback);
      const escape=(value)=>globalThis.CSS?.escape?CSS.escape(String(value)):String(value);
      const attribute=type==="event"?"data-event-id":type==="media"?"data-advanced-media":type==="text"?"data-advanced-text":"data-advanced-element";
      const selector=`[${attribute}="${escape(id)}"][data-canvas-effective-hit-source]`;
      const token=fallback.dataset.canvasEffectiveHitToken;
      const paired=token?canvasHost.querySelector(`${selector}[data-canvas-effective-hit-token="${escape(token)}"]`):null;
      // Tokens bind paint/button proxies to the exact SVG visual, not their expanded hit box.
      return sceneVisualNode(paired||canvasHost.querySelector(selector)||(type==="event"?null:fallback));
    };
    const eventPresentationItem=(id)=>{
      const object=(store.document.advanced?.scene?.objects||[]).find((candidate)=>
        candidate?.type==="event"&&(
          String(candidate.semanticRef||"")===String(id)||
          String(candidate.id||"")===String(id)
        )
      );
      return object?{
        ...clone(object.geometry),
        rotation:Number(object.geometry?.rotation)||0,
        locked:object.locked===true,
        aspectLocked:object.aspectLocked!==false
      }:null;
    };
    const advancedObjectForTarget=(target,{deep=false}={})=>{
      const directPresentationItem=(type)=>{
        const key=type==="color-key"?"colorKeyGeometry":"profileGeometry";
        const fallback=type==="color-key"
          ?{x:20,y:300,width:284,height:346}
          :{x:13,y:661,width:545,height:410};
        return{
          ...fallback,
          ...(store.document.presentationOverrides?.[key]||{}),
          rotation:0,locked:false,aspectLocked:true
        };
      };
      const directSource=(type,id)=>{
        const escaped=globalThis.CSS?.escape?CSS.escape(id):id;
        if(type==="frame")return advancedFrameNode(id);
        const source=canvasHost.querySelector(
          type==="media"?`[data-advanced-media="${escaped}"]`:
          type==="text"?`[data-advanced-text="${escaped}"]`:
          type==="element"?`[data-advanced-element="${escaped}"]`:
          type==="event"?advancedEventSelector(id):
          type==="color-key"?'[data-artifact-chrome="color-key"]':
          type==="profile"?'[data-artifact-chrome="profile"]':""
        );
        return sceneVisualNode(source);
      };
      const directItem=(type,id)=>{
        if(type==="frame")return advancedFrameGeometryItem(id,advancedFrameNode(id));
        if(type==="event")return eventPresentationItem(id)||{};
        if(type==="color-key"||type==="profile")return directPresentationItem(type);
        const collection=type==="media"
          ?store.document.advanced?.media
          :type==="text"
            ?store.document.advanced?.textBlocks
            :store.document.advanced?.elements;
        return(collection||[]).find((candidate)=>String(candidate.id)===id)||null;
      };
      const directHandle=target.closest?.("[data-advanced-direct-handle]");
      if(directHandle){
        const type=String(directHandle.dataset.advancedTargetType||"");
        const id=String(directHandle.dataset.advancedTargetId||"");
        if(type==="group"){
          const groupObject=advancedGroupObject(id);
          return groupObject?{
            ...groupObject,
            handle:String(directHandle.dataset.advancedDirectHandle||"")
          }:null;
        }
        const source=directSource(type,id);
        const item=directItem(type,id);
        return item&&source?{type,id,item,element:source,...(type==="frame"?{bounds:advancedFrameScreenBounds022(source)}:{}),handle:String(directHandle.dataset.advancedDirectHandle||"")}:null;
      }
      /* Frames are checked before the profile card that contains the portrait well. */
      const frameNode=target.closest?.("[data-frame-slot]");
      if(frameNode&&ADVANCED_FRAME_SLOTS[String(frameNode.dataset.frameSlot||"")]){
        const slot=String(frameNode.dataset.frameSlot);
        return{
          type:"frame",id:slot,item:advancedFrameGeometryItem(slot,frameNode),element:frameNode,bounds:advancedFrameScreenBounds022(frameNode),
          frameState:String(frameNode.dataset.mediaState||"empty"),
          fixed:!/^photo\d$/.test(slot)
        };
      }
      const media=target.closest?.("[data-advanced-media]");
      if(media){
        const id=String(media.dataset.advancedMedia||"");
        const item=(store.document.advanced?.media||[])
          .find((candidate)=>String(candidate.id)===id);
        if(item?.groupId&&!deep)return advancedGroupObject(item.groupId);
        return item?{
          type:"media",
          id,
          item,
          element:advancedSourceElement("media",id,media)
        }:null;
      }
      const text=target.closest?.("[data-advanced-text]");
      if(text){
        const id=String(text.dataset.advancedText||"");
        const item=(store.document.advanced?.textBlocks||[])
          .find((candidate)=>String(candidate.id)===id);
        if(item?.groupId&&!deep)return advancedGroupObject(item.groupId);
        return item?{
          type:"text",
          id,
          item,
          element:advancedSourceElement("text",id,text)
        }:null;
      }
      const element=target.closest?.("[data-advanced-element]");
      if(element){
        const id=String(element.dataset.advancedElement||"");
        const item=(store.document.advanced?.elements||[])
          .find((candidate)=>String(candidate.id)===id);
        if(item?.groupId&&!deep)return advancedGroupObject(item.groupId);
        return item?{
          type:"element",
          id,
          item,
          element:advancedSourceElement("element",id,element)
        }:null;
      }
      const eventNode=target.closest?.('[data-event-kind="arrow"][data-event-id],[data-event-kind="flag"][data-event-id]');
      if(eventNode){
        const id=String(eventNode.dataset.eventId||"");
        const element=advancedSourceElement("event",id,eventNode);
        if(!element||!store.document.events.some((item)=>String(item.id)===id))return null;
        return{type:"event",id,item:eventPresentationItem(id)||{},element};
      }
      const colorKey=target.closest?.('[data-artifact-chrome="color-key"]');
      if(colorKey)return{
        type:"color-key",id:"color-key",item:directPresentationItem("color-key"),
        element:colorKey
      };
      const profile=target.closest?.('[data-artifact-chrome="profile"]');
      if(profile)return{
        type:"profile",id:"profile",item:directPresentationItem("profile"),
        element:profile
      };
      return null;
    };
    const restoreAdvancedObjectFocus=(type,id)=>queueMicrotask(()=>{
      const escaped=globalThis.CSS?.escape?CSS.escape(id):id;
      canvasHost.querySelector(
        type==="event"
          ?`[data-canvas-effective-hit-proxy][data-event-id="${escaped}"]:not([data-canvas-effective-hit-exact]):not([data-drag-kind])`
          :type==="media"
          ?`[data-canvas-effective-hit-proxy][data-advanced-media="${escaped}"], [data-advanced-media="${escaped}"]`
          :type==="text"
            ?`[data-canvas-effective-hit-proxy][data-advanced-text="${escaped}"], [data-advanced-text="${escaped}"]`
            :`[data-canvas-effective-hit-proxy][data-advanced-element="${escaped}"], [data-advanced-element="${escaped}"]`
      )?.focus?.();
    });
    onAdvancedObjectKeyDown=(event)=>{
      const object=advancedObjectForTarget(event.target);
      if(!object||(object.type==="event"&&store.document.mode!=="advanced"))return;
      const key=String(event.key||"");
      /* AAA-019 — everything except Enter/Space is handled by the selection engine
         (onAdvancedSelectionKeyDown), which acts on the whole selection — groups and
         multi-selections included — rather than on whichever member holds focus. The
         canvas's own keyboard handler runs before this one on the same host and may
         already have called preventDefault for its guided-mode intents, so the engine
         is invoked directly here and marks the event so the document listener skips it. */
      if(key!=="Enter"&&key!==" "){
        onAdvancedSelectionKeyDown(event,{force:true});
        return;
      }
      if(key==="Enter"||key===" "){
        event.preventDefault();
        if(object.type==="event"){
          commitAdvancedSelection({type:"event",id:object.id},{announce:"Timeline event selected"});
          restoreAdvancedObjectFocus("event",object.id);
          return;
        }
        if(key==="Enter"&&object.type==="text"){
          canvasController?.setUiState({
            advancedSelection:{type:object.type,id:object.id},
            advancedTextEdit:{id:object.id,draft:String(object.item.text||"")}
          });
          queueMicrotask(()=>{
            const field=canvasHost.querySelector("[data-advanced-inline-text-input]");
            field?.focus?.();
            field?.select?.();
          });
          announceGlobal("Text editing opened");
        }else{
          canvasController?.setUiState({
            advancedSelection:{type:object.type,id:object.id}
          });
          announceGlobal(`${object.type==="media"?"Media":"Text"} selected`);
          restoreAdvancedObjectFocus(object.type,object.id);
        }
        return;
      }
      if(key==="Escape"){
        event.preventDefault();
        canvasController?.setUiState({advancedSelection:null,advancedTextEdit:null});
        clearAdvancedDirectSelection();
        return;
      }
      if(key==="Delete"||key==="Backspace"){
        event.preventDefault();
        if(selectionIsLocked({type:object.type,id:object.id})){explainLockedSelection("deleting");return;}
        keyboardObjectAction({type:object.type,id:object.id},"delete");
        return;
      }
      if((event.metaKey||event.ctrlKey)&&key.toLowerCase()==="d"){
        event.preventDefault();
        keyboardObjectAction({type:object.type,id:object.id},"duplicate");
        return;
      }
      if((event.metaKey||event.ctrlKey)&&key.toLowerCase()==="a"){
        /* Select the scene, not the page. Without this the browser selects the whole
           document and the board paints as selected text. */
        event.preventDefault();
        const members=allAdvancedSelectableMembers();
        if(members.length){
          canvasController?.setUiState({
            selectedEventId:null,
            advancedSelection:members.length===1?members[0]:{type:"multi",members}
          });
          requestAdvancedDirectSelection(members.length===1?members[0]:{type:"multi",members});
        }
        return;
      }
      if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(key))return;
      if(store.document.layoutLock!==false)return;
      event.preventDefault();
      /* Arrow nudges by a single board unit and Shift by ten, matching every mature
         editor; Alt is the resize modifier so the capability stays reachable. */
      const step=event.shiftKey?10:1;
      const delta={
        ArrowLeft:{x:-step,y:0},
        ArrowRight:{x:step,y:0},
        ArrowUp:{x:0,y:-step},
        ArrowDown:{x:0,y:step}
      }[key];
      const original=clone(object.item);
      let next;
      let label;
      if(event.altKey&&["media","element","text"].includes(object.type)){
        const width=Math.max(48,Number(original.width||1)+delta.x);
        const unlocked=original.aspectLocked===false;
        next=constrainAdvancedObjectToBoard(object.type==="media"
          ?resizeMediaElement(original,{width,height:Math.max(32,Number(original.height||1)+delta.y),shiftKey:unlocked})
          :{...original,width,height:unlocked?Math.max(32,Number(original.height||1)+delta.y):width/(Number(original.width||1)/Number(original.height||1))});
        label=`Resize ${object.type==="element"?"Timeline asset":object.type==="text"?"text":"Media asset"}`;
      }else{
        const width=Number(original.width||0);
        const height=Number(original.height||0);
        const x=Math.max(0,Math.min(1920-width,Number(original.x||0)+delta.x));
        const y=Math.max(0,Math.min(1080-height,Number(original.y||0)+delta.y));
        next=constrainAdvancedObjectToBoard(object.type==="media"
          ?moveMediaElement(original,{x,y})
          :{...original,x,y});
        label=`Move Advanced ${object.type}`;
      }
      const result=applySceneCommandToDocument(store.document,{
        kind:"geometry",
        target:{type:object.type,id:object.id},
        geometry:next,
        label
      });
      if(!result.changed)return;
      store.replace(result.document,{label});
      syncBridgeStateFromStore();
      canvasController?.setUiState({
        advancedSelection:{type:object.type,id:object.id}
      });
      const message=label.startsWith("Resize")
        ?"Media resized with keyboard"
        :`${object.type==="media"?"Media":"Text"} moved with keyboard`;
      bridge.toast(message);
      announceGlobal(message);
      restoreAdvancedObjectFocus(object.type,object.id);
    };
    /* The per-object handler above needs focus to sit on that object's hit proxy, and
       focus is fragile here: pointer selection calls preventDefault, and any later render
       can move focus elsewhere. Selection state, by contrast, is authoritative. This
       document-level handler is the fallback that makes the keyboard map survive focus
       loss. It never fires when a text editor or form control has focus, and never
       double-handles an event the focused-object handler already consumed. */
    /* Both hit proxies and selection chrome use the painted viewport geometry. Wait
       for the layout/ResizeObserver pass, then let the canvas queue refresh proxies
       in place and announce its settled geometry to the selection-chrome listener. */
    let viewportChangeFrame=0;
    onAdvancedViewportChange=()=>{
      /* A zoom change mid-gesture would commit against the old pointer→board mapping
         (red-team D12); abandoning the gesture is the only honest outcome. */
      if(advancedPointer?.moved)cancelAdvancedGesture();
      if(viewportChangeFrame)return;
      viewportChangeFrame=requestAnimationFrame(()=>{
        viewportChangeFrame=0;
        canvasController?.refreshEffectiveHitTargets?.();
      });
    };
    /* ===================== AAA-019 — selection engine ======================
       One selection-state-driven command layer for the keyboard map, the context
       menu, the quick-bar and the Layers panel. Every command below resolves its
       targets from `canvasController.state.advancedSelection`, never from focus,
       so it works for proxied and un-proxied objects, groups and multi-selections
       alike, and lands each command in exactly one undo step. */
    const advancedLeafMembers=(selection)=>{
      if(!selection)return[];
      if(selection.type==="multi")return(Array.isArray(selection.members)?selection.members:[])
        .flatMap((member)=>member?.type==="group"
          ?advancedGroupMembers(member.id).map(({type,id})=>({type,id}))
          :member?.type&&member?.id?[{type:member.type,id:String(member.id)}]:[]);
      if(selection.type==="group")return advancedGroupMembers(selection.id).map(({type,id})=>({type,id}));
      if(["media","text","element"].includes(selection.type)&&selection.id)return[{type:selection.type,id:String(selection.id)}];
      return[];
    };
    const advancedCommandTargets=(selection)=>{
      if(!selection)return[];
      if(selection.type==="multi")return(Array.isArray(selection.members)?selection.members:[])
        .filter((member)=>member?.type&&member?.id).map((member)=>({type:member.type,id:String(member.id)}));
      if(["media","text","element","group"].includes(selection.type)&&selection.id)return[{type:selection.type,id:String(selection.id)}];
      return[];
    };
    const advancedItemFor=(target)=>{
      if(target.type==="event"){
        const item=eventPresentationItem(target.id);
        if(item)return item;
        const source=canvasHost.querySelector(advancedEventSelector(target.id));
        const visual=source?.querySelector?.("[data-continuous-duration-arrow],image")||source;
        const box=visual?.getBBox?.();
        return box?.width>0&&box?.height>0
          ?{x:box.x,y:box.y,width:box.width,height:box.height,rotation:0,locked:false,aspectLocked:false}:null;
      }
      const collection=target.type==="media"?store.document.advanced?.media
        :target.type==="text"?store.document.advanced?.textBlocks
        :target.type==="element"?store.document.advanced?.elements:null;
      return(collection||[]).find((item)=>String(item.id)===String(target.id))||null;
    };
    const selectionIsLocked=(selection)=>{
      if(selection?.type==="event")return advancedItemFor(selection)?.locked===true;
      const targets=advancedCommandTargets(selection);
      return targets.some((target)=>target.type==="group"
        ?(store.document.advanced?.groups||[]).find((group)=>String(group.id)===target.id)?.locked===true
        :advancedItemFor(target)?.locked===true);
    };
    const commitAdvancedSelection=(selection,{announce="",toast=""}={})=>{
      syncBridgeStateFromStore();
      canvasController?.setUiState({selectedEventId:null,advancedSelection:selection||null,advancedTextEdit:null});
      requestAdvancedDirectSelection(selection||null);
      if(toast)bridge.toast(toast);
      if(announce)announceGlobal(announce);
    };
    /* Move (or Alt-resize) every leaf member of the selection by one delta in one undo step. */
    const nudgeAdvancedSelection=(selection,delta,{resize=false}={})=>{
      if(store.entitlement.canMutate!==true||store.document.layoutLock!==false)return false;
      const members=selection?.type==="event"&&selection.id?[{type:"event",id:String(selection.id)}]:advancedLeafMembers(selection);
      if(!members.length)return false;
      if(selectionIsLocked(selection))return explainLockedSelection(resize?"resizing":"moving");
      let working=store.document;
      let changed=false;
      const label=resize?"Resize Timeline object":"Move Timeline object";
      for(const member of members){
        const original=advancedItemFor(member);
        if(!original)continue;
        let next;
        if(resize){
          const width=Math.max(member.type==="event"?Math.min(48,original.width):48,Number(original.width||1)+delta.x);
          const minimumHeight=member.type==="event"?Math.min(32,original.height):32;
          const unlocked=original.aspectLocked===false;
          next=constrainAdvancedObjectToBoard(member.type==="media"
            ?resizeMediaElement(original,{width,height:Math.max(minimumHeight,Number(original.height||1)+delta.y),shiftKey:unlocked})
            :{...original,width,height:unlocked?Math.max(minimumHeight,Number(original.height||1)+delta.y):width/(Number(original.width||1)/Number(original.height||1))},{minimumSize:member.type==="event"?1:48});
        }else{
          const width=Number(original.width||0),height=Number(original.height||0);
          const x=Math.max(0,Math.min(1920-width,Number(original.x||0)+delta.x));
          const y=Math.max(0,Math.min(1080-height,Number(original.y||0)+delta.y));
          next=constrainAdvancedObjectToBoard(member.type==="media"?moveMediaElement(original,{x,y}):{...original,x,y},{minimumSize:member.type==="event"?1:48});
        }
        const result=applySceneCommandToDocument(working,{kind:"geometry",target:member,geometry:next,label,
          ...(member.type==="event"?{create:{type:"event",semanticRef:member.id,aspectLocked:false,presentation:{eventType:store.document.events.find(item=>String(item.id)===member.id)?.eventType||"duration"}}}:{})});
        if(result.changed){working=result.document;changed=true;}
      }
      if(!changed)return false;
      store.replace(working,{label});
      commitAdvancedSelection(selection,{announce:resize?"Resized with keyboard":"Moved with keyboard"});
      return true;
    };
    const layerAdvancedSelection=(selection,direction)=>{
      if(store.entitlement.canMutate!==true)return false;
      const targets=advancedCommandTargets(selection);
      if(!targets.length)return false;
      let working=store.document;
      let changed=false;
      /* Front/back over several objects must keep their relative order: apply in z order. */
      const ordered=[...targets].sort((left,right)=>{
        const zl=Number(advancedItemFor(left)?.zIndex??0),zr=Number(advancedItemFor(right)?.zIndex??0);
        return direction.startsWith("bring")?zl-zr:zr-zl;
      });
      for(const target of ordered){
        const result=applySceneCommandToDocument(working,{kind:"layer",target,direction,label:"Change Timeline layer"});
        if(result.changed){working=result.document;changed=true;}
      }
      if(!changed)return false;
      store.replace(working,{label:"Change Timeline layer"});
      const copy={"bring-forward":"Brought forward","send-backward":"Sent backward","bring-to-front":"Brought to front","send-to-back":"Sent to back"}[direction]||"Layer changed";
      commitAdvancedSelection(selection,{announce:copy,toast:copy});
      return true;
    };
    const duplicateAdvancedSelection=(selection)=>{
      if(store.entitlement.canMutate!==true)return false;
      const targets=advancedCommandTargets(selection);
      if(!targets.length)return false;
      let working=store.document;
      const created=[];
      for(const target of targets){
        try{
          const result=applyAdvancedObjectAction(working,target,"duplicate",{duplicateId:uid(`advanced-${target.type}`)});
          if(result.changed){working=result.document;if(result.selection)created.push(result.selection);}
        }catch(error){toastStudentError(error,"layout");}
      }
      if(!created.length)return false;
      store.replace(working,{label:created.length>1?"Duplicate Timeline objects":"Duplicate Timeline object"});
      const next=created.length===1?created[0]:{type:"multi",members:created};
      commitAdvancedSelection(next,{toast:created.length>1?`${created.length} objects duplicated`:"Timeline object duplicated",announce:"Duplicated"});
      hydrateMissingAdvancedMedia();
      return true;
    };
    const explainLockedSelection=(verb)=>{
      const message=`Unlock this Timeline object before ${verb} it.`;
      bridge.toast(message);
      announceGlobal(message);
      return false;
    };
    const deleteAdvancedSelection=(selection)=>{
      if(store.entitlement.canMutate!==true)return false;
      const targets=advancedCommandTargets(selection);
      if(!targets.length)return false;
      /* AAA-019 red-team D1 — a lock protects against every destructive verb, not only
         moves: Delete, Backspace, Cut and the menu all land here. */
      if(selectionIsLocked(selection))return explainLockedSelection("deleting");
      let working=store.document;
      let count=0;
      for(const target of targets){
        try{
          const result=applyAdvancedObjectAction(working,target,"delete");
          if(result.changed){working=result.document;count+=1;}
        }catch(error){toastStudentError(error,"layout");}
      }
      if(!count)return false;
      store.replace(working,{label:count>1?"Delete Timeline objects":"Delete Timeline object"});
      commitAdvancedSelection(null,{toast:count>1?`${count} objects deleted`:"Timeline object deleted",announce:"Deleted"});
      return true;
    };
    const groupAdvancedSelection=(selection)=>{
      if(selection?.type!=="multi")return false;
      const members=advancedCommandTargets(selection);
      if(members.length<2)return false;
      advancedHooks().onGroup(members);
      return true;
    };
    const ungroupAdvancedSelection=(selection)=>{
      if(selection?.type==="group"){advancedHooks().onObjectAction("ungroup",{type:"group",id:selection.id});return true;}
      if(selection?.type==="multi"){
        const groups=advancedCommandTargets(selection).filter((target)=>target.type==="group");
        if(!groups.length)return false;
        groups.forEach((group)=>advancedHooks().onObjectAction("ungroup",group));
        return true;
      }
      return false;
    };
    const lockAdvancedSelection=(selection,locked)=>{
      const targets=advancedCommandTargets(selection);
      if(!targets.length)return false;
      let working=store.document,changed=false;
      for(const target of targets){
        const result=applySceneCommandToDocument(working,{kind:"lock",target,value:locked===true,label:locked?"Lock Timeline object":"Unlock Timeline object"});
        if(result.changed){working=result.document;changed=true;}
      }
      if(!changed)return false;
      store.replace(working,{label:locked?"Lock Timeline object":"Unlock Timeline object"});
      commitAdvancedSelection(selection,{toast:locked?"Locked":"Unlocked",announce:locked?"Locked":"Unlocked"});
      return true;
    };
    /* Scene-internal clipboard: copy keeps the object data, paste re-creates it offset. */
    let advancedClipboard=[];
    const copyAdvancedSelection=(selection)=>{
      const members=advancedLeafMembers(selection).map((member)=>({type:member.type,item:clone(advancedItemFor(member))})).filter(({item})=>item);
      if(!members.length)return false;
      advancedClipboard=members;
      bridge.toast(`${members.length===1?"Object":`${members.length} objects`} copied`);
      return true;
    };
    const pasteAdvancedClipboard=()=>{
      if(!advancedClipboard.length||store.entitlement.canMutate!==true)return false;
      const created=[];
      store.mutate("Paste Timeline objects",(document)=>{
        document.advanced.media=document.advanced.media||[];
        document.advanced.textBlocks=document.advanced.textBlocks||[];
        document.advanced.elements=document.advanced.elements||[];
        const collectionFor={media:"media",text:"textBlocks",element:"elements"};
        const maxZ=Math.max(0,...[...document.advanced.media,...document.advanced.textBlocks,...document.advanced.elements].map((item)=>Number(item.zIndex)||0));
        advancedClipboard.forEach(({type,item},index)=>{
          const id=uid(`advanced-${type}`);
          const width=Number(item.width)||1,height=Number(item.height)||1;
          const pasted={...clone(item),id,groupId:null,locked:false,
            x:Math.max(0,Math.min(1920-width,Number(item.x||0)+16)),
            y:Math.max(0,Math.min(1080-height,Number(item.y||0)+16)),
            zIndex:maxZ+index+1,layerIndex:maxZ+index+1};
          if(type==="media")pasted.placed=true;
          document.advanced[collectionFor[type]].push(pasted);
          created.push({type,id});
        });
        document.advanced.scene=reconcileAdvancedScene(document.advanced,{revision:document.revision});
      });
      /* Duplicated media shares the source blob, so the pasted copy resolves to the same URL. */
      created.filter(({type})=>type==="media").forEach(({id},index)=>{
        const source=advancedClipboard.filter(({type})=>type==="media")[index]?.item;
        const url=source?mediaUrls.get(source.id):null;
        if(url&&!mediaUrls.get(id))fetch(url).then((response)=>response.blob()).then((blob)=>{mediaUrls.set(id,blob);canvasController?.render?.();}).catch(()=>{});
      });
      advancedClipboard=advancedClipboard.map((entry)=>({...entry,item:{...entry.item,x:Number(entry.item.x||0)+16,y:Number(entry.item.y||0)+16}}));
      commitAdvancedSelection(created.length===1?created[0]:{type:"multi",members:created},{toast:"Pasted",announce:"Pasted"});
      return true;
    };
    const beginAdvancedTextEdit=(target)=>{
      const block=(store.document.advanced?.textBlocks||[]).find((item)=>String(item.id)===String(target?.id));
      if(!block)return false;
      canvasController?.setUiState({advancedSelection:{type:"text",id:String(block.id)},advancedTextEdit:{id:String(block.id),draft:String(block.text||"")}});
      queueMicrotask(()=>{
        const field=canvasHost.querySelector("[data-advanced-inline-text-input]");
        field?.focus?.();
        field?.select?.();
      });
      announceGlobal("Text editing opened");
      return true;
    };
    /* Redraw the chrome from state after every board render. Skipped while a gesture is
       live, because the gesture owns the board until it commits. */
    const syncAdvancedSelectionChrome=()=>{
      if(advancedPointer||marqueePointer||railPointer||axisPointer)return;
      if(advancedCrop){clearAdvancedDirectSelection();renderAdvancedCropChrome();return;}
      const selection=canvasController?.state?.advancedSelection||null;
      if(!selection||store.document.mode!=="advanced"){
        clearAdvancedDirectSelection();
        return;
      }
      requestAdvancedDirectSelection(selection);
    };
    /* Hover outline (Canva S1): a light box follows the object under the pointer so a
       student always knows what a press will grab. Never drawn on the selected object,
       during a gesture, or in Guided mode. */
    let hoverFrame=0;
    const clearAdvancedHover=()=>document.querySelectorAll?.("[data-advanced-hover]").forEach((node)=>node.remove());
    onAdvancedHoverMove=(event)=>{
      if(hoverFrame)return;
      hoverFrame=requestAnimationFrame(()=>{
        hoverFrame=0;
        if(advancedPointer||marqueePointer||railPointer||axisPointer||advancedCrop||store.document.mode!=="advanced"){clearAdvancedHover();return;}
        const target=event.target?.closest?.(".canvas-application")?event.target:null;
        const object=target?advancedObjectForTarget(target):null;
        if(!object||["axis"].includes(object.type)){clearAdvancedHover();return;}
        const selection=canvasController?.state?.advancedSelection;
        const key=`${object.type}:${object.id}`;
        const selected=selection?.type==="multi"
          ?(selection.members||[]).some((member)=>`${member.type}:${member.id}`===key)
          :selection&&`${selection.type}:${selection.id}`===key;
        if(selected){clearAdvancedHover();return;}
        const node=object.type==="event"?object.element:object.bounds?null:object.element;
        const bounds=object.bounds||node?.getBoundingClientRect?.();
        if(!bounds?.width||!bounds?.height){clearAdvancedHover();return;}
        let hover=document.querySelector("[data-advanced-hover]");
        if(!hover){
          hover=document.createElement("div");
          hover.className="advancedDirectHover";
          hover.dataset.advancedHover="true";
        }
        hover.dataset.advancedTargetType=object.type;
        hover.dataset.advancedTargetId=String(object.id||"");
        mountAdvancedOverlay(hover,bounds);
      });
    };
    onAdvancedHoverLeave=()=>clearAdvancedHover();
    onAdvancedCanvasRendered=()=>{
      syncAdvancedSelectionChrome();
      /* A render during a rail drag re-syncs the SVG attributes and drops the drop-target
         highlight; put it back where the pointer last was. */
      if(railPointer?.payload?.action==="place"&&railPointer.payload.target?.type==="media"&&Number.isFinite(railPointer.lastX)){
        highlightAdvancedFrameDropTarget(advancedFrameAtPoint(railPointer.lastX,railPointer.lastY));
      }
    };
    onAdvancedSelectionKeyDown=(event,{force=false}={})=>{
      if(event.__advancedSelectionHandled)return;
      if(event.defaultPrevented&&!force)return;
      event.__advancedSelectionHandled=true;
      if(store.document.mode!=="advanced")return;
      if(editableHasFocus())return;
      if(bridge.state?.view&&bridge.state.view!=="canvas")return;
      const selection=canvasController?.state?.advancedSelection||null;
      const key=String(event.key||"");
      const meta=event.metaKey||event.ctrlKey;
      const lower=key.toLowerCase();
      /* AAA-019 red-team D2 — Enter/Space on the editor's own Done/Cancel buttons, or on any
         sidebar control, is that control's activation, never a board verb. */
      if((key==="Enter"||key===" ")&&event.target?.closest?.("[data-advanced-inline-text-form], .advanced-editor-sidebar, [data-advanced-context-menu], [data-advanced-quick-bar], .canvas-toolbar"))return;
      if(key==="Escape"){
        if(cancelAdvancedGesture()){event.preventDefault();return;}
        if(closeAdvancedContextMenu()){event.preventDefault();return;}
        if(advancedCrop){event.preventDefault();cancelAdvancedCrop();return;}
        if(!selection)return;
        event.preventDefault();
        commitAdvancedSelection(null);
        return;
      }
      if(key==="Enter"&&advancedCrop){event.preventDefault();commitAdvancedCrop();return;}
      if(advancedCrop)return;
      const rotateHandle=event.target?.closest?.('[data-advanced-direct-handle="rotate"]');
      if(rotateHandle&&["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Enter"," "].includes(key)){
        event.preventDefault();
        if(store.entitlement.canMutate!==true||store.document.layoutLock!==false||selectionIsLocked(selection))return;
        const object=advancedObjectForTarget(rotateHandle);
        if(!object)return;
        if(object.type==="event"&&!Number.isFinite(Number(object.item.x))){
          const node=object.element.querySelector?.('[data-continuous-duration-arrow],image')||object.element;
          const box=node.getBBox?.();
          if(!box?.width||!box?.height)return;
          object.item={...object.item,x:box.x,y:box.y,width:box.width,height:box.height};
        }
        const direction=["ArrowLeft","ArrowDown"].includes(key)?-1:1;
        const rotation=Number(object.item.rotation||0)+direction*(event.shiftKey||key==="Enter"||key===" "?15:1);
        if(object.type==="frame"){
          store.mutate("Rotate photo frame",(document)=>{
            const index=String(object.id).replace(/^photo/,"");
            document.presentationOverrides={...(document.presentationOverrides||{}),photoFrames:{
              ...((document.presentationOverrides||{}).photoFrames||{}),
              [index]:{...object.item,rotation:Math.max(-45,Math.min(45,rotation))}
            }};
          });
        }else{
          const result=applySceneCommandToDocument(store.document,{
            kind:"geometry",target:{type:object.type,id:object.id},geometry:{...object.item,rotation},
            ...(object.type==="event"?{create:{type:"event",semanticRef:object.id,aspectLocked:false,presentation:{eventType:store.document.events.find((item)=>String(item.id)===String(object.id))?.eventType||"duration"}}}:{}),
            label:"Rotate Timeline object"
          });
          if(!result.changed)return;
          store.replace(result.document,{label:"Rotate Timeline object"});
        }
        syncBridgeStateFromStore();
        requestAdvancedDirectSelection({type:object.type,id:object.id});
        queueMicrotask(()=>document.querySelector('[data-advanced-direct-handle="rotate"]')?.focus?.({preventScroll:true}));
        announceGlobal("Object rotated");
        return;
      }
      if(meta&&lower==="a"&&!event.shiftKey){
        const members=allAdvancedSelectableMembers();
        if(!members.length)return;
        event.preventDefault();
        commitAdvancedSelection(members.length===1?members[0]:{type:"multi",members});
        return;
      }
      if(meta&&lower==="v"){if(pasteAdvancedClipboard())event.preventDefault();return;}
      if(!selection)return;
      if(meta&&lower==="c"){if(copyAdvancedSelection(selection))event.preventDefault();return;}
      if(meta&&lower==="x"){if(copyAdvancedSelection(selection)&&deleteAdvancedSelection(selection))event.preventDefault();return;}
      if(meta&&lower==="g"){
        event.preventDefault();
        if(event.shiftKey)ungroupAdvancedSelection(selection);else groupAdvancedSelection(selection);
        return;
      }
      if(meta&&(key==="]"||key==="[")){
        event.preventDefault();
        layerAdvancedSelection(selection,key==="]"
          ?(event.shiftKey?"bring-to-front":"bring-forward")
          :(event.shiftKey?"send-to-back":"send-backward"));
        return;
      }
      if(meta&&lower==="d"){event.preventDefault();duplicateAdvancedSelection(selection);return;}
      if(meta&&event.shiftKey&&lower==="l"){event.preventDefault();lockAdvancedSelection(selection,!selectionIsLocked(selection));return;}
      if(key==="Delete"||key==="Backspace"){
        event.preventDefault();
        if(selection.type==="frame")clearAdvancedFrame(selection.id);else deleteAdvancedSelection(selection);
        return;
      }
      if(key==="Enter"&&selection.type==="frame"){event.preventDefault();if(advancedFrameItem(store.document,selection.id))beginAdvancedCrop(selection);else armAdvancedFrameFill(selection.id);return;}
      if(key==="Enter"&&selection.type==="text"){event.preventDefault();beginAdvancedTextEdit(selection);return;}
      if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(key)){
        const step=event.shiftKey?10:1;
        const delta={ArrowLeft:{x:-step,y:0},ArrowRight:{x:step,y:0},ArrowUp:{x:0,y:-step},ArrowDown:{x:0,y:step}}[key];
        if(selection.type!=="event"&&!advancedLeafMembers(selection).length)return;
        event.preventDefault();
        nudgeAdvancedSelection(selection,delta,{resize:event.altKey===true});
      }
    };
    /* ===================== AAA-019 — frames, fill, crop ======================
       The canonical polaroids, the profile portrait and the program-logo well are real
       media containers (Canva "frame" P4–P6): EMPTY frames accept a drop / a chip
       choice, FILLED frames replace / crop / clear. Fills live in `document.mediaItems`,
       the seam the Founder serializer already renders for on-screen, PNG and PDF. */
    const ADVANCED_FRAME_SLOTS=CANONICAL_MEDIA_FRAME_SLOTS;
    const advancedFrameNodes=()=>[...(canvasHost?.querySelectorAll?.(".canvas-application [data-frame-slot]")||[])]
      .filter((node)=>ADVANCED_FRAME_SLOTS[String(node.dataset.frameSlot||"")]);
    const advancedFrameNode=(slot)=>advancedFrameNodes().find((node)=>node.dataset.frameSlot===String(slot))||null;
    const advancedFrameAtPoint=(clientX,clientY)=>{
      const regions=advancedFrameNodes().flatMap((node)=>{
        const rect=node.querySelector("rect");
        if(!rect?.getBBox||!rect?.getScreenCTM)return[];
        return[{slot:String(node.dataset.frameSlot),node,state:String(node.dataset.mediaState||"empty"),geometry:rect.getBBox(),screenMatrix:rect.getScreenCTM()}];
      });
      return hitTestMediaFrames(regions,{x:clientX,y:clientY});
    };
    const clearAdvancedFrameDropTarget=()=>{
      advancedEditSurface()?.querySelectorAll?.("[data-frame-drop-active]")
        .forEach((node)=>node.removeAttribute("data-frame-drop-active"));
    };
    const highlightAdvancedFrameDropTarget=(frame)=>{
      const current=advancedEditSurface()?.querySelector?.("[data-frame-drop-active]");
      if(current&&current===frame?.node)return;
      clearAdvancedFrameDropTarget();
      if(frame?.node)frame.node.setAttribute("data-frame-drop-active","true");
    };
    const advancedFrameItem=(document,slot)=>{
      const placement=ADVANCED_FRAME_SLOTS[slot]?.placement;
      return(document?.mediaItems||[]).find((item)=>String(item?.placement||"").toLowerCase()===placement)||null;
    };
    const advancedFrameLabel=(slot)=>ADVANCED_FRAME_SLOTS[slot]?.label||"Photo frame";
    const advancedFrameGeometryItem=(slot,node)=>{
      const parsed=String(node?.dataset?.founderGeometry||"").split(",").map(Number);
      if(/^photo\d$/.test(String(slot))&&parsed.length>=4&&parsed.slice(0,4).every(Number.isFinite)){
        return{x:parsed[0],y:parsed[1],width:parsed[2],height:parsed[3],rotation:Number(parsed[4])||0,locked:false,aspectLocked:false};
      }
      try{
        const box=node?.getBBox?.();
        if(box)return{x:box.x,y:box.y,width:box.width,height:box.height,rotation:0,locked:false,aspectLocked:true};
      }catch{}
      return{x:0,y:0,width:1,height:1,rotation:0,locked:false,aspectLocked:true};
    };
    const advancedFrameSelection=(slot)=>({type:"frame",id:String(slot)});
    const selectAdvancedFrame=(slot)=>{
      const selection=advancedFrameSelection(slot);
      canvasController?.setUiState({selectedEventId:null,advancedSelection:selection,advancedTextEdit:null});
      requestAdvancedDirectSelection(selection);
    };
    const fillAdvancedFrame=(slot,mediaId,{label="",consumePlacement=false}={})=>{
      const spec=ADVANCED_FRAME_SLOTS[slot];
      if(!spec||store.entitlement.canMutate!==true)return false;
      const prior=advancedFrameItem(store.document,slot);
      const result=fillCanonicalMediaFrame(store.document,slot,mediaId,{id:`frame-${slot}-${uid("media")}`,consumePlacement});
      if(!result.changed)return false;
      store.replace(result.document,{label:label||(prior?`Replace ${spec.label.toLowerCase()}`:`Add ${spec.label.toLowerCase()}`)});
      syncBridgeStateFromStore();
      renderMediaLibrarySurfaces();
      selectAdvancedFrame(slot);
      const message=prior?`${spec.label} replaced`:`Photo added to ${spec.label.toLowerCase()}`;
      bridge.toast(`${message} · Undo with ⌘Z`);
      announceGlobal(message);
      return true;
    };
    advancedFrameDropHook=(mediaId,{x,y})=>{
      const surface=canvasHost?.querySelector?.('.canvas-application > svg[data-founder-serializer]')||advancedEditSurface();
      const bounds=surface?.getBoundingClientRect?.();
      if(!bounds?.width||!bounds?.height)return false;
      const frame=advancedFrameAtPoint(bounds.left+Number(x)*bounds.width/1920,bounds.top+Number(y)*bounds.height/1080);
      return frame?fillAdvancedFrame(frame.slot,mediaId):false;
    };
    const clearAdvancedFrame=(slot)=>{
      const spec=ADVANCED_FRAME_SLOTS[slot];
      if(!spec||!advancedFrameItem(store.document,slot)||store.entitlement.canMutate!==true)return false;
      store.mutate(`Remove ${spec.label.toLowerCase()}`,(document)=>{
        document.mediaItems=(document.mediaItems||[]).filter((item)=>String(item?.placement||"").toLowerCase()!==spec.placement);
      });
      syncBridgeStateFromStore();
      renderMediaLibrarySurfaces();
      selectAdvancedFrame(slot);
      bridge.toast(`${spec.label} removed · Undo with ⌘Z`);
      announceGlobal(`${spec.label} removed`);
      return true;
    };
    /* "Choose from uploads" arms the Uploads panel: the next tile click fills the frame. */
    let advancedFrameFillTarget=null;
    const armAdvancedFrameFill=(slot)=>{
      advancedFrameFillTarget=String(slot);
      canvasController?.setUiState({advancedPanel:"uploads",advancedSelection:advancedFrameSelection(slot)});
      bridge.toast(`Pick an upload for ${advancedFrameLabel(slot).toLowerCase()}, or drag one onto it`);
      announceGlobal("Choose an upload to fill the frame");
    };
    const consumeAdvancedFrameFill=(mediaId)=>{
      if(!advancedFrameFillTarget)return false;
      const slot=advancedFrameFillTarget;
      advancedFrameFillTarget=null;
      return fillAdvancedFrame(slot,mediaId);
    };
    advancedFrameFillHook={armed:()=>!!advancedFrameFillTarget,consume:consumeAdvancedFrameFill};
    const uploadIntoAdvancedFrame=async(slot)=>{
      try{
        const file=await chooseLocalFile(MEDIA_LIBRARY_ACCEPT.join(","));
        if(!file)return false;
        const input={files:[file],value:""};
        const acceptedIds=await onMediaLibraryChange({target:{closest:()=>input}});
        if(!acceptedIds?.length)return false;
        return fillAdvancedFrame(slot,acceptedIds[0]);
      }catch(error){
        toastStudentError(error,"media");
        return false;
      }
    };

    /* ---- crop mode: fixed frame, the image moves inside it (Canva P6) ---- */
    const advancedCropTargetInfo=(target)=>{
      if(!target)return null;
      if(target.type==="frame"){
        const item=advancedFrameItem(store.document,target.id);
        const node=advancedFrameNode(target.id);
        const window_=node?.querySelector?.("svg[data-crop-zoom]");
        return item&&window_?{kind:"frame",slot:String(target.id),item,node,window:window_}:null;
      }
      if(target.type==="media"){
        const item=(store.document.advanced?.media||[]).find((candidate)=>String(candidate.id)===String(target.id));
        const node=advancedMemberElement({type:"media",id:target.id});
        const window_=node?.querySelector?.("svg[data-crop-zoom]")||(node?.matches?.("svg[data-crop-zoom]")?node:null);
        return item&&window_&&item.fit!=="contain"?{kind:"media",id:String(target.id),item,node,window:window_}:null;
      }
      return null;
    };
    const cropWindowMetrics=(view)=>{
      const width=Number(view.getAttribute("width"))||1,height=Number(view.getAttribute("height"))||1;
      const imageWidth=Number(view.getAttribute("data-crop-image-width"))||width;
      const imageHeight=Number(view.getAttribute("data-crop-image-height"))||height;
      return{width,height,imageWidth,imageHeight};
    };
    const applyCropPreview=(session,crop)=>{
      const view=session.window;
      const {width,height,imageWidth,imageHeight}=cropWindowMetrics(view);
      const zoom=Math.min(4,Math.max(1,Number(crop.zoom)||1));
      const px=Math.min(100,Math.max(0,Number(crop.x)))/100,py=Math.min(100,Math.max(0,Number(crop.y)))/100;
      const vw=width/zoom,vh=height/zoom;
      view.setAttribute("viewBox",`${(imageWidth-vw)*px} ${(imageHeight-vh)*py} ${vw} ${vh}`);
      view.setAttribute("data-crop-zoom",String(zoom));
      const chrome=canvasHost?.querySelector?.("[data-advanced-crop-chrome]");
      const slider=chrome?.querySelector?.("[data-crop-zoom-range]");
      if(slider&&Number(slider.value)!==zoom)slider.value=String(zoom);
      const readout=chrome?.querySelector?.("[data-crop-zoom-readout]");
      if(readout)readout.textContent=`${Math.round(zoom*100)}%`;
    };
    const renderAdvancedCropChrome=()=>{
      canvasHost?.querySelectorAll?.("[data-advanced-crop-chrome]").forEach((node)=>node.remove());
      if(!advancedCrop)return;
      const host=advancedOverlayHost();
      const box=advancedCrop.kind==="frame"?advancedFrameScreenBounds022(advancedCrop.node):advancedCrop.node.getBoundingClientRect?.();
      if(!host||!box?.width)return;
      const chrome=document.createElement("div");
      chrome.className="advancedCropChrome";
      chrome.dataset.advancedCropChrome="true";
      chrome.innerHTML=`<div class="advancedCropWindow" data-advanced-crop-window aria-hidden="true"></div>
        <div class="advancedCropBar" role="toolbar" aria-label="Crop image">
          <span class="advancedCropHint">Drag the photo to reposition</span>
          <label class="advancedCropZoom"><span>Zoom</span><input type="range" min="1" max="4" step="0.02" value="${Number(advancedCrop.draft.zoom)||1}" data-crop-zoom-range aria-label="Crop zoom"><output data-crop-zoom-readout>${Math.round((Number(advancedCrop.draft.zoom)||1)*100)}%</output></label>
          <button type="button" class="advancedCropButton" data-crop-cancel>Cancel</button>
          <button type="button" class="advancedCropButton advancedCropButtonPrimary" data-crop-done>Done</button>
        </div>`;
      const view=host.getBoundingClientRect();
      const windowNode=chrome.querySelector("[data-advanced-crop-window]");
      windowNode.style.left=`${box.left-view.left+host.scrollLeft}px`;
      windowNode.style.top=`${box.top-view.top+host.scrollTop}px`;
      windowNode.style.width=`${box.width}px`;
      windowNode.style.height=`${box.height}px`;
      const bar=chrome.querySelector(".advancedCropBar");
      bar.style.left=`${Math.max(8,box.left-view.left+host.scrollLeft)}px`;
      bar.style.top=`${Math.max(8,box.top-view.top+host.scrollTop-48)}px`;
      host.append(chrome);
      chrome.querySelector("[data-crop-zoom-range]")?.addEventListener("input",(event)=>{
        if(!advancedCrop)return;
        advancedCrop.draft={...advancedCrop.draft,zoom:Number(event.target.value)||1};
        applyCropPreview(advancedCrop,advancedCrop.draft);
      });
      chrome.querySelector("[data-crop-done]")?.addEventListener("click",()=>commitAdvancedCrop());
      chrome.querySelector("[data-crop-cancel]")?.addEventListener("click",()=>cancelAdvancedCrop());
    };
    const beginAdvancedCrop=(target)=>{
      if(store.entitlement.canMutate!==true)return false;
      const info=advancedCropTargetInfo(target);
      if(!info){
        bridge.toast(target?.type==="frame"?"Add a photo to this frame first":"This image cannot be cropped");
        return false;
      }
      cancelAdvancedCrop({silent:true});
      const original={x:Number(info.item.crop?.x??50),y:Number(info.item.crop?.y??50),zoom:Number(info.item.crop?.zoom||1)};
      advancedCrop={...info,original,draft:{...original},target:{...target},modeAtPress:store.document.mode};
      canvasHost?.classList.add("advancedCropActive");
      clearAdvancedDirectSelection();
      renderAdvancedCropChrome();
      announceGlobal("Crop mode. Drag the photo to reposition, use the zoom slider, then press Done.");
      return true;
    };
    const cancelAdvancedCrop=({silent=false}={})=>{
      if(!advancedCrop)return false;
      const session=advancedCrop;
      advancedCrop=null;
      if(session.window?.isConnected)applyCropPreview(session,session.original);
      canvasHost?.classList.remove("advancedCropActive");
      canvasHost?.querySelectorAll?.("[data-advanced-crop-chrome]").forEach((node)=>node.remove());
      if(!silent){
        requestAdvancedDirectSelection(session.target);
        announceGlobal("Crop canceled");
      }
      return true;
    };
    const commitAdvancedCrop=()=>{
      if(!advancedCrop)return false;
      const session=advancedCrop;
      advancedCrop=null;
      canvasHost?.classList.remove("advancedCropActive");
      canvasHost?.querySelectorAll?.("[data-advanced-crop-chrome]").forEach((node)=>node.remove());
      const crop={
        x:Math.min(100,Math.max(0,Number(session.draft.x))),
        y:Math.min(100,Math.max(0,Number(session.draft.y))),
        zoom:Math.min(4,Math.max(1,Number(session.draft.zoom)||1))
      };
      const unchanged=crop.x===session.original.x&&crop.y===session.original.y&&crop.zoom===session.original.zoom;
      if(!unchanged){
        if(session.kind==="frame"){
          const placement=ADVANCED_FRAME_SLOTS[session.slot].placement;
          store.mutate(`Crop ${advancedFrameLabel(session.slot).toLowerCase()}`,(document)=>{
            document.mediaItems=(document.mediaItems||[]).map((item)=>
              String(item?.placement||"").toLowerCase()===placement?{...item,crop}:item);
          });
        }else{
          store.replace(updateMediaPresentation(store.document,session.id,{crop}),{label:"Crop image"});
        }
        syncBridgeStateFromStore();
      }
      canvasController?.setUiState({advancedSelection:session.target});
      requestAdvancedDirectSelection(session.target);
      bridge.toast(unchanged?"Crop unchanged":"Crop applied · Undo with ⌘Z");
      announceGlobal(unchanged?"Crop unchanged":"Crop applied");
      return true;
    };
    /* Pointer physics for crop: a drag inside the window pans the image. */
    const advancedCropPointerDown=(event)=>{
      if(!advancedCrop||event.button!==0)return false;
      if(event.target.closest?.("[data-advanced-crop-chrome] .advancedCropBar"))return false;
      const box=advancedCrop.node.getBoundingClientRect?.();
      const inside=box&&event.clientX>=box.left&&event.clientX<=box.right&&event.clientY>=box.top&&event.clientY<=box.bottom;
      if(!inside){
        /* Click-out commits, like every mature crop mode. */
        commitAdvancedCrop();
        return true;
      }
      const view=advancedCrop.window;
      const {width,height,imageWidth,imageHeight}=cropWindowMetrics(view);
      const svg=advancedCrop.node.closest("svg[data-founder-serializer]")||advancedEditSurface();
      const svgBounds=svg?.getBoundingClientRect?.();
      const zoom=Math.min(4,Math.max(1,Number(advancedCrop.draft.zoom)||1));
      let screenToImage={a:(svgBounds?.width?1920/svgBounds.width:1)/zoom,b:0,c:0,d:(svgBounds?.height?1080/svgBounds.height:1)/zoom};
      try{
        const inverse=view.getScreenCTM?.()?.inverse?.();
        if(inverse&&[inverse.a,inverse.b,inverse.c,inverse.d].every(Number.isFinite)){
          screenToImage={a:inverse.a,b:inverse.b,c:inverse.c,d:inverse.d};
        }
      }catch{/* The untransformed board fallback still accounts for crop zoom. */}
      advancedCrop.pan={
        startX:event.clientX,startY:event.clientY,start:{...advancedCrop.draft},
        screenToImage,
        width,height,imageWidth,imageHeight
      };
      event.preventDefault();
      event.stopPropagation();
      return true;
    };
    const advancedCropPointerMove=(event)=>{
      if(!advancedCrop?.pan)return false;
      const pan=advancedCrop.pan;
      advancedCrop.draft=panMediaCrop(pan.start,{...pan,dx:event.clientX-pan.startX,dy:event.clientY-pan.startY});
      applyCropPreview(advancedCrop,advancedCrop.draft);
      event.preventDefault();
      return true;
    };
    const advancedCropPointerUp=()=>{
      if(!advancedCrop?.pan)return false;
      delete advancedCrop.pan;
      return true;
    };

    const canEditAdvancedGeometry=()=>store.entitlement.canMutate===true&&
      canvasController?.state?.entitlementEditable!==false&&
      canvasController?.state?.responsive?.viewOnly!==true;
    const canContinueAdvancedGesture=(pointer)=>canEditAdvancedGeometry()&&
      store.document.layoutLock===false&&pointer.modeAtPress===store.document.mode&&
      !selectionIsLocked({type:pointer.type,id:pointer.id});
    onAdvancedPointerDown=(event)=>{
      // Read-only inspection must never start a mutable SVG preview.
      if(!canEditAdvancedGeometry())return;
      if(advancedCrop&&advancedCropPointerDown(event))return;
      /* Click-out commits an open inline text edit (Canva T3). The press itself calls
         preventDefault further down, which would otherwise suppress the blur that used
         to commit — so the draft was silently discarded on the very click that a
         student expects to "finish" the edit. */
      if(canvasController?.state?.advancedTextEdit&&event.button===0&&!event.target.closest?.("[data-advanced-inline-text-form]")){
        const form=canvasHost?.querySelector?.("[data-advanced-inline-text-form]");
        if(form?.requestSubmit)form.requestSubmit();
        else form?.dispatchEvent?.(new Event("submit",{bubbles:true,cancelable:true}));
      }
      if(event.button!==0||railPointer||advancedPointer||axisPointer||marqueePointer)return;
      /* AAA-019 red-team D2 — a press on the inline editor itself (its textarea, Done or
         Cancel) is the editor's business: it must never fall through to the marquee path,
         whose release used to clear the draft before the button's click could commit it. */
      if(event.target.closest?.("[data-advanced-inline-text-form]"))return;
      const railAsset=event.target.closest?.("[data-advanced-insert-asset]");
      /* AAA-019 — uploads and existing objects in the rail drag with the same pointer
         ghost as built-in assets (Canva P3). The native HTML5 DnD path stays as a
         fallback, but a press-and-move on a tile is now a real, visible drag. */
      const railObject=railAsset?null:event.target.closest?.("[data-advanced-drag-object][data-advanced-target-type][data-advanced-target-id], [data-media-asset][data-media-place]");
      if((railAsset||railObject)&&canEditAdvancedGeometry()&&store.document.layoutLock===false&&store.document.mode==="advanced"){
        const ghost=document.createElement("div");
        ghost.className="advancedRailDragGhost";
        const tile=railAsset||railObject;
        const preview=tile.querySelector?.("img");
        if(preview?.src){
          ghost.classList.add("advancedRailDragGhostImage");
          const image=document.createElement("img");
          image.src=preview.src;image.alt="";
          ghost.append(image);
        }else{
          ghost.textContent=tile.innerText?.trim()?.split("\n")[0]||tile.getAttribute("aria-label")||"Timeline asset";
        }
        ghost.style.left=`${event.clientX+14}px`;
        ghost.style.top=`${event.clientY+14}px`;
        document.body.append(ghost);
        const payload=railAsset
          ?{
            kind:"insert",action:String(railAsset.dataset.advancedAction||"asset"),
            assetKind:String(railAsset.dataset.advancedKind||"rectangle"),
            symbol:String(railAsset.dataset.advancedSymbol||"")
          }
          :{
            kind:"insert",action:"place",
            target:{
              type:String(railObject.dataset.advancedTargetType||(railObject.hasAttribute("data-media-asset")?"media":"")),
              id:String(railObject.dataset.advancedTargetId||railObject.dataset.mediaAsset||"")
            }
          };
        railPointer={
          startX:event.clientX,startY:event.clientY,moved:false,ghost,
          source:tile,pointerId:event.pointerId,payload,modeAtPress:store.document.mode
        };
        /* No pointer capture: the rail re-renders on selection changes, and a captured
           node that gets replaced swallows the pointerup — the document-level listeners
           already see every move and release. */
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const axisHandle=event.target.closest?.("[data-advanced-axis-boundary-handle]");
      if(axisHandle){
        if(store.document.layoutLock!==false||store.entitlement.canMutate!==true)return;
        const surface=advancedEditSurface();
        const segments=[...(surface?.querySelectorAll?.("[data-axis-segment-id]")||[])];
        const index=Number(axisHandle.dataset.advancedAxisBoundaryHandle);
        const left=segments[index],right=segments[index+1];
        if(!left||!right)return;
        const weights=segments.map((segment)=>({
          id:String(segment.dataset.axisSegmentId||""),
          weight:Math.max(.25,Number(segment.dataset.axisSegmentWeight)||1)
        }));
        const leftBox=left.getBBox?.(),rightBox=right.getBBox?.();
        if(!leftBox?.width||!rightBox?.width)return;
        axisPointer={
          startX:event.clientX,index,segments,weights,left,right,leftBox,rightBox,
          pairWeight:weights[index].weight+weights[index+1].weight,
          pairPixelWidth:Math.max(1,left.getBoundingClientRect().width+right.getBoundingClientRect().width),modeAtPress:store.document.mode,
          preview:weights.map((item)=>({...item})),moved:false
        };
        left.dataset.advancedAxisDragging="left";
        right.dataset.advancedAxisDragging="right";
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if(store.document.layoutLock!==false){
        /* AAA-019 — a locked layout used to swallow every press in silence, which reads as
           "the editor is broken". Say why once per lock, and point at the switch. */
        if(store.document.mode==="advanced"&&store.entitlement.canMutate===true&&advancedObjectForTarget(event.target)){
          explainLayoutLock();
        }
        return;
      }
      if(
        (event.shiftKey||event.metaKey||event.ctrlKey)&&
        !event.target.closest?.("[data-advanced-direct-handle]")
      )return;
      const doublePress=Number(event.detail)>=2||consumeDoublePress(event);
      const shallowObject=advancedObjectForTarget(event.target);
      const deepObject=(doublePress||event.altKey===true)
        ?advancedObjectForTarget(event.target,{deep:true})
        :shallowObject;
      /* A quick click followed by a drag produces a second press inside the manual
         double-press window. When that press lands on a grouped child, dragging must
         still move the group; only a second press that is released without movement
         drills into the child. Alt remains the explicit direct-child drag gesture. */
      const deferredGroupedDeep=doublePress&&event.altKey!==true&&
        shallowObject?.type==="group"&&deepObject&&deepObject.type!=="group"
        ?{type:deepObject.type,id:String(deepObject.id)}
        :null;
      const object=deferredGroupedDeep?shallowObject:deepObject;
      if(!object){
        // The existing explanation owner handles its free geometry; never start a marquee over it.
        if(event.target.closest?.('[data-event-kind="explanation"][data-event-id]'))return;
        /* A2.6 — a press on empty board used to fall through here and do nothing, which
           is what made "drag on the board" read as a page rather than a canvas. Rubber-band
           instead. user-select:none on the substrate keeps this from becoming a text drag. */
        if(store.document.mode!=="advanced"||store.entitlement.canMutate!==true)return;
        const surface=event.target.closest?.(".canvas-application");
        if(!surface||event.target.closest?.("[data-canvas-coach]"))return;
        marqueePointer={
          startX:event.clientX,startY:event.clientY,
          pointerId:event.pointerId,moved:false,box:null,surface,
          additive:event.shiftKey===true,modeAtPress:store.document.mode
        };
        event.preventDefault();
        return;
      }
      if(store.document.mode!=="advanced"&&[
        "event","color-key","profile","frame"
      ].includes(object.type))return;
      if(object.type==="frame"){
        /* Double-press on a filled frame opens crop; a press on a fixed well (profile
           portrait, program logo) selects it and stops — those move with their card. */
        if(doublePress&&object.frameState==="filled"&&store.entitlement.canMutate===true){
          canvasController?.setUiState({selectedEventId:null,advancedSelection:{type:"frame",id:object.id},advancedTextEdit:null});
          beginAdvancedCrop({type:"frame",id:object.id});
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if(object.fixed||store.entitlement.canMutate!==true){
          selectAdvancedFrame(object.id);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
      if(doublePress&&object.type==="media"&&store.entitlement.canMutate===true&&!object.item?.groupId){
        canvasController?.setUiState({selectedEventId:null,advancedSelection:{type:"media",id:object.id},advancedTextEdit:null});
        if(beginAdvancedCrop({type:"media",id:object.id})){
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
      if(object.item?.locked===true){
        bridge.toast("Unlock this Timeline object before moving or resizing it.");
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      /* A2.8 — double-press opens inline text editing, and it has to be detected here
         rather than on click or dblclick. Committing a gesture on pointerup re-renders
         the board, which replaces the very node the browser needs to have seen for both
         press and release; no click event is ever dispatched, so the click-based
         double-click path was unreachable. Reading event.detail on pointerdown is the
         only place the second press is still observable. */
      if(doublePress&&object.type==="text"&&store.entitlement.canMutate===true){
        const block=(store.document.advanced?.textBlocks||[]).find(
          (item)=>String(item.id)===String(object.id)
        );
        canvasController?.setUiState({
          advancedSelection:{type:"text",id:object.id},
          advancedTextEdit:{id:object.id,draft:String(block?.text||"")}
        });
        queueMicrotask(()=>{
          const field=canvasHost.querySelector("[data-advanced-inline-text-input]");
          field?.focus?.();
          field?.select?.();
        });
        announceGlobal("Text editing opened");
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const geometryElement=object.type==="event"
        ?object.element.querySelector?.("[data-continuous-duration-arrow],image")||object.element
        :object.element;
      const svg=object.element.closest("svg");
      const svgBounds=svg?.getBoundingClientRect?.();
      const objectBounds=object.bounds||geometryElement.getBoundingClientRect?.();
      if(!svgBounds?.width||!svgBounds?.height||!objectBounds)return;
      clearAdvancedAlignmentGuides(svg);
      let modelBounds={
        x:Number(object.item.x||0),y:Number(object.item.y||0),
        width:Number(object.item.width||1),height:Number(object.item.height||1)
      };
      try{
        const box=geometryElement.getBBox?.();
        if(
          object.type!=="group"&&
          !object.element.hasAttribute?.("data-scene-object")&&
          !["color-key","profile","frame"].includes(object.type)&&
          box&&Number.isFinite(box.x)&&Number.isFinite(box.y)&&box.width>0&&box.height>0
        ){
          modelBounds={x:box.x,y:box.y,width:box.width,height:box.height};
        }
      }catch{}
      if(
        !Number.isFinite(Number(object.item.x))||
        !Number.isFinite(Number(object.item.y))||
        !Number.isFinite(Number(object.item.width))||
        !Number.isFinite(Number(object.item.height))
      )object.item={...object.item,...modelBounds};
      const resizeZone=Math.max(
        6,
        Math.min(18,objectBounds.width*.25,objectBounds.height*.25)
      );
      const resizeHandle=String(object.handle||"")||(
        event.clientX>=objectBounds.right-resizeZone&&
        event.clientY>=objectBounds.bottom-resizeZone
          ?"se":""
      );
      advancedPointer={
        ...object,
        modeAtPress:store.document.mode,
        kind:resizeHandle==="rotate"?"rotate":resizeHandle?"resize":"move",
        handle:resizeHandle,
        startX:event.clientX,
        startY:event.clientY,
        scaleX:1920/svgBounds.width,
        scaleY:1080/svgBounds.height,
        boardWidthAtPress:svgBounds.width,
        rotationStart:{x:(event.clientX-svgBounds.left)*(1920/svgBounds.width),y:(event.clientY-svgBounds.top)*(1080/svgBounds.height)},
        grabOffsetX:(event.clientX-svgBounds.left)*(1920/svgBounds.width)-Number(object.item.x||0),
        grabOffsetY:(event.clientY-svgBounds.top)*(1080/svgBounds.height)-Number(object.item.y||0),
        svg,
        visualOffsetX:modelBounds.x-Number(object.item.x||0),
        visualOffsetY:modelBounds.y-Number(object.item.y||0),
        visualWidth:modelBounds.width,
        visualHeight:modelBounds.height,
        original:{...clone(object.item),...modelBounds},
        preview:{...clone(object.item),...modelBounds},
        originalTransform:object.element.getAttribute?.("transform"),
        members:(object.members||[]).map((member)=>({
          ...member,
          original:clone(member.item),
          originalTransform:member.element.getAttribute?.("transform")
        })),
        deferredGroupedDeep,
        moved:false
      };
      const gestureNodes=advancedPointer.members.length
        ?advancedPointer.members.map(({element})=>element)
        :[object.element];
      gestureNodes.forEach((node)=>{
        node.dataset.advancedDragging=advancedPointer.kind;
        node.dataset.advancedResizeHandle=resizeHandle||"move";
      });
      if(object.type!=="event")canvasController?.setUiState({
        selectedEventId:null,
        advancedSelection:{type:object.type,id:object.id}
      });
      showAdvancedDirectSelection({type:object.type,id:object.id});
      event.preventDefault();
      event.stopPropagation();
    };
    /* AAA-019 (Canva D2): the selection box travels with the object while it is dragged or
       resized — the quick-bar and hover chrome step aside for the gesture and come back on
       release, when showAdvancedDirectSelection re-mounts everything against the committed
       geometry. Only the existing overlay's box is moved here; nothing is re-rendered. */
    /* AAA-019 red-team D6/D12 — Escape (or a zoom change) while a drag/resize is live
       abandons it: every gesture node returns to its original transform, nothing commits,
       no history entry. */
    const cancelAdvancedGesture=()=>{
      if(!advancedPointer)return false;
      const pointer=advancedPointer;
      advancedPointer=null;
      const nodes=pointer.members?.length?pointer.members:[{element:pointer.element,originalTransform:pointer.originalTransform}];
      for(const {element,originalTransform} of nodes){
        if(!element?.setAttribute)continue;
        if(originalTransform)element.setAttribute("transform",originalTransform);
        else element.removeAttribute("transform");
        delete element.dataset?.advancedDragging;
        delete element.dataset?.advancedResizeHandle;
      }
      clearAdvancedFrameDropTarget();
      document.querySelectorAll?.("[data-advanced-dragging]").forEach((node)=>{delete node.dataset.advancedDragging;});
      clearAdvancedAlignmentGuides(pointer.svg);
      syncAdvancedSelectionChrome();
      announceGlobal("Move cancelled");
      return true;
    };
    const canContinueTransientAdvancedSession=(session,target=null)=>canEditAdvancedGeometry()&&
      store.document.layoutLock===false&&session?.modeAtPress===store.document.mode&&
      (!target||!selectionIsLocked(target));
    cancelInvalidAdvancedSessions=()=>{
      let cancelled=false;
      if(advancedCrop&&!canContinueTransientAdvancedSession(advancedCrop,advancedCrop.target)){
        cancelAdvancedCrop({silent:true});
        cancelled=true;
      }
      if(marqueePointer&&!canContinueTransientAdvancedSession(marqueePointer)){
        marqueePointer.box?.remove();
        marqueePointer=null;
        cancelled=true;
      }
      if(axisPointer&&!canContinueTransientAdvancedSession(axisPointer,{type:"axis",id:"axis"})){
        delete axisPointer.left?.dataset?.advancedAxisDragging;
        delete axisPointer.right?.dataset?.advancedAxisDragging;
        axisPointer.left?.removeAttribute?.("transform");
        axisPointer.right?.removeAttribute?.("transform");
        axisPointer=null;
        clearAdvancedAxisBoundaryHandles();
        cancelled=true;
      }
      if(railPointer&&!canContinueTransientAdvancedSession(railPointer,railPointer.payload?.target||null)){
        try{railPointer.source?.releasePointerCapture?.(railPointer.pointerId);}catch{}
        railPointer.ghost?.remove?.();
        railPointer=null;
        clearAdvancedFrameDropTarget();
        cancelled=true;
      }
      if(advancedPointer&&!canContinueAdvancedGesture(advancedPointer)){
        cancelAdvancedGesture();
        cancelled=true;
      }
      if(cancelled)announceGlobal("Timeline edit cancelled because access or editor state changed");
      return cancelled;
    };
    const trackAdvancedSelectionChrome=(pointer)=>{
      if(!pointer)return;
      if(!pointer.chromeTracking){
        pointer.chromeTracking=true;
        clearAdvancedQuickBar();
        clearAdvancedHoverChrome();
        document.querySelectorAll?.("[data-advanced-context-menu], .advancedDirectSelectionMember").forEach((node)=>node.remove());
      }
      const nodes=(pointer.members?.length?pointer.members.map(({element})=>element):[pointer.element]).filter((node)=>node?.getBoundingClientRect);
      if(!nodes.length)return;
      let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
      for(const node of nodes){
        const box=node.getBoundingClientRect();
        if(!box.width&&!box.height)continue;
        left=Math.min(left,box.left);top=Math.min(top,box.top);
        right=Math.max(right,box.right);bottom=Math.max(bottom,box.bottom);
      }
      if(!Number.isFinite(left)||!Number.isFinite(top))return;
      const host=advancedOverlayHost();
      if(!host)return;
      const view=host.getBoundingClientRect();
      const minimum=28;
      const width=Math.max(right-left,minimum),height=Math.max(bottom-top,minimum);
      const padX=(width-(right-left))/2,padY=(height-(bottom-top))/2;
      const overlays=[...host.querySelectorAll(".advancedDirectSelection:not([data-advanced-multi-outline])")];
      const target=overlays.find((node)=>node.dataset.advancedTargetId===String(pointer.id))||overlays.at(-1);
      if(!target)return;
      target.style.left=`${left-padX-view.left+host.scrollLeft}px`;
      target.style.top=`${top-padY-view.top+host.scrollTop}px`;
      target.style.width=`${width}px`;
      target.style.height=`${height}px`;
      target.dataset.advancedGestureTracking="true";
    };
    const applyDirectPreviewGeometry=(pointer,next)=>{
      const node=pointer.element;
      const original=pointer.original;
      if(!node?.setAttribute)return;
      if(pointer.type==="group"){
        const scaleX=next.width/Math.max(1,Number(original.width)||1);
        const scaleY=next.height/Math.max(1,Number(original.height)||1);
        for(const member of pointer.members||[]){
          const child=member.original;
          const childNext={
            ...child,
            x:next.x+(Number(child.x||0)-Number(original.x||0))*scaleX,
            y:next.y+(Number(child.y||0)-Number(original.y||0))*scaleY,
            width:Math.max(1,Number(child.width||1)*scaleX),
            height:Math.max(1,Number(child.height||1)*scaleY)
          };
          applyDirectPreviewGeometry({
            type:member.type,
            element:member.element,
            original:child,
            members:[]
          },childNext);
        }
        return;
      }
      if(pointer.type==="color-key"||pointer.type==="profile"){
        const base=pointer.type==="color-key"
          ?{width:284,height:346}
          :{width:545,height:410};
        node.setAttribute("transform",`translate(${next.x} ${next.y}) scale(${next.width/base.width} ${next.height/base.height})`);
        return;
      }
      if(pointer.type==="frame"){
        const sx=next.width/Math.max(1,Number(original.width)||1);
        const sy=next.height/Math.max(1,Number(original.height)||1);
        const rotation=Number(next.rotation)||0;
        node.setAttribute("transform",`translate(${next.x} ${next.y}) scale(${sx} ${sy}) translate(${-original.x} ${-original.y}) rotate(${rotation} ${original.x+original.width/2} ${original.y+original.height/2})`);
        return;
      }
      if(pointer.type==="event"){
        const sx=next.width/Math.max(1,Number(original.width)||1);
        const sy=next.height/Math.max(1,Number(original.height)||1);
        node.setAttribute("transform",`translate(${next.x} ${next.y}) rotate(${Number(next.rotation)||0} ${next.width/2} ${next.height/2}) scale(${sx} ${sy}) translate(${-original.x} ${-original.y})`);
        return;
      }
      const sx=next.width/Math.max(1,Number(original.width)||1);
      const sy=next.height/Math.max(1,Number(original.height)||1);
      node.setAttribute("transform",`translate(${next.x} ${next.y}) rotate(${Number(next.rotation)||0} ${next.width/2} ${next.height/2}) scale(${sx} ${sy})`);
    };
    onAdvancedPointerMove=(event)=>{
      if(cancelInvalidAdvancedSessions())return;
      if(advancedCropPointerMove(event))return;
      if(marqueePointer){
        const pending=marqueePointer;
        if(!pending.moved){
          if(Math.hypot(event.clientX-pending.startX,event.clientY-pending.startY)<4)return;
          pending.moved=true;
          pending.box=document.createElement("div");
          pending.box.className="advancedMarquee";
          pending.box.dataset.advancedMarquee="true";
        }
        const left=Math.min(pending.startX,event.clientX);
        const top=Math.min(pending.startY,event.clientY);
        const width=Math.abs(event.clientX-pending.startX);
        const height=Math.abs(event.clientY-pending.startY);
        /* Kept in viewport coordinates for the hit test below, since the object bounds
           it is compared against are viewport coordinates too. */
        pending.rect={left,top,right:left+width,bottom:top+height};
        mountAdvancedOverlay(pending.box,{left,top,width,height});
        return;
      }
      if(axisPointer){
        const pending=axisPointer;
        const dx=event.clientX-pending.startX;
        if(!pending.moved&&Math.abs(dx)<3)return;
        pending.moved=true;
        const leftOriginal=pending.weights[pending.index].weight;
        const delta=dx/pending.pairPixelWidth*pending.pairWeight;
        const leftWeight=Math.max(.25,Math.min(pending.pairWeight-.25,leftOriginal+delta));
        const rightWeight=pending.pairWeight-leftWeight;
        pending.preview=pending.weights.map((item,index)=>index===pending.index
          ?{...item,weight:leftWeight}
          :index===pending.index+1
            ?{...item,weight:rightWeight}
            :{...item});
        const pairStart=pending.leftBox.x;
        const pairEnd=pending.rightBox.x+pending.rightBox.width;
        const pairWidth=Math.max(1,pairEnd-pairStart);
        const nextLeftWidth=pairWidth*(leftWeight/pending.pairWeight);
        const nextRightX=pairStart+nextLeftWidth;
        const nextRightWidth=pairEnd-nextRightX;
        pending.left.setAttribute("transform",`translate(${pairStart} 0) scale(${nextLeftWidth/Math.max(1,pending.leftBox.width)} 1) translate(${-pending.leftBox.x} 0)`);
        pending.right.setAttribute("transform",`translate(${nextRightX} 0) scale(${nextRightWidth/Math.max(1,pending.rightBox.width)} 1) translate(${-pending.rightBox.x} 0)`);
        event.preventDefault();
        return;
      }
      if(railPointer){
        railPointer.lastX=event.clientX;railPointer.lastY=event.clientY;
        railPointer.ghost.style.left=`${event.clientX+14}px`;
        railPointer.ghost.style.top=`${event.clientY+14}px`;
        railPointer.moved=railPointer.moved||Math.hypot(event.clientX-railPointer.startX,event.clientY-railPointer.startY)>5;
        if(railPointer.payload?.action==="place"&&railPointer.payload.target?.type==="media"){
          highlightAdvancedFrameDropTarget(advancedFrameAtPoint(event.clientX,event.clientY));
        }
        event.preventDefault();
        return;
      }
      if(!advancedPointer)return;
      if(!canContinueAdvancedGesture(advancedPointer)){cancelAdvancedGesture();return;}
      if(advancedPointer.type==="media"&&advancedPointer.kind==="move"&&!advancedPointer.members?.length){
        highlightAdvancedFrameDropTarget(advancedFrameAtPoint(event.clientX,event.clientY));
      }
      /* AAA-019 red-team D12 — keyboard zoom re-renders the board mid-gesture; the press
         mapping is stale, so the gesture is abandoned rather than committed off-target. */
      const liveBounds=advancedPointer.svg?.getBoundingClientRect?.();
      if(advancedPointer.boardWidthAtPress&&liveBounds?.width&&Math.abs(liveBounds.width-advancedPointer.boardWidthAtPress)>1){
        if(advancedPointer.kind==="rotate"){
          cancelAdvancedGesture();
          announceGlobal("Rotation canceled because the board zoom changed");
          return;
        }
        /* Re-base the gesture on the new mapping so the grabbed point stays under the
           pointer: the preview reached so far becomes the new origin of the drag. */
        const preview=advancedPointer.preview||advancedPointer.original;
        const scaleX=1920/liveBounds.width,scaleY=1080/liveBounds.height;
        if(advancedPointer.kind==="move"){
          /* The grabbed point follows the pointer: the object re-homes so that the spot
             under the finger at press is under the finger again at the new zoom. */
          const pointerBoardX=(event.clientX-liveBounds.left)*scaleX;
          const pointerBoardY=(event.clientY-liveBounds.top)*scaleY;
          const targetX=pointerBoardX-Number(advancedPointer.grabOffsetX||0);
          const targetY=pointerBoardY-Number(advancedPointer.grabOffsetY||0);
          advancedPointer.startX=event.clientX-(targetX-Number(advancedPointer.original.x))/scaleX;
          advancedPointer.startY=event.clientY-(targetY-Number(advancedPointer.original.y))/scaleY;
        }else{
          advancedPointer.startX=event.clientX-(Number(preview.width)-Number(advancedPointer.original.width))/scaleX;
          advancedPointer.startY=event.clientY-(Number(preview.height)-Number(advancedPointer.original.height))/scaleY;
        }
        advancedPointer.scaleX=scaleX;advancedPointer.scaleY=scaleY;
        advancedPointer.boardWidthAtPress=liveBounds.width;
      }
      const dx=(event.clientX-advancedPointer.startX)*advancedPointer.scaleX;
      const dy=(event.clientY-advancedPointer.startY)*advancedPointer.scaleY;
      if(!advancedPointer.moved&&Math.hypot(dx,dy)<4)return;
      advancedPointer.moved=true;
      const original=advancedPointer.original;
      let next;
      if(advancedPointer.kind==="rotate"){
        const bounds=advancedPointer.svg.getBoundingClientRect();
        next=rotateSceneGeometry(original,advancedPointer.rotationStart,{
          x:(event.clientX-bounds.left)*advancedPointer.scaleX,
          y:(event.clientY-bounds.top)*advancedPointer.scaleY
        },{snapDegrees:event.shiftKey?15:0});
        if(advancedPointer.type==="frame")next.rotation=Math.max(-45,Math.min(45,next.rotation));
        applyDirectPreviewGeometry(advancedPointer,next);
      }else if(advancedPointer.kind==="resize"){
        const freeAspect=original.aspectLocked===false
          ?!event.shiftKey
          :event.shiftKey;
        const resized=resizeSceneGeometry(original,advancedPointer.handle||"se",dx,dy,{
          aspectLocked:!freeAspect,
          minimumWidth:advancedPointer.type==="profile"?360:48,
          minimumHeight:advancedPointer.type==="profile"?272:advancedPointer.type==="event"?Math.min(48,original.height):48
        });
        if(!freeAspect&&["e","w"].includes(advancedPointer.handle)){
          const ratio=original.width/Math.max(1,original.height);
          resized.height=resized.width/ratio;
          resized.y=original.y+(original.height-resized.height)/2;
        }else if(!freeAspect&&["n","s"].includes(advancedPointer.handle)){
          const ratio=original.width/Math.max(1,original.height);
          resized.width=resized.height*ratio;
          resized.x=original.x+(original.width-resized.width)/2;
        }
        /* AAA-019 red-team D5 — a handle dragged past the board edge stops AT the edge; the
           opposite (anchor) edge never slides. Clamp the moving edges before the generic
           constrain, which only clamps position. */
        const handleName=String(advancedPointer.handle||"se");
        const clampedResize={...clone(original),...resized};
        if(clampedResize.x<0){if(handleName.includes("w")){clampedResize.width+=clampedResize.x;}clampedResize.x=0;}
        if(clampedResize.y<0){if(handleName.includes("n")){clampedResize.height+=clampedResize.y;}clampedResize.y=0;}
        if(clampedResize.x+clampedResize.width>1920)clampedResize.width=1920-clampedResize.x;
        if(clampedResize.y+clampedResize.height>1080)clampedResize.height=1080-clampedResize.y;
        clampedResize.width=Math.max(48,clampedResize.width);
        clampedResize.height=Math.max(advancedPointer.type==="profile"?272:advancedPointer.type==="event"?Math.min(48,original.height):48,clampedResize.height);
        next=constrainAdvancedObjectToBoard(clampedResize,{minimumSize:advancedPointer.type==="event"?1:48});
        applyDirectPreviewGeometry(advancedPointer,next);
      }else{
        const width=Number(original.width||0);
        const height=Number(original.height||0);
        const x=Math.max(0,Math.min(1920-width,Number(original.x||0)+dx));
        const y=Math.max(0,Math.min(1080-height,Number(original.y||0)+dy));
        next=constrainAdvancedObjectToBoard(advancedPointer.type==="media"
          ?moveMediaElement(original,{x,y})
          :{...clone(original),x,y},{minimumSize:advancedPointer.type==="event"?1:48});
        const snapped=snapAdvancedObjectToBoard(next,{
          threshold:12,
          visualBounds:{
            x:Number(next.x||0)+advancedPointer.visualOffsetX,
            y:Number(next.y||0)+advancedPointer.visualOffsetY,
            width:advancedPointer.visualWidth,
            height:advancedPointer.visualHeight
          },
          peers:advancedSnapPeers(advancedPointer)
        });
        next=constrainAdvancedObjectToBoard(snapped.element,{minimumSize:advancedPointer.type==="event"?1:48});
        showAdvancedAlignmentGuides(advancedPointer.svg,snapped.guides);
        applyDirectPreviewGeometry(advancedPointer,next);
      }
      advancedPointer.preview=next;
      trackAdvancedSelectionChrome(advancedPointer);
      event.preventDefault();
    };
    onAdvancedPointerUp=(event)=>{
      if(event?.type==="pointercancel"&&advancedCrop?.pan){
        cancelAdvancedCrop({silent:true});
        announceGlobal("Crop cancelled");
        return;
      }
      if(cancelInvalidAdvancedSessions())return;
      if(advancedCropPointerUp())return;
      if(marqueePointer){
        const pending=marqueePointer;
        marqueePointer=null;
        pending.box?.remove();
        if(!pending.moved||event?.type==="pointercancel"){
          /* A press with no drag is a deselect, the same as clicking empty board. */
          if(!pending.moved&&event?.type!=="pointercancel"){
            canvasController?.setUiState({advancedSelection:null,advancedTextEdit:null});
            requestAdvancedDirectSelection(null);
          }
          return;
        }
        const rect=pending.rect;
        if(!rect)return;
        /* Intersecting, not strictly contained: a band that visibly touches an object
           should take it, which is what a Canva user expects from a rubber band. */
        const hits=allAdvancedSelectableMembers().filter((member)=>{
          const box=advancedMemberElement(member)?.getBoundingClientRect?.();
          if(!box?.width||!box?.height)return false;
          return box.left<rect.right&&box.right>rect.left&&
            box.top<rect.bottom&&box.bottom>rect.top;
        });
        const existing=pending.additive
          ?(()=>{
            const current=canvasController?.state?.advancedSelection||null;
            if(!current)return[];
            if(current.type==="multi")return Array.isArray(current.members)?current.members:[];
            return["media","text","element"].includes(current.type)
              ?[{type:current.type,id:current.id}]
              :[];
          })()
          :[];
        const merged=[];
        const seen=new Set();
        for(const member of [...existing,...hits]){
          const key=`${member.type}:${member.id}`;
          if(seen.has(key))continue;
          seen.add(key);
          merged.push({type:member.type,id:member.id});
        }
        const next=merged.length===0?null:merged.length===1?merged[0]:{type:"multi",members:merged};
        canvasController?.setUiState({selectedEventId:null,advancedSelection:next});
        requestAdvancedDirectSelection(next);
        if(merged.length)announceGlobal(`${merged.length} Timeline ${merged.length===1?"object":"objects"} selected`);
        return;
      }
      if(axisPointer){
        const pending=axisPointer;
        axisPointer=null;
        delete pending.left.dataset.advancedAxisDragging;
        delete pending.right.dataset.advancedAxisDragging;
        pending.left.removeAttribute("transform");
        pending.right.removeAttribute("transform");
        if(event?.type==="pointercancel"||!pending.moved){
          showAdvancedAxisBoundaryHandles();
          return;
        }
        const years=pending.preview.map(({id})=>id).filter((id)=>/^\d{4}$/.test(id));
        if(!years.length)return;
        const range=setAxisPresentationOverride(store.document,{
          startYear:Number(years[0]),
          endYear:Number(years.at(-1)),
          includeFuture:pending.preview.some(({id})=>id==="FUTURE")
        });
        const result=setAxisSegmentWeights(range.document,pending.preview);
        if(result.changed){
          store.replace(result.document,{label:"Resize Timeline year boundary"});
          syncBridgeStateFromStore();
        }
        canvasController?.setUiState({
          selectedEventId:null,detailsEventId:null,
          advancedSelection:{type:"axis",id:"axis"},advancedPanel:"timeline"
        });
        showAdvancedAxisBoundaryHandles();
        bridge.toast("Year widths updated");
        announceGlobal("Year widths updated");
        return;
      }
      if(railPointer){
        const pending=railPointer;
        railPointer=null;
        try{pending.source?.releasePointerCapture?.(pending.pointerId);}catch{}
        pending.ghost.remove();
        clearAdvancedFrameDropTarget();
        if(event?.type==="pointercancel")return;
        const surface=advancedEditSurface();
        const bounds=surface?.getBoundingClientRect?.();
        if(pending.moved&&bounds&&event.clientX>=bounds.left&&event.clientX<=bounds.right&&event.clientY>=bounds.top&&event.clientY<=bounds.bottom){
          const point={
            x:Math.max(0,Math.min(1920,(event.clientX-bounds.left)*1920/bounds.width)),
            y:Math.max(0,Math.min(1080,(event.clientY-bounds.top)*1080/bounds.height))
          };
          /* A media drop over a frame fills the frame instead of placing a free object. */
          const mediaId=pending.payload?.action==="place"&&pending.payload.target?.type==="media"?pending.payload.target.id:"";
          const frame=mediaId?advancedFrameAtPoint(event.clientX,event.clientY):null;
          if(frame){
            fillAdvancedFrame(frame.slot,mediaId);
            return;
          }
          if(mediaId&&(store.document.advanced?.media||[]).find((item)=>String(item.id)===mediaId)?.placed===false){
            commitMediaPlacement(mediaId,point);
            return;
          }
          const inserted=advancedHooks().onAssetDrop(pending.payload,point);
          if(inserted===true)bridge.toast("Added to your timeline");
        }
        return;
      }
      if(!advancedPointer)return;
      if(!canContinueAdvancedGesture(advancedPointer)){cancelAdvancedGesture();return;}
      const pointer=advancedPointer;
      advancedPointer=null;
      clearAdvancedFrameDropTarget();
      clearAdvancedAlignmentGuides(pointer.svg);
      const gestureMembers=pointer.members?.length?pointer.members:[pointer];
      gestureMembers.forEach(({element})=>{
        delete element.dataset.advancedDragging;
        delete element.dataset.advancedResizeHandle;
      });
      clearAdvancedDirectSelection();
      if(event?.type==="pointercancel"){
        if(pointer.members?.length){
          pointer.members.forEach((member)=>{
            if(member.originalTransform==null)member.element.removeAttribute?.("transform");
            else member.element.setAttribute?.("transform",member.originalTransform);
          });
        }else if(pointer.originalTransform==null)pointer.element.removeAttribute?.("transform");
        else pointer.element.setAttribute?.("transform",pointer.originalTransform);
        return;
      }
      if(!pointer.moved){
        if(pointer.deferredGroupedDeep){
          const selection=pointer.deferredGroupedDeep;
          canvasController?.setUiState({selectedEventId:null,advancedSelection:selection,advancedTextEdit:null});
          showAdvancedDirectSelection(selection);
          if(selection.type==="text"){
            const block=(store.document.advanced?.textBlocks||[]).find(
              (item)=>String(item.id)===selection.id
            );
            canvasController?.setUiState({
              selectedEventId:null,
              advancedSelection:selection,
              advancedTextEdit:{id:selection.id,draft:String(block?.text||"")}
            });
            queueMicrotask(()=>{
              const field=canvasHost.querySelector("[data-advanced-inline-text-input]");
              field?.focus?.();
              field?.select?.();
            });
          }
          return;
        }
        if(pointer.type==="event")canvasController?.setUiState({selectedEventId:null,advancedSelection:{type:"event",id:pointer.id}});
        showAdvancedDirectSelection({type:pointer.type,id:pointer.id});
        return;
      }
      if(pointer.type==="media"&&pointer.kind==="move"&&!pointer.members?.length){
        const frame=advancedFrameAtPoint(event.clientX,event.clientY);
        if(frame&&fillAdvancedFrame(frame.slot,pointer.id,{consumePlacement:true}))return;
      }
      const label=pointer.kind==="rotate"?"Rotate Timeline object":pointer.kind==="resize"
        ?"Resize Timeline object"
        :"Move Timeline object";
      let result;
      if(pointer.type==="color-key"){
        result=setColorKeyGeometryPresentationOverride(store.document,pointer.preview);
        const nextKey=furnitureGeometryFor(result.document,"colorKeyGeometry");
        const profile=furnitureGeometryFor(store.document,"profileGeometry");
        if(furnitureOverlaps(nextKey,profile)){
          rejectFurnitureCollision({type:"color-key",id:"color-key"});
          return;
        }
      }else if(pointer.type==="profile"){
        const document=clone(store.document);
        const width=Math.max(360,Math.min(900,Number(pointer.preview.width)||512));
        const height=Math.max(272,Math.min(680,Number(pointer.preview.height)||375));
        document.presentationOverrides={...(document.presentationOverrides||{}),profileGeometry:{
          x:Math.max(0,Math.min(1920-width,Number(pointer.preview.x)||0)),
          y:Math.max(0,Math.min(1080-height,Number(pointer.preview.y)||0)),
          width,height
        }};
        const key=furnitureGeometryFor(store.document,"colorKeyGeometry");
        const nextProfile=furnitureGeometryFor(document,"profileGeometry");
        if(furnitureOverlaps(key,nextProfile)){
          rejectFurnitureCollision({type:"profile",id:"profile"});
          return;
        }
        result={document,changed:true,mutation:{label:"Change profile card presentation"}};
      }else if(pointer.type==="frame"){
        const document=clone(store.document);
        const index=Number(String(pointer.id).replace(/^photo/,""));
        const width=Math.max(60,Math.min(900,Number(pointer.preview.width)||pointer.original.width));
        const height=Math.max(60,Math.min(700,Number(pointer.preview.height)||pointer.original.height));
        document.presentationOverrides={...(document.presentationOverrides||{}),photoFrames:{
          ...((document.presentationOverrides||{}).photoFrames||{}),
          [String(index)]:{
            x:Math.max(0,Math.min(1920-width,Number(pointer.preview.x)||0)),
            y:Math.max(0,Math.min(1080-height,Number(pointer.preview.y)||0)),
            width,height,rotation:Number(pointer.preview.rotation)||0
          }
        }};
        result={document,changed:true,mutation:{label:pointer.kind==="rotate"?"Rotate photo frame":pointer.kind==="resize"?"Resize photo frame":"Move photo frame"}};
      }else{
        /* AAA-019 (Canva T-series): a corner resize on a text box scales the type with the
           box; a side handle only changes the wrap width. Font size follows the width ratio
           and stays inside the free-text range. */
        const cornerTextScale=pointer.type==="text"&&pointer.kind==="resize"&&/^(nw|ne|sw|se)$/.test(String(pointer.handle||""))
          ?Math.max(.1,Number(pointer.preview.width)||1)/Math.max(1,Number(pointer.original.width)||1)
          :null;
        let base=store.document;
        if(cornerTextScale&&Math.abs(cornerTextScale-1)>.01){
          base=clone(store.document);
          const block=(base.advanced?.textBlocks||[]).find((item)=>String(item.id)===String(pointer.id));
          if(block){
            block.size=Math.min(FREE_TEXT_SIZE.max,Math.max(FREE_TEXT_SIZE.min,Math.round((Number(block.size)||24)*cornerTextScale)));
            if(cornerTextScale<1)block.fitMode="auto";
          }
        }
        result=applySceneCommandToDocument(base,{
          kind:"geometry",
          target:{type:pointer.type,id:pointer.id},
          geometry:pointer.preview,
          ...(pointer.type==="event"?{
            create:{
              type:"event",semanticRef:pointer.id,aspectLocked:false,
              presentation:{eventType:store.document.events.find(
                (item)=>String(item.id)===String(pointer.id)
              )?.eventType||"duration"}
            }
          }:{}),
          label
        });
      }
      if(!result.changed)return;
      store.replace(result.document,{label:result.mutation?.label||label});
      syncBridgeStateFromStore();
      canvasController?.setUiState({selectedEventId:null,advancedSelection:{type:pointer.type,id:pointer.id}});
      showAdvancedDirectSelection({type:pointer.type,id:pointer.id});
      const message=pointer.kind==="rotate"?"Timeline object rotated":pointer.kind==="resize"?"Timeline object resized":"Timeline object moved";
      bridge.toast(message);
      announceGlobal(message);
    };
    const railPayload=(event)=>{
      try{
        return JSON.parse(event.dataTransfer?.getData?.("application/x-missionmed-timeline-asset")||"");
      }catch{return null;}
    };
    onAdvancedRailDragOver=(event)=>{
      const payload=railPayload(event);
      if(payload?.kind!=="insert"||store.entitlement.canMutate!==true)return;
      event.preventDefault();
      if(event.dataTransfer)event.dataTransfer.dropEffect="copy";
    };
    onAdvancedRailDrop=(event)=>{
      const payload=railPayload(event);
      if(payload?.kind!=="insert"||store.entitlement.canMutate!==true)return;
      const mediaId=payload.action==="place"&&payload.target?.type==="media"?String(payload.target.id):"";
      const frame=mediaId?advancedFrameAtPoint(event.clientX,event.clientY):null;
      if(frame&&fillAdvancedFrame(frame.slot,mediaId)){event.preventDefault();return;}
      const svg=canvasHost.querySelector('.canvas-application > svg[data-founder-serializer]')||event.target.closest?.("svg")||canvasHost.querySelector("svg");
      const bounds=svg?.getBoundingClientRect?.();
      if(!bounds?.width||!bounds?.height)return;
      event.preventDefault();
      const x=Math.max(0,Math.min(1840,(event.clientX-bounds.left)*1920/bounds.width));
      const y=Math.max(0,Math.min(1000,(event.clientY-bounds.top)*1080/bounds.height));
      /* Only confirm a drop that actually landed. Announcing success for a payload no
         handler accepts is worse than silence: the student believes the asset is there. */
      if(advancedHooks().onAssetDrop(payload,{x,y})===true)bridge.toast("Added to your timeline");
    };
    onAdvancedRailNativeDragStart=(event)=>{
      const tile=event.target.closest?.("[data-advanced-insert-asset]");
      if(!tile||store.entitlement.canMutate!==true)return;
      nativeRailDrag={
        action:String(tile.dataset.advancedAction||"asset"),
        assetKind:String(tile.dataset.advancedKind||"rectangle"),
        symbol:String(tile.dataset.advancedSymbol||"")
      };
    };
    onAdvancedRailNativeDragEnd=(event)=>{
      const pending=nativeRailDrag;
      nativeRailDrag=null;
      if(!pending||event.dataTransfer?.dropEffect!=="none")return;
      const surface=advancedEditSurface();
      const bounds=surface?.getBoundingClientRect?.();
      if(!bounds||event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)return;
      const inserted=advancedHooks().onAssetDrop({kind:"insert",...pending},{
        x:Math.max(0,Math.min(1840,(event.clientX-bounds.left)*1920/bounds.width)),
        y:Math.max(0,Math.min(1000,(event.clientY-bounds.top)*1080/bounds.height))
      });
      if(inserted===true)bridge.toast("Added to your timeline");
    };
    canvasHost.addEventListener("click",onCanvasDetailsClick);
    canvasHost.addEventListener("click",onAdvancedObjectClick);
    canvasHost.addEventListener("keydown",onAdvancedObjectKeyDown);
    document.addEventListener("keydown",onAdvancedSelectionKeyDown);
    canvasHost.addEventListener("d1:canvas-rendered",onAdvancedCanvasRendered);
    document.addEventListener("click",onAdvancedQuickActionClick,true);
    canvasHost.addEventListener("contextmenu",onAdvancedContextMenu,true);
    canvasHost.addEventListener("pointermove",onAdvancedHoverMove);
    canvasHost.addEventListener("pointerleave",onAdvancedHoverLeave);
    canvasHost.addEventListener("d1:canvas-viewport",onAdvancedViewportChange);
    document.addEventListener("scroll",onAdvancedViewportChange,true);
    window.addEventListener("resize",onAdvancedViewportChange);
    // Capture at the document boundary so selection handles (fixed outside the
    // canvas subtree) and SVG objects share one gesture path. Recognized editor
    // gestures stop before the semantic Canvas listener can rewrite chronology.
    document.addEventListener("pointerdown",onAdvancedPointerDown,true);
    document.addEventListener("mousedown",onAdvancedPointerDown,true);
    canvasHost.addEventListener("dragover",onAdvancedRailDragOver);
    canvasHost.addEventListener("drop",onAdvancedRailDrop);
    canvasHost.addEventListener("dragstart",onAdvancedRailNativeDragStart);
    document.addEventListener("dragend",onAdvancedRailNativeDragEnd);
    document.addEventListener("pointermove",onAdvancedPointerMove);
    document.addEventListener("mousemove",onAdvancedPointerMove);
    document.addEventListener("pointerup",onAdvancedPointerUp);
    document.addEventListener("mouseup",onAdvancedPointerUp);
    document.addEventListener("pointercancel",onAdvancedPointerUp);
    onCanvasResize=()=>canvasController?.setResponsiveWidth(window.innerWidth);
    window.addEventListener("resize",onCanvasResize);
    mediaUrls.hydrate(store,store.document,{
      remoteLoader:productionRuntime
        ?(objectId)=>productionRuntime.authClient.downloadPrivateObject(objectId)
        :null,
      onError:(error,{id})=>{
        console.warn("Timeline media hydration omitted one asset",{id,error});
        announceGlobal("One image could not be loaded. The rest of your timeline is fine.");
      }
    })
      .then((changed)=>{
        if(!changed)return;
        canvasController?.render();
        renderHomePreview();
        renderBuilderEmbeddedPreview();
        mountBuilderPreview(document.querySelector("[data-builder-preview-canvas]"),{
          surface:"lightbox",
          namespace:"d1-405-builder-lightbox"
        });
        requestAnimationFrame(onBuilderPreviewResize);
      })
      .catch((error)=>toastStudentError(error,"media"));
  }
  if(document.getElementById("export407F"))renderExportHost();
  if(document.getElementById("advisor407F"))renderAdvisorHost();
  onAdvisorHashChange();
  const intakeHost=document.getElementById("intake407F");
  if(intakeHost){
    const localIntakeAdapter=createD1408PdfIntakeAdapter();
    const intakeAdapter=window.D1_TIMELINE_INTAKE_ADAPTER||(
      productionRuntime&&privateMediaStorageEnabled
        ?createProductionCvIntakeAdapter({
          localAdapter:localIntakeAdapter,
          apiClient:productionRuntime.authClient,
          documentId:store.document.id,
          existingEvents:()=>clone(store.document.events||[]),
          ensureRemoteDocument:ensureRemoteDocumentForMedia
        })
        :localIntakeAdapter
    );
    window.D1_TIMELINE_INTAKE_ADAPTER=intakeAdapter;
    /* intake.js copies a rejection message straight into state.fileError, which renders as
       the red field error under the CV dropzone. That message has to already be student
       language by the time it leaves this adapter, so translate it at the boundary. */
    const studentSafeIntakeAdapter=Object.freeze({
      ...intakeAdapter,
      async extract(input){
        try{
          const result=await intakeAdapter.extract(input);
          /* AAA-019 — no theater: a result that never went near the AI says so, with the
             reason, so the review screen can label it a local document check. */
          if(result&&typeof result==="object"&&result.parser&&!result.parser.intelligenceMode){
            return{...result,parser:{...result.parser,intelligenceMode:"LOCAL_LIMITED",
              fallbackReason:productionRuntime?(privateMediaStorageEnabled?"PROVIDER_UNAVAILABLE":"PRIVATE_MEDIA_DISABLED"):"LOCAL_DEMO_API_DISABLED"}};
          }
          return result;
        }catch(error){
          if(error?.name==="AbortError")throw error;
          const translated=studentError(error,{context:"document"});
          console.warn("Timeline student-facing error",translated.diagnostic,error);
          const safe=new Error(translated.message);
          safe.code=translated.code||"DOCUMENT_UNREADABLE";
          safe.diagnostic=translated.diagnostic;
          throw safe;
        }
      }
    });
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
        const rendered=renderResponsiveAdvancedBoard({
          ...clone(store.document),
          events
        },{
          surface:"intake",
          currentMonth:currentMonth(),
          audience:"EVERYTHING",
          interactive:false
        });
        return`<div class="intake407FBoardPreview">${rendered.html}</div>`;
      }catch{
        return`<div class="intake407FPreviewEmpty"><strong>${events.length} event${events.length===1?"":"s"} ready to preview.</strong><span>The exact board will settle after approval.</span></div>`;
      }
    };
    const renderIntakeHost=(state)=>{
      intakeHost.innerHTML=renderIntake(state,{
        existingEvents:store.document.events,
        renderPreview:renderIntakePreview
      });
      if(state.stage==="upload"){
        const serverReady=!!(productionRuntime&&privateMediaStorageEnabled)||!!window.D1_LOCAL_SYNTHETIC_AI;
        intakeHost.insertAdjacentHTML("beforeend",`<section class="intake-stage intake407FRescue" aria-labelledby="timelineRescueTitle" data-timeline-rescue-entry data-rescue-server="${serverReady?"ready":"unavailable"}">
          <p class="micro407F">I ALREADY HAVE A TIMELINE</p>
          <h2 id="timelineRescueTitle">Made your Timeline in Keynote or PowerPoint before?</h2>
          <p>Upload it to recover the event details we can read. You review each suggestion before adding it to a new MissionMed layout. Photos, notes and original positions are not restored; your original file stays unchanged.</p>
          <label class="btnD alt" for="timelineRescueFile">Upload my existing Timeline</label>
          <input id="timelineRescueFile" type="file" accept=".pptx,.pdf,.png,.jpg,.jpeg,.key,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf,image/png,image/jpeg" data-timeline-rescue-file hidden>
          <p class="micro407F">PowerPoint, PDF, PNG or JPEG. Keynote files: choose the .key file and we'll show you the two-click export.</p>
          ${serverReady?"":'<p class="micro407F" data-rescue-local-note>Rebuilding runs on MissionMed\'s secure server, which this local preview cannot reach — you can still see the entry and the Keynote guidance here.</p>'}
        </section>`);
      }
    };
    /* AAA-019 — one front door for existing Timelines. Called from the Home tile, the
       intake section and the CV dropzone (when the file is obviously a Timeline). */
    const handleTimelineRescueFile=(file)=>{
      if(!file)return;
      const name=String(file.name||"").toLowerCase();
      if(name.endsWith(".key")){
        openIntakeDialog({
          title:"Two clicks in Keynote first",
          body:"Keynote files can't be read directly. In Keynote choose File → Export To → PowerPoint… and upload that file here. Rescue reads event details for your review; photos, notes and original positions are not restored. Keep your original Keynote file for reference and continued editing.",
          primaryLabel:"Got it",secondaryLabel:"Close"
        });
        return;
      }
      if(!window.D1_LOCAL_SYNTHETIC_AI&&(!(productionRuntime&&privateMediaStorageEnabled)||typeof productionRuntime?.authClient?.rescueTimeline!=="function")){
        openIntakeDialog({
          title:"Timeline Rescue needs the MissionMed server",
          body:`Rebuilding ${file.name} runs on MissionMed's secure server, and this local preview can't reach it. Nothing was uploaded. Open Timeline Builder from your Matrix account to rebuild this file — the same button is there.`,
          primaryLabel:"OK",secondaryLabel:"Close"
        });
        return;
      }
      openIntakeDialog({
        title:"Rebuild this Timeline?",
        body:`We'll read ${file.name} for event details and dates. You review each suggestion before adding it to a new MissionMed layout. Photos, notes and original positions are not restored. Your original file stays unchanged.`,
        primaryLabel:"Rebuild it",secondaryLabel:"Cancel",
        onPrimary:()=>{
          Object.defineProperty(file,"timelineRescue",{value:true,configurable:true});
          intakeMachine.receiveFile(file);
          intakeMachine.setConsent(true);
          intakeMachine.startExtraction().catch((error)=>toastStudentError(error,"document"));
        }
      });
    };
    const looksLikeTimelineFile=(file)=>{
      const name=String(file?.name||"").toLowerCase();
      const type=String(file?.type||"").toLowerCase();
      if(/\.(pptx|key|png|jpe?g)$/.test(name))return true;
      if(type.startsWith("image/")||type.includes("presentationml"))return true;
      return false;
    };
    const maybeTimelineFile=(file)=>/timeline|slide|keynote/i.test(String(file?.name||""))&&/\.pdf$/i.test(String(file?.name||""));
    const openIntakeDialog=(dialog)=>{
      if(typeof bridge.openModal!=="function")return;
      openStandardModal(`<section class="intake407FDialog" role="dialog" aria-modal="true" aria-labelledby="intake407FDialogTitle">
        <h2 id="intake407FDialogTitle">${escapeMarkup(dialog.title)}</h2>
        <p>${escapeMarkup(dialog.body)}</p>
        <div>
          <button type="button" class="btnD alt" data-intake-dialog-secondary>${escapeMarkup(dialog.secondaryLabel||"Cancel")}</button>
          <button type="button" class="btnD go" data-intake-dialog-primary>${escapeMarkup(dialog.primaryLabel||"Continue")}</button>
        </div>
      </section>`,".intake407FDialog");
      document.querySelector("[data-intake-dialog-secondary]")?.addEventListener("click",()=>{
        closeStandardModal();
        dialog.onSecondary?.();
      },{once:true});
      document.querySelector("[data-intake-dialog-primary]")?.addEventListener("click",()=>{
        closeStandardModal();
        dialog.onPrimary?.();
      },{once:true});
    };
    intakeMachine=new IntakeStateMachine({
      adapter:studentSafeIntakeAdapter,
      initialState:store.document.intake,
      existingEvents:store.document.events
    });
    intakeHost.addEventListener("change",(event)=>{
      const input=event.target?.closest?.("[data-timeline-rescue-file]");
      const file=input?.files?.[0];
      if(!file)return;
      input.value="";
      handleTimelineRescueFile(file);
    });
    /* Unified classification: a slide deck or an image dropped on the CV dropzone is a
       Timeline, not a CV — route it before the CV wizard rejects it; a PDF that looks like
       one asks instead of guessing. */
    intakeHost.addEventListener("change",(event)=>{
      const input=event.target?.matches?.("[data-intake-file]")?event.target:null;
      const file=input?.files?.[0];
      if(!file)return;
      if(looksLikeTimelineFile(file)){
        event.stopImmediatePropagation();
        input.value="";
        handleTimelineRescueFile(file);
        return;
      }
      if(maybeTimelineFile(file)){
        event.stopImmediatePropagation();
        input.value="";
        openIntakeDialog({
          title:"Is this your CV, or a Timeline you made before?",
          body:`${file.name} looks like it could be either. Choose how we should read it.`,
          primaryLabel:"It's a Timeline",secondaryLabel:"It's my CV",
          onPrimary:()=>handleTimelineRescueFile(file),
          onSecondary:()=>intakeMachine.receiveFile(file)
        });
      }
    },true);
    document.getElementById("homeRescueFile")?.addEventListener("change",(event)=>{
      const file=event.target?.files?.[0];
      if(!file)return;
      event.target.value="";
      bridge.go("intake");
      setTimeout(()=>handleTimelineRescueFile(file),60);
    });
    let initialIntakeNotification022=true;
    intakeCleanup=installIntake(intakeHost,intakeMachine,{
      onChange:(state)=>{
        const initial=initialIntakeNotification022;
        initialIntakeNotification022=false;
        renderIntakeHost(state);
        if(state.stage==="upload")intakeMachine.existingEvents=clone(store.document.events||[]);
        if(!initial&&store.entitlement.canMutate===true){
          store.mutate("Update Intake flow",(document)=>{
            document.intake=persistedIntakeState(state,document.intake);
          },{history:false,material:false});
        }
        bridge.state.intake=persistedIntakeState(state);
        bridge.renderAll();
      },
      /* AAA-019 — the intake wizard speaks the UXR route vocabulary ("home"), while the
         live shell's Home section is `command`. Cancelling or finishing an upload used to
         call go("home"), which matched no section and left a blank screen — the "wizard
         locks on DONE" a student experienced. Translate every intake route here. */
      onNavigate:(route)=>{
        if(route==="quality-check"){
          bridge.go("canvas");
          setTimeout(()=>{void openQualityGuardian407F("DURING_BUILDING");},80);
          return;
        }
        bridge.go({home:"command",builder:"builder",canvas:"canvas",media:"media",export:"export",intake:"intake"}[String(route||"")]||"command");
      },
      onToast:(message)=>bridge.toast(studentMessage(message,{context:"document"})),
      onError:(error)=>toastStudentError(error,"document"),
      openDialog:openIntakeDialog,
      saveVersion:(name,kind)=>store.saveVersion(name,kind),
      applyBatch:async(batch,contract)=>{
        let result=null;
        const feedbackState=intakeMachine.snapshot();
        store.mutate(contract?.label||"Add document suggestions",(document)=>{
          result=applyApprovalBatchToDocument(document,batch);
          const feedbackParser=feedbackState?.extraction?.parser||feedbackState?.parser||null;
          if(feedbackParser?.intelligenceMode==="SERVER_AI"){
            const candidates=new Map((feedbackState.candidates||[]).map((candidate)=>[String(candidate.id),candidate]));
            for(const decision of batch.candidateDecisions||[]){
              if(["undecided","rejected"].includes(decision.decision))continue;
              const candidate=candidates.get(String(decision.id));
              if(!candidate)continue;
              const outcome=classifyTimelineAiCandidateOutcome(candidate,decision.decision);
              const confidence=Number(candidate.confidence?.score??candidate.confidence??0);
              appendTimelineAiFeedback(document,{
                workflow:feedbackParser.detectedType==="TIMELINE_RESCUE"
                  ?"TIMELINE_RESCUE"
                  :"CV_SMART_FILL",
                workflowVersion:String(feedbackParser.promptVersion||feedbackParser.schemaVersion||"d1-timeline-cv-ai.1"),
                modelVersion:String(feedbackParser.model||"unknown-model"),
                suggestionId:String(candidate.id),
                suggestionType:String(candidate.fields?.canonicalType||candidate.canonicalType||candidate.type||"TIMELINE_EVENT"),
                confidence:Number.isFinite(confidence)?Math.max(0,Math.min(1,confidence>1?confidence/100:confidence)):0,
                outcome,
                correctedCategory:outcome==="MODIFIED"?String(candidate.categoryId||"")||null:null,
                correctedStartDate:outcome==="MODIFIED"?candidate.startDate||null:null,
                correctedEndDate:outcome==="MODIFIED"?candidate.endDate||null:null,
                actorKind:qualityGuardianViewer(store.entitlement,bridge.state.view).startsWith("Founder")?"FOUNDER":"STUDENT",
                finalCanonicalReference:`candidate:${candidate.id}@document:${document.id}:revision:${Number(document.revision||0)+1}`
              });
            }
          }
        });
        syncBridgeFromStore();
        return result;
      },
      onCandidateDecision:async({candidate,decision,state})=>{
        const feedbackParser=state?.extraction?.parser||null;
        if(decision!=="rejected"||!candidate||feedbackParser?.intelligenceMode!=="SERVER_AI")return;
        store.mutate("Record rejected AI suggestion",(document)=>{
          const confidence=Number(candidate.confidence?.score??candidate.confidence??0);
          appendTimelineAiFeedback(document,{
            workflow:feedbackParser.detectedType==="TIMELINE_RESCUE"?"TIMELINE_RESCUE":"CV_SMART_FILL",
            workflowVersion:String(feedbackParser.promptVersion||feedbackParser.schemaVersion||"d1-timeline-cv-ai.1"),
            modelVersion:String(feedbackParser.model||"unknown-model"),
            suggestionId:String(candidate.id),
            suggestionType:String(candidate.fields?.canonicalType||candidate.canonicalType||"TIMELINE_EVENT"),
            confidence:Number.isFinite(confidence)?Math.max(0,Math.min(1,confidence>1?confidence/100:confidence)):0,
            outcome:"REJECTED",
            actorKind:qualityGuardianViewer(store.entitlement,bridge.state.view).startsWith("Founder")?"FOUNDER":"STUDENT",
            finalCanonicalReference:`candidate:${candidate.id}@document:${document.id}:revision:${Number(document.revision||0)}`
          });
        },{history:false,material:false});
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
    const message=`${direction==="undo"?"Undid":"Redid"} ${entry.label}`;
    applying=true;
    applyDocumentTo407FState(store.document,bridge.state);
    bridge.renderAll();
    canvasController?.setUiState({liveAnnouncement:message});
    reflectStoreStatus();
    lastState=stableState(bridge.state);
    applying=false;
    announceGlobal(message);
    hydrateMissingAdvancedMedia();
    return entry;
  };
  api.undo=()=>applyHistory("undo");
  api.redo=()=>applyHistory("redo");

  const closeOwnedModal=()=>{
    if(builderPreviewTrap){
      closeBuilderPreview();
      return true;
    }
    if(standardModalTrap){
      closeStandardModal();
      return true;
    }
    const handled=Boolean(shortcutTrap||fileVaultTrap||document.getElementById("modalBk")?.classList.contains("on"));
    if(!handled)return false;
    shortcutTrap?.destroy();
    shortcutTrap=null;
    fileVaultTrap?.destroy();
    fileVaultTrap=null;
    bridge.closeModal?.();
    return true;
  };
  // The earlier inline Escape listener must use the owner's focus/inert cleanup.
  api.closeModal=closeOwnedModal;
  const fileVaultSource=resolveFileVaultSourceAdapter(
    window.MISSIONMED_FILEVAULT_SOURCE_ADAPTER
  );
  let fileVaultQuerySequence=0;
  const openFileVaultSource=async(query="",page=1)=>{
    const sequence=++fileVaultQuerySequence;
    const model=await queryFileVaultSource(fileVaultSource,{query,page});
    if(sequence!==fileVaultQuerySequence)return;
    bridge.openModal?.(renderFileVaultSourceChooser(model));
    const dialog=document.querySelector("[data-file-vault-source-dialog]");
    attachSelectedSubjectDialog022(dialog,{runtime:productionRuntime,document:store.document});
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
    dialog?.querySelectorAll('[data-file-vault-page]').forEach(button=>button.addEventListener('click',()=>openFileVaultSource(query,Number(button.dataset.fileVaultPage)).catch(error=>toastStudentError(error,'document'))));
    continueButton?.addEventListener("click",async()=>{
      const selected=document.querySelector('input[name="file-vault-source"]:checked');
      if(!selected)return;
      try{
        await ensureRemoteDocumentForMedia();
        const imported=await selectFileVaultSourceDocument(fileVaultSource,selected.value,{
          timelineDocumentId:store.document.id,
          versionId:String(selected.dataset.fileVaultVersion||"")
        });
        if(!imported.file||!intakeMachine)throw new Error("Timeline could not open that File Vault document for Smart Fill.");
        intakeMachine.receiveFile(imported.file);
        closeOwnedModal();
        bridge.go("intake");
        bridge.toast("File Vault document ready for your review");
      }catch(error){
        toastStudentError(error,"document");
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
    toastStudentError(error,"document");
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
        bridge.toast(entitlementStudentReason(),{tone:"warning",diagnostic:store.entitlement.reason});
        return;
      }
      (event.shiftKey?api.redo:api.undo)();
      return;
    }
    if(command&&lower==="e"){
      event.preventDefault();
      openQualityGuardian407F("BEFORE_EXPORT");
      announceGlobal("Opened Quality Check before Export");
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
    attachSelectedSubjectDialog022(dialog,{runtime:productionRuntime,document:store.document});
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
        onEscape:()=>closeBuilderPreview()
      });
    }
  };
  document.getElementById("builderPreviewToggle")?.addEventListener("click",onBuilderPreview);

  onRouteRendered=()=>{
    const active=document.querySelector("section[data-view].live");
    if(!active)return;
    const view=String(active.dataset.view||"");
    if(view==="builder"){
      renderM9BuilderSurfaces();
      requestAnimationFrame(()=>requestAnimationFrame(
        ()=>updateBuilderPreviewHitTargets(document.getElementById("boardWizard"))
      ));
    }
    if(view==="canvas"){
      renderCanvasResponsiveNotice();
      requestAnimationFrame(()=>requestAnimationFrame(
        ()=>canvasController?.refreshEffectiveHitTargets?.()
      ));
    }
    if(!["builder","canvas"].includes(view))closeMediaLibrary();
    if(["builder","canvas","media"].includes(view))renderMediaLibrarySurfaces();
    if(view==="command"&&productionRuntime){
      installProductionPrivacyControl(productionRuntime.identity);
    }
    if(view===lastFocusedView)return;
    cancelAnimationFrame(routeFocusFrame);
    routeFocusFrame=requestAnimationFrame(()=>{
      const settled=document.querySelector("section[data-view].live");
      if(!settled||String(settled.dataset.view||"")!==view)return;
      const result=focusScreenHeading(settled,{
        previousViewKey:lastFocusedView,
        nextViewKey:view
      });
      if(result.focused)lastFocusedView=view;
    });
  };
  document.addEventListener("d1:407f-rendered",onRouteRendered);

  responsiveRuntime=installResponsiveRuntime({
    windowObject:window,
    documentObject:document,
    target:document.documentElement,
    onChange:(model)=>{
      api.responsive=model;
      canvasController?.setResponsiveWidth(model.viewport.width);
      renderCanvasResponsiveNotice();
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

  const matrixAppMode=runtimeMode==="production"
    ?installProductionMatrixReturn({store,productionRuntime})
    :installLocalMatrixAppMode({store});
  window.D1_407F_ENGINEERING=api;
  api.familyRuntime=installFamilyRuntime022({runtime:productionRuntime,store,bridge,recoverSave:async()=>{
    try{
      if(store.adapter?.getSyncStatus?.().state!=="CONFLICT"){
        await store.saveNow("RETRY_SAVE");
        await store.adapter?.flush?.();
      }
      if(store.adapter?.getSyncStatus?.().state==="CONFLICT")await openSyncConflictRecovery();
    }catch(error){
      toastStudentError(error,"save");
    }
  }});
  bridge.renderAll();
  // Rehydration/render projections are the baseline, not a student edit.
  lastState=stableState(bridge.state);
  booting=false;
  document.documentElement.classList.remove("d1-hydrating");
  document.dispatchEvent(new CustomEvent("d1:407f-engineering-ready",{
    detail:{
      documentId:store.document.id,
      restored:init.restored,
      adapter:store.adapter.kind,
      mode:matrixAppMode?.mode||"DIRECT_WEB"
    }
  }));
  return api;
}

if(typeof window!=="undefined"){
  boot407FEngineeringAdapter().catch((error)=>{
    console.error("407F engineering adapter failed",error);
    const gate=document.getElementById("d1HydrationGate");
    if(gate){
      gate.textContent="";
      gate.classList.add("d1Recovery");
      const panel=document.createElement("section");
      panel.className="d1RecoveryPanel";
      panel.setAttribute("role","alert");
      const eyebrow=document.createElement("p");
      eyebrow.className="d1RecoveryEyebrow";
      eyebrow.textContent="MissionMed Timeline Builder";
      const title=document.createElement("h1");
      title.textContent="Your Timeline needs a fresh connection.";
      const detail=document.createElement("p");
      detail.textContent="Your work on this device is still safe. Try again, or return to Matrix and reopen Timeline Builder.";
      const actions=document.createElement("div");
      actions.className="d1RecoveryActions";
      const retry=document.createElement("button");
      retry.type="button";
      retry.textContent="Retry";
      retry.addEventListener("click",()=>window.location.reload(),{once:true});
      const back=document.createElement("a");
      back.href=new URL("/member-dashboard/",window.location.origin).href;
      back.textContent="Return to Matrix";
      actions.append(retry,back);
      panel.append(eyebrow,title,detail,actions);
      gate.append(panel);
      gate.dataset.errorCode=String(error?.code||"TIMELINE_BOOTSTRAP_FAILED");
      gate.dataset.diagnostic=studentDiagnostic(error);
    }
    document.dispatchEvent(new CustomEvent("d1:407f-engineering-error",{
      detail:{message:studentMessage(error,{context:"open"}),diagnostic:studentDiagnostic(error)}
    }));
  });
}
