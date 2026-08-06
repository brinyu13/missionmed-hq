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
      throw new DomainVisualProjectionError(
        "DUPLICATE_VISUAL_ID",
        `Two timeline events resolve to ${visualId}.`,
        `events[${index}].id`
      );
    }
    visualToDomain.set(visualId,domainId);
    domainToVisual.set(domainId,visualId);
    const categoryId=clean(event?.categoryId)||"personal";
    if(!CATEGORY_MAP[categoryId]){
      throw new DomainVisualProjectionError(
        "UNSUPPORTED_CATEGORY",
        `Unsupported domain category ${categoryId}.`,
        `events[${index}].categoryId`
      );
    }
    const startDate=clean(event?.fields?.rotationStartDate||event?.startDate);
    if(!startDate){
      warnings.push(`EVENT_WITHOUT_DATE_HIDDEN:${domainId}`);
      dropped.push({id:domainId,reason:"missing-start-date"});
      return;
    }
    const exactEnd=clean(event?.fields?.rotationEndDate||event?.endDate);
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
    ?clone(document.presentationOverrides)
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
  const visiblePhotos=media
    .filter((item)=>item?.type==="media"&&item?.placed!==false&&
      item!==profileMedia&&item!==logoMedia)
    .slice(0,5);
  if(media.filter((item)=>item?.type==="media"&&item?.placed!==false).length>5){
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
      visaStatus:clean(profile.currentUsWorkAuthorization||profile.visaStatus),
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
      manualOverrides:clone(document.presentationOverrides||{}),
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
