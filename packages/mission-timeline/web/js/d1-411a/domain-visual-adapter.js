import "./presentation-kernel-adapter.js";

const CATEGORY_MAP=Object.freeze({
  work:"work",
  education:"work",
  exams:"usmle",
  clinical:"usce",
  research:"res",
  personal:"personal"
});

const CATEGORY_LABELS=Object.freeze({
  work:"Work Experience",
  education:"Medical Education",
  exams:"USMLE Studies",
  clinical:"US Clinical Experience",
  research:"Research",
  personal:"Personal (Not on CV)"
});

const CATEGORY_IDS=Object.freeze(Object.keys(CATEGORY_MAP));
export class DomainVisualProjectionError extends Error{
  constructor(code,message,path=""){
    super(message);
    this.name="DomainVisualProjectionError";
    this.code=code;
    this.path=path;
  }
}

function clean(value){return String(value??"").trim();}

function validYearMonth(value){
  const match=/^(\d{4})-(\d{2})$/.exec(clean(value));
  if(!match)return null;
  const year=Number(match[1]);
  const month=Number(match[2]);
  if(year<1900||year>2200||month<1||month>12)return null;
  return{year,month,index:year*12+month-1};
}

function sanitizeFurniturePresentation(overrides,warnings){
  const next=clone(overrides||{});
  const normalize=(value,fallback)=>{
    const source=value&&typeof value==="object"?value:{};
    return{
      x:Number.isFinite(Number(source.x))?Number(source.x):fallback.x,
      y:Number.isFinite(Number(source.y))?Number(source.y):fallback.y,
      width:Number.isFinite(Number(source.width))?Number(source.width):fallback.width,
      height:Number.isFinite(Number(source.height))?Number(source.height):fallback.height
    };
  };
  const gap=12;
  const overlaps=(first,second)=>!(
    first.x+first.width+gap<=second.x||
    second.x+second.width+gap<=first.x||
    first.y+first.height+gap<=second.y||
    second.y+second.height+gap<=first.y
  );
  const key=normalize(next.colorKeyGeometry,{x:18,y:300,width:416,height:322});
  const profile=normalize(next.profileGeometry,{x:18,y:634,width:566,height:428});
  if(!overlaps(key,profile))return next;
  const raisedKey={...key,y:Math.max(0,profile.y-gap-key.height)};
  if(!overlaps(raisedKey,profile))next.colorKeyGeometry=raisedKey;
  else{
    const loweredProfile={...profile,y:Math.min(1080-profile.height,key.y+key.height+gap)};
    if(!overlaps(key,loweredProfile))next.profileGeometry=loweredProfile;
    else{
      next.colorKeyGeometry={x:18,y:300,width:416,height:322};
      next.profileGeometry={x:18,y:634,width:566,height:428};
    }
  }
  warnings.push("PRESENTATION_FURNITURE_COLLISION_REPAIRED");
  return next;
}

function profileVisaDisplay(value){
  const display=clean(value);
  if(display.length<=18)return display;
  const words=display.split(/\s+/);
  let first="";
  while(words.length){
    const candidate=[first,words[0]].filter(Boolean).join(" ");
    if(first&&candidate.length>18)break;
    first=candidate;words.shift();
  }
  return words.length?`${first}\n${words.join(" ")}`:display;
}
function clone(value){return value==null?value:structuredClone(value);}

function stableId(prefix,value,index){
  const source=clean(value)||`${prefix}-${index+1}`;
  const token=source.replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-+|-+$/g,"")||String(index+1);
  return`${prefix}-${token}`;
}

function mediaRef(item,resolveObjectUrl,warnings,path){
  if(!item)return null;
  const src=clean(resolveObjectUrl(item.id,item)||item.source?.src||item.src);
  const mime=clean(item.source?.mime||item.source?.type||item.mime||item.type);
  const contentSha256=clean(
    item.source?.contentSha256||item.contentSha256||item.sha256
  ).toLowerCase();
  if(!src){warnings.push(`MEDIA_SOURCE_UNAVAILABLE:${item.id}`);return null;}
  if(!["image/jpeg","image/png","image/webp"].includes(mime)){
    warnings.push(`MEDIA_MIME_UNSUPPORTED:${item.id}:${mime||"unknown"}`);
    return null;
  }
  if(!/^[0-9a-f]{64}$/.test(contentSha256)){
    warnings.push(`MEDIA_HASH_UNAVAILABLE:${item.id}`);
    return null;
  }
  return{
    id:stableId("media",item.id,0),
    src,
    mime,
    alt:clean(item.alt||item.source?.alt||item.source?.name||path),
    contentSha256
  };
}

function examValue(document,examId){
  const records=(document?.exams||[])
    .filter((record)=>clean(record?.examId).toLowerCase()===examId)
    .slice()
    .sort((a,b)=>(Number(b.attempt)||1)-(Number(a.attempt)||1));
  const record=records.find((item)=>clean(item.score||item.result));
  return record?clean(record.score||record.result):"";
}

function audienceVisible(event,audience){
  const visibility=clean(event?.visibilityState||"INTERVIEWER_SAFE").toUpperCase();
  if(visibility==="HIDDEN")return false;
  if(audience==="INTERVIEWER_SAFE")return visibility==="INTERVIEWER_SAFE";
  return true;
}

function presentationOverrides(event){
  const result={};
  if(Number.isInteger(event?.lane))result.lane=Math.max(0,Math.min(6,event.lane));
  const position=clean(event?.fields?.labelPosition);
  if(["below","left"].includes(position))result.labelPosition=position;
  if(event?.fields?.highlight===true)result.highlight=true;
  return result;
}

function projectedTitle(document,profile){
  const title=clean(document?.title);
  if(title&&title!=="Timeline Builder")return title.replace(/^Timeline:\s*/i,"");
  return clean(profile?.fullName)||"Mission Timeline";
}

function mediaCollections(document){
  return Array.isArray(document?.advanced?.media)?document.advanced.media:[];
}

export function projectTimelineDocument(document,{
  revision=1,
  audience="EVERYTHING",
  ownerId=null,
  resolveObjectUrl=()=>null
}={}){
  if(!document||typeof document!=="object"){
    throw new DomainVisualProjectionError(
      "INVALID_TIMELINE_DOCUMENT",
      "A TimelineDocument is required.",
      "document"
    );
  }
  const warnings=[];
  const dropped=[];
  const visualToDomain=new Map();
  const domainToVisual=new Map();
  const profile=document.studentProfile||{};
  const explanationEvents=[];
  const events=[];

  (document.events||[]).forEach((event,index)=>{
    const domainId=clean(event?.id)||`event-${index+1}`;
    if(event?.fields?.builderDomain==="explanation"||event?.eventType==="explanation"){
      explanationEvents.push(event);
      return;
    }
    const milestone=event?.eventType==="milestone"||event?.mile===true;
    const visualId=stableId(milestone?"fl":"ev",domainId,index);
    if(visualToDomain.has(visualId)){
      warnings.push(`EVENT_HIDDEN_DUPLICATE_ID:${domainId}`);
      dropped.push({id:domainId,reason:"duplicate-visual-id"});
      return;
    }
    const categoryId=clean(event?.categoryId)||"personal";
    if(!CATEGORY_MAP[categoryId]){
      warnings.push(`EVENT_HIDDEN_UNSUPPORTED_CATEGORY:${domainId}`);
      dropped.push({id:domainId,reason:"unsupported-category"});
      return;
    }
    const startDate=clean(event?.fields?.rotationStartDate||event?.startDate);
    const parsedStart=validYearMonth(startDate);
    if(!parsedStart){
      warnings.push(`EVENT_HIDDEN_INVALID_START_DATE:${domainId}`);
      dropped.push({id:domainId,reason:"invalid-start-date"});
      return;
    }
    const exactEnd=clean(event?.fields?.rotationEndDate||event?.endDate);
    const parsedEnd=milestone||event?.openEnded===true||event?.fields?.ongoing===true
      ?parsedStart
      :validYearMonth(exactEnd||startDate);
    if(!parsedEnd){
      warnings.push(`EVENT_HIDDEN_INVALID_END_DATE:${domainId}`);
      dropped.push({id:domainId,reason:"invalid-end-date"});
      return;
    }
    if(!milestone&&parsedEnd.index<parsedStart.index){
      warnings.push(`EVENT_HIDDEN_END_BEFORE_START:${domainId}`);
      dropped.push({id:domainId,reason:"end-before-start"});
      return;
    }
    visualToDomain.set(visualId,domainId);
    domainToVisual.set(domainId,visualId);
    const visible=audienceVisible(event,audience)&&
      event?.fields?.hiddenInActiveVariant!==true;
    events.push({
      id:visualId,
      title:clean(event?.title)||`Event ${index+1}`,
      shortLabel:clean(event?.fields?.shortLabel||event?.shortLabel)||undefined,
      categoryId,
      startDate,
      endDate:milestone?undefined:(exactEnd||startDate),
      approximateStart:event?.fields?.approximateStart===true||event?.approximateStart===true,
      approximateEnd:event?.fields?.approximateEnd===true||event?.approximateEnd===true,
      ongoing:!milestone&&(event?.openEnded===true||event?.fields?.ongoing===true),
      location:clean(event?.siteName||event?.fields?.location||event?.fields?.city)||undefined,
      institution:clean(event?.fields?.institution||event?.fields?.organization)||undefined,
      description:clean(event?.notes||event?.fields?.description)||undefined,
      visibility:visible?"visible":"hidden",
      milestone,
      presentationOverride:presentationOverrides(event)
    });
  });

  const categories=CATEGORY_IDS.map((id,index)=>({
    id,
    label:CATEGORY_LABELS[id],
    shortLabel:id==="education"?"Medical Degree":undefined,
    mapsTo:CATEGORY_MAP[id],
    order:index,
    visible:true,
    arrowWordingRule:"keep"
  }));

  const presentationState=document.presentationOverrides&&
    typeof document.presentationOverrides==="object"
    ?sanitizeFurniturePresentation(document.presentationOverrides,warnings)
    :{};
  const axisOverride=Object.hasOwn(presentationState,"axis")
    ?clone(presentationState.axis)
    :null;
  const categoryKeyOverride=Object.hasOwn(presentationState,"categoryKey")
    ?(Array.isArray(presentationState.categoryKey)
      ?presentationState.categoryKey.map((item,index)=>{
      const id=item?.id;
      return{
        id,
        mapsTo:CATEGORY_MAP[id],
        order:item?.order??index,
        label:clean(item?.label),
        color:clean(item?.color)
      };
    })
      :clone(presentationState.categoryKey))
    :null;

  const media=mediaCollections(document);
  const profileMedia=media.find((item)=>
    ["profile-photo","profilePhoto","profile"].includes(item?.role||item?.placement)
  );
  const interview=document.metadata?.interview||{};
  const logoMedia=media.find((item)=>
    item?.id===interview.logoMediaId||
    item?.role==="interview-program-logo"||
    item?.role==="interview-program-logo-source"
  );
  const visiblePhotoCandidates=media
    .filter((item)=>item?.type==="media"&&item?.placed!==false&&
      item!==profileMedia&&item!==logoMedia&&document.mode!=="advanced");
  const visiblePhotos=visiblePhotoCandidates.slice(0,5);
  if(visiblePhotoCandidates.length>5){
    warnings.push("EXTRA_PHOTOS_REPORTED");
  }
  const photos=[];
  visiblePhotos.forEach((item,index)=>{
    const source=mediaRef(item,resolveObjectUrl,warnings,`photos[${index}]`);
    if(!source){dropped.push({id:item.id,reason:"unverified-media"});return;}
    const visualId=stableId("ph",item.id,index);
    visualToDomain.set(visualId,clean(item.id));
    domainToVisual.set(clean(item.id),visualId);
    photos.push({
      id:visualId,
      source,
      altText:source.alt,
      caption:clean(item.caption)||undefined,
      captionStyle:["marker","type"].includes(item.captionStyle)?item.captionStyle:"none",
      presentationStyle:item.presentationStyle==="polaroid"?"polaroid":"scrapbook",
      visibility:"visible",
      slot:index
    });
  });

  const callouts=explanationEvents.map((event,index)=>{
    const domainId=clean(event.id)||`explanation-${index+1}`;
    const targetDomainId=clean(event?.fields?.targetEventId||event?.fields?.target?.eventId);
    const targetEventId=domainToVisual.get(targetDomainId)||null;
    if(!targetEventId){warnings.push(`CALLOUT_TARGET_UNAVAILABLE:${domainId}`);}
    return{
      id:stableId("callout",domainId,index),
      text:clean(event?.fields?.explanationText||event?.notes||event?.title),
      targetEventId:targetEventId||"ev-unresolved",
      style:"sticky",
      visibility:targetEventId&&audienceVisible(event,audience)?"visible":"hidden"
    };
  });
  const legacySticky=clean(document?.metadata?.stickyNote);
  if(!callouts.length&&legacySticky&&events[0]){
    callouts.push({
      id:"callout-sticky-note",
      text:legacySticky,
      targetEventId:events[0].id,
      style:"sticky",
      visibility:"visible"
    });
  }

  const allYears=events.flatMap((event)=>[
    Number(clean(event.startDate).slice(0,4)),
    Number(clean(event.endDate).slice(0,4))
  ]).filter(Number.isFinite);
  const visualDocument={
    schemaVersion:"d1-411a/timeline-visual-document/1",
    timelineId:clean(document.id)||"timeline-local",
    ownerId:clean(ownerId||document.ownerId||document.metadata?.ownerId)||"local-owner",
    revision:Math.max(0,Math.trunc(Number(revision)||0)),
    title:projectedTitle(document,profile),
    targetSpecialty:clean(
      document?.metadata?.interview?.specialty||profile?.specialtyGoal
    ),
    student:{
      displayName:clean(profile.fullName),
      profilePhoto:mediaRef(profileMedia,resolveObjectUrl,warnings,"student.profilePhoto"),
      visaStatus:profileVisaDisplay(profile.currentUsWorkAuthorization||profile.visaStatus),
      aamcDisplay:clean(profile.aamcDisplay||profile.aamcId),
      stepScores:{
        step1:examValue(document,"step-1"),
        step2Ck:examValue(document,"step-2-ck"),
        step2Cs:examValue(document,"step-2-cs"),
        step3:examValue(document,"step-3")
      },
      usceSummary:clean(profile.usceSummary),
      researchSummary:clean(profile.researchSummary),
      languages:clean(profile.languages),
      hobbies:clean(profile.hobbies)
    },
    axis:{
      startYear:allYears.length?Math.min(...allYears):undefined,
      endYear:allYears.length?Math.max(...allYears):undefined,
      futureEnabled:true,
      adaptiveWeightingEnabled:true,
      dateNormalization:"UTC-month"
    },
    events,
    milestones:[],
    categories,
    profileFields:clone(document.profileFields||{}),
    photos,
    callouts,
    interview:{
      programName:clean(interview.prog||interview.programName),
      specialty:clean(interview.specialty),
      interviewDate:clean(interview.date||interview.interviewDate),
      interviewDateDisplay:clean(interview.dateDisplay),
      logo:mediaRef(logoMedia,resolveObjectUrl,warnings,"interview.logo"),
      ribbonText:clean(interview.label)||"My Big Interview!",
      visibility:clean(interview.date||interview.prog||interview.label)?"visible":"hidden"
    },
    presentation:{
      densityMode:"auto",
      scaleMode:"fit-container",
      theme:"keynote-classic-409h",
      photoStyleDefault:"scrapbook",
      captionDefault:"none",
      manualOverrides:clone(presentationState),
      axisOverride,
      categoryKeyOverride,
      resetToAutomatic:false
    },
    metadata:{
      sourceSchema:clean(document.schemaVersion),
      audience,
      warnings:clone(warnings),
      dropped:clone(dropped)
    }
  };
  const fable=globalThis.D1411A_Adapter||globalThis.window?.D1411A_Adapter;
  if(!fable?.toRenderModel){
    throw new DomainVisualProjectionError(
      "FABLE_ADAPTER_UNAVAILABLE",
      "The D1-411A presentation adapter is not loaded.",
      "window.D1411A_Adapter"
    );
  }
  const result=fable.toRenderModel(visualDocument);
  return{
    visualDocument,
    model:result.model,
    warnings:[...warnings,...(result.warnings||[])],
    dropped:[...dropped,...(result.dropped||[])],
    visualToDomain,
    domainToVisual
  };
}
