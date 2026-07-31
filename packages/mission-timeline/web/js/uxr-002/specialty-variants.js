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
    id:clean(variant?.id)||`specialty-variant:${index+1}`,
    name:safeName(variant?.name,fallbackName),
    specialty:{id,label},
    hiddenEventIds:unique(variant?.hiddenEventIds),
    interviewTarget:{
      programId:clean(variant?.interviewTarget?.programId),
      programName:clean(variant?.interviewTarget?.programName),
      interviewDate:clean(variant?.interviewTarget?.interviewDate),
      label:clean(variant?.interviewTarget?.label)
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
    specialty:{id,label}
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
  return{ok:true,variant:clone(variant),state:clone(state)};
}

export function switchSpecialtyVariant(document,variantId){
  const state=ensureSpecialtyVariants(document);
  const id=clean(variantId);
  if(!state.variants.some((variant)=>variant.id===id)){
    return{ok:false,code:"SPECIALTY_VARIANT_NOT_FOUND"};
  }
  state.activeVariantId=id;
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
    programId:clean(target.programId),
    programName:clean(target.programName),
    interviewDate:clean(target.interviewDate),
    label:clean(target.label)
  };
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
      prog:active.interviewTarget.programName,
      date:active.interviewTarget.interviewDate,
      label:active.interviewTarget.label
    }
  };
  return projected;
}
