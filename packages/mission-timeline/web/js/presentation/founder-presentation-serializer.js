import {buildKeynoteClassicScene} from "../uxr-002/board-renderer.js";
import {serializeLocked407FPortableSvg} from "../uxr-002/locked-407f-export.js";
import {DEFAULT_THEME_ID,applyThemeToScene} from "../uxr-002/themes.js";
import {reconcileAdvancedScene,validateSceneGraph} from "../editor/scene-graph.js";
import {
  FOUNDER_COLOR_KEY_ROWS,
  FOUNDER_KEYNOTE_CONTRACT,
  FOUNDER_PRESENTATION_DEFAULTS,
  founderContractAttributes
} from "./founder-keynote-contract.js";

export const FOUNDER_PRESENTATION_SERIALIZER=
  "d1-founder-keynote-portable-svg/1";

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

function visibility(value){
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
  return{
    ...document,
    theme:document.theme||FOUNDER_PRESENTATION_DEFAULTS.theme,
    studentProfile:{...(document.studentProfile||{})},
    events:(document.events||[]).filter((event)=>allowed.has(
      visibility(event?.visibilityState||event?.visibility)
    )),
    mediaItems:(document.mediaItems||[]).filter((item)=>allowed.has(
      visibility(item?.visibilityState||item?.visibility)
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
  const projected={profilePhoto:null,logo:null,photos:[]};
  (document.mediaItems||[]).forEach((item,index)=>{
    const role=mediaRole(item);
    if(!role)return;
    const source=resolvedById.get(String(item.id))||directMediaSource(item);
    if(!source)return;
    const record={
      id:String(item.id||`${role}-${index}`),
      source,
      altText:String(item.altText||item.caption||""),
      crop:item.crop&&typeof item.crop==="object"?{...item.crop}:null,
      order:photoOrder(item,index)
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

function founderCategoryKeyProjection(document){
  const explicit=new Map((Array.isArray(document?.presentationOverrides?.categoryKey)
    ?document.presentationOverrides.categoryKey:[]).map((item)=>[String(item?.id||""),item]));
  return FOUNDER_COLOR_KEY_ROWS.map((fallback,index)=>{
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
  let scene;
  try{
    scene=reconcileAdvancedScene(document.advanced,{revision:document.revision});
  }catch{
    return null;
  }
  if(!validateSceneGraph(scene).valid)return null;
  const legacyMedia=new Map((document.advanced.media||[]).map((item)=>[String(item?.id||""),item]));
  return{
    ...scene,
    objects:scene.objects.map((object)=>{
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

function founderPresentationProjection(document,resolvedById){
  return Object.freeze({
    axis:founderAxisProjection(document),
    categoryKey:Object.freeze(founderCategoryKeyProjection(document).map(Object.freeze)),
    colorKeyGeometry:Object.freeze(boundedGeometry(
      document?.presentationOverrides?.colorKeyGeometry,
      {x:37,y:350,width:247,height:277}
    )),
    profileGeometry:Object.freeze(boundedGeometry(
      document?.presentationOverrides?.profileGeometry,
      {x:30,y:677,width:512,height:375}
    )),
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
  const svg=serializeLocked407FPortableSvg(scene,{layers,resourceNamespace});
  return injectRootAttributes(svg,{
    ...founderContractAttributes(),
    "data-founder-serializer":FOUNDER_PRESENTATION_SERIALIZER,
    "data-founder-default-background":FOUNDER_PRESENTATION_DEFAULTS.background,
    "data-founder-canvas":"1920x1080"
  });
}

export function buildFounderPresentationScene(document,{
  scope="INTERVIEWER_SAFE",
  audience=null,
  currentMonth=null,
  mediaById=new Map()
}={}){
  const projected=projectFounderPresentationDocument(document,{scope:audience||scope});
  let scene=buildKeynoteClassicScene(projected,{
    currentMonth:presentationCurrentMonth(projected,currentMonth),
    audience:"EVERYTHING"
  });
  if(projected.theme&&projected.theme!==DEFAULT_THEME_ID){
    scene=applyThemeToScene(scene,projected.theme);
  }
  scene.mediaProjection=mediaProjection(projected,mediaById);
  const advanced=advancedProjection(projected,mediaById);
  if(advanced)scene.advancedProjection={...(scene.advancedProjection||{}),...advanced};
  scene.founderPresentation=founderPresentationProjection(projected,mediaById);
  return scene;
}

export function serializeFounderPresentation(document,options={}){
  const scene=buildFounderPresentationScene(document,options);
  const svg=serializeFounderScene(scene,{
    layers:options.layers||"",
    resourceNamespace:options.resourceNamespace||""
  });
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
