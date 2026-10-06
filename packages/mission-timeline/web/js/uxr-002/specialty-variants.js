import {normalizeSpecialtyId} from "./specialty-taxonomy.js";

export const SPECIALTY_VARIANT_SCHEMA="d1-405.specialty-variants.1";

function clone(value){
  return value==null?value:structuredClone(value);
}

function clean(value){
  return String(value||"").trim();
}

function safeName(value,fallback){
  return clean(value).slice(0,80)||fallback;
}

function unique(values){
  return[...new Set((values||[]).map(clean).filter(Boolean))];
}

function variantIdFor(specialtyId,variants=[]){
  const stem=`specialty-variant:${clean(specialtyId).replace(/^acgme:/,"")||"timeline"}`;
  const ids=new Set(variants.map((variant)=>variant.id));
  if(!ids.has(stem))return stem;
  let index=2;
  while(ids.has(`${stem}-${index}`))index+=1;
  return`${stem}-${index}`;
}

function normalizeVariant(variant,index=0){
  const label=clean(
    variant?.specialty?.label||
    variant?.specialtyLabel
  );
  const id=clean(
    variant?.specialty?.id||
    variant?.specialtyId||
    normalizeSpecialtyId(label)
  );
  const fallbackName=label?`${label} timeline`:`Specialty timeline ${index+1}`;
  return{
    ...clone(variant||{}),
    id:clean(variant?.id)||`specialty-variant:${index+1}`,
    name:safeName(variant?.name,fallbackName),
    specialty:{...clone(variant?.specialty||{}),id,label},
    selectionState:id||label
      ?clean(variant?.selectionState)||"selected"
      :"unknown",
    hiddenEventIds:unique(variant?.hiddenEventIds),
    interviewTarget:{
      ...clone(variant?.interviewTarget||{}),
      mode:variant?.interviewTarget?.mode==="specific"?"specific":"general",
      programId:clean(variant?.interviewTarget?.programId),
      programName:clean(variant?.interviewTarget?.programName),
      specialtyId:clean(variant?.interviewTarget?.specialtyId),
      specialtyLabel:clean(variant?.interviewTarget?.specialtyLabel),
      interviewDate:clean(variant?.interviewTarget?.interviewDate),
      location:clean(variant?.interviewTarget?.location),
      label:clean(variant?.interviewTarget?.label),
      calendarEventId:clean(variant?.interviewTarget?.calendarEventId),
      meetingInformation:clean(variant?.interviewTarget?.meetingInformation),
      logoMediaId:clean(variant?.interviewTarget?.logoMediaId),
      logoFit:variant?.interviewTarget?.logoFit==="cover"?"cover":"contain",
      logoX:Number.isFinite(Number(variant?.interviewTarget?.logoX))
        ?Number(variant.interviewTarget.logoX)
        :1560,
      logoY:Number.isFinite(Number(variant?.interviewTarget?.logoY))
        ?Number(variant.interviewTarget.logoY)
        :112,
      logoWidth:Number.isFinite(Number(variant?.interviewTarget?.logoWidth))
        ?Number(variant.interviewTarget.logoWidth)
        :180,
      logoHeight:Number.isFinite(Number(variant?.interviewTarget?.logoHeight))
        ?Number(variant.interviewTarget.logoHeight)
        :96
    }
  };
}

function legacyVariant(document){
  const label=clean(
    document?.builder?.targetSpecialtyLabel||
    document?.studentProfile?.specialtyGoal
  );
  const id=clean(
    document?.builder?.targetSpecialtyId||
    normalizeSpecialtyId(label)
  );
  return normalizeVariant({
    id:variantIdFor(id),
    name:label?`${label} timeline`:"Primary specialty timeline",
    specialty:{id,label},
    interviewTarget:{
      mode:document?.metadata?.interview?.prog||
        document?.metadata?.interview?.date
      ?"specific"
      :"general",
      programId:document?.metadata?.interview?.programId,
      programName:document?.metadata?.interview?.prog,
      specialtyLabel:label,
      specialtyId:id,
      interviewDate:document?.metadata?.interview?.date,
      location:document?.metadata?.interview?.location,
      label:document?.metadata?.interview?.label,
      calendarEventId:document?.metadata?.interview?.calendarEventId,
      meetingInformation:document?.metadata?.interview?.meetingInformation,
      logoMediaId:document?.metadata?.interview?.logoMediaId,
      logoFit:document?.metadata?.interview?.logoFit,
      logoX:document?.metadata?.interview?.logoX,
      logoY:document?.metadata?.interview?.logoY,
      logoWidth:document?.metadata?.interview?.logoWidth,
      logoHeight:document?.metadata?.interview?.logoHeight
    }
  });
}

export function normalizeSpecialtyVariants(document){
  const source=document?.specialtyVariants;
  const variants=Array.isArray(source?.variants)&&source.variants.length
    ?source.variants.map(normalizeVariant)
    :[legacyVariant(document)];
  const ids=new Set();
  const deduped=[];
  for(const variant of variants){
    let id=variant.id;
    if(ids.has(id))id=variantIdFor(variant.specialty.id,deduped);
    ids.add(id);
    deduped.push({...variant,id});
  }
  const requested=clean(source?.activeVariantId);
  return{
    ...clone(source||{}),
    schemaVersion:SPECIALTY_VARIANT_SCHEMA,
    activeVariantId:ids.has(requested)?requested:deduped[0].id,
    variants:deduped
  };
}

export function ensureSpecialtyVariants(document){
  document.specialtyVariants=normalizeSpecialtyVariants(document);
  return document.specialtyVariants;
}

export function activeSpecialtyVariant(document){
  const state=normalizeSpecialtyVariants(document);
  return state.variants.find(({id})=>id===state.activeVariantId)||state.variants[0];
}

export function createSpecialtyVariant(document,{
  specialtyId="",
  specialtyLabel="",
  name=""
}={}){
  const state=ensureSpecialtyVariants(document);
  const label=clean(specialtyLabel);
  const id=clean(specialtyId)||normalizeSpecialtyId(label);
  if(!id||!label){
    return{ok:false,code:"SPECIALTY_REQUIRED",message:"Choose a specialty."};
  }
  if(state.variants.some((variant)=>variant.specialty.id===id)){
    return{
      ok:false,
      code:"SPECIALTY_VARIANT_EXISTS",
      message:`A ${label} timeline already exists.`
    };
  }
  const variant=normalizeVariant({
    id:variantIdFor(id,state.variants),
    name:safeName(name,`${label} timeline`),
    specialty:{id,label}
  },state.variants.length);
  state.variants.push(variant);
  state.activeVariantId=variant.id;
  syncInterviewLogoWell(document);
  return{ok:true,variant:clone(variant),state:clone(state)};
}

/* The ribbon's logo well belongs to the active interview destination. Each specialty
   variant carries its own interviewTarget.logoMediaId; the persisted well (a
   "ribbon"-placed media item) is kept in step with it whenever the active variant
   or its target changes, so switching Program A → Program B never leaves A's logo
   on B's board, preview or export. `synthesize:false` only removes other
   destinations' logos (used by the non-mutating projection). */
export function syncInterviewLogoWell(document,{synthesize=true}={}){
  if(!document||typeof document!=="object")return false;
  const state=ensureSpecialtyVariants(document);
  const active=state.variants.find(({id})=>id===state.activeVariantId)||state.variants[0];
  const logoId=clean(active?.interviewTarget?.logoMediaId);
  const variantLogos=new Set(state.variants.map((variant)=>clean(variant?.interviewTarget?.logoMediaId)).filter(Boolean));
  const isWell=(item)=>clean(item?.placement).toLowerCase()==="ribbon";
  const items=Array.isArray(document.mediaItems)?document.mediaItems:[];
  const kept=items.filter((item)=>{
    if(!isWell(item))return true;
    const mediaId=clean(item?.mediaId);
    // Another destination's logo never stays in the well. A well filled with an
    // asset no destination claims is kept by the projection and replaced only by
    // the persisted sync when this destination's own logo is saved.
    if(variantLogos.has(mediaId)&&mediaId!==logoId)return false;
    return synthesize&&logoId?mediaId===logoId:true;
  });
  let changed=kept.length!==items.length;
  if(synthesize&&logoId&&!kept.some((item)=>isWell(item)&&clean(item?.mediaId)===logoId)){
    const asset=(document.advanced?.media||[]).find((item)=>clean(item?.id)===logoId);
    if(asset){
      kept.push({id:`frame-logo-${active.id}-${logoId}`,type:"logo",placement:"ribbon",mediaId:logoId,source:clone(asset.source||{}),naturalAspect:Number(asset.naturalAspect)||null,altText:clean(asset.source?.name||asset.name||""),crop:{x:50,y:50,zoom:1},visibilityState:"INTERVIEWER_SAFE"});
      changed=true;
    }
  }
  if(changed)document.mediaItems=kept;
  return changed;
}

export function switchSpecialtyVariant(document,variantId){
  const state=ensureSpecialtyVariants(document);
  const id=clean(variantId);
  if(!state.variants.some((variant)=>variant.id===id)){
    return{ok:false,code:"SPECIALTY_VARIANT_NOT_FOUND"};
  }
  state.activeVariantId=id;
  syncInterviewLogoWell(document);
  return{ok:true,variant:clone(activeSpecialtyVariant(document))};
}

export function renameSpecialtyVariant(document,variantId,name){
  const state=ensureSpecialtyVariants(document);
  const variant=state.variants.find(({id})=>id===clean(variantId));
  if(!variant)return{ok:false,code:"SPECIALTY_VARIANT_NOT_FOUND"};
  const next=clean(name).slice(0,80);
  if(!next)return{ok:false,code:"SPECIALTY_VARIANT_NAME_REQUIRED"};
  variant.name=next;
  return{ok:true,variant:clone(variant)};
}

export function removeSpecialtyVariant(document,variantId,{confirmed=false}={}){
  const state=ensureSpecialtyVariants(document);
  if(!confirmed)return{ok:false,code:"CONFIRMATION_REQUIRED"};
  if(state.variants.length<=1){
    return{
      ok:false,
      code:"LAST_SPECIALTY_VARIANT",
      message:"Keep at least one specialty timeline."
    };
  }
  const index=state.variants.findIndex(({id})=>id===clean(variantId));
  if(index<0)return{ok:false,code:"SPECIALTY_VARIANT_NOT_FOUND"};
  const [removed]=state.variants.splice(index,1);
  if(state.activeVariantId===removed.id){
    state.activeVariantId=state.variants[Math.min(index,state.variants.length-1)].id;
  }
  syncInterviewLogoWell(document);
  return{ok:true,removed:clone(removed),active:clone(activeSpecialtyVariant(document))};
}

export function setVariantEventHidden(document,variantId,eventId,hidden){
  const state=ensureSpecialtyVariants(document);
  const variant=state.variants.find(({id})=>id===clean(variantId));
  if(!variant)return{ok:false,code:"SPECIALTY_VARIANT_NOT_FOUND"};
  const id=clean(eventId);
  if(!id||(document.events||[]).every((event)=>clean(event?.id)!==id)){
    return{ok:false,code:"EVENT_NOT_FOUND"};
  }
  const ids=new Set(variant.hiddenEventIds);
  if(hidden)ids.add(id);
  else ids.delete(id);
  variant.hiddenEventIds=[...ids];
  return{ok:true,hidden:ids.has(id)};
}

export function setVariantInterviewTarget(document,variantId,target={}){
  const state=ensureSpecialtyVariants(document);
  const variant=state.variants.find(({id})=>id===clean(variantId));
  if(!variant)return{ok:false,code:"SPECIALTY_VARIANT_NOT_FOUND"};
  variant.interviewTarget={
    ...clone(variant.interviewTarget||{}),
    ...clone(target||{}),
    mode:target.mode==="specific"?"specific":"general",
    programId:clean(target.programId),
    programName:clean(target.programName),
    specialtyId:clean(target.specialtyId),
    specialtyLabel:clean(target.specialtyLabel),
    interviewDate:clean(target.interviewDate),
    location:clean(target.location),
    label:clean(target.label),
    calendarEventId:clean(target.calendarEventId),
    meetingInformation:clean(target.meetingInformation),
    logoMediaId:clean(target.logoMediaId),
    logoFit:target.logoFit==="cover"?"cover":"contain",
    logoX:Number(target.logoX)||1560,
    logoY:Number(target.logoY)||112,
    logoWidth:Number(target.logoWidth)||180,
    logoHeight:Number(target.logoHeight)||96
  };
  if(state.activeVariantId===variant.id)syncInterviewLogoWell(document);
  return{ok:true,interviewTarget:clone(variant.interviewTarget)};
}

export function applyActiveSpecialtyVariant(document){
  const projected=clone(document||{});
  const state=normalizeSpecialtyVariants(projected);
  const active=state.variants.find(({id})=>id===state.activeVariantId)||state.variants[0];
  projected.specialtyVariants=state;
  projected.builder={
    ...(projected.builder||{}),
    targetSpecialtyId:active.specialty.id,
    targetSpecialtyLabel:active.specialty.label,
    activeSpecialtyVariantId:active.id
  };
  projected.studentProfile={
    ...(projected.studentProfile||{}),
    specialtyGoal:active.specialty.label
  };
  const hidden=new Set(active.hiddenEventIds);
  projected.events=(projected.events||[]).filter((event)=>!hidden.has(clean(event?.id)));
  projected.metadata={
    ...(projected.metadata||{}),
    activeSpecialtyVariant:{
      id:active.id,
      name:active.name,
      specialty:clone(active.specialty)
    },
    interview:{
      ...(projected.metadata?.interview||{}),
      mode:active.interviewTarget.mode,
      prog:active.interviewTarget.mode==="specific"
        ?active.interviewTarget.programName
        :"",
      specialty:active.interviewTarget.specialtyLabel,
      date:active.interviewTarget.mode==="specific"
        ?active.interviewTarget.interviewDate
        :"",
      location:active.interviewTarget.location,
      label:active.interviewTarget.label,
      calendarEventId:active.interviewTarget.calendarEventId,
      meetingInformation:active.interviewTarget.meetingInformation,
      logoMediaId:active.interviewTarget.logoMediaId
    }
  };
  // The ribbon's logo well is the logo's home on the 2025 board. Once a student
  // has filled that fixed frame (from the Timeline, the Builder preview or the
  // interview editor), the interview target's free placement would paint the same
  // logo a second time above the well, so it yields to the frame.
  syncInterviewLogoWell(projected,{synthesize:false});
  const logoWellFilled=(projected.mediaItems||[]).some((item)=>String(item?.placement||"").toLowerCase()==="ribbon");
  if(active.interviewTarget.logoMediaId&&logoWellFilled){
    projected.advanced={
      ...(projected.advanced||{}),
      media:(projected.advanced?.media||[]).map((item)=>
        item.id===active.interviewTarget.logoMediaId?{...item,role:"interview-program-logo"}:item
      )
    };
  }
  if(active.interviewTarget.logoMediaId&&!logoWellFilled){
    projected.advanced={
      ...(projected.advanced||{}),
      media:(projected.advanced?.media||[]).map((item)=>
        item.id===active.interviewTarget.logoMediaId
          ?{
            ...item,
            placed:true,
            x:active.interviewTarget.logoX,
            y:active.interviewTarget.logoY,
            width:active.interviewTarget.logoWidth,
            height:active.interviewTarget.logoHeight,
            fit:active.interviewTarget.logoFit,
            guidedVisible:true,
            role:"interview-program-logo"
          }
          :item
      )
    };
  }
  return projected;
}
