import {resolveFounderPresentationSvg,materialPresentationCollisions} from './resolved-founder-presentation.js';
import {presentationDateWording} from './source-date-wording.js';
import {buildKeynoteClassicScene} from "../uxr-002/board-renderer.js";
import {CATEGORY_DEFINITIONS,restoreFounderYearAllocation} from "../uxr-002/adaptive-layout.js";
import {serializeLocked407FPortableSvg,composeLocked407FPortableSvg} from "../uxr-002/locked-407f-export.js";
import {DEFAULT_THEME_ID,applyThemeToScene} from "../uxr-002/themes.js";
import {reconcileAdvancedScene,validateSceneGraph} from "../editor/scene-graph.js";
import {projectPresentationFields,projectPresentationEventFields} from './presentation-field-privacy.js';
import {projectPresentationExamEvents} from './presentation-exam-display.js';
import {
  FOUNDER_COLOR_KEY_ROWS,
  FOUNDER_KEYNOTE_CONTRACT,
  FOUNDER_PRESENTATION_DEFAULTS,
  founderContractAttributes
} from "./founder-keynote-contract.js";

export const FOUNDER_PRESENTATION_SERIALIZER=
  "d1-founder-keynote-portable-svg/1";

// Locked 2025 grammar, measured from the audience-projected native paint.
// A connector may touch the ribbon; pennants, dates and adjacent labels must
// remain above it. Only a real attempt flag attached to its study arrow is
// exempt. Exam category/wording alone never grants that exception.
export const FOUNDER_MILESTONE_RIBBON_TOP=125;
export const FOUNDER_RIBBON_BOTTOM=FOUNDER_MILESTONE_RIBBON_TOP+36;
export function founderMilestoneTemplateGeometry(scene,paint){
  return (scene.flags||[]).map(flag=>{
    const eventId=String(flag.id),nodes=paint.nodes.filter(node=>node.groupId==='event:'+eventId);
    const study=flag.categoryId==='exams'&&flag.examAttemptId&&
      (scene.arrows||[]).find(arrow=>arrow.study&&arrow.examAttemptId===flag.examAttemptId);
    const attachment=study&&paint.nodes.find(node=>node.semanticRef===String(study.id)&&node.sourceAttributes['data-continuous-duration-arrow']);
    const studyObject=study&&(scene.founderPresentation?.advancedScene?.objects||[]).find(object=>object.type==='event'&&String(object.semanticRef||object.id)===String(study.id));
    // Automatic study geometry is its shaft box; authored geometry is the full
    // native paint box. Match the existing renderer's attachment convention.
    const attachmentY=studyObject?.geometry?Math.floor(Number(studyObject.geometry.y)*64)/64:attachment?.commands?.[0]?.y??null;
    const pole=nodes.find(node=>node.kind==='path'&&node.lineOnly);
    const body=nodes.filter(node=>node.bounds&&Number(node.style.opacity??1)>0&&Number(node.style['fill-opacity']??1)>0&&
      node.sourceAttributes.visibility!=='hidden'&&node.sourceAttributes.display!=='none'&&
      !(node.kind==='path'&&(node.lineOnly||node.style.fill==='none'||node.bounds.width<1||node.bounds.height<1)));
    const bottom=node=>{
      const b=node.occlusionBounds||node.bounds,angle=(b.rotation||0)*Math.PI/180;
      return b.y+b.height/2+Math.abs(b.width/2*Math.sin(angle))+Math.abs(b.height/2*Math.cos(angle));
    };
    const top=node=>{const b=node.occlusionBounds||node.bounds;return 2*(b.y+b.height/2)-bottom(node);};
    return {eventId,kind:study?'EXAM_RESULT':'MILESTONE',poleFootY:pole?.commands?.at(-1)?.y??null,attachmentY,
      bodyTop:body.length?Math.min(...body.map(top)):-Infinity,bodyBottom:body.length?Math.max(...body.map(bottom)):Infinity};
  });
}

// Duration captions, full labels and institutions share their native arrow's
// below-ribbon grammar. Connector strokes are excluded from the body envelope.
export function founderDurationTemplateGeometry(scene,paint){
  return (scene.arrows||[]).map(arrow=>{
    const eventId=String(arrow.id),nodes=paint.nodes.filter(node=>node.groupId==='event:'+eventId&&node.bounds&&
      Number(node.style.opacity??1)>0&&Number(node.style['fill-opacity']??1)>0&&node.sourceAttributes.visibility!=='hidden'&&node.sourceAttributes.display!=='none'&&
      !(node.kind==='path'&&(node.lineOnly||node.style.fill==='none'||node.bounds.width<1||node.bounds.height<1)));
    const top=node=>{const b=node.occlusionBounds||node.bounds,angle=(b.rotation||0)*Math.PI/180;return b.y+b.height/2-Math.abs(b.width/2*Math.sin(angle))-Math.abs(b.height/2*Math.cos(angle));};
    return {eventId,kind:'DURATION',bodyTop:nodes.length?Math.min(...nodes.map(top)):-Infinity};
  });
}
export function violatesFounderTemplateBand(target){
  if(target.kind==='MILESTONE')return target.bodyBottom>FOUNDER_MILESTONE_RIBBON_TOP+.04||target.poleFootY===null||Math.abs(target.poleFootY-FOUNDER_MILESTONE_RIBBON_TOP)>.04;
  if(target.kind==='EXAM_RESULT')return target.bodyTop<FOUNDER_RIBBON_BOTTOM-.04||target.attachmentY===null||target.poleFootY===null||Math.abs(target.poleFootY-target.attachmentY)>.04;
  return target.kind==='DURATION'&&target.bodyTop<FOUNDER_RIBBON_BOTTOM-.04;
}

const VISIBLE_BY_SCOPE=Object.freeze({
  INTERVIEWER_SAFE:new Set(["INTERVIEWER_SAFE"]),
  PRINT:new Set(["INTERVIEWER_SAFE"]),
  ACCESSIBLE:new Set(["INTERVIEWER_SAFE"]),
  FULL_STORY:new Set(["INTERVIEWER_SAFE","FULL_STORY"]),
  ADVISOR_PACKET:new Set(["INTERVIEWER_SAFE","FULL_STORY","ADVISOR_ONLY"]),
  STUDENT:new Set(["INTERVIEWER_SAFE","FULL_STORY","ADVISOR_ONLY","STUDENT_ONLY"]),
  EVERYTHING:new Set(["INTERVIEWER_SAFE","FULL_STORY","ADVISOR_ONLY","STUDENT_ONLY"]),
  LOR_WRITER:new Set(["INTERVIEWER_SAFE","FULL_STORY","ADVISOR_ONLY"])
});

export function normalizePresentationVisibility(value){
  const normalized=String(value||"INTERVIEWER_SAFE").trim().toUpperCase();
  if(normalized==="VISIBLE"||normalized==="SAFE")return"INTERVIEWER_SAFE";
  if(normalized==="ADVISOR")return"ADVISOR_ONLY";
  if(normalized==="STUDENT")return"STUDENT_ONLY";
  if(normalized==="FULL")return"FULL_STORY";
  return normalized;
}

function validMonth(value){
  const match=/^(\d{4})-(\d{2})/.exec(String(value||""));
  if(!match)return null;
  const month=Number(match[2]);
  return month>=1&&month<=12?`${match[1]}-${match[2]}`:null;
}

export function presentationCurrentMonth(document,explicit=null,now=new Date()){
  const configured=validMonth(
    explicit||
    document?.metadata?.renderCurrentMonth||
    document?.metadata?.presentationCurrentMonth
  );
  if(configured)return configured;
  if((document?.events||[]).some((event)=>event?.openEnded||event?.ongoing)){
    return`${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,"0")}`;
  }
  const candidates=[
    document?.metadata?.interview?.date,
    document?.studentProfile?.interviewSeason,
    ...(document?.events||[]).flatMap((event)=>[event?.startDate,event?.endDate])
  ].map(validMonth).filter(Boolean).sort();
  return candidates.at(-1)||
    `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,"0")}`;
}

export function projectFounderPresentationDocument(document,{scope="INTERVIEWER_SAFE"}={}){
  if(!document||typeof document!=="object"){
    throw new TypeError("A Timeline document is required for Founder presentation rendering.");
  }
  const normalizedScope=String(scope||"INTERVIEWER_SAFE").toUpperCase();
  const allowed=VISIBLE_BY_SCOPE[normalizedScope]||VISIBLE_BY_SCOPE.INTERVIEWER_SAFE;
  const events=projectPresentationExamEvents(document).filter(event=>allowed.has(normalizePresentationVisibility(event?.visibilityState||event?.visibility)));
  const visibleEventIds=new Set(events.map(event=>String(event.id)));
  const fields=projectPresentationFields(document,{allowed,visibleEventIds});
  return{
    ...document,
    theme:document.theme||FOUNDER_PRESENTATION_DEFAULTS.theme,
    studentProfile:fields.studentProfile,
    events:projectPresentationEventFields(events,fields),
    exams:fields.exams,
    mediaItems:(document.mediaItems||[]).filter((item)=>allowed.has(
      normalizePresentationVisibility(item?.visibilityState||item?.visibility)
    )),
    metadata:{...(document.metadata||{})}
  };
}

function directMediaSource(item){
  const candidates=[
    item?.resolvedUrl,
    item?.durableUrl,
    item?.downloadUrl,
    item?.objectUrl,
    item?.previewDataUrl,
    item?.url,
    item?.src
  ];
  return candidates.find((value)=>typeof value==="string"&&value.length>0)||null;
}

function mediaRole(item){
  const type=String(item?.type||"").toLowerCase();
  const placement=String(item?.placement||"").toLowerCase();
  if(type==="profilephoto"||placement==="profile")return"profile";
  if(type==="logo"||type==="programlogo"||placement==="ribbon")return"logo";
  if(type==="photo"||type==="personalimage"||placement.startsWith("photo"))return"photo";
  return null;
}

function photoOrder(item,index){
  const match=/photo(\d+)/i.exec(String(item?.placement||""));
  return match?Number(match[1]):Number.isFinite(Number(item?.slot))?Number(item.slot):index;
}

function mediaProjection(document,resolvedById=new Map()){
  const projected={profilePhoto:null,logo:null,photos:[],expectedIds:[],pendingIds:[]};
  (document.mediaItems||[]).forEach((item,index)=>{
    const role=mediaRole(item);
    if(!role)return;
    projected.expectedIds.push(String(item.id||`${role}-${index}`));
    const source=resolvedById.get(String(item.id))||directMediaSource(item);
    if(!source){projected.pendingIds.push(String(item.id||`${role}-${index}`));return;}
    const record={
      id:String(item.id||`${role}-${index}`),
      source,
      altText:String(item.altText||item.caption||""),
      crop:item.crop&&typeof item.crop==="object"?{...item.crop}:null,
      order:photoOrder(item,index),
      slot:String(item.placement||"").toLowerCase(),
      naturalAspect:Number(item.naturalAspect)>0?Number(item.naturalAspect):null
    };
    if(role==="profile"&&!projected.profilePhoto)projected.profilePhoto=record;
    else if(role==="logo"&&!projected.logo)projected.logo=record;
    else if(role==="photo")projected.photos.push(record);
  });
  projected.photos.sort((left,right)=>left.order-right.order);
  return projected;
}

function advancedProjection(document,resolvedById=new Map()){
  const background=document?.advanced?.background;
  const headlineTypography=document?.advanced?.headlineTypography&&
    typeof document.advanced.headlineTypography==="object"
    ?{...document.advanced.headlineTypography}
    :null;
  if(!background||background.kind==="theme"){
    return headlineTypography?{headlineTypography}:null;
  }
  if(background.kind==="color"&&background.color){
    return{background:{kind:"color",color:String(background.color)},...(headlineTypography?{headlineTypography}:{})};
  }
  if(background.kind==="preset"&&background.css){
    return{background:{kind:"preset",css:String(background.css)},...(headlineTypography?{headlineTypography}:{})};
  }
  const source=resolvedById.get(String(background.mediaId||""))||
    background.resolvedUrl||background.durableUrl||background.objectUrl||null;
  if(background.kind==="upload"&&source){
    const dim=Math.max(0,Math.min(100,Number(background.dim)||0))/100;
    const scrim=String(background.scrim||"black").toLowerCase()==="white"?255:0;
    return{
      background:{
        kind:"upload",
        resolvedUrl:source,
        scrimCss:`rgba(${scrim},${scrim},${scrim},${dim})`
      },
      ...(headlineTypography?{headlineTypography}:{})
    };
  }
  return headlineTypography?{headlineTypography}:null;
}

function finite(value,fallback){
  const number=Number(value);
  return Number.isFinite(number)?number:fallback;
}

function boundedGeometry(value,fallback){
  if(!value||typeof value!=="object")return{...fallback};
  const width=Math.min(1920,Math.max(1,finite(value.width,fallback.width)));
  const height=Math.min(1080,Math.max(1,finite(value.height,fallback.height)));
  return{
    x:Math.min(1920-width,Math.max(0,finite(value.x,fallback.x))),
    y:Math.min(1080-height,Math.max(0,finite(value.y,fallback.y))),
    width,
    height
  };
}

function founderAxisProjection(document){
  const value=document?.presentationOverrides?.axis;
  if(value?.mode!=="manual")return null;
  const startYear=Number(value.startYear),endYear=Number(value.endYear);
  if(!Number.isInteger(startYear)||!Number.isInteger(endYear)||
    startYear<1900||endYear>2200||startYear>endYear||endYear-startYear>30)return null;
  const ids=[];
  for(let year=startYear;year<=endYear;year+=1)ids.push(String(year));
  if(value.includeFuture!==false)ids.push("FUTURE");
  const weights=Array.isArray(value.segmentWeights)&&value.segmentWeights.length===ids.length
    ?value.segmentWeights.map((item,index)=>({id:String(item?.id||""),weight:Number(item?.weight)}))
    :null;
  return{
    mode:"manual",startYear,endYear,includeFuture:value.includeFuture!==false,
    segmentWeights:weights&&weights.every((item,index)=>
      item.id===ids[index]&&Number.isFinite(item.weight)&&item.weight>=.25&&item.weight<=8
    )?weights:ids.map((id)=>({id,weight:1}))
  };
}

function founderCategoryKeyProjection(document,scene){
  const explicit=new Map((Array.isArray(document?.presentationOverrides?.categoryKey)
    ?document.presentationOverrides.categoryKey:[]).map((item)=>[String(item?.id||""),item]));
  // Approved G4: education is a degree milestone/profile span, never a seventh key row.
  const defaults=[...FOUNDER_COLOR_KEY_ROWS];
  return defaults.map((fallback,index)=>{
    const value=explicit.get(fallback.id)||fallback;
    const color=/^#[0-9a-f]{6}$/i.test(String(value.color||""))
      ?String(value.color).toUpperCase():fallback.color;
    return{
      id:fallback.id,
      order:index,
      label:String(value.label||fallback.label).trim().slice(0,32)||fallback.label,
      color
    };
  });
}

function advancedSceneProjection(document,resolvedById=new Map()){
  if(!document?.advanced||typeof document.advanced!=="object")return null;
  const scene=reconcileAdvancedScene(document.advanced,{revision:document.revision});
  const validity=validateSceneGraph(scene);
  if(!validity.valid){
    const error=new TypeError('Your saved layout needs recovery before it can be displayed or exported.');
    error.code='TIMELINE_SCENE_RECOVERY_REQUIRED';error.details=validity.errors;throw error;
  }
  const legacyMedia=new Map((document.advanced.media||[]).map((item)=>[String(item?.id||""),item]));
  return{
    ...scene,
    objects:scene.objects.filter(object=>object.type!=='media'||legacyMedia.get(String(object.id))?.placed!==false).map((object)=>{
      if(object.type!=="media")return object;
      const legacy=legacyMedia.get(String(object.id));
      const source=resolvedById.get(String(object.id))||
        directMediaSource(legacy?.source)||directMediaSource(legacy)||
        directMediaSource(object.presentation?.source)||directMediaSource(object.presentation);
      return{
        ...object,
        presentation:{...object.presentation,...(source?{resolvedSource:source}:{})}
      };
    })
  };
}

function founderPresentationProjection(document,resolvedById,scene){
  return Object.freeze({
    axis:founderAxisProjection(document),
    categoryKey:Object.freeze(founderCategoryKeyProjection(document,scene).map(Object.freeze)),
    colorKeyGeometry:Object.freeze(boundedGeometry(
      document?.presentationOverrides?.colorKeyGeometry,
      {x:20,y:300,width:284,height:346}
    )),
    profileGeometryExplicit:!!document?.presentationOverrides?.profileGeometry,
    profileGeometry:Object.freeze(boundedGeometry(
      document?.presentationOverrides?.profileGeometry,
      {x:13,y:661,width:545,height:410}
    )),
    photoFrames:Object.freeze(Object.fromEntries(Object.entries(
      document?.presentationOverrides?.photoFrames&&typeof document.presentationOverrides.photoFrames==="object"
        ?document.presentationOverrides.photoFrames:{}
    ).map(([slot,geometry])=>[String(slot),Object.freeze({...(geometry||{})})]))),
    advancedScene:advancedSceneProjection(document,resolvedById)
  });
}

function injectRootAttributes(svg,attributes){
  const serialized=Object.entries(attributes).map(([key,value])=>
    `${key}="${String(value).replace(/[&<>"]/g,(character)=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"
    })[character])}"`
  ).join(" ");
  return svg.replace("<svg ",`<svg ${serialized} `);
}

export function serializeFounderScene(scene,{layers="",resourceNamespace=""}={}){
  const svg=serializeLocked407FPortableSvg(restoreFounderYearAllocation(scene),{layers,resourceNamespace});
  return injectRootAttributes(svg,{
    ...founderContractAttributes(),
    "data-founder-serializer":FOUNDER_PRESENTATION_SERIALIZER,
    "data-founder-default-background":FOUNDER_PRESENTATION_DEFAULTS.background,
    "data-founder-canvas":"1920x1080"
  });
}

// The profile paper summarizes qualifications; education stays in the model
// and review even when a uniquely source-matched primary span is selected.
const normalizedProfileEducation=value=>String(value||'').replace(/\s+/g,' ').trim();
function primaryProfileEducation(profile,records){
  const school=normalizedProfileEducation(profile.medicalSchool);
  if(!school)return null;
  const matches=records.filter(record=>normalizedProfileEducation(record.school)===school);
  if(matches.length!==1)return null;
  const primary=matches[0];
  return primary.startDate&&primary.endDate&&!primary.openEnded&&
    !Object.values(primary.datePrecision||{}).includes('UNKNOWN')&&
    ![primary.sourceDateWording?.start?.precision,primary.sourceDateWording?.end?.precision].includes('UNKNOWN')?primary:null;
}
function selectConciseProfileEducation(scene,document){
  const records=scene.profile?.educationRecords||[];
  const primary=document?.presentationOverrides?.profileGeometry?null:primaryProfileEducation(scene.profile,records);
  const selected=primary?[primary]:records;
  const excluded=primary?records.filter(record=>record!==primary).map(record=>({
    eventId:record.eventId,reason:'additional-education-retained-for-review',
    primaryEventId:primary.eventId,record:structuredClone(record)
  })):[];
  scene.profile={...scene.profile,sourceEducationRecords:structuredClone(records),educationRecords:selected};
  scene.profileDisplay={...scene.profileDisplay,educationPolicy:'concise-source-matched-primary',
    primaryEducationEventId:primary?.eventId||null,educationEventIds:selected.map(record=>record.eventId),excludedEducationRecords:excluded};
  // A duplicate profile field can only be covered by a span still painted.
  const exclusions=scene.profileDisplay.excludedFields||[];
  const noLongerCovered=exclusions.filter(item=>item.reason==='covered-by-education-span'&&!selected.some(record=>record.eventId===item.eventId));
  scene.profileDisplay.excludedFields=exclusions.filter(item=>!noLongerCovered.includes(item));
  scene.profileDisplay.includedFields=[...scene.profileDisplay.includedFields,...noLongerCovered.map(item=>item.field)];
}

export function buildFounderPresentationScene(document,{
  scope="INTERVIEWER_SAFE",
  audience=null,
  currentMonth=null,
  mediaById=new Map(),
  measureText=null,
  showEmptySlots=false
}={}){
  const projected=projectFounderPresentationDocument(document,{scope:audience||scope});
  let scene=buildKeynoteClassicScene(projected,{
    currentMonth:presentationCurrentMonth(projected,currentMonth),
    audience:"EVERYTHING",
    ...(measureText?{measureText}:{})
  });
  if(projected.theme&&projected.theme!==DEFAULT_THEME_ID){
    scene=applyThemeToScene(scene,projected.theme);
    scene=restoreFounderYearAllocation(scene);
  }
  const sources=new Map(projected.events.map(event=>[String(event.id),event]));
  for(const key of ['events','arrows','flags'])scene[key]=(scene[key]||[]).map(item=>({...item,sourceDateWording:item.sourceDateWording||sources.get(String(item.id))?.fields?.sourceDateWording||null}));
  selectConciseProfileEducation(scene,projected);
  if(measureText)scene.measureText=measureText;
  scene.showEmptySlots=showEmptySlots===true;
  scene.mediaProjection=mediaProjection(projected,mediaById);
  const advanced=advancedProjection(projected,mediaById);
  if(advanced)scene.advancedProjection={...(scene.advancedProjection||{}),...advanced};
  scene.founderPresentation=founderPresentationProjection(projected,mediaById,scene);
  return scene;
}

export function serializeFounderPresentation(document,options={}){
  const initialScene=buildFounderPresentationScene(document,options);
  const compositionOptions={
    layers:options.layers||"",
    resourceNamespace:options.resourceNamespace||""
  };
  let composed=composeLocked407FPortableSvg(initialScene,compositionOptions);
  if(initialScene.autoYearWeights){
    const paintRisk=svg=>{
      const resolved=resolveFounderPresentationSvg(svg,{measureText:initialScene.measureText});
      const clipped=resolved.nodes.filter(node=>node.kind==='text'&&(
        node.sourceAttributes['data-text-overflow']==='true'||node.bounds.x<-.5||node.bounds.y<-.5||
        node.bounds.x+node.bounds.width>1920.5||node.bounds.y+node.bounds.height>1080.5
      )).length;
      return clipped*1000+materialPresentationCollisions(resolved).length;
    };
    const weightedRisk=paintRisk(composed.svg);
    let fallback=false,selectedRisk=weightedRisk;
    if(weightedRisk){
      // One bounded recovery through the same composer: its existing trials
      // may find a safer scale from the original baseline. Equal safety keeps
      // the demand-driven result; source facts and export gates stay intact.
      const recovered=composeLocked407FPortableSvg({
        ...initialScene,autoYearWeights:undefined,composedAxis:undefined
      },compositionOptions);
      const recoveredRisk=paintRisk(recovered.svg);
      if(recoveredRisk<weightedRisk){
        composed=recovered;fallback=true;selectedRisk=recoveredRisk;
        if(!composed.scene.composedAxis){
          composed.scene={...composed.scene,composedAxis:{...initialScene.composedAxis,
            segmentWeights:initialScene.composedAxis.segmentWeights.map(({id})=>({id,weight:1}))}};
        }
      }
    }
    composed.scene={...composed.scene,autoYearAllocation:{
      fallback,reason:fallback?'weighted-paint-risk':null,weightedRisk,selectedRisk,
      adaptive:!!composed.scene.autoYearWeights
    }};
  }
  const scene=composed.scene;
  const svg=injectRootAttributes(composed.svg,{...founderContractAttributes(),"data-founder-serializer":FOUNDER_PRESENTATION_SERIALIZER,"data-founder-default-background":FOUNDER_PRESENTATION_DEFAULTS.background,"data-founder-canvas":"1920x1080"});
  return{
    scene,
    svg,
    contract:FOUNDER_KEYNOTE_CONTRACT,
    serializer:FOUNDER_PRESENTATION_SERIALIZER
  };
}

export async function serializeFounderPresentationAsync(document,{
  mediaResolver=null,
  ...options
}={}){
  const projected=projectFounderPresentationDocument(document,{
    scope:options.audience||options.scope||"INTERVIEWER_SAFE"
  });
  const resolvedById=new Map();
  if(typeof mediaResolver==="function"){
    const resolvable=[
      ...(projected.mediaItems||[]),
      ...(projected.advanced?.media||[]),
      ...(projected.advanced?.background?.mediaId?[projected.advanced.background]:[])
    ];
    await Promise.all(resolvable.map(async(item)=>{
      try{
        const source=await mediaResolver(item);
        const id=String(item.id||item.mediaId||"");
        if(id&&typeof source==="string"&&source)resolvedById.set(id,source);
      }catch{
        // Media is deliberately fail-soft: one missing asset cannot destroy the
        // presentation. The canonical frame remains visible as recovery UI.
      }
    }));
  }
  return serializeFounderPresentation(projected,{...options,mediaById:resolvedById});
}

// Validate the audience-projected render result, not the count of private source facts.
export function assertCompleteFounderPresentation(rendered,{allowPendingMedia=false}={}){
  const omitted=rendered?.scene?.omissions||[];
  if(!omitted.length&&!(rendered?.scene?.events||[]).length&&!(rendered?.scene?.profile?.educationRecords||[]).length){const error=new TypeError('Add at least one event visible to this audience before exporting.');error.code='TIMELINE_EXPORT_EMPTY';throw error;}
  if(omitted.length){
    const error=new TypeError(`Review ${omitted.length} event${omitted.length===1?'':'s'} with missing or invalid dates before exporting. Every included event must appear in your timeline.`);
    error.code='TIMELINE_EXPORT_INCOMPLETE';error.eventIds=omitted.map(item=>String(item.id));throw error;
  }
  const uncertain=[...(rendered.scene.arrows||[]),...(rendered.scene.flags||[])].filter(event=>Object.values(event.datePrecision||{}).includes('UNKNOWN'));
  if(uncertain.length){const error=new TypeError('Confirm unknown dates before exporting; normalized coordinates do not establish a source date.');error.code='TIMELINE_EXPORT_INCOMPLETE';error.eventIds=uncertain.map(event=>String(event.id));throw error;}
  const paint=resolveFounderPresentationSvg(rendered.svg,{measureText:rendered.scene.measureText});
  const educationRecords=rendered.scene.profile?.educationRecords||[];
  const expected=new Set([...rendered.scene.events.map(event=>String(event.id)),...educationRecords.map(record=>String(record.eventId))]);
  const represented=new Set(paint.nodes.map(node=>String(node.semanticRef||'')));
  const normalized=value=>String(value||'').replace(/\s+/g,' ').trim();
  const missingFields=[];
  const sourceEducation=rendered.scene.profile?.sourceEducationRecords;
  if(sourceEducation){
    const display=rendered.scene.profileDisplay||{},excluded=display.excludedEducationRecords||[];
    const primary=primaryProfileEducation(rendered.scene.profile,sourceEducation);
    const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
    for(const record of sourceEducation){
      const included=educationRecords.filter(item=>item.eventId===record.eventId);
      const omitted=excluded.filter(item=>item.eventId===record.eventId);
      const validIncluded=included.length===1&&same(included[0],record)&&omitted.length===0;
      const validOmission=included.length===0&&omitted.length===1&&primary&&
        display.educationPolicy==='concise-source-matched-primary'&&display.primaryEducationEventId===primary.eventId&&
        educationRecords.length===1&&same(educationRecords[0],primary)&&record.eventId!==primary.eventId&&
        omitted[0].reason==='additional-education-retained-for-review'&&omitted[0].primaryEventId===primary.eventId&&same(omitted[0].record,record);
      if(!validIncluded&&!validOmission)missingFields.push({id:record.eventId,field:'education.presentation-accounting'});
    }
    for(const record of [...educationRecords,...excluded])if(!sourceEducation.some(item=>item.eventId===record.eventId))missingFields.push({id:record.eventId,field:'education.unsourced-selection'});
    if(JSON.stringify(display.educationEventIds)!==JSON.stringify(educationRecords.map(record=>record.eventId)))missingFields.push({id:'profile',field:'education.selection'});
  }

  const profileFields={fullName:'Name',status:'Visa Status',aamcDisplay:'AAMC',medicalSchool:'Medical school',degree:'Degree',specialty:'Specialty',step1:'Step 1',step2:'Step 2 CK',step2Cs:'Step 2 CS',step3:'Step 3',usceSummary:'USCE',researchSummary:'Research',emrExperience:'EMR Experience',languages:'Languages fluent in',hobbies:'Hobbies'};
  const displayFields=rendered.scene.profileDisplay?.includedFields;
  for(const [field,label] of Object.entries(profileFields)){
    const value=normalized(rendered.scene.profile?.[field]);
    if(displayFields&&!displayFields.includes(field)){
      const exclusion=rendered.scene.profileDisplay.excludedFields?.find(item=>item.field===field);
      const narrative=['hobbies','languages','emrExperience'].includes(field)&&exclusion?.reason==='optional-source-narrative';
      const record=(rendered.scene.profile?.educationRecords||[]).find(item=>String(item.eventId)===String(exclusion?.eventId));
      const duplicate=['medicalSchool','degree'].includes(field)&&exclusion?.reason==='covered-by-education-span'&&record&&
        normalized(record[field==='medicalSchool'?'school':'title'])===value;
      if(value&&!narrative&&!duplicate)missingFields.push({id:'profile',field});
      continue;
    }
    if(!value)continue;
    const text=normalized(paint.nodes.filter(node=>node.kind==='text'&&node.sourceAttributes['data-profile-field']===label).map(node=>node.text).join(' '));
    if(!text.includes(value))missingFields.push({id:'profile',field});
  }
  const paintedMedia=new Set(paint.nodes.filter(node=>node.kind==='image').map(node=>node.sourceAttributes['data-media-id']).filter(Boolean));
  for(const id of rendered.scene.mediaProjection?.expectedIds||[])if(!paintedMedia.has(id)&&!(allowPendingMedia&&rendered.scene.mediaProjection.pendingIds.includes(id)))missingFields.push({id,field:'media'});
  const interviewDate=String(rendered.scene.interviewTarget?.date||'').trim();
  const exactInterview=/^(\d{4})-(\d{2})-(\d{2})$/.exec(interviewDate);
  const dayValid=!exactInterview||new Date(Date.UTC(+exactInterview[1],+exactInterview[2]-1,+exactInterview[3])).toISOString().slice(0,10)===interviewDate;
  if(interviewDate&&(!rendered.scene.interviewMarker||!dayValid))missingFields.push({id:'interview',field:'date'});
  for(const record of rendered.scene.profile?.educationRecords||[]){
    const text=normalized(paint.nodes.filter(node=>node.kind==='text'&&node.semanticRef===String(record.eventId)&&node.sourceAttributes['data-material-field']==='educationSpan').map(node=>node.text).join(' '));
    for(const [field,value] of [['title',record.title],['school',record.school],['startDate',presentationDateWording(record.startDate,record.datePrecision?.start,record.sourceDateWording?.start)],['endDate',presentationDateWording(record.endDate,record.datePrecision?.end,record.sourceDateWording?.end)]])if(value&&!text.includes(normalized(value)))missingFields.push({id:String(record.eventId),field:'education.'+field});
  }
  for(const event of [...(rendered.scene.arrows||[]),...(rendered.scene.flags||[])]){
    const text=normalized(paint.nodes.filter(node=>node.kind==='text'&&node.semanticRef===String(event.id)).map(node=>node.text).join(' '));
    for(const field of ['title','siteName'])if(event[field]&&!text.includes(normalized(event[field])))missingFields.push({id:String(event.id),field});
  }

  const missing=[...expected].filter(id=>!represented.has(id));
  if(missing.length){const error=new TypeError('Some included events are absent from the exported timeline.');error.code='TIMELINE_EXPORT_INCOMPLETE';error.eventIds=missing;throw error;}
  {
    const unreadable=paint.nodes.filter(node=>node.kind==='text'&&(
      node.sourceAttributes['data-text-overflow']==='true'||node.bounds.x<-.5||node.bounds.y<-.5||
      node.bounds.x+node.bounds.width>1920.5||node.bounds.y+node.bounds.height>1080.5));
    if(unreadable.length){
      const error=new TypeError('Some visible text does not fit on the exported page. Adjust the layout before exporting; all source text has been preserved.');
      error.code='TIMELINE_EXPORT_TEXT_OVERFLOW';error.elementIds=[...new Set(unreadable.map(node=>node.semanticRef||node.groupId||node.id))];throw error;
    }
  }
  if(missingFields.length){const error=new TypeError('Some material event details are missing from the visible timeline. Review the layout before exporting.');error.code='TIMELINE_EXPORT_MISSING_FIELDS';error.fields=missingFields;throw error;}
  const templateViolations=[...founderMilestoneTemplateGeometry(rendered.scene,paint),...founderDurationTemplateGeometry(rendered.scene,paint)].filter(violatesFounderTemplateBand);
  if(templateViolations.length){
    const error=new TypeError('Keep general milestones and full adjacent labels above the ribbon with pole feet on its top edge; keep experience arrows and labels below it, and exam-result flags attached to their study arrows. Adjust the saved layout before exporting.');
    error.code='TIMELINE_EXPORT_TEMPLATE_FIDELITY_HOLD';error.eventIds=templateViolations.map(target=>target.eventId);throw error;
  }
  const collisions=materialPresentationCollisions(paint);
  if(collisions.length){
    const error=new TypeError('Some visible text is overlapped or hidden by another object. Adjust the layout and review the preview before exporting.');
    error.code='TIMELINE_EXPORT_TEXT_COLLISION';error.elementIds=[...new Set(collisions.flatMap(c=>c.elementIds))];throw error;
  }
  return rendered;
}
